<?php
declare(strict_types=1);
?>
<form method="post">
    <?= sa_csrf_field() ?>
    <div class="form-grid">
        <label class="field">Empresa <input name="company_name" value="<?= sa_e($values['company_name'] ?? '') ?>" required></label>
        <label class="field">Slug <input name="slug" value="<?= sa_e($values['slug'] ?? '') ?>" placeholder="mi-empresa"></label>
        <label class="field">Contacto <input name="contact_name" value="<?= sa_e($values['contact_name'] ?? '') ?>"></label>
        <label class="field">Email contacto <input type="email" name="contact_email" value="<?= sa_e($values['contact_email'] ?? '') ?>"></label>
        <label class="field">Telefono <input name="contact_phone" value="<?= sa_e($values['contact_phone'] ?? '') ?>"></label>
        <label class="field">Dominio <input name="domain" value="<?= sa_e($values['domain'] ?? '') ?>" placeholder="empresa.com"></label>
        <label class="field">Subdominio <input name="subdomain" value="<?= sa_e($values['subdomain'] ?? '') ?>" placeholder="empresa"></label>
        <label class="field">Logo URL <input name="logo_url" value="<?= sa_e($values['logo_url'] ?? '') ?>"></label>
        <label class="field">Color principal <input name="primary_color" value="<?= sa_e($values['primary_color'] ?? '#0f4c81') ?>"></label>
        <label class="field">Estado
            <select name="status">
                <?php foreach (['active' => 'Activo', 'suspended' => 'Suspendido', 'inactive' => 'Inactivo'] as $value => $label): ?>
                    <option value="<?= sa_e($value) ?>" <?= ($values['status'] ?? '') === $value ? 'selected' : '' ?>><?= sa_e($label) ?></option>
                <?php endforeach; ?>
            </select>
        </label>
        <label class="field field--full">Notas <textarea name="notes"><?= sa_e($values['notes'] ?? '') ?></textarea></label>
    </div>
    <div class="actions" style="margin-top:16px;">
        <button class="button" type="submit">Guardar empresa</button>
        <a class="button button--ghost" href="companies.php">Volver</a>
    </div>
</form>
