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
    // List of animals/items to be placed on the game board.
    // Game will randomly select 6 from this list each round
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
        },
        {
            id: 'cat',
            name: 'Katt',
            image: 'images/katt.png',
            sound: 'sounds/katt.mp3'
        },
        {
            id: 'duck',
            name: 'Anka',
            image: 'images/anka.png',
            sound: 'sounds/anka.mp3'
        },
        {
            id: 'bird',
            name: 'Fågel',
            image: 'images/fagel.png',
            sound: 'sounds/fagel.mp3'
        },
        {
            id: 'car',
            name: 'Bil',
            image: 'images/bil.png',
            sound: 'sounds/bil.mp3'
        },
        {
            id: 'bike',
            name: 'Cykel',
            image: 'images/cykel.png',
            sound: 'sounds/cykel.mp3'
        },
        {
            id: 'baby',
            name: 'Baby',
            image: 'images/baby.png',
            sound: 'sounds/baby.mp3'
        },
        {
            id: 'santa',
            name: 'Jultomte',
            image: 'images/jultomte.png',
            sound: 'sounds/jultomte.mp3'
        }
    ]
});

