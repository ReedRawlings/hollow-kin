import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { breed, calculateOffspringStar, calculateOffspringStats } from '../systems/BreedingSystem';
import { CreatureInstance } from '../types';

export class BreedingScene extends Phaser.Scene {
  private parentA: CreatureInstance | null = null;
  private parentB: CreatureInstance | null = null;

  constructor() {
    super({ key: 'BreedingScene' });
  }

  create(): void {
    this.parentA = null;
    this.parentB = null;
    this.drawUI();
  }

  private drawUI(): void {
    this.children.removeAll();
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 30, 'BREEDING', {
      fontSize: '28px', color: '#aa44aa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Parent slots
    this.drawParentSlot(200, 100, 'Parent A', this.parentA, 'A');
    this.drawParentSlot(700, 100, 'Parent B', this.parentB, 'B');

    // Preview
    if (this.parentA && this.parentB) {
      this.drawPreview(cx, 100);
    }

    // Available creatures
    this.add.text(cx, 290, 'Select Creatures to Breed:', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const available = gameState.creatureBox.filter(c =>
      !c.isRetired &&
      c.instanceId !== this.parentA?.instanceId &&
      c.instanceId !== this.parentB?.instanceId
    );

    available.forEach((creature, i) => {
      const template = getTemplate(creature.speciesId);
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 140 + col * 210;
      const y = 340 + row * 90;

      const bg = this.add.rectangle(x, y, 190, 70, 0x332244, 0.9)
        .setStrokeStyle(1, 0x664488).setInteractive({ useHandCursor: true });

      this.add.rectangle(x - 70, y, 30, 30, template.spriteColor);
      this.add.text(x - 45, y - 18, `${template.name} ★${creature.starRating}`, {
        fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
      });
      this.add.text(x - 45, y, `${template.archetype} | L:${creature.longevity}`, {
        fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
      });
      if (creature.isBreedReady) {
        this.add.text(x - 45, y + 14, 'BREED READY', {
          fontSize: '9px', color: '#ff88cc', fontFamily: 'monospace',
        });
      }

      bg.on('pointerover', () => bg.setFillStyle(0x443366));
      bg.on('pointerout', () => bg.setFillStyle(0x332244));
      bg.on('pointerdown', () => {
        if (!this.parentA) {
          this.parentA = creature;
        } else if (!this.parentB) {
          this.parentB = creature;
        } else {
          // Replace parent B
          this.parentB = creature;
        }
        this.drawUI();
      });
    });

    // Breed button
    if (this.parentA && this.parentB) {
      const breedBtn = this.add.rectangle(cx, 560, 200, 50, 0x662266, 0.9)
        .setStrokeStyle(2, 0xaa44aa).setInteractive({ useHandCursor: true });
      this.add.text(cx, 560, 'BREED!', {
        fontSize: '18px', color: '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5);

      breedBtn.on('pointerover', () => breedBtn.setFillStyle(0x884488));
      breedBtn.on('pointerout', () => breedBtn.setFillStyle(0x662266));
      breedBtn.on('pointerdown', () => this.performBreed());
    }

    // Back button
    this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('TownScene');
    });
  }

  private drawParentSlot(x: number, y: number, label: string, creature: CreatureInstance | null, slot: 'A' | 'B'): void {
    this.add.rectangle(x, y + 60, 200, 140, 0x222233, 0.9).setStrokeStyle(2, 0x444466);
    this.add.text(x, y, label, {
      fontSize: '14px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (creature) {
      const template = getTemplate(creature.speciesId);
      this.add.rectangle(x, y + 40, 40, 40, template.spriteColor);
      this.add.text(x, y + 75, `${template.name}`, {
        fontSize: '13px', color: '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.add.text(x, y + 95, `★${creature.starRating} | ${template.archetype}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.add.text(x, y + 112, creature.isBreedReady ? 'BREED READY' : 'Not breed-ready', {
        fontSize: '10px', color: creature.isBreedReady ? '#ff88cc' : '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5);

      // Clear button
      const clearBtn = this.add.text(x + 85, y + 5, 'X', {
        fontSize: '12px', color: '#ff4444', fontFamily: 'monospace',
      }).setInteractive({ useHandCursor: true });
      clearBtn.on('pointerdown', () => {
        if (slot === 'A') this.parentA = null;
        else this.parentB = null;
        this.drawUI();
      });
    } else {
      this.add.text(x, y + 60, 'Empty\n(click a creature)', {
        fontSize: '12px', color: '#666666', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5);
    }
  }

  private drawPreview(x: number, y: number): void {
    if (!this.parentA || !this.parentB) return;

    const star = calculateOffspringStar(this.parentA, this.parentB);
    const offspringSpecies = this.parentA.speciesId; // Offspring takes parent A species for now

    this.add.text(x, y + 30, '→ Offspring Preview ←', {
      fontSize: '14px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const template = getTemplate(offspringSpecies);
    this.add.text(x, y + 55, `${template.name} ★${star}`, {
      fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const stats = calculateOffspringStats(this.parentA, this.parentB, offspringSpecies);
    this.add.text(x, y + 80, `HP:${stats.hp} STR:${stats.str} DEF:${stats.def} INT:${stats.int} SPD:${stats.spd}`, {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Show breed-ready bonus info
    if (this.parentA.isBreedReady && this.parentB.isBreedReady &&
        this.parentA.starRating === this.parentB.starRating) {
      this.add.text(x, y + 100, 'Both breed-ready + same star = +1 star bonus!', {
        fontSize: '10px', color: '#44ff44', fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    this.add.text(x, y + 120, '⚠ Both parents will be retired', {
      fontSize: '10px', color: '#ff6644', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  private performBreed(): void {
    if (!this.parentA || !this.parentB) return;

    const offspringSpecies = this.parentA.speciesId;
    const template = getTemplate(offspringSpecies);

    // Combine parent abilities for inheritance
    const parentAbilities = [
      ...this.parentA.abilities.filter((a): a is string => a !== null),
      ...this.parentB.abilities.filter((a): a is string => a !== null),
    ];
    const uniqueAbilities = [...new Set(parentAbilities)];
    const chosenAbilities = uniqueAbilities.slice(0, 4);

    const offspring = breed(this.parentA, this.parentB, offspringSpecies, chosenAbilities);

    // Remove parents from box (they're now retired)
    gameState.removeFromBox(this.parentA.instanceId);
    gameState.removeFromBox(this.parentB.instanceId);

    // Add offspring to box
    gameState.addToBox(offspring);
    gameState.saveToLocalStorage();

    // Show result
    this.children.removeAll();
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.add.text(cx, cy - 60, 'New Creature Born!', {
      fontSize: '28px', color: '#ff88cc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.rectangle(cx, cy, 50, 50, template.spriteColor);

    this.add.text(cx, cy + 50, `${template.name} ★${offspring.starRating}`, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 80, `Level Cap: ${offspring.levelCap} | Longevity: ${offspring.longevity}`, {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 110, `Abilities: ${chosenAbilities.join(', ')}`, {
      fontSize: '11px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 160, 'Click to continue', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('TownScene');
    });
  }
}
