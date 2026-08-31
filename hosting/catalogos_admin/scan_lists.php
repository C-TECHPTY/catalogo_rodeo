<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_once dirname(__DIR__) . '/catalogos_api/auto_catalog_helpers.php';

admin_require_login(['admin', 'sales', 'operator']);

$tablesReady = scan_lists_tables_ready();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_abort();
    $action = (string) ($_POST['action'] ?? '');
    try {
        if (!$tablesReady) {
            throw new RuntimeException('Falta importar la migracion de Listas sala.');
        }
        if ($action === 'create_list') {
            $name = trim((string) ($_POST['name'] ?? ''));
            $catalogId = (int) ($_POST['base_catalog_id'] ?? 0);
            if ($name === '' || $catalogId <= 0) {
                throw new RuntimeException('Completa nombre y catalogo base.');
            }
            db()->prepare(
                'INSERT INTO catalog_scan_lists (name, base_catalog_id, category_label, notes, created_by_user_id)
                 VALUES (:name, :base_catalog_id, :category_label, :notes, :created_by_user_id)'
            )->execute([
                'name' => $name,
                'base_catalog_id' => $catalogId,
                'category_label' => scan_lists_clean_text((string) ($_POST['category_label'] ?? '')),
                'notes' => scan_lists_clean_text((string) ($_POST['notes'] ?? '')),
                'created_by_user_id' => current_user()['id'] ?? null,
            ]);
            flash_set('success', 'Lista creada.');
        } elseif ($action === 'add_item') {
            $list = scan_lists_fetch_list((int) ($_POST['list_id'] ?? 0));
            if (!$list) throw new RuntimeException('Lista no encontrada.');
            $scanValue = scan_lists_clean_code((string) ($_POST['scan_value'] ?? ''));
            $manualItem = scan_lists_clean_item((string) ($_POST['manual_item'] ?? ''));
            if ($scanValue === '' && $manualItem === '') {
                throw new RuntimeException('Escanea un codigo o escribe un ITEM.');
            }
            $result = scan_lists_resolve_item($list, $scanValue, $manualItem);
            scan_lists_insert_item($list, $result['item_code'], $result['barcode']);
            unset($_SESSION['scan_lists_pending'][(int) $list['id']]);
            flash_set('success', 'Producto agregado: ' . $result['item_code']);
        } elseif ($action === 'bulk_add') {
            $list = scan_lists_fetch_list((int) ($_POST['list_id'] ?? 0));
            if (!$list) throw new RuntimeException('Lista no encontrada.');
            $result = scan_lists_bulk_add($list, (string) ($_POST['bulk_items'] ?? ''));
            flash_set('success', 'Carga masiva: ' . $result['added'] . ' agregados / ' . $result['skipped'] . ' omitidos.');
        } elseif ($action === 'remove_item') {
            db()->prepare(
                'DELETE FROM catalog_scan_list_items
                 WHERE id = :id AND list_id = :list_id'
            )->execute([
                'id' => (int) ($_POST['item_id'] ?? 0),
                'list_id' => (int) ($_POST['list_id'] ?? 0),
            ]);
            flash_set('success', 'Producto removido de la lista.');
        } elseif ($action === 'generate_catalog') {
            $list = scan_lists_fetch_list((int) ($_POST['list_id'] ?? 0));
            if (!$list) throw new RuntimeException('Lista no encontrada.');
            $result = scan_lists_generate_catalog(
                $list,
                (string) ($_POST['order_mode'] ?? 'scan'),
                (string) ($_POST['price_mode'] ?? 'keep')
            );
            flash_set('success', 'Catalogo generado: ' . $result['public_url']);
        } elseif ($action === 'create_generated_link') {
            $list = scan_lists_fetch_list((int) ($_POST['list_id'] ?? 0));
            if (!$list || empty($list['generated_catalog_id'])) {
                throw new RuntimeException('Primero genera un catalogo desde esta lista.');
            }
            $generatedCatalog = scan_lists_fetch_catalog_by_id((int) $list['generated_catalog_id']);
            if (!$generatedCatalog) {
                throw new RuntimeException('No se encontro el catalogo generado. Genera el catalogo nuevamente.');
            }
            $link = create_share_link(
                (int) $generatedCatalog['id'],
                (int) ($_POST['seller_id'] ?? 0) ?: null,
                null,
                trim((string) ($_POST['label'] ?? ('Lista sala: ' . $list['name']))),
                parse_datetime_or_null((string) ($_POST['expires_at'] ?? '')),
                'Link creado desde Lista sala #' . (int) $list['id']
            );
            $url = catalog_share_public_url($link, (string) ($generatedCatalog['public_url'] ?? ''));
            flash_set('success', 'Link seguro creado: ' . ($url !== '' ? $url : substr((string) $link['token'], 0, 12) . '...'));
        } elseif ($action === 'import_barcodes') {
            $list = scan_lists_fetch_list((int) ($_POST['list_id'] ?? 0));
            if (!$list) throw new RuntimeException('Lista no encontrada.');
            $result = scan_lists_import_barcodes($list);
            flash_set('success', 'Barcodes importados: ' . $result['created'] . ' nuevos / ' . $result['updated'] . ' actualizados / ' . $result['skipped'] . ' omitidos.');
        } elseif ($action === 'clear_list') {
            $listId = (int) ($_POST['list_id'] ?? 0);
            db()->prepare('DELETE FROM catalog_scan_list_items WHERE list_id = :list_id')->execute(['list_id' => $listId]);
            db()->prepare('UPDATE catalog_scan_lists SET updated_at = NOW() WHERE id = :id')->execute(['id' => $listId]);
            flash_set('success', 'Lista limpiada.');
        } elseif ($action === 'archive_list') {
            db()->prepare("UPDATE catalog_scan_lists SET status = 'archived', updated_at = NOW() WHERE id = :id")
                ->execute(['id' => (int) ($_POST['list_id'] ?? 0)]);
            flash_set('success', 'Lista archivada.');
        }
    } catch (Throwable $exception) {
        if ($action === 'add_item') {
            $pendingListId = (int) ($_POST['list_id'] ?? 0);
            $pendingScanValue = scan_lists_clean_code((string) ($_POST['scan_value'] ?? ''));
            if ($pendingListId > 0 && $pendingScanValue !== '') {
                $_SESSION['scan_lists_pending'][$pendingListId] = [
                    'scan_value' => $pendingScanValue,
                    'manual_item' => scan_lists_clean_item((string) ($_POST['manual_item'] ?? '')),
                ];
            }
        }
        flash_set('error', $exception->getMessage());
    }
    $redirectList = (int) ($_POST['list_id'] ?? 0);
    header('Location: scan_lists.php' . ($redirectList > 0 ? '?list_id=' . $redirectList : ''));
    exit;
}

$catalogs = scan_lists_catalogs();
$lists = $tablesReady ? scan_lists_recent_lists() : [];
$sellers = $tablesReady && admin_table_exists('sellers') ? db()->query("SELECT id, name FROM sellers WHERE is_active = 1 ORDER BY name ASC")->fetchAll() : [];
$selectedListId = (int) ($_GET['list_id'] ?? ($lists[0]['id'] ?? 0));
$selectedList = $tablesReady && $selectedListId > 0 ? scan_lists_fetch_list($selectedListId) : null;
$items = $selectedList ? scan_lists_items($selectedList) : [];
$families = $items ? scan_lists_family_counts($items) : [];
$audit = $items ? scan_lists_audit_items($items) : ['missing_images' => [], 'unavailable' => []];
$pendingScan = $selectedList ? ($_SESSION['scan_lists_pending'][(int) $selectedList['id']] ?? []) : [];

if ($tablesReady && $selectedList && (string) ($_GET['export'] ?? '') === 'csv') {
    scan_lists_export_csv($selectedList, $items);
    exit;
}

admin_header('Listas sala', 'scan_lists.php');
?>
<?php if (!$tablesReady): ?>
    <section class="card">
        <strong>Falta importar SQL.</strong>
        <p class="muted">Importa <code>hosting/sql/20260604_catalog_scan_lists_phase1.sql</code>. No modifica tablas existentes.</p>
    </section>
    <?php admin_footer(); exit; ?>
<?php endif; ?>

<div class="scan-layout">
    <section class="card">
        <div class="toolbar"><strong>Nueva lista de sala</strong></div>
        <p class="muted">Crea una lista para baño, vasos, cortinas, decoracion o cualquier seleccion que quieras levantar desde sala.</p>
        <form class="form-grid" method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create_list">
            <label class="wide"><span>Nombre</span><input name="name" placeholder="Sala - Bano semana 23" required></label>
            <label class="wide"><span>Catalogo base</span><select name="base_catalog_id" required>
                <option value="">Seleccionar</option>
                <?php foreach ($catalogs as $catalog): ?>
                    <option value="<?= (int) $catalog['id'] ?>"><?= html_escape($catalog['title'] . ' / ' . $catalog['slug']) ?></option>
                <?php endforeach; ?>
            </select></label>
            <label><span>Familia</span><input name="category_label" placeholder="Bano, Vasos, Cortinas"></label>
            <label><span>Notas</span><input name="notes" placeholder="Recorrido sala de venta"></label>
            <div class="wide"><button class="button--primary" type="submit">Crear lista</button></div>
        </form>
    </section>

    <section class="card">
        <div class="toolbar"><strong>Listas recientes</strong><span class="pill"><?= count($lists) ?> listas</span></div>
        <div class="list">
            <?php foreach ($lists as $list): ?>
                <a class="list-item" href="scan_lists.php?list_id=<?= (int) $list['id'] ?>">
                    <strong><?= html_escape($list['name']) ?></strong>
                    <div class="muted"><?= html_escape($list['catalog_title'] ?? '') ?> · <?= (int) $list['items_count'] ?> productos · <?= html_escape(admin_state_label((string) $list['status'])) ?></div>
                </a>
            <?php endforeach; ?>
        </div>
    </section>
</div>

<?php if ($selectedList): ?>
    <section class="card">
        <div class="toolbar">
            <div>
                <strong><?= html_escape($selectedList['name']) ?></strong>
                <div class="muted"><?= html_escape($selectedList['catalog_title'] ?? '') ?> · <?= html_escape($selectedList['category_label'] ?? 'Sin familia') ?></div>
            </div>
            <span class="pill"><?= count($items) ?> productos</span>
        </div>

        <div class="scan-workspace">
            <div class="scan-panel">
                <strong>Escanear o agregar ITEM</strong>
                <p class="muted">Si el codigo de barra aun no existe en la base, escribe el ITEM una vez para asociarlo.</p>
                <form class="form-grid" method="post" id="scanListForm">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="add_item">
                    <input type="hidden" name="list_id" value="<?= (int) $selectedList['id'] ?>">
                    <label class="wide"><span>Codigo de barra o ITEM</span><input name="scan_value" id="scanValue" autofocus autocomplete="off" placeholder="Escanea o pega 7450127069174" value="<?= html_escape((string) ($pendingScan['scan_value'] ?? '')) ?>"></label>
                    <label class="wide"><span>ITEM si no encuentra el codigo</span><input name="manual_item" id="manualItem" placeholder="Ejemplo DC-0010" value="<?= html_escape((string) ($pendingScan['manual_item'] ?? '')) ?>"></label>
                    <div class="wide scan-actions">
                        <button class="button--primary" type="submit">Agregar a lista</button>
                        <button type="button" id="startBarcodeScan">Usar camara</button>
                        <button type="button" id="stopBarcodeScan" hidden>Detener camara</button>
                    </div>
                </form>
                <video id="barcodePreview" class="barcode-preview" playsinline muted hidden></video>
                <div id="barcodeScanStatus" class="barcode-scan-status" hidden>
                    <span id="barcodeScanMessage">Lector listo.</span>
                    <strong id="barcodeLastValue"></strong>
                </div>
                <?php if (!empty($pendingScan['scan_value'])): ?>
                    <div class="barcode-scan-status barcode-scan-status--pending">
                        <span>Codigo leido pendiente. Escribe el ITEM una vez y pulsa Agregar a lista.</span>
                        <strong><?= html_escape((string) $pendingScan['scan_value']) ?></strong>
                    </div>
                <?php endif; ?>
                <p class="muted">La camara usa el lector del navegador si esta disponible. Si no, puedes usar un lector Bluetooth/USB o escribir el codigo.</p>
            </div>

            <div class="scan-panel">
                <strong>Generar catalogo</strong>
                <p class="muted">Crea un catalogo nuevo solo con los productos de esta lista. No cambia el catalogo base.</p>
                <form method="post" onsubmit="return confirm('Generar catalogo con esta lista?');">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="generate_catalog">
                    <input type="hidden" name="list_id" value="<?= (int) $selectedList['id'] ?>">
                    <label style="margin-bottom:10px;"><span>Orden del catalogo</span><select name="order_mode">
                        <option value="scan">Orden escaneado</option>
                        <option value="family">Agrupar por familia</option>
                        <option value="category">Agrupar por categoria</option>
                    </select></label>
                    <label style="margin-bottom:10px;"><span>Precio del catalogo</span><select name="price_mode">
                        <option value="keep">Usar precio actual del catalogo</option>
                        <option value="factor_055">Aplicar factor 0.55</option>
                    </select></label>
                    <button class="button--primary" type="submit" <?= count($items) === 0 ? 'disabled' : '' ?>>Generar catalogo de la lista</button>
                </form>
                <?php if (!empty($selectedList['generated_public_url'])): ?>
                    <p><a class="button" href="<?= html_escape($selectedList['generated_public_url']) ?>" target="_blank">Abrir ultimo generado</a></p>
                <?php endif; ?>
                <form method="post" onsubmit="return confirm('Archivar esta lista?');">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="archive_list">
                    <input type="hidden" name="list_id" value="<?= (int) $selectedList['id'] ?>">
                    <button type="submit">Archivar lista</button>
                </form>
            </div>
        </div>

        <div class="scan-workspace" style="margin-top:14px;">
            <div class="scan-panel">
                <strong>Carga masiva</strong>
                <p class="muted">Pega varios ITEM o codigos, uno por linea. Los que no encuentre se omiten y se reportan.</p>
                <form method="post">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="bulk_add">
                    <input type="hidden" name="list_id" value="<?= (int) $selectedList['id'] ?>">
                    <textarea name="bulk_items" rows="5" placeholder="DC-0010&#10;DC-0004&#10;7450127069174"></textarea>
                    <button type="submit" style="margin-top:10px;">Agregar varios</button>
                </form>
            </div>
            <div class="scan-panel">
                <strong>Resumen por familia</strong>
                <div class="scan-family-pills">
                    <?php foreach ($families as $family => $count): ?>
                        <span class="pill"><?= html_escape($family) ?> · <?= (int) $count ?></span>
                    <?php endforeach; ?>
                    <?php if (!$families): ?><span class="muted">Agrega productos para ver el resumen.</span><?php endif; ?>
                </div>
                <div class="scan-family-pills">
                    <span class="pill"><?= count($audit['missing_images']) ?> sin imagen</span>
                    <span class="pill"><?= count($audit['unavailable']) ?> sin disponibilidad</span>
                    <a class="button" href="scan_lists.php?list_id=<?= (int) $selectedList['id'] ?>&export=csv">Exportar CSV</a>
                </div>
            </div>
        </div>

        <div class="scan-workspace" style="margin-top:14px;">
            <div class="scan-panel">
                <strong>Importar barcodes</strong>
                <p class="muted">CSV simple con columnas <code>ITEM</code> y <code>BARCODE</code>. Sirve para no asociar uno por uno.</p>
                <form method="post" enctype="multipart/form-data">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="import_barcodes">
                    <input type="hidden" name="list_id" value="<?= (int) $selectedList['id'] ?>">
                    <input type="file" name="barcode_file" accept=".csv,text/csv" required>
                    <button type="submit" style="margin-top:10px;">Importar CSV</button>
                </form>
                <form method="post" onsubmit="return confirm('Quitar todos los productos de esta lista? No borra productos ni barcodes.');" style="margin-top:10px;">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="clear_list">
                    <input type="hidden" name="list_id" value="<?= (int) $selectedList['id'] ?>">
                    <button type="submit">Limpiar lista</button>
                </form>
            </div>
            <div class="scan-panel">
                <strong>Compartir generado</strong>
                <p class="muted">Despues de generar el catalogo, crea un link seguro para vendedor.</p>
                <?php if (!empty($selectedList['generated_catalog_id'])): ?>
                    <form class="form-grid" method="post">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="create_generated_link">
                        <input type="hidden" name="list_id" value="<?= (int) $selectedList['id'] ?>">
                        <label class="wide"><span>Vendedor</span><select name="seller_id"><option value="">Sin asignar</option><?php foreach ($sellers as $seller): ?><option value="<?= (int) $seller['id'] ?>"><?= html_escape($seller['name']) ?></option><?php endforeach; ?></select></label>
                        <label><span>Etiqueta</span><input name="label" value="<?= html_escape('Lista sala: ' . (string) $selectedList['name']) ?>"></label>
                        <label><span>Expira</span><input type="datetime-local" name="expires_at"></label>
                        <div class="wide"><button type="submit">Crear link seguro</button></div>
                    </form>
                <?php else: ?>
                    <span class="muted">Genera el catalogo para habilitar links.</span>
                <?php endif; ?>
            </div>
        </div>

        <?php if (!empty($audit['missing_images']) || !empty($audit['unavailable'])): ?>
            <div class="notice notice--warning" style="margin-top:18px;">
                Revision: <?= count($audit['missing_images']) ?> productos sin imagen y <?= count($audit['unavailable']) ?> sin disponibilidad detectada. Puedes generar igual, pero conviene revisarlos.
            </div>
        <?php endif; ?>

        <div class="table-wrap" style="margin-top:18px;">
            <table>
                <thead><tr><th>#</th><th>ITEM</th><th>Barcode</th><th>Familia</th><th>Descripcion</th><th>Precio</th><th>Marca</th><th>Categoria</th><th>Disp.</th><th>Acciones</th></tr></thead>
                <tbody>
                <?php foreach ($items as $index => $item): ?>
                    <tr>
                        <td><?= $index + 1 ?></td>
                        <td><strong><?= html_escape($item['item_code']) ?></strong></td>
                        <td><?= html_escape($item['barcode'] ?? '') ?></td>
                        <td><?= html_escape($item['family'] ?? '') ?></td>
                        <td><?= html_escape($item['description'] ?? '') ?></td>
                        <td><?= html_escape($item['price'] ?? '') ?></td>
                        <td><?= html_escape($item['brand'] ?? '') ?></td>
                        <td><?= html_escape($item['category'] ?? '') ?></td>
                        <td><?= html_escape($item['available'] ?? '') ?></td>
                        <td>
                            <form method="post">
                                <?= csrf_field() ?>
                                <input type="hidden" name="action" value="remove_item">
                                <input type="hidden" name="list_id" value="<?= (int) $selectedList['id'] ?>">
                                <input type="hidden" name="item_id" value="<?= (int) $item['id'] ?>">
                                <button type="submit">Quitar</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </section>
<?php endif; ?>

<script>
(() => {
  const startButton = document.getElementById("startBarcodeScan");
  const stopButton = document.getElementById("stopBarcodeScan");
  const input = document.getElementById("scanValue");
  const video = document.getElementById("barcodePreview");
  const status = document.getElementById("barcodeScanStatus");
  const message = document.getElementById("barcodeScanMessage");
  const lastValue = document.getElementById("barcodeLastValue");
  if (!startButton || !stopButton || !input || !video || !status || !message || !lastValue) return;

  let stream = null;
  let detector = null;
  let scanning = false;
  let submitted = false;

  startButton.addEventListener("click", async () => {
    if (!("BarcodeDetector" in window)) {
      alert("Este navegador no tiene lector de codigo de barra integrado. Usa el campo manual o un lector Bluetooth/USB.");
      return;
    }
    try {
      submitted = false;
      setScanStatus("Abriendo camara...");
      detector = detector || await createBarcodeDetector();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream;
      video.hidden = false;
      video.classList.add("is-active");
      stopButton.hidden = false;
      startButton.disabled = true;
      await video.play();
      scanning = true;
      setScanStatus("Escaneando... acerca el codigo de barra al recuadro.");
      scanFrame();
    } catch (error) {
      stopScan();
      alert(error.message || "No se pudo abrir la camara.");
    }
  });

  stopButton.addEventListener("click", () => {
    stopScan();
    setScanStatus("Camara detenida. Puedes intentar de nuevo o escribir el codigo.");
  });

  async function createBarcodeDetector() {
    const preferredFormats = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf"];
    if (typeof BarcodeDetector.getSupportedFormats === "function") {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = preferredFormats.filter((format) => supported.includes(format));
      if (formats.length) return new BarcodeDetector({ formats });
    }
    return new BarcodeDetector();
  }

  async function scanFrame() {
    if (!scanning || submitted || !detector || !video.srcObject) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }
    const codes = await detector.detect(video).catch(() => []);
    if (codes.length && codes[0].rawValue) {
      const code = String(codes[0].rawValue).trim();
      if (!code) {
        requestAnimationFrame(scanFrame);
        return;
      }
      submitted = true;
      input.value = code;
      lastValue.textContent = code;
      setScanStatus("Codigo detectado. Agregando a la lista...", true);
      notifyScan();
      stopScan(false);
      window.setTimeout(() => input.form?.requestSubmit(), 650);
      return;
    }
    requestAnimationFrame(scanFrame);
  }

  function setScanStatus(text, ok = false) {
    status.hidden = false;
    status.classList.toggle("barcode-scan-status--ok", ok);
    message.textContent = text;
  }

  function stopScan(clearLast = true) {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    video.srcObject = null;
    video.hidden = true;
    video.classList.remove("is-active");
    stopButton.hidden = true;
    startButton.disabled = false;
    if (clearLast && !submitted) lastValue.textContent = "";
  }

  function notifyScan() {
    if (navigator.vibrate) navigator.vibrate(120);
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
    } catch (error) {
      // Some mobile browsers block audio even after a tap; vibration/status still confirm the scan.
    }
  }
})();
</script>
<?php admin_footer(); ?>

<?php
function scan_lists_tables_ready(): bool
{
    return admin_table_exists('catalog_scan_lists')
        && admin_table_exists('catalog_scan_list_items')
        && admin_table_exists('catalog_product_barcodes')
        && admin_table_exists('catalogs');
}

function scan_lists_catalogs(): array
{
    return db()->query(
        "SELECT id, title, slug, public_url, catalog_json_path
         FROM catalogs
         WHERE status = 'active' AND catalog_json_path <> ''
         ORDER BY updated_at DESC, id DESC
         LIMIT 300"
    )->fetchAll();
}

function scan_lists_recent_lists(): array
{
    return db()->query(
        'SELECT l.*, c.title AS catalog_title,
                generated.public_url AS generated_public_url,
                (SELECT COUNT(*) FROM catalog_scan_list_items i WHERE i.list_id = l.id) AS items_count
         FROM catalog_scan_lists l
         INNER JOIN catalogs c ON c.id = l.base_catalog_id
         LEFT JOIN catalogs generated ON generated.id = l.generated_catalog_id
         WHERE l.status <> "archived"
         ORDER BY l.updated_at DESC, l.id DESC
         LIMIT 40'
    )->fetchAll();
}

function scan_lists_fetch_list(int $listId): ?array
{
    if ($listId <= 0) return null;
    $stmt = db()->prepare(
        'SELECT l.*, c.title AS catalog_title, c.slug AS catalog_slug, c.public_url, c.catalog_json_path,
                generated.public_url AS generated_public_url
         FROM catalog_scan_lists l
         INNER JOIN catalogs c ON c.id = l.base_catalog_id
         LEFT JOIN catalogs generated ON generated.id = l.generated_catalog_id
         WHERE l.id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $listId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function scan_lists_fetch_catalog_by_id(int $catalogId): ?array
{
    if ($catalogId <= 0 || !admin_table_exists('catalogs')) {
        return null;
    }
    $stmt = db()->prepare('SELECT * FROM catalogs WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $catalogId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function scan_lists_items(array $list): array
{
    $products = scan_lists_product_index($list);
    $stmt = db()->prepare(
        'SELECT *
         FROM catalog_scan_list_items
         WHERE list_id = :list_id
         ORDER BY sort_order ASC, id ASC'
    );
    $stmt->execute(['list_id' => (int) $list['id']]);
    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $product = $products[normalize_product_item_key((string) $row['item_code'])] ?? [];
        $items[] = $row + [
            'description' => (string) ($product['description'] ?? $product['shortDescription'] ?? ''),
            'price' => (string) ($product['price'] ?? $product['originalPrice'] ?? ''),
            'brand' => (string) ($product['brand'] ?? $product['marca'] ?? ''),
            'category' => (string) ($product['category'] ?? $product['categoria'] ?? ''),
            'available' => (string) ($product['available'] ?? $product['disponible'] ?? $product['stock'] ?? ''),
            'family' => scan_lists_product_family($product),
            'product' => $product,
        ];
    }
    return $items;
}

function scan_lists_family_counts(array $items): array
{
    $counts = [];
    foreach ($items as $item) {
        $family = (string) ($item['family'] ?? 'General');
        $counts[$family] = ($counts[$family] ?? 0) + 1;
    }
    ksort($counts, SORT_NATURAL | SORT_FLAG_CASE);
    return $counts;
}

function scan_lists_product_index(array $list): array
{
    $json = catalog_json_data((string) ($list['catalog_json_path'] ?? ''));
    $json = apply_catalog_product_live_edits((int) $list['base_catalog_id'], $json);
    $products = auto_catalog_products_from_json($json);
    $index = [];
    foreach ($products as $product) {
        $item = auto_catalog_product_item_code($product);
        $key = normalize_product_item_key($item);
        if ($key !== '' && !isset($index[$key])) {
            $index[$key] = $product;
        }
    }
    return $index;
}

function scan_lists_resolve_item(array $list, string $scanValue, string $manualItem): array
{
    $products = scan_lists_product_index($list);
    $barcodeIndex = scan_lists_product_barcode_index($products);
    $scanKey = normalize_product_item_key($scanValue);
    $manualKey = normalize_product_item_key($manualItem);

    if ($scanKey !== '' && isset($products[$scanKey])) {
        return ['item_code' => auto_catalog_product_item_code($products[$scanKey]), 'barcode' => preg_match('/^\d{6,}$/', $scanValue) ? $scanValue : ''];
    }

    $barcodeKey = scan_lists_barcode_key($scanValue);
    if ($barcodeKey !== '' && isset($barcodeIndex[$barcodeKey])) {
        return ['item_code' => auto_catalog_product_item_code($barcodeIndex[$barcodeKey]), 'barcode' => $scanValue];
    }

    if ($scanValue !== '') {
        $stmt = db()->prepare(
            'SELECT item_code
             FROM catalog_product_barcodes
             WHERE barcode = :barcode AND (catalog_id = :catalog_id OR catalog_id IS NULL)
             ORDER BY catalog_id DESC
             LIMIT 1'
        );
        $stmt->execute(['barcode' => $scanValue, 'catalog_id' => (int) $list['base_catalog_id']]);
        $mapped = $stmt->fetchColumn();
        $mappedKey = normalize_product_item_key((string) $mapped);
        if ($mappedKey !== '' && isset($products[$mappedKey])) {
            return ['item_code' => auto_catalog_product_item_code($products[$mappedKey]), 'barcode' => $scanValue];
        }
    }

    if ($manualKey !== '' && isset($products[$manualKey])) {
        $itemCode = auto_catalog_product_item_code($products[$manualKey]);
        if ($scanValue !== '' && preg_match('/^\d{6,}$/', $scanValue)) {
            scan_lists_upsert_barcode((int) $list['base_catalog_id'], $itemCode, $scanValue);
        }
        return ['item_code' => $itemCode, 'barcode' => $scanValue];
    }

    throw new RuntimeException('No encontre el producto. Escanea el codigo y escribe el ITEM una vez para asociarlo.');
}

function scan_lists_product_barcode_index(array $products): array
{
    $index = [];
    foreach ($products as $product) {
        if (!is_array($product)) continue;
        foreach (scan_lists_product_barcodes($product) as $barcode) {
            $key = scan_lists_barcode_key($barcode);
            if ($key !== '' && !isset($index[$key])) {
                $index[$key] = $product;
            }
        }
    }
    return $index;
}

function scan_lists_product_barcodes(array $product): array
{
    $values = [
        $product['barcode'] ?? '',
        $product['barCode'] ?? '',
        $product['cbarra'] ?? '',
        $product['cbarras'] ?? '',
        $product['codigo_barra'] ?? '',
        $product['codigoBarras'] ?? '',
    ];
    return array_values(array_filter(array_map('strval', $values), static fn(string $value): bool => trim($value) !== ''));
}

function scan_lists_barcode_key(string $value): string
{
    return preg_replace('/[^A-Z0-9]+/', '', strtoupper(trim($value))) ?? '';
}

function scan_lists_insert_item(array $list, string $itemCode, string $barcode = ''): void
{
    $next = (int) db()->query('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM catalog_scan_list_items WHERE list_id = ' . (int) $list['id'])->fetchColumn();
    db()->prepare(
        'INSERT INTO catalog_scan_list_items (list_id, item_code, barcode, sort_order, created_by_user_id)
         VALUES (:list_id, :item_code, :barcode, :sort_order, :created_by_user_id)
         ON DUPLICATE KEY UPDATE barcode = COALESCE(NULLIF(VALUES(barcode), ""), barcode)'
    )->execute([
        'list_id' => (int) $list['id'],
        'item_code' => $itemCode,
        'barcode' => $barcode,
        'sort_order' => $next,
        'created_by_user_id' => current_user()['id'] ?? null,
    ]);
    db()->prepare('UPDATE catalog_scan_lists SET updated_at = NOW() WHERE id = :id')->execute(['id' => (int) $list['id']]);
}

function scan_lists_bulk_add(array $list, string $raw): array
{
    $lines = preg_split('/\r\n|\r|\n|,|;/', $raw) ?: [];
    $added = $skipped = 0;
    foreach ($lines as $line) {
        $value = trim((string) $line);
        if ($value === '') continue;
        try {
            $result = scan_lists_resolve_item($list, scan_lists_clean_code($value), '');
            scan_lists_insert_item($list, $result['item_code'], $result['barcode']);
            $added++;
        } catch (Throwable) {
            $skipped++;
        }
    }
    return ['added' => $added, 'skipped' => $skipped];
}

function scan_lists_upsert_barcode(int $catalogId, string $itemCode, string $barcode): void
{
    db()->prepare(
        'INSERT INTO catalog_product_barcodes (catalog_id, item_code, barcode, created_by_user_id)
         VALUES (:catalog_id, :item_code, :barcode, :created_by_user_id)
         ON DUPLICATE KEY UPDATE item_code = VALUES(item_code), updated_at = NOW()'
    )->execute([
        'catalog_id' => $catalogId,
        'item_code' => $itemCode,
        'barcode' => $barcode,
        'created_by_user_id' => current_user()['id'] ?? null,
    ]);
}

function scan_lists_generate_catalog(array $list, string $orderMode = 'scan', string $priceMode = 'keep'): array
{
    $priceMode = scan_lists_price_mode($priceMode);
    $items = scan_lists_items($list);
    if (!$items) throw new RuntimeException('La lista no tiene productos.');
    $productsByItem = scan_lists_product_index($list);
    $selected = [];
    foreach ($items as $item) {
        $key = normalize_product_item_key((string) $item['item_code']);
        if (isset($productsByItem[$key])) {
            $selected[] = $productsByItem[$key];
        }
    }
    if (!$selected) throw new RuntimeException('No se encontraron productos validos para generar.');
    $selected = scan_lists_sort_products($selected, $orderMode);
    $selected = scan_lists_apply_price_mode($selected, $priceMode);

    $baseCatalog = fetch_catalog_by_slug((string) $list['catalog_slug']);
    if (!$baseCatalog) throw new RuntimeException('Catalogo base no encontrado.');
    $baseJson = catalog_json_data((string) ($baseCatalog['catalog_json_path'] ?? ''));
    $baseJson = apply_catalog_product_live_edits((int) $baseCatalog['id'], $baseJson);
    $json = auto_catalog_set_products_in_json($baseJson, $selected);
    $json['title'] = (string) $list['name'];
    $json['scanList'] = [
        'enabled' => true,
        'listId' => (int) $list['id'],
        'baseCatalogId' => (int) $baseCatalog['id'],
        'category' => (string) ($list['category_label'] ?? ''),
        'orderMode' => scan_lists_order_mode($orderMode),
        'priceMode' => $priceMode,
        'generatedAt' => date(DATE_ATOM),
    ];
    $slug = auto_catalog_unique_slug('sala-' . slugify((string) $list['name']));
    $json['slug'] = $slug;
    $paths = auto_catalog_publish_json_clone($baseCatalog, $slug, $json);
    $catalogId = auto_catalog_register_catalog($baseCatalog, ['id' => 0, 'name' => (string) $list['name']], $slug, $paths['public_url'], $paths['json_path'], $json);
    db()->prepare(
        "UPDATE catalog_scan_lists
         SET status = 'generated', generated_catalog_id = :catalog_id, updated_at = NOW()
         WHERE id = :id"
    )->execute(['catalog_id' => $catalogId, 'id' => (int) $list['id']]);
    return ['catalog_id' => $catalogId, 'public_url' => $paths['public_url']];
}

function scan_lists_sort_products(array $products, string $orderMode): array
{
    $mode = scan_lists_order_mode($orderMode);
    if ($mode === 'scan') return array_values($products);
    $indexed = [];
    foreach ($products as $index => $product) {
        $indexed[] = ['index' => $index, 'product' => $product];
    }
    usort($indexed, static function (array $a, array $b) use ($mode): int {
        $left = $a['product'];
        $right = $b['product'];
        $primary = $mode === 'category'
            ? scan_lists_compare_text(scan_lists_product_category($left), scan_lists_product_category($right))
            : scan_lists_compare_text(scan_lists_product_family($left), scan_lists_product_family($right));
        if ($primary !== 0) return $primary;
        $secondary = $mode === 'category'
            ? scan_lists_compare_text(scan_lists_product_family($left), scan_lists_product_family($right))
            : scan_lists_compare_text(scan_lists_product_category($left), scan_lists_product_category($right));
        if ($secondary !== 0) return $secondary;
        $description = scan_lists_compare_text((string) ($left['description'] ?? $left['shortDescription'] ?? ''), (string) ($right['description'] ?? $right['shortDescription'] ?? ''));
        if ($description !== 0) return $description;
        return $a['index'] <=> $b['index'];
    });
    return array_values(array_map(static fn(array $row): array => $row['product'], $indexed));
}

function scan_lists_order_mode(string $value): string
{
    return in_array($value, ['scan', 'family', 'category'], true) ? $value : 'scan';
}

function scan_lists_price_mode(string $value): string
{
    return $value === 'factor_055' ? 'factor_055' : 'keep';
}

function scan_lists_apply_price_mode(array $products, string $priceMode): array
{
    if (scan_lists_price_mode($priceMode) !== 'factor_055') {
        return $products;
    }
    foreach ($products as &$product) {
        if (!is_array($product)) continue;
        $rawPrice = (string) (($product['price'] ?? '') ?: ($product['originalPrice'] ?? ''));
        $number = scan_lists_decimal_number($rawPrice);
        if ($number === null) continue;
        $price = scan_lists_format_price($number * 0.55);
        $product['price'] = $price;
        $product['originalPrice'] = $price;
    }
    unset($product);
    return $products;
}

function scan_lists_decimal_number(string $value): ?float
{
    $clean = preg_replace('/[^0-9,.\-]+/', '', trim($value)) ?? '';
    if ($clean === '' || $clean === '-' || $clean === '.' || $clean === ',') {
        return null;
    }
    $lastComma = strrpos($clean, ',');
    $lastDot = strrpos($clean, '.');
    if ($lastComma !== false && $lastDot !== false) {
        $decimalSeparator = $lastComma > $lastDot ? ',' : '.';
        $thousandSeparator = $decimalSeparator === ',' ? '.' : ',';
        $clean = str_replace($thousandSeparator, '', $clean);
        $clean = str_replace($decimalSeparator, '.', $clean);
    } elseif ($lastComma !== false) {
        $clean = str_replace(',', '.', $clean);
    }
    return is_numeric($clean) ? (float) $clean : null;
}

function scan_lists_format_price(float $value): string
{
    return rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.');
}

function scan_lists_compare_text(string $left, string $right): int
{
    return strnatcasecmp($left, $right);
}

function scan_lists_product_category(array $product): string
{
    return (string) (($product['smartCategory'] ?? '') ?: ($product['smart_category'] ?? '') ?: ($product['category'] ?? '') ?: ($product['categoria'] ?? '') ?: 'General');
}

function scan_lists_product_family(array $product): string
{
    $configured = trim((string) (($product['family'] ?? '') ?: ($product['familia'] ?? '') ?: ($product['linea'] ?? '') ?: ($product['grupo'] ?? '')));
    if ($configured !== '') return $configured;
    $text = scan_lists_normalize_text(implode(' ', [
        $product['smartCategory'] ?? '',
        $product['category'] ?? '',
        $product['categoria'] ?? '',
        $product['description'] ?? '',
        $product['shortDescription'] ?? '',
        $product['descripcion'] ?? '',
    ]));
    $families = [
        'Bano' => ['bano', 'banio', 'bath', 'toalla', 'toallas', 'ducha', 'alfombra de bano', 'bath gloves'],
        'Cocina' => ['cocina', 'limpion', 'limpiones', 'toalla para cocina', 'agarrador', 'gabinete', 'sarten', 'olla'],
        'Vasos' => ['vaso', 'vasos', 'termo', 'termico', 'taza'],
        'Cortinas' => ['cortina', 'cortinas', 'shower curtain', 'jacquard', 'blackout'],
        'Cojines' => ['cojin', 'cojines', 'almohadon', 'decorativo'],
        'Sabanas' => ['sabana', 'sabanas', 'juego de cama'],
        'Frazadas' => ['frazada', 'frazadas', 'manta', 'sherpa'],
        'Edredones' => ['edredon', 'edredones', 'comforter', 'duvet'],
        'Individuales' => ['individual', 'individuales', 'placemat'],
        'Peluches' => ['peluche', 'peluches', 'muneco', 'muneca'],
        'Decoracion' => ['decoracion', 'florero', 'adorno', 'figura'],
        'Organizacion' => ['organizador', 'organizacion', 'caja', 'canasta'],
        'Limpieza' => ['basurero', 'limpieza', 'escoba', 'cepillo'],
        'Juguetes' => ['juguete', 'juguetes', 'camion'],
    ];
    foreach ($families as $family => $words) {
        foreach ($words as $word) {
            if (str_contains($text, scan_lists_normalize_text($word))) return $family;
        }
    }
    return scan_lists_product_category($product);
}

function scan_lists_normalize_text(string $value): string
{
    $normalized = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (!is_string($normalized) || $normalized === '') $normalized = $value;
    return strtolower($normalized);
}

function scan_lists_import_barcodes(array $list): array
{
    if (empty($_FILES['barcode_file']) || !is_array($_FILES['barcode_file'])) {
        throw new RuntimeException('Sube un CSV de barcodes.');
    }
    $file = $_FILES['barcode_file'];
    if ((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo recibir el CSV.');
    }
    if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > 5242880) {
        throw new RuntimeException('El CSV debe pesar menos de 5 MB.');
    }
    $rows = scan_lists_parse_csv((string) $file['tmp_name']);
    $products = scan_lists_product_index($list);
    $created = $updated = $skipped = 0;
    foreach ($rows as $row) {
        $item = scan_lists_clean_item((string) ($row['ITEM'] ?? $row['SKU'] ?? ''));
        $barcode = scan_lists_clean_code((string) ($row['BARCODE'] ?? $row['CODIGOBARRA'] ?? $row['CODIGO_BARRA'] ?? ''));
        $key = normalize_product_item_key($item);
        if ($key === '' || $barcode === '' || !isset($products[$key])) {
            $skipped++;
            continue;
        }
        $exists = scan_lists_barcode_exists((int) $list['base_catalog_id'], $barcode);
        scan_lists_upsert_barcode((int) $list['base_catalog_id'], auto_catalog_product_item_code($products[$key]), $barcode);
        $exists ? $updated++ : $created++;
    }
    return ['created' => $created, 'updated' => $updated, 'skipped' => $skipped];
}

function scan_lists_audit_items(array $items): array
{
    $missingImages = [];
    $unavailable = [];
    foreach ($items as $item) {
        $product = is_array($item['product'] ?? null) ? $item['product'] : [];
        if (scan_lists_product_image_url($product) === '') {
            $missingImages[] = $item;
        }
        if (!auto_catalog_product_available($product)) {
            $unavailable[] = $item;
        }
    }
    return ['missing_images' => $missingImages, 'unavailable' => $unavailable];
}

function scan_lists_product_image_url(array $product): string
{
    $media = isset($product['media']) && is_array($product['media']) ? $product['media'] : [];
    foreach ([
        $product['remote_image_url'] ?? '',
        $product['remoteImageUrl'] ?? '',
        $product['image_url'] ?? '',
        $product['imageUrl'] ?? '',
        $media['mainImage'] ?? '',
        $media['main_image'] ?? '',
    ] as $value) {
        $value = trim((string) $value);
        if ($value !== '') return $value;
    }
    return '';
}

function scan_lists_export_csv(array $list, array $items): void
{
    $filename = 'lista-sala-' . slugify((string) ($list['name'] ?? 'productos')) . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'wb');
    if (!$out) return;
    fputcsv($out, ['ITEM', 'BARCODE', 'FAMILIA', 'DESCRIPCION', 'PRECIO', 'MARCA', 'CATEGORIA', 'DISPONIBLE', 'SIN_IMAGEN', 'SIN_DISPONIBILIDAD']);
    foreach ($items as $item) {
        $product = is_array($item['product'] ?? null) ? $item['product'] : [];
        fputcsv($out, [
            (string) ($item['item_code'] ?? ''),
            (string) ($item['barcode'] ?? ''),
            (string) ($item['family'] ?? ''),
            (string) ($item['description'] ?? ''),
            (string) ($item['price'] ?? ''),
            (string) ($item['brand'] ?? ''),
            (string) ($item['category'] ?? ''),
            (string) ($item['available'] ?? ''),
            scan_lists_product_image_url($product) === '' ? 'SI' : 'NO',
            auto_catalog_product_available($product) ? 'NO' : 'SI',
        ]);
    }
    fclose($out);
}

function scan_lists_barcode_exists(int $catalogId, string $barcode): bool
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM catalog_product_barcodes WHERE barcode = :barcode AND catalog_id = :catalog_id');
    $stmt->execute(['barcode' => $barcode, 'catalog_id' => $catalogId]);
    return ((int) $stmt->fetchColumn()) > 0;
}

function scan_lists_parse_csv(string $path): array
{
    $handle = fopen($path, 'rb');
    if (!$handle) throw new RuntimeException('No se pudo abrir el CSV.');
    $first = fgets($handle);
    if ($first === false) {
        fclose($handle);
        throw new RuntimeException('CSV vacio.');
    }
    $delimiter = substr_count($first, ';') > substr_count($first, ',') ? ';' : ',';
    rewind($handle);
    $headers = fgetcsv($handle, 0, $delimiter);
    if (!is_array($headers)) {
        fclose($handle);
        throw new RuntimeException('No se pudo leer encabezado CSV.');
    }
    $headers = array_map('scan_lists_normalize_column', $headers);
    $rows = [];
    while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
        if (!array_filter($data, static fn($value): bool => trim((string) $value) !== '')) continue;
        $row = [];
        foreach ($headers as $index => $header) {
            if ($header === '') continue;
            $row[$header] = trim((string) ($data[$index] ?? ''));
        }
        $rows[] = $row;
    }
    fclose($handle);
    return $rows;
}

function scan_lists_normalize_column(string $value): string
{
    $value = strtoupper(trim(str_replace("\xEF\xBB\xBF", '', $value)));
    $value = strtr($value, ['Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N']);
    return preg_replace('/[^A-Z0-9_]+/', '', $value) ?? '';
}

function scan_lists_clean_text(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', strip_tags($value)) ?? '');
}

function scan_lists_clean_code(string $value): string
{
    $value = scan_lists_expand_scientific_code($value);
    return trim(preg_replace('/[^A-Za-z0-9._\/-]+/', '', $value) ?? '');
}

function scan_lists_expand_scientific_code(string $value): string
{
    $value = trim(scan_lists_clean_text($value));
    if ($value === '') {
        return '';
    }
    $normalized = str_replace(',', '.', $value);
    if (preg_match('/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i', $normalized) === 1) {
        $number = (float) $normalized;
        if (is_finite($number)) {
            return sprintf('%.0F', $number);
        }
    }
    if (preg_match('/^\d+\.0+$/', $normalized) === 1) {
        return preg_replace('/\.0+$/', '', $normalized) ?? $normalized;
    }
    return $value;
}

function scan_lists_clean_item(string $value): string
{
    return trim(preg_replace('/[^A-Za-z0-9._\/-]+/', '', $value) ?? '');
}
