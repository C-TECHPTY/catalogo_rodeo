<?php
declare(strict_types=1);

require dirname(__DIR__) . '/catalogos_api/bootstrap.php';

function admin_menu_items(): array
{
    return [
        'dashboard.php' => 'Dashboard',
        'catalogos.php' => 'Catalogos',
        'pedidos.php' => 'Pedidos',
        'sellers.php' => 'Vendedores',
        'links.php' => 'Links / Enlaces',
        'clients.php' => 'Clientes',
        'configuracion.php' => 'Configuracion',
        'exportaciones.php' => 'Exportaciones',
    ];
}

function admin_authenticate(string $username, string $password): array
{
    $username = trim($username);
    if ($username === '') {
        return ['ok' => false, 'reason' => 'user', 'message' => 'Escribe tu usuario para continuar.'];
    }

    $statement = db()->prepare(
        'SELECT u.*, s.name AS seller_display_name
         FROM catalog_users u
         LEFT JOIN sellers s ON s.id = u.seller_id
         WHERE u.username = :username
         LIMIT 1'
    );
    $statement->execute(['username' => $username]);
    $user = $statement->fetch();

    if (!$user) {
        return ['ok' => false, 'reason' => 'user', 'message' => 'Usuario incorrecto.'];
    }

    if ((int) ($user['is_active'] ?? 0) !== 1) {
        return ['ok' => false, 'reason' => 'denied', 'message' => 'Acceso denegado. El usuario esta inactivo.'];
    }

    $hash = (string) ($user['password_hash'] ?? '');
    if ($hash === '' || !password_verify($password, $hash)) {
        return ['ok' => false, 'reason' => 'password', 'message' => 'Contrasena incorrecta.'];
    }

    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        db()->prepare('UPDATE catalog_users SET password_hash = :hash WHERE id = :id')->execute([
            'hash' => password_hash($password, PASSWORD_DEFAULT),
            'id' => (int) $user['id'],
        ]);
    }

    start_app_session();
    session_regenerate_id(true);
    $_SESSION['catalog_admin_user'] = [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'seller_id' => $user['seller_id'] ? (int) $user['seller_id'] : null,
        'seller_display_name' => $user['seller_display_name'] ?? '',
    ];

    db()->prepare('UPDATE catalog_users SET last_login_at = NOW() WHERE id = :id')->execute([
        'id' => (int) $user['id'],
    ]);
    audit_log('auth.login', 'catalog_users', (int) $user['id'], [
        'username' => $user['username'],
        'role' => $user['role'],
    ]);

    return ['ok' => true, 'reason' => 'ok', 'user' => $_SESSION['catalog_admin_user']];
}

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
        'queued' => 'En cola',
        'sent' => 'Enviado',
        'failed' => 'Fallido',
        'none' => 'Sin link',
    ];

    return $labels[$status] ?? $status;
}

function admin_header(string $title, string $active = 'dashboard.php'): void
{
    start_app_session();
    $user = current_user();
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
    <?php if ($user): ?>
        <div class="shell">
            <aside class="sidebar">
                <div class="brand">
                    <h1>Catalogo Rodeo</h1>
                    <p>Plataforma comercial B2B con trazabilidad, links seguros y pedidos operativos.</p>
                </div>
                <nav class="nav">
                    <?php foreach (admin_menu_items() as $href => $label): ?>
                        <a class="<?= $active === $href ? 'active' : '' ?>" href="<?= html_escape($href) ?>">
                            <span><?= html_escape($label) ?></span>
                        </a>
                    <?php endforeach; ?>
                </nav>
                <div class="sidebar-footer">
                    <div><strong><?= html_escape($user['full_name'] ?: $user['username']) ?></strong></div>
                    <div><?= html_escape($user['role']) ?></div>
                    <div style="margin-top:12px;"><a href="logout.php" style="color:#fff;">Cerrar sesion</a></div>
                </div>
            </aside>
            <main class="main">
                <div class="topbar">
                    <div>
                        <h2><?= html_escape($title) ?></h2>
                        <p>Operacion comercial, seguridad y seguimiento centralizados.</p>
                    </div>
                    <div class="topbar__actions">
                        <span class="pill"><?= html_escape(date('Y-m-d H:i')) ?></span>
                        <a class="button" href="../catalogos_vendedor/index.php">Vista vendedor</a>
                    </div>
                </div>
                <?php if ($flash): ?>
                    <div class="flash <?= $flash['type'] === 'error' ? 'flash--error' : 'flash--success' ?>">
                        <?= html_escape($flash['message']) ?>
                    </div>
                <?php endif; ?>
    <?php endif; ?>
    <?php
}

function admin_footer(): void
{
    if (current_user()) {
        echo '</main></div>';
    }
    echo '</body></html>';
}

function admin_status_badge(string $status): string
{
    $map = [
        'active' => 'badge badge--ok',
        'new' => 'badge badge--warn',
        'processing' => 'badge',
        'completed' => 'badge badge--ok',
        'cancelled' => 'badge badge--danger',
        'expired' => 'badge badge--danger',
        'inactive' => 'badge badge--danger',
    ];

    $class = $map[$status] ?? 'badge';
    return '<span class="' . $class . '">' . html_escape(admin_state_label($status)) . '</span>';
}
