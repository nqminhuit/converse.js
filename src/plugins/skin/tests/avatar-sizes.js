import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx, u } = converse.env;

const VARIABLES = {
    message: '--skin-avatar-message',
    heading: '--skin-avatar-heading',
    list: '--skin-avatar-list',
    occupant: '--skin-avatar-occupant',
    profile: '--skin-avatar-profile',
};

// How far (in px) the status dot may overhang the avatar's bottom-right corner.
const DOT_TOLERANCE = 4;

/** @returns {Record<string, string>} */
function readSizes() {
    const { style } = document.documentElement;
    return Object.fromEntries(Object.entries(VARIABLES).map(([key, name]) => [key, style.getPropertyValue(name)]));
}

/**
 * @param {Element} avatar
 * @param {Element} dot
 */
function expectDotOnBottomRight(avatar, dot) {
    const a = avatar.getBoundingClientRect();
    const d = dot.getBoundingClientRect();
    expect(d.width).toBeGreaterThan(0);
    // Overlaps the avatar and ends at (or just past) its bottom-right corner.
    expect(d.left).toBeLessThan(a.right);
    expect(d.top).toBeLessThan(a.bottom);
    expect(Math.abs(d.right - a.right)).toBeLessThanOrEqual(DOT_TOLERANCE);
    expect(Math.abs(d.bottom - a.bottom)).toBeLessThanOrEqual(DOT_TOLERANCE);
}

/**
 * @param {any} _converse
 * @param {string} contact_jid
 * @param {string} body
 */
function receiveMessage(_converse, contact_jid, body) {
    _converse.handleMessageStanza(stx`
        <message from="${contact_jid}"
                 to="${_converse.api.connection.get().jid}"
                 type="chat"
                 id="${u.getUniqueId()}"
                 xmlns="jabber:client">
            <body>${body}</body>
        </message>`);
}

describe('The avatar_sizes setting', function () {
    afterEach(() => {
        Object.values(VARIABLES).forEach((name) => document.documentElement.style.removeProperty(name));
    });

    it(
        'applies the default sizes',
        mock.initConverse(converse, [], {}, async () => {
            expect(readSizes()).toEqual({
                message: '44px',
                heading: '44px',
                list: '36px',
                occupant: '32px',
                profile: '48px',
            });
        }),
    );

    it(
        'merges a partial override over the defaults',
        mock.initConverse(converse, [], { avatar_sizes: { message: 60, list: 40 } }, async () => {
            expect(readSizes()).toEqual({
                message: '60px',
                heading: '44px',
                list: '40px',
                occupant: '32px',
                profile: '48px',
            });
        }),
    );

    it(
        'clamps out-of-range sizes and falls back on invalid ones',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const warn = vi.spyOn(converse.env.log, 'warn');
            _converse.api.settings.set('avatar_sizes', {
                message: 'big',
                heading: NaN,
                list: -5,
                occupant: 1000,
                bogus: 50,
            });
            expect(readSizes()).toEqual({
                message: '44px',
                heading: '44px',
                list: '16px',
                occupant: '128px',
                profile: '48px',
            });
            expect(warn).toHaveBeenCalledTimes(5);

            warn.mockClear();
            _converse.api.settings.set('avatar_sizes', 'huge');
            expect(readSizes().message).toBe('44px');
            expect(warn).toHaveBeenCalledOnce();
            warn.mockRestore();
        }),
    );

    it(
        'updates the variables when the setting changes at runtime',
        mock.initConverse(converse, [], {}, async (_converse) => {
            _converse.api.settings.set('avatar_sizes', { heading: 64, profile: 72 });
            expect(readSizes()).toEqual({
                message: '44px',
                heading: '64px',
                list: '36px',
                occupant: '32px',
                profile: '72px',
            });
        }),
    );

    [32, 64].forEach((size) => {
        it(
            `sizes message avatars to ${size}px and keeps follow-ups aligned`,
            mock.initConverse(
                converse,
                ['chatBoxesFetched'],
                { avatar_sizes: { message: size } },
                async (_converse) => {
                    await mock.waitForRoster(_converse, 'current', 1);
                    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);

                    receiveMessage(_converse, contact_jid, 'First');
                    receiveMessage(_converse, contact_jid, 'Second');
                    await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
                    await u.waitUntil(() => view.querySelector('.chat-msg--followup'));

                    const avatar = view.querySelector('converse-chat-message converse-avatar .avatar-initials');
                    const rect = avatar.getBoundingClientRect();
                    expect(rect.width).toBe(size);
                    expect(rect.height).toBe(size);

                    const [first, followup] = view.querySelectorAll('.chat-msg__content');
                    expect(followup.closest('.chat-msg').classList).toContain('chat-msg--followup');
                    const offset = followup.getBoundingClientRect().left - first.getBoundingClientRect().left;
                    expect(Math.abs(offset)).toBeLessThanOrEqual(1);
                },
            ),
        );

        it(
            `keeps the roster status dot on a ${size}px avatar`,
            mock.initConverse(converse, [], { avatar_sizes: { list: size } }, async (_converse) => {
                await mock.openControlBox(_converse);
                await mock.waitForRoster(_converse, 'current', 1);
                const jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('presence', 'online');

                const rosterview = document.querySelector('converse-roster');
                const dot = await u.waitUntil(() =>
                    rosterview.querySelector('.chat-status--avatar[color="var(--chat-status-online)"]'),
                );
                const avatar = dot.parentElement.querySelector('converse-avatar .avatar-initials');
                expect(avatar.getBoundingClientRect().width).toBe(size);
                expectDotOnBottomRight(avatar, dot);
            }),
        );

        it(
            `keeps the occupant status dot on a ${size}px avatar`,
            mock.initConverse(converse, [], { avatar_sizes: { occupant: size } }, async (_converse) => {
                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);
                // Headless Chromium starts with the occupant sidebar hidden.
                if (view.model.get('hidden_occupants')) view.model.save('hidden_occupants', false);

                const item = await u.waitUntil(() => view.querySelector('converse-muc-occupant-list-item'));
                const dot = await u.waitUntil(() => item.querySelector('.chat-status--avatar'));
                const avatar = item.querySelector('converse-avatar .avatar-initials');
                expect(avatar.getBoundingClientRect().width).toBe(size);
                expectDotOnBottomRight(avatar, dot);
            }),
        );
    });
});
