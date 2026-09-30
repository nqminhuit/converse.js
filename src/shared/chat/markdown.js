import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { converse } from '@converse/headless';
import { STACEA_JID } from './identity.js';

const ALLOWED_TAGS = [
    'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre',
    'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
];
const HREF_ATTRIBUTE = 'href';
const REL_ATTRIBUTE = 'rel';
const TARGET_ATTRIBUTE = 'target';
const MAILTO_SCHEME = 'mailto:';
const ALLOWED_ATTR = [HREF_ATTRIBUTE, REL_ATTRIBUTE, TARGET_ATTRIBUTE, 'title'];
const SAFE_SCHEME = /^(?:https?:\/\/|mailto:)/i;

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
        const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return entities[char];
    });
}

function getSafeHref(value) {
    const href = value?.trim();
    if (!href || !SAFE_SCHEME.test(href) || /[\u0000-\u0020\u007f]/.test(href)) {
        return null;
    }
    try {
        const url = new URL(href);
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
            return null;
        }
        if (url.protocol !== MAILTO_SCHEME && (!url.hostname || url.username || url.password)) {
            return null;
        }
        return url.href;
    } catch {
        return null;
    }
}

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: false });
markdown.validateLink = (href) => !!getSafeHref(href);
// Render alt text instead of images so untrusted Markdown cannot fetch remote resources.
markdown.renderer.rules.image = (tokens, index) => escapeHTML(tokens[index].content || '');
markdown.renderer.rules.s_open = () => '<del>';
markdown.renderer.rules.s_close = () => '</del>';
const original_link_open = markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const safe_href = getSafeHref(token.attrGet(HREF_ATTRIBUTE));
    if (!safe_href) {
        return '';
    }
    token.attrSet(HREF_ATTRIBUTE, safe_href);
    if (!safe_href.startsWith(MAILTO_SCHEME)) {
        token.attrSet(TARGET_ATTRIBUTE, '_blank');
        token.attrSet(REL_ATTRIBUTE, 'noopener noreferrer');
    }
    return original_link_open
        ? original_link_open(tokens, index, options, env, self)
        : self.renderToken(tokens, index, options);
};

/** @param {import('@converse/headless').Model} model */
export function isStaceaMarkdownMessage(model) {
    const from = model?.get('from');
    return (
        model?.get('sender') === 'them' &&
        ['chat', 'normal'].includes(model.get('type')) &&
        model.chatbox?.get('jid') === STACEA_JID &&
        from &&
        converse.env.Strophe.getBareJidFromJid(from) === STACEA_JID
    );
}

/** @param {string} text */
export function renderStaceaMarkdown(text) {
    const rendered = markdown.render(text);
    const clean = DOMPurify.sanitize(rendered, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOWED_URI_REGEXP: SAFE_SCHEME,
    });
    const template = document.createElement('template');
    template.innerHTML = clean;
    template.content.querySelectorAll('a').forEach((anchor) => {
        const safe_href = getSafeHref(anchor.getAttribute(HREF_ATTRIBUTE));
        if (!safe_href) {
            anchor.replaceWith(...anchor.childNodes);
            return;
        }
        anchor.setAttribute(HREF_ATTRIBUTE, safe_href);
        if (safe_href.startsWith(MAILTO_SCHEME)) {
            anchor.removeAttribute(TARGET_ATTRIBUTE);
            anchor.removeAttribute(REL_ATTRIBUTE);
        } else {
            anchor.setAttribute(TARGET_ATTRIBUTE, '_blank');
            anchor.setAttribute(REL_ATTRIBUTE, 'noopener noreferrer');
        }
    });
    return template.innerHTML;
}
