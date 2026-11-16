# Licences — Mata fisken (game20, v2)

All media was made for TiddeliGames; nothing is copied from third-party stock.
Free to use and redistribute with the app. Not legal advice.

## Images (self-generated, Grok Bot image tool, watercolour style, cut out + compressed)

| File | Description |
|------|-------------|
| `images/background.webp`, `background.jpg` | Portrait aquarium scene (no fish) |
| `images/fish_closed_1x.webp`, `_2x.webp`, `_1x.png` | Hungry goldfish, mouth closed (smiling) |
| `images/fish_open_1x.webp`, `_2x.webp`, `_1x.png` | Same fish, mouth wide open (same canvas/baseline) |
| `images/fish_stuffed_1x.webp`, `_2x.webp`, `_1x.png` | Same fish, overstuffed: round cheeks, goggle eyes (overfeed frame, same canvas) |
| `images/strawberry_*` | Strawberry (jordgubbe) |
| `images/carrot_*` | Carrot (morot) |
| `images/banana_*` | Banana (banan) |

Bubbles, plate, badge and the dizzy stars (inline SVG) are CSS/markup only.

## Voice clips (self-generated, Gemini TTS, voice Leda)

Style prompt `Read aloud, in swedish, in a warm and friendly tone:`; 24 kHz mono MP3, CBR 160 kbps, silence trimmed, about −17 LUFS.

| File | Text |
|------|------|
| `sounds/jag_ar_hungrig.mp3` | Jag är hungrig! |
| `sounds/vill_ha_jordgubbar_1..6.mp3` | Jag vill ha en jordgubbe. / två … sex jordgubbar. |
| `sounds/vill_ha_morotter_1..6.mp3` | Jag vill ha en morot. / två … sex morötter. |
| `sounds/vill_ha_bananer_1..6.mp3` | Jag vill ha en banan. / två … sex bananer. |
| `sounds/count_1..6.mp3` | Ett, Två, Tre, Fyra, Fem, Sex |
| `sounds/mmm_tack.mp3` | Mmm, tack! Vad gott! |
| `sounds/nu_fick_jag_for_mycket.mp3` | Oj, nu fick jag för mycket! Vi försöker igen. |

## Sound effects (self-synthesised with Python/NumPy + ffmpeg, no samples)

`sounds/nom.mp3` (bite), `bubbles.mp3`, `success.mp3` (arpeggio), `ambience.mp3` (10 s underwater loop).

Overfeed sequence (self-synthesised 2026-11-16, script `sfx_overfeed.py`; 24 kHz mono 160 kbps):
`sounds/inflate.mp3` (rising rubbery swell), `burp.mp3` (big cartoon "BUURP" with bubbly blips — replaces the v1/v2 small burp),
`dizzy.mp3` (cartoon bird chirps), `deflate.mp3` (falling "pfffiuu" sigh).

## Shared completion fanfares

`playSharedCompletionSound()` uses the existing `assets/shared/sounds/complete_*.mp3` on the assets host. Not included here.
