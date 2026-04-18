<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$slug = slugify((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    json_response([
        'ok' => false,
        'error' => 'Debes indicar el slug del catalogo.',
    ], 422);
}

$catalog = fetch_catalog_by_slug($slug);
if (!$catalog) {
    json_response([
        'ok' => false,
        'error' => 'Catalogo no encontrado.',
    ], 404);
}

$status = resolve_catalog_status($catalog);

if ($status === 'active') {
    $log = db()->prepare('INSERT INTO catalog_access_logs (catalog_id, ip_address, user_agent, referrer) VALUES (:catalog_id, :ip_address, :user_agent, :referrer)');
    $log->execute([
        'catalog_id' => $catalog['id'],
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'referrer' => $_SERVER['HTTP_REFERER'] ?? '',
    ]);
}

json_response([
    'ok' => $status === 'active',
    'catalog' => [
        'id' => $catalog['id'],
        'slug' => $catalog['slug'],
        'title' => $catalog['title'],
        'status' => $status,
        'public_url' => $catalog['public_url'],
        'pdf_url' => $catalog['pdf_url'],
        'expires_at' => $catalog['expires_at'],
        'seller_name' => $catalog['seller_name'],
        'client_name' => $catalog['client_name'],
    ],
]);
