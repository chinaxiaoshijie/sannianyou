# Law UI Implementation Plan — Phase 1 完成

## 目标

实现法则系统 UI 层：**冷却环 HUD** + **装配面板 (C 键)**，接入 LawManager。

## 当前状态

- `LawManager` (155 行) 已实现 — load/unlock/equip/activate/cooldown 全部就绪
- `HUD` (307 行) 已有心力/才气条、指南针、交互提示
- `main.ts` 已导入 HUD, StateManager, CombatManager
- LawManager **尚未被 main.ts 导入**

## 任务分解

### Task 1: LawHUD — 冷却环显示 (新文件)

**文件**: `src/ui/LawHUD.ts`

功能:
- 底部居中显示 3 个法则槽位 (对应 LawManager 的 slots[0-2])
- 每个槽位: 圆形冷却环 + 法则名称
- 冷却环动画: 彩色圆环从 360° → 0° 表示 cooldownRemaining → 0
- 冷却中: 灰色圆环 + 半透明遮罩
- 就绪时: 高亮脉冲动画
- 空槽位: 虚线空心圆 + "空" 文字

设计参数:
- 环直径: 48px
- 环线宽: 4px
- 间距: 16px
- 颜色: 就绪 #4A90D9, 激活中 #F59E0B, 冷却中 #6B7280
- 字体: 12px, 法则名在环下方

实现方式:
- HTML Canvas 元素 (性能好，平滑动画)
- 或纯 CSS (conic-gradient + animation)
- 推荐 Canvas: 更精确的冷却角度控制

API:
```ts
class LawHUD {
  constructor(lawManager: LawManager)
  update(dt: number): void  // 每帧调用
  destroy(): void
}
```

### Task 2: LawPanel — 装配面板 (新文件)

**文件**: `src/ui/LawPanel.ts`

功能:
- 按 C 键打开/关闭
- 全屏半透明遮罩 + 居中新拟态面板
- 顶部: 3 个装备槽 (与 LawHUD 相同的圆形槽位)
- 装备槽可点击卸下已装备法则
- 下方: 已解锁法则列表 (滚动)
- 每条法则卡片显示: 名称 / 层级 / 冷却 / 消耗 / 效果描述
- 点击未装备法则 → 自动放入第一个空槽
- 拖拽支持 (可选, 后期)
- ESC 关闭

设计:
- 纪念碑谷风格: 粉彩配色 (#FDE8E0 底色, #E8D5C4 卡片)
- 几何圆角卡片, 无阴影用 border
- 层级标签: L0 灰 / L1 绿 / L2 蓝 / L3 金
- 已装备法则高亮边框 #4A90D9

API:
```ts
class LawPanel {
  constructor(lawManager: LawManager)
  get isOpen(): boolean
  toggle(): void
  open(): void
  close(): void
  destroy(): void
}
```

### Task 3: 主循环集成 (修改 main.ts)

修改内容:
1. 导入 LawManager, LawHUD, LawPanel
2. 创建 LawManager 实例 (注入 StateManager)
3. 创建 LawHUD 实例
4. 创建 LawPanel 实例
5. 在 animate() 中调用 `lawHUD.update(dt)` 和 `lawManager.updateCooldowns(dt)`
6. 绑定 C 键 → `lawPanel.toggle()`
7. 绑定 ESC 键 → `lawPanel.close()` (当面板打开时)

## 依赖关系

```
LawManager (已有) ──┬── LawHUD (Task 1)
                    ├── LawPanel (Task 2)
                    └── main.ts 集成 (Task 3)
```

Task 1 和 Task 2 可并行开发 (都只依赖 LawManager 接口)。
Task 3 依赖 Task 1 + Task 2。

## 验证标准

- [ ] C 键打开装配面板, ESC 关闭
- [ ] 面板显示所有 7 条物理法则
- [ ] 点击法则卡片 → 装入第一个空槽
- [ ] 点击已装备槽 → 卸下法则
- [ ] HUD 底部显示 3 个冷却环
- [ ] 冷却环动画流畅 (Canvas 60fps)
- [ ] 法则激活后冷却环倒计时正确
- [ ] 冷却中环灰色 + 遮罩, 就绪后高亮
- [ ] 空槽位显示虚线空心圆
- [ ] Vite build 通过
- [ ] TypeScript 无类型错误

## 技术注意

- LawManager 使用 EventEmitter (来自 StateManager.events) — LawHUD/Panel 监听 'laws-changed' 事件
- 如果 LawManager 还没有 events，需要给它添加 EventEmitter
- Canvas 2D 需要 clearRect + 重绘每帧
- 面板需要 `pointer-events: none` 遮罩 + `pointer-events: all` 面板本体
