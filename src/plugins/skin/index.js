/**
 * Fork reskin: tokens, themes and override styles for a modern messenger look.
 */
import { converse } from '@converse/headless';
import { VIEW_PLUGINS } from 'shared/constants.js';
import { initAvatarSizes } from './avatar-sizes.js';
import { initBlocklistMenu } from './blocklist-menu.js';
import { initOccupantsAutohide } from './occupants-autohide.js';
import { initSidebarToggle } from './sidebar-toggle.js';
import { initThemeToggle } from './theme-toggle.js';
import './styles/index.scss';

// Whitelisted through VIEW_PLUGINS so no upstream constant needs editing.
VIEW_PLUGINS.push('converse-skin');

converse.plugins.add('converse-skin', {
    dependencies: ['converse-rootview', 'converse-chatview', 'converse-muc-views', 'converse-rosterview'],

    initialize() {
        initAvatarSizes();
        initBlocklistMenu();
        initOccupantsAutohide();
        initSidebarToggle();
        initThemeToggle();
    },
});
