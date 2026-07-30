console.log('Habr Companies background script initialized');

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'fetch') return;

    port.onMessage.addListener(async (msg) => {
        if (msg?.type !== 'FETCH_REQUEST') return;

        console.log('[background] Fetch request received:', msg.url);

        try {
            const response = await fetch(msg.url, {
                method: msg.method,
                headers: msg.headers
            });

            const body = await response.text();
            console.log('[background] Response status:', response.status, '| body:', body);

            port.postMessage({ ok: response.ok, status: response.status, body });
        } catch (error) {
            console.error('[background] Fetch error:', error);
            port.postMessage({ ok: false, error: error.message });
        }
    });
});