import Phaser from 'phaser';
import { ShopSystem } from '../systems/ShopSystem';
import { Economy } from '../systems/Economy';
import { HUD } from '../ui/HUD';
import { storage } from '../utils/storage';
import { DudeData } from '../types/DudeData';
import { RelicSystem } from '../systems/RelicSystem';

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
    // try load from storage if empty (robust, ignore wave mismatch)
    if (this.inventory.length === 0) {
      try {
        const saved = storage.load('save');
        if (saved && Array.isArray(saved.inventory) && saved.inventory.length > 0) {
          this.inventory = saved.inventory;
          if (typeof saved.gold === 'number' && !isNaN(saved.gold)) this.economy.gold = Math.max(0, saved.gold);
        }
      } catch (e) {
        console.warn('Save load failed, using defaults', e);
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
    // Wandering Dude event a cada 10 waves (wave >1)
    if (this.wave > 1 && this.wave % 10 === 0) {
      this.add.rectangle(960, 200, 800, 60, 0xf39c12).setStrokeStyle(2, 0xe67e22);
      this.add.text(960, 200, `✨ WANDERING DUDE! Escolha 1 dude grátis (wave ${this.wave}) ✨`, { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      const wanderingChoices = this.shop.slots.slice(0,3);
      wanderingChoices.forEach((wd, idx) => {
        if (!wd) return;
        const x = 600 + idx * 360;
        const y = 260;
        const bg = this.add.rectangle(x, y, 160, 80, 0xf1c40f).setStrokeStyle(2, 0xf39c12).setInteractive({ useHandCursor: true });
        this.add.text(x, y, wd.name, { fontSize: '12px', color: '#000', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(x, y+18, 'GRÁTIS', { fontSize: '10px', color: '#27ae60' }).setOrigin(0.5);
        bg.on('pointerdown', () => {
          if (this.inventory.length >= 8) { this.showToast('Inventário cheio!'); return; }
          this.inventory.push(wd);
          this.shop.slots[this.shop.slots.indexOf(wd)] = null as any;
          storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
          this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
        });
      });
    }
    this.add.text(960, 120, `Inventário: ${this.inventory.length}/8  |  Clique no dude para comprar, REROLL para novas opções`, { fontSize: '14px', color: '#aaa' }).setOrigin(0.5);

    // Shop slots centered responsively (works with FIT scaling, centered at 960)
    const slotCount = this.shop.slots.length;
    const totalW = slotCount * 200 + (slotCount - 1) * 20;
    const startX = 960 - totalW / 2 + 90;
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
        // anvil cost reduction: effective cost = max(1, cost - relic reduction)
        const relicForBuy = new RelicSystem((() => { try { return JSON.parse(localStorage.getItem('relics') || '[]'); } catch { return []; } })());
        const reduction = relicForBuy.costReduction();
        const effectiveCost = Math.max(1, (d.cost - reduction));
        if (this.economy.gold < effectiveCost) {
          this.showToast('Ouro insuficiente!');
          this.cameras.main.shake(100, 0.005);
          return;
        }
        // manually spend effectiveCost and give dude (bypass ShopSystem cost check)
        this.economy.spend(effectiveCost);
        this.shop.slots[i] = null as any;
        this.inventory.push(d);
        this.hud.update();
        storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
        this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
      });
      bg.on('pointerover', () => bg.setFillStyle(0x34495e));
      bg.on('pointerout', () => bg.setFillStyle(0x2c3e50));
    });

    // Reroll button
    const relicSys = new RelicSystem((() => { try { return JSON.parse(localStorage.getItem('relics') || '[]'); } catch { return []; } })());
    const rerollCost = relicSys.rerollCost();
    const rerollLabel = rerollCost === 0 ? 'REROLL (FREE)' : `REROLL (${rerollCost}g)`;
    const rerollBtn = this.add.rectangle(960, 520, 220, 60, 0xe67e22).setStrokeStyle(2, 0xd35400).setInteractive({ useHandCursor: true });
    const canReroll = this.economy.gold >= rerollCost;
    rerollBtn.setFillStyle(canReroll ? 0xe67e22 : 0x7f8c8d);
    this.add.text(960, 520, rerollLabel, { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    rerollBtn.on('pointerdown', () => {
      // use relic-adjusted cost
      if (this.economy.gold < rerollCost) {
        this.showToast('Sem ouro para reroll!');
        return;
      }
      if (rerollCost > 0) this.economy.spend(rerollCost);
      this.shop.rerollFree();
      this.hud.update();
      this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
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
        const sellBg = this.add.rectangle(x, invY + 52, 60, 18, 0xc0392b).setInteractive({ useHandCursor: true });
        this.add.text(x, invY + 52, 'VENDER', { fontSize: '9px', color: '#fff' }).setOrigin(0.5);
        const doSell = () => {
          const idx = this.inventory.indexOf(d);
          if (idx !== -1) {
            this.inventory.splice(idx, 1);
            this.economy.add(Math.max(1, d.cost - 1));
            this.hud.update();
            storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
            this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
          }
        };
        sellBg.on('pointerdown', doSell);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if ((pointer as any).rightButtonDown && (pointer as any).rightButtonDown()) doSell();
        });
      });
      this.add.text(960, invY + 90, 'Dica: VENDER recupera cost-1  •  Toque para vender no mobile', { fontSize: '10px', color: '#666' }).setOrigin(0.5);
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
    const shopMuteHandler = () => {
      this.sound.mute = !this.sound.mute;
      this.showToast(this.sound.mute ? 'Mutado' : 'Som ligado');
    };
    this.input.keyboard?.on('keydown-M', shopMuteHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-M', shopMuteHandler);
    });
  }

  showToast(msg: string) {
    const t = this.add.text(960, 580, msg, { fontSize: '16px', color: '#fff', backgroundColor: '#e74c3c', padding: { x: 12, y: 6 } } as any).setOrigin(0.5).setDepth(2000);
    this.tweens.add({ targets: t, alpha: 0, y: 560, duration: 800, delay: 600, onComplete: () => t.destroy() });
  }
}
