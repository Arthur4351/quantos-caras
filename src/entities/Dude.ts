import Phaser from 'phaser';
import { DudeData } from '../types/DudeData';
import { Fighter } from './Fighter';
import { kitFrom } from '../systems/abilities';
import { dudeKey, DUDE_W, DUDE_H, FOOT_ORIGIN_Y } from '../art/textures';

/**
 * Altura na tela de um cara em combate. 1:1 com o canvas da textura: sem
 * reescala o traco de tinta fica limpo, e o cara ocupa ~1/9 da tela como no
 * How Many Dudes (a 108px ele era um bonequinho perdido no meio do rancho).
 */
export const DUDE_BATTLE_H = DUDE_H;
/** Topo da arte no canvas do cara — o resto e folga para chapeu/cabelo. */
const DUDE_CONTENT_TOP = 44;

export class Dude extends Fighter {
  readonly dudeData: DudeData;
  /** Quantas invocacoes este cara ja colocou no campo nesta batalha. */
  summoned = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, dudeData: DudeData, hpBonus = 0) {
    const key = scene.textures.exists(dudeKey(dudeData.id)) ? dudeKey(dudeData.id) : 'missing';
    const s = dudeData.stats;
    super(scene, x, y, key, {
      team: 'dude',
      hp: Math.floor(s.hp * (1 + hpBonus)),
      atk: s.atk,
      range: s.range,
      attackSpeed: s.attackSpeed,
      moveSpeed: s.moveSpeed,
      kit: kitFrom(dudeData.ability),
      visualHeight: DUDE_BATTLE_H,
      sourceHeight: DUDE_H,
      sourceWidth: DUDE_W,
      bodyWidth: 100,
      footOrigin: FOOT_ORIGIN_Y,
      contentTop: DUDE_CONTENT_TOP,
      barWidth: 84,
      /**
       * Sem barra de vida. No How Many Dudes o campo e feito de CARAS, nao de
       * HUD: a leitura de dano vem do flash branco e de quem cai. A contagem do
       * exercito vive num pill unico no rodape da cena de batalha.
       */
      bar: false
    });
    this.dudeData = dudeData;
    /**
     * A UNICA LINHA QUE LIGA UM CARA AO TRACO DELE.
     *
     * O motor de combate consulta `traits.ts` por este id. Nao e o Fighter que
     * conhece o traco (isso fecharia ciclo entre entidade e sistema): e o id,
     * cru, e o motor faz a ponte. Se um id do dudes.json nao tiver traco na
     * tabela, o cara simplesmente luta com os numeros do Kit — nada quebra.
     */
    this.traitId = dudeData.id;
  }

  /** Compatibilidade com o codigo que ainda le currentHp. */
  get currentHp(): number { return this.hp; }
  set currentHp(v: number) { this.hp = v; }

  heal(amount: number): void { this.healBy(amount, true); }
  takeDamage(n: number): void { this.hurt(n); }
}
