// Audio management (Tone.js setup)
'use strict';

/**
 * Shared completion sound utility for all games.
 * Randomly selects and plays one of the 36 completion sounds from shared assets.
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
        // Randomly select one of the 36 completion sounds (complete_1.mp3 through complete_36.mp3)
        const randomIndex = Math.floor(Math.random() * 36) + 1; // 1 to 36
        // Path from game directories: go up two levels to root, then to shared assets
        const soundPath = `../../assets/shared/sounds/complete_${randomIndex}.mp3`;
        
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
        
        // Play the sound
        source.start();
        
        // Return promise that resolves when sound finishes
        return new Promise((resolve) => {
            source.addEventListener('ended', () => {
                source.disconnect();
                gainNode.disconnect();
                resolve();
            }, { once: true });
        });
        
    } catch (error) {
        console.warn('Could not play shared completion sound:', error);
        return Promise.resolve();
    }
}

// Make function available globally for all games to use
window.playSharedCompletionSound = playSharedCompletionSound;
