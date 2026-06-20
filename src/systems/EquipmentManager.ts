import type { StateManager } from '../core/StateManager';
import type { Equipment, Equipped, EquipmentMechanism, EquipSlot, EquipmentData, Rarity } from '../types/equipment';
import equipmentData from '../data/equipment.json';
import { EventEmitter } from '../core/EventEmitter';

const RARITY_CONFIG: Record<Rarity, { name: string; color: string; mult: number }> = {
  common: { name: '普通', color: '#CCCCCC', mult: 1.0 },
  rare: { name: '稀有', color: '#6495ED', mult: 1.3 },
  epic: { name: '史诗', color: '#9B59B6', mult: 1.6 },
  legendary: { name: '传说', color: '#FF8C00', mult: 2.0 },
};

/**
 * EquipmentManager — loads equipment data, handles equip/unequip,
 * and provides mechanism access to other systems.
 * Equipment never adds numeric stats — only mechanic changes.
 */
export class EquipmentManager {
  private allEquipment: Equipment[] = [];
  private stateManager: StateManager;
  events = new EventEmitter();

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.loadEquipment();
  }

  /* ── Loading ── */

  private loadEquipment(): void {
    const data = equipmentData as unknown as EquipmentData;
    for (const category of [data.scrolls, data.armors, data.accessories]) {
      if (Array.isArray(category)) {
        this.allEquipment.push(...category);
      }
    }
  }

  /* ── Queries ── */

  /** Get all equipment the player can see (kpReq met). */
  getAvailable(): Equipment[] {
    const playerKp = this.stateManager.getPlayerState().kp;
    return this.allEquipment.filter((eq) => playerKp >= eq.kpReq);
  }

  /** Get all equipment (including locked ones, for display purposes). */
  getAll(): Equipment[] {
    return [...this.allEquipment];
  }

  /** Get equipment by ID. */
  getById(id: string): Equipment | undefined {
    return this.allEquipment.find((eq) => eq.id === id);
  }

  /** Get rarity display config. */
  getRarityConfig(rarity: Rarity): { name: string; color: string } {
    const cfg = RARITY_CONFIG[rarity];
    return { name: cfg.name, color: cfg.color };
  }

  /* ── Equip / Unequip ── */

  /**
   * Equip an item to its designated slot.
   * Returns true on success, false if kpReq not met or slot occupied.
   */
  equip(itemId: string): boolean {
    const eq = this.getById(itemId);
    if (!eq) return false;

    const player = this.stateManager.getPlayerState();
    if (player.kp < eq.kpReq) return false;

    const equipped = { ...player.equipped };

    // If same item already equipped in this slot, skip
    const currentInSlot = equipped[eq.slot];
    if (currentInSlot && currentInSlot.id === itemId) return false;

    // Equip (replacing whatever was in the slot)
    equipped[eq.slot] = eq;

    this.stateManager.updatePlayer({ equipped });
    this.events.emit('equipment-changed');
    return true;
  }

  /** Unequip a slot. Returns true on success. */
  unequip(slot: EquipSlot): boolean {
    const player = this.stateManager.getPlayerState();
    const equipped = { ...player.equipped };

    if (!equipped[slot]) return false;

    equipped[slot] = null;

    this.stateManager.updatePlayer({ equipped });
    this.events.emit('equipment-changed');
    return true;
  }

  /** Get currently equipped items. */
  getEquipped(): Equipped {
    return this.stateManager.getPlayerState().equipped ?? {
      weapon: null,
      armor: null,
      accessory: null,
    };
  }

  /** Get the mechanism for a specific equipped slot, or null. */
  getMechanism(slot: EquipSlot): EquipmentMechanism | null {
    const equipped = this.getEquipped();
    return equipped[slot]?.mechanism ?? null;
  }

  /** Check if a specific item is currently equipped. */
  isEquipped(itemId: string): boolean {
    const equipped = this.getEquipped();
    return (
      equipped.weapon?.id === itemId ||
      equipped.armor?.id === itemId ||
      equipped.accessory?.id === itemId
    );
  }

  /** Get the slot that a given item is equipped in, or null. */
  getEquippedSlot(itemId: string): EquipSlot | null {
    const equipped = this.getEquipped();
    if (equipped.weapon?.id === itemId) return 'weapon';
    if (equipped.armor?.id === itemId) return 'armor';
    if (equipped.accessory?.id === itemId) return 'accessory';
    return null;
  }

  destroy(): void {
    // No DOM to clean up
  }
}
