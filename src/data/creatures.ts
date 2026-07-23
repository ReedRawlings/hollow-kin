import { CreatureTemplate, ARCHETYPE_COLORS } from '../types';

export const CREATURE_TEMPLATES: Record<string, CreatureTemplate> = {
  emberwhelp: {
    id: 'emberwhelp', name: 'Emberwhelp', archetype: 'Mecha',
    baseStats: { hp: 35, mp: 30, str: 10, def: 7, wis: 9, spd: 18, int: 16 },
    defaultAbilities: ['ember', 'spark'],
    resistances: ['Fire'], weaknesses: ['Ice'],
    spriteColor: ARCHETYPE_COLORS.Mecha,
  },
  voltarc: {
    id: 'voltarc', name: 'Voltarc', archetype: 'Mecha',
    baseStats: { hp: 30, mp: 35, str: 8, def: 6, wis: 10, spd: 20, int: 18 },
    defaultAbilities: ['crackle', 'discharge'],
    resistances: ['Electric'], weaknesses: ['Fighting'],
    spriteColor: ARCHETYPE_COLORS.Mecha,
  },
  thornvine: {
    id: 'thornvine', name: 'Thornvine', archetype: 'Flora',
    baseStats: { hp: 50, mp: 35, str: 8, def: 10, wis: 18, spd: 8, int: 12 },
    defaultAbilities: ['mend', 'gust'],
    resistances: ['Wind'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Flora,
  },
  petalward: {
    id: 'petalward', name: 'Petalward', archetype: 'Flora',
    baseStats: { hp: 55, mp: 30, str: 7, def: 12, wis: 16, spd: 7, int: 10 },
    defaultAbilities: ['soothe', 'harden'],
    resistances: ['Ice'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Flora,
  },
  ironjaw: {
    id: 'ironjaw', name: 'Ironjaw', archetype: 'Fauna',
    baseStats: { hp: 40, mp: 20, str: 18, def: 8, wis: 7, spd: 16, int: 6 },
    defaultAbilities: ['thrash', 'slash'],
    resistances: ['Fighting'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Fauna,
  },
  swiftfang: {
    id: 'swiftfang', name: 'Swiftfang', archetype: 'Fauna',
    baseStats: { hp: 38, mp: 22, str: 16, def: 7, wis: 8, spd: 20, int: 7 },
    defaultAbilities: ['jab', 'razor_wind'],
    resistances: ['Wind'], weaknesses: ['Ice'],
    spriteColor: ARCHETYPE_COLORS.Fauna,
  },
  stoneguard: {
    id: 'stoneguard', name: 'Stoneguard', archetype: 'Rock',
    baseStats: { hp: 60, mp: 18, str: 14, def: 20, wis: 10, spd: 5, int: 6 },
    defaultAbilities: ['smash', 'harden'],
    resistances: ['Fire', 'Fighting'], weaknesses: ['Ice', 'Electric'],
    spriteColor: ARCHETYPE_COLORS.Rock,
  },
  bouldershell: {
    id: 'bouldershell', name: 'Bouldershell', archetype: 'Rock',
    baseStats: { hp: 65, mp: 15, str: 16, def: 18, wis: 8, spd: 4, int: 5 },
    defaultAbilities: ['seismic_slam', 'steel_skin'],
    resistances: ['Fire'], weaknesses: ['Wind'],
    spriteColor: ARCHETYPE_COLORS.Rock,
  },
  frostwisp: {
    id: 'frostwisp', name: 'Frostwisp', archetype: 'Kami',
    baseStats: { hp: 45, mp: 30, str: 10, def: 10, wis: 14, spd: 12, int: 14 },
    defaultAbilities: ['freeze', 'weaken'],
    resistances: ['Ice'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Kami,
  },
  duskgeist: {
    id: 'duskgeist', name: 'Duskgeist', archetype: 'Spirits',
    baseStats: { hp: 38, mp: 32, str: 7, def: 8, wis: 16, spd: 14, int: 18 },
    defaultAbilities: ['shadow_claw', 'spook'],
    resistances: ['Ghost'], weaknesses: ['Fighting'],
    spriteColor: ARCHETYPE_COLORS.Spirits,
  },
  riceball: {
    id: 'riceball', name: 'Riceball', archetype: 'Food',
    baseStats: { hp: 45, mp: 25, str: 15, def: 10, wis: 14, spd: 8, int: 8 },
    defaultAbilities: ['bold', 'smash'],
    resistances: ['Ice'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Food,
  },
  bladeknight: {
    id: 'bladeknight', name: 'Bladeknight', archetype: 'Human',
    baseStats: { hp: 45, mp: 22, str: 16, def: 14, wis: 8, spd: 10, int: 8 },
    defaultAbilities: ['frost', 'cross_counter'],
    resistances: ['Fighting'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Human,
  },
};

export const STARTER_TRIO_A = ['ironjaw', 'emberwhelp', 'bladeknight'];
export const STARTER_TRIO_B = ['stoneguard', 'thornvine', 'duskgeist'];

export function getTemplate(id: string): CreatureTemplate {
  return CREATURE_TEMPLATES[id];
}

export function getAllTemplateIds(): string[] {
  return Object.keys(CREATURE_TEMPLATES);
}

// Creatures available as wild encounters per zone
export const ZONE_CREATURE_POOLS: Record<number, string[]> = {
  1: ['riceball', 'swiftfang', 'petalward', 'frostwisp'],
  2: ['voltarc', 'bouldershell', 'duskgeist', 'ironjaw'],
  3: ['emberwhelp', 'bladeknight', 'thornvine', 'stoneguard'],
};
