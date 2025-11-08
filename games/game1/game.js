// Game logic for Number Pop circle ordering game
'use strict';

// Total number of circles to place
const TOTAL_CIRCLES = 10;
// Extra spacing between circle centres to prevent overlap (in pixels)
const MIN_DISTANCE_BETWEEN_CIRCLES = 12;
// Maximum number of placement attempts before giving up on a position
const MAX_PLACEMENT_ATTEMPTS = 80;

// DOM references for game interaction
let circleContainer = null;
let startButton = null;
let timerDisplay = null;
let instructionsText = null;
let completionDialog = null;
let completionDialogTitle = null;
let completionDialogMessage = null;
let retryButton = null;
let backButton = null;

/**
 * Cache DOM references once the document is ready.
 */
function cacheDomElements() {
    circleContainer = document.getElementById('circle-container');
    startButton = document.getElementById('start-button');
    timerDisplay = document.getElementById('timer-display');
    instructionsText = document.getElementById('instructions-text');
    completionDialog = document.getElementById('completion-dialog');
    completionDialogTitle = document.getElementById('completion-dialog-title');
    completionDialogMessage = document.getElementById('completion-dialog-message');
    retryButton = document.getElementById('retry-button');
    backButton = document.getElementById('back-button');
}

/**
 * Lazily refresh references if any element was removed or not yet cached.
 */
function ensureDomReferences() {
    if (!circleContainer) {
        circleContainer = document.getElementById('circle-container');
    }
    if (!startButton) {
        startButton = document.getElementById('start-button');
    }
    if (!timerDisplay) {
        timerDisplay = document.getElementById('timer-display');
    }
    if (!instructionsText) {
        instructionsText = document.getElementById('instructions-text');
    }
    if (!completionDialog) {
        completionDialog = document.getElementById('completion-dialog');
    }
    if (!completionDialogTitle) {
        completionDialogTitle = document.getElementById('completion-dialog-title');
    }
    if (!completionDialogMessage) {
        completionDialogMessage = document.getElementById('completion-dialog-message');
    }
    if (!retryButton) {
        retryButton = document.getElementById('retry-button');
    }
    if (!backButton) {
        backButton = document.getElementById('back-button');
    }
}

/**
 * Attach event handlers safely after elements exist.
 */
function attachEventListeners() {
    ensureDomReferences();

    if (startButton) {
        startButton.addEventListener('click', handleStartButtonClick);
    }

    if (retryButton) {
        retryButton.addEventListener('click', handleRetryClick);
    }

    if (backButton) {
        backButton.addEventListener('click', handleBackClick);
    }

}

// Default instruction copy for easy reuse
const STRINGS = window.GAME_STRINGS;
const DEFAULT_INSTRUCTIONS = STRINGS.instructions;
const PAUSED_INSTRUCTIONS = STRINGS.pausedInstructions;
const LABELS = STRINGS.labels;
const MESSAGES = STRINGS.messages;
const DIALOG = STRINGS.dialog;
const ARIA = STRINGS.aria;
// Track if the player has already started at least one round
let hasStartedAtLeastOnce = false;

// Game state variables
let nextCircleNumber = 1;
let timerIntervalId = null;
let gameStartTimestamp = null;
let gameRunning = false;
let gamePaused = false;
let pausedElapsedMs = 0;

// Web Audio context and helpers for playful sound effects
let audioContext = null;
let ambienceSource = null;
let ambienceGain = null;
let ambienceBuffer = null;

// Relative path to the gentle kids ambience track (place file under assets/audio)
const AMBIENCE_AUDIO_PATH = 'sounds/background.mp3';


// Friendly C major scale for success tones
const CLICK_SCALE_FREQUENCIES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77];

/**
 * Create or resume the audio context so we can play tones after a user gesture.
 */
async function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}

/**
 * Play a short sine wave tone.
 * @param {number} frequency Frequency of the tone in hertz.
 * @param {number} duration Tone duration in seconds.
 * @param {number} startTime Optional Web Audio start time.
 * @param {number} volume Gain level between 0 and 1.
 */
async function playTone(frequency, duration = 0.35, startTime = null, volume = 0.6) {
    await ensureAudioContext();

    if (!audioContext) {
        return;
    }

    const playAt = startTime ?? audioContext.currentTime;

    const sampleRate = audioContext.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    let attackFrames = Math.floor(sampleRate * Math.min(0.02, duration / 4));
    let releaseFrames = Math.floor(sampleRate * Math.min(0.08, duration / 3));

    if (attackFrames + releaseFrames > frameCount) {
        const scale = frameCount / Math.max(1, attackFrames + releaseFrames);
        attackFrames = Math.floor(attackFrames * scale);
        releaseFrames = Math.floor(releaseFrames * scale);
    }

    const sustainFrames = Math.max(0, frameCount - attackFrames - releaseFrames);

    for (let i = 0; i < frameCount; i += 1) {
        const t = i / sampleRate;
        const envelope = calculateEnvelopeValue(i, attackFrames, sustainFrames, releaseFrames);
        data[i] = envelope * Math.sin(2 * Math.PI * frequency * t);
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const gainNode = audioContext.createGain();

    gainNode.gain.setValueAtTime(volume, playAt);
    gainNode.gain.linearRampToValueAtTime(0.0001, playAt + duration);

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start(playAt);
    source.stop(playAt + duration + 0.05);
}

/**
 * Calculate a smooth ADSR-style envelope value for the tone buffer.
 * @param {number} index Sample index.
 * @param {number} attackFrames Number of frames for the attack portion.
 * @param {number} sustainFrames Number of frames for sustain portion.
 * @param {number} releaseFrames Number of frames for release portion.
 * @returns {number} Envelope value between 0 and 1.
 */
function calculateEnvelopeValue(index, attackFrames, sustainFrames, releaseFrames) {
    if (index < attackFrames) {
        return index / Math.max(1, attackFrames);
    }

    if (index < attackFrames + sustainFrames) {
        return 1;
    }

    const releaseIndex = index - attackFrames - sustainFrames;
    const releaseRatio = 1 - (releaseIndex / Math.max(1, releaseFrames));
    return Math.max(0, releaseRatio);
}

/**
 * Play an encouraging blip with increasing pitch for each correct circle.
 * @param {number} circleNumber The circle index that was just tapped.
 */
async function playClickTone(circleNumber) {
    // Cycle through a cheerful pentatonic scale for consistent harmony.
    const index = (circleNumber - 1) % CLICK_SCALE_FREQUENCIES.length;
    const octaveOffset = Math.floor((circleNumber - 1) / CLICK_SCALE_FREQUENCIES.length);
    const frequency = CLICK_SCALE_FREQUENCIES[index] * Math.pow(2, octaveOffset);
    await playTone(frequency, 0.22);
}

async function playErrorTone() {
    await ensureAudioContext();

    if (!audioContext) {
        return;
    }

    const now = audioContext.currentTime + 0.02;
    await playTone(415.3, 0.16, now, 0.4); // G#4
    await playTone(349.2, 0.2, now + 0.11, 0.4); // F4
    await playTone(261.6, 0.24, now + 0.2, 0.35); // C4
}

/**
 * Play a short cheering arpeggio when the round finishes.
 */
async function playCheerSound() {
    if (!audioContext) {
        await ensureAudioContext();
    }

    if (!audioContext) {
        return;
    }

    const completionUrl = 'sounds/complete.mp3';

    try {
        const response = await fetch(completionUrl, { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error(`Completion audio failed to load: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.65, audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start();
        source.addEventListener('ended', () => {
            source.disconnect();
            gainNode.disconnect();
        });
    } catch (error) {
        console.error('Unable to play completion sound:', error);
    }
}

async function loadAmbienceBuffer() {
    if (ambienceBuffer) {
        return ambienceBuffer;
    }

    const response = await fetch(AMBIENCE_AUDIO_PATH, {
        cache: 'force-cache'
    });

    if (!response.ok) {
        throw new Error(`Ambience audio failed to load: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    ambienceBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return ambienceBuffer;
}

async function startAmbience() {
    await ensureAudioContext();

    if (!audioContext) {
        return;
    }

    if (ambienceSource) {
        return;
    }

    const buffer = await loadAmbienceBuffer();
    ambienceSource = audioContext.createBufferSource();
    ambienceSource.buffer = buffer;
    ambienceSource.loop = true;

    ambienceGain = audioContext.createGain();
    ambienceGain.gain.setValueAtTime(0, audioContext.currentTime);
    ambienceGain.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.8);

    ambienceSource.connect(ambienceGain);
    ambienceGain.connect(audioContext.destination);
    ambienceSource.start();
}

async function stopAmbience() {
    if (!audioContext || !ambienceSource || !ambienceGain) {
        return;
    }

    const now = audioContext.currentTime;
    const release = 0.8;
    ambienceGain.gain.cancelScheduledValues(now);
    ambienceGain.gain.setValueAtTime(ambienceGain.gain.value, now);
    ambienceGain.gain.linearRampToValueAtTime(0.0001, now + release);

    window.setTimeout(() => {
        if (ambienceSource) {
            ambienceSource.stop();
            ambienceSource.disconnect();
            ambienceSource = null;
        }
        if (ambienceGain) {
            ambienceGain.disconnect();
            ambienceGain = null;
        }
    }, release * 1000);
}

/**
 * Format elapsed milliseconds into a friendly seconds.tenths string.
 * @param {number} elapsedMs Milliseconds since the timer started.
 * @returns {string} Formatted time string.
 */
function formatElapsedTime(elapsedMs) {
    const totalSeconds = elapsedMs / 1000;
    const seconds = Math.floor(totalSeconds);
    const tenths = Math.floor((totalSeconds - seconds) * 10);
    return `${seconds.toString().padStart(2, '0')}.${tenths}`;
}

function getCurrentElapsedMs() {
    if (gameStartTimestamp === null) {
        return pausedElapsedMs;
    }
    return performance.now() - gameStartTimestamp;
}

/**
 * Update the timer display based on the current elapsed time.
 */
function updateTimerDisplay() {
    if (!gameRunning || gameStartTimestamp === null || !timerDisplay) {
        return;
    }

    const now = performance.now();
    const elapsedMs = now - gameStartTimestamp;
    timerDisplay.textContent = formatElapsedTime(elapsedMs);
}

/**
 * Start the timer loop that refreshes the display roughly every 100 ms.
 */
function startTimer(offsetMs = 0) {
    stopTimer();
    gameStartTimestamp = performance.now() - offsetMs;
    if (timerDisplay) {
        timerDisplay.textContent = formatElapsedTime(offsetMs);
    }
    timerIntervalId = window.setInterval(updateTimerDisplay, 100);
}

/**
 * Stop the timer loop and freeze the current display.
 */
function stopTimer() {
    if (timerIntervalId !== null) {
        window.clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
}

/**
 * Remove any existing circles from the container.
 */
function clearCircles() {
    if (!circleContainer) {
        return;
    }

    while (circleContainer.firstChild) {
        circleContainer.removeChild(circleContainer.firstChild);
    }
}

/**
 * Randomly place circles within the container without overlapping.
 */
function createCircles() {
    if (!circleContainer) {
        console.error('Circle container element missing.');
        return;
    }

    clearCircles();

    const containerWidth = circleContainer.clientWidth;
    const containerHeight = circleContainer.clientHeight;

    // Circle size matches the CSS clamp rules to simplify overlap detection.
    const minSize = 70;
    const preferredSize = containerWidth * 0.12;
    const maxSize = 96;
    const circleSize = Math.max(minSize, Math.min(preferredSize, maxSize));
    const radius = circleSize / 2;

    const placedCircles = [];

    for (let number = 1; number <= TOTAL_CIRCLES; number += 1) {
        let attempts = 0;
        let positionFound = false;
        let candidateX = 0;
        let candidateY = 0;

        while (attempts < MAX_PLACEMENT_ATTEMPTS && !positionFound) {
            attempts += 1;

            // Random top-left position within the available bounds.
            candidateX = Math.random() * (containerWidth - circleSize);
            candidateY = Math.random() * (containerHeight - circleSize);

            const centreX = candidateX + radius;
            const centreY = candidateY + radius;

            positionFound = placedCircles.every(existing => {
                const distance = Math.hypot(existing.x - centreX, existing.y - centreY);
                return distance >= circleSize + MIN_DISTANCE_BETWEEN_CIRCLES;
            });
        }

        if (!positionFound) {
            // If a suitable position is not found, slightly adjust to avoid infinite loops.
            candidateX = (number * circleSize) % (containerWidth - circleSize);
            candidateY = (number * circleSize) % (containerHeight - circleSize);
        }

        placedCircles.push({ x: candidateX + radius, y: candidateY + radius });

        const circle = document.createElement('button');
        circle.type = 'button';
        circle.className = 'circle';
        circle.style.left = `${candidateX}px`;
        circle.style.top = `${candidateY}px`;
        circle.style.width = `${circleSize}px`;
        circle.style.height = `${circleSize}px`;
        circle.textContent = number.toString();
        circle.dataset.number = number.toString();
        circle.setAttribute('aria-label', ARIA.circle(number));

        circle.addEventListener('click', handleCircleClick);

        circleContainer.appendChild(circle);
    }
}

/**
 * Handle interactions with circles ensuring they are clicked in order.
 * @param {MouseEvent | TouchEvent} event Triggering event.
 */
async function handleCircleClick(event) {
    if (!gameRunning) {
        return;
    }

    const target = event.currentTarget;
    const circleNumber = Number(target.dataset.number);

    if (Number.isNaN(circleNumber)) {
        return;
    }

    if (circleNumber !== nextCircleNumber) {
        // Gentle feedback for out-of-order taps.
        target.classList.add('animate-bounce');
        window.setTimeout(() => {
            target.classList.remove('animate-bounce');
        }, 400);
        try {
            await playErrorTone();
        } catch (error) {
            console.warn('Audio blocked on error tone:', error);
        }
        return;
    }

    target.classList.add('correct');
    target.disabled = true;
    target.style.pointerEvents = 'none';

    try {
        await playClickTone(circleNumber);
    } catch (error) {
        console.warn('Audio blocked on click:', error);
    }

    window.setTimeout(() => {
        target.style.opacity = '0';
        target.style.transform = 'scale(0.6)';
    }, 80);

    if (nextCircleNumber === TOTAL_CIRCLES) {
        finishGame();
        return;
    }

    nextCircleNumber += 1;
}

/**
 * Reset UI elements to prepare for a new game session.
 */
function resetGameUi() {
    if (instructionsText) {
        instructionsText.textContent = DEFAULT_INSTRUCTIONS;
    }
    if (startButton) {
        startButton.textContent = LABELS.start;
        startButton.disabled = false;
    }
    hideCompletionDialog();
}

/**
 * Prepare internal state and UI for a new game.
 */
function startNewGame() {
    ensureDomReferences();

    if (!circleContainer || !timerDisplay) {
        console.error('Game elements missing.');
        return;
    }

    hideCompletionDialog();

    gameRunning = true;
    gamePaused = false;
    pausedElapsedMs = 0;
    nextCircleNumber = 1;
    resetGameUi();
    timerDisplay.textContent = '00.0';
    createCircles();
    startTimer();
    startAmbience().catch(error => {
        console.warn('Unable to start ambience:', error);
    });

    if (!hasStartedAtLeastOnce) {
        hasStartedAtLeastOnce = true;
    }

    if (startButton) {
        startButton.textContent = LABELS.pause;
        startButton.disabled = false;
    }

    if (instructionsText) {
        instructionsText.textContent = DEFAULT_INSTRUCTIONS;
    }
}

function pauseGame() {
    if (!gameRunning) {
        return;
    }

    pausedElapsedMs = getCurrentElapsedMs();
    gameRunning = false;
    gamePaused = true;

    stopTimer();
    stopAmbience().catch(error => {
        console.warn('Unable to stop ambience during pause:', error);
    });

    if (instructionsText) {
        instructionsText.textContent = PAUSED_INSTRUCTIONS;
    }
    if (startButton) {
        startButton.textContent = LABELS.resume;
        startButton.disabled = false;
    }
}

function resumeGame() {
    if (!gamePaused) {
        return;
    }

    gameRunning = true;
    gamePaused = false;

    startTimer(pausedElapsedMs);
    startAmbience().catch(error => {
        console.warn('Unable to start ambience on resume:', error);
    });

    if (instructionsText) {
        instructionsText.textContent = DEFAULT_INSTRUCTIONS;
    }
    if (startButton) {
        startButton.textContent = LABELS.pause;
        startButton.disabled = false;
    }
}

/**
 * Display the friendly completion dialog with next-step options.
 * @param {string} finalTime Text representation of the clear time.
 */
function showCompletionDialog(finalTime) {
    ensureDomReferences();

    if (!completionDialog || !completionDialogTitle || !completionDialogMessage || !retryButton || !backButton) {
        return;
    }

    completionDialogTitle.textContent = DIALOG.title;
    completionDialogMessage.textContent = MESSAGES.success(finalTime);
    retryButton.textContent = DIALOG.retry;
    backButton.textContent = DIALOG.back;
    completionDialog.hidden = false;
}

/**
 * Hide the completion dialog if it is currently visible.
 */
function hideCompletionDialog() {
    ensureDomReferences();

    if (completionDialog) {
        completionDialog.hidden = true;
    }
}

/**
 * Clean up after the player finishes the round.
 */
function finishGame() {
    gameRunning = false;
    gamePaused = false;
    pausedElapsedMs = 0;
    stopTimer();

    const finalTime = timerDisplay ? timerDisplay.textContent : '';
    if (instructionsText) {
        instructionsText.textContent = MESSAGES.success(finalTime);
    }

    playCheerSound().catch(error => {
        console.warn('Audio blocked on finish:', error);
    });
    stopAmbience().catch(error => {
        console.warn('Unable to stop ambience:', error);
    });

    if (startButton) {
        startButton.textContent = LABELS.start;
        startButton.disabled = false;
    }

    showCompletionDialog(finalTime);
}

/**
 * Reset everything and stop the timer.
 */
function resetGameState() {
    ensureDomReferences();

    gameRunning = false;
    gamePaused = false;
    pausedElapsedMs = 0;
    nextCircleNumber = 1;
    stopTimer();
    if (timerDisplay) {
        timerDisplay.textContent = '00.0';
    }
    clearCircles();
    if (instructionsText) {
        instructionsText.textContent = DEFAULT_INSTRUCTIONS;
    }
    hasStartedAtLeastOnce = false;
    if (startButton) {
        startButton.textContent = LABELS.start;
        startButton.disabled = false;
    }
    hideCompletionDialog();
    stopAmbience().catch(error => {
        console.warn('Unable to stop ambience:', error);
    });
}

function handleStartButtonClick() {
    ensureAudioContext().catch(error => {
        console.warn('Unable to start audio context:', error);
    });

    if (gameRunning) {
        pauseGame();
        return;
    }

    if (gamePaused) {
        resumeGame();
        return;
    }

    startNewGame();
}

/**
 * Restart the game when the player chooses "Försök igen".
 */
function handleRetryClick() {
    hideCompletionDialog();
    resetGameState();
}

/**
 * Return to the game list when the player chooses "Tillbaka".
 */
function handleBackClick() {
    hideCompletionDialog();
    window.location.href = '../../index.html';
}

// Ensure game is ready for interaction on load.
window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    attachEventListeners();
    resetGameState();
});

// Resume audio context on first user interaction to satisfy autoplay policies
function handleFirstInteraction() {
    ensureAudioContext().catch(error => {
        console.warn('Unable to resume audio context on interaction:', error);
    });
}

document.addEventListener('pointerdown', handleFirstInteraction, { once: true });
document.addEventListener('keydown', handleFirstInteraction, { once: true });
document.addEventListener('touchstart', handleFirstInteraction, { once: true });
document.addEventListener('mousedown', handleFirstInteraction, { once: true });

