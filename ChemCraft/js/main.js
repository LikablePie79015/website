// ============================================================
// main.js — 化学合成游戏主应用
// ============================================================

import { ELEMENTS, DEFAULT_ELEMENTS, BOND_TYPE } from './config.js';
import { Atom } from './AtomSystem.js';
import { BondManager } from './BondSystem.js';
import { FormulaGenerator, FormulaRenderer } from './FormulaGenerator.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { DragDropManager } from './DragDrop.js';
import { StorageManager } from './StorageManager.js';
import { Camera } from './Camera.js';
import { SelectionManager } from './SelectionManager.js';

class ChemCraftApp {
  constructor() {
    /** @type {Map<string, Atom>} */
    this.atomsMap = new Map();

    /** @type {BondManager} */
    this.bondManager = new BondManager();

    /** @type {CanvasRenderer} */
    this.renderer = null;

    /** @type {DragDropManager} */
    this.dragDrop = null;

    /** @type {Camera} */
    this.camera = null;

    /** @type {SelectionManager} */
    this.selection = null;
  }

  init() {
    // 获取 DOM 引用
    this.svgEl        = document.getElementById('canvas-svg');
    this.sidebarEl    = document.getElementById('basic-elements');
    this.discoveredEl = document.getElementById('discovered-substances');
    this.formulaDisplayEl = document.getElementById('current-formula');
    this.btnSave      = document.getElementById('btn-save');
    this.btnClear     = document.getElementById('btn-clear');

    // 初始化渲染器
    this.renderer = new CanvasRenderer(this.svgEl);

    // 初始化相机和多选管理器
    this.camera    = new Camera();
    this.selection = new SelectionManager();

    // 初始化拖拽
    this.dragDrop = new DragDropManager(this.svgEl, this.renderer, this.camera, this.selection, {
      getAtomsMap:     () => this.atomsMap,
      getBondManager:  () => this.bondManager,
      onAtomDrop:      (el, x, y) => this._addAtom(el, x, y),
      onAtomMove:      (id, x, y) => this._moveAtom(id, x, y),
      onAtomMoveStart: (id) => {},
      onAtomMoveEnd:   (id) => this._onAtomMoveEnd(id),
      onBondDragEnd:   (targetId) => this._createBondTo(targetId),
      onBondClick:     (bondId) => this._onBondClick(bondId),
      onAtomRightClick:(atomId) => this._removeAtom(atomId),
      onBondRightClick:(bondId) => this._removeBond(bondId),

      // 多选回调
      onMultiMoveStart: () => {},
      onMultiMove:      (atomId, x, y) => this._moveAtom(atomId, x, y),
      onMultiMoveEnd:   () => this._onMultiMoveEnd(),
      onMultiDelete:    () => this._deleteSelected(),
    });

    // 渲染侧栏基础元素
    this._renderBasicElements();

    // 渲染已发现物质
    this._renderDiscovered();

    // 按钮事件
    this.btnSave.addEventListener('click', () => this._saveCompound());
    this.btnClear.addEventListener('click', () => this._clearCanvas());

    // 监听画布空区域双击 → 取消选中
    this.svgEl.addEventListener('dblclick', (e) => {
      if (e.target === this.svgEl || e.target.id === 'atoms-layer' || e.target.id === 'bonds-layer' || e.target.id === 'camera-group') {
        this.renderer.clearHighlight();
        this.selection.clear();
        this.renderer.clearAllMultiHighlights();
      }
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selection.hasSelection()) {
          this._deleteSelected();
          return;
        }
        if (this.renderer.selectedAtomId) {
          this._removeAtom(this.renderer.selectedAtomId);
        }
      }
      if (e.key === 'Escape') {
        this.renderer.clearHighlight();
        this.selection.clear();
        this.renderer.clearAllMultiHighlights();
      }
    });

    this._updateFormulaDisplay();

    console.log('ChemCraft initialized. 从左侧拖动元素到画布开始合成！');
  }

  // ==================== 原子操作 ====================

  _addAtom(elementSymbol, x, y) {
    const atom = new Atom(elementSymbol, x, y);
    this.atomsMap.set(atom.id, atom);
    this.renderer.renderAtom(atom);
    this._updateFormulaDisplay();
  }

  _moveAtom(atomId, x, y) {
    const atom = this.atomsMap.get(atomId);
    if (!atom) return;
    atom.x = x;
    atom.y = y;
    this.renderer.updateAtomPosition(atom);
    this.renderer.updateBondsForAtom(atomId, this.atomsMap, this.bondManager);
  }

  _onAtomMoveEnd(atomId) {
    this.renderer.refreshAllBonds(this.atomsMap, this.bondManager);
  }

  _removeAtom(atomId) {
    const atom = this.atomsMap.get(atomId);
    if (!atom) return;

    // 更新每个关联键的另一端原子
    const bonds = this.bondManager.getBondsForAtom(atomId);
    for (const bond of bonds) {
      const otherId = bond.atom1Id === atomId ? bond.atom2Id : bond.atom1Id;
      const otherAtom = this.atomsMap.get(otherId);
      if (otherAtom) {
        otherAtom.freeBond(bond.type);
        otherAtom.removeBondId(bond.id);
      }
      this.bondManager.bonds.delete(bond.id);
      this.renderer.removeBond(bond.id);
    }

    this.atomsMap.delete(atomId);
    this.renderer.removeAtom(atomId);

    // 刷新所有剩余原子的化合价显示
    for (const a of this.atomsMap.values()) {
      this.renderer.refreshAtom(a);
    }
    this._updateFormulaDisplay();
  }

  // ==================== 键操作 ====================

  _createBondTo(targetAtomId) {
    if (!this.renderer.selectedAtomId) return;
    if (this.renderer.selectedAtomId === targetAtomId) {
      this.renderer.clearHighlight();
      return;
    }

    const a1 = this.atomsMap.get(this.renderer.selectedAtomId);
    const a2 = this.atomsMap.get(targetAtomId);
    if (!a1 || !a2) return;

    // 检查是否已存在键：是则升级，否则新建
    const existing = this.bondManager.getBondBetween(a1.id, a2.id);
    if (existing) {
      // 升级键
      if (this.bondManager.cycleBondType(existing.id, a1, a2)) {
        this.renderer.updateBond(existing, a1, a2);
        this.renderer.refreshAtom(a1);
        this.renderer.refreshAtom(a2);
        this.renderer.clearHighlight();
        this._updateFormulaDisplay();
      } else {
        this.renderer.clearHighlight();
      }
      return;
    }

    // 新建单键
    const bond = this.bondManager.createBond(a1, a2, BOND_TYPE.SINGLE);
    if (bond) {
      this.renderer.renderBond(bond, a1, a2);
      this.renderer.refreshAtom(a1);
      this.renderer.refreshAtom(a2);
      this._updateFormulaDisplay();
    }
    this.renderer.clearHighlight();
  }

  _onBondClick(bondId) {
    const bond = this.bondManager.bonds.get(bondId);
    if (!bond) return;
    const a1 = this.atomsMap.get(bond.atom1Id);
    const a2 = this.atomsMap.get(bond.atom2Id);
    if (!a1 || !a2) return;

    if (this.bondManager.cycleBondType(bondId, a1, a2)) {
      this.renderer.updateBond(bond, a1, a2);
      this.renderer.refreshAtom(a1);
      this.renderer.refreshAtom(a2);
      this._updateFormulaDisplay();
    }
  }

  _removeBond(bondId) {
    const bond = this.bondManager.bonds.get(bondId);
    if (!bond) return;
    const a1 = this.atomsMap.get(bond.atom1Id);
    const a2 = this.atomsMap.get(bond.atom2Id);
    this.bondManager.removeBond(bondId, a1, a2);
    this.renderer.removeBond(bondId);
    if (a1) this.renderer.refreshAtom(a1);
    if (a2) this.renderer.refreshAtom(a2);
    this._updateFormulaDisplay();
  }

  // ==================== 分子式显示 ====================

  _updateFormulaDisplay() {
    if (this.atomsMap.size === 0) {
      this.formulaDisplayEl.innerHTML = '<span class="formula-empty">画布为空 — 从左侧拖动元素开始合成</span>';
      return;
    }

    const components = FormulaGenerator.generateAll(this.atomsMap, this.bondManager);

    // 清空并用 DOM 方式重建
    this.formulaDisplayEl.innerHTML = '';

    if (components.length === 1) {
      const label = document.createElement('span');
      label.className = 'formula-label';
      label.textContent = '当前分子式：';
      this.formulaDisplayEl.appendChild(label);
    } else {
      const label = document.createElement('span');
      label.className = 'formula-label';
      label.textContent = `${components.length} 个分子：`;
      this.formulaDisplayEl.appendChild(label);
    }

    for (const comp of components) {
      const badge = document.createElement('span');
      badge.className = 'formula-badge';
      badge.appendChild(FormulaRenderer.renderToDOM(comp.formula));
      this.formulaDisplayEl.appendChild(badge);
    }
  }

  // ==================== 侧栏渲染 ====================

  _renderBasicElements() {
    this.sidebarEl.innerHTML = '';
    for (const sym of DEFAULT_ELEMENTS) {
      const cfg = ELEMENTS[sym];
      if (!cfg) continue;

      const item = document.createElement('div');
      item.className = 'element-item';
      item.setAttribute('data-element', sym);
      item.title = `${cfg.name} (${sym}) — 化合价: ${cfg.valence}`;
      item.draggable = false; // 使用自定义拖拽

      const icon = document.createElement('div');
      icon.className = 'element-icon';
      const img = document.createElement('img');
      img.src = `./assets/elements/${sym}.svg`;
      img.alt = sym;
      img.width = 48;
      img.height = 48;
      icon.appendChild(img);

      const label = document.createElement('div');
      label.className = 'element-label';
      label.textContent = sym;

      const info = document.createElement('div');
      info.className = 'element-info';
      info.textContent = cfg.name;

      item.appendChild(icon);
      item.appendChild(label);
      item.appendChild(info);

      // 拖拽事件：从侧栏拖入画布
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.dragDrop.startSidebarDrag(sym, e);
      });
      item.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        this.dragDrop.startSidebarDrag(sym, { clientX: touch.clientX, clientY: touch.clientY });
      });

      this.sidebarEl.appendChild(item);
    }
  }

  _renderDiscovered() {
    const compounds = StorageManager.getAllCompounds();
    this.discoveredEl.innerHTML = '';

    if (compounds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'discovered-empty';
      empty.textContent = '尚未发现新物质';
      this.discoveredEl.appendChild(empty);
      return;
    }

    for (const comp of compounds) {
      const item = document.createElement('div');
      item.className = 'discovered-item';
      item.title = comp.name || comp.formula;

      const formulaDiv = document.createElement('div');
      formulaDiv.className = 'discovered-formula';
      formulaDiv.appendChild(FormulaRenderer.renderToDOM(comp.formula));

      const actions = document.createElement('div');
      actions.className = 'discovered-actions';

      // 加载按钮
      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn-sm';
      loadBtn.textContent = '加载';
      loadBtn.title = '加载到画布';
      loadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._loadCompound(comp);
      });

      // 删除按钮
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-sm btn-danger';
      delBtn.textContent = '✕';
      delBtn.title = '删除';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        StorageManager.deleteCompound(comp.id);
        this._renderDiscovered();
      });

      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);

      item.appendChild(formulaDiv);
      item.appendChild(actions);
      this.discoveredEl.appendChild(item);
    }
  }

  // ==================== 保存 / 加载 ====================

  /** 批量删除选中的原子和键 */
  _deleteSelected() {
    const atomIds = this.selection.getAtomIds();
    const bondIds = this.selection.getBondIds();

    // 先删键（避免原子删除时触发额外清理）
    for (const bondId of bondIds) {
      this._removeBond(bondId);
    }
    // 再删原子
    for (const atomId of atomIds) {
      this._removeAtom(atomId);
    }
    this.selection.clear();
    this.renderer.clearAllMultiHighlights();
    this._updateFormulaDisplay();
  }

  /** 多选拖拽结束回调 */
  _onMultiMoveEnd() {
    for (const atomId of this.selection.getAtomIds()) {
      this.renderer.updateBondsForAtom(atomId, this.atomsMap, this.bondManager);
    }
    this.renderer.refreshAllBonds(this.atomsMap, this.bondManager);
  }

  _saveCompound() {
    if (this.atomsMap.size === 0) {
      alert('画布上没有物质，请先合成！');
      return;
    }

    const components = FormulaGenerator.generateAll(this.atomsMap, this.bondManager);

    for (const comp of components) {
      // 收集这个分量的原子和键数据
      const compAtoms = [];
      const compBonds = [];
      const compAtomIds = new Set(comp.atomIds);

      for (const id of comp.atomIds) {
        const atom = this.atomsMap.get(id);
        if (atom) compAtoms.push(atom.toJSON());
      }

      for (const bond of this.bondManager.getAllBonds()) {
        if (compAtomIds.has(bond.atom1Id) && compAtomIds.has(bond.atom2Id)) {
          compBonds.push(bond.toJSON());
        }
      }

      StorageManager.saveCompound({
        name: comp.formula,
        formula: comp.formula,
        atoms: compAtoms,
        bonds: compBonds,
      });
    }

    this._renderDiscovered();
    this._updateFormulaDisplay();
  }

  _loadCompound(comp) {
    // 清空画布
    this._clearCanvas(true);

    // 恢复原子
    const idMap = {}; // oldId → newAtom
    for (const ad of comp.atoms) {
      const atom = new Atom(ad.element, ad.x + 50, ad.y + 50); // 偏移避免重叠
      idMap[ad.id] = atom;
      this.atomsMap.set(atom.id, atom);
      this.renderer.renderAtom(atom);
    }

    // 恢复键
    for (const bd of comp.bonds) {
      const a1 = idMap[bd.atom1Id];
      const a2 = idMap[bd.atom2Id];
      if (a1 && a2) {
        const bond = this.bondManager.createBond(a1, a2, bd.type);
        if (bond) {
          this.renderer.renderBond(bond, a1, a2);
        }
      }
    }

    // 刷新所有原子的化合价显示
    for (const atom of this.atomsMap.values()) {
      this.renderer.refreshAtom(atom);
    }

    this._updateFormulaDisplay();
  }

  _clearCanvas(silent = false) {
    for (const atomId of this.atomsMap.keys()) {
      this.renderer.removeAtom(atomId);
    }
    for (const bondId of this.bondManager.bonds.keys()) {
      this.renderer.removeBond(bondId);
    }
    this.atomsMap.clear();
    this.bondManager = new BondManager();
    this.renderer.clearHighlight();
    this.selection.clear();
    this.renderer.clearAllMultiHighlights();
    this._updateFormulaDisplay();
  }
}

// ==================== 启动 ====================

document.addEventListener('DOMContentLoaded', () => {
  const app = new ChemCraftApp();
  app.init();

  // 暴露到全局供调试
  window.chemcraftApp = app;
});
