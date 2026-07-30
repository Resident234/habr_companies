import { CONFIG } from '../config.js';
import { BrowserAPI } from './browserAPI.js';
import { CompanyApiClient } from './companyApiClient.js';
import { CompanyExtractor } from './companyExtractor.js';
import { MessageControl } from './messageControl.js';

export class CompanyProcessor {
    constructor() {
        this._browserApi = new BrowserAPI();
        this._apiClient = new CompanyApiClient();
    }

    async init() {
        if (document.readyState !== 'complete') {
            await new Promise(resolve => window.addEventListener('load', resolve));
        }

        if (!this._isCorrectPage()) {
            return;
        }

        try {
            const code = CompanyExtractor.extractCode();
            const title = CompanyExtractor.extractTitle();

            if (!code || !title) {
                console.log('CompanyProcessor: Could not extract company code or title.');
                return;
            }

            const responseText = await this._apiClient.sendCompany(code, title);
            MessageControl.show(responseText);
        } catch (error) {
            console.error('CompanyProcessor error:', error);
            MessageControl.show('Error: ' + error.message);
        }
    }

    _isCorrectPage() {
        const url = new URL(window.location.href);
        const patternUrl = new URL(CONFIG.URL_PATTERN);
        return url.pathname.startsWith(patternUrl.pathname);
    }
}
