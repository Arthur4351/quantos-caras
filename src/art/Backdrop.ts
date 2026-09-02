import Phaser from 'phaser';
import {
  INK, SKY, SKY_LOW, HILL, HILL_FAR, GRASS, GRASS_DARK, GRASS_LIGHT,
  DIRT, DIRT_DARK, WOOD, WOOD_DARK, GOLD, WHITE
} from './palette';
import { OUTLINE } from './ink';
import { shapeTexture } from './bakery';

export interface RanchOpts {
  /** Linha do horizonte em px (virtual 1080). */
  horizon?: number;
  /** Desenha a arena de terra batida. */
  arena?: boolean;
  arenaY?: number;
  arenaW?: number;
  arenaH?: number;
  /**
   * `ellipse` e o picadeiro pequeno das telas de menu/loja. `field` e o CORRAL
   * inteiro: um retangulo arredondado de terra que ocupa o campo todo, porque
   * uma horda de 280 bichos em bloco nao cabe numa elipse — sobrava tropa na
   * grama e nos cantos.
   */
  shape?: 'ellipse' | 'field';
  /** Nuvens animadas. */
  clouds?: boolean;
}

/**
 * O Dude Ranch. Ceu chapado em bandas, colinas, campo, cerca de madeira e
 * arena de terra. Zero gradiente: cada faixa e uma cor solida.
 *
 * Tudo isso e ASSADO numa unica textura de tela cheia. Sao ~130 formas
 * (tufos, postes, marcas de pisada) — mante-las num Graphics vivo custaria
 * uma re-tesselacao completa por frame.
 */
export function buildRanch(scene: Phaser.Scene, o: RanchOpts = {}): void {
  const W = 1920, H = 1080;
  const horizon = o.horizon ?? 430;
  const arena = o.arena !== false;
  const ay = o.arenaY ?? 700, aw = o.arenaW ?? 1620, ah = o.arenaH ?? 560;
  const shape = o.shape ?? 'ellipse';
  const key = `bg_ranch_${horizon}_${arena ? `${shape}${ay}x${aw}x${ah}` : 'flat'}`;

  shapeTexture(scene, key, W, H, g => paintRanch(g, horizon, arena, ay, aw, ah, shape), false);
  scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-100);

  if (o.clouds !== false) addClouds(scene, horizon);
}

function paintRanch(
  g: Phaser.GameObjects.Graphics, horizon: number,
  arena: boolean, ay: number, aw: number, ah: number,
  shape: 'ellipse' | 'field' = 'ellipse'
): void {
  const W = 1920, H = 1080;

  // ---- Ceu em duas bandas chapadas ----
  g.fillStyle(SKY, 1);
  g.fillRect(0, 0, W, horizon * 0.62);
  g.fillStyle(SKY_LOW, 1);
  g.fillRect(0, horizon * 0.62, W, horizon - horizon * 0.62 + 4);

  // ---- Sol: circulo chapado com contorno de tinta, igual a todo o resto ----
  g.fillStyle(INK, 1);
  g.fillCircle(1660, 150, 76 + OUTLINE);
  g.fillStyle(GOLD, 1);
  g.fillCircle(1660, 150, 76);
  g.fillStyle(WHITE, 0.3);
  g.fillCircle(1636, 126, 26);

  // ---- Colinas distantes ----
  g.fillStyle(HILL_FAR, 1);
  g.fillEllipse(340, horizon + 40, 900, 300);
  g.fillEllipse(1560, horizon + 46, 1000, 320);
  g.fillStyle(HILL, 1);
  g.fillEllipse(960, horizon + 54, 1300, 300);

  // ---- Campo ----
  g.fillStyle(INK, 1);
  g.fillRect(0, horizon - 6, W, 10);
  g.fillStyle(GRASS_DARK, 1);
  g.fillRect(0, horizon, W, 70);
  g.fillStyle(GRASS, 1);
  g.fillRect(0, horizon + 64, W, H - horizon);

  // ---- Tufos de grama (perspectiva por tamanho) ----
  const rng = new Phaser.Math.RandomDataGenerator(['dude-ranch']);
  for (let i = 0; i < 90; i++) {
    const y = horizon + 80 + rng.frac() * (H - horizon - 90);
    const x = rng.frac() * W;
    const s = 7 + ((y - horizon) / (H - horizon)) * 18;
    g.fillStyle(rng.frac() > 0.5 ? GRASS_LIGHT : GRASS_DARK, 1);
    // tufo de 3 laminas em vez de um triangulo solitario — le melhor de longe
    g.fillTriangle(x - s * 0.5, y, x - s * 0.05, y, x - s * 0.34, y - s * 0.66);
    g.fillTriangle(x - s * 0.22, y, x + s * 0.22, y, x, y - s);
    g.fillTriangle(x + s * 0.05, y, x + s * 0.5, y, x + s * 0.34, y - s * 0.6);
  }

  // ---- Cerca de madeira no horizonte ----
  drawFence(g, horizon);

  // ---- Arena de terra ----
  if (arena) {
    const ax = 960;
    if (shape === 'field') paintCorral(g, rng, ax, ay, aw, ah);
    else paintRing(g, rng, ax, ay, aw, ah);
  }
}

/** Picadeiro: elipse de terra. Serve menu e loja, onde ha 1 ou 2 caras posando. */
function paintRing(
  g: Phaser.GameObjects.Graphics, rng: Phaser.Math.RandomDataGenerator,
  ax: number, ay: number, aw: number, ah: number
): void {
  g.fillStyle(INK, 1);
  g.fillEllipse(ax, ay, aw + OUTLINE * 2, ah + OUTLINE * 2);
  g.fillStyle(DIRT_DARK, 1);
  g.fillEllipse(ax, ay, aw, ah);
  g.fillStyle(DIRT, 1);
  g.fillEllipse(ax, ay - 8, aw - 34, ah - 40);
  for (let i = 0; i < 26; i++) {
    const a = rng.frac() * Math.PI * 2;
    const rr = Math.sqrt(rng.frac());
    g.fillStyle(DIRT_DARK, 0.55);
    g.fillEllipse(ax + Math.cos(a) * rr * (aw / 2 - 60), ay - 8 + Math.sin(a) * rr * (ah / 2 - 50), 26, 12);
  }
}

/**
 * O CORRAL da batalha: retangulo de terra arredondado que cobre o campo todo,
 * com moldura de grama. Uma horda de 280 bichos e um BLOCO retangular — numa
 * elipse os cantos sobravam na grama e a tropa da direita saia da tela.
 */
function paintCorral(
  g: Phaser.GameObjects.Graphics, rng: Phaser.Math.RandomDataGenerator,
  ax: number, ay: number, aw: number, ah: number
): void {
  const x = ax - aw / 2, y = ay - ah / 2;
  const r = 108;
  g.fillStyle(INK, 1);
  g.fillRoundedRect(x - OUTLINE, y - OUTLINE, aw + OUTLINE * 2, ah + OUTLINE * 2, r + OUTLINE);
  g.fillStyle(DIRT_DARK, 1);
  g.fillRoundedRect(x, y, aw, ah, r);
  g.fillStyle(DIRT, 1);
  g.fillRoundedRect(x + 16, y + 14, aw - 32, ah - 40, r - 22);

  // pisadas: manchas mais escuras espalhadas pelo chao batido
  for (let i = 0; i < 54; i++) {
    const px = x + 60 + rng.frac() * (aw - 120);
    const py = y + 50 + rng.frac() * (ah - 110);
    g.fillStyle(DIRT_DARK, 0.5);
    g.fillEllipse(px, py, 22 + rng.frac() * 26, 10 + rng.frac() * 8);
  }
  // trilha de gado no fundo do corral, so pra terra nao ficar chapada demais
  g.fillStyle(DIRT_DARK, 0.34);
  g.fillRect(x + 40, y + ah * 0.26, aw - 80, 12);
}

function drawFence(g: Phaser.GameObjects.Graphics, horizon: number): void {
  const top = horizon - 46;
  // travessas
  for (const ry of [top + 12, top + 30]) {
    g.fillStyle(INK, 1);
    g.fillRect(-4, ry - 4, 1928, 18);
    g.fillStyle(WOOD, 1);
    g.fillRect(0, ry, 1920, 10);
  }
  // postes
  for (let x = 40; x < 1920; x += 190) {
    g.fillStyle(INK, 1);
    g.fillRect(x - 4, top - 4, 24, 66);
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(x, top, 16, 58);
  }
}

function addClouds(scene: Phaser.Scene, horizon: number): void {
  // Visual regression captures use a deterministic still frame; the live game keeps motion.
  if ((globalThis as any).__visualTest) return;
  if (!scene.textures.exists('bg_cloud')) return;
  /**
   * Todas as nuvens vivem ABAIXO da faixa do HUD (y > 168). Elas atravessam a
   * tela inteira, entao spot alto = nuvem passando atras do pill de WAVE e do
   * contador de ouro — o ceu embaixo do HUD e o unico lugar limpo.
   */
  const spots = [
    { x: 220, y: 182, s: 1.15, sp: 34000 },
    { x: 700, y: 224, s: 0.9, sp: 46000 },
    { x: 1180, y: 196, s: 1.3, sp: 52000 },
    { x: 1520, y: 236, s: 0.8, sp: 40000 }
  ];
  spots.forEach(c => {
    const y = Math.max(168, Math.min(c.y, horizon - 86));
    const img = scene.add.image(c.x, y, 'bg_cloud')
      .setScale(c.s).setDepth(-95).setAlpha(0.95);
    scene.tweens.add({
      targets: img, x: c.x + 2400, duration: c.sp, repeat: -1,
      onRepeat: () => { img.x = -300; }
    });
  });
}
