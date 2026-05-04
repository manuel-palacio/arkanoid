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

/** Touch movement model. Default 'relative' on touch devices feels far
 *  better for Arkanoid-style precision — paddle moves the same delta
 *  the finger moved, not snap-to-finger. */
export type TouchMode = 'relative' | 'absolute';

/**
 * Normalizes keyboard, pointer (mouse + touch) into a single stream of
 * game actions and a frame-by-frame paddle target. Gameplay code never
 * reads raw pointer events — it polls axisX(), pointerInfo(), and the
 * new dragDeltaX() / wantsAbsolutePos() helpers.
 *
 * Public API (preserved for callers):
 *   on / off / fire (internal)
 *   axisX()           keyboard axis
 *   pointerInfo()     active flag + last pointer x/y
 *   isFireDown()      space or any active pointer
 *   setBallHeld(bool) compatibility shim
 */
export class InputSystem {
  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private aKey?: Phaser.Input.Keyboard.Key;
  private dKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private listeners = new Map<InputAction, Set<() => void>>();

  // Pointer state.
  private pointerActive = false;
  private pointerX = 0;
  private pointerY = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerDragDist = 0;

  /** Absolute pointer X at the moment touchstart fired. */
  private dragOriginPointerX = 0;
  /** Caller-supplied paddle X at the moment drag began. GameScene
   *  populates this via beginDrag(). */
  private dragOriginPaddleX = 0;

  // Mode detection.
  private touchMode: TouchMode = 'relative';
  /** True once we see any wasTouch event. Drives auto-mode + UI hints. */
  private hasSeenTouch = false;

  /** Drag distance under this counts as a tap. Bumped from 12 to 18 px
   *  to be more tolerant on small phone screens. */
  private static readonly TAP_THRESHOLD_PX = 18;

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
      this.dragOriginPointerX = p.worldX;
      if (p.wasTouch) this.hasSeenTouch = true;

      // Desktop (mouse) keeps click-to-launch+fire. Touch defers until
      // pointerup so a quick drag doesn't auto-serve.
      if (!p.wasTouch) {
        this.fire('launch');
        this.fire('fire');
      }
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
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
        // Tap (no significant drag) -> launch + fire. Drag -> just lift.
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

  /** Per-frame poll: returns -1, 0, +1 for paddle direction. */
  axisX(): number {
    let v = 0;
    if (this.leftKey?.isDown || this.aKey?.isDown) v -= 1;
    if (this.rightKey?.isDown || this.dKey?.isDown) v += 1;
    if (v !== 0) this.pointerActive = false;
    return v;
  }

  pointerInfo(): { active: boolean; x: number; y: number } {
    return { active: this.pointerActive, x: this.pointerX, y: this.pointerY };
  }

  isFireDown(): boolean {
    return !!this.spaceKey?.isDown || this.scene.input.activePointer.isDown;
  }

  /** Compatibility shim — the new touch model decides launch on
   *  pointerup via drag-distance. Held flag isn't required. */
  setBallHeld(_held: boolean): void {
    /* intentional no-op */
  }

  // ---------- relative-drag API ----------

  /** Tells the input system where the paddle was when a drag began.
   *  Required for relative-drag mode; safe to call on every pointerdown. */
  beginDrag(paddleX: number): void {
    this.dragOriginPaddleX = paddleX;
  }

  /** Per-frame absolute target X for the paddle. Returns null if there
   *  is no current pointer drive (caller should use keyboard / nothing). */
  paddleTargetX(): number | null {
    if (!this.pointerActive) return null;
    if (this.touchMode === 'absolute' || !this.hasSeenTouch) {
      // Mouse/desktop or explicit override: paddle snaps to pointer x.
      return this.pointerX;
    }
    // Relative drag: paddle moves by the delta of the finger since drag
    // began. Feels like a virtual joystick / slider rather than a teleport.
    const delta = this.pointerX - this.dragOriginPointerX;
    return this.dragOriginPaddleX + delta;
  }

  setTouchMode(mode: TouchMode): void {
    this.touchMode = mode;
  }

  getTouchMode(): TouchMode {
    return this.touchMode;
  }

  hasTouchInput(): boolean {
    return this.hasSeenTouch;
  }
}
