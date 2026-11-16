// Local strings and resources for "Mata fisken" (Game 20)
window.GAME20_STRINGS = Object.freeze({
    title: 'Mata fisken',
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
        message: 'Fisken är mätt och glad!'
    },
    aria: {
        scene: 'Ett akvarium med en hungrig fisk',
        listen: 'Spela om frågan',
        fish: 'Hungrig fisk',
        food: (name) => `Ge fisken ${name}`
    },
    ambience: {
        track: 'sounds/ambience.mp3'
    },
    /** Fish says this at the start of every round */
    hungrySound: 'sounds/jag_ar_hungrig.mp3',
    /**
     * Foods the fish asks for. One food per round (shuffled).
     * promptSounds[n] = "Jag vill ha <n> <food>." (fish speaks in first person)
     */
    foods: [
        {
            id: 'jordgubbar',
            name: 'en jordgubbe',
            image: 'strawberry',
            promptSounds: {
                1: 'sounds/vill_ha_jordgubbar_1.mp3',
                2: 'sounds/vill_ha_jordgubbar_2.mp3',
                3: 'sounds/vill_ha_jordgubbar_3.mp3',
                4: 'sounds/vill_ha_jordgubbar_4.mp3',
                5: 'sounds/vill_ha_jordgubbar_5.mp3',
                6: 'sounds/vill_ha_jordgubbar_6.mp3'
            }
        },
        {
            id: 'morotter',
            name: 'en morot',
            image: 'carrot',
            promptSounds: {
                1: 'sounds/vill_ha_morotter_1.mp3',
                2: 'sounds/vill_ha_morotter_2.mp3',
                3: 'sounds/vill_ha_morotter_3.mp3',
                4: 'sounds/vill_ha_morotter_4.mp3',
                5: 'sounds/vill_ha_morotter_5.mp3',
                6: 'sounds/vill_ha_morotter_6.mp3'
            }
        },
        {
            id: 'bananer',
            name: 'en banan',
            image: 'banana',
            promptSounds: {
                1: 'sounds/vill_ha_bananer_1.mp3',
                2: 'sounds/vill_ha_bananer_2.mp3',
                3: 'sounds/vill_ha_bananer_3.mp3',
                4: 'sounds/vill_ha_bananer_4.mp3',
                5: 'sounds/vill_ha_bananer_5.mp3',
                6: 'sounds/vill_ha_bananer_6.mp3'
            }
        }
    ],
    /** Spoken count as each item is eaten */
    countSounds: {
        1: 'sounds/count_1.mp3',
        2: 'sounds/count_2.mp3',
        3: 'sounds/count_3.mp3',
        4: 'sounds/count_4.mp3',
        5: 'sounds/count_5.mp3',
        6: 'sounds/count_6.mp3'
    },
    /** Right amount: "Mmm, tack! Vad gott!" */
    thanksSound: 'sounds/mmm_tack.mp3',
    /** One too many: "Oj, nu fick jag för mycket! Vi försöker igen." */
    fullSound: 'sounds/nu_fick_jag_for_mycket.mp3',
    eatSound: 'sounds/nom.mp3',
    /** Overfeed sequence: swell (rising wobble) → big cartoon burp → dizzy chirps → deflate sigh */
    inflateSound: 'sounds/inflate.mp3',
    burpSound: 'sounds/burp.mp3',
    dizzySound: 'sounds/dizzy.mp3',
    deflateSound: 'sounds/deflate.mp3',
    bubblesSound: 'sounds/bubbles.mp3',
    successSound: 'sounds/success.mp3',
    images: {
        background: 'images/background.webp',
        backgroundFallback: 'images/background.jpg',
        fishClosed: 'fish_closed',
        fishOpen: 'fish_open',
        /** Overstuffed frame (round cheeks, goggle eyes) shown at the peak of the overfeed */
        fishStuffed: 'fish_stuffed'
    },
    /** Food items on the plate each round (always more than the largest target) */
    plateCount: 8,
    minCount: 1,
    maxCount: 6,
    roundsToComplete: 3,
    /**
     * Relative chance per target count (keys 1–6). Higher = more often.
     * Favours 1–3 so the youngest players meet small numbers most.
     */
    countWeights: {
        1: 4,
        2: 4,
        3: 4,
        4: 2,
        5: 2,
        6: 1
    }
});
