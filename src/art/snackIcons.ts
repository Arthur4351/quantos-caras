import Phaser from 'phaser';
import { INK, WOOD, WOOD_DARK, GOLD, RED, GREEN, CYAN, PAPER, WHITE, ORANGE } from './palette';
import { inkCircle, inkEllipse, inkRRC, inkTri, flatCircle, flatEllipse, flatRRC } from './ink';

type G = Phaser.GameObjects.Graphics;

/**
 * O carrinho do cara do lanche. Icones desenhados, nao emoji: uma fatia de pizza
 * de gibi le em 0.2s e um "🍕" quebraria a direcao de arte inteira.
 *
 * Tudo centrado em (cx, cy) num quadrado de ~110px.
 */

/** Crescente (banana, casca de taco) com contorno de tinta. */
function crescent(g: G, cx: number, cy: number, outer: number, inner: number, a0: number, a1: number, fill: number): void {
  const shape = (ro: number, ri: number, color: number) => {
    const pts: Phaser.Geom.Point[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * ro, cy + Math.sin(a) * ro));
    }
    for (let i = steps; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri));
    }
    g.fillStyle(color, 1);
    g.fillPoints(pts, true);
  };
  shape(outer + 5, Math.max(2, inner - 5), INK);
  shape(outer, inner, fill);
}

export function drawSnack(g: G, id: string, cx = 0, cy = 0): void {
  if (id === 'burger') {
    inkEllipse(g, cx, cy - 22, 92, 54, WOOD);
    flatCircle(g, cx - 20, cy - 32, 4, PAPER);
    flatCircle(g, cx + 4, cy - 38, 4, PAPER);
    flatCircle(g, cx + 24, cy - 28, 4, PAPER);
    inkRRC(g, cx, cy + 2, 100, 16, 7, GREEN, 4);
    inkRRC(g, cx, cy + 18, 92, 20, 8, 0x7b3f22, 4);
    inkRRC(g, cx, cy + 38, 84, 22, 10, GOLD, 4);
    return;
  }
  if (id === 'pizza') {
    inkTri(g, [cx, cy - 46, cx - 44, cy + 34, cx + 44, cy + 34], GOLD);
    inkRRC(g, cx, cy + 34, 92, 18, 8, WOOD, 4);
    flatCircle(g, cx - 12, cy - 4, 9, RED);
    flatCircle(g, cx + 14, cy + 12, 9, RED);
    flatCircle(g, cx - 2, cy + 22, 8, RED);
    return;
  }
  if (id === 'energy') {
    inkRRC(g, cx, cy + 6, 56, 92, 14, CYAN);
    flatRRC(g, cx, cy - 30, 44, 12, 6, PAPER, 0.85);
    inkTri(g, [cx - 4, cy - 16, cx + 16, cy - 12, cx - 2, cy + 8], GOLD, 3);
    inkTri(g, [cx + 4, cy + 4, cx - 14, cy + 2, cx + 2, cy + 26], GOLD, 3);
    return;
  }
  if (id === 'coffee') {
    inkCircle(g, cx + 42, cy + 8, 16, PAPER, 5);
    inkRRC(g, cx - 6, cy + 12, 74, 74, 12, PAPER);
    flatEllipse(g, cx - 6, cy - 16, 62, 18, 0x5a3520);
    flatRRC(g, cx - 6, cy + 34, 62, 12, 5, WOOD_DARK, 0.5);
    flatCircle(g, cx - 20, cy - 42, 7, WHITE, 0.75);
    flatCircle(g, cx + 4, cy - 52, 9, WHITE, 0.6);
    return;
  }
  if (id === 'banana') {
    crescent(g, cx, cy - 16, 58, 44, 0.15, Math.PI - 0.15, GOLD);
    flatCircle(g, cx - 57, cy - 8, 6, 0x6b4a1e);
    flatCircle(g, cx + 57, cy - 8, 6, 0x6b4a1e);
    return;
  }
  if (id === 'taco') {
    crescent(g, cx, cy - 12, 56, 26, 0, Math.PI, GOLD);
    flatEllipse(g, cx - 16, cy + 4, 30, 16, GREEN);
    flatEllipse(g, cx + 14, cy + 8, 28, 16, RED);
    flatEllipse(g, cx, cy + 16, 26, 14, WHITE, 0.85);
    return;
  }
  // fallback: saco de papel generico
  inkRRC(g, cx, cy, 80, 92, 12, ORANGE);
  flatRRC(g, cx, cy - 34, 70, 16, 6, PAPER, 0.7);
}
