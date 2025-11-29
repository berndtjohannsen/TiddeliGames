// Subtraction Game (Game 7) – game logic for simple subtraction
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME7_STRINGS;
const EMOJIS = Array.isArray(STRINGS.emojis) ? STRINGS.emojis.slice() : [];

// Constants
const MAX_FIRST = 10; // Maximum first number allowed
const MIN_FIRST = 2; // Minimum first number (must be >= 2 for subtraction)
const NUM_ANSWERS = 8; // Number of answer options to show

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let firstGroup = null;
let secondGroup = null;
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
    firstNumber: 0, // First number in the subtraction (larger number)
    secondNumber: 0, // Second number in the subtraction (smaller number to subtract)
    correctAnswer: 0, // Correct difference
    answerOptions: [], // Array of answer options (including correct one)
    currentEmoji: null, // Current emoji to use
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
    titleEl = document.getElementById('game7-title');
    instructionsEl = document.getElementById('instructions-text');
    firstGroup = document.getElementById('first-group');
    secondGroup = document.getElementById('second-group');
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
    // Generate random numbers for subtraction: firstNumber - secondNumber = result
    // First number: 2 to 10 (must be >= 2 for subtraction)
    state.firstNumber = Math.floor(Math.random() * (MAX_FIRST - MIN_FIRST + 1)) + MIN_FIRST;
    // Second number: 1 to (firstNumber - 1) so result is >= 1
    state.secondNumber = Math.floor(Math.random() * (state.firstNumber - 1)) + 1;
    state.correctAnswer = state.firstNumber - state.secondNumber;
    
    // Select a random emoji
    if (EMOJIS.length > 0) {
        state.currentEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    } else {
        state.currentEmoji = '🍎'; // Fallback
    }
    
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
    
    // Generate wrong answers with safety limit to prevent infinite loops
    let attempts = 0;
    const MAX_ATTEMPTS = 1000; // Safety limit
    
    while (options.size < NUM_ANSWERS && attempts < MAX_ATTEMPTS) {
        attempts++;
        
        // Generate a wrong answer with a wider range
        const offset = Math.floor(Math.random() * 12) - 6; // -6 to +5 (wider range)
        let wrongAnswer = state.correctAnswer + offset;
        
        // Clamp to valid range
        if (wrongAnswer < 1) wrongAnswer = 1;
        if (wrongAnswer > MAX_FIRST) wrongAnswer = MAX_FIRST;
        
        // Only add if unique (no inner loop needed!)
        if (!options.has(wrongAnswer)) {
            options.add(wrongAnswer);
        }
    }
    
    // Fallback: if we couldn't generate enough, just fill with sequential numbers
    if (options.size < NUM_ANSWERS) {
        console.warn('Could not generate enough unique answers, filling with sequential');
        for (let i = 1; i <= MAX_FIRST && options.size < NUM_ANSWERS; i++) {
            options.add(i);
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
 * Displays the game: emojis and answer buttons.
 */
function displayGame() {
    // Clear previous content
    if (firstGroup) firstGroup.innerHTML = '';
    if (secondGroup) secondGroup.innerHTML = '';
    if (answerButtonsContainer) answerButtonsContainer.innerHTML = '';
    
    state.answerButtons = [];
    
    // Display first group of emojis (larger number - the total)
    for (let i = 0; i < state.firstNumber; i++) {
        const emoji = document.createElement('span');
        emoji.className = 'game7-emoji';
        emoji.textContent = state.currentEmoji;
        emoji.setAttribute('aria-label', `${state.currentEmoji} ${i + 1}`);
        if (firstGroup) firstGroup.appendChild(emoji);
    }
    
    // Display second group of emojis (smaller number - to be subtracted)
    for (let i = 0; i < state.secondNumber; i++) {
        const emoji = document.createElement('span');
        emoji.className = 'game7-emoji';
        emoji.textContent = state.currentEmoji;
        emoji.setAttribute('aria-label', `${state.currentEmoji} ${i + 1}`);
        if (secondGroup) secondGroup.appendChild(emoji);
    }
    
    // Create answer buttons
    state.answerOptions.forEach(answer => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'game7-answer';
        button.textContent = answer;
        button.setAttribute('aria-label', STRINGS.aria.answer(answer));
        button.addEventListener('click', () => handleAnswerClick(answer, button));
        if (answerButtonsContainer) answerButtonsContainer.appendChild(button);
        state.answerButtons.push(button);
    });
}

// Track if a click is being processed to prevent rapid clicks
let isProcessingClick = false;

/**
 * Handles clicks on answer buttons.
 * @param {number} selectedAnswer - The answer that was clicked
 * @param {HTMLElement} button - The button element that was clicked
 */
async function handleAnswerClick(selectedAnswer, button) {
    // Prevent rapid clicks that could cause freezes
    if (isProcessingClick) {
        return;
    }
    
    // Check if button is already disabled
    if (button.classList.contains('game7-answer--disabled')) {
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
            btn.classList.add('game7-answer--disabled');
        });
        
        if (selectedAnswer === state.correctAnswer) {
            // Correct answer - show feedback, show dialog, and play sound
            button.classList.add('game7-answer--correct');
            // Show dialog immediately, then play sound
            showCompletionDialog();
            // Play success sound (don't wait for it)
            playSuccessSound().catch(error => {
                console.warn('Could not play success sound:', error);
            });
            // Reset flag when dialog is shown (user will click continue to start new round)
            // Flag will be reset in handleContinueClick
        } else {
            // Wrong answer - show feedback and play error sound
            button.classList.add('game7-answer--wrong');
            // Play error sound
            playErrorSound().catch(error => {
                console.warn('Could not play error sound:', error);
            });
            setTimeout(() => {
                button.classList.remove('game7-answer--wrong');
                // Re-enable all buttons
                state.answerButtons.forEach(btn => {
                    btn.classList.remove('game7-answer--disabled');
                });
                isProcessingClick = false;
            }, 800);
        }
    } catch (error) {
        console.error('Error in handleAnswerClick:', error);
        // Re-enable buttons on error
        state.answerButtons.forEach(btn => {
            btn.classList.remove('game7-answer--disabled');
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
    
    // Ensure continue button is enabled and clickable
    if (continueButton) {
        continueButton.disabled = false;
        continueButton.style.pointerEvents = 'auto';
    }
    
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
    // Always allow continue button to work - reset flag first
    isProcessingClick = false;
    
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
        // Add timeout to prevent hanging
        const fetchPromise = fetch(url);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout')), 10000)
        );
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (!response.ok) {
            return null;
        }
        
        const arrayBufferPromise = response.arrayBuffer();
        const arrayBufferTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('ArrayBuffer timeout')), 10000)
        );
        
        const arrayBuffer = await Promise.race([arrayBufferPromise, arrayBufferTimeoutPromise]);
        
        // Decode with timeout
        const decodePromise = audioContext.decodeAudioData(arrayBuffer);
        const decodeTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Decode timeout')), 10000)
        );
        
        const buffer = await Promise.race([decodePromise, decodeTimeoutPromise]);
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

