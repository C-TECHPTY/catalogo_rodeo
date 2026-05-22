<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_once dirname(__DIR__) . '/catalogos_api/auto_catalog_helpers.php';

admin_require_login(['admin', 'operator']);

$tablesReady = auto_catalog_tables_ready();
$moduleEnabled = auto_catalog_module_enabled();
$apiKey = auto_catalog_api_key();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    $action = (string) ($_POST['action'] ?? '');

    try {
        if ($action === 'toggle_module') {
            update_app_settings(['auto_catalogs_enabled' => !empty($_POST['enabled']) ? '1' : '0']);
            flash_set('success', 'Estado del modulo actualizado.');
        } elseif ($action === 'generate_key') {
            auto_catalog_generate_api_key();
            flash_set('success', 'Clave privada generada. Guardala con cuidado si vas a usar el endpoint.');
        } elseif ($action === 'save_rule' && $tablesReady) {
            $ruleId = (int) ($_POST['rule_id'] ?? 0);
            $name = trim((string) ($_POST['name'] ?? ''));
            $baseCatalogId = (int) ($_POST['base_catalog_id'] ?? 0);
            $productLimit = max(1, min(500, (int) ($_POST['product_limit'] ?? 24)));
            $noRepeatDays = max(0, min(365, (int) ($_POST['no_repeat_days'] ?? 14)));
            $isActive = !empty($_POST['is_active']) ? 1 : 0;
            $slugPrefix = slugify((string) ($_POST['slug_prefix'] ?? $name));
            $notes = trim((string) ($_POST['notes'] ?? ''));

            if ($name === '' || $baseCatalogId <= 0) {
                throw new RuntimeException('Completa nombre y catalogo base.');
            }

            if ($ruleId > 0) {
                db()->prepare(
                    'UPDATE auto_catalog_rules
                     SET name = :name, slug_prefix = :slug_prefix, base_catalog_id = :base_catalog_id,
                         product_limit = :product_limit, no_repeat_days = :no_repeat_days,
                         is_active = :is_active, notes = :notes, updated_at = NOW()
                     WHERE id = :id'
                )->execute([
                    'name' => $name,
                    'slug_prefix' => $slugPrefix,
                    'base_catalog_id' => $baseCatalogId,
                    'product_limit' => $productLimit,
                    'no_repeat_days' => $noRepeatDays,
                    'is_active' => $isActive,
                    'notes' => $notes,
                    'id' => $ruleId,
                ]);
                flash_set('success', 'Regla actualizada.');
            } else {
                db()->prepare(
                    'INSERT INTO auto_catalog_rules
                        (name, slug_prefix, base_catalog_id, product_limit, no_repeat_days, is_active, notes, created_by_user_id)
                     VALUES
                        (:name, :slug_prefix, :base_catalog_id, :product_limit, :no_repeat_days, :is_active, :notes, :created_by_user_id)'
                )->execute([
                    'name' => $name,
                    'slug_prefix' => $slugPrefix,
                    'base_catalog_id' => $baseCatalogId,
                    'product_limit' => $productLimit,
                    'no_repeat_days' => $noRepeatDays,
                    'is_active' => $isActive,
                    'notes' => $notes,
                    'created_by_user_id' => current_user()['id'] ?? null,
                ]);
                flash_set('success', 'Regla creada.');
            }
        } elseif ($action === 'run_now' && $tablesReady) {
            $ruleId = (int) ($_POST['rule_id'] ?? 0);
            $result = auto_catalog_run($ruleId);
            flash_set('success', 'Catalogo generado: ' . $result['public_url']);
        }
    } catch (Throwable $exception) {
        flash_set('error', $exception->getMessage());
    }

    header('Location: auto_catalogs.php');
    exit;
}

$rules = [];
$catalogs = [];
$runs = [];
$editRule = null;
if ($tablesReady) {
    $rules = db()->query(
        'SELECT r.*, c.title AS base_catalog_title, c.slug AS base_catalog_slug
         FROM auto_catalog_rules r
         LEFT JOIN catalogs c ON c.id = r.base_catalog_id
         ORDER BY r.updated_at DESC, r.id DESC'
    )->fetchAll();
    $catalogs = auto_catalog_available_catalogs();
    $runs = auto_catalog_latest_runs(15);

    $editId = (int) ($_GET['edit'] ?? 0);
    foreach ($rules as $rule) {
        if ((int) $rule['id'] === $editId) {
            $editRule = $rule;
            break;
        }
    }
}

admin_header('Catalogos automaticos', 'auto_catalogs.php');
?>
<section class="card">
    <div class="toolbar">
        <strong>Fase 1 por rotacion</strong>
        <span class="pill"><?= $moduleEnabled ? 'Modulo activo' : 'Modulo apagado' ?></span>
    </div>
    <p class="muted">Este modulo no corre cron ni envia WhatsApp automatico. Solo genera catalogos cuando se ejecuta manualmente.</p>
    <form method="post" class="toolbar__actions" style="margin-top:12px;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="toggle_module">
        <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" name="enabled" value="1" <?= $moduleEnabled ? 'checked' : '' ?>>
            Activar modulo
        </label>
        <button type="submit">Guardar estado</button>
    </form>
</section>

<?php if (!$tablesReady): ?>
    <section class="card">
        <strong>Falta importar SQL.</strong>
        <p class="muted">Importa primero <code>hosting/sql/20260518_auto_catalogs.sql</code>. No se activa nada automaticamente.</p>
    </section>
    <?php admin_footer(); exit; ?>
<?php endif; ?>

<section class="card">
    <div class="toolbar">
        <strong>Clave privada API</strong>
        <form method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="generate_key">
            <button type="submit"><?= $apiKey === '' ? 'Generar clave' : 'Regenerar clave' ?></button>
        </form>
    </div>
    <p class="muted">Endpoint manual: <code>../catalogos_api/run_auto_catalog.php?key=CLAVE_SEGURA</code></p>
    <?php if ($apiKey !== ''): ?>
        <p><code><?= html_escape($apiKey) ?></code></p>
    <?php endif; ?>
</section>

<section class="card">
    <div class="toolbar"><strong><?= $editRule ? 'Editar regla' : 'Crear regla automatica' ?></strong></div>
    <form method="post" class="form-grid">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_rule">
        <input type="hidden" name="rule_id" value="<?= (int) ($editRule['id'] ?? 0) ?>">
        <label><span>Nombre</span><input name="name" required value="<?= html_escape($editRule['name'] ?? '') ?>" placeholder="Rotacion semanal Luxury"></label>
        <label><span>Prefijo slug</span><input name="slug_prefix" value="<?= html_escape($editRule['slug_prefix'] ?? 'auto-catalogo') ?>"></label>
        <label><span>Catalogo base</span><select name="base_catalog_id" required>
            <option value="">Seleccionar</option>
            <?php foreach ($catalogs as $catalog): ?>
                <option value="<?= (int) $catalog['id'] ?>" <?= (int) ($editRule['base_catalog_id'] ?? 0) === (int) $catalog['id'] ? 'selected' : '' ?>>
                    <?= html_escape($catalog['title'] . ' / ' . $catalog['slug']) ?>
                </option>
            <?php endforeach; ?>
        </select></label>
        <label><span>Cantidad de productos</span><input type="number" min="1" max="500" name="product_limit" value="<?= (int) ($editRule['product_limit'] ?? 24) ?>"></label>
        <label><span>Dias sin repetir</span><input type="number" min="0" max="365" name="no_repeat_days" value="<?= (int) ($editRule['no_repeat_days'] ?? 14) ?>"></label>
        <label><span>Estado</span><select name="is_active">
            <option value="1" <?= (int) ($editRule['is_active'] ?? 0) === 1 ? 'selected' : '' ?>>Activa</option>
            <option value="0" <?= (int) ($editRule['is_active'] ?? 0) === 0 ? 'selected' : '' ?>>Inactiva</option>
        </select></label>
        <label class="wide"><span>Notas</span><input name="notes" value="<?= html_escape($editRule['notes'] ?? '') ?>"></label>
        <div class="wide"><button class="button--primary" type="submit">Guardar regla</button></div>
    </form>
</section>

<section class="card">
    <div class="toolbar"><strong>Reglas</strong><span class="pill"><?= count($rules) ?> reglas</span></div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Nombre</th><th>Base</th><th>Productos</th><th>No repetir</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
            <?php foreach ($rules as $rule): ?>
                <tr>
                    <td><strong><?= html_escape($rule['name']) ?></strong><div class="muted"><?= html_escape($rule['slug_prefix']) ?></div></td>
                    <td><?= html_escape(($rule['base_catalog_title'] ?? '') ?: ('#' . $rule['base_catalog_id'])) ?></td>
                    <td><?= (int) $rule['product_limit'] ?></td>
                    <td><?= (int) $rule['no_repeat_days'] ?> dias</td>
                    <td><?= admin_status_badge((int) $rule['is_active'] === 1 ? 'active' : 'inactive') ?></td>
                    <td>
                        <div class="toolbar__actions">
                            <a class="button" href="auto_catalogs.php?edit=<?= (int) $rule['id'] ?>">Editar</a>
                            <form method="post">
                                <?= csrf_field() ?>
                                <input type="hidden" name="action" value="run_now">
                                <input type="hidden" name="rule_id" value="<?= (int) $rule['id'] ?>">
                                <button type="submit" <?= !$moduleEnabled || (int) $rule['is_active'] !== 1 ? 'disabled' : '' ?>>Generar ahora</button>
                            </form>
                        </div>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>

<section class="card">
    <div class="toolbar"><strong>Ultimas ejecuciones</strong></div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Fecha</th><th>Regla</th><th>Estado</th><th>Productos</th><th>Links</th><th>Mensaje WhatsApp</th></tr></thead>
            <tbody>
            <?php foreach ($runs as $run): ?>
                <tr>
                    <td><?= html_escape($run['created_at'] ?? '') ?></td>
                    <td><?= html_escape($run['rule_name'] ?? '') ?></td>
                    <td><?= admin_status_badge((string) ($run['status'] ?? 'queued')) ?></td>
                    <td><?= (int) ($run['selected_count'] ?? 0) ?></td>
                    <td>
                        <?php if (!empty($run['public_url'])): ?><div><a href="<?= html_escape($run['public_url']) ?>" target="_blank">Catalogo publico</a></div><?php endif; ?>
                        <?php if (!empty($run['internal_seller_url'])): ?><div><a href="<?= html_escape($run['internal_seller_url']) ?>" target="_blank">Link interno vendedor</a></div><?php endif; ?>
                        <?php if (!empty($run['error_message'])): ?><div class="muted"><?= html_escape($run['error_message']) ?></div><?php endif; ?>
                    </td>
                    <td><?php if (!empty($run['whatsapp_message'])): ?><textarea readonly rows="4" style="width:100%;"><?= html_escape($run['whatsapp_message']) ?></textarea><?php endif; ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<?php admin_footer(); ?>
