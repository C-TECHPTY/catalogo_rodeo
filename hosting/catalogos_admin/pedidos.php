<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login();

$orderId = (int) ($_GET['id'] ?? 0);

if ($orderId > 0) {
    $orderStmt = db()->prepare(
        'SELECT o.*, c.title AS catalog_title, c.slug AS catalog_slug
         FROM orders o
         INNER JOIN catalogs c ON c.id = o.catalog_id
         WHERE o.id = :id
         LIMIT 1'
    );
    $orderStmt->execute(['id' => $orderId]);
    $order = $orderStmt->fetch();
    $items = [];
    if ($order) {
        $itemsStmt = db()->prepare('SELECT * FROM order_items WHERE order_id = :order_id ORDER BY id ASC');
        $itemsStmt->execute(['order_id' => $orderId]);
        $items = $itemsStmt->fetchAll();
    }

    admin_header('Pedido');
    ?>
    <div class="card">
        <?php if (!$order): ?>
            <p>Pedido no encontrado.</p>
        <?php else: ?>
            <h1><?= htmlspecialchars($order['order_number'], ENT_QUOTES, 'UTF-8') ?></h1>
            <p class="muted">
                Catalogo: <?= htmlspecialchars($order['catalog_title'], ENT_QUOTES, 'UTF-8') ?>
                · Cliente: <?= htmlspecialchars($order['customer_name'], ENT_QUOTES, 'UTF-8') ?>
                · Telefono: <?= htmlspecialchars($order['customer_phone'], ENT_QUOTES, 'UTF-8') ?>
            </p>
            <p>
                <span class="badge badge--new"><?= htmlspecialchars($order['status'], ENT_QUOTES, 'UTF-8') ?></span>
            </p>
            <table>
                <thead>
                    <tr>
                        <th>ITEM</th>
                        <th>Descripcion</th>
                        <th>Vultos</th>
                        <th>Precio Unitario</th>
                        <th>Total Linea</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($items as $item): ?>
                    <tr>
                        <td><?= htmlspecialchars($item['item_code'], ENT_QUOTES, 'UTF-8') ?></td>
                        <td><?= htmlspecialchars($item['description'], ENT_QUOTES, 'UTF-8') ?></td>
                        <td><?= htmlspecialchars((string) $item['quantity'], ENT_QUOTES, 'UTF-8') ?></td>
                        <td><?= htmlspecialchars((string) $item['price'], ENT_QUOTES, 'UTF-8') ?></td>
                        <td><?= htmlspecialchars((string) $item['line_total'], ENT_QUOTES, 'UTF-8') ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <p>
                <a href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>">Descargar CSV</a>
                |
                <a href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>&format=xlsx">Descargar XLSX</a>
            </p>
        <?php endif; ?>
    </div>
    <?php
    admin_footer();
    exit;
}

$ordersStmt = db()->query(
    'SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.total, o.status, o.created_at, c.title AS catalog_title
     FROM orders o
     INNER JOIN catalogs c ON c.id = o.catalog_id
     ORDER BY o.created_at DESC
     LIMIT 200'
);
$orders = $ordersStmt->fetchAll();

admin_header('Pedidos');
?>
<div class="card">
    <h1>Pedidos recibidos</h1>
    <table>
        <thead>
            <tr>
                <th>Pedido</th>
                <th>Catalogo</th>
                <th>Cliente</th>
                <th>Telefono</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Exportar</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($orders as $order): ?>
            <tr>
                <td><a href="pedidos.php?id=<?= (int) $order['id'] ?>"><?= htmlspecialchars($order['order_number'], ENT_QUOTES, 'UTF-8') ?></a></td>
                <td><?= htmlspecialchars($order['catalog_title'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><?= htmlspecialchars($order['customer_name'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><?= htmlspecialchars($order['customer_phone'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><?= htmlspecialchars((string) $order['total'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><span class="badge badge--new"><?= htmlspecialchars($order['status'], ENT_QUOTES, 'UTF-8') ?></span></td>
                <td><?= htmlspecialchars((string) $order['created_at'], ENT_QUOTES, 'UTF-8') ?></td>
                <td>
                    <a href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>">CSV</a>
                    |
                    <a href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>&format=xlsx">XLSX</a>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php admin_footer(); ?>
