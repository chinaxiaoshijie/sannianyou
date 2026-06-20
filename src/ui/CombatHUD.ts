import type { DropMaterial } from '../types/equipment';

const PHASE_NAMES: Record<number, string> = {
  0: '卷轴初展',
  1: '纸墙围困',
  2: '古籍崩解',
};

/**
 * CombatHUD — top-center boss HP bar, floating combat messages,
 * and post-battle result panel.
 */
export class CombatHUD {
  private container: HTMLDivElement;
  private hpBarEl: HTMLDivElement;
  private hpTextEl: HTMLSpanElement;
  private nameEl: HTMLDivElement;
  private weaknessEl: HTMLDivElement;
  private msgContainer: HTMLDivElement;
  private endPanel: HTMLDivElement | null = null;

  // HP transition
  private targetHP = 1;
  private displayedHP = 1;

  constructor() {
    this.container = this.createBossBar();
    this.hpBarEl = this.container.querySelector('#chud-hp-bar')!;
    this.hpTextEl = this.container.querySelector('#chud-hp-text')!;
    this.nameEl = this.container.querySelector('#chud-name')!;
    this.weaknessEl = this.container.querySelector('#chud-weakness')!;
    this.msgContainer = this.createMessageContainer();
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
    document.body.appendChild(this.msgContainer);
  }

  /** Show the HUD. */
  show(): void {
    this.container.style.display = 'block';
  }

  /** Hide the HUD. */
  hide(): void {
    this.container.style.display = 'none';
    this.removeEndPanel();
  }

  /** Update boss HP bar. */
  updateBossHP(hp: number, maxHP: number, phaseIndex: number, weaknessActive: boolean): void {
    this.targetHP = hp / maxHP;
    // Smooth transition
    this.displayedHP += (this.targetHP - this.displayedHP) * 0.15;

    this.hpBarEl.style.width = `${this.displayedHP * 100}%`;
    this.hpTextEl.textContent = `${Math.ceil(hp)}/${maxHP}`;

    const phaseName = PHASE_NAMES[phaseIndex] ?? '';
    this.nameEl.textContent = phaseName ? `遗忘·残卷 — ${phaseName}` : '遗忘·残卷';

    this.weaknessEl.style.display = weaknessActive ? 'block' : 'none';
  }

  /** Show a floating combat message. */
  showCombatMessage(text: string, type: 'dodge' | 'hit' | 'weakness' | 'phase' | 'error'): void {
    const el = document.createElement('div');
    el.textContent = text;
    el.className = 'combat-float-msg';

    const colors: Record<string, string> = {
      dodge: '#60a5fa',
      hit: '#fbbf24',
      weakness: '#ef4444',
      phase: '#f472b6',
      error: '#f87171',
    };
    const fontSizes: Record<string, string> = {
      dodge: '16px',
      hit: '18px',
      weakness: '20px',
      phase: '24px',
      error: '15px',
    };

    el.style.color = colors[type] ?? '#fff';
    el.style.fontSize = fontSizes[type] ?? '16px';

    if (type === 'weakness') {
      el.style.textShadow = '0 0 12px rgba(239,68,68,0.8)';
    } else if (type === 'phase') {
      el.style.textShadow = '0 0 16px rgba(244,114,182,0.8)';
    } else if (type === 'error') {
      el.style.textShadow = '0 0 8px rgba(248,113,113,0.6)';
    }

    this.msgContainer.appendChild(el);

    // Animate: float up and fade out
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(-60px)';
      el.style.opacity = '0';
    });

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1500);
  }

  /** Show the post-battle result panel. */
  showEndPanel(
    victory: boolean,
    rewards?: {
      kp: number;
      lingShi: number;
      materials: DropMaterial[];
      lawPageId: string;
    },
  ): void {
    this.removeEndPanel();

    const panel = document.createElement('div');
    panel.id = 'chud-end-panel';
    panel.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 300;
      background: rgba(20, 14, 8, 0.94);
      border: 2px solid rgba(200, 168, 78, 0.4);
      border-radius: 16px;
      padding: 28px 36px;
      min-width: 320px;
      text-align: center;
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      box-shadow: 0 8px 48px rgba(0,0,0,0.6);
      animation: chud-panel-in 0.4s ease;
    `;

    // Inject keyframes if not already present
    if (!document.getElementById('chud-panel-keyframes')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'chud-panel-keyframes';
      styleEl.textContent = `
        @keyframes chud-panel-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `;
      document.head.appendChild(styleEl);
    }

    if (victory) {
      panel.innerHTML = this.victoryPanelHTML(rewards);
      panel.style.borderColor = 'rgba(74,222,128,0.5)';
    } else {
      panel.innerHTML = `
        <div style="font-size:28px;color:#f87171;font-weight:bold;margin-bottom:8px;">学海无涯</div>
        <div style="font-size:14px;color:#d1d5db;">你被传送回了学舍。再试一次——你比以前更强了。</div>
      `;
      panel.style.borderColor = 'rgba(248,113,113,0.5)';
    }

    document.body.appendChild(panel);
    this.endPanel = panel;

    // Auto-dismiss after 4s
    setTimeout(() => {
      this.removeEndPanel();
    }, 4000);
  }

  destroy(): void {
    this.container.remove();
    this.msgContainer.remove();
    this.removeEndPanel();
  }

  /* ────── Private ────── */

  private createBossBar(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = 'combat-hud';
    el.innerHTML = `
<style>
#combat-hud {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  z-index: 150; pointer-events: none; text-align: center;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
#chud-name {
  color: #ff8844; font-size: 14px; font-weight: bold; margin-bottom: 4px;
  text-shadow: 0 0 8px rgba(255,136,68,0.5);
}
#chud-bar-outer {
  width: 300px; height: 12px; background: rgba(0,0,0,0.5);
  border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,136,68,0.3);
}
#chud-hp-bar {
  height: 100%; background: linear-gradient(90deg, #dc2626, #ef4444);
  border-radius: 5px; transition: width 0.3s ease;
}
#chud-hp-text {
  color: #d1d5db; font-size: 10px; margin-top: 2px; display: block;
}
#chud-weakness {
  color: #4ade80; font-size: 12px; margin-top: 4px; display: none;
  text-shadow: 0 0 6px rgba(74,222,128,0.5);
}
</style>
<div id="chud-name">遗忘·残卷</div>
<div id="chud-bar-outer"><div id="chud-hp-bar" style="width:100%"></div></div>
<span id="chud-hp-text">200/200</span>
<div id="chud-weakness">⚡ 破绽！按 1/2/3 释放法则</div>
`;
    return el;
  }

  private createMessageContainer(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = 'combat-msg-container';
    el.style.cssText = `
      position: fixed; top: 90px; left: 50%; transform: translateX(-50%);
      z-index: 160; pointer-events: none; text-align: center;
      font-family: 'Microsoft YaHei', sans-serif;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
    `;
    return el;
  }

  private victoryPanelHTML(rewards?: { kp: number; lingShi: number; materials: DropMaterial[]; lawPageId: string }): string {
    let rewardsHTML = '';
    if (rewards) {
      rewardsHTML = `
        <div style="display:flex;gap:24px;justify-content:center;margin:12px 0;">
          <div style="text-align:center;">
            <div style="color:#fbbf24;font-size:12px;">道行</div>
            <div style="color:#fbbf24;font-size:22px;font-weight:bold;">+${rewards.kp}</div>
          </div>
          <div style="text-align:center;">
            <div style="color:#a78bfa;font-size:12px;">灵石</div>
            <div style="color:#a78bfa;font-size:22px;font-weight:bold;">+${rewards.lingShi}</div>
          </div>
          ${rewards.lawPageId ? `
          <div style="text-align:center;">
            <div style="color:#60a5fa;font-size:12px;">法则残页</div>
            <div style="color:#60a5fa;font-size:14px;font-weight:bold;">${rewards.lawPageId}</div>
          </div>
          ` : ''}
        </div>
        ${rewards.materials.length > 0 ? `
        <div style="font-size:12px;color:#9ca3af;margin-top:4px;">
          材料: ${rewards.materials.map((m: DropMaterial) => `${m.name} ×${m.count}`).join('、')}
        </div>
        ` : ''}
      `;
    }

    return `
      <div style="font-size:28px;color:#4ade80;font-weight:bold;margin-bottom:4px;">道心不灭!</div>
      <div style="font-size:14px;color:#d1d5db;margin-bottom:8px;">遗忘·残卷 已消散</div>
      ${rewardsHTML}
    `;
  }

  private removeEndPanel(): void {
    if (this.endPanel) {
      this.endPanel.remove();
      this.endPanel = null;
    }
  }
}
