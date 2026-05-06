import * as THREE from 'three';
import type { Law } from '../../types/equipment';

/** Active visual effect instance. */
interface ActiveEffect {
  meshes: THREE.Object3D[];
  elapsed: number;
  duration: number;
  update: (dt: number, elapsed: number) => void;
}

/**
 * LawEffects — creates and manages Three.js visual effects
 * for activated laws during combat.
 */
export class LawEffects {
  private scene: THREE.Scene;
  private activeEffects: ActiveEffect[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Play a visual effect for the given law at the specified positions. */
  play(law: Law, bossPos: THREE.Vector3, playerPos: THREE.Vector3): void {
    const effect = this.createEffect(law, bossPos, playerPos);
    if (effect) {
      this.activeEffects.push(effect);
    }
  }

  /** Update all active effects. Call every frame with dt. */
  update(dt: number): void {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const eff = this.activeEffects[i];
      eff.elapsed += dt;
      eff.update(dt, eff.elapsed);

      if (eff.elapsed >= eff.duration) {
        this.disposeEffect(eff);
        this.activeEffects.splice(i, 1);
      }
    }
  }

  /** Remove all effects and dispose resources. */
  dispose(): void {
    for (const eff of this.activeEffects) {
      this.disposeEffect(eff);
    }
    this.activeEffects = [];
  }

  /* ────── Effect Creation ────── */

  private createEffect(
    law: Law,
    bossPos: THREE.Vector3,
    playerPos: THREE.Vector3,
  ): ActiveEffect | null {
    switch (law.effectType) {
      case 'visualInfo': return this.createVisualInfo(law, bossPos);
      case 'prediction': return this.createPrediction(law, bossPos);
      case 'aoe': return this.createAoe(law, bossPos, playerPos);
      case 'counter': return this.createCounter(law, bossPos);
      case 'zone': return this.createZone(law, bossPos);
      case 'critical': return this.createCritical(law, bossPos);
      case 'buff': return this.createBuff(law, playerPos);
      default: return null;
    }
  }

  /** visualInfo — BOSS core wireframe highlight. */
  private createVisualInfo(law: Law, bossPos: THREE.Vector3): ActiveEffect {
    const duration = Number(law.effectParams.highlightDuration) || 5;
    const colorHex = (law.effectParams.highlightColor as string) || '#4A90D9';
    const color = new THREE.Color(colorHex);

    const ringGeo = new THREE.TorusGeometry(2.5, 0.05, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(bossPos.x, 2.5, bossPos.z);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);

    const cylGeo = new THREE.CylinderGeometry(2.5, 2.5, 4, 16, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.set(bossPos.x, 2, bossPos.z);
    this.scene.add(cyl);

    return {
      meshes: [ring, cyl],
      elapsed: 0,
      duration,
      update: (_dt: number, elapsed: number) => {
        const t = 1 - elapsed / duration;
        const pulse = 1 + Math.sin(t * Math.PI * 3) * 0.15;
        ring.scale.setScalar(pulse);
        cyl.rotation.y += _dt * 0.8;
        ringMat.opacity = 0.8 * (1 - t);
        cylMat.opacity = 0.25 * (1 - t);
      },
    };
  }

  /** prediction — ground arrows showing BOSS predicted landing spots. */
  private createPrediction(law: Law, bossPos: THREE.Vector3): ActiveEffect {
    const duration = Number(law.effectParams.predictTime) || 1.5;
    const colorHex = (law.effectParams.arrowColor as string) || '#4A90D9';
    const color = new THREE.Color(colorHex);
    const arrowLength = Number(law.effectParams.arrowLength) || 3;

    const meshes: THREE.Object3D[] = [];

    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 2;
      const arrow = createGroundArrow(color, arrowLength);
      arrow.position.set(bossPos.x + offset, 0.05, bossPos.z + offset * 0.5);
      arrow.userData.seqIndex = i;
      this.scene.add(arrow);
      meshes.push(arrow);
    }

    return {
      meshes,
      elapsed: 0,
      duration,
      update: (_dt: number, elapsed: number) => {
        const t = 1 - elapsed / duration;
        for (const arrow of meshes) {
          const idx = arrow.userData.seqIndex as number;
          const appearT = Math.max(0, Math.min(1, (t * 3 - idx)));
          arrow.scale.setScalar(appearT);
          const firstChild = arrow.children[0];
          if (firstChild instanceof THREE.Mesh) {
            firstChild.material.opacity = appearT * 0.7 * (1 - t);
          }
        }
      },
    };
  }

  /** aoe — player jumps, lands with hexagonal shockwave. */
  private createAoe(_law: Law, _bossPos: THREE.Vector3, playerPos: THREE.Vector3): ActiveEffect {
    const duration = 1.0;
    const impactRadius = 4;
    const color = new THREE.Color(0xf59e0b);

    const meshes: THREE.Object3D[] = [];

    const ringGeo = new THREE.RingGeometry(0.1, impactRadius, 6, 1);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(playerPos.x, 0.03, playerPos.z);
    this.scene.add(ring);
    meshes.push(ring);

    const hexGeo = new THREE.CircleGeometry(impactRadius * 0.5, 6);
    const hexMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const hex = new THREE.Mesh(hexGeo, hexMat);
    hex.rotation.x = -Math.PI / 2;
    hex.position.set(playerPos.x, 0.02, playerPos.z);
    this.scene.add(hex);
    meshes.push(hex);

    return {
      meshes,
      elapsed: 0,
      duration,
      update: (_dt: number, elapsed: number) => {
        const t = 1 - elapsed / duration;
        ring.scale.setScalar(t);
        ringMat.opacity = 0.7 * (1 - t);
        hexMat.opacity = t < 0.3 ? 0.3 : 0.3 * (1 - (t - 0.3) / 0.7);
      },
    };
  }

  /** counter — spring geometry + BOSS knockback visual. */
  private createCounter(law: Law, bossPos: THREE.Vector3): ActiveEffect {
    const duration = 0.8;
    const knockbackDist = Number(law.effectParams.knockbackDistance) || 5;
    const color = new THREE.Color(0x34d399);

    const meshes: THREE.Object3D[] = [];

    const spring = createSpringGeometry(1.5, 0.4, 0.1, 16, color);
    spring.position.set(bossPos.x, 1.5, bossPos.z);
    this.scene.add(spring);
    meshes.push(spring);

    const arrowGeo = new THREE.ConeGeometry(0.3, 1.5, 4);
    const arrowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(bossPos.x + knockbackDist * 0.5, 1.5, bossPos.z);
    arrow.rotation.z = Math.PI / 2;
    this.scene.add(arrow);
    meshes.push(arrow);

    return {
      meshes,
      elapsed: 0,
      duration,
      update: (_dt: number, elapsed: number) => {
        const t = 1 - elapsed / duration;
        spring.scale.y = 1 + Math.sin(t * Math.PI * 2) * 0.5;
        // Fade all spring children
        spring.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = 0.9 * (1 - t);
          }
        });
        arrow.position.x = bossPos.x + knockbackDist * t;
        arrowMat.opacity = 0.7 * (1 - t);
      },
    };
  }

  /** zone — orange hexagonal ground area. */
  private createZone(law: Law, bossPos: THREE.Vector3): ActiveEffect {
    const duration = Number(law.effectParams.duration) || 5;
    const radius = Number(law.effectParams.zoneRadius) || 6;
    const color = new THREE.Color(0xf97316);

    const meshes: THREE.Object3D[] = [];

    const hexGeo = new THREE.CircleGeometry(radius, 6);
    const hexMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const hex = new THREE.Mesh(hexGeo, hexMat);
    hex.rotation.x = -Math.PI / 2;
    hex.position.set(bossPos.x, 0.02, bossPos.z);
    this.scene.add(hex);
    meshes.push(hex);

    const edgeGeo = new THREE.RingGeometry(radius * 0.95, radius, 6);
    const edgeMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(bossPos.x, 0.03, bossPos.z);
    this.scene.add(edge);
    meshes.push(edge);

    return {
      meshes,
      elapsed: 0,
      duration,
      update: (_dt: number, elapsed: number) => {
        const t = 1 - elapsed / duration;
        const pulse = 0.8 + Math.sin(t * Math.PI * 4) * 0.2;
        hexMat.opacity = 0.3 * pulse * (1 - t * 0.5);
        edgeMat.opacity = 0.6 * pulse * (1 - t * 0.5);
        edge.rotation.z += _dt * 0.3;
      },
    };
  }

  /** critical — golden mass number above BOSS + light pillar. */
  private createCritical(law: Law, bossPos: THREE.Vector3): ActiveEffect {
    const duration = Number(law.effectParams.windowDuration) || 1.5;

    const meshes: THREE.Object3D[] = [];

    const sprite = createTextSprite('m=50kg', '#fbbf24', 48);
    sprite.position.set(bossPos.x, 5.5, bossPos.z);
    this.scene.add(sprite);
    meshes.push(sprite);

    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.3, 5, 8, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xfbbf24),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(bossPos.x, 2.5, bossPos.z);
    this.scene.add(pillar);
    meshes.push(pillar);

    return {
      meshes,
      elapsed: 0,
      duration,
      update: (_dt: number, elapsed: number) => {
        const t = 1 - elapsed / duration;
        sprite.position.y = 5.5 + Math.sin(t * Math.PI * 2) * 0.3;
        (sprite.material as THREE.SpriteMaterial).opacity = 1 - t;
        pillarMat.opacity = 0.3 * (1 - t);
        pillar.rotation.y += _dt * 1.5;
      },
    };
  }

  /** buff — blue afterimage trail behind player. */
  private createBuff(law: Law, playerPos: THREE.Vector3): ActiveEffect {
    const duration = Number(law.effectParams.duration) || 3;

    const meshes: THREE.Object3D[] = [];

    for (let i = 0; i < 3; i++) {
      const sphereGeo = new THREE.SphereGeometry(0.25 - i * 0.05, 8, 6);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x60a5fa),
        transparent: true,
        opacity: 0.5 - i * 0.15,
        depthWrite: false,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(playerPos.x - i * 0.8, 0.8, playerPos.z - i * 0.3);
      sphere.userData.trailIndex = i;
      this.scene.add(sphere);
      meshes.push(sphere);
    }

    const arrowGeo = new THREE.ConeGeometry(0.15, 0.6, 4);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x60a5fa),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(playerPos.x + 1, 0.8, playerPos.z);
    arrow.rotation.z = -Math.PI / 2;
    this.scene.add(arrow);
    meshes.push(arrow);

    return {
      meshes,
      elapsed: 0,
      duration,
      update: (_dt: number, elapsed: number) => {
        const t = 1 - elapsed / duration;
        for (const obj of meshes) {
          if (obj.userData.trailIndex !== undefined && obj instanceof THREE.Mesh) {
            const idx = obj.userData.trailIndex as number;
            const fadeIn = Math.max(0, Math.min(1, t * 3 - idx * 0.3));
            (obj.material as THREE.MeshBasicMaterial).opacity =
              (0.5 - idx * 0.15) * fadeIn * (1 - t * 0.7);
          }
        }
        arrowMat.opacity = 0.6 * (1 - t);
      },
    };
  }

  /* ────── Disposal ────── */

  private disposeEffect(eff: ActiveEffect): void {
    for (const mesh of eff.meshes) {
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
        if (child instanceof THREE.Sprite) {
          if (child.material?.map) child.material.map.dispose();
          child.material?.dispose();
        }
      });
    }
  }
}

/* ────── Helpers ────── */

function createGroundArrow(color: THREE.Color, length: number): THREE.Group {
  const group = new THREE.Group();

  const shaftGeo = new THREE.BoxGeometry(0.1, 0.05, length * 0.6);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const shaft = new THREE.Mesh(shaftGeo, mat);
  group.add(shaft);

  const headGeo = new THREE.ConeGeometry(0.25, 0.5, 4);
  const head = new THREE.Mesh(headGeo, mat.clone());
  head.position.z = -length * 0.4;
  head.rotation.x = Math.PI / 2;
  group.add(head);

  group.rotation.y = Math.PI;
  return group;
}

function createSpringGeometry(height: number, radius: number, tubeRadius: number, segments: number, color: THREE.Color): THREE.Group {
  const group = new THREE.Group();

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 4;
    const geo = new THREE.SphereGeometry(tubeRadius, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.9 });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.set(
      Math.cos(angle) * radius,
      t * height - height / 2,
      Math.sin(angle) * radius,
    );
    group.add(sphere);
  }

  return group;
}

function createTextSprite(text: string, color: string, fontSize: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  sprite.scale.set(4, 1, 1);
  return sprite;
}
