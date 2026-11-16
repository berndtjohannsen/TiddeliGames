Add game20 “Mata fisken” — follow **design.md → New game checklist** exactly. The game files already exist; do not rewrite the mechanics.

- App: `games/game20/index.html`, `game.js`, `game.css`, `strings.js` (docs in `games/game20/_docs/`; you may keep or move `_docs` out of the shipped folder).
- Media lives in `TiddeliGames-assets/games/game20/images/` and `/sounds/`. Do **not** commit media to this repo.

1. Licences: add every `games/game20/...` media path to `docs/asset-licenses.json` using `_docs/LICENSES.md` (self-generated images; Gemini TTS voice Leda clips; self-synthesised SFX/ambience). Then run `npm run generate:assets-doc`.
2. Hub: append to `APP_STRINGS.games.items` in `js/strings.js`:
   `{ id: 'game20', name: 'Mata fisken', description: 'Ge fisken rätt antal. (2+ år)', icon: '🐠', path: 'games/game20/index.html' }`
3. Version: bump `version` and `assetVersion` together in `js/config.js` (e.g. 1.4.34 → 1.4.35, or next after whatever is current). Do not touch `sw.js` or `manifest.json`.
4. Tests: add `{ id: 'game20', path: '/games/game20/index.html' }` to `tests/regression/all-games-navigation.spec.js`. Optional `tests/regression/game20.spec.js`: load in portrait, fish and 8 plate items visible, listen button present, tapping items after the prompt increases `window.__mataFiskarna.getState().eatenCount`; use `?targets=1,1,1` to reach the “Bra jobbat!” dialog with `Igen`.
5. Update the design.md per-game table (game20: counting by feeding, 2+, 3 rounds; fields `hungrySound`, `foods[].promptSounds`, `countSounds`, `thanksSound`, `fullSound`, overfeed `inflateSound`/`burpSound`/`dizzySound`/`deflateSound`, `images.fishStuffed`).
6. Don't change games 1–19, don't commit, push or deploy — I do that myself.
