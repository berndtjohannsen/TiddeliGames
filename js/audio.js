// Audio management (Tone.js setup)
'use strict';

/**
 * Indices of available shared completion sounds (complete_N.mp3).
 * Contiguous range: complete_1.mp3 through complete_71.mp3.
 */
const COMPLETE_SOUND_COUNT = 71;

/** Active completion BufferSource / GainNode, so Continue can cut them short */
let activeCompletionSource = null;
let activeCompletionGain = null;

/**
 * Stops any in-progress shared completion sound.
 * Call when leaving the completion dialog so it does not overlap the next round.
 */
function stopSharedCompletionSound() {
    if (activeCompletionSource) {
        try {
            activeCompletionSource.onended = null;
            activeCompletionSource.stop();
        } catch (_) {
            // already stopped
        }
        try {
            activeCompletionSource.disconnect();
        } catch (_) {
            // already disconnected
        }
        activeCompletionSource = null;
    }
    if (activeCompletionGain) {
        try {
            activeCompletionGain.disconnect();
        } catch (_) {
            // already disconnected
        }
        activeCompletionGain = null;
    }
}

/**
 * Shared completion sound utility for all games.
 * Randomly selects and plays one of the shared completion sounds from assets.
 * 
 * This function can work with any game's audio context or create its own if needed.
 * It respects the global volume settings and handles audio context initialization.
 * 
 * @param {AudioContext} [gameAudioContext] - Optional audio context from the game. 
 *                                           If not provided, creates a temporary one.
 * @param {number} [volumeMultiplier=0.8] - Volume multiplier (0.0 to 1.0) applied to global volume
 * @returns {Promise} Promise that resolves when sound finishes playing
 */
async function playSharedCompletionSound(gameAudioContext = null, volumeMultiplier = 0.8) {
    // Get or create audio context
    let audioContext = gameAudioContext;
    
    // If no audio context provided, create a temporary one
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Could not create audio context for completion sound:', error);
            return Promise.resolve();
        }
    }
    
    // Ensure audio context is running
    if (audioContext.state !== 'running') {
        try {
            await audioContext.resume();
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
            console.warn('Could not resume audio context:', error);
            return Promise.resolve();
        }
    }
    
    if (audioContext.state !== 'running') {
        return Promise.resolve();
    }
    
    try {
        // Stop any previous completion sound before starting a new one
        stopSharedCompletionSound();

        // Randomly select one completion sound (complete_1.mp3 … complete_71.mp3)
        const randomIndex = Math.floor(Math.random() * COMPLETE_SOUND_COUNT) + 1;
        const relativeSharedPath = `shared/sounds/complete_${randomIndex}.mp3`;
        const soundPath = (window.TiddeliAssets && window.TiddeliAssets.resolveSharedAsset)
            ? window.TiddeliAssets.resolveSharedAsset(relativeSharedPath)
            : `../../TiddeliGames-assets/assets/${relativeSharedPath}`;
        
        // Load the audio file
        const response = await fetch(soundPath, { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error(`Completion audio failed to load: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Create audio source and gain node
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        const gainNode = audioContext.createGain();
        
        // Get global volume and apply multiplier
        const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
        const actualVolume = globalVolume * volumeMultiplier;
        
        gainNode.gain.setValueAtTime(actualVolume, audioContext.currentTime);
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        activeCompletionSource = source;
        activeCompletionGain = gainNode;
        
        // Play the sound
        source.start();
        
        // Return promise that resolves when sound finishes
        return new Promise((resolve) => {
            source.addEventListener('ended', () => {
                if (activeCompletionSource === source) {
                    activeCompletionSource = null;
                    activeCompletionGain = null;
                }
                try {
                    source.disconnect();
                    gainNode.disconnect();
                } catch (_) {
                    // already disconnected
                }
                resolve();
            }, { once: true });
        });
        
    } catch (error) {
        console.warn('Could not play shared completion sound:', error);
        return Promise.resolve();
    }
}

/**
 * When the user leaves the completion dialog (Continue or Back), cut the success sound
 * so it does not bleed into the next round or the menu.
 */
function handleCompletionDialogLeave(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('#continue-button') || target.closest('#dialog-back-button')) {
        stopSharedCompletionSound();
    }
}

document.addEventListener('click', handleCompletionDialogLeave, true);

// Make functions available globally for all games to use
window.playSharedCompletionSound = playSharedCompletionSound;
window.stopSharedCompletionSound = stopSharedCompletionSound;
