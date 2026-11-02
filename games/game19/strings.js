// Local strings and resources for "Räkna hoppen" (Game 19)
window.GAME19_STRINGS = Object.freeze({
    title: 'Räkna hoppen',
    /** Shown on the mat between rounds (default hub text when idle) */
    instructions: 'Räkna kaninens hopp på studsmattan och tryck på rätt siffra.',
    /** Used for TTS fallback when how_many.mp3 is missing (not shown on screen) */
    instructionsAnswer: 'Hur många hopp var det?',
    /**
     * Spoken before each round’s jumps (TTS now; optional MP3 in roundIntroSounds).
     * Keys 1–3 match round number (ROUNDS_TO_COMPLETE).
     */
    roundIntroSpeech: {
        1: 'Var med nu, räkna hoppen!',
        2: 'Bra där, en gång till, räkna hoppen!',
        3: 'Bra! Sista gången, räkna hoppen!'
    },
    /** Optional MP3 per round intro, e.g. 1: 'sounds/intro_round_1.mp3' */
    roundIntroSounds: {
        1: 'sounds/count_jumps1.mp3',
        2: 'sounds/count_jumps2.mp3',
        3: 'sounds/count_jumps3.mp3'
    },
    answerPromptSound: 'sounds/how_many.mp3',
    labels: {
        continue: 'Igen',
        back: 'Tillbaka',
        /** Screen reader label for the carrot progress row (not shown as visible text) */
        roundProgress: (current, total) => `Runda ${current} av ${total}`,
    },
    dialog: {
        title: 'Bra jobbat!',
        message: 'Du räknade alla hoppen!'
    },
    aria: {
        scene: 'Kaninen hoppar på studsmattan',
        numberChoice: (n) => `Siffra ${n}`
    },
    ambience: {
        track: 'sounds/background.mp3'
    },
    /** Short hop on each jump (add to TiddeliGames-assets/games/game19/sounds/) */
    jumpSound: 'sounds/jump.mp3',
    successSound: 'sounds/success.mp3',
    errorSound: 'sounds/oups.mp3',
    images: {
        background: 'images/background.jpg',
        /** Front-facing jump sequence (6 frames, horizontal strip) */
        rabbitSpriteSheet: 'images/rabbit_jump_sheet.png',
        rabbitSpriteFrameCount: 6,
        /** Soft ellipse under feet (optional) */
        rabbitShadow: 'images/rabbit_shadow.png'
    },
    /** Game rules */
    minJumps: 2,
    maxJumps: 9,
    roundsToComplete: 3,
    /**
     * Relative chance per jump count (keys 2–9). Higher = more often.
     * Tuned so 2–4 appear more than 5–8 (plain random felt too “high”).
     */
    jumpCountWeights: {
        2: 4,
        3: 4,
        4: 4,
        5: 2,
        6: 2,
        7: 1,
        8: 1,
        9: 1
    }
});
