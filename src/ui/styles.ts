/**
 * 三年游 3D — 纪念碑谷统一设计系统
 * Shared CSS variables and pattern library for all UI components.
 */

export const DESIGN_SYSTEM_CSS = `
  /* ═══════════════════════════════════════════════
     纪念碑谷 · 知识殿堂 Design System
     ═══════════════════════════════════════════════ */

  :root {
    /* ── Palette: Warm Peach base (matches scene fog #f0d8c8) ── */
    --mv-cream:       #faf3eb;
    --mv-peach:       #f0d8c8;
    --mv-sand:        #e8d4b8;
    --mv-rose:        #e8c4b4;

    /* ── Accents ── */
    --mv-coral:       #d4876e;
    --mv-coral-soft:  rgba(212, 135, 110, 0.2);
    --mv-teal:        #4a9e97;
    --mv-teal-soft:   rgba(74, 158, 151, 0.15);
    --mv-gold:        #c8a84e;
    --mv-gold-soft:   rgba(200, 168, 78, 0.15);
    --mv-gold-glow:   rgba(200, 168, 78, 0.35);

    /* ── Surfaces ── */
    --mv-surface:     rgba(250, 243, 235, 0.92);
    --mv-surface-dim: rgba(240, 216, 200, 0.85);
    --mv-overlay:     rgba(30, 30, 46, 0.35);
    --mv-glass:       rgba(250, 243, 235, 0.78);

    /* ── Text ── */
    --mv-text:        #2a2a3e;
    --mv-text-soft:   #5a5a6e;
    --mv-text-muted:  #8a8a9e;
    --mv-text-inv:    #faf3eb;

    /* ── Borders & Shadows ── */
    --mv-border:      rgba(200, 168, 78, 0.2);
    --mv-border-strong: rgba(200, 168, 78, 0.4);
    --mv-shadow:      0 2px 16px rgba(30, 30, 46, 0.08);
    --mv-shadow-lg:   0 8px 32px rgba(30, 30, 46, 0.12);

    /* ── Subject Colors ── */
    --sub-physics:    #5b9bd5;
    --sub-biology:    #5cb87a;
    --sub-chemistry:  #9b7ec4;
    --sub-geography:  #e8945c;
    --sub-history:    #d97a9e;
    --sub-math:       #4dbfd9;
    --sub-chinese:    #d9c84d;
    --sub-english:    #d96a6a;
    --sub-politics:   #b87ec4;

    /* ── Rarity Colors ── */
    --rarity-common:    #9ca3af;
    --rarity-rare:      #6495ed;
    --rarity-epic:      #9b59b6;
    --rarity-legendary: #e8945c;

    /* ── Sizing ── */
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --font-ui: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif;
    --font-mono: 'Courier New', 'SF Mono', monospace;
  }

  /* ═══════════════════════════════════════════════
     Shared Component Patterns
     ═══════════════════════════════════════════════ */

  /* ── Glass Panel ── */
  .mv-panel {
    background: var(--mv-glass);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--mv-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--mv-shadow-lg);
  }

  /* ── Card ── */
  .mv-card {
    background: var(--mv-surface);
    border: 1px solid var(--mv-border);
    border-radius: var(--radius-md);
    box-shadow: var(--mv-shadow);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .mv-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--mv-shadow-lg);
  }

  /* ── Card with left accent (subject-colored) ── */
  .mv-card-accent {
    position: relative;
    background: var(--mv-surface);
    border: 1px solid var(--mv-border);
    border-left: 4px solid var(--mv-gold);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    box-shadow: var(--mv-shadow);
  }

  /* ── Pill Button ── */
  .mv-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 13px;
    font-family: var(--font-ui);
    font-weight: 600;
    border: 1.5px solid var(--mv-gold);
    border-radius: 20px;
    background: var(--mv-surface);
    color: var(--mv-text);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .mv-btn:hover {
    background: var(--mv-gold-soft);
    border-color: var(--mv-gold);
    transform: translateY(-1px);
  }
  .mv-btn--primary {
    background: var(--mv-gold);
    color: var(--mv-text-inv);
    border-color: var(--mv-gold);
  }
  .mv-btn--primary:hover {
    background: #b8943e;
  }

  /* ── Tag / Badge ── */
  .mv-tag {
    display: inline-block;
    padding: 2px 10px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: var(--radius-sm);
  }

  /* ── Section Divider ── */
  .mv-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--mv-gold-soft) 20%,
      var(--mv-gold) 50%,
      var(--mv-gold-soft) 80%,
      transparent 100%
    );
    margin: 12px 0;
  }

  /* ── Vertical Divider (for dual-pane layouts) ── */
  .mv-v-divider {
    width: 1px;
    align-self: stretch;
    background: linear-gradient(
      180deg,
      transparent 0%,
      var(--mv-gold-soft) 20%,
      var(--mv-gold) 50%,
      var(--mv-gold-soft) 80%,
      transparent 100%
    );
    flex-shrink: 0;
  }

  /* ── Equipped Badge ── */
  .mv-equipped-tag {
    position: absolute;
    top: -6px;
    right: -6px;
    font-size: 9px;
    font-weight: 800;
    background: var(--mv-gold);
    color: var(--mv-text-inv);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    box-shadow: 0 2px 8px var(--mv-gold-glow);
    letter-spacing: 0.3px;
  }

  /* ── Tier Badges ── */
  .mv-tier { font-size: 10px; font-weight: 700; padding: 2px 8px; border: 1.5px solid; border-radius: 4px; }
  .mv-tier--l0 { color: var(--mv-text-muted); border-color: var(--mv-text-muted); }
  .mv-tier--l1 { color: var(--sub-biology); border-color: var(--sub-biology); }
  .mv-tier--l2 { color: var(--sub-physics); border-color: var(--sub-physics); }
  .mv-tier--l3 { color: var(--sub-chemistry); border-color: var(--sub-chemistry); }
  .mv-tier--l4 { color: var(--mv-gold); border-color: var(--mv-gold); }

  /* ── Empty State ── */
  .mv-empty {
    text-align: center;
    color: var(--mv-text-muted);
    padding: 32px 16px;
    font-size: 13px;
    font-style: italic;
  }

  /* ═══════════════════════════════════════════════
     Scrollbar (warm theme)
     ═══════════════════════════════════════════════ */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: var(--mv-border-strong);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--mv-gold);
  }
`;
