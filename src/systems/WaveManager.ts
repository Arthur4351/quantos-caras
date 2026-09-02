import { WaveData } from '../types/WaveData';
import { Enemy } from '../entities/Enemy';
import { enemyType } from './enemyTypes';
import { curveAtk, curveHp, curveGold } from './Balance';

/** Uma entrada do bestiario liberada a partir de uma wave. */
interface Slot {
  type: string;
  /** Primeira wave em que aparece. */
  from: number;
  /** Quantidade base + crescimento por wave depois de `from`. */
  base: number;
  growth: number;
  /** Teto para nao explodir o frame. */
  cap: number;
  hp: number;
  atk: number;
}

/**
 * A escala e a assinatura do jogo: o campo tem que ENCHER. Antes disto uma wave
 * tardia trazia 8 pirralhos e 3 lobos. Agora a tropa cresce por tipo, cada tipo
 * entra numa wave propria e o bestiario inteiro aparece.
 *
 * Os portoes de entrada sao ADIANTADOS de proposito: o exercito do jogador
 * empilha copias do mesmo cara, e uma parede de pirralhos nunca ameaca um blocao
 * de trinta copias — quem ameaca e a ELITE, que bate em area e critica. Ratel na
 * 10, abelha gigante na 14, unicornio na 20, urso na 26. De quebra, silhueta
 * nova em campo a cada poucas rodadas.
 */
const ROSTER: Slot[] = [
  { type: 'toddler',     from: 1,  base: 6,  growth: 2.6,  cap: 240, hp: 18,  atk: 4 },
  { type: 'duck',        from: 3,  base: 3,  growth: 2.0,  cap: 200, hp: 22,  atk: 5 },
  { type: 'wolf',        from: 5,  base: 2,  growth: 1.4,  cap: 150, hp: 34,  atk: 8 },
  { type: 'bee',         from: 8,  base: 4,  growth: 2.2,  cap: 220, hp: 14,  atk: 6 },
  { type: 'honeybadger', from: 10, base: 2,  growth: 1.5,  cap: 140, hp: 46,  atk: 10 },
  { type: 'beeGiant',    from: 14, base: 1,  growth: 0.7,  cap: 80,  hp: 70,  atk: 14 },
  { type: 'unicorn',     from: 20, base: 1,  growth: 0.5,  cap: 60,  hp: 110, atk: 20 },
  { type: 'polarbear',   from: 26, base: 1,  growth: 0.4,  cap: 50,  hp: 190, atk: 28 }
];

export class WaveManager {
  constructor(_waves: WaveData[] = []) {}

  generateWave(wave: number): WaveData {
    if (wave % 10 === 0) return this.bossWave(wave);
    return { wave, enemies: this.roster(wave), rewardGold: curveGold(5, wave), isBoss: false };
  }

  /** A turba da wave: todo tipo liberado, na quantidade e nos stats daquela wave. */
  private roster(wave: number, scale = 1): WaveData['enemies'] {
    return ROSTER
      .filter(s => wave >= s.from)
      .map(s => ({
        type: s.type,
        count: Math.round(Math.min(s.cap, Math.round(s.base + (wave - s.from) * s.growth)) * scale),
        hp: curveHp(s.hp, wave),
        atk: curveAtk(s.atk, wave)
      }))
      .filter(e => e.count > 0);
  }

  /**
   * O CHEFE ENTRA EM CIMA DA WAVE, nao no lugar dela.
   *
   * Antes a wave de chefe trocava a horda por "1 gorila + 10 pirralhos": a wave
   * 16 trazia 120 bichos e a 20, que devia ser o pico, trazia 35. A rodada
   * redonda era ALIVIO. Agora a turba continua no campo — em 62%, porque a horda
   * inteira MAIS o chefe era chacina medida no simulador: wipe em 100% das
   * tentativas na wave 10 — e o chefe anda na frente dela.
   */
  private bossWave(wave: number): WaveData {
    const isGod = wave % 50 === 0;
    // o dano do chefe passou a escalar por multiplicacao (`curveAtk`), entao a
    // base caiu: com 30 de base o gorila da wave 10 batia 63 em area tripla e
    // matava tres caras por golpe
    const boss = isGod
      ? { type: 'god', hp: 2600, atk: 32 }
      : { type: 'gorilla', hp: 1000, atk: 19 };
    return {
      wave,
      enemies: [
        {
          type: boss.type,
          count: 1 + Math.floor(wave / 50),
          hp: curveHp(boss.hp, wave),
          atk: curveAtk(boss.atk, wave)
        },
        ...this.roster(wave, 0.62)
      ],
      rewardGold: 12 + Math.floor(wave * 0.8),
      isBoss: true
    };
  }

  getWave(n: number): WaveData {
    return this.generateWave(Math.max(1, n));
  }

  /** Titulo curto da wave para o cabecalho ("URSO POLAR x12"). */
  headline(wave: number): string {
    const data = this.getWave(wave);
    // na wave de chefe o nome que importa e o DELE, e ele e sempre o primeiro
    const star = data.isBoss ? data.enemies[0] : [...data.enemies].reverse()[0];
    if (!star) return `WAVE ${wave}`;
    const total = data.enemies.reduce((sum, e) => sum + e.count, 0);
    return `${enemyType(star.type).label} · ${total} INIMIGOS`;
  }

  /**
   * Distribui a horda em BLOCO na metade direita do chao. Nada acima do
   * horizonte: o eixo y e a linha do chao, entao spawnar em y=200 punha
   * inimigos flutuando no ceu (era o bug antigo).
   *
   * O bloco e centrado e mais largo que alto — 6 pirralhos viram um bando, nao
   * uma escadinha de um por linha esticada por 500px de terra vazia.
   */
  spawn(scene: Phaser.Scene, wave: number, ground = { minX: 1080, maxX: 1860, minY: 470, maxY: 940 }): Enemy[] {
    const data = this.getWave(wave);
    const out: Enemy[] = [];
    const spanX = ground.maxX - ground.minX;
    const spanY = ground.maxY - ground.minY;
    const midY = ground.minY + spanY / 2;

    // o chefe caminha NA FRENTE da propria escolta; o resto e turba
    type Unit = { hp: number; atk: number; type: string };
    const bosses: Unit[] = [];
    const mob: Unit[] = [];
    data.enemies.forEach((e, i) => {
      const bucket = data.isBoss && i === 0 ? bosses : mob;
      for (let k = 0; k < e.count; k++) bucket.push({ hp: e.hp, atk: e.atk, type: e.type });
    });
    // MISTURA a turba: em fila indiana ela virava faixas verticais de um bicho so
    for (let i = mob.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mob[i], mob[j]] = [mob[j], mob[i]];
    }

    // formacao mais larga que profunda, como uma multidao avancando. 11 linhas
    // e o teto: com 13 as linhas ficavam a 42px numa horda de 110px de altura e
    // a fileira da frente engolia a cabeca de todo mundo atras.
    const rows = Math.max(2, Math.min(11, Math.round(Math.sqrt(mob.length * 0.62))));
    const cols = Math.max(1, Math.ceil(mob.length / rows));
    // aperta as colunas quando a horda e grande; espalha quando e pequena
    const strideX = Math.max(26, Math.min(96, spanX / cols));
    const strideY = Math.min(96, rows > 1 ? spanY / (rows - 1) : spanY);
    const y0 = ground.minY + (spanY - strideY * (rows - 1)) / 2;
    const bossRoom = bosses.length ? 150 : 0;

    bosses.forEach((b, i) => {
      const x = ground.minX + 30 + (i % 2) * 96;
      const y = midY + (i - (bosses.length - 1) / 2) * 150;
      out.push(new Enemy(scene, x, Math.max(ground.minY, Math.min(ground.maxY, y)), b.hp, b.atk, b.type));
    });

    mob.forEach((spec, index) => {
      const row = index % rows;
      const col = Math.floor(index / rows);
      const x = ground.minX + bossRoom + col * strideX + (row % 2) * (strideX * 0.45) + Math.random() * 8;
      const y = y0 + row * strideY + (Math.random() - 0.5) * 14;
      const yc = Math.max(ground.minY, Math.min(ground.maxY, y));
      out.push(new Enemy(scene, Math.min(x, ground.maxX), yc, spec.hp, spec.atk, spec.type));
    });
    return out;
  }
}
