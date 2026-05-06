import * as THREE from 'three';
import type { BossData, DropMaterial } from '../../types/equipment';
import { BossModel } from '../../bosses/BossModel';
import { BossAI, type BossState } from '../../bosses/BossAI';
import type { LawManager } from '../../core/LawManager';
import type { EquipmentManager } from '../../systems/EquipmentManager';
import type { Law } from '../../types/equipment';

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

    scene.add(this.bossModel.group);

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
      return this.getState();
    }

    // Reset per-frame flags at start of each active frame
    this.phaseTransitionJustHappened = false;
    this.lawJustActivated = null;

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
            if (this.playerHP <= 0) {
              this.phase = 'DEFEAT';
            }
          }
        } else {
          // Player dodged the actual hit
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

  /** Try to activate a law from the given slot. */
  private tryActivateLaw(slot: number): void {
    if (!this.lawManager || !this.bossModel || !this.bossAI) return;

    const result = this.lawManager.activateLaw(slot);
    if (!result.success) return;

    // Apply law damage to BOSS
    let damage = LAW_BASE_DAMAGE;

    // More damage during weakness
    if (this.bossAI.getState() === 'WEAKNESS') {
      damage *= 2;
    }

    // Scale by law tier
    if (result.law) {
      const tierMultiplier: Record<string, number> = { L0: 1, L1: 1.3, L2: 1.7, L3: 2.2 };
      damage *= tierMultiplier[result.law.tier] ?? 1;
      // Store for visual effects
      this.lawJustActivated = result.law;
    }

    // Equipment bonus: weapon mechanism damage bonus
    const weaponMech = this.equipmentManager?.getMechanism('weapon');
    if (weaponMech && weaponMech.params.damageBonusPerFail) {
      const bonusPct = weaponMech.params.damageBonusPerFail as number;
      damage *= 1 + bonusPct / 100;
    }

    this.bossHP = Math.max(0, this.bossHP - damage);
    this.bossModel.flash();
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
