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
/**
 * Lobo. Cabeca GRANDE, tronco compacto, cauda curta. A versao anterior tinha um
 * tronco alongado e uma cauda enorme apontando pra cima: no meio da horda lia
 * como "pedra cinza com barbatana". A especie mora na cabeca — orelhas em pe,
 * focinho comprido, olho dourado.
 *
 * Azul-ardosia saturado, nao cinza neutro: com cinza o lobo derretia junto com o
 * urso branco e o pato numa mancha unica.
 */
const wolf: EnemyArt = {
  w: 168, h: 116, footY: 110,
  draw(g) {
    const bx = 92, by = 68;
    const FUR = 0x74869f, MID = 0x5b6c85, DARK = 0x47566b, SNOUT = 0x93a4ba;
    // cauda curta e baixa
    inkTri(g, [bx + 38, by - 6, bx + 40, by + 12, bx + 68, by - 18], MID, 4);
    // patas
    inkRRC(g, bx + 30, 92, 15, 30, 7, DARK);
    inkRRC(g, bx + 12, 94, 15, 28, 7, MID);
    inkRRC(g, bx - 20, 92, 15, 30, 7, DARK);
    inkRRC(g, bx - 36, 94, 15, 28, 7, MID);
    // tronco compacto
    inkEllipse(g, bx, by, 96, 50, FUR);
    flatEllipse(g, bx - 4, by + 14, 64, 18, WHITE, 0.32);
    // cabeca grande
    const hx = 46, hy = 52;
    inkCircle(g, hx, hy, 30, FUR);
    // orelhas em pe
    inkTri(g, [hx - 2, hy - 24, hx + 16, hy - 20, hx + 7, hy - 44], DARK, 3);
    inkTri(g, [hx - 24, hy - 20, hx - 6, hy - 25, hx - 21, hy - 42], DARK, 3);
    // focinho
    inkRRC(g, hx - 24, hy + 10, 32, 18, 8, SNOUT, 4);
    flatCircle(g, hx - 37, hy + 10, 6, INK);
    // olho raivoso
    flatCircle(g, hx + 4, hy - 4, 8, 0xffc42e);
    flatCircle(g, hx + 5, hy - 4, 4, INK);
    inkLine(g, hx - 7, hy - 16, hx + 14, hy - 10, 5);
    // dentes
    g.fillStyle(WHITE, 1);
    g.fillTriangle(hx - 30, hy + 18, hx - 22, hy + 18, hx - 26, hy + 29);
    g.fillTriangle(hx - 20, hy + 18, hx - 12, hy + 18, hx - 16, hy + 28);
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

// ---------------------------------------------------------------- DUCK
/**
 * Pato irritado. AMARELO, nao creme: no bloco da horda o pato branco somava com
 * o urso polar e com o unicornio numa mancha pálida unica. Amarelo quente +
 * bico laranja = a leitura mais rapida do bestiario, e ainda joga cor no campo.
 */
const duck: EnemyArt = {
  w: 140, h: 124, footY: 118,
  draw(g) {
    const cx = 66, bodyCy = 78;
    const BODY = 0xffd23f, SH = 0xe8ac12, BILL = 0xff7a1f;
    // pes palmados
    inkTri(g, [cx - 4, 104, cx + 26, 104, cx + 8, 118], BILL, 3);
    inkTri(g, [cx - 26, 104, cx + 4, 104, cx - 12, 118], BILL, 3);
    // cauda
    inkTri(g, [cx + 34, bodyCy - 10, cx + 38, bodyCy + 12, cx + 82, bodyCy - 26], BODY, 4);
    // corpo
    inkEllipse(g, cx, bodyCy, 104, 74, BODY);
    flatEllipse(g, cx + 6, bodyCy + 16, 72, 30, SH);
    // asa
    inkEllipse(g, cx + 8, bodyCy - 2, 56, 38, SH, 4);
    // pescoco + cabeca
    inkRRC(g, cx - 34, bodyCy - 34, 30, 46, 14, BODY);
    const hx = cx - 40, hy = 34;
    inkCircle(g, hx, hy, 28, BODY);
    // bico
    inkRRC(g, hx - 32, hy + 6, 44, 20, 9, BILL, 4);
    inkLine(g, hx - 52, hy + 8, hx - 12, hy + 8, 3);
    // olho furioso
    flatCircle(g, hx - 4, hy - 6, 9, WHITE);
    flatCircle(g, hx - 6, hy - 5, 5, INK);
    inkLine(g, hx - 18, hy - 20, hx + 6, hy - 13, 6);
  }
};

// ------------------------------------------------------------ HONEY BADGER
/** Baixo, largo e rapido. A faixa branca nas costas e a assinatura. */
const honeybadger: EnemyArt = {
  w: 196, h: 118, footY: 112,
  draw(g) {
    const cx = 92, cy = 68;
    const FUR = 0x24242e, STRIPE = 0xf3f0e2, SNOUT = 0x3c3c48;
    // patas
    for (const px of [-56, -22, 20, 54]) inkRRC(g, cx + px, 96, 20, 30, 9, FUR, 4);
    // cauda curta
    inkTri(g, [cx + 62, cy - 2, cx + 66, cy + 16, cx + 96, cy - 16], FUR, 4);
    // tronco alongado
    inkEllipse(g, cx, cy, 150, 62, FUR);
    // faixa branca do dorso
    flatEllipse(g, cx - 2, cy - 16, 132, 26, STRIPE);
    // cabeca
    const hx = cx - 66, hy = cy - 6;
    inkCircle(g, hx, hy, 30, FUR);
    flatEllipse(g, hx + 2, hy - 14, 52, 18, STRIPE);
    // focinho
    inkRRC(g, hx - 26, hy + 12, 34, 20, 9, SNOUT, 4);
    flatCircle(g, hx - 40, hy + 12, 6, INK);
    // olho pequeno e mau
    flatCircle(g, hx + 2, hy + 1, 7, GOLD);
    flatCircle(g, hx + 1, hy + 1, 3.5, INK);
    // dentes
    g.fillStyle(WHITE, 1);
    g.fillTriangle(hx - 30, hy + 20, hx - 22, hy + 20, hx - 26, hy + 30);
    g.fillTriangle(hx - 20, hy + 20, hx - 12, hy + 20, hx - 16, hy + 29);
  }
};

// ------------------------------------------------------------- POLAR BEAR
/** Massa branca. Ombro alto + cabeca baixa = postura de caca. */
const polarbear: EnemyArt = {
  w: 268, h: 216, footY: 208,
  draw(g) {
    const cx = 132, cy = 116;
    const FUR = 0xfdfcf4, SH = 0xdcdcc9, SNOUT = 0xe9e7d6;
    // patas traseiras / dianteiras
    inkRRC(g, cx + 62, 176, 40, 62, 18, SH);
    inkRRC(g, cx + 24, 180, 36, 56, 16, FUR);
    inkRRC(g, cx - 46, 176, 40, 62, 18, SH);
    inkRRC(g, cx - 82, 180, 36, 56, 16, FUR);
    // tronco enorme com corcova no ombro
    inkEllipse(g, cx + 8, cy, 214, 118, FUR);
    inkEllipse(g, cx - 48, cy - 26, 108, 76, FUR, 4);
    flatEllipse(g, cx + 14, cy + 30, 160, 46, SH, 0.7);
    // cabeca baixa
    const hx = cx - 100, hy = cy + 4;
    inkCircle(g, hx, hy, 40, FUR);
    // orelhas redondas
    inkCircle(g, hx + 6, hy - 36, 13, SH, 4);
    inkCircle(g, hx - 28, hy - 28, 12, SH, 4);
    // focinho
    inkRRC(g, hx - 34, hy + 14, 46, 26, 12, SNOUT, 4);
    flatEllipse(g, hx - 52, hy + 12, 18, 13, INK);
    // olhos
    flatCircle(g, hx - 6, hy - 4, 6, INK);
    flatCircle(g, hx + 18, hy - 2, 6, INK);
    // boca aberta
    inkRRC(g, hx - 30, hy + 30, 30, 14, 7, 0x8c2b3a, 3);
    g.fillStyle(WHITE, 1);
    g.fillTriangle(hx - 42, hy + 24, hx - 34, hy + 24, hx - 38, hy + 36);
    g.fillTriangle(hx - 26, hy + 24, hx - 18, hy + 24, hx - 22, hy + 35);
  }
};

// -------------------------------------------------------------------- BEE
/**
 * Abelha. Reescrita para LEITURA PEQUENA: na horda ela aparece com 76px de
 * altura, e a versao anterior — listras em `fillRect` estourando fora da elipse
 * — virava um barril preto e amarelo indistinguivel dos patos.
 *
 * As listras agora sao ELIPSES calculadas para caber dentro do abdomen (a corda
 * da elipse na borda de cada faixa), entao a silhueta continua redonda. Asas
 * grandes por cima e cabeca preta redonda na frente completam a leitura: numa
 * miniatura de 76px o olho ve corpo listrado + duas asas = abelha.
 */
const bee: EnemyArt = {
  w: 132, h: 120, footY: 108,
  draw(g) {
    const cx = 64, cy = 60;
    // ambar, nao amarelo-limao: o pato ja e amarelo e a horda tem 200 patos.
    // ambar + faixas grossas = inseto; limao + bico = ave. Duas leituras.
    const YEL = 0xffab1a, YEL_SH = 0xd9840c, DARK = 0x1d1a16;
    // asas: duas, bem abertas para cima — a assinatura da silhueta
    inkEllipse(g, cx + 4, cy - 38, 60, 30, WHITE, 3);
    inkEllipse(g, cx + 30, cy - 28, 44, 22, WHITE, 3);
    // ferrao
    inkTri(g, [cx + 44, cy - 6, cx + 44, cy + 10, cx + 82, cy + 3], DARK, 3);
    // abdomen redondo
    const bx = cx + 10, by = cy + 2, ra = 43, rb = 33;
    inkEllipse(g, bx, by, ra * 2, rb * 2, YEL);
    flatEllipse(g, bx, by + 16, ra * 1.5, rb * 0.7, YEL_SH, 0.55);
    // tres faixas. altura = corda da elipse na borda externa da faixa, entao
    // nenhuma listra vaza do corpo e o bicho nao vira barril
    for (const dx of [-15, 4, 23]) {
      const edge = Math.abs(dx) + 7;
      const hh = rb * Math.sqrt(Math.max(0, 1 - (edge / ra) ** 2));
      g.fillStyle(DARK, 1);
      g.fillEllipse(bx + dx, by, 14, hh * 2);
    }
    // patinhas
    for (const px of [-16, 4, 24]) inkLine(g, cx + px, cy + 30, cx + px - 7, cy + 48, 5);
    // cabeca preta na frente
    const hx = cx - 40, hy = cy - 6;
    inkCircle(g, hx, hy, 27, DARK);
    // antenas
    inkLine(g, hx - 7, hy - 22, hx - 18, hy - 46, 4);
    inkCircle(g, hx - 19, hy - 49, 6, YEL, 3);
    inkLine(g, hx + 9, hy - 21, hx + 8, hy - 44, 4);
    inkCircle(g, hx + 8, hy - 47, 6, YEL, 3);
    // olhos enormes: o unico branco na cabeca, le a 76px
    flatEllipse(g, hx - 9, hy - 2, 20, 22, WHITE);
    flatEllipse(g, hx + 13, hy - 1, 17, 19, WHITE);
    flatCircle(g, hx - 11, hy + 1, 6, INK);
    flatCircle(g, hx + 12, hy + 2, 5, INK);
    // sobrancelha bravinha
    inkLine(g, hx - 22, hy - 17, hx + 2, hy - 12, 5);
  }
};

// ----------------------------------------------------------------- UNICORN
/** Cavalo branco, crina arco-iris, chifre dourado. Fofo e letal. */
const unicorn: EnemyArt = {
  w: 240, h: 218, footY: 210,
  draw(g) {
    const cx = 118, cy = 118;
    const FUR = 0xfffdf6, SH = 0xe4e0cf, MANE = 0xff6fae, MANE2 = 0x7ad2ff;
    // pernas
    inkRRC(g, cx + 58, 178, 22, 66, 10, SH);
    inkRRC(g, cx + 30, 182, 20, 60, 9, FUR);
    inkRRC(g, cx - 40, 178, 22, 66, 10, SH);
    inkRRC(g, cx - 66, 182, 20, 60, 9, FUR);
    // cauda arco-iris
    inkTri(g, [cx + 66, cy - 16, cx + 70, cy + 18, cx + 112, cy + 44], MANE, 4);
    inkTri(g, [cx + 70, cy - 4, cx + 72, cy + 20, cx + 106, cy + 6], MANE2, 3);
    // tronco
    inkEllipse(g, cx + 6, cy, 168, 96, FUR);
    flatEllipse(g, cx + 10, cy + 26, 124, 36, SH, 0.7);
    // pescoco
    inkRRC(g, cx - 62, cy - 34, 44, 78, 20, FUR);
    // cabeca
    const hx = cx - 84, hy = cy - 66;
    inkEllipse(g, hx, hy, 62, 48, FUR);
    inkRRC(g, hx - 22, hy + 12, 40, 24, 11, SH, 4);
    flatCircle(g, hx - 36, hy + 10, 5, INK);
    // orelha
    inkTri(g, [hx + 10, hy - 20, hx + 24, hy - 16, hx + 16, hy - 44], SH, 3);
    // chifre
    inkTri(g, [hx - 12, hy - 22, hx + 4, hy - 20, hx - 10, hy - 68], GOLD, 4);
    // crina
    inkEllipse(g, hx + 26, hy + 4, 34, 62, MANE, 4);
    flatEllipse(g, cx - 54, cy - 44, 30, 70, MANE2, 0.9);
    // olho
    flatCircle(g, hx - 6, hy - 4, 8, WHITE);
    flatCircle(g, hx - 8, hy - 3, 4.5, INK);
    inkLine(g, hx - 20, hy - 18, hx + 2, hy - 12, 5);
  }
};

export const ENEMY_ART: Record<string, EnemyArt> = {
  toddler, duck, wolf, honeybadger, bee,
  // a abelha gigante e a MESMA silhueta num tamanho de tela maior (enemyTypes
  // define a altura). Sem esta entrada ela caia na textura `missing` — o
  // quadrado magenta que aparecia na horda da wave 18+.
  beeGiant: bee,
  unicorn, polarbear, gorilla, god
};

