import * as THREE from 'three';
import type { BossData, BossAttack, BossPhase } from '../types/equipment';

export type BossState = 'IDLE' | 'WARNING' | 'ATTACK' | 'RECOVERY' | 'WEAKNESS' | 'PHASE_TRANSITION';

export interface ActiveAttack {
  attack: BossAttack;
  warningTimer: number;
  warningMesh: THREE.Mesh | null;
  center: THREE.Vector3;
  facing: number; // radians, direction the BOSS faces for fan attacks
}

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  distanceTravelled: number;
  maxDistance: number;
}

export interface AttackResult {
  type: 'hit' | 'miss' | 'dodged';
  damage: number;
}

/**
 * BossAI — state machine for BOSS behavior.
 * IDLE → WARNING(0.8-1.2s) → ATTACK(resolve) → RECOVERY(1.5s) → IDLE
 *                                    ↓ (player dodges)
 *                               WEAKNESS(2s) → IDLE
 */
export class BossAI {
  private data: BossData;
  private state: BossState = 'IDLE';
  private currentPhase: BossPhase;
  private activeAttack: ActiveAttack | null = null;
  private attackTimer = 0;
  private stateTimer = 0;
  private lastAttackIndex = -1;
  private scene: THREE.Scene | null = null;

  // Attack interval decreases slightly in later phases
  private baseAttackInterval = 2.5;

  // Stun & attack speed modifiers
  private stunTimer = 0;
  private attackIntervalMultiplier = 1;
  private attackIntervalModEnd = 0;
  private time = 0;

  // Flying projectiles (for 'line' type attacks)
  private projectiles: Projectile[] = [];
  private static readonly PROJECTILE_SPEED = 14; // world units/sec
  private static readonly PROJECTILE_HIT_RADIUS = 0.8;
  private projectileHitCallback: ((damage: number) => void) | null = null;

  // Pending burst shots: remaining after the first
  private burstQueue: Array<{ delay: number; origin: THREE.Vector3; facing: number; damage: number }> = [];

  constructor(data: BossData) {
    this.data = data;
    if (data.phases.length === 0) {
      throw new Error(`BossData "${data.id}" has no phases defined`);
    }
    this.currentPhase = data.phases[0];
  }

  /** Set the scene reference for adding/removing warning geometry. */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /** Register a callback for when a projectile hits the player. */
  onProjectileHit(cb: (damage: number) => void): void {
    this.projectileHitCallback = cb;
  }

  /** L2 弹力反震: stun the BOSS, forcing recovery. */
  stun(duration: number): void {
    this.clearWarning();
    this.state = 'RECOVERY';
    this.stateTimer = duration;
    this.stunTimer = duration;
  }

  /** L2 摩擦场: slow BOSS attack interval by a multiplier for duration. */
  setAttackIntervalMultiplier(mult: number, duration: number): void {
    this.attackIntervalMultiplier = mult;
    this.attackIntervalModEnd = duration;
  }

  /** Update AI state machine. Returns ActiveAttack if warning is active. */
  update(dt: number, bossPos: THREE.Vector3, playerPos: THREE.Vector3): {
    state: BossState;
    activeAttack: ActiveAttack | null;
    phaseIndex: number;
  } {
    this.time += dt;
    switch (this.state) {
      case 'IDLE':
        this.updateIdle(dt, bossPos, playerPos);
        break;
      case 'WARNING':
        this.updateWarning(dt, bossPos, playerPos);
        break;
      case 'ATTACK':
        this.updateAttack(dt, playerPos);
        break;
      case 'RECOVERY':
        this.updateRecovery(dt);
        break;
      case 'WEAKNESS':
        this.updateWeakness(dt);
        break;
      case 'PHASE_TRANSITION':
        this.updatePhaseTransition(dt);
        break;
    }

    this.updateProjectiles(dt, playerPos);

    return {
      state: this.state,
      activeAttack: this.activeAttack,
      phaseIndex: this.currentPhase.index,
    };
  }

  /** Call when player dodges during attack window. */
  onPlayerDodge(): void {
    if (this.state === 'WARNING' && this.activeAttack) {
      // Player dodged → BOSS enters WEAKNESS
      this.clearWarning();
      this.state = 'WEAKNESS';
      this.stateTimer = 2.0;
    }
  }

  /** Call when player takes a hit during attack window. */
  onPlayerHit(): AttackResult {
    if (this.state === 'ATTACK' && this.activeAttack) {
      const damage = this.activeAttack.attack.damage;
      this.activeAttack = null;
      this.state = 'RECOVERY';
      this.stateTimer = 1.5;
      return { type: 'hit', damage };
    }
    return { type: 'miss', damage: 0 };
  }

  /** Call when attack resolves without hitting player. */
  onAttackMiss(): void {
    if (this.state === 'ATTACK' && this.activeAttack) {
      this.activeAttack = null;
      this.state = 'RECOVERY';
      this.stateTimer = 1.5;
    }
  }

  /** Update HP threshold and potentially trigger phase transition. */
  checkPhaseTransition(hpRatio: number): boolean {
    const phases = this.data.phases;
    if (phases.length <= 1) return false;

    // Find the phase we should be in based on HP ratio
    let targetPhase: BossPhase | null = null;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (hpRatio <= phases[i].triggerHP) {
        targetPhase = phases[i];
        break;
      }
    }

    if (targetPhase && targetPhase !== this.currentPhase) {
      this.clearWarning(); // dispose any active warning mesh before transitioning
      this.currentPhase = targetPhase;
      this.state = 'PHASE_TRANSITION';
      this.stateTimer = 2.0;
      return true;
    }
    return false;
  }

  /** Get current phase index. */
  getPhaseIndex(): number {
    return this.currentPhase.index;
  }

  /** Get current state name. */
  getState(): BossState {
    return this.state;
  }

  /* ────── State machine ────── */

  private updateIdle(dt: number, bossPos: THREE.Vector3, playerPos: THREE.Vector3): void {
    this.attackTimer += dt;

    // Update attack interval modifier (L2 friction field)
    if (this.attackIntervalModEnd > 0) {
      this.attackIntervalModEnd -= dt;
      if (this.attackIntervalModEnd <= 0) {
        this.attackIntervalMultiplier = 1;
      }
    }

    const interval = (this.baseAttackInterval - this.currentPhase.index * 0.3) * this.attackIntervalMultiplier;
    if (this.attackTimer >= Math.max(1.5, interval)) {
      this.attackTimer = 0;
      this.startWarning(bossPos, playerPos);
    }
  }

  private startWarning(bossPos: THREE.Vector3, playerPos: THREE.Vector3): void {
    const attacks = this.currentPhase.attacks;
    if (attacks.length === 0) return;

    // Pick random attack (not same as last)
    let idx: number;
    do {
      idx = Math.floor(Math.random() * attacks.length);
    } while (idx === this.lastAttackIndex && attacks.length > 1);
    this.lastAttackIndex = idx;

    const attack = attacks[idx];
    this.stateTimer = attack.warningTime;
    this.state = 'WARNING';

    // Create warning geometry
    const warningMesh = this.createWarningMesh(attack, bossPos, playerPos);
    if (warningMesh && this.scene) {
      this.scene.add(warningMesh);
    }
    const center = this.getAttackCenter(attack, bossPos, playerPos);

    this.activeAttack = {
      attack,
      warningTimer: attack.warningTime,
      warningMesh,
      center,
      facing: Math.atan2(playerPos.x - bossPos.x, playerPos.z - bossPos.z),
    };
  }

  private createWarningMesh(attack: BossAttack, bossPos: THREE.Vector3, playerPos: THREE.Vector3): THREE.Mesh | null {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    switch (attack.warningType) {
      case 'fan': {
        const angle = (attack.warningAngle ?? 90) * (Math.PI / 180);
        const range = attack.warningRange ?? 5;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        const steps = 16;
        for (let i = 0; i <= steps; i++) {
          const a = -angle / 2 + (angle * i / steps);
          shape.lineTo(Math.cos(a) * range, Math.sin(a) * range);
        }
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(bossPos.x, 0.05, bossPos.z);
        mesh.rotation.z = -this.getFacingAngle(bossPos, playerPos) + Math.PI / 2;
        return mesh;
      }
      case 'circle': {
        const radius = attack.warningRadius ?? 3;
        const geo = new THREE.RingGeometry(radius - 0.2, radius, 48);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        const center = this.getAttackCenter(attack, bossPos, playerPos);
        mesh.position.set(center.x, 0.05, center.z);
        return mesh;
      }
      case 'line': {
        const length = 12;
        const geo = new THREE.PlaneGeometry(0.8, length);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(bossPos.x, 0.05, bossPos.z);
        const angle = this.getFacingAngle(bossPos, playerPos);
        mesh.rotation.z = -angle + Math.PI / 2;
        return mesh;
      }
      default:
        return null;
    }
  }

  private getAttackCenter(attack: BossAttack, bossPos: THREE.Vector3, playerPos: THREE.Vector3): THREE.Vector3 {
    switch (attack.warningType) {
      case 'circle':
        // Circle targets player position
        return new THREE.Vector3(playerPos.x, 0, playerPos.z);
      default:
        return new THREE.Vector3(bossPos.x, 0, bossPos.z);
    }
  }

  private getFacingAngle(from: THREE.Vector3, to: THREE.Vector3): number {
    return Math.atan2(to.x - from.x, to.z - from.z);
  }

  private updateWarning(dt: number, bossPos: THREE.Vector3, playerPos: THREE.Vector3): void {
    if (!this.activeAttack) return;
    this.stateTimer -= dt;
    this.activeAttack.warningTimer -= dt;

    // Pulse warning opacity
    if (this.activeAttack.warningMesh) {
      const mat = this.activeAttack.warningMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.sin(this.time * 1000 * 0.012) * 0.15;
    }

    if (this.stateTimer <= 0) {
      // Warning expired → resolve attack
      this.resolveAttack(bossPos, playerPos);
    }
  }

  private resolveAttack(bossPos: THREE.Vector3, playerPos: THREE.Vector3): void {
    if (!this.activeAttack) {
      this.state = 'RECOVERY';
      this.stateTimer = 1.5;
      return;
    }

    const attack = this.activeAttack;

    // Remove and dispose warning mesh
    if (attack.warningMesh) {
      if (this.scene) this.scene.remove(attack.warningMesh);
      attack.warningMesh.geometry.dispose();
      (attack.warningMesh.material as THREE.Material).dispose();
    }

    // Line attacks become flying projectiles instead of instant hits
    if (attack.attack.warningType === 'line' && this.scene) {
      this.spawnProjectile(bossPos, attack.facing, attack.attack.damage);
      // Queue remaining burst shots
      const burst = attack.attack.burstCount ?? 1;
      const delay = attack.attack.burstDelay ?? 0.4;
      for (let i = 1; i < burst; i++) {
        this.burstQueue.push({
          delay: delay * i,
          origin: bossPos.clone(),
          facing: attack.facing,
          damage: attack.attack.damage,
        });
      }
      this.activeAttack = null;
      this.state = 'RECOVERY';
      this.stateTimer = 1.5;
      return;
    }

    // Non-line: instant hit check
    const hit = this.checkHit(attack, bossPos, playerPos);
    if (hit) {
      this.state = 'ATTACK';
      this.stateTimer = 0.15;
    } else {
      this.activeAttack = null;
      this.state = 'RECOVERY';
      this.stateTimer = 1.5;
    }
  }

  private spawnProjectile(origin: THREE.Vector3, facing: number, damage: number): void {
    const geo = new THREE.BoxGeometry(0.4, 0.4, 1.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4411 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(origin.x, 1.5, origin.z);
    mesh.rotation.y = -facing;
    this.scene!.add(mesh);

    const velocity = new THREE.Vector3(
      Math.sin(facing) * BossAI.PROJECTILE_SPEED,
      0,
      Math.cos(facing) * BossAI.PROJECTILE_SPEED,
    );

    this.projectiles.push({ mesh, velocity, damage, distanceTravelled: 0, maxDistance: 18 });
  }

  private updateProjectiles(dt: number, playerPos: THREE.Vector3): void {
    // Tick burst queue
    for (const b of this.burstQueue) {
      b.delay -= dt;
    }
    const fired = this.burstQueue.filter(b => b.delay <= 0);
    for (const b of fired) {
      if (this.scene) this.spawnProjectile(b.origin, b.facing, b.damage);
      this.burstQueue.splice(this.burstQueue.indexOf(b), 1);
    }

    const toRemove: Projectile[] = [];

    for (const p of this.projectiles) {
      const step = p.velocity.clone().multiplyScalar(dt);
      p.mesh.position.add(step);
      p.distanceTravelled += step.length();

      // Hit check vs player
      const dx = p.mesh.position.x - playerPos.x;
      const dz = p.mesh.position.z - playerPos.z;
      if (Math.sqrt(dx * dx + dz * dz) < BossAI.PROJECTILE_HIT_RADIUS) {
        this.projectileHitCallback?.(p.damage);
        toRemove.push(p);
        continue;
      }

      // Max range reached
      if (p.distanceTravelled >= p.maxDistance) {
        toRemove.push(p);
      }
    }

    for (const p of toRemove) {
      if (this.scene) this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      this.projectiles.splice(this.projectiles.indexOf(p), 1);
    }
  }

  private checkHit(active: ActiveAttack, bossPos: THREE.Vector3, playerPos: THREE.Vector3): boolean {
    const px = playerPos.x;
    const pz = playerPos.z;

    switch (active.attack.warningType) {
      case 'fan': {
        const range = active.attack.warningRange ?? 5;
        const halfAngle = ((active.attack.warningAngle ?? 90) / 2) * (Math.PI / 180);
        const dx = px - bossPos.x;
        const dz = pz - bossPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > range) return false;
        const angle = Math.atan2(dx, dz);
        let diff = angle - active.facing;
        // Normalize angle
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return Math.abs(diff) < halfAngle;
      }
      case 'circle': {
        const radius = active.attack.warningRadius ?? 3;
        const cx = active.center.x;
        const cz = active.center.z;
        return Math.sqrt((px - cx) ** 2 + (pz - cz) ** 2) < radius;
      }
      case 'line': {
        const length = 12;
        const dx = px - bossPos.x;
        const dz = pz - bossPos.z;
        // Line goes from BOSS toward player's facing direction
        const cosA = Math.cos(active.facing);
        const sinA = Math.sin(active.facing);
        // Project player onto line direction
        const proj = dx * sinA + dz * cosA;
        const perp = Math.abs(dx * cosA - dz * sinA);
        return proj > 0 && proj < length && perp < 0.5;
      }
      default:
        return false;
    }
  }

  private updateAttack(dt: number, playerPos: THREE.Vector3): void {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.activeAttack = null;
      this.state = 'RECOVERY';
      this.stateTimer = 1.5;
    }
  }

  private updateRecovery(dt: number): void {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = 'IDLE';
      this.attackTimer = 0;
    }
  }

  private updateWeakness(dt: number): void {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = 'IDLE';
      this.attackTimer = 0;
    }
  }

  private updatePhaseTransition(dt: number): void {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = 'IDLE';
      this.attackTimer = 0;
    }
  }

  private clearWarning(): void {
    if (this.activeAttack?.warningMesh) {
      if (this.scene) this.scene.remove(this.activeAttack.warningMesh);
      this.activeAttack.warningMesh.geometry.dispose();
      (this.activeAttack.warningMesh.material as THREE.Material).dispose();
    }
    this.activeAttack = null;
    this.burstQueue.length = 0;
  }

  /** Clean up warning meshes and projectiles from scene. */
  cleanup(scene: THREE.Scene): void {
    if (this.activeAttack?.warningMesh) {
      scene.remove(this.activeAttack.warningMesh);
      this.activeAttack.warningMesh.geometry.dispose();
      (this.activeAttack.warningMesh.material as THREE.Material).dispose();
      this.activeAttack.warningMesh = null;
    }
    this.burstQueue.length = 0;
    for (const p of this.projectiles) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.projectiles = [];
  }
}
