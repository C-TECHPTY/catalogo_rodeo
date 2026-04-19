<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
vendor_require_login();

$sellerId = (int) (current_user()['seller_id'] ?? 0);
$stmt = db()->prepare(
    'SELECT order_number, company_name, contact_name, total, status, created_at
     FROM orders
     WHERE seller_id = :seller_id
     ORDER BY created_at DESC
     LIMIT 100'
);
$stmt->execute(['seller_id' => $sellerId]);
$orders = $stmt->fetchAll();

vendor_header('Mis pedidos', 'pedidos.php');
?>
<section class="card">
    <div class="toolbar"><strong>Pedidos asociados</strong></div>
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
</section>
<?php vendor_footer(); ?>
