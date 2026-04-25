<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login();

$hasOrders = admin_table_exists('orders');
$hasCatalogs = admin_table_exists('catalogs');
$hasSellers = admin_table_exists('sellers');
$hasClients = admin_table_exists('clients');
$hasItems = admin_table_exists('order_items');
$hasHistory = admin_table_exists('order_status_history');
$orderColumns = [];
foreach (['id','order_number','catalog_id','share_link_id','seller_id','client_id','company_name','customer_name','contact_name','customer_email','contact_email','customer_phone','contact_phone','address_zone','total','status','created_at','seller_name'] as $column) {
    $orderColumns[$column] = $hasOrders && admin_column_exists('orders', $column);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    $allowedStatuses = ['new', 'reviewed', 'processing', 'invoiced', 'completed', 'cancelled'];
    $status = (string) ($_POST['status'] ?? 'new');
    if (!in_array($status, $allowedStatuses, true)) {
        flash_set('error', 'Estado de pedido invalido.');
        header('Location: pedidos.php');
        exit;
    }
    update_order_status((int) $_POST['order_id'], $status, trim((string) ($_POST['notes'] ?? '')));
    flash_set('success', 'Estado del pedido actualizado.');
    header('Location: pedidos.php?id=' . (int) $_POST['order_id']);
    exit;
}

$orderId = (int) ($_GET['id'] ?? 0);
if ($orderId > 0) {
    if (!$hasOrders) {
        admin_header('Detalle de pedido', 'pedidos.php');
        echo '<section class="card">Falta la tabla de pedidos. Ejecuta la migracion SQL.</section>';
        admin_footer();
        exit;
    }
    $catalogJoin = $hasCatalogs && $orderColumns['catalog_id'] ? 'LEFT JOIN catalogs c ON c.id = o.catalog_id' : '';
    $catalogTitle = $hasCatalogs && admin_column_exists('catalogs', 'title') && $orderColumns['catalog_id'] ? 'c.title' : "''";
    $catalogUrl = $hasCatalogs && admin_column_exists('catalogs', 'public_url') && $orderColumns['catalog_id'] ? 'c.public_url' : "''";
    $catalogJsonPath = $hasCatalogs && admin_column_exists('catalogs', 'catalog_json_path') && $orderColumns['catalog_id'] ? 'c.catalog_json_path' : "''";
    $catalogApiPayload = $hasCatalogs && admin_column_exists('catalogs', 'api_payload') && $orderColumns['catalog_id'] ? 'c.api_payload' : "''";
    $sellerJoin = $hasSellers && $orderColumns['seller_id'] ? 'LEFT JOIN sellers s ON s.id = o.seller_id' : '';
    $sellerName = $hasSellers && $orderColumns['seller_id'] ? 's.name' : "''";
    $clientJoin = $hasClients && $orderColumns['client_id'] ? 'LEFT JOIN clients cl ON cl.id = o.client_id' : '';
    $clientName = $hasClients && $orderColumns['client_id'] ? 'cl.business_name' : "''";
    $stmt = db()->prepare(
        "SELECT o.*, {$catalogTitle} AS catalog_title, {$catalogUrl} AS public_url,
                {$catalogJsonPath} AS catalog_json_path, {$catalogApiPayload} AS api_payload,
                {$sellerName} AS seller_display_name, {$clientName} AS client_business_name
         FROM orders o
         {$catalogJoin}
         {$sellerJoin}
         {$clientJoin}
         WHERE o.id = :id
         LIMIT 1"
    );
    $stmt->execute(['id' => $orderId]);
    $order = $stmt->fetch();
    $items = [];
    $history = [];
    if ($order && $hasItems) {
        $itemsStmt = db()->prepare('SELECT * FROM order_items WHERE order_id = :order_id ORDER BY id ASC');
        $itemsStmt->execute(['order_id' => $orderId]);
        $items = hydrate_order_item_image_urls($order, $itemsStmt->fetchAll());
    }
    if ($order && $hasHistory) {
        $historyStmt = db()->prepare('SELECT * FROM order_status_history WHERE order_id = :order_id ORDER BY created_at DESC');
        $historyStmt->execute(['order_id' => $orderId]);
        $history = $historyStmt->fetchAll();
    }

    admin_header('Detalle de pedido', 'pedidos.php');
    if (!$order) {
        echo '<section class="card">Pedido no encontrado.</section>';
        admin_footer();
        exit;
    }
    ?>
    <div class="split">
        <section class="card">
            <div class="toolbar">
                <strong><?= html_escape($order['order_number'] ?? ('PED-' . (int) $order['id'])) ?></strong>
                <?= admin_status_badge((string) ($order['status'] ?? 'new')) ?>
            </div>
            <div class="form-grid" style="margin-bottom:18px;">
                <?php $salesContact = sales_contact_info(); ?>
                <div><strong>Catalogo</strong><div class="muted"><?= html_escape($order['catalog_title']) ?></div></div>
                <div><strong>Vendedor</strong><div class="muted"><?= html_escape($order['seller_display_name'] ?: $order['seller_name'] ?: 'Sin vendedor') ?></div></div>
                <div><strong>Cliente asociado</strong><div class="muted"><?= html_escape($order['client_business_name'] ?: 'Sin cliente') ?></div></div>
                <div><strong>Empresa</strong><div class="muted"><?= html_escape(($order['company_name'] ?? '') ?: ($order['customer_name'] ?? '')) ?></div></div>
                <div><strong>Contacto</strong><div class="muted"><?= html_escape(($order['contact_name'] ?? '') ?: ($order['customer_name'] ?? '')) ?></div></div>
                <div><strong>Telefono</strong><div class="muted"><?= html_escape(($order['contact_phone'] ?? '') ?: ($order['customer_phone'] ?? '')) ?></div></div>
                <div><strong>Correo</strong><div class="muted"><?= html_escape(($order['contact_email'] ?? '') ?: ($order['customer_email'] ?? '')) ?></div></div>
                <div><strong>Contacto comercial</strong><div class="muted"><?= html_escape($salesContact['name']) ?></div></div>
                <div><strong>Correo comercial</strong><div class="muted"><?= html_escape($salesContact['email']) ?></div></div>
                <div><strong>Telefono comercial</strong><div class="muted"><?= html_escape($salesContact['phone']) ?></div></div>
                <div><strong>Zona</strong><div class="muted"><?= html_escape($order['address_zone'] ?? '') ?></div></div>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Imagen</th><th>ITEM</th><th>Descripcion</th><th>Cantidad</th><th>Unidad</th><th>Empaque</th><th>Piezas</th><th>Total</th></tr></thead>
                    <tbody>
                    <?php foreach ($items as $item): ?>
                        <?php $imageUrl = safeImageUrl((string) ($item['image_url'] ?? ''), 'https://rodeoimportzl.com/catalogos_admin/assets/no-image.png'); ?>
                        <tr>
                            <td>
                                <?php if (!empty($item['image_url'])): ?>
                                    <button type="button" class="order-image-thumb" data-full-image="<?= html_escape($imageUrl) ?>" aria-label="Ver imagen de <?= html_escape($item['item_code']) ?>">
                                        <img src="<?= html_escape($imageUrl) ?>" alt="<?= html_escape($item['item_code']) ?>" loading="lazy">
                                    </button>
                                <?php else: ?>
                                    <span class="order-image-placeholder">Sin imagen</span>
                                <?php endif; ?>
                            </td>
                            <td><?= html_escape($item['item_code']) ?></td>
                            <td><?= html_escape($item['description']) ?></td>
                            <td><?= html_escape(rtrim(rtrim(number_format((float) $item['quantity'], 2, '.', ''), '0'), '.')) ?></td>
                            <td><?= html_escape($item['sale_unit'] ?? 'unidad') ?></td>
                            <td><?= html_escape($item['package_label'] ?? '') ?> <?= html_escape(isset($item['package_qty']) ? rtrim(rtrim(number_format((float) $item['package_qty'], 2, '.', ''), '0'), '.') : '') ?></td>
                            <td><?= html_escape(isset($item['pieces_total']) ? rtrim(rtrim(number_format((float) $item['pieces_total'], 2, '.', ''), '0'), '.') : '') ?></td>
                            <td><?= html_escape(number_format((float) ($item['line_total'] ?? $item['price'] ?? 0), 2)) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div class="toolbar" style="margin-top:16px;">
                <strong>Total general: <?= html_escape(number_format((float) ($order['total'] ?? 0), 2)) ?></strong>
                <div class="toolbar__actions">
                    <a class="button" href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>">CSV</a>
                    <a class="button" href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>&format=xlsx">XLSX</a>
                    <a class="button" href="../catalogos_api/export_order.php?id=<?= (int) $order['id'] ?>&format=pdf" target="_blank">PDF/Print</a>
                </div>
            </div>
        </section>
        <section class="grid">
            <div class="card">
                <div class="toolbar"><strong>Cambiar estado</strong></div>
                <form class="grid" method="post">
                    <?= csrf_field() ?>
                    <input type="hidden" name="order_id" value="<?= (int) $order['id'] ?>">
                    <label><span>Nuevo estado</span><select name="status"><?php foreach (['new','processing','invoiced','completed','reviewed','cancelled'] as $status): ?><option value="<?= $status ?>" <?= $status === ($order['status'] ?? '') ? 'selected' : '' ?>><?= html_escape(admin_state_label($status)) ?></option><?php endforeach; ?></select></label>
                    <label><span>Notas</span><textarea name="notes"></textarea></label>
                    <button class="button--primary" type="submit">Actualizar</button>
                </form>
            </div>
            <div class="card">
                <div class="toolbar"><strong>Historial</strong></div>
                <div class="list">
                    <?php foreach ($history as $row): ?>
                        <div class="list-item">
                            <strong><?= html_escape($row['to_status']) ?></strong>
                            <div class="muted"><?= html_escape($row['created_at']) ?></div>
                            <div class="muted"><?= html_escape($row['notes']) ?></div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>
    </div>
    <style>
        .order-image-thumb { width:60px; height:60px; padding:0; border:1px solid #d9deea; border-radius:8px; background:#fff; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .order-image-thumb img { width:60px; height:60px; object-fit:contain; border-radius:8px; display:block; }
        .order-image-placeholder { width:60px; height:60px; border:1px solid #d9deea; border-radius:8px; background:#f4f6f8; color:#667085; display:inline-flex; align-items:center; justify-content:center; font-size:11px; text-align:center; }
        .order-image-lightbox { position:fixed; inset:0; z-index:9999; background:rgba(10,18,32,.78); display:none; align-items:center; justify-content:center; padding:24px; }
        .order-image-lightbox.open { display:flex; }
        .order-image-lightbox__panel { position:relative; max-width:min(920px, 94vw); max-height:90vh; background:#fff; border-radius:10px; padding:18px; box-shadow:0 18px 60px rgba(0,0,0,.3); }
        .order-image-lightbox__panel img { max-width:100%; max-height:78vh; object-fit:contain; display:block; }
        .order-image-lightbox__close { position:absolute; top:8px; right:8px; border:0; border-radius:999px; width:32px; height:32px; background:#2c4695; color:#fff; font-size:20px; line-height:32px; cursor:pointer; }
    </style>
    <div class="order-image-lightbox" id="orderImageLightbox" aria-hidden="true">
        <div class="order-image-lightbox__panel">
            <button type="button" class="order-image-lightbox__close" aria-label="Cerrar">&times;</button>
            <img src="" alt="Imagen de producto">
        </div>
    </div>
    <script>
        (() => {
            const lightbox = document.getElementById("orderImageLightbox");
            if (!lightbox) return;
            const image = lightbox.querySelector("img");
            const close = () => {
                lightbox.classList.remove("open");
                lightbox.setAttribute("aria-hidden", "true");
                if (image) image.src = "";
            };
            document.querySelectorAll(".order-image-thumb").forEach((button) => {
                button.addEventListener("click", () => {
                    if (!image || !button.dataset.fullImage) return;
                    image.src = button.dataset.fullImage;
                    lightbox.classList.add("open");
                    lightbox.setAttribute("aria-hidden", "false");
                });
            });
            lightbox.querySelector(".order-image-lightbox__close")?.addEventListener("click", close);
            lightbox.addEventListener("click", (event) => {
                if (event.target === lightbox) close();
            });
            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape") close();
            });
        })();
    </script>
    <?php
    admin_footer();
    exit;
}

$sellerFilter = (int) ($_GET['seller_id'] ?? 0);
$linkFilter = (int) ($_GET['link_id'] ?? 0);
$conditions = [];
$params = [];
if ($sellerFilter > 0 && $orderColumns['seller_id']) {
    $conditions[] = 'o.seller_id = :seller_id';
    $params['seller_id'] = $sellerFilter;
}
if ($linkFilter > 0 && $orderColumns['share_link_id']) {
    $conditions[] = 'o.share_link_id = :link_id';
    $params['link_id'] = $linkFilter;
}
$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
$orders = [];
if ($hasOrders) {
    $orderNumberExpr = $orderColumns['order_number'] ? 'o.order_number' : "CONCAT('PED-', o.id)";
    $companyExpr = $orderColumns['company_name'] ? 'o.company_name' : ($orderColumns['customer_name'] ? 'o.customer_name' : "''");
    $contactExpr = $orderColumns['contact_name'] ? 'o.contact_name' : ($orderColumns['customer_name'] ? 'o.customer_name' : "''");
    $totalExpr = $orderColumns['total'] ? 'o.total' : '0';
    $statusExpr = $orderColumns['status'] ? 'o.status' : "'new'";
    $createdExpr = $orderColumns['created_at'] ? 'o.created_at' : "''";
    $catalogJoin = $hasCatalogs && $orderColumns['catalog_id'] ? 'LEFT JOIN catalogs c ON c.id = o.catalog_id' : '';
    $catalogExpr = $hasCatalogs && $orderColumns['catalog_id'] && admin_column_exists('catalogs', 'title') ? 'c.title' : "''";
    $sellerJoin = $hasSellers && $orderColumns['seller_id'] ? 'LEFT JOIN sellers s ON s.id = o.seller_id' : '';
    $sellerExpr = $hasSellers && $orderColumns['seller_id'] ? 's.name' : "''";
    $orderBy = $orderColumns['created_at'] ? 'o.created_at DESC' : 'o.id DESC';
    $ordersStmt = db()->prepare(
        "SELECT o.id, {$orderNumberExpr} AS order_number, {$companyExpr} AS company_name, {$contactExpr} AS contact_name,
                {$totalExpr} AS total, {$statusExpr} AS status, {$createdExpr} AS created_at,
                {$catalogExpr} AS catalog_title, {$sellerExpr} AS seller_name
         FROM orders o
         {$catalogJoin}
         {$sellerJoin}
         {$where}
         ORDER BY {$orderBy}
         LIMIT 200"
    );
    $ordersStmt->execute($params);
    $orders = $ordersStmt->fetchAll();
}

admin_header('Pedidos', 'pedidos.php');
?>
<?php if (!$hasOrders): ?>
    <section class="card">
        <strong>Falta la tabla de pedidos.</strong>
        <p class="muted">Ejecuta la migracion SQL antes de usar este modulo.</p>
    </section>
    <?php admin_footer(); exit; ?>
<?php endif; ?>
<section class="card">
    <div class="toolbar">
        <strong>Pedidos registrados</strong>
        <div class="toolbar__actions">
            <?php if ($sellerFilter > 0 || $linkFilter > 0): ?><a class="button" href="pedidos.php">Ver todos</a><?php endif; ?>
            <span class="pill"><?= count($orders) ?> resultados</span>
        </div>
    </div>
    <div class="table-wrap">
        <table>
            <thead><tr><th>Pedido</th><th>Catalogo</th><th>Vendedor</th><th>Empresa</th><th>Contacto</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody>
            <?php foreach ($orders as $order): ?>
                <tr>
                    <td><?= html_escape($order['order_number']) ?></td>
                    <td><?= html_escape($order['catalog_title']) ?></td>
                    <td><?= html_escape($order['seller_name'] ?: 'Sin vendedor') ?></td>
                    <td><?= html_escape($order['company_name']) ?></td>
                    <td><?= html_escape($order['contact_name']) ?></td>
                    <td><?= html_escape(number_format((float) $order['total'], 2)) ?></td>
                    <td><?= admin_status_badge((string) $order['status']) ?></td>
                    <td><?= html_escape($order['created_at']) ?></td>
                    <td><a class="button" href="pedidos.php?id=<?= (int) $order['id'] ?>">Ver detalle</a></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<?php admin_footer(); ?>
