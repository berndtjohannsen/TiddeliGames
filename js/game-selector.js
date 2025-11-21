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
        card.className = 'bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 transition-transform relative';
        card.setAttribute('data-game-id', game.id);
        
        const gameNumber = index + 1; // Game numbers start at 1
        
        card.innerHTML = `
            <div class="absolute top-3 left-3 text-xs text-gray-400">${gameNumber}</div>
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


/**
 * Show help dialog
 */
function showHelpDialog() {
    const helpDialog = document.getElementById('help-dialog');
    const helpOverlay = document.getElementById('help-overlay');
    const helpContent = document.getElementById('help-content');
    
    if (helpDialog && helpContent) {
        const helpData = window.APP_STRINGS?.help;
        const helpText = helpData?.text || 'Hjälptext kommer här...';
        const helpImage = helpData?.image;
        
        // Format text with line breaks and links
        let formattedText = helpText
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
            .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
            .replace(/\n/g, '<br>');
        
        // Build content with image if available
        let contentHTML = `<div class="space-y-4">${formattedText}</div>`;
        
        if (helpImage) {
            contentHTML = `
                <div class="space-y-4">
                    ${formattedText}
                    <div class="mt-4 flex justify-center">
                        <img src="${helpImage}" alt="Hjälp" class="max-w-full h-auto rounded-lg shadow-md">
                    </div>
                </div>
            `;
        }
        
        helpContent.innerHTML = contentHTML;
        
        helpDialog.classList.remove('hidden');
        if (helpOverlay) helpOverlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        
        // Focus the close button for accessibility
        const closeBtn = document.getElementById('help-close-btn');
        if (closeBtn) closeBtn.focus();
    }
}

/**
 * Hide help dialog
 */
function hideHelpDialog() {
    const helpDialog = document.getElementById('help-dialog');
    const helpOverlay = document.getElementById('help-overlay');
    
    if (helpDialog) {
        helpDialog.classList.add('hidden');
        if (helpOverlay) helpOverlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
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

    // Set up help button
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', showHelpDialog);
    }

    // Set up help dialog close buttons
    const helpCloseBtn = document.getElementById('help-close-btn');
    const helpOverlay = document.getElementById('help-overlay');
    
    if (helpCloseBtn) {
        helpCloseBtn.addEventListener('click', hideHelpDialog);
    }
    
    if (helpOverlay) {
        helpOverlay.addEventListener('click', hideHelpDialog);
    }

    // Close help dialog on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const helpDialog = document.getElementById('help-dialog');
            if (helpDialog && !helpDialog.classList.contains('hidden')) {
                hideHelpDialog();
            }
        }
    });
});

