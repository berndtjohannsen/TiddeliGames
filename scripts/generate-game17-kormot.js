/**
 * Writes games/game17/sounds/KorMot.mp3 via the same Google TTS handler as production.
 * Requires GOOGLE_TTS_API_KEY (or GEMINI_API_KEY) in promptgenerator/.env or project .env.
 *
 * Usage (from repo root): node --use-system-ca scripts/generate-game17-kormot.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TiddeliGames-assets', 'games', 'game17', 'sounds', 'KorMot.mp3');
const PHRASE = 'Kör mot';

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .forEach((line) => {
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
            if (!process.env[key]) process.env[key] = value;
        });
}

loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, 'promptgenerator', '.env'));

async function main() {
    const { handler } = require(path.join(ROOT, 'netlify', 'functions', 'tts.js'));
    const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ text: PHRASE, figureId: 'robot' })
    };
    const res = await handler(event, {});
    const body = JSON.parse(res.body || '{}');
    if (res.statusCode !== 200 || !body.audioBase64) {
        console.error('TTS failed:', res.statusCode, body);
        process.exit(1);
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, Buffer.from(body.audioBase64, 'base64'));
    console.log('Wrote', OUT, '(' + fs.statSync(OUT).size + ' bytes)');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
