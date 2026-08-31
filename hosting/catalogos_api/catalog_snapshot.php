<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$payload = read_json_input();
require_api_key($payload);

$slug = slugify((string) ($payload['slug'] ?? ''));
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

$json = catalog_json_data((string) ($catalog['catalog_json_path'] ?? ''));
if (!isset($json['catalog']) || !is_array($json['catalog'])) {
    json_response([
        'ok' => false,
        'error' => 'El catalogo no contiene productos validos.',
    ], 422);
}

// Incluye la capa viva para que Electron compare contra lo que realmente ve el cliente.
$json = apply_catalog_product_live_edits((int) ($catalog['id'] ?? 0), $json);

json_response([
    'ok' => true,
    'catalog' => [
        'id' => (int) ($catalog['id'] ?? 0),
        'slug' => (string) ($catalog['slug'] ?? ''),
        'title' => (string) ($catalog['title'] ?? ''),
        'status' => resolve_catalog_status($catalog),
        'updated_at' => (string) ($catalog['updated_at'] ?? ''),
    ],
    'metadata' => $json,
]);
