<?php
declare(strict_types=1);

require __DIR__ . '/ai_helpers.php';

$payload = ai_request_payload();
$sender = ai_normalize_phone((string) ($payload['sender'] ?? ''));
$seller = ai_find_seller_by_sender($sender);
if (!$seller) {
    ai_log('product.denied', ['sender' => $sender, 'reason' => 'seller_not_authorized']);
    json_response([
        'ok' => false,
        'error' => 'Vendedor no autorizado.',
    ], 403);
}

$item = trim((string) ($payload['item'] ?? ''));
$items = $payload['items'] ?? [];
if (!is_array($items)) {
    $items = preg_split('/[,\s]+/', (string) $items) ?: [];
}
if ($item !== '') array_unshift($items, $item);
$items = array_values(array_unique(array_filter(array_map(static fn(mixed $value): string => trim((string) $value), $items))));
if ($items === []) {
    json_response(['ok' => false, 'error' => 'Debes indicar item o items.'], 422);
}
if (count($items) > 10) {
    json_response(['ok' => false, 'error' => 'Puedes consultar hasta 10 items por solicitud.'], 422);
}
$query = trim((string) ($payload['query'] ?? 'full'));
$catalog = ai_active_catalog_by_slug_or_latest((string) ($payload['catalog_slug'] ?? ''));
if (!$catalog) {
    json_response([
        'ok' => false,
        'error' => 'No hay catalogo activo disponible.',
    ], 404);
}

$products = [];
$notFound = [];
foreach ($items as $requestedItem) {
    $product = ai_find_product($catalog, $requestedItem);
    if (!$product) { $notFound[] = $requestedItem; continue; }
    $products[] = ai_product_response($product, $catalog, $requestedItem);
}
if ($products === []) {
    ai_log('product.not_found', ['seller_id' => $seller['id'], 'items' => $items]);
    json_response([
        'ok' => false,
        'error' => 'Producto no encontrado.',
        'item' => $items[0],
        'not_found' => $notFound,
    ], 404);
}

$response = [
    'ok' => true,
    'query' => $query,
    'catalog' => [
        'id' => (int) $catalog['id'],
        'slug' => $catalog['slug'],
        'title' => $catalog['title'],
        'public_url' => $catalog['public_url'],
    ],
    // Singular fields remain for existing callers; products supports multiple items.
    ...$products[0],
    'stock' => $products[0]['available'],
    'products' => $products,
    'not_found' => $notFound,
];

ai_log('product.query', [
    'seller_id' => $seller['id'],
    'items' => array_column($products, 'item'),
    'query' => $query,
    'catalog_id' => $catalog['id'],
]);

json_response($response);
