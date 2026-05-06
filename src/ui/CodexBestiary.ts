import type { StateManager } from '../core/StateManager';
import type { GameState } from '../types';
import demonsData from '../data/demons.json';

// ---------------------------------------------------------------------------
// Local types matching demons.json shape
// ---------------------------------------------------------------------------

interface DemonPhaseData {
  index: number;
  name: string;
  triggerHP: number;
  description: string;
  attacks?: DemonAttackData[];
}

interface DemonAttackData {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface DemonData {
  id: string;
  name: string;
  element: string;
  subjectDims: string[];
  rank: number;
  hp: number;
  maxHP: number;
  weakness: string;
  defense: number;
  zone: string;
  xinLi: number;
  maxXinLi: number;
  attack: number;
  phases: DemonPhaseData[];
  lawReveals?: Record<string, string>;
}

/** demons.json is an object keyed by demon id */
type DemonsData = Record<string, DemonData>;

// ---------------------------------------------------------------------------
// CodexBestiary
// ---------------------------------------------------------------------------

/**
 * BOSS 图鉴子页面.
 *
 * Renders a scrollable list of bestiary entry cards into a parent DOM element
 * passed at construction time.  Discovery status is driven by the
 * `defeatedDemons` array in `StateManager.getGameState()` — any demon whose
 * id appears there is considered "discovered" and shows full info.
 * Undiscovered entries render as grey silhouette cards with "???" placeholders.
 */
export class CodexBestiary {
  private parent: HTMLElement;
  private stateManager: StateManager;
  private container: HTMLDivElement;
  private boundOnGameChanged: () => void;

  constructor(parent: HTMLElement, stateManager: StateManager) {
    this.parent = parent;
    this.stateManager = stateManager;
    this.boundOnGameChanged = this.refresh.bind(this);
    this.container = this.createContainer();
    parent.appendChild(this.container);
    this.render();

    // Auto-refresh when game state changes (e.g. demon defeated)
    this.stateManager.events.on('game-changed', this.boundOnGameChanged);
  }

  // ---- public API ----------------------------------------------------------

  /**
   * Re-derive discovery status from StateManager and re-render all cards.
   * Call this after a BOSS has been defeated (e.g. on 'game-changed' event).
   */
  refresh(): void {
    const grid = this.container.querySelector('.codex-bestiary-grid');
    if (grid) grid.innerHTML = '';
    this.render();
  }

  /** Remove the bestiary DOM and clean up. */
  destroy(): void {
    this.stateManager.events.off('game-changed', this.boundOnGameChanged);
    this.container.remove();
  }

  // ---- internal rendering --------------------------------------------------

  private createContainer(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'codex-bestiary';
    el.innerHTML = this.stylesHTML() + this.gridHTML();
    return el;
  }

  private stylesHTML(): string {
    return `<style>
.codex-bestiary {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  color: #d1d5db;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  box-sizing: border-box;
}
.codex-bestiary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
}
/* Card */
.bestiary-card {
  position: relative;
  background: #1e1e2a;
  border-radius: 10px;
  padding: 14px 16px;
  overflow: hidden;
  transition: box-shadow 0.25s;
}
.bestiary-card:hover {
  box-shadow: 0 0 16px rgba(200,168,78,0.18);
}
/* Left accent stripe */
.bestiary-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}
/* Subject colour variants (set via inline style on ::before isn't possible,
   so we inject a data-attr and use attribute selectors) */
.bestiary-card[data-subject="物理"]::before { background: #60a5fa; }
.bestiary-card[data-subject="生物"]::before { background: #4ade80; }
.bestiary-card[data-subject="化学"]::before { background: #a78bfa; }
.bestiary-card[data-subject="地理"]::before { background: #fb923c; }
.bestiary-card[data-subject="历史"]::before { background: #f472b6; }

/* Undiscovered card */
.bestiary-card.undiscovered {
  background: #4a4a4a;
}
.bestiary-card.undiscovered::before {
  background: #555 !important;
}
.bestiary-card.undiscovered .bestiary-name,
.bestiary-card.undiscovered .bestiary-subject-tag,
.bestiary-card.undiscovered .bestiary-phase,
.bestiary-card.undiscovered .bestiary-lore {
  color: #777;
}
.bestiary-card.undiscovered .bestiary-name {
  font-size: 18px;
  letter-spacing: 4px;
}

/* Name */
.bestiary-name {
  font-size: 15px;
  font-weight: bold;
  color: #f1f5f9;
  margin-bottom: 4px;
}
/* Subject tag */
.bestiary-subject-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  background: rgba(255,255,255,0.06);
  color: #9ca3af;
}
/* Defeat badge */
.bestiary-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  font-weight: bold;
  color: #fbbf24;
  background: rgba(251,191,36,0.12);
  border: 1px solid rgba(251,191,36,0.35);
  border-radius: 6px;
  padding: 2px 8px;
}
/* Phases */
.bestiary-phases {
  margin-top: 6px;
}
.bestiary-phase {
  font-size: 11px;
  color: #a1a1aa;
  margin-bottom: 3px;
  line-height: 1.4;
}
.bestiary-phase-name {
  color: #c8a84e;
  font-weight: 600;
}
/* Weakness hint */
.bestiary-weakness {
  margin-top: 8px;
  font-size: 11px;
  color: #f87171;
}
/* Lore */
.bestiary-lore {
  margin-top: 6px;
  font-size: 11px;
  color: #6b7280;
  line-height: 1.5;
  font-style: italic;
}
</style>`;
  }

  private gridHTML(): string {
    return '<div class="codex-bestiary-grid"></div>';
  }

  private render(): void {
    let grid = this.container.querySelector('.codex-bestiary-grid') as HTMLDivElement;
    if (!grid) {
      this.container.innerHTML = this.stylesHTML() + this.gridHTML();
      grid = this.container.querySelector('.codex-bestiary-grid') as HTMLDivElement;
    }
    const gameState: GameState = this.stateManager.getGameState();
    const defeated: Set<string> = new Set(gameState.defeatedDemons);
    const demons: DemonsData = demonsData as DemonsData;

    for (const id of Object.keys(demons)) {
      const demon = demons[id];
      const discovered = defeated.has(id);
      const card = this.buildCard(demon, discovered);
      grid.appendChild(card);
    }
  }

  // ---- card builder --------------------------------------------------------

  private buildCard(demon: DemonData, discovered: boolean): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'bestiary-card';
    if (!discovered) card.classList.add('undiscovered');

    // Subject colour accent: use the primary weakness as the subject for the
    // left-border colour.  Fallback to the first subjectDims entry.
    const subject = demon.weakness ?? demon.subjectDims?.[0] ?? '';
    card.setAttribute('data-subject', subject);

    if (discovered) {
      card.innerHTML = this.cardContentDiscovered(demon, subject);
    } else {
      card.innerHTML = this.cardContentUndiscovered();
    }
    return card;
  }

  private cardContentDiscovered(demon: DemonData, subject: string): string {
    const subjectTag = demon.subjectDims && demon.subjectDims.length > 0
      ? demon.subjectDims.join(' · ')
      : subject;

    // Build phases list
    let phasesHTML = '';
    if (demon.phases && demon.phases.length > 0) {
      phasesHTML = '<div class="bestiary-phases">'
        + demon.phases.map(p =>
            `<div class="bestiary-phase">
              <span class="bestiary-phase-name">${this.esc(p.name)}</span>：${this.esc(p.description)}
            </div>`
          ).join('')
        + '</div>';
    }

    // Build lore from lawReveals
    let loreHTML = '';
    if (demon.lawReveals) {
      const loreLines = Object.values(demon.lawReveals);
      if (loreLines.length > 0) {
        loreHTML = '<div class="bestiary-lore">'
          + loreLines.map(l => `<div>📖 ${this.esc(l)}</div>`).join('')
          + '</div>';
      }
    }

    return `
      <div class="bestiary-badge">🏆 已征服</div>
      <div class="bestiary-name">${this.esc(demon.name)}</div>
      <div class="bestiary-subject-tag">${this.esc(subjectTag)}</div>
      ${phasesHTML}
      <div class="bestiary-weakness">⚡ 克星学科：${this.esc(demon.weakness)}</div>
      ${loreHTML}
    `;
  }

  private cardContentUndiscovered(): string {
    return `
      <div class="bestiary-name">？？？</div>
      <div class="bestiary-subject-tag">???</div>
      <div class="bestiary-phase">
        <span class="bestiary-phase-name">???</span>：??????????
      </div>
      <div class="bestiary-weakness">⚡ 克星学科：???</div>
      <div class="bestiary-lore">📖 ??????????</div>
    `;
  }

  // ---- helpers -------------------------------------------------------------

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
