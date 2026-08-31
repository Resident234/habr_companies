import { CONFIG } from '../config.js';
import { BrowserStorage } from './browserStorage.js';

// Module-level: resolves once background has detected the base URL
const apiBasePromise = new Promise((resolve) => {
    const api = globalThis.browser ?? globalThis.chrome;
    // First check storage.local (from previous session / completed detection)
    api.storage.local.get('api_base_url').then((result) => {
        if (result?.api_base_url) {
            resolve(result.api_base_url);
            return;
        }
        // Storage empty — poll the background script for the detected URL
        const poll = () => {
            api.runtime.sendMessage({ type: 'GET_BASE_URL' }, (response) => {
                if (!api.runtime.lastError && response?.url) {
                    resolve(response.url);
                }
            });
        };
        poll();
        // Retry every 200ms until we get a response (background is still detecting)
        const interval = setInterval(poll, 200);
        api.runtime.onMessage.addListener(function handler(msg, sender, sendResponse) {
            if (msg?.type === 'BASE_URL_RESPONSE' && msg.url) {
                clearInterval(interval);
                resolve(msg.url);
                api.runtime.onMessage.removeListener(handler);
            }
        });
    });
});
let _cachedBaseUrl = null;

async function getBaseUrl() {
    if (_cachedBaseUrl) return _cachedBaseUrl;
    _cachedBaseUrl = await apiBasePromise;
    console.log('[CompanyApiClient] Base URL resolved:', _cachedBaseUrl);
    return _cachedBaseUrl;
}

export class CompanyApiClient {
    constructor() {
        this._storage = new BrowserStorage('preferences');
    }

    async sendCompany(code, title) {
        console.log('[CompanyApiClient.sendCompany] Called with code:', code, 'title:', title);

        const baseUrl = await this._getBaseUrl();
        const encodedCode = encodeURIComponent(code);
        const encodedTitle = encodeURIComponent(title);
        const url = `${baseUrl}/company/add/${encodedCode}/${encodedTitle}`;

        console.log('[CompanyApiClient.sendCompany] Base URL:', baseUrl);
        console.log('[CompanyApiClient.sendCompany] Full request URL:', url);
        console.log('[CompanyApiClient.sendCompany] API Key (first 4 chars):', CONFIG.API_KEY.substring(0, 4) + '...');
        console.log('[CompanyApiClient.sendCompany] Sending POST request via background...');

        try {
            const response = await this._fetch(url, {
                method: 'POST',
                headers: {
                    'X-API-Key': CONFIG.API_KEY,
                    'Content-Type': 'application/json'
                },
            });

            console.log('[CompanyApiClient.sendCompany] Response status:', response.status);
            console.log('[CompanyApiClient.sendCompany] Response ok:', response.ok);
            console.log('[CompanyApiClient.sendCompany] Response body:', response.body);

            if (response.error) throw new Error(response.error);

            if (response.ok) {
                return {
                    message: `Компания добавлена успешно: title[${title}], code[${code}]`,
                    type: 'success'
                };
            }

            return {
                message: `Ошибка добавления компании: title[${title}], code[${code}], status[${response.status}]`,
                type: 'error'
            };
        } catch (error) {
            console.error('[CompanyApiClient.sendCompany] Fetch failed:', error);
            throw new Error(`Could not send query for company "${code}" to ${url}`);
        }
    }

    async getStatuses(code) {
        console.log('[CompanyApiClient.getStatuses] Called with code:', code);
        return this._getJson(
            `/company/statuses/${encodeURIComponent(code)}`,
            'CompanyApiClient.getStatuses'
        );
    }

    async getArticleStatuses(companyCode, articleId) {
        console.log('[CompanyApiClient.getArticleStatuses] Called with companyCode:', companyCode, 'articleId:', articleId);
        return this._getJson(
            `/article/statuses/${encodeURIComponent(companyCode)}/${encodeURIComponent(articleId)}`,
            'CompanyApiClient.getArticleStatuses'
        );
    }

    async getNewsStatuses(companyCode, newsId) {
        console.log('[CompanyApiClient.getNewsStatuses] Called with companyCode:', companyCode, 'newsId:', newsId);
        return this._getJson(
            `/news/statuses/${encodeURIComponent(companyCode)}/${encodeURIComponent(newsId)}`,
            'CompanyApiClient.getNewsStatuses'
        );
    }

    async getPostsStatuses(companyCode, postIds) {
        console.log('[CompanyApiClient.getPostsStatuses] Called with companyCode:', companyCode, 'postIds:', postIds);

        if (!postIds || postIds.length === 0) {
            console.log('[CompanyApiClient.getPostsStatuses] Empty post ids, skipping');
            return null;
        }

        const idsParam = postIds.map(id => encodeURIComponent(String(id))).join(',');
        return this._getJson(
            `/posts/statuses/${encodeURIComponent(companyCode)}?ids=${idsParam}`,
            'CompanyApiClient.getPostsStatuses'
        );
    }

    async _getJson(path, logLabel) {
        const baseUrl = await this._getBaseUrl();
        const url = `${baseUrl}${path}`;
        console.log(`[${logLabel}] Full request URL:`, url);

        try {
            const response = await this._fetch(url, {
                method: 'GET',
                headers: {
                    'X-API-Key': CONFIG.API_KEY,
                    'Content-Type': 'application/json'
                },
            });

            if (!response) {
                throw new Error('Background fetch returned no response');
            }

            console.log(`[${logLabel}] Response status:`, response.status);
            console.log(`[${logLabel}] Response body:`, response.body);

            if (response.error) throw new Error(response.error);

            if (!response.ok) {
                console.warn(`[${logLabel}] Non-ok response:`, response.status);
                return null;
            }

            return JSON.parse(response.body);
        } catch (error) {
            console.error(`[${logLabel}] Fetch failed:`, error);
            return null;
        }
    }

    async _fetch(url, { method = 'GET', headers = {}, body } = {}) {
        const api = globalThis.browser ?? globalThis.chrome;
        if (!api?.runtime?.sendMessage) {
            throw new Error('Extension runtime messaging API is unavailable');
        }

        const request = {
            type: 'FETCH_REQUEST',
            url,
            method,
            // Бесплатный ngrok показывает браузерную HTML-страницу-предупреждение
            // вместо ответа API. Этот заголовок отключает interstitial, чтобы
            // эндпоинты статусов возвращали JSON и бейджи могли отрисоваться.
            headers: {
                ...headers,
                'ngrok-skip-browser-warning': 'true'
            }
        };
        if (body !== undefined) request.body = body;

        const response = await api.runtime.sendMessage(request);
        if (!response) {
            throw new Error('Background fetch returned no response');
        }
        return response;
    }
    async _getBaseUrl() {
        return getBaseUrl();
    }


    /**
     * Выполняет PATCH-запрос к эндпоинту смены статуса через background-скрипт.
     * @param {string} path — относительный путь (например, /post/statuses/...)
     * @returns {Object|null} распарсенное тело ответа либо null при ошибке
     */
    async _patchStatus(path) {
        const baseUrl = await this._getBaseUrl();
        const url = `${baseUrl}${path}`;
        console.log('[CompanyApiClient._patchStatus] Full request URL:', url);

        try {
            const response = await this._fetch(url, {
                method: 'PATCH',
                headers: {
                        'X-API-Key': CONFIG.API_KEY,
                        'Content-Type': 'application/json'
                },
            });

            console.log('[CompanyApiClient._patchStatus] Response status:', response.status);
            console.log('[CompanyApiClient._patchStatus] Response body:', response.body);

            if (response.error) throw new Error(response.error);

            if (!response.ok) {
                console.warn('[CompanyApiClient._patchStatus] Non-ok response:', response.status, response.body);
                return { error: true, status: response.status, body: response.body };
            }

            return JSON.parse(response.body);
        } catch (error) {
            console.error('[CompanyApiClient._patchStatus] Fetch failed:', error);
            return null;
        }
    }

    /** Переключает статус бейджа компании (action_dev / action_industry / action_company). */
    async updateCompanyStatus(companyCode, field, direction) {
        return this._patchStatus(
            `/company/statuses/${encodeURIComponent(companyCode)}/${encodeURIComponent(field)}/${encodeURIComponent(direction)}`
        );
    }

    /** Переключает статус бейджа статьи. */
    async updateArticleStatus(companyCode, articleId, field, direction) {
        return this._patchStatus(
            `/article/statuses/${encodeURIComponent(companyCode)}/${encodeURIComponent(articleId)}/${encodeURIComponent(field)}/${encodeURIComponent(direction)}`
        );
    }

    /** Переключает статус бейджа новости. */
    async updateNewsStatus(companyCode, newsId, field, direction) {
        return this._patchStatus(
            `/news/statuses/${encodeURIComponent(companyCode)}/${encodeURIComponent(newsId)}/${encodeURIComponent(field)}/${encodeURIComponent(direction)}`
        );
    }

    /** Переключает статус бейджа поста. */
    async updatePostStatus(companyCode, postId, field, direction) {
        return this._patchStatus(
            `/post/statuses/${encodeURIComponent(companyCode)}/${encodeURIComponent(postId)}/${encodeURIComponent(field)}/${encodeURIComponent(direction)}`
        );
    }

    /**
     * Добавить комментарий в закладки.
     * @param {Object} data
     * @param {string} data.text — текст комментария
     * @param {string} data.entity_code — news | articles | posts
     * @param {number} data.entity_id — ID сущности
     * @param {number} data.comment_id — ID комментария
     * @returns {Promise<Object>}
     */
    async addComment(data) {
        const baseUrl = await this._getBaseUrl();
        const url = `${baseUrl}/comment/add`;

        try {
            console.log('[CompanyApiClient.addComment] Sending comment request:', {
                entity_code: data.entity_code,
                entity_id: data.entity_id,
                comment_id: data.comment_id,
                company_code: data.company_code,
                article_title_present: Boolean(data.article_title)
            });
            const response = await this._fetch(url, {
                method: 'POST',
                headers: {
                        'X-API-Key': CONFIG.API_KEY,
                        'Content-Type': 'application/json'
                    },
                body: JSON.stringify(data)
            });

            if (response.error) throw new Error(response.error);

			if (!response.ok) {
				let details = '';
				try {
					const payload = JSON.parse(response.body || '{}');
					details = payload.error ? `, error[${payload.error}]` : '';
				} catch (parseError) {
					console.warn('[CompanyApiClient.addComment] Could not parse error response:', parseError);
				}
				console.error('[CompanyApiClient.addComment] API rejected comment:', {
					status: response.status,
					body: response.body
				});
				return {
					message: `Ошибка добавления комментария: status[${response.status}]${details}`,
					type: 'error'
				};
			}

            let payload = {};
            try {
                payload = JSON.parse(response.body || '{}');
            } catch (parseError) {
                console.warn('[CompanyApiClient.addComment] Could not parse success response:', parseError);
            }

            let message = `Комментарий добавлен успешно: id[${payload.comment_id || data.comment_id}]`;
            if (payload.article && payload.article.created) {
                message += `. Статья добавлена в БД: id[${payload.article.id}], title[${payload.article.title}], company[${payload.article.company}]`;
            }

            return {
                message,
                type: 'success'
            };
        } catch (error) {
            console.error('[CompanyApiClient.addComment] Fetch failed:', error);
            throw new Error(`Could not send comment to ${url}`);
        }
    }

    /**
     * Удалить закладку комментария.
     * @param {number} commentId — ID комментария
     * @returns {Promise<Object>}
     */
    async deleteComment(commentId) {
        const baseUrl = await this._getBaseUrl();
        const url = `${baseUrl}/comment/${commentId}`;

        try {
            const response = await this._fetch(url, {
                method: 'DELETE',
                headers: {
                        'X-API-Key': CONFIG.API_KEY
                },
            });

            if (response.error) throw new Error(response.error);

            if (!response.ok) {
                return {
                    message: `Ошибка удаления комментария: id[${commentId}], status[${response.status}]`,
                    type: 'error'
                };
            }

            return {
                message: `Комментарий удалён успешно: id[${commentId}]`,
                type: 'success'
            };
        } catch (error) {
            console.error('[CompanyApiClient.deleteComment] Fetch failed:', error);
            throw new Error(`Could not delete comment "${commentId}" from ${url}`);
        }
    }
}
