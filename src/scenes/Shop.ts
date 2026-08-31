import Phaser from 'phaser';
import { ShopSystem } from '../systems/ShopSystem';
import { Economy } from '../systems/Economy';
import { HUD } from '../ui/HUD';
import { storage } from '../utils/storage';
import { DudeData } from '../types/DudeData';
import { RelicSystem } from '../systems/RelicSystem';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, statPill, toast, panelImage, shade } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { INK, PAPER, PAPER_DARK, WHITE, GOLD, GREEN, RED, ORANGE, WOOD, WOOD_DARK, fam, rar, css } from '../art/palette';
import { OUTLINE } from '../art/ink';

const CARD_W = 292;
const CARD_H = 372;
const CARD_Y = 448;

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
    this.cameras.main.fadeIn(280, 126, 209, 245);
    buildRanch(this, { horizon: 300, arena: false, clouds: true });
    this.hud = new HUD(this, this.economy, this.wave);

    if (!this.shop) this.shop = new ShopSystem();
    try {
      const isDaily = JSON.parse(localStorage.getItem('daily_active') || 'false');
      const dailyPool = JSON.parse(localStorage.getItem('daily_pool') || 'null');
      if (isDaily && dailyPool && Array.isArray(dailyPool) && this.wave === 1) {
        this.shop.slots = dailyPool.slice(0, 5);
      }
    } catch {}
    if (this.shop.slots.length === 0) this.shop.rerollFree();

    this.buildHeader();
    this.buildCards();
    this.buildReroll();
    this.buildArmy();
    this.buildBattleButton();
    if (this.wave > 1 && this.wave % 10 === 0) this.buildWandering();

    const muteHandler = () => {
      this.sound.mute = !this.sound.mute;
      toast(this, this.sound.mute ? 'SOM DESLIGADO' : 'SOM LIGADO', 960, 620, false);
    };
    this.input.keyboard?.on('keydown-M', muteHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-M', muteHandler);
    });
  }

  // ------------------------------------------------------------------ HEADER
  private buildHeader(): void {
    panelImage(this, 960, 148, 620, 82, { fill: WOOD, radius: 22 }).setDepth(80);
    label(this, 960, 146, 'DUDE RANCH', 52, PAPER, true).setDepth(81);
    label(this, 960, 214, `ESCOLHA SEUS CARAS  •  ${this.inventory.length}/8 NO EXERCITO`, 26, INK)
      .setDepth(81).setAlpha(0.8);
  }
  // ------------------------------------------------------------------ CARDS
  private buildCards(): void {
    const n = this.shop.slots.length;
    const step = CARD_W + 22;
    const startX = 960 - ((n * CARD_W + (n - 1) * 22) / 2) + CARD_W / 2;
    this.shop.slots.forEach((d, i) => this.buildCard(startX + i * step, CARD_Y, d, i));
  }

  private buildCard(cx: number, cy: number, d: DudeData | null, index: number): void {
    if (!d) {
      panelImage(this, cx, cy, CARD_W, CARD_H, { fill: 0xc9cdd3, radius: 26 }, undefined, 'sold')
        .setDepth(100).setAlpha(0.9);
      label(this, cx, cy, 'CONTRATADO', 34, INK).setDepth(101).setAlpha(0.5);
      return;
    }

    const paint = fam(d.family);
    const rarity = rar(d.rarity ?? 'common');
    // um unico texture por combinacao familia+raridade: painel + anel + faixa
    const bg = panelImage(this, cx, cy, CARD_W, CARD_H, { fill: PAPER, radius: 26 }, g => {
      g.lineStyle(7, rarity.ring, 1);
      g.strokeRoundedRect(-CARD_W / 2 + 9, -CARD_H / 2 + 9, CARD_W - 18, CARD_H - 18, 19);
      g.fillStyle(INK, 1);
      g.fillRoundedRect(-CARD_W / 2 + 10, -CARD_H / 2 + 8, CARD_W - 20, 62, 18);
      g.fillStyle(paint.main, 1);
      g.fillRoundedRect(-CARD_W / 2 + 14, -CARD_H / 2 + 12, CARD_W - 28, 54, 14);
      g.fillStyle(WHITE, 0.26);
      g.fillRoundedRect(-CARD_W / 2 + 20, -CARD_H / 2 + 17, CARD_W - 40, 16, 8);
    }, `card${paint.main}${rarity.ring}`).setDepth(100);

    label(this, cx, cy - CARD_H / 2 + 39, `${d.family.toUpperCase()} · ${d.role.toUpperCase()}`, 25, WHITE, true).setDepth(102);

    // o dude em pe no cartao
    addShadow(this, cx, cy + 36, 104).setDepth(101);
    const img = addDudeImage(this, cx, cy + 36, d.id, 168).setDepth(102);
    idleBob(this, img, 4, 1000);

    label(this, cx, cy + 72, d.name.toUpperCase(), 34, INK).setDepth(102);
    statPill(this, cx - 68, cy + 116, `${d.stats.hp} HP`, GREEN, 122, 38, WHITE).setDepth(102);
    statPill(this, cx + 68, cy + 116, `${d.stats.atk} ATK`, RED, 122, 38, WHITE).setDepth(102);

    const relic = new RelicSystem(this.readRelics());
    const cost = Math.max(1, d.cost - relic.costReduction());
    const affordable = this.economy.gold >= cost;
    statPill(this, cx, cy + 154, `${cost} OURO`, affordable ? GOLD : 0x9aa3ad, 176, 46, INK).setDepth(102);

    // area clicavel
    const hit = this.add.rectangle(cx, cy, CARD_W, CARD_H, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(110);
    const base = img.scale;
    hit.on('pointerover', () => { bg.setScale(1.03); img.setScale(base * 1.04); });
    hit.on('pointerout', () => { bg.setScale(1); img.setScale(base); });
    hit.on('pointerup', () => this.tryBuy(d, index, cost));
  }

  private readRelics(): any[] {
    try { return JSON.parse(localStorage.getItem('relics') || '[]'); } catch { return []; }
  }

  private tryBuy(d: DudeData, index: number, cost: number): void {
    if (this.inventory.length >= 8) { toast(this, 'EXERCITO CHEIO! MAX 8', 960, 660); return; }
    if (this.economy.gold < cost) {
      toast(this, 'OURO INSUFICIENTE!', 960, 660);
      this.cameras.main.shake(120, 0.006);
      return;
    }
    this.economy.spend(cost);
    this.shop.slots[index] = null as any;
    this.inventory.push(d);
    try { if (this.cache.audio.exists('coin')) this.sound.play('coin', { volume: 0.5 }); } catch {}
    storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
    this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
  }
  // ----------------------------------------------------------------- REROLL
  private buildReroll(): void {
    const relic = new RelicSystem(this.readRelics());
    const cost = relic.rerollCost();
    const can = this.economy.gold >= cost;
    const txt = cost === 0 ? 'REROLL  GRATIS  ↻' : `REROLL  ${cost} OURO  ↻`;
    new ComicButton(this, 960, 700, 420, 76, txt, () => {
      if (this.economy.gold < cost) { toast(this, 'SEM OURO PARA REROLL!', 960, 640); return; }
      if (cost > 0) this.economy.spend(cost);
      this.shop.rerollFree();
      this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
    }, { fill: can ? ORANGE : 0x9aa3ad, size: 34 }).container.setDepth(120);
  }

  // ------------------------------------------------------------------- ARMY
  private buildArmy(): void {
    const PY = 862, PW = 1560, PH = 200;
    panelImage(this, 960, PY, PW, PH, { fill: WOOD, radius: 24 }, g => {
      g.fillStyle(WOOD_DARK, 1);
      g.fillRoundedRect(-PW / 2 + 14, -PH / 2 + 14, PW - 28, PH - 28, 16);
    }, 'shelf').setDepth(60);

    label(this, 960 - PW / 2 + 22, PY - PH / 2 + 26, 'SEU EXERCITO', 26, PAPER, true)
      .setOrigin(0, 0.5).setDepth(62);

    if (this.inventory.length === 0) {
      label(this, 960, PY + 8, 'COMPRE CARAS ACIMA PARA MONTAR O EXERCITO', 30, PAPER_DARK)
        .setDepth(62).setAlpha(0.85);
      return;
    }

    const n = this.inventory.length;
    const step = Math.min(184, (PW - 80) / n);
    const startX = 960 - (step * (n - 1)) / 2;
    this.inventory.forEach((d, i) => this.buildArmySlot(startX + i * step, PY, d));
  }

  private buildArmySlot(x: number, py: number, d: DudeData): void {
    const paint = fam(d.family);
    const card = panelImage(this, x, py + 4, 158, 172, { fill: PAPER, radius: 18, shadow: false }, g => {
      g.fillStyle(paint.main, 1);
      g.fillRoundedRect(-68, -78, 136, 13, 6);
    }, `slot${paint.main}`).setDepth(63);

    addShadow(this, x, py + 18, 72).setDepth(64);
    const img = addDudeImage(this, x, py + 18, d.id, 104).setDepth(65);
    idleBob(this, img, 3, 900);

    label(this, x, py + 34, d.name.toUpperCase(), 20, INK).setDepth(66);
    statPill(this, x, py + 53, `${d.stats.hp} HP · ${d.stats.atk} ATK`, shade(paint.main, 0.08), 132, 23, WHITE).setDepth(66);

    const sellY = py + 76;
    const pill = statPill(this, x, sellY, `VENDER ${Math.max(1, d.cost - 1)}`, RED, 108, 26, WHITE).setDepth(67);
    const sell = this.add.rectangle(x, sellY, 118, 36, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(70);
    sell.on('pointerover', () => { pill.setScale(1.1); card.setScale(1.02); });
    sell.on('pointerout', () => { pill.setScale(1); card.setScale(1); });
    sell.on('pointerup', () => this.doSell(d));
  }

  private doSell(d: DudeData): void {
    const idx = this.inventory.indexOf(d);
    if (idx === -1) return;
    this.inventory.splice(idx, 1);
    this.economy.add(Math.max(1, d.cost - 1));
    storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
    this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
  }
  // ----------------------------------------------------------------- BATTLE
  private buildBattleButton(): void {
    const can = this.inventory.length > 0;
    const txt = can ? 'PRA CIMA DELES!  ⚔' : 'COMPRE CARAS PRIMEIRO';
    const btn = new ComicButton(this, 960, 1016, can ? 520 : 560, 88, txt, () => {
      if (!can) { toast(this, 'SEU EXERCITO ESTA VAZIO!', 960, 940); return; }
      storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
      this.cameras.main.fadeOut(240, 0, 0, 0);
      this.time.delayedCall(240, () => this.scene.start('Battle', { wave: this.wave, dudesData: this.inventory }));
    }, { fill: can ? GREEN : 0x9aa3ad, size: can ? 42 : 30 });
    btn.container.setDepth(140);
    if (can) btn.pulse();
  }

  // -------------------------------------------------------- WANDERING DUDE
  private buildWandering(): void {
    const choices = this.shop.slots.filter(Boolean).slice(0, 3) as DudeData[];
    if (choices.length === 0) return;

    const veil = this.add.rectangle(960, 540, 1920, 1080, INK, 0.62)
      .setDepth(500).setInteractive();

    panelImage(this, 960, 540, 1180, 620, { fill: PAPER, radius: 34 }, undefined, 'modal').setDepth(501);
    label(this, 960, 296, 'CARA ANDARILHO!', 62, ORANGE, true).setDepth(502);
    label(this, 960, 356, `ESCOLHA 1 CARA DE GRACA  ·  WAVE ${this.wave}`, 28, INK).setDepth(502).setAlpha(0.85);

    choices.forEach((wd, i) => {
      const cx = 960 + (i - (choices.length - 1) / 2) * 340;
      const paint = fam(wd.family);
      const cg = panelImage(this, cx, 590, 300, 320, { fill: PAPER_DARK, radius: 22 }, g => {
        g.fillStyle(paint.main, 1);
        g.fillRoundedRect(-134, -146, 268, 16, 8);
      }, `wander${paint.main}`).setDepth(503);

      addShadow(this, cx, 668, 96).setDepth(504);
      const img = addDudeImage(this, cx, 668, wd.id, 152).setDepth(505);
      idleBob(this, img, 4, 980);
      label(this, cx, 700, wd.name.toUpperCase(), 30, INK).setDepth(506);
      statPill(this, cx, 726, `${wd.stats.hp} HP · ${wd.stats.atk} ATK`, shade(paint.main, 0.08), 220, 32, WHITE).setDepth(506);

      const hit = this.add.rectangle(cx, 590, 300, 320, 0xffffff, 0)
        .setInteractive({ useHandCursor: true }).setDepth(510);
      hit.on('pointerover', () => cg.setScale(1.04));
      hit.on('pointerout', () => cg.setScale(1));
      hit.on('pointerup', () => {
        if (this.inventory.length >= 8) { toast(this, 'EXERCITO CHEIO! MAX 8', 960, 820); return; }
        this.inventory.push(wd);
        const at = this.shop.slots.indexOf(wd);
        if (at !== -1) this.shop.slots[at] = null as any;
        storage.save('save', { wave: this.wave, inventory: this.inventory, gold: this.economy.gold });
        this.scene.restart({ wave: this.wave, inventory: this.inventory, economy: this.economy });
      });
    });

    new ComicButton(this, 960, 812, 260, 62, 'DISPENSAR', () => {
      veil.destroy();
      this.children.list.filter(o => (o as any).depth >= 500).forEach(o => o.destroy());
    }, { fill: WOOD, size: 28 }).container.setDepth(511);
  }
}
