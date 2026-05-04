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
