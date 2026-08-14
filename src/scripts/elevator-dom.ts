import { DEFAULT_MODEL, positionAt, stopTime, switchDistance, type AttemptResult } from "../model/elevator";
import { physicalTimeAt, projectToShaftPercent, shaftDomain, visualDuration } from "./elevator-animation";
import { completeRun, initialUIState, retry, run, setPercentage, type RunningState, type UIState } from "./elevator-controller";
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
import { COPY, resultView, runningReadout } from "./elevator-view";

const SHAFT_EXTENT = shaftDomain(DEFAULT_MODEL);
const FASTEST_VALID_PERCENT = projectToShaftPercent(switchDistance(DEFAULT_MODEL, BEGINNER_FASTEST_VALID_P), SHAFT_EXTENT);

export function initElevatorUI(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const view = doc.defaultView!;
  const predicting = root.querySelector<HTMLElement>('[data-testid="predicting"]')!;
  const input = predicting.querySelector<HTMLInputElement>('[data-testid="percentage-input"]')!;
  const percentageValue = predicting.querySelector<HTMLElement>('[data-testid="percentage-value"]')!;
  const runButton = predicting.querySelector<HTMLButtonElement>('[data-testid="run-button"]')!;
  const predictingBrakingMarker = predicting.querySelector<HTMLElement>('[data-testid="braking-marker"]')!;
  const shaft = predicting.querySelector<HTMLElement>('[data-testid="shaft"]')!;
  const hint = predicting.querySelector<HTMLElement>('[data-testid="hint"]')!;

  let state: UIState = initialUIState;
  let hintState: HintState = initialHintState;

  function handleRevealButtonClick(): void {
    hintState = revealFastestValid(hintState);

    hint.querySelector('[data-testid="reveal-button"]')!.remove();

    const revealed = doc.createElement("p");
    revealed.dataset.testid = "hint-revealed";
    revealed.tabIndex = -1;
    revealed.textContent = `The fastest valid braking point is ${BEGINNER_FASTEST_VALID_P}% of the way to the target.`;
    hint.appendChild(revealed);

    const marker = doc.createElement("div");
    marker.dataset.testid = "fastest-valid-marker";
    marker.className = "marker marker-fastest-valid";
    marker.style.bottom = `${FASTEST_VALID_PERCENT}%`;
    shaft.appendChild(marker);

    revealed.focus();
  }

  function handleHintButtonClick(): void {
    hintState = showConceptualHint(hintState);

    hint.querySelector('[data-testid="hint-button"]')!.remove();

    const conceptual = doc.createElement("p");
    conceptual.dataset.testid = "hint-conceptual";
    conceptual.tabIndex = -1;
    conceptual.textContent = COPY.hintConceptual;
    hint.appendChild(conceptual);

    const revealButton = doc.createElement("button");
    revealButton.type = "button";
    revealButton.dataset.testid = "reveal-button";
    revealButton.className = "comic-button";
    revealButton.textContent = COPY.revealButton;
    revealButton.addEventListener("click", handleRevealButtonClick);
    hint.appendChild(revealButton);

    conceptual.focus();
  }

  function buildHintButton(): HTMLButtonElement {
    const button = doc.createElement("button");
    button.type = "button";
    button.dataset.testid = "hint-button";
    button.className = "comic-button";
    button.textContent = COPY.hintButton;
    button.addEventListener("click", handleHintButtonClick);
    return button;
  }

  function resetHintUI(): void {
    hintState = resetHint();
    hint.querySelector('[data-testid="hint-conceptual"]')?.remove();
    hint.querySelector('[data-testid="reveal-button"]')?.remove();
    hint.querySelector('[data-testid="hint-revealed"]')?.remove();
    shaft.querySelector('[data-testid="fastest-valid-marker"]')?.remove();
    hint.appendChild(buildHintButton());
  }

  hint.querySelector<HTMLButtonElement>('[data-testid="hint-button"]')!.addEventListener("click", handleHintButtonClick);

  function renderPercentage(p: number): void {
    input.value = String(p);
    percentageValue.textContent = `${p}%`;
    predictingBrakingMarker.style.bottom = `${projectToShaftPercent(switchDistance(DEFAULT_MODEL, p), SHAFT_EXTENT)}%`;
  }

  function buildResultShaft(attemptResult: AttemptResult): HTMLElement {
    const shaft = doc.createElement("div");
    shaft.dataset.testid = "result-shaft";
    shaft.className = "shaft result-shaft";
    shaft.dataset.outcome = attemptResult.classification;
    shaft.setAttribute("aria-hidden", "true");

    const targetMarker = doc.createElement("div");
    targetMarker.className = "marker marker-target";
    targetMarker.style.bottom = `${projectToShaftPercent(DEFAULT_MODEL.H, SHAFT_EXTENT)}%`;

    const brakingMarker = doc.createElement("div");
    brakingMarker.className = "marker marker-braking";
    brakingMarker.style.bottom = `${projectToShaftPercent(switchDistance(DEFAULT_MODEL, attemptResult.p), SHAFT_EXTENT)}%`;

    const car = doc.createElement("div");
    car.className = "car";
    car.style.bottom = `${projectToShaftPercent(attemptResult.finalState.position, SHAFT_EXTENT)}%`;

    shaft.appendChild(targetMarker);
    shaft.appendChild(brakingMarker);
    shaft.appendChild(car);

    return shaft;
  }

  function buildResultSection(attemptResult: AttemptResult, hintComparison: HintComparison | undefined): HTMLElement {
    const view = resultView(attemptResult);

    const section = doc.createElement("section");
    section.dataset.testid = "result";
    section.className = "panel result-panel";
    section.tabIndex = -1;
    section.setAttribute("aria-live", "polite");
    section.setAttribute("aria-atomic", "true");

    const heading = doc.createElement("h2");
    heading.dataset.testid = "result-heading";
    heading.className = "punchline";
    heading.textContent = view.heading;
    section.appendChild(heading);

    const resultBody = doc.createElement("div");
    resultBody.className = "result-body";

    const shaftCol = doc.createElement("div");
    shaftCol.className = "shaft-col";
    shaftCol.appendChild(buildResultShaft(attemptResult));
    resultBody.appendChild(shaftCol);

    const contentCol = doc.createElement("div");
    contentCol.className = "content-col";

    const explanation = doc.createElement("p");
    explanation.dataset.testid = "result-explanation";
    explanation.textContent = view.explanation;
    contentCol.appendChild(explanation);

    const dl = doc.createElement("dl");
    for (const field of view.fields) {
      const row = doc.createElement("div");
      const dt = doc.createElement("dt");
      dt.textContent = field.label;
      const dd = doc.createElement("dd");
      dd.dataset.field = field.key;
      dd.textContent = field.value;
      row.appendChild(dt);
      row.appendChild(dd);
      dl.appendChild(row);
    }
    contentCol.appendChild(dl);

    if (view.minimumMessage !== undefined) {
      const minimumMessage = doc.createElement("p");
      minimumMessage.dataset.testid = "result-minimum-message";
      minimumMessage.textContent = view.minimumMessage;
      contentCol.appendChild(minimumMessage);
    }

    if (hintComparison !== undefined) {
      const comparison = doc.createElement("div");
      comparison.dataset.testid = "hint-comparison";

      const yourBrake = doc.createElement("span");
      yourBrake.dataset.field = "yourBrake";
      yourBrake.textContent = `${hintComparison.yourBrake}%`;
      comparison.appendChild(yourBrake);

      const fastestValid = doc.createElement("span");
      fastestValid.dataset.field = "fastestValid";
      fastestValid.textContent = `${hintComparison.fastestValid}%`;
      comparison.appendChild(fastestValid);

      const hintDifference = doc.createElement("span");
      hintDifference.dataset.field = "hintDifference";
      hintDifference.textContent = hintComparison.differenceLabel;
      comparison.appendChild(hintDifference);

      contentCol.appendChild(comparison);
    }

    resultBody.appendChild(contentCol);
    section.appendChild(resultBody);

    const retryButton = doc.createElement("button");
    retryButton.type = "button";
    retryButton.dataset.testid = "retry-button";
    retryButton.className = "comic-button";
    retryButton.textContent = COPY.retryButton;
    retryButton.addEventListener("click", () => {
      const predictingState = retry(state);
      state = predictingState;
      section.remove();
      renderPercentage(predictingState.p);
      resetHintUI();
      root.appendChild(predicting);
      input.focus();
    });
    section.appendChild(retryButton);

    return section;
  }

  function mountResult(attemptResult: AttemptResult, hintComparison: HintComparison | undefined): void {
    const result = buildResultSection(attemptResult, hintComparison);
    root.appendChild(result);
    result.focus();
  }

  function buildRunningSection(runningState: RunningState): {
    section: HTMLElement;
    car: HTMLElement;
    positionValue: HTMLElement;
    velocityValue: HTMLElement;
    cue: HTMLElement;
  } {
    const { p } = runningState;

    const section = doc.createElement("section");
    section.dataset.testid = "running";
    section.className = "panel";

    const shaftCol = doc.createElement("div");
    shaftCol.className = "shaft-col";

    const shaft = doc.createElement("div");
    shaft.dataset.testid = "shaft";
    shaft.className = "shaft";

    const targetMarker = doc.createElement("div");
    targetMarker.dataset.testid = "target-marker";
    targetMarker.className = "marker marker-target";
    targetMarker.style.bottom = `${projectToShaftPercent(DEFAULT_MODEL.H, SHAFT_EXTENT)}%`;

    const brakingMarker = doc.createElement("div");
    brakingMarker.dataset.testid = "braking-marker";
    brakingMarker.className = "marker marker-braking";
    brakingMarker.style.bottom = `${projectToShaftPercent(switchDistance(DEFAULT_MODEL, p), SHAFT_EXTENT)}%`;

    const car = doc.createElement("div");
    car.dataset.testid = "car";
    car.className = "car";
    car.style.bottom = `${projectToShaftPercent(0, SHAFT_EXTENT)}%`;

    shaft.appendChild(targetMarker);
    shaft.appendChild(brakingMarker);
    shaft.appendChild(car);
    shaftCol.appendChild(shaft);
    section.appendChild(shaftCol);

    const contentCol = doc.createElement("div");
    contentCol.className = "content-col";

    const positionRow = doc.createElement("p");
    const positionLabel = doc.createElement("span");
    positionLabel.textContent = "Position: ";
    const positionValue = doc.createElement("span");
    positionValue.dataset.testid = "running-position";
    positionValue.textContent = "0 m";
    positionRow.appendChild(positionLabel);
    positionRow.appendChild(positionValue);
    contentCol.appendChild(positionRow);

    const velocityRow = doc.createElement("p");
    const velocityLabel = doc.createElement("span");
    velocityLabel.textContent = "Velocity: ";
    const velocityValue = doc.createElement("span");
    velocityValue.dataset.testid = "running-velocity";
    velocityValue.textContent = "0 m/s";
    velocityRow.appendChild(velocityLabel);
    velocityRow.appendChild(velocityValue);
    contentCol.appendChild(velocityRow);

    const cue = doc.createElement("p");
    cue.dataset.testid = "running-cue";
    cue.dataset.cue = "accelerating";
    cue.className = "running-cue";
    cue.textContent = "Speeding up";
    contentCol.appendChild(cue);

    section.appendChild(contentCol);

    return { section, car, positionValue, velocityValue, cue };
  }

  input.addEventListener("input", () => {
    const predictingState = setPercentage(state, Number(input.value));
    state = predictingState;
    renderPercentage(predictingState.p);
  });

  runButton.addEventListener("click", () => {
    const runningState = run(state);
    state = runningState;
    const hintComparison =
      hintState.phase === "revealed" ? buildHintComparison(runningState.p, BEGINNER_FASTEST_VALID_P) : undefined;
    predicting.remove();

    const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      const resultState = completeRun(runningState);
      state = resultState;
      mountResult(resultState.result, hintComparison);
      return;
    }

    const { p } = runningState;
    const stopTimeS = stopTime(DEFAULT_MODEL, p);
    const visualDurationMs = visualDuration(stopTimeS) * 1000;

    const { section, car, positionValue, velocityValue, cue } = buildRunningSection(runningState);
    root.appendChild(section);

    let cancelled = false;
    let frameId = 0;
    let sessionStartTimestamp: number | null = null;

    function renderFrame(t: number): void {
      car.style.bottom = `${projectToShaftPercent(positionAt(DEFAULT_MODEL, p, t), SHAFT_EXTENT)}%`;
      const readout = runningReadout(DEFAULT_MODEL, p, t);
      positionValue.textContent = readout.position;
      velocityValue.textContent = readout.velocity;
      cue.dataset.cue = readout.cue;
      cue.textContent = readout.cue === "accelerating" ? "Speeding up" : "Slowing down";
    }

    function frame(timestamp: number): void {
      if (cancelled) return;

      if (sessionStartTimestamp === null) {
        sessionStartTimestamp = timestamp;
      }
      const wallElapsedMs = timestamp - sessionStartTimestamp;

      if (wallElapsedMs >= visualDurationMs) {
        cancelled = true;
        view.cancelAnimationFrame(frameId);
        section.remove();
        const resultState = completeRun(runningState);
        state = resultState;
        mountResult(resultState.result, hintComparison);
        return;
      }

      const t = physicalTimeAt(wallElapsedMs, visualDurationMs, stopTimeS);
      renderFrame(t);
      frameId = view.requestAnimationFrame(frame);
    }

    frameId = view.requestAnimationFrame(frame);
  });
}
