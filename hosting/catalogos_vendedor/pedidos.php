<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
vendor_require_login();

$sellerId = (int) (current_user()['seller_id'] ?? 0);
$orders = [];
$schemaReady = vendor_table_exists('orders') && vendor_column_exists('orders', 'seller_id');
if ($schemaReady) {
    $orderNumberExpr = vendor_column_exists('orders', 'order_number') ? 'order_number' : "CONCAT('PED-', id)";
    $companyExpr = vendor_column_exists('orders', 'company_name') ? 'company_name' : (vendor_column_exists('orders', 'customer_name') ? 'customer_name' : "''");
    $contactExpr = vendor_column_exists('orders', 'contact_name') ? 'contact_name' : (vendor_column_exists('orders', 'customer_name') ? 'customer_name' : "''");
    $totalExpr = vendor_column_exists('orders', 'total') ? 'total' : '0';
    $statusExpr = vendor_column_exists('orders', 'status') ? 'status' : "'new'";
    $createdExpr = vendor_column_exists('orders', 'created_at') ? 'created_at' : "''";
    $orderBy = vendor_column_exists('orders', 'created_at') ? 'created_at DESC' : 'id DESC';
    $stmt = db()->prepare(
        "SELECT {$orderNumberExpr} AS order_number, {$companyExpr} AS company_name, {$contactExpr} AS contact_name,
                {$totalExpr} AS total, {$statusExpr} AS status, {$createdExpr} AS created_at
         FROM orders
         WHERE seller_id = :seller_id
         ORDER BY {$orderBy}
         LIMIT 100"
    );
    $stmt->execute(['seller_id' => $sellerId]);
    $orders = $stmt->fetchAll();
}

vendor_header('Mis pedidos', 'pedidos.php');
?>
<section class="card">
    <div class="toolbar"><strong>Pedidos asociados</strong></div>
    <?php if (!$schemaReady): ?>
        <p class="muted">El modulo de pedidos por vendedor requiere ejecutar la migracion B2B.</p>
    <?php else: ?>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Pedido</th><th>Empresa</th><th>Contacto</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
            <?php foreach ($orders as $order): ?>
                <tr>
                    <td><?= html_escape($order['order_number']) ?></td>
                    <td><?= html_escape($order['company_name']) ?></td>
                    <td><?= html_escape($order['contact_name']) ?></td>
                    <td><?= html_escape(number_format((float) $order['total'], 2)) ?></td>
                    <td><?= admin_status_badge((string) $order['status']) ?></td>
                    <td><?= html_escape($order['created_at']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</section>
<?php vendor_footer(); ?>
