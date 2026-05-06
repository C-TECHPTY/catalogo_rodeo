<?php
declare(strict_types=1);

function sa_config(?string $key = null, mixed $default = null): mixed
{
    static $config = null;

    if ($config === null) {
        $configPath = dirname(__DIR__, 2) . '/catalogos_api/config.php';
        if (!is_file($configPath)) {
            http_response_code(500);
            echo 'No existe catalogos_api/config.php. Configura primero la conexion de base de datos.';
            exit;
        }

        $loaded = require $configPath;
        $config = is_array($loaded) ? $loaded : [];
        date_default_timezone_set((string) ($config['timezone'] ?? 'UTC'));
    }

    if ($key === null) {
        return $config;
    }

    $value = $config;
    foreach (explode('.', $key) as $segment) {
        if (!is_array($value) || !array_key_exists($segment, $value)) {
            return $default;
        }
        $value = $value[$segment];
    }

    return $value;
}

function sa_db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = sa_config('db', []);
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'] ?? 'localhost',
        (int) ($db['port'] ?? 3306),
        $db['database'] ?? '',
        $db['charset'] ?? 'utf8mb4'
    );

    $pdo = new PDO($dsn, (string) ($db['username'] ?? ''), (string) ($db['password'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}
