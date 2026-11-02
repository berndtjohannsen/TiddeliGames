window.GAME_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    /** One-shot “how to play” when the game opens — see design.md (spoken prompts) */
    gameIntroSound: 'sounds/klicka_pa_siffrorna.mp3',
    labels: {
        continue: 'Igen',
        back: 'Tillbaka'
    },
    messages: {
        success: 'Hurra! Alla siffror är klara.'
    },
    dialog: {
        title: 'Bra jobbat!',
        message: 'Vill du spela igen?'
    },
    aria: {
        circle: number => `Cirkel nummer ${number}`
    }
});

