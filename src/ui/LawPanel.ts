import { LawManager } from '../core/LawManager';
import type { EquipmentManager } from '../systems/EquipmentManager';
import type { Law } from '../types/equipment';

const TIER_COLORS: Record<string, string> = {
  L0: '#9CA3AF',
  L1: '#4ADE80',
  L2: '#60A5FA',
  L3: '#FBBF24',
};

const TIER_LABELS: Record<string, string> = {
  L0: '感知',
  L1: '基础',
  L2: '进阶',
  L3: '组合',
};

type PanelTab = 'laws' | 'equipment';

export class LawPanel {
  private overlay: HTMLDivElement;
  private lawManager: LawManager;
  private equipmentManager: EquipmentManager | null = null;
  private _isOpen = false;
  private activeTab: PanelTab = 'laws';

  private boundOnKeydown: (e: KeyboardEvent) => void;
  private boundOnLawsChanged: () => void;
  private boundOnEquipmentChanged: () => void;

  constructor(lawManager: LawManager, equipmentManager?: EquipmentManager) {
    this.lawManager = lawManager;
    this.equipmentManager = equipmentManager ?? null;
    this.overlay = this.createOverlay();
    this.overlay.style.display = 'none';
    document.body.appendChild(this.overlay);

    this.boundOnKeydown = this.onKeydown.bind(this);
    this.boundOnLawsChanged = this.onLawsChanged.bind(this);
    this.boundOnEquipmentChanged = this.onEquipmentChanged.bind(this);

    this.lawManager.events.on('laws-changed', this.boundOnLawsChanged);
    this.equipmentManager?.events.on('equipment-changed', this.boundOnEquipmentChanged);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  toggle(): void {
    this._isOpen ? this.close() : this.open();
  }

  open(): void {
    this._isOpen = true;
    this.overlay.style.display = 'flex';
    this.render();
    window.addEventListener('keydown', this.boundOnKeydown);
  }

  close(): void {
    this._isOpen = false;
    this.overlay.style.display = 'none';
    window.removeEventListener('keydown', this.boundOnKeydown);
  }

  private onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
  }

  private onLawsChanged(): void {
    if (this._isOpen) this.render();
  }

  private onEquipmentChanged(): void {
    if (this._isOpen) this.render();
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'law-panel-overlay';
    overlay.innerHTML = this.getStyles();
    this.cacheElements(overlay);
    return overlay;
  }

  private mask!: HTMLDivElement;
  private content!: HTMLDivElement;

  private cacheElements(overlay: HTMLElement): void {
    this.mask = overlay.querySelector('#law-panel-mask')!;
    this.content = overlay.querySelector('#law-panel-content')!;
    this.mask.addEventListener('click', () => this.close());
  }

  private getStyles(): string {
    return `
<style>
#law-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: none;
  align-items: center;
  justify-content: center;
}
#law-panel-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  cursor: pointer;
}
#law-panel-content {
  position: relative;
  z-index: 1;
  width: 480px;
  max-height: 85vh;
  background: #FDE8E0;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.law-panel-header {
  padding: 16px 20px;
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  color: #5a4a3a;
  border-bottom: 2px solid #E8D5C4;
}
/* Tab navigation */
.law-panel-tabs {
  display: flex;
  border-bottom: 2px solid #E8D5C4;
}
.law-panel-tab {
  flex: 1;
  padding: 10px;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  color: #8a7a6a;
  background: #F5DDD3;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  border: none;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.law-panel-tab.active {
  background: #FDE8E0;
  color: #5a4a3a;
  border-bottom: 2px solid #c8a84e;
}
.law-panel-tab:hover:not(.active) {
  background: #e8d0c0;
}
.law-panel-equipped {
  padding: 12px 20px;
  display: flex;
  gap: 12px;
  background: #F5DDD3;
}
.law-slot-btn {
  flex: 1;
  padding: 10px 8px;
  background: #E8D5C4;
  border: 2px solid #d4b896;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}
.law-slot-btn:hover {
  border-color: #c8a84e;
  background: #e0c9b0;
}
.law-slot-btn .slot-label {
  font-size: 10px;
  color: #9a8a7a;
  margin-bottom: 4px;
}
.law-slot-btn .slot-name {
  font-size: 13px;
  font-weight: bold;
  color: #3a3a3a;
}
.law-slot-btn .slot-hint {
  font-size: 10px;
  color: #c0392b;
  margin-top: 4px;
}
.law-panel-list {
  padding: 12px 20px 20px;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.law-panel-list::-webkit-scrollbar { width: 6px; }
.law-panel-list::-webkit-scrollbar-track { background: #FDE8E0; }
.law-panel-list::-webkit-scrollbar-thumb { background: #d4b896; border-radius: 3px; }
.law-card {
  padding: 12px;
  background: #E8D5C4;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  border-left: 3px solid #9CA3AF;
}
.law-card:hover {
  background: #dcc8b4;
  transform: translateX(4px);
}
.law-card .law-name {
  font-size: 14px;
  font-weight: bold;
  color: #3a3a3a;
}
.law-card .law-tier {
  font-size: 11px;
  margin-left: 8px;
}
.law-card .law-meta {
  font-size: 11px;
  color: #8a7a6a;
  margin-top: 4px;
  display: flex;
  gap: 12px;
}
.law-card .law-effect {
  font-size: 11px;
  color: #6a5a4a;
  margin-top: 6px;
  line-height: 1.4;
}
.law-card .law-chapter {
  font-size: 10px;
  color: #9a8a7a;
  margin-top: 4px;
}
/* Equipment styles */
.eq-equipped-section {
  padding: 12px 20px;
  display: flex;
  gap: 12px;
  background: #F5DDD3;
}
.eq-slot-card {
  flex: 1;
  padding: 10px 8px;
  background: #E8D5C4;
  border: 2px solid #d4b896;
  border-radius: 8px;
  text-align: center;
}
.eq-slot-card.equipped {
  border-color: #c8a84e;
  background: #f0e0d0;
}
.eq-slot-card .eq-slot-label {
  font-size: 10px;
  color: #9a8a7a;
  margin-bottom: 4px;
}
.eq-slot-card .eq-slot-name {
  font-size: 13px;
  font-weight: bold;
}
.eq-slot-card .eq-slot-empty {
  font-size: 13px;
  color: #aaa;
}
.eq-slot-card .eq-slot-hint {
  font-size: 10px;
  color: #c0392b;
  margin-top: 4px;
  cursor: pointer;
}
.eq-card {
  padding: 12px;
  background: #E8D5C4;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  border-left: 3px solid #CCCCCC;
}
.eq-card:hover {
  background: #dcc8b4;
  transform: translateX(4px);
}
.eq-card.eq-locked {
  opacity: 0.5;
  cursor: not-allowed;
}
.eq-card.eq-locked:hover {
  transform: none;
  background: #E8D5C4;
}
.eq-card .eq-name {
  font-size: 14px;
  font-weight: bold;
}
.eq-card .eq-rarity {
  font-size: 11px;
  margin-left: 8px;
}
.eq-card .eq-mechanism {
  font-size: 11px;
  color: #6a5a4a;
  margin-top: 6px;
  line-height: 1.4;
}
.eq-card .eq-locked-hint {
  font-size: 10px;
  color: #9a8a7a;
  margin-top: 4px;
}
</style>
<div id="law-panel-mask"></div>
<div id="law-panel-content"></div>
`;
  }

  private render(): void {
    const content = this.content;
    const equipped = this.lawManager.getSlots();
    const unlocked = this.lawManager.getUnlockedLaws();

    let html = `<div class="law-panel-header">人物面板 · C关闭 / ESC关闭</div>`;

    // Tab navigation
    html += `<div class="law-panel-tabs">`;
    html += `<button class="law-panel-tab ${this.activeTab === 'laws' ? 'active' : ''}" data-tab="laws">法则</button>`;
    html += `<button class="law-panel-tab ${this.activeTab === 'equipment' ? 'active' : ''}" data-tab="equipment">装备</button>`;
    html += `</div>`;

    if (this.activeTab === 'laws') {
      html += this.renderLawsTab(equipped, unlocked);
    } else {
      html += this.renderEquipmentTab();
    }

    content.innerHTML = html;

    // Bind tab switches
    content.querySelectorAll('[data-tab]').forEach((el) => {
      el.addEventListener('click', () => {
        this.activeTab = (el as HTMLElement).dataset.tab as PanelTab;
        this.render();
      });
    });

    // Bind law equip/unequip
    if (this.activeTab === 'laws') {
      content.querySelectorAll('[data-equip]').forEach((el) => {
        el.addEventListener('click', () => {
          const lawId = (el as HTMLElement).dataset.equip!;
          this.equipToFirstEmpty(lawId);
        });
      });

      content.querySelectorAll('[data-unequip]').forEach((el) => {
        el.addEventListener('click', () => {
          const slot = parseInt((el as HTMLElement).dataset.unequip!, 10);
          this.lawManager.unequipSlot(slot);
        });
      });
    }

    // Bind equipment equip/unequip
    if (this.activeTab === 'equipment' && this.equipmentManager) {
      content.querySelectorAll('[data-equip-eq]').forEach((el) => {
        el.addEventListener('click', () => {
          const itemId = (el as HTMLElement).dataset.equipEq!;
          this.equipmentManager!.equip(itemId);
        });
      });

      content.querySelectorAll('[data-unequip-eq]').forEach((el) => {
        el.addEventListener('click', () => {
          const slot = (el as HTMLElement).dataset.unequipEq as 'weapon' | 'armor' | 'accessory';
          this.equipmentManager!.unequip(slot);
        });
      });
    }
  }

  private renderLawsTab(equipped: { law: Law | null; cooldownRemaining: number }[], unlocked: Law[]): string {
    let html = '';

    // Equipped slots
    html += `<div class="law-panel-equipped">`;
    for (let i = 0; i < 3; i++) {
      const slot = equipped[i];
      if (slot.law) {
        const law = slot.law as Law;
        html += `
          <div class="law-slot-btn" data-unequip="${i}">
            <div class="slot-label">槽位 ${i + 1}</div>
            <div class="slot-name" style="color:${TIER_COLORS[law.tier]}">${law.name}</div>
            <div class="slot-hint">点击卸下</div>
          </div>`;
      } else {
        html += `
          <div class="law-slot-btn">
            <div class="slot-label">槽位 ${i + 1}</div>
            <div class="slot-name" style="color:#aaa">空</div>
          </div>`;
      }
    }
    html += `</div>`;

    // Unlocked laws list
    html += `<div class="law-panel-list">`;
    for (const law of unlocked) {
      const alreadyEquipped = equipped.some((s) => s.law?.id === law.id);
      if (alreadyEquipped) continue;

      html += `
        <div class="law-card" data-equip="${law.id}" style="border-left-color:${TIER_COLORS[law.tier]}">
          <div class="law-name">${law.name}<span class="law-tier" style="color:${TIER_COLORS[law.tier]}">${TIER_LABELS[law.tier]}</span></div>
          <div class="law-meta">
            <span>冷却: ${law.cooldown}s</span>
            <span>消耗: ${law.cost} 才气</span>
          </div>
          <div class="law-effect">${law.effectDesc}</div>
          <div class="law-chapter">${law.chapter}</div>
        </div>`;
    }
    if (unlocked.length === 0) {
      html += `<div style="text-align:center;color:#9a8a7a;padding:20px;">尚未解锁任何法则 — 去修炼吧</div>`;
    }
    html += `</div>`;

    return html;
  }

  private renderEquipmentTab(): string {
    if (!this.equipmentManager) {
      return `<div class="law-panel-list"><div style="text-align:center;color:#9a8a7a;padding:20px;">装备系统未可用</div></div>`;
    }

    let html = '';
    const equipped = this.equipmentManager.getEquipped();

    // Equipped slots
    const slotLabels: Record<string, string> = { weapon: '武器', armor: '护甲', accessory: '饰品' };
    html += `<div class="eq-equipped-section">`;
    for (const slot of ['weapon', 'armor', 'accessory'] as const) {
      const item = equipped[slot];
      if (item) {
        const rarity = this.equipmentManager.getRarityConfig(item.rarity);
        html += `
          <div class="eq-slot-card equipped">
            <div class="eq-slot-label">${slotLabels[slot]}</div>
            <div class="eq-slot-name" style="color:${rarity.color}">${item.name}</div>
            <div class="eq-slot-hint" data-unequip-eq="${slot}">点击卸下</div>
          </div>`;
      } else {
        html += `
          <div class="eq-slot-card">
            <div class="eq-slot-label">${slotLabels[slot]}</div>
            <div class="eq-slot-empty">空</div>
          </div>`;
      }
    }
    html += `</div>`;

    // All equipment list
    html += `<div class="law-panel-list">`;
    const allEq = this.equipmentManager.getAll();
    for (const eq of allEq) {
      const rarity = this.equipmentManager.getRarityConfig(eq.rarity);
      const isEquipped = this.equipmentManager.isEquipped(eq.id);
      const isLocked = eq.kpReq > 0 && this.equipmentManager.getAll()
        .length > 0; // We check availability below

      const available = this.equipmentManager.getAvailable();
      const isAvailable = available.some((a) => a.id === eq.id);

      if (isEquipped) continue; // Skip already-equipped items from the list

      if (isAvailable) {
        html += `
          <div class="eq-card" data-equip-eq="${eq.id}" style="border-left-color:${rarity.color}">
            <div class="eq-name">${eq.name}<span class="eq-rarity" style="color:${rarity.color}">${rarity.name}</span></div>
            <div class="eq-mechanism">${eq.mechanism.effect}</div>
          </div>`;
      } else {
        html += `
          <div class="eq-card eq-locked" style="border-left-color:${rarity.color}">
            <div class="eq-name" style="color:${rarity.color}">${eq.name}<span class="eq-rarity">${rarity.name}</span></div>
            <div class="eq-locked-hint">需要道行 ${eq.kpReq} 解锁</div>
          </div>`;
      }
    }
    html += `</div>`;

    return html;
  }

  private equipToFirstEmpty(lawId: string): void {
    const slots = this.lawManager.getSlots();
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i].law) {
        this.lawManager.equipLaw(i, lawId);
        return;
      }
    }
  }

  destroy(): void {
    this.lawManager.events.off('laws-changed', this.boundOnLawsChanged);
    this.equipmentManager?.events.off('equipment-changed', this.boundOnEquipmentChanged);
    this.overlay.remove();
  }
}
