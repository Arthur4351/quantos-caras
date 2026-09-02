import Phaser from 'phaser';
import { DailySystem, DailyRecord } from '../systems/DailySystem';
import { Economy } from '../systems/Economy';
import { storage } from '../utils/storage';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, panelImage, statPill } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { GOLD, GREEN, INK, ORANGE, PAPER, PAPER_DARK, RED, WOOD, fam, famLabel, rar } from '../art/palette';
import dudesJson from '../data/dudes.json';

/**
 * O DESAFIO DIARIO — a tela que prometia tres coisas que o jogo nao fazia.
 *
 * 1. "DAILY DUDE" em ingles, 68px, no meio de um jogo em portugues, e repetindo a
 *    pilula "DESAFIO DIARIO" logo acima: dois titulos dizendo o mesmo em dois
 *    idiomas. Sobrou um, em portugues.
 * 2. "POOL FIXO · SEED 1kx3f9" — o numero interno do sorteio impresso na tela do
 *    jogador. Seed e coisa de quem escreve o jogo; quem joga precisa saber que o
 *    elenco de hoje e igual para todo mundo e que amanha muda.
 * 3. As cartas de 200x250 estouravam: a pilula de HP/ATK ficava 19px ABAIXO do
 *    corpo da carta, boiando na grama, e os pes do boneco caiam sobre o nome.
 *    Agora a carta e 270x300 no passo de 300 dos currais da loja — o mesmo ritmo —
 *    e nada mais escapa da moldura.
 *
 * Familia a 14px e placar a 14-16px eram os ultimos textos sub-legiveis do projeto
 * (1,3% de 1080 = cinco pixels no celular).
 */
export class DailyDude extends Phaser.Scene {
  constructor() { super('DailyDude'); }

  create() {
    this.cameras.main.fadeIn(320, 126, 209, 245);
    buildRanch(this, { horizon: 350, arena: false, clouds: true });

    const daily = new DailySystem();
    const today = new Date().toISOString().slice(0, 10);
    const seed = daily.getSeed(today);
    const pool = daily.getDailyDudes(dudesJson as any, seed);
    const last = storage.load('daily_last');
    const available = daily.isDailyAvailable(last, today);

    panelImage(this, 960, 176, 900, 190, { fill: PAPER, radius: 28 }).setDepth(99);
    statPill(this, 960, 108, 'DESAFIO DIARIO', ORANGE, 380, 54, PAPER).setDepth(100);
    label(this, 960, 178, this.dateLabel(today), 44, INK, true).setDepth(101);
    label(this, 960, 236, 'O MESMO ELENCO PARA TODO MUNDO HOJE  ·  AMANHA MUDA', 24, INK)
      .setDepth(101).setAlpha(0.82);

    this.buildPool(pool);

    const play = new ComicButton(this, 960, 742, 430, 88, available ? 'JOGAR DIARIO  →' : 'JA JOGADO HOJE', () => {
      if (!available) return;
      storage.save('daily_last', today);
      storage.save('daily_active', true);
      storage.save('daily_pool', pool);
      storage.save('save', { wave: 1, inventory: [], gold: 6 });
      this.scene.start('Shop', { wave: 1, inventory: [], economy: new Economy(6) });
    }, { fill: available ? GOLD : 0x9aa3ad, textColor: available ? INK : PAPER, size: 34 });
    play.container.setDepth(110);
    if (available) play.pulse();

    const menu = new ComicButton(this, 960, 842, 260, 58, 'VOLTAR', () => this.scene.start('Menu'), { fill: WOOD, size: 25 });
    menu.container.setDepth(110);

    this.buildBoard();
  }

  /** "02 DE SETEMBRO" — a data que o jogador entende, no lugar do seed. */
  private dateLabel(iso: string): string {
    const months = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
      'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const [, m, d] = iso.split('-');
    return `${d} DE ${months[Number(m) - 1] ?? ''}`;
  }

  /**
   * O ELENCO DE HOJE — cinco cartas na MESMA lingua visual das cartas da loja:
   * faixa de tinta com a cor da familia no topo, boneco grande, nome, HP e ATK em
   * duas pilulas. Eram cartas de 200x250 com quatro tamanhos de texto proprios e
   * a pilula de status boiando fora da moldura.
   */
  private buildPool(pool: any[]): void {
    const W = 270, H = 330, STEP = 300, Y = 480;
    pool.forEach((d, index) => {
      const x = 960 + (index - (pool.length - 1) / 2) * STEP;
      const paint = fam(d.family);
      const ring = rar(d.rarity ?? 'common').ring;
      const c = this.add.container(x, Y).setDepth(100);
      c.add(panelImage(this, 0, 0, W, H, { fill: PAPER, radius: 24 }, g => {
        g.lineStyle(6, ring, 1);
        g.strokeRoundedRect(-W / 2 + 8, -H / 2 + 8, W - 16, H - 16, 18);
        g.fillStyle(INK, 1);
        g.fillRoundedRect(-W / 2 + 9, -H / 2 + 7, W - 18, 58, 18);
        g.fillStyle(paint.main, 1);
        g.fillRoundedRect(-W / 2 + 13, -H / 2 + 11, W - 26, 50, 14);
      }, `daily${paint.main}${ring}`));
      c.add(label(this, 0, -H / 2 + 36, famLabel(d.family), 23, PAPER, true));
      c.add(addShadow(this, 0, 24, 108));
      const image = addDudeImage(this, 0, 24, d.id, 168);
      idleBob(this, image, 4, 900 + index * 40);
      c.add(image);
      c.add(label(this, 0, 76, d.name.toUpperCase(), 30, INK));
      // 122px de largura em x∓64 chegava a 2px do anel interno da carta: as duas
      // pilulas encostavam na moldura e a carta parecia estourada. 112 em x∓59
      // deixa 12px de papel de cada lado.
      c.add(statPill(this, -59, 128, `${d.stats.hp} HP`, GREEN, 112, 36, PAPER));
      // VERDE/VERMELHO e o par de HP/ATK do jogo inteiro (ver a carta da loja).
      // Laranja aqui empilhava a terceira faixa laranja da tela — a pilula do
      // titulo, a familia ACTION e o status, tudo na mesma cor.
      c.add(statPill(this, 59, 128, `${d.stats.atk} ATK`, RED, 112, 36, PAPER));
      const hit = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => c.setScale(1.04));
      hit.on('pointerout', () => c.setScale(1));
      c.add(hit);
    });
  }

  /**
   * O PLACAR LOCAL — agora com dados de verdade.
   *
   * `daily_board` era lido aqui e nunca escrito em lugar nenhum do projeto: a linha
   * "NENHUM RECORDE AINDA · SEJA O PRIMEIRO" era permanente, e o bloco de recordes
   * logo abaixo era codigo morto. `GameOver.recordDaily` grava cada tentativa e
   * `DailySystem.recordRun` mantem a melhor de cada dia — entao a promessa se cumpre
   * na primeira run que voce terminar.
   */
  private buildBoard(): void {
    const board = (storage.load('daily_board') || []) as DailyRecord[];
    if (!board.length) {
      statPill(this, 960, 946, 'TERMINE UM DIARIO E ELE FICA GUARDADO AQUI', PAPER_DARK, 700, 42, INK)
        .setDepth(101);
      return;
    }
    statPill(this, 960, 920, 'SEUS MELHORES DIARIOS', WOOD, 420, 44, PAPER).setDepth(101);
    // 990 + 44*i jogava a terceira linha em 1078: fora dos 1080 do canvas, o placar
    // mostrava dois de tres recordes. 962 + 42*i fecha em 1065, dentro da tela.
    board.slice(0, 3).forEach((entry, index) => {
      const y = 962 + index * 42;
      const win = !!entry.victory;
      statPill(this, 960, y,
        `${index + 1}.  ${this.dateLabel(entry.date)}  ·  WAVE ${entry.wave}${win ? '  ·  RANCHO SALVO' : ''}`,
        win ? GREEN : PAPER, 620, 38, win ? PAPER : INK).setDepth(101);
    });
  }
}
