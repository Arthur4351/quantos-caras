import Phaser from 'phaser';
import { storage } from '../utils/storage';
import { AchievementSystem } from '../systems/AchievementSystem';
import { DailySystem } from '../systems/DailySystem';
import { buildRanch } from '../art/Backdrop';
import { ComicButton, label, panelImage, statPill } from '../art/UIKit';
import { addDudeImage, addShadow, idleBob } from '../art/DudeSprite';
import { GOLD, GREEN, INK, PAPER, PAPER_DARK, RED, WOOD } from '../art/palette';
import { countById, uniqueOwned } from '../systems/RunState';

export class GameOver extends Phaser.Scene {
  wave = 1;
  victory = false;
  dudesData: any[] = [];

  constructor() { super('GameOver'); }

  init(data: any) {
    this.wave = data.wave ?? 1;
    this.victory = !!data.victory;
    this.dudesData = data.dudesData ?? [];
  }

  create() {
    this.cameras.main.fadeIn(420, 126, 209, 245);
    buildRanch(this, { horizon: this.victory ? 400 : 330, arena: false, clouds: true });
    this.recordDaily();
    this.buildHero();
    this.buildStats();
    this.buildActions();
    this.buildArmyLineup();
  }

  /**
   * Se a run era do DESAFIO DIARIO, a tentativa entra no placar local — que existia
   * como leitura na tela do diario e nunca era escrito por ninguem. Grava antes de
   * qualquer limpeza, porque `clearRun` apaga o `daily_active` que identifica a run.
   */
  private recordDaily(): void {
    try {
      if (!storage.load('daily_active')) return;
      const daily = new DailySystem();
      const date = storage.load('daily_last') || new Date().toISOString().slice(0, 10);
      storage.save('daily_board', daily.recordRun(storage.load('daily_board'), {
        date, wave: this.wave, victory: this.victory
      }));
    } catch { /* placar e enfeite: nunca pode derrubar a tela de fim de run */ }
  }

  private buildHero(): void {
    panelImage(this, 960, 282, 1020, 290, { fill: PAPER, radius: 34 }).setDepth(100);
    const title = this.victory ? 'RANCHO SALVO!' : 'FIM DE RODADA';
    const color = this.victory ? GREEN : RED;
    statPill(this, 960, 190, this.victory ? 'GRANDE VITORIA' : 'O RANCHO CAIU', color, 330, 46, PAPER).setDepth(101);
    label(this, 960, 270, title, 66, color, true).setDepth(101);
    label(this, 960, 344, this.victory ? 'VOCE ATRAVESSOU TODAS AS WAVES.' : `VOCE CHEGOU ATE A WAVE ${this.wave}.`, 26, INK).setDepth(101);
    /**
     * 18px num canvas de 1080 e 1,6% de altura: no celular deitado a frase de
     * fecho da run saia com 6 pixels. A tela toda fala em caixa alta a 24-26px —
     * esta linha nao tem motivo para ser a excecao sussurrada.
     */
    label(this, 960, 390, this.victory ? 'O GORILA NAO ESQUECE UM BOM DESAFIO.' : 'CADA TENTATIVA DEIXA O PROXIMO EXERCITO MAIS FORTE.', 22, INK)
      .setDepth(101).setAlpha(0.75);
  }

  /**
   * O PLACAR DA RUN — em portugues e sem pilula pisando na outra.
   *
   * Estava "26 DUDES · 4 RELICS · 12 SILVER · 3 GOLD" no meio de uma tela escrita
   * inteira em portugues, e as duas ultimas pilulas se sobrepunham em 25px porque
   * as larguras foram somadas no olho (850+110 = 960 invadia 1100-165 = 935).
   * Agora a fileira e centrada por conta: larguras declaradas, folga de 24px, o
   * grupo inteiro ancorado em 960.
   */
  private buildStats(): void {
    const relics = storage.load('relics') || [];
    const stars = this.readStars();
    const silver = Object.values(stars).filter((star: any) => star.silver).length;
    const gold = Object.values(stars).filter((star: any) => star.gold).length;
    const achievements = new AchievementSystem().allData();
    const types = new Set(this.dudesData.map((d: any) => d?.id)).size;

    const row: Array<[string, number, number, number]> = [
      [`${this.dudesData.length} CARAS · ${types} TIPOS`, 340, WOOD, PAPER],
      [`${relics.length} RELIQUIAS`, 230, PAPER_DARK, INK],
      [`${silver} PRATA · ${gold} OURO`, 300, GOLD, INK]
    ];
    const gap = 24;
    let x = 960 - (row.reduce((s, r) => s + r[1], 0) + gap * (row.length - 1)) / 2;
    for (const [txt, w, fill, ink] of row) {
      statPill(this, x + w / 2, 520, txt, fill, w, 44, ink).setDepth(101);
      x += w + gap;
    }
    if (achievements.length) {
      label(this, 960, 590, `CONQUISTAS  ·  ${achievements.slice(-3).map(a => a.name.toUpperCase()).join('  •  ')}`, 22, INK, true)
        .setDepth(101).setAlpha(0.8).setWordWrapWidth(1400).setAlign('center');
    }
  }

  private buildActions(): void {
    new ComicButton(this, 960, 676, 420, 86, 'JOGAR NOVAMENTE  ↻', () => {
      this.clearRun();
      this.cameras.main.fadeOut(260, 0, 0, 0);
      this.time.delayedCall(260, () => this.scene.start('Menu'));
    }, { fill: GREEN, size: 31 }).container.setDepth(120);

    new ComicButton(this, 960, 772, 270, 62, 'MENU', () => {
      this.clearRun();
      this.scene.start('Menu');
    }, { fill: WOOD, size: 28 }).container.setDepth(120);
  }

  /**
   * A FOTO FINAL DO BANDO — um cara por TIPO, com o contador de copias.
   *
   * `slice(0, 8)` numa run que termina com 26 corpos de cinco tipos mostrava oito
   * bonecos onde tres eram o mesmo lenhador: uma fileira de clones que nao dizia
   * nem quantos caras voce tinha nem de quantos tipos. E a mesma correcao que o
   * rodape da recompensa recebeu — o numero e o assunto do jogo, ele precisa estar
   * escrito no boneco.
   *
   * E ela e a foto de FECHO da run: era 96px num passo de 150, uma miniatura de
   * 750px encolhida no rodape de um canvas de 1920 enquanto o miolo da tela sobrava.
   * Os botoes subiram e os 260px de baixo sao do exercito — 180px num passo de 280,
   * o mesmo ritmo dos currais da loja e do rodape da recompensa.
   */
  private buildArmyLineup(): void {
    const counts = countById(this.dudesData);
    const lineup = uniqueOwned(this.dudesData).slice(0, 6);
    if (lineup.length === 0) return;
    const step = lineup.length > 5 ? 240 : 280;
    lineup.forEach((dude, index) => {
      const x = 960 + (index - (lineup.length - 1) / 2) * step;
      addShadow(this, x, 1048, 120).setDepth(2);
      const image = addDudeImage(this, x, 1048, dude.id, 180).setDepth(3);
      idleBob(this, image, 3 + (index % 2), 760 + index * 50);
      const n = counts[dude.id] ?? 1;
      statPill(this, x + 72, 986, `x${n}`, n > 1 ? GOLD : PAPER, 78, 40, INK).setDepth(104);
    });
    label(this, 960, 848, this.victory ? 'SEU BANDO DE CAMPEOES' : 'SEU BANDO CHEGOU LONGE', 28, INK, true)
      .setDepth(101).setAlpha(0.9);
  }

  private readStars(): Record<string, any> {
    try { return JSON.parse(localStorage.getItem('stars') || '{}'); } catch { return {}; }
  }

  private clearRun(): void {
    storage.clear('save');
    storage.clear('relics');
    storage.clear('daily_active');
    storage.clear('daily_pool');
  }
}
