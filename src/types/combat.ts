/**
 * 战斗相关类型
 */

/** BOSS 战斗结果（动作战斗） */
export interface ActionCombatResult {
  victory: boolean;
  bossName: string;
  playerRemainingHP: number;
  phasesCompleted: number;
}

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
  subject: '物理' | '历史' | '生物' | '地理' | '化学';
  difficulty: number;  // 1-5
  text: string;
  options: string[];  // 4 选项
  correctIndex: number;
  explanation: string;
  knowledgePoint: string;
  source: string;  // textbook/reference
  /** Chapter reference for cultivation tracking (e.g. "必修一 §1.1") */
  chapter?: string;
  /** Associated law ID for cultivation → law progression */
  law?: string;
}


