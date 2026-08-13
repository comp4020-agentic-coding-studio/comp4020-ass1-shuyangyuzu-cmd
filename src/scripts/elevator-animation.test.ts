import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, stopTime, type Model } from "../model/elevator";
import { physicalTimeAt, projectToShaftPercent, shaftDomain, visualDuration } from "./elevator-animation";

// Test-first slice: src/scripts/elevator-animation.ts does not exist yet.
// See INTERACTION.md "Second UI slice — Running phase, animation, and shaft
// visual (approved)" > "Animation architecture" and "Shaft visual and
// coordinate system" for the contract exercised below, and
// "Running-phase and animation tests (this slice)" items 3-4 for the
// acceptance criteria this file covers.

const INVALID_H = [0, -10, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
const INVALID_A = [0, -1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
const INVALID_POSITIVE_FINITE = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe("shaftDomain", () => {
  it("returns 2H for the default model", () => {
    expect(shaftDomain(DEFAULT_MODEL)).toBe(2 * DEFAULT_MODEL.H);
  });

  it.each([
    { H: 5, a: 2 },
    { H: 1, a: 1 },
    { H: 100, a: 0.5 },
  ] as Model[])("returns 2H for a model with H=$H", (model) => {
    expect(shaftDomain(model)).toBe(2 * model.H);
  });

  it.each(INVALID_H)("rejects H=%p with RangeError", (H) => {
    expect(() => shaftDomain({ H, a: DEFAULT_MODEL.a })).toThrow(RangeError);
  });

  it.each(INVALID_A)("rejects a=%p with RangeError", (a) => {
    expect(() => shaftDomain({ H: DEFAULT_MODEL.H, a })).toThrow(RangeError);
  });
});

describe("visualDuration", () => {
  it("floors at 0.8s when 0.45 x stopTime is smaller", () => {
    expect(visualDuration(1)).toBe(0.8);
  });

  it("scales as 0.45 x stopTime once that exceeds the floor", () => {
    const stop = stopTime(DEFAULT_MODEL, 50);
    expect(visualDuration(stop)).toBeCloseTo(0.45 * stop, 10);
  });

  it("matches max(0.8, 0.45 x stopTime) across a full sweep of p", () => {
    for (let p = 1; p <= 100; p++) {
      const stop = stopTime(DEFAULT_MODEL, p);
      expect(visualDuration(stop)).toBeCloseTo(Math.max(0.8, 0.45 * stop), 10);
    }
  });

  it.each(INVALID_POSITIVE_FINITE)("rejects stopTimeS=%p with RangeError, without clamping", (stopTimeS) => {
    expect(() => visualDuration(stopTimeS)).toThrow(RangeError);
  });
});

describe("physicalTimeAt", () => {
  const stopTimeS = 10;
  const visualDurationMs = 1000;

  it("returns 0 at wallElapsedMs=0", () => {
    expect(physicalTimeAt(0, visualDurationMs, stopTimeS)).toBe(0);
  });

  it("scales linearly for wallElapsedMs strictly inside the playback window", () => {
    expect(physicalTimeAt(visualDurationMs * 0.5, visualDurationMs, stopTimeS)).toBeCloseTo(stopTimeS * 0.5, 10);
  });

  it("returns exactly stopTimeS at wallElapsedMs=visualDurationMs", () => {
    expect(physicalTimeAt(visualDurationMs, visualDurationMs, stopTimeS)).toBe(stopTimeS);
  });

  it("clamps (does not throw) for wallElapsedMs past visualDurationMs — the one approved clamp", () => {
    expect(physicalTimeAt(visualDurationMs * 2, visualDurationMs, stopTimeS)).toBe(stopTimeS);
    expect(physicalTimeAt(visualDurationMs * 100, visualDurationMs, stopTimeS)).toBe(stopTimeS);
  });

  it.each([-1, -0.001, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects wallElapsedMs=%p with RangeError — negative/non-finite is not the approved clamp",
    (wallElapsedMs) => {
      expect(() => physicalTimeAt(wallElapsedMs, visualDurationMs, stopTimeS)).toThrow(RangeError);
    },
  );

  it.each(INVALID_POSITIVE_FINITE)("rejects visualDurationMs=%p with RangeError", (invalid) => {
    expect(() => physicalTimeAt(0, invalid, stopTimeS)).toThrow(RangeError);
  });

  it.each(INVALID_POSITIVE_FINITE)("rejects stopTimeS=%p with RangeError", (invalid) => {
    expect(() => physicalTimeAt(0, visualDurationMs, invalid)).toThrow(RangeError);
  });
});

describe("projectToShaftPercent", () => {
  const extent = shaftDomain(DEFAULT_MODEL); // 2H = 20

  it("gives exactly 0, 50, and 100 at 0, H, and 2H", () => {
    expect(projectToShaftPercent(0, extent)).toBe(0);
    expect(projectToShaftPercent(DEFAULT_MODEL.H, extent)).toBe(50);
    expect(projectToShaftPercent(extent, extent)).toBe(100);
  });

  it("returns a value proportional to position/extent for interior positions", () => {
    for (const fraction of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
      const percent = projectToShaftPercent(fraction * extent, extent);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
      expect(percent).toBeCloseTo(fraction * 100, 10);
    }
  });

  it("takes exactly two parameters — position and extent — never a pixel/viewport dimension", () => {
    expect(projectToShaftPercent.length).toBe(2);
  });

  it.each(INVALID_POSITIVE_FINITE)("rejects extent=%p with RangeError before checking position", (invalidExtent) => {
    expect(() => projectToShaftPercent(0, invalidExtent)).toThrow(RangeError);
  });

  it.each([-1, -0.001, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects position=%p with RangeError for a valid extent",
    (invalidPosition) => {
      expect(() => projectToShaftPercent(invalidPosition, extent)).toThrow(RangeError);
    },
  );

  it("rejects position > extent with RangeError", () => {
    expect(() => projectToShaftPercent(extent + 0.001, extent)).toThrow(RangeError);
  });
});
