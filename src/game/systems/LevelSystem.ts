import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { darken, lighten } from '../config/palette';
import { archetypeForSymbol } from '../data/brickTypes';
import type { BrickArchetype, LevelDef } from '../types';
import { Brick } from '../entities/Brick';

export interface ParsedLevel {
  bricks: Brick[];
  breakableCount: number;
}

/**
 * Translate a LevelDef.rows string array into Brick instances positioned in
 * the scene. Each row character maps to a brick archetype (see brickTypes.ts).
 * Rows narrower than `cols` are right-padded with empty cells.
 */
export function buildLevel(scene: Phaser.Scene, def: LevelDef): ParsedLevel {
  const bricks: Brick[] = [];
  const cols = Tuning.bricks.cols;
  const bw = Tuning.bricks.width;
  const bh = Tuning.bricks.height;
  const colGap = Tuning.bricks.colGap;
  const rowGap = Tuning.bricks.rowGap;
  const ox = Tuning.bricks.fieldOffsetX;
  const oy = Tuning.bricks.fieldOffsetY;

  let breakable = 0;

  validateLevelDef(def);

  def.rows.forEach((row, r) => {
    for (let c = 0; c < cols; c++) {
      const sym = row[c] ?? '.';
      const arche = archetypeForSymbol(sym);
      if (!arche) continue;
      const x = ox + c * (bw + colGap) + bw / 2;
      const y = oy + r * (bh + rowGap) + bh / 2;
      const colorOverride = paletteColorFor(def, arche) ?? defaultRowColor(arche, r);
      const brick = new Brick(scene, x, y, arche, colorOverride);
      bricks.push(brick);
      if (brick.isBreakable()) breakable++;
      // Subtle, staggered breathing pulse so the field feels alive.
      // Indestructible bricks stay still — they're meant to feel inert.
      if (arche.kind !== 'indestructible') {
        scene.tweens.add({
          targets: brick.sprite,
          alpha: { from: 0.86, to: 1 },
          duration: 1400 + (r * 53 + c * 31) % 600,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          delay: ((r * 7 + c * 11) % 9) * 60,
        });
      }
    }
  });

  return { bricks, breakableCount: breakable };
}

function paletteColorFor(def: LevelDef, arche: BrickArchetype): number | undefined {
  const p = def.palette;
  if (!p) return undefined;
  switch (arche.kind) {
    case 'standard':
      return p.standard;
    case 'tough':
      return p.tough;
    case 'hard':
      return p.hard;
    case 'special':
      return p.special;
    default:
      return undefined;
  }
}

/**
 * Row-driven candy tint applied to EVERY brick kind. Standard bricks
 * use the row's rainbow slot directly; tough/hard/special offset by a
 * fixed number of slots so adjacent same-row bricks of different kinds
 * still read as different colors, then lighten or darken so the kind
 * is visually distinct (tougher = darker, special = brighter).
 * Indestructible bricks ignore the palette and stay steel-gray —
 * intentionally dull so they read as immovable obstacles.
 */
function defaultRowColor(arche: BrickArchetype, rowIdx: number): number | undefined {
  const palette = Tuning.bricks.rainbowRowColors;
  // palette is declared `as const` with 14 entries — length > 0 is a
  // compile-time invariant, so we don't need a runtime guard.
  const len = palette.length;

  switch (arche.kind) {
    case 'standard':
      return palette[rowIdx % len]!;
    case 'tough': {
      // Offset by 2 slots so tough bricks contrast with standard in same row.
      const base = palette[(rowIdx + 2) % len]!;
      return darken(base, 0.15);
    }
    case 'hard': {
      // Offset by 4 slots, noticeably darker to read as "armored".
      const base = palette[(rowIdx + 4) % len]!;
      return darken(base, 0.28);
    }
    case 'special': {
      // Offset by 3 slots, lightened so they pop / glow.
      const base = palette[(rowIdx + 3) % len]!;
      return lighten(base, 0.35);
    }
    case 'indestructible':
      return 0x556688; // always steel-gray
    default:
      return palette[rowIdx % len]!;
  }
}

/**
 * Returns warning strings for a LevelDef without mutating it. Logs each
 * warning to the console in dev builds so authors notice silent
 * truncations or unknown symbols.
 */
export function validateLevelDef(def: LevelDef): string[] {
  const cols = Tuning.bricks.cols;
  const warnings: string[] = [];
  def.rows.forEach((row, r) => {
    if (row.length > cols) {
      warnings.push(
        `Level ${def.id} "${def.name}" row ${r} has ${row.length} chars; only the first ${cols} are used.`,
      );
    }
    for (let c = 0; c < Math.min(row.length, cols); c++) {
      const sym = row[c] ?? '.';
      if (sym === '.' || sym === ' ') continue;
      if (!archetypeForSymbol(sym)) {
        warnings.push(`Level ${def.id} row ${r} col ${c}: unknown symbol "${sym}".`);
      }
    }
  });
  if (warnings.length && import.meta.env?.DEV) {
    for (const w of warnings) console.warn(`[buildLevel] ${w}`);
  }
  return warnings;
}

/** Pure helper used by tests — returns counts without building scene objects. */
export function analyzeLevel(def: LevelDef): { total: number; breakable: number; indestructible: number } {
  const cols = Tuning.bricks.cols;
  let total = 0;
  let breakable = 0;
  let indestructible = 0;
  for (const row of def.rows) {
    for (let c = 0; c < cols; c++) {
      const sym = row[c] ?? '.';
      const a = archetypeForSymbol(sym);
      if (!a) continue;
      total++;
      if (a.kind === 'indestructible') indestructible++;
      else breakable++;
    }
  }
  return { total, breakable, indestructible };
}
