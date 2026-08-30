import Phaser from 'phaser';
import { Economy } from '../systems/Economy';
import { storage } from '../utils/storage';
import { RelicSystem } from '../systems/RelicSystem';
import { calculateGoldBonus } from '../systems/Synergy';
import relics from '../data/relics.json';
import waves from '../data/waves.json';
import { RelicData } from '../types/RelicData';

export class Reward extends Phaser.Scene {
  wave!: number;
  dudesData: any[] = [];
  economy?: Economy;

  constructor() { super('Reward'); }

  init(data: any) {
    this.wave = data.wave ?? 1;
    this.dudesData = data.dudesData ?? data.inventory ?? [];
    this.economy = data.economy;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.fadeIn(300);

    // Use waves.json for base reward, plus bonuses from relics and family synergy
    const waveEntry = (waves as any).find((w: any) => w.wave === this.wave);
    let rewardGold = waveEntry ? waveEntry.rewardGold : 5 + Math.floor(this.wave / 2);
    // add coinpurse relic bonus and family gold synergy
    try {
      const savedRelics = storage.load('relics') || [];
      const rs = new RelicSystem(savedRelics);
      rewardGold += rs.goldBonus();
      rewardGold += calculateGoldBonus(this.dudesData);
    } catch {}
    // load or create economy
    if (!this.economy) {
      const saved = storage.load('save');
      this.economy = new Economy((saved?.gold ?? 6) + rewardGold);
    } else {
      this.economy.add(rewardGold);
    }

    this.add.text(960, 260, `WAVE ${this.wave} COMPLETA!`, { fontSize: '40px', color: '#2ecc71', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(960, 320, `+${rewardGold} ouro!  (Total: ${this.economy.gold}g)`, { fontSize: '22px', color: '#ffd700' }).setOrigin(0.5);

    // Save progress
    storage.save('save', { wave: this.wave + 1, inventory: this.dudesData, gold: this.economy.gold });
    // also save relics if any
    const savedRelics = storage.load('relics') || [];

    if (this.wave % 3 === 0) {
      this.add.text(960, 400, 'ESCOLHA UMA RELÍQUIA:', { fontSize: '26px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(960, 430, 'Relíquias dão poderes passivos ou ativos (Meteor no clique)', { fontSize: '13px', color: '#aaa' }).setOrigin(0.5);

      const choices = (relics as RelicData[]).slice(0, 3);
      choices.forEach((r, i) => {
        const x = 500 + i * 360;
        const y = 560;
        const bg = this.add.rectangle(x, y, 300, 170, 0x8e44ad).setStrokeStyle(3, 0x9b59b6).setInteractive({ useHandCursor: true });
        this.add.text(x, y - 45, r.name, { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(x, y - 18, r.type === 'active' ? 'ATIVA' : 'PASSIVA', { fontSize: '11px', color: '#f1c40f' }).setOrigin(0.5);
        this.add.text(x, y + 12, r.description, { fontSize: '12px', color: '#ddd', wordWrap: { width: 270 } } as any).setOrigin(0.5);
        const pick = this.add.text(x, y + 50, 'CLIQUE PARA PEGAR', { fontSize: '11px', color: '#fff', backgroundColor: '#2c3e50' } as any).setOrigin(0.5).setPadding(8, 4, 8, 4);

        const onPick = () => {
          const newRelics = [...savedRelics, r];
          storage.save('relics', newRelics);
          this.cameras.main.flash(200, 142, 68, 173);
          this.showToast(`Relíquia: ${r.name}!`);
          this.time.delayedCall(600, () => this.nextWave());
        };
        bg.on('pointerdown', onPick);
        pick.setInteractive({ useHandCursor: true }).on('pointerdown', onPick);
        bg.on('pointerover', () => bg.setFillStyle(0x9b59b6));
        bg.on('pointerout', () => bg.setFillStyle(0x8e44ad));
      });
    } else {
      const btn = this.add.rectangle(960, 560, 320, 80, 0x27ae60).setStrokeStyle(3, 0x229954).setInteractive({ useHandCursor: true });
      this.add.text(960, 560, 'CONTINUAR → LOJA', { fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      btn.on('pointerdown', () => this.nextWave());
      btn.on('pointerover', () => btn.setFillStyle(0x2ecc71));
      btn.on('pointerout', () => btn.setFillStyle(0x27ae60));

      // Auto continue after 3s hint
      this.add.text(960, 640, 'Próxima wave será mais difícil! Prepare seu exército.', { fontSize: '13px', color: '#777' }).setOrigin(0.5);
    }

    // Next wave preview
    const nextWave = this.wave + 1;
    if (nextWave <= 10) {
      const preview = nextWave === 10 ? 'BOSS: GORILA 800HP!' : nextWave >= 7 ? 'Waves mistas (toddlers + lobos)' : nextWave >= 4 ? 'Lobos ferozes' : 'Toddlers em enxame';
      this.add.text(960, 780, `Próxima: Wave ${nextWave} - ${preview}`, { fontSize: '14px', color: '#888' }).setOrigin(0.5);
    }

    // inventory reminder
    this.add.text(960, 880, `Seu exército: ${this.dudesData.length}/8 dudes (sinergias ativas contam no dano)`, { fontSize: '12px', color: '#555' }).setOrigin(0.5);
  }

  nextWave() {
    const nextWave = this.wave + 1;
    if (nextWave > 10) {
      this.scene.start('GameOver', { wave: nextWave, victory: true, dudesData: this.dudesData });
      return;
    }
    // pass economy forward
    const saved = storage.load('save');
    const econ = new Economy(saved?.gold ?? this.economy?.gold ?? 6);
    // add relic gold bonus if coinpurse owned (handled elsewhere, but preview here)
    this.scene.start('Shop', { wave: nextWave, inventory: this.dudesData, economy: econ });
  }

  showToast(msg: string) {
    const t = this.add.text(960, 720, msg, { fontSize: '16px', color: '#fff', backgroundColor: '#8e44ad' } as any).setOrigin(0.5).setDepth(2000).setPadding(12, 6, 12, 6);
    this.tweens.add({ targets: t, alpha: 0, y: 700, duration: 800, delay: 700, onComplete: () => t.destroy() });
  }
}
