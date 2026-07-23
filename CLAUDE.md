# Hollow Kin — Project Context

## What This Is

Hollow Kin is a browser-based creature collector roguelite. The player descends a procedurally generated tower with a party of 3 bred creatures, gathering resources, capturing new creatures, and earning genealogy progress that persists across runs. Inspired by Dragon Quest Monsters (breeding), Azure Dreams (tower/run structure), and Slay the Spire (roguelite pacing).

## Tech Stack

- **Engine:** Phaser 3 (v3.80+)
- **Language:** TypeScript
- **Build:** Vite
- **Save:** localStorage (Supabase planned for later)
- **Canvas:** 960×640 logical resolution, `zoom: devicePixelRatio` for crisp rendering on HiDPI displays

## Design Documents

The project root contains the full game design documentation. **The GDD is the source of truth.** Each section has a corresponding detailed doc:

| File | Covers |
|------|--------|
| `game-design-document.md` | Primary GDD — overview of all systems |
| `combat-system.md` | Turn-based combat, damage formula, buffs/debuffs, auto-combat |
| `creature-roster-and-generation.md` | Target 96 creatures (12×8 archetypes), data objects, generation pipeline |
| `breeding-and-inheritance.md` | Star ratings, level caps (0-12), trait resolution cases 1-4 |
| `breeding-stones.md` | Consumables for enhancer, 4 tiers |
| `marks-system.md` | Run-earned bonuses, 1 slot per creature |
| `marks-catalog.md` | All mark entries with thresholds |
| `traits-system.md` | 4 trait slots, 4 levels, star progression table |
| `tower-structure.md` | 3 zones, 15 encounters each, procedural generation rules |
| `town.md` | Creature Box, Leathersmith, Enhancer buildings |
| `economy-balancing.md` | Resources, progression pacing, drop rates |
| `relics.md` | Run-only temporary power-ups |
| `onboarding.md` | Tutorial flow (Phase 1: combat/capture, Phase 2: breeding) |
| `ui-ux.md` | Screen designs, visual language, accessibility |
| `Abilities.csv` | 72 abilities with stats, types, archetypes |

## Current State — Working Vertical Slice

A playable vertical slice exists with the full core loop: town → party select → tower run → combat → return to town → breed → repeat.

### What's Built

**Source structure:**
```
src/
  main.ts                    — Phaser game config, entry point
  types.ts                   — All interfaces, enums, constants
  data/
    abilities.ts             — 25 abilities (subset of 72 from CSV)
    creatures.ts             — 12 creatures (1-2 per archetype)
  managers/
    GameState.ts             — Singleton: creature box, party, runs, save/load
  systems/
    CombatEngine.ts          — Damage formula, turn order, buffs, status effects, enemy AI
    BreedingSystem.ts        — Star calculation, stat inheritance, breed function
    RunGenerator.ts          — Zone encounter generation, pick-next choices
  scenes/
    BootScene.ts             — Starter trio selection, save loading
    TownScene.ts             — Town hub with creature box, resources, navigation
    PartySelectScene.ts      — Pick 3 creatures for a run
    RunScene.ts              — Pick-next encounter navigation, zone transitions
    CombatScene.ts           — Full turn-based 3v3 combat with player input
    ShopScene.ts             — Spend plasm on HP/MP heals, revives
    RestScene.ts             — Choose between HP heal, MP restore, or balanced
    BreedingScene.ts         — Select 2 parents, preview offspring, confirm breed
```

**Working systems:**
- Turn-based combat with abilities, MP, buffs/debuffs, status effects, crits (player-only), defend
- Damage formula: `(ATK - DEF/2) × (Power/50) × TypeMultiplier`
- Per-creature resistances/weaknesses (no archetype rock-paper-scissors)
- Creature leveling during runs (XP from combat, level-scaled stats)
- Breeding with star calculation, stat inheritance, parent retirement
- Longevity system (ticks down each run)
- Procedural zone generation with constraints (combat first, rest before boss, no 3+ combats in a row)
- Pick-next encounter navigation (first encounter forced combat, pre-boss forced rest)
- Shop/rest encounters for mid-run resource management
- localStorage save/load

**12 starter creatures across 8 archetypes:**
- Trio A (Aggressive): Ironjaw (Fauna), Emberwhelp (Mecha), Bladeknight (Human)
- Trio B (Resilient): Stoneguard (Rock), Thornvine (Flora), Duskgeist (Spirits)
- Also: Voltarc (Mecha), Petalward (Flora), Swiftfang (Fauna), Bouldershell (Rock), Frostwisp (Kami), Riceball (Food)
- Player selects one trio to start; gets only those 3

**Visuals:** Placeholder colored rectangles per archetype. No sprites yet.

### What's NOT Built Yet

- Capture system (plasm-based creature capture during runs)
- Traits system (passive combat effects from TraitLibrary)
- Marks system (run-earned bonuses with thresholds)
- Run relics (temporary power-ups)
- Auto-combat / tactics system
- Breeding stones & Enhancer upgrades
- Leathersmith (inventory/backpack upgrades)
- Onboarding tutorial (old man encounter from onboarding.md)
- Remaining ~47 abilities from Abilities.csv
- Remaining 84 creatures (target: 96 total, 12 per archetype)
- Any art/sprites

## Key Design Rules (Don't Violate These)

- Creatures **reset to level 1** every run. Persistent progress is breeding genealogy only.
- **No archetype-level type chart.** Resistances/weaknesses are per-creature.
- Stars only increase through **breeding**, never during a run.
- Both parents are **retired** when breeding.
- Longevity ticks down at **run start**, regardless of outcome.
- First encounter per zone is always **combat**. Last before boss is always **rest**.
- Player crits only — enemies cannot crit.
- Buff/debuff stages cap at **±3**.

## Running the Project

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

Click "NEW GAME" in town to reset localStorage save if needed.
