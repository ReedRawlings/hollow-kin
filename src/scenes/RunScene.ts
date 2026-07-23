import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { generateZoneEncounters, generatePickNextChoices } from '../systems/RunGenerator';
import { Encounter, RunState } from '../types';

export class RunScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RunScene' });
  }

  init(data?: { continueRun?: boolean }): void {
    if (!data?.continueRun || !gameState.currentRun) {
      // Start a new run
      gameState.startRun();
      const zone1 = generateZoneEncounters(1);
      gameState.currentRun = {
        currentZone: 1,
        currentEncounterIndex: -1,
        encounters: zone1,
        choices: [],
        plasm: 0,
        capturedCreatures: [],
        partyHp: {},
        partyMp: {},
        partyKO: {},
        xpEarned: 0,
      };
      // Initialize party HP/MP
      for (const c of gameState.runParty) {
        gameState.currentRun.partyHp[c.instanceId] = c.currentStats.hp;
        gameState.currentRun.partyMp[c.instanceId] = c.currentStats.mp;
        gameState.currentRun.partyKO[c.instanceId] = false;
      }
    }
  }

  create(): void {
    this.drawUI();
  }

  private drawUI(): void {
    this.children.removeAll();
    const cx = this.cameras.main.centerX;
    const run = gameState.currentRun!;

    // Header
    this.add.text(cx, 20, `ZONE ${run.currentZone} — Encounter ${run.currentEncounterIndex + 2}/15`, {
      fontSize: '20px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 45, `Plasm: ${run.plasm}`, {
      fontSize: '14px', color: '#88ccff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Party status
    gameState.runParty.forEach((creature, i) => {
      const template = getTemplate(creature.speciesId);
      const x = 100 + i * 280;
      const y = 90;
      const hp = run.partyHp[creature.instanceId] ?? 0;
      const mp = run.partyMp[creature.instanceId] ?? 0;
      const ko = run.partyKO[creature.instanceId];

      this.add.rectangle(x, y + 15, 35, 35, ko ? 0x333333 : template.spriteColor);
      this.add.text(x + 25, y, `${template.name} Lv${creature.currentLevel}`, {
        fontSize: '12px', color: ko ? '#666666' : '#ffffff', fontFamily: 'monospace',
      });

      // HP bar
      const hpPct = hp / creature.currentStats.hp;
      const hpColor = hpPct > 0.5 ? 0x44aa44 : hpPct > 0.25 ? 0xaaaa44 : 0xaa4444;
      this.add.rectangle(x + 25, y + 18, 80, 8, 0x333333).setOrigin(0);
      this.add.rectangle(x + 25, y + 18, 80 * hpPct, 8, hpColor).setOrigin(0);
      this.add.text(x + 25, y + 28, `HP:${hp}/${creature.currentStats.hp} MP:${mp}/${creature.currentStats.mp}`, {
        fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
      });
    });

    // Check if all KO'd
    const allKO = gameState.runParty.every(c => run.partyKO[c.instanceId]);
    if (allKO) {
      this.showRunEnd(false);
      return;
    }

    // Generate pick-next choices
    const choices = generatePickNextChoices(run.encounters, run.currentEncounterIndex);

    if (choices.length === 0) {
      // Zone complete — check if more zones
      if (run.currentZone < 3) {
        this.add.text(cx, 300, `Zone ${run.currentZone} Complete!`, {
          fontSize: '24px', color: '#ffdd88', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.createButton(cx, 380, 'NEXT ZONE', '#4488aa', () => {
          run.currentZone++;
          run.encounters = generateZoneEncounters(run.currentZone);
          run.currentEncounterIndex = -1;
          this.drawUI();
        });
      } else {
        this.showRunEnd(true);
      }
      return;
    }

    // Show choices
    this.add.text(cx, 200, 'Choose your next encounter:', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    choices.forEach((encounter, i) => {
      const x = cx - (choices.length - 1) * 130 / 2 + i * 200;
      const y = 300;
      const label = this.getEncounterLabel(encounter);
      const color = this.getEncounterColor(encounter);

      this.createButton(x, y, label, color, () => {
        this.selectEncounter(encounter);
      });
    });

    // Flee button
    this.createButton(cx, 500, 'FLEE TOWER', '#aa4444', () => {
      this.showRunEnd(false);
    });
  }

  private selectEncounter(encounter: Encounter): void {
    const run = gameState.currentRun!;
    run.currentEncounterIndex = encounter.index;

    switch (encounter.type) {
      case 'combat':
      case 'boss':
        this.scene.start('CombatScene', { encounter });
        break;
      case 'shop':
        this.scene.start('ShopScene', { encounter });
        break;
      case 'rest':
        this.scene.start('RestScene', { encounter });
        break;
      case 'event':
        // Simple event: random bonus
        run.plasm += 15;
        run.xpEarned += 10;
        for (const c of gameState.runParty) {
          if (!run.partyKO[c.instanceId]) {
            c.xp += 10;
            gameState.tryLevelUp(c);
            run.partyHp[c.instanceId] = Math.min(
              run.partyHp[c.instanceId] + Math.floor(c.currentStats.hp * 0.1),
              c.currentStats.hp,
            );
          }
        }
        this.drawUI();
        break;
    }
  }

  private showRunEnd(success: boolean): void {
    this.children.removeAll();
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.add.text(cx, cy - 80, success ? 'TOWER CLEARED!' : 'RUN OVER', {
      fontSize: '32px', color: success ? '#ffdd88' : '#ff6644', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const run = gameState.currentRun!;
    this.add.text(cx, cy - 20, [
      `Zones Cleared: ${run.currentZone}`,
      `Plasm Earned: ${run.plasm}`,
      `Creatures Captured: ${run.capturedCreatures.length}`,
    ].join('\n'), {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);

    this.createButton(cx, cy + 80, 'RETURN TO TOWN', '#4488aa', () => {
      gameState.endRun(success);
      gameState.saveToLocalStorage();
      this.scene.start('TownScene');
    });
  }

  private getEncounterLabel(e: Encounter): string {
    switch (e.type) {
      case 'combat': return `COMBAT (${e.enemies?.length ?? '?'})`;
      case 'boss': return 'ZONE BOSS';
      case 'shop': return 'SHOP';
      case 'rest': return 'REST';
      case 'event': return 'EVENT';
    }
  }

  private getEncounterColor(e: Encounter): string {
    switch (e.type) {
      case 'combat': return '#aa4444';
      case 'boss': return '#cc6600';
      case 'shop': return '#4488aa';
      case 'rest': return '#44aa44';
      case 'event': return '#aa44aa';
    }
  }

  private createButton(x: number, y: number, text: string, color: string, callback: () => void): void {
    const bg = this.add.rectangle(x, y, 170, 50, Phaser.Display.Color.HexStringToColor(color).color, 0.8)
      .setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });
    this.add.text(x, y, text, {
      fontSize: '13px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setAlpha(1));
    bg.on('pointerout', () => bg.setAlpha(0.8));
    bg.on('pointerdown', callback);
  }
}
