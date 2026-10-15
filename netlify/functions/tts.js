/**
 * Google Cloud Text-to-Speech proxy for Game 15 (Netlify Function).
 * Keeps the API key on the server — never expose it to the browser.
 *
 * Public URL (via netlify.toml rewrite): POST /api/tts
 * Internal Netlify path:                 /.netlify/functions/tts
 *
 * POST JSON body: { text: string, voice?: string, figureId?: string }
 * Response JSON:  { audioBase64: string }  (MP3)
 *
 * Required env (one of):
 *   GOOGLE_TTS_API_KEY  – preferred (Cloud project with Text-to-Speech API enabled)
 *   GEMINI_API_KEY      – fallback only if that key also has Cloud TTS enabled
 *
 * A future container can expose the same POST /api/tts contract.
 */

'use strict';

const MAX_CHARS = 40;
const LANGUAGE_CODE = 'sv-SE';

/**
 * Single robot figure → Chirp 3 HD Swedish (Leda — soft/clear for kids).
 * Cost: Chirp is higher than WaveNet; ~200 req/min default quota.
 */
const FIGURE_VOICES = Object.freeze({
    robot: {
        voiceName: 'sv-SE-Chirp3-HD-Leda',
        speakingRate: 0.95,
        pitch: 0
    }
});

/** Allowlisted Cloud voice names */
const ALLOWED_VOICE_NAMES = new Set(
    Object.values(FIGURE_VOICES).map((v) => v.voiceName)
);

const DEFAULT_VOICE = FIGURE_VOICES.robot;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/**
 * Prepare text for speech (UI stays uppercase; Cloud TTS gets lowercase Swedish).
 * @param {string} text
 * @returns {string}
 */
function toSpeechText(text) {
    return String(text)
        .trim()
        .toLocaleLowerCase('sv-SE')
        .replace(/\s+/g, ' ');
}

/**
 * Resolve voice settings from figureId and/or client voice name.
 * @param {string} figureId
 * @param {string} voiceName
 */
function resolveVoiceConfig(figureId, voiceName) {
    if (figureId && FIGURE_VOICES[figureId]) {
        return FIGURE_VOICES[figureId];
    }
    if (voiceName && ALLOWED_VOICE_NAMES.has(voiceName)) {
        return {
            voiceName,
            speakingRate: 1.0,
            pitch: 0
        };
    }
    return DEFAULT_VOICE;
}

/**
 * @param {object} body
 * @param {number} status
 */
function jsonResponse(body, status = 200) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
        },
        body: JSON.stringify(body)
    };
}

exports.handler = async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return jsonResponse({ message: 'Method not allowed' }, 405);
    }

    const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return jsonResponse(
            {
                message:
                    'Server misconfigured: set GOOGLE_TTS_API_KEY (Cloud Text-to-Speech) in environment variables.'
            },
            500
        );
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (_) {
        return jsonResponse({ message: 'Invalid JSON body' }, 400);
    }

    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    const voice = typeof payload.voice === 'string' ? payload.voice.trim() : '';
    const figureId = typeof payload.figureId === 'string' ? payload.figureId.trim() : '';

    if (!text || text.length > MAX_CHARS) {
        return jsonResponse({ message: `Text must be 1–${MAX_CHARS} characters.` }, 400);
    }

    const voiceConfig = resolveVoiceConfig(figureId, voice);
    const speechText = toSpeechText(text);
    if (!speechText) {
        return jsonResponse({ message: `Text must be 1–${MAX_CHARS} characters.` }, 400);
    }

    const apiUrl =
        'https://texttospeech.googleapis.com/v1/text:synthesize?key=' +
        encodeURIComponent(apiKey);

    const cloudBody = {
        input: { text: speechText },
        voice: {
            languageCode: LANGUAGE_CODE,
            name: voiceConfig.voiceName
        },
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: voiceConfig.speakingRate,
            pitch: voiceConfig.pitch
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cloudBody)
        });

        const result = await response.json();
        if (!response.ok) {
            const msg =
                (result && result.error && result.error.message) ||
                `Cloud TTS HTTP ${response.status}`;
            return jsonResponse({ message: msg }, 502);
        }

        const audioBase64 = result && result.audioContent;
        if (!audioBase64) {
            return jsonResponse({ message: 'No audio returned from Cloud TTS.' }, 502);
        }

        return jsonResponse({ audioBase64 });
    } catch (error) {
        console.error('TTS function error:', error);
        return jsonResponse(
            { message: error && error.message ? error.message : 'TTS request failed' },
            500
        );
    }
};
