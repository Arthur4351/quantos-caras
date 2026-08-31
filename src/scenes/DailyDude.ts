import Phaser from 'phaser';
import { DailySystem } from '../systems/DailySystem';
import { Economy } from '../systems/Economy';
import { storage } from '../utils/storage';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, panelImage, statPill } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { GOLD, INK, ORANGE, PAPER, PAPER_DARK, WOOD } from '../art/palette';
import dudesJson from '../data/dudes.json';

export class DailyDude extends Phaser.Scene {
  constructor() { super('DailyDude'); }

  create() {
    this.cameras.main.fadeIn(320, 126, 209, 245);
    buildRanch(this, { horizon: 350, arena: false, clouds: true });

    const daily = new DailySystem();
    const today = new Date().toISOString().slice(0, 10);
    const seed = daily.getSeed(today);
    const pool = daily.getDailyDudes(dudesJson as any, seed);
    const last = storage.load('daily_last');
    const available = daily.isDailyAvailable(last, today);

    statPill(this, 960, 110, 'DESAFIO DIARIO', ORANGE, 360, 52, PAPER).setDepth(100);
    label(this, 960, 182, 'DAILY DUDE', 68, GOLD, true).setDepth(101);
    label(this, 960, 242, `POOL FIXO  ·  ${today}  ·  SEED ${seed}`, 20, INK, true).setDepth(101);
    label(this, 960, 278, 'Todo mundo recebe estes mesmos cinco caras hoje.', 18, INK).setDepth(101).setAlpha(0.76);

    this.buildPool(pool);

    const play = new ComicButton(this, 960, 690, 410, 86, available ? 'JOGAR DAILY  →' : 'JA JOGADO HOJE', () => {
      if (!available) return;
      storage.save('daily_last', today);
      storage.save('daily_active', true);
      storage.save('daily_pool', pool);
      storage.save('save', { wave: 1, inventory: [], gold: 6 });
      this.scene.start('Shop', { wave: 1, inventory: [], economy: new Economy(6) });
    }, { fill: available ? GOLD : 0x9aa3ad, textColor: available ? INK : PAPER, size: 34 });
    play.container.setDepth(110);
    if (available) play.pulse();

    const menu = new ComicButton(this, 960, 790, 260, 58, 'VOLTAR', () => this.scene.start('Menu'), { fill: WOOD, size: 25 });
    menu.container.setDepth(110);

    this.buildLeaderboard(today);
  }

  private buildPool(pool: any[]): void {
    pool.forEach((d, index) => {
      const x = 500 + index * 230;
      const card = panelImage(this, x, 440, 200, 250, { fill: PAPER, radius: 24 }, g => {
        g.fillStyle(ORANGE, 1);
        g.fillRoundedRect(-86, -110, 172, 14, 7);
      }, `daily${d.id}`).setDepth(100);
      label(this, x, 352, `${index + 1}`, 18, PAPER, true).setDepth(104);
      addShadow(this, x, 438, 88).setDepth(101);
      const image = addDudeImage(this, x, 438, d.id, 132).setDepth(102);
      idleBob(this, image, 3, 900 + index * 40);
      label(this, x, 505, d.name.toUpperCase(), 22, INK, true).setDepth(103);
      label(this, x, 543, d.family.toUpperCase(), 14, INK).setDepth(103).setAlpha(0.7);
      statPill(this, x, 584, `${d.stats.hp} HP  ·  ${d.stats.atk} ATK`, PAPER_DARK, 170, 30, INK).setDepth(103);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => card.setScale(1.04));
      card.on('pointerout', () => card.setScale(1));
    });
  }

  private buildLeaderboard(today: string): void {
    const board = storage.load('daily_board') || [];
    if (!board.length) {
      label(this, 960, 900, 'NENHUM RECORDE AINDA  ·  SEJA O PRIMEIRO', 16, INK, true).setDepth(101).setAlpha(0.65);
      return;
    }
    label(this, 960, 880, `PLACAR LOCAL  ·  ${today}`, 18, INK, true).setDepth(101);
    board.slice(0, 4).forEach((entry: any, index: number) => {
      label(this, 960, 912 + index * 23, `${index + 1}. WAVE ${entry.wave}  ·  ${entry.victory ? 'VITORIA' : 'TENTATIVA'}`, 14, INK).setDepth(101).setAlpha(0.72);
    });
  }
}
