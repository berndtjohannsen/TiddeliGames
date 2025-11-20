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

// Version change detection is handled by remoteVersionWatcher below

// Robust remote version check (no-cache) and auto-upgrade flow
(function remoteVersionWatcher() {
    const host = (location && location.hostname) || '';
    // Disable in local development
    if (host === 'localhost' || host === '127.0.0.1') return;

    // Only check automatically on the landing page or once per session (start)
    const path = ((location && location.pathname) || '').toLowerCase();
    const isStartPage = !path.includes('/games/') && (path === '/' || path.endsWith('/index.html') || path === '');
    const versionCheckedKey = 'version_checked_once';
    const alreadyChecked = sessionStorage.getItem(versionCheckedKey) === 'true';

    if (!isStartPage && alreadyChecked) {
        return;
    }
    if (!alreadyChecked) {
        try {
            sessionStorage.setItem(versionCheckedKey, 'true');
        } catch (_) {
            // ignore quota errors
        }
    }

    function toParts(v) {
        const [maj, min, pat] = (v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
        return [maj, min, pat];
    }
    function isGreater(remote, local) {
        const [rM, rm, rp] = toParts(remote);
        const [lM, lm, lp] = toParts(local);
        if (rM !== lM) return rM > lM;
        if (rm !== lm) return rm > lm;
        return rp > lp;
    }

    async function fetchRemoteVersion() {
        try {
            // Bypass service worker and all caches to get fresh version
            const url = `js/config.js?v=${Date.now()}`;
            const resp = await fetch(url, { 
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!resp.ok) return null;
            const text = await resp.text();
            const match = text.match(/version\s*:\s*"([^"]+)"/);
            return match ? match[1] : null;
        } catch (_) {
            return null;
        }
    }

    function showBanner(onConfirm, remoteVersion) {
        const banner = document.getElementById('update-banner');
        const textEl = document.getElementById('update-banner-text');
        const reloadBtn = document.getElementById('update-reload-btn');
        const overlay = document.getElementById('update-overlay');
        if (!banner || !reloadBtn) return;
        if (!banner.classList.contains('hidden')) return; // already shown
        if (textEl) textEl.textContent = `${window.APP_STRINGS.update.banner}${remoteVersion ? ' ' + remoteVersion : ''}`.trim();
        banner.classList.remove('hidden');
        reloadBtn.textContent = window.APP_STRINGS.update.action;
        // Make modal: show overlay and prevent background scroll
        if (overlay) overlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        reloadBtn.setAttribute('autofocus', 'true');
        try { reloadBtn.focus(); } catch(_) {}
        // Only way forward is updating
        reloadBtn.onclick = () => {
            if (overlay) overlay.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            onConfirm && onConfirm();
        };
    }
    
    // Expose for use by pwa.js
    window.showUpdateBannerFromPWA = showBanner;

    async function clearSWAndCaches() {
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister().catch(() => {})));
            }
        } catch (_) {}
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
            }
        } catch (_) {}
    }

    function reloadWithVersion() {
        // Mark that we're updating to prevent immediate re-check after reload
        sessionStorage.setItem('updating_version', Date.now().toString());
        // Reload without leaving a version query parameter in the URL
        const url = new URL(window.location.href);
        url.searchParams.delete('v');
        window.location.replace(url.toString());
    }

    async function checkOnce() {
        // Skip check if we just updated (within last 3 seconds)
        const updatingTimestamp = sessionStorage.getItem('updating_version');
        if (updatingTimestamp) {
            const timeSinceUpdate = Date.now() - parseInt(updatingTimestamp, 10);
            if (timeSinceUpdate < 3000) {
                // Clear the flag after 3 seconds
                setTimeout(() => sessionStorage.removeItem('updating_version'), 3000 - timeSinceUpdate);
                return;
            }
            sessionStorage.removeItem('updating_version');
        }
        
        if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.version) return;
        const localVersion = APP_CONFIG.version;
        const remoteVersion = await fetchRemoteVersion();
        if (!remoteVersion || !isGreater(remoteVersion, localVersion)) return; // never downgrade or equal
        // Remote is greater → prompt user and upgrade deterministically
        showBanner(async () => {
            // Mark that user confirmed the update (for service worker flow)
            if (window.setUserConfirmedUpdate) {
                window.setUserConfirmedUpdate();
            }
            // Hide banner quickly to give feedback
            const banner = document.getElementById('update-banner');
            if (banner) banner.classList.add('hidden');
            await clearSWAndCaches();
            // Small delay to ensure caches are cleared
            await new Promise(resolve => setTimeout(resolve, 100));
            reloadWithVersion();
        }, remoteVersion);
    }

    // Check on app load (covers installed PWAs that open directly)
    function checkOnLoad() {
        // Small delay to ensure APP_CONFIG is loaded
        setTimeout(checkOnce, 1000);
    }

    // Check when app becomes visible (user returns to installed app)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(checkOnce, 500);
        }
    });

    // Also check on first user interaction
    function onFirstGesture() {
        checkOnce();
    }
    window.addEventListener('pointerdown', onFirstGesture, { capture: true, once: true });
    window.addEventListener('keydown', onFirstGesture, { capture: true, once: true });
    window.addEventListener('touchstart', onFirstGesture, { capture: true, once: true });

    // Run check on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkOnLoad);
    } else {
        checkOnLoad();
    }

    // Expose manual trigger if needed
    window.checkForUpdate = checkOnce;
})();

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

