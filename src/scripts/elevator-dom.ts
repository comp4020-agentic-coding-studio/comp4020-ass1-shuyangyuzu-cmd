import {
  DEFAULT_MODEL,
  optimalSwitchDistance,
  optimalSwitchPercentage,
  positionAt,
  positionAtAdvanced,
  stopTime,
  stopTimeAdvanced,
  switchDistance,
  switchDistanceAdvanced,
  type AdvancedAttemptResult,
  type AdvancedModel,
  type AttemptResult,
} from "../model/elevator";
import { physicalTimeAt, projectToShaftPercent, shaftDomain, visualDuration } from "./elevator-animation";
import {
  completeAdvancedRun,
  initialAdvancedUIState,
  retryAdvanced,
  runAdvanced,
  setAdvancedModel,
  setAdvancedPercentage,
  type AdvancedRunningState,
  type AdvancedUIState,
} from "./elevator-advanced-controller";
import { completeRun, initialUIState, retry, run, setPercentage, type RunningState, type UIState } from "./elevator-controller";
import {
  BEGINNER_FASTEST_VALID_P,
  buildAdvancedHintComparison,
  buildHintComparison,
  initialHintState,
  resetHint,
  revealFastestValid,
  showConceptualHint,
  type HintComparison,
  type HintState,
} from "./elevator-hint";
import {
  advancedConceptualHint,
  COPY,
  formatNumber,
  resultView,
  resultViewAdvanced,
  runningReadout,
  runningReadoutAdvanced,
} from "./elevator-view";

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

    const changeRulesButton = doc.createElement("button");
    changeRulesButton.type = "button";
    changeRulesButton.dataset.testid = "change-rules-button";
    changeRulesButton.className = "comic-button";
    changeRulesButton.textContent = COPY.changeRulesButton;
    changeRulesButton.addEventListener("click", () => {
      section.remove();
      switchToAdvanced();
    });
    section.appendChild(changeRulesButton);

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

  // === Advanced mode ===
  // See INTERACTION.md "Advanced mode in Play (approved)". Mirrors the
  // Beginner functions above one-for-one, parameterised by the current
  // advancedState.model instead of the fixed DEFAULT_MODEL, using distinct
  // advanced-prefixed testids throughout.

  let advancedState: AdvancedUIState = initialAdvancedUIState;
  let advancedHintState: HintState = initialHintState;
  let advancedPredicting: HTMLElement;
  let advancedShaft: HTMLElement;
  let advancedTargetMarker: HTMLElement;
  let advancedBrakingMarker: HTMLElement;
  let advancedInput: HTMLInputElement;
  let advancedPercentageValue: HTMLElement;
  let advancedHint: HTMLElement;

  function renderAdvancedShaftStatic(): void {
    const extent = shaftDomain(advancedState.model);
    advancedTargetMarker.style.bottom = `${projectToShaftPercent(advancedState.model.H, extent)}%`;
  }

  function renderAdvancedPercentage(p: number): void {
    const extent = shaftDomain(advancedState.model);
    advancedInput.value = String(p);
    advancedPercentageValue.textContent = `${formatNumber(p)}%`;
    advancedBrakingMarker.style.bottom = `${projectToShaftPercent(switchDistanceAdvanced(advancedState.model, p), extent)}%`;
  }

  function handleAdvancedMatchButtonClick(): void {
    const predictingState = setAdvancedPercentage(advancedState, optimalSwitchPercentage(advancedState.model));
    advancedState = predictingState;
    renderAdvancedPercentage(predictingState.p);
  }

  function handleAdvancedRevealButtonClick(): void {
    advancedHintState = revealFastestValid(advancedHintState);

    advancedHint.querySelector('[data-testid="advanced-reveal-button"]')!.remove();

    const model = advancedState.model;
    const optimalP = optimalSwitchPercentage(model);

    const revealed = doc.createElement("p");
    revealed.dataset.testid = "advanced-hint-revealed";
    revealed.tabIndex = -1;
    revealed.textContent = `The fastest valid braking point is ${formatNumber(optimalP)}% of the way to the target.`;
    advancedHint.appendChild(revealed);

    const marker = doc.createElement("div");
    marker.dataset.testid = "advanced-fastest-valid-marker";
    marker.className = "marker marker-fastest-valid";
    marker.style.bottom = `${projectToShaftPercent(optimalSwitchDistance(model), shaftDomain(model))}%`;
    advancedShaft.appendChild(marker);

    const matchButton = doc.createElement("button");
    matchButton.type = "button";
    matchButton.dataset.testid = "advanced-match-button";
    matchButton.className = "comic-button";
    matchButton.textContent = COPY.matchButton;
    matchButton.addEventListener("click", handleAdvancedMatchButtonClick);
    advancedHint.appendChild(matchButton);

    revealed.focus();
  }

  function handleAdvancedHintButtonClick(): void {
    advancedHintState = showConceptualHint(advancedHintState);

    advancedHint.querySelector('[data-testid="advanced-hint-button"]')!.remove();

    const conceptual = doc.createElement("p");
    conceptual.dataset.testid = "advanced-hint-conceptual";
    conceptual.tabIndex = -1;
    conceptual.textContent = advancedConceptualHint(advancedState.model);
    advancedHint.appendChild(conceptual);

    const revealButton = doc.createElement("button");
    revealButton.type = "button";
    revealButton.dataset.testid = "advanced-reveal-button";
    revealButton.className = "comic-button";
    revealButton.textContent = COPY.revealButton;
    revealButton.addEventListener("click", handleAdvancedRevealButtonClick);
    advancedHint.appendChild(revealButton);

    conceptual.focus();
  }

  function buildAdvancedHintButton(): HTMLButtonElement {
    const button = doc.createElement("button");
    button.type = "button";
    button.dataset.testid = "advanced-hint-button";
    button.className = "comic-button";
    button.textContent = COPY.hintButton;
    button.addEventListener("click", handleAdvancedHintButtonClick);
    return button;
  }

  function resetAdvancedHintUI(): void {
    advancedHintState = resetHint();
    advancedHint.querySelector('[data-testid="advanced-hint-conceptual"]')?.remove();
    advancedHint.querySelector('[data-testid="advanced-reveal-button"]')?.remove();
    advancedHint.querySelector('[data-testid="advanced-hint-revealed"]')?.remove();
    advancedHint.querySelector('[data-testid="advanced-match-button"]')?.remove();
    advancedShaft.querySelector('[data-testid="advanced-fastest-valid-marker"]')?.remove();
    advancedHint.appendChild(buildAdvancedHintButton());
  }

  function handleAdvancedModelFieldChange(field: "H" | "a" | "b", raw: string): void {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;

    const nextModel: AdvancedModel = { ...advancedState.model, [field]: value };
    const predictingState = setAdvancedModel(advancedState, nextModel);
    advancedState = predictingState;
    renderAdvancedShaftStatic();
    renderAdvancedPercentage(predictingState.p);
    resetAdvancedHintUI();
  }

  function buildAdvancedResultShaft(attemptResult: AdvancedAttemptResult, model: AdvancedModel): HTMLElement {
    const extent = shaftDomain(model);
    const resultShaft = doc.createElement("div");
    resultShaft.dataset.testid = "advanced-result-shaft";
    resultShaft.className = "shaft result-shaft";
    resultShaft.dataset.outcome = attemptResult.classification;
    resultShaft.setAttribute("aria-hidden", "true");

    const targetMarker = doc.createElement("div");
    targetMarker.className = "marker marker-target";
    targetMarker.style.bottom = `${projectToShaftPercent(model.H, extent)}%`;

    const brakingMarker = doc.createElement("div");
    brakingMarker.className = "marker marker-braking";
    brakingMarker.style.bottom = `${projectToShaftPercent(switchDistanceAdvanced(model, attemptResult.p), extent)}%`;

    const car = doc.createElement("div");
    car.className = "car";
    car.style.bottom = `${projectToShaftPercent(attemptResult.finalState.position, extent)}%`;

    resultShaft.appendChild(targetMarker);
    resultShaft.appendChild(brakingMarker);
    resultShaft.appendChild(car);

    return resultShaft;
  }

  function buildAdvancedResultSection(
    attemptResult: AdvancedAttemptResult,
    model: AdvancedModel,
    hintComparison: HintComparison | undefined,
  ): HTMLElement {
    const view2 = resultViewAdvanced(attemptResult);

    const section = doc.createElement("section");
    section.dataset.testid = "advanced-result";
    section.className = "panel result-panel";
    section.tabIndex = -1;
    section.setAttribute("aria-live", "polite");
    section.setAttribute("aria-atomic", "true");

    const heading = doc.createElement("h2");
    heading.dataset.testid = "result-heading";
    heading.className = "punchline";
    heading.textContent = view2.heading;
    section.appendChild(heading);

    const resultBody = doc.createElement("div");
    resultBody.className = "result-body";

    const shaftCol = doc.createElement("div");
    shaftCol.className = "shaft-col";
    shaftCol.appendChild(buildAdvancedResultShaft(attemptResult, model));
    resultBody.appendChild(shaftCol);

    const contentCol = doc.createElement("div");
    contentCol.className = "content-col";

    const explanation = doc.createElement("p");
    explanation.dataset.testid = "result-explanation";
    explanation.textContent = view2.explanation;
    contentCol.appendChild(explanation);

    const dl = doc.createElement("dl");
    for (const field of view2.fields) {
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

    if (view2.minimumMessage !== undefined) {
      const minimumMessage = doc.createElement("p");
      minimumMessage.dataset.testid = "result-minimum-message";
      minimumMessage.textContent = view2.minimumMessage;
      contentCol.appendChild(minimumMessage);
    }

    if (hintComparison !== undefined) {
      const comparison = doc.createElement("div");
      comparison.dataset.testid = "advanced-hint-comparison";

      const yourBrake = doc.createElement("span");
      yourBrake.dataset.field = "yourBrake";
      yourBrake.textContent = `${formatNumber(hintComparison.yourBrake)}%`;
      comparison.appendChild(yourBrake);

      const fastestValid = doc.createElement("span");
      fastestValid.dataset.field = "fastestValid";
      fastestValid.textContent = `${formatNumber(hintComparison.fastestValid)}%`;
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
    retryButton.dataset.testid = "advanced-retry-button";
    retryButton.className = "comic-button";
    retryButton.textContent = COPY.retryButton;
    retryButton.addEventListener("click", () => {
      const predictingState = retryAdvanced(advancedState);
      advancedState = predictingState;
      section.remove();
      renderAdvancedPercentage(predictingState.p);
      resetAdvancedHintUI();
      root.appendChild(advancedPredicting);
      advancedInput.focus();
    });
    section.appendChild(retryButton);

    return section;
  }

  function mountAdvancedResult(
    attemptResult: AdvancedAttemptResult,
    model: AdvancedModel,
    hintComparison: HintComparison | undefined,
  ): void {
    const result = buildAdvancedResultSection(attemptResult, model, hintComparison);
    root.appendChild(result);
    result.focus();
  }

  function buildAdvancedRunningSection(runningState: AdvancedRunningState): {
    section: HTMLElement;
    car: HTMLElement;
    positionValue: HTMLElement;
    velocityValue: HTMLElement;
    cue: HTMLElement;
  } {
    const { model, p } = runningState;
    const extent = shaftDomain(model);

    const section = doc.createElement("section");
    section.dataset.testid = "advanced-running";
    section.className = "panel";

    const shaftCol = doc.createElement("div");
    shaftCol.className = "shaft-col";

    const runningShaft = doc.createElement("div");
    runningShaft.dataset.testid = "advanced-shaft";
    runningShaft.className = "shaft";

    const targetMarker = doc.createElement("div");
    targetMarker.dataset.testid = "advanced-target-marker";
    targetMarker.className = "marker marker-target";
    targetMarker.style.bottom = `${projectToShaftPercent(model.H, extent)}%`;

    const brakingMarker = doc.createElement("div");
    brakingMarker.dataset.testid = "advanced-braking-marker";
    brakingMarker.className = "marker marker-braking";
    brakingMarker.style.bottom = `${projectToShaftPercent(switchDistanceAdvanced(model, p), extent)}%`;

    const car = doc.createElement("div");
    car.dataset.testid = "advanced-car";
    car.className = "car";
    car.style.bottom = `${projectToShaftPercent(0, extent)}%`;

    runningShaft.appendChild(targetMarker);
    runningShaft.appendChild(brakingMarker);
    runningShaft.appendChild(car);
    shaftCol.appendChild(runningShaft);
    section.appendChild(shaftCol);

    const contentCol = doc.createElement("div");
    contentCol.className = "content-col";

    const positionRow = doc.createElement("p");
    const positionLabel = doc.createElement("span");
    positionLabel.textContent = "Position: ";
    const positionValue = doc.createElement("span");
    positionValue.dataset.testid = "advanced-running-position";
    positionValue.textContent = "0 m";
    positionRow.appendChild(positionLabel);
    positionRow.appendChild(positionValue);
    contentCol.appendChild(positionRow);

    const velocityRow = doc.createElement("p");
    const velocityLabel = doc.createElement("span");
    velocityLabel.textContent = "Velocity: ";
    const velocityValue = doc.createElement("span");
    velocityValue.dataset.testid = "advanced-running-velocity";
    velocityValue.textContent = "0 m/s";
    velocityRow.appendChild(velocityLabel);
    velocityRow.appendChild(velocityValue);
    contentCol.appendChild(velocityRow);

    const cue = doc.createElement("p");
    cue.dataset.testid = "advanced-running-cue";
    cue.dataset.cue = "accelerating";
    cue.className = "running-cue";
    cue.textContent = "Speeding up";
    contentCol.appendChild(cue);

    section.appendChild(contentCol);

    return { section, car, positionValue, velocityValue, cue };
  }

  function runAdvancedAttempt(): void {
    const runningState = runAdvanced(advancedState);
    advancedState = runningState;
    const hintComparison =
      advancedHintState.phase === "revealed"
        ? buildAdvancedHintComparison(runningState.p, optimalSwitchPercentage(runningState.model))
        : undefined;
    advancedPredicting.remove();

    const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      const resultState = completeAdvancedRun(runningState);
      advancedState = resultState;
      mountAdvancedResult(resultState.result, resultState.model, hintComparison);
      return;
    }

    const { model, p } = runningState;
    const extent = shaftDomain(model);
    const stopTimeS = stopTimeAdvanced(model, p);
    const visualDurationMs = visualDuration(stopTimeS) * 1000;

    const { section, car, positionValue, velocityValue, cue } = buildAdvancedRunningSection(runningState);
    root.appendChild(section);

    let cancelled = false;
    let frameId = 0;
    let sessionStartTimestamp: number | null = null;

    function renderFrame(t: number): void {
      car.style.bottom = `${projectToShaftPercent(positionAtAdvanced(model, p, t), extent)}%`;
      const readout = runningReadoutAdvanced(model, p, t);
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
        const resultState = completeAdvancedRun(runningState);
        advancedState = resultState;
        mountAdvancedResult(resultState.result, resultState.model, hintComparison);
        return;
      }

      const t = physicalTimeAt(wallElapsedMs, visualDurationMs, stopTimeS);
      renderFrame(t);
      frameId = view.requestAnimationFrame(frame);
    }

    frameId = view.requestAnimationFrame(frame);
  }

  function buildAdvancedPredictingSection(): HTMLElement {
    const model = advancedState.model;
    const extent = shaftDomain(model);

    const section = doc.createElement("section");
    section.dataset.testid = "advanced-predicting";
    section.className = "panel";

    const shaftCol = doc.createElement("div");
    shaftCol.className = "shaft-col";

    advancedShaft = doc.createElement("div");
    advancedShaft.dataset.testid = "advanced-shaft";
    advancedShaft.className = "shaft";

    advancedTargetMarker = doc.createElement("div");
    advancedTargetMarker.dataset.testid = "advanced-target-marker";
    advancedTargetMarker.className = "marker marker-target";
    advancedTargetMarker.style.bottom = `${projectToShaftPercent(model.H, extent)}%`;

    advancedBrakingMarker = doc.createElement("div");
    advancedBrakingMarker.dataset.testid = "advanced-braking-marker";
    advancedBrakingMarker.className = "marker marker-braking";
    advancedBrakingMarker.style.bottom = `${projectToShaftPercent(switchDistanceAdvanced(model, advancedState.p), extent)}%`;

    const car = doc.createElement("div");
    car.dataset.testid = "advanced-car";
    car.className = "car";
    car.style.bottom = `${projectToShaftPercent(0, extent)}%`;

    advancedShaft.appendChild(advancedTargetMarker);
    advancedShaft.appendChild(advancedBrakingMarker);
    advancedShaft.appendChild(car);
    shaftCol.appendChild(advancedShaft);
    section.appendChild(shaftCol);

    const contentCol = doc.createElement("div");
    contentCol.className = "content-col";

    const heading = doc.createElement("h2");
    heading.dataset.testid = "advanced-heading";
    heading.tabIndex = -1;
    heading.textContent = COPY.advancedHeading;
    contentCol.appendChild(heading);

    const task = doc.createElement("p");
    task.dataset.testid = "advanced-task";
    task.textContent = COPY.advancedTask;
    contentCol.appendChild(task);

    function buildNumberField(
      testid: string,
      labelText: string,
      min: string,
      max: string,
      step: string,
      value: string,
      field: "H" | "a" | "b",
    ): void {
      const label = doc.createElement("label");
      label.textContent = labelText;
      const numberInput = doc.createElement("input");
      numberInput.type = "number";
      numberInput.dataset.testid = testid;
      numberInput.min = min;
      numberInput.max = max;
      numberInput.step = step;
      numberInput.value = value;
      numberInput.addEventListener("input", () => handleAdvancedModelFieldChange(field, numberInput.value));
      label.appendChild(numberInput);
      contentCol.appendChild(label);
    }

    buildNumberField("advanced-h-input", "Building height (m)", "5", "20", "1", String(model.H), "H");
    buildNumberField("advanced-a-input", "How fast it can speed up (m/s²)", "0.5", "3", "0.1", String(model.a), "a");
    buildNumberField("advanced-b-input", "How fast it can slow down (m/s²)", "0.5", "3", "0.1", String(model.b), "b");

    const sliderLabel = doc.createElement("label");
    sliderLabel.textContent = COPY.sliderLabel;
    advancedInput = doc.createElement("input");
    advancedInput.type = "range";
    advancedInput.dataset.testid = "advanced-percentage-input";
    advancedInput.min = "1";
    advancedInput.max = "100";
    advancedInput.step = "0.1";
    advancedInput.value = String(advancedState.p);
    sliderLabel.appendChild(advancedInput);
    contentCol.appendChild(sliderLabel);

    advancedPercentageValue = doc.createElement("span");
    advancedPercentageValue.dataset.testid = "advanced-percentage-value";
    advancedPercentageValue.textContent = `${formatNumber(advancedState.p)}%`;
    contentCol.appendChild(advancedPercentageValue);

    advancedInput.addEventListener("input", () => {
      const predictingState = setAdvancedPercentage(advancedState, Number(advancedInput.value));
      advancedState = predictingState;
      renderAdvancedPercentage(predictingState.p);
    });

    const advancedRunButton = doc.createElement("button");
    advancedRunButton.type = "button";
    advancedRunButton.dataset.testid = "advanced-run-button";
    advancedRunButton.className = "comic-button";
    advancedRunButton.textContent = COPY.runButton;
    advancedRunButton.addEventListener("click", runAdvancedAttempt);
    contentCol.appendChild(advancedRunButton);

    advancedHint = doc.createElement("div");
    advancedHint.dataset.testid = "advanced-hint";
    advancedHint.appendChild(buildAdvancedHintButton());
    contentCol.appendChild(advancedHint);

    section.appendChild(contentCol);

    return section;
  }

  function switchToAdvanced(): void {
    advancedPredicting = buildAdvancedPredictingSection();
    root.appendChild(advancedPredicting);
    advancedPredicting.querySelector<HTMLElement>('[data-testid="advanced-heading"]')!.focus();
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
