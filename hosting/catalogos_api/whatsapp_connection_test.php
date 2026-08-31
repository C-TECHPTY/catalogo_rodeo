<?php
declare(strict_types=1);
require __DIR__ . '/whatsapp_helpers.php';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_response(['ok' => false, 'error' => 'Metodo no permitido.'], 405);
$payload = read_json_input(); require_api_key($payload);
$to = whatsapp_normalize_phone((string) ($payload['to'] ?? ''));
if ($to === '') json_response(['ok' => false, 'error' => 'Indica un telefono destino.'], 422);
$result = whatsapp_send_text($to, 'Prueba de conexión de Catalogo Rodeo B2B.');
json_response($result, $result['ok'] ? 200 : 503);
