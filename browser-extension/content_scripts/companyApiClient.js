import { CONFIG } from '../config.js';
import { BrowserStorage } from './browserStorage.js';

export class CompanyApiClient {
    constructor() {
        this._storage = new BrowserStorage('preferences');
    }

    async sendCompany(code, title) {
        const baseUrl = await this._getBaseUrl();
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

    async _getBaseUrl() {
        const prefs = await this._storage.get();
        return (prefs && prefs.base_url) ? prefs.base_url : CONFIG.DEFAULT_BASE_URL;
    }
}
