
(function () {
const desktopApi = window.catalogDesktop || null;
const isDesktop = Boolean(desktopApi?.isDesktop);
const LAYOUT_STORAGE_KEY = "catalogLayoutPresetsV1";
const HOSTING_SETTINGS_STORAGE_KEY = "catalogHostingSettingsV1";
const DEFAULT_HOSTING_SETTINGS = {
autoSave:true,
protocol:"ftp",
ftpHost:"",
ftpPort:21,
ftpUser:"",
ftpPassword:"",
remoteDir:"",
apiKey:"",
publicBaseUrl:"",
apiBaseUrl:"",
settingsPath:""
};
const LAYOUT_BLOCKS = { coverTitle:"Portada titulo", pageHeader:"Encabezado", pageLogo:"Logo pagina", productsGrid:"Bloque productos", productImage:"Imagen producto", productCode:"Codigo producto", productPrice:"Precio", productDescription:"Descripcion", productMeta:"Datos tecnicos", pageFooter:"Footer" };
const initialHostingSettings = loadHostingSettings();
const state = { mode:"manual", previewMode:"web", records:[], sourceExcelName:"", imageFiles:[], imageMap:new Map(), imageUrls:[], imageSourceMap:new Map(), extraMediaFiles:[], extraMediaMap:new Map(), title:"Acenox Catalogo Comercial", footerText:"Catalogo comercial interno Acenox", includeCover:true, template:"classic", productsPerPage:6, primaryColor:"#b7192e", secondaryColor:"#1d1d1b", coverImageUrl:"", coverImagePath:"", pageLogoUrl:"", pageLogoPath:"", pageLogoPosition:"right", pageBackgroundUrl:"", pageBackgroundPath:"", pageBackgroundOpacity:0.12, promotion:{ title:"Oferta destacada para compras mayoristas", text:"Configura una imagen liviana o video opcional sin afectar la carga movil.", imageUrl:"", imagePath:"", videoUrl:"", videoPath:"", linkLabel:"Consultar promocion", linkUrl:"" }, webExport:{ slug:"catalogo-publicable", slugEdited:false, expiryDays:30, outputDir:"", baseUrl:initialHostingSettings.publicBaseUrl, apiBaseUrl:initialHostingSettings.apiBaseUrl, generatedLink:"", hosting:initialHostingSettings }, layoutPresets:loadLayoutPresets(), activeLayoutPresetId:"default", layoutEditor:{ enabled:false, selectedBlock:"coverTitle", drag:null }, batch:{ excelPath:"", imagesRoot:"", outputRoot:"", template:"editorial", quality:0.72, primaryColor:"#b7192e", secondaryColor:"#1d1d1b", logoPosition:"right", categories:[], previewIndex:-1, progress:{ completed:0, total:0 } } };
const REQUIRED_ALIASES = { item:["ITEM"], description:["DESCRIPCION","DESCRIPCION ","NOMBRE","PRODUCTO"], price:["PRECIO","PRICE","PVP"], available:["DISPONIBLE","DISP.","DISP","STOCK","EXISTENCIA"], barcode:["CBARRA","CB","CODIGOBARRAS","CODIGO DE BARRAS"], package:["EMPAQUE","PACK","PAQUETE"], um:["UM"], ctn:["CTN"], cub:["CUB.","CUB","CUBICAJE"] };
const TEMPLATE_DEFS = {
classic: templateDef("catalog-page--classic","cover-page--classic","Clasica original","Catalogo comercial","Coleccion general",renderClassicCard),
editorial: templateDef("catalog-page--editorial","cover-page--editorial","Editorial premium","Seleccion editorial","Edicion premium",renderEditorialCard),
industrial: templateDef("catalog-page--industrial","cover-page--industrial","Industrial moderno","Linea tecnica","Especificacion visual",renderIndustrialCard),
minimal: templateDef("catalog-page--minimal","cover-page--minimal","Minimal comercial","Portafolio comercial","Presentacion limpia",renderMinimalCard),
showcase: templateDef("catalog-page--showcase","cover-page--showcase","Showcase de marca","Lanzamiento de temporada","Seleccion destacada",renderShowcaseCard),
horizon: templateDef("catalog-page--horizon","cover-page--horizon","Horizontal editorial","Portafolio horizontal","Formato horizontal",renderHorizonCard),
ledger: templateDef("catalog-page--ledger","cover-page--ledger","Horizontal tecnica","Ficha tecnica horizontal","Edicion especificacion",renderLedgerCard)
,
campin1: { ...templateDef("catalog-page--campin1","cover-page--campin1","CAMPIN1","Outdoor essentials","Camping editorial",renderCampinCard), pageRenderer:renderCampinPage }
};
const PLACEHOLDER_DATA_URI = createPlaceholderDataUri();
const body = document.body;
const toggleSidebarButton = byId("toggleSidebarButton");
const manualModeButton = byId("manualModeButton");
const batchModeButton = byId("batchModeButton");
const manualPanels = Array.from(document.querySelectorAll(".manual-only"));
const batchPanels = Array.from(document.querySelectorAll(".batch-only"));
const catalogRoot = byId("catalogRoot");
const webPreviewRoot = byId("webPreviewRoot");
const webPreviewModeButton = byId("webPreviewModeButton");
const pdfPreviewModeButton = byId("pdfPreviewModeButton");
const titleInput = byId("catalogTitle");
const footerInput = byId("footerText");
const primaryColorInput = byId("primaryColor");
const secondaryColorInput = byId("secondaryColor");
const includeCoverInput = byId("includeCover");
const templateSelect = byId("templateSelect");
const productsPerPageInput = byId("productsPerPage");
const coverImageFileInput = byId("coverImageFile");
const pageLogoFileInput = byId("pageLogoFile");
const pageLogoPositionInput = byId("pageLogoPosition");
const pageBackgroundFileInput = byId("pageBackgroundFile");
const pageBackgroundOpacityInput = byId("pageBackgroundOpacity");
const excelInput = byId("excelFile");
const imageInput = byId("imageFiles");
const extraMediaInput = byId("extraMediaFiles");
const promoTitleInput = byId("promoTitleInput");
const promoTextInput = byId("promoTextInput");
const promoImageFileInput = byId("promoImageFile");
const promoVideoFileInput = byId("promoVideoFile");
const promoLinkLabelInput = byId("promoLinkLabelInput");
const promoLinkUrlInput = byId("promoLinkUrlInput");
const renderButton = byId("renderButton");
const printButton = byId("printButton");
const exportWebButton = byId("exportWebButton");
const statusMessage = byId("statusMessage");
const webCatalogSlugInput = byId("webCatalogSlug");
const webExpiryDaysInput = byId("webExpiryDays");
const webBaseUrlInput = byId("webBaseUrl");
const webApiBaseUrlInput = byId("webApiBaseUrl");
const hostingFtpProtocolInput = byId("hostingFtpProtocol");
const hostingFtpHostInput = byId("hostingFtpHost");
const hostingFtpPortInput = byId("hostingFtpPort");
const hostingFtpUserInput = byId("hostingFtpUser");
const hostingFtpPasswordInput = byId("hostingFtpPassword");
const toggleFtpPasswordButton = byId("toggleFtpPasswordButton");
const hostingRemoteDirInput = byId("hostingRemoteDir");
const hostingApiKeyInput = byId("hostingApiKey");
const toggleApiKeyButton = byId("toggleApiKeyButton");
const saveHostingSettingsButton = byId("saveHostingSettingsButton");
const clearHostingSettingsButton = byId("clearHostingSettingsButton");
const hostingAutoSaveInput = byId("hostingAutoSave");
const hostingSettingsPath = byId("hostingSettingsPath");
const webOutputPathInput = byId("webOutputPath");
const pickWebOutputButton = byId("pickWebOutputButton");
const generatedWebLinkInput = byId("generatedWebLink");
const copyWebLinkButton = byId("copyWebLinkButton");
const webExportStatus = byId("webExportStatus");
const webPublishProgressPanel = byId("webPublishProgressPanel");
const webPublishProgressBarFill = byId("webPublishProgressBarFill");
const webPublishProgressText = byId("webPublishProgressText");
const publishHostingButton = byId("publishHostingButton");
const testHostingButton = byId("testHostingButton");
const batchExcelPathInput = byId("batchExcelPath");
const batchImagesRootInput = byId("batchImagesRoot");
const batchOutputRootInput = byId("batchOutputRoot");
const pickBatchExcelButton = byId("pickBatchExcelButton");
const pickBatchImagesButton = byId("pickBatchImagesButton");
const pickBatchOutputButton = byId("pickBatchOutputButton");
const batchTemplateSelect = byId("batchTemplateSelect");
const batchImageQualityInput = byId("batchImageQuality");
const batchPrimaryColorInput = byId("batchPrimaryColor");
const batchSecondaryColorInput = byId("batchSecondaryColor");
const batchLogoPositionInput = byId("batchLogoPosition");
const scanBatchFoldersButton = byId("scanBatchFoldersButton");
const generateBatchButton = byId("generateBatchButton");
const batchCategoryList = byId("batchCategoryList");
const batchStatusMessage = byId("batchStatusMessage");
const batchProgressPanel = byId("batchProgressPanel");
const batchProgressBarFill = byId("batchProgressBarFill");
const batchProgressText = byId("batchProgressText");
const batchResultsList = byId("batchResultsList");
const layoutPresetSelect = byId("layoutPresetSelect");
const layoutBlockSelect = byId("layoutBlockSelect");
const toggleLayoutEditorButton = byId("toggleLayoutEditorButton");
const layoutOffsetXInput = byId("layoutOffsetX");
const layoutOffsetYInput = byId("layoutOffsetY");
const layoutScaleInput = byId("layoutScale");
const saveLayoutPresetButton = byId("saveLayoutPresetButton");
const resetLayoutBlockButton = byId("resetLayoutBlockButton");
const resetLayoutPresetButton = byId("resetLayoutPresetButton");
const layoutEditorStatus = byId("layoutEditorStatus");
const layoutEditorOverlay = byId("layoutEditorOverlay");

bindManualEvents();
bindBatchEvents();
bindDesktopExportReceiver();
bindBatchProgressReceiver();
bindHostingProgressReceiver();
setMode("manual");
applyThemeVariables();
renderLayoutPresetOptions();
syncLayoutEditorControls();
Object.keys(LAYOUT_BLOCKS).forEach(applyLayoutStyleToDom);
syncHostingInputs();
initializePublicationSettings();
updateGeneratedLinkPreview();
renderBatchCategoryList();
setPreviewMode("web");
renderWebPreview();

function bindManualEvents() {
toggleSidebarButton?.addEventListener("click", () => body.classList.toggle("sidebar-collapsed"));
manualModeButton?.addEventListener("click", () => setMode("manual"));
batchModeButton?.addEventListener("click", () => setMode("batch"));
webPreviewModeButton?.addEventListener("click", () => setPreviewMode("web"));
pdfPreviewModeButton?.addEventListener("click", () => setPreviewMode("pdf"));
titleInput?.addEventListener("input", () => { state.title = titleInput.value.trim() || "Acenox Catalogo Comercial"; if (!state.webExport.slugEdited && webCatalogSlugInput) { const nextSlug = sanitizeSlug(state.title) || "catalogo-publicable"; state.webExport.slug = nextSlug; webCatalogSlugInput.value = nextSlug; updateGeneratedLinkPreview(); } refreshCatalogIfReady(); });
footerInput?.addEventListener("input", () => { state.footerText = footerInput.value.trim() || "Catalogo comercial interno Acenox"; refreshCatalogIfReady(); });
primaryColorInput?.addEventListener("input", () => { state.primaryColor = primaryColorInput.value || "#b7192e"; applyThemeVariables(); refreshCatalogIfReady(); });
secondaryColorInput?.addEventListener("input", () => { state.secondaryColor = secondaryColorInput.value || "#1d1d1b"; applyThemeVariables(); refreshCatalogIfReady(); });
includeCoverInput?.addEventListener("change", () => { state.includeCover = includeCoverInput.checked; refreshCatalogIfReady(); });
templateSelect?.addEventListener("change", () => { state.template = templateSelect.value || "classic"; if (state.template === "campin1" && Number(productsPerPageInput.value) > 5) productsPerPageInput.value = "5"; if (isHorizontalTemplate(state.template) && Number(productsPerPageInput.value) > 4) productsPerPageInput.value = "4"; refreshCatalogIfReady(); });
productsPerPageInput?.addEventListener("input", () => { const value = Number(productsPerPageInput.value); state.productsPerPage = Number.isFinite(value) && value > 0 ? value : 6; refreshCatalogIfReady(); });
coverImageFileInput?.addEventListener("change", () => { const file = coverImageFileInput.files?.[0]; state.coverImageUrl = replaceObjectUrl(state.coverImageUrl, file); state.coverImagePath = file?.path || ""; refreshCatalogIfReady(); });
pageLogoFileInput?.addEventListener("change", () => { const file = pageLogoFileInput.files?.[0]; state.pageLogoUrl = replaceObjectUrl(state.pageLogoUrl, file); state.pageLogoPath = file?.path || ""; refreshCatalogIfReady(); });
pageLogoPositionInput?.addEventListener("change", () => { state.pageLogoPosition = pageLogoPositionInput.value || "right"; refreshCatalogIfReady(); });
pageBackgroundFileInput?.addEventListener("change", () => { const file = pageBackgroundFileInput.files?.[0]; state.pageBackgroundUrl = replaceObjectUrl(state.pageBackgroundUrl, file); state.pageBackgroundPath = file?.path || ""; refreshCatalogIfReady(); });
pageBackgroundOpacityInput?.addEventListener("input", () => { state.pageBackgroundOpacity = readBackgroundOpacity(pageBackgroundOpacityInput); refreshCatalogIfReady(); });
excelInput?.addEventListener("change", async () => { const file = excelInput.files?.[0]; if (file) await loadRecordsFromFile(file); });
imageInput?.addEventListener("change", () => { state.imageFiles = Array.from(imageInput.files || []); reindexMainImages(); refreshCatalogIfReady(); });
extraMediaInput?.addEventListener("change", () => { state.extraMediaFiles = Array.from(extraMediaInput.files || []); reindexExtraMedia(); });
promoTitleInput?.addEventListener("input", () => { state.promotion.title = promoTitleInput.value.trim(); renderWebPreview(); });
promoTextInput?.addEventListener("input", () => { state.promotion.text = promoTextInput.value.trim(); renderWebPreview(); });
promoLinkLabelInput?.addEventListener("input", () => { state.promotion.linkLabel = promoLinkLabelInput.value.trim(); renderWebPreview(); });
promoLinkUrlInput?.addEventListener("input", () => { state.promotion.linkUrl = promoLinkUrlInput.value.trim(); renderWebPreview(); });
promoImageFileInput?.addEventListener("change", () => { const file = promoImageFileInput.files?.[0]; state.promotion.imageUrl = replaceObjectUrl(state.promotion.imageUrl, file); state.promotion.imagePath = file?.path || ""; renderWebPreview(); });
promoVideoFileInput?.addEventListener("change", () => { const file = promoVideoFileInput.files?.[0]; state.promotion.videoUrl = replaceObjectUrl(state.promotion.videoUrl, file); state.promotion.videoPath = file?.path || ""; renderWebPreview(); });
webCatalogSlugInput?.addEventListener("input", () => { const nextSlug = sanitizeSlug(webCatalogSlugInput.value); state.webExport.slugEdited = Boolean(nextSlug); state.webExport.slug = nextSlug || sanitizeSlug(state.title) || "catalogo-publicable"; webCatalogSlugInput.value = state.webExport.slug; updateGeneratedLinkPreview(); });
webExpiryDaysInput?.addEventListener("change", () => { state.webExport.expiryDays = Number(webExpiryDaysInput.value) || 30; });
webBaseUrlInput?.addEventListener("input", () => { const value = sanitizeBaseUrl(webBaseUrlInput.value); state.webExport.baseUrl = value; updateHostingSettings({ publicBaseUrl:value }); updateGeneratedLinkPreview(); });
webApiBaseUrlInput?.addEventListener("input", () => { const value = sanitizeBaseUrl(webApiBaseUrlInput.value); state.webExport.apiBaseUrl = value; updateHostingSettings({ apiBaseUrl:value }); });
hostingFtpProtocolInput?.addEventListener("change", () => updateHostingSettings({ protocol:hostingFtpProtocolInput.value || "ftp" }));
hostingFtpHostInput?.addEventListener("input", () => updateHostingSettings({ ftpHost:hostingFtpHostInput.value.trim() }));
hostingFtpPortInput?.addEventListener("input", () => updateHostingSettings({ ftpPort:Number(hostingFtpPortInput.value) || 21 }));
hostingFtpUserInput?.addEventListener("input", () => updateHostingSettings({ ftpUser:hostingFtpUserInput.value.trim() }));
hostingFtpPasswordInput?.addEventListener("input", () => updateHostingSettings({ ftpPassword:hostingFtpPasswordInput.value }));
hostingRemoteDirInput?.addEventListener("input", () => updateHostingSettings({ remoteDir:hostingRemoteDirInput.value.trim() }));
hostingApiKeyInput?.addEventListener("input", () => updateHostingSettings({ apiKey:hostingApiKeyInput.value.trim() }));
toggleFtpPasswordButton?.addEventListener("click", () => toggleSecretInput(hostingFtpPasswordInput, toggleFtpPasswordButton, "clave FTP"));
toggleApiKeyButton?.addEventListener("click", () => toggleSecretInput(hostingApiKeyInput, toggleApiKeyButton, "API key privada"));
hostingAutoSaveInput?.addEventListener("change", () => { state.webExport.hosting.autoSave = Boolean(hostingAutoSaveInput.checked); saveHostingSettings({ force:true, showStatus:true }); });
saveHostingSettingsButton?.addEventListener("click", async () => { await saveHostingSettings({ force:true, showStatus:true }); });
clearHostingSettingsButton?.addEventListener("click", async () => { await clearHostingSettings(); });
pickWebOutputButton?.addEventListener("click", async () => { if (!isDesktop) return setWebExportStatus("La exportacion web requiere la app de escritorio.", true); const dir = await desktopApi.chooseDirectory({ title: "Selecciona la carpeta de salida web" }); if (!dir) return; state.webExport.outputDir = dir; if (webOutputPathInput) webOutputPathInput.value = dir; setWebExportStatus("Carpeta de salida web seleccionada."); });
copyWebLinkButton?.addEventListener("click", async () => { if (!state.webExport.generatedLink) return setWebExportStatus("Aun no hay link generado para copiar.", true); try { await navigator.clipboard.writeText(state.webExport.generatedLink); setWebExportStatus("Link copiado al portapapeles."); } catch (error) { console.error(error); setWebExportStatus("No se pudo copiar el link automaticamente.", true); } });
layoutPresetSelect?.addEventListener("change", () => { state.activeLayoutPresetId = layoutPresetSelect.value || "default"; syncLayoutEditorControls(); Object.keys(LAYOUT_BLOCKS).forEach(applyLayoutStyleToDom); refreshCatalogIfReady(); refreshLayoutEditorOverlay(); setLayoutEditorStatus(`Plantilla editable activa: ${getActiveLayoutPreset().name}.`); });
layoutBlockSelect?.addEventListener("change", () => { state.layoutEditor.selectedBlock = layoutBlockSelect.value || "coverTitle"; syncLayoutEditorControls(); refreshLayoutEditorOverlay(); });
toggleLayoutEditorButton?.addEventListener("click", () => toggleLayoutEditor());
layoutOffsetXInput?.addEventListener("input", () => updateActiveBlockLayout({ x:Number(layoutOffsetXInput.value) || 0 }));
layoutOffsetYInput?.addEventListener("input", () => updateActiveBlockLayout({ y:Number(layoutOffsetYInput.value) || 0 }));
layoutScaleInput?.addEventListener("input", () => updateActiveBlockLayout({ scale:Number(layoutScaleInput.value) || 1 }));
saveLayoutPresetButton?.addEventListener("click", () => saveCurrentLayoutAsPreset());
resetLayoutBlockButton?.addEventListener("click", () => { resetActiveBlockLayout(); refreshCatalogIfReady(); setLayoutEditorStatus(`Bloque restaurado: ${LAYOUT_BLOCKS[state.layoutEditor.selectedBlock]}.`); });
resetLayoutPresetButton?.addEventListener("click", () => { resetCurrentLayoutPreset(); refreshCatalogIfReady(); setLayoutEditorStatus(`Plantilla restaurada: ${getActiveLayoutPreset().name}.`); });
renderButton?.addEventListener("click", () => { if (!state.records.length) return setStatus("Primero debes cargar un Excel valido.", true); try { renderCatalog(); renderWebPreview(); setPreviewMode("web"); setStatus(`Catalogo generado con la plantilla ${getCurrentTemplate().name}. Productos: ${state.records.length}.`); } catch (error) { console.error(error); setStatus(`No se pudo generar el catalogo: ${error.message}`, true); } });
printButton?.addEventListener("click", async () => {
if (!state.records.length) return setStatus("Carga el Excel antes de imprimir.", true);
setPreviewMode("pdf");
renderCatalog();
await waitForImagesToLoad(catalogRoot);
if (isDesktop && desktopApi?.exportCurrentPdf) {
try {
setStatus("Generando PDF del catalogo...");
const result = await desktopApi.exportCurrentPdf({ title: state.title, fileName: sanitizeFileName(state.title || "catalogo") });
if (result?.canceled) return setStatus("Exportacion PDF cancelada.");
return setStatus(`PDF generado correctamente en ${result.filePath}.`);
} catch (error) {
console.error(error);
return setStatus(`No se pudo generar el PDF: ${error.message}`, true);
}
}
setTimeout(() => window.print(), 250);
});
exportWebButton?.addEventListener("click", async () => { await exportWebPackage(); });
publishHostingButton?.addEventListener("click", async () => { await publishCatalogToHosting(); });
testHostingButton?.addEventListener("click", async () => { await testHostingConnection(); });
window.addEventListener("resize", refreshLayoutEditorOverlay);
window.addEventListener("scroll", refreshLayoutEditorOverlay, true);
}

function bindBatchEvents() {
if (!isDesktop && batchStatusMessage) batchStatusMessage.textContent = "El modo por lotes requiere abrir este proyecto como app local con Electron.";
batchTemplateSelect?.addEventListener("change", () => { state.batch.template = batchTemplateSelect.value || "editorial"; renderBatchCategoryList(); });
batchImageQualityInput?.addEventListener("input", () => { state.batch.quality = Number(batchImageQualityInput.value) || 0.72; });
batchPrimaryColorInput?.addEventListener("input", () => { state.batch.primaryColor = batchPrimaryColorInput.value || "#b7192e"; renderBatchCategoryList(); });
batchSecondaryColorInput?.addEventListener("input", () => { state.batch.secondaryColor = batchSecondaryColorInput.value || "#1d1d1b"; renderBatchCategoryList(); });
batchLogoPositionInput?.addEventListener("change", () => { state.batch.logoPosition = batchLogoPositionInput.value || "right"; renderBatchCategoryList(); });
pickBatchExcelButton?.addEventListener("click", async () => { if (!isDesktop) return; const filePath = await desktopApi.chooseFile({ title: "Selecciona el Excel base", filters: [{ name: "Excel", extensions: ["xlsx", "xlsm", "xls"] }] }); if (!filePath) return; state.batch.excelPath = filePath; batchExcelPathInput.value = filePath; setBatchStatus("Excel base seleccionado."); if (state.batch.categories.length) { state.batch.previewIndex = Math.max(state.batch.previewIndex, 0); await previewBatchCategory(state.batch.previewIndex || 0); } });
pickBatchImagesButton?.addEventListener("click", async () => { if (!isDesktop) return; const dir = await desktopApi.chooseDirectory({ title: "Selecciona la carpeta raiz de imagenes" }); if (!dir) return; state.batch.imagesRoot = dir; batchImagesRootInput.value = dir; setBatchStatus("Carpeta de imagenes seleccionada."); });
pickBatchOutputButton?.addEventListener("click", async () => { if (!isDesktop) return; const dir = await desktopApi.chooseDirectory({ title: "Selecciona la carpeta destino PDF" }); if (!dir) return; state.batch.outputRoot = dir; batchOutputRootInput.value = dir; setBatchStatus("Carpeta destino seleccionada."); });
scanBatchFoldersButton?.addEventListener("click", async () => { if (!isDesktop) return setBatchStatus("El modo por lotes solo esta disponible en la app local.", true); if (!state.batch.imagesRoot) return setBatchStatus("Primero selecciona la carpeta raiz de imagenes.", true); setBatchStatus("Escaneando carpetas..."); try { const categories = await desktopApi.scanCategories(state.batch.imagesRoot); state.batch.categories = categories.filter((category) => category.imageFiles.length > 0).map((category, index) => ({ ...category, primaryColor: pickDefaultCategoryColor(index, "primary"), secondaryColor: pickDefaultCategoryColor(index, "secondary"), template: state.batch.template, logoPosition: state.batch.logoPosition, selected: true })); renderBatchCategoryList(); setBatchStatus(`Categorias detectadas: ${state.batch.categories.length}.`); if (state.batch.categories.length && state.batch.excelPath) { state.batch.previewIndex = 0; await previewBatchCategory(0); } } catch (error) { console.error(error); setBatchStatus(`No se pudieron escanear las carpetas: ${error.message}`, true); } });
batchCategoryList?.addEventListener("input", (event) => { const target = event.target; if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return; const row = target.closest("[data-category-index]"); if (!row) return; const index = Number(row.getAttribute("data-category-index")); const category = state.batch.categories[index]; if (!category) return; if (target.matches(".batch-category__enabled")) category.selected = target.checked; if (target.matches(".batch-category__primary")) category.primaryColor = target.value; if (target.matches(".batch-category__secondary")) category.secondaryColor = target.value; if (target.matches(".batch-category__template")) category.template = target.value; if (target.matches(".batch-category__logo-position")) category.logoPosition = target.value; });
batchCategoryList?.addEventListener("click", async (event) => { const target = event.target; if (!(target instanceof HTMLElement)) return; const previewButton = target.closest(".batch-category__preview"); if (!previewButton) return; const row = previewButton.closest("[data-category-index]"); if (!row) return; const index = Number(row.getAttribute("data-category-index")); state.batch.previewIndex = index; await previewBatchCategory(index); });
generateBatchButton?.addEventListener("click", async () => {
if (!isDesktop) return setBatchStatus("El modo por lotes solo esta disponible en la app local.", true);
if (!state.batch.excelPath || !state.batch.imagesRoot || !state.batch.outputRoot) return setBatchStatus("Selecciona Excel base, carpeta de imagenes y carpeta destino.", true);
const selectedCategories = state.batch.categories.filter((category) => category.selected);
if (!selectedCategories.length) return setBatchStatus("No hay categorias seleccionadas para exportar.", true);
setBatchStatus("Preparando generacion por lotes...");
try {
resetBatchProgress(selectedCategories.length);
const jobs = selectedCategories.map((category, index) => ({ jobId:`job-${Date.now()}-${index}`, categoryName:category.name, fileName:sanitizeFileName(category.name), outputDir:state.batch.outputRoot, excelPath:state.batch.excelPath, category, options:{ title:category.name, footerText:`${category.name} - Catalogo generado por lotes`, includeCover:true, template:category.template || state.batch.template, productsPerPage:recommendedProductsPerPage(category.template || state.batch.template), primaryColor:category.primaryColor || state.batch.primaryColor, secondaryColor:category.secondaryColor || state.batch.secondaryColor, pageLogoPosition:category.logoPosition || state.batch.logoPosition, pageBackgroundOpacity:0.12, quality:state.batch.quality } }));
const results = await desktopApi.generateBatchPdfs({ jobs });
const okCount = results.filter((item) => item.ok).length;
setBatchStatus(`PDF generados: ${okCount}. Fallos: ${results.length - okCount}.`);
} catch (error) { console.error(error); setBatchStatus(`No se pudieron generar los PDF: ${error.message}`, true); }
});
}

function bindDesktopExportReceiver() {
if (!isDesktop || !desktopApi.onExportPayload) return;
desktopApi.onExportPayload(async (payload) => {
try { await renderExportJob(payload); await waitForImagesToLoad(catalogRoot); desktopApi.notifyExportReady(payload.jobId); } catch (error) { console.error(error); }
});
}

function bindBatchProgressReceiver() {
if (!isDesktop || !desktopApi.onBatchProgress) return;
desktopApi.onBatchProgress((payload) => {
state.batch.progress.completed = payload.completed || 0;
state.batch.progress.total = payload.total || 0;
updateBatchProgressUi(payload);
appendBatchResult(payload);
});
}

function bindHostingProgressReceiver() {
if (!isDesktop || !desktopApi.onHostingProgress) return;
desktopApi.onHostingProgress((payload) => { updateHostingProgressUi(payload); });
}

function setPreviewMode(mode) {
state.previewMode = mode === "pdf" ? "pdf" : "web";
webPreviewModeButton?.classList.toggle("preview-tabs__button--active", state.previewMode === "web");
pdfPreviewModeButton?.classList.toggle("preview-tabs__button--active", state.previewMode === "pdf");
if (webPreviewRoot) webPreviewRoot.hidden = state.previewMode !== "web";
if (catalogRoot) catalogRoot.hidden = state.previewMode !== "pdf";
}

function renderWebPreview() {
if (!webPreviewRoot) return;
const products = (state.records.length ? state.records : createPreviewProducts()).slice(0, 8);
const promoImage = state.promotion.imageUrl || state.coverImageUrl || "";
webPreviewRoot.innerHTML = `
<div class="web-preview-shell">
  <header class="web-preview-header">
    <div class="web-preview-brand">
      <div class="web-preview-logo">${state.pageLogoUrl ? `<img src="${escapeHtml(state.pageLogoUrl)}" alt="">` : "R"}</div>
      <div><strong>${escapeHtml(state.title)}</strong><span>${escapeHtml(state.footerText || "Catalogo mayorista B2B")}</span></div>
    </div>
    <div class="web-preview-search">Buscar SKU, marca o categoria</div>
    <button type="button">Carrito</button>
  </header>
  <section class="web-preview-hero">
    <div><p>Catalogo comercial B2B</p><h2>${escapeHtml(state.title)}</h2><span>Pedidos por empaque, link trazable y salida operativa en Excel/CSV/XLSX.</span></div>
    <div class="web-preview-filter"><strong>Categorias</strong><span>Todos</span><span>General</span><span>Mayorista</span></div>
  </section>
  <section class="web-preview-promo">
    <div><p>Promocion configurable</p><h3>${escapeHtml(state.promotion.title || "Oferta destacada")}</h3><span>${escapeHtml(state.promotion.text || "Imagen o video opcional con fallback movil.")}</span></div>
    <div class="web-preview-promo__media">${promoImage ? `<img src="${escapeHtml(promoImage)}" alt="">` : "Imagen / video promo"}</div>
  </section>
  <section class="web-preview-grid">${products.map(renderWebPreviewCard).join("")}</section>
</div>`;
}

function renderWebPreviewCard(product) {
const image = state.imageMap.get(normalizeIdentifier(product.item)) || "";
return `<article class="web-preview-card">
  <div class="web-preview-card__media">${image ? `<img src="${escapeHtml(image)}" alt="">` : "Sin imagen"}</div>
  <div class="web-preview-card__body">
    <span>${escapeHtml(product.item || "SKU")}</span>
    <strong>${escapeHtml(product.shortDescription || product.description || "Producto")}</strong>
    <div><small>Empaque</small><b>${escapeHtml(product.package || "Unidad")}</b></div>
    <p>${escapeHtml(product.price || "$0.00")}</p>
  </div>
</article>`;
}

function createPreviewProducts() {
return [
{ item:"SKU-001", description:"Producto mayorista de muestra", shortDescription:"Producto mayorista de muestra", package:"Caja x 12", price:"$0.00" },
{ item:"SKU-002", description:"Linea comercial B2B", shortDescription:"Linea comercial B2B", package:"Bulto x 24", price:"$0.00" },
{ item:"SKU-003", description:"Referencia para preventa", shortDescription:"Referencia para preventa", package:"Set x 6", price:"$0.00" }
];
}

async function previewBatchCategory(index) {
const category = state.batch.categories[index];
if (!category) return;
if (!state.batch.excelPath) return setBatchStatus("Selecciona primero el Excel base para ver la vista previa.", true);
setBatchStatus(`Cargando vista previa de ${category.name}...`);
try {
await renderPreviewJob(category);
setBatchStatus(`Vista previa cargada para ${category.name}.`);
} catch (error) {
console.error(error);
setBatchStatus(`No se pudo cargar la vista previa: ${error.message}`, true);
}
}

async function renderPreviewJob(category) {
const bufferArray = await desktopApi.readFileBuffer(state.batch.excelPath);
const records = parseWorkbookFromBuffer(new Uint8Array(bufferArray));
const imageMap = buildPreviewImageMapFromPaths(category.imageFiles);
state.records = records.filter((record) => imageMap.has(normalizeIdentifier(record.item)));
state.imageMap = imageMap;
state.imageUrls = [];
state.title = category.name;
state.footerText = `${category.name} - Vista previa`;
state.includeCover = true;
state.template = category.template || state.batch.template;
state.productsPerPage = recommendedProductsPerPage(category.template || state.batch.template);
state.primaryColor = category.primaryColor || state.batch.primaryColor;
state.secondaryColor = category.secondaryColor || state.batch.secondaryColor;
state.pageLogoPosition = category.logoPosition || state.batch.logoPosition;
state.pageBackgroundOpacity = 0.12;
state.coverImageUrl = category.coverPath ? pathToFileUrl(category.coverPath) : "";
state.pageLogoUrl = category.logoPath ? pathToFileUrl(category.logoPath) : "";
state.pageBackgroundUrl = "";
applyThemeVariables();
renderCatalog({ syncInputs: false });
}

function resetBatchProgress(total) {
state.batch.progress.completed = 0;
state.batch.progress.total = total;
if (batchProgressPanel) batchProgressPanel.hidden = false;
if (batchProgressBarFill) batchProgressBarFill.style.width = "0%";
if (batchProgressText) batchProgressText.textContent = `Preparando ${total} PDF(s)...`;
if (batchResultsList) batchResultsList.innerHTML = "";
}

function updateBatchProgressUi(payload) {
const total = payload.total || 0;
const completed = payload.completed || 0;
const percent = total ? Math.round((completed / total) * 100) : 0;
if (batchProgressPanel) batchProgressPanel.hidden = false;
if (batchProgressBarFill) batchProgressBarFill.style.width = `${percent}%`;
if (batchProgressText) batchProgressText.textContent = `Procesados ${completed} de ${total}: ${payload.category}`;
}

function appendBatchResult(payload) {
if (!batchResultsList) return;
const item = document.createElement("div");
item.className = `batch-result ${payload.ok ? "batch-result--ok" : "batch-result--error"}`;
item.innerHTML = payload.ok
? `<p><strong>${escapeHtml(payload.category)}</strong><br>${escapeHtml(payload.filePath || "PDF generado correctamente.")}</p>`
: `<p><strong>${escapeHtml(payload.category)}</strong><br>Error: ${escapeHtml(payload.error || "No se pudo generar el PDF.")}</p>`;
batchResultsList.appendChild(item);
}

async function renderExportJob(payload) {
const bufferArray = await desktopApi.readFileBuffer(payload.excelPath);
const records = parseWorkbookFromBuffer(new Uint8Array(bufferArray));
const imageMap = await buildCompressedImageMapFromPaths(payload.category.imageFiles, payload.options.quality);
state.records = records.filter((record) => imageMap.has(normalizeIdentifier(record.item)));
state.imageMap = imageMap;
state.imageUrls = [];
state.title = payload.options.title;
state.footerText = payload.options.footerText;
state.includeCover = payload.options.includeCover;
state.template = payload.options.template;
state.productsPerPage = payload.options.productsPerPage;
state.primaryColor = payload.options.primaryColor;
state.secondaryColor = payload.options.secondaryColor;
state.pageLogoPosition = payload.options.pageLogoPosition || state.batch.logoPosition;
state.pageBackgroundOpacity = payload.options.pageBackgroundOpacity;
state.coverImageUrl = payload.category.coverPath ? await compressImagePath(payload.category.coverPath, payload.options.quality, 2000) : "";
state.pageBackgroundUrl = "";
applyThemeVariables();
state.pageLogoUrl = payload.category.logoPath ? pathToFileUrl(payload.category.logoPath) : "";
setPreviewMode("pdf");
renderCatalog({ syncInputs: false });
}

async function exportWebPackage() {
if (!isDesktop) return setWebExportStatus("La exportacion web requiere la app de escritorio.", true);
if (!state.records.length) return setWebExportStatus("Primero carga un Excel y las imagenes del catalogo.", true);
if (!state.webExport.outputDir) return setWebExportStatus("Selecciona una carpeta de salida para el paquete web.", true);
const slug = sanitizeSlug(state.webExport.slug || state.title) || "catalogo-publicable";
setWebExportStatus("Preparando paquete web publicable...");
try {
const payload = buildWebExportPayload(slug);
const result = await desktopApi.exportWebPackage(payload);
state.webExport.generatedLink = buildGeneratedLink(slug);
updateGeneratedLinkPreview();
setWebExportStatus(`Paquete web listo en ${result.outputDir}. Vigencia: ${payload.metadata.expiryLabel}.${state.webExport.generatedLink ? ` Link: ${state.webExport.generatedLink}` : " Configura una URL base publica para obtener el link final."}`);
} catch (error) {
console.error(error);
setWebExportStatus(`No se pudo exportar el paquete web: ${error.message}`, true);
}
}

async function publishCatalogToHosting() {
if (!isDesktop) return setWebExportStatus("La publicacion al hosting requiere la app de escritorio.", true);
if (!state.records.length) return setWebExportStatus("Primero carga un Excel y las imagenes del catalogo.", true);
if (!state.webExport.outputDir) return setWebExportStatus("Selecciona una carpeta de salida para el paquete web.", true);
const hosting = state.webExport.hosting || {};
if (!hosting.ftpHost || !hosting.ftpUser || !hosting.ftpPassword) return setWebExportStatus("Completa FTP host, usuario y clave.", true);
if (!state.webExport.apiBaseUrl || !hosting.apiKey) return setWebExportStatus("Completa la API base publica y la API key privada.", true);
const slug = sanitizeSlug(state.webExport.slug || state.title) || "catalogo-publicable";
const remoteCatalogDir = buildRemoteCatalogDir(hosting.remoteDir, slug);
setWebExportStatus("Preparando publicacion al hosting...");
setHostingPublishBusy(true);
resetHostingProgressUi();
try {
const payload = buildWebExportPayload(slug);
const result = await desktopApi.publishCatalogPackage({
    exportPayload: payload,
    hosting: {
        protocol: hosting.protocol || "ftp",
        ftpHost: hosting.ftpHost,
        ftpPort: hosting.ftpPort || 21,
        ftpUser: hosting.ftpUser,
        ftpPassword: hosting.ftpPassword,
        remoteDir: hosting.remoteDir,
        apiBaseUrl: state.webExport.apiBaseUrl,
        apiKey: hosting.apiKey,
        publicBaseUrl: state.webExport.baseUrl
    },
    publish: {
        slug,
        title: state.title,
        template: state.template,
        publicUrl: buildGeneratedLink(slug),
        pdfUrl: "",
        expiresAt: payload.metadata.expiresAt,
        sellerName: "",
        clientName: "",
        promoTitle: payload.metadata.promotion.title,
        promoText: payload.metadata.promotion.text,
        promoImageUrl: payload.metadata.promotion.imageUrl,
        promoVideoUrl: payload.metadata.promotion.videoUrl,
        promoLinkUrl: payload.metadata.promotion.linkUrl,
        promoLinkLabel: payload.metadata.promotion.linkLabel,
        notes: `Catalogo generado desde app local. Plantilla ${state.template}.`,
        catalogJsonPath: `${remoteCatalogDir}/catalog.json`
    }
});
state.webExport.generatedLink = result.publicUrl || buildGeneratedLink(slug);
updateGeneratedLinkPreview();
setWebExportStatus(`Catalogo publicado correctamente. Link: ${state.webExport.generatedLink || "(sin URL publica)"}`);
} catch (error) {
console.error(error);
setWebExportStatus(`No se pudo publicar al hosting: ${error.message}`, true);
} finally {
setHostingPublishBusy(false);
}
}

function buildWebExportPayload(slug) {
const currentState = {
records: state.records,
imageMap: state.imageMap,
coverImageUrl: state.coverImageUrl,
pageLogoUrl: state.pageLogoUrl,
pageBackgroundUrl: state.pageBackgroundUrl,
template: state.template,
title: state.title,
footerText: state.footerText,
includeCover: state.includeCover,
productsPerPage: state.productsPerPage,
primaryColor: state.primaryColor,
secondaryColor: state.secondaryColor,
pageLogoPosition: state.pageLogoPosition,
pageBackgroundOpacity: state.pageBackgroundOpacity,
promotion: { ...state.promotion },
};
const records = state.records.slice();
const assets = [];
const exportImageMap = new Map();
const mediaCatalog = {};
const now = new Date();
const expiresAt = new Date(now.getTime() + (state.webExport.expiryDays || 30) * 24 * 60 * 60 * 1000);
records.forEach((record, recordIndex) => {
const normalizedItem = normalizeIdentifier(record.item);
const exportBaseName = buildExportAssetBaseName(record.item, normalizedItem, recordIndex);
const sourcePath = state.imageSourceMap.get(normalizedItem);
if (sourcePath) {
const ext = getWebImageExtension(sourcePath);
const relativePath = `media/main/${exportBaseName}${ext}`;
assets.push({ sourcePath, relativePath });
exportImageMap.set(normalizedItem, `./${relativePath}`);
}
const extras = state.extraMediaMap.get(normalizedItem) || { gallery:[], videoPath:"" };
const gallery = extras.gallery.map((filePath, index) => {
const ext = getWebImageExtension(filePath);
const relativePath = `media/extra/${exportBaseName}_${index + 1}${ext}`;
assets.push({ sourcePath:filePath, relativePath });
return `./${relativePath}`;
});
let video = "";
if (extras.videoPath) {
const ext = getPathExtension(extras.videoPath) || ".mp4";
const relativePath = `media/video/${exportBaseName}${ext}`;
assets.push({ sourcePath:extras.videoPath, relativePath });
video = `./${relativePath}`;
}
const packageQty = parsePackageQty(record.package);
mediaCatalog[record.item] = { item:record.item, description:record.description, shortDescription:record.shortDescription, price:record.price, available:record.available, package:record.package, empaque:record.package, packageQty, mainImage:exportImageMap.get(normalizedItem) || "", gallery, video };
});
const coverRelative = state.coverImagePath ? `media/brand/cover${getWebImageExtension(state.coverImagePath)}` : "";
const logoRelative = state.pageLogoPath ? `media/brand/logo${getWebImageExtension(state.pageLogoPath)}` : "";
const backgroundRelative = state.pageBackgroundPath ? `media/brand/background${getWebImageExtension(state.pageBackgroundPath)}` : "";
const promoImageRelative = state.promotion.imagePath ? `media/promo/promo${getWebImageExtension(state.promotion.imagePath)}` : "";
const promoVideoRelative = state.promotion.videoPath ? `media/promo/promo${getPathExtension(state.promotion.videoPath) || ".mp4"}` : "";
if (state.coverImagePath) assets.push({ sourcePath:state.coverImagePath, relativePath:coverRelative });
if (state.pageLogoPath) assets.push({ sourcePath:state.pageLogoPath, relativePath:logoRelative });
if (state.pageBackgroundPath) assets.push({ sourcePath:state.pageBackgroundPath, relativePath:backgroundRelative });
if (state.promotion.imagePath) assets.push({ sourcePath:state.promotion.imagePath, relativePath:promoImageRelative });
if (state.promotion.videoPath) assets.push({ sourcePath:state.promotion.videoPath, relativePath:promoVideoRelative });
state.records = records;
state.imageMap = exportImageMap;
state.coverImageUrl = coverRelative ? `./${coverRelative}` : "";
state.pageLogoUrl = logoRelative ? `./${logoRelative}` : "";
state.pageBackgroundUrl = backgroundRelative ? `./${backgroundRelative}` : "";
renderCatalog({ syncInputs:false });
const snapshotHtml = catalogRoot.innerHTML;
state.records = currentState.records;
state.imageMap = currentState.imageMap;
state.coverImageUrl = currentState.coverImageUrl;
state.pageLogoUrl = currentState.pageLogoUrl;
state.pageBackgroundUrl = currentState.pageBackgroundUrl;
state.promotion = currentState.promotion;
renderCatalog({ syncInputs:false });
return {
outputDir: state.webExport.outputDir,
slug,
snapshotHtml,
  metadata: {
  title: state.title,
  footerText: state.footerText,
  slug,
  template: state.template,
  heroTitle: state.title,
  heroSubtitle: "Catalogo comercial B2B con pedido mayorista y trazabilidad por enlace.",
  publicBaseUrl: state.webExport.baseUrl,
  apiBaseUrl: state.webExport.apiBaseUrl,
  publicUrl: buildGeneratedLink(slug),
  currency: "USD",
  promotion: {
    title: state.promotion.title,
    text: state.promotion.text,
    imageUrl: promoImageRelative ? `./${promoImageRelative}` : "",
    videoUrl: promoVideoRelative ? `./${promoVideoRelative}` : "",
    linkLabel: state.promotion.linkLabel,
    linkUrl: state.promotion.linkUrl
  },
  legacyPdfUrl: "",
  modernPdfUrl: "",
  generatedAt: now.toISOString(),
  expiresAt: expiresAt.toISOString(),
expiryDays: state.webExport.expiryDays || 30,
expiryLabel: `${state.webExport.expiryDays || 30} dias`,
  coverImage: coverRelative ? `./${coverRelative}` : "",
  logoUrl: logoRelative ? `./${logoRelative}` : "",
catalog: records.map((record) => ({ item:record.item, description:record.description, shortDescription:record.shortDescription, price:record.price, available:record.available, package:record.package, empaque:record.package, packageQty:parsePackageQty(record.package), packageLabel:record.package, saleUnit:record.saleUnit || record.um || "bulto", minimumOrder:record.minimumOrder || 1, multipleQty:record.multipleQty || 1, brand:record.brand || "", material:record.material || "", size:record.size || record.measureBadge || "", category:record.category || "General", media:mediaCatalog[record.item] || { gallery:[], video:"" } })),
},
assets: dedupeAssets(assets),
};
}

function dedupeAssets(assets) { const seen = new Set(); return assets.filter((asset) => { const key = `${asset.sourcePath}|${asset.relativePath}`; if (!asset.sourcePath || seen.has(key)) return false; seen.add(key); return true; }); }
function reindexMainImages() { revokeObjectUrls(state.imageUrls); state.imageMap = buildImageMapFromFiles(state.imageFiles || []); state.imageUrls = Array.from(state.imageMap.values()); state.imageSourceMap = buildImageSourceMapFromFiles(state.imageFiles || []); if (state.imageFiles?.length) setStatus(`Imagenes principales indexadas: ${state.imageMap.size} de ${state.imageFiles.length}.`); }
function buildImageSourceMapFromFiles(files) { const map = new Map(); const knownItems = new Set(state.records.map((record) => normalizeIdentifier(record.item)).filter(Boolean)); files.forEach((file) => { const stem = resolveMainMediaItemKey(file.name || "", knownItems); if (!stem || map.has(stem) || !file.path) return; map.set(stem, file.path); }); return map; }
function buildExtraMediaMapFromFiles(files) { const map = new Map(); const knownItems = new Set(state.records.map((record) => normalizeIdentifier(record.item)).filter(Boolean)); files.forEach((file) => { const path = file.path || ""; if (!path) return; const ext = getPathExtension(file.name || path); const parsed = parseExtraMediaStem(file.name || path, knownItems); if (!parsed.itemKey) return; if (!map.has(parsed.itemKey)) map.set(parsed.itemKey, { gallery:[], videoPath:"" }); const bucket = map.get(parsed.itemKey); if (isVideoExtension(ext)) { if (!bucket.videoPath) bucket.videoPath = path; return; } bucket.gallery.push(path); }); return map; }
function resolveMainMediaItemKey(fileName, knownItems = new Set()) { const parsed = parseExtraMediaStem(fileName, knownItems); return parsed.itemKey || normalizeIdentifier(String(fileName || "").replace(/\.[^.]+$/, "")); }
function parseExtraMediaStem(fileName, knownItems = new Set()) { const rawStem = String(fileName || "").replace(/\.[^.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); const cleanedStem = rawStem.replace(/(?:[_\-\s](?:main|principal|gallery|galeria|extra|image|img|foto|video|vid))(?:[_\-\s]?\d+)?$/i, "").replace(/(?:[_\-\s]\d+)$/i, "").trim(); const candidates = [ normalizeIdentifier(rawStem), normalizeIdentifier(cleanedStem), normalizeIdentifier(rawStem.split(/[_\s]+/)[0]), normalizeIdentifier(cleanedStem.split(/[_\s]+/)[0]), normalizeIdentifier((rawStem.match(/^(.+?)(?:[_\s]+(?:\d+|main|principal|gallery|galeria|extra|image|img|foto|video|vid).*)$/i) || [])[1] || "") ].filter(Boolean); const itemKey = candidates.find((candidate) => knownItems.has(candidate)) || candidates[0] || ""; return { itemKey }; }
function getPathExtension(filePath) { return String(filePath || "").match(/\.[^.]+$/)?.[0]?.toLowerCase() || ""; }
function getWebImageExtension(filePath) { const ext = getPathExtension(filePath); return ext === ".svg" ? ".svg" : ".jpg"; }
function isVideoExtension(ext) { return [".mp4",".webm",".mov"].includes(String(ext || "").toLowerCase()); }
function parsePackageQty(value) {
const text = String(value || "").trim();
if (!text) return 1;
const normalized = text.replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
const parsed = Number(normalized);
return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
function reindexExtraMedia() { state.extraMediaMap = buildExtraMediaMapFromFiles(state.extraMediaFiles || []); const itemsWithExtras = Array.from(state.extraMediaMap.values()).filter((entry) => entry.gallery.length || entry.videoPath).length; setWebExportStatus(`Multimedia extra indexada para ${itemsWithExtras} ITEM(s).`); }
function sanitizeSlug(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function buildExportAssetBaseName(rawItem, normalizedItem, index) { const safeBase = normalizeIdentifier(rawItem) || normalizeIdentifier(normalizedItem) || sanitizeFileName(rawItem || "item") || "item"; return `${safeBase}-${index + 1}`; }
function setWebExportStatus(message, isError = false) { if (!webExportStatus) return; webExportStatus.textContent = message; webExportStatus.style.color = isError ? "#ffd6d6" : "rgba(255,255,255,0.82)"; }
function sanitizeBaseUrl(value) { return String(value || "").trim().replace(/\/+$/, ""); }
function buildGeneratedLink(slug) { return state.webExport.baseUrl ? `${sanitizeBaseUrl(state.webExport.baseUrl)}/${slug}/` : ""; }
function updateGeneratedLinkPreview() { state.webExport.generatedLink = buildGeneratedLink(state.webExport.slug || "catalogo-publicable"); if (generatedWebLinkInput) generatedWebLinkInput.value = state.webExport.generatedLink; }
function setHostingPublishBusy(isBusy) { if (!publishHostingButton) return; publishHostingButton.disabled = isBusy; publishHostingButton.classList.toggle("publish-button--working", isBusy); publishHostingButton.textContent = isBusy ? "Publicando..." : "Publicar al hosting"; }
function resetHostingProgressUi() { if (webPublishProgressPanel) webPublishProgressPanel.hidden = false; if (webPublishProgressBarFill) webPublishProgressBarFill.style.width = "0%"; if (webPublishProgressText) webPublishProgressText.textContent = "Preparando publicacion al hosting..."; }
function updateHostingProgressUi(payload = {}) { if (webPublishProgressPanel) webPublishProgressPanel.hidden = false; const phase = String(payload.phase || ""); const completed = Number(payload.completed || 0); const total = Number(payload.total || 0); let percent = Number(payload.percent || 0); if ((!percent || !Number.isFinite(percent)) && total > 0) percent = Math.round((completed / total) * 100); percent = Math.max(0, Math.min(100, percent || 0)); if (webPublishProgressBarFill) webPublishProgressBarFill.style.width = `${percent}%`; if (webPublishProgressText) { const label = payload.label ? ` ${payload.label}` : ""; const text = phase === "exporting" ? "Preparando paquete web..." : phase === "compressing" ? `Comprimiendo ZIP${label}...` : phase === "uploading" ? `Subiendo ZIP${label}... ${completed}/${total}` : phase === "registering" ? "Registrando catalogo en el panel..." : phase === "completed" ? "Publicacion completada." : "Publicando al hosting..."; webPublishProgressText.textContent = text; } }
async function testHostingConnection() {
if (!isDesktop || !desktopApi?.testHostingConnection) return setWebExportStatus("La prueba FTP requiere la app de escritorio.", true);
const hosting = state.webExport.hosting || {};
if (!hosting.ftpHost || !hosting.ftpUser || !hosting.ftpPassword) return setWebExportStatus("Completa host, usuario y clave antes de probar FTP.", true);
setWebExportStatus("Probando conexion FTP...");
if (testHostingButton) testHostingButton.disabled = true;
try {
const result = await desktopApi.testHostingConnection({ protocol:hosting.protocol || "ftp", ftpHost:hosting.ftpHost, ftpPort:hosting.ftpPort || 21, ftpUser:hosting.ftpUser, ftpPassword:hosting.ftpPassword, remoteDir:hosting.remoteDir });
setWebExportStatus(result?.ok ? "Conexion FTP validada correctamente." : `No se pudo validar FTP: ${result?.error || "Error desconocido"}`, !result?.ok);
} catch (error) {
console.error(error);
setWebExportStatus(`No se pudo validar FTP: ${error.message}`, true);
} finally {
if (testHostingButton) testHostingButton.disabled = false;
}
}
function sanitizeRemoteDir(value) { const raw = String(value ?? "").trim().replace(/\\/g, "/"); if (!raw || raw === "." || raw === "/") return ""; const normalized = raw.replace(/\/+$/, ""); return normalized === "." ? "" : normalized; }
function buildRemoteCatalogDir(remoteDir, slug) { const baseDir = sanitizeRemoteDir(remoteDir); return baseDir ? `${baseDir}/${slug}` : slug; }
function loadHostingSettings() { try { const raw = window.localStorage?.getItem(HOSTING_SETTINGS_STORAGE_KEY); if (!raw) return { ...DEFAULT_HOSTING_SETTINGS }; return normalizeHostingSettings(JSON.parse(raw)); } catch (error) { console.error(error); return { ...DEFAULT_HOSTING_SETTINGS }; } }
async function initializePublicationSettings() {
if (!isDesktop || !desktopApi?.loadPublicationSettings) return updateSettingsPathLabel();
try {
const result = await desktopApi.loadPublicationSettings();
if (!hasHostingSettingValues(result?.settings) && hasHostingSettingValues(state.webExport.hosting)) {
await saveHostingSettings({ force:true });
return;
}
applyHostingSettings(result?.settings || DEFAULT_HOSTING_SETTINGS, result?.path || "");
if (result?.error) setWebExportStatus(`No se pudo leer settings.json. Se cargaron valores vacios: ${result.error}`, true);
} catch (error) {
console.error(error);
setWebExportStatus(`No se pudo cargar la configuracion local: ${error.message}`, true);
}
}
function normalizeHostingSettings(value = {}) {
const source = value && typeof value === "object" ? value : {};
return {
autoSave:source.autoSave !== false,
protocol:source.protocol === "ftps" ? "ftps" : "ftp",
ftpHost:String(source.ftpHost || DEFAULT_HOSTING_SETTINGS.ftpHost),
ftpPort:Number(source.ftpPort || DEFAULT_HOSTING_SETTINGS.ftpPort) || 21,
ftpUser:String(source.ftpUser || DEFAULT_HOSTING_SETTINGS.ftpUser),
ftpPassword:String(source.ftpPassword || DEFAULT_HOSTING_SETTINGS.ftpPassword),
remoteDir:String(source.remoteDir ?? DEFAULT_HOSTING_SETTINGS.remoteDir),
apiKey:String(source.apiKey || DEFAULT_HOSTING_SETTINGS.apiKey),
publicBaseUrl:sanitizeBaseUrl(source.publicBaseUrl || DEFAULT_HOSTING_SETTINGS.publicBaseUrl),
apiBaseUrl:sanitizeBaseUrl(source.apiBaseUrl || DEFAULT_HOSTING_SETTINGS.apiBaseUrl),
settingsPath:String(source.settingsPath || DEFAULT_HOSTING_SETTINGS.settingsPath)
};
}
function applyHostingSettings(settings, settingsPath = "") {
const normalized = normalizeHostingSettings({ ...settings, settingsPath:settingsPath || settings.settingsPath });
state.webExport.hosting = normalized;
state.webExport.baseUrl = normalized.publicBaseUrl;
state.webExport.apiBaseUrl = normalized.apiBaseUrl;
syncHostingInputs();
updateGeneratedLinkPreview();
updateSettingsPathLabel();
}
function collectHostingSettings() {
return normalizeHostingSettings({
...state.webExport.hosting,
publicBaseUrl:state.webExport.baseUrl,
apiBaseUrl:state.webExport.apiBaseUrl
});
}
function hasHostingSettingValues(settings = {}) {
return Boolean(settings.ftpHost || settings.ftpUser || settings.ftpPassword || settings.remoteDir || settings.apiKey || settings.publicBaseUrl || settings.apiBaseUrl);
}
async function saveHostingSettings({ force = false, showStatus = false } = {}) {
const settings = collectHostingSettings();
state.webExport.hosting = settings;
if (!force && !settings.autoSave) return;
try {
if (isDesktop && desktopApi?.savePublicationSettings) {
const result = await desktopApi.savePublicationSettings(settings);
applyHostingSettings(result?.settings || settings, result?.path || settings.settingsPath);
} else {
window.localStorage?.setItem(HOSTING_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
if (showStatus) setWebExportStatus("Configuracion de publicacion guardada en esta PC.");
} catch (error) {
console.error(error);
if (showStatus) setWebExportStatus(`No se pudo guardar la configuracion: ${error.message}`, true);
}
}
function updateHostingSettings(changes) {
state.webExport.hosting = normalizeHostingSettings({ ...state.webExport.hosting, ...changes });
saveHostingSettings();
}
async function clearHostingSettings() {
try {
let result = null;
if (isDesktop && desktopApi?.clearPublicationSettings) {
result = await desktopApi.clearPublicationSettings();
} else {
window.localStorage?.removeItem(HOSTING_SETTINGS_STORAGE_KEY);
}
applyHostingSettings(result?.settings || DEFAULT_HOSTING_SETTINGS, result?.path || "");
setWebExportStatus("Configuracion local limpiada.");
} catch (error) {
console.error(error);
setWebExportStatus(`No se pudo limpiar la configuracion: ${error.message}`, true);
}
}
function syncHostingInputs() { if (webBaseUrlInput) webBaseUrlInput.value = state.webExport.baseUrl || ""; if (webApiBaseUrlInput) webApiBaseUrlInput.value = state.webExport.apiBaseUrl || ""; if (hostingFtpProtocolInput) hostingFtpProtocolInput.value = state.webExport.hosting.protocol || "ftp"; if (hostingFtpHostInput) hostingFtpHostInput.value = state.webExport.hosting.ftpHost || ""; if (hostingFtpPortInput) hostingFtpPortInput.value = String(state.webExport.hosting.ftpPort || 21); if (hostingFtpUserInput) hostingFtpUserInput.value = state.webExport.hosting.ftpUser || ""; if (hostingFtpPasswordInput) hostingFtpPasswordInput.value = state.webExport.hosting.ftpPassword || ""; if (hostingRemoteDirInput) hostingRemoteDirInput.value = state.webExport.hosting.remoteDir || ""; if (hostingApiKeyInput) hostingApiKeyInput.value = state.webExport.hosting.apiKey || ""; if (hostingAutoSaveInput) hostingAutoSaveInput.checked = state.webExport.hosting.autoSave !== false; }
function updateSettingsPathLabel() { if (!hostingSettingsPath) return; const settingsPath = state.webExport.hosting?.settingsPath || ""; hostingSettingsPath.textContent = settingsPath ? `Archivo local: ${settingsPath}` : "La configuracion se guarda solo en esta PC."; }
function toggleSecretInput(input, button, label) { if (!input || !button) return; const isHidden = input.type === "password"; input.type = isHidden ? "text" : "password"; button.textContent = isHidden ? "Ocultar" : "Mostrar"; button.setAttribute("aria-label", `${isHidden ? "Ocultar" : "Mostrar"} ${label}`); }

function createDefaultLayoutBlocks() { return { coverTitle:{ x:0, y:0, scale:1 }, pageHeader:{ x:0, y:0, scale:1 }, pageLogo:{ x:0, y:0, scale:1 }, productsGrid:{ x:0, y:0, scale:1 }, productImage:{ x:0, y:0, scale:1 }, productCode:{ x:0, y:0, scale:1 }, productPrice:{ x:0, y:0, scale:1 }, productDescription:{ x:0, y:0, scale:1 }, productMeta:{ x:0, y:0, scale:1 }, pageFooter:{ x:0, y:0, scale:1 } }; }
function createDefaultLayoutPreset() { return { id:"default", name:"Predeterminada", blocks:createDefaultLayoutBlocks() }; }
function normalizeLayoutPreset(preset) { const defaults = createDefaultLayoutBlocks(); const safePreset = preset && typeof preset === "object" ? preset : {}; const blocks = {}; Object.keys(defaults).forEach((blockId) => { const source = safePreset.blocks?.[blockId] || {}; blocks[blockId] = { x:Number.isFinite(source.x) ? source.x : defaults[blockId].x, y:Number.isFinite(source.y) ? source.y : defaults[blockId].y, scale:Number.isFinite(source.scale) ? source.scale : defaults[blockId].scale }; }); return { id:String(safePreset.id || `preset-${Date.now()}`), name:String(safePreset.name || "Plantilla personalizada"), blocks }; }
function loadLayoutPresets() { try { const raw = window.localStorage?.getItem(LAYOUT_STORAGE_KEY); if (!raw) return { default:createDefaultLayoutPreset() }; const parsed = JSON.parse(raw); const presets = { default:createDefaultLayoutPreset() }; Object.entries(parsed || {}).forEach(([id, preset]) => { if (id === "default") return; presets[id] = normalizeLayoutPreset({ ...preset, id }); }); return presets; } catch (error) { console.error(error); return { default:createDefaultLayoutPreset() }; } }
function saveLayoutPresets() { try { window.localStorage?.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.layoutPresets)); } catch (error) { console.error(error); } }
function getActiveLayoutPreset() { return state.layoutPresets[state.activeLayoutPresetId] || state.layoutPresets.default; }
function getBlockLayout(blockId) { return getActiveLayoutPreset().blocks?.[blockId] || createDefaultLayoutBlocks()[blockId]; }
function layoutStyleAttr(blockId) { const layout = state.mode === "manual" ? getBlockLayout(blockId) : createDefaultLayoutBlocks()[blockId]; return `--layout-x:${layout.x}px; --layout-y:${layout.y}px; --layout-scale:${layout.scale};`; }
function applyLayoutStyleToDom(blockId) { document.querySelectorAll(`[data-layout-block="${blockId}"]`).forEach((node) => { node.setAttribute("style", layoutStyleAttr(blockId)); }); }
function renderLayoutPresetOptions() { if (!layoutPresetSelect) return; layoutPresetSelect.innerHTML = Object.values(state.layoutPresets).map((preset) => `<option value="${escapeHtml(preset.id)}" ${preset.id === state.activeLayoutPresetId ? "selected" : ""}>${escapeHtml(preset.name)}</option>`).join(""); }
function syncLayoutEditorControls() { if (layoutPresetSelect) layoutPresetSelect.value = state.activeLayoutPresetId; if (layoutBlockSelect) layoutBlockSelect.value = state.layoutEditor.selectedBlock; const layout = getBlockLayout(state.layoutEditor.selectedBlock); if (layoutOffsetXInput) layoutOffsetXInput.value = String(layout.x); if (layoutOffsetYInput) layoutOffsetYInput.value = String(layout.y); if (layoutScaleInput) layoutScaleInput.value = String(layout.scale); if (toggleLayoutEditorButton) { toggleLayoutEditorButton.textContent = state.layoutEditor.enabled ? "Desactivar editor" : "Activar editor"; toggleLayoutEditorButton.classList.toggle("ghost-button--active", state.layoutEditor.enabled); } }
function setLayoutEditorStatus(message, isError = false) { if (!layoutEditorStatus) return; layoutEditorStatus.textContent = message; layoutEditorStatus.style.color = isError ? "#ffd6d6" : "rgba(255,255,255,0.82)"; }
function updateActiveBlockLayout(changes) { const preset = getActiveLayoutPreset(); const current = getBlockLayout(state.layoutEditor.selectedBlock); preset.blocks[state.layoutEditor.selectedBlock] = { ...current, ...changes }; saveLayoutPresets(); syncLayoutEditorControls(); applyLayoutStyleToDom(state.layoutEditor.selectedBlock); refreshLayoutEditorOverlay(); }
function resetActiveBlockLayout() { const preset = getActiveLayoutPreset(); preset.blocks[state.layoutEditor.selectedBlock] = { ...createDefaultLayoutBlocks()[state.layoutEditor.selectedBlock] }; saveLayoutPresets(); syncLayoutEditorControls(); applyLayoutStyleToDom(state.layoutEditor.selectedBlock); refreshLayoutEditorOverlay(); }
function resetCurrentLayoutPreset() { const preset = getActiveLayoutPreset(); preset.blocks = createDefaultLayoutBlocks(); saveLayoutPresets(); syncLayoutEditorControls(); Object.keys(LAYOUT_BLOCKS).forEach(applyLayoutStyleToDom); refreshLayoutEditorOverlay(); }
function saveCurrentLayoutAsPreset() { const name = window.prompt("Nombre de la nueva plantilla editable:", `${getCurrentTemplate().name} personalizada`); if (!name) return; const id = `preset-${Date.now()}`; state.layoutPresets[id] = normalizeLayoutPreset({ id, name:name.trim(), blocks:JSON.parse(JSON.stringify(getActiveLayoutPreset().blocks)) }); state.activeLayoutPresetId = id; saveLayoutPresets(); renderLayoutPresetOptions(); syncLayoutEditorControls(); setLayoutEditorStatus(`Plantilla guardada: ${name.trim()}.`); }
function toggleLayoutEditor(forceState) { state.layoutEditor.enabled = typeof forceState === "boolean" ? forceState : !state.layoutEditor.enabled; syncLayoutEditorControls(); refreshLayoutEditorOverlay(); setLayoutEditorStatus(state.layoutEditor.enabled ? "Editor visual activo. Arrastra los bloques en la vista previa o ajusta los controles." : `Editor visual desactivado. Plantilla activa: ${getActiveLayoutPreset().name}.`); }
function refreshLayoutEditorOverlay() {
if (!layoutEditorOverlay) return;
if (!(state.layoutEditor.enabled && state.mode === "manual")) { layoutEditorOverlay.hidden = true; layoutEditorOverlay.innerHTML = ""; return; }
layoutEditorOverlay.hidden = false;
const fragments = [];
Object.entries(LAYOUT_BLOCKS).forEach(([blockId, label]) => {
const target = catalogRoot?.querySelector(`[data-layout-block="${blockId}"]`);
if (!target) return;
const rect = target.getBoundingClientRect();
if (rect.width < 6 || rect.height < 6) return;
fragments.push(`<button class="layout-editor-handle ${state.layoutEditor.selectedBlock === blockId ? "layout-editor-handle--selected" : ""}" data-layout-handle="${blockId}" type="button" style="left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px;"><span class="layout-editor-handle__label">${escapeHtml(label)}</span></button>`);
});
layoutEditorOverlay.innerHTML = fragments.join("");
layoutEditorOverlay.querySelectorAll("[data-layout-handle]").forEach((handle) => {
handle.addEventListener("click", () => { state.layoutEditor.selectedBlock = handle.getAttribute("data-layout-handle") || "coverTitle"; syncLayoutEditorControls(); refreshLayoutEditorOverlay(); });
handle.addEventListener("pointerdown", (event) => startLayoutDrag(event, handle.getAttribute("data-layout-handle") || "coverTitle"));
});
}
function startLayoutDrag(event, blockId) {
event.preventDefault();
state.layoutEditor.selectedBlock = blockId;
syncLayoutEditorControls();
const current = getBlockLayout(blockId);
const drag = { blockId, startX:event.clientX, startY:event.clientY, originX:current.x, originY:current.y };
const onMove = (moveEvent) => { updateActiveBlockLayout({ x:Math.round(drag.originX + (moveEvent.clientX - drag.startX)), y:Math.round(drag.originY + (moveEvent.clientY - drag.startY)) }); };
const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); setLayoutEditorStatus(`Bloque actualizado: ${LAYOUT_BLOCKS[blockId]}.`); };
window.addEventListener("pointermove", onMove);
window.addEventListener("pointerup", onUp);
}

async function loadRecordsFromFile(file) {
if (!window.XLSX) return setStatus("No se pudo cargar la libreria XLSX en el navegador.", true);
setStatus("Leyendo Excel...");
try { const buffer = await file.arrayBuffer(); state.records = parseWorkbookFromBuffer(buffer); state.sourceExcelName = file.name || ""; if (webCatalogSlugInput && !state.webExport.slugEdited && (!webCatalogSlugInput.value || webCatalogSlugInput.value === "catalogo-publicable")) { const nextSlug = sanitizeSlug(file.name.replace(/\.[^.]+$/, "")) || "catalogo-publicable"; webCatalogSlugInput.value = nextSlug; state.webExport.slug = nextSlug; updateGeneratedLinkPreview(); } reindexMainImages(); reindexExtraMedia(); setStatus(`Excel cargado correctamente. Productos detectados: ${state.records.length}. Imagenes principales indexadas: ${state.imageMap.size}.`); refreshCatalogIfReady(); } catch (error) { console.error(error); setStatus(`No fue posible leer el Excel: ${error.message}`, true); }
}

function parseWorkbookFromBuffer(buffer) {
const workbook = XLSX.read(buffer, { type: "array" });
const firstSheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[firstSheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
if (!rows.length) throw new Error("El Excel no contiene filas de productos.");
const columnMap = resolveColumnMap(Object.keys(rows[0]));
if (!columnMap.item || !columnMap.description || !columnMap.price) throw new Error("El Excel debe incluir como minimo ITEM, DESCRIPCION y PRECIO.");
return rows.map((row) => normalizeRecord(row, columnMap)).filter((record) => record.item);
}

function resolveColumnMap(columns) {
const normalizedColumns = new Map(columns.map((column) => [normalizeKey(column), column]));
const resolved = {};
Object.entries(REQUIRED_ALIASES).forEach(([field, aliases]) => { const match = aliases.find((alias) => normalizedColumns.has(normalizeKey(alias))); if (match) resolved[field] = normalizedColumns.get(normalizeKey(match)); });
return resolved;
}

function normalizeRecord(row, columnMap) {
const description = safeText(row[columnMap.description]);
const category = safeText(row.CATEGORIA || row.CATEGORY || row.LINEA || row.LINE || row.FAMILIA);
const brand = safeText(row.MARCA || row.BRAND);
const material = safeText(row.MATERIAL);
const size = safeText(row.TAMANO || row['TAMAÑO'] || row.SIZE);
const saleUnit = safeText(row['UNIDAD_VENTA'] || row['UNIDAD DE VENTA'] || row.VENTA || row.UM) || "bulto";
const minimumOrder = parsePackageQty(row.MINIMO || row['MINIMO PEDIDO'] || 1);
const multipleQty = parsePackageQty(row.MULTIPLO || row['MULTIPLO'] || 1);
return { item:safeText(row[columnMap.item]), description, shortTitle:summarizeTitle(description), shortDescription:summarizeDescription(description), price:formatPrice(row[columnMap.price]), available:safeText(row[columnMap.available]), barcode:safeText(row[columnMap.barcode]), package:safeText(row[columnMap.package]), um:safeText(row[columnMap.um]), ctn:safeText(row[columnMap.ctn]), cub:safeText(row[columnMap.cub]), measureBadge:extractMeasureBadge(description), category, brand, material, size, saleUnit, minimumOrder, multipleQty };
}

function renderCatalog(options = {}) {
if (options.syncInputs !== false) syncStateFromManualInputs();
applyThemeVariables();
const pages = paginate(state.records, state.productsPerPage);
const fragments = [];
if (state.includeCover) fragments.push(renderCover());
pages.forEach((pageProducts, index) => { fragments.push(renderPage(pageProducts, index + 1, pages.length)); });
catalogRoot.innerHTML = fragments.join("");
refreshLayoutEditorOverlay();
}

function renderCover() {
const template = getCurrentTemplate();
const art = state.coverImageUrl ? `<div class="cover-page__art cover-page__art--full"><img src="${state.coverImageUrl}" alt="Portada"></div>` : `<div class="cover-page__art cover-page__art--placeholder"><span>${escapeHtml(template.coverIntro)}</span></div>`;
return `
<section class="cover-page ${template.coverClass}">
<div class="cover-page__bg"></div>
<div class="cover-page__overlay ${state.coverImageUrl ? "cover-page__overlay--with-art" : ""}"></div>
<div class="cover-page__frame"></div>
${art}
<div class="cover-page__title" data-layout-block="coverTitle" style="${layoutStyleAttr("coverTitle")}">
<p class="cover-page__eyebrow">${escapeHtml(template.coverIntro)}</p>
<h2>${escapeHtml(state.title)}</h2>
<p class="cover-page__subtitle">${escapeHtml(state.footerText)}</p>
</div>
</section>`;
}

function renderPage(products, pageNumber, totalPages) {
const template = getCurrentTemplate();
if (template.pageRenderer) return template.pageRenderer(products, pageNumber, totalPages);
const backgroundMarkup = state.pageBackgroundUrl ? `<div class="catalog-page__bg catalog-page__bg--image" style="background-image: url('${escapeHtml(state.pageBackgroundUrl)}'); opacity: ${state.pageBackgroundOpacity.toFixed(2)};"></div>` : `<div class="catalog-page__bg"></div>`;
const headerClass = state.pageLogoUrl ? `page-header page-header--with-logo page-header--logo-${state.pageLogoPosition}` : "page-header";
return `
<section class="catalog-page ${template.pageClass}">
${backgroundMarkup}
<div class="catalog-page__chrome"></div>
<div class="${headerClass}" data-layout-block="pageHeader" style="${layoutStyleAttr("pageHeader")}">${renderPageLogo()}<div class="page-header__accent"></div><div class="page-header__copy"><p class="page-header__eyebrow">${escapeHtml(template.headerEyebrow)}</p><h2 class="page-header__title">${escapeHtml(state.title)}</h2></div></div>
<div class="products-grid" data-layout-block="productsGrid" style="${layoutStyleAttr("productsGrid")}">${products.map((product) => template.cardRenderer(product, resolveProductImage(product), buildMetaItems(product))).join("")}</div>
<footer class="page-footer" data-layout-block="pageFooter" style="${layoutStyleAttr("pageFooter")}"><div class="page-footer__line"></div><div class="page-footer__band"><span class="page-footer__label">${escapeHtml(state.footerText)}</span></div><div class="page-footer__number ${pageNumber === totalPages ? "page-footer__number--right" : ""}">${pageNumber}</div></footer>
</section>`;
}

function renderCampinPage(products, pageNumber, totalPages) {
const template = getCurrentTemplate();
const [heroProduct, ...secondaryProducts] = products;
const heroImage = heroProduct ? resolveProductImage(heroProduct) : { url:PLACEHOLDER_DATA_URI, isPlaceholder:true };
const backgroundMarkup = state.pageBackgroundUrl ? `<div class="catalog-page__bg catalog-page__bg--image" style="background-image: url('${escapeHtml(state.pageBackgroundUrl)}'); opacity: ${state.pageBackgroundOpacity.toFixed(2)};"></div>` : `<div class="catalog-page__bg"></div>`;
const headerClass = state.pageLogoUrl ? `campin1-header campin1-header--with-logo campin1-header--logo-${state.pageLogoPosition}` : "campin1-header";
const heroMeta = heroProduct ? buildMetaItems(heroProduct).slice(0, 3) : [];
return `
<section class="catalog-page ${template.pageClass}">
${backgroundMarkup}
<div class="catalog-page__chrome"></div>
<div class="${headerClass}" data-layout-block="pageHeader" style="${layoutStyleAttr("pageHeader")}"><div class="campin1-header__brand">${renderPageLogo()}<div class="campin1-header__copy"><p class="campin1-header__eyebrow">${escapeHtml(template.headerEyebrow)}</p><h2 class="campin1-header__title">${escapeHtml(state.title || "CAMPIN1")}</h2><p class="campin1-header__sub">Outdoor catalog premium</p></div></div><div class="campin1-header__pill">Camping</div></div>
<section class="campin1-hero" ${heroProduct ? `data-item="${escapeHtml(heroProduct.item)}"` : ""}>
<div class="campin1-hero__copy"><p class="campin1-hero__kicker">Hero product</p><h3 class="campin1-hero__title" data-layout-block="productCode" style="${layoutStyleAttr("productCode")}">${escapeHtml(heroProduct?.description || heroProduct?.shortTitle || heroProduct?.item || "Equipo listo para cada aventura")}</h3><p class="campin1-hero__description" data-layout-block="productDescription" style="${layoutStyleAttr("productDescription")}">${escapeHtml(heroProduct ? (heroProduct.shortDescription || heroProduct.description || "") : "Catalogo editorial de camping con imagen protagonista, precio visible y datos comerciales claros.")}</p><div class="campin1-hero__badges" data-layout-block="productMeta" style="${layoutStyleAttr("productMeta")}"><span class="campin1-badge">Outdoor</span><span class="campin1-badge">Venta directa</span>${heroProduct?.measureBadge ? `<span class="campin1-badge">${escapeHtml(heroProduct.measureBadge)}</span>` : ""}</div><div class="campin1-hero__price" data-layout-block="productPrice" style="${layoutStyleAttr("productPrice")}">${escapeHtml(heroProduct?.price || "$0.00")}</div><div class="campin1-hero__meta">${heroProduct ? `<span>ITEM: ${escapeHtml(heroProduct.item)}</span>` : ""}${heroProduct?.available ? `<span>Disponible: ${escapeHtml(heroProduct.available)}</span>` : ""}${heroMeta.map((item) => `<span>${escapeHtml(item.label)}: ${escapeHtml(item.value)}</span>`).join("")}</div></div>
<div class="campin1-hero__visual" data-layout-block="productImage" style="${layoutStyleAttr("productImage")}">${renderImage(heroImage, heroProduct?.item || "Hero")}</div>
</section>
<div class="campin1-grid" data-layout-block="productsGrid" style="${layoutStyleAttr("productsGrid")}">${secondaryProducts.map((product) => template.cardRenderer(product, resolveProductImage(product), buildMetaItems(product))).join("")}</div>
<footer class="page-footer campin1-footer" data-layout-block="pageFooter" style="${layoutStyleAttr("pageFooter")}"><div class="page-footer__line"></div><div class="page-footer__band"><span class="page-footer__label">${escapeHtml(state.footerText || "Catalogo comercial · CAMPIN1")}</span></div><div class="page-footer__number ${pageNumber === totalPages ? "page-footer__number--right" : ""}">${pageNumber}</div></footer>
</section>`;
}

function renderPageLogo() { return !state.pageLogoUrl ? "" : `<div class="page-header__logo" data-layout-block="pageLogo" style="${layoutStyleAttr("pageLogo")}"><img src="${state.pageLogoUrl}" alt="Logo"></div>`; }
function renderClassicCard(product, image, metaItems) {
  return `<article class="product-card product-card--classic" data-item="${escapeHtml(product.item)}"><div class="product-card__title-bar">${escapeHtml(product.shortTitle || product.description || product.item)}</div><div class="product-card__image-wrap" data-layout-block="productImage">${renderMeasureBadge(product)}${renderImage(image, product.item)}</div><div class="product-card__info-row"><p class="product-card__code" data-layout-block="productCode"><span>ITEM:</span> ${escapeHtml(product.item)}</p><p class="product-card__price" data-layout-block="productPrice">${escapeHtml(product.price || "$0.00")}</p></div><p class="product-card__description" data-layout-block="productDescription">${escapeHtml(product.shortDescription || product.description || "")}</p>${renderMetaChips(metaItems)}</article>`;
  }
function renderEditorialCard(product, image, metaItems) {
  return `<article class="product-card product-card--editorial" data-item="${escapeHtml(product.item)}"><div class="product-card__editorial-top"><p class="product-card__kicker" data-layout-block="productCode">Referencia ${escapeHtml(product.item)}</p><p class="product-card__price" data-layout-block="productPrice">${escapeHtml(product.price || "$0.00")}</p></div><div class="product-card__image-wrap" data-layout-block="productImage">${renderMeasureBadge(product)}${renderImage(image, product.item)}</div><div class="product-card__editorial-body"><p class="product-card__description product-card__description--single" data-layout-block="productDescription">${escapeHtml(product.description || product.shortDescription || "")}</p>${renderMetaList(metaItems)}</div></article>`;
  }
function renderIndustrialCard(product, image, metaItems) {
  return `<article class="product-card product-card--industrial" data-item="${escapeHtml(product.item)}"><div class="product-card__industrial-head"><p class="product-card__code" data-layout-block="productCode"><span>ITEM</span> ${escapeHtml(product.item)}</p><p class="product-card__price" data-layout-block="productPrice">${escapeHtml(product.price || "$0.00")}</p></div><div class="product-card__image-wrap" data-layout-block="productImage">${renderMeasureBadge(product)}${renderImage(image, product.item)}</div><div class="product-card__industrial-body"><p class="product-card__description product-card__description--single" data-layout-block="productDescription">${escapeHtml(product.description || product.shortDescription || "")}</p>${renderMetaGrid(metaItems)}</div></article>`;
  }
function renderMinimalCard(product, image, metaItems) {
  return `<article class="product-card product-card--minimal" data-item="${escapeHtml(product.item)}"><div class="product-card__image-wrap" data-layout-block="productImage">${renderMeasureBadge(product)}${renderImage(image, product.item)}</div><div class="product-card__minimal-body"><p class="product-card__kicker" data-layout-block="productCode">ITEM ${escapeHtml(product.item)}</p><p class="product-card__description product-card__description--single" data-layout-block="productDescription">${escapeHtml(product.description || product.shortDescription || "")}</p><div class="product-card__minimal-footer"><p class="product-card__price" data-layout-block="productPrice">${escapeHtml(product.price || "$0.00")}</p>${renderMetaInline(metaItems)}</div></div></article>`;
  }
function renderShowcaseCard(product, image, metaItems) {
  return `<article class="product-card product-card--showcase" data-item="${escapeHtml(product.item)}"><div class="product-card__image-wrap" data-layout-block="productImage">${renderMeasureBadge(product)}${renderImage(image, product.item)}</div><div class="product-card__showcase-body"><div class="product-card__showcase-header"><p class="product-card__code" data-layout-block="productCode"><span>ITEM:</span> ${escapeHtml(product.item)}</p><p class="product-card__price" data-layout-block="productPrice">${escapeHtml(product.price || "$0.00")}</p></div><p class="product-card__description product-card__description--single" data-layout-block="productDescription">${escapeHtml(product.description || product.shortDescription || "")}</p>${renderMetaChips(metaItems)}</div></article>`;
  }
function renderHorizonCard(product, image, metaItems) {
  return `<article class="product-card product-card--horizon" data-item="${escapeHtml(product.item)}"><div class="product-card__horizon-media"><div class="product-card__image-wrap" data-layout-block="productImage">${renderMeasureBadge(product)}${renderImage(image, product.item)}</div></div><div class="product-card__horizon-body"><div class="product-card__horizon-head"><div><p class="product-card__kicker" data-layout-block="productCode">Item ${escapeHtml(product.item)}</p></div><p class="product-card__price" data-layout-block="productPrice">${escapeHtml(product.price || "$0.00")}</p></div><p class="product-card__description product-card__description--single product-card__description--wide" data-layout-block="productDescription">${escapeHtml(product.description || product.shortDescription || "")}</p>${renderMetaGrid(metaItems)}</div></article>`;
  }
function renderLedgerCard(product, image, metaItems) {
  return `<article class="product-card product-card--ledger" data-item="${escapeHtml(product.item)}"><div class="product-card__ledger-band"><p class="product-card__kicker" data-layout-block="productCode">Ficha ${escapeHtml(product.item)}</p><p class="product-card__price" data-layout-block="productPrice">${escapeHtml(product.price || "$0.00")}</p></div><div class="product-card__ledger-main"><div class="product-card__ledger-media"><div class="product-card__image-wrap" data-layout-block="productImage">${renderMeasureBadge(product)}${renderImage(image, product.item)}</div></div><div class="product-card__ledger-copy"><p class="product-card__description product-card__description--single product-card__description--wide" data-layout-block="productDescription">${escapeHtml(product.description || product.shortDescription || "")}</p>${renderMetaList(metaItems)}</div></div></article>`;
  }
function renderCampinCard(product, image, metaItems) {
  return `<article class="product-card product-card--campin1" data-item="${escapeHtml(product.item)}"><div class="product-card__campin-visual product-card__image-wrap" data-layout-block="productImage">${renderMeasureBadge(product)}${renderImage(image, product.item)}</div><div class="product-card__campin-body"><h3 class="product-card__headline" data-layout-block="productCode">${escapeHtml(product.shortTitle || summarizeTitle(product.description || product.item || ""))}</h3><p class="product-card__description product-card__description--single" data-layout-block="productDescription">${escapeHtml(product.shortDescription || summarizeDescription(product.description || ""))}</p><div class="product-card__campin-row"><span class="product-card__code" data-layout-block="productCode">ITEM: ${escapeHtml(product.item)}</span><span class="product-card__price" data-layout-block="productPrice">${escapeHtml(product.price || "$0.00")}</span></div><div class="product-card__campin-meta" data-layout-block="productMeta"><span class="product-card__campin-pill">${escapeHtml(product.available ? `Disponible: ${product.available}` : "Sin dato")}</span>${metaItems.slice(1, 2).map((item) => `<span class="product-card__campin-pill">${escapeHtml(item.label)}: ${escapeHtml(item.value)}</span>`).join("")}</div></div></article>`;
  }

function resolveProductImage(product) { const imageUrl = state.imageMap.get(normalizeIdentifier(product.item)) || PLACEHOLDER_DATA_URI; return { url:imageUrl, isPlaceholder:imageUrl === PLACEHOLDER_DATA_URI }; }
function renderImage(image, altText) { return image.isPlaceholder ? `<div class="product-card__placeholder">Imagen no disponible</div>` : `<img class="product-card__image" src="${image.url}" alt="${escapeHtml(altText)}">`; }
function renderMeasureBadge(product) { return product.measureBadge ? `<span class="product-card__measure">${escapeHtml(product.measureBadge)}</span>` : ""; }
function buildMetaItems(product) { return [{ label:"Disp", value:product.available }, { label:"CB", value:product.barcode }, { label:"Emp", value:product.package }, { label:"UM", value:product.um }, { label:"CTN", value:product.ctn }, { label:"CUB", value:product.cub }].filter((item) => item.value); }
function renderMetaChips(metaItems) { return !metaItems.length ? "" : `<div class="product-card__meta" data-layout-block="productMeta">${metaItems.map((item) => `<span class="product-card__chip"><span>${escapeHtml(item.label)}</span> ${escapeHtml(item.value)}</span>`).join("")}</div>`; }
function renderMetaList(metaItems) { return !metaItems.length ? "" : `<div class="product-card__meta-list" data-layout-block="productMeta">${metaItems.map((item) => `<p><span>${escapeHtml(item.label)}</span>${escapeHtml(item.value)}</p>`).join("")}</div>`; }
function renderMetaGrid(metaItems) { return !metaItems.length ? "" : `<div class="product-card__meta-grid" data-layout-block="productMeta">${metaItems.map((item) => `<div class="product-card__meta-box"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("")}</div>`; }
function renderMetaInline(metaItems) { return !metaItems.length ? "" : `<div class="product-card__meta-inline" data-layout-block="productMeta">${metaItems.slice(0, 3).map((item) => `<span>${escapeHtml(item.label)} ${escapeHtml(item.value)}</span>`).join("")}</div>`; }

function renderBatchCategoryList() {
if (!batchCategoryList) return;
if (!state.batch.categories.length) { batchCategoryList.innerHTML = `<p class="batch-empty">Selecciona el Excel base, la carpeta de imagenes y la carpeta destino para empezar.</p>`; return; }
batchCategoryList.innerHTML = state.batch.categories.map((category, index) => `
<div class="batch-category ${state.batch.previewIndex === index ? "batch-category--active" : ""}" data-category-index="${index}">
<div class="batch-category__main"><label class="batch-category__toggle"><input class="batch-category__enabled" type="checkbox" ${category.selected ? "checked" : ""}><span>${escapeHtml(category.name)}</span></label><p class="batch-category__meta">${category.imageFiles.length} imagenes${category.coverPath ? " | cover" : ""}${category.logoPath ? " | logo" : ""}</p></div>
<div class="batch-category__settings">
<label class="control-field"><span>Plantilla</span><select class="batch-category__template">${renderTemplateOptions(category.template || state.batch.template)}</select></label>
<label class="control-field"><span>Color principal</span><input class="batch-category__primary" type="color" value="${escapeHtml(category.primaryColor || state.batch.primaryColor)}"></label>
<label class="control-field"><span>Color secundario</span><input class="batch-category__secondary" type="color" value="${escapeHtml(category.secondaryColor || state.batch.secondaryColor)}"></label>
<label class="control-field"><span>Logo en pagina</span><select class="batch-category__logo-position"><option value="right" ${(category.logoPosition || state.batch.logoPosition) === "right" ? "selected" : ""}>Derecha</option><option value="left" ${(category.logoPosition || state.batch.logoPosition) === "left" ? "selected" : ""}>Izquierda</option></select></label>
</div><div class="batch-category__actions"><button class="batch-category__preview" type="button">Ver vista previa</button></div></div>`).join("");
}
function renderTemplateOptions(selectedValue) { return Object.entries(TEMPLATE_DEFS).map(([value, template]) => `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(template.name)}</option>`).join(""); }
function setMode(mode) { state.mode = mode; const isManual = mode === "manual"; manualModeButton?.classList.toggle("mode-switch__button--active", isManual); batchModeButton?.classList.toggle("mode-switch__button--active", !isManual); manualPanels.forEach((panel) => { panel.hidden = !isManual; }); batchPanels.forEach((panel) => { panel.hidden = isManual; }); if (!isManual && state.layoutEditor.enabled) toggleLayoutEditor(false); refreshLayoutEditorOverlay(); }
function refreshCatalogIfReady() { if (state.records.length) renderCatalog(); renderWebPreview(); }
function syncStateFromManualInputs() { state.title = titleInput?.value.trim() || state.title; state.footerText = footerInput?.value.trim() || state.footerText; state.includeCover = Boolean(includeCoverInput?.checked); state.template = templateSelect?.value || state.template; state.primaryColor = primaryColorInput?.value || state.primaryColor; state.secondaryColor = secondaryColorInput?.value || state.secondaryColor; state.pageLogoPosition = pageLogoPositionInput?.value || state.pageLogoPosition; state.pageBackgroundOpacity = readBackgroundOpacity(pageBackgroundOpacityInput); const perPage = Number(productsPerPageInput?.value); state.productsPerPage = Number.isFinite(perPage) && perPage > 0 ? perPage : state.productsPerPage; }
function applyThemeVariables() { document.documentElement.style.setProperty("--red-primary", state.primaryColor); document.documentElement.style.setProperty("--red-dark", state.primaryColor); document.documentElement.style.setProperty("--footer-black", state.secondaryColor); }
function setStatus(message, isError = false) { if (!statusMessage) return; statusMessage.textContent = message; statusMessage.style.color = isError ? "#ffd6d6" : "rgba(255,255,255,0.82)"; }
function setBatchStatus(message, isError = false) { if (!batchStatusMessage) return; batchStatusMessage.textContent = message; batchStatusMessage.style.color = isError ? "#ffd6d6" : "rgba(255,255,255,0.82)"; }
function buildImageMapFromFiles(files) { const map = new Map(); const knownItems = new Set(state.records.map((record) => normalizeIdentifier(record.item)).filter(Boolean)); files.forEach((file) => { const stem = resolveMainMediaItemKey(file.name || "", knownItems); if (!stem || map.has(stem)) return; map.set(stem, URL.createObjectURL(file)); }); return map; }
async function buildCompressedImageMapFromPaths(paths, quality) { const map = new Map(); for (const filePath of paths) { const stem = normalizeIdentifier(String(filePath).split(/[\\/]/).pop().replace(/\.[^.]+$/, "")); if (!stem || map.has(stem)) continue; map.set(stem, await compressImagePath(filePath, quality, 1800)); } return map; }
function buildPreviewImageMapFromPaths(paths) { const map = new Map(); for (const filePath of paths) { const stem = normalizeIdentifier(String(filePath).split(/[\\/]/).pop().replace(/\.[^.]+$/, "")); if (!stem || map.has(stem)) continue; map.set(stem, pathToFileUrl(filePath)); } return map; }
async function compressImagePath(filePath, quality, maxDimension) { const lower = String(filePath).toLowerCase(); if (lower.endsWith(".svg")) return pathToFileUrl(filePath); const source = pathToFileUrl(filePath); const img = await loadImage(source); const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight)); const width = Math.max(1, Math.round(img.naturalWidth * scale)); const height = Math.max(1, Math.round(img.naturalHeight * scale)); const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height); return canvas.toDataURL("image/jpeg", quality); }
function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`)); image.src = src; }); }
function replaceObjectUrl(currentUrl, file) { if (currentUrl && currentUrl.startsWith("blob:")) URL.revokeObjectURL(currentUrl); return file ? URL.createObjectURL(file) : ""; }
function revokeObjectUrls(urls) { urls.forEach((url) => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); }); }
function recommendedProductsPerPage(template) { if (template === "campin1") return 5; return isHorizontalTemplate(template) ? 4 : 6; }
function isHorizontalTemplate(template) { return template === "horizon" || template === "ledger"; }
function getCurrentTemplate() { return TEMPLATE_DEFS[state.template] || TEMPLATE_DEFS.classic; }
function templateDef(pageClass, coverClass, name, coverIntro, headerEyebrow, cardRenderer) { return { pageClass, coverClass, name, coverIntro, headerEyebrow, cardRenderer }; }
function formatPrice(value) { if (value === null || value === undefined || value === "") return ""; const numeric = Number(String(value).replace(/,/g, "").trim()); if (Number.isNaN(numeric)) return String(value); return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric); }
function safeText(value) { if (value === null || value === undefined) return ""; const text = String(value).trim(); if (!text) return ""; if (/^\d+\.0$/.test(text)) return text.slice(0, -2); return text; }
function summarizeTitle(text) { const clean = collapseWhitespace(text); return clean.length <= 52 ? clean : `${clean.slice(0, 49).trimEnd()}...`; }
function summarizeDescription(text) { const clean = collapseWhitespace(text); return clean.length <= 88 ? clean : `${clean.slice(0, 85).trimEnd()}...`; }
function collapseWhitespace(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function extractMeasureBadge(text) { const clean = collapseWhitespace(text).toUpperCase(); const diaMatch = clean.match(/\bDIA\.?\s*(\d{1,3}(?:[.,]\d+)?)\s*CM\b/); if (diaMatch) return `${diaMatch[1].replace(",", ".")}CM`; const cmMatch = clean.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*CM\b/); if (cmMatch) return `${cmMatch[1].replace(",", ".")}CM`; const inchMatch = clean.match(/\b(\d{1,2})\s*[\"]/); if (inchMatch) return `${inchMatch[1]}\"`; return ""; }
function paginate(items, perPage) { const pages = []; for (let index = 0; index < items.length; index += perPage) pages.push(items.slice(index, index + perPage)); return pages; }
function normalizeKey(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase(); }
function normalizeIdentifier(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]+/g, "").trim().toLowerCase(); }
function readBackgroundOpacity(input) { const value = Number(input?.value); return Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.35) : 0.12; }
function escapeHtml(text) { return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
function sanitizeFileName(value) { return String(value || "catalogo").replace(/[<>:\"/\\|?*]+/g, "").trim() || "catalogo"; }
function pickDefaultCategoryColor(index, type) { const palettes = [["#b7192e", "#1d1d1b"], ["#7f8f55", "#2f3b29"], ["#1d6f8b", "#173642"], ["#c46a2d", "#4b2d1c"], ["#824d84", "#2f2232"], ["#4f6c88", "#243646"]]; const pair = palettes[index % palettes.length]; return type === "primary" ? pair[0] : pair[1]; }
function byId(id) { return document.getElementById(id); }
function pathToFileUrl(filePath) { return `file:///${String(filePath).replace(/\\/g, "/")}`; }
function createPlaceholderDataUri() { const svg = ["<svg xmlns='http://www.w3.org/2000/svg' width='420' height='280'>", "<rect width='100%' height='100%' rx='18' fill='#f6f4ef' stroke='#ddd8d0' stroke-width='2'/>", "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#8d8b85' font-family='Arial, Helvetica, sans-serif' font-size='22'>Imagen no disponible</text>", "</svg>"].join(""); return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
async function waitForImagesToLoad(container) { const images = Array.from(container.querySelectorAll("img")); await Promise.all(images.map((img) => { if (img.complete) return Promise.resolve(); return new Promise((resolve) => { img.addEventListener("load", resolve, { once: true }); img.addEventListener("error", resolve, { once: true }); }); })); }
window.addEventListener("beforeunload", () => { if (state.coverImageUrl?.startsWith("blob:")) URL.revokeObjectURL(state.coverImageUrl); if (state.pageLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(state.pageLogoUrl); if (state.pageBackgroundUrl?.startsWith("blob:")) URL.revokeObjectURL(state.pageBackgroundUrl); revokeObjectUrls(state.imageUrls); });
})();
