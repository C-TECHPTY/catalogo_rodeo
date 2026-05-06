<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/header.php';
require_once __DIR__ . '/includes/footer.php';

sa_require_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    sa_verify_csrf();
    $companyId = (int) ($_POST['company_id'] ?? 0);
    $status = sa_post_string('status', 20);
    if ($companyId > 0 && in_array($status, ['active', 'suspended', 'inactive'], true)) {
        sa_db()->prepare('UPDATE sa_companies SET status = :status WHERE id = :id')->execute([
            'status' => $status,
            'id' => $companyId,
        ]);
        sa_log('company.status_updated', 'Estado actualizado a ' . $status, $companyId);
        sa_flash_set('success', 'Estado de empresa actualizado.');
    }
    sa_redirect('companies.php');
}

$companies = sa_db()->query(
    'SELECT c.*,
            s.plan_name,
            s.status AS subscription_status,
            l.license_key,
            l.expires_at AS license_expires_at
     FROM sa_companies c
     LEFT JOIN sa_subscriptions s ON s.id = (
        SELECT s2.id FROM sa_subscriptions s2 WHERE s2.company_id = c.id ORDER BY s2.id DESC LIMIT 1
     )
     LEFT JOIN sa_licenses l ON l.id = (
        SELECT l2.id FROM sa_licenses l2 WHERE l2.company_id = c.id ORDER BY l2.id DESC LIMIT 1
     )
     ORDER BY c.created_at DESC'
)->fetchAll();

sa_header('Empresas', 'companies.php');
?>
<section class="panel">
    <div class="toolbar">
        <div>
            <h3>Empresas registradas</h3>
            <p class="muted">Base preparatoria. No se conecta todavia con catalogos, pedidos ni vendedores.</p>
        </div>
        <a class="button" href="company_create.php">Nueva empresa</a>
    </div>
    <table>
        <thead>
            <tr>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Plan</th>
                <th>Licencia</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($companies as $company): ?>
            <tr>
                <td><strong><?= sa_e($company['company_name']) ?></strong><br><span class="muted"><?= sa_e($company['slug']) ?></span></td>
                <td><?= sa_e($company['contact_name']) ?><br><span class="muted"><?= sa_e($company['contact_email']) ?></span></td>
                <td><?= sa_badge((string) $company['status']) ?></td>
                <td><?= sa_e($company['plan_name'] ?: 'Sin plan') ?><br><span class="muted"><?= sa_e($company['subscription_status'] ?: '') ?></span></td>
                <td><?= sa_e($company['license_key'] ?: 'Sin licencia') ?><br><span class="muted"><?= sa_e($company['license_expires_at'] ?: '') ?></span></td>
                <td>
                    <div class="actions">
                        <a class="button button--ghost" href="company_edit.php?id=<?= (int) $company['id'] ?>">Editar</a>
                        <form method="post" action="companies.php">
                            <?= sa_csrf_field() ?>
                            <input type="hidden" name="company_id" value="<?= (int) $company['id'] ?>">
                            <input type="hidden" name="status" value="<?= $company['status'] === 'suspended' ? 'active' : 'suspended' ?>">
                            <button class="button <?= $company['status'] === 'suspended' ? 'button--ghost' : 'button--danger' ?>" type="submit">
                                <?= $company['status'] === 'suspended' ? 'Activar' : 'Suspender' ?>
                            </button>
                        </form>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
        <?php if (!$companies): ?><tr><td colspan="6">Sin empresas registradas.</td></tr><?php endif; ?>
        </tbody>
    </table>
</section>
<?php sa_footer(); ?>
