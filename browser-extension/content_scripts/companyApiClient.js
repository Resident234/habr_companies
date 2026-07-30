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

        console.log('[CompanyApiClient.sendCompany] Sending POST request...');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-API-Key': CONFIG.API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            console.log('[CompanyApiClient.sendCompany] Response status:', response.status, response.statusText);
            console.log('[CompanyApiClient.sendCompany] Response ok:', response.ok);

            const data = await response.text();
            console.log('[CompanyApiClient.sendCompany] Response body:', data);

            if (!response.ok) {
                return `Error ${response.status} for company "${code}": ${data}`;
            }

            return `Company "${code}": ${data}`;
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
