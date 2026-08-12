import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  buildAttemptResult,
  crossingTime,
  positionAt,
  speedAtTarget,
  stopPosition,
  stopTime,
  switchDistance,
  switchSpeed,
  switchTime,
  velocityAt,
  type AttemptResult,
  type FinalState,
  type Model,
  type SwitchState,
} from "../src/model/elevator";

// Test-first slice: positionAt, velocityAt, buildAttemptResult, and the
// SwitchState/FinalState/AttemptResult types do not exist yet in
// src/model/elevator.ts — this file is expected to fail to import them.
// See INTERACTION.md "Trajectory API and completed-attempt result" and
// "Acceptance criteria > Model unit tests" (lines 394-426) for what each
// group below is checking.

// Second model, distinct from DEFAULT_MODEL, for the monotonicity check —
// same rationale as spec/elevator-model.test.ts's OTHER_MODEL: a=3 avoids
// the t1(p)=v1(p) and v*=T* numeric coincidences that a=1 or a=2 would
// introduce.
const OTHER_MODEL: Model = { H: 6, a: 3 };

const ALL_P = Array.from({ length: 100 }, (_, i) => i + 1);
const SAMPLE_P = [1, 13, 37, 50, 63, 89, 100];

// Raw two-phase kinematic formulas, computed here independently of
// switchDistance/switchTime/switchSpeed/stopTime/stopPosition — this is the
// independent formula check the boundary-consistency tests below are not.
function accelPhaseExpected(model: Model, t: number) {
  return { position: 0.5 * model.a * t * t, velocity: model.a * t };
}

function brakePhaseExpected(model: Model, p: number, t: number) {
  const s = (p / 100) * model.H;
  const t1 = Math.sqrt((2 * s) / model.a);
  const v1 = Math.sqrt(2 * model.a * s);
  const tau = t - t1;
  return {
    position: s + v1 * tau - 0.5 * model.a * tau * tau,
    velocity: v1 - model.a * tau,
  };
}

// Local, independent switchTime/stopTime, used only to choose sample instants
// for the interior-phase checks above — never to construct their expected
// values.
function localSwitchTime(model: Model, p: number): number {
  const s = (p / 100) * model.H;
  return Math.sqrt((2 * s) / model.a);
}

function localStopTime(model: Model, p: number): number {
  return 2 * localSwitchTime(model, p);
}

describe("positionAt/velocityAt at t=0 — exact zero for every p", () => {
  it.each(ALL_P)("p=%i", (p) => {
    expect(positionAt(DEFAULT_MODEL, p, 0)).toBe(0);
    expect(velocityAt(DEFAULT_MODEL, p, 0)).toBe(0);
  });
});

describe("interior acceleration phase — independent formula check", () => {
  it.each(SAMPLE_P)("p=%i", (p) => {
    const t = localSwitchTime(DEFAULT_MODEL, p) * 0.4;
    const expected = accelPhaseExpected(DEFAULT_MODEL, t);
    expect(positionAt(DEFAULT_MODEL, p, t)).toBeCloseTo(expected.position, 10);
    expect(velocityAt(DEFAULT_MODEL, p, t)).toBeCloseTo(expected.velocity, 10);
  });
});

describe("interior braking phase — independent formula check", () => {
  it.each(SAMPLE_P)("p=%i", (p) => {
    const t1 = localSwitchTime(DEFAULT_MODEL, p);
    const stop = localStopTime(DEFAULT_MODEL, p);
    const t = t1 + (stop - t1) * 0.6;
    const expected = brakePhaseExpected(DEFAULT_MODEL, p, t);
    expect(positionAt(DEFAULT_MODEL, p, t)).toBeCloseTo(expected.position, 10);
    expect(velocityAt(DEFAULT_MODEL, p, t)).toBeCloseTo(expected.velocity, 10);
  });
});

describe("boundary consistency at switchTime/stopTime — consistency checks, not independent proof", () => {
  it.each(ALL_P)("p=%i switchTime boundary", (p) => {
    const tSwitch = switchTime(DEFAULT_MODEL, p);
    expect(positionAt(DEFAULT_MODEL, p, tSwitch)).toBe(switchDistance(DEFAULT_MODEL, p));
    expect(velocityAt(DEFAULT_MODEL, p, tSwitch)).toBe(switchSpeed(DEFAULT_MODEL, p));
  });

  it.each(ALL_P)("p=%i stopTime boundary", (p) => {
    const tStop = stopTime(DEFAULT_MODEL, p);
    expect(positionAt(DEFAULT_MODEL, p, tStop)).toBe(stopPosition(DEFAULT_MODEL, p));
    expect(velocityAt(DEFAULT_MODEL, p, tStop)).toBe(0);
  });
});

describe("monotonicity — velocity non-negative, position non-decreasing", () => {
  for (const model of [DEFAULT_MODEL, OTHER_MODEL]) {
    it.each(SAMPLE_P)(`model H=${model.H} a=${model.a}, p=%i`, (p) => {
      const stop = stopTime(model, p);
      const fractions = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
      let previousPosition = -Infinity;
      for (const fraction of fractions) {
        const t = fraction * stop;
        const position = positionAt(model, p, t);
        const velocity = velocityAt(model, p, t);
        expect(velocity).toBeGreaterThanOrEqual(0);
        expect(position).toBeGreaterThanOrEqual(previousPosition);
        previousPosition = position;
      }
    });
  }
});

describe("H-crossing linkage — trajectory functions vs H-crossing functions", () => {
  it.each(ALL_P.filter((p) => p > 50))("p=%i", (p) => {
    const tCross = crossingTime(DEFAULT_MODEL, p) as number;
    expect(positionAt(DEFAULT_MODEL, p, tCross)).toBeCloseTo(DEFAULT_MODEL.H, 6);
    expect(velocityAt(DEFAULT_MODEL, p, tCross)).toBeCloseTo(
      speedAtTarget(DEFAULT_MODEL, p) as number,
      6,
    );
  });
});

describe("positionAt/velocityAt reject out-of-domain t — no clamping", () => {
  const p = 63;
  const stop = stopTime(DEFAULT_MODEL, p);
  const invalidT = [
    -1,
    -0.001,
    stop + 0.001,
    stop + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

  it.each(invalidT)("positionAt rejects t=%p", (t) => {
    expect(() => positionAt(DEFAULT_MODEL, p, t)).toThrow(RangeError);
  });

  it.each(invalidT)("velocityAt rejects t=%p", (t) => {
    expect(() => velocityAt(DEFAULT_MODEL, p, t)).toThrow(RangeError);
  });
});

describe("buildAttemptResult — variant shape and category-specific fields", () => {
  it("p<50 produces a short result with shortfall only", () => {
    const p = 30;
    const result = buildAttemptResult(DEFAULT_MODEL, p) as Extract<
      AttemptResult,
      { classification: "short" }
    >;
    expect(result.classification).toBe("short");
    expect(result.p).toBe(p);

    const expectedSwitchState: SwitchState = {
      position: switchDistance(DEFAULT_MODEL, p),
      velocity: switchSpeed(DEFAULT_MODEL, p),
      time: switchTime(DEFAULT_MODEL, p),
    };
    const expectedFinalState: FinalState = {
      position: stopPosition(DEFAULT_MODEL, p),
      velocity: 0,
      time: stopTime(DEFAULT_MODEL, p),
    };
    expect(result.switchState).toEqual(expectedSwitchState);
    expect(result.finalState).toEqual(expectedFinalState);
    expect(result.shortfall).toBeCloseTo(DEFAULT_MODEL.H - stopPosition(DEFAULT_MODEL, p), 10);

    expect(Object.hasOwn(result, "minimumTime")).toBe(false);
    expect(Object.hasOwn(result, "velocityAtTarget")).toBe(false);
    expect(Object.hasOwn(result, "targetCrossingTime")).toBe(false);
  });

  it("p=50 produces a correct result with minimumTime only", () => {
    const p = 50;
    const result = buildAttemptResult(DEFAULT_MODEL, p) as Extract<
      AttemptResult,
      { classification: "correct" }
    >;
    expect(result.classification).toBe("correct");
    expect(result.p).toBe(50);

    const expectedSwitchState: SwitchState = {
      position: switchDistance(DEFAULT_MODEL, p),
      velocity: switchSpeed(DEFAULT_MODEL, p),
      time: switchTime(DEFAULT_MODEL, p),
    };
    const expectedFinalState: FinalState = {
      position: stopPosition(DEFAULT_MODEL, p),
      velocity: 0,
      time: stopTime(DEFAULT_MODEL, p),
    };
    expect(result.switchState).toEqual(expectedSwitchState);
    expect(result.finalState).toEqual(expectedFinalState);
    expect(result.minimumTime).toBe(stopTime(DEFAULT_MODEL, p));

    expect(Object.hasOwn(result, "shortfall")).toBe(false);
    expect(Object.hasOwn(result, "velocityAtTarget")).toBe(false);
    expect(Object.hasOwn(result, "targetCrossingTime")).toBe(false);
  });

  it("p>50 produces an overshoot result with velocityAtTarget/targetCrossingTime only", () => {
    const p = 80;
    const result = buildAttemptResult(DEFAULT_MODEL, p) as Extract<
      AttemptResult,
      { classification: "overshoot" }
    >;
    expect(result.classification).toBe("overshoot");
    expect(result.p).toBe(p);

    const expectedSwitchState: SwitchState = {
      position: switchDistance(DEFAULT_MODEL, p),
      velocity: switchSpeed(DEFAULT_MODEL, p),
      time: switchTime(DEFAULT_MODEL, p),
    };
    const expectedFinalState: FinalState = {
      position: stopPosition(DEFAULT_MODEL, p),
      velocity: 0,
      time: stopTime(DEFAULT_MODEL, p),
    };
    expect(result.switchState).toEqual(expectedSwitchState);
    expect(result.finalState).toEqual(expectedFinalState);
    expect(result.velocityAtTarget).toBe(speedAtTarget(DEFAULT_MODEL, p));
    expect(result.targetCrossingTime).toBe(crossingTime(DEFAULT_MODEL, p));

    expect(Object.hasOwn(result, "shortfall")).toBe(false);
    expect(Object.hasOwn(result, "minimumTime")).toBe(false);
  });
});

describe("buildAttemptResult input contract", () => {
  const invalidH = [0, -10, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const invalidA = [0, -1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const invalidP = [
    0,
    101,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

  it.each(invalidH)("rejects H=%p", (H) => {
    expect(() => buildAttemptResult({ H, a: DEFAULT_MODEL.a }, 50)).toThrow(RangeError);
  });

  it.each(invalidA)("rejects a=%p", (a) => {
    expect(() => buildAttemptResult({ H: DEFAULT_MODEL.H, a }, 50)).toThrow(RangeError);
  });

  it.each(invalidP)("rejects p=%p", (p) => {
    expect(() => buildAttemptResult(DEFAULT_MODEL, p)).toThrow(RangeError);
  });

  it("validates model before p when both are invalid — error names the model, not p", () => {
    expect(() => buildAttemptResult({ H: -1, a: DEFAULT_MODEL.a }, 999)).toThrow(/H must be/);
  });
});
