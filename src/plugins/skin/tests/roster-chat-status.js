import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * Upstream fix carried by `roster_item.js` (see `.claude/CLAUDE.md`): a contact sending
 * `<show>chat</show>` ("free for chat") must show the same online colour as `online`,
 * not fall through to offline.
 */
describe('A roster contact who is free to chat', function () {
    it(
        'has their status dot shown as online',
        mock.initConverse(converse, [], { lazy_load_vcards: false }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const icon_el = await u.waitUntil(() =>
                document.querySelector('converse-roster-contact converse-icon'),
            );
            expect(icon_el.getAttribute('color')).toBe('var(--chat-status-offline)');

            const pres = stx`<presence from="mercutio@montague.lit/resource" xmlns="jabber:client"><show>chat</show></presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, pres));
            await u.waitUntil(() => icon_el.getAttribute('color') === 'var(--chat-status-online)');
        }),
    );
});
