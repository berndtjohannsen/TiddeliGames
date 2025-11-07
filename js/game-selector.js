// Game selection page logic

// Dummy game data - replace with actual games later
const STRINGS = window.APP_STRINGS;
const GAMES = STRINGS.games.items;

/**
 * Create and display game selection cards
 */
function renderGameGrid() {
    const gameGrid = document.getElementById('game-grid');
    
    if (!gameGrid) {
        console.error('Game grid element not found');
        return;
    }

    // Clear existing content
    gameGrid.innerHTML = '';

    // Create game cards
    GAMES.forEach((game, index) => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 transition-transform';
        card.setAttribute('data-game-id', game.id);
        
        card.innerHTML = `
            <div class="text-6xl mb-4 text-center">${game.icon}</div>
            <h2 class="text-2xl font-bold text-gray-800 mb-2 text-center">${game.name}</h2>
            <p class="text-gray-600 text-center">${game.description}</p>
        `;

        // Add click handler to navigate to game
        card.addEventListener('click', () => {
            window.location.href = game.path;
        });

        gameGrid.appendChild(card);
    });
}

/**
 * Display version number discretely
 */
function displayVersion() {
    const versionDisplay = document.getElementById('version-display');
    
    if (versionDisplay && typeof APP_CONFIG !== 'undefined' && APP_CONFIG.version) {
        versionDisplay.textContent = window.APP_STRINGS.version(APP_CONFIG.version);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    renderGameGrid();
    displayVersion();

    // Inject localized header & install button strings
    const titleEl = document.getElementById('main-title');
    const subtitleEl = document.getElementById('main-subtitle');
    if (titleEl) titleEl.textContent = window.APP_STRINGS.header.title;
    if (subtitleEl) subtitleEl.textContent = window.APP_STRINGS.header.subtitle;

    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.title = window.APP_STRINGS.install.buttonTitle;
        installBtn.setAttribute('aria-label', window.APP_STRINGS.install.buttonTitle);
        const srSpan = installBtn.querySelector('.sr-only');
        if (srSpan) srSpan.textContent = window.APP_STRINGS.install.srLabel;
    }

    const bannerText = document.getElementById('update-banner-text');
    const bannerBtn = document.getElementById('update-reload-btn');
    if (bannerText && !bannerText.textContent) {
        bannerText.textContent = window.APP_STRINGS.update.banner;
    }
    if (bannerBtn && !bannerBtn.textContent) {
        bannerBtn.textContent = window.APP_STRINGS.update.action;
    }
});

