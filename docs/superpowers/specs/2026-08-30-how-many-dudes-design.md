# How Many Dudes? - Clone Web Fiel - Design Doc

**Data:** 2026-08-30
**Status:** Aprovado (5/5 seções)
**Fase:** Fase 1 - Core Loop (MVP jogável) dentro de Clone Completo em 4 fases
**Plataforma:** Web (PC + Mobile responsivo)
**Stack:** Phaser 3 + TypeScript + Vite + PWA
**Repositório:** `quantos caras` (branch master, sem commits prévios)

---

## 1. Visão Geral & Decomposição

### 1.1 Objetivo
Recriar de forma fiel o jogo **How Many Dudes?** da Butterscotch Shenanigans (lançado 30/07/2026, Steam) como jogo web jogável no navegador, com porte para PC e celular. O original é um roguelike autobattler "dudebuilder": recruta exército de 42 Dude types em 6 famílias (Undead, Employed, Warrior, Fantasy, Sci-Fi, Action), combina roles/efeitos, coleta Relics/Trinkets, enfrenta waves crescentes (toddlers, lobos, gorila, deus).

### 1.2 Classificação
**Arquitetural** - novo projeto do zero, sem fluxo existente, subsistema completo.

### 1.3 Por que decompor?
Clone completo 1:1 = 42 dudes + 6 famílias + 850k+ combos + relics + balanceamento + modos (Daily Dude, etc.) = projeto de meses. Tentar em um spec só gera escopo difuso e risco de não entregar jogável.

### 1.4 Fases (4)
- **Fase 1 - Core Loop (este spec):** Loop jogável 10 waves, 5-8 dudes (1-2 por família), shop 5 slots, ouro, arena autobattle, 3 relics stub, deploy PWA. Objetivo: 60fps mobile médio, data-driven.
- **Fase 2 - Famílias & Sinergias:** Expandir para 42 dudes completos, 6 famílias com bônus de sinergia (ex: 3 Undead = +20% HP), roles, scaling, balanceamento.
- **Fase 3 - Relics, Trinkets, Eventos & Meta:** Sistema completo de relics/trinkets, Wandering Dude events, economia, estrelas Silver/Gold, persistência meta, 100+ waves.
- **Fase 4 - Polish, Balance, Modos & Áudio Final:** Áudio final, Daily Dude, achievements, Twitch/leaderboard stub, otimização, testes visuais completos, ajustes de arte 2D charming final.

Cada fase tem spec -> plan -> implementação própria. Este doc cobre Fase 1 com hooks para expandir.

---

## 2. Arquitetura Técnica

### 2.1 Stack Recomendada (Aprovada)
- **Engine:** Phaser 3.90+ (render WebGL/Canvas, cenas, sprites, tweens, input unificado)
- **Linguagem:** TypeScript 5.5 strict
- **Bundler:** Vite 5 + `vite-plugin-pwa`
- **Áudio:** Howler.js ou Phaser Sound (WebAudio) - BGM loop + SFX
- **Persistência:** localStorage (save: ouro, wave, time, relics) + futuro backend opcional
- **Deploy:** Build estático em Vercel/Netlify/Cloudflare Pages
- **PWA:** manifest + service worker para instalar no celular, offline cache de assets

**Alternativas descartadas:**
- React + Canvas: bom para UI complexa, mas mais boilerplate e overhead para autobattler; Phaser já tem UI.
- Vanilla JS Canvas: leve mas reimplementa cena/input/asset loader; não escala para 42 dudes.

### 2.2 Estrutura de Pastas
```
/src
  /scenes { Boot.ts, Menu.ts, Shop.ts, Battle.ts, Reward.ts, GameOver.ts }
  /entities { Dude.ts, Enemy.ts, Projectile.ts }
  /systems { BattleSystem.ts, WaveManager.ts, ShopSystem.ts, RelicSystem.ts, Economy.ts, Synergy.ts }
  /data { dudes.json, waves.json, relics.json, families.json }
  /assets { spritesheets, audio, fonts }
  /ui { HUD.ts, ShopUI.ts } // Phaser GameObjects + DOM opcional
  main.ts, config.ts
/public/assets
/index.html
```

### 2.3 Configuração Phaser
- `type: Phaser.AUTO`, `width: 1920, height: 1080`, `scale: { mode: Phaser.Scale.FIT, autoCenter: CENTER_BOTH }`
- `backgroundColor: '#1a1a2e'`, `physics: { default: 'arcade', arcade: { debug: false } }`
- Cenas em sequência: Boot (preload) -> Menu -> Shop -> Battle -> Reward -> loop até GameOver
- Input: `this.input` unificado (pointerdown = mouse + touch), drag para PC, tap-to-place para mobile

### 2.4 Responsividade
- Canvas FIT escala automaticamente.
- UI com anchors relativos (ex: `x: width * 0.9, y: height * 0.1`).
- Breakpoints lógicos: Desktop >=1024px (arena + shop lado a lado), Tablet 768-1023 (arena topo, shop grade 3 col), Mobile <=767 (arena topo, shop 2 col scroll).
- Teste em 3 resoluções: 1920x1080, 768x1024, 360x800.

---

## 3. Componentes & Fluxo de Dados (Fase 1)

### 3.1 Entidades Data-Driven (JSON)
Tudo configurável sem código, para escalar de 8 para 42 dudes editando JSON.

**`dudes.json` exemplo:**
```json
{
  "id": "knight",
  "name": "Knight Dude",
  "family": "Warrior",
  "role": "Tank",
  "stats": { "hp": 120, "atk": 18, "range": 60, "attackSpeed": 0.9, "moveSpeed": 80 },
  "ability": { "type": "shieldBlock", "value": 0.2 },
  "cost": 3,
  "sprite": "knight.png",
  "rarity": "common"
}
```
**Fase 1 contém 5-8 dudes:** knight (Warrior), zombie (Undead), officeGuy (Employed), wizard (Fantasy), astro (Sci-Fi) + 2 variações. Famílias iniciais: Warrior, Undead, Employed (stub para outras).

**`families.json`:**
```json
{ "Warrior": { "color": "#c0392b", "synergy": [{ "count": 2, "bonus": " +15% ATK" }] } }
```

**`waves.json`:**
```json
{ "wave": 1, "enemies": [{ "type": "toddler", "count": 8, "hp": 20 }], "rewardGold": 5 }
```
Fase 1: Waves 1-3 toddlers, 4-6 wolves, 7-9 mixed, 10 gorilla boss (HP 800).

**`relics.json` (stub 3 relics Fase 1):**
- Meteor (ativa: causa 100 dano em área clicável)
- Revive (passiva: revive 1 dude com 50% HP por batalha)
- Coin Purse (+2 ouro por wave)

### 3.2 Sistemas

**Dude (Entity):**
- Props: `id, family, role, stats, currentHp, pos, target, cooldown`
- Métodos: `findTarget(enemies), attack(), takeDamage(), die()`
- Render: `Phaser.GameObjects.Sprite` com anims `idle, attack, hit, die` (spritesheet 64x64, 4 frames cada)

**Enemy:** similar a Dude, mas com AI simples (move para dude mais próximo, ataca).

**BattleSystem:**
- Grid posicional livre (arena 1200x600), sem tile lock Fase 1 (posicionamento drag & drop).
- Loop: cada dude/enemy busca alvo mais próximo em range, ataca em cooldown, projéteis (se ranged) via `Phaser.Physics.Arcade`.
- Colisão: arcade overlap, dano = `atk * (1 + synergyBonus) * relicModifier`.
- Vitória: todos enemies mortos. Derrota: todos dudes mortos -> GameOver.

**WaveManager:**
- Carrega `waves.json`, spawna enemies com HP escalado `baseHp * (1 + wave*0.15)`.
- Notifica BattleSystem, aguarda resultado, concede `rewardGold`.

**ShopSystem & Economy:**
- Shop com 5 slots random de pool de dudes (peso por raridade), `reroll` custa 2 ouro.
- Comprar: deduz `cost`, adiciona a `Inventory` (max 8). Vender: devolve `cost-1`.
- Ouro inicial 6, + reward por wave.

**Inventory:** array `Dude[]` max 8, posicionamento em arena via `x,y`.

**RelicSystem (stub Fase 1):** ao vencer wave 3/6/9, escolhe 1 de 3 relics. Aplica efeitos passivos/ativos no BattleSystem.

### 3.3 Fluxo Principal
```
Boot (preload sprites/audio/json) 
 -> Menu (Play) 
 -> Shop (buy/reroll/posiciona) -> [Battle] -> Reward (ouro + relic se wave elegível) -> Shop (loop)
 -> GameOver (se derrota) -> mostra wave alcançada, botão Restart/Menu
```
Dados fluem via `Registry` ou singleton `GameState` (wave, gold, inventory, relics, synergy).

### 3.4 Artefatos Técnicos
- Asset loader em Boot com `this.load.json`, `this.load.spritesheet`, `this.load.audio`.
- Validação JSON em runtime (ver seção 5).
- Tudo tipado: `types/DudeData.ts`, `types/WaveData.ts`.

---

## 4. Visual, UX & Áudio

### 4.1 Estilo Visual
- **Direção:** 2D charming fiel ao original Butterscotch (paleta quente, contornos suaves, personagens cabeçudos fofos, não pixel art cru).
- **Fase 1 placeholders:** Kenney.nl (Tiny Dungeon, etc.) + emojis customizados mas já em `spritesheet` 64x64 para troca 1:1 sem refatorar código. Ex: knight = kenney knight, zombie = kenney zombie recolor.
- **Animações:** 4 frames idle (breathing), 3 frames attack (swing), 2 frames hit (flash vermelho via tint), die (fade + scale). Via `this.anims.create` e `Phaser.Tweens`.
- **Arena:** fundo gramado simples, bordas arena, sombra dos dudes.
- **UI:** HUD topo (wave, ouro, vida boss), Shop em painel semi-transparente, botões grandes para touch (min 44px).

### 4.2 UX Responsiva
- **PC:** drag & drop de Inventory para arena, hover mostra stats, click para comprar.
- **Mobile:** tap no dude no shop -> tap na arena para posicionar, drag funciona também, botão Reroll grande no rodapé. Shop scroll vertical.
- **Feedback:** SFX `buy`, `reroll`, `hit`, `win`, `lose`; tween de ouro +1 flutuante; shake de câmera ao hit boss.
- **Acessibilidade Fase 1:** contraste alto, tutorial overlay na primeira wave ("Arraste dudes para arena!").

### 4.3 Áudio
- BGM loop chill (1 faixa Fase 1, royalty-free), volume 0.5
- SFX: `attack.wav`, `hit.wav`, `coin.wav`, `meteor.wav` (Howler/Phaser Sound)
- Mute toggle no HUD (persiste em localStorage)

---

## 5. Erros, Testes & Roteiro

### 5.1 Tratamento de Erros
- **JSON inválido:** `try/catch` ao parse, `zod` opcional para validar schema; se falhar, loga e usa fallback default dude/wave, mostra toast "Dados inválidos, usando padrão".
- **Asset faltando:** `this.load.on('loaderror')` -> substitui por sprite `missing.png` (quadrado rosa) e segue; não quebra boot.
- **Economia:** clamp `gold = Math.max(0, gold)`, impede comprar se `gold < cost`, desabilita botão.
- **Battle:** se `inventory.length === 0` ao iniciar battle, bloqueia e mostra "Coloque pelo menos 1 dude!".
- **LocalStorage corrompido:** try/catch parse, se erro apaga save e recomeça.
- **Performance:** se FPS < 30 por 5s, reduz partículas/shake automaticamente.

### 5.2 Testes (Revisado com visuais)
- **Unit (Vitest):** `BattleSystem.test.ts` (cálculo dano, synergy 2 Warrior = +15% ATK), `WaveManager.test.ts` (spawn count/HP), `Economy.test.ts` (reroll custo, clamp ouro).
- **Integração:** `shop->battle` flow (compra dude, posiciona, vence wave 1).
- **E2E (Playwright):** `e2e/loop.spec.ts` - inicia Menu -> Shop compra knight -> posiciona -> Battle vence wave 1 -> Reward aparece. Roda em chromium.
- **Visuais (Playwright Visual / Chromatic):** screenshot comparativo em 3 breakpoints:
  - Desktop 1920x1080 (Shop + Battle lado a lado)
  - Tablet 768x1024 (arena topo, shop grade)
  - Mobile 360x800 (arena topo, shop scroll)
  - Valida que sprites, animações e layout não quebram; regressão ao trocar assets (trocar spritesheet não deve quebrar snapshot >1% diff).
  - Rodar em CI (GitHub Actions) a cada PR.
- **Performance:** teste manual com 8 dudes vs 20 toddlers, verificar `FPS >= 60` via `this.game.loop.actualFps` log.

### 5.3 Roteiro Fase 1 (2 semanas estimado)
- **Sprint 1 (dias 1-3) Setup:** Vite + TS + Phaser + PWA + estrutura pastas + Boot preload + Menu + deploy hello world.
- **Sprint 2 (dias 4-6) Dude+Battle:** Entidade Dude/Enemy, BattleSystem auto-target, projéteis, arena, anims placeholder.
- **Sprint 3 (dias 7-9) Shop+Economy:** Shop 5 slots, reroll, compra/venda, Inventory 8, posicionamento drag/tap, ouro.
- **Sprint 4 (dias 10-12) Waves+Inimigos:** WaveManager 10 waves, toddler/wolf/gorilla, balance HP, condição vitória/derrota, GameOver.
- **Sprint 5 (dias 13-14) Relics+Polish+Testes+Deploy:** 3 relics stub, BGM/SFX, HUD, PWA, testes unit/e2e/visual, deploy Vercel.
- **Critérios de aceite Fase 1:** Loop 10 waves jogável sem crash, 60fps em Moto G ~2022, data-driven (adicionar dude = editar JSON + spritesheet), screenshots visuais passando nos 3 breakpoints, PWA instalável.

### 5.4 Métricas de Sucesso (Fase 1)
- FPS médio >= 55 em mobile médio
- Tempo até primeira batalha < 3s após preload
- 100% dos dudes/waves/relics via JSON (nenhum hardcoded)
- Testes: 80% coverage em systems, 1 e2e passando, 3 snapshots visuais estáveis

### 5.5 Riscos & Mitigações
- **Escopo creep (querer 42 dudes já):** mitigado por JSON data-driven - Fase 1 já prepara estrutura.
- **Arte fiel demorada:** placeholders Kenney permitem avançar mecânica; troca é só asset.
- **Performance mobile:** limitar partículas, usar spritesheet atlas, desabilitar physics debug.

---

## 6. Próximos Passos (Fora deste spec)
Após Fase 1 aprovada e implementada, criar specs Fase 2-4:
- Fase 2 spec: detalhar 42 dudes, 6 famílias synergies, balance sheet.
- Fase 3 spec: relics/trinkets completos, eventos, meta progression.
- Fase 4 spec: Daily Dude, achievements, arte final, balance final.

---

## 7. Referências Pesquisadas
- Steam How Many Dudes? (Butterscotch Shenanigans, 30/07/2026, autobattler roguelike, 42 dudes 6 famílias, 850k combos) - https://store.steampowered.com/app/3934270/How_Many_Dudes/
- ActivePlayer, SteamDB charts (1800+ concurrent, peak 9818)
- howmanydudes.org (fã-site, waves 100+, relics/trinkets, mobile Android/iOS)
- itch.io pre-alpha demo (GMTK 2025)
- Segundo jogo homônimo puzzle de contagem (não é o alvo, mas distinção importante)

---

**Aprovações:** 5/5 seções aprovadas pelo solicitante (inclui revisão de testes visuais e porte PC+mobile).
**Próximo gate:** `writing-plans` skill para plano de implementação Fase 1.
