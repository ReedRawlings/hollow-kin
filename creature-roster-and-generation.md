# **Hollow Kin — Creature Roster & Generation**

---

## **Overview**

Hollow Kin launches with approximately 96 creatures across 8 archetypes — 12 per archetype. This is the starting target, not a ceiling. The roster can be expanded by adding rows to the master spreadsheet. These are not hand-authored individually — they are generated programmatically from a data-driven design system. This document covers how the roster is structured, how creatures are defined in data, and how the generation pipeline works.

---

## **Roster Structure**

### **Distribution by Archetype**

12 creatures per archetype, evenly distributed. No archetype is inherently rarer than another — rarity exists at the individual creature level within each archetype.

| Archetype | Count | Combat Identity |
| ----- | ----- | ----- |
| Kami | 12 | Debuffs and ice |
| Spirits | 12 | Ghost damage and debuffs |
| Flora | 12 | Heals and buffs |
| Fauna | 12 | Physical, high speed |
| Rock | 12 | Defense, physical |
| Mecha | 12 | Flame and electricity, fragile |
| Food | 12 | Buffs and physical |
| Human | 12 | Physical and ice |

### **Availability**

* **Wild-catchable:** The majority of creatures, available in specific zones  
* **Boss-exclusive:** Unique creatures, uncapturable during runs, but breedable after defeat. One per zone plus a final boss  
* **Breed-only:** Creatures that can only be obtained by breeding specific combinations — not found in the wild

---

## **The Creature Data Object**

Every creature is defined by a row in the master data spreadsheet and represented in code as a plain JavaScript object. Stats are data. Behavior is code.

{  
  id: "creature\_001",  
  name: "Emberwhelp",  
  archetype: "Mecha",  
  baseStats: {  
    hp: 40,  
    mp: 25,  
    str: 12,  
    def: 8,  
    wis: 10,  
    spd: 18,  
    int: 14  
  },  
  naturalLevelCap: 5,        // Wild-caught cap before earning stars  
  defaultAbilities: \["ability\_012", "ability\_034"\],  
  naturalTraitPool: \["trait\_fire\_res", "trait\_spd\_up", "trait\_initiative"\],  
  resistances: \["fire"\],  
  weaknesses: \["ice"\],  
  availability: "wild",       // wild | boss | breed\_only  
  zone: 1,                    // primary zone where this creature appears  
  spriteId: "emberwhelp"  
}

This object represents the species template. It is distinct from a creature instance — what a player actually owns. The instance references this template and layers on top of it.

---

## **The Creature Instance Object**

What the player owns is an instance derived from the species template. It holds all the runtime and persistent data for that specific creature.

{  
  instanceId: "uuid",  
  speciesId: "creature\_001",  
  nickname: null,  
  starRating: 0,  
  currentLevel: 1,  
  longevity: 2,              // Star 0 (wild) = 2 runs  
  earnedMarks: \[\],            // all marks this creature has ever earned  
  activeMarkId: null,         // the currently equipped mark  
  traitSlots: \[  
    { traitId: null, traitLevel: 0, unlocked: false },  
    { traitId: null, traitLevel: 0, unlocked: false },  
    { traitId: null, traitLevel: 0, unlocked: false },  
    { traitId: null, traitLevel: 0, unlocked: false }  
  \],  
  abilities: \["ability\_012", "ability\_034", null, null\],  
  lineage: {  
    parentA: null,            // instanceId of parent or null if wild  
    parentB: null  
  },  
  stats: {                    // current calculated stats, derived from base \+ star \+ level  
    hp: 40,  
    mp: 25,  
    str: 12,  
    def: 8,  
    wis: 10,  
    spd: 18,  
    int: 14  
  },  
  resistances: \["fire"\],  
  weaknesses: \["ice"\],  
  isRetired: false  
}

---

## **Stat Generation Formula**

### **Base Stats**

Base stats are authored per species in the spreadsheet. They represent the floor — what the creature has at level 1 with no breeding.

### **Stat Scaling Per Level**

Stats scale linearly from base to a cap determined by star rating. The formula during a run:

current\_stat \= base\_stat \+ ((max\_stat \- base\_stat) \* (current\_level / level\_cap))

Where `max_stat` is derived from the species template and modified by star rating.

### **Bred Stat Inheritance**

When a creature is bred its base stats are:

offspring\_base\_stat \= (parentA\_stat \+ parentB\_stat) / 6, but never lower than the species base stat

This means bred creatures have better floors than wild creatures, compounding across generations.

### **Archetype Stat Profiles**

Each archetype has a stat bias applied during generation to ensure the species feels like its archetype. These are multipliers applied on top of the base formula.

| Archetype | High Stats | Low Stats |
| ----- | ----- | ----- |
| Kami | Balanced across all | None |
| Spirits | INT, WIS | STR, DEF |
| Flora | WIS, HP | STR, SPD |
| Fauna | STR, SPD | DEF, INT |
| Rock | DEF, HP | SPD, INT |
| Mecha | SPD, INT | HP, DEF |
| Food | STR, WIS | SPD, INT |
| Human | STR, DEF | WIS, INT |

---

## **Trait Pool Generation**

Each species has a `naturalTraitPool` — a subset of traits that can randomly roll when a wild creature earns a new star. This pool is authored per species in the spreadsheet as a list of trait IDs.

The pool is curated to feel appropriate for the species. A Mecha creature's pool contains fire resistance, speed traits, and electricity-related bonuses. A Flora creature's pool contains healing amplifiers and buff-related traits. No species has access to the entire trait library through natural rolls — the pool is always a curated subset.

Bred creatures do not draw from the pool for inherited slots — those are resolved through the breeding system. The pool only applies to unfilled slots that neither parent contributed to.

---

## **The Generation Pipeline**

### **Step 1 — Master Spreadsheet**

All species data is authored in a spreadsheet. Each row is one species. Columns cover every field in the creature data object: id, name, archetype, base stats, default abilities, trait pool IDs, resistances, weaknesses, availability, zone.

Stat formulas in the spreadsheet apply archetype multipliers automatically. The spreadsheet is the single source of truth for all numeric balance.

### **Step 2 — Export**

The spreadsheet is exported as JSON.

### **Step 3 — Importer Script**

A Node.js script reads the JSON and produces one creature data object file per species. These are the species templates used at runtime.

// Pseudocode  
const raw \= JSON.parse(fs.readFileSync('creatures.json'));  
raw.forEach(row \=\> {  
  const template \= buildCreatureTemplate(row);  
  fs.writeFileSync(\`data/creatures/${row.id}.json\`, JSON.stringify(template));  
});

### **Step 4 — Runtime Instantiation**

When the game needs a creature — spawning an enemy, hatching a bred offspring, initializing a player's starter — it loads the species template and creates an instance from it.

function createInstance(speciesId, options \= {}) {  
  const template \= loadTemplate(speciesId);  
  return {  
    instanceId: generateUUID(),  
    speciesId: template.id,  
    starRating: options.starRating ?? 0,  
    currentLevel: 1,  
    longevity: options.longevity ?? template.naturalLongevity,  
    stats: { ...template.baseStats },  
    abilities: \[...template.defaultAbilities, null, null\],  
    traitSlots: buildTraitSlots(options.inheritedTraits ?? \[\]),  
    lineage: options.lineage ?? { parentA: null, parentB: null },  
    resistances: \[...template.resistances\],  
    weaknesses: \[...template.weaknesses\],  
    earnedMarks: \[\],  
    activeMarkId: null,  
    isRetired: false  
  };  
}

---

## **Rebalancing Workflow**

If stats need adjustment during playtesting, the process is:

1. Edit formulas in the master spreadsheet  
2. Export updated JSON  
3. Run the importer script  
4. All species templates update automatically

No individual creature files need to be touched. Instances in player saves recalculate from the updated templates on next load.

---

## **Starting Creatures**

New players are presented with two fixed, hand-authored trios of creatures to choose from. They select one trio as their starting party.

All six starter creatures begin at Star 0 with no traits unlocked, no marks, and default abilities only. Starters are fixed across all sessions so the early game is consistent and experienced players can give reliable advice to new ones. The first few runs are naturally tutorial-paced since no traits are active yet — players learn combat before the breeding system adds complexity.

**Trio A — Aggressive** Oriented around dealing damage quickly and ending fights fast. Suggested archetypes: Fauna for physical speed, Mecha for elemental burst, Human for versatility. One straightforward attacker, one that rewards ability timing, and one that introduces elemental damage types.

**Trio B — Resilient** Oriented around surviving, controlling, and outlasting. Suggested archetypes: Rock for defense anchoring, Flora for healing, Spirits for debuffing. One straightforward tank, one that rewards knowing when to heal versus attack, and one that introduces status effects.

Specific species assignments and ability loadouts for all six starters are pending full roster completion.

---

## **Breed-Only Creatures**

Breed-only creatures cannot be found in the wild or captured during runs. They are discovered exclusively through the breeding system.

### **Discovery Rules**

* Breed-only creatures are triggered by breeding two specific species together — the combination matters, not just the archetypes
* The player is not told which combinations produce breed-only results — discovery is organic
* Once a breed-only creature has been discovered, it is added to a bestiary entry so the player can reference the recipe
* Breed-only creatures follow all standard breeding rules (star calculation, trait inheritance, stat inheritance) — the only difference is that the offspring species is unique rather than inheriting one parent's species
* Once a creature has been bred it can be found in the while with a low chance of being a variant version.

---

## **Open Questions**

* How many creatures per zone for enemy encounters 