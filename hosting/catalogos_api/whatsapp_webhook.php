<?php
declare(strict_types=1);
require __DIR__ . '/whatsapp_helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $mode = (string) ($_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '');
    $token = (string) ($_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '');
    $challenge = (string) ($_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '');
    $verifyToken = trim((string) whatsapp_config('verify_token', ''));
    if ($mode === 'subscribe' && $challenge !== '' && $verifyToken !== '' && hash_equals($verifyToken, $token)) {
        header('Content-Type: text/plain; charset=utf-8'); echo $challenge; exit;
    }
    http_response_code(403); exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); exit; }
$raw = file_get_contents('php://input') ?: '';
if (!whatsapp_verify_signature($raw)) { whatsapp_log('inbound', 'signature_rejected'); http_response_code(403); exit; }
$event = json_decode($raw, true);
if (!is_array($event) || ($event['object'] ?? '') !== 'whatsapp_business_account') { http_response_code(400); exit; }
foreach (($event['entry'] ?? []) as $entry) foreach (($entry['changes'] ?? []) as $change) {
    $value = is_array($change['value'] ?? null) ? $change['value'] : [];
    foreach (($value['messages'] ?? []) as $message) {
        $id = (string) ($message['id'] ?? ''); $from = whatsapp_normalize_phone((string) ($message['from'] ?? ''));
        if ($id === '' || $from === '') continue;
        $seller = whatsapp_find_active_seller($from);
        if (!whatsapp_record_message('inbound', (string) ($message['type'] ?? 'unknown'), $id, $from, $seller['id'] ?? null, $seller ? 'received' : 'rejected', ['type' => $message['type'] ?? 'unknown'])) continue;
        whatsapp_log('inbound', $seller ? 'received' : 'unauthorized', ['message_id' => $id, 'seller_id' => $seller['id'] ?? null, 'phone' => $from]);
        if ($seller && ($message['type'] ?? '') === 'text') whatsapp_send_text($from, 'Hola ' . $seller['name'] . " 👋\n\nRecibí tu mensaje. El asistente comercial está en configuración.", (int) $seller['id']);
    }
    foreach (($value['statuses'] ?? []) as $status) {
        $id = (string) ($status['id'] ?? ''); if ($id === '') continue;
        $deliveryStatus = (string) ($status['status'] ?? 'unknown');
        db()->prepare('UPDATE whatsapp_messages SET status = :status, updated_at = NOW() WHERE provider_message_id = :id')->execute(['status' => $deliveryStatus, 'id' => $id]);
        whatsapp_record_delivery_status($id, $deliveryStatus);
    }
}
http_response_code(200); header('Content-Type: application/json; charset=utf-8'); echo '{"ok":true}';
