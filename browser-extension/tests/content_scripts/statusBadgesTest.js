import assert from 'assert';
import { EnvLoader } from '../tools/envLoader.js';
import { StatusBadges } from '../../content_scripts/statusBadges.js';

describe('content_script/statusBadges', function () {
    this.timeout(0);

    beforeEach('loadResources', done => {
        EnvLoader.loadDomModel().then(() => done()).catch(done);
    });

    afterEach('releaseResources', () => {
        EnvLoader.unloadDomModel();
    });

    const buildArticleStatuses = () => ({
        id: 1067190,
        company: 'wirenboard',
        action_dev: { code: 'in_progress', title: 'В работе' },
        action_post: { code: 'done', title: 'Завершено' },
        action_comment: { code: 'backlog', title: 'В бэклоге' },
        action_industry: { code: 'unprocessed', title: 'Не обработано' },
        action_company: { code: 'rejected', title: 'Отклонено' },
    });

    const addArticleTitle = () => {
        const h1 = document.createElement('h1');
        h1.className = 'tm-title tm-title_h1';
        const span = document.createElement('span');
        span.textContent = 'Тестовая статья';
        h1.appendChild(span);
        document.body.appendChild(h1);
        return h1;
    };

    const getArticleContainer = () => document.getElementById(StatusBadges.ARTICLE_CONTAINER_ID);

    describe('#renderArticle', function () {
        it('should render 5 badges after the article title with titles from statuses', () => {
            const h1 = addArticleTitle();
            StatusBadges.renderArticle(buildArticleStatuses());

            const container = getArticleContainer();
            assert(container, 'container must exist');
            assert.strictEqual(h1.nextElementSibling, container);

            const badges = container.querySelectorAll('.habr-status-badge');
            assert.strictEqual(badges.length, 5);

            const texts = [...container.querySelectorAll('.habr-status-badge__text')]
                .map(el => el.textContent);
            assert.deepStrictEqual(texts,
                ['В работе', 'Завершено', 'В бэклоге', 'Не обработано', 'Отклонено']);

            const classes = [...badges].map(b => b.className);
            assert(classes.some(c => c.includes('habr-status-badge--in_progress')));
            assert(classes.some(c => c.includes('habr-status-badge--done')));
            assert(classes.some(c => c.includes('habr-status-badge--backlog')));
            assert(classes.some(c => c.includes('habr-status-badge--unprocessed')));
            assert(classes.some(c => c.includes('habr-status-badge--rejected')));

            const titles = [...badges].map(b => b.title);
            assert(titles.some(t => t === 'Разработка: В работе'));
            assert(titles.some(t => t === 'Компания: Отклонено'));
        });

        it('should do nothing when statuses are null', () => {
            addArticleTitle();
            StatusBadges.renderArticle(null);
            assert.strictEqual(getArticleContainer(), null);
        });

        it('should do nothing when the article title is missing', () => {
            StatusBadges.renderArticle(buildArticleStatuses());
            assert.strictEqual(getArticleContainer(), null);
        });

        it('should replace previously rendered badges on re-render', () => {
            addArticleTitle();
            StatusBadges.renderArticle(buildArticleStatuses());
            StatusBadges.renderArticle(buildArticleStatuses());

            const containers = document.querySelectorAll('#' + StatusBadges.ARTICLE_CONTAINER_ID);
            assert.strictEqual(containers.length, 1);
        });
    });

    describe('#renderNews', function () {
        const buildNewsStatuses = () => ({
            id: 1067864,
            company: 'infostart',
            action_dev: { code: 'in_progress', title: 'В работе' },
            action_post: { code: 'done', title: 'Завершено' },
            action_comment: { code: 'backlog', title: 'В бэклоге' },
            action_industry: { code: 'unprocessed', title: 'Не обработано' },
            action_company: { code: 'rejected', title: 'Отклонено' },
        });

        it('should render 5 badges after the news title with titles from statuses', () => {
            const h1 = addArticleTitle();
            StatusBadges.renderNews(buildNewsStatuses());

            const container = getArticleContainer();
            assert(container, 'container must exist');
            assert.strictEqual(h1.nextElementSibling, container);

            const badges = container.querySelectorAll('.habr-status-badge');
            assert.strictEqual(badges.length, 5);

            const texts = [...container.querySelectorAll('.habr-status-badge__text')]
                .map(el => el.textContent);
            assert.deepStrictEqual(texts,
                ['В работе', 'Завершено', 'В бэклоге', 'Не обработано', 'Отклонено']);

            const titles = [...badges].map(b => b.title);
            assert(titles.some(t => t === 'Разработка: В работе'));
            assert(titles.some(t => t === 'Пост: Завершено'));
            assert(titles.some(t => t === 'Комментарий: В бэклоге'));
            assert(titles.some(t => t === 'Отрасль: Не обработано'));
            assert(titles.some(t => t === 'Компания: Отклонено'));
        });

        it('should do nothing when statuses are null', () => {
            addArticleTitle();
            StatusBadges.renderNews(null);
            assert.strictEqual(getArticleContainer(), null);
        });

        it('should do nothing when the news title is missing', () => {
            StatusBadges.renderNews(buildNewsStatuses());
            assert.strictEqual(getArticleContainer(), null);
        });

        it('should replace previously rendered badges on re-render', () => {
            addArticleTitle();
            StatusBadges.renderNews(buildNewsStatuses());
            StatusBadges.renderNews(buildNewsStatuses());

            const containers = document.querySelectorAll('#' + StatusBadges.ARTICLE_CONTAINER_ID);
            assert.strictEqual(containers.length, 1);
        });
    });

    describe('#renderPostInList', function () {
        const addPostArticle = (id) => {
            const list = document.createElement('div');
            list.className = 'tm-articles-list';

            const article = document.createElement('article');
            article.id = String(id);

            const h2 = document.createElement('h2');
            h2.className = 'tm-title tm-title_h2';
            const span = document.createElement('span');
            span.textContent = 'Тестовый пост ' + id;
            h2.appendChild(span);

            article.appendChild(h2);
            list.appendChild(article);
            document.body.appendChild(list);
            return article;
        };

        it('should render 5 badges after the post title in the articles list', () => {
            const article = addPostArticle(1044134);
            StatusBadges.renderPostInList(article, buildArticleStatuses());

            const container = article.querySelector('.habr-status-badges--post');
            assert(container, 'container must exist');

            const badges = container.querySelectorAll('.habr-status-badge');
            assert.strictEqual(badges.length, 5);

            const texts = [...container.querySelectorAll('.habr-status-badge__text')]
                .map(el => el.textContent);
            assert.deepStrictEqual(texts,
                ['В работе', 'Завершено', 'В бэклоге', 'Не обработано', 'Отклонено']);

            const titles = [...badges].map(b => b.title);
            assert(titles.some(t => t === 'Разработка: В работе'));
            assert(titles.some(t => t === 'Пост: Завершено'));
            assert(titles.some(t => t === 'Комментарий: В бэклоге'));
            assert(titles.some(t => t === 'Отрасль: Не обработано'));
            assert(titles.some(t => t === 'Компания: Отклонено'));
        });

        it('should do nothing when statuses are null', () => {
            const article = addPostArticle(1044134);
            StatusBadges.renderPostInList(article, null);
            assert.strictEqual(article.querySelector('.habr-status-badges--post'), null);
        });

        it('should render badges for several posts independently', () => {
            const first = addPostArticle(1);
            const second = addPostArticle(2);

            StatusBadges.renderPostInList(first, buildArticleStatuses());
            StatusBadges.renderPostInList(second, buildArticleStatuses());

            assert.strictEqual(document.querySelectorAll('.habr-status-badges--post').length, 2);
            assert(first.querySelector('.habr-status-badges--post'));
            assert(second.querySelector('.habr-status-badges--post'));
        });

        it('should replace previously rendered badges on re-render', () => {
            const article = addPostArticle(1044134);
            StatusBadges.renderPostInList(article, buildArticleStatuses());
            StatusBadges.renderPostInList(article, buildArticleStatuses());

            assert.strictEqual(article.querySelectorAll('.habr-status-badges--post').length, 1);
        });
    });
});