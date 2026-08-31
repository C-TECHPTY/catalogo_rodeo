<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login(['admin', 'sales']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    $action = (string) ($_POST['action'] ?? 'create');
    if ($action === 'toggle') {
        db()->prepare(
            'UPDATE catalog_share_links
             SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = NOW()
             WHERE id = :id'
        )->execute(['id' => (int) $_POST['link_id']]);
        flash_set('success', 'Estado del link actualizado.');
    } elseif ($action === 'cleanup_inactive') {
        $days = max(7, min(365, (int) ($_POST['days'] ?? 30)));
        $stmt = db()->prepare(
            'UPDATE catalog_share_links l
             SET l.is_active = 0, l.updated_at = NOW()
             WHERE l.is_active = 1
               AND l.created_at < DATE_SUB(NOW(), INTERVAL :days DAY)
               AND (l.expires_at IS NULL OR l.expires_at < NOW())
               AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.share_link_id = l.id)'
        );
        $stmt->bindValue('days', $days, PDO::PARAM_INT);
        $stmt->execute();
        flash_set('success', 'Links depurados sin borrar datos. Desactivados: ' . $stmt->rowCount());
    } else {
        $created = create_share_link(
            (int) $_POST['catalog_id'],
            (int) ($_POST['seller_id'] ?? 0) ?: null,
            (int) ($_POST['client_id'] ?? 0) ?: null,
            trim((string) ($_POST['label'] ?? 'Link comercial')),
            parse_datetime_or_null((string) ($_POST['expires_at'] ?? '')),
            trim((string) ($_POST['notes'] ?? ''))
        );
        flash_set('success', 'Link creado con token ' . substr($created['token'], 0, 12) . '...');
    }
    header('Location: links.php');
    exit;
}

$catalogs = db()->query("SELECT id, title, slug FROM catalogs WHERE status = 'active' ORDER BY updated_at DESC")->fetchAll();
$sellers = db()->query("SELECT id, name FROM sellers WHERE is_active = 1 ORDER BY name ASC")->fetchAll();
$clients = db()->query("SELECT id, business_name FROM clients WHERE is_active = 1 ORDER BY business_name ASC")->fetchAll();
$selectedCatalogId = (int) ($_GET['catalog_id'] ?? 0);
$sellerFilter = (int) ($_GET['seller_id'] ?? 0);
$catalogFilter = (int) ($_GET['filter_catalog_id'] ?? $_GET['catalog_id'] ?? 0);
$statusFilter = (string) ($_GET['status'] ?? 'active');
$whereParts = [];
$params = [];
if ($sellerFilter > 0) {
    $whereParts[] = 'l.seller_id = :seller_id';
    $params['seller_id'] = $sellerFilter;
}
if ($catalogFilter > 0) {
    $whereParts[] = 'l.catalog_id = :catalog_id';
    $params['catalog_id'] = $catalogFilter;
}
if ($statusFilter === 'active') {
    $whereParts[] = 'l.is_active = 1 AND (l.expires_at IS NULL OR l.expires_at >= NOW())';
} elseif ($statusFilter === 'inactive') {
    $whereParts[] = 'l.is_active = 0';
} elseif ($statusFilter === 'expired') {
    $whereParts[] = 'l.is_active = 1 AND l.expires_at IS NOT NULL AND l.expires_at < NOW()';
} elseif ($statusFilter === 'unused') {
    $whereParts[] = 'l.open_count = 0 AND NOT EXISTS (SELECT 1 FROM orders ou WHERE ou.share_link_id = l.id)';
}
$where = $whereParts ? 'WHERE ' . implode(' AND ', $whereParts) : '';
$linksStmt = db()->prepare(
    "SELECT l.*, c.title AS catalog_title, c.slug AS catalog_slug, c.public_url, s.name AS seller_name, cl.business_name AS client_name,
            (SELECT COUNT(*) FROM orders o WHERE o.share_link_id = l.id) AS orders_count
     FROM catalog_share_links l
     INNER JOIN catalogs c ON c.id = l.catalog_id
     LEFT JOIN sellers s ON s.id = l.seller_id
     LEFT JOIN clients cl ON cl.id = l.client_id
     $where
     ORDER BY l.created_at DESC
     LIMIT 200"
);
$linksStmt->execute($params);
$links = $linksStmt->fetchAll();

admin_header('Links compartidos', 'links.php');
?>
<div class="links-layout">
    <section class="card">
        <div class="toolbar"><strong>Generar link seguro</strong></div>
        <form class="form-grid" method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create">
            <label class="wide"><span>Catalogo</span><select name="catalog_id" required><?php foreach ($catalogs as $catalog): ?><option value="<?= (int) $catalog['id'] ?>" <?= $selectedCatalogId === (int) $catalog['id'] ? 'selected' : '' ?>><?= html_escape($catalog['title']) ?> (<?= html_escape($catalog['slug']) ?>)</option><?php endforeach; ?></select></label>
            <label><span>Vendedor</span><select name="seller_id"><option value="">Sin asignar</option><?php foreach ($sellers as $seller): ?><option value="<?= (int) $seller['id'] ?>"><?= html_escape($seller['name']) ?></option><?php endforeach; ?></select></label>
            <label><span>Cliente</span><select name="client_id"><option value="">Sin asignar</option><?php foreach ($clients as $client): ?><option value="<?= (int) $client['id'] ?>"><?= html_escape($client['business_name']) ?></option><?php endforeach; ?></select></label>
            <label class="wide"><span>Etiqueta</span><input type="text" name="label" value="Link comercial" required></label>
            <label><span>Expira</span><input type="datetime-local" name="expires_at"></label>
            <label><span>Notas</span><textarea name="notes"></textarea></label>
            <div class="wide"><button class="button--primary" type="submit">Crear link</button></div>
        </form>
    </section>
    <section class="card">
        <div class="toolbar">
            <strong>Links existentes</strong>
            <div class="toolbar__actions">
                <?php if ($sellerFilter > 0 || $catalogFilter > 0 || $statusFilter !== 'active'): ?><a class="button" href="links.php">Ver todos</a><?php endif; ?>
                <span class="pill"><?= count($links) ?> links</span>
            </div>
        </div>
        <form class="links-filters" method="get">
            <label><span>Catalogo</span><select name="filter_catalog_id"><option value="">Todos</option><?php foreach ($catalogs as $catalog): ?><option value="<?= (int) $catalog['id'] ?>" <?= $catalogFilter === (int) $catalog['id'] ? 'selected' : '' ?>><?= html_escape($catalog['title']) ?></option><?php endforeach; ?></select></label>
            <label><span>Vendedor</span><select name="seller_id"><option value="">Todos</option><?php foreach ($sellers as $seller): ?><option value="<?= (int) $seller['id'] ?>" <?= $sellerFilter === (int) $seller['id'] ? 'selected' : '' ?>><?= html_escape($seller['name']) ?></option><?php endforeach; ?></select></label>
            <label><span>Estado</span><select name="status">
                <option value="active" <?= $statusFilter === 'active' ? 'selected' : '' ?>>Activos</option>
                <option value="unused" <?= $statusFilter === 'unused' ? 'selected' : '' ?>>Sin uso</option>
                <option value="expired" <?= $statusFilter === 'expired' ? 'selected' : '' ?>>Vencidos</option>
                <option value="inactive" <?= $statusFilter === 'inactive' ? 'selected' : '' ?>>Inactivos</option>
                <option value="all" <?= $statusFilter === 'all' ? 'selected' : '' ?>>Todos</option>
            </select></label>
            <div class="links-filters__actions">
                <button class="button--primary" type="submit">Filtrar</button>
                <a class="button" href="links.php">Limpiar</a>
            </div>
        </form>
        <form class="links-cleanup" method="post" onsubmit="return confirm('Desactivar links viejos sin pedidos? No se borraran datos.');">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="cleanup_inactive">
            <span>Depurar links activos vencidos/sin vencimiento antiguo y sin pedidos</span>
            <select name="days" aria-label="Dias">
                <option value="30">Mas de 30 dias</option>
                <option value="60">Mas de 60 dias</option>
                <option value="90">Mas de 90 dias</option>
            </select>
            <button type="submit">Desactivar sin pedidos</button>
        </form>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Catalogo</th><th>Vendedor / Cliente</th><th>Token</th><th>Aperturas</th><th>Pedidos</th><th>Ultimo acceso</th><th>Estado</th><th>URL</th><th>Acciones</th></tr></thead>
                <tbody>
                <?php foreach ($links as $link): ?>
                    <?php $shareUrl = !empty($link['public_url']) ? catalog_share_public_url($link, (string) $link['public_url']) : ''; ?>
                    <tr>
                        <td><?= html_escape($link['catalog_title']) ?></td>
                        <td><?= html_escape($link['seller_name'] ?: 'Sin vendedor') ?> / <?= html_escape($link['client_name'] ?: 'Sin cliente') ?></td>
                        <td><code><?= html_escape(substr($link['token'], 0, 16)) ?>...</code></td>
                        <td><?= (int) $link['open_count'] ?></td>
                        <td><a href="pedidos.php?link_id=<?= (int) $link['id'] ?>"><?= (int) $link['orders_count'] ?></a></td>
                        <td><?= html_escape($link['last_opened_at']) ?></td>
                        <td><?= admin_status_badge(resolve_share_link_status($link)) ?></td>
                        <td><?php if ($shareUrl !== ''): ?><input class="link-url" type="text" value="<?= html_escape($shareUrl) ?>" readonly><a class="button" href="<?= html_escape($shareUrl) ?>" target="_blank">Abrir</a><?php endif; ?></td>
                        <td>
                            <form method="post">
                                <?= csrf_field() ?>
                                <input type="hidden" name="action" value="toggle">
                                <input type="hidden" name="link_id" value="<?= (int) $link['id'] ?>">
                                <button type="submit"><?= (int) $link['is_active'] === 1 ? 'Desactivar' : 'Activar' ?></button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </section>
</div>
<?php admin_footer(); ?>
