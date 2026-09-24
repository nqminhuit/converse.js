import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const STORAGE_KEY = 'converse-skin-theme';
const TOGGLE_SELECTOR = '.skin-theme-toggle';
const embedded = { theme: 'skin-light', dark_theme: 'skin-dark', view_mode: 'embedded' };

/**
 * Opens the controlbox and waits for the profile row (and hence the toggle, if it applies).
 * @param {any} _converse
 */
async function openProfileRow(_converse) {
    mock.openControlBox(_converse);
    return u.waitUntil(() => document.querySelector('converse-user-profile .username'));
}

describe('The skin theme toggle', function () {
    beforeEach(() => localStorage.removeItem(STORAGE_KEY));
    afterEach(() => localStorage.removeItem(STORAGE_KEY));

    it(
        'renders next to the settings gear under a skin theme',
        mock.initConverse(converse, [], embedded, async (_converse) => {
            await openProfileRow(_converse);
            const button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            expect(button.closest('converse-controlbox-buttons')).not.toBeNull();
            expect(button.title).toBe('Switch to dark theme');
            expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
        }),
    );

    it(
        'flips the theme and persists the choice on click, and flips back',
        mock.initConverse(converse, [], embedded, async (_converse) => {
            await openProfileRow(_converse);
            const root = await u.waitUntil(() => document.querySelector('converse-root'));

            let button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            button.click();
            await u.waitUntil(() => root.getAttribute('data-converse-theme') === 'skin-dark');
            expect(localStorage.getItem(STORAGE_KEY)).toBe('skin-dark');
            button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            expect(button.title).toBe('Switch to light theme');

            button.click();
            await u.waitUntil(() => root.getAttribute('data-converse-theme') === 'skin-light');
            expect(localStorage.getItem(STORAGE_KEY)).toBe('skin-light');
            button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            expect(button.title).toBe('Switch to dark theme');
        }),
    );

    it('applies a stored theme on init, before the first render', function () {
        localStorage.setItem(STORAGE_KEY, 'skin-dark');
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            await u.waitUntil(() => root.getAttribute('data-converse-theme') === 'skin-dark');
        })();
    });

    it('ignores a garbage stored value', function () {
        localStorage.setItem(STORAGE_KEY, 'not-a-theme');
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            expect(root.getAttribute('data-converse-theme')).toBe('skin-light');
        })();
    });

    it(
        'has no button when skin_theme_toggle is disabled',
        mock.initConverse(converse, [], { ...embedded, skin_theme_toggle: false }, async (_converse) => {
            await openProfileRow(_converse);
            expect(document.querySelector(TOGGLE_SELECTOR)).toBeNull();
        }),
    );

    it('has no button under a non-skin theme, and does not apply a stored value', function () {
        localStorage.setItem(STORAGE_KEY, 'skin-dark');
        const classic = { theme: 'classic', dark_theme: 'classic', view_mode: 'embedded' };
        return mock.initConverse(converse, [], classic, async (_converse) => {
            await openProfileRow(_converse);
            expect(document.querySelector(TOGGLE_SELECTOR)).toBeNull();
            const root = document.querySelector('converse-root');
            expect(root.getAttribute('data-converse-theme')).toBe('classic');
        })();
    });

    it(
        'still switches the theme in-session if localStorage throws',
        mock.initConverse(converse, [], embedded, async (_converse) => {
            await openProfileRow(_converse);
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            const button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));

            const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('storage disabled');
            });
            try {
                button.click();
                await u.waitUntil(() => root.getAttribute('data-converse-theme') === 'skin-dark');
            } finally {
                spy.mockRestore();
            }
        }),
    );
});
