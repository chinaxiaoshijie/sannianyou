import * as THREE from 'three';

/**
 * CombatArena — Monument Valley 几何竞技场。
 * 战斗触发时升起，结束时降下消失。
 * 六边形平台 + 悬浮粒子光环 + 虚空深渊。
 */
export class CombatArena {
  private group: THREE.Group;
  private platform: THREE.Group;
  private ringMeshes: THREE.Mesh[] = [];
  private voidPlane: THREE.Mesh | null = null;
  private scene: THREE.Scene | null = null;
  private targetY = 0; // target height
  private currentY = -8; // starts underground
  private active = false;

  constructor() {
    this.group = new THREE.Group();
    this.platform = this.buildPlatform();
    this.group.add(this.platform);
    this.group.position.y = this.currentY;
    this.group.visible = false;
  }

  private buildPlatform(): THREE.Group {
    const g = new THREE.Group();

    // ── Hexagonal arena floor ──
    const floorGeo = new THREE.CylinderGeometry(10, 10, 0.3, 6);
    const floorMat = new THREE.MeshToonMaterial({ color: 0x3a3028 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.position.y = 0.15;
    g.add(floor);

    // ── Inner ring (lighter) ──
    const innerGeo = new THREE.CylinderGeometry(8.5, 8.5, 0.35, 6);
    const innerMat = new THREE.MeshToonMaterial({ color: 0x5a4a3a });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.receiveShadow = true;
    inner.position.y = 0.35;
    g.add(inner);

    // ── Border pillars (6 corners) ──
    const pillarGeo = new THREE.BoxGeometry(0.4, 1.8, 0.4);
    const pillarMat = new THREE.MeshToonMaterial({ color: 0xc8a84e });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(angle) * 9.5;
      const pz = Math.sin(angle) * 9.5;
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, 1.1, pz);
      pillar.castShadow = true;
      g.add(pillar);

      // Pillar top glow cube
      const topGeo = new THREE.BoxGeometry(0.5, 0.2, 0.5);
      const topMat = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.set(px, 2.1, pz);
      g.add(top);
    }

    return g;
  }

  /** Call after adding to scene to build the visual ring particles. */
  private buildRing(scene: THREE.Scene): void {
    const ringGroup = new THREE.Group();
    const particleGeo = new THREE.SphereGeometry(0.15, 4, 4);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xf0c860, transparent: true, opacity: 0.8 });

    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const radius = 11 + Math.random() * 1.5;
      const height = 0.5 + Math.random() * 2;
      const particle = new THREE.Mesh(particleGeo, particleMat.clone());
      particle.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      particle.userData.baseAngle = angle;
      particle.userData.baseRadius = radius;
      particle.userData.baseHeight = height;
      particle.userData.phase = Math.random() * Math.PI * 2;
      ringGroup.add(particle);
      this.ringMeshes.push(particle);
    }

    this.group.add(ringGroup);
  }

  /** Show the arena — rise animation. */
  show(scene: THREE.Scene, center: THREE.Vector3): void {
    this.scene = scene;
    this.group.position.set(center.x, this.currentY, center.z);
    this.group.visible = true;

    if (!this.voidPlane) {
      // Dark void plane below the arena
      const voidGeo = new THREE.PlaneGeometry(40, 40);
      const voidMat = new THREE.MeshBasicMaterial({ color: 0x0a0a10, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false });
      this.voidPlane = new THREE.Mesh(voidGeo, voidMat);
      this.voidPlane.rotation.x = -Math.PI / 2;
      this.voidPlane.position.y = -3;
      this.group.add(this.voidPlane);
    }

    if (this.ringMeshes.length === 0) {
      this.buildRing(scene);
    }

    if (!scene.children.includes(this.group)) {
      scene.add(this.group);
    }

    this.targetY = 0;
    this.active = true;
  }

  /** Hide the arena — sink animation. */
  hide(): void {
    this.targetY = -8;
    this.active = false;

    // Remove from scene after animation
    setTimeout(() => {
      if (this.scene && this.scene.children.includes(this.group)) {
        this.scene.remove(this.group);
        this.scene = null;
      }
      this.group.visible = false;
    }, 800);
  }

  /** Animate every frame. Returns true while active. */
  update(dt: number): boolean {
    if (!this.active && this.currentY <= -7.9) return false;

    // Smooth rise/fall
    const lerpSpeed = 4;
    this.currentY += (this.targetY - this.currentY) * Math.min(1, lerpSpeed * dt);
    this.group.position.y = this.currentY;

    // Ring particle orbit
    const time = Date.now() * 0.001;
    for (const p of this.ringMeshes) {
      const d = p.userData;
      const angle = d.baseAngle + time * 0.3 + d.phase;
      p.position.x = Math.cos(angle) * d.baseRadius;
      p.position.z = Math.sin(angle) * d.baseRadius;
      p.position.y = d.baseHeight + Math.sin(time * 2 + d.phase) * 0.4;
      (p.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time * 3 + d.phase) * 0.3;
    }

    return this.active || this.currentY > -7.9;
  }

  /** Get the platform group for adding BOSS/player to. */
  getGroup(): THREE.Group {
    return this.group;
  }

  /** Clean up resources. */
  dispose(): void {
    if (this.scene && this.scene.children.includes(this.group)) {
      this.scene.remove(this.group);
    }
    this.ringMeshes.length = 0;
    this.voidPlane = null;
    this.scene = null;
  }
}
