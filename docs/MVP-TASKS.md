# 三年游 · MVP 开发任务拆解 v2.0

> 基于 DESIGN.md FINAL v1.0 + 三审修正
> 总工期：28 天（含 2 天缓冲）

---

## 评审修正清单

| 修正 | 来源 | 旧值 | 新值 |
|------|------|------|------|
| Phase 3 工时 | GLM+DouBao | 7 天 | 12 天（含 2 天 POC） |
| 总工期 | 三审共识 | 20 天 | 28 天 |
| 题库规模 | kimi | 50 题 | 20 题（L0-L1 核心） |
| 法则数量 | GLM | 7 条 | 3 条 MVP（L0+2×L1），4 条 P2 |
| P4 引导 | kimi | 依赖 P2+P3 | 拆为 P4a（依赖 P1+P2）+ P4b（依赖 P3） |
| 场景建筑 | kimi | 遗漏 | 新增 P0.5（1 天） |
| 每 Phase 自测 | DouBao | 无 | 每 Phase +0.5 天自测 |
| P6 调试 | DouBao | 3 天 | 4 天（含心流验证测试） |

---

## 任务总览

| Phase | 内容 | 估时 | 依赖 |
|-------|------|------|------|
| 0 | 数据层重写 | 2 天 | 无 |
| 0.5 | 场景建筑补完 | 1 天 | 无 |
| 1 | 法则系统 | 4 天 | P0 |
| 2 | 修炼系统改造 | 2.5 天 | P0+P0.5 |
| ⚡ | **战斗 Spike（Day 3）** | **1 天** | **P0+P0.5** |
| 3 | 实时 BOSS 战 | 12 天 | P1+Spike |
| 4a | 引导前半（入校→法则装配） | 1.5 天 | P1+P2 |
| 4b | 引导后半（BOSS 方向→战斗） | 0.5 天 | P3 |
| 5 | 装备机制 | 1.5 天 | P0+P2+P3 |
| 6 | 调试 + 心流验证 | 4 天 | P3+P4 |
| **合计** | | **28 天** | |

---

## Phase 0：数据层重写（2 天）

### Task 0.1：重写 laws.json（1 天）
- 文件：`src/data/laws.json`
- 内容：3 条 MVP 物理法则 + 4 条 P2 占位
  - L0 质点聚焦、L1 匀变预判、L1 自由落体（MVP）
  - L2 弹力反震、L2 摩擦场、L3 精确打击、L3 惯性闪避（P2）
- 每条含：id / name / subject / tier / chapter / kpReq / cost / cooldown / effectType / effectParams
- 验收：JSON 合法，TypeScript 类型匹配

### Task 0.2：重写 demons.json（0.5 天）
- 文件：`src/data/demons.json`
- 内容：遗忘·残卷 BOSS 数据（1 阶段 MVP，2-3 阶段结构预留）
- 新增字段：phases / attacks / warning / subjectDims
- 验收：JSON 合法，BOSS 数据结构完整

### Task 0.3：重写 equipment.json（0.5 天）
- 文件：`src/data/equipment.json`
- 内容：机制型装备。3 件 MVP。
- 新增 mechanism 字段，移除 atk/hp/def/mp 数值字段
- 验收：JSON 合法，无任何数值属性

---

## Phase 0.5：场景建筑补完（1 天）🆕

### Task 0.5.1：MVP 建筑几何体（1 天）
- 文件：`src/scene.ts`（扩展现有 createScene）
- 新增几何体（BoxGeometry 拼接）：
  - 校门口大门（门柱 + 横梁）
  - 实验室（小型建筑 + E 键交互检测区）
  - 学舍（小型建筑 + 重生点标记）
  - 状元桥（BOSS 触发区域 + 地面发光区）
- 验收：4 个建筑在场景中可见，E 键交互区可用
- 注意：如果这些建筑已在现有 buildings.json 中存在且场景已渲染，则此 Phase 跳过（改为 0 天）

---

## Phase 1：法则系统（4 天）

### Task 1.1：LawManager 核心逻辑（2 天）
- 文件：`src/core/LawManager.ts`
- 功能：loadLaws / checkUnlock / equipLaw / getEquipped / activateLaw / updateCooldowns
- 集成 StateManager
- 自测 0.5 天

### Task 1.2：法则 UI（1.5 天）
- 修改：`src/ui/HUD.ts`
- 新增：3 法则槽位图标（左下角）+ 冷却环形倒计时 + 才气条（替代 MP 条）

### Task 1.3：法则装配面板（0.5 天）
- 文件：`src/ui/LawPanel.ts`
- 简化版：下拉选择装配，非拖拽

---

## ⚡ 战斗 Spike — Day 3（1 天）🆕

**目的：** 验证 Three.js 实时动作战斗的可行性。不通过则停止，不浪费后续 12 天。

### Spike 任务
- 场景：一个 BoxGeometry "BOSS" + 一个 CapsuleGeometry "玩家"
- WASD 移动 + 空格闪避（0.2s 无敌帧）+ 红色扇形预警
- 碰撞检测：hitbox vs 预警区域
- 屏幕打印：命中/闪避
- 不接入 laws.json / StateManager / HUD

### 通过标准
- 闪避手感流畅（能清晰区分"躲开"和"没躲开"）
- 预警几何体可读性好（在暖桃色 fog 中对比度足够）
- 如果 1 天搞不定 → Phase 3 的 12 天估时作废 → 重新评估技术方案

---

## Phase 2：修炼系统改造（2.5 天）

### Task 2.1：物理题库（1 天）🔄 修订
- 文件：`src/data/questions/physics.json`
- 数量：20 题（旧值 50）
- 覆盖：质点模型 + 匀变速 + 弹力 + 摩擦（L0-L1 核心）
- 格式：id / subject / chapter / law / difficulty / question / options[4] / correctIndex / explanation
- L2-L3 题目留到 P2

### Task 2.2：实验室交互 + 修炼 UI（1 天）
- 修改：`src/main.ts` — E 键检测实验室建筑 → 打开修炼 UI
- 文件：`src/ui/CultivationUI.ts`
- 功能：题目显示 + 4 选项 + 倒计时 + 正误反馈 + 道行结算 + 每日双倍标记

### Task 2.3：KP 结算集成（0.5 天）
- 修改 StateManager：答对→道行+5 + 灵石+3
- LawManager.checkUnlock() 在道行变化后触发

---

## Phase 3：实时 BOSS 战（12 天）🔄 修订

### Task 3.1：BOSS 模型（1.5 天）
- 文件：`src/bosses/BossModel.ts`
- 几何体拼接「遗忘·残卷」— 主体 BoxGeometry 叠加 + 核心 SphereGeometry + 纸屑粒子
- 先用简单形状，好看是 P2 的事

### Task 3.2：BOSS AI + 攻击模式（4 天）🔄 修订
- 文件：`src/bosses/BossAI.ts`
- 1 阶段 MVP（心力 200），2-3 阶段结构预留
- 2 种攻击模式，随机循环（避免连续重复）
- 攻击预警生成（红色几何体 0.8-1.2s）
- 受击反馈 + 攻击打断

### Task 3.3：实时战斗引擎（4 天）🔄 修订
- 文件：`src/systems/combat/CombatEngine.ts`（重写 CombatManager）
- 战斗进入/退出 + WASD + 空格闪避 + 1 键法则激活
- 碰撞检测（玩家 hitbox vs BOSS 预警 + BOSS hitbox vs 法则投射）
- 伤害计算 + 心力/才气管 + 打击反馈（屏幕震动/粒子/心力闪烁）

### Task 3.4：战斗 HUD（1 天）
- 修改：`src/ui/CombatUI.ts`
- BOSS 心力条 + 玩家心力/才气条 + 3 法则冷却环 + 阶段提示

### Task 3.5：胜利/失败流程（1 天）
- 胜利→BOSS 碎裂→掉落展示→称号提示
- 失败→暗红→力竭→回学舍→心力恢复→保留道行

### Task 3.6：自测（0.5 天）🆕
- 完整 BOSS 战走通，修单系统 bug

---

## Phase 4a：引导前半（1.5 天）🔄 拆分

依赖 P1+P2，不等 P3。

### Task 4.1a：入校→法则装配（1.5 天）
- 文件：`src/systems/OnboardingManager.ts`
- 3 步引导（精简版）：
  1. WASD 移动提示（半透明文字，3 秒自动消失）
  2. 发光箭头指向实验室 → E 键交互提示
  3. 答对第一题 → C 键面板提示 → 法则装配高亮
- localStorage 标记已完成
- 砍掉：入场俯冲动画、灵光特效、9 步完整序列

## Phase 4b：引导后半（0.5 天）🔄 拆分

依赖 P3。

### Task 4.1b：BOSS 方向引导（0.5 天）
- 发光箭头指向状元桥
- BOSS 区域提示「按 E 挑战」

---

## Phase 5：装备机制（1.5 天）🔄 修订

### Task 5.1：EquipmentManager + 集成（1.5 天）
- 文件：`src/core/EquipmentManager.ts`
- 3 件装备效果：
  - 练习册 → 修炼答错记录（集成 CultivationUI）
  - 错题集 → BOSS 失败次数追踪（集成 CombatEngine）
  - 状元笔记 → KP 80 解锁（P2 实现效果）
- 自测 0.5 天

---

## Phase 6：调试 + 心流验证（4 天）🔄 修订

### Task 6.1：数值平衡（1 天）
- BOSS 心力 200，攻击力 10-15
- 法则伤害 20-50
- 闪避冷却 1.5s
- 目标：熟练 5-8 分钟通关，新手 10-15 分钟

### Task 6.2：手感打磨（1 天）
- 无敌帧/抬手/预警时间调整
- 打击反馈强度（屏幕震动幅度、粒子密度）

### Task 6.3：心流验证测试（1 天）🆕
- 找 2-3 人测试完整流程
- 观察：闪避是否流畅？法则释放有满足感吗？预警能看懂吗？
- 记录断点 + 困惑点

### Task 6.4：Bug 修复（1 天）
- 跨系统集成 bug（LawManager×CombatEngine×Onboarding×Equipment）
- 目标：无阻断性 bug，核心循环完整可玩

---

## 风险标注

| 风险 | 等级 | 缓解 |
|------|------|------|
| Phase 3 实时战斗工作量被低估 | 🔴 高 | Day 3 Spike 验证。Spike 不通过→停止。通过但延期→砍 BOSS 阶段 |
| 战斗手感达不到预期 | 🔴 高 | Spike 最小化验证。P6 安排专门手感打磨 + 心流测试 |
| 现有代码 80% 需重写 | 🟡 中 | Phase 0+0.5 先建数据地基。旧 CombatManager 保留做参考 |
| 20 道物理题编写耗时 | 🟡 中 | Phase 2 已从 0.5 天调整为 1 天 |
| 引导边界情况多 | 🟢 低 | 砍到 3 步精简引导，P2 补完整引导 |
| 纪念碑谷审美疲劳 | 🟢 低 | 1 阶段 BOSS 战约 5-8 分钟，疲劳风险低。P2 再验证长时间战斗 |

---

## 如果只剩 10 天的应急预案

| 天数 | 内容 |
|------|------|
| Day 1-2 | P0 数据层全做 |
| Day 3 | 战斗 Spike（验证手感） |
| Day 4-9 | 极简 BOSS 战：1 阶段模型 + WASD + 闪避 + 1 法则 + 碰撞 + 胜负 |
| Day 10 | 跑通 + 修阻断 bug + 录 demo |

砍掉：修炼 UI、新手引导、装备系统、法则装配面板。KP 值硬编码，法则解锁写死，开局直传 BOSS。

---

*文档版本：MVP-TASKS v2.0 · 2026-05-05 · 三审修正版*
