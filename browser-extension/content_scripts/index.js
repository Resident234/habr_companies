(async () => {
    const moduleUrl = chrome.runtime.getURL('content_scripts/companyProcessor.js');
    const { CompanyProcessor } = await import(moduleUrl);
    const processor = new CompanyProcessor();
    await processor.init();
})();
