window.APP_STRINGS = Object.freeze({
    update: {
        banner: 'Ny version!',
        action: 'Uppdatera'
    },
    install: {
        buttonTitle: 'Installera app',
        srLabel: 'Installera app'
    },
    header: {
        title: 'TiddeliGames',
        subtitle: 'Välj ett spel!'
    },
    games: {
        items: [
            {
                id: 'game1',
                name: 'Sifferpop',
                description: 'Siffrorna 1 till 10. (3+ år)',            
                icon: '🎈',
                path: 'games/game1/index.html'
            },
            {
                id: 'game2',
            name: 'Djurljud',
            description: 'Lyssna på djuren. (1+ år)',
            icon: '🐾',
                path: 'games/game2/index.html'
            },
            {
                id: 'game3',
                name: 'Räkna frukter',
                description: 'Räkna frukterna. (3+ år)',
                icon: '🍎',
                path: 'games/game3/index.html'
            },
            {
                id: 'game4',
                name: 'Stava ord',
                description: 'Matcha bilden med ord. (4+ år)',
                icon: '📝',
                path: 'games/game4/index.html'
            },
            {
                id: 'game5',
                name: 'Räkna ihop',
                description: 'Addera emojis. (4+ år)',
                icon: '➕',
                path: 'games/game5/index.html'
            },
            {
                id: 'game6',
                name: 'Stava ord',
                description: 'Bokstavera. (5+ år)',
                icon: '🔤',
                path: 'games/game6/index.html'
            }
        ]
    },
    version: version => `Version ${version}`
});

