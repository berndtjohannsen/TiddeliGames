// Local strings and game-specific resources for Uppercase/Lowercase Matching Game (Game 8)
window.GAME8_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    labels: {
        continue: 'Fortsätt'
    },
    dialog: {
        title: 'Bra!',
        message: 'Vill du spela igen?'
    },
    aria: {
        lowercase: letter => `Liten bokstav: ${letter}`,
        uppercase: letter => `Stor bokstav: ${letter}`,
        instruction: ''
    },
    errors: {
        initializationFailed: 'Ett fel uppstod vid start. Ladda om sidan.',
        uppercaseContainerMissing: 'Uppercase container not found',
        stringsNotLoaded: 'GAME8_STRINGS not loaded'
    }
});

