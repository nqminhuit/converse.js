/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The slash-command typeahead source, shared by every rich composer: typing
 * `/cl` when the whole composer is a command offers the matching commands and
 * picking one replaces the trigger with the command plus a trailing space.
 *
 * The menu opens only when `/...` is the entire message, exactly matching
 * parseMessageForCommands semantics (see `plugins/chatview/utils.js`), so no
 * popups appear inside URLs or words like `and/or`.
 */
import { __ } from 'i18n';
import { isStaceaChat } from 'plugins/chatview/utils.js';

const COMMAND_QUERY = /^\/([A-Za-z0-9_-]*)$/;

/**
 * Snapshot of Stacea's backend commands (see the `commands` object in
 * `apps/stacea/internal/lines/lines.json` in the nuc14ess repo). Hardcoded on
 * purpose: her commands change rarely, so no live fetch.
 */
const STACEA_COMMAND_NAMES = [
    'avatar',
    'help',
    'mode',
    'refresh',
    'relax',
    'remind',
    'reminders',
    'status',
    'talk',
    'tools',
    'unremind',
    'work',
];

/**
 * One-liners for the 1:1 local commands, reusing the help-menu strings in
 * `plugins/chatview/chat.js#getHelpMessages`.
 */
function getChatDetails () {
    return {
        'clear': __('Remove messages'),
        'close': __('Close this chat'),
        'help': __('Show this menu'),
        'me': __('Write in the third person'),
    };
}

/**
 * One-liners for MUC commands, reusing the help-menu strings in
 * `plugins/muc-views/chatarea.js#getHelpMessages`.
 */
function getMUCDetails () {
    return {
        'admin': __("Change user's affiliation to admin"),
        'ban': __('Ban user by changing their affiliation to outcast'),
        'clear': __('Clear the chat area'),
        'close': __('Close this groupchat'),
        'deop': __('Change user role to participant'),
        'destroy': __('Remove this groupchat'),
        'help': __('Show this menu'),
        'kick': __('Kick user from groupchat'),
        'me': __('Write in 3rd person'),
        'member': __('Grant membership to a user'),
        'modtools': __('Opens up the moderator tools GUI'),
        'mute': __("Remove user's ability to post messages"),
        'nick': __('Change your nickname'),
        'op': __('Grant moderator role to user'),
        'owner': __('Grant ownership of this groupchat'),
        'register': __('Register your nickname'),
        'revoke': __("Revoke the user's current affiliation"),
        'subject': __('Set groupchat subject'),
        'topic': __('Set groupchat subject (alias for /subject)'),
        'voice': __('Allow muted user to post messages'),
    };
}

/**
 * One-liners for Stacea's commands. Local `/clear` and `/close` keep working
 * in her chat; `/help` goes to her instead of opening the local menu.
 */
function getStaceaDetails () {
    return {
        'avatar': __('change my avatar: /avatar, /avatar N, /avatar list'),
        'clear': __('Remove messages'),
        'close': __('Close this chat'),
        'help': __('this list'),
        'mode': __('behavior: /mode normal|office|sexy'),
        'refresh': __('start fresh: I forget our chat so far'),
        'relax': __('availability: off work, still the same tools and routing'),
        'remind': __('set a reminder: /remind 30m stretch'),
        'reminders': __('list pending reminders'),
        'status': __('my health: models, usage, limits, errors'),
        'talk': __('inference route: /talk to show, /talk private|free|public to change'),
        'tools': __('list the tools I can use right now'),
        'unremind': __('cancel one: /unremind 3'),
        'work': __('availability: back to work, still the same tools and routing'),
    };
}

/**
 * The commands offered for `model`: Stacea's snapshot plus clear/close in her
 * chat, the room's allowed commands in a MUC, otherwise the 1:1 locals.
 * @param {any} model - The chatbox or MUC model behind the composer.
 * @returns {{ name: string, detail: string }[]}
 */
function getCommandsForModel (model) {
    if (!model) {
        return [];
    }
    if (typeof model.getAllowedCommands === 'function') {
        const details = getMUCDetails();
        // Upstream lists /nick twice for owner-moderators, dedupe for the menu.
        const names = [...new Set(model.getAllowedCommands())];
        return names.map((name) => ({ 'name': name, 'detail': details[name] || '' }));
    }
    if (isStaceaChat(model)) {
        const details = getStaceaDetails();
        const names = [...STACEA_COMMAND_NAMES, 'clear', 'close'].sort();
        return names.map((name) => ({ 'name': name, 'detail': details[name] || '' }));
    }
    const details = getChatDetails();
    return Object.keys(details)
        .sort()
        .map((name) => ({ 'name': name, 'detail': details[name] }));
}

/**
 * Build the slash-command source for one composer.
 * @param {() => any} getModel - The chatbox or MUC model behind the composer.
 * @returns {import('./types').TypeaheadSource}
 */
export function makeCommandsSource (getModel) {
    return {
        'kind': 'commands',

        getQuery: (handle) => {
            const text = handle?.getMarkdown?.() ?? null;
            if (typeof text !== 'string') {
                return null;
            }
            return text.match(COMMAND_QUERY)?.[1] ?? null;
        },

        /** @param {string} query */
        getItems (query) {
            const commands = getCommandsForModel(getModel());
            const q = query.toLowerCase();
            const ranked = [];
            for (const command of commands) {
                const idx = command.name.toLowerCase().indexOf(q);
                if (idx !== -1) {
                    ranked.push({ 'command': command, 'idx': idx });
                }
            }
            ranked.sort(
                (a, b) => a.idx - b.idx || (a.command.name < b.command.name ? -1 : 1),
            );
            // No cap: the menu scrolls (see `TypeaheadController#revealActive`),
            // so a bare `/` must show every match instead of silently hiding some.
            return ranked.map(({ command }) => ({
                'label': `/${command.name}`,
                'detail': command.detail,
                'name': command.name,
            }));
        },

        // A trailing space, so arguments can follow straight on.
        choose: (handle, query, item) => handle?.replaceTrigger(`/${query}`, `/${item.name} `),
    };
}
