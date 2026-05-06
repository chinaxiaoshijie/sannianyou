import type { Demon, Question } from './combat';
import type { Equipped, Elixir } from './equipment';

/**
 * 玩家状态接口
 */
export type Rank = '启鳞' | '明心' | '溯流' | '贯脉' | '聚华' | '腾霄' | '叩阙' | '登台' | '化龙';

export interface PlayerState {
  id: string;
  name: string;
  rank: Rank;
  kp: number;  // 道行（总）
  lingShi: number;  // 灵石
  xinLi: number;    // 心力（原 HP）
  caiQi: number;    // 才气（原 MP）
  stats: { history: number; biology: number; geography: number; chemistry: number };
  equipped: Equipped;
  unlockedLaws: string[];  // 已解锁法则 ID 列表
  lawPages: string[];      // 拥有的法则残页
  inventory: InventoryItem[];
  elixirs: ElixirCarry[];  // 携带的丹药
}

export interface ElixirCarry {
  elixirId: string;
  count: number;
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
  xinLi: number;     // 心力（原 playerHP）
  caiQi: number;     // 才气（原 playerMP）
}

export interface BattleResult {
  victory: boolean;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  maxCombo: number;
  kpEarned: number;
  lingShiEarned: number;  // 获得灵石
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
