import assert from 'assert';
import { CommentBookmarkWatcher } from '../../content_scripts/commentBookmarkWatcher.js';
import { EnvLoader } from '../tools/envLoader.js';

describe('content_script/CommentBookmarkWatcher', () => {
    let watcher;

    beforeEach('loadResources', done => {
        EnvLoader.loadDomModel().then(() => {
            document.body.innerHTML = '';
            watcher = Object.create(CommentBookmarkWatcher.prototype);
            done();
        }).catch(done);
    });

    afterEach('releaseResources', () => {
        EnvLoader.unloadDomModel();
    });

    it('extracts the article title from h1.tm-title', () => {
        const title = document.createElement('h1');
        title.className = 'tm-title';
        title.innerText = 'Как появилась Луна, и что из этого вышло';
        document.body.appendChild(title);

        assert.strictEqual(watcher._extractArticleTitle(), 'Как появилась Луна, и что из этого вышло');
    });

    it('throws a handled error when the article title is missing', () => {
        assert.throws(
            () => watcher._extractArticleTitle(),
            error => error.code === 'ARTICLE_TITLE_EXTRACTION_FAILED'
                && error.message === 'Не удалось определить заголовок статьи на странице Habr'
        );
    });

    it('uses the first h1 as a fallback title', () => {
        const title = document.createElement('h1');
        title.innerText = 'Резервный заголовок';
        document.body.appendChild(title);

        assert.strictEqual(watcher._extractArticleTitle(), 'Резервный заголовок');
    });
});



describe('CommentBookmarkWatcher comment text extraction', () => {
    let watcher;

    beforeEach('loadResources', done => {
        EnvLoader.loadDomModel().then(() => {
            document.body.innerHTML = '';
            watcher = Object.create(CommentBookmarkWatcher.prototype);
            done();
        }).catch(done);
    });

    afterEach('releaseResources', () => {
        EnvLoader.unloadDomModel();
    });

    it('extracts text from the AJAX-rendered tm-comment__body-content container', async () => {
        const comment = document.createElement('div');
        const body = document.createElement('div');
        body.className = 'tm-comment__body-content';
        body.textContent = 'Комментарий, загруженный динамически';
        comment.appendChild(body);

        assert.strictEqual(
            await watcher._extractCommentText(comment),
            'Комментарий, загруженный динамически'
        );
    });

    it('returns an empty string when the comment body is not available', async () => {
        const comment = document.createElement('div');

        assert.strictEqual(await watcher._extractCommentText(comment), '');
    });
});
