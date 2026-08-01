export type RandomSource = () => number;

/** Small deterministic PRNG for repeatable Battle Chamber simulations. */
export function createSeededRandom(seed: number): RandomSource {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
