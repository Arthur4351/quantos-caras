import Phaser from 'phaser';

export class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.fadeIn(400, 26, 26, 46);

    // Title
    this.add.text(960, 340, 'QUANTOS CARAS?', { fontSize: '72px', color: '#fff', fontStyle: 'bold', stroke: '#ffd700', strokeThickness: 4 } as any).setOrigin(0.5);
    this.add.text(960, 430, 'How Many Dudes?  —  Web Clone Fiel', { fontSize: '24px', color: '#aaa' }).setOrigin(0.5);
    this.add.text(960, 470, 'Recrute dudes, monte sinergias, derrote 10 waves até o Gorila!', { fontSize: '16px', color: '#888' }).setOrigin(0.5);

    // Play button
    const btn = this.add.rectangle(960, 600, 320, 90, 0x3498db).setStrokeStyle(4, 0x2980b9).setInteractive({ useHandCursor: true });
    const txt = this.add.text(960, 600, 'PLAY ▶', { fontSize: '36px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    btn.on('pointerover', () => { btn.setFillStyle(0x2980b9); txt.setScale(1.05); });
    btn.on('pointerout', () => { btn.setFillStyle(0x3498db); txt.setScale(1); });
    btn.on('pointerdown', () => {
      try { localStorage.removeItem('daily_active'); localStorage.removeItem('daily_pool'); } catch {}
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('Shop', { wave: 1 }));
    });

    // pulse
    this.tweens.add({ targets: btn, scaleX: 1.03, scaleY: 1.03, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Daily Dude button
    const dailyBtn = this.add.rectangle(960, 700, 260, 55, 0xf1c40f).setStrokeStyle(3, 0xf39c12).setInteractive({ useHandCursor: true });
    const dailyTxt = this.add.text(960, 700, 'DAILY DUDE ★', { fontSize: '18px', color: '#000', fontStyle: 'bold' }).setOrigin(0.5);
    dailyBtn.on('pointerover', () => dailyBtn.setFillStyle(0xf39c12));
    dailyBtn.on('pointerout', () => dailyBtn.setFillStyle(0xf1c40f));
    dailyBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('DailyDude'));
    });

    // Info
    this.add.text(960, 760, 'PC: drag & drop  •  Mobile: toque para comprar/posicionar  •  M para mute', { fontSize: '13px', color: '#666' }).setOrigin(0.5);
    this.add.text(960, 790, '42 dudes • 100 waves • 15 relics • 10 trinkets • 6 famílias 2/4/6', { fontSize: '13px', color: '#555' }).setOrigin(0.5);
    this.add.text(960, 1000, 'Butterscotch Shenanigans • Clone fiel web • Phaser 3 + Vite', { fontSize: '11px', color: '#444' }).setOrigin(0.5);

    // Dudes preview
    const preview = ['Knight', 'Zombie', 'Office', 'Wizard', 'Astro'];
    const colors = [0xc0392b, 0x27ae60, 0x2980b9, 0x8e44ad, 0x16a085];
    preview.forEach((name, i) => {
      const x = 760 + i * 100;
      const y = 830;
      this.add.rectangle(x, y, 70, 70, colors[i]).setStrokeStyle(2, 0xffffff);
      this.add.text(x, y, name.charAt(0), { fontSize: '28px', color: '#fff' }).setOrigin(0.5);
      this.add.text(x, y + 50, name, { fontSize: '10px', color: '#aaa' }).setOrigin(0.5);
    });
  }
}
