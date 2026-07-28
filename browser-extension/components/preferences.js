import { BrowserAPI } from '../content_scripts/browserAPI.js';
import { BrowserStorage } from '../content_scripts/browserStorage.js';
import { CONFIG } from '../config.js';

export class Preferences {
    constructor() {
        this._storage = new BrowserStorage('preferences');
        this._baseUrlInput = document.getElementById('form--section-api--txt-url');
        
        if (this._baseUrlInput) {
            this._baseUrlInput.oninput = () => this._makeDirty();
        }
    }

    async load() {
        const data = await this._storage.get();
        this._data = data || { base_url: CONFIG.DEFAULT_BASE_URL };
        
        if (this._baseUrlInput) {
            this._baseUrlInput.value = this._data.base_url || CONFIG.DEFAULT_BASE_URL;
        }
        
        return this._data;
    }

    async save() {
        if (this._baseUrlInput) {
            this._data.base_url = this._baseUrlInput.value;
        }
        await this._storage.set(this._data);
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