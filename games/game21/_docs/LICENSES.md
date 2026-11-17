# Licences — Fåglarna flyger hem (game21)

All media was made for TiddeliGames; nothing is copied from third-party stock.
Free to use and redistribute with the app. Not legal advice.

## Images (self-generated, Grok Bot image tool, watercolour style, cut out + compressed)

The red bird, red nest and red chicks were generated; the blue, yellow and green versions are
programmatic hue shifts of the same pictures (so all colours share one shape).

| File | Description |
|------|-------------|
| `images/background.webp`, `background.jpg` | Portrait meadow with a big friendly tree (no birds, no nests) |
| `images/bird_{red,blue,yellow,green}_up_1x.webp`, `_2x.webp`, `_1x.png` | Round little bird, wings up (flap frame 1) |
| `images/bird_{red,blue,yellow,green}_down_1x.webp`, `_2x.webp`, `_1x.png` | Same bird, wings down (flap frame 2, also used when sitting in the nest) |
| `images/nest_{red,blue,yellow,green}_1x.webp`, `_2x.webp`, `_1x.png` | Woven nest in the colour (also used, CSS-clipped, as the front rim) |
| `images/chicks_{red,blue,yellow,green}_1x.webp`, `_2x.webp`, `_1x.png` | Two fluffy chicks peeping |

Music notes, glow and confetti are CSS/canvas only.

## Voice clips (self-generated, Gemini TTS `gemini-2.5-flash-preview-tts`, voice Leda)

Style prompt `Read aloud, in swedish, in a warm and friendly tone:`; 24 kHz mono MP3, CBR 160 kbps,
silence trimmed (ffmpeg silenceremove), about −17 LUFS. Each take verified by transcription (gemini-2.5-flash).

| File | Text |
|------|------|
| `sounds/den_roda_fageln_vill_flyga_hem.mp3` | Den röda fågeln vill flyga hem! |
| `sounds/den_bla_fageln_vill_flyga_hem.mp3` | Den blå fågeln vill flyga hem! |
| `sounds/den_gula_fageln_vill_flyga_hem.mp3` | Den gula fågeln vill flyga hem! |
| `sounds/den_grona_fageln_vill_flyga_hem.mp3` | Den gröna fågeln vill flyga hem! |
| `sounds/rod_bra.mp3` | Röd! Bra! |
| `sounds/bla_bra.mp3` | Blå! Bra! |
| `sounds/gul_bra.mp3` | Gul! Bra! |
| `sounds/gron_bra.mp3` | Grön! Bra! |
| `sounds/alla_faglar_ar_hemma.mp3` | Alla fåglar är hemma! |

## Sound effects (self-synthesised with Python/NumPy + ffmpeg, no samples)

`sounds/flutter.mp3` (wing flaps), `peep.mp3` (chick peeps), `boing.mp3` (soft wrong-nest bump),
`nej_nej.mp3` (soft two-note hummed "uh-uh" for a wrong nest),
`success.mp3` (sparkly arpeggio), `ambience.mp3` (12 s loop: soft wind + synthesised distant birdsong).

## Shared completion fanfares

`playSharedCompletionSound()` uses the existing `assets/shared/sounds/complete_*.mp3` on the assets host. Not included here.
