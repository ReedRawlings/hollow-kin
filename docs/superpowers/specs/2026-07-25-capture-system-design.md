# Capture System — Design Spec

**Date:** 2026-07-25
**Status:** Approved design, ready for implementation planning
**Scope:** Obols-based creature capture during runs. Covers the rite and price model, the knowledge layer, duplicates, Creature Box handling, and the combat-turn interaction. Background survey: `docs/superpowers/research/capture-mechanics-research.md`.

---

## Guiding Principle

**Capture is a price, not a slot machine.** Bid under the price and you gamble at exactly that fraction; pay it and the capture is guaranteed. What moves the price is how you fought — the rites — so the interesting decision happens during the battle rather than at a menu. This is Monster Crown's reachable determinism rather than Pokémon's asymptote, and it avoids the failure mode the survey is clearest about: a permanently scarce guaranteed-capture item (the Master Ball) that players hoard and never use.

Two consequences shape everything below:

1. **The rites are the design.** The price bands, the odds, and everything downstream follow from them. Getting the rite vocabulary right is the whole problem; the numbers are tuning.
2. **Capture has exactly one output.** A creature, every time, duplicate or not. There is no Obols-to-permanent-power path through capture, so none of the genre's farming problems apply and none of their machinery is needed — no escalating duplicate price, no lifetime counters, no per-species decay.

---

## 1. Decisions locked during design

| Question | Decision |
|---|---|
| Cost model | Obols. Bid under the price to gamble at `bid / price`; pay the price for a guarantee. |
| Price model | Rites set the band: unsatisfied → high, family rite → ordinary, signature rite → near-nothing. HP is a nudge only, 1.25× at most. |
| Rite kinds | Family rites are broad and guessable; signature rites are bespoke. Rare species get **volatile** rites (true right now); commons get **sticky** ones (true at any point this fight). |
| Failure cost | Every Obol offered is lost regardless of outcome, excess included. The attempt costs the acting creature's turn. |
| Blind attempts | Unstudied species hide both rites and price. A failed bid returns a directional reaction that brackets the price, never a number. |
| Enrage | Three rejected bids and the creature refuses all further advances, heals slightly and gains a temporary buff. Only satisfying a rite clears it. Battle-scoped; nothing persists. |
| Knowledge | Failed bids narrow a price bracket. A successful bid confirms that one price point exactly. **Nothing ever reveals a rite** — rites are found by satisfying them. |
| Visible tell | The price is never shown by default. A satisfied rite puts the enemy into a visible **soothed** state — two intensities, one per band — for studied and unstudied species alike. |
| Duplicates | No Essence, no experience. A duplicate is a creature like any other — breeding fodder. Capture always does exactly one thing. |
| Monsterpedia | Exactly two price points per species — one with a rite, one without — each tagged with how it was learned (captured / wavered / insulted). |
| Box full on exit | The capture waits in the run inventory, occupying a slot, until Box space frees. |
| Box capacity | Becomes bounded and Essence-expandable, with a release mechanic added separately. Storage, not a pressure system. |
| Uncapturable creatures | Expressed as a base price of 0 — covers boss-exclusive and breed-only creatures with no special-casing. |
| Arrival state | A capture arrives as `createCreatureInstance(speciesId, 0)` — level 1, 0 stars, no Essence invested. It is cargo for the rest of the run and cannot be fielded. |
| Auto-combat | A standing capture policy. AUTO never sets up rites and always pays list price; the penalty is emergent, not a rule. Wasting Obols on unstudied species is a policy the player can knowingly choose. |

---

## 2. Rites and the price

Every species carries one or more **rites** — conditions that, when satisfied, replace which price band the creature is bought at.

| Band | When |
|---|---|
| **Unsatisfied** | high — payable only as a deliberate splurge |
| **Family rite** | ordinary — the working price for a prepared player |
| **Signature rite** | near-nothing |

Bands **replace** rather than stack. If both a family and a signature rite are satisfied, the better band applies.

**Family rites** are broad and guessable from the fiction — fire moves frost, a broken Defense opens armoured things. A player meeting an unfamiliar species can reason toward these. **Signature rites** are bespoke and strange, and they are the ones players tell each other about.

**Volatile vs sticky** is the difficulty dial. Common species get **sticky** rites, satisfied at any point in the fight and true thereafter — *was hit by fire this fight*. Rare species get **volatile** rites that must be true at the instant of the bid — *is burning right now*. Same vocabulary, sharply different demand: sticky rites are a checklist, volatile ones require you to build the turn.

**HP is a nudge, not a lever.** At most a 1.25× swing from full HP to nearly dead. The rites carry the price, so there is no reason to grind a target to 1 HP and no false-swipe minigame — the genre's oldest annoyance is designed out rather than mitigated.

> **Superseded (2026-07-27).** The continuous depth curve below is replaced by the tower-band price table in `creature-roster-and-generation.md`. Each species now carries **one authored price per band it appears in**, drawn from that band's range at generation time and then fixed — `captureBasePrice: { 1: 32, 2: 47 }`. At runtime the current floor's band selects the value; there is no calculation at encounter time. The coupling concern below still applies and now lives in the band table itself: the ranges climb 20–40 → 201–220 across ten bands, which must stay ahead of Obol income at depth.

~~`base` scales with depth by `floor ^ CAPTURE_DEPTH_EXPONENT`, matching `OBOL_REWARD_EXPONENT`. Obol income grows as `floor^0.5`; if prices grew more slowly, captures would get relatively cheaper with depth and deep floors would become the farmable ones. **These constants move together** — the same coupling rule documented on `OBOL_REWARD_EXPONENT` in `types.ts`.~~

### Bidding

```
chance = clamp01(bid / price)      // price 0 → uncapturable, chance always 0
```

Pay the price and the capture is guaranteed. Bid under it and you are gambling at exactly that fraction. **Every Obol offered is lost regardless of outcome, overpayment included** — there is no change from a bid.

**A successful capture resolves immediately.** The creature leaves the battle at the moment the bid lands; it is not held until the encounter ends.

### Enrage — the cap on brute force

**Three rejected bids and the creature turns away for good.** It refuses all further advances that battle, heals slightly, and takes a temporary buff. **Only satisfying a rite clears the enraged state**; more coins never will. Enrage is battle-scoped — it does not follow the creature anywhere, and nothing about it persists.

This is the load-bearing limit on probing. Without it, an unstudied species is a binary search — bid, read the bracket, bisect, and solve any creature's price inside one encounter. Three attempts is enough to narrow a bracket meaningfully and nowhere near enough to solve it, so probing stays a scouting tool rather than a substitute for figuring the creature out.

It also fails in the right direction. A player who has spent three bids and got nothing is now fighting a healed, buffed enemy — the cost of brute force is paid in the battle rather than only in Obols, and the way out is the rite, which is where the design wanted them looking the whole time.

---

## 3. Knowledge, and what a blind bid buys

An unstudied species hides **both its rites and its price**. You can still bid, blind.

A failed bid returns a **directional reaction, never a number**:

| Reaction | Means |
|---|---|
| **Insulted** | the bid was under 50% of the price |
| **Wavers** | the bid was between 50% and the full price |

So a blind bid is a probe. It costs Obols and buys a bracket, and the Monsterpedia keeps that bracket and narrows it across attempts and across runs. A successful bid confirms one price point exactly — the amount that worked, at whatever rite state was live when it worked.

**Nothing ever reveals a rite.** Not a successful capture, not a full-price bid, not the Monsterpedia. Rites are found only by satisfying them, and the tell is the price: a species whose price you have recorded suddenly costs far less, and the question becomes what you did differently this time. The bracket is a hint about the puzzle precisely because it prices the answer without naming it.

### What the Monsterpedia records

**Exactly two price points per species, always** — one with a rite satisfied, one without. Never a list, regardless of how many rites a species actually has. Two fixed slots mean the display can never leak the number of rites, which is the part of the puzzle worth protecting.

Each slot shows what it is worth and how it was learned:

| Provenance | The slot holds |
|---|---|
| **Captured** | a confirmed exact price |
| **Wavered** | a lower bound — the bid was at least half |
| **Insulted** | an upper bound — the bid was under half |

So a slot sharpens over time from "somewhere under this" to "at least this" to a hard number, and the icon tells the player at a glance how much to trust it.

### Soothed — the visible tell

The price is **not** displayed by default. What is displayed is the creature's disposition: when any rite is satisfied, the enemy visibly enters a **soothed** state — a status marker and a treatment on the sprite, readable at a glance and referenceable mid-fight.

This shows for **every** species, studied or not. That matters more than anything else in the knowledge design: a first-time player who happens to satisfy a rite by accident *sees something change*, and that is the moment the whole layer becomes discoverable. It is the exact failure World of Final Fantasy shipped — ~40 condition types and a player base where a visible share never realised conditions existed and concluded the RNG was rigged. The soothed state is the fix, and it costs nothing to read.

**Two intensities, one per band.** A family rite and a signature rite both soothe, but visibly differently. Without that, a player who satisfies a family rite has no reason to suspect a signature rite exists — and signature rites are the thing worth hunting. The stronger state says "there is a deeper one and you found it" without naming what it was.

Soothed and enraged are a matched pair. The creature's disposition toward you is always legible on its sprite — soothed when you have done something it wants, enraged when you have insulted it three times — while the *reason* stays the puzzle. The player always knows **that** something changed, never **what**, and never the price.

**Auto-combat interaction.** See §10.

---

## 4. Duplicates

A duplicate is just a creature. No Essence, no experience, no special case — capturing a species you already own gives you another one, exactly as the first did.

**Why it is nothing more than that.** Any permanent reward on a duplicate creates a second path from Obols to permanent power, running in parallel to the Quartermaster's conversion at a rate the player controls rather than one we set. Bounding it takes escalating prices, lifetime counters, or per-species decay — machinery the survey is full of, all of it solving a problem we can simply not create.

**What duplicates are for: breeding.** Parents currently come from starters and from offspring, and nothing else. Capture becomes the supply line for the breeding pool, which is what makes "collect" a pillar rather than a checklist — and since breeding retires both parents, the pool drains as fast as it fills. The sink is already in the game.

A player with no interest in breeding a given species simply doesn't capture it, or releases it. That is a real decision, and it is the only one this needs.

---

## 5. Arrival state — a capture is cargo

A capture is created by the existing `createCreatureInstance(speciesId, 0)`: level 1, `starRating` 0, `levelCap` 5, `essenceInvested` 0. It **cannot be fielded** — not in the battle it was caught in, and not later in the run.

This is deliberate and it keeps two invariants intact. The Leveler invariant (`essenceInvested == cumulative cost of permanentLevel`) would break if captures arrived above level 1 without credited Essence, and the amount is not decorative — a capture arriving at level 20 would represent about 6,700 Essence of free investment, roughly eight full descents. Handing that out for an Obol spend would make capture strictly better than the Leveler.

So a capture's value is entirely downstream: a species for the collection, breeding stock, and a body to invest Essence into later. Its immediate combat value is zero by design.

`tower-structure.md:115` already applies the same rule to variants — captured variants revert to base stats and unlock the colour option rather than arriving strong.

**This supersedes the GDD's former mid-run substitution rule**, which assumed captures arrived strong enough to fight. That rule is removed from `game-design-document.md`; `combat-system.md:29` still describes a Swap action that pulls captured creatures from inventory and needs the same correction.

---

## 6. The Creature Box and the pending queue

`creatureBox` is currently an unbounded array, so capacity is new state rather than a tuning change.

On a successful exit, each captured creature moves to the Box if there is room. If the Box is full, the capture stays in the inventory until room frees, and moves across automatically the next time it can. Box space is freed by the release mechanic and by Essence-purchased capacity expansion.

That is the whole rule. This is storage, not a pressure system — the failure mode to avoid is the player being nagged or losing things to bookkeeping, not the player having it too easy.

---

## 7. Architecture

Decision logic is pure and testable; the scene owns turn driving and presentation, matching the split `TacticsAI` already uses.

```
src/systems/Capture.ts       — pure: capturePrice, rite evaluation, captureChance, captureIntent
src/scenes/CombatScene.ts    — the capture action, spend UI, live percentage, turn consumption
src/managers/GameState.ts    — Box capacity, pending-capture queue, line-investment application
```

`Capture.ts` never mutates state and never consumes RNG — it returns numbers, and `CombatScene` rolls. This preserves the invariant the auto-combat spec relies on, that nothing outside the scene can desync the combat RNG stream.

---

## 8. Data model & persistence

**New on `CreatureTemplate`:**
- `captureBasePrice: Record<number, number>` — one price per tower band the species appears in, keyed by Tower ID. A species with `towerIds: [1, 2]` carries two. `0` means uncapturable in the wild.
- `rites: RiteDef[]` — family and signature rites, each flagged volatile or sticky, each with its own price.

**New on `GameState` (persisted, save version 3 → 4):**
- `creatureBoxCapacity: number`
- `pendingCaptures: CreatureInstance[]` — captures waiting for Box room
- `capturePolicy: CapturePolicyId` — defaults to `'unowned'`

**Migration from v3:** default `creatureBoxCapacity` to a value at or above the existing `creatureBox.length` so no save is retroactively over capacity, `pendingCaptures` to `[]`, and `capturePolicy` to `'unowned'`.

`RunState.capturedCreatures` already exists and is unchanged. Runs are not persisted, so nothing about in-run capture state needs migrating.

---

## 9. Open questions

Everything structural is decided. What remains is a rite vocabulary and a handful of numbers, both of which want playtest rather than argument.

1. ~~**The rite vocabulary itself**~~ — family rites are now authored for all eleven archetypes; see §12. Signature rites remain unwritten.
2. **The three price bands**, and how far apart they sit. "Near-nothing" for a signature rite has to still cost enough that paying it registers as a purchase.
3. **`CAPTURE_BASE_PRICE` per species**, checked against Obol income at the depth each species appears.
4. **How much Enrage heals and buffs.** Enough to punish three failed probes, not enough to lose the fight over.

---

## 10. Auto-capture policy

Auto-combat is a strategic layer, not a skip button — the decision is made *between* fights. Capture follows the same shape: the player sets a standing capture policy, and AUTO executes it.

### 10.1 The policies

| Id | Label | Fires on |
|---|---|---|
| `never` | Don't Capture | nothing |
| `unowned` | New Species Only | a species with no member in the Box, party, or pending queue |
| `shiny_only` | Variants Only | a variant-skinned target, owned or not |
| `unowned_or_shiny` | New or Variant | either of the above |
| `always` | Capture Anything | any capturable target, duplicates included |

Ordered narrow to broad, mirroring `TACTIC_ORDER`. `always` is the policy that deliberately farms the §4 Essence grant; `unowned` is the collection-completion policy and is the sensible default.

**`unowned` must not read `seenSpecies`.** That set tracks species *met*, which is what the auto-combat fog needs and the Monsterpedia displays. The capture predicate needs species *owned* — derived from `creatureBox`, the active party, and `pendingCaptures`. The two are easy to confuse because `seenSpecies` is already sitting there and would compile.

**The two variant policies are inert until variants exist.** Nothing in `src/` implements variants or shinies, and `creature-roster-and-generation.md:248` has them appearing in the wild only after a species has been bred. Ship `never` / `unowned` / `always` first; add the variant policies alongside the variant system. Monsterpedia variant tracking (listed as not-designed in that spec's §7) becomes a dependency at that point.

### 10.2 Where the policy lives

On `GameState`, persisted, like `battleSpeed` — not per-creature and not per-run.

Per-creature was considered and rejected. Tactics are per-creature because each creature *fights* differently; a capture policy expresses what the player wants out of the descent, not how a creature behaves. Per-creature would imply a designated-catcher role, which is complexity with no payoff.

It **persists across runs**, unlike `RunState.autoCombat`. It is a standing preference, and it is changed in town where the player can see it.

### 10.3 Architecture — a gate in front of the AI, not inside it

```ts
export type CaptureIntent = { target: CombatCreature; obols: number } | null;

export function captureIntent(
  actor: CombatCreature,
  foes: CombatCreature[],
  allies: CombatCreature[],
  policy: CapturePolicyId,
  ctx: {
    floor: number;
    obolsAvailable: number;
    obolReserve: number;
    ownedSpecies: ReadonlySet<string>;
  },
): CaptureIntent
```

Pure: no mutation, no RNG, same contract as `TacticsAI.chooseAction`. On an auto player turn `CombatScene` calls `captureIntent` first; a non-null result becomes the turn's action, and null falls through to `chooseAction` as today.

**Why not a new `CombatAction` variant inside `chooseAction`.** That function is deliberately side-agnostic — it takes only `(actor, allies, foes, profile, known)` and never knows which side it serves, which is what lets one module drive both parties. Capture is player-only and needs player-only state: the run's Obol balance, the Box contents, the policy. Threading that through would either force enemy-side nulls into the signature or leak player state into a module built not to have it. A separate gate keeps both modules clean and keeps `chooseAction`'s determinism guarantee intact.

### 10.4 The rule ladder

Explicit and ordered, in the same style as the tactic ladders — a player must be able to predict what it will do and explain a surprising action afterwards.

1. Policy is `never` → no capture.
2. Target's base price is `0` (uncapturable) → no capture.
3. Target does not match the policy predicate → no capture.
4. **Any ally is knocked out, or any ally is below one third HP** → no capture. Don't spend a turn shopping while the party is dying.
5. **More than one foe still alive** → no capture.
6. `obolsAvailable − listPrice(target) < obolReserve` → no capture.
7. Otherwise → bid exactly the list price for whichever band happens to be satisfied. AUTO never sets rites up deliberately, so that is usually the unsatisfied band.

**Rule 5 is the load-bearing one.** Restricting auto-capture to the last living foe means it fires at the natural end of a fight, when no other enemy gets a free turn out of it — and it composes with the existing rule that single-target attacks auto-target when one enemy remains. It also means the target has usually been worn down by then — though with HP capped at a 1.25× nudge that barely matters, which is the point: AUTO gets no discount worth having, because it never satisfies a rite.

**Rule 7: AUTO bids list price, never gambles.** Legibility beats cleverness — an AI that bids fractions on the player's behalf produces losses that can't be explained afterwards. If list price isn't affordable within the reserve, AUTO skips rather than taking a partial shot. Note that against an unstudied species AUTO is bidding blind at a price it cannot see, which is exactly the wasteful behaviour a player opts into when they set a broad policy.

`obolReserve` is a **player-set absolute floor, defaulting to zero** — surfaced beside the policy. Zero by default is deliberate: auto-capture is meant to cost you, and the reserve exists for players who want a guard rather than as a rail imposed on everyone.

---

## 12. Rite vocabulary — authored status and condition gaps

**Added 2026-07-27.** Family rites are authored for all eleven archetypes in the master spreadsheet (`Hollow Kins`, sheet `Kin`, column `Rite`). Signature rites are not yet written for any species.

Rites generalise by archetype and are available per species: creatures within an archetype share the family rite, and any individual creature may additionally carry a bespoke signature rite attuned to its own flavour. That is the §2 model unchanged — this section records what has actually been filled in.

### Family rites as authored

| Archetype | Family rite | `RiteCondition` | Status |
|---|---|---|---|
| Spirits | An enemy creature faints in combat | `ally_knocked_out` | **supported** |
| Flora | This creature is hit with a flame attack | `damage_type_taken` (Fire) | **supported** |
| Kami | This creature is hit with an electric attack | `damage_type_taken` (Electric) | **supported** |
| Slimes | This creature is hit with a physical attack | `damage_type_taken` (Fighting) | **supported** |
| Devils | Any creature receives a debuff | — | **needs new kind** |
| Food | An allied creature consumes food | — | **needs new kind** |
| Fauna | This creature is fed food | — | **needs new kind** |
| Rock | This creature hits an enemy with increased defense | — | **needs new kind** |
| Human | This enemy team contains a human creature | — | **needs new kind** |
| Mecha | Both a fire and electric attack are used this battle | — | **needs new kind** |
| Dragon | A fire attack is used twice in battle | — | **needs new kind** |

Four of eleven evaluate against the existing vocabulary. Seven do not.

### Condition kinds the authored rites require

Tracked here, not scheduled. None of this blocks authoring more rites — it blocks evaluating the ones already written.

| Needed | Why the existing vocabulary misses it | Wanted by |
|---|---|---|
| **Item consumed** — an item was used, optionally targeting a specific creature | No condition observes item use at all. `RiteLog` records damage types, statuses, turns and bids; nothing records consumption. Fauna needs it scoped to *this creature*, Food to *any ally*. | Food, Fauna |
| **Damage type dealt** (battle-wide) | `damageTypesTaken` records what the capture target *received*. These rites care about what was *used* in the battle, by either side. Different log field. | Mecha, Dragon |
| **Damage type count** | Follows from the above but needs a tally rather than a set — "twice" cannot be expressed by a membership check. | Dragon |
| **Struck enemy's stat stage** | `stat_stage_at_least` reads the capture target's own stages. Rock's rite reads the stages of a creature the target *hit*, which is not in scope at evaluation time. | Rock |
| **Party composition** | No condition inspects archetypes present on either side. | Human |
| **Debuff applied to anyone** | `status_applied` covers statuses; stat-stage debuffs are separate, and `stat_stage_at_most` is scoped to the target rather than "any creature". | Devils |

Two of these are cheap. `damage type dealt` and its counter are a second field on `RiteLog` written from the same place `damageTypesTaken` is. `party composition` is a read against state already in hand. The other three want new plumbing: item use has no hook, and the struck-enemy stage condition needs the evaluator to know what happened during the target's action rather than only its resulting state.

### Authoring inconsistency

`Hunger` (Spirits) reads *"An enemy creature faints in combat"* while `Grampskin` and `Little Light` read *"An **allied** enemy creature faints in combat."* Same archetype, so the family rite should read identically across all three. "Allied enemy" is also ambiguous — most likely an ally of the capture target, but it could be read the other way.

---

## 11. Explicitly rejected

- **Undisclosed pity rules.** Palworld suppresses the first capture failure at ≤30% HP or ≥50% rate; it makes the shake animation a dishonest readout and players noticed.
- **Hidden rates with no failure feedback** (Yo-kai Watch). A failed roll is indistinguishable from having done nothing; reviewers reported 49 of 200+ befriended after 30 hours.
- **A fixed per-species rate that ignores player investment** (Ni no Kuni). The canonical example of capture that responds to nothing the player does.
- **A permanently scarce guaranteed-capture item** (Master Ball). Players hoard it and it changes nothing. A reachable price does the same job without the trap.
