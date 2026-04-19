<?php
declare(strict_types=1);

require dirname(__DIR__) . '/catalogos_api/bootstrap.php';

function vendor_header(string $title, string $active = 'index.php'): void
{
    vendor_require_login();
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
