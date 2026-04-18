<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$payload = read_json_input();

$slug = slugify((string) ($payload['slug'] ?? ''));
$customerName = trim((string) ($payload['customer_name'] ?? ''));
$customerEmail = trim((string) ($payload['customer_email'] ?? ''));
$customerPhone = trim((string) ($payload['customer_phone'] ?? ''));
$comments = trim((string) ($payload['comments'] ?? ''));
$items = $payload['items'] ?? [];

if ($slug === '' || $customerName === '' || $customerPhone === '' || !is_array($items) || !$items) {
    json_response([
        'ok' => false,
        'error' => 'Datos incompletos para registrar el pedido.',
    ], 422);
}

$catalog = ensure_catalog_active($slug);
$orderNumber = next_order_number();
$subtotal = 0.0;
$normalizedItems = [];

foreach ($items as $item) {
    $bultos = max(0.0, (float) ($item['quantity'] ?? 0));
    if ($bultos <= 0) {
        continue;
    }

    $price = parse_decimal($item['price'] ?? 0);
    $packageQty = max(1.0, parse_decimal($item['package_qty'] ?? 1));
    $piecesTotal = $bultos * $packageQty;
    $lineTotal = $piecesTotal * $price;
    $subtotal += $lineTotal;
    $normalizedItems[] = [
        'item_code' => trim((string) ($item['item_code'] ?? '')),
        'description' => trim((string) ($item['description'] ?? '')),
        'quantity' => $bultos,
        'package_qty' => $packageQty,
        'pieces_total' => $piecesTotal,
        'price' => $price,
        'line_total' => $lineTotal,
    ];
}

if (!$normalizedItems) {
    json_response([
        'ok' => false,
        'error' => 'No hay productos validos en el pedido.',
    ], 422);
}

$pdo = db();
$pdo->beginTransaction();

try {
    $insertOrder = $pdo->prepare(
        'INSERT INTO orders (catalog_id, order_number, customer_name, customer_email, customer_phone, seller_name, comments, subtotal, total, currency, status)
         VALUES (:catalog_id, :order_number, :customer_name, :customer_email, :customer_phone, :seller_name, :comments, :subtotal, :total, :currency, :status)'
    );
    $insertOrder->execute([
        'catalog_id' => $catalog['id'],
        'order_number' => $orderNumber,
        'customer_name' => $customerName,
        'customer_email' => $customerEmail,
        'customer_phone' => $customerPhone,
        'seller_name' => $catalog['seller_name'] ?? '',
        'comments' => $comments,
        'subtotal' => $subtotal,
        'total' => $subtotal,
        'currency' => 'USD',
        'status' => 'new',
    ]);

    $orderId = (int) $pdo->lastInsertId();

    $insertItem = $pdo->prepare(
        'INSERT INTO order_items (order_id, item_code, description, quantity, price, line_total)
         VALUES (:order_id, :item_code, :description, :quantity, :price, :line_total)'
    );

    foreach ($normalizedItems as $item) {
        $insertItem->execute([
            'order_id' => $orderId,
            'item_code' => $item['item_code'],
            'description' => $item['description'],
            'quantity' => $item['quantity'],
            'price' => $item['price'],
            'line_total' => $item['line_total'],
        ]);
    }

    $pdo->commit();
} catch (Throwable $exception) {
    $pdo->rollBack();
    json_response([
        'ok' => false,
        'error' => 'No se pudo guardar el pedido.',
        'details' => $exception->getMessage(),
    ], 500);
}

$lines = [
    'Nuevo pedido recibido',
    'Pedido: ' . $orderNumber,
    'Catalogo: ' . $catalog['title'],
    'Slug: ' . $catalog['slug'],
    'Cliente: ' . $customerName,
    'Correo: ' . $customerEmail,
    'Telefono: ' . $customerPhone,
    'Vendedor: ' . ($catalog['seller_name'] ?: 'No definido'),
    'Total: USD ' . number_format($subtotal, 2),
    '',
    'Detalle:',
];

foreach ($normalizedItems as $item) {
    $lines[] = sprintf(
        '- %s | %s | Vultos: %s | Empaque: %s | Piezas: %s | Precio: %.2f | Total: %.2f',
        $item['item_code'],
        $item['description'],
        rtrim(rtrim(number_format($item['quantity'], 2, '.', ''), '0'), '.'),
        rtrim(rtrim(number_format($item['package_qty'], 2, '.', ''), '0'), '.'),
        rtrim(rtrim(number_format($item['pieces_total'], 2, '.', ''), '0'), '.'),
        $item['price'],
        $item['line_total']
    );
}

if ($comments !== '') {
    $lines[] = '';
    $lines[] = 'Observaciones: ' . $comments;
}

send_notification_mail(
    sprintf('Nuevo pedido %s - %s', $orderNumber, $catalog['title']),
    implode("\n", $lines)
);

json_response([
    'ok' => true,
    'order' => [
        'id' => $orderId,
        'order_number' => $orderNumber,
        'catalog_id' => $catalog['id'],
        'total' => round($subtotal, 2),
        'currency' => 'USD',
        'status' => 'new',
    ],
]);
