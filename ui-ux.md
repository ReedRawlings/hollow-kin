# **Hollow Kin — UI/UX & Player Information Design**

*Working Document — Subject to Change*

---

## **Overview**

Hollow Kin has a lot of overlapping systems — traits, marks, abilities, stars, longevity, breeding, capture, relics, and town upgrades. The player needs clear, consistent ways to parse all of it without being overwhelmed. This document covers the information architecture, key screen flows, and design philosophy for how the game communicates its systems to the player.

---

## **Design Philosophy**

* **Show, don't dump.** Introduce systems one at a time. The first few runs should feel simple — combat, capture, return to town. Breeding, traits, marks, and the Enhancer reveal themselves as the player naturally encounters them.
* **Information on demand.** The default view should be clean. Details are available on tap/hover/click but never forced on the player.
* **Consistent visual language.** Stars, marks, traits, and abilities each have a distinct icon style so the player can parse at a glance which system they're looking at.
* **No hidden math.** If a stat or multiplier affects gameplay, the player should be able to see it. Damage formulas can be abstracted but the inputs (ATK vs DEF, resistance, weakness) should be visible.

---

## **Key Screens**

### **Town Hub**

The home screen between runs. Shows:

* The three town buildings (Creature Box, Leathersmith, Enhancer) with upgrade status
* A "Start Run" button
* Access to the Creature Box for party management and breeding
* Current resource counts (Town Resources, Breeding Stones, Breeding Relics)

### **Creature Box / Party Management**

* Grid or list view of all owned creatures
* Each creature card shows: name, archetype icon, star rating, longevity remaining, breed-ready indicator
* Tapping a creature opens its detail view
* Drag or select to assign creatures to the run party (3 slots)
* Filter and sort options: by archetype, by star, by longevity, by breed-ready status

### **Creature Detail View**

The most information-dense screen. Must be scannable.

* **Header:** Name, archetype, star rating (visual stars), level / level cap
* **Stats block:** HP, MP, STR, DEF, WIS, SPD, INT — with base and current values
* **Traits:** Up to four slots. Filled slots show trait name, level, and icon. Unfilled slots show the star required to unlock.
* **Mark:** Active mark name and effect. Tap to see all earned marks and swap.
* **Abilities:** Up to four slots with ability names and types.
* **Longevity:** Runs remaining, with a visual indicator (green → yellow → red)
* **Lineage:** Parent names (tappable to view parent details if not retired). Depth indicator showing how many generations deep this creature is.
* **Breed-ready badge:** Prominent visual when the creature has hit its level cap and is eligible for breeding.

### **Breeding Screen**

* Two parent slots — drag or select creatures from the box
* Preview panel showing:
  * Offspring star rating (calculated from parents)
  * Offspring level cap
  * Trait resolution preview: which slots will be chosen at birth vs. resolved during runs
  * Ability inheritance options (toggle parent abilities on/off)
  * Stat inheritance estimate (offspring base stats)
* Optional: Breeding Relic or Stone slot (one per breeding event)
* Confirm button with a clear warning that both parents will be retired

### **Run Map / Encounter Select**

* Shows the current encounter and the next 2–3 options (if using Pick-Next structure)
* Each option shows encounter type icon (combat, shop, rest, event)
* Current party status bar at the top: creature portraits with HP/MP bars
* Inventory access for consumables and captured creatures

### **Combat Screen**

* Player creatures on one side, enemies on the other
* Active creature highlighted with ability buttons along the bottom
* HP/MP bars visible for all combatants
* Buff/debuff icons displayed under each creature with remaining turn count
* Status effect icons with distinct visual treatment (poison = green pulse, burn = orange glow, etc.)
* Auto-combat toggle always accessible
* Turn order indicator showing who acts next

### **Post-Encounter Screen**

* Rewards summary: Plasm earned, items found, resources gathered
* Mark threshold progress for each creature (e.g., "Ghost damage: 450/1000")
* XP gained and level-up notifications
* Option to capture a downed enemy (if Plasm is sufficient)
* "Continue" to the next encounter selection

### **Bestiary**

* Catalog of all discovered creatures
* Entries unlock on first encounter (wild) or first breeding (breed-only)
* Each entry shows: base stats, archetype, default abilities, zone availability
* Breed-only entries show the parent combination once discovered
* No spoilers — undiscovered creatures show as silhouettes with archetype icon only

---

## **Onboarding Flow**

The game should not have a tutorial screen. Instead, systems are introduced through natural play:

1. **Run 1:** Combat only. Player learns basic attack, abilities, and turn order. Capture is disabled.
2. **Run 2:** Capture is introduced. Player catches their first wild creature.
3. **Run 3:** Longevity warning appears on a starter creature. Town introduces the Creature Box and breeding.
4. **Run 4–5:** First breeding event. Traits system is introduced through the breeding preview.
5. **Run 6+:** Marks begin appearing as thresholds are approached. Enhancer unlocks.

Each introduction is a brief contextual tooltip, not a forced walkthrough. The player can dismiss and discover on their own.

---

## **Visual Language Reference**

| System | Icon Style | Color Association |
| ----- | ----- | ----- |
| Stars | Filled star icons (1–12) | Gold |
| Traits | Hexagonal badge | Varies by trait category |
| Marks | Shield or crest shape | Silver / archetype color |
| Abilities | Circular icon with type color | Matches damage type |
| Longevity | Hourglass or countdown | Green → Yellow → Red |
| Breed-ready | Glowing heart or link icon | Pink / magenta |
| Relics | Crystalline shard | Purple |
| Stones | Rough gem shape | Blue |

---

## **Accessibility Considerations**

* All color-coded information must also have icon or shape differentiation for colorblind players
* Text size options for stat-heavy screens
* Auto-combat as an accessibility feature — players who struggle with real-time decisions can rely on tactics
* Screen reader support for key information (creature names, stats, abilities) — TBD based on engine capabilities

---

## **Open Questions**

* Whether lineage should be displayed as a tree visualization or a simple depth counter
* How deep the bestiary goes — does it track breeding history per creature, or just species data?
* Whether the combat screen needs a detailed damage log or if visual feedback is sufficient
* Mobile vs. desktop layout priorities — the game is browser-based, so responsive design matters
* How the player is notified of breed-only discovery — popup, bestiary notification, both?
* Whether there should be a "strategy guide" or "tips" section accessible from the town hub
* Animation and feedback design for key moments: breeding, trait unlock, mark earned, star increase
