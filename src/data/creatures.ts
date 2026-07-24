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
  glacikin: {
    id: 'glacikin', name: 'Glacikin', archetype: 'Kami',
    baseStats: { hp: 50, mp: 28, str: 9, def: 12, wis: 16, spd: 10, int: 15 },
    defaultAbilities: ['freeze', 'weaken'],
    resistances: ['Ice'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Kami,
  },
  mistvane: {
    id: 'mistvane', name: 'Mistvane', archetype: 'Kami',
    baseStats: { hp: 40, mp: 32, str: 8, def: 9, wis: 15, spd: 14, int: 16 },
    defaultAbilities: ['chill', 'scold'],
    resistances: ['Ice'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Kami,
  },
  yukiorb: {
    id: 'yukiorb', name: 'Yukiorb', archetype: 'Kami',
    baseStats: { hp: 38, mp: 34, str: 7, def: 8, wis: 17, spd: 13, int: 17 },
    defaultAbilities: ['frost', 'focus'],
    resistances: ['Ice'], weaknesses: ['Fighting'],
    spriteColor: ARCHETYPE_COLORS.Kami,
  },
  hoarfang: {
    id: 'hoarfang', name: 'Hoarfang', archetype: 'Kami',
    baseStats: { hp: 46, mp: 26, str: 11, def: 11, wis: 13, spd: 11, int: 13 },
    defaultAbilities: ['weaken', 'chill'],
    resistances: ['Ice'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Kami,
  },
  wraithling: {
    id: 'wraithling', name: 'Wraithling', archetype: 'Spirits',
    baseStats: { hp: 34, mp: 34, str: 8, def: 7, wis: 15, spd: 16, int: 19 },
    defaultAbilities: ['shadow_claw', 'spook'],
    resistances: ['Ghost'], weaknesses: ['Fighting'],
    spriteColor: ARCHETYPE_COLORS.Spirits,
  },
  banewisp: {
    id: 'banewisp', name: 'Banewisp', archetype: 'Spirits',
    baseStats: { hp: 36, mp: 30, str: 6, def: 8, wis: 17, spd: 15, int: 18 },
    defaultAbilities: ['phantom', 'weaken'],
    resistances: ['Ghost'], weaknesses: ['Fighting'],
    spriteColor: ARCHETYPE_COLORS.Spirits,
  },
  gravemoth: {
    id: 'gravemoth', name: 'Gravemoth', archetype: 'Spirits',
    baseStats: { hp: 32, mp: 36, str: 9, def: 6, wis: 14, spd: 18, int: 17 },
    defaultAbilities: ['spook', 'scold'],
    resistances: ['Ghost'], weaknesses: ['Fighting'],
    spriteColor: ARCHETYPE_COLORS.Spirits,
  },
  hollowveil: {
    id: 'hollowveil', name: 'Hollowveil', archetype: 'Spirits',
    baseStats: { hp: 40, mp: 28, str: 7, def: 9, wis: 16, spd: 13, int: 16 },
    defaultAbilities: ['shadow_claw', 'weaken'],
    resistances: ['Ghost'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Spirits,
  },
  dumplord: {
    id: 'dumplord', name: 'Dumplord', archetype: 'Food',
    baseStats: { hp: 50, mp: 22, str: 16, def: 12, wis: 13, spd: 7, int: 7 },
    defaultAbilities: ['bold', 'thrash'],
    resistances: ['Ice'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Food,
  },
  skewerkin: {
    id: 'skewerkin', name: 'Skewerkin', archetype: 'Food',
    baseStats: { hp: 42, mp: 20, str: 18, def: 10, wis: 11, spd: 9, int: 8 },
    defaultAbilities: ['jab', 'bold'],
    resistances: ['Ice'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Food,
  },
  brothling: {
    id: 'brothling', name: 'Brothling', archetype: 'Food',
    baseStats: { hp: 48, mp: 24, str: 14, def: 11, wis: 15, spd: 6, int: 8 },
    defaultAbilities: ['harden', 'smash'],
    resistances: ['Ice'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Food,
  },
  pepperfist: {
    id: 'pepperfist', name: 'Pepperfist', archetype: 'Food',
    baseStats: { hp: 40, mp: 18, str: 17, def: 9, wis: 10, spd: 10, int: 9 },
    defaultAbilities: ['focus', 'thrash'],
    resistances: ['Ice'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Food,
  },
  frostblade: {
    id: 'frostblade', name: 'Frostblade', archetype: 'Human',
    baseStats: { hp: 42, mp: 20, str: 17, def: 13, wis: 8, spd: 12, int: 8 },
    defaultAbilities: ['frost', 'slash'],
    resistances: ['Fighting'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Human,
  },
  duelist: {
    id: 'duelist', name: 'Duelist', archetype: 'Human',
    baseStats: { hp: 40, mp: 18, str: 18, def: 11, wis: 7, spd: 15, int: 7 },
    defaultAbilities: ['cross_counter', 'jab'],
    resistances: ['Fighting'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Human,
  },
  icevow: {
    id: 'icevow', name: 'Icevow', archetype: 'Human',
    baseStats: { hp: 44, mp: 24, str: 14, def: 15, wis: 9, spd: 9, int: 9 },
    defaultAbilities: ['chill', 'cross_counter'],
    resistances: ['Fighting'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Human,
  },
  ronin: {
    id: 'ronin', name: 'Ronin', archetype: 'Human',
    baseStats: { hp: 38, mp: 20, str: 16, def: 12, wis: 8, spd: 14, int: 8 },
    defaultAbilities: ['slash', 'freeze'],
    resistances: ['Fighting'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Human,
  },
  sparkoid: {
    id: 'sparkoid', name: 'Sparkoid', archetype: 'Mecha',
    baseStats: { hp: 28, mp: 32, str: 9, def: 6, wis: 9, spd: 19, int: 19 },
    defaultAbilities: ['spark', 'discharge'],
    resistances: ['Electric'], weaknesses: ['Fighting'],
    spriteColor: ARCHETYPE_COLORS.Mecha,
  },
  cindercog: {
    id: 'cindercog', name: 'Cindercog', archetype: 'Mecha',
    baseStats: { hp: 32, mp: 28, str: 10, def: 7, wis: 8, spd: 18, int: 17 },
    defaultAbilities: ['ember', 'overdrive'],
    resistances: ['Fire'], weaknesses: ['Ice'],
    spriteColor: ARCHETYPE_COLORS.Mecha,
  },
  mossgolem: {
    id: 'mossgolem', name: 'Mossgolem', archetype: 'Flora',
    baseStats: { hp: 58, mp: 28, str: 9, def: 14, wis: 17, spd: 6, int: 9 },
    defaultAbilities: ['harden', 'soothe'],
    resistances: ['Wind'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Flora,
  },
  bloomwarden: {
    id: 'bloomwarden', name: 'Bloomwarden', archetype: 'Flora',
    baseStats: { hp: 52, mp: 32, str: 8, def: 11, wis: 19, spd: 7, int: 11 },
    defaultAbilities: ['mend', 'bold'],
    resistances: ['Ice'], weaknesses: ['Fire'],
    spriteColor: ARCHETYPE_COLORS.Flora,
  },
  hornback: {
    id: 'hornback', name: 'Hornback', archetype: 'Fauna',
    baseStats: { hp: 42, mp: 18, str: 19, def: 9, wis: 6, spd: 17, int: 6 },
    defaultAbilities: ['thrash', 'slash'],
    resistances: ['Fighting'], weaknesses: ['Ghost'],
    spriteColor: ARCHETYPE_COLORS.Fauna,
  },
  duskfang: {
    id: 'duskfang', name: 'Duskfang', archetype: 'Fauna',
    baseStats: { hp: 36, mp: 20, str: 17, def: 7, wis: 7, spd: 21, int: 7 },
    defaultAbilities: ['jab', 'razor_wind'],
    resistances: ['Wind'], weaknesses: ['Ice'],
    spriteColor: ARCHETYPE_COLORS.Fauna,
  },
  cragback: {
    id: 'cragback', name: 'Cragback', archetype: 'Rock',
    baseStats: { hp: 62, mp: 16, str: 15, def: 19, wis: 9, spd: 5, int: 5 },
    defaultAbilities: ['smash', 'steel_skin'],
    resistances: ['Fighting'], weaknesses: ['Ice'],
    spriteColor: ARCHETYPE_COLORS.Rock,
  },
  granitehide: {
    id: 'granitehide', name: 'Granitehide', archetype: 'Rock',
    baseStats: { hp: 58, mp: 20, str: 13, def: 21, wis: 11, spd: 4, int: 6 },
    defaultAbilities: ['seismic_slam', 'harden'],
    resistances: ['Fire'], weaknesses: ['Electric'],
    spriteColor: ARCHETYPE_COLORS.Rock,
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

// Creatures available as wild encounters per zone (banded roughly by stat total: low -> high)
export const ZONE_CREATURE_POOLS: Record<number, string[]> = {
  1: [
    'pepperfist', 'ironjaw', 'duskfang', 'duelist', 'ronin', 'hornback',
    'swiftfang', 'skewerkin', 'frostblade', 'cindercog', 'sparkoid', 'bladeknight',
  ],
  2: [
    'icevow', 'emberwhelp', 'riceball', 'brothling', 'dumplord', 'voltarc',
    'hollowveil', 'banewisp', 'bouldershell', 'cragback', 'hoarfang', 'gravemoth',
  ],
  3: [
    'duskgeist', 'stoneguard', 'wraithling', 'granitehide', 'mistvane', 'yukiorb',
    'frostwisp', 'petalward', 'glacikin', 'bloomwarden', 'mossgolem', 'thornvine',
  ],
};
