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
      'feather', 'telescope', 'heart', 'revive', 'crown', 'coinpurse',
      // as seis de classe, executadas por `systems/RelicRites.ts`
      'warhorn', 'graveyard', 'union', 'grimoire', 'plasma', 'spotlight'
    ]);
    const dead = data.filter(r => !WIRED.has(r.id)).map(r => r.id);
    expect(dead).toEqual([]);
  });

  /**
   * O VALOR VEM DO CATALOGO, NAO DO OBJETO SALVO.
   *
   * O save guarda a reliquia inteira como ela era no dia da escolha. Se o sistema
   * lesse `r.effect.value`, um rebalanceamento de hoje nunca chegaria a quem jogou
   * ontem — e um `{ id }` cru (como os stubs destes testes e os saves velhos) nao
   * teria efeito nenhum. Este teste tranca as duas coisas de uma vez.
   */
  it('le o numero do catalogo e ignora o efeito gravado no save', () => {
    const mentiroso = { id: 'sword', effect: { target: 'attack', value: 99 } } as any;
    expect(new RelicSystem([mentiroso]).attackBonus()).toBeCloseTo(0.15);
    // id que nao existe mais no catalogo: nao explode, nao vale nada
    expect(new RelicSystem([{ id: 'dice' } as any]).attackBonus()).toBe(0);
  });
});

/**
 * O SEGUNDO ANDAR DA LOJA — as seis reliquias de classe.
 *
 * O que este bloco tranca nao e o numero de cada uma (isso e balanceamento, e ele
 * muda), e sim as tres promessas que a loja faz ao jogador: uma reliquia por
 * familia, cada uma respondendo por UM verbo, e nenhuma delas empilhando por copia.
 */
describe('reliquias de classe', () => {
  const CLASSE: Array<[string, string, keyof RelicSystem, number]> = [
    ['warhorn', 'Warrior', 'openImmuneSeconds', 3],
    ['graveyard', 'Undead', 'corpseFeastHeal', 6],
    ['union', 'Employed', 'unionRushSeconds', 5],
    ['grimoire', 'Fantasy', 'traitHaste', 0.35],
    ['plasma', 'SciFi', 'plasmaShieldFraction', 0.25],
    ['spotlight', 'Action', 'lastStandBonus', 1]
  ];

  it.each(CLASSE)('%s serve %s e vale o numero do catalogo', (id, family, getter, value) => {
    const vazio = new RelicSystem([]);
    expect((vazio[getter] as () => number)()).toBe(0);
    expect(vazio.hasClassRelic(family)).toBe(false);

    const rs = new RelicSystem([{ id } as any]);
    expect((rs[getter] as () => number)()).toBeCloseTo(value);
    expect(rs.hasClassRelic(family)).toBe(true);
    expect(rs.hasAnyClassRelic()).toBe(true);
    expect(rs.classRelics().map(r => r.id)).toEqual([id]);
  });

  /** Cada uma responde por UM verbo: nenhuma acende o ritual da vizinha. */
  it('nenhuma reliquia de classe liga o efeito de outra familia', () => {
    for (const [id] of CLASSE) {
      const rs = new RelicSystem([{ id } as any]);
      const acesos = CLASSE.filter(([, , g]) => (rs[g] as () => number)() > 0).map(([i]) => i);
      expect(acesos).toEqual([id]);
    }
  });

  /**
   * NAO EMPILHA POR COPIA. A loja nunca oferece o que voce ja tem, entao a segunda
   * copia so chega por save antigo — e duas cornetas nao podem dar 6s de abertura.
   */
  it('copia dobrada nao dobra o efeito', () => {
    const duas = new RelicSystem([{ id: 'warhorn' } as any, { id: 'warhorn' } as any]);
    expect(duas.openImmuneSeconds()).toBe(3);
    expect(new RelicSystem([{ id: 'plasma' } as any, { id: 'plasma' } as any])
      .plasmaShieldFraction()).toBeCloseTo(0.25);
  });

  /** Reliquia geral nao e de classe — os rituais nem ligam com o rancho todo de bolsa. */
  it('so as gerais deixam hasAnyClassRelic falso', () => {
    const gerais = new RelicSystem([
      { id: 'sword' } as any, { id: 'coinpurse' } as any, { id: 'meteor' } as any
    ]);
    expect(gerais.hasAnyClassRelic()).toBe(false);
    expect(gerais.classRelics()).toEqual([]);
    expect(gerais.hasClassRelic('Warrior')).toBe(false);
  });

  /** `family` e CHAVE: se nao existir em families.json, a paleta e o rotulo quebram. */
  it('cada familia do catalogo existe em families.json e tem uma reliquia so', async () => {
    const data = (await import('../../src/data/relics.json')).default as Array<{ id: string; family?: string }>;
    const familias = (await import('../../src/data/families.json')).default as Record<string, unknown>;
    const porFamilia = new Map<string, string[]>();
    for (const r of data) {
      if (!r.family) continue;
      expect(Object.keys(familias)).toContain(r.family);
      porFamilia.set(r.family, [...(porFamilia.get(r.family) ?? []), r.id]);
    }
    expect([...porFamilia.keys()].sort()).toEqual(Object.keys(familias).sort());
    for (const [, ids] of porFamilia) expect(ids).toHaveLength(1);
  });

  /**
   * A CARTA TEM 330px DE LARGURA e a descricao quebra em 282. Nome e descricao
   * unicos porque a mesa mostra tres ao mesmo tempo: duas cartas com o mesmo texto
   * nao sao uma escolha. O teto de 56 caracteres e o que cabe em tres linhas de
   * 23px sem passar do rodape da carta — ver `Reward.relicCard`.
   */
  it('nome e descricao unicos e do tamanho da carta', async () => {
    const data = (await import('../../src/data/relics.json')).default as Array<{ name: string; description: string }>;
    expect(new Set(data.map(r => r.name)).size).toBe(data.length);
    expect(new Set(data.map(r => r.description)).size).toBe(data.length);
    for (const r of data) {
      expect(r.name.length).toBeLessThanOrEqual(12);
      expect(r.description.length).toBeGreaterThan(20);
      expect(r.description.length).toBeLessThanOrEqual(56);
    }
  });
});
