'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME11_STRINGS;

// Number of colors (pairs) per round
const NUM_COLORS = 4;

// Color definitions and matching object images
const COLORS = Object.freeze([
    {
        id: 'red',
        name: 'röd',
        dotColor: '#ef4444'
    },
    {
        id: 'blue',
        name: 'blå',
        dotColor: '#3b82f6'
    },
    {
        id: 'green',
        name: 'grön',
        dotColor: '#22c55e'
    },
    {
        id: 'yellow',
        name: 'gul',
        dotColor: '#eab308'
    },
    {
        id: 'pink',
        name: 'rosa',
        dotColor: '#ec4899'
    },
    {
        id: 'purple',
        name: 'lila',
        dotColor: '#a855f7'
    }
]);

// Available object images for each color (randomly chosen per round)
const OBJECT_IMAGES = Object.freeze({
    red: [
        'images/ballRed.jpg',
        'images/carRed.jpg',
        'images/bootsRed.jpg',
        'images/bucketRed.jpg',
        'images/elephantRed.jpg',
               'images/jacketRed.jpg'
    ],
    blue: [
        'images/ballBlue.jpg',
        'images/carBlue.jpg',
        'images/bootsBlue.jpg',
        'images/bucketBlue.jpg',
        'images/elephantBlue.jpg',
        'images/JacketBlue.jpg',
        'images/blueBoots.png'
    ],
    green: [
        'images/ballGreen.jpg',
        'images/carGreen.jpg',
        'images/bootsGreen.jpg',
        'images/bucketGreen.jpg',
        'images/elephantGreen.jpg',
        'images/JacketGreen.jpg'
    ],
    yellow: [
        'images/ballYellow.jpg',
        'images/carYellow.jpg',
        'images/bootsYellow.jpg',
        'images/bucketYellow.jpg',
        'images/elephantYellow.jpg',
        'images/jacketYellow.jpg'
    ],
    pink: [
        'images/ballPink.jpg',
        'images/carPing.jpg', // pink car (file name typo)
        'images/bootsPink.jpg',
        'images/bucketPink.jpg',
        'images/elephantPink.jpg',
        'images/jacketPink.jpg'
    ],
    purple: [
        'images/ballPurple.jpg',
        'images/carPurple.jpg',
        'images/bucketPurple.jpg',
        'images/elephantPurple.jpg'
    ]
});

const GAME11_ASSETS = window.TiddeliAssets;

/**
 * Resolves a game11-local asset path via TiddeliAssets (same as other games).
 * Falls back to APP_CONFIG.assetBaseUrl when TiddeliAssets is not yet available (e.g. script order on deploy).
 * @param {string} path Relative path like "images/ballRed.jpg" or "sounds/background.mp3"
 * @returns {string} Resolved URL
 */
function resolveGame11Asset(path) {
    if (!path) return '';
    const cleanPath = (path || '').replace(/^\.?\//, '');
    if (GAME11_ASSETS && typeof GAME11_ASSETS.resolveGameAsset === 'function') {
        return GAME11_ASSETS.resolveGameAsset('game11', path);
    }
    // Fallback when assets.js did not run or TiddeliAssets is missing (e.g. production deploy)
    let base = '';
    try {
        if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.assetBaseUrl) {
            base = APP_CONFIG.assetBaseUrl.replace(/\/+$/, '');
        }
    } catch (_) {}
    if (base) {
        return `${base}/games/game11/${cleanPath}`;
    }
    return cleanPath;
}

/**
 * Returns a random object image path for the given color id.
 * Falls back to a ball image if something is misconfigured.
 */
function getRandomImageForColor(colorId) {
    const list = OBJECT_IMAGES[colorId];
    if (Array.isArray(list) && list.length > 0) {
        const index = Math.floor(Math.random() * list.length);
        return resolveGame11Asset(list[index]);
    }
    // Fallbacks
    switch (colorId) {
        case 'red': return resolveGame11Asset('images/ballRed.jpg');
        case 'blue': return resolveGame11Asset('images/ballBlue.jpg');
        case 'green': return resolveGame11Asset('images/ballGreen.jpg');
        case 'yellow': return resolveGame11Asset('images/ballYellow.jpg');
        case 'pink': return resolveGame11Asset('images/ballPink.jpg');
        case 'purple': return resolveGame11Asset('images/ballPurple.jpg');
        default: return resolveGame11Asset('images/ballRed.jpg');
    }
}

/**
 * Starts a gentle synthetic sound while a dot is being dragged.
 * Sound is stopped and cleaned up in stopDragSound().
 */
async function startDragSound() {
    await ensureAudioContext();

    if (!audioContext || audioContext.state !== 'running') {
        return;
    }

    // If a drag sound is already playing, stop it before starting a new one
    stopDragSound();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    // Soft, friendly tone with a slightly randomized starting pitch
    osc.type = 'sine';
    const baseFreq = 650 + Math.random() * 200; // 650–850 Hz
    osc.frequency.setValueAtTime(baseFreq, audioContext.currentTime);

    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const baseVolume = globalVolume * 0.25;

    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(baseVolume, audioContext.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();

    state.dragSoundSource = osc;
    state.dragSoundGain = gain;
}

/**
 * Stops the drag sound with a short fade-out.
 */
function stopDragSound() {
    if (!audioContext) {
        state.dragSoundSource = null;
        state.dragSoundGain = null;
        return;
    }

    const osc = state.dragSoundSource;
    const gain = state.dragSoundGain;

    state.dragSoundSource = null;
    state.dragSoundGain = null;
    state.lastPointerX = null;
    state.lastPointerY = null;
    state.lastPointerTime = null;

    if (!osc || !gain) {
        return;
    }

    try {
        const now = audioContext.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.08);
        osc.stop(now + 0.1);
        setTimeout(() => {
            try {
                osc.disconnect();
                gain.disconnect();
            } catch (e) {
                // ignore cleanup errors
            }
        }, 150);
    } catch (e) {
        try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
        } catch {
            // ignore
        }
    }
}

/**
 * Plays a short, soft error sound when a dot is dropped on the wrong object.
 * @returns {Promise<void>}
 */
async function playDropErrorSound() {
    await ensureAudioContext();

    if (!audioContext || audioContext.state !== 'running') {
        return;
    }

    // Create a very short descending "whoop" as error feedback
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'triangle';

    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const baseVolume = globalVolume * 0.35;

    const now = audioContext.currentTime;
    const duration = 0.2;

    // Pitch: start higher, slide down a bit
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.linearRampToValueAtTime(500, now + duration);

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(baseVolume, now + 0.03);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    return new Promise(resolve => {
        osc.addEventListener('ended', () => {
            try {
                osc.disconnect();
                gain.disconnect();
            } catch {
                // ignore
            }
            resolve();
        }, { once: true });
    });
}

/**
 * Plays a short joyful "ding" when a dot is placed correctly.
 * @returns {Promise<void>}
 */
async function playPlacementSuccessSound() {
    await ensureAudioContext();

    if (!audioContext || audioContext.state !== 'running') {
        return;
    }

    // Friendly, encouraging little "sparkle chord" with three voices
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const osc3 = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'triangle';

    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const baseVolume = globalVolume * 0.6;

    const now = audioContext.currentTime;
    const duration = 0.5;

    // Pitch: bright major chord with a little upward lift and shimmer
    // Voice 1 (root)
    osc1.frequency.setValueAtTime(660, now); // E5-ish
    osc1.frequency.linearRampToValueAtTime(780, now + 0.18);
    osc1.frequency.linearRampToValueAtTime(880, now + duration);
    // Voice 2 (major third)
    osc2.frequency.setValueAtTime(825, now); // G#5-ish
    osc2.frequency.linearRampToValueAtTime(990, now + 0.18);
    osc2.frequency.linearRampToValueAtTime(1180, now + duration);
    // Voice 3 (higher sparkle, fifth-ish, quieter via envelope)
    osc3.frequency.setValueAtTime(990, now); // B5-ish
    osc3.frequency.linearRampToValueAtTime(1320, now + duration);

    // Very small vibrato on osc3 for extra joy
    try {
        const vibrato = audioContext.createOscillator();
        const vibratoGain = audioContext.createGain();
        vibrato.frequency.setValueAtTime(7, now);
        vibratoGain.gain.setValueAtTime(10, now); // +/- 10 Hz
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc3.frequency);
        vibrato.start(now);
        vibrato.stop(now + duration + 0.1);
    } catch {
        // Ignore vibrato errors (older browsers etc.)
    }

    // Envelope: quick attack, nice sustain, smooth decay
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(baseVolume, now + 0.05);
    gain.gain.linearRampToValueAtTime(baseVolume * 0.9, now + 0.25);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    gain.connect(audioContext.destination);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now + 0.04); // slight delay for sparkle layer
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
    osc3.stop(now + duration + 0.08);

    return new Promise(resolve => {
        let endedCount = 0;
        const onEnded = () => {
            endedCount += 1;
            if (endedCount < 3) return;
            try {
                osc1.disconnect();
                osc2.disconnect();
                osc3.disconnect();
                gain.disconnect();
            } catch {
                // ignore
            }
            resolve();
        };

        osc1.addEventListener('ended', onEnded, { once: true });
        osc2.addEventListener('ended', onEnded, { once: true });
        osc3.addEventListener('ended', onEnded, { once: true });
    });
}

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let dotsContainer = null;
let targetsContainer = null;
let completionDialog = null;
let completionTitle = null;
let completionMessage = null;
let continueButton = null;

// Audio-related resources
let audioContext = null;
let backgroundBuffer = null;
let backgroundSource = null;
let backgroundGain = null;
const audioBufferCache = new Map();

// Game state variables
const state = {
    pairs: [], // { color, dotEl, targetEl, matched, dotStartX, dotStartY }
    matchedCount: 0,
    // Drag state
    activePointerId: null,
    activeDot: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dotInitialX: 0,
    dotInitialY: 0,
    // Drag sound
    dragSoundSource: null,
    dragSoundGain: null,
    lastPointerX: null,
    lastPointerY: null,
    lastPointerTime: null,
    // Audio flags
    audioStarted: false,
    audioStarting: false
};

/**
 * Initializes the game when the DOM is ready.
 */
window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachEventListeners();
    startNewRound();
    requestBackgroundAudioStart();
});

/**
 * Retrieves and caches references to all important DOM elements.
 */
function cacheDomElements() {
    titleEl = document.getElementById('game11-title');
    instructionsEl = document.getElementById('instructions-text');
    dotsContainer = document.getElementById('dots-container');
    targetsContainer = document.getElementById('targets-container');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');

    // Resolve background image for the game field from shared assets
    const gameField = document.getElementById('game11-field');
    if (gameField) {
        const bgPath = 'images/background.jpg';
        const bgUrl = resolveGame11Asset(bgPath);
        gameField.style.backgroundImage =
            `linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0.0)), url('${bgUrl}')`;
    }
}

/**
 * Sets static text (title, button labels, etc.) when the game first loads.
 */
function populateStaticTexts() {
    if (titleEl) {
        titleEl.textContent = STRINGS.title;
    }
    if (instructionsEl) {
        instructionsEl.textContent = STRINGS.instructions;
    }
    if (continueButton) {
        continueButton.textContent = STRINGS.labels.continue;
    }
    if (completionTitle) {
        completionTitle.textContent = STRINGS.dialog.title;
    }
    if (completionMessage) {
        completionMessage.textContent = STRINGS.dialog.message;
    }
}

/**
 * Attaches all event listeners for window events.
 */
function attachEventListeners() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Listen for volume changes from main page
    window.addEventListener('volumechange', handleVolumeChange);
    // Attempt to start audio on first interaction
    ['pointerdown', 'touchstart', 'keydown'].forEach(eventName => {
        document.addEventListener(eventName, handleFirstInteraction, { once: true });
    });

    // Dialog button handler
    if (continueButton) {
        continueButton.addEventListener('click', handleContinueClick);
    }
}

/**
 * Handles visibility changes (pause/resume background audio).
 */
function handleVisibilityChange() {
    if (document.hidden) {
        pauseGame();
    } else {
        resumeGame();
    }
}

/**
 * Pauses the game (stops background audio).
 */
function pauseGame() {
    if (backgroundSource && audioContext && audioContext.state === 'running') {
        audioContext.suspend().catch(error => {
            console.warn('Could not suspend audio context:', error);
        });
    }
}

/**
 * Resumes the game (resumes background audio).
 */
function resumeGame() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(error => {
            console.warn('Could not resume audio context:', error);
        });
    }
}

/**
 * Handles volume changes from the main page control.
 * @param {CustomEvent} event - Volume change event
 */
function handleVolumeChange(event) {
    const newVolume = event.detail?.volume ?? window.TiddeliGamesVolume?.get() ?? 0.35;
    if (backgroundGain && audioContext && audioContext.state === 'running') {
        backgroundGain.gain.setValueAtTime(newVolume, audioContext.currentTime);
    }
}

/**
 * Handles first user interaction to start audio.
 */
function handleFirstInteraction() {
    requestBackgroundAudioStart();
}

/**
 * Requests background audio to start (respects autoplay policy).
 */
function requestBackgroundAudioStart() {
    if (state.audioStarted || state.audioStarting) {
        return;
    }
    state.audioStarting = true;
    startBackgroundAmbience().then(() => {
        state.audioStarted = true;
        state.audioStarting = false;
    }).catch(error => {
        console.warn('Could not start background ambience:', error);
        state.audioStarting = false;
    });
}

/**
 * Starts a new round of the game.
 * Chooses colors and randomizes their positions.
 */
function startNewRound() {
    state.pairs = [];
    state.matchedCount = 0;
    state.activePointerId = null;
    state.activeDot = null;

    if (dotsContainer) dotsContainer.innerHTML = '';
    if (targetsContainer) targetsContainer.innerHTML = '';

    // Select NUM_COLORS random distinct colors
    const shuffledColors = shuffleArray(COLORS.slice());
    const roundColors = shuffledColors.slice(0, NUM_COLORS);

    // Randomize order separately for dots and targets to ensure changing positions
    const dotsOrder = shuffleArray(roundColors.slice());
    const targetsOrder = shuffleArray(roundColors.slice());

    // Create dot elements
    dotsOrder.forEach(color => {
        const wrapper = document.createElement('div');
        wrapper.className = 'game11-dot-wrapper';
        // Slightly randomize animation delay so dots don't bounce in sync
        wrapper.style.animationDelay = `${Math.random() * 0.9}s`;

        const dot = document.createElement('div');
        dot.className = 'game11-dot';
        // Set dot color directly as background color
        dot.style.backgroundColor = color.dotColor;
        dot.setAttribute('data-color-id', color.id);
        dot.setAttribute('role', 'button');
        dot.setAttribute('aria-label', STRINGS.aria.dot(color.name));

        // Positioning is handled via transform during drag; we store initial center later
        wrapper.appendChild(dot);
        if (dotsContainer) dotsContainer.appendChild(wrapper);

        // Register in state (target is linked later)
        state.pairs.push({
            color,
            dotEl: dot,
            targetEl: null,
            matched: false,
            dotStartX: 0,
            dotStartY: 0
        });

        setupDotDrag(dot);
    });

    // Create target elements
    targetsOrder.forEach(color => {
        const target = document.createElement('div');
        target.className = 'game11-target';
        target.setAttribute('data-color-id', color.id);
        target.setAttribute('aria-label', STRINGS.aria.target(color.name));

        const image = document.createElement('img');
        image.className = 'game11-target__image';
        image.src = getRandomImageForColor(color.id);
        image.alt = STRINGS.aria.target(color.name);

        target.appendChild(image);
        if (targetsContainer) targetsContainer.appendChild(target);
    });

    // Link targets in state (by color id)
    const targets = Array.from(document.querySelectorAll('.game11-target'));
    state.pairs.forEach(pair => {
        const target = targets.find(t => t.getAttribute('data-color-id') === pair.color.id);
        pair.targetEl = target || null;
    });

    // After layout, compute starting positions for each dot (center of its wrapper)
    requestAnimationFrame(() => {
        state.pairs.forEach(pair => {
            const wrapper = pair.dotEl.parentElement;
            if (!wrapper) return;
            const rect = wrapper.getBoundingClientRect();

            // Place dot at center of wrapper
            const dotRect = pair.dotEl.getBoundingClientRect();
            const startX = rect.left + rect.width / 2 - (dotRect.left + dotRect.width / 2);
            const startY = rect.top + rect.height / 2 - (dotRect.top + dotRect.height / 2);

            pair.dotEl.style.transform = `translate(${startX}px, ${startY}px)`;
            pair.dotStartX = startX;
            pair.dotStartY = startY;
        });
    });
}

/**
 * Sets up pointer event listeners for a dot.
 * @param {HTMLElement} dotEl 
 */
function setupDotDrag(dotEl) {
    dotEl.addEventListener('pointerdown', handleDotPointerDown);
}

/**
 * Handles pointer down on a dot.
 * @param {PointerEvent} event 
 */
function handleDotPointerDown(event) {
    const dotEl = event.currentTarget;

    // Ignore if another pointer is active
    if (state.activePointerId !== null) {
        return;
    }

    // Ignore already matched dots
    const pair = state.pairs.find(p => p.dotEl === dotEl);
    if (!pair || pair.matched) {
        return;
    }

    // Ensure audio is started on first interaction
    requestBackgroundAudioStart();
    startDragSound().catch(error => {
        console.warn('Could not start drag sound:', error);
    });

    state.activePointerId = event.pointerId;
    state.activeDot = dotEl;
    dotEl.setPointerCapture(event.pointerId);
    dotEl.classList.add('game11-dot--dragging');

    const rect = dotEl.getBoundingClientRect();
    state.dotInitialX = getCurrentTranslateX(dotEl);
    state.dotInitialY = getCurrentTranslateY(dotEl);
    state.dragOffsetX = event.clientX - (rect.left + rect.width / 2);
    state.dragOffsetY = event.clientY - (rect.top + rect.height / 2);
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.lastPointerTime = performance.now();

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUpOrCancel);
    window.addEventListener('pointercancel', handlePointerUpOrCancel);
}

/**
 * Handles pointer move during drag.
 * @param {PointerEvent} event 
 */
function handlePointerMove(event) {
    if (state.activePointerId !== event.pointerId || !state.activeDot) {
        return;
    }

    const x = event.clientX - state.dragOffsetX;
    const y = event.clientY - state.dragOffsetY;

    const dotRect = state.activeDot.getBoundingClientRect();
    const centerX = x - (dotRect.width / 2);
    const centerY = y - (dotRect.height / 2);

    const deltaX = centerX - (dotRect.left - getCurrentTranslateX(state.activeDot));
    const deltaY = centerY - (dotRect.top - getCurrentTranslateY(state.activeDot));

    const newX = state.dotInitialX + deltaX;
    const newY = state.dotInitialY + deltaY;

    state.activeDot.style.transform = `translate(${newX}px, ${newY}px)`;

    // Update drag sound pitch based on movement speed
    if (state.dragSoundSource && state.lastPointerX !== null && state.lastPointerY !== null && state.lastPointerTime !== null) {
        const now = performance.now();
        const dt = now - state.lastPointerTime;
        if (dt > 0) {
            const dx = event.clientX - state.lastPointerX;
            const dy = event.clientY - state.lastPointerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const speed = distance / dt; // px per ms

            // Map speed to frequency range
            const minFreq = 500;
            const maxFreq = 1400;
            const clampedSpeed = Math.min(speed, 1.0);
            const targetFreq = minFreq + (maxFreq - minFreq) * clampedSpeed;

            try {
                const ac = audioContext;
                if (ac && ac.state === 'running') {
                    state.dragSoundSource.frequency.cancelScheduledValues(ac.currentTime);
                    state.dragSoundSource.frequency.linearRampToValueAtTime(targetFreq, ac.currentTime + 0.05);
                }
            } catch (e) {
                // ignore audio errors
            }
        }
    }

    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.lastPointerTime = performance.now();
}

/**
 * Handles pointer up/cancel to finish drag.
 * @param {PointerEvent} event 
 */
function handlePointerUpOrCancel(event) {
    if (state.activePointerId !== event.pointerId || !state.activeDot) {
        return;
    }

    const dotEl = state.activeDot;
    stopDragSound();
    dotEl.releasePointerCapture(event.pointerId);
    dotEl.classList.remove('game11-dot--dragging');

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUpOrCancel);
    window.removeEventListener('pointercancel', handlePointerUpOrCancel);

    const pair = state.pairs.find(p => p.dotEl === dotEl);
    if (!pair || pair.matched || !pair.targetEl) {
        resetDotPosition(dotEl, pair);
        state.activePointerId = null;
        state.activeDot = null;
        return;
    }

    const dotRect = dotEl.getBoundingClientRect();
    const dotCenterX = dotRect.left + dotRect.width / 2;
    const dotCenterY = dotRect.top + dotRect.height / 2;

    const targetRect = pair.targetEl.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const dx = dotCenterX - targetCenterX;
    const dy = dotCenterY - targetCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const maxSnapDistance = Math.min(targetRect.width, targetRect.height) * 0.5;

    if (distance <= maxSnapDistance) {
        snapDotToTarget(pair);
    } else {
        // Wrong drop – play a short error sound and reset position
        playDropErrorSound().catch(error => {
            console.warn('Could not play drop error sound:', error);
        });
        resetDotPosition(dotEl, pair);
    }

    state.activePointerId = null;
    state.activeDot = null;
}

/**
 * Resets a dot back to its starting position.
 * @param {HTMLElement} dotEl 
 * @param {object} pair 
 */
function resetDotPosition(dotEl, pair) {
    const info = pair || state.pairs.find(p => p.dotEl === dotEl);
    if (!info) return;
    dotEl.style.transition = 'transform 200ms ease';
    dotEl.style.transform = `translate(${info.dotStartX}px, ${info.dotStartY}px)`;
    setTimeout(() => {
        dotEl.style.transition = '';
    }, 220);
}

/**
 * Snaps a dot onto its target and updates game state.
 * @param {{dotEl: HTMLElement, targetEl: HTMLElement, color: object}} pair 
 */
function snapDotToTarget(pair) {
    const dotEl = pair.dotEl;
    const targetEl = pair.targetEl;
    if (!dotEl || !targetEl) return;

    const dotRect = dotEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const deltaX = (targetRect.left + targetRect.width / 2) - (dotRect.left + dotRect.width / 2);
    const deltaY = (targetRect.top + targetRect.height / 2) - (dotRect.top + dotRect.height / 2);

    const currentX = getCurrentTranslateX(dotEl);
    const currentY = getCurrentTranslateY(dotEl);

    const newX = currentX + deltaX;
    const newY = currentY + deltaY;

    dotEl.style.transition = 'transform 200ms ease, opacity 250ms ease';
    dotEl.style.transform = `translate(${newX}px, ${newY}px)`;
    dotEl.classList.add('game11-dot--matched');

    pair.matched = true;
    pair.dotStartX = newX;
    pair.dotStartY = newY;

    targetEl.classList.add('game11-target--matched');

    // Play joyful success sound for a correct placement
    playPlacementSuccessSound().catch(error => {
        console.warn('Could not play placement success sound:', error);
    });

    state.matchedCount += 1;

    if (state.matchedCount >= state.pairs.length) {
        // All matched – show completion dialog and play shared sound
        showCompletionDialog();
    }
}

/**
 * Helper to get current translateX from element style.
 * @param {HTMLElement} el 
 * @returns {number}
 */
function getCurrentTranslateX(el) {
    const style = window.getComputedStyle(el);
    const matrix = style.transform;
    if (!matrix || matrix === 'none') {
        return 0;
    }
    const parts = matrix.match(/matrix\(([^)]+)\)/);
    if (!parts) {
        return 0;
    }
    const values = parts[1].split(',').map(Number);
    return values[4] || 0;
}

/**
 * Helper to get current translateY from element style.
 * @param {HTMLElement} el 
 * @returns {number}
 */
function getCurrentTranslateY(el) {
    const style = window.getComputedStyle(el);
    const matrix = style.transform;
    if (!matrix || matrix === 'none') {
        return 0;
    }
    const parts = matrix.match(/matrix\(([^)]+)\)/);
    if (!parts) {
        return 0;
    }
    const values = parts[1].split(',').map(Number);
    return values[5] || 0;
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 * @param {Array} array - Array to shuffle
 * @returns {Array} The same array instance
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Shows the completion dialog and plays the completion sound.
 */
function showCompletionDialog() {
    if (!completionDialog) {
        return;
    }
    completionDialog.hidden = false;

    // Hide title if empty
    if (completionTitle) {
        if (STRINGS.dialog.title) {
            completionTitle.textContent = STRINGS.dialog.title;
            completionTitle.style.display = '';
        } else {
            completionTitle.style.display = 'none';
        }
    }

    if (completionMessage) {
        completionMessage.textContent = STRINGS.dialog.message;
    }

    if (continueButton) {
        continueButton.disabled = false;
        continueButton.style.pointerEvents = 'auto';
    }

    // Play completion sound using shared helper
    if (window.playSharedCompletionSound) {
        window.playSharedCompletionSound(audioContext, 0.8).catch(error => {
            console.warn('Could not play completion sound:', error);
        });
    }
}

/**
 * Hides the completion dialog.
 */
function hideCompletionDialog() {
    if (!completionDialog) {
        return;
    }
    completionDialog.hidden = true;
}

/**
 * Handles continue button click in completion dialog.
 */
function handleContinueClick() {
    hideCompletionDialog();
    startNewRound();
}

/**
 * Ensures audio context is initialized and running.
 * @returns {Promise<AudioContext>} Promise that resolves with the audio context
 */
async function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Could not resume audio context:', error);
        }
    }
    return audioContext;
}

/**
 * Starts background ambience audio.
 * @returns {Promise} Promise that resolves when audio starts
 */
async function startBackgroundAmbience() {
    await ensureAudioContext();

    if (!audioContext || audioContext.state !== 'running') {
        return Promise.resolve();
    }

    const rawAmbiencePath = STRINGS.ambience?.track;
    if (!rawAmbiencePath) {
        return Promise.resolve();
    }

    try {
        // Resolve against asset base (if configured) and check cache first
        const ambiencePath = resolveGame11Asset(rawAmbiencePath);
        if (audioBufferCache.has(ambiencePath)) {
            backgroundBuffer = audioBufferCache.get(ambiencePath);
        } else {
            const response = await fetch(ambiencePath);
            const arrayBuffer = await response.arrayBuffer();
            backgroundBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBufferCache.set(ambiencePath, backgroundBuffer);
        }

        if (backgroundBuffer && audioContext.state === 'running') {
            backgroundSource = audioContext.createBufferSource();
            backgroundGain = audioContext.createGain();

            backgroundSource.buffer = backgroundBuffer;
            backgroundSource.loop = true;

            const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
            backgroundGain.gain.setValueAtTime(globalVolume, audioContext.currentTime);

            backgroundSource.connect(backgroundGain);
            backgroundGain.connect(audioContext.destination);

            backgroundSource.start(0);
        }
    } catch (error) {
        console.warn('Could not start background ambience:', error);
    }
}

