<?php
declare(strict_types=1);

require dirname(__DIR__) . '/_bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = current_user();
admin_require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Metodo no permitido'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!admin_push_is_configured()) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Push no configurado.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!admin_table_exists('admin_push_subscriptions')) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Falta la tabla admin_push_subscriptions.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$payload = read_json_input();
$endpoint = trim((string) ($payload['endpoint'] ?? ''));
$keys = is_array($payload['keys'] ?? null) ? $payload['keys'] : [];
$p256dh = trim((string) ($keys['p256dh'] ?? ''));
$auth = trim((string) ($keys['auth'] ?? ''));

if ($endpoint === '' || $p256dh === '' || $auth === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Suscripcion incompleta.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$endpointHash = hash('sha256', $endpoint);
db()->prepare(
    'INSERT INTO admin_push_subscriptions (user_id, endpoint_hash, endpoint, p256dh_key, auth_key, user_agent, is_active)
     VALUES (:user_id, :endpoint_hash, :endpoint, :p256dh_key, :auth_key, :user_agent, 1)
     ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        endpoint = VALUES(endpoint),
        p256dh_key = VALUES(p256dh_key),
        auth_key = VALUES(auth_key),
        user_agent = VALUES(user_agent),
        is_active = 1,
        updated_at = NOW()'
)->execute([
    'user_id' => (int) ($user['id'] ?? 0),
    'endpoint_hash' => $endpointHash,
    'endpoint' => $endpoint,
    'p256dh_key' => $p256dh,
    'auth_key' => $auth,
    'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
]);

echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
