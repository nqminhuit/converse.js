import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u, stx } = converse.env;

// Default category is 'smileys' (src/headless/plugins/emoji/picker.js); pick a different one
// so the "picked" tab under test isn't also carrying the default styling by coincidence.
const CATEGORY = 'people';
const THEME = { theme: 'skin-light', dark_theme: 'skin-light' };

/** Resolves a CSS value (e.g. a var()) to its computed rgb() via a throwaway probe element. */
function resolveColor(container, value) {
    const probe = document.createElement('div');
    probe.style.backgroundColor = value;
    container.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
}

async function openComposerPicker(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);
    const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
    toolbar.querySelector('.toggle-emojis').click();
    await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')), 1000);
    return u.waitUntil(() => view.querySelector('converse-emoji-dropdown .dropdown-menu'));
}

// Opens the reaction "+" picker on a freshly received message (see reactions-views/tests/reactions.js).
async function openReactionPicker(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);

    await _converse.handleMessageStanza(
        stx`<message xmlns="jabber:client"
                    from="${contact_jid}"
                    to="${_converse.jid}"
                    type="chat"
                    id="tabs-test-msg">
            <body>React to this</body>
        </message>`,
    );
    await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
    const msg_el = await u.waitUntil(() => view.querySelector('.chat-msg[data-msgid="tabs-test-msg"]'));
    const dropdown_el = await u.waitUntil(() => msg_el.querySelector('converse-message-actions converse-dropdown'));
    dropdown_el.querySelector('.dropdown-toggle').click();
    const action_el = await u.waitUntil(() => dropdown_el.querySelector('.chat-msg__action-reaction'));
    action_el.click();
    const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));
    const more_btn = await u.waitUntil(() => picker_el.querySelector('.reaction-item.more'));
    more_btn.click();
    const dropdown_menu = await u.waitUntil(() =>
        picker_el.querySelector('converse-emoji-picker-dropdown .dropdown-menu'),
    );
    await u.waitUntil(() => u.isVisible(dropdown_menu.querySelector('.emoji-picker__lists')), 1000);
    return dropdown_menu;
}

/**
 * Picks CATEGORY and asserts the tab reads as a tinted pill, not upstream's solid
 * `--heading-color` chip: the picked `<a>` isn't filled with the foreground colour, and the
 * `<li>` itself stays transparent (only the `<a>` inside carries the tint).
 * @param {Element} dropdown_menu
 */
async function assertPickedTabIsPill(dropdown_menu) {
    const li = await u.waitUntil(() => dropdown_menu.querySelector(`.emoji-category[data-category="${CATEGORY}"]`));
    const link = li.querySelector('.pick-category');
    link.click();
    await u.waitUntil(() => li.classList.contains('picked'));
    // Bootstrap's `.btn` transitions background-color over 150ms; a bare "changed" or
    // "stopped changing" poll can catch a mid-transition frame before the first repaint
    // even lands, so just wait out the transition instead.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const foreground = resolveColor(dropdown_menu, 'var(--heading-color)');
    expect(getComputedStyle(link).backgroundColor).not.toBe(foreground);
    expect(getComputedStyle(li).backgroundColor).toBe('rgba(0, 0, 0, 0)');
}

describe('The emoji picker category tabs', function () {
    it(
        'skin the composer picker as tinted pills, not a solid chip',
        mock.initConverse(converse, ['chatBoxesFetched'], THEME, async function (_converse) {
            const dropdown_menu = await openComposerPicker(_converse);
            await assertPickedTabIsPill(dropdown_menu);
        }),
    );

    it(
        'skin the reaction "+" picker as tinted pills, not a solid chip',
        mock.initConverse(converse, ['chatBoxesFetched'], THEME, async function (_converse) {
            const dropdown_menu = await openReactionPicker(_converse);
            await assertPickedTabIsPill(dropdown_menu);
        }),
    );
});
