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
  /** Distance moved since pointerdown — used to distinguish tap vs. drag on touch. */
  private pointerDragDist = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  /** Drag distance under this counts as a tap. */
  private static readonly TAP_THRESHOLD_PX = 12;

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
      this.pointerDownX = p.worldX;
      this.pointerDownY = p.worldY;
      this.pointerDragDist = 0;
      // Desktop / mouse: keep the click-to-launch+fire model.
      // Touch: defer launch decision until pointerup so a drag can be
      // interpreted as paddle repositioning rather than a serve.
      if (!p.wasTouch) {
        this.fire('launch');
        this.fire('fire');
      }
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // Always track the latest cursor position; only flip to pointer-mode
      // when the cursor is actually over the canvas with a button held, or
      // when the user has touched the screen. Hover alone must not hijack
      // a keyboard player's paddle.
      this.pointerX = p.worldX;
      this.pointerY = p.worldY;
      if (p.isDown) {
        this.pointerActive = true;
        const dx = p.worldX - this.pointerDownX;
        const dy = p.worldY - this.pointerDownY;
        const d = Math.hypot(dx, dy);
        if (d > this.pointerDragDist) this.pointerDragDist = d;
      }
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.pointerX = p.worldX;
      this.pointerY = p.worldY;
      if (p.wasTouch) {
        // Tap (no significant drag) -> launch / fire. Drag -> just lift.
        // This way mobile users can drag the paddle without accidentally
        // serving the ball, but a quick tap still does the obvious thing.
        if (this.pointerDragDist < InputSystem.TAP_THRESHOLD_PX) {
          this.fire('launch');
          this.fire('fire');
        }
        this.pointerActive = false;
      }
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

  /** No-op kept for compatibility — the new touch model doesn't need
   *  ballHeld state; tap-vs-drag is decided purely by drag distance. */
  setBallHeld(_held: boolean): void {
    /* intentional no-op */
  }
}
