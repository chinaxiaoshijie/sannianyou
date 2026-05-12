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
import { LawManager } from './core/LawManager';
import { WorldManager } from './systems/world/WorldManager';
import { TutorialManager } from './systems/TutorialManager';
import { EquipmentManager } from './systems/EquipmentManager';

import { CombatEngine } from './systems/combat/CombatEngine';
import { CombatArena } from './systems/combat/CombatArena';
import { LawEffects } from './systems/combat/LawEffects';
import { DamageNumbers } from './systems/combat/DamageNumbers';
import { SoundManager } from './systems/combat/SoundManager';
import { CombatHUD } from './ui/CombatHUD';

import { HUD } from './ui/HUD';
import { LawHUD } from './ui/LawHUD';
import { LawPanel } from './ui/LawPanel';
import { CultivationUI } from './ui/CultivationUI';
import { MapPanel } from './ui/MapPanel';
import { CodexPanel } from './ui/CodexPanel';
import { HelpButton } from './ui/HelpButton';
import type { Question, Building, Zone } from './types';
import type { GameConfig, BossData } from './types';
import gameConfigData from './data/game-config.json';
import buildingsData from './data/buildings.json';
import zonesData from './data/zones.json';
import demonsData from './data/demons.json';
import physicsQuestionsData from './data/questions/physics.json';

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

/* ===== EQUIPMENT SYSTEM ===== */
const equipmentManager = new EquipmentManager(stateManager);

const worldManager = new WorldManager(
  stateManager, saveManager,
  buildingsData as unknown as Record<string, Building>,
  zonesData as unknown as Record<string, Zone>,
  demonsData as unknown as Record<string, any>,
);


const hud = new HUD(stateManager);

/* ===== LAW SYSTEM ===== */
const lawManager = new LawManager(stateManager, equipmentManager);
const lawHUD = new LawHUD(lawManager);

/* ===== TUTORIAL SYSTEM ===== */
const tutorialManager = new TutorialManager(stateManager, lawManager);
const helpButton = new HelpButton();
helpButton.init();

/* ===== LAW PANEL (with equipment tab) ===== */
const lawPanel = new LawPanel(lawManager, equipmentManager);

/* ===== KEY BINDINGS (C=Law Panel, M=Map Panel) ===== */
const mapPanel = new MapPanel();

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && !inCombat) {
    lawPanel.toggle();
    e.preventDefault();
  }
  if (e.code === 'KeyM' && !inCombat && !cultivationUI.isOpen) {
    mapPanel.toggle();
    e.preventDefault();
  }
  if (e.code === 'KeyJ' && !inCombat && !cultivationUI.isOpen && codexPanel) {
    codexPanel.toggle();
    e.preventDefault();
  }
});

/* ===== CULTIVATION SYSTEM ===== */
const cultivationUI = new CultivationUI(
  stateManager,
  lawManager,
  physicsQuestionsData as Question[],
  equipmentManager,
);

// Dev mode only — gate behind URL param ?dev
if (new URLSearchParams(window.location.search).has('dev')) {
  lawManager.checkUnlock(100);
  lawManager.autoEquip();
}

/* ===== CODEX PANEL (J key) ===== */
let codexPanel: CodexPanel | null = null;
try {
  codexPanel = new CodexPanel(stateManager, lawManager, equipmentManager);
  console.log('[CodexPanel] 初始化成功');
} catch (err) {
  console.error('[CodexPanel] 初始化失败:', err);
  // 游戏继续运行，只是图卷不可用
}

// Compass click → reset camera to north
const compassEl = document.getElementById('hud-compass');
if (compassEl) {
  compassEl.addEventListener('click', () => {
    camera.resetOrientation();
  });
}

/* ===== SCENE SETUP ===== */
const scene = new THREE.Scene();

// ── Fog & Sky (warm peach Monument Valley palette) ──
scene.fog = new THREE.FogExp2(0xf0d8c8, 0.0012);
scene.background = new THREE.Color(0xf0d8c8);

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

const hemisphere = new THREE.HemisphereLight(0xf5e0d0, 0xb8a890, 0.5);
scene.add(hemisphere);

// ── Player ──
const player = new Player();
scene.add(player.mesh);

// ── Camera ──
const camera = new ThirdPersonCamera();

let buildingBoxes: THREE.Box3[] = [];

/* ===== POST PROCESSING ===== */
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera.activeCamera);
composer.addPass(renderPass);

const bloomPass = new BloomPass(0.8, 25, 0.85);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Handle resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

/* ===== WORLD INTERACTION ===== */
worldManager.onInteraction = (building, action) => {
  if (action === 'save') {
    console.log('游戏已保存!');
  } else if (action === 'training') {
    cultivationUI.open('物理');
  } else {
    console.log(`${building.name} — 功能开发中`);
  }
};

/* ===== REAL-TIME COMBAT ENGINE (Phase 3a/3b) ===== */
const sound = new SoundManager();
let inCombat = false;
let combatEngine: CombatEngine | null = null;
let combatArena: CombatArena | null = null;
let lawEffects: LawEffects | null = null;
let combatHUD: CombatHUD | null = null;

// Combat input state
const combatInput = { dodge: false, lawSlot1: false, lawSlot2: false, lawSlot3: false };

// Track previous dodge state to avoid spamming messages
let prevCombatDodging = false;
let prevWeaknessActive = false;

// Combat key bindings (space = dodge, 1/2/3 = laws)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && inCombat) {
    combatInput.dodge = true;
    e.preventDefault();
  }
  if (e.code === 'Digit1' && inCombat) {
    combatInput.lawSlot1 = true;
    e.preventDefault();
  }
  if (e.code === 'Digit2' && inCombat) {
    combatInput.lawSlot2 = true;
    e.preventDefault();
  }
  if (e.code === 'Digit3' && inCombat) {
    combatInput.lawSlot3 = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') combatInput.dodge = false;
  if (e.code === 'Digit1') combatInput.lawSlot1 = false;
  if (e.code === 'Digit2') combatInput.lawSlot2 = false;
  if (e.code === 'Digit3') combatInput.lawSlot3 = false;
});

// BOSS trigger zone (图书馆前广场) — at world position (74, 0, -42)
const BOSS_TRIGGER: { x: number; z: number; radius: number } = {
  x: 74,
  z: -42,
  radius: 8,
};

/** Check if player is within BOSS trigger zone. */
function checkBossTrigger(): boolean {
  const px = player.mesh.position.x;
  const pz = player.mesh.position.z;
  const dx = px - BOSS_TRIGGER.x;
  const dz = pz - BOSS_TRIGGER.z;
  return Math.sqrt(dx * dx + dz * dz) < BOSS_TRIGGER.radius;
}

let bossTriggered = false;
let bossPromptShown = false;
let bossConfirmVisible = false;

/** Start real-time BOSS combat. */
function startRealtimeCombat(): void {
  const demonData = demonsData['forgotten_script'] as BossData;
  if (!demonData) return;

  inCombat = true;
  bossTriggered = true;

  const playerXinLi = stateManager.getPlayerState().xinLi;
  const arenaCenter = new THREE.Vector3(BOSS_TRIGGER.x, 0, BOSS_TRIGGER.z);

  // Save player world position for post-combat restore
  const returnPos = player.mesh.position.clone();

  combatEngine = new CombatEngine();
  combatEngine.arenaCenter = arenaCenter;
  combatEngine.start(scene, demonData, lawManager, playerXinLi, undefined, equipmentManager);

  // Show combat arena
  combatArena = new CombatArena();
  combatArena.show(scene, arenaCenter);

  // Move player to arena center (slightly offset from BOSS)
  const playerOffset = new THREE.Vector3(3, 0, 3); // offset so player is visible, not inside BOSS
  player.mesh.position.copy(arenaCenter).add(playerOffset);
  player.mesh.userData.combatReturnPos = returnPos;

  // Debug: confirm BOSS added to scene
  const bossGroup = combatEngine.getBossGroup();
  console.log('⚔️ BOSS 战开始!', {
    arenaCenter: combatEngine.arenaCenter,
    bossPos: bossGroup?.position,
    playerPos: player.mesh.position.clone(),
  });

  // Create combat HUD and law effects
  combatHUD = new CombatHUD();
  combatHUD.show();
  lawEffects = new LawEffects(scene);
}

/** End real-time BOSS combat. */
function endRealtimeCombat(victory: boolean): void {
  if (!combatEngine) return;

  // Play sound
  if (victory) sound.playVictory();
  else sound.playDefeat();

  // Get settlement data before ending
  const settlement = combatEngine.getSettlement(victory);

  // Clean up scene effects first
  if (lawEffects) {
    lawEffects.dispose();
    lawEffects = null;
  }

  const result = combatEngine.getState();
  combatEngine.end();
  combatEngine = null;
  inCombat = false;

  // Clear combat input
  combatInput.dodge = false;
  combatInput.lawSlot1 = false;
  combatInput.lawSlot2 = false;
  combatInput.lawSlot3 = false;

  if (victory) {
    // Award rewards
    const playerState = stateManager.getPlayerState();
    const newKp = playerState.kp + settlement.kpReward;

    // Build inventory update
    const inventory = [...playerState.inventory];
    for (const mat of settlement.materials) {
      inventory.push({
        id: mat.id,
        name: mat.name,
        type: 'key' as const,
        effect: `${mat.name} ×${mat.count}`,
      });
    }

    // Add law page if rewarded
    const lawPages = [...playerState.lawPages];
    if (settlement.lawPageReward) {
      lawPages.push(settlement.lawPageReward);
    }

    stateManager.updatePlayer({
      kp: newKp,
      lingShi: playerState.lingShi + settlement.lingShiReward,
      xinLi: Math.min(100, result.playerHP + 30),
      inventory,
      lawPages,
    });

    // Mark demon as defeated
    const gameState = stateManager.getGameState();
    stateManager.updateGame({
      defeatedDemons: [...(gameState.defeatedDemons ?? []), 'forgotten_script'],
    });

    // Check for new law unlocks
    lawManager.checkUnlock(newKp);

    // Show victory panel
    if (combatHUD) {
      combatHUD.showEndPanel(true, {
        kp: settlement.kpReward,
        lingShi: settlement.lingShiReward,
        materials: settlement.materials,
        lawPageId: settlement.lawPageReward,
      });
    }

    // Restore player to pre-combat position
    const returnPos = player.mesh.userData.combatReturnPos as THREE.Vector3 | undefined;
    if (returnPos) player.mesh.position.copy(returnPos);
  } else {
    // Defeat — teleport to dorm (学舍), restore full HP
    player.mesh.position.set(93, 0, -58);

    stateManager.updatePlayer({
      xinLi: 100, // full restore
    });

    if (combatHUD) {
      combatHUD.showEndPanel(false);
    }

    // Allow re-trigger
    bossTriggered = false;
  }

  // Hide arena (smooth sink animation)
  if (combatArena) {
    combatArena.hide();
    setTimeout(() => {
      combatArena?.dispose();
      combatArena = null;
    }, 1000);
  }

  // Clean up HUD after delay
  const hudRef = combatHUD;
  setTimeout(() => {
    if (hudRef) {
      hudRef.hide();
      hudRef.destroy();
      combatHUD = null;
    }
  }, 4500);
}

/** Show boss battle confirmation dialog. */
function showBossConfirmDialog(): void {
  if (bossConfirmVisible) return;
  bossConfirmVisible = true;

  const overlay = document.createElement('div');
  overlay.id = 'boss-confirm-overlay';
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.5);z-index:250;
    display:flex;align-items:center;justify-content:center;
    font-family:'Microsoft YaHei','PingFang SC',sans-serif;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background:rgba(20,14,8,0.95);border:2px solid rgba(200,168,78,0.5);
    border-radius:16px;padding:32px 40px;min-width:360px;text-align:center;
    box-shadow:0 8px 48px rgba(0,0,0,0.6);
    animation:boss-panel-in 0.3s ease;
  `;
  dialog.innerHTML = `
    <style>
      @keyframes boss-panel-in{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
      .boss-btn{cursor:pointer;border:none;border-radius:10px;padding:12px 32px;font-size:16px;
        font-family:inherit;font-weight:bold;transition:all 0.15s;margin:0 10px;}
      .boss-btn:hover{transform:scale(1.05)}
      .boss-btn-fight{background:rgba(200,168,78,0.85);color:#1a1208}
      .boss-btn-fight:hover{background:rgba(200,168,78,1)}
      .boss-btn-leave{background:rgba(100,100,100,0.4);color:#d1d5db}
      .boss-btn-leave:hover{background:rgba(100,100,100,0.6)}
    </style>
    <div style="font-size:24px;color:#fbbf24;font-weight:bold;margin-bottom:4px;">遗忘·残卷</div>
    <div style="font-size:13px;color:#9ca3af;margin-bottom:16px;">物理系 · 图书馆之主</div>
    <div style="font-size:15px;color:#d1d5db;line-height:1.6;margin-bottom:20px;">
      一本被遗忘的古籍，书页散落。<br>它的力量正逐渐恢复……
    </div>
    <div style="display:flex;justify-content:center;gap:12px;">
      <button class="boss-btn boss-btn-fight" id="boss-btn-fight">⚔️ 论学</button>
      <button class="boss-btn boss-btn-leave" id="boss-btn-leave">离开</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const cleanup = () => {
    overlay.remove();
    bossConfirmVisible = false;
    // Keep bossPromptShown=true so prompt stays; clears when player leaves zone
    hud.setInteractionPrompt('按 E 挑战 遗忘·残卷');
  };

  dialog.querySelector('#boss-btn-fight')!.addEventListener('click', () => {
    cleanup();
    tutorialManager.notifyCombatStart();
    startRealtimeCombat();
  });

  dialog.querySelector('#boss-btn-leave')!.addEventListener('click', () => {
    cleanup();
  });
}

/* ===== GAME LOOP ===== */
const clock = new THREE.Clock();
let interactHeld = false;

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);

  if (!inCombat && !cultivationUI.isOpen) {
    player.update(dt, input, buildingBoxes);

    // Natural HP/MP regen (§6.4: +0.5 HP/s, +0.3 MP/s)
    const ps = stateManager.getPlayerState();
    if (ps.xinLi < 100 || ps.caiQi < 50) {
      stateManager.updatePlayer({
        xinLi: Math.min(100, ps.xinLi + 0.5 * dt),
        caiQi: Math.min(50, ps.caiQi + 0.3 * dt),
      });
    }

    worldManager.update(player.mesh.position.x, player.mesh.position.z, dt);

    // BOSS E key check — must happen before interactHeld is set to true
    const justPressedE = input.interact && !interactHeld;

    if (input.interact) {
      if (!interactHeld) {
        const didInteract = worldManager.tryInteract();
        if (didInteract) {
        tutorialManager.notifyInteraction();
        }
      }
      interactHeld = true;
    } else {
      interactHeld = false;
    }

    if (!bossPromptShown) {
      hud.setInteractionPrompt(worldManager.interactionPrompt);
    }

    // Update map player position
    mapPanel.updatePlayerPosition(player.mesh.position.x, player.mesh.position.z);

    // Tutorial system
    if (!tutorialManager.isComplete) {
      tutorialManager.update(player.mesh.position);
    }

    // BOSS trigger check — show prompt, wait for player to press E
    if (!bossTriggered && !bossPromptShown && checkBossTrigger()) {
      if (player.mesh.position.distanceToSquared(new THREE.Vector3(64, 0, -69)) > 4) {
        bossPromptShown = true;
        hud.setInteractionPrompt('按 E 挑战 遗忘·残卷');
      }
    }
    // Clear prompt if player leaves trigger zone
    if (bossPromptShown && !checkBossTrigger()) {
      bossPromptShown = false;
      hud.setInteractionPrompt(worldManager.interactionPrompt);
    }
    // E key in boss trigger zone → show confirm dialog
    if (justPressedE && bossPromptShown && !bossConfirmVisible) {
      showBossConfirmDialog();
    }

    // Law system update (only outside combat)
    lawManager.updateCooldowns(dt);
    lawHUD.update(dt);
  }

    // Track previous HP for damage detection
    let prevCombatHP = 100;

    // Combat engine update
    if (inCombat && combatEngine) {
      const combatState = combatEngine.update(dt, player.mesh.position, combatInput);

      // Update critical window & player speed tracking (L3)
      combatEngine.updateCriticalWindow(dt, player.mesh.position);

      // Update law cooldowns during combat
      lawManager.updateCooldowns(dt);
      lawHUD.update(dt);

      // Update law visual effects + mechanism dispatch
      if (lawEffects) {
        lawEffects.update(dt);
        if (combatState.lawJustActivated) {
          const law = combatState.lawJustActivated;
          const bossPos = combatEngine.getBossGroup()?.position ?? new THREE.Vector3(BOSS_TRIGGER.x, 0, BOSS_TRIGGER.z);
          lawEffects.play(law, bossPos, player.mesh.position);

          switch (law.effectType) {
            case 'visualInfo':
              camera.zoomToTarget(bossPos, Number(law.effectParams.zoomDistance) || 5, Number(law.effectParams.highlightDuration) || 5);
              combatHUD?.showCombatMessage(`${law.name}!`, 'hit');
              break;
            case 'prediction':
              combatHUD?.showCombatMessage(`${law.name}!`, 'hit');
              break;
            case 'aoe':
              combatHUD?.showCombatMessage(`${law.name}!`, 'hit');
              camera.shake(0.25, 0.15);
              sound.playLaw();
              break;
            case 'counter':
              combatHUD?.showCombatMessage(`${law.name}!`, 'hit');
              camera.shake(0.3, 0.2);
              sound.playLaw();
              break;
            case 'zone':
              combatHUD?.showCombatMessage(`${law.name}!`, 'hit');
              break;
            case 'critical':
              combatHUD?.showCombatMessage(`${law.name}! F=ma`, 'hit');
              break;
            case 'buff': {
              const sb = combatEngine.consumeSpeedBuff();
              if (sb) player.setSpeedMultiplier(sb.multiplier, sb.duration);
              combatHUD?.showCombatMessage(`${law.name}!`, 'hit');
              break;
            }
            default:
              combatHUD?.showCombatMessage(`${law.name}!`, 'hit');
              break;
          }
        }
      }

      // Player hit flash + invincibility
      if (combatState.playerHP < prevCombatHP) {
        player.flashHit();
        camera.shake(0.35, 0.2); // player hurt shake (subtle)
        sound.playHit();
      }
      prevCombatHP = combatState.playerHP;

      // Arena update (rise/fall animation + ring particles)
      combatArena?.update(dt);

      // Update combat HUD
    if (combatHUD) {
      combatHUD.updateBossHP(
        combatState.bossHP,
        combatState.bossMaxHP,
        combatState.bossPhaseIndex,
        combatState.weaknessActive,
      );

      // Phase transition message
      if (combatState.phaseTransitionJustHappened) {
        const phaseNum = combatState.bossPhaseIndex + 1;
        combatHUD.showCombatMessage(`第${phaseNum}阶段!`, 'phase');
        sound.playPhaseShift();
      }
    }

    // Check combat end
    if (combatState.phase === 'VICTORY' || combatState.phase === 'DEFEAT') {
      endRealtimeCombat(combatState.phase === 'VICTORY');
    }

    // Player dodge visual feedback (transparency)
    if (combatState.isDodging && !prevCombatDodging) {
      combatHUD?.showCombatMessage('闪避!', 'dodge');
      sound.playDodge();
    }
    prevCombatDodging = combatState.isDodging;

    if (combatState.isDodging) {
      player.mesh.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
          const mat = child.material as THREE.MeshToonMaterial;
          mat.transparent = true;
          mat.opacity = 0.5;
        }
      });
    } else {
      player.mesh.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
          const mat = child.material as THREE.MeshToonMaterial;
          mat.transparent = false;
          mat.opacity = 1;
        }
      });
    }

    // Weakness message (edge-triggered)
    if (combatState.weaknessActive && !prevWeaknessActive) {
      combatHUD?.showCombatMessage('破绽!', 'weakness');
    }
    prevWeaknessActive = combatState.weaknessActive;
  } else {
    prevCombatDodging = false;
    prevWeaknessActive = false;
  }

  // Camera
  camera.update(player.mesh);

  // Dynamically swap active camera (ortho ↔ perspective on Tab)
  renderPass.camera = camera.activeCamera;

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
    scene.fog = new THREE.FogExp2(0xf0d8c8, 0.0008); // warm peach fog with HDR sky
  });

  const worldGroup = await createScene();
  scene.add(worldGroup);
  buildingBoxes = (worldGroup.userData?.buildingBoxes as THREE.Box3[]) ?? [];
}

// Start immediately
animate();
boot();

console.log('🎮 三年游 3D 就绪! WASD移动, E键交互, C键法则面板, J键图卷, M键地图, Tab切换视角, 滚轮缩放, 中键/右键旋转');
console.log('🏛️ 纪念碑谷风格 — 默认正交等距视角');
console.log('⚔️ 走到图书馆附近触发 BOSS 战!');
