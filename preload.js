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
    chooseFile: (options) => ipcRenderer.invoke("dialog:open-file", options),
    chooseDirectory: (options) => ipcRenderer.invoke("dialog:open-directory", options),
    readFileBuffer: (filePath) => ipcRenderer.invoke("fs:read-file-buffer", filePath),
    scanCategories: (rootDir) => ipcRenderer.invoke("fs:scan-categories", rootDir),
    generateBatchPdfs: (payload) => ipcRenderer.invoke("batch:generate-pdfs", payload),
    exportWebPackage: (payload) => ipcRenderer.invoke("web:export-package", payload),
    publishCatalogPackage: (payload) => ipcRenderer.invoke("hosting:publish-catalog", payload),
    testHostingConnection: (payload) => ipcRenderer.invoke("hosting:test-connection", payload),
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
