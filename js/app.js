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
        document.querySelectorAll('script[src]').forEach((script) => {
            const src = script.getAttribute('src');
            if (src && !src.includes('config.js')) {
                script.setAttribute('src', bust(src));
            }
        });
    } catch (_) {
        // no-op
    }
})();

// Prevent accidental pull-to-refresh (especially on iOS Safari and Android Chrome)
(function preventPullToRefresh() {
    let maybePrevent = false;
    let lastTouchY = 0;
    const THRESHOLD = 12;

    function shouldPrevent() {
        const scrollElement = document.scrollingElement || document.documentElement;
        return (window.scrollY || (scrollElement && scrollElement.scrollTop) || 0) <= 0;
    }

    window.addEventListener('touchstart', (event) => {
        if (event.touches.length !== 1) {
            maybePrevent = false;
            return;
        }
        lastTouchY = event.touches[0].clientY;
        maybePrevent = shouldPrevent();
    }, { passive: false });

    window.addEventListener('touchmove', (event) => {
        if (!maybePrevent) {
            return;
        }
        if (event.touches.length !== 1) {
            maybePrevent = false;
            return;
        }

        const currentY = event.touches[0].clientY;
        const isPullingDown = currentY - lastTouchY > THRESHOLD;

        if (isPullingDown) {
            event.preventDefault();
        } else if (currentY < lastTouchY) {
            // User scrolled up, allow future pull-to-refresh when reaching top again
            maybePrevent = false;
        }
    }, { passive: false });
})();

// Version change detection: js/version-check.js (hub + games)

// Clean up any lingering ?v=... query parameter from previous updates
(function stripVersionQueryFromUrl() {
    try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('v')) {
            url.searchParams.delete('v');
            // Use history API to avoid a second reload
            window.history.replaceState({}, document.title, url.toString());
        }
    } catch (_) {
        // no-op
    }
})();

