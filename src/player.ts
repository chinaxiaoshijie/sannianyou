import * as THREE from 'three';

const MOVE_SPEED = 15;
const PLAYER_RADIUS = 0.5;

// Toon gradient for character
const toonCanvas = document.createElement('canvas');
toonCanvas.width = 4; toonCanvas.height = 1;
const tc = toonCanvas.getContext('2d')!;
tc.fillStyle = '#333'; tc.fillRect(0,0,1,1);
tc.fillStyle = '#999'; tc.fillRect(1,0,1,1);
tc.fillStyle = '#eee'; tc.fillRect(2,0,1,1);
tc.fillStyle = '#fff'; tc.fillRect(3,0,1,1);
const toonGrad = new THREE.CanvasTexture(toonCanvas);
toonGrad.minFilter = THREE.NearestFilter;
toonGrad.magFilter = THREE.NearestFilter;
const toonOpts = (color: number) => ({ color, gradientMap: toonGrad } as const);

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  interact: boolean;
}

export class Player {
  mesh: THREE.Group;
  velocity = new THREE.Vector3();
  
  // Animation refs
  private body!: THREE.Mesh;
  private leftArm!: THREE.Group;
  private rightArm!: THREE.Group;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private walkDistance = 0;

  // Hit flash + invincibility
  private flashTimer = 0;
  private flashDuration = 0.3;
  private invincible = false;
  private invincibleTimer = 0;
  private invincibleDuration = 1.0;

  // Speed buff (L3 惯性闪避)
  private speedMultiplier = 1;
  private speedBuffTimer = 0;

  /** L3 惯性闪避: set speed multiplier for duration. */
  setSpeedMultiplier(mult: number, duration: number): void {
    this.speedMultiplier = mult;
    this.speedBuffTimer = duration;
  }

  /** Get current max speed (accounting for buffs). */
  get effectiveSpeed(): number {
    return MOVE_SPEED * this.speedMultiplier;
  }

  constructor() {
    this.mesh = this.createModel();
    // Spawn at gate entrance (z=-69), safely outside library BOSS trigger (x=74, z=-35)
    this.mesh.position.set(64, 0, -69);
  }

  /* ────── Low-poly character model (Kenney-style) ────── */
  private createModel(): THREE.Group {
    const g = new THREE.Group();

    // ── Torso (rounded box-like cylinder) ──
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.28, 0.8, 8);
    const bodyMat = new THREE.MeshToonMaterial(toonOpts(0x2244aa));
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    this.body = body;
    g.add(body);

    // ── Belt / waist detail ──
    const beltGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.08, 8);
    const beltMat = new THREE.MeshToonMaterial(toonOpts(0x332211));
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.y = 0.72;
    g.add(belt);

    // ── Head ──
    const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
    // Slightly flatten the top
    const headPositions = headGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < headPositions.count; i++) {
      const y = headPositions.getY(i);
      if (y > 0.1) headPositions.setY(i, y * 0.85);
    }
    headGeo.computeVertexNormals();
    const headMat = new THREE.MeshToonMaterial(toonOpts(0xffcc99));
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.35;
    g.add(head);

    // ── Eyes ──
    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.09, 1.38, 0.23);
    g.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.09, 1.38, 0.23);
    g.add(rightEye);

    // ── Hair (cap) ──
    const hairGeo = new THREE.SphereGeometry(0.29, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hairMat = new THREE.MeshToonMaterial(toonOpts(0x222222));
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.38;
    g.add(hair);

    // ── Legs ──
    const legGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.6, 6);
    const legMat = new THREE.MeshToonMaterial(toonOpts(0x333355));

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.12, 0.3, 0);
    this.leftLeg = leftLeg;
    g.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.12, 0.3, 0);
    this.rightLeg = rightLeg;
    g.add(rightLeg);

    // ── Shoes ──
    const shoeGeo = new THREE.BoxGeometry(0.14, 0.08, 0.2);
    const shoeMat = new THREE.MeshToonMaterial(toonOpts(0x442211));

    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.12, 0.04, 0.03);
    g.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0.12, 0.04, 0.03);
    g.add(rightShoe);

    // ── Arms (wrapped in pivot groups for shoulder swing) ──
    const armGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.55, 6);
    const armMat = new THREE.MeshToonMaterial(toonOpts(0x2244aa));
    const handGeo = new THREE.SphereGeometry(0.07, 6, 4);
    const handMat = new THREE.MeshToonMaterial(toonOpts(0xffcc99));

    // Left arm pivot
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.33, 1.15, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, armMat);
    leftArmMesh.position.y = -0.275;
    leftArmGroup.add(leftArmMesh);
    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.position.y = -0.55;
    leftArmGroup.add(leftHand);
    leftArmGroup.rotation.z = 0.15;
    this.leftArm = leftArmGroup;
    g.add(leftArmGroup);

    // Right arm pivot
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.33, 1.15, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, armMat);
    rightArmMesh.position.y = -0.275;
    rightArmGroup.add(rightArmMesh);
    const rightHand = new THREE.Mesh(handGeo, handMat);
    rightHand.position.y = -0.55;
    rightArmGroup.add(rightHand);
    rightArmGroup.rotation.z = -0.15;
    this.rightArm = rightArmGroup;
    g.add(rightArmGroup);

    return g;
  }

  /* ────── Movement & collision ────── */
  update(dt: number, input: InputState, buildingBoxes: THREE.Box3[]) {
    // Update speed buff timer (L3, even when idle)
    if (this.speedBuffTimer > 0) {
      this.speedBuffTimer -= dt;
      if (this.speedBuffTimer <= 0) {
        this.speedMultiplier = 1;
      }
    }

    // Update hit flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const t = this.flashTimer / this.flashDuration;
      // Pulsing white overlay
      const flashAlpha = t > 0.5 ? (1 - t) * 2 : t * 2;
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshToonMaterial) {
          child.material.emissive?.setHex(0xffffff);
          child.material.emissiveIntensity = flashAlpha;
        }
      });
      if (this.flashTimer <= 0) {
        this.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshToonMaterial) {
            child.material.emissiveIntensity = 0;
          }
        });
      }
    }

    // Update invincibility
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
      }
    }

    const moveDir = new THREE.Vector3(0, 0, 0);

    if (input.forward) moveDir.z -= 1;
    if (input.backward) moveDir.z += 1;
    if (input.left) moveDir.x -= 1;
    if (input.right) moveDir.x += 1;

    if (moveDir.lengthSq() < 0.001) {
      this.velocity.set(0, 0, 0);
      // Return to idle pose
      this.body.position.y = 0.75;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.walkDistance = 0;
      return;
    }

    moveDir.normalize();

    const speed = this.effectiveSpeed;
    const displacement = moveDir.multiplyScalar(speed * dt);
    this.walkDistance += speed * dt;

    // ── Walk animation ──
    const bob = Math.sin(this.walkDistance * 4) * 0.06;
    this.body.position.y = 0.75 + bob;
    const armSwing = Math.sin(this.walkDistance * 4) * 0.5;
    this.leftArm.rotation.x = armSwing;
    this.rightArm.rotation.x = -armSwing;

    // Try X movement
    const newX = this.mesh.position.x + displacement.x;
    const clampedX = Math.max(0, Math.min(128, newX));
    if (!this.collidesAt(clampedX, this.mesh.position.z, buildingBoxes)) {
      this.mesh.position.x = clampedX;
    }

    // Try Z movement
    const newZ = this.mesh.position.z + displacement.z;
    const clampedZ = Math.max(-72, Math.min(0, newZ));
    if (!this.collidesAt(this.mesh.position.x, clampedZ, buildingBoxes)) {
      this.mesh.position.z = clampedZ;
    }

    // Face movement direction
    const angle = Math.atan2(displacement.x, displacement.z);
    this.mesh.rotation.y = angle;
  }

  /** Trigger hit flash + invincibility. Returns false if already invincible. */
  flashHit(): boolean {
    if (this.invincible) return false;
    this.flashTimer = this.flashDuration;
    this.invincible = true;
    this.invincibleTimer = this.invincibleDuration;
    return true;
  }

  get isInvincible(): boolean {
    return this.invincible;
  }

  private collidesAt(x: number, z: number, boxes: THREE.Box3[]): boolean {
    const playerMin = new THREE.Vector3(x - PLAYER_RADIUS, 0, z - PLAYER_RADIUS);
    const playerMax = new THREE.Vector3(x + PLAYER_RADIUS, 2, z + PLAYER_RADIUS);
    const playerBox = new THREE.Box3(playerMin, playerMax);

    for (const box of boxes) {
      if (playerBox.intersectsBox(box)) {
        return true;
      }
    }
    return false;
  }
}
