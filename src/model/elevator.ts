export type Model = { readonly H: number; readonly a: number };
export type Classification = "short" | "correct" | "overshoot";

export const DEFAULT_MODEL: Model = { H: 10, a: 1.5 };

export function assertValidModel(model: Model): void {
  if (!Number.isFinite(model.H) || model.H <= 0) {
    throw new RangeError(`H must be a finite number greater than 0, got ${model.H}`);
  }
  if (!Number.isFinite(model.a) || model.a <= 0) {
    throw new RangeError(`a must be a finite number greater than 0, got ${model.a}`);
  }
}

export function assertValidPercentage(p: number): void {
  if (!Number.isFinite(p) || !Number.isInteger(p) || p < 1 || p > 100) {
    throw new RangeError(`p must be an integer in 1..100 inclusive, got ${p}`);
  }
}

export function classify(p: number): Classification {
  assertValidPercentage(p);
  if (p < 50) return "short";
  if (p === 50) return "correct";
  return "overshoot";
}

function switchDistanceValue(model: Model, p: number): number {
  return (p / 100) * model.H;
}

export function switchDistance(model: Model, p: number): number {
  assertValidModel(model);
  assertValidPercentage(p);
  return switchDistanceValue(model, p);
}

export function stopPosition(model: Model, p: number): number {
  assertValidModel(model);
  assertValidPercentage(p);
  return 2 * switchDistanceValue(model, p);
}

export function switchTime(model: Model, p: number): number {
  assertValidModel(model);
  assertValidPercentage(p);
  return Math.sqrt((2 * switchDistanceValue(model, p)) / model.a);
}

export function switchSpeed(model: Model, p: number): number {
  assertValidModel(model);
  assertValidPercentage(p);
  return Math.sqrt(2 * model.a * switchDistanceValue(model, p));
}

export function stopTime(model: Model, p: number): number {
  assertValidModel(model);
  assertValidPercentage(p);
  return 2 * Math.sqrt((2 * switchDistanceValue(model, p)) / model.a);
}

export function speedAtTarget(model: Model, p: number): number | undefined {
  assertValidModel(model);
  assertValidPercentage(p);
  if (p < 50) return undefined;
  if (p === 50) return 0;
  const s = switchDistanceValue(model, p);
  return Math.sqrt(2 * model.a * (2 * s - model.H));
}

export function crossingTime(model: Model, p: number): number | undefined {
  assertValidModel(model);
  assertValidPercentage(p);
  if (p <= 50) return undefined;
  const s = switchDistanceValue(model, p);
  const t1 = Math.sqrt((2 * s) / model.a);
  const v1 = Math.sqrt(2 * model.a * s);
  const vAtH = Math.sqrt(2 * model.a * (2 * s - model.H));
  return t1 + (v1 - vAtH) / model.a;
}
