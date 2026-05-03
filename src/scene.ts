import * as THREE from 'three';
import buildingsData from './data/buildings.json';
import zonesData from './data/zones.json';

const MAP_SCALE = 10;
const GROUND_W = 128;
const GROUND_H = 72;
const BLOCK = 1; // Minecraft block = 1 world unit

/* ===== Minecraft-style procedural textures (32x32) ===== */
function createBlockTexture(
  baseColor: string,
  pattern: 'solid' | 'noise' | 'brick' | 'planks' | 'glass' | 'grass_side' | 'grass_top' | 'stone_brick' | 'roof' = 'solid',
  accentColor?: string,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d')!;

  // Base fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 32, 32);

  const darker = (hex: string, amt: number) => {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
    return `rgb(${r},${g},${b})`;
  };

  const lighter = (hex: string, amt: number) => {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
    return `rgb(${r},${g},${b})`;
  };

  if (pattern === 'noise') {
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = darker(baseColor, Math.random() * 30);
      ctx.fillRect(Math.random() * 32, Math.random() * 32, 2, 2);
    }
  } else if (pattern === 'brick') {
    // Brick pattern
    for (let row = 0; row < 8; row++) {
      const offset = row % 2 === 0 ? 0 : 8;
      for (let col = -1; col < 5; col++) {
        const x = col * 16 + offset;
        const y = row * 4;
        ctx.fillStyle = accentColor ?? baseColor;
        ctx.fillRect(x, y, 15, 3);
        // Mortar lines
        ctx.fillStyle = darker(baseColor, 15);
        ctx.fillRect(x, y, 15, 1);
        ctx.fillRect(x, y + 3, 15, 1);
      }
    }
  } else if (pattern === 'planks') {
    for (let y = 0; y < 32; y += 4) {
      ctx.fillStyle = darker(baseColor, 10 + Math.random() * 15);
      ctx.fillRect(0, y, 32, 2);
      ctx.fillStyle = lighter(baseColor, 5 + Math.random() * 10);
      ctx.fillRect(0, y + 2, 32, 2);
    }
  } else if (pattern === 'glass') {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 32, 32);
    // Cross pattern
    ctx.strokeStyle = lighter(baseColor, 60);
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 31, 31);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(32, 32);
    ctx.moveTo(32, 0); ctx.lineTo(0, 32);
    ctx.stroke();
  } else if (pattern === 'grass_top') {
    // Dark base then green top
    ctx.fillStyle = '#6b4c30';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = darker(baseColor, Math.random() * 20);
      ctx.fillRect(Math.random() * 32, Math.random() * 32, 1, 1);
    }
  } else if (pattern === 'grass_side') {
    ctx.fillStyle = '#6b4c30';
    ctx.fillRect(0, 0, 32, 32);
    // Dirt texture
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = darker('#6b4c30', Math.random() * 20);
      ctx.fillRect(Math.random() * 32, Math.random() * 32, 2, 2);
    }
    // Green top 4px
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 32, 4);
    for (let i = 0; i < 15; i++) {
      ctx.fillStyle = darker(baseColor, Math.random() * 15);
      ctx.fillRect(Math.random() * 32, Math.random() * 3, 1, 1);
    }
  } else if (pattern === 'stone_brick') {
    // Brick-like stone pattern
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const y = r * 8;
      const off = r % 2 === 0 ? 0 : 8;
      for (let c = -1; c < 5; c++) {
        const x = c * 16 + off;
        ctx.fillStyle = accentColor ?? baseColor;
        ctx.fillRect(x + 1, y + 1, 14, 7);
        ctx.strokeStyle = darker(baseColor, 30);
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 16, 8);
      }
    }
  } else if (pattern === 'roof') {
    // Stair-like roof pattern
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 4) {
      ctx.fillStyle = darker(baseColor, 10);
      ctx.fillRect(0, y, 32, 2);
      ctx.fillStyle = lighter(baseColor, 10);
      ctx.fillRect(0, y + 2, 32, 2);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Texture palette
const TEX = {
  grass_top: createBlockTexture('#70b04a', 'grass_top'),
  grass_side: createBlockTexture('#70b04a', 'grass_side'),
  stone: createBlockTexture('#7a7a7a', 'noise'),
  stone_brick: createBlockTexture('#828282', 'stone_brick', '#6e6e6e'),
  wood: createBlockTexture('#b8905a', 'planks'),
  brick: createBlockTexture('#a05040', 'brick', '#904030'),
  glass: createBlockTexture('#a0c8e8', 'glass'),
  sandstone: createBlockTexture('#d4b896', 'noise'),
  sandstone_smooth: createBlockTexture('#e0c8a0', 'solid'),
  roof: createBlockTexture('#803030', 'roof'),
  concrete: createBlockTexture('#c8c8c8', 'noise'),
  dark_stone: createBlockTexture('#505050', 'noise'),
  oak_wood: createBlockTexture('#8a6030', 'planks'),
  leaves: createBlockTexture('#4a8030', 'noise'),
  leaves_dark: createBlockTexture('#306020', 'noise'),
  lamp_glow: createBlockTexture('#fff8c0', 'solid'),
};

// Material cache: [top, bottom, sides]
function makeBlock(topTex: THREE.Texture, sideTex: THREE.Texture, bottomTex?: THREE.Texture): THREE.MeshToonMaterial[] {
  const gradient = createToonGradient();
  const top = new THREE.MeshToonMaterial({ map: topTex, gradientMap: gradient });
  const side = new THREE.MeshToonMaterial({ map: sideTex, gradientMap: gradient });
  const bot = new THREE.MeshToonMaterial({ map: bottomTex ?? sideTex, gradientMap: gradient });
  return [side, side, top, bot, side, side]; // +X, -X, +Y, -Y, +Z, -Z
}

function createToonGradient(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = '#999'; ctx.fillRect(1, 0, 1, 1);
  ctx.fillStyle = '#eee'; ctx.fillRect(2, 0, 1, 1);
  ctx.fillStyle = '#fff'; ctx.fillRect(3, 0, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
const toonGradient = createToonGradient();

/* ===== World-position seedable random ===== */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ===== Label sprite ===== */
function createLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.roundRect(0, 0, 256, 64, 8);
  ctx.fill();
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 1, 1);
  return sprite;
}

/* ===== Box helper ===== */
function addBox(
  parent: THREE.Group,
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  materials: THREE.MeshToonMaterial[],
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, materials);
  mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/* ===== Main scene builder ===== */
export async function createScene(): Promise<THREE.Group> {
  const scene = new THREE.Group();

  // ── Ground ──
  const gg = new THREE.PlaneGeometry(GROUND_W, GROUND_H);
  const groundMat = new THREE.MeshToonMaterial({ map: TEX.grass_top, gradientMap: toonGradient });
  // Repeat grass texture over ground
  const grassTiled = TEX.grass_top.clone();
  grassTiled.wrapS = grassTiled.wrapT = THREE.RepeatWrapping;
  grassTiled.repeat.set(GROUND_W / 2, GROUND_H / 2);
  grassTiled.needsUpdate = true;
  groundMat.map = grassTiled;

  const ground = new THREE.Mesh(gg, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid
  const grid = new THREE.GridHelper(Math.max(GROUND_W, GROUND_H), 72, 0x3a6a20, 0x3a6a20);
  grid.position.y = 0.01;
  scene.add(grid);

  // Zones
  for (const zone of Object.values(zonesData)) {
    const zGeo = new THREE.PlaneGeometry(zone.position.width / MAP_SCALE, zone.position.height / MAP_SCALE);
    const zMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x64b464),
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    const zMesh = new THREE.Mesh(zGeo, zMat);
    zMesh.rotation.x = -Math.PI / 2;
    zMesh.position.set(
      (zone.position.x + zone.position.width / 2) / MAP_SCALE,
      0.02,
      -(zone.position.y + zone.position.height / 2) / MAP_SCALE,
    );
    scene.add(zMesh);
  }

  // Roads
  createRoads(scene);

  // Buildings
  const buildingBoxes = createBuildings(scene);

  // Trees
  createTrees(scene);

  // Details: flowers, bushes, rocks
  createDetails(scene);

  // Lamps + benches
  createLamps(scene);
  createBenches(scene);

  scene.userData.buildingBoxes = buildingBoxes;
  return scene;
}

/* ===== Roads ===== */
function createRoads(scene: THREE.Group) {
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 32; roadCanvas.height = 32;
  const rctx = roadCanvas.getContext('2d')!;
  rctx.fillStyle = '#606058';
  rctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 100; i++) {
    const g = 80 + Math.random() * 30;
    rctx.fillStyle = `rgb(${g},${g},${g})`;
    rctx.fillRect(Math.random() * 32, Math.random() * 32, 2, 2);
  }
  const roadTex = new THREE.CanvasTexture(roadCanvas);
  roadTex.magFilter = THREE.NearestFilter;
  roadTex.minFilter = THREE.NearestFilter;
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.colorSpace = THREE.SRGBColorSpace;

  const roadMat = new THREE.MeshToonMaterial({ map: roadTex, color: 0xcccccc, gradientMap: toonGradient });
  const roadSegs: [number, number, number, number][] = [
    [2.5, 60, 64, -68 + 30],
    [60, 2.5, 64, -55],
    [30, 2.5, 64, -50],
    [30, 2.5, 64, -30],
    [50, 2.5, 64, -20],
    [15, 2.5, 85, -55],
    [15, 2.5, 35, -50],
    [18, 2.5, 64, -30],
  ];

  for (const [w, d, cx, cz] of roadSegs) {
    const t = roadTex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 2, d / 2);
    const m = roadMat.clone();
    m.map = t;
    const geo = new THREE.PlaneGeometry(w, d);
    const road = new THREE.Mesh(geo, m);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.05, cz);
    road.receiveShadow = true;
    scene.add(road);
  }
}

/* ===== Buildings ===== */
function createBuildings(scene: THREE.Group): THREE.Box3[] {
  const boxes: THREE.Box3[] = [];

  // Building style definitions
  const styles: Record<string, {
    wall: THREE.MeshToonMaterial[];
    trim: THREE.MeshToonMaterial[];
    roof: THREE.MeshToonMaterial[];
    floors: number;
    floorH: number;
  }> = {
    teaching: {
      wall: makeBlock(TEX.concrete, TEX.concrete),
      trim: makeBlock(TEX.stone_brick, TEX.stone_brick),
      roof: makeBlock(TEX.roof, TEX.roof),
      floors: 4, floorH: 1.4,
    },
    library: {
      wall: makeBlock(TEX.stone_brick, TEX.stone_brick),
      trim: makeBlock(TEX.dark_stone, TEX.dark_stone),
      roof: makeBlock(TEX.roof, TEX.roof),
      floors: 3, floorH: 1.5,
    },
    dorm_s: {
      wall: makeBlock(TEX.brick, TEX.brick),
      trim: makeBlock(TEX.wood, TEX.wood),
      roof: makeBlock(TEX.roof, TEX.roof),
      floors: 3, floorH: 1.2,
    },
    canteen_s: {
      wall: makeBlock(TEX.sandstone, TEX.sandstone),
      trim: makeBlock(TEX.wood, TEX.wood),
      roof: makeBlock(TEX.roof, TEX.roof),
      floors: 2, floorH: 1.6,
    },
    gate: {
      wall: makeBlock(TEX.stone_brick, TEX.stone_brick),
      trim: makeBlock(TEX.dark_stone, TEX.dark_stone),
      roof: makeBlock(TEX.roof, TEX.roof),
      floors: 1, floorH: 2.0,
    },
    bridge: {
      wall: makeBlock(TEX.stone_brick, TEX.stone_brick),
      trim: makeBlock(TEX.stone, TEX.stone),
      roof: makeBlock(TEX.roof, TEX.roof),
      floors: 1, floorH: 1.0,
    },
    stadium: {
      wall: makeBlock(TEX.concrete, TEX.concrete),
      trim: makeBlock(TEX.stone_brick, TEX.stone_brick),
      roof: makeBlock(TEX.dark_stone, TEX.dark_stone),
      floors: 2, floorH: 2.0,
    },
    art_center: {
      wall: makeBlock(TEX.sandstone_smooth, TEX.sandstone_smooth),
      trim: makeBlock(TEX.oak_wood, TEX.oak_wood),
      roof: makeBlock(TEX.roof, TEX.roof),
      floors: 2, floorH: 1.6,
    },
    lab: {
      wall: makeBlock(TEX.concrete, TEX.concrete),
      trim: makeBlock(TEX.glass, TEX.glass),
      roof: makeBlock(TEX.roof, TEX.roof),
      floors: 3, floorH: 1.4,
    },
  };

  // Glass material for windows
  const glassMat = makeBlock(TEX.glass, TEX.glass);

  for (const b of Object.values(buildingsData)) {
    const [wx, wz] = toWorld(b.x, b.y);
    const style = styles[b.id] ?? styles['teaching'];
    const bw = b.id === 'gate' ? 6 : b.id === 'bridge' ? 10 : b.id.includes('field') ? 12 : 5;
    const bd = b.id === 'gate' ? 2 : b.id === 'bridge' ? 3 : b.id.includes('field') ? 12 : 5;
    const totalH = style.floors * style.floorH + 0.8; // + roof height

    const group = new THREE.Group();
    group.position.set(wx, 0, wz);

    // Build floor by floor
    for (let f = 0; f < style.floors; f++) {
      const floorY = f * style.floorH;
      // Main wall block
      addBox(group, 0, floorY, 0, bw, style.floorH, bd, style.wall);

      // Window strips on even floors (every other floor)
      if (f % 2 === 0 && b.id !== 'gate' && b.id !== 'bridge') {
        const winW = 0.6; const winH = 0.8;
        const spacing = 1.5;
        for (let winX = spacing; winX + winW < bw; winX += spacing) {
          addBox(group, winX, floorY + 0.3, 0, winW, winH, 0.1, glassMat);
          addBox(group, winX, floorY + 0.3, bd - 0.1, winW, winH, 0.1, glassMat);
        }
      }
    }

    // Roof (slightly overhanging)
    const roofH = 0.6;
    const roofOverhang = 0.5;
    addBox(group, -roofOverhang, style.floors * style.floorH, -roofOverhang, bw + roofOverhang * 2, roofH, bd + roofOverhang * 2, style.roof);

    // Label
    const label = createLabel(b.name);
    label.position.set(bw / 2, totalH + 1.0, bd / 2);
    group.add(label);

    scene.add(group);

    // Collision box
    boxes.push(new THREE.Box3(
      new THREE.Vector3(wx, 0, wz),
      new THREE.Vector3(wx + bw, totalH, wz + bd),
    ));
  }

  return boxes;
}

/* ===== Trees (Minecraft style: trunk + foliage cube) ===== */
function createTrees(scene: THREE.Group) {
  const rng = seededRandom(42);
  const trunkMat = makeBlock(TEX.oak_wood, TEX.wood);
  const leafMats = [
    makeBlock(TEX.leaves, TEX.leaves),
    makeBlock(TEX.leaves_dark, TEX.leaves_dark),
  ];

  const treeDefs: [number, number, number, number][] = [];
  for (let i = 0; i < 40; i++) {
    const x = rng() * GROUND_W;
    const z = -(rng() * GROUND_H);
    const nearRoad = Math.abs(x - 64) < 3;
    const nearEW = Math.abs(z + 40) < 3 || Math.abs(z + 25) < 3;
    if (nearRoad || nearEW) continue;
    const h = 2 + rng() * 3; // trunk height
    const lw = 1.5 + rng() * 2; // leaf width
    treeDefs.push([x, z, h, lw]);
  }

  for (const [x, z, h, lw] of treeDefs) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Trunk
    const trunkW = 0.4;
    addBox(group, -trunkW / 2, 0, -trunkW / 2, trunkW, h, trunkW, trunkMat);

    // Leaves (2-3 layers)
    const leafMat = leafMats[Math.floor(rng() * leafMats.length)];
    const layers = h > 3.5 ? 3 : 2;
    for (let l = 0; l < layers; l++) {
      const lh = lw * (1 - l * 0.2);
      const off = lw * (l * 0.15);
      addBox(group, -(lh) / 2, h + l * 0.8, -(lh) / 2, lh, 0.8, lh, leafMat);
      addBox(group, -(lh) / 2 + off, h + l * 0.8 + 0.8, -(lh) / 2 + off, lh, 0.8, lh, leafMat);
    }

    scene.add(group);
  }
}

/* ===== Details: flowers, bushes, rocks ===== */
function createDetails(scene: THREE.Group) {
  const flowerMat = makeBlock(TEX.leaves, TEX.leaves);
  const bushMat = makeBlock(TEX.leaves_dark, TEX.leaves_dark);
  const rockMat = makeBlock(TEX.stone, TEX.stone);
  
  // Flower colors
  const flowerColors = [0xff6666, 0xffcc66, 0xff9966, 0xffffff, 0xff88cc, 0xffff88];
  const flowerMats = flowerColors.map(c => {
    const m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient });
    return [m, m, m, m, m, m];
  });

  const rng = seededRandom(999);

  // Scatter flowers near buildings and along paths
  const flowerSpots: [number, number][] = [];
  for (let i = 0; i < 80; i++) {
    const x = 2 + rng() * 124;
    const z = -(2 + rng() * 68);
    const nearRoad = Math.abs(x - 64) < 4 || Math.abs(z + 40) < 4 || Math.abs(z + 25) < 4;
    if (nearRoad) continue;
    flowerSpots.push([x, z]);
  }

  for (const [x, z] of flowerSpots) {
    // Tiny flower cluster
    const cluster = new THREE.Group();
    cluster.position.set(x, 0.02, z);
    for (let f = 0; f < 3 + Math.floor(rng() * 4); f++) {
      const fx = (rng() - 0.5) * 1.2;
      const fz = (rng() - 0.5) * 1.2;
      const mat = flowerMats[Math.floor(rng() * flowerMats.length)];
      addBox(cluster, fx, 0, fz, 0.12, 0.25 + rng() * 0.1, 0.12, mat);
    }
    // Green base (leaves)
    addBox(cluster, -0.15, 0, -0.15, 0.3, 0.08, 0.3, flowerMat);
    scene.add(cluster);
  }

  // Bushes near buildings
  const bushSpots: [number, number][] = [
    [60, -22], [60, -30], [68, -24], [68, -28],
    [80, -52], [84, -56], [86, -52],
    [40, -46], [44, -50], [38, -52],
    [26, -54], [32, -56], [28, -18],
    [50, -18], [54, -16],
  ];
  for (const [x, z] of bushSpots) {
    const bush = new THREE.Group();
    bush.position.set(x, 0, z);
    const bl = 0.4;
    addBox(bush, -bl, 0, -bl, bl * 2, 0.6, bl * 2, bushMat);
    addBox(bush, -bl * 0.6, 0.6, -bl * 0.6, bl * 1.2, 0.5, bl * 1.2, bushMat);
    scene.add(bush);
  }

  // Decorative rocks along paths
  for (let i = 0; i < 25; i++) {
    const x = 60 + (rng() - 0.5) * 20;
    const z = -(10 + rng() * 55);
    const sx = 0.3 + rng() * 0.5;
    const sy = 0.2 + rng() * 0.3;
    const sz = 0.3 + rng() * 0.5;
    addBox(scene, x, 0, z, sx, sy, sz, rockMat);
  }
}

/* ===== Lamps (post + glow cube) ===== */
function createLamps(scene: THREE.Group) {
  const postMat = makeBlock(TEX.dark_stone, TEX.dark_stone);
  const glowMat = new THREE.MeshToonMaterial({
    color: 0xfff8c0,
    emissive: 0xfff8c0,
    emissiveIntensity: 0.5,
    gradientMap: toonGradient,
  });

  for (let z = -65; z <= -10; z += 8) {
    for (const side of [-2.5, 2.5]) {
      const group = new THREE.Group();
      group.position.set(64 + side, 0, z);
      addBox(group, -0.15, 0, -0.15, 0.3, 2.5, 0.3, postMat);
      // Glow cube on top
      addBox(group, -0.25, 2.5, -0.25, 0.5, 0.5, 0.5, [glowMat, glowMat, glowMat, glowMat, glowMat, glowMat]);
      scene.add(group);
    }
  }
}

/* ===== Benches (simple plank + legs) ===== */
function createBenches(scene: THREE.Group) {
  const plankMat = makeBlock(TEX.wood, TEX.wood);
  const legMat = makeBlock(TEX.oak_wood, TEX.oak_wood);

  const placements: [number, number, number][] = [
    [64, -24, 0], [64, -26, Math.PI],
    [58, -28, Math.PI / 2], [58, -32, -Math.PI / 2],
    [82, -54, 0], [82, -56, Math.PI],
    [92, -56, 0],
    [42, -48, 0], [42, -52, Math.PI],
    [30, -56, Math.PI / 2],
    [22, -18, 0],
  ];

  for (const [x, z, rot] of placements) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    addBox(group, -0.8, 0.3, -0.2, 1.6, 0.15, 0.4, plankMat);
    addBox(group, -0.7, 0.0, -0.15, 0.15, 0.3, 0.15, legMat);
    addBox(group, 0.55, 0.0, -0.15, 0.15, 0.3, 0.15, legMat);
    addBox(group, -0.7, 0.0, 0.15, 0.15, 0.3, 0.15, legMat);
    addBox(group, 0.55, 0.0, 0.15, 0.15, 0.3, 0.15, legMat);
    scene.add(group);
  }
}

/* ===== Helpers ===== */
function toWorld(px: number, py: number): [number, number] {
  return [px / MAP_SCALE, -py / MAP_SCALE];
}
