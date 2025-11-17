// Local strings and game-specific resources for Counting Game (Game 3)
window.GAME3_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    labels: {
        continue: 'Fortsätt'
    },
    dialog: {
        title: 'Rätt!',
        message: 'Bra räknat!'
    },
    aria: {
        fruit: emoji => `Frukt: ${emoji}`,
        numberButton: number => `Välj ${number}`
    },
    ambience: {
        track: 'sounds/background.mp3'
    },
    // List of single fruit emojis to use (only emojis representing one fruit)
    fruits: [
        '\u{1F34E}', // Apple
        '\u{1F34C}', // Banana
        '\u{1F34A}', // Orange
        '\u{1F353}', // Strawberry
        '\u{1F351}', // Peach
        '\u{1F95D}', // Kiwi
        '\u{1F349}', // Watermelon
        '\u{1F34B}', // Lemon
        '\u{1F96D}', // Mango
        '\u{1F34D}', // Pineapple
        '\u{1F350}', // Pear
        '\u{1F951}', // Avocado
        '\u{1F348}'  // Melon
    ]
});
