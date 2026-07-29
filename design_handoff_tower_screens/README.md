# Handoff: Tower Run — Game Screens

## Overview

A creature-collecting roguelike played in runs: you take three creatures into a 15-floor tower, pick your way down through encounters, spend obols inside the tower, then convert whatever is left into **essence** — the only currency that survives a run — and spend it in town on permanent upgrades.

This package documents ten screens covering the full loop:

**Run loop:** Starting Party → Party Screen → Combat → Post Battle Spoils → Run Map → (repeat) → Run Results
**Between runs:** Town Hub → Creature Box → Inventory (also reachable mid-run)

## About the Design Files

The files in `screens/` are **design references written in HTML**. They are prototypes that show intended look, copy, and interaction — **not production code to copy into the game**.

Each file is a self-contained page: a template plus a small logic class, with a `support.js` runtime alongside it. Open any `.dc.html` in a browser to see and click the design. Layout is expressed with **inline styles only** (no stylesheets, no CSS classes) — read the values off the markup, don't try to reuse the structure.

The task is to **recreate these screens in the game's actual engine and UI environment** (Godot/Unity UI, a React/DOM front end, whatever the project uses) with its established patterns. If no environment exists yet, choose the appropriate stack for a 2D pixel-art game and implement the screens there.

The dummy data in these files (creature names, stats, prices, floor numbers) is **illustrative sample data**, not game balance. Treat it as placeholder content while wiring real state.

## Fidelity

**High fidelity.** Colors, typography, spacing, borders, and interaction states are all final and should be matched closely. Every color is a literal hex value in the markup. The intended aesthetic is a hard-edged pixel/CRT UI: 2–4px solid borders, zero border-radius anywhere, no shadows, no gradients except 45° hatch patterns used as art placeholders.

Two things are deliberately *not* final:

1. **All creature/item/building art is a placeholder.** Every sprite, portrait, and building is drawn as a hatched plate: `background-color: #10121c` plus `background-image: repeating-linear-gradient(45deg, <tint> 0 5px, rgba(16,18,28,0) 5px 10px)`. Each placeholder marks where real pixel art goes; the tint hints at the subject's palette. Replace all of them with sprites.
2. **Town Hub exists in two directions** — see the Screens section.

## Design Tokens

### Palette (Lospec500-derived)

| Token | Hex | Use |
|---|---|---|
| Void | `#10121c` | Page and panel background, deepest layer |
| Panel | `#14141f` | Inset panels, unselected cards |
| Plate | `#2c1e31` | Raised/selected card fill, buttons at rest |
| Line | `#3e3b65` | Default border, dividers |
| Line bright | `#5e5b8c` | Emphasised border, disabled label text |
| Muted | `#8c78a5` | Secondary/label text |
| Muted bright | `#b0a7b8` | Tertiary values, inactive button text |
| Body | `#deceed` | Body copy inside panels |
| Text | `#f6e8e0` | Default text |
| Text hi | `#f7f3b7` | Headings, key numbers |
| Gold | `#f3a833` | Primary accent, selection, obols, confirm |
| Teal | `#6dead6` | Essence, MP, breeding, secondary accent |
| Teal deep | `#14262a` | Teal panel fill |
| Green | `#9de64e` | Positive / healing / gain |
| Green mid | `#5ab552` | Healthy HP |
| Green border | `#3e6e3e` | Green panel border |
| Red | `#ec273f` | Danger, loss, critical HP, locked |
| Red border | `#94493a` | Red panel border |
| Orange | `#de5d3a` | Burn status, elite threat |
| Amber | `#dab163` | Marks, relics |
| Fauna orange | `#e98537` | Brute/Fauna archetype |
| Tide blue | `#5e91b4` | Tide archetype (secondary) |
| Grove | `#93b247` | Grove archetype (secondary) |

Archetype identity colors: **Brute/Fauna** `#e98537`, **Ember** `#ec273f`, **Tide/Mecha** `#6dead6`, **Grove** `#9de64e`, **Hollow** `#8c78a5`, **Human** `#dab163`.

### Typography

- **Display:** `Press Start 2P` — screen titles, section headings, key numbers, buttons. Sizes used: 22px (hero number), 18px (large value), 14px (screen title), 13px (panel title), 12px, 11px, 10px, 9px (tiny labels/tags). Always with `line-height: 1.4–1.5` when it can wrap; never letter-spaced.
- **Body:** `Silkscreen` (400/700) — everything else. Sizes: 13px (subhead), 12px (body/labels), 11px (dense labels, values), 10px (tags, notes), 9px (map sign tags).
- Body copy uses `line-height: 1.5–1.6` and `text-wrap: pretty`.
- Minimum size anywhere is 9px, used only for tags on the town map.

### Geometry & spacing

- **Screen frame:** every screen is a fixed `960 × 640` box, `border: 4px solid #3e3b65`, `padding: 16px`, on a `#10121c` page. The design is presented inside a 32px-padded page wrapper with a title line above the frame — that wrapper is presentation chrome, not part of the screen.
- **Border widths:** 4px screen frame · 3px major panels and buttons · 2px cards, chips, inset panels, sprite plates.
- **Border radius: 0 everywhere. No shadows.**
- **Gaps:** 12px between major regions, 8–10px between sibling cards, 5–7px between rows inside a list, 3–4px between stacked label/value lines.
- **Padding:** 13–16px in major panels, 10–12px in cards, 5–9px in list rows, 2–8px in chips.
- Panels use `flex` with `min-height: 0` on scroll/shrink children; scrolling lists use `overflow-y: auto`.

### Recurring patterns

- **Sprite placeholder:** square or rect, `2px solid #3e3b65`, void background + 45° hatch tint. Sizes seen: 22, 26, 30, 32, 34, 40, 52, 62, 104px.
- **Selection:** border → `#f3a833`, fill → `#2c1e31`, title text → `#f7f3b7`. Unselected: border `#3e3b65`, fill `#14141f`/`#10121c`.
- **Archetype spine:** a 6px-wide full-height bar in the archetype color on the leading edge of a card.
- **Chip:** `2px` border + 2–3px/6–8px padding, label in `#8c78a5` + value in an accent color.
- **Down/dead creature:** `filter: grayscale(1) brightness(0.7)`, text → `#8c78a5`, border → `#2c1e31`.
- **HP color ramp:** >55% `#5ab552` · 25–55% `#f3a833` · <25% `#ec273f` · 0 `#8c78a5`. MP is always `#6dead6` (`#5e5b8c` when down).
- **Star rating:** `'★'.repeat(n) + '☆'.repeat(5 - n)` in `#f3a833`. Always five glyphs — never a bare numeral.
- **Currency chip:** obols = gold border `#f3a833` on `#2c1e31`; essence = teal border `#6dead6` on `#14262a`.
- **Footer hint bar:** every screen ends with a 12px `#5e5b8c` row: keyboard hints on the left, live status on the right.

## Screens

Coordinates below are inside the 960×640 frame. All screens follow the same skeleton: **header row** (title + subline, right-aligned status/currency, `border-bottom: 3px solid #2c1e31`) → **body** → **action row** → **footer hint bar**.

---

### 1. Starting Party — `screens/Starting Party.dc.html`

**Purpose:** first-run choice of the three creatures you begin with.

**Layout:** header ("CHOOSE YOUR THREE" / "THE OTHER HAND IS SET FREE") → a 2-column grid of two "hand" panels → a centered `START GAME` button (260px wide, 15px vertical padding, `3px solid #f3a833`).

**Hand panel:** title in Press Start 12px + a badge (`RECOMMENDED` / `HARDER START`), a one-line pitch (11px `#b0a7b8`), three creature cards stacked with `flex: 1`, and a bottom strip showing team shape + risk (`FORGIVING` green / `PUNISHING` red).

**Creature card:** archetype spine (6px) · 62px sprite placeholder · name + `LV 1` · archetype + five empty stars · a 3×2 grid of six stats (HP green, INT teal, rest `#deceed`).

**Behavior:** hover or ← → switches hands (they are mutually exclusive; you take one whole). Click/Enter on START GAME fills the button gold with `#10121c` text. Nothing renders below the button.

**Data:** Kennel Hand — Ironjaw (Fauna, HP40 STR18 DEF8 INT6 SPD16 WIS7), Emberwhelp (Mecha, 35/10/7/16/18/9), Bladeknight (Human, 45/16/14/8/10/8). Drowned Hand — Sablefin (Tide, 32/9/10/17/22/14), Thornmoth (Grove, 30/12/6/14/20/11), Hollowpage (Hollow, 38/14/11/10/13/16).

---

### 2. Party Screen — `screens/Party Screen.dc.html`

**Purpose:** look over the three creatures you are running with.

**Layout:** three creature cards side by side, sprite-dominant, with name + stars in the card header and HP/MP/status beneath. Hovering a card opens a **dossier panel** below with two-column stats, the move list, and a gold-framed Mark banner.

**Behavior:** hover selects; the dossier swaps in place.

---

### 3. Combat Screen — `screens/Combat Screen.dc.html`

**Purpose:** the turn-based fight.

**Layout:** turn-order ribbons across the header (strict initiative, left to right) → **enemy field**: bare sprites in a tightened 3-wide grid, deliberately with *no* name, level, or frame → **party row**: three near-square 128px portrait cards (sprite, name, HP/MP as plain numbers, status tag) → **command panel**: a 2×2 ability grid.

**Behavior:** `FIGHT` and `RUN` act immediately with no modal. `MAGIC` and `ITEM` swap a 2×2 submenu *into the same grid slot* the abilities occupied — never a popup. Selection uses the standard gold treatment.

---

### 4. Post Battle Spoils — `screens/Post Battle Screen.dc.html`

**Purpose:** bank obols, then take exactly one of three boons.

**Layout:** header ("VICTORY", floor/kills/rounds) with a purse chip → an `EARNED` strip itemising obol sources (FELLED +28, FLOOR CLEAR +12, NO RETREAT +5) with a `TOTAL +45` on the right → a 3-column boon grid → party status row + a 168px confirm button → footer.

**Boon card:** kind label, a 74px hatched value plate with the effect number in Press Start 18px, name, body copy, and a bottom line stating the **concrete effect on the current party** (e.g. "Ironjaw +21 · Emberwhelp +17 · Bladeknight revived at 34"). Selected card shows a `PICKED` gold tag.

**Behavior:** hover or ← → picks; Enter/click confirms and the button flips from `TAKE BOON` to `DESCEND`. Esc reopens the choice. Boon pool: HEAL / MP / ITEM / OBOLS — any three, driven by a `rewardSet` prop.

---

### 5. Run Map — `screens/Run Map.dc.html`

**Purpose:** choose the next room. The most-seen screen in a run.

**Layout:** header (`FLOOR 11`, rooms behind you, warden floor) with **AUTO toggle**, **BAG** button (`8 / 12`), and purse chip → **trail ribbon**: the rooms already cleared as 26px type-glyph tiles joined by 10px connector bars, current room highlighted gold → 2–3 offer cards in an equal-fraction grid → party status bar → 168px `ENTER` button → footer.

**Offer card — deliberately low information.** The room type is all the player learns: a large hatched plate with a 56px bordered glyph box centred in it, then the type name in Press Start 13px and a single atmospheric line. **No enemy counts, no level ranges, no reward numbers, no room names.** The four types:

| Type | Glyph | Color | Line |
|---|---|---|---|
| ENCOUNTER | `X` | `#ec273f` | "Something down there is awake." |
| RESPITE | `+` | `#9de64e` | "Quiet, and a fire someone left burning." |
| MARKET | `$` | `#f3a833` | "Someone is trading down here." |
| EVENT | `?` | `#8c78a5` | "No telling until you are standing in it." |

Unselected cards mute both name (`#b0a7b8`) and line (`#8c78a5`); the selected card brightens to `#f7f3b7`/`#deceed`.

**Behavior:** hover or ← → selects, Enter commits (`ENTER` → `ENTERING`, sub-label naming the type), Tab toggles AUTO, Esc backs out. The party bar shows current HP/MP and status tags (`BRN`, `DOWN`), and the confirm sub-label reads "N of 3 standing".

---

### 6. Inventory / Shared Bag — `screens/Inventory Screen.dc.html`

**Purpose:** one bag for the whole party; use an item on a chosen creature.

**Layout:** header (`CARRIED`, slot count, purse) → tab row `ALL / RESTORE / COMBAT / KEY` + entry count → two columns: a 348px scrolling item list (32px sprite, name, kind, count) and a detail panel (104px sprite, name, count, kind/where/worth chips, body copy) → a `GIVE IT TO` sub-panel with three creature targets previewing the exact effect per creature (`+25 HP`, `clears BRN`, `no effect` when down) → action line + `USE` + `DROP`.

**Behavior:** ↑↓ browses, ←→ picks the target, Enter uses. Key items grey out `USE`, show `NOT USABLE HERE`, and make targets unclickable. Slot count turns gold at 11/12.

---

### 7. Creature Box — `screens/Creature Box.dc.html`

**Purpose:** manage every owned creature and decide who rides along.

**Layout:** header (`OWNED`, `14 / 30 KEPT · 3 IN PARTY`, breed-ready chip with pairs-possible count) → **archetype filter row**: label pinned at `78px` + chips outlined in their own archetype color, filling with that color when active → **sort row**: `ARCHETYPE / STARS / LEVEL / READY` (active chip teal) + a `BREED-READY ONLY` toggle → body: a 4-column scrolling card grid (left) and a 268px **party dock** (right).

**Creature card:** 6px archetype spine · archetype word + `EGG`/`IN` tag · 52px sprite · name · stars + `LV{n}`.

**Party dock (this panel has one job — deciding the party):**
1. `BRINGING DOWN` — the three current party members as rows (archetype spine, 26px sprite, name, `LV n · ATK x DEF y`). Click one to mark it `OUT` (gold border).
2. **Compare panel** — `REPLACES SLOT n`, the selected creature's name + level, stars + mark line, then ATK/DEF/SPD rows each showing the value and the delta against the creature being replaced (`+5 vs Ironjaw`, green/red/grey). The panel clips; delta text truncates rather than wraps.
3. **Breed strip** — `BREED-READY` + eggs remaining (teal) or `NOT BREED-READY` + requirement (grey).
4. `SWAP IN` (gold, → `SWAPPED IN`) + `PAIR` (teal only when the creature is breed-ready).

**Behavior:** arrows move through the grid (←→ by one, ↑↓ by four), Enter swaps in, clicking a party row retargets the comparison. A creature already in the party shows `IN PARTY` and disables the swap.

---

### 8. Run Results — `screens/Run Results.dc.html`

**Purpose:** the exit ledger — convert leftover obols to essence. **Obols never leave this screen.**

**Layout:** header (outcome + run summary, `LEFTOVER 412 OBOLS` chip) → body split: **THE EXCHANGE** ledger (left) and a right column (balance card, bag, party fates) → an aggregate loss strip + `TO TOWN` button → footer.

**Ledger rows** (accent spine, label, source note, value):

| Row | Note | Value |
|---|---|---|
| BASE CONVERSION | "412 obols at 4 : 1" | `+103` |
| CREATURE TRAITS | "Bladeknight · Oathkeeper · +3 per floor cleared" | `+9` |
| QUARTERMASTER | "town rank 2 · +7% of the purse, rounded up" | `+14` |
| DEPTH REACHED | "floor 15 · 2 essence a floor, kept even on a wipe" | `+30` |
| *WIPE PENALTY (wipe only)* | "the tower keeps half of everything you had not spent" | `−78` red |

Below the ledger: `ESSENCE GAINED` plate with the total in Press Start 22px and a note reading "156 earned · nothing withheld" (or "half taken at the gate").

**Right column:** teal `PERMANENT BALANCE` card showing `1180 → 1336 ESSENCE`; a scrolling bag list where each item is tagged `KEPT` (green), `PROTECTED` (teal, key items) or `LOST` (red, struck through and greyed); three party cards with `HOME` / `FELLED`.

**Loss strip:** a terse aggregate, not prose — `TAKEN AT THE GATE` + two chips (`ESSENCE −78`, `ITEM Bone Charm`), or `NOTHING TAKEN` + `ESSENCE 0` / `ITEMS 0` in green.

**Wipe variant** (`outcome` prop = `WIPED`): title `PARTY WIPED` red, floor 13, the penalty row appears, essence halves, exactly **one randomly chosen unprotected item is lost** (key items are never eligible), all three creatures read `FELLED`, and the loss strip names both the essence and the item.

---

### 9a. Town Hub — `screens/Town Hub.dc.html` *(panel version)*

**Purpose:** between-run spending. **Essence only — obols never appear in town.**

**Layout:** header (`THE TOWN`, run count/deepest floor) + essence chip → left: a 2×4 grid of seven vendor tiles (colored spine, name, rank/stock tag, one-line trade) plus a bricked-up eighth door; right: default party (three cards) and a vendor detail panel (pitch + priced offers, red when unaffordable) → bottom action row: `ENTER TOWER` (gold, primary) / `PARTY` / `BREED` / `PEDIA`.

**Seven vendors:** Quartermaster (bag slots, exchange bonus) · Provisioner (carryable supplies) · Hatchery (breed a pair) · Mark-binder (bind an earned mark) · Gatekeeper (depth-jumps) · The Leveler (permanent levels) · The Oracle (floor foresight, **locked** until a run reaches floor 15 — greyed spine, muted text, default cursor).

> **Vendor names were realigned on 2026-07-28.** This handoff was drawn against an earlier vendor lineup; the tiles now carry the names in `town.md` and `TownScene.ts` so the mockups can be read as a build reference. The **layout is unchanged** — only names, trade lines and two state tags moved.
>
> | Was | Now | Note |
> |---|---|---|
> | Stonecutter | **Gatekeeper** | Despite the name, nothing to do with Breeding Stones — those belonged to the Enhancer, cut in the 2026-07-23 pivot. Its offers were `START AT FLOOR 3` and `KEEP 1 MORE ITEM ON WIPE`, i.e. depth-jumps plus a guaranteed bag slot. The depth half is the Gatekeeper; the wipe-protection half belongs to the Quartermaster and has been folded there |
> | Apothecary | **Provisioner** | Restoratives are bought as carryable items in town |
> | Reliquary | **Mark-binder** | |
> | Beast Broker | **The Leveler** | **Substitution, not a rename.** Buying grown creatures ("4★ Boarhide LV20") is not a mechanic in any current design doc, and the Leveler — the single most-used vendor in the build — had no tile at all. Reassigning this one keeps the layout intact. Revisit if a creature broker was actually intended |
>
> **Still missing from this mockup:** the **Trait-keeper** has no tile, and `town.md`'s vendor list does not fit the seven-tile grid. The bricked-up eighth door is the obvious home for it.
>
> **The sample party is stale content, not layout.** The three cards name Ironjaw / Emberwhelp / Bladeknight with archetypes `BRUTE` / `EMBER` / `HOLLOW` — species and archetype names from the superseded 36-creature roster, none of which exist. Read them as lorem ipsum for card sizing; real names now look like Cat (Fauna), Geta (Kami), Wiggledrake (Dragon). The same goes for the `34 of 60 seen` pedia count — the roster is 30.

### 9b. Town Hub Map — `screens/Town Hub Map.dc.html` *(preferred direction)*

Same content as 9a, rebuilt as a walkable town. **Build this one** unless you need the panel version as a fallback.

**Layout:** a `920 × 356` map area with a tiled ground (two 24px repeating-linear-gradient grids at `rgba(62,59,101,0.22)`), a horizontal road band at `y=196` (28px tall, `#2c1e31` with dashed highlights, bordered top and bottom) and a 16px side lane running up to the tower at `x=452`.

Ten clickable building footprints, absolutely positioned, each a hatched art plate with a sign strip along its bottom edge — **state tag on the first line, building name on the second** (the name must never truncate):

| Place | x, y | w × h | Role |
|---|---|---|---|
| THE TOWER | 375, 6 | 170 × 86 | `ENTER TOWER` |
| Quartermaster | 20, 108 | 148 × 88 | vendor |
| Provisioner | 178, 108 | 140 × 88 | vendor |
| Mark-binder | 600, 108 | 148 × 88 | vendor |
| Gatekeeper | 758, 108 | 142 × 88 | vendor |
| The Roost | 20, 244 | 140 × 96 | `PARTY` — box & swaps |
| Hatchery | 170, 244 | 140 × 96 | `BREED` |
| The Leveler | 320, 244 | 140 × 96 | vendor |
| The Archive | 470, 244 | 140 × 96 | `PEDIA` |
| The Oracle | 620, 244 | 140 × 96 | locked |

Plus a non-clickable 118×96 `NOTICE BOARD` at 782,244 carrying run news, and a 20px gold **player avatar** on the road at `y=200` that slides to the selected building's centre with `transition: left 160ms steps(4)` — the stepped easing is intentional, it reads as pixel movement.

Below the map: a "standing in front of" detail panel (place name, open/shuttered status, pitch, priced chips), the default party at 300px, and a 150px context button whose label changes by place — `ENTER TOWER` / `GO IN` / `PARTY` / `BREED` / `PEDIA` / `SHUTTERED`.

**The point of this version:** the four main verbs are *places*, not menu buttons. Party lives at the Roost, breeding at the Hatchery, the pedia at the Archive.

---

### Reference: original coded screen — `screens/Current PartySelectScene.dc.html`

The unstyled party-select scene as it exists in code today, kept for comparison. Superseded by `Starting Party.dc.html`.

## Interactions & Behavior (global rules)

- **Hover *is* selection.** Every list, grid, and card set selects on `mouseenter` as well as click; keyboard mirrors it. There is no separate focus ring.
- **Keyboard on every screen:** ←→ / ↑↓ (also WASD on several) moves selection · `Enter` confirms · `Esc` backs out of a committed state · plus screen-specific keys (`Tab` AUTO on Run Map, `T` tower in town). Handlers bind on `window` at mount, ignore `e.repeat`, and unbind on unmount.
- **No modals or popups anywhere.** Submenus replace content in the panel that spawned them (see Combat's MAGIC/ITEM grid).
- **Commit is two-stage and reversible:** select → confirm button fills gold and its label changes to a past/progressive form (`TAKE BOON`→`DESCEND`, `ENTER`→`ENTERING`, `USE`→`USED`, `SWAP IN`→`SWAPPED IN`); Esc returns to the un-committed state.
- **Previews are concrete, not abstract.** Wherever an effect can be computed against current state, show the real number per creature (`+21 HP`, `clears BRN`, `no effect`, `+5 vs Ironjaw`) rather than a generic description.
- **Disabled things stay visible.** Locked vendors, key items, and downed creatures are greyed with `default` cursors, never hidden or removed.
- **The only animation** in the whole set is the town-map avatar's 160ms stepped slide. Everything else is instant state swap — no fades, no eases.
- Long values truncate with ellipsis on a single line; body copy wraps with `text-wrap: pretty`.

## State Management

Per-screen local state, all trivially small:

- **Starting Party:** `sel` (0|1), `started`
- **Combat:** selected ability/target, active submenu (`abilities` | `magic` | `item`), turn order
- **Post Battle:** `sel` (0–2), `taken`
- **Run Map:** `sel` (0–2), `going`, `auto`
- **Inventory:** `tab`, `sel`, `target` (0–2), `used`
- **Creature Box:** `arch` filter, `sort`, `readyOnly`, `sel`, `slot` (party slot being replaced), `swapped`
- **Run Results:** derived from run outcome only — no interaction state
- **Town Hub / Map:** `sel` (vendor/place), `inside`

Run-level state the screens read from: party (3 creatures with HP/MP/status/level/mark), owned creature box, shared bag (12 slots, protected flag per item), purse in obols, floor number, trail of cleared rooms, essence balance, vendor ranks, seen-creature count.

Derived values that must live in one place: HP color ramp, star string, archetype color, affordability (price vs essence), breed-readiness, exchange rate and bonus stack.

## Assets

**None supplied.** Every visual is either a literal color or a hatch-pattern placeholder. What's needed:

- Creature sprites — at minimum the 14 named: Ironjaw, Emberwhelp, Bladeknight, Sablefin, Thornmoth, Boarhide, Cinderpup, Wardenwing, Brinehusk, Mossbrace, Kilnhound, Hollowpage, Slagcalf, Deepmaw. Required at ~26/34/52/64/104px, so author at a base size that scales by integer factors.
- Item icons — Salve, Ether Drop, Antidote, Smoke Bomb, Bone Charm, Kiln Oil, Warden's Sigil, Hollow Token.
- Town building art for the ten map plots, the road/ground tileset, and a player avatar sprite.
- Room-type glyphs for the Run Map (currently the characters `X + $ ?`) and the trail ribbon.

**Fonts:** Press Start 2P and Silkscreen, both Google Fonts (SIL Open Font License). The prototypes load them from Google; bundle them in the real build.

## Files

```
screens/
  Starting Party.dc.html            first-run party choice
  Party Screen.dc.html              party overview + dossier
  Combat Screen.dc.html             turn-based fight
  Post Battle Screen.dc.html        obols banked + one boon
  Run Map.dc.html                   pick next room (low-information)
  Inventory Screen.dc.html          shared bag
  Creature Box.dc.html              owned creatures + party swaps
  Run Results.dc.html               obol → essence exchange (+ wipe variant)
  Town Hub.dc.html                  town, panel version
  Town Hub Map.dc.html              town, walkable map — preferred
  Current PartySelectScene.dc.html  original coded scene, for reference
  support.js                        runtime needed to open the files locally
```

Open any file directly in a browser. Two screens carry variant toggles worth seeing — `Run Results` (`outcome`: ESCAPED / WIPED) and `Post Battle` (`rewardSet`) — exposed as editable props at the bottom of each file.
