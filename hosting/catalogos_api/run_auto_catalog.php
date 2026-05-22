<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auto_catalog_helpers.php';

$providedKey = trim((string) ($_GET['key'] ?? $_POST['key'] ?? ''));
$expectedKey = auto_catalog_api_key();

if ($expectedKey === '' || $providedKey === '' || !hash_equals($expectedKey, $providedKey)) {
    json_response([
        'ok' => false,
        'error' => 'Clave privada invalida o no configurada.',
    ], 401);
}

$ruleId = (int) ($_GET['rule_id'] ?? $_POST['rule_id'] ?? 0);
$rule = $ruleId > 0 ? auto_catalog_fetch_rule($ruleId) : auto_catalog_fetch_default_rule();

if (!$rule) {
    json_response([
        'ok' => false,
        'error' => 'No hay regla automatica activa para ejecutar.',
    ], 404);
}

try {
    $result = auto_catalog_run((int) $rule['id']);
    json_response($result);
} catch (Throwable $exception) {
    json_response([
        'ok' => false,
        'error' => $exception->getMessage(),
    ], 500);
}
