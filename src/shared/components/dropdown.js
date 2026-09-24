/**
 * @typedef {module:dom-navigator.DOMNavigatorOptions} DOMNavigatorOptions
 */
import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { api, constants, u } from '@converse/headless';
import { DOMNavigator } from '../dom-navigator/index.js';
import DropdownBase from 'shared/components/dropdownbase.js';
import 'shared/components/icons.js';
import { __ } from 'i18n';

import './styles/dropdown.scss';

const { KEYCODES } = constants;

export default class Dropdown extends DropdownBase {
    static get properties() {
        return {
            icon_classes: { type: String },
            items: { type: Array },
        };
    }

    constructor() {
        super();
        this.icon_classes = 'fa fa-bars';
        /** @type {any[]} */ this.items = [];
        this.id = u.getUniqueId();
    }

    render() {
        return html`
            <button class="btn btn--transparent btn--standalone dropdown-toggle dropdown-toggle--no-caret"
                    id="${this.id}"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded="false"
                    aria-label=${__('Menu')}>
                <converse-icon aria-hidden="true" size="1em" class="${this.icon_classes}">
            </button>
            <ul class="dropdown-menu" aria-labelledby="${this.id}">
                ${/** @type {any[]} */ (this.items).map((b) => html`<li>${until(b, '')}</li>`)}
            </ul>
        `;
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.initArrowNavigation();
    }

    connectedCallback() {
        super.connectedCallback();
        this.registerEvents();
    }

    disconnectedCallback() {
        this.disableArrowNavigation();
        super.disconnectedCallback();
    }

    registerEvents() {
        this._onKeyDown = /** @param {KeyboardEvent} ev */ (ev) => this.#onKeyDown(ev);
        this._onDropdownHide = () => this.#onDropdownHide();
        // DropdownBase.show() only closes on an outside click; close on an item pick too.
        this._onItemClick = /** @param {MouseEvent} ev */ (ev) => this.#onItemClick(ev);
        this.addEventListener('converse:dropdown:hide', this._onDropdownHide);
        this.addEventListener('keydown', this._onKeyDown);
        this.addEventListener('click', this._onItemClick);
    }

    unregisterEvents() {
        this.removeEventListener('keydown', this._onKeyDown);
        this.removeEventListener('converse:dropdown:hide', this._onDropdownHide);
        this.removeEventListener('click', this._onItemClick);
    }

    #onDropdownHide() {
        this.disableArrowNavigation();
    }

    /**
     * Bubble phase, so the item's own `@click` handler (e.g. Copy, Add Reaction) has
     * already run by the time this fires.
     * @param {MouseEvent} ev
     */
    #onItemClick(ev) {
        const item = /** @type {HTMLButtonElement} */ (
            /** @type {HTMLElement} */ (ev.target)?.closest?.('.dropdown-item')
        );
        if (!item || item.disabled || item.classList.contains('disabled') || !this.menu?.contains(item)) return;
        if (!this.menu.classList.contains('show')) return;
        this.hide();
    }

    initArrowNavigation() {
        if (!this.navigator) {
            const options = /** @type DOMNavigatorOptions */ ({
                selector: '.dropdown-menu li',
                onSelected: /** @param {HTMLElement} el */ (el) => el.focus(),
            });
            this.navigator = new DOMNavigator(/** @type HTMLElement */ (this.menu), options);
        }
    }

    disableArrowNavigation() {
        this.navigator?.disable();
    }

    /**
     * @param {KeyboardEvent} [ev]
     */
    enableArrowNavigation(ev) {
        ev?.preventDefault();
        ev?.stopPropagation();
        this.disableArrowNavigation();
        this.navigator.enable();
        this.navigator.select(/** @type HTMLElement */ (this.menu.firstElementChild));
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onEnterPressed(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.navigator.selected?.querySelector('a')?.click();
        this.hide();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    #onKeyDown(ev) {
        if (!this.navigator || !u.isVisible(this)) return;

        if (ev.key === KEYCODES.ENTER) {
            this.onEnterPressed(ev);
        } else if (ev.key === KEYCODES.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        } else if (ev.key === KEYCODES.ESCAPE) {
            this.hide();
        }
    }
}

api.elements.define('converse-dropdown', Dropdown);
