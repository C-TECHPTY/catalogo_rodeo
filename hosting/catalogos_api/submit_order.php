<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$payload = read_json_input();

$slug = slugify((string) ($payload['slug'] ?? ''));
$shareToken = trim((string) ($payload['share_token'] ?? ''));
$companyName = trim((string) ($payload['company_name'] ?? ''));
$contactName = trim((string) ($payload['contact_name'] ?? $payload['customer_name'] ?? ''));
$contactEmail = trim((string) ($payload['contact_email'] ?? $payload['customer_email'] ?? ''));
$contactPhone = trim((string) ($payload['contact_phone'] ?? $payload['customer_phone'] ?? ''));
$addressZone = trim((string) ($payload['address_zone'] ?? ''));
$comments = trim((string) ($payload['comments'] ?? ''));
$sourceChannel = trim((string) ($payload['source_channel'] ?? 'web'));
$items = $payload['items'] ?? [];

if ($slug === '' || $contactName === '' || $contactPhone === '' || !is_array($items) || !$items) {
    json_response([
        'ok' => false,
        'error' => 'Datos incompletos para registrar el pedido.',
    ], 422);
}

$context = resolve_public_catalog_context($slug, $shareToken);
$catalog = $context['catalog'];
$orderNumber = next_order_number();
$subtotal = 0.0;
$normalizedItems = [];

foreach ($items as $item) {
    $quantity = max(0.0, parse_decimal($item['quantity'] ?? 0));
    if ($quantity <= 0) {
        continue;
    }

    $unitPrice = parse_decimal($item['unit_price'] ?? $item['price'] ?? 0);
    $packageQty = max(1.0, parse_decimal($item['package_qty'] ?? 1));
    $piecesTotal = max($quantity * $packageQty, parse_decimal($item['pieces_total'] ?? 0));
    $lineTotal = parse_decimal($item['line_total'] ?? 0);
    if ($lineTotal <= 0) {
        $lineTotal = $piecesTotal * $unitPrice;
    }

    $subtotal += $lineTotal;
    $normalizedItems[] = [
        'item_code' => trim((string) ($item['item_code'] ?? '')),
        'description' => trim((string) ($item['description'] ?? '')),
        'quantity' => $quantity,
        'sale_unit' => trim((string) ($item['sale_unit'] ?? 'unidad')),
        'package_label' => trim((string) ($item['package_label'] ?? 'Empaque')),
        'package_qty' => $packageQty,
        'pieces_total' => $piecesTotal,
        'unit_price' => $unitPrice,
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
        'INSERT INTO orders (
            catalog_id, share_link_id, seller_id, client_id, order_number, catalog_slug, company_name,
            contact_name, contact_email, contact_phone, address_zone, seller_name, comments,
            subtotal, total, currency, status
         ) VALUES (
            :catalog_id, :share_link_id, :seller_id, :client_id, :order_number, :catalog_slug, :company_name,
            :contact_name, :contact_email, :contact_phone, :address_zone, :seller_name, :comments,
            :subtotal, :total, :currency, :status
         )'
    );
    $insertOrder->execute([
        'catalog_id' => $catalog['id'],
        'share_link_id' => $context['share_link']['id'] ?? null,
        'seller_id' => $context['seller_id'] ?: null,
        'client_id' => $context['client_id'] ?: null,
        'order_number' => $orderNumber,
        'catalog_slug' => $catalog['slug'],
        'company_name' => $companyName,
        'contact_name' => $contactName,
        'contact_email' => $contactEmail,
        'contact_phone' => $contactPhone,
        'address_zone' => $addressZone,
        'seller_name' => $context['seller_name'],
        'comments' => $comments,
        'subtotal' => $subtotal,
        'total' => $subtotal,
        'currency' => $catalog['currency'] ?: 'USD',
        'status' => 'new',
    ]);

    $orderId = (int) $pdo->lastInsertId();

    $insertItem = $pdo->prepare(
        'INSERT INTO order_items (
            order_id, item_code, description, quantity, sale_unit, package_label,
            package_qty, pieces_total, unit_price, line_total
         ) VALUES (
            :order_id, :item_code, :description, :quantity, :sale_unit, :package_label,
            :package_qty, :pieces_total, :unit_price, :line_total
         )'
    );

    foreach ($normalizedItems as $item) {
        $insertItem->execute([
            'order_id' => $orderId,
            'item_code' => $item['item_code'],
            'description' => $item['description'],
            'quantity' => $item['quantity'],
            'sale_unit' => $item['sale_unit'],
            'package_label' => $item['package_label'],
            'package_qty' => $item['package_qty'],
            'pieces_total' => $item['pieces_total'],
            'unit_price' => $item['unit_price'],
            'line_total' => $item['line_total'],
        ]);
    }

    $pdo->prepare(
        'INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_user_id, notes)
         VALUES (:order_id, :from_status, :to_status, :changed_by_user_id, :notes)'
    )->execute([
        'order_id' => $orderId,
        'from_status' => '',
        'to_status' => 'new',
        'changed_by_user_id' => null,
        'notes' => 'Pedido registrado desde catalogo publico.',
    ]);

    if (!empty($context['share_link']['id'])) {
        $pdo->prepare(
            'UPDATE catalog_share_links
             SET last_order_at = NOW(), updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'id' => $context['share_link']['id'],
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

$seller = fetch_seller($context['seller_id'] ? (int) $context['seller_id'] : null);
$orderForExport = [
    'id' => $orderId,
    'order_number' => $orderNumber,
    'catalog_title' => $catalog['title'],
    'catalog_slug' => $catalog['slug'],
    'company_name' => $companyName,
    'contact_name' => $contactName,
    'contact_email' => $contactEmail,
    'contact_phone' => $contactPhone,
    'address_zone' => $addressZone,
    'status' => 'new',
    'created_at' => date('Y-m-d H:i:s'),
    'total' => $subtotal,
];
$exportFiles = null;

try {
    $exportFiles = generate_order_export_files($orderForExport, $normalizedItems);
    db()->prepare(
        'UPDATE orders
         SET source_channel = :source_channel,
             export_csv_path = :export_csv_path,
             export_xlsx_path = :export_xlsx_path,
             export_generated_at = :export_generated_at,
             updated_at = NOW()
         WHERE id = :id'
    )->execute([
        'source_channel' => $sourceChannel === 'offline-sync' ? 'offline-sync' : 'web',
        'export_csv_path' => $exportFiles['csv_path'] ?? '',
        'export_xlsx_path' => $exportFiles['xlsx_path'] ?? '',
        'export_generated_at' => $exportFiles['generated_at'] ?? null,
        'id' => $orderId,
    ]);
} catch (Throwable $exception) {
    db()->prepare(
        'UPDATE orders
         SET source_channel = :source_channel, email_status = :email_status, updated_at = NOW()
         WHERE id = :id'
    )->execute([
        'source_channel' => $sourceChannel === 'offline-sync' ? 'offline-sync' : 'web',
        'email_status' => 'failed',
        'id' => $orderId,
    ]);
    audit_log('order.export_generation_failed', 'orders', $orderId, [
        'error' => $exception->getMessage(),
    ]);
}

$lines = [
    'Nuevo pedido B2B recibido',
    'Pedido: ' . $orderNumber,
    'Catalogo: ' . $catalog['title'],
    'Slug: ' . $catalog['slug'],
    'Empresa: ' . ($companyName !== '' ? $companyName : 'No indicada'),
    'Contacto: ' . $contactName,
    'Correo: ' . $contactEmail,
    'Telefono: ' . $contactPhone,
    'Zona / Direccion: ' . $addressZone,
    'Vendedor asociado: ' . ($context['seller_name'] ?: 'No definido'),
    'Cliente asociado: ' . ($context['client_name'] ?: 'No definido'),
    'Total: ' . format_money($subtotal, (string) ($catalog['currency'] ?: 'USD')),
    '',
    'Detalle:',
];

foreach ($normalizedItems as $item) {
    $lines[] = sprintf(
        '- %s | %s | %s %s | %s %.2f | Piezas %.2f | Unit %.2f | Total %.2f',
        $item['item_code'],
        $item['description'],
        rtrim(rtrim(number_format($item['quantity'], 2, '.', ''), '0'), '.'),
        $item['sale_unit'],
        $item['package_label'],
        $item['package_qty'],
        $item['pieces_total'],
        $item['unit_price'],
        $item['line_total']
    );
}

if ($comments !== '') {
    $lines[] = '';
    $lines[] = 'Observaciones: ' . $comments;
}

$mailRecipients = build_notification_recipients([
    'contact_email' => $contactEmail,
], $seller);
$mailAttachments = [];
if (!empty($exportFiles['csv_path'])) {
    $mailAttachments[] = [
        'path' => $exportFiles['csv_path'],
        'name' => basename((string) $exportFiles['csv_path']),
        'mime' => 'text/csv',
    ];
}
if (!empty($exportFiles['xlsx_path'])) {
    $mailAttachments[] = [
        'path' => $exportFiles['xlsx_path'],
        'name' => basename((string) $exportFiles['xlsx_path']),
        'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
}

$mailStatus = 'pending';
try {
    send_notification_mail(
        sprintf('Nuevo pedido %s - %s', $orderNumber, $catalog['title']),
        implode("\n", $lines),
        $mailRecipients,
        $orderId,
        $mailAttachments
    );
    $mailStatus = 'sent';
} catch (Throwable $exception) {
    $mailStatus = 'failed';
    audit_log('order.notification_failed', 'orders', $orderId, [
        'error' => $exception->getMessage(),
    ]);
}

db()->prepare(
    'UPDATE orders
     SET email_status = :email_status, email_sent_at = :email_sent_at, updated_at = NOW()
     WHERE id = :id'
)->execute([
    'email_status' => $mailStatus,
    'email_sent_at' => $mailStatus === 'sent' ? date('Y-m-d H:i:s') : null,
    'id' => $orderId,
]);

audit_log('order.created_from_public_catalog', 'orders', $orderId, [
    'order_number' => $orderNumber,
    'catalog_id' => $catalog['id'],
    'share_link_id' => $context['share_link']['id'] ?? null,
]);

json_response([
    'ok' => true,
    'order' => [
        'id' => $orderId,
        'order_number' => $orderNumber,
        'catalog_id' => $catalog['id'],
        'total' => round($subtotal, 2),
        'currency' => $catalog['currency'] ?: 'USD',
        'status' => 'new',
    ],
]);
