import { LawManager, LawSlot } from '../core/LawManager';
import type { Law } from '../types/equipment';

const RING_DIAMETER = 48;
const RING_LINE_WIDTH = 4;
const RING_GAP = 16;

const COLOR_READY = '#4A90D9';
const COLOR_ACTIVE = '#F59E0B';
const COLOR_COOLDOWN = '#6B7280';

const TIER_COLORS: Record<string, string> = {
  L0: '#9CA3AF',
  L1: '#4ADE80',
  L2: '#60A5FA',
  L3: '#FBBF24',
};

export class LawHUD {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lawManager: LawManager;
  private dpr: number;
  private time = 0;

  constructor(lawManager: LawManager) {
    this.lawManager = lawManager;
    this.dpr = window.devicePixelRatio || 1;

    const totalWidth = RING_DIAMETER * 3 + RING_GAP * 2;
    const totalHeight = RING_DIAMETER + 28;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'law-hud-canvas';
    this.canvas.style.width = `${totalWidth}px`;
    this.canvas.style.height = `${totalHeight}px`;
    this.canvas.width = totalWidth * this.dpr;
    this.canvas.height = totalHeight * this.dpr;

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(this.dpr, this.dpr);

    this.canvas.style.cssText += `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 101;
      pointer-events: none;
    `;
    document.body.appendChild(this.canvas);
  }

  update(dt: number): void {
    this.time += dt;
    const { ctx } = this;
    const w = RING_DIAMETER * 3 + RING_GAP * 2;
    const h = RING_DIAMETER + 28;
    ctx.clearRect(0, 0, w, h);

    const slots = this.lawManager.getSlots();
    const cx0 = RING_DIAMETER / 2;
    const cy = RING_DIAMETER / 2;

    for (let i = 0; i < 3; i++) {
      const cx = cx0 + i * (RING_DIAMETER + RING_GAP);
      this.drawRing(ctx, cx, cy, slots[i], i);
    }
  }

  private drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, slot: LawSlot, index: number): void {
    const r = RING_DIAMETER / 2;

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = RING_LINE_WIDTH;
    ctx.stroke();

    const law = slot.law as Law | null;

    if (!law) {
      // Empty slot: dashed hollow circle
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, r - RING_LINE_WIDTH, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Slot number
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), cx, cy);

      // Key hint below
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.fillText(`[${index + 1}]`, cx, cy + r + 14);
      return;
    }

    let color: string;
    let fillArc = 0;
    let showCountdown = false;

    if (slot.cooldownRemaining > 0) {
      if (slot.cooldownRemaining > law.cooldown * 0.9) {
        // Just activated — brief "active" flash
        color = COLOR_ACTIVE;
        fillArc = Math.PI * 2;
      } else {
        color = COLOR_COOLDOWN;
        fillArc = Math.PI * 2 * (1 - slot.cooldownRemaining / law.cooldown);
        showCountdown = true;
      }
    } else {
      // Ready — pulsing
      const pulse = 0.7 + 0.3 * Math.sin(this.time * 4);
      color = this.withAlpha(COLOR_READY, pulse);
      fillArc = Math.PI * 2;
    }

    // Filled arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + fillArc);
    ctx.strokeStyle = color;
    ctx.lineWidth = RING_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Countdown number
    if (showCountdown) {
      ctx.fillStyle = COLOR_COOLDOWN;
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(slot.cooldownRemaining).toString(), cx, cy);
    }

    // Law name below ring
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(law.name, cx, cy + r + 5);

    // Tier indicator dot
    ctx.fillStyle = TIER_COLORS[law.tier] || '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy + r + 18, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private withAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  destroy(): void {
    this.canvas.remove();
  }
}
