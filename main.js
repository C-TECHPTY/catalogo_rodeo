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
const ExcelJS = require("exceljs");
let autoUpdater = null;
try {
    ({ autoUpdater } = require("electron-updater"));
} catch (error) {
    // La app sigue funcionando en desarrollo aunque aun no se haya instalado
    // la dependencia del actualizador.
    console.warn("Actualizador no disponible:", error.message);
}

// Algunos controladores de video de Windows no pueden iniciar el proceso GPU de Chromium.
// Electron debe cambiar a renderizado por software antes de crear cualquier ventana.
app.disableHardwareAcceleration();

configureAppStorage();

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);
const COVER_CANDIDATES = new Set(["cover", "portada"]);
const LOGO_CANDIDATES = new Set(["logo", "brand", "marca"]);
const SETTINGS_FILE_NAME = "settings.json";
const IMAGE_INDEX_FILE_NAME = "image-index.json";
const ORDER_IMAGE_INDEX_FILE_NAME = "order-image-index.json";
const SECRET_SETTING_KEYS = new Set(["ftpPassword", "apiKey", "saasLicenseKey", "b2ApplicationKey"]);
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
    b2CdnBaseUrl: "",
    b2BucketName: "",
    b2KeyId: "",
    b2ApplicationKey: "",
    b2Endpoint: "",
};

let mainWindow = null;
let updateDownloadInProgress = false;
let updatePromptVisible = false;

function updateStatusPayload(status, details = {}) {
    return { status, version: app.getVersion(), ...details };
}

function sendUpdateStatus(status, details = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("app-update-status", updateStatusPayload(status, details));
}

async function checkForAppUpdates({ userInitiated = false } = {}) {
    if (!app.isPackaged) {
        return updateStatusPayload("development", { message: "Las actualizaciones se comprueban en la aplicación instalada." });
    }
    if (!autoUpdater) {
        return updateStatusPayload("unavailable", { message: "El actualizador no está disponible en esta instalación." });
    }
    try {
        sendUpdateStatus("checking");
        const result = await autoUpdater.checkForUpdates();
        if (!result?.updateInfo && userInitiated) {
            await dialog.showMessageBox(mainWindow, { type: "info", title: "Actualizaciones", message: "Tu aplicación ya está actualizada." });
        }
        return updateStatusPayload("checked", { availableVersion: result?.updateInfo?.version || "" });
    } catch (error) {
        console.warn("No se pudo buscar una actualización:", error.message);
        sendUpdateStatus("error", { message: error.message });
        if (userInitiated) {
            await dialog.showMessageBox(mainWindow, { type: "warning", title: "Actualizaciones", message: "No se pudo comprobar si hay actualizaciones.", detail: error.message });
        }
        return updateStatusPayload("error", { message: error.message });
    }
}

function initializeAutoUpdater() {
    if (!app.isPackaged || !autoUpdater) return;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
    autoUpdater.on("update-not-available", (info) => sendUpdateStatus("not-available", { availableVersion: info?.version || app.getVersion() }));
    autoUpdater.on("download-progress", (progress) => sendUpdateStatus("downloading", { percent: Math.round(progress?.percent || 0) }));
    autoUpdater.on("error", (error) => sendUpdateStatus("error", { message: error?.message || "Error desconocido" }));
    autoUpdater.on("update-available", async (info) => {
        sendUpdateStatus("available", { availableVersion: info?.version || "" });
        if (updatePromptVisible) return;
        updatePromptVisible = true;
        const result = await dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "Nueva actualización disponible",
            message: `Está disponible la versión ${info?.version || "nueva"} de Catálogo Rodeo B2B.`,
            detail: "Puedes descargarla ahora. La aplicación se reiniciará únicamente cuando la descarga finalice y confirmes la instalación.",
            buttons: ["Descargar ahora", "Más tarde"],
            defaultId: 0,
            cancelId: 1,
            noLink: true,
        });
        updatePromptVisible = false;
        if (result.response !== 0 || updateDownloadInProgress) return;
        updateDownloadInProgress = true;
        try {
            await autoUpdater.downloadUpdate();
        } catch (error) {
            updateDownloadInProgress = false;
            console.warn("No se pudo descargar la actualización:", error.message);
            await dialog.showMessageBox(mainWindow, { type: "warning", title: "Actualizaciones", message: "No se pudo descargar la actualización.", detail: error.message });
        }
    });
    autoUpdater.on("update-downloaded", async (info) => {
        updateDownloadInProgress = false;
        sendUpdateStatus("downloaded", { availableVersion: info?.version || "" });
        const result = await dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "Actualización lista",
            message: `La versión ${info?.version || "nueva"} ya se descargó.`,
            detail: "Guarda tu trabajo y selecciona Instalar y reiniciar para aplicar la actualización.",
            buttons: ["Instalar y reiniciar", "Instalar al cerrar"],
            defaultId: 0,
            cancelId: 1,
            noLink: true,
        });
        if (result.response === 0) autoUpdater.quitAndInstall(false, true);
    });
}

function configureAppStorage() {
    const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local");
    const appDataRoot = path.join(localAppData, "Catalogo Rodeo B2B");
    const userDataPath = path.join(appDataRoot, "UserData");
    const sessionDataPath = path.join(appDataRoot, "SessionData");
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.mkdirSync(sessionDataPath, { recursive: true });
    app.setPath("userData", userDataPath);
    app.setPath("sessionData", sessionDataPath);
}

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

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });

    app.whenReady().then(() => {
        registerIpcHandlers();
        createMainWindow();
        initializeAutoUpdater();
        setTimeout(() => { checkForAppUpdates(); }, 8000);

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createMainWindow();
            }
        });
    });
}

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

function registerIpcHandlers() {
    ipcMain.handle("app:update:check", async () => checkForAppUpdates({ userInitiated: true }));
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

    ipcMain.handle("orders:analyze-sap", async (_, payload = {}) => {
        return analyzeSapOrder(payload);
    });

    ipcMain.handle("orders:generate-excel", async (_, payload = {}) => {
        return generateProfessionalOrderExcel(payload);
    });

    ipcMain.handle("orders:build-image-index", async (_, payload = {}) => {
        return buildImageIndex(String(payload.rootDir || ""), "orders");
    });

    ipcMain.handle("orders:image-index-info", async () => {
        return getImageIndexInfo("orders");
    });

    ipcMain.handle("fs:scan-categories", async (_, rootDir) => {
        return scanCategories(rootDir);
    });

    ipcMain.handle("fs:find-images-for-items", async (_, payload = {}) => {
        return findImagesForItems(payload);
    });

    ipcMain.handle("images:build-index", async (_, payload = {}) => {
        return buildImageIndex(String(payload.rootDir || ""));
    });

    ipcMain.handle("images:index-info", async () => {
        return getImageIndexInfo();
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

    ipcMain.handle("backblaze:test-connection", async (_, payload = {}) => {
        return testBackblazeConnection(payload);
    });

    ipcMain.handle("backblaze:analyze-maintenance", async (_, payload = {}) => {
        return analyzeBackblazeMaintenance(payload);
    });

    ipcMain.handle("backblaze:delete-versions", async (_, payload = {}) => {
        return deleteBackblazeVersions(payload);
    });

    ipcMain.handle("catalog:analyze-update", async (_, payload = {}) => {
        return analyzePublishedCatalogUpdate(payload);
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

async function analyzePublishedCatalogUpdate(payload = {}) {
    const catalogUrl = sanitizeBaseUrl(payload.catalogUrl || "");
    const apiBaseUrl = sanitizeBaseUrl(payload.apiBaseUrl || "");
    const apiKey = String(payload.apiKey || "").trim();
    if (!/^https?:\/\//i.test(catalogUrl)) throw new Error("Configura la URL publica del catalogo.");
    let currentMetadata = null;
    if (apiBaseUrl && apiKey) {
        const apiResponse = await fetch(`${apiBaseUrl}/catalog_snapshot.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, "Cache-Control": "no-cache" },
            body: JSON.stringify({ slug: String(payload.slug || "") }),
        });
        const apiResult = await apiResponse.json().catch(() => ({}));
        if (!apiResponse.ok || !apiResult?.ok) {
            if (apiResponse.status === 404) {
                throw new Error("El hosting aun no tiene catalog_snapshot.php o el slug no existe. Sube la carpeta hosting/catalogos_api actualizada.");
            }
            throw new Error(apiResult?.error || `La API privada respondio HTTP ${apiResponse.status}`);
        }
        currentMetadata = apiResult.metadata;
    } else {
        const response = await fetch(`${catalogUrl}/catalog.json`, { headers: { "cache-control": "no-cache" } });
        if (!response.ok) {
            if (response.status === 403) throw new Error("catalog.json esta protegido. Configura API base y API key, y sube catalog_snapshot.php al hosting.");
            throw new Error(`No se pudo leer el catalogo publicado: HTTP ${response.status}`);
        }
        currentMetadata = await response.json();
    }
    const currentProducts = Array.isArray(currentMetadata?.catalog) ? currentMetadata.catalog : [];
    const nextProducts = Array.isArray(payload.products) ? payload.products : [];
    const imageItems = new Set((Array.isArray(payload.imageItems) ? payload.imageItems : []).map(normalizeImageItemKey).filter(Boolean));
    const currentByItem = new Map(currentProducts.map((product) => [normalizeImageItemKey(product?.item), product]).filter(([item]) => item));
    const nextByItem = new Map(nextProducts.map((product) => [normalizeImageItemKey(product?.item), product]).filter(([item]) => item));
    const created = [];
    const updated = [];
    const unchanged = [];
    const missingImage = [];
    nextByItem.forEach((product, item) => {
        const current = currentByItem.get(item);
        if (!current) created.push(product);
        else if (catalogProductComparableSignature(current) !== catalogProductComparableSignature(product)) updated.push(product);
        else unchanged.push(product);
        if (!imageItems.has(item) && !resolveCatalogProductImageUrl(product) && !resolveCatalogProductImageUrl(current)) missingImage.push(product);
    });
    const absent = currentProducts.filter((product) => !nextByItem.has(normalizeImageItemKey(product?.item)));
    return {
        ok: true,
        catalogUrl,
        currentTotal: currentProducts.length,
        nextTotal: nextProducts.length,
        createdCount: created.length,
        updatedCount: updated.length,
        unchangedCount: unchanged.length,
        absentCount: absent.length,
        missingImageCount: missingImage.length,
        created: created.slice(0, 100),
        updated: updated.slice(0, 100),
        absent: absent.slice(0, 100),
        missingImage: missingImage.slice(0, 100),
    };
}

function catalogProductComparableSignature(product = {}) {
    return JSON.stringify({
        description: String(product.description || "").trim(),
        price: String(product.price ?? "").trim(),
        available: String(product.available ?? "").trim(),
        brand: String(product.brand || "").trim(),
        category: String(product.category || "").trim(),
        package: String(product.package || product.empaque || "").trim(),
        barcode: String(product.barcode || product.cbarra || "").trim(),
        entry: String(product.entry || "").trim(),
    });
}

function resolveCatalogProductImageUrl(product = {}) {
    if (!product || typeof product !== "object") return "";
    const media = product.media && typeof product.media === "object" ? product.media : {};
    return String(product.remote_image_url || product.remoteImageUrl || media.mainImage || media.remote_image_url || "").trim();
}

function loadPublicationSettings() {
    const settingsPath = getSettingsFilePath();
    if (!fs.existsSync(settingsPath)) {
        return { settings: { ...DEFAULT_PUBLICATION_SETTINGS }, encrypted: false };
    }

    try {
        const rawText = fs.readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, "");
        const raw = JSON.parse(rawText);
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
        b2CdnBaseUrl: String(source.b2CdnBaseUrl || "").trim().replace(/\/+$/, ""),
        b2BucketName: String(source.b2BucketName || "").trim(),
        b2KeyId: String(source.b2KeyId || "").trim(),
        b2ApplicationKey: String(source.b2ApplicationKey || ""),
        b2Endpoint: String(source.b2Endpoint || "").trim().replace(/\/+$/, ""),
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
    const useIndex = payload.useIndex === true;
    const fallbackToScan = payload.fallbackToScan !== false;
    const targetItems = new Map();
    const itemHints = new Map();

    rawItems.forEach((source) => {
        const isObject = source && typeof source === "object";
        const raw = String(isObject ? source.item : source || "").trim();
        const normalized = normalizeImageItemKey(raw);
        if (raw && normalized && !targetItems.has(normalized)) {
            targetItems.set(normalized, raw);
        }
        if (raw && normalized && isObject) {
            itemHints.set(normalized, {
                factory: String(source.factory || "").trim(),
                imageFileName: String(source.imageFileName || "").trim(),
            });
        }
    });

    if (!rootDir || !fs.existsSync(rootDir) || !targetItems.size) {
        return { matches: [], missingItems: rawItems.map((item) => typeof item === "object" ? item.item : item), scannedFiles: 0, stoppedEarly: false };
    }

    const matchesByItem = new Map();
    let scannedFiles = 0;
    let stoppedEarly = false;
    let indexUsed = false;
    const index = useIndex ? loadImageIndexForRoot(rootDir, payload.indexScope) : null;
    if (index) {
        indexUsed = true;
        matchItemsFromImageIndex(index, targetItems, matchesByItem);
    }

    if (useIndex && !index && !fallbackToScan) {
        return buildImageSearchResult(targetItems, matchesByItem, scannedFiles, stoppedEarly, indexUsed);
    }

    if (indexUsed && (!fallbackToScan || matchesByItem.size >= targetItems.size)) {
        return buildImageSearchResult(targetItems, matchesByItem, scannedFiles, stoppedEarly, indexUsed);
    }

    const firstLevelDirs = listChildDirectories(rootDir);
    const hintedGroups = buildHintedImageSearchGroups(firstLevelDirs, targetItems, itemHints);

    for (const [dirPath, itemKeys] of hintedGroups.entries()) {
        if (matchesByItem.size >= targetItems.size || scannedFiles > maxFiles) break;
        const scopedItems = new Map();
        itemKeys.forEach((itemKey) => {
            if (!matchesByItem.has(itemKey) && targetItems.has(itemKey)) {
                scopedItems.set(itemKey, targetItems.get(itemKey));
            }
        });
        if (!scopedItems.size) continue;
        const scanResult = scanImageDirectoryForMatches(dirPath, scopedItems, matchesByItem, maxFiles - scannedFiles);
        scannedFiles += scanResult.scannedFiles;
        stoppedEarly = scanResult.stoppedEarly;
        if (stoppedEarly) break;
    }

    const remainingItems = new Map();
    targetItems.forEach((rawItem, itemKey) => {
        if (!matchesByItem.has(itemKey)) {
            remainingItems.set(itemKey, rawItem);
        }
    });

    if (!stoppedEarly && remainingItems.size) {
        const scanResult = scanImageDirectoryForMatches(rootDir, remainingItems, matchesByItem, maxFiles - scannedFiles);
        scannedFiles += scanResult.scannedFiles;
        stoppedEarly = scanResult.stoppedEarly;
    }

    return buildImageSearchResult(targetItems, matchesByItem, scannedFiles, stoppedEarly, indexUsed);
}

function scanImageDirectoryForMatches(rootDir, targetItems, matchesByItem, maxFiles) {
    const pending = [rootDir];
    let scannedFiles = 0;
    let stoppedEarly = false;
    const hasPendingTargets = () => Array.from(targetItems.keys()).some((itemKey) => !matchesByItem.has(itemKey));
    while (pending.length && hasPendingTargets()) {
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

    return { scannedFiles, stoppedEarly };
}

function listChildDirectories(rootDir) {
    try {
        return fs.readdirSync(rootDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({ name: entry.name, path: path.join(rootDir, entry.name), normalized: normalizeImageItemKey(entry.name) }));
    } catch {
        return [];
    }
}

function buildHintedImageSearchGroups(firstLevelDirs, targetItems, itemHints) {
    const groups = new Map();
    targetItems.forEach((rawItem, itemKey) => {
        const tokens = buildImageSearchTokens(rawItem, itemHints.get(itemKey));
        const matchingDirs = firstLevelDirs.filter((dir) => tokens.some((token) => dir.normalized === token || dir.normalized.startsWith(token) || dir.normalized.includes(token)));
        matchingDirs.forEach((dir) => {
            if (!groups.has(dir.path)) groups.set(dir.path, new Set());
            groups.get(dir.path).add(itemKey);
        });
    });
    return groups;
}

function buildImageSearchTokens(rawItem, hint = {}) {
    const tokens = [];
    const factoryToken = normalizeImageItemKey(hint.factory || "");
    if (factoryToken) tokens.push(factoryToken);
    const itemBoundary = normalizeBoundaryStem(rawItem);
    const itemPrefix = itemBoundary.split("-").filter(Boolean)[0] || "";
    const itemPrefixToken = normalizeImageItemKey(itemPrefix);
    if (itemPrefixToken) tokens.push(itemPrefixToken);
    const imageStem = hint.imageFileName ? path.basename(hint.imageFileName, path.extname(hint.imageFileName)) : "";
    const imagePrefix = normalizeBoundaryStem(imageStem).split("-").filter(Boolean)[0] || "";
    const imagePrefixToken = normalizeImageItemKey(imagePrefix);
    if (imagePrefixToken) tokens.push(imagePrefixToken);
    return Array.from(new Set(tokens)).filter((token) => token.length >= 3);
}

function buildImageSearchResult(targetItems, matchesByItem, scannedFiles, stoppedEarly, indexUsed = false) {
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
        indexUsed,
    };
}

function getImageIndexPath(scope = "catalog") {
    return path.join(app.getPath("userData"), scope === "orders" ? ORDER_IMAGE_INDEX_FILE_NAME : IMAGE_INDEX_FILE_NAME);
}

function getImageIndexInfo(scope = "catalog") {
    const index = readImageIndex(scope);
    if (!index) return { ok: false, rootDir: "", imageCount: 0, updatedAt: "" };
    return {
        ok: true,
        rootDir: index.rootDir || "",
        imageCount: Number(index.imageCount || 0),
        updatedAt: index.updatedAt || "",
    };
}

function readImageIndex(scope = "catalog") {
    const indexPath = getImageIndexPath(scope);
    if (!fs.existsSync(indexPath)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(indexPath, "utf8").replace(/^\uFEFF/, ""));
        if (!raw || typeof raw !== "object" || !raw.rootDir || !raw.byKey) return null;
        return raw;
    } catch (error) {
        console.error("No se pudo leer image-index.json", error);
        return null;
    }
}

function writeImageIndex(index, scope = "catalog") {
    const indexPath = getImageIndexPath(scope);
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
}

function loadImageIndexForRoot(rootDir, scope = "catalog") {
    const index = readImageIndex(scope);
    if (!index) return null;
    const requestedRoot = normalizeFileSystemPath(rootDir);
    const indexedRoot = normalizeFileSystemPath(index.rootDir);
    if (!requestedRoot || requestedRoot !== indexedRoot) return null;
    return index;
}

function buildImageIndex(rootDir, scope = "catalog") {
    if (!rootDir || !fs.existsSync(rootDir)) {
        throw new Error("Selecciona una carpeta de imagenes valida.");
    }

    const byKey = {};
    let imageCount = 0;
    walkDirectory(rootDir, (filePath, nameWithoutExt, ext) => {
        if (!IMAGE_EXTENSIONS.has(ext)) return;
        imageCount += 1;
        const fileName = path.basename(filePath);
        imageIndexKeysForFile(fileName).forEach((key, index) => {
            if (!key || byKey[key]) return;
            byKey[key] = {
                filePath,
                fileName,
                score: index === 0 ? 100 : 94,
            };
        });
    });

    const index = {
        version: 1,
        rootDir,
        updatedAt: new Date().toISOString(),
        imageCount,
        keyCount: Object.keys(byKey).length,
        byKey,
    };
    writeImageIndex(index, scope);
    return {
        ok: true,
        rootDir,
        imageCount,
        keyCount: index.keyCount,
        updatedAt: index.updatedAt,
    };
}

function matchItemsFromImageIndex(index, targetItems, matchesByItem) {
    const byKey = index?.byKey || {};
    targetItems.forEach((rawItem, itemKey) => {
        if (matchesByItem.has(itemKey)) return;
        const indexed = byKey[itemKey];
        if (!indexed?.filePath) return;
        matchesByItem.set(itemKey, {
            item: rawItem,
            normalizedItem: itemKey,
            filePath: indexed.filePath,
            fileName: indexed.fileName || path.basename(indexed.filePath),
            score: Number(indexed.score || 100),
        });
    });
}

function imageIndexKeysForFile(fileName) {
    const ext = path.extname(fileName);
    const rawStem = path.basename(fileName, ext);
    const copyCleanRawStem = rawStem.replace(/\s*\(\d+\)\s*$/i, "");
    const cleanedRawStem = copyCleanRawStem
        .replace(/(?:[_\-\s](?:main|principal|gallery|galeria|extra|image|img|foto|photo|pic|web|edited|editada))(?:[_\-\s]?\d+)?$/i, "")
        .replace(/(?:[_\-\s]\d+)$/i, "");
    return Array.from(new Set([
        normalizeImageItemKey(rawStem),
        normalizeImageItemKey(copyCleanRawStem),
        normalizeImageItemKey(cleanedRawStem),
    ].filter(Boolean)));
}

function normalizeFileSystemPath(value) {
    try {
        return path.resolve(String(value || "")).toLowerCase();
    } catch {
        return String(value || "").trim().toLowerCase();
    }
}

function analyzeSapOrder(payload = {}) {
    const sourcePath = String(payload.sourcePath || "").trim();
    const imagesRoot = String(payload.imagesRoot || "").trim();
    const parsed = readSapOrderFile(sourcePath);
    const imageResult = imagesRoot
        ? findImagesForItems({ rootDir: imagesRoot, items: parsed.rows.map((row) => row.reference), useIndex:true, fallbackToScan:false, indexScope:"orders" })
        : { matches: [], missingItems: parsed.rows.map((row) => row.reference) };
    const matches = new Map((imageResult.matches || []).map((match) => [normalizeImageItemKey(match.item), match]));
    return {
        ok: true,
        sourcePath,
        headers: parsed.headers,
        total: parsed.rows.length,
        matched: matches.size,
        missing: parsed.rows.length - matches.size,
        grandTotal: parsed.grandTotal,
        sourceFormat: parsed.sourceFormat,
        reportName: parsed.reportName || "",
        packageHeader: parsed.packageHeader || "BULTOS",
        indexUsed: imageResult.indexUsed === true,
        rows: parsed.rows.map((row) => ({
            number: row.number,
            reference: row.reference,
            description: row.description,
            barcode: row.barcode,
            cuft: row.cuft,
            weight: row.weight,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            discount: row.discount,
            tax: row.tax,
            total: row.total,
            unit: row.unit,
            packageQty: row.packageQty,
            packages: row.packages,
            imageFound: matches.has(normalizeImageItemKey(row.reference)),
            imagePath: matches.get(normalizeImageItemKey(row.reference))?.filePath || "",
        })),
    };
}

function readSapOrderFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error("Selecciona un archivo exportado por SAP valido.");
    }
    let buffer;
    try {
        buffer = fs.readFileSync(filePath);
    } catch (error) {
        if (["EBUSY","EPERM","EACCES"].includes(error?.code)) throw new Error("Cierra el reporte en Excel y vuelve a intentarlo.");
        throw error;
    }
    let text = "";
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) text = buffer.toString("utf16le").replace(/^\uFEFF/, "");
    else if (buffer[0] === 0xFE && buffer[1] === 0xFF) throw new Error("El archivo SAP usa UTF-16 BE, formato no soportado.");
    else text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    if (/<html[\s>]/i.test(text)) return parseHtmlOrderReport(text);
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length < 2 || !lines[0].includes("\t")) {
        throw new Error("El archivo no corresponde a la exportacion tabulada de SAP.");
    }
    const headers = lines[0].split("\t").map((value) => value.trim());
    const headerIndex = new Map(headers.map((header, index) => [normalizeSapHeader(header), index]));
    const indexFor = (...aliases) => aliases.map(normalizeSapHeader).map((alias) => headerIndex.get(alias)).find((index) => Number.isInteger(index));
    const indexes = {
        number:indexFor("#"), reference:indexFor("Referencia"), quantity:indexFor("Cantidad"), unitPrice:indexFor("Precio por unidad"),
        discount:indexFor("% de descuento"), tax:indexFor("Indicador de impuestos"), total:indexFor("Total"), unit:indexFor("Codigo de unidad de medida"),
        description:indexFor("Descripcion"), barcode:indexFor("EAN-13","EAN13"), cuft:indexFor("CUFT"), grossWeight:indexFor("Peso Bruto","Peso"),
        packageQty:indexFor("Cant. En EMP","Empaque"), packages:indexFor("Bultos","Bulto","CTN","CTNS"), orderNumber:indexFor("NPedido"),
    };
    if (!Number.isInteger(indexes.reference)) throw new Error("El archivo SAP no contiene la columna Referencia.");
    const rows = lines.slice(1).map((line, rowIndex) => {
        const cells = line.split("\t");
        const get = (index) => Number.isInteger(index) ? String(cells[index] || "").trim() : "";
        return {
            number:get(indexes.number) || String(rowIndex + 1), reference:get(indexes.reference), description:get(indexes.description), barcode:get(indexes.barcode),
            cuft:get(indexes.cuft), weight:get(indexes.grossWeight), quantity:get(indexes.quantity),
            unitPrice:get(indexes.unitPrice), discount:get(indexes.discount), tax:get(indexes.tax), total:get(indexes.total), unit:get(indexes.unit),
            packageQty:get(indexes.packageQty), packages:get(indexes.packages), orderNumber:get(indexes.orderNumber),
        };
    }).filter((row) => row.reference !== "");
    if (!rows.length) throw new Error("El archivo SAP no contiene productos con Referencia.");
    return { headers, rows, grandTotal:sumOrderTotals(rows), sourceFormat:"sap-tabular", reportName:"Exportacion SAP", packageHeader:Number.isInteger(indexes.packages) ? headers[indexes.packages] : "BULTOS" };
}

function parseHtmlOrderReport(html) {
    const rowMatches = Array.from(String(html || "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    const tableRows = rowMatches.map((match) => Array.from(match[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((cell) => htmlCellText(cell[1]))).filter((cells) => cells.length > 1);
    if (tableRows.length < 2) throw new Error("El reporte HTML no contiene una tabla de productos valida.");
    const headers = tableRows[0];
    const headerIndex = new Map(headers.map((header, index) => [normalizeSapHeader(header), index]));
    const indexFor = (...aliases) => aliases.map(normalizeSapHeader).map((alias) => headerIndex.get(alias)).find((index) => Number.isInteger(index));
    const indexes = {
        reference:indexFor("ITEM","REFERENCIA"), description:indexFor("DESCRIPCION"), barcode:indexFor("EAN-13","EAN13"), cuft:indexFor("CUFT"),
        weight:indexFor("PESO","PESO BRUTO"), packageQty:indexFor("EMPAQUE","CANT. EN EMP"), packages:indexFor("BULTOS","BULTO","CTN","CTNS"), quantity:indexFor("CANTIDAD"),
        unit:indexFor("UN","UNIDAD"), unitPrice:indexFor("$US","PRECIO POR UNIDAD","PRECIO UNIT."), total:indexFor("TOTAL"),
    };
    if (!Number.isInteger(indexes.reference) || !Number.isInteger(indexes.total)) throw new Error("El reporte debe incluir ITEM y TOTAL.");
    const get = (cells, index) => Number.isInteger(index) ? String(cells[index] || "").trim() : "";
    const mapped = tableRows.slice(1).map((cells, rowIndex) => ({
        number:String(rowIndex + 1), reference:get(cells,indexes.reference), description:get(cells,indexes.description), barcode:get(cells,indexes.barcode),
        cuft:get(cells,indexes.cuft), weight:get(cells,indexes.weight), packageQty:get(cells,indexes.packageQty), packages:get(cells,indexes.packages),
        quantity:get(cells,indexes.quantity), unit:get(cells,indexes.unit), unitPrice:get(cells,indexes.unitPrice), total:get(cells,indexes.total), discount:"", tax:"",
    }));
    const rows = mapped.filter((row) => row.reference && (row.description || row.barcode || row.quantity || row.unitPrice));
    if (!rows.length) throw new Error("El reporte no contiene productos validos.");
    const footerTotal = mapped.slice(rows.length).map((row) => parseOrderNumber(row.total)).find(Number.isFinite);
    const reportNameMatch = String(html || "").match(/id=["']report-name["'][^>]*value=["']([^"']*)["']/i);
    const reportName = reportNameMatch ? htmlCellText(reportNameMatch[1]) : "Reporte comercial";
    return { headers, rows, grandTotal:Number.isFinite(footerTotal) ? footerTotal : sumOrderTotals(rows), sourceFormat:"html-report", reportName, packageHeader:Number.isInteger(indexes.packages) ? headers[indexes.packages] : "BULTOS" };
}

function htmlCellText(value) {
    return decodeOrderHtml(String(value || "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeOrderHtml(value) {
    const named = { amp:"&", lt:"<", gt:">", quot:'"', apos:"'", nbsp:" ", aacute:"á", eacute:"é", iacute:"í", oacute:"ó", uacute:"ú", ntilde:"ñ", Aacute:"Á", Eacute:"É", Iacute:"Í", Oacute:"Ó", Uacute:"Ú", Ntilde:"Ñ" };
    return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
        if (entity[0] === "#") { const number = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2),16) : parseInt(entity.slice(1),10); return Number.isFinite(number) ? String.fromCodePoint(number) : match; }
        return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : (Object.prototype.hasOwnProperty.call(named, entity.toLowerCase()) ? named[entity.toLowerCase()] : match);
    });
}

function parseOrderNumber(value) {
    const normalized = String(value ?? "").trim().replace(/[$\s]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : NaN;
}

function sumOrderTotals(rows) { return (rows || []).reduce((total, row) => total + (Number.isFinite(parseOrderNumber(row.total)) ? parseOrderNumber(row.total) : 0), 0); }

function normalizeSapHeader(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

async function generateProfessionalOrderExcel(payload = {}) {
    const sourcePath = String(payload.sourcePath || "").trim();
    const imagesRoot = String(payload.imagesRoot || "").trim();
    const logoPath = String(payload.logoPath || "").trim();
    const parsed = readSapOrderFile(sourcePath);
    if (!imagesRoot || !fs.existsSync(imagesRoot)) throw new Error("Selecciona una carpeta de imagenes valida.");
    if (logoPath && !fs.existsSync(logoPath)) throw new Error("El logo seleccionado no existe.");
    const imageResult = findImagesForItems({ rootDir: imagesRoot, items: parsed.rows.map((row) => row.reference), useIndex:true, fallbackToScan:false, indexScope:"orders" });
    if (!imageResult.indexUsed) throw new Error("Crea primero el indice rapido de la carpeta de imagenes.");
    const matches = new Map((imageResult.matches || []).map((match) => [normalizeImageItemKey(match.item), match.filePath]));
    const excludeMissingImages = payload.excludeMissingImages === true;
    const exportRows = excludeMissingImages ? parsed.rows.filter((row) => matches.has(normalizeImageItemKey(row.reference))) : parsed.rows;
    const excluded = parsed.rows.length - exportRows.length;
    if (!exportRows.length) throw new Error("No hay productos con imagen para generar el Excel.");
    const priceFactor = normalizeOrderPriceFactor(payload.priceFactor);
    const exportGrandTotal = Math.round(exportRows.reduce((total, row) => total + calculateOrderSpecialPrice(row, priceFactor).total, 0) * 100) / 100;
    const suggestedName = `${path.basename(sourcePath, path.extname(sourcePath))}-profesional.xlsx`;
    const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: "Guardar Excel profesional del pedido",
        defaultPath: path.join(path.dirname(sourcePath), suggestedName),
        filters: [{ name:"Libro de Excel", extensions:["xlsx"] }],
    });
    if (saveResult.canceled || !saveResult.filePath) return { canceled:true };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Catalogo Rodeo B2B";
    workbook.created = new Date();
    workbook.modified = new Date();
    const worksheet = workbook.addWorksheet("Pedido profesional", {
        properties:{ defaultRowHeight:20 },
        pageSetup:{ orientation:"landscape", fitToPage:true, fitToWidth:1, fitToHeight:0, paperSize:9, margins:{ left:0.25, right:0.25, top:0.5, bottom:0.5, header:0.2, footer:0.2 } },
        views:[{ state:"frozen", ySplit:3 }],
    });
    const headerColor = normalizeExcelColor(payload.headerColor, "465AB4");
    const accentColor = normalizeExcelColor(payload.accentColor, "203764");
    const template = payload.template === "professional" ? "professional" : "blackout";
    const imageSizes = { small:{ rowHeight:78, pixels:86, columnWidth:15 }, medium:{ rowHeight:102, pixels:118, columnWidth:20 }, large:{ rowHeight:134, pixels:160, columnWidth:27 } };
    const imageSize = imageSizes[payload.imageSize] || imageSizes.medium;
    worksheet.columns = [
        { key:"reference", width:18 }, { key:"image", width:imageSize.columnWidth }, { key:"description", width:38 }, { key:"barcode", width:19 },
        { key:"cuft", width:12 }, { key:"weight", width:12 }, { key:"packageQty", width:12 }, { key:"packages", width:12 },
        { key:"quantity", width:12 }, { key:"unit", width:9 }, { key:"unitPrice", width:13 }, { key:"total", width:16 },
    ];
    worksheet.mergeCells("C1:L1");
    worksheet.mergeCells("C2:L2");
    worksheet.getCell("C1").value = String(payload.title || "Pedido comercial").trim() || "Pedido comercial";
    worksheet.getCell("C2").value = `Productos: ${exportRows.length}`;
    worksheet.getRow(1).height = 34;
    worksheet.getRow(2).height = 24;
    ["C1","C2"].forEach((address, index) => {
        const cell = worksheet.getCell(address);
        cell.font = { name:"Arial", bold:index === 0, size:index === 0 ? 20 : 10, color:{ argb:index === 0 ? "FFFFFFFF" : "FFDDE5FF" } };
        cell.alignment = { vertical:"middle", horizontal:"left" };
        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:`FF${index === 0 ? accentColor : headerColor}` } };
    });
    for (let col = 1; col <= 2; col += 1) for (let row = 1; row <= 2; row += 1) worksheet.getCell(row, col).fill = { type:"pattern", pattern:"solid", fgColor:{ argb:`FF${accentColor}` } };
    if (logoPath) addExcelImage(workbook, worksheet, logoPath, { col:0.12, row:0.12, maxWidth:185, maxHeight:48 });

    const headers = ["ITEM","FOTO","DESCRIPCION","EAN-13","CUFT","PESO","EMPAQUE",String(parsed.packageHeader || "BULTOS").toUpperCase(),"CANTIDAD","UN","$US","TOTAL"];
    const headerRow = worksheet.getRow(3);
    headerRow.values = headers;
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.font = { name:"Arial", bold:true, size:10, color:{ argb:"FFFFFFFF" } };
        cell.alignment = { vertical:"middle", horizontal:"center", wrapText:true };
        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:`FF${headerColor}` } };
        cell.border = excelThinBorder("FFFFFFFF");
    });
    worksheet.autoFilter = { from:"A3", to:"L3" };
    worksheet.printTitlesRow = "1:3";

    let embeddedImages = 0;
    exportRows.forEach((sourceRow, index) => {
        const pricing = calculateOrderSpecialPrice(sourceRow, priceFactor);
        const rowNumber = index + 4;
        const row = worksheet.getRow(rowNumber);
        row.height = imageSize.rowHeight;
        row.values = [
            sourceRow.reference, "", sourceRow.description, sourceRow.barcode, toOrderNumber(sourceRow.cuft), toOrderNumber(sourceRow.weight),
            toOrderNumber(sourceRow.packageQty), toOrderNumber(sourceRow.packages), toOrderNumber(sourceRow.quantity), sourceRow.unit,
            pricing.unitPrice, pricing.total,
        ];
        row.eachCell({ includeEmpty:true }, (cell, columnNumber) => {
            const alternate = template === "professional" && index % 2 === 1;
            cell.font = { name:"Arial", size:10, bold:columnNumber === 1, color:{ argb:"FF333333" } };
            cell.alignment = { vertical:"middle", horizontal:columnNumber === 3 ? "left" : "center", wrapText:true };
            cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:alternate ? "FFF1F4FA" : "FFFFFFFF" } };
            cell.border = excelThinBorder("FFD6DCE8");
        });
        row.getCell(5).numFmt = "0.00";
        row.getCell(6).numFmt = "0.00";
        row.getCell(11).numFmt = '"$"#,##0.00';
        row.getCell(12).numFmt = '"$"#,##0.00';
        const imagePath = matches.get(normalizeImageItemKey(sourceRow.reference));
        if (imagePath && addExcelImage(workbook, worksheet, imagePath, { col:1, row:rowNumber - 1, maxWidth:imageSize.pixels, maxHeight:imageSize.pixels, center:true })) embeddedImages += 1;
        else {
            row.getCell(2).value = "SIN IMAGEN";
            row.getCell(2).font = { name:"Arial", bold:true, size:9, color:{ argb:"FFB42318" } };
        }
    });
    worksheet.getColumn(1).eachCell((cell, rowNumber) => { if (rowNumber >= 4) cell.numFmt = "@"; });
    worksheet.getColumn(4).eachCell((cell, rowNumber) => { if (rowNumber >= 4) cell.numFmt = "@"; });
    const firstProductRow = 4;
    const lastProductRow = exportRows.length + 3;
    const totalRow = worksheet.getRow(lastProductRow + 1);
    worksheet.mergeCells(`A${totalRow.number}:K${totalRow.number}`);
    totalRow.getCell(1).value = "TOTAL GENERAL";
    totalRow.getCell(12).value = { formula:`SUM(L${firstProductRow}:L${lastProductRow})`, result:exportGrandTotal };
    totalRow.height = 28;
    totalRow.eachCell({ includeEmpty:true }, (cell) => {
        cell.font = { name:"Arial", bold:true, size:11, color:{ argb:"FFFFFFFF" } };
        cell.alignment = { vertical:"middle", horizontal:cell.col === 12 ? "right" : "center" };
        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:`FF${accentColor}` } };
        cell.border = excelThinBorder("FFFFFFFF");
    });
    totalRow.getCell(12).numFmt = '"$"#,##0.00';
    worksheet.headerFooter.oddFooter = "&LGenerado por Catalogo Rodeo B2B&C&P de &N&R&D";
    await workbook.xlsx.writeFile(saveResult.filePath);
    const missing = exportRows.filter((row) => !matches.has(normalizeImageItemKey(row.reference))).length;
    return { ok:true, canceled:false, filePath:saveResult.filePath, total:exportRows.length, sourceTotal:parsed.rows.length, excluded, priceFactor, grandTotal:exportGrandTotal, reportName:parsed.reportName || "", packageHeader:parsed.packageHeader || "BULTOS", matched:exportRows.length - missing, embeddedImages, missing };
}

function normalizeOrderPriceFactor(value) {
    const factor = Number(value);
    return Number.isFinite(factor) && factor > 0 && factor <= 10 ? factor : 1;
}

function calculateOrderSpecialPrice(row, factorInput = 1) {
    const factor = normalizeOrderPriceFactor(factorInput);
    const sourcePrice = parseOrderNumber(row?.unitPrice);
    const quantity = parseOrderNumber(row?.quantity);
    const unitPrice = Number.isFinite(sourcePrice) ? Math.round(sourcePrice * factor * 100) / 100 : 0;
    const total = Math.round(unitPrice * (Number.isFinite(quantity) ? quantity : 0) * 100) / 100;
    return { unitPrice, total };
}

function normalizeExcelColor(value, fallback) {
    const normalized = String(value || "").replace(/^#/, "").toUpperCase();
    return /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function excelThinBorder(color) {
    return { top:{ style:"thin", color:{ argb:color } }, left:{ style:"thin", color:{ argb:color } }, bottom:{ style:"thin", color:{ argb:color } }, right:{ style:"thin", color:{ argb:color } } };
}

function toOrderNumber(value, fallback = "") {
    const raw = String(value ?? "").trim();
    if (!raw) return fallback;
    const normalized = raw.replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : raw;
}

function addExcelImage(workbook, worksheet, filePath, options = {}) {
    const extension = path.extname(filePath).toLowerCase();
    const excelExtension = extension === ".png" ? "png" : ([".jpg", ".jpeg"].includes(extension) ? "jpeg" : "");
    if (!excelExtension) return false;
    const dimensions = readRasterDimensions(filePath);
    let width = Number(options.maxWidth) || 120;
    let height = Number(options.maxHeight) || 120;
    if (dimensions.width && dimensions.height) {
        const scale = Math.min(width / dimensions.width, height / dimensions.height);
        width = Math.max(1, Math.round(dimensions.width * scale));
        height = Math.max(1, Math.round(dimensions.height * scale));
    }
    const imageId = workbook.addImage({ filename:filePath, extension:excelExtension });
    const cellWidth = Number(options.maxWidth) || width;
    const cellHeight = Number(options.maxHeight) || height;
    const colOffset = options.center ? Math.max(0, (cellWidth - width) / Math.max(cellWidth, 1)) * 0.8 : 0;
    const rowOffset = options.center ? Math.max(0, (cellHeight - height) / Math.max(cellHeight, 1)) * 0.8 : 0;
    worksheet.addImage(imageId, { tl:{ col:Number(options.col || 0) + colOffset, row:Number(options.row || 0) + rowOffset }, ext:{ width, height }, editAs:"oneCell" });
    return true;
}

function readRasterDimensions(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") return { width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20) };
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            let offset = 2;
            while (offset + 9 < buffer.length) {
                if (buffer[offset] !== 0xFF) { offset += 1; continue; }
                const marker = buffer[offset + 1];
                const length = buffer.readUInt16BE(offset + 2);
                if ([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)) return { height:buffer.readUInt16BE(offset + 5), width:buffer.readUInt16BE(offset + 7) };
                if (length < 2) break;
                offset += 2 + length;
            }
        }
    } catch {}
    return { width:0, height:0 };
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

async function exportWebPackage(payload, onProgress = () => {}) {
    const slug = shortenCatalogSlug(payload?.slug || "catalogo-publicable");
    const outputRoot = payload?.outputDir;
    if (!outputRoot) throw new Error("No se indico carpeta de salida.");
    const packageDir = path.join(outputRoot, slug);
    onProgress({ phase: "exporting", percent: 8, completed: 0, total: 0, label: "limpiando carpeta" });
    resetExportPackageDir(packageDir, outputRoot);
    copyIfExists(path.join(__dirname, "hosting", "assets", "public-catalog.css"), path.join(packageDir, "assets", "public-catalog.css"));
    copyIfExists(path.join(__dirname, "hosting", "assets", "public-catalog.js"), path.join(packageDir, "assets", "public-catalog.js"));
    copyIfExists(GLOBAL_NO_PHOTO_SOURCE, path.join(packageDir, "assets", "img", "no-photo-camera.svg"));
    copyIfExists(GLOBAL_RODEO_LOGO_SOURCE, path.join(packageDir, "assets", "img", "logo-rodeo-azul.png"));
    const assets = Array.isArray(payload?.assets) ? payload.assets : [];
    const localAssets = assets.filter((asset) => asset?.sourcePath && asset?.relativePath && !asset?.uploadOnly);
    localAssets.forEach((asset, index) => {
        if (asset?.uploadOnly) return;
        if (!asset?.sourcePath || !asset?.relativePath) return;
        if (index === 0 || index % 50 === 0 || index === localAssets.length - 1) {
            onProgress({ phase: "exporting", percent: 9 + Math.round((index / Math.max(localAssets.length, 1)) * 3), completed: index + 1, total: localAssets.length, label: "copiando multimedia" });
        }
        const target = path.join(packageDir, asset.relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        copyWebAsset(asset.sourcePath, target);
    });
    const metadataWithTemplates = applyBrandTemplatesToPackage(payload?.metadata || {}, packageDir);
    const metadata = await prepareMetadataWithBackblazeImages(metadataWithTemplates, assets, slug, packageDir, onProgress);
    onProgress({ phase: "exporting", percent: 17, completed: 0, total: 0, label: "escribiendo catalogo" });
    fs.writeFileSync(path.join(packageDir, "catalog.json"), JSON.stringify(metadata, null, 2), "utf8");
    fs.writeFileSync(path.join(packageDir, "index.html"), buildWebExportHtml(payload?.snapshotHtml || "", metadata), "utf8");
    return { ok: true, outputDir: packageDir, slug };
}

async function publishCatalogPackage(payload, onProgress = () => {}) {
    onProgress({ phase: "exporting", percent: 8, completed: 0, total: 0, label: "" });
    const exportResult = await exportWebPackage(payload?.exportPayload || {}, onProgress);
    const packageDir = exportResult.outputDir;
    const slug = exportResult.slug;
    const hosting = payload?.hosting || {};
    const publish = payload?.publish || {};
    const zipBaseName = sanitizeArchiveName(slug);
    // Evita que FTP, el hosting o un CDN reutilicen el anterior navidad26.zip.
    // El slug público se conserva; solo cambia el archivo temporal de despliegue.
    const releaseId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const zipFileName = `${zipBaseName}-${releaseId}.zip`;
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
        if (title && String(cloned.title || "").trim()) {
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

async function prepareMetadataWithBackblazeImages(metadata, assets, slug, packageDir, onProgress = () => {}) {
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
    onProgress({ phase: "backblaze", percent: 12, completed: 0, total: uploadTargets.length, label: "preparando imagenes" });
    for (let index = 0; index < uploadTargets.length; index += 1) {
        const target = uploadTargets[index];
        const completed = index + 1;
        if (index === 0 || index % 10 === 0 || completed === uploadTargets.length) {
            const percent = 12 + Math.round((index / Math.max(uploadTargets.length, 1)) * 5);
            onProgress({ phase: "backblaze", percent, completed, total: uploadTargets.length, label: target.relativePath });
        }
        try {
            const result = await uploadBackblazeObjectIfChanged(storage, target.sourcePath, target.objectKey);
            const remoteUrl = appendUrlVersion(joinUrl(storage.cdnBaseUrl, target.objectKey), result.contentHash);
            remoteByRelativePath.set(normalizeRelativeCatalogPath(target.relativePath), remoteUrl);
            appendBackblazeUploadLog(packageDir, `${result.skipped ? "SIN CAMBIOS" : result.replaced ? "REEMPLAZADA" : "SUBIDA"} ${target.relativePath} -> ${remoteUrl}`);
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
    const saved = loadPublicationSettings().settings || {};
    const requestedMode = normalizeImageStorageMode(requested?.mode);
    const envMode = normalizeImageStorageMode(env.IMAGE_STORAGE_MODE);
    const mode = requestedMode || envMode || "hosting";
    return {
        mode,
        cdnBaseUrl: sanitizeBaseUrl(requested.cdnBaseUrl || saved.b2CdnBaseUrl || env.IMAGE_CDN_BASE_URL || ""),
        bucketName: String(requested.bucketName || saved.b2BucketName || env.B2_BUCKET_NAME || "").trim(),
        keyId: String(requested.keyId || saved.b2KeyId || env.B2_KEY_ID || "").trim(),
        applicationKey: String(requested.applicationKey || saved.b2ApplicationKey || env.B2_APPLICATION_KEY || "").trim(),
        endpoint: sanitizeBaseUrl(requested.endpoint || saved.b2Endpoint || env.B2_ENDPOINT || ""),
        timeout: Math.max(10000, Number(env.B2_TIMEOUT || 45000) || 45000),
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

async function uploadBackblazeObjectIfChanged(storage, sourcePath, objectKey) {
    const body = fs.readFileSync(sourcePath);
    const contentHash = crypto.createHash("md5").update(body).digest("hex");
    const head = await signedBackblazeRequestWithRetry(storage, "HEAD", objectKey);
    const remoteEtag = normalizeEtag(head.headers.get("etag") || "");
    if (head.status === 200 && remoteEtag === contentHash) {
        await head.body?.cancel().catch(() => {});
        return { skipped: true, replaced: false, contentHash };
    }
    if (head.status !== 200 && head.status !== 404 && head.status !== 403) {
        throw new Error(`HEAD B2 respondio ${head.status}`);
    }
    const replaced = head.status === 200;
    await head.body?.cancel().catch(() => {});
    const put = await signedBackblazeRequestWithRetry(storage, "PUT", objectKey, body, {
        "content-type": contentTypeForPath(sourcePath),
        "x-amz-meta-content-md5": contentHash,
    });
    if (!put.ok) {
        const text = await put.text().catch(() => "");
        throw new Error(`PUT B2 respondio ${put.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
    }
    return { skipped: false, replaced, contentHash };
}

function normalizeEtag(value) {
    return String(value || "").trim().replace(/^W\//i, "").replace(/^"|"$/g, "").toLowerCase();
}

function appendUrlVersion(url, contentHash) {
    if (!url || !contentHash) return url;
    return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(contentHash).slice(0, 12))}`;
}

async function testBackblazeConnection(payload = {}) {
    const storage = loadImageStorageSettings(payload);
    assertBackblazeStorageConfigured(storage);
    const response = await signedBackblazeRequestWithRetry(storage, "HEAD", "");
    await response.body?.cancel().catch(() => {});
    if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Backblaze respondio ${response.status}. Revisa bucket, endpoint y permisos.`);
    }
    return { ok: true, bucketName: storage.bucketName, endpoint: storage.endpoint };
}

async function analyzeBackblazeMaintenance(payload = {}) {
    const storage = loadImageStorageSettings(payload.storage || {});
    assertBackblazeStorageConfigured(storage);
    const prefix = normalizeBackblazeMaintenancePrefix(payload.prefix);
    const expectedNames = new Set((Array.isArray(payload.expectedNames) ? payload.expectedNames : [])
        .map((value) => sanitizeBackblazeFileBaseName(path.parse(String(value || "")).name).toLowerCase())
        .filter(Boolean));
    const versions = await listBackblazeObjectVersions(storage, prefix);
    const grouped = new Map();
    versions.forEach((entry) => {
        if (!grouped.has(entry.key)) grouped.set(entry.key, []);
        grouped.get(entry.key).push(entry);
    });
    const candidates = [];
    let activeCount = 0;
    let oldVersionCount = 0;
    let unusedCount = 0;
    let totalBytes = 0;
    let reclaimableBytes = 0;
    grouped.forEach((entries, key) => {
        entries.sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified)));
        const objectEntries = entries.filter((entry) => !entry.deleteMarker);
        const active = objectEntries.find((entry) => entry.isLatest) || objectEntries[0] || null;
        if (active) activeCount += 1;
        const baseName = sanitizeBackblazeFileBaseName(path.posix.parse(key).name).toLowerCase();
        const unused = expectedNames.size > 0 && !expectedNames.has(baseName);
        objectEntries.forEach((entry) => { totalBytes += entry.size; });
        entries.forEach((entry) => {
            const oldVersion = active ? entry.versionId !== active.versionId : true;
            if (oldVersion) oldVersionCount += 1;
            if (unused && !entry.deleteMarker) unusedCount += 1;
            if (oldVersion || unused) {
                candidates.push({ ...entry, reason: unused ? "sin-uso" : "version-anterior" });
                reclaimableBytes += entry.size;
            }
        });
    });
    return {
        ok: true,
        prefix,
        activeCount,
        oldVersionCount,
        unusedCount,
        totalBytes,
        reclaimableBytes,
        objectCount: versions.length,
        candidates: candidates.slice(0, 5000),
        truncated: candidates.length > 5000,
    };
}

async function deleteBackblazeVersions(payload = {}) {
    const storage = loadImageStorageSettings(payload.storage || {});
    assertBackblazeStorageConfigured(storage);
    const prefix = normalizeBackblazeMaintenancePrefix(payload.prefix);
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    if (!payload.confirmed || !candidates.length) throw new Error("No hay archivos confirmados para eliminar.");
    if (candidates.length > 5000) throw new Error("La limpieza permite un maximo de 5000 versiones por operacion.");
    let deleted = 0;
    const errors = [];
    for (const candidate of candidates) {
        const key = normalizeRelativeCatalogPath(candidate?.key || "");
        const versionId = String(candidate?.versionId || "").trim();
        if (!key.startsWith(prefix) || !versionId) {
            errors.push(`${key || "archivo"}: fuera del prefijo autorizado`);
            continue;
        }
        try {
            const response = await signedBackblazeRequestWithRetry(storage, "DELETE", key, null, {}, { versionId });
            await response.body?.cancel().catch(() => {});
            if (response.status !== 200 && response.status !== 204) throw new Error(`HTTP ${response.status}`);
            deleted += 1;
        } catch (error) {
            errors.push(`${key}: ${error.message}`);
        }
    }
    return { ok: errors.length === 0, deleted, failed: errors.length, errors: errors.slice(0, 20) };
}

function assertBackblazeStorageConfigured(storage) {
    if (!storage.bucketName || !storage.keyId || !storage.applicationKey || !storage.endpoint || !storage.cdnBaseUrl) {
        throw new Error("Completa CDN, bucket, key ID, application key y endpoint de Backblaze.");
    }
}

function normalizeBackblazeMaintenancePrefix(value) {
    const slug = sanitizeSlug(String(value || "").replace(/\/$/, ""));
    if (!slug) throw new Error("Selecciona un catalogo valido; no se permite operar sobre todo el bucket.");
    return `${slug}/`;
}

async function listBackblazeObjectVersions(storage, prefix) {
    const entries = [];
    let keyMarker = "";
    let versionIdMarker = "";
    for (let page = 0; page < 100; page += 1) {
        const query = { versions: "", prefix, "max-keys": "1000" };
        if (keyMarker) query["key-marker"] = keyMarker;
        if (versionIdMarker) query["version-id-marker"] = versionIdMarker;
        const response = await signedBackblazeRequestWithRetry(storage, "GET", "", null, {}, query);
        const xml = await response.text();
        if (!response.ok) throw new Error(`No se pudieron listar versiones B2: HTTP ${response.status}`);
        entries.push(...parseBackblazeVersionXml(xml));
        if (!/<IsTruncated>true<\/IsTruncated>/i.test(xml)) break;
        keyMarker = decodeXmlText(xml.match(/<NextKeyMarker>([\s\S]*?)<\/NextKeyMarker>/i)?.[1] || "");
        versionIdMarker = decodeXmlText(xml.match(/<NextVersionIdMarker>([\s\S]*?)<\/NextVersionIdMarker>/i)?.[1] || "");
        if (!keyMarker) break;
    }
    return entries;
}

function parseBackblazeVersionXml(xml) {
    const entries = [];
    const blocks = String(xml || "").match(/<(Version|DeleteMarker)>[\s\S]*?<\/\1>/gi) || [];
    blocks.forEach((block) => {
        const read = (tag) => decodeXmlText(block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "");
        const key = normalizeRelativeCatalogPath(read("Key"));
        const versionId = read("VersionId");
        if (!key || !versionId) return;
        entries.push({
            key,
            versionId,
            isLatest: read("IsLatest").toLowerCase() === "true",
            lastModified: read("LastModified"),
            size: Math.max(0, Number(read("Size") || 0) || 0),
            deleteMarker: /^<DeleteMarker>/i.test(block),
        });
    });
    return entries;
}

function decodeXmlText(value) {
    return String(value || "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
}

const BACKBLAZE_RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const BACKBLAZE_MAX_ATTEMPTS = 4;

async function signedBackblazeRequestWithRetry(storage, method, objectKey, body = null, extraHeaders = {}, query = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= BACKBLAZE_MAX_ATTEMPTS; attempt += 1) {
        try {
            const response = await signedBackblazeRequest(storage, method, objectKey, body, extraHeaders, query);
            if (!BACKBLAZE_RETRYABLE_STATUSES.has(response.status) || attempt === BACKBLAZE_MAX_ATTEMPTS) {
                return response;
            }
            await response.body?.cancel().catch(() => {});
            console.warn(`${method} B2 respondio ${response.status}. Reintento ${attempt}/${BACKBLAZE_MAX_ATTEMPTS - 1}.`);
        } catch (error) {
            lastError = error;
            if (attempt === BACKBLAZE_MAX_ATTEMPTS) {
                throw new Error(`${error.message} despues de ${BACKBLAZE_MAX_ATTEMPTS} intentos`);
            }
            console.warn(`${method} B2 fallo: ${error.message}. Reintento ${attempt}/${BACKBLAZE_MAX_ATTEMPTS - 1}.`);
        }
        await delayBackblazeRetry(attempt);
    }
    throw lastError || new Error(`${method} B2 fallo despues de ${BACKBLAZE_MAX_ATTEMPTS} intentos`);
}

function delayBackblazeRetry(attempt) {
    const delayMs = 500 * (2 ** Math.max(0, attempt - 1));
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function signedBackblazeRequest(storage, method, objectKey, body = null, extraHeaders = {}, query = {}) {
    const endpoint = new URL(storage.endpoint);
    const host = endpoint.host;
    const region = parseBackblazeRegion(host);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = body ? sha256Hex(body) : sha256Hex("");
    const canonicalUri = `/${encodeS3PathSegment(storage.bucketName)}/${objectKey ? encodeS3ObjectKey(objectKey) : ""}`;
    const canonicalQuery = buildCanonicalS3Query(query);
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
        canonicalQuery,
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
    const controller = new AbortController();
    const timeoutMs = Math.max(10000, Number(storage.timeout || 45000) || 45000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(`${endpoint.origin}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ""}`, {
            method,
            headers: {
                ...headers,
                Authorization: authorization,
            },
            body,
            signal: controller.signal,
        });
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error(`Backblaze no respondio en ${Math.round(timeoutMs / 1000)} segundos`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function buildCanonicalS3Query(query = {}) {
    return Object.entries(query || {})
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [encodeURIComponent(String(key)).replace(/[!'()*]/g, percentEncodeChar), encodeURIComponent(String(value)).replace(/[!'()*]/g, percentEncodeChar)])
        .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
}

function percentEncodeChar(character) {
    return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
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
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[<>:"/\\|?*]+/g, "")
        .replace(/[^a-zA-Z0-9._ -]+/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim() || "catalogo";
}

function buildWebExportHtml(snapshotHtml, metadata) {
    const metadataPayload = metadata?.localPreview === true
        ? { ...(metadata || {}) }
        : { ...(metadata || {}), catalog: [] };
    const safeMetadata = JSON.stringify(metadataPayload);
    const themeStyle = buildPublicCatalogThemeStyle(metadata?.theme);
    const webTemplateClass = `catalog-template-${sanitizeSlug(metadata?.webTemplate || "b2b-modern") || "b2b-modern"}`;
    const assetVersion = encodeURIComponent(String(metadata?.generatedAt || Date.now()).replace(/[^0-9A-Za-z_-]+/g, ""));
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-store, max-age=0">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>${escapeHtml(metadata?.title || "Catalogo publicable")}</title>
    <link rel="stylesheet" href="./assets/public-catalog.css?v=${assetVersion}">
    ${themeStyle ? `<style>${themeStyle}</style>` : ""}
</head>
<body class="catalog-locked ${webTemplateClass}">
    <div class="network-banner" id="networkBanner" hidden></div>
    <div class="language-switcher notranslate" id="catalogLanguageSwitcher" aria-label="Idioma del catalogo" translate="no">
        <button type="button" data-catalog-lang="es">ES</button>
        <button type="button" data-catalog-lang="en">EN</button>
    </div>
    <div id="google_translate_element" class="google-translate-host" hidden></div>
    <div class="catalog-entrance" id="catalogEntrance" hidden>
        <div class="catalog-entrance__backdrop"></div>
        <div class="catalog-entrance__card">
            <img class="catalog-entrance__logo" id="catalogEntranceLogo" alt="Logo">
            <p class="catalog-entrance__eyebrow" id="catalogEntranceEyebrow">Catalogo comercial B2B</p>
            <h1 id="catalogEntranceTitle">${escapeHtml(metadata?.title || "Catalogo comercial")}</h1>
            <p id="catalogEntranceSubtitle">${escapeHtml(metadata?.footerText || metadata?.heroSubtitle || "Preparando experiencia comercial.")}</p>
            <div class="catalog-entrance__progress" id="catalogEntranceLoader" aria-label="Cargando catalogo"><span></span></div>
            <button class="catalog-entrance__button" id="catalogEntranceButton" type="button" hidden>Ver catalogo</button>
        </div>
    </div>
    <div class="expired" id="expiredOverlay"><div class="expired__card"><h1>Este catalogo ya no esta disponible</h1><p>Solicita a tu vendedor un enlace actualizado para continuar comprando.</p></div></div>
    <div class="catalog-shell">
        <header class="catalog-header">
            <div class="catalog-header__top">
                <div class="catalog-brand" style="--catalog-logo-scale:${Number(metadata?.logoScale) || 1.35}">
                    <img class="catalog-brand__logo" id="catalogLogo" alt="Logo">
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
        <nav class="catalog-pagination catalog-pagination--top" id="catalogPaginationTop" aria-label="Paginacion superior" hidden></nav>
        <section class="catalog-layout">
            <aside class="catalog-sidebar">
                <h3>Categorias</h3>
                <div id="sidebarCategoryFilters" class="catalog-sidebar__filters"></div>
            </aside>
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
    <script src="./assets/public-catalog.js?v=${assetVersion}"></script>
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

function shortenCatalogSlug(value, maxLength = 96) {
    const slug = sanitizeSlug(value);
    if (slug.length <= maxLength) return slug;
    const suffix = crypto.createHash("sha256").update(slug).digest("hex").slice(0, 10);
    const prefix = slug.slice(0, maxLength - suffix.length - 1).replace(/-+$/g, "");
    return `${prefix}-${suffix}`;
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
