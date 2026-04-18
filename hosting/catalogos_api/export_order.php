<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$orderId = (int) ($_GET['id'] ?? 0);
if ($orderId <= 0) {
    json_response([
        'ok' => false,
        'error' => 'Debes indicar un pedido valido.',
    ], 422);
}

$orderStmt = db()->prepare(
    'SELECT o.*, c.slug AS catalog_slug, c.title AS catalog_title
     FROM orders o
     INNER JOIN catalogs c ON c.id = o.catalog_id
     WHERE o.id = :id
     LIMIT 1'
);
$orderStmt->execute(['id' => $orderId]);
$order = $orderStmt->fetch();

if (!$order) {
    json_response([
        'ok' => false,
        'error' => 'Pedido no encontrado.',
    ], 404);
}

$itemsStmt = db()->prepare('SELECT * FROM order_items WHERE order_id = :order_id ORDER BY id ASC');
$itemsStmt->execute(['order_id' => $orderId]);
$items = $itemsStmt->fetchAll();

$filename = sprintf('pedido-%s.csv', $order['order_number']);
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$output = fopen('php://output', 'wb');
fputcsv($output, ['Pedido', $order['order_number']]);
fputcsv($output, ['Catalogo', $order['catalog_title']]);
fputcsv($output, ['Cliente', $order['customer_name']]);
fputcsv($output, ['Correo', $order['customer_email']]);
fputcsv($output, ['Telefono', $order['customer_phone']]);
fputcsv($output, ['Estado', $order['status']]);
fputcsv($output, ['Total', $order['total']]);
fputcsv($output, []);
fputcsv($output, ['ITEM', 'Descripcion', 'Cantidad', 'Precio', 'Total']);

foreach ($items as $item) {
    fputcsv($output, [
        $item['item_code'],
        $item['description'],
        $item['quantity'],
        $item['price'],
        $item['line_total'],
    ]);
}

fclose($output);
exit;
