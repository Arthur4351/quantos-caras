/**
 * UMA RELIQUIA, EM DOIS ANDARES.
 *
 * ANDAR DE BAIXO (`family` ausente): serve o RANCHO INTEIRO. Este andar tem que
 * funcionar para qualquer time que o jogador tenha montado, entao ele nao pode
 * supor familia nenhuma — e por isso que ali moram os numeros gerais (espada,
 * escudo, ampulheta). Nao e preguica de design: e a unica coisa honesta que se
 * pode oferecer sem saber quem esta no rancho.
 *
 * ANDAR DE CIMA (`family` preenchida): serve UMA familia e ninguem mais. Como ela
 * sabe exatamente quem vai receber, ela pode fazer algo especifico em vez de somar
 * porcentagem — a corneta abre a briga com os guerreiros invulneraveis, o grimorio
 * acelera o RELOGIO dos tracos de fantasia, o holofote paga o ultimo cara de acao
 * que sobrou de pe. Cada uma tem um verbo que nenhuma outra tem.
 *
 * A loja NUNCA oferece uma reliquia de classe de uma familia que o jogador nao
 * tem (ver `RelicShop.draft`): uma carta que nao faz nada gasta a decisao do
 * jogador, que e a coisa mais cara que ele tem.
 */
export interface RelicData {
  id: string;
  name: string;
  description: string;
  type: 'active'|'passive';
  /**
   * Chave de familia do `families.json` ('Warrior', 'Undead', ...). Ausente =
   * vale para todo o rancho. Fica em ingles pelo mesmo motivo que `DudeData.family`:
   * e CHAVE (paleta, sinergia, conquistas leem daqui) e se traduz so na hora de
   * mostrar, com `famLabel`.
   */
  family?: string;
  effect: { target: string; value: number };
}
