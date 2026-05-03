# Port Plan: sannianyou (2D Phaser) → sannianyou-3d (Three.js)

> **Goal**: Port core gameplay (building interaction, random encounters, combat, state management, save/load) from the 2D Phaser 3 codebase to the 3D Three.js + TypeScript + Vite codebase, reusing all data files and framework-agnostic logic.

---

## 1. Files to Copy Directly (Framework-Agnostic)

These files have **zero Phaser dependencies** and can be copied as-is to the 3D project at the same relative paths under `src/`:

| Source File | Reason |
|---|---|
| `src/types/gameState.ts` | Pure TypeScript interfaces (`PlayerState`, `GameState`, `CombatState`, `BattleResult`, `SaveSlot`, `SaveData`). No imports from Phaser at all. |
| `src/types/combat.ts` | Pure type definitions (`Demon`, `Question`, `CombatResult`). No framework dependency. |
| `src/types/data.ts` | Pure types (`Subject`, `Zone`, `Building`, `GameConfig`). No framework dependency. |
| `src/types/index.ts` | Barrel re-export of the three type modules above. |
| `src/systems/combat/CombatSystem.ts` | Pure game logic — damage calculation, weakness checking, question selection, answer processing. **No Phaser import whatsoever.** Constructor takes plain `GameConfig` object. |
| `src/data/questions/history.json` | Question bank data. Already validated format: array of `Question` objects. |
| `src/data/questions/biology.json` | Question bank data. |
| `src/data/questions/geography.json` | Question bank data. |
| `src/data/questions/chemistry.json` | Question bank data. |
| `src/data/demons.json` | Demon definitions. Object keyed by demon ID, each matching the `Demon` interface. |
| `src/data/game-config.json` | Game balance config (`GameConfig`). |

**Already present in 3D project** (no action needed):
- `src/data/buildings.json` — already at `sannianyou-3d/src/data/buildings.json`
- `src/data/zones.json` — already at `sannianyou-3d/src/data/zones.json`

> :warning: The 3D project's `Buildings` JSON structure differs slightly from the 2D one — the 3D version uses a flat object keyed by building ID, while the 2D `building` type has `width`/`height` as explicit fields. Unify on the 2D format (which has richer data including `scene`, `unlock`, `buff`, `demon_level`).

---

## 2. Files That Need Significant Rewrite (Framework-Dependent)

### 2.1 `src/core/StateManager.ts` — Phaser Registry Wrapper

**Phaser dependency**: Uses `Phaser.Data.DataManager` for all get/set operations and `registry.events.emit()` for change notification.

**What to do**:
- Rewrite as a **plain TypeScript class** using a `Map<string, unknown>` or plain object for storage.
- Use a lightweight **event emitter** for change notifications (`player-changed`, `game-changed`, `combat-changed`).
- Keep all the `init()`, `updatePlayer()`, `updateGame()`, `updateCombat()`, `default*State()` methods exactly as-is — those are framework-agnostic.
- The `init(config: GameConfig)` method signature stays the same.

### 2.2 `src/core/SaveManager.ts` — IndexedDB + Phaser Registry

**Phaser dependency**: References `window.phaserGame` to access `game.registry.get('player')` and `game.registry.get('game')` during save.

**What to do**:
- The **IndexedDB and localStorage logic** (lines 88-152, the `openDB`, `saveIndexedDB`, `loadIndexedDB`, `deleteIndexedDB`, `saveLocalStorage`, `loadLocalStorage` methods) is **completely framework-agnostic** and can be reused as-is.
- Rewrite the `save(slot)` method to accept `PlayerState` and `GameState` as **parameters** or read from the new `StateManager` instead of `window.phaserGame.registry`.
- Remove the `declare global { interface Window { phaserGame? } }` block.
- All other methods (`load`, `listSlots`, `delete`, `autoSave`) remain identical.

### 2.3 `src/scenes/WorldScene.ts` — World Scene (1,878 lines)

**Phaser dependency**: Extends `Phaser.Scene`, uses `Phaser.GameObjects.Graphics` for all rendering, `Phaser.Tweens` for animations, `this.add.text()` for labels, `this.cameras` for camera management, `this.input.keyboard` for input, `this.registry` for state, `this.scene.launch/pause/resume` for scene transitions.

**What to extract (pure logic, framework-agnostic)**:

The following methods contain **pure game logic** with no rendering:

| Method | Lines | Pure Logic Description |
|---|---|---|
| `updateZone()` | 1705-1723 | Detects which zone the player is in based on coordinate comparison. Pure math. |
| `checkBuildingProximity()` | 1725-1747 | Calculates distance from player to each building, sets `nearBuilding`. Pure math + data traversal. |
| `triggerBuildingInteraction()` | 1761-1774 | Switch on `building.scene` to dispatch actions (save, training, future scenes). Pure logic dispatch. |
| `checkDemonEncounter()` | 1776-1798 | Random encounter roll (30% chance), filters by zone's demon pool, excludes defeated demons, checks safe buildings. Pure logic. |
| `onCombatComplete()` | 1842-1877 | Updates `defeatedDemons`, `kp`, `hp` in registry after combat. Pure state mutation. |

**What must be rewritten**:
- Ground, roads, buildings, decorations, trees, lamps, water — **already done** in `scene.ts`.
- Player model and movement — **already done** in `player.ts` and `main.ts`.
- Camera following — **already done** in `camera.ts`.
- Zone transition effects, particle effects, idle tweens, run tilt — need Three.js equivalents or can be dropped initially.
- `startCombat()` (lines 1800-1839) — the camera fade/flash effect is Phaser-specific; the core logic is just `scene.launch('CombatScene', { demon, onComplete })`. In 3D this becomes: show an HTML/CSS overlay or switch state.
- Input handling — already done in `main.ts` with WASD. Need to add **E key** for building interaction and wire it to `triggerBuildingInteraction()`.

**Recommended approach**: Create a new `src/systems/world/WorldManager.ts` that contains all the pure game logic methods listed above. It takes `StateManager` and data (buildings, zones, demons) as constructor dependencies. The Three.js scene just calls these methods each frame.

### 2.4 `src/scenes/CombatScene.ts` — Combat UI (1,182 lines)

**Phaser dependency**: Heavy use of `Phaser.Scene`, `Phaser.GameObjects.Graphics` (all visual elements), `Phaser.GameObjects.Text` (labels, question text, options, stats), `Phaser.GameObjects.Container`, `Phaser.Tweens` (animations), `Phaser.Time.TimerEvent` (countdown timer), `Phaser.Geom.Rectangle` (hit areas), `this.scale` (dimensions), `this.registry` (state), `this.input` (option click), particle effects.

**What to extract (pure logic)**:

| Method | Lines | Pure Logic Description |
|---|---|---|
| `init()` | 137-177 | Loads questions from registry, filters by difficulty, ensures weakness question exists. Pure data processing. |
| `handleAnswer()` | 820-979 | Core answer flow: check correct/incorrect, update combo, calculate damage, update demon HP, advance to next question or end battle. The **logic** is pure; the **visual feedback** (tweens, flashes, particles) is Phaser-specific. |
| `endBattle()` | 1061-1177 | Calculates `kpEarned` from score, builds `BattleResult`, calls `onComplete`. The **data calculation** is pure; the **panel rendering** is Phaser. |
| `onTick()` | 608-631 | Timer countdown, calls `handleAnswer(-1)` on timeout. Pure logic (though `this.time.addEvent` is Phaser-specific). |

**What must be rewritten entirely**:
- All rendering: background, demon display area, top bar, HP bars, player panel, timer circle, question card, option buttons, screen flash, combo edge glow, timer red tint, end-battle panel.
- All animations: breathing effects, particle systems, hover effects, click feedback, combo effects, victory effects.
- Input handling: option hover/click on Phaser Containers → HTML buttons or Three.js raycaster.
- Timer: `Phaser.Time.TimerEvent` → `requestAnimationFrame` delta tracking.

**Recommended approach**: Build the combat UI as an **HTML/CSS overlay** (rendered on top of the Three.js canvas). This is the standard approach for 3D games that need rich text/button UIs. Create:
- `src/systems/combat/CombatManager.ts` — orchestrates combat flow using `CombatSystem` + `StateManager`, manages question index, combo, score, demon HP, timer. Purely logic, no rendering.
- `src/ui/CombatUI.ts` — renders the HTML overlay, subscribes to `CombatManager` state changes, handles DOM events for option clicks.

### 2.5 `src/scenes/UIScene.ts` — HUD (not examined in detail, but Phaser-dependent)

Will need an HTML/CSS HUD overlay showing player HP, MP, KP, rank, zone name, minimap.

### 2.6 `src/systems/effects/ParticleEffects.ts`

All Phaser-specific. For the 3D version, particle effects can be:
- Skipped initially (cosmetic only).
- Replaced with Three.js `Points` / `Sprite` particle systems later.

---

## 3. Recommended Porting Order (7 Steps)

### Step 1: Copy Data & Types
- Copy all type files to `sannianyou-3d/src/types/`
- Copy `CombatSystem.ts` to `sannianyou-3d/src/systems/combat/`
- Copy all question JSON files and `demons.json`, `game-config.json` to `sannianyou-3d/src/data/`
- **Verification**: `tsc --noEmit` passes in the 3D project.

### Step 2: Build StateManager (no Phaser)
- Create `src/core/StateManager.ts` in the 3D project.
- Replace `Phaser.Data.DataManager` with a `Map<string, unknown>` and a simple `EventEmitter` (or `mitt` / custom pubsub).
- Keep all method signatures identical.
- Wire into `main.ts` — instantiate after scene creation, call `init(config)`.
- **Verification**: Can read/write player state, emits change events.

### Step 3: Build SaveManager (decouple from Phaser)
- Create `src/core/SaveManager.ts` in the 3D project.
- Reuse all IndexedDB/localStorage code.
- Change `save(slot)` to accept `PlayerState` and `GameState` as parameters (or take a reference to `StateManager`).
- Add save/load event listeners in `main.ts`.
- **Verification**: Can save and load game state, persists across page reloads.

### Step 4: Build WorldManager (extract pure world logic)
- Create `src/systems/world/WorldManager.ts` containing:
  - `updateZone(playerX, playerY)` → returns zone ID
  - `checkBuildingProximity(playerX, playerY)` → returns nearest building or null
  - `triggerBuildingInteraction(building)` → dispatches action based on `building.scene`
  - `checkDemonEncounter()` → returns a Demon to fight or null (random encounter roll)
  - `onCombatComplete(result, demonId)` → updates game state
- Add **E key** input to `main.ts`. On press, if near a building, call `triggerBuildingInteraction`.
- Add encounter timer to the game loop (15-second interval, like the 2D version).
- **Verification**: Player can walk near buildings, see interaction prompt, press E to interact. Random encounters trigger.

### Step 5: Build CombatManager (pure combat orchestration)
- Create `src/systems/combat/CombatManager.ts` containing:
  - `startCombat(demon)` — initializes questions, resets score/combo/timer
  - `handleAnswer(selectedIndex)` — processes answer via `CombatSystem`, updates state
  - `onTimerTick()` — countdown handler
  - `endBattle()` — calculates results, emits completion callback
- This is a pure state machine with no rendering.
- **Verification**: Can run combat logic in a unit-test-like manner (call `startCombat`, call `handleAnswer(0)`, check state transitions).

### Step 6: Build Combat UI (HTML overlay)
- Create `src/ui/CombatUI.ts` — renders combat screen as HTML/CSS over the Three.js canvas.
- Displays: demon info, player HP/MP, question text, 4 option buttons, timer, combo counter, result panel.
- Subscribes to `CombatManager` state for reactive updates.
- Handles DOM click events on option buttons → calls `CombatManager.handleAnswer(index)`.
- **Verification**: Walk near a demon, trigger combat → full combat UI appears, questions display, answering works, victory/defeat flows back to world.

### Step 7: Build HUD (HTML overlay)
- Create `src/ui/HUD.ts` — always-visible HUD showing:
  - Player rank, KP, HP, MP bars
  - Current zone name
  - Interaction prompt ("Press E to enter X")
  - Save indicator
- Subscribes to `StateManager` events for updates.
- **Verification**: Full game loop works — explore world, interact with buildings, trigger combat, save/load, state persists.

---

## 4. Key Integration Points Between 3D Rendering and Game Logic

### 4.1 Game Loop (`main.ts` → `animate()`)
```
Current (3D):
  player.update(dt, input, buildingBoxes)
  camera.update(player.mesh)
  renderer.render(scene, camera.camera)

After port:
  // 1. Player movement + collision (existing)
  player.update(dt, input, buildingBoxes)

  // 2. World logic
  worldManager.update(player.mesh.position.x, player.mesh.position.z, dt)
  //    - updateZone() → emits event if zone changed
  //    - checkBuildingProximity() → sets nearBuilding
  //    - encounterTimer += dt → checkDemonEncounter()

  // 3. Interaction (on E key press)
  if (input.interact && worldManager.nearBuilding) {
    worldManager.triggerBuildingInteraction(worldManager.nearBuilding)
  }

  // 4. If combat pending → show CombatUI
  if (combatManager.active) {
    combatManager.update(dt) // timer
  }

  // 5. Camera (existing)
  camera.update(player.mesh)

  // 6. Render (existing)
  renderer.render(scene, camera.camera)
```

### 4.2 State Flow
```
StateManager
  ├── stores: PlayerState, GameState, CombatState, GameConfig
  ├── emits:  'player-changed', 'game-changed', 'combat-changed'
  └── subscribers:
        ├── HUD (UI overlay) — updates HP/MP/KP/rank display
        ├── WorldManager — reads defeatedDemons, currentZone
        ├── CombatManager — reads/writes player HP, game.defeatedDemons, player.kp
        └── SaveManager — reads PlayerState + GameState on save
```

### 4.3 Combat Flow
```
WorldManager.checkDemonEncounter() → returns Demon
  ↓
CombatManager.startCombat(demon)
  ├── selects questions from data store
  ├── sets active=true
  └── CombatUI becomes visible
       ↓
CombatManager.handleAnswer(index) [called by CombatUI click]
  ├── CombatSystem.processAnswer()
  ├── updates demon HP, combo, score
  ├── advances question or calls endBattle()
  └── CombatUI re-renders
       ↓
CombatManager.endBattle()
  ├── builds BattleResult
  ├── calls WorldManager.onCombatComplete(result, demonId)
  │     ├── updates stateManager.game.defeatedDemons
  │     ├── updates stateManager.player.kp / hp
  │     └── emits events → HUD refreshes
  └── CombatUI hides
```

### 4.4 Coordinate System Mapping
The 2D Phaser game uses pixel coordinates (0-1280 x, 0-720 y). The 3D project uses world-space coordinates with `MAP_SCALE = 10`:
- `toWorld(px, py)` = `[px / 10, -py / 10]`
- Player spawn at 2D `(640, 680)` → 3D `(64, 0, -68)`
- All building positions, zone boundaries, and proximity thresholds must use this mapping.

The existing `scene.ts` already has `toWorld()` and uses it correctly. The new `WorldManager` should work in **3D world coordinates** (since that's what the player position from Three.js gives us).

### 4.5 Input Mapping
| 2D (Phaser) | 3D (existing) | Needed |
|---|---|---|
| Arrow keys / WASD | WASD + Arrow keys | Already done in `main.ts` `keyMap` |
| E / Space (interact) | — | Add `KeyE` / `Space` to `keyMap` as `interact: boolean` |

### 4.6 Timer Implementation
In 2D: `Phaser.Time.TimerEvent` with 1-second `delay` and `repeat` count.
In 3D: Track elapsed seconds via `requestAnimationFrame` delta accumulation:
```ts
class Timer {
  private elapsed = 0;
  private duration: number;
  
  update(dt: number): boolean {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.onTimeout();
      return true;
    }
    return false;
  }
}
```

---

## 5. File Structure After Port (Target)

```
sannianyou-3d/
├── src/
│   ├── main.ts                          # Game loop, wiring (MODIFIED)
│   ├── scene.ts                         # 3D world rendering (EXISTING)
│   ├── player.ts                        # Player 3D model + movement (EXISTING)
│   ├── camera.ts                        # Third-person camera (EXISTING)
│   ├── core/
│   │   ├── StateManager.ts              # NEW (rewritten, no Phaser)
│   │   └── SaveManager.ts               # NEW (rewritten, decoupled)
│   ├── types/
│   │   ├── gameState.ts                 # COPIED
│   │   ├── combat.ts                    # COPIED
│   │   ├── data.ts                      # COPIED
│   │   └── index.ts                     # COPIED
│   ├── systems/
│   │   ├── combat/
│   │   │   ├── CombatSystem.ts          # COPIED (pure logic)
│   │   │   └── CombatManager.ts         # NEW (orchestration)
│   │   └── world/
│   │       └── WorldManager.ts          # NEW (extracted pure logic)
│   ├── ui/
│   │   ├── CombatUI.ts                  # NEW (HTML overlay)
│   │   └── HUD.ts                       # NEW (HTML overlay)
│   └── data/
│       ├── buildings.json               # EXISTING
│       ├── zones.json                   # EXISTING
│       ├── demons.json                  # COPIED
│       ├── game-config.json             # COPIED
│       └── questions/
│           ├── history.json             # COPIED
│           ├── biology.json             # COPIED
│           ├── geography.json           # COPIED
│           └── chemistry.json           # COPIED
└── docs/
    └── port-plan.md                     # THIS FILE
```

---

## 6. Risk Notes

1. **Event Emitter**: The 2D game uses `Phaser.Data.DataManager.events` for pubsub. The 3D project needs a replacement. Options: Node.js `EventEmitter` (polyfill needed in browser), `mitt` (tiny, 200 bytes), or a custom 30-line implementation. Recommend a minimal custom solution to avoid adding dependencies.

2. **Combat UI Complexity**: The 2D CombatScene is 1,182 lines of rich visual effects. The ported CombatUI should start with **functional minimum** (question text + 4 buttons + timer + HP bars) and add visual polish later.

3. **Modal Flow**: The 2D game uses `scene.pause()/scene.launch()` to pause world and overlay combat. In 3D, simply show/hide an HTML overlay and stop processing world input while combat is active (`combatManager.active === true`).

4. **Data Format Consistency**: The 3D `buildings.json` uses a flat object `{ [id]: building }` while the 2D types expect `Building` with `width`/`height` as top-level fields. The 2D `WorldScene.ts` code casts `building as Building & Record<string, unknown>` and reads `.width`/`.height` from the object. The 3D `scene.ts` hardcodes building sizes per ID. These need to be reconciled — either update buildings.json to include `width`/`height` fields, or keep the per-ID size map approach in both scene.ts and the new WorldManager.
