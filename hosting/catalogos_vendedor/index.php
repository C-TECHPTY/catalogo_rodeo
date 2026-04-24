<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
vendor_require_panel_login();

$user = vendor_current_user();
$sellerId = (int) ($user['seller_id'] ?? 0);

$schemaReady = vendor_b2b_schema_ready();
$hasEvents = vendor_table_exists('catalog_behavior_events');
$hasOrders = vendor_table_exists('orders');
$hasOrderItems = vendor_table_exists('order_items');
$hasClients = vendor_table_exists('clients');
$allowedWindows = [7, 30, 90];
$catalogsCount = 0;
$linksCount = 0;
$ordersCount = 0;
$recentOrders = [];
$activityWindow = (int) ($_GET['days'] ?? 30);
if (!in_array($activityWindow, $allowedWindows, true)) {
    $activityWindow = 30;
}
$activityStats = [
    'events' => 0,
    'cart_adds' => 0,
    'active_clients' => 0,
    'sales_total' => 0.0,
];
$activeClients = [];
$priorityContacts = [];
$suggestedProducts = [];
$suggestedMessages = [];
if ($schemaReady && $sellerId > 0) {
    $catalogsHasSellerId = vendor_column_exists('catalogs', 'seller_id');
    $catalogsHasSellerName = vendor_column_exists('catalogs', 'seller_name');
    $sellerDisplayName = (string) ($user['seller_display_name'] ?? '');
    $catalogConditions = [];
    $catalogParams = [];
    if ($catalogsHasSellerId) {
        $catalogConditions[] = 'c.seller_id = :catalog_seller_id';
        $catalogParams['catalog_seller_id'] = $sellerId;
    }
    if ($catalogsHasSellerName && $sellerDisplayName !== '') {
        $catalogConditions[] = 'c.seller_name = :catalog_seller_name';
        $catalogParams['catalog_seller_name'] = $sellerDisplayName;
    }
    $catalogConditions[] = 'EXISTS (SELECT 1 FROM catalog_share_links l WHERE l.catalog_id = c.id AND l.seller_id = :link_seller_id)';
    $catalogParams['link_seller_id'] = $sellerId;
    $catalogsCountStmt = db()->prepare(
        'SELECT COUNT(DISTINCT c.id) FROM catalogs c WHERE ' . implode(' OR ', $catalogConditions)
    );
    $catalogsCountStmt->execute($catalogParams);
    $catalogsCount = (int) $catalogsCountStmt->fetchColumn();
    $linksCountStmt = db()->prepare('SELECT COUNT(*) FROM catalog_share_links WHERE seller_id = :seller_id');
    $linksCountStmt->execute(['seller_id' => $sellerId]);
    $linksCount = (int) $linksCountStmt->fetchColumn();
    $ordersCountStmt = db()->prepare('SELECT COUNT(*) FROM orders WHERE seller_id = :seller_id');
    $ordersCountStmt->execute(['seller_id' => $sellerId]);
    $ordersCount = (int) $ordersCountStmt->fetchColumn();
    $recentOrdersStmt = db()->prepare(
        "SELECT order_number, company_name, total, status, created_at
         FROM orders
         WHERE seller_id = :seller_id
           AND created_at >= DATE_SUB(NOW(), INTERVAL {$activityWindow} DAY)
         ORDER BY created_at DESC
         LIMIT 8"
    );
    $recentOrdersStmt->execute(['seller_id' => $sellerId]);
    $recentOrders = $recentOrdersStmt->fetchAll();

    if ($hasEvents) {
        $activityStatsStmt = db()->prepare(
            "SELECT COUNT(*) AS events_count,
                    SUM(event_type = 'add_to_cart') AS cart_count,
                    COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), CONCAT('client-', client_id))) AS active_clients
             FROM catalog_behavior_events
             WHERE seller_id = :seller_id
               AND created_at >= DATE_SUB(NOW(), INTERVAL {$activityWindow} DAY)"
        );
        $activityStatsStmt->execute(['seller_id' => $sellerId]);
        $activityStatsRow = $activityStatsStmt->fetch() ?: [];
        $activityStats['events'] = (int) ($activityStatsRow['events_count'] ?? 0);
        $activityStats['cart_adds'] = (int) ($activityStatsRow['cart_count'] ?? 0);
        $activityStats['active_clients'] = (int) ($activityStatsRow['active_clients'] ?? 0);

        $clientNameExpr = $hasClients
            ? "COALESCE(NULLIF(cl.business_name, ''), NULLIF(cl.contact_name, ''), NULLIF(e.visitor_id, ''), 'Sin cliente asignado')"
            : "COALESCE(NULLIF(e.visitor_id, ''), 'Sin cliente asignado')";
        $clientJoin = $hasClients ? 'LEFT JOIN clients cl ON cl.id = e.client_id' : '';

        $activeClientsStmt = db()->prepare(
            "SELECT {$clientNameExpr} AS client_name,
                    MAX(e.category) AS category,
                    COUNT(*) AS events_count,
                    SUM(e.event_type = 'add_to_cart') AS cart_count,
                    MAX(e.created_at) AS last_event_at
             FROM catalog_behavior_events e
             {$clientJoin}
             WHERE e.seller_id = :seller_id
               AND e.created_at >= DATE_SUB(NOW(), INTERVAL {$activityWindow} DAY)
               AND (e.client_id IS NOT NULL OR e.visitor_id <> '')
             GROUP BY e.client_id, e.visitor_id, client_name
             ORDER BY cart_count DESC, events_count DESC, last_event_at DESC
             LIMIT 6"
        );
        $activeClientsStmt->execute(['seller_id' => $sellerId]);
        $activeClients = $activeClientsStmt->fetchAll();

        $priorityContactsStmt = db()->prepare(
            "SELECT {$clientNameExpr} AS client_name,
                    MAX(e.category) AS category,
                    MAX(e.item_code) AS item_code,
                    MAX(e.item_name) AS item_name,
                    SUM(e.event_type = 'product_detail') AS views_count,
                    SUM(e.event_type = 'add_to_cart') AS cart_count,
                    MAX(e.created_at) AS last_event_at
             FROM catalog_behavior_events e
             {$clientJoin}
             WHERE e.seller_id = :seller_id
               AND e.created_at >= DATE_SUB(NOW(), INTERVAL {$activityWindow} DAY)
               AND e.event_type IN ('product_detail','add_to_cart','cart_quantity','search')
               AND (e.client_id IS NOT NULL OR e.visitor_id <> '')
             GROUP BY e.client_id, e.visitor_id, client_name
             HAVING cart_count > 0 OR views_count >= 2
             ORDER BY cart_count DESC, views_count DESC, last_event_at DESC
             LIMIT 6"
        );
        $priorityContactsStmt->execute(['seller_id' => $sellerId]);
        $priorityContacts = $priorityContactsStmt->fetchAll();

        $suggestedProductsStmt = db()->prepare(
            "SELECT e.item_code,
                    MAX(e.item_name) AS item_name,
                    MAX(e.category) AS category,
                    SUM(e.event_type = 'product_detail') AS views_count,
                    SUM(e.event_type = 'add_to_cart') AS cart_count,
                    COUNT(DISTINCT COALESCE(NULLIF(e.visitor_id, ''), CONCAT('client-', e.client_id))) AS interested_clients
             FROM catalog_behavior_events e
             WHERE e.seller_id = :seller_id
               AND e.created_at >= DATE_SUB(NOW(), INTERVAL {$activityWindow} DAY)
               AND e.item_code <> ''
               AND e.event_type IN ('product_detail','add_to_cart','cart_quantity')
             GROUP BY e.item_code
             HAVING views_count >= 2 OR cart_count >= 1
             ORDER BY cart_count DESC, interested_clients DESC, views_count DESC
             LIMIT 6"
        );
        $suggestedProductsStmt->execute(['seller_id' => $sellerId]);
        $suggestedProducts = $suggestedProductsStmt->fetchAll();
    }

    if ($hasOrders) {
        $salesTotalStmt = db()->prepare(
            "SELECT COALESCE(SUM(total), 0)
             FROM orders
             WHERE seller_id = :seller_id
               AND created_at >= DATE_SUB(NOW(), INTERVAL {$activityWindow} DAY)"
        );
        $salesTotalStmt->execute(['seller_id' => $sellerId]);
        $activityStats['sales_total'] = (float) $salesTotalStmt->fetchColumn();
    }

    foreach (array_slice($priorityContacts, 0, 4) as $contact) {
        $clientName = trim((string) ($contact['client_name'] ?? 'Cliente'));
        $categoryLabel = trim((string) ($contact['category'] ?? 'la categoria detectada'));
        $itemCode = trim((string) ($contact['item_code'] ?? ''));
        $candidateProducts = [];

        foreach ($suggestedProducts as $product) {
            $productCode = trim((string) ($product['item_code'] ?? ''));
            $productCategory = trim((string) ($product['category'] ?? ''));
            if ($productCode === '' || in_array($productCode, $candidateProducts, true)) {
                continue;
            }
            if ($categoryLabel !== '' && $productCategory !== '' && strcasecmp($productCategory, $categoryLabel) !== 0) {
                continue;
            }
            $candidateProducts[] = $productCode;
            if (count($candidateProducts) >= 2) {
                break;
            }
        }

        if (count($candidateProducts) < 2 && $hasOrderItems && $hasOrders) {
            $fallbackStmt = db()->prepare(
                "SELECT oi.item_code
                 FROM order_items oi
                 INNER JOIN orders o ON o.id = oi.order_id
                 WHERE o.seller_id = :seller_id
                   AND oi.item_code <> ''
                   AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
                 GROUP BY oi.item_code
                 ORDER BY SUM(oi.line_total) DESC, SUM(oi.quantity) DESC
                 LIMIT 4"
            );
            $fallbackStmt->execute(['seller_id' => $sellerId]);
            foreach ($fallbackStmt->fetchAll(PDO::FETCH_COLUMN) as $fallbackCode) {
                $fallbackCode = trim((string) $fallbackCode);
                if ($fallbackCode === '' || in_array($fallbackCode, $candidateProducts, true)) {
                    continue;
                }
                $candidateProducts[] = $fallbackCode;
                if (count($candidateProducts) >= 2) {
                    break;
                }
            }
        }

        $message = 'Hola ' . $clientName . ', vimos interes reciente en ' . $categoryLabel . '.';
        if ($itemCode !== '') {
            $message .= ' Te podemos ayudar con ' . $itemCode . '.';
        }
        if ($candidateProducts) {
            $message .= ' Te sugerimos revisar ' . implode(' / ', $candidateProducts) . '.';
        } else {
            $message .= ' Tenemos opciones relacionadas listas para cotizar.';
        }

        $suggestedMessages[] = [
            'client_name' => $clientName,
            'message' => $message,
            'last_event_at' => (string) ($contact['last_event_at'] ?? ''),
        ];
    }
}

vendor_header('Resumen comercial', 'index.php');
?>
<div class="grid grid--cards">
    <div class="card"><div class="stat__label">Catalogos</div><div class="stat__value"><?= $catalogsCount ?></div></div>
    <div class="card"><div class="stat__label">Links</div><div class="stat__value"><?= $linksCount ?></div></div>
    <div class="card"><div class="stat__label">Pedidos</div><div class="stat__value"><?= $ordersCount ?></div></div>
    <div class="card"><div class="stat__label">Vendedor</div><div class="stat__value" style="font-size:22px;"><?= html_escape($user['seller_display_name'] ?: $user['full_name']) ?></div></div>
</div>
<?php if ($schemaReady && $sellerId > 0): ?>
<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Filtros del resumen</strong><span class="pill">solo lectura</span></div>
    <form class="form-grid" method="get">
        <label>
            <span>Periodo</span>
            <select name="days">
                <?php foreach ($allowedWindows as $window): ?>
                    <option value="<?= $window ?>" <?= $activityWindow === $window ? 'selected' : '' ?>><?= $window ?> dias</option>
                <?php endforeach; ?>
            </select>
        </label>
        <div class="wide toolbar__actions">
            <button class="button--primary" type="submit">Aplicar filtro</button>
            <a class="button" href="index.php">Limpiar</a>
        </div>
    </form>
</section>
<div class="grid grid--cards dashboard-secondary">
    <div class="card"><div class="stat__label">Eventos <?= $activityWindow ?> dias</div><div class="stat__value"><?= $activityStats['events'] ?></div></div>
    <div class="card"><div class="stat__label">Carritos <?= $activityWindow ?> dias</div><div class="stat__value"><?= $activityStats['cart_adds'] ?></div></div>
    <div class="card"><div class="stat__label">Clientes mas activos</div><div class="stat__value"><?= $activityStats['active_clients'] ?></div></div>
    <div class="card"><div class="stat__label">Monto en pedidos</div><div class="stat__value" style="font-size:22px;"><?= html_escape(number_format((float) $activityStats['sales_total'], 2)) ?></div></div>
</div>
<?php endif; ?>
<?php if (!$schemaReady || $sellerId <= 0): ?>
    <section class="card" style="margin-top:18px;">
        <strong>Panel vendedor pendiente de migracion.</strong>
        <p class="muted">Ejecuta <code>hosting/sql/20260419_b2b_schema_compat.sql</code> y asigna este usuario a un vendedor para activar catalogos, links y pedidos trazables.</p>
    </section>
<?php endif; ?>
<?php if ($schemaReady && $sellerId > 0 && !$hasEvents): ?>
    <section class="card" style="margin-top:18px;">
        <strong>Inteligencia comercial pendiente de activar.</strong>
        <p class="muted">Cuando ejecutes <code>hosting/sql/20260423_intelligence_events.sql</code> y el catalogo publique eventos, aqui apareceran contactos prioritarios, productos sugeridos y mensajes comerciales.</p>
    </section>
<?php endif; ?>
<?php if ($schemaReady && $sellerId > 0 && $hasEvents): ?>
<div class="split" style="margin-top:18px;">
    <section class="card">
        <div class="toolbar"><strong>Clientes mas activos</strong><span class="pill">ultimos <?= $activityWindow ?> dias</span></div>
        <div class="list">
            <?php foreach ($activeClients as $client): ?>
                <div class="list-item">
                    <strong><?= html_escape($client['client_name']) ?></strong>
                    <div class="muted">Categoria detectada: <?= html_escape($client['category'] ?: 'General') ?></div>
                    <div class="metrics-inline">
                        <span class="pill"><?= (int) $client['events_count'] ?> eventos</span>
                        <span class="pill"><?= (int) $client['cart_count'] ?> carritos</span>
                    </div>
                    <div class="muted"><?= html_escape($client['last_event_at']) ?></div>
                </div>
            <?php endforeach; ?>
            <?php if (!$activeClients): ?>
                <div class="list-item"><div class="muted">Aun no hay actividad suficiente para este vendedor.</div></div>
            <?php endif; ?>
        </div>
    </section>

    <section class="card">
        <div class="toolbar"><strong>Contactos prioritarios</strong><span class="pill">seguimiento</span></div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Cliente</th><th>Interes</th><th>Vistas</th><th>Carritos</th><th>Accion</th></tr></thead>
                <tbody>
                <?php foreach ($priorityContacts as $contact): ?>
                    <tr>
                        <td><strong><?= html_escape($contact['client_name']) ?></strong><div class="muted"><?= html_escape($contact['last_event_at']) ?></div></td>
                        <td><?= html_escape($contact['category'] ?: 'General') ?><div class="muted"><?= html_escape($contact['item_code'] ?: 'sin item') ?></div></td>
                        <td><?= (int) $contact['views_count'] ?></td>
                        <td><?= (int) $contact['cart_count'] ?></td>
                        <td><?= (int) $contact['cart_count'] > 0 ? 'Dar seguimiento al carrito.' : 'Enviar recomendacion de la categoria.' ?></td>
                    </tr>
                <?php endforeach; ?>
                <?php if (!$priorityContacts): ?>
                    <tr><td colspan="5" class="muted">Todavia no hay contactos prioritarios para este vendedor.</td></tr>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</div>

<div class="split" style="margin-top:18px;">
    <section class="card">
        <div class="toolbar"><strong>Productos sugeridos</strong><span class="pill">venta cruzada</span></div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Producto</th><th>Categoria</th><th>Vistas</th><th>Carritos</th><th>Clientes</th></tr></thead>
                <tbody>
                <?php foreach ($suggestedProducts as $product): ?>
                    <tr>
                        <td><strong><?= html_escape($product['item_code']) ?></strong><div class="muted"><?= html_escape($product['item_name']) ?></div></td>
                        <td><?= html_escape($product['category'] ?: 'General') ?></td>
                        <td><?= (int) $product['views_count'] ?></td>
                        <td><?= (int) $product['cart_count'] ?></td>
                        <td><?= (int) $product['interested_clients'] ?></td>
                    </tr>
                <?php endforeach; ?>
                <?php if (!$suggestedProducts): ?>
                    <tr><td colspan="5" class="muted">Todavia no hay productos con senales suficientes.</td></tr>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>

    <section class="card">
        <div class="toolbar"><strong>Mensaje comercial sugerido</strong><span class="pill">uso manual</span></div>
        <div class="list">
            <?php foreach ($suggestedMessages as $message): ?>
                <div class="list-item">
                    <strong><?= html_escape($message['client_name']) ?></strong>
                    <div class="muted"><?= html_escape($message['message']) ?></div>
                    <div class="muted" style="margin-top:8px;"><?= html_escape($message['last_event_at']) ?></div>
                </div>
            <?php endforeach; ?>
            <?php if (!$suggestedMessages): ?>
                <div class="list-item"><div class="muted">Cuando existan contactos con interes reciente, aqui veras mensajes listos para seguimiento.</div></div>
            <?php endif; ?>
        </div>
    </section>
</div>
<?php endif; ?>
<section class="card" style="margin-top:18px;">
    <div class="toolbar"><strong>Pedidos recientes</strong><span class="pill">ultimos <?= $activityWindow ?> dias</span></div>
    <div class="list">
        <?php foreach ($recentOrders as $order): ?>
            <div class="list-item">
                <strong><?= html_escape($order['order_number']) ?></strong>
                <div class="muted"><?= html_escape($order['company_name']) ?></div>
                <div class="metrics-inline">
                    <span class="pill"><?= html_escape(number_format((float) $order['total'], 2)) ?></span>
                    <span class="pill"><?= html_escape($order['status']) ?></span>
                </div>
            </div>
        <?php endforeach; ?>
        <?php if (!$recentOrders): ?>
            <div class="list-item"><div class="muted">Todavia no hay pedidos recientes para este vendedor.</div></div>
        <?php endif; ?>
    </div>
</section>
<?php vendor_footer(); ?>
