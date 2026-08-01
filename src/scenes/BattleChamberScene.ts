import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { createBackpack } from '../systems/Backpack';
import {
  BATTLE_CHAMBER_PRESETS, BattleChamberResourceModel, BattleChamberResult,
  SHARED_TEMPO_LOADOUTS,
} from '../systems/BattleChamber';
import { Encounter, RunState } from '../types';
import {
  BODY_FONT, DISPLAY_FONT, UI, button, footer, header, panel, screenFrame,
} from '../ui/Theme';

interface BattleChamberSceneData {
  selectedPresetId?: string;
  result?: BattleChamberResult;
  resourceModel?: BattleChamberResourceModel;
}

export class BattleChamberScene extends Phaser.Scene {
  private selected = 0;
  private lastResult: BattleChamberResult | null = null;
  private resourceModel: BattleChamberResourceModel = 'individual_mp';
  private keyboardBound = false;

  constructor() {
    super({ key: 'BattleChamberScene' });
  }

  init(data?: BattleChamberSceneData): void {
    const selectedId = data?.selectedPresetId ?? BATTLE_CHAMBER_PRESETS[0].id;
    const index = BATTLE_CHAMBER_PRESETS.findIndex(preset => preset.id === selectedId);
    this.selected = index < 0 ? 0 : index;
    this.lastResult = data?.result ?? null;
    this.resourceModel = data?.resourceModel
      ?? data?.result?.resourceModel
      ?? 'individual_mp';
  }

  create(): void {
    if (!this.keyboardBound) {
      this.keyboardBound = true;
      this.input.keyboard?.on('keydown-LEFT', () => this.shift(-1));
      this.input.keyboard?.on('keydown-RIGHT', () => this.shift(1));
      this.input.keyboard?.on('keydown-ENTER', () => this.launch(false));
      this.input.keyboard?.on('keydown-A', () => this.launch(true));
      this.input.keyboard?.on('keydown-M', () => this.toggleResourceModel());
    }
    this.draw();
  }

  chamberState(): object {
    const selected = BATTLE_CHAMBER_PRESETS[this.selected];
    return {
      selectedPreset: selected.id,
      seed: selected.seed,
      resourceModel: this.resourceModel,
      presets: BATTLE_CHAMBER_PRESETS.map(preset => ({
        id: preset.id,
        name: preset.name,
        enemies: preset.enemyIds.map(id => getTemplate(id).name),
      })),
      lastResult: this.lastResult,
      controls: { previous: 'left', next: 'right', model: 'm', manual: 'enter', auto: 'a' },
    };
  }

  private shift(delta: number): void {
    this.selected = (this.selected + delta + BATTLE_CHAMBER_PRESETS.length)
      % BATTLE_CHAMBER_PRESETS.length;
    this.lastResult = null;
    this.draw();
  }

  private setResourceModel(model: BattleChamberResourceModel): void {
    this.resourceModel = model;
    this.lastResult = null;
    this.draw();
  }

  private toggleResourceModel(): void {
    this.setResourceModel(this.resourceModel === 'individual_mp' ? 'shared_tempo' : 'individual_mp');
  }

  private draw(): void {
    this.children.removeAll(true);
    screenFrame(this);
    header(this, 'BATTLE CHAMBER', 'REPEATABLE COMBAT LAB — NO REWARDS OR SAVE PROGRESSION',
      'DEV TOOL', UI.tealCss);

    const cardW = 278;
    const xs = [176, 480, 784];
    BATTLE_CHAMBER_PRESETS.forEach((preset, index) => {
      const selected = index === this.selected;
      const x = xs[index];
      const card = panel(this, x, 250, cardW, 310, selected);
      if (selected) this.add.rectangle(x, 103, cardW - 6, 6, UI.gold);
      this.add.text(x, 126, preset.name, {
        fontFamily: DISPLAY_FONT, fontSize: '11px', color: selected ? UI.hi : UI.text,
      }).setOrigin(0.5);
      this.add.text(x, 157, preset.purpose, {
        fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
        align: 'center', wordWrap: { width: cardW - 30 },
      }).setOrigin(0.5, 0);

      this.add.text(x - cardW / 2 + 16, 229, 'PARTY', {
        fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.muted,
      });
      this.add.text(x - cardW / 2 + 16, 250,
        preset.partyIds.map(id => getTemplate(id).name.toUpperCase()).join(' · '), {
          fontFamily: BODY_FONT, fontSize: '10px', color: UI.tealCss,
          wordWrap: { width: cardW - 32 },
        });

      this.add.text(x - cardW / 2 + 16, 291, 'OPPOSITION', {
        fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.muted,
      });
      this.add.text(x - cardW / 2 + 16, 312,
        preset.enemyIds.map(id => getTemplate(id).name.toUpperCase()).join(' · '), {
          fontFamily: BODY_FONT, fontSize: '10px', color: UI.goldCss,
          wordWrap: { width: cardW - 32 },
        });

      const hp = Math.round(preset.initialHpFraction * 100);
      const mp = Math.round(preset.initialMpFraction * 100);
      this.add.text(x, 376, `ENEMY LV ${preset.enemyLevel}  ·  HP ${hp}%  ·  MP ${mp}%`, {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
      }).setOrigin(0.5);
      this.add.text(x, 397, `FIXED SEED ${preset.seed}`, {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
      }).setOrigin(0.5);

      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = index;
        this.lastResult = null;
        this.draw();
      });
    });

    this.add.text(480, 425, 'RESOURCE MODEL — CHAMBER ONLY', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.muted,
    }).setOrigin(0.5);
    button(this, 375, 451, 190, 34,
      this.resourceModel === 'individual_mp' ? '● MP CONTROL' : '○ MP CONTROL',
      () => this.setResourceModel('individual_mp'),
      this.resourceModel === 'individual_mp' ? UI.gold : UI.line);
    button(this, 585, 451, 190, 34,
      this.resourceModel === 'shared_tempo' ? '● SHARED TEMPO' : '○ SHARED TEMPO',
      () => this.setResourceModel('shared_tempo'),
      this.resourceModel === 'shared_tempo' ? UI.teal : UI.line);

    if (this.lastResult) {
      const r = this.lastResult;
      const color = r.outcome === 'victory' ? UI.greenCss : UI.redCss;
      this.add.text(480, 484, `${r.outcome.toUpperCase()} · ${r.rounds} ROUNDS · ${r.resourceModel === 'shared_tempo' ? 'SHARED TEMPO' : 'MP CONTROL'}`, {
        fontFamily: DISPLAY_FONT, fontSize: '10px', color,
      }).setOrigin(0.5);
      this.add.text(480, 503,
        `TEMPO +${r.tempoGenerated}  SPENT ${r.tempoSpent} (MOVE ${r.tempoSpentOnMoves} · RELAY ${r.tempoSpentOnRelay})  WASTED ${r.tempoWasted}`, {
          fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
        }).setOrigin(0.5);
      this.add.text(480, 520,
        `PACK FIRST ${r.packFirstRounds}/${r.initiativeRounds}  ·  ACTIONS P${r.playerActions}/E${r.enemyActions}  ·  RELAYS ${r.relays}`, {
          fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
        }).setOrigin(0.5);
    } else {
      this.add.text(480, 503, this.resourceModel === 'shared_tempo'
        ? 'BUILDERS ARE FREE; MOVES AND RELAY COMPETE FOR ONE CAPPED POOL.'
        : 'CONTROL: INDIVIDUAL MP PAYS FOR MOVES; TEMPO ONLY PAYS FOR RELAY.', {
        fontFamily: BODY_FONT, fontSize: '11px', color: UI.mutedBright,
      }).setOrigin(0.5);
    }

    button(this, 352, 560, 230, 48, 'START MANUAL', () => this.launch(false), UI.gold);
    button(this, 608, 560, 230, 48, 'START AUTO', () => this.launch(true), UI.teal);
    footer(this, '← → PRESET  ·  M MODEL  ·  ENTER MANUAL  ·  A AUTO',
      `SEED ${BATTLE_CHAMBER_PRESETS[this.selected].seed}`);
  }

  private launch(auto: boolean): void {
    const preset = BATTLE_CHAMBER_PRESETS[this.selected];
    gameState.battleSpeed = auto ? 4 : 1;
    gameState.runParty = preset.partyIds.map((id, index) => {
      const creature = gameState.createCreatureInstance(id, 0);
      creature.instanceId = `chamber-${preset.id}-player-${index}`;
      if (this.resourceModel === 'shared_tempo') {
        const loadout = SHARED_TEMPO_LOADOUTS[id];
        if (loadout) creature.abilities = [...loadout, null, null].slice(0, 4);
      }
      return creature;
    });
    gameState.startRun();
    gameState.backpack = createBackpack();

    const encounter: Encounter = {
      type: preset.encounterType,
      enemies: [...preset.enemyIds],
      enemyLevels: preset.enemyLevel,
      floor: 1,
      index: 0,
      bossTier: preset.bossTier,
    };
    const run: RunState = {
      startFloor: 1,
      currentEncounterIndex: 0,
      encounters: [encounter],
      choices: [],
      obols: 0,
      partyHp: {},
      partyMp: {},
      partyKO: {},
      xpEarned: 0,
      autoCombat: auto,
      activeBoons: [],
    };
    for (const creature of gameState.runParty) {
      run.partyHp[creature.instanceId] = Math.max(
        1, Math.floor(creature.currentStats.hp * preset.initialHpFraction),
      );
      run.partyMp[creature.instanceId] = Math.floor(
        creature.currentStats.mp * preset.initialMpFraction,
      );
      run.partyKO[creature.instanceId] = false;
    }
    gameState.currentRun = run;

    this.scene.start('CombatScene', {
      encounter,
      chamber: { presetId: preset.id, seed: preset.seed, auto, resourceModel: this.resourceModel },
    });
  }
}
