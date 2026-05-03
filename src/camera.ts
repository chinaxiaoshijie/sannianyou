import * as THREE from 'three';

export class ThirdPersonCamera {
  camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private pitch = 0.35;
  private distance = 14;
  private height = 8;
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };

  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, this.height, this.distance);

    this.setupControls();
  }

  update(target: THREE.Object3D) {
    // Compute camera position from spherical coords around target
    const dx = this.distance * Math.sin(this.yaw) * Math.cos(this.pitch);
    const dy = this.height + this.distance * Math.sin(this.pitch);
    const dz = this.distance * Math.cos(this.yaw) * Math.cos(this.pitch);

    this.camera.position.set(
      target.position.x + dx,
      dy,
      target.position.z + dz
    );
    this.camera.lookAt(target.position.x, target.position.y + 1.5, target.position.z);
  }

  private setupControls() {
    window.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.distance = Math.max(8, Math.min(25, this.distance + e.deltaY * 0.02));
    }, { passive: false });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 2) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 2) {
        this.isDragging = false;
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };

      this.yaw -= dx * 0.005;
      this.pitch = Math.max(-0.5, Math.min(1.2, this.pitch + dy * 0.005));
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }
}
