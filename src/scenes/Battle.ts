import Phaser from 'phaser';
export class Battle extends Phaser.Scene {
  constructor(){ super('Battle'); }
  create(){ this.add.text(960,540,'Battle',{fontSize:'32px', color:'#fff'}).setOrigin(0.5); }
}
