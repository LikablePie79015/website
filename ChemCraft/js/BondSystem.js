// ============================================================
// BondSystem.js — 化学键管理系统
// ============================================================

import { BOND_TYPE } from './config.js';

let bondIdCounter = 0;

/** 单条化学键 */
export class Bond {
  /**
   * @param {Atom} atom1
   * @param {Atom} atom2
   * @param {number} type — BOND_TYPE.SINGLE / DOUBLE / TRIPLE
   */
  constructor(atom1Id, atom2Id, type = BOND_TYPE.SINGLE) {
    this.id      = `bond_${++bondIdCounter}`;
    this.atom1Id = atom1Id;
    this.atom2Id = atom2Id;
    this.type    = type;          // 1/2/3
  }

  getBondCount() { return this.type; }

  upgradeType() {
    if (this.type < BOND_TYPE.TRIPLE) { this.type++; return true; }
    return false;
  }

  downgradeType() {
    if (this.type > BOND_TYPE.SINGLE) { this.type--; return true; }
    return false;
  }

  /** 循环切换：1→2→3→1 */
  cycleType() {
    this.type = (this.type % BOND_TYPE.TRIPLE) + 1;
  }

  toJSON() {
    return { id: this.id, atom1Id: this.atom1Id, atom2Id: this.atom2Id, type: this.type };
  }

  static fromJSON(data) {
    return new Bond(data.atom1Id, data.atom2Id, data.type);
  }
}

/** 键管理器 — 负责建键、删键、升级、查询 */
export class BondManager {
  constructor() {
    /** @type {Map<string, Bond>} */
    this.bonds = new Map();
  }

  // ---------- 查询 ----------

  /** 获取两个原子之间已有的键（如不存在返回 null） */
  getBondBetween(atomId1, atomId2) {
    for (const bond of this.bonds.values()) {
      if ((bond.atom1Id === atomId1 && bond.atom2Id === atomId2) ||
          (bond.atom1Id === atomId2 && bond.atom2Id === atomId1)) {
        return bond;
      }
    }
    return null;
  }

  /** 获取某个原子的所有键 */
  getBondsForAtom(atomId) {
    const result = [];
    for (const bond of this.bonds.values()) {
      if (bond.atom1Id === atomId || bond.atom2Id === atomId) {
        result.push(bond);
      }
    }
    return result;
  }

  getAllBonds() {
    return Array.from(this.bonds.values());
  }

  /** 判断是否可以建立/升级键 */
  canCreateBond(atom1, atom2, type = BOND_TYPE.SINGLE) {
    const existing = this.getBondBetween(atom1.id, atom2.id);
    if (existing) {
      const wantedTotal = existing.type + type;
      if (wantedTotal > BOND_TYPE.TRIPLE) return false;
      return atom1.canBond(type) && atom2.canBond(type);
    }
    return atom1.canBond(type) && atom2.canBond(type);
  }

  // ---------- 操作 ----------

  /** 在两个原子间创建/升级键。成功返回 Bond，失败返回 null */
  createBond(atom1, atom2, type = BOND_TYPE.SINGLE) {
    const existing = this.getBondBetween(atom1.id, atom2.id);
    if (existing) {
      // 升级已有键
      if (existing.type + type <= BOND_TYPE.TRIPLE && atom1.canBond(type) && atom2.canBond(type)) {
        atom1.useBond(type);
        atom2.useBond(type);
        existing.type += type;
        return existing;
      }
      return null;
    }

    if (!atom1.canBond(type) || !atom2.canBond(type)) return null;
    if (!atom1.useBond(type) || !atom2.useBond(type)) return null;

    const bond = new Bond(atom1.id, atom2.id, type);
    atom1.addBondId(bond.id);
    atom2.addBondId(bond.id);
    this.bonds.set(bond.id, bond);
    return bond;
  }

  /** 删除一条键，同时更新两端原子的键计数 */
  removeBond(bondId, atom1, atom2) {
    const bond = this.bonds.get(bondId);
    if (!bond) return false;

    const count = bond.type;
    if (atom1) atom1.freeBond(count);
    atom1 && atom1.removeBondId(bondId);
    if (atom2) atom2.freeBond(count);
    atom2 && atom2.removeBondId(bondId);

    this.bonds.delete(bondId);
    return true;
  }

  /** 移除某个原子的所有键（删除原子时调用） */
  removeAllBondsForAtom(atomId, atomsMap) {
    const toRemove = this.getBondsForAtom(atomId);
    for (const bond of toRemove) {
      const otherId = bond.atom1Id === atomId ? bond.atom2Id : bond.atom1Id;
      const otherAtom = atomsMap.get(otherId);
      if (otherAtom) {
        otherAtom.freeBond(bond.type);
        otherAtom.removeBondId(bond.id);
      }
      this.bonds.delete(bond.id);
    }
    return toRemove.length;
  }

  /** 循环切换键类型（1→2→3→1），自动处理化合价 */
  cycleBondType(bondId, atom1, atom2) {
    const bond = this.bonds.get(bondId);
    if (!bond) return false;

    const current  = bond.type;
    const next     = (current % BOND_TYPE.TRIPLE) + 1;
    const diff     = next - current;

    if (diff > 0) {
      // 需要更多化合价
      if (!atom1.canBond(diff) || !atom2.canBond(diff)) return false;
      atom1.useBond(diff);
      atom2.useBond(diff);
    } else {
      // 释放化合价
      atom1.freeBond(-diff);
      atom2.freeBond(-diff);
    }
    bond.type = next;
    return true;
  }

  /** 序列化 */
  toJSON() {
    return this.getAllBonds().map(b => b.toJSON());
  }

  /** 反序列化 */
  static fromJSON(data) {
    const bm = new BondManager();
    for (const d of data) {
      const bond = Bond.fromJSON(d);
      bm.bonds.set(bond.id, bond);
    }
    return bm;
  }
}
