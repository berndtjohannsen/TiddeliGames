 'use strict';

const TOTAL_CIRCLES = 10;
const MIN_DISTANCE_BETWEEN_CIRCLES = 12;
const MAX_PLACEMENT_ATTEMPTS = 80;

const STRINGS = window.GAME_STRINGS;

// DOM references
let titleEl = null;
let instructionsEl = null;
let circleContainer = null;
let completionDialog = null;
let completionTitle = null;
let completionMessage = null;
let continueButton = null;

// Game state
const state = {
    nextCircleNumber: 1,
    gameRunning: false
};

// Audio
let audioContext = null;
let ambienceSource = null;
let ambienceGain = null;
let ambienceBuffer = null;
let ambienceStarted = false;
let ambienceStarting = false;

const AMBIENCE_AUDIO_PATH = 'sounds/background.mp3';
const CLICK_SCALE_FREQUENCIES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77];

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachEventListeners();
    startNewRound();
    // Start background audio immediately
    ensureAudioContext().then(() => {
        requestAmbienceStart();
    }).catch(error => {
        console.warn('Could not start audio context:', error);
    });
});

function cacheDomElements() {
    titleEl = document.getElementById('game-title');
    instructionsEl = document.getElementById('instructions-text');
    circleContainer = document.getElementById('circle-container');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-dialog-title');
    completionMessage = document.getElementById('completion-dialog-message');
    continueButton = document.getElementById('continue-button');
}

function populateStaticTexts() {
    if (titleEl) {
        titleEl.textContent = STRINGS.title;
    }
    if (instructionsEl) {
        instructionsEl.textContent = STRINGS.instructions;
    }
    if (completionTitle) {
        completionTitle.textContent = STRINGS.dialog.title;
    }
    if (completionMessage) {
        completionMessage.textContent = STRINGS.dialog.message;
    }
    if (continueButton) {
        continueButton.textContent = STRINGS.labels.continue;
    }
}

function attachEventListeners() {
    if (continueButton) {
        continueButton.addEventListener('click', handleContinueClick);
    }
    window.addEventListener('volumechange', handleVolumeChange);
}

function handleVolumeChange(event) {
    if (ambienceGain && audioContext && audioContext.state === 'running') {
        const newVolume = event.detail.volume;
        const now = audioContext.currentTime;
        ambienceGain.gain.cancelScheduledValues(now);
        ambienceGain.gain.setValueAtTime(ambienceGain.gain.value, now);
        ambienceGain.gain.linearRampToValueAtTime(newVolume, now + 0.1);
    }
}

function startNewRound() {
    hideCompletionDialog();
    state.nextCircleNumber = 1;
    state.gameRunning = true;
    if (instructionsEl) {
        instructionsEl.textContent = STRINGS.instructions;
    }
    createCircles();
    // Ensure audio context is ready and start background sound
    ensureAudioContext().then(() => {
        requestAmbienceStart();
    }).catch(error => {
        console.warn('Could not start audio context:', error);
    });
}

function clearCircles() {
    if (!circleContainer) return;
    while (circleContainer.firstChild) {
        circleContainer.removeChild(circleContainer.firstChild);
    }
}

function createCircles() {
    if (!circleContainer) {
        console.error('Circle container element missing.');
        return;
    }

    clearCircles();

    const containerWidth = circleContainer.clientWidth;
    const containerHeight = circleContainer.clientHeight;
    const minSize = 70;
    const preferredSize = containerWidth * 0.12;
    const maxSize = 96;
    const circleSize = Math.max(minSize, Math.min(preferredSize, maxSize));
    const radius = circleSize / 2;
    const availableWidth = Math.max(1, containerWidth - circleSize);
    const availableHeight = Math.max(1, containerHeight - circleSize);

    const placedCircles = [];

    for (let number = 1; number <= TOTAL_CIRCLES; number += 1) {
        let attempts = 0;
        let positionFound = false;
        let candidateX = 0;
        let candidateY = 0;

        while (attempts < MAX_PLACEMENT_ATTEMPTS && !positionFound) {
            attempts += 1;
            candidateX = Math.random() * availableWidth;
            candidateY = Math.random() * availableHeight;

            const centreX = candidateX + radius;
            const centreY = candidateY + radius;

            positionFound = placedCircles.every(existing => {
                const distance = Math.hypot(existing.x - centreX, existing.y - centreY);
                return distance >= circleSize + MIN_DISTANCE_BETWEEN_CIRCLES;
            });
        }

        if (!positionFound) {
            candidateX = (number * circleSize) % availableWidth;
            candidateY = (number * circleSize) % availableHeight;
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
        circle.setAttribute('aria-label', STRINGS.aria.circle(number));
        circle.addEventListener('click', handleCircleClick);
        circleContainer.appendChild(circle);
    }
}

async function handleCircleClick(event) {
    if (!state.gameRunning) {
        return;
    }

    const target = event.currentTarget;
    const circleNumber = Number(target.dataset.number);
    if (Number.isNaN(circleNumber)) {
        return;
    }

    if (circleNumber !== state.nextCircleNumber) {
        target.classList.add('animate-bounce');
        setTimeout(() => target.classList.remove('animate-bounce'), 400);
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
    setTimeout(() => {
        target.style.opacity = '0';
        target.style.transform = 'scale(0.6)';
    }, 80);

    try {
        await playClickTone(circleNumber);
    } catch (error) {
        console.warn('Audio blocked on click tone:', error);
    }

    if (state.nextCircleNumber === TOTAL_CIRCLES) {
        finishGame();
        return;
    }

    state.nextCircleNumber += 1;
}

function finishGame() {
    state.gameRunning = false;
    if (instructionsEl) {
        instructionsEl.textContent = STRINGS.messages.success;
    }
    playCheerSound().catch(error => console.warn('Audio blocked on finish:', error));
    stopAmbience().catch(error => console.warn('Unable to stop ambience:', error));
    showCompletionDialog();
}

function showCompletionDialog() {
    if (!completionDialog || !completionTitle || !completionMessage) {
        return;
    }
    completionTitle.textContent = STRINGS.dialog.title;
    completionMessage.textContent = STRINGS.dialog.message;
    completionDialog.hidden = false;
}

function hideCompletionDialog() {
    if (completionDialog) {
        completionDialog.hidden = true;
    }
}

function handleContinueClick() {
    hideCompletionDialog();
    startNewRound();
}

async function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}

async function playTone(frequency, duration = 0.35, startTime = null, relativeVolume = 0.6) {
    await ensureAudioContext();
    if (!audioContext) return;

    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const actualVolume = globalVolume * relativeVolume;
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
    gainNode.gain.setValueAtTime(actualVolume, playAt);
    gainNode.gain.linearRampToValueAtTime(0.0001, playAt + duration);
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(playAt);
    source.stop(playAt + duration + 0.05);
}

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

async function playClickTone(circleNumber) {
    const index = (circleNumber - 1) % CLICK_SCALE_FREQUENCIES.length;
    const octaveOffset = Math.floor((circleNumber - 1) / CLICK_SCALE_FREQUENCIES.length);
    const frequency = CLICK_SCALE_FREQUENCIES[index] * Math.pow(2, octaveOffset);
    await playTone(frequency, 0.22);
}

async function playErrorTone() {
    await ensureAudioContext();
    if (!audioContext) return;

    const now = audioContext.currentTime + 0.02;
    await playTone(415.3, 0.16, now, 0.4);
    await playTone(349.2, 0.2, now + 0.11, 0.4);
    await playTone(261.6, 0.24, now + 0.2, 0.35);
}

async function playCheerSound() {
    await ensureAudioContext();
    if (!audioContext) return;

    try {
        const response = await fetch('sounds/complete.mp3', { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error(`Completion audio failed to load: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        const gainNode = audioContext.createGain();
        const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
        const actualVolume = globalVolume * 0.3;
        gainNode.gain.setValueAtTime(actualVolume, audioContext.currentTime);
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
    const response = await fetch(AMBIENCE_AUDIO_PATH, { cache: 'force-cache' });
    if (!response.ok) {
        throw new Error(`Ambience audio failed to load: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    ambienceBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return ambienceBuffer;
}

async function startAmbience() {
    await ensureAudioContext();
    if (!audioContext || ambienceSource) return;

    const buffer = await loadAmbienceBuffer();
    ambienceSource = audioContext.createBufferSource();
    ambienceSource.buffer = buffer;
    ambienceSource.loop = true;

    ambienceGain = audioContext.createGain();
    const targetVolume = window.TiddeliGamesVolume?.get() ?? 0.25;
    ambienceGain.gain.setValueAtTime(0, audioContext.currentTime);
    ambienceGain.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + 0.8);

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
        ambienceStarted = false;
        ambienceStarting = false;
    }, release * 1000);
}

async function requestAmbienceStart() {
    if (ambienceStarted || ambienceStarting) {
        return;
    }
    ambienceStarting = true;
    try {
        await startAmbience();
        if (audioContext && audioContext.state === 'running' && ambienceSource) {
            ambienceStarted = true;
        }
    } catch (error) {
        console.warn('Unable to start ambience yet:', error);
    } finally {
        ambienceStarting = false;
    }
}

// Attempt to start audio on first interaction (for browsers that block autoplay)
function handleFirstInteraction() {
    ensureAudioContext()
        .then(() => {
            requestAmbienceStart();
        })
        .catch(error => {
            console.warn('Unable to resume audio context on interaction:', error);
        });
}

['pointerdown', 'touchstart', 'keydown'].forEach(eventName => {
    document.addEventListener(eventName, handleFirstInteraction, { once: true });
});

