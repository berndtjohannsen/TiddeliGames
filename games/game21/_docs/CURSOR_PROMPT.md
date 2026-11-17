Add game21 “Fåglarna flyger hem” — follow **design.md → New game checklist** exactly. The game files already exist; do not rewrite the mechanics.

- App: `games/game21/index.html`, `game.js`, `game.css`, `strings.js` (docs in `games/game21/_docs/`; you may keep or move `_docs` out of the shipped folder).
- Media lives in `TiddeliGames-assets/games/game21/images/` and `/sounds/`. Do **not** commit media to this repo.

1. Licences: add every `games/game21/...` media path to `docs/asset-licenses.json` using `_docs/LICENSES.md` (self-generated images incl. hue-shifted colour variants; Gemini TTS voice Leda clips; self-synthesised SFX/ambience). Then run `npm run generate:assets-doc`.
2. Hub: append to `APP_STRINGS.games.items` in `js/strings.js` (after game20 if present):
   `{ id: 'game21', name: 'Fåglarna flyger hem', description: 'Hjälp fåglarna hem till rätt färg. (2+ år)', icon: '🐦', path: 'games/game21/index.html' }`
3. Version: bump `version` and `assetVersion` together in `js/config.js` (next patch after whatever is current). Do not touch `sw.js` or `manifest.json`.
4. Tests: add `{ id: 'game21', path: '/games/game21/index.html' }` to `tests/regression/all-games-navigation.spec.js`. Optional `tests/regression/game21.spec.js`: load in portrait with `?colors=red,blue&rounds=2`; after the first tap the bird and 2 `.game21-nest` buttons are visible and the listen button exists; tapping the `.game21-nest[data-color=<window.__faglarna.getState().bird>]` once `phase === 'waiting'` increases `roundsWon`; tapping a wrong nest increases `wrongTries` and keeps `roundsWon`; two right taps reach the “Bra jobbat!” dialog with `Igen`.
5. Update the design.md game catalog + per-game table (game21: colour matching röd/blå/gul/grön, 2+, 6 rounds with 2 then 3 nests; fields `colors[].prompt`, `colors[].praise`, `allHomeSound`, `flutterSound`, `peepSound`, `boingSound`, `nopeSound`, `successSound`, `images.birdUp/birdDown/nest/chicks` with `{c}` colour placeholder, `nestsPerRound`).
6. Don't change other games, don't commit, push or deploy — I do that myself.
