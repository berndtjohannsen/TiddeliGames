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

- **Tone.js (via CDN)**
  - Audio library for background music, synthesized sounds, loops, and effects
  - CDN version: `https://cdn.jsdelivr.net/npm/tone@next/build/Tone.js`
  - MIT license (commercial-safe)

- **HTML5 Audio API**
  - Simple sound effects (clicks, pops, short clips)
  - Hybrid approach: Tone.js for complex audio, HTML5 for simple playback

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
- **Intersection Observer API**: Performance optimization
- **Screen Orientation API**: Detect and handle device orientation changes
- **CSS Media Queries**: Orientation-based responsive layouts (`@media (orientation: portrait/landscape)`)
- **Before Install Prompt API**: Detect PWA installability and trigger custom install UI

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
│   └── audio.js            # Audio management (Tone.js setup)
├── games/
│   ├── game1/
│   │   ├── index.html      # Game-specific HTML
│   │   ├── game.js         # Game logic
│   │   ├── game.css        # Game-specific styles
│   │   ├── images/         # Game images
│   │   └── sounds/         # Game sounds
│   └── game2/
│       └── ... (similar structure)
└── assets/
    ├── icons/              # PWA icons (various sizes)
    └── shared/             # Shared assets across games
```

## Module Organization
- Each game is self-contained in its own directory
- Shared functionality (audio, PWA, navigation, orientation handling) in root `js/` directory
- Common styles in root `css/` directory
- Games can override shared styles as needed
- Each game can specify preferred orientation in its configuration, but must implement responsive layouts for both orientations

# Version management and updates

## Versioning Strategy
- Semantic versioning (MAJOR.MINOR.PATCH)
- **Single source of truth**: Version stored in `js/config.js` only
- `sw.js` (Service Worker) reads version from `js/config.js` at runtime
- `manifest.json` does NOT need a version field (not part of PWA manifest spec)
- Service Worker handles cache invalidation on version updates
- When updating version: Change only `js/config.js`

## Update Mechanism
- Service Worker checks for updates on app launch
- New version detection triggers cache refresh
- User is notified of available updates (optional)
- Stale-while-revalidate strategy for smooth updates

# Development tools

## Primary Tools
- **Live Server**: For local development and hot-reload
- **Git**: Version control (managed by user)
- **Modern Browser DevTools**: Chrome/Firefox for debugging

## Build Process
- **Tailwind CSS**: Requires build step via CLI (`npm run watch-css` or `npm run build-css`)
- Generated CSS file: `css/tailwind.output.css`
- Other assets: Direct file references (no build needed)
- Live Server: Run Tailwind watch command in separate terminal while developing

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
- Manual testing on target devices (Android phones/tablets)
- Cross-browser testing (Chrome, Firefox, Safari)
- PWA functionality testing (installability, offline mode)
- Audio functionality testing (user gesture requirement, playback)

## Test Areas
- Game selection page functionality
- Individual game mechanics
- Audio playback (Tone.js and HTML5 audio)
- Responsive design across screen sizes
- Service Worker caching and offline behavior
- PWA installation and launch

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
- Primary target: Android mobile devices
- Touch-friendly interface with adequate tap targets (minimum 44x44px)
- Responsive design for tablets and desktop
- **Orientation Support**: Games can have a preferred orientation (portrait or landscape), but all games must be fully functional and responsive in both orientations
- Layouts adapt dynamically using CSS media queries and JavaScript orientation detection

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
- Responsive grid layout for game selection
- "Install App" button prominently displayed in the game selection menu (when installation is available)

## User Flow
1. App launches → Game selection page (works in browser or as installed app)
2. User can optionally click "Install App" button to install as PWA (if not already installed)
3. User selects game → Game loads
4. Game starts after user interaction (unlocks audio)
5. User plays game → Returns to selection page when done

## Installation Flow
- App runs in browser by default
- "Install App" button appears in the initial menu when PWA installation is available
- Button is hidden if app is already installed or installation is not supported
- Installation is optional - user can continue using app in browser if preferred

