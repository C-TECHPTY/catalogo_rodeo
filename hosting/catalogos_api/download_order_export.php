<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$orderId = (int) ($_GET['id'] ?? 0);
$token = trim((string) ($_GET['token'] ?? ''));
$format = strtolower(trim((string) ($_GET['format'] ?? 'xlsx')));

if ($orderId <= 0 || $token === '') {
    http_response_code(404);
    echo 'Pedido no encontrado.';
    exit;
}

if (!in_array($format, ['csv', 'xlsx'], true)) {
    $format = 'xlsx';
}

$statement = db()->prepare(
    'SELECT o.*, c.slug AS catalog_slug_ref, c.title AS catalog_title,
            c.public_url, c.catalog_json_path, c.api_payload
     FROM orders o
     LEFT JOIN catalogs c ON c.id = o.catalog_id
     WHERE o.id = :id
     LIMIT 1'
);
$statement->execute(['id' => $orderId]);
$order = $statement->fetch();

if (!$order) {
    http_response_code(404);
    echo 'Pedido no encontrado.';
    exit;
}

$expectedToken = order_public_export_token((int) $order['id'], (string) ($order['order_number'] ?? ''));
if ($expectedToken === '' || !hash_equals($expectedToken, $token)) {
    http_response_code(403);
    echo 'Enlace no autorizado.';
    exit;
}

$itemsStatement = db()->prepare('SELECT * FROM order_items WHERE order_id = :order_id ORDER BY id ASC');
$itemsStatement->execute(['order_id' => $orderId]);
$items = hydrate_order_item_image_urls($order, $itemsStatement->fetchAll());

$paths = [
    'csv_path' => (string) ($order['export_csv_path'] ?? ''),
    'xlsx_path' => (string) ($order['export_xlsx_path'] ?? ''),
];

$path = $format === 'csv' ? $paths['csv_path'] : $paths['xlsx_path'];
if ($path === '' || !is_file($path)) {
    $generated = generate_order_export_files([
        'id' => (int) $order['id'],
        'order_number' => (string) ($order['order_number'] ?? ('PED-' . (int) $order['id'])),
        'catalog_title' => (string) ($order['catalog_title'] ?? $order['catalog_slug_ref'] ?? ''),
        'catalog_slug' => (string) ($order['catalog_slug'] ?? $order['catalog_slug_ref'] ?? ''),
        'company_name' => (string) (($order['company_name'] ?? '') ?: ($order['customer_name'] ?? '')),
        'contact_name' => (string) (($order['contact_name'] ?? '') ?: ($order['customer_name'] ?? '')),
        'contact_email' => (string) (($order['contact_email'] ?? '') ?: ($order['customer_email'] ?? '')),
        'contact_phone' => (string) (($order['contact_phone'] ?? '') ?: ($order['customer_phone'] ?? '')),
        'address_zone' => (string) ($order['address_zone'] ?? ''),
        'status' => (string) ($order['status'] ?? 'new'),
        'created_at' => (string) ($order['created_at'] ?? ''),
        'total' => (float) ($order['total'] ?? 0),
    ], $items);
    $path = $format === 'csv' ? (string) ($generated['csv_path'] ?? '') : (string) ($generated['xlsx_path'] ?? '');
}

if ($path === '' || !is_file($path)) {
    http_response_code(500);
    echo 'No se pudo preparar el archivo del pedido.';
    exit;
}

$orderNumber = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string) ($order['order_number'] ?? ('PED-' . $orderId))) ?: ('PED-' . $orderId);
$filename = 'pedido-' . trim($orderNumber, '-') . '.' . $format;
$mime = $format === 'csv'
    ? 'text/csv; charset=utf-8'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

header('Content-Type: ' . $mime);
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . (string) filesize($path));
readfile($path);
