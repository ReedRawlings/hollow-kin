import { Ability } from '../types';

export const ABILITIES: Record<string, Ability> = {
  basic_attack: {
    id: 'basic_attack', name: 'Basic Attack', damageType: 'Iron', power: 20, accuracy: 100,
    category: 'Physical', mpCost: 0, targeting: 'single_enemy',
    description: 'A modest physical attack that costs no move resource.',
  },
  // --- Iron ---
  jab: {
    id: 'jab', name: 'Jab', damageType: 'Iron', power: 30, accuracy: 100,
    category: 'Physical', mpCost: 2, targeting: 'single_enemy',
    description: 'A quick, reliable punch.',
  },
  smash: {
    id: 'smash', name: 'Smash', damageType: 'Iron', power: 50, accuracy: 100,
    category: 'Physical', mpCost: 4, targeting: 'single_enemy',
    description: 'A solid strike.',
  },
  thrash: {
    id: 'thrash', name: 'Thrash', damageType: 'Iron', power: 75, accuracy: 100,
    category: 'Physical', mpCost: 5, targeting: 'single_enemy',
    description: 'A wild thrashing attack that damages the user slightly.',
    effects: [{ type: 'recoil', value: 0.1 }],
  },
  slash: {
    id: 'slash', name: 'Keening', damageType: 'Breath', power: 45, accuracy: 100,
    category: 'Physical', mpCost: 3, targeting: 'single_enemy',
    description: 'Keen. Critical against a debuffed target.',
    critCondition: 'target_debuffed', keen: true,
  },
  cross_counter: {
    id: 'cross_counter', name: 'Cross Counter', damageType: 'Iron', power: 60, accuracy: 100,
    category: 'Physical', mpCost: 5, targeting: 'single_enemy',
    description: 'A powerful counter-punch.',
  },
  seismic_slam: {
    id: 'seismic_slam', name: 'Seismic Slam', damageType: 'Iron', power: 70, accuracy: 90,
    category: 'Physical', mpCost: 5, targeting: 'single_enemy',
    description: 'A heavy strike that shakes the ground. May lower Defense.',
    effects: [{ type: 'debuff', stat: 'def', stages: -1, chance: 0.3 }],
  },
  razor_wind: {
    id: 'razor_wind', name: 'Hollowing', damageType: 'Breath', power: 70, accuracy: 95,
    category: 'Physical', mpCost: 6, targeting: 'single_enemy',
    description: 'Keen. Critical against a target below half HP.',
    critCondition: 'target_below_half', keen: true,
  },
  // --- Bell ---
  crackle: {
    id: 'crackle', name: 'Chime', damageType: 'Bell', power: 35, accuracy: 100,
    category: 'Special', mpCost: 2, targeting: 'single_enemy',
    description: 'A single clear note, close to the ear.',
  },
  spark: {
    id: 'spark', name: 'Toll', damageType: 'Bell', power: 40, accuracy: 100,
    category: 'Special', mpCost: 3, targeting: 'single_enemy',
    description: 'One strike of the bell, felt more than heard.',
  },
  discharge: {
    id: 'discharge', name: 'Peal', damageType: 'Bell', power: 70, accuracy: 100,
    category: 'Special', mpCost: 7, targeting: 'all_enemies',
    description: 'The full ring, and nothing nearby is spared.',
    effects: [{ type: 'status', status: 'stun', chance: 0.1 }],
  },
  // --- Breath ---
  gust: {
    id: 'gust', name: 'Exhale', damageType: 'Breath', power: 40, accuracy: 100,
    category: 'Special', mpCost: 3, targeting: 'single_enemy',
    description: 'A breath let out against the target.',
  },
  gale: {
    id: 'gale', name: 'Last Breath', damageType: 'Breath', power: 60, accuracy: 100,
    category: 'Special', mpCost: 5, targeting: 'single_enemy',
    description: 'The long breath that empties something out.',
  },
  // --- Ash ---
  ember: {
    id: 'ember', name: 'Ashfall', damageType: 'Ash', power: 40, accuracy: 100,
    category: 'Special', mpCost: 2, targeting: 'single_enemy',
    description: 'A fine grey fall, still hot where it lands.',
  },
  smolder: {
    id: 'smolder', name: 'Pyrewood', damageType: 'Ash', power: 55, accuracy: 100,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'Wood that remembers being a fire. May burn.',
    effects: [{ type: 'status', status: 'burn', chance: 0.3 }],
  },
  inferno_strike: {
    id: 'inferno_strike', name: 'Bonefire', damageType: 'Ash', power: 70, accuracy: 85,
    category: 'Physical', mpCost: 6, targeting: 'single_enemy',
    description: 'The old fire, built of what was left. May burn.',
    effects: [{ type: 'status', status: 'burn', chance: 0.3 }],
  },
  // --- Salt ---
  chill: {
    id: 'chill', name: 'Saltline', damageType: 'Salt', power: 40, accuracy: 100,
    category: 'Special', mpCost: 2, targeting: 'single_enemy',
    description: 'A line laid down that is difficult to cross. May lower Speed.',
    effects: [{ type: 'debuff', stat: 'spd', stages: -1, chance: 0.2 }],
  },
  frost: {
    id: 'frost', name: 'Rime', damageType: 'Salt', power: 35, accuracy: 90,
    category: 'Physical', mpCost: 2, targeting: 'single_enemy',
    description: 'A strike that leaves a white crust behind. May freeze.',
    effects: [{ type: 'status', status: 'freeze', chance: 0.1 }],
  },
  freeze: {
    id: 'freeze', name: 'Brinelock', damageType: 'Salt', power: 55, accuracy: 100,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'Preserved mid-motion. May freeze.',
    effects: [{ type: 'status', status: 'freeze', chance: 0.15 }],
  },
  // --- Mirror ---
  phantom: {
    id: 'phantom', name: 'Reflection', damageType: 'Mirror', power: 35, accuracy: 100,
    category: 'Special', mpCost: 2, targeting: 'single_enemy',
    description: 'Something looks back out of the glass.',
  },
  shadow_claw: {
    id: 'shadow_claw', name: 'Silvered Edge', damageType: 'Mirror', power: 40, accuracy: 100,
    category: 'Physical', mpCost: 3, targeting: 'single_enemy',
    description: 'Keen. Critical against a target with a status condition.',
    critCondition: 'target_statused', keen: true,
  },
  spook: {
    id: 'spook', name: 'Unreflected', damageType: 'Mirror', power: 65, accuracy: 95,
    category: 'Special', mpCost: 5, targeting: 'single_enemy',
    description: 'It casts nothing, and comes anyway.',
  },
  // --- Bane ---
  // Bane trades burst for inevitability: Nightshade is the weakest damaging move in the
  // game and carries the highest status chance anywhere. That inversion is the ward.
  nightshade: {
    id: 'nightshade', name: 'Nightshade', damageType: 'Bane', power: 30, accuracy: 100,
    category: 'Special', mpCost: 2, targeting: 'single_enemy',
    description: 'A dose of something that was never food. Likely to poison.',
    effects: [{ type: 'status', status: 'poison', chance: 0.5 }],
  },
  wormwood: {
    id: 'wormwood', name: 'Wormwood', damageType: 'Bane', power: 50, accuracy: 95,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'Bitterness that settles in and stays. May poison.',
    effects: [{ type: 'status', status: 'poison', chance: 0.35 }],
  },
  cankerbite: {
    id: 'cankerbite', name: 'Cankerbite', damageType: 'Bane', power: 70, accuracy: 90,
    category: 'Physical', mpCost: 6, targeting: 'single_enemy',
    description: 'A bite that goes bad long after it closes. May poison.',
    effects: [{ type: 'status', status: 'poison', chance: 0.25 }],
  },
  // --- Rust ---
  // The counter to Iron. Rust does not kill the thing, it makes the thing killable —
  // so its low tier is worth casting for the debuff alone.
  tarnish: {
    id: 'tarnish', name: 'Tarnish', damageType: 'Rust', power: 35, accuracy: 100,
    category: 'Special', mpCost: 2, targeting: 'single_enemy',
    description: 'A dull bloom spreads across the plating. Often lowers Defense.',
    effects: [{ type: 'debuff', stat: 'def', stages: -1, chance: 0.5 }],
  },
  corrode: {
    id: 'corrode', name: 'Corrode', damageType: 'Rust', power: 55, accuracy: 100,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'Metal gives up being metal. May lower Defense.',
    effects: [{ type: 'debuff', stat: 'def', stages: -1, chance: 0.4 }],
  },
  seize: {
    id: 'seize', name: 'Seize', damageType: 'Rust', power: 70, accuracy: 90,
    category: 'Physical', mpCost: 6, targeting: 'single_enemy',
    description: 'The joints stop agreeing to be a thing. May stun.',
    effects: [{ type: 'status', status: 'stun', chance: 0.2 }],
  },
  // --- Honey ---
  // Honey binds rather than breaks. Amber's two-stage slow exists nowhere else, which is
  // what gives Honey a reason to be picked over Salt.
  cloy: {
    id: 'cloy', name: 'Cloy', damageType: 'Honey', power: 35, accuracy: 100,
    category: 'Special', mpCost: 2, targeting: 'single_enemy',
    description: 'Thick, sweet, and hard to move through. Often lowers Speed.',
    effects: [{ type: 'debuff', stat: 'spd', stages: -1, chance: 0.5 }],
  },
  // Physical counterpart to cloy. Every ward needs a low-tier move in BOTH categories,
  // or the archetypes that carry it cannot serve both STR and INT roles — Salt already
  // works this way (frost Physical 35 / chill Special 40).
  combfall: {
    id: 'combfall', name: 'Combfall', damageType: 'Honey', power: 40, accuracy: 100,
    category: 'Physical', mpCost: 2, targeting: 'single_enemy',
    description: 'The comb breaks and everything in it comes down. May lower Speed.',
    effects: [{ type: 'debuff', stat: 'spd', stages: -1, chance: 0.3 }],
  },
  amber: {
    id: 'amber', name: 'Amber', damageType: 'Honey', power: 55, accuracy: 95,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'Whatever it catches, it keeps. May sharply lower Speed.',
    effects: [{ type: 'debuff', stat: 'spd', stages: -2, chance: 0.3 }],
  },
  surfeit: {
    id: 'surfeit', name: 'Surfeit', damageType: 'Honey', power: 60, accuracy: 95,
    category: 'Special', mpCost: 5, targeting: 'single_enemy',
    description: 'Too much of a good thing. May put the target to sleep.',
    effects: [{ type: 'status', status: 'sleep', chance: 0.2 }],
  },
  // --- Thorn ---
  // Thorn wants to be multi-hit; the engine has no multi-hit, so it lands as keen crits
  // plus the briar-sleep. Blackthorn mirrors shadow_claw's pattern, keyed to debuffs, so
  // Thorn pairs with Honey and Rust rather than with Ash's burn.
  bramble: {
    id: 'bramble', name: 'Bramble', damageType: 'Thorn', power: 40, accuracy: 100,
    category: 'Physical', mpCost: 2, targeting: 'single_enemy',
    description: 'Catches, and does not let go. May lower Speed.',
    effects: [{ type: 'debuff', stat: 'spd', stages: -1, chance: 0.3 }],
  },
  // Special counterpart to bramble — see the note on combfall. Flora is all Mages in
  // alpha, so without this the archetype's own ward reads off the wrong stat.
  thicket: {
    id: 'thicket', name: 'Thicket', damageType: 'Thorn', power: 40, accuracy: 100,
    category: 'Special', mpCost: 2, targeting: 'single_enemy',
    description: 'The growth closes in from every side. May lower Speed.',
    effects: [{ type: 'debuff', stat: 'spd', stages: -1, chance: 0.3 }],
  },
  blackthorn: {
    id: 'blackthorn', name: 'Blackthorn', damageType: 'Thorn', power: 45, accuracy: 95,
    category: 'Physical', mpCost: 3, targeting: 'single_enemy',
    description: "The witch's wood. Keen. Critical against a debuffed target.",
    critCondition: 'target_debuffed', keen: true,
  },
  briarfall: {
    id: 'briarfall', name: 'Briarfall', damageType: 'Thorn', power: 60, accuracy: 95,
    category: 'Special', mpCost: 5, targeting: 'single_enemy',
    description: 'The hedge closes over a hundred years. May put the target to sleep.',
    effects: [{ type: 'status', status: 'sleep', chance: 0.25 }],
  },
  // --- Buffs ---
  bold: {
    id: 'bold', name: 'Bold', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 2, targeting: 'self',
    description: 'Raises Attack by 1 stage.',
    effects: [{ type: 'buff', stat: 'str', stages: 1 }],
  },
  harden: {
    id: 'harden', name: 'Harden', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 2, targeting: 'self',
    description: 'Raises Defense by 1 stage.',
    effects: [{ type: 'buff', stat: 'def', stages: 1 }],
  },
  focus: {
    id: 'focus', name: 'Focus', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 2, targeting: 'self',
    description: 'Raises Special Attack by 1 stage.',
    effects: [{ type: 'buff', stat: 'int', stages: 1 }],
  },
  steel_skin: {
    id: 'steel_skin', name: 'Steel Skin', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 4, targeting: 'self',
    description: 'Raises Defense and Special Defense by 1 stage.',
    effects: [
      { type: 'buff', stat: 'def', stages: 1 },
      { type: 'buff', stat: 'wis', stages: 1 },
    ],
  },
  overdrive: {
    id: 'overdrive', name: 'Overdrive', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 3, targeting: 'self',
    description: 'Raises Attack and Speed by 1 stage.',
    effects: [
      { type: 'buff', stat: 'str', stages: 1 },
      { type: 'buff', stat: 'spd', stages: 1 },
    ],
  },
  // --- Heals ---
  mend: {
    id: 'mend', name: 'Mend', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 3, targeting: 'self',
    description: 'Recover 15% of max HP.',
    effects: [{ type: 'heal', value: 0.15 }],
  },
  soothe: {
    id: 'soothe', name: 'Soothe', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 4, targeting: 'single_ally',
    description: 'Heal an ally for 20% of their max HP.',
    effects: [{ type: 'heal', value: 0.20 }],
  },
  // --- Debuffs ---
  weaken: {
    id: 'weaken', name: 'Weaken', damageType: 'None', power: 0, accuracy: 85,
    category: 'Status', mpCost: 2, targeting: 'single_enemy',
    description: 'Lowers the opponent\'s Attack by 1 stage.',
    effects: [{ type: 'debuff', stat: 'str', stages: -1 }],
  },
  scold: {
    id: 'scold', name: 'Scold', damageType: 'None', power: 0, accuracy: 90,
    category: 'Status', mpCost: 2, targeting: 'single_enemy',
    description: 'Lowers the opponent\'s Defense by 1 stage.',
    effects: [{ type: 'debuff', stat: 'def', stages: -1 }],
  },
};

export function getAbility(id: string): Ability {
  return ABILITIES[id] ?? ABILITIES['basic_attack'];
}
