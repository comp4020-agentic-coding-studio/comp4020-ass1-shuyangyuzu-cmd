import { assertValidModel, type Model } from "../model/elevator";

export function shaftDomain(model: Model): number {
  assertValidModel(model);
  return 2 * model.H;
}

export function visualDuration(stopTimeS: number): number {
  if (!Number.isFinite(stopTimeS) || stopTimeS <= 0) {
    throw new RangeError(`stopTimeS must be a finite number greater than 0, got ${stopTimeS}`);
  }
  return Math.max(0.8, 0.45 * stopTimeS);
}

export function physicalTimeAt(wallElapsedMs: number, visualDurationMs: number, stopTimeS: number): number {
  if (!Number.isFinite(wallElapsedMs) || wallElapsedMs < 0) {
    throw new RangeError(`wallElapsedMs must be a finite number >= 0, got ${wallElapsedMs}`);
  }
  if (!Number.isFinite(visualDurationMs) || visualDurationMs <= 0) {
    throw new RangeError(`visualDurationMs must be a finite number greater than 0, got ${visualDurationMs}`);
  }
  if (!Number.isFinite(stopTimeS) || stopTimeS <= 0) {
    throw new RangeError(`stopTimeS must be a finite number greater than 0, got ${stopTimeS}`);
  }
  return Math.min(1, wallElapsedMs / visualDurationMs) * stopTimeS;
}

export function projectToShaftPercent(position: number, extent: number): number {
  if (!Number.isFinite(extent) || extent <= 0) {
    throw new RangeError(`extent must be a finite number greater than 0, got ${extent}`);
  }
  if (!Number.isFinite(position) || position < 0) {
    throw new RangeError(`position must be a finite number >= 0, got ${position}`);
  }
  if (position > extent) {
    throw new RangeError(`position must not exceed extent, got position=${position}, extent=${extent}`);
  }
  return (position / extent) * 100;
}
