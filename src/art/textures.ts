import Phaser from 'phaser';
import dudesJson from '../data/dudes.json';
import { specFor } from './dudeSpecs';
import { drawDude, DUDE_W, DUDE_H, FOOT_ORIGIN_Y } from './drawDude';
import { ENEMY_ART } from './drawEnemy';
import { INK, WHITE, GOLD, GOLD_DARK, RED, ORANGE, GREEN, PURPLE } from './palette';
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

  buildTraitTextures(g, scene);
}

/**
 * O VOCABULARIO DOS TRACOS DE ASSINATURA.
 *
 * Cada traco dos 42 caras tem que se ANUNCIAR na tela — senao o jogador ve
 * numeros diferentes e conclui que todo mundo faz a mesma coisa. Oito simbolos
 * chapados cobrem o elenco inteiro: fogo, gelo, escudo, raiz, cruz de cura,
 * caveira de maldicao, nota de musica e zigue-zague de energia. Todos contornados
 * a tinta e legiveis a 24px, que e o tamanho que eles tem no meio da multidao.
 */
function buildTraitTextures(g: Phaser.GameObjects.Graphics, scene: Phaser.Scene): void {
  // ---- LINGUA DE FOGO: tres bicos de chama, do escuro pro claro ----
  flame(g, 24, 46, 22, 44, INK);
  flame(g, 24, 44, 17, 36, RED);
  flame(g, 24, 42, 12, 26, ORANGE);
  flame(g, 24, 40, 6, 15, GOLD);
  bake(g, 'fx_flame', 48, 56, scene);

  // ---- CRISTAL DE GELO: losango de seis pontas, sem curva nenhuma ----
  shard(g, 24, 24, 23, INK);
  shard(g, 24, 24, 17, 0x2f8fd6);
  shard(g, 24, 24, 10, 0xcdf2ff);
  bake(g, 'fx_ice', 48, 48, scene);

  // ---- BROQUEL: escudinho de ponta, o sinal de absorcao ----
  shield(g, 26, 4, 44, INK, 0);
  shield(g, 26, 9, 34, 0x2f8fd6, 0);
  shield(g, 26, 13, 24, 0xcdf2ff, 0);
  bake(g, 'fx_shield', 52, 56, scene);

  // ---- RAIZ: garra de tres espinhos saindo do chao ----
  g.fillStyle(INK, 1);
  thorn(g, 26, 44, -16, -40, 11);
  thorn(g, 26, 44, 0, -46, 12);
  thorn(g, 26, 44, 16, -40, 11);
  g.fillStyle(0x4d9d27, 1);
  thorn(g, 26, 42, -15, -34, 7);
  thorn(g, 26, 42, 0, -39, 8);
  thorn(g, 26, 42, 15, -34, 7);
  bake(g, 'fx_root', 52, 52, scene);

  // ---- CRUZ DE CURA ----
  g.fillStyle(INK, 1);
  g.fillRoundedRect(2, 15, 44, 18, 6);
  g.fillRoundedRect(15, 2, 18, 44, 6);
  g.fillStyle(GREEN, 1);
  g.fillRoundedRect(6, 19, 36, 10, 4);
  g.fillRoundedRect(19, 6, 10, 36, 4);
  bake(g, 'fx_plus', 48, 48, scene);

  // ---- CAVEIRA DE MALDICAO: silhueta, dois furos e dentes ----
  g.fillStyle(INK, 1);
  g.fillRoundedRect(3, 3, 42, 38, 15);
  g.fillRoundedRect(13, 36, 22, 12, 5);
  g.fillStyle(PURPLE, 1);
  g.fillRoundedRect(7, 7, 34, 31, 12);
  g.fillRoundedRect(16, 34, 16, 10, 4);
  g.fillStyle(INK, 1);
  g.fillEllipse(17, 21, 12, 14);
  g.fillEllipse(31, 21, 12, 14);
  g.fillRect(21, 38, 3, 6);
  g.fillRect(26, 38, 3, 6);
  bake(g, 'fx_skull', 48, 50, scene);

  // ---- NOTA DE MUSICA: cabeca e haste, nada mais ----
  g.fillStyle(INK, 1);
  g.fillEllipse(17, 39, 30, 24);
  g.fillRect(28, 4, 10, 36);
  g.fillRect(28, 4, 18, 10);
  g.fillStyle(GOLD, 1);
  g.fillEllipse(17, 39, 20, 15);
  g.fillRect(30, 7, 5, 30);
  bake(g, 'fx_note', 48, 52, scene);

  // ---- ZIGUE-ZAGUE: energia, virus, laser ----
  g.fillStyle(INK, 1);
  zig(g, 1);
  g.fillStyle(0x7ef0ff, 1);
  zig(g, 0.72);
  bake(g, 'fx_zap', 40, 64, scene);
}

/** Chama: bico curvo desenhado como leque de triangulos a partir da base. */
function flame(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, w: number, h: number, fill: number): void {
  g.fillStyle(fill, 1);
  const steps = 10;
  let px = cx - w, py = baseY;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // largura fecha em bico; o topo cai um pouco pra um lado (chama nunca e reta)
    const half = w * (1 - t) * (1 - t * 0.35);
    const y = baseY - h * t;
    const x = cx - half + Math.sin(t * Math.PI) * w * 0.22;
    g.fillTriangle(px, py, x, y, cx + half + Math.sin(t * Math.PI) * w * 0.22, y);
    g.fillTriangle(px, py, cx + w * (1 - (i - 1) / steps), py, cx + half, y);
    px = x; py = y;
  }
}

/** Cristal de seis pontas — duas barras cruzadas e um losango no meio. */
function shard(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, fill: number): void {
  g.fillStyle(fill, 1);
  for (let i = 0; i < 3; i++) {
    const a = (Math.PI / 3) * i;
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    const nx = -Math.sin(a) * r * 0.26, ny = Math.cos(a) * r * 0.26;
    g.fillTriangle(cx + dx, cy + dy, cx + nx, cy + ny, cx - nx, cy - ny);
    g.fillTriangle(cx - dx, cy - dy, cx + nx, cy + ny, cx - nx, cy - ny);
  }
}

/** Escudo de ponta: retangulo arredondado no topo + bico embaixo. */
function shield(g: Phaser.GameObjects.Graphics, cx: number, top: number, w: number, fill: number, _o: number): void {
  const h = w * 0.82;
  g.fillStyle(fill, 1);
  g.fillRoundedRect(cx - w / 2, top, w, h * 0.72, w * 0.18);
  g.fillTriangle(cx - w / 2, top + h * 0.6, cx + w / 2, top + h * 0.6, cx, top + h * 1.16);
}

/** Espinho: triangulo fino da base ate a ponta. */
function thorn(g: Phaser.GameObjects.Graphics, x: number, y: number, dx: number, dy: number, w: number): void {
  g.fillTriangle(x - w / 2, y, x + w / 2, y, x + dx, y + dy);
}

/** Raio em zigue-zague. `k` encolhe o poligono no centro para virar contorno. */
function zig(g: Phaser.GameObjects.Graphics, k: number): void {
  const pts = [[27, 2], [8, 33], [19, 33], [13, 62], [32, 27], [21, 27]];
  const cx = 20, cy = 32;
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = cx + (pts[i][0] - cx) * k;
    const y = cy + (pts[i][1] - cy) * k;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
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
