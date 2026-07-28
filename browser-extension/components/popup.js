import { BrowserAPI } from '../content_scripts/browserAPI.js';

class Popup {
    static initialise() {
        if (Popup._initialised)
            return;

        this._browser = new BrowserAPI();

        for (const item of document.getElementsByClassName('panel-list-item'))
            item.addEventListener('click', Popup._clickCallback);

        Popup._initialised = true;
    }

    static async _clickCallback(e) {
        const actionId = e.currentTarget.id;

        try {
            switch(actionId) {
                case 'tabs-preferences':
                    await Popup._browser.runtime.openOptionsPage();
                    break;
                default:
                    return;
            }
            window.close();
        } catch (ex) {
            console.error(`An error occured while performing action '${actionId}': ${ex.toString()}`);
        }
    }
}

Popup.initialise();