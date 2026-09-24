# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The root `CLAUDE.md` (a symlink to upstream's `AGENTS.md`) covers commands, architecture and code
style. This file only adds what is specific to this fork.

## Purpose of this fork

A personal reskin of upstream Converse.js (https://github.com/conversejs/converse.js). The fork's
`master` is rebased onto upstream `master` often. Every change must survive those rebases with as few
conflicts as possible.

- Do not edit `AGENTS.md`/`CLAUDE.md`, `CHANGES.md`, `package.json`, the `.po` locale files or the
  shipped theme files unless there is no other option. Upstream changes these constantly.
- Prefer adding new files to editing upstream ones. If you do have to edit an upstream file, keep
  the diff small and local, e.g. one extra `@import` line, not a reformatted block.
- Don't change behaviour, XMPP logic or `src/headless/`. The goal is how the app looks.
- Keep fork commits few and focused so they rebase cleanly: one commit per concern.

## Reskinning strategy

Theming works through CSS custom properties (see `docs/src/content/docs/theming.md`):

- The shipped themes are in `src/shared/styles/themes/*.scss`. Each one is a self-contained rule under
  `&[data-converse-theme='<name>'], &[data-bs-theme='<name>']`, and all of them are imported inside
  the `.conversejs, converse-bg { ... }` block in `src/shared/styles/index.scss`.
- A theme doesn't fall back to `classic`. A variable it leaves out resolves to nothing, and every
  declaration that reads it is dropped. Build a new theme by copying `classic.scss` whole, then set
  `color-scheme: light|dark` in it.
- `converse-root` and `converse-bg` get the theme through `data-converse-theme`, set in
  `src/plugins/rootview/root.js` and `background.js`. The active theme comes from the `theme` setting,
  or from `dark_theme` when the OS prefers dark (`src/plugins/rootview/utils.js`).
- Plugin-specific styles live in `src/plugins/<plugin>/styles/`. Markup is in Lit templates
  (`src/plugins/<plugin>/templates/`, `src/templates/`).

Order of preference for any visual change:
1. Set CSS variables in the skin's theme files (`src/plugins/skin/styles/themes/`).
2. Put override rules in the skin partial that owns that area (see "Skin" below).
3. Edit upstream SCSS or templates only as a last resort, and flag each such edit to the user, since
   it breaks the one-line upstream footprint and is a likely conflict point.

The demo pages set the theme themselves: `dev.html` uses `theme: 'nordic'` and
`dark_theme: 'cyberpunk'`. To preview the skin, use `skin.html` (fullscreen) or `skin-embedded.html`
(inside a resizable dashboard panel) instead of editing `dev.html`.

## Checking a visual change

`npm run devserver` serves on http://localhost:8008 with live reload. For a one-off build, run
`npm run dev`, then `npm run serve`. SCSS goes into the JS bundle, so `dist/` must be rebuilt before a
style change shows up in tests or in the static server.

## Syncing with upstream

`origin` is the fork and `upstream` is conversejs/converse.js (add it with
`git remote add upstream https://github.com/conversejs/converse.js.git` if missing). To sync, run
`git fetch upstream && git rebase upstream/master`, then `git push --force-with-lease origin master`.
After a rebase, rebuild and look over the fork's theme, because upstream may have added CSS variables
that a copied theme doesn't define yet. Diff the skin themes' variable names against the current `classic.scss`:

```bash
diff <(grep -o -- '--[a-z0-9-]*:' src/shared/styles/themes/classic.scss | sort -u) \
     <(grep -o -- '--[a-z0-9-]*:' src/plugins/skin/styles/themes/_skin-light.scss | sort -u)
```

Repeat for `_skin-dark.scss`. Any line starting with `<` is a variable the skin theme must add.

## Skin

The reskin lives in `src/plugins/skin/` as the `converse-skin` plugin. Its only upstream footprint is
one line in `src/index.js`, right after `/* END: Plugins */`:

```js
import './plugins/skin/index.js'; // fork: reskin
```

Do not change any other upstream file (SCSS, templates, JS, `dev.html`, `package.json`,
`vitest.config.js`, `src/shared/constants.js`), except the deliberate exceptions below. The plugin
whitelists itself with `VIEW_PLUGINS.push('converse-skin')`. Fork files outside the plugin are
`skin.html`, `skin-embedded.html` and `.claude/`.

Deliberate exception: `src/shared/components/dropdown.js` also carries a small upstream fix —
`DropdownBase.show()` (`src/shared/components/dropdownbase.js`) only closes a dropdown on an
outside click, so picking a `.dropdown-item` (message actions, heading ☰ menus) ran the action
but left the menu open. `Dropdown.registerEvents()`/`unregisterEvents()` add/remove a bubble-phase
`click` listener that closes it on an item pick instead. Drop this once upstream fixes
`DropdownBase` itself.

Deliberate exception: `src/plugins/rosterview/templates/roster_item.js` also carries a one-line
upstream fix. The roster dot coloured only `online`, `dnd` and `away`, so a contact sending
`<show>chat</show>` ("free for chat") fell through to `chat-status-offline` and looked offline,
although upstream's own profile and occupant templates already treat `chat` as online. Drop this
once upstream's roster item handles `chat` too.

### Rules

- Skin-look rules go under `[data-converse-theme^='skin-']` via `@include skin { ... }` from
  `styles/_mixins.scss`. Theme-independent avatar-size rules use `converse-root.conversejs`. Win on
  specificity, not bundle order; use `!important` only against inline styles.
- Use the tokens in `styles/_tokens.scss` (surfaces, colour, radius, shadow, spacing, type, motion,
  avatars, and the `$skin-narrow` / `$skin-medium` breakpoints). If a token is missing, report it
  rather than editing a file another task owns.
- Only `_motion.scss` adds `transition`, `animation` or `@keyframes`. Only `_responsive.scss` adds
  `@media` or `@container` rules.
- Verify selectors against the real templates (`src/plugins/*/templates`, `src/shared/chat/templates`).

### File ownership

| Task | Files (under `src/plugins/skin/` unless noted) |
| --- | --- |
| T0 scaffold | `index.js`, `styles/index.scss`, `styles/_tokens.scss`, `styles/_mixins.scss`, `tests/scaffold.js`, the `src/index.js` line, `skin.html`, `skin-embedded.html`, `.claude/CLAUDE.md` |
| T1 avatar sizes | `avatar-sizes.js`, `styles/_avatars.scss`, `tests/avatar-sizes.js` |
| T2 themes | `styles/themes/_skin-light.scss`, `styles/themes/_skin-dark.scss` |
| T3 messages | `styles/_messages.scss` |
| T4 composer | `styles/_composer.scss` |
| T5 lists | `styles/_lists.scss` |
| T6 motion | `styles/_motion.scss` |
| T7 responsive and embedded | `styles/_responsive.scss` |
| T8 app chrome | `styles/_chrome.scss` |
| T9 integration | any skin file, for cross-task fixes only; `occupants-autohide.js`, `tests/occupants-autohide.js`, `sidebar-toggle.js`, `tests/sidebar-toggle.js`, `blocklist-menu.js`, `tests/blocklist-menu.js` |

### `avatar_sizes` setting

An object of pixel sizes, merged over the defaults
`{ message: 44, heading: 44, list: 36, occupant: 32, profile: 48 }`. Each key is written to
`--skin-avatar-<key>` on `document.documentElement` and applies under any theme.

### `skin_sidebar_toggle` setting

Defaults to `true`. `sidebar-toggle.js` (added by T9) adds a heading button, in `embedded` and
`fullscreen` view modes under a `skin-*` theme, that hides or shows the controlbox sidebar. It uses
its own persisted flag (`skin_sidebar_hidden` on the controlbox model), not upstream's `closed`
attribute, which those view modes already use for other things. The flag is reflected as
`data-skin-sidebar-hidden` on `converse-root`, which `_responsive.scss` reads to hide `#controlbox`
and let the open chat fill the pane; the button itself is hidden at `$skin-narrow` widths, where T7's
own list/chat toggle takes over. A safety net reopens the sidebar if the last visible chat closes
while it's hidden, so the user is never left with an empty panel. Set to `false` to disable.

### Occupant list auto-hide

`occupants-autohide.js` (added by T9) collapses the MUC occupant list by default when the chat app, not
the viewport, is `$skin-medium` (1024px) wide or less. It only acts under a `skin-*` theme in
`embedded` or `fullscreen` mode. It runs when a room view opens and when a `ResizeObserver` sees the
app shrink from wide to narrow. It never opens the list, so the user's toggle still works.

### Blocklist menu

`blocklist-menu.js` (added by T9) hides the contacts ☰ menu's "Show block list" item when the
server doesn't advertise XEP-0191 blocking (`urn:xmpp:blocking`), mirroring the block/unblock
buttons upstream already hides. It re-checks `api.disco.supports` after connect/reconnect and
reflects the result as `data-skin-no-blocking` on `converse-root` (cleared when supported), the
same pattern as `skin_sidebar_hidden`. `_lists.scss` reads that attribute under any theme, since
this is correctness rather than look.

### Embedding on a dashboard

Build with `npm run build`, then load `dist/converse.min.js` and `dist/converse.min.css`. Put
`<converse-root></converse-root>` inside a container with a set size, then initialize:

```js
converse.initialize({
    view_mode: 'embedded',
    theme: 'skin-light',
    dark_theme: 'skin-dark',
    avatar_sizes: { message: 48, list: 40 },
    /* connection settings */
});
```

### Checks

Run `npm run dev`, then `npx vitest run --project main src/plugins/skin/tests/`, `npm run lint` and
the full `npm test` (the skin loads in every suite). Look at `skin.html` and `skin-embedded.html`
under `npm run devserver` in light and dark. `git fetch upstream && git diff upstream/master --stat`
must show only the one-line `src/index.js` change plus `src/plugins/skin/**`, `skin*.html`,
`.claude/**` and the deliberate exceptions above (`src/shared/components/dropdown.js`,
`src/plugins/rosterview/templates/roster_item.js`).
