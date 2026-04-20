<?php
declare(strict_types=1);

require dirname(__DIR__) . '/catalogos_api/bootstrap.php';

if (!function_exists('vendor_table_exists')) {
    function vendor_table_exists(string $tableName): bool
    {
        static $cache = [];
        if (array_key_exists($tableName, $cache)) return $cache[$tableName];
        $statement = db()->prepare(
            'SELECT COUNT(*)
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $statement->execute(['table_name' => $tableName]);
        $cache[$tableName] = ((int) $statement->fetchColumn()) > 0;
        return $cache[$tableName];
    }
}

if (!function_exists('vendor_column_exists')) {
    function vendor_column_exists(string $tableName, string $columnName): bool
    {
        static $cache = [];
        $key = $tableName . '.' . $columnName;
        if (array_key_exists($key, $cache)) return $cache[$key];
        $statement = db()->prepare(
            'SELECT COUNT(*)
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $statement->execute(['table_name' => $tableName, 'column_name' => $columnName]);
        $cache[$key] = ((int) $statement->fetchColumn()) > 0;
        return $cache[$key];
    }
}

function vendor_b2b_schema_ready(): bool
{
    return vendor_table_exists('sellers')
        && vendor_table_exists('catalog_share_links')
        && vendor_column_exists('catalog_users', 'seller_id')
        && vendor_column_exists('orders', 'seller_id');
}

function vendor_current_user(): ?array
{
    $sessionUser = current_user();
    $userId = (int) ($sessionUser['id'] ?? 0);
    if ($userId <= 0) {
        return $sessionUser;
    }

    $hasSellerId = vendor_column_exists('catalog_users', 'seller_id');
    $hasSellers = vendor_table_exists('sellers');
    $sellerSelect = $hasSellerId && $hasSellers ? ', s.name AS seller_display_name' : ", '' AS seller_display_name";
    $sellerJoin = $hasSellerId && $hasSellers ? ' LEFT JOIN sellers s ON s.id = u.seller_id' : '';
    $statement = db()->prepare(
        "SELECT u.*{$sellerSelect}
         FROM catalog_users u
         {$sellerJoin}
         WHERE u.id = :id AND u.is_active = 1
         LIMIT 1"
    );
    $statement->execute(['id' => $userId]);
    $row = $statement->fetch();
    if (!$row) {
        return $sessionUser;
    }

    $_SESSION['catalog_admin_user'] = [
        'id' => (int) $row['id'],
        'username' => $row['username'],
        'full_name' => $row['full_name'],
        'email' => $row['email'],
        'role' => $row['role'],
        'seller_id' => $hasSellerId && !empty($row['seller_id']) ? (int) $row['seller_id'] : null,
        'seller_display_name' => $row['seller_display_name'] ?? '',
    ];

    return $_SESSION['catalog_admin_user'];
}

function vendor_require_panel_login(): void
{
    $user = vendor_current_user();
    if (!$user) {
        header('Location: ../catalogos_admin/login.php');
        exit;
    }

    $role = strtolower(trim((string) ($user['role'] ?? '')));
    $sellerId = (int) ($user['seller_id'] ?? 0);
    if ($sellerId <= 0 && !in_array($role, ['admin', 'sales'], true)) {
        http_response_code(403);
        echo 'No tienes permisos para acceder a esta seccion. Usuario: '
            . html_escape((string) ($user['username'] ?? ''))
            . ' / Rol: ' . html_escape($role ?: 'sin rol')
            . ' / seller_id: ' . html_escape((string) ($user['seller_id'] ?? 'NULL'));
        exit;
    }
}

if (!function_exists('admin_state_label')) {
    function admin_state_label(string $status): string
    {
        $labels = [
            'active' => 'Activo',
            'draft' => 'Borrador',
            'expired' => 'Expirado',
            'archived' => 'Archivado',
            'inactive' => 'Inactivo',
            'new' => 'Nuevo',
            'reviewed' => 'Revisado',
            'processing' => 'En proceso',
            'invoiced' => 'Facturado',
            'completed' => 'Completado',
            'cancelled' => 'Cancelado',
        ];
        return $labels[$status] ?? $status;
    }
}

if (!function_exists('admin_status_badge')) {
    function admin_status_badge(string $status): string
    {
        $class = in_array($status, ['active', 'completed'], true) ? 'badge badge--ok'
            : (in_array($status, ['expired', 'archived', 'inactive', 'cancelled'], true) ? 'badge badge--danger' : 'badge');
        return '<span class="' . $class . '">' . html_escape(admin_state_label($status)) . '</span>';
    }
}

function vendor_header(string $title, string $active = 'index.php'): void
{
    vendor_require_panel_login();
    $user = vendor_current_user();
    $flash = flash_get();
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title><?= html_escape($title) ?></title>
        <link rel="stylesheet" href="../assets/admin.css">
    </head>
    <body>
        <div class="shell">
            <aside class="sidebar">
                <div class="brand">
                    <h1>Panel vendedor</h1>
                    <p><?= html_escape($user['seller_display_name'] ?: $user['full_name']) ?></p>
                </div>
                <nav class="nav">
                    <a class="<?= $active === 'index.php' ? 'active' : '' ?>" href="index.php">Resumen</a>
                    <a class="<?= $active === 'catalogos.php' ? 'active' : '' ?>" href="catalogos.php">Catalogos</a>
                    <a class="<?= $active === 'links.php' ? 'active' : '' ?>" href="links.php">Links</a>
                    <a class="<?= $active === 'pedidos.php' ? 'active' : '' ?>" href="pedidos.php">Pedidos</a>
                    <a href="../catalogos_admin/dashboard.php">Volver a admin</a>
                </nav>
                <div class="sidebar-footer"><a href="../catalogos_admin/logout.php" style="color:#fff;">Cerrar sesion</a></div>
            </aside>
            <main class="main">
                <div class="topbar">
                    <div><h2><?= html_escape($title) ?></h2><p>Operacion comercial individual del vendedor.</p></div>
                </div>
                <?php if ($flash): ?>
                    <div class="flash <?= $flash['type'] === 'error' ? 'flash--error' : 'flash--success' ?>">
                        <?= html_escape($flash['message']) ?>
                    </div>
                <?php endif; ?>
    <?php
}

function vendor_footer(): void
{
    echo '</main></div></body></html>';
}
