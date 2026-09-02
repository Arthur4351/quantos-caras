import { Kit, emptyKit } from './abilities';

/**
 * O BESTIARIO — cada tipo de inimigo tem comportamento proprio.
 *
 * Antes disto todo inimigo do jogo andava a 40px/s, batia a cada 1000ms e tinha
 * alcance 60, independente de ser um bebe engatinhando ou um deus. Um pato
 * precisa correr; um urso polar precisa ser uma parede lenta que bate forte.
 */
export interface EnemyType {
  /** Nome exibido em maiusculas nos avisos de wave. */
  label: string;
  /** Altura desejada na tela, em px. Manda na sensacao de escala. */
  height: number;
  /** Alcance do golpe, em px. */
  range: number;
  /** Ataques por segundo. */
  attackSpeed: number;
  /** px por segundo. */
  moveSpeed: number;
  /** Multiplicadores aplicados sobre o hp/atk da wave. */
  hpMult: number;
  atkMult: number;
  /** Kit parcial: mesclado sobre emptyKit(). */
  kit?: Partial<Kit>;
  boss?: boolean;
  /** Flutua (abelhas): ignora sombra pesada e balanca no ar. */
  flying?: boolean;
}

export const ENEMY_TYPES: Record<string, EnemyType> = {
  // ---- lixo de wave: muitos, fracos, rapidos ----
  toddler: {
    label: 'PIRRALHO', height: 88, range: 52,
    attackSpeed: 1.1, moveSpeed: 78, hpMult: 1, atkMult: 1
  },
  duck: {
    label: 'PATO', height: 92, range: 54,
    attackSpeed: 1.6, moveSpeed: 118, hpMult: 0.8, atkMult: 0.85
  },
  bee: {
    label: 'ABELHA', height: 76, range: 48,
    attackSpeed: 2.2, moveSpeed: 150, hpMult: 0.5, atkMult: 0.7,
    flying: true
  },

  // ---- tropa de linha ----
  wolf: {
    label: 'LOBO', height: 122, range: 62,
    attackSpeed: 1.3, moveSpeed: 132, hpMult: 1.6, atkMult: 1.4,
    kit: { crit: 0.18 }
  },
  honeybadger: {
    label: 'RATEL', height: 108, range: 58,
    attackSpeed: 1.5, moveSpeed: 140, hpMult: 1.9, atkMult: 1.3,
    // o bicho mais destemido do planeta: ignora golpe e nao para de vir
    kit: { block: 0.22, enrage: 0.05 }
  },
  beeGiant: {
    label: 'ABELHA GIGANTE', height: 134, range: 70,
    attackSpeed: 1.4, moveSpeed: 116, hpMult: 2.4, atkMult: 1.7,
    kit: { lifesteal: 0.2 }, flying: true
  },

  // ---- elite ----
  unicorn: {
    label: 'UNICORNIO', height: 172, range: 76,
    attackSpeed: 1.2, moveSpeed: 124, hpMult: 3.4, atkMult: 2.1,
    kit: { crit: 0.3, cleave: 1 }
  },
  polarbear: {
    label: 'URSO POLAR', height: 202, range: 84,
    attackSpeed: 0.7, moveSpeed: 62, hpMult: 5.5, atkMult: 3,
    kit: { taunt: 2, cleave: 2 }
  },

  // ---- bosses ----
  gorilla: {
    label: 'GORILA', height: 244, range: 96,
    attackSpeed: 0.8, moveSpeed: 70, hpMult: 1, atkMult: 1,
    kit: { cleave: 3, enrage: 0.04 }, boss: true
  },
  god: {
    label: 'DEUS', height: 286, range: 220,
    attackSpeed: 0.9, moveSpeed: 54, hpMult: 1, atkMult: 1,
    kit: { aoe: 0.6, block: 0.2, regen: 12 }, boss: true
  }
};

export function enemyType(type: string): EnemyType {
  return ENEMY_TYPES[type] ?? ENEMY_TYPES.toddler;
}

/** Kit completo de um tipo, ja mesclado sobre os padroes. */
export function enemyKit(type: string): Kit {
  return { ...emptyKit(), ...(enemyType(type).kit ?? {}) };
}
