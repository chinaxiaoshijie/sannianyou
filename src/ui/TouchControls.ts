/**
 * TouchControls — virtual joystick + action buttons for mobile.
 *
 * Architecture:
 *  - Detects touch device on construction (can be forced via forceTouch).
 *  - Exposes the same InputState shape that main.ts already reads.
 *  - Exposes a CombatInput shape for dodge / law slots.
 *  - Exposes callbacks for C/J/M/Tab panel actions (never mutate external
 *    state directly; main.ts wires these).
 *
 * Layout:
 *   Non-combat:  joystick (bottom-left) + interact btn (bottom-right) + toolbar (top-right)
 *   Combat:      joystick (bottom-left) + law 1/2/3 (bottom-right) + dodge (double-tap)
 *
 * Touch-event design:
 *   - Each touch is tracked by its identifier.
 *   - The first touch in the joystick zone is the joystick touch; all other
 *     single touches anywhere else count as taps / button presses.
 *   - Pinch (two fingers away from joystick) drives camera zoom.
 *   - Single-finger swipe outside joystick drives camera orbit.
 */

export interface TouchInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  interact: boolean;
}

export interface TouchCombatInput {
  dodge: boolean;
  lawSlot1: boolean;
  lawSlot2: boolean;
  lawSlot3: boolean;
}

export interface TouchCallbacks {
  onToggleLawPanel: () => void;
  onToggleCodex: () => void;
  onToggleMap: () => void;
  onToggleCamera: () => void;
  onCameraOrbit: (deltaX: number, deltaY: number) => void;
  onCameraZoom: (delta: number) => void;
}

interface JoystickState {
  active: boolean;
  touchId: number;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
}

const JOYSTICK_RADIUS = 60; // px — half the knob travel range
const JOYSTICK_ZONE_SIZE = 160; // px — outer zone diameter
const DEAD_ZONE = 0.15; // normalised 0-1

// Minimum swipe speed for orbit (px/frame) to avoid jitter
const ORBIT_SENSITIVITY = 0.005; // radians per pixel

export class TouchControls {
  readonly isTouch: boolean;

  // Shared input state (read by main.ts each frame)
  readonly input: TouchInputState = { forward: false, backward: false, left: false, right: false, interact: false };
  readonly combatInput: TouchCombatInput = { dodge: false, lawSlot1: false, lawSlot2: false, lawSlot3: false };

  private callbacks: TouchCallbacks;
  private inCombat = false;
  private interactHighlighted = false;

  // DOM containers
  private root!: HTMLDivElement;
  private joystickOuter!: HTMLDivElement;
  private joystickKnob!: HTMLDivElement;
  private interactBtn!: HTMLButtonElement;
  private lawBtns: HTMLButtonElement[] = [];
  private dodgeHint!: HTMLDivElement;

  // Joystick tracking
  private joystick: JoystickState = { active: false, touchId: -1, originX: 0, originY: 0, dx: 0, dy: 0 };

  // Orbit / pinch tracking
  private orbitTouch: { id: number; x: number; y: number } | null = null;
  private pinch: { id0: number; id1: number; dist: number } | null = null;

  // Double-tap for dodge
  private lastTapTime = 0;
  private readonly DOUBLE_TAP_MS = 300;

  // Auto-clear combat input each frame (like key-up)
  private lawSlotFrames = [0, 0, 0]; // count frames the btn is held

  constructor(callbacks: TouchCallbacks, forceTouch = false) {
    this.callbacks = callbacks;
    this.isTouch = forceTouch || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (!this.isTouch) return;

    this.buildDOM();
    this.attachListeners();
    this.preventBrowserDefaults();
  }

  /* ── Public API ── */

  /** Call every frame from main.ts to flush one-shot inputs. */
  update(): void {
    if (!this.isTouch) return;

    // Flush directional input from joystick each frame
    const { dx, dy, active } = this.joystick;
    if (active) {
      const nx = dx / JOYSTICK_RADIUS;
      const ny = dy / JOYSTICK_RADIUS;
      const len = Math.sqrt(nx * nx + ny * ny);
      if (len > DEAD_ZONE) {
        const nx2 = nx / Math.max(len, 1);
        const ny2 = ny / Math.max(len, 1);
        this.input.forward  = ny2 < -DEAD_ZONE;
        this.input.backward = ny2 >  DEAD_ZONE;
        this.input.left     = nx2 < -DEAD_ZONE;
        this.input.right    = nx2 >  DEAD_ZONE;
      } else {
        this.clearMovement();
      }
    } else {
      this.clearMovement();
    }

    // Auto-release law slots after one frame (simulates keyup)
    for (let i = 0; i < 3; i++) {
      if (this.lawSlotFrames[i] > 0) {
        this.lawSlotFrames[i]--;
        if (this.lawSlotFrames[i] === 0) {
          if (i === 0) this.combatInput.lawSlot1 = false;
          if (i === 1) this.combatInput.lawSlot2 = false;
          if (i === 2) this.combatInput.lawSlot3 = false;
        }
      }
    }
  }

  /** Switch between exploration and combat layout. */
  setCombatMode(active: boolean): void {
    this.inCombat = active;
    this.applyLayout();
    // Clear all inputs on mode switch
    this.clearMovement();
    this.input.interact = false;
    this.combatInput.dodge = false;
    this.combatInput.lawSlot1 = false;
    this.combatInput.lawSlot2 = false;
    this.combatInput.lawSlot3 = false;
    this.lawSlotFrames = [0, 0, 0];
  }

  /** Highlight interact button when near a trigger point. */
  setInteractHighlight(on: boolean): void {
    if (this.interactHighlighted === on || !this.isTouch) return;
    this.interactHighlighted = on;
    this.interactBtn.style.borderColor = on ? '#fbbf24' : 'rgba(200,168,78,0.5)';
    this.interactBtn.style.background = on
      ? 'rgba(200,168,78,0.25)'
      : 'rgba(10,14,26,0.7)';
    this.interactBtn.style.transform = on ? 'scale(1.12)' : 'scale(1)';
  }

  /** Destroy the overlay. */
  destroy(): void {
    if (this.root) this.root.remove();
  }

  /* ── DOM Construction ── */

  private buildDOM(): void {
    this.root = document.createElement('div');
    this.root.id = 'touch-controls';
    this.root.style.cssText = `
      position:fixed;inset:0;z-index:200;pointer-events:none;
      user-select:none;-webkit-user-select:none;
    `;
    this.root.innerHTML = this.getStyles();

    // Joystick
    this.joystickOuter = document.createElement('div');
    this.joystickOuter.className = 'tc-joystick-outer';
    const joystickInner = document.createElement('div');
    joystickInner.className = 'tc-joystick-inner';
    this.joystickKnob = document.createElement('div');
    this.joystickKnob.className = 'tc-joystick-knob';
    joystickInner.appendChild(this.joystickKnob);
    this.joystickOuter.appendChild(joystickInner);
    this.root.appendChild(this.joystickOuter);

    // Interact button (E key equivalent)
    this.interactBtn = document.createElement('button');
    this.interactBtn.className = 'tc-interact-btn';
    this.interactBtn.textContent = '交互';
    this.interactBtn.setAttribute('aria-label', '交互 (E)');
    this.root.appendChild(this.interactBtn);

    // Law buttons 1/2/3 (combat mode)
    const lawContainer = document.createElement('div');
    lawContainer.className = 'tc-law-container';
    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('button');
      btn.className = 'tc-law-btn';
      btn.textContent = `${i + 1}`;
      btn.setAttribute('aria-label', `法则 ${i + 1}`);
      btn.setAttribute('data-slot', String(i));
      lawContainer.appendChild(btn);
      this.lawBtns.push(btn);
    }
    this.root.appendChild(lawContainer);

    // Dodge hint label
    this.dodgeHint = document.createElement('div');
    this.dodgeHint.className = 'tc-dodge-hint';
    this.dodgeHint.textContent = '双击屏幕 = 闪避';
    this.root.appendChild(this.dodgeHint);

    document.body.appendChild(this.root);
    this.applyLayout();
  }

  private getStyles(): string {
    return `<style>
/* ── Touch Controls ── */
.tc-joystick-outer {
  position:absolute;
  bottom:24px;left:24px;
  width:${JOYSTICK_ZONE_SIZE}px;height:${JOYSTICK_ZONE_SIZE}px;
  border-radius:50%;
  background:rgba(0,0,0,0.25);
  border:2px solid rgba(200,168,78,0.35);
  pointer-events:all;
  touch-action:none;
  display:flex;align-items:center;justify-content:center;
}
.tc-joystick-inner {
  width:${JOYSTICK_ZONE_SIZE}px;height:${JOYSTICK_ZONE_SIZE}px;
  border-radius:50%;
  position:relative;
  display:flex;align-items:center;justify-content:center;
}
.tc-joystick-knob {
  position:absolute;
  width:52px;height:52px;
  border-radius:50%;
  background:rgba(200,168,78,0.55);
  border:2px solid rgba(200,168,78,0.9);
  box-shadow:0 2px 10px rgba(0,0,0,0.4);
  pointer-events:none;
  transition:transform 0.05s;
}
.tc-interact-btn {
  position:absolute;
  bottom:36px;right:28px;
  width:70px;height:70px;
  border-radius:50%;
  background:rgba(10,14,26,0.7);
  border:2px solid rgba(200,168,78,0.5);
  color:#c8a84e;
  font-size:13px;
  font-weight:bold;
  font-family:'Microsoft YaHei','PingFang SC',sans-serif;
  pointer-events:all;
  touch-action:none;
  cursor:pointer;
  transition:background 0.2s,border-color 0.2s,transform 0.15s;
  box-shadow:0 2px 12px rgba(0,0,0,0.4);
}
.tc-interact-btn:active{transform:scale(0.92)!important;}
.tc-law-container {
  position:absolute;
  bottom:24px;right:108px;
  display:flex;flex-direction:row;gap:10px;
  pointer-events:all;
  display:none;
}
.tc-law-btn {
  width:66px;height:66px;
  border-radius:50%;
  background:rgba(10,14,26,0.8);
  border:2px solid rgba(96,165,250,0.6);
  color:#93c5fd;
  font-size:22px;
  font-weight:bold;
  font-family:'Microsoft YaHei',sans-serif;
  cursor:pointer;
  pointer-events:all;
  touch-action:none;
  box-shadow:0 2px 12px rgba(0,0,0,0.5);
  transition:background 0.1s,transform 0.1s;
}
.tc-law-btn:active{transform:scale(0.88);background:rgba(96,165,250,0.25);}
.tc-dodge-hint {
  position:absolute;
  bottom:108px;left:50%;transform:translateX(-50%);
  color:rgba(200,168,78,0.65);
  font-size:12px;
  font-family:'Microsoft YaHei',sans-serif;
  pointer-events:none;
  display:none;
}
</style>`;
  }

  private applyLayout(): void {
    if (!this.root) return;
    const lawContainer = this.root.querySelector('.tc-law-container') as HTMLElement;
    if (this.inCombat) {
      this.interactBtn.style.display = 'none';
      lawContainer.style.display = 'flex';
      this.dodgeHint.style.display = 'block';
    } else {
      this.interactBtn.style.display = 'flex';
      lawContainer.style.display = 'none';
      this.dodgeHint.style.display = 'none';
    }
  }

  /* ── Event Listeners ── */

  private attachListeners(): void {
    // Joystick
    this.joystickOuter.addEventListener('touchstart', this.onJoystickStart, { passive: false });

    // Interact button
    this.interactBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.interact = true;
    }, { passive: false });
    this.interactBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.input.interact = false;
    }, { passive: false });

    // Law buttons
    for (let i = 0; i < this.lawBtns.length; i++) {
      const slot = i;
      const btn = this.lawBtns[i];
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (slot === 0) this.combatInput.lawSlot1 = true;
        if (slot === 1) this.combatInput.lawSlot2 = true;
        if (slot === 2) this.combatInput.lawSlot3 = true;
        this.lawSlotFrames[slot] = 2; // hold for 2 frames then auto-release
      }, { passive: false });
    }

    // Global touch for orbit / double-tap
    window.addEventListener('touchstart', this.onGlobalTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', this.onGlobalTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.onGlobalTouchEnd, { passive: false });
  }

  private preventBrowserDefaults(): void {
    // Prevent rubber-band scroll, long-press context menu, double-tap zoom
    document.addEventListener('touchmove', (e) => {
      if ((e.target as HTMLElement).closest('#touch-controls, canvas')) {
        e.preventDefault();
      }
    }, { passive: false });

    // Prevent context menu on long press
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent double-tap zoom on canvas (pointer-events approach)
    const style = document.createElement('style');
    style.textContent = `
      canvas { touch-action: none; }
      body { overflow: hidden; overscroll-behavior: none; }
    `;
    document.head.appendChild(style);
  }

  /* ── Joystick ── */

  private onJoystickStart = (e: TouchEvent): void => {
    e.preventDefault();
    if (this.joystick.active) return;
    const touch = e.changedTouches[0];
    const rect = this.joystickOuter.getBoundingClientRect();
    this.joystick = {
      active: true,
      touchId: touch.identifier,
      originX: rect.left + rect.width / 2,
      originY: rect.top + rect.height / 2,
      dx: 0,
      dy: 0,
    };
  };

  private updateJoystick(touch: Touch): void {
    const raw_dx = touch.clientX - this.joystick.originX;
    const raw_dy = touch.clientY - this.joystick.originY;
    const dist = Math.sqrt(raw_dx * raw_dx + raw_dy * raw_dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(raw_dy, raw_dx);
    this.joystick.dx = Math.cos(angle) * clamped;
    this.joystick.dy = Math.sin(angle) * clamped;
    // Move knob visually
    this.joystickKnob.style.transform =
      `translate(${this.joystick.dx}px, ${this.joystick.dy}px)`;
  }

  private resetJoystick(): void {
    this.joystick.active = false;
    this.joystick.touchId = -1;
    this.joystick.dx = 0;
    this.joystick.dy = 0;
    this.joystickKnob.style.transform = 'translate(0px, 0px)';
    this.clearMovement();
  }

  /* ── Global Touch (orbit, pinch, double-tap) ── */

  private isInJoystickZone(x: number, y: number): boolean {
    const rect = this.joystickOuter.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = rect.width / 2 + 20; // a little margin
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < r;
  }

  private isOnButton(target: EventTarget | null): boolean {
    if (!target) return false;
    const el = target as HTMLElement;
    return !!(el.closest('.tc-interact-btn, .tc-law-btn, .tc-joystick-outer'));
  }

  private onGlobalTouchStart = (e: TouchEvent): void => {
    // Joystick gets its own listener — skip if joystick touch
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (this.isInJoystickZone(touch.clientX, touch.clientY)) continue;
      if (this.isOnButton(touch.target)) continue;

      // Two active non-joystick touches → pinch
      if (this.orbitTouch && this.pinch === null) {
        const dist = Math.hypot(
          touch.clientX - this.orbitTouch.x,
          touch.clientY - this.orbitTouch.y,
        );
        this.pinch = { id0: this.orbitTouch.id, id1: touch.identifier, dist };
        this.orbitTouch = null;
        return;
      }

      // First non-joystick touch → potential orbit / tap
      if (!this.orbitTouch) {
        this.orbitTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
      }
    }
  };

  private onGlobalTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Joystick
      if (this.joystick.active && touch.identifier === this.joystick.touchId) {
        this.updateJoystick(touch);
        continue;
      }

      // Pinch zoom
      if (this.pinch) {
        const touches = Array.from(e.touches);
        const t0 = touches.find(t => t.identifier === this.pinch!.id0);
        const t1 = touches.find(t => t.identifier === this.pinch!.id1);
        if (t0 && t1) {
          const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
          const delta = this.pinch.dist - newDist; // positive → pinch in → zoom out
          this.callbacks.onCameraZoom(delta * 0.05);
          this.pinch.dist = newDist;
        }
        continue;
      }

      // Orbit
      if (this.orbitTouch && touch.identifier === this.orbitTouch.id) {
        const ddx = touch.clientX - this.orbitTouch.x;
        const ddy = touch.clientY - this.orbitTouch.y;
        this.callbacks.onCameraOrbit(ddx * ORBIT_SENSITIVITY, ddy * ORBIT_SENSITIVITY);
        this.orbitTouch.x = touch.clientX;
        this.orbitTouch.y = touch.clientY;
      }
    }
  };

  private onGlobalTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Joystick release
      if (this.joystick.active && touch.identifier === this.joystick.touchId) {
        this.resetJoystick();
        continue;
      }

      // Pinch end
      if (this.pinch &&
          (touch.identifier === this.pinch.id0 || touch.identifier === this.pinch.id1)) {
        this.pinch = null;
        continue;
      }

      // Orbit / tap end
      if (this.orbitTouch && touch.identifier === this.orbitTouch.id) {
        // Check for double-tap (dodge in combat)
        if (this.inCombat && !this.isOnButton(touch.target)) {
          const now = performance.now();
          if (now - this.lastTapTime < this.DOUBLE_TAP_MS) {
            this.combatInput.dodge = true;
            // Auto-release next frame
            setTimeout(() => { this.combatInput.dodge = false; }, 80);
            this.lastTapTime = 0;
          } else {
            this.lastTapTime = now;
          }
        }
        this.orbitTouch = null;
      }
    }
  };

  /* ── Helpers ── */

  private clearMovement(): void {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
  }
}
