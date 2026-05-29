<?php
declare(strict_types=1);

require dirname(__DIR__) . '/_bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

admin_require_login(['admin']);

$key = openssl_pkey_new([
    'private_key_type' => OPENSSL_KEYTYPE_EC,
    'curve_name' => 'prime256v1',
]);

if (!$key) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'No se pudieron generar llaves VAPID con OpenSSL en este servidor.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$details = openssl_pkey_get_details($key);
$ec = is_array($details) ? ($details['ec'] ?? []) : [];
$public = "\x04" . str_pad((string) ($ec['x'] ?? ''), 32, "\0", STR_PAD_LEFT) . str_pad((string) ($ec['y'] ?? ''), 32, "\0", STR_PAD_LEFT);
$private = (string) ($ec['d'] ?? '');

if (strlen($public) !== 65 || strlen($private) !== 32) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'OpenSSL no entrego las llaves EC esperadas.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'success' => true,
    'vapid_public_key' => admin_push_base64url_encode($public),
    'vapid_private_key' => admin_push_base64url_encode($private),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
