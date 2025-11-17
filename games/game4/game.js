// Spelling Game (Game 4) – game logic for matching images with words
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME4_STRINGS;
const WORD_PAIRS = Array.isArray(STRINGS.wordPairs) ? STRINGS.wordPairs.slice() : [];
const PAIRS_PER_ROUND = 4; // Number of word-image pairs per round

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let imagesContainer = null;
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
    currentPairs: [], // Current 4 pairs for this round
    imageElements: [], // Array of image button elements
    wordElements: [], // Array of word button elements
    selectedImage: null, // Currently selected image element
    selectedWord: null, // Currently selected word element
    matchedCount: 0, // Number of matched pairs
    audioStarted: false, // Track if ambience has successfully started
    audioStarting: false // Prevent concurrent start attempts
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
    imagesContainer = document.getElementById('images-container');
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
 * Starts a new round by selecting 4 random pairs and displaying them.
 */
function startNewRound() {
    if (WORD_PAIRS.length < PAIRS_PER_ROUND) {
        console.error('Not enough word pairs defined');
        return;
    }

    // Reset state
    state.matchedCount = 0;
    state.selectedImage = null;
    state.selectedWord = null;
    state.imageElements = [];
    state.wordElements = [];

    // Clear containers
    if (imagesContainer) {
        imagesContainer.innerHTML = '';
    }
    if (wordsContainer) {
        wordsContainer.innerHTML = '';
    }

    // Select 4 random pairs
    const shuffled = shuffleArray(WORD_PAIRS.slice());
    state.currentPairs = shuffled.slice(0, PAIRS_PER_ROUND);

    // Create image buttons
    state.currentPairs.forEach((pair, index) => {
        const imageBtn = createImageButton(pair, index);
        state.imageElements.push(imageBtn);
        if (imagesContainer) {
            imagesContainer.appendChild(imageBtn);
        }
    });

    // Create word buttons (shuffled)
    const shuffledWords = shuffleArray(state.currentPairs.slice());
    shuffledWords.forEach((pair, index) => {
        const wordBtn = createWordButton(pair, index);
        state.wordElements.push(wordBtn);
        if (wordsContainer) {
            wordsContainer.appendChild(wordBtn);
        }
    });

    hideCompletionDialog();
}

/**
 * Creates an image button element.
 * @param {Object} pair - Word pair object with emoji and word
 * @param {number} index - Index of the pair
 * @returns {HTMLElement} Image button element
 */
function createImageButton(pair, index) {
    const button = document.createElement('button');
    button.className = 'game4-image';
    button.textContent = pair.emoji;
    button.setAttribute('data-word', pair.word);
    button.setAttribute('data-index', index);
    button.setAttribute('aria-label', STRINGS.aria.image(pair.word));
    button.setAttribute('type', 'button');
    
    button.addEventListener('click', () => handleImageClick(button));
    
    return button;
}

/**
 * Creates a word button element.
 * @param {Object} pair - Word pair object with emoji and word
 * @param {number} index - Index of the pair
 * @returns {HTMLElement} Word button element
 */
function createWordButton(pair, index) {
    const button = document.createElement('button');
    button.className = 'game4-word';
    button.textContent = pair.word;
    button.setAttribute('data-word', pair.word);
    button.setAttribute('data-index', index);
    button.setAttribute('aria-label', STRINGS.aria.word(pair.word));
    button.setAttribute('type', 'button');
    
    button.addEventListener('click', () => handleWordClick(button));
    
    return button;
}

/**
 * Handles click on an image button.
 * @param {HTMLElement} imageButton - The clicked image button
 */
function handleImageClick(imageButton) {
    // Ignore if already matched
    if (imageButton.classList.contains('game4-image--matched')) {
        return;
    }

    // If an image is already selected, deselect it
    if (state.selectedImage && state.selectedImage !== imageButton) {
        state.selectedImage.classList.remove('game4-image--selected');
    }

    // If a word is selected, try to match
    if (state.selectedWord) {
        tryMatch(state.selectedWord, imageButton);
        return;
    }

    // Select this image
    state.selectedImage = imageButton;
    imageButton.classList.add('game4-image--selected');
}

/**
 * Handles click on a word button.
 * @param {HTMLElement} wordButton - The clicked word button
 */
function handleWordClick(wordButton) {
    // Ignore if already matched
    if (wordButton.classList.contains('game4-word--matched')) {
        return;
    }

    // If a word is already selected, deselect it
    if (state.selectedWord && state.selectedWord !== wordButton) {
        state.selectedWord.classList.remove('game4-word--selected');
    }

    // If an image is selected, try to match
    if (state.selectedImage) {
        tryMatch(wordButton, state.selectedImage);
        return;
    }

    // Select this word
    state.selectedWord = wordButton;
    wordButton.classList.add('game4-word--selected');
}

/**
 * Tries to match a word with an image.
 * @param {HTMLElement} wordButton - The word button
 * @param {HTMLElement} imageButton - The image button
 */
function tryMatch(wordButton, imageButton) {
    const wordText = wordButton.getAttribute('data-word');
    const imageWord = imageButton.getAttribute('data-word');

    if (wordText === imageWord) {
        // Match! Remove both
        wordButton.classList.add('game4-word--matched');
        imageButton.classList.add('game4-image--matched');
        
        // Clear selection
        state.selectedWord = null;
        state.selectedImage = null;
        
        // Play success sound
        playSuccessSound().catch(error => {
            console.warn('Could not play success sound:', error);
        });
        
        // Increment matched count
        state.matchedCount++;
        
        // Check if all matched
        if (state.matchedCount >= PAIRS_PER_ROUND) {
            setTimeout(() => {
                showCompletionDialog();
            }, 500); // Small delay to see the last match animation
        }
    } else {
        // No match - deselect both
        wordButton.classList.remove('game4-word--selected');
        imageButton.classList.remove('game4-image--selected');
        state.selectedWord = null;
        state.selectedImage = null;
        
        // Play error sound
        playErrorSound().catch(error => {
            console.warn('Could not play error sound:', error);
        });
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
    
    // Play completion sound
    if (STRINGS.sounds && STRINGS.sounds.complete) {
        playCompletionSound().catch(error => {
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
async function playSuccessSound() {
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

    // Play synthetic success sound
    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const actualVolume = globalVolume * 0.7;

    const sampleRate = audioContext.sampleRate;
    const duration = 0.6;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    const frequencies = [523.25, 659.25, 783.99, 1046.50];
    const noteDuration = duration / frequencies.length;
    const noteFrameCount = Math.floor(sampleRate * noteDuration);

    const attackFrames = Math.floor(sampleRate * 0.01);
    const releaseFrames = Math.floor(sampleRate * 0.05);

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

        data[i] = envelope * Math.sin(2 * Math.PI * frequency * noteTime) * 0.5;
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

/**
 * Plays the completion sound when all matches are found.
 * @returns {Promise} Promise that resolves when sound finishes
 */
async function playCompletionSound() {
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

    try {
        const buffer = await loadAudioBuffer(STRINGS.sounds.complete);
        if (buffer) {
            return playAudioBuffer(buffer, 0.8);
        }
    } catch (error) {
        console.warn('Could not load completion sound:', error);
        return Promise.resolve();
    }
}

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

