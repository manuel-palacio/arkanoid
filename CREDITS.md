# Credits

## Audio

The `.ogg` files in `public/audio/` are local **placeholders** generated with
ffmpeg sine bursts so the game has audible feedback during development. They
sound deliberately tinny — the intent is to swap them out with proper
free-licensed arcade SFX before shipping.

### Recommended replacements (all CC0)

| Filename | Source pack | Author |
|----------|-------------|--------|
| `paddle-hit.ogg` | [Kenney — Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (`impactPlate_000.ogg`) | Kenney (CC0) |
| `wall-hit.ogg` | [Kenney — Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (`impactPlate_002.ogg`) | Kenney (CC0) |
| `brick-hit.ogg` | [Kenney — Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (`impactMining_000.ogg`) | Kenney (CC0) |
| `brick-break.ogg` | [Kenney — Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (`explosionCrunch_000.ogg`) | Kenney (CC0) |
| `laser.ogg` | [Kenney — Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (`laserSmall_001.ogg`) | Kenney (CC0) |
| `powerup-get.ogg` | [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) (`confirmation_001.ogg`) | Kenney (CC0) |
| `life-lost.ogg` | [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) (`error_001.ogg`) | Kenney (CC0) |
| `ui-move.ogg` | [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) (`click_002.ogg`) | Kenney (CC0) |
| `ui-click.ogg` | [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) (`click_001.ogg`) | Kenney (CC0) |
| `level-complete.ogg` | [Kenney — Music Jingles](https://kenney.nl/assets/music-jingles) (`positive_jingle.ogg`) | Kenney (CC0) |
| `game-over.ogg` | [Kenney — Music Jingles](https://kenney.nl/assets/music-jingles) (`negative_jingle.ogg`) | Kenney (CC0) |
| `music-menu.ogg` | **silent placeholder** (4 s `anullsrc`) — drop in a CC0 candy/arcade loop | TBD |
| `music-game.ogg` | **silent placeholder** (4 s `anullsrc`) — drop in a CC0 candy/arcade loop | TBD |

### Where to grab real music tracks (CC0)

The fade/crossfade infrastructure is wired up — replace `public/audio/music-menu.ogg`
and `public/audio/music-game.ogg` with real tracks (filenames must stay the same)
and the game will pick them up. Recommended sources:

- **OpenGameArt.org** — search [music tagged CC0](https://opengameart.org/art-search?keys=&field_art_type_tid%5B%5D=12&sort_by=count&sort_order=DESC). Pick
  upbeat major-key loops; 90-110 BPM for menu, 120-140 BPM for gameplay.
- **Kenney.nl Music Jingles** — https://kenney.nl/assets/music-jingles (CC0, short)
- **Free Music Archive** — https://freemusicarchive.org/ (filter by CC0 / CC-BY)
- **Incompetech (Kevin MacLeod)** — https://incompetech.com/music/royalty-free/ (CC-BY,
  attribution required in this file)
- **Pixabay** — https://pixabay.com/music/ (free for use, no attribution needed)

Convert to `.ogg` and normalize loudness:

```bash
ffmpeg -i source.mp3 -af loudnorm=I=-16:TP=-1.5:LRA=11 \
  -c:a vorbis -strict experimental -q:a 5 public/audio/music-game.ogg
```

When you swap in a real asset, update the row above with the actual author and
license. CC-BY tracks must be credited here exactly as the author requests.

## Code

All gameplay code in this repo is original, MIT-licensed.

## Visuals

All in-game art is generated procedurally at runtime via
`Phaser.GameObjects.Graphics.generateTexture()` — no third-party bitmaps are
bundled.
