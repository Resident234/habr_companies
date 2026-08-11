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
        const postMatch = url.pathname.match(/^\/ru\/companies\/([a-zA-Z0-9_-]+)\/posts\/(\d+)\/?$/);
        const postsListMatch = url.pathname.match(/^\/ru\/companies\/([a-zA-Z0-9_-]+)\/posts\/(?:page(\d+)\/?)?$/);

        try {
            if (postMatch) {
                await this._initPostPage(postMatch[1], postMatch[2]);
            } else if (postsListMatch) {
                await this._initPostsListPage(postsListMatch[1]);
            } else if (articleMatch) {
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

    async _initPostPage(companyCode, postId) {
        console.log('[CompanyProcessor._initPostPage] Post page detected, companyCode:', companyCode, 'postId:', postId);

        const response = await this._apiClient.getPostsStatuses(companyCode, [parseInt(postId, 10)]);
        console.log('[CompanyProcessor._initPostPage] Statuses received:', response);

        if (!response || !Array.isArray(response.posts)) {
            console.log('[CompanyProcessor._initPostPage] No posts statuses in response, skipping');
            return;
        }

        const statuses = response.posts.find(post => Number(post.id) === Number(postId));
        console.log('[CompanyProcessor._initPostPage] Statuses for post:', statuses);

        StatusBadges.renderPost(statuses);
    }

    async _initNewsPage(companyCode, newsId) {
        console.log('[CompanyProcessor._initNewsPage] News page detected, companyCode:', companyCode, 'newsId:', newsId);

        const statuses = await this._apiClient.getNewsStatuses(companyCode, newsId);
        console.log('[CompanyProcessor._initNewsPage] Statuses received:', statuses);

        StatusBadges.renderNews(statuses);
    }

    async _initPostsListPage(companyCode) {
        console.log('[CompanyProcessor._initPostsListPage] Posts list page detected, companyCode:', companyCode);

        const articles = [...document.querySelectorAll('.tm-articles-list article[id]')];
        console.log('[CompanyProcessor._initPostsListPage] Found articles:', articles.length);

        const items = articles
            .map(el => ({ element: el, id: parseInt(el.id, 10) }))
            .filter(item => Number.isInteger(item.id) && item.id > 0);

        console.log('[CompanyProcessor._initPostsListPage] Valid post ids:', items.map(i => i.id));

        if (items.length === 0) {
            console.log('[CompanyProcessor._initPostsListPage] No posts found on page, skipping');
            return;
        }

        const response = await this._apiClient.getPostsStatuses(companyCode, items.map(i => i.id));
        console.log('[CompanyProcessor._initPostsListPage] Statuses received:', response);

        if (!response || !Array.isArray(response.posts)) {
            console.log('[CompanyProcessor._initPostsListPage] No posts statuses in response, skipping');
            return;
        }

        const byId = new Map(response.posts.map(post => [Number(post.id), post]));
        let rendered = 0;
        for (const item of items) {
            const statuses = byId.get(item.id);
            if (!statuses) continue;
            StatusBadges.renderPostInList(item.element, statuses);
            rendered++;
        }
        console.log('[CompanyProcessor._initPostsListPage] Badges rendered for posts:', rendered);
    }

    _isCorrectPage() {
        const url = new URL(window.location.href);
        const patternUrl = new URL(CONFIG.URL_PATTERN);
        const patternPath = patternUrl.pathname.replace(/\*$/, '');
        return url.pathname.startsWith(patternPath);
    }
}
