<?php
declare(strict_types=1);

require __DIR__ . '/catalogos_api/bootstrap.php';

$code = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) ($_GET['c'] ?? $_GET['code'] ?? '')) ?? '');
$target = fetch_short_link_target($code);
$status = short_link_target_status($target);

if ($status !== 'active') {
    http_response_code(in_array($status, ['expired', 'catalog_expired'], true) ? 410 : 404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>Enlace no disponible</title>';
    echo '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f2348}.box{max-width:520px;margin:20px;padding:32px;border-radius:18px;background:#fff;box-shadow:0 18px 40px rgba(15,35,72,.12);text-align:center}h1{margin:0 0 12px;font-size:26px}p{margin:0;color:#5b6678;line-height:1.5}</style>';
    echo '</head><body><main class="box"><h1>Este enlace ya no esta disponible</h1><p>Solicita a tu asesor un nuevo enlace del catalogo.</p></main></body></html>';
    exit;
}

record_short_link_open((int) $target['id'], (int) $target['share_link_id']);
$redirectUrl = url_with_query_params((string) $target['public_url'], ['token' => (string) $target['token']]);
header('Location: ' . $redirectUrl, true, 302);
exit;
