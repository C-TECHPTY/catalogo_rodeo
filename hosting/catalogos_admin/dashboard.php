<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login();

$stats = [
    'orders_recent' => (int) db()->query("SELECT COUNT(*) FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")->fetchColumn(),
    'catalogs_active' => (int) db()->query("SELECT COUNT(*) FROM catalogs WHERE status = 'active'")->fetchColumn(),
    'sellers_active' => (int) db()->query("SELECT COUNT(*) FROM sellers WHERE is_active = 1")->fetchColumn(),
    'access_today' => (int) db()->query("SELECT COUNT(*) FROM catalog_access_logs WHERE DATE(visited_at) = CURDATE()")->fetchColumn(),
    'links_active' => (int) db()->query("SELECT COUNT(*) FROM catalog_share_links WHERE is_active = 1")->fetchColumn(),
];

$recentOrders = db()->query(
    'SELECT o.id, o.order_number, o.company_name, o.contact_name, o.total, o.status, o.created_at,
            c.title AS catalog_title, s.name AS seller_name
     FROM orders o
     INNER JOIN catalogs c ON c.id = o.catalog_id
     LEFT JOIN sellers s ON s.id = o.seller_id
     ORDER BY o.created_at DESC
     LIMIT 8'
)->fetchAll();

$recentAccess = db()->query(
    'SELECT l.visited_at, c.title, s.name AS seller_name, cl.business_name AS client_name
     FROM catalog_access_logs l
     INNER JOIN catalogs c ON c.id = l.catalog_id
     LEFT JOIN sellers s ON s.id = l.seller_id
     LEFT JOIN clients cl ON cl.id = l.client_id
     ORDER BY l.visited_at DESC
     LIMIT 8'
)->fetchAll();

admin_header('Dashboard', 'dashboard.php');
?>
<div class="grid grid--cards">
    <div class="card"><div class="stat__label">Catalogos activos</div><div class="stat__value"><?= $stats['catalogs_active'] ?></div></div>
    <div class="card"><div class="stat__label">Pedidos 30 dias</div><div class="stat__value"><?= $stats['orders_recent'] ?></div></div>
    <div class="card"><div class="stat__label">Vendedores activos</div><div class="stat__value"><?= $stats['sellers_active'] ?></div></div>
    <div class="card"><div class="stat__label">Links activos</div><div class="stat__value"><?= $stats['links_active'] ?></div></div>
</div>
<div class="grid grid--cards dashboard-secondary">
    <div class="card"><div class="stat__label">Accesos hoy</div><div class="stat__value"><?= $stats['access_today'] ?></div></div>
    <div class="card"><div class="stat__label">Operacion</div><div class="stat__value"><?= $stats['catalogs_active'] + $stats['links_active'] ?></div></div>
    <div class="card"><div class="stat__label">Ventas</div><div class="stat__value"><?= $stats['orders_recent'] ?></div></div>
    <div class="card"><div class="stat__label">Red comercial</div><div class="stat__value"><?= $stats['sellers_active'] ?></div></div>
</div>
<div class="split" style="margin-top:18px;">
    <section class="card">
        <div class="toolbar"><strong>Pedidos recientes</strong></div>
        <div class="list">
            <?php foreach ($recentOrders as $order): ?>
                <div class="list-item">
                    <div class="toolbar">
                        <div>
                            <strong><?= html_escape($order['order_number']) ?></strong>
                            <div class="muted"><?= html_escape($order['company_name'] ?: $order['contact_name']) ?></div>
                            <div class="muted"><?= html_escape($order['catalog_title']) ?> / <?= html_escape($order['seller_name'] ?: 'Sin vendedor') ?></div>
                        </div>
                        <?= admin_status_badge((string) $order['status']) ?>
                    </div>
                    <div class="metrics-inline">
                        <span class="pill"><?= html_escape(number_format((float) $order['total'], 2)) ?></span>
                        <span class="pill"><?= html_escape($order['created_at']) ?></span>
                        <a class="button" href="pedidos.php?id=<?= (int) $order['id'] ?>">Ver</a>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>
    <section class="card">
        <div class="toolbar"><strong>Accesos recientes</strong></div>
        <div class="list">
            <?php foreach ($recentAccess as $access): ?>
                <div class="list-item">
                    <strong><?= html_escape($access['title']) ?></strong>
                    <div class="muted"><?= html_escape($access['seller_name'] ?: 'Sin vendedor') ?> / <?= html_escape($access['client_name'] ?: 'Sin cliente') ?></div>
                    <div class="muted"><?= html_escape($access['visited_at']) ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>
</div>
<?php admin_footer(); ?>
