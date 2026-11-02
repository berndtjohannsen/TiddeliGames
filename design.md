# Description
This file describes the implementation, architectural details and tech stack. Much intended to be created and used by AI.

# Design goals
This app (TiddeliGames) should be a PWA app that appears like a native app as far as possible. It should follow common design patterns in particular with respect to UI.

Target are reasonable modern android phones and pads. It should run with various screen sizes. It should also run in a desktop browser.

Games may have a preferred orientation (portrait or landscape), but all games must be responsive and functional in both orientations.

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
  - Shared completion sounds (36 variants) played via a common helper in `js/audio.js`
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
│   └── audio.js            # Audio management (Tone.js setup) - placeholder
├── games/
│   ├── game1/              # Numbers (Siffror) - Click numbered circles
│   │   ├── index.html      # Game-specific HTML
│   │   ├── game.js         # Game logic
│   │   ├── game.css        # Game-specific styles
│   │   ├── strings.js      # Game localization strings
│   │   ├── images/         # Game images
│   │   └── sounds/         # Game sounds
│   ├── game2/              # Animal Sounds (Ljud) - Click animal cards to hear sounds
│   │   ├── index.html
│   │   ├── game.js
│   │   ├── game.css
│   │   ├── strings.js
│   │   └── ... (similar structure)
│   ├── game3/              # Count Fruits (Räkna frukter) - Count emoji fruits and select number
│   ├── game4/              # Match Words (Ord) - Match images to words
│   ├── game5/              # Addition (Addera) - Count two groups of emojis and add them
│   └── game6/              # Spell Words (Stava ord) - Spell words by clicking letters in order
└── assets/
    ├── icons/              # PWA icons (various sizes)
    └── shared/             # Shared assets across games
        ├── images/         # Shared images (common backgrounds, UI elements)
        ├── sounds/         # Shared sounds (common sound effects, UI sounds)
        └── fonts/          # Shared fonts (if custom fonts are needed)
```

## Module Organization
- Each game is self-contained in its own directory
- Shared functionality (PWA, navigation, version management, orientation handling) in root `js/` directory
- Common styles in root `css/` directory
- Games can override shared styles as needed
- Each game can specify preferred orientation in its configuration, but must implement responsive layouts for both orientations

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
- **audio.js**: Shared completion sound helper, one-shot game intro (`playGameIntroOnce`), and related audio utilities (HTML5 Audio API)

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
- **Prefetch:** add new prompt paths to the game’s existing prefetch list if it has one.

### Creating clips

- Use `promptgenerator/index.html` — text field first, download name from first ~3 words (snake_case + `.mp3`). Output is always **24 kHz mono MP3** from Gemini PCM + lamejs.
- Style line in generator: `Read aloud, in swedish, in a warm and friendly tone:` (or game-specific style for colour emphasis in game 18 item lines).
- After download, copy into `TiddeliGames-assets/games/{gameId}/sounds/` — do not re-encode unless the file came from outside the generator.


## Versioning Strategy
- Semantic versioning (MAJOR.MINOR.PATCH)
- **Single source of truth**: Version stored in `js/config.js` only
- `sw.js` cache name includes version (e.g., `tiddeligames-shell-v1.0.0`) - must be manually updated when releasing
- `manifest.json` does NOT need a version field (not part of PWA manifest spec)
- When updating version: Change only `js/config.js`, then update `CACHE_NAME` in `sw.js` to match

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
- **Test coverage**: All 11 games, navigation, PWA features, volume control, help dialog

## Test Areas
- Game selection page functionality (all 11 games implemented)
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
- **Orientation Support**: Games can have a preferred orientation (portrait or landscape), but all games must be fully functional and responsive in both orientations
- Layouts adapt dynamically using CSS media queries and JavaScript orientation detection
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

