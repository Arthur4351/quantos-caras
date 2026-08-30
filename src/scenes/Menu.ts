import Phaser from 'phaser';
export class Menu extends Phaser.Scene {
  constructor(){ super('Menu'); }
  create(){ this.add.text(960,540,'Menu',{fontSize:'32px', color:'#fff'}).setOrigin(0.5); }
}
