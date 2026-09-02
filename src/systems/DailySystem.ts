import { DudeData } from '../types/DudeData';
import dudes from '../data/dudes.json';

/** Uma tentativa do diario, guardada no `daily_board` local. */
export interface DailyRecord {
  date: string;
  wave: number;
  victory: boolean;
}

export class DailySystem {
  getSeed(dateStr = new Date().toISOString().slice(0, 10)): string {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    return Math.abs(hash).toString(36);
  }

  /**
   * OS CINCO CARAS DO DIA — CINCO TIPOS DIFERENTES.
   *
   * Sorteava COM reposicao (`pool[idx]` sem tirar da sacola), entao o "pool de cinco
   * caras" do dia podia ser tres cavaleiros e dois zumbis. O rancho deste jogo cabe
   * cinco TIPOS distintos: um pool com repetido nao entrega cinco tipos, entrega dois
   * e tres cartas mortas. `splice` tira o escolhido da sacola.
   */
  getDailyDudes(allDudes: DudeData[] = dudes as DudeData[], seedStr?: string): DudeData[] {
    const seed = seedStr ?? this.getSeed();
    // seeded random: simple xorshift
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    const rand = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    const pool = [...allDudes];
    const picked: DudeData[] = [];
    while (picked.length < 5 && pool.length) {
      picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    }
    return picked;
  }

  isDailyAvailable(lastPlayed: string | null, today = new Date().toISOString().slice(0, 10)): boolean {
    return lastPlayed !== today;
  }

  /**
   * O PLACAR LOCAL — antes era uma promessa vazia.
   *
   * `daily_board` era LIDO pela tela do diario e nunca escrito por ninguem: a tela
   * dizia "NENHUM RECORDE AINDA · SEJA O PRIMEIRO" para sempre, jogasse o jogador
   * um diario ou cinquenta. Agora o fim de run grava a tentativa (ver
   * `GameOver.recordDaily`) e este metodo mantem a lista: melhor wave primeiro,
   * uma entrada por dia (a melhor do dia), teto de `cap` linhas.
   */
  recordRun(board: DailyRecord[] | null, entry: DailyRecord, cap = 12): DailyRecord[] {
    const out = [...(board ?? [])].filter(r => r && typeof r.wave === 'number');
    const same = out.findIndex(r => r.date === entry.date);
    if (same >= 0) {
      const best = out[same];
      if (entry.wave > best.wave || (entry.victory && !best.victory)) out[same] = entry;
    } else {
      out.push(entry);
    }
    return out
      .sort((a, b) => (b.victory ? 1 : 0) - (a.victory ? 1 : 0) || b.wave - a.wave || b.date.localeCompare(a.date))
      .slice(0, cap);
  }
}
