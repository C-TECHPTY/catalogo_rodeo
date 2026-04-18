<?php
declare(strict_types=1);

require dirname(__DIR__) . '/catalogos_api/bootstrap.php';

function admin_header(string $title): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name((string) catalog_config('admin.session_name', 'catalog_admin_session'));
        session_start();
    }
    $user = $_SESSION['catalog_admin_user'] ?? null;
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></title>
        <style>
            body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f4f1eb; color: #242424; }
            .admin-shell { max-width: 1180px; margin: 0 auto; padding: 24px; }
            .admin-nav { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; padding: 18px 20px; border-radius: 18px; background: #1f1f1f; color: #fff; }
            .admin-nav a { color: #fff; text-decoration: none; font-weight: 700; margin-right: 16px; }
            .card { background: #fff; border-radius: 18px; padding: 20px; box-shadow: 0 12px 24px rgba(0,0,0,0.06); }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px 10px; border-bottom: 1px solid #ebe5db; text-align: left; vertical-align: top; }
            th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
            .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border-radius: 999px; background: #f2eee6; font-size: 12px; font-weight: 700; }
            .badge--active { background: #dde9d4; color: #34512c; }
            .badge--expired { background: #f6d7d7; color: #8e3030; }
            .badge--new { background: #d8e8f6; color: #284b70; }
            .login-card { max-width: 420px; margin: 10vh auto 0; }
            input, button, textarea { width: 100%; min-height: 44px; border-radius: 12px; border: 1px solid #d8d0c3; padding: 10px 12px; font: inherit; }
            button { background: #1f1f1f; color: #fff; cursor: pointer; font-weight: 700; }
            .grid { display: grid; gap: 16px; }
            .muted { color: #666; }
            .flash { margin-bottom: 14px; padding: 12px 14px; border-radius: 14px; background: #f5ecec; color: #8b2e2e; }
        </style>
    </head>
    <body>
    <?php if ($user): ?>
        <div class="admin-shell">
            <div class="admin-nav">
                <div>
                    <a href="catalogos.php">Catalogos</a>
                    <a href="pedidos.php">Pedidos</a>
                </div>
                <div>
                    <?= htmlspecialchars((string) ($user['full_name'] ?? $user['username']), ENT_QUOTES, 'UTF-8') ?>
                    <a href="logout.php">Salir</a>
                </div>
            </div>
    <?php endif; ?>
    <?php
}

function admin_footer(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name((string) catalog_config('admin.session_name', 'catalog_admin_session'));
        session_start();
    }
    if (!empty($_SESSION['catalog_admin_user'])) {
        echo '</div>';
    }
    echo '</body></html>';
}
