/**
 * Hides the contacts ☰ menu's "Show block list" item when the server doesn't support
 * XEP-0191 blocking, mirroring the block/unblock buttons upstream already hides
 * (`chatview/heading.js`, `rosterview/utils.js`).
 */
import { _converse, api, converse } from '@converse/headless';

const { Strophe } = converse.env;

const ATTRIBUTE = 'data-skin-no-blocking';

/**
 * Reflects the (un)supported state onto `converse-root`, the same way `sidebar-toggle.js`
 * reflects `data-skin-sidebar-hidden`. `_lists.scss` reads it to hide the menu item.
 * @param {boolean} supported
 */
function reflectAttribute(supported) {
    const root = document.querySelector('converse-root');
    root?.toggleAttribute(ATTRIBUTE, !supported);
}

async function refreshBlockingSupport() {
    const domain = _converse.session.get('domain');
    if (!domain) return;
    const supported = await api.disco.supports(Strophe.NS.BLOCKING, domain);
    reflectAttribute(supported);
}

export function initBlocklistMenu() {
    api.listen.on('connected', refreshBlockingSupport);
    api.listen.on('reconnected', refreshBlockingSupport);
}
