import Phaser from 'phaser';
import { Kit, emptyKit } from '../systems/abilities';
import { HpBar } from '../art/HpBar';
import { addShadow } from '../art/DudeSprite';
import { floatNumber } from '../art/UIKit';
import {
  aegisCrack, blockClink, bloodBurst, bloodStain, dustPuff, hitSpark, shockRing, slashArc, smokePop
} from '../art/fx';
import { RED, GREEN } from '../art/palette';
import { StatusBag, TraitState, emptyStatus, emptyTraitState, statusTint } from '../systems/status';

export type Team = 'dude' | 'enemy';

/**
 * DE ONDE VEIO O DANO. Muda o que pode e o que nao pode acontecer com ele.
 *
 * `hit` e um golpe que alguem desferiu: pode ser aparado, esquivado e contado
 * como "golpe recebido". `dot` e queimadura e veneno pingando — aparar fogo que
 * ja esta no seu corpo nao faz sentido, e se contasse como golpe recebido a
 * esquiva do fantasma zeraria sozinha na primeira fogueira. `true` e execucao:
 * a demissao do CEO e a queda da abducao nao negociam com nada.
 */
export type HitKind = 'hit' | 'dot' | 'true';

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
  private static seq = 0;
  /**
   * IDENTIDADE NUMERICA. Nao existe "mesmo objeto?" barato quando o que se quer
   * guardar e "em quem eu estava batendo no passo anterior": guardar a REFERENCIA
   * do alvo num campo prenderia o corpo morto na memoria pelo resto da wave. Um
   * numero nao prende nada, e e o que o entregador e o ciborgue comparam.
   */
  readonly uid: number = ++Fighter.seq;
  readonly team: Team;
  hp: number;
  maxHp: number;
  atk: number;
  range: number;
  attackSpeed: number;
  moveSpeed: number;
  kit: Kit;
  downed = false;

  /** Saco de estados (fogo, gelo, escudo, maldicao...). Ver systems/status.ts. */
  st: StatusBag = emptyStatus();
  /** Contadores do traco de assinatura. Criados aqui, mutados no lugar. */
  tr: TraitState = emptyTraitState();
  /**
   * QUAL dos 42 caras e este. E o `id` do dudes.json, e so isso — a tabela de
   * tracos e consultada pelo motor. Se o Fighter importasse `traits.ts`, e
   * `traits.ts` precisa do tipo Fighter, o ciclo fecharia e o Vite quebraria.
   */
  traitId?: string;
  /**
   * COMO ESTE CARA ESCOLHE ALVO. `near` e o padrao de todo mundo: bate em quem
   * esta mais perto. `far` e o salto orbital do astronauta — ele pula a linha de
   * frente e vai atras de quem esta no fundo. Um unico campo aqui evita um
   * `if (traitId === 'astro')` dentro do `pickTarget`.
   */
  aimMode: 'near' | 'far' = 'near';
  /** Em quem ele esta batendo AGORA. O espiao precisa saber quem esta de costas. */
  aim?: Fighter;
  /** Quem bateu por ultimo. O contra-ataque do cavaleiro sai daqui. */
  lastHitBy?: Fighter;
  /** Quem abduziu este corpo, e quanto ele leva ao cair de volta no chao. */
  suspendBy?: Fighter;
  suspendDrop = 0;

  /**
   * TRES AVISOS QUE O MOTOR PENDURA AQUI.
   *
   * O `hurt()` e o unico gargalo de dano do jogo, e o `Projectile` e o unico
   * lugar onde uma flecha encosta em alguem — os dois vivem nesta pasta. Os
   * tracos vivem em `systems/`. Em vez de a entidade conhecer o sistema (ciclo),
   * o sistema PENDURA a funcao na entidade quando o combatente nasce.
   */
  onDamaged?: (dealt: number, by?: Fighter, kind?: HitKind) => void;
  onBlocked?: (by?: Fighter) => void;
  onLanded?: (target: Fighter, dealt: number) => void;
  onDowned?: () => void;

  /** Segundos ate o proximo ataque. */
  cd = 0;
  /** Segundos ate a proxima invocacao. */
  summonCd = 0;
  /** Multiplicadores de aura, reescritos pelo CombatSystem a cada passo. */
  auraAtk = 1;
  auraSpeed = 1;

  /**
   * Nao e `readonly` por causa de UM cara: o cavaleiro-osso CRESCE de verdade a
   * cada aliado que cai (ver `grow`). Todo o resto le e nunca escreve.
   */
  baseScale: number;
  /** O tamanho de fabrica. Serve de referencia para o teto do `grow`. */
  readonly startScale: number;
  readonly visualHeight: number;
  /**
   * Meia-largura do corpo na tela. O alcance e o empurrao entre unidades saem
   * daqui: sem isto um urso polar e um pirralho brigam a mesma distancia e os
   * corpos grandes se atravessam.
   */
  bodyRadius: number;
  private shadow: Phaser.GameObjects.Image;
  private bar?: HpBar;
  private showNumbers: boolean;
  private barLift: number;
  private artAbove: number;
  private flashUntil = 0;
  /** Ultima cor aplicada. Evita reescrever tint de 440 corpos a 60 passos/s. */
  private tintKey = 0;
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
    this.startScale = this.baseScale;
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
   * O UNICO PORTAO DE DANO DO JOGO. Devolve o que REALMENTE saiu da vida.
   *
   * A ordem abaixo nao e arbitraria — cada linha existe porque um cara especifico
   * quebraria sem ela:
   *
   *  1. imunidade  — o ultimo suspiro do viking precisa vir ANTES de tudo, senao
   *                  o segundo golpe do mesmo frame mata quem acabou de escapar.
   *  2. esquiva    — o fantasma desvia 1 em cada 3 GOLPES; queimadura nao conta,
   *                  ou uma fogueira zeraria o contador dele de graca.
   *  3. bloqueio   — e o gatilho do contra-ataque do cavaleiro.
   *  4. maldicao   — a mumia AMPLIFICA antes de qualquer reducao, senao a ordem
   *                  entre ela e o robo mudaria o numero final.
   *  5. guarda     — a cobertura do robo corta uma fracao chapada.
   *  6. escudo     — o paladino come o resto ANTES da vida. Sem isto o escudo
   *                  seria vida extra invisivel e o numero na tela mentiria.
   *
   * O aviso `onDamaged` sai antes do tombo de proposito: e ali que o viking se
   * segura em 1 de vida, e o motor so verifica a queda depois de ouvir o traco.
   */
  hurt(amount: number, showNumber = true, by?: Fighter, kind: HitKind = 'hit'): number {
    if (this.downed) return 0;
    const s = this.st;
    if (kind !== 'true') {
      if (s.immune > 0) {
        blockClink(this.scene, this.x, this.hitY, this.fxScale * 1.3);
        return 0;
      }
      if (kind === 'hit') {
        this.tr.taken++;
        if (s.dodgeEvery > 0 && this.tr.taken % s.dodgeEvery === 0) {
          smokePop(this.scene, this.x, this.y, this.fxScale * 0.8, 0xd7e6ff);
          return 0;
        }
        if (this.kit.block > 0 && Math.random() < this.kit.block) {
          // sem palavra: o anel nasce NO peito de quem aparou (ver fx.blockClink)
          blockClink(this.scene, this.x, this.hitY, this.fxScale);
          this.onBlocked?.(by);
          return 0;
        }
      }
    }
    let dealt = Math.max(0, amount);
    if (s.vuln > 0) dealt *= 1 + s.vulnPow;
    if (s.guard > 0) dealt *= 1 - s.guardPow;
    if (s.shield > 0 && dealt > 0) {
      const eaten = Math.min(s.shield, dealt);
      s.shield -= eaten;
      dealt -= eaten;
      if (s.shield <= 0.5) { s.shield = 0; aegisCrack(this.scene, this.x, this.hitY, this.fxScale); }
      else blockClink(this.scene, this.x, this.hitY, this.fxScale * 0.8);
      if (dealt <= 0) return 0;
    }
    this.hp = Math.max(0, this.hp - dealt);
    this.syncBar();
    // 34px, nao 24: numeros so nascem nos MEUS caras e nos chefes (Enemy passa
    // `numbers: notable`), entao o canal que grita "voce esta perdendo gente" tinha
    // 12 unidades de altura num campo de 1080 e desaparecia dentro da multidao.
    if (showNumber && this.showNumbers && dealt >= 1) this.popText(`-${Math.round(dealt)}`, RED, 34);
    this.flash();
    if (dealt >= 1 && kind !== 'dot') this.impact(dealt);
    if (by) this.lastHitBy = by;
    this.onDamaged?.(dealt, by, kind);
    this.syncBar();
    if (this.hp <= 0) this.down();
    return dealt;
  }

  private syncBar(): void { this.bar?.setRatio(this.hp / this.maxHp); }

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
    this.syncBar();
    if (showNumber && this.showNumbers) this.popText(`+${Math.round(amount)}`, GREEN, 22);
  }

  /** Aumenta o teto de vida (deathscale) mantendo a proporcao atual. */
  setMaxHp(value: number): void {
    if (value <= this.maxHp) return;
    const gain = value - this.maxHp;
    this.maxHp = value;
    this.hp = Math.min(this.maxHp, this.hp + gain);
    this.syncBar();
  }

  /**
   * CRESCER DE VERDADE. O cavaleiro-osso engorda a cada aliado que cai, e "ficar
   * maior" nao pode ser so um numero maior escondido na ficha: o corpo cresce, a
   * sombra cresce com ele, o alcance cresce (`bodyRadius` alimenta o alcance e o
   * empurrao) e a barra sobe junto. Teto de 1.7x — acima disso ele engole a tela
   * e o time inteiro fica atras dele sem conseguir alcancar ninguem.
   */
  grow(mult: number): void {
    const want = Phaser.Math.Clamp(this.baseScale * mult, 0, this.startScale * 1.7);
    if (want <= this.baseScale + 0.0001) return;
    const k = want / this.baseScale;
    this.baseScale = want;
    this.bodyRadius *= k;
    this.artAbove *= k;
    this.barLift = this.artAbove + 14;
    this.fxScale = Phaser.Math.Clamp(this.fxScale * k, 0.55, 2.6);
    this.setScale(want);
    this.shadow.setDisplaySize(this.shadow.displayWidth * k, this.shadow.displayHeight * k);
    this.syncRig();
  }

  // ------------------------------------------------------------------ ESTADO
  /**
   * DE QUE LADO ELE ESTA AGORA — nao de que lado ele nasceu.
   *
   * `team` e a origem e nunca muda: e o que decide se o cara sangra, para que
   * lado ele olha e se conta como perda do jogador. `side` e a lealdade DESTE
   * instante, e o virus do hacker inverte ela por 4 segundos. Todo o combate
   * (quem e aliado, quem e alvo, quem venceu) le `side`; so o visual le `team`.
   */
  get side(): Team {
    if (this.st.charm <= 0) return this.team;
    return this.team === 'dude' ? 'enemy' : 'dude';
  }

  /** Da para bater nele? Caido nao, e abduzido (fora do campo) tambem nao. */
  isTargetable(): boolean { return !this.downed && this.st.suspend <= 0; }

  /**
   * ABDUZIDO: sai do campo sem sair da lista.
   *
   * O alien tira um inimigo de jogo por 2.5s. Destruir e recriar o corpo perderia
   * vida, estados e contadores; deixar o corpo la parado deixaria o time todo
   * batendo num boneco invisivel. Entao ele continua `active` (para os relogios
   * de estado seguirem contando), mas sai do desenho, sai da grade e sai da mira.
   */
  setSuspended(on: boolean): void {
    this.setVisible(!on);
    this.shadow.setVisible(!on);
    this.bar?.setVisible(!on && !this.downed);
    if (!on) smokePop(this.scene, this.x, this.y, this.fxScale, 0xbfe9ff);
  }

  /** CAIDO, nao morto: continua no campo e conta para quem escala com quedas. */
  down(): void {
    if (this.downed) return;
    this.downed = true;
    this.hp = 0;
    this.bar?.setVisible(false);
    this.setVisible(true);
    this.clearTint();
    this.tintKey = 0x8e8e9c;
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
    // o corpo caiu: o zumbi estoura em praga, o esqueleto marca o relogio da
    // remontagem. O motor pendura o aviso; a entidade so avisa.
    this.onDowned?.();
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

  /** Levanta um caido (revive / Cleric / a remontagem do esqueleto). */
  raise(fraction: number): void {
    if (!this.downed) return;
    this.downed = false;
    this.hp = Math.max(1, Math.floor(this.maxHp * fraction));
    this.scene.tweens.killTweensOf(this);
    this.setAngle(0);
    this.setAlpha(1);
    this.setVisible(this.st.suspend <= 0);
    this.clearTint();
    this.tintKey = 0;
    // quem levanta levanta LIMPO: sem fogo, sem gelo, sem maldicao herdada da
    // vida anterior — senao o esqueleto remonta e cai outra vez no mesmo passo.
    this.st.burn = 0; this.st.burnDps = 0; this.st.stun = 0; this.st.root = 0;
    this.st.frost = 0; this.st.slow = 0; this.st.slowPow = 0;
    this.bar?.setVisible(true).setRatio(this.hp / this.maxHp);
    this.shadow.setAlpha(0.9);
    this.syncRig();
    if (this.showNumbers) this.popText('DE PE!', GREEN, 26);
  }

  isAlive(): boolean { return !this.downed; }

  // ------------------------------------------------------------------ VISUAL
  /**
   * A COR DO CORPO CONTA O ESTADO — e so escreve quando a cor MUDA.
   *
   * Sao ate 440 corpos a 60 passos por segundo. Chamar `setTint` em todos, todo
   * passo, seria meio milhao de escritas por segundo para pintar quase sempre a
   * mesma cor. Guardar a ultima cor e comparar transforma isso em uma comparacao
   * de numeros, e a escrita acontece so no passo em que o cara pegou fogo.
   */
  restoreTint(): void {
    if (!this.active || this.downed) return;
    if (this.scene.time.now < this.flashUntil) return;
    const want = statusTint(this.st);
    if (want === this.tintKey) return;
    this.tintKey = want;
    if (want) this.setTint(want); else this.clearTint();
  }

  private flash(): void {
    const now = this.scene.time.now;
    if (now < this.flashUntil) return;
    this.flashUntil = now + 90;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (!this.active) return;
      if (this.downed) { this.setTint(0x8e8e9c); return; }
      // volta para a cor do ESTADO, nao para o cru: quem esta pegando fogo tem
      // que voltar laranja depois do lampejo branco, ou o fogo pisca e desaparece.
      this.tintKey = -1;
      this.flashUntil = 0;
      this.restoreTint();
    });
  }

  /** O corpo devolve o publico dos FX: escala de tinta usada pelos tracos. */
  get punch(): number { return this.fxScale; }

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
    // quem virou a casaca tem que VIRAR A CARA junto: um inimigo enfeiticado
    // lutando pelo jogador atacaria de costas para o proprio alvo.
    if (!this.downed) this.setFlipX(this.side === 'enemy');
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
