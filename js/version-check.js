'use strict';

/**
 * Remote version check for browser and installed PWA users.
 * Fetches fresh js/config.js, prompts to reload, clears SW + Cache API storage.
 * Injects update banner DOM on game pages that lack the hub markup.
 */
(function remoteVersionWatcher() {
    const host = (location && location.hostname) || '';
    if (host === 'localhost' || host === '127.0.0.1') return;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return;

    function ensureUpdateBannerDom() {
        if (document.getElementById('update-banner')) return;

        const overlay = document.createElement('div');
        overlay.id = 'update-overlay';
        overlay.className = 'hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]';
        document.body.appendChild(overlay);

        const banner = document.createElement('div');
        banner.id = 'update-banner';
        banner.className =
            'hidden fixed top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur border border-gray-200 shadow-lg rounded-full px-4 py-2 text-sm text-gray-700 flex items-center gap-3 z-[110] max-w-[calc(100vw-1rem)] box-border';
        banner.innerHTML =
            '<span id="update-banner-text"></span>' +
            '<button type="button" id="update-reload-btn" class="text-blue-600 hover:text-blue-800 font-medium border-none bg-transparent outline-none focus:outline-none focus:ring-0 p-0 cursor-pointer"></button>';
        document.body.appendChild(banner);
    }

    function toParts(v) {
        const [maj, min, pat] = (v || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
        return [maj, min, pat];
    }

    function isGreater(remote, local) {
        const [rM, rm, rp] = toParts(remote);
        const [lM, lm, lp] = toParts(local);
        if (rM !== lM) return rM > lM;
        if (rm !== lm) return rm > lm;
        return rp > lp;
    }

    async function fetchRemoteConfigVersions() {
        try {
            const configPath = document.querySelector('script[src*="config.js"]');
            const base = configPath ? configPath.getAttribute('src').replace(/[^/]*$/, '') : 'js/';
            const url = `${base}config.js?v=${Date.now()}`;
            const resp = await fetch(url, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!resp.ok) return null;
            const text = await resp.text();
            const versionMatch = text.match(/version\s*:\s*"([^"]+)"/);
            const assetMatch = text.match(/assetVersion\s*:\s*"([^"]+)"/);
            return {
                version: versionMatch ? versionMatch[1] : null,
                assetVersion: assetMatch ? assetMatch[1] : null
            };
        } catch (_) {
            return null;
        }
    }

    function showBanner(onConfirm, remoteVersion) {
        ensureUpdateBannerDom();
        const banner = document.getElementById('update-banner');
        const textEl = document.getElementById('update-banner-text');
        const reloadBtn = document.getElementById('update-reload-btn');
        const overlay = document.getElementById('update-overlay');
        if (!banner || !reloadBtn) return;
        if (!banner.classList.contains('hidden')) return;

        const strings = window.APP_STRINGS && window.APP_STRINGS.update;
        const bannerText = (strings && strings.banner) || 'Ny version!';
        const actionText = (strings && strings.action) || 'Uppdatera';
        if (textEl) {
            textEl.textContent = `${bannerText}${remoteVersion ? ' ' + remoteVersion : ''}`.trim();
        }
        banner.classList.remove('hidden');
        reloadBtn.textContent = actionText;
        if (overlay) overlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        reloadBtn.onclick = () => {
            if (overlay) overlay.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            if (onConfirm) onConfirm();
        };
    }

    window.showUpdateBannerFromPWA = showBanner;

    async function clearSWAndCaches() {
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
            }
        } catch (_) {}
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
            }
        } catch (_) {}
    }

    function reloadWithVersion() {
        sessionStorage.setItem('updating_version', Date.now().toString());
        const url = new URL(window.location.href);
        url.searchParams.delete('v');
        window.location.replace(url.toString());
    }

    async function checkOnce() {
        const updatingTimestamp = sessionStorage.getItem('updating_version');
        if (updatingTimestamp) {
            const timeSinceUpdate = Date.now() - parseInt(updatingTimestamp, 10);
            if (timeSinceUpdate < 3000) {
                setTimeout(
                    () => sessionStorage.removeItem('updating_version'),
                    Math.max(0, 3000 - timeSinceUpdate)
                );
                return;
            }
            sessionStorage.removeItem('updating_version');
        }

        if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.version) return;
        const localVersion = APP_CONFIG.version;
        const localAssetVersion = APP_CONFIG.assetVersion || localVersion;
        const remote = await fetchRemoteConfigVersions();
        if (!remote || !remote.version) return;

        const remoteVersion = remote.version;
        const remoteAssetVersion = remote.assetVersion || remoteVersion;
        const appOutdated = isGreater(remoteVersion, localVersion);
        const assetsOutdated = isGreater(remoteAssetVersion, localAssetVersion);
        if (!appOutdated && !assetsOutdated) return;

        const label = appOutdated ? remoteVersion : remoteAssetVersion;

        showBanner(async () => {
            if (window.setUserConfirmedUpdate) {
                window.setUserConfirmedUpdate();
            }
            const banner = document.getElementById('update-banner');
            if (banner) banner.classList.add('hidden');
            await clearSWAndCaches();
            await new Promise((resolve) => setTimeout(resolve, 100));
            reloadWithVersion();
        }, label);
    }

    window.checkForUpdate = checkOnce;

    function scheduleCheck() {
        setTimeout(checkOnce, 800);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleCheck);
    } else {
        scheduleCheck();
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(checkOnce, 400);
        }
    });

    function onFirstGesture() {
        checkOnce();
    }
    window.addEventListener('pointerdown', onFirstGesture, { capture: true, once: true });
    window.addEventListener('keydown', onFirstGesture, { capture: true, once: true });
    window.addEventListener('touchstart', onFirstGesture, { capture: true, once: true });
})();
