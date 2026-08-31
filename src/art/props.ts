import Phaser from 'phaser';
import { Prop } from './dudeSpecs';
import { FaceGeom } from './face';
import { INK, WHITE, GOLD, GOLD_DARK, RED } from './palette';
import { inkCircle, inkEllipse, inkRRC, inkTri, flatCircle, flatRRC, flatEllipse, OUTLINE } from './ink';

type G = Phaser.GameObjects.Graphics;

/** Props que escondem o rosto — desenhados ANTES dos olhos. */
export const PROP_BEFORE_FACE: ReadonlySet<Prop> = new Set<Prop>(['greathelm', 'hood']);
/** Props transparentes — desenhados DEPOIS dos olhos. */
export const PROP_AFTER_FACE: ReadonlySet<Prop> = new Set<Prop>(['dome']);

export function drawProp(g: G, f: FaceGeom, prop: Prop, accent: number, skin: number): void {
  const top = f.cy - f.r;

  switch (prop) {
    case 'none':
      break;

    case 'helmet':
      inkEllipse(g, f.cx, f.cy - f.r * 0.45, f.r * 2.0, f.r * 1.3, accent);
      inkRRC(g, f.cx, f.cy - f.r * 0.06, f.r * 2.16, f.r * 0.28, f.r * 0.14, accent);
      inkRRC(g, f.cx, top - f.r * 0.42, f.r * 0.26, f.r * 0.72, f.r * 0.13, RED, 4);
      break;

    case 'greathelm':
      inkRRC(g, f.cx, f.cy - f.r * 0.14, f.r * 1.98, f.r * 2.02, f.r * 0.44, accent);
      flatRRC(g, f.cx, f.cy - f.r * 0.06, f.r * 1.42, f.r * 0.44, f.r * 0.1, INK);
      inkRRC(g, f.cx, top - f.r * 0.5, f.r * 0.3, f.r * 0.8, f.r * 0.15, GOLD, 4);
      break;

    case 'horns':
      inkTri(g, [f.cx - f.r * 0.86, top + f.r * 0.34, f.cx - f.r * 0.34, top + f.r * 0.2, f.cx - f.r * 1.16, top - f.r * 0.5], WHITE, 4);
      inkTri(g, [f.cx + f.r * 0.86, top + f.r * 0.34, f.cx + f.r * 0.34, top + f.r * 0.2, f.cx + f.r * 1.16, top - f.r * 0.5], WHITE, 4);
      break;

    case 'topknot':
      inkCircle(g, f.cx, top - f.r * 0.18, f.r * 0.26, INK, 4);
      inkRRC(g, f.cx, f.cy - f.r * 0.62, f.r * 1.9, f.r * 0.26, f.r * 0.1, accent, 4);
      break;

    case 'wizhat':
      inkTri(g, [f.cx - f.r * 0.92, top + f.r * 0.3, f.cx + f.r * 0.92, top + f.r * 0.3, f.cx + f.r * 0.2, top - f.r * 1.7], accent);
      inkEllipse(g, f.cx, top + f.r * 0.3, f.r * 2.5, f.r * 0.44, accent);
      flatRRC(g, f.cx, top + f.r * 0.12, f.r * 1.6, f.r * 0.24, 3, GOLD);
      flatCircle(g, f.cx + f.r * 0.2, top - f.r * 1.1, f.r * 0.13, GOLD);
      break;

    case 'crown':
      inkRRC(g, f.cx, top + f.r * 0.1, f.r * 1.7, f.r * 0.34, f.r * 0.1, GOLD);
      inkTri(g, [f.cx - f.r * 0.8, top + f.r * 0.06, f.cx - f.r * 0.3, top + f.r * 0.06, f.cx - f.r * 0.55, top - f.r * 0.52], GOLD, 4);
      inkTri(g, [f.cx - f.r * 0.25, top + f.r * 0.06, f.cx + f.r * 0.25, top + f.r * 0.06, f.cx, top - f.r * 0.72], GOLD, 4);
      inkTri(g, [f.cx + f.r * 0.3, top + f.r * 0.06, f.cx + f.r * 0.8, top + f.r * 0.06, f.cx + f.r * 0.55, top - f.r * 0.52], GOLD, 4);
      flatCircle(g, f.cx, top - f.r * 0.02, f.r * 0.1, RED);
      break;

    case 'cap':
      inkEllipse(g, f.cx, f.cy - f.r * 0.52, f.r * 1.92, f.r * 1.1, accent);
      inkRRC(g, f.cx + f.r * 0.62, f.cy - f.r * 0.34, f.r * 1.3, f.r * 0.24, f.r * 0.12, accent, 4);
      flatCircle(g, f.cx, f.cy - f.r * 1.02, f.r * 0.11, GOLD);
      break;

    case 'toque':
      inkRRC(g, f.cx, f.cy - f.r * 0.72, f.r * 1.6, f.r * 0.9, f.r * 0.16, WHITE);
      inkCircle(g, f.cx - f.r * 0.5, f.cy - f.r * 1.24, f.r * 0.4, WHITE, 4);
      inkCircle(g, f.cx + f.r * 0.5, f.cy - f.r * 1.24, f.r * 0.4, WHITE, 4);
      inkCircle(g, f.cx, f.cy - f.r * 1.44, f.r * 0.46, WHITE, 4);
      break;
    case 'dome': {
      // Capacete de vidro — desenhado por cima do rosto.
      flatCircle(g, f.cx, f.cy - f.r * 0.06, f.r * 1.2, 0xd8f4ff, 0.28);
      g.lineStyle(OUTLINE, INK, 1);
      g.strokeCircle(f.cx, f.cy - f.r * 0.06, f.r * 1.2);
      g.lineStyle(4, WHITE, 0.75);
      g.beginPath();
      g.arc(f.cx, f.cy - f.r * 0.06, f.r * 0.95, Math.PI * 1.15, Math.PI * 1.55);
      g.strokePath();
      inkRRC(g, f.cx, f.cy + f.r * 1.02, f.r * 1.7, f.r * 0.3, f.r * 0.14, accent, 4);
      break;
    }

    case 'antenna':
      g.lineStyle(5, INK, 1);
      g.beginPath();
      g.moveTo(f.cx - f.r * 0.4, top + f.r * 0.1);
      g.lineTo(f.cx - f.r * 0.62, top - f.r * 0.62);
      g.moveTo(f.cx + f.r * 0.4, top + f.r * 0.1);
      g.lineTo(f.cx + f.r * 0.62, top - f.r * 0.62);
      g.strokePath();
      inkCircle(g, f.cx - f.r * 0.62, top - f.r * 0.68, f.r * 0.16, accent, 3);
      inkCircle(g, f.cx + f.r * 0.62, top - f.r * 0.68, f.r * 0.16, accent, 3);
      break;

    case 'bandana':
      inkRRC(g, f.cx, f.cy - f.r * 0.52, f.r * 2.04, f.r * 0.42, f.r * 0.1, accent, 4);
      inkTri(g, [f.cx + f.r * 0.9, f.cy - f.r * 0.66, f.cx + f.r * 0.9, f.cy - f.r * 0.3, f.cx + f.r * 1.6, f.cy - f.r * 0.1], accent, 3);
      break;

    case 'headband':
      inkRRC(g, f.cx, f.cy - f.r * 0.56, f.r * 2.06, f.r * 0.3, f.r * 0.08, accent, 4);
      inkTri(g, [f.cx - f.r * 0.9, f.cy - f.r * 0.68, f.cx - f.r * 0.9, f.cy - f.r * 0.4, f.cx - f.r * 1.7, f.cy - f.r * 0.05], accent, 3);
      break;

    case 'brim':
      inkEllipse(g, f.cx, f.cy - f.r * 0.5, f.r * 2.7, f.r * 0.5, accent);
      inkRRC(g, f.cx, f.cy - f.r * 0.92, f.r * 1.4, f.r * 0.78, f.r * 0.16, accent);
      flatRRC(g, f.cx, f.cy - f.r * 0.62, f.r * 1.45, f.r * 0.22, 2, INK);
      break;

    case 'tricorn':
      inkEllipse(g, f.cx, f.cy - f.r * 0.56, f.r * 2.8, f.r * 0.56, INK);
      inkTri(g, [f.cx - f.r * 1.1, f.cy - f.r * 0.6, f.cx + f.r * 1.1, f.cy - f.r * 0.6, f.cx, f.cy - f.r * 1.5], INK, 4);
      flatCircle(g, f.cx, f.cy - f.r * 0.86, f.r * 0.2, WHITE);
      flatCircle(g, f.cx - f.r * 0.08, f.cy - f.r * 0.9, f.r * 0.05, INK);
      flatCircle(g, f.cx + f.r * 0.08, f.cy - f.r * 0.9, f.r * 0.05, INK);
      break;
    case 'hood':
      // Capuz — desenhado depois da cabeca, antes do rosto.
      inkCircle(g, f.cx, f.cy - f.r * 0.16, f.r * 1.16, accent);
      flatCircle(g, f.cx, f.cy + f.r * 0.14, f.r * 0.8, skin);
      flatEllipse(g, f.cx, f.cy - f.r * 0.02, f.r * 1.5, f.r * 0.5, accent);
      flatCircle(g, f.cx, f.cy + f.r * 0.2, f.r * 0.74, skin);
      break;

    case 'halo':
      g.lineStyle(OUTLINE + 1, GOLD_DARK, 1);
      g.strokeEllipse(f.cx, top - f.r * 0.5, f.r * 1.5, f.r * 0.42);
      g.lineStyle(3, WHITE, 0.9);
      g.strokeEllipse(f.cx, top - f.r * 0.52, f.r * 1.4, f.r * 0.34);
      break;

    case 'laurel':
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (1.12 + i * 0.13);
        flatCircle(g, f.cx + Math.cos(a) * f.r * 1.02, f.cy + Math.sin(a) * f.r * 1.02, f.r * 0.13, 0x4ec95a);
        const b = Math.PI * (1.88 - i * 0.13);
        flatCircle(g, f.cx + Math.cos(b) * f.r * 1.02, f.cy + Math.sin(b) * f.r * 1.02, f.r * 0.13, 0x4ec95a);
      }
      break;

    case 'mohawk':
      for (let i = -2; i <= 2; i++) {
        const h = f.r * (0.62 - Math.abs(i) * 0.12);
        inkTri(g, [f.cx + i * f.r * 0.24 - f.r * 0.11, top + f.r * 0.18, f.cx + i * f.r * 0.24 + f.r * 0.11, top + f.r * 0.18, f.cx + i * f.r * 0.24, top - h], accent, 3);
      }
      break;
  }
}
