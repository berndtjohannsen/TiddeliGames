// Local strings and game-specific resources for Spelling Game (Game 4)
window.GAME4_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    labels: {
        continue: 'Fortsätt'
    },
    dialog: {
        title: 'Bra!',
        message: ''
    },
    aria: {
        image: word => `Bild: ${word}`,
        word: word => `Ord: ${word}`
    },
    ambience: {
        track: 'sounds/background.mp3'
    },
    sounds: {
        complete: 'sounds/complete.mp3'
    },
    // Word-image pairs (emoji and Swedish word)
    // Each pair has an emoji and the corresponding Swedish word
    // Easy to recognize and spell for kids
    wordPairs: [
        // Animals
        { emoji: '🐱', word: 'katt' },
        { emoji: '🐶', word: 'hund' },
        { emoji: '🐷', word: 'gris' },
        { emoji: '🐮', word: 'ko' },
        { emoji: '🐴', word: 'häst' },
        { emoji: '🐑', word: 'får' },
        { emoji: '🐔', word: 'höna' },
        { emoji: '🐰', word: 'kanin' },
        { emoji: '🐻', word: 'björn' },
        { emoji: '🐸', word: 'groda' },
        { emoji: '🐯', word: 'tiger' },
        { emoji: '🦁', word: 'lejon' },
        { emoji: '🐭', word: 'mus' },
        { emoji: '🦊', word: 'räv' },
        { emoji: '🐺', word: 'varg' },
        { emoji: '🐦', word: 'fågel' },
        { emoji: '🦆', word: 'anka' },
        { emoji: '🐢', word: 'sköldpadda' },
        { emoji: '🐍', word: 'orm' },
        { emoji: '🦋', word: 'fjäril' },
        { emoji: '🐝', word: 'bi' },
        { emoji: '🐟', word: 'fisk' },
        { emoji: '🐬', word: 'delfin' },
        { emoji: '🦈', word: 'haj' },
        { emoji: '🦀', word: 'krabba' },
        { emoji: '🐧', word: 'pingvin' },
        { emoji: '🦉', word: 'uggla' },
        { emoji: '🐘', word: 'elefant' },
        { emoji: '🦒', word: 'giraff' },
        { emoji: '🐪', word: 'kamel' },
        { emoji: '🦘', word: 'känguru' },
        // Vehicles
        { emoji: '🚗', word: 'bil' },
        { emoji: '🚌', word: 'buss' },
        { emoji: '🚂', word: 'tåg' },
        { emoji: '✈️', word: 'flygplan' },
        { emoji: '🚢', word: 'båt' },
        { emoji: '🚑', word: 'ambulans' },
        { emoji: '🚒', word: 'brandbil' },
        { emoji: '🚓', word: 'polisbil' },
        // Food
        { emoji: '🍎', word: 'äpple' },
        { emoji: '🍌', word: 'banan' },
        { emoji: '🍞', word: 'bröd' },
        { emoji: '🍰', word: 'tårta' },
        { emoji: '🍪', word: 'kaka' },
        { emoji: '🥛', word: 'mjölk' },
        { emoji: '🧀', word: 'ost' },
        { emoji: '🍊', word: 'apelsin' },
        { emoji: '🍓', word: 'jordgubbe' },
        { emoji: '🍉', word: 'vattenmelon' },
        { emoji: '🥕', word: 'morot' },
        { emoji: '🥔', word: 'potatis' },
        { emoji: '🍅', word: 'tomat' },
        { emoji: '🥒', word: 'gurka' },
    
        { emoji: '🍝', word: 'pasta' },
        { emoji: '🍔', word: 'hamburgare' },
        { emoji: '🌭', word: 'korv' },
        { emoji: '🍦', word: 'glass' },
        { emoji: '🍭', word: 'godis' },
        { emoji: '☕', word: 'kaffe' },
        // Body parts
        { emoji: '👋', word: 'hand' },
        { emoji: '🦶', word: 'fot' },
        { emoji: '👂', word: 'öra' },
        { emoji: '👃', word: 'näsa' },
        { emoji: '👁️', word: 'öga' },
        { emoji: '👄', word: 'mun' },
        { emoji: '👅', word: 'tunga' },
        { emoji: '🦷', word: 'tand' },
        { emoji: '💪', word: 'arm' },
        { emoji: '🦵', word: 'ben' },
        // Nature
        { emoji: '🌳', word: 'träd' },
        { emoji: '🌸', word: 'blomma' },
        { emoji: '☀️', word: 'sol' },
        { emoji: '🌙', word: 'måne' },
        { emoji: '🌲', word: 'gran' },
       
        { emoji: '🍄', word: 'svamp' },
        { emoji: '🌻', word: 'solros' },
        { emoji: '🌷', word: 'tulpan' },

        // Weather
        { emoji: '☁️', word: 'moln' },
        { emoji: '🌧️', word: 'regn' },
        { emoji: '🌈', word: 'regnbåge' },
        { emoji: '☃️', word: 'snögubbe' },
        // Objects
        { emoji: '🏠', word: 'hus' },
        { emoji: '📚', word: 'bok' },
        { emoji: '⚽', word: 'boll' },
        { emoji: '🧸', word: 'nalle' },
        { emoji: '🎁', word: 'paket' },
        { emoji: '💡', word: 'lampa' },
        { emoji: '🪑', word: 'stol' },
        { emoji: '🛏️', word: 'säng' },
        { emoji: '🪟', word: 'fönster' },
        { emoji: '🪣', word: 'hink' },
       
                // Clothing
        { emoji: '👕', word: 'tröja' },
        { emoji: '👖', word: 'byxor' },
        { emoji: '👗', word: 'klänning' },
        { emoji: '👟', word: 'sko' },
        { emoji: '🧢', word: 'mössa' },
        { emoji: '🧦', word: 'strumpa' },
        // Toys and games
        { emoji: '🧩', word: 'pussel' },
        // Musical instruments
        { emoji: '🥁', word: 'trumma' },
        { emoji: '🎺', word: 'trumpet' },
                // Sports
        // School/learning
        { emoji: '✏️', word: 'penna' },
        { emoji: '✂️', word: 'sax' }
        

        // Buildings

    ]
});
