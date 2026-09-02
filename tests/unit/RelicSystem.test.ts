import { describe, it, expect } from 'vitest';
import { RelicSystem } from '../../src/systems/RelicSystem';

describe('RelicSystem', () => {
  it('coinpurse adds 2 gold per relic', () => {
    const rs = new RelicSystem([{ id: 'coinpurse' } as any]);
    expect(rs.goldBonus()).toBe(2);
    const rs2 = new RelicSystem([{ id: 'coinpurse' } as any, { id: 'coinpurse' } as any]);
    expect(rs2.goldBonus()).toBe(4);
  });
  it('revive returns true if has revive', () => {
    const rs = new RelicSystem([{ id: 'revive' } as any]);
    expect(rs.hasRevive()).toBe(true);
  });
  it('revive false without', () => {
    const rs = new RelicSystem([{ id: 'meteor' } as any]);
    expect(rs.hasRevive()).toBe(false);
  });
  it('meteor damage 100 if owned', () => {
    const rs = new RelicSystem([{ id: 'meteor' } as any]);
    expect(rs.meteorDamage()).toBe(100);
    expect(rs.hasMeteor()).toBe(true);
  });
  it('meteor 0 if not owned', () => {
    const rs = new RelicSystem([]);
    expect(rs.meteorDamage()).toBe(0);
  });
  it('add relic', () => {
    const rs = new RelicSystem([]);
    rs.add({ id: 'coinpurse' } as any);
    expect(rs.count()).toBe(1);
  });
  it('sword gives attack bonus', () => {
    const rs = new RelicSystem([{ id: 'sword' } as any]);
    expect(rs.attackBonus()).toBeCloseTo(0.15);
  });
  it('shield gives defense bonus', () => {
    const rs = new RelicSystem([{ id: 'shield' } as any]);
    expect(rs.defenseBonus()).toBeCloseTo(0.20);
  });
  it('bomb damage 50 if owned', () => {
    const rs = new RelicSystem([{ id: 'bomb' } as any]);
    expect(rs.hasBomb()).toBe(true);
    expect(rs.bombDamage()).toBe(50);
  });
  it('crown detection', () => {
    expect(new RelicSystem([{ id: 'crown' } as any]).hasCrown()).toBe(true);
    expect(new RelicSystem([]).hasCrown()).toBe(false);
  });

  /**
   * O reroll saiu do jogo (uma carta por rodada, sem regular), entao `magnet`,
   * `dice` e `anvil` sairam com ele. O que entra no lugar sao os quatro efeitos
   * que existiam so como texto na carta: ampulheta, pena, luneta e coracao.
   */
  it('ampulheta acelera o ataque, e empilha', () => {
    expect(new RelicSystem([]).attackSpeedBonus()).toBe(0);
    expect(new RelicSystem([{ id: 'hourglass' } as any]).attackSpeedBonus()).toBeCloseTo(0.2);
    expect(new RelicSystem([{ id: 'hourglass' } as any, { id: 'hourglass' } as any])
      .attackSpeedBonus()).toBeCloseTo(0.4);
  });
  it('pena acelera o passo', () => {
    expect(new RelicSystem([{ id: 'feather' } as any]).moveSpeedBonus()).toBeCloseTo(0.3);
    expect(new RelicSystem([]).moveSpeedBonus()).toBe(0);
  });
  it('luneta soma alcance em pixels', () => {
    expect(new RelicSystem([{ id: 'telescope' } as any]).rangeBonus()).toBe(30);
    expect(new RelicSystem([{ id: 'telescope' } as any, { id: 'telescope' } as any]).rangeBonus()).toBe(60);
  });
  it('coracao cura por segundo', () => {
    expect(new RelicSystem([{ id: 'heart' } as any]).regenPerSecond()).toBe(1);
    expect(new RelicSystem([]).regenPerSecond()).toBe(0);
  });
  it('bomba empilha o dano', () => {
    expect(new RelicSystem([{ id: 'bomb' } as any, { id: 'bomb' } as any]).bombDamage()).toBe(100);
  });

  /** Nenhuma reliquia dos dados pode ser decorativa. */
  it('todo id em relics.json tem efeito lido pelo sistema', async () => {
    const data = (await import('../../src/data/relics.json')).default as Array<{ id: string }>;
    const WIRED = new Set([
      'meteor', 'bomb', 'sword', 'shield', 'hourglass',
      'feather', 'telescope', 'heart', 'revive', 'crown', 'coinpurse'
    ]);
    const dead = data.filter(r => !WIRED.has(r.id)).map(r => r.id);
    expect(dead).toEqual([]);
  });
});
