// Local strings and resources for "Prata med oss" (Game 15)
window.GAME15_STRINGS = Object.freeze({
    title: '',
    instructions: 'Skriv något – tryck på spela!',
    // Brief hint when the phone has no Swedish TTS voice and we use the default
    noSwedishVoiceHint: 'Ingen svensk röst – använder telefonens vanliga röst.',
    labels: {
        continue: 'Fortsätt',
        back: 'Tillbaka',
        clear: 'Rensa',
        backspace: '←'
    },
    dialog: {
        title: 'Bra!',
        message: 'Roboten har pratat fyra gånger!'
    },
    aria: {
        field: 'Textfält',
        alphabet: 'Alfabet',
        figures: 'Robot som pratar',
        figure: (name) => `${name} pratar`,
        play: 'Låt roboten prata',
        letter: (ch) => `Bokstav ${ch}`,
        space: 'Mellanslag'
    },
    ambience: {
        track: 'sounds/background.mp3'
    },
    // Soft clip before speech (ambience is ducked)
    thinking: {
        track: 'sounds/thinking.mp3'
    },
    maxChars: 40,
    // How many successful speaks finish a round
    speaksToComplete: 4,
    // Swedish alphabet including ÅÄÖ (uppercase for display)
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ'.split(''),
    // Single robot friend → one Chirp 3 HD Swedish voice
    figures: [
        {
            id: 'robot',
            name: 'Roboten',
            voice: 'sv-SE-Chirp3-HD-Leda',
            image: 'images/robot.webp'
        }
    ]
});
