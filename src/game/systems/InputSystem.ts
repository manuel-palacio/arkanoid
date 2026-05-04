import Phaser from 'phaser';

export type InputAction =
  | 'left-down'
  | 'right-down'
  | 'left-up'
  | 'right-up'
  | 'launch'
  | 'fire'
  | 'pause'
  | 'mute';

/**
 * Normalizes keyboard, pointer (mouse + touch) into a single stream of game
 * actions. Gameplay code never reads raw input — it subscribes to actions.
 */
export class InputSystem {
  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private aKey?: Phaser.Input.Keyboard.Key;
  private dKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private listeners = new Map<InputAction, Set<() => void>>();
  private pointerActive = false;
  private pointerX = 0;
  private pointerY = 0;

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      this.leftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
      this.rightKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
      this.aKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.dKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

      kb.on('keydown-SPACE', () => this.fire('launch'));
      kb.on('keydown-SPACE', () => this.fire('fire'));
      kb.on('keydown-P', () => this.fire('pause'));
      kb.on('keydown-ESC', () => this.fire('pause'));
      kb.on('keydown-M', () => this.fire('mute'));
    }

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerActive = true;
      this.pointerX = p.worldX;
      this.pointerY = p.worldY;
      this.fire('launch');
      this.fire('fire');
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // Always track the latest cursor position; only flip to pointer-mode
      // when the cursor is actually over the canvas with a button held, or
      // when the user has touched the screen. Hover alone must not hijack
      // a keyboard player's paddle.
      this.pointerX = p.worldX;
      this.pointerY = p.worldY;
      if (p.isDown) this.pointerActive = true;
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.pointerX = p.worldX;
      this.pointerY = p.worldY;
      // Touch lift -> stop driving paddle; mouse release keeps pointer mode
      // until a key press takes over (handled in axisX()).
      if (p.pointerType === 'touch') this.pointerActive = false;
    });
  }

  on(action: InputAction, fn: () => void): void {
    let set = this.listeners.get(action);
    if (!set) {
      set = new Set();
      this.listeners.set(action, set);
    }
    set.add(fn);
  }

  off(action: InputAction, fn: () => void): void {
    this.listeners.get(action)?.delete(fn);
  }

  private fire(action: InputAction): void {
    this.listeners.get(action)?.forEach((fn) => fn());
  }

  /** Per-frame poll: returns -1, 0, +1 for paddle direction (continuous keys). */
  axisX(): number {
    let v = 0;
    if (this.leftKey?.isDown || this.aKey?.isDown) v -= 1;
    if (this.rightKey?.isDown || this.dKey?.isDown) v += 1;
    // Keyboard input takes priority over a stale pointer-active flag.
    if (v !== 0) this.pointerActive = false;
    return v;
  }

  pointerInfo(): { active: boolean; x: number; y: number } {
    return { active: this.pointerActive, x: this.pointerX, y: this.pointerY };
  }

  isFireDown(): boolean {
    return !!this.spaceKey?.isDown || this.scene.input.activePointer.isDown;
  }
}
