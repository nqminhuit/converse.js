import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const muc_jid = 'lounge@montague.lit';

/**
 * Enter a MUC and wait until its rich composer is on screen.
 * @param {any} _converse
 */
async function enterMUC (_converse) {
    const model = await mock.openAndEnterMUC(_converse, muc_jid, 'tom');
    const view = _converse.chatboxviews.get(muc_jid);
    await u.waitUntil(() => view.querySelector('.chat-rich__editable'));
    const form = mock.getMessageForm(view);
    await form.ensureEditor();
    view.querySelector('.chat-rich__editable').focus();
    return { model, view };
}

/**
 * Type `text` into the composer and let the typeahead react.
 * @param {any} view
 * @param {string} text
 */
async function typeIntoComposer (view, text) {
    await mock.setComposerText(view, text);
    await mock.getMessageForm(view).typeahead.update();
    await mock.getMessageForm(view).updateComplete;
}

/** The labels currently offered by the typeahead menu. */
function suggestions (view) {
    return Array.from(view.querySelectorAll('.rich-ac .rich-ac__label')).map((el) => el.textContent.trim());
}

describe('Slash-command suggestions in MUCs', function () {
    it(
        'lists the allowed participant commands on a bare /',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { model, view } = await enterMUC(_converse);
            const occupant = model.occupants.findWhere({ 'jid': _converse.bare_jid });
            occupant.set({ 'affiliation': 'member', 'role': 'participant' });

            await typeIntoComposer(view, '/');
            expect(suggestions(view)).toEqual(['/clear', '/help', '/me', '/nick', '/register']);
        }),
    );

    it(
        'narrows to /clear on /cl and inserts with a trailing space',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { model, view } = await enterMUC(_converse);
            const occupant = model.occupants.findWhere({ 'jid': _converse.bare_jid });
            occupant.set({ 'affiliation': 'member', 'role': 'participant' });

            await typeIntoComposer(view, '/cl');
            expect(suggestions(view)).toEqual(['/clear']);

            const form = mock.getMessageForm(view);
            form.typeahead.choose(0);
            await u.waitUntil(() => form.rawText() === '/clear ');
        }),
    );

    it(
        'does not offer commands mid-message',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view } = await enterMUC(_converse);

            await typeIntoComposer(view, 'a/b');
            expect(suggestions(view)).toEqual([]);
        }),
    );

    it(
        'honours muc_disable_slash_commands filtering',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { 'muc_disable_slash_commands': ['nick'] },
            async function (_converse) {
                const { model, view } = await enterMUC(_converse);
                const occupant = model.occupants.findWhere({ 'jid': _converse.bare_jid });
                occupant.set({ 'affiliation': 'member', 'role': 'participant' });

                await typeIntoComposer(view, '/');
                expect(suggestions(view)).toEqual(['/clear', '/help', '/me', '/register']);
            },
        ),
    );

    it(
        'honours role filtering for moderator commands',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { model, view } = await enterMUC(_converse);
            const occupant = model.occupants.findWhere({ 'jid': _converse.bare_jid });
            occupant.set({ 'affiliation': 'member', 'role': 'participant' });

            await typeIntoComposer(view, '/mu');
            expect(suggestions(view)).toEqual([]);

            occupant.set({ 'role': 'moderator' });
            await typeIntoComposer(view, '/mu');
            expect(suggestions(view)).toEqual(['/mute']);
        }),
    );

    it(
        'lists the full allowed list for an owner on a bare /',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view } = await enterMUC(_converse);

            await typeIntoComposer(view, '/');
            expect(suggestions(view)).toEqual([
                '/admin',
                '/ban',
                '/clear',
                '/deop',
                '/destroy',
                '/help',
                '/kick',
                '/me',
                '/member',
                '/modtools',
                '/mute',
                '/nick',
                '/op',
                '/owner',
                '/register',
                '/revoke',
                '/subject',
                '/topic',
                '/voice',
            ]);
        }),
    );
});
