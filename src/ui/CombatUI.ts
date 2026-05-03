import type { CombatManager } from '../systems/combat/CombatManager';
import type { CombatManagerState } from '../systems/combat/CombatManager';
import type { BattleResult, Demon } from '../types';

/**
 * CombatUI — HTML/CSS overlay for the combat screen.
 * Rendered on top of the Three.js canvas.
 * Displays demon info, player stats, questions, options, timer, combo.
 */
export class CombatUI {
  private container: HTMLDivElement;
  private combatManager: CombatManager;

  // Elements
  private demonNameEl!: HTMLDivElement;
  private demonHPBar!: HTMLDivElement;
  private demonHPText!: HTMLDivElement;
  private playerHPBar!: HTMLDivElement;
  private playerHPText!: HTMLDivElement;
  private playerKPEl!: HTMLDivElement;
  private questionTextEl!: HTMLDivElement;
  private subjectBadgeEl!: HTMLDivElement;
  private optionButtons: HTMLButtonElement[] = [];
  private timerTextEl!: HTMLDivElement;
  private timerCircleEl!: HTMLDivElement;
  private comboTextEl!: HTMLDivElement;
  private resultPanel!: HTMLDivElement;
  private resultCallback: (() => void) | null = null;

  // Refresh interval
  private refreshId: number | null = null;

  // Subject color mapping
  private static SUBJECT_COLORS: Record<string, string> = {
    '历史': '#f59e0b',
    '生物': '#10b981',
    '地理': '#3b82f6',
    '化学': '#8b5cf6',
  };

  // Element display names
  private static ELEMENT_NAMES: Record<string, string> = {
    '遗忘': '遗忘',
    '焦虑': '焦虑',
    '恐惧': '恐惧',
    '骄傲': '骄傲',
    '拖延': '拖延',
    '自卑': '自卑',
    '浮躁': '浮躁',
  };

  constructor(combatManager: CombatManager) {
    this.combatManager = combatManager;
    this.container = this.createContainer();
    document.body.appendChild(this.container);
    this.hide();
  }

  private createContainer(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = 'combat-ui';
    el.innerHTML = this.getHTML();
    this.cacheElements(el);
    this.bindEvents();
    return el;
  }

  private getHTML(): string {
    return `
<style>
#combat-ui {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(26, 18, 12, 0.94);
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  pointer-events: all;
  image-rendering: pixelated;
}
#combat-ui .combat-inner {
  width: 580px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* Top bar */
.combat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}
.combat-demon-info {
  flex: 1;
}
.combat-demon-name {
  font-size: 18px;
  font-weight: bold;
  color: #e8dcc8;
  display: flex;
  align-items: center;
  gap: 8px;
}
.combat-demon-element {
  font-size: 11px;
  color: #a78bfa;
  border: 1px solid #7c3aed;
  border-radius: 4px;
  padding: 1px 6px;
}
.combat-hp-bar-outer {
  width: 100%;
  height: 10px;
  background: #2a1a2e;
  border: 1px solid #7c3aed;
  border-radius: 5px;
  margin-top: 4px;
  overflow: hidden;
}
.combat-hp-bar-inner {
  height: 100%;
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
  border-radius: 4px;
  transition: width 0.3s ease;
}
.combat-demon-hp-text {
  font-size: 11px;
  color: #a78bfa;
  margin-top: 2px;
}
.combat-player-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.combat-player-hp-outer {
  width: 120px;
  height: 8px;
  background: #2a1a1a;
  border: 1px solid #ef4444;
  border-radius: 4px;
  overflow: hidden;
}
.combat-player-hp-inner {
  height: 100%;
  background: linear-gradient(90deg, #ef4444, #f87171);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.combat-player-hp-text {
  font-size: 10px;
  color: #fca5a5;
}
.combat-player-kp {
  font-size: 13px;
  color: #fbbf24;
}
.combat-player-kp span {
  font-weight: bold;
}
/* Timer */
.combat-timer-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.combat-timer-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid #c8a84e;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f1428;
}
.combat-timer-text {
  font-size: 18px;
  font-weight: bold;
  color: #c8a84e;
}
.combat-timer-urgent {
  color: #ef4444 !important;
}
/* Question card */
.combat-question-card {
  width: 100%;
  background: rgba(40, 30, 18, 0.95);
  border: 3px solid #6b5a3e;
  border-image: none;
  box-shadow: inset 0 0 0 1px rgba(139, 115, 70, 0.3);
  padding: 12px 16px;
  margin-bottom: 16px;
  text-align: center;
}
.combat-subject-badge {
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 6px;
}
.combat-question-text {
  font-size: 15px;
  color: #e8dcc8;
  line-height: 1.4;
}
.combat-weakness-hint {
  color: #a78bfa;
  font-size: 12px;
  margin-top: 6px;
  animation: combat-pulse 1.5s infinite;
}
@keyframes combat-pulse {
  0%,100%{opacity:1}
  50%{opacity:0.5}
}
/* Options */
.combat-options {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.combat-option-btn {
  width: 100%;
  padding: 12px;
  background: rgba(50, 35, 20, 0.95);
  border: 3px solid #5a4832;
  border-image: none;
  color: #e8dcc8;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.1s ease;
}
.combat-option-btn:hover {
  background: rgba(80, 55, 30, 0.95);
  border-color: #c8a84e;
  transform: translateX(-3px);
}
.combat-option-btn:active {
  transform: scale(0.97);
}
.combat-option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
.combat-option-label {
  width: 24px;
  height: 24px;
  border: 2px solid #c8a84e;
  background: rgba(40, 25, 10, 0.8);
  color: #c8a84e;
  font-weight: bold;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
/* Combo */
.combat-combo {
  position: fixed;
  top: 16px;
  right: 24px;
  font-size: 20px;
  font-weight: bold;
  color: #f97316;
}
.combat-combo.count-0 { display: none; }
.combat-combo.count-high {
  color: #ef4444;
  font-size: 28px;
  text-shadow: 0 0 12px rgba(249,115,22,0.5);
}
/* Result panel */
.combat-result {
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 420px;
  max-width: 90vw;
  background: rgba(15, 20, 40, 0.98);
  border: 3px solid #c8a84e;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  z-index: 1100;
  box-shadow: 0 0 30px rgba(200,168,78,0.2);
}
.combat-result.show { display: block; }
.combat-result-title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 16px;
}
.combat-result-title.victory { color: #c8a84e; }
.combat-result-title.defeat { color: #ef4444; }
.combat-result-stat {
  font-size: 14px;
  color: #e8dcc8;
  margin: 8px 0;
}
.combat-result-explanation {
  font-size: 12px;
  color: #9a8e78;
  margin-top: 12px;
  line-height: 1.4;
}
.combat-result-btn {
  margin-top: 20px;
  padding: 8px 40px;
  background: #c8a84e;
  color: #0a0e1a;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
.combat-result-btn:hover { background: #e0c060; }
</style>
<div class="combat-inner">
  <div class="combat-top">
    <div class="combat-demon-info">
      <div class="combat-demon-name">
        <span id="combat-demon-name">---</span>
        <span class="combat-demon-element" id="combat-demon-element"></span>
      </div>
      <div class="combat-hp-bar-outer"><div class="combat-hp-bar-inner" id="combat-demon-hp-bar"></div></div>
      <div class="combat-demon-hp-text" id="combat-demon-hp-text"></div>
    </div>
    <div class="combat-player-stats">
      <div class="combat-player-hp-outer"><div class="combat-player-hp-inner" id="combat-player-hp-bar"></div></div>
      <div class="combat-player-hp-text" id="combat-player-hp-text">HP 100/100</div>
      <div class="combat-player-kp">KP <span id="combat-player-kp">0</span></div>
    </div>
  </div>
  <div class="combat-timer-wrap">
    <div class="combat-timer-circle"><span class="combat-timer-text" id="combat-timer-text">20</span></div>
    <div style="font-size:12px;color:#9a8e78;">剩余时间</div>
  </div>
  <div class="combat-question-card">
    <div class="combat-subject-badge" id="combat-subject-badge"></div>
    <div class="combat-question-text" id="combat-question-text"></div>
    <div class="combat-weakness-hint" id="combat-weakness-hint"></div>
  </div>
  <div class="combat-options" id="combat-options">
    <button class="combat-option-btn" data-index="0"><span class="combat-option-label">A</span><span class="combat-option-text"></span></button>
    <button class="combat-option-btn" data-index="1"><span class="combat-option-label">B</span><span class="combat-option-text"></span></button>
    <button class="combat-option-btn" data-index="2"><span class="combat-option-label">C</span><span class="combat-option-text"></span></button>
    <button class="combat-option-btn" data-index="3"><span class="combat-option-label">D</span><span class="combat-option-text"></span></button>
  </div>
</div>
<div class="combat-combo" id="combat-combo"></div>
<div class="combat-result" id="combat-result">
  <div class="combat-result-title" id="combat-result-title"></div>
  <div id="combat-result-stats"></div>
  <div class="combat-result-explanation" id="combat-result-explanation"></div>
  <button class="combat-result-btn" id="combat-result-btn">继续</button>
</div>
`;
  }

  private cacheElements(el: HTMLElement): void {
    this.demonNameEl = el.querySelector('#combat-demon-name')!;
    this.demonHPBar = el.querySelector('#combat-demon-hp-bar')!;
    this.demonHPText = el.querySelector('#combat-demon-hp-text')!;
    this.playerHPBar = el.querySelector('#combat-player-hp-bar')!;
    this.playerHPText = el.querySelector('#combat-player-hp-text')!;
    this.playerKPEl = el.querySelector('#combat-player-kp')!;
    this.questionTextEl = el.querySelector('#combat-question-text')!;
    this.subjectBadgeEl = el.querySelector('#combat-subject-badge')!;
    this.timerTextEl = el.querySelector('#combat-timer-text')!;
    this.timerCircleEl = el.querySelector('.combat-timer-circle')!;
    this.comboTextEl = el.querySelector('#combat-combo')!;
    this.resultPanel = el.querySelector('#combat-result')!;

    this.optionButtons = [];
    const optionContainer = el.querySelector('#combat-options')!;
    const buttons = optionContainer.querySelectorAll('.combat-option-btn');
    buttons.forEach((btn) => {
      this.optionButtons.push(btn as HTMLButtonElement);
    });
  }

  private bindEvents(): void {
    this.optionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index ?? '0', 10);
        this.combatManager.handleAnswer(idx);
      });
    });

    const resultBtn = this.resultPanel.querySelector('#combat-result-btn')!;
    resultBtn.addEventListener('click', () => {
      this.hideResult();
      if (this.resultCallback) {
        this.resultCallback();
        this.resultCallback = null;
      }
    });
  }

  /**
   * Show the combat UI and start refreshing.
   */
  show(): void {
    this.container.style.display = 'flex';
    this.hideResult();
    this.startRefresh();
  }

  /**
   * Hide the combat UI and stop refreshing.
   */
  hide(): void {
    this.container.style.display = 'none';
    this.stopRefresh();
  }

  /**
   * Show the end-battle result panel.
   */
  showResult(result: BattleResult, demonName: string, explanation: string | null, callback: () => void): void {
    this.resultCallback = callback;

    const titleEl = this.resultPanel.querySelector('#combat-result-title')!;
    const statsEl = this.resultPanel.querySelector('#combat-result-stats')!;
    const explanationEl = this.resultPanel.querySelector('#combat-result-explanation')! as HTMLElement;

    if (result.victory) {
      titleEl.textContent = '胜利!';
      titleEl.className = 'combat-result-title victory';
    } else {
      titleEl.textContent = '失败';
      titleEl.className = 'combat-result-title defeat';
    }

    const demonDisplay = result.victory ? demonName : demonName;
    const stats = [
      `得分: ${result.score}`,
      `答对: ${result.correctAnswers} / ${result.totalQuestions}`,
      `最大连击: ${result.maxCombo}`,
      `获得知识点 (KP): +${result.kpEarned}`,
    ];

    statsEl.innerHTML = stats.map((s) => `<div class="combat-result-stat">${s}</div>`).join('');

    if (explanation) {
      explanationEl.textContent = explanation;
      explanationEl.style.display = 'block';
    } else {
      explanationEl.style.display = 'none';
    }

    this.resultPanel.classList.add('show');
  }

  private hideResult(): void {
    this.resultPanel.classList.remove('show');
  }

  private startRefresh(): void {
    this.refresh();
    this.refreshId = window.setInterval(() => this.refresh(), 100);
  }

  private stopRefresh(): void {
    if (this.refreshId !== null) {
      clearInterval(this.refreshId);
      this.refreshId = null;
    }
  }

  /**
   * Read CombatManager state and update DOM.
   */
  private refresh(): void {
    const state = this.combatManager.getState();

    // Demon info
    this.demonNameEl.textContent = state.demon?.name ?? '---';
    const elementEl = this.container.querySelector('#combat-demon-element')! as HTMLElement;
    if (state.demon?.element) {
      elementEl.textContent = state.demon.element;
      elementEl.style.display = 'inline';
    } else {
      elementEl.style.display = 'none';
    }

    // Demon HP
    const demonHPRatio = state.demonMaxHP > 0 ? state.demonHP / state.demonMaxHP : 0;
    this.demonHPBar.style.width = `${demonHPRatio * 100}%`;
    this.demonHPText.textContent = `${state.demonHP} / ${state.demonMaxHP}`;

    // Player HP (from state, not reactive to StateManager changes mid-battle)
    const playerHPRatio = state.playerHP > 0 ? state.playerHP / 100 : 0; // base max HP of 100
    this.playerHPBar.style.width = `${Math.min(100, playerHPRatio * 100)}%`;
    this.playerHPText.textContent = `HP ${state.playerHP}/100`;

    // Player KP
    this.playerKPEl.textContent = String(state.score > 0 ? Math.round(state.score / 10) : 0);

    // Timer
    this.timerTextEl.textContent = String(state.timer);
    if (state.timer <= 5) {
      this.timerTextEl.classList.add('combat-timer-urgent');
    } else {
      this.timerTextEl.classList.remove('combat-timer-urgent');
    }

    // Question
    if (state.question) {
      const subject = state.question.subject;
      console.log(`[UI] q#${state.questionIndex} subject=${subject} processing=${state.isProcessing}`);
      this.subjectBadgeEl.textContent = `【${subject}】`;
      this.subjectBadgeEl.style.color = CombatUI.SUBJECT_COLORS[subject] ?? '#ffffff';
      this.questionTextEl.textContent = state.question.text;

      // Weakness hint
      const weaknessHint = this.container.querySelector('#combat-weakness-hint')! as HTMLElement;
      if (state.demon && subject === state.demon.weakness) {
        weaknessHint.textContent = '⚡ 弱点克制!';
        weaknessHint.style.display = 'block';
      } else {
        weaknessHint.style.display = 'none';
      }

      // Options
      this.optionButtons.forEach((btn, i) => {
        const optionText = btn.querySelector('.combat-option-text')!;
        if (state.options[i]) {
          optionText.textContent = state.options[i]!;
          btn.disabled = state.isProcessing;
        } else {
          optionText.textContent = '';
          btn.disabled = true;
        }
      });
    }

    // Combo
    if (state.combo > 0) {
      this.comboTextEl.textContent = `×${state.combo}`;
      this.comboTextEl.className = state.combo >= 5 ? 'combat-combo count-high' : 'combat-combo';
    } else {
      this.comboTextEl.textContent = '';
      this.comboTextEl.className = 'combat-combo count-0';
    }

    // Check for game over — handled by main.ts callback, not auto-detected
  }

  private onGameOver(state: CombatManagerState): void {
    this.stopRefresh();

    const kpEarned = Math.round(state.score / 10);
    const result: BattleResult = {
      victory: state.victory,
      score: state.score,
      correctAnswers: state.correctAnswers,
      totalQuestions: state.totalQuestions,
      maxCombo: state.maxCombo,
      kpEarned,
    };

    const demonName = state.demon?.name ?? '心魔';
    const explanation = state.question?.explanation ?? null;

    this.showResult(result, demonName, explanation, () => {
      // Will be wired externally
    });
  }

  /**
   * Wire the result panel's "continue" button to an external callback.
   */
  onResultContinue(callback: () => void): void {
    this.resultCallback = callback;
  }
}
