import Phaser from 'phaser';
import { WaveManager } from '../systems/WaveManager';
import { BattleSystem, calculateDamage } from '../systems/BattleSystem';
import { calculateSynergyBonus } from '../systems/Synergy';
import { Dude } from '../entities/Dude';
import { Enemy } from '../entities/Enemy';
import { RelicSystem } from '../systems/RelicSystem';
import { storage } from '../utils/storage';
import waves from '../data/waves.json';
import { DudeData } from '../types/DudeData';

export class Battle extends Phaser.Scene {
  dudes: Dude[] = [];
  enemies: Enemy[] = [];
  waveManager!: WaveManager;
  battleSystem!: BattleSystem;
  relicSystem!: RelicSystem;
  wave = 1;
  dudesData: DudeData[] = [];
  battleActive = false;
  resultText?: Phaser.GameObjects.Text;
  hasRevived = false;

  constructor() { super('Battle'); }

  init(data: { wave: number; dudesData: DudeData[] }) {
    this.wave = data.wave ?? 1;
    this.dudesData = data.dudesData ?? [];
    this.dudes = [];
    this.enemies = [];
    this.battleActive = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1e2a3a');
    this.waveManager = new WaveManager(waves as any);
    this.battleSystem = new BattleSystem();
    const savedRelics = storage.load('relics') || [];
    this.relicSystem = new RelicSystem(savedRelics);

    this.add.rectangle(960, 540, 1400, 700, 0x2c3e50).setStrokeStyle(4, 0x34495e);
    this.add.text(960, 80, `WAVE ${this.wave}`, { fontSize: '36px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.resultText = this.add.text(960, 140, 'BATALHA INICIADA!', { fontSize: '20px', color: '#ffd700' }).setOrigin(0.5);

    // spawn dudes from inventory data
    this.dudesData.forEach((d, i) => {
      const x = 300 + (i % 4) * 140;
      const y = 280 + Math.floor(i / 4) * 140;
      const dude = new Dude(this, x, y, d);
      // add name label
      const label = this.add.text(x, y + 40, d.name, { fontSize: '12px', color: '#fff' }).setOrigin(0.5);
      (dude as any).label = label;
      this.dudes.push(dude);
    });

    if (this.dudes.length === 0) {
      this.add.text(960, 540, 'Nenhum dude! Volte à loja.', { fontSize: '24px', color: '#ff4444' }).setOrigin(0.5);
      this.time.delayedCall(1500, () => this.scene.start('Shop', { wave: this.wave, inventory: this.dudesData }));
      return;
    }

    this.enemies = this.waveManager.spawn(this, this.wave);

    if (this.relicSystem.hasMeteor()) {
      this.add.text(960, 940, '☄️ METEOR ativo! Clique na arena para causar 100 dano em área!', { fontSize: '14px', color: '#f1c40f', backgroundColor: '#2c3e50' } as any).setOrigin(0.5).setPadding(6, 4, 6, 4);
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!this.battleActive) return;
        const dmg = this.relicSystem.meteorDamage();
        let hitCount = 0;
        this.enemies.forEach(e => {
          if (!e.isAlive()) return;
          const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, e.x, e.y);
          if (dist < 150) {
            e.takeDamage(dmg);
            hitCount++;
            if ((e as any).label) (e as any).label.setText(`${e.type} ${Math.max(0, Math.floor(e.currentHp))}hp`);
            this.tweens.add({ targets: e, alpha: 0.3, duration: 100, yoyo: true });
          }
        });
        if (hitCount > 0) {
          this.cameras.main.shake(200, 0.01);
          // meteor effect circle
          const c = this.add.circle(pointer.x, pointer.y, 10, 0xe74c3c, 0.6);
          this.tweens.add({ targets: c, radius: 150, alpha: 0, duration: 400, onComplete: () => c.destroy() });
          try { if (this.cache.audio.exists('meteor')) this.sound.play('meteor', { volume: 0.6 }); } catch {}
        }
      });
    }

    this.add.text(960, 980, 'Dudes atacam automaticamente o alvo mais próximo', { fontSize: '14px', color: '#aaa' }).setOrigin(0.5);
    // mute toggle
    this.input.keyboard?.on('keydown-M', () => { this.sound.mute = !this.sound.mute; });

    this.battleActive = true;

    // auto battle loop every 120ms
    this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => this.tick()
    });

    // also per-frame cooldown reduction
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        this.dudes.forEach(d => {
          if (d.attackCooldown > 0) d.attackCooldown -= 16;
        });
      }
    });
  }

  tick() {
    if (!this.battleActive) return;

    // Dudes attack
    this.dudes.filter(d => d.isAlive()).forEach(d => {
      const target = this.battleSystem.findClosest(d as any, this.enemies as any) as Enemy | null;
      if (!target || !target.isAlive()) return;
      const dist = Phaser.Math.Distance.Between(d.x, d.y, target.x, target.y);
      if (dist < d.data.stats.range) {
        if (d.attackCooldown <= 0) {
          const synergy = calculateSynergyBonus(this.dudesData, d.data.family);
          const dmg = calculateDamage(d.data.stats.atk, synergy);
          target.takeDamage(dmg);
          // update label if exists
          if ((target as any).label) {
            (target as any).label.setText(`${target.type} ${Math.max(0, Math.floor(target.currentHp))}hp`);
            (target as any).label.setPosition(target.x, target.y - 28);
          }
          // attack anim
          this.tweens.add({ targets: d, scaleX: 1.2, scaleY: 1.2, duration: 80, yoyo: true });
          d.attackCooldown = 1000 / d.data.stats.attackSpeed;
        }
      } else {
        // move towards target slowly
        const angle = Phaser.Math.Angle.Between(d.x, d.y, target.x, target.y);
        d.x += Math.cos(angle) * d.data.stats.moveSpeed * 0.016 * 0.3;
        d.y += Math.sin(angle) * d.data.stats.moveSpeed * 0.016 * 0.3;
        if ((d as any).label) (d as any).label.setPosition(d.x, d.y + 40);
      }
    });

    // Enemies attack nearest dude
    this.enemies.filter(e => e.isAlive()).forEach(e => {
      const target = this.battleSystem.findClosest(e as any, this.dudes as any) as Dude | null;
      if (!target || !target.isAlive()) return;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y);
      if (dist < 50) {
        // simple cooldown via timer
        const lastAtk = (e as any)._lastAtk || 0;
        if (this.time.now - lastAtk > 1000) {
          target.takeDamage(e.atk);
          if ((target as any).label) (target as any).label.setPosition(target.x, target.y + 40);
          (e as any)._lastAtk = this.time.now;
          this.tweens.add({ targets: e, scaleX: 1.15, scaleY: 1.15, duration: 80, yoyo: true });
        }
      } else {
        const angle = Phaser.Math.Angle.Between(e.x, e.y, target.x, target.y);
        e.x += Math.cos(angle) * 40 * 0.016;
        e.y += Math.sin(angle) * 40 * 0.016;
        if ((e as any).label) (e as any).label.setPosition(e.x, e.y - 28);
      }
    });

    // Revive logic: if all dudes dead but we have revive token and hasn't used
    let result = this.battleSystem.checkWin(this.dudes as any, this.enemies as any);
    if (result === 'lose' && this.relicSystem.hasRevive() && !this.hasRevived) {
      const dead = this.dudes.find(d => !d.isAlive());
      if (dead) {
        dead.heal(dead.data.stats.hp * 0.5);
        this.hasRevived = true;
        this.add.text(dead.x, dead.y - 50, 'REVIVE! +50% HP', { fontSize: '14px', color: '#2ecc71', backgroundColor: '#000' } as any).setOrigin(0.5);
        this.cameras.main.flash(300, 46, 204, 113);
        result = 'ongoing';
      }
    }

    if (result === 'win') {
      this.battleActive = false;
      if (this.resultText) this.resultText.setText('VITÓRIA!').setColor('#2ecc71');
      this.cameras.main.flash(300, 46, 204, 113);
      this.time.delayedCall(1200, () => {
        this.cleanupLabels();
        this.scene.start('Reward', { wave: this.wave, victory: true, dudesData: this.dudesData });
      });
    } else if (result === 'lose') {
      this.battleActive = false;
      if (this.resultText) this.resultText.setText('DERROTA!').setColor('#e74c3c');
      this.cameras.main.shake(400, 0.015);
      this.time.delayedCall(1200, () => {
        this.cleanupLabels();
        this.scene.start('GameOver', { wave: this.wave, victory: false });
      });
    }
  }

  cleanupLabels() {
    [...this.dudes, ...this.enemies].forEach((e: any) => {
      if (e.label) e.label.destroy();
    });
  }
}
