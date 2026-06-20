# 三年游 3D (3yy-3d) — 深中高中园知识RPG (3D 纪念碑谷风格)

> 面向在读高中生的开放世界教育 RPG。真实校园→游戏世界，知识即力量。
> 简称: **3yy-3d** | 代号: sannianyou-3d
> **这是 sannianyou (Phaser.js 2D) 的 3D 升级版，非新项目**

## Technology Stack

- **Engine**: Three.js (WebGL 3D) + TypeScript
- **Build**: Vite
- **Art Style**: 纪念碑谷 — 纯几何美学、粉彩配色、极简 BoxGeometry
- **Camera**: 双模式 — 等距正交 (默认) + Tab 切换自由透视
- **Post-Processing**: Bloom + ACES 色调映射 + FogExp2
- **CCGS**: Claude Code Game Studios 框架 (49 agents / 72 skills)
- **Proxy**: ds-proxy (:3088) → **deepseek-v4-pro** (1M context)
- **Version Control**: Git (trunk-based)

> **Note**: 不使用外部 GLB 模型，所有建筑/角色用 Three.js BoxGeometry 组合。

## Project Structure

```
sannianyou-3d/
├── src/
│   ├── scene.ts          # 纪念碑谷几何场景（建筑+路径+草坪）
│   ├── camera.ts         # 双摄像机系统
│   ├── player.ts         # WASD 玩家 + AABB 碰撞
│   ├── main.ts           # 入口 + 后处理管线 + 动画循环
│   ├── core/
│   │   ├── LawManager.ts       # 法则系统（加载/解锁/装配/冷却）
│   │   ├── StateManager.ts     # 状态管理
│   │   └── SaveManager.ts      # 存档系统
│   ├── systems/
│   │   ├── combat/CombatManager.ts  # 战斗系统（待 Phase 3 重写）
│   │   └── world/WorldManager.ts    # 建筑交互 + E 键提示
│   ├── ui/
│   │   ├── HUD.ts          # 指南针 + 交互提示
│   │   └── CombatHUD.ts    # 战斗 UI（BOSS 血条 + 浮动消息 + 战斗结算面板）
│   ├── data/               # JSON 数据文件
│   └── types/              # TypeScript 类型定义
├── docs/
│   └── DESIGN.md           # 唯一权威设计文档 FINAL v1.0
├── spike-combat.html       # 战斗原型 POC (WASD+闪避+红区预警)
└── .claude/                # CCGS 配置（从 sannianyou 继承）
```

## Design Reference

@docs/DESIGN.md — 完整游戏设计 FINAL v1.0（14 章，13KB）

## Core Design Iron Laws

1. **知识 = 法则，非数值** — F=ma = 看到 BOSS 质量 + 计算暴击窗口，不做属性加成
2. **装备纯机制** — 不加任何心力/文锋/才气数值，只改学习方式/战斗策略
3. **修炼 ≠ 战斗** — BOSS 战中不做选择题弹窗，知识融入动作机制
4. **MVP 范围** — 物理 1 科 + 3 法则 + 1 BOSS (遗忘·残卷) + 1 建筑 + 20 题

## Terminology

- 心力 (HP) / 才气 (MP) / 文锋 (ATK) / 定力 (DEF)
- 惑障 (Debuff) / 法则 (Skill) / 经卷 (Item)
- 道行 (XP) / 贯通 (Combo) / 才思 (Crit)

## Collaboration Protocol (CCGS)

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question → Options → Decision → Draft → Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

## Agent 行为强化（Qwen/DeepSeek 后端适配）

1. 每次回复末尾必须显示「当前阶段 + 下一步」
2. 写入文件前必须展示草案并请求确认
3. 使用 AskUserQuestion 获取所有决策，不自行假设
4. 定期运行 /save-session 保存进度到 active.md
5. 关键架构决策必须运行 /architecture-decision 记录 ADR

## Coding Standards

- TypeScript strict mode
- 所有公开函数需要类型标注
- 文件命名: PascalCase (组件), camelCase (工具)
- 导入顺序: Three.js → src/core → src/systems → src/ui → src/data
- 不使用 any，优先 unknown
- 几何体只用 BoxGeometry + 程序化纹理

## Context Management

@.claude/docs/context-management.md

## Current Phase

- ✅ Phase 0-6: **MVP 全部完成！** 🎉
- ✅ P0/P1 bugs fixed (2026-06-20): prevCombatHP scoping, L3 damage trigger, tutorial persistence, 才气 error UI, BossModel scale conflict, console.log cleanup, BOSS trigger coords
- ✅ P2 design completeness (2026-06-20): daily double reward, 练习册 wrong-chapter +3s, 状元笔记 time×1.5, projectile ballistics, burst 3-shot, prediction arrow tracking
- ✅ P3 code quality (2026-06-20): shared EventEmitter, removed legacy CombatResult/Skill types, dt-based time accumulation, CLAUDE.md updated
- 28 TypeScript 文件 / ~8,200 行
- Build: tsc ✅ vite ✅ (~718KB)
- Ready for playtest at http://localhost:5173
