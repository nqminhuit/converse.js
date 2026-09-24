/**
 * Applies the `avatar_sizes` setting as `--skin-avatar-*` variables on `<html>`.
 */
// headless re-exports @converse/log; this instance honours the `loglevel` setting.
import { api, log } from '@converse/headless';

const SETTING = 'avatar_sizes';
const MIN_SIZE = 16;
const MAX_SIZE = 128;

/** Each context key, its CSS variable and its default size in pixels. */
const AVATAR_SIZES = Object.freeze({
    message: { variable: '--skin-avatar-message', fallback: 44 },
    heading: { variable: '--skin-avatar-heading', fallback: 44 },
    list: { variable: '--skin-avatar-list', fallback: 36 },
    occupant: { variable: '--skin-avatar-occupant', fallback: 32 },
    profile: { variable: '--skin-avatar-profile', fallback: 48 },
});

/**
 * @returns {Record<string, number>}
 */
function getDefaults() {
    return Object.fromEntries(Object.entries(AVATAR_SIZES).map(([key, { fallback }]) => [key, fallback]));
}

/**
 * Merges the user's value over the defaults, clamping out-of-range sizes and dropping invalid ones.
 * @param {unknown} value
 * @returns {Record<string, number>}
 */
function resolveAvatarSizes(value) {
    const sizes = getDefaults();
    if (value === null || value === undefined) return sizes;
    if (typeof value !== 'object' || Array.isArray(value)) {
        log.warn(`${SETTING}: expected an object, got ${JSON.stringify(value)}; using the defaults`);
        return sizes;
    }
    for (const [key, size] of Object.entries(value)) {
        if (!(key in AVATAR_SIZES)) {
            log.warn(`${SETTING}: ignoring unknown key "${key}"`);
        } else if (typeof size !== 'number' || !Number.isFinite(size)) {
            log.warn(`${SETTING}.${key}: ${JSON.stringify(size)} is not a finite number; using ${sizes[key]}`);
        } else {
            const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
            if (clamped !== size) {
                log.warn(`${SETTING}.${key}: ${size} is outside ${MIN_SIZE}-${MAX_SIZE}; using ${clamped}`);
            }
            sizes[key] = clamped;
        }
    }
    return sizes;
}

function applyAvatarSizes() {
    const sizes = resolveAvatarSizes(api.settings.get(SETTING));
    const { style } = document.documentElement;
    for (const [key, { variable }] of Object.entries(AVATAR_SIZES)) {
        style.setProperty(variable, `${sizes[key]}px`);
    }
}

export function initAvatarSizes() {
    api.settings.extend({ [SETTING]: getDefaults() });
    applyAvatarSizes();
    api.settings.listen.on(`change:${SETTING}`, applyAvatarSizes);
}
