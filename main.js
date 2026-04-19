const { app, BrowserWindow, dialog, ipcMain, nativeImage, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { execFile, spawn } = require("child_process");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);
const COVER_CANDIDATES = new Set(["cover", "portada"]);
const LOGO_CANDIDATES = new Set(["logo", "brand", "marca"]);
const SETTINGS_FILE_NAME = "settings.json";
const SECRET_SETTING_KEYS = new Set(["ftpPassword", "apiKey"]);
const DEFAULT_PUBLICATION_SETTINGS = {
    autoSave: true,
    protocol: "ftp",
    ftpHost: "",
    ftpPort: 21,
    ftpUser: "",
    ftpPassword: "",
    remoteDir: "",
    apiKey: "",
    publicBaseUrl: "",
    apiBaseUrl: "",
};

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

    ipcMain.handle("hosting:test-connection", async (_, payload) => {
        return testFtpConnection(payload);
    });

    ipcMain.handle("settings:load-publication", async () => {
        const result = loadPublicationSettings();
        return { ...result, path: getSettingsFilePath() };
    });

    ipcMain.handle("settings:save-publication", async (_, payload) => {
        const settings = normalizePublicationSettings(payload);
        savePublicationSettings(settings);
        return { ok: true, settings, path: getSettingsFilePath() };
    });

    ipcMain.handle("settings:clear-publication", async () => {
        const settingsPath = getSettingsFilePath();
        if (fs.existsSync(settingsPath)) {
            fs.unlinkSync(settingsPath);
        }
        return { ok: true, settings: { ...DEFAULT_PUBLICATION_SETTINGS }, path: settingsPath };
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

function getSettingsFilePath() {
    return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

function loadPublicationSettings() {
    const settingsPath = getSettingsFilePath();
    if (!fs.existsSync(settingsPath)) {
        return { settings: { ...DEFAULT_PUBLICATION_SETTINGS }, encrypted: false };
    }

    try {
        const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        const settings = normalizePublicationSettings(raw);
        const encryptedSecrets = raw?.encryptedSecrets && typeof raw.encryptedSecrets === "object" ? raw.encryptedSecrets : {};
        Object.entries(encryptedSecrets).forEach(([key, encryptedValue]) => {
            if (!SECRET_SETTING_KEYS.has(key) || !encryptedValue) return;
            const decrypted = decryptSettingSecret(encryptedValue);
            if (decrypted !== null) {
                settings[key] = decrypted;
            }
        });
        return { settings, encrypted: Boolean(raw?.encryptedSecrets) };
    } catch (error) {
        console.error("No se pudo cargar settings.json", error);
        return { settings: { ...DEFAULT_PUBLICATION_SETTINGS }, encrypted: false, error: error.message };
    }
}

function savePublicationSettings(settings) {
    const normalized = normalizePublicationSettings(settings);
    const filePayload = { ...normalized };
    const encryptedSecrets = {};

    SECRET_SETTING_KEYS.forEach((key) => {
        const value = String(normalized[key] || "");
        filePayload[key] = "";
        if (!value) return;
        const encrypted = encryptSettingSecret(value);
        if (encrypted) {
            encryptedSecrets[key] = encrypted;
        } else {
            filePayload[key] = value;
        }
    });

    if (Object.keys(encryptedSecrets).length) {
        filePayload.encryptedSecrets = encryptedSecrets;
    }

    const settingsPath = getSettingsFilePath();
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(filePayload, null, 2), "utf8");
}

function normalizePublicationSettings(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return {
        autoSave: source.autoSave !== false,
        protocol: source.protocol === "ftps" ? "ftps" : "ftp",
        ftpHost: String(source.ftpHost || ""),
        ftpPort: Number(source.ftpPort || DEFAULT_PUBLICATION_SETTINGS.ftpPort) || DEFAULT_PUBLICATION_SETTINGS.ftpPort,
        ftpUser: String(source.ftpUser || ""),
        ftpPassword: String(source.ftpPassword || ""),
        remoteDir: String(source.remoteDir ?? ""),
        apiKey: String(source.apiKey || ""),
        publicBaseUrl: String(source.publicBaseUrl || "").trim().replace(/\/+$/, ""),
        apiBaseUrl: String(source.apiBaseUrl || "").trim().replace(/\/+$/, ""),
    };
}

function encryptSettingSecret(value) {
    try {
        if (!safeStorage?.isEncryptionAvailable?.()) return "";
        return safeStorage.encryptString(String(value)).toString("base64");
    } catch (error) {
        console.error("No se pudo cifrar un secreto local.", error);
        return "";
    }
}

function decryptSettingSecret(value) {
    try {
        if (!safeStorage?.isEncryptionAvailable?.()) return null;
        return safeStorage.decryptString(Buffer.from(String(value), "base64"));
    } catch (error) {
        console.error("No se pudo descifrar un secreto local.", error);
        return null;
    }
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
    copyIfExists(path.join(__dirname, "hosting", "assets", "public-catalog.css"), path.join(packageDir, "assets", "public-catalog.css"));
    copyIfExists(path.join(__dirname, "hosting", "assets", "public-catalog.js"), path.join(packageDir, "assets", "public-catalog.js"));
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
        protocol: hosting.protocol || "ftp",
        ftpHost: hosting.ftpHost,
        ftpPort: hosting.ftpPort || 21,
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
            template: publish.template || "b2b-modern",
            public_url: publicUrl,
            pdf_url: publish.pdfUrl || "",
            expires_at: publish.expiresAt || "",
            seller_name: publish.sellerName || "",
        client_name: publish.clientName || "",
        hero_title: publish.title || slug,
        hero_subtitle: "Catalogo comercial B2B publicado desde la plataforma Rodeo.",
        promo_title: publish.promoTitle || "",
        promo_text: publish.promoText || "",
        promo_image_url: publish.promoImageUrl || "",
        promo_video_url: publish.promoVideoUrl || "",
        promo_link_url: publish.promoLinkUrl || "",
        promo_link_label: publish.promoLinkLabel || "",
        currency: "USD",
        legacy_pdf_url: publish.legacyPdfUrl || publish.pdfUrl || "",
        modern_pdf_url: publish.modernPdfUrl || "",
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

async function uploadFileViaPowerShellFtp({ localFile, protocol = "ftp", ftpHost, ftpPort = 21, ftpUser, ftpPassword, remoteDir, remoteFileName, onProgress = () => {} }) {
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
$protocol = ${psSingleQuote(protocol === "ftps" ? "ftps" : "ftp")}
$ftpHost = ${psSingleQuote(ftpHost)}
$ftpPort = ${Number(ftpPort) || 21}
$ftpUser = ${psSingleQuote(ftpUser)}
$ftpPassword = ${psSingleQuote(ftpPassword)}
$sourceFile = ${psSingleQuote(localFile)}
$destinationPath = ${psSingleQuote(destinationPath)}
$enableSsl = $protocol -eq 'ftps'

function New-FtpDirectoryRecursive {
    param([string]$TargetPath)
    $parts = $TargetPath -split '/'
    $current = ''
    foreach ($part in $parts) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $current = "$current/$part"
        $uri = [System.Uri]("ftp://$ftpHost\`:$ftpPort$current")
        try {
            $request = [System.Net.FtpWebRequest]::Create($uri)
            $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
            $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
            $request.UseBinary = $true
            $request.UsePassive = $true
            $request.KeepAlive = $false
            $request.EnableSsl = $enableSsl
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
$uri = [System.Uri]("ftp://$ftpHost\`:$ftpPort/$destinationPath")
function Invoke-FtpUpload {
    param([bool]$UsePassive)
    $request = [System.Net.FtpWebRequest]::Create($uri)
    $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
    $request.UseBinary = $true
    $request.UsePassive = $UsePassive
    $request.KeepAlive = $false
    $request.EnableSsl = $enableSsl
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

async function testFtpConnection({ protocol = "ftp", ftpHost, ftpPort = 21, ftpUser, ftpPassword, remoteDir = "" } = {}) {
    if (!ftpHost || !ftpUser || !ftpPassword) {
        return { ok: false, error: "Faltan host, usuario o clave FTP." };
    }

    const remoteBase = sanitizeRemoteDir(remoteDir);
    const targetPath = remoteBase ? `${remoteBase}/` : "";
    const script = `
$ErrorActionPreference = 'Stop'
$protocol = ${psSingleQuote(protocol === "ftps" ? "ftps" : "ftp")}
$ftpHost = ${psSingleQuote(ftpHost)}
$ftpPort = ${Number(ftpPort) || 21}
$ftpUser = ${psSingleQuote(ftpUser)}
$ftpPassword = ${psSingleQuote(ftpPassword)}
$targetPath = ${psSingleQuote(targetPath)}
$enableSsl = $protocol -eq 'ftps'
$uri = [System.Uri]("ftp://$ftpHost\`:$ftpPort/$targetPath")
$request = [System.Net.FtpWebRequest]::Create($uri)
$request.Method = [System.Net.WebRequestMethods+Ftp]::ListDirectory
$request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
$request.UseBinary = $true
$request.UsePassive = $true
$request.KeepAlive = $false
$request.EnableSsl = $enableSsl
$request.Timeout = 30000
$response = $request.GetResponse()
$response.Close()
Write-Output "OK"
`;

    try {
        await runPowerShellScript(script);
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message || "No se pudo conectar por FTP." };
    }
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
    <link rel="stylesheet" href="./assets/public-catalog.css">
</head>
<body>
    <div class="network-banner" id="networkBanner" hidden></div>
    <div class="expired" id="expiredOverlay"><div class="expired__card"><h1>Este catalogo ya no esta disponible</h1><p>Solicita a tu vendedor un enlace actualizado para continuar comprando.</p></div></div>
    <div class="catalog-shell">
        <header class="catalog-header">
            <div class="catalog-header__top">
                <div class="catalog-brand">
                    <img class="catalog-brand__logo" id="catalogLogo" alt="Logo">
                    <div>
                        <h1 id="catalogBrandTitle">${escapeHtml(metadata?.title || "Catalogo comercial")}</h1>
                        <p id="catalogBrandSubtitle">${escapeHtml(metadata?.footerText || "Experiencia mayorista B2B")}</p>
                    </div>
                </div>
                <div class="catalog-meta">
                    <span class="catalog-chip" id="sellerReference">Vendedor: General</span>
                    <span class="catalog-chip" id="clientReference">Cliente: Acceso libre</span>
                    <span class="catalog-chip" id="queueIndicator">Sin pedidos pendientes</span>
                </div>
            </div>
            <div class="catalog-header__bottom" style="margin-top:14px;">
                <label class="catalog-search"><span>Buscar</span><input id="catalogSearch" type="search" placeholder="SKU, descripcion, marca o categoria"></label>
                <div class="exports-panel" id="exportsPanel"></div>
                <button class="catalog-cart-button" id="cartButton" type="button">Carrito <span class="cart-badge" id="cartBadge">0</span></button>
            </div>
        </header>
        <section class="hero">
            <div class="hero-card">
                <h2 id="heroTitle">${escapeHtml(metadata?.heroTitle || metadata?.title || "Catalogo comercial")}</h2>
                <p id="heroSubtitle">${escapeHtml(metadata?.heroSubtitle || "Selecciona productos, revisa empaques y registra tu pedido empresarial.")}</p>
                <div class="hero-card__highlights"><div class="hero-highlight">Mayorista B2B</div><div class="hero-highlight">Pedidos trazables</div><div class="hero-highlight">Excel operativo</div></div>
            </div>
            <aside class="panel"><h3>Acceso rapido</h3><div class="filters" id="categoryFilters"></div><p class="status-note" id="resultCount"></p></aside>
        </section>
        <section class="promo-block" id="promoBlock" hidden>
            <div class="promo-copy">
                <p class="promo-kicker">Promocion configurable</p>
                <h2 id="promoTitle">Promocion comercial</h2>
                <p id="promoText">Configura una imagen o video liviano desde la app o el panel admin.</p>
                <div class="promo-actions" id="promoActions"></div>
            </div>
            <div class="promo-media" id="promoMedia"></div>
        </section>
        <section class="catalog-layout">
            <div class="catalog-results" id="productGrid"></div>
            <div class="cart-drawer-backdrop" id="cartDrawerBackdrop"></div>
            <aside class="drawer" id="cartDrawer" aria-label="Carrito de pedido">
                <div class="drawer__header"><h3>Carrito y pedido</h3><button class="drawer__close" id="cartClose" type="button">x</button></div>
                <div id="cartLines"></div>
                <div class="cart-summary" id="cartSummary"></div>
                <form class="checkout-form" id="checkoutForm">
                    <input id="companyName" type="text" placeholder="Empresa" required>
                    <input id="contactName" type="text" placeholder="Contacto" required>
                    <input id="contactPhone" type="text" placeholder="Telefono" required>
                    <input id="contactEmail" type="email" placeholder="Correo">
                    <input id="addressZone" type="text" placeholder="Direccion o zona">
                    <textarea id="comments" placeholder="Observaciones"></textarea>
                    <button class="checkout-button" id="checkoutButton" type="submit">Enviar pedido</button>
                </form>
                <div class="drawer__actions" style="margin-top:12px;"><button class="button-secondary" id="continueShoppingButton" type="button">Seguir comprando</button></div>
                <p class="status-note" id="checkoutStatus">Completa el formulario para registrar el pedido comercial.</p>
            </aside>
        </section>
    </div>
    <div class="overlay" id="detailOverlay">
        <div class="modal-card">
            <div class="toolbar"><div><strong id="detailTitle">Producto</strong><div class="muted" id="detailSubtitle"></div></div><button id="detailClose" type="button">Cerrar</button></div>
            <div class="modal-gallery"><div class="modal-stage" id="detailStage"></div><div class="thumbs" id="detailThumbs"></div></div>
            <div class="modal-content">
                <div class="detail-specs" id="detailSpecs"></div>
                <aside class="calculator">
                    <strong>Calculadora mayorista</strong>
                    <div class="qty-controls" style="margin-top:12px;"><button id="calcMinus" type="button">-</button><input id="calcQty" type="number" min="1" value="1"><button id="calcPlus" type="button">+</button></div>
                    <div class="calculator-breakdown" id="calcBreakdown"></div>
                    <button class="button-primary" id="calcAdd" type="button">Agregar al carrito</button>
                </aside>
            </div>
        </div>
    </div>
    <script id="catalogMeta" type="application/json">${safeMetadata}</script>
    <script src="./assets/public-catalog.js"></script>
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
