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
1. Set CSS variables in the fork's own theme file(s), added next to the shipped themes plus one import
   line in `src/shared/styles/index.scss`.
2. Put override rules in a fork-owned SCSS file, imported once, rather than editing plugin SCSS.
3. Edit upstream SCSS or templates only as a last resort, and flag each such edit to the user, since
   it is a likely conflict point.

The demo pages set the theme themselves: `dev.html` uses `theme: 'nordic'` and
`dark_theme: 'cyberpunk'`. To preview a fork theme, change the setting locally in `dev.html`, or in a
separate untracked copy of it.

## Checking a visual change

`npm run devserver` serves on http://localhost:8008 with live reload. For a one-off build, run
`npm run dev`, then `npm run serve`. SCSS goes into the JS bundle, so `dist/` must be rebuilt before a
style change shows up in tests or in the static server.

## Syncing with upstream

This clone has only `origin` (the fork). Add upstream once with
`git remote add upstream https://github.com/conversejs/converse.js.git`. To sync, run
`git fetch upstream && git rebase upstream/master`, then `git push --force-with-lease origin master`.
After a rebase, rebuild and look over the fork's theme, because upstream may have added CSS variables
that a copied theme doesn't define yet. Diff the fork theme's variables against the current `classic.scss`.
