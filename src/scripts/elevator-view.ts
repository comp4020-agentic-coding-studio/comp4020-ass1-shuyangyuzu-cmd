import type { AttemptResult } from "../model/elevator";

export type DisplayField = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
};

export type ResultView = {
  readonly heading: string;
  readonly explanation: string;
  readonly fields: readonly DisplayField[];
  readonly minimumMessage?: string;
};

export const DISCLAIMER =
  "This is a simplified model. It treats the elevator as a single point that speeds up and slows down at a fixed rate. It ignores motor behaviour, weight, cables, comfort, and other real-world limits.";

export const COPY = {
  heading: "Bring the elevator to a stop at the target",
  task:
    "Choose where the elevator should start braking, then run it. The goal isn't just to reach the target — it must be completely stopped when it gets there.",
  sliderLabel: "Start braking at this percentage of the distance to the target",
  runButton: "Run",
  retryButton: "Try again",
} as const;

export function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

const HEADINGS: Record<AttemptResult["classification"], string> = {
  short: "Too early",
  correct: "Exactly right",
  overshoot: "Too late",
};

const EXPLANATIONS: Record<AttemptResult["classification"], string> = {
  short:
    "Braking started too early. The elevator stopped at rest, but before the target. Move the braking point higher and try again.",
  correct: "The elevator reached the target exactly as its velocity reached zero. This is the fastest valid journey.",
  overshoot:
    "The elevator reached the target while it was still moving, so it stopped beyond it. Move the braking point lower and try again.",
};

function sharedFields(result: AttemptResult): DisplayField[] {
  return [
    { key: "percentage", label: "Braking started at", value: `${result.p}%` },
    { key: "finalPosition", label: "Final position", value: `${formatNumber(result.finalState.position)} m` },
    { key: "finalVelocity", label: "Final velocity", value: `${formatNumber(result.finalState.velocity)} m/s` },
    { key: "elapsedTime", label: "Time taken", value: `${formatNumber(result.finalState.time)} s` },
  ];
}

export function resultView(result: AttemptResult): ResultView {
  const heading = HEADINGS[result.classification];
  const explanation = EXPLANATIONS[result.classification];
  const fields = sharedFields(result);

  if (result.classification === "short") {
    return {
      heading,
      explanation,
      fields: [
        ...fields,
        { key: "shortfall", label: "Distance short of the target", value: `${formatNumber(result.shortfall)} m` },
      ],
    };
  }

  if (result.classification === "correct") {
    return {
      heading,
      explanation,
      fields,
      minimumMessage: "This is the fastest possible time to stop exactly at the target.",
    };
  }

  return {
    heading,
    explanation,
    fields: [
      ...fields,
      {
        key: "velocityAtTarget",
        label: "Velocity at the target",
        value: `${formatNumber(result.velocityAtTarget)} m/s`,
      },
    ],
  };
}
