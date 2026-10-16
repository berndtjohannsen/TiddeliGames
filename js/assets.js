'use strict';

/**
 * Global helper for resolving asset URLs for both local development and production.
 *
 * - In production we typically use APP_CONFIG.assetBaseUrl pointing at the Netlify assets site.
 * - In local development we prefer the workspace folder /TiddeliGames-assets so we don't need
 *   to duplicate assets inside each game's directory.
 */
(function () {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) return;

    const locationHost = (window.location && window.location.hostname) || '';
    const isLocalHost = locationHost === 'localhost' || locationHost === '127.0.0.1';

    const configBase = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.assetBaseUrl) || '';

    // Local dev: use the workspace assets folder directly
    // Production: use APP_CONFIG.assetBaseUrl (typically the Netlify assets domain)
    let baseUrl = configBase;
    if (isLocalHost) {
        baseUrl = '/TiddeliGames-assets';
    }

    function joinUrl(base, path) {
        if (!base) return path.replace(/^\.?\//, '');
        const cleanBase = base.replace(/\/+$/, '');
        const cleanPath = path.replace(/^\.?\//, '');
        return `${cleanBase}/${cleanPath}`;
    }

    function resolveGameAsset(gameId, relativePath) {
        const cleanPath = String(relativePath || '').replace(/^\.?\//, '');
        if (!baseUrl) return cleanPath;
        return joinUrl(baseUrl, `games/${gameId}/${cleanPath}`);
    }

    function resolveSharedAsset(relativePath) {
        const cleanPath = String(relativePath || '').replace(/^\.?\//, '');
        if (!baseUrl) return cleanPath;
        return joinUrl(baseUrl, `assets/${cleanPath}`);
    }

    window.TiddeliAssets = Object.freeze({
        getBaseUrl: () => baseUrl,
        resolveGameAsset,
        resolveSharedAsset
    });

    /**
     * Prefer portrait on phones/tablets.
     * - PWA manifest uses orientation: portrait when installed
     * - Screen Orientation API lock when the browser allows it (often fullscreen/PWA)
     * - If still landscape on a touch device, CSS shows a “turn your phone” overlay
     */
    function tryLockPortrait() {
        const orientation = window.screen && window.screen.orientation;
        if (!orientation || typeof orientation.lock !== 'function') return;
        orientation.lock('portrait').catch(() => {
            // Not allowed in many browser tabs; overlay CSS covers that case
        });
    }

    function ensurePortraitLockOverlay() {
        // Clear any leftover force-portrait rotation from the previous approach
        const root = document.documentElement;
        root.classList.remove('tiddeli-force-portrait');
        root.style.removeProperty('--tiddeli-portrait-width');
        root.style.removeProperty('--tiddeli-portrait-height');

        if (document.getElementById('portrait-lock-overlay')) return;

        const message =
            (window.APP_STRINGS &&
                window.APP_STRINGS.orientation &&
                window.APP_STRINGS.orientation.rotate) ||
            'Vänd telefonen';

        const overlay = document.createElement('div');
        overlay.id = 'portrait-lock-overlay';
        overlay.className = 'portrait-lock-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-live', 'polite');
        overlay.setAttribute('aria-label', message);
        overlay.innerHTML =
            '<div class="portrait-lock-overlay__icon" aria-hidden="true">📱</div>' +
            '<p class="portrait-lock-overlay__text"></p>';
        overlay.querySelector('.portrait-lock-overlay__text').textContent = message;
        document.body.appendChild(overlay);
        document.body.classList.add('portrait-lock-active');
    }

    function initPortraitPreference() {
        ensurePortraitLockOverlay();
        tryLockPortrait();

        // Lock often requires a user gesture outside installed/fullscreen mode
        const onGesture = () => tryLockPortrait();
        ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
            window.addEventListener(eventName, onGesture, { capture: true, once: true });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPortraitPreference);
    } else {
        initPortraitPreference();
    }
})();

