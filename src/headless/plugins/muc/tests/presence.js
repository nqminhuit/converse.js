import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, u } = converse.env;

describe('MUC presence history element', function () {
    it(
        'includes history when maxstanzas is set',
        mock.initConverse(converse, ['statusInitialized'], { muc_history_max_stanzas: 5 }, async function (_converse) {
            const { api } = _converse;
            const muc_jid = 'room@server';
            const nick = 'test';
            const jid = _converse.session.get('jid');
            await mock.openAndEnterMUC(_converse, muc_jid, nick, ['http://jabber.org/protocol/muc']);
            const { sent_stanzas } = _converse.api.connection.get();

            let sent_stanza = await u.waitUntil(() =>
                sent_stanzas
                    .filter((s) => s.nodeName === 'presence' && s.getAttribute('to') === `${muc_jid}/${nick}`)
                    .pop(),
            );
            expect(sent_stanza).toEqualStanza(stx`
              <presence to="${muc_jid}/${nick}"
                    xmlns="jabber:client"
                    id="${sent_stanza.getAttribute('id')}"
                    from="${jid}">
                <x xmlns="http://jabber.org/protocol/muc">
                  <history maxstanzas="5"/>
                </x>
                <c xmlns="http://jabber.org/protocol/caps"
                    hash="sha-1" node="https://conversejs.org"
                    ver="5zO1brYaR4FiLq/GABkMP2fsjf8="/>
              </presence>`);

            api.settings.set('muc_history_max_stanzas', 0);

            const muc2_jid = 'room2@server';
            await mock.openAndEnterMUC(_converse, muc2_jid, nick);
            sent_stanza = await u.waitUntil(() =>
                sent_stanzas
                    .filter((s) => s.nodeName === 'presence' && s.getAttribute('to') === `${muc2_jid}/${nick}`)
                    .pop(),
            );
            expect(sent_stanza).toEqualStanza(stx`
              <presence to="${muc2_jid}/${nick}" xmlns="jabber:client" id="${sent_stanza.getAttribute('id')}" from="${jid}">
                <x xmlns="http://jabber.org/protocol/muc"><history maxstanzas="0"/></x>
                <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="https://conversejs.org" ver="5zO1brYaR4FiLq/GABkMP2fsjf8="/>
              </presence>`);
        }),
    );

    it(
        'excludes the history of a cleared room that has no MAM support',
        mock.initConverse(converse, ['statusInitialized'], { muc_history_max_stanzas: 5 }, async function (_converse) {
            const { api } = _converse;
            const nick = 'test';
            const jid = _converse.session.get('jid');

            // Neither room supports MAM (an explicit feature list, since the default
            // one includes `urn:xmpp:mam:2`), so both would be sent their history back
            // on rejoin - a MAM `start` cutoff can't reach that, so `cleared_at` has
            // to suppress the join history instead.
            const control_jid = 'room@server';
            await mock.openAndEnterMUC(_converse, control_jid, nick, ['http://jabber.org/protocol/muc']);
            const cleared_jid = 'cleared@server';
            await mock.openAndEnterMUC(_converse, cleared_jid, nick, ['http://jabber.org/protocol/muc'], [], true, {
                'cleared_at': '2024-05-06T10:11:12.000Z',
            });

            const { sent_stanzas } = _converse.api.connection.get();
            const joinPresence = (room_jid) =>
                u.waitUntil(() =>
                    sent_stanzas
                        .filter((s) => s.nodeName === 'presence' && s.getAttribute('to') === `${room_jid}/${nick}`)
                        .pop(),
                );

            const control_stanza = await joinPresence(control_jid);
            expect(control_stanza).toEqualStanza(stx`
              <presence to="${control_jid}/${nick}"
                    xmlns="jabber:client"
                    id="${control_stanza.getAttribute('id')}"
                    from="${jid}">
                <x xmlns="http://jabber.org/protocol/muc">
                  <history maxstanzas="5"/>
                </x>
                <c xmlns="http://jabber.org/protocol/caps"
                    hash="sha-1" node="https://conversejs.org"
                    ver="5zO1brYaR4FiLq/GABkMP2fsjf8="/>
              </presence>`);

            const cleared_stanza = await joinPresence(cleared_jid);
            expect(cleared_stanza).toEqualStanza(stx`
              <presence to="${cleared_jid}/${nick}"
                    xmlns="jabber:client"
                    id="${cleared_stanza.getAttribute('id')}"
                    from="${jid}">
                <x xmlns="http://jabber.org/protocol/muc">
                  <history maxstanzas="0"/>
                </x>
                <c xmlns="http://jabber.org/protocol/caps"
                    hash="sha-1" node="https://conversejs.org"
                    ver="5zO1brYaR4FiLq/GABkMP2fsjf8="/>
              </presence>`);
        }),
    );
});
