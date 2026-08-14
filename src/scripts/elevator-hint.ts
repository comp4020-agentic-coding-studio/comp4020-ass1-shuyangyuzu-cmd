import { assertValidPercentage } from "../model/elevator";
import { formatNumber } from "./elevator-view";

export type HintPhase = "hidden" | "conceptual" | "revealed";

export type HintState = {
  readonly phase: HintPhase;
};

export const initialHintState: HintState = { phase: "hidden" };

export function showConceptualHint(state: HintState): HintState {
  if (state.phase !== "hidden") {
    throw new Error(`showConceptualHint is not valid in phase "${state.phase}"`);
  }
  return { phase: "conceptual" };
}

export function revealFastestValid(state: HintState): HintState {
  if (state.phase !== "conceptual") {
    throw new Error(`revealFastestValid is not valid in phase "${state.phase}"`);
  }
  return { phase: "revealed" };
}

export function resetHint(): HintState {
  return initialHintState;
}

export const BEGINNER_FASTEST_VALID_P = 50;

export type HintComparison = {
  readonly yourBrake: number;
  readonly fastestValid: number;
  readonly differenceLabel: string;
  readonly matches: boolean;
};

function assertValidFastestValidP(fastestValidP: number): void {
  if (!Number.isFinite(fastestValidP) || fastestValidP < 0 || fastestValidP > 100) {
    throw new RangeError(`fastestValidP must be a finite number in 0..100 inclusive, got ${fastestValidP}`);
  }
}

export function buildHintComparison(p: number, fastestValidP: number): HintComparison {
  assertValidPercentage(p);
  assertValidFastestValidP(fastestValidP);

  const matches = p === fastestValidP;
  const differenceLabel = matches
    ? "Matches exactly"
    : p < fastestValidP
      ? `${formatNumber(fastestValidP - p)} percentage points too early`
      : `${formatNumber(p - fastestValidP)} percentage points too late`;

  return { yourBrake: p, fastestValid: fastestValidP, differenceLabel, matches };
}
