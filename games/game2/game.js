// Animal Sounds (Game 2) – game logic with audio and animal images
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME2_STRINGS;
const ANIMALS = Array.isArray(STRINGS.animals) ? STRINGS.animals.slice() : [];

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let startButton = null;
let animalField = null;
let completionDialog = null;
let completionTitle = null;
let completionMessage = null;
let retryButton = null;
let quitButton = null;

// Audio-related resources
let audioContext = null;
let backgroundBuffer = null;
let backgroundSource = null;
let backgroundGain = null;
const audioBufferCache = new Map();
// Track currently playing animal sound and card
let currentAnimalSource = null;
let currentAnimalCard = null;

// Game state variables
const state = {
    gameRunning: false,
    gamePaused: false,
    foundCount: 0
};

/**
 * Initializes the game when the DOM is ready.
 */
window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachEventListeners();
    resetGameUi();
});

/**
 * Retrieves and caches references to all important DOM elements.
 */
function cacheDomElements() {
    titleEl = document.getElementById('game2-title');
    instructionsEl = document.getElementById('instructions-text');
    startButton = document.getElementById('start-button');
    animalField = document.getElementById('animal-field');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    retryButton = document.getElementById('retry-button');
    quitButton = document.getElementById('quit-button');
}

/**
 * Sets static text (title, button labels, etc.) when the game first loads.
 */
function populateStaticTexts() {
    if (titleEl) {
        titleEl.textContent = STRINGS.title;
    }
    if (startButton) {
        startButton.textContent = STRINGS.labels.start;
    }
    if (retryButton) {
        retryButton.textContent = STRINGS.labels.retry;
    }
    if (quitButton) {
        quitButton.textContent = STRINGS.labels.quit;
    }
    if (completionTitle) {
        completionTitle.textContent = STRINGS.dialog.title;
    }
    if (completionMessage) {
        completionMessage.textContent = STRINGS.dialog.subtitle;
    }
}

/**
 * Attaches all event listeners for buttons and window events.
 */
function attachEventListeners() {
    if (startButton) {
        startButton.addEventListener('click', handleStartButtonClick);
    }
    if (retryButton) {
        retryButton.addEventListener('click', handleRetryClick);
    }
    if (quitButton) {
        quitButton.addEventListener('click', handleQuitClick);
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Handles clicks on the start button and toggles between start, pause, and resume.
 */
function handleStartButtonClick() {
    if (!state.gameRunning) {
        startNewGame();
        return;
    }

    if (state.gamePaused) {
        resumeGame();
        return;
    }

    pauseGame();
}

/**
 * Starts a new game by resetting state, creating animal cards, and starting audio.
 */
function startNewGame() {
    if (!animalField) {
        console.error('Animal field missing from DOM.');
        return;
    }

    if (ANIMALS.length === 0) {
        console.warn('No animals defined in STRINGS.animals.');
        setInstructionsText('Resources missing: no animals are defined.');
        return;
    }

    state.gameRunning = true;
    state.gamePaused = false;
    state.foundCount = 0;

    clearAnimalField();
    hideCompletionDialog();
    setInstructionsText(STRINGS.instructions);
    if (startButton) {
        startButton.textContent = STRINGS.labels.pause;
    }

    const shuffledAnimals = shuffleArray(ANIMALS.slice());
    
    // Create a temporary card to get actual rendered size
    const tempCard = createAnimalCard(shuffledAnimals[0]);
    tempCard.style.visibility = 'hidden';
    tempCard.style.position = 'absolute';
    tempCard.style.left = '-9999px';
    animalField.appendChild(tempCard);
    
    // Get actual rendered dimensions after CSS is applied
    const cardRect = tempCard.getBoundingClientRect();
    const actualCardWidth = cardRect.width;
    const actualCardHeight = cardRect.height;
    
    // Remove temporary card
    tempCard.remove();
    
    // Calculate positions for all cards using actual rendered size
    const containerRect = animalField.getBoundingClientRect();
    const positions = calculateNonOverlappingPositions(
        shuffledAnimals.length,
        containerRect.width,
        containerRect.height,
        actualCardWidth,
        actualCardHeight
    );
    
    // Create cards and place them
    shuffledAnimals.forEach((animal, index) => {
        const card = createAnimalCard(animal);
        const pos = positions[index];
        card.style.left = `${pos.x}px`;
        card.style.top = `${pos.y}px`;
        // Set unique animation delay for independent floating motion
        const floatPhase = (index * 0.4) % 3; // Spread delays across 0-3 seconds
        card.style.setProperty('--float-phase', floatPhase);
        animalField.appendChild(card);
    });

    if (animalField) {
        animalField.classList.remove('animal-field--paused');
    }

    startBackgroundAmbience().catch(error => {
        console.warn('Could not start background audio:', error);
    });
}

/**
 * Pauses the game, updates UI, and temporarily stops audio streams.
 */
function pauseGame() {
    state.gamePaused = true;
    setInstructionsText(STRINGS.pausedInstructions);
    if (startButton) {
        startButton.textContent = STRINGS.labels.resume;
    }
    if (animalField) {
        animalField.classList.add('animal-field--paused');
    }

    if (audioContext && audioContext.state === 'running') {
        audioContext.suspend().catch(error => {
            console.warn('Could not pause AudioContext:', error);
        });
    }
}

/**
 * Resumes the game after a pause and continues background audio.
 */
function resumeGame() {
    state.gamePaused = false;
    setInstructionsText(STRINGS.instructions);
    if (startButton) {
        startButton.textContent = STRINGS.labels.pause;
    }
    if (animalField) {
        animalField.classList.remove('animal-field--paused');
    }

    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(error => {
            console.warn('Could not resume AudioContext:', error);
        });
    } else if (!backgroundSource) {
        // If the source was stopped completely, we need to restart it
        startBackgroundAmbience().catch(error => {
            console.warn('Could not restart background audio:', error);
        });
    }
}

/**
 * Clears the game board and resets UI to initial state.
 */
function resetGameUi() {
    state.gameRunning = false;
    state.gamePaused = false;
    state.foundCount = 0;

    setInstructionsText(STRINGS.instructions);

    if (startButton) {
        startButton.textContent = STRINGS.labels.start;
        startButton.disabled = false;
    }

    // Stop any playing animal sound and clear references
    stopCurrentAnimalSound();
    currentAnimalCard = null;

    clearAnimalField();
    if (animalField) {
        animalField.classList.remove('animal-field--paused');
    }
    hideCompletionDialog();
    stopBackgroundAmbience();
}

/**
 * Creates a button element representing an animal card.
 */
function createAnimalCard(animal) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'animal-card';
    card.dataset.animalId = animal.id;

    const ariaLabel = typeof STRINGS.aria?.animal === 'function'
        ? STRINGS.aria.animal(animal.name)
        : (animal.name || 'Djur');
    card.setAttribute('aria-label', ariaLabel);

    const image = document.createElement('img');
    image.src = animal.image || '';
    image.alt = animal.name || '';
    image.className = 'animal-card__image';

    card.appendChild(image);

    const activateCard = () => handleAnimalCardInteraction(card, animal);

    card.addEventListener('click', activateCard);
    card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activateCard();
        }
    });

    return card;
}

/**
 * Handles clicks or Enter/Space on an animal card.
 */
function handleAnimalCardInteraction(card, animal) {
    if (!state.gameRunning || state.gamePaused) {
        return;
    }

    if (card.classList.contains('animal-card--found') || card.disabled) {
        return;
    }

    // If another sound is currently playing, stop it and remove that card immediately
    if (currentAnimalSource && currentAnimalCard) {
        stopCurrentAnimalSound();
        removeCardImmediately(currentAnimalCard);
    }

    // Disable card immediately to prevent multiple clicks
    card.disabled = true;
    currentAnimalCard = card;

    // Play sound and wait for it to finish before starting removal animation
    // Store card reference in closure to ensure we can remove it even if currentAnimalCard changes
    const cardToRemove = card;
    const soundPromise = playAnimalSound(animal)
        .then(() => {
            // Sound finished, now add the class to trigger removal animation
            // Remove the card if it still exists and hasn't been removed yet
            // Only remove if this is still the current card (hasn't been interrupted by another click)
            if (cardToRemove && 
                cardToRemove.parentNode && 
                !cardToRemove.classList.contains('animal-card--found') &&
                currentAnimalCard === cardToRemove) {
                removeCardAfterSound(cardToRemove);
            }
        })
        .catch(error => {
            console.warn(`Could not play sound for ${animal.name}:`, error);
            // If sound fails, remove immediately
            if (cardToRemove && cardToRemove.parentNode && !cardToRemove.classList.contains('animal-card--found')) {
                if (currentAnimalCard === cardToRemove) {
                    removeCardAfterSound(cardToRemove);
                }
            }
        });

    state.foundCount += 1;

    if (state.foundCount >= ANIMALS.length) {
        // Wait for the last sound to finish before showing the finish popup
        soundPromise.then(() => {
            finishGame();
        }).catch(() => {
            // If sound fails, still finish the game
            finishGame();
        });
    }
}

/**
 * Stops the currently playing animal sound.
 */
function stopCurrentAnimalSound() {
    if (currentAnimalSource) {
        try {
            currentAnimalSource.stop();
        } catch (error) {
            // Source may have already stopped
        }
        try {
            currentAnimalSource.disconnect();
        } catch (error) {
            // Source may already be disconnected
        }
        currentAnimalSource = null;
    }
}

/**
 * Removes a card immediately without waiting for sound.
 */
function removeCardImmediately(card) {
    if (card && !card.classList.contains('animal-card--found')) {
        // Clear reference if this is the current card
        if (currentAnimalCard === card) {
            currentAnimalCard = null;
        }
        card.classList.add('animal-card--found');
        card.addEventListener('animationend', () => {
            if (card && card.parentNode) {
                card.remove();
            }
        }, { once: true });
    }
}

/**
 * Removes a card after its sound has finished playing.
 */
function removeCardAfterSound(card) {
    if (card && card.parentNode && !card.classList.contains('animal-card--found')) {
        // Stop any existing animations first
        card.style.animation = 'none';
        // Force a reflow
        void card.offsetHeight;
        // Now add the class and set the animation
        card.classList.add('animal-card--found');
        // Explicitly set animation style to ensure it takes effect
        card.style.animation = 'animal-pop-out 320ms ease forwards';
        card.style.animationPlayState = 'running';
        // Force multiple reflows to ensure animation starts
        void card.offsetHeight;
        void card.getBoundingClientRect();
        requestAnimationFrame(() => {
            void card.offsetHeight;
        });
        card.addEventListener('animationend', () => {
            if (card && card.parentNode) {
                card.remove();
            }
            if (currentAnimalCard === card) {
                currentAnimalCard = null;
            }
        }, { once: true });
    }
}

/**
 * Finishes the game, shows dialog, and stops background audio.
 */
function finishGame() {
    state.gameRunning = false;
    state.gamePaused = false;

    setInstructionsText(STRINGS.completionMessage);
    if (startButton) {
        startButton.textContent = STRINGS.labels.start;
    }
    if (animalField) {
        animalField.classList.remove('animal-field--paused');
    }

    stopBackgroundAmbience();
    showCompletionDialog();
}

/**
 * Shows the completion dialog with the appropriate message.
 */
function showCompletionDialog() {
    if (!completionDialog) {
        return;
    }

    if (completionMessage) {
        completionMessage.textContent = STRINGS.completionMessage;
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
 * Clears the game board of animal cards.
 */
function clearAnimalField() {
    if (!animalField) {
        return;
    }
    animalField.innerHTML = '';
}

/**
 * Resets the game to initial state without starting play immediately.
 */
function handleRetryClick() {
    resetGameUi();
}

/**
 * Takes the player back to the main menu.
 */
function handleQuitClick() {
    window.location.href = '../../index.html';
}

/**
 * Automatically pauses the game when the window loses focus (mobile/tabs).
 */
function handleVisibilityChange() {
    if (document.hidden && state.gameRunning && !state.gamePaused) {
        pauseGame();
    }
}

/**
 * Updates the instruction text on the page.
 */
function setInstructionsText(text) {
    if (instructionsEl) {
        instructionsEl.textContent = text;
    }
}

/**
 * Plays the animal sound associated with the clicked card.
 * Returns a promise that resolves when the sound finishes playing.
 */
async function playAnimalSound(animal) {
    if (!animal?.sound) {
        return Promise.resolve();
    }

    await ensureAudioContext();

    if (!audioContext) {
        return Promise.resolve();
    }

    // Ensure audio context is running (important when background sound is playing)
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Could not resume AudioContext for animal sound:', error);
        }
    }

    const buffer = await loadAudioBuffer(animal.sound);
    if (!buffer) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        try {
            // Stop any previously playing animal sound
            stopCurrentAnimalSound();
            
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            
            // Store reference to current source
            currentAnimalSource = source;
            
            let resolved = false;
            let timeoutId = null;
            
            const doResolve = () => {
                if (!resolved) {
                    resolved = true;
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    // Only clear currentAnimalSource if this is still the current source
                    if (currentAnimalSource === source) {
                        currentAnimalSource = null;
                    }
                    resolve();
                }
            };
            
            // Resolve promise when sound finishes
            source.onended = () => {
                doResolve();
            };
            
            // Fallback: resolve after buffer duration + buffer in case onended doesn't fire
            // This is important because onended might not fire reliably with background sounds
            // Calculate duration in milliseconds, ensure minimum of 500ms
            const durationMs = Math.max(500, (buffer.duration || 1) * 1000);
            timeoutId = setTimeout(() => {
                doResolve();
            }, durationMs + 500); // 500ms buffer for reliability
            
            try {
                source.start(0);
            } catch (error) {
                // If start fails, resolve immediately
                doResolve();
                reject(error);
            }
        } catch (error) {
            reject(error);
        }
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
    backgroundGain.gain.setValueAtTime(0.35, audioContext.currentTime);

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
 * Loads and caches an audio file as an AudioBuffer.
 */
async function loadAudioBuffer(url) {
    if (audioBufferCache.has(url)) {
        return audioBufferCache.get(url);
    }

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
}

/**
 * Helper function that shuffles an array (Fisher–Yates).
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Calculates random positions for animal cards without overlapping.
 * @param {number} count - Number of cards to place
 * @param {number} containerWidth - Container width
 * @param {number} containerHeight - Container height
 * @param {number} cardWidth - Card width
 * @param {number} cardHeight - Card height
 * @returns {Array<{x: number, y: number}>} Array of positions
 */
function calculateNonOverlappingPositions(count, containerWidth, containerHeight, cardWidth, cardHeight) {
    const positions = [];
    // Increase padding significantly on smaller screens to prevent overlapping
    // Use at least 40px or 20% of card width, whichever is larger
    const padding = Math.max(40, cardWidth * 0.2);
    const maxAttempts = 500; // Increased attempts for better placement
    
    // On small screens, prefer grid layout for better spacing
    const isSmallScreen = containerWidth < 600;
    const useGrid = isSmallScreen || count > 5;
    
    if (useGrid) {
        // Use grid-based placement for small screens or many cards, with random offsets for organic look
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const cellWidth = (containerWidth - padding * 2) / cols;
        const cellHeight = (containerHeight - padding * 2) / rows;
        
        // Calculate maximum safe offset (ensure cards stay within bounds and don't overlap)
        const maxOffsetX = Math.min(25, (cellWidth - cardWidth) * 0.3);
        const maxOffsetY = Math.min(25, (cellHeight - cardHeight) * 0.3);
        
        for (let i = 0; i < count; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Base grid position
            const baseX = padding + col * cellWidth + (cellWidth - cardWidth) / 2;
            const baseY = padding + row * cellHeight + (cellHeight - cardHeight) / 2;
            
            // Add random offset for organic look
            const offsetX = (Math.random() - 0.5) * maxOffsetX * 2;
            const offsetY = (Math.random() - 0.5) * maxOffsetY * 2;
            
            // Ensure position stays within container bounds
            const x = Math.max(padding, Math.min(containerWidth - cardWidth - padding, baseX + offsetX));
            const y = Math.max(padding, Math.min(containerHeight - cardHeight - padding, baseY + offsetY));
            
            positions.push({ x, y });
        }
        return positions;
    }
    
    // Random placement for larger screens with fewer cards
    for (let i = 0; i < count; i++) {
        let attempts = 0;
        let validPosition = false;
        let x, y;
        
        while (!validPosition && attempts < maxAttempts) {
            // Random position with margins
            const maxX = containerWidth - cardWidth - padding;
            const maxY = containerHeight - cardHeight - padding;
            x = Math.random() * maxX + padding;
            y = Math.random() * maxY + padding;
            
            // Check if this position overlaps with existing cards using proper collision detection
            validPosition = true;
            for (const existingPos of positions) {
                // Calculate center points
                const centerX1 = x + cardWidth / 2;
                const centerY1 = y + cardHeight / 2;
                const centerX2 = existingPos.x + cardWidth / 2;
                const centerY2 = existingPos.y + cardHeight / 2;
                
                // Check if rectangles overlap
                const horizontalOverlap = Math.abs(centerX1 - centerX2) < (cardWidth + padding);
                const verticalOverlap = Math.abs(centerY1 - centerY2) < (cardHeight + padding);
                
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
            x = padding + col * cellWidth + (cellWidth - cardWidth) / 2;
            y = padding + row * cellHeight + (cellHeight - cardHeight) / 2;
        }
        
        positions.push({ x, y });
    }
    
    return positions;
}
