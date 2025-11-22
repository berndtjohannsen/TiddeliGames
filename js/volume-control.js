// Volume control utility for all games
'use strict';

// Default volume (0.0 to 1.0)
const DEFAULT_VOLUME = 0.35;
const STORAGE_KEY = 'tiddeligames_volume';
const MUTE_STORAGE_KEY = 'tiddeligames_muted';
const PREVIOUS_VOLUME_KEY = 'tiddeligames_previous_volume';

/**
 * Gets the stored volume preference from localStorage.
 * @returns {number} Volume value between 0.0 and 1.0
 */
function getStoredVolume() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
            const volume = parseFloat(stored);
            // Validate volume is between 0 and 1
            if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                return volume;
            }
        }
    } catch (error) {
        console.warn('Could not read volume from localStorage:', error);
    }
    return DEFAULT_VOLUME;
}

/**
 * Stores the volume preference in localStorage.
 * @param {number} volume - Volume value between 0.0 and 1.0
 */
function setStoredVolume(volume) {
    try {
        // Clamp volume to valid range
        const clampedVolume = Math.max(0, Math.min(1, volume));
        localStorage.setItem(STORAGE_KEY, clampedVolume.toString());
        
        // Dispatch custom event so games can update their volume in real-time
        window.dispatchEvent(new CustomEvent('volumechange', { 
            detail: { volume: clampedVolume } 
        }));
    } catch (error) {
        console.warn('Could not save volume to localStorage:', error);
    }
}

/**
 * Gets the current volume setting (for use in games).
 * Returns 0 if muted, otherwise returns the stored volume.
 * @returns {number} Volume value between 0.0 and 1.0
 */
function getVolume() {
    if (isMuted()) {
        return 0;
    }
    return getStoredVolume();
}

/**
 * Checks if volume is currently muted.
 * @returns {boolean} True if muted, false otherwise
 */
function isMuted() {
    try {
        const muted = localStorage.getItem(MUTE_STORAGE_KEY);
        return muted === 'true';
    } catch (error) {
        console.warn('Could not read mute state from localStorage:', error);
        return false;
    }
}

/**
 * Sets the mute state.
 * Note: This function only updates the mute flag. The caller should handle
 * storing/restoring volume values and updating the UI.
 * @param {boolean} muted - True to mute, false to unmute
 */
function setMuted(muted) {
    try {
        localStorage.setItem(MUTE_STORAGE_KEY, muted.toString());
        
        // Dispatch volumechange event so games know the effective volume changed
        // (getVolume() will return 0 when muted, actual stored volume unchanged)
        const effectiveVolume = muted ? 0 : getStoredVolume();
        window.dispatchEvent(new CustomEvent('volumechange', { 
            detail: { volume: effectiveVolume } 
        }));
    } catch (error) {
        console.warn('Could not save mute state to localStorage:', error);
    }
}

/**
 * Gets the previous volume (before muting).
 * @returns {number} Previous volume value between 0.0 and 1.0
 */
function getPreviousVolume() {
    try {
        const stored = localStorage.getItem(PREVIOUS_VOLUME_KEY);
        if (stored !== null) {
            const volume = parseFloat(stored);
            if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                return volume;
            }
        }
    } catch (error) {
        console.warn('Could not read previous volume from localStorage:', error);
    }
    return DEFAULT_VOLUME;
}

// Make functions available globally
window.TiddeliGamesVolume = {
    get: getVolume,
    set: setStoredVolume,
    getStored: getStoredVolume,
    isMuted: isMuted,
    setMuted: setMuted
};

/**
 * Updates the mute button icon based on mute state.
 */
function updateMuteButtonIcon() {
    const muteButton = document.getElementById('mute-button');
    const unmutedIcon = document.getElementById('volume-icon-unmuted');
    const mutedIcon = document.getElementById('volume-icon-muted');
    
    if (!muteButton || !unmutedIcon || !mutedIcon) {
        return;
    }
    
    const muted = isMuted();
    if (muted) {
        unmutedIcon.classList.add('hidden');
        mutedIcon.classList.remove('hidden');
        muteButton.setAttribute('aria-label', 'Unmute');
    } else {
        unmutedIcon.classList.remove('hidden');
        mutedIcon.classList.add('hidden');
        muteButton.setAttribute('aria-label', 'Mute');
    }
}

/**
 * Initializes the volume control UI on the main page.
 * This is only needed on the main page (index.html), not in games.
 */
function initVolumeControlUI() {
    const volumeSlider = document.getElementById('volume-slider');
    const volumeDisplay = document.getElementById('volume-display');
    const muteButton = document.getElementById('mute-button');
    
    if (!volumeSlider) {
        return;
    }
    
    // Initialize mute button
    if (muteButton) {
        updateMuteButtonIcon();
        
        muteButton.addEventListener('click', () => {
            const currentlyMuted = isMuted();
            
            if (!currentlyMuted) {
                // Muting: store current slider position as previous volume
                const currentSliderValue = parseFloat(volumeSlider.value) / 100;
                if (currentSliderValue > 0) {
                    localStorage.setItem(PREVIOUS_VOLUME_KEY, currentSliderValue.toString());
                }
                setMuted(true);
            } else {
                // Unmuting: restore previous volume and update slider
                const previousVolume = getPreviousVolume();
                if (previousVolume > 0) {
                    setStoredVolume(previousVolume);
                    const volumePercent = Math.round(previousVolume * 100);
                    volumeSlider.value = volumePercent;
                    if (volumeDisplay) volumeDisplay.textContent = `${volumePercent}`;
                }
                setMuted(false);
            }
            
            updateMuteButtonIcon();
        });
    }
    
    // Load saved volume and set slider
    // If muted, show the previous volume on the slider (but actual volume is 0)
    const savedVolume = isMuted() ? getPreviousVolume() : getStoredVolume();
    const volumePercent = Math.round(savedVolume * 100);
    volumeSlider.value = volumePercent;
    if (volumeDisplay) volumeDisplay.textContent = `${volumePercent}`;
    
    // Update volume when slider changes
    volumeSlider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value) / 100;
        // If unmuting by moving slider, unmute first
        if (isMuted() && volume > 0) {
            setMuted(false);
            updateMuteButtonIcon();
        }
        setStoredVolume(volume);
        if (volumeDisplay) volumeDisplay.textContent = `${e.target.value}`;
    });
    
    // Listen for external volume changes (e.g., from another tab)
    window.addEventListener('volumechange', (event) => {
        const newVolume = event.detail.volume;
        const wasMuted = isMuted();
        
        // If volume is set to 0, mute; otherwise unmute
        if (newVolume === 0 && !wasMuted) {
            setMuted(true);
            updateMuteButtonIcon();
            // Don't update slider position when muting - keep it where it is
        } else if (newVolume > 0 && wasMuted) {
            setMuted(false);
            updateMuteButtonIcon();
            // Update slider to show the new volume when unmuting
            volumeSlider.value = Math.round(newVolume * 100);
            if (volumeDisplay) volumeDisplay.textContent = `${Math.round(newVolume * 100)}`;
        } else if (!wasMuted && newVolume > 0) {
            // Normal volume change (not muting/unmuting) - update slider
            volumeSlider.value = Math.round(newVolume * 100);
            if (volumeDisplay) volumeDisplay.textContent = `${Math.round(newVolume * 100)}`;
        }
        // If muted and volume is 0, don't update slider - keep it at previous position
    });
}

// Initialize UI when DOM is ready (only on pages that have the volume slider)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVolumeControlUI);
} else {
    initVolumeControlUI();
}

