import type { Demon, Question, CombatResult, BattleResult, GameConfig, Skill } from '../../types';
import { CombatSystem } from './CombatSystem';
import type { StateManager } from '../../core/StateManager';

// Import all question banks
import physicsQuestions from '../../data/questions/physics.json';
import historyQuestions from '../../data/questions/history.json';
import biologyQuestions from '../../data/questions/biology.json';
import geographyQuestions from '../../data/questions/geography.json';
import chemistryQuestions from '../../data/questions/chemistry.json';

export interface SkillCooldown {
  remaining: number;
  max: number;
}

export interface CombatManagerState {
  demon: Demon;
  demonId: string;
  demonHP: number;
  demonMaxHP: number;
  question: Question | null;
  options: string[];
  playerHP: number;   // 心力（战斗中实时值）
  playerMP: number;   // 才气（战斗中实时值）
  timer: number;
  timerMax: number;
  combo: number;
  maxCombo: number;
  score: number;
  questionIndex: number;
  totalQuestions: number;
  correctAnswers: number;
  gameOver: boolean;
  victory: boolean;
  isProcessing: boolean;
  skills: Skill[];
  cooldowns: Record<string, SkillCooldown>;
  hitEffect: '' | 'correct' | 'wrong' | 'heal';
  hitAmount: number;
  lastDamage: number;
}

/**
 * CombatManager — pure combat flow orchestrator.
 * Handles question progression, timer, combo, skills, and battle lifecycle.
 */
export class CombatManager {
  private combatSystem: CombatSystem;
  private stateManager: StateManager;
  private config: GameConfig['combat'];
  private allQuestions: Question[] = [];
  private questions: Question[] = [];
  private demon!: Demon;
  private demonId = '';
  private demonHP = 0;
  private demonMaxHP = 0;
  private currentQuestionIndex = 0;
  private totalQuestions = 0;
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private correctAnswers = 0;
  private timeRemaining = 0;
  private questionTime = 20;
  private playerHP = 100;

  // Skill system
  private skills: Skill[] = [];
  private skillCooldowns: Record<string, SkillCooldown> = {};
  private activeSkillBonus: number = 0;     // bonus damage from fireball
  private activeSkillMultiplier: number = 1; // score multiplier from focus
  private skillUsed: string | null = null;

  // Hit effects (batched to show in next frame)
  private pendingHitEffect: '' | 'correct' | 'wrong' | 'heal' = '';
  private pendingHitAmount = 0;
  private lastDamage = 0;

  active = false;
  isProcessing = false;
  private elapsed = 0;
  private onCompleteCallback: ((result: BattleResult) => void) | null = null;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    const gameConfig = stateManager.getConfig();
    this.combatSystem = new CombatSystem(gameConfig);
    this.config = gameConfig.combat;
    this.questionTime = this.config.questionTime;
    this.skills = gameConfig.skills ?? [];

    // Init cooldowns
    for (const skill of this.skills) {
      this.skillCooldowns[skill.id] = { remaining: 0, max: skill.cooldown };
    }

    // Load all question banks (physics is the MVP primary subject)
    this.allQuestions = [
      ...(physicsQuestions as Question[]),
      ...(historyQuestions as Question[]),
      ...(biologyQuestions as Question[]),
      ...(geographyQuestions as Question[]),
      ...(chemistryQuestions as Question[]),
    ];
  }

  /** Start a new combat encounter. */
  startCombat(demon: Demon, demonId: string, onComplete: (result: BattleResult) => void): void {
    this.demon = demon;
    this.demonId = demonId;
    this.demonHP = demon.hp;
    this.demonMaxHP = demon.maxHP;
    this.currentQuestionIndex = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.correctAnswers = 0;
    this.timeRemaining = this.questionTime;
    this.elapsed = 0;
    this.isProcessing = false;
    this.onCompleteCallback = onComplete;
    this.lastDamage = 0;

    // Reset skills
    this.activeSkillBonus = 0;
    this.activeSkillMultiplier = 1;
    this.skillUsed = null;
    for (const key of Object.keys(this.skillCooldowns)) {
      this.skillCooldowns[key].remaining = 0;
    }

    // HP from player state
    this.playerHP = this.stateManager.getPlayerState().xinLi;

    // Select questions based on demon rank
    const maxDiff = Math.min(demon.rank + 1, 5);
    this.questions = this.combatSystem.selectQuestions(
      this.allQuestions, this.config.maxQuestionsPerBattle, maxDiff,
    );

    // Ensure at least one weakness question
    const hasWeakness = this.questions.some((q) => q.subject === demon.weakness);
    if (!hasWeakness && this.questions.length > 0) {
      const weaknessQuestions = this.allQuestions.filter(
        (q) => q.subject === demon.weakness && q.difficulty <= maxDiff,
      );
      if (weaknessQuestions.length > 0) {
        this.questions[0] = weaknessQuestions[Math.floor(Math.random() * weaknessQuestions.length)];
      }
    }

    this.totalQuestions = this.questions.length;
    this.active = true;
  }

  /** Tick the timer. */
  update(dt: number): void {
    if (!this.active || this.isProcessing) return;

    this.elapsed += dt;
    const newTimeRemaining = Math.max(0, this.questionTime - Math.floor(this.elapsed));

    if (newTimeRemaining !== this.timeRemaining) {
      this.timeRemaining = newTimeRemaining;
      if (this.timeRemaining <= 0) {
        this.handleAnswer(-1);
      }
    }
  }

  /**
   * Use a skill. Returns true if successful.
   */
  useSkill(skillId: string): boolean {
    if (!this.active || this.isProcessing) return false;

    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return false;

    const cd = this.skillCooldowns[skillId];
    if (!cd || cd.remaining > 0) return false;

    const mp = this.stateManager.getPlayerState().caiQi;
    if (mp < skill.mpCost) return false;

    // Consume MP
    this.stateManager.updatePlayer({ caiQi: mp - skill.mpCost });

    // Set cooldown
    cd.remaining = cd.max;

    // Apply skill effect
    this.skillUsed = skillId;
    switch (skill.effect) {
      case 'bonusDamage':
        this.activeSkillBonus = skill.value;
        break;
      case 'doubleScore':
        this.activeSkillMultiplier = skill.value;
        break;
      case 'heal':
        const currentHP = this.stateManager.getPlayerState().xinLi;
        this.playerHP = Math.min(100, currentHP + skill.value);
        this.stateManager.updatePlayer({ xinLi: this.playerHP });
        // Flash heal effect
        this.pendingHitEffect = 'heal';
        this.pendingHitAmount = skill.value;
        break;
    }

    return true;
  }

  /** Handle player's answer. index -1 = timeout. */
  handleAnswer(selectedIndex: number): void {
    if (!this.active || this.isProcessing) return;

    this.isProcessing = true;
    const question = this.currentQuestion;
    if (!question) {
      this.advanceOrEnd();
      return;
    }

    const result = this.combatSystem.processAnswer(
      this.demon, question, selectedIndex, this.combo, this.timeRemaining,
    );

    if (result.correct) {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.correctAnswers++;

      // Apply skill bonuses
      const baseDamage = result.damage + this.activeSkillBonus;
      const finalDamage = Math.round(baseDamage * this.activeSkillMultiplier);
      this.score += finalDamage;
      this.demonHP = Math.max(0, this.demonHP - finalDamage);

      this.lastDamage = finalDamage;
      this.pendingHitEffect = 'correct';
      this.pendingHitAmount = finalDamage;
    } else {
      this.combo = 0;
      this.lastDamage = 0;
      this.pendingHitEffect = 'wrong';
      this.pendingHitAmount = 0;
    }

    // Reset skill for next question
    this.activeSkillBonus = 0;
    this.activeSkillMultiplier = 1;
    this.skillUsed = null;

    setTimeout(() => this.advanceOrEnd(), 1200);
  }

  /** Advance to next question or end battle. */
  private advanceOrEnd(): void {
    if (this.demonHP <= 0) {
      this.endBattle(true);
    } else {
      this.currentQuestionIndex++;
      if (this.currentQuestionIndex >= this.questions.length) {
        this.endBattle(false);
      } else {
        // Reduce cooldowns
        for (const key of Object.keys(this.skillCooldowns)) {
          const cd = this.skillCooldowns[key];
          if (cd.remaining > 0) cd.remaining--;
        }
        this.timeRemaining = this.questionTime;
        this.elapsed = 0;
        this.isProcessing = false;
      }
    }
  }

  /** End the battle and invoke callback. */
  private endBattle(victory: boolean): void {
    this.active = false;
    this.isProcessing = true;

    const kpEarned = Math.round(this.score / 10);
    const battleResult: BattleResult = {
      victory, score: this.score, lingShiEarned: 0,
      correctAnswers: this.correctAnswers, totalQuestions: this.totalQuestions,
      maxCombo: this.maxCombo, kpEarned,
    };

    if (this.onCompleteCallback) {
      this.onCompleteCallback(battleResult);
      this.onCompleteCallback = null;
    }
  }

  get currentQuestion(): Question | null {
    if (this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex] ?? null;
    }
    return null;
  }

  /** Get current combat state for UI. Hit effects auto-clear after read. */
  getState(): CombatManagerState {
    const question = this.currentQuestion;
    const playerState = this.stateManager.getPlayerState();

    // Copy hit effect then clear
    const hitEffect = this.pendingHitEffect;
    const hitAmount = this.pendingHitAmount;
    this.pendingHitEffect = '';
    this.pendingHitAmount = 0;

    return {
      demon: this.demon,
      demonId: this.demonId,
      demonHP: this.demonHP,
      demonMaxHP: this.demonMaxHP,
      question,
      options: question?.options ?? [],
      playerHP: this.playerHP,
      playerMP: playerState.caiQi,
      timer: this.timeRemaining,
      timerMax: this.questionTime,
      combo: this.combo,
      maxCombo: this.maxCombo,
      score: this.score,
      questionIndex: this.currentQuestionIndex,
      totalQuestions: this.totalQuestions,
      correctAnswers: this.correctAnswers,
      gameOver: !this.active && this.isProcessing,
      victory: this.demonHP <= 0,
      isProcessing: this.isProcessing,
      skills: this.skills,
      cooldowns: { ...this.skillCooldowns },
      hitEffect,
      hitAmount,
      lastDamage: this.lastDamage,
    };
  }
}
