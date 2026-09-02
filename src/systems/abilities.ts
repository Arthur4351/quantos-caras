/**
 * O KIT — vocabulario mecanico do How Many Dudes.
 *
 * Antes deste arquivo o campo `ability` dos 42 caras nunca era lido: a familia
 * definia a habilidade e nenhuma delas existia em codigo. Resultado: 42 caras
 * que jogavam identicos. Aqui cada habilidade vira um numero que o
 * CombatSystem consulta todo passo de simulacao.
 *
 * Regra de design: quase tudo e passivo ou disparado por gatilho. O jogo e um
 * autobattler — o jogador decide a COMPOSICAO, nao a execucao.
 */

export type AbilityType =
  | 'block'       // chance de absorver o golpe inteiro
  | 'regen'       // cura HP/s em si mesmo
  | 'heal'        // cura HP/s em todos os aliados no raio
  | 'taunt'       // peso de aggro: inimigos preferem este alvo
  | 'crit'        // chance de dobrar o dano
  | 'aoe'         // fracao do dano espirrada nos inimigos proximos
  | 'cleave'      // atinge N inimigos adjacentes com dano cheio
  | 'lifesteal'   // cura uma fracao do dano causado
  | 'enrage'      // +atk por 10% de vida perdida
  | 'rally'       // aura: +atk% para todos os aliados
  | 'haste'       // aura: +velocidade de ataque% para todos os aliados
  | 'summon'      // invoca um esqueleto aliado a cada N segundos
  | 'deathscale'  // +atk% e +maxHP% por aliado caido
  | 'goldBonus';  // ouro extra no fim da wave (fora de combate)

/** Raio das habilidades de area, em px do canvas virtual 1920x1080. */
export const AOE_RADIUS = 130;
export const HEAL_RADIUS = 280;

/** Numeros por combatente, resolvidos no spawn. Zero = habilidade ausente. */
export interface Kit {
  block: number;
  regen: number;
  heal: number;
  taunt: number;
  crit: number;
  aoe: number;
  cleave: number;
  lifesteal: number;
  enrage: number;
  rally: number;
  haste: number;
  summon: number;
  deathscale: number;
  goldBonus: number;
}

export function emptyKit(): Kit {
  return {
    block: 0, regen: 0, heal: 0, taunt: 1, crit: 0, aoe: 0, cleave: 0,
    lifesteal: 0, enrage: 0, rally: 0, haste: 0, summon: 0, deathscale: 0,
    goldBonus: 0
  };
}

/** Le `ability: {type, value}` do dudes.json e devolve o kit resolvido. */
export function kitFrom(ability?: { type: string; value: number }): Kit {
  const k = emptyKit();
  if (!ability) return k;
  const v = ability.value;
  switch (ability.type as AbilityType) {
    case 'taunt': k.taunt = Math.max(1, v); break;
    case 'block': k.block = v; break;
    case 'regen': k.regen = v; break;
    case 'heal': k.heal = v; break;
    case 'crit': k.crit = v; break;
    case 'aoe': k.aoe = v; break;
    case 'cleave': k.cleave = v; break;
    case 'lifesteal': k.lifesteal = v; break;
    case 'enrage': k.enrage = v; break;
    case 'rally': k.rally = v; break;
    case 'haste': k.haste = v; break;
    case 'summon': k.summon = v; break;
    case 'deathscale': k.deathscale = v; break;
    case 'goldBonus': k.goldBonus = v; break;
  }
  return k;
}

/** Texto curto para o cartao da loja — o jogador tem que entender o kit. */
export function abilityBlurb(ability?: { type: string; value: number }): string {
  if (!ability) return '';
  const v = ability.value;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  switch (ability.type as AbilityType) {
    case 'block': return `BLOQUEIA ${pct(v)} DOS GOLPES`;
    case 'regen': return `REGENERA ${v} HP/S`;
    case 'heal': return `CURA ${v} HP/S EM AREA`;
    case 'taunt': return `PUXA AGGRO x${v}`;
    case 'crit': return `${pct(v)} DE CRITICO (2x)`;
    case 'aoe': return `DANO EM AREA ${pct(v)}`;
    case 'cleave': return `CORTA +${v} INIMIGOS`;
    case 'lifesteal': return `DRENA ${pct(v)} DO DANO`;
    case 'enrage': return `+${pct(v)} ATK POR 10% DE VIDA PERDIDA`;
    case 'rally': return `AURA +${pct(v)} ATK NO TIME`;
    case 'haste': return `AURA +${pct(v)} VEL. ATAQUE`;
    case 'summon': return `INVOCA ESQUELETO A CADA ${v}S`;
    case 'deathscale': return `+${pct(v)} POR ALIADO CAIDO`;
    case 'goldBonus': return `+${v} OURO POR WAVE`;
    default: return '';
  }
}
