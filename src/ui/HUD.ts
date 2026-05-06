import type { StateManager } from '../core/StateManager';
import type { PlayerState, GameState } from '../types';

/**
 * HUD — always-visible HTML overlay showing player stats,
 * zone name, interaction prompt, and save indicator.
 * Subscribes to StateManager events for reactive updates.
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
  private zoneNameEl!: HTMLSpanElement;
  private interactionPromptEl!: HTMLDivElement;
  private saveIndicatorEl!: HTMLDivElement;

  // Last interaction prompt text (to avoid per-frame dom writes + log spam)
  private lastPromptText = '';

  // Event cleanup
  private boundOnPlayerChanged: (data: unknown) => void;
  private boundOnGameChanged: (data: unknown) => void;
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
    this.boundOnGameChanged = this.onGameChanged.bind(this);
    this.boundOnGameSaved = this.onGameSaved.bind(this);

    // Subscribe to state changes
    stateManager.events.on('player-changed', this.boundOnPlayerChanged);
    stateManager.events.on('game-changed', this.boundOnGameChanged);
    stateManager.events.on('game-saved', this.boundOnGameSaved);

    // Initial render
    this.refreshPlayer(stateManager.getPlayerState());
    this.refreshGame(stateManager.getGameState());
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
/* Top-left: player stats */
.hud-top-left {
  position: absolute;
  top: 12px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hud-rank-kp {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hud-rank {
  font-size: 14px;
  color: #c8a84e;
  font-weight: bold;
}
.hud-kp {
  font-size: 13px;
  color: #fbbf24;
}
.hud-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hud-bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.hud-bar-label {
  font-size: 10px;
  color: #9ca3af;
  width: 20px;
  text-align: right;
}
.hud-bar-outer {
  width: 120px;
  height: 8px;
  background: rgba(0,0,0,0.5);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
}
.hud-bar-inner {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.hud-bar-inner.hp { background: linear-gradient(90deg, #dc2626, #ef4444); }
.hud-bar-inner.mp { background: linear-gradient(90deg, #2563eb, #3b82f6); }
.hud-bar-text {
  font-size: 10px;
  color: #d1d5db;
  min-width: 60px;
}
/* Top-center: zone name */
.hud-zone {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: rgba(200,168,78,0.8);
  text-shadow: 0 0 8px rgba(200,168,78,0.3);
}
/* Top-right: compass */
.hud-compass {
  position: fixed;
  top: 12px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  pointer-events: all;
  transition: transform 0.15s;
}
.hud-compass:hover { transform: scale(1.15); }
.hud-compass:active { transform: scale(0.95); }
.hud-compass-n { font-size: 12px; color: #ef4444; font-weight: bold; }
.hud-compass-ew { font-size: 10px; color: #9ca3af; display: flex; gap: 16px; }
.hud-compass-s { font-size: 10px; color: #9ca3af; }
.hud-compass-dir { font-size: 10px; color: #c8a84e; margin-top: 2px; }
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
<div class="hud-zone" id="hud-zone">启程之门</div>
<div class="hud-compass" id="hud-compass">
  <span class="hud-compass-n">▲ N</span>
  <span class="hud-compass-ew"><span>W</span><span>E</span></span>
  <span class="hud-compass-s">▼ S</span>
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
    this.zoneNameEl = el.querySelector('#hud-zone')!;
    this.interactionPromptEl = el.querySelector('#hud-interact')!;
    this.saveIndicatorEl = el.querySelector('#hud-save-indicator')!;
  }

  private onPlayerChanged(data: unknown): void {
    this.refreshPlayer(data as PlayerState);
  }

  private onGameChanged(data: unknown): void {
    this.refreshGame(data as GameState);
  }

  private onGameSaved(): void {
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

  private refreshGame(game: GameState): void {
    // Map zone IDs to display names
    const zoneNames: Record<string, string> = {
      south: '启程之门',
      central: '知识之殿',
      north: '竞技之巅',
      northwest: '实验秘境',
    };
    this.zoneNameEl.textContent = zoneNames[game.currentZone] ?? game.currentZone;
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
    this.stateManager.events.off('game-changed', this.boundOnGameChanged);
    this.stateManager.events.off('game-saved', this.boundOnGameSaved);
    this.container.remove();
  }
}
