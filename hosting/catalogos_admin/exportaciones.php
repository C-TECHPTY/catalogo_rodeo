<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login(['admin', 'billing', 'sales', 'operator']);

$orders = db()->query(
    'SELECT id, order_number, company_name, total, status, created_at
     FROM orders
     ORDER BY created_at DESC
     LIMIT 100'
)->fetchAll();

admin_header('Exportaciones', 'exportaciones.php');
?>
<section class="card">
    <div class="toolbar"><strong>Exportacion operativa</strong><span class="pill">DB como fuente de verdad</span></div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Pedido</th><th>Empresa</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Descargas</th></tr></thead>
            <tbody>
            <?php foreach ($orders as $order): ?>
                <tr>
                    <td><?= html_escape($order['order_number']) ?></td>
                    <td><?= html_escape($order['company_name']) ?></td>
                    <td><?= html_escape(number_format((float) $order['total'], 2)) ?></td>
                    <td><?= admin_status_badge((string) $order['status']) ?></td>
                    <td><?= html_escape($order['created_at']) ?></td>
                    <td>
                        <div class="toolbar__actions">
                            <a class="button" href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>">CSV</a>
                            <a class="button" href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>&format=xlsx">XLSX</a>
                            <a class="button" href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>&format=pdf" target="_blank">PDF/Print</a>
                        </div>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<?php admin_footer(); ?>
