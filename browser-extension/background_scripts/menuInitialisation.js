import { CONFIG } from '../config.js';

const extensionApi = globalThis.browser ?? globalThis.chrome;

console.log('Habr Companies background script initialized');

let _detectedBaseUrl = CONFIG.DEFAULT_BASE_URL;

// Run detection on startup (just verify ngrok is accessible)
async function detectBaseUrl() {
    const checkPath = '/company/statuses/_health_check';
    const timeout = CONFIG.NGROK_CHECK_TIMEOUT_MS;

    try {
        console.log('[background] Checking ngrok accessibility...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${CONFIG.DEFAULT_BASE_URL}${checkPath}`, {
            method: 'GET',
            headers: { 'X-API-Key': CONFIG.API_KEY },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // ngrok should return JSON when healthy
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            console.log('[background] ngrok is healthy, using:', CONFIG.DEFAULT_BASE_URL);
            return CONFIG.DEFAULT_BASE_URL;
        }

        // If not JSON, read body and check for ngrok error page
        const text = await response.text().catch(() => '');
        console.log('[background] ngrok response status:', response.status, 'content-type:', contentType, 'body preview:', text.substring(0, 200));

        if (text.includes('ERR_NGROK') || text.includes('offline') || text.includes('ngrok')) {
            console.log('[background] ngrok returned error page, but no fallback configured');
            return CONFIG.DEFAULT_BASE_URL; // still return ngrok URL, let requests fail naturally
        }

        console.log('[background] ngrok responded with non-JSON but no error markers, using ngrok:', CONFIG.DEFAULT_BASE_URL);
        return CONFIG.DEFAULT_BASE_URL;
    } catch (error) {
        console.log('[background] ngrok check failed:', error.message, '- using ngrok URL anyway');
        return CONFIG.DEFAULT_BASE_URL;
    }
}

detectBaseUrl().then(detectedUrl => {
    _detectedBaseUrl = detectedUrl;
    console.log('[background] Detected base URL:', detectedUrl);

    // Store for future sessions
    const storage = extensionApi.storage.local;
    storage.set({ api_base_url: detectedUrl }).catch(err => {
        console.error('[background] Failed to store base URL:', err);
    });

    // Broadcast to content scripts that are still polling
    const broadcastMsg = { type: 'BASE_URL_RESPONSE', url: detectedUrl };
    extensionApi.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.id) {
                extensionApi.tabs.sendMessage(tab.id, broadcastMsg).catch(() => {});
            }
        }
    });
});

if (!extensionApi?.runtime?.onMessage) {
    throw new Error('Extension runtime API is unavailable in the background context');
}

extensionApi.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Handle requests for the detected base URL
    if (msg?.type === 'GET_BASE_URL') {
        sendResponse({ url: _detectedBaseUrl });
        return true;
    }

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
