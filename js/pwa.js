// Service Worker registration and install prompt handling

let deferredPrompt = null;

/**
 * Check if app is already installed
 */
function checkIfInstalled() {
    // Check if running as standalone (installed PWA)
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

/**
 * Handle the beforeinstallprompt event
 * This is fired when the browser thinks the app is installable
 */
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default mini-infobar from appearing
    e.preventDefault();
    
    // Save the event so it can be triggered later
    deferredPrompt = e;
    
    // Show install button if app is not already installed
    if (!checkIfInstalled()) {
        showInstallButton();
    }
});

/**
 * Show the install button
 */
function showInstallButton() {
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
    }
}

/**
 * Hide the install button
 */
function hideInstallButton() {
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.classList.add('hidden');
    }
}

/**
 * Handle install button click
 */
function handleInstallClick() {
    if (!deferredPrompt) {
        return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        
        // Clear the deferred prompt
        deferredPrompt = null;
        hideInstallButton();
    });
}

/**
 * Register Service Worker
 */
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Disable Service Worker in local development to avoid stale caches and confusing upgrades
    const host = (location && location.hostname) || '';
    if (host === 'localhost' || host === '127.0.0.1') {
        console.log('[PWA] SW disabled on localhost');
        return;
    }
    try {
        // Register relative to current origin to work with Live Server and GitHub Pages
        const registration = await navigator.serviceWorker.register('sw.js');
        console.log('Service Worker registered successfully:', registration);

        // If there's an updated SW waiting, request immediate activation
        if (registration.waiting) {
            registration.waiting.postMessage('SKIP_WAITING');
        }

        // Detect a new installing SW and request activation when installed
        registration.addEventListener('updatefound', () => {
            const newSW = registration.installing;
            if (!newSW) return;
            newSW.addEventListener('statechange', () => {
                if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                    // Show update banner and let user trigger reload
                    showUpdateBanner(() => {
                        newSW.postMessage('SKIP_WAITING');
                    });
                }
            });
        });

        // Reload once the new SW takes control (only when user accepted in our flow)
        let didRefresh = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (didRefresh) return;
            didRefresh = true;
            window.location.reload();
        });
    } catch (error) {
        console.error('Service Worker registration failed:', error);
    }
}

// Use the showBanner function from app.js instead of duplicating
// This function is kept for service worker update notifications but delegates to app.js
function showUpdateBanner(onReloadRequested) {
    // Delegate to the main showBanner function in app.js if available
    if (window.showUpdateBannerFromPWA) {
        window.showUpdateBannerFromPWA(onReloadRequested, 'New version available');
    } else {
        // Fallback if app.js hasn't loaded yet
        const banner = document.getElementById('update-banner');
        const textEl = document.getElementById('update-banner-text');
        const reloadBtn = document.getElementById('update-reload-btn');
        const overlay = document.getElementById('update-overlay');
        if (!banner || !reloadBtn) return;
        if (textEl) textEl.textContent = 'New version available';
        banner.classList.remove('hidden');
        reloadBtn.textContent = 'Update now';
        if (overlay) overlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        reloadBtn.onclick = () => {
            banner.classList.add('hidden');
            if (overlay) overlay.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            try { onReloadRequested && onReloadRequested(); } catch (_) {}
        };
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if already installed
    if (checkIfInstalled()) {
        hideInstallButton();
    }

    // Set up install button click handler
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', handleInstallClick);
    }

    // Register Service Worker
    registerServiceWorker();
});

// Handle app installed event (user installed via browser UI)
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    deferredPrompt = null;
    hideInstallButton();
});

