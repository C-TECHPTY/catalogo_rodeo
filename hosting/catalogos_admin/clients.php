<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login(['admin', 'sales']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    $action = (string) ($_POST['action'] ?? 'create');

    if ($action === 'sync_from_orders') {
        $result = admin_sync_clients_from_orders();
        flash_set('success', 'Sincronizacion completada. Clientes creados: ' . $result['created'] . '. Pedidos enlazados: ' . $result['linked'] . '.');
        header('Location: clients.php');
        exit;
    }

    if ($action === 'toggle_active') {
        $clientId = (int) ($_POST['client_id'] ?? 0);
        $isActive = (int) ($_POST['is_active'] ?? 0) === 1 ? 1 : 0;
        if ($clientId <= 0) {
            flash_set('error', 'Cliente invalido.');
            header('Location: clients.php');
            exit;
        }

        $sets = ['is_active = :is_active'];
        if (admin_column_exists('clients', 'updated_at')) {
            $sets[] = 'updated_at = NOW()';
        }
        db()->prepare('UPDATE clients SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute([
            'id' => $clientId,
            'is_active' => $isActive,
        ]);
        audit_log($isActive === 1 ? 'client.reactivated' : 'client.deactivated', 'clients', $clientId);
        flash_set('success', $isActive === 1 ? 'Cliente reactivado.' : 'Cliente desactivado. Sus pedidos se mantienen intactos.');
        header('Location: clients.php?id=' . $clientId);
        exit;
    }

    db()->prepare(
        'INSERT INTO clients (code, business_name, contact_name, email, phone, address_line, zone, city, country, seller_id, notes, is_active)
         VALUES (:code, :business_name, :contact_name, :email, :phone, :address_line, :zone, :city, :country, :seller_id, :notes, :is_active)'
    )->execute([
        'code' => trim((string) $_POST['code']),
        'business_name' => trim((string) $_POST['business_name']),
        'contact_name' => trim((string) $_POST['contact_name']),
        'email' => trim((string) $_POST['email']),
        'phone' => trim((string) $_POST['phone']),
        'address_line' => trim((string) $_POST['address_line']),
        'zone' => trim((string) $_POST['zone']),
        'city' => trim((string) $_POST['city']),
        'country' => trim((string) $_POST['country']),
        'seller_id' => (int) ($_POST['seller_id'] ?? 0) ?: null,
        'notes' => trim((string) $_POST['notes']),
        'is_active' => isset($_POST['is_active']) ? 1 : 0,
    ]);
    audit_log('client.created', 'clients', (int) db()->lastInsertId());
    flash_set('success', 'Cliente creado.');
    header('Location: clients.php');
    exit;
}

$statusFilter = (string) ($_GET['status'] ?? 'all');
if (!in_array($statusFilter, ['active', 'inactive', 'all'], true)) {
    $statusFilter = 'all';
}
$detailClientId = (int) ($_GET['id'] ?? 0);

$sellers = db()->query('SELECT id, name FROM sellers WHERE is_active = 1 ORDER BY name ASC')->fetchAll();
$ordersCountExpr = admin_table_exists('orders') && admin_column_exists('orders', 'client_id')
    ? '(SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id) AS orders_count'
    : '0 AS orders_count';
$clientWhere = '';
if ($statusFilter === 'active') {
    $clientWhere = 'WHERE c.is_active = 1';
} elseif ($statusFilter === 'inactive') {
    $clientWhere = 'WHERE c.is_active = 0';
}
$clients = db()->query(
    "SELECT c.*, s.name AS seller_name, {$ordersCountExpr}
     FROM clients c
     LEFT JOIN sellers s ON s.id = c.seller_id
     {$clientWhere}
     ORDER BY c.business_name ASC"
)->fetchAll();
$detailClient = $detailClientId > 0 ? admin_fetch_client_detail($detailClientId) : null;
$detailOrders = $detailClient ? admin_fetch_client_orders($detailClientId) : [];
$detailMetrics = $detailClient ? admin_fetch_client_metrics($detailClientId) : ['orders_count' => 0, 'orders_total' => 0, 'last_order_at' => ''];

admin_header('Clientes', 'clients.php');
?>
<div class="split">
    <section class="card">
        <div class="toolbar"><strong>Nuevo cliente</strong></div>
        <form class="form-grid" method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create">
            <label><span>Codigo</span><input type="text" name="code" required></label>
            <label><span>Nombre comercial</span><input type="text" name="business_name" required></label>
            <label><span>Contacto</span><input type="text" name="contact_name"></label>
            <label><span>Correo</span><input type="email" name="email"></label>
            <label><span>Telefono</span><input type="text" name="phone"></label>
            <label><span>Vendedor asignado</span><select name="seller_id"><option value="">Sin asignar</option><?php foreach ($sellers as $seller): ?><option value="<?= (int) $seller['id'] ?>"><?= html_escape($seller['name']) ?></option><?php endforeach; ?></select></label>
            <label class="wide"><span>Direccion</span><input type="text" name="address_line"></label>
            <label><span>Zona</span><input type="text" name="zone"></label>
            <label><span>Ciudad</span><input type="text" name="city"></label>
            <label><span>Pais</span><input type="text" name="country"></label>
            <label><span>Activo</span><input type="checkbox" name="is_active" checked style="min-height:auto;width:auto;"></label>
            <label class="wide"><span>Notas</span><textarea name="notes"></textarea></label>
            <div class="wide"><button class="button--primary" type="submit">Crear cliente</button></div>
        </form>
    </section>
    <section class="card">
        <div class="toolbar">
            <strong>Clientes registrados</strong>
            <span class="pill"><?= count($clients) ?> clientes</span>
            <form method="post" style="display:inline-flex;margin-left:auto;">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="sync_from_orders">
                <button class="button" type="submit">Sincronizar desde pedidos</button>
            </form>
        </div>
        <div class="metrics-inline" style="margin-bottom:14px;">
            <a class="pill" href="clients.php?status=all">Todos</a>
            <a class="pill" href="clients.php?status=active">Activos</a>
            <a class="pill" href="clients.php?status=inactive">Inactivos / pruebas</a>
        </div>
        <div class="list">
            <?php foreach ($clients as $client): ?>
                <div class="list-item">
                    <div class="toolbar">
                        <div>
                            <strong><?= html_escape($client['business_name']) ?></strong>
                            <div class="muted"><?= html_escape($client['contact_name']) ?> - <?= html_escape($client['phone']) ?></div>
                        </div>
                        <?= admin_status_badge((int) $client['is_active'] === 1 ? 'active' : 'inactive') ?>
                    </div>
                    <div class="metrics-inline">
                        <span class="pill"><?= html_escape($client['seller_name'] ?: 'Sin vendedor') ?></span>
                        <span class="pill"><?= (int) $client['orders_count'] ?> pedidos</span>
                        <span class="pill"><?= html_escape($client['zone']) ?></span>
                        <a class="button" href="clients.php?id=<?= (int) $client['id'] ?>&status=<?= html_escape($statusFilter) ?>">Ver detalle</a>
                        <?php if (admin_table_exists('orders') && admin_column_exists('orders', 'client_id')): ?>
                            <a class="button" href="pedidos.php?client_id=<?= (int) $client['id'] ?>">Ver pedidos</a>
                        <?php endif; ?>
                        <form method="post" style="display:inline-flex;">
                            <?= csrf_field() ?>
                            <input type="hidden" name="action" value="toggle_active">
                            <input type="hidden" name="client_id" value="<?= (int) $client['id'] ?>">
                            <input type="hidden" name="is_active" value="<?= (int) $client['is_active'] === 1 ? 0 : 1 ?>">
                            <button class="<?= (int) $client['is_active'] === 1 ? 'button--danger' : 'button--success' ?>" type="submit">
                                <?= (int) $client['is_active'] === 1 ? 'Desactivar' : 'Reactivar' ?>
                            </button>
                        </form>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>
</div>
<?php if ($detailClient): ?>
    <section class="card" style="margin-top:18px;">
        <div class="toolbar">
            <div>
                <strong>Detalle del cliente</strong>
                <div class="muted"><?= html_escape($detailClient['business_name']) ?></div>
            </div>
            <?= admin_status_badge((int) $detailClient['is_active'] === 1 ? 'active' : 'inactive') ?>
        </div>
        <div class="grid grid--cards" style="margin-top:14px;">
            <div class="metric"><span>Contacto</span><strong><?= html_escape($detailClient['contact_name'] ?: 'No indicado') ?></strong></div>
            <div class="metric"><span>Correo</span><strong><?= html_escape($detailClient['email'] ?: 'No indicado') ?></strong></div>
            <div class="metric"><span>Telefono</span><strong><?= html_escape($detailClient['phone'] ?: 'No indicado') ?></strong></div>
            <div class="metric"><span>Vendedor</span><strong><?= html_escape($detailClient['seller_name'] ?: 'Sin vendedor') ?></strong></div>
        </div>
        <div class="grid grid--cards" style="margin-top:14px;">
            <div class="metric"><span>Pedidos</span><strong><?= (int) $detailMetrics['orders_count'] ?></strong></div>
            <div class="metric"><span>Total comprado</span><strong>US$ <?= number_format((float) $detailMetrics['orders_total'], 2, '.', ',') ?></strong></div>
            <div class="metric"><span>Ultimo pedido</span><strong><?= html_escape((string) ($detailMetrics['last_order_at'] ?: 'Sin pedidos')) ?></strong></div>
            <div class="metric"><span>Codigo</span><strong><?= html_escape($detailClient['code']) ?></strong></div>
        </div>
        <div class="form-grid" style="margin-top:14px;">
            <div><strong>Direccion</strong><div class="muted"><?= html_escape($detailClient['address_line'] ?: 'No indicada') ?></div></div>
            <div><strong>Zona</strong><div class="muted"><?= html_escape($detailClient['zone'] ?: 'No indicada') ?></div></div>
            <div><strong>Ciudad</strong><div class="muted"><?= html_escape($detailClient['city'] ?: 'No indicada') ?></div></div>
            <div><strong>Pais</strong><div class="muted"><?= html_escape($detailClient['country'] ?: 'No indicado') ?></div></div>
            <div class="wide"><strong>Notas</strong><div class="muted"><?= nl2br(html_escape($detailClient['notes'] ?: 'Sin notas')) ?></div></div>
        </div>
        <div class="toolbar" style="margin-top:18px;">
            <strong>Ultimos pedidos del cliente</strong>
            <a class="button" href="pedidos.php?client_id=<?= (int) $detailClient['id'] ?>">Ver todos los pedidos</a>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th>Total</th><th></th></tr></thead>
                <tbody>
                    <?php if (!$detailOrders): ?>
                        <tr><td colspan="5" class="empty-table">Este cliente aun no tiene pedidos enlazados.</td></tr>
                    <?php endif; ?>
                    <?php foreach ($detailOrders as $order): ?>
                        <tr>
                            <td><strong><?= html_escape($order['order_number']) ?></strong></td>
                            <td><?= html_escape($order['created_at']) ?></td>
                            <td><?= admin_status_badge((string) $order['status']) ?></td>
                            <td>US$ <?= number_format((float) $order['total'], 2, '.', ',') ?></td>
                            <td><a class="button" href="pedidos.php?id=<?= (int) $order['id'] ?>">Abrir</a></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </section>
<?php endif; ?>
<?php
admin_footer();

function admin_fetch_client_detail(int $clientId): ?array
{
    $stmt = db()->prepare(
        'SELECT c.*, s.name AS seller_name
         FROM clients c
         LEFT JOIN sellers s ON s.id = c.seller_id
         WHERE c.id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $clientId]);
    $client = $stmt->fetch();
    return is_array($client) ? $client : null;
}

function admin_fetch_client_metrics(int $clientId): array
{
    if (!admin_table_exists('orders') || !admin_column_exists('orders', 'client_id')) {
        return ['orders_count' => 0, 'orders_total' => 0, 'last_order_at' => ''];
    }

    $totalExpr = admin_column_exists('orders', 'total') ? 'COALESCE(SUM(total), 0)' : '0';
    $lastExpr = admin_column_exists('orders', 'created_at') ? 'MAX(created_at)' : "''";
    $stmt = db()->prepare(
        "SELECT COUNT(*) AS orders_count, {$totalExpr} AS orders_total, {$lastExpr} AS last_order_at
         FROM orders
         WHERE client_id = :client_id"
    );
    $stmt->execute(['client_id' => $clientId]);
    $row = $stmt->fetch() ?: [];
    return [
        'orders_count' => (int) ($row['orders_count'] ?? 0),
        'orders_total' => (float) ($row['orders_total'] ?? 0),
        'last_order_at' => (string) ($row['last_order_at'] ?? ''),
    ];
}

function admin_fetch_client_orders(int $clientId): array
{
    if (!admin_table_exists('orders') || !admin_column_exists('orders', 'client_id')) {
        return [];
    }

    $orderNumberExpr = admin_column_exists('orders', 'order_number') ? 'order_number' : "CONCAT('PED-', id)";
    $createdExpr = admin_column_exists('orders', 'created_at') ? 'created_at' : "''";
    $statusExpr = admin_column_exists('orders', 'status') ? 'status' : "'new'";
    $totalExpr = admin_column_exists('orders', 'total') ? 'total' : '0';
    $orderBy = admin_column_exists('orders', 'created_at') ? 'created_at DESC, id DESC' : 'id DESC';
    $stmt = db()->prepare(
        "SELECT id, {$orderNumberExpr} AS order_number, {$createdExpr} AS created_at,
                {$statusExpr} AS status, {$totalExpr} AS total
         FROM orders
         WHERE client_id = :client_id
         ORDER BY {$orderBy}
         LIMIT 12"
    );
    $stmt->execute(['client_id' => $clientId]);
    return $stmt->fetchAll();
}

function admin_sync_clients_from_orders(): array
{
    if (!admin_table_exists('clients') || !admin_table_exists('orders') || !admin_column_exists('orders', 'client_id')) {
        return ['created' => 0, 'linked' => 0];
    }

    $orderColumns = [];
    foreach (['id', 'company_name', 'customer_name', 'contact_name', 'customer_email', 'contact_email', 'customer_phone', 'contact_phone', 'address_zone', 'seller_id', 'seller_name'] as $column) {
        $orderColumns[$column] = admin_column_exists('orders', $column);
    }
    $companyExpr = $orderColumns['company_name'] ? 'company_name' : ($orderColumns['customer_name'] ? 'customer_name' : "''");
    $contactExpr = $orderColumns['contact_name'] ? 'contact_name' : ($orderColumns['customer_name'] ? 'customer_name' : "''");
    $emailExpr = $orderColumns['contact_email'] ? 'contact_email' : ($orderColumns['customer_email'] ? 'customer_email' : "''");
    $phoneExpr = $orderColumns['contact_phone'] ? 'contact_phone' : ($orderColumns['customer_phone'] ? 'customer_phone' : "''");
    $zoneExpr = $orderColumns['address_zone'] ? 'address_zone' : "''";
    $sellerExpr = $orderColumns['seller_id'] ? 'seller_id' : 'NULL';
    $sellerNameExpr = $orderColumns['seller_name'] ? 'seller_name' : "''";

    $orders = db()->query(
        "SELECT id, {$companyExpr} AS company_name, {$contactExpr} AS contact_name,
                {$emailExpr} AS email, {$phoneExpr} AS phone, {$zoneExpr} AS zone,
                {$sellerExpr} AS seller_id, {$sellerNameExpr} AS seller_name
         FROM orders
         WHERE client_id IS NULL OR client_id = 0
         ORDER BY id ASC
         LIMIT 1000"
    )->fetchAll();

    $created = 0;
    $linked = 0;
    foreach ($orders as $order) {
        $clientId = admin_find_or_create_client_from_order($order);
        if ($clientId <= 0) {
            continue;
        }
        db()->prepare('UPDATE orders SET client_id = :client_id WHERE id = :id')->execute([
            'client_id' => $clientId,
            'id' => (int) $order['id'],
        ]);
        $linked++;
        if (!empty($order['_client_created'])) {
            $created++;
        }
    }

    return ['created' => $created, 'linked' => $linked];
}

function admin_find_or_create_client_from_order(array &$order): int
{
    $email = filter_var((string) ($order['email'] ?? ''), FILTER_VALIDATE_EMAIL) ? strtolower(trim((string) $order['email'])) : '';
    if ($email !== '' && admin_column_exists('clients', 'email')) {
        $stmt = db()->prepare('SELECT id FROM clients WHERE LOWER(email) = :email ORDER BY id DESC LIMIT 1');
        $stmt->execute(['email' => $email]);
        $id = (int) $stmt->fetchColumn();
        if ($id > 0) {
            admin_update_client_from_order($id, $order);
            return $id;
        }
    }

    $phone = trim((string) ($order['phone'] ?? ''));
    if ($phone !== '' && admin_column_exists('clients', 'phone')) {
        $stmt = db()->prepare('SELECT id FROM clients WHERE phone = :phone ORDER BY id DESC LIMIT 1');
        $stmt->execute(['phone' => $phone]);
        $id = (int) $stmt->fetchColumn();
        if ($id > 0) {
            admin_update_client_from_order($id, $order);
            return $id;
        }
    }

    $businessName = trim((string) ($order['company_name'] ?? ''));
    $contactName = trim((string) ($order['contact_name'] ?? ''));
    if ($businessName === '' && $contactName === '') {
        return 0;
    }

    $data = [
        'code' => admin_generate_client_code(),
        'business_name' => $businessName !== '' ? $businessName : $contactName,
        'contact_name' => $contactName,
        'email' => $email,
        'phone' => $phone,
        'zone' => trim((string) ($order['zone'] ?? '')),
        'seller_id' => !empty($order['seller_id']) ? (int) $order['seller_id'] : null,
        'notes' => 'Creado automaticamente desde pedido #' . (int) $order['id'],
        'is_active' => 1,
    ];

    $columns = [];
    $params = [];
    foreach ($data as $column => $value) {
        if (admin_column_exists('clients', $column)) {
            $columns[] = $column;
            $params[$column] = $value;
        }
    }
    if (!in_array('business_name', $columns, true)) {
        return 0;
    }

    db()->prepare(
        'INSERT INTO clients (`' . implode('`, `', $columns) . '`) VALUES (:' . implode(', :', $columns) . ')'
    )->execute($params);
    $order['_client_created'] = true;
    return (int) db()->lastInsertId();
}

function admin_update_client_from_order(int $clientId, array $order): void
{
    $values = [
        'contact_name' => trim((string) ($order['contact_name'] ?? '')),
        'email' => filter_var((string) ($order['email'] ?? ''), FILTER_VALIDATE_EMAIL) ? strtolower(trim((string) $order['email'])) : '',
        'phone' => trim((string) ($order['phone'] ?? '')),
        'zone' => trim((string) ($order['zone'] ?? '')),
        'seller_id' => !empty($order['seller_id']) ? (int) $order['seller_id'] : null,
    ];
    $sets = [];
    $params = ['id' => $clientId];
    foreach ($values as $column => $value) {
        if (!admin_column_exists('clients', $column) || $value === '' || $value === null) {
            continue;
        }
        $sets[] = "`{$column}` = CASE WHEN `{$column}` IS NULL OR `{$column}` = '' THEN :{$column} ELSE `{$column}` END";
        $params[$column] = $value;
    }
    if (admin_column_exists('clients', 'updated_at')) {
        $sets[] = 'updated_at = NOW()';
    }
    if (!$sets) {
        return;
    }
    db()->prepare('UPDATE clients SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
}

function admin_generate_client_code(): string
{
    for ($i = 0; $i < 8; $i++) {
        $code = 'CLI-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $stmt = db()->prepare('SELECT COUNT(*) FROM clients WHERE code = :code');
        $stmt->execute(['code' => $code]);
        if ((int) $stmt->fetchColumn() === 0) {
            return $code;
        }
    }
    return 'CLI-' . date('YmdHis') . '-' . random_int(100, 999);
}
