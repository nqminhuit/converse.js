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
// Stacea only: `/talk pu`, `/avatar sexy o`. Group 1 is the words before the last space.
const ARG_QUERY = /^\/((?:[A-Za-z0-9_-]+ )+)([A-Za-z0-9_-]*)$/;

/**
 * Snapshot of Stacea's backend commands (see the `commands` object in
 * `apps/stacea/internal/lines/lines.json` in the nuc14ess repo) and, in
 * `STACEA_ARGS`, the argument words her parsers accept. Hardcoded on
 * purpose: her commands change rarely, so no live fetch.
 */
const STACEA_COMMAND_NAMES = [
    'avatar',
    'credit',
    'help',
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

/** Argument words per command path (lowercase, space-joined), in menu-neutral order. */
const STACEA_ARGS = {
    'talk': [
        { 'name': 'private', 'detail': __('local plus approved zero-retention cloud routes') },
        { 'name': 'free', 'detail': __('approved zero-cost routes') },
        { 'name': 'public', 'detail': __('any approved cloud route') },
        { 'name': 'sexy', 'detail': __('private and local only') },
        { 'name': 'confirm', 'detail': __('answer a pending switch') },
        { 'name': 'cancel', 'detail': __('answer a pending switch') },
    ],
    'avatar': [
        { 'name': 'list', 'detail': __('list my photos') },
        { 'name': 'sexy', 'detail': __('sexy photos opt-in: on, confirm, off') },
    ],
    'avatar sexy': [
        { 'name': 'on', 'detail': __('ask to allow sexy photos') },
        { 'name': 'confirm', 'detail': __('confirm within 2 minutes') },
        { 'name': 'off', 'detail': __('stop using sexy photos') },
    ],
    'credit': [{ 'name': 'reset', 'detail': __('after a top-up: /credit reset <provider>') }],
    'credit reset': [
        { 'name': 'deepinfra', 'detail': __('DeepInfra') },
        { 'name': 'opencode', 'detail': __('OpenCode Zen') },
    ],
};

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
        'credit': __('paid providers out of credit: /credit, /credit reset <provider> after a top-up'),
        'help': __('this list'),
        'refresh': __('start fresh: I forget our chat so far'),
        'relax': __('availability: off work, still the same tools and routing'),
        'remind': __('set a reminder: /remind 30m stretch'),
        'reminders': __('list pending reminders'),
        'status': __('my health: models, usage, limits, errors'),
        'talk': __('/talk to show, /talk private|free|public|sexy to change'),
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
 * Argument items for a `path prefix` query (see `getQuery`).
 * @param {string} query
 */
function getArgItems (query) {
    const q = query.toLowerCase();
    const at = q.lastIndexOf(' ');
    const path = q.slice(0, at).trim().split(/ +/).join(' ');
    const prefix = q.slice(at + 1);
    const options = STACEA_ARGS[path] ?? [];
    // A fully typed leaf closes the menu, even if it is a substring of another option,
    // so Enter sends it instead of completing to that other option.
    if (options.some((o) => o.name === prefix && !Object.hasOwn(STACEA_ARGS, `${path} ${o.name}`))) {
        return [];
    }
    const ranked = [];
    for (const option of options) {
        const idx = option.name.indexOf(prefix);
        if (idx !== -1) {
            ranked.push({ option, idx });
        }
    }
    ranked.sort((a, b) => a.idx - b.idx || (a.option.name < b.option.name ? -1 : 1));
    return ranked.map(({ option }) => ({
        'label': `/${path} ${option.name}`,
        'detail': option.detail,
        'name': `${path} ${option.name}`,
    }));
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
            const name = text.match(COMMAND_QUERY)?.[1];
            if (name !== undefined) {
                return name;
            }
            const args = isStaceaChat(getModel()) ? text.match(ARG_QUERY) : null;
            if (!args) {
                return null;
            }
            const path = args[1].trim().toLowerCase().split(/ +/).join(' ');
            // Raw case: `choose` must find this exact text in the composer.
            return Object.hasOwn(STACEA_ARGS, path) ? `${args[1]}${args[2]}` : null;
        },

        /** @param {string} query */
        getItems (query) {
            if (query.includes(' ')) {
                return getArgItems(query);
            }
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

        // A command name gets a trailing space so arguments can follow; an argument only
        // when it has options of its own, so a finished command is left ready to send.
        choose: (handle, query, item) => {
            const isArg = item.name.includes(' ');
            const next = !isArg || Object.hasOwn(STACEA_ARGS, item.name) ? ' ' : '';
            return handle?.replaceTrigger(`/${query}`, `/${item.name}${next}`);
        },
    };
}
