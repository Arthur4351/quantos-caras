import Phaser from 'phaser';
import dudesJson from '../data/dudes.json';
import { specFor } from './dudeSpecs';
import { drawDude, DUDE_W, DUDE_H, FOOT_ORIGIN_Y } from './drawDude';
import { ENEMY_ART } from './drawEnemy';
import { INK, WHITE, GOLD, GOLD_DARK, RED } from './palette';
import { bake, flatCircle, inkCircle, inkTri } from './ink';

export { FOOT_ORIGIN_Y, DUDE_W, DUDE_H };

export const dudeKey = (id: string) => `dude_${id}`;
export const enemyKey = (type: string) => `enemy_${type}`;

/** originY por tipo de inimigo (pes no chao). */
export const ENEMY_ORIGIN: Record<string, number> = {};
/** Altura em px do canvas de cada inimigo — usada para escalar sem distorcer. */
export const ENEMY_SIZE: Record<string, { w: number; h: number }> = {};

/**
 * Desenha TODAS as texturas do jogo proceduralmente no boot.
 * Nada de PNG externo: a direcao de arte vive no codigo e escala pra qualquer DPI.
 */
export function buildAllTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // ---- 42 dudes ----
  (dudesJson as any[]).forEach((d, i) => {
    const spec = specFor(d.id, d.family, d.role, i);
    drawDude(g, spec);
    bake(g, dudeKey(d.id), DUDE_W, DUDE_H, scene);
  });

  // ---- inimigos ----
  Object.entries(ENEMY_ART).forEach(([type, art]) => {
    art.draw(g);
    bake(g, enemyKey(type), art.w, art.h, scene);
    ENEMY_ORIGIN[type] = art.footY / art.h;
    ENEMY_SIZE[type] = { w: art.w, h: art.h };
  });

  // ---- sombra de contato (elipse suave chapada) ----
  flatCircle(g, 64, 64, 60, INK, 0.22);
  flatCircle(g, 64, 64, 44, INK, 0.16);
  bake(g, 'fx_shadow', 128, 128, scene);

  // ---- moeda ----
  inkCircle(g, 32, 32, 24, GOLD, 5);
  flatCircle(g, 32, 32, 15, GOLD_DARK);
  flatCircle(g, 26, 25, 5, WHITE, 0.75);
  bake(g, 'fx_coin', 64, 64, scene);

  // ---- estrela (rewards / raridade) ----
  star(g, 32, 34, 26, 12, GOLD);
  bake(g, 'fx_star', 64, 68, scene);

  // ---- faisca de impacto ----
  inkTri(g, [16, 4, 28, 24, 4, 24], WHITE, 0);
  flatCircle(g, 16, 16, 8, WHITE);
  bake(g, 'fx_spark', 32, 32, scene);

  // ---- nuvem de poeira ----
  flatCircle(g, 20, 26, 13, WHITE, 0.85);
  flatCircle(g, 36, 22, 17, WHITE, 0.85);
  flatCircle(g, 54, 27, 12, WHITE, 0.85);
  bake(g, 'fx_puff', 72, 44, scene);

  // ---- anel de choque (meteoro / impacto de area) ----
  g.lineStyle(14, INK, 1);
  g.strokeCircle(128, 128, 108);
  g.lineStyle(8, WHITE, 1);
  g.strokeCircle(128, 128, 108);
  g.lineStyle(5, RED, 0.9);
  g.strokeCircle(128, 128, 84);
  bake(g, 'fx_ring', 256, 256, scene);

  // ---- projetil: capsula de tinta com rastro claro ----
  g.fillStyle(INK, 1);
  g.fillRoundedRect(0, 4, 56, 24, 12);
  g.fillStyle(GOLD, 1);
  g.fillRoundedRect(5, 9, 46, 14, 7);
  g.fillStyle(WHITE, 0.85);
  g.fillRoundedRect(9, 12, 22, 6, 3);
  bake(g, 'fx_bolt', 56, 32, scene);

  // ---- nuvem de ceu (com contorno de tinta: nada nesta arte flutua sem linha) ----
  g.fillStyle(INK, 1);
  g.fillCircle(48, 46, 30);
  g.fillCircle(90, 38, 38);
  g.fillCircle(134, 48, 28);
  g.fillCircle(92, 60, 34);
  g.fillRect(48, 60, 86, 20);
  flatCircle(g, 48, 46, 24, WHITE);
  flatCircle(g, 90, 38, 32, WHITE);
  flatCircle(g, 134, 48, 22, WHITE);
  flatCircle(g, 92, 60, 28, WHITE);
  g.fillStyle(WHITE, 1);
  g.fillRect(48, 60, 86, 14);
  bake(g, 'bg_cloud', 176, 100, scene);

  buildFxTextures(g, scene);
  g.destroy();
}

/**
 * FX DE COMBATE. Tudo contornado a tinta como o resto da arte — uma particula
 * sem linha preta parece de outro jogo colada em cima deste.
 */
function buildFxTextures(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  // ---- estrela de impacto: o "POW" de gibi, o unico feedback que le a 40px ----
  g.fillStyle(INK, 1);
  spike(g, 40, 40, 38, 15, 10);
  g.fillStyle(WHITE, 1);
  spike(g, 40, 40, 30, 11, 10);
  g.fillStyle(GOLD, 1);
  spike(g, 40, 40, 17, 6, 10);
  bake(g, 'fx_burst', 80, 80, scene);

  // ---- arco de golpe: crescente grosso que sai do punho ----
  g.fillStyle(INK, 1);
  crescent(g, 6, 60, 56, 22, 44);
  g.fillStyle(WHITE, 0.96);
  crescent(g, 12, 54, 50, 21, 38);
  bake(g, 'fx_slash', 120, 120, scene);

  // ---- gota de sangue: pingo de tinta, nada realista ----
  g.fillStyle(0x7c1220, 1);
  g.fillCircle(14, 18, 12);
  g.fillTriangle(6, 12, 22, 12, 14, 0);
  g.fillStyle(RED, 1);
  g.fillCircle(14, 18, 8);
  g.fillTriangle(9, 13, 19, 13, 14, 4);
  g.fillStyle(0xff8f7a, 0.9);
  g.fillCircle(11, 15, 3);
  bake(g, 'fx_blood', 28, 32, scene);

  // ---- poca no chao: mancha irregular que fica de lembranca ----
  g.fillStyle(0x7c1220, 1);
  for (const [dx, dy, r] of [[26, 22, 20], [46, 18, 15], [62, 24, 12], [40, 30, 17], [16, 27, 11]]) {
    g.fillEllipse(dx, dy, r * 2, r * 1.25);
  }
  g.fillStyle(RED, 1);
  for (const [dx, dy, r] of [[28, 22, 14], [46, 19, 10], [58, 24, 7], [40, 28, 11]]) {
    g.fillEllipse(dx, dy, r * 2, r * 1.2);
  }
  bake(g, 'fx_splat', 84, 48, scene);
}

/** Poligono de N pontas alternando raio externo/interno. */
function spike(g: Phaser.GameObjects.Graphics, cx: number, cy: number, outer: number, inner: number, points: number): void {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

/** Crescente: arco grosso desenhado como leque de triangulos. */
function crescent(g: Phaser.GameObjects.Graphics, x0: number, cy: number, radius: number, thickness: number, spread: number): void {
  const steps = 26;
  const half = Phaser.Math.DegToRad(spread);
  for (let i = 0; i < steps; i++) {
    const a1 = -half + (2 * half * i) / steps;
    const a2 = -half + (2 * half * (i + 1)) / steps;
    const inner = radius - thickness;
    g.fillTriangle(
      x0 + Math.cos(a1) * radius, cy + Math.sin(a1) * radius,
      x0 + Math.cos(a2) * radius, cy + Math.sin(a2) * radius,
      x0 + Math.cos(a1) * inner, cy + Math.sin(a1) * inner
    );
    g.fillTriangle(
      x0 + Math.cos(a2) * radius, cy + Math.sin(a2) * radius,
      x0 + Math.cos(a2) * inner, cy + Math.sin(a2) * inner,
      x0 + Math.cos(a1) * inner, cy + Math.sin(a1) * inner
    );
  }
}

function star(g: Phaser.GameObjects.Graphics, cx: number, cy: number, outer: number, inner: number, fill: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.fillStyle(INK, 1);
  g.beginPath();
  g.moveTo(cx + Math.cos(-Math.PI / 2) * (outer + 5), cy + Math.sin(-Math.PI / 2) * (outer + 5));
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 === 0 ? outer : inner) + 5;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fillPath();
  g.fillStyle(fill, 1);
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillPath();
}
