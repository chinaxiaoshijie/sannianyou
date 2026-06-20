import type { PlayerState, GameState, CombatState, Rank } from '../types';
import type { GameConfig } from '../types';
import type { Equipped } from '../types/equipment';
import { EventEmitter } from './EventEmitter';

/**
 * StateManager — framework-agnostic game state store.
 */
export class StateManager {
  private store = new Map<string, unknown>();
  events = new EventEmitter();

  init(config: GameConfig): void {
    this.store.set('player', this.defaultPlayerState(config));
    this.store.set('game', this.defaultGameState());
    this.store.set('combat', this.defaultCombatState());
    this.store.set('config', config);
  }

  get(key: string): unknown {
    return this.store.get(key);
  }

  getPlayerState(): PlayerState {
    return this.store.get('player') as PlayerState;
  }

  getGameState(): GameState {
    return this.store.get('game') as GameState;
  }

  getCombatState(): CombatState {
    return this.store.get('combat') as CombatState;
  }

  getConfig(): GameConfig {
    return this.store.get('config') as GameConfig;
  }

  updatePlayer(partial: Partial<PlayerState>): void {
    const current = this.getPlayerState();
    const updated: PlayerState = { ...current, ...partial };
    this.store.set('player', updated);
    this.events.emit('player-changed', updated);
  }

  updateGame(partial: Partial<GameState>): void {
    const current = this.getGameState();
    const updated: GameState = { ...current, ...partial };
    this.store.set('game', updated);
    this.events.emit('game-changed', updated);
  }

  updateCombat(partial: Partial<CombatState>): void {
    const current = this.getCombatState();
    const updated: CombatState = { ...current, ...partial };
    this.store.set('combat', updated);
    this.events.emit('combat-changed', updated);
  }

  private defaultPlayerState(config: GameConfig): PlayerState {
    return {
      id: 'player_001',
      name: '启鳞',
      rank: '启鳞' as Rank,
      kp: 0,
      lingShi: config.player.startLingShi ?? 10,
      xinLi: config.player.startHP,
      caiQi: config.player.startMP,
      stats: { history: 0, biology: 0, geography: 0, chemistry: 0 },
      equipped: { weapon: null, armor: null, accessory: null },
      unlockedLaws: [],
      lawPages: [],
      inventory: [],
      elixirs: [],
    };
  }

  private defaultGameState(): GameState {
    return {
      unlockedZones: ['south'],
      defeatedDemons: [],
      completedQuests: [],
      currentZone: 'south',
      playerPosition: { x: 640, y: 680 },
    };
  }

  private defaultCombatState(): CombatState {
    return {
      active: false,
      currentDemons: [],
      currentRound: 0,
      currentQuestion: null,
      timer: 20,
      comboCount: 0,
      weaknessApplied: false,
      xinLi: 100,
      caiQi: 50,
    };
  }
}
