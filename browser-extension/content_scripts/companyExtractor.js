import { CONFIG } from '../config.js';

export class CompanyExtractor {
    static extractCode() {
        console.log('[CompanyExtractor.extractCode] Entering');

        const patternUrl = new URL(CONFIG.URL_PATTERN);
        const patternParts = patternUrl.pathname.split('/').filter(Boolean);
        const segment = patternParts[patternParts.length - 1];

        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const segmentIndex = pathParts.indexOf(segment);
        console.log('[CompanyExtractor.extractCode] Path parts:', pathParts, '| Looking for segment:', segment, '| Found at index:', segmentIndex);

        if (segmentIndex !== -1 && pathParts[segmentIndex + 1]) {
            const code = pathParts[segmentIndex + 1];
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
