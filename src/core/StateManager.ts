import type { PlayerState, GameState, CombatState, Rank } from '../types';
import type { GameConfig } from '../types';

/**
 * Tiny EventEmitter for pub/sub change notifications.
 * Replaces Phaser.Data.DataManager.events.
 */
class EventEmitter {
  private listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  on(event: string, fn: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  off(event: string, fn: (...args: unknown[]) => void): void {
    const fns = this.listeners.get(event);
    if (fns) {
      const idx = fns.indexOf(fn);
      if (idx !== -1) fns.splice(idx, 1);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const fns = this.listeners.get(event);
    if (fns) {
      for (const fn of fns) fn(...args);
    }
  }
}

/**
 * StateManager — framework-agnostic game state store.
 * Replaces Phaser.Data.DataManager with Map + EventEmitter.
 * Keeps ALL existing method signatures and behavior from the 2D version.
 */
export class StateManager {
  private store = new Map<string, unknown>();
  events = new EventEmitter();

  /**
   * Initialize state from GameConfig defaults.
   */
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
      name: '新生',
      rank: '新生' as Rank,
      kp: 0,
      hp: config.player.startHP,
      mp: config.player.startMP,
      stats: { history: 0, biology: 0, geography: 0, chemistry: 0 },
      inventory: [],
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
      playerHP: 100,
      playerMP: 50,
    };
  }
}
