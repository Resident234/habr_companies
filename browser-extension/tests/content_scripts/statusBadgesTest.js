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
});