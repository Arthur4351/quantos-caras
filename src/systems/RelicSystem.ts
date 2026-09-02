import { RelicData } from '../types/RelicData';

/**
 * RELIQUIAS — cada uma TEM que fazer algo.
 *
 * Este arquivo tinha quinze reliquias e cinco efeitos. O jogador escolhia uma
 * de tres a cada tres waves e, dois tercos das vezes, levava para casa uma carta
 * decorativa: `magnet` e `dice` mexiam no reroll (que nao existe mais), `anvil`
 * baixava um custo que ninguem cobra, `book` dizia "+10% XP (placeholder)" num
 * jogo sem XP, e ampulheta/pena/luneta/coracao nao tinham UMA linha de codigo.
 * Uma recompensa que nao recompensa e pior que nenhuma: ela gasta a decisao do
 * jogador. Agora sao onze reliquias e onze efeitos, todos lidos em Battle.
 */
export class RelicSystem {
  constructor(private relics: RelicData[] = []) {}

  private count_(id: string): number {
    return this.relics.filter(r => r.id === id).length;
  }

  goldBonus(): number {
    return this.count_('coinpurse') * 2;
  }

  hasRevive(): boolean {
    return this.relics.some(r => r.id === 'revive');
  }

  meteorDamage(): number {
    return this.relics.some(r => r.id === 'meteor') ? 100 : 0;
  }

  hasMeteor(): boolean {
    return this.relics.some(r => r.id === 'meteor');
  }

  attackBonus(): number {
    return this.count_('sword') * 0.15;
  }

  defenseBonus(): number {
    return this.count_('shield') * 0.2;
  }

  /** Multiplicador de velocidade de ataque dos MEUS caras (ampulheta). */
  attackSpeedBonus(): number {
    return this.count_('hourglass') * 0.2;
  }

  /** Multiplicador de velocidade de deslocamento (pena). */
  moveSpeedBonus(): number {
    return this.count_('feather') * 0.3;
  }

  /** Alcance somado em pixels (luneta). */
  rangeBonus(): number {
    return this.count_('telescope') * 30;
  }

  /** Vida curada por segundo, para sempre (coracao). */
  regenPerSecond(): number {
    return this.count_('heart') * 1;
  }

  hasBomb(): boolean {
    return this.relics.some(r => r.id === 'bomb');
  }

  bombDamage(): number {
    return this.count_('bomb') * 50;
  }

  hasCrown(): boolean {
    return this.relics.some(r => r.id === 'crown');
  }

  add(relic: RelicData): void {
    this.relics.push(relic);
  }

  getAll(): RelicData[] {
    return [...this.relics];
  }

  count(): number {
    return this.relics.length;
  }
}
