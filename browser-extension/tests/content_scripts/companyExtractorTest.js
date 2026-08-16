import assert from 'assert';
import { CompanyExtractor } from '../../content_scripts/companyExtractor.js';
import { EnvLoader } from '../tools/envLoader.js';

describe('content_scripts/companyExtractor', function () {
    beforeEach('loadResources', done => {
        EnvLoader.loadDomModel().then(() => done()).catch(done);
    });
    afterEach('releaseResources', () => {
        EnvLoader.unloadDomModel();
    });

    it('extracts the company title from the profile card', () => {
        document.body.innerHTML = `
            <div class="tm-company-profile-card">
                <div class="info"><a class="name"><span>SimpleOne</span></a></div>
            </div>`;

        assert.strictEqual(CompanyExtractor.extractTitle(), 'SimpleOne');
    });

    it('extracts the company title from the expired blog message', () => {
        document.body.innerHTML = `
            <div class="tm-expired-company">
                <p class="tm-expired-company__text">Компания SimpleOne временно не ведёт блог на Хабре</p>
            </div>`;

        assert.strictEqual(CompanyExtractor.extractTitle(), 'SimpleOne');
    });

    it('normalizes whitespace in the expired blog message', () => {
        document.body.innerHTML = `
            <p class="tm-expired-company__text">
                Компания&nbsp;SimpleOne&nbsp;временно не ведёт блог на Хабре
            </p>`;

        assert.strictEqual(CompanyExtractor.extractTitle(), 'SimpleOne');
    });

    it('returns null when no supported company title is present', () => {
        document.body.innerHTML = '<p>Компания пока ведёт блог на Хабре</p>';

        assert.strictEqual(CompanyExtractor.extractTitle(), null);
    });
});
