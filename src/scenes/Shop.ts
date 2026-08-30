import Phaser from 'phaser';
import { ShopSystem } from '../systems/ShopSystem';
import { Economy } from '../systems/Economy';
import { HUD } from '../ui/HUD';
import { storage } from '../utils/storage';
import { DudeData } from '../types/DudeData';

export class Shop extends Phaser.Scene {
  shop!: ShopSystem;
  economy!: Economy;
  inventory: DudeData[] = [];
  wave = 1;
  hud!: HUD;

  constructor() { super('Shop'); }

  init(data: any) {
    this.wave = data.wave ?? 1;
    this.inventory = data.inventory ?? [];
    this.economy = data.economy ?? new Economy(6);
    // try load from storage if empty
    if (this.inventory.length === 0) {
      const saved = storage.load('save');
      if (saved && saved.inventory && saved.wave === this.wave) {
        this.inventory = saved.inventory;
        if (typeof saved.gold === 'number') this.economy.gold = saved.gold;
      }
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.fadeIn(300, 26, 26, 46);

    this.hud = new HUD(this, this.economy, this.wave);

    if (!this.shop) this.shop = new ShopSystem();
    // if slots empty refill
    if (this.shop.slots.length === 0) this.shop.rerollFree();

    this.add.text(960, 80, 'SHOP - Compre Dudes! (Max 8)', { fontSize: '28px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(960, 120, `Inventário: ${this.inventory.length}/8  |  Clique no dude para comprar, REROLL para novas opções`, { fontSize: '14px', color: '#aaa' }).setOrigin(0.5);

    // Shop slots (responsive: centered grid)
    const startX = 400;
    const slotY = 320;
    this.shop.slots.forEach((d, i) => {
      const x = startX + i * 220;
      const bg = this.add.rectangle(x, slotY, 180, 220, 0x2c3e50).setStrokeStyle(2, 0x34495e).setInteractive({ useHandCursor: true });
      if (!d) {
        this.add.text(x, slotY, 'SOLD', { fontSize: '18px', color: '#777' }).setOrigin(0.5);
        return;
      }
      const colorMap: any = { Warrior: 0xc0392b, Undead: 0x27ae60, Employed: 0x2980b9, Fantasy: 0x8e44ad, SciFi: 0x16a085 };
      const famColor = colorMap[d.family] ?? 0x7f8c8d;
      this.add.rectangle(x, slotY - 60, 60, 60, famColor).setStrokeStyle(2, 0xffffff);
      this.add.text(x, slotY - 60, d.name.charAt(0), { fontSize: '28px', color: '#fff' }).setOrigin(0.5);
      this.add.text(x, slotY, d.name, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(x, slotY + 22, `${d.family} • ${d.role}`, { fontSize: '11px', color: '#ccc' }).setOrigin(0.5);
      this.add.text(x, slotY + 42, `HP:${d.stats.hp} ATK:${d.stats.atk}`, { fontSize: '11px', color: '#ffd700' }).setOrigin(0.5);
      this.add.text(x, slotY + 62, `Cost: ${d.cost}g`, { fontSize: '14px', color: d.cost <= this.economy.gold ? '#2ecc71' : '#e74c3c', fontStyle: 'bold' }).setOrigin(0.5);

      // enable buy
      bg.on('pointerdown', () => {
        if (this.inventory.length >= 8) {
          this.showToast('Inventário cheio! Max 8');
          return;
        }
        const bought = this.shop.buy(i, this.economy);
        if (bought) {
          this.inventory.push(bought);
          this.hud.update();
          storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
          this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
        } else {
          this.showToast('Ouro insuficiente!');
          this.cameras.main.shake(100, 0.005);
        }
      });
      bg.on('pointerover', () => bg.setFillStyle(0x34495e));
      bg.on('pointerout', () => bg.setFillStyle(0x2c3e50));
    });

    // Reroll button
    const rerollBtn = this.add.rectangle(960, 520, 220, 60, 0xe67e22).setStrokeStyle(2, 0xd35400).setInteractive({ useHandCursor: true });
    const canReroll = this.economy.gold >= 2;
    rerollBtn.setFillStyle(canReroll ? 0xe67e22 : 0x7f8c8d);
    this.add.text(960, 520, 'REROLL (2g)', { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    rerollBtn.on('pointerdown', () => {
      if (this.shop.reroll(this.economy)) {
        this.hud.update();
        this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
      } else {
        this.showToast('Sem ouro para reroll!');
      }
    });

    // Inventory display at bottom
    this.add.text(960, 640, 'SEU EXÉRCITO - Clique em START BATTLE quando pronto', { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
    const invStartX = 300;
    const invY = 760;
    // background for inventory
    this.add.rectangle(960, invY, 1400, 160, 0x1e2a3a).setStrokeStyle(2, 0x2c3e50);
    if (this.inventory.length === 0) {
      this.add.text(960, invY, 'Compre dudes acima para montar seu exército!', { fontSize: '16px', color: '#777' }).setOrigin(0.5);
    } else {
      this.inventory.forEach((d, i) => {
        const x = invStartX + i * 150;
        const bg = this.add.rectangle(x, invY, 120, 120, 0x34495e).setStrokeStyle(2, 0x2c3e50);
        const colorMap: any = { Warrior: 0xc0392b, Undead: 0x27ae60, Employed: 0x2980b9, Fantasy: 0x8e44ad, SciFi: 0x16a085 };
        this.add.rectangle(x, invY - 20, 48, 48, colorMap[d.family] ?? 0x7f8c8d);
        this.add.text(x, invY - 20, d.name.charAt(0), { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
        this.add.text(x, invY + 20, d.name, { fontSize: '11px', color: '#fff' }).setOrigin(0.5);
        this.add.text(x, invY + 36, `${d.stats.hp}HP`, { fontSize: '10px', color: '#aaa' }).setOrigin(0.5);
        // sell on right click / long press - sell for cost-1
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) {
            // sell
            const idx = this.inventory.indexOf(d);
            if (idx !== -1) {
              this.inventory.splice(idx, 1);
              this.economy.add(Math.max(1, d.cost - 1));
              this.hud.update();
              storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
              this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
            }
          }
        });
      });
      this.add.text(960, invY + 90, 'Dica: clique direito no dude para vender (recupera cost-1)', { fontSize: '10px', color: '#666' }).setOrigin(0.5);
    }

    // Battle button
    const canBattle = this.inventory.length > 0;
    const battleBtn = this.add.rectangle(960, 900, 360, 80, canBattle ? 0x27ae60 : 0x7f8c8d).setStrokeStyle(3, canBattle ? 0x229954 : 0x6c7a89).setInteractive({ useHandCursor: canBattle });
    this.add.text(960, 900, canBattle ? 'START BATTLE ⚔️' : 'COMPRE DUDES PRIMEIRO', { fontSize: canBattle ? '24px' : '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    if (canBattle) {
      battleBtn.on('pointerdown', () => {
        storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
        this.scene.start('Battle', { wave: this.wave, dudesData: this.inventory });
      });
      battleBtn.on('pointerover', () => battleBtn.setFillStyle(0x2ecc71));
      battleBtn.on('pointerout', () => battleBtn.setFillStyle(0x27ae60));
    }

    // Wave info top-right already via HUD, add bottom hint for mobile
    this.add.text(960, 1000, 'PC: clique | Mobile: toque | Mudo: tecla M', { fontSize: '11px', color: '#555' }).setOrigin(0.5);

    // Mute toggle via M
    this.input.keyboard?.on('keydown-M', () => {
      this.sound.mute = !this.sound.mute;
      this.showToast(this.sound.mute ? 'Mutado' : 'Som ligado');
    });
  }

  showToast(msg: string) {
    const t = this.add.text(960, 580, msg, { fontSize: '16px', color: '#fff', backgroundColor: '#e74c3c', padding: { x: 12, y: 6 } } as any).setOrigin(0.5).setDepth(2000);
    this.tweens.add({ targets: t, alpha: 0, y: 560, duration: 800, delay: 600, onComplete: () => t.destroy() });
  }
}
