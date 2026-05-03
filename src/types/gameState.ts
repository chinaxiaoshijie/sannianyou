import type { Demon, Question } from './combat';

/**
 * 玩家状态接口
 */
export type Rank = '新生' | '探索者' | '进阶者' | '挑战者' | '达人' | '学霸';

export interface PlayerState {
  id: string;
  name: string;
  rank: Rank;
  kp: number;  // Knowledge Points
  hp: number;
  mp: number;
  stats: { history: number; biology: number; geography: number; chemistry: number };
  inventory: InventoryItem[];
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'consumable' | 'equipment' | 'key';
  effect?: string;
}

export interface GameState {
  unlockedZones: string[];
  defeatedDemons: string[];
  completedQuests: string[];
  currentZone: string;
  playerPosition: { x: number; y: number };
}

export interface CombatState {
  active: boolean;
  currentDemons: Demon[];
  currentRound: number;
  currentQuestion: Question | null;
  timer: number;
  comboCount: number;
  weaknessApplied: boolean;
  playerHP: number;
  playerMP: number;
}

export interface BattleResult {
  victory: boolean;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  maxCombo: number;
  kpEarned: number;
}

export interface SaveSlot {
  slot: number;
  timestamp: string | null;
  summary: string | null;
}

export interface SaveData {
  version: string;
  timestamp: string;
  player: PlayerState;
  game: GameState;
  settings: Record<string, unknown>;
}
