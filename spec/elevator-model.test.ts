import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  classify,
  crossingTime,
  speedAtTarget,
  stopPosition,
  stopTime,
  switchDistance,
  switchSpeed,
  switchTime,
  type Model,
} from "../src/model/elevator";

// Test-first slice: src/model/elevator.ts does not exist yet. See
// INTERACTION.md "Acceptance criteria > Model unit tests" for what each
// group below is checking, and "Model API input contract" for the throw
// contract exercised at the end of this file.

// a=2 makes v*=T* coincide exactly; a=1 makes t1(p)=v1(p) coincide for every
// p (INTERACTION.md "Model constants and units"). a=3 here avoids both, so
// the structural checks aren't accidentally validated by a numeric fluke.
const OTHER_MODEL: Model = { H: 6, a: 3 };

const ALL_P = Array.from({ length: 100 }, (_, i) => i + 1);

describe("classify — p<50/=50/>50 (INTERACTION.md 'Verified model and formulas')", () => {
  it.each(
    ALL_P.map((p) => [p, p < 50 ? "short" : p === 50 ? "correct" : "overshoot"] as const),
  )("p=%i classifies %s", (p, expected) => {
    expect(classify(p)).toBe(expected);
  });
});

describe("stopPosition vs H — verified independently of classify()", () => {
  for (const model of [DEFAULT_MODEL, OTHER_MODEL]) {
    it.each(ALL_P)(`model H=${model.H} a=${model.a}, p=%i`, (p) => {
      const xStop = stopPosition(model, p);
      if (p < 50) expect(xStop).toBeLessThan(model.H);
      else if (p === 50) expect(xStop).toBe(model.H); // s(50)=H/2 exactly
      else expect(xStop).toBeGreaterThan(model.H);
    });
  }
});

describe("structural invariant — t1(p) = T(p)/2 for any p", () => {
  for (const model of [DEFAULT_MODEL, OTHER_MODEL]) {
    it.each(ALL_P)(`model H=${model.H} a=${model.a}, p=%i`, (p) => {
      expect(switchTime(model, p)).toBeCloseTo(stopTime(model, p) / 2, 10);
    });
  }
});

describe("speedAtTarget domain — real-valued only for p>=50", () => {
  it.each(ALL_P.filter((p) => p < 50))("p=%i is undefined (H never reached)", (p) => {
    expect(speedAtTarget(DEFAULT_MODEL, p)).toBeUndefined();
  });

  it("p=50 is exactly 0 (arrives at H at rest)", () => {
    expect(speedAtTarget(DEFAULT_MODEL, 50)).toBe(0);
  });

  it.each(ALL_P.filter((p) => p > 50))("p=%i is positive", (p) => {
    expect(speedAtTarget(DEFAULT_MODEL, p) as number).toBeGreaterThan(0);
  });
});

describe("crossingTime domain — distinct event only for p>50", () => {
  it.each(ALL_P.filter((p) => p <= 50))("p=%i is undefined (no separate crossing event)", (p) => {
    expect(crossingTime(DEFAULT_MODEL, p)).toBeUndefined();
  });

  it.each(ALL_P.filter((p) => p > 50))("p=%i is defined and non-negative", (p) => {
    const t = crossingTime(DEFAULT_MODEL, p);
    expect(t).not.toBeUndefined();
    expect(t as number).toBeGreaterThanOrEqual(0);
  });
});

describe("boundary coincidence at p=100 — 'never brake before the target' extreme", () => {
  it("crossingTime(100) coincides with switchTime(100)", () => {
    expect(crossingTime(DEFAULT_MODEL, 100)).toBeCloseTo(switchTime(DEFAULT_MODEL, 100), 10);
  });
});

describe("literal reference values (INTERACTION.md 'Model constants and units')", () => {
  it("p=50: s*=5 m, v*≈3.872983 m/s, T*≈5.163978 s", () => {
    expect(switchDistance(DEFAULT_MODEL, 50)).toBe(5);
    expect(switchSpeed(DEFAULT_MODEL, 50)).toBeCloseTo(3.872983, 6);
    expect(stopTime(DEFAULT_MODEL, 50)).toBeCloseTo(5.163978, 6);
  });

  it("p=100: v(H,100)≈5.477226 m/s, xStop=20 m, T(100)≈7.302967 s", () => {
    expect(speedAtTarget(DEFAULT_MODEL, 100)).toBeCloseTo(5.477226, 6);
    expect(stopPosition(DEFAULT_MODEL, 100)).toBe(20);
    expect(stopTime(DEFAULT_MODEL, 100)).toBeCloseTo(7.302967, 6);
  });
});

describe("input contract (INTERACTION.md 'Model API input contract')", () => {
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
    expect(() => stopPosition({ H, a: DEFAULT_MODEL.a }, 50)).toThrow(RangeError);
  });

  it.each(invalidA)("rejects a=%p", (a) => {
    expect(() => stopPosition({ H: DEFAULT_MODEL.H, a }, 50)).toThrow(RangeError);
  });

  it.each(invalidP)("rejects p=%p (classify)", (p) => {
    expect(() => classify(p)).toThrow(RangeError);
  });

  it.each(invalidP)("rejects p=%p (stopPosition)", (p) => {
    expect(() => stopPosition(DEFAULT_MODEL, p)).toThrow(RangeError);
  });
});
