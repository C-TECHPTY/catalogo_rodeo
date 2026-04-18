<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login();

$flash = '';
$flashType = 'ok';
$catalogsDir = rtrim((string) catalog_config('paths.public_catalogs_dir', dirname(__DIR__) . '/catalogos'), DIRECTORY_SEPARATOR);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');
    $catalogId = (int) ($_POST['catalog_id'] ?? 0);

    if ($catalogId > 0) {
        $stmt = db()->prepare('SELECT * FROM catalogs WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $catalogId]);
        $catalog = $stmt->fetch();

        if ($catalog) {
            if ($action === 'renew') {
                $days = max(1, (int) ($_POST['renew_days'] ?? 30));
                $baseDate = !empty($catalog['expires_at']) && strtotime((string) $catalog['expires_at']) > time()
                    ? strtotime((string) $catalog['expires_at'])
                    : time();
                $newDate = date('Y-m-d H:i:s', strtotime("+{$days} days", $baseDate));
                $update = db()->prepare('UPDATE catalogs SET expires_at = :expires_at, status = :status, updated_at = NOW() WHERE id = :id');
                $update->execute([
                    'expires_at' => $newDate,
                    'status' => 'active',
                    'id' => $catalogId,
                ]);
                $flash = 'Link renovado correctamente.';
            }

            if ($action === 'delete') {
                $delete = db()->prepare('DELETE FROM catalogs WHERE id = :id');
                $delete->execute(['id' => $catalogId]);
                delete_directory_recursive($catalogsDir . DIRECTORY_SEPARATOR . $catalog['slug']);
                $flash = 'Catalogo eliminado correctamente.';
            }

            if ($action === 'save') {
                $title = trim((string) ($_POST['title'] ?? $catalog['title']));
                $seller = trim((string) ($_POST['seller_name'] ?? $catalog['seller_name']));
                $client = trim((string) ($_POST['client_name'] ?? $catalog['client_name']));
                $status = trim((string) ($_POST['status'] ?? $catalog['status']));
                $expiresAtInput = trim((string) ($_POST['expires_at'] ?? ''));
                $expiresAt = $expiresAtInput !== '' ? date('Y-m-d H:i:s', strtotime($expiresAtInput)) : null;
                $update = db()->prepare(
                    'UPDATE catalogs
                     SET title = :title, seller_name = :seller_name, client_name = :client_name, status = :status, expires_at = :expires_at, updated_at = NOW()
                     WHERE id = :id'
                );
                $update->execute([
                    'title' => $title !== '' ? $title : $catalog['title'],
                    'seller_name' => $seller,
                    'client_name' => $client,
                    'status' => $status !== '' ? $status : $catalog['status'],
                    'expires_at' => $expiresAt,
                    'id' => $catalogId,
                ]);
                $flash = 'Catalogo actualizado correctamente.';
            }
        } else {
            $flash = 'No se encontro el catalogo seleccionado.';
            $flashType = 'error';
        }
    }
}

$editId = (int) ($_GET['edit'] ?? 0);
$statement = db()->query('SELECT * FROM catalogs ORDER BY updated_at DESC, created_at DESC LIMIT 200');
$catalogs = $statement->fetchAll();
$editCatalog = null;

if ($editId > 0) {
    foreach ($catalogs as $candidate) {
        if ((int) $candidate['id'] === $editId) {
            $editCatalog = $candidate;
            break;
        }
    }
}

admin_header('Catalogos');
?>
<style>
    .catalog-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .catalog-actions form { margin: 0; }
    .catalog-actions button,
    .catalog-actions a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid #d8d0c3;
        background: #fff;
        color: #222;
        text-decoration: none;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
    }
    .catalog-actions .danger { background: #8e3030; color: #fff; border-color: #8e3030; }
    .catalog-actions .primary { background: #1f1f1f; color: #fff; border-color: #1f1f1f; }
    .catalog-edit-card { margin-bottom: 20px; }
    .catalog-edit-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .catalog-edit-grid label { display: grid; gap: 6px; font-size: 13px; }
    .catalog-edit-grid .wide { grid-column: 1 / -1; }
    .flash-ok { background: #e2efda; color: #2f5728; }
    .flash-error { background: #f6d7d7; color: #8e3030; }
</style>

<?php if ($flash !== ''): ?>
    <div class="card <?= $flashType === 'error' ? 'flash-error' : 'flash-ok' ?>" style="margin-bottom:16px;">
        <?= htmlspecialchars($flash, ENT_QUOTES, 'UTF-8') ?>
    </div>
<?php endif; ?>

<?php if ($editCatalog): ?>
    <div class="card catalog-edit-card">
        <h1>Editar catalogo: <?= htmlspecialchars($editCatalog['slug'], ENT_QUOTES, 'UTF-8') ?></h1>
        <form method="post" class="catalog-edit-grid">
            <input type="hidden" name="action" value="save">
            <input type="hidden" name="catalog_id" value="<?= (int) $editCatalog['id'] ?>">
            <label>
                <span>Titulo</span>
                <input type="text" name="title" value="<?= htmlspecialchars((string) $editCatalog['title'], ENT_QUOTES, 'UTF-8') ?>">
            </label>
            <label>
                <span>Estado</span>
                <select name="status">
                    <?php foreach (['active', 'expired', 'archived', 'draft'] as $option): ?>
                        <option value="<?= $option ?>" <?= $option === $editCatalog['status'] ? 'selected' : '' ?>><?= htmlspecialchars($option, ENT_QUOTES, 'UTF-8') ?></option>
                    <?php endforeach; ?>
                </select>
            </label>
            <label>
                <span>Vendedor</span>
                <input type="text" name="seller_name" value="<?= htmlspecialchars((string) $editCatalog['seller_name'], ENT_QUOTES, 'UTF-8') ?>">
            </label>
            <label>
                <span>Cliente</span>
                <input type="text" name="client_name" value="<?= htmlspecialchars((string) $editCatalog['client_name'], ENT_QUOTES, 'UTF-8') ?>">
            </label>
            <label class="wide">
                <span>Vence</span>
                <input type="datetime-local" name="expires_at" value="<?= !empty($editCatalog['expires_at']) ? htmlspecialchars(date('Y-m-d\TH:i', strtotime((string) $editCatalog['expires_at'])), ENT_QUOTES, 'UTF-8') : '' ?>">
            </label>
            <div class="wide catalog-actions">
                <button class="primary" type="submit">Guardar cambios</button>
                <a href="catalogos.php">Cancelar</a>
            </div>
        </form>
    </div>
<?php endif; ?>

<div class="card">
    <h1>Catalogos publicados</h1>
    <table>
        <thead>
            <tr>
                <th>Slug</th>
                <th>Titulo</th>
                <th>Estado</th>
                <th>Vendedor</th>
                <th>Cliente</th>
                <th>Vence</th>
                <th>Links</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($catalogs as $catalog): ?>
            <?php $status = resolve_catalog_status($catalog); ?>
            <tr>
                <td><?= htmlspecialchars($catalog['slug'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><?= htmlspecialchars($catalog['title'], ENT_QUOTES, 'UTF-8') ?></td>
                <td>
                    <span class="badge <?= $status === 'active' ? 'badge--active' : 'badge--expired' ?>">
                        <?= htmlspecialchars($status, ENT_QUOTES, 'UTF-8') ?>
                    </span>
                </td>
                <td><?= htmlspecialchars((string) $catalog['seller_name'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><?= htmlspecialchars((string) $catalog['client_name'], ENT_QUOTES, 'UTF-8') ?></td>
                <td><?= htmlspecialchars((string) $catalog['expires_at'], ENT_QUOTES, 'UTF-8') ?></td>
                <td>
                    <?php if (!empty($catalog['public_url'])): ?>
                        <a href="<?= htmlspecialchars($catalog['public_url'], ENT_QUOTES, 'UTF-8') ?>" target="_blank">Ver</a>
                    <?php endif; ?>
                    <?php if (!empty($catalog['pdf_url'])): ?>
                        <br><a href="<?= htmlspecialchars($catalog['pdf_url'], ENT_QUOTES, 'UTF-8') ?>" target="_blank">PDF</a>
                    <?php endif; ?>
                </td>
                <td>
                    <div class="catalog-actions">
                        <a href="catalogos.php?edit=<?= (int) $catalog['id'] ?>">Editar</a>
                        <form method="post">
                            <input type="hidden" name="action" value="renew">
                            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
                            <input type="hidden" name="renew_days" value="30">
                            <button type="submit">Renovar 30d</button>
                        </form>
                        <form method="post" onsubmit="return confirm('¿Eliminar este catalogo y su carpeta publicada?');">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
                            <button class="danger" type="submit">Eliminar</button>
                        </form>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php admin_footer(); ?>

<?php
function delete_directory_recursive(string $dirPath): void
{
    if (!is_dir($dirPath)) {
        return;
    }

    $items = scandir($dirPath);
    if ($items === false) {
        return;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $fullPath = $dirPath . DIRECTORY_SEPARATOR . $item;
        if (is_dir($fullPath)) {
            delete_directory_recursive($fullPath);
            continue;
        }
        @unlink($fullPath);
    }

    @rmdir($dirPath);
}
