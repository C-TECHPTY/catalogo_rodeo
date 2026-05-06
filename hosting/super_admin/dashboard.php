<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/header.php';
require_once __DIR__ . '/includes/footer.php';

sa_require_login();

$db = sa_db();
$stats = [
    'total_companies' => (int) $db->query('SELECT COUNT(*) FROM sa_companies')->fetchColumn(),
    'active_companies' => (int) $db->query("SELECT COUNT(*) FROM sa_companies WHERE status = 'active'")->fetchColumn(),
    'suspended_companies' => (int) $db->query("SELECT COUNT(*) FROM sa_companies WHERE status = 'suspended'")->fetchColumn(),
    'active_subscriptions' => (int) $db->query("SELECT COUNT(*) FROM sa_subscriptions WHERE status = 'active'")->fetchColumn(),
    'licenses_expiring' => (int) $db->query("SELECT COUNT(*) FROM sa_licenses WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)")->fetchColumn(),
];
$companies = $db->query('SELECT * FROM sa_companies ORDER BY created_at DESC LIMIT 6')->fetchAll();
$logs = $db->query(
    'SELECT l.*, u.name AS admin_name, c.company_name
     FROM sa_activity_logs l
     INNER JOIN sa_admin_users u ON u.id = l.admin_user_id
     LEFT JOIN sa_companies c ON c.id = l.company_id
     ORDER BY l.created_at DESC
     LIMIT 8'
)->fetchAll();

sa_header('Dashboard', 'dashboard.php');
?>
<section class="grid grid--stats">
    <div class="panel stat"><strong><?= $stats['total_companies'] ?></strong><span>Total empresas</span></div>
    <div class="panel stat"><strong><?= $stats['active_companies'] ?></strong><span>Empresas activas</span></div>
    <div class="panel stat"><strong><?= $stats['suspended_companies'] ?></strong><span>Empresas suspendidas</span></div>
    <div class="panel stat"><strong><?= $stats['active_subscriptions'] ?></strong><span>Suscripciones activas</span></div>
    <div class="panel stat"><strong><?= $stats['licenses_expiring'] ?></strong><span>Licencias vencen en 30 dias</span></div>
</section>

<section class="grid grid--two">
    <div class="panel">
        <div class="toolbar">
            <h3>Empresas recientes</h3>
            <a class="button button--ghost" href="company_create.php">Nueva empresa</a>
        </div>
        <table>
            <thead><tr><th>Empresa</th><th>Estado</th><th>Creada</th></tr></thead>
            <tbody>
            <?php foreach ($companies as $company): ?>
                <tr>
                    <td><strong><?= sa_e($company['company_name']) ?></strong><br><span class="muted"><?= sa_e($company['slug']) ?></span></td>
                    <td><?= sa_badge((string) $company['status']) ?></td>
                    <td><?= sa_e($company['created_at']) ?></td>
                </tr>
            <?php endforeach; ?>
            <?php if (!$companies): ?><tr><td colspan="3">Sin empresas registradas.</td></tr><?php endif; ?>
            </tbody>
        </table>
    </div>
    <div class="panel">
        <div class="toolbar"><h3>Actividad reciente</h3><a class="button button--ghost" href="settings.php">Ver todo</a></div>
        <table>
            <thead><tr><th>Accion</th><th>Detalle</th><th>Fecha</th></tr></thead>
            <tbody>
            <?php foreach ($logs as $log): ?>
                <tr>
                    <td><?= sa_e($log['action']) ?></td>
                    <td><?= sa_e($log['company_name'] ?: $log['description']) ?></td>
                    <td><?= sa_e($log['created_at']) ?></td>
                </tr>
            <?php endforeach; ?>
            <?php if (!$logs): ?><tr><td colspan="3">Sin actividad registrada.</td></tr><?php endif; ?>
            </tbody>
        </table>
    </div>
</section>
<?php sa_footer(); ?>
