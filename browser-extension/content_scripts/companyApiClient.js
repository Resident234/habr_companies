import { CONFIG } from '../config.js';
import { BrowserStorage } from './browserStorage.js';

export class CompanyApiClient {
    constructor() {
        this._storage = new BrowserStorage('preferences');
    }

    async sendCompany(code, title) {
        console.log('[CompanyApiClient.sendCompany] Called with code:', code, 'title:', title);

        const baseUrl = await this._getBaseUrl();
        const url = `${baseUrl}/company/add/${encodeURIComponent(code)}/${encodeURIComponent(title)}`;
        console.log('[CompanyApiClient.sendCompany] Base URL:', baseUrl);
        console.log('[CompanyApiClient.sendCompany] Full request URL:', url);
        console.log('[CompanyApiClient.sendCompany] API Key (first 4 chars):', CONFIG.API_KEY.substring(0, 4) + '...');

        console.log('[CompanyApiClient.sendCompany] Sending POST request via background...');

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
                    const error = chrome.runtime.lastError;
                    reject(new Error(error?.message || 'Background port closed unexpectedly'));
                });

                port.postMessage({
                    type: 'FETCH_REQUEST',
                    url: url,
                    method: 'POST',
                    headers: {
                        'X-API-Key': CONFIG.API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
            });

            console.log('[CompanyApiClient.sendCompany] Response status:', response.status);
            console.log('[CompanyApiClient.sendCompany] Response ok:', response.ok);
            console.log('[CompanyApiClient.sendCompany] Response body:', response.body);

            if (response.error) throw new Error(response.error);

            if (!response.ok) {
                return {
                    message: `Ошибка добавления компании: title[${title}], code[${code}], status[${response.status}]`,
                    type: 'error'
                };
            }

            return {
                message: `Компания добавлена успешно: title[${title}], code[${code}]`,
                type: 'success'
            };
        } catch (error) {
            console.error('[CompanyApiClient.sendCompany] Fetch failed:', error);
            throw new Error(`Could not send query for company "${code}" to ${url}`);
        }
    }

    async _getBaseUrl() {
        const prefs = await this._storage.get();
        return (prefs && prefs.base_url) ? prefs.base_url : CONFIG.DEFAULT_BASE_URL;
    }
}
