import { CONFIG } from '../config.js';

export class CompanyExtractor {
    static extractCode() {
        const patternUrl = new URL(CONFIG.URL_PATTERN);
        const patternParts = patternUrl.pathname.split('/').filter(Boolean);
        const segment = patternParts[patternParts.length - 1];

        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const segmentIndex = pathParts.indexOf(segment);
        if (segmentIndex !== -1 && pathParts[segmentIndex + 1]) {
            return pathParts[segmentIndex + 1];
        }
        return null;
    }

    static extractTitle() {
        const nameElement = document.querySelector('.tm-company-profile-card .info a.name span');
        return nameElement ? nameElement.innerText.trim() : null;
    }
}
