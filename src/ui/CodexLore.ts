import type { StateManager } from '../core/StateManager';

/**
 * CodexLore — 校史子页面.
 *
 * Displays school history and world lore entries.
 * Content is unlocked based on game events tracked in StateManager.
 */
export class CodexLore {
  private container: HTMLElement;
  private stateManager: StateManager;
  private inner: HTMLDivElement;
  private styleId = 'codex-lore-styles';

  constructor(container: HTMLElement, stateManager: StateManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.inner = document.createElement('div');
    this.inner.className = 'codex-lore-inner';
    this.container.appendChild(this.inner);

    this.injectStyles();
    this.render();
  }

  /** Re-render lore entries. */
  render(): void {
    const gameState = this.stateManager.getGameState();
    const defeatedCount = (gameState.defeatedDemons ?? []).length;
    const playerState = this.stateManager.getPlayerState();

    const entries = this.getLoreEntries(defeatedCount);

    let html = '<div class="codex-lore-list">';

    for (const entry of entries) {
      html += `<div class="codex-lore-entry">`;
      html += `<div class="codex-lore-title">${this.esc(entry.title)}</div>`;
      html += `<div class="codex-lore-body">${this.esc(entry.body)}</div>`;
      html += `</div>`;
    }

    html += '</div>';

    if (entries.length === 0) {
      html = `<div class="codex-lore-empty">暂无校史记录。探索校园、战胜惑障，解锁更多故事...</div>`;
    }

    this.inner.innerHTML = html;
  }

  destroy(): void {
    this.inner.remove();
  }

  private getLoreEntries(defeatedCount: number): { title: string; body: string }[] {
    const entries: { title: string; body: string }[] = [];

    // Always-visible entries
    entries.push({
      title: '三年游',
      body: '深中高中园，一所建立在知识之上的学府。学子们在此研习九科，以道行为阶梯，攀登学业之峰。',
    });

    entries.push({
      title: '图卷',
      body: '图卷记录着你在校园中的一切发现——击败的惑障、掌握的法则、收集的经卷，以及校园的古老历史。',
    });

    if (defeatedCount >= 1) {
      entries.push({
        title: '遗忘·残卷',
        body: '一本被遗忘在图书馆的古籍。它的书页散落各处，据说记载着失传的物理法则。击败它后，残卷化作一张法则之页，融入了你的知识体系。',
      });
    }

    return entries;
  }

  private injectStyles(): void {
    if (document.getElementById(this.styleId)) return;
    const style = document.createElement('style');
    style.id = this.styleId;
    style.textContent = `
      .codex-lore-inner {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
      }
      .codex-lore-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }
      .codex-lore-entry {
        background: #1e1e2e;
        border-radius: 8px;
        padding: 16px 20px;
        border-left: 4px solid #c8a84e;
      }
      .codex-lore-title {
        font-size: 16px;
        font-weight: 700;
        color: #fbbf24;
        margin-bottom: 8px;
        font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      }
      .codex-lore-body {
        font-size: 13px;
        color: #d1d5db;
        line-height: 1.7;
        font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      }
      .codex-lore-empty {
        width: 100%;
        text-align: center;
        color: #6a6a7a;
        padding: 48px 32px;
        font-size: 14px;
        font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
        line-height: 1.8;
      }
    `;
    document.head.appendChild(style);
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
