import { describe, expect, it } from "vitest";
import { formatNumber } from "./elevator-view";
import {
  BEGINNER_FASTEST_VALID_P,
  buildHintComparison,
  initialHintState,
  resetHint,
  revealFastestValid,
  showConceptualHint,
  type HintComparison,
  type HintState,
} from "./elevator-hint";

// Test-first slice: src/scripts/elevator-hint.ts does not exist yet. See
// INTERACTION.md "Third UI slice — Hint and Reveal (approved)" for the full
// contract exercised below — the phase-guarded showConceptualHint/
// revealFastestValid transitions, the unconditional resetHint, and the pure
// buildHintComparison used by both Beginner (this slice) and, later, Advanced.

const INVALID_PERCENTAGES = [0, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
const INVALID_FASTEST_VALID = [-1, 101, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe("initialHintState", () => {
  it("starts hidden", () => {
    expect(initialHintState).toEqual({ phase: "hidden" });
  });
});

describe("showConceptualHint", () => {
  it("transitions hidden -> conceptual without mutating its input", () => {
    const before: HintState = initialHintState;
    const after = showConceptualHint(before);

    expect(after).toEqual({ phase: "conceptual" });
    expect(after).not.toBe(before);
    expect(before).toEqual({ phase: "hidden" });
  });

  it("throws Error (not RangeError) when called on a conceptual state", () => {
    const conceptual = showConceptualHint(initialHintState);

    expect(() => showConceptualHint(conceptual)).toThrow('showConceptualHint is not valid in phase "conceptual"');
    expect(() => showConceptualHint(conceptual)).not.toThrow(RangeError);
  });

  it("throws Error (not RangeError) when called on a revealed state", () => {
    const revealed = revealFastestValid(showConceptualHint(initialHintState));

    expect(() => showConceptualHint(revealed)).toThrow('showConceptualHint is not valid in phase "revealed"');
    expect(() => showConceptualHint(revealed)).not.toThrow(RangeError);
  });
});

describe("revealFastestValid", () => {
  it("transitions conceptual -> revealed without mutating its input", () => {
    const conceptual = showConceptualHint(initialHintState);
    const revealed = revealFastestValid(conceptual);

    expect(revealed).toEqual({ phase: "revealed" });
    expect(revealed).not.toBe(conceptual);
    expect(conceptual).toEqual({ phase: "conceptual" });
  });

  it("throws Error (not RangeError) when called directly from hidden, skipping the conceptual step", () => {
    expect(() => revealFastestValid(initialHintState)).toThrow('revealFastestValid is not valid in phase "hidden"');
    expect(() => revealFastestValid(initialHintState)).not.toThrow(RangeError);
  });

  it("throws Error (not RangeError) when called on an already-revealed state", () => {
    const revealed = revealFastestValid(showConceptualHint(initialHintState));

    expect(() => revealFastestValid(revealed)).toThrow('revealFastestValid is not valid in phase "revealed"');
    expect(() => revealFastestValid(revealed)).not.toThrow(RangeError);
  });
});

describe("resetHint", () => {
  it("returns the initial hidden state unconditionally, taking no argument", () => {
    expect(resetHint()).toEqual({ phase: "hidden" });
    expect(resetHint()).toEqual(initialHintState);
  });
});

describe("BEGINNER_FASTEST_VALID_P", () => {
  it("is exactly 50", () => {
    expect(BEGINNER_FASTEST_VALID_P).toBe(50);
  });
});

describe("buildHintComparison", () => {
  it("reports an exact match with no difference language when p equals fastestValidP", () => {
    const comparison: HintComparison = buildHintComparison(50, BEGINNER_FASTEST_VALID_P);

    expect(comparison).toEqual({
      yourBrake: 50,
      fastestValid: 50,
      differenceLabel: "Matches exactly",
      matches: true,
    });
  });

  it.each([1, 20, 49])("reports 'too early' with the correct percentage-point gap for p=%i below fastestValidP", (p) => {
    const comparison = buildHintComparison(p, BEGINNER_FASTEST_VALID_P);

    expect(comparison.matches).toBe(false);
    expect(comparison.yourBrake).toBe(p);
    expect(comparison.fastestValid).toBe(BEGINNER_FASTEST_VALID_P);
    expect(comparison.differenceLabel).toBe(`${formatNumber(BEGINNER_FASTEST_VALID_P - p)} percentage points too early`);
  });

  it.each([51, 65, 100])("reports 'too late' with the correct percentage-point gap for p=%i above fastestValidP", (p) => {
    const comparison = buildHintComparison(p, BEGINNER_FASTEST_VALID_P);

    expect(comparison.matches).toBe(false);
    expect(comparison.yourBrake).toBe(p);
    expect(comparison.fastestValid).toBe(BEGINNER_FASTEST_VALID_P);
    expect(comparison.differenceLabel).toBe(`${formatNumber(p - BEGINNER_FASTEST_VALID_P)} percentage points too late`);
  });

  it("supports a non-integer fastestValidP (the general Advanced-mode shape), still returning plain-language differences", () => {
    const comparison = buildHintComparison(50, 37.5);

    expect(comparison.matches).toBe(false);
    expect(comparison.fastestValid).toBe(37.5);
    expect(comparison.differenceLabel).toBe(`${formatNumber(50 - 37.5)} percentage points too late`);
  });

  it.each(INVALID_PERCENTAGES)("rejects invalid p=%s with RangeError", (p) => {
    expect(() => buildHintComparison(p, BEGINNER_FASTEST_VALID_P)).toThrow(RangeError);
  });

  it.each(INVALID_FASTEST_VALID)("rejects invalid fastestValidP=%s with RangeError", (fastestValidP) => {
    expect(() => buildHintComparison(50, fastestValidP)).toThrow(RangeError);
  });
});
