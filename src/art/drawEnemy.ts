import Phaser from 'phaser';
import { INK, WHITE, GOLD, GOLD_DARK, RED } from './palette';
import { inkCircle, inkEllipse, inkRRC, inkTri, flatCircle, flatRRC, flatEllipse, inkLine, OUTLINE } from './ink';

type G = Phaser.GameObjects.Graphics;

export interface EnemyArt {
  w: number;
  h: number;
  /** Linha do chao dentro do canvas — vira originY. */
  footY: number;
  draw: (g: G) => void;
}

// ---------------------------------------------------------------- TODDLER
const toddler: EnemyArt = {
  w: 104, h: 116, footY: 110,
  draw(g) {
    const cx = 52;
    const headCy = 42, headR = 30;
    // pernas gordinhas
    inkRRC(g, cx - 13, 94, 15, 24, 7, 0xf9b9c4);
    inkRRC(g, cx + 13, 94, 15, 24, 7, 0xf9b9c4);
    // fralda
    inkRRC(g, cx, 84, 46, 26, 12, WHITE);
    // bracos curtinhos
    inkCircle(g, cx - 27, 76, 9, 0xf9b9c4, 4);
    inkCircle(g, cx + 27, 76, 9, 0xf9b9c4, 4);
    // corpo (macacao)
    inkRRC(g, cx, 74, 42, 30, 14, 0xf47a9b);
    // cabeca enorme
    inkCircle(g, cx, headCy, headR, 0xffd2be);
    // topete
    inkTri(g, [cx - 8, headCy - headR + 4, cx + 8, headCy - headR + 4, cx + 2, headCy - headR - 16], 0x8a5a2b, 3);
    // olhos gigantes de bebe
    flatCircle(g, cx - 11, headCy - 1, 9, WHITE);
    flatCircle(g, cx + 11, headCy - 1, 9, WHITE);
    flatCircle(g, cx - 10, headCy + 1, 5, INK);
    flatCircle(g, cx + 12, headCy + 1, 5, INK);
    // bochechas
    flatCircle(g, cx - 21, headCy + 11, 6, 0xf47a9b, 0.55);
    flatCircle(g, cx + 21, headCy + 11, 6, 0xf47a9b, 0.55);
    // boca berrando
    inkEllipse(g, cx, headCy + 17, 16, 12, 0x8c2b3a, 3);
  }
};

// ---------------------------------------------------------------- WOLF
const wolf: EnemyArt = {
  w: 168, h: 116, footY: 110,
  draw(g) {
    const bodyCx = 78, bodyCy = 62;
    // cauda
    inkTri(g, [bodyCx + 40, bodyCy - 4, bodyCx + 44, bodyCy + 14, bodyCx + 82, bodyCy - 30], 0x7c8794, 4);
    // patas traseiras
    inkRRC(g, bodyCx + 24, 90, 14, 32, 6, 0x616b77);
    inkRRC(g, bodyCx + 6, 92, 14, 30, 6, 0x7c8794);
    // patas dianteiras
    inkRRC(g, bodyCx - 26, 90, 14, 32, 6, 0x616b77);
    inkRRC(g, bodyCx - 42, 92, 14, 30, 6, 0x7c8794);
    // tronco
    inkEllipse(g, bodyCx, bodyCy, 108, 52, 0x8c97a4);
    // barriga clara
    flatEllipse(g, bodyCx, bodyCy + 14, 78, 22, WHITE, 0.35);
    // cabeca
    const hx = bodyCx - 56, hy = bodyCy - 14;
    inkCircle(g, hx, hy, 26, 0x8c97a4);
    // orelhas
    inkTri(g, [hx - 4, hy - 22, hx + 12, hy - 22, hx + 2, hy - 46], 0x616b77, 3);
    inkTri(g, [hx - 22, hy - 18, hx - 8, hy - 24, hx - 22, hy - 44], 0x616b77, 3);
    // focinho
    inkRRC(g, hx - 30, hy + 8, 34, 18, 8, 0x9fa9b5);
    flatCircle(g, hx - 44, hy + 9, 6, INK);
    // olho raivoso
    flatCircle(g, hx + 2, hy - 4, 7, 0xffc42e);
    flatCircle(g, hx + 3, hy - 4, 3.5, INK);
    inkLine(g, hx - 8, hy - 15, hx + 11, hy - 9, 5);
    // dentes
    g.fillStyle(WHITE, 1);
    g.fillTriangle(hx - 34, hy + 16, hx - 26, hy + 16, hx - 30, hy + 26);
    g.fillTriangle(hx - 24, hy + 16, hx - 16, hy + 16, hx - 20, hy + 25);
  }
};
// ---------------------------------------------------------------- GORILLA
const gorilla: EnemyArt = {
  w: 260, h: 268, footY: 258,
  draw(g) {
    const cx = 130;
    const DARK = 0x2f3038, MID = 0x44464f, FACE = 0x6b5044;
    // pernas curtas e grossas
    inkRRC(g, cx - 44, 226, 46, 50, 20, DARK);
    inkRRC(g, cx + 44, 226, 46, 50, 20, DARK);
    // pes
    flatEllipse(g, cx - 46, 250, 60, 26, INK);
    flatEllipse(g, cx + 46, 250, 60, 26, INK);
    // bracos gigantes que chegam ao chao
    inkRRC(g, cx - 96, 168, 48, 130, 24, MID);
    inkRRC(g, cx + 96, 168, 48, 130, 24, MID);
    inkCircle(g, cx - 96, 232, 30, DARK, 5);
    inkCircle(g, cx + 96, 232, 30, DARK, 5);
    // tronco em barril
    inkRRC(g, cx, 168, 148, 128, 56, DARK);
    // peitoral claro
    flatEllipse(g, cx, 176, 96, 92, MID);
    // cabeca
    const hy = 76;
    inkEllipse(g, cx, hy, 132, 116, DARK);
    // crista
    inkEllipse(g, cx, hy - 50, 68, 34, DARK, 4);
    // mascara facial
    flatEllipse(g, cx, hy + 14, 92, 74, FACE);
    // sobrancelha pesada
    flatRRC(g, cx, hy - 12, 96, 20, 9, INK);
    // olhos
    flatCircle(g, cx - 22, hy + 4, 9, WHITE);
    flatCircle(g, cx + 22, hy + 4, 9, WHITE);
    flatCircle(g, cx - 21, hy + 5, 5, INK);
    flatCircle(g, cx + 23, hy + 5, 5, INK);
    // narinas
    flatCircle(g, cx - 10, hy + 32, 5, INK);
    flatCircle(g, cx + 10, hy + 32, 5, INK);
    // boca aberta rugindo
    inkRRC(g, cx, hy + 52, 62, 24, 11, 0x5c1f24, 4);
    g.fillStyle(WHITE, 1);
    for (let i = -2; i <= 2; i++) g.fillRect(cx + i * 12 - 4, hy + 42, 8, 10);
  }
};
// ---------------------------------------------------------------- GOD
const god: EnemyArt = {
  w: 264, h: 340, footY: 330,
  draw(g) {
    const cx = 132;
    const ROBE = 0xfff6e0, ROBE_SH = 0xe8d9b4;
    // raios divinos
    g.fillStyle(GOLD, 0.22);
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12 + 0.26;
      g.fillTriangle(cx, 150, cx + Math.cos(a) * 150, 150 + Math.sin(a) * 150, cx + Math.cos(a + 0.16) * 150, 150 + Math.sin(a + 0.16) * 150);
    }
    // manto (trapezio arredondado)
    inkTri(g, [cx - 26, 130, cx + 26, 130, cx, 130], ROBE, 0);
    inkRRC(g, cx, 244, 150, 176, 40, ROBE);
    flatRRC(g, cx, 300, 156, 60, 26, ROBE_SH);
    // barra dourada
    flatRRC(g, cx, 324, 150, 16, 8, GOLD);
    // bracos abertos
    inkRRC(g, cx - 88, 190, 34, 116, 17, ROBE);
    inkRRC(g, cx + 88, 190, 34, 116, 17, ROBE);
    inkCircle(g, cx - 88, 252, 20, 0xf8cda4, 5);
    inkCircle(g, cx + 88, 252, 20, 0xf8cda4, 5);
    // ombros
    inkRRC(g, cx, 172, 130, 56, 26, ROBE);
    flatRRC(g, cx, 176, 40, 60, 16, GOLD, 0.9);
    // cabeca
    const hy = 116, hr = 38;
    inkCircle(g, cx, hy, hr, 0xf8cda4);
    // barba longa
    inkEllipse(g, cx, hy + 40, 74, 76, WHITE, 5);
    // cabelo
    inkEllipse(g, cx, hy - 22, 84, 42, WHITE, 5);
    // olhos brilhantes
    flatCircle(g, cx - 14, hy - 2, 11, GOLD, 0.35);
    flatCircle(g, cx + 14, hy - 2, 11, GOLD, 0.35);
    flatCircle(g, cx - 14, hy - 2, 6, GOLD);
    flatCircle(g, cx + 14, hy - 2, 6, GOLD);
    flatCircle(g, cx - 14, hy - 2, 2.5, WHITE);
    flatCircle(g, cx + 14, hy - 2, 2.5, WHITE);
    // auréola
    g.lineStyle(OUTLINE + 2, GOLD_DARK, 1);
    g.strokeEllipse(cx, hy - 56, 96, 26);
    g.lineStyle(4, WHITE, 0.95);
    g.strokeEllipse(cx, hy - 58, 86, 18);
  }
};

export const ENEMY_ART: Record<string, EnemyArt> = { toddler, wolf, gorilla, god };
