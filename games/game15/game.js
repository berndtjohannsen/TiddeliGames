// Prata med oss (Game 15) – build text, tap robot to speak
'use strict';

const STRINGS = window.GAME15_STRINGS || {};
const GAME15_ASSETS = window.TiddeliAssets;
const MAX_CHARS = typeof STRINGS.maxChars === 'number' ? STRINGS.maxChars : 40;
const ALPHABET = Array.isArray(STRINGS.alphabet) ? STRINGS.alphabet : [];
const FIGURES = Array.isArray(STRINGS.figures) ? STRINGS.figures : [];
/** Speaks needed to finish a round (single robot) */
const SPEAKS_TO_COMPLETE =
    typeof STRINGS.speaksToComplete === 'number' ? STRINGS.speaksToComplete : 4;

/**
 * Prefer device/browser speechSynthesis (good on Android).
 * Set to true to use Google Cloud TTS again (fetchTtsAudio / playTtsBase64 stay below).
 */
const USE_CLOUD_TTS = false;

/**
 * Host-neutral TTS API path (Google Cloud Text-to-Speech on the server).
 * Used only when USE_CLOUD_TTS is true.
 * Production (Netlify): /api/tts → serverless function.
 * Local: http://127.0.0.1:8888/api/tts (npm run tts-api / dev:full).
 */
function getTtsEndpoint() {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (isLocal) {
        return 'http://127.0.0.1:8888/api/tts';
    }
    return '/api/tts';
}

function resolveGame15Asset(path) {
    if (!path) return '';
    if (GAME15_ASSETS && typeof GAME15_ASSETS.resolveGameAsset === 'function') {
        return GAME15_ASSETS.resolveGameAsset('game15', path);
    }
    return path;
}

let titleEl = null;
let instructionsEl = null;
let gameFieldEl = null;
let textFieldEl = null;
let alphabetEl = null;
let figuresEl = null;
let progressEl = null;
let backspaceButton = null;
let clearButton = null;
let completionDialog = null;
let completionTitle = null;
let completionMessage = null;
let continueButton = null;
let dialogBackButton = null;

let audioContext = null;
let backgroundBuffer = null;
let backgroundSource = null;
let backgroundGain = null;
/** Soft “thinking” clip before the figure speaks */
let thinkingSource = null;
let thinkingGain = null;
/** Resolves when the active thinking clip reaches its natural end */
let thinkingEndedResolve = null;
/** Ambience gain multipliers (relative to global volume) */
const AMBIENCE_GAIN = 0.4;
const AMBIENCE_DUCKED_GAIN = 0.03;
const THINKING_GAIN = 0.55;
const audioBufferCache = new Map();
/** Cache Cloud TTS audio by text+voice to avoid repeat billing (when USE_CLOUD_TTS) */
const ttsAudioCache = new Map();
/** Active Cloud TTS Web Audio source (when USE_CLOUD_TTS) */
let ttsSource = null;
/** rAF id for mouth animation while speaking */
let lipSyncRaf = 0;
/** Active SpeechSynthesisUtterance */
let activeUtterance = null;

const state = {
    text: '',
    caretIndex: 0, // insert position within text (0 = start, length = end)
    spokenCount: 0, // how many times the robot has spoken this round
    audioStarted: false,
    audioStarting: false,
    speaking: false, // speech request or playback in progress
    completed: false,
    ambienceDucked: false, // true while thinking / speaking
    figureButtons: new Map() // id -> button element (one robot)
};

window.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    populateStaticTexts();
    buildAlphabet();
    buildFigures();
    attachEventListeners();
    updateTextField();
    updateProgress();
    requestBackgroundAudioStart();
});

/**
 * Caches DOM nodes and sets the game field background image.
 */
function cacheDomElements() {
    titleEl = document.getElementById('game15-title');
    instructionsEl = document.getElementById('instructions-text');
    gameFieldEl = document.getElementById('game15-field');
    textFieldEl = document.getElementById('text-field');
    alphabetEl = document.getElementById('alphabet');
    figuresEl = document.getElementById('figures');
    progressEl = document.getElementById('progress-text');
    backspaceButton = document.getElementById('backspace-button');
    clearButton = document.getElementById('clear-button');
    completionDialog = document.getElementById('completion-dialog');
    completionTitle = document.getElementById('completion-title');
    completionMessage = document.getElementById('completion-message');
    continueButton = document.getElementById('continue-button');
    dialogBackButton = document.getElementById('dialog-back-button');

    if (gameFieldEl) {
        const bgUrl = resolveGame15Asset('images/background.webp');
        gameFieldEl.style.backgroundImage =
            `linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.2)), url('${bgUrl}')`;
    }
}

function populateStaticTexts() {
    if (titleEl) titleEl.textContent = STRINGS.title || '';
    if (instructionsEl) instructionsEl.textContent = STRINGS.instructions || '';
    if (continueButton) continueButton.textContent = (STRINGS.labels && STRINGS.labels.continue) || 'Fortsätt';
    if (dialogBackButton) dialogBackButton.textContent = (STRINGS.labels && STRINGS.labels.back) || 'Tillbaka';
    if (completionTitle) completionTitle.textContent = (STRINGS.dialog && STRINGS.dialog.title) || '';
    if (completionMessage) completionMessage.textContent = (STRINGS.dialog && STRINGS.dialog.message) || '';
    if (backspaceButton) {
        backspaceButton.textContent = (STRINGS.labels && STRINGS.labels.backspace) || '←';
    }
    if (clearButton) {
        clearButton.textContent = (STRINGS.labels && STRINGS.labels.clear) || 'Rensa';
    }
    if (textFieldEl && STRINGS.aria && STRINGS.aria.field) {
        textFieldEl.setAttribute('aria-label', STRINGS.aria.field);
    }
}

function attachEventListeners() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('volumechange', handleVolumeChange);
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
        document.addEventListener(eventName, handleFirstInteraction, { once: true });
    });
    document.addEventListener('keydown', handleKeyboard);
    if (continueButton) continueButton.addEventListener('click', handleContinueClick);
    if (dialogBackButton) dialogBackButton.addEventListener('click', handleDialogBackClick);
    if (backspaceButton) backspaceButton.addEventListener('click', () => removeLastChar());
    if (clearButton) clearButton.addEventListener('click', () => clearText());
    // Chrome often loads voices asynchronously — warm the list early
    warmBrowserVoices();

    // Click in the text field to place the caret (insert position)
    if (textFieldEl) {
        textFieldEl.addEventListener('click', (event) => {
            if (state.completed || state.speaking) return;
            setCaretFromPoint(event.clientX, event.clientY);
            textFieldEl.focus();
        });
    }

    // Drop letters anywhere on the game field; insert at caret (or at drop spot in the text)
    if (gameFieldEl) {
        gameFieldEl.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            setDropHighlight(true);
            // Live-update caret index while over the text (do not rebuild DOM —
            // rebuilding on every dragover made mid-text drops snap to ends)
            if (textFieldEl && (event.target === textFieldEl || textFieldEl.contains(event.target))) {
                setCaretFromPoint(event.clientX, event.clientY, { render: false });
                syncCaretElement();
            }
        });
        gameFieldEl.addEventListener('dragleave', (event) => {
            // Ignore leave events that stay inside the field (moving over children)
            const related = event.relatedTarget;
            if (related && gameFieldEl.contains(related)) return;
            setDropHighlight(false);
        });
        gameFieldEl.addEventListener('drop', (event) => {
            event.preventDefault();
            setDropHighlight(false);
            const ch = event.dataTransfer && event.dataTransfer.getData('text/plain');
            if (!ch) return;
            // Dropping on the text places the caret under the pointer first
            if (textFieldEl && (event.target === textFieldEl || textFieldEl.contains(event.target))) {
                setCaretFromPoint(event.clientX, event.clientY, { render: true });
            }
            insertChar(ch);
        });
    }
}

/** Visual cue while a letter is dragged over the play field. */
function setDropHighlight(on) {
    if (gameFieldEl) {
        gameFieldEl.classList.toggle('game15-field--drop', on);
    }
    if (textFieldEl) {
        textFieldEl.classList.toggle('game15-text-field--drop', on);
    }
}

/**
 * Builds the on-screen alphabet (click + HTML5 drag), plus a space key.
 */
function buildAlphabet() {
    if (!alphabetEl) return;
    alphabetEl.innerHTML = '';
    ALPHABET.forEach((ch) => {
        alphabetEl.appendChild(createLetterButton(ch));
    });
    // Space is needed for multi-word phrases (not in the A–Ö list)
    alphabetEl.appendChild(createLetterButton(' ', {
        label: (STRINGS.aria && STRINGS.aria.space) || 'Mellanslag',
        display: '␣',
        extraClass: 'game15-letter--space'
    }));
}

/**
 * Creates one alphabet (or space) key button.
 * @param {string} ch - character inserted on click/drop
 * @param {{ label?: string, display?: string, extraClass?: string }} [options]
 * @returns {HTMLButtonElement}
 */
function createLetterButton(ch, options = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'game15-letter' + (options.extraClass ? ` ${options.extraClass}` : '');
    btn.textContent = options.display || ch;
    btn.draggable = true;
    btn.setAttribute(
        'aria-label',
        options.label ||
            (STRINGS.aria && STRINGS.aria.letter ? STRINGS.aria.letter(ch) : ch)
    );
    btn.addEventListener('click', () => insertChar(ch));
    btn.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', ch);
        event.dataTransfer.effectAllowed = 'copy';
        btn.classList.add('game15-letter--dragging');
    });
    btn.addEventListener('dragend', () => {
        btn.classList.remove('game15-letter--dragging');
        setDropHighlight(false);
    });
    return btn;
}

/** Play button for the robot (icon only — no visible text) */
let playButtonEl = null;

/**
 * Builds the robot stage + icon-only play button.
 */
function buildFigures() {
    if (!figuresEl) return;
    figuresEl.innerHTML = '';
    state.figureButtons.clear();
    playButtonEl = null;

    const figure = FIGURES[0];
    if (!figure) return;

    const stage = document.createElement('div');
    stage.className = 'game15-speaker';

    // Robot is visual + still tappable; play button is the clear “speak” control
    const robot = document.createElement('button');
    robot.type = 'button';
    robot.className = 'game15-figure game15-figure--robot';
    robot.dataset.figureId = figure.id;
    robot.setAttribute(
        'aria-label',
        STRINGS.aria && STRINGS.aria.figure ? STRINGS.aria.figure(figure.name) : figure.name
    );

    // Robot portrait (WebP asset)
    const avatar = document.createElement('span');
    avatar.className = 'game15-figure__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.className = 'game15-figure__img';
    img.src = resolveGame15Asset(figure.image || 'images/robot.webp');
    img.alt = '';
    img.draggable = false;
    avatar.appendChild(img);

    // Soft mouth glow overlay — driven by audio amplitude while speaking
    const mouth = document.createElement('span');
    mouth.className = 'game15-figure__mouth-open';
    mouth.setAttribute('aria-hidden', 'true');
    avatar.appendChild(mouth);

    // Antenna “processing” lights (CSS-animated while thinking)
    const lights = document.createElement('span');
    lights.className = 'game15-figure__lights';
    lights.setAttribute('aria-hidden', 'true');
    lights.innerHTML =
        '<span class="game15-figure__light"></span>' +
        '<span class="game15-figure__light"></span>' +
        '<span class="game15-figure__light"></span>';

    // Thought bubble above the robot (shown while waiting for TTS)
    const think = document.createElement('span');
    think.className = 'game15-figure__think';
    think.setAttribute('aria-hidden', 'true');
    think.innerHTML =
        '<span class="game15-figure__think-cloud">' +
        '<span class="game15-figure__think-dot"></span>' +
        '<span class="game15-figure__think-dot"></span>' +
        '<span class="game15-figure__think-dot"></span>' +
        '</span>' +
        '<span class="game15-figure__think-puff game15-figure__think-puff--mid"></span>' +
        '<span class="game15-figure__think-puff game15-figure__think-puff--small"></span>';

    robot.appendChild(think);
    robot.appendChild(lights);
    robot.appendChild(avatar);

    // Icon-only play control (triangle) — no label text on the button
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'game15-play-btn';
    playBtn.setAttribute(
        'aria-label',
        (STRINGS.aria && STRINGS.aria.play) || 'Låt roboten prata'
    );
    playBtn.innerHTML =
        '<svg class="game15-play-btn__icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12"/>' +
        '<path d="M9.2 6.8v10.4L18 12z" fill="currentColor"/>' +
        '</svg>';

    const speak = () => handleFigureClick(figure, robot);
    robot.addEventListener('click', speak);
    playBtn.addEventListener('click', speak);

    stage.appendChild(robot);
    stage.appendChild(playBtn);
    figuresEl.appendChild(stage);
    state.figureButtons.set(figure.id, robot);
    playButtonEl = playBtn;
}

/**
 * Inserts a character at the caret (not only at the end).
 * Letters are stored uppercase; spaces are kept as spaces.
 * @param {string} ch
 */
function insertChar(ch) {
    if (state.completed || state.speaking) return;
    if (state.text.length >= MAX_CHARS) return;

    const raw = String(ch);
    // Preserve spaces (toUpperCase would be a no-op, but keep the intent clear)
    const letter = raw === ' ' ? ' ' : raw.toUpperCase();
    if (letter !== ' ' && !ALPHABET.includes(letter)) return;

    const i = clampCaret(state.caretIndex);
    state.text = state.text.slice(0, i) + letter + state.text.slice(i);
    state.caretIndex = i + 1;
    updateTextField();
    requestBackgroundAudioStart();
    // Short tap blip for each letter/space entered
    playLetterTapSound(letter === ' ');
}

/**
 * Soft Web Audio click when a character is typed or dropped in.
 * Space uses a slightly lower pitch than letters.
 * @param {boolean} [isSpace]
 */
function playLetterTapSound(isSpace = false) {
    ensureAudioContext()
        .then(() => {
            if (!audioContext || audioContext.state !== 'running') return;

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Letter: D5; space: G4 — short, quiet, kid-friendly
            oscillator.frequency.value = isSpace ? 392.0 : 587.33;
            oscillator.type = 'sine';

            const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
            const now = audioContext.currentTime;
            const peak = Math.min(0.22, globalVolume * 0.35);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(peak, now + 0.008);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

            oscillator.start(now);
            oscillator.stop(now + 0.08);
        })
        .catch(() => {
            // Ignore — typing should never fail because of audio
        });
}

/** Deletes the character before the caret (Backspace). */
function removeLastChar() {
    if (state.completed || state.speaking) return;
    const i = clampCaret(state.caretIndex);
    if (i <= 0) return;
    state.text = state.text.slice(0, i - 1) + state.text.slice(i);
    state.caretIndex = i - 1;
    updateTextField();
}

function clearText() {
    if (state.completed || state.speaking) return;
    state.text = '';
    state.caretIndex = 0;
    updateTextField();
}

function clampCaret(index) {
    return Math.max(0, Math.min(state.text.length, index));
}

function setCaret(index) {
    state.caretIndex = clampCaret(index);
    updateTextField();
}

/**
 * Places the caret from a pointer position over the text field.
 * Uses both X and Y so wrapped lines and mid-word drops work.
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ render?: boolean }} [options] - render=false: only update index (for dragover)
 */
function setCaretFromPoint(clientX, clientY, options = {}) {
    if (!textFieldEl) return;
    const shouldRender = options.render !== false;

    const chars = textFieldEl.querySelectorAll('.game15-char');
    if (!chars.length) {
        state.caretIndex = 0;
        if (shouldRender) updateTextField();
        return;
    }

    // Pick the insertion edge closest to the pointer (handles multi-line flex wrap)
    let bestIndex = state.text.length;
    let bestScore = Infinity;
    for (let i = 0; i < chars.length; i++) {
        const rect = chars[i].getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const midY = rect.top + rect.height / 2;
        const insertBefore = clientX < midX;
        const index = insertBefore ? i : i + 1;
        const edgeX = insertBefore ? rect.left : rect.right;
        // Prefer characters on the same row as the pointer
        const rowMiss =
            clientY < rect.top - 6 || clientY > rect.bottom + 6 ? 800 : 0;
        const score = Math.hypot(clientX - edgeX, clientY - midY) + rowMiss;
        if (score < bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    }

    state.caretIndex = clampCaret(bestIndex);
    if (shouldRender) updateTextField();
}

/**
 * Moves the existing caret node to match state.caretIndex without rebuilding letters.
 * Used during dragover so hit-testing stays stable.
 */
function syncCaretElement() {
    if (!textFieldEl) return;
    const caret = textFieldEl.querySelector('.game15-caret');
    if (!caret) {
        updateTextField();
        return;
    }

    const chars = textFieldEl.querySelectorAll('.game15-char');
    const i = clampCaret(state.caretIndex);
    // Insert caret before the i-th character, or at the end if i === length
    const beforeNode = i < chars.length ? chars[i] : null;
    if (beforeNode) {
        textFieldEl.insertBefore(caret, beforeNode);
    } else {
        textFieldEl.appendChild(caret);
    }
}

/**
 * Renders text with a visible caret so letters can be inserted in the middle.
 */
function updateTextField() {
    if (!textFieldEl) return;

    state.caretIndex = clampCaret(state.caretIndex);
    textFieldEl.innerHTML = '';

    const frag = document.createDocumentFragment();
    for (let i = 0; i <= state.text.length; i++) {
        if (state.caretIndex === i) {
            const caret = document.createElement('span');
            caret.className = 'game15-caret';
            caret.setAttribute('aria-hidden', 'true');
            frag.appendChild(caret);
        }
        if (i < state.text.length) {
            const span = document.createElement('span');
            const isSpace = state.text[i] === ' ';
            // Flex layouts collapse plain spaces — give them width + a visible gap
            span.className = isSpace ? 'game15-char game15-char--space' : 'game15-char';
            span.textContent = isSpace ? '\u00A0' : state.text[i];
            span.dataset.index = String(i);
            // Click a letter: caret before/after based on which half was hit
            span.addEventListener('click', (event) => {
                event.stopPropagation();
                if (state.completed || state.speaking) return;
                const rect = span.getBoundingClientRect();
                const after = (event.clientX - rect.left) > rect.width / 2;
                setCaret(after ? i + 1 : i);
                textFieldEl.focus();
            });
            frag.appendChild(span);
        }
    }

    textFieldEl.appendChild(frag);
}

function updateProgress() {
    if (!progressEl) return;
    progressEl.textContent = `${state.spokenCount} / ${SPEAKS_TO_COMPLETE}`;
}

/**
 * Physical keyboard support for letters, ÅÄÖ, arrows, Backspace, and space.
 */
function handleKeyboard(event) {
    if (state.completed || state.speaking) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;
    if (key === 'Backspace') {
        event.preventDefault();
        removeLastChar();
        return;
    }
    if (key === 'ArrowLeft') {
        event.preventDefault();
        setCaret(state.caretIndex - 1);
        return;
    }
    if (key === 'ArrowRight') {
        event.preventDefault();
        setCaret(state.caretIndex + 1);
        return;
    }
    if (key === 'Home') {
        event.preventDefault();
        setCaret(0);
        return;
    }
    if (key === 'End') {
        event.preventDefault();
        setCaret(state.text.length);
        return;
    }
    if (key === ' ') {
        event.preventDefault();
        insertChar(' ');
        return;
    }
    if (key.length === 1) {
        const upper = key.toUpperCase();
        if (ALPHABET.includes(upper)) {
            event.preventDefault();
            insertChar(upper);
        }
    }
}

/** Brief shake when the text field is empty. */
function shakeTextField() {
    if (!textFieldEl) return;
    textFieldEl.classList.remove('game15-text-field--shake');
    void textFieldEl.offsetWidth;
    textFieldEl.classList.add('game15-text-field--shake');
    setTimeout(() => textFieldEl.classList.remove('game15-text-field--shake'), 400);
}

/**
 * Handles tap on a speaking figure: speak text, then mark spoken.
 * Default: device speechSynthesis. Cloud TTS path kept behind USE_CLOUD_TTS.
 */
async function handleFigureClick(figure, button) {
    if (state.completed || state.speaking) return;
    requestBackgroundAudioStart();
    stopBrowserSpeech();
    stopTtsPlayback();

    const trimmed = state.text.trim();
    if (!trimmed) {
        shakeTextField();
        return;
    }

    state.speaking = true;
    setFiguresBusy(figure.id, true, { waiting: true });

    // When Cloud TTS is enabled, start the fetch while the thinking clip plays
    const fetchPromise = USE_CLOUD_TTS
        ? fetchTtsAudio(trimmed, figure.voice, figure.id)
        : null;

    try {
        await ensureAudioContext();
        await playThinkingOnce();
        setAmbienceDucked(true);

        if (USE_CLOUD_TTS) {
            try {
                const audioBase64 = await fetchPromise;
                console.log('[Game15] voice: Cloud TTS', figure.id, figure.voice || '');
                await playTtsBase64(audioBase64, button);
            } catch (cloudError) {
                // Network / API / billing issues — fall back to device voice
                console.warn('[Game15] Cloud TTS failed:', cloudError);
                console.log('[Game15] voice: browser speechSynthesis', figure.id);
                if (instructionsEl) {
                    const prev = instructionsEl.textContent;
                    instructionsEl.textContent = 'Använder webbläsarens röst just nu.';
                    setTimeout(() => {
                        if (instructionsEl) instructionsEl.textContent = prev;
                    }, 2500);
                }
                await speakWithBrowserVoice(trimmed, figure, button);
            }
        } else {
            console.log('[Game15] voice: browser speechSynthesis', figure.id);
            await speakWithBrowserVoice(trimmed, figure, button);
        }

        state.spokenCount += 1;
        if (state.spokenCount > 0) {
            button.classList.add('game15-figure--spoken');
        }
        updateProgress();

        if (state.spokenCount >= SPEAKS_TO_COMPLETE) {
            showCompletionDialog();
        }
    } catch (error) {
        console.warn('Speech failed:', error);
        if (instructionsEl) {
            const prev = instructionsEl.textContent;
            instructionsEl.textContent = 'Kunde inte prata just nu. Försök igen.';
            setTimeout(() => {
                if (instructionsEl) instructionsEl.textContent = prev;
            }, 3500);
        }
    } finally {
        endThinkingWait();
        stopBrowserSpeech();
        stopTtsPlayback();
        state.speaking = false;
        stopLipSync(button);
        setFiguresBusy(null, false);
    }
}

/**
 * Calls the TTS proxy (API key stays on the server).
 * @param {string} text
 * @param {string} voice
 * @param {string} figureId
 * @returns {Promise<string>} base64 MP3
 */
async function fetchTtsAudio(text, voice, figureId) {
    const cacheKey = `${figureId || ''}::${voice}::${text}`;
    if (ttsAudioCache.has(cacheKey)) {
        return ttsAudioCache.get(cacheKey);
    }

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
        }
        try {
            const response = await fetch(getTtsEndpoint(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, figureId: figureId || '' })
            });

            let data;
            try {
                data = await response.json();
            } catch (_) {
                throw new Error(`TTS HTTP ${response.status}`);
            }

            if (!response.ok) {
                throw new Error(data.message || `TTS HTTP ${response.status}`);
            }
            if (!data.audioBase64) {
                throw new Error('No audio in TTS response');
            }

            ttsAudioCache.set(cacheKey, data.audioBase64);
            return data.audioBase64;
        } catch (error) {
            lastError = error;
            const raw = error && error.message ? String(error.message) : '';
            if (/quota|rate.?limit|exceeded|429/i.test(raw)) {
                break;
            }
        }
    }
    throw lastError || new Error('TTS failed');
}

/**
 * Decodes Cloud TTS MP3 (base64) and plays it with amplitude lip sync.
 * @param {string} audioBase64
 * @param {HTMLElement} button
 */
async function playTtsBase64(audioBase64, button) {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') {
        throw new Error('AudioContext not running');
    }

    const bytes = base64ToUint8Array(audioBase64);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    return new Promise((resolve, reject) => {
        stopTtsPlayback();
        stopLipSync(button);

        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.35;

        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        gain.gain.setValueAtTime(Math.min(1, volume * 1.4), audioContext.currentTime);
        source.buffer = buffer;
        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(audioContext.destination);
        ttsSource = source;

        source.onended = () => {
            if (ttsSource === source) ttsSource = null;
            stopLipSync(button);
            resolve();
        };

        try {
            source.start(0);
            if (button) {
                button.classList.remove('game15-figure--waiting');
                button.classList.add('game15-figure--speaking');
                startLipSync(button, analyser);
            }
        } catch (error) {
            ttsSource = null;
            stopLipSync(button);
            reject(error);
        }
    });
}

function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function stopTtsPlayback() {
    if (ttsSource) {
        try {
            ttsSource.onended = null;
            ttsSource.stop();
        } catch (_) {
            // already stopped
        }
        ttsSource = null;
    }
}

/** Rough check for iPhone/iPad Safari (speechSynthesis quirks differ from Android) */
function isAppleTouchBrowser() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Shows a short hint in the instructions line, then restores previous text.
 * @param {string} message
 * @param {number} [ms]
 */
function showTemporaryHint(message, ms = 4500) {
    if (!instructionsEl || !message) return;
    const prev = instructionsEl.textContent;
    instructionsEl.textContent = message;
    setTimeout(() => {
        if (instructionsEl) instructionsEl.textContent = prev;
    }, ms);
}

/**
 * Device/browser speechSynthesis (primary when USE_CLOUD_TTS is false).
 * Tries a Swedish voice first; if none is available, uses the device default and hints.
 * @param {string} text
 * @param {{ id: string }} figure
 * @param {HTMLElement} button
 * @returns {Promise<void>}
 */
async function speakWithBrowserVoice(text, figure, button) {
    if (!window.speechSynthesis) {
        const err = new Error('No browser speechSynthesis');
        err.code = 'NO_SPEECH';
        throw err;
    }

    // iOS/Android often populate voices asynchronously (and iOS can be slow)
    const allVoices = await waitForBrowserVoices(isAppleTouchBrowser() ? 4000 : 2000);
    let voice = pickSwedishVoice(allVoices, figure && figure.id);
    let usingSwedish = false;

    // iOS: re-resolve from a fresh getVoices() list (stale Voice objects are ignored)
    if (voice) {
        voice = resolveFreshVoice(voice) || voice;
    }

    if (voice && isSwedishVoice(voice)) {
        usingSwedish = true;
    } else {
        voice = null;
        usingSwedish = false;
        console.warn(
            '[Game15] No Swedish voice — using device default. Voices:',
            allVoices.map((v) => `${v.name} (${v.lang})`)
        );
        showTemporaryHint(
            STRINGS.noSwedishVoiceHint ||
                'Ingen svensk röst – använder telefonens vanliga röst.'
        );
    }

    const spokenText = toBrowserSpeechText(text);

    return new Promise((resolve, reject) => {
        stopBrowserSpeech();

        const utterance = new SpeechSynthesisUtterance(spokenText);
        if (usingSwedish && voice) {
            // Explicit Swedish voice + lang (needed on Android and iPhone)
            utterance.lang = 'sv-SE';
            utterance.voice = voice;
        } else {
            // Device default voice (may be English) — still request sv-SE when possible
            utterance.lang = 'sv-SE';
        }
        utterance.pitch = 1;
        // Slightly slower helps clarity on mobile TTS
        utterance.rate = isAppleTouchBrowser() ? 0.9 : 0.95;

        const volume = window.TiddeliGamesVolume?.get() ?? 0.35;
        utterance.volume = Math.min(1, Math.max(0.2, volume * 1.6));

        activeUtterance = utterance;
        console.log(
            '[Game15] voice:',
            usingSwedish ? `Swedish ${voice.name} (${voice.lang})` : 'device default'
        );

        utterance.onstart = () => {
            if (button) {
                button.classList.remove('game15-figure--waiting');
                button.classList.add('game15-figure--speaking');
                startFakeLipSync(button);
            }
        };
        utterance.onend = () => {
            if (activeUtterance === utterance) activeUtterance = null;
            stopLipSync(button);
            resolve();
        };
        utterance.onerror = (event) => {
            if (activeUtterance === utterance) activeUtterance = null;
            stopLipSync(button);
            if (event && event.error === 'interrupted') {
                resolve();
                return;
            }
            reject(new Error((event && event.error) || 'speech error'));
        };

        // iOS WebKit often drops the first speak() after cancel() unless we resume + delay
        const startSpeak = () => {
            try {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
            } catch (_) {
                // ignore
            }
            window.speechSynthesis.speak(utterance);
            if (isAppleTouchBrowser()) {
                try {
                    window.speechSynthesis.resume();
                } catch (_) {
                    // ignore
                }
            }
        };

        if (isAppleTouchBrowser()) {
            setTimeout(startSpeak, 60);
        } else {
            startSpeak();
        }
    });
}

function toBrowserSpeechText(text) {
    return String(text)
        .trim()
        .toLocaleLowerCase('sv-SE')
        .replace(/\s+/g, ' ');
}

/**
 * Waits until speechSynthesis voices are available (or timeout).
 * Polls as well — iOS Safari sometimes never fires voiceschanged promptly.
 * @param {number} [timeoutMs]
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
function waitForBrowserVoices(timeoutMs = 2000) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            resolve([]);
            return;
        }

        const read = () => window.speechSynthesis.getVoices() || [];
        const existing = read();
        // Prefer waiting a bit longer if we already have voices but none Swedish yet on iOS
        if (existing.length && existing.some(isSwedishVoice)) {
            resolve(existing);
            return;
        }

        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearInterval(pollId);
            window.clearTimeout(timeoutId);
            window.speechSynthesis.removeEventListener('voiceschanged', onChange);
            resolve(read());
        };
        const onChange = () => {
            const list = read();
            if (list.some(isSwedishVoice) || list.length > 0) {
                // If Swedish appeared, stop early; else keep polling until timeout
                if (list.some(isSwedishVoice)) finish();
            }
        };
        window.speechSynthesis.addEventListener('voiceschanged', onChange);
        // Nudge engines to load the list
        read();
        const pollId = window.setInterval(() => {
            const list = read();
            if (list.some(isSwedishVoice)) finish();
        }, 200);
        const timeoutId = window.setTimeout(finish, timeoutMs);
    });
}

function warmBrowserVoices() {
    if (!window.speechSynthesis) return;
    waitForBrowserVoices(isAppleTouchBrowser() ? 4000 : 2000).catch(() => {});
    window.speechSynthesis.addEventListener('voiceschanged', () => {
        window.speechSynthesis.getVoices();
    });
}

/**
 * True if a voice looks Swedish (lang, name, or known Apple Swedish voice names).
 * @param {SpeechSynthesisVoice} voice
 */
function isSwedishVoice(voice) {
    if (!voice) return false;
    const lang = String(voice.lang || '').replace(/_/g, '-').toLowerCase();
    const name = String(voice.name || '').toLowerCase();
    if (/^sv(-|$)/.test(lang)) return true;
    if (/swedish|svenska|\bsv-?se\b/.test(name)) return true;
    // Apple ships Swedish voices under first names (lang should be sv-SE; name-only as safety net)
    if (
        /^(alva|oskar|nora|ebba|majken|hugo)\b/.test(name) &&
        (/^sv/.test(lang) || /sweden|sverige|svenska|swedish/.test(name))
    ) {
        return true;
    }
    if (/^(alva|oskar)\b/.test(name) && (!lang || /^sv/.test(lang))) {
        return true;
    }
    return false;
}

/**
 * Re-fetch the same voice from a fresh getVoices() list (needed on iOS).
 * @param {SpeechSynthesisVoice} voice
 * @returns {SpeechSynthesisVoice|null}
 */
function resolveFreshVoice(voice) {
    if (!voice || !window.speechSynthesis) return null;
    const list = window.speechSynthesis.getVoices() || [];
    return (
        list.find((v) => v.voiceURI && voice.voiceURI && v.voiceURI === voice.voiceURI) ||
        list.find((v) => v.name === voice.name && v.lang === voice.lang) ||
        list.find((v) => v.name === voice.name) ||
        null
    );
}

/**
 * Picks a Swedish device voice. Returns null if none (do not fall back to English).
 * @param {SpeechSynthesisVoice[]} allVoices
 * @param {string} [figureId]
 * @returns {SpeechSynthesisVoice|null}
 */
function pickSwedishVoice(allVoices, figureId) {
    const swedish = (allVoices || []).filter(isSwedishVoice);
    if (!swedish.length) return null;

    // Prefer quality/local Swedish voices (Apple Alva, Google Svenska, etc.)
    const ranked = swedish.slice().sort((a, b) => {
        const score = (v) => {
            let s = 0;
            if (v.localService) s += 2;
            if (/alva/i.test(v.name)) s += 3; // common good Swedish voice on iPhone
            if (/oskar/i.test(v.name)) s += 2;
            if (/svenska|swedish/i.test(v.name)) s += 2;
            if (/sv-?SE/i.test(v.lang)) s += 1;
            if (/premium|enhanced|compact/i.test(v.name)) s += 1;
            return s;
        };
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, 'sv');
    });

    const index = Math.max(0, FIGURES.findIndex((f) => f.id === figureId));
    return ranked[index % ranked.length];
}

function stopBrowserSpeech() {
    activeUtterance = null;
    if (!window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
    } catch (_) {
        // ignore
    }
}

/**
 * Disables figures while a request/playback is in progress.
 * @param {string|null} activeId
 * @param {boolean} busy
 * @param {{ waiting?: boolean }} [options] - waiting=true: show “thinking”, no mouth animation
 */
function setFiguresBusy(activeId, busy, options = {}) {
    const waiting = !!options.waiting;
    state.figureButtons.forEach((btn, id) => {
        if (busy) {
            btn.disabled = true;
            if (id === activeId) {
                btn.classList.toggle('game15-figure--waiting', waiting);
                // Speaking (lip sync) is applied only when audio starts
                if (!waiting) {
                    btn.classList.add('game15-figure--speaking');
                } else {
                    btn.classList.remove('game15-figure--speaking');
                }
                btn.classList.remove('game15-figure--busy-others');
            } else {
                btn.classList.add('game15-figure--busy-others');
                btn.classList.remove('game15-figure--waiting', 'game15-figure--speaking');
            }
        } else {
            btn.disabled = false;
            btn.classList.remove(
                'game15-figure--speaking',
                'game15-figure--waiting',
                'game15-figure--busy-others'
            );
        }
    });
    // Keep play button in sync with robot busy state
    if (playButtonEl) {
        playButtonEl.disabled = !!busy;
        playButtonEl.classList.toggle('game15-play-btn--busy', !!busy);
        playButtonEl.classList.toggle('game15-play-btn--waiting', !!busy && waiting);
        playButtonEl.classList.toggle('game15-play-btn--speaking', !!busy && !waiting);
    }
}

/**
 * Bobs the robot avatar + mouth glow from live audio level (Cloud TTS path).
 * @param {HTMLElement} button
 * @param {AnalyserNode} analyser
 */
function startLipSync(button, analyser) {
    const avatar = button && button.querySelector('.game15-figure__avatar');
    const mouth = button && button.querySelector('.game15-figure__mouth-open');
    if (!analyser || (!avatar && !mouth)) return;
    stopLipSync(null);

    const timeData = new Uint8Array(analyser.fftSize);
    const tick = () => {
        analyser.getByteTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const bob = 1 + Math.min(0.08, rms * 0.9);
        const mouthOpen = Math.min(1, 0.25 + rms * 9);
        if (avatar) {
            avatar.style.transform = `scale(${bob}) translateY(${-rms * 6}px)`;
        }
        if (mouth) {
            mouth.style.opacity = String(mouthOpen);
            mouth.style.transform = `scaleY(${0.4 + mouthOpen * 0.9}) scaleX(${0.7 + mouthOpen * 0.4})`;
        }
        lipSyncRaf = requestAnimationFrame(tick);
    };
    lipSyncRaf = requestAnimationFrame(tick);
}

/**
 * Fake bob/mouth for browser speech fallback (no amplitude available).
 * @param {HTMLElement} button
 */
function startFakeLipSync(button) {
    const avatar = button && button.querySelector('.game15-figure__avatar');
    const mouth = button && button.querySelector('.game15-figure__mouth-open');
    if (!avatar && !mouth) return;
    stopLipSync(null);

    const tick = () => {
        const open = 0.35 + Math.random() * 0.65;
        if (avatar) {
            avatar.style.transform = `scale(${1 + open * 0.05}) translateY(${-open * 4}px)`;
        }
        if (mouth) {
            mouth.style.opacity = String(0.35 + open * 0.65);
            mouth.style.transform = `scaleY(${0.4 + open}) scaleX(${0.75 + open * 0.3})`;
        }
        lipSyncRaf = requestAnimationFrame(tick);
    };
    lipSyncRaf = requestAnimationFrame(tick);
}

/**
 * Stops speak animation and resets the robot to idle.
 * @param {HTMLElement|null} [button]
 */
function stopLipSync(button) {
    if (lipSyncRaf) {
        cancelAnimationFrame(lipSyncRaf);
        lipSyncRaf = 0;
    }
    if (button) {
        button.classList.remove('game15-figure--speaking', 'game15-figure--waiting');
        const avatar = button.querySelector('.game15-figure__avatar');
        const mouth = button.querySelector('.game15-figure__mouth-open');
        if (avatar) avatar.style.transform = '';
        if (mouth) {
            mouth.style.transform = '';
            mouth.style.opacity = '';
        }
    }
}

/**
 * Shows completion when all figures have spoken. No shared success sound.
 */
function showCompletionDialog() {
    if (!completionDialog) return;
    state.completed = true;
    stopBrowserSpeech();
    stopTtsPlayback();
    endThinkingWait();
    stopBackgroundAmbience();
    completionDialog.hidden = false;
    // Intentionally no playSharedCompletionSound — plan: silent confirmation
}

function hideCompletionDialog() {
    if (completionDialog) completionDialog.hidden = true;
}

function handleDialogBackClick() {
    window.location.href = '../../index.html';
}

function handleContinueClick() {
    hideCompletionDialog();
    startNewRound();
    requestBackgroundAudioStart();
}

/**
 * Resets text and spoken progress for another round.
 */
function startNewRound() {
    stopBrowserSpeech();
    stopTtsPlayback();
    endThinkingWait();
    state.text = '';
    state.caretIndex = 0;
    state.spokenCount = 0;
    state.speaking = false;
    state.completed = false;
    updateTextField();
    updateProgress();
    state.figureButtons.forEach((btn) => {
        btn.disabled = false;
        btn.classList.remove(
            'game15-figure--spoken',
            'game15-figure--speaking',
            'game15-figure--waiting',
            'game15-figure--busy-others'
        );
    });
    if (playButtonEl) {
        playButtonEl.disabled = false;
        playButtonEl.classList.remove(
            'game15-play-btn--busy',
            'game15-play-btn--waiting',
            'game15-play-btn--speaking'
        );
    }
}

async function ensureAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Could not create AudioContext:', error);
            return null;
        }
    }
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Could not resume AudioContext:', error);
        }
    }
    return audioContext;
}

function requestBackgroundAudioStart() {
    if (state.audioStarted || state.audioStarting) return;
    state.audioStarting = true;
    startBackgroundAmbience()
        .then(() => {
            state.audioStarted = true;
        })
        .catch((error) => {
            console.warn('Could not start ambience:', error);
        })
        .finally(() => {
            state.audioStarting = false;
        });
}

function handleFirstInteraction() {
    requestBackgroundAudioStart();
}

async function loadAudioBuffer(url) {
    if (!url) return null;
    if (audioBufferCache.has(url)) {
        return audioBufferCache.get(url);
    }
    await ensureAudioContext();
    if (!audioContext) return null;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferCache.set(url, buffer);
        return buffer;
    } catch (error) {
        console.warn('Could not load audio:', url, error);
        return null;
    }
}

function stopBackgroundAmbience() {
    // Thinking wait owns ducking — clear it if ambience is fully stopped
    stopThinkingLoop();
    state.ambienceDucked = false;

    if (backgroundSource) {
        try {
            backgroundSource.stop();
        } catch (_) {
            // already stopped
        }
        try {
            backgroundSource.disconnect();
        } catch (_) {
            // already disconnected
        }
        backgroundSource = null;
    }
    if (backgroundGain) {
        try {
            backgroundGain.disconnect();
        } catch (_) {
            // already disconnected
        }
        backgroundGain = null;
    }
    state.audioStarted = false;
    state.audioStarting = false;
}

async function startBackgroundAmbience() {
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    const rawPath = STRINGS.ambience && STRINGS.ambience.track;
    if (!rawPath) return;

    const ambiencePath = resolveGame15Asset(rawPath);
    try {
        const buffer = await loadAudioBuffer(ambiencePath);
        if (!buffer) return;
        backgroundBuffer = buffer;
        if (backgroundSource) {
            try {
                backgroundSource.stop();
            } catch (_) {
                // ignore
            }
        }
        backgroundSource = audioContext.createBufferSource();
        backgroundGain = audioContext.createGain();
        backgroundSource.buffer = backgroundBuffer;
        backgroundSource.loop = true;
        const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
        const level = state.ambienceDucked ? AMBIENCE_DUCKED_GAIN : AMBIENCE_GAIN;
        backgroundGain.gain.setValueAtTime(globalVolume * level, audioContext.currentTime);
        backgroundSource.connect(backgroundGain);
        backgroundGain.connect(audioContext.destination);
        backgroundSource.start(0);
    } catch (error) {
        console.warn('Could not start background ambience:', error);
    }
}

/**
 * Hard-stops thinking audio and restores ambience (errors, hide tab, round reset).
 */
function endThinkingWait() {
    stopThinkingLoop();
    setAmbienceDucked(false);
}

/**
 * Softly ducks or restores background ambience while thinking / speaking.
 * @param {boolean} ducked
 */
function setAmbienceDucked(ducked) {
    state.ambienceDucked = !!ducked;
    if (!backgroundGain || !audioContext || audioContext.state !== 'running') return;
    const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
    const level = state.ambienceDucked ? AMBIENCE_DUCKED_GAIN : AMBIENCE_GAIN;
    const now = audioContext.currentTime;
    backgroundGain.gain.cancelScheduledValues(now);
    backgroundGain.gain.setTargetAtTime(globalVolume * level, now, 0.06);
}

/**
 * Plays the hmm clip once (full length), then resolves. Leaves ambience ducked.
 */
async function playThinkingOnce() {
    setAmbienceDucked(true);
    await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;
    if (!state.speaking) return;

    const rawPath = STRINGS.thinking && STRINGS.thinking.track;
    if (!rawPath) return;

    const path = resolveGame15Asset(rawPath);
    const buffer = await loadAudioBuffer(path);
    if (!buffer || !state.speaking) return;

    stopThinkingLoop();

    await new Promise((resolve) => {
        thinkingSource = audioContext.createBufferSource();
        thinkingGain = audioContext.createGain();
        thinkingSource.buffer = buffer;
        thinkingSource.loop = false;
        const globalVolume = window.TiddeliGamesVolume?.get() ?? 0.35;
        thinkingGain.gain.setValueAtTime(globalVolume * THINKING_GAIN, audioContext.currentTime);
        thinkingSource.connect(thinkingGain);
        thinkingGain.connect(audioContext.destination);
        thinkingEndedResolve = resolve;
        thinkingSource.onended = () => {
            const done = thinkingEndedResolve;
            thinkingEndedResolve = null;
            thinkingSource = null;
            if (thinkingGain) {
                try {
                    thinkingGain.disconnect();
                } catch (_) {
                    // already disconnected
                }
                thinkingGain = null;
            }
            if (done) done();
        };
        try {
            thinkingSource.start(0);
        } catch (_) {
            thinkingEndedResolve = null;
            thinkingSource = null;
            resolve();
        }
    });
}

function stopThinkingLoop() {
    if (thinkingEndedResolve) {
        const done = thinkingEndedResolve;
        thinkingEndedResolve = null;
        done();
    }
    if (thinkingSource) {
        try {
            thinkingSource.onended = null;
            thinkingSource.stop();
        } catch (_) {
            // already stopped
        }
        try {
            thinkingSource.disconnect();
        } catch (_) {
            // already disconnected
        }
        thinkingSource = null;
    }
    if (thinkingGain) {
        try {
            thinkingGain.disconnect();
        } catch (_) {
            // already disconnected
        }
        thinkingGain = null;
    }
}

function handleVolumeChange(event) {
    if (!audioContext || audioContext.state !== 'running') return;
    const newVolume = event.detail && typeof event.detail.volume === 'number'
        ? event.detail.volume
        : window.TiddeliGamesVolume?.get() ?? 0.35;
    if (backgroundGain) {
        const level = state.ambienceDucked ? AMBIENCE_DUCKED_GAIN : AMBIENCE_GAIN;
        backgroundGain.gain.setValueAtTime(newVolume * level, audioContext.currentTime);
    }
    if (thinkingGain) {
        thinkingGain.gain.setValueAtTime(newVolume * THINKING_GAIN, audioContext.currentTime);
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        stopBrowserSpeech();
        stopTtsPlayback();
        endThinkingWait();
        if (audioContext && audioContext.state === 'running') {
            audioContext.suspend().catch(() => {});
        }
    } else if (audioContext && state.audioStarted) {
        audioContext.resume().catch(() => {});
    }
}
