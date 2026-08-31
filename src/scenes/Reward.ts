import Phaser from 'phaser';
import { Economy } from '../systems/Economy';
import { storage } from '../utils/storage';
import { RelicSystem } from '../systems/RelicSystem';
import { calculateGoldBonus } from '../systems/Synergy';
import { AchievementSystem } from '../systems/AchievementSystem';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, panelImage, statPill, toast } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { GOLD, GREEN, INK, ORANGE, PAPER, PAPER_DARK, PURPLE, RED, WOOD } from '../art/palette';
import relics from '../data/relics.json';
import waves from '../data/waves.json';
import { RelicData } from '../types/RelicData';

export class Reward extends Phaser.Scene {
  wave = 1;
  dudesData: any[] = [];
  economy?: Economy;
  private selected = false;

  constructor() { super('Reward'); }

  init(data: any) {
    this.wave = data.wave ?? 1;
    this.dudesData = data.dudesData ?? data.inventory ?? [];
    this.economy = data.economy;
    this.selected = false;
  }

  create() {
    this.cameras.main.fadeIn(320, 126, 209, 245);
    buildRanch(this, { horizon: 360, arena: false, clouds: true });

    const waveEntry = (waves as any).find((entry: any) => entry.wave === this.wave);
    let rewardGold = waveEntry?.rewardGold ?? 5 + Math.floor(this.wave / 2);
    const savedRelics = storage.load('relics') || [];
    const relicSystem = new RelicSystem(savedRelics);
    rewardGold += relicSystem.goldBonus();
    rewardGold += calculateGoldBonus(this.dudesData);

    if (!this.economy) {
      const saved = storage.load('save');
      this.economy = new Economy(saved?.gold ?? 6);
    }
    this.economy.add(rewardGold);

    this.buildHeader(rewardGold);
    this.recordProgress(savedRelics);

    if (this.wave % 3 === 0) this.buildRelicChoice(savedRelics);
    else this.buildContinue();
    this.buildNextWavePreview();
  }

  private buildHeader(rewardGold: number): void {
    panelImage(this, 960, 180, 820, 170, { fill: PAPER, radius: 30 }).setDepth(100);
    statPill(this, 960, 118, 'RECOMPENSA', GOLD, 290, 50, INK).setDepth(101);
    label(this, 960, 178, `WAVE ${this.wave} CONQUISTADA!`, 48, GREEN, true).setDepth(101);
    label(this, 960, 242, `+${rewardGold} OURO  ·  TOTAL ${this.economy?.gold ?? 0}`, 26, INK).setDepth(101);
  }

  private recordProgress(savedRelics: any[]): void {
    try {
      const stars = JSON.parse(localStorage.getItem('stars') || '{}');
      const previous = stars[this.wave] || {};
      stars[this.wave] = { silver: true, gold: previous.gold || true };
      localStorage.setItem('stars', JSON.stringify(stars));

      const families = ['Warrior', 'Undead', 'Employed', 'Fantasy', 'SciFi', 'Action'];
      const synergyMax = Math.max(...families.map(family => this.dudesData.filter(dude => dude.family === family).length));
      new AchievementSystem().check({
        wave: this.wave,
        victory: true,
        noDeath: true,
        dudesCollected: this.dudesData.length,
        relicsCollected: savedRelics.length,
        synergyMax
      });
    } catch { /* corrupted optional meta should not block the reward */ }
    storage.save('save', { wave: this.wave + 1, inventory: this.dudesData, gold: this.economy?.gold ?? 0 });
  }

  private buildRelicChoice(savedRelics: RelicData[]): void {
    panelImage(this, 960, 390, 860, 118, { fill: PAPER, radius: 22, shadow: false }).setDepth(100);
    label(this, 960, 350, 'ESCOLHA UMA RELIQUIA', 34, INK, false).setDepth(101);
    label(this, 960, 392, 'Uma ferramenta nova para o proximo combate.', 20, INK).setDepth(101).setAlpha(0.72);

    (relics as RelicData[]).slice(0, 3).forEach((relic, index) => {
      const x = 960 + (index - 1) * 390;
      const card = panelImage(this, x, 580, 330, 270, { fill: PAPER_DARK, radius: 24 }, g => {
        g.fillStyle(PURPLE, 1);
        g.fillRoundedRect(-145, -122, 290, 16, 8);
      }, `reward${relic.id}`).setDepth(102);
      statPill(this, x, 490, relic.type === 'active' ? 'ATIVA' : 'PASSIVA', ORANGE, 126, 34, INK).setDepth(104);
      label(this, x, 548, relic.name.toUpperCase(), 28, INK, true).setDepth(104);
      label(this, x, 605, relic.description, 17, INK).setDepth(104).setWordWrapWidth(270);
      const hit = this.add.rectangle(x, 580, 330, 270, 0xffffff, 0).setInteractive({ useHandCursor: true }).setDepth(105);
      hit.on('pointerover', () => card.setScale(1.04));
      hit.on('pointerout', () => card.setScale(1));
      hit.on('pointerup', () => {
        if (this.selected) return;
        this.selected = true;
        storage.save('relics', [...savedRelics, relic]);
        toast(this, `${relic.name.toUpperCase()} ADQUIRIDA`, 960, 820, false);
        this.time.delayedCall(500, () => this.nextWave());
      });
    });
  }

  private buildContinue(): void {
    new ComicButton(this, 960, 520, 420, 86, 'CONTINUAR  →  LOJA', () => this.nextWave(), { fill: GREEN, size: 31 })
      .container.setDepth(110);
    label(this, 960, 622, 'A proxima wave nao vai esperar.', 19, INK).setDepth(101).setAlpha(0.7);
  }

  private buildNextWavePreview(): void {
    const nextWave = this.wave + 1;
    if (nextWave > 100) return;
    const text = nextWave % 10 === 0
      ? `WAVE ${nextWave}  ·  BOSS A CAMINHO`
      : `WAVE ${nextWave}  ·  ${nextWave > 15 ? 'INIMIGOS MAIS DENSOS' : 'LOBOS E TODDLERS'}`;
    statPill(this, 960, 900, text, WOOD, 520, 42, PAPER).setDepth(101);

    const preview = this.dudesData.slice(0, 6);
    preview.forEach((dude, index) => {
      const x = 760 + index * 80;
      addShadow(this, x, 1022, 52).setDepth(2);
      const image = addDudeImage(this, x, 1022, dude.id, 74).setDepth(3);
      idleBob(this, image, 2, 800 + index * 40);
    });
  }

  private nextWave(): void {
    if (this.wave >= 100) {
      this.scene.start('GameOver', { wave: 100, victory: true, dudesData: this.dudesData });
      return;
    }
    const saved = storage.load('save');
    const economy = new Economy(saved?.gold ?? this.economy?.gold ?? 6);
    this.scene.start('Shop', { wave: this.wave + 1, inventory: this.dudesData, economy });
  }
}
