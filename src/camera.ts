import * as THREE from 'three';

/**
 * Dual-mode third-person camera.
 * Default: orthographic (Monument Valley isometric feel).
 * Tab: toggle to free perspective.
 * Scroll: zoom (ortho = frustum resize, persp = distance).
 * Middle-click drag: orbit around player (both modes).
 */
export class ThirdPersonCamera {
  orthoCamera: THREE.OrthographicCamera;
  perspectiveCamera: THREE.PerspectiveCamera;

  private _useOrtho = true;

  // ── Shared orbit state ──
  private yaw = Math.PI / 4;   // 45° — classic isometric look
  private pitch = 0.9;         // ~52° down
  private orbitDist = 20;      // orbit radius (ortho)
  private orbitHeight = 10;

  // ── Ortho zoom ──
  private frustumSize = 26;

  // ── Perspective params ──
  private perspDistance = 14;
  private perspHeight = 8;

  // ── Drag ──
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };

  // ── Smooth reset ──
  private targetYaw: number | null = null;
  private resetSpeed = 5;

  // ── Screen shake ──
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private shakeOffset = new THREE.Vector3();

  // ── Callback when mode toggles (for external consumers to react) ──
  onToggle: (() => void) | null = null;

  // Bound handler references for cleanup
  private _onWheel!: (e: WheelEvent) => void;
  private _onKeyDown!: (e: KeyboardEvent) => void;
  private _onContextMenu!: (e: Event) => void;
  private _onMouseDown!: (e: MouseEvent) => void;
  private _onMouseUp!: (e: MouseEvent) => void;
  private _onMouseMove!: (e: MouseEvent) => void;
  private _onResize!: () => void;

  constructor() {
    const aspect = window.innerWidth / window.innerHeight;

    // Orthographic
    const half = this.frustumSize / 2;
    this.orthoCamera = new THREE.OrthographicCamera(
      -half * aspect, half * aspect, half, -half, 0.1, 500,
    );
    // Set initial position so it's not at origin before first update
    this.orthoCamera.position.set(14, 18, 14);
    this.orthoCamera.lookAt(0, 1.5, 0);

    // Perspective
    this.perspectiveCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);

    this.setupControls();
  }

  /* ────── Public API ────── */

  get activeCamera(): THREE.Camera {
    return this._useOrtho ? this.orthoCamera : this.perspectiveCamera;
  }

  get isOrtho(): boolean {
    return this._useOrtho;
  }

  toggleMode(): void {
    this._useOrtho = !this._useOrtho;
    this.onToggle?.();
  }

  /** Smooth-rotate camera back to isometric default (yaw=π/4). */
  resetOrientation(): void {
    this.targetYaw = Math.PI / 4;
  }

  /** Trigger screen shake (intensity in world units, decays over duration). */
  shake(intensity = 0.5, duration = 0.25): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  // L0 质点聚焦: zoom towards a world-space target
  private zoomTarget: THREE.Vector3 | null = null;
  private zoomDistance = 5;
  private zoomTimer = 0;
  private zoomDuration = 5;

  /** L0 质点聚焦: smoothly zoom camera towards target position. */
  zoomToTarget(target: THREE.Vector3, distance: number, duration: number): void {
    this.zoomTarget = target.clone();
    this.zoomDistance = distance;
    this.zoomTimer = duration;
    this.zoomDuration = duration;
  }

  /** Check if currently zoomed in. */
  get isZoomedIn(): boolean {
    return this.zoomTimer > 0;
  }

  /** Apply an orbit delta (from touch drag). dx/dy are in radians. */
  applyOrbitDelta(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = Math.max(-0.4, Math.min(1.35, this.pitch + dy));
    this.targetYaw = null;
  }

  /** Apply a zoom delta (from pinch). Positive = zoom out. */
  applyZoomDelta(delta: number): void {
    if (this._useOrtho) {
      this.frustumSize = Math.max(8, Math.min(60, this.frustumSize + delta));
      this.setOrthoFrustum();
    } else {
      this.perspDistance = Math.max(6, Math.min(30, this.perspDistance + delta));
    }
  }

  update(target: THREE.Object3D): void {
    const dt = 0.016; // approx frame time

    // L0 zoom-to-target
    if (this.zoomTimer > 0) {
      this.zoomTimer -= dt;
      // Temporarily override orbitDist for smooth zoom
      const t = Math.min(1, this.zoomTimer / this.zoomDuration);
      const originalDist = this.orbitDist;
      this.orbitDist = this.zoomDistance + (originalDist - this.zoomDistance) * t;
    }

    // Smooth yaw reset
    if (this.targetYaw !== null) {
      const diff = this.targetYaw - this.yaw;
      if (Math.abs(diff) < 0.001) {
        this.yaw = this.targetYaw;
        this.targetYaw = null;
      } else {
        this.yaw += diff * Math.min(1, this.resetSpeed * dt);
      }
    }

    // Update shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const strength = this.shakeIntensity * (this.shakeTimer / 0.3);
      this.shakeOffset.set(
        (Math.random() - 0.5) * strength * 2,
        (Math.random() - 0.5) * strength,
        (Math.random() - 0.5) * strength * 2,
      );
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    if (this._useOrtho) {
      this.updateOrtho(target);
    } else {
      this.updatePersp(target);
    }
  }

  /* ────── Internals ────── */

  private updateOrtho(target: THREE.Object3D): void {
    const cosP = Math.cos(this.pitch);
    const dx = this.orbitDist * Math.sin(this.yaw) * cosP;
    const dy = this.orbitHeight + this.orbitDist * Math.sin(this.pitch);
    const dz = this.orbitDist * Math.cos(this.yaw) * cosP;

    this.orthoCamera.position.set(
      target.position.x + dx + this.shakeOffset.x,
      dy + this.shakeOffset.y,
      target.position.z + dz + this.shakeOffset.z,
    );
    this.orthoCamera.lookAt(
      target.position.x + this.shakeOffset.x,
      target.position.y + 1.5 + this.shakeOffset.y,
      target.position.z + this.shakeOffset.z,
    );
  }

  private updatePersp(target: THREE.Object3D): void {
    const cosP = Math.cos(this.pitch);
    const dx = this.perspDistance * Math.sin(this.yaw) * cosP;
    const dy = this.perspHeight + this.perspDistance * Math.sin(this.pitch);
    const dz = this.perspDistance * Math.cos(this.yaw) * cosP;

    this.perspectiveCamera.position.set(
      target.position.x + dx,
      dy,
      target.position.z + dz,
    );
    this.perspectiveCamera.lookAt(
      target.position.x, target.position.y + 1.5, target.position.z,
    );
  }

  private setOrthoFrustum(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const half = this.frustumSize / 2;
    this.orthoCamera.left = -half * aspect;
    this.orthoCamera.right = half * aspect;
    this.orthoCamera.top = half;
    this.orthoCamera.bottom = -half;
    this.orthoCamera.updateProjectionMatrix();
  }

  /* ────── Input ────── */

  private setupControls(): void {
    // Bind handlers once so they can be removed in dispose()
    this._onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (this._useOrtho) {
        this.frustumSize = Math.max(8, Math.min(60, this.frustumSize + e.deltaY * 0.04));
        this.setOrthoFrustum();
      } else {
        this.perspDistance = Math.max(6, Math.min(30, this.perspDistance + e.deltaY * 0.02));
      }
    };

    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleMode();
      }
    };

    this._onContextMenu = (e: Event) => e.preventDefault();

    this._onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || e.button === 2) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    };

    this._onMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || e.button === 2) {
        this.isDragging = false;
      }
    };

    this._onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };

      this.yaw -= dx * 0.005;
      this.pitch = Math.max(-0.4, Math.min(1.35, this.pitch + dy * 0.005));
      this.targetYaw = null;
    };

    this._onResize = () => {
      const aspect = window.innerWidth / window.innerHeight;
      this.perspectiveCamera.aspect = aspect;
      this.perspectiveCamera.updateProjectionMatrix();
      this.setOrthoFrustum();
    };

    window.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('resize', this._onResize);
  }

  /** Remove all window event listeners. */
  dispose(): void {
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('resize', this._onResize);
  }
}
