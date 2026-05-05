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
  /**
   * Identifier of the pointer currently driving the paddle. Phaser
   * fires per-pointer events on multi-touch devices; without this
   * we'd accept a second finger's pointerdown and corrupt the drag
   * origin for the primary finger. -1 = no active drag.
   */
  private lockedPointerId = -1;
  /**
   * Timestamp (Phaser ms) of the last pointerup. Combined with
   * MICRO_LIFT_WINDOW_MS this lets us detect when a fast swipe
   * caused the finger to briefly lift and re-place — common on
   * touchscreens during fast paddle swipes. We treat the next
   * pointerdown as a continuation of the prior drag rather than
   * a fresh one (no drag-origin reset).
   */
  private lastPointerUpTimeMs = -Infinity;
  /**
   * Set true by the pointerdown handler when the touch is a micro-lift
   * continuation. Consumed by beginDrag() so a continuation doesn't
   * overwrite the in-flight drag origin (which would jump the paddle).
   * Reset after every beginDrag call so a fresh tap behaves normally.
   */
  private skipNextBeginDrag = false;

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
  /**
   * If a new pointerdown arrives within this many ms of the last
   * pointerup, treat it as a micro-lift continuation rather than a
   * fresh drag. Mobile browsers can fire spurious up/down pairs during
   * fast swipes; without this, the paddle would reset its drag origin
   * mid-swipe and visibly stutter.
   */
  private static readonly MICRO_LIFT_WINDOW_MS = 80;

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
      if (p.wasTouch) this.hasSeenTouch = true;

      // Multi-touch lock: if another finger is already driving the
      // paddle, ignore secondary touches entirely. Without this, a
      // second-finger touch (very common when gripping a phone) would
      // reset dragOriginPointerX for the primary finger and cause the
      // paddle to teleport.
      if (this.lockedPointerId !== -1 && p.id !== this.lockedPointerId) return;

      const isMicroLift =
        scene.time.now - this.lastPointerUpTimeMs < InputSystem.MICRO_LIFT_WINDOW_MS;
      // GameScene's own pointerdown listener fires AFTER this one and
      // calls beginDrag(paddle.x). When this is a continuation, we
      // need beginDrag to skip its origin-update — otherwise the
      // paddle would jump. The next call to beginDrag consumes this
      // flag.
      this.skipNextBeginDrag = isMicroLift;

      this.lockedPointerId = p.id;
      this.pointerActive = true;
      this.pointerX = p.worldX;
      this.pointerY = p.worldY;

      if (!isMicroLift) {
        // Fresh touch: rebuild drag origin and clear tap-distance tracker.
        this.pointerDownX = p.worldX;
        this.pointerDownY = p.worldY;
        this.pointerDragDist = 0;
        this.dragOriginPointerX = p.worldX;
        // dragOriginPaddleX is set by the caller via beginDrag().
      }
      // Micro-lift continuation: keep dragOriginPointerX, dragOriginPaddleX,
      // and pointerDragDist so the swipe carries through without a reset.

      // Desktop (mouse) keeps click-to-launch+fire. Touch defers until
      // pointerup so a quick drag doesn't auto-serve.
      if (!p.wasTouch) {
        this.fire('launch');
        this.fire('fire');
      }
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // Only the locked pointer drives the paddle.
      if (this.lockedPointerId !== -1 && p.id !== this.lockedPointerId) return;
      this.pointerX = p.worldX;
      this.pointerY = p.worldY;
      // Update unconditionally — DON'T gate on p.isDown. Some Android
      // browsers deliver pointermove with isDown=false during fast
      // swipes (a timing artifact); gating drops those frames and
      // causes visible paddle lag/freeze.
      if (this.lockedPointerId !== -1) {
        this.pointerActive = true;
        const dx = p.worldX - this.pointerDownX;
        const dy = p.worldY - this.pointerDownY;
        const d = Math.hypot(dx, dy);
        if (d > this.pointerDragDist) this.pointerDragDist = d;
      }
    });

    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.lockedPointerId) return;
      this.pointerX = p.worldX;
      this.pointerY = p.worldY;
      this.lastPointerUpTimeMs = scene.time.now;
      const lockedAtUp = this.lockedPointerId;
      if (p.wasTouch) {
        // Tap (no significant drag) -> launch + fire. Drag -> just lift.
        if (this.pointerDragDist < InputSystem.TAP_THRESHOLD_PX) {
          this.fire('launch');
          this.fire('fire');
        }
        // Defer pointerActive=false by the micro-lift window so a fast
        // up-then-down pair (mid-swipe artifact) doesn't freeze the
        // paddle for ~16ms while the lift sits in limbo. If a fresh
        // pointerdown arrives in the window, it re-locks and the
        // delayed callback short-circuits.
        scene.time.delayedCall(InputSystem.MICRO_LIFT_WINDOW_MS + 16, () => {
          if (this.lockedPointerId === lockedAtUp) {
            this.pointerActive = false;
            this.lockedPointerId = -1;
          }
        });
      } else {
        // Mouse: immediate release.
        this.pointerActive = false;
        this.lockedPointerId = -1;
      }
    });

    // pointercancel fires when the OS steals the touch (notification
    // pull-down, incoming call, home-gesture, edge swipe). Without
    // this handler the lockedPointerId would never reset and the
    // paddle would be frozen until the page reloads.
    scene.input.on('gameout', () => {
      // Phaser fires 'gameout' on the input manager when the pointer
      // leaves the game. We treat this as a soft pointer release.
      this.pointerActive = false;
    });
    scene.input.on('pointercancel', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.lockedPointerId) return;
      this.pointerActive = false;
      this.lockedPointerId = -1;
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

  /**
   * Per-frame poll: returns -1, 0, +1 for paddle direction. Keyboard
   * and touch can coexist — GameScene gives keyboard priority by
   * checking axisX() first and only falling back to paddleTargetX()
   * when axisX() is 0. Killing pointerActive here would freeze a
   * Bluetooth-keyboard user mid-touch on mobile.
   */
  axisX(): number {
    let v = 0;
    if (this.leftKey?.isDown || this.aKey?.isDown) v -= 1;
    if (this.rightKey?.isDown || this.dKey?.isDown) v += 1;
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

  /**
   * Tells the input system where the paddle was when a drag began.
   * Required for relative-drag mode; safe to call on every pointerdown.
   * During a micro-lift continuation the in-flight origin is preserved
   * (otherwise the paddle would jump on the re-touch).
   */
  beginDrag(paddleX: number): void {
    if (this.skipNextBeginDrag) {
      this.skipNextBeginDrag = false;
      return;
    }
    this.dragOriginPaddleX = paddleX;
  }

  /**
   * Re-anchor the drag origin to the current finger position and a
   * fresh paddle position. Called by GameScene every frame the paddle
   * gets clamped to a wall — without this, dragging past a wall and
   * back would feel "stuck" until the user retraced the over-shoot
   * exactly. Re-anchoring makes the next finger movement respond
   * immediately, in either direction.
   */
  rebaseDrag(paddleX: number): void {
    this.dragOriginPaddleX = paddleX;
    this.dragOriginPointerX = this.pointerX;
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
