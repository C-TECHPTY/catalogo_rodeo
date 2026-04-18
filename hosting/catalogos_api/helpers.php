<?php
declare(strict_types=1);

function catalog_config(?string $key = null, mixed $default = null): mixed
{
    global $catalogConfig;

    if ($key === null) {
        return $catalogConfig;
    }

    $segments = explode('.', $key);
    $value = $catalogConfig;
    foreach ($segments as $segment) {
        if (!is_array($value) || !array_key_exists($segment, $value)) {
            return $default;
        }
        $value = $value[$segment];
    }

    return $value;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = catalog_config('db');
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'],
        (int) $db['port'],
        $db['database'],
        $db['charset'] ?? 'utf8mb4'
    );

    $pdo = new PDO($dsn, $db['username'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_response([
            'ok' => false,
            'error' => 'El cuerpo JSON no es valido.',
        ], 422);
    }

    return $decoded;
}

function require_api_key(array $payload = []): void
{
    $expected = (string) catalog_config('api_key', '');
    $headerKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
    $payloadKey = $payload['api_key'] ?? '';
    $provided = (string) ($headerKey ?: $payloadKey);

    if ($expected === '' || !hash_equals($expected, $provided)) {
        json_response([
            'ok' => false,
            'error' => 'API key invalida.',
        ], 401);
    }
}

function slugify(string $value): string
{
    $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    return trim($value, '-') ?: 'catalogo-publicable';
}

function fetch_catalog_by_slug(string $slug): ?array
{
    $sql = 'SELECT * FROM catalogs WHERE slug = :slug LIMIT 1';
    $statement = db()->prepare($sql);
    $statement->execute(['slug' => $slug]);
    $catalog = $statement->fetch();

    return $catalog ?: null;
}

function resolve_catalog_status(array $catalog): string
{
    $status = (string) ($catalog['status'] ?? 'active');
    if ($status !== 'active') {
        return $status;
    }

    if (!empty($catalog['expires_at']) && strtotime((string) $catalog['expires_at']) < time()) {
        return 'expired';
    }

    return 'active';
}

function ensure_catalog_active(string $slug): array
{
    $catalog = fetch_catalog_by_slug($slug);
    if (!$catalog) {
        json_response([
            'ok' => false,
            'error' => 'Catalogo no encontrado.',
        ], 404);
    }

    $status = resolve_catalog_status($catalog);
    if ($status !== 'active') {
        json_response([
            'ok' => false,
            'error' => 'Catalogo no disponible.',
            'catalog' => [
                'slug' => $catalog['slug'],
                'status' => $status,
                'expires_at' => $catalog['expires_at'],
            ],
        ], 410);
    }

    return $catalog;
}

function parse_decimal(mixed $value): float
{
    if ($value === null || $value === '') {
        return 0.0;
    }

    if (is_numeric($value)) {
        return (float) $value;
    }

    $normalized = preg_replace('/[^0-9.,-]/', '', (string) $value) ?? '0';
    $normalized = str_replace(',', '.', $normalized);
    return (float) $normalized;
}

function next_order_number(): string
{
    return 'PED-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
}

function send_notification_mail(string $subject, string $message): void
{
    $recipients = catalog_config('mail.notify_to', []);
    if (!is_array($recipients) || !$recipients) {
        return;
    }

    $fromName = (string) catalog_config('mail.from_name', 'Catalog Platform');
    $fromEmail = (string) catalog_config('mail.from_email', 'no-reply@example.com');
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . sprintf('%s <%s>', $fromName, $fromEmail),
    ];

    @mail(implode(',', $recipients), $subject, $message, implode("\r\n", $headers));
}

function admin_require_login(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name((string) catalog_config('admin.session_name', 'catalog_admin_session'));
        session_start();
    }

    if (empty($_SESSION['catalog_admin_user'])) {
        header('Location: login.php');
        exit;
    }
}

function admin_login(string $username, string $password): bool
{
    $sql = 'SELECT * FROM catalog_users WHERE username = :username AND is_active = 1 LIMIT 1';
    $statement = db()->prepare($sql);
    $statement->execute(['username' => $username]);
    $user = $statement->fetch();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        return false;
    }

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name((string) catalog_config('admin.session_name', 'catalog_admin_session'));
        session_start();
    }

    $_SESSION['catalog_admin_user'] = [
        'id' => $user['id'],
        'username' => $user['username'],
        'full_name' => $user['full_name'],
        'role' => $user['role'],
    ];

    return true;
}
