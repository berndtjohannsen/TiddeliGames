'use strict';
/**
 * Räkna hoppen (Game 19)
 * Countdown → rabbit jumps (2–9) → player picks 1–9; 3 correct rounds → completion dialog.
 */

const STRINGS = window.GAME19_STRINGS || {};
const MIN_JUMPS = STRINGS.minJumps ?? 2;
const MAX_JUMPS = STRINGS.maxJumps ?? 9;
const ROUNDS_TO_COMPLETE = STRINGS.roundsToComplete ?? 3;
const AMBIENCE_GAIN = 0.35;

/** Confetti tints when the player picks the right jump count */
const GAME19_CONFETTI_COLORS = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#fb923c', '#c084fc', '#f87171'];

let instructionsEl = null;
let roundProgressEl = null;
let stageEl = null;
let rabbitRoot = null;
let rabbitSprite = null;
let rabbitShadowEl = null;
let trampolineSpringEl = null;
let numberPadEl = null;
let confettiCanvas = null;
let confettiCtx = null;
let confettiPieces = [];
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


let useSpriteSheet = true;
let sheetFrameCount = 6;
/** Sheet frame indices (rabbit_jump pack) */
const GAME19_FRAME_IDLE = 0;
const GAME19_FRAME_CROUCH = 1;
const GAME19_FRAME_TAKEOFF = 2;
const GAME19_FRAME_AIR_TOP = 3;
const GAME19_FRAME_FALL = 4;
const GAME19_FRAME_LAND = 5;
const GAME19_CROUCH_MS = 120;

/** Current round target jump count (secret until answered) */
let targetJumps = 0;
/** One target per round this game (weighted, no duplicate counts) */
let roundJumpTargets = [];
let roundsWon = 0;
let phase = 'idle'; // idle | intro | jumping | answer | complete
let roundGeneration = 0;

function resolveGame19Asset(path) {
    if (!path) return '';
    if (window.TiddeliAssets && typeof window.TiddeliAssets.resolveGameAsset === 'function') {
        return window.TiddeliAssets.resolveGameAsset('game19', path);
    }
    return path;
}

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    setupVisuals();
    buildNumberPad();
    buildRoundProgress();
    attachListeners();
    prefetchSfx();
    resizeConfettiCanvas();
    requestAnimationFrame(() => {
        layoutScene();
        resizeConfettiCanvas();
    });
    void ensureAudioContext().then(() => startGame());
});

function cacheDomElements() {
    instructionsEl = document.getElementById('instructions-text');
    roundProgressEl = document.getElementById('round-progress');
    stageEl = document.getElementById('game19-stage');
    rabbitRoot = document.getElementById('rabbit-root');
    rabbitSprite = document.getElementById('rabbit-sprite');
    rabbitShadowEl = document.getElementById('rabbit-shadow');
    trampolineSpringEl = document.getElementById('trampoline-bounce');
    numberPadEl = document.getElementById('number-pad');
    confettiCanvas = document.getElementById('game19-confetti-canvas');
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
    updateRoundProgress();
}

function setupVisuals() {
    const bg = STRINGS.images && STRINGS.images.background;
    if (stageEl && bg) {
        stageEl.style.backgroundImage = `url(${resolveGame19Asset(bg)})`;
    }

    const sheet = STRINGS.images && STRINGS.images.rabbitSpriteSheet;
    sheetFrameCount = (STRINGS.images && STRINGS.images.rabbitSpriteFrameCount) || 6;
    useSpriteSheet = Boolean(sheet);

    if (!useSpriteSheet || !rabbitSprite || !rabbitRoot) {
        console.warn('Game 19: rabbit sprite sheet missing in strings.js');
        return;
    }

    rabbitRoot.classList.add('game19-rabbit-root--sheet');
    const sheetUrl = resolveGame19Asset(sheet);
    rabbitSprite.style.backgroundImage = `url(${sheetUrl})`;
    rabbitSprite.style.setProperty('--sheet-steps', String(sheetFrameCount));
    setRabbitSheetFrame(GAME19_FRAME_IDLE);

    const shadowPath = STRINGS.images && STRINGS.images.rabbitShadow;
    if (rabbitShadowEl && shadowPath) {
        rabbitShadowEl.style.backgroundImage = `url(${resolveGame19Asset(shadowPath)})`;
    }

    const preload = new Image();
    preload.src = sheetUrl;
    preload.addEventListener('load', () => layoutScene(), { passive: true });
}

function buildNumberPad() {
    if (!numberPadEl) return;
    numberPadEl.innerHTML = '';
    for (let n = 1; n <= 9; n += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'game19-pad__btn';
        btn.textContent = String(n);
        btn.dataset.value = String(n);
        const ariaFn = STRINGS.aria && STRINGS.aria.numberChoice;
        btn.setAttribute('aria-label', ariaFn ? ariaFn(n) : String(n));
        btn.addEventListener('click', () => handleNumberChoice(n, btn));
        numberPadEl.appendChild(btn);
    }
    hideNumberPad();
}

/** Tune background crop and align rabbit feet to painted mat (cover math + measure) */
const GAME19_BG_WIDTH = 1280;
const GAME19_BG_HEIGHT = 720;
/** Contact point on the painted blue mat in background.jpg (normalized 0–1) */
const GAME19_MAT_STAND_X = 0.5;
const GAME19_MAT_STAND_Y = 500 / 720;

function getGame19BackgroundPlacement(stage) {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const ar = w / Math.max(1, h);
    const portrait = ar < 0.82;
    const posYPercent = portrait ? 0.54 : 0.5;
    const scale = Math.max(w / GAME19_BG_WIDTH, h / GAME19_BG_HEIGHT);
    const scaledW = GAME19_BG_WIDTH * scale;
    const scaledH = GAME19_BG_HEIGHT * scale;
    const posX = (w - scaledW) * 0.5;
    const posY = (h - scaledH) * posYPercent;
    return { w, h, scale, posX, posY, posYPercent, portrait };
}

function game19ImagePointToStage(placement, nx, ny) {
    const x = placement.posX + nx * GAME19_BG_WIDTH * placement.scale;
    const y = placement.posY + ny * GAME19_BG_HEIGHT * placement.scale;
    return { x, y, fromBottom: placement.h - y };
}

function getGame19RabbitVisualEl() {
    return rabbitSprite || rabbitRoot;
}

/** Show one frame of the horizontal jump sheet (0 = idle … 5 = land) */
function setRabbitSheetFrame(frameIndex) {
    if (!rabbitSprite || sheetFrameCount < 2) return;
    const idx = Math.max(0, Math.min(sheetFrameCount - 1, frameIndex));
    const pct = (idx / (sheetFrameCount - 1)) * 100;
    rabbitSprite.style.backgroundPosition = `${pct}% 0`;
}

/** Pick pose from hop elapsed time (matches rabbit_jump README timing) */
function pickJumpSheetFrame(elapsedMs, landed, settleSec, flightMs) {
    if (landed && settleSec > 0.04) {
        return GAME19_FRAME_LAND;
    }
    if (landed) {
        return GAME19_FRAME_IDLE;
    }
    if (elapsedMs < GAME19_CROUCH_MS) {
        return GAME19_FRAME_CROUCH;
    }
    const airMs = Math.max(1, flightMs);
    const p = Math.min(1, (elapsedMs - GAME19_CROUCH_MS) / airMs);
    if (p < 0.25) return GAME19_FRAME_TAKEOFF;
    if (p < 0.72) return GAME19_FRAME_AIR_TOP;
    return GAME19_FRAME_FALL;
}

/** Shadow shrinks and fades as the rabbit rises (README) */
function updateRabbitShadow(y, peakPx) {
    if (!rabbitShadowEl || peakPx <= 0) return;
    const lift = Math.min(1, Math.abs(Math.min(0, y)) / peakPx);
    const scale = 1 - 0.5 * lift;
    const opacity = 1 - 0.4 * lift;
    rabbitShadowEl.style.transform = `translateX(-50%) scale(${scale.toFixed(3)})`;
    rabbitShadowEl.style.opacity = String(Math.max(0.15, opacity));
}

/** Move jump-anchor so rabbit feet sit on the painted trampoline mat */
function layoutScene() {
    if (!stageEl) return;
    requestAnimationFrame(() => alignRabbitToPaintedMat(true));
}

/** @param {boolean} reset When true, clear prior pixel tweaks before measuring */
function alignRabbitToPaintedMat(reset) {
    const anchor = document.getElementById('jump-anchor');
    const visual = getGame19RabbitVisualEl();
    if (!stageEl || !anchor || !visual || visual.hidden) return;
    if (rabbitRoot && rabbitRoot.classList.contains('game19-rabbit-root--hop')) return;

    if (reset) {
        anchor.style.removeProperty('bottom');
        anchor.style.setProperty('--game19-align-x', '0px');
        void anchor.offsetHeight;
    }

    const placement = getGame19BackgroundPlacement(stageEl);
    stageEl.style.backgroundPosition = placement.portrait ? 'center 54%' : 'center center';

    const target = game19ImagePointToStage(placement, GAME19_MAT_STAND_X, GAME19_MAT_STAND_Y);
    const stageRect = stageEl.getBoundingClientRect();
    const feetRect = visual.getBoundingClientRect();
    const feetCenterX = (feetRect.left + feetRect.right) / 2 - stageRect.left;
    const feetFromBottom = stageRect.bottom - feetRect.bottom;

    const deltaY = target.fromBottom - feetFromBottom;
    const deltaX = target.x - feetCenterX;

    const baseBottom = parseFloat(getComputedStyle(anchor).bottom) || 0;
    anchor.style.bottom = `${baseBottom + deltaY}px`;
    anchor.style.setProperty('--game19-align-x', `${deltaX}px`);
}

function attachListeners() {
    if (continueButton) continueButton.addEventListener('click', handleContinueClick);
    if (dialogBackButton) {
        dialogBackButton.addEventListener('click', () => {
            window.location.href = '../../index.html';
        });
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('volumechange', handleVolumeChange);
    const unlock = () => {
        void ensureAudioContext();
        requestBackgroundAudioStart();
    };
    ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => {
        document.addEventListener(ev, unlock, { capture: true, once: true });
    });
    let layoutTimer = null;
    window.addEventListener('resize', () => {
        if (layoutTimer) clearTimeout(layoutTimer);
        layoutTimer = setTimeout(() => {
            layoutScene();
            resizeConfettiCanvas();
        }, 100);
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            layoutScene();
            resizeConfettiCanvas();
        }, 150);
    });
}

/** Stage-local point for confetti (from a pad button or the rabbit) */
function getConfettiBurstPoint(fromEl) {
    if (!stageEl) return { x: 160, y: 200 };
    const stageRect = stageEl.getBoundingClientRect();
    if (!fromEl) {
        return { x: stageRect.width * 0.5, y: stageRect.height * 0.42 };
    }
    const rect = fromEl.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2 - stageRect.left,
        y: rect.top + rect.height / 2 - stageRect.top
    };
}

function resizeConfettiCanvas() {
    if (!confettiCanvas || !stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    confettiCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    if (confettiCtx) confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawnConfetti(x, y, count) {
    if (!confettiCtx) return;
    for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 90 + Math.random() * 200;
        confettiPieces.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 80,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 8,
            life: 1.2 + Math.random() * 0.6,
            age: 0,
            size: 4 + Math.random() * 5,
            color: GAME19_CONFETTI_COLORS[Math.floor(Math.random() * GAME19_CONFETTI_COLORS.length)]
        });
    }
    if (confettiAnimFrame) return;
    let last = performance.now();
    const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        updateConfetti(dt);
        drawConfetti();
        if (confettiPieces.length) {
            confettiAnimFrame = requestAnimationFrame(tick);
        } else {
            confettiAnimFrame = null;
            if (confettiCtx && confettiCanvas) {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                confettiCtx.clearRect(0, 0, confettiCanvas.width / dpr, confettiCanvas.height / dpr);
            }
        }
    };
    confettiAnimFrame = requestAnimationFrame(tick);
}

function updateConfetti(dt) {
    const gravity = 320;
    confettiPieces = confettiPieces.filter((p) => {
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = confettiCanvas.width / dpr;
    const h = confettiCanvas.height / dpr;
    confettiCtx.clearRect(0, 0, w, h);
    confettiPieces.forEach((p) => {
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

/** Celebrate a correct count: burst at the tapped number and a smaller puff at the rabbit */
function celebrateCorrectAnswer(tappedBtn) {
    resizeConfettiCanvas();
    const btnPt = getConfettiBurstPoint(tappedBtn);
    const rabbitPt = getConfettiBurstPoint(rabbitSprite || rabbitRoot);
    spawnConfetti(btnPt.x, btnPt.y, 44);
    spawnConfetti(rabbitPt.x, rabbitPt.y - 12, 18);
}

function buildRoundProgress() {
    if (!roundProgressEl) return;
    roundProgressEl.innerHTML = '';
    for (let i = 0; i < ROUNDS_TO_COMPLETE; i += 1) {
        const carrot = document.createElement('span');
        carrot.className = 'game19-carrot';
        carrot.textContent = '🥕';
        carrot.setAttribute('aria-hidden', 'true');
        roundProgressEl.appendChild(carrot);
    }
    updateRoundProgress();
}

function updateRoundProgress() {
    if (!roundProgressEl) return;
    const carrots = roundProgressEl.querySelectorAll('.game19-carrot');
    const current = Math.min(roundsWon + 1, ROUNDS_TO_COMPLETE);
    carrots.forEach((el, index) => {
        el.classList.toggle('game19-carrot--done', index < roundsWon);
    });
    const ariaFn = STRINGS.labels && STRINGS.labels.roundProgress;
    const label =
        typeof ariaFn === 'function'
            ? ariaFn(current, ROUNDS_TO_COMPLETE)
            : `Runda ${current} av ${ROUNDS_TO_COMPLETE}`;
    roundProgressEl.setAttribute('aria-label', label);
}

/** Pad slide animation length (keep in sync with game.css) */
const GAME19_PAD_ANIM_MS = 340;

function setPadLocked(locked) {
    if (!numberPadEl) return;
    numberPadEl.classList.toggle('game19-pad--locked', locked);
    numberPadEl.querySelectorAll('.game19-pad__btn').forEach((btn) => {
        btn.disabled = locked;
    });
}

function hideNumberPadImmediate() {
    if (!numberPadEl) return;
    numberPadEl.classList.remove('game19-pad--visible', 'game19-pad--answer', 'game19-pad--hiding');
    setPadLocked(true);
}

/** Hide pad without animation (e.g. before a new round starts) */
function hideNumberPad() {
    hideNumberPadImmediate();
}

/** Slide pad out, then remove from DOM flow */
function animateOutNumberPad() {
    return new Promise((resolve) => {
        if (!numberPadEl || !numberPadEl.classList.contains('game19-pad--visible')) {
            hideNumberPadImmediate();
            resolve();
            return;
        }
        setPadLocked(true);
        numberPadEl.classList.add('game19-pad--hiding');
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            hideNumberPadImmediate();
            resolve();
        };
        numberPadEl.addEventListener('transitionend', finish, { once: true });
        window.setTimeout(finish, GAME19_PAD_ANIM_MS + 80);
    });
}

/** Large pad over the rabbit after the jump sequence */
function showNumberPadForAnswer() {
    if (!numberPadEl) return;
    numberPadEl.classList.remove('game19-pad--hiding');
    numberPadEl.classList.add('game19-pad--answer');
    void numberPadEl.offsetWidth;
    numberPadEl.classList.add('game19-pad--visible');
    setPadLocked(false);
}

function startGame() {
    hideCompletionDialog();
    roundsWon = 0;
    roundJumpTargets = pickJumpTargetsForGame();
    updateRoundProgress();
    void runRound();
}

/** Weight for jump count n (from strings.jumpCountWeights, default 1) */
function getJumpCountWeight(n) {
    const map = STRINGS.jumpCountWeights;
    if (map && map[n] != null) return Math.max(0, Number(map[n]));
    if (n <= 4) return 3;
    if (n <= 6) return 2;
    return 1;
}

/**
 * Pick ROUNDS_TO_COMPLETE distinct counts in [MIN_JUMPS..MAX_JUMPS], weighted toward lower numbers.
 */
function pickJumpTargetsForGame() {
    const pool = [];
    for (let n = MIN_JUMPS; n <= MAX_JUMPS; n += 1) pool.push(n);
    const picks = [];
    for (let r = 0; r < ROUNDS_TO_COMPLETE && pool.length > 0; r += 1) {
        let total = 0;
        const weights = pool.map((n) => {
            const w = getJumpCountWeight(n);
            total += w;
            return w;
        });
        let roll = Math.random() * total;
        let idx = pool.length - 1;
        for (let i = 0; i < pool.length; i += 1) {
            roll -= weights[i];
            if (roll <= 0) {
                idx = i;
                break;
            }
        }
        picks.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return picks;
}

async function runRound(options = {}) {
    const gen = ++roundGeneration;
    phase = 'intro';
    if (!options.deferPadHide) {
        hideNumberPad();
    }
    clearPadHighlight();

    targetJumps = roundJumpTargets[roundsWon] ?? MIN_JUMPS;

    await ensureAudioContext();
    requestBackgroundAudioStart();

    await playRoundIntroPrompt();
    if (gen !== roundGeneration) return;

    phase = 'jumping';
    if (instructionsEl) {
        instructionsEl.textContent = '';
    }
    await performJumpSequence(targetJumps, gen);
    if (gen !== roundGeneration) return;

    phase = 'answer';
    if (instructionsEl) {
        instructionsEl.textContent = '';
    }
    await speakAnswerPromptIfNeeded();
    await sleep(120);
    showNumberPadForAnswer();
}

/**
 * Before jumps: round 1–3 intro line on screen + TTS (or roundIntroSounds MP3 later).
 */
async function playRoundIntroPrompt() {
    const roundNum = Math.min(roundsWon + 1, ROUNDS_TO_COMPLETE);
    const speechMap = STRINGS.roundIntroSpeech || {};
    const text =
        speechMap[roundNum] ||
        speechMap[1] ||
        'Var med nu, räkna hoppen!';
    const sounds = STRINGS.roundIntroSounds || {};
    const mp3 = sounds[roundNum];

    if (instructionsEl) {
        instructionsEl.textContent = '';
        instructionsEl.classList.remove('game19-instructions--countdown');
    }

    const played = mp3 && (await playBufferUrlIfExists(resolveGame19Asset(mp3)));
    if (!played) {
        await speakText(text);
    }
    await sleep(350);
}

/** After jumps: speak the answer question (TTS until MP3 added to strings). */
async function speakAnswerPromptIfNeeded() {
    const text = STRINGS.instructionsAnswer || 'Hur många hopp var det?';
    const mp3 = STRINGS.answerPromptSound;
    const played = mp3 && (await playBufferUrlIfExists(resolveGame19Asset(mp3)));
    if (!played) {
        await speakText(text);
    }
}

async function performJumpSequence(count, gen) {
    for (let i = 0; i < count; i += 1) {
        if (gen !== roundGeneration) return;
        await playOneJump();
        if (i < count - 1) {
            await sleep(180 + Math.floor(Math.random() * 220));
        }
    }
}


function getJumpTargetEl() {
    return rabbitSprite;
}

/** Gravity for hop arc (CSS pixels per second²), similar idea to game 16 */
const GAME19_HOP_GRAVITY = 2200;

function remToPx(rem) {
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return rem * rootPx;
}

/** Random peak height and drift for one hop (front rabbit; limbs animated separately) */
function buildHopParams() {
    const driftPx = Math.round((Math.random() - 0.5) * 28);
    const superHop = Math.random() < 0.28;
    const peakRem = superHop ? 12 + Math.random() * 4 : 7.5 + Math.random() * 4.5;
    const peakPx = remToPx(peakRem);
    const gravity = GAME19_HOP_GRAVITY;
    const initialVy = -Math.sqrt(2 * gravity * peakPx);
    const flightSec = (2 * Math.abs(initialVy)) / gravity;
    const flightMs = Math.round(flightSec * 1000);
    return { peakPx, driftPx, initialVy, gravity, flightMs };
}

/**
 * Smooth hop arc via requestAnimationFrame (same pattern as game 16 ball loop).
 * @param {HTMLElement} hopHost
 * @param {HTMLElement} el
 * @param {ReturnType<typeof buildHopParams>} params
 */
function runPhysicsHop(hopHost, el, params) {
    return new Promise((resolve) => {
        let y = 0;
        let vy = params.initialVy;
        let lastTs = 0;
        let airborn = false;
        let landed = false;
        let settleSec = 0.14;
        let trampTriggered = false;
        const startTs = performance.now();
        const maxMs = 6000;

        const finish = () => {
            if (el) {
                el.style.transform = '';
            }
            setRabbitSheetFrame(GAME19_FRAME_IDLE);
            updateRabbitShadow(0, params.peakPx);
            resolve();
        };

        const tick = (ts) => {
            const dt = lastTs ? Math.min(0.033, (ts - lastTs) / 1000) : 0.016;
            lastTs = ts;

            if (!landed) {
                vy += params.gravity * dt;
                y += vy * dt;
                if (y < -2) {
                    airborn = true;
                }
                if (airborn && y >= 0) {
                    y = 0;
                    landed = true;
                    if (!trampTriggered) {
                        trampTriggered = true;
                        triggerTrampolineBounceMs(params.flightMs + 180);
                    }
                }
            } else {
                settleSec -= dt;
                if (settleSec <= 0) {
                    finish();
                    return;
                }
            }

            const elapsed = (ts - startTs) / 1000;
            const flightSec = params.flightMs / 1000;
            const arcT = landed ? 1 : Math.min(1, elapsed / Math.max(0.001, flightSec));
            const elapsedMs = ts - startTs;
            const driftX = params.driftPx * Math.sin(Math.PI * arcT);

            hopHost.style.transform = '';

            if (el) {
                el.style.transform = `translateX(${driftX}px) translateY(${y}px)`;
            }

            const frame = pickJumpSheetFrame(elapsedMs, landed, settleSec, params.flightMs);
            setRabbitSheetFrame(frame);
            updateRabbitShadow(y, params.peakPx);

            if (ts - startTs > maxMs) {
                finish();
                return;
            }
            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    });
}

function triggerTrampolineBounceMs(durationMs) {
    if (!trampolineSpringEl) return;
    const dur = `${Math.max(400, durationMs)}ms`;
    trampolineSpringEl.style.setProperty('--hop-duration', dur);
    trampolineSpringEl.classList.remove('game19-trampoline--bounce');
    void trampolineSpringEl.offsetWidth;
    trampolineSpringEl.classList.add('game19-trampoline--bounce');
    let cleared = false;
    const clear = (event) => {
        if (event && event.animationName && event.animationName !== 'game19-tramp-bend') {
            return;
        }
        if (cleared) return;
        cleared = true;
        trampolineSpringEl.classList.remove('game19-trampoline--bounce');
    };
    trampolineSpringEl.addEventListener('animationend', clear, { once: true });
    window.setTimeout(clear, parseInt(dur, 10) + 80);
}

/** One hop on the center of the mat; trampoline surface bends on landing */
function playOneJump() {
    return new Promise((resolve) => {
        const el = getJumpTargetEl();
        if (!el) {
            resolve();
            return;
        }
        const hopHost = rabbitRoot || el;

        const runHop = (params) => {
            hopHost.classList.add('game19-rabbit-root--hop');
            setRabbitSheetFrame(GAME19_FRAME_CROUCH);
            void playJumpSound();
            void runPhysicsHop(hopHost, el, params).then(() => {
                hopHost.classList.remove('game19-rabbit-root--hop');
                setRabbitSheetFrame(GAME19_FRAME_IDLE);
                resolve();
            });
        };

        runHop(buildHopParams());
    });
}

async function handleNumberChoice(n, btn) {
    if (phase !== 'answer' || !btn) return;
    await ensureAudioContext();

    if (n !== targetJumps) {
        btn.classList.remove('game19-pad__btn--wrong');
        void btn.offsetWidth;
        btn.classList.add('game19-pad__btn--wrong');
        void playErrorSound();
        return;
    }

    phase = 'idle';
    setPadLocked(true);
    btn.classList.add('game19-pad__btn--right');
    void playSuccessSound();
    celebrateCorrectAnswer(btn);

    roundsWon += 1;
    updateRoundProgress();

    /** Short pause after the success beep before the next spoken prompt */
    await sleep(200);

    clearPadHighlight();
    void animateOutNumberPad();

    if (roundsWon >= ROUNDS_TO_COMPLETE) {
        phase = 'complete';
        showCompletionDialog();
        return;
    }

    void runRound({ deferPadHide: true });
}

function clearPadHighlight() {
    numberPadEl?.querySelectorAll('.game19-pad__btn').forEach((btn) => {
        btn.classList.remove('game19-pad__btn--wrong', 'game19-pad__btn--right');
    });
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

function prefetchSfx() {
    [STRINGS.jumpSound, STRINGS.successSound, STRINGS.errorSound].forEach((p) => {
        if (!p) return;
        void loadAudioBuffer(resolveGame19Asset(p));
    });
    Object.values(STRINGS.roundIntroSounds || {}).forEach((p) => {
        if (p) void loadAudioBuffer(resolveGame19Asset(p));
    });
    if (STRINGS.answerPromptSound) {
        void loadAudioBuffer(resolveGame19Asset(STRINGS.answerPromptSound));
    }
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
            console.warn('game19: could not load audio', url, error);
            failedAudioUrls.add(url);
            return null;
        } finally {
            audioLoadInFlight.delete(url);
        }
    })();
    audioLoadInFlight.set(url, loadPromise);
    return loadPromise;
}

async function playBufferUrlIfExists(url) {
    if (!url) return false;
    const cached = audioBufferCache.get(url);
    const buffer = cached || (await loadAudioBuffer(url));
    if (!buffer) return false;
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return false;
    playSfxFromBuffer(buffer);
    await sleep(Math.max(200, buffer.duration * 1000 - 50));
    return true;
}

function playSfxFromBuffer(buffer, volumeScale = 1.2) {
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

async function playJumpSound() {
    const url = resolveGame19Asset(STRINGS.jumpSound);
    const cached = url ? audioBufferCache.get(url) : null;
    if (cached) {
        playSfxFromBuffer(cached, 1.4);
        return;
    }
    const buf = url ? await loadAudioBuffer(url) : null;
    if (buf) {
        playSfxFromBuffer(buf, 1.4);
        return;
    }
    playJumpTone();
}

async function playSuccessSound() {
    const url = resolveGame19Asset(STRINGS.successSound);
    const buf = url ? await loadAudioBuffer(url) : null;
    if (buf) {
        playSfxFromBuffer(buf);
        return;
    }
    playSuccessTone();
}

async function playErrorSound() {
    const url = resolveGame19Asset(STRINGS.errorSound);
    const buf = url ? await loadAudioBuffer(url) : null;
    if (buf) {
        playSfxFromBuffer(buf);
        return;
    }
    playErrorTone();
}

function playJumpTone() {
    if (!audioContext || audioContext.state !== 'running') return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const vol = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.25;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.16);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.18);
}

function playSuccessTone() {
    if (!audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    const vol = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.22;
    [523, 659].forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        const t = now + i * 0.07;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.02);
        gain.gain.linearRampToValueAtTime(0, t + 0.18);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    });
}

function playErrorTone() {
    if (!audioContext || audioContext.state !== 'running') return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const vol = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.2;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.22);
}

function speakText(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis || !text) {
            resolve();
            return;
        }
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'sv-SE';
        utter.rate = 0.92;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
    });
}

async function ensureAudioContext() {
    if (!audioContext) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioContext = new Ctx();
    }
    if (audioContext && audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (_) {
            // ignore
        }
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
    const url = resolveGame19Asset(track);
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
        try {
            backgroundSource.stop();
        } catch (_) {
            // ignore
        }
        backgroundSource = null;
    }
    if (backgroundGain) {
        try {
            backgroundGain.disconnect();
        } catch (_) {
            // ignore
        }
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
