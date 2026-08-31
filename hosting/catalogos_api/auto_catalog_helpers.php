<?php
declare(strict_types=1);

function auto_catalog_tables_ready(): bool
{
    return catalog_table_exists('auto_catalog_rules')
        && catalog_table_exists('auto_catalog_runs')
        && catalog_table_exists('auto_catalog_run_items')
        && catalog_table_exists('auto_catalog_seller_sessions')
        && catalog_table_exists('catalogs');
}

function auto_catalog_module_enabled(): bool
{
    return app_setting('auto_catalogs_enabled', '0') === '1';
}

function auto_catalog_api_key(): string
{
    return trim(app_setting('auto_catalogs_api_key', ''));
}

function auto_catalog_generate_api_key(): string
{
    $key = bin2hex(random_bytes(24));
    update_app_settings(['auto_catalogs_api_key' => $key]);
    return $key;
}

function auto_catalog_fetch_rule(int $ruleId): ?array
{
    if (!auto_catalog_tables_ready()) {
        return null;
    }

    $statement = db()->prepare(
        'SELECT r.*, c.title AS base_catalog_title, c.slug AS base_catalog_slug, c.public_url AS base_public_url
         FROM auto_catalog_rules r
         INNER JOIN catalogs c ON c.id = r.base_catalog_id
         WHERE r.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $ruleId]);
    $row = $statement->fetch();
    return $row ?: null;
}

function auto_catalog_fetch_default_rule(): ?array
{
    if (!auto_catalog_tables_ready()) {
        return null;
    }

    $statement = db()->query(
        'SELECT r.*, c.title AS base_catalog_title, c.slug AS base_catalog_slug, c.public_url AS base_public_url
         FROM auto_catalog_rules r
         INNER JOIN catalogs c ON c.id = r.base_catalog_id
         WHERE r.is_active = 1
         ORDER BY r.updated_at DESC, r.id DESC
         LIMIT 1'
    );
    $row = $statement->fetch();
    return $row ?: null;
}

function auto_catalog_available_catalogs(): array
{
    if (!catalog_table_exists('catalogs')) {
        return [];
    }

    return db()->query(
        "SELECT id, title, slug, public_url, status
         FROM catalogs
         WHERE status = 'active' AND catalog_json_path <> ''
         ORDER BY updated_at DESC, id DESC
         LIMIT 300"
    )->fetchAll();
}

function auto_catalog_recent_item_codes(int $ruleId, int $days): array
{
    if ($days <= 0 || !catalog_table_exists('auto_catalog_run_items')) {
        return [];
    }

    $statement = db()->prepare(
        'SELECT DISTINCT item_code
         FROM auto_catalog_run_items
         WHERE rule_id = :rule_id
           AND created_at >= DATE_SUB(NOW(), INTERVAL ' . (int) $days . ' DAY)'
    );
    $statement->bindValue('rule_id', $ruleId, PDO::PARAM_INT);
    $statement->execute();

    $codes = [];
    foreach ($statement->fetchAll() as $row) {
        $code = normalize_product_item_key((string) ($row['item_code'] ?? ''));
        if ($code !== '') {
            $codes[$code] = true;
        }
    }
    return $codes;
}

function auto_catalog_run(int $ruleId): array
{
    if (!auto_catalog_tables_ready()) {
        throw new RuntimeException('Faltan tablas de catalogos automaticos. Importa hosting/sql/20260518_auto_catalogs.sql.');
    }
    if (!auto_catalog_module_enabled()) {
        throw new RuntimeException('El modulo de catalogos automaticos esta desactivado.');
    }

    $rule = auto_catalog_fetch_rule($ruleId);
    if (!$rule) {
        throw new RuntimeException('Regla automatica no encontrada.');
    }
    if ((int) ($rule['is_active'] ?? 0) !== 1) {
        throw new RuntimeException('La regla automatica esta desactivada.');
    }

    $baseCatalog = fetch_catalog_by_slug((string) $rule['base_catalog_slug']);
    if (!$baseCatalog) {
        throw new RuntimeException('Catalogo base no encontrado.');
    }
    $baseJson = catalog_json_data((string) ($baseCatalog['catalog_json_path'] ?? ''));
    $products = auto_catalog_products_from_json($baseJson);
    if (!$products) {
        throw new RuntimeException('El catalogo base no contiene productos en catalog.json.');
    }

    $limit = max(1, min(500, (int) ($rule['product_limit'] ?? 24)));
    $recent = auto_catalog_recent_item_codes((int) $rule['id'], max(0, (int) ($rule['no_repeat_days'] ?? 0)));
    $candidates = [];
    foreach ($products as $product) {
        $itemCode = auto_catalog_product_item_code($product);
        if ($itemCode === '' || isset($recent[normalize_product_item_key($itemCode)])) {
            continue;
        }
        if (!auto_catalog_product_available($product)) {
            continue;
        }
        $candidates[] = $product;
    }

    $candidates = auto_catalog_unique_products($candidates);
    shuffle($candidates);
    $selected = array_slice($candidates, 0, $limit);
    if (!$selected) {
        throw new RuntimeException('No se encontraron productos disponibles para generar el catalogo.');
    }

    $runToken = generate_secure_token();
    db()->prepare(
        'INSERT INTO auto_catalog_runs (rule_id, base_catalog_id, run_token, status, started_at)
         VALUES (:rule_id, :base_catalog_id, :run_token, :status, NOW())'
    )->execute([
        'rule_id' => (int) $rule['id'],
        'base_catalog_id' => (int) $baseCatalog['id'],
        'run_token' => $runToken,
        'status' => 'processing',
    ]);
    $runId = (int) db()->lastInsertId();

    try {
        $slug = auto_catalog_unique_slug((string) ($rule['slug_prefix'] ?: 'auto-catalogo'));
        $json = auto_catalog_set_products_in_json($baseJson, $selected);
        $json['autoCatalog'] = [
            'enabled' => true,
            'ruleId' => (int) $rule['id'],
            'runId' => $runId,
            'baseCatalogId' => (int) $baseCatalog['id'],
            'generatedAt' => date(DATE_ATOM),
            'productLimit' => $limit,
            'noRepeatDays' => (int) ($rule['no_repeat_days'] ?? 0),
        ];
        $json['slug'] = $slug;
        $json['title'] = (string) (($rule['name'] ?? '') ?: ($baseCatalog['title'] ?? 'Catalogo automatico'));

        $paths = auto_catalog_publish_json_clone($baseCatalog, $slug, $json);
        $catalogId = auto_catalog_register_catalog($baseCatalog, $rule, $slug, $paths['public_url'], $paths['json_path'], $json);
        $internalSellerUrl = auto_catalog_internal_seller_url($runToken);
        $whatsappMessage = auto_catalog_whatsapp_message((string) $rule['name'], $paths['public_url'], $internalSellerUrl);

        db()->prepare(
            'UPDATE auto_catalog_runs
             SET generated_catalog_id = :catalog_id, slug = :slug, public_url = :public_url,
                 internal_seller_url = :internal_seller_url, whatsapp_message = :whatsapp_message,
                 status = :status, selected_count = :selected_count, finished_at = NOW()
             WHERE id = :id'
        )->execute([
            'catalog_id' => $catalogId,
            'slug' => $slug,
            'public_url' => $paths['public_url'],
            'internal_seller_url' => $internalSellerUrl,
            'whatsapp_message' => $whatsappMessage,
            'status' => 'success',
            'selected_count' => count($selected),
            'id' => $runId,
        ]);

        auto_catalog_record_run_items($runId, (int) $rule['id'], (int) $baseCatalog['id'], $catalogId, $selected);

        return [
            'ok' => true,
            'catalog_id' => $catalogId,
            'run_id' => $runId,
            'slug' => $slug,
            'public_url' => $paths['public_url'],
            'internal_seller_url' => $internalSellerUrl,
            'whatsapp_message' => $whatsappMessage,
        ];
    } catch (Throwable $exception) {
        db()->prepare(
            'UPDATE auto_catalog_runs
             SET status = :status, error_message = :error_message, finished_at = NOW()
             WHERE id = :id'
        )->execute([
            'status' => 'failed',
            'error_message' => $exception->getMessage(),
            'id' => $runId,
        ]);
        throw $exception;
    }
}

function auto_catalog_products_from_json(array $json): array
{
    foreach (['catalog', 'products', 'items'] as $key) {
        if (isset($json[$key]) && is_array($json[$key])) {
            return array_values(array_filter($json[$key], 'is_array'));
        }
    }
    return [];
}

function auto_catalog_set_products_in_json(array $json, array $products): array
{
    foreach (['catalog', 'products', 'items'] as $key) {
        if (isset($json[$key]) && is_array($json[$key])) {
            $json[$key] = array_values($products);
            return $json;
        }
    }
    $json['catalog'] = array_values($products);
    return $json;
}

function auto_catalog_product_item_code(array $product): string
{
    return first_non_empty_string([
        $product['item'] ?? '',
        $product['ITEM'] ?? '',
        $product['item_code'] ?? '',
        $product['sku'] ?? '',
        $product['codigo'] ?? '',
    ]);
}

function auto_catalog_product_available(array $product): bool
{
    $negativeFlags = ['agotado', 'sin stock', 'sin existencia', 'descontinuado', 'inactivo', 'inactive', 'sold out', 'out of stock'];
    foreach (['status', 'estado', 'availability', 'disponibilidad'] as $key) {
        $value = strtolower(trim((string) ($product[$key] ?? '')));
        if ($value !== '' && in_array($value, $negativeFlags, true)) {
            return false;
        }
    }

    foreach (['outOfStock', 'out_of_stock', 'agotado', 'inactive', 'inactivo'] as $key) {
        if (array_key_exists($key, $product) && filter_var($product[$key], FILTER_VALIDATE_BOOLEAN)) {
            return false;
        }
    }

    foreach (['stock', 'existencia', 'cantidad', 'qty', 'available_qty'] as $key) {
        if (array_key_exists($key, $product) && trim((string) $product[$key]) !== '') {
            return parse_decimal($product[$key]) > 0;
        }
    }

    return true;
}

function auto_catalog_unique_products(array $products): array
{
    $seen = [];
    $unique = [];
    foreach ($products as $product) {
        $key = normalize_product_item_key(auto_catalog_product_item_code($product));
        if ($key === '' || isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $unique[] = $product;
    }
    return $unique;
}

function auto_catalog_unique_slug(string $prefix): string
{
    $base = slugify($prefix) . '-' . date('Ymd-His');
    $slug = $base;
    $counter = 2;
    while (fetch_catalog_by_slug($slug) !== null || is_dir(auto_catalog_public_dir() . DIRECTORY_SEPARATOR . $slug)) {
        $slug = $base . '-' . $counter;
        $counter++;
    }
    return $slug;
}

function auto_catalog_public_dir(): string
{
    return rtrim((string) catalog_config('paths.public_catalogs_dir', dirname(__DIR__) . DIRECTORY_SEPARATOR . 'catalogos'), DIRECTORY_SEPARATOR);
}

function auto_catalog_publish_json_clone(array $baseCatalog, string $slug, array $json): array
{
    $sourceDir = auto_catalog_base_catalog_dir($baseCatalog);
    if ($sourceDir === '' || !is_dir($sourceDir)) {
        throw new RuntimeException('No se encontro la carpeta publica del catalogo base.');
    }

    $targetDir = auto_catalog_public_dir() . DIRECTORY_SEPARATOR . $slug;
    if (!is_dir($targetDir)) {
        auto_catalog_copy_directory($sourceDir, $targetDir);
    }

    $jsonPath = $targetDir . DIRECTORY_SEPARATOR . 'catalog.json';
    file_put_contents($jsonPath, json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    auto_catalog_refresh_public_index_meta($targetDir, $json);
    auto_catalog_refresh_public_assets($targetDir);
    file_put_contents(
        $targetDir . DIRECTORY_SEPARATOR . '.htaccess',
        "<Files \"catalog.json\">\n    Require all denied\n</Files>\n"
    );

    return [
        'json_path' => 'catalogos/' . $slug . '/catalog.json',
        'public_url' => auto_catalog_public_url_for_slug($baseCatalog, $slug),
    ];
}

function auto_catalog_refresh_public_assets(string $targetDir): void
{
    $source = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'public-catalog.js';
    $target = $targetDir . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'public-catalog.js';
    if (is_file($source) && is_dir(dirname($target))) {
        copy($source, $target);
    }
}

function auto_catalog_refresh_public_index_meta(string $targetDir, array $json): void
{
    $indexPath = $targetDir . DIRECTORY_SEPARATOR . 'index.html';
    if (!is_file($indexPath)) {
        return;
    }
    $html = file_get_contents($indexPath);
    if (!is_string($html) || $html === '') {
        return;
    }
    $encoded = json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) {
        return;
    }
    $encoded = str_replace('</script', '<\/script', $encoded);
    $updated = preg_replace(
        '#(<script\b[^>]*\bid=["\']catalogMeta["\'][^>]*>)(.*?)(</script>)#is',
        '$1' . $encoded . '$3',
        $html,
        1,
        $count
    );
    if ($count > 0 && is_string($updated)) {
        file_put_contents($indexPath, $updated);
    }
}

function auto_catalog_base_catalog_dir(array $baseCatalog): string
{
    $jsonPath = trim((string) ($baseCatalog['catalog_json_path'] ?? ''));
    if ($jsonPath !== '') {
        $fullPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $jsonPath);
        return is_file($fullPath) ? dirname($fullPath) : dirname($fullPath);
    }

    $slug = trim((string) ($baseCatalog['slug'] ?? ''));
    return $slug !== '' ? auto_catalog_public_dir() . DIRECTORY_SEPARATOR . $slug : '';
}

function auto_catalog_public_url_for_slug(array $baseCatalog, string $slug): string
{
    $baseUrl = trim((string) ($baseCatalog['public_url'] ?? ''));
    if ($baseUrl !== '') {
        $clean = preg_replace('/[#?].*$/', '', $baseUrl) ?? $baseUrl;
        $clean = rtrim($clean, '/');
        $replaced = preg_replace('#/[^/]+$#', '/' . $slug, $clean);
        return rtrim((string) ($replaced ?: $clean), '/') . '/';
    }

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return $host !== '' ? $scheme . '://' . $host . '/catalogos/' . $slug . '/' : '/catalogos/' . $slug . '/';
}

function auto_catalog_copy_directory(string $source, string $target): void
{
    if (!is_dir($source)) {
        throw new RuntimeException('La carpeta origen no existe.');
    }
    if (!mkdir($target, 0775, true) && !is_dir($target)) {
        throw new RuntimeException('No se pudo crear carpeta destino.');
    }

    $items = scandir($source);
    if ($items === false) {
        throw new RuntimeException('No se pudo leer la carpeta origen.');
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $from = $source . DIRECTORY_SEPARATOR . $item;
        $to = $target . DIRECTORY_SEPARATOR . $item;
        if (is_dir($from)) {
            auto_catalog_copy_directory($from, $to);
        } else {
            copy($from, $to);
        }
    }
}

function auto_catalog_register_catalog(array $baseCatalog, array $rule, string $slug, string $publicUrl, string $jsonPath, array $json): int
{
    $title = trim((string) (($rule['name'] ?? '') ?: ($baseCatalog['title'] ?? 'Catalogo automatico')));
    $payload = [
        'auto_catalog' => true,
        'auto_catalog_rule_id' => (int) $rule['id'],
        'base_catalog_id' => (int) $baseCatalog['id'],
        'metadata' => $json['autoCatalog'] ?? [],
    ];
    if (!empty($json['scanList'])) {
        $payload['scan_list'] = true;
        $payload['metadata'] = ['scanList' => $json['scanList']];
    }

    $statement = db()->prepare(
        'INSERT INTO catalogs (
            slug, title, template, public_url, pdf_url, generated_at, expires_at, status,
            seller_name, client_name, hero_title, hero_subtitle, promo_title, promo_text,
            promo_image_url, promo_video_url, promo_link_url, promo_link_label,
            currency, legacy_pdf_url, modern_pdf_url, notes, catalog_json_path, api_payload
        ) VALUES (
            :slug, :title, :template, :public_url, :pdf_url, NOW(), :expires_at, :status,
            :seller_name, :client_name, :hero_title, :hero_subtitle, :promo_title, :promo_text,
            :promo_image_url, :promo_video_url, :promo_link_url, :promo_link_label,
            :currency, :legacy_pdf_url, :modern_pdf_url, :notes, :catalog_json_path, :api_payload
        )
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            public_url = VALUES(public_url),
            catalog_json_path = VALUES(catalog_json_path),
            api_payload = VALUES(api_payload),
            updated_at = NOW()'
    );
    $statement->execute([
        'slug' => $slug,
        'title' => $title,
        'template' => (string) ($baseCatalog['template'] ?? 'b2b-modern'),
        'public_url' => $publicUrl,
        'pdf_url' => '',
        'expires_at' => null,
        'status' => 'active',
        'seller_name' => (string) ($baseCatalog['seller_name'] ?? ''),
        'client_name' => (string) ($baseCatalog['client_name'] ?? ''),
        'hero_title' => (string) (($baseCatalog['hero_title'] ?? '') ?: $title),
        'hero_subtitle' => (string) ($baseCatalog['hero_subtitle'] ?? ''),
        'promo_title' => (string) ($baseCatalog['promo_title'] ?? ''),
        'promo_text' => (string) ($baseCatalog['promo_text'] ?? ''),
        'promo_image_url' => (string) ($baseCatalog['promo_image_url'] ?? ''),
        'promo_video_url' => (string) ($baseCatalog['promo_video_url'] ?? ''),
        'promo_link_url' => (string) ($baseCatalog['promo_link_url'] ?? ''),
        'promo_link_label' => (string) ($baseCatalog['promo_link_label'] ?? ''),
        'currency' => (string) (($baseCatalog['currency'] ?? '') ?: 'USD'),
        'legacy_pdf_url' => '',
        'modern_pdf_url' => '',
        'notes' => 'Generado por catalogos automaticos desde catalogo base #' . (int) $baseCatalog['id'],
        'catalog_json_path' => $jsonPath,
        'api_payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $catalog = fetch_catalog_by_slug($slug);
    if (!$catalog) {
        throw new RuntimeException('No se pudo registrar el catalogo generado.');
    }
    return (int) $catalog['id'];
}

function auto_catalog_record_run_items(int $runId, int $ruleId, int $baseCatalogId, int $catalogId, array $products): void
{
    $statement = db()->prepare(
        'INSERT INTO auto_catalog_run_items
            (run_id, rule_id, base_catalog_id, generated_catalog_id, item_code, product_hash, brand, category)
         VALUES
            (:run_id, :rule_id, :base_catalog_id, :generated_catalog_id, :item_code, :product_hash, :brand, :category)'
    );

    foreach ($products as $product) {
        $statement->execute([
            'run_id' => $runId,
            'rule_id' => $ruleId,
            'base_catalog_id' => $baseCatalogId,
            'generated_catalog_id' => $catalogId,
            'item_code' => auto_catalog_product_item_code($product),
            'product_hash' => sha1(json_encode($product, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: ''),
            'brand' => first_non_empty_string([$product['brand'] ?? '', $product['marca'] ?? '', $product['MARCA'] ?? '']),
            'category' => first_non_empty_string([$product['category'] ?? '', $product['categoria'] ?? '', $product['CATEGORIA'] ?? '']),
        ]);
    }
}

function auto_catalog_internal_seller_url(string $runToken): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $relative = '/catalogos/auto_seller.php?run=' . rawurlencode($runToken);
    return $host !== '' ? $scheme . '://' . $host . $relative : $relative;
}

function auto_catalog_whatsapp_message(string $ruleName, string $publicUrl, string $internalSellerUrl): string
{
    $title = trim($ruleName) !== '' ? trim($ruleName) : 'Catalogo automatico';
    return "Catalogo listo: {$title}\n\nLink publico:\n{$publicUrl}\n\nLink interno para vendedor:\n{$internalSellerUrl}";
}

function auto_catalog_latest_runs(int $limit = 12): array
{
    if (!auto_catalog_tables_ready()) {
        return [];
    }

    $statement = db()->prepare(
        'SELECT run.*, rule.name AS rule_name, base.title AS base_catalog_title, generated.title AS generated_catalog_title
         FROM auto_catalog_runs run
         LEFT JOIN auto_catalog_rules rule ON rule.id = run.rule_id
         LEFT JOIN catalogs base ON base.id = run.base_catalog_id
         LEFT JOIN catalogs generated ON generated.id = run.generated_catalog_id
         ORDER BY run.created_at DESC
         LIMIT :limit'
    );
    $statement->bindValue('limit', max(1, min(50, $limit)), PDO::PARAM_INT);
    $statement->execute();
    return $statement->fetchAll();
}

function auto_catalog_fetch_run_by_token(string $runToken): ?array
{
    if ($runToken === '' || !auto_catalog_tables_ready()) {
        return null;
    }

    $statement = db()->prepare(
        'SELECT run.*, c.public_url, c.slug AS catalog_slug, c.title AS catalog_title
         FROM auto_catalog_runs run
         LEFT JOIN catalogs c ON c.id = run.generated_catalog_id
         WHERE run.run_token = :token AND run.status = :status
         LIMIT 1'
    );
    $statement->execute([
        'token' => $runToken,
        'status' => 'success',
    ]);
    $row = $statement->fetch();
    return $row ?: null;
}

function auto_catalog_create_seller_session(array $run, string $sellerName): array
{
    $sellerName = trim($sellerName);
    if ($sellerName === '') {
        throw new RuntimeException('Escribe el nombre del vendedor.');
    }

    $sellerToken = generate_secure_token();
    $clientUrl = url_with_query_params((string) ($run['public_url'] ?? ''), ['t' => $sellerToken]);
    db()->prepare(
        'INSERT INTO auto_catalog_seller_sessions
            (run_id, generated_catalog_id, seller_name, seller_token, client_url, ip_address, user_agent)
         VALUES
            (:run_id, :generated_catalog_id, :seller_name, :seller_token, :client_url, :ip_address, :user_agent)'
    )->execute([
        'run_id' => (int) $run['id'],
        'generated_catalog_id' => !empty($run['generated_catalog_id']) ? (int) $run['generated_catalog_id'] : null,
        'seller_name' => $sellerName,
        'seller_token' => $sellerToken,
        'client_url' => $clientUrl,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
        'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ]);

    return [
        'seller_name' => $sellerName,
        'seller_token' => $sellerToken,
        'client_url' => $clientUrl,
    ];
}

function auto_catalog_fetch_seller_session_by_token(string $sellerToken): ?array
{
    if ($sellerToken === '' || !catalog_table_exists('auto_catalog_seller_sessions')) {
        return null;
    }

    $statement = db()->prepare(
        'SELECT session.*, c.slug AS catalog_slug, c.title AS catalog_title
         FROM auto_catalog_seller_sessions session
         LEFT JOIN catalogs c ON c.id = session.generated_catalog_id
         WHERE session.seller_token = :token AND session.is_active = 1
         LIMIT 1'
    );
    $statement->execute(['token' => $sellerToken]);
    $session = $statement->fetch();
    if (!$session) {
        return null;
    }

    db()->prepare(
        'UPDATE auto_catalog_seller_sessions
         SET last_opened_at = NOW()
         WHERE id = :id'
    )->execute(['id' => (int) $session['id']]);

    return $session;
}
