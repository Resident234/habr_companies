/**
 * StatusBadges — отображает индикаторы статусов:
 *  - компании (action_industry, action_company) рядом с названием компании;
 *  - статьи и новости (action_dev, action_post, action_comment, action_industry,
 *    action_company) рядом с заголовком страницы.
 */
export class StatusBadges {
    static get CONTAINER_ID() {
        return 'habr-companies-status-badges';
    }

    static get ARTICLE_CONTAINER_ID() {
        return 'habr-article-status-badges';
    }

    /**
     * Рендерит бейджи статусов после ссылки с названием компании.
     * @param {Object} statuses — ответ API: { code, action_industry: {code, title}, action_company: {code, title} }
     */
    static render(statuses) {
        console.log('[StatusBadges.render] Called with:', statuses);

        if (!statuses) {
            console.log('[StatusBadges.render] No statuses, skipping');
            return;
        }

        StatusBadges._removeExisting();

        const nameLink = document.querySelector('.tm-company-profile-card .info a.name')
            || document.querySelector('.info a.name');
        console.log('[StatusBadges.render] Name link found:', nameLink ? 'yes' : 'no');

        if (!nameLink) {
            console.warn('[StatusBadges.render] Company name link not found in DOM');
            return;
        }

        const container = document.createElement('span');
        container.id = StatusBadges.CONTAINER_ID;
        container.className = 'habr-status-badges';

        const badges = [
            { label: 'Отрасль', status: statuses.action_industry },
            { label: 'Компания', status: statuses.action_company },
        ];

        for (const { label, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, status));
        }

        if (container.childElementCount === 0) {
            console.log('[StatusBadges.render] No badges to show, skipping');
            return;
        }

        nameLink.insertAdjacentElement('afterend', container);
        console.log('[StatusBadges.render] Badges inserted');
    }

    /**
     * Рендерит бейджи статусов статьи возле заголовка страницы (h1.tm-title).
     * @param {Object} statuses — ответ API статьи:
     *   { id, company, action_dev, action_post, action_comment, action_industry, action_company }
     */
    static renderArticle(statuses) {
        console.log('[StatusBadges.renderArticle] Called with:', statuses);

        if (!statuses) {
            console.log('[StatusBadges.renderArticle] No statuses, skipping');
            return;
        }

        StatusBadges._removeExistingArticle();

        const title = document.querySelector('h1.tm-title') || document.querySelector('h1');
        console.log('[StatusBadges.renderArticle] Article title found:', title ? 'yes' : 'no');

        if (!title) {
            console.warn('[StatusBadges.renderArticle] Article title not found in DOM');
            return;
        }

        const container = document.createElement('span');
        container.id = StatusBadges.ARTICLE_CONTAINER_ID;
        container.className = 'habr-status-badges habr-status-badges--article';

        const badges = [
            { label: 'Разработка', status: statuses.action_dev },
            { label: 'Пост', status: statuses.action_post },
            { label: 'Комментарий', status: statuses.action_comment },
            { label: 'Отрасль', status: statuses.action_industry },
            { label: 'Компания', status: statuses.action_company },
        ];

        for (const { label, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, status));
        }

        if (container.childElementCount === 0) {
            console.log('[StatusBadges.renderArticle] No badges to show, skipping');
            return;
        }

        title.insertAdjacentElement('afterend', container);
        console.log('[StatusBadges.renderArticle] Badges inserted');
    }

    /**
     * Рендерит бейджи статусов новости возле заголовка страницы (h1.tm-title).
     * Наборы полей и формат ответа API совпадают со статьёй,
     * поэтому рендеринг переиспользует renderArticle.
     * @param {Object} statuses — ответ API новости:
     *   { id, company, action_dev, action_post, action_comment, action_industry, action_company }
     */
    static renderNews(statuses) {
        console.log('[StatusBadges.renderNews] Called with:', statuses);
        StatusBadges.renderArticle(statuses);
    }

    /**
     * Рендерит бейджи статусов поста на детальной странице поста
     * (/ru/companies/{code}/posts/{id}/) инлайн после заголовка внутри
     * .article-formatted-body (первый параграф с <strong>, либо h1.tm-title).
     * @param {Object} statuses — ответ API поста:
     *   { id, company, action_dev, action_post, action_comment, action_industry, action_company }
     */
    static renderPost(statuses) {
        console.log('[StatusBadges.renderPost] Called with:', statuses);

        if (!statuses) {
            console.log('[StatusBadges.renderPost] No statuses, skipping');
            return;
        }

        StatusBadges._removeExistingArticle();

        let title = document.querySelector('.article-formatted-body p strong');
        console.log('[StatusBadges.renderPost] Title in article-formatted-body found:', title ? 'yes' : 'no');

        if (!title) {
            title = document.querySelector('h1.tm-title') || document.querySelector('h1');
            console.log('[StatusBadges.renderPost] Fallback page title found:', title ? 'yes' : 'no');
        }

        if (!title) {
            console.warn('[StatusBadges.renderPost] Post title not found in DOM');
            return;
        }

        const container = document.createElement('span');
        container.id = StatusBadges.ARTICLE_CONTAINER_ID;
        container.className = 'habr-status-badges habr-status-badges--post-page';

        const badges = [
            { label: 'Разработка', status: statuses.action_dev },
            { label: 'Пост', status: statuses.action_post },
            { label: 'Комментарий', status: statuses.action_comment },
            { label: 'Отрасль', status: statuses.action_industry },
            { label: 'Компания', status: statuses.action_company },
        ];

        for (const { label, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, status));
        }

        if (container.childElementCount === 0) {
            console.log('[StatusBadges.renderPost] No badges to show, skipping');
            return;
        }

        title.insertAdjacentElement('afterend', container);
        console.log('[StatusBadges.renderPost] Badges inserted');
    }

    static _removeExisting() {
        const existing = document.getElementById(StatusBadges.CONTAINER_ID);
        if (existing) existing.remove();
    }

    static _removeExistingArticle() {
        const existing = document.getElementById(StatusBadges.ARTICLE_CONTAINER_ID);
        if (existing) existing.remove();
    }

    /**
     * Рендерит бейджи статусов поста рядом с его заголовком в списке постов
     * (article с атрибутом id, равным id поста, внутри .tm-articles-list).
     * @param {Element} articleElement — тег article поста
     * @param {Object} statuses — ответ API поста:
     *   { id, company, action_dev, action_post, action_comment, action_industry, action_company }
     */
    static renderPostInList(articleElement, statuses) {
        console.log('[StatusBadges.renderPostInList] Called for post:', statuses && statuses.id);

        if (!articleElement || !statuses) {
            console.log('[StatusBadges.renderPostInList] No article element or statuses, skipping');
            return;
        }

        const title = articleElement.querySelector('.tm-title')
            || articleElement.querySelector('h2')
            || articleElement.querySelector('h3');
        console.log('[StatusBadges.renderPostInList] Post title found:', title ? 'yes' : 'no');

        if (!title) {
            console.warn('[StatusBadges.renderPostInList] Post title not found in article', statuses.id);
            return;
        }

        const containerClass = 'habr-status-badges--post';
        articleElement.querySelectorAll('.' + containerClass).forEach(el => el.remove());

        const container = document.createElement('span');
        container.className = 'habr-status-badges ' + containerClass;

        const badges = [
            { label: 'Разработка', status: statuses.action_dev },
            { label: 'Пост', status: statuses.action_post },
            { label: 'Комментарий', status: statuses.action_comment },
            { label: 'Отрасль', status: statuses.action_industry },
            { label: 'Компания', status: statuses.action_company },
        ];

        for (const { label, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, status));
        }

        if (container.childElementCount === 0) {
            console.log('[StatusBadges.renderPostInList] No badges to show, skipping');
            return;
        }

        title.insertAdjacentElement('afterend', container);
        console.log('[StatusBadges.renderPostInList] Badges inserted for post:', statuses.id);
    }

    static _buildBadge(label, status) {
        const badge = document.createElement('span');
        badge.className = `habr-status-badge habr-status-badge--${StatusBadges._sanitizeCode(status.code)}`;
        badge.title = `${label}: ${status.title}`;

        const dot = document.createElement('span');
        dot.className = 'habr-status-badge__dot';

        const text = document.createElement('span');
        text.className = 'habr-status-badge__text';
        text.textContent = status.title;

        badge.appendChild(dot);
        badge.appendChild(text);
        return badge;
    }

    static _sanitizeCode(code) {
        return String(code || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
    }
}
