import { describe, expect, it } from "vitest";
import { buildAttemptResult, DEFAULT_MODEL, positionAt, switchTime, velocityAt, type AttemptResult } from "../model/elevator";
import {
  DISCLAIMER,
  formatNumber,
  resultView,
  runningReadout,
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
