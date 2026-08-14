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

export type AdvancedModel = { readonly H: number; readonly a: number; readonly b: number };
export type AdvancedClassification = "short" | "correct" | "overshoot";

export const DEFAULT_ADVANCED_MODEL: AdvancedModel = { H: 10, a: 1.5, b: 1.5 };

// p* is generally irrational (100b/(a+b)), so its stopping position won't
// round-trip to bit-exact H even at the exact analytic optimum. 1e-9 m is far
// above floating-point rounding error here (~1e-14 to 1e-13 m) and far below
// displayed precision (2 decimals, >= 0.01 m). See INTERACTION.md "Advanced
// mode model and contract" for the full justification.
const ADVANCED_CORRECT_TOLERANCE_M = 1e-9;

export function assertValidAdvancedModel(model: AdvancedModel): void {
  if (!Number.isFinite(model.H) || model.H <= 0) {
    throw new RangeError(`H must be a finite number greater than 0, got ${model.H}`);
  }
  if (!Number.isFinite(model.a) || model.a <= 0) {
    throw new RangeError(`a must be a finite number greater than 0, got ${model.a}`);
  }
  if (!Number.isFinite(model.b) || model.b <= 0) {
    throw new RangeError(`b must be a finite number greater than 0, got ${model.b}`);
  }
}

export function assertValidAdvancedPercentage(p: number): void {
  if (!Number.isFinite(p) || p < 1 || p > 100) {
    throw new RangeError(`p must be a finite number in 1..100 inclusive, got ${p}`);
  }
}

function switchDistanceAdvancedValue(model: AdvancedModel, p: number): number {
  return (p / 100) * model.H;
}

function stopPositionAdvancedValue(model: AdvancedModel, s: number): number {
  return s * (1 + model.a / model.b);
}

function switchTimeAdvancedValue(model: AdvancedModel, p: number): number {
  return Math.sqrt((2 * switchDistanceAdvancedValue(model, p)) / model.a);
}

function switchSpeedAdvancedValue(model: AdvancedModel, p: number): number {
  return Math.sqrt(2 * model.a * switchDistanceAdvancedValue(model, p));
}

function stopTimeAdvancedValue(model: AdvancedModel, p: number): number {
  const t1 = switchTimeAdvancedValue(model, p);
  const v1 = switchSpeedAdvancedValue(model, p);
  return t1 + v1 / model.b;
}

export function optimalSwitchPercentage(model: AdvancedModel): number {
  assertValidAdvancedModel(model);
  return (100 * model.b) / (model.a + model.b);
}

export function optimalSwitchDistance(model: AdvancedModel): number {
  assertValidAdvancedModel(model);
  return (model.H * model.b) / (model.a + model.b);
}

export function optimalSwitchSpeed(model: AdvancedModel): number {
  assertValidAdvancedModel(model);
  return Math.sqrt((2 * model.a * model.b * model.H) / (model.a + model.b));
}

export function optimalTime(model: AdvancedModel): number {
  assertValidAdvancedModel(model);
  return Math.sqrt((2 * model.H * (model.a + model.b)) / (model.a * model.b));
}

export function switchDistanceAdvanced(model: AdvancedModel, p: number): number {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  return switchDistanceAdvancedValue(model, p);
}

export function stopPositionAdvanced(model: AdvancedModel, p: number): number {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  return stopPositionAdvancedValue(model, switchDistanceAdvancedValue(model, p));
}

export function switchTimeAdvanced(model: AdvancedModel, p: number): number {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  return switchTimeAdvancedValue(model, p);
}

export function switchSpeedAdvanced(model: AdvancedModel, p: number): number {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  return switchSpeedAdvancedValue(model, p);
}

export function stopTimeAdvanced(model: AdvancedModel, p: number): number {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  return stopTimeAdvancedValue(model, p);
}

export function classifyAdvanced(model: AdvancedModel, p: number): AdvancedClassification {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  const s = switchDistanceAdvancedValue(model, p);
  const diff = stopPositionAdvancedValue(model, s) - model.H;
  if (diff < -ADVANCED_CORRECT_TOLERANCE_M) return "short";
  if (diff > ADVANCED_CORRECT_TOLERANCE_M) return "overshoot";
  return "correct";
}

export function speedAtTargetAdvanced(model: AdvancedModel, p: number): number | undefined {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  if (classifyAdvanced(model, p) !== "overshoot") return undefined;
  const s = switchDistanceAdvancedValue(model, p);
  return Math.sqrt(2 * model.a * s - 2 * model.b * (model.H - s));
}

export function crossingTimeAdvanced(model: AdvancedModel, p: number): number | undefined {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  if (classifyAdvanced(model, p) !== "overshoot") return undefined;
  const s = switchDistanceAdvancedValue(model, p);
  const t1 = switchTimeAdvancedValue(model, p);
  const v1 = switchSpeedAdvancedValue(model, p);
  const vAtH = Math.sqrt(2 * model.a * s - 2 * model.b * (model.H - s));
  return t1 + (v1 - vAtH) / model.b;
}

export type AdvancedAttemptResult =
  | {
      readonly classification: "short";
      readonly p: number;
      readonly switchState: SwitchState;
      readonly finalState: FinalState;
      readonly shortfall: number;
    }
  | {
      readonly classification: "correct";
      readonly p: number;
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

export function positionAtAdvanced(model: AdvancedModel, p: number, t: number): number {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  const t1 = switchTimeAdvancedValue(model, p);
  const tStop = stopTimeAdvancedValue(model, p);
  assertValidTime(t, tStop);

  if (t === 0) return 0;
  if (t === t1) return switchDistanceAdvancedValue(model, p);
  if (t === tStop) return stopPositionAdvancedValue(model, switchDistanceAdvancedValue(model, p));

  if (t < t1) {
    return 0.5 * model.a * t * t;
  }

  const s = switchDistanceAdvancedValue(model, p);
  const v1 = switchSpeedAdvancedValue(model, p);
  const tau = t - t1;
  return s + v1 * tau - 0.5 * model.b * tau * tau;
}

export function velocityAtAdvanced(model: AdvancedModel, p: number, t: number): number {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);
  const t1 = switchTimeAdvancedValue(model, p);
  const tStop = stopTimeAdvancedValue(model, p);
  assertValidTime(t, tStop);

  if (t === 0) return 0;
  if (t === t1) return switchSpeedAdvancedValue(model, p);
  if (t === tStop) return 0;

  if (t < t1) {
    return model.a * t;
  }

  const v1 = switchSpeedAdvancedValue(model, p);
  const tau = t - t1;
  return v1 - model.b * tau;
}

export function buildAdvancedAttemptResult(model: AdvancedModel, p: number): AdvancedAttemptResult {
  assertValidAdvancedModel(model);
  assertValidAdvancedPercentage(p);

  const switchState: SwitchState = {
    position: switchDistanceAdvanced(model, p),
    velocity: switchSpeedAdvanced(model, p),
    time: switchTimeAdvanced(model, p),
  };
  const finalState: FinalState = {
    position: stopPositionAdvanced(model, p),
    velocity: 0,
    time: stopTimeAdvanced(model, p),
  };

  const classification = classifyAdvanced(model, p);

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
      p,
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
    velocityAtTarget: speedAtTargetAdvanced(model, p) as number,
    targetCrossingTime: crossingTimeAdvanced(model, p) as number,
  };
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
