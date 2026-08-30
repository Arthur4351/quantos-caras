import Phaser from 'phaser';
import { storage } from '../utils/storage';
import { AchievementSystem } from '../systems/AchievementSystem';

export class GameOver extends Phaser.Scene {
  wave!: number;
  victory = false;
  dudesData: any[] = [];

  constructor() { super('GameOver'); }

  init(data: any) {
    this.wave = data.wave ?? 1;
    this.victory = !!data.victory;
    this.dudesData = data.dudesData ?? [];
  }

  create() {
    this.cameras.main.setBackgroundColor(this.victory ? '#1a2e1a' : '#2e1a1a');
    this.cameras.main.fadeIn(500);

    const title = this.victory ? 'VITÓRIA! 🏆' : 'GAME OVER';
    const color = this.victory ? '#ffd700' : '#ff4444';
    this.add.text(960, 320, title, { fontSize: '64px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 6 } as any).setOrigin(0.5);
    if (this.victory) {
      this.add.text(960, 400, 'Você derrotou 10 Waves incluindo o GORILA BOSS!', { fontSize: '20px', color: '#2ecc71' }).setOrigin(0.5);
      this.add.text(960, 440, '850k combos te esperam para tentar de novo com sinergias diferentes', { fontSize: '14px', color: '#aaa' }).setOrigin(0.5);
    } else {
      this.add.text(960, 400, `Você caiu na Wave ${this.wave}`, { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
      this.add.text(960, 440, this.wave >= 10 ? 'Quase! O Gorila é brutal.' : this.wave >= 7 ? 'Waves mistas exigem sinergias!' : 'Tente reroll e montar 2-3 sinergias core', { fontSize: '14px', color: '#aaa' }).setOrigin(0.5);
    }

    this.add.text(960, 500, `Exército final: ${this.dudesData.length} dudes`, { fontSize: '16px', color: '#888' }).setOrigin(0.5);

    // Stats
    const relics = storage.load('relics') || [];
    if (relics.length) {
      this.add.text(960, 540, `Relíquias coletadas: ${relics.map((r: any) => r.name).join(', ')}`, { fontSize: '12px', color: '#8e44ad' }).setOrigin(0.5);
    }
    // Achievements
    const ac = new AchievementSystem();
    const unlocked = ac.allData();
    if (unlocked.length) {
      this.add.text(960, 570, `Conquistas: ${unlocked.map(a=> a.name).join(' • ')}`, { fontSize: '11px', color: '#f1c40f', wordWrap: { width: 1400 } } as any).setOrigin(0.5);
    }
    // Stars
    try {
      const stars = JSON.parse(localStorage.getItem('stars') || '{}');
      const starCount = Object.keys(stars).length;
      const goldCount = Object.values(stars).filter((s:any)=> s.gold).length;
      this.add.text(960, 595, `Stars: ${starCount} Silver, ${goldCount} Gold`, { fontSize: '11px', color: '#aaa' }).setOrigin(0.5);
    } catch {}

    // Play again
    const btn = this.add.rectangle(960, 620, 320, 80, 0x3498db).setStrokeStyle(4, 0x2980b9).setInteractive({ useHandCursor: true });
    this.add.text(960, 620, 'JOGAR NOVAMENTE ↻', { fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    btn.on('pointerdown', () => {
      // save daily board if daily active
      try {
        const isDaily = JSON.parse(localStorage.getItem('daily_active') || 'false');
        if (isDaily) {
          const board = JSON.parse(localStorage.getItem('daily_board') || '[]');
          board.push({ wave: this.wave, date: new Date().toISOString().slice(0,10), victory: this.victory });
          board.sort((a:any,b:any)=> b.wave - a.wave);
          localStorage.setItem('daily_board', JSON.stringify(board.slice(0,10)));
          localStorage.removeItem('daily_active');
        }
      } catch {}
      storage.clear('save');
      storage.clear('relics');
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('Menu'));
    });
    btn.on('pointerover', () => btn.setFillStyle(0x2980b9));
    btn.on('pointerout', () => btn.setFillStyle(0x3498db));

    // Menu
    const menuBtn = this.add.rectangle(960, 720, 220, 50, 0x2c3e50).setStrokeStyle(2, 0x34495e).setInteractive({ useHandCursor: true });
    this.add.text(960, 720, 'MENU', { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
    menuBtn.on('pointerdown', () => {
      storage.clear('save');
      storage.clear('relics');
      this.scene.start('Menu');
    });

    // pulse victory
    if (this.victory) {
      this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 600, yoyo: true, repeat: -1 });
      this.cameras.main.flash(600, 255, 215, 0);
    } else {
      this.cameras.main.shake(400, 0.01);
    }

    this.add.text(960, 900, 'Fase 1: 5 dudes • Fase 2: 42 dudes + 6 famílias (em breve)', { fontSize: '11px', color: '#444' }).setOrigin(0.5);
  }
}
