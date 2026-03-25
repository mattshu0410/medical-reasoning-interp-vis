// ============================================================
// Deterministic sample pool for human labeling
// Same seed → same cases for all raters on all devices
// ============================================================

export interface SampleItem {
  index: number;       // 0-based position in the pool
  model: string;
  dataset: string;
  caseIndex: number;   // index into the model_dataset.json array
}

/** Total cases in the labeling pool */
export const POOL_SIZE = 100;

/** Seed for deterministic sampling — do NOT change after study begins */
const SEED = 20260325;

/**
 * Mulberry32: simple 32-bit seeded PRNG.
 * Returns a function that yields [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using provided RNG */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build the sample pool given the metadata.
 * Stratified: picks roughly equal cases from each model×dataset stratum,
 * then shuffles the final pool deterministically.
 */
export function buildSamplePool(
  modelOrder: string[],
  datasetOrder: string[],
  caseCounts: Record<string, Record<string, number>>
): SampleItem[] {
  const rng = mulberry32(SEED);
  const strata: Array<{ model: string; dataset: string }> = [];

  for (const model of modelOrder) {
    for (const dataset of datasetOrder) {
      if (caseCounts[model]?.[dataset]) {
        strata.push({ model, dataset });
      }
    }
  }

  if (strata.length === 0) return [];
  const perStratum = Math.max(1, Math.ceil(POOL_SIZE / strata.length));
  const candidates: Omit<SampleItem, "index">[] = [];

  for (const { model, dataset } of strata) {
    const total = caseCounts[model][dataset];
    const indices = Array.from({ length: total }, (_, i) => i);
    const shuffled = seededShuffle(indices, rng);
    const picked = shuffled.slice(0, Math.min(perStratum, total));
    for (const caseIndex of picked) {
      candidates.push({ model, dataset, caseIndex });
    }
  }

  // Shuffle all candidates together, then take POOL_SIZE
  const shuffled = seededShuffle(candidates, rng);
  return shuffled.slice(0, POOL_SIZE).map((item, i) => ({
    ...item,
    index: i,
  }));
}
