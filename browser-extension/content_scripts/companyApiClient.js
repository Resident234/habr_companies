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

    async getStatuses(code) {
        console.log('[CompanyApiClient.getStatuses] Called with code:', code);

        const baseUrl = await this._getBaseUrl();
        const url = `${baseUrl}/company/statuses/${encodeURIComponent(code)}`;
        console.log('[CompanyApiClient.getStatuses] Full request URL:', url);

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
                    method: 'GET',
                    headers: {
                        'X-API-Key': CONFIG.API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
            });

            console.log('[CompanyApiClient.getStatuses] Response status:', response.status);
            console.log('[CompanyApiClient.getStatuses] Response body:', response.body);

            if (response.error) throw new Error(response.error);

            if (!response.ok) {
                console.warn('[CompanyApiClient.getStatuses] Non-ok response:', response.status);
                return null;
            }

            return JSON.parse(response.body);
        } catch (error) {
            console.error('[CompanyApiClient.getStatuses] Fetch failed:', error);
            return null;
        }
    }

    async getArticleStatuses(companyCode, articleId) {
        console.log('[CompanyApiClient.getArticleStatuses] Called with companyCode:', companyCode, 'articleId:', articleId);

        const baseUrl = await this._getBaseUrl();
        const url = `${baseUrl}/article/statuses/${encodeURIComponent(companyCode)}/${encodeURIComponent(articleId)}`;
        console.log('[CompanyApiClient.getArticleStatuses] Full request URL:', url);

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
                    method: 'GET',
                    headers: {
                        'X-API-Key': CONFIG.API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
            });

            console.log('[CompanyApiClient.getArticleStatuses] Response status:', response.status);
            console.log('[CompanyApiClient.getArticleStatuses] Response body:', response.body);

            if (response.error) throw new Error(response.error);

            if (!response.ok) {
                console.warn('[CompanyApiClient.getArticleStatuses] Non-ok response:', response.status);
                return null;
            }

            return JSON.parse(response.body);
        } catch (error) {
            console.error('[CompanyApiClient.getArticleStatuses] Fetch failed:', error);
            return null;
        }
    }

    async getNewsStatuses(companyCode, newsId) {
        console.log('[CompanyApiClient.getNewsStatuses] Called with companyCode:', companyCode, 'newsId:', newsId);

        const baseUrl = await this._getBaseUrl();
        const url = `${baseUrl}/news/statuses/${encodeURIComponent(companyCode)}/${encodeURIComponent(newsId)}`;
        console.log('[CompanyApiClient.getNewsStatuses] Full request URL:', url);

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
                    method: 'GET',
                    headers: {
                        'X-API-Key': CONFIG.API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
            });

            console.log('[CompanyApiClient.getNewsStatuses] Response status:', response.status);
            console.log('[CompanyApiClient.getNewsStatuses] Response body:', response.body);

            if (response.error) throw new Error(response.error);

            if (!response.ok) {
                console.warn('[CompanyApiClient.getNewsStatuses] Non-ok response:', response.status);
                return null;
            }

            return JSON.parse(response.body);
        } catch (error) {
            console.error('[CompanyApiClient.getNewsStatuses] Fetch failed:', error);
            return null;
        }
    }

    async getPostsStatuses(companyCode, postIds) {
        console.log('[CompanyApiClient.getPostsStatuses] Called with companyCode:', companyCode, 'postIds:', postIds);

        if (!postIds || postIds.length === 0) {
            console.log('[CompanyApiClient.getPostsStatuses] Empty post ids, skipping');
            return null;
        }

        const baseUrl = await this._getBaseUrl();
        const idsParam = postIds.map(id => encodeURIComponent(String(id))).join(',');
        const url = `${baseUrl}/posts/statuses/${encodeURIComponent(companyCode)}?ids=${idsParam}`;
        console.log('[CompanyApiClient.getPostsStatuses] Full request URL:', url);

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
                    method: 'GET',
                    headers: {
                        'X-API-Key': CONFIG.API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
            });

            console.log('[CompanyApiClient.getPostsStatuses] Response status:', response.status);
            console.log('[CompanyApiClient.getPostsStatuses] Response body:', response.body);

            if (response.error) throw new Error(response.error);

            if (!response.ok) {
                console.warn('[CompanyApiClient.getPostsStatuses] Non-ok response:', response.status);
                return null;
            }

            return JSON.parse(response.body);
        } catch (error) {
            console.error('[CompanyApiClient.getPostsStatuses] Fetch failed:', error);
            return null;
        }
    }

    async _getBaseUrl() {
        const prefs = await this._storage.get();
        return (prefs && prefs.base_url) ? prefs.base_url : CONFIG.DEFAULT_BASE_URL;
    }
}
