(async () => {
    console.log('[index] Content script starting');

    const moduleUrl = chrome.runtime.getURL('content_scripts/companyProcessor.js');
    console.log('[index] Importing module:', moduleUrl);

    const { CompanyProcessor } = await import(moduleUrl);
    const processor = new CompanyProcessor();
    console.log('[index] CompanyProcessor instantiated, calling init()');

    await processor.init();
    console.log('[index] CompanyProcessor.init() completed');

    // Initialize text selection panel
    const panelModuleUrl = chrome.runtime.getURL('content_scripts/textSelectionPanel.js');
    console.log('[index] Importing textSelectionPanel module:', panelModuleUrl);
    await import(panelModuleUrl);
    console.log('[index] Text selection panel initialized');
})();
