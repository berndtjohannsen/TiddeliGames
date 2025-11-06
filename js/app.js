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

// Robust remote version check (no-cache) and auto-upgrade flow
(function remoteVersionWatcher() {
    const VERSION_CHECK_INTERVAL_MS = 60 * 1000; // 60s

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
            const url = `js/config.js?v=${Date.now()}`; // hard bust any caches/CDN
            const resp = await fetch(url, { cache: 'no-store' });
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
        if (!banner || !reloadBtn) return;
        if (!banner.classList.contains('hidden')) return; // already shown
        if (textEl) textEl.textContent = `New version ${remoteVersion} available. Updating soon…`;
        banner.classList.remove('hidden');
        reloadBtn.textContent = 'Update now';
        reloadBtn.onclick = onConfirm;
        // Auto-update after 5 seconds if user does not click
        setTimeout(() => {
            try { onConfirm && onConfirm(); } catch (_) {}
        }, 5000);
    }

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

    function reloadWithVersion(version) {
        const url = new URL(window.location.href);
        url.searchParams.set('v', version);
        window.location.replace(url.toString());
    }

    async function checkOnce() {
        if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.version) return;
        const localVersion = APP_CONFIG.version;
        const remoteVersion = await fetchRemoteVersion();
        if (!remoteVersion || !isGreater(remoteVersion, localVersion)) return; // never downgrade or equal
        // Remote is greater → prompt user and upgrade deterministically
        showBanner(async () => {
            // Hide banner quickly to give feedback
            const banner = document.getElementById('update-banner');
            if (banner) banner.classList.add('hidden');
            await clearSWAndCaches();
            reloadWithVersion(remoteVersion);
        }, remoteVersion);
    }

    // Initial check shortly after load, then periodic checks
    window.addEventListener('load', () => {
        setTimeout(checkOnce, 500);
        setInterval(checkOnce, VERSION_CHECK_INTERVAL_MS);
    });
})();

