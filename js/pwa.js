// Service Worker registration and install prompt handling

let deferredPrompt = null;
let isInstalled = false;

/**
 * Check if app is already installed
 */
function checkIfInstalled() {
    // Check if running as standalone (installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        isInstalled = true;
        return true;
    }
    return false;
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
    if ('serviceWorker' in navigator) {
        try {
            // Register relative to current origin to work with Live Server
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered successfully:', registration);
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
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
    isInstalled = true;
    deferredPrompt = null;
    hideInstallButton();
});

