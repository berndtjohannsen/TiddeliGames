// First Letter Game (Game 10) – game logic for selecting first letter of icon
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME10_STRINGS;
const ICONS = Array.isArray(STRINGS.icons) ? STRINGS.icons.slice() : [];

// Constants
const NUM_ANSWERS = 8; // Number of letter options to show
// Swedish alphabet: A-Z plus Å, Ä, Ö, excluding Q, W, X, Z (25 letters total)
const SWEDISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'Y', 'Å', 'Ä', 'Ö'];

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let iconContainer = null;
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
    currentIcon: null, // Current icon object { emoji, word }
    correctLetter: '', // Correct first letter
    answerOptions: [], // Array of letter options (including correct one)
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
    titleEl = document.getElementById('game10-title');
    instructionsEl = document.getElementById('instructions-text');
    iconContainer = document.getElementById('icon-container');
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
    // Select a random icon
    if (ICONS.length > 0) {
        state.currentIcon = ICONS[Math.floor(Math.random() * ICONS.length)];
    } else {
        // Fallback
        state.currentIcon = { emoji: '🐒', word: 'Apa' };
    }
    
    // Extract first letter from the word (uppercase)
    state.correctLetter = state.currentIcon.word.charAt(0).toUpperCase();
    
    // Generate answer options
    generateAnswerOptions();
    
    // Display the game
    displayGame();
}

/**
 * Generates 8 letter options including the correct answer.
 */
function generateAnswerOptions() {
    const options = new Set();
    options.add(state.correctLetter);
    
    // Generate wrong answers
    let attempts = 0;
    const MAX_ATTEMPTS = 1000;
    
    while (options.size < NUM_ANSWERS && attempts < MAX_ATTEMPTS) {
        attempts++;
        
        // Select a random letter from the alphabet
        const randomIndex = Math.floor(Math.random() * SWEDISH_ALPHABET.length);
        const randomLetter = SWEDISH_ALPHABET[randomIndex];
        
        // Only add if unique and not the correct answer
        if (!options.has(randomLetter)) {
            options.add(randomLetter);
        }
    }
    
    // Fallback: if we couldn't generate enough, fill with sequential letters
    if (options.size < NUM_ANSWERS) {
        console.warn('Could not generate enough unique answers, filling with sequential');
        for (let i = 0; i < SWEDISH_ALPHABET.length && options.size < NUM_ANSWERS; i++) {
            options.add(SWEDISH_ALPHABET[i]);
        }
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
 * Displays the game: icon and answer buttons.
 */
function displayGame() {
    // Clear previous content
    if (iconContainer) iconContainer.innerHTML = '';
    if (answerButtonsContainer) answerButtonsContainer.innerHTML = '';
    
    state.answerButtons = [];
    
    // Display icon
    if (iconContainer && state.currentIcon) {
        const iconElement = document.createElement('div');
        iconElement.className = 'game10-icon';
        iconElement.textContent = state.currentIcon.emoji;
        iconElement.setAttribute('aria-label', STRINGS.aria.icon(state.currentIcon.word));
        iconContainer.appendChild(iconElement);
    }
    
    // Create answer buttons
    state.answerOptions.forEach(letter => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'game10-answer';
        button.textContent = letter;
        button.setAttribute('aria-label', STRINGS.aria.letter(letter));
        button.addEventListener('click', () => handleAnswerClick(letter, button));
        if (answerButtonsContainer) answerButtonsContainer.appendChild(button);
        state.answerButtons.push(button);
    });
}

// Track if a click is being processed to prevent rapid clicks
let isProcessingClick = false;

/**
 * Handles clicks on answer buttons.
 * @param {string} selectedLetter - The letter that was clicked
 * @param {HTMLElement} button - The button element that was clicked
 */
async function handleAnswerClick(selectedLetter, button) {
    // Prevent rapid clicks that could cause freezes
    if (isProcessingClick) {
        return;
    }
    
    // Check if button is already disabled
    if (button.classList.contains('game10-answer--disabled')) {
        return;
    }
    
    isProcessingClick = true;
    
    try {
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
            btn.classList.add('game10-answer--disabled');
        });
        
        if (selectedLetter === state.correctLetter) {
            // Correct answer - show feedback, show dialog, and play sound
            button.classList.add('game10-answer--correct');
            // Show dialog (which will play the completion sound)
            showCompletionDialog();
            // Reset flag when dialog is shown (user will click continue to start new round)
            // Flag will be reset in handleContinueClick
        } else {
            // Wrong answer - show feedback and play error sound
            button.classList.add('game10-answer--wrong');
            // Play error sound
            playErrorSound().catch(error => {
                console.warn('Could not play error sound:', error);
            });
            setTimeout(() => {
                button.classList.remove('game10-answer--wrong');
                // Re-enable all buttons
                state.answerButtons.forEach(btn => {
                    btn.classList.remove('game10-answer--disabled');
                });
                isProcessingClick = false;
            }, 800);
        }
    } catch (error) {
        console.error('Error in handleAnswerClick:', error);
        // Re-enable buttons on error
        state.answerButtons.forEach(btn => {
            btn.classList.remove('game10-answer--disabled');
        });
        isProcessingClick = false;
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
    
    // Hide title if empty
    if (completionTitle) {
        if (STRINGS.dialog.title) {
            completionTitle.textContent = STRINGS.dialog.title;
            completionTitle.style.display = '';
        } else {
            completionTitle.style.display = 'none';
        }
    }
    
    // Update completion message to show only the word
    if (completionMessage && state.currentIcon) {
        completionMessage.innerHTML = `<strong style="font-size: 1.5em;">${state.currentIcon.word}!</strong>`;
    }
    
    // Ensure continue button is enabled and clickable
    if (continueButton) {
        continueButton.disabled = false;
        continueButton.style.pointerEvents = 'auto';
    }
    
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
 * Handles continue button click in completion dialog.
 */
function handleContinueClick() {
    // Always allow continue button to work - reset flag first
    isProcessingClick = false;
    
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
    
    const ambiencePath = STRINGS.ambience?.track;
    if (!ambiencePath) {
        return Promise.resolve();
    }
    
    try {
        // Check cache first
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
    const actualVolume = globalVolume * 0.5;

    const sampleRate = audioContext.sampleRate;
    const duration = 0.3;
    const frames = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a low, unpleasant error sound
    const freq = 200;
    const attackFrames = Math.floor(sampleRate * 0.05);
    const releaseFrames = Math.floor(sampleRate * 0.25);

    for (let i = 0; i < frames; i++) {
        let value = 0;
        if (i < attackFrames + releaseFrames) {
            let envelope = 1.0;
            if (i < attackFrames) {
                envelope = i / attackFrames;
            } else if (i >= frames - releaseFrames) {
                envelope = (frames - i) / releaseFrames;
            }
            const t = i / sampleRate;
            value = Math.sin(2 * Math.PI * freq * t) * envelope;
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
            console.warn('Could not start error sound:', error);
            cleanup();
        }
    });
}

