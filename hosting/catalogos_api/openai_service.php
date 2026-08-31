<?php
declare(strict_types=1);

/** Backend-only OpenAI Responses API client for commercial intent extraction. */
require_once __DIR__ . '/bootstrap.php';

function openai_config(string $key, mixed $default = null): mixed
{
    $envName = 'OPENAI_' . strtoupper(str_replace('.', '_', $key));
    $envValue = getenv($envName);
    if ($envValue !== false && $envValue !== '') return $envValue;
    return catalog_config('openai.' . $key, $default);
}

function openai_enabled(): bool
{
    $value = getenv('AI_ENABLED');
    if ($value !== false && $value !== '') return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    return (bool) openai_config('enabled', false);
}

function openai_intent_schema(): array
{
    return [
        'type' => 'object', 'additionalProperties' => false,
        'required' => ['intent', 'items', 'categories', 'brands', 'price_factor', 'only_available', 'delivery'],
        'properties' => [
            'intent' => ['type' => 'string', 'enum' => ['product_details', 'product_image', 'product_stock', 'product_price', 'product_search', 'multiple_products', 'generate_catalog', 'catalog_status', 'send_catalog', 'order_analysis', 'order_excel', 'order_pdf', 'cross_sell', 'help', 'unknown']],
            'items' => ['type' => 'array', 'items' => ['type' => 'string'], 'maxItems' => 10],
            'categories' => ['type' => 'array', 'items' => ['type' => 'string'], 'maxItems' => 10],
            'brands' => ['type' => 'array', 'items' => ['type' => 'string'], 'maxItems' => 10],
            'price_factor' => ['type' => ['number', 'null']],
            'only_available' => ['type' => 'boolean'],
            'delivery' => ['type' => 'string', 'enum' => ['whatsapp', 'email', 'both', 'none']],
        ],
    ];
}

function openai_validate_intent(array $intent): ?array
{
    $allowed = openai_intent_schema()['properties']['intent']['enum'];
    if (!in_array($intent['intent'] ?? null, $allowed, true)) return null;
    foreach (['items', 'categories', 'brands'] as $key) {
        if (!is_array($intent[$key] ?? null) || count($intent[$key]) > 10) return null;
        $intent[$key] = array_values(array_filter(array_map(static fn(mixed $value): string => trim((string) $value), $intent[$key])));
    }
    $factor = $intent['price_factor'] ?? null;
    if ($factor !== null && (!is_numeric($factor) || (float) $factor <= 0 || (float) $factor > 1)) return null;
    $intent['price_factor'] = $factor === null ? null : (float) $factor;
    if (!is_bool($intent['only_available'] ?? null) || !in_array($intent['delivery'] ?? null, ['whatsapp', 'email', 'both', 'none'], true)) return null;
    return $intent;
}

function openai_extract_output(array $response): ?array
{
    $text = (string) ($response['output_text'] ?? '');
    if ($text === '') foreach (($response['output'] ?? []) as $item) foreach (($item['content'] ?? []) as $content) {
        if (($content['type'] ?? '') === 'output_text') { $text .= (string) ($content['text'] ?? ''); }
    }
    $decoded = json_decode($text, true);
    return is_array($decoded) ? openai_validate_intent($decoded) : null;
}

function openai_interpret_commercial_message(string $message): array
{
    if (!openai_enabled()) return ['ok' => false, 'reason' => 'disabled'];
    $key = trim((string) openai_config('api_key', ''));
    if ($key === '') return ['ok' => false, 'reason' => 'not_configured'];
    if (!function_exists('curl_init')) return ['ok' => false, 'reason' => 'curl_unavailable'];

    $payload = [
        'model' => (string) openai_config('model', 'gpt-4.1-mini'), 'store' => false, 'max_output_tokens' => 400,
        'instructions' => 'Clasifica el mensaje comercial en JSON estricto. No inventes precio, stock, SKU, productos, vendedor, pedido ni enlaces. Solo interpreta la intención. Convierte "al .55", "al 55%" o "factor .55" a 0.55. Si falta información usa listas vacías, null, false y delivery none.',
        'input' => [['role' => 'user', 'content' => [['type' => 'input_text', 'text' => mb_substr(trim($message), 0, 1500)]]]],
        'text' => ['format' => ['type' => 'json_schema', 'name' => 'commercial_intent', 'strict' => true, 'schema' => openai_intent_schema()]],
    ];
    $attempts = max(0, min(2, (int) openai_config('max_retries', 2))) + 1;
    for ($attempt = 1; $attempt <= $attempts; $attempt++) {
        $curl = curl_init('https://api.openai.com/v1/responses');
        curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => (int) openai_config('timeout', 20), CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key, 'Content-Type: application/json'], CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
        $raw = curl_exec($curl); $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE); $error = curl_error($curl); curl_close($curl);
        $response = is_string($raw) ? json_decode($raw, true) : null;
        if ($status >= 200 && $status < 300 && is_array($response)) {
            $intent = openai_extract_output($response);
            if ($intent) {
                ai_log('nlu.completed', ['model' => $payload['model'], 'input_tokens' => $response['usage']['input_tokens'] ?? null, 'output_tokens' => $response['usage']['output_tokens'] ?? null]);
                return ['ok' => true, 'intent' => $intent];
            }
            return ['ok' => false, 'reason' => 'invalid_output'];
        }
        if ($attempt < $attempts && ($status === 429 || $status >= 500 || $status === 0)) { usleep(200000 * $attempt); continue; }
        ai_log('nlu.failed', ['http_status' => $status, 'reason' => $error !== '' ? 'transport_error' : 'api_error']);
        return ['ok' => false, 'reason' => $status === 429 ? 'rate_limited' : 'unavailable'];
    }
    return ['ok' => false, 'reason' => 'unavailable'];
}
