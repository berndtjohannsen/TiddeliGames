'use strict';
/**
 * Fåglarna flyger hem (Game 21)
 * A coloured bird flutters in: "Den blå fågeln vill flyga hem!" The child drags the bird to the
 * nest of the same colour (or taps the bird and then a nest, or simply taps a nest). Right nest →
 * the bird flies in, the chicks hop and peep, "Blå! Bra!". Wrong nest → the bird bumps gently off
 * and flies back, a soft boing, and the prompt is repeated (no penalty).
 * Rounds 1–3 have 2 nests, rounds 4–6 have 3 nests. Six birds home → completion dialog.
 */

const STRINGS = window.GAME21_STRINGS || {};
const ROUNDS_TO_COMPLETE = STRINGS.roundsToComplete ?? 6;
const AMBIENCE_GAIN = 0.4;
const DRAG_THRESHOLD = 10;
/** Extra margin (px) around a nest that still counts as a drop on it (small hands) */
const DROP_MARGIN = 26;
const ENTER_MS = 1100;
const FLY_HOME_MS = 650;
const FLY_WRONG_MS = 480;
const RETURN_MS = 650;

/** Nest centres in % of the stage (inside the tree canopy) */
const NEST_LAYOUTS = {
    2: [{ x: 29, y: 40 }, { x: 71, y: 40 }],
    3: [{ x: 19, y: 44 }, { x: 50, y: 31 }, { x: 81, y: 44 }]
};
/** Where the bird hovers while waiting (meadow, lower middle) */
const HOVER_POS = { x: 50, y: 77 };

const GAME21_CONFETTI_COLORS = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#fb923c', '#f472b6', '#ffffff'];

let instructionsEl = null;
let roundProgressEl = null;
let stageEl = null;
let nestLayerEl = null;
let noteLayerEl = null;
let birdEl = null;
let birdUpImg = null;
let birdDownImg = null;
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
let roundColors = [];
let roundNestColors = [];
let roundsWon = 0;
let wrongTries = 0;
let currentColor = null;
/** idle | enter | waiting | busy | celebrate | complete */
let phase = 'idle';
let roundGeneration = 0;
let gameStarted = false;
/** Bird position (stage px, centre) */
let birdPos = { x: 0, y: 0 };
/** Bird was tapped: next nest tap sends it there */
let birdPicked = false;
/** Active pointer drag: { pointerId, startX, startY, originX, originY, moved } */
let drag = null;

function resolveGame21Asset(path) {
    if (!path) return '';
    if (window.TiddeliAssets && typeof window.TiddeliAssets.resolveGameAsset === 'function') {
        return window.TiddeliAssets.resolveGameAsset('game21', path);
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

function stemFor(key, colorId) {
    const images = STRINGS.images || {};
    return String(images[key] || '').replace('{c}', colorId);
}

/** WebP 1x/2x by pixel ratio; PNG 1x fallback */
function spriteUrl(stem) {
    if (!supportsWebp) return resolveGame21Asset(`images/${stem}_1x.png`);
    const hi = (window.devicePixelRatio || 1) >= 1.5;
    return resolveGame21Asset(`images/${stem}_${hi ? '2x' : '1x'}.webp`);
}

function setSprite(img, stem) {
    img.src = spriteUrl(stem);
    img.addEventListener('error', () => {
        img.src = resolveGame21Asset(`images/${stem}_1x.png`);
    }, { once: true });
}

function colorById(id) {
    return (STRINGS.colors || []).find((c) => c.id === id) || null;
}

/** Debug/test: ?colors=red,blue,yellow,green,red,blue  (bird colour per round) */
function readDebugParams() {
    try {
        const params = new URLSearchParams(window.location.search);
        const c = (params.get('colors') || '').split(',').map((s) => s.trim()).filter((id) => colorById(id));
        const rounds = parseInt(params.get('rounds') || '', 10);
        return { colors: c.length ? c : null, rounds: rounds > 0 && rounds <= 12 ? rounds : null };
    } catch (_) {
        return { colors: null, rounds: null };
    }
}

let totalRounds = ROUNDS_TO_COMPLETE;

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachListeners();
    void (async () => {
        supportsWebp = await detectWebp();
        totalRounds = readDebugParams().rounds || ROUNDS_TO_COMPLETE;
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
    stageEl = document.getElementById('game21-stage');
    nestLayerEl = document.getElementById('nest-layer');
    noteLayerEl = document.getElementById('note-layer');
    birdEl = document.getElementById('bird');
    birdUpImg = document.getElementById('bird-up');
    birdDownImg = document.getElementById('bird-down');
    listenButton = document.getElementById('listen-button');
    confettiCanvas = document.getElementById('game21-confetti-canvas');
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
    const field = document.getElementById('game21-field');
    if (field && aria.scene) field.setAttribute('aria-label', aria.scene);
}

function setupVisuals() {
    const images = STRINGS.images || {};
    if (stageEl && images.background) {
        const url = resolveGame21Asset(supportsWebp ? images.background : images.backgroundFallback || images.background);
        stageEl.style.backgroundImage = `url(${url})`;
    }
    // Warm all sprites so rounds switch instantly (small files)
    (STRINGS.colors || []).forEach((c) => {
        ['birdUp', 'birdDown', 'nest', 'chicks'].forEach((k) => {
            const i = new Image();
            i.src = spriteUrl(stemFor(k, c.id));
        });
    });
}

function attachListeners() {
    if (continueButton) continueButton.addEventListener('click', handleContinueClick);
    if (dialogBackButton) {
        dialogBackButton.addEventListener('click', () => {
            window.location.href = '../../index.html';
        });
    }
    if (listenButton) listenButton.addEventListener('click', handleListenClick);
    // Pointer events cover mouse, touch and pen (drag and tap)
    if (birdEl) {
        birdEl.addEventListener('pointerdown', handleBirdPointerDown);
        // Keyboard: Enter/Space on the bird = pick it (then Tab to a nest)
        birdEl.addEventListener('click', (e) => {
            if (e.detail === 0 && phase === 'waiting') pickBird();
        });
    }
    if (nestLayerEl) nestLayerEl.addEventListener('click', handleNestClick);
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
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 150));
}

function handleResize() {
    resizeConfettiCanvas();
    // Keep the waiting bird at its hover spot after a resize
    if (phase === 'waiting' && !drag) placeBird(hoverPoint());
}

/* ---------- rounds ---------- */

function buildRoundProgress() {
    if (!roundProgressEl) return;
    roundProgressEl.innerHTML = '';
    for (let i = 0; i < totalRounds; i += 1) {
        const pip = document.createElement('span');
        pip.className = 'game21-pip';
        pip.textContent = '🐦';
        pip.setAttribute('aria-hidden', 'true');
        roundProgressEl.appendChild(pip);
    }
    updateRoundProgress();
}

function updateRoundProgress() {
    if (!roundProgressEl) return;
    const current = Math.min(roundsWon + 1, totalRounds);
    roundProgressEl.querySelectorAll('.game21-pip').forEach((el, index) => {
        el.classList.toggle('game21-pip--done', index < roundsWon);
    });
    const ariaFn = STRINGS.labels && STRINGS.labels.roundProgress;
    roundProgressEl.setAttribute('aria-label',
        typeof ariaFn === 'function' ? ariaFn(current, totalRounds) : `Runda ${current} av ${totalRounds}`);
}

function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function nestCountForRound(r) {
    const list = STRINGS.nestsPerRound || [];
    const n = list[r] ?? list[list.length - 1] ?? 2;
    return n >= 3 ? 3 : 2;
}

/** Bird colour per round: never the same twice in a row, every colour shows up */
function pickColorsForGame(debugColors) {
    const ids = (STRINGS.colors || []).map((c) => c.id);
    if (debugColors) {
        const t = debugColors.slice(0, totalRounds);
        while (t.length < totalRounds) t.push(t[t.length - 1]);
        return t;
    }
    const out = [];
    while (out.length < totalRounds) {
        shuffle(ids).forEach((id) => {
            if (out.length < totalRounds && out[out.length - 1] !== id) out.push(id);
        });
    }
    return out;
}

/** Nest colours for a round: the bird's colour + random others, shuffled positions */
function pickNestColors(birdColor, count) {
    const others = shuffle((STRINGS.colors || []).map((c) => c.id).filter((id) => id !== birdColor));
    return shuffle([birdColor, ...others.slice(0, count - 1)]);
}

function startGame() {
    gameStarted = true;
    hideCompletionDialog();
    const dbg = readDebugParams();
    roundsWon = 0;
    roundColors = pickColorsForGame(dbg.colors);
    updateRoundProgress();
    void runRound();
}

async function runRound() {
    roundGeneration += 1;
    const gen = roundGeneration;
    wrongTries = 0;
    birdPicked = false;
    currentColor = colorById(roundColors[roundsWon]) || (STRINGS.colors || [])[0];
    roundNestColors = pickNestColors(currentColor.id, nestCountForRound(roundsWon));
    buildNests(roundNestColors);
    requestBackgroundAudioStart();

    // Bird flutters in from one side to the hover spot
    phase = 'enter';
    setBirdColor(currentColor.id);
    const fromLeft = Math.random() < 0.5;
    const s = stageSize();
    const start = { x: fromLeft ? -s.w * 0.25 : s.w * 1.25, y: s.h * 0.55 };
    birdEl.hidden = false;
    setBirdFlip(fromLeft ? 1 : -1);
    setBirdScale(1);
    placeBird(start);
    setBirdMode('flying');
    void playSfx(STRINGS.flutterSound, 0.8);
    await flyBird(hoverPoint(), ENTER_MS, 60);
    if (gen !== roundGeneration) return;
    setBirdMode('hover');
    // Interaction allowed as soon as the prompt starts
    phase = 'waiting';
    await playSpeech(currentColor.prompt);
}

function buildNests(colorIds) {
    if (!nestLayerEl) return;
    nestLayerEl.innerHTML = '';
    nestLayerEl.classList.toggle('game21-nest-layer--three', colorIds.length === 3);
    const layout = NEST_LAYOUTS[colorIds.length] || NEST_LAYOUTS[2];
    const ariaFn = STRINGS.aria && STRINGS.aria.nest;
    colorIds.forEach((id, i) => {
        const c = colorById(id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'game21-nest';
        btn.dataset.color = id;
        btn.style.left = `${layout[i].x}%`;
        btn.style.top = `${layout[i].y}%`;
        btn.setAttribute('aria-label', typeof ariaFn === 'function' ? ariaFn(c.nestName) : id);
        const inner = document.createElement('span');
        // Pop-in class is dropped when done, so later shake/hint animations never replay it
        inner.className = 'game21-nest__inner game21-nest__inner--enter';
        inner.style.animationDelay = `${i * 90}ms`;
        inner.addEventListener('animationend', (ev) => {
            if (ev.animationName === 'game21-nest-in') {
                inner.classList.remove('game21-nest__inner--enter');
                inner.style.animationDelay = '';
            }
        });
        // Layers (back → front): whole nest, chicks + parent bird in the hollow, front rim (same image, clipped)
        const pic = document.createElement('span');
        pic.className = 'game21-nest__pic';
        const back = document.createElement('img');
        back.className = 'game21-nest__img';
        back.alt = '';
        back.draggable = false;
        setSprite(back, stemFor('nest', id));
        const chicks = document.createElement('img');
        chicks.className = 'game21-nest__chicks';
        chicks.alt = '';
        chicks.draggable = false;
        setSprite(chicks, stemFor('chicks', id));
        const parent = document.createElement('img');
        parent.className = 'game21-nest__parent';
        parent.alt = '';
        parent.draggable = false;
        setSprite(parent, stemFor('birdDown', id));
        const front = document.createElement('img');
        front.className = 'game21-nest__img game21-nest__front';
        front.alt = '';
        front.draggable = false;
        setSprite(front, stemFor('nest', id));
        pic.append(back, chicks, parent, front);
        inner.appendChild(pic);
        btn.appendChild(inner);
        nestLayerEl.appendChild(btn);
    });
}

function setBirdColor(id) {
    setSprite(birdUpImg, stemFor('birdUp', id));
    setSprite(birdDownImg, stemFor('birdDown', id));
    const ariaFn = STRINGS.aria && STRINGS.aria.bird;
    const c = colorById(id);
    if (birdEl && c) birdEl.setAttribute('aria-label', typeof ariaFn === 'function' ? ariaFn(c.birdName) : id);
}

/** hover | flying | dragging | perched */
function setBirdMode(mode) {
    if (!birdEl) return;
    birdEl.classList.toggle('game21-bird--hover', mode === 'hover');
    birdEl.classList.toggle('game21-bird--flying', mode === 'flying');
    birdEl.classList.toggle('game21-bird--dragging', mode === 'dragging');
}

function setBirdFlip(dir) {
    if (birdEl) birdEl.style.setProperty('--bird-flip', String(dir));
}

function setBirdScale(s) {
    if (birdEl) birdEl.style.setProperty('--bird-scale', String(s));
}

/* ---------- geometry ---------- */

function stageSize() {
    const r = stageEl.getBoundingClientRect();
    return { w: r.width, h: r.height, left: r.left, top: r.top };
}

function hoverPoint() {
    const s = stageSize();
    return { x: s.w * HOVER_POS.x / 100, y: s.h * HOVER_POS.y / 100 };
}

function placeBird(p) {
    birdPos = { x: p.x, y: p.y };
    birdEl.style.left = `${p.x}px`;
    birdEl.style.top = `${p.y}px`;
}

function nestRect(nestEl) {
    const r = nestEl.getBoundingClientRect();
    const s = stageSize();
    return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
}

/** Where the bird ends up when home: the (hidden) parent slot inside the nest, beside the chicks */
function perchTarget(nestEl) {
    const slot = nestEl.querySelector('.game21-nest__parent');
    const s = stageSize();
    const r = slot.getBoundingClientRect();
    const birdH = birdEl.offsetHeight || 1;
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2, scale: r.height / birdH };
}

/** Nest under the bird's centre (with a forgiving margin), or null */
function nestAtBird() {
    if (!nestLayerEl) return null;
    let best = null;
    let bestD = Infinity;
    nestLayerEl.querySelectorAll('.game21-nest').forEach((n) => {
        const r = nestRect(n);
        const inside = birdPos.x > r.left - DROP_MARGIN && birdPos.x < r.left + r.width + DROP_MARGIN
            && birdPos.y > r.top - DROP_MARGIN && birdPos.y < r.top + r.height + DROP_MARGIN;
        if (!inside) return;
        const d = Math.hypot(birdPos.x - (r.left + r.width / 2), birdPos.y - (r.top + r.height / 2));
        if (d < bestD) { bestD = d; best = n; }
    });
    return best;
}

/** Animate the bird along a soft arc to point p */
function flyBird(p, ms, arc = 40, endScale) {
    return new Promise((resolve) => {
        const from = { ...birdPos };
        const s0 = parseFloat(getComputedStyle(birdEl).getPropertyValue('--bird-scale')) || 1;
        const s1 = endScale ?? s0;
        // Face the direction of travel
        if (Math.abs(p.x - from.x) > 8) setBirdFlip(p.x > from.x ? 1 : -1);
        const t0 = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - t0) / ms);
            const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const lift = Math.sin(Math.PI * t) * -arc;
            placeBird({ x: from.x + (p.x - from.x) * e, y: from.y + (p.y - from.y) * e + lift });
            setBirdScale(s0 + (s1 - s0) * e);
            if (t < 1) requestAnimationFrame(step);
            else resolve();
        };
        requestAnimationFrame(step);
    });
}

/* ---------- drag and tap ---------- */

function handleBirdPointerDown(event) {
    if (drag) return;
    if (phase !== 'waiting') {
        if (window.TiddeliFx) window.TiddeliFx.wiggleElement(birdEl, 400);
        return;
    }
    event.preventDefault();
    const s = stageSize();
    drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        // Offset between finger and bird centre, so the bird doesn't jump
        offX: birdPos.x - (event.clientX - s.left),
        offY: birdPos.y - (event.clientY - s.top),
        moved: false
    };
    try { birdEl.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
}

function handlePointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        drag.moved = true;
        birdPicked = false;
        birdEl.classList.remove('game21-bird--picked');
        setBirdMode('dragging');
    }
    if (drag.moved) {
        const s = stageSize();
        const x = Math.max(0, Math.min(s.w, event.clientX - s.left + drag.offX));
        const y = Math.max(0, Math.min(s.h, event.clientY - s.top + drag.offY));
        if (Math.abs(x - birdPos.x) > 2) setBirdFlip(x > birdPos.x ? 1 : -1);
        placeBird({ x, y });
        const over = nestAtBird();
        nestLayerEl.querySelectorAll('.game21-nest').forEach((n) => n.classList.toggle('game21-nest--hover', n === over));
    }
}

function handlePointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { moved } = drag;
    drag = null;
    clearNestHover();
    if (!moved) {
        // Plain tap on the bird: it hops and chirps, then a tap on a nest sends it there
        pickBird();
        return;
    }
    const target = nestAtBird();
    if (phase === 'waiting' && target) {
        void tryNest(target);
    } else {
        void returnToHover();
    }
}

function handlePointerCancel(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    clearNestHover();
    void returnToHover();
}

function clearNestHover() {
    if (nestLayerEl) nestLayerEl.querySelectorAll('.game21-nest--hover').forEach((n) => n.classList.remove('game21-nest--hover'));
}

function pickBird() {
    if (phase !== 'waiting') return;
    birdPicked = true;
    if (birdEl) {
        birdEl.classList.remove('game21-bird--picked');
        void birdEl.offsetWidth;
        birdEl.classList.add('game21-bird--picked');
    }
    void playSfx(STRINGS.peepSound, 0.7);
}

/** Tapping a nest sends the bird there (with or without tapping the bird first) */
function handleNestClick(event) {
    const nest = event.target.closest('.game21-nest');
    if (!nest || phase !== 'waiting' || drag) return;
    void tryNest(nest);
}

async function returnToHover() {
    const gen = roundGeneration;
    phase = 'busy';
    setBirdMode('flying');
    await flyBird(hoverPoint(), RETURN_MS * 0.7, 30);
    if (gen !== roundGeneration) return;
    setBirdMode('hover');
    phase = 'waiting';
}

async function tryNest(nest) {
    if (phase !== 'waiting') return;
    const gen = roundGeneration;
    phase = 'busy';
    birdPicked = false;
    birdEl.classList.remove('game21-bird--picked');
    const correct = nest.dataset.color === currentColor.id;
    setBirdMode('flying');
    if (correct) {
        stopSpeech();
        nest.classList.add('game21-nest--arriving');
        const perch = perchTarget(nest);
        await flyBird(perch, FLY_HOME_MS, 50, perch.scale);
        if (gen !== roundGeneration) return;
        await handleSuccess(gen, nest);
    } else {
        await handleWrong(gen, nest);
    }
}

/** Wrong-nest timings (ms); whole reaction ≈ 1.7 s after the bird reaches the nest */
const WRONG_REACT_MS = 1050;
const HINT_MS = 1700;

async function handleWrong(gen, nest) {
    wrongTries += 1;
    stopSpeech();
    // Fly toward the wrong nest but stop (or bounce back, if dropped on it) just below it,
    // so the nest's reaction stays visible next to the bird
    const r = nestRect(nest);
    const target = { x: r.left + r.width / 2, y: r.top + r.height * 0.45 };
    const home = hoverPoint();
    const len = Math.hypot(home.x - target.x, home.y - target.y) || 1;
    const away = Math.max(r.height * 0.95, 95);
    const stop = { x: target.x + (home.x - target.x) / len * away, y: target.y + (home.y - target.y) / len * away };
    const dropped = Math.hypot(target.x - birdPos.x, target.y - birdPos.y) <= Math.hypot(stop.x - target.x, stop.y - target.y);
    await flyBird(stop, dropped ? 260 : FLY_WRONG_MS, dropped ? 18 : 30);
    if (gen !== roundGeneration) return;
    // Bump + spoken "Hoppsan…"; let the clip finish before the round prompt replays (stopSpeech would cut it).
    void playSfx(STRINGS.boingSound, 0.7);
    pulseClass(nest, 'game21-nest--nope', 1000);
    pulseClass(birdEl, 'game21-bird--confused', 1000);
    setBirdMode('perched');
    const nr = nestRect(nest);
    spawnQuestion(nr.left + nr.width / 2, nr.top - 6, 'game21-question--nest');
    spawnQuestion(birdPos.x + birdEl.offsetWidth * 0.32, birdPos.y - birdEl.offsetHeight * 0.55, 'game21-question--bird');
    const reactStarted = performance.now();
    await playSpeech(STRINGS.wrongPlaceSound);
    if (gen !== roundGeneration) return;
    const reactRemain = WRONG_REACT_MS - (performance.now() - reactStarted);
    if (reactRemain > 0) await sleep(reactRemain);
    if (gen !== roundGeneration) return;
    setBirdMode('flying');
    await flyBird(hoverPoint(), RETURN_MS, 50);
    if (gen !== roundGeneration) return;
    setBirdMode('hover');
    phase = 'waiting';
    // Hint: the right nest glows and pulses while the prompt is repeated
    const right = nestLayerEl && nestLayerEl.querySelector(`.game21-nest[data-color="${currentColor.id}"]`);
    if (right) pulseClass(right, 'game21-nest--hint', HINT_MS);
    await playSpeech(currentColor.prompt);
}

/** Restart a CSS animation class and remove it after ms */
function pulseClass(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
}

/** Soft white puff with a wobbling "?" (a couple of DOM nodes, removed after ~1.4 s) */
function spawnQuestion(x, y, extraClass) {
    if (!noteLayerEl) return;
    const q = document.createElement('span');
    q.className = `game21-question ${extraClass || ''}`;
    q.style.left = `${x}px`;
    q.style.top = `${y}px`;
    const mark = document.createElement('span');
    mark.className = 'game21-question__mark';
    mark.textContent = '?';
    q.appendChild(mark);
    noteLayerEl.appendChild(q);
    window.setTimeout(() => q.remove(), 1450);
}

async function handleSuccess(gen, nest) {
    phase = 'celebrate';
    setBirdMode('perched');
    // Hand over to the parent sprite inside the nest (so the front rim hides its feet)
    birdEl.hidden = true;
    nest.classList.remove('game21-nest--arriving');
    nest.classList.add('game21-nest--home', 'game21-nest--happy');
    void playSfx(STRINGS.peepSound, 1.0);
    void playSfx(STRINGS.successSound, 0.9);
    const r = nestRect(nest);
    burstConfetti(r.left + r.width / 2, r.top + r.height * 0.3, 46);
    spawnNotes(r.left + r.width / 2, r.top + r.height * 0.15, 4);
    await sleep(250);
    if (gen !== roundGeneration) return;
    await playSpeech(currentColor.praise);
    if (gen !== roundGeneration) return;
    roundsWon += 1;
    updateRoundProgress();
    await sleep(700);
    if (gen !== roundGeneration) return;
    if (roundsWon >= totalRounds) {
        phase = 'complete';
        void playSfx(STRINGS.peepSound, 0.9);
        await playSpeech(STRINGS.allHomeSound);
        if (gen !== roundGeneration) return;
        showCompletionDialog();
        return;
    }
    void runRound();
}

/** Little music notes / hearts floating up from happy chicks (a few DOM nodes) */
function spawnNotes(x, y, count) {
    if (!noteLayerEl) return;
    const glyphs = ['♪', '♫', '♥', '♪'];
    for (let i = 0; i < count; i += 1) {
        const n = document.createElement('span');
        n.className = 'game21-note';
        n.textContent = glyphs[i % glyphs.length];
        n.style.left = `${x + (i - (count - 1) / 2) * 22}px`;
        n.style.top = `${y}px`;
        n.style.color = ['#f472b6', '#fb923c', '#ef4444', '#8b5cf6'][i % 4];
        n.style.setProperty('--nx', `${(Math.random() - 0.5) * 50}px`);
        n.style.animationDelay = `${i * 110}ms`;
        noteLayerEl.appendChild(n);
        window.setTimeout(() => n.remove(), 1900);
    }
}

/* ---------- small helpers ---------- */

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function handleListenClick() {
    if (phase === 'complete' || !currentColor) return;
    void playSpeech(currentColor.prompt);
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
        count, colors: GAME21_CONFETTI_COLORS, durationMs: 1800
    }));
    if (!confettiAnimFrame) confettiAnimFrame = requestAnimationFrame(tickConfettiFrame);
}

function tickConfettiFrame() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCtx.clearRect(0, 0, confettiCanvas.width / dpr, confettiCanvas.height / dpr);
    confettiStates = confettiStates.filter((s) => window.TiddeliFx.tickConfetti(s));
    confettiAnimFrame = confettiStates.length ? requestAnimationFrame(tickConfettiFrame) : null;
}

/* ---------- audio (same pattern as game 19/20) ---------- */

function prefetchAudio() {
    const paths = [
        STRINGS.ambience && STRINGS.ambience.track,
        STRINGS.allHomeSound, STRINGS.wrongPlaceSound, STRINGS.flutterSound, STRINGS.peepSound,
        STRINGS.boingSound, STRINGS.successSound
    ];
    (STRINGS.colors || []).forEach((c) => { paths.push(c.prompt, c.praise); });
    paths.forEach((p) => { if (p) void loadAudioBuffer(resolveGame21Asset(p)); });
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
            console.warn('game21: could not load audio', url, error);
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
    const url = resolveGame21Asset(path);
    const buf = audioBufferCache.get(url) || (await loadAudioBuffer(url));
    if (buf) playSfxFromBuffer(buf, volumeScale);
}

async function playSpeech(path) {
    if (!path) return false;
    await ensureAudioContext();
    const url = resolveGame21Asset(path);
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
    const url = resolveGame21Asset(track);
    const buffer = await loadAudioBuffer(url);
    if (!buffer || backgroundSource || phase === 'complete') return;
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

/** Playwright / manual debug hook (read-only state; not used by the game itself) */
window.__faglarna = {
    getState: () => ({
        phase, roundsWon, wrongTries, totalRounds, birdPicked,
        bird: currentColor && currentColor.id,
        nests: roundNestColors.slice(),
        roundColors: roundColors.slice()
    })
};
