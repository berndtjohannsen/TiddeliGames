// Local strings and resources for "Kör mot ordet" (Game 17)
window.GAME17_STRINGS = Object.freeze({
    title: '',
    instructions: '',
    labels: {
        continue: 'Fortsätt',
        back: 'Tillbaka'
    },
    dialog: {
        title: 'Bra!',
        message: 'Du körde till alla orden!'
    },
    aria: {
        word: (label) => `Ord: ${label}`,
        listen: 'Spela om frågan',
        field: 'Kör i skogen'
    },
    // Lead-in before target word (optional MP3; speechSynthesis fallback)
    promptSound: 'sounds/KorMot.mp3',
    promptSpeech: 'Kör mot',
    /** Tree collision */
    crashSound: 'sounds/crash.mp3',
    /** Rabbit hit (short squeak); ?v= busts cache after re-cut */
    squeakSound: 'sounds/squeak.mp3?v=3',
    /** Correct word hit */
    successSound: 'sounds/success.mp3?v=2',
    /** Wrong word hit (“oups”) */
    oupsSound: 'sounds/oups.mp3',
    /**
     * Looping engine MP3 (synth fallback if missing).
     * fixedEnginePlayback: true when the clip already has its own rev/RPM (no speed pitch-shift).
     */
    engineSound: 'sounds/engine.mp3',
    fixedEnginePlayback: true,
    ambience: {
        track: 'sounds/background.mp3'
    },
    // Optional art (game paints a richer meadow on canvas if background is missing)
    images: {
        background: 'images/background.webp',
        // Optional top-down car sprite; omit until car.webp is on the assets host (canvas draws a car)
        // car: 'images/car.webp',
        rabbits: []
    },
    // Same word bank as game 14 (audio from game14 assets)
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
