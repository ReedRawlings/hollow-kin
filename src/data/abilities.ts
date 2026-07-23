import { Ability } from '../types';

export const ABILITIES: Record<string, Ability> = {
  basic_attack: {
    id: 'basic_attack', name: 'Basic Attack', damageType: 'Fighting', power: 20, accuracy: 100,
    category: 'Physical', mpCost: 0, targeting: 'single_enemy',
    description: 'A basic physical attack.',
  },
  // --- Fighting ---
  jab: {
    id: 'jab', name: 'Jab', damageType: 'Fighting', power: 30, accuracy: 100,
    category: 'Physical', mpCost: 3, targeting: 'single_enemy',
    description: 'A quick punch at the opponent.',
  },
  smash: {
    id: 'smash', name: 'Smash', damageType: 'Fighting', power: 50, accuracy: 100,
    category: 'Physical', mpCost: 6, targeting: 'single_enemy',
    description: 'A solid strike with fists or body.',
  },
  thrash: {
    id: 'thrash', name: 'Thrash', damageType: 'Fighting', power: 75, accuracy: 100,
    category: 'Physical', mpCost: 9, targeting: 'single_enemy',
    description: 'A wild thrashing attack that damages the user slightly.',
    effects: [{ type: 'recoil', value: 0.1 }],
  },
  slash: {
    id: 'slash', name: 'Slash', damageType: 'Wind', power: 45, accuracy: 100,
    category: 'Physical', mpCost: 5, targeting: 'single_enemy',
    description: 'A sharp cut with claws or blades.', highCrit: true,
  },
  cross_counter: {
    id: 'cross_counter', name: 'Cross Counter', damageType: 'Fighting', power: 60, accuracy: 100,
    category: 'Physical', mpCost: 8, targeting: 'single_enemy',
    description: 'A powerful counter-punch.',
  },
  seismic_slam: {
    id: 'seismic_slam', name: 'Seismic Slam', damageType: 'Fighting', power: 70, accuracy: 90,
    category: 'Physical', mpCost: 9, targeting: 'single_enemy',
    description: 'A heavy strike that shakes the ground. May lower Defense.',
    effects: [{ type: 'debuff', stat: 'def', stages: -1, chance: 0.3 }],
  },
  razor_wind: {
    id: 'razor_wind', name: 'Razor Wind', damageType: 'Wind', power: 70, accuracy: 95,
    category: 'Physical', mpCost: 10, targeting: 'single_enemy',
    description: 'Sharp winds slice the opponent.', highCrit: true,
  },
  // --- Electric ---
  crackle: {
    id: 'crackle', name: 'Crackle', damageType: 'Electric', power: 35, accuracy: 100,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'A crackling burst of electricity.',
  },
  spark: {
    id: 'spark', name: 'Spark', damageType: 'Electric', power: 40, accuracy: 100,
    category: 'Special', mpCost: 5, targeting: 'single_enemy',
    description: 'A burst of electricity strikes the opponent.',
  },
  discharge: {
    id: 'discharge', name: 'Discharge', damageType: 'Electric', power: 70, accuracy: 100,
    category: 'Special', mpCost: 12, targeting: 'all_enemies',
    description: 'A powerful burst of electricity hitting all enemies.',
    effects: [{ type: 'status', status: 'stun', chance: 0.1 }],
  },
  // --- Wind ---
  gust: {
    id: 'gust', name: 'Gust', damageType: 'Wind', power: 40, accuracy: 100,
    category: 'Special', mpCost: 5, targeting: 'single_enemy',
    description: 'A gust of wind strikes the opponent from above.',
  },
  gale: {
    id: 'gale', name: 'Gale', damageType: 'Wind', power: 60, accuracy: 100,
    category: 'Special', mpCost: 8, targeting: 'single_enemy',
    description: 'A strong gale wind pushes the opponent back.',
  },
  // --- Fire ---
  ember: {
    id: 'ember', name: 'Ember', damageType: 'Fire', power: 40, accuracy: 100,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'A small flame bursts from the user.',
  },
  smolder: {
    id: 'smolder', name: 'Smolder', damageType: 'Fire', power: 55, accuracy: 100,
    category: 'Special', mpCost: 7, targeting: 'single_enemy',
    description: 'A smoldering flame that slowly burns the opponent.',
    effects: [{ type: 'status', status: 'burn', chance: 0.3 }],
  },
  inferno_strike: {
    id: 'inferno_strike', name: 'Inferno Strike', damageType: 'Fire', power: 70, accuracy: 85,
    category: 'Physical', mpCost: 10, targeting: 'single_enemy',
    description: 'A flaming strike with intense heat. May burn.',
    effects: [{ type: 'status', status: 'burn', chance: 0.3 }],
  },
  // --- Ice ---
  chill: {
    id: 'chill', name: 'Chill', damageType: 'Ice', power: 40, accuracy: 100,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'An icy breath hits the opponent.',
    effects: [{ type: 'debuff', stat: 'spd', stages: -1, chance: 0.2 }],
  },
  frost: {
    id: 'frost', name: 'Frost', damageType: 'Ice', power: 35, accuracy: 90,
    category: 'Physical', mpCost: 4, targeting: 'single_enemy',
    description: 'The user coats their claws in ice and strikes.',
    effects: [{ type: 'status', status: 'freeze', chance: 0.1 }],
  },
  freeze: {
    id: 'freeze', name: 'Freeze', damageType: 'Ice', power: 55, accuracy: 100,
    category: 'Special', mpCost: 7, targeting: 'single_enemy',
    description: 'An icy attack that may freeze the opponent.',
    effects: [{ type: 'status', status: 'freeze', chance: 0.15 }],
  },
  // --- Ghost ---
  phantom: {
    id: 'phantom', name: 'Phantom', damageType: 'Ghost', power: 35, accuracy: 100,
    category: 'Special', mpCost: 4, targeting: 'single_enemy',
    description: 'A burst of spectral energy.',
  },
  shadow_claw: {
    id: 'shadow_claw', name: 'Shadow Claw', damageType: 'Ghost', power: 40, accuracy: 100,
    category: 'Physical', mpCost: 5, targeting: 'single_enemy',
    description: 'A ghostly claw strikes from the shadows.', highCrit: true,
  },
  spook: {
    id: 'spook', name: 'Spook', damageType: 'Ghost', power: 65, accuracy: 95,
    category: 'Special', mpCost: 8, targeting: 'single_enemy',
    description: 'A haunting attack.',
  },
  // --- Buffs ---
  bold: {
    id: 'bold', name: 'Bold', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 4, targeting: 'self',
    description: 'Raises Attack by 1 stage.',
    effects: [{ type: 'buff', stat: 'str', stages: 1 }],
  },
  harden: {
    id: 'harden', name: 'Harden', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 4, targeting: 'self',
    description: 'Raises Defense by 1 stage.',
    effects: [{ type: 'buff', stat: 'def', stages: 1 }],
  },
  focus: {
    id: 'focus', name: 'Focus', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 4, targeting: 'self',
    description: 'Raises Special Attack by 1 stage.',
    effects: [{ type: 'buff', stat: 'int', stages: 1 }],
  },
  steel_skin: {
    id: 'steel_skin', name: 'Steel Skin', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 6, targeting: 'self',
    description: 'Raises Defense and Special Defense by 1 stage.',
    effects: [
      { type: 'buff', stat: 'def', stages: 1 },
      { type: 'buff', stat: 'wis', stages: 1 },
    ],
  },
  overdrive: {
    id: 'overdrive', name: 'Overdrive', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 5, targeting: 'self',
    description: 'Raises Attack and Speed by 1 stage.',
    effects: [
      { type: 'buff', stat: 'str', stages: 1 },
      { type: 'buff', stat: 'spd', stages: 1 },
    ],
  },
  // --- Heals ---
  mend: {
    id: 'mend', name: 'Mend', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 5, targeting: 'self',
    description: 'Recover 15% of max HP.',
    effects: [{ type: 'heal', value: 0.15 }],
  },
  soothe: {
    id: 'soothe', name: 'Soothe', damageType: 'None', power: 0, accuracy: 100,
    category: 'Status', mpCost: 7, targeting: 'single_ally',
    description: 'Heal an ally for 20% of their max HP.',
    effects: [{ type: 'heal', value: 0.20 }],
  },
  // --- Debuffs ---
  weaken: {
    id: 'weaken', name: 'Weaken', damageType: 'None', power: 0, accuracy: 85,
    category: 'Status', mpCost: 4, targeting: 'single_enemy',
    description: 'Lowers the opponent\'s Attack by 1 stage.',
    effects: [{ type: 'debuff', stat: 'str', stages: -1 }],
  },
  scold: {
    id: 'scold', name: 'Scold', damageType: 'None', power: 0, accuracy: 90,
    category: 'Status', mpCost: 4, targeting: 'single_enemy',
    description: 'Lowers the opponent\'s Defense by 1 stage.',
    effects: [{ type: 'debuff', stat: 'def', stages: -1 }],
  },
};

export function getAbility(id: string): Ability {
  return ABILITIES[id] ?? ABILITIES['basic_attack'];
}
