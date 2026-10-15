// Local strings and resources for Match Words Game (Game 12)
// Word-image pairs reused from Game 4; drag&drop interaction inspired by Game 11
window.GAME12_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    labels: {
        continue: 'Fortsätt',
        back: 'Tillbaka'
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
    // Same emoji/word pairs as Game 4
    wordPairs: [
        // Animals
        { emoji: '🐱', word: 'KATT' },
        { emoji: '🐶', word: 'HUND' },
        { emoji: '🐷', word: 'GRIS' },
        { emoji: '🐮', word: 'KO' },
        { emoji: '🐴', word: 'HÄST' },
        { emoji: '🐑', word: 'FÅR' },
        { emoji: '🐔', word: 'HÖNA' },
        { emoji: '🐰', word: 'KANIN' },
        { emoji: '🐻', word: 'BJÖRN' },
        { emoji: '🐸', word: 'GRODA' },
        { emoji: '🐯', word: 'TIGER' },
        { emoji: '🦁', word: 'LEJON' },
        { emoji: '🐭', word: 'MUS' },
        { emoji: '🦊', word: 'RÄV' },
        { emoji: '🐺', word: 'VARG' },
        { emoji: '🐦', word: 'FÅGEL' },
        { emoji: '🦆', word: 'ANKA' },
        { emoji: '🐍', word: 'ORM' },
        { emoji: '🦋', word: 'FJÄRIL' },
        { emoji: '🐝', word: 'BI' },
        { emoji: '🐟', word: 'FISK' },
        { emoji: '🐬', word: 'DELFIN' },
        { emoji: '🦈', word: 'HAJ' },
        { emoji: '🦀', word: 'KRABBA' },
        { emoji: '🐧', word: 'PINGVIN' },
        { emoji: '🦉', word: 'UGGLA' },
        { emoji: '🐘', word: 'ELEFANT' },
        { emoji: '🦒', word: 'GIRAFF' },
        { emoji: '🐪', word: 'KAMEL' },
        { emoji: '🦘', word: 'KÄNGURU' },
        // Vehicles
        { emoji: '🚗', word: 'BIL' },
        { emoji: '🚌', word: 'BUSS' },
        { emoji: '🚂', word: 'TÅG' },
        { emoji: '✈️', word: 'FLYGPLAN' },
        { emoji: '🚢', word: 'BÅT' },
        { emoji: '🚑', word: 'AMBULANS' },
        { emoji: '🚒', word: 'BRANDBIL' },
        { emoji: '🚓', word: 'POLISBIL' },
        // Food
        { emoji: '🍎', word: 'ÄPPLE' },
        { emoji: '🍌', word: 'BANAN' },
        { emoji: '🍞', word: 'BRÖD' },
        { emoji: '🍰', word: 'TÅRTA' },
        { emoji: '🍪', word: 'KAKA' },
        { emoji: '🥛', word: 'MJÖLK' },
        { emoji: '🧀', word: 'OST' },
        { emoji: '🍊', word: 'APELSIN' },
        { emoji: '🍓', word: 'JORDGUBBE' },
        { emoji: '🍉', word: 'MELON' },
        { emoji: '🥕', word: 'MOROT' },
        { emoji: '🥔', word: 'POTATIS' },
        { emoji: '🍅', word: 'TOMAT' },
        { emoji: '🥒', word: 'GURKA' },
    
        { emoji: '🍝', word: 'PASTA' },

        { emoji: '🌭', word: 'KORV' },
        { emoji: '🍦', word: 'GLASS' },
        { emoji: '🍭', word: 'GODIS' },
        { emoji: '☕', word: 'KAFFE' },
        // Body parts
        { emoji: '👋', word: 'HAND' },
        { emoji: '🦶', word: 'FOT' },
        { emoji: '👂', word: 'ÖRA' },
        { emoji: '👃', word: 'NÄSA' },
        { emoji: '👁️', word: 'ÖGA' },
        { emoji: '👄', word: 'MUN' },
        { emoji: '👅', word: 'TUNGA' },
        { emoji: '🦷', word: 'TAND' },
        { emoji: '💪', word: 'ARM' },
        { emoji: '🦵', word: 'BEN' },
        // Nature
        { emoji: '🌳', word: 'TRÄD' },
        { emoji: '🌸', word: 'BLOMMA' },
        { emoji: '☀️', word: 'SOL' },
        { emoji: '🌙', word: 'MÅNE' },
        { emoji: '🌲', word: 'GRAN' },
       
        { emoji: '🍄', word: 'SVAMP' },
        { emoji: '🌻', word: 'SOLROS' },
        

        // Weather
        { emoji: '☁️', word: 'MOLN' },
        { emoji: '🌧️', word: 'REGN' },
        { emoji: '🌈', word: 'REGNBÅGE' },
        { emoji: '☃️', word: 'SNÖGUBBE' },
        // Objects
        { emoji: '🏠', word: 'HUS' },
        
        { emoji: '⚽', word: 'BOLL' },
        { emoji: '🧸', word: 'NALLE' },
        { emoji: '🎁', word: 'PAKET' },
        { emoji: '💡', word: 'LAMPA' },
        { emoji: '🪑', word: 'STOL' },
        { emoji: '🛏️', word: 'SÄNG' },
        { emoji: '🪟', word: 'FÖNSTER' },
        { emoji: '🪣', word: 'HINK' },
       
                // Clothing
        { emoji: '👕', word: 'TRÖJA' },
        { emoji: '👖', word: 'BYXOR' },
        { emoji: '👗', word: 'KLÄNNING' },
        { emoji: '👟', word: 'SKO' },
        { emoji: '🧢', word: 'KEPS' },
        { emoji: '🧦', word: 'STRUMPA' },
        // Toys and games
        { emoji: '🧩', word: 'PUSSEL' },
        // Musical instruments
        { emoji: '🥁', word: 'TRUMMA' },
        { emoji: '🎺', word: 'TRUMPET' },
                // Sports
        // School/learning
        { emoji: '✏️', word: 'PENNA' },
        { emoji: '✂️', word: 'SAX' }
        

        // Buildings

    ]
});
