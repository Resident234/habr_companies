(async () => {
    const moduleUrl = chrome.runtime.getURL('content_scripts/habrCompanyExtractor.js');
    const { HabrCompanyExtractor } = await import(moduleUrl);
    const extractor = new HabrCompanyExtractor();
    await extractor.init();
})();