import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BloomPass } from 'three/examples/jsm/postprocessing/BloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createScene } from './scene';
import { Player, InputState } from './player';
import { ThirdPersonCamera } from './camera';
import { StateManager } from './core/StateManager';
import { SaveManager } from './core/SaveManager';
import { WorldManager } from './systems/world/WorldManager';
import { CombatManager } from './systems/combat/CombatManager';
import { CombatUI } from './ui/CombatUI';
import { HUD } from './ui/HUD';
import type { GameConfig } from './types';
import gameConfigData from './data/game-config.json';
import buildingsData from './data/buildings.json';
import zonesData from './data/zones.json';
import demonsData from './data/demons.json';

/* ===== RENDERER ===== */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

/* ===== INPUT ===== */
const input: InputState = { forward: false, backward: false, left: false, right: false, interact: false };

const keyMap: Record<string, keyof InputState> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'backward', ArrowDown: 'backward',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyE: 'interact',
};

window.addEventListener('keydown', (e) => {
  const field = keyMap[e.code];
  if (field) {
    input[field] = true;
    if (field !== 'interact') e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const field = keyMap[e.code];
  if (field) input[field] = false;
});

/* ===== GAME SYSTEMS ===== */
const config = gameConfigData as unknown as GameConfig;
const stateManager = new StateManager();
stateManager.init(config);

const saveManager = new SaveManager(stateManager);

const worldManager = new WorldManager(
  stateManager, saveManager,
  buildingsData as Record<string, any>,
  zonesData as Record<string, any>,
  demonsData as Record<string, any>,
);

const combatManager = new CombatManager(stateManager);
const combatUI = new CombatUI(combatManager);
const hud = new HUD(stateManager);

/* ===== SCENE SETUP ===== */
const scene = new THREE.Scene();

// ── Fog ──
scene.fog = new THREE.FogExp2(0x8db6ce, 0.0015);
scene.background = new THREE.Color(0x8db6ce);

// ── Lighting ──
const ambient = new THREE.AmbientLight(0xffeedd, 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff5e8, 2.5);
sun.position.set(80, 100, -40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -100;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const hemisphere = new THREE.HemisphereLight(0x87CEEB, 0x5a7d3a, 0.6);
scene.add(hemisphere);

// ── Player ──
const player = new Player();
scene.add(player.mesh);

// ── Camera ──
const camera = new ThirdPersonCamera();

let buildingBoxes: THREE.Box3[] = [];

/* ===== POST PROCESSING ===== */
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera.camera);
composer.addPass(renderPass);

const bloomPass = new BloomPass(0.8, 25, 0.85);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Handle resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.camera.aspect = window.innerWidth / window.innerHeight;
  camera.camera.updateProjectionMatrix();
});

/* ===== COMBAT FLOW ===== */
let inCombat = false;

function onEncounter(demon: any, demonId: string) {
  inCombat = true;
  combatManager.startCombat(demon, demonId, (result) => {
    worldManager.onCombatComplete(result, demonId);
    combatUI.showResult(result, demon.name ?? demonId, null, () => {
      combatUI.hide();
      inCombat = false;
    });
  });
  combatUI.show();
}

worldManager.onEncounter = onEncounter;
worldManager.onInteraction = (building, action) => {
  let msg = '';
  if (action === 'save') msg = '游戏已保存!';
  else if (action === 'training') msg = `进入 ${building.name} — 训练功能开发中`;
  else msg = `${building.name} — 功能开发中`;
  console.log(msg);
};

/* ===== GAME LOOP ===== */
const clock = new THREE.Clock();
let interactHeld = false;

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);

  if (!inCombat) {
    player.update(dt, input, buildingBoxes);

    worldManager.update(player.mesh.position.x, player.mesh.position.z, dt);

    if (input.interact && !interactHeld) {
      worldManager.tryInteract();
    }
    interactHeld = input.interact;

    hud.setInteractionPrompt(worldManager.interactionPrompt);
  }

  camera.update(player.mesh);

  if (inCombat) combatManager.update(dt);

  // Render through post-processing pipeline
  composer.render();
}

/* ===== BOOT ===== */
async function boot() {
  // Load sky HDR
  new RGBELoader().load('/assets/env/sky.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
    scene.fog = new THREE.FogExp2(0x8db6ce, 0.0008); // lighter fog with HDR sky
  });

  const worldGroup = await createScene();
  scene.add(worldGroup);
  buildingBoxes = (worldGroup.userData?.buildingBoxes as THREE.Box3[]) ?? [];
}

// Start immediately
animate();
boot();

console.log('🎮 三年游 3D 就绪! WASD移动, E键交互, 滚轮缩放, 中键旋转');
console.log('✨ Bloom + ACES 色调映射 + 雾效已启用');
