import mock from '../../tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx, u } = converse.env;

/**
 * @param {any} _converse
 * @returns {Promise<string>}
 */
async function getContactJID(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    return mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
}

/**
 * Opens a message's actions dropdown and returns its elements.
 * @param {Element} view
 * @param {string} msgid
 */
async function openMessageActions(view, msgid) {
    const msg_el = await u.waitUntil(() => view.querySelector(`.chat-msg[data-msgid="${msgid}"]`));
    const dropdown_el = await u.waitUntil(() => msg_el?.querySelector('converse-message-actions converse-dropdown'));
    const toggle_el = await u.waitUntil(() => dropdown_el?.querySelector('.dropdown-toggle'));
    toggle_el.click();
    await u.waitUntil(() => dropdown_el.querySelector('.dropdown-menu').classList.contains('show'));
    return { msg_el, dropdown_el };
}

describe('A Dropdown menu', function () {
    it(
        "closes after the message actions' Copy item is clicked",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const contact_jid = await getContactJID(_converse);
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client"
                            from="${contact_jid}"
                            to="${_converse.jid}"
                            type="chat"
                            id="dropdown-close-copy-msg">
                    <body>Copy me</body>
                </message>`,
            );
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            const clipboard_spy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

            const { dropdown_el } = await openMessageActions(view, 'dropdown-close-copy-msg');
            const copy_el = await u.waitUntil(() => dropdown_el.querySelector('.chat-msg__action-copy'));
            copy_el.click();

            await u.waitUntil(() => clipboard_spy.mock.calls.length > 0);
            expect(clipboard_spy).toHaveBeenCalledWith('Copy me');
            await u.waitUntil(() => !dropdown_el.querySelector('.dropdown-menu').classList.contains('show'));
        }),
    );

    it(
        "closes after the message actions' Reply item is clicked",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const contact_jid = await getContactJID(_converse);
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client"
                            from="${contact_jid}"
                            to="${_converse.jid}"
                            type="chat"
                            id="dropdown-close-reply-msg">
                    <body>Reply to me</body>
                </message>`,
            );
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            const { dropdown_el } = await openMessageActions(view, 'dropdown-close-reply-msg');
            const reply_el = await u.waitUntil(() => dropdown_el.querySelector('.chat-msg__action-reply'));
            reply_el.click();

            await u.waitUntil(() => view.model.get('reply_to_id') !== undefined);
            await u.waitUntil(() => !dropdown_el.querySelector('.dropdown-menu').classList.contains('show'));
        }),
    );

    it(
        'closes a chat heading dropdown after an item is clicked',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const contact_jid = await getContactJID(_converse);
            // The heading's "Details"/block/unblock buttons await disco support for the
            // domain; pre-confirming it here keeps that promise from hanging.
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const dropdown_el = await u.waitUntil(() => view.querySelector('converse-dropdown.chatbox-btn'));
            const toggle_el = await u.waitUntil(() => dropdown_el.querySelector('.dropdown-toggle'));
            toggle_el.click();
            await u.waitUntil(() => dropdown_el.querySelector('.dropdown-menu').classList.contains('show'));

            const details_el = await u.waitUntil(() => dropdown_el.querySelector('.show-user-details-modal'));
            details_el.click();

            const modal = _converse.api.modal.get('converse-user-details-modal');
            await u.waitUntil(() => u.isVisible(modal));
            await u.waitUntil(() => !dropdown_el.querySelector('.dropdown-menu').classList.contains('show'));
        }),
    );

    it(
        'still opens the reaction picker via "Add Reaction", correctly positioned',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const contact_jid = await getContactJID(_converse);
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client"
                            from="${contact_jid}"
                            to="${_converse.jid}"
                            type="chat"
                            id="dropdown-close-reaction-msg">
                    <body>React to me</body>
                </message>`,
            );
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            const { msg_el, dropdown_el } = await openMessageActions(view, 'dropdown-close-reaction-msg');
            const reaction_el = await u.waitUntil(() => dropdown_el.querySelector('.chat-msg__action-reaction'));
            reaction_el.click();

            const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));
            await u.waitUntil(() => picker_el.opened);
            expect(picker_el.opened).toBeTrue();

            // The reaction picker is still anchored to the (now hidden) toggle button,
            // not left at its default (0,0) position.
            const picker = await u.waitUntil(() => picker_el.querySelector('.reaction-picker'));
            await u.waitUntil(() => picker.style.right !== '' || picker.style.left !== '');

            // The actions dropdown itself did close.
            await u.waitUntil(() => !dropdown_el.querySelector('.dropdown-menu').classList.contains('show'));
        }),
    );

    it(
        'stays open when non-item content inside it is clicked',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const contact_jid = await getContactJID(_converse);
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client"
                            from="${contact_jid}"
                            to="${_converse.jid}"
                            type="chat"
                            id="dropdown-stay-open-msg">
                    <body>Stay open</body>
                </message>`,
            );
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            const { dropdown_el } = await openMessageActions(view, 'dropdown-stay-open-msg');
            const menu_el = dropdown_el.querySelector('.dropdown-menu');

            // Click the menu's own background, not one of its `.dropdown-item` children.
            menu_el.click();

            expect(menu_el.classList.contains('show')).toBeTrue();
        }),
    );
});
