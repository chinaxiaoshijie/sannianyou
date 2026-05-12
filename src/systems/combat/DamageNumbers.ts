import * as THREE from 'three';

interface FloatingText {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

/**
 * DamageNumbers — floating damage/heal text using Canvas Sprites.
 * Monument Valley style: gold/red numbers float up with fade-out.
 */
export class DamageNumbers {
  private scene: THREE.Scene;
  private active: FloatingText[] = [];

  private colors: Record<string, string> = {
    player_hit: '#ef4444',    // red
    boss_hit: '#fbbf24',      // gold
    boss_crit: '#ff8800',     // orange
    dodge: '#4ade80',         // green
    heal: '#22d3ee',          // cyan
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Spawn a floating number at a 3D position. */
  spawn(options: {
    text: string;
    position: THREE.Vector3;
    type?: keyof DamageNumbers['colors'];
    scale?: number;
  }): void {
    const { text, position, type = 'boss_hit', scale = 1 } = options;
    const color = this.colors[type] ?? '#ffffff';

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Draw text with shadow
    ctx.font = 'bold 48px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.position.y += 2; // start above spawn point
    sprite.scale.set(2.5 * scale, 1.25 * scale, 1);
    this.scene.add(sprite);

    const ft: FloatingText = {
      sprite,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5, // slight horizontal drift
        3,                            // float upward
        0,
      ),
      life: 0,
      maxLife: 1.2,
    };
    this.active.push(ft);
  }

  /** Call every frame with delta time. */
  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const ft = this.active[i];
      ft.life += dt;
      const t = ft.life / ft.maxLife;

      if (t >= 1) {
        this.scene.remove(ft.sprite);
        ft.sprite.material.map?.dispose();
        ft.sprite.material.dispose();
        this.active.splice(i, 1);
        continue;
      }

      // Float upward + horizontal drift
      ft.sprite.position.add(ft.velocity.clone().multiplyScalar(dt));
      // Slow down vertical velocity over time
      ft.velocity.y -= dt * 2;

      // Fade out
      const opacity = 1 - t * t; // quadratic fade
      const material = ft.sprite.material as THREE.SpriteMaterial;
      material.opacity = opacity;
      // Slight scale pulse
      const s = 1 + t * 0.3;
      ft.sprite.scale.set(2.5 * s, 1.25 * s, 1);
    }
  }

  /** Clean up all active texts. */
  clear(): void {
    for (const ft of this.active) {
      this.scene.remove(ft.sprite);
      ft.sprite.material.map?.dispose();
      ft.sprite.material.dispose();
    }
    this.active = [];
  }
}
