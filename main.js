const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { execFile, spawn } = require("child_process");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);
const COVER_CANDIDATES = new Set(["cover", "portada"]);
const LOGO_CANDIDATES = new Set(["logo", "brand", "marca"]);

let mainWindow = null;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 980,
        minWidth: 1280,
        minHeight: 820,
        backgroundColor: "#181818",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
    registerIpcHandlers();
    createMainWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

function registerIpcHandlers() {
    ipcMain.handle("dialog:open-file", async (_, options = {}) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: options.title || "Seleccionar archivo",
            properties: ["openFile"],
            filters: options.filters || [],
        });

        if (result.canceled || !result.filePaths.length) {
            return "";
        }

        return result.filePaths[0];
    });

    ipcMain.handle("dialog:open-directory", async (_, options = {}) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: options.title || "Seleccionar carpeta",
            properties: ["openDirectory"],
        });

        if (result.canceled || !result.filePaths.length) {
            return "";
        }

        return result.filePaths[0];
    });

    ipcMain.handle("fs:read-file-buffer", async (_, filePath) => {
        return Array.from(fs.readFileSync(filePath));
    });

    ipcMain.handle("fs:scan-categories", async (_, rootDir) => {
        return scanCategories(rootDir);
    });

    ipcMain.handle("batch:generate-pdfs", async (_, payload) => {
        const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
        const results = [];
        const total = jobs.length;

        for (let index = 0; index < jobs.length; index += 1) {
            const job = jobs[index];
            const result = await generatePdfJob(job);
            results.push(result);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("batch-progress", {
                    completed: index + 1,
                    total,
                    category: job.categoryName,
                    ok: result.ok,
                    filePath: result.filePath || "",
                    error: result.error || "",
                });
            }
        }

        return results;
    });

    ipcMain.handle("web:export-package", async (_, payload) => {
        return exportWebPackage(payload);
    });

    ipcMain.handle("hosting:publish-catalog", async (event, payload) => {
        return publishCatalogPackage(payload, (progress) => {
            event.sender.send("hosting-progress", progress);
        });
    });

    ipcMain.handle("window:export-current-pdf", async (_, payload = {}) => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            throw new Error("La ventana principal no esta disponible.");
        }
        const suggestedName = sanitizeSlug(payload.fileName || payload.title || "catalogo") || "catalogo";
        const result = await dialog.showSaveDialog(mainWindow, {
            title: "Guardar PDF del catalogo",
            defaultPath: `${suggestedName}.pdf`,
            filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (result.canceled || !result.filePath) {
            return { canceled: true, filePath: "" };
        }
        const pdf = await mainWindow.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            landscape: false,
        });
        fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
        fs.writeFileSync(result.filePath, pdf);
        return { canceled: false, filePath: result.filePath };
    });
}

function scanCategories(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) {
        return [];
    }

    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory());

    return directories.map((entry) => {
        const categoryDir = path.join(rootDir, entry.name);
        const imageFiles = [];
        let coverPath = "";
        let logoPath = "";

        walkDirectory(categoryDir, (filePath, nameWithoutExt, ext) => {
            if (!IMAGE_EXTENSIONS.has(ext)) return;

            const normalizedName = normalizeStem(nameWithoutExt);
            if (!coverPath && COVER_CANDIDATES.has(normalizedName)) {
                coverPath = filePath;
                return;
            }

            if (!logoPath && LOGO_CANDIDATES.has(normalizedName)) {
                logoPath = filePath;
                return;
            }

            imageFiles.push(filePath);
        });

        return {
            name: entry.name,
            folderPath: categoryDir,
            coverPath,
            logoPath,
            imageFiles,
        };
    });
}

function walkDirectory(dirPath, onFile) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    entries.forEach((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkDirectory(fullPath, onFile);
            return;
        }

        const ext = path.extname(entry.name).toLowerCase();
        const nameWithoutExt = path.basename(entry.name, ext);
        onFile(fullPath, nameWithoutExt, ext);
    });
}

function normalizeStem(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "")
        .trim()
        .toLowerCase();
}

function generatePdfJob(job) {
    return new Promise((resolve) => {
        const outputFile = path.join(job.outputDir, `${job.fileName}.pdf`);
        const exportWindow = new BrowserWindow({
            show: false,
            width: 1400,
            height: 950,
            backgroundColor: "#ffffff",
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        let settled = false;

        const cleanup = (result) => {
            if (settled) return;
            settled = true;
            if (!exportWindow.isDestroyed()) {
                exportWindow.close();
            }
            resolve(result);
        };

        ipcMain.once(`export-ready:${job.jobId}`, async () => {
            try {
                const pdf = await exportWindow.webContents.printToPDF({
                    printBackground: true,
                    preferCSSPageSize: true,
                    margins: { top: 0, bottom: 0, left: 0, right: 0 },
                    landscape: false,
                });

                fs.mkdirSync(job.outputDir, { recursive: true });
                fs.writeFileSync(outputFile, pdf);

                cleanup({ ok: true, filePath: outputFile, category: job.categoryName });
            } catch (error) {
                cleanup({ ok: false, error: error.message, category: job.categoryName });
            }
        });

        exportWindow.webContents.on("did-finish-load", () => {
            exportWindow.webContents.send("export-payload", job);
        });

        exportWindow.webContents.on("render-process-gone", (_, details) => {
            cleanup({ ok: false, error: `Renderer error: ${details.reason}`, category: job.categoryName });
        });

        exportWindow.loadURL(pathToFileURL(path.join(__dirname, "index.html")).toString());
    });
}

function exportWebPackage(payload) {
    const slug = sanitizeSlug(payload?.slug || "catalogo-publicable");
    const outputRoot = payload?.outputDir;
    if (!outputRoot) throw new Error("No se indico carpeta de salida.");
    const packageDir = path.join(outputRoot, slug);
    fs.mkdirSync(packageDir, { recursive: true });
    copyIfExists(path.join(__dirname, "styles.css"), path.join(packageDir, "styles.css"));
    copyDirectory(path.join(__dirname, "fonts"), path.join(packageDir, "fonts"));
    const assets = Array.isArray(payload?.assets) ? payload.assets : [];
    assets.forEach((asset) => {
        if (!asset?.sourcePath || !asset?.relativePath) return;
        const target = path.join(packageDir, asset.relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        copyWebAsset(asset.sourcePath, target);
    });
    const metadata = payload?.metadata || {};
    fs.writeFileSync(path.join(packageDir, "catalog.json"), JSON.stringify(metadata, null, 2), "utf8");
    fs.writeFileSync(path.join(packageDir, "index.html"), buildWebExportHtml(payload?.snapshotHtml || "", metadata), "utf8");
    return { ok: true, outputDir: packageDir, slug };
}

async function publishCatalogPackage(payload, onProgress = () => {}) {
    onProgress({ phase: "exporting", percent: 8, completed: 0, total: 0, label: "" });
    const exportResult = exportWebPackage(payload?.exportPayload || {});
    const packageDir = exportResult.outputDir;
    const slug = exportResult.slug;
    const hosting = payload?.hosting || {};
    const publish = payload?.publish || {};
    const zipBaseName = sanitizeArchiveName(publish.title || slug);
    const zipFileName = `${zipBaseName}.zip`;
    const zipFilePath = path.join(path.dirname(packageDir), zipFileName);
    onProgress({ phase: "compressing", percent: 18, completed: 0, total: 0, label: zipFileName });
    await createZipFromDirectory(packageDir, zipFilePath);
    await uploadFileViaPowerShellFtp({
        localFile: zipFilePath,
        ftpHost: hosting.ftpHost,
        ftpUser: hosting.ftpUser,
        ftpPassword: hosting.ftpPassword,
        remoteDir: sanitizeRemoteDir(hosting.remoteDir),
        remoteFileName: zipFileName,
        onProgress,
    });

    const publicUrl = publish.publicUrl || buildPublicUrl(hosting.publicBaseUrl, slug);
    const apiUrl = `${String(hosting.apiBaseUrl || "").replace(/\/+$/, "")}/publish_uploaded_zip.php`;
    if (!hosting.apiBaseUrl) {
        throw new Error("Falta la API base publica para registrar el catalogo.");
    }
    onProgress({ phase: "registering", percent: 96, completed: 0, total: 0, label: "" });

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-KEY": String(hosting.apiKey || ""),
        },
        body: JSON.stringify({
            slug,
            title: publish.title || slug,
            template: publish.template || "classic",
            public_url: publicUrl,
            pdf_url: publish.pdfUrl || "",
            expires_at: publish.expiresAt || "",
            seller_name: publish.sellerName || "",
            client_name: publish.clientName || "",
            notes: publish.notes || "",
            zip_name: zipFileName,
            status: "active",
        }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
        throw new Error(result.error || `No se pudo registrar el catalogo en la API (${response.status}).`);
    }
    onProgress({ phase: "completed", percent: 100, completed: 1, total: 1, label: slug });

    return {
        ok: true,
        outputDir: packageDir,
        slug,
        publicUrl,
        zipFilePath,
        api: result,
    };
}

function copyIfExists(sourcePath, targetPath) {
    if (!sourcePath || !fs.existsSync(sourcePath)) return;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
}

function copyWebAsset(sourcePath, targetPath) {
    if (!sourcePath || !fs.existsSync(sourcePath)) return;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (!shouldCompressWebImage(sourcePath, targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
        return;
    }

    try {
        const sourceImage = nativeImage.createFromPath(sourcePath);
        if (sourceImage.isEmpty()) {
            fs.copyFileSync(sourcePath, targetPath);
            return;
        }

        const size = sourceImage.getSize();
        const maxWidth = 1600;
        const resized = size.width > maxWidth
            ? sourceImage.resize({ width: maxWidth, quality: "good" })
            : sourceImage;

        const jpegBuffer = resized.toJPEG(82);
        fs.writeFileSync(targetPath, jpegBuffer);
    } catch (error) {
        fs.copyFileSync(sourcePath, targetPath);
    }
}

function shouldCompressWebImage(sourcePath, targetPath) {
    const sourceExt = path.extname(sourcePath).toLowerCase();
    const targetExt = path.extname(targetPath).toLowerCase();
    if (sourceExt === ".svg" || targetExt === ".svg") return false;
    return [".jpg", ".jpeg", ".png", ".webp"].includes(sourceExt) && targetExt === ".jpg";
}

function copyDirectory(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) return;
    fs.mkdirSync(targetDir, { recursive: true });
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    entries.forEach((entry) => {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
            copyDirectory(sourcePath, targetPath);
            return;
        }
        fs.copyFileSync(sourcePath, targetPath);
    });
}

function sanitizeRemoteDir(value) {
    const raw = String(value ?? "")
        .trim()
        .replace(/\\/g, "/");
    if (!raw || raw === "." || raw === "/") return "";
    const normalized = raw.replace(/\/+$/, "");
    return normalized === "." ? "" : normalized;
}

function buildRemoteCatalogDir(remoteDir, slug) {
    const baseDir = sanitizeRemoteDir(remoteDir);
    return baseDir ? `${baseDir}/${slug}` : slug;
}

function buildPublicUrl(baseUrl, slug) {
    const cleanBase = String(baseUrl || "").trim().replace(/\/+$/, "");
    return cleanBase ? `${cleanBase}/${slug}/` : "";
}

async function uploadDirectoryViaPowerShellFtp({ localDir, ftpHost, ftpUser, ftpPassword, remoteDir, onProgress = () => {} }) {
    if (!ftpHost || !ftpUser || !ftpPassword) {
        throw new Error("Faltan datos FTP para publicar el catalogo.");
    }
    if (!fs.existsSync(localDir)) {
        throw new Error("No existe la carpeta local del paquete web a publicar.");
    }

    const script = `
$ErrorActionPreference = 'Stop'
$ftpHost = ${psSingleQuote(ftpHost)}
$ftpUser = ${psSingleQuote(ftpUser)}
$ftpPassword = ${psSingleQuote(ftpPassword)}
$remoteRoot = ${psSingleQuote(remoteDir)}
$localRoot = ${psSingleQuote(localDir)}
$files = @()

function New-FtpDirectoryRecursive {
    param([string]$TargetPath)
    $parts = $TargetPath -split '/'
    $current = ''
    foreach ($part in $parts) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $current = "$current/$part"
        $uri = [System.Uri]("ftp://$ftpHost$current")
        try {
            $request = [System.Net.FtpWebRequest]::Create($uri)
            $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
            $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
            $request.UseBinary = $true
            $request.UsePassive = $true
            $request.KeepAlive = $false
            $response = $request.GetResponse()
            $response.Close()
        } catch {
            $message = $_.Exception.Message
            if ($message -notmatch 'exist' -and $message -notmatch '550') {
                throw
            }
        }
    }
}

function Send-FtpFile {
    param([string]$SourceFile, [string]$DestinationPath)
    $directory = [System.IO.Path]::GetDirectoryName($DestinationPath).Replace('\\','/')
    if ($directory) { New-FtpDirectoryRecursive -TargetPath $directory }
    $uri = [System.Uri]("ftp://$ftpHost/$DestinationPath")
    $request = [System.Net.FtpWebRequest]::Create($uri)
    $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false
    $bytes = [System.IO.File]::ReadAllBytes($SourceFile)
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $response = $request.GetResponse()
    $response.Close()
}

Get-ChildItem -LiteralPath $localRoot -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($localRoot.Length).TrimStart('\\').Replace('\\','/')
    $files += $relative
}

$total = $files.Count
$completed = 0

foreach ($relative in $files) {
    $sourceFile = Join-Path $localRoot ($relative.Replace('/','\\'))
    $destination = ($remoteRoot.TrimStart('/') + '/' + $relative).TrimStart('/')
    Send-FtpFile -SourceFile $sourceFile -DestinationPath $destination
    $completed += 1
    Write-Output ("__PROGRESS__|" + $completed + "|" + $total + "|" + $relative)
}
`;

    onProgress({ phase: "uploading", percent: 10, completed: 0, total: countFilesRecursive(localDir), label: "" });
    await runPowerShellScriptStreaming(script, (line) => {
        if (!line.startsWith("__PROGRESS__|")) return;
        const parts = line.split("|");
        const completed = Number(parts[1] || 0);
        const total = Number(parts[2] || 0);
        const label = String(parts[3] || "");
        const percent = total > 0 ? Math.round(10 + (completed / total) * 82) : 92;
        onProgress({ phase: "uploading", completed, total, percent, label });
    });
}

async function uploadFileViaPowerShellFtp({ localFile, ftpHost, ftpUser, ftpPassword, remoteDir, remoteFileName, onProgress = () => {} }) {
    if (!ftpHost || !ftpUser || !ftpPassword) {
        throw new Error("Faltan datos FTP para publicar el catalogo.");
    }
    if (!localFile || !fs.existsSync(localFile)) {
        throw new Error("No existe el ZIP local del catalogo a publicar.");
    }

    const remoteBase = sanitizeRemoteDir(remoteDir);
    const destinationPath = [remoteBase, remoteFileName].filter(Boolean).join("/");
    const script = `
$ErrorActionPreference = 'Stop'
$ftpHost = ${psSingleQuote(ftpHost)}
$ftpUser = ${psSingleQuote(ftpUser)}
$ftpPassword = ${psSingleQuote(ftpPassword)}
$sourceFile = ${psSingleQuote(localFile)}
$destinationPath = ${psSingleQuote(destinationPath)}

function New-FtpDirectoryRecursive {
    param([string]$TargetPath)
    $parts = $TargetPath -split '/'
    $current = ''
    foreach ($part in $parts) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $current = "$current/$part"
        $uri = [System.Uri]("ftp://$ftpHost$current")
        try {
            $request = [System.Net.FtpWebRequest]::Create($uri)
            $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
            $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
            $request.UseBinary = $true
            $request.UsePassive = $true
            $request.KeepAlive = $false
            $response = $request.GetResponse()
            $response.Close()
        } catch {
            $message = $_.Exception.Message
            if ($message -notmatch 'exist' -and $message -notmatch '550') {
                throw
            }
        }
    }
}

$directory = [System.IO.Path]::GetDirectoryName($destinationPath).Replace('\\','/')
if ($directory) { New-FtpDirectoryRecursive -TargetPath $directory }
$uri = [System.Uri]("ftp://$ftpHost/$destinationPath")
function Invoke-FtpUpload {
    param([bool]$UsePassive)
    $request = [System.Net.FtpWebRequest]::Create($uri)
    $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
    $request.UseBinary = $true
    $request.UsePassive = $UsePassive
    $request.KeepAlive = $false
    $request.EnableSsl = $false
    $request.ReadWriteTimeout = 300000
    $request.Timeout = 300000
    $bytes = [System.IO.File]::ReadAllBytes($sourceFile)
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $response = $request.GetResponse()
    $response.Close()
}

try {
    Invoke-FtpUpload -UsePassive $true
} catch {
    Invoke-FtpUpload -UsePassive $false
}
Write-Output "__PROGRESS__|1|1|${remoteFileName}"
`;

    onProgress({ phase: "uploading", percent: 40, completed: 0, total: 1, label: remoteFileName });
    await runPowerShellScriptStreaming(script, (line) => {
        if (!line.startsWith("__PROGRESS__|")) return;
        onProgress({ phase: "uploading", percent: 92, completed: 1, total: 1, label: remoteFileName });
    });
}

function runPowerShellScript(script) {
    return new Promise((resolve, reject) => {
        execFile("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error((stderr || error.message || "No se pudo ejecutar PowerShell").trim()));
            }
            resolve({ stdout, stderr });
        });
    });
}

function runPowerShellScriptStreaming(script, onLine) {
    return new Promise((resolve, reject) => {
        const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true });
        let stdoutBuffer = "";
        let stderrBuffer = "";

        child.stdout.on("data", (chunk) => {
            stdoutBuffer += chunk.toString();
            const lines = stdoutBuffer.split(/\r?\n/);
            stdoutBuffer = lines.pop() || "";
            lines.forEach((line) => {
                const trimmed = line.trim();
                if (trimmed) onLine(trimmed);
            });
        });

        child.stderr.on("data", (chunk) => {
            stderrBuffer += chunk.toString();
        });

        child.on("error", (error) => {
            reject(new Error(error.message || "No se pudo ejecutar PowerShell"));
        });

        child.on("close", (code) => {
            if (stdoutBuffer.trim()) onLine(stdoutBuffer.trim());
            if (code !== 0) {
                return reject(new Error((stderrBuffer || `PowerShell finalizo con codigo ${code}`).trim()));
            }
            resolve({ stderr: stderrBuffer });
        });
    });
}

function countFilesRecursive(rootDir) {
    let total = 0;
    const walk = (dirPath) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        entries.forEach((entry) => {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                return;
            }
            total += 1;
        });
    };
    walk(rootDir);
    return total;
}

function psSingleQuote(value) {
    return `'${String(value || "").replace(/'/g, "''")}'`;
}

async function createZipFromDirectory(sourceDir, zipFilePath) {
    fs.mkdirSync(path.dirname(zipFilePath), { recursive: true });
    if (fs.existsSync(zipFilePath)) {
        fs.unlinkSync(zipFilePath);
    }

    const script = `
$ErrorActionPreference = 'Stop'
$sourceDir = ${psSingleQuote(sourceDir)}
$zipFile = ${psSingleQuote(zipFilePath)}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $zipFile) {
    Remove-Item -LiteralPath $zipFile -Force
}
$fileStream = [System.IO.File]::Open($zipFile, [System.IO.FileMode]::Create)
try {
    $zipArchive = New-Object System.IO.Compression.ZipArchive($fileStream, 1, $false)
    try {
        Get-ChildItem -LiteralPath $sourceDir -Recurse -File | ForEach-Object {
            $relativePath = $_.FullName.Substring($sourceDir.Length).TrimStart('\\')
            $entryName = $relativePath.Replace('\\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally {
        $zipArchive.Dispose()
    }
} finally {
    $fileStream.Dispose()
}
`;

    await runPowerShellScript(script);
}

function sanitizeArchiveName(value) {
    return String(value || "catalogo")
        .replace(/[<>:"/\\|?*]+/g, "")
        .replace(/\s+/g, " ")
        .trim() || "catalogo";
}

function buildWebExportHtml(snapshotHtml, metadata) {
    const safeMetadata = JSON.stringify(metadata || {});
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-store, max-age=0">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>${escapeHtml(metadata?.title || "Catalogo publicable")}</title>
    <link rel="stylesheet" href="./styles.css">
    <style>
        body.web-export-body { background: #d8d4cf; }
        .web-export-shell { padding: 28px 0 56px; }
        [data-item] { position: relative; }
        [data-item] .product-card__image-wrap,
        [data-item] .campin1-hero__visual,
        [data-item] .showcase-card__visual,
        [data-item] .industrial-card__visual,
        [data-item] .minimal-card__visual,
        [data-item] .editorial-card__visual,
        [data-item] .horizontal-card__visual {
            position: relative;
            overflow: visible;
        }
        .web-media-trigger {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 3;
            min-height: 36px;
            border: none;
            border-radius: 999px;
            padding: 0 14px;
            background: rgba(22,22,22,0.88);
            color: #fff;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 10px 20px rgba(0,0,0,0.16);
        }
        .web-media-trigger--inline {
            position: static;
            top: auto;
            left: auto;
        }
        .web-media-clickable {
            cursor: zoom-in;
        }
        .web-media-inline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 10px;
        }
        .web-media-hint {
            position: static;
            z-index: 2;
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 0 10px;
            border-radius: 999px;
            background: rgba(255,255,255,0.92);
            color: #171717;
            font: inherit;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 10px 18px rgba(0,0,0,0.12);
            pointer-events: none;
        }
        .web-expired-banner {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(12,12,12,0.72);
            backdrop-filter: blur(6px);
        }
        .web-expired-banner--visible { display: flex; }
        .web-expired-banner__card {
            max-width: 540px;
            padding: 28px;
            border-radius: 24px;
            background: #fff;
            color: #222;
            text-align: center;
            box-shadow: 0 22px 44px rgba(0,0,0,0.22);
        }
        .web-media-modal {
            position: fixed;
            inset: 0;
            z-index: 110;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(10,10,10,0.82);
            backdrop-filter: blur(8px);
        }
        .web-media-modal--open { display: flex; }
        .web-media-modal__dialog {
            width: min(960px, 100%);
            max-height: calc(100vh - 48px);
            overflow: auto;
            border-radius: 24px;
            background: #fff;
            padding: 22px;
            box-shadow: 0 28px 60px rgba(0,0,0,0.34);
        }
        .web-media-modal__header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
        }
        .web-media-modal__title { margin: 0; font-size: 24px; }
        .web-media-modal__close {
            min-width: 42px;
            min-height: 42px;
            border: none;
            border-radius: 50%;
            background: #171717;
            color: #fff;
            font: inherit;
            font-size: 18px;
            cursor: pointer;
        }
        .web-media-modal__hero {
            display: grid;
            gap: 16px;
        }
        .web-media-modal__frame {
            min-height: 320px;
            border-radius: 20px;
            background: #f6f4ef;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 20px;
        }
        .web-media-modal__frame img,
        .web-media-modal__frame video {
            max-width: 100%;
            max-height: 68vh;
            object-fit: contain;
        }
        .web-media-modal__thumbs {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .web-media-modal__thumb {
            width: 92px;
            height: 92px;
            border: 2px solid transparent;
            border-radius: 16px;
            overflow: hidden;
            background: #f0eee8;
            cursor: pointer;
            padding: 0;
        }
        .web-media-modal__thumb--active { border-color: #171717; }
        .web-media-modal__thumb img,
        .web-media-modal__thumb video {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .web-order-floating {
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 120;
            min-height: 50px;
            border: none;
            border-radius: 999px;
            padding: 0 18px;
            background: #171717;
            color: #fff;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 14px 28px rgba(0,0,0,0.28);
        }
        .web-order-floating[disabled] {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .web-order-action {
            min-height: 34px;
            border: none;
            border-radius: 999px;
            padding: 0 14px;
            background: rgba(92,107,69,0.92);
            color: #fff;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 10px 20px rgba(0,0,0,0.14);
        }
        .web-order-inline {
            position: absolute;
            right: 10px;
            bottom: 10px;
            z-index: 3;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px;
            border-radius: 999px;
            background: rgba(255,255,255,0.92);
            box-shadow: 0 10px 20px rgba(0,0,0,0.14);
        }
        .web-order-inline__qty {
            width: 72px;
            min-height: 34px;
            border: 1px solid #d7d0c2;
            border-radius: 999px;
            padding: 0 10px;
            font: inherit;
        }
        .web-order-panel {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            z-index: 115;
            width: min(430px, 100%);
            padding: 20px;
            background: #fff;
            box-shadow: -18px 0 36px rgba(0,0,0,0.18);
            transform: translateX(100%);
            transition: transform 0.22s ease;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .web-order-panel--open { transform: translateX(0); }
        .web-order-panel__header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
        }
        .web-order-panel__header h2 {
            margin: 0;
            font-size: 24px;
        }
        .web-order-panel__close {
            min-width: 40px;
            min-height: 40px;
            border: none;
            border-radius: 50%;
            background: #171717;
            color: #fff;
            font: inherit;
            cursor: pointer;
        }
        .web-order-panel__summary {
            flex: 1;
            overflow: auto;
            display: grid;
            gap: 10px;
            align-content: start;
        }
        .web-order-item {
            border: 1px solid #e3dfd6;
            border-radius: 16px;
            padding: 12px;
            background: #faf8f3;
        }
        .web-order-item h3 {
            margin: 0 0 4px;
            font-size: 16px;
        }
        .web-order-item p {
            margin: 0;
            color: #5d5d59;
            font-size: 13px;
        }
        .web-order-item__row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 10px;
        }
        .web-order-item__qty {
            width: 90px;
            min-height: 38px;
            border: 1px solid #d7d0c2;
            border-radius: 12px;
            padding: 0 10px;
            font: inherit;
        }
        .web-order-form {
            display: grid;
            gap: 10px;
        }
        .web-order-form input,
        .web-order-form textarea {
            width: 100%;
            min-height: 42px;
            border: 1px solid #d7d0c2;
            border-radius: 14px;
            padding: 10px 12px;
            font: inherit;
        }
        .web-order-form textarea {
            min-height: 92px;
            resize: vertical;
        }
        .web-order-submit {
            min-height: 46px;
            border: none;
            border-radius: 14px;
            background: #5c6b45;
            color: #fff;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
        }
        .web-order-submit[disabled] {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .web-order-note {
            margin: 0;
            color: #5d5d59;
            font-size: 12px;
        }
        @media (max-width: 900px) {
            .web-export-shell { padding-top: 12px; }
            .web-media-modal__dialog { padding: 16px; }
            .web-order-panel { width: 100%; }
        }
    </style>
</head>
<body class="web-export-body">
    <div class="web-expired-banner" id="webExpiredBanner">
        <div class="web-expired-banner__card">
            <h1>Este catalogo ya no esta disponible</h1>
            <p>La vigencia del enlace ha expirado. Si necesitas una version actualizada, solicita un nuevo enlace comercial.</p>
        </div>
    </div>
    <div class="web-export-shell">
        <main id="catalogRoot" class="catalog-root">${snapshotHtml || ""}</main>
    </div>
    <div class="web-media-modal" id="webMediaModal" aria-hidden="true">
        <div class="web-media-modal__dialog">
            <div class="web-media-modal__header">
                <div>
                    <h2 class="web-media-modal__title" id="webMediaTitle">Multimedia del producto</h2>
                    <p id="webMediaSubtitle"></p>
                </div>
                <button class="web-media-modal__close" id="webMediaClose" type="button">x</button>
            </div>
            <div class="web-media-modal__hero">
                <div class="web-media-modal__frame" id="webMediaFrame"></div>
                <div class="web-media-modal__thumbs" id="webMediaThumbs"></div>
            </div>
        </div>
    </div>
    <button class="web-order-floating" id="webOrderFloating" type="button">Pedido (0)</button>
    <aside class="web-order-panel" id="webOrderPanel" aria-hidden="true">
        <div class="web-order-panel__header">
            <div>
                <h2>Pedido</h2>
                <p id="webOrderHeaderText">Agrega productos y envia la solicitud comercial.</p>
            </div>
            <button class="web-order-panel__close" id="webOrderClose" type="button">x</button>
        </div>
        <div class="web-order-panel__summary" id="webOrderSummary"></div>
        <form class="web-order-form" id="webOrderForm">
            <input id="webOrderCustomerName" name="customer_name" type="text" placeholder="Nombre del cliente" required>
            <input id="webOrderCustomerEmail" name="customer_email" type="email" placeholder="Correo">
            <input id="webOrderCustomerPhone" name="customer_phone" type="text" placeholder="Telefono o WhatsApp" required>
            <textarea id="webOrderComments" name="comments" placeholder="Observaciones del pedido"></textarea>
            <button class="web-order-submit" id="webOrderSubmit" type="submit">Enviar pedido</button>
        </form>
        <p class="web-order-note" id="webOrderNote">Configura la API del hosting para guardar pedidos y mandar correos.</p>
    </aside>
    <script id="catalogMeta" type="application/json">${safeMetadata}</script>
    <script>
        (function () {
            const metadata = JSON.parse(document.getElementById("catalogMeta").textContent || "{}");
            const products = new Map((metadata.catalog || []).map((entry) => [String(entry.item || ""), entry]));
            const expiredBanner = document.getElementById("webExpiredBanner");
            const modal = document.getElementById("webMediaModal");
            const modalClose = document.getElementById("webMediaClose");
            const modalTitle = document.getElementById("webMediaTitle");
            const modalSubtitle = document.getElementById("webMediaSubtitle");
            const modalFrame = document.getElementById("webMediaFrame");
            const modalThumbs = document.getElementById("webMediaThumbs");
            const orderFloating = document.getElementById("webOrderFloating");
            const orderPanel = document.getElementById("webOrderPanel");
            const orderClose = document.getElementById("webOrderClose");
            const orderSummary = document.getElementById("webOrderSummary");
            const orderHeaderText = document.getElementById("webOrderHeaderText");
            const orderForm = document.getElementById("webOrderForm");
            const orderSubmit = document.getElementById("webOrderSubmit");
            const orderNote = document.getElementById("webOrderNote");
            const cart = new Map();
            const apiBaseUrl = String(metadata.apiBaseUrl || "").replace(/\/+$/, "");
            const expiresAt = metadata.expiresAt ? new Date(metadata.expiresAt) : null;
            if (expiresAt && !Number.isNaN(expiresAt.getTime()) && Date.now() > expiresAt.getTime()) {
                expiredBanner.classList.add("web-expired-banner--visible");
            }
            if (!apiBaseUrl) {
                orderNote.textContent = "La API del hosting no esta configurada. El pedido no se enviara hasta que definas catalogos_api.";
                orderSubmit.disabled = true;
            }
            if (apiBaseUrl && metadata.slug) {
                fetch(apiBaseUrl + "/check_catalog.php?slug=" + encodeURIComponent(metadata.slug))
                    .then((response) => response.ok ? response.json() : null)
                    .then((result) => {
                        if (!result) return;
                        if (!result.ok || !result.catalog || result.catalog.status !== "active") {
                            expiredBanner.classList.add("web-expired-banner--visible");
                            orderSubmit.disabled = true;
                        }
                    })
                    .catch(() => {});
            }
            document.querySelectorAll("[data-item]").forEach((node) => {
                const item = node.getAttribute("data-item");
                const product = products.get(item);
                const mainImage = product && product.media ? String(product.media.mainImage || "") : "";
                if (!mainImage) return;
                const existingImage = node.querySelector("img.product-card__image, .campin1-hero__visual img, img");
                if (existingImage) {
                    existingImage.setAttribute("src", mainImage);
                    existingImage.setAttribute("loading", "lazy");
                    existingImage.classList.add("web-media-clickable");
                }
            });
            document.querySelectorAll("[data-item]").forEach((node) => {
                const item = node.getAttribute("data-item");
                const product = products.get(item);
                if (!product) return;
                const media = product && product.media ? product.media : null;
                const mainGallery = media && media.mainImage ? [String(media.mainImage)] : [];
                const extraGallery = media && Array.isArray(media.gallery) ? media.gallery.filter(Boolean).map(String) : [];
                const gallery = [...new Set([...mainGallery, ...extraGallery])];
                const video = media && media.video ? media.video : "";
                const hasViewerMedia = gallery.length > 0 || Boolean(video);
                const visualHost = node.querySelector(".product-card__image-wrap, .campin1-hero__visual, .showcase-card__visual, .industrial-card__visual, .minimal-card__visual, .editorial-card__visual, .horizontal-card__visual") || node;
                const orderInline = document.createElement("div");
                orderInline.className = "web-order-inline";
                const qtyInput = document.createElement("input");
                qtyInput.type = "number";
                qtyInput.min = "1";
                qtyInput.value = "1";
                qtyInput.className = "web-order-inline__qty";
                qtyInput.setAttribute("data-add-qty", item);
                const addButton = document.createElement("button");
                addButton.type = "button";
                addButton.className = "web-order-action";
                addButton.textContent = "Agregar";
                addButton.addEventListener("click", () => {
                    const qty = Math.max(1, Number(qtyInput.value) || 1);
                    addToOrder(product, qty);
                });
                orderInline.appendChild(qtyInput);
                orderInline.appendChild(addButton);
                visualHost.appendChild(orderInline);
                const clickableImage = node.querySelector("img.product-card__image, .campin1-hero__visual img, img");
                if (clickableImage && hasViewerMedia) {
                    clickableImage.setAttribute("title", video ? "Ver fotos y video" : gallery.length > 1 ? "Ver mas fotos" : "Ver foto");
                    clickableImage.setAttribute("role", "button");
                    clickableImage.setAttribute("tabindex", "0");
                    clickableImage.addEventListener("click", () => openMediaViewer(product, gallery, video));
                    clickableImage.addEventListener("keydown", (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openMediaViewer(product, gallery, video);
                        }
                    });
                }
                if (!hasViewerMedia) return;
                const button = document.createElement("button");
                button.type = "button";
                button.className = "web-media-trigger web-media-trigger--inline";
                button.textContent = video ? "Ver fotos y video" : gallery.length > 1 ? "Ver mas fotos" : "Ver foto";
                button.addEventListener("click", () => openMediaViewer(product, gallery, video));
                const mediaInline = document.createElement("div");
                mediaInline.className = "web-media-inline";
                const hint = document.createElement("span");
                hint.className = "web-media-hint";
                hint.textContent = gallery.length > 1 || video ? "Toca la imagen para ampliar" : "Toca para ver";
                mediaInline.appendChild(button);
                mediaInline.appendChild(hint);
                node.appendChild(mediaInline);
            });
            orderFloating.addEventListener("click", openOrderPanel);
            orderClose.addEventListener("click", closeOrderPanel);
            orderPanel.addEventListener("click", (event) => {
                if (event.target.matches("[data-remove-item]")) {
                    const item = event.target.getAttribute("data-remove-item");
                    cart.delete(item);
                    renderOrderSummary();
                }
                if (event.target.matches("[data-qty-item]")) {
                    const item = event.target.getAttribute("data-qty-item");
                    const input = orderSummary.querySelector('[data-qty-input="' + item + '"]');
                    if (!input) return;
                    const nextQty = Math.max(1, Number(input.value) || 1);
                    const current = cart.get(item);
                    if (!current) return;
                    current.quantity = nextQty;
                    renderOrderSummary();
                }
            });
            orderForm.addEventListener("submit", async (event) => {
                event.preventDefault();
                if (!apiBaseUrl) return;
                if (!cart.size) {
                    orderNote.textContent = "Agrega al menos un producto antes de enviar el pedido.";
                    return;
                }
                orderSubmit.disabled = true;
                orderNote.textContent = "Enviando pedido...";
                const payload = {
                    slug: metadata.slug || "",
                    customer_name: document.getElementById("webOrderCustomerName").value.trim(),
                    customer_email: document.getElementById("webOrderCustomerEmail").value.trim(),
                    customer_phone: document.getElementById("webOrderCustomerPhone").value.trim(),
                    comments: document.getElementById("webOrderComments").value.trim(),
                    items: Array.from(cart.values()).map((entry) => ({
                        item_code: entry.item,
                        description: entry.description,
                        quantity: entry.quantity,
                        price: entry.price
                    }))
                };
                try {
                    const response = await fetch(apiBaseUrl + "/submit_order.php", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                    const result = await response.json();
                    if (!response.ok || !result.ok) throw new Error(result && result.error ? result.error : "No se pudo enviar el pedido.");
                    cart.clear();
                    renderOrderSummary();
                    orderForm.reset();
                    orderNote.textContent = "Pedido enviado correctamente. Revisa tu correo para la confirmacion si aplica.";
                } catch (error) {
                    orderNote.textContent = "No se pudo enviar el pedido: " + error.message;
                } finally {
                    orderSubmit.disabled = !apiBaseUrl;
                }
            });
            renderOrderSummary();
            function openMediaViewer(product, gallery, video) {
                const items = gallery.map((src) => ({ type:"image", src }));
                if (video) items.push({ type:"video", src:video });
                if (!items.length) return;
                modal.classList.add("web-media-modal--open");
                modal.setAttribute("aria-hidden", "false");
                modalTitle.textContent = product.description || product.shortDescription || product.item || "Producto";
                modalSubtitle.textContent = [product.item ? "ITEM: " + product.item : "", product.price || "", product.available ? "Disponible: " + product.available : ""].filter(Boolean).join(" | ");
                renderMedia(items, 0);
            }
            function renderMedia(items, activeIndex) {
                modalFrame.innerHTML = "";
                modalThumbs.innerHTML = "";
                const active = items[activeIndex];
                const mainNode = active.type === "video" ? document.createElement("video") : document.createElement("img");
                if (active.type === "video") {
                    mainNode.src = active.src;
                    mainNode.controls = true;
                    mainNode.preload = "metadata";
                } else {
                    mainNode.src = active.src;
                    mainNode.alt = "Multimedia del producto";
                }
                modalFrame.appendChild(mainNode);
                items.forEach((item, index) => {
                    const thumb = document.createElement("button");
                    thumb.type = "button";
                    thumb.className = "web-media-modal__thumb" + (index === activeIndex ? " web-media-modal__thumb--active" : "");
                    const mediaNode = item.type === "video" ? document.createElement("video") : document.createElement("img");
                    mediaNode.src = item.src;
                    if (item.type === "video") mediaNode.muted = true;
                    thumb.appendChild(mediaNode);
                    thumb.addEventListener("click", () => renderMedia(items, index));
                    modalThumbs.appendChild(thumb);
                });
            }
            function closeModal() {
                modal.classList.remove("web-media-modal--open");
                modal.setAttribute("aria-hidden", "true");
                modalFrame.innerHTML = "";
                modalThumbs.innerHTML = "";
            }
            function addToOrder(product, quantity) {
                if (!product || !product.item) return;
                const qtyToAdd = Math.max(1, Number(quantity) || 1);
                if (!cart.has(product.item)) {
                    cart.set(product.item, {
                        item: product.item,
                        description: product.description || product.shortDescription || product.item,
                        price: product.price || "",
                        quantity: qtyToAdd
                    });
                } else {
                    cart.get(product.item).quantity += qtyToAdd;
                }
                renderOrderSummary();
                openOrderPanel();
            }
            function renderOrderSummary() {
                const entries = Array.from(cart.values());
                orderFloating.textContent = "Pedido (" + entries.reduce((sum, entry) => sum + entry.quantity, 0) + ")";
                orderSummary.innerHTML = entries.length
                    ? entries.map((entry) => '<article class="web-order-item"><h3>' + escapeHtmlJs(entry.description) + '</h3><p>ITEM: ' + escapeHtmlJs(entry.item) + (entry.price ? ' | ' + escapeHtmlJs(entry.price) : '') + '</p><div class="web-order-item__row"><input class="web-order-item__qty" data-qty-input="' + escapeHtmlJs(entry.item) + '" type="number" min="1" value="' + Number(entry.quantity || 1) + '"><button class="web-order-submit" data-qty-item="' + escapeHtmlJs(entry.item) + '" type="button">Actualizar</button><button class="web-order-panel__close" data-remove-item="' + escapeHtmlJs(entry.item) + '" type="button">x</button></div></article>').join("")
                    : '<p class="web-order-note">Aun no has agregado productos al pedido.</p>';
                orderHeaderText.textContent = entries.length ? "Productos seleccionados: " + entries.length : "Agrega productos desde el catalogo.";
            }
            function openOrderPanel() {
                orderPanel.classList.add("web-order-panel--open");
                orderPanel.setAttribute("aria-hidden", "false");
            }
            function closeOrderPanel() {
                orderPanel.classList.remove("web-order-panel--open");
                orderPanel.setAttribute("aria-hidden", "true");
            }
            modalClose.addEventListener("click", closeModal);
            modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
            window.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeModal(); closeOrderPanel(); } });
            function escapeHtmlJs(text) {
                return String(text || "")
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;");
            }
        })();
    </script>
</body>
</html>`;
}

function sanitizeSlug(value) {
    return String(value || "catalogo-publicable")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "catalogo-publicable";
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
