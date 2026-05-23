// ============================================================
// DragDrop.js — 拖拽交互管理（含平移/缩放/框选/多选拖拽）
// ============================================================

import { CANVAS } from './config.js';

export class DragDropManager {
  /**
   * @param {SVGSVGElement} svgEl
   * @param {CanvasRenderer} renderer
   * @param {Camera} camera
   * @param {SelectionManager} selection
   * @param {Object} callbacks
   */
  constructor(svgEl, renderer, camera, selection, callbacks = {}) {
    this.svg       = svgEl;
    this.renderer  = renderer;
    this.camera    = camera;
    this.selection = selection;
    this.cb        = callbacks;

    // ---- 侧栏幽灵拖入 ----
    this.dragElement   = null;
    this.dragGhost     = null;
    this._ghostHandled = false;

    // ---- 单原子拖拽 ----
    this.draggingAtomId = null;
    this.dragOffsetX    = 0;
    this.dragOffsetY    = 0;
    this.dragStartX     = 0;
    this.dragStartY     = 0;
    this.hasMoved       = false;

    // ---- 平移 ----
    this.isPanning  = false;
    this.panLastX   = 0;
    this.panLastY   = 0;
    this.spaceHeld  = false;

    // ---- 框选 ----
    this.isBoxSelecting = false;
    this.boxStartX = 0;
    this.boxStartY = 0;

    // ---- 多选拖拽 ----
    this.isMultiDragging = false;
    this.multiDragOffsets = new Map(); // atomId → {x, y} 初始 world 坐标

    // ---- 键拖拽 ----
    this.bondDragging   = false;
    this.bondDragAtomId = null;

    this._initEvents();
  }

  // ==================== 事件绑定 ====================

  _initEvents() {
    // 画布鼠标事件
    this.svg.addEventListener('mousedown',  this._onMouseDown.bind(this));
    this.svg.addEventListener('mousemove',  this._onMouseMove.bind(this));
    this.svg.addEventListener('mouseup',    this._onMouseUp.bind(this));
    this.svg.addEventListener('mouseleave', this._onMouseUp.bind(this));
    this.svg.addEventListener('contextmenu', this._onContextMenu.bind(this));

    // 文档级事件（幽灵拖拽 + 键盘 + 滚轮）
    document.addEventListener('mousemove', this._onDocMouseMove.bind(this));
    document.addEventListener('mouseup',   this._onDocMouseUp.bind(this));
    document.addEventListener('keydown',   this._onKeyDown.bind(this));
    document.addEventListener('keyup',     this._onKeyUp.bind(this));
    this.svg.addEventListener('wheel',     this._onWheel.bind(this), { passive: false });

    // 触摸事件
    this.svg.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    this.svg.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });
    this.svg.addEventListener('touchend',   this._onTouchEnd.bind(this));
  }

  // ==================== 坐标转换 ====================

  /** 保留的 viewBox 转换（不经过相机） */
  _clientToSVG(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
  }

  /** client → SVG viewBox → World（经过相机逆变换） */
  _clientToWorld(clientX, clientY) {
    const svgP = this._clientToSVG(clientX, clientY);
    return this.camera.viewBoxToWorld(svgP.x, svgP.y);
  }

  // ==================== 侧栏幽灵拖入 ====================

  startSidebarDrag(elementSymbol, event) {
    this.dragElement = elementSymbol;
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    const img = document.createElement('img');
    img.src = `./assets/elements/${elementSymbol}.svg`;
    img.width = 56;
    img.height = 56;
    ghost.appendChild(img);
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '1000';
    ghost.style.opacity = '0.85';
    ghost.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(ghost);
    this.dragGhost = ghost;
    this._moveGhost(event);
  }

  _moveGhost(event) {
    if (!this.dragGhost) return;
    const cx = event.clientX || (event.touches && event.touches[0].clientX);
    const cy = event.clientY || (event.touches && event.touches[0].clientY);
    this.dragGhost.style.left = cx + 'px';
    this.dragGhost.style.top  = cy + 'px';
  }

  _removeGhost() {
    if (this.dragGhost) { this.dragGhost.remove(); this.dragGhost = null; }
    this.dragElement   = null;
    this._ghostHandled = false;
  }

  // ==================== 文档级事件 ====================

  _onDocMouseMove(event) {
    if (this.dragGhost) this._moveGhost(event);
  }

  _onDocMouseUp(event) {
    if (this.dragElement && this.dragGhost && !this._ghostHandled) {
      this._ghostHandled = true;
      const svgRect = this.svg.getBoundingClientRect();
      if (event.clientX >= svgRect.left && event.clientX <= svgRect.right &&
          event.clientY >= svgRect.top  && event.clientY <= svgRect.bottom) {
        const pt = this._clientToWorld(event.clientX, event.clientY);
        this.cb.onAtomDrop(this.dragElement, pt.x, pt.y);
      }
      this._removeGhost();
    }
  }

  // ==================== 键盘 ====================

  _onKeyDown(event) {
    if (event.code === 'Space' && !this._isInputFocused()) {
      this.spaceHeld = true;
      this.svg.style.cursor = 'grab';
      event.preventDefault();
    }
  }

  _onKeyUp(event) {
    if (event.code === 'Space') {
      this.spaceHeld = false;
      this.svg.style.cursor = 'crosshair';
    }
  }

  _isInputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  // ==================== 滚轮缩放 ====================

  _onWheel(event) {
    event.preventDefault();
    const svgP = this._clientToSVG(event.clientX, event.clientY);
    this.camera.zoomAt(svgP.x, svgP.y, event.deltaY);
    this._applyCameraTransform();
  }

  // ==================== 鼠标按下 ====================

  _onMouseDown(event) {
    if (event.button === 2) return; // 右键交给 contextmenu

    // P0：空格或中键 → 平移
    if (this.spaceHeld || event.button === 1) {
      this._startPan(event);
      return;
    }

    // 获取 world 坐标
    const pt = this._clientToWorld(event.clientX, event.clientY);

    // P1：原子命中
    const atom = this._hitTestAtom(pt.x, pt.y, this.cb.getAtomsMap());
    if (atom) {
      // Ctrl/Cmd + 点击 → 切换多选
      if (event.ctrlKey || event.metaKey) {
        this.selection.toggleAtom(atom.id, this.cb.getAtomsMap(), this.cb.getBondManager());
        this._renderMultiHighlights();
        return;
      }

      // Shift + 已有选中 → 建键
      if (event.shiftKey && this.renderer.selectedAtomId && this.renderer.selectedAtomId !== atom.id) {
        this.cb.onBondDragEnd(atom.id);
        this.renderer.clearHighlight();
        return;
      }

      // 序列点击建键（已有选中不同原子）
      if (this.renderer.selectedAtomId && this.renderer.selectedAtomId !== atom.id) {
        this.cb.onBondDragEnd(atom.id);
        this.renderer.clearHighlight();
        return;
      }

      // 多选拖拽（点击多选中的原子，且多选原子数 > 1）
      if (this.selection.isAtomSelected(atom.id) && this.selection.getAtomCount() > 1) {
        this._startMultiDrag(atom.id, pt);
        return;
      }

      // 否则：清除多选，开始单原子拖拽
      this.selection.clear();
      this.renderer.clearAllMultiHighlights();
      this._startAtomDrag(atom, pt);
      return;
    }

    // P2：键命中
    const bond = this._hitTestBond(pt.x, pt.y, this.cb.getAtomsMap(), this.cb.getBondManager());
    if (bond) {
      this.renderer.clearHighlight();
      this.selection.clear();
      this.renderer.clearAllMultiHighlights();
      if (this.cb.onBondClick) this.cb.onBondClick(bond.id);
      event.preventDefault();
      return;
    }

    // P3：空白区域 → 开始框选
    this._startBoxSelect(pt);
  }

  // ==================== 鼠标移动 ====================

  _onMouseMove(event) {
    // 幽灵
    if (this.dragGhost) { this._moveGhost(event); return; }

    // 平移
    if (this.isPanning) { this._updatePan(event); return; }

    // 框选
    if (this.isBoxSelecting) { this._updateBoxSelect(event); return; }

    // 多选拖拽
    if (this.isMultiDragging) { this._updateMultiDrag(event); return; }

    // 单原子拖拽
    if (this.draggingAtomId) {
      const pt = this._clientToWorld(event.clientX, event.clientY);
      const newX = pt.x - this.dragOffsetX;
      const newY = pt.y - this.dragOffsetY;
      if (Math.abs(pt.x - this.dragStartX) > 2 || Math.abs(pt.y - this.dragStartY) > 2) {
        this.hasMoved = true;
        this.cb.onAtomMove(this.draggingAtomId, newX, newY);
      }
      return;
    }

    // 键拖拽（遗留）
    if (this.bondDragging) {
      const pt = this._clientToWorld(event.clientX, event.clientY);
      this.cb.onBondDragMove(pt.x, pt.y);
    }
  }

  // ==================== 鼠标释放 ====================

  _onMouseUp(event) {
    // 幽灵拖入（与文档级 handler 互斥）
    if (this.dragElement && this.dragGhost && !this._ghostHandled) {
      this._ghostHandled = true;
      const svgRect = this.svg.getBoundingClientRect();
      if (event.clientX >= svgRect.left && event.clientX <= svgRect.right &&
          event.clientY >= svgRect.top  && event.clientY <= svgRect.bottom) {
        const pt = this._clientToWorld(event.clientX, event.clientY);
        this.cb.onAtomDrop(this.dragElement, pt.x, pt.y);
      }
      this._removeGhost();
      return;
    }

    if (this.isPanning)      { this.isPanning = false; return; }
    if (this.isBoxSelecting)  { this._endBoxSelect(event); return; }
    if (this.isMultiDragging) { this._endMultiDrag(); return; }

    if (this.draggingAtomId) {
      if (this.hasMoved && this.cb.onAtomMoveEnd) {
        this.cb.onAtomMoveEnd(this.draggingAtomId);
      } else if (!this.hasMoved) {
        // 纯点击：单选该原子
        this.selection.selectSingle(this.draggingAtomId);
        this.renderer.clearAllMultiHighlights();
        this.renderer.highlightAtom(this.draggingAtomId);
      }
      this.draggingAtomId = null;
      this.hasMoved = false;
    }
  }

  // ==================== 右键 ====================

  _onContextMenu(event) {
    event.preventDefault();

    // 多选存在 → 批量删除
    if (this.selection.hasSelection() && this.cb.onMultiDelete) {
      this.cb.onMultiDelete();
      return;
    }

    const pt = this._clientToWorld(event.clientX, event.clientY);

    const atom = this._hitTestAtom(pt.x, pt.y, this.cb.getAtomsMap());
    if (atom) { this.cb.onAtomRightClick(atom.id); return; }

    const bond = this._hitTestBond(pt.x, pt.y, this.cb.getAtomsMap(), this.cb.getBondManager());
    if (bond) { this.cb.onBondRightClick(bond.id); return; }
  }

  // ==================== 平移 ====================

  _startPan(event) {
    this.isPanning = true;
    this.panLastX = event.clientX;
    this.panLastY = event.clientY;
    this.svg.style.cursor = 'grabbing';
    event.preventDefault();
  }

  _updatePan(event) {
    const dx = event.clientX - this.panLastX;
    const dy = event.clientY - this.panLastY;
    // 屏幕像素 → SVG viewBox 单位
    const ctm = this.svg.getScreenCTM();
    const sx = 1 / (ctm ? ctm.a : 1);
    const sy = 1 / (ctm ? ctm.d : 1);
    this.camera.panBy(dx * sx, dy * sy);
    this._applyCameraTransform();
    this.panLastX = event.clientX;
    this.panLastY = event.clientY;
  }

  // ==================== 框选 ====================

  _startBoxSelect(pt) {
    this.isBoxSelecting = true;
    this.boxStartX = pt.x;
    this.boxStartY = pt.y;
    this.selection.clear();
    this.renderer.clearHighlight();
    this.renderer.clearAllMultiHighlights();
  }

  _updateBoxSelect(event) {
    const pt = this._clientToWorld(event.clientX, event.clientY);
    this.renderer.renderSelectionBox(this.boxStartX, this.boxStartY, pt.x - this.boxStartX, pt.y - this.boxStartY);
  }

  _endBoxSelect(event) {
    this.isBoxSelecting = false;
    this.renderer.clearSelectionBox();

    const pt = this._clientToWorld(event.clientX, event.clientY);
    // 拖动距离太小 → 忽略（纯点击空白）
    if (Math.abs(pt.x - this.boxStartX) < 3 && Math.abs(pt.y - this.boxStartY) < 3) return;

    this.selection.selectInRect(
      this.boxStartX, this.boxStartY, pt.x, pt.y,
      this.cb.getAtomsMap(), this.cb.getBondManager()
    );
    this._renderMultiHighlights();
  }

  // ==================== 多选拖拽 ====================

  _startMultiDrag(atomId, pt) {
    this.isMultiDragging = true;
    this.multiDragOffsets.clear();

    // 记录所有选中原子的初始位置
    const atomsMap = this.cb.getAtomsMap();
    for (const id of this.selection.getAtomIds()) {
      const a = atomsMap.get(id);
      if (a) this.multiDragOffsets.set(id, { x: a.x, y: a.y });
    }

    const clickedAtom = atomsMap.get(atomId);
    this.dragOffsetX = pt.x - clickedAtom.x;
    this.dragOffsetY = pt.y - clickedAtom.y;
    this.dragStartX  = pt.x;
    this.dragStartY  = pt.y;
    this.hasMoved    = false;

    if (this.cb.onMultiMoveStart) this.cb.onMultiMoveStart();
  }

  _updateMultiDrag(event) {
    const pt = this._clientToWorld(event.clientX, event.clientY);
    const dx = pt.x - this.dragStartX;
    const dy = pt.y - this.dragStartY;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.hasMoved = true;
    if (!this.hasMoved) return;

    for (const [atomId, startPos] of this.multiDragOffsets) {
      const newX = startPos.x + dx;
      const newY = startPos.y + dy;
      if (this.cb.onMultiMove) this.cb.onMultiMove(atomId, newX, newY);
    }
  }

  _endMultiDrag() {
    if (this.cb.onMultiMoveEnd && this.hasMoved) this.cb.onMultiMoveEnd();
    this.isMultiDragging = false;
    this.multiDragOffsets.clear();
    this.hasMoved = false;
  }

  // ==================== 单原子拖拽辅助 ====================

  _startAtomDrag(atom, pt) {
    this.draggingAtomId = atom.id;
    this.dragOffsetX    = pt.x - atom.x;
    this.dragOffsetY    = pt.y - atom.y;
    this.dragStartX     = pt.x;
    this.dragStartY     = pt.y;
    this.hasMoved       = false;
    this.renderer.highlightAtom(atom.id);
    if (this.cb.onAtomMoveStart) this.cb.onAtomMoveStart(atom.id);
  }

  // ==================== 碰撞检测 ====================

  _hitTestAtom(svgX, svgY, atomsMap) {
    for (const atom of atomsMap.values()) {
      const dx = svgX - atom.x;
      const dy = svgY - atom.y;
      if (Math.sqrt(dx * dx + dy * dy) <= CANVAS.atomRadius + 4) return atom;
    }
    return null;
  }

  _hitTestBond(svgX, svgY, atomsMap, bondManager) {
    for (const bond of bondManager.getAllBonds()) {
      const a1 = atomsMap.get(bond.atom1Id);
      const a2 = atomsMap.get(bond.atom2Id);
      if (!a1 || !a2) continue;
      if (this._pointToSegDist(svgX, svgY, a1.x, a1.y, a2.x, a2.y) < 14) return bond;
    }
    return null;
  }

  _pointToSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2);
  }

  // ==================== 相机变换应用 ====================

  _applyCameraTransform() {
    this.renderer.getCameraGroup().setAttribute('transform', this.camera.getTransform());
  }

  // ==================== 多选渲染 ====================

  _renderMultiHighlights() {
    this.renderer.clearAllMultiHighlights();
    for (const atomId of this.selection.getAtomIds()) this.renderer.highlightAtomMulti(atomId);
    for (const bondId of this.selection.getBondIds()) this.renderer.highlightBond(bondId);
  }

  // ==================== 触摸事件 ====================

  _onTouchStart(event) {
    if (event.touches.length !== 1) return;
    const t = event.touches[0];
    this._onMouseDown({ clientX: t.clientX, clientY: t.clientY, button: 0, preventDefault: () => {}, ctrlKey: false, metaKey: false, shiftKey: false });
    event.preventDefault();
  }

  _onTouchMove(event) {
    if (event.touches.length !== 1) return;
    const t = event.touches[0];
    this._onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    event.preventDefault();
  }

  _onTouchEnd(event) {
    const t = event.changedTouches[0] || { clientX: 0, clientY: 0 };
    this._onMouseUp({ clientX: t.clientX, clientY: t.clientY });
  }
}
