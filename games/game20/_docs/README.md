# Mata fisken (game20, v2) — local prototype

A big hungry goldfish says “Jag är hungrig! Jag vill ha tre jordgubbar.”
The child drags food from the plate into the fish's mouth, or just taps
a food and it flies in. Each bite: “nom”, counted aloud (“ett, två, tre”),
a number bubble and little food icons under the fish.

## Install (laptop, nothing pushed)

The two top folders match your own folders:

- `TiddeliGames/games/game20/` → into your `TiddeliGames` repo
- `TiddeliGames-assets/games/game20/` → into your assets folder

**Delete the v1 files first** (list in `OBSOLETE_V1.md`), or replace the
whole `games/game20` folder in both places.

Serve the parent folder (Live Server) and open `.../games/game20/index.html`.
On the phone use the PC's LAN IP. Portrait only. The game is not in the hub
yet, so open the URL directly.

## Rules as built

- 3 rounds, one food per round (strawberries, carrots, bananas; shuffled).
- Target 1–6, weighted toward 1–3. 8 items on the plate, always more than asked for.
- The mouth opens when food is dragged close; drop near the mouth to feed.
  Dropped elsewhere, it slides back. A plain tap feeds too (easiest for a 2-year-old).
- One bite at a time; taps during a bite are ignored.
- After the right amount, there is a ~1.1 s pause. One more bite in that
  window starts a ~2.9 s cartoon overfeed (plate locked): the fish swells to
  ~1.7× into a “stuffed” frame (round cheeks, goggle eyes) with a jelly wobble
  and rising sound, trembles, lets out a big “BUURP” with a burst of bubbles,
  spins backwards, sees dizzy stars, then deflates back with a sigh.
  Then “Oj, nu fick jag för mycket! Vi försöker igen.”, the plate refills and the same
  request repeats (no penalty).
- Right amount: “Mmm, tack! Vad gott!”, a flip, bubbles, confetti, and a fish pip lights up.
- After 3 rounds: “Bra jobbat!” with Igen / Tillbaka and the shared completion sound.
- The speaker button replays “Jag vill ha …”. No on-screen instruction text.

Test helpers: `?targets=2,1,3&foods=jordgubbar,morotter,bananer`.

## Suggested hub entry (not applied)

```js
{
    id: 'game20',
    name: 'Mata fisken',
    description: 'Ge fisken rätt antal. (2+ år)',
    icon: '🐠',
    path: 'games/game20/index.html'
}
```
