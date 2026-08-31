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
  const key = `bg_ranch_${horizon}_${arena ? `${ay}x${aw}x${ah}` : 'flat'}`;

  shapeTexture(scene, key, W, H, g => paintRanch(g, horizon, arena, ay, aw, ah), false);
  scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-100);

  if (o.clouds !== false) addClouds(scene, horizon);
}

function paintRanch(
  g: Phaser.GameObjects.Graphics, horizon: number,
  arena: boolean, ay: number, aw: number, ah: number
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
  const spots = [
    { x: 220, y: 110, s: 1.5, sp: 34000 },
    { x: 700, y: 190, s: 1.0, sp: 46000 },
    { x: 1180, y: 96, s: 1.8, sp: 52000 },
    { x: 1520, y: 240, s: 0.85, sp: 40000 }
  ];
  spots.forEach(c => {
    const img = scene.add.image(c.x, Math.min(c.y, horizon - 90), 'bg_cloud')
      .setScale(c.s).setDepth(-95).setAlpha(0.95);
    scene.tweens.add({
      targets: img, x: c.x + 2400, duration: c.sp, repeat: -1,
      onRepeat: () => { img.x = -300; }
    });
  });
}
