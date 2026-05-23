// ============================================================
// FormulaGenerator.js — 分子式生成与 SVG 渲染
// ============================================================

import { FORMULA_ORDER } from './config.js';

/** 分子式生成器 */
export class FormulaGenerator {
  /**
   * 根据原子和键数据，生成所有连通分量的分子式列表
   * @param {Map<string, Atom>} atomsMap
   * @param {BondManager} bondManager
   * @returns {Array<{formula: string, atomIds: string[], count: Object}>}
   */
  static generateAll(atomsMap, bondManager) {
    const visited = new Set();
    const components = [];

    for (const atom of atomsMap.values()) {
      if (visited.has(atom.id)) continue;

      // BFS 找出当前连通分量
      const componentIds = [];
      const queue = [atom.id];
      visited.add(atom.id);

      while (queue.length > 0) {
        const currentId = queue.shift();
        componentIds.push(currentId);

        const bonds = bondManager.getBondsForAtom(currentId);
        for (const bond of bonds) {
          const neighborId = bond.atom1Id === currentId ? bond.atom2Id : bond.atom1Id;
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }

      // 统计元素个数
      const count = {};
      for (const id of componentIds) {
        const a = atomsMap.get(id);
        if (!a) continue;
        count[a.element] = (count[a.element] || 0) + 1;
      }

      const formula = FormulaGenerator.formatFormula(count);
      components.push({ formula, atomIds: componentIds, count });
    }

    return components;
  }

  /**
   * 按有机化学惯例格式化分子式
   * 例：{C:2, H:5, O:1, H:1} → "C2H5OH" (合并同一元素)
   * 例：{C:1, O:2} → "CO2"
   */
  static formatFormula(count) {
    // 合并 count
    const merged = {};
    for (const [el, n] of Object.entries(count)) {
      merged[el] = (merged[el] || 0) + n;
    }

    // 按指定顺序排列
    const ordered = [];
    for (const el of FORMULA_ORDER) {
      if (merged[el] !== undefined) {
        ordered.push({ el, n: merged[el] });
        delete merged[el];
      }
    }
    // 剩余元素按字母序
    const rest = Object.keys(merged).sort();
    for (const el of rest) {
      ordered.push({ el, n: merged[el] });
    }

    // 构造字符串
    return ordered.map(({ el, n }) => n === 1 ? el : `${el}${n}`).join('');
  }

  /** 纯计数模式（不依赖连通分量分析） */
  static countElements(atoms) {
    const count = {};
    for (const atom of atoms) {
      count[atom.element] = (count[atom.element] || 0) + 1;
    }
    return count;
  }
}

/** 分子式 SVG 渲染器（纯客户端，无需 LaTeX） */
export class FormulaRenderer {
  /**
   * 将分子式字符串渲染为 SVG 字符串
   * @param {string} formula — 如 "H2O", "C2H5OH", "NaCl"
   * @returns {string} SVG markup
   */
  static renderToSVG(formula, fontSize = 28) {
    const tokens = FormulaRenderer._parse(formula);
    return FormulaRenderer._buildSVG(tokens, fontSize);
  }

  /**
   * 解析分子式字符串为 token 数组
   * 例："C2H5OH" → [{text:'C'}, {text:'2', sub:true}, {text:'H'}, {text:'5', sub:true}, {text:'O'}, {text:'H'}]
   */
  static _parse(formula) {
    const tokens = [];
    let i = 0;
    while (i < formula.length) {
      // 大写字母开始一个新元素
      if (/[A-Z]/.test(formula[i])) {
        let sym = formula[i];
        i++;
        // 收集后续小写字母
        while (i < formula.length && /[a-z]/.test(formula[i])) {
          sym += formula[i];
          i++;
        }
        // 收集后续数字作为下标
        let num = '';
        while (i < formula.length && /[0-9]/.test(formula[i])) {
          num += formula[i];
          i++;
        }
        tokens.push({ text: sym, sub: false });
        if (num) {
          tokens.push({ text: num, sub: true });
        }
      } else {
        // 非字母数字字符直接输出
        tokens.push({ text: formula[i], sub: false });
        i++;
      }
    }
    return tokens;
  }

  /**
   * 构建 SVG
   */
  static _buildSVG(tokens, fontSize) {
    const charWidth  = fontSize * 0.62;
    const subOffsetY = fontSize * 0.30;
    const subScale   = 0.7;           // 下标缩放比
    const padding    = 20;

    // 计算总宽度
    let totalWidth = 0;
    for (const t of tokens) {
      if (t.sub) {
        totalWidth += charWidth * t.text.length * subScale;
      } else {
        totalWidth += charWidth * t.text.length;
      }
    }
    const width  = totalWidth + padding * 2;
    const height = fontSize + padding * 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
    svg += `<rect width="100%" height="100%" fill="transparent"/>`;

    let x = padding;
    for (const t of tokens) {
      if (t.sub) {
        const subFontSize = fontSize * subScale;
        svg += `<text x="${x}" y="${fontSize + subOffsetY + padding}" font-family="'Times New Roman', Georgia, serif" font-size="${subFontSize}" fill="#2c3e50" text-anchor="start">${t.text}</text>`;
        x += charWidth * t.text.length * subScale;
      } else {
        svg += `<text x="${x}" y="${fontSize / 2 + padding + 2}" font-family="'Times New Roman', Georgia, serif" font-size="${fontSize}" font-weight="bold" fill="#2c3e50" text-anchor="start">${t.text}</text>`;
        x += charWidth * t.text.length;
      }
    }
    svg += `</svg>`;
    return svg;
  }

  /**
   * 将分子式渲染为 DOM 元素（用于内联显示）
   */
  static renderToDOM(formula) {
    const container = document.createElement('span');
    container.className = 'formula-inline';
    container.style.fontFamily = "'Times New Roman', Georgia, serif";
    container.style.fontWeight = 'bold';
    container.style.color = '#2c3e50';

    const tokens = FormulaRenderer._parse(formula);
    for (const t of tokens) {
      if (t.sub) {
        const sub = document.createElement('sub');
        sub.textContent = t.text;
        container.appendChild(sub);
      } else {
        container.appendChild(document.createTextNode(t.text));
      }
    }
    return container;
  }

  /**
   * 将分子式渲染为 Data URL (SVG)
   */
  static renderToDataURL(formula, fontSize = 28) {
    const svg = FormulaRenderer.renderToSVG(formula, fontSize);
    const encoded = encodeURIComponent(svg);
    return `data:image/svg+xml,${encoded}`;
  }

  /**
   * 渲染为 Blob URL（用于 img src）
   */
  static renderToBlobURL(formula, fontSize = 28) {
    const svg = FormulaRenderer.renderToSVG(formula, fontSize);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }
}
