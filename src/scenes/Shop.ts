import Phaser from 'phaser';
import { Economy } from '../systems/Economy';
import { HUD } from '../ui/HUD';
import { storage } from '../utils/storage';
import { DudeData } from '../types/DudeData';
import { abilityBlurb } from '../systems/abilities';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, statPill, toast, panelImage, shade, floatNumber } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { drawSnack } from '../art/snackIcons';
import { INK, PAPER, PAPER_DARK, WHITE, GOLD, GREEN, RED, ORANGE, CYAN, WOOD, WOOD_DARK, fam, famLabel, rar, roleLabel } from '../art/palette';
import {
  DRAFT_SIZE, SQUAD_TYPES, TRAIN_MAX, TRAIN_ATK, TRAIN_HP, MAX_ARMY, RunEvent, Snack, TrainedMap,
  addPack, canTrain, cloneDude, copiesFor, copyPrice, countById, distinctIds, draftOffers, eventFor,
  HERO_EVERY, HERO_ID, heroDude, startingInventory,
  offersFromIds, snackById, snackOffers, squadFull, train, trainLevel, uniqueOwned
} from '../systems/RunState';

/**
 * O RANCHO — a tela de decisao da run.
 *
 * A carta nao se compra e NAO TEM REROLL: tres caem na mesa, voce leva UMA e vai
 * brigar. O rancho cabe cinco TIPOS de cara; fechado o quinto, a oferta passa a
 * ser copia de quem voce ja tem e a run vira acumulo — o mesmo cara empilhado,
 * que e a imagem do jogo original.
 *
 * O ouro entra DEPOIS dessa regra, nunca por cima dela: com o rancho fechado cada
 * curral e um balcao que vende UM corpo a mais daquele tipo (ver `buyCopy` e
 * `RunState.copyPrice`). E o unico lugar do jogo onde a moeda sai do bolso, e ele
 * so empilha o que voce ja escolheu — o sorteio da rodada continua intocado.
 *
 * De tres em tres waves aparece um eventinho: o TREINADOR (permanente) ou o
 * CARA DO LANCHE (buff de uma batalha).
 */

/** Tres cartas grandes: a decisao da rodada tem que dominar a tela. */
const CARD_W = 336;
const CARD_H = 440;
const CARD_Y = 498;
const CARD_STEP = CARD_W + 46;

/** Os cinco currais, sempre visiveis — o teto de tipos e a regra do jogo. */
const PEN_W = 288;
const PEN_H = 168;
const PEN_STEP = 300;
const PEN_Y = 872;

export class Shop extends Phaser.Scene {
  economy!: Economy;
  inventory: DudeData[] = [];
  wave = 1;
  /** id do cara -> niveis de treino. Atravessa a run inteira. */
  trained: TrainedMap = {};
  /** Lanche escolhido; vale a proxima batalha e some depois. */
  snack: string | null = null;
  hud!: HUD;

  private offers: DudeData[] = [];
  private snackIds: string[] = [];
  private picked = false;
  private eventKind: RunEvent = null;
  private eventDone = false;
  private cards: Phaser.GameObjects.Container[] = [];
  private hits: Phaser.GameObjects.Rectangle[] = [];
  private pens: Phaser.GameObjects.Container[] = [];
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private battleBtn?: ComicButton;
  private headerSub?: Phaser.GameObjects.Container;
  private snackPill?: Phaser.GameObjects.Container;
  /** A linha acima dos currais: virou etiqueta de preco, entao precisa recriar. */
  private penLine?: Phaser.GameObjects.Text;

  constructor() { super('Shop'); }

  init(data: any) {
    this.wave = data.wave ?? 1;
    this.inventory = (data.inventory ?? []).map(cloneDude);
    this.economy = data.economy ?? new Economy(6);
    this.trained = data.trained ? { ...data.trained } : {};
    this.snack = data.snack ?? null;
    this.offers = [];
    this.snackIds = [];
    this.picked = false;
    this.eventDone = false;
    this.cards = [];
    this.hits = [];
    this.pens = [];
    this.overlay = [];
    this.battleBtn = undefined;

    const saved = storage.load('save');
    if (saved) {
      if (this.inventory.length === 0 && Array.isArray(saved.inventory)) {
        this.inventory = saved.inventory.map(cloneDude);
      }
      if (!data.economy && typeof saved.gold === 'number' && !isNaN(saved.gold)) {
        this.economy.gold = Math.max(0, saved.gold);
      }
      if (!data.trained && saved.trained) this.trained = { ...saved.trained };
      if (data.snack === undefined && typeof saved.snack === 'string') this.snack = saved.snack;
      // MESMA rodada (F5): as cartas voltam identicas. Recarregar nao e reroll.
      const d = saved.draft;
      if (d && d.wave === this.wave && Array.isArray(d.ids)) {
        this.offers = offersFromIds(d.ids);
        this.snackIds = Array.isArray(d.snackIds) ? d.snackIds : [];
        this.picked = !!d.picked;
        this.eventDone = !!d.eventDone;
      }
    }

    this.eventKind = eventFor(this.wave);
    /**
     * O CARA NUNCA FALTA.
     *
     * `Menu` semeia a run com ele, mas existem tres portas para esta loja que nao
     * passam pelo botao JOGAR — o CONTINUAR de um save antigo (feito antes desta
     * regra), o "voltar a loja" do rancho vazio e o desafio diario. Em nenhuma
     * delas o jogador pode chegar sem o unico cara que o treinador atende.
     */
    if (!this.inventory.some(d => d.id === HERO_ID)) {
      this.inventory.unshift(...startingInventory());
    }
    if (this.offers.length === 0) this.offers = this.rollOffers();
  }

  /**
   * O DIARIO GOVERNA A RUN INTEIRA, NAO A PRIMEIRA CARTA.
   *
   * Estava `wave === 1 && pool.slice(0, 3)`: dos cinco caras que a tela do diario
   * anuncia como "o pool de hoje", tres apareciam uma vez e a run seguia no sorteio
   * normal — a promessa do modo durava uma rodada. Agora o pool do dia E o bestiario
   * da run: as cartas de toda wave saem dele, e como o rancho cabe cinco TIPOS o
   * desafio fica exatamente o que devia ser — todo mundo com o mesmo elenco, ganha
   * quem joga melhor. Fora do diario, o sorteio normal do jogo.
   */
  private rollOffers(): DudeData[] {
    try {
      const active = JSON.parse(localStorage.getItem('daily_active') || 'false');
      const pool = JSON.parse(localStorage.getItem('daily_pool') || 'null');
      if (active && Array.isArray(pool) && pool.length) {
        return draftOffers(this.inventory, this.wave, pool.map(cloneDude));
      }
    } catch { /* daily corrompido nao pode travar a run normal */ }
    return draftOffers(this.inventory, this.wave);
  }

  create() {
    this.cameras.main.fadeIn(280, 126, 209, 245);
    buildRanch(this, { horizon: 300, arena: false, clouds: true });
    this.hud = new HUD(this, this.economy, this.wave);
    this.persist();

    this.buildHeader();
    this.buildDraft();
    this.penLabel();
    this.refreshPens();
    this.refreshBattleButton();
    if (this.eventKind) this.buildEventNpc();

    const muteHandler = () => {
      this.sound.mute = !this.sound.mute;
      toast(this, this.sound.mute ? 'SOM DESLIGADO' : 'SOM LIGADO', 960, 620, false);
    };
    this.input.keyboard?.on('keydown-M', muteHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-M', muteHandler);
    });
  }

  /** Tudo o que a run precisa para sobreviver a um F5 — inclusive a oferta. */
  private persist(): void {
    storage.save('save', {
      wave: this.wave,
      inventory: this.inventory,
      gold: this.economy.gold,
      trained: this.trained,
      snack: this.snack,
      draft: {
        wave: this.wave,
        ids: this.offers.map(o => o.id),
        snackIds: this.snackIds,
        picked: this.picked,
        eventDone: this.eventDone
      }
    });
  }

  // ------------------------------------------------------------------ HEADER
  private buildHeader(): void {
    panelImage(this, 960, 142, 700, 82, { fill: WOOD, radius: 22 }).setDepth(80);
    /**
     * "DUDE RANCH" — em ingles, 52px, o maior texto da tela, num jogo chamado
     * QUANTOS CARAS onde todo o resto fala portugues: os botoes (RECRUTAR), as
     * pilulas (0/5 TIPOS), o rodape (SEU RANCHO). Era a ultima palavra estrangeira
     * em tamanho de titulo, no mesmo dia em que o elenco parou de se chamar Knight
     * e Office Guy. "RANCHO DOS CARAS" guarda a piada do original (um dude ranch e
     * um rancho de turista) sem trocar de idioma no meio da frase.
     */
    label(this, 960, 140, 'RANCHO DOS CARAS', 52, PAPER, true).setDepth(81);
    this.refreshHeader();
  }

  /**
   * A REGRA DA RODADA, numa pilula legivel. Como texto solto em cima da madeira
   * a linha caia meio dentro da placa do titulo e virava borrao — e ela e a
   * unica coisa que explica ao jogador porque a carta hoje vale tres caras.
   */
  private refreshHeader(): void {
    this.headerSub?.destroy();
    this.snackPill?.destroy();
    const types = distinctIds(this.inventory).length;
    const pack = copiesFor(this.inventory, this.wave);
    const txt = !squadFull(this.inventory)
      ? `${types}/${SQUAD_TYPES} TIPOS  ·  ESCOLHA 1 DOS 3  ·  SEM TROCA`
      : pack > 1
        ? `RANCHO FECHADO  ·  CADA CARTA VALE ${pack} COPIAS  ·  SEM TROCA`
        : `RANCHO FECHADO EM ${SQUAD_TYPES} TIPOS  ·  AGORA SO EMPILHA COPIAS`;
    this.headerSub = statPill(this, 960, 206, txt, PAPER, 880, 42, INK);
    this.headerSub.setDepth(81);
    const s = snackById(this.snack);
    if (!s) return;
    this.snackPill = statPill(this, 960, 250, `LANCHE: ${s.name}  ${s.blurb}`, CYAN, 560, 34, WHITE);
    this.snackPill.setDepth(81);
  }

  // ------------------------------------------------------------------- DRAFT
  private buildDraft(): void {
    if (this.picked) {
      panelImage(this, 960, CARD_Y, 900, 210, { fill: PAPER, radius: 30 }, undefined, 'picked').setDepth(100);
      label(this, 960, CARD_Y - 34, 'ESCOLHA FEITA', 56, ORANGE, true).setDepth(101);
      label(this, 960, CARD_Y + 34, 'UMA CARTA POR RODADA. AGORA E BRIGA.', 27, INK).setDepth(101).setAlpha(0.8);
      return;
    }
    const startX = 960 - ((this.offers.length - 1) * CARD_STEP) / 2;
    this.offers.forEach((d, i) => this.cards.push(this.buildCard(startX + i * CARD_STEP, CARD_Y, d, i)));
  }

  /**
   * A carta e um Container: o hover, o voo para o curral e o apagar das outras
   * duas viram um tween em UM objeto, em vez de doze tweens em coordenadas
   * absolutas.
   */
  private buildCard(cx: number, cy: number, d: DudeData, index: number): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy).setDepth(100);
    const paint = fam(d.family);
    const ring = rar(d.rarity ?? 'common').ring;
    const owned = countById(this.inventory)[d.id] ?? 0;
    const H = CARD_H / 2;

    c.add(panelImage(this, 0, 0, CARD_W, CARD_H, { fill: PAPER, radius: 28 }, g => {
      g.lineStyle(7, ring, 1);
      g.strokeRoundedRect(-CARD_W / 2 + 9, -H + 9, CARD_W - 18, CARD_H - 18, 21);
      g.fillStyle(INK, 1);
      g.fillRoundedRect(-CARD_W / 2 + 10, -H + 8, CARD_W - 20, 66, 20);
      g.fillStyle(paint.main, 1);
      g.fillRoundedRect(-CARD_W / 2 + 14, -H + 12, CARD_W - 28, 58, 16);
      g.fillStyle(WHITE, 0.26);
      g.fillRoundedRect(-CARD_W / 2 + 20, -H + 18, CARD_W - 40, 17, 8);
    }, `draft${paint.main}${ring}`));

    c.add(label(this, 0, -H + 41, `${famLabel(d.family)} · ${roleLabel(d.role)}`, 25, WHITE, true));
    c.add(addShadow(this, 0, 40, 124));
    const img = addDudeImage(this, 0, 40, d.id, 196);
    idleBob(this, img, 5, 1000);
    c.add(img);

    c.add(label(this, 0, 82, d.name.toUpperCase(), 34, INK));
    const blurb = abilityBlurb(d.ability);
    /**
     * 18px era 0.9% da largura do canvas: num telefone deitado (667px de tela) a
     * linha que EXPLICA a carta saia com 6px de altura. 22px com quebra de linha
     * de seguranca — a carta tem 296px uteis e a maior habilidade cabe rente.
     *
     * E ela e TINTA CRUA, sem contorno. Pintada com a cor de destaque da carta
     * (vermelho no guerreiro, roxo no morto-vivo) ela era um miolo saturado dentro
     * de um halo escuro: a 22px os dois se encontram e "BLOQUEIA 25% DOS GOLPES"
     * fecha num borrao colorido. A cor de destaque manda na faixa do papel e nas
     * pilulas; a linha que se LE em cima do papel e preto sobre creme, e ponto.
     */
    if (blurb) {
      c.add(label(this, 0, 112, blurb, 22, INK).setWordWrapWidth(300).setAlign('center').setAlpha(0.82));
    }
    c.add(statPill(this, -78, 150, `${d.stats.hp} HP`, GREEN, 132, 38, WHITE));
    c.add(statPill(this, 78, 150, `${d.stats.atk} ATK`, RED, 132, 38, WHITE));
    // a carta diz na cara o que ela ENTREGA: tipo novo, um pacote de copias ou,
    // no limite de corpos, um nivel de treino
    const pack = copiesFor(this.inventory, this.wave);
    const deal = !owned ? 'RECRUTAR'
      : pack === 0 ? `RANCHO LOTADO  ·  TREINA ★`
      : pack > 1 ? `+${pack} COPIAS  ·  FICA x${owned + pack}`
      : `+1 COPIA  ·  FICA x${owned + 1}`;
    c.add(statPill(this, 0, 192, deal, owned ? GOLD : GREEN, 276, 44, owned ? INK : WHITE));

    const hit = this.add.rectangle(0, 0, CARD_W, CARD_H, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { if (!this.picked) c.setScale(1.045); });
    hit.on('pointerout', () => { if (!this.picked) c.setScale(1); });
    hit.on('pointerup', () => this.pick(index));
    c.add(hit);
    this.hits.push(hit);
    return c;
  }

  /**
   * A ESCOLHA. Nada de `scene.restart()` aqui: reiniciar a cena sortearia tres
   * cartas novas, e reroll e exatamente o que este jogo nao tem. A carta
   * escolhida voa para o curral, as outras duas apagam, e a cena continua viva.
   *
   * Com o rancho fechado a carta entrega um PACOTE de copias, nao um cara — e
   * quando nem o pacote cabe (160 corpos no campo) ela paga em TREINO, que e o
   * unico jeito de uma escolha ainda valer algo com o rancho estourado.
   */
  private pick(index: number): void {
    if (this.picked) return;
    const d = this.offers[index];
    if (!d) return;
    this.picked = true;
    this.hits.forEach(h => h.disableInteractive());

    const owned = countById(this.inventory)[d.id] ?? 0;
    const got = addPack(this.inventory, d, this.wave);
    let cry: string;
    if (got === 0) {
      const before = trainLevel(this.trained, d.id);
      this.trained = train(this.trained, d.id);
      const after = trainLevel(this.trained, d.id);
      cry = after > before
        ? `${d.name.toUpperCase()} TREINOU!  ★${after}`
        : `${d.name.toUpperCase()} NAO CABE MAIS NO RANCHO`;
    } else if (owned) {
      cry = got > 1 ? `+${got} ${d.name.toUpperCase()}!  x${owned + got}` : `${d.name.toUpperCase()}  x${owned + 1}!`;
    } else {
      cry = `${d.name.toUpperCase()} ENTROU NO RANCHO!`;
    }
    try { if (this.cache.audio.exists('coin')) this.sound.play('coin', { volume: 0.5 }); } catch {}
    this.persist();
    toast(this, cry, 960, 330, false);
    /**
     * O BOTAO DE BATALHA ACENDIA 570ms DEPOIS DA ESCOLHA.
     *
     * Ele so era religado no `onComplete` do voo da carta (150ms de estufada + 420ms
     * de voo ate o curral): quem escolhia um cara e ia direto para o botao de baixo
     * batia em "ESCOLHA UM CARA PRIMEIRO" — desabilitado — por mais de meio segundo
     * depois de ja ter escolhido. O exercito entra em `this.inventory` aqui, no
     * `addPack` la em cima, nao quando a animacao acaba; o voo e enfeite e enfeite
     * nao pode segurar o comando. Os currais continuam se enchendo no fim do voo,
     * que e onde a carta de fato aterrissa.
     */
    this.refreshBattleButton();

    this.cards.forEach((card, i) => {
      if (i === index) return;
      this.tweens.add({ targets: card, alpha: 0.16, scale: 0.88, duration: 260, ease: 'Quad.easeOut' });
    });

    const chosen = this.cards[index];
    const dest = this.penPos(d.id);
    this.tweens.add({
      targets: chosen, scale: 1.12, duration: 150, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({
        targets: chosen, x: dest.x, y: dest.y, scale: 0.2, alpha: 0,
        duration: 420, ease: 'Cubic.easeIn',
        onComplete: () => {
          chosen.destroy();
          this.refreshPens();
          this.refreshHeader();
          this.refreshBattleButton();
        }
      })
    });
  }

  /** O curral daquele tipo — destino do voo da carta. */
  private penPos(id: string): { x: number; y: number } {
    const i = distinctIds(this.inventory).indexOf(id);
    const at = i < 0 || i >= SQUAD_TYPES ? (SQUAD_TYPES - 1) / 2 : i;
    return { x: 960 + (at - (SQUAD_TYPES - 1) / 2) * PEN_STEP, y: PEN_Y };
  }

  // ------------------------------------------------------------------ CURRAIS
  /**
   * A linha do curral e tambem a ETIQUETA DE PRECO: e o unico lugar do jogo onde
   * o ouro sai do bolso, entao o preco fica escrito acima dos currais em vez de
   * escondido num tooltip. Quando o rancho ainda esta abrindo (menos de cinco
   * tipos) nao ha o que comprar e a linha volta a ser so informacao.
   */
  private penLabel(): void {
    this.penLine?.destroy();
    const price = copyPrice(this.inventory);
    const txt = !squadFull(this.inventory)
      ? `SEU RANCHO  ·  ${SQUAD_TYPES} TIPOS, COPIAS INFINITAS`
      : this.inventory.length >= MAX_ARMY
        ? `SEU RANCHO  ·  CAMPO LOTADO EM ${MAX_ARMY} CARAS`
        : `CLIQUE NUM CURRAL  ·  +1 CARA POR ${price} OURO`;
    this.penLine = label(this, 960, PEN_Y - PEN_H / 2 - 30, txt, 27, PAPER, true).setDepth(62);
  }

  /** Cinco currais fixos: o teto de tipos e a primeira coisa que se le na tela. */
  private refreshPens(): void {
    this.pens.forEach(p => p.destroy());
    this.pens = [];
    const uniq = uniqueOwned(this.inventory);
    const counts = countById(this.inventory);
    for (let i = 0; i < SQUAD_TYPES; i++) {
      const x = 960 + (i - (SQUAD_TYPES - 1) / 2) * PEN_STEP;
      const d = uniq[i];
      this.pens.push(d ? this.buildPen(x, d, counts[d.id] ?? 1) : this.emptyPen(x, i));
    }
  }

  private emptyPen(x: number, i: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, PEN_Y).setDepth(60);
    c.add(panelImage(this, 0, 0, PEN_W, PEN_H, { fill: WOOD_DARK, radius: 20, gloss: false }, g => {
      g.lineStyle(6, WOOD, 0.9);
      g.strokeRoundedRect(-PEN_W / 2 + 14, -PEN_H / 2 + 14, PEN_W - 28, PEN_H - 28, 12);
    }, 'penoff'));
    c.add(label(this, 0, -16, '?', 66, WOOD).setAlpha(0.65));
    c.add(label(this, 0, 48, `TIPO ${i + 1}`, 24, PAPER).setAlpha(0.5));
    return c;
  }

  private buildPen(x: number, d: DudeData, n: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, PEN_Y).setDepth(60);
    const paint = fam(d.family);
    c.add(panelImage(this, 0, 0, PEN_W, PEN_H, { fill: WOOD, radius: 20 }, g => {
      g.fillStyle(WOOD_DARK, 1);
      g.fillRoundedRect(-PEN_W / 2 + 12, -PEN_H / 2 + 12, PEN_W - 24, PEN_H - 24, 14);
      g.fillStyle(paint.main, 1);
      g.fillRoundedRect(-PEN_W / 2 + 12, -PEN_H / 2 + 12, PEN_W - 24, 14, 7);
    }, `pen${paint.main}`));

    c.add(addShadow(this, -84, 44, 96));
    const img = addDudeImage(this, -84, 44, d.id, 128);
    idleBob(this, img, 4, 940);
    c.add(img);

    c.add(label(this, 40, -36, d.name.toUpperCase(), 24, PAPER, true));
    c.add(statPill(this, 40, 0, n > 1 ? `x${n} CARAS` : 'x1', n > 1 ? GOLD : PAPER_DARK, 128, 34, INK));
    const lvl = trainLevel(this.trained, d.id);
    c.add(label(this, 40, 36, '★'.repeat(lvl) + '·'.repeat(TRAIN_MAX - lvl), 26, lvl ? GOLD : WOOD_DARK));
    // 15 caracteres numa pilula de 150x26 dao 14px de letra BRANCA sobre a cor de
    // destaque so 10% escurecida: era o texto de menor contraste da tela inteira.
    // Fundo bem mais fundo (0.5) e a pilula um pouco maior — 17px de letra sobre
    // um tom que aguenta branco. y=68 mantem a base dentro dos 168px do curral.
    c.add(statPill(this, 40, 68, `${d.stats.hp} HP · ${d.stats.atk} ATK`, shade(paint.main, 0.5), 176, 30, WHITE));
    this.makePenBuyable(c, d);
    return c;
  }

  /**
   * O CURRAL INTEIRO E O BOTAO.
   *
   * Um "+1" de 56px na quina brigaria com o nome, as estrelas e as duas pilulas
   * que ja moram nos 288x168 do curral. O alvo aqui e o card todo: 288 por 168 de
   * area clicavel, hover que levanta a carta e o preco escrito na linha de cima.
   * Sem ouro o curral TREME em vez de abrir modal — o erro se le sem parar o jogo.
   */
  private makePenBuyable(c: Phaser.GameObjects.Container, d: DudeData): void {
    if (!squadFull(this.inventory)) return;
    const homeX = c.x;
    const hit = this.add.rectangle(0, 0, PEN_W, PEN_H, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerover', () => c.setScale(1.035));
    hit.on('pointerout', () => c.setScale(1));
    hit.on('pointerup', () => this.buyCopy(c, d, homeX));
  }

  /**
   * A RESPOSTA DA COMPRA NASCE ONDE ESTA A CAUSA — NAO NO MEIO DA TELA.
   *
   * Aqui morava um `toast(..., 960, 700)`. A tela nao tem faixa livre nessa altura:
   * as cartas do draft ocupam 278..718 e a pilula "+3 COPIAS · FICA x9" — a linha
   * que diz o que a rodada entrega — fica exatamente em 700. O aviso de erro tapava
   * a informacao mais importante da tela para dizer "faltou ouro".
   *
   * Mudar para o curral foi de mal a pior: "FALTA OURO · 14" tem 260px e o curral
   * tem 288, entao a frase caia em cima da faixa de destaque e do nome do cara —
   * vermelho sobre ciano, o mesmo borrao que a loja ja tinha corrigido nas cartas.
   *
   * A regra que sobrou (e a mesma de `fx.blockClink`): cada metade da resposta vai
   * para o lugar que a explica. O CURRAL diz se entrou ou nao — "+1" no acerto,
   * tranco no erro. A PILULA DE OURO diz por que nao — "-14" quando sai dinheiro,
   * "SEM OURO" quando falta, no ceu vazio embaixo dela, onde nada e coberto. E
   * quando o campo lota nao aparece texto nenhum: a etiqueta acima dos currais ja
   * esta escrita "CAMPO LOTADO EM 160 CARAS" em permanente.
   */
  private buyCopy(c: Phaser.GameObjects.Container, d: DudeData, homeX: number): void {
    /**
     * O tranco volta SEMPRE para `homeX`, o x que o curral tinha ao ser montado.
     * Dois cliques seguidos sem ouro criavam dois tweens no mesmo card: o segundo
     * nasce com o card ja deslocado, e o curral ficava 8px fora da fileira ate a
     * proxima reconstrucao. Mata o tween anterior e reancora.
     */
    const shake = () => {
      this.tweens.killTweensOf(c);
      c.x = homeX;
      this.tweens.add({ targets: c, x: homeX + 8, duration: 55, yoyo: true, repeat: 3 });
    };
    if (this.inventory.length >= MAX_ARMY) { shake(); return; }
    const price = copyPrice(this.inventory);
    if (!this.economy.spend(price)) {
      shake();
      floatNumber(this, 196, 122, 'SEM OURO', RED, 34);
      return;
    }
    this.inventory.push(cloneDude(d));
    floatNumber(this, 196, 122, `-${price}`, RED, 34);
    // BRANCO, nao verde: o curral esta plantado no pasto. Um "+1" verde a 40% de
    // alpha em cima de grama verde e um fantasma — branco com contorno de tinta e a
    // unica cor que a paleta garante contra qualquer fundo do rancho.
    floatNumber(this, c.x, c.y - 30, '+1', WHITE, 44);
    this.hud.update();
    this.refreshHeader();
    this.penLabel();
    this.refreshPens();
    this.refreshBattleButton();
    this.persist();
  }

  // ------------------------------------------------------------------ BATALHA
  private refreshBattleButton(): void {
    this.battleBtn?.destroy();
    const n = this.inventory.length;
    const can = n > 0;
    const txt = can ? `PRA CIMA DELES!  ${n} CARA${n > 1 ? 'S' : ''}  ⚔` : 'ESCOLHA UM CARA PRIMEIRO';
    this.battleBtn = new ComicButton(this, 960, 1016, can ? 580 : 540, 88, txt, () => {
      if (!can) { toast(this, 'SEU RANCHO ESTA VAZIO!', 960, 700); return; }
      this.startBattle();
    }, { fill: can ? GREEN : 0x9aa3ad, size: can ? 40 : 30 });
    this.battleBtn.container.setDepth(140);
    if (can) this.battleBtn.pulse();
  }

  private startBattle(): void {
    this.persist();
    this.cameras.main.fadeOut(240, 0, 0, 0);
    this.time.delayedCall(240, () => this.scene.start('Battle', {
      wave: this.wave,
      dudesData: this.inventory,
      trained: this.trained,
      snack: this.snack,
      economy: this.economy
    }));
  }

  // ----------------------------------------------------------------- EVENTINHO
  /**
   * O NPC da rodada, em pe no rancho. O modal abre sozinho meio segundo depois
   * (o evento E a novidade da rodada), mas se o jogador dispensar, o cara fica
   * ali clicavel enquanto o evento nao for usado.
   */
  private buildEventNpc(): void {
    const trainer = this.eventKind === 'trainer';
    const x = trainer ? 232 : 1688;
    const y = 780;
    addShadow(this, x, y, 130).setDepth(70);
    const img = addDudeImage(this, x, y, trainer ? 'athlete' : 'chef', 210).setDepth(71);
    idleBob(this, img, 6, 1080);

    if (this.eventDone) { img.setAlpha(0.45); return; }

    const pill = statPill(this, x, y - 232, trainer ? 'TREINADOR!' : 'LANCHE!',
      trainer ? RED : ORANGE, 260, 48, WHITE);
    pill.setDepth(72);
    this.tweens.add({ targets: pill, y: y - 248, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const hit = this.add.rectangle(x, y - 96, 230, 250, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(73);
    hit.on('pointerup', () => this.openEvent());
    this.time.delayedCall(520, () => this.openEvent());
  }

  private openEvent(): void {
    if (this.eventDone || this.overlay.length) return;
    if (this.eventKind === 'trainer') this.trainerModal();
    else if (this.eventKind === 'snack') this.snackModal();
  }

  private veil(): void {
    this.ov(this.add.rectangle(960, 540, 1920, 1080, INK, 0.66).setInteractive(), 500);
  }

  /** Registra um objeto do modal para o teardown em bloco. */
  private ov<T extends Phaser.GameObjects.GameObject>(o: T, depth: number): T {
    (o as any).setDepth?.(depth);
    this.overlay.push(o);
    return o;
  }

  private closeButton(txt: string, y: number): void {
    const b = new ComicButton(this, 960, y, 360, 62, txt, () => this.closeOverlay(), { fill: WOOD, size: 26 });
    b.container.setDepth(511);
    this.overlay.push(b.container);
  }

  private closeOverlay(): void {
    this.overlay.forEach(o => o.destroy());
    this.overlay = [];
  }

  // ----------------------------------------------------------------- TREINADOR
  /**
   * O TREINADOR TREINA O CARA. SO O CARA.
   *
   * Antes esta tela enfileirava os cinco tipos do rancho e deixava escolher um —
   * o que soa generoso e na pratica diluia tudo: um nivel espalhado num mercenario
   * que voce troca na rodada seguinte nao vira nada, e o jogador nunca formava
   * apego a ninguem. Agora o treinador so atende o CARA, o unico que atravessa a
   * run inteira, e o nivel dele vale para TODAS as copias dele de uma vez.
   *
   * A regra mora em `canTrain` (RunState) — esta tela so a mostra.
   */
  private trainerModal(): void {
    const hero = this.inventory.find(d => d.id === HERO_ID) ?? heroDude();
    const copies = countById(this.inventory)[HERO_ID] ?? 0;
    this.veil();
    this.ov(panelImage(this, 960, 540, 1300, 660, { fill: PAPER, radius: 34 }, undefined, 'modal'), 501);
    this.ov(label(this, 960, 286, 'TREINADOR NO RANCHO!', 62, RED, true), 502);
    this.ov(label(this, 960, 348, 'ELE SO TREINA O CARA  ·  E O TREINO VALE PARA TODOS ELES',
      27, INK), 502).setAlpha(0.85);

    if (copies === 0) {
      this.ov(label(this, 960, 560, 'VOCE NAO TEM NENHUM CARA NO RANCHO.', 38, INK), 502);
      this.ov(label(this, 960, 612, 'O TREINADOR FOI EMBORA.', 26, INK), 502).setAlpha(0.7);
      this.closeButton('QUE PENA', 760);
      return;
    }

    this.heroCard(660, 570, hero, copies);
    this.trainerBriefing(880, copies);
    this.closeButton('DEIXA PRA DEPOIS', 812);
  }

  /** A carta do CARA: retrato grande, trilha de estrelas e o botao. */
  private heroCard(x: number, y: number, d: DudeData, copies: number): void {
    const lvl = trainLevel(this.trained, d.id);
    const can = canTrain(this.trained, d.id);
    const paint = fam(d.family);
    const card = this.ov(panelImage(this, x, y, 320, 400, { fill: can ? PAPER_DARK : 0xc9cdd3, radius: 24 }, g => {
      g.fillStyle(paint.main, 1);
      g.fillRoundedRect(-144, -196, 288, 16, 8);
    }, `hero${paint.main}${can ? 1 : 0}`), 503);

    this.ov(addShadow(this, x, y + 40, 128), 504);
    const img = this.ov(addDudeImage(this, x, y + 40, d.id, 210), 505);
    if (!can) img.setAlpha(0.5);

    // quantos corpos este nivel vai levantar de uma vez
    this.ov(statPill(this, x + 112, y - 158, `x${copies}`, GOLD, 74, 40, INK), 507);

    this.ov(label(this, x, y + 74, d.name.toUpperCase(), 32, INK), 506);
    this.ov(label(this, x, y + 112, '★'.repeat(lvl) + '·'.repeat(TRAIN_MAX - lvl), 34, lvl ? GOLD : 0x9aa3ad), 506);
    this.ov(statPill(this, x, y + 152, can ? `TREINAR  ${lvl + 1}/${TRAIN_MAX}` : 'NO MAXIMO',
      can ? GREEN : 0x9aa3ad, 250, 46, WHITE), 506);
    if (!can) return;

    const hit = this.ov(this.add.rectangle(x, y, 320, 400, 0xffffff, 0).setInteractive({ useHandCursor: true }), 510);
    hit.on('pointerover', () => card.setScale(1.04));
    hit.on('pointerout', () => card.setScale(1));
    hit.on('pointerup', () => this.doTrain(d));
  }

  /** A coluna que ensina a regra nova. Vale mais que um numero solto na carta. */
  private trainerBriefing(x: number, copies: number): void {
    const lvl = trainLevel(this.trained, HERO_ID);
    const lines: [string, number][] = [
      [`+${Math.round(TRAIN_ATK * 100)}% ATAQUE E +${Math.round(TRAIN_HP * 100)}% VIDA POR NIVEL`, INK],
      ['PARA SEMPRE — ATRAVESSA A RUN INTEIRA', INK],
      [`SOBE OS SEUS ${copies} CARAS DE UMA VEZ`, INK],
      [`MAIS UM CARA A CADA ${HERO_EVERY} RODADAS`, INK],
      ['OS OUTROS TIPOS NAO TREINAM', INK]
    ];
    this.ov(label(this, x, 424, `NIVEL ${lvl} DE ${TRAIN_MAX}`, 40, RED, false), 502).setOrigin(0, 0.5);
    lines.forEach(([txt, color], i) => {
      const ly = 494 + i * 54;
      this.ov(statPill(this, x + 17, ly, '', GOLD, 34, 34, INK), 502);
      this.ov(label(this, x + 48, ly, txt, 25, color), 502).setOrigin(0, 0.5).setAlpha(0.9);
    });
  }

  private doTrain(d: DudeData): void {
    this.trained = train(this.trained, d.id);
    this.eventDone = true;
    this.persist();
    this.closeOverlay();
    this.refreshPens();
    this.cameras.main.flash(180, 255, 240, 190);
    toast(this, `${d.name.toUpperCase()} TREINOU!  ★${trainLevel(this.trained, d.id)}`, 960, 330, false);
  }

  // -------------------------------------------------------------- CARA DO LANCHE
  private snackModal(): void {
    if (this.snackIds.length === 0) {
      this.snackIds = snackOffers(DRAFT_SIZE).map(s => s.id);
      this.persist();
    }
    const offers = this.snackIds.map(id => snackById(id)).filter(Boolean) as Snack[];
    this.veil();
    this.ov(panelImage(this, 960, 540, 1240, 660, { fill: PAPER, radius: 34 }, undefined, 'modal'), 501);
    this.ov(label(this, 960, 290, 'O CARA DO LANCHE!', 62, ORANGE, true), 502);
    this.ov(label(this, 960, 352, 'COMIDA DE GRACA  ·  O BUFF VALE A PROXIMA BATALHA', 27, INK), 502).setAlpha(0.85);
    offers.forEach((s, i) => this.snackCard(960 + (i - (offers.length - 1) / 2) * 336, 596, s));
    this.closeButton('SEM FOME', 832);
  }

  private snackCard(x: number, y: number, s: Snack): void {
    // o icone e assado NA MESMA textura do cartao: um sticker, nao um emoji
    const card = this.ov(panelImage(this, x, y, 300, 320, { fill: PAPER_DARK, radius: 24 }, g => {
      g.fillStyle(ORANGE, 1);
      g.fillRoundedRect(-134, -146, 268, 14, 7);
      drawSnack(g, s.id, 0, -26);
    }, `snack${s.id}`), 503);

    this.ov(label(this, x, y + 80, s.name, 32, INK), 506);
    this.ov(statPill(this, x, y + 124, s.blurb, GREEN, 254, 40, WHITE), 506);

    const hit = this.ov(this.add.rectangle(x, y, 300, 320, 0xffffff, 0).setInteractive({ useHandCursor: true }), 510);
    hit.on('pointerover', () => card.setScale(1.05));
    hit.on('pointerout', () => card.setScale(1));
    hit.on('pointerup', () => {
      this.snack = s.id;
      this.eventDone = true;
      this.persist();
      this.closeOverlay();
      this.refreshHeader();
      toast(this, `${s.name}!  ${s.blurb}`, 960, 330, false);
    });
  }
}
