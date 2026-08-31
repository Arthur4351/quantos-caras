import Phaser from 'phaser';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, title as bigTitle, statPill } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { INK, WOOD, WOOD_DARK, GOLD, PAPER, WHITE, GREEN, ORANGE, css } from '../art/palette';
import { OUTLINE } from '../art/ink';
import { shapeTexture } from '../art/bakery';
import dudesJson from '../data/dudes.json';

/** Elenco escolhido a dedo para a multidao da capa — 1 de cada familia + estrelas. */
const COVER_CAST = [
  'knight', 'zombie', 'office', 'wizard', 'astro', 'ninja',
  'barbarian', 'skeleton', 'barista', 'elf', 'robot', 'cowboy',
  'viking', 'ghost', 'courier', 'druid', 'alien', 'chef',
  'samurai', 'mummy', 'cashier', 'bard', 'cyborg', 'athlete',
  'gladiator', 'vampire', 'intern', 'paladin', 'hacker', 'pirate',
  'warlord', 'lich', 'ceo', 'dragon', 'mech', 'spy'
];

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.cameras.main.fadeIn(360, 126, 209, 245);
    buildRanch(this, { horizon: 400, arena: false });

    this.buildSign();
    this.buildCrowd();
    this.buildButtons();

    const cnt = (dudesJson as any[]).length;
    statPill(this, 960, 1052, `${cnt} DUDES  •  100 WAVES  •  15 RELICS  •  6 FAMILIAS`, PAPER, 760, 44, INK)
      .setDepth(200);
  }

  /** Placa de rancho pendurada — ancora do titulo. Assada numa textura. */
  private buildSign(): void {
    shapeTexture(this, 'menu_sign', 1920, 400, g => {
      // postes
      for (const px of [430, 1490]) {
        g.fillStyle(INK, 1);
        g.fillRect(px - 4 - OUTLINE, 96 - OUTLINE, 32 + OUTLINE * 2, 330 + OUTLINE * 2);
        g.fillStyle(WOOD_DARK, 1);
        g.fillRect(px - 4, 96, 32, 330);
      }
      // travessa superior
      g.fillStyle(INK, 1);
      g.fillRect(400 - OUTLINE, 100 - OUTLINE, 1140 + OUTLINE * 2, 26 + OUTLINE * 2);
      g.fillStyle(WOOD, 1);
      g.fillRect(400, 100, 1140, 26);
      // correntes
      g.lineStyle(7, INK, 1);
      g.beginPath();
      g.moveTo(640, 126); g.lineTo(640, 168);
      g.moveTo(1280, 126); g.lineTo(1280, 168);
      g.strokePath();
      // tabua
      g.fillStyle(INK, 1);
      g.fillRoundedRect(960 - 540 - OUTLINE, 168 - OUTLINE, 1080 + OUTLINE * 2, 194 + OUTLINE * 2, 22 + OUTLINE);
      g.fillStyle(WOOD, 1);
      g.fillRoundedRect(960 - 540, 168, 1080, 194, 22);
      g.fillStyle(WHITE, 0.16);
      g.fillRoundedRect(960 - 528, 178, 1056, 44, 14);
      // parafusos
      [[452, 200], [1468, 200], [452, 330], [1468, 330]].forEach(([bx, by]) => {
        g.fillStyle(INK, 1); g.fillCircle(bx, by, 11);
        g.fillStyle(WOOD_DARK, 1); g.fillCircle(bx, by, 7);
      });
    }, false);
    this.add.image(0, 0, 'menu_sign').setOrigin(0, 0).setDepth(10);

    bigTitle(this, 960, 236, 'QUANTOS CARAS?', 96, GOLD).setDepth(11);
    label(this, 960, 320, 'HOW MANY DUDES  —  ROGUELIKE DUDEBUILDER', 30, PAPER, true).setDepth(11);
  }

  /** A multidao: a assinatura visual do jogo e a densidade de dudes. */
  private buildCrowd(): void {
    const rows = [
      { y: 512, h: 96,  n: 12, jitter: 14 },
      { y: 592, h: 116, n: 11, jitter: 16 },
      { y: 682, h: 140, n: 9,  jitter: 18 },
      { y: 786, h: 172, n: 8,  jitter: 20 }
    ];
    let cast = 0;
    rows.forEach((row, ri) => {
      const span = 1760;
      const step = span / row.n;
      for (let i = 0; i < row.n; i++) {
        const id = COVER_CAST[cast++ % COVER_CAST.length];
        const x = 80 + step * (i + 0.5) + (Math.random() - 0.5) * row.jitter;
        const y = row.y + (Math.random() - 0.5) * row.jitter;
        addShadow(this, x, y, row.h * 0.62).setDepth(ri * 2);
        const img = addDudeImage(this, x, y, id, row.h).setDepth(ri * 2 + 1);
        if (Math.random() > 0.5) img.setFlipX(true);
        idleBob(this, img, 3 + ri, 820 + ri * 90);
      }
    });
  }

  private buildButtons(): void {
    new ComicButton(this, 960, 872, 460, 118, 'JOGAR  ▶', () => {
      try { localStorage.removeItem('daily_active'); localStorage.removeItem('daily_pool'); } catch {}
      this.cameras.main.fadeOut(260, 0, 0, 0);
      this.time.delayedCall(260, () => this.scene.start('Shop', { wave: 1 }));
    }, { fill: GREEN, size: 54 }).pulse().container.setDepth(300);

    new ComicButton(this, 960, 984, 340, 62, 'DAILY DUDE  ★', () => {
      this.cameras.main.fadeOut(260, 0, 0, 0);
      this.time.delayedCall(260, () => this.scene.start('DailyDude'));
    }, { fill: ORANGE, size: 28 }).container.setDepth(300);
  }
}
