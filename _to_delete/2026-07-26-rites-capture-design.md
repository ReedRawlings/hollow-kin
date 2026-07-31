# Capture — The Rite System — Design Spec

**Date:** 2026-07-26
**Status:** Approved design direction (design discussion, 2026-07-26). Supersedes the *pricing model* of `2026-07-25-capture-system-design.md`; that spec's duplicate Essence grant, Box/pending-queue rules, arrival-as-cargo rule, and architecture split all carry forward unchanged.
**Scope:** How capture price is set, discovered, and paid. Rites (per-species capture conditions), band pricing, hidden prices and bid feedback, Monsterpedia study, in-battle display, and auto-combat interaction.

---

## Guiding Principle

**You fight differently, then pay.** Capture remains a price, never a slot machine — but the player's play during the fight is what sets the price. Anyone can buy any creature at the unsatisfied price; skilled, informed play earns the good deal. The Obols saved by working a rite flow straight into the existing spend-vs-bank economy: playing well during a capture literally banks permanent Essence.

This replaces the 07-25 model's two levers (spend more, lower HP) — which playtested as "just clicking a button" — with a third lever that is the interesting one.

Research grounding (genre survey, 2026-07-26 discussion): skill must buy *access or discount deterministically* (Persona 5 Hold Up, Aethermancer Stagger); residual RNG after the player has "solved" a capture is the genre's worst failure mode (World of Final Fantasy); cosmetic interactivity gets detected and resented (Ni no Kuni, Yo-kai Watch); hidden numbers are acceptable only when failure produces honest feedback; timing/reflex minigames clash with turn-based AUTO play (Nexomon).

---

## 1. Decisions locked

| Question | Decision |
|---|---|
| Core mechanic | Every capturable species has **Rites** — conditions that, if satisfied when the bid resolves, drop its price into a lower band. |
| Rite tiers | **Family rites**: broad, guessable from archetype/appearance (cold yields to fire, armour yields to broken DEF). **Signature rites**: bespoke and strange (bind it above 75% HP; bind it while one of yours is down). |
| Rite semantics | One predicate system. Every rite is a predicate over combat state; combat state includes a per-target **event log** (sticky flags). **Sticky** rites read the log ("has been hit by fire this fight"). **Volatile** rites read live state ("Burning is active right now"). |
| Difficulty ramp | Common species lean sticky; rare species lean volatile. Same vocabulary, harder tempo — "do it once, whenever" vs. "do it and close within the window." |
| Pricing | **Band replacement, not multipliers.** A satisfied rite replaces the price band outright: unsatisfied → high; family met → ordinary; signature met → near-nothing. |
| HP incentive | Reduced to a nudge: `hpMult = 1 + CAPTURE_HP_WEIGHT × (hpCurrent / hpMax)` with `CAPTURE_HP_WEIGHT = 0.25` (1× near death, 1.25× at full HP). Replaces the 07-25 spec's 3× Pokémon-derived curve. |
| Resolution | Unchanged: `chance = clamp01(bid / price)`, linear. Bid at or above the price = guaranteed capture. |
| Spend rule | **Obols committed are Obols gone — captured or not, excess included.** A player who overbids loses the excess. No refunds, ever, in any case. |
| Price visibility | **Hidden until studied.** Unstudied species show `???` for rites and price. Incentivizes experimentation. |
| Failure feedback | A failed bid returns a **graded qualitative reaction** (direction, never the number). Honest by construction: a failed bid was by definition under the price. |
| Studied definition | A species is **studied** once captured at least once. Studying reveals exact prices — the base bid cost and each rite price, listed separately. Until then the Monsterpedia shows the player's discovered bracket. |
| Rite discovery | A rite is recorded in the Monsterpedia when first satisfied (deliberately or by accident). The game announces accidental satisfaction in the combat log. |
| Auto-combat | AUTO never sets up rites and never gambles. It pays the current price for studied species or skips; it **skips unstudied species entirely** (it cannot price them). Both penalties are emergent — no special rules. |
| Uncapturable | Base band of 0 still means uncapturable (bosses, breed-only). Unchanged from 07-25. |

---

## 2. Rites

### 2.1 One predicate system

Do not build event-rites and state-rites as separate code paths. Every rite is a predicate over `CombatTargetState`, which includes:

- Live state: active statuses, stat stages, HP fraction, allies alive/KO'd on both sides, turn-order facts.
- A per-target **event log** of sticky flags set as combat events fire: `wasHitBy:<damageType>`, `wasCrit`, `wasDebuffed:<stat>`, `alliesKilledFirst`, `attackDefended`, `wasHealed`, …

A **sticky** rite template reads the log; a **volatile** template reads live state. The template declares which it is. One evaluation path, evaluated at the moment the bid resolves.

### 2.2 Family vs. signature

- **Family rites** hang off archetype-level tables — guessable on first encounter from what the creature looks like. This is a soft type chart, and it is deliberately confined to capture: the GDD's rejection of archetype rock-paper-scissors was about run-ruining *combat* matchups, and a capture-only chart cannot ruin a run. It gives archetypes identity in the one place RPS is safe.
- **Signature rites** are bespoke per species (or per species-group), drawn from a template pool (~10–15 templates), authored in the creature spreadsheet like all other data.

### 2.3 Escalation by rarity

The same family logic can appear in sticky form on common species and volatile form on rare ones — e.g. a low-level frost creature satisfies its rite if it was *ever* hit by a fire attack this fight; a rare frost creature must be *actively Burning* when the bid resolves. Late-game captures stay puzzles instead of feeling solved from level 1.

### 2.4 UI requirement — sticky vs. volatile must read differently

The danger of volatile rites is a player believing they've "done it" and then the window closes silently (burn expires; the KO'd ally is revived). If a satisfied rite can un-satisfy invisibly, the puzzle reads as a bug.

- Sticky rites render **checked and locked** once satisfied.
- Volatile rites render as **live indicators** — visibly on while true, visibly dark when the window closes.

---

## 3. Pricing

```
unsatisfiedPrice = base × depthMult(floor) × hpMult
familyPrice      = base × FAMILY_BAND × depthMult(floor) × hpMult
signaturePrice   = base × SIGNATURE_BAND × depthMult(floor)     // hpMult ignored — see below

hpMult    = 1 + CAPTURE_HP_WEIGHT × (hpCurrent / hpMax)         // CAPTURE_HP_WEIGHT = 0.25
depthMult = floor ^ CAPTURE_DEPTH_EXPONENT                      // still coupled to OBOL_REWARD_EXPONENT
```

- The applicable price is the **lowest band whose rite is currently satisfied**. Band replacement, not stacking — players reason in bands, not products.
- `CAPTURE_HP_WEIGHT` is a first-class playtest dial (named constant), not genre-inherited math. Zero is a legitimate setting — it fully decouples capture from weakening — but removing it also drains the strangeness from "bind it above 75% HP" signatures, so the two decisions are coupled.
- Signature prices ignore `hpMult`: part of a signature's identity is that the normal rules don't apply to a creature that wants to be caught on its own terms. (Open question whether `depthMult` should also be ignored — see §9.)
- The depth-exponent coupling rule from the 07-25 spec stands unchanged.

### 3.1 Resolution and the spend rule

`chance = clamp01(bid / price)`; at or above the price, guaranteed. Linear, so "half the price, half the chance" stays true and checkable.

**All Obols committed to a bid are consumed regardless of outcome, excess included.** One rule, no cases. With visible prices overbidding is only a misclick — but the rule does real work against **volatile rites**: bidding above the current price is deliberate insurance against the window closing between commitment and resolution (the burn expiring, the fallen ally being revived). That is a real decision and it is priced honestly.

A failed attempt also costs the acting creature's turn (unchanged from 07-25).

---

## 4. Knowledge — hidden prices, honest feedback

### 4.1 Unstudied species

Rites show as `???` chips; the price is hidden. First contact is about learning: guess the family rite from the creature's look, or probe with a cheap bid. A lowball bid is a legitimate scouting move — you are buying information.

### 4.2 Reaction bands

A failed bid returns a graded qualitative reaction — direction, never the number:

| Bid vs. hidden price | Reaction (flavor per family table) |
|---|---|
| Under half | "The creature is insulted by your offer." |
| Over half, under full | "The creature wavers, then turns away." |

Two to three bands maximum, wide and fuzzily worded — the moment players can decode exact numbers from message boundaries, you have published a stranger price list. The system is honest by construction: any failed bid was under the price, so the game never tells a player they did it right and fails them anyway.

Reaction lines hang off family-level tables — creatures get voices at the capture moment with no per-species writing cost. This is the cheap version of SMT-style negotiation flavor; full demand dialogue remains deferred (§8).

### 4.3 The Monsterpedia does the bookkeeping

The player accumulates bounds across runs. Do not make that a memory test:

- **Unstudied:** the species page records the discovered bracket — highest rejected bid and its reaction, lowest successful gamble if any, plus any rites satisfied so far.
- **Studied (captured once):** exact prices revealed and listed **separately** — the base bid cost and each rite band's price — alongside the recorded rites.

Recording the player's own discovered information is QoL, not a leak.

### 4.4 In-battle display

When the Capture action is selected, the panel shows:

- The **currently applicable price** (for studied species; `???` plus bracket-so-far for unstudied),
- The **rite chips beside it** with live satisfaction state (sticky checked/locked, volatile live/dark),

so the player sees *why* the number is what it is at the moment they commit. Prices update live as rite state changes and as the target takes damage (hpMult).

The combat log announces accidental rite satisfaction ("The Frostkin recoils from the flame — a rite is met"), which is how family rites become guessable in practice.

---

## 5. Auto-combat

No new rules — both behaviors are emergent:

1. AUTO never sets up rites and never gambles. For a studied target matching the capture policy it pays the current applicable price within the Obol reserve, or skips.
2. AUTO **skips unstudied species** — it cannot buy a guarantee it cannot price. Manual play is the discovery engine; AUTO is the harvester of solved species.

Note: Fight Wisely already targets known weaknesses, and family rites correlate with weaknesses — so AUTO will *incidentally* satisfy family rites fairly often and capture at family price. Acceptable, arguably charming; do not lean on "AUTO always pays the unsatisfied price" as a balance lever.

The 07-25 policy ladder (`never`/`unowned`/`always`, reserve floor, last-foe-standing rule) carries forward; rule 6's threshold check now reads the applicable band price, and a new rule slots in above it: *target species unstudied → no capture.*

---

## 6. Unchanged from the 07-25 spec

- **Duplicates:** Essence grant invested into the species line, depth-scaled, bounded by existing systems (§4 of 07-25).
- **Arrival state:** a capture is cargo — level 1, cannot be fielded, rides in inventory (§5).
- **Box capacity and pending-capture queue** (§6).
- **Architecture split:** `Capture.ts` pure (now: band computation, rite predicate evaluation, reaction band selection), `CombatScene` owns UI/RNG/turns, `GameState` owns Box/queue/policy (§7). New: the per-target event log lives in combat state; Monsterpedia study data (brackets, recorded rites, studied flag) persists on `GameState` (save version bump).
- **Failure costs the turn; Obols are consumed** (§3 — now extended by the excess-lost rule).
- **Uncapturable = base 0** (§1).

---

## 7. What this supersedes

- The 07-25 threshold formula's `hpMult` (`3·hpMax / (3·hpMax − 2·hpCurrent)`, 1×–3×) → replaced by the 1×–1.25× linear nudge.
- Price as a single continuous number moved only by spend and HP → replaced by rite-driven band pricing.
- "Display the number, live" as an unconditional rule → prices are hidden until studied; the display rule applies to studied species.

---

## 8. Explicitly rejected

- **Refunds of any kind, including partial refunds on blind attempts.** Obols surviving failure makes prices meaningless (07-25 finding, reaffirmed). The anti-rigged guardrail is honest directional feedback + Monsterpedia bookkeeping, not money back.
- **Revealing the exact price on failure.** Replaced by graded reactions — direction without the number, preserving the experimentation incentive.
- **Multiplier stacking for rites.** Bands replace; players reason in bands.
- **Timing/reflex minigames.** Clash with AUTO, battle speed, and accessibility (Nexomon fatigue).
- **Full negotiation dialogue (SMT-style demands).** Highest flavor, highest per-species writing cost. The reaction-line tables are the cheap version; demands can layer on later as event-floor flavor if wanted.
- **Separate code paths for event vs. state rites.** One predicate system over combat state + event log.

---

## 9. Open questions

1. **Band constants** — `FAMILY_BAND` and `SIGNATURE_BAND` values (discussion used "ordinary" and "near-nothing"; straw numbers ~0.5 and ~0.15). Tune against Obol income per floor.
2. **Does `depthMult` apply to the signature band?** Flat-across-floors makes deep signature captures dramatically cheap (the reward reading); depth-scaled keeps the ratio to Obol income flat (the economy reading). Straw position in §3 keeps depth; decide in playtest.
3. **Reaction band boundaries and count** — two bands or three, and where the cuts sit. Watch for players decoding numbers from boundaries.
4. **Rite template pool** — the concrete ~10–15 signature templates and per-archetype family tables, checked against the ability CSV and status list. Not yet drafted.
5. **`CAPTURE_HP_WEIGHT`** — 0.25 straw value; zero remains on the table (coupled to the fate of HP-band signature rites).
6. **Playtest risk (flagged 2026-07-26):** players may not want *every* capture to be a small puzzle. Sticky-heavy commons are the pressure valve — commons should feel nearly automatic once a family is learned. Verify in playtest.
7. **Carried forward from 07-25:** which line member receives the duplicate grant; `DUP_ESSENCE_BASE`; Box capacity pricing; the release mechanic; whether the capture policy persists across runs; the Obol reserve's form.
8. **Deferred idea (v2):** Monster Hunter Stories-style retreat — a creature that survives a failed bid flees 1–2 floors deeper and reappears as an encounter option at a discount, converting capture desire into descent pressure. Pick-next/procgen change; out of scope here.
