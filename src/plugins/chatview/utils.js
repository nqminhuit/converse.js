import { __ } from 'i18n';
import { _converse, api } from '@converse/headless';

export function clearHistory (jid) {
    if (location.hash === `converse/chat?jid=${jid}`) {
        history.pushState(null, '', window.location.pathname);
    }
}

export async function clearMessages (chat) {
    const result = await api.confirm(
        __('Confirm'),
        __('Are you sure you want to clear the messages from this conversation?')
    );
    if (result) {
        await chat.clearMessages();
    }
}

// Fork exception for nqminhuit/nuc14ess#205: Stacea is a bot with her own
// slash commands, including an authoritative `/help` (see the `commands`
// object in `apps/stacea/internal/lines/lines.json`). Converse's local
// `/help` menu would shadow hers, so in a 1:1 chat with her `/help` is sent
// as a normal message instead of opening the local menu. Her reply is what
// makes her commands discoverable. All other local commands (`/clear`,
// `/close`) keep working in her chat.
export const STACEA_JID = 'stacea@chit.prud.uk';

export function isStaceaChat (chat) {
    return chat?.get('jid') === STACEA_JID;
}

export async function parseMessageForCommands (chat, text) {
    const match = text.replace(/^\s*/, '').match(/^\/(.*)\s*$/);
    if (match) {
        let handled = false;
        /**
         * *Hook* which allows plugins to add more commands to a chat's textbox.
         * Data provided is the chatbox model and the text typed - {model, text}.
         * Check `handled` to see if the hook was already handled.
         * @event _converse#parseMessageForCommands
         * @example
         *  api.listen.on('parseMessageForCommands', (data, handled) {
         *      if (!handled) {
         *         const command = (data.text.match(/^\/([a-zA-Z]*) ?/) || ['']).pop().toLowerCase();
         *         // custom code comes here
         *      }
         *      return handled;
         *  }
         */
        handled = await api.hook('parseMessageForCommands', { model: chat, text }, handled);
        if (handled) {
            return true;
        }

        if (match[1] === 'clear') {
            clearMessages(chat);
            return true;
        } else if (match[1] === 'close') {
            const { chatboxviews } = _converse.state;
            chatboxviews.get(chat.get('jid'))?.close();
            return true;
        } else if (match[1] === 'help') {
            if (isStaceaChat(chat)) {
                return false; // Let `/help` go to her instead of opening the local menu.
            }
            chat.set({ 'show_help_messages': false }, { 'silent': true });
            chat.set({ 'show_help_messages': true });
            return true;
        }
    }
    return false;
}

export function resetElementHeight (ev) {
    if (window.CSS?.supports('field-sizing', 'content')) {
        return;
    }

    if (ev.target.value) {
        const height = ev.target.scrollHeight + 'px';
        if (ev.target.style.height != height) {
            ev.target.style.height = 'auto';
            ev.target.style.height = height;
        }
    } else {
        ev.target.style = '';
    }
}
