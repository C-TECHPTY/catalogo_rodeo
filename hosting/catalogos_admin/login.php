<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$currentUser = function_exists('current_user') ? current_user() : null;
if ($currentUser) {
    header('Location: dashboard.php');
    exit;
}

$error = '';
$username = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (function_exists('verify_csrf_or_abort')) {
        verify_csrf_or_abort();
    }
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $auth = function_exists('admin_authenticate')
        ? admin_authenticate($username, $password)
        : ['ok' => admin_login($username, $password), 'message' => 'Usuario o contrasena invalidos.'];
    if ($auth['ok'] ?? false) {
        $user = $auth['user'] ?? current_user();
        header('Location: ' . (($user['role'] ?? '') === 'vendor' ? '../catalogos_vendedor/index.php' : 'dashboard.php'));
        exit;
    }
    $error = (string) ($auth['message'] ?? 'Acceso denegado.');
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso Catalogo Rodeo B2B</title>
    <link rel="stylesheet" href="../assets/admin.css">
</head>
<body class="login-page">
    <div class="login-shell">
        <div class="login-card">
            <div class="login-brand">
                <span class="login-brand__mark">B2B</span>
                <div>
                    <h1>Catalogo Rodeo B2B</h1>
                    <p>Administracion comercial, vendedores, links y pedidos trazables.</p>
                </div>
            </div>
            <?php if ($error !== ''): ?>
                <div class="flash flash--error"><?= html_escape($error) ?></div>
            <?php endif; ?>
            <form class="grid" method="post" autocomplete="on">
                <?= function_exists('csrf_field') ? csrf_field() : '' ?>
                <label><span>Usuario</span><input type="text" name="username" value="<?= html_escape($username) ?>" autocomplete="username" required autofocus></label>
                <label><span>Contrasena</span><input type="password" name="password" autocomplete="current-password" required></label>
                <button class="button--primary" type="submit">Ingresar al panel</button>
            </form>
            <div class="login-meta">
                <span>Acceso seguro con sesiones protegidas</span>
                <span>API y pedidos integrados</span>
            </div>
        </div>
    </div>
</body>
</html>
