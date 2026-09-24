import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const STORAGE_KEY = 'converse-skin-theme';
const TOGGLE_SELECTOR = '.skin-theme-toggle';
const THEME_ATTR = 'data-converse-theme';
const LIGHT = 'skin-light';
const DARK = 'skin-dark';
const embedded = { theme: LIGHT, dark_theme: DARK, view_mode: 'embedded' };
const pinned = { theme: DARK, dark_theme: DARK, view_mode: 'embedded' };

const real_match_media = window.matchMedia.bind(window);

/**
 * Stubs only `prefers-color-scheme` queries, so width-based media queries elsewhere (the
 * controlbox, responsive layout) keep using the real `matchMedia`. Returns an object whose
 * `dark` flag can be flipped to simulate an OS change.
 * @param {boolean} dark
 */
function stubMatchMedia(dark) {
    const state = { dark };
    vi.stubGlobal('matchMedia', (query) => {
        if (!query.includes('prefers-color-scheme')) return real_match_media(query);
        return {
            get matches() {
                return query.includes('dark') ? state.dark : !state.dark;
            },
            media: query,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
        };
    });
    return state;
}

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
    afterEach(() => {
        localStorage.removeItem(STORAGE_KEY);
        vi.unstubAllGlobals();
    });

    it('renders next to the settings gear under a skin theme', function () {
        stubMatchMedia(false);
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            await openProfileRow(_converse);
            const button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            expect(button.closest('converse-controlbox-buttons')).not.toBeNull();
            expect(button.title).toBe('Switch to dark theme');
            expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
        })();
    });

    it('OS light: a click stores dark, a second click restores the OS pick', function () {
        stubMatchMedia(false);
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            await openProfileRow(_converse);
            const root = await u.waitUntil(() => document.querySelector('converse-root'));

            let button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            button.click();
            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === DARK);
            expect(localStorage.getItem(STORAGE_KEY)).toBe(DARK);

            button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            expect(button.title).toBe('Switch to light theme');
            button.click();

            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === LIGHT);
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(_converse.api.settings.get('theme')).toBe(LIGHT);
            expect(_converse.api.settings.get('dark_theme')).toBe(DARK);
        })();
    });

    it('OS dark: a click stores light, a second click restores the OS pick', function () {
        stubMatchMedia(true);
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            await openProfileRow(_converse);
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === DARK);

            let button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            button.click();
            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === LIGHT);
            expect(localStorage.getItem(STORAGE_KEY)).toBe(LIGHT);

            button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            button.click();

            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === DARK);
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(_converse.api.settings.get('theme')).toBe(LIGHT);
            expect(_converse.api.settings.get('dark_theme')).toBe(DARK);
        })();
    });

    it('follows the OS again once the stored choice is cleared', function () {
        const state = stubMatchMedia(false);
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            await openProfileRow(_converse);
            const root = await u.waitUntil(() => document.querySelector('converse-root'));

            let button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            button.click(); // -> dark, stored
            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === DARK);

            button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));
            button.click(); // -> back to the OS pick (light), storage cleared
            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === LIGHT);
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

            // The OS switches to dark; rootview's own matchMedia listener re-reads the (now
            // restored) settings and updates the theme without any further toggle click.
            state.dark = true;
            root.setThemeAttributes();
            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === DARK);
        })();
    });

    it('clears a stale stored value that already matches the OS pick, on init', function () {
        stubMatchMedia(false);
        localStorage.setItem(STORAGE_KEY, LIGHT);
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            expect(root.getAttribute(THEME_ATTR)).toBe(LIGHT);
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        })();
    });

    it('applies a stored theme on init, before the first render', function () {
        stubMatchMedia(false);
        localStorage.setItem(STORAGE_KEY, DARK);
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            await u.waitUntil(() => root.getAttribute(THEME_ATTR) === DARK);
        })();
    });

    it('ignores a garbage stored value', function () {
        stubMatchMedia(false);
        localStorage.setItem(STORAGE_KEY, 'not-a-theme');
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            expect(root.getAttribute(THEME_ATTR)).toBe(LIGHT);
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
        localStorage.setItem(STORAGE_KEY, DARK);
        const classic = { theme: 'classic', dark_theme: 'classic', view_mode: 'embedded' };
        return mock.initConverse(converse, [], classic, async (_converse) => {
            await openProfileRow(_converse);
            expect(document.querySelector(TOGGLE_SELECTOR)).toBeNull();
            const root = document.querySelector('converse-root');
            expect(root.getAttribute(THEME_ATTR)).toBe('classic');
        })();
    });

    it('ignores a stored choice and shows no button on a page that pins one theme', function () {
        localStorage.setItem(STORAGE_KEY, LIGHT);
        return mock.initConverse(converse, [], pinned, async (_converse) => {
            await openProfileRow(_converse);
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            expect(root.getAttribute(THEME_ATTR)).toBe(DARK);
            expect(document.querySelector(TOGGLE_SELECTOR)).toBeNull();
        })();
    });

    it(
        'shows no button on a pinned page with nothing stored',
        mock.initConverse(converse, [], pinned, async (_converse) => {
            await openProfileRow(_converse);
            expect(document.querySelector(TOGGLE_SELECTOR)).toBeNull();
        }),
    );

    it('still switches the theme in-session if localStorage throws', function () {
        stubMatchMedia(false);
        return mock.initConverse(converse, [], embedded, async (_converse) => {
            await openProfileRow(_converse);
            const root = await u.waitUntil(() => document.querySelector('converse-root'));
            const button = await u.waitUntil(() => document.querySelector(TOGGLE_SELECTOR));

            const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('storage disabled');
            });
            try {
                button.click();
                await u.waitUntil(() => root.getAttribute(THEME_ATTR) === DARK);
            } finally {
                spy.mockRestore();
            }
        })();
    });
});
