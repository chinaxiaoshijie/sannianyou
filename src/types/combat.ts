/**
 * 战斗相关类型
 */
export interface Demon {
  id: string;
  name: string;
  element: string;  // 心魔类型: '遗忘'|'焦虑'|'恐惧'|'骄傲'|'拖延'|'自卑'|'浮躁'
  hp: number;
  maxHP: number;
  weakness: string;  // 克制科目: '历史'|'生物'|'地理'|'化学'
  attack: number;
  defense: number;
  zone: string;
  rank: number;  // 难度等级 1-6
}

export interface Question {
  id: string;
  subject: '历史' | '生物' | '地理' | '化学';
  difficulty: number;  // 1-5
  text: string;
  options: string[];  // 4 选项
  correctIndex: number;
  explanation: string;
  knowledgePoint: string;
  source: string;  // textbook/reference
}

export interface CombatResult {
  correct: boolean;
  damage: number;
  comboBroken: boolean;
  weaknessTriggered: boolean;
}
