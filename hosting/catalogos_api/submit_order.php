<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$payload = read_json_input();

$slug = slugify((string) ($payload['slug'] ?? ''));
$shareToken = trim((string) ($payload['share_token'] ?? ''));
$sellerToken = trim((string) ($payload['seller_token'] ?? ''));
$companyName = trim((string) ($payload['company_name'] ?? ''));
$contactName = trim((string) ($payload['contact_name'] ?? $payload['customer_name'] ?? ''));
$contactEmail = trim((string) ($payload['contact_email'] ?? $payload['customer_email'] ?? ''));
$contactPhone = trim((string) ($payload['contact_phone'] ?? $payload['customer_phone'] ?? ''));
$addressZone = trim((string) ($payload['address_zone'] ?? ''));
$comments = trim((string) ($payload['comments'] ?? ''));
$sourceChannel = trim((string) ($payload['source_channel'] ?? 'web'));
$customerConfirmed = filter_var($payload['customer_confirmed'] ?? false, FILTER_VALIDATE_BOOLEAN);
$items = $payload['items'] ?? [];

if ($slug === '' || $contactName === '' || $contactPhone === '' || !is_array($items) || !$items) {
    json_response([
        'ok' => false,
        'error' => 'Datos incompletos para registrar el pedido.',
    ], 422);
}

if (!$customerConfirmed) {
    json_response([
        'ok' => false,
        'error' => 'Debes confirmar que revisaste el pedido antes de enviarlo.',
    ], 422);
}

$context = resolve_public_catalog_context($slug, $shareToken, $sellerToken);
$catalog = $context['catalog'];
$orderNumber = next_order_number();
$subtotal = 0.0;
$normalizedItems = [];
$catalogProductImages = build_catalog_product_image_map($catalog);

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
        'image_url' => productImageUrl($item, $catalogProductImages, (string) ($catalog['public_url'] ?? '')),
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
    $clientId = order_resolve_client_id($pdo, [
        'client_id' => $context['client_id'] ?: null,
        'seller_id' => $context['seller_id'] ?: null,
        'company_name' => $companyName,
        'contact_name' => $contactName,
        'contact_email' => $contactEmail,
        'contact_phone' => $contactPhone,
        'address_zone' => $addressZone,
        'order_number' => $orderNumber,
    ]);

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
        'seller_token' => $context['seller_token'] ?: $sellerToken,
        'client_id' => $clientId,
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
        'customer_confirmed' => 1,
        'confirmed_at' => date('Y-m-d H:i:s'),
        'customer_ip' => $_SERVER['REMOTE_ADDR'] ?? '',
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
            'image_url' => $item['image_url'],
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
$sellerDisplayName = (string) (($seller['name'] ?? '') ?: ($context['seller_name'] ?? ''));
$clientDisplayName = $companyName !== '' ? $companyName : $contactName;
$includePublicExportLinks = (bool) catalog_config('mail.include_order_export_links', false);
$publicOrderXlsxUrl = $includePublicExportLinks ? build_public_order_export_url($orderId, $orderNumber, 'xlsx') : '';
$publicOrderCsvUrl = $includePublicExportLinks ? build_public_order_export_url($orderId, $orderNumber, 'csv') : '';
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
    'Vendedor asociado: ' . ($sellerDisplayName ?: 'No definido'),
    'Cliente asociado: ' . ($context['client_name'] ?: 'No definido'),
    'Confirmacion del cliente: Si, revisado y autorizado',
    'Total: ' . format_money($subtotal, (string) ($catalog['currency'] ?: 'USD')),
    '',
    'Detalle:',
];
if ($publicOrderXlsxUrl !== '') {
    array_splice($lines, 16, 0, [
        'Descargar Excel del pedido: ' . $publicOrderXlsxUrl,
        'Descargar CSV del pedido: ' . ($publicOrderCsvUrl ?: 'No disponible'),
    ]);
}

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
$plainBody = implode("\n", $lines);
$orderEmailLogoUrl = trim((string) catalog_config('branding.order_email_logo_url', 'https://rodeoimportzl.com/catalogos_admin/assets/logo-rodeo-blanco.png'));
$orderEmailNoImageUrl = trim((string) catalog_config('branding.order_email_no_image_url', 'https://rodeoimportzl.com/catalogos_admin/assets/no-image.png'));
$orderEmailData = [
    'order_number' => $orderNumber,
    'catalog_title' => (string) ($catalog['title'] ?? ''),
    'catalog_slug' => (string) ($catalog['slug'] ?? ''),
    'company_name' => $companyName,
    'contact_name' => $contactName,
    'contact_email' => $contactEmail,
    'contact_phone' => $contactPhone,
    'address_zone' => $addressZone,
    'seller_name' => $sellerDisplayName,
    'client_name' => (string) ($context['client_name'] ?? ''),
    'customer_confirmed_label' => 'Si, revisado y autorizado',
    'public_order_xlsx_url' => $publicOrderXlsxUrl,
    'public_order_csv_url' => $publicOrderCsvUrl,
    'sales_contact_name' => (string) ($salesContact['name'] ?? ''),
    'sales_contact_email' => (string) ($salesContact['email'] ?? ''),
    'sales_contact_phone' => (string) ($salesContact['phone'] ?? ''),
    'comments' => $comments,
    'total' => $subtotal,
    'currency' => (string) ($catalog['currency'] ?: 'USD'),
    'created_at' => date('Y-m-d H:i:s'),
    'logo_url' => $orderEmailLogoUrl,
    'no_image_url' => $orderEmailNoImageUrl,
];
$htmlBody = build_order_notification_simple_html($orderEmailData, $normalizedItems);

$mailRecipients = build_notification_recipients([
    'contact_email' => $contactEmail,
], $seller);
$mailAttachments = [];
if ((bool) catalog_config('mail.attach_order_exports', true)) {
    if (!empty($exportFiles['xlsx_path'])) {
        $mailAttachments[] = [
            'path' => $exportFiles['xlsx_path'],
            'name' => basename((string) $exportFiles['xlsx_path']),
            'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
    }
    if ((bool) catalog_config('mail.attach_order_csv', false) && !empty($exportFiles['csv_path'])) {
        $mailAttachments[] = [
            'path' => $exportFiles['csv_path'],
            'name' => basename((string) $exportFiles['csv_path']),
            'mime' => 'text/csv',
        ];
    }
}

$mailStatus = 'pending';
try {
    $mailSubject = sprintf(
        'Nuevo pedido confirmado - Vendedor: %s - Cliente: %s',
        $sellerDisplayName !== '' ? $sellerDisplayName : 'Sin vendedor',
        $clientDisplayName !== '' ? $clientDisplayName : 'Sin cliente'
    );
    $mailStatus = send_notification_mail(
        $mailSubject,
        $plainBody,
        $mailRecipients,
        $orderId,
        $mailAttachments,
        $htmlBody
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

try {
    if (function_exists('admin_push_notify_new_order')) {
        admin_push_notify_new_order($orderId, $orderNumber, $clientDisplayName, $sellerDisplayName);
    }
} catch (Throwable $exception) {
    audit_log('order.push_notification_failed', 'orders', $orderId, [
        'error' => $exception->getMessage(),
    ]);
}

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

function order_resolve_client_id(PDO $pdo, array $data): ?int
{
    if (!catalog_table_exists('clients')) {
        return !empty($data['client_id']) ? (int) $data['client_id'] : null;
    }

    $clientId = !empty($data['client_id']) ? (int) $data['client_id'] : 0;
    if ($clientId > 0) {
        order_update_client_from_order($pdo, $clientId, $data);
        return $clientId;
    }

    $clientId = order_find_existing_client($pdo, $data);
    if ($clientId > 0) {
        order_update_client_from_order($pdo, $clientId, $data);
        return $clientId;
    }

    $businessName = trim((string) ($data['company_name'] ?? ''));
    $contactName = trim((string) ($data['contact_name'] ?? ''));
    if ($businessName === '' && $contactName === '') {
        return null;
    }

    $insert = [
        'code' => order_generate_client_code($pdo),
        'business_name' => $businessName !== '' ? $businessName : $contactName,
        'contact_name' => $contactName,
        'email' => filter_var((string) ($data['contact_email'] ?? ''), FILTER_VALIDATE_EMAIL) ? strtolower(trim((string) $data['contact_email'])) : '',
        'phone' => trim((string) ($data['contact_phone'] ?? '')),
        'zone' => trim((string) ($data['address_zone'] ?? '')),
        'seller_id' => !empty($data['seller_id']) ? (int) $data['seller_id'] : null,
        'notes' => 'Creado automaticamente desde pedido ' . trim((string) ($data['order_number'] ?? '')),
        'is_active' => 1,
    ];

    $columns = [];
    $params = [];
    foreach ($insert as $column => $value) {
        if (catalog_column_exists('clients', $column)) {
            $columns[] = $column;
            $params[$column] = $value;
        }
    }

    if (!in_array('business_name', $columns, true)) {
        return null;
    }

    $statement = $pdo->prepare(
        'INSERT INTO clients (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')'
    );
    $statement->execute($params);

    return (int) $pdo->lastInsertId();
}

function order_find_existing_client(PDO $pdo, array $data): int
{
    $email = filter_var((string) ($data['contact_email'] ?? ''), FILTER_VALIDATE_EMAIL) ? strtolower(trim((string) $data['contact_email'])) : '';
    if ($email !== '' && catalog_column_exists('clients', 'email')) {
        $statement = $pdo->prepare('SELECT id FROM clients WHERE LOWER(email) = :email ORDER BY id DESC LIMIT 1');
        $statement->execute(['email' => $email]);
        $id = (int) $statement->fetchColumn();
        if ($id > 0) {
            return $id;
        }
    }

    $phone = trim((string) ($data['contact_phone'] ?? ''));
    if ($phone !== '' && catalog_column_exists('clients', 'phone')) {
        $statement = $pdo->prepare('SELECT id FROM clients WHERE phone = :phone ORDER BY id DESC LIMIT 1');
        $statement->execute(['phone' => $phone]);
        $id = (int) $statement->fetchColumn();
        if ($id > 0) {
            return $id;
        }
    }

    $businessName = trim((string) ($data['company_name'] ?? ''));
    if ($businessName !== '' && catalog_column_exists('clients', 'business_name')) {
        $sql = 'SELECT id FROM clients WHERE business_name = :business_name';
        $params = ['business_name' => $businessName];
        if (!empty($data['seller_id']) && catalog_column_exists('clients', 'seller_id')) {
            $sql .= ' AND (seller_id = :seller_id OR seller_id IS NULL)';
            $params['seller_id'] = (int) $data['seller_id'];
        }
        $sql .= ' ORDER BY id DESC LIMIT 1';
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        return (int) $statement->fetchColumn();
    }

    return 0;
}

function order_update_client_from_order(PDO $pdo, int $clientId, array $data): void
{
    if ($clientId <= 0 || !catalog_table_exists('clients')) {
        return;
    }

    $candidateValues = [
        'contact_name' => trim((string) ($data['contact_name'] ?? '')),
        'email' => filter_var((string) ($data['contact_email'] ?? ''), FILTER_VALIDATE_EMAIL) ? strtolower(trim((string) $data['contact_email'])) : '',
        'phone' => trim((string) ($data['contact_phone'] ?? '')),
        'zone' => trim((string) ($data['address_zone'] ?? '')),
        'seller_id' => !empty($data['seller_id']) ? (int) $data['seller_id'] : null,
    ];

    $sets = [];
    $params = ['id' => $clientId];
    foreach ($candidateValues as $column => $value) {
        if (!catalog_column_exists('clients', $column) || $value === '' || $value === null) {
            continue;
        }
        $sets[] = "`{$column}` = CASE WHEN `{$column}` IS NULL OR `{$column}` = '' THEN :{$column} ELSE `{$column}` END";
        $params[$column] = $value;
    }
    if (catalog_column_exists('clients', 'updated_at')) {
        $sets[] = 'updated_at = NOW()';
    }
    if (!$sets) {
        return;
    }

    $pdo->prepare('UPDATE clients SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
}

function order_generate_client_code(PDO $pdo): string
{
    if (!catalog_column_exists('clients', 'code')) {
        return 'CLI-' . date('YmdHis');
    }

    for ($i = 0; $i < 8; $i++) {
        $code = 'CLI-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $statement = $pdo->prepare('SELECT COUNT(*) FROM clients WHERE code = :code');
        $statement->execute(['code' => $code]);
        if ((int) $statement->fetchColumn() === 0) {
            return $code;
        }
    }

    return 'CLI-' . date('YmdHis') . '-' . random_int(100, 999);
}

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

function build_public_order_export_url(int $orderId, string $orderNumber, string $format = 'xlsx'): string
{
    $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        return '';
    }

    $token = function_exists('order_public_export_token')
        ? order_public_export_token($orderId, $orderNumber)
        : order_public_export_token_fallback($orderId, $orderNumber);
    if ($token === '') {
        return '';
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
    $scheme = $https ? 'https' : 'http';
    $scriptDir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/catalogos_api/submit_order.php')));
    $apiDir = preg_replace('#/catalogos_api/?$#', '/catalogos_api', $scriptDir) ?: '/catalogos_api';

    return $scheme . '://' . $host . rtrim($apiDir, '/') . '/download_order_export.php?' . http_build_query([
        'id' => $orderId,
        'format' => $format === 'csv' ? 'csv' : 'xlsx',
        'token' => $token,
    ]);
}

function order_public_export_token_fallback(int $orderId, string $orderNumber): string
{
    $secret = (string) catalog_config('api_key', '');
    if ($orderId <= 0 || $orderNumber === '' || $secret === '') {
        return '';
    }

    return hash_hmac('sha256', $orderId . '|' . $orderNumber, $secret);
}

function build_order_notification_simple_html(array $order, array $items): string
{
    $currency = (string) (($order['currency'] ?? '') ?: 'USD');
    $total = (float) ($order['total'] ?? 0);
    $customerName = trim((string) (($order['company_name'] ?? '') ?: ($order['contact_name'] ?? '')));
    $sellerName = trim((string) ($order['seller_name'] ?? ''));
    $includeImages = (bool) catalog_config('mail.include_order_item_images', false);
    $rows = '';

    foreach ($items as $item) {
        $imageUrl = safeImageUrl((string) ($item['image_url'] ?? ''), '');
        $imageCell = $includeImages
            ? '<td align="center" style="border:1px solid #d9deea;padding:6px;width:62px;">'
                . ($imageUrl !== ''
                    ? '<img src="' . html_escape($imageUrl) . '" width="54" height="54" alt="' . safeText($item['item_code'] ?? '') . '" style="display:block;width:54px;height:54px;object-fit:contain;border:0;">'
                    : '<span style="font-size:11px;color:#667085;">Sin imagen</span>')
                . '</td>'
            : '';
        $rows .= '<tr>'
            . $imageCell
            . '<td style="border:1px solid #d9deea;padding:8px;">' . safeText($item['item_code'] ?? '') . '</td>'
            . '<td style="border:1px solid #d9deea;padding:8px;">' . safeText($item['description'] ?? '') . '</td>'
            . '<td align="center" style="border:1px solid #d9deea;padding:8px;">' . html_escape(format_plain_number((float) ($item['quantity'] ?? 0))) . '</td>'
            . '<td align="center" style="border:1px solid #d9deea;padding:8px;">' . safeText($item['package_label'] ?? '') . ' ' . html_escape(format_plain_number((float) ($item['package_qty'] ?? 0))) . '</td>'
            . '<td align="center" style="border:1px solid #d9deea;padding:8px;">' . html_escape(format_plain_number((float) ($item['pieces_total'] ?? 0))) . '</td>'
            . '<td align="right" style="border:1px solid #d9deea;padding:8px;">' . money((float) ($item['unit_price'] ?? 0), $currency) . '</td>'
            . '<td align="right" style="border:1px solid #d9deea;padding:8px;font-weight:700;">' . money((float) ($item['line_total'] ?? 0), $currency) . '</td>'
            . '</tr>';
    }

    if ($rows === '') {
        $rows = '<tr><td colspan="' . ($includeImages ? '8' : '7') . '" style="border:1px solid #d9deea;padding:10px;text-align:center;color:#667085;">Sin productos</td></tr>';
    }

    $imageHeader = $includeImages
        ? '<th align="center" style="border:1px solid #d9deea;padding:8px;color:#2c4695;width:62px;">Imagen</th>'
        : '';

    return '<!doctype html><html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>'
        . '<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#172033;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f8;"><tr><td align="center" style="padding:24px 12px;">'
        . '<table role="presentation" width="760" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:760px;background:#ffffff;border:1px solid #d9deea;border-collapse:collapse;">'
        . '<tr><td style="background:#2c4695;color:#ffffff;padding:24px 26px;">'
        . '<div style="font-size:26px;line-height:32px;font-weight:700;">Rodeo Import</div>'
        . '<div style="font-size:13px;line-height:18px;color:#dfe7ff;margin-top:4px;font-weight:700;">Nuevo pedido confirmado</div>'
        . '<div style="font-size:28px;line-height:36px;font-weight:700;margin-top:18px;">' . safeText($order['order_number'] ?? '') . '</div>'
        . '</td></tr>'
        . '<tr><td style="padding:20px 24px;">'
        . '<p style="margin:0 0 12px;font-size:15px;line-height:22px;">Se registro un nuevo pedido confirmado desde el catalogo publico.</p>'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 0 18px;">'
        . '<tr>'
        . simple_email_summary_card('Pedido', $order['order_number'] ?? '')
        . simple_email_summary_card('Catalogo', $order['catalog_title'] ?? '')
        . simple_email_summary_card('Cliente', $customerName)
        . simple_email_summary_card('Total', money($total, $currency))
        . '</tr>'
        . '</table>'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 0 18px;">'
        . simple_email_meta_row('Pedido', $order['order_number'] ?? '')
        . simple_email_meta_row('Catalogo', $order['catalog_title'] ?? '')
        . simple_email_meta_row('Cliente', $customerName)
        . simple_email_meta_row('Contacto', $order['contact_name'] ?? '')
        . simple_email_meta_row('Correo', $order['contact_email'] ?? '')
        . simple_email_meta_row('Telefono', $order['contact_phone'] ?? '')
        . simple_email_meta_row('Zona / Direccion', $order['address_zone'] ?? '')
        . simple_email_meta_row('Vendedor', $sellerName !== '' ? $sellerName : 'No definido')
        . simple_email_meta_row('Total', money($total, $currency))
        . '</table>'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">'
        . '<tr style="background:#eef2fb;">'
        . $imageHeader
        . '<th align="left" style="border:1px solid #d9deea;padding:8px;color:#2c4695;">Item</th>'
        . '<th align="left" style="border:1px solid #d9deea;padding:8px;color:#2c4695;">Descripcion</th>'
        . '<th align="center" style="border:1px solid #d9deea;padding:8px;color:#2c4695;">Cantidad</th>'
        . '<th align="center" style="border:1px solid #d9deea;padding:8px;color:#2c4695;">Empaque</th>'
        . '<th align="center" style="border:1px solid #d9deea;padding:8px;color:#2c4695;">Piezas</th>'
        . '<th align="right" style="border:1px solid #d9deea;padding:8px;color:#2c4695;">Unitario</th>'
        . '<th align="right" style="border:1px solid #d9deea;padding:8px;color:#2c4695;">Total</th>'
        . '</tr>' . $rows
        . '</table>'
        . '<table role="presentation" width="280" cellspacing="0" cellpadding="0" border="0" align="right" style="border-collapse:collapse;margin-top:18px;background:#2c4695;">'
        . '<tr><td style="padding:12px 16px;color:#dfe7ff;font-size:12px;font-weight:700;">TOTAL DEL PEDIDO</td></tr>'
        . '<tr><td style="padding:0 16px 16px 16px;color:#ffffff;font-size:24px;line-height:30px;font-weight:700;">' . money($total, $currency) . '</td></tr>'
        . '</table>'
        . '<div style="clear:both;"></div>'
        . '<p style="margin:18px 0 0;color:#667085;font-size:12px;line-height:18px;">El archivo Excel del pedido va adjunto a este correo. Este correo fue generado automaticamente por Catalogo Rodeo B2B.</p>'
        . '</td></tr></table></td></tr></table></body></html>';
}

function simple_email_summary_card(string $label, mixed $value): string
{
    return '<td width="25%" style="border:1px solid #d9deea;background:#f8faff;padding:12px;vertical-align:top;">'
        . '<div style="font-size:11px;line-height:16px;color:#667085;font-weight:700;text-transform:uppercase;">' . safeText($label) . '</div>'
        . '<div style="font-size:14px;line-height:19px;color:#172033;font-weight:700;margin-top:4px;">' . order_email_value($value) . '</div>'
        . '</td>';
}

function simple_email_meta_row(string $label, mixed $value): string
{
    return '<tr>'
        . '<td style="width:160px;border:1px solid #d9deea;padding:8px;background:#f8faff;color:#667085;font-weight:700;">' . safeText($label) . '</td>'
        . '<td style="border:1px solid #d9deea;padding:8px;color:#172033;">' . order_email_value($value) . '</td>'
        . '</tr>';
}

function build_order_notification_html(array $order, array $items): string
{
    $brandColor = '#2c4695';
    $lightBg = '#f4f6f8';
    $currency = (string) (($order['currency'] ?? '') ?: 'USD');
    $total = (float) ($order['total'] ?? 0);
    $logoUrl = trim((string) ($order['logo_url'] ?? ''));
    $noImageUrl = trim((string) ($order['no_image_url'] ?? 'https://rodeoimportzl.com/catalogos_admin/assets/no-image.png'));
    $whatsAppUrl = cleanPhone($order['contact_phone'] ?? '') !== '' ? 'https://wa.me/507' . cleanPhone($order['contact_phone'] ?? '') : '';
    $logoHtml = $logoUrl !== ''
        ? '<img src="' . html_escape($logoUrl) . '" width="220" alt="RODEO IMPORT" style="display:block;border:0;outline:none;text-decoration:none;max-width:220px;width:220px;height:auto;color:#ffffff;font-size:24px;font-weight:700;">'
        : '<span style="font-size:24px;font-weight:700;letter-spacing:.5px;color:#ffffff;">RODEO IMPORT</span>';

    $rows = '';
    $totalProducts = count($items);
    $visibleItems = array_slice($items, 0, 15);
    $limitNote = $totalProducts > 15
        ? '<tr><td style="background:#ffffff;padding:0 24px 12px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef2fb;border:1px solid #d9deea;border-collapse:collapse;border-radius:8px;"><tr><td style="padding:12px 14px;color:#2c4695;font-size:13px;font-weight:700;">Este pedido contiene ' . (int) $totalProducts . ' productos. Se muestran los primeros 15.</td></tr></table></td></tr>'
        : '';
    foreach ($visibleItems as $item) {
        $imageUrl = safeImageUrl((string) ($item['image_url'] ?? ''), $noImageUrl);
        $rows .= '<tr>'
            . '<td align="center" style="padding:12px 10px;border-bottom:1px solid #e6e9f2;"><img src="' . html_escape($imageUrl) . '" width="64" height="64" alt="' . safeText($item['item_code'] ?? '') . '" style="display:block;width:64px;height:64px;object-fit:contain;border:1px solid #e4e7ec;border-radius:8px;background:#ffffff;"></td>'
            . '<td style="padding:12px 10px;border-bottom:1px solid #e6e9f2;color:#172033;font-size:13px;font-weight:700;">' . safeText($item['item_code'] ?? '') . '</td>'
            . '<td style="padding:12px 10px;border-bottom:1px solid #e6e9f2;color:#172033;font-size:13px;line-height:18px;">' . safeText($item['description'] ?? '') . '</td>'
            . '<td align="center" style="padding:12px 10px;border-bottom:1px solid #e6e9f2;color:#172033;font-size:13px;">' . html_escape(format_plain_number((float) ($item['quantity'] ?? 0))) . '</td>'
            . '<td align="center" style="padding:12px 10px;border-bottom:1px solid #e6e9f2;color:#172033;font-size:13px;">' . safeText(trim((string) (($item['package_label'] ?? '') . ' ' . format_plain_number((float) ($item['package_qty'] ?? 0))))) . '</td>'
            . '<td align="center" style="padding:12px 10px;border-bottom:1px solid #e6e9f2;color:#172033;font-size:13px;">' . html_escape(format_plain_number((float) ($item['pieces_total'] ?? 0))) . '</td>'
            . '<td align="right" style="padding:12px 10px;border-bottom:1px solid #e6e9f2;color:#172033;font-size:13px;">' . money((float) ($item['unit_price'] ?? 0), $currency) . '</td>'
            . '<td align="right" style="padding:12px 10px;border-bottom:1px solid #e6e9f2;color:#172033;font-size:13px;font-weight:700;">' . money((float) ($item['line_total'] ?? 0), $currency) . '</td>'
            . '</tr>';
    }

    if ($rows === '') {
        $rows = '<tr><td colspan="8" style="padding:14px 12px;color:#667085;font-size:13px;text-align:center;">No definido</td></tr>';
    }

    return '<!doctype html>'
        . '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Nuevo pedido B2B recibido</title></head>'
        . '<body style="margin:0;padding:0;background:' . $lightBg . ';font-family:Arial,Helvetica,sans-serif;color:#172033;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:' . $lightBg . ';margin:0;padding:0;"><tr><td align="center" style="padding:28px 12px;">'
        . '<table role="presentation" width="760" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:760px;border-collapse:collapse;">'
        . '<tr><td style="background:' . $brandColor . ';padding:28px 30px;border-radius:12px 12px 0 0;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="left" style="vertical-align:middle;">' . $logoHtml . '</td><td align="right" style="vertical-align:middle;color:#dfe7ff;font-size:12px;font-weight:700;">Nuevo pedido B2B recibido</td></tr></table>'
        . '<div style="font-size:30px;line-height:38px;font-weight:700;color:#ffffff;margin-top:22px;">' . safeText($order['order_number'] ?? '') . '</div>'
        . '<div style="font-size:14px;line-height:21px;color:#dfe7ff;margin-top:6px;">Pedido registrado desde el catálogo público de Rodeo Import.</div>'
        . '</td></tr>'
        . '<tr><td style="background:#ffffff;padding:22px 24px 8px 24px;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>'
        . order_email_summary_card('Pedido', $order['order_number'] ?? '')
        . '<td width="10" style="font-size:0;line-height:0;">&nbsp;</td>'
        . order_email_summary_card('Catálogo', $order['catalog_title'] ?? '')
        . '<td width="10" style="font-size:0;line-height:0;">&nbsp;</td>'
        . order_email_summary_card('Cliente', ($order['company_name'] ?? '') ?: ($order['contact_name'] ?? ''))
        . '<td width="10" style="font-size:0;line-height:0;">&nbsp;</td>'
        . order_email_summary_card('Total', $currency . ' ' . number_format($total, 2, '.', ','))
        . '</tr></table>'
        . '</td></tr>'
        . '<tr><td style="background:#ffffff;padding:14px 24px 10px 24px;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>'
        . order_email_info_card('Datos del cliente', [
            'Empresa' => $order['company_name'] ?? '',
            'Contacto' => $order['contact_name'] ?? '',
            'Correo' => $order['contact_email'] ?? '',
            'Teléfono' => $order['contact_phone'] ?? '',
            'Zona / Dirección' => $order['address_zone'] ?? '',
        ])
        . '<td width="14" style="font-size:0;line-height:0;">&nbsp;</td>'
        . order_email_info_card('Contacto comercial', [
            'Contacto comercial' => $order['sales_contact_name'] ?? '',
            'Correo comercial' => $order['sales_contact_email'] ?? '',
            'Teléfono comercial' => $order['sales_contact_phone'] ?? '',
            'Vendedor' => $order['seller_name'] ?? '',
            'Cliente asociado' => $order['client_name'] ?? '',
            'Confirmacion cliente' => $order['customer_confirmed_label'] ?? '',
        ])
        . '</tr></table>'
        . '</td></tr>'
        . order_email_export_links_block((string) ($order['public_order_xlsx_url'] ?? ''), (string) ($order['public_order_csv_url'] ?? ''))
        . $limitNote
        . '<tr><td style="background:#ffffff;padding:12px 24px 0 24px;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d9deea;border-collapse:collapse;">'
        . '<tr style="background:#eef2fb;">'
        . '<th align="center" style="padding:12px 10px;color:' . $brandColor . ';font-size:12px;">Imagen</th>'
        . '<th align="left" style="padding:12px 10px;color:' . $brandColor . ';font-size:12px;">Item</th>'
        . '<th align="left" style="padding:12px 10px;color:' . $brandColor . ';font-size:12px;">Descripción</th>'
        . '<th align="center" style="padding:12px 10px;color:' . $brandColor . ';font-size:12px;">Cantidad</th>'
        . '<th align="center" style="padding:12px 10px;color:' . $brandColor . ';font-size:12px;">Empaque</th>'
        . '<th align="center" style="padding:12px 10px;color:' . $brandColor . ';font-size:12px;">Piezas</th>'
        . '<th align="right" style="padding:12px 10px;color:' . $brandColor . ';font-size:12px;">Precio unitario</th>'
        . '<th align="right" style="padding:12px 10px;color:' . $brandColor . ';font-size:12px;">Total</th>'
        . '</tr>' . $rows
        . '</table>'
        . '</td></tr>'
        . '<tr><td align="right" style="background:#ffffff;padding:20px 24px;">'
        . '<table role="presentation" width="280" cellspacing="0" cellpadding="0" border="0" style="background:' . $brandColor . ';border-collapse:collapse;border-radius:10px;"><tr><td style="padding:16px 18px;color:#dfe7ff;font-size:12px;font-weight:700;text-transform:uppercase;">TOTAL DEL PEDIDO</td></tr><tr><td style="padding:0 18px 18px 18px;color:#ffffff;font-size:26px;line-height:32px;font-weight:700;">' . money($total, $currency) . '</td></tr></table>'
        . '</td></tr>'
        . order_email_comments_block((string) ($order['comments'] ?? ''))
        . order_email_whatsapp_button($whatsAppUrl)
        . '<tr><td style="background:#ffffff;padding:20px 24px 28px 24px;border-top:1px solid #e6e9f2;border-radius:0 0 12px 12px;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="color:#667085;font-size:12px;line-height:18px;">Rodeo Import · Sistema de Catálogos B2B<br>Este correo fue generado automáticamente.</td></tr></table>'
        . '</td></tr>'
        . '</table>'
        . '</td></tr></table>'
        . '</body></html>';
}

function order_email_info_card(string $title, array $rows): string
{
    $html = '<td width="50%" style="vertical-align:top;background:#ffffff;border:1px solid #dfe5f2;border-radius:8px;padding:16px;">'
        . '<div style="font-size:15px;font-weight:700;color:#2c4695;margin-bottom:12px;">' . safeText($title) . '</div>';
    foreach ($rows as $label => $value) {
        $html .= '<div style="font-size:12px;line-height:18px;color:#667085;margin-top:7px;">' . safeText($label) . '</div>'
            . '<div style="font-size:14px;line-height:20px;color:#172033;font-weight:600;">' . safeText($value) . '</div>';
    }
    return $html . '</td>';
}

function order_email_summary_card(string $label, mixed $value): string
{
    return '<td width="25%" style="vertical-align:top;background:#f8faff;border:1px solid #dfe5f2;border-radius:8px;padding:14px;">'
        . '<div style="font-size:11px;line-height:16px;color:#667085;text-transform:uppercase;font-weight:700;">' . safeText($label) . '</div>'
        . '<div style="font-size:15px;line-height:20px;color:#172033;font-weight:700;margin-top:5px;">' . safeText($value) . '</div>'
        . '</td>';
}

function order_email_comments_block(string $comments): string
{
    if (trim($comments) === '') {
        return '';
    }

    return '<tr><td style="background:#ffffff;padding:0 24px 20px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff8e6;border:1px solid #f3d68a;border-collapse:collapse;border-radius:8px;"><tr><td style="padding:13px 14px;"><div style="font-size:13px;font-weight:700;color:#8a6100;margin-bottom:6px;">Observaciones</div><div style="font-size:13px;line-height:19px;color:#172033;">' . safeText($comments) . '</div></td></tr></table></td></tr>';
}

function order_email_export_links_block(string $xlsxUrl, string $csvUrl): string
{
    $xlsxUrl = trim($xlsxUrl);
    $csvUrl = trim($csvUrl);
    if ($xlsxUrl === '' && $csvUrl === '') {
        return '';
    }

    $buttons = '';
    if ($xlsxUrl !== '') {
        $buttons .= '<td align="center" style="background:#16a34a;border-radius:8px;"><a href="' . html_escape($xlsxUrl) . '" style="display:inline-block;padding:12px 16px;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;">Descargar Excel</a></td>';
    }
    if ($xlsxUrl !== '' && $csvUrl !== '') {
        $buttons .= '<td width="10" style="font-size:0;line-height:0;">&nbsp;</td>';
    }
    if ($csvUrl !== '') {
        $buttons .= '<td align="center" style="background:#475467;border-radius:8px;"><a href="' . html_escape($csvUrl) . '" style="display:inline-block;padding:12px 16px;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;">Descargar CSV</a></td>';
    }

    return '<tr><td align="center" style="background:#ffffff;padding:0 24px 18px 24px;">'
        . '<div style="font-size:13px;line-height:19px;color:#667085;margin-bottom:10px;">Copia descargable del pedido para cliente y facturacion.</div>'
        . '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tr>' . $buttons . '</tr></table>'
        . '</td></tr>';
}

function order_email_value(mixed $value): string
{
    return safeText($value);
}

function order_email_whatsapp_button(string $whatsAppUrl): string
{
    if ($whatsAppUrl === '') {
        return '';
    }

    return '<tr><td align="center" style="background:#ffffff;padding:0 24px 24px 24px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tr><td align="center" style="background:#25d366;border-radius:8px;"><a href="' . html_escape($whatsAppUrl) . '" style="display:inline-block;padding:13px 18px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Contactar cliente por WhatsApp</a></td></tr></table></td></tr>';
}
