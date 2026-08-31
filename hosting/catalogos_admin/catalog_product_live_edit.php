<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_once dirname(__DIR__) . '/catalogos_api/backblaze_helpers.php';
admin_require_login(['admin', 'sales']);

const LIVE_PRODUCT_EDIT_MAX_IMAGE_BYTES = 8388608;

$catalogId = (int) ($_GET['catalog_id'] ?? $_POST['catalog_id'] ?? 0);
$itemQuery = live_product_item_key((string) ($_GET['item'] ?? $_POST['item'] ?? ''));
$catalog = $catalogId > 0 ? live_product_fetch_catalog($catalogId) : null;
$schemaReady = live_product_schema_ready();
$message = '';
$errorMessage = '';
$products = [];
$product = null;
$edit = null;
$duplicates = [];
$history = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    try {
        if (!$catalog) {
            throw new RuntimeException('Catalogo no encontrado.');
        }
        if (!$schemaReady) {
            throw new RuntimeException('Falta ejecutar hosting/sql/20260604_catalog_product_live_edits.sql.');
        }
        if (resolve_catalog_status($catalog) !== 'active') {
            throw new RuntimeException('Solo se pueden editar productos de catalogos activos.');
        }
        $result = live_product_save_edit($catalog);
        flash_set('success', ($result['created'] ? 'Producto manual creado: ITEM ' : 'Producto actualizado desde dashboard: ITEM ') . $result['item'] . '.');
        header('Location: catalog_product_live_edit.php?catalog_id=' . (int) $catalog['id'] . '&item=' . rawurlencode($result['item']));
        exit;
    } catch (Throwable $exception) {
        $errorMessage = $exception->getMessage();
    }
}

if ($catalog) {
    try {
        $json = live_product_read_catalog_json(live_product_catalog_json_full_path($catalog));
        $products = live_product_products($json);
        $duplicates = live_product_duplicate_items($products);
        if ($itemQuery !== '') {
            $product = live_product_find_product($products, $itemQuery);
            $edit = $schemaReady ? live_product_fetch_edit((int) $catalog['id'], $itemQuery) : null;
            if (!$product && $edit && (string) ($edit['source_type'] ?? '') === 'manual') {
                $product = live_product_manual_product_from_edit($edit);
            }
            $history = $schemaReady ? live_product_history((int) $catalog['id'], $itemQuery) : [];
        }
    } catch (Throwable $exception) {
        $errorMessage = $errorMessage !== '' ? $errorMessage : $exception->getMessage();
    }
}

admin_header('Editar producto vivo', 'catalogos.php');
?>
<section class="card">
    <div class="toolbar">
        <strong>Editar producto vivo</strong>
        <a class="button" href="catalogos.php">Volver</a>
    </div>

    <?php if (!$catalog): ?>
        <p class="muted">Catalogo no encontrado.</p>
    <?php elseif (!$schemaReady): ?>
        <div class="notice notice--warning" style="margin:16px 0;">
            Falta ejecutar <code>hosting/sql/20260604_catalog_product_live_edits.sql</code> y luego <code>hosting/sql/20260604_catalog_product_live_edits_phase2.sql</code>.
        </div>
    <?php else: ?>
        <p class="muted">Catalogo: <strong><?= html_escape($catalog['title'] ?? '') ?></strong> &middot; <code><?= html_escape($catalog['slug'] ?? '') ?></code></p>
        <p class="muted">Esta fase guarda cambios en MySQL y el API publico los aplica sobre el catalogo generado. No modifica Electron ni reescribe el catalog.json base.</p>

        <?php if ($message !== ''): ?>
            <div class="notice notice--success" style="margin:16px 0;"><?= html_escape($message) ?></div>
        <?php endif; ?>
        <?php if ($errorMessage !== ''): ?>
            <div class="notice notice--warning" style="margin:16px 0;"><?= html_escape($errorMessage) ?></div>
        <?php endif; ?>
        <?php if ($duplicates): ?>
            <div class="notice notice--warning" style="margin:16px 0;">
                Hay ITEM duplicados en el catalogo base. Revisa antes de editar: <code><?= html_escape(implode(', ', array_slice($duplicates, 0, 20))) ?></code>
            </div>
        <?php endif; ?>

        <form class="form-grid" method="get" style="margin-top:18px;">
            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
            <label>
                <span>Buscar ITEM/SKU</span>
                <input type="text" name="item" value="<?= html_escape((string) ($_GET['item'] ?? '')) ?>" required>
            </label>
            <div class="wide"><button class="button--primary" type="submit">Buscar producto</button></div>
        </form>
    <?php endif; ?>
</section>

<?php if ($catalog && $schemaReady && $itemQuery !== ''): ?>
<section class="card" style="margin-top:18px;">
    <div class="toolbar">
        <strong>ITEM <?= html_escape($itemQuery) ?></strong>
        <span class="pill"><?= $product ? 'Encontrado' : 'No encontrado' ?></span>
    </div>

    <?php if (!$product): ?>
        <p class="muted">No se encontro este ITEM en el catalogo base. Puedes crearlo manualmente en la capa viva MySQL sin regenerar desde Electron.</p>
        <form class="form-grid" method="post" enctype="multipart/form-data" onsubmit="return confirm('Confirmas crear este producto manual en el catalogo vivo?');">
            <?= csrf_field() ?>
            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
            <input type="hidden" name="item" value="<?= html_escape($itemQuery) ?>">
            <input type="hidden" name="source_type" value="manual">

            <label class="wide">
                <span>Descripcion</span>
                <input type="text" name="description" required>
            </label>
            <label>
                <span>Precio</span>
                <input type="text" name="price" required>
            </label>
            <label>
                <span>Cantidad disponible</span>
                <input type="text" name="available" value="1" required>
            </label>
            <label>
                <span>Marca</span>
                <input type="text" name="brand">
            </label>
            <label>
                <span>Empaque</span>
                <input type="text" name="package_label">
            </label>
            <label>
                <span>Categoria</span>
                <input type="text" name="category" value="General">
            </label>
            <label>
                <span>Estado</span>
                <select name="is_active">
                    <option value="1" selected>Activo</option>
                    <option value="0">Inactivo</option>
                </select>
            </label>
            <label class="check-row">
                <input type="checkbox" name="is_new" value="1">
                <span>Mercancia nueva</span>
            </label>
            <label class="wide">
                <span>URL imagen principal</span>
                <input type="url" name="image_url" placeholder="https://...">
            </label>
            <label class="wide">
                <span>Subir imagen nueva</span>
                <input type="file" name="product_image" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
            </label>
            <div class="wide"><button class="button--primary" type="submit">Crear producto manual</button></div>
        </form>
    <?php else: ?>
        <?php
            $values = live_product_form_values($product, $edit);
            $imagePreview = live_product_public_image_url($catalog, $values['image_url']);
        ?>
        <div class="table-wrap" style="margin:14px 0 18px;">
            <table>
                <thead><tr><th>Campo</th><th>Valor base</th><th>Valor vivo MySQL</th></tr></thead>
                <tbody>
                    <tr><td>Descripcion</td><td><?= html_escape($product['description'] ?? $product['shortDescription'] ?? '') ?></td><td><?= html_escape((string) ($edit['description'] ?? '')) ?></td></tr>
                    <tr><td>Precio</td><td><?= html_escape($product['price'] ?? '') ?></td><td><?= html_escape((string) ($edit['price'] ?? '')) ?></td></tr>
                    <tr><td>Disponible</td><td><?= html_escape($product['available'] ?? $product['disponible'] ?? '') ?></td><td><?= html_escape((string) ($edit['available'] ?? '')) ?></td></tr>
                    <tr><td>Marca</td><td><?= html_escape($product['brand'] ?? '') ?></td><td><?= html_escape((string) ($edit['brand'] ?? '')) ?></td></tr>
                    <tr><td>Empaque</td><td><?= html_escape($product['package'] ?? $product['empaque'] ?? '') ?></td><td><?= html_escape((string) ($edit['package_label'] ?? '')) ?></td></tr>
                    <tr><td>Categoria</td><td><?= html_escape($product['category'] ?? '') ?></td><td><?= html_escape((string) ($edit['category'] ?? '')) ?></td></tr>
                    <tr><td>Estado</td><td><?= (string) ($edit['source_type'] ?? '') === 'manual' ? 'Manual MySQL' : 'Activo por catalogo base' ?></td><td><?= (int) ($edit['is_active'] ?? 1) === 1 ? 'Activo' : 'Inactivo' ?></td></tr>
                </tbody>
            </table>
        </div>

        <form class="form-grid" method="post" enctype="multipart/form-data" onsubmit="return confirm('Confirmas guardar esta edicion viva del producto?');">
            <?= csrf_field() ?>
            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
            <input type="hidden" name="item" value="<?= html_escape($itemQuery) ?>">

            <label class="wide">
                <span>Descripcion</span>
                <input type="text" name="description" value="<?= html_escape($values['description']) ?>" required>
            </label>
            <label>
                <span>Precio</span>
                <input type="text" name="price" value="<?= html_escape($values['price']) ?>" required>
            </label>
            <label>
                <span>Cantidad disponible</span>
                <input type="text" name="available" value="<?= html_escape($values['available']) ?>" required>
            </label>
            <label>
                <span>Marca</span>
                <input type="text" name="brand" value="<?= html_escape($values['brand']) ?>">
            </label>
            <label>
                <span>Empaque</span>
                <input type="text" name="package_label" value="<?= html_escape($values['package_label']) ?>">
            </label>
            <label>
                <span>Categoria</span>
                <input type="text" name="category" value="<?= html_escape($values['category']) ?>">
            </label>
            <label>
                <span>Estado</span>
                <select name="is_active">
                    <option value="1" <?= $values['is_active'] ? 'selected' : '' ?>>Activo</option>
                    <option value="0" <?= !$values['is_active'] ? 'selected' : '' ?>>Inactivo</option>
                </select>
            </label>
            <label class="check-row">
                <input type="checkbox" name="is_new" value="1" <?= $values['is_new'] ? 'checked' : '' ?>>
                <span>Mercancia nueva</span>
            </label>
            <label class="wide">
                <span>URL imagen principal</span>
                <input type="url" name="image_url" value="<?= html_escape($values['image_url']) ?>" placeholder="https://...">
            </label>
            <label class="wide">
                <span>Subir imagen nueva</span>
                <input type="file" name="product_image" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
                <small>Opcional. Si subes una imagen, reemplaza la URL anterior en la capa viva.</small>
            </label>

            <?php if ($imagePreview !== ''): ?>
                <div class="wide">
                    <img src="<?= html_escape($imagePreview) ?>" alt="" style="width:120px;height:120px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fff;">
                </div>
            <?php endif; ?>

            <div class="wide"><button class="button--primary" type="submit">Guardar producto vivo</button></div>
        </form>
    <?php endif; ?>
</section>
<?php endif; ?>

<?php if ($history): ?>
<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Historial del ITEM</strong><span class="pill"><?= count($history) ?> cambios</span></div>
    <div class="table-wrap" style="margin-top:14px;">
        <table>
            <thead><tr><th>Fecha</th><th>Campo</th><th>Anterior</th><th>Nuevo</th><th>Usuario</th></tr></thead>
            <tbody>
            <?php foreach ($history as $row): ?>
                <tr>
                    <td><?= html_escape($row['created_at'] ?? '') ?></td>
                    <td><?= html_escape($row['field_name'] ?? '') ?></td>
                    <td><?= html_escape((string) ($row['old_value'] ?? '')) ?></td>
                    <td><?= html_escape((string) ($row['new_value'] ?? '')) ?></td>
                    <td><?= html_escape($row['admin_name'] ?? 'Sistema') ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<?php endif; ?>

<?php admin_footer(); ?>

<?php
function live_product_fetch_catalog(int $catalogId): ?array
{
    if (!admin_table_exists('catalogs')) return null;
    $stmt = db()->prepare('SELECT * FROM catalogs WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $catalogId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function live_product_schema_ready(): bool
{
    return admin_table_exists('catalog_product_live_edits')
        && admin_table_exists('catalog_product_live_edit_history')
        && admin_column_exists('catalog_product_live_edits', 'brand')
        && admin_column_exists('catalog_product_live_edits', 'package_label')
        && admin_column_exists('catalog_product_live_edits', 'category')
        && admin_column_exists('catalog_product_live_edits', 'is_new')
        && admin_column_exists('catalog_product_live_edits', 'source_type')
        && admin_column_exists('catalog_product_live_edits', 'product_payload');
}

function live_product_save_edit(array $catalog): array
{
    $catalogId = (int) $catalog['id'];
    $item = live_product_item_key((string) ($_POST['item'] ?? ''));
    if ($item === '') {
        throw new RuntimeException('Debes indicar un ITEM.');
    }

    $json = live_product_read_catalog_json(live_product_catalog_json_full_path($catalog));
    $products = live_product_products($json);
    $duplicates = live_product_duplicate_items($products);
    $baseProduct = live_product_find_product($products, $item);
    $previous = live_product_fetch_edit($catalogId, $item);
    $isManualRequest = (string) ($_POST['source_type'] ?? '') === 'manual';
    if (in_array($item, $duplicates, true)) {
        throw new RuntimeException('Este ITEM esta duplicado en el catalogo base. Corrige el origen antes de editarlo desde dashboard.');
    }
    if (!$baseProduct && !$isManualRequest && (string) ($previous['source_type'] ?? '') !== 'manual') {
        throw new RuntimeException('No se encontro el ITEM en este catalogo.');
    }
    if ($isManualRequest && $baseProduct) {
        throw new RuntimeException('Este ITEM ya existe en el catalogo base. Usa la edicion normal para evitar duplicados.');
    }
    if ($isManualRequest && $previous) {
        throw new RuntimeException('Este ITEM ya existe en la capa viva. Busca el ITEM para editarlo.');
    }

    $description = live_product_clean_text((string) ($_POST['description'] ?? ''));
    $price = live_product_clean_text((string) ($_POST['price'] ?? ''));
    $available = live_product_clean_text((string) ($_POST['available'] ?? ''));
    $brand = live_product_clean_text((string) ($_POST['brand'] ?? ''));
    $packageLabel = live_product_clean_text((string) ($_POST['package_label'] ?? ''));
    $category = live_product_clean_text((string) ($_POST['category'] ?? ''));
    $isNew = isset($_POST['is_new']) ? 1 : 0;
    if ($description === '' || $price === '' || $available === '') {
        throw new RuntimeException('Descripcion, precio y cantidad son obligatorios.');
    }

    $imageUrl = trim((string) ($_POST['image_url'] ?? ''));
    if ($imageUrl !== '' && !preg_match('#^https?://#i', $imageUrl) && !str_starts_with($imageUrl, './')) {
        throw new RuntimeException('La imagen debe ser URL http(s) o una ruta relativa ./ del catalogo.');
    }
    $thumbnailUrl = '';
    $upload = live_product_save_uploaded_image($catalog, $item);
    if ($upload['image_url'] !== '') {
        $imageUrl = $upload['image_url'];
        $thumbnailUrl = $upload['thumbnail_url'];
    }

    $isActive = (int) ($_POST['is_active'] ?? 1) === 1 ? 1 : 0;
    $sourceType = $isManualRequest || (string) ($previous['source_type'] ?? '') === 'manual' ? 'manual' : 'override';
    $productPayload = $sourceType === 'manual' ? live_product_payload_json([
        'item' => $item,
        'description' => $description,
        'price' => $price,
        'available' => $available,
        'brand' => $brand,
        'package_label' => $packageLabel,
        'category' => $category,
        'is_new' => $isNew,
        'image_url' => $imageUrl,
        'thumbnail_url' => $thumbnailUrl,
    ]) : null;
    $previousValues = [
        'description' => $previous['description'] ?? null,
        'price' => $previous['price'] ?? null,
        'available' => $previous['available'] ?? null,
        'brand' => $previous['brand'] ?? null,
        'package_label' => $previous['package_label'] ?? null,
        'category' => $previous['category'] ?? null,
        'is_new' => isset($previous['is_new']) ? (string) (int) $previous['is_new'] : null,
        'is_active' => isset($previous['is_active']) ? (string) (int) $previous['is_active'] : null,
        'image_url' => $previous['image_url'] ?? null,
    ];
    $newValues = [
        'description' => $description,
        'price' => $price,
        'available' => $available,
        'brand' => $brand,
        'package_label' => $packageLabel,
        'category' => $category,
        'is_new' => (string) $isNew,
        'is_active' => (string) $isActive,
        'image_url' => $imageUrl,
    ];

    $userId = current_user()['id'] ?? null;
    db()->prepare(
        'INSERT INTO catalog_product_live_edits
            (catalog_id, item_code, description, price, available, brand, package_label, category, is_new, is_active, image_url, thumbnail_url, source_type, product_payload, created_by_user_id, updated_by_user_id)
         VALUES
            (:catalog_id, :item_code, :description, :price, :available, :brand, :package_label, :category, :is_new, :is_active, :image_url, :thumbnail_url, :source_type, :product_payload, :created_by_user_id, :updated_by_user_id)
         ON DUPLICATE KEY UPDATE
            description = VALUES(description),
            price = VALUES(price),
            available = VALUES(available),
            brand = VALUES(brand),
            package_label = VALUES(package_label),
            category = VALUES(category),
            is_new = VALUES(is_new),
            is_active = VALUES(is_active),
            image_url = VALUES(image_url),
            thumbnail_url = VALUES(thumbnail_url),
            source_type = VALUES(source_type),
            product_payload = VALUES(product_payload),
            updated_by_user_id = VALUES(updated_by_user_id),
            updated_at = NOW()'
    )->execute([
        'catalog_id' => $catalogId,
        'item_code' => $item,
        'description' => $description,
        'price' => $price,
        'available' => $available,
        'brand' => $brand,
        'package_label' => $packageLabel,
        'category' => $category,
        'is_new' => $isNew,
        'is_active' => $isActive,
        'image_url' => $imageUrl,
        'thumbnail_url' => $thumbnailUrl,
        'source_type' => $sourceType,
        'product_payload' => $productPayload,
        'created_by_user_id' => $userId,
        'updated_by_user_id' => $userId,
    ]);

    foreach ($newValues as $field => $newValue) {
        $oldValue = $previousValues[$field] ?? null;
        if ((string) ($oldValue ?? '') === (string) $newValue) {
            continue;
        }
        live_product_insert_history($catalogId, $item, $field, $oldValue, $newValue);
    }
    if (admin_column_exists('catalogs', 'updated_at')) {
        db()->prepare('UPDATE catalogs SET updated_at = NOW() WHERE id = :id')->execute(['id' => $catalogId]);
    }
    audit_log('catalog.product_live_edited', 'catalogs', $catalogId, [
        'item' => $item,
        'fields' => array_keys($newValues),
        'source_type' => $sourceType,
    ]);

    return ['item' => $item, 'created' => !$previous && $sourceType === 'manual'];
}

function live_product_insert_history(int $catalogId, string $item, string $field, mixed $oldValue, mixed $newValue): void
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

function live_product_fetch_edit(int $catalogId, string $item): ?array
{
    $stmt = db()->prepare('SELECT * FROM catalog_product_live_edits WHERE catalog_id = :catalog_id AND item_code = :item_code LIMIT 1');
    $stmt->execute(['catalog_id' => $catalogId, 'item_code' => $item]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function live_product_history(int $catalogId, string $item): array
{
    $joinUsers = admin_table_exists('catalog_users') ? 'LEFT JOIN catalog_users u ON u.id = h.admin_user_id' : '';
    $userSelect = admin_table_exists('catalog_users') ? 'COALESCE(u.full_name, u.username, "") AS admin_name' : '"" AS admin_name';
    $stmt = db()->prepare(
        "SELECT h.*, {$userSelect}
         FROM catalog_product_live_edit_history h
         {$joinUsers}
         WHERE h.catalog_id = :catalog_id AND h.item_code = :item_code
         ORDER BY h.created_at DESC, h.id DESC
         LIMIT 80"
    );
    $stmt->execute(['catalog_id' => $catalogId, 'item_code' => $item]);
    return $stmt->fetchAll();
}

function live_product_form_values(array $product, ?array $edit): array
{
    return [
        'description' => (string) ($edit['description'] ?? $product['description'] ?? $product['shortDescription'] ?? ''),
        'price' => (string) ($edit['price'] ?? $product['price'] ?? ''),
        'available' => (string) ($edit['available'] ?? $product['available'] ?? $product['disponible'] ?? ''),
        'brand' => (string) ($edit['brand'] ?? $product['brand'] ?? ''),
        'package_label' => (string) ($edit['package_label'] ?? $product['package'] ?? $product['empaque'] ?? $product['packageLabel'] ?? ''),
        'category' => (string) ($edit['category'] ?? $product['category'] ?? ''),
        'is_new' => (int) ($edit['is_new'] ?? $product['isNew'] ?? $product['is_new'] ?? 0) === 1,
        'is_active' => (int) ($edit['is_active'] ?? 1) === 1,
        'image_url' => (string) ($edit['image_url'] ?? live_product_product_image_url($product)),
    ];
}

function live_product_manual_product_from_edit(array $edit): array
{
    $payload = json_decode((string) ($edit['product_payload'] ?? ''), true);
    if (is_array($payload) && $payload) {
        $product = $payload;
    } else {
        $product = [];
    }
    $product['item'] = (string) ($edit['item_code'] ?? $product['item'] ?? '');
    $product['description'] = (string) ($edit['description'] ?? $product['description'] ?? $product['item']);
    $product['shortDescription'] = $product['description'];
    $product['price'] = (string) ($edit['price'] ?? $product['price'] ?? '');
    $product['available'] = (string) ($edit['available'] ?? $product['available'] ?? '0');
    $product['brand'] = (string) ($edit['brand'] ?? $product['brand'] ?? '');
    $product['category'] = (string) ($edit['category'] ?? $product['category'] ?? 'General');
    $package = (string) ($edit['package_label'] ?? $product['package'] ?? '');
    $product['package'] = $package;
    $product['empaque'] = $package;
    $product['packageLabel'] = $package;
    $product['isNew'] = (int) ($edit['is_new'] ?? 0);
    $product['is_new'] = (int) ($edit['is_new'] ?? 0);
    $product['sourceType'] = 'manual';
    return $product;
}

function live_product_payload_json(array $values): string
{
    $available = live_product_available_number((string) $values['available']);
    $package = (string) $values['package_label'];
    $product = [
        'item' => (string) $values['item'],
        'description' => (string) $values['description'],
        'shortDescription' => (string) $values['description'],
        'price' => (string) $values['price'],
        'originalPrice' => (string) $values['price'],
        'available' => (string) max(0, $available),
        'outOfStock' => $available > 0 ? 0 : 1,
        'agotado' => $available > 0 ? 0 : 1,
        'brand' => (string) $values['brand'],
        'category' => (string) ($values['category'] ?: 'General'),
        'package' => $package,
        'empaque' => $package,
        'packageLabel' => $package,
        'packageQty' => max(1, live_product_available_number($package)),
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
    if ((string) $values['thumbnail_url'] !== '') {
        $product['thumbnail_url'] = (string) $values['thumbnail_url'];
        $product['thumbnailUrl'] = (string) $values['thumbnail_url'];
        $product['media']['thumbnail'] = (string) $values['thumbnail_url'];
        $product['media']['cardImage'] = (string) $values['thumbnail_url'];
        $product['media']['cardImageCandidates'] = [(string) $values['thumbnail_url'], (string) $values['image_url']];
    }

    return json_encode($product, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
}

function live_product_save_uploaded_image(array $catalog, string $item): array
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
    if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > LIVE_PRODUCT_EDIT_MAX_IMAGE_BYTES) {
        throw new RuntimeException('La imagen debe pesar menos de 8 MB.');
    }
    $extension = strtolower(pathinfo(basename((string) ($file['name'] ?? 'imagen.jpg')), PATHINFO_EXTENSION));
    if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) {
        throw new RuntimeException('Formato no permitido. Usa JPG, PNG o WEBP.');
    }
    if (!is_uploaded_file((string) ($file['tmp_name'] ?? ''))) {
        throw new RuntimeException('La subida de imagen no es valida.');
    }
    if (backblaze_upload_enabled()) {
        if (!backblaze_upload_configured()) {
            throw new RuntimeException('Backblaze esta habilitado, pero faltan datos en catalogos_api/config.php.');
        }
        $slug = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string) ($catalog['slug'] ?? 'catalogo')) ?: 'catalogo';
        $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
        $contentType = match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };
        $objectKey = 'catalogos/' . $slug . '/live-edits/' . $safeItem . '-' . date('YmdHis') . '.' . $extension;
        return ['image_url' => backblaze_upload_file((string) $file['tmp_name'], $objectKey, $contentType), 'thumbnail_url' => ''];
    }

    $jsonPath = live_product_catalog_json_full_path($catalog);
    $mediaDir = dirname($jsonPath) . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . 'live-edits';
    if (!is_dir($mediaDir) && !mkdir($mediaDir, 0775, true) && !is_dir($mediaDir)) {
        throw new RuntimeException('No se pudo crear carpeta media/live-edits.');
    }
    $safeItem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $item) ?: 'item';
    $fileName = $safeItem . '-' . date('YmdHis') . '.' . $extension;
    if (!move_uploaded_file((string) $file['tmp_name'], $mediaDir . DIRECTORY_SEPARATOR . $fileName)) {
        throw new RuntimeException('No se pudo guardar la imagen.');
    }

    return ['image_url' => './media/live-edits/' . $fileName, 'thumbnail_url' => ''];
}

function live_product_catalog_json_full_path(array $catalog): string
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

function live_product_read_catalog_json(string $path): array
{
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) throw new RuntimeException('catalog.json no es valido.');
    return $decoded;
}

function live_product_products(array $json): array
{
    foreach (['catalog', 'products', 'items'] as $key) {
        if (isset($json[$key]) && is_array($json[$key])) {
            return array_values(array_filter($json[$key], 'is_array'));
        }
    }
    return [];
}

function live_product_find_product(array $products, string $item): ?array
{
    foreach ($products as $product) {
        if (live_product_item_key((string) ($product['item'] ?? $product['item_code'] ?? '')) === $item) {
            return $product;
        }
    }
    return null;
}

function live_product_duplicate_items(array $products): array
{
    $seen = [];
    $duplicates = [];
    foreach ($products as $product) {
        $item = live_product_item_key((string) ($product['item'] ?? $product['item_code'] ?? ''));
        if ($item === '') continue;
        if (isset($seen[$item])) {
            $duplicates[$item] = true;
        }
        $seen[$item] = true;
    }
    return array_keys($duplicates);
}

function live_product_product_image_url(array $product): string
{
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    $values = [
        $product['remote_image_url'] ?? '',
        $product['remoteImageUrl'] ?? '',
        $product['image_url'] ?? '',
        $product['imageUrl'] ?? '',
        $media['mainImage'] ?? '',
        $media['main_image'] ?? '',
        $media['cardImage'] ?? '',
    ];
    foreach ($values as $value) {
        $value = trim((string) $value);
        if ($value !== '') return $value;
    }
    return '';
}

function live_product_public_image_url(array $catalog, string $imageUrl): string
{
    $imageUrl = trim($imageUrl);
    if ($imageUrl === '' || preg_match('#^https?://#i', $imageUrl)) {
        return $imageUrl;
    }
    if (!str_starts_with($imageUrl, './')) {
        return '';
    }
    $publicUrl = trim((string) ($catalog['public_url'] ?? ''));
    if ($publicUrl === '') {
        return $imageUrl;
    }
    $baseUrl = str_ends_with($publicUrl, '/') ? rtrim($publicUrl, '/') : rtrim(dirname($publicUrl), '/');
    return $baseUrl . '/' . ltrim(substr($imageUrl, 2), '/');
}

function live_product_clean_text(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', $value) ?? '');
}

function live_product_available_number(string $value): int
{
    $number = (int) preg_replace('/[^0-9-]+/', '', $value);
    return max(0, $number);
}

function live_product_item_key(string $value): string
{
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized) || $normalized === '') {
        $normalized = $value;
    }

    return preg_replace('/[^A-Z0-9]+/', '', strtoupper($normalized)) ?? '';
}
