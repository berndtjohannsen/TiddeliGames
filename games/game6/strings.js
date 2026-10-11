// Local strings and game-specific resources for Spelling Game (Game 6)
window.GAME6_STRINGS = Object.freeze({
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
        // 2-character words
        { emoji: '🐝', word: 'BI' },
        { emoji: '🧊', word: 'IS' },
        { emoji: '🐮', word: 'KO' },
        { emoji: '🏝️', word: 'Ö' },
                
        
        // 3-character words
        { emoji: '🥚', word: 'ÄGG' },
        { emoji: '💪', word: 'ARM' },
        { emoji: '🚢', word: 'BÅT' },
        { emoji: '🚤', word: 'BÅT' },
        { emoji: '🦵', word: 'BEN' },
        { emoji: '🦴', word: 'BEN' },
        { emoji: '🚗', word: 'BIL' },
        { emoji: '📖', word: 'BOK' },
        { emoji: '🔥', word: 'ELD' },
        { emoji: '🐑', word: 'FÅR' },
        { emoji: '🦶', word: 'FOT' },
        { emoji: '🦈', word: 'HAJ' },
        { emoji: '🏠', word: 'HUS' },
        { emoji: '🍂', word: 'LÖV' },
        { emoji: '🍃', word: 'LÖV' },
        { emoji: '👄', word: 'MUN' },
        { emoji: '🐭', word: 'MUS' },
        { emoji: '🥜', word: 'NÖT' },
        { emoji: '👁️', word: 'ÖGA' },
        { emoji: '👂', word: 'ÖRA' },
        { emoji: '🐍', word: 'ORM' },
        { emoji: '🧀', word: 'OST' },
        { emoji: '🦊', word: 'RÄV' },
        { emoji: '🌹', word: 'ROS' },
        { emoji: '👟', word: 'SKO' },
        { emoji: '👞', word: 'SKO' },
        { emoji: '🥿', word: 'SKO' },
        { emoji: '☀️', word: 'SOL' },
        { emoji: '🚂', word: 'TÅG' },
        { emoji: '🪓', word: 'YXA' },

        // 4-character words
        { emoji: '🦆', word: 'ANKA' },
        { emoji: '⚽', word: 'BOLL' },
        { emoji: '🍞', word: 'BRÖD' },
        { emoji: '🚌', word: 'BUSS' },
        { emoji: '🚪', word: 'DÖRR' },
        { emoji: '🐟', word: 'FISK' },
        { emoji: '🌲', word: 'GRAN' },
        { emoji: '🐷', word: 'GRIS' },
        { emoji: '👋', word: 'HAND' },
        { emoji: '🐴', word: 'HÄST' },
        { emoji: '👒', word: 'HATT' },
        { emoji: '🎩', word: 'HATT' },
        { emoji: '🪣', word: 'HINK' },
        { emoji: '🐔', word: 'HÖNA' },
        { emoji: '🐶', word: 'HUND' },
        { emoji: '🍪', word: 'KAKA' },
        { emoji: '🐱', word: 'KATT' },
        { emoji: '🔪', word: 'KNIV' },
        { emoji: '🪝', word: 'KROK' },
        { emoji: '🌽', word: 'MAJS' },
        { emoji: '🌙', word: 'MÅNE' },
        { emoji: '🍩', word: 'MUNK' },
        { emoji: '👃', word: 'NÄSA' },
        { emoji: '🦐', word: 'RÄKA' },
        { emoji: '🌧️', word: 'REGN' },
        { emoji: '💍', word: 'RING' },
        { emoji: '🧃', word: 'SAFT' },
        { emoji: '🧂', word: 'SALT' },
        { emoji: '🛏️', word: 'SÄNG' },
        { emoji: '🥣', word: 'SKÅL' },
        { emoji: '🧈', word: 'SMÖR' },
        { emoji: '🪑', word: 'STOL' },
        { emoji: '🌳', word: 'TRÄD' },
        { emoji: '🐺', word: 'VARG' },

        // 5-character words
        { emoji: '🍎', word: 'ÄPPLE' },
        { emoji: '🍌', word: 'BANAN' },
        { emoji: '🐻', word: 'BJÖRN' },
        { emoji: '🐦', word: 'FÅGEL' },
        { emoji: '🍦', word: 'GLASS' },
        { emoji: '🍭', word: 'GODIS' },
        { emoji: '🍬', word: 'GODIS' },
        { emoji: '🐸', word: 'GRODA' },
        { emoji: '🥒', word: 'GURKA' },
        { emoji: '🐪', word: 'KAMEL' },
        { emoji: '🐰', word: 'KANIN' },
        { emoji: '👑', word: 'KRONA' },
        { emoji: '💡', word: 'LAMPA' },
        { emoji: '🦁', word: 'LEJON' },
        { emoji: '🥛', word: 'MJÖLK' },
        { emoji: '🥕', word: 'MOROT' },
        { emoji: '🧢', word: 'KEPS' },
        { emoji: '🧸', word: 'NALLE' },
        { emoji: '🎁', word: 'PAKET' },
        { emoji: '🍐', word: 'PÄRON' },
        { emoji: '🍝', word: 'PASTA' },
        { emoji: '✏️', word: 'PENNA' },
        { emoji: '🪜', word: 'STEGE' },
        { emoji: '🍄', word: 'SVAMP' },
        { emoji: '🍰', word: 'TÅRTA' },
        { emoji: '🎂', word: 'TÅRTA' },
        { emoji: '🐯', word: 'TIGER' },
        { emoji: '🍅', word: 'TOMAT' },
        { emoji: '👕', word: 'TRÖJA' },
        { emoji: '🦉', word: 'UGGLA' },
        { emoji: '👜', word: 'VÄSKA' },

        // 6-character words
        { emoji: '🛁', word: 'BADKAR' },
        { emoji: '🌸', word: 'BLOMMA' },
        { emoji: '🐬', word: 'DELFIN' },
        { emoji: '💧', word: 'DROPPE' },
        { emoji: '🍇', word: 'DRUVOR' },
        { emoji: '🦋', word: 'FJÄRIL' },
        { emoji: '🍾', word: 'FLASKA' },
        { emoji: '🦀', word: 'KRABBA' },
        { emoji: '🧩', word: 'PUSSEL' },
        { emoji: '🌻', word: 'SOLROS' },
        { emoji: '💉', word: 'SPRUTA' },
        { emoji: '👢', word: 'STÖVEL' },
        { emoji: '🥁', word: 'TRUMMA' },
        { emoji: '🌷', word: 'TULPAN' },

        // 7-character words
        { emoji: '🍊', word: 'APELSIN' },
        { emoji: '🥑', word: 'AVOKADO' },
        { emoji: '🍑', word: 'PERSIKA' },
    ]
});
