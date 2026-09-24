/**
 * Collapses the MUC occupant list by default when the chat app itself is narrow, not just the viewport.
 * Upstream only does this for viewports of 768px or less, which misses a narrow panel on a wide screen.
 */
import { _converse, api, constants, u } from '@converse/headless';

const { CHATROOMS_TYPE } = constants;

// Mirrors `$skin-medium` in styles/_tokens.scss, where _responsive.scss collapses the sidebar.
export const OCCUPANTS_AUTOHIDE_WIDTH = 1024;
const PANED_VIEW_MODES = ['embedded', 'fullscreen'];

/** @type {WeakMap<Element, boolean>} Each observed chat app's last known narrow state. */
const narrow_state = new WeakMap();
/** @type {ResizeObserver|undefined} */
let observer;

/**
 * @param {Element} el
 */
function isSkinned(el) {
    const theme = el.closest('[data-converse-theme]')?.getAttribute('data-converse-theme') ?? '';
    return theme.startsWith('skin-') && PANED_VIEW_MODES.includes(api.settings.get('view_mode'));
}

/**
 * @param {import('@converse/headless').MUC} muc
 */
function collapse(muc) {
    if (!muc.get('hidden_occupants')) u.safeSave(muc, { hidden_occupants: true });
}

/**
 * Only a wide-to-narrow change collapses, so a list the user reopened stays open while the panel stays narrow.
 * @param {ResizeObserverEntry[]} entries
 */
function onResize(entries) {
    for (const { target, contentBoxSize } of entries) {
        if (!target.isConnected) {
            observer.unobserve(target);
            narrow_state.delete(target);
            continue;
        }
        const width = contentBoxSize[0]?.inlineSize ?? 0;
        // Zero while unmounted or hidden by the app switcher; not a real layout width.
        if (width === 0) continue;

        const is_narrow = width <= OCCUPANTS_AUTOHIDE_WIDTH;
        const was_narrow = narrow_state.get(target);
        narrow_state.set(target, is_narrow);
        if (is_narrow && was_narrow === false && isSkinned(target)) {
            _converse.state.chatboxes.filter((c) => c.get('type') === CHATROOMS_TYPE).forEach(collapse);
        }
    }
}

/**
 * @param {import('plugins/muc-views/muc.js').default} view
 */
function onRoomViewInitialized(view) {
    const app = view.closest('converse-app-chat');
    if (!app) return;

    if (!narrow_state.has(app)) {
        observer ??= new ResizeObserver(onResize);
        observer.observe(app);
    }
    // clientWidth skips the embedded border, like the `@container` query does.
    const width = app.clientWidth;
    if (width > 0 && width <= OCCUPANTS_AUTOHIDE_WIDTH && isSkinned(app)) collapse(view.model);
}

export function initOccupantsAutohide() {
    api.listen.on('chatRoomViewInitialized', onRoomViewInitialized);
}
