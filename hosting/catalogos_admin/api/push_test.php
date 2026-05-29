<?php
declare(strict_types=1);

require dirname(__DIR__) . '/_bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

admin_require_login(['admin']);

if (!admin_push_is_configured() || !admin_table_exists('admin_push_subscriptions')) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Push no configurado.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$sent = 0;
$failed = 0;
$details = [];
$subscriptions = db()->query(
    'SELECT id, endpoint, p256dh_key, auth_key
     FROM admin_push_subscriptions
     WHERE is_active = 1
     ORDER BY id DESC
     LIMIT 50'
)->fetchAll();

foreach ($subscriptions as $subscription) {
    $result = admin_push_send_subscription($subscription, [
        'title' => 'Prueba de alertas Rodeo',
        'body' => 'Las notificaciones push estan activas en este dispositivo.',
        'url' => '../catalogos_admin/pedidos.php',
        'tag' => 'rodeo-push-test',
    ]);
    if ($result['ok']) {
        $sent++;
    } else {
        $failed++;
        $details[] = [
            'id' => (int) $subscription['id'],
            'status' => (int) ($result['status'] ?? 0),
            'response' => (string) ($result['response'] ?? ''),
        ];
        if (in_array((int) ($result['status'] ?? 0), [404, 410], true)) {
            db()->prepare('UPDATE admin_push_subscriptions SET is_active = 0 WHERE id = :id')->execute([
                'id' => (int) $subscription['id'],
            ]);
        }
    }
}

echo json_encode([
    'success' => true,
    'sent' => $sent,
    'failed' => $failed,
    'details' => $details,
], JSON_UNESCAPED_UNICODE);
