import Phaser from 'phaser';
export class Reward extends Phaser.Scene {
  constructor(){ super('Reward'); }
  create(){ this.add.text(960,540,'Reward',{fontSize:'32px', color:'#fff'}).setOrigin(0.5); }
}
