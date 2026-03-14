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
})();

