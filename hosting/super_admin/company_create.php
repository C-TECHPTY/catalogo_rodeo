<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/header.php';
require_once __DIR__ . '/includes/footer.php';

sa_require_login();

$errors = [];
$values = [
    'company_name' => '',
    'slug' => '',
    'contact_name' => '',
    'contact_email' => '',
    'contact_phone' => '',
    'domain' => '',
    'subdomain' => '',
    'logo_url' => '',
    'primary_color' => '#0f4c81',
    'status' => 'active',
    'notes' => '',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    sa_verify_csrf();
    foreach ($values as $key => $default) {
        $values[$key] = sa_post_string($key, $key === 'notes' ? 5000 : 500);
    }
    $values['slug'] = sa_slugify($values['slug'] !== '' ? $values['slug'] : $values['company_name']);
    if ($values['company_name'] === '') {
        $errors[] = 'El nombre de empresa es obligatorio.';
    }
    if ($values['slug'] === '') {
        $errors[] = 'El slug es obligatorio.';
    }
    if (!in_array($values['status'], ['active', 'suspended', 'inactive'], true)) {
        $values['status'] = 'active';
    }
    $statement = sa_db()->prepare('SELECT COUNT(*) FROM sa_companies WHERE slug = :slug');
    $statement->execute(['slug' => $values['slug']]);
    if ((int) $statement->fetchColumn() > 0) {
        $errors[] = 'El slug ya existe. Usa uno diferente.';
    }

    if (!$errors) {
        $statement = sa_db()->prepare(
            'INSERT INTO sa_companies
             (company_name, slug, contact_name, contact_email, contact_phone, domain, subdomain, logo_url, primary_color, status, notes)
             VALUES
             (:company_name, :slug, :contact_name, :contact_email, :contact_phone, :domain, :subdomain, :logo_url, :primary_color, :status, :notes)'
        );
        $statement->execute($values);
        $companyId = (int) sa_db()->lastInsertId();
        sa_log('company.created', 'Empresa creada: ' . $values['company_name'], $companyId);
        sa_flash_set('success', 'Empresa creada correctamente.');
        sa_redirect('company_edit.php?id=' . $companyId);
    }
}

sa_header('Nueva empresa', 'companies.php');
?>
<section class="panel">
    <?php if ($errors): ?><div class="flash flash--error"><?= sa_e(implode(' ', $errors)) ?></div><?php endif; ?>
    <?php require __DIR__ . '/includes/company_form.php'; ?>
</section>
<?php sa_footer(); ?>
