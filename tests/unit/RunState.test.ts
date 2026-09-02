import { describe, it, expect } from 'vitest';
import dudes from '../../src/data/dudes.json';
import { DudeData } from '../../src/types/DudeData';
import {
  DRAFT_SIZE, HERO_ID, MAX_ARMY, PACK_MAX, SQUAD_TYPES, TRAIN_ATK, TRAIN_HP, TRAIN_MAX,
  addPack, battleStats, canBuyCopy, canTrain, cloneDude, copiesFor, copyPrice, countById,
  distinctIds, draftOffers, eventFor, grantHero, heroDude, heroGrantAt, offersFromIds,
  packSize, snackById, snackOffers, squadFull, startingInventory,
  train, trainLevel, uniqueOwned
} from '../../src/systems/RunState';

const ALL = dudes as DudeData[];
const byId = (id: string) => ALL.find(d => d.id === id)!;
const five = () => ALL.slice(0, SQUAD_TYPES).map(d => ({ ...d }));

describe('RunState / draft', () => {
  it('oferece exatamente tres cartas', () => {
    for (const wave of [1, 4, 9, 20, 47]) {
      expect(draftOffers([], wave)).toHaveLength(DRAFT_SIZE);
    }
  });
  it('as tres cartas nunca repetem tipo', () => {
    for (let i = 0; i < 200; i++) {
      const ids = draftOffers([], 5).map(d => d.id);
      expect(new Set(ids).size).toBe(DRAFT_SIZE);
    }
  });
  it('rancho incompleto: so oferece tipos que o jogador NAO tem', () => {
    const inv = five().slice(0, 3);
    const owned = new Set(inv.map(d => d.id));
    for (let i = 0; i < 200; i++) {
      for (const o of draftOffers(inv, 7)) expect(owned.has(o.id)).toBe(false);
    }
  });
  it('rancho cheio: a oferta vira copia de quem ele ja tem', () => {
    const inv = five();
    const owned = new Set(inv.map(d => d.id));
    expect(squadFull(inv)).toBe(true);
    for (let i = 0; i < 200; i++) {
      const offers = draftOffers(inv, 12);
      expect(offers).toHaveLength(DRAFT_SIZE);
      for (const o of offers) expect(owned.has(o.id)).toBe(true);
    }
  });
  it('empilhar copia nao aumenta a contagem de tipos', () => {
    const inv = five();
    inv.push({ ...inv[0] }, { ...inv[0] }, { ...inv[3] });
    expect(distinctIds(inv)).toHaveLength(SQUAD_TYPES);
    expect(countById(inv)[inv[0].id]).toBe(3);
    expect(uniqueOwned(inv)).toHaveLength(SQUAD_TYPES);
  });
  it('as cartas sao clones — treinar uma nao contamina dudes.json', () => {
    const base = ALL[0].stats.atk;
    const card = draftOffers([], 1)[0];
    card.stats.atk = 9999;
    expect(byId(ALL[0].id).stats.atk).toBe(base);
  });
});

describe('RunState / eventos', () => {
  it('as duas primeiras rodadas sao secas', () => {
    expect(eventFor(1)).toBeNull();
    expect(eventFor(2)).toBeNull();
  });
  it('treinador a cada 4 waves e ganha o empate do lanche', () => {
    expect(eventFor(4)).toBe('trainer');
    expect(eventFor(8)).toBe('trainer');
    expect(eventFor(12)).toBe('trainer');
    expect(eventFor(24)).toBe('trainer');
  });
  it('lanche nos multiplos de 3 que nao sao do treinador', () => {
    expect(eventFor(3)).toBe('snack');
    expect(eventFor(9)).toBe('snack');
    expect(eventFor(15)).toBe('snack');
  });
  it('rodada seca existe', () => {
    expect(eventFor(5)).toBeNull();
    expect(eventFor(7)).toBeNull();
  });
});

describe('RunState / treino', () => {
  it('sobe um nivel por visita e respeita o teto', () => {
    let t = {};
    for (let i = 1; i <= TRAIN_MAX + 3; i++) t = train(t, HERO_ID);
    expect(trainLevel(t, HERO_ID)).toBe(TRAIN_MAX);
    expect(canTrain(t, HERO_ID)).toBe(false);
  });
  it('SO o cara treina — mercenario nenhum sobe de nivel', () => {
    expect(canTrain({}, HERO_ID)).toBe(true);
    for (const id of ['wizard', 'knight', 'dragon', 'ceo']) {
      expect(canTrain({}, id)).toBe(false);
      // e a porta e o `train`, nao a tela: nem forcando o mapa sobe
      expect(train({}, id)).toEqual({});
      expect(trainLevel(train({}, id), id)).toBe(0);
    }
  });
  it('treino vale so para o tipo treinado', () => {
    const t = train({}, HERO_ID);
    expect(trainLevel(t, HERO_ID)).toBe(1);
    expect(trainLevel(t, 'knight')).toBe(0);
  });
  it('nao muta o mapa anterior', () => {
    const a = {};
    const b = train(a, HERO_ID);
    expect(a).toEqual({});
    expect(b).not.toBe(a);
  });
});

describe('RunState / o cara', () => {
  it('a run nasce com um cara, e so com ele', () => {
    const inv = startingInventory();
    expect(inv).toHaveLength(1);
    expect(inv[0].id).toBe(HERO_ID);
    // copia, nao a referencia dos dados: a run nao pode editar dudes.json
    expect(inv[0]).not.toBe(heroDude());
    expect(inv[0].stats).toEqual(heroDude().stats);
  });
  it('o presente cai de dez em dez rodadas', () => {
    for (const w of [10, 20, 30, 100]) expect(heroGrantAt(w)).toBe(true);
    for (const w of [0, 1, 5, 9, 11, 19, 99]) expect(heroGrantAt(w)).toBe(false);
  });
  it('grantHero soma um corpo e respeita o teto do exercito', () => {
    const inv = startingInventory();
    expect(grantHero(inv)).toBe(1);
    expect(inv).toHaveLength(2);
    expect(countById(inv)[HERO_ID]).toBe(2);

    const cheio = Array.from({ length: MAX_ARMY }, () => cloneDude(heroDude()));
    expect(grantHero(cheio)).toBe(0);
    expect(cheio).toHaveLength(MAX_ARMY);
  });
  it('cada corpo do cara tem a sua propria ficha de stats', () => {
    const inv = startingInventory();
    grantHero(inv);
    inv[0].stats.hp = 999;
    expect(inv[1].stats.hp).toBe(heroDude().stats.hp);
  });
  it('o treino sobe TODOS os corpos do cara de uma vez', () => {
    const inv = startingInventory();
    grantHero(inv);
    const t = train({}, HERO_ID);
    const hp = inv.map(d => battleStats(d, t, null).stats.hp);
    const esperado = Math.round(heroDude().stats.hp * (1 + TRAIN_HP));
    expect(hp).toEqual([esperado, esperado]);
  });
});

describe('RunState / stats de batalha', () => {
  const d = byId(ALL[0].id);
  it('sem treino e sem lanche devolve o proprio objeto', () => {
    expect(battleStats(d, {}, null)).toBe(d);
  });
  it('treino soma hp e atk', () => {
    const s = battleStats(d, { [d.id]: 2 }, null).stats;
    expect(s.hp).toBe(Math.round(d.stats.hp * (1 + TRAIN_HP * 2)));
    expect(s.atk).toBe(Math.round(d.stats.atk * (1 + TRAIN_ATK * 2)));
  });
  it('lanche de vida nao mexe no ataque', () => {
    const s = battleStats(d, {}, 'burger').stats;
    expect(s.hp).toBeGreaterThan(d.stats.hp);
    expect(s.atk).toBe(d.stats.atk);
  });
  it('lanche de velocidade mexe em attackSpeed/moveSpeed', () => {
    expect(battleStats(d, {}, 'energy').stats.attackSpeed).toBeGreaterThan(d.stats.attackSpeed);
    expect(battleStats(d, {}, 'coffee').stats.moveSpeed).toBeGreaterThan(d.stats.moveSpeed);
  });
  it('treino e lanche empilham sem alterar a base', () => {
    const s = battleStats(d, { [d.id]: 1 }, 'banana').stats;
    expect(s.atk).toBe(Math.round(d.stats.atk * (1 + TRAIN_ATK + 0.1)));
    expect(byId(ALL[0].id).stats.atk).toBe(d.stats.atk);
  });
  it('lanche inexistente e ignorado', () => {
    expect(battleStats(d, {}, 'nada-disso')).toBe(d);
    expect(snackById(null)).toBeUndefined();
  });
});

describe('RunState / lanches', () => {
  it('tres lanches distintos por rodada', () => {
    for (let i = 0; i < 100; i++) {
      const offers = snackOffers();
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map(s => s.id)).size).toBe(3);
    }
  });
  it('todo lanche tem pelo menos um efeito', () => {
    for (const s of snackOffers(6)) {
      const total = (s.hp ?? 0) + (s.atk ?? 0) + (s.attackSpeed ?? 0) + (s.moveSpeed ?? 0);
      expect(total).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(0);
    }
  });
});

/**
 * F5 NAO E REROLL. A oferta e salva por id e reconstruida na volta: sem isto
 * recarregar a pagina sortearia tres cartas novas de graca.
 */
describe('RunState / offersFromIds', () => {  it('reconstroi a oferta na mesma ordem', () => {
    const ids = ALL.slice(0, DRAFT_SIZE).map(d => d.id);
    expect(offersFromIds(ids).map(d => d.id)).toEqual(ids);
  });
  it('devolve copias, nunca o objeto do json', () => {
    const d = ALL[0];
    const [copy] = offersFromIds([d.id]);
    copy.stats.atk = 9999;
    expect(byId(d.id).stats.atk).not.toBe(9999);
  });
  it('ignora id que nao existe', () => {
    expect(offersFromIds(['nao-existe', ALL[1].id]).map(d => d.id)).toEqual([ALL[1].id]);
    expect(offersFromIds([])).toEqual([]);
  });
});

/**
 * O PACOTE. Uma copia por rodada nao acompanha uma horda que ganha seis bichos
 * por rodada: a run travava na wave 6. Fechado o rancho, a carta passa a valer
 * um pacote que cresce com a wave — e o exercito volta a caber no jogo.
 */
describe('RunState / pacote de copias', () => {
  it('rancho incompleto: a carta vale UM cara, sempre', () => {
    const inv = five().slice(0, 3);
    for (const wave of [1, 4, 12, 40, 90]) expect(copiesFor(inv, wave)).toBe(1);
  });
  it('rancho fechado: o pacote cresce com a wave e para no teto', () => {
    const inv = five();
    expect(copiesFor(inv, 5)).toBe(2);
    expect(copiesFor(inv, 8)).toBe(3);
    expect(copiesFor(inv, 12)).toBe(4);
    expect(copiesFor(inv, 24)).toBe(PACK_MAX);
    expect(copiesFor(inv, 99)).toBe(PACK_MAX);
    expect(packSize(1)).toBe(1);
  });
  it('nunca passa do limite de corpos do campo', () => {
    const inv = five();
    while (inv.length < MAX_ARMY - 2) inv.push({ ...inv[0] });
    expect(copiesFor(inv, 40)).toBe(2);
    addPack(inv, inv[0], 40);
    expect(inv).toHaveLength(MAX_ARMY);
    expect(copiesFor(inv, 40)).toBe(0);
  });
  it('addPack empilha o pacote e devolve quantos entraram', () => {
    const inv = five();
    const got = addPack(inv, inv[2], 12);
    expect(got).toBe(4);
    expect(inv).toHaveLength(SQUAD_TYPES + 4);
    expect(countById(inv)[inv[2].id]).toBe(5);
    expect(distinctIds(inv)).toHaveLength(SQUAD_TYPES);
  });
  it('as copias do pacote sao clones — treinar uma nao mexe nas outras', () => {
    const inv = five();
    addPack(inv, inv[0], 8);
    const stack = inv.filter(d => d.id === inv[0].id);
    stack[1].stats.atk = 9999;
    expect(stack[2].stats.atk).not.toBe(9999);
    expect(byId(ALL[0].id).stats.atk).not.toBe(9999);
  });
  it('o exercito acompanha a horda: wave 12 passa de vinte caras', () => {
    const inv: DudeData[] = [];
    for (let wave = 1; wave <= 12; wave++) {
      const pick = draftOffers(inv, wave)[0];
      addPack(inv, pick, wave);
    }
    expect(inv.length).toBeGreaterThan(20);
    expect(distinctIds(inv)).toHaveLength(SQUAD_TYPES);
  });
});

describe('RunState / preco da copia', () => {
  it('o preco sobe com o tamanho do exercito', () => {
    expect(copyPrice(five())).toBe(9);
    expect(copyPrice(new Array(40).fill(ALL[0]))).toBe(18);
    expect(copyPrice(new Array(160).fill(ALL[0]))).toBe(48);
  });
  it('nao vende nada com o rancho aberto — a carta ainda e de graca', () => {
    const inv = five().slice(0, 4);
    expect(canBuyCopy(inv, 999)).toBe(false);
  });
  it('vende com rancho fechado, ouro suficiente e campo com espaco', () => {
    const inv = five();
    expect(canBuyCopy(inv, copyPrice(inv))).toBe(true);
    expect(canBuyCopy(inv, copyPrice(inv) - 1)).toBe(false);
  });
  it('campo lotado fecha o balcao mesmo com o cofre cheio', () => {
    const inv = five();
    while (inv.length < MAX_ARMY) inv.push({ ...inv[0] });
    expect(canBuyCopy(inv, 9999)).toBe(false);
  });
  it('a renda da wave paga ~1 corpo no comeco e menos de um no fim', () => {
    // +12 de ouro por wave e a renda base (WaveManager.rewardGold na faixa media)
    expect(12 / copyPrice(five())).toBeGreaterThan(1);
    expect(12 / copyPrice(new Array(120).fill(ALL[0]))).toBeLessThan(1);
  });
});
