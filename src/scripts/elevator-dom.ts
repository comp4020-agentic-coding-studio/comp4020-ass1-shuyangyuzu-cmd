import type { AttemptResult } from "../model/elevator";
import { initialUIState, retry, run, setPercentage, type UIState } from "./elevator-controller";
import { COPY, resultView } from "./elevator-view";

export function initElevatorUI(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const predicting = root.querySelector<HTMLElement>('[data-testid="predicting"]')!;
  const input = predicting.querySelector<HTMLInputElement>('[data-testid="percentage-input"]')!;
  const percentageValue = predicting.querySelector<HTMLElement>('[data-testid="percentage-value"]')!;
  const runButton = predicting.querySelector<HTMLButtonElement>('[data-testid="run-button"]')!;

  let state: UIState = initialUIState;

  function renderPercentage(p: number): void {
    input.value = String(p);
    percentageValue.textContent = `${p}%`;
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

  input.addEventListener("input", () => {
    const predictingState = setPercentage(state, Number(input.value));
    state = predictingState;
    renderPercentage(predictingState.p);
  });

  runButton.addEventListener("click", () => {
    const resultState = run(state);
    state = resultState;
    predicting.remove();
    const result = buildResultSection(resultState.result);
    root.appendChild(result);
    result.focus();
  });
}
