# Fåglarna flyger hem (game21) — local prototype

Colour matching for about 2 years. A coloured bird flutters in over the meadow and the voice says
“Den blå fågeln vill flyga hem!”. Up in the tree sit coloured nests, each with two chicks of the
same colour peeking out. The child helps the bird home to the nest with the same colour.
No written instructions; the speaker button repeats the prompt.

## Install (laptop, nothing pushed)

The two top folders match your own folders:

- `TiddeliGames/games/game21/` → into your `TiddeliGames` repo
- `TiddeliGames-assets/games/game21/` → into your assets folder

Serve the parent folder (Live Server) and open `.../TiddeliGames/games/game21/index.html`.
Portrait only. The game is not in the hub yet, so open the URL directly.

## Rules as built

- 6 rounds, no levels. Rounds 1–3: 2 nests; rounds 4–6: 3 nests (`nestsPerRound` in `strings.js`).
- Colours: röd, blå, gul, grön. The bird colour never repeats twice in a row and every colour shows up.
  The other nest colours and the nest positions are random each round.
- Three ways to play (all work, toddler-proof):
  1. drag the bird onto a nest (drop margin is generous; the nest glows while the bird is over it),
  2. tap the bird (it hops and peeps), then tap a nest,
  3. just tap a nest.
- Right nest: the bird flies in and sits beside its chicks (the front rim hides its feet),
  the chicks hop, peep, notes ♪ and confetti, then “Blå! Bra!” and a 🐦 pip lights up.
- Wrong nest (≈1.7 s, gentle, no red X, no “fel”): the bird flies over and stops short; the nest
  shakes clearly, its chicks duck down and shake their heads, a soft white puff with a wobbling “?”
  pops up over the nest, the bird shakes its head and does a little spin with its own “?”, and a soft
  “boing” + hummed “uh-uh” (`nej_nej.mp3`) plays. Then the bird flies back, the RIGHT nest glows and
  pulses twice as a hint, and the prompt is repeated. No penalty.
- After 6 birds: “Alla fåglar är hemma!”, then the “Bra jobbat!” dialog with **Igen** / Tillbaka and the
  shared completion sound.
- Calm birdsong/wind ambience loop under everything (volume follows the shared volume control).

Test helpers: `?colors=blue,red,yellow,green,blue,red` (bird colour per round), `?rounds=3` (shorter game).
Debug hook: `window.__faglarna.getState()`.

## Suggested hub entry (not applied)

```js
{
    id: 'game21',
    name: 'Fåglarna flyger hem',
    description: 'Hjälp fåglarna hem till rätt färg. (2+ år)',
    icon: '🐦',
    path: 'games/game21/index.html'
}
```
