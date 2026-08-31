<?php
declare(strict_types=1);

/** Official WhatsApp Cloud API integration. It never exposes credentials to callers. */
require_once __DIR__ . '/bootstrap.php';

function whatsapp_config(string $key, mixed $default = null): mixed
{
    $envName = 'WHATSAPP_' . strtoupper(str_replace('.', '_', $key));
    $envValue = getenv($envName);
    if ($envValue !== false && $envValue !== '') {
        return $envValue;
    }
    return catalog_config('whatsapp.' . $key, $default);
}

function whatsapp_is_enabled(): bool
{
    $value = getenv('WHATSAPP_ENABLED');
    if ($value !== false && $value !== '') {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
    return (bool) whatsapp_config('enabled', false);
}

function whatsapp_normalize_phone(string $phone): string
{
    return preg_replace('/\D+/', '', $phone) ?? '';
}

function whatsapp_find_active_seller(string $phone): ?array
{
    $phone = whatsapp_normalize_phone($phone);
    if ($phone === '') return null;
    $statement = db()->prepare("SELECT id, code, name, email, phone, public_token FROM sellers
        WHERE is_active = 1
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '(', ''), ')', '') = :phone
        LIMIT 1");
    $statement->execute(['phone' => $phone]);
    $seller = $statement->fetch();
    return $seller ?: null;
}

function whatsapp_log(string $direction, string $eventType, array $context = []): void
{
    $safe = [];
    foreach ($context as $key => $value) {
        $safe[$key] = preg_match('/token|secret|authorization/i', (string) $key) ? '[REDACTED]' : $value;
    }
    try {
        audit_log('whatsapp.' . $direction . '.' . $eventType, 'whatsapp', null, $safe);
    } catch (Throwable) {
    }
}

function whatsapp_verify_signature(string $rawBody): bool
{
    $secret = trim((string) whatsapp_config('app_secret', ''));
    if ($secret === '') return false;
    $provided = (string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
    $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
    return $provided !== '' && hash_equals($expected, $provided);
}

function whatsapp_record_message(string $direction, string $eventType, string $providerMessageId, string $phone, ?int $sellerId, string $status, array $payload = []): bool
{
    try {
        $statement = db()->prepare('INSERT INTO whatsapp_messages
            (direction, event_type, provider_message_id, phone, seller_id, status, payload_json)
            VALUES (:direction, :event_type, :provider_message_id, :phone, :seller_id, :status, :payload_json)');
        $statement->execute([
            'direction' => $direction, 'event_type' => $eventType, 'provider_message_id' => $providerMessageId,
            'phone' => $phone, 'seller_id' => $sellerId, 'status' => $status,
            'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        return true;
    } catch (PDOException $exception) {
        if ($exception->getCode() === '23000') return false; // Event already handled.
        throw $exception;
    }
}

function whatsapp_record_delivery_status(string $providerMessageId, string $status): void
{
    try {
        $messageId = db()->prepare('SELECT id FROM whatsapp_messages WHERE provider_message_id = :id LIMIT 1');
        $messageId->execute(['id' => $providerMessageId]);
        $messageId = $messageId->fetchColumn();
        db()->prepare('INSERT INTO whatsapp_delivery_logs (whatsapp_message_id, provider_message_id, status) VALUES (:message_id, :provider_message_id, :status)')
            ->execute(['message_id' => $messageId ?: null, 'provider_message_id' => $providerMessageId, 'status' => $status]);
    } catch (Throwable) {
        // Logs are observability only; Meta must still receive a 200 acknowledgement.
    }
}

function whatsapp_send_text(string $to, string $body, ?int $sellerId = null): array
{
    if (!whatsapp_is_enabled()) return ['ok' => false, 'error' => 'WhatsApp esta deshabilitado.'];
    $token = trim((string) whatsapp_config('access_token', ''));
    $phoneNumberId = trim((string) whatsapp_config('phone_number_id', ''));
    if ($token === '' || $phoneNumberId === '') return ['ok' => false, 'error' => 'Configuracion WhatsApp incompleta.'];
    if (!function_exists('curl_init')) return ['ok' => false, 'error' => 'La extension cURL no esta disponible.'];

    $url = 'https://graph.facebook.com/' . rawurlencode((string) whatsapp_config('api_version', 'v22.0')) . '/' . rawurlencode($phoneNumberId) . '/messages';
    $body = mb_substr(trim($body), 0, 4096);
    $payload = ['messaging_product' => 'whatsapp', 'to' => whatsapp_normalize_phone($to), 'type' => 'text', 'text' => ['body' => $body]];
    $curl = curl_init($url);
    curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => (int) whatsapp_config('timeout', 20), CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'], CURLOPT_POSTFIELDS => json_encode($payload)]);
    $response = curl_exec($curl);
    $httpCode = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    $decoded = is_string($response) ? json_decode($response, true) : null;
    $providerId = is_array($decoded) ? (string) ($decoded['messages'][0]['id'] ?? '') : '';
    $ok = $httpCode >= 200 && $httpCode < 300 && $providerId !== '';
    whatsapp_record_message('outbound', 'text', $providerId !== '' ? $providerId : ('failed-' . bin2hex(random_bytes(8))), whatsapp_normalize_phone($to), $sellerId, $ok ? 'sent' : 'failed', ['http_status' => $httpCode]);
    whatsapp_log('outbound', $ok ? 'sent' : 'failed', ['seller_id' => $sellerId, 'phone' => whatsapp_normalize_phone($to), 'http_status' => $httpCode]);
    return ['ok' => $ok, 'provider_message_id' => $providerId, 'error' => $ok ? '' : ($curlError ?: 'Meta API rechazo el mensaje.')];
}
