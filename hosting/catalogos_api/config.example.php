<?php
declare(strict_types=1);

return [
    'app_name' => 'Catalogo Rodeo B2B',
    'timezone' => 'America/Bogota',
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
        'from_name' => 'Catalogo Rodeo B2B',
        'from_email' => 'no-reply@tuempresa.com',
    ],
    'admin' => [
        'session_name' => 'catalog_admin_session',
    ],
    'paths' => [
        'public_catalogs_dir' => dirname(__DIR__) . '/catalogos',
    ],
];
