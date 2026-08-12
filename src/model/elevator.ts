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

function switchTimeValue(model: Model, p: number): number {
  return Math.sqrt((2 * switchDistanceValue(model, p)) / model.a);
}

function switchSpeedValue(model: Model, p: number): number {
  return Math.sqrt(2 * model.a * switchDistanceValue(model, p));
}

function assertValidTime(t: number, stopTimeValue: number): void {
  if (!Number.isFinite(t) || t < 0 || t > stopTimeValue) {
    throw new RangeError(`t must be a finite number in [0, ${stopTimeValue}], got ${t}`);
  }
}

export type SwitchState = {
  readonly position: number;
  readonly velocity: number;
  readonly time: number;
};

export type FinalState = {
  readonly position: number;
  readonly velocity: 0;
  readonly time: number;
};

export type AttemptResult =
  | {
      readonly classification: "short";
      readonly p: number;
      readonly switchState: SwitchState;
      readonly finalState: FinalState;
      readonly shortfall: number;
    }
  | {
      readonly classification: "correct";
      readonly p: 50;
      readonly switchState: SwitchState;
      readonly finalState: FinalState;
      readonly minimumTime: number;
    }
  | {
      readonly classification: "overshoot";
      readonly p: number;
      readonly switchState: SwitchState;
      readonly finalState: FinalState;
      readonly velocityAtTarget: number;
      readonly targetCrossingTime: number;
    };

export function positionAt(model: Model, p: number, t: number): number {
  assertValidModel(model);
  assertValidPercentage(p);
  const t1 = switchTimeValue(model, p);
  const tStop = 2 * t1;
  assertValidTime(t, tStop);

  if (t === 0) return 0;
  if (t === t1) return switchDistance(model, p);
  if (t === tStop) return stopPosition(model, p);

  if (t < t1) {
    return 0.5 * model.a * t * t;
  }

  const s = switchDistanceValue(model, p);
  const v1 = switchSpeedValue(model, p);
  const tau = t - t1;
  return s + v1 * tau - 0.5 * model.a * tau * tau;
}

export function velocityAt(model: Model, p: number, t: number): number {
  assertValidModel(model);
  assertValidPercentage(p);
  const t1 = switchTimeValue(model, p);
  const tStop = 2 * t1;
  assertValidTime(t, tStop);

  if (t === 0) return 0;
  if (t === t1) return switchSpeed(model, p);
  if (t === tStop) return 0;

  if (t < t1) {
    return model.a * t;
  }

  const v1 = switchSpeedValue(model, p);
  const tau = t - t1;
  return v1 - model.a * tau;
}

export function buildAttemptResult(model: Model, p: number): AttemptResult {
  assertValidModel(model);
  assertValidPercentage(p);

  const switchState: SwitchState = {
    position: switchDistance(model, p),
    velocity: switchSpeed(model, p),
    time: switchTime(model, p),
  };
  const finalState: FinalState = {
    position: stopPosition(model, p),
    velocity: 0,
    time: stopTime(model, p),
  };

  const classification = classify(p);

  if (classification === "short") {
    return {
      classification,
      p,
      switchState,
      finalState,
      shortfall: model.H - finalState.position,
    };
  }

  if (classification === "correct") {
    return {
      classification,
      p: 50,
      switchState,
      finalState,
      minimumTime: finalState.time,
    };
  }

  return {
    classification,
    p,
    switchState,
    finalState,
    velocityAtTarget: speedAtTarget(model, p) as number,
    targetCrossingTime: crossingTime(model, p) as number,
  };
}
