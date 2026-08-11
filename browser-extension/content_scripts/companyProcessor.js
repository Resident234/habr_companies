import { CONFIG } from '../config.js';
import { BrowserAPI } from './browserAPI.js';
import { CompanyApiClient } from './companyApiClient.js';
import { CompanyExtractor } from './companyExtractor.js';
import { MessageControl } from './messageControl.js';
import { StatusBadges } from './statusBadges.js';

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

        const articleMatch = url.pathname.match(/^\/ru\/companies\/([a-zA-Z0-9_-]+)\/articles\/(\d+)\/?$/);
        const newsMatch = url.pathname.match(/^\/ru\/companies\/([a-zA-Z0-9_-]+)\/news\/(\d+)\/?$/);

        try {
            if (articleMatch) {
                await this._initArticlePage(articleMatch[1], articleMatch[2]);
            } else if (newsMatch) {
                await this._initNewsPage(newsMatch[1], newsMatch[2]);
            } else {
                await this._initCompanyPage();
            }
        } catch (error) {
            console.error('[CompanyProcessor.init] Error:', error);
            MessageControl.show(error.message, 'error');
        }
    }

    async _initCompanyPage() {
        console.log('[CompanyProcessor._initCompanyPage] Company page detected, extracting data');

        const code = CompanyExtractor.extractCode();
        const title = CompanyExtractor.extractTitle();

        console.log('[CompanyProcessor._initCompanyPage] Extracted code:', code);
        console.log('[CompanyProcessor._initCompanyPage] Extracted title:', title);

        if (!code || !title) {
            console.log('[CompanyProcessor._initCompanyPage] Could not extract company code or title, aborting.');
            return;
        }

        console.log('[CompanyProcessor._initCompanyPage] Calling API client sendCompany with code:', code, 'title:', title);
        const result = await this._apiClient.sendCompany(code, title);
        console.log('[CompanyProcessor._initCompanyPage] API response:', result);

        MessageControl.show(result.message, result.type);

        console.log('[CompanyProcessor._initCompanyPage] Fetching company statuses for code:', code);
        const statuses = await this._apiClient.getStatuses(code);
        console.log('[CompanyProcessor._initCompanyPage] Statuses received:', statuses);

        StatusBadges.render(statuses);
    }

    async _initArticlePage(companyCode, articleId) {
        console.log('[CompanyProcessor._initArticlePage] Article page detected, companyCode:', companyCode, 'articleId:', articleId);

        const statuses = await this._apiClient.getArticleStatuses(companyCode, articleId);
        console.log('[CompanyProcessor._initArticlePage] Statuses received:', statuses);

        StatusBadges.renderArticle(statuses);
    }

    async _initNewsPage(companyCode, newsId) {
        console.log('[CompanyProcessor._initNewsPage] News page detected, companyCode:', companyCode, 'newsId:', newsId);

        const statuses = await this._apiClient.getNewsStatuses(companyCode, newsId);
        console.log('[CompanyProcessor._initNewsPage] Statuses received:', statuses);

        StatusBadges.renderNews(statuses);
    }

    _isCorrectPage() {
        const url = new URL(window.location.href);
        const patternUrl = new URL(CONFIG.URL_PATTERN);
        const patternPath = patternUrl.pathname.replace(/\*$/, '');
        return url.pathname.startsWith(patternPath);
    }
}
