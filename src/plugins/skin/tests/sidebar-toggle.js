import { page } from 'vitest/browser';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const MUC_JID = 'lounge@montague.lit';
const TOGGLE_SELECTOR = '.toggle-skin-sidebar';
const embedded = { theme: 'skin-light', view_mode: 'embedded' };

/**
 * @param {any} _converse
 * @returns {import('@converse/headless').Model}
 */
function getControlBox(_converse) {
    return _converse.state.chatboxes.get('controlbox');
}

/**
 * @param {any} _converse
 * @returns {Promise<string>}
 */
async function getFirstContactJID(_converse) {
    await mock.waitForRoster(_converse, 'current');
    // The heading's own "Details"/block/unblock buttons await disco support for the domain;
    // pre-confirming it here keeps that promise (and ours, chained after it) from hanging.
    await mock.waitUntilBlocklistInitialized(_converse);
    return mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
}

describe('The skin sidebar toggle', function () {
    beforeAll(async () => {
        // Wide enough that the pane's `@container converse (width > $skin-narrow)` rule applies,
        // mirroring occupants-autohide.js's tests.
        await page.viewport(1400, 900);
    });

    afterAll(async () => {
        await page.viewport(414, 896);
    });

    it(
        'shows a button in a 1:1 chat heading',
        mock.initConverse(converse, [], embedded, async (_converse) => {
            const jid = await getFirstContactJID(_converse);
            await mock.openChatBoxFor(_converse, jid);
            const chatview = _converse.chatboxviews.get(jid);
            const button = await u.waitUntil(() => chatview.querySelector(TOGGLE_SELECTOR));
            expect(button.title).toBe('Hide contacts');
        }),
    );

    it(
        'shows a button in a MUC heading',
        mock.initConverse(converse, [], embedded, async (_converse) => {
            await mock.openAndEnterMUC(_converse, MUC_JID, 'romeo');
            const view = _converse.chatboxviews.get(MUC_JID);
            const button = await u.waitUntil(() => view.querySelector(TOGGLE_SELECTOR));
            expect(button.title).toBe('Hide contacts');
        }),
    );

    it(
        'hides the controlbox on click and reopens it, flipping the label',
        mock.initConverse(converse, [], embedded, async (_converse) => {
            const jid = await getFirstContactJID(_converse);
            await mock.openChatBoxFor(_converse, jid);
            const chatview = _converse.chatboxviews.get(jid);
            const controlbox = getControlBox(_converse);
            const controlbox_el = await u.waitUntil(() => document.querySelector('#controlbox'));
            const chatbox_el = chatview.closest('.chatbox');
            const width_with_sidebar = chatbox_el.getBoundingClientRect().width;

            const hide_button = await u.waitUntil(() => chatview.querySelector(TOGGLE_SELECTOR));
            hide_button.click();
            await u.waitUntil(() => controlbox.get('skin_sidebar_hidden') === true);
            await u.waitUntil(() => getComputedStyle(controlbox_el).display === 'none');

            // The chat grows to fill the space the (now hidden) sidebar left behind.
            await u.waitUntil(() => chatbox_el.getBoundingClientRect().width > width_with_sidebar);

            const show_button = await u.waitUntil(() => chatview.querySelector(TOGGLE_SELECTOR));
            expect(show_button.title).toBe('Show contacts');
            show_button.click();

            await u.waitUntil(() => controlbox.get('skin_sidebar_hidden') === false);
            await u.waitUntil(() => getComputedStyle(controlbox_el).display !== 'none');
            const reshown_button = await u.waitUntil(() => chatview.querySelector(TOGGLE_SELECTOR));
            expect(reshown_button.title).toBe('Hide contacts');
        }),
    );

    it(
        'reopens the controlbox when the last chat is closed while it is hidden',
        mock.initConverse(converse, [], embedded, async (_converse) => {
            const jid = await getFirstContactJID(_converse);
            await mock.openChatBoxFor(_converse, jid);
            const chatview = _converse.chatboxviews.get(jid);
            const controlbox = getControlBox(_converse);

            const hide_button = await u.waitUntil(() => chatview.querySelector(TOGGLE_SELECTOR));
            hide_button.click();
            await u.waitUntil(() => controlbox.get('skin_sidebar_hidden') === true);

            await chatview.model.close();
            await u.waitUntil(() => controlbox.get('skin_sidebar_hidden') === false);
        }),
    );

    it(
        'has no button in overlayed mode',
        mock.initConverse(converse, [], { ...embedded, view_mode: 'overlayed' }, async (_converse) => {
            const jid = await getFirstContactJID(_converse);
            await mock.openChatBoxFor(_converse, jid);
            const chatview = _converse.chatboxviews.get(jid);
            await u.waitUntil(() => chatview.querySelector('.show-user-details-modal'));
            expect(chatview.querySelector(TOGGLE_SELECTOR)).toBeNull();
        }),
    );

    it(
        'has no button when skin_sidebar_toggle is disabled',
        mock.initConverse(converse, [], { ...embedded, skin_sidebar_toggle: false }, async (_converse) => {
            const jid = await getFirstContactJID(_converse);
            await mock.openChatBoxFor(_converse, jid);
            const chatview = _converse.chatboxviews.get(jid);
            await u.waitUntil(() => chatview.querySelector('.show-user-details-modal'));
            expect(chatview.querySelector(TOGGLE_SELECTOR)).toBeNull();
        }),
    );
});
