import { __ } from 'i18n';
import { html } from 'lit';
import { capUnreadCount } from '../utils.js';

/**
 * @param {import('../chat-content.js').default} el
 */
export default (el) => {
    const i18n_scroll_to_latest = __('Scroll to the latest message');
    const unread = capUnreadCount(el.unreadCount);
    return html`
        <button
            type="button"
            class="chat-content__scroll-down"
            title="${i18n_scroll_to_latest}"
            aria-label="${i18n_scroll_to_latest}"
            @click=${/** @param {Event} ev */ (ev) => el.scrollToLatest(ev)}
        >
            <converse-icon class="fa fa-arrow-down" size="1em"></converse-icon>
            ${unread ? html`<span class="chat-content__scroll-down__badge badge badge-primary">${unread}</span>` : ''}
        </button>
    `;
};
