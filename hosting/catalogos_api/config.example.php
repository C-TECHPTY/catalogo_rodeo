<?php
declare(strict_types=1);

return [
    'app_name' => 'Catalog Platform',
    'timezone' => 'America/New_York',
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'database' => 'catalog_platform',
        'username' => 'catalog_user',
        'password' => 'change_this_password',
        'charset' => 'utf8mb4',
    ],
    'api_key' => 'CHANGE_THIS_PRIVATE_API_KEY',
    'mail' => [
        'from_name' => 'Catalog Platform',
        'from_email' => 'no-reply@tuempresa.com',
        'notify_to' => [
            'ventas@tuempresa.com',
            'facturacion@tuempresa.com',
        ],
    ],
    'admin' => [
        'session_name' => 'catalog_admin_session',
    ],
    'paths' => [
        'public_catalogs_dir' => dirname(__DIR__) . '/catalogos',
    ],
];
