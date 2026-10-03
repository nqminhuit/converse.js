import { describe, it, expect } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('Singleton mode', function () {
    it(
        'renders an auto-joined chat with a non-roster JID on a server without blocking support',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            {
                view_mode: 'embedded',
                singleton: true,
                auto_join_private_chats: ['stacea@montague.lit'],
                show_controlbox_by_default: true,
            },
            async function (_converse) {
                // The server answers disco without advertising urn:xmpp:blocking (like our ejabberd).
                await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [{ category: 'server', type: 'IM' }], []);
                await mock.waitForRoster(_converse, 'current', 1);
                const el = await u.waitUntil(() => document.querySelector('converse-chat'));
                expect(el.getAttribute('jid')).toBe('stacea@montague.lit');
                await u.waitUntil(() => u.isVisible(el));
                expect(document.querySelector('converse-controlbox')).toBe(null);
            },
        ),
    );
});
