import Phaser from 'phaser';
import { Tuning } from '../config/tuning';
import { archetypeForSymbol } from '../data/brickTypes';
import type { LevelDef } from '../types';
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
      const brick = new Brick(scene, x, y, arche);
      bricks.push(brick);
      if (brick.isBreakable()) breakable++;
    }
  });

  return { bricks, breakableCount: breakable };
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
