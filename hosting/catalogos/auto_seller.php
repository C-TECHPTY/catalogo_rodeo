<?php
declare(strict_types=1);

require dirname(__DIR__) . '/catalogos_api/bootstrap.php';
require_once dirname(__DIR__) . '/catalogos_api/auto_catalog_helpers.php';

$runToken = trim((string) ($_GET['run'] ?? $_POST['run'] ?? ''));
$run = auto_catalog_fetch_run_by_token($runToken);
$error = '';
$session = null;

if (!$run) {
    http_response_code(404);
    $error = 'Este link interno no esta disponible o ya no existe.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $sellerName = trim((string) ($_POST['seller_name'] ?? ''));
    try {
        $session = auto_catalog_create_seller_session($run, $sellerName);
    } catch (Throwable $exception) {
        $error = $exception->getMessage();
    }
}

$title = $run ? (string) (($run['catalog_title'] ?? '') ?: 'Catalogo automatico') : 'Link interno';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= html_escape($title) ?> - Vendedor</title>
    <style>
        :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f4f6; color: #111827; }
        .panel { width: min(92vw, 520px); background: #fff; border-radius: 18px; padding: 28px; box-shadow: 0 22px 70px rgba(17, 24, 39, .14); }
        h1 { margin: 0 0 8px; font-size: 26px; }
        p { color: #4b5563; line-height: 1.5; }
        label { display: grid; gap: 8px; font-weight: 700; margin: 20px 0; }
        input { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 12px; padding: 14px 16px; font-size: 16px; }
        button, .button { display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 12px; background: #111; color: #fff; padding: 13px 18px; font-weight: 800; text-decoration: none; cursor: pointer; }
        .linkbox { margin-top: 18px; padding: 14px; border-radius: 12px; background: #f9fafb; border: 1px solid #e5e7eb; word-break: break-all; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
        .error { padding: 12px 14px; border-radius: 12px; background: #fef2f2; color: #991b1b; font-weight: 700; }
        .success { padding: 12px 14px; border-radius: 12px; background: #ecfdf5; color: #065f46; font-weight: 700; }
        .muted { color: #6b7280; font-size: 13px; }
    </style>
</head>
<body>
    <main class="panel">
        <h1><?= html_escape($title) ?></h1>
        <p>Escribe tu nombre para generar un link de cliente trazable a tus pedidos.</p>

        <?php if ($error !== ''): ?>
            <div class="error"><?= html_escape($error) ?></div>
        <?php endif; ?>

        <?php if ($session): ?>
            <div class="success">Link creado para <?= html_escape($session['seller_name']) ?>.</div>
            <div class="linkbox" id="clientUrl"><?= html_escape($session['client_url']) ?></div>
            <div class="actions">
                <a class="button" href="<?= html_escape($session['client_url']) ?>" target="_blank" rel="noopener">Abrir link</a>
                <button type="button" onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('clientUrl').textContent.trim())">Copiar link</button>
            </div>
            <p class="muted">Ese enlace agrega tu token al catalogo. Los pedidos se guardan con tu nombre.</p>
        <?php elseif ($run): ?>
            <form method="post">
                <input type="hidden" name="run" value="<?= html_escape($runToken) ?>">
                <label>
                    Nombre del vendedor
                    <input name="seller_name" required maxlength="140" autocomplete="name" placeholder="Ejemplo: DANIEL">
                </label>
                <button type="submit">Generar link para clientes</button>
            </form>
        <?php endif; ?>
    </main>
</body>
</html>
