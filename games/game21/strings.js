// Local strings and resources for "Fåglarna flyger hem" (Game 21)
window.GAME21_STRINGS = Object.freeze({
    title: 'Fåglarna flyger hem',
    /** Spoken prompts only — the on-screen instruction line stays empty */
    instructions: '',
    labels: {
        continue: 'Igen',
        back: 'Tillbaka',
        /** Screen reader label for the round progress row (not shown as visible text) */
        roundProgress: (current, total) => `Runda ${current} av ${total}`
    },
    dialog: {
        title: 'Bra jobbat!',
        message: 'Alla fåglar är hemma!'
    },
    aria: {
        scene: 'Ett stort träd med färgade fågelbon',
        listen: 'Spela om frågan',
        bird: (name) => `Den ${name} fågeln`,
        nest: (name) => `Det ${name} boet`
    },
    ambience: {
        track: 'sounds/ambience.mp3'
    },
    /**
     * Colours used for birds, nests and chicks. Clearly distinct hues.
     * prompt = "Den <färg> fågeln vill flyga hem!"   praise = "<Färg>! Bra!"
     * birdName / nestName are only used for screen-reader labels.
     */
    colors: [
        { id: 'red', birdName: 'röda', nestName: 'röda', prompt: 'sounds/den_roda_fageln_vill_flyga_hem.mp3', praise: 'sounds/rod_bra.mp3' },
        { id: 'blue', birdName: 'blå', nestName: 'blå', prompt: 'sounds/den_bla_fageln_vill_flyga_hem.mp3', praise: 'sounds/bla_bra.mp3' },
        { id: 'yellow', birdName: 'gula', nestName: 'gula', prompt: 'sounds/den_gula_fageln_vill_flyga_hem.mp3', praise: 'sounds/gul_bra.mp3' },
        { id: 'green', birdName: 'gröna', nestName: 'gröna', prompt: 'sounds/den_grona_fageln_vill_flyga_hem.mp3', praise: 'sounds/gron_bra.mp3' }
    ],
    /** Spoken right before the completion dialog */
    allHomeSound: 'sounds/alla_faglar_ar_hemma.mp3',
    /** Sound effects (self-synthesised) */
    flutterSound: 'sounds/flutter.mp3',
    peepSound: 'sounds/peep.mp3',
    boingSound: 'sounds/boing.mp3',
    /** Wrong nest: spoken "Hoppsan, där blev det fel!" (Gemini TTS) */
    wrongPlaceSound: 'sounds/hoppsan_dar_blev_det_fel.mp3',
    successSound: 'sounds/success.mp3',
    /**
     * Sprite stems; real files are images/<stem>_1x.webp, _2x.webp, _1x.png.
     * {c} is replaced with the colour id.
     */
    images: {
        background: 'images/background.webp',
        backgroundFallback: 'images/background.jpg',
        birdUp: 'bird_{c}_up',
        birdDown: 'bird_{c}_down',
        nest: 'nest_{c}',
        chicks: 'chicks_{c}'
    },
    roundsToComplete: 6,
    /** Number of nests per round (index = round). First rounds 2 nests, then 3. */
    nestsPerRound: [2, 2, 2, 3, 3, 3]
});
