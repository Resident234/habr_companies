import { CONFIG } from '../config.js';

export class CompanyExtractor {
    static extractCode() {
        console.log('[CompanyExtractor.extractCode] Entering');

        const patternUrl = new URL(CONFIG.URL_PATTERN);
        const patternParts = patternUrl.pathname.split('/').filter(Boolean);
        const pathParts = window.location.pathname.split('/').filter(Boolean);

        const wildcardIndex = patternParts.indexOf('*');
        console.log('[CompanyExtractor.extractCode] Path parts:', pathParts, '| Wildcard index in pattern:', wildcardIndex);

        if (wildcardIndex !== -1 && pathParts[wildcardIndex]) {
            const code = pathParts[wildcardIndex];
            console.log('[CompanyExtractor.extractCode] Code extracted:', code);
            return code;
        }

        console.log('[CompanyExtractor.extractCode] No code found, returning null');
        return null;
    }

    static extractTitle() {
        console.log('[CompanyExtractor.extractTitle] Querying DOM for title element');

        const nameElement = document.querySelector('.tm-company-profile-card .info a.name span');
        console.log('[CompanyExtractor.extractTitle] Element found:', nameElement ? 'yes' : 'no');

        if (nameElement) {
            const title = nameElement.innerText.trim();
            console.log('[CompanyExtractor.extractTitle] Title extracted:', title);
            return title;
        }

        console.log('[CompanyExtractor.extractTitle] Title not found, returning null');
        return null;
    }
}
