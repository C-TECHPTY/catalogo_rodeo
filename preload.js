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

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("catalogDesktop", {
    isDesktop: true,
    checkForAppUpdates: () => ipcRenderer.invoke("app:update:check"),
    onAppUpdateStatus: (callback) => {
        ipcRenderer.on("app-update-status", (_, payload) => callback(payload));
    },
    chooseFile: (options) => ipcRenderer.invoke("dialog:open-file", options),
    chooseDirectory: (options) => ipcRenderer.invoke("dialog:open-directory", options),
    readFileBuffer: (filePath) => ipcRenderer.invoke("fs:read-file-buffer", filePath),
    analyzeSapOrder: (payload) => ipcRenderer.invoke("orders:analyze-sap", payload),
    generateOrderExcel: (payload) => ipcRenderer.invoke("orders:generate-excel", payload),
    buildOrderImageIndex: (payload) => ipcRenderer.invoke("orders:build-image-index", payload),
    getOrderImageIndexInfo: () => ipcRenderer.invoke("orders:image-index-info"),
    scanCategories: (rootDir) => ipcRenderer.invoke("fs:scan-categories", rootDir),
    findImagesForItems: (payload) => ipcRenderer.invoke("fs:find-images-for-items", payload),
    buildImageIndex: (payload) => ipcRenderer.invoke("images:build-index", payload),
    getImageIndexInfo: () => ipcRenderer.invoke("images:index-info"),
    saveMissingImagesReport: (payload) => ipcRenderer.invoke("report:save-missing-images", payload),
    generateBatchPdfs: (payload) => ipcRenderer.invoke("batch:generate-pdfs", payload),
    exportWebPackage: (payload) => ipcRenderer.invoke("web:export-package", payload),
    publishCatalogPackage: (payload) => ipcRenderer.invoke("hosting:publish-catalog", payload),
    testHostingConnection: (payload) => ipcRenderer.invoke("hosting:test-connection", payload),
    testBackblazeConnection: (payload) => ipcRenderer.invoke("backblaze:test-connection", payload),
    analyzeBackblazeMaintenance: (payload) => ipcRenderer.invoke("backblaze:analyze-maintenance", payload),
    deleteBackblazeVersions: (payload) => ipcRenderer.invoke("backblaze:delete-versions", payload),
    analyzeCatalogUpdate: (payload) => ipcRenderer.invoke("catalog:analyze-update", payload),
    validateSaasLicense: (payload) => ipcRenderer.invoke("saas:validate-license", payload),
    loadPublicationSettings: () => ipcRenderer.invoke("settings:load-publication"),
    savePublicationSettings: (payload) => ipcRenderer.invoke("settings:save-publication", payload),
    clearPublicationSettings: () => ipcRenderer.invoke("settings:clear-publication"),
    exportCurrentPdf: (payload) => ipcRenderer.invoke("window:export-current-pdf", payload),
    onExportPayload: (callback) => {
        ipcRenderer.on("export-payload", (_, payload) => callback(payload));
    },
    onBatchProgress: (callback) => {
        ipcRenderer.on("batch-progress", (_, payload) => callback(payload));
    },
    onHostingProgress: (callback) => {
        ipcRenderer.on("hosting-progress", (_, payload) => callback(payload));
    },
    notifyExportReady: (jobId) => ipcRenderer.send(`export-ready:${jobId}`),
});
