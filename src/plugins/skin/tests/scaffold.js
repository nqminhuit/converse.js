import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

describe('The skin scaffold', function () {
    it(
        'registers and initializes the converse-skin plugin',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { pluggable } = _converse;
            expect(pluggable.plugins['converse-skin']).toBeDefined();
            expect(pluggable.initialized_plugins).toContain('converse-skin');
        })
    );

    /**
     * @param {string} theme
     * @param {string} scheme
     */
    function itAppliesTheme(theme, scheme) {
        it(
            `applies the ${theme} theme and its tokens`,
            mock.initConverse(converse, [], { theme }, async () => {
                const root = document.querySelector('converse-root');
                expect(root.getAttribute('data-converse-theme')).toBe(theme);
                const style = getComputedStyle(root);
                expect(style.colorScheme).toBe(scheme);
                // An unresolved var() inside color-mix computes to empty, so this also proves the theme vars exist.
                expect(style.getPropertyValue('--skin-surface-raised').trim()).not.toBe('');
                expect(style.getPropertyValue('--skin-radius-md').trim()).toBe('12px');
            })
        );
    }

    itAppliesTheme('skin-light', 'light');
    itAppliesTheme('skin-dark', 'dark');
});
