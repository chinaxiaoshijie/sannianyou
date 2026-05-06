/**
 * 数据配置类型
 */
export type Subject = 'history' | 'biology' | 'geography' | 'chemistry';

export interface Zone {
  id: string;
  name: string;
  unlockRank: string;
  demonPool: string[];
  buildings: string[];
  position: { x: number; y: number; width: number; height: number };
}

export interface Building {
  id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  scene?: string;
  unlock?: string;
  buff?: string;
  demon_level?: string;
}

export interface GameConfig {
  combat: {
    questionTime: number;
    comboWindow: number;
    maxQuestionsPerBattle: number;
    baseScore: number;
    timeBonusPerSecond: number;
    comboMultiplier: number;
    weaknessMultiplier: number;
  };
  player: {
    startHP: number;
    startMP: number;
    speed: number;
    startLingShi: number;   // 初始灵石
  };
  economy: {
    dailyLingShi: number;   // 每日俸禄
    comboBonus: number;     // 贯通灵石倍数
  };
  skills: {
    id: string;
    name: string;
    icon: string;
    mpCost: number;
    cooldown: number;
    effect: 'bonusDamage' | 'heal' | 'doubleScore';
    value: number;
    description: string;
  }[];
  techniques?: {             // 新增才艺配置（Phase 2 接入）
    id: string;
    name: string;
    type: 'active' | 'passive';
    cost: number;
    cooldown: number;
    rankReq: number;
    effect: string;
    value: number;
  }[];
}
