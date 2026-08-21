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
});
