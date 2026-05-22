<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login();

$hasCatalogs = admin_table_exists('catalogs');
$hasEvents = admin_table_exists('catalog_behavior_events');
$hasOrders = admin_table_exists('orders');
$hasOrderItems = admin_table_exists('order_items');

if (!$hasCatalogs) {
    admin_header('Reportes productos', 'reportes_productos.php');
    echo '<section class="card"><strong>Falta la tabla de catalogos.</strong><p class="muted">Ejecuta la migracion SQL antes de usar reportes.</p></section>';
    admin_footer();
    exit;
}

$publicUrlSelect = admin_column_exists('catalogs', 'public_url') ? 'public_url' : "'' AS public_url";
$jsonPathSelect = admin_column_exists('catalogs', 'catalog_json_path') ? 'catalog_json_path' : "'' AS catalog_json_path";
$catalogs = db()->query(
    "SELECT id, slug, title, {$publicUrlSelect}, {$jsonPathSelect}
     FROM catalogs
     ORDER BY id DESC
     LIMIT 300"
)->fetchAll();

$selectedCatalogId = (int) ($_GET['catalog_id'] ?? ($catalogs[0]['id'] ?? 0));
$days = (int) ($_GET['days'] ?? 30);
if (!in_array($days, [7, 30, 90, 365], true)) {
    $days = 30;
}
$reportType = (string) ($_GET['type'] ?? 'combined');
if (!in_array($reportType, ['combined', 'views', 'purchases'], true)) {
    $reportType = 'combined';
}

$selectedCatalog = null;
foreach ($catalogs as $catalog) {
    if ((int) $catalog['id'] === $selectedCatalogId) {
        $selectedCatalog = $catalog;
        break;
    }
}

$rows = $selectedCatalog ? build_product_report_rows($selectedCatalog, $days, $reportType, $hasEvents, $hasOrders, $hasOrderItems) : [];

if (($_GET['export'] ?? '') === 'xls' && $selectedCatalog) {
    output_product_report_xls($selectedCatalog, $rows, $days, $reportType);
}

admin_header('Reportes productos', 'reportes_productos.php');
?>
<section class="card" style="margin-bottom:18px;">
    <div class="toolbar"><strong>Reporte de productos</strong><span class="pill">vistas y compras</span></div>
    <form class="form-grid" method="get">
        <label class="wide">
            <span>Catalogo</span>
            <select name="catalog_id">
                <?php foreach ($catalogs as $catalog): ?>
                    <option value="<?= (int) $catalog['id'] ?>" <?= (int) $catalog['id'] === $selectedCatalogId ? 'selected' : '' ?>>
                        <?= html_escape(($catalog['title'] ?? '') . ' - ' . ($catalog['slug'] ?? '')) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </label>
        <label>
            <span>Periodo</span>
            <select name="days">
                <?php foreach ([7, 30, 90, 365] as $option): ?>
                    <option value="<?= $option ?>" <?= $days === $option ? 'selected' : '' ?>><?= $option ?> dias</option>
                <?php endforeach; ?>
            </select>
        </label>
        <label>
            <span>Tipo</span>
            <select name="type">
                <option value="combined" <?= $reportType === 'combined' ? 'selected' : '' ?>>Mas vistos y comprados</option>
                <option value="views" <?= $reportType === 'views' ? 'selected' : '' ?>>Mas vistos</option>
                <option value="purchases" <?= $reportType === 'purchases' ? 'selected' : '' ?>>Mas comprados</option>
            </select>
        </label>
        <div class="wide toolbar__actions">
            <button class="button--primary" type="submit">Aplicar</button>
            <a class="button" href="reportes_productos.php?<?= html_escape(http_build_query(['catalog_id' => $selectedCatalogId, 'days' => $days, 'type' => $reportType, 'export' => 'xls'])) ?>">Exportar Excel</a>
            <a class="button" href="inteligencia.php">Volver a inteligencia</a>
        </div>
    </form>
</section>

<section class="card">
    <div class="toolbar"><strong>Vista previa</strong><span class="pill"><?= count($rows) ?> productos</span></div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Imagen</th><th>Producto</th><th>Marca</th><th>Categoria</th><th>Empaque</th><th>Vistas</th><th>Comprado</th><th>Total</th><th>Ultima vista</th></tr></thead>
            <tbody>
            <?php foreach ($rows as $row): ?>
                <tr>
                    <td><?php if ($row['image_url'] !== ''): ?><img src="<?= html_escape($row['image_url']) ?>" alt="" style="width:58px;height:58px;object-fit:contain;background:#fff;border-radius:8px;"><?php else: ?><span class="muted">Sin imagen</span><?php endif; ?></td>
                    <td><strong><?= html_escape($row['item_code']) ?></strong><div class="muted"><?= html_escape($row['description']) ?></div></td>
                    <td><?= html_escape($row['brand']) ?></td>
                    <td><?= html_escape($row['category']) ?></td>
                    <td><?= html_escape($row['package_label']) ?><div class="muted"><?= html_escape($row['package_qty']) ?> pz/bulto</div></td>
                    <td><?= (int) $row['views_count'] ?></td>
                    <td><?= html_escape($row['ordered_qty']) ?></td>
                    <td>US$ <?= html_escape(number_format((float) $row['ordered_total'], 2)) ?></td>
                    <td><?= html_escape($row['last_viewed_at']) ?></td>
                </tr>
            <?php endforeach; ?>
            <?php if (!$rows): ?>
                <tr><td colspan="9" class="empty-table">No hay datos para este filtro todavia.</td></tr>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
</section>
<?php admin_footer(); ?>

<?php
function build_product_report_rows(array $catalog, int $days, string $type, bool $hasEvents, bool $hasOrders, bool $hasOrderItems): array
{
    $products = catalog_report_products($catalog);
    $views = $hasEvents ? catalog_report_views((int) $catalog['id'], $days) : [];
    $purchases = ($hasOrders && $hasOrderItems) ? catalog_report_purchases((int) $catalog['id'], $days) : [];
    $itemCodes = array_unique(array_merge(array_keys($products), array_keys($views), array_keys($purchases)));
    $rows = [];

    foreach ($itemCodes as $itemCode) {
        $product = $products[$itemCode] ?? [];
        $view = $views[$itemCode] ?? [];
        $purchase = $purchases[$itemCode] ?? [];
        $viewsCount = (int) ($view['views_count'] ?? 0);
        $orderedQty = (float) ($purchase['ordered_qty'] ?? 0);
        if ($type === 'views' && $viewsCount <= 0) continue;
        if ($type === 'purchases' && $orderedQty <= 0) continue;
        $rows[] = [
            'item_code' => $itemCode,
            'description' => (string) ($product['description'] ?? $view['item_name'] ?? $purchase['description'] ?? ''),
            'brand' => (string) ($product['brand'] ?? ''),
            'category' => (string) ($product['category'] ?? $view['category'] ?? ''),
            'package_label' => (string) ($product['package_label'] ?? $product['package'] ?? ''),
            'package_qty' => (string) ($product['package_qty'] ?? ''),
            'image_url' => (string) ($product['image_url'] ?? ''),
            'views_count' => $viewsCount,
            'ordered_qty' => number_format($orderedQty, 2),
            'orders_count' => (int) ($purchase['orders_count'] ?? 0),
            'ordered_total' => (float) ($purchase['ordered_total'] ?? 0),
            'last_viewed_at' => (string) ($view['last_viewed_at'] ?? ''),
        ];
    }

    usort($rows, static function (array $a, array $b) use ($type): int {
        if ($type === 'views') return $b['views_count'] <=> $a['views_count'];
        if ($type === 'purchases') return $b['ordered_total'] <=> $a['ordered_total'];
        return (($b['views_count'] * 2) + (float) $b['ordered_total']) <=> (($a['views_count'] * 2) + (float) $a['ordered_total']);
    });

    return array_slice($rows, 0, 250);
}

function catalog_report_views(int $catalogId, int $days): array
{
    $statement = db()->prepare(
        "SELECT item_code, MAX(item_name) AS item_name, MAX(category) AS category,
                COUNT(*) AS views_count, MAX(created_at) AS last_viewed_at
         FROM catalog_behavior_events
         WHERE catalog_id = :catalog_id
           AND event_type = 'product_detail'
           AND item_code <> ''
           AND created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)
         GROUP BY item_code"
    );
    $statement->execute(['catalog_id' => $catalogId]);
    return rows_by_item_code($statement->fetchAll());
}

function catalog_report_purchases(int $catalogId, int $days): array
{
    $catalogFilter = admin_column_exists('orders', 'catalog_id') ? 'AND o.catalog_id = :catalog_id' : '';
    $qtyExpr = admin_column_exists('order_items', 'quantity') ? 'SUM(oi.quantity)' : '0';
    $totalExpr = admin_column_exists('order_items', 'line_total') ? 'SUM(oi.line_total)' : '0';
    $descriptionExpr = admin_column_exists('order_items', 'description') ? 'MAX(oi.description)' : "''";
    $statement = db()->prepare(
        "SELECT oi.item_code, {$descriptionExpr} AS description,
                {$qtyExpr} AS ordered_qty,
                {$totalExpr} AS ordered_total,
                COUNT(DISTINCT oi.order_id) AS orders_count
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE oi.item_code <> ''
           {$catalogFilter}
           AND o.created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)
         GROUP BY oi.item_code"
    );
    $params = $catalogFilter !== '' ? ['catalog_id' => $catalogId] : [];
    $statement->execute($params);
    return rows_by_item_code($statement->fetchAll());
}

function rows_by_item_code(array $rows): array
{
    $indexed = [];
    foreach ($rows as $row) {
        $itemCode = trim((string) ($row['item_code'] ?? ''));
        if ($itemCode !== '') $indexed[$itemCode] = $row;
    }
    return $indexed;
}

function catalog_report_products(array $catalog): array
{
    $metadata = catalog_json_data((string) ($catalog['catalog_json_path'] ?? ''));
    $publicUrl = (string) ($catalog['public_url'] ?? '');
    $products = [];
    foreach (($metadata['catalog'] ?? []) as $product) {
        if (!is_array($product)) continue;
        $itemCode = trim((string) ($product['item'] ?? ''));
        if ($itemCode === '') continue;
        $products[$itemCode] = [
            'description' => (string) ($product['description'] ?? $product['shortDescription'] ?? ''),
            'brand' => (string) ($product['brand'] ?? ''),
            'category' => (string) ($product['smartCategory'] ?? $product['category'] ?? ''),
            'package_label' => (string) ($product['packageLabel'] ?? $product['package'] ?? $product['empaque'] ?? ''),
            'package_qty' => (string) ($product['packageQty'] ?? ''),
            'image_url' => catalog_report_product_image_url($product, $publicUrl),
        ];
    }
    return $products;
}

function catalog_report_product_image_url(array $product, string $publicUrl): string
{
    $media = is_array($product['media'] ?? null) ? $product['media'] : [];
    $candidates = [
        $product['thumbnail_url'] ?? '',
        $product['remoteImageUrl'] ?? '',
        $product['remote_image_url'] ?? '',
        $media['thumbnail'] ?? '',
        $media['mainImage'] ?? '',
        $media['remote_image_url'] ?? '',
    ];
    if (!empty($media['mainImageCandidates']) && is_array($media['mainImageCandidates'])) {
        $candidates = array_merge($candidates, $media['mainImageCandidates']);
    }
    foreach ($candidates as $candidate) {
        $url = trim((string) $candidate);
        if ($url === '') continue;
        if (preg_match('#^https?://#i', $url)) return $url;
        if (str_starts_with($url, './') && $publicUrl !== '') return rtrim($publicUrl, '/') . '/' . ltrim(substr($url, 2), '/');
    }
    return '';
}

function output_product_report_xls(array $catalog, array $rows, int $days, string $type): never
{
    $filename = 'reporte-productos-' . slugify((string) ($catalog['slug'] ?? 'catalogo')) . '-' . date('Ymd-His') . '.xls';
    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo "\xEF\xBB\xBF";
    ?>
    <html><head><meta charset="UTF-8"></head><body>
    <h2>Reporte productos - <?= html_escape($catalog['title'] ?? '') ?></h2>
    <p>Periodo: <?= (int) $days ?> dias. Tipo: <?= html_escape($type) ?></p>
    <table border="1" cellspacing="0" cellpadding="6">
        <thead><tr><th>Imagen</th><th>ITEM</th><th>Descripcion</th><th>Marca</th><th>Categoria</th><th>Empaque</th><th>Pz/Bulto</th><th>Vistas</th><th>Cantidad comprada</th><th>Pedidos</th><th>Total vendido</th><th>Ultima vista</th></tr></thead>
        <tbody>
        <?php foreach ($rows as $row): ?>
            <tr>
                <td><?php if ($row['image_url'] !== ''): ?><img src="<?= html_escape($row['image_url']) ?>" width="70" height="70"><?php endif; ?></td>
                <td><?= html_escape($row['item_code']) ?></td>
                <td><?= html_escape($row['description']) ?></td>
                <td><?= html_escape($row['brand']) ?></td>
                <td><?= html_escape($row['category']) ?></td>
                <td><?= html_escape($row['package_label']) ?></td>
                <td><?= html_escape($row['package_qty']) ?></td>
                <td><?= (int) $row['views_count'] ?></td>
                <td><?= html_escape($row['ordered_qty']) ?></td>
                <td><?= (int) $row['orders_count'] ?></td>
                <td><?= html_escape(number_format((float) $row['ordered_total'], 2)) ?></td>
                <td><?= html_escape($row['last_viewed_at']) ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    </body></html>
    <?php
    exit;
}
