/**
 * StatusBadges — отображает индикаторы статусов с кнопками переключения:
 *  - компании (action_industry, action_company) рядом с названием компании;
 *  - статьи и новости (action_dev, action_post, action_comment, action_industry,
 *    action_company) рядом с заголовком страницы;
 *  - посты на детальной странице и в списке постов.
 *
 * Каждый бейдж содержит data-атрибуты (entity, field, company, id) и кнопки
 * «◀ Назад» / «Вперёд ▶», сдвигающие статус по фиксированному порядку
 * через PATCH-эндпоинты REST API.
 *
 * CompanyApiClient импортируется лениво внутри _onNavClick / _refreshStatuses,
 * чтобы избежать циклической зависимости (statusBadges.js ↔ companyApiClient.js).
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

        const ctx = { entity: 'company', company: statuses.code, id: null };
        const badges = [
            { label: 'Отрасль', field: 'action_industry', status: statuses.action_industry },
            { label: 'Компания', field: 'action_company', status: statuses.action_company },
        ];

        for (const { label, field, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, field, status, ctx));
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

        StatusBadges._renderArticleLike(statuses, 'article');
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

        if (!statuses) {
            console.log('[StatusBadges.renderNews] No statuses, skipping');
            return;
        }

        StatusBadges._renderArticleLike(statuses, 'news');
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

        const ctx = { entity: 'post', company: statuses.company, id: statuses.id };
        const badges = [
            { label: 'Разработка', field: 'action_dev', status: statuses.action_dev },
            { label: 'Пост', field: 'action_post', status: statuses.action_post },
            { label: 'Комментарий', field: 'action_comment', status: statuses.action_comment },
            { label: 'Отрасль', field: 'action_industry', status: statuses.action_industry },
            { label: 'Компания', field: 'action_company', status: statuses.action_company },
        ];

        for (const { label, field, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, field, status, ctx));
        }

        if (container.childElementCount === 0) {
            console.log('[StatusBadges.renderPost] No badges to show, skipping');
            return;
        }

        title.insertAdjacentElement('afterend', container);
        console.log('[StatusBadges.renderPost] Badges inserted');
    }

    /**
     * Общая логика renderArticle/renderNews: отличается только entity.
     */
    static _renderArticleLike(statuses, entity) {
        if (!statuses) {
            console.log('[StatusBadges._renderArticleLike] No statuses, skipping');
            return;
        }

        StatusBadges._removeExistingArticle();

        const title = document.querySelector('h1.tm-title') || document.querySelector('h1');
        if (!title) {
            console.warn('[StatusBadges._renderArticleLike] Title not found in DOM');
            return;
        }

        const container = document.createElement('span');
        container.id = StatusBadges.ARTICLE_CONTAINER_ID;
        container.className = 'habr-status-badges habr-status-badges--article';

        const ctx = { entity: entity, company: statuses.company, id: statuses.id };
        const badges = [
            { label: 'Разработка', field: 'action_dev', status: statuses.action_dev },
            { label: 'Пост', field: 'action_post', status: statuses.action_post },
            { label: 'Комментарий', field: 'action_comment', status: statuses.action_comment },
            { label: 'Отрасль', field: 'action_industry', status: statuses.action_industry },
            { label: 'Компания', field: 'action_company', status: statuses.action_company },
        ];

        for (const { label, field, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, field, status, ctx));
        }

        if (container.childElementCount === 0) {
            console.log('[StatusBadges._renderArticleLike] No badges to show, skipping');
            return;
        }

        title.insertAdjacentElement('afterend', container);
        console.log('[StatusBadges._renderArticleLike] Badges inserted, entity:', entity);
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

        const ctx = { entity: 'post', company: statuses.company, id: statuses.id };
        const badges = [
            { label: 'Разработка', field: 'action_dev', status: statuses.action_dev },
            { label: 'Пост', field: 'action_post', status: statuses.action_post },
            { label: 'Комментарий', field: 'action_comment', status: statuses.action_comment },
            { label: 'Отрасль', field: 'action_industry', status: statuses.action_industry },
            { label: 'Компания', field: 'action_company', status: statuses.action_company },
        ];

        for (const { label, field, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, field, status, ctx));
        }

        if (container.childElementCount === 0) {
            console.log('[StatusBadges.renderPostInList] No badges to show, skipping');
            return;
        }

        title.insertAdjacentElement('afterend', container);
        console.log('[StatusBadges.renderPostInList] Badges inserted for post:', statuses.id);
    }

    /**
     * Строит бейдж с кнопками «Назад»/«Вперёд».
     * @param {string} label  — «Разработка», «Пост», …
     * @param {string} field  — action_dev, action_post, …
     * @param {Object} status — { code, title }
     * @param {Object} ctx    — { entity, company, id }
     */
    static _buildBadge(label, field, status, ctx) {
        const badge = document.createElement('span');
        badge.className = `habr-status-badge habr-status-badge--${StatusBadges._sanitizeCode(status.code)}`;
        badge.title = `${label}: ${status.title}`;
        badge.dataset.field = field;
        badge.dataset.entity = ctx.entity;
        if (ctx.company != null) badge.dataset.company = ctx.company;
        if (ctx.id != null) badge.dataset.id = String(ctx.id);

        const backBtn = StatusBadges._buildNavButton('back', 'Назад');
        const dot = document.createElement('span');
        dot.className = 'habr-status-badge__dot';
        const text = document.createElement('span');
        text.className = 'habr-status-badge__text';
        text.textContent = status.title;
        const fwdBtn = StatusBadges._buildNavButton('fwd', 'Вперёд');

        badge.appendChild(backBtn);
        badge.appendChild(dot);
        badge.appendChild(text);
        badge.appendChild(fwdBtn);
        return badge;
    }

    static _buildNavButton(direction, tooltip) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'habr-status-badge__nav habr-status-badge__nav--' + direction;
        btn.textContent = direction === 'back' ? '◀' : '▶';
        btn.title = tooltip;
        btn.dataset.direction = direction;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            StatusBadges._onNavClick(btn);
        });
        return btn;
    }

    /**
     * Обработчик клика по кнопке «Назад»/«Вперёд».
     */
    static async _onNavClick(btn) {
        const badge = btn.closest('.habr-status-badge');
        if (!badge) return;

        const field = badge.dataset.field;
        const entity = badge.dataset.entity;
        const company = badge.dataset.company;
        const id = badge.dataset.id != null ? parseInt(badge.dataset.id, 10) : null;
        const direction = btn.dataset.direction;

        console.log('[StatusBadges._onNavClick]', entity, field, direction, 'company=', company, 'id=', id);

        const buttons = badge.querySelectorAll('.habr-status-badge__nav');
        buttons.forEach(b => { b.disabled = true; });

        try {
            const { CompanyApiClient } = await import('./companyApiClient.js');
            const client = new CompanyApiClient();
            let result = null;

            if (entity === 'company') {
                result = await client.updateCompanyStatus(company, field, direction);
            } else if (entity === 'article') {
                result = await client.updateArticleStatus(company, id, field, direction);
            } else if (entity === 'news') {
                result = await client.updateNewsStatus(company, id, field, direction);
            } else if (entity === 'post') {
                result = await client.updatePostStatus(company, id, field, direction);
            }

            console.log('[StatusBadges._onNavClick] Result:', result);

            if (result && !result.error && result.to) {
                StatusBadges._applyStatus(badge, result.to);
            } else if (result && result.error && result.status === 409) {
                console.warn('[StatusBadges._onNavClick] Conflict, refreshing statuses');
                await StatusBadges._refreshStatuses(badge);
            } else {
                console.warn('[StatusBadges._onNavClick] Update failed', result);
            }
        } catch (err) {
            console.error('[StatusBadges._onNavClick] Error:', err);
        } finally {
            buttons.forEach(b => { b.disabled = false; });
        }
    }

    /**
     * Применяет новый статус к бейджу: обновляет CSS-класс, текст и title.
     * @param {Element} badge — элемент .habr-status-badge
     * @param {Object} to     — { code, title }
     */
    static _applyStatus(badge, to) {
        if (!to || !to.code) return;

        // Снимаем предыдущий статусный класс
        const oldClasses = [...badge.classList]
            .filter(c => c.startsWith('habr-status-badge--') && c !== 'habr-status-badge');
        oldClasses.forEach(c => badge.classList.remove(c));

        badge.classList.add('habr-status-badge--' + StatusBadges._sanitizeCode(to.code));

        const text = badge.querySelector('.habr-status-badge__text');
        if (text) text.textContent = to.title;

        const label = badge.title.split(':')[0];
        badge.title = `${label}: ${to.title}`;
    }

    /**
     * При конфликте (409) перезапрашивает актуальные статусы и обновляет бейдж.
     */
    static async _refreshStatuses(badge) {
        const entity = badge.dataset.entity;
        const company = badge.dataset.company;
        const id = badge.dataset.id != null ? parseInt(badge.dataset.id, 10) : null;
        const field = badge.dataset.field;

        try {
            const { CompanyApiClient } = await import('./companyApiClient.js');
            const client = new CompanyApiClient();
            let statuses = null;

            if (entity === 'company') {
                statuses = await client.getStatuses(company);
            } else if (entity === 'article') {
                statuses = await client.getArticleStatuses(company, id);
            } else if (entity === 'news') {
                statuses = await client.getNewsStatuses(company, id);
            } else if (entity === 'post') {
                const response = await client.getPostsStatuses(company, [id]);
                if (response && Array.isArray(response.posts)) {
                    statuses = response.posts.find(p => Number(p.id) === Number(id));
                }
            }

            if (statuses && statuses[field]) {
                StatusBadges._applyStatus(badge, statuses[field]);
            }
        } catch (err) {
            console.error('[StatusBadges._refreshStatuses] Error:', err);
        }
    }

    static _sanitizeCode(code) {
        return String(code || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
    }
}
