import { DEFAULT_MODEL, positionAt, stopTime, switchDistance, type AttemptResult } from "../model/elevator";
import { physicalTimeAt, projectToShaftPercent, shaftDomain, visualDuration } from "./elevator-animation";
import { completeRun, initialUIState, retry, run, setPercentage, type RunningState, type UIState } from "./elevator-controller";
import { COPY, resultView, runningReadout } from "./elevator-view";

const SHAFT_EXTENT = shaftDomain(DEFAULT_MODEL);

export function initElevatorUI(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const view = doc.defaultView!;
  const predicting = root.querySelector<HTMLElement>('[data-testid="predicting"]')!;
  const input = predicting.querySelector<HTMLInputElement>('[data-testid="percentage-input"]')!;
  const percentageValue = predicting.querySelector<HTMLElement>('[data-testid="percentage-value"]')!;
  const runButton = predicting.querySelector<HTMLButtonElement>('[data-testid="run-button"]')!;
  const predictingBrakingMarker = predicting.querySelector<HTMLElement>('[data-testid="braking-marker"]')!;

  let state: UIState = initialUIState;

  function renderPercentage(p: number): void {
    input.value = String(p);
    percentageValue.textContent = `${p}%`;
    predictingBrakingMarker.style.bottom = `${projectToShaftPercent(switchDistance(DEFAULT_MODEL, p), SHAFT_EXTENT)}%`;
  }

  function buildResultSection(attemptResult: AttemptResult): HTMLElement {
    const view = resultView(attemptResult);

    const section = doc.createElement("section");
    section.dataset.testid = "result";
    section.tabIndex = -1;
    section.setAttribute("aria-live", "polite");
    section.setAttribute("aria-atomic", "true");

    const heading = doc.createElement("h2");
    heading.dataset.testid = "result-heading";
    heading.textContent = view.heading;
    section.appendChild(heading);

    const explanation = doc.createElement("p");
    explanation.dataset.testid = "result-explanation";
    explanation.textContent = view.explanation;
    section.appendChild(explanation);

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
    section.appendChild(dl);

    if (view.minimumMessage !== undefined) {
      const minimumMessage = doc.createElement("p");
      minimumMessage.dataset.testid = "result-minimum-message";
      minimumMessage.textContent = view.minimumMessage;
      section.appendChild(minimumMessage);
    }

    const retryButton = doc.createElement("button");
    retryButton.type = "button";
    retryButton.dataset.testid = "retry-button";
    retryButton.textContent = COPY.retryButton;
    retryButton.addEventListener("click", () => {
      const predictingState = retry(state);
      state = predictingState;
      section.remove();
      renderPercentage(predictingState.p);
      root.appendChild(predicting);
      input.focus();
    });
    section.appendChild(retryButton);

    return section;
  }

  function mountResult(attemptResult: AttemptResult): void {
    const result = buildResultSection(attemptResult);
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
    section.appendChild(shaft);

    const positionRow = doc.createElement("p");
    const positionLabel = doc.createElement("span");
    positionLabel.textContent = "Position: ";
    const positionValue = doc.createElement("span");
    positionValue.dataset.testid = "running-position";
    positionValue.textContent = "0 m";
    positionRow.appendChild(positionLabel);
    positionRow.appendChild(positionValue);
    section.appendChild(positionRow);

    const velocityRow = doc.createElement("p");
    const velocityLabel = doc.createElement("span");
    velocityLabel.textContent = "Velocity: ";
    const velocityValue = doc.createElement("span");
    velocityValue.dataset.testid = "running-velocity";
    velocityValue.textContent = "0 m/s";
    velocityRow.appendChild(velocityLabel);
    velocityRow.appendChild(velocityValue);
    section.appendChild(velocityRow);

    const cue = doc.createElement("p");
    cue.dataset.testid = "running-cue";
    cue.dataset.cue = "accelerating";
    cue.textContent = "Speeding up";
    section.appendChild(cue);

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
    predicting.remove();

    const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      const resultState = completeRun(runningState);
      state = resultState;
      mountResult(resultState.result);
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
        mountResult(resultState.result);
        return;
      }

      const t = physicalTimeAt(wallElapsedMs, visualDurationMs, stopTimeS);
      renderFrame(t);
      frameId = view.requestAnimationFrame(frame);
    }

    frameId = view.requestAnimationFrame(frame);
  });
}
