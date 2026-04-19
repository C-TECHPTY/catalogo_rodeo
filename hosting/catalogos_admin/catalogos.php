<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    $action = (string) ($_POST['action'] ?? '');
    $catalogId = (int) ($_POST['catalog_id'] ?? 0);

    if ($action === 'save' && $catalogId > 0) {
        db()->prepare(
            'UPDATE catalogs
             SET title = :title, status = :status, expires_at = :expires_at, seller_name = :seller_name,
                 client_name = :client_name, hero_title = :hero_title, hero_subtitle = :hero_subtitle,
                 promo_title = :promo_title, promo_text = :promo_text, promo_image_url = :promo_image_url,
                 promo_video_url = :promo_video_url, promo_link_url = :promo_link_url, promo_link_label = :promo_link_label,
                 legacy_pdf_url = :legacy_pdf_url, modern_pdf_url = :modern_pdf_url, updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'title' => trim((string) $_POST['title']),
            'status' => trim((string) $_POST['status']),
            'expires_at' => parse_datetime_or_null((string) ($_POST['expires_at'] ?? '')),
            'seller_name' => trim((string) ($_POST['seller_name'] ?? '')),
            'client_name' => trim((string) ($_POST['client_name'] ?? '')),
            'hero_title' => trim((string) ($_POST['hero_title'] ?? '')),
            'hero_subtitle' => trim((string) ($_POST['hero_subtitle'] ?? '')),
            'promo_title' => trim((string) ($_POST['promo_title'] ?? '')),
            'promo_text' => trim((string) ($_POST['promo_text'] ?? '')),
            'promo_image_url' => trim((string) ($_POST['promo_image_url'] ?? '')),
            'promo_video_url' => trim((string) ($_POST['promo_video_url'] ?? '')),
            'promo_link_url' => trim((string) ($_POST['promo_link_url'] ?? '')),
            'promo_link_label' => trim((string) ($_POST['promo_link_label'] ?? '')),
            'legacy_pdf_url' => trim((string) ($_POST['legacy_pdf_url'] ?? '')),
            'modern_pdf_url' => trim((string) ($_POST['modern_pdf_url'] ?? '')),
            'id' => $catalogId,
        ]);
        audit_log('catalog.updated', 'catalogs', $catalogId);
        flash_set('success', 'Catalogo actualizado correctamente.');
        header('Location: catalogos.php');
        exit;
    }

    if ($action === 'toggle' && $catalogId > 0) {
        db()->prepare(
            "UPDATE catalogs
             SET status = CASE WHEN status = 'active' THEN 'archived' ELSE 'active' END, updated_at = NOW()
             WHERE id = :id"
        )->execute(['id' => $catalogId]);
        audit_log('catalog.toggled', 'catalogs', $catalogId);
        flash_set('success', 'Estado del catalogo actualizado.');
        header('Location: catalogos.php');
        exit;
    }
}

$catalogs = db()->query(
    'SELECT c.*, s.name AS seller_display_name, cl.business_name AS client_business_name,
            (SELECT COUNT(*) FROM catalog_share_links l WHERE l.catalog_id = c.id) AS links_count,
            (SELECT COUNT(*) FROM orders o WHERE o.catalog_id = c.id) AS orders_count
     FROM catalogs c
     LEFT JOIN sellers s ON s.id = c.seller_id
     LEFT JOIN clients cl ON cl.id = c.client_id
     ORDER BY c.updated_at DESC
     LIMIT 200'
)->fetchAll();

$editId = (int) ($_GET['edit'] ?? 0);
$editCatalog = null;
foreach ($catalogs as $catalog) {
    if ((int) $catalog['id'] === $editId) {
        $editCatalog = $catalog;
        break;
    }
}

admin_header('Catalogos', 'catalogos.php');
?>
<?php if ($editCatalog): ?>
    <section class="card" style="margin-bottom:18px;">
        <div class="toolbar"><strong>Editar catalogo</strong><a class="button" href="catalogos.php">Cancelar</a></div>
        <form class="form-grid" method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="save">
            <input type="hidden" name="catalog_id" value="<?= (int) $editCatalog['id'] ?>">
            <label><span>Titulo</span><input type="text" name="title" value="<?= html_escape($editCatalog['title']) ?>" required></label>
            <label><span>Estado</span><select name="status"><?php foreach (['active','draft','expired','archived'] as $status): ?><option value="<?= $status ?>" <?= $status === $editCatalog['status'] ? 'selected' : '' ?>><?= html_escape($status) ?></option><?php endforeach; ?></select></label>
            <label><span>Vendedor visible</span><input type="text" name="seller_name" value="<?= html_escape($editCatalog['seller_name']) ?>"></label>
            <label><span>Cliente visible</span><input type="text" name="client_name" value="<?= html_escape($editCatalog['client_name']) ?>"></label>
            <label class="wide"><span>Hero title</span><input type="text" name="hero_title" value="<?= html_escape($editCatalog['hero_title']) ?>"></label>
            <label class="wide"><span>Hero subtitle</span><input type="text" name="hero_subtitle" value="<?= html_escape($editCatalog['hero_subtitle']) ?>"></label>
            <label><span>Promo title</span><input type="text" name="promo_title" value="<?= html_escape($editCatalog['promo_title'] ?? '') ?>"></label>
            <label><span>Promo texto</span><input type="text" name="promo_text" value="<?= html_escape($editCatalog['promo_text'] ?? '') ?>"></label>
            <label class="wide"><span>Promo imagen URL</span><input type="text" name="promo_image_url" value="<?= html_escape($editCatalog['promo_image_url'] ?? '') ?>"></label>
            <label class="wide"><span>Promo video URL</span><input type="text" name="promo_video_url" value="<?= html_escape($editCatalog['promo_video_url'] ?? '') ?>"></label>
            <label class="wide"><span>Promo link URL</span><input type="text" name="promo_link_url" value="<?= html_escape($editCatalog['promo_link_url'] ?? '') ?>"></label>
            <label><span>Promo CTA</span><input type="text" name="promo_link_label" value="<?= html_escape($editCatalog['promo_link_label'] ?? '') ?>"></label>
            <label class="wide"><span>PDF legado URL</span><input type="text" name="legacy_pdf_url" value="<?= html_escape($editCatalog['legacy_pdf_url'] ?? '') ?>"></label>
            <label class="wide"><span>PDF moderno URL</span><input type="text" name="modern_pdf_url" value="<?= html_escape($editCatalog['modern_pdf_url'] ?? '') ?>"></label>
            <label class="wide"><span>Vence</span><input type="datetime-local" name="expires_at" value="<?= !empty($editCatalog['expires_at']) ? html_escape(date('Y-m-d\TH:i', strtotime((string) $editCatalog['expires_at']))) : '' ?>"></label>
            <div class="wide"><button class="button--primary" type="submit">Guardar cambios</button></div>
        </form>
    </section>
<?php endif; ?>

<section class="card">
    <div class="toolbar"><strong>Catalogos publicados</strong><span class="pill"><?= count($catalogs) ?> registros</span></div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Slug</th><th>Titulo</th><th>Vendedor</th><th>Estado</th><th>Creado</th><th>Expira</th><th>Links</th><th>Pedidos</th><th>Acciones</th></tr></thead>
            <tbody>
            <?php foreach ($catalogs as $catalog): ?>
                <tr>
                    <td><?= html_escape($catalog['slug']) ?></td>
                    <td><strong><?= html_escape($catalog['title']) ?></strong><div class="muted"><?= html_escape($catalog['public_url']) ?></div></td>
                    <td><?= html_escape($catalog['seller_display_name'] ?: $catalog['seller_name'] ?: 'Sin vendedor') ?></td>
                    <td><?= admin_status_badge(resolve_catalog_status($catalog)) ?></td>
                    <td><?= html_escape($catalog['created_at'] ?? $catalog['generated_at']) ?></td>
                    <td><?= html_escape($catalog['expires_at'] ?: 'Sin vencimiento') ?></td>
                    <td><?= (int) $catalog['links_count'] ?></td>
                    <td><?= (int) $catalog['orders_count'] ?></td>
                    <td>
                        <div class="toolbar__actions">
                            <a class="button" href="catalogos.php?edit=<?= (int) $catalog['id'] ?>">Editar</a>
                            <?php if (!empty($catalog['public_url'])): ?><a class="button" href="<?= html_escape($catalog['public_url']) ?>" target="_blank">Abrir</a><?php endif; ?>
                            <form method="post">
                                <?= csrf_field() ?>
                                <input type="hidden" name="action" value="toggle">
                                <input type="hidden" name="catalog_id" value="<?= (int) $catalog['id'] ?>">
                                <button type="submit"><?= $catalog['status'] === 'active' ? 'Archivar' : 'Activar' ?></button>
                            </form>
                        </div>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<?php admin_footer(); ?>
