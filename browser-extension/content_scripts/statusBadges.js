/**
 * StatusBadges — отображает индикаторы статусов компании
 * (action_industry и action_company) рядом с названием компании.
 */
export class StatusBadges {
    static get CONTAINER_ID() {
        return 'habr-companies-status-badges';
    }

    /**
     * Рендерит бейджи статусов после ссылки с названием компании.
     * @param {Object} statuses — ответ API: { code, action_industry: {code, title}, action_company: {code, title} }
     */
    static render(statuses) {
        console.log('[StatusBadges.render] Called with:', statuses);

        if (!statuses) {
            console.log('[StatusBadges.render] No statuses, skipping');
            return;
        }

        StatusBadges._removeExisting();

        const nameLink = document.querySelector('.tm-company-profile-card .info a.name')
            || document.querySelector('.info a.name');
        console.log('[StatusBadges.render] Name link found:', nameLink ? 'yes' : 'no');

        if (!nameLink) {
            console.warn('[StatusBadges.render] Company name link not found in DOM');
            return;
        }

        const container = document.createElement('span');
        container.id = StatusBadges.CONTAINER_ID;
        container.className = 'habr-status-badges';

        const badges = [
            { label: 'Отрасль', status: statuses.action_industry },
            { label: 'Компания', status: statuses.action_company },
        ];

        for (const { label, status } of badges) {
            if (!status) continue;
            container.appendChild(StatusBadges._buildBadge(label, status));
        }

        if (container.childElementCount === 0) {
            console.log('[StatusBadges.render] No badges to show, skipping');
            return;
        }

        nameLink.insertAdjacentElement('afterend', container);
        console.log('[StatusBadges.render] Badges inserted');
    }

    static _removeExisting() {
        const existing = document.getElementById(StatusBadges.CONTAINER_ID);
        if (existing) existing.remove();
    }

    static _buildBadge(label, status) {
        const badge = document.createElement('span');
        badge.className = `habr-status-badge habr-status-badge--${StatusBadges._sanitizeCode(status.code)}`;
        badge.title = `${label}: ${status.title}`;

        const dot = document.createElement('span');
        dot.className = 'habr-status-badge__dot';

        const text = document.createElement('span');
        text.className = 'habr-status-badge__text';
        text.textContent = status.title;

        badge.appendChild(dot);
        badge.appendChild(text);
        return badge;
    }

    static _sanitizeCode(code) {
        return String(code || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
    }
}
