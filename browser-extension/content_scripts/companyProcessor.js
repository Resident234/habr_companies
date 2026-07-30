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
        console.log('[CompanyProcessor.init] Entering, document.readyState =', document.readyState);

        if (document.readyState !== 'complete') {
            console.log('[CompanyProcessor.init] Page not ready, waiting for load event');
            await new Promise(resolve => window.addEventListener('load', resolve));
            console.log('[CompanyProcessor.init] Page load event fired');
        }

        const url = new URL(window.location.href);
        const patternUrl = new URL(CONFIG.URL_PATTERN);
        console.log('[CompanyProcessor.init] Current URL:', url.href);
        console.log('[CompanyProcessor.init] Pattern URL:', CONFIG.URL_PATTERN);
        console.log('[CompanyProcessor.init] Pathname match:', url.pathname, 'starts with', patternUrl.pathname.replace(/\*$/, ''), '→', url.pathname.startsWith(patternUrl.pathname.replace(/\*$/, '')));

        if (!this._isCorrectPage()) {
            console.log('[CompanyProcessor.init] Not a correct page, skipping');
            return;
        }

        console.log('[CompanyProcessor.init] Correct page detected, extracting data');

        try {
            const code = CompanyExtractor.extractCode();
            const title = CompanyExtractor.extractTitle();

            console.log('[CompanyProcessor.init] Extracted code:', code);
            console.log('[CompanyProcessor.init] Extracted title:', title);

            if (!code || !title) {
                console.log('[CompanyProcessor.init] Could not extract company code or title, aborting.');
                return;
            }

            console.log('[CompanyProcessor.init] Calling API client sendCompany with code:', code, 'title:', title);
            const result = await this._apiClient.sendCompany(code, title);
            console.log('[CompanyProcessor.init] API response:', result);

            MessageControl.show(result.message, result.type);
        } catch (error) {
            console.error('[CompanyProcessor.init] Error:', error);
            MessageControl.show(error.message, 'error');
        }
    }

    _isCorrectPage() {
        const url = new URL(window.location.href);
        const patternUrl = new URL(CONFIG.URL_PATTERN);
        const patternPath = patternUrl.pathname.replace(/\*$/, '');
        return url.pathname.startsWith(patternPath);
    }
}
