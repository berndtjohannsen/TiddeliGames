# Shared Assets Directory

This directory contains assets that are shared across multiple games in TiddeliGames.

## Directory Structure

```
assets/shared/
├── images/          # Shared images (common backgrounds, UI elements, icons)
├── sounds/          # Shared sounds (common sound effects, UI sounds)
└── fonts/           # Shared fonts (if custom fonts are needed)
```

## Usage

### Referencing Shared Assets from Games

When referencing shared assets from a game directory, use relative paths going up two levels to reach the root:

**From any game directory (e.g., `games/game1/`):**
- Images: `../../assets/shared/images/filename.png`
- Sounds: `../../assets/shared/sounds/filename.mp3`
- Fonts: `../../assets/shared/fonts/filename.woff2`

**Example in HTML:**
```html
<img src="../../assets/shared/images/common-background.png" alt="Background">
```

**Example in JavaScript:**
```javascript
const audioPath = '../../assets/shared/sounds/ui-click.mp3';
```

**Example in CSS:**
```css
@font-face {
    font-family: 'CustomFont';
    src: url('../../assets/shared/fonts/custom-font.woff2') format('woff2');
}
```

## What Should Go Here

### Good candidates for shared assets:
- Common UI elements (buttons, icons, backgrounds used in multiple games)
- Reusable sound effects (click sounds, completion sounds used across games)
- Shared fonts that multiple games use
- Common completion animations or images

### Keep game-specific:
- Game-specific images that only one game uses
- Game-specific sounds unique to one game
- Game-specific assets should remain in each game's own `images/` and `sounds/` directories

## File Organization Tips

- Use descriptive, lowercase filenames with hyphens (e.g., `ui-button-click.mp3`)
- Group related assets (e.g., all UI sounds together)
- Keep file sizes optimized for web (especially images and sounds)
- Consider using WebP format for images with PNG/JPG fallbacks

## Service Worker Caching

Shared assets in this directory are cached by the Service Worker (`sw.js`). When you add new shared assets, remember to:
1. Update the Service Worker cache strategy if needed
2. Test offline functionality to ensure assets are properly cached

