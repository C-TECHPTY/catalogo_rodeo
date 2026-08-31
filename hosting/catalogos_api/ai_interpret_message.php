<?php
declare(strict_types=1);
require __DIR__ . '/ai_helpers.php';
require __DIR__ . '/openai_service.php';

$payload = ai_request_payload();
$sender = ai_normalize_phone((string) ($payload['sender'] ?? ''));
$seller = ai_find_seller_by_sender($sender);
if (!$seller) {
    ai_log('nlu.denied', ['reason' => 'seller_not_authorized']);
    json_response(['ok' => false, 'error' => 'Vendedor no autorizado.'], 403);
}
$message = trim((string) ($payload['message'] ?? ''));
if ($message === '') json_response(['ok' => false, 'error' => 'Debes indicar message.'], 422);
$result = openai_interpret_commercial_message($message);
if (!$result['ok']) {
    // Safe fallback: no operation is authorized when NLU is unavailable.
    json_response(['ok' => true, 'interpreted' => false, 'fallback' => true, 'intent' => ['intent' => 'unknown', 'items' => [], 'categories' => [], 'brands' => [], 'price_factor' => null, 'only_available' => false, 'delivery' => 'none']]);
}
ai_log('nlu.interpreted', ['seller_id' => $seller['id'], 'intent' => $result['intent']['intent']]);
json_response(['ok' => true, 'interpreted' => true, 'fallback' => false, 'intent' => $result['intent']]);
