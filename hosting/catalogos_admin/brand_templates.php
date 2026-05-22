<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
admin_require_login(['admin']);

$templates = admin_brand_templates_list();

admin_header('Plantillas por marca', 'brand_templates.php');
?>
<section class="card">
    <div class="toolbar">
        <strong>Plantillas detectadas</strong>
        <a class="button" href="catalogos.php">Volver a catalogos</a>
    </div>
    <p class="muted">Vista de solo lectura. Las plantillas se configuran por carpeta en <code>assets/brand_templates/{slug}/config.json</code>.</p>

    <?php if (!$templates): ?>
        <p class="muted">No hay plantillas detectadas todavia.</p>
    <?php else: ?>
        <div class="table-wrap" style="margin-top:16px;">
            <table>
                <thead>
                    <tr>
                        <th>Marca</th>
                        <th>Slug</th>
                        <th>Logo</th>
                        <th>Colores</th>
                        <th>Banner</th>
                        <th>Promo</th>
                        <th>Placeholder</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($templates as $template): ?>
                    <tr>
                        <td><strong><?= html_escape($template['brand']) ?></strong></td>
                        <td><code><?= html_escape($template['slug']) ?></code></td>
                        <td><?= $template['logo_url'] !== '' ? '<img src="' . html_escape($template['logo_url']) . '" alt="" style="width:54px;height:54px;object-fit:contain;border-radius:10px;border:1px solid #ddd;background:#fff;">' : '<span class="muted">Sin logo</span>' ?></td>
                        <td>
                            <span style="display:inline-flex;gap:6px;align-items:center;">
                                <span style="width:22px;height:22px;border-radius:999px;border:1px solid #ccc;background:<?= html_escape($template['primaryColor'] ?: '#fff') ?>"></span>
                                <span style="width:22px;height:22px;border-radius:999px;border:1px solid #ccc;background:<?= html_escape($template['secondaryColor'] ?: '#fff') ?>"></span>
                            </span>
                        </td>
                        <td><?= $template['banner_exists'] ? 'Detectado' : '<span class="muted">No</span>' ?></td>
                        <td><?= $template['promo_exists'] ? 'Detectado' : '<span class="muted">No</span>' ?></td>
                        <td><?= $template['placeholder_exists'] ? 'Detectado' : '<span class="muted">Global</span>' ?></td>
                        <td><span class="pill"><?= html_escape($template['status']) ?></span></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</section>
<?php admin_footer(); ?>

<?php
function admin_brand_templates_list(): array
{
    $baseDir = dirname(__DIR__) . '/assets/brand_templates';
    if (!is_dir($baseDir)) return [];
    $items = [];
    foreach (scandir($baseDir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $dir = $baseDir . '/' . $entry;
        if (!is_dir($dir)) continue;
        $configPath = $dir . '/config.json';
        if (!is_file($configPath)) {
            $items[] = admin_brand_template_row($entry, [], $dir, 'Falta config.json');
            continue;
        }
        $config = json_decode((string) file_get_contents($configPath), true);
        $items[] = admin_brand_template_row($entry, is_array($config) ? $config : [], $dir, is_array($config) ? 'Detectada' : 'Config invalido');
    }
    usort($items, static fn(array $a, array $b): int => strcasecmp($a['brand'], $b['brand']));
    return $items;
}

function admin_brand_template_row(string $slug, array $config, string $dir, string $status): array
{
    $safeSlug = preg_replace('/[^a-zA-Z0-9_-]+/', '-', (string) ($config['slug'] ?? $slug)) ?: $slug;
    $logo = admin_brand_template_file($config['logo'] ?? '', $dir);
    return [
        'brand' => trim((string) ($config['brand'] ?? $safeSlug)),
        'slug' => $safeSlug,
        'primaryColor' => admin_brand_template_color($config['primaryColor'] ?? ''),
        'secondaryColor' => admin_brand_template_color($config['secondaryColor'] ?? ''),
        'logo_url' => $logo !== '' ? '../assets/brand_templates/' . rawurlencode($slug) . '/' . rawurlencode(basename($logo)) : '',
        'banner_exists' => admin_brand_template_file($config['banner'] ?? '', $dir) !== '',
        'promo_exists' => admin_brand_template_file($config['promo'] ?? '', $dir) !== '',
        'placeholder_exists' => admin_brand_template_file($config['placeholder'] ?? '', $dir) !== '',
        'status' => $status,
    ];
}

function admin_brand_template_file(mixed $fileName, string $dir): string
{
    $fileName = trim(str_replace('\\', '/', (string) $fileName), '/');
    if ($fileName === '' || str_contains($fileName, '..')) return '';
    $path = $dir . '/' . $fileName;
    return is_file($path) ? $path : '';
}

function admin_brand_template_color(mixed $value): string
{
    $value = trim((string) $value);
    return preg_match('/^#[0-9a-f]{6}$/i', $value) ? $value : '';
}
