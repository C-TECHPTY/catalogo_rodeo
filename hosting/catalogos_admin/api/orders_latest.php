<?php
declare(strict_types=1);

require dirname(__DIR__) . '/_bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (!current_user()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autenticado'], JSON_UNESCAPED_UNICODE);
    exit;
}

admin_require_login();

if (!admin_table_exists('orders')) {
    echo json_encode([
        'success' => true,
        'latest_order_id' => null,
        'latest_order_number' => '',
        'created_at' => '',
        'customer_name' => '',
        'company_name' => '',
        'seller_name' => '',
        'status' => '',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$hasSellers = admin_table_exists('sellers');
$columns = [];
foreach (['id', 'order_number', 'created_at', 'company_name', 'customer_name', 'contact_name', 'seller_name', 'seller_id', 'status', 'deleted_at'] as $column) {
    $columns[$column] = admin_column_exists('orders', $column);
}

$orderNumberExpr = $columns['order_number'] ? 'o.order_number' : "CONCAT('PED-', o.id)";
$createdAtExpr = $columns['created_at'] ? 'o.created_at' : "''";
$companyExpr = $columns['company_name'] ? 'o.company_name' : "''";
$customerExpr = $columns['customer_name'] ? 'o.customer_name' : ($columns['contact_name'] ? 'o.contact_name' : "''");
$statusExpr = $columns['status'] ? 'o.status' : "'new'";
$sellerJoin = $hasSellers && $columns['seller_id'] ? 'LEFT JOIN sellers s ON s.id = o.seller_id' : '';
$sellerExpr = $hasSellers && $columns['seller_id'] ? 'COALESCE(s.name, \'\')' : ($columns['seller_name'] ? 'o.seller_name' : "''");
$where = $columns['deleted_at'] ? 'WHERE o.deleted_at IS NULL' : '';
$orderBy = $columns['created_at'] ? 'o.created_at DESC, o.id DESC' : 'o.id DESC';

$statement = db()->query(
    "SELECT o.id,
            {$orderNumberExpr} AS order_number,
            {$createdAtExpr} AS created_at,
            {$companyExpr} AS company_name,
            {$customerExpr} AS customer_name,
            {$sellerExpr} AS seller_name,
            {$statusExpr} AS status
     FROM orders o
     {$sellerJoin}
     {$where}
     ORDER BY {$orderBy}
     LIMIT 1"
);
$order = $statement ? $statement->fetch() : null;

echo json_encode([
    'success' => true,
    'latest_order_id' => $order ? (int) $order['id'] : null,
    'latest_order_number' => $order ? (string) ($order['order_number'] ?? '') : '',
    'created_at' => $order ? (string) ($order['created_at'] ?? '') : '',
    'customer_name' => $order ? (string) ($order['customer_name'] ?? '') : '',
    'company_name' => $order ? (string) ($order['company_name'] ?? '') : '',
    'seller_name' => $order ? (string) ($order['seller_name'] ?? '') : '',
    'status' => $order ? (string) ($order['status'] ?? '') : '',
], JSON_UNESCAPED_UNICODE);
