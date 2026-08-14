import {
  assertValidAdvancedModel,
  assertValidAdvancedPercentage,
  buildAdvancedAttemptResult,
  DEFAULT_ADVANCED_MODEL,
  type AdvancedAttemptResult,
  type AdvancedModel,
} from "../model/elevator";

export type AdvancedPredictingState = {
  readonly phase: "predicting";
  readonly model: AdvancedModel;
  readonly p: number;
  readonly result: null;
};

export type AdvancedRunningState = {
  readonly phase: "running";
  readonly model: AdvancedModel;
  readonly p: number;
  readonly result: AdvancedAttemptResult;
};

export type AdvancedResultState = {
  readonly phase: "result";
  readonly model: AdvancedModel;
  readonly p: number;
  readonly result: AdvancedAttemptResult;
};

export type AdvancedUIState = AdvancedPredictingState | AdvancedRunningState | AdvancedResultState;

export const initialAdvancedUIState: AdvancedPredictingState = {
  phase: "predicting",
  model: DEFAULT_ADVANCED_MODEL,
  p: 35,
  result: null,
};

export function setAdvancedPercentage(state: AdvancedUIState, p: number): AdvancedPredictingState {
  if (state.phase !== "predicting") {
    throw new Error(`setAdvancedPercentage is not valid in phase "${state.phase}"`);
  }
  assertValidAdvancedPercentage(p);
  return { phase: "predicting", model: state.model, p, result: null };
}

export function setAdvancedModel(state: AdvancedUIState, model: AdvancedModel): AdvancedPredictingState {
  if (state.phase !== "predicting") {
    throw new Error(`setAdvancedModel is not valid in phase "${state.phase}"`);
  }
  assertValidAdvancedModel(model);
  return { phase: "predicting", model, p: state.p, result: null };
}

export function runAdvanced(state: AdvancedUIState): AdvancedRunningState {
  if (state.phase !== "predicting") {
    throw new Error(`runAdvanced is not valid in phase "${state.phase}"`);
  }
  const { model, p } = state;
  return { phase: "running", model, p, result: buildAdvancedAttemptResult(model, p) };
}

export function completeAdvancedRun(state: AdvancedUIState): AdvancedResultState {
  if (state.phase !== "running") {
    throw new Error(`completeAdvancedRun is not valid in phase "${state.phase}"`);
  }
  return { phase: "result", model: state.model, p: state.p, result: state.result };
}

export function retryAdvanced(state: AdvancedUIState): AdvancedPredictingState {
  if (state.phase !== "result") {
    throw new Error(`retryAdvanced is not valid in phase "${state.phase}"`);
  }
  return { phase: "predicting", model: state.model, p: state.p, result: null };
}
