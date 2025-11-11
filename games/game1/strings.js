window.GAME_STRINGS = Object.freeze({
    /** can be used for on-screen instructions for example
    instructions: 'Tryck på cirklarna i nummerordning.',
    pausedInstructions: 'Pausat! Tryck på Fortsätt för att spela vidare.',
    **/
   
    instructions: '',     
    pausedInstructions: '',
    labels: {
        start: 'Starta',
        pause: 'Pausa',
        resume: 'Fortsätt'
    },
    messages: {
        success: finalTime => `Det tog ${finalTime} sekunder`
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

