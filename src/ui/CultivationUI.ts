import type { StateManager } from '../core/StateManager';
import type { LawManager } from '../core/LawManager';
import type { EquipmentManager } from '../systems/EquipmentManager';
import type { Question } from '../types';

interface CultivationResult {
  correct: number;
  total: number;
  kpEarned: number;
  lingShiEarned: number;
}

const QUESTIONS_PER_ROUND = 5;
const BASE_TIME_LIMIT = 15; // seconds per question
const KP_PER_CORRECT = 5;
const LINGSHI_PER_CORRECT = 3;
const DAILY_DOUBLE_LIMIT = 10; // first N correct answers per day get double rewards
const DAILY_COUNT_KEY = 'cultivation_daily_correct'; // localStorage key
const DAILY_DATE_KEY = 'cultivation_daily_date';     // localStorage key for date

export class CultivationUI {
  private overlay: HTMLDivElement;
  private stateManager: StateManager;
  private lawManager: LawManager;
  private equipmentManager: EquipmentManager | null = null;
  private allQuestions: Question[];
  private _isOpen = false;
  private currentSubject = '';
  private roundQuestions: Question[] = [];
  private currentIndex = 0;
  private result: CultivationResult = { correct: 0, total: 0, kpEarned: 0, lingShiEarned: 0 };
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private countdownStart = 0;
  private animFrameId = 0;
  private timeLimit = BASE_TIME_LIMIT; // computed with equipment bonuses
  // Tracks chapters of wrong answers (for 练习册 bonus)
  private wrongChapters: Set<string> = new Set();

  // ── Daily double reward tracking ──
  private getDailyCorrectCount(): number {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(DAILY_DATE_KEY) !== today) {
        localStorage.setItem(DAILY_DATE_KEY, today);
        localStorage.setItem(DAILY_COUNT_KEY, '0');
        return 0;
      }
      return parseInt(localStorage.getItem(DAILY_COUNT_KEY) ?? '0', 10);
    } catch {
      return 0;
    }
  }

  private incrementDailyCorrect(): void {
    try {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(DAILY_DATE_KEY, today);
      const cur = parseInt(localStorage.getItem(DAILY_COUNT_KEY) ?? '0', 10);
      localStorage.setItem(DAILY_COUNT_KEY, String(cur + 1));
    } catch {
      // ignore
    }
  }

  private mask!: HTMLDivElement;
  private content!: HTMLDivElement;
  private countdownCanvas!: HTMLCanvasElement;
  private countdownCtx!: CanvasRenderingContext2D;

  private boundOnKeydown: (e: KeyboardEvent) => void;

  constructor(stateManager: StateManager, lawManager: LawManager, questions: Question[], equipmentManager?: EquipmentManager) {
    this.stateManager = stateManager;
    this.lawManager = lawManager;
    this.equipmentManager = equipmentManager ?? null;
    this.allQuestions = questions;

    this.overlay = this.createOverlay();
    this.overlay.style.display = 'none';
    document.body.appendChild(this.overlay);

    this.boundOnKeydown = this.onKeydown.bind(this);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  /** Compute effective time limit based on equipped items. */
  private computeTimeLimit(chapter?: string): number {
    let limit = BASE_TIME_LIMIT;
    const weaponMech = this.equipmentManager?.getMechanism('weapon');

    // 练习册: +3s for questions in a chapter where player previously answered wrong
    if (weaponMech && weaponMech.params.timeBonus && chapter) {
      if (this.wrongChapters.has(chapter)) {
        limit += weaponMech.params.timeBonus as number;
      }
    }

    // 状元笔记: time ×1.5
    if (weaponMech && weaponMech.params.timeMultiplier) {
      limit *= weaponMech.params.timeMultiplier as number;
    }

    return Math.round(limit);
  }

  open(subject: string): void {
    this._isOpen = true;
    this.currentSubject = subject;
    this.overlay.style.display = 'flex';
    this.renderLobby();
    window.addEventListener('keydown', this.boundOnKeydown);
  }

  close(): void {
    this._isOpen = false;
    this.overlay.style.display = 'none';
    this.stopTimer();
    this.stopCountdownAnimation();
    window.removeEventListener('keydown', this.boundOnKeydown);
  }

  destroy(): void {
    this.close();
    this.overlay.remove();
  }

  /* ────── Lobby (subject selection + start) ────── */

  private renderLobby(): void {
    this.stopTimer();
    this.stopCountdownAnimation();

    this.timeLimit = this.computeTimeLimit();

    const playerState = this.stateManager.getPlayerState();
    const todayKp = playerState.kp;

    const content = this.content;
    content.innerHTML = `
      <div class="cult-header">
        <div class="cult-title">修炼</div>
        <div class="cult-subtitle">知识即力量 · 答对得分，答错无惩罚</div>
      </div>
      <div class="cult-lobby">
        <div class="cult-lobby-info">
          <div class="cult-lobby-row">
            <span class="cult-lobby-label">当前道行</span>
            <span class="cult-lobby-value">${todayKp}</span>
          </div>
          <div class="cult-lobby-row">
            <span class="cult-lobby-label">每轮题数</span>
            <span class="cult-lobby-value">${QUESTIONS_PER_ROUND} 题</span>
          </div>
          <div class="cult-lobby-row">
            <span class="cult-lobby-label">每题奖励</span>
            <span class="cult-lobby-value">道行+${KP_PER_CORRECT} 灵石+${LINGSHI_PER_CORRECT}</span>
          </div>
          <div class="cult-lobby-row">
            <span class="cult-lobby-label">答题时限</span>
            <span class="cult-lobby-value">${this.timeLimit} 秒/题</span>
          </div>
        </div>
        <button class="cult-start-btn" id="cult-start-btn">开始修炼 · 物理</button>
      </div>
    `;

    this.content.querySelector('#cult-start-btn')?.addEventListener('click', () => {
      this.startRound();
    });
  }

  /* ────── Round Start ────── */

  private startRound(): void {
    this.currentIndex = 0;
    this.result = { correct: 0, total: QUESTIONS_PER_ROUND, kpEarned: 0, lingShiEarned: 0 };
    this.wrongChapters.clear();

    // Pick QUESTIONS_PER_ROUND random questions from physics pool
    const subjectQuestions = this.allQuestions.filter(q => q.subject === '物理');
    const shuffled = [...subjectQuestions].sort(() => Math.random() - 0.5);
    this.roundQuestions = shuffled.slice(0, QUESTIONS_PER_ROUND);

    this.showQuestion();
  }

  /* ────── Show Question ────── */

  private showQuestion(): void {
    if (this.currentIndex >= QUESTIONS_PER_ROUND) {
      this.showSummary();
      return;
    }

    this.stopTimer();
    this.stopCountdownAnimation();

    const question = this.roundQuestions[this.currentIndex];
    this.timeLimit = this.computeTimeLimit(question.chapter);
    const content = this.content;

    content.innerHTML = `
      <div class="cult-progress">
        <div class="cult-progress-text">第 ${this.currentIndex + 1} / ${QUESTIONS_PER_ROUND} 题</div>
        <div class="cult-progress-bar">
          <div class="cult-progress-fill" style="width: ${(this.currentIndex / QUESTIONS_PER_ROUND) * 100}%"></div>
        </div>
      </div>
      <div class="cult-countdown-container">
        <canvas id="cult-countdown" width="40" height="40"></canvas>
      </div>
      <div class="cult-question-card">
        <div class="cult-question-chapter">${question.chapter}</div>
        <div class="cult-question-text">${question.text}</div>
        <div class="cult-options" id="cult-options">
          ${question.options.map((opt, i) => `
            <button class="cult-option" data-index="${i}">
              <span class="cult-option-letter">${String.fromCharCode(65 + i)}</span>
              <span class="cult-option-text">${opt}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="cult-feedback" id="cult-feedback" style="opacity:0"></div>
    `;

    // Setup countdown canvas
    this.countdownCanvas = content.querySelector('#cult-countdown') as HTMLCanvasElement;
    this.countdownCtx = this.countdownCanvas.getContext('2d')!;
    this.countdownStart = performance.now();
    this.startCountdownAnimation();

    // Bind option clicks
    content.querySelectorAll('.cult-option').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt((el as HTMLElement).dataset.index!, 10);
        this.handleAnswer(index);
      });
    });

    // Auto-timeout
    this.timerId = setTimeout(() => {
      this.handleTimeout();
    }, this.timeLimit * 1000);
  }

  /* ────── Countdown Animation ────── */

  private startCountdownAnimation(): void {
    const draw = () => {
      const elapsed = (performance.now() - this.countdownStart) / 1000;
      const remaining = Math.max(0, this.timeLimit - elapsed);
      const fraction = remaining / this.timeLimit;

      const ctx = this.countdownCtx;
      const size = 40;
      const center = size / 2;
      const radius = 16;
      const lineWidth = 3;

      ctx.clearRect(0, 0, size, size);

      // Background circle
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Remaining arc
      if (fraction > 0) {
        ctx.beginPath();
        ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
        ctx.strokeStyle = fraction < 0.3 ? '#ef4444' : fraction < 0.6 ? '#f59e0b' : '#4ade80';
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Center text
      ctx.fillStyle = fraction < 0.3 ? '#ef4444' : '#FDE8E0';
      ctx.font = 'bold 12px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(remaining).toString(), center, center);

      this.animFrameId = requestAnimationFrame(draw);
    };

    this.animFrameId = requestAnimationFrame(draw);
  }

  private stopCountdownAnimation(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  /* ────── Answer Handling ────── */

  private handleAnswer(selectedIndex: number): void {
    this.stopTimer();
    this.stopCountdownAnimation();

    const question = this.roundQuestions[this.currentIndex];
    const isCorrect = selectedIndex === question.correctIndex;

    // Disable further clicks
    this.content.querySelectorAll('.cult-option').forEach(el => {
      (el as HTMLButtonElement).disabled = true;
    });

    // Highlight correct/wrong
    this.content.querySelectorAll('.cult-option').forEach(el => {
      const idx = parseInt((el as HTMLElement).dataset.index!, 10);
      if (idx === question.correctIndex) {
        el.classList.add('cult-option-correct');
      } else if (idx === selectedIndex && !isCorrect) {
        el.classList.add('cult-option-wrong');
      }
    });

    let kpGain = 0;
    let lingShiGain = 0;
    let isDouble = false;
    if (isCorrect) {
      this.result.correct++;
      const dailyCount = this.getDailyCorrectCount();
      isDouble = dailyCount < DAILY_DOUBLE_LIMIT;
      const mult = isDouble ? 2 : 1;
      kpGain = KP_PER_CORRECT * mult;
      lingShiGain = LINGSHI_PER_CORRECT * mult;
      this.result.kpEarned += kpGain;
      this.result.lingShiEarned += lingShiGain;
      this.incrementDailyCorrect();
    } else if (question.chapter) {
      // 练习册: record chapter so next question from same chapter gets +3s
      this.wrongChapters.add(question.chapter);
    }

    // Show feedback
    const feedback = this.content.querySelector('#cult-feedback') as HTMLDivElement;
    const rewardHint = isCorrect
      ? (isDouble
          ? `🌟 双倍奖励! 道行+${kpGain} 灵石+${lingShiGain}`
          : `道行+${kpGain} 灵石+${lingShiGain}`)
      : '没关系，继续下一题';
    feedback.innerHTML = `
      <div class="cult-feedback-title">${isCorrect ? '正确!' : '不正确'}</div>
      <div class="cult-feedback-explanation">${question.explanation}</div>
      <div class="cult-feedback-hint">${rewardHint}</div>
    `;
    feedback.style.opacity = '1';

    // Advance after delay
    setTimeout(() => {
      this.currentIndex++;
      this.showQuestion();
    }, 2000);
  }

  private handleTimeout(): void {
    this.stopTimer();
    this.stopCountdownAnimation();

    const question = this.roundQuestions[this.currentIndex];

    // Disable further clicks
    this.content.querySelectorAll('.cult-option').forEach(el => {
      (el as HTMLButtonElement).disabled = true;
    });

    // Highlight correct answer
    this.content.querySelectorAll('.cult-option').forEach(el => {
      const idx = parseInt((el as HTMLElement).dataset.index!, 10);
      if (idx === question.correctIndex) {
        el.classList.add('cult-option-correct');
      }
    });

    // 练习册: timeout counts as wrong — next question from same chapter gets +3s
    if (question.chapter) this.wrongChapters.add(question.chapter);

    // Show timeout feedback
    const feedback = this.content.querySelector('#cult-feedback') as HTMLDivElement;
    feedback.innerHTML = `
      <div class="cult-feedback-title">超时</div>
      <div class="cult-feedback-explanation">${question.explanation}</div>
      <div class="cult-feedback-hint">时限已到，进入下一题</div>
    `;
    feedback.style.opacity = '1';

    setTimeout(() => {
      this.currentIndex++;
      this.showQuestion();
    }, 2000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /* ────── Summary & Settlement ────── */

  private showSummary(): void {
    this.stopTimer();
    this.stopCountdownAnimation();

    // Settle rewards
    const playerState = this.stateManager.getPlayerState();
    const newKp = playerState.kp + this.result.kpEarned;
    const newLingShi = playerState.lingShi + this.result.lingShiEarned;
    this.stateManager.updatePlayer({
      kp: newKp,
      lingShi: newLingShi,
    });

    // Check law unlocks
    this.lawManager.checkUnlock(newKp);

    // Render summary
    const content = this.content;
    content.innerHTML = `
      <div class="cult-header">
        <div class="cult-title">修炼完成</div>
        <div class="cult-subtitle">今日物理修炼总结</div>
      </div>
      <div class="cult-summary">
        <div class="cult-summary-score">
          <div class="cult-score-number">${this.result.correct} / ${this.result.total}</div>
          <div class="cult-score-label">正确率 ${Math.round((this.result.correct / this.result.total) * 100)}%</div>
        </div>
        <div class="cult-summary-rewards">
          <div class="cult-reward-item">
            <div class="cult-reward-icon">道行</div>
            <div class="cult-reward-value">+${this.result.kpEarned}</div>
          </div>
          <div class="cult-reward-item">
            <div class="cult-reward-icon">灵石</div>
            <div class="cult-reward-value">+${this.result.lingShiEarned}</div>
          </div>
        </div>
        ${this.result.correct === this.result.total ? `
          <div class="cult-summary-perfect">完美通关！你的物理知识正在转化为力量。</div>
        ` : ''}
        <button class="cult-start-btn" id="cult-close-btn">关闭面板</button>
      </div>
    `;

    this.content.querySelector('#cult-close-btn')?.addEventListener('click', () => {
      this.close();
    });
  }

  /* ────── DOM Creation ────── */

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'cultivation-overlay';
    overlay.innerHTML = `
<style>
#cultivation-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: none;
  align-items: center;
  justify-content: center;
}
#cult-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  cursor: pointer;
}
#cult-content {
  position: relative;
  z-index: 1;
  width: 560px;
  max-width: 90vw;
  max-height: 85vh;
  background: #FDE8E0;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.cult-header {
  padding: 20px 24px 16px;
  text-align: center;
  border-bottom: 2px solid #E8D5C4;
}
.cult-title {
  font-size: 22px;
  font-weight: bold;
  color: #5a4a3a;
}
.cult-subtitle {
  font-size: 13px;
  color: #9a8a7a;
  margin-top: 4px;
}
.cult-lobby {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.cult-lobby-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cult-lobby-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #E8D5C4;
  border-radius: 8px;
}
.cult-lobby-label {
  font-size: 14px;
  color: #8a7a6a;
}
.cult-lobby-value {
  font-size: 14px;
  font-weight: bold;
  color: #3a3a3a;
}
.cult-start-btn {
  padding: 14px 32px;
  font-size: 16px;
  font-weight: bold;
  color: #FDE8E0;
  background: #4A90D9;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.cult-start-btn:hover {
  background: #3a7bc8;
  transform: scale(1.02);
}
.cult-start-btn:active {
  transform: scale(0.98);
}
/* ── Question card ── */
.cult-progress {
  padding: 12px 24px 0;
}
.cult-progress-text {
  font-size: 12px;
  color: #9a8a7a;
  margin-bottom: 6px;
}
.cult-progress-bar {
  width: 100%;
  height: 4px;
  background: #E8D5C4;
  border-radius: 2px;
  overflow: hidden;
}
.cult-progress-fill {
  height: 100%;
  background: #4A90D9;
  transition: width 0.3s ease;
}
.cult-countdown-container {
  position: absolute;
  top: 12px;
  left: 12px;
}
.cult-question-card {
  padding: 16px 24px 24px;
  position: relative;
}
.cult-question-chapter {
  font-size: 11px;
  color: #9a8a7a;
  margin-bottom: 8px;
  padding: 2px 8px;
  background: rgba(74, 144, 217, 0.1);
  border-radius: 4px;
  display: inline-block;
}
.cult-question-text {
  font-size: 16px;
  color: #3a3a3a;
  line-height: 1.6;
  margin-bottom: 20px;
  font-weight: 500;
}
.cult-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cult-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #E8D5C4;
  border: 2px solid #d4b896;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  text-align: left;
  font-size: 14px;
  color: #3a3a3a;
}
.cult-option:hover:not(:disabled) {
  border-color: #4A90D9;
  background: #dcc8b4;
  transform: translateX(4px);
}
.cult-option-letter {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FDE8E0;
  border-radius: 50%;
  font-weight: bold;
  font-size: 13px;
  color: #5a4a3a;
  flex-shrink: 0;
}
.cult-option-text {
  flex: 1;
  line-height: 1.4;
}
.cult-option-correct {
  background: rgba(74, 222, 128, 0.25) !important;
  border-color: #4ade80 !important;
}
.cult-option-correct .cult-option-letter {
  background: #4ade80;
  color: white;
}
.cult-option-wrong {
  background: rgba(239, 68, 68, 0.2) !important;
  border-color: #ef4444 !important;
}
.cult-option-wrong .cult-option-letter {
  background: #ef4444;
  color: white;
}
.cult-option:disabled {
  cursor: default;
}
/* ── Feedback ── */
.cult-feedback {
  margin-top: 16px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 10px;
  border-left: 4px solid #4A90D9;
  transition: opacity 0.5s ease;
}
.cult-feedback-title {
  font-size: 15px;
  font-weight: bold;
  color: #3a3a3a;
  margin-bottom: 6px;
}
.cult-feedback-explanation {
  font-size: 13px;
  color: #6a5a4a;
  line-height: 1.5;
  margin-bottom: 8px;
}
.cult-feedback-hint {
  font-size: 12px;
  color: #9a8a7a;
  font-style: italic;
}
/* ── Summary ── */
.cult-summary {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.cult-summary-score {
  text-align: center;
}
.cult-score-number {
  font-size: 48px;
  font-weight: bold;
  color: #4A90D9;
}
.cult-score-label {
  font-size: 14px;
  color: #9a8a7a;
  margin-top: 4px;
}
.cult-summary-rewards {
  display: flex;
  gap: 24px;
}
.cult-reward-item {
  text-align: center;
  padding: 16px 24px;
  background: #E8D5C4;
  border-radius: 12px;
}
.cult-reward-icon {
  font-size: 13px;
  color: #8a7a6a;
  margin-bottom: 4px;
}
.cult-reward-value {
  font-size: 24px;
  font-weight: bold;
  color: #4ade80;
}
.cult-summary-perfect {
  font-size: 14px;
  color: #c8a84e;
  font-weight: bold;
  text-align: center;
}
</style>
<div id="cult-mask"></div>
<div id="cult-content"></div>
`;

    this.mask = overlay.querySelector('#cult-mask')!;
    this.content = overlay.querySelector('#cult-content')!;
    this.mask.addEventListener('click', () => this.close());

    return overlay;
  }

  /* ────── Keyboard ────── */

  private onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
    // Number keys 1-4 for quick answer during question phase
    if (this.currentIndex < QUESTIONS_PER_ROUND && this.roundQuestions.length > 0) {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 4) {
        const selectedIndex = num - 1;
        // Only handle if options are still enabled
        const options = this.content.querySelectorAll('.cult-option:not(:disabled)');
        if (options.length > 0) {
          this.handleAnswer(selectedIndex);
        }
      }
    }
  }
}
