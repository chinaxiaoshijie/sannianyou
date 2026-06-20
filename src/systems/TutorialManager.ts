import * as THREE from 'three';

/* ── Tutorial step definitions ── */
export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** How to determine this step is complete. */
  check: (ctx: TutorialContext) => boolean;
}

export interface TutorialContext {
  playerPos: THREE.Vector3;
  movedOnce: boolean;
  interactedOnce: boolean;
}

const STORAGE_KEY = 'tutorial_step';
const COMPLETE_KEY = 'tutorial_complete';

/**
 * TutorialManager — step-by-step onboarding state machine.
 * Each step waits for player action before advancing.
 * Progress persists in localStorage.
 */
export class TutorialManager {
  private container: HTMLDivElement | null = null;
  private titleEl: HTMLDivElement | null = null;
  private bodyEl: HTMLDivElement | null = null;
  private currentStepIndex = 0;
  private _isComplete = false;
  private typewriterTimer: ReturnType<typeof setTimeout> | null = null;
  private typewriterFullText = '';
  private playerStartPos = new THREE.Vector3();
  private movedOnce = false;
  private interactedOnce = false;

  private steps: TutorialStep[] = [
    {
      id: 'move',
      title: '欢迎来到三年游',
      body: '使用 WASD 移动角色',
      check: (ctx) => ctx.movedOnce,
    },
    {
      id: 'interact',
      title: '与建筑交互',
      body: '走到建筑物前，按 E 键交互',
      check: (ctx) => ctx.interactedOnce,
    },
    {
      id: 'combat',
      title: '挑战 BOSS',
      body: '前往图书馆，挑战遗忘·残卷\n空格闪避，1/2/3 释放法则',
      check: () => false,
    },
  ];

  constructor(_stateManager: unknown, _lawManager: unknown) {
    this.loadProgress();
    if (!this._isComplete) {
      this.createOverlay();
    }
  }

  get isComplete(): boolean {
    return this._isComplete;
  }

  get activeStep(): TutorialStep | null {
    if (this._isComplete) return null;
    return this.steps[this.currentStepIndex] ?? null;
  }

  /** Mark the current step as complete and advance. */
  advance(): void {
    this.currentStepIndex++;

    if (this.currentStepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    this.saveProgress();
    this.showCurrentStep();
  }

  /** Force-complete the tutorial (e.g., when combat starts on last step). */
  complete(): void {
    this._isComplete = true;
    try {
      localStorage.setItem(COMPLETE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    this.hideOverlay();
  }

  /** Update each frame — check completion conditions. */
  update(playerPos: THREE.Vector3): void {
    if (this._isComplete || !this.container) return;

    const ctx = this.buildContext(playerPos);

    const step = this.steps[this.currentStepIndex];
    if (step && step.check(ctx)) {
      this.advance();
    }
  }

  /** Called externally to notify that the player opened the lab. */
  notifyEnterLab(): void {
    // Will be caught by the context check on next update
  }

  /** Called externally when the player presses E on a building. */
  notifyInteraction(): void {
    this.interactedOnce = true;
  }

  /** Called externally to notify that combat has started. */
  notifyCombatStart(): void {
    if (this.currentStepIndex === this.steps.length - 1) {
      // Last step — complete tutorial when combat starts
      this.complete();
    }
  }

  /* ── Private ── */

  private loadProgress(): void {
    try {
      if (localStorage.getItem(COMPLETE_KEY) === 'true') {
        this._isComplete = true;
        return;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.steps.length) {
          this.currentStepIndex = idx;
        }
      }
    } catch {
      // localStorage unavailable (e.g. private browsing); start fresh silently
    }
    this.movedOnce = false;
    this.interactedOnce = false;
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.currentStepIndex));
    } catch {
      // ignore storage errors
    }
  }

  private buildContext(playerPos: THREE.Vector3): TutorialContext {
    // Track if player has moved from start
    if (!this.movedOnce && this.playerStartPos.length() === 0) {
      this.playerStartPos.copy(playerPos);
    }
    if (!this.movedOnce && playerPos.distanceToSquared(this.playerStartPos) > 4) {
      this.movedOnce = true;
    }

    return {
      playerPos,
      movedOnce: this.movedOnce,
      interactedOnce: this.interactedOnce,
    };
  }

  private createOverlay(): void {
    this.container = document.createElement('div');
    this.container.id = 'tutorial-overlay';
    this.container.innerHTML = `
<style>
#tutorial-overlay {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  pointer-events: none;
}
.tutorial-card {
  background: rgba(253, 232, 224, 0.95);
  border: 2px solid rgba(200, 168, 78, 0.4);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  padding: 20px 28px;
  max-width: 420px;
  text-align: center;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  animation: tutorial-fade-in 0.5s ease;
}
@keyframes tutorial-fade-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.tutorial-card .t-title {
  font-size: 18px;
  font-weight: bold;
  color: #5a4a3a;
  margin-bottom: 8px;
}
.tutorial-card .t-body {
  font-size: 14px;
  color: #8a7a6a;
  line-height: 1.6;
  white-space: pre-line;
}
.tutorial-card .t-step {
  font-size: 10px;
  color: #b0a090;
  margin-top: 12px;
}
</style>
<div class="tutorial-card">
  <div class="t-title" id="t-title"></div>
  <div class="t-body" id="t-body"></div>
  <div class="t-step" id="t-step"></div>
</div>
`;
    document.body.appendChild(this.container);

    this.titleEl = this.container.querySelector('#t-title')!;
    this.bodyEl = this.container.querySelector('#t-body')!;
    const stepEl = this.container.querySelector('#t-step');

    this.showCurrentStep();
  }

  private showCurrentStep(): void {
    if (!this.container || this._isComplete) return;

    const step = this.steps[this.currentStepIndex];
    if (!step) return;

    // Update step counter
    const stepEl = this.container!.querySelector('#t-step') as HTMLDivElement;
    if (stepEl) {
      stepEl.textContent = `步骤 ${this.currentStepIndex + 1} / ${this.steps.length}`;
    }

    // Typewriter effect for title
    this.titleEl!.textContent = '';
    this.typewriterFullText = step.title;
    this.typewriterEffect(this.titleEl!, step.title, 0, 50);

    // Body text appears immediately
    this.bodyEl!.textContent = step.body;
  }

  private typewriterEffect(
    el: HTMLDivElement,
    text: string,
    index: number,
    interval: number,
  ): void {
    if (this.typewriterTimer) {
      clearTimeout(this.typewriterTimer);
    }

    if (index < text.length) {
      el.textContent = text.slice(0, index + 1);
      this.typewriterTimer = setTimeout(() => {
        this.typewriterEffect(el, text, index + 1, interval);
      }, interval);
    }
  }

  private hideOverlay(): void {
    if (this.typewriterTimer) {
      clearTimeout(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    if (this.container) {
      this.container.style.transition = 'opacity 0.5s ease';
      this.container.style.opacity = '0';
      setTimeout(() => {
        this.container?.remove();
        this.container = null;
      }, 500);
    }
  }

  destroy(): void {
    this.hideOverlay();
  }
}
