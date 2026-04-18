<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    if (admin_login($username, $password)) {
        header('Location: catalogos.php');
        exit;
    }
    $error = 'Usuario o contrasena invalidos.';
}

admin_header('Login catalogos');
?>
<div class="admin-shell">
    <div class="card login-card">
        <h1>Panel de catalogos</h1>
        <p class="muted">Usa el usuario creado en `catalog_users` para entrar al panel.</p>
        <?php if ($error !== ''): ?>
            <div class="flash"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
        <?php endif; ?>
        <form class="grid" method="post">
            <input name="username" type="text" placeholder="Usuario" required>
            <input name="password" type="password" placeholder="Contrasena" required>
            <button type="submit">Entrar</button>
        </form>
    </div>
</div>
<?php admin_footer(); ?>
