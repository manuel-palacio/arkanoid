# Brickstorm

An original arcade brick-breaker built with **Phaser 3 + TypeScript + Vite**. Original DNA from the genre that *Arkanoid* defined: paddle, ball, brick formations, falling power-ups, lives, score chains, escalating levels. None of the names, art, audio, or level layouts are copied — every visual is generated procedurally with `Phaser.GameObjects.Graphics`, every sound is synthesized live with `OfflineAudioContext`, and the ten levels are hand-authored grids.

> Brickstorm is an independent homage; *Arkanoid* and its assets are trademarks of their respective owners.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Production bundle:

```bash
npm run build    # outputs dist/
npm run preview  # serves the production build locally
```

Other scripts:

```bash
npm test         # vitest — pure-logic tests
npm run lint     # eslint
npm run format   # prettier write
```

Open with `?debug=1` for collision boxes, paddle hitbox, and ball velocity vectors.

---

## Stack and rationale

| Tool | Why |
|------|-----|
| **Phaser 3** | Game-oriented engine: scenes, scale manager, Arcade Physics for spatial bookkeeping, sound manager, particle/tween/camera utilities. Avoids reinventing a render loop. |
| **TypeScript (strict)** | Catches type errors across the data-driven brick / power-up / level system. |
| **Vite** | Fast HMR during play-tuning iterations, ESM-native production build, the official Phaser template for this stack. |
| **Vitest** | Isolated unit tests for *pure* gameplay logic (bounce reflection, score/chain math, level parsing, RNG-driven power-up selection). No jsdom required because the tests don't touch DOM. |
| **ESLint + Prettier** | Standard project hygiene. |

**No Howler.js.** Phaser's WebAudio sound manager already handles unlock-on-gesture and bus routing; pulling in Howler would duplicate functionality without adding sound-sprite or codec coverage we'd actually use.

---

## Scene graph

```
BootScene  → PreloadScene  → MainMenuScene
                                     │
                                     ▼
                                GameScene ── (overlay) UIScene
                                     │
                       ┌─────────────┼─────────────┐
                       ▼             ▼             ▼
                 PauseScene   GameOverScene   VictoryScene
```

- **BootScene** — registry defaults.
- **PreloadScene** — generates all textures and audio buffers (no disk loads).
- **MainMenuScene** — title, instructions, settings, click-to-start audio gate.
- **GameScene** — gameplay only; spawns entities and orchestrates systems.
- **UIScene** — HUD overlay (score, lives, level, active power-ups, chain floaters). Lives in its own scene so HUD redraws don't interfere with the play camera shake.
- **PauseScene / GameOverScene / VictoryScene** — modal overlays.

`GameScene` is intentionally a thin orchestrator. The rules live in `src/game/systems/` and `src/game/data/`, so the scene barely makes decisions itself.

---

## Architecture

```
src/game/
├── AppGame.ts              one-shot game factory + high-score persistence
├── config/
│   ├── gameConfig.ts       Phaser config, scene keys, registry/event keys
│   └── tuning.ts           ALL gameplay tuning lives here (no magic numbers in scenes)
├── scenes/                 (Boot, Preload, MainMenu, Game, UI, Pause, GameOver, Victory)
├── entities/               Paddle, Ball, Brick, PowerUp, Projectile
├── systems/
│   ├── CollisionSystem.ts  PURE bounce math — paddle-zone reflection, brick AABB, walls
│   ├── PowerUpSystem.ts    seedable RNG with weighted-pick + repeat suppression
│   ├── LevelSystem.ts      parse LevelDef.rows → Brick instances; analyze() for tests
│   ├── ScoreSystem.ts      mutable wrapper around pure rules in data/gameRules.ts
│   ├── EffectsSystem.ts    starfield, screen shake, sparks, hit-stop
│   └── InputSystem.ts      keyboard / pointer / touch normalized into actions
├── audio/
│   ├── AudioManager.ts     buffer cache, unlock, music & sfx buses, mute / volume
│   └── synth.ts            tone / noise / chiptune-loop renderers (OfflineAudioContext)
├── data/
│   ├── brickTypes.ts       archetypes (S/T/H/I/*)
│   ├── powerUps.ts         7 power-up definitions
│   └── gameRules.ts        PURE scoring / chain / life-bonus functions
├── levels/                 level01.ts ... level10.ts + index.ts
├── types/                  shared TS types
└── utils/                  math, rng (mulberry32 + weighted pick), procedural textures
```

### Why split rules from scene
`CollisionSystem`, `PowerUpSystem.createPowerUpSelector`, and `data/gameRules.ts` are framework-free, dependency-free pure functions. They are unit-tested in `tests/`. The Phaser scene is the integration layer that calls them; this keeps the gameplay model headless-testable.

### Bounce model
Paddle reflection is **paddle-zone**, not physical: the outgoing direction is a function of where the ball hit on the paddle (offset in `[-1, 1]` mapped to angle in `[-75°, +75°]` from vertical), *ignoring* the incoming velocity. A small jitter (±1°) and a min-vertical-fraction clamp prevent infinite vertical / horizontal lock-in. Brick reflection is AABB with side determined by the ball's previous position. Ball motion is sub-stepped each frame so high speeds don't tunnel through small bricks.

---

## Authoring a new level

Levels are pure data — drop a file in `src/game/levels/levelXX.ts` and append it to `levels/index.ts`.

```ts
import type { LevelDef } from '../types';

const myLevel: LevelDef = {
  id: 11,
  name: 'NIGHTSHIFT',
  ballSpeedMul: 1.2,                 // optional speed multiplier
  allowedPowerUps: ['expand','slow'],// optional whitelist
  rows: [
    'IIIIIIIIIIIII',
    'I.SSSSSSSSS.I',
    'I.STTTTTTTS.I',
    'I.STSS*SSTS.I',
    'I.STTTTTTTS.I',
    'I.SSSSSSSSS.I',
  ],
};
export default myLevel;
```

Symbol legend:

| Symbol | Meaning            | Hits | Score | Drop chance |
|--------|--------------------|------|-------|-------------|
| `.` `' '` | empty cell      | —    | —     | —           |
| `S`    | standard          | 1    | 50    | 16%         |
| `T`    | tough             | 2    | 90    | 20%         |
| `H`    | hard              | 3    | 140   | 24%         |
| `I`    | indestructible    | ∞    | 0     | 0%          |
| `*`    | special (always drops) | 1 | 80 | 100%        |

The grid is 13 columns wide; rows past row 13 just push the wall closer. Edit `Tuning.bricks` in `config/tuning.ts` to change the field geometry.

---

## Power-ups

7 capsules drop from broken bricks (`src/game/data/powerUps.ts`). Each has a weight; `PowerUpSystem` picks via weighted RNG and never drops the same kind twice in a row. Allowed kinds can be whitelisted per level.

| Kind   | Effect                                       | Default duration |
|--------|----------------------------------------------|------------------|
| WIDEN  | Paddle grows                                 | 18 s             |
| NARROW | Paddle shrinks (negative)                    | 12 s             |
| SLOW   | Ball slowed                                  | 12 s             |
| MULTI  | Splits each ball in three                    | instant          |
| CATCH  | Paddle catches the ball; SPACE to launch     | 18 s             |
| FIRE   | Paddle fires twin lasers                     | 14 s             |
| 1UP    | +1 life                                      | instant          |

Tune durations and weights in `config/tuning.ts` and `data/powerUps.ts`.

---

## Audio

All audio is procedurally synthesized in `src/game/audio/synth.ts`:
- SFX: `OscillatorNode` + envelope, with optional lowpass (paddle, wall, brickHit, brickBreak, laser, powerup, lifeLost, gameOver).
- A separate `OfflineAudioContext` renders a 4-step ascending square-wave jingle for level clear.
- Music: two procedural chiptune loops (menu and game) built from MIDI step arrays into a filtered OfflineAudioContext.

`AudioManager` owns a single `AudioContext` with three gain nodes (master / music / sfx) and is **unlocked on first user gesture** (pointer or key) by both `MainMenuScene` and `GameScene`. Volume sliders + mute live on `Phaser.Game.registry`; pause/menu screens read and write them.

---

## Where to tune gameplay

`src/game/config/tuning.ts` is the single source of truth — paddle width / speed / max-bounce-angle, ball speed clamp / radius, brick geometry, power-up durations, score chain rules, life thresholds, effect intensities, audio defaults.

If you find a magic number in a scene, treat it as a bug — it should live in `tuning.ts`.

---

## Tests

```bash
npm test
```

Covers:
- `tests/bounce.test.ts` — paddle-zone reflection, brick reflection, wall bounce, paddle hit detection, anti-stuck nudge.
- `tests/score.test.ts` — chain timing, chain reset, level-clear bonus, life-threshold awards.
- `tests/levelParse.test.ts` — every shipped level parses; symbol mapping; column bounds.
- `tests/powerupSelection.test.ts` — RNG determinism, repeat suppression, drop probability, allowlist.

These tests run headless in Vitest's Node environment because the modules under test don't touch Phaser or the DOM.

---

## Debug mode

Append `?debug=1` to the URL. The game scene draws:
- Brick AABB outlines (green)
- Paddle AABB (magenta)
- Ball circle + velocity vector (yellow)

You can flip individual systems on/off by editing the registry value `RegistryKeys.Debug`.

---

## Deploy to Fly.io

The repo includes a `Dockerfile` (multi-stage Node build → nginx static serving) and a `fly.toml`.

First-time setup:

```bash
fly launch --copy-config --no-deploy   # claim an app name
fly deploy
```

Subsequent deploys:

```bash
fly deploy
```

The container exposes port 8080 with a `/healthz` endpoint for Fly's checks. Static assets in `/assets/` are served with a 1-year immutable cache; everything else falls back to `index.html` (SPA-style). Auto-stop is enabled to keep idle costs near zero — first request after idle takes ~1 second to wake.

---

## Known limitations / next steps

- No persistent settings (only high score is persisted to `localStorage`).
- No virtual gamepad on mobile beyond drag — adding tap-zones would help portrait phones.
- Endless / challenge mode is intentionally deferred (spec called for it only after the main game is solid).
- Single bundle is ~350 KB gzipped; splitting Phaser into a separate chunk via `rollupOptions.manualChunks` is an easy win if you need it.

---

## Controls

| Action          | Keyboard            | Pointer          |
|-----------------|---------------------|------------------|
| Move paddle     | ← → / A D           | Drag horizontally |
| Launch / fire   | SPACE               | Click / tap      |
| Pause           | P or ESC            | —                |
| Mute            | M                   | —                |
| Quit (paused)   | Q                   | —                |

---

## License & credits

Code: MIT. All art and audio in this repo are original and procedurally generated. *Arkanoid* is referenced only as a genre touchstone in this README — no copyrighted strings, layouts, or assets are bundled.
