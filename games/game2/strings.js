// Local strings and game-specific resources for Animal Sounds game (Game 2)
window.GAME2_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    completionMessage: '',
    labels: {
        continue: 'Fortsätt'
    },
    dialog: {
        title: '',
        subtitle: ''
    },
    aria: {
        animal: name => `Djur: ${name}`
    },
    ambience: {
        track: 'sounds/background.mp3'
    },
    // List of animals to be placed on the game board.
    animals: [
        {
            id: 'horse',
            name: 'Häst',
            image: 'images/hast.png',
            sound: 'sounds/hast.mp3'
        },
        {
            id: 'cow',
            name: 'Ko',
            image: 'images/ko.png',
            sound: 'sounds/ko.mp3'
        },
        {
            id: 'pig',
            name: 'Gris',
            image: 'images/gris.png',
            sound: 'sounds/gris.mp3'
        },
        {
            id: 'sheep',
            name: 'Får',
            image: 'images/far.png',
            sound: 'sounds/far.mp3'
        },
        {
            id: 'chicken',
            name: 'Höna',
            image: 'images/hona.png',
            sound: 'sounds/hona.mp3'
        },
        {
            id: 'dog',
            name: 'Hund',
            image: 'images/hund.png',
            sound: 'sounds/hund.mp3'
        }
    ]
});

