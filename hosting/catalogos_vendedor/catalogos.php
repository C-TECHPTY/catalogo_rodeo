<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
vendor_require_login();

$sellerId = (int) (current_user()['seller_id'] ?? 0);
$stmt = db()->prepare(
    'SELECT c.*, (SELECT COUNT(*) FROM catalog_share_links l WHERE l.catalog_id = c.id AND l.seller_id = :seller_id) AS links_count
     FROM catalogs c
     WHERE c.seller_id = :seller_id OR c.seller_name = :seller_name
     ORDER BY c.updated_at DESC'
);
$stmt->execute([
    'seller_id' => $sellerId,
    'seller_name' => current_user()['seller_display_name'] ?? '',
]);
$catalogs = $stmt->fetchAll();

vendor_header('Mis catalogos', 'catalogos.php');
?>
<section class="card">
    <div class="toolbar"><strong>Catalogos asignados</strong></div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Slug</th><th>Titulo</th><th>Estado</th><th>Vence</th><th>Links</th><th>Acciones</th></tr></thead>
            <tbody>
            <?php foreach ($catalogs as $catalog): ?>
                <tr>
                    <td><?= html_escape($catalog['slug']) ?></td>
                    <td><?= html_escape($catalog['title']) ?></td>
                    <td><?= admin_status_badge(resolve_catalog_status($catalog)) ?></td>
                    <td><?= html_escape($catalog['expires_at']) ?></td>
                    <td><?= (int) $catalog['links_count'] ?></td>
                    <td><?php if (!empty($catalog['public_url'])): ?><a class="button" href="<?= html_escape($catalog['public_url']) ?>" target="_blank">Abrir</a><?php endif; ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<?php vendor_footer(); ?>
