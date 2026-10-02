import { seededRng, type Rng } from '@/lib/engine';

/** Fresh unpredictable RNG per request; the engine itself never calls Math.random. */
export function cryptoRng(): Rng {
  const [seed] = crypto.getRandomValues(new Uint32Array(1));
  return seededRng(seed);
}

export function newId(): string {
  return crypto.randomUUID();
}
