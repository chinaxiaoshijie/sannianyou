/**
 * 装备 / 丹药 / 才艺 / BOSS 类型定义
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type EquipSlot = 'weapon' | 'armor' | 'accessory';
export type WarningType = 'fan' | 'line' | 'circle';
export type LawTier = 'L0' | 'L1' | 'L2' | 'L3';
export type EffectType = 'visualInfo' | 'prediction' | 'aoe' | 'counter' | 'zone' | 'critical' | 'buff';

/** 一条法则 */
export interface Law {
  id: string;
  name: string;
  subject: string;
  tier: LawTier;
  chapter: string;
  kpReq: number;
  cost: number;
  cooldown: number;
  effectType: EffectType;
  effectDesc: string;
  effectParams: Record<string, number | string>;
  visualDesc: string;
  formula: string;
  concept: string;
  realWorld: string;
  tacticalHint: string;
  mnemonic: string;
}

/** BOSS 攻击模式 */
export interface BossAttack {
  id: string;
  name: string;
  type: 'melee' | 'ranged' | 'aoe';
  warningType: WarningType;
  warningAngle?: number;
  warningRange?: number;
  warningRadius?: number;
  warningTime: number;
  damage: number;
  cooldown: number;
  projectileSpeed?: number;
  burstCount?: number;
  burstDelay?: number;
  description: string;
}

/** BOSS 阶段 */
export interface BossPhase {
  index: number;
  name: string;
  triggerHP: number;
  description: string;
  attacks: BossAttack[];
}

/** 掉落材料 */
export interface DropMaterial {
  id: string;
  name: string;
  count: number;
  rarity: Rarity;
}

/** 掉落表 */
export interface DropTable {
  kpReward: number;
  lingShiReward: number;
  materials: DropMaterial[];
  lawPageReward: string;
}

/** BOSS 数据 */
export interface BossData {
  id: string;
  name: string;
  element: string;
  subjectDims: string[];
  rank: number;
  xinLi: number;
  maxXinLi: number;
  attack: number;
  phases: BossPhase[];
  lawReveals?: Record<string, string>;
  dropTable: DropTable;
}

/** 装备机制 */
export interface EquipmentMechanism {
  type: 'cultivation' | 'combat' | 'team' | 'law' | 'synergy';
  trigger: string;
  effect: string;
  params: Record<string, number | boolean>;
}

/** 一件装备 */
export interface Equipment {
  id: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  kpReq: number;
  mechanism: EquipmentMechanism;
  visualDesc: string;
}

/** 玩家当前装备槽 */
export interface Equipped {
  weapon: Equipment | null;
  armor: Equipment | null;
  accessory: Equipment | null;
}

/** 一颗丹药 */
export interface Elixir {
  id: string;
  name: string;
  price: number;
  effect: 'healHP' | 'recoverMP' | 'timeBonus' | 'damageBonus';
  value: number;
  maxCarry: number;
  description: string;
}

/** 才艺（技能） */
export interface Technique {
  id: string;
  name: string;
  type: 'active' | 'passive';
  cost: number;
  cooldown: number;
  rankReq: number;
  effect: string;
  value: number;
}

/** 商铺商品 */
export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'elixir' | 'technique' | 'slot' | 'enhance';
  effect: string;
}

/** 强化等级 */
export interface Enhancement {
  level: number;
  cost: number;
  atkBonus: number;
}

/** 稀有度外观配置 */
export interface RarityConfig {
  name: string;
  color: string;
  mult: number;
}

/** 装备数据文件结构 */
export interface EquipmentData {
  scrolls: Equipment[];
  armors: Equipment[];
  accessories: Equipment[];
  rarities: Record<Rarity, RarityConfig>;
}

/** 法则数据文件结构 */
export interface LawData {
  physics: Law[];
  biology: Law[];
  chemistry: Law[];
  geography: Law[];
  math: Law[];
  english: Law[];
  chinese: Law[];
  politics: Law[];
  history: Law[];
}

/** BOSS 数据文件结构 */
export interface DemonData {
  [key: string]: BossData;
}
