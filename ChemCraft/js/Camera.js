// ============================================================
// Camera.js — 相机/视口管理（平移 + 缩放）
// ============================================================

import { CANVAS } from './config.js';

export class Camera {
  constructor(options = {}) {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.minZoom = options.minZoom ?? CANVAS.cameraMinZoom ?? 0.1;
    this.maxZoom = options.maxZoom ?? CANVAS.cameraMaxZoom ?? 5.0;
    this.zoomSensitivity = options.zoomSensitivity ?? CANVAS.zoomSensitivity ?? 0.001;
  }

  /** 平移（SVG viewBox 坐标增量） */
  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  /** 以指定 SVG viewBox 坐标点为中心缩放 */
  zoomAt(svgX, svgY, delta) {
    const worldX = (svgX - this.panX) / this.zoom;
    const worldY = (svgY - this.panY) / this.zoom;

    const factor = 1 - delta * this.zoomSensitivity;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));

    this.panX = svgX - worldX * newZoom;
    this.panY = svgY - worldY * newZoom;
    this.zoom = newZoom;
  }

  /** SVG viewBox 坐标 → World 坐标 */
  viewBoxToWorld(svgX, svgY) {
    return {
      x: (svgX - this.panX) / this.zoom,
      y: (svgY - this.panY) / this.zoom,
    };
  }

  /** World 坐标 → SVG viewBox 坐标 */
  worldToViewBox(worldX, worldY) {
    return {
      x: worldX * this.zoom + this.panX,
      y: worldY * this.zoom + this.panY,
    };
  }

  /** 获取 SVG transform 字符串 */
  getTransform() {
    return `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`;
  }

  reset() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
  }
}
