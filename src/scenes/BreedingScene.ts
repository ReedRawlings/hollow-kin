import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { breed, calculateOffspringStar, calculateOffspringStats, carryoverForParents, breedingAvailability } from '../systems/BreedingSystem';
import { CreatureInstance, STAR_LEVEL_CAPS } from '../types';
import { isCreatureBreedReady } from '../systems/Traits';

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
      this.add.text(x - 45, y, `${template.archetype} | Lv ${creature.permanentLevel}`, {
        fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
      });
      if (isCreatureBreedReady(creature)) {
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
    this.add.text(24, 20, '← TOWN', {
      fontSize: '12px', color: '#f7f3b7', fontFamily: 'monospace',
      backgroundColor: '#2c1e31', padding: { x: 10, y: 7 },
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
      this.add.text(x, y + 112, isCreatureBreedReady(creature) ? 'BREED READY' : 'Not breed-ready', {
        fontSize: '10px', color: isCreatureBreedReady(creature) ? '#ff88cc' : '#666666', fontFamily: 'monospace',
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
    if (isCreatureBreedReady(this.parentA) && isCreatureBreedReady(this.parentB) &&
        this.parentA.starRating === this.parentB.starRating) {
      this.add.text(x, y + 100, 'Both breed-ready + same star = +1 star bonus!', {
        fontSize: '10px', color: '#44ff44', fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    this.add.text(x, y + 120, '⚠ Both parents will be retired', {
      fontSize: '10px', color: '#ff6644', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const levelCap = STAR_LEVEL_CAPS[star] ?? 5;
    const carry = carryoverForParents(this.parentA, this.parentB, levelCap);
    this.add.text(x, y + 140, `Starts at Lv ${carry.level} (carried from parents)`, {
      fontSize: '10px', color: '#88ccaa', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  private performBreed(): void {
    if (!this.parentA || !this.parentB) return;
    // Domain gate as well as the town tile: breeding is net -1, and dropping the box
    // below a fieldable party has no recovery path while capture is unwired.
    if (breedingAvailability(gameState.creatureBox).kind !== 'available') return;

    const offspringSpecies = this.parentA.speciesId;
    const template = getTemplate(offspringSpecies);

    // Combine parent abilities for inheritance
    const parentAbilities = [
      ...this.parentA.abilities.filter((a): a is string => a !== null),
      ...this.parentB.abilities.filter((a): a is string => a !== null),
    ];
    const uniqueAbilities = [...new Set(parentAbilities)];
    const chosenAbilities = uniqueAbilities.slice(0, 4);

    // NOTE: no traitChoices passed here. Per spec §5 case 1, a slot where BOTH parents
    // hold a trait is supposed to be the PLAYER's choice — but that choice UI belongs to
    // the not-yet-built Trait-keeper task and doesn't exist yet. Until it lands, every
    // contested slot silently ships as "parent A wins" (resolveInheritedTraitSlots'
    // default), and parent B's trait there is destroyed along with the retired parent.
    // Do not mistake this for finished; see Traits.ts' contestedSlotIndices(), which the
    // future UI will use to know what to prompt about.
    const offspring = breed(this.parentA, this.parentB, offspringSpecies, chosenAbilities);

    // Parents stay in the box as tombstones (isRetired = true, set by breed()) rather
    // than being removed — resolvePartyStatus() needs them there to name a stale party
    // member instead of falling back to 'a former party member'.

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

    this.add.text(cx, cy + 80, `Level Cap: ${offspring.levelCap}`, {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 100, `Starts at Lv ${offspring.permanentLevel} (carried from parents)`, {
      fontSize: '12px', color: '#88ccaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 120, `Abilities: ${chosenAbilities.join(', ')}`, {
      fontSize: '11px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 160, 'Click to continue', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('TownScene');
    });
  }
}
