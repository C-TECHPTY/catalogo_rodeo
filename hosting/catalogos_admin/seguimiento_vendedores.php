<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login(['admin', 'sales']);

$hasCatalogs = admin_table_exists('catalogs');
$hasSellers = admin_table_exists('sellers');
$hasLinks = admin_table_exists('catalog_share_links');
$hasLogs = admin_table_exists('catalog_seller_email_logs');
$hasOrders = admin_table_exists('orders');
$hasShortLinks = admin_table_exists('catalog_short_links');

if (!$hasCatalogs || !$hasSellers || !$hasLinks) {
    admin_header('Seguimiento vendedores', 'seguimiento_vendedores.php');
    echo '<section class="card"><strong>Faltan tablas B2B requeridas.</strong><p class="muted">Se necesitan catalogos, vendedores y links compartidos para usar este seguimiento.</p></section>';
    admin_footer();
    exit;
}

$catalogs = db()->query(
    "SELECT id, title, slug, public_url
     FROM catalogs
     ORDER BY id DESC
     LIMIT 300"
)->fetchAll();

$selectedCatalogId = (int) ($_GET['catalog_id'] ?? ($catalogs[0]['id'] ?? 0));
$statusFilter = (string) ($_GET['status'] ?? 'all');
if (!in_array($statusFilter, ['all', 'sent', 'opened', 'not_opened', 'ordered', 'error', 'no_link'], true)) {
    $statusFilter = 'all';
}

$selectedCatalog = null;
foreach ($catalogs as $catalog) {
    if ((int) $catalog['id'] === $selectedCatalogId) {
        $selectedCatalog = $catalog;
        break;
    }
}

$rows = $selectedCatalog ? seller_tracking_rows($selectedCatalog, $hasLogs, $hasOrders, $hasShortLinks) : [];
$rows = seller_tracking_filter_rows($rows, $statusFilter);
$summary = seller_tracking_summary($rows);

if (($_GET['export'] ?? '') === 'xls' && $selectedCatalog) {
    seller_tracking_export_xls($selectedCatalog, $rows, $statusFilter);
}

admin_header('Seguimiento vendedores', 'seguimiento_vendedores.php');
?>
<section class="card" style="margin-bottom:18px;">
    <div class="toolbar">
        <strong>Seguimiento de envio a vendedores</strong>
        <span class="pill">trazabilidad por link</span>
    </div>
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
            <span>Estado</span>
            <select name="status">
                <option value="all" <?= $statusFilter === 'all' ? 'selected' : '' ?>>Todos</option>
                <option value="sent" <?= $statusFilter === 'sent' ? 'selected' : '' ?>>Correo enviado</option>
                <option value="opened" <?= $statusFilter === 'opened' ? 'selected' : '' ?>>Abrieron link</option>
                <option value="not_opened" <?= $statusFilter === 'not_opened' ? 'selected' : '' ?>>Sin abrir</option>
                <option value="ordered" <?= $statusFilter === 'ordered' ? 'selected' : '' ?>>Con pedidos</option>
                <option value="error" <?= $statusFilter === 'error' ? 'selected' : '' ?>>Error de correo</option>
                <option value="no_link" <?= $statusFilter === 'no_link' ? 'selected' : '' ?>>Sin link</option>
            </select>
        </label>
        <div class="wide toolbar__actions">
            <button class="button--primary" type="submit">Aplicar</button>
            <a class="button" href="seguimiento_vendedores.php?<?= html_escape(http_build_query(['catalog_id' => $selectedCatalogId, 'status' => $statusFilter, 'export' => 'xls'])) ?>">Exportar Excel</a>
            <?php if ($selectedCatalog): ?>
                <a class="button" href="send_catalog_to_sellers.php?catalog_id=<?= (int) $selectedCatalog['id'] ?>">Enviar a vendedores</a>
            <?php endif; ?>
        </div>
    </form>
</section>

<section class="grid grid--cards" style="margin-bottom:18px;">
    <div class="card stat"><span class="stat__label">Vendedores</span><strong class="stat__value"><?= (int) $summary['sellers'] ?></strong></div>
    <div class="card stat"><span class="stat__label">Correos enviados</span><strong class="stat__value"><?= (int) $summary['sent'] ?></strong></div>
    <div class="card stat"><span class="stat__label">Links abiertos</span><strong class="stat__value"><?= (int) $summary['opened'] ?></strong></div>
    <div class="card stat"><span class="stat__label">Pedidos</span><strong class="stat__value"><?= (int) $summary['orders'] ?></strong></div>
</section>

<section class="card">
    <div class="toolbar">
        <strong>Detalle por vendedor</strong>
        <span class="pill"><?= count($rows) ?> registros</span>
    </div>
    <?php if (!$hasLogs): ?>
        <p class="muted">Nota: falta <code>catalog_seller_email_logs</code>. Se mostraran links y pedidos, pero no el historial de correos enviados.</p>
    <?php endif; ?>
    <div class="table-wrap">
        <table>
            <thead>
            <tr>
                <th>Vendedor</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>Link</th>
                <th>Aperturas</th>
                <th>Ultima apertura</th>
                <th>Pedidos</th>
                <th>Total</th>
                <th>Ultimo envio</th>
            </tr>
            </thead>
            <tbody>
            <?php foreach ($rows as $row): ?>
                <tr>
                    <td><strong><?= html_escape($row['seller_name']) ?></strong></td>
                    <td><?= html_escape($row['email']) ?></td>
                    <td><?= seller_tracking_status_badge($row) ?></td>
                    <td>
                        <?php if ($row['share_url'] !== ''): ?>
                            <input class="link-url" type="text" value="<?= html_escape($row['share_url']) ?>" readonly>
                            <a class="button" href="<?= html_escape($row['share_url']) ?>" target="_blank" rel="noreferrer">Abrir</a>
                        <?php else: ?>
                            <span class="muted">Sin link</span>
                        <?php endif; ?>
                    </td>
                    <td><?= (int) $row['open_count'] ?></td>
                    <td><?= html_escape($row['last_opened_at']) ?></td>
                    <td><a href="pedidos.php?link_id=<?= (int) $row['share_link_id'] ?>"><?= (int) $row['orders_count'] ?></a></td>
                    <td>US$ <?= html_escape(number_format((float) $row['orders_total'], 2)) ?></td>
                    <td><?= html_escape($row['sent_at']) ?></td>
                </tr>
            <?php endforeach; ?>
            <?php if (!$rows): ?>
                <tr><td colspan="9" class="empty-table">No hay datos para este filtro.</td></tr>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
</section>
<?php admin_footer(); ?>

<?php
function seller_tracking_rows(array $catalog, bool $hasLogs, bool $hasOrders, bool $hasShortLinks): array
{
    $catalogId = (int) ($catalog['id'] ?? 0);
    $publicUrl = (string) ($catalog['public_url'] ?? '');
    $latestLinkSql = 'SELECT catalog_id, seller_id, MAX(id) AS link_id
                      FROM catalog_share_links
                      WHERE client_id IS NULL
                      GROUP BY catalog_id, seller_id';
    $logJoin = '';
    $logSelect = "'' AS email_status, '' AS error_message, '' AS sent_at";
    if ($hasLogs) {
        $logJoin = "LEFT JOIN (
                        SELECT catalog_id, seller_id, MAX(id) AS log_id
                        FROM catalog_seller_email_logs
                        GROUP BY catalog_id, seller_id
                    ) latest_log ON latest_log.catalog_id = :log_catalog_id AND latest_log.seller_id = s.id
                    LEFT JOIN catalog_seller_email_logs log ON log.id = latest_log.log_id";
        $logSelect = "COALESCE(log.status, '') AS email_status,
                      COALESCE(log.error_message, '') AS error_message,
                      COALESCE(log.sent_at, '') AS sent_at";
    }

    $shortJoin = $hasShortLinks ? 'LEFT JOIN catalog_short_links sl ON sl.share_link_id = l.id AND sl.is_active = 1' : '';
    $shortSelect = $hasShortLinks ? "COALESCE(sl.code, '') AS short_code, COALESCE(sl.open_count, 0) AS short_open_count" : "'' AS short_code, 0 AS short_open_count";
    $ordersJoin = '';
    $ordersSelect = '0 AS orders_count, 0 AS orders_total';
    if ($hasOrders && admin_column_exists('orders', 'share_link_id')) {
        $totalColumn = admin_column_exists('orders', 'total') ? 'total' : '0';
        $ordersJoin = "LEFT JOIN (
                            SELECT share_link_id, COUNT(*) AS orders_count, COALESCE(SUM({$totalColumn}), 0) AS orders_total
                            FROM orders
                            WHERE share_link_id IS NOT NULL
                            GROUP BY share_link_id
                        ) ord ON ord.share_link_id = l.id";
        $ordersSelect = 'COALESCE(ord.orders_count, 0) AS orders_count, COALESCE(ord.orders_total, 0) AS orders_total';
    }

    $statement = db()->prepare(
        "SELECT s.id AS seller_id, s.name AS seller_name, s.email,
                l.id AS share_link_id, l.token, l.open_count, l.last_opened_at, l.is_active AS link_is_active,
                {$shortSelect},
                {$logSelect},
                {$ordersSelect}
         FROM sellers s
         LEFT JOIN ({$latestLinkSql}) latest_link ON latest_link.catalog_id = :link_catalog_id AND latest_link.seller_id = s.id
         LEFT JOIN catalog_share_links l ON l.id = latest_link.link_id
         {$shortJoin}
         {$logJoin}
         {$ordersJoin}
         WHERE s.is_active = 1
         ORDER BY s.name ASC"
    );
    $params = ['link_catalog_id' => $catalogId];
    if ($hasLogs) {
        $params['log_catalog_id'] = $catalogId;
    }
    $statement->execute($params);

    $rows = [];
    foreach ($statement->fetchAll() as $row) {
        $link = [
            'id' => (int) ($row['share_link_id'] ?? 0),
            'catalog_id' => $catalogId,
            'seller_id' => (int) ($row['seller_id'] ?? 0),
            'client_id' => null,
            'token' => (string) ($row['token'] ?? ''),
        ];
        $shareUrl = $link['id'] > 0 ? catalog_share_public_url($link, $publicUrl) : '';
        $rows[] = [
            'seller_id' => (int) ($row['seller_id'] ?? 0),
            'seller_name' => (string) ($row['seller_name'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'share_link_id' => (int) ($row['share_link_id'] ?? 0),
            'share_url' => $shareUrl,
            'email_status' => (string) ($row['email_status'] ?? ''),
            'error_message' => (string) ($row['error_message'] ?? ''),
            'sent_at' => (string) ($row['sent_at'] ?? ''),
            'open_count' => (int) ($row['open_count'] ?? 0),
            'short_open_count' => (int) ($row['short_open_count'] ?? 0),
            'last_opened_at' => (string) ($row['last_opened_at'] ?? ''),
            'orders_count' => (int) ($row['orders_count'] ?? 0),
            'orders_total' => (float) ($row['orders_total'] ?? 0),
        ];
    }
    return $rows;
}

function seller_tracking_filter_rows(array $rows, string $status): array
{
    if ($status === 'all') {
        return $rows;
    }
    return array_values(array_filter($rows, static function (array $row) use ($status): bool {
        return match ($status) {
            'sent' => $row['email_status'] === 'sent',
            'opened' => (int) $row['open_count'] > 0,
            'not_opened' => (int) $row['share_link_id'] > 0 && (int) $row['open_count'] === 0,
            'ordered' => (int) $row['orders_count'] > 0,
            'error' => $row['email_status'] === 'error',
            'no_link' => (int) $row['share_link_id'] <= 0,
            default => true,
        };
    }));
}

function seller_tracking_summary(array $rows): array
{
    $summary = ['sellers' => count($rows), 'sent' => 0, 'opened' => 0, 'orders' => 0, 'total' => 0.0];
    foreach ($rows as $row) {
        if ($row['email_status'] === 'sent') $summary['sent']++;
        if ((int) $row['open_count'] > 0) $summary['opened']++;
        $summary['orders'] += (int) $row['orders_count'];
        $summary['total'] += (float) $row['orders_total'];
    }
    return $summary;
}

function seller_tracking_status_badge(array $row): string
{
    if ((int) $row['orders_count'] > 0) {
        return '<span class="pill" style="background:#dcfce7;color:#166534;">Con pedido</span>';
    }
    if ((int) $row['open_count'] > 0) {
        return '<span class="pill" style="background:#dbeafe;color:#1e40af;">Abierto</span>';
    }
    if ($row['email_status'] === 'sent') {
        return '<span class="pill" style="background:#eef3fb;color:#173b8f;">Enviado</span>';
    }
    if ($row['email_status'] === 'error') {
        return '<span class="pill" style="background:#fee2e2;color:#991b1b;">Error</span>';
    }
    if ((int) $row['share_link_id'] <= 0) {
        return '<span class="pill" style="background:#f3f4f6;color:#4b5563;">Sin link</span>';
    }
    return '<span class="pill">Pendiente</span>';
}

function seller_tracking_export_xls(array $catalog, array $rows, string $statusFilter): never
{
    $filename = 'seguimiento-vendedores-' . slugify((string) ($catalog['slug'] ?? 'catalogo')) . '-' . date('Ymd-His') . '.xls';
    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo "\xEF\xBB\xBF";
    ?>
    <table border="1">
        <tr><th colspan="10">Seguimiento de envio a vendedores</th></tr>
        <tr><td>Catalogo</td><td colspan="9"><?= html_escape((string) ($catalog['title'] ?? '')) ?></td></tr>
        <tr><td>Filtro</td><td colspan="9"><?= html_escape($statusFilter) ?></td></tr>
        <tr>
            <th>Vendedor</th><th>Correo</th><th>Estado correo</th><th>Fecha envio</th><th>Link</th>
            <th>Aperturas</th><th>Ultima apertura</th><th>Pedidos</th><th>Total vendido</th><th>Error</th>
        </tr>
        <?php foreach ($rows as $row): ?>
            <tr>
                <td><?= html_escape($row['seller_name']) ?></td>
                <td><?= html_escape($row['email']) ?></td>
                <td><?= html_escape($row['email_status']) ?></td>
                <td><?= html_escape($row['sent_at']) ?></td>
                <td><?= html_escape($row['share_url']) ?></td>
                <td><?= (int) $row['open_count'] ?></td>
                <td><?= html_escape($row['last_opened_at']) ?></td>
                <td><?= (int) $row['orders_count'] ?></td>
                <td><?= html_escape(number_format((float) $row['orders_total'], 2, '.', '')) ?></td>
                <td><?= html_escape($row['error_message']) ?></td>
            </tr>
        <?php endforeach; ?>
    </table>
    <?php
    exit;
}
