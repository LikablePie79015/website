// ============================================================
// config.js — 核心配置与元素定义
// ============================================================

/** 基础元素数据：符号、中文名、化合价、显示颜色、文本颜色、原子量 */
export const ELEMENTS = {
  C:  { symbol: 'C',  name: '碳 Carbon',    valence: 4, color: '#404040', textColor: '#ffffff', mass: 12.011 },
  H:  { symbol: 'H',  name: '氢 Hydrogen',   valence: 1, color: '#c8c8c8', textColor: '#333333', mass: 1.008 },
  O:  { symbol: 'O',  name: '氧 Oxygen',     valence: 2, color: '#c0392b', textColor: '#ffffff', mass: 15.999 },
  N:  { symbol: 'N',  name: '氮 Nitrogen',   valence: 3, color: '#2c5f8a', textColor: '#ffffff', mass: 14.007 },
  Cl: { symbol: 'Cl', name: '氯 Chlorine',   valence: 1, color: '#3d7a28', textColor: '#ffffff', mass: 35.453 },
  S:  { symbol: 'S',  name: '硫 Sulfur',     valence: 2, color: '#c4a020', textColor: '#333333', mass: 32.065 },
  P:  { symbol: 'P',  name: '磷 Phosphorus', valence: 3, color: '#c06020', textColor: '#ffffff', mass: 30.974 },
  F:  { symbol: 'F',  name: '氟 Fluorine',   valence: 1, color: '#4a9e8e', textColor: '#ffffff', mass: 18.998 },
  Br: { symbol: 'Br', name: '溴 Bromine',    valence: 1, color: '#804020', textColor: '#ffffff', mass: 79.904 },
  Na: { symbol: 'Na', name: '钠 Sodium',     valence: 1, color: '#7050a0', textColor: '#ffffff', mass: 22.990 },
};

/** 默认基础元素（左侧栏初始显示） */
export const DEFAULT_ELEMENTS = ['C', 'H', 'O', 'N', 'Cl', 'S', 'P', 'F', 'Br', 'Na'];

/** 资源路径 */
export const PATHS = {
  elements: './assets/elements/',
  formulas: './assets/formulas/',
  generated: './assets/generated/',
};

/** 画布配置 */
export const CANVAS = {
  viewBoxWidth: 1200,
  viewBoxHeight: 800,
  atomRadius: 34,
  bondStrokeWidth: 3,
  bondOffset: 5.5,       // 双键/三键的平行线偏移
  gridSize: 40,
  snapThreshold: 20,

  // 相机/视口
  cameraMinZoom: 0.1,
  cameraMaxZoom: 5.0,
  zoomSensitivity: 0.001,
};

/** 化学键类型常量 */
export const BOND_TYPE = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
};

/** 分子式元素排列顺序（有机化学惯例：C 在前，H 其次，其余按字母序） */
export const FORMULA_ORDER = ['C', 'H', 'O', 'N', 'Cl', 'S', 'P', 'F', 'Br', 'Na'];
