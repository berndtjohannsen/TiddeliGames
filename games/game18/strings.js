// Local strings and resources for "Hitta kaninen?" (Game 18)
window.GAME18_STRINGS = Object.freeze({
    title: 'Hitta kaninen?',
    instructions: 'Lyssna och peka på rätt sak.',
    /** Shown briefly when the child taps the room floor instead of a prop */
    missTapHint: 'Peka på en möbel!',
    labels: {
        continue: 'Fortsätt',
        back: 'Tillbaka',
        listen: 'Lyssna igen'
    },
    dialog: {
        title: 'Bra jobbat!',
        message: 'Du hittade alla sakerna!'
    },
    aria: {
        listen: 'Spela om frågan',
        item: (label) => `Sak: ${label}`,
        scene: 'Rummet med möbler'
    },
    ambience: {
        track: 'sounds/background.mp3'
    },
    // Placeholder: intro clip before the colour + object phrase (replace when final audio exists)
    promptIntroSound: 'sounds/PekaPaDen.mp3',
    successSound: 'sounds/success.mp3',
    errorSound: 'sounds/oups.mp3',
    rabbitSound: 'sounds/rabbit-happy.mp3',
    images: {
        background: 'images/background.jpg',
        rabbit: 'images/rabbit.png',
        rabbitJump: 'images/rabbit-jump.png'
    },
    // Colours that match sprites in images/items/*_{färg}.png
    colors: [
        { id: 'bla', label: 'blå', definite: 'blå', hex: '#2563eb' },
        { id: 'rod', label: 'röd', definite: 'röda', hex: '#dc2626' },
        { id: 'gron', label: 'grön', definite: 'gröna', hex: '#16a34a' },
        { id: 'gul', label: 'gul', definite: 'gula', hex: '#eab308' },
        { id: 'vit', label: 'vit', definite: 'vita', hex: '#f1f5f9' },
        { id: 'svart', label: 'svart', definite: 'svarta', hex: '#1e293b' },
        { id: 'orange', label: 'orange', definite: 'orangea', hex: '#f97316' },
        { id: 'rosa', label: 'rosa', definite: 'rosa', hex: '#ec4899' }
    ],
    /** Every furniture type uses these (sprites in assets). */
    baseColorIds: ['bla', 'rod', 'gron', 'gul'],
    /** Extra colours (vit, svart, orange, rosa) — sprites under images/items and images/containers. */
    extendedColorIds: ['vit', 'svart', 'orange', 'rosa'],
    /** All furniture types use the full palette when sprites exist (SVG fallback if a file is missing). */
    extendedColorItemTypeIds: ['stol', 'bord', 'sang', 'soffa', 'pall', 'korg', 'lada', 'skap'],
    /** Which colours may appear for a given furniture type in a normal round */
    colorsForItemType(itemTypeId) {
        const base = this.baseColorIds || [];
        const extended = this.extendedColorIds || [];
        const extendedTypes = this.extendedColorItemTypeIds || [];
        return this.colors.filter((c) => {
            if (base.includes(c.id)) return true;
            return extendedTypes.includes(itemTypeId) && extended.includes(c.id);
        });
    },
    // Furniture types (id = filename prefix; definite noun for prompts)
    itemTypes: [
        { id: 'stol', label: 'stol', definite: 'stolen' },
        { id: 'bord', label: 'bord', definite: 'bordet' },
        { id: 'sang', label: 'säng', definite: 'sängen' },
        { id: 'soffa', label: 'soffa', definite: 'soffan' },
        { id: 'pall', label: 'pall', definite: 'pallen' },
        { id: 'korg', label: 'korg', definite: 'korgen' },
        { id: 'lada', label: 'låda', definite: 'lådan' },
        { id: 'skap', label: 'skåp', definite: 'skåpet' }
    ],
    // Spoken prompt pattern: "Peka på den blå stolen."
    buildPromptText(color, itemType) {
        const c = color.definite || color.label;
        const thing = itemType.definite || itemType.label;
        return `Peka på den ${c} ${thing}.`;
    },
    // Optional per-prompt MP3 when you add them: sounds/prompts/bla_stol.mp3
    promptSoundFor(colorId, itemTypeId) {
        return `sounds/prompts/${colorId}_${itemTypeId}.mp3`;
    },
    /** Container types use closed/open pairs in images/containers/ */
    containerItemIds: ['korg', 'lada', 'skap'],
    /**
     * Furniture sprites — items/ for most; containers/ with _closed on the floor.
     * Missing files fall back to built-in SVG in game.js.
     */
    itemSpritePath(colorId, itemTypeId) {
        const containers = this.containerItemIds || [];
        if (containers.includes(itemTypeId)) {
            return `images/containers/${itemTypeId}_${colorId}_closed.png`;
        }
        return `images/items/${itemTypeId}_${colorId}.png`;
    },
    containerOpenSpritePath(colorId, itemTypeId) {
        return `images/containers/${itemTypeId}_${colorId}_open.png`;
    }
});
