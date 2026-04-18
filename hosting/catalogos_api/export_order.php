<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$orderId = (int) ($_GET['id'] ?? 0);
$format = strtolower(trim((string) ($_GET['format'] ?? 'csv')));
if ($orderId <= 0) {
    json_response([
        'ok' => false,
        'error' => 'Debes indicar un pedido valido.',
    ], 422);
}

$orderStmt = db()->prepare(
    'SELECT o.*, c.slug AS catalog_slug, c.title AS catalog_title, c.catalog_json_path
     FROM orders o
     INNER JOIN catalogs c ON c.id = o.catalog_id
     WHERE o.id = :id
     LIMIT 1'
);
$orderStmt->execute(['id' => $orderId]);
$order = $orderStmt->fetch();

if (!$order) {
    json_response([
        'ok' => false,
        'error' => 'Pedido no encontrado.',
    ], 404);
}

$itemsStmt = db()->prepare('SELECT * FROM order_items WHERE order_id = :order_id ORDER BY id ASC');
$itemsStmt->execute(['order_id' => $orderId]);
$items = $itemsStmt->fetchAll();

$packageMap = load_catalog_package_map((string) ($order['catalog_json_path'] ?? ''));
$rows = [];
$subtotal = 0.0;

foreach ($items as $item) {
    $packageQty = (float) ($packageMap[$item['item_code']]['packageQty'] ?? 1);
    if ($packageQty <= 0) {
        $packageQty = 1;
    }
    $bultos = (float) $item['quantity'];
    $piecesTotal = $bultos * $packageQty;
    $lineTotal = (float) $item['line_total'];
    $subtotal += $lineTotal;
    $rows[] = [
        'item_code' => (string) $item['item_code'],
        'description' => (string) $item['description'],
        'package_qty' => $packageQty,
        'bultos' => $bultos,
        'pieces_total' => $piecesTotal,
        'price' => (float) $item['price'],
        'line_total' => $lineTotal,
    ];
}

if ($format === 'xlsx') {
    output_order_xlsx($order, $rows, $subtotal);
    exit;
}

output_order_csv($order, $rows, $subtotal);
exit;

function output_order_csv(array $order, array $rows, float $subtotal): void
{
    $filename = sprintf('pedido-%s.csv', $order['order_number']);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'wb');
    fputcsv($output, ['Pedido', $order['order_number']]);
    fputcsv($output, ['Catalogo', $order['catalog_title']]);
    fputcsv($output, ['Cliente', $order['customer_name']]);
    fputcsv($output, ['Correo', $order['customer_email']]);
    fputcsv($output, ['Telefono', $order['customer_phone']]);
    fputcsv($output, ['Estado', $order['status']]);
    fputcsv($output, ['Fecha', $order['created_at']]);
    fputcsv($output, ['Total', number_format($subtotal, 2, '.', '')]);
    fputcsv($output, []);
    fputcsv($output, ['ITEM', 'Descripcion', 'Empaque', 'Vultos', 'Piezas Totales', 'Precio Unitario', 'Total Linea']);

    foreach ($rows as $row) {
        fputcsv($output, [
            $row['item_code'],
            $row['description'],
            format_plain_number($row['package_qty']),
            format_plain_number($row['bultos']),
            format_plain_number($row['pieces_total']),
            number_format($row['price'], 2, '.', ''),
            number_format($row['line_total'], 2, '.', ''),
        ]);
    }

    fputcsv($output, []);
    fputcsv($output, ['Subtotal', '', '', '', '', '', number_format($subtotal, 2, '.', '')]);
    fputcsv($output, ['Total General', '', '', '', '', '', number_format($subtotal, 2, '.', '')]);
    fclose($output);
}

function output_order_xlsx(array $order, array $rows, float $subtotal): void
{
    if (!class_exists('ZipArchive')) {
        output_order_csv($order, $rows, $subtotal);
        return;
    }

    $filename = sprintf('pedido-%s.xlsx', $order['order_number']);
    $tempFile = tempnam(sys_get_temp_dir(), 'order_xlsx_');
    if ($tempFile === false) {
        output_order_csv($order, $rows, $subtotal);
        return;
    }
    @unlink($tempFile);
    $xlsxPath = $tempFile . '.xlsx';

    $headerRow = 9;
    $dataStartRow = 10;
    $dataEndRow = $dataStartRow + max(count($rows) - 1, 0);
    $subtotalRow = $dataEndRow + 2;
    $totalRow = $subtotalRow + 1;

    $sheetXml = build_sheet_xml($order, $rows, $subtotal, $headerRow, $dataEndRow, $subtotalRow, $totalRow);
    $stylesXml = build_styles_xml();

    $zip = new ZipArchive();
    if ($zip->open($xlsxPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        output_order_csv($order, $rows, $subtotal);
        return;
    }

    $zip->addFromString('[Content_Types].xml', build_content_types_xml());
    $zip->addFromString('_rels/.rels', build_root_rels_xml());
    $zip->addFromString('xl/workbook.xml', build_workbook_xml());
    $zip->addFromString('xl/_rels/workbook.xml.rels', build_workbook_rels_xml());
    $zip->addFromString('xl/styles.xml', $stylesXml);
    $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
    $zip->close();

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . (string) filesize($xlsxPath));
    readfile($xlsxPath);
    @unlink($xlsxPath);
}

function load_catalog_package_map(string $relativeJsonPath): array
{
    $relativeJsonPath = trim($relativeJsonPath);
    if ($relativeJsonPath === '') {
        return [];
    }

    $baseDir = dirname(__DIR__);
    $fullPath = $baseDir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativeJsonPath);
    if (!is_file($fullPath)) {
        return [];
    }

    $raw = file_get_contents($fullPath);
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || !isset($decoded['catalog']) || !is_array($decoded['catalog'])) {
        return [];
    }

    $map = [];
    foreach ($decoded['catalog'] as $entry) {
        $item = (string) ($entry['item'] ?? '');
        if ($item === '') {
            continue;
        }
        $packageQty = (float) ($entry['packageQty'] ?? $entry['empaque'] ?? $entry['package'] ?? 1);
        if ($packageQty <= 0 && isset($entry['media']) && is_array($entry['media'])) {
            $packageQty = (float) ($entry['media']['packageQty'] ?? $entry['media']['empaque'] ?? $entry['media']['package'] ?? 1);
        }
        if ($packageQty <= 0) {
            $packageQty = 1;
        }
        $map[$item] = [
            'packageQty' => $packageQty,
        ];
    }

    return $map;
}

function build_sheet_xml(array $order, array $rows, float $subtotal, int $headerRow, int $dataEndRow, int $subtotalRow, int $totalRow): string
{
    $cells = [];
    $cells[] = sheet_row(1, [
        text_cell('A1', 'Pedido'),
        text_cell('B1', (string) $order['order_number']),
    ]);
    $cells[] = sheet_row(2, [
        text_cell('A2', 'Catalogo'),
        text_cell('B2', (string) $order['catalog_title']),
    ]);
    $cells[] = sheet_row(3, [
        text_cell('A3', 'Cliente'),
        text_cell('B3', (string) $order['customer_name']),
    ]);
    $cells[] = sheet_row(4, [
        text_cell('A4', 'Correo'),
        text_cell('B4', (string) $order['customer_email']),
    ]);
    $cells[] = sheet_row(5, [
        text_cell('A5', 'Telefono'),
        text_cell('B5', (string) $order['customer_phone']),
    ]);
    $cells[] = sheet_row(6, [
        text_cell('A6', 'Estado'),
        text_cell('B6', (string) $order['status']),
    ]);
    $cells[] = sheet_row(7, [
        text_cell('A7', 'Fecha'),
        text_cell('B7', (string) $order['created_at']),
    ]);

    $headers = ['ITEM', 'Descripcion', 'Empaque', 'Vultos', 'Piezas Totales', 'Precio Unitario', 'Total Linea'];
    $headerCells = [];
    foreach (range('A', 'G') as $index => $column) {
        $headerCells[] = text_cell($column . $headerRow, $headers[$index], 1);
    }
    $cells[] = sheet_row($headerRow, $headerCells);

    $rowNumber = $headerRow + 1;
    foreach ($rows as $row) {
        $cells[] = sheet_row($rowNumber, [
            text_cell('A' . $rowNumber, $row['item_code'], 2),
            text_cell('B' . $rowNumber, $row['description'], 2),
            number_cell('C' . $rowNumber, $row['package_qty'], 3),
            number_cell('D' . $rowNumber, $row['bultos'], 3),
            number_cell('E' . $rowNumber, $row['pieces_total'], 3),
            number_cell('F' . $rowNumber, $row['price'], 4),
            number_cell('G' . $rowNumber, $row['line_total'], 4),
        ]);
        $rowNumber++;
    }

    $cells[] = sheet_row($subtotalRow, [
        text_cell('F' . $subtotalRow, 'Subtotal', 5),
        number_cell('G' . $subtotalRow, $subtotal, 6),
    ]);
    $cells[] = sheet_row($totalRow, [
        text_cell('F' . $totalRow, 'Total General', 5),
        number_cell('G' . $totalRow, $subtotal, 6),
    ]);

    $autoFilterRef = 'A' . $headerRow . ':G' . max($headerRow, $dataEndRow);

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        . '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' . $headerRow . '" topLeftCell="A' . ($headerRow + 1) . '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        . '<sheetFormatPr defaultRowHeight="18"/>'
        . '<cols>'
        . '<col min="1" max="1" width="16" customWidth="1"/>'
        . '<col min="2" max="2" width="46" customWidth="1"/>'
        . '<col min="3" max="5" width="16" customWidth="1"/>'
        . '<col min="6" max="7" width="18" customWidth="1"/>'
        . '</cols>'
        . '<sheetData>' . implode('', $cells) . '</sheetData>'
        . '<autoFilter ref="' . $autoFilterRef . '"/>'
        . '</worksheet>';
}

function build_styles_xml(): string
{
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<numFmts count="1"><numFmt numFmtId="164" formatCode="$#,##0.00"/></numFmts>'
        . '<fonts count="3">'
        . '<font><sz val="11"/><name val="Calibri"/></font>'
        . '<font><sz val="11"/><name val="Calibri"/><b/></font>'
        . '<font><sz val="12"/><name val="Calibri"/><b/><color rgb="FFFFFFFF"/></font>'
        . '</fonts>'
        . '<fills count="4">'
        . '<fill><patternFill patternType="none"/></fill>'
        . '<fill><patternFill patternType="gray125"/></fill>'
        . '<fill><patternFill patternType="solid"><fgColor rgb="FFB7192E"/><bgColor indexed="64"/></patternFill></fill>'
        . '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F1EA"/><bgColor indexed="64"/></patternFill></fill>'
        . '</fills>'
        . '<borders count="2">'
        . '<border><left/><right/><top/><bottom/><diagonal/></border>'
        . '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>'
        . '</borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="7">'
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        . '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        . '</cellXfs>'
        . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        . '</styleSheet>';
}

function build_content_types_xml(): string
{
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        . '</Types>';
}

function build_root_rels_xml(): string
{
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        . '</Relationships>';
}

function build_workbook_xml(): string
{
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        . '<sheets><sheet name="Pedido" sheetId="1" r:id="rId1"/></sheets>'
        . '</workbook>';
}

function build_workbook_rels_xml(): string
{
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        . '</Relationships>';
}

function sheet_row(int $rowNumber, array $cells): string
{
    return '<row r="' . $rowNumber . '">' . implode('', $cells) . '</row>';
}

function text_cell(string $cellRef, string $value, int $style = 0): string
{
    return '<c r="' . $cellRef . '" s="' . $style . '" t="inlineStr"><is><t>' . xml_escape($value) . '</t></is></c>';
}

function number_cell(string $cellRef, float $value, int $style = 0): string
{
    return '<c r="' . $cellRef . '" s="' . $style . '"><v>' . number_format($value, 2, '.', '') . '</v></c>';
}

function xml_escape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function format_plain_number(float $value): string
{
    return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
}
