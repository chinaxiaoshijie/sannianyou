import type { Demon, Question, CombatResult, BattleResult, GameConfig } from '../../types';
import { CombatSystem } from './CombatSystem';
import type { StateManager } from '../../core/StateManager';

// Import all question banks
import historyQuestions from '../../data/questions/history.json';
import biologyQuestions from '../../data/questions/biology.json';
import geographyQuestions from '../../data/questions/geography.json';
import chemistryQuestions from '../../data/questions/chemistry.json';

export interface CombatManagerState {
  demon: Demon;
  demonId: string;
  demonHP: number;
  demonMaxHP: number;
  question: Question | null;
  options: string[];
  playerHP: number;
  playerMP: number;
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
}

/**
 * CombatManager — pure combat flow orchestrator.
 * Uses CombatSystem for damage/math, manages question progression,
 * timer, combo, and battle lifecycle. No rendering dependencies.
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

    // Load all question banks
    this.allQuestions = [
      ...(historyQuestions as Question[]),
      ...(biologyQuestions as Question[]),
      ...(geographyQuestions as Question[]),
      ...(chemistryQuestions as Question[]),
    ];
  }

  /**
   * Start a new combat encounter with the given demon.
   */
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

    // Select questions based on demon rank
    const maxDiff = Math.min(demon.rank + 1, 5);
    this.questions = this.combatSystem.selectQuestions(
      this.allQuestions,
      this.config.maxQuestionsPerBattle,
      maxDiff,
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

  /**
   * Update timer each frame. dt in seconds.
   */
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
   * Handle player's answer selection. index -1 means timeout.
   */
  handleAnswer(selectedIndex: number): void {
    if (!this.active || this.isProcessing) return;

    this.isProcessing = true;
    const question = this.currentQuestion;
    if (!question) {
      // safety: if no question, advance to next or end
      this.advanceOrEnd();
      return;
    }

    const result = this.combatSystem.processAnswer(
      this.demon,
      question,
      selectedIndex,
      this.combo,
      this.timeRemaining,
    );

    if (result.correct) {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.correctAnswers++;
      this.score += result.damage;
      this.demonHP = Math.max(0, this.demonHP - result.damage);
    } else {
      this.combo = 0;
    }

    // Use a short delay before next question (matching the 1.2s delay in 2D)
    setTimeout(() => {
      this.advanceOrEnd();
    }, 1200);
  }

  /**
   * Move to next question or end battle.
   */
  private advanceOrEnd(): void {
    console.log(`[COMBAT] advanceOrEnd: demonHP=${this.demonHP} qIdx=${this.currentQuestionIndex}/${this.questions.length}`);
    if (this.demonHP <= 0) {
      this.endBattle(true);
    } else {
      this.currentQuestionIndex++;
      if (this.currentQuestionIndex >= this.questions.length) {
        this.endBattle(false);
      } else {
        this.timeRemaining = this.questionTime;
        this.elapsed = 0;
        this.isProcessing = false;
        console.log(`[COMBAT] → next question #${this.currentQuestionIndex}: ${this.currentQuestion?.text?.substring(0,30)}...`);
      }
    }
  }

  /**
   * Calculate results and invoke completion callback.
   */
  private endBattle(victory: boolean): void {
    this.active = false;
    this.isProcessing = true;

    const kpEarned = Math.round(this.score / 10);
    const battleResult: BattleResult = {
      victory,
      score: this.score,
      correctAnswers: this.correctAnswers,
      totalQuestions: this.totalQuestions,
      maxCombo: this.maxCombo,
      kpEarned,
    };

    if (this.onCompleteCallback) {
      this.onCompleteCallback(battleResult);
      this.onCompleteCallback = null;
    }
  }

  /**
   * Get the current question.
   */
  get currentQuestion(): Question | null {
    if (this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex] ?? null;
    }
    return null;
  }

  /**
   * Get current combat state for UI rendering.
   */
  getState(): CombatManagerState {
    const question = this.currentQuestion;
    const playerState = this.stateManager.getPlayerState();

    return {
      demon: this.demon,
      demonId: this.demonId,
      demonHP: this.demonHP,
      demonMaxHP: this.demonMaxHP,
      question,
      options: question?.options ?? [],
      playerHP: playerState.hp,
      playerMP: playerState.mp,
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
    };
  }
}
