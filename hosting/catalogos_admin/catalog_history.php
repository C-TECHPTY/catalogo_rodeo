<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login(['admin', 'sales']);

$catalogId = (int) ($_GET['catalog_id'] ?? 0);
$catalog = $catalogId > 0 ? history_fetch_catalog($catalogId) : null;
$errorMessage = '';
$backups = [];
$updateLogs = [];
$liveEditLogs = [];
$liveImportLogs = [];
$activityLogs = [];

if ($catalog) {
    try {
        $jsonPath = history_catalog_json_full_path($catalog);
        $backups = history_catalog_backups($jsonPath);
        $updateLogs = history_product_update_logs((int) $catalog['id']);
        $liveEditLogs = history_product_live_edit_logs((int) $catalog['id']);
        $liveImportLogs = history_product_live_import_logs((int) $catalog['id']);
        $activityLogs = history_activity_logs((int) $catalog['id']);
    } catch (Throwable $exception) {
        $errorMessage = $exception->getMessage();
    }
}

admin_header('Historial de catalogo', 'catalogos.php');
?>
<section class="card">
    <div class="toolbar">
        <strong>Historial y seguridad</strong>
        <a class="button" href="catalogos.php">Volver</a>
    </div>

    <?php if (!$catalog): ?>
        <p class="muted">Catalogo no encontrado.</p>
    <?php else: ?>
        <p class="muted">Catalogo: <strong><?= html_escape($catalog['title'] ?? '') ?></strong> &middot; <code><?= html_escape($catalog['slug'] ?? '') ?></code></p>
        <p class="muted">Vista de auditoria. No restaura, borra ni modifica archivos; solo muestra backups y eventos para revision segura.</p>

        <?php if ($errorMessage !== ''): ?>
            <div class="notice notice--warning" style="margin:16px 0;"><?= html_escape($errorMessage) ?></div>
        <?php endif; ?>

        <div class="metrics-grid" style="margin:18px 0;">
            <div class="metric-card"><span>Backups</span><strong><?= count($backups) ?></strong></div>
            <div class="metric-card"><span>Actualizaciones</span><strong><?= count($updateLogs) ?></strong></div>
            <div class="metric-card"><span>Ediciones vivas</span><strong><?= count($liveEditLogs) ?></strong></div>
            <div class="metric-card"><span>Imports vivos</span><strong><?= count($liveImportLogs) ?></strong></div>
            <div class="metric-card"><span>Eventos auditoria</span><strong><?= count($activityLogs) ?></strong></div>
        </div>
    <?php endif; ?>
</section>

<?php if ($catalog): ?>
<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Backups de catalog.json</strong><span class="pill"><?= count($backups) ?> archivos</span></div>
    <?php if (!$backups): ?>
        <p class="muted">Todavia no hay backups detectados para este catalogo.</p>
    <?php else: ?>
        <div class="table-wrap" style="margin-top:14px;">
            <table>
                <thead><tr><th>Archivo</th><th>Tipo probable</th><th>Tamano</th><th>Fecha</th><th>Ruta hosting</th></tr></thead>
                <tbody>
                <?php foreach ($backups as $backup): ?>
                    <tr>
                        <td><strong><?= html_escape($backup['name']) ?></strong></td>
                        <td><?= html_escape($backup['type']) ?></td>
                        <td><?= html_escape($backup['size_label']) ?></td>
                        <td><?= html_escape($backup['modified_at']) ?></td>
                        <td><code><?= html_escape($backup['relative_path']) ?></code></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</section>

<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Logs de actualizacion de productos</strong><span class="pill"><?= count($updateLogs) ?> registros</span></div>
    <?php if (!$updateLogs): ?>
        <p class="muted">No hay registros en <code>catalog_product_update_logs</code> para este catalogo, o la tabla no existe.</p>
    <?php else: ?>
        <div class="table-wrap" style="margin-top:14px;">
            <table>
                <thead><tr><th>Fecha</th><th>Archivo</th><th>Filas</th><th>Encontrados</th><th>Actualizados</th><th>Agotados</th><th>No encontrados</th><th>Errores</th><th>Usuario</th></tr></thead>
                <tbody>
                <?php foreach ($updateLogs as $log): ?>
                    <tr>
                        <td><?= html_escape($log['created_at'] ?? '') ?></td>
                        <td><?= html_escape($log['filename'] ?? '') ?></td>
                        <td><?= (int) ($log['total_rows'] ?? 0) ?></td>
                        <td><?= (int) ($log['matched_count'] ?? 0) ?></td>
                        <td><?= (int) ($log['updated_count'] ?? 0) ?></td>
                        <td><?= (int) ($log['out_of_stock_count'] ?? 0) ?></td>
                        <td><?= (int) ($log['not_found_count'] ?? 0) ?></td>
                        <td><?= (int) ($log['error_count'] ?? 0) ?></td>
                        <td><?= html_escape($log['admin_name'] ?? 'Sistema') ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</section>

<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Importaciones vivas CSV/XLSX</strong><span class="pill"><?= count($liveImportLogs) ?> corridas</span></div>
    <?php if (!$liveImportLogs): ?>
        <p class="muted">No hay registros en <code>catalog_product_live_import_logs</code> para este catalogo, o la tabla no existe.</p>
    <?php else: ?>
        <div class="table-wrap" style="margin-top:14px;">
            <table>
                <thead><tr><th>Fecha</th><th>Archivo</th><th>Filas</th><th>Actualizados</th><th>Nuevos</th><th>Omitidos</th><th>Errores</th><th>Usuario</th></tr></thead>
                <tbody>
                <?php foreach ($liveImportLogs as $log): ?>
                    <tr>
                        <td><?= html_escape($log['created_at'] ?? '') ?></td>
                        <td><?= html_escape($log['filename'] ?? '') ?></td>
                        <td><?= (int) ($log['total_rows'] ?? 0) ?></td>
                        <td><?= (int) ($log['updated_count'] ?? 0) ?></td>
                        <td><?= (int) ($log['created_count'] ?? 0) ?></td>
                        <td><?= (int) ($log['skipped_count'] ?? 0) ?></td>
                        <td><?= (int) ($log['error_count'] ?? 0) ?></td>
                        <td><?= html_escape($log['admin_name'] ?? 'Sistema') ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</section>

<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Historial de ediciones vivas por ITEM</strong><span class="pill"><?= count($liveEditLogs) ?> cambios</span></div>
    <?php if (!$liveEditLogs): ?>
        <p class="muted">No hay cambios en <code>catalog_product_live_edit_history</code> para este catalogo, o la tabla no existe.</p>
    <?php else: ?>
        <div class="table-wrap" style="margin-top:14px;">
            <table>
                <thead><tr><th>Fecha</th><th>ITEM</th><th>Campo</th><th>Anterior</th><th>Nuevo</th><th>Usuario</th></tr></thead>
                <tbody>
                <?php foreach ($liveEditLogs as $log): ?>
                    <tr>
                        <td><?= html_escape($log['created_at'] ?? '') ?></td>
                        <td><?= html_escape($log['item_code'] ?? '') ?></td>
                        <td><?= html_escape($log['field_name'] ?? '') ?></td>
                        <td><?= html_escape((string) ($log['old_value'] ?? '')) ?></td>
                        <td><?= html_escape((string) ($log['new_value'] ?? '')) ?></td>
                        <td><?= html_escape($log['admin_name'] ?? 'Sistema') ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</section>

<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Auditoria reciente</strong><span class="pill"><?= count($activityLogs) ?> eventos</span></div>
    <?php if (!$activityLogs): ?>
        <p class="muted">No hay eventos recientes disponibles, o la tabla <code>activity_logs</code> no existe.</p>
    <?php else: ?>
        <div class="table-wrap" style="margin-top:14px;">
            <table>
                <thead><tr><th>Fecha</th><th>Accion</th><th>Usuario</th><th>Contexto</th></tr></thead>
                <tbody>
                <?php foreach ($activityLogs as $log): ?>
                    <tr>
                        <td><?= html_escape($log['created_at'] ?? '') ?></td>
                        <td><code><?= html_escape($log['action'] ?? '') ?></code></td>
                        <td><?= html_escape($log['admin_name'] ?? 'Sistema') ?></td>
                        <td><code><?= html_escape(history_short_context((string) ($log['context_json'] ?? ''))) ?></code></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</section>
<?php endif; ?>
<?php admin_footer(); ?>

<?php
function history_fetch_catalog(int $catalogId): ?array
{
    if (!admin_table_exists('catalogs')) return null;
    $stmt = db()->prepare('SELECT * FROM catalogs WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $catalogId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function history_catalog_json_full_path(array $catalog): string
{
    $relative = trim((string) ($catalog['catalog_json_path'] ?? ''));
    if ($relative === '') throw new RuntimeException('El catalogo no tiene ruta catalog_json_path.');
    $baseDir = dirname(__DIR__);
    $fullPath = $baseDir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relative);
    $realBase = realpath($baseDir);
    $realDir = realpath(dirname($fullPath));
    if (!$realBase || !$realDir || strpos($realDir, $realBase) !== 0 || !is_file($fullPath)) {
        throw new RuntimeException('No se encontro catalog.json dentro del hosting permitido.');
    }
    return $fullPath;
}

function history_catalog_backups(string $jsonPath): array
{
    $backupDir = dirname($jsonPath) . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir)) return [];
    $baseDir = dirname(__DIR__);
    $items = [];
    foreach (glob($backupDir . DIRECTORY_SEPARATOR . '*.json') ?: [] as $path) {
        if (!is_file($path)) continue;
        $name = basename($path);
        $items[] = [
            'name' => $name,
            'type' => history_backup_type($name),
            'size_label' => history_size_label((int) filesize($path)),
            'modified_at' => date('Y-m-d H:i:s', (int) filemtime($path)),
            'relative_path' => str_replace('\\', '/', str_replace($baseDir . DIRECTORY_SEPARATOR, '', $path)),
            'mtime' => (int) filemtime($path),
        ];
    }
    usort($items, static fn(array $a, array $b): int => $b['mtime'] <=> $a['mtime']);
    return $items;
}

function history_backup_type(string $name): string
{
    $lower = strtolower($name);
    if (str_contains($lower, 'visual')) return 'Visual';
    if (str_contains($lower, 'products')) return 'Productos + imagenes';
    if (str_contains($lower, 'images')) return 'Imagenes';
    if (str_contains($lower, 'backup_')) return 'Datos comerciales';
    return 'Backup';
}

function history_product_update_logs(int $catalogId): array
{
    if (!admin_table_exists('catalog_product_update_logs')) return [];
    $joinUsers = admin_table_exists('catalog_users') ? 'LEFT JOIN catalog_users u ON u.id = l.admin_user_id' : '';
    $userSelect = admin_table_exists('catalog_users') ? 'COALESCE(u.full_name, u.username, "") AS admin_name' : '"" AS admin_name';
    $stmt = db()->prepare(
        "SELECT l.*, {$userSelect}
         FROM catalog_product_update_logs l
         {$joinUsers}
         WHERE l.catalog_id = :catalog_id
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 100"
    );
    $stmt->execute(['catalog_id' => $catalogId]);
    return $stmt->fetchAll();
}

function history_product_live_edit_logs(int $catalogId): array
{
    if (!admin_table_exists('catalog_product_live_edit_history')) return [];
    $joinUsers = admin_table_exists('catalog_users') ? 'LEFT JOIN catalog_users u ON u.id = h.admin_user_id' : '';
    $userSelect = admin_table_exists('catalog_users') ? 'COALESCE(u.full_name, u.username, "") AS admin_name' : '"" AS admin_name';
    $stmt = db()->prepare(
        "SELECT h.*, {$userSelect}
         FROM catalog_product_live_edit_history h
         {$joinUsers}
         WHERE h.catalog_id = :catalog_id
         ORDER BY h.created_at DESC, h.id DESC
         LIMIT 120"
    );
    $stmt->execute(['catalog_id' => $catalogId]);
    return $stmt->fetchAll();
}

function history_product_live_import_logs(int $catalogId): array
{
    if (!admin_table_exists('catalog_product_live_import_logs')) return [];
    $joinUsers = admin_table_exists('catalog_users') ? 'LEFT JOIN catalog_users u ON u.id = l.admin_user_id' : '';
    $userSelect = admin_table_exists('catalog_users') ? 'COALESCE(u.full_name, u.username, "") AS admin_name' : '"" AS admin_name';
    $stmt = db()->prepare(
        "SELECT l.*, {$userSelect}
         FROM catalog_product_live_import_logs l
         {$joinUsers}
         WHERE l.catalog_id = :catalog_id
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 80"
    );
    $stmt->execute(['catalog_id' => $catalogId]);
    return $stmt->fetchAll();
}

function history_activity_logs(int $catalogId): array
{
    if (!admin_table_exists('activity_logs')) return [];
    if (!admin_column_exists('activity_logs', 'entity_type') || !admin_column_exists('activity_logs', 'entity_id')) return [];
    $joinUsers = admin_table_exists('catalog_users') && admin_column_exists('activity_logs', 'user_id') ? 'LEFT JOIN catalog_users u ON u.id = a.user_id' : '';
    $userSelect = $joinUsers !== '' ? 'COALESCE(u.full_name, u.username, "") AS admin_name' : '"" AS admin_name';
    $actionColumn = admin_column_exists('activity_logs', 'action') ? 'a.action' : "''";
    $contextColumn = admin_column_exists('activity_logs', 'context_json') ? 'a.context_json' : "''";
    $createdColumn = admin_column_exists('activity_logs', 'created_at') ? 'a.created_at' : "''";
    $orderBy = admin_column_exists('activity_logs', 'created_at') ? 'a.created_at DESC' : (admin_column_exists('activity_logs', 'id') ? 'a.id DESC' : 'a.entity_id DESC');
    $stmt = db()->prepare(
        "SELECT {$actionColumn} AS action, {$contextColumn} AS context_json, {$createdColumn} AS created_at, {$userSelect}
         FROM activity_logs a
         {$joinUsers}
         WHERE a.entity_type = 'catalogs' AND a.entity_id = :catalog_id
         ORDER BY {$orderBy}
         LIMIT 100"
    );
    $stmt->execute(['catalog_id' => $catalogId]);
    return $stmt->fetchAll();
}

function history_size_label(int $bytes): string
{
    if ($bytes >= 1048576) return number_format($bytes / 1048576, 2) . ' MB';
    if ($bytes >= 1024) return number_format($bytes / 1024, 1) . ' KB';
    return $bytes . ' B';
}

function history_short_context(string $json): string
{
    $json = trim($json);
    if ($json === '') return '';
    if (strlen($json) <= 180) return $json;
    return substr($json, 0, 177) . '...';
}
