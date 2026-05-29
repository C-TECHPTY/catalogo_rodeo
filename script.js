
/**
 * CatÃ¡logo Rodeo B2B
 * Nombre actual/provisional del sistema.
 *
 * Autor principal: Nelson SÃ¡nchez
 * AÃ±o: 2026
 *
 * Sistema desarrollado para generaciÃ³n de catÃ¡logos digitales,
 * gestiÃ³n visual de productos, publicaciÃ³n web y pedidos comerciales.
 *
 * Todos los derechos reservados.
 *
 * Nota:
 * Este encabezado documenta autorÃ­a y evoluciÃ³n del sistema.
 * No modifica el funcionamiento del cÃ³digo.
 */

(function () {
const desktopApi = window.catalogDesktop || null;
const isDesktop = Boolean(desktopApi?.isDesktop);
const LAYOUT_STORAGE_KEY = "catalogLayoutPresetsV1";
const HOSTING_SETTINGS_STORAGE_KEY = "catalogHostingSettingsV1";
const IMAGE_SOURCE_SETTINGS_STORAGE_KEY = "catalogImageSourceSettingsV1";
const IMAGE_STORAGE_SETTINGS_STORAGE_KEY = "catalogImageStorageSettingsV1";
const BRAND_VISUAL_PRESETS_STORAGE_KEY = "catalogBrandVisualPresetsV1";
const GENERAL_VISUAL_PRESET_KEY = "__general__";
const PRICE_FACTOR_55 = 0.55;
const DEFAULT_FEATURED_BRANDS = ["LUXURY HOME LINENS", "ACENOX", "ROBERT HAMILTON", "MARANELO", "DISCOVERY EXPEDITION", "HOME BLANK", "FINECASA"];
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
saasValidationEnabled:false,
saasLicenseKey:"",
saasCompanySlug:"",
saasApiBaseUrl:"",
settingsPath:""
};
const DEFAULT_IMAGE_SOURCE_SETTINGS = {
mode:"local",
editedBaseUrl:"",
originalBaseUrl:"",
galleryBaseUrl:"",
defaultExtension:"jpg",
namePattern:"{ITEM}.{EXT}",
gallerySlots:3
};
const DEFAULT_IMAGE_STORAGE_SETTINGS = {
mode:"hosting"
};
const LAYOUT_BLOCKS = { coverTitle:"Portada titulo", pageHeader:"Encabezado", pageLogo:"Logo pagina", productsGrid:"Bloque productos", productImage:"Imagen producto", productCode:"Codigo producto", productPrice:"Precio", productDescription:"Descripcion", productMeta:"Datos tecnicos", pageFooter:"Footer" };
const initialHostingSettings = loadHostingSettings();
const DEFAULT_HERO_SUBTITLE = "Pedidos por empaque, link trazable y salida operativa en Excel/CSV/XLSX.";
const DEFAULT_GENERAL_VISUAL = {
brand:"Catalogo completo",
primaryColor:"#2558b7",
secondaryColor:"#12284d",
coverImagePath:"",
pageLogoPath:"hosting/catalogos_admin/assets/logo-rodeo-azul.png",
pageLogoPosition:"left",
pageBackgroundPath:"",
pageBackgroundOpacity:0.12,
heroImagePath:"",
heroSubtitle:DEFAULT_HERO_SUBTITLE,
promotion:{ title:"Oferta destacada para compras mayoristas", text:"Imagen o video opcional con fallback movil.", imagePath:"", imagePaths:[], videoPath:"", linkLabel:"Consultar promocion", linkUrl:"", slideInterval:15000 },
updatedAt:""
};
const state = { mode:"manual", previewMode:"web", records:[], sourceRecords:[], sourceExcelName:"", imageFiles:[], imageMap:new Map(), imageUrls:[], imageSourceMap:new Map(), imageMatchMode:"file-input", hideMissingImages:false, extraMediaFiles:[], extraMediaMap:new Map(), remoteImageCheckCache:new Map(), title:"Acenox Catalogo Comercial", footerText:"Catalogo comercial interno Acenox", includeCover:true, template:"classic", productsPerPage:6, primaryColor:"#2c4695", secondaryColor:"#1d1d1b", coverImageUrl:"", coverImagePath:"", pageLogoUrl:"", pageLogoPath:"", pageLogoPosition:"right", pageBackgroundUrl:"", pageBackgroundPath:"", pageBackgroundOpacity:0.12, heroImageUrl:"", heroImagePath:"", heroSubtitle:DEFAULT_HERO_SUBTITLE, priceMode:"original", entryFilter:"", brandExportMode:"complete", brandFilter:"", smartCategoryFilter:"", descriptionSearch:"", featuredBrandsEnabled:true, featuredBrands:[], imageStorage:loadImageStorageSettings(), imageSource:loadImageSourceSettings(), brandVisualPresets:loadBrandVisualPresets(), promotion:{ title:"Oferta destacada para compras mayoristas", text:"Configura una imagen liviana o video opcional sin afectar la carga movil.", imageUrl:"", imagePath:"", imageUrls:[], imagePaths:[], videoUrl:"", videoPath:"", linkLabel:"Consultar promocion", linkUrl:"", slideInterval:15000 }, webExport:{ slug:"catalogo-publicable", slugEdited:false, expiryDays:30, outputDir:"", baseUrl:initialHostingSettings.publicBaseUrl, apiBaseUrl:initialHostingSettings.apiBaseUrl, generatedLink:"", hosting:initialHostingSettings }, layoutPresets:loadLayoutPresets(), activeLayoutPresetId:"default", layoutEditor:{ enabled:false, selectedBlock:"coverTitle", drag:null }, batch:{ excelPath:"", imagesRoot:"", outputRoot:"", template:"editorial", quality:0.72, priceMode:"original", entryFilter:"", primaryColor:"#2c4695", secondaryColor:"#1d1d1b", logoPosition:"right", categories:[], previewIndex:-1, progress:{ completed:0, total:0 } } };
const REQUIRED_ALIASES = { item:["ITEM"], description:["DESCRIPCION","DESCRIPCION ","NOMBRE","PRODUCTO"], price:["PRECIO","PRICE","PVP"], category:["CATEGORIA","CATEGORY","LINEA","LINE","FAMILIA","GRUPO","DEPARTAMENTO","RUBRO","TIPO"], entry:["ENTRADA","ENTRY","LOTE","IMPORTACION"], brand:["MARCA","BRAND","FABRICANTE"], available:["DISPONIBLE","DISP.","DISP","STOCK","EXISTENCIA"], barcode:["CBARRA","CB","CODIGOBARRAS","CODIGO DE BARRAS"], package:["EMPAQUE","PACK","PAQUETE"], um:["UM"], ctn:["CTN"], cub:["CUB.","CUB","CUBICAJE"], material:["MATERIAL"], size:["TAMANO","SIZE","MEDIDA","MEDIDAS","DIMENSION"], saleUnit:["UNIDAD_VENTA","UNIDAD DE VENTA","VENTA","UM"], minimumOrder:["MINIMO","MINIMO PEDIDO"], multipleQty:["MULTIPLO"], remoteImageUrl:["REMOTE_IMAGE_URL","REMOTE_IMAGE","IMAGE_URL","IMAGEN_URL","URL_IMAGEN"] };
const SMART_CATEGORY_RULES = [
{ name:"Sartenes", terms:["sarten","sartenes","set de sarten","set de sartenes","sarten antiadherente"] },
{ name:"Ollas y calderos", terms:["olla","ollas","caldero","calderos","cacerola","paila"] },
{ name:"Decoracion", terms:["adorno","decoracion","figura","florero","porta botella","portabotella"] },
{ name:"Vasos y copas", terms:["vaso","vasos","copa","copas","jarra","jarras","termo","botella"] },
{ name:"Platos y bowls", terms:["plato","platos","bowl","bowls","ensaladera","bandeja","fuente"] },
{ name:"Cubiertos y utensilios", terms:["tenedor","tenedores","cuchillo","cuchillos","cuchara","cucharas","cubierto","cubiertos","utensilio","utensilios","espatula","pinza"] },
{ name:"Sillas", terms:["silla","sillas","taburete","banqueta"] },
{ name:"Textil", terms:["cortina","cortinas","alfombra","mantel","manteles","sabana","sabanas","toalla","toallas","cojin","cojines","funda","fundas"] },
{ name:"Bano", terms:["bano","banos","jabonera","dispensador","ducha","toallero","alfombra de bano"] },
{ name:"Lavanderia", terms:["lavadora","cubierta de lavadora","cesto","canasto","tendedero","lavanderia"] },
{ name:"Organizacion", terms:["organizador","organizadores","canasta","estante","caja","cajonera"] },
{ name:"Limpieza", terms:["atomizador","cepillo","escoba","limpieza","mopa","trapeador"] }
];
const DESCRIPTION_SEARCH_STOP_WORDS = new Set(["de","del","la","las","el","los","y","o","en","para","con","por","un","una","unos","unas","set","juego"]);
const DESCRIPTION_SEARCH_SYNONYMS = [
{ triggers:["vajilla","vajillas"], terms:["vajilla","vajillas","set vajilla","set de vajilla","set de vajillas"] },
{ triggers:["corniza","cornizas","barra cortina","barra de cortina","barra de cortinas"], terms:["corniza","cornizas","barra cortina","barra de cortina","barra de cortinas","cortina","cortinas"] },
{ triggers:["vaso","vasos"], terms:["vaso","vasos"] }
];
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
const matchImagesByItemButton = byId("matchImagesByItemButton");
const hideMissingImagesInput = byId("hideMissingImages");
const extraMediaInput = byId("extraMediaFiles");
const priceModeSelect = byId("priceModeSelect");
const entryFilterInput = byId("entryFilterInput");
const brandExportModeInput = byId("brandExportMode");
const brandFilterSelect = byId("brandFilterSelect");
const smartCategoryFilterSelect = byId("smartCategoryFilter");
const descriptionSearchInput = byId("descriptionSearchInput");
const featuredBrandsEnabledInput = byId("featuredBrandsEnabled");
const featuredBrandSelect = byId("featuredBrandSelect");
const featuredBrandLogoFileInput = byId("featuredBrandLogoFile");
const addFeaturedBrandButton = byId("addFeaturedBrandButton");
const featuredBrandsList = byId("featuredBrandsList");
const saveBrandVisualPresetButton = byId("saveBrandVisualPresetButton");
const applyBrandVisualPresetButton = byId("applyBrandVisualPresetButton");
const brandVisualPresetStatus = byId("brandVisualPresetStatus");
const imageStorageModeInput = byId("imageStorageMode");
const imageSourceModeInput = byId("imageSourceMode");
const imageSourceEditedBaseUrlInput = byId("imageSourceEditedBaseUrl");
const imageSourceOriginalBaseUrlInput = byId("imageSourceOriginalBaseUrl");
const imageSourceGalleryBaseUrlInput = byId("imageSourceGalleryBaseUrl");
const imageSourceDefaultExtensionInput = byId("imageSourceDefaultExtension");
const imageSourcePatternInput = byId("imageSourcePattern");
const imageSourceStatus = byId("imageSourceStatus");
const heroImageFileInput = byId("heroImageFile");
const heroSubtitleInput = byId("heroSubtitleInput");
const promoTitleInput = byId("promoTitleInput");
const promoTextInput = byId("promoTextInput");
const promoImageFileInput = byId("promoImageFile");
const promoSliderImagesInput = byId("promoSliderImages");
const promoSliderIntervalInput = byId("promoSliderInterval");
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
const saasValidationEnabledInput = byId("saasValidationEnabled");
const saasLicenseKeyInput = byId("saasLicenseKey");
const toggleSaasLicenseButton = byId("toggleSaasLicenseButton");
const saasCompanySlugInput = byId("saasCompanySlug");
const saasApiBaseUrlInput = byId("saasApiBaseUrl");
const testSaasLicenseButton = byId("testSaasLicenseButton");
const saasLicenseStatus = byId("saasLicenseStatus");
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
const batchPriceModeSelect = byId("batchPriceModeSelect");
const batchEntryFilterInput = byId("batchEntryFilterInput");
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
syncImageStorageInputs();
state.imageStorage = normalizeImageStorageSettings({ ...state.imageStorage, mode:imageSourceModeToStorageMode(state.imageSource.mode) });
syncImageStorageInputs();
syncImageSourceInputs();
syncBrandFilterInputs();
syncSmartCategoryFilterInputs();
applyVisualForCurrentScope({ silent:true });
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
footerInput?.addEventListener("input", () => { state.footerText = footerInput.value.trim(); refreshCatalogIfReady(); });
primaryColorInput?.addEventListener("input", () => { state.primaryColor = primaryColorInput.value || "#2c4695"; applyThemeVariables(); refreshCatalogIfReady(); renderWebPreview(); });
secondaryColorInput?.addEventListener("input", () => { state.secondaryColor = secondaryColorInput.value || "#1d1d1b"; applyThemeVariables(); refreshCatalogIfReady(); renderWebPreview(); });
includeCoverInput?.addEventListener("change", () => { state.includeCover = includeCoverInput.checked; refreshCatalogIfReady(); });
templateSelect?.addEventListener("change", () => { state.template = templateSelect.value || "classic"; if (state.template === "campin1" && Number(productsPerPageInput.value) > 5) productsPerPageInput.value = "5"; if (isHorizontalTemplate(state.template) && Number(productsPerPageInput.value) > 4) productsPerPageInput.value = "4"; refreshCatalogIfReady(); });
productsPerPageInput?.addEventListener("input", () => { const value = Number(productsPerPageInput.value); state.productsPerPage = Number.isFinite(value) && value > 0 ? value : 6; refreshCatalogIfReady(); });
coverImageFileInput?.addEventListener("change", () => { const file = coverImageFileInput.files?.[0]; state.coverImageUrl = replaceObjectUrl(state.coverImageUrl, file); state.coverImagePath = file?.path || ""; refreshCatalogIfReady(); });
pageLogoFileInput?.addEventListener("change", () => { const file = pageLogoFileInput.files?.[0]; state.pageLogoUrl = replaceObjectUrl(state.pageLogoUrl, file); state.pageLogoPath = file?.path || ""; refreshCatalogIfReady(); });
pageLogoPositionInput?.addEventListener("change", () => { state.pageLogoPosition = pageLogoPositionInput.value || "right"; refreshCatalogIfReady(); });
pageBackgroundFileInput?.addEventListener("change", () => { const file = pageBackgroundFileInput.files?.[0]; state.pageBackgroundUrl = replaceObjectUrl(state.pageBackgroundUrl, file); state.pageBackgroundPath = file?.path || ""; refreshCatalogIfReady(); });
pageBackgroundOpacityInput?.addEventListener("input", () => { state.pageBackgroundOpacity = readBackgroundOpacity(pageBackgroundOpacityInput); refreshCatalogIfReady(); });
excelInput?.addEventListener("change", async () => { const file = excelInput.files?.[0]; if (file) await loadRecordsFromFile(file); });
imageInput?.addEventListener("change", () => { state.imageMatchMode = "file-input"; state.imageFiles = Array.from(imageInput.files || []); reindexMainImages(); refreshCatalogIfReady(); });
matchImagesByItemButton?.addEventListener("click", matchImagesByItemFromDirectory);
hideMissingImagesInput?.addEventListener("change", () => {
state.hideMissingImages = Boolean(hideMissingImagesInput.checked);
applyManualRecordFilters();
reindexMainImages();
reindexExtraMedia();
setStatus(buildManualRecordStatus());
refreshCatalogIfReady();
});
extraMediaInput?.addEventListener("change", () => { state.extraMediaFiles = Array.from(extraMediaInput.files || []); reindexExtraMedia(); });
priceModeSelect?.addEventListener("change", () => {
state.priceMode = normalizePriceMode(priceModeSelect.value);
applyManualRecordFilters();
setStatus(buildManualRecordStatus());
reindexMainImages();
reindexExtraMedia();
refreshCatalogIfReady();
});
entryFilterInput?.addEventListener("input", () => {
state.entryFilter = entryFilterInput.value.trim();
syncBrandFilterInputs();
syncSmartCategoryFilterInputs();
applyManualRecordFilters();
setStatus(buildManualRecordStatus());
reindexMainImages();
reindexExtraMedia();
refreshCatalogIfReady();
});
brandExportModeInput?.addEventListener("change", () => {
state.brandExportMode = normalizeBrandExportMode(brandExportModeInput.value);
syncBrandFilterInputs();
syncSmartCategoryFilterInputs();
syncFeaturedBrandControls();
applyVisualForCurrentScope({ silent:true });
applyManualRecordFilters();
setStatus(buildManualRecordStatus());
reindexMainImages();
reindexExtraMedia();
refreshCatalogIfReady();
});
brandFilterSelect?.addEventListener("change", () => {
state.brandFilter = brandFilterSelect.value;
applyVisualForCurrentScope({ silent:true });
syncSmartCategoryFilterInputs();
syncFeaturedBrandControls();
applyManualRecordFilters();
setStatus(buildManualRecordStatus());
reindexMainImages();
reindexExtraMedia();
refreshCatalogIfReady();
});
featuredBrandsEnabledInput?.addEventListener("change", () => {
state.featuredBrandsEnabled = Boolean(featuredBrandsEnabledInput.checked);
syncFeaturedBrandControls();
renderWebPreview();
});
addFeaturedBrandButton?.addEventListener("click", () => {
addFeaturedBrandFromInputs();
});
smartCategoryFilterSelect?.addEventListener("change", () => {
state.smartCategoryFilter = smartCategoryFilterSelect.value;
applyManualRecordFilters();
setStatus(buildManualRecordStatus());
reindexMainImages();
reindexExtraMedia();
refreshCatalogIfReady();
});
descriptionSearchInput?.addEventListener("input", () => {
state.descriptionSearch = descriptionSearchInput.value.trim();
applyManualRecordFilters();
setStatus(buildManualRecordStatus());
reindexMainImages();
reindexExtraMedia();
refreshCatalogIfReady();
});
saveBrandVisualPresetButton?.addEventListener("click", saveBrandVisualPresetForSelectedBrand);
applyBrandVisualPresetButton?.addEventListener("click", () => applyBrandVisualPresetForSelectedBrand({ silent:false }));
imageSourceModeInput?.addEventListener("change", () => updateImageSourceSettings({ mode:imageSourceModeInput.value || "local" }));
imageStorageModeInput?.addEventListener("change", () => updateImageStorageSettings({ mode:imageStorageModeInput.value || "hosting" }));
imageSourceEditedBaseUrlInput?.addEventListener("input", () => updateImageSourceSettings({ editedBaseUrl:imageSourceEditedBaseUrlInput.value }));
imageSourceOriginalBaseUrlInput?.addEventListener("input", () => updateImageSourceSettings({ originalBaseUrl:imageSourceOriginalBaseUrlInput.value }));
imageSourceGalleryBaseUrlInput?.addEventListener("input", () => updateImageSourceSettings({ galleryBaseUrl:imageSourceGalleryBaseUrlInput.value }));
imageSourceDefaultExtensionInput?.addEventListener("change", () => updateImageSourceSettings({ defaultExtension:imageSourceDefaultExtensionInput.value || "jpg" }));
imageSourcePatternInput?.addEventListener("input", () => updateImageSourceSettings({ namePattern:imageSourcePatternInput.value }));
heroImageFileInput?.addEventListener("change", () => { const file = heroImageFileInput.files?.[0]; state.heroImageUrl = replaceObjectUrl(state.heroImageUrl, file); state.heroImagePath = file?.path || ""; renderWebPreview(); });
heroSubtitleInput?.addEventListener("input", () => { state.heroSubtitle = heroSubtitleInput.value.trim() || DEFAULT_HERO_SUBTITLE; renderWebPreview(); });
promoTitleInput?.addEventListener("input", () => { state.promotion.title = promoTitleInput.value.trim(); renderWebPreview(); });
promoTextInput?.addEventListener("input", () => { state.promotion.text = promoTextInput.value.trim(); renderWebPreview(); });
promoLinkLabelInput?.addEventListener("input", () => { state.promotion.linkLabel = promoLinkLabelInput.value.trim(); renderWebPreview(); });
promoLinkUrlInput?.addEventListener("input", () => { state.promotion.linkUrl = promoLinkUrlInput.value.trim(); renderWebPreview(); });
promoImageFileInput?.addEventListener("change", () => { const file = promoImageFileInput.files?.[0]; state.promotion.imageUrl = replaceObjectUrl(state.promotion.imageUrl, file); state.promotion.imagePath = file?.path || ""; renderWebPreview(); });
promoSliderImagesInput?.addEventListener("change", () => {
revokeObjectUrls(state.promotion.imageUrls || []);
const files = Array.from(promoSliderImagesInput.files || []);
state.promotion.imageUrls = files.map((file) => URL.createObjectURL(file));
state.promotion.imagePaths = files.map((file) => file.path || "").filter(Boolean);
renderWebPreview();
});
promoSliderIntervalInput?.addEventListener("change", () => {
state.promotion.slideInterval = normalizePromoSlideInterval(promoSliderIntervalInput.value);
renderWebPreview();
});
promoVideoFileInput?.addEventListener("change", () => { const file = promoVideoFileInput.files?.[0]; state.promotion.videoUrl = replaceObjectUrl(state.promotion.videoUrl, file); state.promotion.videoPath = file?.path || ""; renderWebPreview(); });
webCatalogSlugInput?.addEventListener("input", () => {
const nextSlug = sanitizeSlug(webCatalogSlugInput.value);
state.webExport.slugEdited = true;
state.webExport.slug = nextSlug;
updateGeneratedLinkPreview();
});
webCatalogSlugInput?.addEventListener("blur", () => {
const rawValue = webCatalogSlugInput.value;
const nextSlug = sanitizeSlug(rawValue);
state.webExport.slug = nextSlug;
if (rawValue.trim() && rawValue !== nextSlug) webCatalogSlugInput.value = nextSlug;
updateGeneratedLinkPreview();
});
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
toggleSaasLicenseButton?.addEventListener("click", () => toggleSecretInput(saasLicenseKeyInput, toggleSaasLicenseButton, "licencia SaaS"));
hostingAutoSaveInput?.addEventListener("change", () => { state.webExport.hosting.autoSave = Boolean(hostingAutoSaveInput.checked); saveHostingSettings({ force:true, showStatus:true }); });
saasValidationEnabledInput?.addEventListener("change", () => updateHostingSettings({ saasValidationEnabled:Boolean(saasValidationEnabledInput.checked) }));
saasLicenseKeyInput?.addEventListener("input", () => updateHostingSettings({ saasLicenseKey:saasLicenseKeyInput.value.trim() }));
saasCompanySlugInput?.addEventListener("input", () => updateHostingSettings({ saasCompanySlug:saasCompanySlugInput.value.trim() }));
saasApiBaseUrlInput?.addEventListener("input", () => updateHostingSettings({ saasApiBaseUrl:sanitizeBaseUrl(saasApiBaseUrlInput.value) }));
testSaasLicenseButton?.addEventListener("click", async () => { await validateSaasLicenseFromUi({ showSuccess:true }); });
saveHostingSettingsButton?.addEventListener("click", async () => { await saveHostingSettings({ force:true, showStatus:true }); });
clearHostingSettingsButton?.addEventListener("click", async () => { await clearHostingSettings(); });
pickWebOutputButton?.addEventListener("click", async () => { if (!isDesktop) return setWebExportStatus("La exportacion web requiere la app de escritorio.", true); const dir = await desktopApi.chooseDirectory({ title: "Selecciona la carpeta de salida web" }); if (!dir) return; state.webExport.outputDir = dir; if (webOutputPathInput) webOutputPathInput.value = dir; setWebExportStatus("Carpeta de salida web seleccionada."); });
copyWebLinkButton?.addEventListener("click", async () => { if (!state.webExport.generatedLink) return setWebExportStatus("Aun no hay URL base para copiar.", true); try { await navigator.clipboard.writeText(state.webExport.generatedLink); setWebExportStatus("URL base copiada. Para clientes, crea un link seguro en el panel admin."); } catch (error) { console.error(error); setWebExportStatus("No se pudo copiar la URL automaticamente.", true); } });
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
await hydrateDynamicImages(catalogRoot);
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
batchPriceModeSelect?.addEventListener("change", async () => {
state.batch.priceMode = normalizePriceMode(batchPriceModeSelect.value);
setBatchStatus(`Precio del lote: ${getPriceModeLabel(state.batch.priceMode)}.`);
if (state.batch.previewIndex >= 0 && state.batch.excelPath) await previewBatchCategory(state.batch.previewIndex);
});
batchEntryFilterInput?.addEventListener("input", async () => {
state.batch.entryFilter = batchEntryFilterInput.value.trim();
setBatchStatus(buildBatchEntryStatus());
if (state.batch.previewIndex >= 0 && state.batch.excelPath) await previewBatchCategory(state.batch.previewIndex);
});
batchPrimaryColorInput?.addEventListener("input", () => { state.batch.primaryColor = batchPrimaryColorInput.value || "#2c4695"; renderBatchCategoryList(); });
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
const jobs = selectedCategories.map((category, index) => ({ jobId:`job-${Date.now()}-${index}`, categoryName:category.name, fileName:sanitizeFileName(category.name), outputDir:state.batch.outputRoot, excelPath:state.batch.excelPath, category, options:{ title:category.name, footerText:`${category.name} - Catalogo generado por lotes`, includeCover:true, template:category.template || state.batch.template, productsPerPage:recommendedProductsPerPage(category.template || state.batch.template), primaryColor:category.primaryColor || state.batch.primaryColor, secondaryColor:category.secondaryColor || state.batch.secondaryColor, pageLogoPosition:category.logoPosition || state.batch.logoPosition, pageBackgroundOpacity:0.12, quality:state.batch.quality, priceMode:state.batch.priceMode, entryFilter:state.batch.entryFilter } }));
const results = await desktopApi.generateBatchPdfs({ jobs });
const okCount = results.filter((item) => item.ok).length;
setBatchStatus(`PDF generados: ${okCount}. Fallos: ${results.length - okCount}.`);
} catch (error) { console.error(error); setBatchStatus(`No se pudieron generar los PDF: ${error.message}`, true); }
});
}

function bindDesktopExportReceiver() {
if (!isDesktop || !desktopApi.onExportPayload) return;
desktopApi.onExportPayload(async (payload) => {
try { await renderExportJob(payload); await hydrateDynamicImages(catalogRoot); await waitForImagesToLoad(catalogRoot); desktopApi.notifyExportReady(payload.jobId); } catch (error) { console.error(error); }
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
const products = (state.records.length ? state.records : (state.sourceRecords.length ? [] : createPreviewProducts())).slice(0, 8);
const promoImages = getPromotionPreviewImages();
const promoImage = promoImages[0] || state.coverImageUrl || "";
const heroStyle = state.heroImageUrl ? ` style="background-image:linear-gradient(132deg, rgba(0,0,0,.62), rgba(0,0,0,.34)), url(&quot;${escapeHtml(state.heroImageUrl)}&quot;);"` : "";
const displayTitle = getCatalogDisplayTitle();
webPreviewRoot.innerHTML = `
<div class="web-preview-shell" style="--web-primary:${escapeHtml(sanitizeHexColor(state.primaryColor, "#2d6b4f"))}; --web-secondary:${escapeHtml(sanitizeHexColor(state.secondaryColor, "#174531"))};">
  <header class="web-preview-header">
    <div class="web-preview-brand">
      <div class="web-preview-logo">${state.pageLogoUrl ? `<img src="${escapeHtml(state.pageLogoUrl)}" alt="">` : "R"}</div>
      <div><strong>${escapeHtml(displayTitle)}</strong><span>${escapeHtml(state.footerText)}</span></div>
    </div>
    <div class="web-preview-search">Buscar SKU, marca o categoria</div>
    <button type="button">Carrito</button>
  </header>
  <section class="web-preview-hero"${heroStyle}>
    <div><p>Catalogo comercial B2B</p><h2>${escapeHtml(displayTitle)}</h2><span>${escapeHtml(state.heroSubtitle || DEFAULT_HERO_SUBTITLE)}</span></div>
    <div class="web-preview-filter"><strong>Categorias</strong><span>Todos</span><span>General</span><span>Mayorista</span></div>
  </section>
  <section class="web-preview-promo">
    <div><p>Promocion configurable</p><h3>${escapeHtml(state.promotion.title || "Oferta destacada")}</h3><span>${escapeHtml(state.promotion.text || "Imagen o video opcional con fallback movil.")}</span></div>
    <div class="web-preview-promo__media">${promoImage ? `<img src="${escapeHtml(promoImage)}" alt="">${promoImages.length > 1 ? `<small>${promoImages.length} imagenes</small>` : ""}` : "Imagen / video promo"}</div>
  </section>
  <section class="web-preview-grid">${products.map(renderWebPreviewCard).join("")}</section>
</div>`;
hydrateDynamicImages(webPreviewRoot);
}

function getPromotionPreviewImages() {
return dedupeStringList([
state.promotion.imageUrl,
...(Array.isArray(state.promotion.imageUrls) ? state.promotion.imageUrls : [])
].filter(Boolean));
}

function renderWebPreviewCard(product) {
const image = resolveProductImage(product);
const category = product.category || "General";
const packageLabel = product.package || product.empaque || "Unidad";
const saleUnit = product.saleUnit || product.um || "bulto";
const minimumOrder = product.minimumOrder || 1;
return `<article class="web-preview-card">
  <div class="web-preview-card__media">${image.isPlaceholder ? "Sin imagen" : `<img src="${escapeHtml(image.url)}" alt="" data-image-candidates="${escapeHtml(encodeDynamicCandidates(image.candidates))}">`}</div>
  <div class="web-preview-card__body">
    <span>${escapeHtml(product.item || "SKU")}</span>
    <strong>${escapeHtml(product.shortDescription || product.description || "Producto")}</strong>
    <div class="web-preview-card__meta">
      <div><small>Categoria</small><b>${escapeHtml(category)}</b></div>
      <div><small>Empaque</small><b>${escapeHtml(packageLabel)}</b></div>
      <div><small>Venta</small><b>${escapeHtml(saleUnit)}</b></div>
      <div><small>Minimo</small><b>${escapeHtml(String(minimumOrder))}</b></div>
    </div>
    ${product.available ? `<div class="web-preview-card__availability"><small>Disp:</small><b>${escapeHtml(product.available)}</b></div>` : ""}
    <p>${escapeHtml(product.price || "$0.00")}</p>
    <div class="web-preview-card__actions"><button type="button">Ver detalle</button><button type="button">Agregar</button></div>
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
const filteredRecords = filterRecordsByEntry(records, state.batch.entryFilter);
applyPriceModeToRecords(filteredRecords, state.batch.priceMode);
const imageMap = buildPreviewImageMapFromPaths(category.imageFiles);
state.records = filteredRecords.filter((record) => imageMap.has(normalizeIdentifier(record.item)));
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
const filteredRecords = filterRecordsByEntry(records, payload.options.entryFilter || "");
applyPriceModeToRecords(filteredRecords, payload.options.priceMode || state.batch.priceMode);
const imageMap = await buildCompressedImageMapFromPaths(payload.category.imageFiles, payload.options.quality);
state.records = filteredRecords.filter((record) => imageMap.has(normalizeIdentifier(record.item)));
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
if (!(await confirmMissingMainImages())) return;
if (state.brandExportMode === "single" && !state.brandFilter) return setWebExportStatus("Selecciona una marca para generar un catalogo por marca.", true);
const slug = buildScopedCatalogSlug(sanitizeSlug(state.webExport.slug || state.title) || "catalogo-publicable", state.brandExportMode === "single" ? state.brandFilter : "", state.smartCategoryFilter, state.descriptionSearch);
hideHostingProgressUi();
setWebExportStatus("Preparando paquete web publicable...");
try {
if (state.brandExportMode === "separate") {
const results = await exportSeparateBrandCatalogs(slug);
state.webExport.generatedLink = buildGeneratedLink(slug);
updateGeneratedLinkPreview(slug);
setWebExportStatus(`Catalogos por marca listos: ${results.length}. Carpeta base: ${state.webExport.outputDir}.`);
return;
}
const payload = buildWebExportPayload(slug, { localPreview:true });
const result = await desktopApi.exportWebPackage(payload);
state.webExport.generatedLink = buildGeneratedLink(slug);
updateGeneratedLinkPreview(slug);
setWebExportStatus(`Paquete local listo en ${result.outputDir}. Esto NO subio al hosting. Para subirlo usa el boton "Subir al hosting". Vigencia: ${payload.metadata.expiryLabel}.${state.webExport.generatedLink ? ` URL base: ${state.webExport.generatedLink}` : " Configura una URL base publica."}`);
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
if (!(await confirmMissingMainImages())) return;
if (state.brandExportMode === "single" && !state.brandFilter) return setWebExportStatus("Selecciona una marca para publicar un catalogo por marca.", true);
const slug = buildScopedCatalogSlug(sanitizeSlug(state.webExport.slug || state.title) || "catalogo-publicable", state.brandExportMode === "single" ? state.brandFilter : "", state.smartCategoryFilter, state.descriptionSearch);
if (state.brandExportMode === "separate") return setWebExportStatus("Para publicar separados por marca, exporta primero los paquetes por marca y publica uno por uno con una marca seleccionada.", true);
const remoteCatalogDir = buildRemoteCatalogDir(hosting.remoteDir, slug);
setWebExportStatus("Preparando subida al hosting...");
setHostingPublishBusy(true);
resetHostingProgressUi();
try {
await validateSaasLicenseFromUi({ showSuccess:false });
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
        publicBaseUrl: state.webExport.baseUrl,
        saasValidationEnabled: hosting.saasValidationEnabled === true,
        saasLicenseKey: hosting.saasLicenseKey || "",
        saasCompanySlug: hosting.saasCompanySlug || "",
        saasApiBaseUrl: hosting.saasApiBaseUrl || state.webExport.apiBaseUrl
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
        promoImages: payload.metadata.promotion.images,
        promoSlideInterval: payload.metadata.promotion.slideInterval,
        promoVideoUrl: payload.metadata.promotion.videoUrl,
        promoLinkUrl: payload.metadata.promotion.linkUrl,
        promoLinkLabel: payload.metadata.promotion.linkLabel,
        theme: payload.metadata.theme,
        notes: `Catalogo generado desde app local. Plantilla ${state.template}.`,
        catalogJsonPath: `${remoteCatalogDir}/catalog.json`
    }
});
state.webExport.generatedLink = result.publicUrl || buildGeneratedLink(slug);
updateGeneratedLinkPreview(slug);
const saasMode = result?.api?.saas?.mode || "";
const saasMessage = saasMode === "validated"
? " Publicacion registrada con licencia SaaS validada."
: (saasMode === "warning" ? " Publicacion realizada en modo legacy con advertencia SaaS." : "");
setWebExportStatus(`Catalogo subido al hosting correctamente. URL base: ${state.webExport.generatedLink || "(sin URL publica)"}. Ahora crea un link seguro en el panel admin antes de compartirlo.${saasMessage}`);
} catch (error) {
console.error(error);
setWebExportStatus(`No se pudo publicar al hosting: ${error.message}`, true);
} finally {
setHostingPublishBusy(false);
}
}

async function exportSeparateBrandCatalogs(baseSlug) {
const brands = getAvailableBrandsForCurrentEntry();
if (!brands.length) throw new Error("No hay marcas disponibles para generar catalogos separados.");
const originalRecords = state.records;
const originalTitle = state.title;
const originalBrandMode = state.brandExportMode;
const originalBrandFilter = state.brandFilter;
const originalVisual = captureCurrentVisualPreset("Catalogo completo");
const results = [];
try {
for (const brand of brands) {
const brandRecords = filterRecordsByBrand(filterRecordsByEntry(state.sourceRecords.length ? state.sourceRecords : originalRecords, state.entryFilter), brand);
if (!brandRecords.length) continue;
state.records = brandRecords;
state.title = `${originalTitle} - ${brand}`;
state.brandExportMode = "single";
state.brandFilter = brand;
applyVisualForCurrentScope({ silent:true });
const brandSlug = buildScopedCatalogSlug(baseSlug, brand, state.smartCategoryFilter, state.descriptionSearch);
const payload = buildWebExportPayload(brandSlug, { localPreview:true });
const result = await desktopApi.exportWebPackage(payload);
results.push({ brand, slug:brandSlug, outputDir:result.outputDir });
}
return results;
} finally {
state.records = originalRecords;
state.title = originalTitle;
state.brandExportMode = originalBrandMode;
state.brandFilter = originalBrandFilter;
applyVisualPreset(originalVisual);
renderCatalog({ syncInputs:false });
renderWebPreview();
}
}

function buildWebExportPayload(slug, options = {}) {
const currentState = {
records: state.records,
title: state.title,
imageMap: state.imageMap,
coverImageUrl: state.coverImageUrl,
pageLogoUrl: state.pageLogoUrl,
pageBackgroundUrl: state.pageBackgroundUrl,
heroImageUrl: state.heroImageUrl,
heroSubtitle: state.heroSubtitle,
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
state.title = getCatalogDisplayTitle();
const assets = [];
const exportImageMap = new Map();
const mediaCatalog = {};
const exportAssetNames = new Map();
const now = new Date();
const expiresAt = new Date(now.getTime() + (state.webExport.expiryDays || 30) * 24 * 60 * 60 * 1000);
records.forEach((record, recordIndex) => {
const normalizedItem = normalizeIdentifier(record.item);
const exportBaseName = buildExportAssetBaseName(record.item, normalizedItem, recordIndex, exportAssetNames);
const sourcePath = state.imageSourceMap.get(normalizedItem);
const shouldPrepareImageAssetsForUpload = state.imageStorage.mode === "backblaze" || state.imageStorage.mode === "hybrid";
let localMainRelative = "";
let uploadMainRelative = "";
if (sourcePath && (state.imageSource.mode !== "remote" || shouldPrepareImageAssetsForUpload)) {
const ext = getWebImageExtension(sourcePath);
const relativePath = `media/main/${exportBaseName}${ext}`;
assets.push({ sourcePath, relativePath, uploadOnly:state.imageStorage.mode === "backblaze" });
uploadMainRelative = `./${relativePath}`;
if (state.imageSource.mode !== "remote") {
exportImageMap.set(normalizedItem, uploadMainRelative);
localMainRelative = uploadMainRelative;
}
}
const extras = state.extraMediaMap.get(normalizedItem) || { gallery:[], videoPath:"" };
const localGallery = extras.gallery.map((filePath, index) => {
if (state.imageSource.mode === "remote" && !shouldPrepareImageAssetsForUpload) return "";
const ext = getWebImageExtension(filePath);
const relativePath = `media/extra/${exportBaseName}_${index + 1}${ext}`;
assets.push({ sourcePath:filePath, relativePath, uploadOnly:state.imageStorage.mode === "backblaze" });
return state.imageSource.mode === "remote" ? "" : `./${relativePath}`;
}).filter(Boolean);
const uploadGallery = extras.gallery.map((filePath, index) => {
if (!shouldPrepareImageAssetsForUpload) return "";
const ext = getWebImageExtension(filePath);
return `./media/extra/${exportBaseName}_${index + 1}${ext}`;
}).filter(Boolean);
const mainImageCandidates = resolveImageCandidatesForProduct(record, localMainRelative);
const galleryCandidateGroups = [];
if (state.imageSource.mode === "remote" || state.imageSource.mode === "hybrid") {
galleryCandidateGroups.push(...buildRemoteGalleryCandidateGroups(record.item, localGallery.length));
}
if (state.imageSource.mode === "local") {
localGallery.forEach((localUrl) => galleryCandidateGroups.push([localUrl]));
} else if (state.imageSource.mode === "hybrid") {
for (let index = 0; index < Math.max(galleryCandidateGroups.length, localGallery.length); index += 1) {
if (!galleryCandidateGroups[index]) galleryCandidateGroups[index] = [];
if (localGallery[index]) galleryCandidateGroups[index].push(localGallery[index]);
}
}
let video = "";
if (extras.videoPath) {
const ext = getPathExtension(extras.videoPath) || ".mp4";
const relativePath = `media/video/${exportBaseName}${ext}`;
assets.push({ sourcePath:extras.videoPath, relativePath });
video = `./${relativePath}`;
}
const packageQty = parsePackageQty(record.package);
mediaCatalog[record.item] = { item:record.item, description:record.description, shortDescription:record.shortDescription, price:record.price, originalPrice:record.originalPrice || record.price, priceMode:state.priceMode, entry:record.entry || "", available:record.available, package:record.package, empaque:record.package, packageQty, imageSourceMode:state.imageSource.mode, imageStorageMode:state.imageStorage.mode, localUploadImage:uploadMainRelative, localUploadGallery:uploadGallery, remote_image_url:resolveProductRemoteImageUrl(record), mainImage:mainImageCandidates[0] || localMainRelative || "", mainImageCandidates:dedupeStringList(mainImageCandidates), gallery:galleryCandidateGroups.map((group) => group[0]).filter(Boolean), galleryCandidateGroups:galleryCandidateGroups.map((group) => dedupeStringList(group)), video };
});
const coverRelative = state.coverImagePath ? `media/brand/cover${getWebImageExtension(state.coverImagePath)}` : "";
const logoRelative = state.pageLogoPath ? `media/brand/logo${getWebLogoExtension(state.pageLogoPath)}` : "";
const backgroundRelative = state.pageBackgroundPath ? `media/brand/background${getWebImageExtension(state.pageBackgroundPath)}` : "";
const heroRelative = state.heroImagePath ? `media/promo/hero${getWebImageExtension(state.heroImagePath)}` : "";
const promoImageRelative = state.promotion.imagePath ? `media/promo/promo${getWebImageExtension(state.promotion.imagePath)}` : "";
const promoImageSources = getPromotionImageAssetSources();
const promoImageRelatives = promoImageSources.map((sourcePath, index) => `media/promo/promo-${index + 1}${getWebImageExtension(sourcePath)}`);
const promoVideoRelative = state.promotion.videoPath ? `media/promo/promo${getPathExtension(state.promotion.videoPath) || ".mp4"}` : "";
const brandFilterState = buildBrandFilterState(records);
const featuredBrandAssets = buildFeaturedBrandAssets(brandFilterState.brands);
if (coverRelative) assets.push({ sourcePath:state.coverImagePath, relativePath:coverRelative });
if (logoRelative) assets.push({ sourcePath:state.pageLogoPath, relativePath:logoRelative });
if (backgroundRelative) assets.push({ sourcePath:state.pageBackgroundPath, relativePath:backgroundRelative });
if (heroRelative) assets.push({ sourcePath:state.heroImagePath, relativePath:heroRelative });
if (promoImageRelative) assets.push({ sourcePath:state.promotion.imagePath, relativePath:promoImageRelative });
promoImageSources.forEach((sourcePath, index) => assets.push({ sourcePath, relativePath:promoImageRelatives[index] }));
if (promoVideoRelative) assets.push({ sourcePath:state.promotion.videoPath, relativePath:promoVideoRelative });
featuredBrandAssets.forEach((asset) => assets.push(asset));
state.records = records;
state.imageMap = exportImageMap;
state.coverImageUrl = coverRelative ? `./${coverRelative}` : "";
state.pageLogoUrl = logoRelative ? `./${logoRelative}` : "";
state.pageBackgroundUrl = backgroundRelative ? `./${backgroundRelative}` : "";
state.heroImageUrl = "";
renderCatalog({ syncInputs:false });
const snapshotHtml = catalogRoot.innerHTML;
state.records = currentState.records;
state.title = currentState.title;
state.imageMap = currentState.imageMap;
state.coverImageUrl = currentState.coverImageUrl;
state.pageLogoUrl = currentState.pageLogoUrl;
state.pageBackgroundUrl = currentState.pageBackgroundUrl;
state.heroImageUrl = currentState.heroImageUrl;
state.heroSubtitle = currentState.heroSubtitle;
state.promotion = currentState.promotion;
renderCatalog({ syncInputs:false });
return {
outputDir: state.webExport.outputDir,
slug,
snapshotHtml,
  metadata: {
  localPreview: options.localPreview === true,
  title: state.title,
  footerText: state.footerText,
  slug,
  template: state.template,
  theme: {
    primaryColor: sanitizeHexColor(state.primaryColor, "#2d6b4f"),
    secondaryColor: sanitizeHexColor(state.secondaryColor, "#174531")
  },
  heroTitle: state.title,
  heroSubtitle: state.heroSubtitle || DEFAULT_HERO_SUBTITLE,
  heroImage: heroRelative ? `./${heroRelative}` : "",
  publicBaseUrl: state.webExport.baseUrl,
  apiBaseUrl: state.webExport.apiBaseUrl,
  publicUrl: buildGeneratedLink(slug),
  currency: "USD",
  priceMode: state.priceMode,
  priceModeLabel: getPriceModeLabel(state.priceMode),
  entryFilter: state.entryFilter,
  smartCategoryFilter: state.smartCategoryFilter,
  descriptionSearch: state.descriptionSearch,
  promotion: {
    title: state.promotion.title,
    text: state.promotion.text,
    imageUrl: promoImageRelative ? `./${promoImageRelative}` : "",
    images: promoImageRelatives.map((relativePath) => `./${relativePath}`),
    imageUrls: promoImageRelatives.map((relativePath) => `./${relativePath}`),
    videoUrl: promoVideoRelative ? `./${promoVideoRelative}` : "",
    linkLabel: state.promotion.linkLabel,
    linkUrl: state.promotion.linkUrl,
    slideInterval: normalizePromoSlideInterval(state.promotion.slideInterval)
  },
  legacyPdfUrl: "",
  modernPdfUrl: "",
  generatedAt: now.toISOString(),
  expiresAt: expiresAt.toISOString(),
expiryDays: state.webExport.expiryDays || 30,
expiryLabel: `${state.webExport.expiryDays || 30} dias`,
  coverImage: coverRelative ? `./${coverRelative}` : "",
  logoUrl: logoRelative ? `./${logoRelative}` : "",
imageSource: { ...state.imageSource },
imageStorage: { ...state.imageStorage },
brandFilter: state.brandExportMode === "single" ? state.brandFilter : "",
brandExportMode: state.brandExportMode,
brandFilterEnabled: brandFilterState.enabled,
brands: brandFilterState.brands,
activeBrand: brandFilterState.activeBrand,
brandMetadata: brandFilterState.brands,
showFeaturedBrands: state.brandExportMode === "complete" && state.featuredBrandsEnabled !== false,
featuredBrands: buildFeaturedBrandMetadata(brandFilterState.brands, featuredBrandAssets),
catalog: records.map((record) => ({ item:record.item, description:record.description, shortDescription:record.shortDescription, price:record.price, originalPrice:record.originalPrice || record.price, priceMode:state.priceMode, entry:record.entry || "", available:record.available, package:record.package, empaque:record.package, packageQty:parsePackageQty(record.package), packageLabel:record.package, saleUnit:record.saleUnit || record.um || "bulto", minimumOrder:record.minimumOrder || 1, multipleQty:record.multipleQty || 1, brand:record.brand || "", brandSlug:sanitizeSlug(record.brand || ""), material:record.material || "", size:record.size || record.measureBadge || "", category:record.category || "General", smartCategory:getRecordFilterCategory(record), categoryOriginal:record.categoryOriginal || record.category || "", remote_image_url:resolveProductRemoteImageUrl(record), remoteImageUrl:resolveProductRemoteImageUrl(record), media:mediaCatalog[record.item] || { gallery:[], video:"" } })),
},
assets: dedupeAssets(assets),
};
}

function dedupeAssets(assets) { const seen = new Set(); return assets.filter((asset) => { const key = `${asset.sourcePath}|${asset.relativePath}`; if (!asset.sourcePath || seen.has(key)) return false; seen.add(key); return true; }); }
function getPromotionImageAssetSources() {
return dedupeStringList(Array.isArray(state.promotion.imagePaths) ? state.promotion.imagePaths.filter(Boolean) : []);
}
function buildFeaturedBrandAssets(availableBrands = []) {
if (state.brandExportMode !== "complete" || state.featuredBrandsEnabled === false) return [];
const available = new Set((availableBrands || []).map((brand) => normalizeBrandValue(brand.name || brand)));
return state.featuredBrands
.filter((brand) => brand.logoPath && available.has(normalizeBrandValue(brand.name)))
.map((brand) => ({
sourcePath:brand.logoPath,
relativePath:`assets/brands/${sanitizeSlug(brand.name)}${getWebLogoExtension(brand.logoPath)}`
}));
}
function buildFeaturedBrandMetadata(availableBrands = [], assets = []) {
if (state.brandExportMode !== "complete" || state.featuredBrandsEnabled === false) return [];
const availableBySlug = new Map((availableBrands || []).map((brand) => [sanitizeSlug(brand.name || brand), brand.name || brand]));
const assetBySlug = new Map((assets || []).map((asset) => [sanitizeSlug(String(asset.relativePath || "").replace(/^.*\/([^/.]+)\.[^.]+$/, "$1")), `./${asset.relativePath}`]));
const configured = state.featuredBrands.length ? state.featuredBrands : DEFAULT_FEATURED_BRANDS.map((name) => ({ name, slug:sanitizeSlug(name), logoPath:"" }));
return configured
.map((brand) => {
const slug = sanitizeSlug(brand.slug || brand.name);
const name = availableBySlug.get(slug);
if (!name) return null;
return {
name,
slug,
logo:assetBySlug.get(slug) || `./assets/brands/${slug}.png`
};
})
.filter(Boolean);
}
function normalizePromoSlideInterval(value) {
const interval = Number(value);
return [3000, 5000, 8000, 15000].includes(interval) ? interval : 15000;
}
function buildBrandFilterState(records) {
const brands = dedupeStringList((records || []).map((record) => safeText(record?.brand)).filter(Boolean))
.sort((a, b) => a.localeCompare(b))
.map((brand) => ({ name:brand, slug:sanitizeSlug(brand) }));
return {
enabled: brands.length > 1,
brands,
activeBrand: brands.length === 1 ? brands[0] : null
};
}
async function confirmMissingMainImages() {
if (state.imageSource.mode === "remote") return true;
if (state.imageSource.mode === "hybrid" && (state.imageSource.editedBaseUrl || state.imageSource.originalBaseUrl)) return true;
const total = state.records.length;
const missingRecords = getMissingMainImageRecords();
if (!total || !missingRecords.length) return true;
const missingItems = missingRecords.map((row) => row.item).filter(Boolean);
const missing = missingItems.length;
const sample = missingItems.slice(0, 12).join(", ");
const more = missingItems.length > 12 ? ` y ${missingItems.length - 12} mas` : "";
const message = `Hay ${missing} producto(s) sin imagen principal indexada de ${total}. ${sample ? `ITEM sin imagen: ${sample}${more}. ` : ""}Revisa que los nombres de archivo coincidan con el ITEM antes de publicar.`;
setWebExportStatus(message, true);
await maybeExportMissingImagesReport(missingRecords);
return window.confirm(`${message}\n\nQuieres continuar de todos modos?`);
}
function getMissingMainImageRecords() {
return state.records
.filter((record) => !recordHasMainImage(record))
.map((record) => ({
item: safeText(record.item),
description: safeText(record.description || record.shortDescription),
brand: safeText(record.brand),
category: getRecordFilterCategory(record),
expectedNames: buildExpectedImageNames(record.item)
}))
.filter((row) => row.item);
}
function buildExpectedImageNames(item) {
const raw = safeText(item);
if (!raw) return [];
const safeDash = sanitizeItemAssetName(raw);
const normalized = normalizeIdentifier(raw);
const variants = [
raw,
`${raw}.jpg`,
`${raw}_1.jpg`,
`${raw}-1.jpg`,
`${raw}-main.jpg`,
`${raw}_main.jpg`,
safeDash && safeDash !== raw ? `${safeDash}.jpg` : "",
safeDash && safeDash !== raw ? `${safeDash}-main.jpg` : "",
normalized && normalized !== safeDash.toLowerCase() ? `${normalized}.jpg` : ""
];
return dedupeStringList(variants.filter(Boolean));
}
async function maybeExportMissingImagesReport(rows) {
if (!rows.length || !isDesktop || !desktopApi?.saveMissingImagesReport) return;
const wantsReport = window.confirm(`Hay ${rows.length} ITEM sin imagen. Deseas exportar el reporte de imagenes faltantes?`);
if (!wantsReport) return;
const requestedFormat = window.prompt('Formato del reporte: escribe "TXT" o "EXCEL".', "TXT");
if (!requestedFormat) return;
const format = /^excel|xlsx|csv$/i.test(requestedFormat.trim()) ? "excel" : "txt";
try {
const result = await desktopApi.saveMissingImagesReport({
format,
rows,
catalogTitle:getCatalogDisplayTitle(),
fileName:`imagenes-faltantes-${sanitizeSlug(getCatalogDisplayTitle() || state.webExport.slug || "catalogo")}`
});
if (result?.filePath) setWebExportStatus(`Reporte de imagenes faltantes guardado en ${result.filePath}`, false);
} catch (error) {
console.error(error);
setWebExportStatus(`No se pudo guardar el reporte de imagenes faltantes: ${error.message}`, true);
}
}
async function matchImagesByItemFromDirectory() {
if (!isDesktop || !desktopApi.findImagesForItems) {
setStatus("La busqueda por ITEM requiere abrir el proyecto como app local con Electron.", true);
return;
}
const items = getManualFilteredRecords(false).map((record) => record.item).filter(Boolean);
if (!items.length) {
setStatus("Primero carga el Excel para conocer los ITEM que se deben buscar.", true);
return;
}
const rootDir = await desktopApi.chooseDirectory({ title:"Selecciona la carpeta raiz donde estan las imagenes" });
if (!rootDir) return;
setStatus(`Buscando imagenes para ${items.length} ITEM(s) sin cargar toda la carpeta...`);
try {
const result = await desktopApi.findImagesForItems({ rootDir, items });
const matches = Array.isArray(result.matches) ? result.matches : [];
state.imageFiles = [];
state.imageMatchMode = "item-directory";
revokeObjectUrls(state.imageUrls);
state.imageUrls = [];
state.imageMap = new Map();
state.imageSourceMap = new Map();
matches.forEach((match) => {
const normalizedItem = match.normalizedItem || normalizeIdentifier(match.item);
if (!normalizedItem || !match.filePath || state.imageSourceMap.has(normalizedItem)) return;
state.imageSourceMap.set(normalizedItem, match.filePath);
state.imageMap.set(normalizedItem, pathToFileUrl(match.filePath));
});
if (state.hideMissingImages) applyManualRecordFilters();
const missingCount = Array.isArray(result.missingItems) ? result.missingItems.length : Math.max(0, items.length - matches.length);
const limitNote = result.stoppedEarly ? " Se alcanzo el limite de archivos revisados; prueba una carpeta mas especifica." : "";
const sampleNote = matches[0]?.fileName ? ` Ejemplo: ${matches[0].fileName}.` : "";
setStatus(`Imagenes por ITEM: ${matches.length} encontradas, ${missingCount} sin imagen. Archivos revisados: ${result.scannedFiles || 0}.${sampleNote}${limitNote}`, Boolean(result.stoppedEarly));
refreshCatalogIfReady();
} catch (error) {
console.error(error);
setStatus(`No fue posible buscar imagenes por ITEM: ${error.message}`, true);
}
}
function reindexMainImages() {
if (state.imageMatchMode === "item-directory") {
if (state.imageSourceMap.size) setStatus(`Imagenes por ITEM conservadas: ${state.imageSourceMap.size}.`);
if (state.hideMissingImages) applyManualRecordFilters();
return;
}
revokeObjectUrls(state.imageUrls);
state.imageMap = buildImageMapFromFiles(state.imageFiles || []);
state.imageUrls = Array.from(state.imageMap.values());
state.imageSourceMap = buildImageSourceMapFromFiles(state.imageFiles || []);
if (state.hideMissingImages) applyManualRecordFilters();
if (state.imageFiles?.length) setStatus(`Imagenes principales indexadas: ${state.imageMap.size} de ${state.imageFiles.length}.`);
}
function buildImageSourceMapFromFiles(files) { const map = new Map(); const knownItems = getKnownItemsForImageIndex(); files.forEach((file) => { const stem = resolveMainMediaItemKey(file.name || "", knownItems); if (!stem || map.has(stem) || !file.path) return; map.set(stem, file.path); }); return map; }
function buildExtraMediaMapFromFiles(files) { const map = new Map(); const knownItems = getKnownItemsForImageIndex(); files.forEach((file) => { const path = file.path || ""; if (!path) return; const ext = getPathExtension(file.name || path); const parsed = parseExtraMediaStem(file.name || path, knownItems); if (!parsed.itemKey) return; if (!map.has(parsed.itemKey)) map.set(parsed.itemKey, { gallery:[], videoPath:"" }); const bucket = map.get(parsed.itemKey); if (isVideoExtension(ext)) { if (!bucket.videoPath) bucket.videoPath = path; return; } bucket.gallery.push(path); }); return map; }
function resolveMainMediaItemKey(fileName, knownItems = new Set()) { const parsed = parseExtraMediaStem(fileName, knownItems); return parsed.itemKey || normalizeIdentifier(String(fileName || "").replace(/\.[^.]+$/, "")); }
function parseExtraMediaStem(fileName, knownItems = new Set()) {
const rawStem = String(fileName || "").replace(/\.[^.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const copyCleanStem = rawStem.replace(/\s*\(\d+\)\s*$/i, "").trim();
const cleanedStem = copyCleanStem.replace(/(?:[_\-\s](?:main|principal|gallery|galeria|extra|image|img|foto|video|vid|photo|pic|web|edited|editada))(?:[_\-\s]?\d+)?$/i, "").replace(/(?:[_\-\s]\d+)$/i, "").trim();
const normalizedRaw = normalizeIdentifier(rawStem);
const normalizedCopyClean = normalizeIdentifier(copyCleanStem);
const normalizedCleaned = normalizeIdentifier(cleanedStem);
const exactCandidates = [normalizedRaw, normalizedCopyClean, normalizedCleaned].filter(Boolean);
const exactItem = exactCandidates.find((candidate) => knownItems.has(candidate));
if (exactItem) return { itemKey:exactItem };
const rawBoundary = normalizeBoundaryIdentifier(copyCleanStem);
const cleanedBoundary = normalizeBoundaryIdentifier(cleanedStem);
const sortedItems = Array.from(knownItems).sort((a, b) => b.length - a.length);
const boundaryItem = sortedItems.find((item) => {
const itemBoundary = normalizeBoundaryIdentifier(item);
if (!itemBoundary) return false;
if (rawBoundary === itemBoundary || cleanedBoundary === itemBoundary) return true;
if (!rawBoundary.startsWith(`${itemBoundary}-`)) return false;
return isAllowedMediaVariantSuffix(rawBoundary.slice(itemBoundary.length + 1));
});
return { itemKey: boundaryItem || "" };
}
function getPathExtension(filePath) { return String(filePath || "").match(/\.[^.]+$/)?.[0]?.toLowerCase() || ""; }
function getWebImageExtension(filePath) { const ext = getPathExtension(filePath); return ext === ".svg" ? ".svg" : ".jpg"; }
function getWebLogoExtension(filePath) {
const ext = getPathExtension(filePath);
return [".png", ".webp", ".svg"].includes(ext) ? ext : getWebImageExtension(filePath);
}
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
function sanitizeHexColor(value, fallback) {
const normalized = String(value || "").trim();
return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}
function buildExportAssetBaseName(rawItem, normalizedItem, index, usedNames = new Map()) {
const safeBase = sanitizeItemAssetName(rawItem) || sanitizeItemAssetName(normalizedItem) || `item-${index + 1}`;
const count = (usedNames.get(safeBase.toLowerCase()) || 0) + 1;
usedNames.set(safeBase.toLowerCase(), count);
return count > 1 ? `${safeBase}-${count}` : safeBase;
}
function sanitizeItemAssetName(value) {
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
function setWebExportStatus(message, isError = false) { if (!webExportStatus) return; webExportStatus.textContent = message; webExportStatus.style.color = isError ? "#ffd6d6" : "rgba(255,255,255,0.82)"; }
function sanitizeBaseUrl(value) { return String(value || "").trim().replace(/\/+$/, ""); }
function buildGeneratedLink(slug) { return state.webExport.baseUrl ? `${sanitizeBaseUrl(state.webExport.baseUrl)}/${slug}/` : ""; }
function updateGeneratedLinkPreview(slugOverride = "") { state.webExport.generatedLink = buildGeneratedLink(slugOverride || state.webExport.slug || "catalogo-publicable"); if (generatedWebLinkInput) generatedWebLinkInput.value = state.webExport.generatedLink; }
function setHostingPublishBusy(isBusy) { if (publishHostingButton) { publishHostingButton.disabled = isBusy; publishHostingButton.classList.toggle("publish-button--working", isBusy); publishHostingButton.textContent = isBusy ? "Subiendo..." : "Subir al hosting"; } if (exportWebButton) exportWebButton.disabled = isBusy; }
function hideHostingProgressUi() { if (webPublishProgressPanel) webPublishProgressPanel.hidden = true; if (webPublishProgressBarFill) webPublishProgressBarFill.style.width = "0%"; if (webPublishProgressText) webPublishProgressText.textContent = "Esperando publicacion al hosting."; }
function resetHostingProgressUi() { if (webPublishProgressPanel) webPublishProgressPanel.hidden = false; if (webPublishProgressBarFill) webPublishProgressBarFill.style.width = "0%"; if (webPublishProgressText) webPublishProgressText.textContent = "Preparando publicacion al hosting..."; }
function updateHostingProgressUi(payload = {}) { if (webPublishProgressPanel) webPublishProgressPanel.hidden = false; const phase = String(payload.phase || ""); const completed = Number(payload.completed || 0); const total = Number(payload.total || 0); let percent = Number(payload.percent || 0); if ((!percent || !Number.isFinite(percent)) && total > 0) percent = Math.round((completed / total) * 100); percent = Math.max(0, Math.min(100, percent || 0)); if (webPublishProgressBarFill) webPublishProgressBarFill.style.width = `${percent}%`; if (webPublishProgressText) { const label = payload.label ? ` ${payload.label}` : ""; const text = phase === "exporting" ? "Preparando paquete web..." : phase === "compressing" ? `Comprimiendo ZIP${label}...` : phase === "uploading" ? `Subiendo ZIP${label}... ${completed}/${total}` : phase === "registering" ? "Registrando catalogo en el panel..." : phase === "completed" ? "Publicacion completada." : "Subiendo al hosting..."; webPublishProgressText.textContent = text; if (phase !== "completed") setWebExportStatus(text); } }
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
function buildScopedCatalogSlug(baseSlug, brand = "", category = "", searchQuery = "") {
const parts = [sanitizeSlug(baseSlug), sanitizeSlug(brand || ""), sanitizeSlug(category || ""), sanitizeSlug(searchQuery || "")].filter(Boolean);
return parts.join("-") || "catalogo-publicable";
}
function getScopedCatalogTitle(baseTitle, brand = "") { const cleanBrand = safeText(brand); const cleanTitle = safeText(baseTitle) || "Catalogo"; if (!cleanBrand) return cleanTitle; return normalizeBrandValue(cleanTitle).endsWith(normalizeBrandValue(cleanBrand)) ? cleanTitle : `${cleanTitle} - ${cleanBrand}`; }
function getCatalogDisplayTitle() {
const brand = state.brandExportMode === "single" ? safeText(state.brandFilter) : "";
return brand || safeText(state.title) || "Catalogo";
}
function loadHostingSettings() { try { const raw = window.localStorage?.getItem(HOSTING_SETTINGS_STORAGE_KEY); if (!raw) return { ...DEFAULT_HOSTING_SETTINGS }; return normalizeHostingSettings(JSON.parse(raw)); } catch (error) { console.error(error); return { ...DEFAULT_HOSTING_SETTINGS }; } }
// Modulo de fuente de imagenes hibridas: mantiene Local actual y agrega modos Remoto e Hibrido.
function loadImageSourceSettings() { try { const raw = window.localStorage?.getItem(IMAGE_SOURCE_SETTINGS_STORAGE_KEY); if (!raw) return { ...DEFAULT_IMAGE_SOURCE_SETTINGS }; return normalizeImageSourceSettings(JSON.parse(raw)); } catch (error) { console.error(error); return { ...DEFAULT_IMAGE_SOURCE_SETTINGS }; } }
function loadImageStorageSettings() { try { const raw = window.localStorage?.getItem(IMAGE_STORAGE_SETTINGS_STORAGE_KEY); if (!raw) return { ...DEFAULT_IMAGE_STORAGE_SETTINGS }; return normalizeImageStorageSettings(JSON.parse(raw)); } catch (error) { console.error(error); return { ...DEFAULT_IMAGE_STORAGE_SETTINGS }; } }
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
function normalizeImageStorageSettings(value = {}) {
const source = value && typeof value === "object" ? value : {};
const mode = ["hosting","backblaze","hybrid"].includes(source.mode) ? source.mode : DEFAULT_IMAGE_STORAGE_SETTINGS.mode;
return { mode };
}
function normalizeImageSourceSettings(value = {}) {
const source = value && typeof value === "object" ? value : {};
const mode = ["local","remote","hybrid"].includes(source.mode) ? source.mode : DEFAULT_IMAGE_SOURCE_SETTINGS.mode;
const extension = ["jpg","jpeg","png","webp"].includes(String(source.defaultExtension || "").toLowerCase()) ? String(source.defaultExtension || "").toLowerCase() : DEFAULT_IMAGE_SOURCE_SETTINGS.defaultExtension;
const pattern = String(source.namePattern || DEFAULT_IMAGE_SOURCE_SETTINGS.namePattern).trim() || DEFAULT_IMAGE_SOURCE_SETTINGS.namePattern;
return {
mode,
editedBaseUrl:sanitizeBaseUrl(source.editedBaseUrl || ""),
originalBaseUrl:sanitizeBaseUrl(source.originalBaseUrl || ""),
galleryBaseUrl:sanitizeBaseUrl(source.galleryBaseUrl || ""),
defaultExtension:extension,
namePattern:pattern.includes("{ITEM}") ? pattern : DEFAULT_IMAGE_SOURCE_SETTINGS.namePattern,
gallerySlots:Math.max(1, Number(source.gallerySlots || DEFAULT_IMAGE_SOURCE_SETTINGS.gallerySlots) || DEFAULT_IMAGE_SOURCE_SETTINGS.gallerySlots)
};
}
function saveImageStorageSettings() {
try {
window.localStorage?.setItem(IMAGE_STORAGE_SETTINGS_STORAGE_KEY, JSON.stringify(state.imageStorage));
} catch (error) {
console.error(error);
}
}
function saveImageSourceSettings() {
try {
window.localStorage?.setItem(IMAGE_SOURCE_SETTINGS_STORAGE_KEY, JSON.stringify(state.imageSource));
} catch (error) {
console.error(error);
}
}
function syncImageStorageInputs() {
if (imageStorageModeInput) imageStorageModeInput.value = state.imageStorage.mode || "hosting";
}
function syncImageSourceInputs() {
if (imageSourceModeInput) imageSourceModeInput.value = state.imageSource.mode || "local";
if (imageSourceEditedBaseUrlInput) imageSourceEditedBaseUrlInput.value = state.imageSource.editedBaseUrl || "";
if (imageSourceOriginalBaseUrlInput) imageSourceOriginalBaseUrlInput.value = state.imageSource.originalBaseUrl || "";
if (imageSourceGalleryBaseUrlInput) imageSourceGalleryBaseUrlInput.value = state.imageSource.galleryBaseUrl || "";
if (imageSourceDefaultExtensionInput) imageSourceDefaultExtensionInput.value = state.imageSource.defaultExtension || "jpg";
if (imageSourcePatternInput) imageSourcePatternInput.value = state.imageSource.namePattern || "{ITEM}.{EXT}";
if (imageSourceStatus) {
const modeLabels = {
hosting:"Hosting actual: conserva el flujo existente y sube imagenes dentro del paquete.",
backblaze:"Backblaze B2/CDN: usa URL remota para el catalogo cuando este disponible.",
hybrid:"Hibrido recomendado: intenta Backblaze/CDN y conserva fallback del hosting."
};
imageSourceStatus.textContent = modeLabels[state.imageStorage.mode] || modeLabels.hosting;
}
}
function updateImageStorageSettings(changes = {}) {
state.imageStorage = normalizeImageStorageSettings({ ...state.imageStorage, ...changes });
const sourceMode = imageStorageModeToSourceMode(state.imageStorage.mode);
state.imageSource = normalizeImageSourceSettings({ ...state.imageSource, mode:sourceMode });
syncImageStorageInputs();
syncImageSourceInputs();
saveImageStorageSettings();
saveImageSourceSettings();
refreshCatalogIfReady();
}
function updateImageSourceSettings(changes = {}) {
state.imageSource = normalizeImageSourceSettings({ ...state.imageSource, ...changes });
state.imageStorage = normalizeImageStorageSettings({ ...state.imageStorage, mode:imageSourceModeToStorageMode(state.imageSource.mode) });
syncImageStorageInputs();
syncImageSourceInputs();
saveImageStorageSettings();
saveImageSourceSettings();
refreshCatalogIfReady();
}
function imageStorageModeToSourceMode(mode) {
if (mode === "backblaze") return "remote";
if (mode === "hybrid") return "hybrid";
return "local";
}
function imageSourceModeToStorageMode(mode) {
if (mode === "remote") return "backblaze";
if (mode === "hybrid") return "hybrid";
return "hosting";
}
function buildImageFileName(item, extension, pattern = "{ITEM}.{EXT}") {
const safeItem = String(item || "").trim();
const safeExt = String(extension || state.imageSource.defaultExtension || "jpg").replace(/^\./, "").toLowerCase();
return pattern.replace(/\{ITEM\}/g, safeItem).replace(/\{EXT\}/g, safeExt);
}
function joinUrl(baseUrl, fileName) {
return baseUrl ? `${sanitizeBaseUrl(baseUrl)}/${String(fileName || "").replace(/^\/+/, "")}` : "";
}
function buildRemoteMainCandidates(item) {
const config = state.imageSource;
const candidates = [];
const fileName = buildImageFileName(item, config.defaultExtension, config.namePattern);
if (config.editedBaseUrl) candidates.push(joinUrl(config.editedBaseUrl, fileName));
if (config.mode === "hybrid" && config.originalBaseUrl) candidates.push(joinUrl(config.originalBaseUrl, fileName));
if (config.mode === "remote" && config.originalBaseUrl) candidates.push(joinUrl(config.originalBaseUrl, fileName));
return dedupeStringList(candidates);
}
function buildRemoteGalleryCandidateGroups(item, totalLocalGallery = 0) {
const config = state.imageSource;
const maxSlots = Math.max(totalLocalGallery, config.gallerySlots || 3);
const groups = [];
if (!config.galleryBaseUrl) return groups;
for (let index = 1; index <= maxSlots; index += 1) {
const fileName = `${String(item || "").trim()}-${index}.${String(config.defaultExtension || "jpg").replace(/^\./, "")}`;
groups.push([joinUrl(config.galleryBaseUrl, fileName)]);
}
return groups;
}
function resolveImageCandidatesForProduct(product, localImageUrl = "") {
const mode = state.imageSource.mode === "remote" ? "remote" : (state.imageSource.mode === "hybrid" ? "hybrid" : "local");
if (mode === "local") return dedupeStringList([localImageUrl]);
const remoteCandidates = [resolveProductRemoteImageUrl(product), ...buildRemoteMainCandidates(product?.item)].filter(Boolean);
return mode === "remote" ? dedupeStringList(remoteCandidates.length ? remoteCandidates : [localImageUrl]) : dedupeStringList([...remoteCandidates, localImageUrl]);
}
function resolveProductRemoteImageUrl(product = {}) {
return sanitizeRemoteImageUrl(product.remote_image_url || product.remoteImageUrl || product.remoteImage || "");
}
function sanitizeRemoteImageUrl(value) {
const url = safeText(value);
return /^https?:\/\//i.test(url) ? url : "";
}
function dedupeStringList(values) { return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))]; }
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
saasValidationEnabled:source.saasValidationEnabled === true,
saasLicenseKey:String(source.saasLicenseKey || DEFAULT_HOSTING_SETTINGS.saasLicenseKey),
saasCompanySlug:String(source.saasCompanySlug || DEFAULT_HOSTING_SETTINGS.saasCompanySlug).trim(),
saasApiBaseUrl:sanitizeBaseUrl(source.saasApiBaseUrl || DEFAULT_HOSTING_SETTINGS.saasApiBaseUrl),
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
return Boolean(settings.ftpHost || settings.ftpUser || settings.ftpPassword || settings.remoteDir || settings.apiKey || settings.publicBaseUrl || settings.apiBaseUrl || settings.saasLicenseKey || settings.saasCompanySlug || settings.saasApiBaseUrl);
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
function syncHostingInputs() { if (webBaseUrlInput) webBaseUrlInput.value = state.webExport.baseUrl || ""; if (webApiBaseUrlInput) webApiBaseUrlInput.value = state.webExport.apiBaseUrl || ""; if (hostingFtpProtocolInput) hostingFtpProtocolInput.value = state.webExport.hosting.protocol || "ftp"; if (hostingFtpHostInput) hostingFtpHostInput.value = state.webExport.hosting.ftpHost || ""; if (hostingFtpPortInput) hostingFtpPortInput.value = String(state.webExport.hosting.ftpPort || 21); if (hostingFtpUserInput) hostingFtpUserInput.value = state.webExport.hosting.ftpUser || ""; if (hostingFtpPasswordInput) hostingFtpPasswordInput.value = state.webExport.hosting.ftpPassword || ""; if (hostingRemoteDirInput) hostingRemoteDirInput.value = state.webExport.hosting.remoteDir || ""; if (hostingApiKeyInput) hostingApiKeyInput.value = state.webExport.hosting.apiKey || ""; if (hostingAutoSaveInput) hostingAutoSaveInput.checked = state.webExport.hosting.autoSave !== false; if (saasValidationEnabledInput) saasValidationEnabledInput.checked = state.webExport.hosting.saasValidationEnabled === true; if (saasLicenseKeyInput) saasLicenseKeyInput.value = state.webExport.hosting.saasLicenseKey || ""; if (saasCompanySlugInput) saasCompanySlugInput.value = state.webExport.hosting.saasCompanySlug || ""; if (saasApiBaseUrlInput) saasApiBaseUrlInput.value = state.webExport.hosting.saasApiBaseUrl || ""; syncSaasLicenseStatus(); }
function updateSettingsPathLabel() { if (!hostingSettingsPath) return; const settingsPath = state.webExport.hosting?.settingsPath || ""; hostingSettingsPath.textContent = settingsPath ? `Archivo local: ${settingsPath}` : "La configuracion se guarda solo en esta PC."; }
function syncSaasLicenseStatus(message = "") {
if (!saasLicenseStatus) return;
saasLicenseStatus.textContent = message || (state.webExport.hosting?.saasValidationEnabled ? "Validacion SaaS activa, no bloqueante." : "Validacion opcional. Si falla, la app continua en modo legacy.");
}
async function validateSaasLicenseFromUi({ showSuccess = false } = {}) {
const hosting = collectHostingSettings();
if (!hosting.saasValidationEnabled && !showSuccess) return null;
if (!isDesktop || !desktopApi?.validateSaasLicense) {
const message = "No se pudo validar la licencia SaaS. Continuando en modo legacy.";
syncSaasLicenseStatus(message);
if (showSuccess) setWebExportStatus(message, true);
return null;
}
try {
syncSaasLicenseStatus("Validando licencia SaaS...");
const result = await desktopApi.validateSaasLicense(hosting);
if (result?.ok) {
const message = "Licencia SaaS validada correctamente.";
syncSaasLicenseStatus(message);
if (showSuccess) setWebExportStatus(message);
return result;
}
const message = `No se pudo validar la licencia SaaS. Continuando en modo legacy.${result?.message ? ` ${result.message}` : ""}`;
syncSaasLicenseStatus(message);
if (showSuccess) setWebExportStatus(message, true);
return result || null;
} catch (error) {
console.error(error);
const message = "No se pudo validar la licencia SaaS. Continuando en modo legacy.";
syncSaasLicenseStatus(`${message} ${error.message || ""}`.trim());
if (showSuccess) setWebExportStatus(`${message} ${error.message || ""}`.trim(), true);
return null;
}
}
function toggleSecretInput(input, button, label) { if (!input || !button) return; const isHidden = input.type === "password"; input.type = isHidden ? "text" : "password"; button.textContent = isHidden ? "Ocultar" : "Mostrar"; button.setAttribute("aria-label", `${isHidden ? "Ocultar" : "Mostrar"} ${label}`); }

function createDefaultLayoutBlocks() { return { coverTitle:{ x:0, y:0, scale:1 }, pageHeader:{ x:0, y:0, scale:1 }, pageLogo:{ x:0, y:0, scale:1 }, productsGrid:{ x:0, y:0, scale:1 }, productImage:{ x:0, y:0, scale:1 }, productCode:{ x:0, y:0, scale:1 }, productPrice:{ x:0, y:0, scale:1 }, productDescription:{ x:0, y:0, scale:1 }, productMeta:{ x:0, y:0, scale:1 }, pageFooter:{ x:0, y:0, scale:1 } }; }
function createDefaultLayoutPreset() { return { id:"default", name:"Predeterminada", blocks:createDefaultLayoutBlocks() }; }
function normalizeLayoutPreset(preset) { const defaults = createDefaultLayoutBlocks(); const safePreset = preset && typeof preset === "object" ? preset : {}; const blocks = {}; Object.keys(defaults).forEach((blockId) => { const source = safePreset.blocks?.[blockId] || {}; blocks[blockId] = { x:Number.isFinite(source.x) ? source.x : defaults[blockId].x, y:Number.isFinite(source.y) ? source.y : defaults[blockId].y, scale:Number.isFinite(source.scale) ? source.scale : defaults[blockId].scale }; }); return { id:String(safePreset.id || `preset-${Date.now()}`), name:String(safePreset.name || "Plantilla personalizada"), blocks }; }
function loadLayoutPresets() { try { const raw = window.localStorage?.getItem(LAYOUT_STORAGE_KEY); if (!raw) return { default:createDefaultLayoutPreset() }; const parsed = JSON.parse(raw); const presets = { default:createDefaultLayoutPreset() }; Object.entries(parsed || {}).forEach(([id, preset]) => { if (id === "default") return; presets[id] = normalizeLayoutPreset({ ...preset, id }); }); return presets; } catch (error) { console.error(error); return { default:createDefaultLayoutPreset() }; } }
function saveLayoutPresets() { try { window.localStorage?.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.layoutPresets)); } catch (error) { console.error(error); } }
function loadBrandVisualPresets() { try { const raw = window.localStorage?.getItem(BRAND_VISUAL_PRESETS_STORAGE_KEY); const parsed = raw ? JSON.parse(raw) : {}; const presets = {}; Object.entries(parsed || {}).forEach(([key, preset]) => { const normalized = normalizeBrandVisualPreset(preset); if (normalized.brand || key === GENERAL_VISUAL_PRESET_KEY) presets[key] = normalized; }); if (!presets[GENERAL_VISUAL_PRESET_KEY]) presets[GENERAL_VISUAL_PRESET_KEY] = normalizeBrandVisualPreset(DEFAULT_GENERAL_VISUAL); return presets; } catch (error) { console.error(error); return { [GENERAL_VISUAL_PRESET_KEY]:normalizeBrandVisualPreset(DEFAULT_GENERAL_VISUAL) }; } }
function saveBrandVisualPresets() { try { window.localStorage?.setItem(BRAND_VISUAL_PRESETS_STORAGE_KEY, JSON.stringify(state.brandVisualPresets)); } catch (error) { console.error(error); } }
function normalizeBrandVisualPreset(preset) {
const source = preset && typeof preset === "object" ? preset : {};
return {
brand:safeText(source.brand),
primaryColor:sanitizeHexColor(source.primaryColor, "#2c4695"),
secondaryColor:sanitizeHexColor(source.secondaryColor, "#1d1d1b"),
coverImagePath:String(source.coverImagePath || ""),
pageLogoPath:String(source.pageLogoPath || ""),
pageLogoPosition:source.pageLogoPosition === "left" ? "left" : "right",
pageBackgroundPath:String(source.pageBackgroundPath || ""),
pageBackgroundOpacity:Number.isFinite(Number(source.pageBackgroundOpacity)) ? Number(source.pageBackgroundOpacity) : 0.12,
heroImagePath:String(source.heroImagePath || ""),
heroSubtitle:String(source.heroSubtitle || DEFAULT_HERO_SUBTITLE),
promotion:{
title:String(source.promotion?.title || ""),
text:String(source.promotion?.text || ""),
imagePath:String(source.promotion?.imagePath || ""),
imagePaths:Array.isArray(source.promotion?.imagePaths) ? source.promotion.imagePaths.map((value) => String(value || "")).filter(Boolean) : [],
videoPath:String(source.promotion?.videoPath || ""),
linkLabel:String(source.promotion?.linkLabel || ""),
linkUrl:String(source.promotion?.linkUrl || ""),
slideInterval:normalizePromoSlideInterval(source.promotion?.slideInterval)
},
updatedAt:String(source.updatedAt || "")
};
}
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
try { const buffer = await file.arrayBuffer(); state.sourceRecords = parseWorkbookFromBuffer(buffer); syncBrandFilterInputs(); syncSmartCategoryFilterInputs(); applyManualRecordFilters(); state.sourceExcelName = file.name || ""; if (webCatalogSlugInput && !state.webExport.slugEdited && (!webCatalogSlugInput.value || webCatalogSlugInput.value === "catalogo-publicable")) { const nextSlug = sanitizeSlug(file.name.replace(/\.[^.]+$/, "")) || "catalogo-publicable"; webCatalogSlugInput.value = nextSlug; state.webExport.slug = nextSlug; updateGeneratedLinkPreview(); } reindexMainImages(); reindexExtraMedia(); setStatus(`${buildManualRecordStatus()} Imagenes principales indexadas: ${state.imageMap.size}.`); refreshCatalogIfReady(); } catch (error) { console.error(error); setStatus(`No fue posible leer el Excel: ${error.message}`, true); }
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
const rawPrice = row[columnMap.price];
const numericPrice = parsePriceNumber(rawPrice);
const category = safeText(columnMap.category ? row[columnMap.category] : (row.CATEGORIA || row.CATEGORY || row.LINEA || row.LINE || row.FAMILIA));
const brand = safeText(columnMap.brand ? row[columnMap.brand] : (row.MARCA || row.BRAND || row.FABRICANTE));
const material = safeText(columnMap.material ? row[columnMap.material] : row.MATERIAL);
const size = safeText(columnMap.size ? row[columnMap.size] : (row.TAMANO || row['TAMAÃ‘O'] || row.SIZE));
const entry = safeText(columnMap.entry ? row[columnMap.entry] : (row.ENTRADA || row.ENTRY || row.LOTE || row.IMPORTACION));
const saleUnit = safeText(columnMap.saleUnit ? row[columnMap.saleUnit] : (row['UNIDAD_VENTA'] || row['UNIDAD DE VENTA'] || row.VENTA || row.UM)) || "bulto";
const minimumOrder = parsePackageQty(columnMap.minimumOrder ? row[columnMap.minimumOrder] : (row.MINIMO || row['MINIMO PEDIDO'] || 1));
const multipleQty = parsePackageQty(columnMap.multipleQty ? row[columnMap.multipleQty] : (row.MULTIPLO || row['MULTIPLO'] || 1));
const remoteImageUrl = sanitizeRemoteImageUrl(columnMap.remoteImageUrl ? row[columnMap.remoteImageUrl] : (row.REMOTE_IMAGE_URL || row.REMOTE_IMAGE || row.IMAGE_URL || row.IMAGEN_URL || row.URL_IMAGEN));
const item = safeText(row[columnMap.item]);
const smartCategory = inferSmartCategory({ item, description, category, brand, material, size });
return { item, description, shortTitle:summarizeTitle(description), shortDescription:summarizeDescription(description), price:formatPrice(rawPrice), originalPrice:formatPrice(rawPrice), priceBaseValue:numericPrice, priceRaw:safeText(rawPrice), entry, available:safeText(row[columnMap.available]), barcode:safeText(row[columnMap.barcode]), package:safeText(row[columnMap.package]), um:safeText(row[columnMap.um]), ctn:safeText(row[columnMap.ctn]), cub:safeText(row[columnMap.cub]), measureBadge:extractMeasureBadge(description), category, smartCategory, categoryOriginal:category, brand, material, size, remoteImageUrl, remote_image_url:remoteImageUrl, saleUnit, minimumOrder, multipleQty };
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
hydrateDynamicImages(catalogRoot);
}

function renderCover() {
const template = getCurrentTemplate();
const displayTitle = getCatalogDisplayTitle();
const art = state.coverImageUrl ? `<div class="cover-page__art cover-page__art--full"><img src="${state.coverImageUrl}" alt="Portada"></div>` : `<div class="cover-page__art cover-page__art--placeholder"><span>${escapeHtml(template.coverIntro)}</span></div>`;
return `
<section class="cover-page ${template.coverClass}">
<div class="cover-page__bg"></div>
<div class="cover-page__overlay ${state.coverImageUrl ? "cover-page__overlay--with-art" : ""}"></div>
<div class="cover-page__frame"></div>
${art}
<div class="cover-page__title" data-layout-block="coverTitle" style="${layoutStyleAttr("coverTitle")}">
<p class="cover-page__eyebrow">${escapeHtml(template.coverIntro)}</p>
<h2>${escapeHtml(displayTitle)}</h2>
<p class="cover-page__subtitle">${escapeHtml(state.footerText)}</p>
</div>
</section>`;
}

function renderPage(products, pageNumber, totalPages) {
const template = getCurrentTemplate();
const displayTitle = getCatalogDisplayTitle();
if (template.pageRenderer) return template.pageRenderer(products, pageNumber, totalPages);
const backgroundMarkup = state.pageBackgroundUrl ? `<div class="catalog-page__bg catalog-page__bg--image" style="background-image: url('${escapeHtml(state.pageBackgroundUrl)}'); opacity: ${state.pageBackgroundOpacity.toFixed(2)};"></div>` : `<div class="catalog-page__bg"></div>`;
const headerClass = state.pageLogoUrl ? `page-header page-header--with-logo page-header--logo-${state.pageLogoPosition}` : "page-header";
return `
<section class="catalog-page ${template.pageClass}">
${backgroundMarkup}
<div class="catalog-page__chrome"></div>
<div class="${headerClass}" data-layout-block="pageHeader" style="${layoutStyleAttr("pageHeader")}">${renderPageLogo()}<div class="page-header__accent"></div><div class="page-header__copy"><p class="page-header__eyebrow">${escapeHtml(template.headerEyebrow)}</p><h2 class="page-header__title">${escapeHtml(displayTitle)}</h2></div></div>
<div class="products-grid" data-layout-block="productsGrid" style="${layoutStyleAttr("productsGrid")}">${products.map((product) => template.cardRenderer(product, resolveProductImage(product), buildMetaItems(product))).join("")}</div>
<footer class="page-footer" data-layout-block="pageFooter" style="${layoutStyleAttr("pageFooter")}"><div class="page-footer__line"></div><div class="page-footer__band"><span class="page-footer__label">${escapeHtml(state.footerText)}</span></div><div class="page-footer__number ${pageNumber === totalPages ? "page-footer__number--right" : ""}">${pageNumber}</div></footer>
</section>`;
}

function renderCampinPage(products, pageNumber, totalPages) {
const template = getCurrentTemplate();
const displayTitle = getCatalogDisplayTitle();
const [heroProduct, ...secondaryProducts] = products;
const heroImage = heroProduct ? resolveProductImage(heroProduct) : { url:PLACEHOLDER_DATA_URI, isPlaceholder:true };
const backgroundMarkup = state.pageBackgroundUrl ? `<div class="catalog-page__bg catalog-page__bg--image" style="background-image: url('${escapeHtml(state.pageBackgroundUrl)}'); opacity: ${state.pageBackgroundOpacity.toFixed(2)};"></div>` : `<div class="catalog-page__bg"></div>`;
const headerClass = state.pageLogoUrl ? `campin1-header campin1-header--with-logo campin1-header--logo-${state.pageLogoPosition}` : "campin1-header";
const heroMeta = heroProduct ? buildMetaItems(heroProduct).slice(0, 3) : [];
return `
<section class="catalog-page ${template.pageClass}">
${backgroundMarkup}
<div class="catalog-page__chrome"></div>
<div class="${headerClass}" data-layout-block="pageHeader" style="${layoutStyleAttr("pageHeader")}"><div class="campin1-header__brand">${renderPageLogo()}<div class="campin1-header__copy"><p class="campin1-header__eyebrow">${escapeHtml(template.headerEyebrow)}</p><h2 class="campin1-header__title">${escapeHtml(displayTitle || "CAMPIN1")}</h2><p class="campin1-header__sub">Outdoor catalog premium</p></div></div><div class="campin1-header__pill">Camping</div></div>
<section class="campin1-hero" ${heroProduct ? `data-item="${escapeHtml(heroProduct.item)}"` : ""}>
<div class="campin1-hero__copy"><p class="campin1-hero__kicker">Hero product</p><h3 class="campin1-hero__title" data-layout-block="productCode" style="${layoutStyleAttr("productCode")}">${escapeHtml(heroProduct?.description || heroProduct?.shortTitle || heroProduct?.item || "Equipo listo para cada aventura")}</h3><p class="campin1-hero__description" data-layout-block="productDescription" style="${layoutStyleAttr("productDescription")}">${escapeHtml(heroProduct ? (heroProduct.shortDescription || heroProduct.description || "") : "Catalogo editorial de camping con imagen protagonista, precio visible y datos comerciales claros.")}</p><div class="campin1-hero__badges" data-layout-block="productMeta" style="${layoutStyleAttr("productMeta")}"><span class="campin1-badge">Outdoor</span><span class="campin1-badge">Venta directa</span>${heroProduct?.measureBadge ? `<span class="campin1-badge">${escapeHtml(heroProduct.measureBadge)}</span>` : ""}</div><div class="campin1-hero__price" data-layout-block="productPrice" style="${layoutStyleAttr("productPrice")}">${escapeHtml(heroProduct?.price || "$0.00")}</div><div class="campin1-hero__meta">${heroProduct ? `<span>ITEM: ${escapeHtml(heroProduct.item)}</span>` : ""}${heroProduct?.available ? `<span>Disponible: ${escapeHtml(heroProduct.available)}</span>` : ""}${heroMeta.map((item) => `<span>${escapeHtml(item.label)}: ${escapeHtml(item.value)}</span>`).join("")}</div></div>
<div class="campin1-hero__visual" data-layout-block="productImage" style="${layoutStyleAttr("productImage")}">${renderImage(heroImage, heroProduct?.item || "Hero")}</div>
</section>
<div class="campin1-grid" data-layout-block="productsGrid" style="${layoutStyleAttr("productsGrid")}">${secondaryProducts.map((product) => template.cardRenderer(product, resolveProductImage(product), buildMetaItems(product))).join("")}</div>
<footer class="page-footer campin1-footer" data-layout-block="pageFooter" style="${layoutStyleAttr("pageFooter")}"><div class="page-footer__line"></div><div class="page-footer__band"><span class="page-footer__label">${escapeHtml(state.footerText)}</span></div><div class="page-footer__number ${pageNumber === totalPages ? "page-footer__number--right" : ""}">${pageNumber}</div></footer>
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

function resolveProductImage(product) { const normalizedItem = normalizeIdentifier(product.item); const localImageUrl = state.imageMap.get(normalizedItem) || ""; const candidates = resolveImageCandidatesForProduct(product, localImageUrl); const imageUrl = dedupeStringList(candidates)[0] || PLACEHOLDER_DATA_URI; return { url:imageUrl, isPlaceholder:imageUrl === PLACEHOLDER_DATA_URI, candidates:dedupeStringList(candidates) }; }
function renderImage(image, altText) { return image.isPlaceholder ? `<div class="product-card__placeholder">Imagen no disponible</div>` : `<img class="product-card__image" src="${escapeHtml(image.url)}" alt="${escapeHtml(altText)}" data-image-candidates="${escapeHtml(encodeDynamicCandidates(image.candidates))}">`; }
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
function refreshCatalogIfReady() { if (state.records.length) renderCatalog(); else if (catalogRoot) catalogRoot.innerHTML = ""; renderWebPreview(); }
function syncStateFromManualInputs() { state.title = titleInput?.value.trim() || state.title; state.footerText = footerInput ? footerInput.value.trim() : state.footerText; state.heroSubtitle = heroSubtitleInput?.value.trim() || DEFAULT_HERO_SUBTITLE; state.includeCover = Boolean(includeCoverInput?.checked); state.template = templateSelect?.value || state.template; state.primaryColor = primaryColorInput?.value || state.primaryColor; state.secondaryColor = secondaryColorInput?.value || state.secondaryColor; state.pageLogoPosition = pageLogoPositionInput?.value || state.pageLogoPosition; state.priceMode = normalizePriceMode(priceModeSelect?.value || state.priceMode); state.entryFilter = entryFilterInput?.value.trim() || ""; state.brandExportMode = normalizeBrandExportMode(brandExportModeInput?.value || state.brandExportMode); state.brandFilter = brandFilterSelect?.value || ""; state.smartCategoryFilter = smartCategoryFilterSelect?.value || ""; state.descriptionSearch = descriptionSearchInput?.value.trim() || ""; state.featuredBrandsEnabled = featuredBrandsEnabledInput ? Boolean(featuredBrandsEnabledInput.checked) : state.featuredBrandsEnabled; state.hideMissingImages = Boolean(hideMissingImagesInput?.checked); state.promotion.slideInterval = normalizePromoSlideInterval(promoSliderIntervalInput?.value || state.promotion.slideInterval); state.pageBackgroundOpacity = readBackgroundOpacity(pageBackgroundOpacityInput); const perPage = Number(productsPerPageInput?.value); state.productsPerPage = Number.isFinite(perPage) && perPage > 0 ? perPage : state.productsPerPage; }
function applyThemeVariables() { document.documentElement.style.setProperty("--red-primary", state.primaryColor); document.documentElement.style.setProperty("--red-dark", state.primaryColor); document.documentElement.style.setProperty("--footer-black", state.secondaryColor); }
function setStatus(message, isError = false) { if (!statusMessage) return; statusMessage.textContent = message; statusMessage.style.color = isError ? "#ffd6d6" : "rgba(255,255,255,0.82)"; }
function setBatchStatus(message, isError = false) { if (!batchStatusMessage) return; batchStatusMessage.textContent = message; batchStatusMessage.style.color = isError ? "#ffd6d6" : "rgba(255,255,255,0.82)"; }
function setBrandVisualPresetStatus(message, isError = false) { if (!brandVisualPresetStatus) return; brandVisualPresetStatus.textContent = message; brandVisualPresetStatus.style.color = isError ? "#ffd6d6" : "rgba(255,255,255,0.82)"; }
function syncBrandFilterInputs() {
state.brandExportMode = normalizeBrandExportMode(state.brandExportMode);
const brands = getAvailableBrandsForCurrentEntry();
if (brandExportModeInput) brandExportModeInput.value = state.brandExportMode;
if (brandFilterSelect) {
const current = brands.includes(state.brandFilter) ? state.brandFilter : "";
brandFilterSelect.innerHTML = `<option value="">Todas las marcas</option>${brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join("")}`;
brandFilterSelect.value = current;
brandFilterSelect.disabled = state.brandExportMode !== "single";
state.brandFilter = current;
}
syncFeaturedBrandControls();
}
function syncFeaturedBrandControls() {
const brands = getAvailableBrandsForCurrentEntry();
const isComplete = state.brandExportMode === "complete";
if (featuredBrandsEnabledInput) {
featuredBrandsEnabledInput.checked = state.featuredBrandsEnabled !== false;
featuredBrandsEnabledInput.disabled = !isComplete;
}
if (featuredBrandSelect) {
const used = new Set(state.featuredBrands.map((brand) => normalizeBrandValue(brand.name)));
const available = brands.filter((brand) => !used.has(normalizeBrandValue(brand)));
featuredBrandSelect.innerHTML = `<option value="">Selecciona una marca</option>${available.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join("")}`;
featuredBrandSelect.disabled = !isComplete || !available.length;
}
if (featuredBrandLogoFileInput) featuredBrandLogoFileInput.disabled = !isComplete;
if (addFeaturedBrandButton) addFeaturedBrandButton.disabled = !isComplete;
renderFeaturedBrandsEditorList();
}
function addFeaturedBrandFromInputs() {
syncStateFromManualInputs();
if (state.brandExportMode !== "complete") {
setBrandVisualPresetStatus("Las marcas destacadas solo se usan en catalogo completo.", true);
return;
}
const name = safeText(featuredBrandSelect?.value || "");
if (!name) {
setBrandVisualPresetStatus("Selecciona una marca para destacarla.", true);
return;
}
const file = featuredBrandLogoFileInput?.files?.[0] || null;
const existingIndex = state.featuredBrands.findIndex((brand) => normalizeBrandValue(brand.name) === normalizeBrandValue(name));
const nextBrand = {
name,
slug:sanitizeSlug(name),
logoPath:file?.path || "",
logoUrl:file ? URL.createObjectURL(file) : ""
};
if (existingIndex >= 0) {
if (state.featuredBrands[existingIndex].logoUrl?.startsWith("blob:")) URL.revokeObjectURL(state.featuredBrands[existingIndex].logoUrl);
state.featuredBrands[existingIndex] = nextBrand;
} else {
state.featuredBrands.push(nextBrand);
}
if (featuredBrandLogoFileInput) featuredBrandLogoFileInput.value = "";
setBrandVisualPresetStatus(`Marca destacada agregada: ${name}.`);
syncFeaturedBrandControls();
renderWebPreview();
}
function removeFeaturedBrand(index) {
const [removed] = state.featuredBrands.splice(index, 1);
if (removed?.logoUrl?.startsWith("blob:")) URL.revokeObjectURL(removed.logoUrl);
syncFeaturedBrandControls();
renderWebPreview();
}
function renderFeaturedBrandsEditorList() {
if (!featuredBrandsList) return;
if (state.brandExportMode !== "complete") {
featuredBrandsList.innerHTML = `<p class="status-message">Esta opcion aparece solo al generar catalogo completo.</p>`;
return;
}
if (!state.featuredBrands.length) {
featuredBrandsList.innerHTML = `<p class="status-message">Agrega logos de marcas para mostrarlos en Acceso rapido del catalogo completo.</p>`;
return;
}
featuredBrandsList.innerHTML = state.featuredBrands.map((brand, index) => `
  <div class="featured-brand-editor-item">
    ${brand.logoUrl ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}">` : `<img src="" alt="" hidden>`}
    <div><strong>${escapeHtml(brand.name)}</strong><small>${escapeHtml(brand.logoPath || "Sin logo: se mostrara texto si falta el archivo")}</small></div>
    <button type="button" data-featured-brand-remove="${index}">Quitar</button>
  </div>
`).join("");
featuredBrandsList.querySelectorAll("[data-featured-brand-remove]").forEach((button) => {
button.addEventListener("click", () => removeFeaturedBrand(Number(button.getAttribute("data-featured-brand-remove"))));
});
}
function syncSmartCategoryFilterInputs() {
const categories = getAvailableSmartCategoriesForCurrentScope();
if (!smartCategoryFilterSelect) {
state.smartCategoryFilter = categories.includes(state.smartCategoryFilter) ? state.smartCategoryFilter : "";
return;
}
const current = categories.includes(state.smartCategoryFilter) ? state.smartCategoryFilter : "";
smartCategoryFilterSelect.innerHTML = `<option value="">Todas las categorias</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
smartCategoryFilterSelect.value = current;
smartCategoryFilterSelect.disabled = !categories.length;
state.smartCategoryFilter = current;
}
function getSelectedBrandVisualPresetKey() {
if (state.brandExportMode !== "single" || !state.brandFilter) return "";
return normalizeBrandValue(state.brandFilter) || sanitizeSlug(state.brandFilter);
}
function captureCurrentVisualPreset(brand) {
return normalizeBrandVisualPreset({
brand,
primaryColor:state.primaryColor,
secondaryColor:state.secondaryColor,
coverImagePath:state.coverImagePath,
pageLogoPath:state.pageLogoPath,
pageLogoPosition:state.pageLogoPosition,
pageBackgroundPath:state.pageBackgroundPath,
pageBackgroundOpacity:state.pageBackgroundOpacity,
heroImagePath:state.heroImagePath,
heroSubtitle:state.heroSubtitle,
promotion:{
title:state.promotion.title,
text:state.promotion.text,
imagePath:state.promotion.imagePath,
imagePaths:Array.isArray(state.promotion.imagePaths) ? state.promotion.imagePaths.slice() : [],
videoPath:state.promotion.videoPath,
linkLabel:state.promotion.linkLabel,
linkUrl:state.promotion.linkUrl,
slideInterval:normalizePromoSlideInterval(state.promotion.slideInterval)
},
updatedAt:new Date().toISOString()
});
}
function saveBrandVisualPresetForSelectedBrand() {
syncStateFromManualInputs();
if (state.brandExportMode !== "single") {
state.brandVisualPresets[GENERAL_VISUAL_PRESET_KEY] = captureCurrentVisualPreset("Catalogo completo");
saveBrandVisualPresets();
setBrandVisualPresetStatus("Visual general guardado para catalogo completo.");
return;
}
const key = getSelectedBrandVisualPresetKey();
if (!key) {
setBrandVisualPresetStatus("Selecciona Generacion por marca: Solo una marca y elige una marca antes de guardar.", true);
return;
}
state.brandVisualPresets[key] = captureCurrentVisualPreset(state.brandFilter);
saveBrandVisualPresets();
setBrandVisualPresetStatus(`Configuracion visual guardada para ${state.brandFilter}.`);
}
function applyBrandVisualPresetForSelectedBrand(options = {}) {
const key = getSelectedBrandVisualPresetKey();
if (!key) {
if (!options.silent) setBrandVisualPresetStatus("Selecciona una marca guardada para aplicar su configuracion visual.", true);
return false;
}
const preset = state.brandVisualPresets[key];
if (!preset) {
if (!options.silent) setBrandVisualPresetStatus(`No hay configuracion visual guardada para ${state.brandFilter}.`, true);
return false;
}
applyVisualPreset(preset);
if (!options.silent) setBrandVisualPresetStatus(`Configuracion visual aplicada para ${state.brandFilter}.`);
return true;
}
function applyVisualForCurrentScope(options = {}) {
if (state.brandExportMode === "single" && state.brandFilter) {
if (applyBrandVisualPresetForSelectedBrand({ silent:true })) {
if (!options.silent) setBrandVisualPresetStatus(`Visual de marca aplicado para ${state.brandFilter}.`);
return true;
}
const general = getGeneralVisualPreset();
applyVisualPreset({ ...general, brand:state.brandFilter });
if (!options.silent) setBrandVisualPresetStatus(`No hay visual guardado para ${state.brandFilter}; se uso visual general.`, true);
return false;
}
applyVisualPreset(getGeneralVisualPreset());
if (!options.silent) setBrandVisualPresetStatus("Visual general aplicado para catalogo completo.");
return true;
}
function getGeneralVisualPreset() {
return state.brandVisualPresets[GENERAL_VISUAL_PRESET_KEY] || normalizeBrandVisualPreset(DEFAULT_GENERAL_VISUAL);
}
function applyVisualPreset(preset) {
const normalized = normalizeBrandVisualPreset(preset);
state.primaryColor = normalized.primaryColor;
state.secondaryColor = normalized.secondaryColor;
state.coverImagePath = normalized.coverImagePath;
state.coverImageUrl = assetUrlFromStoredPath(normalized.coverImagePath);
state.pageLogoPath = normalized.pageLogoPath || getGeneralVisualPreset().pageLogoPath || DEFAULT_GENERAL_VISUAL.pageLogoPath;
state.pageLogoUrl = assetUrlFromStoredPath(state.pageLogoPath);
state.pageLogoPosition = normalized.pageLogoPosition;
state.pageBackgroundPath = normalized.pageBackgroundPath;
state.pageBackgroundUrl = assetUrlFromStoredPath(normalized.pageBackgroundPath);
state.pageBackgroundOpacity = normalized.pageBackgroundOpacity;
state.heroImagePath = normalized.heroImagePath;
state.heroImageUrl = assetUrlFromStoredPath(normalized.heroImagePath);
state.heroSubtitle = normalized.heroSubtitle || DEFAULT_HERO_SUBTITLE;
state.promotion = {
...state.promotion,
title:normalized.promotion.title,
text:normalized.promotion.text,
imagePath:normalized.promotion.imagePath,
imageUrl:assetUrlFromStoredPath(normalized.promotion.imagePath),
imagePaths:Array.isArray(normalized.promotion.imagePaths) ? normalized.promotion.imagePaths.slice() : [],
imageUrls:(Array.isArray(normalized.promotion.imagePaths) ? normalized.promotion.imagePaths : []).map(assetUrlFromStoredPath).filter(Boolean),
videoPath:normalized.promotion.videoPath,
videoUrl:assetUrlFromStoredPath(normalized.promotion.videoPath),
linkLabel:normalized.promotion.linkLabel,
linkUrl:normalized.promotion.linkUrl,
slideInterval:normalizePromoSlideInterval(normalized.promotion.slideInterval)
};
syncVisualPresetInputs();
applyThemeVariables();
refreshCatalogIfReady();
}
function assetUrlFromStoredPath(filePath) {
if (!filePath) return "";
const normalized = String(filePath).replace(/\\/g, "/");
if (/^(?:[a-z]+:)?\/\//i.test(normalized) || normalized.startsWith("data:") || normalized.startsWith("blob:")) return normalized;
if (!/^(?:[A-Za-z]:|\/)/.test(normalized)) return normalized;
return pathToFileUrl(filePath);
}
function syncVisualPresetInputs() {
if (primaryColorInput) primaryColorInput.value = state.primaryColor;
if (secondaryColorInput) secondaryColorInput.value = state.secondaryColor;
if (pageLogoPositionInput) pageLogoPositionInput.value = state.pageLogoPosition;
if (pageBackgroundOpacityInput) pageBackgroundOpacityInput.value = String(state.pageBackgroundOpacity);
if (heroSubtitleInput) heroSubtitleInput.value = state.heroSubtitle;
if (promoTitleInput) promoTitleInput.value = state.promotion.title;
if (promoTextInput) promoTextInput.value = state.promotion.text;
if (promoLinkLabelInput) promoLinkLabelInput.value = state.promotion.linkLabel;
if (promoLinkUrlInput) promoLinkUrlInput.value = state.promotion.linkUrl;
if (promoSliderIntervalInput) promoSliderIntervalInput.value = String(normalizePromoSlideInterval(state.promotion.slideInterval));
}
function normalizeBrandExportMode(value) {
return ["complete","single","separate"].includes(value) ? value : "complete";
}
function getAvailableBrandsForCurrentEntry() {
const records = filterRecordsByEntry(state.sourceRecords.length ? state.sourceRecords : state.records, state.entryFilter);
return dedupeStringList(records.map((record) => safeText(record.brand))).sort((a, b) => a.localeCompare(b));
}
function getAvailableSmartCategoriesForCurrentScope() {
const baseRecords = state.sourceRecords.length ? state.sourceRecords : state.records;
const entryRecords = filterRecordsByEntry(baseRecords, state.entryFilter);
const brandRecords = state.brandExportMode === "single" ? filterRecordsByBrand(entryRecords, state.brandFilter) : entryRecords;
return dedupeStringList(brandRecords.map(getRecordFilterCategory).filter(Boolean)).sort((a, b) => a.localeCompare(b));
}
function filterRecordsByBrand(records, brand) {
const normalizedBrand = normalizeBrandValue(brand);
if (!normalizedBrand) return (records || []).slice();
return (records || []).filter((record) => normalizeBrandValue(record?.brand) === normalizedBrand);
}
function filterRecordsBySmartCategory(records, category) {
const normalizedCategory = normalizeSmartText(category);
if (!normalizedCategory) return (records || []).slice();
return (records || []).filter((record) => normalizeSmartText(getRecordFilterCategory(record)) === normalizedCategory);
}
function filterRecordsByDescriptionSearch(records, query) {
const normalizedQuery = normalizeSmartText(query);
if (!normalizedQuery) return (records || []).slice();
const phrases = expandDescriptionSearchPhrases(normalizedQuery);
return (records || []).filter((record) => recordMatchesDescriptionSearch(record, phrases));
}
function expandDescriptionSearchPhrases(normalizedQuery) {
const phrases = dedupeStringList(String(normalizedQuery || "").split(/[;,|]+/).map((phrase) => phrase.trim()).filter(Boolean));
DESCRIPTION_SEARCH_SYNONYMS.forEach((group) => {
const hasTrigger = group.triggers.some((trigger) => phraseMatchesSearchTokens(normalizedQuery, normalizeSmartText(trigger)));
if (hasTrigger) phrases.push(...group.terms.map(normalizeSmartText).filter(Boolean));
});
return dedupeStringList(phrases);
}
function recordMatchesDescriptionSearch(record, phrases) {
const haystack = normalizeSmartText([
record?.item,
record?.description,
record?.shortDescription,
record?.category,
record?.categoryOriginal,
record?.smartCategory,
record?.brand,
record?.material,
record?.size,
record?.measureBadge,
record?.package,
record?.saleUnit,
record?.um
].filter(Boolean).join(" "));
if (!haystack) return false;
return phrases.some((phrase) => phraseMatchesSearchTokens(haystack, phrase));
}
function phraseMatchesSearchTokens(haystack, phrase) {
const normalizedPhrase = normalizeSmartText(phrase);
if (!normalizedPhrase) return true;
if (haystack.includes(normalizedPhrase)) return true;
const tokens = normalizedPhrase.split(" ").filter((token) => token.length > 1 && !DESCRIPTION_SEARCH_STOP_WORDS.has(token));
if (!tokens.length) return false;
return tokens.every((token) => searchTokenMatches(haystack, token));
}
function searchTokenMatches(haystack, token) {
const variants = new Set([token]);
if (token.endsWith("es") && token.length > 4) variants.add(token.slice(0, -2));
if (token.endsWith("s") && token.length > 3) variants.add(token.slice(0, -1));
if (!token.endsWith("s")) variants.add(`${token}s`);
if (!token.endsWith("es")) variants.add(`${token}es`);
return Array.from(variants).some((variant) => variant && haystack.includes(variant));
}
function normalizeBrandValue(value) {
return safeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function normalizeSmartText(value) {
return safeText(value)
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/[^a-zA-Z0-9]+/g, " ")
.replace(/\s+/g, " ")
.trim()
.toLowerCase();
}
function inferSmartCategory(record) {
const searchText = normalizeSmartText([
record?.description,
record?.category,
record?.material,
record?.size,
record?.item
].filter(Boolean).join(" "));
if (!searchText) return "";
const paddedText = ` ${searchText} `;
const match = SMART_CATEGORY_RULES.find((rule) => rule.terms.some((term) => {
const normalizedTerm = normalizeSmartText(term);
return normalizedTerm && paddedText.includes(` ${normalizedTerm} `);
}));
return match ? match.name : "";
}
function getRecordFilterCategory(record) {
return safeText(record?.smartCategory || record?.category || "General") || "General";
}
function applyManualRecordFilters() {
state.records = getManualFilteredRecords(true);
applyPriceModeToRecords(state.records, state.priceMode);
return state.records;
}
function getManualFilteredRecords(applyMissingImagePolicy = true) {
const baseRecords = state.sourceRecords.length ? state.sourceRecords : state.records;
const entryRecords = filterRecordsByEntry(baseRecords, state.entryFilter);
const brandRecords = state.brandExportMode === "single" ? filterRecordsByBrand(entryRecords, state.brandFilter) : entryRecords;
const categoryRecords = filterRecordsBySmartCategory(brandRecords, state.smartCategoryFilter);
const searchRecords = filterRecordsByDescriptionSearch(categoryRecords, state.descriptionSearch);
return applyMissingImagePolicy && state.hideMissingImages ? searchRecords.filter(recordHasMainImage) : searchRecords.slice();
}
function recordHasMainImage(record) {
const normalizedItem = normalizeIdentifier(record?.item);
return Boolean((normalizedItem && state.imageSourceMap.has(normalizedItem)) || resolveProductRemoteImageUrl(record));
}
function buildManualRecordStatus() {
const total = state.sourceRecords.length || state.records.length;
const entryText = state.entryFilter ? ` Entrada: ${state.entryFilter}.` : " Entrada: todas.";
const brandText = state.brandExportMode === "single" && state.brandFilter ? ` Marca: ${state.brandFilter}.` : (state.brandExportMode === "separate" ? " Marcas: catalogos separados." : " Marca: todas.");
const categoryText = state.smartCategoryFilter ? ` Categoria: ${state.smartCategoryFilter}.` : " Categoria: todas.";
const searchText = state.descriptionSearch ? ` Busqueda: "${state.descriptionSearch}".` : "";
const imageText = state.hideMissingImages ? " Sin imagen: excluidos." : " Sin imagen: incluidos.";
return `Productos detectados: ${state.records.length}${total && total !== state.records.length ? ` de ${total}` : ""}.${entryText}${brandText}${categoryText}${searchText}${imageText} Precio: ${getPriceModeLabel(state.priceMode)}.`;
}
function buildBatchEntryStatus() { return state.batch.entryFilter ? `Entrada del lote: ${state.batch.entryFilter}.` : "Entrada del lote: todas."; }
function getKnownItemsForImageIndex() { return new Set(getManualFilteredRecords(false).map((record) => normalizeIdentifier(record.item)).filter(Boolean)); }
function buildImageMapFromFiles(files) { const map = new Map(); const knownItems = getKnownItemsForImageIndex(); files.forEach((file) => { const stem = resolveMainMediaItemKey(file.name || "", knownItems); if (!stem || map.has(stem)) return; map.set(stem, URL.createObjectURL(file)); }); return map; }
async function buildCompressedImageMapFromPaths(paths, quality) { const map = new Map(); for (const filePath of paths) { const stem = normalizeIdentifier(String(filePath).split(/[\\/]/).pop().replace(/\.[^.]+$/, "")); if (!stem || map.has(stem)) continue; map.set(stem, await compressImagePath(filePath, quality, 1800)); } return map; }
function buildPreviewImageMapFromPaths(paths) { const map = new Map(); for (const filePath of paths) { const stem = normalizeIdentifier(String(filePath).split(/[\\/]/).pop().replace(/\.[^.]+$/, "")); if (!stem || map.has(stem)) continue; map.set(stem, pathToFileUrl(filePath)); } return map; }
async function compressImagePath(filePath, quality, maxDimension) { const lower = String(filePath).toLowerCase(); if (lower.endsWith(".svg")) return pathToFileUrl(filePath); const source = pathToFileUrl(filePath); const img = await loadImage(source); const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight)); const width = Math.max(1, Math.round(img.naturalWidth * scale)); const height = Math.max(1, Math.round(img.naturalHeight * scale)); const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height); return canvas.toDataURL("image/jpeg", quality); }
function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`)); image.src = src; }); }
function replaceObjectUrl(currentUrl, file) { if (currentUrl && currentUrl.startsWith("blob:")) URL.revokeObjectURL(currentUrl); return file ? URL.createObjectURL(file) : ""; }
function revokeObjectUrls(urls) { urls.forEach((url) => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); }); }
function encodeDynamicCandidates(candidates) { return encodeURIComponent(JSON.stringify(dedupeStringList(candidates))); }
function decodeDynamicCandidates(value) { try { return JSON.parse(decodeURIComponent(String(value || ""))); } catch (error) { return []; } }
async function hydrateDynamicImages(container) {
if (!container) return;
const images = Array.from(container.querySelectorAll("img[data-image-candidates]"));
await Promise.all(images.map(async (img) => {
const candidates = decodeDynamicCandidates(img.dataset.imageCandidates);
if (!candidates.length) return;
const resolved = await resolveFirstAvailableImageUrl(candidates);
img.src = resolved || PLACEHOLDER_DATA_URI;
}));
}
async function resolveFirstAvailableImageUrl(candidates) {
for (const candidate of dedupeStringList(candidates)) {
if (!candidate) continue;
if (candidate.startsWith("blob:") || candidate.startsWith("data:") || candidate.startsWith("file:") || candidate.startsWith("./")) return candidate;
const exists = await checkRemoteImageAvailability(candidate);
if (exists) return candidate;
}
return "";
}
async function checkRemoteImageAvailability(url) {
if (state.remoteImageCheckCache.has(url)) return state.remoteImageCheckCache.get(url);
const promise = (async () => {
try {
const response = await fetch(url, { method:"HEAD", cache:"no-store" });
if (response.ok) return true;
} catch (error) {
}
return new Promise((resolve) => {
const image = new Image();
image.onload = () => resolve(true);
image.onerror = () => resolve(false);
image.src = `${url}${url.includes("?") ? "&" : "?"}__probe=${Date.now()}`;
});
})();
state.remoteImageCheckCache.set(url, promise);
const result = await promise;
state.remoteImageCheckCache.set(url, Promise.resolve(result));
return result;
}
function recommendedProductsPerPage(template) { if (template === "campin1") return 5; return isHorizontalTemplate(template) ? 4 : 6; }
function isHorizontalTemplate(template) { return template === "horizon" || template === "ledger"; }
function getCurrentTemplate() { return TEMPLATE_DEFS[state.template] || TEMPLATE_DEFS.classic; }
function templateDef(pageClass, coverClass, name, coverIntro, headerEyebrow, cardRenderer) { return { pageClass, coverClass, name, coverIntro, headerEyebrow, cardRenderer }; }
function normalizePriceMode(value) { return value === "factor55" ? "factor55" : "original"; }
function getPriceModeLabel(value) { return normalizePriceMode(value) === "factor55" ? "55% del precio del Excel" : "original del Excel"; }
function normalizeEntryValue(value) { return safeText(value).replace(/\s+/g, "").toUpperCase(); }
function filterRecordsByEntry(records, entryFilter) {
const normalizedFilter = normalizeEntryValue(entryFilter);
if (!normalizedFilter) return (records || []).slice();
return (records || []).filter((record) => normalizeEntryValue(record?.entry) === normalizedFilter);
}
function applyPriceModeToRecords(records, mode) {
const normalizedMode = normalizePriceMode(mode);
(records || []).forEach((record) => {
const baseValue = Number(record?.priceBaseValue);
if (!Number.isFinite(baseValue)) {
record.price = record.originalPrice || record.price || "";
return;
}
const priceValue = normalizedMode === "factor55" ? roundCurrency(baseValue * PRICE_FACTOR_55) : baseValue;
record.price = formatPrice(priceValue);
});
return records;
}
function roundCurrency(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function parsePriceNumber(value) {
if (value === null || value === undefined || value === "") return NaN;
if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
let text = String(value).replace(/[^\d,.-]/g, "").trim();
if (!text) return NaN;
const commaIndex = text.lastIndexOf(",");
const dotIndex = text.lastIndexOf(".");
if (commaIndex > -1 && dotIndex > -1) {
text = commaIndex > dotIndex ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
} else if (commaIndex > -1) {
text = text.replace(",", ".");
}
const numeric = Number(text);
return Number.isFinite(numeric) ? numeric : NaN;
}
function formatPrice(value) { if (value === null || value === undefined || value === "") return ""; const numeric = parsePriceNumber(value); if (!Number.isFinite(numeric)) return String(value); return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(roundCurrency(numeric)); }
function safeText(value) { if (value === null || value === undefined) return ""; const text = String(value).trim(); if (!text) return ""; if (/^\d+\.0$/.test(text)) return text.slice(0, -2); return text; }
function summarizeTitle(text) { const clean = collapseWhitespace(text); return clean.length <= 52 ? clean : `${clean.slice(0, 49).trimEnd()}...`; }
function summarizeDescription(text) { const clean = collapseWhitespace(text); return clean.length <= 88 ? clean : `${clean.slice(0, 85).trimEnd()}...`; }
function collapseWhitespace(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function extractMeasureBadge(text) { const clean = collapseWhitespace(text).toUpperCase(); const diaMatch = clean.match(/\bDIA\.?\s*(\d{1,3}(?:[.,]\d+)?)\s*CM\b/); if (diaMatch) return `${diaMatch[1].replace(",", ".")}CM`; const cmMatch = clean.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*CM\b/); if (cmMatch) return `${cmMatch[1].replace(",", ".")}CM`; const inchMatch = clean.match(/\b(\d{1,2})\s*[\"]/); if (inchMatch) return `${inchMatch[1]}\"`; return ""; }
function paginate(items, perPage) { const pages = []; for (let index = 0; index < items.length; index += perPage) pages.push(items.slice(index, index + perPage)); return pages; }
function normalizeKey(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase(); }
function normalizeIdentifier(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]+/g, "").trim().toLowerCase(); }
function normalizeBoundaryIdentifier(value) {
return String(value || "")
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/\.[^.]+$/, "")
.replace(/[^A-Za-z0-9]+/g, "-")
.replace(/-+/g, "-")
.replace(/^-+|-+$/g, "")
.toLowerCase();
}
function isAllowedMediaVariantSuffix(value) {
const suffix = normalizeBoundaryIdentifier(value);
if (!suffix) return true;
return /^(?:\d+|main|principal|gallery|galeria|extra|image|img|foto|video|vid|photo|pic|web|edited|editada)(?:-\d+)?$/.test(suffix);
}
function readBackgroundOpacity(input) { const value = Number(input?.value); return Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.35) : 0.12; }
function escapeHtml(text) { return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
function sanitizeFileName(value) { return String(value || "catalogo").replace(/[<>:\"/\\|?*]+/g, "").trim() || "catalogo"; }
function pickDefaultCategoryColor(index, type) { const palettes = [["#2c4695", "#1d1d1b"], ["#7f8f55", "#2f3b29"], ["#1d6f8b", "#173642"], ["#c46a2d", "#4b2d1c"], ["#824d84", "#2f2232"], ["#4f6c88", "#243646"]]; const pair = palettes[index % palettes.length]; return type === "primary" ? pair[0] : pair[1]; }
function byId(id) { return document.getElementById(id); }
function pathToFileUrl(filePath) {
const normalizedPath = String(filePath || "").replace(/\\/g, "/");
if (!normalizedPath) return "";
return encodeURI(`file:///${normalizedPath.replace(/^\/+/, "")}`);
}
function createPlaceholderDataUri() { const svg = ["<svg xmlns='http://www.w3.org/2000/svg' width='420' height='280'>", "<rect width='100%' height='100%' rx='18' fill='#f6f4ef' stroke='#ddd8d0' stroke-width='2'/>", "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#8d8b85' font-family='Arial, Helvetica, sans-serif' font-size='22'>Imagen no disponible</text>", "</svg>"].join(""); return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
async function waitForImagesToLoad(container) { const images = Array.from(container.querySelectorAll("img")); await Promise.all(images.map((img) => { if (img.complete) return Promise.resolve(); return new Promise((resolve) => { img.addEventListener("load", resolve, { once: true }); img.addEventListener("error", resolve, { once: true }); }); })); }
window.addEventListener("beforeunload", () => { if (state.coverImageUrl?.startsWith("blob:")) URL.revokeObjectURL(state.coverImageUrl); if (state.pageLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(state.pageLogoUrl); if (state.pageBackgroundUrl?.startsWith("blob:")) URL.revokeObjectURL(state.pageBackgroundUrl); if (state.heroImageUrl?.startsWith("blob:")) URL.revokeObjectURL(state.heroImageUrl); if (state.promotion.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(state.promotion.imageUrl); if (state.promotion.videoUrl?.startsWith("blob:")) URL.revokeObjectURL(state.promotion.videoUrl); revokeObjectUrls(state.promotion.imageUrls || []); revokeObjectUrls(state.imageUrls); revokeObjectUrls(state.featuredBrands.map((brand) => brand.logoUrl).filter(Boolean)); });
})();
