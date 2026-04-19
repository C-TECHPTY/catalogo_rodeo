<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login(['admin', 'billing', 'sales']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    update_app_settings([
        'mail_sales' => trim((string) ($_POST['mail_sales'] ?? '')),
        'mail_billing' => trim((string) ($_POST['mail_billing'] ?? '')),
        'mail_logistics' => trim((string) ($_POST['mail_logistics'] ?? '')),
        'mail_supervision' => trim((string) ($_POST['mail_supervision'] ?? '')),
        'mail_copy_seller' => isset($_POST['mail_copy_seller']) ? '1' : '0',
        'mail_copy_client' => isset($_POST['mail_copy_client']) ? '1' : '0',
    ]);
    audit_log('settings.notifications_updated', 'app_settings');
    flash_set('success', 'Configuracion de notificaciones actualizada.');
    header('Location: configuracion.php');
    exit;
}

admin_header('Configuracion', 'configuracion.php');
$apiKey = (string) catalog_config('api_key', '');
$maskedApiKey = $apiKey !== '' ? substr($apiKey, 0, 4) . str_repeat('*', max(8, strlen($apiKey) - 8)) . substr($apiKey, -4) : 'No configurada';
?>
<div class="split">
    <section class="card">
        <div class="toolbar"><strong>Destinos de notificacion</strong></div>
        <form class="form-grid" method="post">
            <?= csrf_field() ?>
            <label><span>Ventas</span><input type="text" name="mail_sales" value="<?= html_escape(app_setting('mail_sales')) ?>"></label>
            <label><span>Facturacion</span><input type="text" name="mail_billing" value="<?= html_escape(app_setting('mail_billing')) ?>"></label>
            <label><span>Logistica</span><input type="text" name="mail_logistics" value="<?= html_escape(app_setting('mail_logistics')) ?>"></label>
            <label><span>Supervision</span><input type="text" name="mail_supervision" value="<?= html_escape(app_setting('mail_supervision')) ?>"></label>
            <label class="checkbox-line"><input type="checkbox" name="mail_copy_seller" <?= app_setting('mail_copy_seller', '1') === '1' ? 'checked' : '' ?>><span>Copiar a vendedor</span></label>
            <label class="checkbox-line"><input type="checkbox" name="mail_copy_client" <?= app_setting('mail_copy_client', '1') === '1' ? 'checked' : '' ?>><span>Copiar a cliente</span></label>
            <div class="wide"><button class="button--primary" type="submit">Guardar configuracion</button></div>
        </form>
    </section>
    <section class="card">
        <div class="toolbar"><strong>Configuracion general</strong></div>
        <div class="list">
            <div class="list-item">
                <strong>Aplicacion</strong>
                <div class="muted"><?= html_escape((string) catalog_config('app_name', 'Catalogo Rodeo B2B')) ?></div>
            </div>
            <div class="list-item">
                <strong>API key privada</strong>
                <div class="muted"><?= html_escape($maskedApiKey) ?></div>
                <p class="muted">Se lee desde <code>catalogos_api/config.php</code>. No se muestra completa para evitar exposicion accidental.</p>
            </div>
            <div class="list-item">
                <strong>Carpeta publica de catalogos</strong>
                <div class="muted"><?= html_escape((string) catalog_config('paths.public_catalogs_dir', '')) ?></div>
            </div>
        </div>
    </section>
</div>
<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Ultimas notificaciones</strong></div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Fecha</th><th>Destinatario</th><th>Asunto</th><th>Estado</th></tr></thead>
            <tbody>
            <?php foreach (db()->query('SELECT recipient, subject, status, created_at FROM notifications_log ORDER BY created_at DESC LIMIT 50')->fetchAll() as $row): ?>
                <tr>
                    <td><?= html_escape($row['created_at']) ?></td>
                    <td><?= html_escape($row['recipient']) ?></td>
                    <td><?= html_escape($row['subject']) ?></td>
                    <td><?= admin_status_badge((string) $row['status']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<?php admin_footer(); ?>
