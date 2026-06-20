import * as THREE from 'three';
import type { BossData, DropMaterial } from '../../types/equipment';
import { BossModel } from '../../bosses/BossModel';
import { BossAI, type BossState } from '../../bosses/BossAI';
import type { LawManager } from '../../core/LawManager';
import type { EquipmentManager } from '../../systems/EquipmentManager';
import type { Law } from '../../types/equipment';
import { DamageNumbers } from './DamageNumbers';

export type CombatPhase = 'NONE' | 'STARTING' | 'ACTIVE' | 'VICTORY' | 'DEFEAT';

/** Settlement data returned after combat ends. */
export interface CombatSettlement {
  victory: boolean;
  kpReward: number;
  lingShiReward: number;
  materials: DropMaterial[];
  lawPageReward: string;
  playerHP: number;
}

export interface CombatInput {
  dodge: boolean;
  lawSlot1: boolean;
  lawSlot2: boolean;
  lawSlot3: boolean;
}

export interface CombatState {
  phase: CombatPhase;
  bossHP: number;
  bossMaxHP: number;
  bossPhaseIndex: number;
  bossState: BossState;
  playerHP: number;
  playerMaxHP: number;
  dodgeCooldown: number;
  isDodging: boolean;
  weaknessActive: boolean;
  startingTimer: number;
  /** True when a new phase transition just occurred (consumed next frame). */
  phaseTransitionJustHappened: boolean;
  /** Which law was just activated (for visual effects), null otherwise. */
  lawJustActivated: Law | null;
  /** L3 critical window info */
  criticalActive: boolean;
  criticalMass: number;
}

const DODGE_DURATION = 0.2;
const DODGE_COOLDOWN = 1.5;
const COMBAT_START_DELAY = 1.5;
const LAW_BASE_DAMAGE = 25; // base damage from law activation

/**
 * CombatEngine — real-time action combat manager.
 * Manages BOSS lifecycle, player dodge, law activation, and collision detection.
 */
export class CombatEngine {
  private bossModel: BossModel | null = null;
  private bossAI: BossAI | null = null;
  private lawManager: LawManager | null = null;
  private equipmentManager: EquipmentManager | null = null;
  private demonData: BossData | null = null;

  private phase: CombatPhase = 'NONE';
  private bossHP = 0;
  private bossMaxHP = 0;
  private playerHP = 100;
  private playerMaxHP = 100;

  // Dodge
  private isDodging = false;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;

  // State
  private startingTimer = 0;
  private scene: THREE.Scene | null = null;

  // Per-frame event flags (cleared after getState is called)
  private phaseTransitionJustHappened = false;
  private lawJustActivated: Law | null = null;

  // Damage numbers
  private damageNumbers: DamageNumbers | null = null;

  // Input edge detection (only trigger on first press, not held)
  private prevInput: CombatInput = { dodge: false, lawSlot1: false, lawSlot2: false, lawSlot3: false };

  // Combat arena center (set by main.ts based on trigger zone)
  arenaCenter: THREE.Vector3 = new THREE.Vector3(74, 0, -42);

  /** Start a combat encounter. Adds BOSS to the scene. */
  start(
    scene: THREE.Scene,
    demon: BossData,
    lawManager: LawManager,
    playerXinLi: number,
    spawnPos?: THREE.Vector3,
    equipmentManager?: EquipmentManager,
  ): void {
    this.scene = scene;
    this.lawManager = lawManager;
    this.equipmentManager = equipmentManager ?? null;
    this.demonData = demon;
    this.phase = 'STARTING';
    this.startingTimer = COMBAT_START_DELAY;

    // HP
    this.bossMaxHP = Math.max(1, demon.xinLi);
    this.bossHP = this.bossMaxHP;
    this.playerMaxHP = Math.max(1, playerXinLi);
    this.playerHP = this.playerMaxHP;

    // Reset dodge
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;

    // Create BOSS
    this.bossModel = new BossModel(demon, spawnPos ?? this.arenaCenter);
    this.bossAI = new BossAI(demon);
    this.bossAI.setScene(scene);
    this.bossAI.onProjectileHit((damage) => {
      if (this.isDodging) return;
      this.playerHP = Math.max(0, this.playerHP - damage);
      if (this.playerHP <= 0) this.phase = 'DEFEAT';
    });

    scene.add(this.bossModel.group);

    // Damage numbers system
    this.damageNumbers = new DamageNumbers(scene);

    // Reset input edge detection
    this.prevInput = { dodge: false, lawSlot1: false, lawSlot2: false, lawSlot3: false };
  }

  /** Update combat logic. Call every frame with dt. */
  update(dt: number, playerPos: THREE.Vector3, input: CombatInput): CombatState {
    // Handle input edges (only trigger on first press)
    if (input.dodge && !this.prevInput.dodge && this.phase === 'ACTIVE') {
      this.tryDodge();
    }
    if (input.lawSlot1 && !this.prevInput.lawSlot1 && this.phase === 'ACTIVE') {
      this.tryActivateLaw(0);
    }
    if (input.lawSlot2 && !this.prevInput.lawSlot2 && this.phase === 'ACTIVE') {
      this.tryActivateLaw(1);
    }
    if (input.lawSlot3 && !this.prevInput.lawSlot3 && this.phase === 'ACTIVE') {
      this.tryActivateLaw(2);
    }
    // Update input edge detection state (reuse object, no allocation)
    this.prevInput.dodge = input.dodge;
    this.prevInput.lawSlot1 = input.lawSlot1;
    this.prevInput.lawSlot2 = input.lawSlot2;
    this.prevInput.lawSlot3 = input.lawSlot3;

    // Starting countdown
    if (this.phase === 'STARTING') {
      this.startingTimer -= dt;
      if (this.startingTimer <= 0) {
        this.phase = 'ACTIVE';
      }
    }

    // Active combat
    if (this.phase !== 'ACTIVE') {
      this.bossModel?.update(dt);
      this.damageNumbers?.update(dt);
      return this.getState();
    }

    // Reset per-frame flags at start of each active frame
    this.phaseTransitionJustHappened = false;
    this.lawJustActivated = null;

    // Update damage numbers
    this.damageNumbers?.update(dt);

    // Update dodge
    if (this.isDodging) {
      this.dodgeTimer -= dt;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
      }
    }
    if (this.dodgeCooldown > 0) {
      this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    }

    // Update BOSS AI
    if (this.bossAI && this.bossModel) {
      this.bossModel.update(dt);
      const aiResult = this.bossAI.update(dt, this.bossModel.getPosition(), playerPos);

      // Check phase transitions
      const hpRatio = this.bossMaxHP > 0 ? this.bossHP / this.bossMaxHP : 0;
      if (this.bossAI.checkPhaseTransition(hpRatio)) {
        this.bossModel.triggerPhaseTransition();
        this.phaseTransitionJustHappened = true;
      }

      // Handle attack resolution
      if (aiResult.state === 'ATTACK' && aiResult.activeAttack) {
        // Attack is firing — check if player is hit (and not dodging)
        if (!this.isDodging) {
          const result = this.bossAI.onPlayerHit();
          if (result.type === 'hit') {
            this.playerHP = Math.max(0, this.playerHP - result.damage);
            this.damageNumbers?.spawn({
              text: `-${result.damage}`,
              position: playerPos.clone(),
              type: 'player_hit',
            });
            if (this.playerHP <= 0) {
              this.phase = 'DEFEAT';
            }
          }
        } else {
          // Player dodged the actual hit
          this.damageNumbers?.spawn({
            text: '闪避',
            position: playerPos.clone(),
            type: 'dodge',
            scale: 0.8,
          });
          this.bossAI.onPlayerDodge();
        }
      }

      // Player dodged during warning → BOSS weakness
      // (handled in tryDodge)

      // Update health visual
      this.bossModel.setHealthRatio(hpRatio);
    }

    // Check victory
    if (this.bossHP <= 0 && this.phase === 'ACTIVE') {
      this.phase = 'VICTORY';
    }

    // Natural HP/MP regen during combat at half rate (§6.4)
    this.playerHP = Math.min(this.playerMaxHP, this.playerHP + 0.25 * dt);

    // Clamp player HP
    this.playerHP = Math.max(0, this.playerHP);

    return this.getState();
  }

  /** Try to dodge. */
  private tryDodge(): void {
    if (this.isDodging || this.dodgeCooldown > 0) return;

    this.isDodging = true;
    this.dodgeTimer = DODGE_DURATION;
    this.dodgeCooldown = DODGE_COOLDOWN;

    // If dodging during warning → BOSS weakness
    if (this.bossAI?.getState() === 'WARNING') {
      this.bossAI.onPlayerDodge();
    }
  }

  // Active critical window (L3 精确打击)
  private criticalWindowEnd = 0;
  private criticalMass = 50;
  // Player speed tracking for F=ma
  private lastPlayerPos = new THREE.Vector3();

  /** Try to activate a law from the given slot. */
  private tryActivateLaw(slot: number): void {
    if (!this.lawManager || !this.bossModel || !this.bossAI) return;

    const result = this.lawManager.activateLaw(slot);
    if (!result.success || !result.law) return;

    const law = result.law;
    this.lawJustActivated = law;

    const bossPos = this.bossModel.getPosition();
    const params = law.effectParams;

    switch (law.effectType) {
      case 'visualInfo': { // L0 质点聚焦
        const zoomDist = Number(params.zoomDistance) || 5;
        const duration = Number(params.highlightDuration) || 5;
        this.bossModel.setCoreWireframe(true, duration);
        // Camera zoom is handled by main.ts via lawJustActivated flag
        break;
      }

      case 'prediction': // L1 匀变预判 — pure visual (LawEffects handles it)
        break;

      case 'aoe': { // L1 自由落体
        const baseDmg = Number(params.baseDamage) || 30;
        this.applyDamage(baseDmg);
        break;
      }

      case 'counter': { // L2 弹力反震
        const kbDist = Number(params.knockbackDistance) || 5;
        const stunDur = Number(params.stunDuration) || 1.5;
        // Use a position slightly behind the BOSS from the arena center
        const knockDir = new THREE.Vector3().subVectors(bossPos, this.arenaCenter).setY(0).normalize();
        // If boss is at arena center, push toward player's general direction
        if (knockDir.lengthSq() < 0.1) {
          knockDir.set(1, 0, 0);
        }
        this.bossModel.pushBack(bossPos.clone().add(knockDir.clone().multiplyScalar(-1)), kbDist);
        this.bossAI.stun(stunDur);
        break;
      }

      case 'zone': { // L2 摩擦场
        const slowPct = Number(params.slowPercent) || 40;
        const zoneDur = Number(params.duration) || 5;
        // Slows attack interval by proportional multiplier (>1 = slower attacks)
        this.bossAI.setAttackIntervalMultiplier(1 + slowPct / 100, zoneDur);
        break;
      }

      case 'critical': { // L3 精确打击 (F=ma)
        const windowDur = Number(params.windowDuration) || 1.5;
        this.criticalWindowEnd = windowDur;
        this.criticalMass = 50;
        break;
      }

      case 'buff': { // L3 惯性闪避
        const speedBoost = (Number(params.speedBoost) || 30) / 100 + 1;
        const buffDur = Number(params.duration) || 3;
        // Speed buff applied by main.ts via player.setSpeedMultiplier
        this.speedBuffQueued = speedBoost;
        this.speedBuffDuration = buffDur;
        break;
      }

      default:
        // Fallback: deal base damage
        this.applyDamage(LAW_BASE_DAMAGE);
        break;
    }
  }

  private speedBuffQueued = 1;
  private speedBuffDuration = 0;

  /** Consume speed buff (called from main.ts each frame). */
  consumeSpeedBuff(): { multiplier: number; duration: number } | null {
    if (this.speedBuffQueued > 1) {
      const r = { multiplier: this.speedBuffQueued, duration: this.speedBuffDuration };
      this.speedBuffQueued = 1;
      return r;
    }
    return null;
  }

  /** Apply flat damage to BOSS (used by aoe and fallback). */
  private applyDamage(damage: number): void {
    if (!this.bossModel || !this.bossAI) return;

    if (this.bossAI.getState() === 'WEAKNESS') {
      damage *= 2;
    }

    // Equipment bonus
    const weaponMech = this.equipmentManager?.getMechanism('weapon');
    if (weaponMech && weaponMech.params.damageBonusPerFail) {
      damage *= 1 + (weaponMech.params.damageBonusPerFail as number) / 100;
    }

    this.bossHP = Math.max(0, this.bossHP - damage);
    this.bossModel.flash();
    this.damageNumbers?.spawn({
      text: `-${Math.round(damage)}`,
      position: this.bossModel.getPosition().clone(),
      type: this.bossAI.getState() === 'WEAKNESS' ? 'boss_crit' : 'boss_hit',
    });
  }

  /** Update critical window (L3) and player position tracking. */
  updateCriticalWindow(dt: number, playerPos: THREE.Vector3): void {
    this.lastPlayerPos.copy(playerPos);
    if (this.criticalWindowEnd > 0) {
      this.criticalWindowEnd -= dt;
    }
  }

  /** Check if critical window is active (L3). */
  get isCriticalActive(): boolean {
    return this.criticalWindowEnd > 0;
  }

  /** Get current critical mass value (L3). */
  get massValue(): number {
    return this.criticalMass;
  }

  /** Deal critical damage based on player speed (L3: F=ma). */
  dealCriticalDamage(playerSpeed: number): void {
    const damage = playerSpeed * this.criticalMass;
    this.applyDamage(damage);
    this.criticalWindowEnd = 0;
  }

  /** End combat and clean up scene objects. */
  end(): void {
    if (this.bossModel) {
      if (this.scene) {
        this.scene.remove(this.bossModel.group);
        this.bossAI?.cleanup(this.scene);
      }
      this.bossModel.dispose();
      this.bossModel = null;
    }
    this.bossAI = null;
    this.lawManager = null;
    this.demonData = null;
    this.phase = 'NONE';
  }

  /** Get settlement rewards based on combat outcome and current phase. */
  getSettlement(victory: boolean): CombatSettlement {
    if (victory && this.demonData) {
      const drop = this.demonData.dropTable;
      return {
        victory: true,
        kpReward: drop.kpReward,
        lingShiReward: drop.lingShiReward,
        materials: drop.materials ?? [],
        lawPageReward: drop.lawPageReward ?? '',
        playerHP: this.playerHP,
      };
    }
    return {
      victory: false,
      kpReward: 0,
      lingShiReward: 0,
      materials: [],
      lawPageReward: '',
      playerHP: this.playerHP,
    };
  }

  /** Get current combat state for UI consumption. */
  getState(): CombatState {
    const pt = this.phaseTransitionJustHappened;
    const law = this.lawJustActivated;
    // Clear flags after reading
    this.phaseTransitionJustHappened = false;
    this.lawJustActivated = null;

    return {
      phase: this.phase,
      bossHP: this.bossHP,
      bossMaxHP: this.bossMaxHP,
      bossPhaseIndex: this.bossAI?.getPhaseIndex() ?? 0,
      bossState: this.bossAI?.getState() ?? 'IDLE',
      playerHP: this.playerHP,
      playerMaxHP: this.playerMaxHP,
      dodgeCooldown: this.dodgeCooldown,
      isDodging: this.isDodging,
      weaknessActive: this.bossAI?.getState() === 'WEAKNESS',
      startingTimer: this.startingTimer,
      phaseTransitionJustHappened: pt,
      lawJustActivated: law,
      criticalActive: this.criticalWindowEnd > 0,
      criticalMass: this.criticalMass,
    };
  }

  /** Whether the player is currently invincible. */
  get isPlayerInvincible(): boolean {
    return this.isDodging;
  }

  /** Get BOSS model for camera targeting. */
  getBossGroup(): THREE.Group | null {
    return this.bossModel?.group ?? null;
  }

  /** Get player HP for persistence after defeat. */
  getPlayerHP(): number {
    return this.playerHP;
  }
}
