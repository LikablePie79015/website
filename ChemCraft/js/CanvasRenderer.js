// ============================================================
// CanvasRenderer.js — SVG 画布渲染器（含相机组 + 多选高亮）
// ============================================================

import { CANVAS, BOND_TYPE, ELEMENTS } from './config.js';

const R  = CANVAS.atomRadius;
const SW = CANVAS.bondStrokeWidth;
const BO = CANVAS.bondOffset;

export class CanvasRenderer {
  /**
   * @param {SVGSVGElement} svgEl — 画布 SVG 元素
   */
  constructor(svgEl) {
    this.svg = svgEl;

    // 移除旧层（clean slate）
    ['camera-group', 'bonds-layer', 'atoms-layer', 'drag-layer', 'selection-layer'].forEach(id => {
      const el = this.svg.querySelector(`#${id}`);
      if (el) el.remove();
    });

    // 创建相机变换组（包裹所有交互内容）
    this.cameraGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.cameraGroup.id = 'camera-group';
    this.svg.appendChild(this.cameraGroup);

    // 图层：均放在 cameraGroup 内部
    this.bondsLayer     = this._addLayerTo(this.cameraGroup, 'bonds-layer');
    this.atomsLayer     = this._addLayerTo(this.cameraGroup, 'atoms-layer');
    this.selectionLayer = this._addLayerTo(this.cameraGroup, 'selection-layer');
    this.dragLayer      = this._addLayerTo(this.cameraGroup, 'drag-layer');

    // 缓存的 SVG 元素引用
    this.atomGroups   = new Map();   // atomId → <g>
    this.bondGroups   = new Map();   // bondId → <g>
    this.bondHitAreas = new Map();   // bondId → <line>

    // 单选高亮
    this.selectedAtomId = null;
    this.originalStrokes = new Map();       // atomId → {stroke, strokeWidth}

    // 多选高亮
    this.multiStrokes = new Map();          // atomId → {stroke, strokeWidth, filter}
  }

  /** 在 parent 内查找/创建指定 id 的 <g> 图层 */
  _addLayerTo(parent, id) {
    let layer = this.svg.querySelector(`#${id}`);
    if (!layer) {
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.id = id;
      parent.appendChild(layer);
    }
    return layer;
  }

  // ==================== Atom 渲染 ====================

  renderAtom(atom) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'atom-group');
    g.setAttribute('data-atom-id', atom.id);
    g.setAttribute('transform', `translate(${atom.x}, ${atom.y})`);

    const cfg = atom.getConfig();

    // 阴影
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    shadow.setAttribute('r', R + 2);
    shadow.setAttribute('fill', 'rgba(0,0,0,0.15)');
    shadow.setAttribute('cx', 0);
    shadow.setAttribute('cy', 2);
    g.appendChild(shadow);

    // 主体圆
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', R);
    circle.setAttribute('fill', cfg.color);
    circle.setAttribute('stroke', this._darken(cfg.color, 0.3));
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('cx', 0);
    circle.setAttribute('cy', 0);
    circle.classList.add('atom-circle');
    g.appendChild(circle);

    // 化合价指示器
    this._renderValenceDots(g, atom);

    // 元素符号文本
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', cfg.textColor);
    text.setAttribute('font-family', 'Arial, "Microsoft YaHei", sans-serif');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-size', atom.element.length > 1 ? '16' : '22');
    text.setAttribute('x', 0);
    text.setAttribute('y', 0);
    text.textContent = atom.element;
    text.style.pointerEvents = 'none';
    g.appendChild(text);

    this.atomsLayer.appendChild(g);
    this.atomGroups.set(atom.id, g);
    return g;
  }

  _renderValenceDots(g, atom) {
    const total  = atom.valence;
    const used   = atom.usedBonds;
    const dotR   = 3;
    const baseR  = R + 8;
    const startAngle = -Math.PI / 2;

    for (let i = 0; i < total; i++) {
      const angle = startAngle + (2 * Math.PI * i) / total;
      const cx = Math.cos(angle) * baseR;
      const cy = Math.sin(angle) * baseR;

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', dotR);
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', cy);
      if (i < used) {
        dot.setAttribute('fill', '#2ecc71');
        dot.setAttribute('stroke', '#27ae60');
      } else {
        dot.setAttribute('fill', '#bdc3c7');
        dot.setAttribute('stroke', '#95a5a6');
      }
      dot.setAttribute('stroke-width', '1');
      dot.classList.add('valence-dot');
      g.appendChild(dot);
    }
  }

  _updateValenceDots(g, atom) {
    g.querySelectorAll('.valence-dot').forEach(d => d.remove());
    this._renderValenceDots(g, atom);
  }

  updateAtomPosition(atom) {
    const g = this.atomGroups.get(atom.id);
    if (g) {
      g.setAttribute('transform', `translate(${atom.x}, ${atom.y})`);
    }
  }

  refreshAtom(atom) {
    const g = this.atomGroups.get(atom.id);
    if (g) this._updateValenceDots(g, atom);
  }

  // ==================== Bond 渲染 ====================

  renderBond(bond, atom1, atom2) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'bond-group');
    g.setAttribute('data-bond-id', bond.id);

    const lines = this._calcBondLines(atom1.x, atom1.y, atom2.x, atom2.y, bond.type);

    for (const ln of lines) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', ln.x1);
      line.setAttribute('y1', ln.y1);
      line.setAttribute('x2', ln.x2);
      line.setAttribute('y2', ln.y2);
      line.setAttribute('stroke', '#555');
      line.setAttribute('stroke-width', SW);
      line.setAttribute('stroke-linecap', 'round');
      g.appendChild(line);
    }

    // 不可见点击区域
    const hitLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hitLine.setAttribute('x1', atom1.x);
    hitLine.setAttribute('y1', atom1.y);
    hitLine.setAttribute('x2', atom2.x);
    hitLine.setAttribute('y2', atom2.y);
    hitLine.setAttribute('stroke', 'transparent');
    hitLine.setAttribute('stroke-width', '18');
    hitLine.setAttribute('stroke-linecap', 'round');
    hitLine.style.cursor = 'pointer';
    hitLine.classList.add('bond-hit-area');
    g.appendChild(hitLine);
    this.bondHitAreas.set(bond.id, hitLine);

    this.bondsLayer.appendChild(g);
    this.bondGroups.set(bond.id, g);
    return g;
  }

  _calcBondLines(x1, y1, x2, y2, bondType) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.01) return [];

    const ux = dx / dist, uy = dy / dist;
    const px = -uy, py = ux;
    const sx = x1 + ux * R, sy = y1 + uy * R;
    const ex = x2 - ux * R, ey = y2 - uy * R;

    const lines = [];
    if (bondType === 1) {
      lines.push({ x1: sx, y1: sy, x2: ex, y2: ey });
    } else if (bondType === 2) {
      lines.push({ x1: sx + px * BO, y1: sy + py * BO, x2: ex + px * BO, y2: ey + py * BO });
      lines.push({ x1: sx - px * BO, y1: sy - py * BO, x2: ex - px * BO, y2: ey - py * BO });
    } else if (bondType === 3) {
      lines.push({ x1: sx + px * BO * 1.6, y1: sy + py * BO * 1.6, x2: ex + px * BO * 1.6, y2: ey + py * BO * 1.6 });
      lines.push({ x1: sx, y1: sy, x2: ex, y2: ey });
      lines.push({ x1: sx - px * BO * 1.6, y1: sy - py * BO * 1.6, x2: ex - px * BO * 1.6, y2: ey - py * BO * 1.6 });
    }
    return lines;
  }

  updateBond(bond, atom1, atom2) {
    const oldG = this.bondGroups.get(bond.id);
    if (oldG) {
      this.bondsLayer.removeChild(oldG);
      this.bondGroups.delete(bond.id);
    }
    this.renderBond(bond, atom1, atom2);
  }

  updateBondsForAtom(atomId, atomsMap, bondManager) {
    const bonds = bondManager.getBondsForAtom(atomId);
    for (const bond of bonds) {
      const a1 = atomsMap.get(bond.atom1Id);
      const a2 = atomsMap.get(bond.atom2Id);
      if (a1 && a2) this.updateBond(bond, a1, a2);
    }
  }

  refreshAllBonds(atomsMap, bondManager) {
    for (const bond of bondManager.getAllBonds()) {
      const a1 = atomsMap.get(bond.atom1Id);
      const a2 = atomsMap.get(bond.atom2Id);
      if (a1 && a2) this.updateBond(bond, a1, a2);
    }
  }

  // ==================== 单选高亮 ====================

  highlightAtom(atomId) {
    this.clearHighlight();
    const g = this.atomGroups.get(atomId);
    if (g) {
      const circle = g.querySelector('.atom-circle');
      if (circle) {
        this.originalStrokes.set(atomId, {
          stroke: circle.getAttribute('stroke'),
          strokeWidth: circle.getAttribute('stroke-width') || '2',
        });
        circle.setAttribute('stroke', '#f39c12');
        circle.setAttribute('stroke-width', '4');
        circle.style.filter = 'drop-shadow(0 0 8px rgba(243,156,18,0.6))';
      }
      this.selectedAtomId = atomId;
    }
  }

  clearHighlight() {
    if (this.selectedAtomId) {
      const g = this.atomGroups.get(this.selectedAtomId);
      if (g) {
        const circle = g.querySelector('.atom-circle');
        if (circle) {
          const orig = this.originalStrokes.get(this.selectedAtomId);
          circle.setAttribute('stroke', orig ? orig.stroke : '#555');
          circle.setAttribute('stroke-width', orig ? orig.strokeWidth : '2');
          circle.style.filter = '';
        }
      }
      this.originalStrokes.delete(this.selectedAtomId);
      this.selectedAtomId = null;
    }
  }

  // ==================== 多选高亮 ====================

  /** 多选高亮：蓝色 */
  highlightAtomMulti(atomId) {
    const g = this.atomGroups.get(atomId);
    if (!g) return;
    const circle = g.querySelector('.atom-circle');
    if (!circle) return;

    this.multiStrokes.set(atomId, {
      stroke: circle.getAttribute('stroke'),
      strokeWidth: circle.getAttribute('stroke-width'),
      filter: circle.style.filter || '',
    });

    circle.setAttribute('stroke', '#3498db');
    circle.setAttribute('stroke-width', '3.5');
    circle.style.filter = 'drop-shadow(0 0 6px rgba(52,152,219,0.5))';
  }

  /** 高亮被选中的键 */
  highlightBond(bondId) {
    const g = this.bondGroups.get(bondId);
    if (g) {
      g.querySelectorAll('line:not(.bond-hit-area)').forEach(line => {
        line.setAttribute('stroke', '#3498db');
        line.setAttribute('stroke-width', '4');
      });
    }
  }

  /** 清除所有多选高亮 */
  clearAllMultiHighlights() {
    for (const [atomId, orig] of this.multiStrokes) {
      const g = this.atomGroups.get(atomId);
      if (g) {
        const circle = g.querySelector('.atom-circle');
        if (circle) {
          circle.setAttribute('stroke', orig.stroke);
          circle.setAttribute('stroke-width', orig.strokeWidth);
          circle.style.filter = orig.filter;
        }
      }
    }
    this.multiStrokes.clear();

    for (const [, g] of this.bondGroups) {
      g.querySelectorAll('line:not(.bond-hit-area)').forEach(line => {
        if (line.getAttribute('stroke') === '#3498db') {
          line.setAttribute('stroke', '#555');
          line.setAttribute('stroke-width', String(SW));
        }
      });
    }
  }

  // ==================== 框选矩形 ====================

  renderSelectionBox(x, y, w, h) {
    let box = this.selectionLayer.querySelector('#selection-box');
    if (!box) {
      box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      box.id = 'selection-box';
      box.setAttribute('fill', 'rgba(52,152,219,0.08)');
      box.setAttribute('stroke', '#3498db');
      box.setAttribute('stroke-width', '1.5');
      box.setAttribute('stroke-dasharray', '6,3');
      box.setAttribute('pointer-events', 'none');
      this.selectionLayer.appendChild(box);
    }
    box.setAttribute('x', Math.min(x, x + w));
    box.setAttribute('y', Math.min(y, y + h));
    box.setAttribute('width', Math.abs(w));
    box.setAttribute('height', Math.abs(h));
  }

  clearSelectionBox() {
    const box = this.selectionLayer.querySelector('#selection-box');
    if (box) box.remove();
  }

  // ==================== 删除 ====================

  removeAtom(atomId) {
    const g = this.atomGroups.get(atomId);
    if (g) {
      this.atomsLayer.removeChild(g);
      this.atomGroups.delete(atomId);
    }
    if (this.selectedAtomId === atomId) {
      this.selectedAtomId = null;
    }
    // 清理多选高亮记录
    this.multiStrokes.delete(atomId);
    this.originalStrokes.delete(atomId);
  }

  removeBond(bondId) {
    const g = this.bondGroups.get(bondId);
    if (g) {
      this.bondsLayer.removeChild(g);
      this.bondGroups.delete(bondId);
      this.bondHitAreas.delete(bondId);
    }
  }

  // ==================== 拖拽线 ====================

  drawDragLine(x1, y1, x2, y2) {
    let line = this.dragLayer.querySelector('.drag-line');
    if (!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('drag-line');
      line.setAttribute('stroke', '#f39c12');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '6,4');
      line.setAttribute('stroke-linecap', 'round');
      this.dragLayer.appendChild(line);
    }
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
  }

  clearDragLine() {
    const line = this.dragLayer.querySelector('.drag-line');
    if (line) this.dragLayer.removeChild(line);
  }

  // ==================== 工具函数 ====================

  getCameraGroup() { return this.cameraGroup; }

  _darken(hex, amount) {
    let r, g, b;
    if (hex.startsWith('#')) {
      const h = hex.slice(1);
      if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
      } else {
        r = parseInt(h.slice(0, 2), 16);
        g = parseInt(h.slice(2, 4), 16);
        b = parseInt(h.slice(4, 6), 16);
      }
    } else {
      return hex;
    }
    r = Math.floor(r * (1 - amount));
    g = Math.floor(g * (1 - amount));
    b = Math.floor(b * (1 - amount));
    return `rgb(${r},${g},${b})`;
  }
}
