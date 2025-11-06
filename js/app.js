// Main app logic

// Cache-bust static assets by app version from APP_CONFIG
(function cacheBustStaticAssets() {
    try {
        if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.version) return;
        const version = APP_CONFIG.version;
        const bust = (url) => url && !url.includes('v=') ? (url + (url.includes('?') ? '&' : '?') + 'v=' + version) : url;

        // Stylesheets
        document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
            const href = link.getAttribute('href');
            if (href) link.setAttribute('href', bust(href));
        });
        // If you add external scripts later, apply the same pattern for <script src> tags
    } catch (_) {
        // no-op
    }
})();

