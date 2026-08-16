import { BrowserStorage } from './browserStorage.js';
import { CONFIG } from '../config.js';

export class MessageControl {
    static get BAR_ID() {
        return 'habr-companies-bar';
    }

    static get _storage() {
        if (!MessageControl.__storage) {
            MessageControl.__storage = new BrowserStorage('preferences');
        }
        return MessageControl.__storage;
    }

    static show(text, type = 'info') {
        if (!text) return;

        const existing = MessageControl._existentBar;
        if (existing) {
            existing.remove();
            clearTimeout(MessageControl._dismissTimer);
        }

        const bar = MessageControl._buildBar(text, type);
        document.documentElement.append(bar);

        MessageControl._getDuration().then(duration => {
            MessageControl._dismissTimer = setTimeout(
                () => MessageControl.hide(),
                duration
            );
        }).catch(() => {
            MessageControl._dismissTimer = setTimeout(
                () => MessageControl.hide(),
                CONFIG.MESSAGE_DISPLAY_DURATION
            );
        });
    }

    static async _getDuration() {
        const data = await MessageControl._storage.get();
        const stored = data && Number(data.message_display_duration);
        const valid = Number.isFinite(stored) && stored > 0;
        return valid ? stored : CONFIG.MESSAGE_DISPLAY_DURATION;
    }

    static hide() {
        const bar = MessageControl._existentBar;
        if (!bar) return;

        bar.classList.add('habr-companies-bar--hidden');
        bar.addEventListener('transitionend', () => bar.remove(), { once: true });
    }

    static get _existentBar() {
        return document.getElementById(MessageControl.BAR_ID);
    }

    static _buildBar(text, type) {
        const bar = document.createElement('div');
        bar.id = MessageControl.BAR_ID;
        bar.className = `habr-companies-bar habr-companies-bar--${type}`;
        bar.textContent = text;
        return bar;
    }
}
