window.GAME_STRINGS = Object.freeze({
    instructions: 'Tryck på cirklarna i nummerordning.',
    pausedInstructions: 'Pausat! Tryck på Fortsätt för att spela vidare.',
    labels: {
        start: 'Starta',
        pause: 'Pausa',
        resume: 'Fortsätt'
    },
    messages: {
        success: finalTime => `Det tog ${finalTime} sekunder!`
    },
    dialog: {
        title: 'HURRA!',
        retry: 'Försök igen',
        back: 'Tillbaka'
    },
    aria: {
        circle: number => `Cirkel nummer ${number}`
    }
});

