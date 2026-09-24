/**
 * Adds a heading button, next to the settings gear in the controlbox profile row, that flips
 * between the `skin-light` and `skin-dark` themes and remembers the choice per browser.
 *
 * `converse-controlbox-buttons` (upstream, `src/plugins/controlbox/buttons.js`) has no hook for
 * an extra button, so this wraps its `render()` instead of editing that file.
 */
import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { getTheme } from 'plugins/rootview/utils.js';

const SETTING = 'skin_theme_toggle';
const STORAGE_KEY = 'converse-skin-theme';
const LIGHT = 'skin-light';
const DARK = 'skin-dark';

// Sized to fill the 24x24 box edge-to-edge (rays from r=8.5 to r=11), matching the FA icons'
// visual weight at `size="1em"` instead of reading as a speck next to the gear.
const TPL_SUN = html`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="12" r="5"></circle>
    <path
        d="M12 3.5V1M12 20.5V23M3.5 12H1M20.5 12H23M18.01 5.99l1.77-1.77M5.99 5.99l-1.77-1.77M18.01 18.01l1.77 1.77M5.99 18.01l-1.77 1.77"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
    ></path>
</svg>`;

// Guards against re-patching `render()` on every `converse.initialize()` call (e.g. across tests).
let patched = false;

// Whether the page pinned `theme`/`dark_theme` to the same value, captured at init time before
// a stored choice or click can make them equal on their own. Re-set on each init (tests re-init).
let pinned = false;

/**
 * @param {string} [theme]
 */
function isSkinTheme(theme) {
    return typeof theme === 'string' && theme.startsWith('skin-');
}

/**
 * The toggle is inert (no button, no applied choice) outside a skin theme, when disabled, or when
 * the page pinned a single theme (e.g. an embedded dashboard sharing origin with a standalone page).
 */
function appliesThemeToggle() {
    return !!api.settings.get(SETTING) && isSkinTheme(getTheme()) && !pinned;
}

/**
 * @returns {string|null} a valid stored theme, or null if unset, garbage, or storage throws.
 */
function readStoredTheme() {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        return value === LIGHT || value === DARK ? value : null;
    } catch {
        return null;
    }
}

/**
 * @param {string} value
 */
function writeStoredTheme(value) {
    try {
        localStorage.setItem(STORAGE_KEY, value);
    } catch {
        // Storage can throw in private windows or third-party iframes; the toggle still works for the session.
    }
}

/**
 * `converse-root`/`converse-bg` only re-read the theme on their own view_mode/OS-scheme
 * listeners, so force it onto any that already exist.
 */
function applyToExistingElements() {
    document.querySelectorAll('converse-root, converse-bg').forEach((el) => {
        const target = /** @type {any} */ (el);
        if (typeof target.setThemeAttributes === 'function') target.setThemeAttributes();
    });
}

/**
 * Forces `theme`/`dark_theme` to the same value, so `getTheme()` returns it regardless of the OS
 * preference, then pushes it onto any already-rendered elements.
 * @param {string} value
 */
function applyTheme(value) {
    api.settings.set({ theme: value, dark_theme: value });
    applyToExistingElements();
}

function refreshButtons() {
    document.querySelectorAll('converse-controlbox-buttons').forEach((el) => /** @type {any} */ (el).requestUpdate());
}

/**
 * @param {Event} [ev]
 */
function onToggleClick(ev) {
    ev?.preventDefault?.();
    const next = getTheme() === DARK ? LIGHT : DARK;
    writeStoredTheme(next);
    applyTheme(next);
    refreshButtons();
}

/**
 * Wrapped in its own `.btn-toolbar > .btn-group`, matching upstream's markup, so its scoped
 * `.controlbox-heading__btn` rule (padding, margin, cursor, icon fill) applies unchanged.
 */
function tplThemeToggle() {
    const dark = getTheme() === DARK;
    const title = dark ? __('Switch to light theme') : __('Switch to dark theme');
    return html`<div class="btn-toolbar g-0" role="toolbar">
        <div class="btn-group" role="group">
            <a
                class="controlbox-heading__btn skin-theme-toggle align-self-center"
                href="#"
                role="button"
                title="${title}"
                aria-label="${title}"
                @click=${onToggleClick}
            >
                ${dark ? TPL_SUN : html`<converse-icon class="fa fa-moon" size="1em"></converse-icon>`}
            </a>
        </div>
    </div>`;
}

/**
 * Wraps `ControlboxButtons.prototype.render` once the element is defined, prepending the toggle
 * only while it applies; the original render is otherwise untouched.
 */
function patchControlboxButtons() {
    if (patched) return;
    const ControlboxButtons = customElements.get('converse-controlbox-buttons');
    if (!ControlboxButtons) return;
    patched = true;

    const original = ControlboxButtons.prototype.render;
    ControlboxButtons.prototype.render = function () {
        return appliesThemeToggle() ? html`${tplThemeToggle()}${original.call(this)}` : original.call(this);
    };
}

export function initThemeToggle() {
    api.settings.extend({ [SETTING]: true });

    pinned = api.settings.get('theme') === api.settings.get('dark_theme');

    if (api.settings.get(SETTING) && !pinned) {
        const stored = readStoredTheme();
        if (stored && isSkinTheme(getTheme())) applyTheme(stored);
    }

    customElements.whenDefined('converse-controlbox-buttons').then(patchControlboxButtons);

    // `converse-root`/`converse-bg` may already have rendered with the old theme before this
    // plugin ran (or not exist yet); either way, this catches up once chat boxes are fetched.
    api.waitUntil('chatBoxesFetched').then(applyToExistingElements);
}
