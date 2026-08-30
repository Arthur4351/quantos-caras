export interface RelicData {
  id: string;
  name: string;
  description: string;
  type: 'active'|'passive';
  effect: { target: string; value: number };
}
