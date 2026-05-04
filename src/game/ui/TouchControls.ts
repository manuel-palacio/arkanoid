/**
 * DOM-based touch UI overlay. Sits above the Phaser canvas at z-index
 * 30 with `pointer-events: none` on the container so finger drags
 * pass through to the canvas, while the individual buttons opt back
 * in with `pointer-events: auto`.
 *
 * Keeping these as DOM elements (not Phaser Containers) gives us:
 *  - Native click/tap handling that works reliably across mobile
 *    browsers, including iOS Safari edge cases that have historically
 *    bitten Phaser Container interactivity.
 *  - CSS sizing in safe-area-aware units so the buttons sit clear of
 *    home indicators and notches.
 *  - Trivial show/hide without scene-graph manipulation.
 */
export interface TouchControlsCallbacks {
  onLaunch: () => void;
  onPause: () => void;
  onMute: () => void;
  onLaserHold?: (down: boolean) => void;
}

export class TouchControls {
  private container: HTMLDivElement | null = null;
  private launchBtn: HTMLButtonElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;
  private laserBtn: HTMLButtonElement | null = null;
  private mounted = false;

  constructor(private cbs: TouchControlsCallbacks) {}

  mount(): void {
    if (this.mounted) return;
    this.mounted = true;

    const c = document.createElement('div');
    c.id = 'touch-controls';
    c.setAttribute('aria-label', 'Game controls');
    document.body.appendChild(c);
    this.container = c;

    this.launchBtn = this.makeButton('launch', 'TAP TO SERVE', () => this.cbs.onLaunch());
    // The launch button is shown only while the ball is held; default hidden.
    this.launchBtn.style.display = 'none';

    this.makeButton('pause', '⏸', () => this.cbs.onPause());
    this.muteBtn = this.makeButton('mute', '🔊', () => this.cbs.onMute());

    if (this.cbs.onLaserHold) {
      this.laserBtn = this.makeButton('laser', 'FIRE', () => {
        this.cbs.onLaserHold?.(true);
      });
      // Hold-to-fire: pointerup releases.
      const release = () => this.cbs.onLaserHold?.(false);
      this.laserBtn.addEventListener('pointerup', release);
      this.laserBtn.addEventListener('pointercancel', release);
      this.laserBtn.addEventListener('pointerleave', release);
      this.laserBtn.style.display = 'none';
    }

    // Inject styles once.
    if (!document.getElementById('touch-controls-style')) {
      const style = document.createElement('style');
      style.id = 'touch-controls-style';
      style.textContent = STYLE_RULES;
      document.head.appendChild(style);
    }
  }

  unmount(): void {
    if (!this.mounted) return;
    this.container?.remove();
    this.container = null;
    this.launchBtn = null;
    this.muteBtn = null;
    this.laserBtn = null;
    this.mounted = false;
  }

  showLaunchButton(visible: boolean): void {
    if (!this.launchBtn) return;
    this.launchBtn.style.display = visible ? 'flex' : 'none';
  }

  showLaserButton(visible: boolean): void {
    if (!this.laserBtn) return;
    this.laserBtn.style.display = visible ? 'flex' : 'none';
  }

  setMuted(muted: boolean): void {
    if (this.muteBtn) this.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  private makeButton(kind: string, label: string, onTap: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `tc-btn tc-${kind}`;
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.textContent = label;
    // Use pointerdown for instant feel; click would add ~300ms on some
    // browsers and a click would fire on touchend after a drag too.
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onTap();
    });
    this.container?.appendChild(b);
    return b;
  }
}

const STYLE_RULES = `
#touch-controls {
  position: fixed;
  inset: 0;
  z-index: 30;
  pointer-events: none;
  padding: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0)
    env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0);
}
.tc-btn {
  position: absolute;
  pointer-events: auto;
  border: 1px solid rgba(155, 242, 255, 0.5);
  background: rgba(14, 21, 48, 0.78);
  color: #ffffff;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 700;
  border-radius: 999px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  cursor: pointer;
}
.tc-btn:active {
  background: rgba(155, 242, 255, 0.22);
  border-color: rgba(155, 242, 255, 0.95);
}
/* Launch hint sits above the paddle area. Centered, wide pill. */
.tc-launch {
  bottom: calc(env(safe-area-inset-bottom, 0px) + 18%);
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 28px;
  font-size: 16px;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: tc-pulse 1.4s ease-in-out infinite;
}
@keyframes tc-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(155, 242, 255, 0.0); }
  50% { box-shadow: 0 0 0 8px rgba(155, 242, 255, 0.15); }
}
/* Pause and mute icons in the top-right. The Phaser HUD has its own
 * pause/mute icons too, but DOM versions here guarantee usability on
 * platforms where Phaser interactivity has been flaky. */
.tc-pause, .tc-mute {
  top: calc(env(safe-area-inset-top, 0px) + 10px);
  width: 44px;
  height: 44px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tc-pause { right: calc(env(safe-area-inset-right, 0px) + 10px); }
.tc-mute  { right: calc(env(safe-area-inset-right, 0px) + 60px); }
.tc-laser {
  bottom: calc(env(safe-area-inset-bottom, 0px) + 26%);
  right: calc(env(safe-area-inset-right, 0px) + 18px);
  padding: 14px 22px;
  font-size: 14px;
  letter-spacing: 1px;
}
@media (orientation: landscape) and (max-height: 500px) {
  #touch-controls { display: none; }
}
`;
