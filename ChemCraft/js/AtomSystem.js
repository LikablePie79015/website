// ============================================================
// AtomSystem.js — 原子/元素系统
// ============================================================

import { ELEMENTS, CANVAS } from './config.js';

let atomIdCounter = 0;

export class Atom {
  /**
   * @param {string} elementSymbol — 元素符号 (如 'C', 'H', 'O')
   * @param {number} x — 画布坐标 X
   * @param {number} y — 画布坐标 Y
   */
  constructor(elementSymbol, x, y) {
    const el = ELEMENTS[elementSymbol];
    if (!el) throw new Error(`Unknown element: ${elementSymbol}`);

    this.id        = `atom_${++atomIdCounter}`;
    this.element   = elementSymbol;
    this.x         = x;
    this.y         = y;
    this.valence   = el.valence;
    this.usedBonds = 0;
    this.bondIds   = [];          // 相连的 bond id 列表
  }

  /** 剩余可用的化学键数量 */
  getRemainingBonds() {
    return this.valence - this.usedBonds;
  }

  /** 是否可以再建立 count 个键 */
  canBond(count = 1) {
    return this.getRemainingBonds() >= count;
  }

  /** 消耗 count 个键位。成功返回 true */
  useBond(count = 1) {
    if (!this.canBond(count)) return false;
    this.usedBonds += count;
    return true;
  }

  /** 释放 count 个键位 */
  freeBond(count = 1) {
    this.usedBonds = Math.max(0, this.usedBonds - count);
  }

  addBondId(bondId) {
    if (!this.bondIds.includes(bondId)) {
      this.bondIds.push(bondId);
    }
  }

  removeBondId(bondId) {
    this.bondIds = this.bondIds.filter(id => id !== bondId);
  }

  /** 获取元素配置信息 */
  getConfig() {
    return ELEMENTS[this.element];
  }

  /** 获取 SVG 图标路径 */
  getIconPath() {
    return `./assets/elements/${this.element}.svg`;
  }

  /** 序列化 */
  toJSON() {
    return { id: this.id, element: this.element, x: this.x, y: this.y };
  }

  /** 反序列化 */
  static fromJSON(data) {
    const atom = new Atom(data.element, data.x, data.y);
    atom.id = data.id;
    return atom;
  }
}
