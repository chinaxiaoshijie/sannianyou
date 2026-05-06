import type { Law, LawData } from '../types';
import type { LawManager, LawSlot } from '../core/LawManager';
import lawsData from '../data/laws.json';

/* ────── Subject Colors (9 subjects) ────── */
const SUBJECT_COLORS: Record<string, string> = {
  physics: '#60a5fa',
  biology: '#4ade80',
  chemistry: '#a78bfa',
  geography: '#fb923c',
  history: '#f472b6',
  chinese: '#facc15',
  math: '#38bdf8',
  english: '#f87171',
  politics: '#c084fc',
};

const SUBJECT_KEY_MAP: Record<string, string> = {
  '物理': 'physics',
  '生物': 'biology',
  '化学': 'chemistry',
  '地理': 'geography',
  '历史': 'history',
  '语文': 'chinese',
  '数学': 'math',
  '英语': 'english',
  '政治': 'politics',
};

/* ────── Tier Badges ────── */
const TIER_COLORS: Record<string, string> = {
  L0: '#9CA3AF',
  L1: '#4ADE80',
  L2: '#60A5FA',
  L3: '#A78BFA',
  L4: '#FBBF24',
};

const TIER_LABELS: Record<string, string> = {
  L0: '感知',
  L1: '基础',
  L2: '进阶',
  L3: '组合',
  L4: '传世',
};

const EQUIPPED_BORDER = '#FBBF24';

/** Regex to extract chapter group (e.g. "§1" from "必修一 §1.1 质点模型") */
const CHAPTER_GROUP_RE = /§(\d+)/;

/**
 * CodexLawTome — 法则图鉴子页面 · 双镜对照设计
 *
 * 每张卡片分为左（📖 课本知识）右（🎮 游戏法则）两栏，
 * 中间有脉冲渐变分割线，象征知识→游戏的双向贯通。
 *
 * 顶部有章节快速跳转导航栏，同章节法则在 hover 时高亮联动。
 */
export class CodexLawTome {
  private container: HTMLElement;
  private lawManager: LawManager;
  private allLaws: Law[];
  private styleId = 'codex-law-tome-styles';
  private boundOnLawsChanged: () => void;

  constructor(container: HTMLElement, lawManager: LawManager) {
    this.container = container;
    this.lawManager = lawManager;
    this.allLaws = this.loadAllLaws();
    this.boundOnLawsChanged = this.render.bind(this);

    this.injectStyles();
    this.lawManager.events.on('laws-changed', this.boundOnLawsChanged);
    this.render();
  }

  /* ────── Data ────── */

  private loadAllLaws(): Law[] {
    const data = lawsData as unknown as LawData;
    const all: Law[] = [];
    for (const subject of Object.keys(data)) {
      const subjectLaws = (data as unknown as Record<string, Law[]>)[subject];
      if (Array.isArray(subjectLaws)) {
        all.push(...subjectLaws);
      }
    }
    return all;
  }

  private getSubjectKey(subject: string): string {
    return SUBJECT_KEY_MAP[subject] ?? subject;
  }

  /* ────── Render ────── */

  render(): void {
    const unlocked = this.lawManager.getUnlockedLaws();
    const slots: LawSlot[] = this.lawManager.getSlots();

    const unlockedIds = new Set(unlocked.map((l) => l.id));
    const equippedIds = new Set(
      slots.filter((s) => s.law !== null).map((s) => s.law!.id),
    );

    // Group laws by chapter
    const chapterGroups = this.groupByChapter();

    let html = '';

    // ── Chapter navigation bar ──
    if (chapterGroups.size > 1) {
      html += '<div class="codex-law-chapter-nav">';
      for (const [chap, laws] of chapterGroups) {
        html += `<button class="codex-law-chapter-btn" data-scroll-to="${this.escAttr(chap)}">
          📘 ${this.esc(chap)}
          <small>(${laws.length})</small>
        </button>`;
      }
      html += '</div>';
    }

    // ── Chapter groups ──
    for (const [chap, laws] of chapterGroups) {
      html += `<div class="codex-law-tome-group" data-chapter="${this.esc(chap)}">
        <div class="codex-law-tome-group-title">${this.esc(chap)}</div>
        <div class="codex-law-tome-grid">`;

      for (const law of laws) {
        const isUnlocked = unlockedIds.has(law.id);
        const isEquipped = equippedIds.has(law.id);
        const subjectKey = this.getSubjectKey(law.subject);
        const subjectColor = SUBJECT_COLORS[subjectKey] ?? '#888888';
        const tierColor = TIER_COLORS[law.tier] ?? '#888888';
        const tierLabel = TIER_LABELS[law.tier] ?? law.tier;

        const cardClasses = ['codex-law-card'];
        if (!isUnlocked) cardClasses.push('codex-law-card--locked');
        if (isEquipped) cardClasses.push('codex-law-card--equipped');

        html += `<div class="${cardClasses.join(' ')}" 
          style="border-top: 3px solid ${subjectColor};${isEquipped ? ` box-shadow: 0 0 0 2px ${EQUIPPED_BORDER}, 0 0 14px rgba(251,191,36,0.2);` : ''}"
          data-law-id="${this.esc(law.id)}"
          data-chapter="${this.esc(chap)}">`;

        if (isUnlocked) {
          // ═══ UNLOCKED: dual-pane card ═══
          html += this.buildUnlockedCardHTML(law, tierColor, tierLabel, subjectColor);
        } else {
          // ═══ LOCKED: grey mystery card ═══
          html += this.buildLockedCardHTML(law);
        }

        if (isEquipped) {
          html += `<span class="codex-law-equipped-tag">⚡ 已装配</span>`;
        }

        html += `</div>`;
      }

      html += `</div></div>`;
    }

    if (this.allLaws.length === 0) {
      html = `<div class="codex-law-empty">暂无法则数据 — 更多法则将在后续版本中加入</div>`;
    }

    this.container.innerHTML = html;

    // Attach chapter-nav click delegation
    this.attachChapterNavHandlers();

    // Attach hover handlers for same-chapter highlighting
    this.attachChapterHoverHandlers();
  }

  /* ────── Chapter nav click delegation ────── */

  private attachChapterNavHandlers(): void {
    const nav = this.container.querySelector('.codex-law-chapter-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.codex-law-chapter-btn') as HTMLElement | null;
      if (!btn) return;
      const chapter = btn.dataset.scrollTo;
      if (!chapter) return;
      const group = this.container.querySelector(
        `.codex-law-tome-group[data-chapter="${CSS.escape(chapter)}"]`,
      );
      if (group) {
        group.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  private buildUnlockedCardHTML(
    law: Law,
    tierColor: string,
    tierLabel: string,
    subjectColor: string,
  ): string {
    return `
      <div class="codex-law-card-header">
        <span class="codex-law-name">${this.esc(law.name)}</span>
        <span class="codex-law-tier" style="color:${tierColor};border-color:${tierColor}">${tierLabel}</span>
      </div>
      <div class="codex-law-dual">
        <!-- Left: 课本知识 -->
        <div class="codex-law-left">
          <div class="codex-law-pane-label">📖 课本知识</div>
          <div class="codex-law-formula">${this.esc(law.formula)}</div>
          <div class="codex-law-concept">${this.esc(law.concept)}</div>
          <div class="codex-law-realworld">
            <span class="codex-law-label-tag">🌍 现实联系</span>
            ${this.esc(law.realWorld)}
          </div>
          <div class="codex-law-mnemonic" onclick="this.classList.toggle('expanded')" title="点击展开/收起">
            <span class="codex-law-mnemonic-dot">💡</span> ${this.esc(law.mnemonic)}
          </div>
        </div>
        <!-- Divider -->
        <div class="codex-law-divider"></div>
        <!-- Right: 游戏法则 -->
        <div class="codex-law-right">
          <div class="codex-law-pane-label">🎮 游戏法则</div>
          <div class="codex-law-effect">${this.esc(law.effectDesc)}</div>
          <div class="codex-law-visual">🎨 ${this.esc(law.visualDesc)}</div>
          <div class="codex-law-meta">
            <span>🔋 ${law.cost} 才气</span>
            <span>⏱ ${law.cooldown}s</span>
          </div>
          <div class="codex-law-tactical">
            <span class="codex-law-label-tag">⚔️ 战术提示</span>
            ${this.esc(law.tacticalHint)}
          </div>
        </div>
      </div>`;
  }

  private buildLockedCardHTML(law: Law): string {
    return `
      <div class="codex-law-card-header codex-law-card-header--locked">
        <span class="codex-law-name">${this.esc(law.name)}</span>
        <span class="codex-law-lock-icon">🔒</span>
      </div>
      <div class="codex-law-dual codex-law-dual--locked">
        <div class="codex-law-left">
          <div class="codex-law-pane-label codex-law-pane-label--dim">📖 课本知识</div>
          <div class="codex-law-concept codex-law-concept--dim">
            击败惑障以解锁此法则的完整知识...
          </div>
        </div>
        <div class="codex-law-divider codex-law-divider--dim"></div>
        <div class="codex-law-right">
          <div class="codex-law-pane-label codex-law-pane-label--dim">🎮 游戏法则</div>
          <div class="codex-law-effect" style="color:#555566">
            需要 ${this.esc(law.chapter)} 相关知识<br>
            KP 要求: ${law.kpReq}
          </div>
        </div>
      </div>`;
  }

  /* ────── Chapter grouping ────── */

  private groupByChapter(): Map<string, Law[]> {
    const map = new Map<string, Law[]>();
    for (const law of this.allLaws) {
      const key = this.extractChapterGroup(law.chapter);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(law);
    }
    return map;
  }

  private extractChapterGroup(chapter: string): string {
    const m = chapter.match(CHAPTER_GROUP_RE);
    if (m) {
      // "必修一 §1.1 质点模型" → "必修一 §1"
      const prefix = chapter.substring(0, chapter.indexOf('§') + 1);
      return `${prefix}${m[1]}`;
    }
    return chapter;
  }

  /* ────── Hover highlighting ────── */

  private attachChapterHoverHandlers(): void {
    const cards = this.container.querySelectorAll('.codex-law-card[data-chapter]') as NodeListOf<HTMLElement>;
    const groups: Record<string, HTMLElement[]> = {};

    cards.forEach((card) => {
      const chap = card.dataset.chapter ?? '';
      if (!groups[chap]) groups[chap] = [];
      groups[chap].push(card);
    });

    cards.forEach((card) => {
      card.addEventListener('mouseenter', () => {
        const chap = card.dataset.chapter ?? '';
        const peers = groups[chap] ?? [];
        // Dim all cards, then brighten same-chapter peers
        cards.forEach((c) => c.classList.add('codex-law-card--dimmed'));
        peers.forEach((c) => {
          c.classList.remove('codex-law-card--dimmed');
          c.classList.add('codex-law-card--highlighted');
        });
      });
      card.addEventListener('mouseleave', () => {
        cards.forEach((c) => {
          c.classList.remove('codex-law-card--dimmed', 'codex-law-card--highlighted');
        });
      });
    });
  }

  /* ────── Styles ────── */

  private injectStyles(): void {
    if (document.getElementById(this.styleId)) return;

    const style = document.createElement('style');
    style.id = this.styleId;
    style.textContent = `
      /* ── Chapter Nav Bar ── */
      .codex-law-chapter-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        position: sticky;
        top: 0;
        background: #161622;
        z-index: 2;
      }
      .codex-law-chapter-btn {
        padding: 4px 10px;
        font-size: 11px;
        color: #9ca3af;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .codex-law-chapter-btn:hover {
        color: #e0e0e0;
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.15);
      }
      .codex-law-chapter-btn small {
        font-size: 10px;
        color: #6b7280;
      }

      /* ── Chapter Group ── */
      .codex-law-tome-group {
        margin-bottom: 8px;
      }
      .codex-law-tome-group-title {
        font-size: 12px;
        font-weight: 700;
        color: #8888a0;
        padding: 10px 16px 4px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      /* ── Grid ── */
      .codex-law-tome-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 4px 14px 14px;
      }

      /* ── Card ── */
      .codex-law-card {
        position: relative;
        background: #1e1e2e;
        border-radius: 10px;
        color: #e0e0e0;
        font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
        transition: all 0.25s ease;
        overflow: hidden;
      }
      .codex-law-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
      }
      .codex-law-card--locked {
        background: #16161e;
      }
      .codex-law-card--dimmed {
        opacity: 0.4;
        filter: grayscale(0.3);
      }
      .codex-law-card--highlighted {
        opacity: 1;
        filter: none;
        box-shadow: 0 0 20px rgba(96,165,250,0.15);
      }

      /* ── Card Header ── */
      .codex-law-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px 6px;
      }
      .codex-law-card-header--locked {
        padding-bottom: 0;
      }
      .codex-law-name {
        font-size: 16px;
        font-weight: 800;
        color: #f0f0f0;
      }
      .codex-law-name--dim {
        color: #6a6a7a;
      }
      .codex-law-tier {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border: 1.5px solid;
        border-radius: 4px;
        white-space: nowrap;
      }
      .codex-law-lock-icon {
        font-size: 14px;
        opacity: 0.5;
      }

      /* ── Dual Pane ── */
      .codex-law-dual {
        display: flex;
        gap: 0;
        padding: 0 16px 14px;
      }
      .codex-law-dual--locked {
        opacity: 0.5;
      }

      .codex-law-left,
      .codex-law-right {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }
      .codex-law-left {
        padding-right: 16px;
      }
      .codex-law-right {
        padding-left: 16px;
      }

      /* ── Pane Label ── */
      .codex-law-pane-label {
        font-size: 11px;
        font-weight: 700;
        color: #c8a84e;
        margin-bottom: 2px;
        letter-spacing: 0.5px;
      }
      .codex-law-pane-label--dim {
        color: #555566;
      }

      /* ── Formula ── */
      .codex-law-formula {
        font-size: 14px;
        font-weight: 700;
        color: #fbbf24;
        background: rgba(251,191,36,0.08);
        padding: 4px 10px;
        border-radius: 5px;
        display: inline-block;
        font-family: 'Courier New', monospace;
        letter-spacing: 1px;
      }

      /* ── Concept text ── */
      .codex-law-concept {
        font-size: 12px;
        color: #b0b0c0;
        line-height: 1.6;
        text-align: justify;
      }
      .codex-law-concept--dim {
        color: #555566;
        font-style: italic;
      }

      /* ── Real-world ── */
      .codex-law-realworld {
        font-size: 11px;
        color: #8888a0;
        line-height: 1.5;
        margin-top: 2px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      /* ── Label Tags ── */
      .codex-law-label-tag {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        opacity: 0.7;
      }

      /* ── Visual desc ── */
      .codex-law-visual {
        font-size: 10px;
        color: #6b7280;
        font-style: italic;
      }

      /* ── Effect desc ── */
      .codex-law-effect {
        font-size: 12px;
        color: #d0d0e0;
        line-height: 1.5;
      }

      /* ── Meta (cost, cooldown) ── */
      .codex-law-meta {
        font-size: 10px;
        color: #8888a0;
        display: flex;
        gap: 12px;
        margin-top: 2px;
      }

      /* ── Tactical hint ── */
      .codex-law-tactical {
        font-size: 11px;
        color: #a0a0b0;
        line-height: 1.5;
        margin-top: 2px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      /* ── Divider ── */
      .codex-law-divider {
        width: 1px;
        align-self: stretch;
        background: linear-gradient(
          180deg,
          transparent 0%,
          rgba(200,168,78,0.3) 20%,
          rgba(200,168,78,0.5) 50%,
          rgba(200,168,78,0.3) 80%,
          transparent 100%
        );
        flex-shrink: 0;
        position: relative;
      }
      .codex-law-divider::after {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(
          180deg,
          transparent 0%,
          rgba(200,168,78,0.15) 50%,
          transparent 100%
        );
        animation: codex-law-divider-pulse 3s ease-in-out infinite;
      }
      .codex-law-divider--dim::after {
        animation: none;
        background: transparent;
      }
      @keyframes codex-law-divider-pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.8; }
      }

      /* ── Mnemonic ── */
      .codex-law-mnemonic {
        font-size: 11px;
        color: #9ca3af;
        cursor: pointer;
        margin-top: 4px;
        padding: 4px 8px;
        background: rgba(255,255,255,0.03);
        border-radius: 5px;
        transition: all 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .codex-law-mnemonic:hover {
        background: rgba(255,255,255,0.06);
        color: #d0d0d0;
      }
      .codex-law-mnemonic.expanded {
        white-space: normal;
        background: rgba(200,168,78,0.08);
        color: #fbbf24;
      }
      .codex-law-mnemonic-dot {
        display: inline-block;
        margin-right: 4px;
      }

      /* ── Equipped tag ── */
      .codex-law-equipped-tag {
        position: absolute;
        top: 8px;
        right: 12px;
        font-size: 9px;
        background: ${EQUIPPED_BORDER};
        color: #1a1a2e;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 800;
        letter-spacing: 0.3px;
      }

      /* ── Empty state ── */
      .codex-law-empty {
        width: 100%;
        text-align: center;
        color: #6a6a7a;
        padding: 40px 16px;
        font-size: 13px;
      }

      /* ── Responsive: stack on narrow ── */
      @media (max-width: 480px) {
        .codex-law-dual {
          flex-direction: column;
          gap: 10px;
        }
        .codex-law-left {
          padding-right: 0;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(200,168,78,0.15);
        }
        .codex-law-right {
          padding-left: 0;
        }
        .codex-law-divider {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ────── Helpers ────── */

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\\/g, '\\\\');
  }

  /** Escape for HTML attribute values (only escaping " and minimal). */
  private escAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  /* ────── Lifecycle ────── */

  destroy(): void {
    this.lawManager.events.off('laws-changed', this.boundOnLawsChanged);
  }
}
