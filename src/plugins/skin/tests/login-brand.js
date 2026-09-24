import { page } from 'vitest/browser';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

// A real embedded panel (e.g. a 420px dashboard sidebar) sits inside a normal-width viewport;
// it's the container, not the viewport, that's narrow. A narrow *viewport* would also trip
// upstream's own `@media (max-width: 480px)` rules, which a desktop dashboard never hits, so the
// container is constrained directly instead, mirroring sidebar-toggle.js's wide-viewport setup.
const NARROW_CONTAINER_WIDTH = 360;

/**
 * @param {string} theme
 */
function itFitsBrandHeaderInNarrowPanel(theme) {
    it(
        `keeps the login brand header inside a ${NARROW_CONTAINER_WIDTH}px embedded panel under ${theme}`,
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            { auto_login: false, allow_registration: false, theme, view_mode: 'embedded' },
            async function (_converse) {
                mock.toggleControlBox(_converse);
                const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));

                const app = document.querySelector('converse-app-chat.converse-embedded');
                app.style.width = `${NARROW_CONTAINER_WIDTH}px`;
                await u.waitUntil(() => Math.abs(app.getBoundingClientRect().width - NARROW_CONTAINER_WIDTH) < 1);

                const brand = await u.waitUntil(() => cbview.querySelector('.brand-heading'));
                const wrapper = await u.waitUntil(() => cbview.querySelector('.brand-name-wrapper'));
                await u.waitUntil(() => wrapper.getBoundingClientRect().width > 0);

                const app_rect = app.getBoundingClientRect();
                const wrapper_rect = wrapper.getBoundingClientRect();

                // The wordmark used to inherit an un-wrapped, doubly-compounded font-size
                // that made it far wider than its container; it must now fit inside it.
                expect(wrapper_rect.width).toBeLessThanOrEqual(app_rect.width);
                expect(wrapper_rect.right).toBeLessThanOrEqual(app_rect.right);
                expect(brand.scrollWidth).toBeLessThanOrEqual(brand.clientWidth);
            },
        ),
    );
}

describe('The skin login brand header', function () {
    beforeAll(async () => {
        // Wide viewport: only the app container (set per-test) is narrow, as in a real dashboard.
        await page.viewport(1280, 900);
    });

    afterAll(async () => {
        await page.viewport(414, 896);
    });

    itFitsBrandHeaderInNarrowPanel('skin-light');
    itFitsBrandHeaderInNarrowPanel('skin-dark');
});
