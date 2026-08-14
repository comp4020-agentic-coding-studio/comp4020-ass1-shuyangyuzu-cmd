import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { buildAttemptResult, DEFAULT_MODEL } from "../src/model/elevator";
import { initElevatorUI } from "../src/scripts/elevator-dom";
import { DISCLAIMER, resultView } from "../src/scripts/elevator-view";
import PlayPage from "../src/pages/play.astro";

// Bootstrap boundary: Astro Container renders the real play.astro, but
// JSDOM never executes its <script src="../scripts/main.ts"> tag. Every test
// below calls initElevatorUI(root) directly, so it proves (a) the real
// server-rendered page supplies the correct root, and (b) elevator-dom wires
// and transitions that real markup correctly. It does NOT prove that
// play.astro's <script> tag loads main.ts in a deployed browser, or that
// main.ts calls initElevatorUI. That bootstrap wiring is deferred to
// browser/manual verification, not covered by this JSDOM component slice.
//
// This suite originally rendered index.astro before the three-route
// migration moved the Beginner game to play.astro; only the rendered page
// changed, not the assertions.

async function renderPlayPage(): Promise<JSDOM> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(PlayPage, { partial: false });
  return new JSDOM(html);
}

function required<T extends Element>(scope: Document | Element, selector: string): T {
  const element = scope.querySelector<T>(selector);
  expect(element, `expected to find ${selector}`).not.toBeNull();
  return element as T;
}

function setPercentage(jsdom: JSDOM, input: HTMLInputElement, p: number): void {
  input.value = String(p);
  input.dispatchEvent(new jsdom.window.Event("input", { bubbles: true }));
}

function preferReducedMotion(jsdom: JSDOM): void {
  jsdom.window.matchMedia = ((query: string) =>
    ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof jsdom.window.matchMedia;
}

describe("initElevatorUI — percentage display", () => {
  it("updates the visible percentage text as the range input changes", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const input = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, 62);

    const visible = required(jsdom.window.document, '[data-testid="percentage-value"]');
    expect(visible.textContent?.trim()).toBe("62%");
  });
});

describe("Run", () => {
  it("detaches Predicting, creates a live-region Result, and moves focus to it", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();

    expect(
      jsdom.window.document.querySelector('[data-testid="predicting"]'),
      "Predicting must be detached, not hidden",
    ).toBeNull();
    const result = required<HTMLElement>(jsdom.window.document, '[data-testid="result"]');
    expect(result.getAttribute("tabindex")).toBe("-1");
    expect(result.getAttribute("aria-live")).toBe("polite");
    expect(result.getAttribute("aria-atomic")).toBe("true");
    expect(result.getAttribute("role")).not.toBe("status");
    expect(jsdom.window.document.activeElement).toBe(result);
  });

  it.each([20, 50, 65])("renders Result content matching resultView for p=%i", async (p) => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const input = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();

    // Consistency check against the approved pure view mapping — not
    // independent evidence that resultView's own numbers/strings are
    // correct; that belongs to elevator-view.test.ts. p=20/50/65 exercise the
    // short/correct/overshoot classifications respectively.
    const expected = resultView(buildAttemptResult(DEFAULT_MODEL, p));
    const result = required<HTMLElement>(jsdom.window.document, '[data-testid="result"]');
    expect(result.querySelector('[data-testid="result-heading"]')?.textContent?.trim()).toBe(expected.heading);
    expect(result.querySelector('[data-testid="result-explanation"]')?.textContent?.trim()).toBe(
      expected.explanation,
    );

    for (const field of expected.fields) {
      const dd = required<HTMLElement>(result, `[data-field="${field.key}"]`);
      expect(dd.textContent?.trim()).toBe(field.value);
      const dt = dd.closest("div")?.querySelector("dt");
      expect(dt?.textContent).toContain(field.label);
    }

    const minimumMessage = result.querySelector('[data-testid="result-minimum-message"]');
    if (expected.minimumMessage === undefined) {
      expect(minimumMessage, `expected no result-minimum-message node for p=${p}`).toBeNull();
    } else {
      expect(minimumMessage, `expected a result-minimum-message node for p=${p}`).not.toBeNull();
      expect(minimumMessage?.textContent?.trim()).toBe(expected.minimumMessage);
    }
  });

  it("never renders targetCrossingTime", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const input = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, 65);
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();

    const result = required<HTMLElement>(jsdom.window.document, '[data-testid="result"]');
    expect(result.querySelector('[data-field="targetCrossingTime"]')).toBeNull();
    expect(result.querySelector('[data-field="elapsedTime"]')).not.toBeNull();
  });
});

describe("Retry", () => {
  it("removes Result, reattaches the retained Predicting node with p preserved, and returns focus to the range input", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const predictingBeforeRun = required<HTMLElement>(jsdom.window.document, '[data-testid="predicting"]');
    const input = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, 20);
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="retry-button"]').click();

    expect(jsdom.window.document.querySelector('[data-testid="result"]')).toBeNull();
    const predictingAfterRetry = required<HTMLElement>(jsdom.window.document, '[data-testid="predicting"]');
    expect(predictingAfterRetry).toBe(predictingBeforeRun);

    const reattachedInput = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
    expect(reattachedInput.value).toBe("20");
    expect(jsdom.window.document.activeElement).toBe(reattachedInput);
  });
});

describe("repeated Run -> Retry cycles", () => {
  it("locks a distinct p on each of two consecutive cycles", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    for (const p of [30, 70]) {
      const input = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
      setPercentage(jsdom, input, p);
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();

      const percentageField = resultView(buildAttemptResult(DEFAULT_MODEL, p)).fields.find(
        (f) => f.key === "percentage",
      );
      const result = required<HTMLElement>(jsdom.window.document, '[data-testid="result"]');
      expect(result.querySelector('[data-field="percentage"]')?.textContent?.trim()).toBe(percentageField?.value);

      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="retry-button"]').click();
    }
  });
});

describe("disclaimer and formal disclosure", () => {
  it("keeps the disclaimer unchanged outside the phase root through Run and Retry", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const disclaimerBefore = required<HTMLElement>(jsdom.window.document, '[data-testid="disclaimer"]');
    expect(root.contains(disclaimerBefore)).toBe(false);
    expect(disclaimerBefore.textContent?.trim()).toBe(DISCLAIMER);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
    expect(jsdom.window.document.querySelector('[data-testid="formal-model"]')).toBeNull();
    expect(required(jsdom.window.document, '[data-testid="disclaimer"]').textContent?.trim()).toBe(DISCLAIMER);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="retry-button"]').click();
    expect(jsdom.window.document.querySelector('[data-testid="formal-model"]')).toBeNull();
    expect(required(jsdom.window.document, '[data-testid="disclaimer"]').textContent?.trim()).toBe(DISCLAIMER);
  });
});
