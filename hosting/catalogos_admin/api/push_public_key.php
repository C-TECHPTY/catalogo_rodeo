<?php
declare(strict_types=1);

require dirname(__DIR__) . '/_bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

admin_require_login();

echo json_encode([
    'success' => admin_push_public_key() !== '',
    'public_key' => admin_push_public_key(),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
