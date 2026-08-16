import assert from 'assert';
import { EnvLoader } from '../tools/envLoader.js';
import { MessageControl } from '../../content_scripts/messageControl.js';

describe('content_script/messageControl', function () {
    this.timeout(0);

    const flushPromises = () => Promise.resolve().then(() => Promise.resolve());

    beforeEach('loadResources', done => {
        MessageControl.__storage = {
            get: () => Promise.resolve({ message_display_duration: 120000 }),
        };
        EnvLoader.loadDomModel().then(() => done()).catch(done);
    });

    afterEach('releaseResources', () => {
        clearTimeout(MessageControl._dismissTimer);
        MessageControl._dismissTimer = null;
        MessageControl.__storage = null;
        EnvLoader.unloadDomModel();
    });

    const getMessageControl = (shouldBePresent = true) => {
        const msgEl = document.getElementById(MessageControl.BAR_ID);
        assert.strictEqual(msgEl === null, !shouldBePresent);
        return msgEl;
    };

    describe('#show', function () {
        it('should render a message control in DOM', async () => {
            const expectedMessage = 'Company successfully added';
            MessageControl.show(expectedMessage, 'success');
            await flushPromises();

            const msgEl = getMessageControl();
            assert.strictEqual(msgEl.className,
                'habr-companies-bar habr-companies-bar--success');
            assert.strictEqual(msgEl.textContent, expectedMessage);
        });

        it('should keep the message control when the body contents change', async () => {
            const expectedMessage = 'Company successfully added';
            MessageControl.show(expectedMessage, 'success');
            await flushPromises();

            document.body.innerHTML = '<div>updated page content</div>';

            const msgEl = getMessageControl();
            assert.strictEqual(msgEl.textContent, expectedMessage);
            assert.strictEqual(msgEl.parentElement, document.documentElement);
        });

        it('should replace the previous message when showing a new one', async () => {
            MessageControl.show('Initial message', 'info');
            await flushPromises();

            MessageControl.show('Updated message', 'error');
            await flushPromises();

            const msgEl = getMessageControl();
            assert.strictEqual(msgEl.textContent, 'Updated message');
            assert.strictEqual(msgEl.className,
                'habr-companies-bar habr-companies-bar--error');
            assert.strictEqual(document.querySelectorAll(`#${MessageControl.BAR_ID}`).length, 1);
        });

        it('should ignore an empty message', () => {
            MessageControl.show('');
            assert.strictEqual(getMessageControl(false), null);
        });
    });

    describe('#hide', function () {
        it('should do nothing if there is no message element rendered', () => {
            MessageControl.hide();
            assert.strictEqual(getMessageControl(false), null);
        });

        it('should add the hidden class to an existent message element', async () => {
            const expectedMessage = 'Company successfully added';
            MessageControl.show(expectedMessage, 'success');
            await flushPromises();

            MessageControl.hide();

            const msgEl = getMessageControl();
            assert.strictEqual(msgEl.textContent, expectedMessage);
            assert(msgEl.classList.contains('habr-companies-bar--hidden'));
        });

        it('should be idempotent when hiding an already hidden message', async () => {
            MessageControl.show('Company successfully added', 'success');
            await flushPromises();

            MessageControl.hide();
            MessageControl.hide();

            const msgEl = getMessageControl();
            assert.strictEqual(
                msgEl.classList.contains('habr-companies-bar--hidden'),
                true
            );
        });
    });

    describe('#_getDuration', function () {
        it('should read the message duration from preferences in milliseconds', async () => {
            MessageControl.__storage = {
                get: () => Promise.resolve({ message_display_duration: 45000 }),
            };

            assert.strictEqual(await MessageControl._getDuration(), 45000);
        });

        it('should use the configured default for an invalid preference', async () => {
            MessageControl.__storage = {
                get: () => Promise.resolve({ message_display_duration: 0 }),
            };

            assert.strictEqual(await MessageControl._getDuration(), 120000);
        });
    });
});
