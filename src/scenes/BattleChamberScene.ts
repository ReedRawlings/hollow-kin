import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { createBackpack } from '../systems/Backpack';
import {
  BATTLE_CHAMBER_PRESETS, BattleChamberResourceModel, BattleChamberResult,
  BATTLE_CHAMBER_LOADOUTS, DEFAULT_BATTLE_CHAMBER_RESOURCE_MODEL,
  battleChamberResourceRules,
} from '../systems/BattleChamber';
import { Encounter, RunState } from '../types';
import {
  BODY_FONT, DISPLAY_FONT, UI, button, footer, header, panel, screenFrame,
} from '../ui/Theme';

interface BattleChamberSceneData {
  selectedPresetId?: string;
  result?: BattleChamberResult;
  resourceModel?: BattleChamberResourceModel;
  comparisonResults?: Partial<Record<BattleChamberResourceModel, BattleChamberResult>>;
}

export class BattleChamberScene extends Phaser.Scene {
  private selected = 0;
  private lastResult: BattleChamberResult | null = null;
  private comparisonResults: Partial<Record<BattleChamberResourceModel, BattleChamberResult>> = {};
  private resourceModel: BattleChamberResourceModel = DEFAULT_BATTLE_CHAMBER_RESOURCE_MODEL;

  constructor() {
    super({ key: 'BattleChamberScene' });
  }

  init(data?: BattleChamberSceneData): void {
    const selectedId = data?.selectedPresetId ?? BATTLE_CHAMBER_PRESETS[0].id;
    const index = BATTLE_CHAMBER_PRESETS.findIndex(preset => preset.id === selectedId);
    this.selected = index < 0 ? 0 : index;
    this.resourceModel = data?.resourceModel
      ?? data?.result?.resourceModel
      ?? DEFAULT_BATTLE_CHAMBER_RESOURCE_MODEL;
    this.comparisonResults = { ...(data?.comparisonResults ?? {}) };
    if (data?.result) this.comparisonResults[data.result.resourceModel] = data.result;
    this.lastResult = this.comparisonResults[this.resourceModel] ?? null;
  }

  create(): void {
    // Bound on every create, not once: Phaser's KeyboardPlugin drops all of its
    // listeners in shutdown(), so a "bind once" guard would leave the scene deaf
    // from its second visit onward.
    this.input.keyboard?.on('keydown-LEFT', () => this.shift(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.shift(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.launch(false));
    this.input.keyboard?.on('keydown-A', () => this.launch(true));
    this.input.keyboard?.on('keydown-M', () => this.toggleResourceModel());
    this.draw();
  }

  chamberState(): object {
    const selected = BATTLE_CHAMBER_PRESETS[this.selected];
    return {
      selectedPreset: selected.id,
      seed: selected.seed,
      resourceModel: this.resourceModel,
      resourceRules: battleChamberResourceRules(this.resourceModel),
      presets: BATTLE_CHAMBER_PRESETS.map(preset => ({
        id: preset.id,
        name: preset.name,
        enemies: preset.enemyIds.map(id => getTemplate(id).name),
        weaknesses: preset.enemyIds.map(id => [...getTemplate(id).weaknesses]),
        initialTempo: preset.initialTempoPoints ?? 0,
        linkArts: preset.linkArts ?? false,
        bossDoubleAction: preset.bossDoubleAction ?? false,
      })),
      lastResult: this.lastResult,
      comparisonResults: this.comparisonResults,
      controls: { previous: 'left', next: 'right', model: 'm', manual: 'enter', auto: 'a' },
    };
  }

  private shift(delta: number): void {
    this.selected = (this.selected + delta + BATTLE_CHAMBER_PRESETS.length)
      % BATTLE_CHAMBER_PRESETS.length;
    this.comparisonResults = {};
    this.lastResult = null;
    this.draw();
  }

  private setResourceModel(model: BattleChamberResourceModel): void {
    this.resourceModel = model;
    this.lastResult = this.comparisonResults[model] ?? null;
    this.draw();
  }

  private toggleResourceModel(): void {
    this.setResourceModel(this.resourceModel === 'individual_mp' ? 'shared_actions' : 'individual_mp');
  }

  private draw(): void {
    this.children.removeAll(true);
    screenFrame(this);
    header(this, 'BATTLE CHAMBER', 'MP TEMPO / RELAY LAB — REPEATABLE, SEEDED, NO PROGRESSION',
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
      const startingResource = this.resourceModel === 'shared_actions'
        ? 'AP 3/3'
        : `MP ${Math.round(preset.initialMpFraction * 100)}%`;
      this.add.text(x, 376, `ENEMY LV ${preset.enemyLevel}  ·  PARTY HP ${hp}%  ·  ${startingResource}`, {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
      }).setOrigin(0.5);
      const fixtureRules = [
        preset.initialTempoPoints ? `T${preset.initialTempoPoints}` : null,
        preset.linkArts ? 'LINKS' : null,
        preset.bossDoubleAction ? 'BOSS ×2' : null,
      ].filter(Boolean).join(' · ');
      const fixture = fixtureRules
        ? `FIXTURE ${fixtureRules} · SEED ${preset.seed}`
        : `FIXED SEED ${preset.seed}`;
      this.add.text(x, 397, fixture, {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
      }).setOrigin(0.5);

      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = index;
        this.lastResult = null;
        this.draw();
      });
    });

    this.add.text(480, 425, 'PLAYER MOVE ECONOMY — CHAMBER ONLY', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.muted,
    }).setOrigin(0.5);
    button(this, 375, 451, 190, 34,
      this.resourceModel === 'individual_mp' ? '● EXPEDITION MP' : '○ EXPEDITION MP',
      () => this.setResourceModel('individual_mp'),
      this.resourceModel === 'individual_mp' ? UI.gold : UI.line);
    button(this, 585, 451, 190, 34,
      this.resourceModel === 'shared_actions' ? '● LEGACY AP TEST' : '○ LEGACY AP TEST',
      () => this.setResourceModel('shared_actions'),
      this.resourceModel === 'shared_actions' ? UI.teal : UI.line);

    const resultRows = (['individual_mp', 'shared_actions'] as const)
      .map(model => this.comparisonResults[model])
      .filter((result): result is BattleChamberResult => !!result);
    if (resultRows.length > 0) {
      resultRows.forEach((r, index) => {
        const label = r.resourceModel === 'shared_actions' ? 'AP LEGACY' : 'MP TEST';
        const outcome = r.outcome === 'victory' ? 'WIN' : 'LOSS';
        const moveSpend = r.resourceModel === 'shared_actions'
          ? `AP SPENT ${r.actionPointsSpent}`
          : 'INDIVIDUAL MP';
        this.add.text(480, 486 + index * 24,
          `${label} · ${outcome} R${r.rounds} · ${moveSpend} · T +${r.tempoGenerated}/-${r.tempoSpent} · RELAY ${r.relays} · LINK ${r.linkArtsCompleted}`, {
            fontFamily: BODY_FONT, fontSize: '10px',
            color: r.resourceModel === this.resourceModel ? UI.hi : UI.mutedBright,
          }).setOrigin(0.5);
      });
    } else {
      this.add.text(480, 503, this.resourceModel === 'shared_actions'
        ? 'LEGACY TEST: 3 SHARED AP/ROUND · BASIC 0 · MOVES 1–2.'
        : 'ACTIVE: INDIVIDUAL MP · WEAKNESS → TEMPO · 3 TEMPO → RELAY.', {
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
      const loadout = BATTLE_CHAMBER_LOADOUTS[id];
      if (loadout) creature.abilities = [...loadout, null, null].slice(0, 4);
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
      chamber: {
        presetId: preset.id,
        seed: preset.seed,
        auto,
        resourceModel: this.resourceModel,
        initialTempoPoints: preset.initialTempoPoints,
        linkArts: preset.linkArts,
        bossDoubleAction: preset.bossDoubleAction,
        revealWeaknesses: true,
        comparisonResults: this.comparisonResults,
      },
    });
  }
}
