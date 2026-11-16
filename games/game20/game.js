'use strict';
/**
 * Mata fisken (Game 20)
 * The fish says "Jag är hungrig! Jag vill ha tre jordgubbar." The child drags (or taps)
 * food from the plate into the fish's mouth. Each bite is counted aloud and shown.
 * Right amount → "Mmm, tack!" + flip + confetti. One extra bite within the settle
 * window → big cartoon overfeed (swell, BUURP, dizzy), "Oj, nu fick jag för mycket!", same round again (no penalty).
 * Three rounds → completion dialog with shared completion sound.
 */

const STRINGS = window.GAME20_STRINGS || {};
const MIN_COUNT = STRINGS.minCount ?? 1;
const MAX_COUNT = STRINGS.maxCount ?? 6;
const ROUNDS_TO_COMPLETE = STRINGS.roundsToComplete ?? 3;
const PLATE_COUNT = Math.max(STRINGS.plateCount ?? 8, MAX_COUNT + 1);
const AMBIENCE_GAIN = 0.45;
/** After the target is reached, one more bite in this window counts as overfeeding */
const SETTLE_MS = 1100;
const FLY_MS = 420;
/** Mouth position inside the fish sprite (fractions of the image box) */
const MOUTH_X = 0.27;
const MOUTH_Y = 0.57;
/** Distances (px) for opening the mouth while dragging, and for accepting a drop */
const OPEN_RADIUS = 150;
const EAT_RADIUS = 85;
const DRAG_THRESHOLD = 8;

const GAME20_CONFETTI_COLORS = ['#fde047', '#67e8f9', '#f472b6', '#4ade80', '#fb923c', '#c084fc', '#38bdf8'];

let instructionsEl = null;
let roundProgressEl = null;
let stageEl = null;
let fishEl = null;
let fishBodyEl = null;
let fishClosedImg = null;
let fishOpenImg = null;
let fishStuffedImg = null;
let badgeEl = null;
let tummyEl = null;
let plateEl = null;
let bubbleLayerEl = null;
let listenButton = null;
let confettiCanvas = null;
let confettiCtx = null;
let confettiStates = [];
let confettiAnimFrame = null;
let completionDialog = null;
let completionTitle = null;
let completionMessage = null;
let continueButton = null;
let dialogBackButton = null;

let audioContext = null;
let backgroundBuffer = null;
let backgroundSource = null;
let backgroundGain = null;
const audioBufferCache = new Map();
const failedAudioUrls = new Set();
const audioLoadInFlight = new Map();
let activeSpeechSource = null;

let supportsWebp = true;
let roundTargets = [];
let roundFoods = [];
let roundsWon = 0;
let targetCount = 0;
let eatenCount = 0;
let currentFood = null;
/** idle | prompt | feeding | busy | settle | celebrate | overfeed | complete */
let phase = 'idle';
let roundGeneration = 0;
let settleTimer = null;
let bubbleTimer = null;
let gameStarted = false;
/** Active pointer drag: { el, pointerId, startX, startY, dx, dy, moved } */
let drag = null;

function resolveGame20Asset(path) {
    if (!path) return '';
    if (window.TiddeliAssets && typeof window.TiddeliAssets.resolveGameAsset === 'function') {
        return window.TiddeliAssets.resolveGameAsset('game20', path);
    }
    return path;
}

function detectWebp() {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.width > 0);
        img.onerror = () => resolve(false);
        img.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    });
}

/** WebP 1x/2x by pixel ratio; PNG 1x fallback */
function spriteUrl(stem) {
    if (!supportsWebp) return resolveGame20Asset(`images/${stem}_1x.png`);
    const hi = (window.devicePixelRatio || 1) >= 1.5;
    return resolveGame20Asset(`images/${stem}_${hi ? '2x' : '1x'}.webp`);
}

function setSprite(img, stem) {
    img.src = spriteUrl(stem);
    img.addEventListener('error', () => {
        img.src = resolveGame20Asset(`images/${stem}_1x.png`);
    }, { once: true });
}

/** Debug/test: ?targets=1,2,3&foods=jordgubbar,morotter,bananer */
function readDebugParams() {
    try {
        const params = new URLSearchParams(window.location.search);
        const t = (params.get('targets') || '').split(',').map((s) => parseInt(s, 10))
            .filter((n) => n >= MIN_COUNT && n <= MAX_COUNT);
        const f = (params.get('foods') || '').split(',').map((s) => s.trim()).filter(Boolean);
        return { targets: t.length ? t : null, foods: f.length ? f : null };
    } catch (_) {
        return { targets: null, foods: null };
    }
}

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachListeners();
    void (async () => {
        supportsWebp = await detectWebp();
        setupVisuals();
        buildRoundProgress();
        resizeConfettiCanvas();
        // Audio may only start after a user gesture (autoplay policy)
        let booting = false;
        const boot = async () => {
            if (booting || gameStarted) return;
            booting = true;
            await ensureAudioContext();
            prefetchAudio();
            startGame();
        };
        void ensureAudioContext().then((ctx) => {
            if (ctx && ctx.state === 'running') void boot();
        });
        ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => {
            document.addEventListener(ev, () => { void boot(); }, { capture: true, once: true });
        });
    })();
});

function cacheDomElements() {
    instructionsEl = document.getElementById('instructions-text');
    roundProgressEl = document.getElementById('round-progress');
    stageEl = document.getElementById('game20-stage');
    fishEl = document.getElementById('fish');
    fishBodyEl = document.getElementById('fish-body');
    fishClosedImg = document.getElementById('fish-closed');
    fishOpenImg = document.getElementById('fish-open');
    fishStuffedImg = document.getElementById('fish-stuffed');
    badgeEl = document.getElementById('fish-badge');
    tummyEl = document.getElementById('fish-tummy');
    plateEl = document.getElementById('food-plate');
    bubbleLayerEl = document.getElementById('bubble-layer');
    listenButton = document.getElementById('listen-button');
    confettiCanvas = document.getElementById('game20-confetti-canvas');
    confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
    dialogBackButton = document.getElementById('dialog-back-button');
}

function populateStaticTexts() {
    if (instructionsEl) instructionsEl.textContent = '';
    if (completionTitle) completionTitle.textContent = (STRINGS.dialog && STRINGS.dialog.title) || '';
    if (completionMessage) completionMessage.textContent = (STRINGS.dialog && STRINGS.dialog.message) || '';
    if (continueButton) continueButton.textContent = (STRINGS.labels && STRINGS.labels.continue) || 'Igen';
    if (dialogBackButton) dialogBackButton.textContent = (STRINGS.labels && STRINGS.labels.back) || 'Tillbaka';
    const aria = STRINGS.aria || {};
    if (listenButton && aria.listen) listenButton.setAttribute('aria-label', aria.listen);
    if (fishEl && aria.fish) fishEl.setAttribute('aria-label', aria.fish);
    const field = document.getElementById('game20-field');
    if (field && aria.scene) field.setAttribute('aria-label', aria.scene);
}

function setupVisuals() {
    const images = STRINGS.images || {};
    if (stageEl && images.background) {
        const url = resolveGame20Asset(supportsWebp ? images.background : images.backgroundFallback || images.background);
        stageEl.style.backgroundImage = `url(${url})`;
    }
    if (fishClosedImg) setSprite(fishClosedImg, images.fishClosed || 'fish_closed');
    if (fishOpenImg) setSprite(fishOpenImg, images.fishOpen || 'fish_open');
    if (fishStuffedImg) setSprite(fishStuffedImg, images.fishStuffed || 'fish_stuffed');
    // Warm the food sprites so the plate fills instantly between rounds
    (STRINGS.foods || []).forEach((f) => { const i = new Image(); i.src = spriteUrl(f.image); });
}

function attachListeners() {
    if (continueButton) continueButton.addEventListener('click', handleContinueClick);
    if (dialogBackButton) {
        dialogBackButton.addEventListener('click', () => {
            window.location.href = '../../index.html';
        });
    }
    if (listenButton) listenButton.addEventListener('click', handleListenClick);
    // Pointer events on the plate cover mouse, touch and pen (drag and tap)
    if (plateEl) plateEl.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('volumechange', handleVolumeChange);
    const unlock = () => {
        void ensureAudioContext();
        requestBackgroundAudioStart();
    };
    ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => {
        document.addEventListener(ev, unlock, { capture: true, once: true });
    });
    window.addEventListener('resize', resizeConfettiCanvas);
    window.addEventListener('orientationchange', () => setTimeout(resizeConfettiCanvas, 150));
}

/* ---------- rounds ---------- */

function buildRoundProgress() {
    if (!roundProgressEl) return;
    roundProgressEl.innerHTML = '';
    for (let i = 0; i < ROUNDS_TO_COMPLETE; i += 1) {
        const pip = document.createElement('span');
        pip.className = 'game20-pip';
        pip.textContent = '🐠';
        pip.setAttribute('aria-hidden', 'true');
        roundProgressEl.appendChild(pip);
    }
    updateRoundProgress();
}

function updateRoundProgress() {
    if (!roundProgressEl) return;
    const current = Math.min(roundsWon + 1, ROUNDS_TO_COMPLETE);
    roundProgressEl.querySelectorAll('.game20-pip').forEach((el, index) => {
        el.classList.toggle('game20-pip--done', index < roundsWon);
    });
    const ariaFn = STRINGS.labels && STRINGS.labels.roundProgress;
    roundProgressEl.setAttribute('aria-label',
        typeof ariaFn === 'function' ? ariaFn(current, ROUNDS_TO_COMPLETE) : `Runda ${current} av ${ROUNDS_TO_COMPLETE}`);
}

function getCountWeight(n) {
    const map = STRINGS.countWeights;
    if (map && map[n] != null) return Math.max(0, Number(map[n]));
    return n <= 3 ? 4 : n <= 5 ? 2 : 1;
}

/** Weighted targets in [MIN..MAX], favouring small numbers, unique within a game when possible */
function pickTargetsForGame(debugTargets) {
    if (debugTargets) {
        const t = debugTargets.slice(0, ROUNDS_TO_COMPLETE);
        while (t.length < ROUNDS_TO_COMPLETE) t.push(t[t.length - 1]);
        return t;
    }
    const pool = [];
    for (let n = MIN_COUNT; n <= MAX_COUNT; n += 1) {
        for (let i = 0; i < getCountWeight(n); i += 1) pool.push(n);
    }
    const picked = [];
    while (picked.length < ROUNDS_TO_COMPLETE) {
        const fresh = pool.filter((n) => !picked.includes(n));
        const src = fresh.length ? fresh : pool;
        picked.push(src[Math.floor(Math.random() * src.length)]);
    }
    return picked;
}

/** One food per round; shuffled so the order changes between games */
function pickFoodsForGame(debugFoods) {
    const foods = (STRINGS.foods || []).slice();
    if (debugFoods) {
        const chosen = debugFoods.map((id) => foods.find((f) => f.id === id)).filter(Boolean);
        if (chosen.length) {
            while (chosen.length < ROUNDS_TO_COMPLETE) chosen.push(chosen[chosen.length - 1]);
            return chosen;
        }
    }
    for (let i = foods.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [foods[i], foods[j]] = [foods[j], foods[i]];
    }
    const out = [];
    for (let r = 0; r < ROUNDS_TO_COMPLETE; r += 1) out.push(foods[r % foods.length]);
    return out;
}

function startGame() {
    gameStarted = true;
    hideCompletionDialog();
    const dbg = readDebugParams();
    roundsWon = 0;
    roundTargets = pickTargetsForGame(dbg.targets);
    roundFoods = pickFoodsForGame(dbg.foods);
    updateRoundProgress();
    startAmbientBubbles();
    void runRound();
}

async function runRound() {
    roundGeneration += 1;
    const gen = roundGeneration;
    clearSettleTimer();
    targetCount = roundTargets[roundsWon] || 1;
    currentFood = roundFoods[roundsWon] || (STRINGS.foods || [])[0];
    resetCount();
    fillPlate();
    requestBackgroundAudioStart();
    phase = 'prompt';
    // Fish opens its mouth while saying it is hungry
    setMouth(true);
    await playSpeech(STRINGS.hungrySound);
    if (gen !== roundGeneration) return;
    setMouth(false);
    // Allow feeding as soon as the request starts (no need to wait for the end)
    phase = 'feeding';
    await playSpeech(currentPromptPath());
}

function currentPromptPath() {
    if (!currentFood || !currentFood.promptSounds) return '';
    return currentFood.promptSounds[targetCount] || '';
}

function fillPlate() {
    if (!plateEl || !currentFood) return;
    plateEl.innerHTML = '';
    const ariaFn = STRINGS.aria && STRINGS.aria.food;
    for (let i = 0; i < PLATE_COUNT; i += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'game20-food game20-food--refill';
        btn.style.animationDelay = `${i * 40}ms`;
        btn.dataset.index = String(i);
        // Drop the pop-in animation when done so it never fights the drag transform
        btn.addEventListener('animationend', () => btn.classList.remove('game20-food--refill'), { once: true });
        btn.setAttribute('aria-label', typeof ariaFn === 'function' ? ariaFn(currentFood.name) : currentFood.name);
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        setSprite(img, currentFood.image);
        btn.appendChild(img);
        // Keyboard / screen reader: Enter or Space feeds one item
        btn.addEventListener('click', (e) => {
            if (e.detail === 0) void feedItem(btn);
        });
        plateEl.appendChild(btn);
    }
}

function resetCount() {
    eatenCount = 0;
    if (badgeEl) {
        badgeEl.textContent = '0';
        badgeEl.classList.remove('game20-fish__badge--on');
    }
    if (tummyEl) tummyEl.innerHTML = '';
}

function showCount(n) {
    if (badgeEl) {
        badgeEl.textContent = String(n);
        badgeEl.classList.add('game20-fish__badge--on');
        badgeEl.classList.remove('game20-fish__badge--pop');
        void badgeEl.offsetWidth;
        badgeEl.classList.add('game20-fish__badge--pop');
    }
    if (tummyEl && currentFood) {
        const img = document.createElement('img');
        img.alt = '';
        setSprite(img, currentFood.image);
        tummyEl.appendChild(img);
    }
}

/* ---------- drag and tap ---------- */

function canFeed() {
    return phase === 'feeding' || phase === 'settle';
}

function handlePointerDown(event) {
    const btn = event.target.closest('.game20-food');
    if (!btn || btn.classList.contains('game20-food--gone') || drag) return;
    if (!canFeed()) {
        if (window.TiddeliFx) window.TiddeliFx.wiggleElement(btn, 400);
        return;
    }
    event.preventDefault();
    drag = { el: btn, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, moved: false };
    try { btn.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
}

function handlePointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    drag.dx = event.clientX - drag.startX;
    drag.dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(drag.dx, drag.dy) > DRAG_THRESHOLD) {
        drag.moved = true;
        drag.el.classList.add('game20-food--dragging');
    }
    if (drag.moved) {
        drag.el.style.transform = `translate(${drag.dx}px, ${drag.dy}px)`;
        // Mouth opens when the food comes close
        setMouth(distanceToMouth(drag.el) < OPEN_RADIUS);
    }
}

function handlePointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { el, moved } = drag;
    drag = null;
    if (!moved) {
        // Simple tap: the food flies into the mouth (easiest for 2-year-olds)
        void feedItem(el);
        return;
    }
    if (canFeed() && distanceToMouth(el) < EAT_RADIUS) {
        void feedItem(el, true);
    } else {
        returnToPlate(el);
    }
}

function handlePointerCancel(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const el = drag.el;
    drag = null;
    returnToPlate(el);
}

function returnToPlate(el) {
    el.classList.remove('game20-food--dragging');
    el.style.transform = '';
    setMouth(false);
}

function mouthPoint() {
    const r = fishClosedImg.getBoundingClientRect();
    return { x: r.left + r.width * MOUTH_X, y: r.top + r.height * MOUTH_Y };
}

function distanceToMouth(el) {
    const r = el.getBoundingClientRect();
    const m = mouthPoint();
    return Math.hypot(r.left + r.width / 2 - m.x, r.top + r.height / 2 - m.y);
}

function setMouth(open) {
    if (fishEl) fishEl.classList.toggle('game20-fish--open', Boolean(open));
}

/** Move the item (from its current spot) into the mouth, then count the bite */
async function feedItem(el, alreadyAtMouth = false) {
    if (!canFeed() || !el || el.classList.contains('game20-food--gone')) {
        if (el) returnToPlate(el);
        return;
    }
    const gen = roundGeneration;
    const overfeed = eatenCount >= targetCount;
    phase = 'busy';
    clearSettleTimer();
    setMouth(true);
    el.classList.remove('game20-food--dragging');
    el.classList.add('game20-food--flying');

    if (!alreadyAtMouth) {
        await flyToMouth(el);
    } else {
        await flyToMouth(el, 140);
    }
    if (gen !== roundGeneration) return;

    // Gulp
    el.classList.remove('game20-food--flying');
    el.classList.add('game20-food--gone');
    el.style.transform = '';
    void playSfx(STRINGS.eatSound, 1.25);
    pulseClass(fishEl, 'game20-fish--chomp', 340);
    window.setTimeout(() => setMouth(false), 160);
    const m = stagePoint(mouthPoint());
    spawnBubblesAt(m.x, m.y, 2);

    if (overfeed) {
        await handleOverfeed(gen);
        return;
    }

    eatenCount += 1;
    showCount(eatenCount);
    await playSpeech(STRINGS.countSounds && STRINGS.countSounds[eatenCount]);
    if (gen !== roundGeneration) return;

    if (eatenCount >= targetCount) {
        // Short window: one more bite now means "too much"
        phase = 'settle';
        settleTimer = window.setTimeout(() => {
            if (gen === roundGeneration && phase === 'settle') void handleSuccess(gen);
        }, SETTLE_MS);
    } else {
        phase = 'feeding';
    }
}

function flyToMouth(el, msOverride) {
    return new Promise((resolve) => {
        const r = el.getBoundingClientRect();
        const m = mouthPoint();
        // Current offset from the slot (dragged items already carry a transform)
        const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || '');
        const startDx = match ? parseFloat(match[1]) : 0;
        const startDy = match ? parseFloat(match[2]) : 0;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const endDx = startDx + (m.x - cx);
        const endDy = startDy + (m.y - cy);
        const ms = msOverride || FLY_MS;
        const t0 = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - t0) / ms);
            const e = 1 - Math.pow(1 - t, 2);
            // Little arc upward on the way, shrink as it goes in
            const arc = Math.sin(Math.PI * t) * -40;
            const s = 1 - 0.55 * t;
            el.style.transform = `translate(${startDx + (endDx - startDx) * e}px, ${startDy + (endDy - startDy) * e + arc}px) scale(${s})`;
            if (t < 1) requestAnimationFrame(step);
            else resolve();
        };
        requestAnimationFrame(step);
    });
}

async function handleSuccess(gen) {
    if (gen !== roundGeneration) return;
    phase = 'celebrate';
    clearSettleTimer();
    setPlateLocked(true);
    void playSfx(STRINGS.successSound, 1.1);
    pulseClass(fishEl, 'game20-fish--celebrate', 820);
    const m = stagePoint(mouthPoint());
    burstConfetti(m.x, m.y - 30, 54);
    spawnBubblesAt(m.x, m.y, 10);
    void playSfx(STRINGS.bubblesSound, 0.9);
    await playSpeech(STRINGS.thanksSound);
    if (gen !== roundGeneration) return;
    roundsWon += 1;
    updateRoundProgress();
    await sleep(350);
    if (gen !== roundGeneration) return;
    setPlateLocked(false);
    if (roundsWon >= ROUNDS_TO_COMPLETE) {
        phase = 'complete';
        showCompletionDialog();
        return;
    }
    void runRound();
}

/**
 * Overfeed: a big, funny (never scary) ~2.9 s cartoon sequence, all CSS transforms/opacity.
 * swell + jelly wobble (stuffed frame) → tremble → BUURP + bubble burst + backward spin
 * → dizzy stars → deflate back to normal with a sigh → "Oj, nu fick jag för mycket!" → same round again.
 * Input stays locked the whole time. Timings match @keyframes game20-overfed in game.css.
 */
const OVERFEED_MS = 2900;
const OVERFEED_BURP_AT = 1450;
const OVERFEED_DIZZY_AT = 1950;
const OVERFEED_DEFLATE_AT = 2450;

async function handleOverfeed(gen) {
    phase = 'overfeed';
    clearSettleTimer();
    setPlateLocked(true);
    setMouth(false);
    if (fishEl) {
        fishEl.classList.remove('game20-fish--chomp', 'game20-fish--overfed');
        void fishEl.offsetWidth;
        fishEl.classList.add('game20-fish--overfed');
    }
    void playSfx(STRINGS.inflateSound, 0.9);

    await sleep(OVERFEED_BURP_AT - 120);
    if (gen !== roundGeneration) return endOverfeedVisuals();
    // Take the mouth position at the peak, before the recoil spin starts
    const m = stagePoint(mouthPoint());
    await sleep(120);
    if (gen !== roundGeneration) return endOverfeedVisuals();
    void playSfx(STRINGS.burpSound, 1.4);
    spawnBubbleBurst(m.x, m.y, 34);
    void playSfx(STRINGS.bubblesSound, 0.8);

    await sleep(OVERFEED_DIZZY_AT - OVERFEED_BURP_AT);
    if (gen !== roundGeneration) return endOverfeedVisuals();
    void playSfx(STRINGS.dizzySound, 0.7);

    await sleep(OVERFEED_DEFLATE_AT - OVERFEED_DIZZY_AT);
    if (gen !== roundGeneration) return endOverfeedVisuals();
    void playSfx(STRINGS.deflateSound, 0.85);

    await sleep(OVERFEED_MS - OVERFEED_DEFLATE_AT + 80);
    endOverfeedVisuals();
    if (gen !== roundGeneration) return;
    await playSpeech(STRINGS.fullSound);
    if (gen !== roundGeneration) return;
    // Same food, same number — gently try again (no penalty)
    resetCount();
    fillPlate();
    setPlateLocked(false);
    phase = 'feeding';
    await playSpeech(currentPromptPath());
}

function endOverfeedVisuals() {
    if (fishEl) fishEl.classList.remove('game20-fish--overfed');
}

/** Burst of bubbles shooting out of the mouth in all directions (burp) */
function spawnBubbleBurst(x, y, count) {
    if (!bubbleLayerEl) return;
    for (let i = 0; i < count; i += 1) {
        const b = document.createElement('span');
        b.className = 'game20-bubble game20-bubble--burst';
        const size = 14 + Math.random() * 30;
        // Fan out of the mouth (fish faces left): up-left to straight up, a few up-right
        const angle = Math.PI * (0.25 + Math.random() * 0.55);
        const dist = 70 + Math.random() * 150;
        b.style.width = `${size}px`;
        b.style.height = `${size}px`;
        b.style.left = `${x}px`;
        b.style.top = `${y}px`;
        b.style.setProperty('--bx', `${Math.cos(angle) * dist}px`);
        b.style.setProperty('--by', `${-Math.sin(angle) * dist * 0.9 - 10}px`);
        b.style.animationDuration = `${1.3 + Math.random() * 0.8}s`;
        b.style.animationDelay = `${Math.random() * 0.12}s`;
        bubbleLayerEl.appendChild(b);
        window.setTimeout(() => b.remove(), 2400);
    }
}

function setPlateLocked(locked) {
    if (plateEl) plateEl.style.pointerEvents = locked ? 'none' : '';
}

/* ---------- small helpers ---------- */

function pulseClass(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
}

function stagePoint(p) {
    const s = stageEl.getBoundingClientRect();
    return { x: p.x - s.left, y: p.y - s.top };
}

function spawnBubblesAt(x, y, count) {
    if (!bubbleLayerEl) return;
    for (let i = 0; i < count; i += 1) {
        const b = document.createElement('span');
        b.className = 'game20-bubble';
        const size = 8 + Math.random() * 12;
        b.style.width = `${size}px`;
        b.style.height = `${size}px`;
        b.style.left = `${x + (Math.random() - 0.5) * 28}px`;
        b.style.top = `${y + (Math.random() - 0.5) * 16}px`;
        b.style.setProperty('--drift', `${(Math.random() - 0.5) * 36}px`);
        b.style.animationDuration = `${1.8 + Math.random()}s`;
        bubbleLayerEl.appendChild(b);
        window.setTimeout(() => b.remove(), 2800);
    }
}

/** The fish blows a bubble now and then (light: a couple of DOM nodes) */
function startAmbientBubbles() {
    if (bubbleTimer) window.clearInterval(bubbleTimer);
    bubbleTimer = window.setInterval(() => {
        if (phase === 'complete' || document.hidden || !fishClosedImg) return;
        const m = stagePoint(mouthPoint());
        spawnBubblesAt(m.x, m.y - 10, 1 + Math.floor(Math.random() * 2));
    }, 2200);
}

function clearSettleTimer() {
    if (settleTimer) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
    }
}

function handleListenClick() {
    if (phase === 'complete' || !currentFood) return;
    void playSpeech(currentPromptPath());
}

function handleContinueClick() {
    hideCompletionDialog();
    requestBackgroundAudioStart();
    startGame();
}

function showCompletionDialog() {
    stopBackgroundAmbience();
    if (completionDialog) completionDialog.hidden = false;
    void ensureAudioContext().then(() => {
        if (window.playSharedCompletionSound) {
            window.playSharedCompletionSound(audioContext, 0.8).catch(() => {});
        }
    });
}

function hideCompletionDialog() {
    if (completionDialog) completionDialog.hidden = true;
}

/* ---------- confetti (TiddeliFx) ---------- */

function resizeConfettiCanvas() {
    if (!confettiCanvas || !stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    confettiCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    if (confettiCtx) confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function burstConfetti(x, y, count) {
    resizeConfettiCanvas();
    if (!confettiCtx || !window.TiddeliFx) return;
    confettiStates.push(window.TiddeliFx.createConfettiBurst(confettiCtx, x, y, {
        count, colors: GAME20_CONFETTI_COLORS, durationMs: 2000
    }));
    if (!confettiAnimFrame) confettiAnimFrame = requestAnimationFrame(tickConfettiFrame);
}

function tickConfettiFrame() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCtx.clearRect(0, 0, confettiCanvas.width / dpr, confettiCanvas.height / dpr);
    confettiStates = confettiStates.filter((s) => window.TiddeliFx.tickConfetti(s));
    confettiAnimFrame = confettiStates.length ? requestAnimationFrame(tickConfettiFrame) : null;
}

/* ---------- audio (same pattern as game 19) ---------- */

function prefetchAudio() {
    const paths = [
        STRINGS.ambience && STRINGS.ambience.track,
        STRINGS.hungrySound, STRINGS.thanksSound, STRINGS.fullSound,
        STRINGS.eatSound, STRINGS.burpSound, STRINGS.bubblesSound, STRINGS.successSound,
        STRINGS.inflateSound, STRINGS.dizzySound, STRINGS.deflateSound
    ];
    Object.values(STRINGS.countSounds || {}).forEach((p) => paths.push(p));
    (STRINGS.foods || []).forEach((f) => Object.values(f.promptSounds || {}).forEach((p) => paths.push(p)));
    paths.forEach((p) => { if (p) void loadAudioBuffer(resolveGame20Asset(p)); });
}

async function loadAudioBuffer(url) {
    if (!url) return null;
    if (failedAudioUrls.has(url)) return null;
    if (audioBufferCache.has(url)) return audioBufferCache.get(url);
    if (audioLoadInFlight.has(url)) return audioLoadInFlight.get(url);

    const loadPromise = (async () => {
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
            console.warn('game20: could not load audio', url, error);
            failedAudioUrls.add(url);
            return null;
        } finally {
            audioLoadInFlight.delete(url);
        }
    })();
    audioLoadInFlight.set(url, loadPromise);
    return loadPromise;
}

function stopSpeech() {
    if (activeSpeechSource) {
        try {
            activeSpeechSource.onended = null;
            activeSpeechSource.stop();
        } catch (_) { /* already stopped */ }
        try { activeSpeechSource.disconnect(); } catch (_) { /* */ }
        activeSpeechSource = null;
    }
}

function playSfxFromBuffer(buffer, volumeScale = 1.2) {
    if (!buffer || !audioContext || audioContext.state !== 'running') return null;
    try {
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        gain.gain.setValueAtTime(Math.min(1, volume * volumeScale), audioContext.currentTime);
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(audioContext.destination);
        source.start(0);
        return source;
    } catch (_) {
        return null;
    }
}

async function playSfx(path, volumeScale = 1.2) {
    if (!path) return;
    const url = resolveGame20Asset(path);
    const buf = audioBufferCache.get(url) || (await loadAudioBuffer(url));
    if (buf) playSfxFromBuffer(buf, volumeScale);
}

async function playSpeech(path) {
    if (!path) return false;
    await ensureAudioContext();
    const url = resolveGame20Asset(path);
    const buf = audioBufferCache.get(url) || (await loadAudioBuffer(url));
    if (!buf || !audioContext || audioContext.state !== 'running') return false;
    stopSpeech();
    const source = playSfxFromBuffer(buf, 1.35);
    if (!source) return false;
    activeSpeechSource = source;
    return new Promise((resolve) => {
        const done = () => {
            if (activeSpeechSource === source) activeSpeechSource = null;
            resolve(true);
        };
        source.addEventListener('ended', done, { once: true });
        // Safety in case ended does not fire
        window.setTimeout(done, Math.max(250, buf.duration * 1000 + 80));
    });
}

async function ensureAudioContext() {
    if (!audioContext) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioContext = new Ctx();
    }
    if (audioContext && audioContext.state === 'suspended') {
        try { await audioContext.resume(); } catch (_) { /* ignore */ }
    }
    return audioContext;
}

function requestBackgroundAudioStart() {
    void startBackgroundAmbience();
}

async function startBackgroundAmbience() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running' || backgroundSource) return;
    const track = STRINGS.ambience && STRINGS.ambience.track;
    if (!track) return;
    const url = resolveGame20Asset(track);
    const buffer = await loadAudioBuffer(url);
    if (!buffer) return;
    backgroundBuffer = buffer;
    backgroundSource = audioContext.createBufferSource();
    backgroundSource.buffer = backgroundBuffer;
    backgroundSource.loop = true;
    backgroundGain = audioContext.createGain();
    const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
    backgroundGain.gain.setValueAtTime(volume * AMBIENCE_GAIN, audioContext.currentTime);
    backgroundSource.connect(backgroundGain);
    backgroundGain.connect(audioContext.destination);
    try {
        backgroundSource.start(0);
    } catch (_) {
        backgroundSource = null;
        backgroundGain = null;
    }
}

function stopBackgroundAmbience() {
    if (backgroundSource) {
        try { backgroundSource.stop(); } catch (_) { /* ignore */ }
        backgroundSource = null;
    }
    if (backgroundGain) {
        try { backgroundGain.disconnect(); } catch (_) { /* ignore */ }
        backgroundGain = null;
    }
}

function handleVolumeChange(event) {
    if (!audioContext || !backgroundGain) return;
    const newVolume =
        event.detail && typeof event.detail.volume === 'number'
            ? event.detail.volume
            : window.TiddeliGamesVolume?.get() ?? 0.35;
    backgroundGain.gain.setValueAtTime(newVolume * AMBIENCE_GAIN, audioContext.currentTime);
}

function handleVisibilityChange() {
    if (document.hidden && audioContext && audioContext.state === 'running') {
        audioContext.suspend().catch(() => {});
    } else if (audioContext && backgroundSource) {
        audioContext.resume().catch(() => {});
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Playwright / manual debug hook (read-only state; not used by the game itself) */
window.__mataFiskarna = {
    getState: () => ({
        phase, targetCount, eatenCount, roundsWon,
        food: currentFood && currentFood.id,
        roundTargets: roundTargets.slice(),
        plateLeft: plateEl ? plateEl.querySelectorAll('.game20-food:not(.game20-food--gone)').length : 0
    })
};
