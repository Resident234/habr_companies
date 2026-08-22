import assert from 'assert';
import { EnvLoader } from '../tools/envLoader.js';
import {
    calculatePanelPosition,
    isCompanyPage
} from '../../content_scripts/textSelectionPanel.js';

describe('content_script/textSelectionPanel', function () {
    beforeEach('loadResources', done => {
        EnvLoader.loadDomModel().then(() => done()).catch(done);
    });

    afterEach('releaseResources', () => {
        EnvLoader.unloadDomModel();
    });

    it('allows Habr company pages', () => {
        assert.strictEqual(
            isCompanyPage('https://habr.com/ru/companies/selectel/profile/'),
            true
        );
        assert.strictEqual(
            isCompanyPage('https://habr.com/ru/companies/selectel/articles/1071066/'),
            true
        );
    });

    it('uses a small gap when placing the panel above the selection', () => {
        assert.deepStrictEqual(
            calculatePanelPosition(
                { left: 100, top: 200, bottom: 220, width: 80 },
                { width: 120, height: 30 }
            ),
            { left: 80, top: 164 }
        );
    });

    it('places the panel below the selection when there is no room above', () => {
        assert.deepStrictEqual(
            calculatePanelPosition(
                { left: 100, top: 20, bottom: 40, width: 80 },
                { width: 120, height: 30 }
            ),
            { left: 80, top: 46 }
        );
    });

    it('does not allow other Habr pages or other origins', () => {
        assert.strictEqual(isCompanyPage('https://habr.com/ru/articles/1071066/'), false);
        assert.strictEqual(isCompanyPage('https://habr.com/ru/companies'), false);
        assert.strictEqual(isCompanyPage('https://habr.com/ru/companies2/selectel/'), false);
        assert.strictEqual(
            isCompanyPage('https://example.com/ru/companies/selectel/profile/'),
            false
        );
        assert.strictEqual(
            isCompanyPage('http://habr.com/ru/companies/selectel/profile/'),
            false
        );
    });
});

console.log('[textSelectionPanelTest] URL scope checks initialized');
