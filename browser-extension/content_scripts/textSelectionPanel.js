import { CONFIG } from '../config.js';

let panel = null;
let selectedText = '';

function createPanel() {
    panel = document.createElement('div');
    panel.id = 'habr-companies-selection-panel';
    panel.style.cssText = `
        position: absolute;
        display: none;
        gap: 6px;
        padding: 6px 10px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        align-items: center;
        white-space: nowrap;
    `;

    const btnCompany = document.createElement('button');
    btnCompany.textContent = '🏢 Компания';
    btnCompany.style.cssText = `
        padding: 4px 10px;
        border: none;
        border-radius: 5px;
        background: #4361ee;
        color: white;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
    `;
    btnCompany.onmouseenter = () => btnCompany.style.background = '#3a56d4';
    btnCompany.onmouseleave = () => btnCompany.style.background = '#4361ee';
    btnCompany.onclick = () => saveSelection('company');

    const btnCategory = document.createElement('button');
    btnCategory.textContent = '📂 Отрасль';
    btnCategory.style.cssText = `
        padding: 4px 10px;
        border: none;
        border-radius: 5px;
        background: #f72585;
        color: white;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
    `;
    btnCategory.onmouseenter = () => btnCategory.style.background = '#d91e74';
    btnCategory.onmouseleave = () => btnCategory.style.background = '#f72585';
    btnCategory.onclick = () => saveSelection('category');

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        margin-left: 4px;
        cursor: pointer;
        color: #888;
        font-size: 14px;
        line-height: 1;
    `;
    closeBtn.onmouseenter = () => closeBtn.style.color = '#fff';
    closeBtn.onmouseleave = () => closeBtn.style.color = '#888';
    closeBtn.onclick = hidePanel;

    panel.appendChild(btnCompany);
    panel.appendChild(btnCategory);
    panel.appendChild(closeBtn);
    document.body.appendChild(panel);
}

function showPanel(rect) {
    if (!panel) createPanel();
    selectedText = window.getSelection()?.toString()?.trim();
    if (!selectedText) return;

    panel.style.display = 'flex';
    panel.style.left = rect.left + rect.width / 2 - panel.offsetWidth / 2 + 'px';
    panel.style.top = rect.top - panel.offsetHeight - 10 + 'px';

    // Adjust if panel goes off top
    if (rect.top - panel.offsetHeight - 10 < 0) {
        panel.style.top = rect.bottom + 10 + 'px';
    }
}

function hidePanel() {
    if (panel) {
        panel.style.display = 'none';
    }
}

async function sendToAPI(endpoint, title) {
    const baseUrl = CONFIG.DEFAULT_BASE_URL;
    const url = `${baseUrl}${endpoint}`;

    try {
        const response = await new Promise((resolve, reject) => {
            const port = chrome.runtime.connect({ name: 'fetch' });
            let settled = false;

            port.onMessage.addListener((msg) => {
                settled = true;
                port.disconnect();
                resolve(msg);
            });

            port.onDisconnect.addListener(() => {
                if (settled) return;
                reject(new Error('Connection lost'));
            });

            port.postMessage({
                type: 'FETCH_REQUEST',
                url: url,
                method: 'POST',
                headers: {
                    'X-API-Key': CONFIG.API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title })
            });
        });

        if (response.error) throw new Error(response.error);
        return { ok: response.ok, status: response.status, body: response.body };
    } catch (err) {
        console.error('[SelectionPanel] API error:', err);
        return { ok: false, error: err.message };
    }
}

async function saveSelection(type) {
    const title = selectedText;
    const endpoint = type === 'company' ? '/company/quick-add' : '/category/quick-add';
    const result = await sendToAPI(endpoint, title);

    // Show feedback
    const originalDisplay = panel.style.display;
    const success = result.ok;
    panel.style.background = success ? '#2e7d32' : '#c62828';

    setTimeout(() => {
        panel.style.background = '#1a1a2e';
        hidePanel();
    }, 1500);
}

// Listen for text selection
document.addEventListener('mouseup', (e) => {
    const selection = window.getSelection();
    const text = selection?.toString()?.trim();

    if (text && text.length > 0 && text.length < 200 && !text.includes('\n')) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0) {
            showPanel(rect);
        }
    } else {
        hidePanel();
    }
});

// Hide panel when clicking outside
document.addEventListener('mousedown', (e) => {
    if (panel && !panel.contains(e.target)) {
        hidePanel();
    }
});

console.log('[SelectionPanel] Initialized');
