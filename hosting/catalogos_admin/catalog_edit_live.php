<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login(['admin', 'sales']);

const CATALOG_LIVE_EDIT_MAX_BYTES = 8388608;

$catalogId = (int) ($_GET['catalog_id'] ?? $_POST['catalog_id'] ?? 0);
$catalog = $catalogId > 0 ? live_edit_fetch_catalog($catalogId) : null;
$message = '';
$errorMessage = '';
$json = [];
$jsonPath = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    try {
        if (!$catalog) {
            throw new RuntimeException('Catalogo no encontrado.');
        }
        if (resolve_catalog_status($catalog) !== 'active') {
            throw new RuntimeException('Solo se pueden editar catalogos activos.');
        }
        $result = live_edit_apply($catalog);
        $message = 'Catalogo visual actualizado. Backup: ' . $result['backup'];
        $catalog = live_edit_fetch_catalog($catalogId);
    } catch (Throwable $exception) {
        $errorMessage = $exception->getMessage();
    }
}

if ($catalog) {
    try {
        $jsonPath = live_edit_catalog_json_full_path($catalog);
        $json = live_edit_read_catalog_json($jsonPath);
    } catch (Throwable $exception) {
        $errorMessage = $errorMessage !== '' ? $errorMessage : $exception->getMessage();
    }
}

$promotion = is_array($json['promotion'] ?? null) ? $json['promotion'] : [];
$theme = is_array($json['theme'] ?? null) ? $json['theme'] : [];
$promoImages = live_edit_promo_images($promotion);

admin_header('Editar catalogo publicado', 'catalogos.php');
?>
<section class="card">
    <div class="toolbar">
        <strong>Editar catalogo publicado</strong>
        <a class="button" href="catalogos.php">Volver</a>
    </div>

    <?php if (!$catalog): ?>
        <p class="muted">Catalogo no encontrado.</p>
    <?php else: ?>
        <p class="muted">Catalogo: <strong><?= html_escape($catalog['title'] ?? '') ?></strong> &middot; <code><?= html_escape($catalog['slug'] ?? '') ?></code></p>
        <p class="muted">Esta pantalla solo cambia textos visuales, logo, colores y promocion. No modifica productos, precios, pedidos ni links.</p>

        <?php if ($message !== ''): ?>
            <div class="notice notice--success" style="margin:16px 0;"><?= html_escape($message) ?></div>
        <?php endif; ?>
        <?php if ($errorMessage !== ''): ?>
            <div class="notice notice--warning" style="margin:16px 0;"><?= html_escape($errorMessage) ?></div>
        <?php endif; ?>

        <?php if ($json): ?>
            <form class="form-grid" method="post" enctype="multipart/form-data" onsubmit="return confirm('Confirmas guardar estos cambios visuales del catalogo?');">
                <?= csrf_field() ?>
                <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">

                <div class="wide"><strong>Identidad</strong></div>
                <label>
                    <span>Nombre del catalogo</span>
                    <input type="text" name="title" value="<?= html_escape($json['title'] ?? $catalog['title'] ?? '') ?>" required>
                </label>
                <label>
                    <span>Texto debajo del nombre</span>
                    <input type="text" name="footerText" value="<?= html_escape($json['footerText'] ?? '') ?>">
                </label>
                <label>
                    <span>Color principal</span>
                    <input type="color" name="primaryColor" value="<?= html_escape(live_edit_color($theme['primaryColor'] ?? '#2d6b4f', '#2d6b4f')) ?>">
                </label>
                <label>
                    <span>Color secundario</span>
                    <input type="color" name="secondaryColor" value="<?= html_escape(live_edit_color($theme['secondaryColor'] ?? '#174531', '#174531')) ?>">
                </label>
                <label class="wide">
                    <span>Logo nuevo</span>
                    <input type="file" name="logo_file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
                    <small>Opcional. Si no subes logo, se conserva el actual: <?= html_escape($json['logoUrl'] ?? 'sin logo') ?></small>
                </label>

                <div class="wide"><strong>Hero</strong></div>
                <label class="wide">
                    <span>Titulo hero</span>
                    <input type="text" name="heroTitle" value="<?= html_escape($json['heroTitle'] ?? $json['title'] ?? '') ?>">
                </label>
                <label class="wide">
                    <span>Subtitulo hero</span>
                    <input type="text" name="heroSubtitle" value="<?= html_escape($json['heroSubtitle'] ?? '') ?>">
                </label>
                <label class="wide">
                    <span>Imagen/fondo hero</span>
                    <input type="file" name="hero_file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
                    <small>Opcional. Actual: <?= html_escape($json['heroImage'] ?? 'sin imagen') ?></small>
                </label>

                <div class="wide"><strong>Promocion y slider</strong></div>
                <label>
                    <span>Titulo promocion</span>
                    <input type="text" name="promoTitle" value="<?= html_escape($promotion['title'] ?? '') ?>">
                </label>
                <label>
                    <span>Texto promocion</span>
                    <input type="text" name="promoText" value="<?= html_escape($promotion['text'] ?? '') ?>">
                </label>
                <label>
                    <span>Texto boton</span>
                    <input type="text" name="promoLinkLabel" value="<?= html_escape($promotion['linkLabel'] ?? $promotion['link_label'] ?? '') ?>">
                </label>
                <label>
                    <span>URL boton</span>
                    <input type="url" name="promoLinkUrl" value="<?= html_escape($promotion['linkUrl'] ?? $promotion['link_url'] ?? '') ?>">
                </label>
                <label>
                    <span>Intervalo slider</span>
                    <select name="slideInterval">
                        <?php foreach ([3000 => '3 segundos', 5000 => '5 segundos', 8000 => '8 segundos', 15000 => '15 segundos'] as $value => $label): ?>
                            <option value="<?= (int) $value ?>" <?= (int) ($promotion['slideInterval'] ?? 15000) === $value ? 'selected' : '' ?>><?= html_escape($label) ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label class="wide">
                    <span>Agregar imagenes al slider</span>
                    <input type="file" name="promo_files[]" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple>
                </label>

                <?php if ($promoImages): ?>
                    <div class="wide table-wrap">
                        <table>
                            <thead><tr><th>Imagen actual</th><th>Vista</th><th>Accion</th></tr></thead>
                            <tbody>
                            <?php foreach ($promoImages as $index => $image): ?>
                                <tr>
                                    <td><code><?= html_escape($image) ?></code><input type="hidden" name="existingPromoImages[]" value="<?= html_escape($image) ?>"></td>
                                    <td><img src="<?= html_escape(live_edit_public_asset_url($catalog, $image)) ?>" alt="" style="width:110px;height:62px;object-fit:cover;border-radius:8px;border:1px solid #ddd;background:#fff;"></td>
                                    <td><label class="check-row"><input type="checkbox" name="removePromoImages[]" value="<?= html_escape($image) ?>"> <span>Quitar</span></label></td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>

                <div class="wide"><button class="button--primary" type="submit">Guardar cambios visuales</button></div>
            </form>
        <?php endif; ?>
    <?php endif; ?>
</section>
<?php admin_footer(); ?>

<?php
function live_edit_fetch_catalog(int $catalogId): ?array
{
    if (!admin_table_exists('catalogs')) return null;
    $stmt = db()->prepare('SELECT * FROM catalogs WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $catalogId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function live_edit_apply(array $catalog): array
{
    $jsonPath = live_edit_catalog_json_full_path($catalog);
    $json = live_edit_read_catalog_json($jsonPath);
    $catalogDir = dirname($jsonPath);
    $backup = live_edit_backup_catalog_json($jsonPath);

    $title = live_edit_clean_text((string) ($_POST['title'] ?? ''));
    if ($title === '') {
        throw new RuntimeException('El nombre del catalogo es obligatorio.');
    }

    $json['title'] = $title;
    $json['heroTitle'] = live_edit_clean_text((string) ($_POST['heroTitle'] ?? $title)) ?: $title;
    $json['heroSubtitle'] = live_edit_clean_text((string) ($_POST['heroSubtitle'] ?? ''));
    $json['footerText'] = live_edit_clean_text((string) ($_POST['footerText'] ?? ''));
    $json['theme'] = [
        'primaryColor' => live_edit_color((string) ($_POST['primaryColor'] ?? ''), (string) (($json['theme']['primaryColor'] ?? '') ?: '#2d6b4f')),
        'secondaryColor' => live_edit_color((string) ($_POST['secondaryColor'] ?? ''), (string) (($json['theme']['secondaryColor'] ?? '') ?: '#174531')),
    ];

    $logo = live_edit_store_uploaded_asset('logo_file', $catalogDir, 'media/brand', 'logo');
    if ($logo !== '') {
        $json['logoUrl'] = './' . $logo;
    }
    $hero = live_edit_store_uploaded_asset('hero_file', $catalogDir, 'media/brand', 'hero');
    if ($hero !== '') {
        $json['heroImage'] = './' . $hero;
    }

    $promotion = is_array($json['promotion'] ?? null) ? $json['promotion'] : [];
    $promotion['title'] = live_edit_clean_text((string) ($_POST['promoTitle'] ?? ''));
    $promotion['text'] = live_edit_clean_text((string) ($_POST['promoText'] ?? ''));
    $promotion['linkLabel'] = live_edit_clean_text((string) ($_POST['promoLinkLabel'] ?? ''));
    $promotion['linkUrl'] = live_edit_clean_text((string) ($_POST['promoLinkUrl'] ?? ''));
    $promotion['slideInterval'] = live_edit_slide_interval((int) ($_POST['slideInterval'] ?? 15000));

    $existing = array_map('strval', (array) ($_POST['existingPromoImages'] ?? []));
    $remove = array_flip(array_map('strval', (array) ($_POST['removePromoImages'] ?? [])));
    $images = [];
    foreach ($existing as $image) {
        $image = live_edit_safe_relative_url($image);
        if ($image !== '' && !isset($remove[$image])) {
            $images[] = $image;
        }
    }
    foreach (live_edit_store_multiple_promo_assets($catalogDir) as $relativePath) {
        $images[] = './' . $relativePath;
    }
    $images = live_edit_dedupe_strings($images);
    $promotion['images'] = $images;
    $promotion['imageUrls'] = $images;
    $promotion['imageUrl'] = $images[0] ?? '';
    $json['promotion'] = $promotion;

    live_edit_write_catalog_json($jsonPath, $json);
    live_edit_update_catalog_row($catalog, $json);

    audit_log('catalog.live_visual_updated', 'catalogs', (int) $catalog['id'], [
        'backup' => $backup,
        'title' => $title,
        'promo_images' => count($images),
    ]);

    return ['backup' => $backup];
}

function live_edit_catalog_json_full_path(array $catalog): string
{
    $relative = trim((string) ($catalog['catalog_json_path'] ?? ''));
    if ($relative === '') throw new RuntimeException('El catalogo no tiene ruta catalog_json_path.');
    $baseDir = dirname(__DIR__);
    $fullPath = $baseDir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relative);
    $realBase = realpath($baseDir);
    $realDir = realpath(dirname($fullPath));
    if (!$realBase || !$realDir || strpos($realDir, $realBase) !== 0 || !is_file($fullPath)) {
        throw new RuntimeException('No se encontro catalog.json dentro del hosting permitido.');
    }
    return $fullPath;
}

function live_edit_read_catalog_json(string $path): array
{
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) throw new RuntimeException('catalog.json no es valido.');
    return $decoded;
}

function live_edit_write_catalog_json(string $path, array $json): void
{
    $encoded = json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false || file_put_contents($path, $encoded) === false) {
        throw new RuntimeException('No se pudo escribir catalog.json actualizado.');
    }
}

function live_edit_backup_catalog_json(string $jsonPath): string
{
    $backupDir = dirname($jsonPath) . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir) && !mkdir($backupDir, 0775, true) && !is_dir($backupDir)) {
        throw new RuntimeException('No se pudo crear carpeta de backups.');
    }
    $backupPath = $backupDir . DIRECTORY_SEPARATOR . 'visual_backup_' . date('Ymd_His') . '.json';
    if (!copy($jsonPath, $backupPath)) throw new RuntimeException('No se pudo crear backup del catalogo.');
    return str_replace('\\', '/', str_replace(dirname(__DIR__) . DIRECTORY_SEPARATOR, '', $backupPath));
}

function live_edit_update_catalog_row(array $catalog, array $json): void
{
    $sets = [];
    $params = ['id' => (int) $catalog['id']];
    $map = [
        'title' => (string) ($json['title'] ?? ''),
        'hero_title' => (string) ($json['heroTitle'] ?? ''),
        'hero_subtitle' => (string) ($json['heroSubtitle'] ?? ''),
        'promo_title' => (string) ($json['promotion']['title'] ?? ''),
        'promo_text' => (string) ($json['promotion']['text'] ?? ''),
        'promo_image_url' => (string) ($json['promotion']['imageUrl'] ?? ''),
        'promo_link_url' => (string) ($json['promotion']['linkUrl'] ?? ''),
        'promo_link_label' => (string) ($json['promotion']['linkLabel'] ?? ''),
        'api_payload' => json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ];
    foreach ($map as $column => $value) {
        if (!admin_column_exists('catalogs', $column)) continue;
        $sets[] = "`{$column}` = :{$column}";
        $params[$column] = $value;
    }
    if (admin_column_exists('catalogs', 'updated_at')) {
        $sets[] = 'updated_at = NOW()';
    }
    if ($sets) {
        db()->prepare('UPDATE catalogs SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
    }
}

function live_edit_store_uploaded_asset(string $field, string $catalogDir, string $relativeDir, string $baseName): string
{
    if (empty($_FILES[$field]) || !is_array($_FILES[$field]) || (int) ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return '';
    }
    $file = $_FILES[$field];
    if ((int) ($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo recibir el archivo ' . $field . '.');
    }
    return live_edit_store_tmp_image((string) $file['tmp_name'], (string) ($file['name'] ?? $baseName), $catalogDir, $relativeDir, $baseName);
}

function live_edit_store_multiple_promo_assets(string $catalogDir): array
{
    if (empty($_FILES['promo_files']) || !is_array($_FILES['promo_files']['name'] ?? null)) {
        return [];
    }
    $stored = [];
    $count = count($_FILES['promo_files']['name']);
    for ($i = 0; $i < $count; $i++) {
        $error = (int) ($_FILES['promo_files']['error'][$i] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) continue;
        if ($error !== UPLOAD_ERR_OK) {
            throw new RuntimeException('No se pudo recibir una imagen del slider.');
        }
        $stored[] = live_edit_store_tmp_image(
            (string) $_FILES['promo_files']['tmp_name'][$i],
            (string) ($_FILES['promo_files']['name'][$i] ?? 'promo.jpg'),
            $catalogDir,
            'media/promo',
            'promo-' . date('YmdHis') . '-' . ($i + 1)
        );
    }
    return $stored;
}

function live_edit_store_tmp_image(string $tmpPath, string $originalName, string $catalogDir, string $relativeDir, string $baseName): string
{
    if (!is_uploaded_file($tmpPath)) {
        throw new RuntimeException('Archivo subido invalido.');
    }
    $size = filesize($tmpPath);
    if ($size === false || $size <= 0 || $size > CATALOG_LIVE_EDIT_MAX_BYTES) {
        throw new RuntimeException('Cada imagen debe pesar menos de 8 MB.');
    }
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) {
        throw new RuntimeException('Solo se permiten imagenes JPG, PNG o WEBP.');
    }
    $targetDir = $catalogDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeDir);
    if (!is_dir($targetDir) && !mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
        throw new RuntimeException('No se pudo crear carpeta de medios.');
    }
    $safeName = preg_replace('/[^A-Za-z0-9_-]+/', '-', $baseName) ?: 'image';
    $relativePath = trim($relativeDir, '/') . '/' . $safeName . '.' . $extension;
    $targetPath = $catalogDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    if (!move_uploaded_file($tmpPath, $targetPath)) {
        throw new RuntimeException('No se pudo guardar la imagen subida.');
    }
    return $relativePath;
}

function live_edit_promo_images(array $promotion): array
{
    $items = [];
    foreach (['images', 'imageUrls', 'promoImages'] as $key) {
        if (is_array($promotion[$key] ?? null)) {
            foreach ($promotion[$key] as $image) $items[] = (string) $image;
        }
    }
    foreach (['imageUrl', 'image_url'] as $key) {
        if (!empty($promotion[$key])) $items[] = (string) $promotion[$key];
    }
    return live_edit_dedupe_strings(array_filter(array_map('live_edit_safe_relative_url', $items)));
}

function live_edit_safe_relative_url(string $value): string
{
    $value = trim(str_replace('\\', '/', $value));
    if ($value === '' || str_contains($value, '..')) return '';
    if (preg_match('#^https?://#i', $value)) return $value;
    return './' . ltrim($value, './');
}

function live_edit_public_asset_url(array $catalog, string $relative): string
{
    if (preg_match('#^https?://#i', $relative)) return $relative;
    $base = rtrim((string) ($catalog['public_url'] ?? ''), '/');
    return $base !== '' ? $base . '/' . ltrim($relative, './') : '../catalogos/' . rawurlencode((string) ($catalog['slug'] ?? '')) . '/' . ltrim($relative, './');
}

function live_edit_dedupe_strings(array $values): array
{
    $seen = [];
    $result = [];
    foreach ($values as $value) {
        $value = trim((string) $value);
        if ($value === '' || isset($seen[$value])) continue;
        $seen[$value] = true;
        $result[] = $value;
    }
    return $result;
}

function live_edit_color(string $value, string $fallback): string
{
    $value = trim($value);
    return preg_match('/^#[0-9a-f]{6}$/i', $value) ? $value : $fallback;
}

function live_edit_slide_interval(int $value): int
{
    return in_array($value, [3000, 5000, 8000, 15000], true) ? $value : 15000;
}

function live_edit_clean_text(string $value): string
{
    return trim(strip_tags($value));
}
