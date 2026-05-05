import type Phaser from 'phaser';
import { Events, RegistryKeys, SceneKeys } from '../config/gameConfig';
import { POWERUPS } from '../data/powerUps';
import type { ActivePowerUp, LevelDef, PowerUpKind } from '../types';

/**
 * Desktop-only HTML side panels flanking the Phaser canvas. Reads game
 * state by subscribing to GameScene events and registry changes, then
 * mirrors them into plain DOM nodes. CSS hides the panels on viewports
 * narrower than 768 px so mobile is unaffected.
 *
 * All DOM is built with createElement + textContent — no innerHTML — so
 * there's no surface for XSS even though every string is static.
 */
export class SidePanels {
  private left: HTMLElement | null;
  private right: HTMLElement | null;
  private boundHandlers: Array<() => void> = [];
  private elScore: HTMLElement | null = null;
  private elBest: HTMLElement | null = null;
  private elLevel: HTMLElement | null = null;
  private elLives: HTMLElement | null = null;
  private elPu: HTMLElement | null = null;

  constructor(private game: Phaser.Game) {
    this.left = document.getElementById('panel-left');
    this.right = document.getElementById('panel-right');
    if (!this.left && !this.right) return;
    this.buildLeft();
    this.buildRight();
    this.bindEvents();
  }

  private buildLeft(): void {
    if (!this.left) return;
    this.left.replaceChildren();
    this.left.appendChild(buildLogo());
    this.elScore = appendStat(this.left, 'SCORE', '0000000');
    this.elBest = appendStat(this.left, 'BEST', '0000000');
    this.elLives = appendStat(this.left, 'LIVES', '♥ ♥ ♥');
    this.elLevel = appendStat(this.left, 'LEVEL', '1');
  }

  private buildRight(): void {
    if (!this.right) return;
    this.right.replaceChildren();
    this.right.appendChild(buildControls());
    const pu = el('div', { class: 'panel-powerup' });
    pu.appendChild(el('div', { class: 'ctrl-title' }, 'ACTIVE POWER-UP'));
    this.elPu = el('div', { class: 'powerup-name', id: 'dp-pu' }, '—');
    pu.appendChild(this.elPu);
    this.right.appendChild(pu);
    this.right.appendChild(buildDecoBricks());
  }

  private bindEvents(): void {
    const reg = this.game.registry;

    // Initial values from registry — covers the case where SidePanels
    // mounts before GameScene has emitted anything.
    this.setText(this.elScore, formatScore(Number(reg.get(RegistryKeys.Score) ?? 0)));
    this.setText(this.elBest, formatScore(Number(reg.get(RegistryKeys.HighScore) ?? 0)));
    this.setText(this.elLevel, String(Number(reg.get(RegistryKeys.LevelIndex) ?? 0) + 1));
    this.renderLives(Number(reg.get(RegistryKeys.Lives) ?? 3));

    // Registry changes (HighScore is registry-only; Score/Lives/Level
    // also flow through registry on transitions).
    reg.events.on(`changedata-${RegistryKeys.HighScore}`, (_p: unknown, v: number) => {
      this.setText(this.elBest, formatScore(Number(v)));
    });
    reg.events.on(`changedata-${RegistryKeys.Score}`, (_p: unknown, v: number) => {
      this.setText(this.elScore, formatScore(Number(v)));
    });
    reg.events.on(`changedata-${RegistryKeys.Lives}`, (_p: unknown, v: number) => {
      this.renderLives(Number(v));
    });
    reg.events.on(`changedata-${RegistryKeys.LevelIndex}`, (_p: unknown, v: number) => {
      this.setText(this.elLevel, String(Number(v) + 1));
    });

    // GameScene events (live updates while a run is in progress).
    const gameScene = this.game.scene.getScene(SceneKeys.Game) as Phaser.Scene | undefined;
    if (gameScene) {
      const onScore = (score: number, hi: number) => {
        this.setText(this.elScore, formatScore(score));
        this.setText(this.elBest, formatScore(Math.max(score, hi)));
      };
      const onLives = (lives: number) => this.renderLives(lives);
      const onLevel = (def: LevelDef) => this.setText(this.elLevel, String(def.id));
      const onPuAct = (payload: ActivePowerUp[] | { kind: PowerUpKind } | null) => {
        if (!payload) {
          this.setText(this.elPu, '—');
          return;
        }
        if (Array.isArray(payload)) {
          if (payload.length === 0) {
            this.setText(this.elPu, '—');
            return;
          }
          const last = payload[payload.length - 1];
          if (last) this.setText(this.elPu, POWERUPS[last.kind]?.label ?? last.kind.toUpperCase());
          return;
        }
        this.setText(this.elPu, POWERUPS[payload.kind]?.label ?? payload.kind.toUpperCase());
      };
      const onPuExp = () => this.setText(this.elPu, '—');

      gameScene.events.on(Events.ScoreChanged, onScore);
      gameScene.events.on(Events.LivesChanged, onLives);
      gameScene.events.on(Events.LevelChanged, onLevel);
      gameScene.events.on(Events.PowerUpActivated, onPuAct);
      gameScene.events.on(Events.PowerUpExpired, onPuExp);

      this.boundHandlers.push(() => {
        gameScene.events.off(Events.ScoreChanged, onScore);
        gameScene.events.off(Events.LivesChanged, onLives);
        gameScene.events.off(Events.LevelChanged, onLevel);
        gameScene.events.off(Events.PowerUpActivated, onPuAct);
        gameScene.events.off(Events.PowerUpExpired, onPuExp);
      });
    }
  }

  private setText(node: HTMLElement | null, val: string): void {
    if (node) node.textContent = val;
  }

  private renderLives(n: number): void {
    const safe = Math.max(0, Math.min(6, Math.floor(n)));
    this.setText(this.elLives, safe > 0 ? '♥ '.repeat(safe).trim() : '—');
  }

  destroy(): void {
    for (const off of this.boundHandlers) off();
    this.boundHandlers = [];
  }
}

// ----- DOM helpers (createElement + textContent only) -----

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  if (text != null) node.textContent = text;
  return node;
}

function appendStat(parent: HTMLElement, label: string, initial: string): HTMLElement {
  const wrap = el('div', { class: 'panel-stat' });
  wrap.appendChild(el('div', { class: 'stat-label' }, label));
  const value = el('div', { class: 'stat-value' }, initial);
  wrap.appendChild(value);
  parent.appendChild(wrap);
  return value;
}

function buildLogo(): HTMLElement {
  const wrap = el('div', { class: 'panel-logo', 'aria-label': 'Brickstorm' });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 132 44');
  svg.setAttribute('fill', 'none');
  const rects: Array<[number, string]> = [
    [2, '#ff5d6c'],
    [16, '#ffd23a'],
    [30, '#4ad6ff'],
  ];
  for (const [y, color] of rects) {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', '0');
    r.setAttribute('y', String(y));
    r.setAttribute('width', '40');
    r.setAttribute('height', '10');
    r.setAttribute('rx', '2');
    r.setAttribute('fill', color);
    svg.appendChild(r);
  }
  const text = document.createElementNS(ns, 'text');
  text.setAttribute('x', '48');
  text.setAttribute('y', '28');
  text.setAttribute('fill', '#e7f0ff');
  text.setAttribute('font-size', '20');
  text.setAttribute('font-family', 'Inter, sans-serif');
  text.setAttribute('font-weight', '900');
  text.textContent = 'BRICK';
  svg.appendChild(text);
  wrap.appendChild(svg);
  return wrap;
}

function buildControls(): HTMLElement {
  const wrap = el('div', { class: 'panel-controls' });
  wrap.appendChild(el('div', { class: 'ctrl-title' }, 'CONTROLS'));
  const rows: Array<{ keys: string[]; label: string }> = [
    { keys: ['←', '→'], label: 'Move paddle' },
    { keys: ['Space'], label: 'Launch / fire' },
    { keys: ['P'], label: 'Pause' },
    { keys: ['M'], label: 'Mute' },
    { keys: ['Drag'], label: 'Touch / mouse aim' },
  ];
  for (const r of rows) {
    const row = el('div', { class: 'ctrl-row' });
    for (const k of r.keys) row.appendChild(el('kbd', {}, k));
    row.appendChild(el('span', {}, r.label));
    wrap.appendChild(row);
  }
  return wrap;
}

function buildDecoBricks(): HTMLElement {
  const wrap = el('div', { class: 'deco-bricks', 'aria-hidden': 'true' });
  const candy = ['#ff3366', '#ff7a00', '#ffd600', '#44dd44', '#aa44ff'];
  for (const c of candy) {
    const brick = el('div', { class: 'deco-brick' });
    brick.style.setProperty('--c', c);
    wrap.appendChild(brick);
  }
  return wrap;
}

function formatScore(n: number): string {
  return Math.max(0, n | 0)
    .toString()
    .padStart(7, '0');
}
