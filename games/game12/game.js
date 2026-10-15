// Match Words Game (Game 12) – drag word tiles onto matching emoji images
'use strict';

const STRINGS = window.GAME12_STRINGS || {};
const GAME12_ASSETS = window.TiddeliAssets;
const WORD_PAIRS = Array.isArray(STRINGS.wordPairs) ? STRINGS.wordPairs.slice() : [];
const PAIRS_PER_ROUND = 4;
// Stagger float phases so targets do not wiggle in sync (same idea as game 2)
const FLOAT_PHASE_MULTIPLIER = 0.4;
const FLOAT_PHASE_MAX = 3;

function resolveGame12Asset(path) {
    if (!path) return '';
    if (GAME12_ASSETS && typeof GAME12_ASSETS.resolveGameAsset === 'function') {
        return GAME12_ASSETS.resolveGameAsset('game12', path);
    }
    return path;
}

let titleEl = null;
let instructionsEl = null;
let targetsContainer = null;
let wordsContainer = null;
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

const state = {
    pairs: [], // { emoji, word, targetEl, wordEl, matched, wordStartX, wordStartY }
    matchedCount: 0,
    activePointerId: null,
    activeWord: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    wordInitialX: 0,
    wordInitialY: 0,
    dragSoundSource: null,
    dragSoundGain: null,
    lastPointerX: null,
    lastPointerY: null,
    lastPointerTime: null,
    audioStarted: false,
    audioStarting: false
};

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachEventListeners();
    startNewRound();
    requestBackgroundAudioStart();
});

/**
 * Caches DOM nodes and sets the game field background image.
 */
function cacheDomElements() {
    titleEl = document.getElementById('game12-title');
    instructionsEl = document.getElementById('instructions-text');
    targetsContainer = document.getElementById('targets-container');
    wordsContainer = document.getElementById('words-container');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
    dialogBackButton = document.getElementById('dialog-back-button');

    const gameField = document.getElementById('game12-field');
    if (gameField) {
        const bgUrl = resolveGame12Asset('images/background.webp');
        gameField.style.backgroundImage =
            `linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.15)), url('${bgUrl}')`;
    }
}

function populateStaticTexts() {
    if (titleEl) titleEl.textContent = STRINGS.title || '';
    if (instructionsEl) instructionsEl.textContent = STRINGS.instructions || '';
    if (continueButton) continueButton.textContent = (STRINGS.labels && STRINGS.labels.continue) || 'Fortsätt';
    if (dialogBackButton) dialogBackButton.textContent = (STRINGS.labels && STRINGS.labels.back) || 'Tillbaka';
    if (completionTitle) completionTitle.textContent = (STRINGS.dialog && STRINGS.dialog.title) || '';
    if (completionMessage) completionMessage.textContent = (STRINGS.dialog && STRINGS.dialog.message) || '';
}

function attachEventListeners() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('volumechange', handleVolumeChange);
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
        document.addEventListener(eventName, handleFirstInteraction, { once: true });
    });
    if (continueButton) continueButton.addEventListener('click', handleContinueClick);
    if (dialogBackButton) dialogBackButton.addEventListener('click', handleDialogBackClick);
}

/**
 * Starts a round with 4 emoji targets and 4 shuffled word tiles.
 */
function startNewRound() {
    hideCompletionDialog();
    if (WORD_PAIRS.length < PAIRS_PER_ROUND) {
        console.error('Not enough word pairs for game12');
        return;
    }

    state.pairs = [];
    state.matchedCount = 0;
    state.activePointerId = null;
    state.activeWord = null;
    stopDragSound();

    if (targetsContainer) targetsContainer.innerHTML = '';
    if (wordsContainer) wordsContainer.innerHTML = '';

    const selected = shuffleArray(WORD_PAIRS.slice()).slice(0, PAIRS_PER_ROUND);
    const wordsOrder = shuffleArray(selected.slice());

    selected.forEach((pairData, index) => {
        const targetEl = document.createElement('div');
        targetEl.className = 'game12-target';
        targetEl.setAttribute('data-word', pairData.word);
        targetEl.setAttribute(
            'aria-label',
            STRINGS.aria && STRINGS.aria.image ? STRINGS.aria.image(pairData.word) : pairData.word
        );
        // Unique delay so each target floats independently
        const floatPhase = (index * FLOAT_PHASE_MULTIPLIER) % FLOAT_PHASE_MAX;
        targetEl.style.setProperty('--float-phase', floatPhase);

        const emojiEl = document.createElement('div');
        emojiEl.className = 'game12-target-emoji';
        emojiEl.textContent = pairData.emoji;

        const labelEl = document.createElement('div');
        labelEl.className = 'game12-target-word';
        labelEl.textContent = '';

        targetEl.appendChild(emojiEl);
        targetEl.appendChild(labelEl);
        if (targetsContainer) targetsContainer.appendChild(targetEl);

        state.pairs.push({
            emoji: pairData.emoji,
            word: pairData.word,
            targetEl,
            labelEl,
            wordEl: null,
            matched: false,
            wordStartX: 0,
            wordStartY: 0
        });
    });

    wordsOrder.forEach((pairData) => {
        const pair = state.pairs.find((p) => p.word === pairData.word);
        if (!pair) return;

        const wordEl = document.createElement('button');
        wordEl.type = 'button';
        wordEl.className = 'game12-word';
        wordEl.textContent = pairData.word;
        wordEl.setAttribute('data-word', pairData.word);
        wordEl.setAttribute(
            'aria-label',
            STRINGS.aria && STRINGS.aria.word ? STRINGS.aria.word(pairData.word) : pairData.word
        );
        wordEl.addEventListener('pointerdown', handleWordPointerDown);
        if (wordsContainer) wordsContainer.appendChild(wordEl);
        pair.wordEl = wordEl;
    });

    // Capture starting positions after layout
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            state.pairs.forEach((pair) => {
                if (!pair.wordEl) return;
                pair.wordStartX = 0;
                pair.wordStartY = 0;
                pair.wordEl.style.transform = 'translate(0px, 0px)';
            });
        });
    });
}

/**
 * Starts drag on a word tile (same synthetic drag sound approach as game11).
 */
function handleWordPointerDown(event) {
    const wordEl = event.currentTarget;
    if (state.activePointerId !== null) return;

    const pair = state.pairs.find((p) => p.wordEl === wordEl);
    if (!pair || pair.matched) return;

    requestBackgroundAudioStart();
    startDragSound().catch((error) => {
        console.warn('Could not start drag sound:', error);
    });

    state.activePointerId = event.pointerId;
    state.activeWord = wordEl;
    wordEl.setPointerCapture(event.pointerId);
    wordEl.classList.add('game12-word--dragging');

    const rect = wordEl.getBoundingClientRect();
    state.wordInitialX = getCurrentTranslateX(wordEl);
    state.wordInitialY = getCurrentTranslateY(wordEl);
    state.dragOffsetX = event.clientX - (rect.left + rect.width / 2);
    state.dragOffsetY = event.clientY - (rect.top + rect.height / 2);
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.lastPointerTime = performance.now();

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUpOrCancel);
    window.addEventListener('pointercancel', handlePointerUpOrCancel);
}

function handlePointerMove(event) {
    if (state.activePointerId !== event.pointerId || !state.activeWord) return;

    const wordEl = state.activeWord;
    const rect = wordEl.getBoundingClientRect();
    const x = event.clientX - state.dragOffsetX;
    const y = event.clientY - state.dragOffsetY;
    const centerX = x - rect.width / 2;
    const centerY = y - rect.height / 2;
    const deltaX = centerX - (rect.left - getCurrentTranslateX(wordEl));
    const deltaY = centerY - (rect.top - getCurrentTranslateY(wordEl));
    const newX = state.wordInitialX + deltaX;
    const newY = state.wordInitialY + deltaY;
    wordEl.style.transform = `translate(${newX}px, ${newY}px)`;

    // Highlight target under the word
    const under = findTargetUnderPoint(event.clientX, event.clientY);
    state.pairs.forEach((p) => {
        if (!p.matched && p.targetEl) {
            p.targetEl.classList.toggle('game12-target--hover', p.targetEl === under);
        }
    });

    // Pitch drag sound with movement speed (same idea as game11)
    if (state.dragSoundSource && state.lastPointerX !== null && state.lastPointerTime !== null) {
        const now = performance.now();
        const dt = now - state.lastPointerTime;
        if (dt > 0) {
            const dx = event.clientX - state.lastPointerX;
            const dy = event.clientY - state.lastPointerY;
            const speed = Math.sqrt(dx * dx + dy * dy) / dt;
            const targetFreq = 500 + (1400 - 500) * Math.min(speed, 1.0);
            try {
                if (audioContext && audioContext.state === 'running') {
                    state.dragSoundSource.frequency.cancelScheduledValues(audioContext.currentTime);
                    state.dragSoundSource.frequency.linearRampToValueAtTime(
                        targetFreq,
                        audioContext.currentTime + 0.05
                    );
                }
            } catch (_) {
                // ignore
            }
        }
    }

    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.lastPointerTime = performance.now();
}

function handlePointerUpOrCancel(event) {
    if (state.activePointerId !== event.pointerId || !state.activeWord) return;

    const wordEl = state.activeWord;
    stopDragSound();
    try {
        wordEl.releasePointerCapture(event.pointerId);
    } catch (_) {
        // ignore
    }
    wordEl.classList.remove('game12-word--dragging');
    state.pairs.forEach((p) => p.targetEl && p.targetEl.classList.remove('game12-target--hover'));

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUpOrCancel);
    window.removeEventListener('pointercancel', handlePointerUpOrCancel);

    const pair = state.pairs.find((p) => p.wordEl === wordEl);
    const targetEl = findTargetUnderPoint(event.clientX, event.clientY);
    const targetPair = state.pairs.find((p) => p.targetEl === targetEl);

    if (pair && targetPair && !targetPair.matched && pair.word === targetPair.word) {
        snapWordToTarget(pair, targetPair);
    } else {
        playDropErrorSound().catch((error) => {
            console.warn('Could not play drop error sound:', error);
        });
        resetWordPosition(wordEl, pair);
    }

    state.activePointerId = null;
    state.activeWord = null;
}

/**
 * Finds an unmatched target element under the given screen point.
 */
function findTargetUnderPoint(x, y) {
    for (const pair of state.pairs) {
        if (pair.matched || !pair.targetEl) continue;
        const rect = pair.targetEl.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return pair.targetEl;
        }
    }
    return null;
}

function resetWordPosition(wordEl, pair) {
    const info = pair || state.pairs.find((p) => p.wordEl === wordEl);
    if (!info || !wordEl) return;
    wordEl.style.transition = 'transform 200ms ease';
    wordEl.style.transform = `translate(${info.wordStartX}px, ${info.wordStartY}px)`;
    setTimeout(() => {
        wordEl.style.transition = '';
    }, 220);
}

/**
 * Snaps a word onto its matching target and marks the pair complete.
 */
function snapWordToTarget(wordPair, targetPair) {
    const wordEl = wordPair.wordEl;
    const targetEl = targetPair.targetEl;
    if (!wordEl || !targetEl) return;

    const wordRect = wordEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const deltaX = targetRect.left + targetRect.width / 2 - (wordRect.left + wordRect.width / 2);
    const deltaY = targetRect.top + targetRect.height / 2 - (wordRect.top + wordRect.height / 2);
    const newX = getCurrentTranslateX(wordEl) + deltaX;
    const newY = getCurrentTranslateY(wordEl) + deltaY;

    wordEl.style.transition = 'transform 200ms ease, opacity 200ms ease';
    wordEl.style.transform = `translate(${newX}px, ${newY}px)`;

    targetPair.matched = true;
    wordPair.matched = true;
    targetEl.classList.add('game12-target--matched');
    if (targetPair.labelEl) {
        targetPair.labelEl.textContent = targetPair.word;
    }

    setTimeout(() => {
        wordEl.classList.add('game12-word--matched');
    }, 180);

    playPlacementSuccessSound().catch((error) => {
        console.warn('Could not play placement success sound:', error);
    });

    state.matchedCount += 1;
    if (state.matchedCount >= state.pairs.length) {
        setTimeout(() => showCompletionDialog(), 350);
    }
}

function getCurrentTranslateX(el) {
    const matrix = window.getComputedStyle(el).transform;
    if (!matrix || matrix === 'none') return 0;
    const parts = matrix.match(/matrix\(([^)]+)\)/);
    if (!parts) return 0;
    return Number(parts[1].split(',')[4]) || 0;
}

function getCurrentTranslateY(el) {
    const matrix = window.getComputedStyle(el).transform;
    if (!matrix || matrix === 'none') return 0;
    const parts = matrix.match(/matrix\(([^)]+)\)/);
    if (!parts) return 0;
    return Number(parts[1].split(',')[5]) || 0;
}

function shuffleArray(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/* --- Drag/drop sounds copied from game11 approach --- */

async function startDragSound() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    stopDragSound();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650 + Math.random() * 200, audioContext.currentTime);
    const baseVolume = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.25;
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(baseVolume, audioContext.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    state.dragSoundSource = osc;
    state.dragSoundGain = gain;
}

function stopDragSound() {
    const osc = state.dragSoundSource;
    const gain = state.dragSoundGain;
    state.dragSoundSource = null;
    state.dragSoundGain = null;
    state.lastPointerX = null;
    state.lastPointerY = null;
    state.lastPointerTime = null;
    if (!audioContext || !osc || !gain) return;
    try {
        const now = audioContext.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.08);
        osc.stop(now + 0.1);
    } catch (_) {
        try {
            osc.stop();
        } catch (_) {
            // ignore
        }
    }
}

async function playDropErrorSound() {
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

async function playPlacementSuccessSound() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;

    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const osc3 = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'triangle';
    const now = audioContext.currentTime;
    const duration = 0.5;
    const baseVolume = (window.TiddeliGamesVolume?.get() ?? 0.35) * 0.6;
    osc1.frequency.setValueAtTime(660, now);
    osc1.frequency.linearRampToValueAtTime(880, now + duration);
    osc2.frequency.setValueAtTime(825, now);
    osc2.frequency.linearRampToValueAtTime(1180, now + duration);
    osc3.frequency.setValueAtTime(990, now);
    osc3.frequency.linearRampToValueAtTime(1320, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(baseVolume, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    gain.connect(audioContext.destination);
    osc1.start(now);
    osc2.start(now);
    osc3.start(now + 0.04);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
    osc3.stop(now + duration + 0.08);
}

/**
 * Stops the background ambience track if it is playing.
 */
function stopBackgroundAmbience() {
    if (backgroundSource) {
        try {
            backgroundSource.stop();
        } catch (error) {
            // Already stopped
        }
        try {
            backgroundSource.disconnect();
        } catch (error) {
            // Already disconnected
        }
        backgroundSource = null;
    }
    if (backgroundGain) {
        try {
            backgroundGain.disconnect();
        } catch (error) {
            // Already disconnected
        }
        backgroundGain = null;
    }
    state.audioStarted = false;
    state.audioStarting = false;
}

function showCompletionDialog() {
    if (!completionDialog) return;

    // Stop background music so the completion moment is clear
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
    // Restart ambience after it was stopped for the completion dialog
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
            console.warn('Could not start ambience:', error);
        })
        .finally(() => {
            state.audioStarting = false;
        });
}

function handleFirstInteraction() {
    requestBackgroundAudioStart();
}

async function startBackgroundAmbience() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    const rawPath = STRINGS.ambience && STRINGS.ambience.track;
    if (!rawPath) return;

    const ambiencePath = resolveGame12Asset(rawPath);
    try {
        if (audioBufferCache.has(ambiencePath)) {
            backgroundBuffer = audioBufferCache.get(ambiencePath);
        } else {
            const response = await fetch(ambiencePath);
            const arrayBuffer = await response.arrayBuffer();
            backgroundBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBufferCache.set(ambiencePath, backgroundBuffer);
        }
        if (backgroundBuffer) {
            if (backgroundSource) {
                try {
                    backgroundSource.stop();
                } catch (_) {
                    // ignore
                }
            }
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

function handleVolumeChange(event) {
    if (backgroundGain && audioContext && audioContext.state === 'running') {
        const newVolume = event.detail && typeof event.detail.volume === 'number'
            ? event.detail.volume
            : window.TiddeliGamesVolume?.get() ?? 0.35;
        backgroundGain.gain.setValueAtTime(newVolume, audioContext.currentTime);
    }
}

function handleVisibilityChange() {
    if (!audioContext) return;
    if (document.hidden) {
        if (audioContext.state === 'running') {
            audioContext.suspend().catch(() => {});
        }
    } else if (state.audioStarted) {
        audioContext.resume().catch(() => {});
    }
}
