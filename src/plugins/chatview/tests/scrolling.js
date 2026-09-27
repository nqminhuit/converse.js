import { describe, it, expect } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const SCROLLER_HEIGHT = 300;
const NUM_MESSAGES = 30;

/**
 * Opens a 1:1 chat with messages in it, and pins the scroller's height inline
 * so that it overflows, regardless of the theme's CSS.
 *
 * The message area is a `column-reverse` scroller, so its scroll origin (the
 * end of the conversation) is 0 and scrolling up gives a *negative* offset.
 *
 * @param {any} _converse
 * @param {number} num_messages
 */
async function openChat(_converse, num_messages = NUM_MESSAGES) {
    await mock.waitForRoster(_converse, 'current');
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);

    const scroller = await u.waitUntil(() => view.querySelector('.chat-content__messages'));
    scroller.style.height = `${SCROLLER_HEIGHT}px`;
    scroller.style.overflowY = 'auto';

    const promises = [];
    for (let i = 0; i < num_messages; i++) {
        promises.push(_converse.handleMessageStanza(mock.createChatMessage(_converse, contact_jid, `Message: ${i}`)));
    }
    await Promise.all(promises);
    await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === num_messages);
    return { view, scroller, contact_jid };
}

/**
 * Opens a chat whose message area overflows, i.e. in which scrolling is possible.
 *
 * @param {any} _converse
 * @param {number} num_messages
 */
async function openOverflowingChat(_converse, num_messages = NUM_MESSAGES) {
    const chat = await openChat(_converse, num_messages);
    await u.waitUntil(() => chat.scroller.scrollHeight > chat.scroller.clientHeight);
    return chat;
}

/**
 * Scrolls up to the oldest messages and waits for the chat area to register it.
 *
 * @param {any} view
 * @param {HTMLElement} scroller
 * @returns {Promise<HTMLElement>} the scroll-down button
 */
async function scrollUp(view, scroller) {
    scroller.scrollTop = -scroller.scrollHeight;
    await u.waitUntil(() => view.model.ui.get('scrolled'));
    const button = await u.waitUntil(() => view.querySelector('.chat-content__scroll-down'));
    expect(scroller.scrollTop).toBeLessThan(0);
    return button;
}

/**
 * Whether the message area is scrolled all the way down.
 *
 * @param {HTMLElement} scroller
 */
function atBottom(scroller) {
    return Math.abs(scroller.scrollTop) < 1;
}

describe('Scrolling the chat area to the latest message', function () {
    it(
        'jumps to the end when you send a message whilst scrolled up',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, scroller } = await openOverflowingChat(_converse);
            await scrollUp(view, scroller);

            await mock.sendMessage(_converse, view, 'A new message from me');

            await u.waitUntil(() => atBottom(scroller));
            expect(view.model.ui.get('scrolled')).toBe(false);
            await u.waitUntil(() => !view.querySelector('.chat-content__scroll-down'));
        }),
    );

    it(
        'shows a button once you scroll up, which takes you back to the end',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, scroller } = await openOverflowingChat(_converse);

            // No button whilst at the end of the conversation.
            expect(view.model.ui.get('scrolled')).toBeFalsy();
            expect(view.querySelector('.chat-content__scroll-down')).toBeNull();

            const button = await scrollUp(view, scroller);
            button.click();

            await u.waitUntil(() => atBottom(scroller));
            expect(view.model.ui.get('scrolled')).toBe(false);
            await u.waitUntil(() => !view.querySelector('.chat-content__scroll-down'));
        }),
    );

    it(
        'does not move you when a message is received whilst you are scrolled up',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, scroller, contact_jid } = await openOverflowingChat(_converse);
            await scrollUp(view, scroller);

            await _converse.handleMessageStanza(
                mock.createChatMessage(_converse, contact_jid, 'A message from someone else'),
            );
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === NUM_MESSAGES + 1);

            // Still reading the same (old) part of the conversation.
            expect(view.model.ui.get('scrolled')).toBe(true);
            expect(scroller.scrollTop).toBeLessThan(0);
            expect(view.querySelector('.chat-content__scroll-down')).not.toBeNull();
        }),
    );

    it(
        'does not show the button if the whole conversation fits on screen',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, scroller } = await openChat(_converse, 2);

            expect(scroller.scrollHeight).toBeLessThanOrEqual(scroller.clientHeight);
            expect(view.model.ui.get('scrolled')).toBeFalsy();
            expect(view.querySelector('.chat-content__scroll-down')).toBeNull();
        }),
    );

    it(
        'floats the button over the bottom-inline-end corner of the message area',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, scroller } = await openOverflowingChat(_converse);
            const button = await scrollUp(view, scroller);

            // A sibling of the scroller, so that it neither scrolls away with the
            // messages nor is clipped by it.
            expect(button.parentElement).toBe(view.querySelector('converse-chat-content'));
            const content_rect = view.querySelector('converse-chat-content').getBoundingClientRect();
            const rect = button.getBoundingClientRect();
            expect(rect.bottom).toBeLessThanOrEqual(content_rect.bottom);
            expect(rect.right).toBeLessThanOrEqual(content_rect.right);
            expect(content_rect.bottom - rect.bottom).toBeLessThan(content_rect.height / 2);
            expect(content_rect.right - rect.right).toBeLessThan(content_rect.width / 2);
            expect(rect.height).toBeGreaterThan(16);
        }),
    );
});
