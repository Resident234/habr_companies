(async () => {
    console.log('[index] Content script starting');

    const moduleUrl = chrome.runtime.getURL('content_scripts/companyProcessor.js');
    console.log('[index] Importing module:', moduleUrl);

    const { CompanyProcessor } = await import(moduleUrl);
    const processor = new CompanyProcessor();
    console.log('[index] CompanyProcessor instantiated, calling init()');

    await processor.init();
    console.log('[index] CompanyProcessor.init() completed');
})();
