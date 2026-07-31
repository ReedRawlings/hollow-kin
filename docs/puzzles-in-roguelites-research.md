# Hollow Kin — Research: Puzzles Inside Roguelites

*Research document, gathered 2026-07-29. Reference material, not a decision.*

> **Why this exists.** An earlier draft of `run-texture.md` §2.1 asserted that games attempting hand-authored puzzles in a roguelite end up with either "a novelty dead after one evening" or "generated puzzles that are all the same puzzle with different numbers." That claim was unsourced and it is **wrong in both specifics.** This document is the corrected record.

---

## Verdict

The conflict between authored puzzles and run-based replay is real. Neither of the failure modes originally named is the one that actually occurs.

**"Dead after one evening" is falsified.** *Blue Prince* (2025) is a roguelite made almost entirely of hand-authored puzzles. It hit **92 on Metacritic — the highest-rated game of 2025 at launch** ([Kotaku](https://kotaku.com/blue-prince-metacritic-game-pass-ps-plus-switch-1851775306)) and passed **2 million players by September 2025** ([VGChartz / Raw Fury](https://www.vgchartz.com/article/465765/blue-prince-tops-2-million-players/)), at 15–25 hours to credits and roughly double that for full content. *Spelunky*'s hand-authored Hell chain sustained hundreds of hours per player and a decade of speedrun categories.

**"Generated puzzles are all the same puzzle" is too strong.** Into the Breach is hundreds of hours of generated, non-repetitive puzzles. The real dividing line is not authored-versus-generated.

The two failure modes that *are* documented are below, and one of them is the direct opposite of what the original claim predicted.

---

## Failure mode 1 — Solution-lookup collapse

When a puzzle's answer is a **global constant**, the puzzle is consumed once *per community*, not once per player. It does not die; it degrades into a completion checklist.

* **Blue Prince.** Safe codes are identical in every save file for every player, which is why dozens of "All Safe Codes" guides exist ([GameSpot](https://www.gamespot.com/gallery/blue-prince-safes-office-boudoir-drafting-room-study/2900-6440/)). A ScreenRant op-ed makes the argument directly: *"Whenever you come across the Drawing Room, the Office, or the Boudoir, the safe code is the exact same every time, which cuts down on the problem-solving discovery aspect"* — and proposes per-save randomised solutions as an unlockable mode ([ScreenRant](https://screenrant.com/blue-prince-too-easy-randomized-better-op-ed/)).
* **Noita's orbs and 33/34-orb endings.** Routed once by the community, then executed by rote ever after ([Noita Wiki — Advanced Guide: 34 Orb Ending](https://noita.wiki.gg/wiki/Advanced_Guide:_34_Orb_Ending)).
* **Fez** — the canonical precedent, and not a roguelite. The Black Monolith was cracked in **18 hours across 66,227 crowdsourced attempts**, by brute force rather than deduction. Kotaku: *"the fact that no one had been able to discern the hidden logic behind how to solve the puzzle without brute forcing it made the entire affair feel incomplete"* ([Kotaku](https://kotaku.com/a-look-back-at-fezs-unsolvable-black-monolith-puzzle-1794358854)).
* **Animal Well.** Billy Basso on his tiered secrets: *"they have been solving them way faster than I was expecting"* ([DualShockers](https://www.dualshockers.com/animal-wells-collaborative-puzzle-solving-helped-community-form-bonds-and-friendships/)).
* **Enter the Gungeon — the clever half-fix.** The Resourceful Rat's Lair maze route *"does not change on future runs, and can be memorised"* — **but** *"the route through the maze is different for every installation of Enter the Gungeon."* Dodge Roll deliberately per-install-randomised the answer to defeat wiki lookup ([Gungeon Wiki](https://enterthegungeon.wiki.gg/wiki/Resourceful_Rat's_Lair)).

**Note the scale of the effect, though.** Blue Prince sold through 2 million players *with* globally-constant answers. Lookup collapse degrades a puzzle's value; it does not destroy the product.

---

## Failure mode 2 — Knowledge/access desync

This is the one that matters most for Hollow Kin, and it is the **inverse** of the intuitive worry. The fear is that accumulated knowledge trivialises later runs. What actually happens in Blue Prince is that the player has the knowledge and **the run generation will not give them the opportunity to use it.**

* **Mark Brown (GMTK)** gives the cleanest formulation — *"you've got A, but your house doesn't have a B"* — and notes *"testing each one of those theories is reliant on a specific combination of rooms popping up,"* with waits measured in hours. His conclusion is the load-bearing datum: *"I've gotten to room 46 and enjoyed that experience, but I don't really want to delve into the massive end game simply because I know that will mean hours and hours of time just spent wrangling with RNG."* ([GMTK](https://gmtk.substack.com/p/blue-prince-can-a-random-puzzle-game))
* **Spectre Collie** names the phase transition exactly. Early on the randomness is *protective* — *"the fact that the game resets at the end of each in-game day means (paradoxically) that you're never losing progress or getting completely stuck"* — but *"the longer you play, the more likely it is that you know exactly what you want to accomplish, but the game simply prevents you from being able to do it until you have an unusually lucky run."* ([Spectre Collie](https://spectrecollie.com/2025/05/11/more-blue-prince-or-home-on-the-rng/))
* **AV Club** abandoned the game over the interleaving: *"half the time I feel like I'm doing a fascinating escape room, only to be suddenly forced to switch over to a Sudoku, or maybe some jumping jacks, in order to get back to the thing that's actually got me excited to play"* ([AV Club](https://www.avclub.com/game-theory-blue-prince-review)).
* **Player discourse:** *"how many more runs do I want to do praying to 'RNGesus'?"* / *"The game just won't grant [me] the privilege to play the game sometimes."* ([ScreenRant](https://screenrant.com/blue-prince-rng-reactions/)); a long-running Steam thread titled "Dear Devs: Too Random for Enjoyment" ([Steam](https://steamcommunity.com/app/1569580/discussions/0/819206023683301183/)).
* **The developer's own mitigation.** Tonda Ros states variance is *"baked into the very foundation of Blue Prince"* and, importantly, that **"no individual puzzle is necessary to reach the ending"** ([Thinky Games interview](https://thinkygames.com/features/interview-how-myst-riven-and-tabletop-games-built-the-foundation-of-blue-prince/)). The post-launch accessibility patch tuned draft weighting rather than adding an RNG bypass ([patch notes](https://nintendoeverything.com/blue-prince-accessibility-update-out-now-patch-notes-new-features-included/)).

**The critical property:** desync gets *worse* the more the player knows, because the constraint migrates from cognition to luck.

---

## The mechanism that works: author the form, derive the answer from run state

Every durable case in the record does the same thing. This is the strongest finding in the research.

* **NetHack (1987).** Item appearances are randomised per game, so identity must be re-deduced every run. Price identification is a real deduction procedure — sell to a shopkeeper, read the quote, cross-reference base-price tables adjusted for charisma, narrow candidates, test contextually ([NetHack Wiki — Price identification](https://nethackwiki.com/wiki/Price_identification)). Authored deduction system, per-run randomised answer key. It has survived forty years of wikis, spoiler files and bots.
* **Caves of Qud.** Each playthrough generates five procedural sultans with 10–22 procedurally composed life events, and the lore *is* the key to authored secrets: gospel accounts in the world differ from tomb inscriptions, and the generator **guarantees coverage** — *"at least one event takes place in each of those regions during the sultan's history… to ensure that, if there is a historic site associated with one of those regions, there will always be at least one piece of sultan history lore that can reveal the secret of that region"* ([Qud Wiki](https://wiki.cavesofqud.com/wiki/Sultan_histories)). Note that coverage guarantee — it is a deliberate anti-desync rule. Bucklew's stated reason for the hybrid: *"we could play our own game without the experience being a mere review of a bunch of hand-crafted content"* ([Game Developer](https://www.gamedeveloper.com/design/tapping-into-the-potential-of-procedural-generation-in-caves-of-qud)).
* **Noita's per-seed alchemy.** Alchemic Precursor and Lively Concoction are *"generated from three randomly selected powders and liquids"* per world seed; the wiki notes they are *"more likely discovered by pure chance"* than deduced ([Noita Wiki — Alchemy](https://noita.wiki.gg/wiki/Alchemy)). Caveat: the community defeated this out-of-band with seed calculators, so the puzzle survived spoiling only because players had to opt out of the game to spoil it.
* **Enter the Gungeon's per-install maze** (above) — the cheapest version of the same idea.
* **Noita's Eye Messages** are the extreme counter-datum to "authored puzzles die": nine glyph messages, **unsolved for over five years**, with the community decompiling the binary in Ghidra to confirm no in-game trigger exists and establishing the cipher is polyalphabetic. The developers have confirmed a real message exists ([Unsolved Puzzles](https://unsolved-puzzles.github.io/unsolved-puzzles/noita/eye-puzzle.html), [Noita Wiki](https://noita.wiki.gg/wiki/Eye_Messages)).

**The second working pattern — free knowledge, randomised execution.** *Spelunky*'s Hell chain (Ankh → Hedjet → Book of the Dead → Crown → Hell) is arbitrary, undiscoverable by reasoning, and identical every run. The knowledge is one wiki page. What never repeats is the *terrain you must execute it on*. Tom Francis: *"It only took 41 minutes, but it took me hundreds of hours of play – and about 3,000 deaths – to learn how to do those 41 minutes."* And on the social half: *"until you make it all the way through, part of it is still legend, and that's tantalising"* ([Pentadact](https://www.pentadact.com/2013-11-04-to-hell-and-back-in-spelunky/)). Dedicated leaderboard categories persist ([MossRanking](https://mossranking.com/cat.php?cat=3)).

---

## The cautionary miniature: Slay the Spire's "Match and Keep!"

A memory-match event — twelve shuffled cards, five attempts, matched pairs forcibly added to the deck. It is trivially defeatable: *"players can simply match the same two cards repeatedly across all five attempts without adding any cards to their deck."* It was later made seeded for consistency ([StS Wiki](https://slay-the-spire.fandom.com/wiki/Match_and_Keep)); a mod exists to improve it.

This is the best small example of authored-minigame decay: **a shallow authored puzzle with no run-state input becomes a solved ritual within a handful of encounters.** Contrast the rest of Slay the Spire, whose *combats* are puzzles assembled from run state and hold up over thousands of hours.

---

## The procedural side — where "all the same puzzle" is and isn't true

* **Kate Compton's "10,000 Bowls of Oatmeal."** *"I can easily generate 10,000 bowls of plain oatmeal… mathematically speaking they will all be completely unique. But the user will likely just see a lot of oatmeal."* She separates **perceptual differentiation** (this isn't the same as the last one — often sufficient) from **perceptual uniqueness** (*"the difference between an actor being a face in a crowd scene and a character that is memorable"*) ([Compton](https://galaxykate0.tumblr.com/post/139774965871/so-you-want-to-build-a-generator), [PDF mirror](https://ems.andrew.cmu.edu/2018_60212f/wp-content/uploads/2018/09/kate-compton-oatmeal.pdf)). **Caveat: this is about perceived variety in general, not puzzles specifically.** Applying it to puzzles is an extension of her argument, not a citation of it.
* **"Baba is Y'all"** (Charity, Khalifa, Togelius) is the sharpest academic version. The generator *"optimizes towards efficiency and minimalist levels, therefore ignoring the subjective aspect of a level's quality"*; its solver cannot solve levels with long solutions; the authors refused pure generation because it would *"result in… levels that are either impossible to solve or are solvable but not subjectively 'good'"*; and the fitness function actively **strips the decorative tiles humans add for thematic reasons** ([arXiv 2003.14294](https://arxiv.org/pdf/2003.14294)). That last detail is the crux: the objective function deletes exactly the properties that make a puzzle feel authored. *(Correction to a common assumption: Baba Is You shipped a hand-made **level editor**, not a procedural generator — [Hempuli devlog](https://hempuli.itch.io/baba-is-you-level-editor-beta/devlog/315103/official-level-editor-releasing-on-november-17th).)*
* **A shipped generator, honestly postmortem'd.** Juho Snellman built solver, generator and optimiser, with the solver imitating layered human deduction. Players called the puzzles clever, but the dominant complaint was *"not enough of a difficulty gradient,"* and naive generation produced *"too many obvious moves right at the start… the solution tree is quite shallow"* ([snellman.net](https://www.snellman.net/blog/archive/2019-05-14-procedural-puzzle-generator/)). Best single source for *why* generated puzzles trend toward sameness: shallow, uniform solution trees are the default attractor unless fought explicitly.
* **Into the Breach — the refutation.** Deliberate puzzle generator: perfect information (*"enemies always broadcast the exact move they are going to perform next turn"*), no hit chance, small discrete action space, and each board composed from run state — *"the player's mech abilities, placement, the location of key objectives, Vek health abilities, the map itself."* Subset's framing: *"It's very fair to say that Into the Breach is a puzzle game wrapped up in a strategy game"* ([Blog of Arcane Secrets](https://blogofarcanesecrets.wordpress.com/2018/03/09/into-the-breach-and-dynamic-puzzles/)).
* **Not a counterexample:** Zachlikes / Opus Magnum. Those are open-ended optimisation over *authored, static* goals. The replay value is in the solution space, not in generated problems.
* Canonical survey for the field: De Kegel & Haahr, *Procedural Puzzle Generation: A Survey*, IEEE ToG ([IEEE](https://ieeexplore.ieee.org/document/8718565/)); their follow-up on narrative puzzles exists precisely because that subproblem is open ([Springer](https://link.springer.com/chapter/10.1007/978-3-030-33894-7_25)).

**The accurate dividing line:** generation works for puzzles whose difficulty is **combinatorial** and machine-verifiable (Sudoku, Nonograms, Sokoban, tactical positions). It fails for puzzles whose difficulty is **insight** — a single unstated rule the player must intuit — because that rule *is* authored content, and generating a new rule means generating a new game.

---

## The knowledge-gate literature

There is now a named genre — **"metroidbrainia"** — covering games gated only by what is in the player's head: Outer Wilds, Tunic, The Witness, Animal Well, and Blue Prince ([Thinky Games](https://thinkygames.com/features/metroidbrainia-an-in-depth-exploration-of-knowledge-gated-games/); academic genre analysis at [ResearchGate](https://www.researchgate.net/publication/397024365_Metroidbrainia_A_Genre_Analysis_of_Knowledge-Based_Exploration_Games)).

**Negative finding, stated plainly:** that literature does not engage the "playable only once" problem as a problem. It treats single-playthrough-ness as a property of the form. No substantial body of dev or critical writing on deliberately making insight puzzles replayable was found. The nearest real attempts are all engineering rather than criticism, and all use the same trick — **randomise the answer, not the question.**

---

## Games checked with no usable evidence

Stated so they are not cited by mistake: **Dead Cells** (rune gates are unlock gates; Lore Rooms are static vignettes — no puzzle content), **The Binding of Isaac** (secret rooms are authored *rooms* placed by generation rules, located by adjacency heuristics; "secrets" are unlock-condition trivia, not puzzles), **Cult of the Lamb** (secret rooms are collectible caches), **Void Bastards / Tangledeep / Siralim / Dredge** (no documented authored puzzle content or reception discourse found). **Crypt of the NecroDancer**'s Deep Blues is a per-encounter tactical puzzle rather than knowledge-gating, and holds up for the same reason Into the Breach does. **Lorelei and the Laser Eyes** is a control case, not a counterexample — an acclaimed authored puzzle box that is unambiguously a one-playthrough game.

---

## The corrected claim

> Hand-authored puzzles do not conflict with roguelite **replay**. They conflict with roguelite **pacing** and with the roguelite **knowledge economy**.
>
> 1. **Solution-lookup collapse, not novelty death.** A globally-constant answer is consumed once per community, not once per player, and survives as a completion checklist. Games that dodge it randomise the answer per run, per seed, or per install.
> 2. **Knowledge/access desync — the opposite of the intuitive worry.** Knowledge does not trivialise later runs; run generation withholds the chance to apply it, and this gets worse the more the player knows.
> 3. **The generated-versus-authored axis is the wrong axis.** Combinatorial difficulty generates fine. Insight difficulty does not.
> 4. **The mechanism that empirically works** is neither authoring puzzles nor generating them. It is **authoring the puzzle's form and deriving its answer from run state** — build, bestiary, seed, or generated lore. Every durable case in the record does this. The second working pattern is Spelunky's: make the knowledge free and randomise the execution.
