<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_once dirname(__DIR__) . '/catalogos_api/backblaze_helpers.php';
admin_require_login(['admin', 'sales']);

const CATALOG_IMAGE_UPDATE_MAX_BYTES = 8388608;
const CATALOG_IMAGE_THUMB_MAX_WIDTH = 720;
const CATALOG_IMAGE_THUMB_BATCH_LIMIT = 40;

$catalogId = (int) ($_GET['catalog_id'] ?? $_POST['catalog_id'] ?? 0);
$catalog = $catalogId > 0 ? admin_image_update_fetch_catalog($catalogId) : null;
$message = '';
$errorMessage = '';
$products = [];
$missingProducts = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    try {
        if (!$catalog) {
            throw new RuntimeException('Catalogo no encontrado.');
        }
        if (resolve_catalog_status($catalog) !== 'active') {
            throw new RuntimeException('Solo se pueden actualizar imagenes de catalogos activos.');
        }
        $action = (string) ($_POST['action'] ?? 'update_image');
        if ($action === 'generate_missing_thumbs') {
            $result = admin_image_update_generate_missing_thumbnails($catalog);
            $message = 'Miniaturas creadas: ' . $result['created'] . '. Omitidas: ' . $result['skipped'] . '. Revisadas: ' . $result['processed'] . '. Backup: ' . $result['backup'];
            if (!empty($result['errors'])) {
                $message .= ' Algunos ITEM no pudieron procesarse: ' . implode(', ', array_slice($result['errors'], 0, 5));
            }
        } else {
            $result = admin_image_update_apply($catalog);
            $message = 'Imagen actualizada para ITEM ' . $result['item'] . '. Backup: ' . $result['backup'];
        }
        $catalog = admin_image_update_fetch_catalog($catalogId);
    } catch (Throwable $exception) {
        $errorMessage = $exception->getMessage();
    }
}

if ($catalog) {
    try {
        $json = admin_image_update_read_catalog_json(admin_image_update_catalog_json_full_path($catalog));
        $products = admin_image_update_products($json);
        $missingProducts = array_values(array_filter($products, static fn(array $product): bool => !admin_image_update_product_has_image($product)));
    } catch (Throwable $exception) {
        $errorMessage = $errorMessage !== '' ? $errorMessage : $exception->getMessage();
    }
}

admin_header('Actualizar imagenes de catalogo', 'catalogos.php');
?>
<section class="card">
    <div class="toolbar">
        <strong>Actualizar imagen por ITEM</strong>
        <a class="button" href="catalogos.php">Volver</a>
    </div>

    <?php if (!$catalog): ?>
        <p class="muted">Catalogo no encontrado.</p>
    <?php else: ?>
        <p class="muted">Catalogo: <strong><?= html_escape($catalog['title'] ?? '') ?></strong></p>
        <p class="muted">Puedes subir una imagen para actualizar el ITEM o pegar una URL ya subida a Backblaze/CDN. Si Backblaze esta habilitado en <code>catalogos_api/config.php</code>, la imagen subida se enviara directo al CDN.</p>

        <?php if ($message !== ''): ?>
            <div class="notice notice--success" style="margin:16px 0;"><?= html_escape($message) ?></div>
        <?php endif; ?>
        <?php if ($errorMessage !== ''): ?>
            <div class="notice notice--warning" style="margin:16px 0;"><?= html_escape($errorMessage) ?></div>
        <?php endif; ?>

        <div class="metrics-grid" style="margin:18px 0;">
            <div class="metric-card"><span>Productos</span><strong><?= count($products) ?></strong></div>
            <div class="metric-card"><span>Sin imagen detectada</span><strong><?= count($missingProducts) ?></strong></div>
        </div>

        <?php if ($missingProducts): ?>
            <details style="margin:0 0 18px;">
                <summary>Ver primeros ITEM sin imagen</summary>
                <div class="table-wrap" style="margin-top:12px;">
                    <table>
                        <thead><tr><th>ITEM</th><th>Descripcion</th></tr></thead>
                        <tbody>
                        <?php foreach (array_slice($missingProducts, 0, 40) as $product): ?>
                            <tr>
                                <td><?= html_escape($product['item'] ?? '') ?></td>
                                <td><?= html_escape($product['description'] ?? $product['shortDescription'] ?? '') ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </details>
        <?php endif; ?>

        <form class="form-grid" method="post" enctype="multipart/form-data">
            <?= csrf_field() ?>
            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
            <input type="hidden" name="action" value="update_image">
            <label>
                <span>ITEM</span>
                <input type="text" name="item" placeholder="Ejemplo: 87757" required>
            </label>
            <label class="wide">
                <span>Subir imagen</span>
                <input type="file" name="product_image" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
            </label>
            <label class="wide">
                <span>O URL de imagen Backblaze/CDN</span>
                <input type="url" name="image_url" placeholder="https://...">
            </label>
            <div class="wide"><button class="button--primary" type="submit">Actualizar imagen</button></div>
        </form>

        <hr style="margin:24px 0;">
        <form class="form-grid" method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
            <input type="hidden" name="action" value="generate_missing_thumbs">
            <div class="wide">
                <strong>Miniaturas para imagenes existentes</strong>
                <p class="muted">Crea miniaturas para productos que ya tienen imagen grande, pero no tienen miniatura guardada. Procesa hasta <?= CATALOG_IMAGE_THUMB_BATCH_LIMIT ?> productos por corrida para no cargar el hosting.</p>
            </div>
            <div class="wide"><button class="button" type="submit">Generar miniaturas faltantes</button></div>
        </form>
    <?php endif; ?>
</section>
<?php admin_footer(); ?>

<?php
function admin_image_update_fetch_catalog(int $catalogId): ?array
{
    if (!admin_table_exists('catalogs')) return null;
    $stmt = db()->prepare('SELECT * FROM catalogs WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $catalogId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function admin_image_update_apply(array $catalog): array
{
    $item = admin_image_update_item_key((string) ($_POST['item'] ?? ''));
    if ($item === '') {
        throw new RuntimeException('Debes indicar un ITEM.');
    }

    $jsonPath = admin_image_update_catalog_json_full_path($catalog);
    $json = admin_image_update_read_catalog_json($jsonPath);
    $products =& admin_image_update_products_ref($json);
    $productIndex = null;
    foreach ($products as $idx => $product) {
        if (admin_image_update_item_key((string) ($product['item'] ?? $product['item_code'] ?? '')) === $item) {
            $productIndex = $idx;
            break;
        }
    }
    if ($productIndex === null) {
        throw new RuntimeException('No se encontro el ITEM en este catalogo.');
    }

    $imageUrl = trim((string) ($_POST['image_url'] ?? ''));
    $thumbnailUrl = '';
    if ($imageUrl !== '' && !preg_match('#^https?://#i', $imageUrl)) {
        throw new RuntimeException('La URL debe iniciar con http:// o https://.');
    }
    if ($imageUrl === '') {
        $upload = admin_image_update_save_upload($catalog, $item, dirname($jsonPath));
        $imageUrl = $upload['image_url'] ?? '';
        $thumbnailUrl = $upload['thumbnail_url'] ?? '';
    }
    if ($imageUrl === '') {
        throw new RuntimeException('Debes subir una imagen o indicar una URL.');
    }

    $backup = admin_image_update_backup_catalog_json($jsonPath, (string) ($catalog['slug'] ?? 'catalogo'));
    admin_image_update_set_product_image($products[$productIndex], $imageUrl, $thumbnailUrl);
    admin_image_update_write_catalog_json($jsonPath, $json);
    if (admin_column_exists('catalogs', 'updated_at')) {
        db()->prepare('UPDATE catalogs SET updated_at = NOW() WHERE id = :id')->execute(['id' => (int) $catalog['id']]);
    }
    audit_log('catalog.product_image_updated', 'catalogs', (int) $catalog['id'], [
        'item' => $item,
        'image_url' => $imageUrl,
    ]);

    return [
        'item' => $item,
        'backup' => $backup,
    ];
}

function admin_image_update_generate_missing_thumbnails(array $catalog): array
{
    if (backblaze_upload_enabled() && !backblaze_upload_configured()) {
        throw new RuntimeException('Backblaze esta habilitado, pero faltan datos en catalogos_api/config.php.');
    }

    $jsonPath = admin_image_update_catalog_json_full_path($catalog);
    $catalogDir = dirname($jsonPath);
    $json = admin_image_update_read_catalog_json($jsonPath);
    $products =& admin_image_update_products_ref($json);
    $processed = 0;
    $created = 0;
    $skipped = 0;
    $errors = [];

    foreach ($products as &$product) {
        if (!is_array($product) || admin_image_update_product_has_thumbnail($product)) {
            continue;
        }
        $imageUrl = admin_image_update_product_main_image_url($product);
        if ($imageUrl === '') {
            continue;
        }
        if ($processed >= CATALOG_IMAGE_THUMB_BATCH_LIMIT) {
            break;
        }
        $processed++;
        $item = admin_image_update_item_key((string) ($product['item'] ?? $product['item_code'] ?? 'item')) ?: 'item';
        try {
            $source = admin_image_update_prepare_source_image($imageUrl, $catalogDir);
            if (!$source) {
                $skipped++;
                continue;
            }
            try {
                $thumbnailUrl = admin_image_update_store_generated_thumbnail($catalog, $catalogDir, $item, $source['path'], $source['extension']);
            } finally {
                if (!empty($source['cleanup'])) {
                    @unlink($source['path']);
                }
            }
            if ($thumbnailUrl === '') {
                $skipped++;
                continue;
            }
            admin_image_update_set_product_thumbnail($product, $thumbnailUrl, $imageUrl);
            $created++;
        } catch (Throwable $exception) {
            $skipped++;
            $errors[] = $item . ' (' . $exception->getMessage() . ')';
        }
    }
    unset($product);

    $backup = 'sin cambios';
    if ($created > 0) {
        $backup = admin_image_update_backup_catalog_json($jsonPath, (string) ($catalog['slug'] ?? 'catalogo'));
        admin_image_update_write_catalog_json($jsonPath, $json);
        if (admin_column_exists('catalogs', 'updated_at')) {
            db()->prepare('UPDATE catalogs SET updated_at = NOW() WHERE id = :id')->execute(['id' => (int) $catalog['id']]);
        }
        audit_log('catalog.product_thumbnails_generated', 'catalogs', (int) $catalog['id'], [
            'created' => $created,
            'processed' => $processed,
            'skipped' => $skipped,
        ]);
    }

    return [
        'processed' => $processed,
        'created' => $created,
        'skipped' => $skipped,
        'backup' => $backup,
        'errors' => $errors,
    ];
}

function admin_image_update_save_upload(array $catalog, string $item, string $catalogDir): array
{
    if (empty($_FILES['product_image']) || !is_array($_FILES['product_image'])) {
        return ['image_url' => '', 'thumbnail_url' => ''];
    }
    $file = $_FILES['product_image'];
    if ((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return ['image_url' => '', 'thumbnail_url' => ''];
    }
    if ((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo recibir la imagen.');
    }
    if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > CATALOG_IMAGE_UPDATE_MAX_BYTES) {
        throw new RuntimeException('La imagen debe pesar menos de 8 MB.');
    }
    $originalName = basename((string) ($file['name'] ?? 'imagen.jpg'));
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) {
        throw new RuntimeException('Formato no permitido. Usa JPG, PNG o WEBP.');
    }
    if (!is_uploaded_file((string) ($file['tmp_name'] ?? ''))) {
        throw new RuntimeException('La subida de imagen no es valida.');
    }
    if (backblaze_upload_enabled()) {
        return admin_image_update_save_upload_backblaze($catalog, $item, (string) $file['tmp_name'], $extension);
    }
    $mediaDir = $catalogDir . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'main';
    if (!is_dir($mediaDir) && !mkdir($mediaDir, 0775, true) && !is_dir($mediaDir)) {
        throw new RuntimeException('No se pudo crear la carpeta de imagenes del catalogo.');
    }
    $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
    $fileName = $safeItem . '-actualizada-' . date('YmdHis') . '.' . $extension;
    $targetPath = $mediaDir . DIRECTORY_SEPARATOR . $fileName;
    $thumbnailUrl = admin_image_update_save_local_thumbnail((string) $file['tmp_name'], $extension, $mediaDir, $safeItem);
    if (!move_uploaded_file((string) $file['tmp_name'], $targetPath)) {
        throw new RuntimeException('No se pudo guardar la imagen en el catalogo.');
    }
    return ['image_url' => './media/main/' . $fileName, 'thumbnail_url' => $thumbnailUrl];
}

function admin_image_update_save_upload_backblaze(array $catalog, string $item, string $tmpPath, string $extension): array
{
    if (!backblaze_upload_configured()) {
        throw new RuntimeException('Backblaze esta habilitado, pero faltan datos en catalogos_api/config.php.');
    }
    $slug = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string) ($catalog['slug'] ?? 'catalogo')) ?: 'catalogo';
    $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
    $extension = strtolower($extension);
    $contentType = match ($extension) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => 'application/octet-stream',
    };
    $stamp = date('YmdHis');
    $objectKey = 'catalogos/' . $slug . '/updates/' . $safeItem . '-' . $stamp . '.' . $extension;
    $imageUrl = backblaze_upload_file($tmpPath, $objectKey, $contentType);
    $thumbnailUrl = '';
    $thumbnail = admin_image_update_create_thumbnail($tmpPath, $extension);
    if ($thumbnail) {
        try {
            $thumbKey = 'catalogos/' . $slug . '/updates/thumbs/' . $safeItem . '-' . $stamp . '.' . $thumbnail['extension'];
            $thumbnailUrl = backblaze_upload_file($thumbnail['path'], $thumbKey, $thumbnail['content_type']);
        } finally {
            @unlink($thumbnail['path']);
        }
    }
    return ['image_url' => $imageUrl, 'thumbnail_url' => $thumbnailUrl];
}

function admin_image_update_save_local_thumbnail(string $sourcePath, string $extension, string $mediaDir, string $safeItem): string
{
    $thumbnail = admin_image_update_create_thumbnail($sourcePath, $extension);
    if (!$thumbnail) return '';
    $thumbDir = $mediaDir . DIRECTORY_SEPARATOR . 'thumbs';
    if (!is_dir($thumbDir) && !mkdir($thumbDir, 0775, true) && !is_dir($thumbDir)) {
        @unlink($thumbnail['path']);
        return '';
    }
    $fileName = $safeItem . '-thumb-' . date('YmdHis') . '.' . $thumbnail['extension'];
    $targetPath = $thumbDir . DIRECTORY_SEPARATOR . $fileName;
    if (!rename($thumbnail['path'], $targetPath)) {
        @unlink($thumbnail['path']);
        return '';
    }
    return './media/main/thumbs/' . $fileName;
}

function admin_image_update_store_generated_thumbnail(array $catalog, string $catalogDir, string $item, string $sourcePath, string $extension): string
{
    $thumbnail = admin_image_update_create_thumbnail($sourcePath, $extension);
    if (!$thumbnail) return '';
    try {
        if (backblaze_upload_enabled()) {
            $slug = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string) ($catalog['slug'] ?? 'catalogo')) ?: 'catalogo';
            $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
            $thumbKey = 'catalogos/' . $slug . '/updates/thumbs/' . $safeItem . '-generated-' . date('YmdHis') . '.' . $thumbnail['extension'];
            return backblaze_upload_file($thumbnail['path'], $thumbKey, $thumbnail['content_type']);
        }

        $mediaDir = $catalogDir . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'main';
        $thumbDir = $mediaDir . DIRECTORY_SEPARATOR . 'thumbs';
        if (!is_dir($thumbDir) && !mkdir($thumbDir, 0775, true) && !is_dir($thumbDir)) {
            return '';
        }
        $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
        $fileName = $safeItem . '-generated-thumb-' . date('YmdHis') . '.' . $thumbnail['extension'];
        $targetPath = $thumbDir . DIRECTORY_SEPARATOR . $fileName;
        if (!rename($thumbnail['path'], $targetPath)) {
            return '';
        }
        $thumbnail['path'] = '';
        return './media/main/thumbs/' . $fileName;
    } finally {
        if (!empty($thumbnail['path'])) {
            @unlink($thumbnail['path']);
        }
    }
}

function admin_image_update_create_thumbnail(string $sourcePath, string $extension): ?array
{
    if (!extension_loaded('gd')) return null;
    $extension = strtolower($extension);
    $source = match ($extension) {
        'jpg', 'jpeg' => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($sourcePath) : false,
        'png' => function_exists('imagecreatefrompng') ? @imagecreatefrompng($sourcePath) : false,
        'webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($sourcePath) : false,
        default => false,
    };
    if (!$source) return null;
    $width = imagesx($source);
    $height = imagesy($source);
    if ($width < 1 || $height < 1) {
        imagedestroy($source);
        return null;
    }
    $scale = min(1, CATALOG_IMAGE_THUMB_MAX_WIDTH / max($width, $height));
    $targetWidth = max(1, (int) round($width * $scale));
    $targetHeight = max(1, (int) round($height * $scale));
    $thumb = imagecreatetruecolor($targetWidth, $targetHeight);
    imagealphablending($thumb, false);
    imagesavealpha($thumb, true);
    imagecopyresampled($thumb, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
    imagedestroy($source);

    $tmpPath = tempnam(sys_get_temp_dir(), 'catalog-thumb-');
    if (!is_string($tmpPath) || $tmpPath === '') {
        imagedestroy($thumb);
        return null;
    }
    if (function_exists('imagewebp') && imagewebp($thumb, $tmpPath, 82)) {
        imagedestroy($thumb);
        return ['path' => $tmpPath, 'extension' => 'webp', 'content_type' => 'image/webp'];
    }
    $white = imagecreatetruecolor($targetWidth, $targetHeight);
    $background = imagecolorallocate($white, 255, 255, 255);
    imagefill($white, 0, 0, $background);
    imagecopy($white, $thumb, 0, 0, 0, 0, $targetWidth, $targetHeight);
    imagedestroy($thumb);
    if (imagejpeg($white, $tmpPath, 82)) {
        imagedestroy($white);
        return ['path' => $tmpPath, 'extension' => 'jpg', 'content_type' => 'image/jpeg'];
    }
    imagedestroy($white);
    @unlink($tmpPath);
    return null;
}

function admin_image_update_catalog_json_full_path(array $catalog): string
{
    $relative = trim((string) ($catalog['catalog_json_path'] ?? ''));
    if ($relative === '') throw new RuntimeException('El catalogo no tiene ruta catalog_json_path.');
    $base = realpath(dirname(__DIR__));
    $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relative);
    $resolvedDir = realpath(dirname($path));
    if (!$base || !$resolvedDir || !str_starts_with($resolvedDir, $base) || !is_file($path)) {
        throw new RuntimeException('No se encontro catalog.json dentro del hosting permitido.');
    }
    return $path;
}

function admin_image_update_read_catalog_json(string $path): array
{
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) throw new RuntimeException('catalog.json no es valido.');
    return $decoded;
}

function &admin_image_update_products_ref(array &$json): array
{
    foreach (['catalog', 'products', 'items'] as $key) {
        if (isset($json[$key]) && is_array($json[$key])) {
            return $json[$key];
        }
    }
    throw new RuntimeException('No se encontro arreglo de productos en catalog.json.');
}

function admin_image_update_products(array $json): array
{
    foreach (['catalog', 'products', 'items'] as $key) {
        if (isset($json[$key]) && is_array($json[$key])) {
            return array_values(array_filter($json[$key], 'is_array'));
        }
    }
    return [];
}

function admin_image_update_set_product_image(array &$product, string $imageUrl, string $thumbnailUrl = ''): void
{
    $isRemote = preg_match('#^https?://#i', $imageUrl) === 1;
    $product['image_url'] = $imageUrl;
    $product['imageUrl'] = $imageUrl;
    if ($isRemote) {
        $product['remote_image_url'] = $imageUrl;
        $product['remoteImageUrl'] = $imageUrl;
    }
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    $media['mainImage'] = $imageUrl;
    $media['main_image'] = $imageUrl;
    $media['mainImageCandidates'] = [$imageUrl];
    $media['gallery'] = [$imageUrl];
    if ($thumbnailUrl !== '') {
        $product['thumbnail_url'] = $thumbnailUrl;
        $product['thumbnailUrl'] = $thumbnailUrl;
        $media['thumbnail'] = $thumbnailUrl;
        $media['thumbnailUrl'] = $thumbnailUrl;
        $media['cardImage'] = $thumbnailUrl;
        $media['cardImageCandidates'] = [$thumbnailUrl, $imageUrl];
    }
    if ($isRemote) {
        $media['remote_image_url'] = $imageUrl;
        $media['remoteImageUrl'] = $imageUrl;
    }
    $product['media'] = $media;
}

function admin_image_update_product_has_image(array $product): bool
{
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    $values = [
        $product['remote_image_url'] ?? '',
        $product['remoteImageUrl'] ?? '',
        $product['image_url'] ?? '',
        $product['imageUrl'] ?? '',
        $product['main_image'] ?? '',
        $product['mainImage'] ?? '',
        $media['remote_image_url'] ?? '',
        $media['remoteImageUrl'] ?? '',
        $media['mainImage'] ?? '',
        $media['main_image'] ?? '',
    ];
    if (!empty($media['gallery']) && is_array($media['gallery'])) {
        $values[] = $media['gallery'][0] ?? '';
    }
    foreach ($values as $value) {
        if (trim((string) $value) !== '') return true;
    }
    return false;
}

function admin_image_update_product_has_thumbnail(array $product): bool
{
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    $values = [
        $product['thumbnail_url'] ?? '',
        $product['thumbnailUrl'] ?? '',
        $media['thumbnail'] ?? '',
        $media['thumbnailUrl'] ?? '',
        $media['cardImage'] ?? '',
    ];
    if (!empty($media['cardImageCandidates']) && is_array($media['cardImageCandidates'])) {
        $values[] = $media['cardImageCandidates'][0] ?? '';
    }
    foreach ($values as $value) {
        if (trim((string) $value) !== '') return true;
    }
    return false;
}

function admin_image_update_product_main_image_url(array $product): string
{
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    $values = [
        $product['remote_image_url'] ?? '',
        $product['remoteImageUrl'] ?? '',
        $product['image_url'] ?? '',
        $product['imageUrl'] ?? '',
        $product['main_image'] ?? '',
        $product['mainImage'] ?? '',
        $media['remote_image_url'] ?? '',
        $media['remoteImageUrl'] ?? '',
        $media['mainImage'] ?? '',
        $media['main_image'] ?? '',
    ];
    if (!empty($media['gallery']) && is_array($media['gallery'])) {
        array_push($values, ...$media['gallery']);
    }
    foreach ($values as $value) {
        $url = trim((string) $value);
        if ($url !== '') return $url;
    }
    return '';
}

function admin_image_update_set_product_thumbnail(array &$product, string $thumbnailUrl, string $imageUrl): void
{
    $product['thumbnail_url'] = $thumbnailUrl;
    $product['thumbnailUrl'] = $thumbnailUrl;
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    $media['thumbnail'] = $thumbnailUrl;
    $media['thumbnailUrl'] = $thumbnailUrl;
    $media['cardImage'] = $thumbnailUrl;
    $media['cardImageCandidates'] = [$thumbnailUrl, $imageUrl];
    $product['media'] = $media;
}

function admin_image_update_prepare_source_image(string $imageUrl, string $catalogDir): ?array
{
    if (preg_match('#^https?://#i', $imageUrl) === 1) {
        return admin_image_update_download_remote_image($imageUrl);
    }

    $pathOnly = preg_replace('/[?#].*$/', '', $imageUrl) ?? $imageUrl;
    $relative = ltrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $pathOnly), '.\\/');
    if ($relative === '') return null;
    $path = $catalogDir . DIRECTORY_SEPARATOR . $relative;
    $base = realpath($catalogDir);
    $resolved = realpath($path);
    if (!$base || !$resolved || !str_starts_with($resolved, $base) || !is_file($resolved)) {
        return null;
    }
    $extension = admin_image_update_image_extension_from_path($resolved);
    if ($extension === '') return null;
    return ['path' => $resolved, 'extension' => $extension, 'cleanup' => false];
}

function admin_image_update_download_remote_image(string $imageUrl): ?array
{
    if (!function_exists('curl_init')) return null;
    $tmpPath = tempnam(sys_get_temp_dir(), 'catalog-source-');
    if (!is_string($tmpPath) || $tmpPath === '') return null;

    $file = fopen($tmpPath, 'wb');
    if (!$file) {
        @unlink($tmpPath);
        return null;
    }
    $curl = curl_init($imageUrl);
    if ($curl === false) {
        fclose($file);
        @unlink($tmpPath);
        return null;
    }
    curl_setopt_array($curl, [
        CURLOPT_FILE => $file,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_USERAGENT => 'RodeoCatalogAdmin/1.0',
    ]);
    $ok = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $contentType = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
    curl_close($curl);
    fclose($file);

    if ($ok === false || $status < 200 || $status >= 300 || !is_file($tmpPath) || filesize($tmpPath) <= 0 || filesize($tmpPath) > CATALOG_IMAGE_UPDATE_MAX_BYTES) {
        @unlink($tmpPath);
        return null;
    }
    $extension = admin_image_update_image_extension_from_content_type($contentType);
    if ($extension === '') {
        $extension = admin_image_update_image_extension_from_path((string) parse_url($imageUrl, PHP_URL_PATH));
    }
    if ($extension === '') {
        @unlink($tmpPath);
        return null;
    }
    return ['path' => $tmpPath, 'extension' => $extension, 'cleanup' => true];
}

function admin_image_update_image_extension_from_path(string $path): string
{
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if ($extension === 'jpeg') return 'jpg';
    return in_array($extension, ['jpg', 'png', 'webp'], true) ? $extension : '';
}

function admin_image_update_image_extension_from_content_type(string $contentType): string
{
    $contentType = strtolower($contentType);
    if (str_contains($contentType, 'image/jpeg')) return 'jpg';
    if (str_contains($contentType, 'image/png')) return 'png';
    if (str_contains($contentType, 'image/webp')) return 'webp';
    return '';
}

function admin_image_update_backup_catalog_json(string $jsonPath, string $slug): string
{
    $backupDir = dirname($jsonPath) . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir) && !mkdir($backupDir, 0775, true) && !is_dir($backupDir)) {
        throw new RuntimeException('No se pudo crear carpeta de backup.');
    }
    $backupPath = $backupDir . DIRECTORY_SEPARATOR . preg_replace('/[^A-Za-z0-9_-]+/', '-', $slug) . '-images-' . date('Ymd-His') . '.json';
    if (!copy($jsonPath, $backupPath)) throw new RuntimeException('No se pudo crear backup.');
    return $backupPath;
}

function admin_image_update_write_catalog_json(string $path, array $json): void
{
    $encoded = json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('No se pudo escribir catalog.json actualizado.');
    }
}

function admin_image_update_item_key(string $value): string
{
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized) || $normalized === '') {
        $normalized = $value;
    }

    return preg_replace('/[^A-Z0-9]+/', '', strtoupper($normalized)) ?? '';
}
