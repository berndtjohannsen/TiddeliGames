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
     * - Otherwise CSS-rotate the page so gameplay stays portrait (no “turn phone” message)
     */
    function tryLockPortrait() {
        const orientation = window.screen && window.screen.orientation;
        if (!orientation || typeof orientation.lock !== 'function') return;
        orientation.lock('portrait').catch(() => {
            // Not allowed in many browser tabs — CSS force-portrait handles that
        });
    }

    function isTouchLikeDevice() {
        try {
            return window.matchMedia('(hover: none)').matches;
        } catch (_) {
            return 'ontouchstart' in window;
        }
    }

    function isLandscapeViewport() {
        try {
            return window.matchMedia('(orientation: landscape)').matches;
        } catch (_) {
            return window.innerWidth > window.innerHeight;
        }
    }

    /**
     * When the device is sideways, keep a portrait-sized layout via CSS rotation.
     * Sets pixel sizes so 100vh-based game layouts still fill the “tall” axis.
     */
    function syncForcedPortraitLayout() {
        const force = isTouchLikeDevice() && isLandscapeViewport();
        const root = document.documentElement;
        root.classList.toggle('tiddeli-force-portrait', force);

        if (force) {
            // After 90° rotation: layout width = device height, layout height = device width
            const portraitWidth = window.innerHeight;
            const portraitHeight = window.innerWidth;
            root.style.setProperty('--tiddeli-portrait-width', `${portraitWidth}px`);
            root.style.setProperty('--tiddeli-portrait-height', `${portraitHeight}px`);
            // Many games use --actual-vh for full-height wrappers in standalone mode
            root.style.setProperty('--actual-vh', `${portraitHeight}px`);
        } else {
            root.style.removeProperty('--tiddeli-portrait-width');
            root.style.removeProperty('--tiddeli-portrait-height');
        }

        tryLockPortrait();
    }

    function initPortraitPreference() {
        syncForcedPortraitLayout();
        window.addEventListener('resize', syncForcedPortraitLayout);
        window.addEventListener('orientationchange', () => {
            // Wait a tick for iOS to settle the new viewport size
            window.setTimeout(syncForcedPortraitLayout, 50);
            window.setTimeout(syncForcedPortraitLayout, 300);
        });

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

