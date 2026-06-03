<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_once dirname(__DIR__) . '/catalogos_api/backblaze_helpers.php';
admin_require_login(['admin', 'sales']);

const CATALOG_PRODUCTS_UPDATE_MAX_CSV_BYTES = 5242880;
const CATALOG_PRODUCTS_UPDATE_MAX_IMAGE_BYTES = 8388608;
const CATALOG_PRODUCTS_THUMB_MAX_WIDTH = 720;

$catalogId = (int) ($_GET['catalog_id'] ?? $_POST['catalog_id'] ?? 0);
$catalog = $catalogId > 0 ? products_update_fetch_catalog($catalogId) : null;
$brandOptions = $catalog ? products_update_catalog_brand_options($catalog) : [];
$preview = null;
$applyResult = null;
$errorMessage = '';
$infoMessage = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    try {
        if (!$catalog) {
            throw new RuntimeException('Catalogo no encontrado.');
        }
        if (resolve_catalog_status($catalog) !== 'active') {
            throw new RuntimeException('Solo se pueden actualizar catalogos activos.');
        }
        $action = (string) ($_POST['action'] ?? 'preview');
        if ($action === 'preview') {
            $preview = products_update_build_preview_from_upload($catalog);
        } elseif ($action === 'attach_images') {
            $preview = products_update_attach_images_to_preview($catalog);
            $infoMessage = 'Imagenes agregadas a la vista previa. Revisa de nuevo antes de confirmar.';
        } elseif ($action === 'apply') {
            $applyResult = products_update_apply_confirmed($catalog);
            flash_set('success', 'Actualizacion aplicada al catalogo vivo. Actualizados: ' . (int) $applyResult['updated_count'] . ' · Nuevos: ' . (int) $applyResult['new_count'] . ' · Imagenes: ' . (int) $applyResult['image_count'] . ' · Backup: ' . (string) ($applyResult['backup_path'] ?? ''));
            header('Location: catalog_update_products.php?catalog_id=' . (int) $catalog['id']);
            exit;
        }
    } catch (Throwable $exception) {
        $errorMessage = $exception->getMessage();
    }
}

admin_header('Actualizar productos e imagenes', 'catalogos.php');
?>
<section class="card">
    <div class="toolbar">
        <strong>Actualizar productos e imagenes</strong>
        <a class="button" href="catalogos.php">Volver</a>
    </div>

    <?php if (!$catalog): ?>
        <p class="muted">Catalogo no encontrado.</p>
    <?php else: ?>
        <p class="muted">Catalogo: <strong><?= html_escape($catalog['title'] ?? '') ?></strong> &middot; <code><?= html_escape($catalog['slug'] ?? '') ?></code></p>
        <p class="muted">Esta pantalla actualiza productos por ITEM y puede cargar imagenes nuevas por nombre de archivo. Crea backup antes de aplicar.</p>

        <?php if ($errorMessage !== ''): ?>
            <div class="notice notice--warning" style="margin:16px 0;"><?= html_escape($errorMessage) ?></div>
        <?php endif; ?>
        <?php if ($infoMessage !== ''): ?>
            <div class="notice notice--success" style="margin:16px 0;"><?= html_escape($infoMessage) ?></div>
        <?php endif; ?>

        <?php if ($applyResult): ?>
            <div class="notice notice--success" style="margin:16px 0;">
                Actualizacion aplicada al catalogo vivo. Actualizados: <?= (int) $applyResult['updated_count'] ?>
                &middot; Nuevos: <?= (int) $applyResult['new_count'] ?>
                &middot; Imagenes: <?= (int) $applyResult['image_count'] ?>
                &middot; Agotados: <?= (int) $applyResult['out_of_stock_count'] ?>
            </div>
            <p class="muted">Backup creado: <code><?= html_escape($applyResult['backup_path'] ?? '') ?></code></p>
        <?php endif; ?>

        <?php if ($preview): ?>
            <div class="metrics-grid" style="margin:18px 0;">
                <div class="metric-card"><span>Filas leidas</span><strong><?= (int) $preview['total_rows'] ?></strong></div>
                <div class="metric-card"><span>Actualizaria</span><strong><?= (int) $preview['updated_count'] ?></strong></div>
                <div class="metric-card"><span>Nuevos</span><strong><?= (int) $preview['new_count'] ?></strong></div>
                <div class="metric-card"><span>Imagenes detectadas</span><strong><?= (int) $preview['image_match_count'] ?></strong></div>
                <div class="metric-card"><span>Imagenes existentes</span><strong><?= (int) ($preview['inherited_image_count'] ?? 0) ?></strong></div>
                <div class="metric-card"><span>Sin imagen</span><strong><?= (int) $preview['missing_image_count'] ?></strong></div>
                <div class="metric-card"><span>Modo precio</span><strong><?= html_escape(products_update_price_mode_label($preview['price_mode'])) ?></strong></div>
                <div class="metric-card"><span>Marca</span><strong><?= html_escape(products_update_brand_filter_label($preview['brand_filter'] ?? '')) ?></strong></div>
                <div class="metric-card"><span>Ignorados por marca</span><strong><?= (int) ($preview['brand_ignored_count'] ?? 0) ?></strong></div>
                <div class="metric-card"><span>Entrada</span><strong><?= html_escape(products_update_entry_filter_label($preview['entry_filter'] ?? '')) ?></strong></div>
                <div class="metric-card"><span>Ignorados por entrada</span><strong><?= (int) ($preview['entry_ignored_count'] ?? 0) ?></strong></div>
            </div>

            <?php if (!empty($preview['errors'])): ?>
                <div class="notice notice--warning" style="margin-bottom:16px;"><?= html_escape(implode(' ', array_slice($preview['errors'], 0, 6))) ?></div>
            <?php endif; ?>

            <?php if (((int) $preview['missing_image_count']) > 0): ?>
                <div class="notice notice--warning" style="margin-bottom:16px;">
                    Faltan imagenes para algunos productos. Agrega esas imagenes a esta vista previa antes de confirmar.
                </div>
            <?php endif; ?>

            <?php if (((int) $preview['updated_count'] + (int) $preview['new_count']) > 0 && ((int) $preview['missing_image_count']) === 0): ?>
                <div class="notice notice--warning" style="margin-bottom:16px;">
                    Esta es solo la vista previa. Para aplicar cambios al catalogo vivo debes confirmar la actualizacion.
                </div>
                <form class="js-products-apply-form" method="post" action="catalog_update_products.php?catalog_id=<?= (int) $catalog['id'] ?>" style="margin-bottom:18px;">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="apply">
                    <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
                    <input type="hidden" name="preview_token" value="<?= html_escape($preview['preview_token']) ?>">
                    <button class="button--primary" type="submit" data-default-label="Confirmar actualizacion">Confirmar actualizacion</button>
                </form>
            <?php endif; ?>

            <div class="table-wrap" style="margin-bottom:18px;">
                <table>
                    <thead><tr><th>ITEM</th><th>Estado</th><th>Marca</th><th>Entrada</th><th>Imagen</th><th>Descripcion</th><th>Precio catalogo</th><th>Disp.</th></tr></thead>
                    <tbody>
                    <?php foreach (array_slice($preview['sample'], 0, 40) as $row): ?>
                        <tr>
                            <td><?= html_escape($row['item'] ?? '') ?></td>
                            <td><?= html_escape($row['status'] ?? '') ?></td>
                            <td><?= html_escape($row['brand'] ?? '') ?></td>
                            <td><?= html_escape($row['entry'] ?? '') ?></td>
                            <td><?= html_escape($row['image_status'] ?? '') ?></td>
                            <td><?= html_escape($row['description'] ?? '') ?></td>
                            <td><?= html_escape($row['price'] ?? '') ?></td>
                            <td><?= html_escape($row['available'] ?? '') ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <?php if (((int) $preview['updated_count'] + (int) $preview['new_count']) > 0 && ((int) $preview['missing_image_count']) === 0): ?>
                <form class="js-products-apply-form" method="post" action="catalog_update_products.php?catalog_id=<?= (int) $catalog['id'] ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="apply">
                    <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
                    <input type="hidden" name="preview_token" value="<?= html_escape($preview['preview_token']) ?>">
                    <button class="button--primary" type="submit" data-default-label="Confirmar actualizacion">Confirmar actualizacion</button>
                </form>
            <?php endif; ?>

            <?php if (!empty($preview['missing_images'])): ?>
                <section class="card" style="margin:18px 0;">
                    <div class="toolbar">
                        <strong>Imagenes faltantes antes de confirmar</strong>
                        <span class="pill"><?= count($preview['missing_images']) ?> productos</span>
                    </div>
                    <p class="muted">Sube las imagenes con el ITEM como nombre de archivo. Ejemplo: <code>100-8984.jpg</code>.</p>
                    <div class="table-wrap" style="margin:12px 0 18px;">
                        <table>
                            <thead><tr><th>ITEM</th><th>Entrada</th><th>Marca</th><th>Descripcion</th></tr></thead>
                            <tbody>
                            <?php foreach (array_slice($preview['missing_images'], 0, 80) as $missing): ?>
                                <tr>
                                    <td><?= html_escape($missing['item'] ?? '') ?></td>
                                    <td><?= html_escape($missing['entry'] ?? '') ?></td>
                                    <td><?= html_escape($missing['brand'] ?? '') ?></td>
                                    <td><?= html_escape($missing['description'] ?? '') ?></td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                    <form class="form-grid" method="post" enctype="multipart/form-data">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="attach_images">
                        <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
                        <input type="hidden" name="preview_token" value="<?= html_escape($preview['preview_token']) ?>">
                        <label class="wide">
                            <span>Subir imagenes faltantes</span>
                            <input type="file" name="product_images[]" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple required>
                        </label>
                        <div class="wide"><button class="button--primary" type="submit">Agregar imagenes a esta vista previa</button></div>
                    </form>
                </section>
            <?php endif; ?>
        <?php endif; ?>

        <form class="form-grid" method="post" enctype="multipart/form-data" style="margin-top:18px;">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="preview">
            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
            <label class="wide">
                <span>Archivo CSV</span>
                <input type="file" name="catalog_data_file" accept=".csv,text/csv" required>
            </label>
            <label>
                <span>Modo de precio</span>
                <select name="price_mode">
                    <option value="catalog">Usar modo actual del catalogo</option>
                    <option value="original">Precio original del CSV</option>
                    <option value="factor55">55% del precio del CSV</option>
                </select>
            </label>
            <label>
                <span>Marca a actualizar</span>
                <select name="brand_filter">
                    <option value="">Todas las marcas</option>
                    <?php foreach ($brandOptions as $brand): ?>
                        <option value="<?= html_escape($brand) ?>"><?= html_escape($brand) ?></option>
                    <?php endforeach; ?>
                    <option value="__custom">Otra marca escrita abajo</option>
                </select>
            </label>
            <label>
                <span>Otra marca</span>
                <input type="text" name="brand_filter_custom" placeholder="Ejemplo: LUXURY HOME LINENS">
            </label>
            <label>
                <span>Entrada a actualizar</span>
                <input type="text" name="entry_filter" placeholder="Ejemplo: 26/017">
            </label>
            <label class="wide">
                <span>Imagenes nuevas por ITEM</span>
                <input type="file" name="product_images[]" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple>
                <small>Nombra las imagenes con el ITEM, por ejemplo <code>100-8952.jpg</code>. Si Backblaze esta configurado, se suben directo al CDN.</small>
            </label>
            <label class="wide check-row">
                <input type="checkbox" name="mark_missing_out_of_stock" value="1">
                <span>Marcar como agotados los productos del catalogo que no vienen en el CSV.</span>
            </label>
            <div class="wide"><button class="button--primary" type="submit">Vista previa</button></div>
        </form>
    <?php endif; ?>
</section>
<script>
(() => {
    document.querySelectorAll(".js-products-apply-form").forEach((form) => {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!window.confirm("Confirmas aplicar esta actualizacion al catalogo vivo?")) {
                return;
            }
            const button = form.querySelector("button[type='submit']");
            if (button) {
                button.disabled = true;
                button.textContent = "Aplicando...";
            }
            setTimeout(() => {
                HTMLFormElement.prototype.submit.call(form);
            }, 50);
        });
    });
})();
</script>
<?php admin_footer(); ?>

<?php
function products_update_fetch_catalog(int $catalogId): ?array
{
    if (!admin_table_exists('catalogs')) return null;
    $stmt = db()->prepare('SELECT * FROM catalogs WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $catalogId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function products_update_catalog_brand_options(array $catalog): array
{
    try {
        $json = products_update_read_catalog_json(products_update_catalog_json_full_path($catalog));
    } catch (Throwable) {
        return [];
    }
    $brands = [];
    foreach (products_update_products($json) as $product) {
        $brand = products_update_clean_text((string) ($product['brand'] ?? $product['marca'] ?? ''));
        if ($brand === '') continue;
        $key = products_update_brand_key($brand);
        if ($key !== '') $brands[$key] = $brand;
    }
    uasort($brands, static fn(string $a, string $b): int => strcasecmp($a, $b));
    return array_values($brands);
}

function products_update_build_preview_from_upload(array $catalog): array
{
    if (empty($_FILES['catalog_data_file']) || !is_array($_FILES['catalog_data_file'])) {
        throw new RuntimeException('Debes subir un CSV.');
    }
    $file = $_FILES['catalog_data_file'];
    if ((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo recibir el CSV.');
    }
    if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > CATALOG_PRODUCTS_UPDATE_MAX_CSV_BYTES) {
        throw new RuntimeException('El CSV debe pesar menos de 5 MB.');
    }
    if (strtolower(pathinfo((string) ($file['name'] ?? 'datos.csv'), PATHINFO_EXTENSION)) !== 'csv') {
        throw new RuntimeException('En esta fase solo se permite CSV.');
    }

    $json = products_update_read_catalog_json(products_update_catalog_json_full_path($catalog));
    $products = products_update_products($json);
    $index = products_update_index($products);
    $rows = products_update_parse_csv((string) $file['tmp_name']);
    $priceMode = products_update_resolve_price_mode((string) ($_POST['price_mode'] ?? 'catalog'), $json);
    $brandFilter = products_update_resolve_brand_filter($_POST);
    $brandFilterKey = products_update_brand_key($brandFilter);
    $entryFilter = products_update_resolve_entry_filter($_POST);
    $entryFilterKey = products_update_entry_key($entryFilter);
    $sharedImages = products_update_shared_image_index((int) $catalog['id']);
    $token = bin2hex(random_bytes(16));
    $imageMap = products_update_save_preview_images($token);
    $markMissing = isset($_POST['mark_missing_out_of_stock']);

    $errors = products_update_validate_required_columns($rows);
    $matched = $new = $imageMatches = $inheritedImages = $missingImages = $outOfStock = 0;
    $brandIgnored = 0;
    $entryIgnored = 0;
    $matchedItems = [];
    $filteredRows = [];
    $usedSharedImages = [];
    $missingImageRows = [];
    $sample = [];

    foreach ($rows as $row) {
        $itemKey = products_update_item_key((string) ($row['ITEM'] ?? ''));
        if ($itemKey === '') continue;
        $exists = array_key_exists($itemKey, $index);
        $existingProduct = $exists ? $products[$index[$itemKey]] : null;
        if ($brandFilterKey !== '' && !products_update_row_matches_brand_filter($row, $existingProduct, $brandFilterKey)) {
            $brandIgnored++;
            continue;
        }
        if ($entryFilterKey !== '' && !products_update_row_matches_entry_filter($row, $existingProduct, $entryFilterKey)) {
            $entryIgnored++;
            continue;
        }
        $filteredRows[] = $row;
        $matchedItems[$itemKey] = true;
        $exists ? $matched++ : $new++;
        $available = products_update_available_number((string) ($row['DISPONIBLE'] ?? ''));
        if ($available < 1) $outOfStock++;
        $existingImage = $exists && products_update_product_has_image($products[$index[$itemKey]]);
        $remoteImage = products_update_remote_image_url($row) !== '';
        $uploadedImage = isset($imageMap[$itemKey]);
        $sharedImage = !$uploadedImage && !$remoteImage && !$existingImage && isset($sharedImages[$itemKey]);
        $hasImage = $uploadedImage || $remoteImage || $existingImage || $sharedImage;
        if ($sharedImage) {
            $inheritedImages++;
            $usedSharedImages[$itemKey] = $sharedImages[$itemKey];
        }
        $hasImage ? $imageMatches++ : $missingImages++;
        if (!$hasImage) {
            $missingImageRows[] = products_update_missing_image_row($row, $existingProduct);
        }
        $sample[] = [
            'item' => (string) ($row['ITEM'] ?? ''),
            'status' => $exists ? 'actualizaria' : 'nuevo',
            'brand' => (string) ($row['MARCA'] ?? ($existingProduct['brand'] ?? '')),
            'entry' => (string) ($row['ENTRADA'] ?? ($existingProduct['entry'] ?? '')),
            'image_status' => $uploadedImage ? 'imagen subida' : ($remoteImage ? 'url csv' : ($existingImage ? 'conserva actual' : ($sharedImage ? 'imagen existente' : 'sin imagen'))),
            'description' => (string) ($row['DESCRIPCION'] ?? ''),
            'price' => products_update_format_price_for_mode((string) ($row['PRECIO'] ?? ''), $priceMode)['price'],
            'available' => (string) ($row['DISPONIBLE'] ?? ''),
        ];
    }
    if ($markMissing) {
        foreach ($index as $item => $_idx) {
            if ($brandFilterKey !== '' && !products_update_product_matches_brand_filter($products[$_idx], $brandFilterKey)) continue;
            if ($entryFilterKey !== '' && !products_update_product_matches_entry_filter($products[$_idx], $entryFilterKey)) continue;
            if (!isset($matchedItems[$item])) $outOfStock++;
        }
    }

    $preview = [
        'preview_token' => $token,
        'catalog_id' => (int) $catalog['id'],
        'filename' => basename((string) ($file['name'] ?? 'datos.csv')),
        'rows' => $filteredRows,
        'images' => $imageMap,
        'shared_images' => $usedSharedImages,
        'price_mode' => $priceMode,
        'brand_filter' => $brandFilter,
        'entry_filter' => $entryFilter,
        'brand_ignored_count' => $brandIgnored,
        'entry_ignored_count' => $entryIgnored,
        'mark_missing_out_of_stock' => $markMissing,
        'total_rows' => count($rows),
        'updated_count' => $matched,
        'new_count' => $new,
        'image_match_count' => $imageMatches,
        'inherited_image_count' => $inheritedImages,
        'missing_image_count' => $missingImages,
        'missing_images' => $missingImageRows,
        'out_of_stock_count' => $outOfStock,
        'errors' => $errors,
        'sample' => $sample,
    ];
    products_update_write_preview($token, $preview);
    return $preview;
}

function products_update_attach_images_to_preview(array $catalog): array
{
    $token = preg_replace('/[^a-f0-9]/', '', strtolower((string) ($_POST['preview_token'] ?? '')));
    $preview = products_update_read_preview($token);
    if (!$preview || (int) ($preview['catalog_id'] ?? 0) !== (int) $catalog['id']) {
        throw new RuntimeException('La vista previa vencio o no pertenece a este catalogo.');
    }
    $newImages = products_update_save_preview_images($token);
    if (!$newImages) {
        throw new RuntimeException('No se recibieron imagenes nuevas para agregar a esta vista previa.');
    }
    $preview['images'] = array_replace(is_array($preview['images'] ?? null) ? $preview['images'] : [], $newImages);
    $preview = products_update_rebuild_preview_image_state($catalog, $preview);
    products_update_write_preview($token, $preview);
    return $preview;
}

function products_update_rebuild_preview_image_state(array $catalog, array $preview): array
{
    $json = products_update_read_catalog_json(products_update_catalog_json_full_path($catalog));
    $products = products_update_products($json);
    $index = products_update_index($products);
    $rows = (array) ($preview['rows'] ?? []);
    $imageMap = is_array($preview['images'] ?? null) ? $preview['images'] : [];
    $sharedImages = products_update_shared_image_index((int) $catalog['id']);
    $brandFilterKey = products_update_brand_key((string) ($preview['brand_filter'] ?? ''));
    $entryFilterKey = products_update_entry_key((string) ($preview['entry_filter'] ?? ''));
    $priceMode = (string) ($preview['price_mode'] ?? 'original');
    $matchedItems = [];
    $usedSharedImages = [];
    $missingImageRows = [];
    $sample = [];
    $matched = $new = $imageMatches = $inheritedImages = $missingImages = $outOfStock = 0;

    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $itemKey = products_update_item_key((string) ($row['ITEM'] ?? ''));
        if ($itemKey === '') continue;
        $exists = array_key_exists($itemKey, $index);
        $existingProduct = $exists ? $products[$index[$itemKey]] : null;
        if ($brandFilterKey !== '' && !products_update_row_matches_brand_filter($row, $existingProduct, $brandFilterKey)) {
            continue;
        }
        if ($entryFilterKey !== '' && !products_update_row_matches_entry_filter($row, $existingProduct, $entryFilterKey)) {
            continue;
        }
        $matchedItems[$itemKey] = true;
        $exists ? $matched++ : $new++;
        $available = products_update_available_number((string) ($row['DISPONIBLE'] ?? ''));
        if ($available < 1) $outOfStock++;
        $existingImage = $exists && products_update_product_has_image($products[$index[$itemKey]]);
        $remoteImage = products_update_remote_image_url($row) !== '';
        $uploadedImage = isset($imageMap[$itemKey]);
        $sharedImage = !$uploadedImage && !$remoteImage && !$existingImage && isset($sharedImages[$itemKey]);
        $hasImage = $uploadedImage || $remoteImage || $existingImage || $sharedImage;
        if ($sharedImage) {
            $inheritedImages++;
            $usedSharedImages[$itemKey] = $sharedImages[$itemKey];
        }
        $hasImage ? $imageMatches++ : $missingImages++;
        if (!$hasImage) {
            $missingImageRows[] = products_update_missing_image_row($row, $existingProduct);
        }
        $sample[] = [
            'item' => (string) ($row['ITEM'] ?? ''),
            'status' => $exists ? 'actualizaria' : 'nuevo',
            'brand' => (string) ($row['MARCA'] ?? ($existingProduct['brand'] ?? '')),
            'entry' => (string) ($row['ENTRADA'] ?? ($existingProduct['entry'] ?? '')),
            'image_status' => $uploadedImage ? 'imagen subida' : ($remoteImage ? 'url csv' : ($existingImage ? 'conserva actual' : ($sharedImage ? 'imagen existente' : 'sin imagen'))),
            'description' => (string) ($row['DESCRIPCION'] ?? ''),
            'price' => products_update_format_price_for_mode((string) ($row['PRECIO'] ?? ''), $priceMode)['price'],
            'available' => (string) ($row['DISPONIBLE'] ?? ''),
        ];
    }
    if (!empty($preview['mark_missing_out_of_stock'])) {
        foreach ($index as $item => $_idx) {
            if ($brandFilterKey !== '' && !products_update_product_matches_brand_filter($products[$_idx], $brandFilterKey)) continue;
            if ($entryFilterKey !== '' && !products_update_product_matches_entry_filter($products[$_idx], $entryFilterKey)) continue;
            if (!isset($matchedItems[$item])) $outOfStock++;
        }
    }

    $preview['updated_count'] = $matched;
    $preview['new_count'] = $new;
    $preview['image_match_count'] = $imageMatches;
    $preview['inherited_image_count'] = $inheritedImages;
    $preview['missing_image_count'] = $missingImages;
    $preview['missing_images'] = $missingImageRows;
    $preview['out_of_stock_count'] = $outOfStock;
    $preview['shared_images'] = $usedSharedImages;
    $preview['sample'] = $sample;
    return $preview;
}

function products_update_apply_confirmed(array $catalog): array
{
    $token = preg_replace('/[^a-f0-9]/', '', strtolower((string) ($_POST['preview_token'] ?? '')));
    $preview = products_update_read_preview($token);
    if (!$preview || (int) ($preview['catalog_id'] ?? 0) !== (int) $catalog['id']) {
        throw new RuntimeException('La vista previa vencio o no pertenece a este catalogo.');
    }
    if (!empty($preview['errors'])) {
        throw new RuntimeException('Corrige los errores de columnas antes de aplicar.');
    }

    $jsonPath = products_update_catalog_json_full_path($catalog);
    $catalogDir = dirname($jsonPath);
    $json = products_update_read_catalog_json($jsonPath);
    $backup = products_update_backup_catalog_json($jsonPath, (string) ($catalog['slug'] ?? 'catalogo'));
    $products =& products_update_products_ref($json);
    $index = products_update_index($products);
    $matchedItems = [];
    $newProducts = [];
    $updated = $new = $imageCount = $outOfStock = 0;
    $priceMode = (string) ($preview['price_mode'] ?? 'original');
    $brandFilter = (string) ($preview['brand_filter'] ?? '');
    $brandFilterKey = products_update_brand_key($brandFilter);
    $entryFilter = (string) ($preview['entry_filter'] ?? '');
    $entryFilterKey = products_update_entry_key($entryFilter);
    $imageMap = is_array($preview['images'] ?? null) ? $preview['images'] : [];
    $sharedImages = is_array($preview['shared_images'] ?? null) ? $preview['shared_images'] : [];

    foreach ((array) ($preview['rows'] ?? []) as $row) {
        $itemKey = products_update_item_key((string) ($row['ITEM'] ?? ''));
        if ($itemKey === '') continue;
        $matchedItems[$itemKey] = true;
        $available = products_update_available_number((string) ($row['DISPONIBLE'] ?? ''));
        if ($available < 1) $outOfStock++;

        if (array_key_exists($itemKey, $index)) {
            $idx = $index[$itemKey];
            products_update_apply_row_to_product($products[$idx], $row, $priceMode);
            if (products_update_apply_image_to_product($catalog, $catalogDir, $products[$idx], $row, $imageMap[$itemKey] ?? null, $sharedImages[$itemKey] ?? null)) {
                $imageCount++;
            }
            $updated++;
            continue;
        }

        $product = products_update_build_new_product($row, $priceMode);
        if ($product) {
            if (products_update_apply_image_to_product($catalog, $catalogDir, $product, $row, $imageMap[$itemKey] ?? null, $sharedImages[$itemKey] ?? null)) {
                $imageCount++;
            }
            $newProducts[] = $product;
            $new++;
        }
    }

    if (!empty($preview['mark_missing_out_of_stock'])) {
        foreach ($index as $item => $idx) {
            if ($brandFilterKey !== '' && !products_update_product_matches_brand_filter($products[$idx], $brandFilterKey)) continue;
            if ($entryFilterKey !== '' && !products_update_product_matches_entry_filter($products[$idx], $entryFilterKey)) continue;
            if (isset($matchedItems[$item])) continue;
            $products[$idx]['available'] = '0';
            $products[$idx]['outOfStock'] = 1;
            $products[$idx]['agotado'] = 1;
            $outOfStock++;
        }
    }
    if ($newProducts) {
        array_unshift($products, ...$newProducts);
    }
    $json['priceMode'] = $priceMode;
    $json['priceModeLabel'] = products_update_price_mode_label($priceMode);

    products_update_write_catalog_json($jsonPath, $json);
    products_update_update_catalog_row($catalog, $json);
    products_update_log_result($catalog, $preview, $updated, $outOfStock);
    products_update_delete_preview($token);
    products_update_delete_preview_dir($token);
    audit_log('catalog.products_images_updated', 'catalogs', (int) $catalog['id'], ['updated' => $updated, 'new' => $new, 'images' => $imageCount, 'brand' => $brandFilter, 'backup' => $backup]);
    return ['updated_count' => $updated, 'new_count' => $new, 'image_count' => $imageCount, 'out_of_stock_count' => $outOfStock, 'backup_path' => $backup];
}

function products_update_apply_row_to_product(array &$product, array $row, string $priceMode): void
{
    $price = products_update_format_price_for_mode((string) ($row['PRECIO'] ?? $product['originalPrice'] ?? $product['price'] ?? ''), $priceMode);
    $available = products_update_available_number((string) ($row['DISPONIBLE'] ?? $product['available'] ?? '0'));
    $description = products_update_clean_text((string) ($row['DESCRIPCION'] ?? $product['description'] ?? ''));
    $product['description'] = $description;
    $product['shortDescription'] = $description;
    $product['price'] = $price['price'];
    $product['originalPrice'] = $price['originalPrice'];
    $product['priceMode'] = $priceMode;
    $product['available'] = (string) max(0, $available);
    $product['outOfStock'] = $available > 0 ? 0 : 1;
    $product['agotado'] = $available > 0 ? 0 : 1;
    $product['package'] = products_update_clean_text((string) ($row['EMPAQUE'] ?? $product['package'] ?? ''));
    $product['empaque'] = $product['package'];
    $product['packageLabel'] = $product['package'];
    $product['packageQty'] = max(1, products_update_available_number((string) $product['package']));
    $product['um'] = products_update_clean_text((string) ($row['UM'] ?? $product['um'] ?? ''));
    $product['saleUnit'] = $product['um'] ?: ($product['saleUnit'] ?? 'bulto');
    $product['ctn'] = products_update_clean_text((string) ($row['CTN'] ?? $product['ctn'] ?? ''));
    $product['barcode'] = products_update_clean_text((string) ($row['CBARRA'] ?? $product['barcode'] ?? ''));
    if (isset($row['ENTRADA'])) $product['entry'] = products_update_clean_text((string) $row['ENTRADA']);
    if (isset($row['MARCA'])) $product['brand'] = products_update_clean_text((string) $row['MARCA']);
    if (isset($row['CATEGORIA'])) $product['category'] = products_update_clean_text((string) $row['CATEGORIA']) ?: ($product['category'] ?? 'General');
}

function products_update_build_new_product(array $row, string $priceMode): ?array
{
    $item = products_update_clean_text((string) ($row['ITEM'] ?? ''));
    if ($item === '') return null;
    $price = products_update_format_price_for_mode((string) ($row['PRECIO'] ?? ''), $priceMode);
    $available = products_update_available_number((string) ($row['DISPONIBLE'] ?? '0'));
    $description = products_update_clean_text((string) ($row['DESCRIPCION'] ?? $item));
    $package = products_update_clean_text((string) ($row['EMPAQUE'] ?? ''));
    return [
        'item' => $item,
        'entry' => products_update_clean_text((string) ($row['ENTRADA'] ?? '')),
        'description' => $description,
        'shortDescription' => $description,
        'price' => $price['price'],
        'originalPrice' => $price['originalPrice'],
        'priceMode' => $priceMode,
        'available' => (string) max(0, $available),
        'outOfStock' => $available > 0 ? 0 : 1,
        'agotado' => $available > 0 ? 0 : 1,
        'package' => $package,
        'empaque' => $package,
        'packageLabel' => $package,
        'packageQty' => max(1, products_update_available_number($package)),
        'um' => products_update_clean_text((string) ($row['UM'] ?? '')),
        'saleUnit' => products_update_clean_text((string) ($row['UM'] ?? '')) ?: 'bulto',
        'ctn' => products_update_clean_text((string) ($row['CTN'] ?? '')),
        'barcode' => products_update_clean_text((string) ($row['CBARRA'] ?? '')),
        'brand' => products_update_clean_text((string) ($row['MARCA'] ?? '')),
        'category' => products_update_clean_text((string) ($row['CATEGORIA'] ?? 'General')) ?: 'General',
        'material' => products_update_clean_text((string) ($row['MATERIAL'] ?? '')),
        'size' => products_update_clean_text((string) ($row['TAMANO'] ?? $row['MEDIDA'] ?? '')),
        'minimumOrder' => max(1, products_update_available_number((string) ($row['MINIMO'] ?? '1'))),
        'multipleQty' => max(1, products_update_available_number((string) ($row['MULTIPLO'] ?? '1'))),
        'media' => ['gallery' => []],
    ];
}

function products_update_apply_image_to_product(array $catalog, string $catalogDir, array &$product, array $row, mixed $imageInfo, mixed $sharedImageInfo = null): bool
{
    $imageUrl = products_update_remote_image_url($row);
    $thumbnailUrl = '';
    if (is_array($imageInfo) && !empty($imageInfo['path']) && is_file((string) $imageInfo['path'])) {
        $stored = products_update_store_image($catalog, $catalogDir, products_update_item_key((string) ($product['item'] ?? 'item')), (string) $imageInfo['path'], (string) ($imageInfo['extension'] ?? 'jpg'));
        $imageUrl = $stored['image_url'];
        $thumbnailUrl = $stored['thumbnail_url'];
    }
    if ($imageUrl === '' && is_array($sharedImageInfo)) {
        $imageUrl = trim((string) ($sharedImageInfo['image_url'] ?? ''));
        $thumbnailUrl = trim((string) ($sharedImageInfo['thumbnail_url'] ?? ''));
    }
    if ($imageUrl === '') return false;
    products_update_set_product_image($product, $imageUrl, $thumbnailUrl);
    return true;
}

function products_update_store_image(array $catalog, string $catalogDir, string $item, string $sourcePath, string $extension): array
{
    $extension = strtolower($extension) === 'jpeg' ? 'jpg' : strtolower($extension);
    if (backblaze_upload_enabled()) {
        if (!backblaze_upload_configured()) throw new RuntimeException('Backblaze esta habilitado, pero faltan datos en catalogos_api/config.php.');
        $slug = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string) ($catalog['slug'] ?? 'catalogo')) ?: 'catalogo';
        $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
        $stamp = date('YmdHis');
        $contentType = products_update_content_type($extension);
        $imageUrl = backblaze_upload_file($sourcePath, 'catalogos/' . $slug . '/updates/' . $safeItem . '-' . $stamp . '.' . $extension, $contentType);
        $thumbUrl = '';
        $thumb = products_update_create_thumbnail($sourcePath, $extension);
        if ($thumb) {
            try {
                $thumbUrl = backblaze_upload_file($thumb['path'], 'catalogos/' . $slug . '/updates/thumbs/' . $safeItem . '-' . $stamp . '.' . $thumb['extension'], $thumb['content_type']);
            } finally {
                @unlink($thumb['path']);
            }
        }
        return ['image_url' => $imageUrl, 'thumbnail_url' => $thumbUrl];
    }
    $mediaDir = $catalogDir . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'main';
    if (!is_dir($mediaDir) && !mkdir($mediaDir, 0775, true) && !is_dir($mediaDir)) throw new RuntimeException('No se pudo crear carpeta media/main.');
    $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
    $fileName = $safeItem . '-update-' . date('YmdHis') . '.' . $extension;
    $target = $mediaDir . DIRECTORY_SEPARATOR . $fileName;
    $thumbUrl = products_update_save_local_thumbnail($sourcePath, $extension, $mediaDir, $safeItem);
    if (!copy($sourcePath, $target)) throw new RuntimeException('No se pudo guardar imagen local.');
    return ['image_url' => './media/main/' . $fileName, 'thumbnail_url' => $thumbUrl];
}

function products_update_parse_csv(string $path): array
{
    $handle = fopen($path, 'rb');
    if (!$handle) throw new RuntimeException('No se pudo abrir el CSV.');
    $first = fgets($handle);
    if ($first === false) throw new RuntimeException('El CSV esta vacio.');
    $delimiter = substr_count($first, ';') > substr_count($first, ',') ? ';' : ',';
    rewind($handle);
    $headers = fgetcsv($handle, 0, $delimiter);
    if (!is_array($headers)) throw new RuntimeException('No se pudo leer encabezado CSV.');
    $headers = array_map('products_update_normalize_column', $headers);
    $rows = [];
    while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
        if (!array_filter($data, static fn($value): bool => trim((string) $value) !== '')) continue;
        $row = [];
        foreach ($headers as $index => $header) {
            if ($header === '') continue;
            $row[$header] = trim((string) ($data[$index] ?? ''));
        }
        $rows[] = $row;
    }
    fclose($handle);
    return $rows;
}

function products_update_validate_required_columns(array $rows): array
{
    $required = ['ITEM', 'DESCRIPCION', 'DISPONIBLE', 'PRECIO', 'EMPAQUE', 'UM', 'CTN', 'CBARRA'];
    $available = array_keys($rows[0] ?? []);
    $errors = [];
    foreach ($required as $column) {
        if (!in_array($column, $available, true)) $errors[] = 'Falta columna: ' . $column . '.';
    }
    return $errors;
}

function products_update_save_preview_images(string $token): array
{
    if (empty($_FILES['product_images']) || !is_array($_FILES['product_images']['name'] ?? null)) return [];
    $tokenDir = products_update_preview_dir($token);
    $map = [];
    $count = count($_FILES['product_images']['name']);
    for ($i = 0; $i < $count; $i++) {
        $error = (int) ($_FILES['product_images']['error'][$i] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) continue;
        if ($error !== UPLOAD_ERR_OK) throw new RuntimeException('No se pudo recibir una imagen.');
        $size = (int) ($_FILES['product_images']['size'][$i] ?? 0);
        if ($size <= 0 || $size > CATALOG_PRODUCTS_UPDATE_MAX_IMAGE_BYTES) throw new RuntimeException('Cada imagen debe pesar menos de 8 MB.');
        $name = basename((string) ($_FILES['product_images']['name'][$i] ?? ''));
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if ($extension === 'jpeg') $extension = 'jpg';
        if (!in_array($extension, ['jpg', 'png', 'webp'], true)) throw new RuntimeException('Solo se permiten imagenes JPG, PNG o WEBP.');
        $item = products_update_item_key(pathinfo($name, PATHINFO_FILENAME));
        if ($item === '') continue;
        $target = $tokenDir . DIRECTORY_SEPARATOR . $item . '.' . $extension;
        if (!move_uploaded_file((string) $_FILES['product_images']['tmp_name'][$i], $target)) throw new RuntimeException('No se pudo guardar imagen temporal.');
        $map[$item] = ['path' => $target, 'extension' => $extension, 'name' => $name];
    }
    return $map;
}

function products_update_catalog_json_full_path(array $catalog): string
{
    $relative = trim((string) ($catalog['catalog_json_path'] ?? ''));
    if ($relative === '') throw new RuntimeException('El catalogo no tiene ruta catalog_json_path.');
    $base = realpath(dirname(__DIR__));
    $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relative);
    $resolvedDir = realpath(dirname($path));
    if (!$base || !$resolvedDir || !str_starts_with($resolvedDir, $base) || !is_file($path)) throw new RuntimeException('No se encontro catalog.json dentro del hosting permitido.');
    return $path;
}

function products_update_read_catalog_json(string $path): array
{
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) throw new RuntimeException('catalog.json no es valido.');
    return $decoded;
}

function &products_update_products_ref(array &$json): array
{
    if (isset($json['catalog']) && is_array($json['catalog'])) return $json['catalog'];
    if (isset($json['metadata']['catalog']) && is_array($json['metadata']['catalog'])) return $json['metadata']['catalog'];
    throw new RuntimeException('No se encontro arreglo catalog en catalog.json.');
}

function products_update_products(array $json): array
{
    if (isset($json['catalog']) && is_array($json['catalog'])) return $json['catalog'];
    if (isset($json['metadata']['catalog']) && is_array($json['metadata']['catalog'])) return $json['metadata']['catalog'];
    return [];
}

function products_update_index(array $products): array
{
    $index = [];
    foreach ($products as $idx => $product) {
        $item = products_update_item_key((string) ($product['item'] ?? ''));
        if ($item !== '') $index[$item] = $idx;
    }
    return $index;
}

function products_update_backup_catalog_json(string $jsonPath, string $slug): string
{
    $backupDir = dirname($jsonPath) . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir) && !mkdir($backupDir, 0775, true) && !is_dir($backupDir)) throw new RuntimeException('No se pudo crear carpeta de backups.');
    $backupPath = $backupDir . DIRECTORY_SEPARATOR . preg_replace('/[^A-Za-z0-9_-]+/', '-', $slug) . '-products-' . date('Ymd-His') . '.json';
    if (!copy($jsonPath, $backupPath)) throw new RuntimeException('No se pudo crear backup.');
    return str_replace('\\', '/', str_replace(dirname(__DIR__) . DIRECTORY_SEPARATOR, '', $backupPath));
}

function products_update_write_catalog_json(string $path, array $json): void
{
    $encoded = json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) === false) throw new RuntimeException('No se pudo escribir catalog.json actualizado.');
}

function products_update_update_catalog_row(array $catalog, array $json): void
{
    $sets = [];
    $params = ['id' => (int) $catalog['id']];
    if (admin_column_exists('catalogs', 'api_payload')) {
        $sets[] = 'api_payload = :api_payload';
        $params['api_payload'] = json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    if (admin_column_exists('catalogs', 'updated_at')) $sets[] = 'updated_at = NOW()';
    if ($sets) db()->prepare('UPDATE catalogs SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
}

function products_update_shared_image_index(int $currentCatalogId): array
{
    if (!admin_table_exists('catalogs') || !admin_column_exists('catalogs', 'catalog_json_path')) return [];
    $columns = [
        'id',
        admin_column_exists('catalogs', 'public_url') ? 'public_url' : "'' AS public_url",
        'catalog_json_path',
    ];
    $where = 'catalog_json_path <> ""';
    if (admin_column_exists('catalogs', 'status')) {
        $where .= " AND status = 'active'";
    }
    $orderBy = admin_column_exists('catalogs', 'updated_at') ? 'updated_at DESC' : 'id DESC';
    $stmt = db()->query('SELECT ' . implode(', ', $columns) . " FROM catalogs WHERE {$where} ORDER BY {$orderBy} LIMIT 80");
    $imageIndex = [];
    foreach ($stmt->fetchAll() as $sourceCatalog) {
        try {
            $sourceJsonPath = products_update_catalog_json_full_path($sourceCatalog);
            $sourceJson = products_update_read_catalog_json($sourceJsonPath);
        } catch (Throwable) {
            continue;
        }
        $sourceDirUrl = products_update_catalog_public_dir_url($sourceCatalog);
        $sameCatalog = (int) ($sourceCatalog['id'] ?? 0) === $currentCatalogId;
        foreach (products_update_products($sourceJson) as $product) {
            $itemKey = products_update_item_key((string) ($product['item'] ?? $product['item_code'] ?? ''));
            if ($itemKey === '' || isset($imageIndex[$itemKey])) continue;
            $image = products_update_extract_product_image($product, $sourceDirUrl, $sameCatalog);
            if ($image['image_url'] !== '') {
                $imageIndex[$itemKey] = $image;
            }
        }
    }
    return $imageIndex;
}

function products_update_extract_product_image(array $product, string $sourceDirUrl, bool $sameCatalog): array
{
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    $imageCandidates = [
        $product['remote_image_url'] ?? '',
        $product['remoteImageUrl'] ?? '',
        $media['remote_image_url'] ?? '',
        $media['remoteImageUrl'] ?? '',
        $product['image_url'] ?? '',
        $product['imageUrl'] ?? '',
        $product['mainImage'] ?? '',
        $media['mainImage'] ?? '',
        $media['main_image'] ?? '',
    ];
    if (!empty($media['mainImageCandidates']) && is_array($media['mainImageCandidates'])) {
        $imageCandidates = array_merge($imageCandidates, $media['mainImageCandidates']);
    }
    $thumbCandidates = [
        $product['thumbnail_url'] ?? '',
        $product['thumbnailUrl'] ?? '',
        $media['thumbnail'] ?? '',
        $media['thumbnailUrl'] ?? '',
        $media['cardImage'] ?? '',
    ];
    if (!empty($media['cardImageCandidates']) && is_array($media['cardImageCandidates'])) {
        $thumbCandidates = array_merge($thumbCandidates, $media['cardImageCandidates']);
    }
    return [
        'image_url' => products_update_normalize_shared_image_url(products_update_first_image_candidate($imageCandidates), $sourceDirUrl, $sameCatalog),
        'thumbnail_url' => products_update_normalize_shared_image_url(products_update_first_image_candidate($thumbCandidates), $sourceDirUrl, $sameCatalog),
    ];
}

function products_update_first_image_candidate(array $candidates): string
{
    foreach ($candidates as $candidate) {
        $value = trim((string) $candidate);
        if ($value !== '') return $value;
    }
    return '';
}

function products_update_catalog_public_dir_url(array $catalog): string
{
    $publicUrl = trim((string) ($catalog['public_url'] ?? ''));
    if ($publicUrl !== '') {
        return rtrim(preg_replace('/[#?].*$/', '', $publicUrl), '/') . '/';
    }
    return '';
}

function products_update_normalize_shared_image_url(string $url, string $sourceDirUrl, bool $sameCatalog): string
{
    $url = trim($url);
    if ($url === '') return '';
    if (preg_match('#^https?://#i', $url)) return $url;
    if ($sameCatalog) return $url;
    if ($sourceDirUrl === '') return '';
    return rtrim($sourceDirUrl, '/') . '/' . ltrim(preg_replace('#^\./#', '', $url), '/');
}

function products_update_resolve_brand_filter(array $input): string
{
    $custom = products_update_clean_text((string) ($input['brand_filter_custom'] ?? ''));
    if ($custom !== '') return $custom;
    $selected = products_update_clean_text((string) ($input['brand_filter'] ?? ''));
    return $selected === '__custom' ? '' : $selected;
}

function products_update_resolve_entry_filter(array $input): string
{
    return products_update_clean_text((string) ($input['entry_filter'] ?? ''));
}

function products_update_entry_filter_label(string $entry): string
{
    $entry = products_update_clean_text($entry);
    return $entry === '' ? 'Todas' : $entry;
}

function products_update_missing_image_row(array $row, ?array $existingProduct): array
{
    return [
        'item' => (string) ($row['ITEM'] ?? ($existingProduct['item'] ?? '')),
        'entry' => (string) ($row['ENTRADA'] ?? ($existingProduct['entry'] ?? '')),
        'brand' => (string) ($row['MARCA'] ?? ($existingProduct['brand'] ?? '')),
        'description' => (string) ($row['DESCRIPCION'] ?? ($existingProduct['description'] ?? $existingProduct['shortDescription'] ?? '')),
    ];
}

function products_update_brand_filter_label(string $brand): string
{
    $brand = products_update_clean_text($brand);
    return $brand === '' ? 'Todas' : $brand;
}

function products_update_row_matches_brand_filter(array $row, ?array $existingProduct, string $brandFilterKey): bool
{
    if ($brandFilterKey === '') return true;
    $rowBrandKey = products_update_brand_key((string) ($row['MARCA'] ?? ''));
    if ($rowBrandKey !== '') return $rowBrandKey === $brandFilterKey;
    return is_array($existingProduct) && products_update_product_matches_brand_filter($existingProduct, $brandFilterKey);
}

function products_update_row_matches_entry_filter(array $row, ?array $existingProduct, string $entryFilterKey): bool
{
    if ($entryFilterKey === '') return true;
    $rowEntryKey = products_update_entry_key((string) ($row['ENTRADA'] ?? ''));
    if ($rowEntryKey !== '') return $rowEntryKey === $entryFilterKey;
    return is_array($existingProduct) && products_update_product_matches_entry_filter($existingProduct, $entryFilterKey);
}

function products_update_product_matches_brand_filter(array $product, string $brandFilterKey): bool
{
    if ($brandFilterKey === '') return true;
    return products_update_brand_key((string) ($product['brand'] ?? $product['marca'] ?? '')) === $brandFilterKey;
}

function products_update_product_matches_entry_filter(array $product, string $entryFilterKey): bool
{
    if ($entryFilterKey === '') return true;
    return products_update_entry_key((string) ($product['entry'] ?? $product['entrada'] ?? '')) === $entryFilterKey;
}

function products_update_log_result(array $catalog, array $preview, int $updated, int $outOfStock): void
{
    if (!admin_table_exists('catalog_product_update_logs')) return;
    db()->prepare(
        'INSERT INTO catalog_product_update_logs (catalog_id, admin_user_id, filename, total_rows, matched_count, updated_count, out_of_stock_count, not_found_count, error_count)
         VALUES (:catalog_id, :admin_user_id, :filename, :total_rows, :matched_count, :updated_count, :out_of_stock_count, :not_found_count, :error_count)'
    )->execute([
        'catalog_id' => (int) $catalog['id'],
        'admin_user_id' => current_user()['id'] ?? null,
        'filename' => (string) ($preview['filename'] ?? ''),
        'total_rows' => (int) ($preview['total_rows'] ?? 0),
        'matched_count' => (int) ($preview['updated_count'] ?? 0),
        'updated_count' => $updated,
        'out_of_stock_count' => $outOfStock,
        'not_found_count' => 0,
        'error_count' => count((array) ($preview['errors'] ?? [])),
    ]);
}

function products_update_resolve_price_mode(string $requested, array $json): string
{
    if ($requested === 'factor55' || $requested === 'original') return $requested;
    return ((string) ($json['priceMode'] ?? '') === 'factor55') ? 'factor55' : 'original';
}

function products_update_format_price_for_mode(string $value, string $mode): array
{
    $base = products_update_price_number($value);
    if (!is_finite($base) || $base <= 0) {
        $text = trim($value);
        return ['price' => $text, 'originalPrice' => $text];
    }
    $price = $mode === 'factor55' ? round($base * 0.55, 2) : $base;
    return ['price' => products_update_money($price), 'originalPrice' => products_update_money($base)];
}

function products_update_price_mode_label(string $mode): string
{
    return $mode === 'factor55' ? '55% del precio del CSV' : 'Precio original del CSV';
}

function products_update_price_number(string $value): float
{
    $normalized = preg_replace('/[^0-9.,-]+/', '', $value) ?? '';
    $normalized = str_replace(',', '.', $normalized);
    return (float) $normalized;
}

function products_update_money(float $value): string
{
    return '$' . number_format(round($value, 2), 2, '.', '');
}

function products_update_set_product_image(array &$product, string $imageUrl, string $thumbnailUrl = ''): void
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

function products_update_product_has_image(array $product): bool
{
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    foreach ([$product['remote_image_url'] ?? '', $product['image_url'] ?? '', $product['imageUrl'] ?? '', $media['mainImage'] ?? '', $media['remote_image_url'] ?? ''] as $value) {
        if (trim((string) $value) !== '') return true;
    }
    return false;
}

function products_update_create_thumbnail(string $sourcePath, string $extension): ?array
{
    if (!extension_loaded('gd')) return null;
    $source = match ($extension) {
        'jpg', 'jpeg' => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($sourcePath) : false,
        'png' => function_exists('imagecreatefrompng') ? @imagecreatefrompng($sourcePath) : false,
        'webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($sourcePath) : false,
        default => false,
    };
    if (!$source) return null;
    $width = imagesx($source);
    $height = imagesy($source);
    $scale = min(1, CATALOG_PRODUCTS_THUMB_MAX_WIDTH / max($width, $height));
    $targetWidth = max(1, (int) round($width * $scale));
    $targetHeight = max(1, (int) round($height * $scale));
    $thumb = imagecreatetruecolor($targetWidth, $targetHeight);
    imagealphablending($thumb, false);
    imagesavealpha($thumb, true);
    imagecopyresampled($thumb, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
    imagedestroy($source);
    $tmp = tempnam(sys_get_temp_dir(), 'catalog-thumb-');
    if (!is_string($tmp) || $tmp === '') return null;
    if (function_exists('imagewebp') && imagewebp($thumb, $tmp, 82)) {
        imagedestroy($thumb);
        return ['path' => $tmp, 'extension' => 'webp', 'content_type' => 'image/webp'];
    }
    if (imagejpeg($thumb, $tmp, 82)) {
        imagedestroy($thumb);
        return ['path' => $tmp, 'extension' => 'jpg', 'content_type' => 'image/jpeg'];
    }
    imagedestroy($thumb);
    @unlink($tmp);
    return null;
}

function products_update_save_local_thumbnail(string $sourcePath, string $extension, string $mediaDir, string $safeItem): string
{
    $thumb = products_update_create_thumbnail($sourcePath, $extension);
    if (!$thumb) return '';
    $thumbDir = $mediaDir . DIRECTORY_SEPARATOR . 'thumbs';
    if (!is_dir($thumbDir) && !mkdir($thumbDir, 0775, true) && !is_dir($thumbDir)) return '';
    $fileName = $safeItem . '-thumb-' . date('YmdHis') . '.' . $thumb['extension'];
    $target = $thumbDir . DIRECTORY_SEPARATOR . $fileName;
    if (!rename($thumb['path'], $target)) return '';
    return './media/main/thumbs/' . $fileName;
}

function products_update_content_type(string $extension): string
{
    return match ($extension) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => 'application/octet-stream',
    };
}

function products_update_remote_image_url(array $row): string
{
    $url = trim((string) ($row['REMOTE_IMAGE_URL'] ?? $row['IMAGE_URL'] ?? $row['URL_IMAGEN'] ?? ''));
    return preg_match('#^https?://#i', $url) ? $url : '';
}

function products_update_preview_base_dir(): string
{
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'catalog_product_updates';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) throw new RuntimeException('No se pudo preparar carpeta temporal.');
    return $dir;
}

function products_update_preview_dir(string $token): string
{
    $dir = products_update_preview_base_dir() . DIRECTORY_SEPARATOR . preg_replace('/[^a-zA-Z0-9_-]+/', '', $token);
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) throw new RuntimeException('No se pudo preparar carpeta temporal.');
    return $dir;
}

function products_update_write_preview(string $token, array $preview): void
{
    file_put_contents(products_update_preview_base_dir() . DIRECTORY_SEPARATOR . $token . '.json', json_encode($preview, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function products_update_read_preview(string $token): ?array
{
    if ($token === '') return null;
    $path = products_update_preview_base_dir() . DIRECTORY_SEPARATOR . $token . '.json';
    if (!is_file($path)) return null;
    $decoded = json_decode((string) file_get_contents($path), true);
    return is_array($decoded) ? $decoded : null;
}

function products_update_delete_preview(string $token): void
{
    $path = products_update_preview_base_dir() . DIRECTORY_SEPARATOR . $token . '.json';
    if (is_file($path)) @unlink($path);
}

function products_update_delete_preview_dir(string $token): void
{
    $dir = products_update_preview_base_dir() . DIRECTORY_SEPARATOR . preg_replace('/[^a-zA-Z0-9_-]+/', '', $token);
    if (is_dir($dir)) products_update_delete_dir($dir);
}

function products_update_delete_dir(string $dir): void
{
    foreach (scandir($dir) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        is_dir($path) ? products_update_delete_dir($path) : @unlink($path);
    }
    @rmdir($dir);
}

function products_update_normalize_column(string $value): string
{
    $value = strtoupper(trim(str_replace("\xEF\xBB\xBF", '', $value)));
    $value = strtr($value, ['Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N']);
    $value = preg_replace('/[^A-Z0-9]+/', '', $value) ?? $value;
    return match ($value) {
        'DESCRIPCION', 'DESCRIPCIONPRODUCTO', 'PRODUCTO', 'NOMBRE' => 'DESCRIPCION',
        'DISP', 'DISPONIBLE', 'STOCK', 'EXISTENCIA' => 'DISPONIBLE',
        'PRECIO', 'PRICE', 'PVP' => 'PRECIO',
        'CODIGOBARRAS', 'CODBARRA', 'CB' => 'CBARRA',
        'MARCA', 'BRAND', 'FABRICANTE' => 'MARCA',
        'ENTRADA', 'ENTRY', 'LOTE', 'IMPORTACION', 'IMPORTACIONENTRADA' => 'ENTRADA',
        'CATEGORIA', 'CATEGORY', 'LINEA', 'FAMILIA', 'GRUPO' => 'CATEGORIA',
        'TAMANO', 'TAMANIO', 'TAMAÑO', 'TAMAO', 'SIZE', 'MEDIDA', 'MEDIDAS', 'DIMENSION' => 'TAMANO',
        'URLIMAGEN', 'IMAGENURL', 'IMAGEURL', 'REMOTEIMAGEURL', 'REMOTEIMAGE', 'URL_IMAGEN' => 'REMOTE_IMAGE_URL',
        'MINIMO', 'MINIMOPEDIDO' => 'MINIMO',
        'MULTIPLO', 'MULTIPLE' => 'MULTIPLO',
        default => $value,
    };
}

function products_update_item_key(string $value): string
{
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized) || $normalized === '') $normalized = $value;
    return preg_replace('/[^A-Z0-9]+/', '', strtoupper($normalized)) ?? '';
}

function products_update_brand_key(string $value): string
{
    return products_update_item_key($value);
}

function products_update_entry_key(string $value): string
{
    $value = trim($value);
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized) || $normalized === '') $normalized = $value;
    return preg_replace('/[^A-Z0-9]+/', '', strtoupper($normalized)) ?? '';
}

function products_update_clean_text(string $value): string
{
    return trim(strip_tags($value));
}

function products_update_available_number(string $value): int
{
    $normalized = preg_replace('/[^0-9.-]+/', '', str_replace(',', '.', $value)) ?? '';
    return (int) floor(max(0, (float) $normalized));
}
