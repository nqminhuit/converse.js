import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * Open a 1:1 chat and wait until its rich composer is on screen.
 * @param {any} _converse
 * @param {string} jid
 */
async function openChat (_converse, jid) {
    const view = await mock.openChatBoxFor(_converse, jid);
    await u.waitUntil(() => view.querySelector('.chat-rich__editable'));
    const form = mock.getMessageForm(view);
    await form.ensureEditor();
    view.querySelector('.chat-rich__editable').focus();
    return view;
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

/** The detail text for the row labelled `label`. */
function detailFor (view, label) {
    const rows = Array.from(view.querySelectorAll('.rich-ac .rich-ac__item'));
    const row = rows.find((r) => r.querySelector('.rich-ac__label')?.textContent.trim() === label);
    return row?.querySelector('.rich-ac__detail')?.textContent.trim() ?? '';
}

describe('Slash-command suggestions in 1:1 chats', function () {
    it(
        'lists the local commands on a bare /',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await openChat(_converse, contact_jid);

            await typeIntoComposer(view, '/');
            expect(suggestions(view)).toEqual(['/clear', '/close', '/help', '/me']);
        }),
    );

    it(
        'narrows to clear and close on /cl and inserts with a trailing space',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await openChat(_converse, contact_jid);

            await typeIntoComposer(view, '/cl');
            expect(suggestions(view)).toEqual(['/clear', '/close']);

            const form = mock.getMessageForm(view);
            form.typeahead.choose(0);
            await u.waitUntil(() => form.rawText() === '/clear ');
        }),
    );

    it(
        'does not offer commands mid-message',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await openChat(_converse, contact_jid);

            await typeIntoComposer(view, 'a/b');
            expect(suggestions(view)).toEqual([]);

            await typeIntoComposer(view, 'and/or');
            expect(suggestions(view)).toEqual([]);

            await typeIntoComposer(view, 'hello /clear');
            expect(suggestions(view)).toEqual([]);
        }),
    );

    it(
        'suggests Stacea commands plus clear and close in her chat',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const stacea_jid = 'stacea@chit.prud.uk';
            _converse.state.roster.create({ 'jid': stacea_jid, 'subscription': 'both' });
            const view = await openChat(_converse, stacea_jid);

            await typeIntoComposer(view, '/');
            expect(suggestions(view)).toEqual([
                '/avatar',
                '/clear',
                '/close',
                '/credit',
                '/help',
                '/refresh',
                '/relax',
                '/remind',
                '/reminders',
                '/status',
                '/talk',
                '/tools',
                '/unremind',
                '/work',
            ]);

            await typeIntoComposer(view, '/too');
            expect(suggestions(view)).toEqual(['/tools']);

            await typeIntoComposer(view, '/stat');
            expect(suggestions(view)).toEqual(['/status']);

            await typeIntoComposer(view, '/');
            expect(detailFor(view, '/help')).toBe('this list');
            expect(detailFor(view, '/work')).toBe('availability: back to work, still the same tools and routing');
            expect(detailFor(view, '/relax')).toBe('availability: off work, still the same tools and routing');
            expect(detailFor(view, '/talk')).toBe('/talk to show, /talk private|free|public|sexy to change');
            expect(detailFor(view, '/credit')).toBe('paid providers out of credit: /credit, /credit reset <provider> after a top-up');
        }),
    );

    it(
        'runs an exact match on a single Enter but only completes a partial one',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await openChat(_converse, contact_jid);
            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));

            await typeIntoComposer(view, '/clear');
            expect(suggestions(view)).toEqual(['/clear']);
            await mock.pressComposerKey(view, 'Enter');
            await u.waitUntil(() => _converse.api.confirm.calls.count() === 1);

            _converse.api.confirm.calls.reset();
            await typeIntoComposer(view, '/clea');
            expect(suggestions(view)).toEqual(['/clear']);
            await mock.pressComposerKey(view, 'Enter');
            const form = mock.getMessageForm(view);
            await u.waitUntil(() => form.rawText() === '/clear ');
            expect(_converse.api.confirm.calls.count()).toBe(0);
        }),
    );
});
