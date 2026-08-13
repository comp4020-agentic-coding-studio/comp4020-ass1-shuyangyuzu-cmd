import { describe, expect, it } from "vitest";
import { buildAttemptResult, DEFAULT_MODEL } from "../model/elevator";
import {
  completeRun,
  initialUIState,
  retry,
  run,
  setPercentage,
  type PredictingState,
  type ResultState,
  type RunningState,
  type UIState,
} from "./elevator-controller";

// Test-first slice: src/scripts/elevator-controller.ts does not yet export
// RunningState or completeRun, and run() does not yet return a RunningState.
// See INTERACTION.md "Second UI slice — Running phase, animation, and shaft
// visual (approved)" > "Controller extension" for the Predicting → Running →
// Result contract exercised below, which supersedes this file's original
// "First UI slice" Predicting → Result-only contract.

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

  it("rejects being called on a RunningState with Error, not RangeError", () => {
    const runningState: UIState = run(setPercentage(initialUIState, 35));

    expect(() => setPercentage(runningState, 50)).toThrow('setPercentage is not valid in phase "running"');

    let caught: unknown;
    try {
      setPercentage(runningState, 50);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
  });

  it("rejects being called on a ResultState with Error, not RangeError", () => {
    const resultState: UIState = completeRun(run(setPercentage(initialUIState, 35)));

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
    const resultState: UIState = completeRun(run(setPercentage(initialUIState, 35)));

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
  it("locks p and returns a RunningState whose result already equals buildAttemptResult(DEFAULT_MODEL, p)", () => {
    const predicting: PredictingState = setPercentage(initialUIState, 35);
    const result = run(predicting);

    expect(result).toEqual({
      phase: "running",
      p: 35,
      result: buildAttemptResult(DEFAULT_MODEL, 35),
    });
    expect(result).not.toBe(predicting);
    expect(predicting).toEqual({ phase: "predicting", p: 35, result: null });
  });

  it("throws when called on a RunningState", () => {
    const runningState: UIState = run(setPercentage(initialUIState, 50));

    expect(() => run(runningState)).toThrow('run is not valid in phase "running"');
    expect(() => run(runningState)).not.toThrow(RangeError);
  });

  it("throws when called on a ResultState", () => {
    const resultState: UIState = completeRun(run(setPercentage(initialUIState, 50)));

    expect(() => run(resultState)).toThrow('run is not valid in phase "result"');
    expect(() => run(resultState)).not.toThrow(RangeError);
  });
});

describe("completeRun", () => {
  it("forwards the already-computed result unchanged, transitioning Running to Result", () => {
    const runningState: RunningState = run(setPercentage(initialUIState, 71));
    const resultState = completeRun(runningState);

    expect(resultState).toEqual({
      phase: "result",
      p: 71,
      result: runningState.result,
    });
    expect(resultState.result).toBe(runningState.result);
    expect(resultState).not.toBe(runningState);
    expect(runningState).toEqual({
      phase: "running",
      p: 71,
      result: buildAttemptResult(DEFAULT_MODEL, 71),
    });
  });

  it("throws when called on a PredictingState", () => {
    const predicting: UIState = initialUIState;

    expect(() => completeRun(predicting)).toThrow('completeRun is not valid in phase "predicting"');
    expect(() => completeRun(predicting)).not.toThrow(RangeError);
  });

  it("throws when called on a ResultState", () => {
    const resultState: UIState = completeRun(run(setPercentage(initialUIState, 50)));

    expect(() => completeRun(resultState)).toThrow('completeRun is not valid in phase "result"');
    expect(() => completeRun(resultState)).not.toThrow(RangeError);
  });
});

describe("retry", () => {
  it("returns to Predicting preserving the p that was run, not a fixed default, without mutating the ResultState input", () => {
    const resultState: ResultState = completeRun(run(setPercentage(initialUIState, 71)));
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

  it("throws when called on a RunningState", () => {
    const runningState: UIState = run(setPercentage(initialUIState, 50));

    expect(() => retry(runningState)).toThrow('retry is not valid in phase "running"');
    expect(() => retry(runningState)).not.toThrow(RangeError);
  });
});
