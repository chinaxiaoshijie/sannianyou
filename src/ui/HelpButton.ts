/**
 * HelpButton — "?" button that shows game controls overlay.
 * Monument Valley style pink card with gold accents.
 */
export class HelpButton {
  private container: HTMLDivElement;
  private overlay: HTMLDivElement | null = null;

  constructor() {
    this.container = this.createButton();
    document.body.appendChild(this.container);
  }

  private createButton(): HTMLDivElement {
    const el = document.createElement('div');
    el.innerHTML = `
<style>
#help-btn {
  position: fixed;
  bottom: 24px;
  left: 24px;
  z-index: 200;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(200,168,78,0.9), rgba(180,148,58,0.85));
  border: 2px solid rgba(200,168,78,0.6);
  color: #1a120c;
  font-size: 22px;
  font-weight: bold;
  font-family: 'Microsoft YaHei', sans-serif;
  cursor: pointer;
  pointer-events: all;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(200,168,78,0.3);
  transition: transform 0.15s, box-shadow 0.15s;
  user-select: none;
}
#help-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(200,168,78,0.5);
}
#help-btn:active {
  transform: scale(0.95);
}
#help-overlay {
  position: fixed;
  inset: 0;
  z-index: 250;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
#help-overlay.hidden {
  display: none;
}
.help-card {
  background: linear-gradient(135deg, rgba(30,22,14,0.97), rgba(20,14,8,0.97));
  border: 1px solid rgba(200,168,78,0.4);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(200,168,78,0.1);
  padding: 28px 32px;
  max-width: 440px;
  width: 90%;
  text-align: center;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  animation: help-fade-in 0.3s ease;
}
@keyframes help-fade-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.help-card h2 {
  font-size: 20px;
  color: #c8a84e;
  margin: 0 0 20px 0;
  text-shadow: 0 0 8px rgba(200,168,78,0.4);
}
.help-section {
  margin-bottom: 16px;
  text-align: left;
}
.help-section h3 {
  font-size: 13px;
  color: #c8a84e;
  margin: 0 0 6px 0;
  border-bottom: 1px solid rgba(200,168,78,0.2);
  padding-bottom: 4px;
}
.help-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 12px;
  color: #c4b998;
  gap: 16px;
}
.help-key {
  background: rgba(200,168,78,0.15);
  border: 1px solid rgba(200,168,78,0.3);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  color: #c8a84e;
  font-family: monospace;
  min-width: 32px;
  text-align: center;
}
.help-close {
  margin-top: 20px;
  background: rgba(200,168,78,0.15);
  border: 1px solid rgba(200,168,78,0.4);
  border-radius: 8px;
  color: #c8a84e;
  padding: 8px 28px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.help-close:hover {
  background: rgba(200,168,78,0.3);
}
</style>
<div id="help-btn">?</div>
`;
    return el;
  }

  init(): void {
    const btn = document.getElementById('help-btn');
    if (!btn) return;

    btn.addEventListener('click', () => this.show());
    // Also listen for keypress 'H' or '?'
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && !this.overlay) {
        this.show();
      }
      if (e.code === 'Escape' && this.overlay) {
        this.hide();
      }
    });
  }

  private show(): void {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'help-overlay';
    this.overlay.innerHTML = `
<div class="help-card">
  <h2>📖 游戏指南</h2>
  <div class="help-section">
    <h3>移动</h3>
    <div class="help-row"><span>移动角色</span><span><span class="help-key">W A S D</span></span></div>
    <div class="help-row"><span>闪避翻滚</span><span><span class="help-key">空格</span></span></div>
  </div>
  <div class="help-section">
    <h3>交互</h3>
    <div class="help-row"><span>建筑交互</span><span><span class="help-key">E</span></span></div>
    <div class="help-row"><span>释放法则 1/2/3</span><span><span class="help-key">1 2 3</span></span></div>
  </div>
  <div class="help-section">
    <h3>面板</h3>
    <div class="help-row"><span>法则/装备面板</span><span><span class="help-key">C</span></span></div>
    <div class="help-row"><span>校园地图</span><span><span class="help-key">M</span></span></div>
    <div class="help-row"><span>学海图卷</span><span><span class="help-key">J</span></span></div>
    <div class="help-row"><span>切换视角</span><span><span class="help-key">Tab</span></span></div>
  </div>
  <div class="help-section">
    <h3>战斗</h3>
    <div class="help-row"><span>走到图书馆前触发BOSS</span><span></span></div>
    <div class="help-row"><span>按数字键释放法则攻击</span><span></span></div>
    <div class="help-row"><span>空格闪避红色预警区域</span><span></span></div>
  </div>
  <button class="help-close" id="help-close">关闭</button>
</div>`;

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    document.body.appendChild(this.overlay);

    const closeBtn = this.overlay.querySelector('#help-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
  }

  private hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  destroy(): void {
    this.hide();
    this.container.remove();
  }
}
