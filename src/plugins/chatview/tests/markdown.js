import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx, u } = converse.env;
const STACEA_JID = 'stacea@chit.prud.uk';

async function addStaceaContact(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    await new Promise((resolve, reject) =>
        _converse.roster.create(
            { jid: STACEA_JID, fullname: 'Stacea', subscription: 'both' },
            { success: resolve, error: reject },
        ),
    );
}

function incomingMessage(_converse, from, body, type = 'chat', extra = '') {
    const { api } = _converse;
    return stx`<message from="${from}"
                    id="${u.getUniqueId()}"
                    to="${api.connection.get().jid}"
                    type="${type}"
                    xmlns="jabber:client">
        <body>${body}</body>
        ${extra}
    </message>`;
}

describe('Stacea Markdown rendering', function () {
    it(
        'renders Markdown from incoming resource-qualified Stacea messages, safely and without changing their text',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await addStaceaContact(_converse);
            await mock.openControlBox(_converse);
            const original = [
                '# A heading',
                '',
                '> Citation text',
                '',
                '- one',
                '- **two** and ~~three~~',
                '',
                '| A | B |',
                '| - | - |',
                `| cell | ${'wide-content-'.repeat(12)} |`,
                '',
                '[safe](https://example.org/path) and https://example.net',
                '',
                '![remote image](https://example.org/image.png)',
                '',
                '```html',
                '<img src=x onerror=alert(1)>',
                '0123456789'.repeat(20),
                '```',
                '',
                '<script>alert(1)</script>',
                '[unsafe](javascript:alert(1))',
                '[obfuscated](java&#x73;cript:alert(1))',
            ].join('\n');
            const delay = stx`<delay xmlns="urn:xmpp:delay" stamp="2026-09-30T12:00:00Z"/>`;
            await _converse.handleMessageStanza(
                incomingMessage(_converse, `${STACEA_JID}/assistant`, original, 'chat', delay),
            );

            const chat = _converse.chatboxes.get(STACEA_JID);
            const view = _converse.chatboxviews.get(STACEA_JID);
            await u.waitUntil(() => view?.querySelector('.stacea-markdown'));
            const body = view.querySelector('.chat-msg__text');

            expect(body.querySelector('h1')?.textContent).toBe('A heading');
            expect(body.querySelector('blockquote')?.textContent).toContain('Citation text');
            expect(body.querySelector('table td')?.textContent).toBe('cell');
            expect(body.querySelector('strong')?.textContent).toBe('two');
            expect(body.querySelector('del')?.textContent).toBe('three');
            expect(body.querySelectorAll('a[href^="https://"]').length).toBe(2);
            expect(body.querySelector('img')).toBeNull();
            expect(body.querySelector('script, [onerror], [style]')).toBeNull();
            expect(body.querySelector('pre code').textContent).toContain('<img src=x onerror=alert(1)>');
            expect(body.textContent).toContain('<script>alert(1)</script>');
            expect(body.querySelectorAll('a[href^="javascript:"]').length).toBe(0);
            expect(body.querySelector('pre')).toBeTruthy();
            body.style.width = '180px';
            const table = body.querySelector('table');
            const code_block = body.querySelector('pre');
            expect(getComputedStyle(table).overflowX).toBe('auto');
            expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);
            expect(code_block.scrollWidth).toBeGreaterThan(code_block.clientWidth);
            expect(chat.messages.at(0).get('message')).toBe(original);

            chat.messages.at(0).save({ body: '# Updated from archive', message: '# Updated from archive' });
            await u.waitUntil(
                () => view.querySelector('.chat-msg__text h1')?.textContent === 'Updated from archive',
            );
            expect(chat.messages.at(0).get('message')).toBe('# Updated from archive');
        }),
    );

    it(
        'does not render Markdown for outgoing messages or messages from other contacts',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await addStaceaContact(_converse);
            await mock.openControlBox(_converse);

            await mock.openChatBoxFor(_converse, STACEA_JID);
            const stacea_chat = _converse.chatboxes.get(STACEA_JID);
            const stacea_view = _converse.chatboxviews.get(STACEA_JID);
            const outgoing = '**outgoing remains literal**';
            await mock.sendMessage(_converse, stacea_view, outgoing);
            expect(stacea_view.querySelector('.chat-msg__text').querySelector('strong')).toBeNull();
            expect(stacea_chat.messages.at(0).get('message')).toBe(outgoing);

            const other_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, other_jid);
            const other_view = _converse.chatboxviews.get(other_jid);
            await _converse.handleMessageStanza(incomingMessage(_converse, other_jid, '**other contact**'));
            await u.waitUntil(() => other_view.querySelector('.chat-msg__text'));
            expect(other_view.querySelector('.chat-msg__text').querySelector('strong')).toBeNull();
        }),
    );

    it(
        'honors message styling opt-outs',
        mock.initConverse(converse, ['chatBoxesFetched'], { allow_message_styling: false }, async function (_converse) {
            await addStaceaContact(_converse);
            await mock.openControlBox(_converse);
            await _converse.handleMessageStanza(incomingMessage(_converse, `${STACEA_JID}/assistant`, '# literal'));
            const view = _converse.chatboxviews.get(STACEA_JID);
            await u.waitUntil(() => view.querySelector('.chat-msg__text'));
            expect(view.querySelector('.stacea-markdown')).toBeNull();
            expect(view.querySelector('.chat-msg__text').textContent).toContain('# literal');
        }),
    );

    it(
        'leaves XEP-0393 unstyled messages unrendered',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await addStaceaContact(_converse);
            await mock.openControlBox(_converse);
            await _converse.handleMessageStanza(
                incomingMessage(
                    _converse,
                    `${STACEA_JID}/assistant`,
                    '**literal Markdown**',
                    'chat',
                    stx`<unstyled xmlns="urn:xmpp:styling:0"/>`,
                ),
            );
            const view = _converse.chatboxviews.get(STACEA_JID);
            await u.waitUntil(() => view.querySelector('.chat-msg__text'));
            expect(view.querySelector('.stacea-markdown')).toBeNull();
            expect(view.querySelector('.chat-msg__text').querySelector('strong')).toBeNull();
        }),
    );
});
