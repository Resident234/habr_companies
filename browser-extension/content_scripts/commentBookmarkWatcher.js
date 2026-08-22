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
		try {
            let response;
            if (isActive) {
                response = await this._apiClient.deleteComment(commentId);
			} else {
					const commentText = await this._extractCommentText(commentContainer);
					if (!commentText) {
						const error = new Error('Не удалось определить текст комментария на странице Habr');
						error.code = 'COMMENT_TEXT_EXTRACTION_FAILED';
						throw error;
					}
					const articleTitle = entityCode === 'articles' ? this._extractArticleTitle() : null;
					const companyCode = entityCode === 'articles' ? this._extractCompanyCode() : null;
					const commentData = {
					text: commentText,
					entity_code: entityCode,
					entity_id: entityId,
					comment_id: parseInt(commentId, 10)
				};
				if (entityCode === 'articles') {
					if (!companyCode || !articleTitle) {
						MessageControl.show('Не удалось определить компанию или заголовок статьи', 'error');
						return;
					}
					commentData.company_code = companyCode;
					commentData.article_title = articleTitle;
				}
                response = await this._apiClient.addComment(commentData);
            }
            if (response && response.message) {
                MessageControl.show(response.message, response.type || 'success');
            }
		} catch (error) {
			if (error.code === 'ARTICLE_TITLE_EXTRACTION_FAILED') {
				console.error('[CommentBookmarkWatcher] Article title extraction failed:', error);
				MessageControl.show(error.message, 'error');
				return;
			}
			if (error.code === 'COMMENT_TEXT_EXTRACTION_FAILED') {
				console.error('[CommentBookmarkWatcher] Comment text extraction failed:', error);
				MessageControl.show(error.message, 'error');
				return;
			}
			console.error('[CommentBookmarkWatcher] API call failed:', error);
			MessageControl.show('Ошибка синхронизации закладки комментария', 'error');
		}
    }

	async _extractCommentText(commentElement) {
		const selectors = [
			'.tm-comment__body-content',
			'.tm-comment__body-content_v2',
			'.comment-body',
			'.comment-content',
			'.message',
			'.tm-comment__body'
		];
		const attempts = 20;
		const delayMs = 50;

		for (let attempt = 0; attempt < attempts; attempt++) {
			for (const selector of selectors) {
				const textElement = commentElement.querySelector(selector);
				if (!textElement) continue;

				const text = (typeof textElement.innerText === 'string'
					? textElement.innerText
					: textElement.textContent || '').trim();
				if (text) {
					return text;
				}
			}

			if (attempt < attempts - 1) {
				await new Promise(resolve => setTimeout(resolve, delayMs));
			}
		}

		return '';
	}

	_extractEntityInfo() {
		try {
			const currentInfo = this._extractEntityInfoFromUrl(window.location.href);
			if (currentInfo.entityCode && currentInfo.entityId) {
				return currentInfo;
			}

			const ogUrlMeta = document.querySelector('meta[property="og:url"]');
			if (ogUrlMeta && ogUrlMeta.content) {
				return this._extractEntityInfoFromUrl(ogUrlMeta.content);
			}
			return { entityCode: null, entityId: null, companyCode: null };
		} catch (error) {
			console.error('[CommentBookmarkWatcher] Error extracting entity info:', error);
			return { entityCode: null, entityId: null, companyCode: null };
		}
	}

	_extractEntityInfoFromUrl(rawUrl) {
		const url = new URL(rawUrl);
		const pathParts = url.pathname.split('/').filter(Boolean);
		const companiesIndex = pathParts.indexOf('companies');
		if (companiesIndex === -1 || companiesIndex + 3 >= pathParts.length) {
			return { entityCode: null, entityId: null, companyCode: null };
		}

		const companyCode = pathParts[companiesIndex + 1];
		const possibleEntityType = pathParts[companiesIndex + 2];
		const possibleId = pathParts[companiesIndex + 3];
		const validTypes = { posts: 'posts', articles: 'articles', news: 'news' };
		if (!validTypes[possibleEntityType] || !/^\d+$/.test(possibleId)) {
			return { entityCode: null, entityId: null, companyCode: null };
		}
		return {
			entityCode: validTypes[possibleEntityType],
			entityId: parseInt(possibleId, 10),
			companyCode
		};
	}

	_extractCompanyCode() {
		return this._extractEntityInfo().companyCode || null;
	}

	_extractArticleTitle() {
			try {
				const titleElement = document.querySelector('h1.tm-title') || document.querySelector('h1');
				const title = titleElement && typeof titleElement.innerText === 'string'
					? titleElement.innerText.trim()
					: '';
				if (!title) {
					const error = new Error('Не удалось определить заголовок статьи на странице Habr');
					error.code = 'ARTICLE_TITLE_EXTRACTION_FAILED';
					throw error;
				}
				return title.substring(0, 255);
			} catch (error) {
				if (error.code === 'ARTICLE_TITLE_EXTRACTION_FAILED') {
					throw error;
				}
				const extractionError = new Error('Не удалось прочитать заголовок статьи на странице Habr');
				extractionError.code = 'ARTICLE_TITLE_EXTRACTION_FAILED';
				throw extractionError;
			}
		}
}
