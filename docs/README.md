# Hollow Kin — Documentation Map

Start with `CLAUDE.md` at the repo root: it is the agent entry point and the audited account of what is actually built. This file only says where everything else lives and how much to trust it.

## Precedence

**code → CLAUDE.md → docs/design → docs/decisions → docs/archive. Anything lower that disagrees with anything higher is wrong, not a ranking to apply.**

A disagreement between two levels is a bug in the lower one. Fix it there; do not resolve it by picking which to believe.

## Folders

### `docs/design/` — live design, the only place a rule lives
`docs/design/game-design-document.md` is the design source of truth. The eleven topic docs each **own their own subject** and carry a header saying what they own, what they defer to the GDD on, and when they were last verified against `src/`. `docs/design/Abilities.csv` is the ability master table. If a rule is not here (or in `CLAUDE.md`), it is not a rule.

### `docs/decisions/` — dated decision specs, read-only
Formerly `docs/superpowers/specs/`. Each is a **point-in-time record** of how a decision was reached, including the alternatives rejected. They are history, not authority: when one disagrees with the GDD, the GDD is what gets fixed. The GDD keeps an index of every spec and what it decided. Do not edit a spec to keep it current — write a new one.

### `docs/archive/` — never authoritative
- `plans/` — executed implementation plans (formerly `docs/superpowers/plans/`). Useful for *why* a module is shaped the way it is; where a plan and the code disagree, the code wins.
- `pitches/` — the three combat-depth pitches and `docs/archive/pitches/expedition-items-pitch.md`. Proposals; some shipped in changed form, some were cut.
- `research/` — raw research notes and surveys. Background reading only.
- `retired/` — cut systems (`docs/archive/retired/breeding-stones.md`), kept so the reasoning is not lost. Nothing depends on them.
- `design-handoff-tower-screens/` — a visual design handoff for the tower screens.

### `docs/dev/` — developer tooling
`docs/dev/battle-chamber.md` (the combat dev lab), `docs/dev/phaser-editor.md` (editor setup and workflow), `docs/dev/level-calculator.xlsx` (in-run level model). Tooling notes, not game design.

## The four kinds of document

| Kind | Lives in | Trust |
|------|----------|-------|
| Live design | `docs/design/` | Current. Owns its subject. Fix it when the code moves |
| Dated decision | `docs/decisions/` | Correct on the day it was written. Read-only afterwards |
| Executed plan | `docs/archive/plans/` | Explains why; the code says what |
| Raw research | `docs/archive/research/` | Background only. Nothing in it is a rule |

## Elsewhere

- `progress.md` (repo root) is the running decision log — dated entries recording what was decided and shipped, newest at the bottom of each day's section. Read it for the recent past; the design docs for the present.
- `.superpowers/` is gitignored subagent scratch. Nothing in it is a deliverable and nothing should link to it.
- Playtest captures under `output/` and `test-actions/` are gitignored too.
