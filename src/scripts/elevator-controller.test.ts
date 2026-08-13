import { describe, expect, it } from "vitest";
import { buildAttemptResult, DEFAULT_MODEL } from "../model/elevator";
import {
  initialUIState,
  retry,
  run,
  setPercentage,
  type PredictingState,
  type ResultState,
  type UIState,
} from "./elevator-controller";

// Test-first slice: src/scripts/elevator-controller.ts does not exist yet.
// See INTERACTION.md "First UI slice — controller and markup contract
// (approved)" for the state shape and transition rules, and "First UI slice
// component tests (Predicting/Result only)" for the acceptance criteria
// exercised below.

const INVALID_PERCENTAGES = [0, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe("initialUIState", () => {
  it("starts Predicting at p=35 with no result", () => {
    expect(initialUIState).toEqual({ phase: "predicting", p: 35, result: null });
  });
});

describe("setPercentage", () => {
  it("returns a new PredictingState without mutating its input", () => {
    const before = initialUIState;
    const after = setPercentage(before, 71);

    expect(after).toEqual({ phase: "predicting", p: 71, result: null });
    expect(after).not.toBe(before);
    expect(before).toEqual({ phase: "predicting", p: 35, result: null });
  });

  it.each([1, 50, 100])("accepts valid integer p=%s while Predicting", (p) => {
    expect(setPercentage(initialUIState, p)).toEqual({ phase: "predicting", p, result: null });
  });

  it.each(INVALID_PERCENTAGES)("rejects invalid p=%s with RangeError while Predicting", (p) => {
    expect(() => setPercentage(initialUIState, p)).toThrow(RangeError);
  });

  it("rejects being called on a ResultState with Error, not RangeError", () => {
    const resultState: UIState = run(setPercentage(initialUIState, 35));

    expect(() => setPercentage(resultState, 50)).toThrow('setPercentage is not valid in phase "result"');

    let caught: unknown;
    try {
      setPercentage(resultState, 50);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
  });

  it("checks phase before the percentage value — an invalid p on a ResultState still throws the phase Error, not RangeError", () => {
    const resultState: UIState = run(setPercentage(initialUIState, 35));

    let caught: unknown;
    try {
      setPercentage(resultState, 0);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
    expect((caught as Error).message).toBe('setPercentage is not valid in phase "result"');
  });
});

describe("run", () => {
  it("snapshots p and builds the AttemptResult for the locked percentage", () => {
    const predicting: PredictingState = setPercentage(initialUIState, 35);
    const result = run(predicting);

    expect(result).toEqual({
      phase: "result",
      p: 35,
      result: buildAttemptResult(DEFAULT_MODEL, 35),
    });
    expect(result).not.toBe(predicting);
    expect(predicting).toEqual({ phase: "predicting", p: 35, result: null });
  });

  it("throws when called on a ResultState", () => {
    const resultState: UIState = run(setPercentage(initialUIState, 50));

    expect(() => run(resultState)).toThrow('run is not valid in phase "result"');
    expect(() => run(resultState)).not.toThrow(RangeError);
  });
});

describe("retry", () => {
  it("returns to Predicting preserving the p that was run, not a fixed default, without mutating the ResultState input", () => {
    const resultState: ResultState = run(setPercentage(initialUIState, 71));
    const expectedResultState: ResultState = {
      phase: "result",
      p: 71,
      result: buildAttemptResult(DEFAULT_MODEL, 71),
    };
    expect(resultState).toEqual(expectedResultState);

    const predicting = retry(resultState);

    expect(predicting).toEqual({ phase: "predicting", p: 71, result: null });
    expect(predicting).not.toBe(resultState);
    expect(resultState).toEqual(expectedResultState);
  });

  it("throws when called on a PredictingState", () => {
    const predicting: UIState = initialUIState;

    expect(() => retry(predicting)).toThrow('retry is not valid in phase "predicting"');
    expect(() => retry(predicting)).not.toThrow(RangeError);
  });
});
