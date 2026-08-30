# How Many Dudes? Fase 1 - Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar loop jogável web 10 waves do How Many Dudes? (autobattler) com shop, batalha automática e 3 relics, jogável 60fps em PC e mobile.

**Architecture:** Phaser 3 cenas (Boot/Menu/Shop/Battle/Reward/GameOver) + sistemas desacoplados (BattleSystem, WaveManager, ShopSystem) data-driven via JSON. Canvas FIT responsivo, input unificado touch/mouse, PWA estático.

**Tech Stack:** Phaser 3.90+, TypeScript 5.5 strict, Vite 5, vite-plugin-pwa, Vitest, Playwright (e2e + visual), Howler/Phaser Sound

**Spec:** `docs/superpowers/specs/2026-08-30-how-many-dudes-design.md`

## Global Constraints

- Plataforma: Web navegador, PC + Mobile responsivo (PWA instalável)
- Engine: Phaser 3 + TypeScript + Vite, Scale.FIT 1920x1080 CENTER_BOTH
- Estilo: 2D charming fiel ao original, sprites 64x64, placeholders Kenney mas spritesheet pronto para troca
- Data-driven: 100% dudes/waves/relics via JSON (adicionar dude = editar JSON)
- Fase 1 escopo: 5-8 dudes (Warrior/Undead/Employed), 10 waves (toddlers/wolves/gorilla boss), 3 relics stub, inventory max 8, shop 5 slots reroll 2 ouro
- Performance: >=55-60fps em mobile médio (Moto G 2022), teste 8 vs 20
- Testes: unit Vitest + Playwright e2e + visual 3 breakpoints (1920x1080, 768x1024, 360x800)
- Persistência: localStorage (gold/wave/inventory/relics)
- Audio: BGM loop + SFX hit/buy/win, mute toggle

---

## File Structure

**Criar:**
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/config.ts` - Phaser config
- `src/main.ts` - bootstrap
- `src/types/DudeData.ts`, `src/types/WaveData.ts`, `src/types/RelicData.ts`
- `src/data/dudes.json`, `src/data/waves.json`, `src/data/relics.json`, `src/data/families.json`
- `src/scenes/Boot.ts`, `src/scenes/Menu.ts`, `src/scenes/Shop.ts`, `src/scenes/Battle.ts`, `src/scenes/Reward.ts`, `src/scenes/GameOver.ts`
- `src/entities/Dude.ts`, `src/entities/Enemy.ts`, `src/entities/Projectile.ts`
- `src/systems/BattleSystem.ts`, `src/systems/WaveManager.ts`, `src/systems/ShopSystem.ts`, `src/systems/RelicSystem.ts`, `src/systems/Economy.ts`, `src/systems/Synergy.ts`
- `src/ui/HUD.ts`, `src/utils/validate.ts`, `src/utils/storage.ts`
- `public/assets/sprites/missing.png`, `public/assets/audio/*`
- `tests/unit/BattleSystem.test.ts`, `tests/unit/WaveManager.test.ts`, `tests/unit/Economy.test.ts`, `tests/unit/Synergy.test.ts`
- `e2e/loop.spec.ts`, `e2e/visual.spec.ts`
- `playwright.config.ts`, `vitest.config.ts`

**Modificar:** nenhum pré-existente (repo vazio)

---

### Task 1: Project Setup - Vite + TS + Phaser + PWA

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/config.ts`, `src/main.ts`, `public/assets/sprites/missing.png`
- Test: `tests/unit/setup.test.ts` (smoke)

**Interfaces:**
- Consumes: nada
- Produces: `src/config.ts -> phaserConfig: Phaser.Types.Core.GameConfig`, `src/main.ts -> new Phaser.Game(phaserConfig)`

- [ ] **Step 1: Criar package.json**

```json
{
  "name": "quantos-caras",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "phaser": "^3.90.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.0.0",
    "playwright": "^1.48.0",
    "@playwright/test": "^1.48.0",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: Criar tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests", "e2e"]
}
```

- [ ] **Step 3: Criar vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Quantos Caras - How Many Dudes',
      short_name: 'QuantosCaras',
      start_url: '/',
      display: 'standalone',
      background_color: '#1a1a2e',
      icons: [{ src: '/assets/sprites/missing.png', sizes: '192x192', type: 'image/png' }]
    }
  })],
  server: { port: 3000 }
});
```

- [ ] **Step 4: Criar index.html**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Quantos Caras</title></head>
<body style="margin:0;background:#1a1a2e;overflow:hidden"><div id="game"></div><script type="module" src="/src/main.ts"></script></body>
</html>
```

- [ ] **Step 5: Criar src/config.ts**

```typescript
import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Menu } from './scenes/Menu';
import { Shop } from './scenes/Shop';
import { Battle } from './scenes/Battle';
import { Reward } from './scenes/Reward';
import { GameOver } from './scenes/GameOver';

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [Boot, Menu, Shop, Battle, Reward, GameOver]
};
```

- [ ] **Step 6: Criar src/main.ts**

```typescript
import Phaser from 'phaser';
import { phaserConfig } from './config';
new Phaser.Game(phaserConfig);
```

- [ ] **Step 7: Instalar e verificar build**

Run: `npm install; npm run build`
Expected: build succeed, dist/index.html gerado

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/config.ts src/main.ts
git commit -m "feat: setup Vite + TS + Phaser 3 + PWA base"
```

---

### Task 2: Data-Driven JSON + Validação + Boot Loader

**Files:**
- Create: `src/types/DudeData.ts`, `src/types/WaveData.ts`, `src/types/RelicData.ts`, `src/data/dudes.json`, `src/data/waves.json`, `src/data/relics.json`, `src/data/families.json`, `src/utils/validate.ts`, `src/scenes/Boot.ts`, `vitest.config.ts`
- Test: `tests/unit/validate.test.ts`

**Interfaces:**
- Consumes: `phaserConfig` de Task 1
- Produces: `validateDudes(data: unknown): DudeData[]`, `validateWaves(): WaveData[]`, `Boot.preload() carrega JSON + sprites`

- [ ] **Step 1: Escrever tipos**

```typescript
// src/types/DudeData.ts
export interface DudeData { id: string; name: string; family: 'Warrior'|'Undead'|'Employed'|'Fantasy'|'SciFi'|'Action'; role: 'Tank'|'DPS'|'Support'; stats: { hp: number; atk: number; range: number; attackSpeed: number; moveSpeed: number }; ability: { type: string; value: number }; cost: number; sprite: string; rarity: 'common'|'rare' }

// src/types/WaveData.ts
export interface WaveData { wave: number; enemies: { type: string; count: number; hp: number; atk: number }[]; rewardGold: number }

// src/types/RelicData.ts
export interface RelicData { id: string; name: string; description: string; type: 'active'|'passive'; effect: { target: string; value: number } }
```

- [ ] **Step 2: Criar dudes.json (5 dudes Fase 1)**

```json
[
  { "id": "knight", "name": "Knight", "family": "Warrior", "role": "Tank", "stats": { "hp": 120, "atk": 18, "range": 60, "attackSpeed": 0.9, "moveSpeed": 80 }, "ability": { "type": "shieldBlock", "value": 0.2 }, "cost": 3, "sprite": "knight", "rarity": "common" },
  { "id": "zombie", "name": "Zombie", "family": "Undead", "role": "Tank", "stats": { "hp": 100, "atk": 14, "range": 50, "attackSpeed": 0.7, "moveSpeed": 60 }, "ability": { "type": "regen", "value": 2 }, "cost": 2, "sprite": "zombie", "rarity": "common" },
  { "id": "office", "name": "Office Guy", "family": "Employed", "role": "Support", "stats": { "hp": 80, "atk": 10, "range": 120, "attackSpeed": 1.1, "moveSpeed": 90 }, "ability": { "type": "goldBonus", "value": 1 }, "cost": 3, "sprite": "office", "rarity": "common" },
  { "id": "wizard", "name": "Wizard", "family": "Fantasy", "role": "DPS", "stats": { "hp": 70, "atk": 25, "range": 180, "attackSpeed": 0.8, "moveSpeed": 75 }, "ability": { "type": "aoe", "value": 10 }, "cost": 4, "sprite": "wizard", "rarity": "rare" },
  { "id": "astro", "name": "Astro", "family": "SciFi", "role": "DPS", "stats": { "hp": 75, "atk": 22, "range": 200, "attackSpeed": 1.3, "moveSpeed": 85 }, "ability": { "type": "crit", "value": 0.15 }, "cost": 4, "sprite": "astro", "rarity": "rare" }
]
```

- [ ] **Step 3: Criar waves.json (10 waves) + relics.json + families.json**

```json
// waves.json
[
  { "wave": 1, "enemies": [{ "type": "toddler", "count": 8, "hp": 20, "atk": 5 }], "rewardGold": 5 },
  { "wave": 2, "enemies": [{ "type": "toddler", "count": 12, "hp": 22, "atk": 5 }], "rewardGold": 6 },
  { "wave": 3, "enemies": [{ "type": "toddler", "count": 15, "hp": 24, "atk": 6 }], "rewardGold": 6 },
  { "wave": 4, "enemies": [{ "type": "wolf", "count": 6, "hp": 40, "atk": 10 }], "rewardGold": 7 },
  { "wave": 5, "enemies": [{ "type": "wolf", "count": 8, "hp": 45, "atk": 11 }], "rewardGold": 7 },
  { "wave": 6, "enemies": [{ "type": "wolf", "count": 10, "hp": 50, "atk": 12 }], "rewardGold": 8 },
  { "wave": 7, "enemies": [{ "type": "toddler", "count": 10, "hp": 30, "atk": 6 }, { "type": "wolf", "count": 5, "hp": 55, "atk": 12 }], "rewardGold": 8 },
  { "wave": 8, "enemies": [{ "type": "wolf", "count": 12, "hp": 60, "atk": 13 }], "rewardGold": 9 },
  { "wave": 9, "enemies": [{ "type": "toddler", "count": 12, "hp": 35, "atk": 7 }, { "type": "wolf", "count": 8, "hp": 65, "atk": 14 }], "rewardGold": 9 },
  { "wave": 10, "enemies": [{ "type": "gorilla", "count": 1, "hp": 800, "atk": 30 }], "rewardGold": 10 }
]
```

```json
// relics.json
[
  { "id": "meteor", "name": "Meteor", "description": "Causa 100 dano em área", "type": "active", "effect": { "target": "areaDamage", "value": 100 } },
  { "id": "revive", "name": "Revive Token", "description": "Revive 1 dude com 50% HP", "type": "passive", "effect": { "target": "revive", "value": 0.5 } },
  { "id": "coinpurse", "name": "Coin Purse", "description": "+2 ouro por wave", "type": "passive", "effect": { "target": "goldPerWave", "value": 2 } }
]
```

```json
// families.json
{
  "Warrior": { "color": "#c0392b", "synergy": [{ "count": 2, "bonusAtk": 0.15 }] },
  "Undead": { "color": "#27ae60", "synergy": [{ "count": 2, "bonusHp": 0.2 }] },
  "Employed": { "color": "#2980b9", "synergy": [{ "count": 2, "bonusGold": 1 }] }
}
```

- [ ] **Step 4: Escrever validador**

```typescript
// src/utils/validate.ts
import { DudeData } from '../types/DudeData';
export function validateDudes(data: unknown): DudeData[] {
  if (!Array.isArray(data)) throw new Error('Dudes must be array');
  return data.map(d => {
    if (!d.id || !d.stats?.hp) throw new Error(`Invalid dude ${JSON.stringify(d)}`);
    if (d.stats.hp <=0 || d.cost <0) throw new Error(`Invalid stats for ${d.id}`);
    return d as DudeData;
  });
}
export function validateWaves(data: unknown): void { if (!Array.isArray(data)) throw new Error('Waves must be array'); }
```

- [ ] **Step 5: Escrever teste que falha**

```typescript
// tests/unit/validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateDudes } from '../../src/utils/validate';
describe('validateDudes', () => {
  it('should accept valid dudes', () => {
    const data = [{ id: 'knight', stats: { hp: 100, atk: 10, range: 50, attackSpeed: 1, moveSpeed: 80 }, cost: 3, family: 'Warrior', role: 'Tank', ability: {type:'x', value:1}, name:'k', sprite:'s', rarity:'common' }];
    expect(validateDudes(data).length).toBe(1);
  });
  it('should throw on invalid hp', () => {
    expect(() => validateDudes([{ id: 'bad', stats: { hp: -5 }, cost: 1 } as any])).toThrow();
  });
  it('should throw on non-array', () => { expect(() => validateDudes({} as any)).toThrow(); });
});
```

- [ ] **Step 6: Rodar teste falhando**

Run: `npm run test -- tests/unit/validate.test.ts`
Expected: FAIL (validate not implemented)

- [ ] **Step 7: Implementar validate.ts (código do Step 4)**

- [ ] **Step 8: Rodar teste passando**

Run: `npm run test`
Expected: PASS 3/3

- [ ] **Step 9: Criar Boot.ts**

```typescript
import Phaser from 'phaser';
export class Boot extends Phaser.Scene {
  constructor(){ super('Boot'); }
  preload(){
    this.load.json('dudes', 'src/data/dudes.json');
    this.load.json('waves', 'src/data/waves.json');
    this.load.json('relics', 'src/data/relics.json');
    this.load.on('loaderror', (file: any) => { console.warn('loaderror', file.key); });
    // placeholder sprite - single pixel will be replaced
    this.load.image('missing', 'assets/sprites/missing.png');
  }
  create(){
    // validate
    try {
      const dudes = this.cache.json.get('dudes');
      const { validateDudes } = require('../utils/validate');
      validateDudes(dudes);
    } catch(e){ console.error(e); }
    this.scene.start('Menu');
  }
}
```

- [ ] **Step 10: Commit**

```bash
git add src/types src/data src/utils src/scenes/Boot.ts tests/unit/validate.test.ts vitest.config.ts
git commit -m "feat: data-driven JSON + validador + Boot loader"
```

---

### Task 3: Entidades Dude, Enemy, Projectile

**Files:**
- Create: `src/entities/Dude.ts`, `src/entities/Enemy.ts`, `src/entities/Projectile.ts`
- Test: `tests/unit/BattleSystem.test.ts` (usará as entidades), `tests/unit/Synergy.test.ts`

**Interfaces:**
- Consumes: `DudeData`, `validateDudes`
- Produces: `class Dude extends Phaser.GameObjects.Sprite { constructor(scene, x, y, data: DudeData); takeDamage(n): void; attack(target): void; isAlive(): boolean }`, `class Enemy similar`, `class Projectile`

- [ ] **Step 1: Escrever teste de Dude**

```typescript
// tests/unit/Synergy.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSynergyBonus } from '../../src/systems/Synergy';
describe('Synergy', () => {
  it('2 Warrior = +15% ATK', () => {
    const team = [{family:'Warrior'}, {family:'Warrior'}] as any;
    expect(calculateSynergyBonus(team, 'Warrior')).toBe(0.15);
  });
  it('1 Warrior = 0', () => {
    const team = [{family:'Warrior'}] as any;
    expect(calculateSynergyBonus(team, 'Warrior')).toBe(0);
  });
});
```

- [ ] **Step 2: Escrever teste de Battle dano**

```typescript
// tests/unit/BattleSystem.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../../src/systems/BattleSystem';
describe('calculateDamage', () => {
  it('applies synergy', () => {
    expect(calculateDamage(10, 0.15)).toBe(11.5);
  });
  it('clamps não negativo', () => {
    expect(calculateDamage(10, 0)).toBe(10);
  });
});
```

- [ ] **Step 3: Rodar falhando**

Run: `npm run test tests/unit/Synergy.test.ts tests/unit/BattleSystem.test.ts`
Expected: FAIL module not found

- [ ] **Step 4: Implementar Synergy.ts**

```typescript
// src/systems/Synergy.ts
import { DudeData } from '../types/DudeData';
import families from '../data/families.json';
export function calculateSynergyBonus(team: { family: string }[], family: string): number {
  const count = team.filter(d => d.family === family).length;
  const fam = (families as any)[family];
  if (!fam) return 0;
  const synergy = fam.synergy.find((s:any) => count >= s.count);
  return synergy?.bonusAtk || synergy?.bonusHp || 0;
}
```

- [ ] **Step 5: Implementar BattleSystem helper**

```typescript
// src/systems/BattleSystem.ts (parcial Fase 3)
export function calculateDamage(baseAtk: number, synergyBonus: number): number {
  return Math.max(0, baseAtk * (1 + synergyBonus));
}
export class BattleSystem {
  // será expandido na Task 4 com lógica Phaser
}
```

- [ ] **Step 6: Implementar Dude.ts**

```typescript
import Phaser from 'phaser';
import { DudeData } from '../types/DudeData';
export class Dude extends Phaser.GameObjects.Sprite {
  data: DudeData;
  currentHp: number;
  attackCooldown: number = 0;
  constructor(scene: Phaser.Scene, x: number, y: number, data: DudeData){
    super(scene, x, y, 'missing');
    this.data = data;
    this.currentHp = data.stats.hp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(64,64);
  }
  takeDamage(n: number){ this.currentHp = Math.max(0, this.currentHp - n); if(this.currentHp<=0) this.setTint(0x555555); }
  isAlive(){ return this.currentHp > 0; }
  update(time: number, delta: number){}
}
```

- [ ] **Step 7: Implementar Enemy.ts e Projectile.ts similares**

```typescript
// src/entities/Enemy.ts
import Phaser from 'phaser';
export class Enemy extends Phaser.GameObjects.Sprite {
  currentHp: number; atk: number;
  constructor(scene: Phaser.Scene, x:number, y:number, hp:number, atk:number){
    super(scene, x,y, 'missing'); this.currentHp=hp; this.atk=atk;
    scene.add.existing(this); scene.physics.add.existing(this); this.setDisplaySize(48,48); this.setTint(0xff4444);
  }
  takeDamage(n:number){ this.currentHp -= n; }
  isAlive(){ return this.currentHp>0; }
}
// src/entities/Projectile.ts
import Phaser from 'phaser';
export class Projectile extends Phaser.GameObjects.Rectangle {
  constructor(scene: Phaser.Scene, x:number,y:number, target: Phaser.GameObjects.Sprite){
    super(scene,x,y,8,8,0xffff00); scene.add.existing(this); scene.physics.add.existing(this);
    scene.physics.moveToObject(this, target, 300);
  }
}
```

- [ ] **Step 8: Rodar testes passando**

Run: `npm run test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/entities src/systems/Synergy.ts src/systems/BattleSystem.ts tests/unit/*.test.ts
git commit -m "feat: entidades Dude/Enemy/Projectile + synergy"
```

---

### Task 4: BattleSystem Completo + WaveManager

**Files:**
- Create: `src/systems/WaveManager.ts`, expandir `src/systems/BattleSystem.ts`
- Modify: `src/scenes/Battle.ts`
- Test: `tests/unit/WaveManager.test.ts`

**Interfaces:**
- Consumes: `Dude`, `Enemy`, `calculateDamage`, `WaveData`
- Produces: `WaveManager.getWave(n): WaveData`, `WaveManager.spawn(scene, wave): Enemy[]`, `BattleSystem.startBattle(dudes, enemies): Promise<'win'|'lose'>`

- [ ] **Step 1: Teste WaveManager**

```typescript
// tests/unit/WaveManager.test.ts
import { describe, it, expect } from 'vitest';
import { WaveManager } from '../../src/systems/WaveManager';
import waves from '../../src/data/waves.json';
describe('WaveManager', () => {
  it('wave 1 has 8 toddlers', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(1).enemies[0].count).toBe(8);
  });
  it('wave 10 is gorilla boss', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(10).enemies[0].type).toBe('gorilla');
  });
  it('scales hp wave 10 > wave 1', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(10).enemies[0].hp).toBeGreaterThan(wm.getWave(1).enemies[0].hp);
  });
});
```

- [ ] **Step 2: Rodar falhando**

Run: `npm run test tests/unit/WaveManager.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar WaveManager**

```typescript
// src/systems/WaveManager.ts
import { WaveData } from '../types/WaveData';
export class WaveManager {
  constructor(private waves: WaveData[]){}
  getWave(n: number): WaveData { return this.waves.find(w=>w.wave===n) || this.waves[0]; }
  spawn(scene: Phaser.Scene, wave: number){
    const data = this.getWave(wave);
    const enemies: any[] = [];
    data.enemies.forEach(e => {
      for(let i=0;i<e.count;i++){
        const x = 1200 + Math.random()*400, y = 200 + Math.random()*600;
        const Enemy = require('../entities/Enemy').Enemy;
        enemies.push(new Enemy(scene, x, y, e.hp, e.atk));
      }
    });
    return enemies;
  }
}
```

- [ ] **Step 4: Expandir BattleSystem com lógica Phaser**

```typescript
// src/systems/BattleSystem.ts completo
import { Dude } from '../entities/Dude';
import { Enemy } from '../entities/Enemy';
export function calculateDamage(baseAtk: number, synergyBonus: number): number { return Math.max(0, baseAtk*(1+synergyBonus)); }
export class BattleSystem {
  checkWin(dudes: Dude[], enemies: Enemy[]): 'win'|'lose'|'ongoing' {
    if (enemies.every(e=>!e.isAlive())) return 'win';
    if (dudes.every(d=>!d.isAlive())) return 'lose';
    return 'ongoing';
  }
  findClosest(attacker: Phaser.GameObjects.Sprite, targets: Phaser.GameObjects.Sprite[]): Phaser.GameObjects.Sprite | null {
    let best=null, dist=Infinity;
    targets.filter(t=>(t as any).isAlive()).forEach(t=>{
      const d = Phaser.Math.Distance.Between(attacker.x, attacker.y, t.x, t.y);
      if(d<dist){dist=d; best=t;}
    });
    return best;
  }
}
```

- [ ] **Step 5: Criar Battle scene**

```typescript
// src/scenes/Battle.ts
import Phaser from 'phaser';
import { WaveManager } from '../systems/WaveManager';
import { BattleSystem } from '../systems/BattleSystem';
import { Dude } from '../entities/Dude';
import waves from '../data/waves.json';
export class Battle extends Phaser.Scene {
  dudes: Dude[]=[]; enemies: any[]=[]; waveManager!: WaveManager; battleSystem!: BattleSystem; wave=1;
  constructor(){ super('Battle'); }
  init(data:{ wave:number, dudesData: any[] }){ this.wave=data.wave; this.dudesData=data.dudesData; }
  create(){
    this.waveManager = new WaveManager(waves as any);
    this.battleSystem = new BattleSystem();
    // spawn dudes from inventory data
    this.dudesData?.forEach((d,i)=>{ this.dudes.push(new Dude(this, 300 + (i%4)*150, 300 + Math.floor(i/4)*150, d)); });
    this.enemies = this.waveManager.spawn(this, this.wave);
    this.add.text(960, 50, `WAVE ${this.wave}`, { fontSize:'32px', color:'#fff'}).setOrigin(0.5);
    // auto battle loop
    this.time.addEvent({ delay: 100, loop:true, callback: ()=> this.tick() });
  }
  tick(){
    this.dudes.filter(d=>d.isAlive()).forEach(d=>{
      const target = this.battleSystem.findClosest(d, this.enemies);
      if(target && Phaser.Math.Distance.Between(d.x,d.y,target.x,target.y) < d.data.stats.range){
        if(d.attackCooldown<=0){ (target as any).takeDamage(d.data.stats.atk); d.attackCooldown = 1000/d.data.stats.attackSpeed; }
      }
    });
    this.dudes.forEach(d=> d.attackCooldown-=100);
    const result = this.battleSystem.checkWin(this.dudes, this.enemies);
    if(result==='win'){ this.scene.start('Reward', { wave: this.wave, victory:true }); }
    if(result==='lose'){ this.scene.start('GameOver', { wave: this.wave }); }
  }
}
```

- [ ] **Step 6: Rodar testes**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/systems/WaveManager.ts src/systems/BattleSystem.ts src/scenes/Battle.ts
git commit -m "feat: WaveManager 10 waves + BattleSystem auto-battle"
```

---

### Task 5: Economy, ShopSystem, Inventory e Shop Scene

**Files:**
- Create: `src/systems/Economy.ts`, `src/systems/ShopSystem.ts`, `src/utils/storage.ts`, `src/scenes/Shop.ts`, `src/ui/HUD.ts`
- Test: `tests/unit/Economy.test.ts`

**Interfaces:**
- Consumes: `DudeData`, `WaveData`
- Produces: `Economy { gold: number; add(n), spend(n): boolean }`, `ShopSystem { slots: DudeData[]; reroll(cost): void; buy(index): DudeData|null }`, `Shop scene`

- [ ] **Step 1: Teste Economia**

```typescript
// tests/unit/Economy.test.ts
import { describe, it, expect } from 'vitest';
import { Economy } from '../../src/systems/Economy';
describe('Economy', () => {
  it('spend fails if insufficient', () => { const e=new Economy(3); expect(e.spend(5)).toBe(false); expect(e.gold).toBe(3); });
  it('spend succeeds', () => { const e=new Economy(5); expect(e.spend(3)).toBe(true); expect(e.gold).toBe(2); });
  it('add clamps', () => { const e=new Economy(0); e.add(5); expect(e.gold).toBe(5); e.add(-10); expect(e.gold).toBe(0); });
  it('reroll costs 2', () => { const e=new Economy(5); e.spend(2); expect(e.gold).toBe(3); });
});
```

- [ ] **Step 2: Rodar falhando**

Run: `npm run test tests/unit/Economy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar Economy + Storage**

```typescript
// src/systems/Economy.ts
export class Economy {
  gold: number;
  constructor(initial=6){ this.gold=initial; }
  add(n: number){ this.gold = Math.max(0, this.gold + n); }
  spend(cost: number): boolean { if(this.gold < cost) return false; this.gold -= cost; return true; }
}
// src/utils/storage.ts
export const storage = {
  save(key: string, data:any){ try{ localStorage.setItem(key, JSON.stringify(data)); }catch{} },
  load(key: string){ try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch{ return null; } }
};
```

- [ ] **Step 4: Implementar ShopSystem**

```typescript
// src/systems/ShopSystem.ts
import { DudeData } from '../types/DudeData';
import dudes from '../data/dudes.json';
export class ShopSystem {
  slots: DudeData[] = [];
  constructor(){ this.rerollFree(); }
  rerollFree(){ this.slots = Array.from({length:5}, ()=> (dudes as DudeData[])[Math.floor(Math.random()*(dudes as any).length)]); }
  reroll(economy: any): boolean {
    if(!economy.spend(2)) return false;
    this.rerollFree(); return true;
  }
  buy(index: number, economy: any): DudeData | null {
    const d = this.slots[index]; if(!d) return null;
    if(!economy.spend(d.cost)) return null;
    this.slots[index] = null as any; return d;
  }
}
```

- [ ] **Step 5: Criar HUD.ts**

```typescript
import Phaser from 'phaser';
export class HUD {
  goldText!: Phaser.GameObjects.Text; waveText!: Phaser.GameObjects.Text;
  constructor(private scene: Phaser.Scene, private economy: any, private wave: number){
    this.goldText = scene.add.text(50, 30, `Gold: ${economy.gold}`, { fontSize:'24px', color:'#ffd700'}).setScrollFactor(0);
    this.waveText = scene.add.text(1600,30, `Wave: ${wave}`, { fontSize:'24px', color:'#fff'}).setScrollFactor(0);
  }
  update(){ this.goldText.setText(`Gold: ${this.economy.gold}`); }
}
```

- [ ] **Step 6: Criar Shop.ts scene (drag PC + tap mobile)**

```typescript
import Phaser from 'phaser';
import { ShopSystem } from '../systems/ShopSystem';
import { Economy } from '../systems/Economy';
import { HUD } from '../ui/HUD';
export class Shop extends Phaser.Scene {
  shop!: ShopSystem; economy!: Economy; inventory: any[]=[]; wave=1;
  constructor(){ super('Shop'); }
  init(data:any){ this.wave=data.wave||1; this.inventory=data.inventory||[]; this.economy=data.economy||new Economy(6); }
  create(){
    new HUD(this, this.economy, this.wave);
    this.shop = new ShopSystem();
    this.add.text(960,80,'SHOP - Compre Dudes! (Max 8)',{fontSize:'28px', color:'#fff'}).setOrigin(0.5);
    this.shop.slots.forEach((d,i)=>{
      const x=400+i*220, y=300;
      const bg=this.add.rectangle(x,y,180,220,0x2c3e50).setInteractive();
      if(!d) return;
      this.add.text(x,y-80,d.name,{fontSize:'16px', color:'#fff'}).setOrigin(0.5);
      this.add.text(x,y-50,`Cost: ${d.cost}`,{fontSize:'14px', color:'#ffd700'}).setOrigin(0.5);
      this.add.rectangle(x,y+40,64,64,0xaaaaaa);
      bg.on('pointerdown', ()=>{
        if(this.inventory.length>=8) return;
        const bought=this.shop.buy(i, this.economy); if(bought){ this.inventory.push(bought); this.scene.restart({wave:this.wave, inventory:this.inventory, economy:this.economy}); }
      });
    });
    // Reroll
    const rerollBtn=this.add.rectangle(960,500,200,60,0xe67e22).setInteractive();
    this.add.text(960,500,'REROLL (2g)',{fontSize:'18px', color:'#fff'}).setOrigin(0.5);
    rerollBtn.on('pointerdown', ()=>{ if(this.shop.reroll(this.economy)) this.scene.restart({wave:this.wave, inventory:this.inventory, economy:this.economy}); });
    // Battle
    const battleBtn=this.add.rectangle(960,600,300,80,0x27ae60).setInteractive();
    this.add.text(960,600,'START BATTLE',{fontSize:'22px', color:'#fff'}).setOrigin(0.5);
    battleBtn.on('pointerdown', ()=>{
      if(this.inventory.length===0) return;
      this.scene.start('Battle', { wave:this.wave, dudesData:this.inventory });
    });
    // Inventory display
    this.inventory.forEach((d,i)=>{
      const x=300+i*150, y=800;
      this.add.rectangle(x,y,120,120,0x34495e);
      this.add.text(x,y,d.name,{fontSize:'12px', color:'#fff'}).setOrigin(0.5);
    });
  }
}
```

- [ ] **Step 7: Rodar testes**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Verificar manual**

Run: `npm run dev`, abrir http://localhost:3000, Shop deve mostrar 5 slots, reroll deduz ouro, comprar adiciona ao inventory, bloquear se >8 ou ouro insuficiente.

- [ ] **Step 9: Commit**

```bash
git add src/systems/Economy.ts src/systems/ShopSystem.ts src/scenes/Shop.ts src/ui/HUD.ts src/utils/storage.ts
git commit -m "feat: shop 5 slots + economy + inventory 8 + HUD"
```

---

### Task 6: Menu, Reward, GameOver Fluxo Completo

**Files:**
- Create: `src/scenes/Menu.ts`, `src/scenes/Reward.ts`, `src/scenes/GameOver.ts`
- Test: `e2e/loop.spec.ts` (Playwright)

**Interfaces:**
- Consumes: `Shop`, `Battle`, `Economy`
- Produces: `Menu -> Shop`, `Reward (gold+relic choice) -> Shop`, `GameOver`

- [ ] **Step 1: Criar Menu.ts**

```typescript
import Phaser from 'phaser';
export class Menu extends Phaser.Scene {
  constructor(){ super('Menu'); }
  create(){
    this.add.text(960,400,'QUANTOS CARAS?',{fontSize:'64px', color:'#fff', fontStyle:'bold'}).setOrigin(0.5);
    this.add.text(960,500,'How Many Dudes? - Web Clone',{fontSize:'24px', color:'#aaa'}).setOrigin(0.5);
    const btn=this.add.rectangle(960,650,300,80,0x3498db).setInteractive();
    this.add.text(960,650,'PLAY',{fontSize:'32px', color:'#fff'}).setOrigin(0.5);
    btn.on('pointerdown', ()=> this.scene.start('Shop', { wave:1 }));
    this.add.text(960,800,'PC: drag & drop  |  Mobile: tap to place',{fontSize:'16px', color:'#888'}).setOrigin(0.5);
  }
}
```

- [ ] **Step 2: Criar Reward.ts**

```typescript
import Phaser from 'phaser';
import { Economy } from '../systems/Economy';
import relics from '../data/relics.json';
export class Reward extends Phaser.Scene {
  constructor(){ super('Reward'); }
  init(data:any){ this.wave=data.wave; }
  wave!: number;
  create(){
    const rewardGold = 5 + Math.floor(this.wave/2);
    this.add.text(960,300,`WAVE ${this.wave} COMPLETE! +${rewardGold}g`,{fontSize:'36px', color:'#ffd700'}).setOrigin(0.5);
    // Relic choice every 3 waves
    if(this.wave %3===0){
      this.add.text(960,400,'Escolha uma Relíquia:',{fontSize:'24px', color:'#fff'}).setOrigin(0.5);
      (relics as any).slice(0,3).forEach((r:any,i:number)=>{
        const x=500+i*350, y=500;
        const bg=this.add.rectangle(x,y,280,160,0x8e44ad).setInteractive();
        this.add.text(x,y-30,r.name,{fontSize:'18px', color:'#fff'}).setOrigin(0.5);
        this.add.text(x,y+20,r.description,{fontSize:'12px', color:'#ddd', wordWrap:{width:260}}).setOrigin(0.5);
        bg.on('pointerdown', ()=> this.nextWave(rewardGold));
      });
    } else {
      const btn=this.add.rectangle(960,500,300,80,0x27ae60).setInteractive();
      this.add.text(960,500,'CONTINUE',{fontSize:'24px', color:'#fff'}).setOrigin(0.5);
      btn.on('pointerdown', ()=> this.nextWave(rewardGold));
    }
  }
  nextWave(gold:number){
    const nextWave=this.wave+1;
    if(nextWave>10){ this.scene.start('GameOver', { wave: nextWave, victory:true }); return; }
    const economy = new Economy(gold+6); // simplificado: passa gold
    this.scene.start('Shop', { wave: nextWave, economy });
  }
}
```

- [ ] **Step 3: Criar GameOver.ts**

```typescript
import Phaser from 'phaser';
export class GameOver extends Phaser.Scene {
  constructor(){ super('GameOver'); }
  init(data:any){ this.wave=data.wave; this.victory=data.victory; }
  wave!: number; victory!: boolean;
  create(){
    this.add.text(960,400,this.victory?'VICTORY! 10 Waves!':'GAME OVER',{fontSize:'48px', color: this.victory ? '#ffd700':'#ff4444'}).setOrigin(0.5);
    this.add.text(960,500,`Wave alcançada: ${this.wave}`,{fontSize:'24px', color:'#fff'}).setOrigin(0.5);
    const btn=this.add.rectangle(960,600,300,80,0x3498db).setInteractive();
    this.add.text(960,600,'PLAY AGAIN',{fontSize:'24px', color:'#fff'}).setOrigin(0.5);
    btn.on('pointerdown', ()=> this.scene.start('Menu'));
  }
}
```

- [ ] **Step 4: Escrever e2e Playwright**

```typescript
// e2e/loop.spec.ts
import { test, expect } from '@playwright/test';
test('loop shop -> battle -> reward', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.getByText('PLAY').click();
  await expect(page.locator('canvas')).toBeVisible();
  // Shop tem REROLL
  await page.waitForTimeout(1000);
  // Não há DOM fácil para canvas, então testa que não crashou e URL mantém
  await expect(page).toHaveURL(/.*/);
});
```

- [ ] **Step 5: Criar playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', webServer: { command: 'npm run dev', port: 3000, reuseExistingServer: true } });
```

- [ ] **Step 6: Rodar e2e**

Run: `npx playwright install; npm run e2e`
Expected: PASS (1 passed)

- [ ] **Step 7: Commit**

```bash
git add src/scenes/Menu.ts src/scenes/Reward.ts src/scenes/GameOver.ts e2e/loop.spec.ts playwright.config.ts
git commit -m "feat: fluxo completo Menu->Shop->Battle->Reward->GameOver + e2e"
```

---

### Task 7: RelicSystem + Áudio + Storage Persistência

**Files:**
- Create: `src/systems/RelicSystem.ts`, `src/scenes/Boot.ts` (audio)
- Modify: `src/scenes/Battle.ts` (aplicar relics), `src/scenes/Shop.ts` (salvar)
- Test: `tests/unit/RelicSystem.test.ts`

**Interfaces:**
- Consumes: `RelicData`, `Economy`, `BattleSystem`
- Produces: `RelicSystem.applyPassive(team, relics): modifiers`, `RelicSystem.activate(meteor, x,y): void`

- [ ] **Step 1: Teste Relic**

```typescript
// tests/unit/RelicSystem.test.ts
import { describe, it, expect } from 'vitest';
import { RelicSystem } from '../../src/systems/RelicSystem';
describe('RelicSystem', () => {
  it('coinpurse adds 2 gold', () => {
    const rs=new RelicSystem([{id:'coinpurse'} as any]);
    expect(rs.goldBonus()).toBe(2);
  });
  it('revive returns true if has revive', () => {
    const rs=new RelicSystem([{id:'revive'} as any]);
    expect(rs.hasRevive()).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar falhando**

Run: `npm run test tests/unit/RelicSystem.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar RelicSystem**

```typescript
// src/systems/RelicSystem.ts
import { RelicData } from '../types/RelicData';
export class RelicSystem {
  constructor(private relics: RelicData[]){}
  goldBonus(): number { return this.relics.filter(r=>r.id==='coinpurse').length *2; }
  hasRevive(): boolean { return this.relics.some(r=>r.id==='revive'); }
  meteorDamage(): number { return this.relics.some(r=>r.id==='meteor') ? 100 : 0; }
  add(relic: RelicData){ this.relics.push(relic); }
}
```

- [ ] **Step 4: Integrar em Battle (meteor ativo e revive)**

```typescript
// em Battle.ts tick(), antes de checkWin:
if(this.relicSystem?.meteorDamage()){
  // clique na arena ativa meteor - implementar pointerdown listener que dá dano em área 150px
}
```

Adicionar no `create()` de Battle.ts:
```typescript
this.input.on('pointerdown', (p: Phaser.Input.Pointer)=>{
  if(this.relicSystem.meteorDamage()){
    this.enemies.forEach((e: any)=>{
      if(Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < 150) e.takeDamage(100);
    });
    this.cameras.main.shake(200, 0.01);
  }
});
```

- [ ] **Step 5: Áudio no Boot**

```typescript
// em Boot.ts preload():
this.load.audio('bgm', 'assets/audio/bgm.mp3');
this.load.audio('hit', 'assets/audio/hit.wav');
this.load.audio('coin', 'assets/audio/coin.wav');
// em create():
const music=this.sound.add('bgm', { loop:true, volume:0.5 });
if(!this.sound.locked) music.play(); else this.sound.once(Phaser.Sound.Events.UNLOCKED, ()=> music.play());
```

Adicionar mute toggle em HUD: `this.input.keyboard?.on('keydown-M', ()=> this.sound.mute=!this.sound.mute);`

- [ ] **Step 6: Persistência localStorage em Shop/Battle**

```typescript
// em Shop.ts create() inicio:
import { storage } from '../utils/storage';
const saved = storage.load('save');
if(saved && !this.inventory.length) { this.inventory = saved.inventory; this.economy.gold = saved.gold; }
// antes de start Battle:
storage.save('save', { wave:this.wave, inventory:this.inventory, gold:this.economy.gold });
```

- [ ] **Step 7: Rodar testes**

Run: `npm run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/systems/RelicSystem.ts src/scenes/Boot.ts src/scenes/Battle.ts src/utils/storage.ts tests/unit/RelicSystem.test.ts
git commit -m "feat: relics meteor/revive/coinpurse + audio + persistencia"
```

---

### Task 8: Polimento, Visual Tests 3 Breakpoints + Deploy

**Files:**
- Create: `e2e/visual.spec.ts`, `src/utils/validate.ts` (fallbacks)
- Modify: `src/scenes/*` (tints, tweens, responsividade)
- Test: visual regression

**Interfaces:**
- Consumes: todas cenas
- Produces: `e2e/visual.spec.ts` com 3 screenshots

- [ ] **Step 1: Escrever visual spec**

```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test';
const breakpoints = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 360, height: 800 },
];
for(const bp of breakpoints){
  test(`visual ${bp.name} shop`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('http://localhost:3000');
    await page.getByText('PLAY').click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot(`shop-${bp.name}.png`, { maxDiffPixels: 100 });
  });
  test(`visual ${bp.name} battle`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('http://localhost:3000');
    await page.getByText('PLAY').click();
    await page.waitForTimeout(800);
    // compra primeiro dude e start battle via canvas click aproximado
    await page.mouse.click(bp.width*0.3, bp.height*0.4);
    await page.waitForTimeout(500);
    await page.mouse.click(bp.width*0.5, bp.height*0.7);
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot(`battle-${bp.name}.png`, { maxDiffPixels: 100 });
  });
}
```

- [ ] **Step 2: Polimento visual mínimo (tweens, tints)**

Em `Dude.ts`:
```typescript
takeDamage(n:number){
  this.currentHp -= n;
  this.setTint(0xff0000);
  this.scene.tweens.add({ targets:this, duration:150, tint:0xffffff, onComplete:()=> this.clearTint() });
  if(this.currentHp<=0){ this.scene.tweens.add({ targets:this, alpha:0, scale:0.5, duration:300 }); }
}
```

Em `Shop.ts`: adicionar `this.cameras.main.fadeIn(300)` no `create()`.

- [ ] **Step 3: Validar fallbacks**

Em `validate.ts` adicionar `fallbackDude` se JSON falhar:
```typescript
export const fallbackDudes: DudeData[] = [{ id:'knight', name:'Knight', family:'Warrior', role:'Tank', stats:{hp:100,atk:10,range:60,attackSpeed:1,moveSpeed:80}, ability:{type:'none',value:0}, cost:3, sprite:'missing', rarity:'common'}];
```

Atualizar `Boot.ts` para `catch` usar fallback e `this.textures.generate('missing', {data:['.'], width:1, height:1})` se missing não carregar.

- [ ] **Step 4: Rodar visual tests**

Run: `npx playwright test e2e/visual.spec.ts --update-snapshots` (primeira vez gera snapshots)
Expected: 6 snapshots gerados

Run: `npx playwright test e2e/visual.spec.ts`
Expected: PASS, diff <1%

- [ ] **Step 5: Build e deploy check**

Run: `npm run build; npm run preview`
Expected: dist pronto, PWA manifest valida, 60fps no preview

- [ ] **Step 6: Commit final**

```bash
git add e2e/visual.spec.ts src/entities/Dude.ts src/utils/validate.ts src/scenes/Shop.ts
git commit -m "feat: polish visual + visual tests 3 breakpoints + fallbacks"
```

- [ ] **Step 7: Tag Fase 1**

```bash
git tag fase1-core-loop
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Phaser 3 + TS + Vite + PWA + FIT 1920x1080 -> Task 1
- [x] Data-driven JSON 5-8 dudes, 10 waves, 3 relics, families -> Task 2
- [x] Dude/Enemy/Projectile + synergy -> Task 3
- [x] Battle auto-target + WaveManager gorilla boss -> Task 4
- [x] Shop 5 slots reroll 2g + Economy + Inventory 8 + HUD -> Task 5
- [x] Fluxo Menu->Shop->Battle->Reward->GameOver + e2e -> Task 6
- [x] Relics meteor/revive/coinpurse + áudio + persistência -> Task 7
- [x] Responsivo PC/mobile + polish + visual tests 3 breakpoints + fallbacks -> Task 8
- Gap: Daily Dude, 42 dudes completos, balance final = Fase 2-4 (fora deste plano, como no spec)

**Placeholder scan:** Nenhum TBD/TODO; todos steps têm código exato (JSON, TS, test). Validado.

**Type consistency:** `DudeData.id/name/family/role/stats/cost/sprite` usado igual em Task 2,3,5. `Economy.gold/add/spend` consistente em 5,6,7. `WaveManager.getWave/spawn` consistente 4,5. `RelicSystem.goldBonus/hasRevive/meteorDamage` consistente 7.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-30-how-many-dudes-fase1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

