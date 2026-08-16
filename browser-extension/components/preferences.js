import { BrowserStorage } from '../content_scripts/browserStorage.js';
import { CONFIG } from '../config.js';

export class Preferences {
    constructor() {
        this._storage = new BrowserStorage('preferences');
        this._baseUrlInput = document.getElementById('form--section-api--txt-url');
        this._messageDurationInput = document.getElementById('form--section-messages--num-duration');

        if (this._baseUrlInput) {
            this._baseUrlInput.oninput = () => this._makeDirty();
        }

        if (this._messageDurationInput) {
            this._messageDurationInput.oninput = () => this._makeDirty();
        }
    }

    async load() {
        const data = await this._storage.get();
        this._data = data || {
            base_url: CONFIG.DEFAULT_BASE_URL,
            message_display_duration: CONFIG.MESSAGE_DISPLAY_DURATION
        };

        if (this._baseUrlInput) {
            this._baseUrlInput.value = this._data.base_url || CONFIG.DEFAULT_BASE_URL;
        }

        if (this._messageDurationInput) {
            const durationSeconds = Math.floor(
                (this._data.message_display_duration || CONFIG.MESSAGE_DISPLAY_DURATION) / 1000);
            this._messageDurationInput.value = durationSeconds;
        }

        return this._data;
    }

    async save() {
        if (this._baseUrlInput) {
            this._data.base_url = this._baseUrlInput.value;
        }

        if (this._messageDurationInput) {
            this._data.message_display_duration =
                this._parseDurationSeconds(this._messageDurationInput.value);
        }
        await this._storage.set(this._data);
    }

    _parseDurationSeconds(raw) {
        const seconds = Number(raw);
        const valid = Number.isFinite(seconds) && seconds > 0;
        return valid ? Math.floor(seconds * 1000) : CONFIG.MESSAGE_DISPLAY_DURATION;
    }

    _makeDirty() {
        const submitBtn = document.getElementById('form--btn-submit');
        if (submitBtn) submitBtn.disabled = false;
    }

    static async loadFromStorage() {
        const storage = new BrowserStorage('preferences');
        return await storage.get();
    }
}
