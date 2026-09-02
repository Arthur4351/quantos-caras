import Phaser from 'phaser';
import { Kit, emptyKit } from '../systems/abilities';
import { HpBar } from '../art/HpBar';
import { addShadow, dustPuff } from '../art/DudeSprite';
import { floatNumber } from '../art/UIKit';
import { blockClink, bloodBurst, bloodStain, hitSpark, shockRing, slashArc } from '../art/fx';
import { RED, GREEN } from '../art/palette';

export type Team = 'dude' | 'enemy';

export interface FighterOpts {
  team: Team;
  hp: number;
  atk: number;
  range: number;
  /** Ataques por segundo. */
  attackSpeed: number;
  /** px por segundo — de verdade, nao 3px/s como antes. */
  moveSpeed: number;
  kit?: Kit;
  /** Altura desejada na tela, em px. */
  visualHeight: number;
  /** Altura do canvas da textura, para escalar sem distorcer. */
  sourceHeight: number;
  /** originY da textura (linha dos pes). */
  footOrigin: number;
  /**
   * y no canvas onde a ARTE comeca. O canvas do cara tem folga em cima para
   * chapeus e cabelo; sem isto a barra de vida flutua 40px acima da cabeca.
   */
  contentTop?: number;
  /** Largura do canvas. Sem ela um lobo (168px de largo) ganha sombra de pirralho. */
  sourceWidth?: number;
  /** Largura do CORPO no canvas, em px. Alcance e empurrao saem dela. */
  bodyWidth?: number;
  barWidth?: number;
  /**
   * Barra de vida propria. A horda de lixo de wave nao tem barra: sao centenas
   * de unidades e o campo viraria uma parede de barrinhas — alem do custo de
   * dois sprites por inimigo.
   */
  bar?: boolean;
  /** Numeros de dano flutuantes. Desligado na horda pelo mesmo motivo. */
  numbers?: boolean;
}

/**
 * Base de todo combatente. Carrega o bloco de stats que o CombatSystem le, o
 * estado CAIDO (inconsciente, nao deletado — varios kits escalam com aliados
 * caidos) e o proprio rig visual: sombra de contato + barra de vida.
 *
 * `y` e SEMPRE a linha do chao. A profundidade acompanha o y, entao quem esta
 * mais a frente desenha na frente sem nenhuma ordenacao manual.
 */
export class Fighter extends Phaser.GameObjects.Sprite {
  readonly team: Team;
  hp: number;
  maxHp: number;
  atk: number;
  range: number;
  attackSpeed: number;
  moveSpeed: number;
  kit: Kit;
  downed = false;

  /** Segundos ate o proximo ataque. */
  cd = 0;
  /** Segundos ate a proxima invocacao. */
  summonCd = 0;
  /** Multiplicadores de aura, reescritos pelo CombatSystem a cada passo. */
  auraAtk = 1;
  auraSpeed = 1;

  readonly baseScale: number;
  readonly visualHeight: number;
  /**
   * Meia-largura do corpo na tela. O alcance e o empurrao entre unidades saem
   * daqui: sem isto um urso polar e um pirralho brigam a mesma distancia e os
   * corpos grandes se atravessam.
   */
  readonly bodyRadius: number;
  private shadow: Phaser.GameObjects.Image;
  private bar?: HpBar;
  private showNumbers: boolean;
  private barLift: number;
  private artAbove: number;
  private flashUntil = 0;
  /** Escala dos FX: um pirralho de 88px nao pode espirrar como um gorila. */
  private fxScale: number;
  /**
   * Profundidade travada. `syncRig` amarra a profundidade ao y todo frame, o que
   * e certo numa multidao — mas o holofote do golpe final precisa arrancar UM
   * corpo da frente de todos. Ver `Battle.spotlight`.
   */
  pinDepth = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, o: FighterOpts) {
    super(scene, x, y, texture);
    this.team = o.team;
    this.maxHp = o.hp;
    this.hp = o.hp;
    this.atk = o.atk;
    this.range = o.range;
    this.attackSpeed = o.attackSpeed;
    this.moveSpeed = o.moveSpeed;
    this.kit = o.kit ?? emptyKit();
    this.visualHeight = o.visualHeight;

    scene.add.existing(this);
    this.setOrigin(0.5, o.footOrigin);
    this.baseScale = o.visualHeight / o.sourceHeight;
    this.setScale(this.baseScale);
    // inimigos vem da direita: espelhar faz os dois lados se encararem
    if (o.team === 'enemy') this.setFlipX(true);

    this.shadow = addShadow(scene, x, y, o.sourceWidth
      ? o.sourceWidth * this.baseScale * 0.56
      : o.visualHeight * 0.6);
    this.bodyRadius = Math.max(14,
      (o.bodyWidth ?? o.sourceWidth ?? o.visualHeight) * 0.5 * this.baseScale);
    // altura real da arte acima dos pes, ja na escala da tela
    const artAbove = (o.footOrigin * o.sourceHeight - (o.contentTop ?? 0)) * this.baseScale;
    this.artAbove = artAbove;
    this.barLift = artAbove + 14;
    this.fxScale = Phaser.Math.Clamp(o.visualHeight / 120, 0.55, 2.2);
    this.showNumbers = o.numbers !== false;
    if (o.bar !== false) {
      this.bar = new HpBar(scene, o.barWidth ?? Math.max(52, o.visualHeight * 0.72), 12);
    }
    this.syncRig();
  }

  // ------------------------------------------------------------------- DANO
  /**
   * Aplica dano. Devolve o dano efetivo (0 se bloqueado) para que quem bateu
   * possa drenar vida em cima do valor real.
   */
  hurt(amount: number, showNumber = true): number {
    if (this.downed) return 0;
    if (this.kit.block > 0 && Math.random() < this.kit.block) {
      // sem palavra: o anel nasce NO peito de quem aparou (ver fx.blockClink)
      blockClink(this.scene, this.x, this.hitY, this.fxScale);
      return 0;
    }
    const dealt = Math.max(0, amount);
    this.hp = Math.max(0, this.hp - dealt);
    this.bar?.setRatio(this.hp / this.maxHp);
    // 34px, nao 24: numeros so nascem nos MEUS caras e nos chefes (Enemy passa
    // `numbers: notable`), entao o canal que grita "voce esta perdendo gente" tinha
    // 12 unidades de altura num campo de 1080 e desaparecia dentro da multidao.
    if (showNumber && this.showNumbers && dealt >= 1) this.popText(`-${Math.round(dealt)}`, RED, 34);
    this.flash();
    if (dealt >= 1) this.impact(dealt);
    if (this.hp <= 0) this.down();
    return dealt;
  }

  /**
   * O momento do contato. Estrela de gibi na altura do peito + recuo de 3px na
   * direcao contraria a de quem bateu (o inimigo sempre vem do outro lado do
   * campo, entao o sinal sai do time e nao precisa viajar pelo CombatSystem).
   *
   * O recuo e escrito direto em `x`, sem tween: o passo fixo do combate reescreve
   * posicao a todo momento e um tween competindo por `x` faria o cara tremer.
   */
  private impact(dealt: number): void {
    hitSpark(this.scene, this.x + (Math.random() - 0.5) * 16, this.hitY, this.fxScale);
    this.x += this.team === 'dude' ? -3 : 3;
    // golpe que arranca mais de 12% da vida sacode o corpo inteiro
    if (dealt < this.maxHp * 0.12) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 0.86, scaleY: this.baseScale * 1.14,
      duration: 60, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { if (this.active && !this.downed) this.setScale(this.baseScale); }
    });
  }

  /** Altura do peito na tela — de onde saem faiscas, sangue e arcos de golpe. */
  get hitY(): number { return this.y - this.artAbove * 0.55; }

  healBy(amount: number, showNumber = false): void {
    if (this.downed || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.bar?.setRatio(this.hp / this.maxHp);
    if (showNumber && this.showNumbers) this.popText(`+${Math.round(amount)}`, GREEN, 22);
  }

  /** Aumenta o teto de vida (deathscale) mantendo a proporcao atual. */
  setMaxHp(value: number): void {
    if (value <= this.maxHp) return;
    const gain = value - this.maxHp;
    this.maxHp = value;
    this.hp = Math.min(this.maxHp, this.hp + gain);
    this.bar?.setRatio(this.hp / this.maxHp);
  }

  // ------------------------------------------------------------------ ESTADO
  /** CAIDO, nao morto: continua no campo e conta para quem escala com quedas. */
  down(): void {
    if (this.downed) return;
    this.downed = true;
    this.hp = 0;
    this.bar?.setVisible(false);
    this.clearTint();
    this.setTint(0x8e8e9c);
    dustPuff(this.scene, this.x, this.y, this.visualHeight / 110);
    // SANGUE, DE LEVE, e so no inimigo: e o sinal de "esse ai morreu" no meio de
    // uma horda de duzentos. Cara caido do jogador fica cinza e deitado — ele
    // nao morreu, desmaiou (varios kits contam aliados caidos).
    if (this.team === 'enemy') {
      bloodBurst(this.scene, this.x, this.hitY, this.fxScale, this.fxScale > 1.4 ? 8 : 4);
      bloodStain(this.scene, this.x, this.y, this.fxScale);
    }
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      angle: (Math.random() > 0.5 ? 1 : -1) * (72 + Math.random() * 24),
      y: this.y + this.visualHeight * 0.12,
      alpha: 0.5,
      duration: 380,
      ease: 'Quad.easeIn'
    });
    this.scene.tweens.add({ targets: this.shadow, alpha: 0.3, duration: 380 });
  }

  /**
   * A MORTE DO ULTIMO. Chamada pela Battle no golpe final, com o tempo em camera
   * lenta: o dobro do estrago de sempre, anel de choque e o corpo voando pra tras
   * em vez do tombo curto. Sangue so no inimigo — o cara do jogador desmaia.
   */
  deathBlow(): void {
    const s = this.fxScale;
    if (this.team === 'enemy') {
      bloodBurst(this.scene, this.x, this.hitY, s * 1.5, 14);
      bloodStain(this.scene, this.x, this.y, s * 1.6, 4000);
    } else {
      dustPuff(this.scene, this.x, this.y, s * 1.8);
    }
    shockRing(this.scene, this.x, this.hitY, 240 * s, 0xffd9dd);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      angle: (this.team === 'enemy' ? 1 : -1) * 104,
      x: this.x + (this.team === 'enemy' ? 74 : -74),
      y: this.y + this.visualHeight * 0.14,
      alpha: 0.55,
      duration: 620,
      ease: 'Quad.easeOut'
    });
  }

  /** Levanta um caido (revive / Cleric). */
  raise(fraction: number): void {
    if (!this.downed) return;
    this.downed = false;
    this.hp = Math.max(1, Math.floor(this.maxHp * fraction));
    this.scene.tweens.killTweensOf(this);
    this.setAngle(0);
    this.setAlpha(1);
    this.clearTint();
    this.bar?.setVisible(true).setRatio(this.hp / this.maxHp);
    this.shadow.setAlpha(0.9);
    this.syncRig();
    if (this.showNumbers) this.popText('DE PE!', GREEN, 26);
  }

  isAlive(): boolean { return !this.downed; }

  // ------------------------------------------------------------------ VISUAL
  private flash(): void {
    const now = this.scene.time.now;
    if (now < this.flashUntil) return;
    this.flashUntil = now + 90;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (!this.active) return;
      if (this.downed) this.setTint(0x8e8e9c);
      else this.clearTint();
    });
  }

  private popText(txt: string, color: number, size: number): void {
    floatNumber(this.scene, this.x + (Math.random() - 0.5) * 22, this.y - this.barLift - 8, txt, color, size);
  }

  /** Golpe: squash na direcao do alvo, relativo a escala base. */
  swing(dirX: number): void {
    if (this.downed) return;
    // corpo-a-corpo ganha o crescente branco; quem atira ganha o projetil
    if (this.range <= 150) {
      slashArc(this.scene, this.x + this.bodyRadius * 0.5 * dirX, this.hitY, dirX, this.fxScale);
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.16,
      scaleY: this.baseScale * 0.88,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.active && !this.downed) this.setScale(this.baseScale);
      }
    });
    this.x += 6 * dirX;
  }

  /** Reposiciona sombra, barra e profundidade. Chamado todo frame. */
  syncRig(): void {
    this.shadow.setPosition(this.x, this.y);
    this.setDepth(this.pinDepth || this.y);
    this.shadow.setDepth((this.pinDepth || this.y) - 1);
    if (!this.downed) {
      this.bar?.setPosition(this.x, this.y - this.barLift).setDepth(this.y + 0.5);
    }
  }

  destroyRig(): void {
    this.shadow.destroy();
    this.bar?.destroy();
  }

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    this.bar?.destroy();
    super.destroy(fromScene);
  }
}
