/**
 * Local-only TTS API for Game 15 development.
 * Same contract as production: POST /api/tts → { audioBase64 }
 *
 * Uses Google Cloud Text-to-Speech via netlify/functions/tts.js.
 * Does not require Netlify CLI. Keep API keys out of Git.
 *
 * Usage:
 *   Put GOOGLE_TTS_API_KEY=... in a gitignored .env
 *   (or GEMINI_API_KEY if that key also has Cloud Text-to-Speech enabled)
 *   npm run tts-api
 *
 * Then run the site with `npm run dev` (or use `npm run dev:full`).
 * On localhost the game calls http://127.0.0.1:8888/api/tts
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handler } = require('../netlify/functions/tts.js');

const PORT = Number(process.env.TTS_API_PORT) || 8888;
const ROOT = path.join(__dirname, '..');

/**
 * Load KEY=VALUE pairs from a file into process.env if not already set.
 * @param {string} filePath
 */
function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    text.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) return;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    });
}

// Prefer project-root .env; fall back to promptgenerator/.env (gitignored)
loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, 'promptgenerator', '.env'));

if (!process.env.GOOGLE_TTS_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('GOOGLE_TTS_API_KEY is not set (Cloud Text-to-Speech).');
    console.error('Put it in a gitignored .env (project root or promptgenerator/.env),');
    console.error('or export it in the shell before running npm run tts-api.');
    console.error('Enable the Text-to-Speech API on your Google Cloud project.');
    process.exit(1);
}

if (!process.env.GOOGLE_TTS_API_KEY && process.env.GEMINI_API_KEY) {
    console.warn(
        'Using GEMINI_API_KEY as fallback — it must have Cloud Text-to-Speech API enabled.'
    );
}

const server = http.createServer(async (req, res) => {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        res.end();
        return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/api/tts') {
        res.writeHead(404, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ message: 'Not found. Use POST /api/tts' }));
        return;
    }

    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
        // Guard against huge bodies
        if (body.length > 10000) {
            req.destroy();
        }
    });

    req.on('end', async () => {
        try {
            const result = await handler({
                httpMethod: req.method || 'POST',
                body
            });
            res.writeHead(result.statusCode || 200, {
                ...cors,
                ...(result.headers || {})
            });
            res.end(result.body || '');
        } catch (error) {
            console.error('local-tts-api error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json', ...cors });
            res.end(JSON.stringify({ message: error.message || 'Server error' }));
        }
    });
});

server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
        // Another tts-api (or leftover process) already owns the port.
        // Exit 0 so `npm run dev:full` can keep CSS + Live Server running.
        console.warn(`Port ${PORT} already in use — assuming TTS API is already running.`);
        console.warn(`Using http://127.0.0.1:${PORT}/api/tts`);
        process.exit(0);
    }
    console.error('local-tts-api listen error:', error);
    process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Local TTS API listening on http://127.0.0.1:${PORT}/api/tts`);
    console.log('Provider: Google Cloud Text-to-Speech (Chirp 3 HD Swedish)');
    console.log('Open the game (npm run dev / Live Server), then try Game 15.');
});
