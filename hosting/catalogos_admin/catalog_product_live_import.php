<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_once dirname(__DIR__) . '/catalogos_api/backblaze_helpers.php';
admin_require_login(['admin', 'sales']);

const LIVE_PRODUCT_IMPORT_MAX_BYTES = 10485760;
const LIVE_PRODUCT_IMPORT_MAX_IMAGE_BYTES = 8388608;

$catalogId = (int) ($_GET['catalog_id'] ?? $_POST['catalog_id'] ?? 0);
$catalog = $catalogId > 0 ? live_import_fetch_catalog($catalogId) : null;
$schemaReady = live_import_schema_ready();
$preview = null;
$applyResult = null;
$errorMessage = '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && (string) ($_GET['action'] ?? '') === 'download_missing_images') {
    live_import_download_missing_images_report($catalog);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    try {
        if (!$catalog) {
            throw new RuntimeException('Catalogo no encontrado.');
        }
        if (!$schemaReady) {
            throw new RuntimeException('Faltan migraciones de Fase 1, Fase 2 o Fase 3.');
        }
        if (resolve_catalog_status($catalog) !== 'active') {
            throw new RuntimeException('Solo se pueden importar productos en catalogos activos.');
        }
        $action = (string) ($_POST['action'] ?? 'preview');
        if ($action === 'preview') {
            $preview = live_import_preview_from_upload($catalog);
        } elseif ($action === 'attach_images') {
            $preview = live_import_attach_images_to_preview($catalog);
        } elseif ($action === 'apply') {
            $applyResult = live_import_apply_confirmed($catalog);
            flash_set('success', 'Importacion viva aplicada. Actualizados: ' . (int) $applyResult['updated_count'] . ' · Nuevos: ' . (int) $applyResult['created_count'] . ' · Omitidos: ' . (int) $applyResult['skipped_count']);
            header('Location: catalog_product_live_import.php?catalog_id=' . (int) $catalog['id']);
            exit;
        }
    } catch (Throwable $exception) {
        $errorMessage = $exception->getMessage();
        $token = preg_replace('/[^a-f0-9]/', '', strtolower((string) ($_POST['preview_token'] ?? '')));
        if ($token !== '') {
            $preview = live_import_read_preview($token);
        }
    }
}

admin_header('Importar productos vivo', 'catalogos.php');
?>
<section class="card">
    <div class="toolbar">
        <strong>Importar productos vivo</strong>
        <a class="button" href="catalogos.php">Volver</a>
    </div>

    <?php if (!$catalog): ?>
        <p class="muted">Catalogo no encontrado.</p>
    <?php elseif (!$schemaReady): ?>
        <div class="notice notice--warning" style="margin:16px 0;">
            Ejecuta las migraciones <code>20260604_catalog_product_live_edits.sql</code>, <code>20260604_catalog_product_live_edits_phase2.sql</code> y <code>20260604_catalog_product_live_imports_phase3.sql</code>.
        </div>
    <?php else: ?>
        <p class="muted">Catalogo: <strong><?= html_escape($catalog['title'] ?? '') ?></strong> &middot; <code><?= html_escape($catalog['slug'] ?? '') ?></code></p>
        <p class="muted">Esta importacion actualiza solo la capa viva MySQL. No reescribe catalog.json y no modifica Electron.</p>

        <?php if ($errorMessage !== ''): ?>
            <div class="notice notice--warning" style="margin:16px 0;"><?= html_escape($errorMessage) ?></div>
        <?php endif; ?>

        <?php if ($preview): ?>
            <div class="metrics-grid" style="margin:18px 0;">
                <div class="metric-card"><span>Filas leidas</span><strong><?= (int) $preview['total_rows'] ?></strong></div>
                <div class="metric-card"><span>Actualizaria</span><strong><?= (int) $preview['updated_count'] ?></strong></div>
                <div class="metric-card"><span>Nuevos manuales</span><strong><?= (int) $preview['created_count'] ?></strong></div>
                <div class="metric-card"><span>Sin imagen</span><strong><?= (int) ($preview['missing_image_count'] ?? 0) ?></strong></div>
                <div class="metric-card"><span>Precio</span><strong><?= html_escape(live_import_price_mode_label((string) ($preview['price_mode'] ?? 'file'))) ?></strong></div>
                <div class="metric-card"><span>Marca</span><strong><?= html_escape((string) (($preview['brand_filter'] ?? '') ?: 'Todas')) ?></strong></div>
                <div class="metric-card"><span>Entrada</span><strong><?= html_escape((string) (($preview['entry_filter'] ?? '') ?: 'Todas')) ?></strong></div>
                <div class="metric-card"><span>Omitidos</span><strong><?= (int) $preview['skipped_count'] ?></strong></div>
                <div class="metric-card"><span>Errores</span><strong><?= (int) $preview['error_count'] ?></strong></div>
            </div>

            <div class="notice notice--success" style="margin-bottom:16px;">
                Vista previa: se actualizarian <?= (int) $preview['updated_count'] ?> productos existentes y se crearian <?= (int) $preview['created_count'] ?> productos nuevos manuales<?= ($preview['brand_filter'] ?? '') !== '' ? ' de la marca ' . html_escape((string) $preview['brand_filter']) : '' ?><?= ($preview['entry_filter'] ?? '') !== '' ? ' de la entrada ' . html_escape((string) $preview['entry_filter']) : '' ?>. Precio: <?= html_escape(live_import_price_mode_label((string) ($preview['price_mode'] ?? 'file'))) ?>.
                <?= !empty($preview['data_only_update']) ? ' Modo solo datos: los ITEM nuevos se omiten y no se piden imagenes.' : '' ?>
            </div>

            <?php if (!empty($preview['errors'])): ?>
                <div class="notice notice--warning" style="margin-bottom:16px;"><?= html_escape(implode(' ', array_slice($preview['errors'], 0, 8))) ?></div>
            <?php endif; ?>
            <?php if (((int) ($preview['missing_image_count'] ?? 0)) > 0): ?>
                <div class="notice notice--warning" style="margin-bottom:16px;">
                    Hay productos nuevos sin imagen. Sube las imagenes con el ITEM como nombre de archivo antes de confirmar.
                    <a class="button" style="margin-left:10px;" href="catalog_product_live_import.php?catalog_id=<?= (int) $catalog['id'] ?>&amp;action=download_missing_images&amp;preview_token=<?= html_escape($preview['preview_token']) ?>">Descargar reporte completo CSV</a>
                </div>
            <?php endif; ?>
            <?php if (!empty($preview['last_attached_images'])): ?>
                <div class="notice notice--success" style="margin-bottom:16px;">
                    Imagenes agregadas a esta vista previa: <?= (int) $preview['last_attached_images'] ?>. Puedes subir otra tanda si faltan mas.
                </div>
            <?php endif; ?>

            <div class="table-wrap" style="margin-bottom:18px;">
                <table>
                    <thead><tr><th>ITEM</th><th>Accion</th><th>Entrada</th><th>Descripcion</th><th>Precio</th><th>Disp.</th><th>Marca</th><th>Categoria</th></tr></thead>
                    <tbody>
                    <?php foreach (array_slice($preview['sample'], 0, 60) as $row): ?>
                        <tr>
                            <td><?= html_escape($row['item'] ?? '') ?></td>
                            <td><?= html_escape($row['status'] ?? '') ?></td>
                            <td><?= html_escape($row['entry'] ?? '') ?></td>
                            <td><?= html_escape($row['description'] ?? '') ?></td>
                            <td><?= html_escape($row['price'] ?? '') ?></td>
                            <td><?= html_escape($row['available'] ?? '') ?></td>
                            <td><?= html_escape($row['brand'] ?? '') ?></td>
                            <td><?= html_escape($row['category'] ?? '') ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <?php if ((int) $preview['created_count'] > 0 || (int) $preview['updated_count'] > 0): ?>
                <section class="card" style="margin:18px 0;">
                    <div class="toolbar">
                        <strong>Imagenes para esta vista previa</strong>
                        <span class="pill"><?= (int) ($preview['missing_image_count'] ?? 0) ?> faltantes</span>
                    </div>
                    <p class="muted">Nombra cada imagen con el ITEM. Ejemplo: <code>100-9286.jpg</code>. Puedes subir imagenes para productos nuevos o existentes de esta vista previa. Si el hosting limita la cantidad, subelas por tandas de 10 a 15.</p>
                    <?php if (!empty($preview['missing_images'])): ?>
                        <p class="muted">Se muestran hasta 80 registros en pantalla. El reporte CSV contiene los <?= (int) ($preview['missing_image_count'] ?? 0) ?> productos sin imagen.</p>
                        <div class="table-wrap" style="margin:12px 0 18px;">
                            <table>
                                <thead><tr><th>ITEM faltante</th><th>Entrada</th><th>Descripcion</th><th>Marca</th><th>Categoria</th></tr></thead>
                                <tbody>
                                <?php foreach (array_slice($preview['missing_images'], 0, 80) as $missing): ?>
                                    <tr>
                                        <td><?= html_escape($missing['item'] ?? '') ?></td>
                                        <td><?= html_escape($missing['entry'] ?? '') ?></td>
                                        <td><?= html_escape($missing['description'] ?? '') ?></td>
                                        <td><?= html_escape($missing['brand'] ?? '') ?></td>
                                        <td><?= html_escape($missing['category'] ?? '') ?></td>
                                    </tr>
                                <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php endif; ?>
                    <form class="form-grid" id="liveImportImagesForm" method="post" enctype="multipart/form-data">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="attach_images">
                        <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
                        <input type="hidden" name="preview_token" value="<?= html_escape($preview['preview_token']) ?>">
                        <label class="wide">
                            <span>Subir imagenes por ITEM</span>
                            <input id="liveImportImagesInput" type="file" name="product_images[]" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple required>
                        </label>
                        <div class="wide">
                            <button class="button--primary" id="liveImportImagesSubmit" type="submit">Agregar imagenes a esta vista previa</button>
                            <p class="muted" id="liveImportImagesStatus" role="status" aria-live="polite" hidden></p>
                        </div>
                    </form>
                </section>
            <?php endif; ?>

            <?php if (((int) $preview['updated_count'] + (int) $preview['created_count']) > 0 && (int) $preview['error_count'] === 0 && (int) ($preview['missing_image_count'] ?? 0) === 0): ?>
                <form method="post" onsubmit="return confirm('Confirmas aplicar esta importacion a la capa viva MySQL?');">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="apply">
                    <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
                    <input type="hidden" name="preview_token" value="<?= html_escape($preview['preview_token']) ?>">
                    <button class="button--primary" type="submit">Confirmar importacion</button>
                </form>
            <?php endif; ?>
        <?php endif; ?>

        <form class="form-grid" method="post" enctype="multipart/form-data" style="margin-top:18px;">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="preview">
            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
            <label class="wide">
                <span>Archivo CSV o XLSX</span>
                <input type="file" name="live_import_file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required>
                <small>Columnas aceptadas: ITEM, DESCRIPCION, PRECIO, DISPONIBLE, MARCA, EMPAQUE, CATEGORIA, CBARRA/BARCODE, ACTIVO, MERCANCIA_NUEVA, IMAGE_URL.</small>
            </label>
            <label>
                <span>Marca a actualizar</span>
                <input type="text" name="brand_filter" placeholder="Ejemplo: LUXURY HOME LINENS">
                <small>Opcional. Dejalo vacio para actualizar todo el catalogo seleccionado.</small>
            </label>
            <label>
                <span>Entrada a actualizar</span>
                <input type="text" name="entry_filter" placeholder="Ejemplo: 26/017">
                <small>Opcional. Usalo si solo quieres actualizar una entrada/lote del archivo.</small>
            </label>
            <label>
                <span>Precio a importar</span>
                <select name="price_mode">
                    <option value="file">Usar precio del archivo</option>
                    <option value="factor_055">Aplicar factor 0.55</option>
                </select>
                <small>La vista previa muestra el precio final antes de confirmar.</small>
            </label>
            <label class="wide check-row">
                <input type="checkbox" name="data_only_update" value="1" checked>
                <span>Solo actualizar productos existentes y codigos de barra. No crear productos nuevos ni pedir imagenes.</span>
            </label>
            <label class="wide check-row">
                <input type="checkbox" name="allow_new_products" value="1">
                <span>Crear como productos manuales los ITEM que no existan.</span>
            </label>
            <div class="wide"><button class="button--primary" type="submit">Vista previa</button></div>
        </form>
    <?php endif; ?>
</section>
<script>
(() => {
    const form = document.getElementById('liveImportImagesForm');
    const input = document.getElementById('liveImportImagesInput');
    const button = document.getElementById('liveImportImagesSubmit');
    const status = document.getElementById('liveImportImagesStatus');
    if (!form || !input || !button || !status) return;
    input.addEventListener('change', () => {
        const count = input.files ? input.files.length : 0;
        status.hidden = count === 0;
        status.textContent = count === 1 ? '1 imagen seleccionada.' : `${count} imagenes seleccionadas.`;
    });
    form.addEventListener('submit', () => {
        const count = input.files ? input.files.length : 0;
        button.disabled = true;
        button.textContent = 'Subiendo imagenes...';
        status.hidden = false;
        status.textContent = `Subiendo ${count} imagen${count === 1 ? '' : 'es'} al almacenamiento configurado. No cierres ni recargues esta pagina...`;
    });
})();
</script>
<?php admin_footer(); ?>

<?php
function live_import_fetch_catalog(int $catalogId): ?array
{
    if (!admin_table_exists('catalogs')) return null;
    $stmt = db()->prepare('SELECT * FROM catalogs WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $catalogId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function live_import_download_missing_images_report(?array $catalog): void
{
    if (!$catalog) {
        http_response_code(404);
        exit('Catalogo no encontrado.');
    }
    $token = preg_replace('/[^a-f0-9]/', '', strtolower((string) ($_GET['preview_token'] ?? '')));
    $preview = $token !== '' ? live_import_read_preview($token) : null;
    if (!$preview || (int) ($preview['catalog_id'] ?? 0) !== (int) $catalog['id']) {
        http_response_code(404);
        exit('La vista previa vencio o no pertenece a este catalogo.');
    }
    $missingImages = is_array($preview['missing_images'] ?? null) ? $preview['missing_images'] : [];
    $slug = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string) ($catalog['slug'] ?? 'catalogo')) ?: 'catalogo';
    $filename = 'imagenes-faltantes-' . trim($slug, '-') . '-' . date('Ymd-His') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('X-Content-Type-Options: nosniff');
    $output = fopen('php://output', 'wb');
    if ($output === false) exit;
    fwrite($output, "\xEF\xBB\xBF");
    fputcsv($output, ['ITEM', 'ARCHIVO_ESPERADO', 'ENTRADA', 'DESCRIPCION', 'MARCA', 'CATEGORIA'], ';');
    foreach ($missingImages as $missing) {
        $item = trim((string) ($missing['item'] ?? ''));
        fputcsv($output, [
            $item,
            $item !== '' ? $item . '.jpg' : '',
            (string) ($missing['entry'] ?? ''),
            (string) ($missing['description'] ?? ''),
            (string) ($missing['brand'] ?? ''),
            (string) ($missing['category'] ?? ''),
        ], ';');
    }
    fclose($output);
    exit;
}

function live_import_schema_ready(): bool
{
    return admin_table_exists('catalog_product_live_edits')
        && admin_table_exists('catalog_product_live_edit_history')
        && admin_table_exists('catalog_product_live_import_logs')
        && admin_column_exists('catalog_product_live_edits', 'product_payload')
        && admin_column_exists('catalog_product_live_edits', 'source_type');
}

function live_import_preview_from_upload(array $catalog): array
{
    if (empty($_FILES['live_import_file']) || !is_array($_FILES['live_import_file'])) {
        throw new RuntimeException('Debes subir un archivo CSV o XLSX.');
    }
    $file = $_FILES['live_import_file'];
    if ((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo recibir el archivo.');
    }
    if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > LIVE_PRODUCT_IMPORT_MAX_BYTES) {
        throw new RuntimeException('El archivo debe pesar menos de 10 MB.');
    }
    $filename = basename((string) ($file['name'] ?? 'productos.csv'));
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $rows = match ($extension) {
        'csv' => live_import_parse_csv((string) $file['tmp_name']),
        'xlsx' => live_import_parse_xlsx((string) $file['tmp_name']),
        default => throw new RuntimeException('Formato no permitido. Usa CSV o XLSX.'),
    };
    return live_import_build_preview(
        $catalog,
        $rows,
        $filename,
        isset($_POST['allow_new_products']) && !isset($_POST['data_only_update']),
        live_import_clean_text((string) ($_POST['brand_filter'] ?? '')),
        live_import_clean_text((string) ($_POST['entry_filter'] ?? '')),
        live_import_normalize_price_mode((string) ($_POST['price_mode'] ?? 'file')),
        isset($_POST['data_only_update'])
    );
}

function live_import_build_preview(array $catalog, array $rows, string $filename, bool $allowNew, string $brandFilter = '', string $entryFilter = '', string $priceMode = 'file', bool $dataOnlyUpdate = false): array
{
    $priceMode = live_import_normalize_price_mode($priceMode);
    $baseProducts = live_import_base_products($catalog);
    $baseIndex = live_import_product_index($baseProducts);
    $liveIndex = live_import_live_index((int) $catalog['id']);
    $brandFilterKey = live_import_brand_key($brandFilter);
    $entryFilterKey = live_import_entry_key($entryFilter);
    $seen = [];
    $errors = [];
    $sample = [];
    $missingImages = [];
    $updated = $created = $skipped = 0;

    foreach ($rows as $rowNumber => $row) {
        $item = live_import_item_key((string) ($row['ITEM'] ?? ''));
        if ($item === '') {
            $errors[] = 'Fila ' . ($rowNumber + 2) . ' sin ITEM.';
            $skipped++;
            continue;
        }
        $existsInBase = isset($baseIndex[$item]);
        $existsLive = isset($liveIndex[$item]);
        if ($brandFilterKey !== '' && !live_import_row_matches_brand($row, $brandFilterKey, $baseIndex[$item] ?? null, $liveIndex[$item] ?? null)) {
            $skipped++;
            continue;
        }
        if ($entryFilterKey !== '' && !live_import_row_matches_entry($row, $entryFilterKey, $baseIndex[$item] ?? null)) {
            $skipped++;
            continue;
        }
        if (isset($seen[$item])) {
            $skipped++;
            if ($dataOnlyUpdate) {
                $sample[] = live_import_sample($row, $item, 'omitido duplicado', $priceMode);
            } else {
                $errors[] = 'ITEM duplicado en archivo para este filtro: ' . live_import_item_label($row, $item) . '.';
            }
            continue;
        }
        $seen[$item] = true;
        if (!$existsInBase && !$existsLive && !$allowNew) {
            $skipped++;
            $sample[] = live_import_sample($row, $item, 'omitido nuevo sin permiso', $priceMode);
            continue;
        }
        if (!$existsInBase && (!$existsLive || (string) ($liveIndex[$item]['source_type'] ?? '') === 'manual')) {
            if ($existsLive) {
                $updated++;
            } else {
                $created++;
            }
            if (live_import_row_image_url($row) === '' && live_import_live_image_url($liveIndex[$item] ?? null) === '') {
                $missingImages[] = live_import_missing_image_row($row, $item);
            }
            $sample[] = live_import_sample($row, $item, $existsLive ? 'actualizaria manual' : 'crearia manual', $priceMode);
            continue;
        }
        $updated++;
        $sample[] = live_import_sample($row, $item, 'actualizaria', $priceMode);
    }

    $token = bin2hex(random_bytes(16));
    $preview = [
        'preview_token' => $token,
        'catalog_id' => (int) $catalog['id'],
        'filename' => $filename,
        'allow_new_products' => $allowNew,
        'data_only_update' => $dataOnlyUpdate,
        'brand_filter' => $brandFilter,
        'entry_filter' => $entryFilter,
        'price_mode' => $priceMode,
        'rows' => $rows,
        'total_rows' => count($rows),
        'updated_count' => $updated,
        'created_count' => $created,
        'skipped_count' => $skipped,
        'missing_image_count' => count($missingImages),
        'missing_images' => $missingImages,
        'error_count' => count($errors),
        'errors' => $errors,
        'sample' => $sample,
    ];
    live_import_write_preview($token, $preview);
    return $preview;
}

function live_import_attach_images_to_preview(array $catalog): array
{
    $token = preg_replace('/[^a-f0-9]/', '', strtolower((string) ($_POST['preview_token'] ?? '')));
    $preview = live_import_read_preview($token);
    if (!$preview || (int) ($preview['catalog_id'] ?? 0) !== (int) $catalog['id']) {
        throw new RuntimeException('La vista previa vencio o no pertenece a este catalogo.');
    }
    $images = live_import_store_uploaded_images($catalog);
    if (!$images) {
        throw new RuntimeException('No se recibieron imagenes validas.');
    }
    $attached = 0;
    foreach ($preview['rows'] as &$row) {
        $item = live_import_item_key((string) ($row['ITEM'] ?? ''));
        if ($item === '' || !isset($images[$item])) {
            continue;
        }
        $row['IMAGE_URL'] = $images[$item]['image_url'];
        $row['THUMBNAIL_URL'] = $images[$item]['thumbnail_url'];
        $attached++;
    }
    unset($row);
    $rebuilt = live_import_build_preview(
        $catalog,
        (array) $preview['rows'],
        (string) ($preview['filename'] ?? 'importacion.csv'),
        (bool) ($preview['allow_new_products'] ?? true),
        (string) ($preview['brand_filter'] ?? ''),
        (string) ($preview['entry_filter'] ?? ''),
        (string) ($preview['price_mode'] ?? 'file'),
        (bool) ($preview['data_only_update'] ?? false)
    );
    $rebuilt['preview_token'] = $token;
    $rebuilt['last_attached_images'] = $attached;
    live_import_write_preview($token, $rebuilt);
    if ($attached === 0) {
        throw new RuntimeException('Las imagenes no coinciden con ningun ITEM pendiente. Usa el ITEM como nombre de archivo.');
    }
    return $rebuilt;
}

function live_import_apply_confirmed(array $catalog): array
{
    $token = preg_replace('/[^a-f0-9]/', '', strtolower((string) ($_POST['preview_token'] ?? '')));
    $preview = live_import_read_preview($token);
    if (!$preview || (int) ($preview['catalog_id'] ?? 0) !== (int) $catalog['id']) {
        throw new RuntimeException('La vista previa vencio o no pertenece a este catalogo.');
    }
    if (!empty($preview['errors'])) {
        throw new RuntimeException('Corrige los errores antes de aplicar.');
    }
    if ((int) ($preview['missing_image_count'] ?? 0) > 0) {
        throw new RuntimeException('Faltan imagenes para productos nuevos. Sube las imagenes antes de confirmar.');
    }

    $catalogId = (int) $catalog['id'];
    $baseIndex = live_import_product_index(live_import_base_products($catalog));
    $liveIndex = live_import_live_index($catalogId);
    $seen = [];
    $updated = $created = $skipped = 0;

    foreach ((array) ($preview['rows'] ?? []) as $row) {
        $item = live_import_item_key((string) ($row['ITEM'] ?? ''));
        if ($item === '') {
            $skipped++;
            continue;
        }
        if (isset($seen[$item])) {
            $skipped++;
            continue;
        }
        $seen[$item] = true;
        $baseProduct = $baseIndex[$item] ?? null;
        $previous = $liveIndex[$item] ?? live_import_fetch_edit($catalogId, $item);
        if (($preview['brand_filter'] ?? '') !== '' && !live_import_row_matches_brand($row, live_import_brand_key((string) $preview['brand_filter']), $baseProduct, $previous)) {
            $skipped++;
            continue;
        }
        if (($preview['entry_filter'] ?? '') !== '' && !live_import_row_matches_entry($row, live_import_entry_key((string) $preview['entry_filter']), $baseProduct)) {
            $skipped++;
            continue;
        }
        $isManual = !$baseProduct && ((bool) ($preview['allow_new_products'] ?? true) || (string) ($previous['source_type'] ?? '') === 'manual');
        if (!$baseProduct && !$isManual) {
            $skipped++;
            continue;
        }
        $itemCode = live_import_item_label($row, $item);
        $values = live_import_merge_values($itemCode, $row, $baseProduct, $previous, $isManual, (string) ($preview['price_mode'] ?? 'file'));
        live_import_upsert_edit($catalogId, $itemCode, $values, $previous, (string) ($previous['item_code'] ?? ''));
        live_import_upsert_barcode($catalogId, $itemCode, (string) ($values['barcode'] ?? ''));
        if ($isManual && !$previous) {
            $created++;
        } else {
            $updated++;
        }
    }

    db()->prepare(
        'INSERT INTO catalog_product_live_import_logs (catalog_id, admin_user_id, filename, total_rows, updated_count, created_count, skipped_count, error_count)
         VALUES (:catalog_id, :admin_user_id, :filename, :total_rows, :updated_count, :created_count, :skipped_count, :error_count)'
    )->execute([
        'catalog_id' => $catalogId,
        'admin_user_id' => current_user()['id'] ?? null,
        'filename' => (string) ($preview['filename'] ?? ''),
        'total_rows' => (int) ($preview['total_rows'] ?? 0),
        'updated_count' => $updated,
        'created_count' => $created,
        'skipped_count' => $skipped,
        'error_count' => (int) ($preview['error_count'] ?? 0),
    ]);
    if (admin_column_exists('catalogs', 'updated_at')) {
        db()->prepare('UPDATE catalogs SET updated_at = NOW() WHERE id = :id')->execute(['id' => $catalogId]);
    }
    live_import_delete_preview($token);
    audit_log('catalog.product_live_imported', 'catalogs', $catalogId, [
        'updated' => $updated,
        'created' => $created,
        'skipped' => $skipped,
        'filename' => (string) ($preview['filename'] ?? ''),
    ]);

    return ['updated_count' => $updated, 'created_count' => $created, 'skipped_count' => $skipped];
}

function live_import_merge_values(string $item, array $row, ?array $baseProduct, ?array $previous, bool $isManual, string $priceMode = 'file'): array
{
    $fallback = [
        'description' => (string) ($previous['description'] ?? $baseProduct['description'] ?? $baseProduct['shortDescription'] ?? $item),
        'price' => (string) ($previous['price'] ?? $baseProduct['price'] ?? ''),
        'available' => (string) ($previous['available'] ?? $baseProduct['available'] ?? $baseProduct['disponible'] ?? '0'),
        'brand' => (string) ($previous['brand'] ?? $baseProduct['brand'] ?? ''),
        'package_label' => (string) ($previous['package_label'] ?? $baseProduct['package'] ?? $baseProduct['empaque'] ?? $baseProduct['packageLabel'] ?? ''),
        'category' => (string) ($previous['category'] ?? $baseProduct['category'] ?? 'General'),
        'barcode' => (string) ($previous['barcode'] ?? $baseProduct['barcode'] ?? $baseProduct['cbarras'] ?? $baseProduct['cbarra'] ?? ''),
        'entry' => (string) ($baseProduct['entry'] ?? ''),
        'is_new' => (int) ($previous['is_new'] ?? $baseProduct['isNew'] ?? $baseProduct['is_new'] ?? 0),
        'is_active' => (int) ($previous['is_active'] ?? 1),
        'image_url' => (string) ($previous['image_url'] ?? live_import_product_image_url($baseProduct ?? [])),
        'thumbnail_url' => (string) ($previous['thumbnail_url'] ?? ''),
    ];
    $values = [
        'description' => live_import_value($row, 'DESCRIPCION', $fallback['description']),
        'price' => live_import_price_value($row, $fallback['price'], $priceMode),
        'available' => live_import_value($row, 'DISPONIBLE', $fallback['available']),
        'brand' => live_import_value($row, 'MARCA', $fallback['brand']),
        'package_label' => live_import_value($row, 'EMPAQUE', $fallback['package_label']),
        'category' => live_import_value($row, 'CATEGORIA', $fallback['category']),
        'barcode' => live_import_clean_barcode(live_import_value($row, 'CBARRA', $fallback['barcode'])),
        'entry' => live_import_value($row, 'ENTRADA', $fallback['entry']),
        'is_new' => live_import_bool_value($row, 'MERCANCIA_NUEVA', (int) $fallback['is_new']),
        'is_active' => live_import_bool_value($row, 'ACTIVO', (int) $fallback['is_active']),
        'image_url' => live_import_value($row, 'IMAGE_URL', $fallback['image_url']),
        'thumbnail_url' => live_import_value($row, 'THUMBNAIL_URL', $fallback['thumbnail_url']),
        'source_type' => $isManual ? 'manual' : 'override',
    ];
    $values['product_payload'] = $isManual ? live_import_product_payload($item, $values) : null;
    return $values;
}

function live_import_upsert_edit(int $catalogId, string $item, array $values, ?array $previous, string $previousItem = ''): void
{
    $hasBarcodeColumn = admin_column_exists('catalog_product_live_edits', 'barcode');
    $previousItem = trim($previousItem);
    if ($previous && $previousItem !== '' && $previousItem !== $item) {
        $setBarcode = $hasBarcodeColumn ? 'barcode = :barcode,' : '';
        $statement = db()->prepare(
            'UPDATE catalog_product_live_edits
             SET item_code = :item_code,
                 description = :description,
                 price = :price,
                 available = :available,
                 brand = :brand,
                 package_label = :package_label,
                 category = :category,
                 ' . $setBarcode . '
                 is_new = :is_new,
                 is_active = :is_active,
                 image_url = :image_url,
                 thumbnail_url = :thumbnail_url,
                 source_type = :source_type,
                 product_payload = :product_payload,
                 updated_by_user_id = :updated_by_user_id,
                 updated_at = NOW()
             WHERE catalog_id = :catalog_id AND item_code = :previous_item_code'
        );
        $params = [
            'catalog_id' => $catalogId,
            'previous_item_code' => $previousItem,
            'item_code' => $item,
            'description' => $values['description'],
            'price' => $values['price'],
            'available' => $values['available'],
            'brand' => $values['brand'],
            'package_label' => $values['package_label'],
            'category' => $values['category'],
            'is_new' => $values['is_new'],
            'is_active' => $values['is_active'],
            'image_url' => $values['image_url'],
            'thumbnail_url' => $values['thumbnail_url'],
            'source_type' => $values['source_type'],
            'product_payload' => $values['product_payload'],
            'updated_by_user_id' => current_user()['id'] ?? null,
        ];
        if ($hasBarcodeColumn) $params['barcode'] = $values['barcode'];
        $statement->execute($params);
    } else {
        $barcodeInsertColumn = $hasBarcodeColumn ? ', barcode' : '';
        $barcodeInsertValue = $hasBarcodeColumn ? ', :barcode' : '';
        $barcodeUpdate = $hasBarcodeColumn ? 'barcode = VALUES(barcode),' : '';
        $statement = db()->prepare(
        'INSERT INTO catalog_product_live_edits
            (catalog_id, item_code, description, price, available, brand, package_label, category' . $barcodeInsertColumn . ', is_new, is_active, image_url, thumbnail_url, source_type, product_payload, created_by_user_id, updated_by_user_id)
         VALUES
            (:catalog_id, :item_code, :description, :price, :available, :brand, :package_label, :category' . $barcodeInsertValue . ', :is_new, :is_active, :image_url, :thumbnail_url, :source_type, :product_payload, :created_by_user_id, :updated_by_user_id)
         ON DUPLICATE KEY UPDATE
            description = VALUES(description),
            price = VALUES(price),
            available = VALUES(available),
            brand = VALUES(brand),
            package_label = VALUES(package_label),
            category = VALUES(category),
            ' . $barcodeUpdate . '
            is_new = VALUES(is_new),
            is_active = VALUES(is_active),
            image_url = VALUES(image_url),
            thumbnail_url = VALUES(thumbnail_url),
            source_type = VALUES(source_type),
            product_payload = VALUES(product_payload),
            updated_by_user_id = VALUES(updated_by_user_id),
            updated_at = NOW()'
    );
    $params = [
        'catalog_id' => $catalogId,
        'item_code' => $item,
        'description' => $values['description'],
        'price' => $values['price'],
        'available' => $values['available'],
        'brand' => $values['brand'],
        'package_label' => $values['package_label'],
        'category' => $values['category'],
        'is_new' => $values['is_new'],
        'is_active' => $values['is_active'],
        'image_url' => $values['image_url'],
        'thumbnail_url' => $values['thumbnail_url'],
        'source_type' => $values['source_type'],
        'product_payload' => $values['product_payload'],
        'created_by_user_id' => current_user()['id'] ?? null,
        'updated_by_user_id' => current_user()['id'] ?? null,
    ];
    if ($hasBarcodeColumn) $params['barcode'] = $values['barcode'];
    $statement->execute($params);
    }

    foreach (['description', 'price', 'available', 'brand', 'package_label', 'category', 'barcode', 'is_new', 'is_active', 'image_url'] as $field) {
        $old = $previous[$field] ?? null;
        $new = (string) ($values[$field] ?? '');
        if ((string) ($old ?? '') === $new) continue;
        live_import_insert_history($catalogId, $item, $field, $old, $new);
    }
}

function live_import_upsert_barcode(int $catalogId, string $itemCode, string $barcode): void
{
    $barcode = live_import_clean_barcode($barcode);
    if ($catalogId <= 0 || $itemCode === '' || $barcode === '' || !admin_table_exists('catalog_product_barcodes')) {
        return;
    }
    db()->prepare(
        'INSERT INTO catalog_product_barcodes (catalog_id, item_code, barcode, created_by_user_id)
         VALUES (:catalog_id, :item_code, :barcode, :created_by_user_id)
         ON DUPLICATE KEY UPDATE item_code = VALUES(item_code), updated_at = NOW()'
    )->execute([
        'catalog_id' => $catalogId,
        'item_code' => $itemCode,
        'barcode' => $barcode,
        'created_by_user_id' => current_user()['id'] ?? null,
    ]);
}

function live_import_insert_history(int $catalogId, string $item, string $field, mixed $oldValue, mixed $newValue): void
{
    db()->prepare(
        'INSERT INTO catalog_product_live_edit_history (catalog_id, item_code, admin_user_id, field_name, old_value, new_value)
         VALUES (:catalog_id, :item_code, :admin_user_id, :field_name, :old_value, :new_value)'
    )->execute([
        'catalog_id' => $catalogId,
        'item_code' => $item,
        'admin_user_id' => current_user()['id'] ?? null,
        'field_name' => $field,
        'old_value' => $oldValue,
        'new_value' => $newValue,
    ]);
}

function live_import_parse_csv(string $path): array
{
    $handle = fopen($path, 'rb');
    if (!$handle) throw new RuntimeException('No se pudo abrir el CSV.');
    $firstLine = fgets($handle);
    if ($firstLine === false) {
        fclose($handle);
        throw new RuntimeException('El CSV esta vacio.');
    }
    $delimiter = substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';
    rewind($handle);
    $headers = fgetcsv($handle, 0, $delimiter);
    if (!is_array($headers)) {
        fclose($handle);
        throw new RuntimeException('No se pudo leer el encabezado.');
    }
    $headers = array_map('live_import_normalize_column', $headers);
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

function live_import_parse_xlsx(string $path): array
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('El servidor no tiene ZipArchive habilitado para leer XLSX. Usa CSV o habilita ZipArchive.');
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        throw new RuntimeException('No se pudo abrir el XLSX.');
    }
    try {
        $sharedStrings = live_import_xlsx_shared_strings($zip);
        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        if (!is_string($sheetXml) || $sheetXml === '') {
            throw new RuntimeException('No se encontro la primera hoja del XLSX.');
        }
        $xml = simplexml_load_string($sheetXml);
        if (!$xml) throw new RuntimeException('No se pudo leer la hoja XLSX.');
        $rows = [];
        foreach ($xml->sheetData->row as $rowNode) {
            $cells = [];
            foreach ($rowNode->c as $cell) {
                $ref = (string) ($cell['r'] ?? '');
                $columnIndex = live_import_xlsx_column_index($ref);
                $cells[$columnIndex] = live_import_xlsx_cell_value($cell, $sharedStrings);
            }
            if ($cells) {
                ksort($cells);
                $max = max(array_keys($cells));
                $rows[] = array_map(static fn(int $idx): string => $cells[$idx] ?? '', range(0, $max));
            }
        }
    } finally {
        $zip->close();
    }
    if (!$rows) throw new RuntimeException('El XLSX esta vacio.');
    $headers = array_map('live_import_normalize_column', array_shift($rows));
    $out = [];
    foreach ($rows as $data) {
        if (!array_filter($data, static fn($value): bool => trim((string) $value) !== '')) continue;
        $row = [];
        foreach ($headers as $index => $header) {
            if ($header === '') continue;
            $row[$header] = trim((string) ($data[$index] ?? ''));
        }
        $out[] = $row;
    }
    return $out;
}

function live_import_xlsx_shared_strings(ZipArchive $zip): array
{
    $xmlRaw = $zip->getFromName('xl/sharedStrings.xml');
    if (!is_string($xmlRaw) || $xmlRaw === '') return [];
    $xml = simplexml_load_string($xmlRaw);
    if (!$xml) return [];
    $strings = [];
    foreach ($xml->si as $si) {
        if (isset($si->t)) {
            $strings[] = (string) $si->t;
            continue;
        }
        $text = '';
        foreach ($si->r as $run) $text .= (string) $run->t;
        $strings[] = $text;
    }
    return $strings;
}

function live_import_xlsx_cell_value(SimpleXMLElement $cell, array $sharedStrings): string
{
    $type = (string) ($cell['t'] ?? '');
    $value = (string) ($cell->v ?? '');
    if ($type === 's') return (string) ($sharedStrings[(int) $value] ?? '');
    if ($type === 'inlineStr') return (string) ($cell->is->t ?? '');
    return $value;
}

function live_import_xlsx_column_index(string $ref): int
{
    $letters = preg_replace('/[^A-Z]/', '', strtoupper($ref)) ?: 'A';
    $index = 0;
    foreach (str_split($letters) as $letter) {
        $index = ($index * 26) + (ord($letter) - 64);
    }
    return max(0, $index - 1);
}

function live_import_base_products(array $catalog): array
{
    $json = live_import_read_catalog_json(live_import_catalog_json_full_path($catalog));
    foreach (['catalog', 'products', 'items'] as $key) {
        if (isset($json[$key]) && is_array($json[$key])) {
            return array_values(array_filter($json[$key], 'is_array'));
        }
    }
    return [];
}

function live_import_product_index(array $products): array
{
    $index = [];
    foreach ($products as $product) {
        $item = live_import_item_key((string) ($product['item'] ?? $product['item_code'] ?? ''));
        if ($item !== '' && !isset($index[$item])) $index[$item] = $product;
    }
    return $index;
}

function live_import_live_index(int $catalogId): array
{
    $stmt = db()->prepare('SELECT * FROM catalog_product_live_edits WHERE catalog_id = :catalog_id');
    $stmt->execute(['catalog_id' => $catalogId]);
    $index = [];
    foreach ($stmt->fetchAll() as $row) {
        $item = live_import_item_key((string) ($row['item_code'] ?? ''));
        if ($item !== '') $index[$item] = $row;
    }
    return $index;
}

function live_import_fetch_edit(int $catalogId, string $item): ?array
{
    $stmt = db()->prepare('SELECT * FROM catalog_product_live_edits WHERE catalog_id = :catalog_id AND item_code = :item_code LIMIT 1');
    $stmt->execute(['catalog_id' => $catalogId, 'item_code' => $item]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function live_import_catalog_json_full_path(array $catalog): string
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

function live_import_read_catalog_json(string $path): array
{
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) throw new RuntimeException('catalog.json no es valido.');
    return $decoded;
}

function live_import_product_payload(string $item, array $values): string
{
    $available = live_import_available_number((string) $values['available']);
    $package = (string) $values['package_label'];
    $product = [
        'item' => $item,
        'entry' => (string) ($values['entry'] ?? ''),
        'description' => (string) $values['description'],
        'shortDescription' => (string) $values['description'],
        'price' => (string) $values['price'],
        'originalPrice' => (string) $values['price'],
        'available' => (string) max(0, $available),
        'outOfStock' => $available > 0 ? 0 : 1,
        'agotado' => $available > 0 ? 0 : 1,
        'brand' => (string) $values['brand'],
        'category' => (string) ($values['category'] ?: 'General'),
        'barcode' => (string) ($values['barcode'] ?? ''),
        'cbarra' => (string) ($values['barcode'] ?? ''),
        'package' => $package,
        'empaque' => $package,
        'packageLabel' => $package,
        'packageQty' => max(1, live_import_available_number($package)),
        'saleUnit' => 'bulto',
        'minimumOrder' => 1,
        'multipleQty' => 1,
        'isNew' => (int) $values['is_new'],
        'is_new' => (int) $values['is_new'],
        'sourceType' => 'manual',
        'media' => ['gallery' => []],
    ];
    if ((string) $values['image_url'] !== '') {
        $product['image_url'] = (string) $values['image_url'];
        $product['imageUrl'] = (string) $values['image_url'];
        $product['media']['mainImage'] = (string) $values['image_url'];
        $product['media']['main_image'] = (string) $values['image_url'];
        $product['media']['mainImageCandidates'] = [(string) $values['image_url']];
        $product['media']['gallery'] = [(string) $values['image_url']];
    }
    return json_encode($product, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
}

function live_import_product_image_url(array $product): string
{
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    foreach ([$product['remote_image_url'] ?? '', $product['image_url'] ?? '', $product['imageUrl'] ?? '', $media['mainImage'] ?? ''] as $value) {
        $value = trim((string) $value);
        if ($value !== '') return $value;
    }
    return '';
}

function live_import_value(array $row, string $key, string $fallback): string
{
    return array_key_exists($key, $row) && trim((string) $row[$key]) !== '' ? live_import_clean_text((string) $row[$key]) : $fallback;
}

function live_import_price_value(array $row, string $fallback, string $priceMode = 'file'): string
{
    $raw = live_import_value($row, 'PRECIO', $fallback);
    if (live_import_normalize_price_mode($priceMode) !== 'factor_055') {
        return $raw;
    }
    $number = live_import_decimal_number($raw);
    if ($number === null) {
        return $raw;
    }
    return live_import_format_price($number * 0.55);
}

function live_import_decimal_number(string $value): ?float
{
    $clean = preg_replace('/[^0-9,.\-]+/', '', trim($value)) ?? '';
    if ($clean === '' || $clean === '-' || $clean === '.' || $clean === ',') {
        return null;
    }
    $lastComma = strrpos($clean, ',');
    $lastDot = strrpos($clean, '.');
    if ($lastComma !== false && $lastDot !== false) {
        $decimalSeparator = $lastComma > $lastDot ? ',' : '.';
        $thousandSeparator = $decimalSeparator === ',' ? '.' : ',';
        $clean = str_replace($thousandSeparator, '', $clean);
        $clean = str_replace($decimalSeparator, '.', $clean);
    } elseif ($lastComma !== false) {
        $clean = str_replace(',', '.', $clean);
    }
    return is_numeric($clean) ? (float) $clean : null;
}

function live_import_format_price(float $value): string
{
    return rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.');
}

function live_import_bool_value(array $row, string $key, int $fallback): int
{
    if (!array_key_exists($key, $row) || trim((string) $row[$key]) === '') return $fallback ? 1 : 0;
    $value = strtolower(trim((string) $row[$key]));
    return in_array($value, ['1', 'si', 'sí', 'yes', 'true', 'activo', 'active', 'nuevo', 'new'], true) ? 1 : 0;
}

function live_import_sample(array $row, string $item, string $status, string $priceMode = 'file'): array
{
    return [
        'item' => live_import_item_label($row, $item),
        'status' => $status,
        'entry' => (string) ($row['ENTRADA'] ?? ''),
        'description' => (string) ($row['DESCRIPCION'] ?? ''),
        'price' => live_import_price_value($row, '', $priceMode),
        'available' => (string) ($row['DISPONIBLE'] ?? ''),
        'brand' => (string) ($row['MARCA'] ?? ''),
        'category' => (string) ($row['CATEGORIA'] ?? ''),
    ];
}

function live_import_preview_dir(): string
{
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'catalog_live_imports';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) throw new RuntimeException('No se pudo preparar carpeta temporal.');
    return $dir;
}

function live_import_write_preview(string $token, array $preview): void
{
    start_app_session();
    $_SESSION['catalog_live_import_previews'][$token] = $preview;
    file_put_contents(live_import_preview_dir() . DIRECTORY_SEPARATOR . $token . '.json', json_encode($preview, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function live_import_read_preview(string $token): ?array
{
    if ($token === '') return null;
    $path = live_import_preview_dir() . DIRECTORY_SEPARATOR . $token . '.json';
    if (is_file($path)) {
        $decoded = json_decode((string) file_get_contents($path), true);
        if (is_array($decoded)) return $decoded;
    }
    start_app_session();
    $preview = $_SESSION['catalog_live_import_previews'][$token] ?? null;
    return is_array($preview) ? $preview : null;
}

function live_import_delete_preview(string $token): void
{
    $path = live_import_preview_dir() . DIRECTORY_SEPARATOR . $token . '.json';
    if (is_file($path)) @unlink($path);
    start_app_session();
    unset($_SESSION['catalog_live_import_previews'][$token]);
}

function live_import_normalize_column(string $value): string
{
    $value = strtoupper(trim(str_replace("\xEF\xBB\xBF", '', $value)));
    $value = strtr($value, ['Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N']);
    $value = preg_replace('/[^A-Z0-9]+/', '', $value) ?? $value;
    return match ($value) {
        'SKU', 'CODIGO', 'CODIGOITEM', 'ITEMCODE' => 'ITEM',
        'DESCRIPCION', 'DESCRIPCIONPRODUCTO', 'PRODUCTO', 'NOMBRE' => 'DESCRIPCION',
        'DISP', 'DISPONIBLE', 'STOCK', 'EXISTENCIA', 'CANTIDAD' => 'DISPONIBLE',
        'PRECIO', 'PRICE', 'PVP' => 'PRECIO',
        'MARCA', 'BRAND', 'FABRICANTE' => 'MARCA',
        'EMPAQUE', 'PAQUETE', 'PACK', 'PACKAGE' => 'EMPAQUE',
        'ENTRADA', 'ENTRY', 'LOTE', 'IMPORTACION', 'IMPORTACIONENTRADA' => 'ENTRADA',
        'CATEGORIA', 'CATEGORY', 'LINEA', 'FAMILIA', 'GRUPO' => 'CATEGORIA',
        'CBARRA', 'CB', 'CODIGOBARRA', 'CODIGOBARRAS', 'CODIGODEBARRA', 'CODIGODEBARRAS', 'BARCODE', 'EAN', 'UPC' => 'CBARRA',
        'ACTIVO', 'ESTADO', 'ACTIVE', 'STATUS' => 'ACTIVO',
        'MERCANCIANUEVA', 'NUEVO', 'ISNEW', 'NEW' => 'MERCANCIA_NUEVA',
        'URLIMAGEN', 'IMAGENURL', 'IMAGEURL', 'REMOTEIMAGEURL', 'REMOTEIMAGE', 'URLIMAGENPRINCIPAL' => 'IMAGE_URL',
        'THUMBNAILURL', 'URLMINIATURA', 'MINIATURAURL' => 'THUMBNAIL_URL',
        default => $value,
    };
}

function live_import_clean_text(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', strip_tags($value)) ?? '');
}

function live_import_clean_barcode(string $value): string
{
    $value = live_import_clean_text($value);
    $value = live_import_expand_scientific_barcode($value);
    return preg_replace('/[^A-Za-z0-9-]/', '', $value) ?? '';
}

function live_import_expand_scientific_barcode(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }
    $normalized = str_replace(',', '.', $value);
    if (preg_match('/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i', $normalized) === 1) {
        $number = (float) $normalized;
        if (is_finite($number)) {
            return sprintf('%.0F', $number);
        }
    }
    if (preg_match('/^\d+\.0+$/', $normalized) === 1) {
        return preg_replace('/\.0+$/', '', $normalized) ?? $normalized;
    }
    return $value;
}

function live_import_normalize_price_mode(string $value): string
{
    return $value === 'factor_055' ? 'factor_055' : 'file';
}

function live_import_price_mode_label(string $value): string
{
    return live_import_normalize_price_mode($value) === 'factor_055' ? 'Archivo x 0.55' : 'Precio del archivo';
}

function live_import_brand_key(string $value): string
{
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized) || $normalized === '') {
        $normalized = $value;
    }
    return preg_replace('/[^A-Z0-9]+/', '', strtoupper($normalized)) ?? '';
}

function live_import_entry_key(string $value): string
{
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized) || $normalized === '') {
        $normalized = $value;
    }
    return preg_replace('/[^A-Z0-9]+/', '', strtoupper($normalized)) ?? '';
}

function live_import_row_matches_brand(array $row, string $brandFilterKey, ?array $baseProduct = null, ?array $liveRow = null): bool
{
    if ($brandFilterKey === '') return true;
    $brand = live_import_brand_key((string) (($row['MARCA'] ?? '') ?: ($liveRow['brand'] ?? '') ?: ($baseProduct['brand'] ?? '')));
    return $brand !== '' && ($brand === $brandFilterKey || str_contains($brand, $brandFilterKey) || str_contains($brandFilterKey, $brand));
}

function live_import_row_matches_entry(array $row, string $entryFilterKey, ?array $baseProduct = null): bool
{
    if ($entryFilterKey === '') return true;
    $entry = live_import_entry_key((string) (($row['ENTRADA'] ?? '') ?: ($baseProduct['entry'] ?? '')));
    return $entry !== '' && ($entry === $entryFilterKey || str_contains($entry, $entryFilterKey) || str_contains($entryFilterKey, $entry));
}

function live_import_row_image_url(array $row): string
{
    return trim((string) ($row['IMAGE_URL'] ?? ''));
}

function live_import_live_image_url(?array $row): string
{
    if (!$row) return '';
    return trim((string) ($row['image_url'] ?? ''));
}

function live_import_missing_image_row(array $row, string $item): array
{
    return [
        'item' => live_import_item_label($row, $item),
        'entry' => (string) ($row['ENTRADA'] ?? ''),
        'description' => (string) ($row['DESCRIPCION'] ?? ''),
        'brand' => (string) ($row['MARCA'] ?? ''),
        'category' => (string) ($row['CATEGORIA'] ?? ''),
    ];
}

function live_import_store_uploaded_images(array $catalog): array
{
    if (empty($_FILES['product_images']) || !is_array($_FILES['product_images']['name'] ?? null)) {
        return [];
    }
    if (backblaze_upload_enabled() && !backblaze_upload_configured()) {
        throw new RuntimeException('Backblaze esta habilitado, pero faltan datos en catalogos_api/config.php.');
    }
    $jsonPath = live_import_catalog_json_full_path($catalog);
    $mediaDir = dirname($jsonPath) . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'live-imports';
    if (!backblaze_upload_enabled() && !is_dir($mediaDir) && !mkdir($mediaDir, 0775, true) && !is_dir($mediaDir)) {
        throw new RuntimeException('No se pudo crear carpeta media/live-imports.');
    }
    $map = [];
    $slug = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string) ($catalog['slug'] ?? 'catalogo')) ?: 'catalogo';
    $count = count($_FILES['product_images']['name']);
    for ($i = 0; $i < $count; $i++) {
        $error = (int) ($_FILES['product_images']['error'][$i] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) continue;
        if ($error !== UPLOAD_ERR_OK) throw new RuntimeException('No se pudo recibir una imagen.');
        $size = (int) ($_FILES['product_images']['size'][$i] ?? 0);
        if ($size <= 0 || $size > LIVE_PRODUCT_IMPORT_MAX_IMAGE_BYTES) throw new RuntimeException('Cada imagen debe pesar menos de 8 MB.');
        $name = basename((string) ($_FILES['product_images']['name'][$i] ?? ''));
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) throw new RuntimeException('Formato de imagen no permitido.');
        $item = live_import_item_key(pathinfo($name, PATHINFO_FILENAME));
        if ($item === '') continue;
        $tmp = (string) ($_FILES['product_images']['tmp_name'][$i] ?? '');
        if (!is_uploaded_file($tmp)) throw new RuntimeException('La subida de imagen no es valida.');
        $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
        if (backblaze_upload_enabled()) {
            $objectKey = 'catalogos/' . $slug . '/updates/' . $safeItem . '-import-' . date('YmdHis') . '-' . $i . '.' . $extension;
            $map[$item] = [
                'image_url' => backblaze_upload_file($tmp, $objectKey, live_import_image_content_type($extension)),
                'thumbnail_url' => '',
            ];
            continue;
        }
        $fileName = $safeItem . '-import-' . date('YmdHis') . '-' . $i . '.' . $extension;
        $target = $mediaDir . DIRECTORY_SEPARATOR . $fileName;
        if (!move_uploaded_file($tmp, $target)) throw new RuntimeException('No se pudo guardar una imagen.');
        $map[$item] = [
            'image_url' => './media/live-imports/' . $fileName,
            'thumbnail_url' => '',
        ];
    }
    return $map;
}

function live_import_image_content_type(string $extension): string
{
    return match (strtolower($extension)) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => 'application/octet-stream',
    };
}

function live_import_available_number(string $value): int
{
    $number = (int) preg_replace('/[^0-9-]+/', '', $value);
    return max(0, $number);
}

function live_import_item_key(string $value): string
{
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized) || $normalized === '') {
        $normalized = $value;
    }
    return preg_replace('/[^A-Z0-9]+/', '', strtoupper($normalized)) ?? '';
}

function live_import_item_label(array $row, string $fallback): string
{
    $raw = trim((string) ($row['ITEM'] ?? ''));
    return $raw !== '' ? $raw : $fallback;
}
