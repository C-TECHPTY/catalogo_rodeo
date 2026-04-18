<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name((string) catalog_config('admin.session_name', 'catalog_admin_session'));
    session_start();
}

$_SESSION = [];
session_destroy();

header('Location: login.php');
exit;
