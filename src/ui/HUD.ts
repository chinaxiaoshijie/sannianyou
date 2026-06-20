import type { StateManager } from '../core/StateManager';
import type { PlayerState } from '../types';

/**
 * HUD — always-visible HTML overlay showing HP/MP bars,
 * interaction prompt, and save indicator.
 */
export class HUD {
  private container: HTMLDivElement;
  private stateManager: StateManager;

  // Elements
  private rankEl!: HTMLSpanElement;
  private kpEl!: HTMLSpanElement;
  private hpBar!: HTMLDivElement;
  private hpText!: HTMLSpanElement;
  private mpBar!: HTMLDivElement;
  private mpText!: HTMLSpanElement;
  private interactionPromptEl!: HTMLDivElement;
  private saveIndicatorEl!: HTMLDivElement;

  // Last interaction prompt text (to avoid per-frame dom writes + log spam)
  private lastPromptText = '';

  // Event cleanup
  private boundOnPlayerChanged: (data: unknown) => void;
  private boundOnGameSaved: () => void;

  // HP base for bar calculation
  private hpBase = 100;
  private mpBase = 50;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.container = this.createContainer();
    document.body.appendChild(this.container);

    // Bind event handlers
    this.boundOnPlayerChanged = this.onPlayerChanged.bind(this);
    this.boundOnGameSaved = this.onGameSaved.bind(this);

    // Subscribe to state changes
    stateManager.events.on('player-changed', this.boundOnPlayerChanged);
    stateManager.events.on('game-saved', this.boundOnGameSaved);

    // Initial render
    this.refreshPlayer(stateManager.getPlayerState());
  }

  private createContainer(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = 'hud';
    el.innerHTML = this.getHTML();
    this.cacheElements(el);
    return el;
  }

  private getHTML(): string {
    return `
<style>
#hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  pointer-events: none;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
#hud > * {
  pointer-events: none;
}
/* Top-left: player stats — Monument Valley 3D panel */
.hud-top-left {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: linear-gradient(135deg, rgba(20,14,8,0.85), rgba(30,22,14,0.75));
  border: 1px solid rgba(200,168,78,0.3);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(200,168,78,0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.hud-rank-kp {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hud-rank {
  font-size: 15px;
  color: #c8a84e;
  font-weight: bold;
  text-shadow: 0 0 8px rgba(200,168,78,0.5);
}
.hud-kp {
  font-size: 13px;
  color: #fbbf24;
  text-shadow: 0 0 6px rgba(251,191,36,0.3);
}
.hud-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hud-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hud-bar-label {
  font-size: 11px;
  color: #c8a84e;
  width: 24px;
  text-align: right;
  font-weight: bold;
  text-shadow: 0 0 4px rgba(200,168,78,0.4);
}
.hud-bar-outer {
  width: 140px;
  height: 10px;
  background: rgba(0,0,0,0.6);
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid rgba(200,168,78,0.25);
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
}
.hud-bar-inner {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
}
.hud-bar-inner.hp { 
  background: linear-gradient(180deg, #ef4444, #b91c1c);
  box-shadow: 0 0 6px rgba(239,68,68,0.4);
}
.hud-bar-inner.mp { 
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
  box-shadow: 0 0 6px rgba(59,130,246,0.4);
}
.hud-bar-text {
  font-size: 10px;
  color: #e5e7eb;
  min-width: 64px;
  text-shadow: 0 0 4px rgba(255,255,255,0.2);
}
/* Bottom-center: interaction prompt */
.hud-interact {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 14px;
  color: #c8a84e;
  background: rgba(10,14,26,0.8);
  border: 1px solid rgba(200,168,78,0.4);
  border-radius: 8px;
  padding: 8px 18px;
  display: none;
}
.hud-interact.visible {
  display: block;
}
/* Save indicator toast */
.hud-save-indicator {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: #4ade80;
  background: rgba(10,14,26,0.85);
  border: 1px solid rgba(74,222,128,0.4);
  border-radius: 6px;
  padding: 6px 16px;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.hud-save-indicator.show {
  opacity: 1;
}
</style>
<div class="hud-top-left">
  <div class="hud-rank-kp">
    <span class="hud-rank" id="hud-rank">新生</span>
    <span class="hud-kp">KP <span id="hud-kp">0</span></span>
  </div>
  <div class="hud-bars">
    <div class="hud-bar-row">
      <span class="hud-bar-label">HP</span>
      <div class="hud-bar-outer"><div class="hud-bar-inner hp" id="hud-hp-bar" style="width:100%"></div></div>
      <span class="hud-bar-text" id="hud-hp-text">100/100</span>
    </div>
    <div class="hud-bar-row">
      <span class="hud-bar-label">MP</span>
      <div class="hud-bar-outer"><div class="hud-bar-inner mp" id="hud-mp-bar" style="width:100%"></div></div>
      <span class="hud-bar-text" id="hud-mp-text">50/50</span>
    </div>
  </div>
</div>
<div class="hud-interact" id="hud-interact"></div>
<div class="hud-save-indicator" id="hud-save-indicator">💾 游戏已保存!</div>
`;
  }

  private cacheElements(el: HTMLElement): void {
    this.rankEl = el.querySelector('#hud-rank')!;
    this.kpEl = el.querySelector('#hud-kp')!;
    this.hpBar = el.querySelector('#hud-hp-bar')!;
    this.hpText = el.querySelector('#hud-hp-text')!;
    this.mpBar = el.querySelector('#hud-mp-bar')!;
    this.mpText = el.querySelector('#hud-mp-text')!;
    this.interactionPromptEl = el.querySelector('#hud-interact')!;
    this.saveIndicatorEl = el.querySelector('#hud-save-indicator')!;
  }

  private onPlayerChanged(data: unknown): void {
    this.refreshPlayer(data as PlayerState);
  }

  private onGameSaved(): void {
    this.showSaveIndicator();
  }

  /** Public trigger for save toast (called when save action completes). */
  showSavedToast(): void {
    this.showSaveIndicator();
  }

  private refreshPlayer(player: PlayerState): void {
    this.rankEl.textContent = player.rank;
    this.kpEl.textContent = String(player.kp);

    const hpRatio = Math.max(0, player.xinLi / this.hpBase);
    this.hpBar.style.width = `${hpRatio * 100}%`;
    this.hpText.textContent = `${player.xinLi}/${this.hpBase}`;

    const mpRatio = Math.max(0, player.caiQi / this.mpBase);
    this.mpBar.style.width = `${mpRatio * 100}%`;
    this.mpText.textContent = `${player.caiQi}/${this.mpBase}`;
  }

  /**
   * Show/hide the interaction prompt.
   */
  setInteractionPrompt(text: string): void {
    if (text === this.lastPromptText) return; // skip if unchanged
    this.lastPromptText = text;
    if (text) {
      this.interactionPromptEl.textContent = text;
      this.interactionPromptEl.classList.add('visible');
    } else {
      this.interactionPromptEl.classList.remove('visible');
    }
  }

  private showSaveIndicator(): void {
    this.saveIndicatorEl.classList.add('show');
    setTimeout(() => {
      this.saveIndicatorEl.classList.remove('show');
    }, 2000);
  }

  /**
   * Clean up event listeners. Call when destroying the HUD.
   */
  destroy(): void {
    this.stateManager.events.off('player-changed', this.boundOnPlayerChanged);
    this.stateManager.events.off('game-saved', this.boundOnGameSaved);
    this.container.remove();
  }
}
