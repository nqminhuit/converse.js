import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, u, sizzle, dayjs, Strophe } = converse.env;

describe("MAM queries for a conversation whose cache is empty", function () {
    /**
     * Opens a 1:1 chat, waits for the server's MAM support to be known, optionally
     * marks the conversation as cleared, and returns the next MAM query the client
     * sends (which is what a page reload triggers).
     *
     * @param {any} _converse
     * @param {string} [cleared_at] ISO timestamp of a user-initiated clear.
     * @returns {Promise<Element>}
     */
    async function nextMAMQuery(_converse, cleared_at) {
        const jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
        await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);

        const chat = await _converse.api.chats.open(jid);
        await chat.messages.fetched;
        if (cleared_at) {
            chat.set('cleared_at', cleared_at);
        }
        expect(chat.messages.length).toBe(0);

        // Spy only now, so that opening the chat doesn't itself produce the query
        // we're interested in.
        let sent_stanza, IQ_id;
        const sendIQ = _converse.api.connection.get().sendIQ;
        spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
            sent_stanza = iq;
            IQ_id = sendIQ.bind(this)(iq, callback, errback);
        });

        chat.afterMessagesFetched();
        await u.waitUntil(() => sent_stanza);
        return sent_stanza;
    }

    it(
        "asks the archive only for messages from after the conversation was cleared",
        mock.initConverse(converse, ['chatBoxesInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 2);
            const cleared_at = '2024-05-06T10:11:12.000Z';
            const sent_stanza = await nextMAMQuery(_converse, cleared_at);

            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(stx`
                <iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <x type="submit" xmlns="jabber:x:data">
                            <field type="hidden" var="FORM_TYPE">
                                <value>urn:xmpp:mam:2</value>
                            </field>
                            <field var="with">
                                <value>${mock.cur_names[0].replace(/ /g, '.').toLowerCase()}@montague.lit</value>
                            </field>
                            <field var="start">
                                <value>${dayjs(cleared_at).toISOString()}</value>
                            </field>
                        </x>
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <before></before>
                            <max>50</max>
                        </set>
                    </query>
                </iq>`);
        }),
    );

    it(
        'asks the archive for the last page when the conversation was never cleared',
        mock.initConverse(converse, ['chatBoxesInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 2);
            const sent_stanza = await nextMAMQuery(_converse);

            // No `start` field at all: an empty cache must still be treated as an
            // empty conversation, so the archive can hand back its last page.
            expect(sent_stanza.querySelector('field[var="start"]')).toBe(null);

            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(stx`
                <iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <x type="submit" xmlns="jabber:x:data">
                            <field type="hidden" var="FORM_TYPE">
                                <value>urn:xmpp:mam:2</value>
                            </field>
                            <field var="with">
                                <value>${mock.cur_names[0].replace(/ /g, '.').toLowerCase()}@montague.lit</value>
                            </field>
                        </x>
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <before></before>
                            <max>50</max>
                        </set>
                    </query>
                </iq>`);
        }),
    );

    it(
        'asks the archive of a cleared room only for messages from after the clear',
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 2);
            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            const cleared_at = '2024-05-06T10:11:12.000Z';

            // Entering the room queries its archive, which is the reload path for a MUC.
            await mock.openAndEnterMUC(_converse, muc_jid, nick, mock.default_muc_features, [], true, {
                'cleared_at': cleared_at,
            });
            const model = _converse.chatboxes.get(muc_jid);
            expect(model.messages.length).toBe(0);

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const sent_stanza = await u.waitUntil(() =>
                sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop(),
            );

            // Groupchat queries are addressed to the room and carry no `with` field.
            expect(sent_stanza.getAttribute('to')).toBe(muc_jid);
            expect(sent_stanza.querySelector('field[var="with"]')).toBe(null);

            const queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(sent_stanza).toEqualStanza(stx`
                <iq id="${sent_stanza.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <query queryid="${queryid}" xmlns="urn:xmpp:mam:2">
                        <x type="submit" xmlns="jabber:x:data">
                            <field type="hidden" var="FORM_TYPE">
                                <value>urn:xmpp:mam:2</value>
                            </field>
                            <field var="start">
                                <value>${dayjs(cleared_at).toISOString()}</value>
                            </field>
                        </x>
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <before></before>
                            <max>50</max>
                        </set>
                    </query>
                </iq>`);
        }),
    );
});
