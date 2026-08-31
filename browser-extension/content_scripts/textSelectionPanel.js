import { CONFIG } from '../config.js';

let panel = null;
let selectedText = '';
const PANEL_GAP = 6;

function createPanel() {
    panel = document.createElement('div');
    panel.id = 'habr-companies-selection-panel';
    panel.className = 'habr-selection-panel';

    const btnCompany = document.createElement('button');
    btnCompany.className = 'habr-selection-panel__button habr-selection-panel__button--company';
    btnCompany.type = 'button';
    btnCompany.textContent = 'Компания';
    btnCompany.setAttribute('aria-label', 'Сохранить выделение как компанию');
    btnCompany.onclick = () => saveSelection('company');

    const btnCategory = document.createElement('button');
    btnCategory.className = 'habr-selection-panel__button habr-selection-panel__button--industry';
    btnCategory.type = 'button';
    btnCategory.textContent = 'Отрасль';
    btnCategory.setAttribute('aria-label', 'Сохранить выделение как отрасль');
    btnCategory.onclick = () => saveSelection('category');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'habr-selection-panel__close';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Закрыть панель');
    closeBtn.onclick = hidePanel;

    panel.appendChild(btnCompany);
    panel.appendChild(btnCategory);
    panel.appendChild(closeBtn);
    document.body.appendChild(panel);
}

export function calculatePanelPosition(rect, panelSize, gap = PANEL_GAP) {
    let top = rect.top - panelSize.height - gap;

    if (top < 0) {
        top = rect.bottom + gap;
    }

    return {
        left: rect.left + rect.width / 2 - panelSize.width / 2,
        top
    };
}

function showPanel(rect) {
    if (!panel) createPanel();
    selectedText = window.getSelection()?.toString()?.trim();
    if (!selectedText) return;

    panel.style.display = 'flex';
    const position = calculatePanelPosition(rect, {
        width: panel.offsetWidth,
        height: panel.offsetHeight
    });
    panel.style.left = position.left + 'px';
    panel.style.top = position.top + 'px';
}

function hidePanel() {
    if (panel) {
        panel.style.display = 'none';
    }
}

async function sendToAPI(endpoint, title) {
    const api = globalThis.browser ?? globalThis.chrome;
    let baseUrl;
    try {
        // First check storage (from previous session or completed detection)
        const result = await api.storage.local.get('api_base_url');
        if (result?.api_base_url) {
            baseUrl = result.api_base_url;
        } else {
            // Poll background script for detected URL (max 5s timeout)
            baseUrl = await Promise.race([
                new Promise((resolve) => {
                    const poll = () => {
                        api.runtime.sendMessage({ type: 'GET_BASE_URL' }, (response) => {
                            if (!api.runtime.lastError && response?.url) {
                                resolve(response.url);
                            }
                        });
                    };
                    poll();
                    const interval = setInterval(poll, 200);
                    setTimeout(() => clearInterval(interval), 5000);
                }),
                new Promise((resolve) => setTimeout(() => resolve(CONFIG.DEFAULT_BASE_URL), 5000))
            ]);
        }
    } catch {
        baseUrl = CONFIG.DEFAULT_BASE_URL;
    }
    const url = `${baseUrl}${endpoint}`;

    try {
        const response = await api.runtime.sendMessage({
            type: 'FETCH_REQUEST',
            url,
            method: 'POST',
            headers: {
                'X-API-Key': CONFIG.API_KEY,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ title })
        });

        if (!response) {
            throw new Error('Background fetch returned no response');
        }

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
    panel.classList.toggle('habr-selection-panel--success', success);
    panel.classList.toggle('habr-selection-panel--error', !success);

    setTimeout(() => {
        panel.classList.remove('habr-selection-panel--success', 'habr-selection-panel--error');
        hidePanel();
    }, 1500);
}

// Check if current page matches habr companies pattern
export function isCompanyPage(currentHref = window.location.href) {
    const url = new window.URL(currentHref);
    const patternUrl = new window.URL(CONFIG.URL_PATTERN);
    const patternPath = patternUrl.pathname.replace(/\*$/, '');
    return url.origin === patternUrl.origin && url.pathname.startsWith(patternPath);
}

// Listen for text selection
document.addEventListener('mouseup', (e) => {
    if (!isCompanyPage()) {
        hidePanel();
        return;
    }

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
