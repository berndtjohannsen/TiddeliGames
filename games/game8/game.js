// Uppercase/Lowercase Matching Game (Game 8) – game logic
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME8_STRINGS || {};

// Swedish alphabet: A-Z plus Å, Ä, Ö (29 letters total)
const SWEDISH_ALPHABET_UPPERCASE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Å', 'Ä', 'Ö'];
const SWEDISH_ALPHABET_LOWERCASE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'å', 'ä', 'ö'];

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let lowercaseContainer = null;
let instructionTextDisplay = null;
let uppercaseContainer = null;
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
    currentLowercaseLetter: '', // Current lowercase letter to match
    currentUppercaseIndex: -1, // Index of the correct uppercase letter
    letterButtons: [], // Array of uppercase letter button elements
    matchedLetters: new Set(), // Set of indices of matched letters
    audioStarted: false, // Track if ambience has successfully started
    audioStarting: false // Prevent concurrent start attempts
};

/**
 * Initializes the game when the DOM is ready.
 */
window.addEventListener('DOMContentLoaded', () => {
    try {
        cacheDomElements();
        // Hide completion dialog immediately on load
        hideCompletionDialog();
        populateStaticTexts();
        attachEventListeners();
        startNewRound();
        requestBackgroundAudioStart();
    } catch (error) {
        console.error('Error initializing game8:', error);
        // Try to show error message to user
        if (instructionsEl) {
            instructionsEl.textContent = (STRINGS && STRINGS.errors && STRINGS.errors.initializationFailed) 
                ? STRINGS.errors.initializationFailed 
                : 'Ett fel uppstod vid start. Ladda om sidan.';
        }
    }
});

/**
 * Retrieves and caches references to all important DOM elements.
 */
function cacheDomElements() {
    titleEl = document.getElementById('game8-title');
    instructionsEl = document.getElementById('instructions-text');
    lowercaseContainer = document.getElementById('lowercase-container');
    instructionTextDisplay = document.getElementById('instruction-text-display');
    uppercaseContainer = document.getElementById('uppercase-container');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
}

/**
 * Sets static text (title, button labels, etc.) when the game first loads.
 */
function populateStaticTexts() {
    if (!STRINGS) {
        console.error('GAME8_STRINGS not loaded');
        return;
    }
    if (titleEl) {
        titleEl.textContent = STRINGS.title || '';
    }
    if (instructionsEl) {
        instructionsEl.textContent = STRINGS.instructions || '';
    }
    if (continueButton && STRINGS.labels) {
        continueButton.textContent = STRINGS.labels.continue || '';
    }
    if (completionTitle && STRINGS.dialog) {
        completionTitle.textContent = STRINGS.dialog.title || '';
    }
    if (completionMessage && STRINGS.dialog) {
        completionMessage.textContent = STRINGS.dialog.message || '';
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
 * Starts a new round by selecting a random lowercase letter and displaying all uppercase letters.
 */
function startNewRound() {
    // Hide completion dialog first
    hideCompletionDialog();
    
    // Check if required containers exist
    if (!uppercaseContainer) {
        console.error(STRINGS && STRINGS.errors ? STRINGS.errors.uppercaseContainerMissing : 'Uppercase container not found');
        return;
    }
    
    // Reset state for a new game
    state.letterButtons = [];
    state.matchedLetters.clear();

    // Start with first unmatched letter
    selectNextUnmatchedLetter();
}

/**
 * Handles click on an uppercase letter button.
 * @param {HTMLElement} button - The clicked button element
 */
function handleLetterClick(button) {
    const clickedIndex = parseInt(button.getAttribute('data-index'), 10);
    const clickedLetter = button.getAttribute('data-letter');
    
    if (clickedIndex === state.currentUppercaseIndex) {
        // Correct match!
        button.classList.add('game8-letter-button--correct');
        
        // Mark this letter as matched
        state.matchedLetters.add(clickedIndex);
        
        // Display both the uppercase and lowercase letters together in the alphabet box (the clicked button)
        // Use a line break to stack them vertically
        button.innerHTML = clickedLetter + '<br>' + state.currentLowercaseLetter;
        if (STRINGS.aria && STRINGS.aria.lowercase && STRINGS.aria.uppercase) {
            button.setAttribute('aria-label', 
                `${STRINGS.aria.uppercase(clickedLetter)} och ${STRINGS.aria.lowercase(state.currentLowercaseLetter)}`);
        }
        
        // Disable the button so it can't be clicked again
        button.disabled = true;
        
        // Play short success beep
        playSuccessSound().catch(error => {
            console.warn('Could not play success sound:', error);
        });
        
        // Check if all letters are matched
        if (state.matchedLetters.size >= SWEDISH_ALPHABET_LOWERCASE.length) {
            // All letters matched - show completion dialog
            setTimeout(() => {
                showCompletionDialog();
            }, 500);
        } else {
            // Continue to next unmatched letter
            setTimeout(() => {
                selectNextUnmatchedLetter();
            }, 500);
        }
    } else {
        // Wrong letter - play error sound and show visual feedback
        button.classList.add('game8-letter-button--wrong');
        setTimeout(() => {
            button.classList.remove('game8-letter-button--wrong');
        }, 300);
        
        playErrorSound().catch(error => {
            console.warn('Could not play error sound:', error);
        });
    }
}

/**
 * Selects the next unmatched lowercase letter.
 */
function selectNextUnmatchedLetter() {
    // Get all unmatched indices
    const unmatchedIndices = [];
    for (let i = 0; i < SWEDISH_ALPHABET_LOWERCASE.length; i++) {
        if (!state.matchedLetters.has(i)) {
            unmatchedIndices.push(i);
        }
    }
    
    // If all are matched, we're done (shouldn't happen, but safety check)
    if (unmatchedIndices.length === 0) {
        showCompletionDialog();
        return;
    }
    
    // Select a random unmatched letter
    const randomIndex = Math.floor(Math.random() * unmatchedIndices.length);
    const selectedIndex = unmatchedIndices[randomIndex];
    state.currentLowercaseLetter = SWEDISH_ALPHABET_LOWERCASE[selectedIndex];
    state.currentUppercaseIndex = selectedIndex;
    
    // Update display
    updateDisplayForCurrentLetter();
}

/**
 * Updates the display for the current lowercase letter.
 */
function updateDisplayForCurrentLetter() {
    // Update lowercase letter display
    if (lowercaseContainer) {
        lowercaseContainer.textContent = state.currentLowercaseLetter;
        if (STRINGS.aria && STRINGS.aria.lowercase) {
            lowercaseContainer.setAttribute('aria-label', STRINGS.aria.lowercase(state.currentLowercaseLetter));
        }
    }
    if (instructionTextDisplay) {
        if (STRINGS.aria && STRINGS.aria.instruction) {
            instructionTextDisplay.textContent = STRINGS.aria.instruction;
        }
    }
    
    // Create or update uppercase letter buttons if not already created
    if (uppercaseContainer && state.letterButtons.length === 0) {
        uppercaseContainer.innerHTML = '';
        
        // Create uppercase letter buttons (in alphabetical order)
        SWEDISH_ALPHABET_UPPERCASE.forEach((letter, index) => {
            const button = document.createElement('button');
            button.className = 'game8-letter-button';
            
            // If this letter is already matched, show both characters stacked vertically
            if (state.matchedLetters.has(index)) {
                button.innerHTML = letter + '<br>' + SWEDISH_ALPHABET_LOWERCASE[index];
                button.disabled = true;
                button.classList.add('game8-letter-button--correct');
            } else {
                button.textContent = letter;
                button.disabled = false;
            }
            
            button.setAttribute('data-letter', letter);
            button.setAttribute('data-index', index);
            if (STRINGS.aria && STRINGS.aria.uppercase) {
                button.setAttribute('aria-label', STRINGS.aria.uppercase(letter));
            }
            button.setAttribute('type', 'button');
            button.addEventListener('click', () => handleLetterClick(button));
            state.letterButtons.push(button);
            if (uppercaseContainer) {
                uppercaseContainer.appendChild(button);
            }
        });
    } else if (uppercaseContainer && state.letterButtons.length > 0) {
        // Update existing buttons - re-enable unmatched ones, keep matched ones disabled
        state.letterButtons.forEach((button, index) => {
            if (state.matchedLetters.has(index)) {
                // Already matched - keep it disabled and showing both characters
                button.disabled = true;
                if (!button.classList.contains('game8-letter-button--correct')) {
                    button.classList.add('game8-letter-button--correct');
                }
                // Ensure it shows both characters stacked vertically
                const expectedContent = SWEDISH_ALPHABET_UPPERCASE[index] + '<br>' + SWEDISH_ALPHABET_LOWERCASE[index];
                if (button.innerHTML !== expectedContent) {
                    button.innerHTML = expectedContent;
                }
            } else {
                // Not matched yet - enable it and show only uppercase
                button.disabled = false;
                button.classList.remove('game8-letter-button--correct', 'game8-letter-button--wrong');
                button.textContent = SWEDISH_ALPHABET_UPPERCASE[index];
            }
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
    
    // Play completion sound (randomly select one of 6 completion sounds)
    playCompletionSound().catch(error => {
        console.warn('Could not play completion sound:', error);
    });
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
 * Plays a short success beep (synthetic).
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

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 523.25; // C5
        oscillator.type = 'sine';
        
        // Short beep - shorter duration
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
        
        return new Promise(resolve => {
            setTimeout(resolve, 150);
        });
    } catch (error) {
        console.warn('Could not play success sound:', error);
        return Promise.resolve();
    }
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

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 200; // Low frequency for error
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        
        return new Promise(resolve => {
            setTimeout(resolve, 200);
        });
    } catch (error) {
        console.warn('Could not play error sound:', error);
        return Promise.resolve();
    }
}

/**
 * Plays a completion sound (randomly selects one of 6 completion sounds).
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
        // Randomly select one of the 6 completion sounds
        const randomIndex = Math.floor(Math.random() * 6) + 1; // 1 to 6
        const soundPath = `sounds/complete${randomIndex}.mp3`;
        const buffer = await loadAudioBuffer(soundPath);
        if (buffer) {
            return playAudioBuffer(buffer, 0.8);
        }
    } catch (error) {
        console.warn('Could not load completion sound:', error);
        return Promise.resolve();
    }
}

/**
 * Ensures the audio context is initialized.
 * @returns {Promise} Promise that resolves when audio context is ready
 */
async function ensureAudioContext() {
    if (audioContext) {
        return Promise.resolve();
    }

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return Promise.resolve();
        }
        audioContext = new AudioContextClass();
    } catch (error) {
        console.warn('Could not create audio context:', error);
        return Promise.resolve();
    }
}

/**
 * Loads an audio buffer from a file path.
 * @param {string} path - Path to the audio file
 * @returns {Promise<AudioBuffer>} Promise that resolves with the audio buffer
 */
async function loadAudioBuffer(path) {
    if (audioBufferCache.has(path)) {
        return audioBufferCache.get(path);
    }

    if (!audioContext) {
        return null;
    }

    try {
        const response = await fetch(path);
        if (!response.ok) {
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferCache.set(path, buffer);
        return buffer;
    } catch (error) {
        console.warn(`Could not load audio buffer from ${path}:`, error);
        return null;
    }
}

/**
 * Plays an audio buffer.
 * @param {AudioBuffer} buffer - The audio buffer to play
 * @param {number} volume - Volume level (0.0 to 1.0)
 * @returns {Promise} Promise that resolves when playback finishes
 */
async function playAudioBuffer(buffer, volume = 1.0) {
    if (!audioContext || !buffer) {
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
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = buffer;
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(0);
        
        return new Promise(resolve => {
            source.onended = () => resolve();
            setTimeout(resolve, buffer.duration * 1000 + 100);
        });
    } catch (error) {
        console.warn('Could not play audio buffer:', error);
        return Promise.resolve();
    }
}

/**
 * Requests background audio to start (ambience).
 */
function requestBackgroundAudioStart() {
    if (state.audioStarting || state.audioStarted) {
        return;
    }
    state.audioStarting = true;
    
    ensureAudioContext().then(() => {
        if (!audioContext) {
            state.audioStarting = false;
            return;
        }
        loadBackgroundAudio();
    }).catch(error => {
        console.warn('Could not start audio context for background:', error);
        state.audioStarting = false;
    });
}

/**
 * Loads the background audio buffer.
 */
async function loadBackgroundAudio() {
    if (!audioContext) {
        return;
    }

    try {
        backgroundBuffer = await loadAudioBuffer('sounds/background.mp3');
        if (backgroundBuffer) {
            startBackgroundAudio();
        } else {
            state.audioStarting = false;
        }
    } catch (error) {
        console.warn('Could not load background audio:', error);
        state.audioStarting = false;
    }
}

/**
 * Starts playing the background audio loop.
 */
function startBackgroundAudio() {
    if (!audioContext || !backgroundBuffer || state.audioStarted) {
        return;
    }

    if (audioContext.state !== 'running') {
        // Will be started on first user interaction
        return;
    }

    try {
        backgroundSource = audioContext.createBufferSource();
        backgroundGain = audioContext.createGain();
        
        backgroundSource.buffer = backgroundBuffer;
        backgroundSource.loop = true;
        backgroundGain.gain.value = 0.3; // Start with low volume
        
        backgroundSource.connect(backgroundGain);
        backgroundGain.connect(audioContext.destination);
        
        backgroundSource.start(0);
        state.audioStarted = true;
        state.audioStarting = false;
    } catch (error) {
        console.warn('Could not start background audio:', error);
        state.audioStarting = false;
    }
}

/**
 * Handles first user interaction to start audio context.
 */
function handleFirstInteraction() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            if (!state.audioStarted && backgroundBuffer) {
                startBackgroundAudio();
            }
        }).catch(error => {
            console.warn('Could not resume audio context:', error);
        });
    }
}

/**
 * Handles visibility change (pause/resume audio when tab is hidden/shown).
 */
function handleVisibilityChange() {
    if (!audioContext) {
        return;
    }

    if (document.hidden) {
        if (audioContext.state === 'running') {
            audioContext.suspend().catch(error => {
                console.warn('Could not suspend audio context:', error);
            });
        }
    } else {
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                if (!state.audioStarted && backgroundBuffer) {
                    startBackgroundAudio();
                }
            }).catch(error => {
                console.warn('Could not resume audio context:', error);
            });
        }
    }
}

/**
 * Handles volume change events from the main page.
 */
function handleVolumeChange(event) {
    if (backgroundGain && audioContext && audioContext.state === 'running') {
        const newVolume = event.detail.volume;
        const now = audioContext.currentTime;
        backgroundGain.gain.cancelScheduledValues(now);
        backgroundGain.gain.setValueAtTime(backgroundGain.gain.value, now);
        backgroundGain.gain.linearRampToValueAtTime(newVolume * 0.3, now + 0.1);
    }
}

