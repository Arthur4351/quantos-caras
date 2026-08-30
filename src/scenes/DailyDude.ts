import Phaser from 'phaser';
import { DailySystem } from '../systems/DailySystem';
import { Economy } from '../systems/Economy';
import { storage } from '../utils/storage';

export class DailyDude extends Phaser.Scene {
  constructor() { super('DailyDude'); }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.fadeIn(300);
    const ds = new DailySystem();
    const seed = ds.getSeed();
    const dailyDudes = ds.getDailyDudes();
    const today = new Date().toISOString().slice(0, 10);

    this.add.text(960, 120, 'DAILY DUDE', { fontSize: '48px', color: '#f1c40f', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(960, 180, `Seed: ${seed} • Data: ${today}`, { fontSize: '14px', color: '#aaa' }).setOrigin(0.5);
    this.add.text(960, 210, 'Pool diário igual para todos hoje — tente vencer com estes 5!', { fontSize: '13px', color: '#888' }).setOrigin(0.5);

    // show 5 daily dudes
    dailyDudes.forEach((d, i) => {
      const x = 500 + i * 230;
      const y = 350;
      const bg = this.add.rectangle(x, y, 200, 180, 0x2c3e50).setStrokeStyle(2, 0xf1c40f);
      const colorMap: any = { Warrior: 0xc0392b, Undead: 0x27ae60, Employed: 0x2980b9, Fantasy: 0x8e44ad, SciFi: 0x16a085, Action: 0xd35400 };
      this.add.rectangle(x, y - 40, 50, 50, colorMap[d.family] ?? 0x7f8c8d);
      this.add.text(x, y - 40, d.name.charAt(0), { fontSize: '22px', color: '#fff' }).setOrigin(0.5);
      this.add.text(x, y + 10, d.name, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(x, y + 30, `${d.family}`, { fontSize: '11px', color: '#ccc' }).setOrigin(0.5);
      this.add.text(x, y + 50, `Cost ${d.cost}`, { fontSize: '11px', color: '#ffd700' }).setOrigin(0.5);
    });

    const last = storage.load('daily_last');
    const canPlay = ds.isDailyAvailable(last, today);

    const btn = this.add.rectangle(960, 550, 340, 80, canPlay ? 0xf1c40f : 0x7f8c8d).setStrokeStyle(3, canPlay ? 0xf39c12 : 0x6c7a89).setInteractive({ useHandCursor: canPlay });
    this.add.text(960, 550, canPlay ? 'JOGAR DAILY →' : 'JÁ JOGADO HOJE', { fontSize: '22px', color: canPlay ? '#000' : '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    if (canPlay) {
      btn.on('pointerdown', () => {
        storage.save('daily_last', today);
        storage.save('save', { wave: 1, inventory: [], gold: 6 });
        // store daily pool for Shop to use
        storage.save('daily_pool', dailyDudes);
        this.scene.start('Shop', { wave: 1, inventory: [], economy: new Economy(6) });
      });
    }

    const menuBtn = this.add.rectangle(960, 650, 220, 50, 0x2c3e50).setStrokeStyle(2, 0x34495e).setInteractive({ useHandCursor: true });
    this.add.text(960, 650, 'VOLTAR AO MENU', { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
    menuBtn.on('pointerdown', () => this.scene.start('Menu'));

    // leaderboard local (mock)
    const board = storage.load('daily_board') || [];
    if (board.length) {
      this.add.text(960, 730, 'Leaderboard Local (hoje):', { fontSize: '14px', color: '#fff' }).setOrigin(0.5);
      board.slice(0, 5).forEach((e: any, idx: number) => {
        this.add.text(960, 760 + idx * 22, `${idx + 1}. Wave ${e.wave} - ${e.date}`, { fontSize: '12px', color: '#aaa' }).setOrigin(0.5);
      });
    } else {
      this.add.text(960, 730, 'Sem record hoje — seja o primeiro!', { fontSize: '12px', color: '#666' }).setOrigin(0.5);
    }
  }
}
