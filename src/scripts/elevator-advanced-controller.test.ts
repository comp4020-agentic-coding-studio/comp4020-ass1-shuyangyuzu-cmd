import { describe, expect, it } from "vitest";
import { buildAdvancedAttemptResult, DEFAULT_ADVANCED_MODEL, type AdvancedModel } from "../model/elevator";
import {
  completeAdvancedRun,
  initialAdvancedUIState,
  retryAdvanced,
  runAdvanced,
  setAdvancedModel,
  setAdvancedPercentage,
  type AdvancedPredictingState,
  type AdvancedResultState,
  type AdvancedRunningState,
  type AdvancedUIState,
} from "./elevator-advanced-controller";

// Test-first slice: src/scripts/elevator-advanced-controller.ts does not
// exist yet. See INTERACTION.md "Advanced mode in Play (approved)" >
// "Advanced controller" for the AdvancedPredictingState/AdvancedRunningState/
// AdvancedResultState contract exercised below, which mirrors
// elevator-controller.ts one-for-one with an added model field and a new
// setAdvancedModel transition.

const INVALID_PERCENTAGES = [0, 101, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
const INVALID_MODELS: AdvancedModel[] = [
  { H: 0, a: 1.5, b: 1.5 },
  { H: 10, a: 0, b: 1.5 },
  { H: 10, a: 1.5, b: 0 },
  { H: Number.NaN, a: 1.5, b: 1.5 },
];

describe("initialAdvancedUIState", () => {
  it("starts Predicting at p=35 with DEFAULT_ADVANCED_MODEL and no result", () => {
    expect(initialAdvancedUIState).toEqual({
      phase: "predicting",
      model: DEFAULT_ADVANCED_MODEL,
      p: 35,
      result: null,
    });
  });
});

describe("setAdvancedPercentage", () => {
  it("returns a new AdvancedPredictingState without mutating its input, preserving model", () => {
    const before = initialAdvancedUIState;
    const after = setAdvancedPercentage(before, 71);

    expect(after).toEqual({ phase: "predicting", model: DEFAULT_ADVANCED_MODEL, p: 71, result: null });
    expect(after).not.toBe(before);
    expect(before).toEqual({ phase: "predicting", model: DEFAULT_ADVANCED_MODEL, p: 35, result: null });
  });

  it.each([1, 57.142857142857146, 100])("accepts valid non-integer p=%s while Predicting", (p) => {
    expect(setAdvancedPercentage(initialAdvancedUIState, p)).toEqual({
      phase: "predicting",
      model: DEFAULT_ADVANCED_MODEL,
      p,
      result: null,
    });
  });

  it.each(INVALID_PERCENTAGES)("rejects invalid p=%s with RangeError while Predicting", (p) => {
    expect(() => setAdvancedPercentage(initialAdvancedUIState, p)).toThrow(RangeError);
  });

  it("rejects being called on a RunningState with Error, not RangeError", () => {
    const runningState: AdvancedUIState = runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 35));

    expect(() => setAdvancedPercentage(runningState, 50)).toThrow('setAdvancedPercentage is not valid in phase "running"');

    let caught: unknown;
    try {
      setAdvancedPercentage(runningState, 50);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
  });

  it("rejects being called on a ResultState with Error, not RangeError", () => {
    const resultState: AdvancedUIState = completeAdvancedRun(runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 35)));

    expect(() => setAdvancedPercentage(resultState, 50)).toThrow('setAdvancedPercentage is not valid in phase "result"');

    let caught: unknown;
    try {
      setAdvancedPercentage(resultState, 50);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
  });

  it("checks phase before the percentage value — an invalid p on a ResultState still throws the phase Error, not RangeError", () => {
    const resultState: AdvancedUIState = completeAdvancedRun(runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 35)));

    let caught: unknown;
    try {
      setAdvancedPercentage(resultState, 0);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
    expect((caught as Error).message).toBe('setAdvancedPercentage is not valid in phase "result"');
  });
});

describe("setAdvancedModel", () => {
  it("returns a new AdvancedPredictingState with the new model, preserving p, without mutating its input", () => {
    const before = initialAdvancedUIState;
    const newModel: AdvancedModel = { H: 12, a: 2, b: 1 };
    const after = setAdvancedModel(before, newModel);

    expect(after).toEqual({ phase: "predicting", model: newModel, p: 35, result: null });
    expect(after).not.toBe(before);
    expect(before).toEqual({ phase: "predicting", model: DEFAULT_ADVANCED_MODEL, p: 35, result: null });
  });

  it.each(INVALID_MODELS)("rejects invalid model=%o with RangeError while Predicting", (model) => {
    expect(() => setAdvancedModel(initialAdvancedUIState, model)).toThrow(RangeError);
  });

  it("rejects being called on a RunningState with Error, not RangeError", () => {
    const runningState: AdvancedUIState = runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 35));

    expect(() => setAdvancedModel(runningState, { H: 12, a: 2, b: 1 })).toThrow(
      'setAdvancedModel is not valid in phase "running"',
    );

    let caught: unknown;
    try {
      setAdvancedModel(runningState, { H: 12, a: 2, b: 1 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
  });

  it("rejects being called on a ResultState with Error, not RangeError", () => {
    const resultState: AdvancedUIState = completeAdvancedRun(runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 35)));

    expect(() => setAdvancedModel(resultState, { H: 12, a: 2, b: 1 })).toThrow(
      'setAdvancedModel is not valid in phase "result"',
    );

    let caught: unknown;
    try {
      setAdvancedModel(resultState, { H: 12, a: 2, b: 1 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
  });

  it("checks phase before the model value — an invalid model on a ResultState still throws the phase Error, not RangeError", () => {
    const resultState: AdvancedUIState = completeAdvancedRun(runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 35)));

    let caught: unknown;
    try {
      setAdvancedModel(resultState, { H: 0, a: 1.5, b: 1.5 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
    expect((caught as Error).message).toBe('setAdvancedModel is not valid in phase "result"');
  });
});

describe("runAdvanced", () => {
  it("locks model and p and returns an AdvancedRunningState whose result already equals buildAdvancedAttemptResult(model, p)", () => {
    const predicting: AdvancedPredictingState = setAdvancedPercentage(initialAdvancedUIState, 35);
    const result = runAdvanced(predicting);

    expect(result).toEqual({
      phase: "running",
      model: DEFAULT_ADVANCED_MODEL,
      p: 35,
      result: buildAdvancedAttemptResult(DEFAULT_ADVANCED_MODEL, 35),
    });
    expect(result).not.toBe(predicting);
    expect(predicting).toEqual({ phase: "predicting", model: DEFAULT_ADVANCED_MODEL, p: 35, result: null });
  });

  it("throws when called on a RunningState", () => {
    const runningState: AdvancedUIState = runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 50));

    expect(() => runAdvanced(runningState)).toThrow('runAdvanced is not valid in phase "running"');
    expect(() => runAdvanced(runningState)).not.toThrow(RangeError);
  });

  it("throws when called on a ResultState", () => {
    const resultState: AdvancedUIState = completeAdvancedRun(runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 50)));

    expect(() => runAdvanced(resultState)).toThrow('runAdvanced is not valid in phase "result"');
    expect(() => runAdvanced(resultState)).not.toThrow(RangeError);
  });
});

describe("completeAdvancedRun", () => {
  it("forwards the already-computed result, model, and p unchanged, transitioning Running to Result", () => {
    const runningState: AdvancedRunningState = runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 71));
    const resultState = completeAdvancedRun(runningState);

    expect(resultState).toEqual({
      phase: "result",
      model: DEFAULT_ADVANCED_MODEL,
      p: 71,
      result: runningState.result,
    });
    expect(resultState.result).toBe(runningState.result);
    expect(resultState).not.toBe(runningState);
    expect(runningState).toEqual({
      phase: "running",
      model: DEFAULT_ADVANCED_MODEL,
      p: 71,
      result: buildAdvancedAttemptResult(DEFAULT_ADVANCED_MODEL, 71),
    });
  });

  it("throws when called on a PredictingState", () => {
    const predicting: AdvancedUIState = initialAdvancedUIState;

    expect(() => completeAdvancedRun(predicting)).toThrow('completeAdvancedRun is not valid in phase "predicting"');
    expect(() => completeAdvancedRun(predicting)).not.toThrow(RangeError);
  });

  it("throws when called on a ResultState", () => {
    const resultState: AdvancedUIState = completeAdvancedRun(runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 50)));

    expect(() => completeAdvancedRun(resultState)).toThrow('completeAdvancedRun is not valid in phase "result"');
    expect(() => completeAdvancedRun(resultState)).not.toThrow(RangeError);
  });
});

describe("retryAdvanced", () => {
  it("returns to Predicting preserving both model and p that were run — not just p, without mutating the ResultState input", () => {
    const customModel: AdvancedModel = { H: 12, a: 2, b: 1 };
    const resultState: AdvancedResultState = completeAdvancedRun(
      runAdvanced(setAdvancedPercentage(setAdvancedModel(initialAdvancedUIState, customModel), 71)),
    );
    const expectedResultState: AdvancedResultState = {
      phase: "result",
      model: customModel,
      p: 71,
      result: buildAdvancedAttemptResult(customModel, 71),
    };
    expect(resultState).toEqual(expectedResultState);

    const predicting = retryAdvanced(resultState);

    expect(predicting).toEqual({ phase: "predicting", model: customModel, p: 71, result: null });
    expect(predicting).not.toBe(resultState);
    expect(resultState).toEqual(expectedResultState);
  });

  it("throws when called on a PredictingState", () => {
    const predicting: AdvancedUIState = initialAdvancedUIState;

    expect(() => retryAdvanced(predicting)).toThrow('retryAdvanced is not valid in phase "predicting"');
    expect(() => retryAdvanced(predicting)).not.toThrow(RangeError);
  });

  it("throws when called on a RunningState", () => {
    const runningState: AdvancedUIState = runAdvanced(setAdvancedPercentage(initialAdvancedUIState, 50));

    expect(() => retryAdvanced(runningState)).toThrow('retryAdvanced is not valid in phase "running"');
    expect(() => retryAdvanced(runningState)).not.toThrow(RangeError);
  });
});
