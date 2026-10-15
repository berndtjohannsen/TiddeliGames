// Var står det? (Game 14) – hear spoken word, tap the matching written word
'use strict';

const STRINGS = window.GAME14_STRINGS || {};
const GAME14_ASSETS = window.TiddeliAssets;
const WORDS = Array.isArray(STRINGS.words) ? STRINGS.words.slice() : [];
const NUM_OPTIONS = 4;

function resolveGame14Asset(path) {
    if (!path) return '';
    if (GAME14_ASSETS && typeof GAME14_ASSETS.resolveGameAsset === 'function') {
        return GAME14_ASSETS.resolveGameAsset('game14', path);
    }
    return path;
}

let titleEl = null;
let instructionsEl = null;
let answerButtonsContainer = null;
let listenButton = null;
let listenLabelEl = null;
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
/** Tracks the active spoken-prompt source so replay can cancel it */
let promptSource = null;
/** Resolves the in-flight playBufferUrl promise when playback is stopped early */
let promptPlaybackResolve = null;

const state = {
    targetWord: null, // { id, label, sound } — current word to find
    options: [], // remaining word objects this round (starts at 4)
    answerButtons: [],
    audioStarted: false,
    audioStarting: false,
    promptPlaying: false, // true while intro+word sequence is active (listen UI)
    roundComplete: false // true when all four words have been found
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
    titleEl = document.getElementById('game14-title');
    instructionsEl = document.getElementById('instructions-text');
    answerButtonsContainer = document.getElementById('answer-buttons');
    listenButton = document.getElementById('listen-button');
    listenLabelEl = document.getElementById('listen-label');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
    dialogBackButton = document.getElementById('dialog-back-button');

    const gameField = document.getElementById('game14-field');
    if (gameField) {
        const bgUrl = resolveGame14Asset('images/background.webp');
        gameField.style.backgroundImage =
            `linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.18)), url('${bgUrl}')`;
    }
}

function populateStaticTexts() {
    if (titleEl) titleEl.textContent = STRINGS.title || '';
    if (instructionsEl) instructionsEl.textContent = STRINGS.instructions || '';
    if (continueButton) continueButton.textContent = (STRINGS.labels && STRINGS.labels.continue) || 'Fortsätt';
    if (dialogBackButton) dialogBackButton.textContent = (STRINGS.labels && STRINGS.labels.back) || 'Tillbaka';
    if (completionTitle) completionTitle.textContent = (STRINGS.dialog && STRINGS.dialog.title) || '';
    if (completionMessage) completionMessage.textContent = (STRINGS.dialog && STRINGS.dialog.message) || '';
    if (listenLabelEl) listenLabelEl.textContent = (STRINGS.labels && STRINGS.labels.listen) || 'Lyssna igen';
    if (listenButton && STRINGS.aria && STRINGS.aria.listen) {
        listenButton.setAttribute('aria-label', STRINGS.aria.listen);
    }
}

function attachEventListeners() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('volumechange', handleVolumeChange);
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
        document.addEventListener(eventName, handleFirstInteraction, { once: true });
    });
    if (continueButton) continueButton.addEventListener('click', handleContinueClick);
    if (dialogBackButton) dialogBackButton.addEventListener('click', handleDialogBackClick);
    if (listenButton) listenButton.addEventListener('click', handleListenClick);
}

/**
 * Starts a new round: four written words; find them one by one until none remain.
 */
function startNewRound() {
    hideCompletionDialog();
    stopPromptPlayback();
    state.roundComplete = false;
    state.promptPlaying = false;
    state.answerButtons = [];

    if (WORDS.length < NUM_OPTIONS) {
        console.error('Not enough words configured for game14');
        return;
    }

    const shuffled = shuffleArray(WORDS);
    state.options = shuffleArray(shuffled.slice(0, NUM_OPTIONS));
    // First target is one of the four on screen
    state.targetWord = state.options[Math.floor(Math.random() * state.options.length)];

    if (answerButtonsContainer) {
        answerButtonsContainer.innerHTML = '';
        state.options.forEach((word) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'game14-answer';
            button.textContent = word.label;
            button.dataset.wordId = word.id;
            button.setAttribute(
                'aria-label',
                STRINGS.aria && STRINGS.aria.word ? STRINGS.aria.word(word.label) : word.label
            );
            button.addEventListener('click', () => handleAnswerClick(word, button));
            answerButtonsContainer.appendChild(button);
            state.answerButtons.push(button);
        });
    }

    setAnswersEnabled(false);
    // Auto-play prompt once audio is allowed (first gesture or later rounds)
    playSpokenPrompt().catch((error) => {
        console.warn('Could not auto-play spoken prompt:', error);
        setAnswersEnabled(true);
    });
}

/**
 * Handles tap on a written word option.
 * Correct: hide that word in place, then ask for another until all four are found.
 * Allowed as soon as the target word starts speaking (buttons are enabled then).
 */
async function handleAnswerClick(word, button) {
    if (state.roundComplete || button.disabled || !state.targetWord) return;

    requestBackgroundAudioStart();
    await ensureAudioContext();

    if (word.id === state.targetWord.id) {
        setAnswersEnabled(false);
        // Cut any remaining spoken audio while we clear the found word
        stopPromptPlayback();
        button.classList.add('game14-answer--correct');
        button.disabled = true;

        // Brief flash, then hide in place so remaining words keep their positions
        await new Promise((resolve) => setTimeout(resolve, 380));
        button.classList.add('game14-answer--removed');
        state.options = state.options.filter((w) => w.id !== word.id);
        state.answerButtons = state.answerButtons.filter((b) => b !== button);

        if (state.options.length === 0) {
            state.roundComplete = true;
            state.targetWord = null;
            showCompletionDialog();
            return;
        }

        // Pick the next word among those still on screen and ask again
        state.targetWord = state.options[Math.floor(Math.random() * state.options.length)];
        try {
            await playSpokenPrompt();
        } catch (error) {
            console.warn('Could not play next spoken prompt:', error);
            setAnswersEnabled(true);
        }
    } else {
        button.classList.add('game14-answer--wrong');
        playErrorSound().catch((error) => {
            console.warn('Could not play error sound:', error);
        });
        setTimeout(() => {
            button.classList.remove('game14-answer--wrong');
        }, 400);
    }
}

/**
 * Replay button – play “Var står det” + current target word again.
 */
async function handleListenClick() {
    if (state.roundComplete) return;
    requestBackgroundAudioStart();
    try {
        await playSpokenPrompt();
    } catch (error) {
        console.warn('Could not replay spoken prompt:', error);
        setAnswersEnabled(true);
    }
}

/**
 * Plays the intro phrase, then the target word.
 * Answers stay locked only during “Var står det”; they unlock when the word starts
 * so the child can tap as soon as they hear it.
 */
async function playSpokenPrompt() {
    if (!state.targetWord) return;
    // Claim the lock before any await so two callers cannot start overlapping plays
    if (state.promptPlaying) return;
    state.promptPlaying = true;

    setAnswersEnabled(false);
    if (listenButton) {
        listenButton.disabled = true;
        listenButton.classList.add('game14-listen--playing');
    }

    try {
        await ensureAudioContext();
        if (!audioContext || audioContext.state !== 'running') {
            // Keep answers locked; first user gesture will retry via handleFirstInteraction
            return;
        }

        const promptPath = resolveGame14Asset(STRINGS.promptSound || 'sounds/VarStarDet.mp3');
        const wordPath = resolveGame14Asset(state.targetWord.sound);
        await playBufferUrl(promptPath);
        // Round finished (or word removed) while we were waiting — stop here
        if (state.roundComplete || !state.targetWord) return;
        // Unlock as soon as the target word begins (not after it ends)
        setAnswersEnabled(true);
        await playBufferUrl(wordPath);
    } finally {
        state.promptPlaying = false;
        if (listenButton) {
            listenButton.disabled = false;
            listenButton.classList.remove('game14-listen--playing');
        }
        // Re-enable answers after a successful speech run; if audio is still locked
        // by the browser, keep them disabled until a gesture retries the prompt.
        if (!state.roundComplete && state.targetWord && audioContext && audioContext.state === 'running') {
            setAnswersEnabled(true);
        }
    }
}

/**
 * Loads (cached) and plays one audio URL; resolves when playback ends or is stopped.
 * @param {string} url
 * @returns {Promise<void>}
 */
async function playBufferUrl(url) {
    const buffer = await loadAudioBuffer(url);
    if (!buffer || !audioContext) return;

    return new Promise((resolve) => {
        stopPromptPlayback();
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        // Spoken prompt a bit louder than ambience
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
        } catch (error) {
            promptSource = null;
            promptPlaybackResolve = null;
            resolve();
        }
    });
}

/**
 * Stops any in-progress spoken prompt playback and settles its awaiter.
 */
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
}

function setAnswersEnabled(enabled) {
    state.answerButtons.forEach((btn) => {
        btn.disabled = !enabled;
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

/**
 * Loads and caches an AudioBuffer for a URL.
 * @param {string} url
 * @returns {Promise<AudioBuffer|null>}
 */
async function loadAudioBuffer(url) {
    if (!url) return null;
    if (audioBufferCache.has(url)) {
        return audioBufferCache.get(url);
    }
    await ensureAudioContext();
    if (!audioContext) return null;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferCache.set(url, buffer);
        return buffer;
    } catch (error) {
        console.warn('Could not load audio:', url, error);
        return null;
    }
}

async function playErrorSound() {
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
            console.warn('Could not start ambience:', error);
        })
        .finally(() => {
            state.audioStarting = false;
        });
}

/**
 * First user gesture unlocks Web Audio. Retries the spoken prompt if it could not
 * autoplay on load. Must not restart the prompt when the gesture is an answer tap
 * (that race disabled the buttons and swallowed the correct answer).
 */
function handleFirstInteraction(event) {
    requestBackgroundAudioStart();

    const target = event && event.target;
    const tappedAnswer = target && typeof target.closest === 'function'
        && target.closest('.game14-answer');
    if (tappedAnswer) {
        return;
    }

    // Retry prompt after audio unlock (load-time autoplay usually fails until now)
    if (!state.roundComplete && state.targetWord && !state.promptPlaying) {
        playSpokenPrompt().catch((error) => {
            console.warn('Could not play spoken prompt after first gesture:', error);
        });
    }
}

async function startBackgroundAmbience() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    const rawPath = STRINGS.ambience && STRINGS.ambience.track;
    if (!rawPath) return;

    const ambiencePath = resolveGame14Asset(rawPath);
    try {
        const buffer = await loadAudioBuffer(ambiencePath);
        if (!buffer) return;
        backgroundBuffer = buffer;
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
        // Keep ambience quieter under spoken prompts
        backgroundGain.gain.setValueAtTime(globalVolume * 0.45, audioContext.currentTime);
        backgroundSource.connect(backgroundGain);
        backgroundGain.connect(audioContext.destination);
        backgroundSource.start(0);
    } catch (error) {
        console.warn('Could not start background ambience:', error);
    }
}

function handleVolumeChange(event) {
    if (backgroundGain && audioContext && audioContext.state === 'running') {
        const newVolume = event.detail && typeof event.detail.volume === 'number'
            ? event.detail.volume
            : window.TiddeliGamesVolume?.get() ?? 0.35;
        backgroundGain.gain.setValueAtTime(newVolume * 0.45, audioContext.currentTime);
    }
}

function handleVisibilityChange() {
    if (!audioContext) return;
    if (document.hidden) {
        stopPromptPlayback();
        if (audioContext.state === 'running') {
            audioContext.suspend().catch(() => {});
        }
    } else if (state.audioStarted) {
        audioContext.resume().catch(() => {});
    }
}
