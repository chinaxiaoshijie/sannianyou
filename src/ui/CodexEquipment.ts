import type { EquipmentManager } from '../systems/EquipmentManager';
import type { Equipment, Rarity } from '../types/equipment';

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#CCCCCC',
  rare: '#6495ED',
  epic: '#9B59B6',
  legendary: '#FF8C00',
};

const RARITY_LABELS: Record<Rarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

const SLOT_LABELS: Record<string, string> = {
  weapon: '武器',
  armor: '护甲',
  accessory: '饰品',
};

const EQUIPPED_BORDER = '#FBBF24';

/**
 * CodexEquipment — 经卷录子页面.
 *
 * Displays all equipment known to the player in a card grid.
 * Equipped items get a gold border highlight.
 */
export class CodexEquipment {
  private container: HTMLElement;
  private equipmentManager: EquipmentManager;
  private grid!: HTMLDivElement;
  private styleId = 'codex-equipment-styles';
  private boundOnEquipChanged: () => void;

  constructor(container: HTMLElement, equipmentManager: EquipmentManager) {
    this.container = container;
    this.equipmentManager = equipmentManager;
    this.boundOnEquipChanged = this.render.bind(this);

    this.buildDOM();
    this.injectStyles();
    this.equipmentManager.events.on('equipment-changed', this.boundOnEquipChanged);
    this.render();
  }

  /** Re-render the equipment grid. */
  render(): void {
    const all: Equipment[] = this.equipmentManager.getAll();
    const equippedIds = new Set<string>();

    const eq = this.equipmentManager.getEquipped();
    if (eq.weapon) equippedIds.add(eq.weapon.id);
    if (eq.armor) equippedIds.add(eq.armor.id);
    if (eq.accessory) equippedIds.add(eq.accessory.id);

    let html = '';
    for (const item of all) {
      const isEquipped = equippedIds.has(item.id);
      const rarityColor = RARITY_COLORS[item.rarity] ?? '#888';
      const rarityLabel = RARITY_LABELS[item.rarity] ?? item.rarity;
      const slotLabel = SLOT_LABELS[item.slot] ?? item.slot;

      html += `<div class="codex-equip-card" style="border-left: 4px solid ${rarityColor};${
        isEquipped ? ` box-shadow: 0 0 0 2px ${EQUIPPED_BORDER};` : ''
      }">`;
      html += `<div class="codex-equip-header">`;
      html += `<span class="codex-equip-name">${this.esc(item.name)}</span>`;
      html += `<span class="codex-equip-rarity" style="color:${rarityColor};border-color:${rarityColor}">${rarityLabel}</span>`;
      html += `</div>`;
      html += `<div class="codex-equip-meta">`;
      html += `<span>🎒 ${slotLabel}</span>`;
      html += `<span>🔒 KP ${item.kpReq}</span>`;
      html += `</div>`;
      html += `<div class="codex-equip-desc">${this.esc(item.visualDesc)}</div>`;
      if (isEquipped) {
        html += `<span class="codex-equip-equipped-tag">⚡ 已装备</span>`;
      }
      html += `</div>`;
    }

    if (all.length === 0) {
      html = `<div class="codex-equip-empty">暂无装备数据</div>`;
    }

    this.grid.innerHTML = html;
  }

  /** Remove event listener. */
  destroy(): void {
    this.equipmentManager.events.off('equipment-changed', this.boundOnEquipChanged);
  }

  private buildDOM(): void {
    this.grid = document.createElement('div');
    this.grid.className = 'codex-equipment-grid';
    this.container.appendChild(this.grid);
  }

  private injectStyles(): void {
    if (document.getElementById(this.styleId)) return;
    const style = document.createElement('style');
    style.id = this.styleId;
    style.textContent = `
      .codex-equipment-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 12px;
        justify-content: flex-start;
        width: 100%;
        box-sizing: border-box;
      }
      .codex-equip-card {
        position: relative;
        width: 220px;
        min-height: 100px;
        padding: 12px 14px;
        background: #1e1e2e;
        border-radius: 8px;
        color: #e0e0e0;
        font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
        transition: transform 0.15s, box-shadow 0.15s;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .codex-equip-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      }
      .codex-equip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .codex-equip-name {
        font-size: 14px;
        font-weight: 700;
        color: #f0f0f0;
      }
      .codex-equip-rarity {
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border: 1px solid;
        border-radius: 4px;
        white-space: nowrap;
      }
      .codex-equip-meta {
        font-size: 10px;
        color: #8888a0;
        display: flex;
        gap: 10px;
      }
      .codex-equip-desc {
        font-size: 11px;
        color: #b0b0c0;
        line-height: 1.45;
      }
      .codex-equip-equipped-tag {
        position: absolute;
        top: -6px;
        right: -6px;
        font-size: 10px;
        background: ${EQUIPPED_BORDER};
        color: #1a1a2e;
        padding: 1px 7px;
        border-radius: 4px;
        font-weight: 700;
      }
      .codex-equip-empty {
        width: 100%;
        text-align: center;
        color: #6a6a7a;
        padding: 32px;
        font-size: 14px;
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
