export interface DudeData {
  id: string;
  name: string;
  family: 'Warrior'|'Undead'|'Employed'|'Fantasy'|'SciFi'|'Action';
  role: 'Tank'|'DPS'|'Support';
  stats: { hp: number; atk: number; range: number; attackSpeed: number; moveSpeed: number };
  ability: { type: string; value: number };
  cost: number;
  sprite: string;
  rarity: 'common'|'rare';
}
