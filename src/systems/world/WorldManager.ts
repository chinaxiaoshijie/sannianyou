import type { Building, Zone, Demon, BattleResult } from '../../types';
import type { StateManager } from '../../core/StateManager';
import type { SaveManager } from '../../core/SaveManager';

const MAP_SCALE = 10;
const ENCOUNTER_INTERVAL = 15; // seconds
const ENCOUNTER_CHANCE = 0.3;
const PROXIMITY_THRESHOLD = 4; // world units (~40px in original)
const SAFE_BUILDINGS = ['dorm_s', 'canteen_s'];
const INTERACT_COOLDOWN = 2; // seconds

export type BuildingDataMap = Record<string, Building>;
export type ZoneDataMap = Record<string, Zone>;
export type DemonDataMap = Record<string, Demon>;

export interface WorldState {
  currentZone: string;
  nearBuilding: Building | null;
  interactionPrompt: string;
  zoneChanged: boolean;
  newZoneName: string;
}

/**
 * WorldManager — pure world game logic extracted from the 2D WorldScene.
 * Handles zone detection, building proximity, interaction dispatch,
 * and random demon encounters. Works in 3D world coordinates.
 */
export class WorldManager {
  private stateManager: StateManager;
  private saveManager: SaveManager;
  private buildings: Building[];
  private zones: Zone[];
  private demons: DemonDataMap;

  nearBuilding: Building | null = null;
  interactionPrompt = '';
  currentZone = 'south';
  private encounterTimer = 0;
  private interactCooldown = 0;

  // Callbacks set by external code
  onZoneChange?: (zoneId: string, zoneName: string) => void;
  onEncounter?: (demon: Demon, demonId: string) => void;
  onInteraction?: (building: Building, action: string) => void;

  constructor(
    stateManager: StateManager,
    saveManager: SaveManager,
    buildingsData: BuildingDataMap,
    zonesData: ZoneDataMap,
    demonsData: DemonDataMap,
  ) {
    this.stateManager = stateManager;
    this.saveManager = saveManager;
    this.buildings = Object.values(buildingsData);
    this.zones = Object.values(zonesData);
    this.demons = demonsData;
  }

  /**
   * Update all world logic. Called every frame from the game loop.
   * @param worldX Player world X coordinate (from Three.js)
   * @param worldZ Player world Z coordinate (from Three.js)
   * @param dt Delta time in seconds
   */
  update(worldX: number, worldZ: number, dt: number): void {
    // Convert 3D world coords back to 2D pixel coords for zone/building logic
    const px = worldX * MAP_SCALE;
    const py = -worldZ * MAP_SCALE;

    this.updateZone(px, py);
    this.checkBuildingProximity(px, py);

    // Interaction cooldown
    if (this.interactCooldown > 0) {
      this.interactCooldown -= dt;
    }

    // Encounter timer
    this.encounterTimer += dt;
    if (this.encounterTimer >= ENCOUNTER_INTERVAL) {
      this.encounterTimer = 0;
      this.checkDemonEncounter();
    }
  }

  /**
   * Trigger interaction on E key press if near a building.
   */
  tryInteract(): boolean {
    if (!this.nearBuilding || this.interactCooldown > 0) return false;
    this.interactCooldown = INTERACT_COOLDOWN;
    this.triggerBuildingInteraction(this.nearBuilding);
    return true;
  }

  /**
   * Detect which zone the player is in based on 2D pixel coordinates.
   */
  private updateZone(px: number, py: number): void {
    for (const zone of this.zones) {
      const pos = zone.position;
      if (px >= pos.x && px <= pos.x + pos.width && py >= pos.y && py <= pos.y + pos.height) {
        if (this.currentZone !== zone.id) {
          this.currentZone = zone.id;
          this.stateManager.updateGame({ currentZone: zone.id });
          if (this.onZoneChange) {
            this.onZoneChange(zone.id, zone.name);
          }
        }
        return;
      }
    }
  }

  /**
   * Find the nearest building within interaction range.
   */
  private checkBuildingProximity(px: number, py: number): void {
    this.nearBuilding = null;
    this.interactionPrompt = '';

    for (const building of this.buildings) {
      const w = building.width ?? 80;
      const h = building.height ?? 60;
      const cx = building.x + w / 2;
      const cy = building.y + h / 2;
      const dx = px - cx;
      const dy = py - cy;

      const threshold = 60;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
        this.nearBuilding = building;
        this.interactionPrompt = `按 E 进入 ${building.name}`;
        return;
      }
    }
  }

  /**
   * Dispatch action based on building.scene.
   */
  private triggerBuildingInteraction(building: Building): void {
    switch (building.scene) {
      case 'save':
        this.saveManager.autoSave().catch(console.error);
        this.stateManager.events.emit('game-saved');
        if (this.onInteraction) {
          this.onInteraction(building, 'save');
        }
        break;
      case 'training':
        if (this.onInteraction) {
          this.onInteraction(building, 'training');
        }
        break;
      default:
        if (this.onInteraction) {
          this.onInteraction(building, 'unknown');
        }
        break;
    }
  }

  /**
   * Roll for random demon encounter.
   * Every ENCOUNTER_INTERVAL seconds, 30% chance.
   * Picks from current zone's demon pool, excludes defeated demons.
   * Safe buildings (dorm, canteen) prevent encounters.
   */
  checkDemonEncounter(): Demon | null {
    // No encounter near safe buildings
    if (this.nearBuilding && SAFE_BUILDINGS.includes(this.nearBuilding.id)) {
      return null;
    }

    const zone = this.zones.find((z) => z.id === this.currentZone);
    if (!zone || zone.demonPool.length === 0) return null;

    // 30% chance
    if (Math.random() > ENCOUNTER_CHANCE) return null;

    const gameState = this.stateManager.getGameState();
    const defeated = gameState.defeatedDemons ?? [];

    const available = zone.demonPool.filter((id) => !defeated.includes(id));
    if (available.length === 0) return null;

    const demonId = available[Math.floor(Math.random() * available.length)];
    const demon = this.demons[demonId];
    if (!demon) return null;

    // Notify external handler
    if (this.onEncounter) {
      this.onEncounter(demon, demonId);
    }

    return demon;
  }

  /**
   * Called after combat completes. Updates game state.
   */
  onCombatComplete(result: BattleResult, demonId: string): void {
    if (result.victory) {
      const gameState = this.stateManager.getGameState();
      this.stateManager.updateGame({
        defeatedDemons: [...gameState.defeatedDemons, demonId],
      });

      const playerState = this.stateManager.getPlayerState();
      this.stateManager.updatePlayer({
        kp: playerState.kp + result.kpEarned,
      });
    } else {
      const playerState = this.stateManager.getPlayerState();
      this.stateManager.updatePlayer({
        xinLi: Math.max(1, playerState.xinLi - 20),
      });
    }
  }
}
