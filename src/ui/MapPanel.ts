import type { Building } from '../types';

/**
 * MapPanel — M 键打开校园地图覆盖层。
 * 显示建筑位置 + 玩家当前位置的简化地图。
 * 纪念碑谷风格 — 粉彩配色、几何简约。
 */

interface MapBuilding {
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
  emoji: string;
}

const MAP_BUILDINGS: MapBuilding[] = [
  { id: 'gate', name: '大门', x: 640, z: -680, color: '#FFD700', emoji: '🚪' },
  { id: 'bridge', name: '状元桥', x: 640, z: -610, color: '#FF6347', emoji: '🌉' },
  { id: 'library', name: '图书馆', x: 740, z: -350, color: '#9370DB', emoji: '📚' },
  { id: 'teaching', name: '教学楼', x: 500, z: -300, color: '#4ADE80', emoji: '🏫' },
  { id: 'canteen_s', name: '食堂(南)', x: 800, z: -550, color: '#FFA500', emoji: '🍜' },
  { id: 'dorm_s', name: '南宿舍', x: 900, z: -580, color: '#87CEEB', emoji: '🏠' },
  { id: 'stadium', name: '体育中心', x: 400, z: -500, color: '#FF6B6B', emoji: '🏟️' },
  { id: 'art_center', name: '艺术中心', x: 300, z: -550, color: '#FF69B4', emoji: '🎨' },
  { id: 'lab', name: '实验室', x: 200, z: -200, color: '#20B2AA', emoji: '🔬' },
  { id: 'field_n', name: '北运动场', x: 640, z: -120, color: '#FFD700', emoji: '⚽' },
  { id: 'field_s', name: '南运动场', x: 1000, z: -300, color: '#FFA500', emoji: '🏀' },
];

// Map viewport (in pixel coords): x 150-1050, z -700 to -100
const MAP_MIN_X = 150;
const MAP_MAX_X = 1050;
const MAP_MIN_Z = -700;
const MAP_MAX_Z = -100;

export class MapPanel {
  private overlay: HTMLDivElement;
  private mask!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private _isOpen = false;
  private boundOnKeydown: (e: KeyboardEvent) => void;
  private playerX = 640;
  private playerZ = -650;
  private boundOnClick: (e: MouseEvent) => void;

  constructor() {
    this.boundOnKeydown = this.onKeydown.bind(this);
    this.boundOnClick = this.onMaskClick.bind(this);
    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);
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
    this.drawMap();
    window.addEventListener('keydown', this.boundOnKeydown);
  }

  close(): void {
    this._isOpen = false;
    this.overlay.style.display = 'none';
    window.removeEventListener('keydown', this.boundOnKeydown);
  }

  /** Update player position (in 2D pixel coords) for the map dot. */
  updatePlayerPosition(worldX: number, worldZ: number): void {
    this.playerX = worldX * 10;
    this.playerZ = worldZ;
    if (this._isOpen) this.drawMap();
  }

  private onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' || e.code === 'KeyM') {
      e.preventDefault();
      this.close();
    }
  }

  private onMaskClick(e: MouseEvent): void {
    if (e.target === this.mask) this.close();
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'map-panel-overlay';
    overlay.innerHTML = `
<style>
#map-panel-overlay {
  position: fixed; inset: 0; z-index: 210;
  display: none;
  align-items: center; justify-content: center;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
#map-panel-mask {
  position: absolute; inset: 0;
  background: rgba(26, 18, 12, 0.75);
  backdrop-filter: blur(4px);
}
#map-panel-content {
  position: relative;
  background: rgba(40, 30, 20, 0.95);
  border: 2px solid #6b5a3e;
  border-radius: 12px;
  padding: 24px;
  min-width: 400px;
  color: #e0d5c0;
  box-shadow: 0 0 40px rgba(200, 168, 78, 0.15);
}
#map-panel-content h2 {
  margin: 0 0 12px 0;
  font-size: 20px;
  color: #c8a84e;
  text-align: center;
  letter-spacing: 4px;
}
#map-panel-canvas {
  display: block;
  margin: 0 auto;
  border-radius: 8px;
  background: rgba(20, 15, 10, 0.6);
}
#map-panel-hint {
  text-align: center;
  margin-top: 10px;
  font-size: 12px;
  color: #8a7a6a;
}
.map-building-tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(40, 30, 20, 0.95);
  border: 1px solid #6b5a3e;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: #e0d5c0;
  white-space: nowrap;
  transform: translate(-50%, -120%);
  display: none;
}
</style>
<div id="map-panel-mask"></div>
<div id="map-panel-content">
  <h2>🗺️ 深中高中园</h2>
  <canvas id="map-panel-canvas" width="360" height="240"></canvas>
  <div id="map-panel-hint">按 M / Esc 关闭</div>
</div>`;
    this.mask = overlay.querySelector('#map-panel-mask')!;
    this.canvas = overlay.querySelector('#map-panel-canvas')!;
    this.mask.addEventListener('click', this.boundOnClick);
    return overlay;
  }

  private drawMap(): void {
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = 'rgba(107, 90, 62, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const y = (i / 6) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Helper: pixel → canvas
    const mapW = MAP_MAX_X - MAP_MIN_X;
    const mapH = MAP_MAX_Z - MAP_MIN_Z;
    const padX = 24;
    const padY = 20;
    const scaleX = (w - padX * 2) / mapW;
    const scaleY = (h - padY * 2) / Math.abs(mapH);
    const toCanvasX = (px: number) => padX + (px - MAP_MIN_X) * scaleX;
    const toCanvasZ = (pz: number) => padY + (pz - MAP_MIN_Z) * scaleY;

    // Draw path lines (north-south spine + lateral roads)
    ctx.strokeStyle = 'rgba(250, 245, 240, 0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    // Main spine
    ctx.beginPath();
    ctx.moveTo(toCanvasX(640), toCanvasZ(-680));
    ctx.lineTo(toCanvasX(640), toCanvasZ(-120));
    ctx.stroke();
    // Lateral roads
    ctx.beginPath();
    ctx.moveTo(toCanvasX(300), toCanvasZ(-550));
    ctx.lineTo(toCanvasX(1050), toCanvasZ(-550));
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw buildings
    for (const b of MAP_BUILDINGS) {
      const cx = toCanvasX(b.x);
      const cz = toCanvasZ(b.z);

      // Building dot
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(cx, cz, 7, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.fillStyle = b.color + '44';
      ctx.beginPath();
      ctx.arc(cx, cz, 12, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#e0d5c0';
      ctx.font = '9px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, cx, cz + 18);
    }

    // Player dot (pulsing)
    const px = toCanvasX(this.playerX);
    const pz = toCanvasZ(this.playerZ);

    // Pulse ring
    ctx.strokeStyle = '#c8a84e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, pz, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Player dot
    const grad = ctx.createRadialGradient(px, pz, 0, px, pz, 6);
    grad.addColorStop(0, '#FFD700');
    grad.addColorStop(0.7, '#c8a84e');
    grad.addColorStop(1, 'rgba(200, 168, 78, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, pz, 8, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator (north arrow on top-right)
    ctx.fillStyle = '#e0d5c0';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('▲ N', w - padX, padY + 10);
  }
}
