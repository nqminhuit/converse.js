export default class BaseChatView extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        model: {
            state: boolean;
        };
    };
    jid: any;
    model: any;
    viewportMediaQuery: MediaQueryList;
    renderOnViewportChange: () => void;
    /**
     * @param {MouseEvent} ev
     */
    close(ev: MouseEvent): any;
    maybeFocus(): void;
    focus(): this;
    getBottomPanel(): Element;
    onWindowStateChanged(): void;
}
import { CustomElement } from '../components/element.js';
//# sourceMappingURL=baseview.d.ts.map