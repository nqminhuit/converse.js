import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * Opens the contacts ☰ dropdown and returns it, its "Show block list" item and one other
 * always-present item, so a test can compare their visibility.
 * @param {any} _converse
 */
async function openContactsDropdown(_converse) {
    await mock.openControlBox(_converse);
    const rosterview = await u.waitUntil(() => document.querySelector('converse-roster'));
    const dropdown = await u.waitUntil(() => rosterview.querySelector('.dropdown--contacts'));
    dropdown.querySelector('.dropdown-toggle').click();
    await u.waitUntil(() => dropdown.querySelector('.dropdown-menu').classList.contains('show'));

    const blocklist_item = dropdown.querySelector('converse-icon.fa-list-ul')?.closest('.dropdown-item');
    const other_item = dropdown.querySelector('.add-contact');
    return { dropdown, blocklist_item, other_item };
}

describe('The contacts menu\'s "Show block list" item', function () {
    it(
        'is hidden when the server does not advertise XEP-0191 blocking support',
        mock.initConverse(converse, [], {}, async (_converse) => {
            await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [{ category: 'server', type: 'IM' }], []);
            await mock.waitForRoster(_converse, 'current', 0);

            const { blocklist_item, other_item } = await openContactsDropdown(_converse);
            await u.waitUntil(() => getComputedStyle(blocklist_item).display === 'none');
            expect(getComputedStyle(other_item).display).not.toBe('none');
            expect(document.querySelector('converse-root').hasAttribute('data-skin-no-blocking')).toBe(true);
        }),
    );

    it(
        'stays visible when the server advertises XEP-0191 blocking support, clearing any earlier no-support state',
        mock.initConverse(converse, [], {}, async (_converse) => {
            // Simulates a stale no-support state (e.g. from a previous session) that a fresh,
            // supported disco response must clear.
            document.querySelector('converse-root').setAttribute('data-skin-no-blocking', '');

            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await u.waitUntil(() => !document.querySelector('converse-root').hasAttribute('data-skin-no-blocking'));

            const { blocklist_item, other_item } = await openContactsDropdown(_converse);
            expect(getComputedStyle(blocklist_item).display).not.toBe('none');
            expect(getComputedStyle(other_item).display).not.toBe('none');
        }),
    );
});
