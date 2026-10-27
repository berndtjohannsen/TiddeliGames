/**
 * Generate game18 furniture sprites for vit / svart / orange / rosa using Gemini image + reference PNG.
 * Post-process: background removal and resize to match the blue (bla) reference dimensions.
 *
 * Requires GEMINI_API_KEY in promptgenerator/gemini.env (or promptgenerator/.env).
 *
 * Usage (repo root):
 *   node --use-system-ca scripts/generate-game18-color-variants.js
 *   node --use-system-ca scripts/generate-game18-color-variants.js --only=sang
 *   node --use-system-ca scripts/generate-game18-color-variants.js --force
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'TiddeliGames-assets', 'games', 'game18', 'images');
const MODEL = 'gemini-2.5-flash-image';
const EXTENDED_COLORS = ['vit', 'svart', 'orange', 'rosa'];

const COLOR_DESC = {
    vit: 'white / off-white painted wood (#f1f5f9)',
    svart: 'very dark charcoal painted wood (#1e293b), not pure black',
    orange: 'bright orange painted wood (#f97316)',
    rosa: 'pink painted wood (#ec4899)'
};

const FLOOR_ITEMS = [
    { id: 'sang', label: 'wooden bed with mattress and pillow' },
    { id: 'bord', label: 'wooden table' },
    { id: 'soffa', label: 'sofa / couch' },
    { id: 'pall', label: 'wooden stool' }
];

const CONTAINER_ITEMS = [
    { id: 'korg', label: 'woven basket' },
    { id: 'lada', label: 'wooden crate / box' },
    { id: 'skap', label: 'wooden cabinet' }
];

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildJobs() {
    const jobs = [];
    for (const item of FLOOR_ITEMS) {
        for (const colorId of EXTENDED_COLORS) {
            jobs.push({
                colorId,
                itemId: item.id,
                label: item.label,
                reference: path.join(ASSETS, 'items', `${item.id}_bla.png`),
                output: path.join(ASSETS, 'items', `${item.id}_${colorId}.png`),
                kind: 'item'
            });
        }
    }
    for (const item of CONTAINER_ITEMS) {
        for (const colorId of EXTENDED_COLORS) {
            for (const state of ['closed', 'open']) {
                jobs.push({
                    colorId,
                    itemId: item.id,
                    label: item.label,
                    state,
                    reference: path.join(ASSETS, 'containers', `${item.id}_bla_${state}.png`),
                    output: path.join(ASSETS, 'containers', `${item.id}_${colorId}_${state}.png`),
                    kind: 'container'
                });
            }
        }
    }
    return jobs;
}

function buildPrompt(job) {
    const colorText = COLOR_DESC[job.colorId] || job.colorId;
    const stateText =
        job.state === 'open'
            ? 'Show the same object with its lid or door open and empty inside, matching the reference open pose.'
            : job.state === 'closed'
              ? 'Keep the container closed like the reference.'
              : '';
    return [
        "Children's educational game sprite. Use the attached reference image.",
        `Same object (${job.label}), same camera angle, proportions, line art, and shading.`,
        `Only change the main painted wood / frame color to ${colorText}.`,
        'Keep non-wood parts (mattress, pillow, fabric, basket weave tone) consistent with the reference unless they are clearly painted wood.',
        stateText,
        'Output one image with a fully transparent background outside the object — no checkerboard, no floor, no drop shadow on background.'
    ]
        .filter(Boolean)
        .join(' ');
}

async function generateImage(apiKey, referencePath, prompt) {
    const refB64 = fs.readFileSync(referencePath).toString('base64');
    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: 'image/png', data: refB64 } }
                ]
            }
        ],
        generationConfig: { responseModalities: ['IMAGE'] }
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.error) {
        throw new Error(json.error.message || JSON.stringify(json.error));
    }
    const parts = json.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        const data = part.inlineData?.data || part.inline_data?.data;
        if (data) return Buffer.from(data, 'base64');
    }
    throw new Error('No image in Gemini response');
}

function finalizePng(rawPath, referencePath, outputPath) {
    const py = `
import io, sys
from PIL import Image
from rembg import remove, new_session

raw_path, ref_path, out_path = sys.argv[1:4]
ref = Image.open(ref_path)
tw, th = ref.size
session = new_session('u2net')
with open(raw_path, 'rb') as f:
    cut = remove(f.read(), session=session)
im = Image.open(io.BytesIO(cut)).convert('RGBA')
bbox = im.getbbox()
if bbox:
    im = im.crop(bbox)
im.thumbnail((tw, th), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
x = (tw - im.width) // 2
y = th - im.height
canvas.paste(im, (x, y), im)
canvas.save(out_path, 'PNG', optimize=True)
print(out_path, canvas.size)
`;
    const result = spawnSync('python', ['-c', py, rawPath, referencePath, outputPath], {
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'finalize failed');
    }
}

async function main() {
    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];

    loadEnvFile(path.join(ROOT, 'promptgenerator', 'gemini.env'));
    loadEnvFile(path.join(ROOT, 'promptgenerator', '.env'));
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('Missing GEMINI_API_KEY in promptgenerator/gemini.env');
        process.exit(1);
    }

    let jobs = buildJobs();
    if (only) {
        jobs = jobs.filter((j) => j.itemId === only);
    }

    const tmpDir = path.join(ASSETS, '_gen_tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    let ok = 0;
    let skip = 0;
    let fail = 0;

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const tag = `${job.itemId}_${job.colorId}${job.state ? '_' + job.state : ''}`;
        if (!fs.existsSync(job.reference)) {
            console.warn(`[skip] no reference: ${job.reference}`);
            skip++;
            continue;
        }
        if (fs.existsSync(job.output) && !force) {
            console.log(`[skip] exists: ${path.relative(ROOT, job.output)}`);
            skip++;
            continue;
        }

        console.log(`[${i + 1}/${jobs.length}] ${tag}…`);
        const rawPath = path.join(tmpDir, `${tag}_raw.png`);
        try {
            const buffer = await generateImage(apiKey, job.reference, buildPrompt(job));
            fs.writeFileSync(rawPath, buffer);
            fs.mkdirSync(path.dirname(job.output), { recursive: true });
            finalizePng(rawPath, job.reference, job.output);
            fs.unlinkSync(rawPath);
            ok++;
            await sleep(2500);
        } catch (err) {
            console.error(`[fail] ${tag}:`, err.message || err);
            fail++;
            await sleep(5000);
        }
    }

    console.log(`Done. generated=${ok} skipped=${skip} failed=${fail}`);
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
