<?php
declare(strict_types=1);

function backblaze_upload_enabled(): bool
{
    return (bool) catalog_config('backblaze.enabled', false);
}

function backblaze_upload_configured(): bool
{
    $required = [
        'endpoint',
        'bucket',
        'key_id',
        'application_key',
        'cdn_base_url',
    ];
    foreach ($required as $key) {
        if (trim((string) catalog_config('backblaze.' . $key, '')) === '') {
            return false;
        }
    }
    return true;
}

function backblaze_upload_file(string $sourcePath, string $objectKey, string $contentType): string
{
    if (!is_file($sourcePath)) {
        throw new RuntimeException('No se encontro el archivo temporal para subir a Backblaze.');
    }
    if (!backblaze_upload_configured()) {
        throw new RuntimeException('Backblaze no esta configurado completo en catalogos_api/config.php.');
    }

    $endpoint = rtrim((string) catalog_config('backblaze.endpoint'), '/');
    $bucket = trim((string) catalog_config('backblaze.bucket'));
    $keyId = trim((string) catalog_config('backblaze.key_id'));
    $applicationKey = (string) catalog_config('backblaze.application_key');
    $region = trim((string) catalog_config('backblaze.region', ''));
    if ($region === '') {
        $region = backblaze_region_from_endpoint($endpoint);
    }

    $objectKey = backblaze_normalize_object_key($objectKey);
    $canonicalUri = '/' . rawurlencode($bucket) . '/' . backblaze_encode_object_key($objectKey);
    $url = $endpoint . $canonicalUri;
    $host = parse_url($endpoint, PHP_URL_HOST);
    if (!is_string($host) || $host === '') {
        throw new RuntimeException('Endpoint Backblaze invalido.');
    }

    $payloadHash = hash_file('sha256', $sourcePath);
    if (!is_string($payloadHash)) {
        throw new RuntimeException('No se pudo calcular hash de la imagen.');
    }

    $now = gmdate('Ymd\THis\Z');
    $date = gmdate('Ymd');
    $headers = [
        'content-type' => $contentType,
        'host' => $host,
        'x-amz-content-sha256' => $payloadHash,
        'x-amz-date' => $now,
    ];
    $signedHeaders = implode(';', array_keys($headers));
    $canonicalHeaders = '';
    foreach ($headers as $name => $value) {
        $canonicalHeaders .= $name . ':' . trim($value) . "\n";
    }

    $canonicalRequest = implode("\n", [
        'PUT',
        $canonicalUri,
        '',
        $canonicalHeaders,
        $signedHeaders,
        $payloadHash,
    ]);
    $credentialScope = $date . '/' . $region . '/s3/aws4_request';
    $stringToSign = implode("\n", [
        'AWS4-HMAC-SHA256',
        $now,
        $credentialScope,
        hash('sha256', $canonicalRequest),
    ]);
    $signature = hash_hmac('sha256', $stringToSign, backblaze_signature_key($applicationKey, $date, $region));
    $authorization = 'AWS4-HMAC-SHA256 Credential=' . $keyId . '/' . $credentialScope . ', SignedHeaders=' . $signedHeaders . ', Signature=' . $signature;

    $body = file_get_contents($sourcePath);
    if ($body === false) {
        throw new RuntimeException('No se pudo leer la imagen para subir a Backblaze.');
    }
    if (!function_exists('curl_init')) {
        throw new RuntimeException('El servidor no tiene cURL habilitado para subir a Backblaze.');
    }

    $curl = curl_init($url);
    if ($curl === false) {
        throw new RuntimeException('No se pudo inicializar cURL para Backblaze.');
    }
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: ' . $authorization,
            'Content-Type: ' . $contentType,
            'Host: ' . $host,
            'x-amz-content-sha256: ' . $payloadHash,
            'x-amz-date: ' . $now,
        ],
        CURLOPT_TIMEOUT => max(10, (int) catalog_config('backblaze.timeout', 45)),
    ]);
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($response === false || $status < 200 || $status >= 300) {
        throw new RuntimeException('No se pudo subir a Backblaze. HTTP ' . $status . ($error !== '' ? ': ' . $error : '.'));
    }

    return rtrim((string) catalog_config('backblaze.cdn_base_url'), '/') . '/' . str_replace('%2F', '/', rawurlencode($objectKey));
}

function backblaze_signature_key(string $secret, string $date, string $region): string
{
    $dateKey = hash_hmac('sha256', $date, 'AWS4' . $secret, true);
    $regionKey = hash_hmac('sha256', $region, $dateKey, true);
    $serviceKey = hash_hmac('sha256', 's3', $regionKey, true);
    return hash_hmac('sha256', 'aws4_request', $serviceKey, true);
}

function backblaze_region_from_endpoint(string $endpoint): string
{
    $host = parse_url($endpoint, PHP_URL_HOST);
    if (is_string($host) && preg_match('/s3[.-]([a-z0-9-]+)\.backblazeb2\.com/i', $host, $matches)) {
        return $matches[1];
    }
    return 'us-west-004';
}

function backblaze_normalize_object_key(string $objectKey): string
{
    $parts = array_filter(explode('/', str_replace('\\', '/', $objectKey)), static fn(string $part): bool => $part !== '' && $part !== '.');
    return implode('/', $parts);
}

function backblaze_encode_object_key(string $objectKey): string
{
    return implode('/', array_map('rawurlencode', explode('/', $objectKey)));
}
