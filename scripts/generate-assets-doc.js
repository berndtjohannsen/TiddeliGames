#!/usr/bin/env node
/**
 * Build docs/assets.md from code references + optional on-disk TiddeliGames-assets tree.
 * Run from repo root: node scripts/generate-assets-doc.js
 * Optional: ASSETS_ROOT=/path/to/TiddeliGames-assets node scripts/generate-assets-doc.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'assets.md');
const LICENSE_OVERRIDE = path.join(ROOT, 'docs', 'asset-licenses.json');

const ASSETS_ROOT = process.env.ASSETS_ROOT
    ? path.resolve(process.env.ASSETS_ROOT)
    : path.join(ROOT, '..', 'TiddeliGames-assets');

/** @type {Record<string, string>} per-file license override (relative path from assets repo root) */
let licenseOverrides = {};
if (fs.existsSync(LICENSE_OVERRIDE)) {
    try {
        licenseOverrides = JSON.parse(fs.readFileSync(LICENSE_OVERRIDE, 'utf8'));
    } catch (e) {
        console.warn('Could not parse docs/asset-licenses.json:', e.message);
    }
}

/** Guess licence from path/name when no override (edit docs/asset-licenses.json for accuracy). */
function guessLicense(relPath) {
    if (licenseOverrides[relPath]) return licenseOverrides[relPath];
    const lower = relPath.toLowerCase();
    if (lower.includes('/shared/sounds/complete_')) return 'owner_nc (app)';
    if (lower.endsWith('background.mp3') || lower.includes('ambience')) return 'suno_nc (README credits)';
    if (lower.includes('/sounds/prompts/') || /^(sounds\/[a-z0-9_]+\.mp3)$/.test(lower.split('/').slice(-2).join('/'))) {
        if (/klicka_|rakna_|drag_|varstardet|forsok|kor|peka|count_|how_many/.test(lower)) {
            return 'gemini_tts (promptgenerator)';
        }
    }
    if (lower.includes('game2/sounds/')) return 'recorded_fx (fill in source)';
    if (lower.includes('game11/images/')) return 'user_supplied_art (e.g. toys.zip); owner_nc in app';
    if (lower.includes('game18/images/')) return 'generated/commissioned (fill in)';
    if (lower.includes('game15/')) return 'webp_art + suno_nc BGM typical';
    if (lower.endsWith('.webp') || lower.endsWith('.png') || lower.endsWith('.jpg')) {
        return 'fill_in (docs/asset-licenses.json)';
    }
    if (lower.endsWith('.mp3')) return 'fill_in (Suno / Elevenlabs / gemini_tts / recorded)';
    return 'fill_in';
}

function formatBytes(n) {
    if (n == null) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function statFile(absPath) {
    try {
        const s = fs.statSync(absPath);
        return { size: s.size, dims: '—' };
    } catch {
        return { size: null, dims: '—' };
    }
}

/** Collect quoted asset paths from source text. */
function extractPathsFromSource(text) {
    const found = new Set();
    const re = /(?:images|sounds|video)\/[a-zA-Z0-9_\-./]+\.(?:mp3|png|jpg|jpeg|webp|gif|svg|mp4|webm)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        let p = m[0].replace(/\?v=[^'"]+/gi, '');
        found.add(p);
    }
    return found;
}

function listGameIds() {
    return fs
        .readdirSync(path.join(ROOT, 'games'), { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^game\d+$/.test(d.name))
        .map((d) => d.name)
        .sort((a, b) => parseInt(a.replace('game', ''), 10) - parseInt(b.replace('game', ''), 10));
}

function collectFromCode(gameId) {
    const paths = new Set();
    for (const file of ['strings.js', 'game.js']) {
        const fp = path.join(ROOT, 'games', gameId, file);
        if (!fs.existsSync(fp)) continue;
        const text = fs.readFileSync(fp, 'utf8');
        extractPathsFromSource(text).forEach((p) => paths.add(p));
    }
    return paths;
}

function collectFromDisk(gameId) {
    const base = path.join(ASSETS_ROOT, 'games', gameId);
    const paths = new Set();
    if (!fs.existsSync(base)) return paths;

    function walk(dir, prefix) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = `${prefix}${ent.name}`;
            if (ent.isDirectory()) walk(path.join(dir, ent.name), `${rel}/`);
            else if (/\.(mp3|png|jpg|jpeg|webp|gif|svg|mp4|webm)$/i.test(ent.name)) paths.add(rel);
        }
    }
    walk(base, '');
    return paths;
}

function sharedFromDisk() {
    const base = path.join(ASSETS_ROOT, 'assets', 'shared');
    const paths = new Set();
    if (!fs.existsSync(base)) {
        for (let i = 1; i <= 71; i++) paths.add(`shared/sounds/complete_${i}.mp3`);
        return paths;
    }
    function walk(dir, prefix) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = `${prefix}${ent.name}`;
            if (ent.isDirectory()) walk(path.join(dir, ent.name), `${rel}/`);
            else paths.add(rel);
        }
    }
    walk(base, 'shared/');
    return paths;
}

function game18Note() {
    return [
        '**Dynamic paths (not all listed in strings.js):**',
        '- `images/items/{itemType}_{colorId}.png`',
        '- `images/containers/{itemType}_{colorId}_closed.png` / `_open.png`',
        '- `sounds/prompts/{colorId}_{itemTypeId}.mp3` (one per colour×item pair in use)',
        ''
    ];
}

function game11Note() {
    return [
        '**Large PNG set:** `images/ball*.png`, `car*.png`, `bucket*.png`, etc. — see `OBJECT_IMAGES` in `games/game11/game.js` (10 colours × object types).',
        ''
    ];
}

function buildDoc() {
    const gameIds = listGameIds();
    const assetsOnDisk = fs.existsSync(ASSETS_ROOT);
    const generatedAt = new Date().toISOString().slice(0, 10);

    let md = '';
    md += '# TiddeliGames asset inventory\n\n';
    md += `Generated: **${generatedAt}** by \`node scripts/generate-assets-doc.js\`. `;
    md += 'Re-run after code or assets change. ';
    if (assetsOnDisk) {
        md += `Sizes from \`${ASSETS_ROOT}\`.\n\n`;
    } else {
        md += `**No local assets folder** at \`${ASSETS_ROOT}\` — file names from code only; sizes show as — until ASSETS_ROOT is set.\n\n`;
    }

    md += '## Licence legend\n\n';
    md += '| Code | Meaning |\n|------|--------|\n';
    md += '| `owner_nc` | Berndt / TiddeliGames — non-commercial in-app use only (`README.md`) |\n';
    md += '| `suno_nc` | Suno AI — non-commercial per README credits |\n';
    md += '| `elevenlabs_nc` | Elevenlabs — non-commercial per README credits |\n';
    md += '| `gemini_tts` | Voice from `promptgenerator/` (Gemini TTS → lamejs MP3) |\n';
    md += '| `user_supplied_art` | Art packs supplied by owner (document zip/source in `docs/asset-licenses.json`) |\n';
    md += '| `fill_in` | **You must set** in `docs/asset-licenses.json` |\n\n';

    md += 'Per-file overrides: edit **`docs/asset-licenses.json`** (keys = path relative to assets repo, e.g. `games/game1/sounds/background.mp3`).\n\n';
    md += '---\n\n';

    md += '## Shared assets (`TiddeliGames-assets/assets/shared/`)\n\n';
    const shared = [...sharedFromDisk()].sort();
    md += '| File (under assets repo) | Size | Licence (guess) |\n|---|---|---|\n';
    const completeFiles = shared.filter((p) => /complete_\d+\.mp3/.test(p));
    const sharedRest = shared.filter((p) => !/complete_\d+\.mp3/.test(p));
    if (completeFiles.length) {
        md += '| `shared/sounds/complete_1.mp3` … `complete_71.mp3` | (71 files) | owner_nc (app) |\n';
    }
    for (const p of sharedRest) {
        const abs = path.join(ASSETS_ROOT, 'assets', p.replace(/^shared\//, ''));
        const { size } = assetsOnDisk ? statFile(abs) : { size: null };
        md += `| \`${p}\` | ${formatBytes(size)} | ${guessLicense(p)} |\n`;
    }
    md += '\n---\n\n';

    for (const gameId of gameIds) {
        const codePaths = collectFromCode(gameId);
        const diskPaths = collectFromDisk(gameId);
        const all = new Set([...codePaths, ...diskPaths]);
        const sorted = [...all].sort();

        md += `## ${gameId}\n\n`;
        md += `On assets host: \`games/${gameId}/\`\n\n`;
        if (gameId === 'game18') md += game18Note().join('\n');
        if (gameId === 'game11') md += game11Note().join('\n');
        if (gameId === 'game16' || gameId === 'game17') {
            md += '**Word MP3s:** resolved from `games/game14/sounds/` (paths duplicated in strings for ids only).\n\n';
        }

        if (!sorted.length) {
            md += '_No paths found in strings.js/game.js; check assets repo manually._\n\n';
            continue;
        }

        md += '| Relative path | Size | Licence (guess) |\n|---|---|---|\n';
        for (const rel of sorted) {
            const abs = path.join(ASSETS_ROOT, 'games', gameId, rel);
            const { size } = assetsOnDisk ? statFile(abs) : { size: null };
            const licenseKey = `games/${gameId}/${rel}`;
            const lic = licenseOverrides[licenseKey] || guessLicense(licenseKey);
            md += `| \`${rel}\` | ${formatBytes(size)} | ${lic} |\n`;
        }
        md += '\n';
    }

    md += '---\n\n';
    md += '## Hub / shell (app repo only)\n\n';
    md += '| Path | Notes |\n|---|---|\n';
    md += '| `assets/icons/icon-192.png`, `icon-512.png` | PWA icons — owner_nc |\n';
    md += '| `assets/shared/` in help | `help.png` via `TiddeliAssets.resolveSharedAsset` if on assets host |\n';

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, md, 'utf8');
    console.log('Wrote', OUT, `(${md.split('\n').length} lines)`);
    if (!assetsOnDisk) {
        console.log('Tip: ASSETS_ROOT=/path/to/TiddeliGames-assets node scripts/generate-assets-doc.js');
    }
}

buildDoc();
