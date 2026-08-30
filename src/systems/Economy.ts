export class Economy {
  gold: number;
  constructor(initial = 6) {
    this.gold = initial;
  }
  add(n: number): void {
    this.gold = Math.max(0, this.gold + n);
  }
  spend(cost: number): boolean {
    if (this.gold < cost) return false;
    this.gold -= cost;
    return true;
  }
}
