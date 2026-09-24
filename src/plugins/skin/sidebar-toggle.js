/**
 * Adds a heading button that hides/shows the controlbox sidebar in the paned (embedded and
 * fullscreen) skin layouts, where upstream has no such control of its own.
 *
 * The hidden state is a skin-owned flag (`skin_sidebar_hidden`) on the controlbox model, kept
 * separate from upstream's own `closed` attribute, which upstream already uses for other things
 * in these view modes (see `ControlBox.defaults` and `navigateToControlBox`).
 */
import { _converse, api, constants, u } from '@converse/headless';
import { __ } from 'i18n';

const { CONTROLBOX_TYPE } = constants;

const SETTING = 'skin_sidebar_toggle';
const PANED_VIEW_MODES = ['embedded', 'fullscreen'];
const HEADING_SELECTOR = 'converse-chat-heading, converse-muc-heading';

/**
 * @returns {import('@converse/headless').Model|undefined}
 */
function getControlBox() {
    return _converse.state.chatboxes?.get('controlbox');
}

/**
 * Only act under a skin theme, in a paned view mode, mirroring `occupants-autohide.js`'s `isSkinned`.
 * @param {Element} [el] an element inside the themed tree, e.g. a chat or controlbox view
 */
function isSkinnedPanedMode(el) {
    if (!PANED_VIEW_MODES.includes(api.settings.get('view_mode'))) return false;
    const theme = el?.closest('[data-converse-theme]')?.getAttribute('data-converse-theme') ?? '';
    return theme.startsWith('skin-');
}

/**
 * @param {import('@converse/headless').Model} [controlbox]
 */
function isSidebarHidden(controlbox) {
    return !!controlbox?.get('skin_sidebar_hidden');
}

/**
 * Reflects the flag onto `converse-root` as a data attribute, which `_responsive.scss` reads to
 * hide `#controlbox` and let the open chat fill the pane.
 * @param {import('@converse/headless').Model} [controlbox]
 */
function reflectAttribute(controlbox) {
    const root = document.querySelector('converse-root');
    root?.toggleAttribute('data-skin-sidebar-hidden', isSidebarHidden(controlbox));
}

/**
 * `getHeadingButtons` is re-run on every heading render (see `templates/chat-head.js` and
 * `templates/muc-head.js`), so re-rendering the heading is enough to flip the button's label/icon.
 */
function refreshHeadings() {
    document.querySelectorAll(HEADING_SELECTOR).forEach((el) => /** @type {any} */ (el).requestUpdate());
}

/**
 * Any chat, other than the controlbox itself, that the user can currently see.
 */
function hasVisibleChat() {
    // Collection#some hands the predicate plain attributes, not models, so filter instead.
    return (
        _converse.state.chatboxes
            ?.filter(
                /** @param {import('@converse/headless').Model} c */
                (c) => c.get('type') !== CONTROLBOX_TYPE && !c.get('hidden') && !c.get('closed'),
            )
            .length > 0
    );
}

/**
 * Safety net: never leave the user with neither the sidebar nor a chat visible.
 */
function maybeReopenSidebar() {
    const controlbox = getControlBox();
    if (!isSidebarHidden(controlbox)) return;
    if (!isSkinnedPanedMode(_converse.state.chatboxviews?.get('controlbox'))) return;
    if (!hasVisibleChat()) u.safeSave(controlbox, { skin_sidebar_hidden: false });
}

/**
 * @param {HTMLElement} el
 * @param {Array<import('plugins/chatview/types').HeadingButtonAttributes>} buttons
 */
function onGetHeadingButtons(el, buttons) {
    if (!api.settings.get(SETTING) || !isSkinnedPanedMode(el)) return buttons;

    const controlbox = getControlBox();
    if (!controlbox) return buttons;

    const hidden = isSidebarHidden(controlbox);
    buttons.unshift({
        a_class: 'toggle-skin-sidebar',
        handler: /** @param {Event} ev */ (ev) => {
            ev?.preventDefault?.();
            u.safeSave(controlbox, { skin_sidebar_hidden: !hidden });
        },
        i18n_text: hidden ? __('Show contacts') : __('Hide contacts'),
        i18n_title: hidden ? __('Show contacts') : __('Hide contacts'),
        icon_class: hidden ? 'fa-angle-double-right' : 'fa-angle-double-left',
        name: 'skin-sidebar-toggle',
        standalone: true,
    });
    return buttons;
}

export function initSidebarToggle() {
    api.settings.extend({ [SETTING]: true });

    api.listen.on('getHeadingButtons', onGetHeadingButtons);
    api.listen.on('chatBoxClosed', maybeReopenSidebar);

    api.waitUntil('chatBoxesFetched').then(() => {
        const controlbox = getControlBox();
        reflectAttribute(controlbox);
        maybeReopenSidebar();

        _converse.state.chatboxes.on('change:skin_sidebar_hidden', () => {
            reflectAttribute(getControlBox());
            refreshHeadings();
        });
    });
}
