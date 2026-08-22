import assert from 'assert';
import { CompanyApiClient } from '../../content_scripts/companyApiClient.js';

describe('content_script/CompanyApiClient', () => {
    let requests;

    beforeEach(() => {
        requests = [];
        delete globalThis.browser;
        globalThis.chrome = {
            runtime: {
                sendMessage: async (request) => {
                    requests.push(request);
                    return { ok: true, status: 201, body: '{}' };
                }
            },
            storage: {
                local: {
                    get: async () => ({})
                }
            }
        };
    });

    it('sends company creation through the background runtime handler', async () => {
        const client = new CompanyApiClient();
        const result = await client.sendCompany('yandex', 'Яндекс & Co');

        assert.strictEqual(result.type, 'success');
        assert.strictEqual(requests.length, 1);
        assert.strictEqual(requests[0].type, 'FETCH_REQUEST');
        assert.strictEqual(requests[0].method, 'POST');
        assert.match(requests[0].url, /\/company\/add\/yandex\//);
        assert.ok(requests[0].url.includes(encodeURIComponent('Яндекс & Co')));
        assert.strictEqual(requests[0].headers['X-API-Key'].length, 64);
        assert.strictEqual(requests[0].headers['ngrok-skip-browser-warning'], 'true');
    });

    it('passes request bodies to the background handler', async () => {
        const client = new CompanyApiClient();
        await client.addComment({ text: 'test', entity_code: 'posts', entity_id: 1, comment_id: 2 });

        assert.strictEqual(requests.length, 1);
        assert.strictEqual(requests[0].method, 'POST');
        assert.strictEqual(requests[0].body, JSON.stringify({ text: 'test', entity_code: 'posts', entity_id: 1, comment_id: 2 }));
    });

    it('shows the comment ID and newly created article details on success', async () => {
        globalThis.chrome.runtime.sendMessage = async (request) => {
            requests.push(request);
            return {
                ok: true,
                status: 201,
                body: JSON.stringify({
                    comment_id: 29901582,
                    article: {
                        id: 663790,
                        title: 'Как появилась Луна, и что из этого вышло',
                        company: 'timeweb',
                        created: true
                    }
                })
            };
        };

        const client = new CompanyApiClient();
        const result = await client.addComment({
            text: 'Комментарий',
            entity_code: 'articles',
            entity_id: 663790,
            comment_id: 29901582,
            company_code: 'timeweb',
            article_title: 'Как появилась Луна, и что из этого вышло'
        });

        assert.strictEqual(result.type, 'success');
        assert.match(result.message, /Комментарий добавлен успешно: id\[29901582\]/);
        assert.match(result.message, /Статья добавлена в БД: id\[663790\]/);
        assert.match(result.message, /title\[Как появилась Луна, и что из этого вышло\]/);
        assert.match(result.message, /company\[timeweb\]/);
    });

    it('includes the REST validation reason when comment creation is rejected', async () => {
        globalThis.chrome.runtime.sendMessage = async (request) => {
            requests.push(request);
            return {
                ok: false,
                status: 400,
                body: JSON.stringify({ error: 'article_title is required for article comments' })
            };
        };

        const client = new CompanyApiClient();
        const result = await client.addComment({
            text: 'test',
            entity_code: 'articles',
            entity_id: 663790,
            comment_id: 2
        });

        assert.strictEqual(result.type, 'error');
        assert.match(result.message, /status\[400\]/);
        assert.match(result.message, /article_title is required for article comments/);
    });
});
