// Träffa ordet (Game 16) – rubber-band slingshot with gravity at word targets
'use strict';

const STRINGS = window.GAME16_STRINGS || {};
const ASSETS = window.TiddeliAssets;
const WORDS = Array.isArray(STRINGS.words) ? STRINGS.words.slice() : [];
const NUM_TARGETS = 4;

/** Gravity in canvas pixels / s² (readable arcs on phones) */
const GRAVITY = 780;
/** Max pull distance from rest position (px) */
const MAX_PULL = 220;
/** Projectile radius in CSS pixels */
const BALL_RADIUS = 16;
/** Minimum pull that counts as a shot (px) */
const MIN_PULL = 18;
/** Energy kept when bouncing off left/right walls (0–1) */
const WALL_BOUNCE = 0.72;
/** How long the rubber keeps accelerating the ball after release (seconds) */
const SLING_BOOST_TIME = 0.16;
/** Fraction of target speed applied at the instant of release (rest comes from boost) */
const SLING_RELEASE_SPEED_FRAC = 0.55;

function resolveGame16Asset(path) {
    if (!path) return '';
    if (ASSETS && typeof ASSETS.resolveGameAsset === 'function') {
        return ASSETS.resolveGameAsset('game16', path);
    }
    return path;
}

/** Word audio lives with game 14 so we do not duplicate files */
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
const audioBufferCache = new Map();
let promptSource = null;
let promptPlaybackResolve = null;
let activeUtterance = null;
let rafId = 0;
/** Rising “ouiii” whistle while the ball is in flight */
let flightOscA = null;
let flightOscB = null;
let flightGain = null;
/** Tension tone while the rubber band is being stretched */
let stretchOsc = null;
let stretchFilter = null;
let stretchGain = null;

const state = {
    targetWord: null,
    options: [],
    targetEls: [], // { word, el }
    audioStarted: false,
    audioStarting: false,
    promptPlaying: false,
    // True only when autoplay was blocked — first gesture should retry once
    promptNeedsRetry: false,
    roundComplete: false,
    canShoot: false,
    // Slingshot geometry (canvas CSS pixels)
    anchorL: { x: 0, y: 0 },
    anchorR: { x: 0, y: 0 },
    rest: { x: 0, y: 0 },
    ball: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        flying: false,
        // While true, rubber still pulls the ball (accelerates after release)
        boosting: false,
        boostAx: 0,
        boostAy: 0,
        boostLeft: 0
    },
    dragging: false,
    pointerId: null,
    lastTs: 0
};

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachEventListeners();
    resizeCanvas();
    startNewRound();
    requestBackgroundAudioStart();
    loop(performance.now());
});

/**
 * Caches DOM nodes and sets a unique game-16 background image.
 */
function cacheDomElements() {
    titleEl = document.getElementById('game16-title');
    instructionsEl = document.getElementById('instructions-text');
    fieldEl = document.getElementById('game16-field');
    targetsEl = document.getElementById('targets');
    canvas = document.getElementById('sling-canvas');
    listenButton = document.getElementById('listen-button');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
    dialogBackButton = document.getElementById('dialog-back-button');

    if (canvas) ctx = canvas.getContext('2d');

    if (fieldEl) {
        const bgUrl = resolveGame16Asset('images/background.webp');
        fieldEl.style.backgroundImage =
            `linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.12)), url('${bgUrl}')`;
        if (STRINGS.aria && STRINGS.aria.field) {
            fieldEl.setAttribute('aria-label', STRINGS.aria.field);
        }
    }
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
}

function attachEventListeners() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('volumechange', handleVolumeChange);
    window.addEventListener('resize', () => {
        resizeCanvas();
        layoutSling();
        if (!state.ball.flying && !state.dragging) resetBallToRest();
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

/**
 * Fits canvas to the field size (device pixels for sharp drawing).
 */
function resizeCanvas() {
    if (!canvas || !fieldEl) return;
    const rect = fieldEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}

/**
 * Places slingshot anchors near the bottom of the field.
 * On tall screens, sit a bit higher so the climb to the words is shorter.
 */
function layoutSling() {
    if (!fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    // Cap how far below the targets the band sits (helps tall viewports)
    const targetBottom = getTargetRowBottomY();
    const bandY = Math.min(h * 0.8, Math.max(h * 0.62, targetBottom + h * 0.28));
    state.anchorL = { x: w * 0.22, y: bandY };
    state.anchorR = { x: w * 0.78, y: bandY };
    state.rest = { x: w * 0.5, y: bandY + 8 };
}

/**
 * Bottom edge of the word row in field coordinates (fallback if not laid out yet).
 */
function getTargetRowBottomY() {
    if (!targetsEl || !fieldEl || !targetsEl.getBoundingClientRect) {
        return fieldEl ? fieldEl.clientHeight * 0.18 : 120;
    }
    const fieldRect = fieldEl.getBoundingClientRect();
    const r = targetsEl.getBoundingClientRect();
    if (r.height < 1) return fieldEl.clientHeight * 0.18;
    return r.bottom - fieldRect.top;
}

/**
 * Vertical center of the word row in field coordinates.
 */
function getTargetRowCenterY() {
    if (!targetsEl || !fieldEl) return 120;
    const fieldRect = fieldEl.getBoundingClientRect();
    const r = targetsEl.getBoundingClientRect();
    if (r.height < 1) return fieldEl.clientHeight * 0.15;
    return (r.top + r.bottom) / 2 - fieldRect.top;
}

function resetBallToRest() {
    state.ball.x = state.rest.x;
    state.ball.y = state.rest.y;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.flying = false;
    state.ball.boosting = false;
    state.ball.boostAx = 0;
    state.ball.boostAy = 0;
    state.ball.boostLeft = 0;
    // Ready to pull again as soon as the ball is back (prompt may still be playing)
    if (!state.roundComplete) {
        state.canShoot = true;
    }
    stopFlightWhoosh();
    stopStretchSound();
}

/**
 * Starts a round: four words at the top, shoot until all are hit.
 */
function startNewRound() {
    hideCompletionDialog();
    stopPromptPlayback();
    state.roundComplete = false;
    state.promptPlaying = false;
    state.promptNeedsRetry = false;
    // Pull is allowed while the spoken prompt still plays
    state.canShoot = true;
    state.dragging = false;
    state.targetEls = [];

    if (WORDS.length < NUM_TARGETS) {
        console.error('Not enough words configured for game16');
        return;
    }

    const shuffled = shuffleArray(WORDS);
    state.options = shuffleArray(shuffled.slice(0, NUM_TARGETS));
    state.targetWord = state.options[Math.floor(Math.random() * state.options.length)];

    if (targetsEl) {
        targetsEl.innerHTML = '';
        state.options.forEach((word) => {
            const el = document.createElement('div');
            el.className = 'game16-target';
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

    // Layout sling after targets exist so tall-screen distance uses real word positions
    requestAnimationFrame(() => {
        layoutSling();
        resetBallToRest();
    });

    playSpokenPrompt().catch((error) => {
        console.warn('Could not auto-play spoken prompt:', error);
        state.canShoot = true;
    });
}

function canvasPointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function onPointerDown(event) {
    if (state.roundComplete || !state.canShoot || state.ball.flying) return;
    requestBackgroundAudioStart();

    const p = canvasPointFromEvent(event);
    // Only grab near the resting ball / band pocket
    if (dist(p, state.ball) > BALL_RADIUS * 3.2) return;

    state.dragging = true;
    state.pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('game16-canvas--dragging');
    startStretchSound().catch(() => {});
    pullBallTo(p);
}

function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    pullBallTo(canvasPointFromEvent(event));
}

function onPointerUp(event) {
    if (!state.dragging || (state.pointerId !== null && event.pointerId !== state.pointerId)) return;
    state.dragging = false;
    state.pointerId = null;
    canvas.classList.remove('game16-canvas--dragging');
    try {
        canvas.releasePointerCapture(event.pointerId);
    } catch (_) {
        // ignore
    }
    stopStretchSound();
    launchBall();
}

/**
 * Constrains the ball to a downward pull within MAX_PULL of rest.
 * @param {{x:number,y:number}} p
 */
function pullBallTo(p) {
    let dx = p.x - state.rest.x;
    let dy = p.y - state.rest.y;
    // Prefer pulling downward / slightly sideways (slingshot feel)
    if (dy < 0) dy = 0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const clamped = Math.min(len, MAX_PULL);
    state.ball.x = state.rest.x + (dx / len) * clamped;
    state.ball.y = state.rest.y + (dy / len) * clamped;
    updateStretchSound(clamped / MAX_PULL);
}

/**
 * Converts band stretch into velocity and starts flight.
 * Speed scales from the real distance to the word row (works on tall screens).
 */
function launchBall() {
    const dx = state.rest.x - state.ball.x;
    const dy = state.rest.y - state.ball.y;
    const pull = Math.sqrt(dx * dx + dy * dy);
    if (pull < MIN_PULL) {
        resetBallToRest();
        return;
    }

    // Stop the prompt so it does not talk over the flight sound
    stopPromptPlayback();

    const nx = dx / pull;
    const ny = dy / pull;

    // How far up we must climb to clear the word centers (+ overshoot)
    const targetY = getTargetRowCenterY();
    const rise = Math.max(240, state.rest.y - targetY + 100);
    // Vertical speed needed for that rise: v_up = sqrt(2 g h)
    const neededUp = Math.sqrt(2 * GRAVITY * rise);
    // If the shot is angled, total speed must be larger so the vertical part still reaches
    const upwardShare = Math.max(0.5, Math.abs(Math.min(0, ny)));
    // Slight overshoot so a full pull reliably reaches the word row
    const fullSpeed = (neededUp / upwardShare) * 1.28;
    const targetSpeed = fullSpeed * (pull / MAX_PULL);

    // Release with only part of the speed — the band then accelerates the ball
    // for a short burst (matches a real slingshot + rising “ouiii” sound).
    const releaseSpeed = targetSpeed * SLING_RELEASE_SPEED_FRAC;
    state.ball.vx = nx * releaseSpeed;
    state.ball.vy = ny * releaseSpeed;
    state.ball.flying = true;
    state.ball.boosting = true;
    state.ball.boostLeft = SLING_BOOST_TIME;
    // Accelerate along launch direction so we reach ~targetSpeed over the boost window
    const boostDelta = targetSpeed * (1 - SLING_RELEASE_SPEED_FRAC);
    const boostAccel = boostDelta / SLING_BOOST_TIME;
    state.ball.boostAx = nx * boostAccel;
    state.ball.boostAy = ny * boostAccel;
    state.canShoot = false;
    playLaunchBlip().catch(() => {});
    startFlightWhoosh().catch(() => {});
}

/**
 * Main animation loop: gravity, collisions, drawing.
 * @param {number} ts
 */
function loop(ts) {
    const dt = state.lastTs ? Math.min(0.033, (ts - state.lastTs) / 1000) : 0.016;
    state.lastTs = ts;

    if (state.ball.flying) {
        // Rubber still tugging briefly after release → ball accelerates first
        if (state.ball.boosting) {
            const step = Math.min(dt, state.ball.boostLeft);
            state.ball.vx += state.ball.boostAx * step;
            state.ball.vy += state.ball.boostAy * step;
            state.ball.boostLeft -= step;
            if (state.ball.boostLeft <= 0) {
                state.ball.boosting = false;
            }
        }

        state.ball.vy += GRAVITY * dt;
        state.ball.x += state.ball.vx * dt;
        state.ball.y += state.ball.vy * dt;

        // Bounce off left / right walls of the play field
        if (fieldEl) {
            const minX = BALL_RADIUS;
            const maxX = fieldEl.clientWidth - BALL_RADIUS;
            if (state.ball.x < minX) {
                state.ball.x = minX;
                state.ball.vx = Math.abs(state.ball.vx) * WALL_BOUNCE;
                state.ball.boosting = false;
            } else if (state.ball.x > maxX) {
                state.ball.x = maxX;
                state.ball.vx = -Math.abs(state.ball.vx) * WALL_BOUNCE;
                state.ball.boosting = false;
            }
        }

        updateFlightWhoosh();
        checkCollisions();
        // Below the field → miss / hit the ground, then hear the prompt again
        if (fieldEl && state.ball.y > fieldEl.clientHeight + 40) {
            playFailSound().catch(() => {});
            resetBallToRest();
            replayPromptAfterFail();
        }
    }

    draw();
    rafId = requestAnimationFrame(loop);
}

/**
 * Hits a word target if the ball overlaps its box.
 */
function checkCollisions() {
    if (!fieldEl || !state.targetWord) return;
    const fieldRect = fieldEl.getBoundingClientRect();

    for (const entry of state.targetEls) {
        if (!entry.el || entry.el.classList.contains('game16-target--removed')) continue;
        const r = entry.el.getBoundingClientRect();
        const box = {
            left: r.left - fieldRect.left,
            right: r.right - fieldRect.left,
            top: r.top - fieldRect.top,
            bottom: r.bottom - fieldRect.top
        };
        if (circleHitsAabb(state.ball.x, state.ball.y, BALL_RADIUS, box)) {
            handleHit(entry);
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

/**
 * Correct hit removes the word; wrong hit flashes and reloads the ball.
 * @param {{word: object, el: HTMLElement}} entry
 */
function handleHit(entry) {
    state.ball.flying = false;
    state.ball.boosting = false;
    stopFlightWhoosh();

    if (entry.word.id === state.targetWord.id) {
        entry.el.classList.add('game16-target--hit');
        stopPromptPlayback();
        playSuccessSound().catch(() => {});
        setTimeout(() => {
            entry.el.classList.add('game16-target--removed');
        }, 280);

        state.options = state.options.filter((w) => w.id !== entry.word.id);
        state.targetEls = state.targetEls.filter((t) => t !== entry);

        if (state.options.length === 0) {
            state.roundComplete = true;
            state.targetWord = null;
            resetBallToRest();
            showCompletionDialog();
            return;
        }

        state.targetWord = state.options[Math.floor(Math.random() * state.options.length)];
        resetBallToRest();
        playSpokenPrompt().catch((error) => {
            console.warn('Could not play next prompt:', error);
            state.canShoot = true;
        });
    } else {
        entry.el.classList.add('game16-target--wrong-flash');
        playErrorSound().catch(() => {});
        setTimeout(() => entry.el.classList.remove('game16-target--wrong-flash'), 400);
        resetBallToRest();
        replayPromptAfterFail();
    }
}

/**
 * After a miss (wrong word or ground), replay “Försök träffa” + target word.
 * Short delay so the fail beep can finish first.
 */
function replayPromptAfterFail() {
    if (state.roundComplete || !state.targetWord) return;
    // Keep the band pullable while the prompt replays
    setTimeout(() => {
        if (state.roundComplete || !state.targetWord) return;
        playSpokenPrompt().catch((error) => {
            console.warn('Could not replay prompt after miss:', error);
        });
    }, 420);
}

/**
 * Draws rubber band posts, elastic bands, and the ball.
 */
function draw() {
    if (!ctx || !fieldEl) return;
    const w = fieldEl.clientWidth;
    const h = fieldEl.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const { anchorL, anchorR, ball } = state;

    // Wooden posts
    drawPost(anchorL.x, anchorL.y);
    drawPost(anchorR.x, anchorR.y);

    // Elastic bands (behind ball while dragging / at rest; in front while flying looks odd so keep behind)
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(185, 28, 28, 0.92)';
    if (!ball.flying) {
        ctx.beginPath();
        ctx.moveTo(anchorL.x, anchorL.y);
        ctx.lineTo(ball.x, ball.y);
        ctx.lineTo(anchorR.x, anchorR.y);
        ctx.stroke();
        // Inner highlight
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(254, 202, 202, 0.85)';
        ctx.beginPath();
        ctx.moveTo(anchorL.x, anchorL.y);
        ctx.lineTo(ball.x, ball.y);
        ctx.lineTo(anchorR.x, anchorR.y);
        ctx.stroke();
    } else {
        // Slack band at rest height while ball flies
        ctx.beginPath();
        ctx.moveTo(anchorL.x, anchorL.y);
        ctx.quadraticCurveTo(state.rest.x, state.rest.y + 18, anchorR.x, anchorR.y);
        ctx.stroke();
    }

    // Projectile
    const grd = ctx.createRadialGradient(
        ball.x - 4,
        ball.y - 5,
        2,
        ball.x,
        ball.y,
        BALL_RADIUS
    );
    grd.addColorStop(0, '#fef08a');
    grd.addColorStop(0.55, '#f59e0b');
    grd.addColorStop(1, '#b45309');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)';
    ctx.stroke();
}

function drawPost(x, y) {
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x - 7, y - 28, 14, 36);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x - 10, y - 32, 20, 8);
}

async function handleListenClick() {
    if (state.roundComplete) return;
    requestBackgroundAudioStart();
    try {
        await playSpokenPrompt();
    } catch (error) {
        console.warn('Could not replay prompt:', error);
        state.canShoot = true;
    }
}

/**
 * Plays “Försök träffa” then the target word (file or speech + game14 word audio).
 */
async function playSpokenPrompt() {
    if (!state.targetWord) return;
    if (state.promptPlaying) return;
    state.promptPlaying = true;
    // Band stays pullable for the whole prompt (not locked until audio ends)

    if (listenButton) {
        listenButton.disabled = true;
        listenButton.classList.add('game16-listen--playing');
    }

    try {
        await ensureAudioContext();
        if (!audioContext || audioContext.state !== 'running') {
            // Browser blocked audio until a user gesture — retry on first tap/pull
            state.promptNeedsRetry = true;
            return;
        }

        state.promptNeedsRetry = false;
        const promptPath = resolveGame16Asset(STRINGS.promptSound || 'sounds/ForsokTraffa.mp3');
        const playedFile = await playBufferUrlIfExists(promptPath);
        if (!playedFile) {
            await speakPromptPhrase(STRINGS.promptSpeech || 'Försök träffa');
        }
        if (state.roundComplete || !state.targetWord) return;

        const wordPath = resolveWordSound(state.targetWord.sound);
        await playBufferUrl(wordPath);
    } finally {
        state.promptPlaying = false;
        if (listenButton) {
            listenButton.disabled = false;
            listenButton.classList.remove('game16-listen--playing');
        }
    }
}

/**
 * Tries to play a URL; returns false if the file is missing / fails to load.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
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

/**
 * Browser speech for the lead-in phrase when ForsokTraffa.mp3 is not deployed yet.
 * @param {string} text
 * @returns {Promise<void>}
 */
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
        const utterance = new SpeechSynthesisUtterance(String(text));
        utterance.lang = 'sv-SE';
        const voices = window.speechSynthesis.getVoices() || [];
        const swedish = voices.find(
            (v) => /^sv(-|_)/i.test(v.lang) || /swedish|svenska/i.test(v.name)
        );
        if (swedish) utterance.voice = swedish;
        utterance.rate = 0.95;
        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        utterance.volume = Math.min(1, Math.max(0.25, volume * 1.5));
        activeUtterance = utterance;
        utterance.onend = () => {
            activeUtterance = null;
            resolve();
        };
        utterance.onerror = () => {
            activeUtterance = null;
            resolve();
        };
        window.speechSynthesis.speak(utterance);
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
    activeUtterance = null;
    if (window.speechSynthesis) {
        try {
            window.speechSynthesis.cancel();
        } catch (_) {
            // ignore
        }
    }
}

/**
 * @param {string} url
 * @param {boolean} quietMissing - if true, missing file is not logged as a hard error
 */
async function loadAudioBuffer(url, quietMissing) {
    if (!url) return null;
    if (audioBufferCache.has(url)) return audioBufferCache.get(url);
    await ensureAudioContext();
    if (!audioContext) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (!quietMissing) console.warn('Audio HTTP', response.status, url);
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

/**
 * Starts a soft tension tone for pulling the rubber band.
 */
async function startStretchSound() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    stopStretchSound();

    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    // Slightly buzzy → reads as elastic “creak”, not a musical note
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(280, now);
    filter.Q.value = 4.5;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);

    stretchOsc = osc;
    stretchFilter = filter;
    stretchGain = gain;
}

/**
 * Pitch and volume rise with how far the band is pulled (0–1).
 * @param {number} amount
 */
function updateStretchSound(amount) {
    if (!audioContext || !stretchOsc || !stretchGain || !stretchFilter) return;
    const t = Math.max(0, Math.min(1, amount));
    const now = audioContext.currentTime;
    const master = window.TiddeliGamesVolume?.get() ?? 0.35;
    // Low “rubbery” tension → higher strain when fully pulled
    const freq = 85 + t * 220;
    const filterFreq = 240 + t * 720;
    const vol = master * (0.04 + t * 0.22);
    try {
        stretchOsc.frequency.setTargetAtTime(freq, now, 0.04);
        stretchFilter.frequency.setTargetAtTime(filterFreq, now, 0.04);
        stretchGain.gain.setTargetAtTime(Math.max(0.0001, vol), now, 0.05);
    } catch (_) {
        // ignore
    }
}

/**
 * Stops the stretch/tension tone (on release or cancel).
 */
function stopStretchSound() {
    const osc = stretchOsc;
    const gain = stretchGain;
    stretchOsc = null;
    stretchFilter = null;
    stretchGain = null;
    if (!audioContext || !osc) return;
    try {
        const now = audioContext.currentTime;
        if (gain) {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        }
        osc.stop(now + 0.08);
    } catch (_) {
        try {
            osc.stop();
        } catch (__) {
            // already stopped
        }
    }
}

async function playLaunchBlip() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const vol = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.22;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.14);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.16);
}

/**
 * Maps current ball speed (px/s) to an “ouiii” whistle pitch in Hz.
 * Faster → higher; slow near the top of the arc → lower.
 * @param {number} speed
 */
function flightPitchFromSpeed(speed) {
    // Typical flight speeds ~200–1400 px/s after tuning
    const t = Math.max(0, Math.min(1, (speed - 80) / 1200));
    // “ou” (~280Hz) → “iii” (~1400Hz)
    return 280 + t * 1120;
}

/**
 * Starts a speed-linked “ouiii” whistle for the ball in flight.
 */
async function startFlightWhoosh() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    stopFlightWhoosh();

    const now = audioContext.currentTime;
    const speed0 = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
    const pitch0 = flightPitchFromSpeed(speed0);
    const vol0 = (window.TiddeliGamesVolume?.get() ?? 0.35) * Math.min(0.34, 0.1 + speed0 * 0.00022);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol0, now + 0.03);
    gain.connect(audioContext.destination);

    // Fundamental + soft overtone → more “ouiii” than a single beep
    const oscA = audioContext.createOscillator();
    const oscB = audioContext.createOscillator();
    oscA.type = 'sine';
    oscB.type = 'sine';
    oscA.frequency.setValueAtTime(pitch0, now);
    oscB.frequency.setValueAtTime(pitch0 * 1.5, now);

    const mixB = audioContext.createGain();
    mixB.gain.value = 0.22;
    oscA.connect(gain);
    oscB.connect(mixB);
    mixB.connect(gain);

    oscA.start(now);
    oscB.start(now);

    flightOscA = oscA;
    flightOscB = oscB;
    flightGain = gain;
}

/**
 * Pitch and volume follow ball speed every frame (tight tracking).
 * During the sling boost, pitch rises with acceleration; later it falls near the apex.
 */
function updateFlightWhoosh() {
    if (!audioContext || !flightOscA || !flightGain || !state.ball.flying) return;
    const speed = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
    const t = audioContext.currentTime;
    const pitch = flightPitchFromSpeed(speed);
    const master = window.TiddeliGamesVolume?.get() ?? 0.35;
    const vol = master * Math.min(0.38, 0.06 + speed * 0.00025);
    // Snappier while the rubber still accelerates so the rise is audible
    const tau = state.ball.boosting ? 0.018 : 0.03;
    try {
        flightOscA.frequency.setTargetAtTime(pitch, t, tau);
        if (flightOscB) {
            flightOscB.frequency.setTargetAtTime(pitch * 1.5, t, tau);
        }
        flightGain.gain.setTargetAtTime(Math.max(0.0001, vol), t, 0.04);
    } catch (_) {
        // ignore scheduling glitches
    }
}

/**
 * Fades out and stops the in-flight “ouiii”.
 */
function stopFlightWhoosh() {
    const oscA = flightOscA;
    const oscB = flightOscB;
    const gain = flightGain;
    flightOscA = null;
    flightOscB = null;
    flightGain = null;
    if (!audioContext || (!oscA && !oscB)) return;
    try {
        const now = audioContext.currentTime;
        if (gain) {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        }
        if (oscA) oscA.stop(now + 0.14);
        if (oscB) oscB.stop(now + 0.14);
    } catch (_) {
        try {
            if (oscA) oscA.stop();
        } catch (__) {
            // already stopped
        }
        try {
            if (oscB) oscB.stop();
        } catch (__) {
            // already stopped
        }
    }
}

/** Wrong-word hit uses the same soft incorrect cue as a ground miss */
async function playErrorSound() {
    return playFailSound();
}

/**
 * Bright ascending ding when the correct word is hit (C5–E5–G5).
 */
async function playSuccessSound() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;

    const now = audioContext.currentTime;
    const master = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.4;

    // Short major arpeggio — clear “correct!” without drowning the next prompt
    const notes = [
        { start: 0.0, freq: 523.25, dur: 0.12 }, // C5
        { start: 0.09, freq: 659.25, dur: 0.12 }, // E5
        { start: 0.18, freq: 783.99, dur: 0.22 } // G5
    ];

    notes.forEach((note, index) => {
        const t0 = now + note.start;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        osc.type = index === 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(note.freq, t0);
        osc.frequency.linearRampToValueAtTime(note.freq * 1.03, t0 + note.dur);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, t0);

        const peak = master * (index === 2 ? 1 : 0.85);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(peak, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(t0);
        osc.stop(t0 + note.dur + 0.03);
    });
}

/**
 * Soft quiz-style “incorrect” when the ball hits the ground
 * (three descending tones — same idea as a wrong answer in other games).
 */
async function playFailSound() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;

    const now = audioContext.currentTime;
    const master = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.42;

    // G#4 → F4 → C4 (gentle, clearly “wrong”, not harsh)
    const notes = [
        { start: 0.0, freq: 415.3, dur: 0.14 },
        { start: 0.12, freq: 349.2, dur: 0.16 },
        { start: 0.26, freq: 261.6, dur: 0.22 }
    ];

    notes.forEach((note, index) => {
        const t0 = now + note.start;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, t0);
        // Tiny downward slide so each beep feels soft, not clicky
        osc.frequency.linearRampToValueAtTime(note.freq * 0.94, t0 + note.dur);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, t0);

        const peak = master * (index === 2 ? 0.95 : 0.85);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(t0);
        osc.stop(t0 + note.dur + 0.03);
    });
}

function shuffleArray(array) {
    const copy = array.slice();
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
        window.playSharedCompletionSound(audioContext, 0.8).catch((error) => {
            console.warn('Could not play completion sound:', error);
        });
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
            console.warn('Could not start background audio yet:', error);
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
    backgroundBuffer = await loadAudioBuffer(resolveGame16Asset(track), true);
    if (!backgroundBuffer) return;

    backgroundSource = audioContext.createBufferSource();
    backgroundSource.buffer = backgroundBuffer;
    backgroundSource.loop = true;
    backgroundGain = audioContext.createGain();
    const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
    backgroundGain.gain.setValueAtTime(volume * 0.35, audioContext.currentTime);
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
        try {
            backgroundSource.disconnect();
        } catch (_) {
            // already disconnected
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
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }
    // Only retry when the first autoplay attempt could not start audio
    if (
        state.promptNeedsRetry &&
        !state.roundComplete &&
        state.targetWord &&
        !state.promptPlaying
    ) {
        playSpokenPrompt().catch(() => {
            state.canShoot = true;
        });
    }
}

function handleVolumeChange(event) {
    if (!audioContext || audioContext.state !== 'running') return;
    const newVolume =
        event.detail && typeof event.detail.volume === 'number'
            ? event.detail.volume
            : window.TiddeliGamesVolume?.get() ?? 0.35;
    if (backgroundGain) {
        backgroundGain.gain.setValueAtTime(newVolume * 0.35, audioContext.currentTime);
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        stopPromptPlayback();
        if (audioContext && audioContext.state === 'running') {
            audioContext.suspend().catch(() => {});
        }
    } else if (audioContext && state.audioStarted) {
        audioContext.resume().catch(() => {});
    }
}
