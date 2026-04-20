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

$salesContact = sales_contact_info();
$pdo = db();
$pdo->beginTransaction();

try {
    $orderData = [
        'catalog_id' => $catalog['id'],
        'order_number' => $orderNumber,
        'comments' => $comments,
        'subtotal' => $subtotal,
        'total' => $subtotal,
        'currency' => $catalog['currency'] ?: 'USD',
        'status' => 'new',
    ];
    $optionalOrderData = [
        'share_link_id' => $context['share_link']['id'] ?? null,
        'seller_id' => $context['seller_id'] ?: null,
        'client_id' => $context['client_id'] ?: null,
        'catalog_slug' => $catalog['slug'],
        'company_name' => $companyName,
        'customer_name' => $companyName !== '' ? $companyName : $contactName,
        'contact_name' => $contactName,
        'customer_email' => $contactEmail,
        'contact_email' => $contactEmail,
        'customer_phone' => $contactPhone,
        'contact_phone' => $contactPhone,
        'address_zone' => $addressZone,
        'seller_name' => $context['seller_name'],
        'source_channel' => $sourceChannel === 'offline-sync' ? 'offline-sync' : 'web',
    ];
    foreach ($optionalOrderData as $column => $value) {
        if (catalog_column_exists('orders', $column)) {
            $orderData[$column] = $value;
        }
    }
    $orderColumns = array_keys($orderData);
    $insertOrder = $pdo->prepare(
        'INSERT INTO orders (`' . implode('`, `', $orderColumns) . '`) VALUES (:' . implode(', :', $orderColumns) . ')'
    );
    $insertOrder->execute($orderData);

    $orderId = (int) $pdo->lastInsertId();

    foreach ($normalizedItems as $item) {
        $itemData = [
            'order_id' => $orderId,
            'item_code' => $item['item_code'],
            'description' => $item['description'],
            'quantity' => $item['quantity'],
        ];
        $optionalItemData = [
            'sale_unit' => $item['sale_unit'],
            'package_label' => $item['package_label'],
            'package_qty' => $item['package_qty'],
            'pieces_total' => $item['pieces_total'],
            'unit_price' => $item['unit_price'],
            'price' => $item['unit_price'],
            'line_total' => $item['line_total'],
        ];
        foreach ($optionalItemData as $column => $value) {
            if (catalog_column_exists('order_items', $column)) {
                $itemData[$column] = $value;
            }
        }
        $itemColumns = array_keys($itemData);
        $insertItem = $pdo->prepare(
            'INSERT INTO order_items (`' . implode('`, `', $itemColumns) . '`) VALUES (:' . implode(', :', $itemColumns) . ')'
        );
        $insertItem->execute($itemData);
    }

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

if (
    catalog_table_exists('order_status_history')
    && catalog_column_exists('order_status_history', 'order_id')
    && catalog_column_exists('order_status_history', 'to_status')
) {
    try {
        $historyData = [
            'order_id' => $orderId,
            'to_status' => 'new',
        ];
        foreach ([
            'from_status' => '',
            'changed_by_user_id' => null,
            'notes' => 'Pedido registrado desde catalogo publico.',
        ] as $column => $value) {
            if (catalog_column_exists('order_status_history', $column)) {
                $historyData[$column] = $value;
            }
        }
        $historyColumns = array_keys($historyData);
        db()->prepare(
            'INSERT INTO order_status_history (`' . implode('`, `', $historyColumns) . '`) VALUES (:' . implode(', :', $historyColumns) . ')'
        )->execute($historyData);
    } catch (Throwable $exception) {
        audit_log('order.history_failed', 'orders', $orderId, [
            'error' => $exception->getMessage(),
        ]);
    }
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
    update_order_columns($orderId, [
        'source_channel' => $sourceChannel === 'offline-sync' ? 'offline-sync' : 'web',
        'export_csv_path' => $exportFiles['csv_path'] ?? '',
        'export_xlsx_path' => $exportFiles['xlsx_path'] ?? '',
        'export_generated_at' => $exportFiles['generated_at'] ?? null,
    ]);
} catch (Throwable $exception) {
    update_order_columns($orderId, [
        'source_channel' => $sourceChannel === 'offline-sync' ? 'offline-sync' : 'web',
        'email_status' => 'failed',
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
    'Contacto comercial: ' . $salesContact['name'],
    'Correo comercial: ' . $salesContact['email'],
    'Telefono comercial: ' . $salesContact['phone'],
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
    $mailStatus = send_notification_mail(
        sprintf('Nuevo pedido %s - %s', $orderNumber, $catalog['title']),
        implode("\n", $lines),
        $mailRecipients,
        $orderId,
        $mailAttachments
    );
} catch (Throwable $exception) {
    $mailStatus = 'failed';
    audit_log('order.notification_failed', 'orders', $orderId, [
        'error' => $exception->getMessage(),
    ]);
}

update_order_columns($orderId, [
    'email_status' => $mailStatus,
    'email_sent_at' => $mailStatus === 'sent' ? date('Y-m-d H:i:s') : null,
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

function update_order_columns(int $orderId, array $values): void
{
    $sets = [];
    $params = ['id' => $orderId];
    foreach ($values as $column => $value) {
        if (!catalog_column_exists('orders', (string) $column)) {
            continue;
        }
        $placeholder = 'v_' . preg_replace('/[^a-z0-9_]+/i', '_', (string) $column);
        $sets[] = '`' . $column . '` = :' . $placeholder;
        $params[$placeholder] = $value;
    }
    if (catalog_column_exists('orders', 'updated_at')) {
        $sets[] = 'updated_at = NOW()';
    }
    if (!$sets) {
        return;
    }
    db()->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
}
