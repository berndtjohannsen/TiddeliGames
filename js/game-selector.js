// Game selection page logic

// Dummy game data - replace with actual games later
const GAMES = [
    {
        id: 'game1',
        name: 'Number Pop',
        description: 'Tap the numbers 1 to 10 as fast as you can!',
        path: 'games/game1/index.html',
        icon: '🎈'
    },
    {
        id: 'game2',
        name: 'Game 2',
        description: 'Second exciting game',
        path: 'games/game2/index.html',
        icon: '🎯'
    },
    {
        id: 'game3',
        name: 'Game 3',
        description: 'Third amazing game',
        path: 'games/game3/index.html',
        icon: '🎲'
    },
    {
        id: 'game4',
        name: 'Game 4',
        description: 'Fourth wonderful game',
        path: 'games/game4/index.html',
        icon: '🎨'
    },
    {
        id: 'game5',
        name: 'Game 5',
        description: 'Fifth fantastic game',
        path: 'games/game5/index.html',
        icon: '🎪'
    },
    {
        id: 'game6',
        name: 'Game 6',
        description: 'Sixth great game',
        path: 'games/game6/index.html',
        icon: '🎭'
    }
];

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
    GAMES.forEach(game => {
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
        versionDisplay.textContent = `Version ${APP_CONFIG.version}`;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    renderGameGrid();
    displayVersion();
});

