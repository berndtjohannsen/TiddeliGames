window.GAME_STRINGS = Object.freeze({
    instructions: 'Tryck på cirklarna i nummerordning.',
    pausedInstructions: 'Pausat! Tryck på Fortsätt för att spela vidare.',
    labels: {
        start: 'Starta spelet',
        pause: 'Pausa',
        resume: 'Fortsätt'
    },
    messages: {
        success: finalTime => `Bra jobbat! Du blev klar på ${finalTime} sekunder!`
    },
    aria: {
        circle: number => `Cirkel nummer ${number}`
    }
});

