// Hitta kaninen? (Game 18) – hear the prompt, tap the matching coloured furniture
'use strict';

const STRINGS = window.GAME18_STRINGS || {};
const GAME18_ASSETS = window.TiddeliAssets;
const COLORS = Array.isArray(STRINGS.colors) ? STRINGS.colors.slice() : [];
const ITEM_TYPES = Array.isArray(STRINGS.itemTypes) ? STRINGS.itemTypes.slice() : [];
const MIN_ITEMS = 3;
const MAX_ITEMS = 5;
/** How long confetti + open container stay visible before pop-out (matches game18-pop-out in CSS) */
const CELEBRATION_HOLD_MS = 520;
const FOUND_POP_OUT_MS = 450;
const CONFETTI_COLORS = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#fb923c', '#c084fc', '#f87171'];

/**
 * Colour helpers for shaded kid-friendly furniture SVGs.
 */
function parseHexColor(hex) {
    const raw = (hex || '#888888').replace('#', '');
    if (raw.length !== 6) return { r: 136, g: 136, b: 136 };
    return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16)
    };
}

function mixRgb(a, b, t) {
    return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t
    };
}

function rgbToCss({ r, g, b }) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

function furniturePalette(mainHex) {
    const base = parseHexColor(mainHex);
    const black = { r: 30, g: 41, b: 59 };
    return {
        main: rgbToCss(base),
        dark: rgbToCss(mixRgb(base, black, 0.35)),
        light: rgbToCss(mixRgb(base, { r: 255, g: 255, b: 255 }, 0.45)),
        shine: rgbToCss(mixRgb(base, { r: 255, g: 255, b: 255 }, 0.7)),
        outline: '#1e293b',
        wood: '#92400e',
        woodDark: '#78350f',
        pillow: rgbToCss(mixRgb(base, { r: 255, g: 255, b: 255 }, 0.55)),
        shade: 'rgba(15,23,42,0.22)'
    };
}

/** Soft ground shadow under each prop */
function svgFloorShadow() {
    return '<ellipse cx="40" cy="72" rx="26" ry="5" fill="rgba(15,23,42,0.18)"/>';
}

/**
 * Cartoon furniture illustrations (80×80 viewBox); main colour comes from the round target.
 */
function buildFurnitureSvgMarkup(itemTypeId, mainHex, gradId) {
    const p = furniturePalette(mainHex);
    const defs = `
        <defs>
            <linearGradient id="${gradId}-body" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="${p.light}"/>
                <stop offset="55%" stop-color="${p.main}"/>
                <stop offset="100%" stop-color="${p.dark}"/>
            </linearGradient>
            <linearGradient id="${gradId}-shade" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${p.shine}"/>
                <stop offset="100%" stop-color="${p.main}"/>
            </linearGradient>
        </defs>`;

    const stroke = `stroke="${p.outline}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;

    const drawings = {
        stol: `
            ${svgFloorShadow()}
            <rect x="22" y="48" width="5" height="14" rx="1.5" fill="${p.woodDark}" ${stroke}/>
            <rect x="53" y="48" width="5" height="14" rx="1.5" fill="${p.woodDark}" ${stroke}/>
            <rect x="24" y="44" width="4" height="12" rx="1.5" fill="${p.wood}" ${stroke}/>
            <rect x="52" y="44" width="4" height="12" rx="1.5" fill="${p.wood}" ${stroke}/>
            <rect x="18" y="38" width="44" height="9" rx="3" fill="url(#${gradId}-body)" ${stroke}/>
            <path d="M20 38V22c0-4 3-7 7-7h26c4 0 7 3 7 7v16" fill="url(#${gradId}-shade)" ${stroke}/>
            <rect x="26" y="24" width="28" height="12" rx="4" fill="${p.shine}" opacity="0.35"/>
            <circle cx="40" cy="42" r="2" fill="${p.outline}" opacity="0.15"/>
        `,
        bord: `
            ${svgFloorShadow()}
            <rect x="34" y="40" width="12" height="18" rx="2" fill="${p.wood}" ${stroke}/>
            <ellipse cx="40" cy="40" rx="14" ry="3" fill="${p.woodDark}" ${stroke}/>
            <path d="M12 28h56c2 0 4 2 4 4v4c0 2-2 4-4 4H12c-2 0-4-2-4-4v-4c0-2 2-4 4-4z"
                fill="url(#${gradId}-body)" ${stroke}/>
            <path d="M16 30h48v3H16z" fill="${p.shine}" opacity="0.5"/>
            <ellipse cx="40" cy="26" rx="22" ry="6" fill="url(#${gradId}-shade)" ${stroke}/>
            <circle cx="40" cy="28" r="7" fill="${p.pillow}" ${stroke}/>
            <circle cx="40" cy="28" r="3" fill="${p.shine}" opacity="0.6"/>
        `,
        sang: `
            ${svgFloorShadow()}
            <rect x="10" y="50" width="60" height="8" rx="2" fill="${p.woodDark}" ${stroke}/>
            <rect x="12" y="42" width="56" height="10" rx="3" fill="url(#${gradId}-body)" ${stroke}/>
            <path d="M12 42V30c0-3 2-5 5-5h8l4 6h24l4-6h8c3 0 5 2 5 5v12" fill="url(#${gradId}-shade)" ${stroke}/>
            <rect x="16" y="34" width="22" height="10" rx="4" fill="${p.pillow}" ${stroke}/>
            <path d="M18 36h18v2H18z" fill="${p.shine}" opacity="0.45"/>
            <rect x="42" y="36" width="26" height="6" rx="2" fill="${p.light}" opacity="0.85" ${stroke}/>
            <line x1="14" y1="50" x2="66" y2="50" stroke="${p.outline}" stroke-width="1.2" opacity="0.25"/>
        `,
        lampa: `
            ${svgFloorShadow()}
            <ellipse cx="40" cy="68" rx="14" ry="4" fill="${p.woodDark}" ${stroke}/>
            <rect x="37" y="44" width="6" height="22" rx="2" fill="${p.wood}" ${stroke}/>
            <path d="M22 44h36l-6 20H28L22 44z" fill="url(#${gradId}-body)" ${stroke}/>
            <path d="M26 46h28l-4 14H30l-4-14z" fill="${p.shine}" opacity="0.35"/>
            <ellipse cx="40" cy="42" rx="20" ry="5" fill="url(#${gradId}-shade)" ${stroke}/>
            <path d="M40 14v10" stroke="${p.woodDark}" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="40" cy="12" r="3" fill="${p.shine}" ${stroke}/>
            <ellipse cx="40" cy="38" rx="8" ry="3" fill="#fef08a" opacity="0.55"/>
        `,
        soffa: `
            ${svgFloorShadow()}
            <rect x="14" y="50" width="6" height="10" rx="1.5" fill="${p.woodDark}" ${stroke}/>
            <rect x="60" y="50" width="6" height="10" rx="1.5" fill="${p.woodDark}" ${stroke}/>
            <path d="M10 38h60v22H10z" fill="url(#${gradId}-body)" ${stroke}/>
            <path d="M10 38c0-8 6-14 14-14h32c8 0 14 6 14 14v6H10v-6z" fill="url(#${gradId}-shade)" ${stroke}/>
            <rect x="8" y="34" width="10" height="22" rx="5" fill="${p.dark}" ${stroke}/>
            <rect x="62" y="34" width="10" height="22" rx="5" fill="${p.dark}" ${stroke}/>
            <rect x="18" y="40" width="44" height="12" rx="4" fill="${p.pillow}" ${stroke}/>
            <path d="M22 42h36v3H22z" fill="${p.shine}" opacity="0.4"/>
            <circle cx="24" cy="48" r="2" fill="${p.outline}" opacity="0.12"/>
            <circle cx="56" cy="48" r="2" fill="${p.outline}" opacity="0.12"/>
        `
    };

    const body = drawings[itemTypeId] || drawings.stol;
    return defs + body;
}

/** Vector fallback when no PNG/WebP sprite exists for this colour + item */
function createFurnitureSvgElement(itemTypeId, mainHex) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'game18-item__svg');
    svg.setAttribute('viewBox', '0 0 80 80');
    svg.setAttribute('aria-hidden', 'true');
    const gradId = `g18-${itemTypeId}-${Math.random().toString(36).slice(2, 8)}`;
    svg.innerHTML = buildFurnitureSvgMarkup(itemTypeId, mainHex, gradId);
    return svg;
}

function resolveGame18Asset(path) {
    if (!path) return '';
    if (GAME18_ASSETS && typeof GAME18_ASSETS.resolveGameAsset === 'function') {
        return GAME18_ASSETS.resolveGameAsset('game18', path);
    }
    return path;
}

let titleEl = null;
let instructionsEl = null;
let fieldEl = null;
let stageEl = null;
let itemsLayer = null;
let listenButton = null;
let confettiCanvas = null;
let confettiCtx = null;
let rabbitBurstEl = null;
let rabbitBurstImg = null;
let completionDialog = null;
let completionTitle = null;
let completionMessage = null;
let continueButton = null;
let dialogBackButton = null;
let missTapLayer = null;
let missHintTimer = null;
let defaultInstructionsText = '';
let audioContext = null;
let backgroundBuffer = null;
let backgroundSource = null;
let backgroundGain = null;
const audioBufferCache = new Map();
/** URLs that returned 404 or failed decode — avoids refetching missing assets every round */
const failedAudioUrls = new Set();
let promptSource = null;
let promptPlaybackResolve = null;
/** Resolves the active speakText() promise when speech is cancelled or finishes */
let speakPlaybackResolve = null;
let confettiAnimFrame = null;
/** Correct tap queued while a previous correct sequence is still finishing */
let pendingCorrectTap = null;
/** Bumped when a prompt is interrupted so its finally block does not flip canAnswer */
let promptGeneration = 0;
/** Serialises correct-answer side effects (one celebration at a time) */
let correctClickChain = Promise.resolve();

const state = {
    sceneItems: [],
    target: null,
    roundComplete: false,
    /** Child may tap an answer (after the question was heard for the current target) */
    canAnswer: false,
    /** Question audio is playing */
    promptBusy: false,
    /** Rabbit / confetti after a correct tap */
    celebrating: false,
    audioStarted: false,
    audioStarting: false,
    confetti: []
};

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    setupRabbitBurst();
    attachEventListeners();
    resizeConfettiCanvas();
    prefetchRoundSfx();
    startNewRound();
    requestBackgroundAudioStart();
});

function cacheDomElements() {
    titleEl = document.getElementById('game18-title');
    instructionsEl = document.getElementById('instructions-text');
    fieldEl = document.getElementById('game18-field');
    stageEl = document.getElementById('game18-stage');
    if (stageEl) {
        stageEl.setAttribute('tabindex', '-1');
        missTapLayer = document.createElement('div');
        missTapLayer.className = 'game18-miss-taps';
        missTapLayer.setAttribute('aria-hidden', 'true');
        stageEl.appendChild(missTapLayer);
    }
    itemsLayer = document.getElementById('items-layer');
    listenButton = document.getElementById('listen-button');
    confettiCanvas = document.getElementById('confetti-canvas');
    confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
    rabbitBurstEl = document.getElementById('rabbit-burst');
    rabbitBurstImg = document.getElementById('rabbit-burst-img');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
    dialogBackButton = document.getElementById('dialog-back-button');

    const sceneSurface = stageEl || fieldEl;
    if (sceneSurface) {
        const bgPath = STRINGS.images && STRINGS.images.background;
        if (bgPath) {
            const bgUrl = resolveGame18Asset(bgPath);
            sceneSurface.style.backgroundImage = `url('${bgUrl}')`;
            sceneSurface.style.backgroundSize = 'cover';
            sceneSurface.style.backgroundPosition = 'center center';
        }
        if (STRINGS.aria && STRINGS.aria.scene) {
            sceneSurface.setAttribute('aria-label', STRINGS.aria.scene);
        }
    }
}

function populateStaticTexts() {
    if (titleEl) titleEl.textContent = STRINGS.title || '';
    defaultInstructionsText = STRINGS.instructions || '';
    if (instructionsEl) instructionsEl.textContent = defaultInstructionsText;
    if (continueButton) continueButton.textContent = (STRINGS.labels && STRINGS.labels.continue) || 'Fortsätt';
    if (dialogBackButton) dialogBackButton.textContent = (STRINGS.labels && STRINGS.labels.back) || 'Tillbaka';
    if (completionTitle) completionTitle.textContent = (STRINGS.dialog && STRINGS.dialog.title) || '';
    if (completionMessage) completionMessage.textContent = (STRINGS.dialog && STRINGS.dialog.message) || '';
    if (listenButton && STRINGS.aria && STRINGS.aria.listen) {
        listenButton.setAttribute('aria-label', STRINGS.aria.listen);
    }
}

function setupRabbitBurst() {
    if (!rabbitBurstImg) return;
    const images = STRINGS.images || {};
    const jumpPath = images.rabbitJump || images.rabbit;
    if (jumpPath) rabbitBurstImg.src = resolveGame18Asset(jumpPath);
}

function isContainerEntry(entry) {
    const ids = STRINGS.containerItemIds || [];
    return Boolean(entry?.itemType?.id && ids.includes(entry.itemType.id));
}

/** True when this scene object is the one we asked for (same entry reference as state.target) */
function isEntryTarget(entry) {
    if (!state.target || !entry) return false;
    return state.target === entry;
}

function attachEventListeners() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('volumechange', handleVolumeChange);
    window.addEventListener('resize', () => {
        resizeConfettiCanvas();
    });
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
        document.addEventListener(eventName, handleFirstInteraction, { once: true });
    });
    if (continueButton) continueButton.addEventListener('click', handleContinueClick);
    if (dialogBackButton) dialogBackButton.addEventListener('click', handleDialogBackClick);
    if (listenButton) listenButton.addEventListener('click', handleListenClick);
    if (fieldEl) {
        fieldEl.addEventListener('click', handlePlayAreaClick);
    }
}

/** Scene entry under screen coordinates — topmost prop wins when sprites overlap */
function findSceneEntryAtPoint(clientX, clientY) {
    const hits = state.sceneItems
        .filter((entry) => entry.el && !entry.el.classList.contains('game18-item--found'))
        .map((entry) => ({
            entry,
            z: Number.parseInt(entry.el.style.zIndex, 10) || 0
        }))
        .sort((a, b) => b.z - a.z);

    for (const { entry } of hits) {
        const r = entry.el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
            return entry;
        }
    }
    return null;
}

function notePendingCorrectTap(entry) {
    if (entry && isEntryTarget(entry)) {
        pendingCorrectTap = entry;
    }
}

function tryConsumePendingCorrectTap() {
    if (!pendingCorrectTap) return;
    const entry = pendingCorrectTap;
    beginCorrectAnswer(entry);
}

/**
 * Accept a correct tap whenever it matches the current target (not only when canAnswer is true).
 * Returns false if this entry cannot be scored right now.
 */
function beginCorrectAnswer(entry) {
    if (state.roundComplete || !state.target || !isEntryTarget(entry)) return false;
    if (!state.sceneItems.includes(entry)) return false;
    if (entry.el?.classList.contains('game18-item--found')) return false;
    if (entry.el?.classList.contains('game18-item--scoring')) return false;
    entry.el.classList.add('game18-item--scoring');

    pendingCorrectTap = null;
    clearStageMissTap();

    if (state.promptBusy) {
        promptGeneration += 1;
        stopPromptPlayback();
        state.promptBusy = false;
        if (listenButton) {
            listenButton.disabled = false;
            listenButton.classList.remove('game18-listen--playing');
        }
    }

    state.celebrating = true;
    state.canAnswer = false;
    updateItemsBlocked();
    enqueueCorrectClick(entry);
    return true;
}

function enqueueCorrectClick(entry) {
    correctClickChain = correctClickChain
        .then(() => handleCorrectClick(entry))
        .catch((error) => console.warn('game18: correct answer sequence failed:', error));
}

/** Tap on the room floor (not on furniture or listen) — visual hint for the child */
function handlePlayAreaClick(event) {
    if (state.roundComplete) return;
    if (
        event.target.closest(
            '.game18-item, #listen-button, #completion-dialog, .back-button, .completion-dialog__content'
        )
    ) {
        return;
    }

    const entryUnderPointer = findSceneEntryAtPoint(event.clientX, event.clientY);
    if (entryUnderPointer) {
        void handleItemClick(entryUnderPointer);
        return;
    }

    // Ghost click after pointerup on furniture (pointer-events cleared) must not nudge the room
    if (stageEl?.querySelector('.game18-item--hold, .game18-item--scoring')) {
        return;
    }

    if (!stageEl) return;

    requestBackgroundAudioStart();

    const rect = stageEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        showMissTapRipple(x, y);
        stageEl.classList.remove('game18-stage--miss-tap');
        void stageEl.offsetWidth;
        stageEl.classList.add('game18-stage--miss-tap');
    }

    playMissTapTone();
    flashMissTapHint();

    if (!state.canAnswer && !state.promptBusy && !state.celebrating && state.target) {
        void ensureAudioContext().then(() => playQuestionForTarget());
    }
}

function clearStageMissTap() {
    stageEl?.classList.remove('game18-stage--miss-tap');
}

function showMissTapRipple(x, y) {
    if (!missTapLayer) return;
    const ripple = document.createElement('span');
    ripple.className = 'game18-miss-tap';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    missTapLayer.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

function flashMissTapHint() {
    if (!instructionsEl) return;
    const hint = STRINGS.missTapHint || 'Peka på en möbel!';
    instructionsEl.textContent = hint;
    instructionsEl.classList.add('game18-instructions--miss');
    if (missHintTimer) clearTimeout(missHintTimer);
    missHintTimer = setTimeout(() => {
        instructionsEl.textContent = defaultInstructionsText;
        instructionsEl.classList.remove('game18-instructions--miss');
        missHintTimer = null;
    }, 1600);
}

async function playMissTapTone() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    const now = audioContext.currentTime;
    const duration = 0.12;
    const baseVolume = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.2;
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(baseVolume, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
}

/** Wait for layout after new items are in the DOM (avoids prompt before stage has size) */
function afterRoundLayoutReady(callback) {
    requestAnimationFrame(() => {
        resizeConfettiCanvas();
        requestAnimationFrame(() => {
            if (callback) callback();
        });
    });
}

function startNewRound() {
    hideCompletionDialog();
    stopPromptPlayback();
    state.roundComplete = false;
    state.canAnswer = false;
    state.promptBusy = false;
    state.celebrating = false;
    state.sceneItems = [];
    state.target = null;
    state.confetti = [];
    pendingCorrectTap = null;
    hideRabbitBurst();

    if (COLORS.length < 2 || ITEM_TYPES.length < 2) {
        console.error('game18: need at least two colours and two item types');
        return;
    }

    if (itemsLayer) itemsLayer.innerHTML = '';

    const itemCount = MIN_ITEMS + Math.floor(Math.random() * (MAX_ITEMS - MIN_ITEMS + 1));
    const pairs = pickUniquePairs(itemCount);
    const positions = layoutPositions(pairs.length);

    pairs.forEach((pair, index) => {
        const entry = createSceneItem(pair.color, pair.itemType, positions[index]);
        state.sceneItems.push(entry);
        if (itemsLayer) itemsLayer.appendChild(entry.el);
    });

    state.target = state.sceneItems[Math.floor(Math.random() * state.sceneItems.length)];
    updateItemsBlocked();

    afterRoundLayoutReady(() => {
        resizeConfettiCanvas();
        prefetchRoundSfx();
        playQuestionForTarget().then((heard) => {
            if (!state.roundComplete && state.target && heard) {
                state.canAnswer = true;
            }
            updateItemsBlocked();
            tryConsumePendingCorrectTap();
        });
    });
}

/** Visual “wait” on furniture while the question plays or we celebrate (still clickable) */
function updateItemsBlocked() {
    const block = state.promptBusy || state.celebrating;
    if (itemsLayer) {
        itemsLayer.classList.toggle('game18-items--locked', block);
    }
}

/** Pick unique colour + furniture combinations (chair may use extra colour sprites). */
function pickUniquePairs(count) {
    const all = [];
    ITEM_TYPES.forEach((itemType) => {
        const palette =
            typeof STRINGS.colorsForItemType === 'function'
                ? STRINGS.colorsForItemType(itemType.id)
                : COLORS;
        palette.forEach((color) => {
            all.push({ color, itemType });
        });
    });
    return shuffleArray(all).slice(0, count);
}

/** True when a floor position would sit under the listen control (top-left of stage) */
function positionUnderListenButton(x, y) {
    return x < 30 && y < 24;
}

/** Spread items across the floor plane (matches top-down room background). */
function layoutPositions(count) {
    const slots = [];
    const minDist = 22;
    const marginX = 16;
    const marginY = 30;
    const maxY = 74;
    const attempts = 120;

    for (let n = 0; n < count; n++) {
        let placed = false;
        for (let t = 0; t < attempts && !placed; t++) {
            const candidate = {
                x: marginX + Math.random() * (100 - marginX * 2),
                y: marginY + Math.random() * (maxY - marginY)
            };
            if (positionUnderListenButton(candidate.x, candidate.y)) {
                continue;
            }
            const ok = slots.every((s) => Math.hypot(s.x - candidate.x, s.y - candidate.y) >= minDist);
            if (ok) {
                slots.push(candidate);
                placed = true;
            }
        }
        if (!placed) {
            slots.push({
                x: marginX + ((n + 1) / (count + 1)) * (100 - marginX * 2),
                y: marginY + ((n % 3) + 0.5) * ((maxY - marginY) / 3)
            });
        }
    }
    return slots;
}

function createSceneItem(color, itemType, position) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game18-item';
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    // Lower on the floor = drawn on top so taps hit the nearest prop
    button.style.zIndex = String(10 + Math.round(position.y));
    const ariaLabel =
        STRINGS.aria && STRINGS.aria.item
            ? STRINGS.aria.item(`${color.label} ${itemType.label}`)
            : `${color.label} ${itemType.label}`;
    button.setAttribute('aria-label', ariaLabel);

    const spritePath =
        typeof STRINGS.itemSpritePath === 'function'
            ? STRINGS.itemSpritePath(color.id, itemType.id)
            : `images/items/${itemType.id}_${color.id}.png`;
    const spriteUrl = resolveGame18Asset(spritePath);
    const img = document.createElement('img');
    img.className = 'game18-item__img';
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.addEventListener(
        'error',
        () => {
            if (img.dataset.fallbackSvg === '1') return;
            img.dataset.fallbackSvg = '1';
            img.remove();
            button.appendChild(createFurnitureSvgElement(itemType.id, color.hex));
        },
        { once: true }
    );
    img.src = spriteUrl;
    button.appendChild(img);

    const entry = {
        color,
        itemType,
        el: button,
        imgEl: img
    };
    let skipClickAfterPointer = false;
    button.addEventListener('pointerup', (event) => {
        event.stopPropagation();
        event.preventDefault();
        skipClickAfterPointer = true;
        handleItemClick(entry);
        window.setTimeout(() => {
            skipClickAfterPointer = false;
        }, 400);
    });
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (skipClickAfterPointer) return;
        handleItemClick(entry);
    });
    return entry;
}

async function handleItemClick(entry) {
    if (state.roundComplete || !state.target) return;
    if (!state.sceneItems.includes(entry)) return;
    if (entry.el?.classList.contains('game18-item--found')) return;
    if (entry.el?.classList.contains('game18-item--scoring')) return;

    requestBackgroundAudioStart();

    if (isEntryTarget(entry)) {
        if (beginCorrectAnswer(entry)) return;
        if (state.celebrating) {
            notePendingCorrectTap(entry);
            return;
        }
    }

    if (state.celebrating || state.promptBusy) return;

    await ensureAudioContext();

    if (!state.canAnswer) {
        await playQuestionForTarget();
        return;
    }

    entry.el.classList.add('game18-item--wrong');
    playSfxUrl(resolveGame18Asset(STRINGS.errorSound)).catch(() => playErrorTone());
    setTimeout(() => entry.el.classList.remove('game18-item--wrong'), 420);
}

function getItemStagePoint(entry) {
    const rect = entry.el.getBoundingClientRect();
    const fieldRect = stageEl
        ? stageEl.getBoundingClientRect()
        : fieldEl
          ? fieldEl.getBoundingClientRect()
          : rect;
    return {
        x: rect.left + rect.width / 2 - fieldRect.left,
        y: rect.top + rect.height / 2 - fieldRect.top
    };
}

/** Show rabbit + play squeak immediately (no await — celebration timing is handled separately) */
function beginRabbitBurstAt(x, y) {
    if (!rabbitBurstEl) return;
    hideRabbitBurst();
    rabbitBurstEl.style.left = `${x}px`;
    rabbitBurstEl.style.top = `${y}px`;
    rabbitBurstEl.hidden = false;
    rabbitBurstEl.setAttribute('aria-hidden', 'false');
    void rabbitBurstEl.offsetWidth;
    rabbitBurstEl.classList.add('game18-rabbit-burst--show');

    const rabbitUrl = resolveGame18Asset(STRINGS.rabbitSound);
    const cached = rabbitUrl ? audioBufferCache.get(rabbitUrl) : null;
    if (cached && audioContext && audioContext.state === 'running') {
        playSfxFromBuffer(cached);
    } else {
        void playSfxUrl(rabbitUrl).catch(() => {});
    }
}

function hideRabbitBurst() {
    if (!rabbitBurstEl) return;
    rabbitBurstEl.classList.remove('game18-rabbit-burst--show');
    rabbitBurstEl.hidden = true;
    rabbitBurstEl.setAttribute('aria-hidden', 'true');
}

/** Blur found items so the next tap is not eaten by a stale focused button */
function releaseItemFocus(el) {
    if (el && document.activeElement === el) {
        el.blur();
    }
}

/** Stop further taps without starting the shrink-away animation */
function disableItemTap(entry) {
    const el = entry.el;
    if (!el) return;
    el.setAttribute('aria-disabled', 'true');
    el.classList.remove('game18-item--scoring');
    // After pointerup, Chrome still fires click; defer so it does not fall through to the floor
    window.setTimeout(() => {
        el.style.pointerEvents = 'none';
    }, 0);
    releaseItemFocus(el);
}

function playFoundPopOut(entry) {
    const el = entry.el;
    if (!el) return;
    el.classList.remove('game18-item--hold');
    el.classList.add('game18-item--found');
}

function markItemAsFound(entry) {
    disableItemTap(entry);
    playFoundPopOut(entry);
}

/** korg / låda / skåp: show open lid while confetti plays (pop-out comes later) */
function openContainerSprite(entry) {
    if (!isContainerEntry(entry) || !entry.imgEl) return;
    const openPath =
        typeof STRINGS.containerOpenSpritePath === 'function'
            ? STRINGS.containerOpenSpritePath(entry.color.id, entry.itemType.id)
            : `images/containers/${entry.itemType.id}_${entry.color.id}_open.png`;
    entry.imgEl.src = resolveGame18Asset(openPath);
    entry.el.classList.add('game18-item--open');
}

function clearStaleItemFocus() {
    const active = document.activeElement;
    if (!active || !active.classList || !active.classList.contains('game18-item')) return;
    if (active.classList.contains('game18-item--found')) {
        active.blur();
    }
}

async function handleCorrectClick(entry) {
    if (entry.el?.classList.contains('game18-item--found')) return;

    stopPromptPlayback();

    const { x: cx, y: cy } = getItemStagePoint(entry);
    disableItemTap(entry);
    entry.el?.classList.add('game18-item--hold');
    if (isContainerEntry(entry)) {
        openContainerSprite(entry);
    }
    spawnConfetti(cx, cy, 48);
    beginRabbitBurstAt(cx, cy);
    triggerSuccessFeedback();

    state.sceneItems = state.sceneItems.filter((item) => item !== entry);
    if (state.sceneItems.length === 0) {
        state.target = null;
    } else if (state.target === entry) {
        state.target = state.sceneItems[Math.floor(Math.random() * state.sceneItems.length)];
    }
    const hasMore = state.sceneItems.length > 0;

    state.celebrating = false;
    updateItemsBlocked();
    tryConsumePendingCorrectTap();

    await sleep(CELEBRATION_HOLD_MS);
    hideRabbitBurst();

    playFoundPopOut(entry);
    await sleep(FOUND_POP_OUT_MS);

    if (entry.el.parentNode) entry.el.remove();

    if (!hasMore) {
        state.roundComplete = true;
        state.celebrating = false;
        state.canAnswer = false;
        updateItemsBlocked();
        showCompletionDialog();
        return;
    }

    const heardNext = await playQuestionForTarget();

    state.canAnswer = heardNext;
    updateItemsBlocked();
    tryConsumePendingCorrectTap();
}

async function handleListenClick() {
    if (state.roundComplete || state.celebrating || state.promptBusy) return;
    requestBackgroundAudioStart();
    await ensureAudioContext();
    const heard = await playQuestionForTarget();
    if (heard) {
        state.canAnswer = true;
    }
    updateItemsBlocked();
    tryConsumePendingCorrectTap();
}

/** Play "Peka på …" for state.target; returns true if audio actually played */
async function playQuestionForTarget() {
    if (!state.target || state.roundComplete) return false;
    if (state.promptBusy) return false;

    const promptGen = ++promptGeneration;
    state.promptBusy = true;
    state.canAnswer = false;
    updateItemsBlocked();

    if (listenButton) {
        listenButton.disabled = true;
        listenButton.classList.add('game18-listen--playing');
    }

    let heardPrompt = false;

    try {
        await ensureAudioContext();
        if (!audioContext || audioContext.state !== 'running') {
            return false;
        }

        const { color, itemType } = state.target;
        const fullText =
            typeof STRINGS.buildPromptText === 'function'
                ? STRINGS.buildPromptText(color, itemType)
                : `Peka på den ${color.label} ${itemType.definite}.`;

        const introPath = resolveGame18Asset(STRINGS.promptIntroSound || '');
        const specificPath = resolveGame18Asset(
            typeof STRINGS.promptSoundFor === 'function'
                ? STRINGS.promptSoundFor(color.id, itemType.id)
                : ''
        );

        // Intro ("Peka på den") then tail clip (e.g. chair colour) or TTS for the rest
        const playedIntro = await playBufferUrlIfExists(introPath);
        const playedSpecific = await playBufferUrlIfExists(specificPath);
        if (!playedSpecific) {
            if (playedIntro) {
                const tail = fullText.replace(/^Peka på den\s+/i, '');
                await speakText(tail);
            } else {
                await speakText(fullText);
            }
        }

        heardPrompt = true;
    } catch (error) {
        console.warn('Could not play spoken prompt:', error);
    } finally {
        if (promptGen === promptGeneration) {
            state.promptBusy = false;
            if (listenButton) {
                listenButton.disabled = false;
                listenButton.classList.remove('game18-listen--playing');
            }
            clearStaleItemFocus();
            if (heardPrompt && !state.celebrating && !state.roundComplete && state.target) {
                state.canAnswer = true;
            }
            updateItemsBlocked();
            tryConsumePendingCorrectTap();
        }
    }

    return heardPrompt;
}

function finishSpeakText() {
    if (speakPlaybackResolve) {
        const done = speakPlaybackResolve;
        speakPlaybackResolve = null;
        done();
    }
}

function speakText(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis || !text) {
            resolve();
            return;
        }
        finishSpeakText();
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            if (speakPlaybackResolve === finish) {
                speakPlaybackResolve = null;
            }
            resolve();
        };
        speakPlaybackResolve = finish;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'sv-SE';
        utter.rate = 0.92;
        utter.onend = finish;
        utter.onerror = finish;
        const safetyMs = Math.min(20000, Math.max(5000, text.length * 130));
        setTimeout(finish, safetyMs);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
    });
}

function spawnConfetti(x, y, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 90 + Math.random() * 200;
        state.confetti.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 80,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 8,
            life: 1.2 + Math.random() * 0.6,
            age: 0,
            size: 4 + Math.random() * 5,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
        });
    }
    if (!confettiAnimFrame) {
        let last = performance.now();
        const tick = (now) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            updateConfetti(dt);
            drawConfetti();
            if (state.confetti.length) {
                confettiAnimFrame = requestAnimationFrame(tick);
            } else {
                confettiAnimFrame = null;
                if (confettiCtx && confettiCanvas) {
                    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
                }
            }
        };
        confettiAnimFrame = requestAnimationFrame(tick);
    }
}

function resizeConfettiCanvas() {
    const bounds = stageEl || fieldEl;
    if (!confettiCanvas || !bounds) return;
    const rect = bounds.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    confettiCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    if (confettiCtx) confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateConfetti(dt) {
    const gravity = 320;
    state.confetti = state.confetti.filter((p) => {
        p.age += dt;
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        return p.age < p.life;
    });
}

function drawConfetti() {
    if (!confettiCtx || !confettiCanvas) return;
    const w = confettiCanvas.width / (Math.min(window.devicePixelRatio || 1, 2));
    const h = confettiCanvas.height / (Math.min(window.devicePixelRatio || 1, 2));
    confettiCtx.clearRect(0, 0, w, h);
    state.confetti.forEach((p) => {
        const alpha = Math.max(0, 1 - p.age / p.life);
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.fillStyle = p.color;
        confettiCtx.globalAlpha = alpha;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        confettiCtx.restore();
    });
    confettiCtx.globalAlpha = 1;
}

async function playBufferUrlIfExists(url) {
    if (!url) return false;
    const buffer = await loadAudioBuffer(url);
    if (!buffer) return false;
    await playBufferUrl(url);
    return true;
}

/** Fire-and-forget SFX when buffer is already decoded (no fetch / resume wait) */
function playSfxFromBuffer(buffer, volumeScale = 1.3) {
    if (!buffer || !audioContext || audioContext.state !== 'running') return;
    try {
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        gain.gain.setValueAtTime(Math.min(1, volume * volumeScale), audioContext.currentTime);
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(audioContext.destination);
        source.start(0);
    } catch (_) {
        // ignore
    }
}

/** Short effects (success, rabbit, error) — does not stop the spoken prompt */
async function playSfxUrl(url) {
    if (!url) return;
    let buffer = audioBufferCache.get(url);
    if (!buffer) {
        buffer = await loadAudioBuffer(url);
    }
    if (!buffer) return;
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;

    return new Promise((resolve) => {
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        gain.gain.setValueAtTime(Math.min(1, volume * 1.3), audioContext.currentTime);
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(audioContext.destination);
        source.onended = () => resolve();
        try {
            source.start(0);
        } catch (_) {
            resolve();
        }
    });
}

/** Spoken prompt clips — only one at a time */
async function playBufferUrl(url) {
    const buffer = await loadAudioBuffer(url);
    if (!buffer || !audioContext) return;

    return new Promise((resolve) => {
        stopPromptPlayback();
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        gain.gain.setValueAtTime(Math.min(1, volume * 1.3), audioContext.currentTime);
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(audioContext.destination);
        promptSource = source;
        promptPlaybackResolve = resolve;
        source.onended = () => {
            if (promptSource === source) promptSource = null;
            promptPlaybackResolve = null;
            resolve();
        };
        try {
            source.start(0);
        } catch (_) {
            promptSource = null;
            promptPlaybackResolve = null;
            resolve();
        }
    });
}

function stopPromptPlayback() {
    if (promptSource) {
        try {
            promptSource.onended = null;
            promptSource.stop();
        } catch (_) {
            // already stopped
        }
        promptSource = null;
    }
    if (promptPlaybackResolve) {
        const resolveFn = promptPlaybackResolve;
        promptPlaybackResolve = null;
        resolveFn();
    }
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    finishSpeakText();
}

/** Warm success / rabbit / error clips so the first correct tap does not wait on fetch */
function prefetchRoundSfx() {
    const paths = [STRINGS.successSound, STRINGS.rabbitSound, STRINGS.errorSound];
    paths.forEach((path) => {
        const url = resolveGame18Asset(path);
        if (url) void loadAudioBuffer(url);
    });
}

async function loadAudioBuffer(url) {
    if (!url) return null;
    if (failedAudioUrls.has(url)) return null;
    if (audioBufferCache.has(url)) return audioBufferCache.get(url);
    await ensureAudioContext();
    if (!audioContext) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            failedAudioUrls.add(url);
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferCache.set(url, buffer);
        return buffer;
    } catch (error) {
        console.warn('Could not load audio:', url, error);
        return null;
    }
}

/** Success ding on the same frame as confetti when AudioContext is already running */
function playSuccessChimeSync() {
    if (!audioContext || audioContext.state !== 'running') return false;
    const now = audioContext.currentTime;
    const vol = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.22;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        const start = now + i * 0.05;
        const duration = 0.16;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.015);
        gain.gain.linearRampToValueAtTime(0, start + duration);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    });
    return true;
}

function triggerSuccessFeedback() {
    const url = resolveGame18Asset(STRINGS.successSound);
    const cached = url ? audioBufferCache.get(url) : null;

    const playNow = () => {
        if (!audioContext || audioContext.state !== 'running') return false;
        if (cached) {
            playSfxFromBuffer(cached);
            return true;
        }
        return playSuccessChimeSync();
    };

    if (playNow()) return;
    void ensureAudioContext().then(() => {
        if (cached) {
            playSfxFromBuffer(cached);
        } else {
            playSuccessChimeSync();
        }
    });
}

/** Plays success MP3 when present on the assets host; otherwise a short chime (no 404 required) */
async function playSuccessFeedback() {
    triggerSuccessFeedback();
}

async function playErrorTone() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'triangle';
    const now = audioContext.currentTime;
    const duration = 0.2;
    const baseVolume = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.35;
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.linearRampToValueAtTime(500, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(baseVolume, now + 0.03);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
}

function shuffleArray(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function showCompletionDialog() {
    if (!completionDialog) return;
    stopPromptPlayback();
    stopBackgroundAmbience();
    completionDialog.hidden = false;
    if (window.playSharedCompletionSound) {
        window.playSharedCompletionSound(audioContext, 0.8).catch(() => {});
    }
}

function hideCompletionDialog() {
    if (completionDialog) completionDialog.hidden = true;
}

function handleContinueClick() {
    hideCompletionDialog();
    requestBackgroundAudioStart();
    startNewRound();
}

function handleDialogBackClick() {
    window.location.href = '../../index.html';
}

async function ensureAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Could not create AudioContext:', error);
            return null;
        }
    }
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Could not resume AudioContext:', error);
        }
    }
    return audioContext;
}

function requestBackgroundAudioStart() {
    if (state.audioStarted || state.audioStarting) return;
    state.audioStarting = true;
    startBackgroundAmbience()
        .then(() => {
            state.audioStarted = true;
        })
        .catch((error) => {
            console.warn('Could not start background audio:', error);
        })
        .finally(() => {
            state.audioStarting = false;
        });
}

async function startBackgroundAmbience() {
    await ensureAudioContext();
    if (!audioContext || backgroundSource) return;
    const track = STRINGS.ambience && STRINGS.ambience.track;
    if (!track) return;
    const buffer = await loadAudioBuffer(resolveGame18Asset(track));
    if (!buffer) return;
    backgroundBuffer = buffer;
    backgroundSource = audioContext.createBufferSource();
    backgroundSource.buffer = backgroundBuffer;
    backgroundSource.loop = true;
    backgroundGain = audioContext.createGain();
    const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
    backgroundGain.gain.setValueAtTime(volume * 0.28, audioContext.currentTime);
    backgroundSource.connect(backgroundGain);
    backgroundGain.connect(audioContext.destination);
    backgroundSource.start();
}

function stopBackgroundAmbience() {
    if (backgroundSource) {
        try {
            backgroundSource.stop();
        } catch (_) {
            // already stopped
        }
        backgroundSource = null;
    }
    if (backgroundGain) {
        try {
            backgroundGain.disconnect();
        } catch (_) {
            // already disconnected
        }
        backgroundGain = null;
    }
    state.audioStarted = false;
    state.audioStarting = false;
}

function handleFirstInteraction() {
    requestBackgroundAudioStart();
}

function handleVolumeChange(event) {
    if (!audioContext || audioContext.state !== 'running') return;
    const newVolume =
        event.detail && typeof event.detail.volume === 'number'
            ? event.detail.volume
            : window.TiddeliGamesVolume?.get() ?? 0.35;
    if (backgroundGain) {
        backgroundGain.gain.setValueAtTime(newVolume * 0.28, audioContext.currentTime);
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        if (state.promptBusy) {
            state.promptBusy = false;
            state.canAnswer = false;
            updateItemsBlocked();
        }
        stopPromptPlayback();
        if (audioContext && audioContext.state === 'running') {
            audioContext.suspend().catch(() => {});
        }
    } else if (audioContext && state.audioStarted) {
        audioContext.resume().catch(() => {});
    }
}
