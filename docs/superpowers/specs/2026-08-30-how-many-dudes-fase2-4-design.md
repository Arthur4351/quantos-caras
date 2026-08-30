# How Many Dudes? - Fase 2-4 - Clone Completo (42 Dudes + Meta)

**Data:** 2026-08-30
**Status:** Aprovado (Fase 2-4 combinadas)
**Fase anterior:** Fase 1 Core Loop entregue (5 dudes, 10 waves, 3 relics, build 29 módulos)
**Plataforma:** Web PC+Mobile, Phaser 3 + TS + Vite + PWA
**Repositório:** `quantos caras` (master, tag fase1-core-loop)

---

## 1. Visão Geral

Completar o clone fiel do How Many Dudes? de 5 dudes MVP para o jogo completo:
- **42 Dude types** em 6 famílias (Undead, Employed, Warrior, Fantasy, Sci-Fi, Action) como no original, ~850k combos
- **100+ waves** com scaling exponencial, bosses a cada 10 (Gorila wave10, Deus wave100), inimigos toddler/wolf/gorila/deus + variações
- **15 Relics + 10 Trinkets** com efeitos únicos, Wandering Dude events
- **Meta:** Silver/Gold stars por wave, Daily Dude (seed diário), achievements, persistência completa
- **Áudio/Visual final:** SFX reais, BGM 2 faixas, sprites 2D charming finais (Kenney + custom 64x64), 60fps mobile

Este spec cobre Fase 2 (42 dudes/sinergias), Fase 3 (relics/meta/100 waves), Fase 4 (polish/balance) em um documento para execução contínua.

---

## 2. Arquitetura Técnica (Reuso Fase 1)

**Stack:** Phaser 3.90 + TS strict + Vite 5 + vite-plugin-pwa + Vitest + Playwright (já em `package.json:1`, `vite.config.ts:1`, `src/config.ts:1` FIT 1920x1080)

**Estrutura mantida:** `src/scenes/` (Boot/Menu/Shop/Battle/Reward/GameOver + DailyDude), `src/systems/` (+ TrinketSystem, AchievementSystem, DailySystem), `src/data/` (expandir json), `src/entities/` (mesmos)

**Novos arquivos:**
- `src/data/dudes_full.json` ou expandir `dudes.json` para 42 (data-driven, `dudeData` já renomeado `src/entities/Dude.ts:4` para evitar colisão `Sprite.data`)
- `src/data/relics_full.json` 15, `src/data/trinkets.json` 10, `src/data/achievements.json`
- `src/systems/TrinketSystem.ts`, `src/systems/AchievementSystem.ts`, `src/systems/DailySystem.ts`, `src/systems/Balance.ts` (curva scaling)
- `src/scenes/DailyDude.ts`

**Config:** manter `phaserConfig` FIT; adicionar `scale: RESIZE` listener para recalcular HUD em `resize` (melhoria C3, `Shop.ts:49` centrado já fixado)

---

## 3. Componentes

### 3.1 Dudes 42 (data-driven)

Cada `DudeData` já tipado `src/types/DudeData.ts:1` com `family: 6, role: Tank/DPS/Support, stats{hp,atk,range,attackSpeed,moveSpeed}, ability, cost 1-5, rarity`

**6 famílias x 7 dudes = 42:**
- **Undead** (7): Zombie, Skeleton, Ghost, Vampire, Lich, Mummy, BoneKnight — sinergia: 2 +20% HP (`calculateHpBonus`), 4 +35% HP, 6 +50% HP + regen 2/s
- **Employed** (7): OfficeGuy, Barista, Cashier, Manager, Intern, Courier, CEO — 2 +1 gold/wave (`calculateGoldBonus`), 4 +2 gold, 6 +3 gold + reroll grátis
- **Warrior** (7): Knight, Barbarian, Samurai, Viking, Gladiator, Monk, Warlord — 2 +15% ATK, 4 +30% ATK, 6 +50% ATK (`calculateSynergyBonus`)
- **Fantasy** (7): Wizard, Elf, Druid, Bard, Paladin, Necro, Dragon — 2 +20% ATK, 4 +35% ATK + 10% crit, 6 +50% ATK + aoe
- **SciFi** (7): Astro, Robot, Cyborg, Alien, Mech, Hacker, StarLord — 2 +15% ATK +10% AS, 4 +30% ATK, 6 +50% ATK
- **Action** (7): Ninja, Pirate, Cowboy, Spy, Athlete, Chef, Dude — 2 +10% tudo, 4 +20%, 6 +35%

Custo/raridade balanceados: 1-2 common, 3-4 rare, 5 epic. `dudes.json` 42 entradas, validar `validateDudes` já em `src/utils/validate.ts:3` (custo >=0, hp>0)

**Sinergia:** usar `Synergy.ts:3` `calculateSynergyBonus` (ATK), `calculateHpBonus`, `calculateGoldBonus` já corrigidos Fase1 fix; `Battle.ts:51` aplica HP bonus ao spawn, dano usa ATK bonus

### 3.2 Inimigos & Waves 100+

`waves.json` expandir de 10 para 100+ via geração procedural + boss picos:

```json
{ "wave": 11, "enemies": [{"type":"toddler","count":18,"hp":38,"atk":7},{"type":"wolf","count":10,"hp":70,"atk":14}], "rewardGold": 11, "isBoss": false }
{ "wave": 10, "enemies": [{"type":"gorilla","count":1,"hp":1200,"atk":35}], "rewardGold": 10, "isBoss": true }
{ "wave": 100, "enemies": [{"type":"god","count":1,"hp":15000,"atk":120}], "rewardGold": 50, "isBoss": true }
```

Curva: `hp = base * (1 + wave*0.12 + wave^2*0.001)`, `count = base + floor(wave*0.8)` para toddler/wolf, boss `hp = 800* (1+ wave*0.15)`. `WaveManager.ts:1` `getWave(n)` já busca, falta `generateWave(n)` se >100

Novos tipos: `toddler` (20hp), `wolf` (40hp), `gorilla` (800hp), `duck` horse-sized (200hp), `god` (5000hp) — sprites tint diferentes, `Enemy.ts:1` já `type` e `atk`

### 3.3 Relics 15 + Trinkets 10

`relics.json` expandir 3→15 (ativa/passiva), `trinkets.json` novo:

**Relics (exemplos 15):**
- Meteor (100 area), Revive (50% 1x), CoinPurse (+2g) — já
- Shield (+20% HP team), Sword (+15% ATK), Hourglass (+20% AS), Magnet (+1 reroll free), Crown (sinergia -1 requerido), Anvil (custo -1), Book (XP +), Feather (moveSpeed +30%), Heart (regen 1/s), Bomb (aoe 50 em cada 10s), Dice (reroll 1g), Telescope (range +30)

**Trinkets (10, equip 1 por dude):**
- Gloves (+5 ATK), Boots (+20 move), Glasses (+30 range), Bandage (+20 HP), Battery (+15% AS), Charm (+10% crit), etc. `TrinketSystem.ts` gerencia equip

`RelicSystem.ts:1` já `goldBonus/hasRevive/meteorDamage/hasMeteor`, expandir para `attackBonus/defenseBonus` etc. `TrinketSystem` similar, `Battle.ts:64` meteor já, adicionar outros passivos em `Battle.create` e `tick`

Wandering Dude event a cada 10 waves: escolha 1 de 3 dudes grátis ou relic — `Shop.ts` estender após `ShopSystem`

### 3.4 Meta: Stars, Daily, Achievements

- **Stars:** por wave Silver (vence), Gold (vence sem perder dude). `storage` `relics` + `stars.json` `{wave:10: {silver:true,gold:false}}`
- **Daily Dude:** seed diário `DailySystem.ts` `getDailySeed()` = `YYYY-MM-DD` hash, `ShopSystem` com pool fixo diário, leaderboard local `localStorage daily`
- **Achievements** `achievements.json` 12: "First Win", "10 Waves", "Gorilla Slayer", "God Slayer 100", "All Families", "850k combos" etc. `AchievementSystem.ts` checa em `Reward.ts` e `GameOver.ts`
- **Persistência:** `storage.ts:1` já `save/load/clear`, expandir para `save:{wave, inventory: DudeData[], gold, relics: RelicData[], trinkets, stars, achievements, dailySeed}`

---

## 4. Visual, UX & Áudio Final

**Estilo:** 2D charming fiel, sprites 64x64 Kenney `Tiny Dungeon` + custom, paleta quente, contorno suave. Fase1 placeholder `missing.png` 70b → Fase 2-4 usar spritesheets `public/assets/sprites/dudes_atlas.png` + `dudes_atlas.json` ( TexturePacker)

**Animações:** `Dude.ts:21` já `takeDamage` tint/shake + `heal`, adicionar `attack` frame + `idle` breathing tween loop, `Enemy` similar, `Projectile.ts:1` já existe para wizard/astro `range>100` (integrar: se `dudeData.range>100` cria `Projectile` em `Battle.tick` ao invés de `takeDamage` direto)

**UX:** Shop já centrado `Shop.ts:49` + `VENDER` mobile; melhorar: drag & drop arena livre 1200x600 (opcional), `HUD.ts:1` já; adicionar `DailyDude` botão no `Menu.ts:1`, pause, mute `M` já `Battle.ts:98`/`Shop.ts:159`

**Áudio final:** substituir dummy 44b `public/assets/audio/*.wav` (fix I5) por CC0 reais: `bgm.mp3` loop 120s, `hit.wav`, `coin.wav`, `meteor.wav`, `win.wav`, `lose.wav` de freesound/kenney, `Boot.ts:11` `load.audio` já com `loaderror` fallback

**Responsivo:** FIT já + `Shop.ts:49` centrado; melhorar `Battle.ts` arena `add.rectangle(960,540,1400,700)` já, mas `WaveManager.spawn` `1200+random*500` pode sair da arena em mobile scaled — clamp para `960±600`. HUD anchors relativos já `HUD.ts:1` (50,1870)

---

## 5. Erros, Testes & Roteiro

**Erros:** validar 42 dudes `validateDudes` (custo 1-5, hp 30-200), fallback para 5 Fase1 se falhar, `storage` try/catch toast, clamp ouro, `Projectile` cleanup `destroy` quando target morto, FPS <30 reduz partículas

**Testes:**
- Unit Vitest (jsdom, `tests/setup.ts:1` canvas mock): `Synergy` 6→ testar 4/6 sinergia, `Balance` curva, `RelicSystem` novos bônus, `TrinketSystem`, `DailySystem` seed, `Achievement` unlock
- E2E Playwright: `loop` já 2 PASS, `visual` 6 PASS com `animations:allow` — manter, adicionar `DailyDude` e `100 waves` smoke
- Build `vite build` 29→ ~35 módulos, PWA 9→15 entries

**Roteiro Fase 2-4 combinadas (estimado 10 dias, 8 tasks):**
- T1: Dudes 42 data + families 6 completo + Balance
- T2: WaveManager 100+ procedural + bosses
- T3: Relics 15 + Trinkets 10 + Wandering Dude
- T4: Projectile integrado + Battle HP/AS/range real
- T5: DailySystem seed + Shop pool diário
- T6: AchievementSystem + Stars Gold/Silver
- T7: Áudio real + sprites atlas + animações
- T8: Balance final, otimização, visual tests update, deploy

**Critérios aceite Fase 2-4:**
- 42 dudes compráveis, 6 sinergias 2/4/6 funcionando (testado `Synergy` 6 testes)
- 100 waves jogáveis, gorila 10 e deus 100 derrotáveis, curva não exponencial impossível
- 15 relics + 10 trinkets equipáveis, Wandering a cada 10
- Daily seed igual para todos no mesmo dia, stars Silver/Gold persistidos
- 60fps em Moto G 2022 com 8 dudes vs 30 enemies, build <1.6MB gzip <350kB
- tsc 0, 33+ new unit testes PASS, e2e loop+visual PASS

**Riscos:**
- 42 dudes desbalanceado → mitigar `Balance.ts` com simulação 1000 batalhas
- Áudio 2MB → usar ogg/mp3 comprimido, lazy load
- Bundle 1.5MB → `manualChunks` phaser separado (M1)

---

**Aprovações:** Fase1 entregue (tag fase1-core-loop, 93de8e6 com fixes). Próximo: `writing-plans` para Fase 2-4.
