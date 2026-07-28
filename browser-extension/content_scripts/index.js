(async () => {
    const { HabrCompanyExtractor } = await import('./habrCompanyExtractor.js'); 
    const extractor = new HabrCompanyExtractor();
    await extractor.init();
})();