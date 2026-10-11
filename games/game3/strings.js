// Local strings and game-specific resources for Counting Game (Game 3)
window.GAME3_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    labels: {
        continue: 'Fortsätt',
        back: 'Tillbaka'
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
        '🍎', // Apple
        '🍌', // Banana
        '🍊', // Orange
        '🍓', // Strawberry
        '🍑', // Peach
        '🥝', // Kiwi
        '🍉', // Watermelon
        '🍋', // Lemon
        '🥭', // Mango
        '🍍', // Pineapple
        '🍐', // Pear
        '🥑', // Avocado
        '🍈', // Melon
    ]
});
