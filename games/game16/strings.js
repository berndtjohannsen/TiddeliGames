// Local strings and resources for "Träffa ordet" (Game 16)
window.GAME16_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    labels: {
        continue: 'Fortsätt',
        back: 'Tillbaka'
    },
    dialog: {
        title: 'Bra!',
        message: 'Du träffade alla orden!'
    },
    aria: {
        word: (label) => `Ord: ${label}`,
        listen: 'Spela om frågan',
        field: 'Skjutbana'
    },
    // Spoken lead-in before the target word (optional file; speechSynthesis used if missing)
    promptSound: 'sounds/ForsokTraffa.mp3',
    promptSpeech: 'Försök att träffa',
    ambience: {
        // New game-specific loop — place file in assets; game runs without it
        track: 'sounds/background.mp3'
    },
    // Same word bank as game 14 (audio resolved from game14 assets)
    words: [
        { id: 'anka', label: 'ANKA', sound: 'sounds/anka.mp3' },
        { id: 'apa', label: 'APA', sound: 'sounds/apa.mp3' },
        { id: 'apelsin', label: 'APELSIN', sound: 'sounds/apelsin.mp3' },
        { id: 'asna', label: 'ÅSNA', sound: 'sounds/asna.mp3' },
        { id: 'banan', label: 'BANAN', sound: 'sounds/banan.mp3' },
        { id: 'bat', label: 'BÅT', sound: 'sounds/bat.mp3' },
        { id: 'bil', label: 'BIL', sound: 'sounds/bil.mp3' },
        { id: 'bok', label: 'BOK', sound: 'sounds/bok.mp3' },
        { id: 'fagel', label: 'FÅGEL', sound: 'sounds/fagel.mp3' },
        { id: 'fisk', label: 'FISK', sound: 'sounds/fisk.mp3' },
        { id: 'gris', label: 'GRIS', sound: 'sounds/gris.mp3' },
        { id: 'gurka', label: 'GURKA', sound: 'sounds/gurka.mp3' },
        { id: 'hand', label: 'HAND', sound: 'sounds/hand.mp3' },
        { id: 'hast', label: 'HÄST', sound: 'sounds/hast.mp3' },
        { id: 'hink', label: 'HINK', sound: 'sounds/hink.mp3' },
        { id: 'hona', label: 'HÖNA', sound: 'sounds/hona.mp3' },
        { id: 'hund', label: 'HUND', sound: 'sounds/hund.mp3' },
        { id: 'hus', label: 'HUS', sound: 'sounds/hus.mp3' },
        { id: 'katt', label: 'KATT', sound: 'sounds/katt.mp3' },
        { id: 'ko', label: 'KO', sound: 'sounds/ko.mp3' },
        { id: 'mus', label: 'MUS', sound: 'sounds/mus.mp3' },
        { id: 'nasa', label: 'NÄSA', sound: 'sounds/nasa.mp3' },
        { id: 'stol', label: 'STOL', sound: 'sounds/stol.mp3' },
        { id: 'vante', label: 'VANTE', sound: 'sounds/vante.mp3' }
    ]
});
