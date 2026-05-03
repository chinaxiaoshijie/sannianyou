import type { Demon, Question, CombatResult, GameConfig } from '../../types';

// 科目到状态属性的映射
const SUBJECT_TO_STAT: Record<string, keyof GameConfig['combat']> = {
  '历史': 'baseScore',
  '生物': 'baseScore',
  '地理': 'baseScore',
  '化学': 'baseScore',
};

/**
 * 战斗系统 — 纯逻辑，无 Phaser 依赖
 * 伤害计算、弱点判定、题库管理
 */
export class CombatSystem {
  private config: GameConfig['combat'];

  constructor(config: GameConfig) {
    this.config = config.combat;
  }

  /**
   * 计算伤害值
   * 公式: baseScore * (1 + combo * comboMultiplier) * (weaknessTriggered ? weaknessMultiplier : 1) + timeRemaining * timeBonusPerSecond
   */
  calculateDamage(correct: boolean, combo: number, weaknessTriggered: boolean, timeRemaining: number): number {
    if (!correct) return 0;

    const { baseScore, comboMultiplier, weaknessMultiplier, timeBonusPerSecond } = this.config;
    const comboBonus = 1 + combo * comboMultiplier;
    const weaknessBonus = weaknessTriggered ? weaknessMultiplier : 1;
    const timeBonus = timeRemaining * timeBonusPerSecond;

    return Math.round(baseScore * comboBonus * weaknessBonus + timeBonus);
  }

  /**
   * 检查是否触发弱点克制（题目科目匹配心魔弱点）
   */
  checkWeakness(demon: Demon, question: Question): boolean {
    return demon.weakness === question.subject;
  }

  /**
   * 从题库中随机抽取指定数量的题目
   */
  selectQuestions(allQuestions: Question[], count: number, maxDifficulty: number): Question[] {
    const filtered = allQuestions.filter((q) => q.difficulty <= maxDifficulty);
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * 处理答题结果，返回战斗结果
   */
  processAnswer(
    demon: Demon,
    question: Question,
    selectedIndex: number,
    combo: number,
    timeRemaining: number,
  ): CombatResult {
    const correct = selectedIndex === question.correctIndex;
    const weaknessTriggered = correct && this.checkWeakness(demon, question);
    const damage = this.calculateDamage(correct, combo, weaknessTriggered, timeRemaining);
    const comboBroken = !correct;

    return { correct, damage, comboBroken, weaknessTriggered };
  }

  /**
   * 心魔对玩家造成的伤害
   */
  calculateDemonAttack(demon: Demon): number {
    return demon.attack + Math.floor(Math.random() * 5);
  }
}
