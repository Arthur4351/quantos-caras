import Phaser from 'phaser';
import { Eyes } from './dudeSpecs';
import { INK, WHITE } from './palette';
import { flatCircle, flatRRC, inkLine, OUTLINE } from './ink';

type G = Phaser.GameObjects.Graphics;

export interface FaceGeom { cx: number; cy: number; r: number; }

/** Olhos: a personalidade inteira do dude sai daqui. */
export function drawEyes(g: G, f: FaceGeom, kind: Eyes, accent: number): void {
  const dx = f.r * 0.38;
  const ey = f.cy - f.r * 0.08;
  const lx = f.cx - dx, rx = f.cx + dx;

  switch (kind) {
    case 'dots':
      flatCircle(g, lx, ey, f.r * 0.17, INK);
      flatCircle(g, rx, ey, f.r * 0.17, INK);
      break;

    case 'wide':
      flatCircle(g, lx, ey, f.r * 0.29, WHITE);
      flatCircle(g, rx, ey, f.r * 0.29, WHITE);
      flatCircle(g, lx, ey + 1, f.r * 0.15, INK);
      flatCircle(g, rx, ey + 1, f.r * 0.15, INK);
      break;

    case 'angry':
      flatCircle(g, lx, ey + 2, f.r * 0.26, WHITE);
      flatCircle(g, rx, ey + 2, f.r * 0.26, WHITE);
      flatCircle(g, lx, ey + 3, f.r * 0.14, INK);
      flatCircle(g, rx, ey + 3, f.r * 0.14, INK);
      // sobrancelhas em V
      inkLine(g, lx - f.r * 0.3, ey - f.r * 0.32, lx + f.r * 0.22, ey - f.r * 0.1, 5);
      inkLine(g, rx + f.r * 0.3, ey - f.r * 0.32, rx - f.r * 0.22, ey - f.r * 0.1, 5);
      break;

    case 'glow':
      flatCircle(g, lx, ey, f.r * 0.3, accent, 0.35);
      flatCircle(g, rx, ey, f.r * 0.3, accent, 0.35);
      flatCircle(g, lx, ey, f.r * 0.18, accent);
      flatCircle(g, rx, ey, f.r * 0.18, accent);
      flatCircle(g, lx, ey, f.r * 0.08, WHITE);
      flatCircle(g, rx, ey, f.r * 0.08, WHITE);
      break;

    case 'hollow':
      flatCircle(g, lx, ey, f.r * 0.26, INK);
      flatCircle(g, rx, ey, f.r * 0.26, INK);
      break;

    case 'shades':
      g.fillStyle(INK, 1);
      g.fillRoundedRect(f.cx - f.r * 0.82, ey - f.r * 0.28, f.r * 1.64, f.r * 0.52, f.r * 0.2);
      flatRRC(g, lx - 1, ey - f.r * 0.1, f.r * 0.24, f.r * 0.1, 2, WHITE, 0.7);
      break;

    case 'visor':
      g.fillStyle(INK, 1);
      g.fillRoundedRect(f.cx - f.r * 0.9 - OUTLINE / 2, ey - f.r * 0.3 - OUTLINE / 2, f.r * 1.8 + OUTLINE, f.r * 0.6 + OUTLINE, f.r * 0.24);
      g.fillStyle(accent, 1);
      g.fillRoundedRect(f.cx - f.r * 0.9, ey - f.r * 0.3, f.r * 1.8, f.r * 0.6, f.r * 0.2);
      flatRRC(g, f.cx - f.r * 0.4, ey - f.r * 0.12, f.r * 0.5, f.r * 0.12, 2, WHITE, 0.8);
      break;

    case 'happy':
      g.lineStyle(5, INK, 1);
      g.beginPath();
      g.arc(lx, ey + f.r * 0.12, f.r * 0.22, Math.PI * 1.15, Math.PI * 1.85);
      g.strokePath();
      g.beginPath();
      g.arc(rx, ey + f.r * 0.12, f.r * 0.22, Math.PI * 1.15, Math.PI * 1.85);
      g.strokePath();
      break;

    case 'spiral':
      flatCircle(g, lx, ey, f.r * 0.26, WHITE);
      flatCircle(g, rx, ey, f.r * 0.26, WHITE);
      flatCircle(g, lx, ey, f.r * 0.12, INK);
      flatCircle(g, rx, ey, f.r * 0.12, INK);
      break;
  }
}

/** Boca coerente com a expressao dos olhos. */
export function drawMouth(g: G, f: FaceGeom, kind: Eyes): void {
  const my = f.cy + f.r * 0.42;
  g.lineStyle(5, INK, 1);
  if (kind === 'happy' || kind === 'wide') {
    g.beginPath();
    g.arc(f.cx, my - f.r * 0.12, f.r * 0.34, Math.PI * 0.15, Math.PI * 0.85);
    g.strokePath();
  } else if (kind === 'angry') {
    g.beginPath();
    g.arc(f.cx, my + f.r * 0.28, f.r * 0.3, Math.PI * 1.2, Math.PI * 1.8);
    g.strokePath();
  } else if (kind === 'hollow' || kind === 'glow') {
    // boca cerrada de tinta
    flatRRC(g, f.cx, my, f.r * 0.5, f.r * 0.14, 3, INK);
  } else {
    inkLine(g, f.cx - f.r * 0.2, my, f.cx + f.r * 0.2, my, 5);
  }
}

/** Presas de vampiro. */
export function drawFangs(g: G, f: FaceGeom): void {
  const my = f.cy + f.r * 0.48;
  g.fillStyle(WHITE, 1);
  g.fillTriangle(f.cx - f.r * 0.22, my, f.cx - f.r * 0.06, my, f.cx - f.r * 0.14, my + f.r * 0.24);
  g.fillTriangle(f.cx + f.r * 0.06, my, f.cx + f.r * 0.22, my, f.cx + f.r * 0.14, my + f.r * 0.24);
}
