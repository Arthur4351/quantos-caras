import Phaser from 'phaser';
import { WaveManager } from '../systems/WaveManager';
import { BattleSystem, calculateDamage } from '../systems/BattleSystem';
import { calculateSynergyBonus, calculateHpBonus } from '../systems/Synergy';
import { Dude } from '../entities/Dude';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { RelicSystem } from '../systems/RelicSystem';
import { storage } from '../utils/storage';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, panelImage, statPill, toast } from '../art/UIKit';
import { addShadow, attackPop, idleBob } from '../art/DudeSprite';
import { GOLD, GREEN, INK, ORANGE, PAPER, PAPER_DARK, RED, WOOD } from '../art/palette';
import { HpBar } from '../art/HpBar';
import waves from '../data/waves.json';
import { DudeData } from '../types/DudeData';

export class Battle extends Phaser.Scene {
  dudes: Dude[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  enemyBars = new Map<Enemy, HpBar>();
  waveManager!: WaveManager;
  battleSystem!: BattleSystem;
  relicSystem!: RelicSystem;
  wave = 1;
  dudesData: DudeData[] = [];
  battleActive = false;
  resultText?: Phaser.GameObjects.Text;
  hasRevived = false;
  private economy = { gold: 0 };

  constructor() { super('Battle'); }

  init(data: { wave: number; dudesData: DudeData[] }) {
    this.wave = data.wave ?? 1;
    this.dudesData = data.dudesData ?? [];
    this.dudes = [];
    this.enemies = [];
    this.projectiles = [];
    this.enemyBars.clear();
    this.battleActive = false;
    this.hasRevived = false;
  }

  create() {
    this.cameras.main.fadeIn(320, 126, 209, 245);
    buildRanch(this, { horizon: 320, arena: true, arenaY: 650, arenaW: 1640, arenaH: 650, clouds: true });
    this.waveManager = new WaveManager(waves as any);
    this.battleSystem = new BattleSystem();
    this.economy.gold = storage.load('save')?.gold ?? 0;
    this.relicSystem = new RelicSystem(storage.load('relics') || []);

    this.buildHeader();
    this.spawnDudes();

    if (this.dudes.length === 0) {
      panelImage(this, 960, 600, 620, 220, { fill: PAPER, radius: 28 }).setDepth(300);
      label(this, 960, 555, 'SEU RANCHO ESTA VAZIO', 32, RED, true).setDepth(301);
      label(this, 960, 615, 'Volte para a loja e recrute pelo menos um cara.', 21, INK).setDepth(301);
      new ComicButton(this, 960, 680, 290, 66, 'VOLTAR A LOJA', () => {
        this.scene.start('Shop', { wave: this.wave, inventory: this.dudesData });
      }, { fill: ORANGE, size: 25 }).container.setDepth(302);
      return;
    }

    this.enemies = this.waveManager.spawn(this, this.wave);
    this.decorateEnemies();
    this.buildRelicControls();
    this.battleActive = true;

    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        this.projectiles.forEach(projectile => { if (projectile.active) projectile.update(); });
        this.projectiles = this.projectiles.filter(projectile => projectile.active);
        this.dudes.forEach(dude => {
          if (dude.attackCooldown > 0) dude.attackCooldown -= 16;
          const shadow = (dude as any).shadow as Phaser.GameObjects.Image | undefined;
          if (shadow) shadow.setPosition(dude.x, dude.y + 2);
          const name = (dude as any).label as Phaser.GameObjects.Text | undefined;
          if (name) name.setPosition(dude.x, dude.y + 12);
        });
      }
    });

    this.time.addEvent({ delay: 120, loop: true, callback: () => this.tick() });

    const muteHandler = () => {
      this.sound.mute = !this.sound.mute;
      toast(this, this.sound.mute ? 'SOM DESLIGADO' : 'SOM LIGADO', 960, 120, false);
    };
    this.input.keyboard?.on('keydown-M', muteHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown');
      this.input.keyboard?.off('keydown-M', muteHandler);
      this.projectiles.forEach(projectile => projectile.destroy());
      this.enemyBars.forEach(bar => bar.destroy());
      this.enemyBars.clear();
    });
  }

  private buildHeader(): void {
    statPill(this, 960, 58, `WAVE ${this.wave}`, GOLD, 270, 56, INK).setDepth(200);
    panelImage(this, 960, 116, 580, 42, { fill: PAPER, radius: 16, shadow: false, gloss: false }).setDepth(199);
    label(this, 960, 116, 'O RANCHO ESTA SOB ATAQUE', 23, INK, false).setDepth(200);
    statPill(this, 1720, 58, `${this.economy.gold} OURO`, PAPER, 250, 52, INK).setDepth(200);
  }

  private spawnDudes(): void {
    this.dudesData.forEach((d, i) => {
      const x = 320 + (i % 4) * 150;
      const y = 560 + Math.floor(i / 4) * 150;
      const dude = new Dude(this, x, y, d);
      const hpBonus = calculateHpBonus(this.dudesData, d.family);
      dude.currentHp += Math.floor(d.stats.hp * hpBonus);
      (dude as any).shadow = addShadow(this, x, y + 3, 84).setDepth(4);
      (dude as any).label = label(this, x, y + 12, d.name.toUpperCase(), 16, INK, true).setDepth(50);
      idleBob(this, dude, 3, 920);
      this.dudes.push(dude);
    });
  }

  private decorateEnemies(): void {
    this.enemies.forEach(enemy => {
      const size = enemy.type === 'gorilla' || enemy.type === 'god' ? 180 : enemy.type === 'wolf' ? 100 : 72;
      (enemy as any).shadow = addShadow(this, enemy.x, enemy.y + 3, size).setDepth(4);
      const bar = new HpBar(this, enemy.type === 'gorilla' || enemy.type === 'god' ? 180 : 112, 14)
        .setPosition(enemy.x, enemy.y - size - 14).setDepth(60);
      this.enemyBars.set(enemy, bar);
      if ((enemy as any).label) {
        (enemy as any).label.setStyle({ fontFamily: '"Baloo 2", sans-serif', fontSize: '14px', color: '#14141c', fontStyle: '800' });
        (enemy as any).label.setStroke('#fff6e0', 4);
      }
    });
  }

  private buildRelicControls(): void {
    if (this.relicSystem.hasMeteor()) {
      const meteor = statPill(this, 960, 1008, 'METEOR  ·  CLIQUE NA ARENA', ORANGE, 430, 48, PAPER).setDepth(200);
      meteor.setInteractive({ useHandCursor: true });
      const meteorHandler = (pointer: Phaser.Input.Pointer) => {
        if (!this.battleActive) return;
        const damage = this.relicSystem.meteorDamage();
        let hits = 0;
        this.enemies.forEach(enemy => {
          if (!enemy.isAlive()) return;
          if (Phaser.Math.Distance.Between(pointer.x, pointer.y, enemy.x, enemy.y) < 150) {
            enemy.takeDamage(damage);
            hits++;
            this.updateEnemyBar(enemy);
          }
        });
        if (hits) {
          const ring = this.add.image(pointer.x, pointer.y, 'fx_ring').setDisplaySize(210, 210).setDepth(80);
          this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
          try { if (this.cache.audio.exists('meteor')) this.sound.play('meteor', { volume: 0.6 }); } catch {}
        }
      };
      this.input.on('pointerdown', meteorHandler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', meteorHandler));
    }
  }

  tick(): void {
    if (!this.battleActive) return;

    this.dudes.filter(d => d.isAlive()).forEach(dude => {
      const target = this.battleSystem.findClosest(dude as any, this.enemies as any) as Enemy | null;
      if (!target || !target.isAlive()) return;
      const distance = Phaser.Math.Distance.Between(dude.x, dude.y, target.x, target.y);
      if (distance < dude.dudeData.stats.range) {
        if (dude.attackCooldown <= 0) {
          const synergy = calculateSynergyBonus(this.dudesData, dude.dudeData.family);
          const damage = calculateDamage(dude.dudeData.stats.atk, synergy) * (1 + this.relicSystem.attackBonus());
          if (dude.dudeData.stats.range > 100) {
            this.projectiles.push(new Projectile(this, dude.x, dude.y - 36, target as any, damage));
          } else {
            target.takeDamage(damage);
            this.updateEnemyBar(target);
          }
          attackPop(this, dude as any, 1);
          dude.attackCooldown = 1000 / dude.dudeData.stats.attackSpeed;
          try { if (this.cache.audio.exists('hit')) this.sound.play('hit', { volume: 0.25 }); } catch {}
        }
      } else {
        const angle = Phaser.Math.Angle.Between(dude.x, dude.y, target.x, target.y);
        dude.x += Math.cos(angle) * dude.dudeData.stats.moveSpeed * 0.016 * 0.3;
        dude.y += Math.sin(angle) * dude.dudeData.stats.moveSpeed * 0.016 * 0.3;
      }
    });

    this.enemies.filter(enemy => enemy.isAlive()).forEach(enemy => {
      const target = this.battleSystem.findClosest(enemy as any, this.dudes as any) as Dude | null;
      if (!target || !target.isAlive()) return;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, target.x, target.y);
      if (distance < 60) {
        const lastAttack = (enemy as any)._lastAtk || 0;
        if (this.time.now - lastAttack > 1000) {
          target.takeDamage(enemy.atk * (1 - this.relicSystem.defenseBonus()));
          (enemy as any)._lastAtk = this.time.now;
          attackPop(this, enemy as any, -1);
        }
      } else {
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y);
        enemy.x += Math.cos(angle) * 40 * 0.016;
        enemy.y += Math.sin(angle) * 40 * 0.016;
      }
      const shadow = (enemy as any).shadow as Phaser.GameObjects.Image | undefined;
      if (shadow) shadow.setPosition(enemy.x, enemy.y + 2);
      const bar = this.enemyBars.get(enemy);
      if (bar) bar.setPosition(enemy.x, enemy.y - (enemy.type === 'gorilla' || enemy.type === 'god' ? 210 : 90));
    });

    let result = this.battleSystem.checkWin(this.dudes as any, this.enemies as any);
    if (result === 'lose' && this.relicSystem.hasRevive() && !this.hasRevived) {
      const dead = this.dudes.find(dude => !dude.isAlive());
      if (dead) {
        dead.heal(dead.dudeData.stats.hp * 0.5);
        this.hasRevived = true;
        toast(this, 'REVIVE! UM CARA VOLTOU', 960, 450, false);
        result = 'ongoing';
      }
    }

    if (result === 'win') {
      this.finishBattle(true);
    } else if (result === 'lose') {
      this.finishBattle(false);
    }
  }

  private updateEnemyBar(enemy: Enemy): void {
    const bar = this.enemyBars.get(enemy);
    if (bar) bar.setRatio(enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp : 0);
    if ((enemy as any).label) (enemy as any).label.setText(`${enemy.type.toUpperCase()}  ${Math.max(0, Math.floor(enemy.currentHp))}`);
  }

  private finishBattle(won: boolean): void {
    this.battleActive = false;
    this.resultText = label(this, 960, 450, won ? 'VITORIA!' : 'DERROTA!', 76, won ? GREEN : RED, true).setDepth(1000);
    if (won) this.cameras.main.flash(300, 78, 201, 90);
    else this.cameras.main.shake(400, 0.015);
    this.time.delayedCall(1200, () => {
      this.cleanupLabels();
      if (won) this.scene.start('Reward', { wave: this.wave, victory: true, dudesData: this.dudesData });
      else this.scene.start('GameOver', { wave: this.wave, victory: false, dudesData: this.dudesData });
    });
  }

  private cleanupLabels(): void {
    [...this.dudes, ...this.enemies].forEach((entity: any) => {
      entity.label?.destroy();
      entity.shadow?.destroy();
    });
    this.projectiles.forEach(projectile => projectile.destroy());
    this.projectiles = [];
  }
}
