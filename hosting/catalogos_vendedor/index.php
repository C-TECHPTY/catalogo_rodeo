<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
vendor_require_login();

$user = current_user();
$sellerId = (int) ($user['seller_id'] ?? 0);

$catalogsCountStmt = db()->prepare('SELECT COUNT(*) FROM catalogs WHERE seller_id = :seller_id');
$catalogsCountStmt->execute(['seller_id' => $sellerId]);
$linksCountStmt = db()->prepare('SELECT COUNT(*) FROM catalog_share_links WHERE seller_id = :seller_id');
$linksCountStmt->execute(['seller_id' => $sellerId]);
$ordersCountStmt = db()->prepare('SELECT COUNT(*) FROM orders WHERE seller_id = :seller_id');
$ordersCountStmt->execute(['seller_id' => $sellerId]);
$recentOrdersStmt = db()->prepare('SELECT order_number, company_name, total, status, created_at FROM orders WHERE seller_id = :seller_id ORDER BY created_at DESC LIMIT 8');
$recentOrdersStmt->execute(['seller_id' => $sellerId]);
$recentOrders = $recentOrdersStmt->fetchAll();

vendor_header('Resumen comercial', 'index.php');
?>
<div class="grid grid--cards">
    <div class="card"><div class="stat__label">Catalogos</div><div class="stat__value"><?= (int) $catalogsCountStmt->fetchColumn() ?></div></div>
    <div class="card"><div class="stat__label">Links</div><div class="stat__value"><?= (int) $linksCountStmt->fetchColumn() ?></div></div>
    <div class="card"><div class="stat__label">Pedidos</div><div class="stat__value"><?= (int) $ordersCountStmt->fetchColumn() ?></div></div>
    <div class="card"><div class="stat__label">Vendedor</div><div class="stat__value" style="font-size:22px;"><?= html_escape($user['seller_display_name'] ?: $user['full_name']) ?></div></div>
</div>
<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Pedidos recientes</strong></div>
    <div class="list">
        <?php foreach ($recentOrders as $order): ?>
            <div class="list-item">
                <strong><?= html_escape($order['order_number']) ?></strong>
                <div class="muted"><?= html_escape($order['company_name']) ?></div>
                <div class="metrics-inline">
                    <span class="pill"><?= html_escape(number_format((float) $order['total'], 2)) ?></span>
                    <span class="pill"><?= html_escape($order['status']) ?></span>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
</section>
<?php vendor_footer(); ?>
