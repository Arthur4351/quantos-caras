import Phaser from 'phaser';
import { Economy } from '../systems/Economy';
import { storage } from '../utils/storage';
import { RelicSystem } from '../systems/RelicSystem';
import { calculateGoldBonus } from '../systems/Synergy';
import { AchievementSystem } from '../systems/AchievementSystem';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, panelImage, statPill, toast } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { GOLD, GREEN, INK, ORANGE, PAPER, PAPER_DARK, PURPLE, RED, WOOD, fam, famLabel } from '../art/palette';
import { draft, familyCount, relicFamily } from '../systems/RelicShop';
import { WaveManager } from '../systems/WaveManager';
import {
  countById, uniqueOwned, TrainedMap, trainLevel,
  HERO_EVERY, HERO_ID, heroGrantAt, grantHero
} from '../systems/RunState';
import { RelicData } from '../types/RelicData';

export class Reward extends Phaser.Scene {
  wave = 1;
  dudesData: any[] = [];
  economy?: Economy;
  /** Vitoria sem nenhum cara caido — condicao da estrela de ouro. */
  noDeath = false;
  /** Ouro catado no chao da briga pelo caixa. Ver `init`. */
  private battleGold = 0;
  /** Treino do treinador: permanente, atravessa a run inteira. */
  private trained: TrainedMap = {};
  private selected = false;

  constructor() { super('Reward'); }

  init(data: any) {
    this.wave = data.wave ?? 1;
    this.dudesData = data.dudesData ?? data.inventory ?? [];
    /**
     * `economy` chega de tres formas diferentes no projeto: uma `Economy` de
     * verdade (`Reward.nextWave` -> Shop), um objeto cru `{ gold }` (`Battle.init`
     * monta assim a partir do save) ou NADA (a Battle nao passa economia para a
     * recompensa). Normaliza aqui: a cena toda depende de `.add()`, e uma batalha
     * ganha nao pode morrer na tela de premio — isso apaga a recompensa E o save
     * da rodada, que e escrito no fim de `recordProgress`.
     */
    this.economy = data.economy instanceof Economy
      ? data.economy
      : new Economy(data.economy?.gold ?? storage.load('save')?.gold ?? 6);
    this.noDeath = !!data.noDeath;
    /**
     * O TROCO DO CAIXA. Ouro catado DENTRO da briga (a moeda que ele arranca da
     * cara do inimigo a cada quatro golpes) chega aqui como um numero cru, e nao
     * como um bonus de planilha: se o caixa morreu no primeiro segundo, nao veio
     * nada.
     */
    this.battleGold = Math.max(0, Math.round(data.bonusGold ?? 0));
    this.trained = data.trained ?? storage.load('save')?.trained ?? {};
    this.selected = false;
  }

  create() {
    this.cameras.main.fadeIn(320, 126, 209, 245);
    buildRanch(this, { horizon: 360, arena: false, clouds: true });

    let rewardGold = new WaveManager().getWave(this.wave).rewardGold;
    const savedRelics = storage.load('relics') || [];
    const relicSystem = new RelicSystem(savedRelics);
    rewardGold += relicSystem.goldBonus();
    rewardGold += calculateGoldBonus(this.dudesData);
    // habilidade goldBonus dos caras contratados
    rewardGold += this.dudesData.reduce(
      (sum: number, d: any) => sum + (d?.ability?.type === 'goldBonus' ? d.ability.value : 0), 0
    );
    rewardGold += this.battleGold;

    if (!this.economy) this.economy = new Economy(storage.load('save')?.gold ?? 6);
    this.economy.add(rewardGold);

    /**
     * O CARA DA DECADA.
     *
     * A cada dez rodadas o rancho ganha mais um CARA, de graca, sem gastar a
     * carta do draft. Tem que entrar ANTES de `recordProgress` — e ele que grava o
     * inventario no save — e antes do rodape, que conta as copias.
     */
    const gainedHero = heroGrantAt(this.wave) ? grantHero(this.dudesData) : 0;

    this.buildHeader(rewardGold);
    this.recordProgress(savedRelics);

    if (gainedHero) this.heroBanner(this.wave % 3 === 0);
    if (this.wave % 3 === 0) this.buildRelicChoice(savedRelics);
    else this.buildContinue();
    this.buildNextWavePreview();
  }

  /**
   * O cartaz do presente, em duas medidas.
   *
   * A tela solta tem a faixa inteira entre o painel da recompensa (acaba em 265) e
   * o botao de continuar: o cartaz sai grande, com flash e toast.
   *
   * Nas waves 30, 60 e 90 o presente cai no MESMO ecra da escolha de reliquia, e ali
   * nao existe faixa livre: o painel das reliquias comeca em 331 e as cartas em 445.
   * O cartaz grande cobria a borda de cima do painel e colava em "ESCOLHA UMA
   * RELIQUIA". Entao ele encolhe para caber exatamente na sobra de 66px (272..324) e
   * abre mao do toast — o recado ja esta escrito na pilula, e a tela esta cheia.
   */
  private heroBanner(tight: boolean): void {
    const n = countById(this.dudesData)[HERO_ID] ?? 1;
    const pill = statPill(this, 960, tight ? 298 : 306,
      `MAIS UM CARA NO RANCHO!  ·  AGORA SAO x${n}`, GOLD,
      tight ? 640 : 700, tight ? 46 : 54, INK).setDepth(160);
    pill.setScale(0.6);
    this.tweens.add({ targets: pill, scale: 1, duration: 380, ease: 'Back.easeOut' });
    this.cameras.main.flash(240, 255, 236, 170);
    if (!tight) toast(this, `+1 CARA  ·  CADA ${HERO_EVERY} RODADAS`, 960, 396, false);
  }

  private buildHeader(rewardGold: number): void {
    panelImage(this, 960, 180, 820, 170, { fill: PAPER, radius: 30 }).setDepth(100);
    statPill(this, 960, 118, 'RECOMPENSA', GOLD, 290, 50, INK).setDepth(101);
    label(this, 960, 178, `WAVE ${this.wave} CONQUISTADA!`, 48, GREEN, true).setDepth(101);
    label(this, 960, 242, `+${rewardGold} OURO  ·  TOTAL ${this.economy?.gold ?? 0}`, 26, INK).setDepth(101);
  }

  private recordProgress(savedRelics: any[]): void {
    try {
      const stars = JSON.parse(localStorage.getItem('stars') || '{}');
      const previous = stars[this.wave] || {};
      stars[this.wave] = { silver: true, gold: previous.gold || this.noDeath };
      localStorage.setItem('stars', JSON.stringify(stars));

      const families = ['Warrior', 'Undead', 'Employed', 'Fantasy', 'SciFi', 'Action'];
      const synergyMax = Math.max(...families.map(family => this.dudesData.filter(dude => dude.family === family).length));
      // `dudesCollected` conta TIPOS (a medalha e "rancho cheio", nao "cinco corpos")
      // e `army` conta corpos — e o numero que da nome ao jogo, ele merece medalha.
      new AchievementSystem().check({
        wave: this.wave,
        victory: true,
        noDeath: this.noDeath,
        dudesCollected: uniqueOwned(this.dudesData).length,
        army: this.dudesData.length,
        relicsCollected: savedRelics.length,
        synergyMax
      });
    } catch { /* corrupted optional meta should not block the reward */ }
    // `snack: null` de proposito: o lanche vale UMA batalha, e ela acabou agora.
    // O treino vai junto — e o unico investimento permanente da run.
    storage.save('save', {
      wave: this.wave + 1,
      inventory: this.dudesData,
      gold: this.economy?.gold ?? 0,
      trained: this.trained,
      snack: null
    });
  }

  /**
   * A LOJA DE RELIQUIAS — a SEGUNDA loja do jogo, e ela nao pode ser a tela de
   * recompensa com tres retangulos de papel em cima.
   *
   * Antes era exatamente isso: um painel de papel igual ao painel do premio logo
   * acima, e tres cartas de papel iguais entre si. Tudo do mesmo material, na
   * mesma cor, na mesma tela — o jogador nao sabia que tinha entrado numa loja, e
   * as tres cartas nao diziam nada uma sobre a outra alem do texto miudo.
   *
   * Agora a banca e de MADEIRA, com prego no canto: uma barraca de feira pregada
   * na frente do premio, material que nao existe em nenhum outro painel de UI do
   * jogo. E cada carta anuncia PARA QUEM ela serve antes de dizer o que faz —
   * reliquia geral em roxo dizendo TODO O RANCHO, reliquia de classe com moldura e
   * faixa na cor da familia dizendo GUERREIRO · x7, com a contagem do seu proprio
   * rancho dentro. Ver `RelicShop.draft`: a carta de classe so chega na mesa se
   * voce tiver a familia, entao o `x7` nunca e `x0`.
   */
  private buildRelicChoice(savedRelics: RelicData[]): void {
    panelImage(this, 960, 384, 880, 106, { fill: WOOD, radius: 20 }, g => {
      // os pregos da barraca: madeira pregada, nao papel apoiado
      g.fillStyle(INK, 0.22);
      g.fillCircle(-404, 0, 7);
      g.fillCircle(404, 0, 7);
    }, 'relicsign').setDepth(100);
    label(this, 960, 362, 'LOJA DE RELIQUIAS', 36, PAPER, true).setDepth(101);
    label(this, 960, 408, 'UMA SO — E ELA VALE A RUN INTEIRA', 22, PAPER).setDepth(101).setAlpha(0.9);

    draft(savedRelics, this.dudesData).forEach((relic, index) => {
      this.relicCard(relic, 960 + (index - 1) * 390, savedRelics);
    });
  }

  /**
   * UMA CARTA DA BANCA, inteira dentro de um container.
   *
   * O container nao e enfeite de arquitetura: antes o `pointerover` dava
   * `setScale(1.04)` NA IMAGEM do painel, e o nome, a pilula e a descricao ficavam
   * parados no lugar — a carta crescia por baixo do proprio texto. Com tudo num
   * container, a carta cresce inteira, como um objeto que voce pegou na mao.
   *
   * A PILULA E O CABECALHO DA CARTA, e ela e o unico lugar onde a cor aparece.
   * A primeira versao desta tela tinha TAMBEM uma faixa colorida de 16px no alto do
   * papel, herdada da carta antiga: com a pilula ja pintada na cor da familia, a
   * faixa virou uma segunda barra da mesma cor a tres pixels da primeira, e as duas
   * juntas nao pareciam duas coisas — pareciam uma coisa quebrada. A faixa saiu, a
   * pilula subiu para o lugar dela, e a moldura da familia continua dizendo de
   * longe qual carta e de classe.
   */
  private relicCard(relic: RelicData, x: number, savedRelics: RelicData[]): void {
    const family = relicFamily(relic);
    const paint = family ? fam(family).main : PURPLE;
    const mine = family ? familyCount(this.dudesData, family) : 0;

    const card = this.add.container(x, 580).setDepth(102);
    const face = panelImage(this, 0, 0, 330, 270, { fill: PAPER_DARK, radius: 24 }, g => {
      if (!family) return;
      // moldura na cor da familia — le-se de longe qual carta e de classe
      g.lineStyle(6, paint, 1);
      g.strokeRoundedRect(-152, -129, 304, 258, 18);
    }, `rel${family ? paint : 'gen'}`);
    card.add([
      face,
      statPill(this, 0, -96, family ? `${famLabel(family)} · x${mine}` : 'TODO O RANCHO',
        paint, 296, 40, family ? INK : PAPER),
      label(this, 0, -34, relic.name.toUpperCase(), 32, INK, true),
      label(this, 0, 36, relic.description.toUpperCase(), 23, INK)
        .setWordWrapWidth(282).setAlign('center').setAlpha(0.9)
    ]);
    // PASSIVA em dezesseis das dezessete cartas seria ruido; a excecao e que avisa
    if (relic.type === 'active') {
      card.add(statPill(this, 0, 104, 'ATIVA · CLIQUE NA BRIGA', ORANGE, 304, 40, INK));
    }

    const hit = this.add.rectangle(x, 580, 330, 270, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(105);
    hit.on('pointerover', () => card.setScale(1.05));
    hit.on('pointerout', () => card.setScale(1));
    hit.on('pointerup', () => {
      if (this.selected) return;
      this.selected = true;
      storage.save('relics', [...savedRelics, relic]);
      toast(this, `${relic.name.toUpperCase()} ADQUIRIDA`, 960, 820, false);
      this.time.delayedCall(500, () => this.nextWave());
    });
  }

  private buildContinue(): void {
    new ComicButton(this, 960, 520, 420, 86, 'CONTINUAR  →  LOJA', () => this.nextWave(), { fill: GREEN, size: 31 })
      .container.setDepth(110);
    // 19px a 70% de alpha era a ultima linha sussurrada do jogo: 1,7% de 1080, ou
    // nove pixels no celular. A tela fala em caixa alta — esta fala tambem.
    label(this, 960, 622, 'A PROXIMA WAVE NAO VAI ESPERAR.', 23, INK).setDepth(101).setAlpha(0.8);
  }

  /**
   * O RANCHO NO RODAPE — um cara por TIPO com o contador de copias e as estrelas
   * de treino. Mostrar as 14 copias uma a uma era uma fileira de clones que nao
   * dizia nada — o que o jogador precisa ver e "tenho 5 tipos, o lenhador esta em
   * x6 e treinado ★★".
   *
   * A fileira era pequena e apertada: bonecos de 120px num passo de 166, largura
   * total de 770px num canvas de 1920, com o terco de cima e os dois tercos das
   * laterais em grama vazia. O exercito e o assunto do jogo — na tela que existe
   * para celebrar o exercito ele nao pode ser a coisa menor. Agora e 170px num
   * passo de 280 (o mesmo ritmo dos currais da loja), e a faixa toda subiu para
   * ocupar o vazio, sem invadir as cartas de reliquia que terminam em 715.
   */
  private buildNextWavePreview(): void {
    const nextWave = this.wave + 1;
    if (nextWave > 100) return;
    /**
     * O aviso agora LE a proxima wave em vez de adivinhar. Antes era um chute
     * fixo — "LOBOS E TODDLERS" ate a wave 15 — que misturava portugues com
     * ingles no meio de uma tela toda em portugues E mentia sempre que a horda
     * era de patos ou abelhas. `WaveManager.headline` ja monta "RATEL · 95
     * INIMIGOS" com o rotulo traduzido de cada bicho; e a mesma frase que a
     * batalha mostra no topo, entao a promessa e a briga batem.
     */
    const text = nextWave % 10 === 0
      ? `WAVE ${nextWave}  ·  CHEFE A CAMINHO`
      : `WAVE ${nextWave}  ·  ${new WaveManager().headline(nextWave)}`;
    statPill(this, 960, 760, text, WOOD, 560, 46, PAPER).setDepth(101);

    const counts = countById(this.dudesData);
    const preview = uniqueOwned(this.dudesData).slice(0, 5);
    const step = 280;
    preview.forEach((dude, index) => {
      const x = 960 + (index - (preview.length - 1) / 2) * step;
      addShadow(this, x, 1030, 116).setDepth(2);
      const image = addDudeImage(this, x, 1030, dude.id, 170).setDepth(3);
      idleBob(this, image, 3, 800 + index * 40);
      const n = counts[dude.id] ?? 1;
      // o contador e um SELO no canto do cara, nao um pill flutuando acima dele:
      // ali em cima ele brigava com a cabeca e com a pilula da wave
      statPill(this, x + 70, 972, `x${n}`, n > 1 ? GOLD : PAPER, 78, 40, INK).setDepth(104);
      /**
       * AS ESTRELAS DE TREINO MORAVAM A 150px DO CARA QUE ELAS DESCREVEM.
       *
       * Ficavam em y=872 — entre a pilula da wave e o boneco, soltas no pasto, a
       * 20px de altura: dois cisquinhos dourados que nao pertenciam a ninguem.
       * Treino e uma marca DO cara, entao virou selo tambem, coroando a cabeca
       * (o boneco de 170px vai de 860 a 1030) e no mesmo material da contagem de
       * copias. A largura acompanha o numero de estrelas e nunca chega perto dos
       * 280px de passo entre os caras.
       */
      const lvl = trainLevel(this.trained, dude.id);
      if (lvl > 0) statPill(this, x, 838, '★'.repeat(lvl), GOLD, 38 + lvl * 26, 36, INK).setDepth(104);
    });
  }

  private nextWave(): void {
    if (this.wave >= 100) {
      this.scene.start('GameOver', { wave: 100, victory: true, dudesData: this.dudesData });
      return;
    }
    const saved = storage.load('save');
    const economy = new Economy(saved?.gold ?? this.economy?.gold ?? 6);
    this.scene.start('Shop', {
      wave: this.wave + 1, inventory: this.dudesData, economy,
      trained: this.trained, snack: null
    });
  }
}
