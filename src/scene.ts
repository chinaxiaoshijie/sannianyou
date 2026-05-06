import * as THREE from 'three';
import buildingsData from './data/buildings.json';
import zonesData from './data/zones.json';

const MAP_SCALE = 10;
const GROUND_W = 128;
const GROUND_H = 72;

/* ===== Monument Valley pastel palette ===== */
const PALETTE = {
  coral:    0xe8a598,
  mint:     0x8db6a4,
  cream:    0xf5e6d3,
  skyBlue:  0xa8c8e8,
  lavender: 0xc4b5d0,
  paleYellow: 0xf0e5c8,
  sand:     0xd4c5b0,
  water:    0x5a9eaa,
  darkTeal: 0x3b6972,
  white:    0xfaf5f0,
  shadow:   0x8a7a6a,
  grass:    0xb5c8a0,
  path:     0xdcc8b0,
  accent:   0xe07060,
};

/* ===== Smooth toon material (no pixel noise) ===== */
function createToonGradient(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 1;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#666'; ctx.fillRect(0,0,1,1);
  ctx.fillStyle = '#aaa'; ctx.fillRect(1,0,1,1);
  ctx.fillStyle = '#eee'; ctx.fillRect(2,0,1,1);
  ctx.fillStyle = '#fff'; ctx.fillRect(3,0,1,1);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  return t;
}
const toonGrad = createToonGradient();

function mat(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGrad });
}

function matArr(color: number): THREE.MeshToonMaterial[] {
  const m = mat(color);
  return [m,m,m,m,m,m];
}

/* ===== Helpers ===== */
function toWorld(px: number, py: number): [number, number] {
  return [px / MAP_SCALE, -py / MAP_SCALE];
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function createLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#5a5040';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(canvas);
  t.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  sp.scale.set(4, 1, 1);
  return sp;
}

function addBox(
  parent: THREE.Group, x: number, y: number, z: number,
  w: number, h: number, d: number, materials: THREE.MeshToonMaterial[],
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, materials);
  mesh.position.set(x + w/2, y + h/2, z + d/2);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Group, cx: number, cy: number, cz: number,
  r: number, h: number, color: number,
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, 12);
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.position.set(cx, cy + h/2, cz);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/* ===== Main scene builder ===== */
export async function createScene(): Promise<THREE.Group> {
  const scene = new THREE.Group();

  // ── Ground plane ──
  const gGeo = new THREE.PlaneGeometry(GROUND_W, GROUND_H);
  const gMat = new THREE.MeshToonMaterial({ color: 0xc8b898, gradientMap: toonGrad });  // slightly darker sand for path contrast
  const ground = new THREE.Mesh(gGeo, gMat);
  ground.rotation.x = -Math.PI/2; ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── Subtle grid ──
  const grid = new THREE.GridHelper(128, 64, 0xc8b898, 0xc8b898);
  grid.position.y = 0.005;
  grid.material.opacity = 0.25; grid.material.transparent = true;
  scene.add(grid);

  // ── Zone colors (translucent) ──
  const zoneColors: Record<string, number> = {
    south: 0xc8b8a8, central: 0xb8c8b0, north: 0xc0b8d0, northwest: 0xc8c0b8,
  };
  for (const zone of Object.values(zonesData)) {
    const zGeo = new THREE.PlaneGeometry(zone.position.width/MAP_SCALE, zone.position.height/MAP_SCALE);
    const zMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(zoneColors[zone.id] ?? 0xc8b8a8),
      transparent: true, opacity: 0.12, depthWrite: false,
    });
    const m = new THREE.Mesh(zGeo, zMat);
    m.rotation.x = -Math.PI/2; m.position.set(
      (zone.position.x + zone.position.width/2)/MAP_SCALE, 0.02,
      -(zone.position.y + zone.position.height/2)/MAP_SCALE,
    );
    scene.add(m);
  }

  // ── Roads ──
  createRoads(scene);

  // ── Buildings ──
  const buildingBoxes = createBuildings(scene);

  // ── Water pool ──
  createWater(scene);

  // ── Grass patches ──
  createGrassPatches(scene);

  // ── Trees ──
  createTrees(scene);

  // ── Lamps ──
  createLamps(scene);

  // ── Direction markers ──
  createDirectionMarkers(scene);

  scene.userData.buildingBoxes = buildingBoxes;
  return scene;
}

/* ===== Roads — Monument Valley white stone paths ===== */
function createRoads(scene: THREE.Group) {
  const pathMat = mat(PALETTE.white);
  const edgeMat = mat(PALETTE.shadow);

  // [width, depth, centerX, centerZ]
  // Principle: all roads strictly OUTSIDE building Box3 collision zones.
  // East-west lateral roads placed south of each building row's south face.
  // Approach spurs connect lateral roads to building entrances (south face).
  const segs: [number, number, number, number][] = [
    // ── North-south spine (x=61-65, z=-4 to -68) ──
    // teaching at x=50-59, library at x=74-82 → clear corridor x=59-74
    [4, 64, 63, -36],

    // ── South entrance cross-axis ──
    [14, 4, 63, -64],     // z=-64: cross through gate/bridge area

    // ── Lateral roads (south of buildings, spine→east/west) ──
    [62, 4, 61, -57],     // z=-57: south of art_center(30-36) + canteen(80-86)
    [36, 4, 50, -52],     // z=-52: south of stadium(40-54)
    [74, 4, 61, -37],     // z=-37: south of library(74-82) + teaching(50-59)
    [52, 4, 37, -22],     // z=-22: south of lab(20-26)
    [22, 4, 63, -14],     // z=-14: south of field_n(64-76)
    [30, 4, 99, -32],     // z=-32: south of field_s(100-112)

    // ── Building approach spurs (lateral → entrance) ──
    [4, 3, 67, -62],      // → bridge south approach
    [4, 3, 78, -37],      // → library entrance (z=-35)
    [4, 3, 55, -32],      // → teaching entrance (z=-30)
    [4, 3, 83, -57],      // → canteen entrance (z=-55)
    [4, 3, 93, -58],      // → dorm entrance (z=-58)
    [4, 3, 33, -57],      // → art_center entrance (z=-55)
    [4, 3, 47, -52],      // → stadium entrance (z=-50)
    [4, 3, 23, -22],      // → lab entrance (z=-20)
    [4, 3, 70, -14],      // → field_n entrance (z=-12)
    [4, 3, 106, -32],     // → field_s entrance (z=-30)
  ];

  for (const [w, d, cx, cz] of segs) {
    // Dark border underneath (slightly wider)
    const edgeGeo = new THREE.PlaneGeometry(w + 0.6, d + 0.6);
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(cx, 0.02, cz);
    edge.receiveShadow = true;
    scene.add(edge);

    // White stone path on top
    const g = new THREE.PlaneGeometry(w, d);
    const r = new THREE.Mesh(g, pathMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(cx, 0.06, cz);
    r.receiveShadow = true;
    scene.add(r);
  }
}

/* ===== Buildings — Monument Valley style ===== */
function createBuildings(scene: THREE.Group): THREE.Box3[] {
  const boxes: THREE.Box3[] = [];

  const styles: Record<string, { color: number; floors: number; floorH: number }> = {
    teaching:   { color: PALETTE.coral, floors: 4, floorH: 1.5 },
    library:    { color: PALETTE.mint, floors: 3, floorH: 1.6 },
    dorm_s:     { color: PALETTE.lavender, floors: 3, floorH: 1.3 },
    canteen_s:  { color: PALETTE.paleYellow, floors: 2, floorH: 1.8 },
    gate:       { color: PALETTE.cream, floors: 1, floorH: 2.5 },
    bridge:     { color: PALETTE.sand, floors: 1, floorH: 1.2 },
    stadium:    { color: PALETTE.skyBlue, floors: 2, floorH: 2.2 },
    art_center: { color: PALETTE.coral, floors: 2, floorH: 1.8 },
    lab:        { color: PALETTE.mint, floors: 3, floorH: 1.5 },
  };

  const sizeMap: Record<string, [number, number]> = {
    gate:[7,2], bridge:[12,2], library:[8,6], teaching:[9,6],
    canteen_s:[6,5], dorm_s:[6,5], stadium:[14,10], art_center:[6,5],
    lab:[6,5], field_n:[12,12], field_s:[12,12],
  };

  for (const b of Object.values(buildingsData) as any[]) {
    const [wx, wz] = toWorld(b.x, b.y);
    const style = styles[b.id] ?? styles['teaching'];
    const [bw, bd] = sizeMap[b.id] ?? [6,5];
    const totalH = style.floors * style.floorH + 1.0;
    const group = new THREE.Group();
    group.position.set(wx, 0, wz);

    // ── Plinth (raised platform) ──
    const plinthH = 0.3; const plinthPad = 0.4;
    addBox(group, -plinthPad, 0, -plinthPad, bw + plinthPad*2, plinthH, bd + plinthPad*2, matArr(PALETTE.shadow));

    // ── Floor blocks ──
    for (let f = 0; f < style.floors; f++) {
      const fy = plinthH + f * style.floorH;
      const fw = f === 0 ? bw : bw - f * 0.3;
      const fd = f === 0 ? bd : bd - f * 0.3;
      const fx = (bw - fw) / 2;
      const fz = (bd - fd) / 2;
      addBox(group, fx, fy, fz, fw, style.floorH, fd, matArr(style.color));

      // ── Window recesses (dark inset squares) ──
      if (f % 2 === 0 && b.id !== 'gate' && b.id !== 'bridge') {
        const holeW = 0.6; const holeH = 0.8;
        const startX = fx + 1.2; const gap = 1.8;
        for (let wx2 = startX; wx2 + holeW < fx + fw; wx2 += gap) {
          addBox(group, wx2, fy + 0.3, fz - 0.01, holeW, holeH, 0.05, matArr(PALETTE.shadow));
          addBox(group, wx2, fy + 0.3, fz + fd - 0.04, holeW, holeH, 0.05, matArr(PALETTE.shadow));
        }
      }
    }

    // ── Columns (at corners) ──
    if (b.id !== 'gate' && b.id !== 'bridge' && b.id.includes('field') === false) {
      const ch = style.floors * style.floorH + plinthH;
      const corners: [number, number][] = [[0.5,0.5],[bw-0.5,0.5],[0.5,bd-0.5],[bw-0.5,bd-0.5]];
      for (const [cx,cz] of corners) {
        addCylinder(group, cx, plinthH, cz, 0.2, ch, PALETTE.white);
      }
    }

    // ── Arched entry (front face) ──
    if (b.id !== 'bridge') {
      const archW = bw * 0.4; const archH = plinthH + 1.5;
      const archCX = bw/2; const archCZ = 0;
      // Pillars
      const pillarW = 0.25;
      addBox(group, archCX - archW/2 - pillarW, plinthH, archCZ, pillarW, archH, 0.3, matArr(PALETTE.white));
      addBox(group, archCX + archW/2, plinthH, archCZ, pillarW, archH, 0.3, matArr(PALETTE.white));
      // Arch top (half cylinder)
      const archR = archW/2 + pillarW;
      const archGeo = new THREE.CylinderGeometry(archR, archR, 0.2, 16, 1, false, Math.PI, Math.PI);
      const archMesh = new THREE.Mesh(archGeo, mat(PALETTE.white));
      archMesh.position.set(archCX, archH + plinthH, archCZ);
      archMesh.rotation.z = Math.PI;
      group.add(archMesh);
    }

    // ── Stepped roof ──
    const roofBaseY = plinthH + style.floors * style.floorH;
    for (let r = 0; r < 3; r++) {
      const rw = bw - r * 1.2; const rd = bd - r * 1.2;
      const rx = (bw - rw)/2; const rz = (bd - rd)/2;
      addBox(group, rx, roofBaseY + r*0.5, rz, rw, 0.5, rd, matArr(PALETTE.accent));
    }

    // ── Label ──
    const label = createLabel(b.name);
    label.position.set(bw/2, totalH + 1.2, bd/2);
    group.add(label);

    scene.add(group);
    boxes.push(new THREE.Box3(
      new THREE.Vector3(wx, 0, wz),
      new THREE.Vector3(wx+bw, totalH, wz+bd),
    ));
  }

  return boxes;
}

/* ===== Water pool ===== */
function createWater(scene: THREE.Group) {
  const pool = new THREE.Group();
  pool.position.set(64, 0, -45);
  // Basin
  addBox(pool, -4, -0.4, -4, 8, 0.4, 8, matArr(PALETTE.shadow));
  // Water surface
  const wGeo = new THREE.PlaneGeometry(7, 7);
  const wMat = new THREE.MeshToonMaterial({
    color: PALETTE.water, transparent: true, opacity: 0.85, gradientMap: toonGrad,
  });
  const water = new THREE.Mesh(wGeo, wMat);
  water.rotation.x = -Math.PI/2; water.position.set(0, 0.05, 0);
  pool.add(water);
  // Center fountain column
  addCylinder(pool, 0, 0.05, 0, 0.3, 1.5, PALETTE.white);
  addBox(pool, -0.4, 1.5, -0.4, 0.8, 0.15, 0.8, matArr(PALETTE.accent));
  scene.add(pool);
}

/* ===== Grass patches — muted geometric lawns ===== */
function createGrassPatches(scene: THREE.Group) {
  const greens = [0xb5c8a0, 0xa8c098, 0xc0d0a8, 0x9db89a, 0xc8d8b4, 0xb0c898];
  const rng = seededRandom(77);

  const patches: [number, number, number, number][] = [
    // ── South entrance ──
    [5, 4, 56, -66], [4, 3, 60, -64],
    // ── East of spine ──
    [6, 8, 60, -50], [5, 4, 62, -42], [5, 4, 70, -42], [4, 3, 68, -38],
    // ── West of spine ──
    [8, 6, 32, -44], [5, 4, 46, -38],
    [10, 8, 28, -36], [8, 5, 36, -32],
    [6, 4, 40, -28],
    [5, 4, 34, -38],
    [7, 4, 30, -42],
    [6, 4, 34, -18],
    [5, 4, 24, -26],
    // ── Far west ──
    [8, 6, 8, -36], [6, 5, 12, -48], [7, 5, 6, -28],
    [5, 3, 10, -20], [6, 4, 14, -14],
    // ── Far east ──
    [8, 6, 96, -46], [6, 5, 98, -36], [5, 4, 100, -52],
    [5, 4, 104, -40], [5, 4, 78, -48],
    [4, 3, 108, -48], [4, 3, 94, -28],
    // ── field_s area ──
    [7, 5, 114, -26], [8, 4, 96, -24],
    // ── Library east ──
    [6, 5, 84, -38], [5, 3, 88, -32], [8, 5, 88, -30],
    // ── North / field_n area ──
    [8, 6, 50, -8], [6, 4, 56, -12],
    [10, 5, 40, -4], [8, 4, 52, -2],
    // ── Water area ──
    [4, 3, 56, -44],
  ];

  for (const [w, d, cx, cz] of patches) {
    const shade = greens[Math.floor(rng() * greens.length)];
    const geo = new THREE.PlaneGeometry(w, d);
    const grassMat = new THREE.MeshToonMaterial({
      color: shade, gradientMap: toonGrad, transparent: true, opacity: 0.7,
    });
    const grass = new THREE.Mesh(geo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(cx, 0.015, cz);
    grass.receiveShadow = true;
    scene.add(grass);
  }
}

/* ===== Trees — geometric spheres on cylinders ===== */
function createTrees(scene: THREE.Group) {
  const rng = seededRandom(42);
  const treeColors = [PALETTE.mint, PALETTE.coral, PALETTE.lavender, PALETTE.skyBlue, PALETTE.paleYellow];
  const trunkColor = PALETTE.shadow;

  const spots: [number, number, number, number][] = [];
  for (let i = 0; i < 35; i++) {
    const x = 3 + rng() * 122; const z = -(3 + rng() * 66);
    const nearRoad = Math.abs(x-63) < 4 || Math.abs(z+40) < 4 || Math.abs(z+25) < 4;
    if (nearRoad) continue;
    const h = 1.5 + rng() * 2.5;
    const cr = 0.6 + rng() * 1.0;
    spots.push([x, z, h, cr]);
  }

  for (const [x,z,h,cr] of spots) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addCylinder(group, 0, 0, 0, 0.12, h, trunkColor);
    const leafColor = treeColors[Math.floor(rng() * treeColors.length)];
    // Main sphere
    const sGeo = new THREE.SphereGeometry(cr, 12, 8);
    const sMesh = new THREE.Mesh(sGeo, mat(leafColor));
    sMesh.position.y = h + cr*0.6; sMesh.castShadow = true;
    group.add(sMesh);
    // Smaller offset sphere for asymmetrical silhouette
    const s2Geo = new THREE.SphereGeometry(cr*0.7, 10, 6);
    const s2 = new THREE.Mesh(s2Geo, mat(leafColor));
    s2.position.set(cr*0.5, h + cr*0.2, cr*0.3);
    group.add(s2);
    scene.add(group);
  }
}

/* ===== Lamps — minimal columns ===== */
function createLamps(scene: THREE.Group) {
  for (let z = -64; z <= -12; z += 9) {
    for (const side of [-3, 3]) {
      const g = new THREE.Group();
      g.position.set(63+side, 0, z);
      addCylinder(g, 0, 0, 0, 0.12, 2.8, PALETTE.white);
      const glowGeo = new THREE.SphereGeometry(0.25, 8, 6);
      const glowMat = new THREE.MeshToonMaterial({
        color: PALETTE.accent, emissive: PALETTE.accent,
        emissiveIntensity: 0.3, gradientMap: toonGrad,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.y = 2.8; g.add(glow);
      scene.add(g);
    }
  }
}

/* ===== Direction markers ===== */
function createDirectionMarkers(scene: THREE.Group) {
  const dirs: [string, number, number, number][] = [
    ['北', 64, 0.1, -1.5], ['南', 64, 0.1, -70.5],
    ['东', 126.5, 0.1, -36], ['西', 1.5, 0.1, -36],
  ];
  for (const [text, x, y, z] of dirs) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = PALETTE.accent.toString(16).padStart(6,'0');
    ctx.fillStyle = '#d08070';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    sp.position.set(x, y, z); sp.scale.set(6,6,1);
    scene.add(sp);
  }
}
