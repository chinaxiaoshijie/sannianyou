/**
 * CodexPanel — J 键打开图卷覆盖层面板。
 * 从右侧滑入，包含四个标签页：惑障录、法则典、经卷录、校史。
 * Sub-panels render into contentContainer; CodexPanel manages tab visibility.
 * 纪念碑谷风格 — 深色背景、金色边框。
 */

import type { StateManager } from '../core/StateManager';
import type { LawManager } from '../core/LawManager';
import type { EquipmentManager } from '../systems/EquipmentManager';
import { CodexBestiary } from './CodexBestiary';
import { CodexLawTome } from './CodexLawTome';
import { CodexEquipment } from './CodexEquipment';
import { CodexLore } from './CodexLore';

type TabId = 'afflictions' | 'laws' | 'scrolls' | 'history';

const TABS: { id: TabId; label: string }[] = [
  { id: 'afflictions', label: '惑障录' },
  { id: 'laws',        label: '法则典' },
  { id: 'scrolls',     label: '经卷录' },
  { id: 'history',     label: '校史' },
];

const TAB_ROOT_SELECTOR: Record<TabId, string> = {
  afflictions: '.codex-bestiary',
  laws:        '.codex-law-tome-wrapper',
  scrolls:     '.codex-equipment-grid',
  history:     '.codex-lore-inner',
};

const SLIDE_DURATION_MS = 350;

export class CodexPanel {
  private overlay: HTMLDivElement;
  private mask!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private _contentContainer!: HTMLDivElement;
  private _isOpen = false;
  private _activeTab: TabId = 'afflictions';
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  private boundOnKeydown: (e: KeyboardEvent) => void;

  // Sub-pages
  private bestiary!: CodexBestiary;
  private lawTome!: CodexLawTome;
  private equipment!: CodexEquipment;
  private lore!: CodexLore;

  constructor(
    stateManager: StateManager,
    lawManager: LawManager,
    equipmentManager: EquipmentManager,
  ) {
    this.boundOnKeydown = this.onKeydown.bind(this);
    this.overlay = this.createOverlay();
    this.overlay.style.display = 'none';
    document.body.appendChild(this.overlay);

    // Create sub-pages inside contentContainer
    this.bestiary = new CodexBestiary(this._contentContainer, stateManager);
    const lawWrapper = document.createElement('div');
    lawWrapper.className = 'codex-law-tome-wrapper';
    this._contentContainer.appendChild(lawWrapper);
    this.lawTome = new CodexLawTome(lawWrapper, lawManager);
    this.equipment = new CodexEquipment(this._contentContainer, equipmentManager);
    this.lore = new CodexLore(this._contentContainer, stateManager);

    // Show only the default tab content
    this.showActiveTabContent();
  }

  /** Whether the panel is currently open (animating counts as open). */
  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * The scrollable content container where sub-panels render their content.
   * Consumers set innerHTML or append children to this element.
   */
  get contentContainer(): HTMLDivElement {
    return this._contentContainer;
  }

  /** Toggle the panel open / closed. */
  toggle(): void {
    this._isOpen ? this.close() : this.open();
  }

  /**
   * Programmatically switch to a specific tab.
   * @param tabId One of 'afflictions' | 'laws' | 'scrolls' | 'history'
   */
  showTab(tabId: string): void {
    const tab = TABS.find((t) => t.id === tabId);
    if (!tab) return;
    this._activeTab = tab.id;
    this.updateActiveTabUI();
    this.showActiveTabContent();
  }

  // ---- Internal ----

  private open(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this._isOpen = true;
    this.overlay.style.display = 'block';
    // Force reflow so the CSS transition fires from translateX(100%)
    void this.panel.offsetWidth;
    this.panel.classList.add('open');
    window.addEventListener('keydown', this.boundOnKeydown);
  }

  private close(): void {
    this._isOpen = false;
    this.panel.classList.remove('open');
    window.removeEventListener('keydown', this.boundOnKeydown);
    this.closeTimer = setTimeout(() => {
      if (!this._isOpen) {
        this.overlay.style.display = 'none';
      }
      this.closeTimer = null;
    }, SLIDE_DURATION_MS);
  }

  private onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' || e.code === 'KeyJ') {
      e.preventDefault();
      this.close();
    }
  }

  private updateActiveTabUI(): void {
    this.panel.querySelectorAll('.codex-tab').forEach((el) => {
      const tabEl = el as HTMLElement;
      const isActive = tabEl.dataset.tab === this._activeTab;
      tabEl.classList.toggle('active', isActive);
    });
  }

  /** Show only the content for the currently active tab. */
  private showActiveTabContent(): void {
    // Hide all sub-page roots
    const allSelectors = Object.values(TAB_ROOT_SELECTOR).join(', ');
    this._contentContainer.querySelectorAll(allSelectors).forEach((el) => {
      (el as HTMLElement).style.display = 'none';
    });

    // Show active
    const activeSelector = TAB_ROOT_SELECTOR[this._activeTab];
    const activeEl = this._contentContainer.querySelector(activeSelector);
    if (activeEl) {
      (activeEl as HTMLElement).style.display = '';
    }

    // Refresh the active sub-page content
    switch (this._activeTab) {
      case 'afflictions':
        this.bestiary.refresh();
        break;
      case 'laws':
        this.lawTome.render();
        break;
      case 'scrolls':
        this.equipment.render();
        break;
      case 'history':
        this.lore.render();
        break;
    }
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'codex-panel-overlay';
    overlay.innerHTML = this.buildHTML();
    this.cacheElements(overlay);
    this.bindTabEvents();
    this.mask.addEventListener('click', () => this.close());
    return overlay;
  }

  private cacheElements(overlay: HTMLElement): void {
    this.mask = overlay.querySelector('#codex-panel-mask')!;
    this.panel = overlay.querySelector('#codex-panel')!;
    this._contentContainer = overlay.querySelector('#codex-content')!;
  }

  private bindTabEvents(): void {
    this.panel.querySelectorAll('.codex-tab').forEach((el) => {
      el.addEventListener('click', () => {
        const tabId = (el as HTMLElement).dataset.tab as TabId;
        this.showTab(tabId);
      });
    });
  }

  private buildHTML(): string {
    const tabButtons = TABS.map(
      (t, i) =>
        `<button class="codex-tab${i === 0 ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('\n        ');

    return `
<style>
#codex-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 220;
  display: none;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

#codex-panel-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  cursor: pointer;
}

#codex-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 520px;
  height: 100vh;
  background: rgba(20, 14, 8, 0.96);
  border-left: 2px solid rgba(200, 168, 78, 0.4);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.35s ease;
  z-index: 1;
  box-shadow: -4px 0 30px rgba(0, 0, 0, 0.5);
}

#codex-panel.open {
  transform: translateX(0);
}

.codex-tab-bar {
  display: flex;
  flex-shrink: 0;
  border-bottom: 2px solid rgba(200, 168, 78, 0.4);
}

.codex-tab {
  flex: 1;
  padding: 14px 0;
  text-align: center;
  font-size: 15px;
  font-weight: bold;
  color: #9ca3af;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  font-family: inherit;
  letter-spacing: 2px;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.codex-tab:hover:not(.active) {
  color: #d1d5db;
}

.codex-tab.active {
  color: #fbbf24;
  border-bottom-color: #fbbf24;
}

#codex-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#codex-content::-webkit-scrollbar {
  width: 6px;
}

#codex-content::-webkit-scrollbar-track {
  background: rgba(20, 14, 8, 0.5);
}

#codex-content::-webkit-scrollbar-thumb {
  background: rgba(200, 168, 78, 0.3);
  border-radius: 3px;
}
</style>

<div id="codex-panel-mask"></div>
<div id="codex-panel">
  <div class="codex-tab-bar">
    ${tabButtons}
  </div>
  <div id="codex-content"></div>
</div>`;
  }
}
