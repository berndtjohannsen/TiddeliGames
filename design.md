# Description
This file describes the implementation, architectural details and tech stack. It is written for **human developers and AI assistants** (including handover to another bot such as Grokbot). Pair it with **`.cursorrules`** (workspace rules) and **`docs/assets.md`** (media inventory + licences).

# Handover for AI agents

Read this section first when picking up the project cold.

## Repositories and deployment

| Location | Purpose |
|----------|---------|
| **This repo (`TiddeliGames`)** | PWA shell, hub, and all game HTML/CSS/JS. No large media files. |
| **`TiddeliGames-assets`** (separate repo or sibling folder) | Images, sounds, video. Mirrors `games/{gameId}/...` and `assets/shared/...`. |
| **Production app** | https://tiddelipom.com |
| **Production assets** | `APP_CONFIG.assetBaseUrl` in `js/config.js` (e.g. `https://tiddeligames-assets.netlify.app`) |

**Local dev:** `js/assets.js` uses base `/TiddeliGames-assets` on `localhost`, `127.0.0.1`, and common LAN IPs (phone testing against the PC). Mount the assets folder at that path (parent directory containing both repos works).

**Deploy:** Push app and assets independently. After media changes on the assets host, users only see new files when **`assetVersion`** changes (appended as `?v=` on resolved URLs).

## Versions (single source: `js/config.js`)

| Field | When to bump |
|-------|----------------|
| `version` | Any app code, HTML, CSS, JS, or PWA behaviour change. Also drives SW registration: `sw.js?v=${version}` (`js/pwa.js`). |
| `assetVersion` | When files on the assets Netlify site change. Can bump alone if only media changed. |

Bump both together when releasing a coordinated app + media update. Do **not** maintain a separate version in `manifest.json` (not in spec). `sw.js` reads cache name from the `v` query param on the SW URL, not from a hard-coded string in the file.

## User / owner conventions (from `.cursorrules`)

- **Ask before:** new external libraries, new files or directories, deleting files (especially assets).
- **Do not edit unless asked:** `README.md`, `tasks.md`, `.cursorrules`, `.gitignore`, `ignore.txt`.
- **Git:** User normally commits and pushes; only commit when they explicitly ask.
- **Code style:** Comment HTML, CSS, and JavaScript (English). Prefer small, low-regression diffs; reuse existing patterns.
- **Live Server:** User runs it; you do not need to start it.
- **License:** Non-commercial app (`README.md`); MIT third-party deps (Tailwind, Tone.js CDN) are fine for commercial *libraries* only — the app’s own license still applies.

## Game catalog (19 games)

The hub list is authoritative in `js/strings.js` → `APP_STRINGS.games.items` (ids `game1` … `game19`). Each game folder: `index.html`, `game.js`, `game.css`, `strings.js`.

| Id | Hub title | Maintainer notes |
|----|-----------|------------------|
| game1–game13 | (see `strings.js`) | Numbers, animals, words, arithmetic, drag-match, etc. |
| game11 | Färger | Drag-and-drop colour match; object PNGs on assets host; see [Game 11 assets](#game-11-colour-drag--drop-assets) |
| game14 | Var står det? | **Canonical word bank** + word MP3s under `games/game14/sounds/` |
| game15 | Prata med oss | On-device / robot speech (not the standard prompt MP3 pipeline) |
| game16 | Träffa ordet | Slingshot; **word audio resolved via `game14`** in `game.js` |
| game17 | Kör mot ordet | Driving game; **word audio from `game14`** |
| game18 | Hitta kaninen? | Colour + item prompts (`promptIntroSound`, per-pair clips); heavy prefetch |
| game19 | Räkna hoppen | Round intro sounds + answer prompt |

**UI copy:** Completion dialog button is **`Igen`** (`labels.continue` in each game’s `strings.js`), not “Fortsätt”.

## Cross-repo and cross-game dependencies

- **game16 / game17:** Same word list as game14; `TiddeliAssets.resolveGameAsset('game14', path)` for word MP3s. New words → add to game14 assets + strings, then game16/17 strings if needed.
- **Shared completion SFX:** `assets/shared/sounds/complete_1.mp3` … `complete_71.mp3` via `playSharedCompletionSound()` in `js/audio.js`.
- **Prompt creation:** `promptgenerator/index.html` in this repo (Gemini TTS → 24 kHz mono MP3). Optional `npm run serve:promptgenerator`.

## Speech/listen UX pattern (games 14, 16, 17, 18, 19)

When touching listen buttons or prompt playback:

1. **Prefetch** intro, prompt, and round word/clips on init and before each round (`loadAudioBuffer` + cache).
2. **Decode to `AudioBuffer`** before playing Web Audio sequences (avoids glitches on slow networks).
3. **Listen control:** Replay prompt; avoid pulsing, disabled state, or wait-cursor while audio is playing (current product choice).
4. **game14:** May enable answering when the **target word** audio starts (keep this behaviour when changing timing).

Reference implementations: `games/game14/game.js`, `games/game18/game.js` (also prefetch all colour/item pairs).

## Agent workflow checklist

1. Read **`docs/assets.md`** and **`docs/asset-licenses.json`** before adding or deleting media.
2. Read affected `strings.js` for Swedish copy and sound filenames.
3. Resolve URLs only through `window.TiddeliAssets` (`js/assets.js`).
4. New game? Follow [New game checklist](#new-game-checklist-gamen) exactly.
5. Bump `version` / `assetVersion` in `js/config.js` as appropriate; rerun `npm run generate:assets-doc` when media changes.
6. Suggest Playwright or manual portrait test after mechanic changes.

## Game 11 (colour drag & drop) assets

- Ten colours in `COLORS` in `game11/game.js` (including svart, brun, orange, vit).
- Images on assets host: transparent **PNG** (e.g. `ballRed.png`, `ballWhite.png`, `bucketPurple.png`). Prefer source art with alpha (e.g. user-supplied `toys.zip` 512×512 RGBA).
- **CSS:** Use `filter: drop-shadow(...)` on `.game11-target__image`, not `box-shadow` (square halo on transparent PNGs). Extra subtle outline filter on `[data-color-id="white"]` for visibility.
- Do not over-aggressively colour-key white balls — can erase the sprite.

## Asset inventory and licences

Full file list (names, sizes when `TiddeliGames-assets` is present, licence guesses): **`docs/assets.md`**.

- Regenerate after code or media changes: `npm run generate:assets-doc` (optional `ASSETS_ROOT=...`).
- **Authoritative licence record:** edit **`docs/asset-licenses.json`** with paths under the assets repo (`games/gameN/...`). Grokbot/Cursor use this when the desktop spreadsheet is unavailable.

## Per-game summary (pedagogy, age, difficulty, strings)

Hub age hints are in `js/strings.js` descriptions; below is what each game *does* and which `strings.js` fields matter. Use this to avoid cloning an existing mechanic.

| Game | Teaches | Age | Difficulty / rounds | Key `strings.js` fields |
|------|---------|-----|---------------------|-------------------------|
| game1 Siffror | Tap numbers 1–10 in order | 3+ | Sequential unlock; all circles must be found | `gameIntroSound`, `labels`, `dialog`, `messages`, `aria` |
| game2 Ljud | Cause/effect sounds | 1+ | Open play; random card grid | `items[]` (image+sound), `ambience.track`, `labels` |
| game3 Räkna frukter | Counting objects | 3+ | Random counts; pick number | `gameIntroSound`, `ambience`, `labels`, `dialog` |
| game4 Ord | Picture–word recognition | 4+ | Multiple choice images per word | `words[]`, `ambience`, optional local `complete` |
| game5 Addera | Addition (emoji groups) | 4+ | Two groups; sum 2–10 typical | `ambience`, `labels`, `dialog` |
| game6 Stava ord | Spelling | 5+ | Letter order; word list | `words[]`, `ambience`, `labels` |
| game7 Subtrahera | Subtraction | 4+ | Two groups; difference | same pattern as game5 |
| game8 Stora/små | Upper/lowercase match | 4+ | Pair letters | `pairs[]`, `ambience` |
| game9 Addera siffror | Numeric addition | 5+ | Sum two numbers | `ambience`, `labels` |
| game10 Första bokstaven | First letter of word | 4+ | Pick letter for picture | `gameIntroSound`, `words[]`, `ambience` |
| game11 Färger | Colour names + drag-drop | 3+ | 4 random colours × 1 object type per round | `ambience`, `labels`; images in `game.js` `OBJECT_IMAGES` |
| game12 Matcha ord | Drag word to emoji | 4+ | game4 word bank; D&D like game11 | `gameIntroSound`, `wordPairs[]`, `ambience`, `aria` |
| game13 Räkna enkelt | Simple counting drag | 4+ | Drag answer to problem | rounds/items in `strings.js`, `ambience` |
| game14 Var står det? | Hear word, find among 4 | 4+ | Random 4-of-word-bank; listen replay | `promptSound`, `words[]`, `ambience`, `labels.listen` |
| game15 Prata med oss | Typed phrases + robot | 4+ | Free text; robot voice | `ambience`, `thinking`, `robot` image path |
| game16 Träffa ordet | Aim word with slingshot | 4+ | 4 targets; physics rounds | `promptSound`, `words[]` (audio **game14**), `ambience` |
| game17 Kör mot ordet | Steer car to correct word | 4+ | Obstacles; canvas scene | `promptSound`, `words[]` (audio **game14**), many SFX fields, `media` |
| game18 Hitta kaninen? | Colour + object ID | 3+ | Pairs in room; many prompt MP3s | `promptIntroSound`, `promptSoundFor()`, `media`, `errorSound`, `rabbitSound` |
| game19 Räkna hoppen | Count rabbit hops | 4+ | 3 rounds | `roundIntroSounds`, `answerPromptSound`, `jumpSound`, `successSound`, `errorSound` |

## New game checklist (`gameN`)

Follow in order when adding a game. Prompt: *“Add game20 — follow **design.md → New game checklist**.”*

1. **Folder** — `games/gameN/`: `index.html`, `game.js`, `game.css`, `strings.js` (copy nearest similar game).
2. **Scripts in `index.html`** — at minimum: `config.js`, `version-check.js`, `assets.js`, `volume-control.js`, `audio.js`, `strings.js`, `game.js`. Add `../../js/fx.js` if using `TiddeliFx`.
3. **Strings** — `labels.continue: 'Igen'`; `ambience.track` if BGM; spoken fields per [Spoken prompts](#spoken-prompts-mp3).
4. **Assets** — add media under `TiddeliGames-assets/games/gameN/`; document licences in `docs/asset-licenses.json`; run `npm run generate:assets-doc`.
5. **Hub** — append entry in `js/strings.js` → `APP_STRINGS.games.items` (id, name, description, icon, path).
6. **Version** — bump `version` in `js/config.js` (and `assetVersion` if media shipped).
7. **Service worker** — usually **nothing**: `sw.js` `APP_SHELL` caches only root shell JS/CSS, **not** per-game pages. Only edit `sw.js` if you add a new global script that must be precached.
8. **Tests** — add `{ id: 'gameN', path: '/games/gameN/index.html' }` to `tests/regression/all-games-navigation.spec.js`; add `tests/regression/gameN.spec.js` when mechanics need coverage.
9. **Portrait** — layout for portrait phone; test with narrow viewport; avoid requiring landscape ([Orientation](#orientation-portrait-first)).
10. **Completion** — use `playSharedCompletionSound()` from `js/audio.js` unless the game has a deliberate local complete clip.

## Shared animation helpers (`js/fx.js`)

Optional global effects so new games do not copy keyframes from game11/14/17/18.

- **CSS** — classes `tiddeli-fx-wiggle`, `tiddeli-fx-bounce`, `tiddeli-fx-shake` in `css/animations.css`.
- **JS** — `window.TiddeliFx`: `wiggleElement(el)`, `bounceElement(el)`, `shakeElement(el)`; `createConfettiBurst(ctx,x,y,opts)` + `tickConfetti(state)` for canvas games.
- **Include** — `<script src="../../js/fx.js" defer></script>` after `animations.css` on the game page. Existing games are **not** required to migrate until touched.

## Orientation (portrait-first)

- **Product intent:** Play in **portrait** on phones and tablets. `manifest.json` sets `"orientation": "portrait"`.
- **`js/assets.js`:** portrait lock where supported; on touch devices held in landscape, a **“Vänd telefonen”** overlay blocks play until rotated (`portrait-lock-overlay` in compiled Tailwind/CSS).
- **Layout:** Design and test at mobile portrait widths first; desktop may letterbox. Minor `@media (orientation: landscape)` tweaks for very short viewports are OK but **must not** be the primary mode.
- **Do not** document or build games that require landscape-only play.

# Design goals
This app (TiddeliGames) should be a PWA app that appears like a native app as far as possible. It should follow common design patterns in particular with respect to UI.

Target are reasonable modern android phones and pads. It should run with various screen sizes. It should also run in a desktop browser.

Games are **portrait-first** (see [Orientation (portrait-first)](#orientation-portrait-first)); responsive across phone sizes, usable on desktop, but not landscape-dependent.

# Tech stack

## Frontend:
- **HTML5/CSS3/JavaScript (Vanilla)**
  - No build step required, works with Live Server
  - Portable across all modern browsers
  - Core foundation for the PWA

- **Tailwind CSS (via CLI)**
  - Utility-first CSS framework for rapid UI development
  - Responsive design utilities
  - Installed via npm, built via CLI for optimized CSS
  - MIT license (commercial-safe)

- **HTML5 Audio API** - *Implemented*
  - Sound effects for game interactions (clicks, pops, success/error sounds)
  - Background ambient sounds per game (each game defines its own ambience track)
  - Shared completion sounds (71 variants: `complete_1` … `complete_71`) via `js/audio.js`
  - Global volume control accessible from main page (slider and mute button)
  - Volume persistence via localStorage across sessions
  - Volume events broadcast to all games via custom `volumechange` event

- **Tone.js (via CDN)** - *Optional for future use*
  - Audio library for background music, synthesized sounds, loops, and effects
  - CDN version: `https://cdn.jsdelivr.net/npm/tone@next/build/Tone.js`
  - MIT license (commercial-safe)
  - Currently: core audio (ambient tracks and shared completion sounds) is implemented with the HTML5 Audio API
  - Future: Hybrid approach with HTML5 Audio for simple sounds, Tone.js for more complex synthesized audio if needed

## Media & Assets:
- **Images**: WebP format (with PNG/JPG fallbacks for compatibility)
- **Animations**: CSS animations/transitions for simple effects
- **Canvas API**: For complex game animations if needed

## PWA Features:
- **Service Worker (sw.js)**: Offline support and asset caching
- **Web App Manifest (manifest.json)**: Installability and app-like experience
- **Cache API**: Asset caching for offline functionality
- **Dual Mode Operation**: App works both in browser and as installed PWA app
- **Installation Choice**: User can choose to install the app via "Install App" button in the initial menu
- **Before Install Prompt API**: Detect and handle PWA installability, show install button when available

## Additional Web APIs:
- **CSS Grid/Flexbox**: Responsive layouts
- **LocalStorage**: Game state and settings persistence
- **Intersection Observer API**: Performance optimization (for future use)
- **Screen Orientation API**: Detect and handle device orientation changes
- **CSS Media Queries**: Orientation-based responsive layouts (`@media (orientation: portrait/landscape)`)
- **Before Install Prompt API**: Detect PWA installability and trigger custom install UI (handled in `pwa.js`)

## Backend:
None - This is a client-side only PWA application.

# Architecture

## Overview
The application follows a simple, modular architecture:
- Single Page Application (SPA) structure with game selection page as entry point
- Each game is a self-contained module with its own HTML/CSS/JS
- Shared utilities and assets are centralized
- Service Worker handles caching and offline functionality

## Directory Structure

```
TiddeliGames/
├── index.html              # Main game selection page
├── manifest.json           # PWA manifest for installability
├── sw.js                    # Service Worker for offline support
├── css/
│   ├── styles.css          # Main stylesheet
│   └── animations.css      # Animation utilities
├── js/
│   ├── config.js           # App configuration and version (single source of truth)
│   ├── app.js              # Main app logic
│   ├── game-selector.js    # Game selection page logic
│   ├── pwa.js              # Service Worker registration and install prompt handling
│   ├── volume-control.js   # Global volume control for all games (slider, mute, localStorage)
│   ├── strings.js          # Localization strings for main page
│   ├── audio.js            # Shared completion sounds, game intro helper (HTML5 Audio)
│   └── assets.js           # TiddeliAssets URL resolver (local vs Netlify)
├── games/
│   ├── game1/              # Numbers (Siffror) - Click numbered circles
│   │   ├── index.html      # Game-specific HTML
│   │   ├── game.js         # Game logic
│   │   ├── game.css        # Game-specific styles
│   │   └── strings.js      # Game localization strings (media paths point at external assets)
│   ├── game2/              # Animal Sounds (Ljud) - Click animal cards to hear sounds
│   │   ├── index.html
│   │   ├── game.js
│   │   ├── game.css
│   │   ├── strings.js
│   │   └── ... (similar structure)
│   ├── game3/              # Count Fruits (Räkna frukter) - Count emoji fruits and select number
│   ├── game4/              # Match Words (Ord) - Match images to words
│   ├── game5/              # Addition (Addera) - Count two groups of emojis and add them
│   ├── game6/              # Spell Words (Stava ord) - Spell words by clicking letters in order
│   └── game7/ … game19/    # One folder per hub entry (see js/strings.js)
├── assets/
│   └── icons/              # PWA icons (small; stays in app repo)
├── docs/                   # assets.md (generated), asset-licenses.json (manual)
├── promptgenerator/        # Local tool: Gemini TTS → MP3 (not shipped to kids in production)
├── js/fx.js                # Optional shared wiggle/bounce/shake/confetti helpers
└── tests/                  # Playwright regression + PWA tests

// Game media (images/sounds) lives in TiddeliGames-assets, not inside games/*/ in this repo.
```

## Module Organization
- Each game is self-contained in its own directory
- Shared functionality (PWA, navigation, version management, orientation handling) in root `js/` directory
- Common styles in root `css/` directory
- Games can override shared styles as needed
- Each game targets **portrait** phones/tablets; use responsive CSS within portrait aspect ratios

## Shared Assets Organization

### Location: external `TiddeliGames-assets` repository

All media assets (images, sounds, videos) live in a separate repository, typically deployed to a static host (e.g. Netlify). The app never bundles large media files in this repo; instead it resolves them at runtime via a shared helper.

The external assets repo mirrors the game structure:

- Per‑game assets: `games/{gameId}/images/...`, `games/{gameId}/sounds/...`, `games/{gameId}/video/...`
- Shared assets: `assets/shared/images/...`, `assets/shared/sounds/...`, etc.

### Asset resolution (`window.TiddeliAssets`)

In the browser, `js/assets.js` exposes a small helper:

- `TiddeliAssets.getBaseUrl()` – returns the effective base URL for assets.
- `TiddeliAssets.resolveGameAsset(gameId, relativePath)` – returns a full URL for a per‑game asset.
- `TiddeliAssets.resolveSharedAsset(relativePath)` – returns a full URL for a shared asset.

Base URL rules:

- **Local development:** When running on `localhost` / `127.0.0.1`, the base URL is `/TiddeliGames-assets`. You serve the external assets folder at that mount point.
- **Production:** For all other hosts, the base URL is `APP_CONFIG.assetBaseUrl` from `js/config.js` (e.g. `https://tiddeligames-assets.netlify.app`).

### Referencing assets from games

Games never hard‑code `../../assets/...` paths any more. Instead they resolve URLs at runtime:

**Per‑game asset example (JS):**
```javascript
const imageUrl = TiddeliAssets.resolveGameAsset('game2', 'images/hund.png');
const soundUrl = TiddeliAssets.resolveGameAsset('game2', 'sounds/hund.mp3');
```

**Shared asset example (JS):**
```javascript
const completionUrl = TiddeliAssets.resolveSharedAsset('shared/sounds/complete_1.mp3');
```

For CSS backgrounds, games set the `background-image` inline from JavaScript using the resolved URL, instead of hard‑coding `url('images/...')` in the CSS file. This keeps all path logic in one place and makes switching asset hosts trivial.

### When to add to the assets repo

**Use the external assets repo for:**
- All game media (images, sounds, videos), whether shared or game‑specific.
- Any large static files that would bloat the main app repo.

**Keep in the main app repo:**
- HTML, JS, and CSS for the games and shell.
- PWA icons and small app‑shell assets under `assets/icons/`.

### Service Worker Caching

The Service Worker (`sw.js`) is responsible for caching the shell and may also cache some external assets depending on strategy. When adding new asset types or changing the base URL, review the caching rules in `sw.js` to ensure correct offline behavior.

## JavaScript Module Responsibilities
- **config.js**: App configuration and version (single source of truth)
- **app.js**: Main app logic, cache-busting, remote version checking, update banner management
- **assets.js**: Resolves game and shared asset URLs via `window.TiddeliAssets` for both local and production environments
- **game-selector.js**: Game selection page logic, game grid rendering, version display, help dialog
- **pwa.js**: Service Worker registration, install prompt handling, PWA lifecycle management
- **volume-control.js**: Global volume control system for all games (slider, mute button, localStorage persistence)
- **strings.js**: Localization strings for main page (games, help text, update messages, etc.)
- **audio.js**: Shared completion sound helper (`complete_1`–`71`), one-shot game intro (`playGameIntroOnce`), `playGameIntroFromStrings`, and related audio utilities (HTML5 Audio API)

## Spoken prompts (MP3)

Use this checklist whenever adding or replacing voice clips (including files from `promptgenerator/` or Downloads).

### MP3 technical format (required)

All spoken clips in the assets repo must use the **same** encoding so Web Audio decode and volume levels stay consistent:

| Property | Value |
|----------|--------|
| Container | `.mp3` (MPEG-1 Audio Layer III) |
| Sample rate | **24 000 Hz** |
| Channels | **1 (mono)** |
| Bitrate | **128–192 kbps** CBR (promptgenerator default **192 kbps** via lamejs) |

**Do not** commit stereo, 44.1/48 kHz, or WAV prompts as game assets. If a clip comes from another tool, re-export through **`promptgenerator/index.html`** (Gemini TTS → PCM → MP3) or normalize with:

```bash
ffmpeg -i input.mp3 -ar 24000 -ac 1 -b:a 160k -codec:a libmp3lame output.mp3
```

(Gemini TTS returns 24 kHz mono PCM; the generator passes that straight into lamejs — do not resample in the browser.)

### File naming and placement

- **Path:** `TiddeliGames-assets/games/{gameId}/sounds/` only (not in the main app repo).
- **Filename:** lowercase **snake_case**, Swedish words abbreviated naturally, e.g. `klicka_pa_bildens.mp3`, `rakna_frukterna.mp3`, `drag_ordet_till.mp3`. No spaces, no `PascalCase`.
- **strings.js value:** always `'sounds/{filename}.mp3'` (relative to that game’s assets folder).
- **After adding/changing media:** bump `assetVersion` in `js/config.js` and deploy the assets host.

### Which `strings.js` field to use

| Purpose | Field | When it plays | Games |
|--------|--------|----------------|-------|
| **Game open / how to play (once per visit)** | `gameIntroSound` | Once after ambience starts (`playGameIntroOnce`) | 1, 3, 10, 12 |
| **Lead-in before each task** | `promptSound` | Before target word/clue each round | 14, 16, 17 |
| **Lead-in + per-item phrase** | `promptIntroSound` + `promptSoundFor()` | Intro clip, then colour+object MP3 | 18 |
| **Per-round + answer question** | `roundIntroSounds`, `answerPromptSound` | Each round / after jumps | 19 |

Do **not** duplicate spoken copy in the on-screen instructions header; prompts are audio-only (empty instruction line for layout is OK).

### Wiring in game code

- **One-shot intro:** after background ambience is running, call  
  `playGameIntroFromStrings('gameN', STRINGS, audioContext, resolveGameNAsset)`  
  (from `js/audio.js`; already loaded on game pages).
- **Repeating prompt:** load via `resolveGameAsset`, play with existing game buffer helpers; keep TTS fallback only where the game already supports it.
- **Prefetch:** add new prompt paths to the game’s prefetch list (games 14+); decode buffers before play where the game uses Web Audio.

### Listen-button games

Games **14, 16, 17, 18** expose a listen control for replaying the current prompt. Follow the [Speech/listen UX pattern](#speechlisten-ux-pattern-games-14-16-17-18-19) when changing behaviour.

### Creating clips

- Use `promptgenerator/index.html` — text field first, download name from first ~3 words (snake_case + `.mp3`). Output is always **24 kHz mono MP3** from Gemini PCM + lamejs.
- Style line in generator: `Read aloud, in swedish, in a warm and friendly tone:` (or game-specific style for colour emphasis in game 18 item lines).
- After download, copy into `TiddeliGames-assets/games/{gameId}/sounds/` — do not re-encode unless the file came from outside the generator.


## Versioning Strategy
- Semantic versioning (MAJOR.MINOR.PATCH), e.g. `1.4.34`
- **Single source of truth**: `js/config.js` — fields `version` and `assetVersion`
- `manifest.json` does NOT need a version field (not part of PWA manifest spec)
- Service worker cache name is `tiddeligames-shell-v${version}` where `version` comes from the `?v=` query on `sw.js` at registration time (`js/pwa.js`); edit `APP_CONFIG.version` in `config.js`, not a duplicate constant in `sw.js`
- Append `assetVersion` to game media URLs via `js/assets.js` (`?v=`) so CDN/browser picks up Netlify asset deploys

## Update Mechanism
- **Automatic version detection**: App fetches `js/config.js` (bypassing all caches) to check for new versions
- **Update triggers**: 
  - On app load (1 second delay to ensure config is loaded)
  - When app becomes visible (user returns to installed app)
  - On first user interaction (tap/click/keypress)
- **Update flow**:
  1. Remote version is fetched and compared with local version
  2. If remote version is greater, modal update banner appears at top of screen
  3. User must click "Update now" to proceed (no automatic updates)
  4. On confirmation: All service workers unregistered, all caches cleared, page reloads
  5. Fresh version loads with clean state
- **No downgrades**: System only updates to higher versions, never downgrades
- **Localhost protection**: Update checks disabled on localhost/127.0.0.1 to avoid development issues

# Development tools

## Primary Tools
- **Live Server**: For local development and hot-reload
- **Git**: Version control (managed by user)
- **Modern Browser DevTools**: Chrome/Firefox for debugging
- **Playwright**: Automated end-to-end testing framework
- **http-server**: Static file server for Playwright tests (automatically started)

## Build Process
- **Tailwind CSS**: Requires build step via CLI (`npm run watch-css` or `npm run build-css`)
- Generated CSS file: `css/tailwind.output.css`
- Other assets: Direct file references (no build needed)
- Live Server: Run Tailwind watch command in separate terminal while developing
- **Testing**: Playwright tests automatically start `http-server` - no manual server needed

## Testing Environment
- Chrome DevTools for mobile device emulation
- Physical Android devices for real-world testing
- Desktop browsers for cross-platform verification

# Build CSS

## Approach
- Tailwind CSS built via CLI from `css/styles.css` (contains Tailwind directives)
- Generated output: `css/tailwind.output.css` (minified, optimized)
- Custom CSS in `css/` directory for game-specific styles
- CSS animations defined in `animations.css`
- Build commands:
  - `npm run watch-css` - Watch mode for development
  - `npm run build-css` - One-time build for production

## Optimization
- Tailwind CLI automatically purges unused CSS classes
- Generated CSS is minified for production
- Only classes actually used in HTML/JS are included in final CSS

# Testing

## Testing Strategy
- **Automated Testing**: Playwright end-to-end tests for regression testing
- **Manual testing**: On target devices (Android phones/tablets, especially Pixel 7 and Motorola)
- **Cross-browser testing**: Chrome, Firefox, Safari
- **PWA functionality testing**: Installability, offline mode
- **Audio functionality testing**: User gesture requirement, playback
- **Mobile responsive testing**: Verify all games fit within viewport, no unwanted scrolling

## Automated Testing (Playwright)
- **Test framework**: Playwright for end-to-end browser testing
- **Test structure**: 
  - `tests/regression/` - Game functionality and navigation tests
  - `tests/pwa/` - PWA feature tests (service worker, manifest, offline)
- **Test server**: Automatically starts `http-server` on port 5500 for test execution
- **Test commands**: 
  - `npm test` - Run all tests
  - `npm run test:ui` - Run with Playwright UI
  - `npm run test:headed` - Run with visible browser
  - `npm run test:debug` - Debug mode
  - `npm run test:report` - Show test report
- **Test coverage**: Hub navigation, PWA features, volume control, help dialog; individual game tests may not list all 19 games — extend tests when adding mechanics

## Test Areas
- Game selection page functionality (19 games in hub)
- Individual game mechanics (all games fully functional)
- Audio playback (HTML5 Audio API - implemented)
- Responsive design across screen sizes (mobile-first, prevents unwanted scrolling)
- Service Worker caching and offline behavior
- PWA installation and launch
- Version update mechanism (remote version checking, modal banner, cache clearing)
- Install button visibility and functionality
- Volume control functionality (slider, mute, persistence)
- Help dialog display and interaction

# Security and Privacy

## Security Considerations
- No backend/server = no server-side security concerns
- All code runs client-side in browser sandbox
- No external API calls or data transmission
- LocalStorage used only for game state/settings (no sensitive data)
- No user data collection
- No analytics or tracking
- No external dependencies beyond CDN libraries (Tone.js, Tailwind)
- All assets served locally or via trusted CDNs

## Content Security
- Service Worker cache strategy prevents malicious content injection
- Assets validated before caching

# UI/UX Design

## Design Principles

### Mobile-First
- Primary target: Android mobile devices (tested on Pixel 7, Motorola)
- Touch-friendly interface with adequate tap targets (minimum 44x44px)
- Responsive design for tablets and desktop
- **Orientation:** Portrait-first PWA; landscape on phones shows turn-device overlay (`js/assets.js`), not a second layout mode
- Layouts adapt with CSS media queries for viewport size; avoid designing for landscape-only play
- **Overflow Prevention**: Games prevent unwanted vertical scrolling/bouncing on mobile devices using CSS `overflow-y: hidden` and `overscroll-behavior-y: none`
- **Content Fit**: All game content fits within viewport without scrolling (background images sized appropriately)

### Child-Friendly
- Large, colorful buttons
- Clear visual feedback
- Simple navigation
- Intuitive controls

### PWA Native Feel
- App-like appearance (no browser chrome when installed)
- Smooth transitions between screens
- Offline capability
- Fast loading with Service Worker caching

### Accessibility
- High contrast colors for visibility
- Clear visual hierarchy
- Audio feedback for interactions
- Simple, unambiguous UI elements

## Visual Design
- Modern, clean interface using Tailwind CSS utilities
- Consistent color scheme across games
- Smooth CSS animations for interactions
- Responsive grid layout for game selection (1 column mobile, 2 tablet, 3 desktop)
- "Install App" button discretely placed in top-right corner (when installation is available)
- Version number displayed discretely in footer
- Modal update banner at top of screen (blocks interaction until user updates)
- Volume control (slider and mute button) in top-left corner (main page only, no percentage display)
- Help dialog accessible via "?" button in top-right corner
- Mobile-first responsive design with overflow prevention (prevents unwanted scrolling on game pages)
- Background images with proper sizing to prevent stretching beyond viewport (games 4, 5, 6)
- Consistent back button styling across all games

## User Flow
1. App launches → Game selection page (works in browser or as installed app)
2. Version check runs automatically (on load, visibility change, or first interaction)
3. If new version available → Modal update banner appears (user must update to continue)
4. User can optionally click "Install App" button (top-right) to install as PWA (if not already installed)
5. User can adjust volume using slider and mute button (top-left corner)
6. User can view help information via "?" button (top-right corner)
7. User selects game → Game loads
8. Game starts after user interaction (unlocks audio)
9. User plays game → Returns to selection page when done

## Installation Flow
- App runs in browser by default
- "Install App" button appears discretely in top-right corner when PWA installation is available
- Button is hidden if app is already installed or installation is not supported
- Installation is optional - user can continue using app in browser if preferred
- Button uses standard download/install icon (SVG) for universal recognition

