/**
 * Catálogo Rodeo B2B
 * Nombre actual/provisional del sistema.
 *
 * Autor principal: Nelson Sánchez
 * Año: 2026
 *
 * Sistema desarrollado para generación de catálogos digitales,
 * gestión visual de productos, publicación web y pedidos comerciales.
 *
 * Todos los derechos reservados.
 *
 * Nota:
 * Este encabezado documenta autoría y evolución del sistema.
 * No modifica el funcionamiento del código.
 */

const { app, BrowserWindow, dialog, ipcMain, nativeImage, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { execFile, spawn } = require("child_process");
const crypto = require("crypto");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);
const COVER_CANDIDATES = new Set(["cover", "portada"]);
const LOGO_CANDIDATES = new Set(["logo", "brand", "marca"]);
const SETTINGS_FILE_NAME = "settings.json";
const SECRET_SETTING_KEYS = new Set(["ftpPassword", "apiKey", "saasLicenseKey"]);
const IMAGE_STORAGE_ENV_KEYS = new Set(["IMAGE_STORAGE_MODE", "IMAGE_CDN_BASE_URL", "B2_BUCKET_NAME", "B2_KEY_ID", "B2_APPLICATION_KEY", "B2_ENDPOINT"]);
const BRAND_TEMPLATES_SOURCE_DIR = path.join(__dirname, "hosting", "assets", "brand_templates");
const GLOBAL_NO_PHOTO_SOURCE = path.join(__dirname, "hosting", "assets", "img", "no-photo-camera.svg");
const GLOBAL_RODEO_LOGO_SOURCE = path.join(__dirname, "hosting", "catalogos_admin", "assets", "logo-rodeo-azul.png");
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
    saasValidationEnabled: false,
    saasLicenseKey: "",
    saasCompanySlug: "",
    saasApiBaseUrl: "",
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

    ipcMain.handle("fs:find-images-for-items", async (_, payload = {}) => {
        return findImagesForItems(payload);
    });

    ipcMain.handle("report:save-missing-images", async (_, payload = {}) => {
        return saveMissingImagesReport(payload);
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

    ipcMain.handle("saas:validate-license", async (_, payload) => {
        return validateSaasLicense(payload);
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
        saasValidationEnabled: source.saasValidationEnabled === true,
        saasLicenseKey: String(source.saasLicenseKey || ""),
        saasCompanySlug: String(source.saasCompanySlug || "").trim(),
        saasApiBaseUrl: String(source.saasApiBaseUrl || "").trim().replace(/\/+$/, ""),
    };
}

async function validateSaasLicense(payload = {}) {
    const settings = normalizePublicationSettings(payload);
    const apiBaseUrl = settings.saasApiBaseUrl || settings.apiBaseUrl;
    const licenseKey = settings.saasLicenseKey;
    const companySlug = settings.saasCompanySlug;

    if (!apiBaseUrl || !licenseKey) {
        return {
            ok: false,
            allowedPublish: false,
            status: "not_configured",
            message: "Configura URL API y licencia SaaS.",
        };
    }

    try {
        const response = await fetch(`${apiBaseUrl}/validate_license.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                license_key: licenseKey,
                company_slug: companySlug,
                app_version: app.getVersion(),
                device_id: getDeviceId(),
            }),
        });
        const result = await response.json().catch(() => ({}));
        return {
            ok: response.ok && Boolean(result.success),
            allowedPublish: Boolean(result.allowed_publish),
            status: result.status || `http_${response.status}`,
            message: result.message || (response.ok ? "Respuesta recibida." : `Error HTTP ${response.status}.`),
            result,
        };
    } catch (error) {
        return {
            ok: false,
            allowedPublish: false,
            status: "network_error",
            message: error.message || "No se pudo validar la licencia SaaS.",
        };
    }
}

function getDeviceId() {
    const userData = app.getPath("userData");
    const idPath = path.join(userData, "device-id.txt");
    try {
        if (fs.existsSync(idPath)) {
            const existing = fs.readFileSync(idPath, "utf8").trim();
            if (existing) return existing;
        }
        fs.mkdirSync(userData, { recursive: true });
        const next = `desktop-${crypto.randomBytes(12).toString("hex")}`;
        fs.writeFileSync(idPath, next, "utf8");
        return next;
    } catch {
        return `desktop-${crypto.createHash("sha256").update(`${process.env.COMPUTERNAME || ""}:${process.env.USERNAME || ""}`).digest("hex").slice(0, 24)}`;
    }
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

function findImagesForItems(payload = {}) {
    const rootDir = String(payload.rootDir || "");
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const maxFiles = Math.max(1000, Math.min(Number(payload.maxFiles) || 250000, 1000000));
    const targetItems = new Map();

    rawItems.forEach((item) => {
        const raw = String(item || "").trim();
        const normalized = normalizeImageItemKey(raw);
        if (raw && normalized && !targetItems.has(normalized)) {
            targetItems.set(normalized, raw);
        }
    });

    if (!rootDir || !fs.existsSync(rootDir) || !targetItems.size) {
        return { matches: [], missingItems: rawItems, scannedFiles: 0, stoppedEarly: false };
    }

    const matchesByItem = new Map();
    const pending = [rootDir];
    let scannedFiles = 0;
    let stoppedEarly = false;

    while (pending.length && matchesByItem.size < targetItems.size) {
        const dirPath = pending.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                pending.push(fullPath);
                continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            if (!IMAGE_EXTENSIONS.has(ext)) continue;

            scannedFiles += 1;
            if (scannedFiles > maxFiles) {
                stoppedEarly = true;
                pending.length = 0;
                break;
            }

            const match = resolveImageItemMatchFromFile(entry.name, targetItems);
            const itemKey = match.itemKey;
            if (!itemKey) continue;

            const previousMatch = matchesByItem.get(itemKey);
            if (previousMatch && previousMatch.score >= match.score) continue;

            matchesByItem.set(itemKey, {
                item: targetItems.get(itemKey),
                normalizedItem: itemKey,
                filePath: fullPath,
                fileName: entry.name,
                score: match.score,
            });
        }
    }

    const missingItems = [];
    targetItems.forEach((rawItem, normalizedItem) => {
        if (!matchesByItem.has(normalizedItem)) {
            missingItems.push(rawItem);
        }
    });

    return {
        matches: Array.from(matchesByItem.values()),
        missingItems,
        scannedFiles,
        stoppedEarly,
    };
}

async function saveMissingImagesReport(payload = {}) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const format = String(payload.format || "txt").toLowerCase() === "excel" ? "excel" : "txt";
    const baseName = sanitizeSlug(payload.fileName || "reporte-imagenes-faltantes") || "reporte-imagenes-faltantes";
    const extension = format === "excel" ? "csv" : "txt";
    const result = await dialog.showSaveDialog(mainWindow, {
        title: format === "excel" ? "Guardar reporte para Excel" : "Guardar reporte TXT",
        defaultPath: `${baseName}.${extension}`,
        filters: format === "excel"
            ? [{ name: "Excel CSV", extensions: ["csv"] }]
            : [{ name: "Texto", extensions: ["txt"] }],
    });
    if (result.canceled || !result.filePath) {
        return { canceled: true, filePath: "" };
    }

    const content = format === "excel" ? buildMissingImagesCsv(rows, payload) : buildMissingImagesTxt(rows, payload);
    fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
    fs.writeFileSync(result.filePath, content, "utf8");
    return { canceled: false, filePath: result.filePath };
}

function buildMissingImagesTxt(rows, payload = {}) {
    const lines = [
        "Reporte de imagenes faltantes",
        `Catalogo: ${String(payload.catalogTitle || "")}`,
        `Fecha: ${new Date().toISOString()}`,
        `Total faltantes: ${rows.length}`,
        "",
        "ITEM | Marca | Categoria | Descripcion | Nombres sugeridos",
    ];
    rows.forEach((row) => {
        lines.push([
            row.item || "",
            row.brand || "",
            row.category || "",
            row.description || "",
            Array.isArray(row.expectedNames) ? row.expectedNames.join(", ") : "",
        ].join(" | "));
    });
    return lines.join("\r\n");
}

function buildMissingImagesCsv(rows, payload = {}) {
    const csvRows = [
        ["Reporte de imagenes faltantes"],
        ["Catalogo", String(payload.catalogTitle || "")],
        ["Fecha", new Date().toISOString()],
        ["Total faltantes", String(rows.length)],
        [],
        ["ITEM", "Marca", "Categoria", "Descripcion", "Nombres sugeridos"],
    ];
    rows.forEach((row) => {
        csvRows.push([
            row.item || "",
            row.brand || "",
            row.category || "",
            row.description || "",
            Array.isArray(row.expectedNames) ? row.expectedNames.join(", ") : "",
        ]);
    });
    return csvRows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function resolveImageItemKeyFromFile(fileName, targetItems) {
    return resolveImageItemMatchFromFile(fileName, targetItems).itemKey;
}

function resolveImageItemMatchFromFile(fileName, targetItems) {
    const ext = path.extname(fileName);
    const rawStem = path.basename(fileName, ext);
    const normalizedRaw = normalizeImageItemKey(rawStem);
    if (!normalizedRaw) return { itemKey: "", score: 0 };
    if (targetItems.has(normalizedRaw)) return { itemKey: normalizedRaw, score: 100 };

    const copyCleanRawStem = rawStem.replace(/\s*\(\d+\)\s*$/i, "");
    const cleanedRawStem = copyCleanRawStem
        .replace(/(?:[_\-\s](?:main|principal|gallery|galeria|extra|image|img|foto|photo|pic|web|edited|editada))(?:[_\-\s]?\d+)?$/i, "")
        .replace(/(?:[_\-\s]\d+)$/i, "");

    const copyCleanStem = normalizeImageItemKey(copyCleanRawStem);
    if (copyCleanStem && targetItems.has(copyCleanStem)) return { itemKey: copyCleanStem, score: 96 };

    const cleanedStem = normalizeImageItemKey(cleanedRawStem);
    if (cleanedStem && targetItems.has(cleanedStem)) return { itemKey: cleanedStem, score: 94 };

    const rawBoundary = normalizeBoundaryStem(copyCleanRawStem);
    const cleanedBoundary = normalizeBoundaryStem(cleanedRawStem);

    const sortedItems = Array.from(targetItems.keys()).sort((a, b) => b.length - a.length);
    for (const itemKey of sortedItems) {
        const itemBoundary = normalizeBoundaryStem(targetItems.get(itemKey));
        if (!itemBoundary) continue;
        if (rawBoundary === itemBoundary) return { itemKey, score: 92 };
        if (cleanedBoundary === itemBoundary) return { itemKey, score: 90 };
        if (!rawBoundary.startsWith(`${itemBoundary}-`)) continue;
        const suffix = rawBoundary.slice(itemBoundary.length + 1);
        if (isAllowedImageVariantSuffix(suffix)) return { itemKey, score: 82 };
    }

    return { itemKey: "", score: 0 };
}

function normalizeImageItemKey(value) {
    return normalizeStem(value);
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

function normalizeBoundaryStem(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

function isAllowedImageVariantSuffix(value) {
    const suffix = normalizeBoundaryStem(value);
    if (!suffix) return true;
    return /^(?:\d+|main|principal|gallery|galeria|extra|image|img|foto|photo|pic|web|edited|editada)(?:-\d+)?$/.test(suffix);
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

async function exportWebPackage(payload) {
    const slug = sanitizeSlug(payload?.slug || "catalogo-publicable");
    const outputRoot = payload?.outputDir;
    if (!outputRoot) throw new Error("No se indico carpeta de salida.");
    const packageDir = path.join(outputRoot, slug);
    resetExportPackageDir(packageDir, outputRoot);
    copyIfExists(path.join(__dirname, "hosting", "assets", "public-catalog.css"), path.join(packageDir, "assets", "public-catalog.css"));
    copyIfExists(path.join(__dirname, "hosting", "assets", "public-catalog.js"), path.join(packageDir, "assets", "public-catalog.js"));
    copyIfExists(GLOBAL_NO_PHOTO_SOURCE, path.join(packageDir, "assets", "img", "no-photo-camera.svg"));
    copyIfExists(GLOBAL_RODEO_LOGO_SOURCE, path.join(packageDir, "assets", "img", "logo-rodeo-azul.png"));
    const assets = Array.isArray(payload?.assets) ? payload.assets : [];
    assets.forEach((asset) => {
        if (asset?.uploadOnly) return;
        if (!asset?.sourcePath || !asset?.relativePath) return;
        const target = path.join(packageDir, asset.relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        copyWebAsset(asset.sourcePath, target);
    });
    const metadataWithTemplates = applyBrandTemplatesToPackage(payload?.metadata || {}, packageDir);
    const metadata = await prepareMetadataWithBackblazeImages(metadataWithTemplates, assets, slug, packageDir);
    fs.writeFileSync(path.join(packageDir, "catalog.json"), JSON.stringify(metadata, null, 2), "utf8");
    fs.writeFileSync(path.join(packageDir, "index.html"), buildWebExportHtml(payload?.snapshotHtml || "", metadata), "utf8");
    return { ok: true, outputDir: packageDir, slug };
}

async function publishCatalogPackage(payload, onProgress = () => {}) {
    onProgress({ phase: "exporting", percent: 8, completed: 0, total: 0, label: "" });
    const exportResult = await exportWebPackage(payload?.exportPayload || {});
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

    const apiPayload = {
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
        theme: publish.theme || {},
        legacy_pdf_url: publish.legacyPdfUrl || publish.pdfUrl || "",
        modern_pdf_url: publish.modernPdfUrl || "",
        notes: publish.notes || "",
        zip_name: zipFileName,
        status: "active",
    };

    if (hosting.saasValidationEnabled === true) {
        apiPayload.saas_validation_enabled = true;
        apiPayload.saas_license_key = String(hosting.saasLicenseKey || "");
        apiPayload.saas_company_slug = String(hosting.saasCompanySlug || "");
        apiPayload.saas_device_id = getDeviceId();
        apiPayload.saas_app_version = app.getVersion();
    }

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-KEY": String(hosting.apiKey || ""),
        },
        body: JSON.stringify(apiPayload),
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

function resetExportPackageDir(packageDir, outputRoot) {
    const resolvedRoot = path.resolve(outputRoot);
    const resolvedTarget = path.resolve(packageDir);
    const normalizedRoot = resolvedRoot.toLowerCase();
    const normalizedTarget = resolvedTarget.toLowerCase();
    if (normalizedTarget === normalizedRoot || !normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)) {
        throw new Error("Ruta de exportacion no segura para limpiar.");
    }
    if (fs.existsSync(resolvedTarget)) {
        fs.rmSync(resolvedTarget, { recursive: true, force: true });
    }
    fs.mkdirSync(resolvedTarget, { recursive: true });
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

function applyBrandTemplatesToPackage(metadata, packageDir) {
    const cloned = JSON.parse(JSON.stringify(metadata || {}));
    const products = Array.isArray(cloned.catalog) ? cloned.catalog : [];
    const detectedBrands = dedupeStrings([
        cloned.brandFilter,
        ...products.map((product) => product?.brand || product?.marca || ""),
    ]);
    const templates = {};

    products.forEach((product) => {
        const brand = String(product?.brand || product?.marca || "").trim();
        if (!brand) return;
        product.brandSlug = normalizeBrandTemplateSlug(brand);
    });

    detectedBrands.forEach((brand) => {
        const brandSlug = normalizeBrandTemplateSlug(brand);
        if (!brandSlug) return;
        const located = locateBrandTemplate(brand);
        if (!located) return;
        const { sourceDir, configPath, folderSlug } = located;
        const config = readBrandTemplateConfig(configPath, brand, brandSlug);
        if (!config) return;
        const targetDir = path.join(packageDir, "assets", "brand_templates", folderSlug);
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(configPath, path.join(targetDir, "config.json"));
        const resolved = { ...config, slug: brandSlug, brand: config.brand || brand };
        ["logo", "banner", "promo", "background", "placeholder"].forEach((field) => {
            const fileName = safeBrandTemplateFileName(config[field]);
            if (!fileName) {
                resolved[field] = "";
                return;
            }
            const sourcePath = path.join(sourceDir, fileName);
            if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
                resolved[field] = "";
                return;
            }
            fs.copyFileSync(sourcePath, path.join(targetDir, fileName));
            resolved[field] = `./assets/brand_templates/${folderSlug}/${fileName.replace(/\\/g, "/")}`;
        });
        templates[brandSlug] = resolved;
    });

    cloned.brandTemplates = {
        defaultPlaceholder: "./assets/img/no-photo-camera.svg",
        items: templates,
    };
    if (!Array.isArray(cloned.brands)) {
        const brands = dedupeStrings(products.map((product) => product?.brand || product?.marca || ""));
        cloned.brands = brands.sort((a, b) => a.localeCompare(b)).map((brand) => ({
            name: brand,
            slug: normalizeBrandTemplateSlug(brand),
        }));
    }
    if (typeof cloned.brandFilterEnabled !== "boolean") {
        cloned.brandFilterEnabled = Array.isArray(cloned.brands) && cloned.brands.length > 1;
    }
    if (!cloned.activeBrand && Array.isArray(cloned.brands) && cloned.brands.length === 1) {
        cloned.activeBrand = cloned.brands[0];
    }
    const activeSlug = cloned.activeBrand && cloned.activeBrand.slug ? cloned.activeBrand.slug : "";
    const activeTemplate = activeSlug ? templates[activeSlug] : null;
    if (!cloned.brandFilterEnabled && cloned.activeBrand) {
        const title = activeTemplate?.bannerTitle || cloned.activeBrand.name || cloned.title;
        if (title) {
            cloned.title = title;
            cloned.heroTitle = title;
        }
        if (activeTemplate?.logo && !cloned.logoUrl) {
            cloned.logoUrl = activeTemplate.logo;
        }
    }
    return cloned;
}

function locateBrandTemplate(brand) {
    if (!fs.existsSync(BRAND_TEMPLATES_SOURCE_DIR)) return null;
    const brandSlug = normalizeBrandTemplateSlug(brand);
    if (!brandSlug) return null;
    const exactDir = path.join(BRAND_TEMPLATES_SOURCE_DIR, brandSlug);
    const exactConfig = path.join(exactDir, "config.json");
    if (fs.existsSync(exactConfig)) {
        return { sourceDir: exactDir, configPath: exactConfig, folderSlug: brandSlug };
    }
    const entries = fs.readdirSync(BRAND_TEMPLATES_SOURCE_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    for (const entry of entries) {
        const folderSlug = normalizeBrandTemplateSlug(entry.name);
        const sourceDir = path.join(BRAND_TEMPLATES_SOURCE_DIR, entry.name);
        const configPath = path.join(sourceDir, "config.json");
        if (!folderSlug || !fs.existsSync(configPath)) continue;
        const config = readBrandTemplateConfig(configPath, brand, folderSlug);
        const configBrandSlug = normalizeBrandTemplateSlug(config?.brand || "");
        if (configBrandSlug && configBrandSlug === brandSlug) {
            return { sourceDir, configPath, folderSlug };
        }
    }
    for (const entry of entries) {
        const folderSlug = normalizeBrandTemplateSlug(entry.name);
        const sourceDir = path.join(BRAND_TEMPLATES_SOURCE_DIR, entry.name);
        const configPath = path.join(sourceDir, "config.json");
        if (!folderSlug || !fs.existsSync(configPath)) continue;
        const config = readBrandTemplateConfig(configPath, brand, folderSlug);
        const configBrandSlug = normalizeBrandTemplateSlug(config?.brand || "");
        if ((folderSlug.length >= 4 && brandSlug.includes(folderSlug)) || (configBrandSlug.length >= 4 && brandSlug.includes(configBrandSlug))) {
            return { sourceDir, configPath, folderSlug };
        }
    }
    return null;
}

function readBrandTemplateConfig(configPath, fallbackBrand, fallbackSlug) {
    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (!parsed || typeof parsed !== "object") return null;
        return {
            brand: String(parsed.brand || fallbackBrand || "").trim(),
            slug: normalizeBrandTemplateSlug(parsed.slug || fallbackSlug || fallbackBrand),
            primaryColor: sanitizeHexColor(parsed.primaryColor, ""),
            secondaryColor: sanitizeHexColor(parsed.secondaryColor, ""),
            textColor: sanitizeHexColor(parsed.textColor, ""),
            bannerTitle: String(parsed.bannerTitle || "").trim(),
            promoText: String(parsed.promoText || "").trim(),
            logo: parsed.logo || "",
            banner: parsed.banner || "",
            promo: parsed.promo || "",
            background: parsed.background || "",
            placeholder: parsed.placeholder || "",
        };
    } catch (error) {
        console.error(`No se pudo leer plantilla de marca ${configPath}:`, error);
        return null;
    }
}

function safeBrandTemplateFileName(value) {
    const normalized = String(value || "").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
    if (!normalized || normalized.includes("..")) return "";
    return normalized;
}

function normalizeBrandTemplateSlug(value) {
    return sanitizeSlug(value || "");
}

async function prepareMetadataWithBackblazeImages(metadata, assets, slug, packageDir) {
    const cloned = JSON.parse(JSON.stringify(metadata || {}));
    const storage = loadImageStorageSettings(cloned.imageStorage || {});
    const strictBackblaze = storage.mode === "backblaze";
    if (storage.mode === "hosting") {
        stripBackblazeUploadHintsFromMetadata(cloned);
        return cloned;
    }
    if (!storage.bucketName || !storage.keyId || !storage.applicationKey || !storage.endpoint || !storage.cdnBaseUrl) {
        appendBackblazeUploadLog(packageDir, "Configuracion B2 incompleta. No se pueden subir imagenes a Backblaze.");
        if (strictBackblaze) {
            throw new Error("Configuracion Backblaze incompleta. Revisa IMAGE_CDN_BASE_URL, B2_BUCKET_NAME, B2_KEY_ID, B2_APPLICATION_KEY y B2_ENDPOINT.");
        }
        stripBackblazeUploadHintsFromMetadata(cloned);
        return cloned;
    }

    const uploadTargets = collectBackblazeUploadTargets(cloned, assets, slug);
    if (!uploadTargets.length) {
        appendBackblazeUploadLog(packageDir, "No hay imagenes locales de catalogo para subir a B2.");
        if (strictBackblaze) {
            throw new Error("No hay imagenes locales preparadas para subir a Backblaze. Revisa que el Excel tenga ITEM y que las imagenes esten indexadas.");
        }
        stripBackblazeUploadHintsFromMetadata(cloned);
        return cloned;
    }

    const remoteByRelativePath = new Map();
    const uploadErrors = [];
    for (const target of uploadTargets) {
        try {
            const result = await uploadBackblazeObjectIfMissing(storage, target.sourcePath, target.objectKey);
            const remoteUrl = joinUrl(storage.cdnBaseUrl, target.objectKey);
            remoteByRelativePath.set(normalizeRelativeCatalogPath(target.relativePath), remoteUrl);
            appendBackblazeUploadLog(packageDir, `${result.skipped ? "EXISTE" : "SUBIDA"} ${target.relativePath} -> ${remoteUrl}`);
        } catch (error) {
            uploadErrors.push(`${target.relativePath}: ${error.message}`);
            appendBackblazeUploadLog(packageDir, `ERROR ${target.relativePath}: ${error.message}`);
        }
    }

    if (strictBackblaze && uploadErrors.length) {
        throw new Error(`No se pudieron subir ${uploadErrors.length} imagen(es) a Backblaze. Revisa logs/backblaze-upload.log.`);
    }

    applyBackblazeUrlsToMetadata(cloned, remoteByRelativePath, storage.mode);
    stripBackblazeUploadHintsFromMetadata(cloned);
    return cloned;
}

function loadImageStorageSettings(requested = {}) {
    const env = loadProjectEnvFile();
    const requestedMode = normalizeImageStorageMode(requested?.mode);
    const envMode = normalizeImageStorageMode(env.IMAGE_STORAGE_MODE);
    const mode = requestedMode || envMode || "hosting";
    return {
        mode,
        cdnBaseUrl: sanitizeBaseUrl(env.IMAGE_CDN_BASE_URL || ""),
        bucketName: String(env.B2_BUCKET_NAME || "").trim(),
        keyId: String(env.B2_KEY_ID || "").trim(),
        applicationKey: String(env.B2_APPLICATION_KEY || "").trim(),
        endpoint: sanitizeBaseUrl(env.B2_ENDPOINT || ""),
    };
}

function normalizeImageStorageMode(value) {
    const mode = String(value || "").toLowerCase();
    return ["hosting", "backblaze", "hybrid"].includes(mode) ? mode : "";
}

function loadProjectEnvFile() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return {};
    const parsed = {};
    const content = fs.readFileSync(envPath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex < 0) return;
        const key = trimmed.slice(0, equalsIndex).trim();
        if (!IMAGE_STORAGE_ENV_KEYS.has(key)) return;
        let value = trimmed.slice(equalsIndex + 1).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        parsed[key] = value;
    });
    return parsed;
}

function collectBackblazeUploadTargets(metadata, assets, slug) {
    const sourceByRelativePath = new Map();
    (assets || []).forEach((asset) => {
        if (!asset?.sourcePath || !asset?.relativePath || !fs.existsSync(asset.sourcePath)) return;
        if (!isBackblazeCatalogImage(asset.relativePath)) return;
        sourceByRelativePath.set(normalizeRelativeCatalogPath(asset.relativePath), asset.sourcePath);
    });

    const products = Array.isArray(metadata?.catalog) ? metadata.catalog : [];
    const targets = [];
    products.forEach((product, index) => {
        const media = product.media && typeof product.media === "object" ? product.media : {};
        collectLocalMediaPaths(media).forEach((localPath) => {
            const relativePath = normalizeRelativeCatalogPath(localPath);
            const sourcePath = sourceByRelativePath.get(relativePath);
            if (!sourcePath) return;
            targets.push({
                sourcePath,
                relativePath,
                objectKey: buildBackblazeObjectKey(slug, product, relativePath, index),
            });
        });
    });

    const seen = new Set();
    return targets.filter((target) => {
        const key = `${target.sourcePath}|${target.objectKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function isBackblazeCatalogImage(relativePath) {
    const normalized = normalizeRelativeCatalogPath(relativePath);
    return normalized.startsWith("media/main/") || normalized.startsWith("media/extra/");
}

function collectLocalMediaPaths(media) {
    const paths = [];
    if (media.localUploadImage) paths.push(media.localUploadImage);
    if (Array.isArray(media.localUploadGallery)) paths.push(...media.localUploadGallery);
    if (media.mainImage) paths.push(media.mainImage);
    if (Array.isArray(media.mainImageCandidates)) paths.push(...media.mainImageCandidates);
    if (Array.isArray(media.gallery)) paths.push(...media.gallery);
    if (Array.isArray(media.galleryCandidateGroups)) {
        media.galleryCandidateGroups.forEach((group) => {
            if (Array.isArray(group)) paths.push(...group);
        });
    }
    return paths.filter((value) => String(value || "").startsWith("./"));
}

function buildBackblazeObjectKey(slug, product, relativePath, index) {
    const fileName = buildBackblazeObjectFileName(relativePath, index);
    const folders = [sanitizeSlug(slug) || "catalogo"].filter(Boolean);
    return [...folders, fileName].join("/");
}

function buildBackblazeObjectFileName(relativePath, index) {
    const ext = path.posix.extname(normalizeRelativeCatalogPath(relativePath)).toLowerCase() || ".jpg";
    const baseName = sanitizeBackblazeFileBaseName(path.posix.basename(normalizeRelativeCatalogPath(relativePath), ext)) || `item-${index + 1}`;
    return `${baseName}${ext}`;
}

function sanitizeBackblazeFileBaseName(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/[\\/]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
}

function applyBackblazeUrlsToMetadata(metadata, remoteByRelativePath, mode) {
    if (!remoteByRelativePath.size || !Array.isArray(metadata?.catalog)) return;
    metadata.imageStorage = {
        mode,
        provider: "backblaze-b2",
        updatedAt: new Date().toISOString(),
    };
    metadata.catalog.forEach((product) => {
        const media = product.media && typeof product.media === "object" ? product.media : {};
        const mainRemoteUrl = remoteUrlForLocalMediaPath(media.localUploadImage || media.mainImage || "", remoteByRelativePath);
        const galleryRemoteUrls = Array.isArray(media.localUploadGallery)
            ? media.localUploadGallery.map((localPath) => remoteUrlForLocalMediaPath(localPath, remoteByRelativePath)).filter(Boolean)
            : [];
        if (!mainRemoteUrl && !galleryRemoteUrls.length) return;
        const remoteUrl = mainRemoteUrl || galleryRemoteUrls[0];
        product.remote_image_url = remoteUrl;
        product.remoteImageUrl = remoteUrl;
        media.remote_image_url = remoteUrl;
        media.imageStorageMode = mode === "backblaze" ? "backblaze" : "hybrid";
        if (mainRemoteUrl) {
            media.mainImageCandidates = mergeImageCandidates(mainRemoteUrl, media.mainImageCandidates || [], mode);
            if (!media.mainImage || mode === "backblaze") media.mainImage = mainRemoteUrl;
        }
        if (galleryRemoteUrls.length) {
            media.gallery = mode === "backblaze" ? galleryRemoteUrls : dedupeStrings([...galleryRemoteUrls, ...(media.gallery || [])]);
            media.galleryCandidateGroups = mergeGalleryCandidateGroups(galleryRemoteUrls, media.galleryCandidateGroups || [], mode);
        }
        product.media = media;
    });
}

function remoteUrlForLocalMediaPath(localPath, remoteByRelativePath) {
    const normalized = normalizeRelativeCatalogPath(localPath);
    return normalized ? (remoteByRelativePath.get(normalized) || "") : "";
}

function stripBackblazeUploadHintsFromMetadata(metadata) {
    if (!Array.isArray(metadata?.catalog)) return;
    metadata.catalog.forEach((product) => {
        const media = product.media && typeof product.media === "object" ? product.media : null;
        if (!media) return;
        delete media.localUploadImage;
        delete media.localUploadGallery;
    });
}

function mergeImageCandidates(remoteUrl, currentCandidates, mode = "hybrid") {
    const candidates = currentCandidates || [];
    return mode === "backblaze" ? dedupeStrings([remoteUrl]) : dedupeStrings([remoteUrl, ...candidates]);
}

function mergeGalleryCandidateGroups(remoteUrls, currentGroups, mode = "hybrid") {
    return remoteUrls.map((remoteUrl, index) => {
        const existingGroup = Array.isArray(currentGroups[index]) ? currentGroups[index] : [];
        return mode === "backblaze" ? [remoteUrl] : dedupeStrings([remoteUrl, ...existingGroup]);
    });
}

async function uploadBackblazeObjectIfMissing(storage, sourcePath, objectKey) {
    const head = await signedBackblazeRequest(storage, "HEAD", objectKey);
    if (head.status === 200) return { skipped: true };
    if (head.status !== 404 && head.status !== 403) {
        throw new Error(`HEAD B2 respondio ${head.status}`);
    }

    const body = fs.readFileSync(sourcePath);
    const put = await signedBackblazeRequest(storage, "PUT", objectKey, body, {
        "content-type": contentTypeForPath(sourcePath),
    });
    if (!put.ok) {
        const text = await put.text().catch(() => "");
        throw new Error(`PUT B2 respondio ${put.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
    }
    return { skipped: false };
}

async function signedBackblazeRequest(storage, method, objectKey, body = null, extraHeaders = {}) {
    const endpoint = new URL(storage.endpoint);
    const host = endpoint.host;
    const region = parseBackblazeRegion(host);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = body ? sha256Hex(body) : sha256Hex("");
    const canonicalUri = `/${encodeS3PathSegment(storage.bucketName)}/${encodeS3ObjectKey(objectKey)}`;
    const headers = {
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        ...extraHeaders,
    };
    const signedHeaders = Object.keys(headers).map((key) => key.toLowerCase()).sort();
    const canonicalHeaders = signedHeaders.map((key) => `${key}:${String(headers[key]).trim()}\n`).join("");
    const canonicalRequest = [
        method,
        canonicalUri,
        "",
        canonicalHeaders,
        signedHeaders.join(";"),
        payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join("\n");
    const signature = hmacHex(getAwsSigningKey(storage.applicationKey, dateStamp, region, "s3"), stringToSign);
    const authorization = `AWS4-HMAC-SHA256 Credential=${storage.keyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
    return fetch(`${endpoint.origin}${canonicalUri}`, {
        method,
        headers: {
            ...headers,
            Authorization: authorization,
        },
        body,
    });
}

function parseBackblazeRegion(host) {
    const match = String(host || "").match(/s3[.-]([a-z0-9-]+)\./i);
    return match ? match[1] : "us-east-005";
}

function getAwsSigningKey(secret, dateStamp, region, service) {
    const kDate = hmacBuffer(`AWS4${secret}`, dateStamp);
    const kRegion = hmacBuffer(kDate, region);
    const kService = hmacBuffer(kRegion, service);
    return hmacBuffer(kService, "aws4_request");
}

function hmacBuffer(key, data) {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function hmacHex(key, data) {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
}

function sha256Hex(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

function formatAmzDate(date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function encodeS3PathSegment(value) {
    return encodeURIComponent(String(value || "")).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeS3ObjectKey(value) {
    return String(value || "").split("/").map(encodeS3PathSegment).join("/");
}

function normalizeRelativeCatalogPath(value) {
    return String(value || "").replace(/\\/g, "/").replace(/^\.?\//, "").replace(/^\/+/, "");
}

function sanitizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
}

function joinUrl(baseUrl, objectKey) {
    return `${sanitizeBaseUrl(baseUrl)}/${String(objectKey || "").replace(/^\/+/, "")}`;
}

function contentTypeForPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    if (ext === ".svg") return "image/svg+xml";
    return "image/jpeg";
}

function appendBackblazeUploadLog(packageDir, message) {
    try {
        const logDir = path.join(packageDir, "logs");
        fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(path.join(logDir, "backblaze-upload.log"), `[${new Date().toISOString()}] ${message}\n`, "utf8");
    } catch (error) {
        console.error("No se pudo escribir log de Backblaze.", error);
    }
}

function dedupeStrings(values) {
    return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
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
    const metadataPayload = metadata?.localPreview === true
        ? { ...(metadata || {}) }
        : { ...(metadata || {}), catalog: [] };
    const safeMetadata = JSON.stringify(metadataPayload);
    const themeStyle = buildPublicCatalogThemeStyle(metadata?.theme);
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
    ${themeStyle ? `<style>${themeStyle}</style>` : ""}
</head>
<body class="catalog-locked">
    <div class="network-banner" id="networkBanner" hidden></div>
    <div class="expired" id="expiredOverlay"><div class="expired__card"><h1>Este catalogo ya no esta disponible</h1><p>Solicita a tu vendedor un enlace actualizado para continuar comprando.</p></div></div>
    <div class="catalog-shell">
        <header class="catalog-header">
            <div class="catalog-header__top">
                <div class="catalog-brand">
                    <img class="catalog-brand__logo" id="catalogLogo" alt="Logo">
                    <div>
                        <h1 id="catalogBrandTitle">${escapeHtml(metadata?.title || "Catalogo comercial")}</h1>
                        <p id="catalogBrandSubtitle">${escapeHtml(metadata?.footerText ?? "Experiencia mayorista B2B")}</p>
                    </div>
                </div>
                <div class="catalog-meta">
                    <span class="catalog-chip" id="sellerReference">Vendedor: General</span>
                    <span class="catalog-chip" id="clientReference">Cliente: enlace seguro requerido</span>
                    <span class="catalog-chip" id="queueIndicator">Sin pedidos pendientes</span>
                </div>
            </div>
            <div class="catalog-header__bottom" style="margin-top:14px;">
                <label class="catalog-search"><span>Buscar</span><input id="catalogSearch" type="search" placeholder="SKU, descripcion, marca o categoria"></label>
                <div class="catalog-header__filters"><div class="filters" id="categoryFilters"></div></div>
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
            <aside class="panel"><h3>Acceso rapido</h3><p class="status-note" id="resultCount"></p><div id="featuredBrandsMount"></div></aside>
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
                    <button class="checkout-button" id="checkoutButton" type="submit">Revisar pedido</button>
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

function buildPublicCatalogThemeStyle(theme) {
    const primary = sanitizeHexColor(theme?.primaryColor, "");
    const secondary = sanitizeHexColor(theme?.secondaryColor, "");
    if (!primary && !secondary) return "";
    const values = [];
    if (primary) {
        values.push(`--primary:${primary}`);
        values.push(`--accent:${primary}`);
        values.push(`--primary-rgb:${hexToRgbString(primary)}`);
    }
    if (secondary) {
        values.push(`--primary-strong:${secondary}`);
        values.push(`--accent-strong:${secondary}`);
        values.push(`--text:${secondary}`);
        values.push(`--primary-strong-rgb:${hexToRgbString(secondary)}`);
    }
    return `:root{${values.join(";")};}`;
}

function sanitizeHexColor(value, fallback) {
    const normalized = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function hexToRgbString(hex) {
    const normalized = sanitizeHexColor(hex, "");
    if (!normalized) return "";
    const value = normalized.slice(1);
    return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16),
    ].join(", ");
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
