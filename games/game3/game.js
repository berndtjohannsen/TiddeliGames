// Counting Game (Game 3) – game logic for counting fruits
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME3_STRINGS;
const FRUITS = Array.isArray(STRINGS.fruits) ? STRINGS.fruits.slice() : [];

// Constants for positioning and layout
const POSITIONING_PADDING_MIN = 40; // Minimum padding for object positioning (px)
const POSITIONING_PADDING_RATIO = 0.2; // Padding as ratio of object size
const POSITIONING_MAX_ATTEMPTS = 500; // Maximum attempts to find non-overlapping position
const SMALL_SCREEN_BREAKPOINT = 600; // Screen width threshold for small screen layout (px)
const GRID_OFFSET_MAX = 25; // Maximum random offset for grid-based positioning (px)
const GRID_OFFSET_RATIO = 0.3; // Grid offset as ratio of cell size
const FLOAT_PHASE_MULTIPLIER = 0.4; // Multiplier for spreading float animation phases
const FLOAT_PHASE_MAX = 3; // Maximum float phase in seconds
const MIN_COUNT = 1; // Minimum number of fruits
const MAX_COUNT = 20; // Maximum number of fruits
// Background volume is now controlled from main page volume control

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let fruitField = null;
let numberButtonsContainer = null;
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
    currentFruit: null, // Current fruit emoji for this round
    currentCount: 0, // Number of fruits to count
    numberButtons: [], // Array of number button elements
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
 * Attaches event listeners for window events.
 */
function attachEventListeners() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Listen for volume changes from main page
    window.addEventListener('volumechange', handleVolumeChange);
    // Attempt to start audio on first interaction (various input types)
    ['pointerdown', 'touchstart', 'keydown'].forEach(eventName => {
        document.addEventListener(eventName, handleFirstInteraction, { once: true });
    });
    
    // Dialog button handler
    if (continueButton) {
        continueButton.addEventListener('click', handleContinueClick);
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
 * Handles the first user interaction to start audio (browser requires user interaction).
 */
function handleFirstInteraction() {
    requestBackgroundAudioStart();
}

/**
 * Retrieves and caches references to all important DOM elements.
 */
function cacheDomElements() {
    titleEl = document.getElementById('game3-title');
    instructionsEl = document.getElementById('instructions-text');
    fruitField = document.getElementById('fruit-field');
    numberButtonsContainer = document.getElementById('number-buttons');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
}

/**
 * Sets static text (title, instructions, etc.) when the game first loads.
 */
function populateStaticTexts() {
    if (titleEl) {
        titleEl.textContent = STRINGS.title;
    }
    if (instructionsEl) {
        instructionsEl.textContent = STRINGS.instructions;
    }
}

/**
 * Starts a new round by selecting a random fruit, count, and placing objects.
 */
function startNewRound() {
    if (!fruitField || !numberButtonsContainer) {
        console.error('Required DOM elements missing.');
        return;
    }

    if (FRUITS.length === 0) {
        console.warn('No fruits defined in STRINGS.fruits.');
        if (instructionsEl) {
            instructionsEl.textContent = 'Resources missing: no fruits are defined.';
        }
        return;
    }

    // Select a random fruit emoji (different from previous round)
    let newFruit;
    do {
        newFruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    } while (newFruit === state.currentFruit && FRUITS.length > 1);
    state.currentFruit = newFruit;

    // Generate random count between MIN_COUNT and MAX_COUNT
    state.currentCount = Math.floor(Math.random() * (MAX_COUNT - MIN_COUNT + 1)) + MIN_COUNT;

    // Clear previous round
    clearFruitField();
    createNumberButtons();

    // Create a temporary fruit to get actual rendered size
    const tempFruit = createFruitObject(state.currentFruit);
    tempFruit.style.visibility = 'hidden';
    tempFruit.style.position = 'absolute';
    tempFruit.style.left = '-9999px';
    fruitField.appendChild(tempFruit);

    // Get actual rendered dimensions after CSS is applied
    const fruitRect = tempFruit.getBoundingClientRect();
    const actualFruitWidth = fruitRect.width;
    const actualFruitHeight = fruitRect.height;

    // Remove temporary fruit
    tempFruit.remove();

    // Calculate positions for all fruits using actual rendered size
    const containerRect = fruitField.getBoundingClientRect();
    const positions = calculateNonOverlappingPositions(
        state.currentCount,
        containerRect.width,
        containerRect.height,
        actualFruitWidth,
        actualFruitHeight
    );

    // Create and place fruits
    positions.forEach((pos, index) => {
        const fruit = createFruitObject(state.currentFruit);
        fruit.style.left = `${pos.x}px`;
        fruit.style.top = `${pos.y}px`;
        // Set unique animation delay for independent floating motion
        const floatPhase = (index * FLOAT_PHASE_MULTIPLIER) % FLOAT_PHASE_MAX;
        fruit.style.setProperty('--float-phase', floatPhase);
        fruitField.appendChild(fruit);
    });

    // Attempt to start ambience immediately (falls back to user interaction if blocked)
    requestBackgroundAudioStart();
}

/**
 * Creates a fruit object element.
 * @param {string} emoji - The fruit emoji to display
 * @returns {HTMLElement} The fruit element
 */
function createFruitObject(emoji) {
    const fruit = document.createElement('div');
    fruit.className = 'fruit-object';
    fruit.textContent = emoji;
    fruit.setAttribute('aria-label', STRINGS.aria.fruit(emoji));
    return fruit;
}

/**
 * Clears the game board of fruit objects.
 */
function clearFruitField() {
    if (fruitField) {
        fruitField.innerHTML = '';
    }
}

/**
 * Creates number buttons 1-20 at the bottom of the screen.
 */
function createNumberButtons() {
    if (!numberButtonsContainer) {
        return;
    }

    // Clear previous buttons
    numberButtonsContainer.innerHTML = '';
    state.numberButtons = [];

    // Create buttons for numbers 1-20
    for (let i = MIN_COUNT; i <= MAX_COUNT; i++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'number-button';
        button.textContent = i;
        button.setAttribute('aria-label', STRINGS.aria.numberButton(i));
        button.addEventListener('click', () => handleNumberClick(i, button));
        numberButtonsContainer.appendChild(button);
        state.numberButtons.push(button);
    }
}

/**
 * Handles clicks on number buttons.
 * @param {number} selectedNumber - The number that was clicked
 * @param {HTMLElement} button - The button element that was clicked
 */
async function handleNumberClick(selectedNumber, button) {
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

    if (selectedNumber === state.currentCount) {
        // Correct answer - show feedback, show dialog, and play sound
        button.classList.add('number-button--correct');
        // Show dialog immediately, then play sound
        showCompletionDialog();
        // Play success sound (don't wait for it)
        playSuccessSound().catch(error => {
            console.warn('Could not play success sound:', error);
        });
    } else {
        // Wrong answer - show feedback and play error sound
        button.classList.add('number-button--wrong');
        // Play error sound
        playErrorSound().catch(error => {
            console.warn('Could not play error sound:', error);
        });
        setTimeout(() => {
            button.classList.remove('number-button--wrong');
        }, 400);
    }
}

/**
 * Calculates random positions for fruit objects without overlapping.
 * @param {number} count - Number of objects to place
 * @param {number} containerWidth - Container width
 * @param {number} containerHeight - Container height
 * @param {number} objectWidth - Object width
 * @param {number} objectHeight - Object height
 * @returns {Array<{x: number, y: number}>} Array of positions
 */
function calculateNonOverlappingPositions(count, containerWidth, containerHeight, objectWidth, objectHeight) {
    const positions = [];
    // Increase padding significantly on smaller screens to prevent overlapping
    // Use at least minimum padding or ratio of object width, whichever is larger
    const padding = Math.max(POSITIONING_PADDING_MIN, objectWidth * POSITIONING_PADDING_RATIO);
    const maxAttempts = POSITIONING_MAX_ATTEMPTS;
    
    // On small screens, prefer grid layout for better spacing
    const isSmallScreen = containerWidth < SMALL_SCREEN_BREAKPOINT;
    const useGrid = isSmallScreen || count > 5;
    
    if (useGrid) {
        // Use grid-based placement for small screens or many objects, with random offsets for organic look
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const cellWidth = (containerWidth - padding * 2) / cols;
        const cellHeight = (containerHeight - padding * 2) / rows;
        
        // Calculate maximum safe offset (ensure objects stay within bounds and don't overlap)
        const maxOffsetX = Math.min(GRID_OFFSET_MAX, (cellWidth - objectWidth) * GRID_OFFSET_RATIO);
        const maxOffsetY = Math.min(GRID_OFFSET_MAX, (cellHeight - objectHeight) * GRID_OFFSET_RATIO);
        
        for (let i = 0; i < count; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Base grid position
            const baseX = padding + col * cellWidth + (cellWidth - objectWidth) / 2;
            const baseY = padding + row * cellHeight + (cellHeight - objectHeight) / 2;
            
            // Add random offset for organic look
            const offsetX = (Math.random() - 0.5) * maxOffsetX * 2;
            const offsetY = (Math.random() - 0.5) * maxOffsetY * 2;
            
            // Ensure position stays within container bounds
            const x = Math.max(padding, Math.min(containerWidth - objectWidth - padding, baseX + offsetX));
            const y = Math.max(padding, Math.min(containerHeight - objectHeight - padding, baseY + offsetY));
            
            positions.push({ x, y });
        }
        return positions;
    }
    
    // Random placement for larger screens with fewer objects
    for (let i = 0; i < count; i++) {
        let attempts = 0;
        let validPosition = false;
        let x, y;
        
        while (!validPosition && attempts < maxAttempts) {
            // Random position with margins
            const maxX = containerWidth - objectWidth - padding;
            const maxY = containerHeight - objectHeight - padding;
            x = Math.random() * maxX + padding;
            y = Math.random() * maxY + padding;
            
            // Check if this position overlaps with existing objects using proper collision detection
            validPosition = true;
            for (const existingPos of positions) {
                // Calculate center points
                const centerX1 = x + objectWidth / 2;
                const centerY1 = y + objectHeight / 2;
                const centerX2 = existingPos.x + objectWidth / 2;
                const centerY2 = existingPos.y + objectHeight / 2;
                
                // Check if rectangles overlap
                const horizontalOverlap = Math.abs(centerX1 - centerX2) < (objectWidth + padding);
                const verticalOverlap = Math.abs(centerY1 - centerY2) < (objectHeight + padding);
                
                if (horizontalOverlap && verticalOverlap) {
                    validPosition = false;
                    break;
                }
            }
            
            attempts++;
        }
        
        // If we didn't find a good position, use a fallback grid position
        if (!validPosition) {
            const cols = Math.ceil(Math.sqrt(count));
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cellWidth = (containerWidth - padding * 2) / cols;
            const cellHeight = (containerHeight - padding * 2) / Math.ceil(count / cols);
            x = padding + col * cellWidth + (cellWidth - objectWidth) / 2;
            y = padding + row * cellHeight + (cellHeight - objectHeight) / 2;
        }
        
        positions.push({ x, y });
    }
    
    return positions;
}

/**
 * Automatically pauses the game when the window loses focus (mobile/tabs).
 */
function handleVisibilityChange() {
    if (document.hidden) {
        if (audioContext && audioContext.state === 'running') {
            audioContext.suspend().catch(error => {
                console.warn('Could not pause AudioContext:', error);
            });
        }
    } else {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(error => {
                console.warn('Could not resume AudioContext:', error);
            });
        }
        if (!backgroundSource) {
            requestBackgroundAudioStart();
        }
    }
}

/**
 * Attempts to start the looping ambience, respecting autoplay restrictions.
 */
function requestBackgroundAudioStart() {
    if (state.audioStarted || state.audioStarting) {
        return;
    }

    state.audioStarting = true;
    startBackgroundAmbience()
        .then(() => {
            if (audioContext && audioContext.state === 'running') {
                state.audioStarted = true;
            }
        })
        .catch(error => {
            console.warn('Could not start background audio yet:', error);
        })
        .finally(() => {
            state.audioStarting = false;
        });
}

/**
 * Starts background ambience if one is defined.
 */
async function startBackgroundAmbience() {
    if (!STRINGS.ambience?.track) {
        return;
    }

    await ensureAudioContext();

    if (!audioContext) {
        return;
    }

    if (!backgroundBuffer) {
        backgroundBuffer = await loadAudioBuffer(STRINGS.ambience.track);
    }

    if (!backgroundBuffer) {
        return;
    }

    stopBackgroundAmbience();

    backgroundSource = audioContext.createBufferSource();
    backgroundSource.buffer = backgroundBuffer;
    backgroundSource.loop = true;

    backgroundGain = audioContext.createGain();
    // Get volume from shared volume control (defaults to 0.35 if not available)
    const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
    backgroundGain.gain.setValueAtTime(volume, audioContext.currentTime);

    backgroundSource.connect(backgroundGain);
    backgroundGain.connect(audioContext.destination);
    backgroundSource.start();
}

/**
 * Stops the background ambience track if it's playing.
 */
function stopBackgroundAmbience() {
    if (backgroundSource) {
        try {
            backgroundSource.stop();
        } catch (error) {
            console.warn('Could not stop background source:', error);
        }
        backgroundSource.disconnect();
        backgroundSource = null;
    }
    if (backgroundGain) {
        backgroundGain.disconnect();
        backgroundGain = null;
    }
    state.audioStarted = false;
    state.audioStarting = false;
}

/**
 * Ensures that AudioContext exists and is running.
 */
async function ensureAudioContext() {
    if (audioContext) {
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch (error) {
                console.warn('Could not resume AudioContext:', error);
            }
        }
        return;
    }

    try {
        audioContext = new AudioContext();
        // If context starts suspended, try to resume it
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch (error) {
                console.warn('Could not resume newly created AudioContext:', error);
            }
        }
    } catch (error) {
        console.warn('AudioContext could not be initialized:', error);
        audioContext = null;
    }
}

/**
 * Generates a smooth envelope value for tone synthesis.
 * @param {number} index Sample index
 * @param {number} attackFrames Attack frames
 * @param {number} sustainFrames Sustain frames
 * @param {number} releaseFrames Release frames
 * @returns {number} Envelope value between 0 and 1
 */
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

/**
 * Plays a synthetic error sound - a short descending tone.
 * @returns {Promise} Resolves when the sound finishes playing
 */
async function playErrorSound() {
    await ensureAudioContext();

    if (!audioContext) {
        return Promise.resolve();
    }

    // Ensure audio context is running
    if (audioContext.state !== 'running') {
        try {
            await audioContext.resume();
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
            console.warn('Could not resume AudioContext for error sound:', error);
            return Promise.resolve();
        }
    }

    if (audioContext.state !== 'running') {
        return Promise.resolve();
    }

    // Get global volume and scale it for the error sound
    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const actualVolume = globalVolume * 0.4; // Quieter error sound

    const sampleRate = audioContext.sampleRate;
    const duration = 0.2; // Short error sound
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a descending tone (G# to F to C)
    const frequencies = [415.3, 349.2, 261.6]; // G#4, F4, C4
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

        // Generate sine wave with envelope
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
            console.warn('Could not start error sound:', error);
            cleanup();
        }
    });
}

/**
 * Plays a synthetic success sound - a pleasant rising arpeggio.
 * @returns {Promise} Resolves when the sound finishes playing
 */
async function playSuccessSound() {
    await ensureAudioContext();

    if (!audioContext) {
        console.warn('No audio context available for success sound');
        return Promise.resolve();
    }

    // Ensure audio context is running (important for subsequent plays)
    if (audioContext.state !== 'running') {
        try {
            await audioContext.resume();
            // Wait a moment to ensure context is fully resumed
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
            console.warn('Could not resume AudioContext for success sound:', error);
            return Promise.resolve();
        }
    }

    // Verify context is actually running
    if (audioContext.state !== 'running') {
        console.warn('AudioContext not running, state:', audioContext.state);
        return Promise.resolve();
    }

    // Get global volume and scale it for the success sound
    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const actualVolume = globalVolume * 0.7; // Success sound volume (70% of global volume)

    const sampleRate = audioContext.sampleRate;
    const duration = 0.6; // Total duration in seconds
    const frameCount = Math.floor(sampleRate * duration);
    
    // Create a fresh buffer each time
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a pleasant C major arpeggio (C-E-G-C)
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5
    const noteDuration = duration / frequencies.length;
    const noteFrameCount = Math.floor(sampleRate * noteDuration);

    // Generate envelope parameters
    const attackFrames = Math.floor(sampleRate * 0.01);
    const releaseFrames = Math.floor(sampleRate * 0.05);

    for (let i = 0; i < frameCount; i += 1) {
        const t = i / sampleRate;
        const noteIndex = Math.min(Math.floor(t / noteDuration), frequencies.length - 1);
        const frequency = frequencies[noteIndex];
        
        // Calculate position within current note
        const noteStartFrame = noteIndex * noteFrameCount;
        const noteFrame = i - noteStartFrame;
        const noteTime = noteFrame / sampleRate;

        // Calculate envelope for this note
        const noteAttackFrames = Math.min(attackFrames, Math.floor(noteFrameCount * 0.2));
        const noteReleaseFrames = Math.min(releaseFrames, Math.floor(noteFrameCount * 0.3));
        const noteSustainFrames = noteFrameCount - noteAttackFrames - noteReleaseFrames;

        const envelope = calculateEnvelopeValue(
            noteFrame,
            noteAttackFrames,
            noteSustainFrames,
            noteReleaseFrames
        );

        // Generate sine wave with envelope
        data[i] = envelope * Math.sin(2 * Math.PI * frequency * noteTime) * 0.5;
    }

    // Create fresh source and gain node each time
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
            // Use currentTime to ensure proper timing
            source.start(now);
            source.stop(now + duration + 0.05);
        } catch (error) {
            console.warn('Could not start success sound:', error, 'Context state:', audioContext.state);
            cleanup();
        }
    });
}

/**
 * Shows the completion dialog with continue option.
 */
function showCompletionDialog() {
    if (!completionDialog || !completionTitle || !completionMessage || !continueButton) {
        return;
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
    
    completionDialog.hidden = false;
}

/**
 * Hides the completion dialog.
 */
function hideCompletionDialog() {
    if (completionDialog) {
        completionDialog.hidden = true;
    }
}

/**
 * Handles the continue button click - starts a new round.
 */
function handleContinueClick() {
    hideCompletionDialog();
    startNewRound();
}

/**
 * Loads and caches an audio file as an AudioBuffer.
 * Returns the buffer synchronously if cached, or a Promise if it needs to be loaded.
 */
function loadAudioBuffer(url) {
    // Return cached buffer immediately (synchronously) if available
    if (audioBufferCache.has(url)) {
        return audioBufferCache.get(url);
    }

    // If not cached, return a promise that loads and caches it
    return (async () => {
        if (!audioContext) {
            return null;
        }

        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`Could not load audio file: ${url}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        try {
            const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBufferCache.set(url, decodedBuffer);
            return decodedBuffer;
        } catch (error) {
            console.warn('Could not decode audio file:', error);
            return null;
        }
    })();
}

