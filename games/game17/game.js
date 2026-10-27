// Kör mot ordet (Game 17) – top-down car in a meadow, steer to the word, avoid trees and rabbits
'use strict';

const STRINGS = window.GAME17_STRINGS || {};
const ASSETS = window.TiddeliAssets;
const WORDS = Array.isArray(STRINGS.words) ? STRINGS.words.slice() : [];
const NUM_TARGETS = 4;
const ROCK_COUNT = 9;
/** Side-view trees (trunk collision) */
const TREE_COUNT = 17;
/** Tree scale (side-view height ≈ 2.2× this value) */
const TREE_RADIUS = 28;

/** Car hitbox radius in CSS pixels */
const CAR_RADIUS = 22;
/** Rabbit hazard hit radius (field pixels) */
const ROCK_RADIUS = 17;
/** How fast the car returns to start when released (px/s) */
const RETURN_SPEED = 280;
/** Minimum speed (px/s) before engine sound is audible */
const ENGINE_MIN_SPEED = 25;
/** Max slide speed toward the pointer (px/s) */
const POINTER_MAX_SPEED = 540;
/** How tightly the car closes the gap to the cursor (higher = less lag) */
const POINTER_FOLLOW_SHARPNESS = 26;
/** Stop moving when the pointer is this close (px) */
const STEER_MIN_DIR = 8;
/** Auto-return: aim the sprite toward home */
const RETURN_AIM_SHARPNESS = 14;
/** Tree wobble after the car hits it (ms) */
const TREE_WIGGLE_MS = 580;
/** Cartoon bump on the car after a crash (ms) */
const CAR_CRASH_FX_MS = 560;
/** Confetti tints for a correct word hit */
const CONFETTI_COLORS = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#fb923c', '#c084fc', '#f87171'];

function resolveGame17Asset(path) {
    if (!path) return '';
    if (ASSETS && typeof ASSETS.resolveGameAsset === 'function') {
        return ASSETS.resolveGameAsset('game17', path);
    }
    return path;
}

function resolveWordSound(path) {
    if (!path) return '';
    if (ASSETS && typeof ASSETS.resolveGameAsset === 'function') {
        return ASSETS.resolveGameAsset('game14', path);
    }
    return path;
}

let titleEl = null;
let instructionsEl = null;
let fieldEl = null;
let targetsEl = null;
let canvas = null;
let ctx = null;
let listenButton = null;
let completionDialog = null;
let completionTitle = null;
let completionMessage = null;
let continueButton = null;
let dialogBackButton = null;

let audioContext = null;
let backgroundBuffer = null;
let backgroundSource = null;
let backgroundGain = null;
let promptSource = null;
let promptPlaybackResolve = null;
const audioBufferCache = new Map();

let engineOscA = null;
let engineOscB = null;
let engineGain = null;
/** Sample-based engine (MP3 loop); null buffer → synthesized engine */
let engineSampleSource = null;
let engineSampleGain = null;
let engineSampleBuffer = null;
let engineSampleReady = false;
let engineSampleFailed = false;
/** Preloaded correct-word sting (avoids fetch/decode delay on hit) */
let successSampleBuffer = null;
let successSampleReady = false;
/** Preloaded wrong-word sting */
let oupsSampleBuffer = null;
let oupsSampleReady = false;

/** Loaded sprites (null = draw placeholder shapes) */
const sprites = {
    car: null,
    carReady: false,
    rabbits: [],
    rabbitsReady: false,
    background: null,
    backgroundReady: false
};
/** When true, custom field BG is shown — canvas skips painted meadow/trees */
let fieldBackgroundReady = false;
/** 'straight' = open middle lane; 'winding' = block center, pass via sides */
let sceneryLayoutStyle = 'straight';

const state = {
    targetWord: null,
    options: [],
    targetEls: [],
    roundComplete: false,
    promptPlaying: false,
    promptNeedsRetry: false,
    canDrive: true,
    dragging: false,
    returning: false,
    /** True while crash SFX plays — car frozen at impact */
    crashRecovering: false,
    /** True while success SFX plays — car stays at the word */
    celebrating: false,
    /** 'tree' | 'rabbit' — which hit sound to play during crashRecovering */
    crashAudioKind: 'tree',
    /** Engine keeps idling after first drive until the car is back at start */
    engineIgnited: false,
    pointerId: null,
    audioStarted: false,
    audioStarting: false,
    rest: { x: 0, y: 0 },
    car: { x: 0, y: 0, angle: -Math.PI / 2 },
    prevCar: { x: 0, y: 0 },
    /** Touch point while driving (field coordinates) */
    steerX: 0,
    steerY: 0,
    speed: 0,
    /** { startTime, durationMs } — tilt, bounce, stars while crashRecovering */
    carCrashFx: null,
    /** Short-lived celebration pieces (canvas field coordinates) */
    confetti: [],
    rocks: [],
    trees: [],
    lastTs: 0
};

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachEventListeners();
    resizeCanvas();
    loadSprites();
    loadFieldBackground();
    preloadEngineSample();
    preloadSuccessSample();
    preloadOupsSample();
    startNewRound();
    requestBackgroundAudioStart();
    loop(performance.now());
});

function cacheDomElements() {
    titleEl = document.getElementById('game17-title');
    instructionsEl = document.getElementById('instructions-text');
    fieldEl = document.getElementById('game17-field');
    targetsEl = document.getElementById('targets');
    canvas = document.getElementById('drive-canvas');
    ctx = canvas ? canvas.getContext('2d') : null;
    listenButton = document.getElementById('listen-button');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
    dialogBackButton = document.getElementById('dialog-back-button');

}

function populateStaticTexts() {
    if (titleEl) titleEl.textContent = STRINGS.title || '';
    if (instructionsEl) instructionsEl.textContent = STRINGS.instructions || '';
    if (continueButton) continueButton.textContent = (STRINGS.labels && STRINGS.labels.continue) || 'Fortsätt';
    if (dialogBackButton) dialogBackButton.textContent = (STRINGS.labels && STRINGS.labels.back) || 'Tillbaka';
    if (completionTitle) completionTitle.textContent = (STRINGS.dialog && STRINGS.dialog.title) || '';
    if (completionMessage) completionMessage.textContent = (STRINGS.dialog && STRINGS.dialog.message) || '';
    if (listenButton && STRINGS.aria && STRINGS.aria.listen) {
        listenButton.setAttribute('aria-label', STRINGS.aria.listen);
    }
    if (fieldEl && STRINGS.aria && STRINGS.aria.field) {
        fieldEl.setAttribute('aria-label', STRINGS.aria.field);
    }
    if (targetsEl) {
        targetsEl.setAttribute('aria-label', 'Ord');
    }
}

function attachEventListeners() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('volumechange', handleVolumeChange);
    window.addEventListener('resize', () => {
        resizeCanvas();
        layoutRestPosition();
        placeScenery();
        if (!state.dragging && !state.returning) resetCarToRest();
    });
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
        document.addEventListener(eventName, handleFirstInteraction, { once: true });
    });
    if (continueButton) continueButton.addEventListener('click', handleContinueClick);
    if (dialogBackButton) dialogBackButton.addEventListener('click', handleDialogBackClick);
    if (listenButton) listenButton.addEventListener('click', handleListenClick);

    if (canvas) {
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
    }
}

function loadSprites() {
    const carPath = STRINGS.images && STRINGS.images.car;
    if (carPath) {
        const img = new Image();
        img.onload = () => {
            sprites.car = img;
            sprites.carReady = true;
        };
        img.onerror = () => {
            sprites.carReady = false;
        };
        img.src = resolveGame17Asset(carPath);
    }

    const rabbitPaths =
        STRINGS.images && Array.isArray(STRINGS.images.rabbits) ? STRINGS.images.rabbits : [];
    sprites.rabbits = [];
    sprites.rabbitsReady = false;
    if (!rabbitPaths.length) return;

    let loaded = 0;
    rabbitPaths.forEach((path, index) => {
        const img = new Image();
        img.onload = () => {
            sprites.rabbits[index] = img;
            loaded += 1;
            if (loaded === rabbitPaths.length) {
                sprites.rabbitsReady = sprites.rabbits.some(Boolean);
            }
        };
        img.onerror = () => {
            loaded += 1;
            if (loaded === rabbitPaths.length) {
                sprites.rabbitsReady = sprites.rabbits.some(Boolean);
            }
        };
        img.src = resolveGame17Asset(path);
    });
}

/** Meadow art from assets; WebP → PNG → painted meadow */
function loadFieldBackground() {
    if (fieldBackgroundReady && sprites.background) {
        return;
    }
    const images = STRINGS.images || {};
    const paths = [images.background].filter(Boolean);
    if (!paths.length) return;

    sprites.backgroundReady = false;
    fieldBackgroundReady = false;

    function tryPath(index) {
        if (index >= paths.length) {
            sprites.background = null;
            sprites.backgroundReady = false;
            fieldBackgroundReady = false;
            return;
        }
        const img = new Image();
        img.onload = () => {
            sprites.background = img;
            sprites.backgroundReady = true;
            fieldBackgroundReady = true;
        };
        img.onerror = () => tryPath(index + 1);
        img.src = resolveGame17Asset(paths[index]);
    }

    tryPath(0);
}

function resizeCanvas() {
    if (!canvas || !fieldEl) return;
    const rect = fieldEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Car start: centered at the bottom of the open field */
function layoutRestPosition() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    state.rest.x = w * 0.5;
    state.rest.y = h * 0.88;
}

function resetCarToRest() {
    state.car.x = state.rest.x;
    state.car.y = state.rest.y;
    state.car.angle = -Math.PI / 2;
    state.prevCar.x = state.car.x;
    state.prevCar.y = state.car.y;
    state.speed = 0;
    state.returning = false;
    state.engineIgnited = false;
    state.carCrashFx = null;
    stopEngineSound();
}

/**
 * Size canvas, place scenery, reset car — then run callback after the next paint
 * so "Kör mot" does not start before word chips and obstacles are on screen.
 */
function afterRoundLayoutReady(callback) {
    requestAnimationFrame(() => {
        resizeCanvas();
        layoutRestPosition();
        placeScenery();
        resetCarToRest();
        requestAnimationFrame(() => {
            if (callback) callback();
        });
    });
}

function startNewRound() {
    hideCompletionDialog();
    stopPromptPlayback();
    state.roundComplete = false;
    state.promptPlaying = false;
    state.promptNeedsRetry = false;
    state.canDrive = true;
    state.dragging = false;
    state.returning = false;
    state.crashRecovering = false;
    state.celebrating = false;
    state.engineIgnited = false;
    state.confetti = [];
    state.targetEls = [];

    if (WORDS.length < NUM_TARGETS) {
        console.error('Not enough words for game17');
        return;
    }

    const shuffled = shuffleArray(WORDS);
    state.options = shuffleArray(shuffled.slice(0, NUM_TARGETS));
    state.targetWord = state.options[Math.floor(Math.random() * state.options.length)];

    if (targetsEl) {
        targetsEl.innerHTML = '';
        state.options.forEach((word) => {
            const el = document.createElement('div');
            el.className = 'game17-target';
            el.textContent = word.label;
            el.dataset.wordId = word.id;
            el.setAttribute(
                'aria-label',
                STRINGS.aria && STRINGS.aria.word ? STRINGS.aria.word(word.label) : word.label
            );
            targetsEl.appendChild(el);
            state.targetEls.push({ word, el });
        });
    }

    afterRoundLayoutReady(() => {
        playSpokenPrompt().catch((error) => {
            console.warn('Could not play prompt:', error);
        });
    });
}

/** Place trees and rocks; mix straight and winding layouts that stay fair on narrow screens */
function placeScenery() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const tryWindingFirst = Math.random() < 0.9;
    const styles = tryWindingFirst ? ['winding', 'straight'] : ['straight', 'winding'];

    for (const style of styles) {
        sceneryLayoutStyle = style;
        for (let attempt = 0; attempt < 24; attempt++) {
            placeTrees();
            placeRocks();
            placeWindingChokes();
            placeMidfieldTrees();
            finalizeSceneryLayout();
            if (layoutPassesPathCheck(style)) return;
        }
    }

    sceneryLayoutStyle = 'winding';
    placeTrees();
    placeRocks();
    placeWindingChokes();
    placeMidfieldTrees();
    finalizeSceneryLayout();
}

/** Center keep-clear band — wider when the field is narrow */
function getDriveCorridorBounds(w) {
    const half =
        w < 340
            ? w * 0.18
            : w < 420
              ? w * 0.16
              : w < 520
                ? w * 0.13
                : w * 0.1;
    return { left: w * 0.5 - half, right: w * 0.5 + half };
}

function isInDriveCorridor(x, obstacleRadius, w) {
    const corridor = getDriveCorridorBounds(w);
    return x + obstacleRadius > corridor.left && x - obstacleRadius < corridor.right;
}

function treeCountForFieldWidth(w) {
    if (w < 340) return 9;
    if (w < 420) return 12;
    if (w < 520) return 14;
    return TREE_COUNT;
}

function rockCountForFieldWidth(w) {
    if (w < 360) return 6;
    return ROCK_COUNT;
}

function collectObstacleCircles() {
    const circles = [];
    state.trees.forEach((tree) => {
        circles.push(getTreeHitZone(tree));
    });
    state.rocks.forEach((rock) => {
        circles.push({ x: rock.x, y: rock.y, r: rock.r });
    });
    return circles;
}

function pointClearForCar(x, y, circles, extraMargin) {
    const margin = CAR_RADIUS + (extraMargin || 8);
    for (const c of circles) {
        if (dist({ x, y }, c) < margin + c.r) return false;
    }
    return true;
}

function getPathSampleRange() {
    const startY = state.rest.y - CAR_RADIUS;
    const endY = getCarMinY() + CAR_RADIUS * 0.5;
    return { startY, endY, steps: 28 };
}

/** Lanes that must stay open — one vertical path per word still on the board */
function getRequiredLaneXs(w) {
    const xs = [];
    if (state.targetEls && state.targetEls.length) {
        state.targetEls.forEach((entry) => {
            if (!entry.el || entry.el.classList.contains('game17-target--removed')) return;
            const pt = fieldPointFromElement(entry.el);
            if (pt) xs.push(pt.x);
        });
    }
    if (!xs.length && targetsEl) {
        targetsEl.querySelectorAll('.game17-target:not(.game17-target--removed)').forEach((el) => {
            const pt = fieldPointFromElement(el);
            if (pt) xs.push(pt.x);
        });
    }
    if (!xs.length) {
        [0.22, 0.39, 0.61, 0.78].forEach((t) => xs.push(w * t));
    }
    return xs;
}

function isVerticalLaneClear(laneX, circles, extraMargin) {
    if (!fieldEl) return true;
    const { startY, endY, steps } = getPathSampleRange();
    if (endY >= startY) return true;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = startY + (endY - startY) * t;
        if (!pointClearForCar(laneX, y, circles, extraMargin)) return false;
    }
    return true;
}

function layoutPassesPathCheck(style) {
    if (!fieldEl) return true;
    const w = fieldEl.clientWidth;
    const circles = collectObstacleCircles();
    const margin = 6;
    const laneXs = getRequiredLaneXs(w);
    const allWordsReachable = laneXs.every((laneX) =>
        isVerticalLaneClear(laneX, circles, margin)
    );
    if (!allWordsReachable) return false;

    const centerBlocked = !isVerticalLaneClear(w * 0.5, circles, margin + 4);
    const pinchLanes = [0.38, 0.62].map((t) => w * t);
    const pinchBlocked = pinchLanes.some(
        (laneX) => !isVerticalLaneClear(laneX, circles, margin + 2)
    );

    return centerBlocked && pinchBlocked;
}

/** Rabbits on the middle line at different heights */
function placeWindingChokes() {
    const bands = [0.28, 0.44, 0.6, 0.72];
    const count = Math.random() < 0.35 ? 4 : 3;
    for (let i = 0; i < count; i++) {
        placeWindingChoke(bands[i % bands.length]);
    }
}

/** One rabbit near the middle to discourage driving straight up */
function placeWindingChoke(heightT) {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const minY = getRockAreaMinY(h);
    const maxY = h * 0.78;
    const t = typeof heightT === 'number' ? heightT : 0.38 + Math.random() * 0.22;
    const midY = minY + (maxY - minY) * (t + (Math.random() - 0.5) * 0.06);
    const chokeX = w * 0.5 + (Math.random() - 0.5) * w * 0.12;

    const rock = {
        x: chokeX,
        y: midY,
        r: ROCK_RADIUS,
        seed: Math.random() * 1000,
        variant: 0,
        rotation: Math.random() * Math.PI * 2,
        scale: 0.9 + Math.random() * 0.2
    };
    if (dist(rock, state.rest) < CAR_RADIUS + ROCK_RADIUS + 50) return;
    if (state.rocks.some((r) => dist(rock, r) < ROCK_RADIUS * 2)) return;
    const rabbitVariants =
        STRINGS.images && Array.isArray(STRINGS.images.rabbits) ? STRINGS.images.rabbits.length : 1;
    rock.variant = Math.floor(Math.random() * Math.max(1, rabbitVariants));
    state.rocks.push(rock);
}

/** Extra trees between the edges and the word lanes */
function placeMidfieldTrees() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const playMinY = getPlayAreaMinY(h);
    const maxBaseY = h * 0.9;
    const margin = TREE_RADIUS + 10;
    const extra = w < 400 ? 5 : w < 520 ? 7 : 9;
    const laneXs = getRequiredLaneXs(w);

    for (let n = 0; n < extra; n++) {
        for (let tryN = 0; tryN < 35; tryN++) {
            const lane = laneXs[Math.floor(Math.random() * laneXs.length)] || w * 0.5;
            const offset = (Math.random() < 0.5 ? -1 : 1) * (CAR_RADIUS * 2.2 + Math.random() * w * 0.08);
            const x = Math.max(margin, Math.min(w - margin, lane + offset));
            const r = TREE_RADIUS * (0.72 + Math.random() * 0.38);
            const minBaseY = playMinY + sideTreeHeightAboveGround(r);
            if (minBaseY >= maxBaseY - 8) continue;
            const y = minBaseY + Math.random() * (maxBaseY - minBaseY);
            const candidate = {
                x,
                y,
                r,
                seed: Math.random() * 1000,
                hue: Math.random(),
                pine: Math.random() > 0.35
            };
            if (dist(candidate, state.rest) < CAR_RADIUS + candidate.r + 34) continue;
            if (state.trees.some((t) => dist(candidate, t) < candidate.r * 0.5 + t.r * 0.5)) continue;
            if (state.rocks.some((rock) => dist(candidate, rock) < candidate.r + rock.r + 6)) continue;
            state.trees.push(candidate);
            break;
        }
    }
}

/** How many path samples on a lane an obstacle blocks */
function obstacleLaneBlockScore(laneX, circle, margin) {
    const { startY, endY, steps } = getPathSampleRange();
    let score = 0;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = startY + (endY - startY) * t;
        if (!pointClearForCar(laneX, y, [circle], margin)) score += 1;
    }
    return score;
}

/** Remove only obstacles that block a word lane (never random culls) */
function surgicalTrimBlockedWordLanes(maxRemovals) {
    const margin = 6;
    const w = fieldEl ? fieldEl.clientWidth : 0;
    if (!w) return;
    const laneXs = getRequiredLaneXs(w);
    let removed = 0;
    while (removed < maxRemovals) {
        const circles = collectObstacleCircles();
        const blockedLane = laneXs.find((laneX) => !isVerticalLaneClear(laneX, circles, margin));
        if (!blockedLane) break;

        let best = null;
        let bestScore = 0;
        state.rocks.forEach((rock, index) => {
            const score = obstacleLaneBlockScore(blockedLane, { x: rock.x, y: rock.y, r: rock.r }, margin);
            if (score > bestScore) {
                bestScore = score;
                best = { kind: 'rock', index };
            }
        });
        state.trees.forEach((tree, index) => {
            const zone = getTreeHitZone(tree);
            const score = obstacleLaneBlockScore(blockedLane, zone, margin);
            if (score > bestScore) {
                bestScore = score;
                best = { kind: 'tree', index };
            }
        });
        if (!best || bestScore < 1) break;
        if (best.kind === 'rock') state.rocks.splice(best.index, 1);
        else state.trees.splice(best.index, 1);
        removed += 1;
    }
}

/** Add middle clutter if the center lane is still too open */
function ensureMiddleBlocked() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const margin = 6;
    for (let guard = 0; guard < 5; guard++) {
        if (!isVerticalLaneClear(w * 0.5, collectObstacleCircles(), margin + 4)) break;
        placeWindingChoke(0.32 + Math.random() * 0.38);
    }
    const pinchLanes = [0.38, 0.62].map((t) => w * t);
    pinchLanes.forEach((laneX) => {
        if (!isVerticalLaneClear(laneX, collectObstacleCircles(), margin + 2)) return;
        tryPlacePinchTree(laneX);
    });
}

function tryPlacePinchTree(x) {
    if (!fieldEl) return false;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const playMinY = getPlayAreaMinY(h);
    const maxBaseY = h * 0.88;
    const r = TREE_RADIUS * (0.68 + Math.random() * 0.32);
    const minBaseY = playMinY + sideTreeHeightAboveGround(r);
    if (minBaseY >= maxBaseY - 8) return false;
    const y = minBaseY + (maxBaseY - minBaseY) * (0.35 + Math.random() * 0.45);
    const candidate = {
        x,
        y,
        r,
        seed: Math.random() * 1000,
        hue: Math.random(),
        pine: Math.random() > 0.4
    };
    if (dist(candidate, state.rest) < CAR_RADIUS + candidate.r + 30) return false;
    if (state.trees.some((t) => dist(candidate, t) < candidate.r * 0.55 + t.r * 0.55)) return false;
    state.trees.push(candidate);
    return true;
}

function tryPlaceExtraRock() {
    if (!fieldEl) return false;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const minY = getRockAreaMinY(h);
    const maxY = h * 0.86;
    const margin = ROCK_RADIUS + 10;
    const rabbitVariants =
        STRINGS.images && Array.isArray(STRINGS.images.rabbits) ? STRINGS.images.rabbits.length : 1;
    for (let tryN = 0; tryN < 25; tryN++) {
        const x = margin + Math.random() * (w - margin * 2);
        const y = minY + Math.random() * (maxY - minY);
        const candidate = { x, y, r: ROCK_RADIUS };
        if (dist(candidate, state.rest) < CAR_RADIUS + ROCK_RADIUS + 28) continue;
        if (state.rocks.some((r) => dist(candidate, r) < ROCK_RADIUS * 2.2)) continue;
        if (state.trees.some((t) => dist(candidate, t) < ROCK_RADIUS + t.r * 0.5)) continue;
        candidate.seed = Math.random() * 1000;
        candidate.variant = Math.floor(Math.random() * Math.max(1, rabbitVariants));
        candidate.rotation = Math.random() * Math.PI * 2;
        candidate.scale = 0.85 + Math.random() * 0.35;
        state.rocks.push(candidate);
        return true;
    }
    return false;
}

function tryPlaceExtraTree() {
    if (!fieldEl) return false;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const playMinY = getPlayAreaMinY(h);
    const maxBaseY = h * 0.92;
    const margin = TREE_RADIUS + 8;
    for (let tryN = 0; tryN < 25; tryN++) {
        const x = margin + Math.random() * (w - margin * 2);
        const r = TREE_RADIUS * (0.75 + Math.random() * 0.42);
        const minBaseY = playMinY + sideTreeHeightAboveGround(r);
        if (minBaseY >= maxBaseY - 8) continue;
        const y = minBaseY + Math.random() * (maxBaseY - minBaseY);
        const candidate = {
            x,
            y,
            r,
            seed: Math.random() * 1000,
            hue: Math.random(),
            pine: Math.random() > 0.3
        };
        if (dist(candidate, state.rest) < CAR_RADIUS + candidate.r + 32) continue;
        if (state.trees.some((t) => dist(candidate, t) < candidate.r * 0.55 + t.r * 0.55)) continue;
        if (state.rocks.some((rock) => dist(candidate, rock) < candidate.r + rock.r + 4)) continue;
        state.trees.push(candidate);
        return true;
    }
    return false;
}

/** Trim only blocking word lanes, pad the middle, then pack in more scenery while paths still work */
function finalizeSceneryLayout() {
    surgicalTrimBlockedWordLanes(8);
    ensureMiddleBlocked();
    densifySceneryWhileValid();
}

function densifySceneryWhileValid() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const rounds = w < 400 ? 10 : w < 520 ? 14 : 18;
    for (let n = 0; n < rounds; n++) {
        const addedRock = Math.random() < 0.48 ? tryPlaceExtraRock() : false;
        const addedTree = addedRock ? false : tryPlaceExtraTree();
        if (!addedRock && !addedTree) continue;
        if (!layoutPassesPathCheck(sceneryLayoutStyle)) {
            if (addedRock) state.rocks.pop();
            else state.trees.pop();
        }
    }
}

/** How far foliage extends above the ground anchor for a side-view tree */
function sideTreeHeightAboveGround(r) {
    return r * 2.25;
}

/** Trees along edges and scattered — car crashes into the trunk */
function placeTrees() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const trees = [];
    const playMinY = getPlayAreaMinY(h);
    const maxBaseY = h * 0.92;
    const margin = TREE_RADIUS + 8;
    const treeGoal = treeCountForFieldWidth(w);
    const narrow = w < 520;
    for (let i = 0; i < treeGoal; i++) {
        let placed = false;
        for (let tryN = 0; tryN < 50 && !placed; tryN++) {
            let x;
            const sideBias = narrow ? 0.58 : 0.48;
            if (Math.random() < sideBias) {
                const side = Math.random() < 0.5 ? 0 : 1;
                const sideWidth = narrow ? w * 0.3 : w * 0.26;
                x = side
                    ? margin + Math.random() * sideWidth
                    : w - margin - Math.random() * sideWidth;
            } else {
                x = margin + Math.random() * (w - margin * 2);
            }
            const r = TREE_RADIUS * (0.78 + Math.random() * 0.45);
            const seed = Math.random() * 1000;
            const minBaseY = playMinY + sideTreeHeightAboveGround(r);
            if (minBaseY >= maxBaseY - 8) continue;
            const y = minBaseY + Math.random() * (maxBaseY - minBaseY);
            const candidate = {
                x,
                y,
                r,
                seed,
                hue: Math.random(),
                pine: Math.sin(seed * 1.73) > 0.15
            };
            if (dist(candidate, state.rest) < CAR_RADIUS + candidate.r + 40) continue;
            if (trees.some((t) => dist(candidate, t) < candidate.r * 0.65 + t.r * 0.65)) continue;
            trees.push(candidate);
            placed = true;
        }
    }
    state.trees = trees;
}

/** Random rocks in the play area, away from start, trees, and target row */
function placeRocks() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const rocks = [];
    const minY = getRockAreaMinY(h);
    const maxY = h * 0.86;
    const margin = ROCK_RADIUS + 12;
    const rabbitVariants =
        STRINGS.images && Array.isArray(STRINGS.images.rabbits) ? STRINGS.images.rabbits.length : 1;

    const rockGoal = rockCountForFieldWidth(w);
    const narrow = w < 520;

    for (let i = 0; i < rockGoal; i++) {
        let placed = false;
        for (let tryN = 0; tryN < 40 && !placed; tryN++) {
            let x;
            const sideBias = narrow ? 0.5 : 0.38;
            if (Math.random() < sideBias) {
                const side = Math.random() < 0.5 ? 0 : 1;
                const sideWidth = w * 0.28;
                x = side
                    ? margin + Math.random() * sideWidth
                    : w - margin - Math.random() * sideWidth;
            } else {
                x = margin + Math.random() * (w - margin * 2);
            }
            const y = minY + Math.random() * (maxY - minY);
            const candidate = { x, y, r: ROCK_RADIUS };
            if (dist(candidate, state.rest) < CAR_RADIUS + ROCK_RADIUS + 36) continue;
            if (rocks.some((r) => dist(candidate, r) < ROCK_RADIUS * 2.8)) continue;
            if (state.trees.some((t) => dist(candidate, t) < ROCK_RADIUS + t.r * 0.55)) continue;
            candidate.seed = Math.random() * 1000;
            candidate.variant = Math.floor(Math.random() * Math.max(1, rabbitVariants));
            candidate.rotation = Math.random() * Math.PI * 2;
            candidate.scale = 0.82 + Math.random() * 0.38;
            rocks.push(candidate);
            placed = true;
        }
    }
    state.rocks = rocks;
}

function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Lowest Y (field coords) the car center may use — lets the car reach the word row.
 */
function getCarMinY() {
    if (!fieldEl) return CAR_RADIUS + 6;
    const fieldRect = fieldEl.getBoundingClientRect();
    let targetBottom = CAR_RADIUS + 8;
    if (targetsEl) {
        const tiles = targetsEl.querySelectorAll('.game17-target:not(.game17-target--removed)');
        tiles.forEach((el) => {
            const r = el.getBoundingClientRect();
            targetBottom = Math.max(targetBottom, r.bottom - fieldRect.top);
        });
    }
    // Car center can sit partly inside the word tiles so hits register
    return Math.max(CAR_RADIUS + 4, targetBottom - CAR_RADIUS * 0.55);
}

/** Playable / scenery band starts below the word row */
function getPlayAreaMinY(fieldHeight) {
    return Math.max(fieldHeight * 0.2, getCarMinY() + 12);
}

/** Rocks stay below the word row with a little margin */
function getRockAreaMinY(fieldHeight) {
    return Math.max(fieldHeight * 0.28, getCarMinY() + ROCK_RADIUS + 28);
}

function canvasPointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function onPointerDown(event) {
    if (state.roundComplete || state.crashRecovering || state.celebrating) return;
    requestBackgroundAudioStart();

    const p = canvasPointFromEvent(event);
    state.dragging = true;
    state.returning = false;
    state.steerX = p.x;
    state.steerY = p.y;
    state.pointerId = event.pointerId;
    state.engineIgnited = true;
    canvas.setPointerCapture(event.pointerId);
    // Let “Kör mot” + word finish even if the player starts driving early
}

function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const p = canvasPointFromEvent(event);
    state.steerX = p.x;
    state.steerY = p.y;
}

function onPointerUp(event) {
    if (!state.dragging || (state.pointerId !== null && event.pointerId !== state.pointerId)) return;
    state.dragging = false;
    state.pointerId = null;
    try {
        canvas.releasePointerCapture(event.pointerId);
    } catch (_) {
        // ignore
    }
    state.returning = true;
}

/** Keep the car inside the playable meadow */
function clampCarInField() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const margin = CAR_RADIUS + 4;
    state.car.x = Math.max(margin, Math.min(w - margin, state.car.x));
    state.car.y = Math.max(getCarMinY(), Math.min(h - margin, state.car.y));
}

/** Signed shortest rotation from `from` to `to` (radians) */
function shortestAngleDiff(from, to) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
}

/** Rotate toward a target heading with a max step per frame */
function rotateToward(from, to, maxStep) {
    const d = shortestAngleDiff(from, to);
    if (Math.abs(d) <= maxStep) return to;
    return from + Math.sign(d) * maxStep;
}

/** Smooth but snappy aim (feels like following the cursor) */
function aimToward(current, target, sharpness, dt) {
    const blend = 1 - Math.exp(-sharpness * dt);
    return current + shortestAngleDiff(current, target) * blend;
}

/** Segment vs circle — used so fast moves still hit obstacles */
function segmentIntersectsCircle(x0, y0, x1, y1, cx, cy, radius) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.25) {
        const ddx = x0 - cx;
        const ddy = y0 - cy;
        return ddx * ddx + ddy * ddy < radius * radius;
    }
    let t = ((cx - x0) * dx + (cy - y0) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + t * dx;
    const py = y0 + t * dy;
    const ddx = px - cx;
    const ddy = py - cy;
    return ddx * ddx + ddy * ddy < radius * radius;
}

/** Side-to-side wobble on the tree that was hit */
function triggerTreeWiggle(tree) {
    if (!tree) return;
    tree.wiggle = {
        startTime: performance.now(),
        durationMs: TREE_WIGGLE_MS,
        maxRad: 0.13,
        cycles: 2.8
    };
}

/** Kid-friendly “ouch” on the car (tilt, bounce, little stars) */
function triggerCarCrashFx() {
    state.carCrashFx = {
        startTime: performance.now(),
        durationMs: CAR_CRASH_FX_MS
    };
}

/** Visual-only offsets for drawCar during a crash */
function getCarCrashFx(ts) {
    const fx = state.carCrashFx;
    if (!fx) return null;
    const t = (ts - fx.startTime) / fx.durationMs;
    if (t >= 1) {
        state.carCrashFx = null;
        return null;
    }
    const decay = 1 - t;
    return {
        tilt: Math.sin(t * Math.PI * 2.8) * 0.2 * decay,
        bounceY: Math.sin(t * Math.PI * 2) * 5 * decay,
        squash: 1 - 0.08 * Math.sin(t * Math.PI) * decay,
        flash: t < 0.22 ? (1 - t / 0.22) * 0.4 : 0,
        showStars: t < 0.62,
        starPhase: t
    };
}

/** Small knockback so impacts read as a bump */
function applyCrashKnockback(fromX, fromY, distancePx) {
    const dx = state.car.x - fromX;
    const dy = state.car.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    state.car.x += (dx / len) * distancePx;
    state.car.y += (dy / len) * distancePx;
    state.car.angle += shortestAngleDiff(state.car.angle, Math.atan2(dy, dx)) * 0.12;
    clampCarInField();
}

/**
 * Drive toward the pointer (velocity follows the cursor). Heading matches motion so it feels direct.
 */
function updateCarSteerDrive(dt) {
    const dx = state.steerX - state.car.x;
    const dy = state.steerY - state.car.y;
    const len = Math.hypot(dx, dy);
    if (len < STEER_MIN_DIR) {
        return;
    }
    const nx = dx / len;
    const ny = dy / len;
    const catchUp = 1 - Math.exp(-POINTER_FOLLOW_SHARPNESS * dt);
    let step = len * catchUp;
    step = Math.min(step, POINTER_MAX_SPEED * dt);
    step = Math.min(step, Math.max(0, len - STEER_MIN_DIR * 0.5));
    if (step <= 0.01) {
        return;
    }
    state.car.x += nx * step;
    state.car.y += ny * step;
    state.car.angle = Math.atan2(ny, nx);
    clampCarInField();
}

/**
 * After release: slide straight back to start (no pursuit loops). Angle follows motion.
 */
function updateCarReturnHome(dt) {
    const dx = state.rest.x - state.car.x;
    const dy = state.rest.y - state.car.y;
    const len = Math.hypot(dx, dy);
    if (len < 6) {
        return;
    }
    const homeAngle = Math.atan2(dy, dx);
    const step = Math.min(RETURN_SPEED * dt, len);
    state.car.x += (dx / len) * step;
    state.car.y += (dy / len) * step;
    state.car.angle = aimToward(state.car.angle, homeAngle, RETURN_AIM_SHARPNESS, dt);
    clampCarInField();
}

function loop(ts) {
    const dt = state.lastTs ? Math.min(0.033, (ts - state.lastTs) / 1000) : 0.016;
    state.lastTs = ts;

    const segStartX = state.car.x;
    const segStartY = state.car.y;

    if (!state.crashRecovering && !state.celebrating && !state.roundComplete) {
        if (state.returning) {
            const dx = state.rest.x - state.car.x;
            const dy = state.rest.y - state.car.y;
            const len = Math.hypot(dx, dy);
            if (len < 6) {
                resetCarToRest();
            } else {
                updateCarReturnHome(dt);
                checkCollisions(segStartX, segStartY);
            }
        } else if (state.dragging) {
            updateCarSteerDrive(dt);
            checkCollisions(segStartX, segStartY);
        }
    }

    const vx = (state.car.x - segStartX) / dt;
    const vy = (state.car.y - segStartY) / dt;
    state.speed = Math.sqrt(vx * vx + vy * vy);
    state.prevCar.x = state.car.x;
    state.prevCar.y = state.car.y;

    if (state.dragging || state.returning || state.engineIgnited) {
        updateEngineSound();
    } else {
        stopEngineSound();
    }

    updateRabbitBounces(ts);
    updateTreeWiggles(ts);
    updateConfetti(dt);
    draw(ts);
    requestAnimationFrame(loop);
}

/** Damped sway on trees after a collision */
function updateTreeWiggles(ts) {
    state.trees.forEach((tree) => {
        if (!tree.wiggle) {
            tree.wiggleAngle = 0;
            return;
        }
        const w = tree.wiggle;
        const t = (ts - w.startTime) / w.durationMs;
        if (t >= 1) {
            delete tree.wiggle;
            tree.wiggleAngle = 0;
            return;
        }
        const decay = 1 - t;
        tree.wiggleAngle = Math.sin(t * Math.PI * w.cycles) * w.maxRad * decay;
    });
}

/** Animate rabbits hopping to a new position after the car hits them */
function updateRabbitBounces(ts) {
    state.rocks.forEach((rabbit) => {
        if (!rabbit.bounce) return;
        const b = rabbit.bounce;
        const t = Math.min(1, (ts - b.startTime) / b.durationMs);
        const ease = 1 - Math.pow(1 - t, 2);
        rabbit.x = b.fromX + (b.toX - b.fromX) * ease;
        rabbit.y = b.fromY + (b.toY - b.fromY) * ease - Math.sin(t * Math.PI) * b.hop;
        if (typeof b.fromRotation === 'number' && typeof b.spinRad === 'number') {
            rabbit.rotation = b.fromRotation + b.spinRad * ease;
        }
        if (t >= 1) {
            rabbit.x = b.toX;
            rabbit.y = b.toY;
            if (typeof b.fromRotation === 'number' && typeof b.spinRad === 'number') {
                rabbit.rotation = b.fromRotation + b.spinRad;
            }
            delete rabbit.bounce;
        }
    });
}

/** Pick a new meadow spot for a bounced rabbit */
function findRabbitLandingSpot(rabbit) {
    if (!fieldEl) return { x: rabbit.x, y: rabbit.y };
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const minY = getRockAreaMinY(h);
    const maxY = h * 0.86;
    const margin = ROCK_RADIUS + 12;

    for (let tryN = 0; tryN < 45; tryN++) {
        const x = margin + Math.random() * (w - margin * 2);
        const y = minY + Math.random() * (maxY - minY);
        const candidate = { x, y, r: rabbit.r };
        if (dist(candidate, state.car) < CAR_RADIUS + ROCK_RADIUS + 44) continue;
        if (dist(candidate, state.rest) < CAR_RADIUS + ROCK_RADIUS + 40) continue;
        if (dist(candidate, rabbit) < ROCK_RADIUS * 2.2) continue;
        if (state.trees.some((tree) => dist(candidate, getTreeHitZone(tree)) < ROCK_RADIUS + tree.r * 0.35)) {
            continue;
        }
        if (
            state.rocks.some(
                (other) => other !== rabbit && dist(candidate, other) < ROCK_RADIUS * 2.4
            )
        ) {
            continue;
        }
        return { x, y };
    }

    const nudge = 56 + Math.random() * 40;
    const angle = Math.random() * Math.PI * 2;
    return {
        x: Math.max(margin, Math.min(w - margin, rabbit.x + Math.cos(angle) * nudge)),
        y: Math.max(minY, Math.min(maxY, rabbit.y + Math.sin(angle) * nudge * 0.65))
    };
}

/** Collision circle for a side-view tree (trunk + lower crown) */
function getTreeHitZone(tree) {
    const trunkH = tree.r * (tree.pine ? 1.05 : 0.88);
    return {
        x: tree.x,
        y: tree.y - trunkH * 0.62,
        r: tree.r * 0.52
    };
}

function carHitsCircleAt(carX, carY, circle) {
    const ddx = carX - circle.x;
    const ddy = carY - circle.y;
    const hitR = CAR_RADIUS + circle.r - 4;
    return ddx * ddx + ddy * ddy < hitR * hitR;
}

function carHitsCircle(car, circle) {
    return carHitsCircleAt(car.x, car.y, circle);
}

function checkCollisions(segStartX, segStartY) {
    if (!fieldEl || state.roundComplete || state.crashRecovering || state.celebrating) return;
    const x0 = segStartX ?? state.car.x;
    const y0 = segStartY ?? state.car.y;
    const x1 = state.car.x;
    const y1 = state.car.y;

    for (const tree of state.trees) {
        const zone = getTreeHitZone(tree);
        const hitR = CAR_RADIUS + zone.r - 4;
        const hitNow = carHitsCircleAt(x1, y1, zone);
        const hitSweep = segmentIntersectsCircle(x0, y0, x1, y1, zone.x, zone.y, hitR);
        if (hitNow || hitSweep) {
            applyCrashKnockback(zone.x, zone.y, 14);
            triggerTreeWiggle(tree);
            handleTreeHit();
            return;
        }
    }

    for (const rock of state.rocks) {
        if (rock.bounce) continue;
        const hitR = CAR_RADIUS + rock.r - 4;
        const hitNow = carHitsCircleAt(x1, y1, rock);
        const hitSweep = segmentIntersectsCircle(x0, y0, x1, y1, rock.x, rock.y, hitR);
        if (hitNow || hitSweep) {
            applyCrashKnockback(rock.x, rock.y, 9);
            handleRabbitHit(rock);
            return;
        }
    }

    const fieldRect = fieldEl.getBoundingClientRect();
    for (const entry of state.targetEls) {
        if (!entry.el || entry.el.classList.contains('game17-target--removed')) continue;
        const r = entry.el.getBoundingClientRect();
        const box = {
            left: r.left - fieldRect.left,
            right: r.right - fieldRect.left,
            top: r.top - fieldRect.top,
            bottom: r.bottom - fieldRect.top
        };
        if (circleHitsAabb(state.car.x, state.car.y, CAR_RADIUS, box)) {
            handleWordHit(entry);
            break;
        }
    }
}

function circleHitsAabb(cx, cy, radius, box) {
    const nearestX = Math.max(box.left, Math.min(cx, box.right));
    const nearestY = Math.max(box.top, Math.min(cy, box.bottom));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy <= radius * radius;
}

/** Rabbit scatters to a new spot; car still crashes as usual */
function handleRabbitHit(rabbit) {
    if (state.crashRecovering || state.roundComplete || !rabbit || rabbit.bounce) return;
    const landing = findRabbitLandingSpot(rabbit);
    const spinSign = Math.random() < 0.5 ? -1 : 1;
    rabbit.bounce = {
        fromX: rabbit.x,
        fromY: rabbit.y,
        toX: landing.x,
        toY: landing.y,
        fromRotation: rabbit.rotation || 0,
        spinRad: spinSign * (Math.PI * 0.65 + Math.random() * Math.PI * 0.85),
        startTime: performance.now(),
        durationMs: 520,
        hop: 26 + Math.random() * 18
    };
    state.crashAudioKind = 'rabbit';
    handleTreeHit();
}

function handleTreeHit() {
    if (state.crashRecovering || state.roundComplete) return;
    if (state.crashAudioKind !== 'rabbit') {
        state.crashAudioKind = 'tree';
    }

    const capturedId = state.pointerId;
    state.dragging = false;
    state.returning = false;
    state.pointerId = null;
    state.crashRecovering = true;
    state.speed = 0;
    triggerCarCrashFx();
    stopEngineSound();
    if (canvas && capturedId !== null) {
        try {
            canvas.releasePointerCapture(capturedId);
        } catch (_) {
            // ignore
        }
    }

    finishCrashRecovery().catch(() => {});
}

/** Keep car at the obstacle until crash audio ends, then send it back to start */
async function finishCrashRecovery() {
    try {
        if (state.crashAudioKind === 'rabbit') {
            await playRabbitSqueak();
        } else {
            await playCrashSound();
        }
    } catch (_) {
        // ignore
    }
    state.crashAudioKind = 'tree';
    if (state.roundComplete) {
        state.crashRecovering = false;
        return;
    }
    resetCarToRest();
    state.crashRecovering = false;
    replayPromptAfterFail();
}

/** Randomize trees and rocks for the next word after a correct drive */
function repositionScenery() {
    layoutRestPosition();
    placeScenery();
}

function handleWordHit(entry) {
    if (state.celebrating) return;

    if (entry.word.id === state.targetWord.id) {
        handleCorrectWordHit(entry).catch(() => {
            state.celebrating = false;
        });
        return;
    }

    state.dragging = false;
    state.returning = false;
    stopEngineSound();

    entry.el.classList.add('game17-target--wrong-flash');
    playErrorSound().catch(() => {});
    setTimeout(() => entry.el.classList.remove('game17-target--wrong-flash'), 400);
    resetCarToRest();
    replayPromptAfterFail();
}

/** Pause at the word, play success, then set up the next target (no overlap with Kör mot) */
async function handleCorrectWordHit(entry) {
    state.celebrating = true;
    const capturedPointerId = state.pointerId;
    state.dragging = false;
    state.returning = false;
    state.pointerId = null;
    stopEngineSound();
    stopPromptPlayback();
    if (canvas && capturedPointerId !== null) {
        try {
            canvas.releasePointerCapture(capturedPointerId);
        } catch (_) {
            // ignore
        }
    }

    entry.el.classList.add('game17-target--hit');
    const soundDone = playSuccessSound();
    const wordCenter = fieldPointFromElement(entry.el);
    if (wordCenter) {
        spawnConfetti(wordCenter.x, wordCenter.y);
    }
    spawnConfetti(state.car.x, state.car.y - 8, 22);
    setTimeout(() => entry.el.classList.add('game17-target--removed'), 280);

    try {
        await soundDone;
        await new Promise((resolve) => setTimeout(resolve, 180));
    } catch (_) {
        // ignore
    }

    state.options = state.options.filter((w) => w.id !== entry.word.id);
    state.targetEls = state.targetEls.filter((t) => t !== entry);

    if (state.options.length === 0) {
        state.roundComplete = true;
        state.targetWord = null;
        state.celebrating = false;
        resetCarToRest();
        showCompletionDialog();
        return;
    }

    state.targetWord = state.options[Math.floor(Math.random() * state.options.length)];
    state.celebrating = false;
    afterRoundLayoutReady(() => {
        playSpokenPrompt().catch(() => {});
    });
}

/** Map a DOM element to coordinates inside the play field */
function fieldPointFromElement(el) {
    if (!fieldEl || !el) return null;
    const fieldRect = fieldEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
        x: r.left + r.width / 2 - fieldRect.left,
        y: r.top + r.height / 2 - fieldRect.top
    };
}

/** Burst confetti at a field point (correct word celebration) */
function spawnConfetti(x, y, pieceCount) {
    const count = pieceCount || 46;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 240;
        state.confetti.push({
            x,
            y,
            vx: Math.cos(angle) * speed * 0.75,
            vy: Math.sin(angle) * speed - 90,
            rot: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 14,
            w: 4 + Math.random() * 7,
            h: 3 + Math.random() * 5,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            life: 0,
            maxLife: 0.85 + Math.random() * 0.55
        });
    }
}

function updateConfetti(dt) {
    if (!state.confetti.length) return;
    const gravity = 380;
    state.confetti = state.confetti.filter((piece) => {
        piece.life += dt;
        if (piece.life >= piece.maxLife) {
            return false;
        }
        piece.vy += gravity * dt;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.vx *= 0.985;
        piece.rot += piece.spin * dt;
        return true;
    });
}

function drawConfetti() {
    if (!ctx || !state.confetti.length) return;
    state.confetti.forEach((piece) => {
        const fade = 1 - piece.life / piece.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
    });
}

function replayPromptAfterFail() {
    if (state.roundComplete || !state.targetWord) return;
    setTimeout(() => {
        if (state.roundComplete || !state.targetWord) return;
        playSpokenPrompt().catch(() => {});
    }, 450);
}

function draw(ts) {
    if (!ctx || !fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    const now = typeof ts === 'number' ? ts : performance.now();
    const carCrashFx = getCarCrashFx(now);
    ctx.clearRect(0, 0, w, h);
    drawPlayfieldBackground(w, h);

    const treesBackToFront = state.trees.slice().sort((a, b) => a.y - b.y);
    for (const tree of treesBackToFront) {
        drawTree(tree.x, tree.y, tree.r, tree.seed, tree.hue, tree.pine, tree.wiggleAngle || 0);
    }

    for (const rock of state.rocks) {
        drawRabbit(
            rock.x,
            rock.y,
            rock.r,
            rock.seed || 0,
            rock.variant,
            rock.rotation,
            rock.scale
        );
    }
    drawCar(state.car.x, state.car.y, state.car.angle, carCrashFx);
    drawConfetti();
}

/** True when strings point at a designer field image (not the painted meadow fallback) */
function hasConfiguredFieldBackground() {
    return Boolean(STRINGS.images && STRINGS.images.background);
}

/** Matches .game17-field CSS so gaps never flash a different “old” meadow */
function drawFieldCssFallbackFill(w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ecfdf5');
    g.addColorStop(0.28, '#86efac');
    g.addColorStop(0.62, '#22c55e');
    g.addColorStop(1, '#14532d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}

/** One stable background path per frame (avoids empty canvas + meadow ↔ webp flashes) */
function drawPlayfieldBackground(w, h) {
    const img = sprites.background;
    const useImage = img && (sprites.backgroundReady || fieldBackgroundReady);
    if (useImage) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (iw && ih) {
            drawFieldBackgroundImage(w, h);
            return;
        }
    }
    if (hasConfiguredFieldBackground()) {
        drawFieldCssFallbackFill(w, h);
        return;
    }
    if (!fieldBackgroundReady) {
        drawMeadow(w, h);
        return;
    }
    drawFieldCssFallbackFill(w, h);
}

/** Scale background image to cover the field (hides uneven PNG edges slightly) */
function drawFieldBackgroundImage(w, h) {
    const img = sprites.background;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) {
        drawFieldCssFallbackFill(w, h);
        return;
    }

    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (w - dw) * 0.5;
    const dy = (h - dh) * 0.5;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);

    // Light grade so UI greens match; keeps designer texture visible
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(236, 253, 245, 0.06)');
    wash.addColorStop(0.5, 'rgba(34, 197, 94, 0.03)');
    wash.addColorStop(1, 'rgba(20, 83, 45, 0.1)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.52, w * 0.2, w * 0.5, h * 0.5, w * 0.95);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(15, 46, 28, 0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
}

/** Stable 0..1 hash for meadow decoration (no per-frame Math.random) */
function meadowHash(i, j) {
    const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

/** Open meadow (canvas when no custom background.webp) */
function drawMeadow(w, h) {
    const horizon = h * 0.22;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon * 1.6);
    sky.addColorStop(0, '#ecfdf5');
    sky.addColorStop(0.45, '#a7f3d0');
    sky.addColorStop(1, 'rgba(167, 243, 208, 0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const base = ctx.createLinearGradient(0, horizon * 0.4, 0, h);
    base.addColorStop(0, '#4ade80');
    base.addColorStop(0.35, '#2dd4bf');
    base.addColorStop(0.55, '#22c55e');
    base.addColorStop(1, '#14532d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    drawMeadowHills(w, h, horizon);
    drawDistantForestStrip(w, h, horizon);

    for (let i = 0; i < 8; i++) {
        const px = w * (0.12 + meadowHash(i, 1) * 0.76);
        const py = h * (0.32 + meadowHash(i, 2) * 0.55);
        const rad = w * (0.12 + meadowHash(i, 3) * 0.14);
        const grd = ctx.createRadialGradient(px, py, 0, px, py, rad);
        grd.addColorStop(0, 'rgba(187, 247, 208, 0.45)');
        grd.addColorStop(0.55, 'rgba(74, 222, 128, 0.12)');
        grd.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
    }

    drawMeadowGrassTexture(w, h);
    drawMeadowFlowers(w, h);

    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.2, w * 0.5, h * 0.5, w * 0.85);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(15, 46, 28, 0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
}

/** Soft hills behind the play field */
function drawMeadowHills(w, h, horizon) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    const hills = [
        { cx: w * 0.2, cy: horizon * 1.1, rx: w * 0.55, ry: h * 0.12, color: '#15803d' },
        { cx: w * 0.72, cy: horizon * 1.05, rx: w * 0.48, ry: h * 0.1, color: '#166534' },
        { cx: w * 0.5, cy: horizon * 1.2, rx: w * 0.7, ry: h * 0.14, color: '#14532d' }
    ];
    hills.forEach((hill) => {
        ctx.fillStyle = hill.color;
        ctx.beginPath();
        ctx.ellipse(hill.cx, hill.cy, hill.rx, hill.ry, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

/** Tiny distant trees along the horizon (decoration only) */
function drawDistantForestStrip(w, h, horizon) {
    const count = Math.max(12, Math.floor(w / 42));
    const baseY = horizon * 1.02;
    for (let i = 0; i < count; i++) {
        const t = i / count;
        const x = t * w + meadowHash(i, 9) * (w / count) * 0.6;
        const scale = 0.55 + meadowHash(i, 10) * 0.55;
        const pine = meadowHash(i, 11) > 0.4;
        const r = (10 + meadowHash(i, 12) * 8) * scale;
        ctx.save();
        ctx.globalAlpha = 0.35 + meadowHash(i, 13) * 0.2;
        drawTreeSilhouette(x, baseY + meadowHash(i, 14) * 6, r, pine);
        ctx.restore();
    }
}

/** Flat colors for far-away trees in the meadow backdrop */
function drawTreeSilhouette(x, groundY, r, pine) {
    const trunkH = r * (pine ? 1.1 : 0.85);
    const trunkW = r * 0.22;
    const trunkTop = groundY - trunkH;
    ctx.fillStyle = '#3f2d20';
    roundRect(ctx, x - trunkW * 0.5, trunkTop, trunkW, trunkH, 2);
    ctx.fill();
    ctx.fillStyle = '#0f3d22';
    if (pine) {
        for (let layer = 0; layer < 3; layer++) {
            const ly = trunkTop - r * (0.2 + layer * 0.35);
            const half = r * (0.75 - layer * 0.15);
            ctx.beginPath();
            ctx.moveTo(x, ly - r * 0.35);
            ctx.lineTo(x + half, ly + r * 0.15);
            ctx.lineTo(x - half, ly + r * 0.15);
            ctx.closePath();
            ctx.fill();
        }
    } else {
        ctx.beginPath();
        ctx.arc(x, trunkTop - r * 0.45, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - r * 0.2, trunkTop - r * 0.35, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** Short grass strokes for texture */
function drawMeadowGrassTexture(w, h) {
    const step = Math.max(7, Math.floor(w / 90));
    const startY = h * 0.18;
    ctx.lineCap = 'round';
    for (let gy = Math.floor(startY / step); gy * step < h; gy++) {
        for (let gx = 0; gx * step < w; gx++) {
            const h1 = meadowHash(gx, gy);
            const h2 = meadowHash(gx + 50, gy + 17);
            if (h1 < 0.42) continue;
            const px = gx * step + h2 * step * 0.8;
            const py = gy * step + h1 * step * 0.5;
            const len = 3 + h2 * 5;
            const angle = -Math.PI / 2 + (h1 - 0.5) * 0.9;
            ctx.strokeStyle = `rgba(${h2 > 0.5 ? '21, 128, 61' : '34, 197, 94'}, ${0.07 + h1 * 0.08})`;
            ctx.lineWidth = 1 + (h2 > 0.7 ? 0.5 : 0);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
            ctx.stroke();
        }
    }
}

/** Small meadow flowers (decoration only) */
function drawMeadowFlowers(w, h) {
    const count = Math.floor((w * h) / 22000);
    for (let i = 0; i < count; i++) {
        const px = meadowHash(i, 20) * w;
        const py = h * (0.28 + meadowHash(i, 21) * 0.68);
        if (meadowHash(i, 22) < 0.55) continue;
        const petal = 2.2 + meadowHash(i, 23) * 2;
        const hue = meadowHash(i, 24);
        const color = hue < 0.33 ? '#fde047' : hue < 0.66 ? '#f9a8d4' : '#ffffff';
        ctx.fillStyle = color;
        for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(px + Math.cos(a) * petal, py + Math.sin(a) * petal, petal * 0.55, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath();
        ctx.arc(px, py, petal * 0.45, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Side-view cartoon tree (trunk + crown). (x, y) is the ground at the trunk base.
 * Matches a top-down car: you look at the tree from the side while driving on the grass.
 */
function drawTree(x, y, r, seed, hue, pine, wiggleRad) {
    ctx.save();
    if (wiggleRad) {
        ctx.translate(x, y);
        ctx.rotate(wiggleRad);
        ctx.translate(-x, -y);
    }

    ctx.save();
    ctx.translate(x, y + 3);
    ctx.scale(1, 0.38);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.17)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.5, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const g = hue || 0;
    const dark = g < 0.33 ? '#14532d' : g < 0.66 ? '#166534' : '#15803d';
    const mid = g < 0.33 ? '#16a34a' : g < 0.66 ? '#22c55e' : '#4ade80';
    const light = g < 0.5 ? '#86efac' : '#bbf7d0';
    const trunkW = r * 0.34;
    const trunkH = r * (pine ? 1.05 : 0.88);
    const trunkTop = y - trunkH;
    const lean = Math.sin(seed * 0.9) * r * 0.06;

    ctx.fillStyle = '#4a3728';
    roundRect(ctx, x - trunkW * 0.5 + lean * 0.3, trunkTop, trunkW, trunkH, trunkW * 0.18);
    ctx.fill();
    ctx.fillStyle = '#6b4f3a';
    roundRect(ctx, x - trunkW * 0.22 + lean * 0.3, trunkTop + trunkH * 0.15, trunkW * 0.28, trunkH * 0.7, 2);
    ctx.fill();

    if (pine) {
        drawPineCrown(x + lean, trunkTop, r, dark, mid, light, seed);
    } else {
        drawRoundCrown(x + lean, trunkTop, r, dark, mid, light, seed);
    }

    ctx.restore();
}

/** Stacked side-view pine layers */
function drawPineCrown(cx, trunkTop, r, dark, mid, light, seed) {
    const layers = 4;
    for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1);
        const layerY = trunkTop - r * (0.35 + t * 1.05);
        const halfW = r * (0.95 - t * 0.22) + Math.sin(seed + i) * r * 0.04;
        const grd = ctx.createLinearGradient(cx - halfW, layerY, cx + halfW, layerY);
        grd.addColorStop(0, dark);
        grd.addColorStop(0.45, mid);
        grd.addColorStop(1, dark);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(cx, layerY - r * (0.42 - t * 0.08));
        ctx.lineTo(cx + halfW, layerY + r * 0.2);
        ctx.lineTo(cx - halfW, layerY + r * 0.2);
        ctx.closePath();
        ctx.fill();
        if (i === 0) {
            ctx.fillStyle = light;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(cx - halfW * 0.15, layerY - r * 0.15);
            ctx.lineTo(cx + halfW * 0.2, layerY + r * 0.05);
            ctx.lineTo(cx - halfW * 0.5, layerY + r * 0.08);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
}

/** Rounded deciduous crown (side profile) */
function drawRoundCrown(cx, trunkTop, r, dark, mid, light, seed) {
    const blobs = [
        { dx: -r * 0.12, dy: -r * 0.55, rad: r * 0.62 },
        { dx: r * 0.18, dy: -r * 0.48, rad: r * 0.55 },
        { dx: 0, dy: -r * 0.95, rad: r * 0.68 },
        { dx: -r * 0.28, dy: -r * 0.35, rad: r * 0.48 }
    ];
    blobs.forEach((b, i) => {
        const px = cx + b.dx + Math.sin(seed + i) * r * 0.03;
        const py = trunkTop + b.dy;
        const grd = ctx.createRadialGradient(px - b.rad * 0.25, py - b.rad * 0.3, 1, px, py, b.rad);
        grd.addColorStop(0, light);
        grd.addColorStop(0.5, mid);
        grd.addColorStop(1, dark);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(px, py, b.rad, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.ellipse(
        cx - r * 0.22,
        trunkTop - r * 0.72,
        r * 0.2,
        r * 0.14,
        -0.35,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

/** Small top-down rabbit hazard (optional sprite from assets) */
function drawRabbit(x, y, r, seed, variant, rotation, scale) {
    const rabbitImg =
        sprites.rabbitsReady && sprites.rabbits.length
            ? sprites.rabbits[variant % sprites.rabbits.length] || sprites.rabbits.find(Boolean)
            : null;

    const s = scale || 1;
    const size = r * 2.9 * s;

    ctx.save();
    ctx.translate(x, y + 4);
    ctx.scale(1, 0.42);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.38, size * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (rabbitImg) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation || 0);
        ctx.drawImage(rabbitImg, -size / 2, -size / 2, size, size);
        ctx.restore();
        return;
    }

    const brown = (variant || 0) % 2 === 1;
    const fur = brown ? '#a8a29e' : '#e7e5e4';
    const furDark = brown ? '#78716c' : '#d6d3d1';
    const angle = rotation || Math.sin(seed) * 0.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = furDark;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.08, r * 1.05 * s, r * 0.82 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95 * s, r * 0.72 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(r * 0.35 * s, -r * 0.15 * s, r * 0.42 * s, 0, Math.PI * 2);
    ctx.fill();

    const earLen = r * 0.95 * s;
    const earW = r * 0.28 * s;
    [-1, 1].forEach((side) => {
        ctx.save();
        ctx.translate(r * 0.32 * s * side, -r * 0.35 * s);
        ctx.rotate(side * 0.22);
        ctx.fillStyle = fur;
        ctx.beginPath();
        ctx.ellipse(0, -earLen * 0.45, earW, earLen * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath();
        ctx.ellipse(0, -earLen * 0.45, earW * 0.45, earLen * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(r * 0.48 * s, -r * 0.22 * s, r * 0.07 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fafaf9';
    ctx.beginPath();
    ctx.arc(-r * 0.55 * s, r * 0.05 * s, r * 0.16 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawCarWheel(wx, wy) {
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(wx, wy, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#737373';
    ctx.beginPath();
    ctx.arc(wx, wy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a3a3a3';
    ctx.beginPath();
    ctx.arc(wx, wy, 1.8, 0, Math.PI * 2);
    ctx.fill();
}

/** Four-point star for crash “bonk” feedback */
function drawBumpStar(cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? size : size * 0.42;
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawCarCrashStars(phase) {
    const spin = phase * Math.PI * 2;
    const spots = [
        { ang: -0.6, dist: 22 },
        { ang: 0.55, dist: 26 },
        { ang: 2.4, dist: 20 }
    ];
    spots.forEach((spot, i) => {
        const a = spot.ang + spin * (i % 2 === 0 ? 1 : -1);
        drawBumpStar(Math.cos(a) * spot.dist, -34 + Math.sin(a) * spot.dist * 0.35, 4.5 + i * 0.6);
    });
}

function drawCar(x, y, angle, crashFx) {
    const bounceY = crashFx ? crashFx.bounceY : 0;
    ctx.save();
    ctx.translate(x, y + 7 - bounceY * 0.35);
    ctx.scale(1, 0.42);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y - bounceY);
    ctx.rotate(angle + Math.PI / 2);
    if (crashFx) {
        ctx.rotate(crashFx.tilt);
        ctx.scale(1, crashFx.squash);
    }

    if (sprites.carReady && sprites.car) {
        const size = CAR_RADIUS * 2.7;
        ctx.drawImage(sprites.car, -size / 2, -size / 2, size, size);
        if (crashFx && crashFx.flash > 0) {
            ctx.fillStyle = `rgba(248, 113, 113, ${crashFx.flash})`;
            ctx.fillRect(-size / 2, -size / 2, size, size);
        }
        if (crashFx && crashFx.showStars) {
            drawCarCrashStars(crashFx.starPhase);
        }
        ctx.restore();
        return;
    }

    drawCarWheel(-17, -20);
    drawCarWheel(17, -20);
    drawCarWheel(-17, 18);
    drawCarWheel(17, 18);

    const bodyGrd = ctx.createLinearGradient(-22, 0, 22, 0);
    bodyGrd.addColorStop(0, '#fb923c');
    bodyGrd.addColorStop(0.45, '#fdba74');
    bodyGrd.addColorStop(1, '#ea580c');
    ctx.fillStyle = bodyGrd;
    roundRect(ctx, -21, -28, 42, 54, 11);
    ctx.fill();
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    roundRect(ctx, -16, -22, 14, 20, 4);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    roundRect(ctx, -15, -21, 30, 17, 5);
    ctx.fill();
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, -13, -19, 12, 12, 3);
    ctx.fill();

    ctx.fillStyle = '#0ea5e9';
    roundRect(ctx, -15, 6, 30, 15, 4);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(-13, -27, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(13, -27, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    roundRect(ctx, -4, 24, 8, 4, 2);
    ctx.fill();

    if (crashFx && crashFx.flash > 0) {
        ctx.fillStyle = `rgba(248, 113, 113, ${crashFx.flash})`;
        roundRect(ctx, -21, -28, 42, 54, 11);
        ctx.fill();
    }
    if (crashFx && crashFx.showStars) {
        drawCarCrashStars(crashFx.starPhase);
    }

    ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
}

async function handleListenClick() {
    if (state.roundComplete) return;
    requestBackgroundAudioStart();
    try {
        await playSpokenPrompt();
    } catch (error) {
        console.warn('Could not replay prompt:', error);
    }
}

async function playSpokenPrompt() {
    if (!state.targetWord) return;
    if (state.promptPlaying) return;
    state.promptPlaying = true;
    if (listenButton) {
        listenButton.disabled = true;
        listenButton.classList.add('game17-listen--playing');
    }

    try {
        await ensureAudioContext();
        if (!audioContext || audioContext.state !== 'running') {
            state.promptNeedsRetry = true;
            return;
        }
        state.promptNeedsRetry = false;
        const promptPath = resolveGame17Asset(STRINGS.promptSound || 'sounds/KorMot.mp3');
        const playedFile = await playBufferUrlIfExists(promptPath);
        if (!playedFile) {
            await speakPromptPhrase(STRINGS.promptSpeech || 'Kör mot');
        }
        if (state.roundComplete || !state.targetWord) return;
        const wordPath = resolveWordSound(state.targetWord.sound);
        await playBufferUrl(wordPath);
    } finally {
        state.promptPlaying = false;
        if (listenButton) {
            listenButton.disabled = false;
            listenButton.classList.remove('game17-listen--playing');
        }
    }
}

/** Browser speech when KorMot.mp3 is missing on the assets host */
function speakPromptPhrase(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            resolve();
            return;
        }
        try {
            window.speechSynthesis.cancel();
        } catch (_) {
            // ignore
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'sv-SE';
        utterance.rate = 0.95;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
    });
}

async function playBufferUrlIfExists(url) {
    const buffer = await loadAudioBuffer(url, true);
    if (!buffer) return false;
    await playDecodedBuffer(buffer);
    return true;
}

async function playBufferUrl(url) {
    const buffer = await loadAudioBuffer(url, false);
    if (!buffer) return;
    await playDecodedBuffer(buffer);
}

function playDecodedBuffer(buffer) {
    return new Promise((resolve) => {
        stopPromptPlayback();
        if (!audioContext) {
            resolve();
            return;
        }
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        gain.gain.setValueAtTime(Math.min(1, volume * 1.35), audioContext.currentTime);
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
        const resolve = promptPlaybackResolve;
        promptPlaybackResolve = null;
        resolve();
    }
    if (window.speechSynthesis) {
        try {
            window.speechSynthesis.cancel();
        } catch (_) {
            // ignore
        }
    }
}

async function loadAudioBuffer(url, quietMissing) {
    if (!url) return null;
    if (audioBufferCache.has(url)) return audioBufferCache.get(url);
    await ensureAudioContext();
    if (!audioContext) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (!quietMissing) console.warn('Audio missing:', url);
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferCache.set(url, buffer);
        return buffer;
    } catch (error) {
        if (!quietMissing) console.warn('Could not load audio:', url, error);
        return null;
    }
}

/** Preload optional engine loop MP3 */
function preloadEngineSample() {
    const path = STRINGS.engineSound;
    if (!path || engineSampleReady || engineSampleFailed) return;
    loadAudioBuffer(resolveGame17Asset(path), true).then((buffer) => {
        if (buffer) {
            engineSampleBuffer = buffer;
            engineSampleReady = true;
        } else {
            engineSampleFailed = true;
        }
    });
}

/** Preload success sting so it can start in sync with confetti */
function preloadSuccessSample() {
    const path = STRINGS.successSound;
    if (!path || successSampleReady) return;
    loadAudioBuffer(resolveGame17Asset(path), true).then((buffer) => {
        if (buffer) {
            successSampleBuffer = buffer;
            successSampleReady = true;
        }
    });
}

/** Preload oups sting for wrong-word hits */
function preloadOupsSample() {
    const path = STRINGS.oupsSound;
    if (!path || oupsSampleReady) return;
    loadAudioBuffer(resolveGame17Asset(path), true).then((buffer) => {
        if (buffer) {
            oupsSampleBuffer = buffer;
            oupsSampleReady = true;
        }
    });
}

/** 0..1 from car speed (px/s) for engine pitch / playback rate */
function engineDriveT(speed) {
    const maxRef = RETURN_SPEED * 0.92;
    return Math.max(0, Math.min(1, (speed - ENGINE_MIN_SPEED) / (maxRef - ENGINE_MIN_SPEED)));
}

function enginePitchFromSpeed(speed) {
    const t = engineDriveT(speed);
    return 90 + t * 220;
}

/** MP3 loop speed: idle crawl → fast return */
function enginePlaybackRateFromSpeed(speed) {
    const t = engineDriveT(speed);
    return 0.62 + t * 0.95;
}

function engineVolumeFromSpeed(speed) {
    const master = window.TiddeliGamesVolume?.get() ?? 0.35;
    const t = engineDriveT(speed);
    return master * (0.08 + t * 0.22);
}

/** Quiet idle after the engine has been started once */
function engineIdleVolume() {
    const master = window.TiddeliGamesVolume?.get() ?? 0.35;
    return master * 0.14;
}

function startEngineSampleLoop() {
    if (!audioContext || !engineSampleBuffer || engineSampleSource) return;
    const source = audioContext.createBufferSource();
    source.buffer = engineSampleBuffer;
    source.loop = true;
    const gain = audioContext.createGain();
    gain.gain.value = 0.0001;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start(0);
    engineSampleSource = source;
    engineSampleGain = gain;
}

function stopEngineSynth() {
    const a = engineOscA;
    const b = engineOscB;
    const g = engineGain;
    engineOscA = null;
    engineOscB = null;
    engineGain = null;
    if (!audioContext) return;
    try {
        if (g) {
            g.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.06);
        }
        if (a) a.stop(audioContext.currentTime + 0.08);
        if (b) b.stop(audioContext.currentTime + 0.08);
    } catch (_) {
        // ignore
    }
}

function stopEngineSample() {
    const source = engineSampleSource;
    const gain = engineSampleGain;
    engineSampleSource = null;
    engineSampleGain = null;
    if (!audioContext) return;
    try {
        if (gain) {
            gain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.05);
        }
        if (source) {
            source.stop(audioContext.currentTime + 0.06);
        }
    } catch (_) {
        // ignore
    }
}

async function updateEngineSound() {
    if (state.crashRecovering || state.roundComplete) {
        stopEngineSound();
        return;
    }

    if (state.speed >= ENGINE_MIN_SPEED) {
        state.engineIgnited = true;
    }

    if (!state.engineIgnited) {
        stopEngineSound();
        return;
    }

    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;

    const now = audioContext.currentTime;
    const vol =
        state.speed < ENGINE_MIN_SPEED
            ? engineIdleVolume()
            : engineVolumeFromSpeed(state.speed);

    if (engineSampleReady && engineSampleBuffer) {
        stopEngineSynth();
        if (!engineSampleSource) {
            startEngineSampleLoop();
        }
        if (engineSampleSource && engineSampleGain) {
            const rate =
                STRINGS.fixedEnginePlayback === true
                    ? 1
                    : enginePlaybackRateFromSpeed(state.speed);
            engineSampleSource.playbackRate.setTargetAtTime(rate, now, 0.06);
            engineSampleGain.gain.setTargetAtTime(Math.max(0.0001, vol), now, 0.05);
        }
        return;
    }

    stopEngineSample();
    if (!engineOscA) {
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        gain.connect(audioContext.destination);
        engineGain = gain;
        const oscA = audioContext.createOscillator();
        const oscB = audioContext.createOscillator();
        oscA.type = 'sawtooth';
        oscB.type = 'sine';
        oscA.connect(gain);
        const mix = audioContext.createGain();
        mix.gain.value = 0.25;
        oscB.connect(mix);
        mix.connect(gain);
        oscA.start();
        oscB.start();
        engineOscA = oscA;
        engineOscB = oscB;
    }

    const pitch = enginePitchFromSpeed(state.speed);
    engineOscA.frequency.setTargetAtTime(pitch, now, 0.04);
    engineOscB.frequency.setTargetAtTime(pitch * 0.5, now, 0.04);
    engineGain.gain.setTargetAtTime(Math.max(0.0001, vol), now, 0.05);
}

function stopEngineSound() {
    stopEngineSynth();
    stopEngineSample();
}

/** One-shot SFX (does not use the spoken-prompt audio channel) */
function playEffectBuffer(buffer, volumeScale) {
    return new Promise((resolve) => {
        if (!audioContext || !buffer) {
            resolve();
            return;
        }
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const master = window.TiddeliGamesVolume?.get() ?? 0.35;
        gain.gain.setValueAtTime(master * (volumeScale || 1), audioContext.currentTime);
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

/** Crash into a tree */
async function playCrashSound() {
    await ensureAudioContext();
    if (!audioContext) return;
    stopEngineSound();
    const path = STRINGS.crashSound || 'sounds/crash.mp3';
    const buffer = await loadAudioBuffer(resolveGame17Asset(path), true);
    if (buffer) {
        await playEffectBuffer(buffer, 0.5);
        return;
    }
    await playFailSound();
}

/** Short squeak when the car hits a rabbit */
async function playRabbitSqueak() {
    await ensureAudioContext();
    if (!audioContext) return;
    stopEngineSound();
    const path = STRINGS.squeakSound || 'sounds/squeak.mp3';
    const buffer = await loadAudioBuffer(resolveGame17Asset(path), true);
    if (buffer) {
        await playEffectBuffer(buffer, 0.72);
        return;
    }
    await playFailSound();
}

async function playFailSound() {
    await ensureAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const vol = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.2;
    const beepDuration = 0.16;
    const beepGap = 0.12;
    await new Promise((resolve) => {
        let resolved = false;
        const done = () => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        };
        [220, 196, 165].forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * beepGap);
            gain.gain.linearRampToValueAtTime(vol, now + i * beepGap + 0.02);
            gain.gain.linearRampToValueAtTime(0, now + i * beepGap + beepDuration);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start(now + i * beepGap);
            osc.stop(now + i * beepGap + beepDuration + 0.02);
        });
        const totalMs = (2 * beepGap + beepDuration + 0.05) * 1000;
        setTimeout(done, totalMs);
    });
}

async function playErrorSound() {
    await ensureAudioContext();
    if (!audioContext) return;
    let buffer = oupsSampleReady ? oupsSampleBuffer : null;
    if (!buffer) {
        const path = STRINGS.oupsSound || 'sounds/oups.mp3';
        buffer = await loadAudioBuffer(resolveGame17Asset(path), true);
        if (buffer) {
            oupsSampleBuffer = buffer;
            oupsSampleReady = true;
        }
    }
    if (buffer) {
        await playEffectBuffer(buffer, 0.62);
        return;
    }
    await playFailSound();
}

async function playSuccessSound() {
    await ensureAudioContext();
    if (!audioContext) return;
    let buffer = successSampleReady ? successSampleBuffer : null;
    if (!buffer) {
        const path = STRINGS.successSound || 'sounds/success.mp3';
        buffer = await loadAudioBuffer(resolveGame17Asset(path), true);
        if (buffer) {
            successSampleBuffer = buffer;
            successSampleReady = true;
        }
    }
    if (buffer) {
        await playEffectBuffer(buffer, 0.58);
        return;
    }
    const now = audioContext.currentTime;
    const vol = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.22;
    [523, 659, 784].forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(vol, now + i * 0.1 + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.2);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.22);
    });
}

function shuffleArray(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
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

function handleDialogBackClick() {
    window.location.href = '../../index.html';
}

function handleContinueClick() {
    hideCompletionDialog();
    requestBackgroundAudioStart();
    startNewRound();
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
    const buffer = await loadAudioBuffer(resolveGame17Asset(track), true);
    if (!buffer) return;
    backgroundBuffer = buffer;
    backgroundSource = audioContext.createBufferSource();
    backgroundSource.buffer = backgroundBuffer;
    backgroundSource.loop = true;
    backgroundGain = audioContext.createGain();
    const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
    backgroundGain.gain.setValueAtTime(volume * 0.32, audioContext.currentTime);
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
    if (
        state.promptNeedsRetry &&
        !state.roundComplete &&
        state.targetWord &&
        !state.promptPlaying
    ) {
        playSpokenPrompt().catch(() => {});
    }
}

function handleVolumeChange(event) {
    if (!audioContext || audioContext.state !== 'running') return;
    const newVolume =
        event.detail && typeof event.detail.volume === 'number'
            ? event.detail.volume
            : window.TiddeliGamesVolume?.get() ?? 0.35;
    if (backgroundGain) {
        backgroundGain.gain.setValueAtTime(newVolume * 0.32, audioContext.currentTime);
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        stopPromptPlayback();
        stopEngineSound();
        if (audioContext && audioContext.state === 'running') {
            audioContext.suspend().catch(() => {});
        }
    } else if (audioContext && state.audioStarted) {
        audioContext.resume().catch(() => {});
    }
}
