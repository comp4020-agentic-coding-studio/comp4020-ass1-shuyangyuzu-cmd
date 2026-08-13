import { assertValidPercentage, buildAttemptResult, DEFAULT_MODEL, type AttemptResult } from "../model/elevator";

export type PredictingState = {
  readonly phase: "predicting";
  readonly p: number;
  readonly result: null;
};

export type RunningState = {
  readonly phase: "running";
  readonly p: number;
  readonly result: AttemptResult;
};

export type ResultState = {
  readonly phase: "result";
  readonly p: number;
  readonly result: AttemptResult;
};

export type UIState = PredictingState | RunningState | ResultState;

export const initialUIState: PredictingState = {
  phase: "predicting",
  p: 35,
  result: null,
};

export function setPercentage(state: UIState, p: number): PredictingState {
  if (state.phase !== "predicting") {
    throw new Error(`setPercentage is not valid in phase "${state.phase}"`);
  }
  assertValidPercentage(p);
  return { phase: "predicting", p, result: null };
}

export function run(state: UIState): RunningState {
  if (state.phase !== "predicting") {
    throw new Error(`run is not valid in phase "${state.phase}"`);
  }
  const { p } = state;
  return { phase: "running", p, result: buildAttemptResult(DEFAULT_MODEL, p) };
}

export function completeRun(state: UIState): ResultState {
  if (state.phase !== "running") {
    throw new Error(`completeRun is not valid in phase "${state.phase}"`);
  }
  return { phase: "result", p: state.p, result: state.result };
}

export function retry(state: UIState): PredictingState {
  if (state.phase !== "result") {
    throw new Error(`retry is not valid in phase "${state.phase}"`);
  }
  return { phase: "predicting", p: state.p, result: null };
}
