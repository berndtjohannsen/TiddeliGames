// Local strings and game-specific resources for Spelling Game (Game 6)
window.GAME6_STRINGS = Object.freeze({
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
        character: char => `Bokstav: ${char}`
    },
    ambience: {
        track: 'sounds/background.mp3'
    },
    sounds: {
        complete: 'sounds/complete.mp3'
    },
    // Word-image pairs (emoji and Swedish word)
    // Each pair has an emoji and the corresponding Swedish word
    // Easy to recognize and spell for kids (5+ years)
    // All words are 6 characters or less
    wordPairs: [
        // Animals (2-6 characters)
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
        { emoji: '🦉', word: 'UGGLA' },
        { emoji: '🐪', word: 'KAMEL' },
        { emoji: '🐿️', word: 'EKORRE' },
        // Vehicles (2-6 characters)
        { emoji: '🚗', word: 'BIL' },
        { emoji: '🚌', word: 'BUSS' },
        { emoji: '🚂', word: 'TÅG' },
        { emoji: '🚢', word: 'BÅT' },
        { emoji: '🚤', word: 'BÅT' },
        // Food (2-6 characters)
        { emoji: '🍎', word: 'ÄPPLE' },
        { emoji: '🍌', word: 'BANAN' },
        { emoji: '🍞', word: 'BRÖD' },
        { emoji: '🍰', word: 'TÅRTA' },
        { emoji: '🍪', word: 'KAKA' },
        { emoji: '🥛', word: 'MJÖLK' },
        { emoji: '🧀', word: 'OST' },
        { emoji: '🥕', word: 'MOROT' },
        { emoji: '🍅', word: 'TOMAT' },
        { emoji: '🥒', word: 'GURKA' },
        { emoji: '🍝', word: 'PASTA' },
        { emoji: '🌭', word: 'KORV' },
        { emoji: '🍦', word: 'GLASS' },
        { emoji: '🍭', word: 'GODIS' },
        { emoji: '☕', word: 'KAFFE' },
        { emoji: '🥚', word: 'ÄGG' },
        { emoji: '🥗', word: 'SALLAD' },
        { emoji: '🎂', word: 'TÅRTA' },
        { emoji: '🍼', word: 'FLASKA' },
        { emoji: '🧊', word: 'IS' },
        { emoji: '🥄', word: 'SKED' },
        { emoji: '🔪', word: 'KNIV' },
        // Body parts (2-6 characters)
        { emoji: '👋', word: 'HAND' },
        { emoji: '🦶', word: 'FOT' },
        { emoji: '👂', word: 'ÖRA' },
        { emoji: '👃', word: 'NÄSA' },
        { emoji: '👁️', word: 'ÖGA' },
        { emoji: '👄', word: 'MUN' },
        { emoji: '💪', word: 'ARM' },
        { emoji: '🦵', word: 'BEN' },
        { emoji: '🦴', word: 'BEN' },
                // Nature (2-6 characters)
        { emoji: '🌳', word: 'TRÄD' },
        { emoji: '🌸', word: 'BLOMMA' },
        { emoji: '☀️', word: 'SOL' },
        { emoji: '🌙', word: 'MÅNE' },
        { emoji: '🌲', word: 'GRAN' },
        { emoji: '🍄', word: 'SVAMP' },
        { emoji: '🌻', word: 'SOLROS' },
        { emoji: '🌷', word: 'TULPAN' },
        { emoji: '🌹', word: 'ROS' },
        { emoji: '🌾', word: 'RIS' },
        { emoji: '🍂', word: 'LÖV' },
        { emoji: '🍃', word: 'LÖV' },
        { emoji: '🍇', word: 'DRUVOR' },
        { emoji: '🌽', word: 'MAJS' },
        
        { emoji: '🧅', word: 'LÖK' },
        // Weather (2-6 characters)
        { emoji: '💧', word: 'DROPPE' },
        // Objects (2-6 characters)
        { emoji: '🏠', word: 'HUS' },
        { emoji: '📚', word: 'BOK' },
        { emoji: '⚽', word: 'BOLL' },
        { emoji: '🧸', word: 'NALLE' },
        { emoji: '🎁', word: 'PAKET' },
        { emoji: '💡', word: 'LAMPA' },
        { emoji: '🪑', word: 'STOL' },
        { emoji: '🛏️', word: 'SÄNG' },
        { emoji: '🪣', word: 'HINK' },
        { emoji: '🧩', word: 'PUSSEL' },
        { emoji: '🥁', word: 'TRUMMA' },
        { emoji: '🪜', word: 'STEGE' },
        { emoji: '🪓', word: 'YXA' },
        { emoji: '🪝', word: 'KROK' },
        { emoji: '💉', word: 'SPRUTA' },
        { emoji: '🚪', word: 'DÖRR' },
        { emoji: '🛁', word: 'BADKAR' },
        { emoji: '🧺', word: 'KORG' },
                // Clothing (2-6 characters)
        { emoji: '👕', word: 'TRÖJA' },
        { emoji: '👖', word: 'BYXOR' },
        { emoji: '👟', word: 'SKO' },
        { emoji: '🧢', word: 'MÖSSA' },
        { emoji: '👜', word: 'VÄSKA' },
        { emoji: '👞', word: 'SKO' },
        { emoji: '🥿', word: 'SKO' },
        { emoji: '👢', word: 'STÖVEL' },
        { emoji: '👑', word: 'KRONA' },
        { emoji: '👒', word: 'HATT' },
        { emoji: '🎩', word: 'HATT' },
        { emoji: '🎓', word: 'MÖSSA' },
        { emoji: '💍', word: 'RING' },
        // School/learning (2-6 characters)
        { emoji: '✏️', word: 'PENNA' },
        { emoji: '📑', word: 'BLAD' },
        { emoji: '📖', word: 'BOK' }
    ]
});
