# Hollow Kin Combat Pitch 2 — Omen and Break

> **Summary:** Combat is divided into a **Command Phase** and a **Resolution Phase**. Enemies reveal their intentions before the player commits one action for each Kin. Dangerous actions display an **Omen** made from breakable move tags. The player plans the whole pack’s round, then watches actions resolve by SPD. Partially breaking an Omen weakens the threat; completely breaking it cancels the action and exposes the enemy to deterministic critical attacks. Moves learned and upgraded during the expedition expand the party’s ability to answer different Omens.

> **Status:** Competing design pitch, not a change to the GDD. Numbers and terminology are illustrative. “Move” is the player-facing term used here for the current Ability object.

## Why This Combat Loop Is Unique

Every dangerous enemy action becomes a short, readable puzzle for the entire pack.

The player is not asked to guess whether a boss will attack, buff or inflict a status. The boss announces the threat and the kinds of pressure that can dismantle it. The difficulty comes from deciding:

- whether the current party can fully stop it;
- which Kin must act before the enemy;
- how much persistent MP stopping it is worth;
- whether partial disruption is enough;
- and whether to save a powerful move for the Exposed window afterward.

Unlike a normal elemental weakness table, the Omen changes with the move being prepared. The same enemy can ask a different question each round. A locked expedition party is never made useless because all actions can contribute some pressure, while the correct move tags contribute more.

This pitch is closest to a deliberate triple battle: plan all three Kin together, commit, then see whether the plan survives the timeline.

## Design Pillars

1. **Enemy power is dangerous but legible.**
2. **The player plans a complete round rather than optimizing one isolated turn at a time.**
3. **Breaking is both offense and defense: it prevents harm and creates a damage window.**
4. **Partial success always matters, so the wrong party is disadvantaged rather than invalidated.**
5. **Move upgrades change which threats the pack can answer efficiently.**

## Turn Flow

### 1. Intent Phase

At the beginning of the round, enemies choose and reveal their actions. The interface displays:

- move name or category;
- target;
- expected timing on the SPD preview;
- damage, support or status intent;
- an Omen, if the move is chargeable and disruptable.

Ordinary attacks do not need Omens. Elites and bosses use them frequently; normal encounters use them sparingly to introduce the language without making every turn a lock puzzle.

### 2. Command Phase

The player assigns one action to every living Kin before anything resolves. Commands may be reviewed and changed until the player commits the round.

Each Kin still chooses from `FIGHT`, `MAGIC`, or `ITEM`:

- Basic Attack is a reliable zero-MP source of neutral pressure.
- Magic provides stronger, typed or specialized pressure at an expedition-level MP cost.
- Items use the acting Kin’s command slot unless the item explicitly has a free-action exception, as Smoke Husk does today.

The UI previews the expected resolution order. This makes SPD meaningful: a move that would perfectly break an Omen is not an answer if its user acts after the enemy.

### 3. Resolution Phase

All committed actions resolve in SPD order. A Kin whose target is defeated before its turn may retarget automatically under a clear rule; it does not reopen the entire Command Phase.

Enemy actions execute as declared unless their Omen has been weakened, broken, or their user has been knocked out or disabled.

### 4. Cleanup Phase

Statuses tick, expired effects clear, Broken enemies recover if their window has ended, and the next Intent Phase begins.

## The Omen Track

An Omen is a short row of pips attached to a dangerous enemy action. Pips communicate the kinds of moves that efficiently disrupt it.

Example:

> **Funeral Pyre — targets all Kin**  
> Omen: `[Fighting] [Ice] [Affliction]`

Move tags come mostly from data that already exists:

- damage type: Fighting, Electric, Wind, Fire, Ice or Ghost;
- category: Physical, Special or Status;
- effect: Buff, Debuff, Affliction, Heal or Recoil;
- authored specialist tags where necessary: Heavy, Precise, Multi-hit, Cleanse.

### How pips break

- A move matching a pip removes that pip.
- A stronger move or upgrade may remove more than one matching or neutral pip.
- A nonmatching damaging move still adds a small amount of neutral pressure.
- Basic Attack removes one neutral pip but does not efficiently answer specialized pips.
- Status and support moves can answer Affliction, Debuff, Cleanse or Aid pips where appropriate.

The encounter generator must never require a tag the party cannot possibly supply without offering partial disruption. Impossible full solutions are acceptable only when clearly intentional; meaningless commands are not.

### Partial disruption

Each pip removed before the enemy acts weakens the declared action. Depending on the action, this can reduce:

- damage;
- status chance or duration;
- number of targets;
- buff stages granted;
- healing or summoning strength.

This is the safety valve that makes every Kin useful. A party that lacks Ice can still survive Funeral Pyre by breaking its Fighting and Affliction pips.

### Full Break

If every Omen pip is removed before the enemy’s scheduled action:

1. the declared action is canceled;
2. the enemy becomes **Broken**;
3. the enemy remains **Exposed** through the following round;
4. its Omen track resets after the Exposed window.

Breaking an ordinary enemy’s neutral track can create the same Exposed state without canceling a special move. This allows the core rhythm to exist outside boss fights while keeping elaborate Omens special.

## Conditional Criticals and the Exposed Window

This pitch removes random player criticals. Critical damage is a deterministic payoff earned during an Exposed window.

Each offensive move has a critical condition. Examples:

- **Slash:** critical against an Exposed target if used before another damaging move this round.
- **Shadow Claw:** critical against an Exposed target suffering an affliction.
- **Inferno Strike:** critical if Fire was one of the pips broken.
- **Thrash:** critical if it is the third allied hit during the Exposed round.
- **Seismic Slam:** critical if the target’s DEF has been lowered.

Keen or formerly `highCrit` moves may critical against any Broken target without an additional condition. This preserves their identity while making the result predictable.

The best burst move is therefore not automatically the best Omen-breaking move. Players must decide which moves create the opening and which moves are preserved to exploit it.

## How Moves Enter and Grow During an Expedition

Each Kin begins with permanent move roots supplied by species, role, breeding and any future permanent unlocks. Temporary growth during the expedition specializes those roots for the threats being encountered.

Temporary level or Training choices offer:

1. **Learn** a role- or archetype-weighted move.
2. **Advance** an existing line, such as Bash → Smash → Thrash.
3. **Inscribe** one run-only Omen augment onto a move.

### Example move line

| Move | Combat growth | Break identity |
| --- | --- | --- |
| Bash | Cheap physical damage | Removes one Fighting or neutral pip |
| Smash | Higher damage | Removes two Fighting pips but resolves later |
| Thrash | Highest damage with recoil | Removes three pips from a Broken target’s next guard, but is primarily an Exposed-window finisher |

The line becomes more powerful without every version simply invalidating the previous tactical role. A fast Bash may still be the correct answer when Smash would resolve after the Omen.

Possible run-only augments include:

- **Swift:** move resolves earlier in the SPD preview.
- **Crushing:** removes an additional neutral pip.
- **Versatile:** may satisfy one alternate category pip.
- **Lingering:** pressure remains if the target begins a new Omen next round.
- **Punishing:** gains a stronger critical condition during Exposed.
- **Frugal:** refunds a small amount of MP after helping complete a Break. This is an outcome hook rather than an affordability discount, so manual and auto-combat always see the same move cost.

An augment follows a move when it advances. The four equipped move limit may remain; Kin fill and revise those four slots as the expedition develops.

Run-learned moves, advancements and inscriptions reset to the permanent starting loadout at expedition end unless a separate permanent system explicitly records them.

## Traits, Instincts, Marks, Relics and Afterform

- **Traits** permanently shape Omen performance: opening pressure, affinity with a move tag, SPD adjustments, resistance during unbroken attacks, or recovery after a Break.
- **Instincts** are proposed personal conditions such as “the first Debuff pip this Kin removes each round counts twice” or “gain MP when an ally completes the Omen you started.”
- **Timed boons** remain short-duration expedition modifiers and can include first-round pressure or post-victory recovery.
- **Relics** alter the expedition’s Break grammar: Ghost moves can answer Affliction, the first neutral pip is already cracked, or a full Break pays bonus Obols.
- **Marks** can record unusual deeds—breaking an Omen using three different Kin, surviving an unbroken major Omen, or completing a Break with Basic Attack—and unlock future moves, relics or Instincts. The pitch does not require one of the current competing Mark permanence models.
- **Afterform** belongs to the Exposed window. The Kin that completes a full Break may awaken if it has also satisfied its Instinct. Its Afterform changes how it exploits Broken enemies instead of simply adding stats.

Examples of Afterform rules:

- its first move against a Broken enemy costs no MP;
- its move tags count as two different tags;
- it extends Exposed by one allied action;
- its signature finisher carries no recoil when its condition is met.

## Overall Combat Loop

1. Read the enemies’ intentions and Omens.
2. Inspect the SPD preview and identify which answers will resolve in time.
3. Commit one action for every living Kin.
4. Resolve the plan and watch the party strip pips before the threat fires.
5. Accept a weakened attack, fully Break it, or spend additional MP to force the opening.
6. Use the Exposed round for deterministic conditional criticals and Afterform.
7. Let the enemy recover with a different Omen and solve a changed problem.
8. End the battle while preserving enough HP, MP and items for the rest of the descent.
9. Choose recovery, supplies, boons, currency or occasional move Training after the battle.

## Post-Battle and Expedition Integration

Training can enter the existing three-card reward offer as a rare sixth kind. Because it competes with healing, MP, Obols, items and timed boons, specializing the party carries a survival cost.

Training offers should be informed—but not dictated—by recent encounters. A party repeatedly encountering Fire Omens may see an Ice move or a Versatile augment at increased weight. The generator must still preserve uncertainty so the run does not simply hand out the exact counter to every boss.

The broader loop is:

> Expand the pack’s answer vocabulary → spend MP to dismantle dangerous Omens → use clean Breaks to preserve HP → decide between recovery and more answers → push toward bosses whose puzzles are more complex.

Capture has an especially strong hook in this pitch. A Broken target may receive a favorable capture-price nudge or satisfy one family rite. Capture still consumes a Kin’s command and the result remains cargo, not a reinforcement. This makes “create the safe capture window” part of combat without replacing the existing Obol bid and rite systems.

## Example Round

A boss reveals:

> **Grave Chorus — all-party Ghost damage and Sleep**  
> Resolves third on the timeline  
> Omen: `[Fighting] [Debuff] [Ice]`

The player commits:

1. Fast Cat uses Bash to remove Fighting.
2. Geta uses Scold to remove Debuff and lower the boss’s DEF.
3. Wiggledrake uses Freeze to remove Ice.

Resolution matters. If Wiggledrake is slower than the boss, the Ice answer arrives too late: Grave Chorus fires at reduced damage and reduced Sleep chance because two pips were removed. If the player previously found a Swift augment for Freeze, the third pip breaks in time, the attack is canceled, and the next round becomes an Exposed damage window.

The player understood every consequence before committing, but still had a difficult resource and build decision.

## Risks and Safeguards

| Risk | Safeguard |
| --- | --- |
| Every round becomes a slow planning puzzle | Reserve elaborate Omens for elites, bosses and selected normal enemies |
| The party lacks a required tag | Partial disruption always works; generate Omens against legal party capabilities |
| Breaking becomes a rote setup-burst loop | Change Omen recipes and timing; mix threats that punish saving every finisher |
| Players always spend MP to cancel everything | Tune partial disruption to be survivable and make MP conservation necessary across the descent |
| Resolution feels frustrating after committing | Show exact order, intent and legal retarget rules before confirmation |
| Auto-combat cannot plan all three actions | Plan the party as one search problem with a bounded candidate set; initially prioritize predicted survival over full Break |
| Omen icons become unreadable | Derive most tags from existing move data and keep authored specialist tags rare |

## Minimum Alpha Prototype

1. Add a Command Phase that selects all three allied actions before resolution.
2. Reveal enemy action, target and the SPD order.
3. Give one elite a three-pip Omen using existing damage type/category data.
4. Let Basic Attack remove one neutral pip and matching Magic remove one specialized pip.
5. Scale the enemy action down for each pip removed; cancel it on full Break.
6. Add one-round Exposed and three deterministic critical conditions.
7. Convert Bash, Smash and Thrash into distinct pressure profiles.
8. Test whether players sometimes deliberately accept a partial Break to save MP.

If full Break is always correct—or if the player cannot understand why the plan failed—the pitch needs revision.
