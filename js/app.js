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

// Detect version change and prompt user to reload
(function handleVersionChange() {
    try {
        if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.version) return;
        const STORAGE_KEY = 'tiddeligames.version';
        const current = APP_CONFIG.version;
        const previous = localStorage.getItem(STORAGE_KEY);

        if (previous && previous !== current) {
            // Show banner and let user reload
            const banner = document.getElementById('update-banner');
            const reloadBtn = document.getElementById('update-reload-btn');
            if (banner && reloadBtn) {
                banner.classList.remove('hidden');
                reloadBtn.onclick = () => window.location.reload();
            }
        }

        // Store current version for next launch comparison
        localStorage.setItem(STORAGE_KEY, current);
    } catch (_) {
        // no-op
    }
})();

