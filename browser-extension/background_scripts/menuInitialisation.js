const extensionApi = globalThis.browser ?? globalThis.chrome;

console.log('Habr Companies background script initialized');

if (!extensionApi?.runtime?.onMessage) {
    throw new Error('Extension runtime API is unavailable in the background context');
}

extensionApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== 'FETCH_REQUEST') return false;

    console.log('[background] Fetch request received:', msg.url);

    (async () => {
        try {
            const request = {
                method: msg.method || 'GET',
                headers: msg.headers || {}
            };
            if (msg.body !== undefined) request.body = msg.body;

            const response = await fetch(msg.url, request);
            const body = await response.text();
            console.log('[background] Response status:', response.status, '| body:', body);
            sendResponse({ ok: response.ok, status: response.status, body });
        } catch (error) {
            console.error('[background] Fetch error:', error);
            sendResponse({ ok: false, error: error?.message || String(error) });
        }
    })();

    return true;
});
