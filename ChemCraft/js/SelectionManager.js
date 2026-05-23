// ============================================================
// SelectionManager.js — 多选管理
// ============================================================

export class SelectionManager {
  constructor() {
    /** @type {Set<string>} */
    this.atomIds = new Set();
    /** @type {Set<string>} */
    this.bondIds = new Set();
  }

  // ==================== 单选 ====================

  selectSingle(atomId) {
    this.clear();
    this.atomIds.add(atomId);
  }

  // ==================== 多选 ====================

  /** 切换原子的选中状态 */
  toggleAtom(atomId, atomsMap, bondManager) {
    if (this.atomIds.has(atomId)) {
      this.atomIds.delete(atomId);
    } else {
      this.atomIds.add(atomId);
    }
    this._syncBondSelection(atomsMap, bondManager);
  }

  /** 矩形框选 */
  selectInRect(x1, y1, x2, y2, atomsMap, bondManager) {
    this.clear();

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (const atom of atomsMap.values()) {
      if (atom.x >= minX && atom.x <= maxX && atom.y >= minY && atom.y <= maxY) {
        this.atomIds.add(atom.id);
      }
    }
    this._syncBondSelection(atomsMap, bondManager);
  }

  _syncBondSelection(atomsMap, bondManager) {
    this.bondIds.clear();
    if (!bondManager) return;
    for (const bond of bondManager.getAllBonds()) {
      if (this.atomIds.has(bond.atom1Id) && this.atomIds.has(bond.atom2Id)) {
        this.bondIds.add(bond.id);
      }
    }
  }

  // ==================== 查询 ====================

  clear() {
    this.atomIds.clear();
    this.bondIds.clear();
  }

  hasSelection() { return this.atomIds.size > 0; }
  isAtomSelected(id) { return this.atomIds.has(id); }
  isBondSelected(id) { return this.bondIds.has(id); }
  getAtomIds() { return [...this.atomIds]; }
  getBondIds() { return [...this.bondIds]; }
  getAtomCount() { return this.atomIds.size; }

  removeAtom(id) { this.atomIds.delete(id); }
  removeBond(id) { this.bondIds.delete(id); }
}
