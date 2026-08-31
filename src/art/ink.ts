import Phaser from 'phaser';
import { INK } from './palette';

/**
 * Primitivas de desenho "sticker": cada forma carrega seu proprio contorno de
 * tinta. Desenhar a forma inflada em INK, depois a forma real por cima.
 * Isso e o que da o look de adesivo recortado do How Many Dudes.
 */

export const OUTLINE = 6;

type G = Phaser.GameObjects.Graphics;

export function inkCircle(g: G, x: number, y: number, r: number, fill: number, o = OUTLINE): void {
  g.fillStyle(INK, 1);
  g.fillCircle(x, y, r + o);
  g.fillStyle(fill, 1);
  g.fillCircle(x, y, r);
}

export function inkEllipse(g: G, x: number, y: number, w: number, h: number, fill: number, o = OUTLINE): void {
  g.fillStyle(INK, 1);
  g.fillEllipse(x, y, w + o * 2, h + o * 2);
  g.fillStyle(fill, 1);
  g.fillEllipse(x, y, w, h);
}

/** x,y = canto superior esquerdo da forma final. */
export function inkRR(g: G, x: number, y: number, w: number, h: number, r: number, fill: number, o = OUTLINE): void {
  g.fillStyle(INK, 1);
  g.fillRoundedRect(x - o, y - o, w + o * 2, h + o * 2, r + o);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
}

/** Retangulo centrado em x,y. */
export function inkRRC(g: G, x: number, y: number, w: number, h: number, r: number, fill: number, o = OUTLINE): void {
  inkRR(g, x - w / 2, y - h / 2, w, h, r, fill, o);
}

export function inkTri(g: G, pts: number[], fill: number, o = OUTLINE): void {
  // Infla o triangulo a partir do centroide para gerar o contorno.
  const cx = (pts[0] + pts[2] + pts[4]) / 3;
  const cy = (pts[1] + pts[3] + pts[5]) / 3;
  const grow: number[] = [];
  for (let i = 0; i < 6; i += 2) {
    const dx = pts[i] - cx, dy = pts[i + 1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    grow.push(pts[i] + (dx / len) * o * 1.6, pts[i + 1] + (dy / len) * o * 1.6);
  }
  g.fillStyle(INK, 1);
  g.fillTriangle(grow[0], grow[1], grow[2], grow[3], grow[4], grow[5]);
  g.fillStyle(fill, 1);
  g.fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
}

/** Forma sem contorno — para detalhes internos (olhos, listras, bochechas). */
export function flatCircle(g: G, x: number, y: number, r: number, fill: number, alpha = 1): void {
  g.fillStyle(fill, alpha);
  g.fillCircle(x, y, r);
}

export function flatRRC(g: G, x: number, y: number, w: number, h: number, r: number, fill: number, alpha = 1): void {
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
}

export function flatEllipse(g: G, x: number, y: number, w: number, h: number, fill: number, alpha = 1): void {
  g.fillStyle(fill, alpha);
  g.fillEllipse(x, y, w, h);
}

/** Traco de tinta (boca, sobrancelha, rachadura). */
export function inkLine(g: G, x1: number, y1: number, x2: number, y2: number, thick = 4, color = INK): void {
  g.lineStyle(thick, color, 1);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokePath();
}

/** Gera a textura e limpa o Graphics para reuso. */
export function bake(g: G, key: string, w: number, h: number, scene: Phaser.Scene): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  g.generateTexture(key, w, h);
  g.clear();
}
