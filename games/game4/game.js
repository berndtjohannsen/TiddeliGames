// Spelling Game (Game 4) – simplified: 1 emoji with 4 word choices
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME4_STRINGS;
const WORD_PAIRS = Array.isArray(STRINGS.wordPairs) ? STRINGS.wordPairs.slice() : [];
const NUM_WORD_OPTIONS = 4; // Number of word options to show (1 correct + 3 wrong)

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let emojiContainer = null;
let wordsContainer = null;
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
    currentPair: null, // Current emoji-word pair
    wrongOptions: [], // Array of 3 wrong word options
    wordButtons: [], // Array of word button elements
    audioStarted: false, // Track if ambience has successfully started
    audioStarting: false, // Prevent concurrent start attempts
    wrongAnswerTimeout: null, // Timeout ID for wrong answer feedback
    answerProcessing: false // Prevent rapid clicks from causing race conditions
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
    titleEl = document.getElementById('game4-title');
    instructionsEl = document.getElementById('instructions-text');
    emojiContainer = document.getElementById('images-container');
    wordsContainer = document.getElementById('words-container');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
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
 * Attaches all event listeners for buttons and window events.
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
 * Starts a new round by selecting 1 random emoji and 4 word options.
 */
function startNewRound() {
    if (WORD_PAIRS.length < NUM_WORD_OPTIONS) {
        console.error('Not enough word pairs defined');
        return;
    }

    // Reset state
    state.currentPair = null;
    state.wrongOptions = [];
    state.wordButtons = [];
    state.answerProcessing = false;
    
    // Cancel any pending wrong answer timeout
    if (state.wrongAnswerTimeout) {
        clearTimeout(state.wrongAnswerTimeout);
        state.wrongAnswerTimeout = null;
    }

    // Clear containers
    if (emojiContainer) {
        emojiContainer.innerHTML = '';
    }
    if (wordsContainer) {
        wordsContainer.innerHTML = '';
    }

    // Select 1 random pair for the emoji
    const shuffled = shuffleArray(WORD_PAIRS.slice());
    state.currentPair = shuffled[0];

    // Select 3 wrong options from remaining pairs
    const remainingPairs = shuffled.slice(1);
    const shuffledRemaining = shuffleArray(remainingPairs.slice());
    state.wrongOptions = shuffledRemaining.slice(0, NUM_WORD_OPTIONS - 1);

    // Create emoji display
    const emojiElement = document.createElement('div');
    emojiElement.className = 'game4-emoji';
    emojiElement.textContent = state.currentPair.emoji;
    emojiElement.setAttribute('aria-label', STRINGS.aria.image(state.currentPair.word));
    if (emojiContainer) {
        emojiContainer.appendChild(emojiElement);
    }

    // Create word buttons: 1 correct + 3 wrong (shuffled)
    const allWordOptions = [
        { word: state.currentPair.word, isCorrect: true },
        ...state.wrongOptions.map(pair => ({ word: pair.word, isCorrect: false }))
    ];
    const shuffledWords = shuffleArray(allWordOptions);
    
    shuffledWords.forEach((option, index) => {
        const wordBtn = createWordButton(option.word, option.isCorrect, index);
        state.wordButtons.push(wordBtn);
        if (wordsContainer) {
            wordsContainer.appendChild(wordBtn);
        }
    });

    hideCompletionDialog();
}

/**
 * Creates a word button element.
 * @param {string} word - The word text
 * @param {boolean} isCorrect - Whether this is the correct answer
 * @param {number} index - Index of the button
 * @returns {HTMLElement} Word button element
 */
function createWordButton(word, isCorrect, index) {
    const button = document.createElement('button');
    button.className = 'game4-word';
    button.textContent = word;
    button.setAttribute('data-word', word);
    button.setAttribute('data-correct', isCorrect.toString());
    button.setAttribute('data-index', index);
    button.setAttribute('aria-label', STRINGS.aria.word(word));
    button.setAttribute('type', 'button');
    
    button.addEventListener('click', () => handleWordClick(button, isCorrect));
    
    return button;
}

/**
 * Handles click on a word button.
 * @param {HTMLElement} wordButton - The clicked word button
 * @param {boolean} isCorrect - Whether this is the correct answer
 */
async function handleWordClick(wordButton, isCorrect) {
    // Prevent rapid clicks from causing race conditions
    if (state.answerProcessing) {
        return;
    }
    state.answerProcessing = true;
    
    // Ensure audio context is running before playing any sounds
    await ensureAudioContext();
    if (audioContext && audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Could not resume AudioContext:', error);
        }
    }
    
    // Disable all buttons
    state.wordButtons.forEach(btn => {
        btn.classList.add('game4-word--disabled');
    });
    
    if (isCorrect) {
        // Correct answer - show feedback, show dialog, and play sound
        wordButton.classList.add('game4-word--correct');
        // Show dialog (which will play the completion sound)
        showCompletionDialog();
        // Note: answerProcessing flag will be reset when continue is clicked and new round starts
    } else {
        // Wrong answer - show feedback and play error sound
        wordButton.classList.add('game4-word--wrong');
        // Play error sound
        playErrorSound().catch(error => {
            console.warn('Could not play error sound:', error);
        });
        
        // Cancel any existing wrong answer timeout
        if (state.wrongAnswerTimeout) {
            clearTimeout(state.wrongAnswerTimeout);
        }
        
        // Store timeout ID so we can cancel it if a new round starts
        state.wrongAnswerTimeout = setTimeout(() => {
            state.wrongAnswerTimeout = null;
            
            // Check if button still exists in DOM before manipulating it
            if (wordButton.isConnected && wordsContainer && wordsContainer.contains(wordButton)) {
                wordButton.classList.remove('game4-word--wrong');
            }
            
            // Re-enable all buttons that still exist
            const buttonsToEnable = [...state.wordButtons];
            buttonsToEnable.forEach(btn => {
                if (btn.isConnected && wordsContainer && wordsContainer.contains(btn)) {
                    btn.classList.remove('game4-word--disabled');
                }
            });
            
            // Reset processing flag after timeout completes
            state.answerProcessing = false;
        }, 800);
    }
}

/**
 * Shows the completion dialog and plays the completion sound.
 */
function showCompletionDialog() {
    if (!completionDialog) {
        return;
    }
    completionDialog.hidden = false;
    
    // Play completion sound - using shared completion sound function
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
 * Handles the continue button click - starts a new round.
 */
function handleContinueClick() {
    hideCompletionDialog();
    state.answerProcessing = false; // Reset processing flag
    startNewRound();
}

/**
 * Shuffles an array using Fisher-Yates algorithm.
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
    const shuffled = array.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Plays a success sound (audio file if available, otherwise synthetic).
 * @returns {Promise} Promise that resolves when sound finishes
 */
// Removed playSuccessSound() - now using shared completion sound function from js/audio.js

/**
 * Plays an error sound (audio file if available, otherwise synthetic).
 * @returns {Promise} Promise that resolves when sound finishes
 */
async function playErrorSound() {
    await ensureAudioContext();

    if (!audioContext) {
        return Promise.resolve();
    }

    if (audioContext.state !== 'running') {
        try {
            await audioContext.resume();
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
            return Promise.resolve();
        }
    }

    if (audioContext.state !== 'running') {
        return Promise.resolve();
    }

    // Play synthetic error sound
    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const actualVolume = globalVolume * 0.4;

    const sampleRate = audioContext.sampleRate;
    const duration = 0.2;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    const frequencies = [415.3, 349.2, 261.6];
    const noteDuration = duration / frequencies.length;
    const noteFrameCount = Math.floor(sampleRate * noteDuration);

    const attackFrames = Math.floor(sampleRate * 0.01);
    const releaseFrames = Math.floor(sampleRate * 0.03);

    for (let i = 0; i < frameCount; i += 1) {
        const t = i / sampleRate;
        const noteIndex = Math.min(Math.floor(t / noteDuration), frequencies.length - 1);
        const frequency = frequencies[noteIndex];
        
        const noteStartFrame = noteIndex * noteFrameCount;
        const noteFrame = i - noteStartFrame;
        const noteTime = noteFrame / sampleRate;

        const noteAttackFrames = Math.min(attackFrames, Math.floor(noteFrameCount * 0.2));
        const noteReleaseFrames = Math.min(releaseFrames, Math.floor(noteFrameCount * 0.3));
        const noteSustainFrames = noteFrameCount - noteAttackFrames - noteReleaseFrames;

        const envelope = calculateEnvelopeValue(
            noteFrame,
            noteAttackFrames,
            noteSustainFrames,
            noteReleaseFrames
        );

        data[i] = envelope * Math.sin(2 * Math.PI * frequency * noteTime) * 0.4;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const gainNode = audioContext.createGain();

    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(actualVolume, now);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + duration);

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    return new Promise((resolve) => {
        let resolved = false;
        
        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                try {
                    source.disconnect();
                    gainNode.disconnect();
                } catch (e) {
                    // Ignore cleanup errors
                }
                resolve();
            }
        };

        source.onended = cleanup;

        try {
            source.start(now);
            source.stop(now + duration + 0.05);
        } catch (error) {
            cleanup();
        }
    });
}

// Removed playCompletionSound() - now using shared completion sound function from js/audio.js

/**
 * Plays an audio buffer with the specified volume multiplier.
 * @param {AudioBuffer} buffer - The audio buffer to play
 * @param {number} volumeMultiplier - Volume multiplier (0.0 to 1.0)
 * @returns {Promise} Promise that resolves when sound finishes
 */
function playAudioBuffer(buffer, volumeMultiplier = 1.0) {
    if (!audioContext || audioContext.state !== 'running') {
        return Promise.resolve();
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Create gain node and apply global volume control
    const gainNode = audioContext.createGain();
    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const actualVolume = globalVolume * volumeMultiplier;
    gainNode.gain.setValueAtTime(actualVolume, audioContext.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    return new Promise((resolve) => {
        let resolved = false;
        
        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                try {
                    source.disconnect();
                    gainNode.disconnect();
                } catch (e) {
                    // Ignore cleanup errors
                }
                resolve();
            }
        };

        source.onended = cleanup;

        try {
            const duration = buffer.duration;
            source.start(0);
            // Set timeout as fallback in case onended doesn't fire
            setTimeout(cleanup, (duration + 0.1) * 1000);
        } catch (error) {
            console.warn('Could not start audio buffer:', error);
            cleanup();
        }
    });
}

/**
 * Calculates envelope value for audio synthesis.
 */
function calculateEnvelopeValue(frame, attackFrames, sustainFrames, releaseFrames) {
    if (frame < attackFrames) {
        return frame / attackFrames;
    } else if (frame < attackFrames + sustainFrames) {
        return 1.0;
    } else {
        const releaseFrame = frame - attackFrames - sustainFrames;
        return Math.max(0, 1.0 - (releaseFrame / releaseFrames));
    }
}

/**
 * Ensures audio context is created and ready.
 * @returns {Promise} Promise that resolves when audio context is ready
 */
async function ensureAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Could not create AudioContext:', error);
            return;
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

/**
 * Handles visibility changes to pause/resume audio.
 */
function handleVisibilityChange() {
    if (!audioContext) {
        return;
    }

    if (document.hidden) {
        if (audioContext.state === 'running') {
            audioContext.suspend().catch(error => {
                console.warn('Could not suspend AudioContext:', error);
            });
        }
    } else {
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(error => {
                console.warn('Could not resume AudioContext:', error);
            });
        }
    }
}

/**
 * Handles volume changes from the main page control.
 * @param {CustomEvent} event - Volume change event
 */
function handleVolumeChange(event) {
    if (backgroundGain && audioContext && audioContext.state === 'running') {
        const newVolume = event.detail.volume;
        backgroundGain.gain.setValueAtTime(newVolume, audioContext.currentTime);
    }
}

/**
 * Handles the first user interaction to start audio.
 */
function handleFirstInteraction() {
    requestBackgroundAudioStart();
}

/**
 * Attempts to start the background ambience, respecting autoplay restrictions.
 */
function requestBackgroundAudioStart() {
    if (state.audioStarted || state.audioStarting) {
        return;
    }

    state.audioStarting = true;

    ensureAudioContext().then(() => {
        if (audioContext && audioContext.state === 'running') {
            startBackgroundAmbience();
        }
    }).catch(error => {
        console.warn('Could not start audio context:', error);
        state.audioStarting = false;
    });
}

/**
 * Starts the looping background ambience.
 */
async function startBackgroundAmbience() {
    if (!STRINGS.ambience || !STRINGS.ambience.track) {
        return;
    }

    await ensureAudioContext();

    if (!audioContext || audioContext.state !== 'running') {
        return;
    }

    try {
        const buffer = await loadAudioBuffer(STRINGS.ambience.track);
        if (!buffer) {
            return;
        }

        backgroundBuffer = buffer;

        // Create gain node for volume control
        backgroundGain = audioContext.createGain();
        const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
        backgroundGain.gain.setValueAtTime(globalVolume, audioContext.currentTime);
        backgroundGain.connect(audioContext.destination);

        // Start looping
        playBackgroundLoop();

        state.audioStarted = true;
        state.audioStarting = false;
    } catch (error) {
        console.warn('Could not start background ambience:', error);
        state.audioStarting = false;
    }
}

/**
 * Plays the background ambience in a loop.
 */
function playBackgroundLoop() {
    if (!backgroundBuffer || !audioContext || audioContext.state !== 'running') {
        return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = backgroundBuffer;
    source.connect(backgroundGain);
    source.loop = true;

    source.onended = () => {
        if (state.audioStarted) {
            playBackgroundLoop();
        }
    };

    try {
        source.start(0);
        backgroundSource = source;
    } catch (error) {
        console.warn('Could not start background loop:', error);
    }
}

/**
 * Loads and caches an audio file as an AudioBuffer.
 * @param {string} url - URL of the audio file
 * @returns {Promise<AudioBuffer>} Promise that resolves with the audio buffer
 */
function loadAudioBuffer(url) {
    // Check cache first
    if (audioBufferCache.has(url)) {
        return Promise.resolve(audioBufferCache.get(url));
    }

    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            return ensureAudioContext().then(() => {
                if (!audioContext) {
                    throw new Error('AudioContext not available');
                }
                return audioContext.decodeAudioData(arrayBuffer);
            });
        })
        .then(audioBuffer => {
            audioBufferCache.set(url, audioBuffer);
            return audioBuffer;
        })
        .catch(error => {
            console.warn(`Could not load audio buffer from ${url}:`, error);
            throw error;
        });
}
