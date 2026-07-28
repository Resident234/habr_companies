import { CONFIG } from '../config.js';
import { BrowserAPI } from './browserAPI.js';
import { BrowserStorage } from './browserStorage.js';
import { MessageControl } from './messageControl.js';

export class HabrCompanyExtractor {
    constructor() {
        this._browserApi = new BrowserAPI();
        this._storage = new BrowserStorage('preferences');
    }

    async init() {
        // Wait for the page to be fully loaded
        if (document.readyState !== 'complete') {
            await new Promise(resolve => window.addEventListener('load', resolve));
        }

        if (this._isCorrectPage()) {
            await this._processCompany();
        }
    }

    _isCorrectPage() {
        const url = new URL(window.location.href);
        const patternUrl = new URL(CONFIG.URL_PATTERN);
        return url.pathname.startsWith(patternUrl.pathname);
    }

    async _processCompany() {
        try {
            const code = this._extractCode();
            const title = this._extractTitle();

            if (!code || !title) {
                console.log('HabrCompanyExtractor: Could not extract company code or title.');
                return;
            }

            const baseUrl = await this._getBaseUrl();
            const responseText = await this._sendToService(baseUrl, code, title);
            
            MessageControl.show(responseText);
        } catch (error) {
            console.error('HabrCompanyExtractor error:', error);
            MessageControl.show('Error: ' + error.message);
        }
    }

    _extractCode() {
        const patternUrl = new URL(CONFIG.URL_PATTERN);
        const patternParts = patternUrl.pathname.split('/').filter(Boolean);
        const segment = patternParts[patternParts.length - 1];

        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const segmentIndex = pathParts.indexOf(segment);
        if (segmentIndex !== -1 && pathParts[segmentIndex + 1]) {
            return pathParts[segmentIndex + 1];
        }
        return null;
    }

    _extractTitle() {
        // Based on the provided HTML structure:
        // <div class="tm-company-profile-card"> ... <div class="info"><a ... class="name"><span>Selectel</span></a></div>
        const nameElement = document.querySelector('.tm-company-profile-card .info a.name span');
        return nameElement ? nameElement.innerText.trim() : null;
    }

    async _getBaseUrl() {
        const prefs = await this._storage.get();
        return (prefs && prefs.base_url) ? prefs.base_url : CONFIG.DEFAULT_BASE_URL;
    }

    async _sendToService(baseUrl, code, title) {
        const url = `${baseUrl}/company/add/${encodeURIComponent(code)}/${encodeURIComponent(title)}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-Key': CONFIG.API_KEY,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.text();
        return `Service response: ${data}`;
    }
}