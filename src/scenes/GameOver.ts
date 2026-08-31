import Phaser from 'phaser';
import { storage } from '../utils/storage';
import { AchievementSystem } from '../systems/AchievementSystem';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, panelImage, statPill } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { GOLD, GREEN, INK, PAPER, PAPER_DARK, RED, WOOD } from '../art/palette';

export class GameOver extends Phaser.Scene {
  wave = 1;
  victory = false;
  dudesData: any[] = [];

  constructor() { super('GameOver'); }

  init(data: any) {
    this.wave = data.wave ?? 1;
    this.victory = !!data.victory;
    this.dudesData = data.dudesData ?? [];
  }

  create() {
    this.cameras.main.fadeIn(420, 126, 209, 245);
    buildRanch(this, { horizon: this.victory ? 400 : 330, arena: false, clouds: true });
    this.buildHero();
    this.buildStats();
    this.buildActions();
    this.buildArmyLineup();
  }

  private buildHero(): void {
    panelImage(this, 960, 282, 1020, 290, { fill: PAPER, radius: 34 }).setDepth(100);
    const title = this.victory ? 'RANCHO SALVO!' : 'FIM DE RODADA';
    const color = this.victory ? GREEN : RED;
    statPill(this, 960, 190, this.victory ? 'GRANDE VITORIA' : 'O RANCHO CAIU', color, 330, 46, PAPER).setDepth(101);
    label(this, 960, 270, title, 66, color, true).setDepth(101);
    label(this, 960, 344, this.victory ? 'Voce atravessou todas as waves.' : `Voce chegou ate a WAVE ${this.wave}.`, 24, INK).setDepth(101);
    label(this, 960, 388, this.victory ? 'O gorila nao esquece um bom desafio.' : 'Cada tentativa deixa o proximo exercito mais forte.', 18, INK).setDepth(101).setAlpha(0.72);
  }

  private buildStats(): void {
    const relics = storage.load('relics') || [];
    const stars = this.readStars();
    const silver = Object.values(stars).filter((star: any) => star.silver).length;
    const gold = Object.values(stars).filter((star: any) => star.gold).length;
    const achievements = new AchievementSystem().allData();

    statPill(this, 620, 520, `${this.dudesData.length} DUDES`, WOOD, 200, 40, PAPER).setDepth(101);
    statPill(this, 850, 520, `${relics.length} RELICS`, PAPER_DARK, 220, 40, INK).setDepth(101);
    statPill(this, 1100, 520, `${silver} SILVER  ·  ${gold} GOLD`, GOLD, 330, 40, INK).setDepth(101);
    if (achievements.length) {
      label(this, 960, 585, `CONQUISTAS  ·  ${achievements.slice(-4).map(a => a.name.toUpperCase()).join('  •  ')}`, 16, INK, true)
        .setDepth(101).setAlpha(0.78);
    }
  }

  private buildActions(): void {
    new ComicButton(this, 960, 700, 420, 86, 'JOGAR NOVAMENTE  ↻', () => {
      this.clearRun();
      this.cameras.main.fadeOut(260, 0, 0, 0);
      this.time.delayedCall(260, () => this.scene.start('Menu'));
    }, { fill: GREEN, size: 31 }).container.setDepth(120);

    new ComicButton(this, 960, 800, 270, 62, 'MENU', () => {
      this.clearRun();
      this.scene.start('Menu');
    }, { fill: WOOD, size: 28 }).container.setDepth(120);
  }

  private buildArmyLineup(): void {
    const lineup = this.dudesData.slice(0, 8);
    lineup.forEach((dude, index) => {
      const x = 690 + index * 80;
      addShadow(this, x, 1004, 52).setDepth(2);
      const image = addDudeImage(this, x, 1004, dude.id, 74).setDepth(3);
      idleBob(this, image, 2 + (index % 2), 760 + index * 50);
    });
    label(this, 960, 925, this.victory ? 'SEU BANDO DE CAMPEOES' : 'SEU BANDO CHEGOU LONGE', 19, INK, true).setDepth(101).setAlpha(0.82);
  }

  private readStars(): Record<string, any> {
    try { return JSON.parse(localStorage.getItem('stars') || '{}'); } catch { return {}; }
  }

  private clearRun(): void {
    storage.clear('save');
    storage.clear('relics');
    storage.clear('daily_active');
    storage.clear('daily_pool');
  }
}
