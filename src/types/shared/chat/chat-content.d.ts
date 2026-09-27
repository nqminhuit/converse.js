/**
 * Implements a virtualized list of chat messages, which means only a subset of
 * messages, the `WINDOW_SIZE`, gets rendered to the DOM, and this subset
 * gets updated as the user scrolls up and down.
 */
export default class ChatContent extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        window_top: {
            state: boolean;
        };
        window_bottom: {
            state: boolean;
        };
    };
    model: any;
    scroll_debounce: number;
    window_top: number;
    window_bottom: number;
    scrollHandler: (ev: Event) => void;
    /**
     * The number of messages the user hasn't seen yet, as shown on the
     * scroll-down button's badge.
     * @returns {number}
     */
    get unreadCount(): number;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1> | "";
    scrollDown(): Promise<void>;
    /**
     * Called when the user clicks the button which appears once they've
     * scrolled up, to return them to the newest message.
     * @param {Event} [ev]
     */
    scrollToLatest(ev?: Event): void;
    #private;
}
import { CustomElement } from "../components/element.js";
//# sourceMappingURL=chat-content.d.ts.map