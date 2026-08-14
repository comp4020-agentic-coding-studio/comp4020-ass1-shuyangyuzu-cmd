import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  buildAdvancedAttemptResult,
  DEFAULT_ADVANCED_MODEL,
  optimalSwitchDistance,
  optimalSwitchPercentage,
  stopTimeAdvanced,
  switchDistanceAdvanced,
} from "../src/model/elevator";
import { projectToShaftPercent, shaftDomain, visualDuration } from "../src/scripts/elevator-animation";
import { initElevatorUI } from "../src/scripts/elevator-dom";
import { buildAdvancedHintComparison } from "../src/scripts/elevator-hint";
import { advancedConceptualHint, resultViewAdvanced } from "../src/scripts/elevator-view";
import PlayPage from "../src/pages/play.astro";
import HomePage from "../src/pages/index.astro";
import PrinciplePage from "../src/pages/principle.astro";

// Test-first-in-spirit but bundled slice: elevator-dom.ts's Advanced mode is
// wired alongside this file rather than in a separate red-test commit,
// following the same precedent as spec/elevator-hint-dom.test.ts (bundled
// into "feat: wire Hint/Reveal"). See INTERACTION.md "Advanced mode in Play
// (approved)" for the full contract, in particular its numbered
// "Advanced Hint/Reveal and Result tests (this slice)" list, which this file
// exercises item by item against the real rendered play.astro.

const FORBIDDEN_TERMS = [
  "bang-bang",
  "pontryagin",
  "optimal control",
  "phase plane",
  "double integrator",
  "state-space",
  "switching function",
  "u(t)",
];

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

function setValue(jsdom: JSDOM, input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new jsdom.window.Event("input", { bubbles: true }));
}

function stubMatchMedia(jsdom: JSDOM, reduceMotion: boolean): void {
  jsdom.window.matchMedia = ((query: string) =>
    ({
      matches: reduceMotion && query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof jsdom.window.matchMedia;
}

function allowMotion(jsdom: JSDOM): void {
  stubMatchMedia(jsdom, false);
}

function preferReducedMotion(jsdom: JSDOM): void {
  stubMatchMedia(jsdom, true);
}

type FakeRaf = {
  readonly pendingCount: number;
  advance(ms: number): void;
};

function installFakeRaf(jsdom: JSDOM, initialNow = 10_000): FakeRaf {
  let nextId = 1;
  let queue: Array<{ id: number; callback: (timestamp: number) => void }> = [];
  let now = initialNow;

  jsdom.window.requestAnimationFrame = ((callback: (timestamp: number) => void) => {
    const id = nextId++;
    queue.push({ id, callback });
    return id;
  }) as typeof jsdom.window.requestAnimationFrame;

  jsdom.window.cancelAnimationFrame = ((id: number) => {
    queue = queue.filter((entry) => entry.id !== id);
  }) as typeof jsdom.window.cancelAnimationFrame;

  return {
    get pendingCount() {
      return queue.length;
    },
    advance(ms: number) {
      now += ms;
      const due = queue;
      queue = [];
      for (const entry of due) entry.callback(now);
    },
  };
}

function drainUntilResult(root: HTMLElement, raf: FakeRaf, testid: string, maxExtraFrames = 10): void {
  let guard = 0;
  while (root.querySelector(`[data-testid="${testid}"]`) === null && guard < maxExtraFrames) {
    raf.advance(1);
    guard++;
  }
}

async function switchToAdvanced(jsdom: JSDOM): Promise<HTMLElement> {
  const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
  initElevatorUI(root);
  preferReducedMotion(jsdom);
  required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
  required<HTMLButtonElement>(jsdom.window.document, '[data-testid="change-rules-button"]').click();
  return root;
}

// Item 5 — Beginner's first Result renders both retry-button and
// change-rules-button.
describe("Beginner Result — CHANGE THE RULES availability", () => {
  it("renders both retry-button and change-rules-button after the first attempt", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();

    const result = required<HTMLElement>(jsdom.window.document, '[data-testid="result"]');
    expect(result.querySelector('[data-testid="retry-button"]')).not.toBeNull();
    const changeRules = required<HTMLButtonElement>(result, '[data-testid="change-rules-button"]');
    expect(changeRules.textContent?.trim()).toBe("CHANGE THE RULES");
  });
});

// Item 6 — clicking change-rules-button leaves no Beginner testid and mounts
// advanced-predicting's full initial markup with focus on advanced-heading.
describe("CHANGE THE RULES — one-way transition into Advanced", () => {
  it("removes every Beginner testid and mounts Advanced Predicting with focus on advanced-heading", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    for (const testid of ["result", "predicting", "retry-button", "run-button", "change-rules-button"]) {
      expect(root.querySelector(`[data-testid="${testid}"]`), `expected no [data-testid="${testid}"]`).toBeNull();
    }

    const advancedPredicting = required<HTMLElement>(root, '[data-testid="advanced-predicting"]');
    expect(root.contains(advancedPredicting)).toBe(true);
    required<HTMLElement>(root, '[data-testid="advanced-heading"]');
    required<HTMLElement>(root, '[data-testid="advanced-task"]');
    required<HTMLInputElement>(root, '[data-testid="advanced-h-input"]');
    required<HTMLInputElement>(root, '[data-testid="advanced-a-input"]');
    required<HTMLInputElement>(root, '[data-testid="advanced-b-input"]');
    required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
    required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]');
    required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]');

    expect(jsdom.window.document.activeElement).toBe(
      jsdom.window.document.querySelector('[data-testid="advanced-heading"]'),
    );
  });

  it("never renders change-rules-button in Advanced's own Result", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]').click();

    const advancedResult = required<HTMLElement>(root, '[data-testid="advanced-result"]');
    expect(advancedResult.querySelector('[data-testid="change-rules-button"]')).toBeNull();
  });
});

// Item 7 — Advanced's initial shaft/marker positions match
// DEFAULT_ADVANCED_MODEL.
describe("Advanced Predicting — initial shaft and markers", () => {
  it("projects target/braking markers from DEFAULT_ADVANCED_MODEL and the initial p", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    const model = DEFAULT_ADVANCED_MODEL;
    const domain = shaftDomain(model);
    const targetMarker = required<HTMLElement>(root, '[data-testid="advanced-target-marker"]');
    expect(targetMarker.style.bottom).toBe(`${projectToShaftPercent(model.H, domain)}%`);

    const input = required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
    const p = Number(input.value);
    const brakingMarker = required<HTMLElement>(root, '[data-testid="advanced-braking-marker"]');
    expect(brakingMarker.style.bottom).toBe(`${projectToShaftPercent(switchDistanceAdvanced(model, p), domain)}%`);
  });
});

// Item 8 — changing a model input after a reveal resets the hint; an
// in-progress/cleared field does not throw and leaves the last valid model.
describe("Advanced model change resets a revealed hint", () => {
  it("removes the reveal/match/marker and restores advanced-hint-button when a-input changes", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-reveal-button"]').click();
    expect(root.querySelector('[data-testid="advanced-hint-revealed"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="advanced-fastest-valid-marker"]')).not.toBeNull();

    const aInput = required<HTMLInputElement>(root, '[data-testid="advanced-a-input"]');
    setValue(jsdom, aInput, "2");

    expect(root.querySelector('[data-testid="advanced-hint-conceptual"]')).toBeNull();
    expect(root.querySelector('[data-testid="advanced-reveal-button"]')).toBeNull();
    expect(root.querySelector('[data-testid="advanced-hint-revealed"]')).toBeNull();
    expect(root.querySelector('[data-testid="advanced-match-button"]')).toBeNull();
    expect(root.querySelector('[data-testid="advanced-fastest-valid-marker"]')).toBeNull();
    expect(root.querySelector('[data-testid="advanced-hint-button"]')).not.toBeNull();
  });

  it("does not throw and keeps the last valid model when a field is cleared mid-edit", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    const hInput = required<HTMLInputElement>(root, '[data-testid="advanced-h-input"]');
    const domainBefore = shaftDomain(DEFAULT_ADVANCED_MODEL);
    const targetMarker = required<HTMLElement>(root, '[data-testid="advanced-target-marker"]');
    expect(targetMarker.style.bottom).toBe(`${projectToShaftPercent(DEFAULT_ADVANCED_MODEL.H, domainBefore)}%`);

    expect(() => setValue(jsdom, hInput, "")).not.toThrow();

    expect(targetMarker.style.bottom).toBe(`${projectToShaftPercent(DEFAULT_ADVANCED_MODEL.H, domainBefore)}%`);
  });
});

// Item 9 — changing the percentage input alone never resets the hint.
describe("Advanced percentage change alone does not reset the hint", () => {
  it("leaves a revealed hint intact when only the percentage slider changes", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-reveal-button"]').click();

    const percentageInput = required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
    setValue(jsdom, percentageInput, "72");

    expect(root.querySelector('[data-testid="advanced-hint-revealed"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="advanced-fastest-valid-marker"]')).not.toBeNull();
  });
});

// Item 10 — post-reveal text/marker exactly match optimalSwitchPercentage /
// optimalSwitchDistance.
describe("Advanced reveal — exact text and marker position", () => {
  it("matches optimalSwitchPercentage/optimalSwitchDistance for DEFAULT_ADVANCED_MODEL", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-reveal-button"]').click();

    const model = DEFAULT_ADVANCED_MODEL;
    const optimalP = optimalSwitchPercentage(model);
    const revealed = required<HTMLElement>(root, '[data-testid="advanced-hint-revealed"]');
    expect(revealed.textContent).toContain(`${optimalP}%`);

    const marker = required<HTMLElement>(root, '[data-testid="advanced-fastest-valid-marker"]');
    const expectedPercent = projectToShaftPercent(optimalSwitchDistance(model), shaftDomain(model));
    expect(marker.style.bottom).toBe(`${expectedPercent}%`);
  });
});

// Item 11 — advanced-match-button sets fields, preserves reveal, idempotent.
describe("Advanced match button", () => {
  it("sets the percentage to the optimum, preserves the reveal, and is idempotent", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-reveal-button"]').click();

    const model = DEFAULT_ADVANCED_MODEL;
    const optimalP = optimalSwitchPercentage(model);
    const matchButton = required<HTMLButtonElement>(root, '[data-testid="advanced-match-button"]');

    matchButton.click();
    const percentageInput = required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
    expect(Number(percentageInput.value)).toBe(optimalP);
    expect(required<HTMLElement>(root, '[data-testid="advanced-percentage-value"]').textContent).toContain(
      `${optimalP}%`,
    );
    expect(root.querySelector('[data-testid="advanced-hint-revealed"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="advanced-match-button"]')).not.toBeNull();

    matchButton.click();
    expect(Number(percentageInput.value)).toBe(optimalP);
  });
});

// Item 12 — full reduced-motion run-to-completion for short/overshoot/correct
// (correct reached via advanced-match-button, per CLAUDE.md's boundary rule).
describe("Advanced Run — reduced motion completion", () => {
  it.each([
    ["short", 20],
    ["overshoot", 80],
  ] as const)("completes to advanced-result for %s p=%i", async (_label, p) => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    const input = required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
    setValue(jsdom, input, String(p));
    required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]').click();

    const model = DEFAULT_ADVANCED_MODEL;
    const expected = resultViewAdvanced(buildAdvancedAttemptResult(model, p));
    const result = required<HTMLElement>(root, '[data-testid="advanced-result"]');
    expect(result.querySelector('[data-testid="result-heading"]')?.textContent?.trim()).toBe(expected.heading);
  });

  it("completes to advanced-result for correct, reached via advanced-match-button rather than sampled timing", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-reveal-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-match-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]').click();

    const model = DEFAULT_ADVANCED_MODEL;
    const optimalP = optimalSwitchPercentage(model);
    const expected = resultViewAdvanced(buildAdvancedAttemptResult(model, optimalP));
    const result = required<HTMLElement>(root, '[data-testid="advanced-result"]');
    expect(result.querySelector('[data-testid="result-heading"]')?.textContent?.trim()).toBe(expected.heading);
    expect(expected.heading).toBe("Exactly right");
  });

  it("completes via the animated (non-reduced-motion) path too", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);
    const raf = installFakeRaf(jsdom);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="change-rules-button"]').click();
    allowMotion(jsdom);

    const p = 80;
    const input = required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
    setValue(jsdom, input, String(p));
    required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]').click();

    expect(root.querySelector('[data-testid="advanced-running"]')).not.toBeNull();

    const model = DEFAULT_ADVANCED_MODEL;
    const stopTimeS = stopTimeAdvanced(model, p);
    const visualDurationMs = visualDuration(stopTimeS) * 1000;
    raf.advance(0); // establishes the analytic t=0 render frame
    raf.advance(visualDurationMs);
    drainUntilResult(root, raf, "advanced-result");

    expect(root.querySelector('[data-testid="advanced-running"]')).toBeNull();
    expect(root.querySelector('[data-testid="advanced-result"]')).not.toBeNull();
  });
});

// Item 13 — hint-comparison presence/absence matches whether the hint was
// revealed at Run time.
describe("Advanced Result — hint comparison presence", () => {
  it("renders no advanced-hint-comparison when the hint was never revealed", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]').click();

    expect(root.querySelector('[data-testid="advanced-hint-comparison"]')).toBeNull();
  });

  it("renders advanced-hint-comparison matching buildAdvancedHintComparison when the hint was revealed", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    const p = 20;
    const input = required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
    setValue(jsdom, input, String(p));
    required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-reveal-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]').click();

    const model = DEFAULT_ADVANCED_MODEL;
    const expected = buildAdvancedHintComparison(p, optimalSwitchPercentage(model));
    const comparison = required<HTMLElement>(root, '[data-testid="advanced-hint-comparison"]');
    expect(comparison.querySelector('[data-field="yourBrake"]')?.textContent?.trim()).toBe(
      `${expected.yourBrake}%`,
    );
    expect(comparison.querySelector('[data-field="fastestValid"]')?.textContent?.trim()).toBe(
      `${expected.fastestValid}%`,
    );
    expect(comparison.querySelector('[data-field="hintDifference"]')?.textContent?.trim()).toBe(
      expected.differenceLabel,
    );
  });
});

// Item 14 — model/p preservation across >=2 Run->Retry cycles, hint reset
// each time, focus on advanced-percentage-input.
describe("Advanced Retry — model/p preservation across cycles", () => {
  it("preserves model and p, resets the hint, and focuses advanced-percentage-input across two cycles", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    const aInput = required<HTMLInputElement>(root, '[data-testid="advanced-a-input"]');
    setValue(jsdom, aInput, "2");

    for (const p of [15, 40]) {
      const input = required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
      setValue(jsdom, input, String(p));
      required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]').click();
      required<HTMLButtonElement>(root, '[data-testid="advanced-reveal-button"]').click();
      required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]').click();
      required<HTMLButtonElement>(root, '[data-testid="advanced-retry-button"]').click();

      expect(root.querySelector('[data-testid="advanced-hint-conceptual"]')).toBeNull();
      expect(root.querySelector('[data-testid="advanced-reveal-button"]')).toBeNull();
      expect(root.querySelector('[data-testid="advanced-hint-revealed"]')).toBeNull();
      expect(root.querySelector('[data-testid="advanced-fastest-valid-marker"]')).toBeNull();

      const preservedAInput = required<HTMLInputElement>(root, '[data-testid="advanced-a-input"]');
      expect(preservedAInput.value).toBe("2");
      const preservedPInput = required<HTMLInputElement>(root, '[data-testid="advanced-percentage-input"]');
      expect(preservedPInput.value).toBe(String(p));

      expect(jsdom.window.document.activeElement).toBe(
        jsdom.window.document.querySelector('[data-testid="advanced-percentage-input"]'),
      );
    }
  });
});

// Item 15 — no forbidden vocabulary anywhere in new elements.
describe("Advanced — forbidden vocabulary", () => {
  it("keeps Advanced Predicting, hint, and Result free of forbidden terms", async () => {
    const jsdom = await renderPlayPage();
    const root = await switchToAdvanced(jsdom);

    required<HTMLButtonElement>(root, '[data-testid="advanced-hint-button"]').click();
    required<HTMLButtonElement>(root, '[data-testid="advanced-reveal-button"]').click();

    const predicting = required<HTMLElement>(root, '[data-testid="advanced-predicting"]');
    const predictingText = (predicting.textContent ?? "").toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      expect(predictingText).not.toContain(term);
    }

    required<HTMLButtonElement>(root, '[data-testid="advanced-run-button"]').click();
    const result = required<HTMLElement>(root, '[data-testid="advanced-result"]');
    const resultText = (result.textContent ?? "").toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      expect(resultText).not.toContain(term);
    }
  });

  it("checks advancedConceptualHint across all three a/b branches", () => {
    for (const model of [
      { H: 10, a: 1.5, b: 1.5 },
      { H: 10, a: 2, b: 1 },
      { H: 10, a: 1, b: 2 },
    ]) {
      const text = advancedConceptualHint(model).toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(text).not.toContain(term);
      }
    }
  });
});

// Item 16 — Home/Principle render zero advanced-prefixed testids.
describe("Regression — Home and Principle carry no Advanced markup", () => {
  it("renders no advanced-prefixed testid on Home", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HomePage, { partial: false });
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll('[data-testid^="advanced-"]')).toHaveLength(0);
  });

  it("renders no advanced-prefixed testid on Principle", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PrinciplePage, { partial: false });
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll('[data-testid^="advanced-"]')).toHaveLength(0);
  });

  it("renders no advanced-prefixed testid on Play before CHANGE THE RULES is clicked", async () => {
    const jsdom = await renderPlayPage();
    expect(jsdom.window.document.querySelectorAll('[data-testid^="advanced-"]')).toHaveLength(0);
  });
});
