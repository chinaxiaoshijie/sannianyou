import type { Law, LawData, Equipped } from '../types/equipment';
import type { StateManager } from './StateManager';
import type { EquipmentManager } from '../systems/EquipmentManager';
import lawsData from '../data/laws.json';
import { EventEmitter } from './EventEmitter';

const MAX_SLOTS = 3;

export interface LawSlot {
  law: Law | null;
  cooldownRemaining: number; // seconds
}

/**
 * LawManager — manages law unlocking, equipping, activation, and cooldowns.
 */
export class LawManager {
  private allLaws: Law[] = [];
  private slots: LawSlot[] = [
    { law: null, cooldownRemaining: 0 },
    { law: null, cooldownRemaining: 0 },
    { law: null, cooldownRemaining: 0 },
  ];
  private stateManager: StateManager;
  private equipmentManager: EquipmentManager | null = null;
  events = new EventEmitter();

  constructor(stateManager: StateManager, equipmentManager?: EquipmentManager) {
    this.stateManager = stateManager;
    this.equipmentManager = equipmentManager ?? null;
    this.loadLaws();
  }

  /* ────── Loading ────── */

  private loadLaws(): void {
    const data = lawsData as unknown as LawData;
    for (const subject of Object.keys(data)) {
      const laws = (data as unknown as Record<string, Law[]>)[subject];
      if (Array.isArray(laws)) {
        this.allLaws.push(...laws);
      }
    }
  }

  /* ────── Unlock ────── */

  /** Returns laws that are newly unlocked based on current KP. */
  checkUnlock(totalKp: number, subjectStats?: Record<string, number>): Law[] {
    const alreadyUnlocked = this.stateManager.getPlayerState().unlockedLaws ?? [];
    const newly: Law[] = [];

    for (const law of this.allLaws) {
      if (alreadyUnlocked.includes(law.id)) continue;
      const req = law.kpReq;
      if (totalKp >= req) {
        newly.push(law);
      }
    }

    if (newly.length > 0) {
      const updated = [...alreadyUnlocked, ...newly.map((l) => l.id)];
      this.stateManager.updatePlayer({ unlockedLaws: updated });
    }

    return newly;
  }

  /** Get all laws the player has unlocked. */
  getUnlockedLaws(): Law[] {
    const ids = this.stateManager.getPlayerState().unlockedLaws ?? [];
    return this.allLaws.filter((l) => ids.includes(l.id));
  }

  /* ────── Equip ────── */

  /** Equip a law to a slot (0-2). Returns success. */
  equipLaw(slot: number, lawId: string): boolean {
    if (slot < 0 || slot >= MAX_SLOTS) return false;
    const law = this.allLaws.find((l) => l.id === lawId);
    if (!law) return false;

    const ids = this.stateManager.getPlayerState().unlockedLaws ?? [];
    if (!ids.includes(lawId)) return false;

    // Remove from other slots if already equipped
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (i !== slot && this.slots[i].law?.id === lawId) {
        this.slots[i].law = null;
        this.slots[i].cooldownRemaining = 0;
      }
    }

    this.slots[slot].law = law;
    this.slots[slot].cooldownRemaining = 0;
    this.events.emit('laws-changed');
    return true;
  }

  /** Unequip a slot. */
  unequipSlot(slot: number): void {
    if (slot >= 0 && slot < MAX_SLOTS) {
      this.slots[slot].law = null;
      this.slots[slot].cooldownRemaining = 0;
      this.events.emit('laws-changed');
    }
  }

  /** Get all 3 slots. */
  getSlots(): LawSlot[] {
    return this.slots;
  }

  /** Get equipped law IDs for saving. */
  getEquippedIds(): (string | null)[] {
    return this.slots.map((s) => s.law?.id ?? null);
  }

  /** Auto-fill empty slots with the best unlocked laws (sorted by tier). */
  autoEquip(): void {
    const unlocked = this.getUnlockedLaws();
    if (unlocked.length === 0) return;
    const tierOrder: Record<string, number> = { L3: 3, L2: 2, L1: 1, L0: 0 };
    unlocked.sort((a, b) => (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0));
    let lawIdx = 0;
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (this.slots[i].law === null && lawIdx < unlocked.length) {
        this.slots[i].law = unlocked[lawIdx];
        lawIdx++;
      }
    }
    this.events.emit('laws-changed');
  }

  /* ────── Activation ────── */

  /**
   * Try to activate the law in a slot. Returns success.
   * Checks: law exists, not on cooldown, enough 才气.
   */
  activateLaw(slot: number): { success: boolean; law?: Law; error?: string } {
    if (slot < 0 || slot >= MAX_SLOTS) return { success: false, error: '无效槽位' };
    const slotData = this.slots[slot];
    if (!slotData.law) return { success: false, error: '槽位为空' };
    if (slotData.cooldownRemaining > 0) return { success: false, error: '冷却中' };

    const player = this.stateManager.getPlayerState();
    if (player.caiQi < slotData.law.cost) return { success: false, error: '才气不足' };

    // Consume 才气
    this.stateManager.updatePlayer({ caiQi: player.caiQi - slotData.law.cost });

    // Start cooldown — apply equipment reduction if present
    let cooldown = slotData.law.cooldown;
    const accessoryMech = this.equipmentManager?.getMechanism('accessory');
    if (accessoryMech && accessoryMech.params.cooldownReduction) {
      cooldown = Math.max(1, cooldown - (accessoryMech.params.cooldownReduction as number));
    }
    slotData.cooldownRemaining = cooldown;

    this.events.emit('laws-changed');

    return { success: true, law: slotData.law };
  }

  /* ────── Cooldown ────── */

  /** Tick cooldowns. Call every frame with dt in seconds. */
  updateCooldowns(dt: number): void {
    for (const slot of this.slots) {
      if (slot.cooldownRemaining > 0) {
        slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - dt);
      }
    }
  }

  /** Get all 9 subjects from laws. */
  getSubjects(): string[] {
    const subjects = new Set<string>();
    for (const law of this.allLaws) {
      subjects.add(law.subject);
    }
    return [...subjects];
  }
}
