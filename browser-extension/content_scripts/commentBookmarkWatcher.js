import { CompanyApiClient } from './companyApiClient.js';
import { MessageControl } from './messageControl.js';

/**
 * CommentBookmarkWatcher - отслеживает клики на значки закладок комментариев
 * и отправляет/удаляет комментарии в REST API при изменении состояния закладки.
 */
export class CommentBookmarkWatcher {
    constructor() {
        this._apiClient = new CompanyApiClient();
        this._processedButtons = new WeakSet();
    }

    async init() {
        console.log('[CommentBookmarkWatcher] Initializing');
        document.addEventListener('click', (event) => this._handleClick(event), true);
        console.log('[CommentBookmarkWatcher] Initialized');
    }

    _handleClick(event) {
        const button = event.target.closest('.bookmarks-button');
        if (!button || !this._isCommentBookmarkButton(button)) {
            return;
        }
        if (this._processedButtons.has(button)) {
            return;
        }
        this._processedButtons.add(button);
        this._processButtonClick(button).catch(error => {
            console.error('[CommentBookmarkWatcher] Error processing button click:', error);
            MessageControl.show('шибка обработки закладки комментария', 'error');
        });
    }

    _isCommentBookmarkButton(button) {
        const commentContainer = button.closest('[data-comment-body]');
        if (!commentContainer) {
            return false;
        }
        const classes = button.classList;
        return classes.contains('bookmarks-button') && 
               classes.contains('footer-button') && 
               classes.contains('footer-button--with-icon');
    }

    async _processButtonClick(button) {
        const isActive = button.classList.contains('highlighted');
        const commentContainer = button.closest('[data-comment-body]');
        if (!commentContainer) {
            console.error('[CommentBookmarkWatcher] Could not find comment container');
            return;
        }
        const commentId = commentContainer.dataset.commentBody;
        if (!commentId) {
            console.error('[CommentBookmarkWatcher] Could not find comment ID');
            return;
        }
        const { entityCode, entityId } = this._extractEntityInfo();
        if (!entityCode || !entityId) {
            console.warn('[CommentBookmarkWatcher] Could not determine entity info');
            MessageControl.show('е удалось определить сущность комментария', 'error');
            return;
        }
        const commentText = this._extractCommentText(commentContainer);
        try {
            let response;
            if (isActive) {
                response = await this._apiClient.deleteComment(commentId);
            } else {
                const commentData = {
                    text: commentText,
                    entity_code: entityCode,
                    entity_id: entityId,
                    comment_id: parseInt(commentId, 10)
                };
                response = await this._apiClient.addComment(commentData);
            }
            if (response && response.message) {
                MessageControl.show(response.message, response.type || 'success');
            }
        } catch (error) {
            console.error('[CommentBookmarkWatcher] API call failed:', error);
            MessageControl.show('шибка синхронизации закладки комментария', 'error');
        }
    }

    _extractCommentText(commentElement) {
        const textElement = commentElement.querySelector('.comment-body, .comment-content, .message, .tm-comment__body');
        if (textElement) {
            return textElement.innerText.trim().substring(0, 500);
        }
        return '';
    }

    _extractEntityInfo() {
        try {
            const url = new URL(window.location.href);
            const pathParts = url.pathname.split('/').filter(Boolean);
            let entityCode = null;
            let entityId = null;
            const companiesIndex = pathParts.indexOf('companies');
            if (companiesIndex !== -1 && companiesIndex + 3 < pathParts.length) {
                const possibleEntityType = pathParts[companiesIndex + 2];
                const possibleId = pathParts[companiesIndex + 3];
                const validTypes = {
                    'posts': 'posts',
                    'articles': 'articles',
                    'news': 'news'
                };
                if (validTypes[possibleEntityType] && /^\d+$/.test(possibleId)) {
                    entityCode = validTypes[possibleEntityType];
                    entityId = parseInt(possibleId, 10);
                }
            }
            if (!entityCode || !entityId) {
                const ogUrlMeta = document.querySelector('meta[property='og:url']');
                if (ogUrlMeta && ogUrlMeta.content) {
                    const ogUrl = new URL(ogUrlMeta.content);
                    const ogPathParts = ogUrl.pathname.split('/').filter(Boolean);
                    const ogCompaniesIndex = ogPathParts.indexOf('companies');
                    if (ogCompaniesIndex !== -1 && ogCompaniesIndex + 3 < ogPathParts.length) {
                        const ogEntityType = ogPathParts[ogCompaniesIndex + 2];
                        const ogEntityId = ogPathParts[ogCompaniesIndex + 3];
                        const validTypes = {
                            'posts': 'posts',
                            'articles': 'articles',
                            'news': 'news'
                        };
                        if (validTypes[ogEntityType] && /^\d+$/.test(ogEntityId)) {
                            entityCode = validTypes[ogEntityType];
                            entityId = parseInt(ogEntityId, 10);
                        }
                    }
                }
            }
            return { entityCode, entityId };
        } catch (error) {
            console.error('[CommentBookmarkWatcher] Error extracting entity info:', error);
            return { entityCode: null, entityId: null };
        }
    }
}
