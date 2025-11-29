// Animal Sounds (Game 2) – game logic with audio and animal images
'use strict';

// Loads local strings and resource definitions
const STRINGS = window.GAME2_STRINGS;
const ANIMALS = Array.isArray(STRINGS.animals) ? STRINGS.animals.slice() : [];

// Constants for animations and timing
const ANIMATION_DURATION_MS = 320; // Duration of card removal animation
const AUDIO_TIMEOUT_BUFFER_MS = 500; // Buffer time for audio timeout fallback
const MIN_AUDIO_DURATION_MS = 500; // Minimum audio duration for timeout calculation
// Background volume is now controlled from main page volume control
const FLOAT_PHASE_MULTIPLIER = 0.4; // Multiplier for spreading float animation phases
const FLOAT_PHASE_MAX = 3; // Maximum float phase in seconds
const POSITIONING_PADDING_MIN = 40; // Minimum padding for card positioning (px)
const POSITIONING_PADDING_RATIO = 0.2; // Padding as ratio of card width
const POSITIONING_MAX_ATTEMPTS = 500; // Maximum attempts to find non-overlapping position
const SMALL_SCREEN_BREAKPOINT = 600; // Screen width threshold for small screen layout (px)
const GRID_OFFSET_MAX = 25; // Maximum random offset for grid-based positioning (px)
const GRID_OFFSET_RATIO = 0.3; // Grid offset as ratio of cell size

// DOM references shared between functions
let titleEl = null;
let instructionsEl = null;
let animalField = null;
let completionDialog = null;
let completionTitle = null;
let completionMessage = null;
let completionVideo = null;
let continueButton = null;

// Audio-related resources
let audioContext = null;
let backgroundBuffer = null;
let backgroundSource = null;
let backgroundGain = null;
const audioBufferCache = new Map();
// Track currently playing animal sound and card
let currentAnimalSource = null;
let currentAnimalCard = null;
// Track animation frame for selected card
let selectedCardAnimationFrame = null;

// Game state variables
const state = {
    gameRunning: false,
    gamePaused: false,
    foundCount: 0,
    audioStarted: false,
    audioStarting: false,
    currentGameAnimalCount: 0, // Number of animals in the current game
    finishGameCalled: false // Flag to prevent multiple finishGame calls
};

/**
 * Initializes the game when the DOM is ready.
 */
window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    attachEventListeners();
    resetGameUi();
    requestBackgroundAudioStart();
    startNewGame(); // Start game automatically, similar to game 3
});

/**
 * Retrieves and caches references to all important DOM elements.
 */
function cacheDomElements() {
    titleEl = document.getElementById('game2-title');
    instructionsEl = document.getElementById('instructions-text');
    animalField = document.getElementById('animal-field');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    completionVideo = document.getElementById('completion-video');
    continueButton = document.getElementById('continue-button');

    // On touch devices (like tablets), prevent long-press context menu on the game area.
    // This helps small kids avoid triggering the “download / save image” dialog by accident.
    if (animalField) {
        animalField.addEventListener('contextmenu', event => {
            event.preventDefault();
        });
    }
}

/**
 * Sets static text (title, button labels, etc.) when the game first loads.
 */
function populateStaticTexts() {
    if (titleEl) {
        titleEl.textContent = STRINGS.title;
    }
    if (continueButton) {
        continueButton.textContent = STRINGS.labels.continue;
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
    if (continueButton) {
        continueButton.addEventListener('click', handleContinueClick);
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Listen for volume changes from main page
    window.addEventListener('volumechange', handleVolumeChange);
    ['pointerdown', 'touchstart', 'keydown'].forEach(eventName => {
        document.addEventListener(eventName, handleFirstAudioInteraction, { once: true });
    });
}

/**
 * Handles the first user interaction to kick off background ambience.
 */
function handleFirstAudioInteraction() {
    requestBackgroundAudioStart();
}

/**
 * Handles volume changes from the main page control.
 * @param {CustomEvent} event - Volume change event
 */
function handleVolumeChange(event) {
    const newVolume = event.detail.volume;
    
    // Update background ambience volume
    if (backgroundGain && audioContext && audioContext.state === 'running') {
        backgroundGain.gain.setValueAtTime(newVolume, audioContext.currentTime);
    }
    
    // Update completion video volume if it's playing
    if (completionVideo && !completionVideo.paused) {
        completionVideo.volume = newVolume;
    }
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
    state.finishGameCalled = false; // Reset finish flag for new game

    // Cancel any running animation frames from previous game FIRST
    // This must happen before clearAnimalField() to prevent animation from accessing removed cards
    if (selectedCardAnimationFrame) {
        cancelAnimationFrame(selectedCardAnimationFrame);
        selectedCardAnimationFrame = null;
    }
    
    // Stop any playing animal sound
    stopCurrentAnimalSound();
    currentAnimalCard = null;
    
    // Clear the field - this removes all cards from DOM
    clearAnimalField();
    
    // Double-check: ensure animation frame is null after clearing
    // (in case clearAnimalField triggered any callbacks)
    if (selectedCardAnimationFrame) {
        cancelAnimationFrame(selectedCardAnimationFrame);
        selectedCardAnimationFrame = null;
    }
    hideCompletionDialog();
    setInstructionsText(STRINGS.instructions);

    // Randomly select 6 animals from the available pool
    const animalsToUse = ANIMALS.length > 6 
        ? shuffleArray(ANIMALS.slice()).slice(0, 6)
        : ANIMALS.slice();
    
    // Store the count for completion check
    state.currentGameAnimalCount = animalsToUse.length;
    
    const shuffledAnimals = shuffleArray(animalsToUse);
    
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
        const floatPhase = (index * FLOAT_PHASE_MULTIPLIER) % FLOAT_PHASE_MAX;
        card.style.setProperty('--float-phase', floatPhase);
        animalField.appendChild(card);
    });

    if (animalField) {
        animalField.classList.remove('animal-field--paused');
    }

    requestBackgroundAudioStart();

    // Preload sound buffers for the selected animals only
    // This ensures all sounds are ready immediately when clicked
    ensureAudioContext().then(() => {
        if (audioContext && audioContext.state === 'running') {
            const preloadPromises = animalsToUse.map(animal => {
                const result = loadAudioBuffer(animal.sound);
                // If it's already cached (returns buffer directly), wrap in resolved promise
                // Otherwise it's already a promise
                return result instanceof Promise ? result : Promise.resolve(result);
            });
            Promise.all(preloadPromises).catch(() => {
                // Ignore errors during preload - sounds will load on demand
            });
        }
    });
}

/**
 * Pauses the game when window loses focus (e.g., tab switch).
 * Note: Resume is automatic when window regains focus.
 */
function pauseGame() {
    state.gamePaused = true;
    if (animalField) {
        animalField.classList.add('animal-field--paused');
    }

    // Stop any running animations when game is paused
    if (selectedCardAnimationFrame !== null) {
        try {
            cancelAnimationFrame(selectedCardAnimationFrame);
        } catch (e) {
            // Ignore cancellation errors
        }
        selectedCardAnimationFrame = null;
    }
    
    // Set animation flags on all cards to stop animations
    const cards = animalField?.querySelectorAll('.animal-card');
    if (cards) {
        cards.forEach(card => {
            if (card._stopAnimation) {
                card._stopAnimation();
            } else if (card._animState) {
                card._animState.shouldAnimate = false;
                if (card._animState.frameId !== null) {
                    try {
                        cancelAnimationFrame(card._animState.frameId);
                    } catch (e) {
                        // Ignore cancellation errors
                    }
                }
            }
        });
    }

    if (audioContext && audioContext.state === 'running') {
        audioContext.suspend().catch(error => {
            console.warn('Could not pause AudioContext:', error);
        });
    }
}

/**
 * Resumes the game when window regains focus.
 */
function resumeGame() {
    state.gamePaused = false;
    if (animalField) {
        animalField.classList.remove('animal-field--paused');
    }

    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(error => {
            console.warn('Could not resume AudioContext:', error);
        });
    } else if (!backgroundSource) {
        // If the source was stopped completely, we need to restart it
        requestBackgroundAudioStart();
    }
}

/**
 * Clears the game board and resets UI to initial state.
 */
function resetGameUi() {
    state.gameRunning = false;
    state.gamePaused = false;
    state.foundCount = 0;
    state.finishGameCalled = false; // Reset finish flag

    setInstructionsText(STRINGS.instructions);

    // Stop any playing animal sound and clear references
    stopCurrentAnimalSound();
    currentAnimalCard = null;
    
    // Cancel any running animation frames to prevent memory leaks
    if (selectedCardAnimationFrame) {
        cancelAnimationFrame(selectedCardAnimationFrame);
        selectedCardAnimationFrame = null;
    }

    clearAnimalField();
    if (animalField) {
        animalField.classList.remove('animal-field--paused');
        animalField.classList.remove('animal-field--has-selected');
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
        // Remove selected class from previous card
        currentAnimalCard.classList.remove('animal-card--selected');
        removeCardImmediately(currentAnimalCard);
    }

    // Prevent multiple clicks using pointer-events instead of disabled
    // (disabled buttons sometimes have rendering issues)
    card.style.pointerEvents = 'none';
    currentAnimalCard = card;
    // Remove transition to prevent interference with animation
    card.style.transition = 'none';
    // Force hardware acceleration
    card.style.willChange = 'transform';
    // Blur the card to remove any focus state that might interfere
    card.blur();
    // Add selected class FIRST so its animation rule is in place
    card.classList.add('animal-card--selected');
    
    // THEN add class to parent to pause other cards
    if (animalField) {
        animalField.classList.add('animal-field--has-selected');
    }
    
    // Manually animate using requestAnimationFrame for guaranteed mobile support
    // This directly manipulates transform, bypassing CSS animation issues
    const moveDuration = 1500; // 1.5 seconds
    const pulseDuration = 1200; // 1.2 seconds
    
    // Cancel any existing animation from a previous card
    // CRITICAL: Must cancel before starting new animation to prevent multiple loops
    if (selectedCardAnimationFrame !== null) {
        try {
            cancelAnimationFrame(selectedCardAnimationFrame);
        } catch (e) {
            // Ignore errors when cancelling
        }
        selectedCardAnimationFrame = null;
    }
    
    // Set this card as the current one
    currentAnimalCard = card;
    
    // Double-check: ensure no animation frame is scheduled
    if (selectedCardAnimationFrame !== null) {
        console.warn('Game2: Animation frame still set after cancellation, clearing');
        selectedCardAnimationFrame = null;
    }
    
    // Create a single animation state object stored on the card
    // This contains all animation state in one place for easy cleanup
    const animState = {
        shouldAnimate: true,
        frameId: null,
        startTime: performance.now()
    };
    card._animState = animState;
    
    // Single stop function that stops everything in one place
    const stopAnimation = () => {
        if (animState.frameId !== null) {
            try {
                cancelAnimationFrame(animState.frameId);
            } catch (e) {
                // Ignore cancellation errors
            }
            animState.frameId = null;
        }
        if (selectedCardAnimationFrame === animState.frameId) {
            selectedCardAnimationFrame = null;
        }
        animState.shouldAnimate = false;
        if (card._animState === animState) {
            delete card._animState;
        }
    };
    card._stopAnimation = stopAnimation;
    
    const animate = (currentTime) => {
        // Simplified: One compound check instead of many separate checks
        // Check ALL stop conditions in one place BEFORE doing any work
        // Check card existence first, then other conditions
        if (!card || !animState || !animState.shouldAnimate || 
            currentAnimalCard !== card || 
            !state.gameRunning || state.gamePaused || state.finishGameCalled ||
            !card.parentNode || !card.classList || !card.classList.contains('animal-card--selected')) {
            stopAnimation();
            return;
        }
        
        // Calculate animation progress
        const moveProgress = ((currentTime - animState.startTime) % moveDuration) / moveDuration;
        const pulseProgress = ((currentTime - animState.startTime) % pulseDuration) / pulseDuration;
        
        // Ease-in-out function
        const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        // Calculate move transform
        let moveX = 0, moveY = -10, rotate = 0;
        if (moveProgress < 0.2) {
            const t = easeInOut(moveProgress / 0.2);
            moveX = 18 * t;
            moveY = -10 + (-12) * t;
            rotate = 5 * t;
        } else if (moveProgress < 0.4) {
            const t = easeInOut((moveProgress - 0.2) / 0.2);
            moveX = 18 + (-33) * t;
            moveY = -22 + (10) * t;
            rotate = 5 + (-10) * t;
        } else if (moveProgress < 0.6) {
            const t = easeInOut((moveProgress - 0.4) / 0.2);
            moveX = -15 + (27) * t;
            moveY = -12 + (-14) * t;
            rotate = -5 + (9) * t;
        } else if (moveProgress < 0.8) {
            const t = easeInOut((moveProgress - 0.6) / 0.2);
            moveX = 12 + (-22) * t;
            moveY = -26 + (10) * t;
            rotate = 4 + (-8) * t;
        } else {
            const t = easeInOut((moveProgress - 0.8) / 0.2);
            moveX = -10 + (10) * t;
            moveY = -16 + (6) * t;
            rotate = -4 + (4) * t;
        }
        
        // Calculate pulse shadow
        const pulseIntensity = 0.5 + 0.2 * Math.sin(pulseProgress * Math.PI * 2);
        const shadowBlur = 24 + 4 * Math.sin(pulseProgress * Math.PI * 2);
        const shadowY = 10 + 2 * Math.sin(pulseProgress * Math.PI * 2);
        
        // Apply transform and shadow (wrap in try-catch in case card is removed)
        try {
            if (card && card.style) {
                card.style.setProperty('transform', `scale(1.18) translate3d(${moveX}px, ${moveY}px, 0) rotate(${rotate}deg)`, 'important');
                
                // Apply pulse shadow
                card.style.setProperty('box-shadow', `
                    rgba(251, 191, 36, ${pulseIntensity}) 0 0 ${shadowBlur}px,
                    rgba(251, 191, 36, ${pulseIntensity * 0.7}) 0 ${shadowY}px ${shadowBlur + 2}px,
                    rgba(0, 0, 0, 0.25) 0 4px 8px
                `, 'important');
                
                // Force repaint every frame by reading computed style (but less frequently)
                if (Math.floor(currentTime) % 100 < 16) { // Every ~100ms
                    void card.getBoundingClientRect();
                }
            }
        } catch (error) {
            // If DOM operations fail, stop animation
            console.warn('Game2: Error applying animation styles, stopping:', error);
            stopAnimation();
            return;
        }
        
        // Continue animation - schedule next frame
        animState.frameId = requestAnimationFrame(animate);
        selectedCardAnimationFrame = animState.frameId;
    };
    
    // Start animation immediately - check conditions BEFORE scheduling
    if (card && animState.shouldAnimate && card.parentNode && currentAnimalCard === card && 
        state.gameRunning && !state.gamePaused && !state.finishGameCalled) {
        animState.frameId = requestAnimationFrame(animate);
        selectedCardAnimationFrame = animState.frameId;
    } else {
        selectedCardAnimationFrame = null;
    }

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

    // Check if all animals in the current game have been found
    if (state.foundCount >= state.currentGameAnimalCount) {
        // Use a flag on state object to prevent finishGame from being called multiple times
        // This prevents race conditions when multiple cards finish simultaneously
        if (state.finishGameCalled) {
            return; // Already finishing, don't call again
        }
        
        // CRITICAL: Set finishGameCalled FIRST (before stopping animations)
        // This ensures any animation frames that check it will stop immediately
        state.finishGameCalled = true;
        
        // CRITICAL: Stop the animation IMMEDIATELY when game finishes
        // Don't wait for sound - stop animation right away to prevent race conditions
        if (card && card._stopAnimation) {
            card._stopAnimation();
        } else if (card && card._animState) {
            card._animState.shouldAnimate = false;
            if (card._animState.frameId !== null) {
                try {
                    cancelAnimationFrame(card._animState.frameId);
                } catch (e) {
                    // Ignore cancellation errors
                }
            }
        }
        if (selectedCardAnimationFrame !== null) {
            try {
                cancelAnimationFrame(selectedCardAnimationFrame);
            } catch (e) {
                // Ignore cancellation errors
            }
            selectedCardAnimationFrame = null;
        }
        
        const callFinishGame = () => {
            // Double-check flag to prevent race conditions
            // Only call if flag is set (meaning we're the ones who should finish) and conditions are met
            if (state.finishGameCalled && state.foundCount >= state.currentGameAnimalCount && state.gameRunning) {
                finishGame();
            }
        };
        
        // Wait for the last sound to finish before showing the finish popup
        // Use a timeout as a safety fallback in case the sound promise never resolves
        // Strict 4-second timeout means faster recovery if sound hangs
        const finishTimeout = setTimeout(() => {
            clearTimeout(finishTimeout);
            callFinishGame();
        }, 4000); // 4 second safety timeout (reduced from 8s)
        
        soundPromise.then(() => {
            clearTimeout(finishTimeout);
            callFinishGame();
        }).catch((error) => {
            clearTimeout(finishTimeout);
            console.warn('Game2: Sound failed, finishing game anyway:', error);
            callFinishGame();
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
        // Stop animation using stop function if available
        if (card._stopAnimation) {
            card._stopAnimation();
        } else if (card._animState) {
            // Fallback: stop animation state
            card._animState.shouldAnimate = false;
            if (card._animState.frameId !== null) {
                try {
                    cancelAnimationFrame(card._animState.frameId);
                } catch (e) {
                    // Ignore cancellation errors
                }
            }
        }
        
        // Clear reference if this is the current card
        if (currentAnimalCard === card) {
            currentAnimalCard = null;
        }
        // Cancel manual animation
        if (selectedCardAnimationFrame) {
            try {
                cancelAnimationFrame(selectedCardAnimationFrame);
            } catch (e) {
                // Ignore cancellation errors
            }
            selectedCardAnimationFrame = null;
        }
        // Cancel any Web Animations API animations
        if (card.animate && card.getAnimations) {
            card.getAnimations().forEach(anim => anim.cancel());
        }
        // Remove selected class before adding found class
        card.classList.remove('animal-card--selected');
        // Remove class from parent if no other selected cards exist
        if (animalField) {
            const hasSelected = animalField.querySelector('.animal-card--selected');
            if (!hasSelected) {
                animalField.classList.remove('animal-field--has-selected');
            }
        }
        card.classList.add('animal-card--found');
        
        // Store animationend handler so we can remove it if needed
        const animationEndHandler = () => {
            if (card && card.parentNode) {
                // Remove the event listener before removing the card
                card.removeEventListener('animationend', animationEndHandler);
                card.remove();
            }
            // Clean up animation stop function
            if (card._stopAnimation) {
                delete card._stopAnimation;
            }
            if (card._animState) {
                delete card._animState;
            }
        };
        card.addEventListener('animationend', animationEndHandler, { once: true });
    }
}

/**
 * Removes a card after its sound has finished playing.
 */
function removeCardAfterSound(card) {
    if (card && card.parentNode && !card.classList.contains('animal-card--found')) {
        // Stop animation using stop function if available
        if (card._stopAnimation) {
            card._stopAnimation();
        } else if (card._animState) {
            // Fallback: stop animation state
            card._animState.shouldAnimate = false;
            if (card._animState.frameId !== null) {
                try {
                    cancelAnimationFrame(card._animState.frameId);
                } catch (e) {
                    // Ignore cancellation errors
                }
            }
        }
        
        // Cancel manual animation frame (double-check)
        if (selectedCardAnimationFrame) {
            try {
                cancelAnimationFrame(selectedCardAnimationFrame);
            } catch (e) {
                // Ignore cancellation errors
            }
            selectedCardAnimationFrame = null;
        }
        // Clear current animal card reference to stop animation
        if (currentAnimalCard === card) {
            currentAnimalCard = null;
        }
        // Cancel any Web Animations API animations
        if (card.animate && card.getAnimations) {
            card.getAnimations().forEach(anim => anim.cancel());
        }
        // Remove selected class before starting removal animation
        card.classList.remove('animal-card--selected');
        // Clear currentAnimalCard reference if this was the selected card
        if (currentAnimalCard === card) {
            currentAnimalCard = null;
        }
        // Remove class from parent if no other selected cards exist
        if (animalField) {
            const hasSelected = animalField.querySelector('.animal-card--selected');
            if (!hasSelected) {
                animalField.classList.remove('animal-field--has-selected');
            }
        }
        // Stop any existing animations first
        card.style.animation = 'none';
        // Force a reflow
        void card.offsetHeight;
        // Now add the class and set the animation
        card.classList.add('animal-card--found');
        // Explicitly set animation style to ensure it takes effect
        card.style.animation = `animal-pop-out ${ANIMATION_DURATION_MS}ms ease forwards`;
        card.style.animationPlayState = 'running';
        // Force multiple reflows to ensure animation starts
        void card.offsetHeight;
        void card.getBoundingClientRect();
        requestAnimationFrame(() => {
            void card.offsetHeight;
        });
        // Store animationend handler so we can remove it if needed
        const animationEndHandler = () => {
            if (card && card.parentNode) {
                // Remove the event listener before removing the card
                card.removeEventListener('animationend', animationEndHandler);
                card.remove();
            }
            if (currentAnimalCard === card) {
                currentAnimalCard = null;
            }
            // Clean up animation stop function
            if (card._stopAnimation) {
                delete card._stopAnimation;
            }
            if (card._animState) {
                delete card._animState;
            }
        };
        card.addEventListener('animationend', animationEndHandler, { once: true });
    }
}

/**
 * Finishes the game, shows dialog, and stops background audio.
 */
function finishGame() {
    // Prevent multiple calls - check if already finished
    if (!state.gameRunning && state.finishGameCalled) {
        return; // Already finished, don't call again
    }
    
    // CRITICAL: Set finishGameCalled FIRST (before stopping animations)
    // This ensures any animation frames that check it will stop immediately
    state.finishGameCalled = true;
    
    // CRITICAL: Stop all animations BEFORE setting gameRunning to false
    // This ensures no animation frames are scheduled after the game ends
    if (currentAnimalCard && currentAnimalCard._stopAnimation) {
        currentAnimalCard._stopAnimation();
    } else if (currentAnimalCard && currentAnimalCard._animState) {
        currentAnimalCard._animState.shouldAnimate = false;
        if (currentAnimalCard._animState.frameId !== null) {
            try {
                cancelAnimationFrame(currentAnimalCard._animState.frameId);
            } catch (e) {
                // Ignore cancellation errors
            }
        }
    }
    if (selectedCardAnimationFrame !== null) {
        try {
            cancelAnimationFrame(selectedCardAnimationFrame);
        } catch (e) {
            // Ignore cancellation errors
        }
        selectedCardAnimationFrame = null;
    }
    
    // Now set gameRunning to false - animations are already stopped
    state.gameRunning = false;
    state.gamePaused = false;

    setInstructionsText(STRINGS.completionMessage);
    if (animalField) {
        animalField.classList.remove('animal-field--paused');
    }

    stopBackgroundAmbience();
    showCompletionDialog();
}

/**
 * Shows the completion dialog with the appropriate message and plays the video.
 */
function showCompletionDialog() {
    if (!completionDialog) {
        return;
    }

    if (completionMessage) {
        completionMessage.textContent = STRINGS.completionMessage;
    }
    
    // Play the completion video with sound
    // Since this is triggered by user interaction (completing the game), autoplay with sound should work
    if (completionVideo) {
        completionVideo.currentTime = 0; // Reset to start
        completionVideo.muted = false; // Ensure audio is enabled
        // Set video volume based on global volume control
        const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
        completionVideo.volume = globalVolume;
        completionVideo.play().catch(error => {
            console.warn('Could not play completion video:', error);
            // If play fails, try with muted as fallback
            completionVideo.muted = true;
            completionVideo.play().catch(() => {
                console.warn('Could not play completion video even with muted fallback');
            });
        });
    }
    
    completionDialog.hidden = false;
}

/**
 * Hides the completion dialog and stops the video.
 */
function hideCompletionDialog() {
    if (completionDialog) {
        completionDialog.hidden = true;
    }
    
    // Stop and reset the video when dialog is hidden
    if (completionVideo) {
        completionVideo.pause();
        completionVideo.currentTime = 0;
    }
}

/**
 * Clears the game board of animal cards.
 */
function clearAnimalField() {
    if (!animalField) {
        return;
    }
    
    // CRITICAL: Cancel any running animations BEFORE removing cards from DOM
    // This prevents animation frames from trying to access removed cards
    if (selectedCardAnimationFrame) {
        cancelAnimationFrame(selectedCardAnimationFrame);
        selectedCardAnimationFrame = null;
    }
    
    // Set flag on all cards to stop animations
    const cards = animalField.querySelectorAll('.animal-card');
    cards.forEach(card => {
        // Stop animation using stop function if available
        if (card._stopAnimation) {
            try {
                card._stopAnimation();
            } catch (e) {
                // Ignore errors during cleanup
            }
        } else if (card._animState) {
            card._animState.shouldAnimate = false;
            if (card._animState.frameId !== null) {
                try {
                    cancelAnimationFrame(card._animState.frameId);
                } catch (e) {
                    // Ignore cancellation errors
                }
            }
        }
        // Clean up all animation-related properties to prevent memory leaks
        delete card._stopAnimation;
        delete card._animState;
        // Remove any animationend listeners to prevent memory leaks
        // Note: We can't easily remove listeners added with { once: true }, but they should auto-remove
        // However, if the card is removed before animation ends, the listener might not fire
    });
    
    // Clear current animal card reference
    currentAnimalCard = null;
    
    // Now safe to clear the field
    animalField.innerHTML = '';
}

/**
 * Handles the continue button click - restarts the game.
 */
function handleContinueClick() {
    hideCompletionDialog();
    startNewGame();
}

/**
 * Automatically pauses/resumes the game when the window loses/regains focus (mobile/tabs).
 */
function handleVisibilityChange() {
    if (document.hidden && state.gameRunning && !state.gamePaused) {
        pauseGame();
    } else if (!document.hidden && state.gameRunning && state.gamePaused) {
        resumeGame();
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
    // Only resume if actually suspended to avoid unnecessary delays
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Could not resume AudioContext for animal sound:', error);
        }
    }

    // Load buffer - if cached, this returns immediately
    const buffer = loadAudioBuffer(animal.sound);
    if (!buffer) {
        return Promise.resolve();
    }
    
    // If buffer is a promise (not cached), wait for it
    const audioBuffer = buffer instanceof Promise ? await buffer : buffer;
    if (!audioBuffer) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        try {
            // Stop any previously playing animal sound
            stopCurrentAnimalSound();
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Create gain node and apply global volume control
            const gainNode = audioContext.createGain();
            // Get global volume and use it for animal sounds (same as background)
            const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
            gainNode.gain.setValueAtTime(globalVolume, audioContext.currentTime);
            
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
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
            // Calculate duration in milliseconds, ensure minimum duration
            const durationMs = Math.max(MIN_AUDIO_DURATION_MS, (audioBuffer.duration || 1) * 1000);
            timeoutId = setTimeout(() => {
                doResolve();
            }, durationMs + AUDIO_TIMEOUT_BUFFER_MS);
            
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
    // Use at least minimum padding or ratio of card width, whichever is larger
    const padding = Math.max(POSITIONING_PADDING_MIN, cardWidth * POSITIONING_PADDING_RATIO);
    const maxAttempts = POSITIONING_MAX_ATTEMPTS;
    
    // On small screens, prefer grid layout for better spacing
    const isSmallScreen = containerWidth < SMALL_SCREEN_BREAKPOINT;
    const useGrid = isSmallScreen || count > 5;
    
    if (useGrid) {
        // Use grid-based placement for small screens or many cards, with random offsets for organic look
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const cellWidth = (containerWidth - padding * 2) / cols;
        const cellHeight = (containerHeight - padding * 2) / rows;
        
        // Calculate maximum safe offset (ensure cards stay within bounds and don't overlap)
        const maxOffsetX = Math.min(GRID_OFFSET_MAX, (cellWidth - cardWidth) * GRID_OFFSET_RATIO);
        const maxOffsetY = Math.min(GRID_OFFSET_MAX, (cellHeight - cardHeight) * GRID_OFFSET_RATIO);
        
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
