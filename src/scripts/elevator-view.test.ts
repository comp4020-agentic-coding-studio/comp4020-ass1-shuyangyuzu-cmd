import { describe, expect, it } from "vitest";
import {
  buildAdvancedAttemptResult,
  buildAttemptResult,
  DEFAULT_ADVANCED_MODEL,
  DEFAULT_MODEL,
  positionAt,
  positionAtAdvanced,
  switchTime,
  switchTimeAdvanced,
  velocityAt,
  velocityAtAdvanced,
  type AdvancedAttemptResult,
  type AdvancedModel,
  type AttemptResult,
} from "../model/elevator";
import {
  advancedConceptualHint,
  COPY,
  DISCLAIMER,
  formatNumber,
  resultView,
  resultViewAdvanced,
  runningReadout,
  runningReadoutAdvanced,
  type DisplayField,
  type ResultView,
  type RunningReadout,
} from "./elevator-view";

// Test-first slice: src/scripts/elevator-view.ts does not export
// runningReadout yet. See INTERACTION.md "Approved novice copy" and
// "Display mapping and formatting" for the exact strings and field shape
// exercised in the resultView blocks below, and "Second UI slice — Running
// phase, animation, and shaft visual (approved)" items 8-9 for the
// accelerating/braking cue and position/velocity readout contract exercised
// in the runningReadout blocks at the end of this file.

const FORBIDDEN_TERMS = [
  "bang-bang",
  "pontryagin",
  "optimal control",
  "phase plane",
  "double integrator",
  "state-space",
  "switching function",
  "u(t)",
];

function assertNoForbiddenVocabulary(text: string) {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    expect(lower).not.toContain(term);
  }
}

const SHORT: AttemptResult = buildAttemptResult(DEFAULT_MODEL, 35);
const CORRECT: AttemptResult = buildAttemptResult(DEFAULT_MODEL, 50);
const OVERSHOOT: AttemptResult = buildAttemptResult(DEFAULT_MODEL, 65);

describe("formatNumber", () => {
  it("keeps up to two decimal places", () => {
    expect(formatNumber(4.320493798938573)).toBe("4.32");
    expect(formatNumber(5.163977794943222)).toBe("5.16");
    expect(formatNumber(5.887840577551898)).toBe("5.89");
  });

  it("trims trailing zeroes", () => {
    expect(formatNumber(3)).toBe("3");
    expect(formatNumber(3.1)).toBe("3.1");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(7)).toBe("7");
  });
});

describe("resultView — short (p=35)", () => {
  const view: ResultView = resultView(SHORT);

  it("uses the approved heading and explanation", () => {
    expect(view.heading).toBe("Too early");
    expect(view.explanation).toBe(
      "Braking started too early. The elevator stopped at rest, but before the target. Move the braking point higher and try again.",
    );
  });

  it("includes the shared fields plus shortfall, with correct labels and units", () => {
    expect(view.fields).toEqual([
      { key: "percentage", label: "Braking started at", value: "35%" },
      { key: "finalPosition", label: "Final position", value: "7 m" },
      { key: "finalVelocity", label: "Final velocity", value: "0 m/s" },
      { key: "elapsedTime", label: "Time taken", value: "4.32 s" },
      { key: "shortfall", label: "Distance short of the target", value: "3 m" },
    ]);
  });

  it("has no minimumMessage and no overshoot-only field", () => {
    expect(view.minimumMessage).toBeUndefined();
    expect(view.fields.some((f: { key: string }) => f.key === "velocityAtTarget")).toBe(false);
  });

  it("exposes fields as DisplayField-shaped entries", () => {
    const [percentageField]: readonly DisplayField[] = view.fields;
    expect(percentageField).toEqual({ key: "percentage", label: "Braking started at", value: "35%" });
  });
});

describe("resultView — correct (p=50)", () => {
  const view: ResultView = resultView(CORRECT);

  it("uses the approved heading and explanation", () => {
    expect(view.heading).toBe("Exactly right");
    expect(view.explanation).toBe(
      "The elevator reached the target exactly as its velocity reached zero. This is the fastest valid journey.",
    );
  });

  it("includes only the shared fields — no shortfall or velocityAtTarget", () => {
    expect(view.fields).toEqual([
      { key: "percentage", label: "Braking started at", value: "50%" },
      { key: "finalPosition", label: "Final position", value: "10 m" },
      { key: "finalVelocity", label: "Final velocity", value: "0 m/s" },
      { key: "elapsedTime", label: "Time taken", value: "5.16 s" },
    ]);
  });

  it("carries a minimumMessage that does not duplicate the elapsed-time figure as a second number", () => {
    expect(view.minimumMessage).toBe("This is the fastest possible time to stop exactly at the target.");
    expect(view.minimumMessage).not.toMatch(/\d/);
  });
});

describe("resultView — overshoot (p=65)", () => {
  const view: ResultView = resultView(OVERSHOOT);

  it("uses the approved heading and explanation", () => {
    expect(view.heading).toBe("Too late");
    expect(view.explanation).toBe(
      "The elevator reached the target while it was still moving, so it stopped beyond it. Move the braking point lower and try again.",
    );
  });

  it("includes the shared fields plus velocity at target, with correct labels and units", () => {
    expect(view.fields).toEqual([
      { key: "percentage", label: "Braking started at", value: "65%" },
      { key: "finalPosition", label: "Final position", value: "13 m" },
      { key: "finalVelocity", label: "Final velocity", value: "0 m/s" },
      { key: "elapsedTime", label: "Time taken", value: "5.89 s" },
      { key: "velocityAtTarget", label: "Velocity at the target", value: "3 m/s" },
    ]);
  });

  it("has no minimumMessage, no shortfall, and never renders targetCrossingTime", () => {
    expect(view.minimumMessage).toBeUndefined();
    expect(view.fields.some((f: { key: string }) => f.key === "shortfall")).toBe(false);
    expect(view.fields.some((f: { key: string }) => f.key === "targetCrossingTime")).toBe(false);
  });
});

describe("forbidden vocabulary and disclaimer", () => {
  it("matches the approved disclaimer copy exactly", () => {
    expect(DISCLAIMER).toBe(
      "This is a simplified model. It treats the elevator as a single point that speeds up and slows down at a fixed rate. It ignores motor behaviour, weight, cables, comfort, and other real-world limits.",
    );
  });

  it("keeps the disclaimer free of forbidden terms", () => {
    assertNoForbiddenVocabulary(DISCLAIMER);
  });

  it.each([
    ["short", SHORT],
    ["correct", CORRECT],
    ["overshoot", OVERSHOOT],
  ] as const)("keeps every %s view string free of forbidden terms", (_label, result) => {
    const view = resultView(result);
    assertNoForbiddenVocabulary(view.heading);
    assertNoForbiddenVocabulary(view.explanation);
    if (view.minimumMessage) assertNoForbiddenVocabulary(view.minimumMessage);
    for (const field of view.fields) {
      assertNoForbiddenVocabulary(field.label);
      assertNoForbiddenVocabulary(field.value);
    }
  });
});

// runningReadout formats what the Running phase displays on top of the
// already-computed trajectory. It never re-derives kinematics — that is
// proven independently in spec/elevator-trajectory.test.ts — so these tests
// check only the formatting/labelling and the accelerating/braking cue.

describe("runningReadout — position/velocity formatting", () => {
  const model = DEFAULT_MODEL;
  const p = 65;

  it("formats position and velocity with units, matching the already-computed trajectory at t", () => {
    const t = switchTime(model, p) * 0.5;
    const readout: RunningReadout = runningReadout(model, p, t);

    expect(readout.position).toBe(`${formatNumber(positionAt(model, p, t))} m`);
    expect(readout.velocity).toBe(`${formatNumber(velocityAt(model, p, t))} m/s`);
  });

  it("formats the exact t=0 boundary as '0 m' and '0 m/s'", () => {
    const readout = runningReadout(model, p, 0);

    expect(readout.position).toBe("0 m");
    expect(readout.velocity).toBe("0 m/s");
  });

  it("propagates RangeError for an out-of-domain t via the underlying trajectory functions", () => {
    expect(() => runningReadout(model, p, -1)).toThrow(RangeError);
  });
});

describe("runningReadout — accelerating/braking cue", () => {
  it.each([
    ["short", 35],
    ["correct", 50],
    ["overshoot", 65],
  ] as const)("is 'accelerating' before switchTime and 'braking' from switchTime onward for %s p=%i", (_label, p) => {
    const model = DEFAULT_MODEL;
    const tSwitch = switchTime(model, p);

    expect(runningReadout(model, p, tSwitch * 0.5).cue).toBe("accelerating");
    expect(runningReadout(model, p, tSwitch).cue).toBe("braking");
  });
});

// Advanced mode reuses Beginner's exact display conventions (see
// INTERACTION.md "Advanced mode in Play (approved)" >
// "resultViewAdvanced and runningReadoutAdvanced"). DEFAULT_ADVANCED_MODEL
// has a===b===1.5, so it is numerically identical to DEFAULT_MODEL and the
// same p=35/50/65 attempts classify as short/correct/overshoot exactly as
// Beginner's do — that equivalence is exploited below to reuse Beginner's
// known-good expected figures, while a separate asymmetric model and a
// non-integer p exercise what is actually new in the Advanced path.

const SHORT_ADV: AdvancedAttemptResult = buildAdvancedAttemptResult(DEFAULT_ADVANCED_MODEL, 35);
const CORRECT_ADV: AdvancedAttemptResult = buildAdvancedAttemptResult(DEFAULT_ADVANCED_MODEL, 50);
const OVERSHOOT_ADV: AdvancedAttemptResult = buildAdvancedAttemptResult(DEFAULT_ADVANCED_MODEL, 65);

describe("resultViewAdvanced — short (p=35)", () => {
  const view: ResultView = resultViewAdvanced(SHORT_ADV);

  it("matches Beginner's heading/explanation/fields for the numerically equivalent model", () => {
    expect(view.heading).toBe("Too early");
    expect(view.fields).toEqual([
      { key: "percentage", label: "Braking started at", value: "35%" },
      { key: "finalPosition", label: "Final position", value: "7 m" },
      { key: "finalVelocity", label: "Final velocity", value: "0 m/s" },
      { key: "elapsedTime", label: "Time taken", value: "4.32 s" },
      { key: "shortfall", label: "Distance short of the target", value: "3 m" },
    ]);
  });
});

describe("resultViewAdvanced — correct (p=50)", () => {
  const view: ResultView = resultViewAdvanced(CORRECT_ADV);

  it("carries the same minimumMessage as Beginner", () => {
    expect(view.heading).toBe("Exactly right");
    expect(view.minimumMessage).toBe("This is the fastest possible time to stop exactly at the target.");
  });
});

describe("resultViewAdvanced — overshoot (p=65)", () => {
  const view: ResultView = resultViewAdvanced(OVERSHOOT_ADV);

  it("includes velocityAtTarget like Beginner's overshoot view", () => {
    expect(view.heading).toBe("Too late");
    expect(view.fields).toEqual([
      { key: "percentage", label: "Braking started at", value: "65%" },
      { key: "finalPosition", label: "Final position", value: "13 m" },
      { key: "finalVelocity", label: "Final velocity", value: "0 m/s" },
      { key: "elapsedTime", label: "Time taken", value: "5.89 s" },
      { key: "velocityAtTarget", label: "Velocity at the target", value: "3 m/s" },
    ]);
  });
});

describe("resultViewAdvanced — non-integer p", () => {
  it("formats the percentage field via formatNumber instead of a raw template", () => {
    const asymmetric: AdvancedModel = { H: 10, a: 1, b: 2 };
    const result = buildAdvancedAttemptResult(asymmetric, 57.142857142857146);
    const view = resultViewAdvanced(result);

    const percentageField = view.fields.find((f) => f.key === "percentage");
    expect(percentageField).toEqual({
      key: "percentage",
      label: "Braking started at",
      value: `${formatNumber(57.142857142857146)}%`,
    });
    expect(percentageField?.value).toBe("57.14%");
  });
});

describe("resultViewAdvanced — forbidden vocabulary", () => {
  it.each([
    ["short", SHORT_ADV],
    ["correct", CORRECT_ADV],
    ["overshoot", OVERSHOOT_ADV],
  ] as const)("keeps every %s view string free of forbidden terms", (_label, result) => {
    const view = resultViewAdvanced(result);
    assertNoForbiddenVocabulary(view.heading);
    assertNoForbiddenVocabulary(view.explanation);
    if (view.minimumMessage) assertNoForbiddenVocabulary(view.minimumMessage);
    for (const field of view.fields) {
      assertNoForbiddenVocabulary(field.label);
      assertNoForbiddenVocabulary(field.value);
    }
  });
});

describe("runningReadoutAdvanced", () => {
  it("matches Beginner's readout for the numerically equivalent model", () => {
    const model = DEFAULT_ADVANCED_MODEL;
    const p = 65;
    const t = switchTimeAdvanced(model, p) * 0.5;

    const readout = runningReadoutAdvanced(model, p, t);
    expect(readout.position).toBe(`${formatNumber(positionAtAdvanced(model, p, t))} m`);
    expect(readout.velocity).toBe(`${formatNumber(velocityAtAdvanced(model, p, t))} m/s`);
  });

  it("uses model.b, not model.a, to determine the braking-phase readout for an asymmetric model", () => {
    const asymmetric: AdvancedModel = { H: 10, a: 1, b: 3 };
    const p = 65;
    const tSwitch = switchTimeAdvanced(asymmetric, p);
    const tAfter = tSwitch + 0.1;

    const readout = runningReadoutAdvanced(asymmetric, p, tAfter);
    expect(readout.velocity).toBe(`${formatNumber(velocityAtAdvanced(asymmetric, p, tAfter))} m/s`);
    expect(readout.cue).toBe("braking");
  });

  it("is 'accelerating' before switchTimeAdvanced and 'braking' from switchTimeAdvanced onward", () => {
    const model: AdvancedModel = { H: 10, a: 1, b: 2 };
    const p = 50;
    const tSwitch = switchTimeAdvanced(model, p);

    expect(runningReadoutAdvanced(model, p, tSwitch * 0.5).cue).toBe("accelerating");
    expect(runningReadoutAdvanced(model, p, tSwitch).cue).toBe("braking");
  });

  it("propagates RangeError for an out-of-domain t", () => {
    expect(() => runningReadoutAdvanced(DEFAULT_ADVANCED_MODEL, 65, -1)).toThrow(RangeError);
  });
});

describe("advancedConceptualHint", () => {
  it("starts with the shared conceptual hint text", () => {
    expect(advancedConceptualHint(DEFAULT_ADVANCED_MODEL).startsWith(COPY.hintConceptual)).toBe(true);
  });

  it("says the switch lands exactly halfway when a === b", () => {
    const hint = advancedConceptualHint({ H: 10, a: 1.5, b: 1.5 });
    expect(hint).toBe(
      `${COPY.hintConceptual} Braking is exactly as strong as accelerating here, so the switch should land exactly halfway.`,
    );
  });

  it("says to brake earlier than halfway when a > b (braking is weaker)", () => {
    const hint = advancedConceptualHint({ H: 10, a: 2, b: 1 });
    expect(hint).toBe(
      `${COPY.hintConceptual} Braking is weaker than accelerating here, so the switch should happen earlier than halfway.`,
    );
  });

  it("says braking can happen later than halfway when a < b (braking is stronger)", () => {
    const hint = advancedConceptualHint({ H: 10, a: 1, b: 2 });
    expect(hint).toBe(
      `${COPY.hintConceptual} Braking is stronger than accelerating here, so the switch can happen later than halfway.`,
    );
  });

  it("keeps the hint free of forbidden vocabulary in all three branches", () => {
    assertNoForbiddenVocabulary(advancedConceptualHint({ H: 10, a: 1.5, b: 1.5 }));
    assertNoForbiddenVocabulary(advancedConceptualHint({ H: 10, a: 2, b: 1 }));
    assertNoForbiddenVocabulary(advancedConceptualHint({ H: 10, a: 1, b: 2 }));
  });
});
