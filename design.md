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
  - Background ambient sounds for games (Game 2: animal sounds, Game 6: background ambience)
  - Global volume control accessible from main page (slider and mute button)
  - Volume persistence via localStorage across sessions
  - Volume events broadcast to all games via custom `volumechange` event

- **Tone.js (via CDN)** - *Planned for future implementation*
  - Audio library for background music, synthesized sounds, loops, and effects
  - CDN version: `https://cdn.jsdelivr.net/npm/tone@next/build/Tone.js`
  - MIT license (commercial-safe)
  - Currently: `js/audio.js` is a placeholder file
  - Future: Hybrid approach with HTML5 Audio for simple sounds, Tone.js for complex audio

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

### Location: `assets/shared/`

Shared resources that are used across multiple games are stored in `assets/shared/` with organized subdirectories:
- **`images/`**: Shared images (common backgrounds, UI elements, icons used by multiple games)
- **`sounds/`**: Shared sounds (common sound effects, UI sounds used across games)
- **`fonts/`**: Shared fonts (custom fonts if needed by multiple games)

### Referencing Shared Assets

From any game directory (e.g., `games/game1/`), reference shared assets using relative paths:

**Path pattern:** `../../assets/shared/{type}/{filename}`

**Examples:**
- Image: `../../assets/shared/images/common-background.png`
- Sound: `../../assets/shared/sounds/ui-click.mp3`
- Font: `../../assets/shared/fonts/custom-font.woff2`

**HTML example:**
```html
<img src="../../assets/shared/images/shared-icon.png" alt="Icon">
```

**JavaScript example:**
```javascript
const audioPath = '../../assets/shared/sounds/completion.mp3';
```

**CSS example:**
```css
@font-face {
    font-family: 'CustomFont';
    src: url('../../assets/shared/fonts/custom-font.woff2') format('woff2');
}
```

### When to Use Shared Assets

**Use `assets/shared/` for:**
- Assets used by 2+ games (common backgrounds, UI elements, sounds)
- Reusable components that should be consistent across games
- Shared fonts used by multiple games

**Keep in game directories for:**
- Game-specific assets unique to a single game
- Assets that are part of a game's core identity or gameplay

### Service Worker Caching

Shared assets are cached by the Service Worker. When adding new shared assets, ensure they are included in the cache strategy defined in `sw.js`.

For detailed usage instructions, see `assets/shared/README.md`.

## JavaScript Module Responsibilities
- **config.js**: App configuration and version (single source of truth)
- **app.js**: Main app logic, cache-busting, remote version checking, update banner management
- **game-selector.js**: Game selection page logic, game grid rendering, version display, help dialog
- **pwa.js**: Service Worker registration, install prompt handling, PWA lifecycle management
- **volume-control.js**: Global volume control system for all games (slider, mute button, localStorage persistence)
- **strings.js**: Localization strings for main page (games, help text, update messages, etc.)
- **audio.js**: Placeholder for future Tone.js audio management

# Version management and updates

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
- **Test coverage**: All 6 games, navigation, PWA features, volume control, help dialog

## Test Areas
- Game selection page functionality (all 6 games implemented)
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

