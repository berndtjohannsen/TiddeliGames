// Addition Game with Numbers (Game 9) – game logic for simple addition with numbers
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME9_STRINGS;

// Constants
const MIN_NUMBER = 1; // Minimum number (1-9)
const MAX_NUMBER = 9; // Maximum number (1-9)
const MAX_SUM = 18; // Maximum sum allowed (9 + 9)
const NUM_ANSWERS = 8; // Number of answer options to show

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let equationContainer = null;
let answerButtonsContainer = null;
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
    firstNumber: 0, // First number in the addition (1-9)
    secondNumber: 0, // Second number in the addition (1-9)
    correctAnswer: 0, // Correct sum
    answerOptions: [], // Array of answer options (including correct one)
    answerButtons: [], // Array of answer button elements
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
    titleEl = document.getElementById('game9-title');
    instructionsEl = document.getElementById('instructions-text');
    equationContainer = document.getElementById('equation-container');
    answerButtonsContainer = document.getElementById('answer-buttons');
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
 */
function startNewRound() {
    // Generate random numbers from 1 to 9
    state.firstNumber = Math.floor(Math.random() * MAX_NUMBER) + MIN_NUMBER;
    state.secondNumber = Math.floor(Math.random() * MAX_NUMBER) + MIN_NUMBER;
    state.correctAnswer = state.firstNumber + state.secondNumber;
    
    // Generate answer options
    generateAnswerOptions();
    
    // Display the game
    displayGame();
}

/**
 * Generates 8 answer options including the correct answer.
 */
function generateAnswerOptions() {
    const options = new Set();
    options.add(state.correctAnswer);
    
    // Generate wrong answers
    while (options.size < NUM_ANSWERS) {
        // Generate a wrong answer that's different from the correct one
        // and within reasonable range (2 to 18)
        let wrongAnswer;
        do {
            // Prefer answers close to the correct answer for more challenge
            const offset = Math.floor(Math.random() * 10) - 5; // -5 to +4
            wrongAnswer = state.correctAnswer + offset;
            // Ensure it's within valid range and not the correct answer
            if (wrongAnswer < 2) wrongAnswer = 2;
            if (wrongAnswer > MAX_SUM) wrongAnswer = MAX_SUM;
        } while (options.has(wrongAnswer));
        
        options.add(wrongAnswer);
    }
    
    // Convert to array and shuffle
    state.answerOptions = Array.from(options);
    shuffleArray(state.answerOptions);
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 * @param {Array} array - Array to shuffle
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Displays the game: numbers and answer buttons.
 */
function displayGame() {
    // Clear previous content
    if (equationContainer) equationContainer.innerHTML = '';
    if (answerButtonsContainer) answerButtonsContainer.innerHTML = '';
    
    state.answerButtons = [];
    
    // Display first number
    const firstNumberEl = document.createElement('span');
    firstNumberEl.className = 'game9-number';
    firstNumberEl.textContent = state.firstNumber;
    firstNumberEl.setAttribute('aria-label', `Nummer ${state.firstNumber}`);
    if (equationContainer) equationContainer.appendChild(firstNumberEl);
    
    // Display plus sign
    const plusSign = document.createElement('span');
    plusSign.className = 'game9-plus';
    plusSign.textContent = '+';
    plusSign.setAttribute('aria-label', 'Plus');
    if (equationContainer) equationContainer.appendChild(plusSign);
    
    // Display second number
    const secondNumberEl = document.createElement('span');
    secondNumberEl.className = 'game9-number';
    secondNumberEl.textContent = state.secondNumber;
    secondNumberEl.setAttribute('aria-label', `Nummer ${state.secondNumber}`);
    if (equationContainer) equationContainer.appendChild(secondNumberEl);
    
    // Create answer buttons
    state.answerOptions.forEach(answer => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'game9-answer';
        button.textContent = answer;
        button.setAttribute('aria-label', STRINGS.aria.answer(answer));
        button.addEventListener('click', () => handleAnswerClick(answer, button));
        if (answerButtonsContainer) answerButtonsContainer.appendChild(button);
        state.answerButtons.push(button);
    });
}

/**
 * Handles clicks on answer buttons.
 * @param {number} selectedAnswer - The answer that was clicked
 * @param {HTMLElement} button - The button element that was clicked
 */
async function handleAnswerClick(selectedAnswer, button) {
    // Ensure audio is started on first interaction
    requestBackgroundAudioStart();
    
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
    state.answerButtons.forEach(btn => {
        btn.classList.add('game9-answer--disabled');
    });
    
    if (selectedAnswer === state.correctAnswer) {
        // Correct answer - show feedback, show dialog, and play sound
        button.classList.add('game9-answer--correct');
        // Show dialog immediately, then play sound
        showCompletionDialog();
        // Play success sound (don't wait for it)
        playSuccessSound().catch(error => {
            console.warn('Could not play success sound:', error);
        });
    } else {
        // Wrong answer - show feedback and play error sound
        button.classList.add('game9-answer--wrong');
        // Play error sound
        playErrorSound().catch(error => {
            console.warn('Could not play error sound:', error);
        });
        setTimeout(() => {
            button.classList.remove('game9-answer--wrong');
            // Re-enable all buttons
            state.answerButtons.forEach(btn => {
                btn.classList.remove('game9-answer--disabled');
            });
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
 * Handles continue button click in completion dialog.
 */
function handleContinueClick() {
    hideCompletionDialog();
    startNewRound();
}

/**
 * Plays a synthetic success sound.
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
    const frames = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a pleasant two-tone success sound
    const freq1 = 523.25; // C5
    const freq2 = 659.25; // E5
    const attackFrames = Math.floor(sampleRate * 0.05);
    const sustainFrames = Math.floor(sampleRate * 0.3);
    const releaseFrames = Math.floor(sampleRate * 0.25);

    for (let i = 0; i < frames; i++) {
        let value = 0;
        if (i < attackFrames + sustainFrames + releaseFrames) {
            const envelope = calculateEnvelopeValue(i, attackFrames, sustainFrames, releaseFrames);
            if (i < frames / 2) {
                const t = i / sampleRate;
                value = Math.sin(2 * Math.PI * freq1 * t) * envelope;
            } else {
                const t = (i - frames / 2) / sampleRate;
                value = Math.sin(2 * Math.PI * freq2 * t) * envelope;
            }
        }
        data[i] = value * actualVolume;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    return new Promise((resolve) => {
        let resolved = false;
        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                try {
                    source.disconnect();
                } catch (e) {
                    // Ignore cleanup errors
                }
                resolve();
            }
        };

        source.onended = cleanup;
        try {
            source.start(0);
            setTimeout(cleanup, (duration + 0.1) * 1000);
        } catch (error) {
            console.warn('Could not start success sound:', error);
            cleanup();
        }
    });
}

/**
 * Plays a synthetic error sound.
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
    const frames = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a low, buzzy error sound
    const freq = 200;
    const attackFrames = Math.floor(sampleRate * 0.02);
    const sustainFrames = Math.floor(sampleRate * 0.1);
    const releaseFrames = Math.floor(sampleRate * 0.08);

    for (let i = 0; i < frames; i++) {
        const envelope = calculateEnvelopeValue(i, attackFrames, sustainFrames, releaseFrames);
        const t = i / sampleRate;
        // Add some noise for a buzzy sound
        const noise = (Math.random() - 0.5) * 0.3;
        const value = (Math.sin(2 * Math.PI * freq * t) + noise) * envelope;
        data[i] = value * actualVolume;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    return new Promise((resolve) => {
        let resolved = false;
        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                try {
                    source.disconnect();
                } catch (e) {
                    // Ignore cleanup errors
                }
                resolve();
            }
        };

        source.onended = cleanup;
        try {
            source.start(0);
            setTimeout(cleanup, (duration + 0.1) * 1000);
        } catch (error) {
            console.warn('Could not start error sound:', error);
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
        }
    }
    return Promise.resolve();
}

/**
 * Loads an audio file into an AudioBuffer, with caching.
 * @param {string} url - URL of the audio file
 * @returns {Promise<AudioBuffer|null>} Promise that resolves to the AudioBuffer or null
 */
async function loadAudioBuffer(url) {
    if (audioBufferCache.has(url)) {
        return audioBufferCache.get(url);
    }

    if (!audioContext) {
        await ensureAudioContext();
    }

    if (!audioContext) {
        return null;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferCache.set(url, buffer);
        return buffer;
    } catch (error) {
        console.warn(`Could not load audio file ${url}:`, error);
        return null;
    }
}

/**
 * Starts background ambience audio loop.
 * @returns {Promise} Promise that resolves when ambience starts
 */
async function startBackgroundAmbience() {
    if (!STRINGS.ambience || !STRINGS.ambience.track) {
        return Promise.resolve();
    }

    await ensureAudioContext();
    if (!audioContext) {
        return Promise.resolve();
    }

    // Try to resume if suspended (required by autoplay policy)
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Could not resume AudioContext for ambience:', error);
            return Promise.resolve();
        }
    }

    if (audioContext.state !== 'running') {
        return Promise.resolve();
    }

    try {
        backgroundBuffer = await loadAudioBuffer(STRINGS.ambience.track);
        if (!backgroundBuffer) {
            return Promise.resolve();
        }

        const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
        backgroundGain = audioContext.createGain();
        backgroundGain.gain.setValueAtTime(globalVolume, audioContext.currentTime);
        backgroundGain.connect(audioContext.destination);

        function playLoop() {
            if (!backgroundBuffer || !audioContext || audioContext.state !== 'running') {
                return;
            }

            backgroundSource = audioContext.createBufferSource();
            backgroundSource.buffer = backgroundBuffer;
            backgroundSource.connect(backgroundGain);
            backgroundSource.onended = playLoop;
            backgroundSource.start(0);
        }

        playLoop();
    } catch (error) {
        console.warn('Could not start background ambience:', error);
    }
}

