import { page } from 'vitest/browser';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const MUC_JID = 'lounge@montague.lit';
const NARROW = '600px';
const MEDIUM = '900px';

const nextFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/** @returns {Promise<HTMLElement>} */
async function getChatApp() {
    return /** @type {HTMLElement} */ (await u.waitUntil(() => document.querySelector('converse-app-chat')));
}

/**
 * @param {HTMLElement} app
 * @param {string} width
 */
async function resize(app, width) {
    app.style.flex = 'none';
    app.style.width = width;
    await nextFrames();
}

describe('The occupant list auto-hide', function () {
    beforeAll(async () => {
        // Wide enough that upstream's own 768px viewport rule stays out of the way.
        await page.viewport(1400, 900);
    });

    afterAll(async () => {
        await page.viewport(414, 896);
    });

    beforeEach(() => {
        expect(window.matchMedia('(max-width: 768px)').matches).toBe(false);
    });

    const skin = { theme: 'skin-light', view_mode: 'fullscreen' };

    it(
        'collapses the list of a room opened in a narrow chat app',
        mock.initConverse(converse, [], skin, async (_converse) => {
            await resize(await getChatApp(), NARROW);
            await mock.openAndEnterMUC(_converse, MUC_JID, 'romeo');
            const muc = _converse.state.chatboxes.get(MUC_JID);
            await u.waitUntil(() => muc.get('hidden_occupants') === true);
        }),
    );

    it(
        'collapses it at medium widths too',
        mock.initConverse(converse, [], { ...skin, view_mode: 'embedded' }, async (_converse) => {
            await resize(await getChatApp(), MEDIUM);
            await mock.openAndEnterMUC(_converse, MUC_JID, 'romeo');
            const muc = _converse.state.chatboxes.get(MUC_JID);
            await u.waitUntil(() => muc.get('hidden_occupants') === true);
        }),
    );

    it(
        'leaves the list shown in a wide chat app',
        mock.initConverse(converse, [], skin, async (_converse) => {
            await mock.openAndEnterMUC(_converse, MUC_JID, 'romeo');
            await nextFrames();
            expect((await getChatApp()).clientWidth).toBeGreaterThan(1024);
            expect(_converse.state.chatboxes.get(MUC_JID).get('hidden_occupants')).toBe(false);
        }),
    );

    it(
        'collapses the list when the chat app shrinks, but only once per shrink',
        mock.initConverse(converse, [], skin, async (_converse) => {
            await mock.openAndEnterMUC(_converse, MUC_JID, 'romeo');
            const muc = _converse.state.chatboxes.get(MUC_JID);
            const app = await getChatApp();
            await nextFrames();
            expect(muc.get('hidden_occupants')).toBe(false);

            await resize(app, NARROW);
            await u.waitUntil(() => muc.get('hidden_occupants') === true);

            // The user reopens it; resizing within the narrow range must not close it again.
            muc.save({ hidden_occupants: false });
            await resize(app, '500px');
            expect(muc.get('hidden_occupants')).toBe(false);

            // Growing wide never forces it open, and a fresh shrink collapses it again.
            muc.save({ hidden_occupants: true });
            await resize(app, '1200px');
            expect(muc.get('hidden_occupants')).toBe(true);
            muc.save({ hidden_occupants: false });
            await resize(app, NARROW);
            await u.waitUntil(() => muc.get('hidden_occupants') === true);
        }),
    );

    it(
        'leaves non-skin themes alone',
        mock.initConverse(converse, [], { ...skin, theme: 'classic' }, async (_converse) => {
            await resize(await getChatApp(), NARROW);
            await mock.openAndEnterMUC(_converse, MUC_JID, 'romeo');
            await nextFrames();
            expect(_converse.state.chatboxes.get(MUC_JID).get('hidden_occupants')).toBe(false);
        }),
    );

    it(
        'leaves the overlayed view mode alone',
        mock.initConverse(converse, [], { ...skin, view_mode: 'overlayed' }, async (_converse) => {
            await resize(await getChatApp(), NARROW);
            await mock.openAndEnterMUC(_converse, MUC_JID, 'romeo');
            await nextFrames();
            expect(_converse.state.chatboxes.get(MUC_JID).get('hidden_occupants')).toBe(false);
        }),
    );

    it(
        // Regression test for #166: upstream's viewport-keyed column classes squeezed this to
        // roughly 140px at 1200px wide before _responsive.scss gave it a floor.
        'keeps the occupants sidebar at least 240px wide at 1200px',
        mock.initConverse(converse, [], skin, async (_converse) => {
            await mock.openAndEnterMUC(_converse, MUC_JID, 'romeo');
            await resize(await getChatApp(), '1200px');
            const sidebar = await u.waitUntil(() => document.querySelector('converse-muc-sidebar'));
            expect(parseFloat(getComputedStyle(sidebar).width)).toBeGreaterThanOrEqual(240);
        }),
    );
});
