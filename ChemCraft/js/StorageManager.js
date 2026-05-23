// ============================================================
// StorageManager.js — 物质存储管理
// ============================================================

const STORAGE_KEY = 'chemcraft_compounds';

export class StorageManager {
  /**
   * 保存一个化合物
   * @param {Object} data — { name, formula, atoms: [...], bonds: [...], timestamp }
   */
  static saveCompound(data) {
    const compounds = StorageManager.getAllCompounds();
    // 如果同分子式已存在，更新
    const idx = compounds.findIndex(c => c.formula === data.formula);
    if (idx >= 0) {
      compounds[idx] = { ...compounds[idx], ...data, timestamp: Date.now() };
    } else {
      compounds.push({
        ...data,
        id: `compound_${Date.now()}`,
        timestamp: Date.now(),
      });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compounds));
    return compounds;
  }

  /** 获取所有已保存的化合物 */
  static getAllCompounds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /** 按 ID 获取单个化合物 */
  static getCompound(id) {
    return StorageManager.getAllCompounds().find(c => c.id === id) || null;
  }

  /** 删除化合物 */
  static deleteCompound(id) {
    let compounds = StorageManager.getAllCompounds();
    compounds = compounds.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compounds));
    return compounds;
  }

  /** 清空所有保存 */
  static clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }
}
