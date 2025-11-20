// Spelling Game (Game 6) – game logic for clicking characters in order
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME6_STRINGS;
const WORD_PAIRS = Array.isArray(STRINGS.wordPairs) ? STRINGS.wordPairs.slice() : [];

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let emojiContainer = null;
let answerContainer = null;
let charactersContainer = null;
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
    currentWord: '', // Current word to spell
    currentEmoji: '', // Current emoji
    wordChars: [], // Array of characters in the word
    charButtons: [], // Array of character button elements
    answerSlots: [], // Array of answer slot elements
    selectedIndex: 0, // Current position in the answer
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
    titleEl = document.getElementById('game6-title');
    instructionsEl = document.getElementById('instructions-text');
    emojiContainer = document.getElementById('emoji-container');
    answerContainer = document.getElementById('answer-container');
    charactersContainer = document.getElementById('characters-container');
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
 * Starts a new round by selecting a random word and displaying it.
 */
function startNewRound() {
    if (WORD_PAIRS.length === 0) {
        console.error('No word pairs defined');
        return;
    }

    // Reset state
    state.selectedIndex = 0;
    state.charButtons = [];
    state.answerSlots = [];
    state.wordChars = [];

    // Select a random word pair
    const randomIndex = Math.floor(Math.random() * WORD_PAIRS.length);
    const pair = WORD_PAIRS[randomIndex];
    state.currentWord = pair.word;
    state.currentEmoji = pair.emoji;

    // Split word into characters
    state.wordChars = state.currentWord.split('');

    // Clear containers
    if (emojiContainer) {
        emojiContainer.textContent = state.currentEmoji;
        emojiContainer.setAttribute('aria-label', STRINGS.aria.image(state.currentWord));
    }
    if (answerContainer) {
        answerContainer.innerHTML = '';
    }
    if (charactersContainer) {
        charactersContainer.innerHTML = '';
    }

    // Create answer slots
    state.wordChars.forEach((char, index) => {
        const slot = document.createElement('div');
        slot.className = 'game6-answer-char';
        slot.setAttribute('data-index', index);
        slot.setAttribute('aria-label', `Position ${index + 1}`);
        state.answerSlots.push(slot);
        if (answerContainer) {
            answerContainer.appendChild(slot);
        }
    });

    // Create character buttons (shuffled)
    const shuffledChars = shuffleArray(state.wordChars.slice());
    shuffledChars.forEach((char, index) => {
        const charBtn = createCharButton(char, index);
        state.charButtons.push(charBtn);
        if (charactersContainer) {
            charactersContainer.appendChild(charBtn);
        }
    });

    hideCompletionDialog();
}

/**
 * Creates a character button element.
 * @param {string} char - The character to display
 * @param {number} index - Index of the button
 * @returns {HTMLElement} Character button element
 */
function createCharButton(char, index) {
    const button = document.createElement('button');
    button.className = 'game6-char';
    button.textContent = char;
    button.setAttribute('data-char', char);
    button.setAttribute('data-index', index);
    button.setAttribute('aria-label', STRINGS.aria.character(char));
    button.setAttribute('type', 'button');
    
    button.addEventListener('click', () => handleCharClick(button, char));
    
    return button;
}

/**
 * Handles click on a character button.
 * @param {HTMLElement} charButton - The clicked character button
 * @param {string} char - The character value
 */
function handleCharClick(charButton, char) {
    // Ignore if already used
    if (charButton.classList.contains('game6-char--used')) {
        return;
    }

    // Check if this is the correct next character
    const expectedChar = state.wordChars[state.selectedIndex];
    
    if (char === expectedChar) {
        // Correct! Add to answer
        const slot = state.answerSlots[state.selectedIndex];
        slot.textContent = char;
        slot.classList.add('game6-answer-char--filled');
        
        // Mark button as used
        charButton.classList.add('game6-char--used');
        
        // Move to next position
        state.selectedIndex++;
        
        // Play success sound
        playSuccessSound().catch(error => {
            console.warn('Could not play success sound:', error);
        });
        
        // Check if word is complete
        if (state.selectedIndex >= state.wordChars.length) {
            setTimeout(() => {
                showCompletionDialog();
            }, 500); // Small delay to see the last character
        }
    } else {
        // Wrong character - play error sound
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
 * Plays a success sound (synthetic).
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
 * Plays an error sound (synthetic).
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
 * Plays the completion sound when word is spelled correctly.
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

