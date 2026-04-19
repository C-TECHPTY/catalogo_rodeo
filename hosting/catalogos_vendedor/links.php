<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
vendor_require_login();

$sellerId = (int) (current_user()['seller_id'] ?? 0);
$stmt = db()->prepare(
    'SELECT l.*, c.title AS catalog_title, c.public_url, cl.business_name AS client_name
     FROM catalog_share_links l
     INNER JOIN catalogs c ON c.id = l.catalog_id
     LEFT JOIN clients cl ON cl.id = l.client_id
     WHERE l.seller_id = :seller_id
     ORDER BY l.created_at DESC'
);
$stmt->execute(['seller_id' => $sellerId]);
$links = $stmt->fetchAll();

vendor_header('Mis links', 'links.php');
?>
<section class="card">
    <div class="toolbar"><strong>Links compartidos</strong></div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Catalogo</th><th>Cliente</th><th>Aperturas</th><th>Ultimo acceso</th><th>URL</th></tr></thead>
            <tbody>
            <?php foreach ($links as $link): ?>
                <?php $shareUrl = !empty($link['public_url']) ? rtrim((string) $link['public_url'], '/') . '/?token=' . $link['token'] : ''; ?>
                <tr>
                    <td><?= html_escape($link['catalog_title']) ?></td>
                    <td><?= html_escape($link['client_name']) ?></td>
                    <td><?= (int) $link['open_count'] ?></td>
                    <td><?= html_escape($link['last_opened_at']) ?></td>
                    <td><?php if ($shareUrl !== ''): ?><a class="button" href="<?= html_escape($shareUrl) ?>" target="_blank">Copiar / abrir</a><?php endif; ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<?php vendor_footer(); ?>
