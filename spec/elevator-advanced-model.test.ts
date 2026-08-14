import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADVANCED_MODEL,
  DEFAULT_MODEL,
  assertValidAdvancedModel,
  assertValidAdvancedPercentage,
  buildAdvancedAttemptResult,
  classify,
  classifyAdvanced,
  crossingTimeAdvanced,
  optimalSwitchDistance,
  optimalSwitchPercentage,
  optimalSwitchSpeed,
  optimalTime,
  positionAt,
  positionAtAdvanced,
  speedAtTargetAdvanced,
  stopPositionAdvanced,
  stopTime,
  stopTimeAdvanced,
  switchDistanceAdvanced,
  switchSpeed,
  switchSpeedAdvanced,
  switchTimeAdvanced,
  velocityAt,
  velocityAtAdvanced,
  type AdvancedAttemptResult,
  type AdvancedModel,
  type Model,
} from "../src/model/elevator";

// Test-first slice: the Advanced exports above do not exist yet in
// src/model/elevator.ts. See INTERACTION.md "Advanced mode model and
// contract (approved)" for the derivation and "Advanced model tests (this
// slice)" for what each group below is checking. No DOM/controller code is
// exercised here — this slice is model-only.

// Symmetric case: b=a should reduce every Advanced formula to Beginner's
// exact value. Use a value other than DEFAULT_MODEL.a to prove this isn't a
// numeric fluke of a=1.5 specifically.
const SYMMETRIC: AdvancedModel = { H: 10, a: 2, b: 2 };

// Explicitly asymmetric case, independently computed with Node (not by
// hand) before being written here — see the commit that introduced this
// file for the derivation transcript.
const ASYMMETRIC: AdvancedModel = { H: 10, a: 1.5, b: 2 };
const ASYMMETRIC_P_STAR = (100 * ASYMMETRIC.b) / (ASYMMETRIC.a + ASYMMETRIC.b);

describe("assertValidAdvancedModel — rejects non-finite/non-positive H, a, b", () => {
  const invalid = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  it.each(invalid)("rejects H=%p", (H) => {
    expect(() => assertValidAdvancedModel({ H, a: 1.5, b: 2 })).toThrow(RangeError);
  });

  it.each(invalid)("rejects a=%p", (a) => {
    expect(() => assertValidAdvancedModel({ H: 10, a, b: 2 })).toThrow(RangeError);
  });

  it.each(invalid)("rejects b=%p", (b) => {
    expect(() => assertValidAdvancedModel({ H: 10, a: 1.5, b })).toThrow(RangeError);
  });

  it("accepts a valid asymmetric model", () => {
    expect(() => assertValidAdvancedModel(ASYMMETRIC)).not.toThrow();
  });
});

describe("assertValidAdvancedPercentage — real-valued, unlike Beginner's integer-only p", () => {
  const invalid = [0, 101, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  it.each(invalid)("rejects p=%p", (p) => {
    expect(() => assertValidAdvancedPercentage(p)).toThrow(RangeError);
  });

  it("accepts a non-integer p (this is the whole point of the relaxation)", () => {
    expect(() => assertValidAdvancedPercentage(1.5)).not.toThrow();
    expect(() => assertValidAdvancedPercentage(57.142857142857146)).not.toThrow();
  });

  it("accepts the boundaries 1 and 100", () => {
    expect(() => assertValidAdvancedPercentage(1)).not.toThrow();
    expect(() => assertValidAdvancedPercentage(100)).not.toThrow();
  });
});

describe("reduction to Beginner at b=a — not assumed, checked exactly", () => {
  it("optimalSwitchPercentage is exactly 50", () => {
    expect(optimalSwitchPercentage(SYMMETRIC)).toBe(50);
  });

  it("optimalSwitchDistance is exactly H/2", () => {
    expect(optimalSwitchDistance(SYMMETRIC)).toBe(SYMMETRIC.H / 2);
  });

  it("optimalSwitchSpeed matches Beginner's switchSpeed(model, 50) exactly", () => {
    const beginnerModel: Model = { H: SYMMETRIC.H, a: SYMMETRIC.a };
    expect(optimalSwitchSpeed(SYMMETRIC)).toBe(switchSpeed(beginnerModel, 50));
  });

  it("optimalTime matches Beginner's stopTime(model, 50) exactly", () => {
    const beginnerModel: Model = { H: SYMMETRIC.H, a: SYMMETRIC.a };
    expect(optimalTime(SYMMETRIC)).toBe(stopTime(beginnerModel, 50));
  });

  it.each([1, 30, 50, 63, 100])("classifyAdvanced(p=%i) agrees with Beginner's classify", (p) => {
    expect(classifyAdvanced(SYMMETRIC, p)).toBe(classify(p));
  });
});

describe("asymmetric case (H=10, a=1.5, b=2) — verified reference values", () => {
  it("optimalSwitchPercentage ≈ 57.142857", () => {
    expect(optimalSwitchPercentage(ASYMMETRIC)).toBeCloseTo(57.142857, 6);
  });

  it("optimalSwitchDistance ≈ 5.714286", () => {
    expect(optimalSwitchDistance(ASYMMETRIC)).toBeCloseTo(5.714286, 6);
  });

  it("optimalSwitchSpeed ≈ 4.140393", () => {
    expect(optimalSwitchSpeed(ASYMMETRIC)).toBeCloseTo(4.140393, 6);
  });

  it("optimalTime ≈ 4.830459", () => {
    expect(optimalTime(ASYMMETRIC)).toBeCloseTo(4.830459, 6);
  });

  it("stopPositionAdvanced at the optimal percentage lands within 1e-9 m of H", () => {
    const diff = Math.abs(stopPositionAdvanced(ASYMMETRIC, ASYMMETRIC_P_STAR) - ASYMMETRIC.H);
    expect(diff).toBeLessThan(1e-9);
  });

  it("p=30: exact clean-number case (s=3, xStop=5.25, t1=2, v1=3, t2 implied, T=3.5)", () => {
    expect(switchDistanceAdvanced(ASYMMETRIC, 30)).toBe(3);
    expect(stopPositionAdvanced(ASYMMETRIC, 30)).toBe(5.25);
    expect(switchTimeAdvanced(ASYMMETRIC, 30)).toBe(2);
    expect(switchSpeedAdvanced(ASYMMETRIC, 30)).toBe(3);
    expect(stopTimeAdvanced(ASYMMETRIC, 30)).toBeCloseTo(3.5, 10);
  });

  it("p=80: overshoot case with a clean H-crossing speed (v(H)=4 exactly)", () => {
    expect(stopPositionAdvanced(ASYMMETRIC, 80)).toBe(14);
    expect(speedAtTargetAdvanced(ASYMMETRIC, 80)).toBeCloseTo(4, 10);
    expect(crossingTimeAdvanced(ASYMMETRIC, 80)).toBeCloseTo(3.715476, 6);
  });
});

describe("classifyAdvanced — short/correct/overshoot on the asymmetric case", () => {
  it("p=30 is short (xStop=5.25 < H=10)", () => {
    expect(classifyAdvanced(ASYMMETRIC, 30)).toBe("short");
  });

  it("p=80 is overshoot (xStop=14 > H=10)", () => {
    expect(classifyAdvanced(ASYMMETRIC, 80)).toBe("overshoot");
  });

  it("p=p* is correct", () => {
    expect(classifyAdvanced(ASYMMETRIC, ASYMMETRIC_P_STAR)).toBe("correct");
  });

  it("the 1e-9 m tolerance is tight, not wide: p* ± 0.0001 percentage points (≈1.75e-5 m in stopping position, four orders of magnitude past the tolerance) is short/overshoot, not correct", () => {
    expect(classifyAdvanced(ASYMMETRIC, ASYMMETRIC_P_STAR - 0.0001)).toBe("short");
    expect(classifyAdvanced(ASYMMETRIC, ASYMMETRIC_P_STAR + 0.0001)).toBe("overshoot");
  });
});

describe("speedAtTargetAdvanced/crossingTimeAdvanced domain — defined only for overshoot", () => {
  it("short (p=30): both undefined", () => {
    expect(speedAtTargetAdvanced(ASYMMETRIC, 30)).toBeUndefined();
    expect(crossingTimeAdvanced(ASYMMETRIC, 30)).toBeUndefined();
  });

  it("correct (p=p*): both undefined", () => {
    expect(speedAtTargetAdvanced(ASYMMETRIC, ASYMMETRIC_P_STAR)).toBeUndefined();
    expect(crossingTimeAdvanced(ASYMMETRIC, ASYMMETRIC_P_STAR)).toBeUndefined();
  });

  it("overshoot (p=80): both defined and positive", () => {
    expect(speedAtTargetAdvanced(ASYMMETRIC, 80) as number).toBeGreaterThan(0);
    expect(crossingTimeAdvanced(ASYMMETRIC, 80) as number).toBeGreaterThan(0);
  });
});

describe("buildAdvancedAttemptResult — variant shape and category-specific fields", () => {
  it("short (p=30) has shortfall only", () => {
    const result = buildAdvancedAttemptResult(ASYMMETRIC, 30) as Extract<
      AdvancedAttemptResult,
      { classification: "short" }
    >;
    expect(result.classification).toBe("short");
    expect(result.p).toBe(30);
    expect(result.switchState).toEqual({
      position: switchDistanceAdvanced(ASYMMETRIC, 30),
      velocity: switchSpeedAdvanced(ASYMMETRIC, 30),
      time: switchTimeAdvanced(ASYMMETRIC, 30),
    });
    expect(result.finalState).toEqual({
      position: stopPositionAdvanced(ASYMMETRIC, 30),
      velocity: 0,
      time: stopTimeAdvanced(ASYMMETRIC, 30),
    });
    expect(result.shortfall).toBeCloseTo(ASYMMETRIC.H - stopPositionAdvanced(ASYMMETRIC, 30), 10);
    expect(Object.hasOwn(result, "minimumTime")).toBe(false);
    expect(Object.hasOwn(result, "velocityAtTarget")).toBe(false);
    expect(Object.hasOwn(result, "targetCrossingTime")).toBe(false);
  });

  it("correct (p=p*) has minimumTime only", () => {
    const result = buildAdvancedAttemptResult(ASYMMETRIC, ASYMMETRIC_P_STAR) as Extract<
      AdvancedAttemptResult,
      { classification: "correct" }
    >;
    expect(result.classification).toBe("correct");
    expect(result.p).toBe(ASYMMETRIC_P_STAR);
    expect(result.minimumTime).toBe(stopTimeAdvanced(ASYMMETRIC, ASYMMETRIC_P_STAR));
    expect(Object.hasOwn(result, "shortfall")).toBe(false);
    expect(Object.hasOwn(result, "velocityAtTarget")).toBe(false);
    expect(Object.hasOwn(result, "targetCrossingTime")).toBe(false);
  });

  it("overshoot (p=80) has velocityAtTarget/targetCrossingTime only", () => {
    const result = buildAdvancedAttemptResult(ASYMMETRIC, 80) as Extract<
      AdvancedAttemptResult,
      { classification: "overshoot" }
    >;
    expect(result.classification).toBe("overshoot");
    expect(result.p).toBe(80);
    expect(result.velocityAtTarget).toBe(speedAtTargetAdvanced(ASYMMETRIC, 80));
    expect(result.targetCrossingTime).toBe(crossingTimeAdvanced(ASYMMETRIC, 80));
    expect(Object.hasOwn(result, "shortfall")).toBe(false);
    expect(Object.hasOwn(result, "minimumTime")).toBe(false);
  });
});

describe("buildAdvancedAttemptResult input contract", () => {
  it("rejects an invalid model before an invalid p — error names the model, not p", () => {
    expect(() => buildAdvancedAttemptResult({ H: -1, a: 1.5, b: 2 }, 999)).toThrow(/H must be/);
  });

  it("rejects p out of [1,100]", () => {
    expect(() => buildAdvancedAttemptResult(ASYMMETRIC, 101)).toThrow(RangeError);
  });
});

describe("positionAtAdvanced/velocityAtAdvanced — match Beginner exactly at b=a", () => {
  const beginnerModel: Model = { H: SYMMETRIC.H, a: SYMMETRIC.a };

  it.each([1, 30, 50, 63, 100])("p=%i, sampled through the whole trajectory", (p) => {
    const stop = stopTimeAdvanced(SYMMETRIC, p);
    for (const fraction of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const t = fraction * stop;
      expect(positionAtAdvanced(SYMMETRIC, p, t)).toBeCloseTo(positionAt(beginnerModel, p, t), 10);
      expect(velocityAtAdvanced(SYMMETRIC, p, t)).toBeCloseTo(velocityAt(beginnerModel, p, t), 10);
    }
  });
});

describe("positionAtAdvanced/velocityAtAdvanced — boundary identities on the asymmetric case", () => {
  it("t=0 is exactly zero position and velocity", () => {
    expect(positionAtAdvanced(ASYMMETRIC, 63, 0)).toBe(0);
    expect(velocityAtAdvanced(ASYMMETRIC, 63, 0)).toBe(0);
  });

  it("t=t1(p) matches the switch state", () => {
    const t1 = switchTimeAdvanced(ASYMMETRIC, 63);
    expect(positionAtAdvanced(ASYMMETRIC, 63, t1)).toBe(switchDistanceAdvanced(ASYMMETRIC, 63));
    expect(velocityAtAdvanced(ASYMMETRIC, 63, t1)).toBe(switchSpeedAdvanced(ASYMMETRIC, 63));
  });

  it("t=stopTimeAdvanced(p) matches the final state", () => {
    const stop = stopTimeAdvanced(ASYMMETRIC, 63);
    expect(positionAtAdvanced(ASYMMETRIC, 63, stop)).toBe(stopPositionAdvanced(ASYMMETRIC, 63));
    expect(velocityAtAdvanced(ASYMMETRIC, 63, stop)).toBe(0);
  });

  it("interior accel phase (p=63, independently computed sample instant)", () => {
    expect(positionAtAdvanced(ASYMMETRIC, 63, 1.1593101396951553)).toBeCloseTo(1.008, 9);
    expect(velocityAtAdvanced(ASYMMETRIC, 63, 1.1593101396951553)).toBeCloseTo(1.7389652095427328, 9);
  });

  it("interior brake phase (p=63, independently computed sample instant)", () => {
    expect(positionAtAdvanced(ASYMMETRIC, 63, 4.202499256394937)).toBeCloseTo(10.269, 9);
    expect(velocityAtAdvanced(ASYMMETRIC, 63, 4.202499256394937)).toBeCloseTo(1.7389652095427337, 9);
  });
});

describe("positionAtAdvanced/velocityAtAdvanced reject out-of-domain t — no clamping", () => {
  const p = 63;
  const stop = stopTimeAdvanced(ASYMMETRIC, p);
  const invalidT = [-1, -0.001, stop + 0.001, stop + 1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  it.each(invalidT)("positionAtAdvanced rejects t=%p", (t) => {
    expect(() => positionAtAdvanced(ASYMMETRIC, p, t)).toThrow(RangeError);
  });

  it.each(invalidT)("velocityAtAdvanced rejects t=%p", (t) => {
    expect(() => velocityAtAdvanced(ASYMMETRIC, p, t)).toThrow(RangeError);
  });
});

describe("DEFAULT_ADVANCED_MODEL — matches Beginner's DEFAULT_MODEL numbers", () => {
  it("H and a match, b equals a (Advanced starts exactly where Beginner left off)", () => {
    expect(DEFAULT_ADVANCED_MODEL.H).toBe(DEFAULT_MODEL.H);
    expect(DEFAULT_ADVANCED_MODEL.a).toBe(DEFAULT_MODEL.a);
    expect(DEFAULT_ADVANCED_MODEL.b).toBe(DEFAULT_MODEL.a);
  });
});
