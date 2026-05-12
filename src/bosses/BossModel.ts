import * as THREE from 'three';
import type { BossData } from '../types/equipment';

/**
 * BossModel — Monument Valley geometric BOSS: 「遗忘·残卷」
 * Floating book + glowing core + orbiting paper scraps.
 */
export class BossModel {
  group: THREE.Group;
  private body: THREE.Mesh;
  private core: THREE.Mesh;
  private coreLight: THREE.PointLight;
  private papers: THREE.Mesh[] = [];
  private flashOverlay: THREE.Mesh | null = null;
  private flashTimer = 0;
  private phaseTransition = false;
  private phaseTransitionTimer = 0;
  private hpBarSprite: THREE.Sprite;
  private hpBarCanvas: HTMLCanvasElement;
  private wireframeTimer = 0;
  private wireframeActive = false;
  private pushBackVel = new THREE.Vector3();
  private pushBackTimer = 0;

  constructor(data: BossData, position = new THREE.Vector3(0, 0, 0)) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // ── Book body ──
    const bodyGeo = new THREE.BoxGeometry(4, 3, 1);
    const bodyMat = new THREE.MeshToonMaterial({
      color: 0xd4a574,
      transparent: true,
      opacity: 0.9,
    });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 2.5;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Book cover plates (darker, slightly larger)
    const coverGeo = new THREE.BoxGeometry(4.1, 3.1, 0.15);
    const coverMat = new THREE.MeshToonMaterial({ color: 0x8b5e3c });
    const frontCover = new THREE.Mesh(coverGeo, coverMat);
    frontCover.position.set(0, 2.5, 0.5);
    this.group.add(frontCover);
    const backCover = new THREE.Mesh(coverGeo, coverMat);
    backCover.position.set(0, 2.5, -0.5);
    this.group.add(backCover);

    // Spine
    const spineGeo = new THREE.BoxGeometry(0.3, 3.05, 1.05);
    const spineMat = new THREE.MeshToonMaterial({ color: 0x6b4226 });
    const spine = new THREE.Mesh(spineGeo, spineMat);
    spine.position.set(-2.05, 2.5, 0);
    this.group.add(spine);

    // ── Glowing core (sphere at center of book) ──
    const coreGeo = new THREE.SphereGeometry(0.4, 12, 8);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xff8844,
      transparent: true,
      opacity: 0.85,
    });
    this.core = new THREE.Mesh(coreGeo, coreMat);
    this.core.position.set(0, 2.5, 0);
    this.group.add(this.core);

    // Point light for core glow
    this.coreLight = new THREE.PointLight(0xff8844, 2, 8);
    this.coreLight.position.copy(this.core.position);
    this.group.add(this.coreLight);

    // ── Paper scraps (20 orbiting pieces) ──
    const paperGeo = new THREE.BoxGeometry(0.3, 0.4, 0.02);
    const paperMat = new THREE.MeshToonMaterial({
      color: 0xf5f0e8,
      transparent: true,
      opacity: 0.7,
    });

    for (let i = 0; i < 20; i++) {
      const paper = new THREE.Mesh(paperGeo, paperMat.clone());
      const angle = (i / 20) * Math.PI * 2;
      const radius = 3 + Math.random() * 1.5;
      const height = 1 + Math.random() * 3;
      paper.userData.orbitAngle = angle;
      paper.userData.orbitRadius = radius;
      paper.userData.orbitSpeed = 0.3 + Math.random() * 0.4;
      paper.userData.orbitHeight = height;
      paper.userData.wobble = Math.random() * Math.PI * 2;
      this.papers.push(paper);
      this.group.add(paper);
    }

    // ── Flash overlay (hidden by default) ──
    const flashGeo = new THREE.BoxGeometry(4.2, 3.2, 1.2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.flashOverlay = new THREE.Mesh(flashGeo, flashMat);
    this.flashOverlay.position.y = 2.5;
    this.group.add(this.flashOverlay);

    // Name tag (sprite)
    const nameSprite = this.createNameSprite(data.name);
    nameSprite.position.set(0, 4.5, 0);
    this.group.add(nameSprite);

    // HP bar sprite (below name)
    this.hpBarCanvas = document.createElement('canvas');
    this.hpBarCanvas.width = 256;
    this.hpBarCanvas.height = 24;
    const hpTexture = new THREE.CanvasTexture(this.hpBarCanvas);
    hpTexture.minFilter = THREE.LinearFilter;
    this.hpBarSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: hpTexture, transparent: true, depthTest: false })
    );
    this.hpBarSprite.position.set(0, 3.8, 0);
    this.hpBarSprite.scale.set(5, 0.5, 1);
    this.group.add(this.hpBarSprite);
    this.drawHpBar(1); // full HP initially
  }

  private createNameSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#ff8844';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff6622';
    ctx.shadowBlur = 12;
    ctx.fillText(text, 256, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
    );
    sprite.scale.set(6, 0.75, 1);
    return sprite;
  }

  /** Trigger white flash on hit. */
  flash(): void {
    this.flashTimer = 0.15;
    if (this.flashOverlay) {
      (this.flashOverlay.material as THREE.MeshBasicMaterial).opacity = 0.9;
    }
  }

  /** L0 质点聚焦: toggle core wireframe mode for duration. */
  setCoreWireframe(enabled: boolean, duration: number): void {
    const coreMat = this.core.material as THREE.MeshBasicMaterial;
    if (enabled) {
      this.wireframeActive = true;
      this.wireframeTimer = duration;
      coreMat.wireframe = true;
      coreMat.opacity = 0.6;
    } else {
      this.wireframeActive = false;
      this.wireframeTimer = 0;
      coreMat.wireframe = false;
      coreMat.opacity = 0.85;
    }
  }

  /** L2 弹力反震: push BOSS back from a direction. */
  pushBack(from: THREE.Vector3, distance: number): void {
    const dir = new THREE.Vector3()
      .subVectors(this.group.position, from)
      .setY(0)
      .normalize();
    this.pushBackVel.copy(dir).multiplyScalar(distance);
    this.pushBackTimer = 0.5;
  }
  /** Trigger phase transition animation. */
  triggerPhaseTransition(): void {
    this.phaseTransition = true;
    this.phaseTransitionTimer = 1.0;
  }

  /** Update animations. Call every frame with dt. */
  update(dt: number): void {
    // Book slow rotation
    this.body.rotation.y += dt * 0.15;

    // Core pulse
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.15;
    this.core.scale.setScalar(pulse);
    this.coreLight.intensity = 1.5 + Math.sin(Date.now() * 0.003) * 0.5;

    // Paper orbit
    for (const paper of this.papers) {
      const d = paper.userData;
      d.orbitAngle += dt * d.orbitSpeed;
      d.wobble += dt * 1.5;
      paper.position.set(
        Math.cos(d.orbitAngle) * d.orbitRadius,
        d.orbitHeight + Math.sin(d.wobble) * 0.3,
        Math.sin(d.orbitAngle) * d.orbitRadius,
      );
      paper.rotation.y = d.orbitAngle + Math.PI / 2;
      paper.rotation.x = Math.sin(d.wobble) * 0.2;
    }

    // Flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashOverlay) {
        (this.flashOverlay.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, this.flashTimer / 0.15) * 0.9;
      }
    }

    // Phase transition
    if (this.phaseTransition) {
      this.phaseTransitionTimer -= dt;
      const t = this.phaseTransitionTimer;
      const crack = 1 + Math.sin(t * 20) * 0.1 * t;
      this.body.scale.setScalar(crack);
      if (t <= 0) {
        this.phaseTransition = false;
        this.body.scale.setScalar(1);
      }
    }

    // Wireframe timer (L0)
    if (this.wireframeActive) {
      this.wireframeTimer -= dt;
      if (this.wireframeTimer <= 0) {
        this.setCoreWireframe(false, 0);
      }
    }

    // Push back (L2)
    if (this.pushBackTimer > 0) {
      this.pushBackTimer -= dt;
      const step = this.pushBackVel.clone().multiplyScalar(dt / 0.5);
      this.group.position.add(step);
      if (this.pushBackTimer <= 0) {
        this.pushBackVel.set(0, 0, 0);
      }
    }
  }

  /** Reposition the BOSS. */
  setPosition(x: number, z: number): void {
    this.group.position.set(x, 0, z);
  }

  /** Get BOSS position. */
  getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  /** Apply damage scale based on HP ratio (0-1). */
  setHealthRatio(ratio: number): void {
    // Subtle shrink as HP decreases
    const s = 0.7 + 0.3 * ratio;
    this.body.scale.setScalar(s);
    this.core.scale.setScalar(s * (1 + Math.sin(Date.now() * 0.005) * 0.15));
    // Core gets redder as HP drops
    const r = 1.0;
    const g = 0.53 * ratio;
    const b = 0.27 * ratio;
    (this.core.material as THREE.MeshBasicMaterial).color.setRGB(r, g, b);
    this.coreLight.color.setRGB(r, g, b);
    // Update 3D HP bar
    this.drawHpBar(ratio);
  }

  private drawHpBar(ratio: number): void {
    const canvas = this.hpBarCanvas;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    // HP fill
    const fillW = Math.max(0, Math.floor((w - 4) * ratio));
    if (fillW > 0) {
      const gradient = ctx.createLinearGradient(2, 0, fillW, 0);
      if (ratio > 0.5) {
        gradient.addColorStop(0, '#4ade80');
        gradient.addColorStop(1, '#22c55e');
      } else if (ratio > 0.25) {
        gradient.addColorStop(0, '#fbbf24');
        gradient.addColorStop(1, '#f59e0b');
      } else {
        gradient.addColorStop(0, '#ef4444');
        gradient.addColorStop(1, '#dc2626');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(2, 2, fillW, h - 4);
    }

    // Border
    ctx.strokeStyle = 'rgba(200,168,78,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // Update texture
    (this.hpBarSprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }

  /** Destroy resources. */
  dispose(): void {
    const seenGeometries = new Set<THREE.BufferGeometry>();
    const seenMaterials = new Set<THREE.Material>();

    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        // Dispose texture on sprite materials (e.g. CanvasTexture from name sprite)
        if (child.material?.map && !seenMaterials.has(child.material.map as THREE.Material)) {
          child.material.map.dispose();
        }
        if (child instanceof THREE.Mesh) {
          if (!seenGeometries.has(child.geometry)) {
            seenGeometries.add(child.geometry);
            child.geometry.dispose();
          }
        }
        if (Array.isArray(child.material)) {
          for (const m of child.material) {
            if (!seenMaterials.has(m)) {
              seenMaterials.add(m);
              m.dispose();
            }
          }
        } else if (!seenMaterials.has(child.material)) {
          seenMaterials.add(child.material);
          child.material.dispose();
        }
      }
    });
  }
}
