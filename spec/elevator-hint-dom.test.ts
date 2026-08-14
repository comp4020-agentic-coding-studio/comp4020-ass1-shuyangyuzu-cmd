import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { shaftDomain, projectToShaftPercent } from "../src/scripts/elevator-animation";
import { BEGINNER_FASTEST_VALID_P, buildHintComparison } from "../src/scripts/elevator-hint";
import { initElevatorUI } from "../src/scripts/elevator-dom";
import { DEFAULT_MODEL, switchDistance } from "../src/model/elevator";
import PlayPage from "../src/pages/play.astro";

// Test-first slice: elevator-dom.ts does not yet wire the hint container
// described in INTERACTION.md "Third UI slice — Hint and Reveal (approved)".
// This file exercises that DOM contract against the real rendered play.astro,
// the same infrastructure already used by spec/elevator-ui.test.ts.

const SHAFT_EXTENT = shaftDomain(DEFAULT_MODEL);
const FASTEST_VALID_PERCENT = projectToShaftPercent(switchDistance(DEFAULT_MODEL, BEGINNER_FASTEST_VALID_P), SHAFT_EXTENT);

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

describe("hint — initial state and conceptual reveal", () => {
  it("clicking hint-button removes it, adds hint-conceptual and reveal-button, and moves focus to hint-conceptual", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="hint-button"]').click();

    expect(jsdom.window.document.querySelector('[data-testid="hint-button"]')).toBeNull();
    const conceptual = required<HTMLElement>(jsdom.window.document, '[data-testid="hint-conceptual"]');
    expect(
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="reveal-button"]').textContent?.trim(),
    ).toBe("REVEAL THE FASTEST VALID BRAKING POINT");
    expect(jsdom.window.document.activeElement).toBe(conceptual);
    expect(jsdom.window.document.querySelector('[data-testid="fastest-valid-marker"]')).toBeNull();
  });
});

describe("hint — fastest-valid reveal", () => {
  it("clicking reveal-button removes it, adds hint-revealed and the shaft marker, moves focus, and leaves the visitor's own controls untouched", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const input = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, 20);
    const brakingMarkerBefore = required<HTMLElement>(jsdom.window.document, '[data-testid="braking-marker"]').style
      .bottom;

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="hint-button"]').click();
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="reveal-button"]').click();

    expect(jsdom.window.document.querySelector('[data-testid="reveal-button"]')).toBeNull();
    expect(jsdom.window.document.querySelector('[data-testid="hint-conceptual"]')).not.toBeNull();
    const revealed = required<HTMLElement>(jsdom.window.document, '[data-testid="hint-revealed"]');
    expect(jsdom.window.document.activeElement).toBe(revealed);

    const marker = required<HTMLElement>(jsdom.window.document, '[data-testid="fastest-valid-marker"]');
    expect(marker.style.bottom).toBe(`${FASTEST_VALID_PERCENT}%`);

    expect(required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]').value).toBe("20");
    expect(required<HTMLElement>(jsdom.window.document, '[data-testid="braking-marker"]').style.bottom).toBe(
      brakingMarkerBefore,
    );
  });
});

describe("hint — Result comparison", () => {
  it("renders no hint-comparison when the hint was never used", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();

    expect(jsdom.window.document.querySelector('[data-testid="hint-comparison"]')).toBeNull();
  });

  it("renders no hint-comparison when only the conceptual hint was shown, without a reveal", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="hint-button"]').click();
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();

    expect(jsdom.window.document.querySelector('[data-testid="hint-comparison"]')).toBeNull();
  });

  it.each([20, 50, 65])("renders hint-comparison matching buildHintComparison for p=%i after a full reveal", async (p) => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const input = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="hint-button"]').click();
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="reveal-button"]').click();
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();

    const expected = buildHintComparison(p, BEGINNER_FASTEST_VALID_P);
    const comparison = required<HTMLElement>(jsdom.window.document, '[data-testid="hint-comparison"]');
    expect(comparison.querySelector('[data-field="yourBrake"]')?.textContent?.trim()).toBe(`${expected.yourBrake}%`);
    expect(comparison.querySelector('[data-field="fastestValid"]')?.textContent?.trim()).toBe(
      `${expected.fastestValid}%`,
    );
    expect(comparison.querySelector('[data-field="hintDifference"]')?.textContent?.trim()).toBe(
      expected.differenceLabel,
    );
  });
});

describe("hint — Retry reset", () => {
  it("resets the hint container to its single hint-button state across two consecutive reveal -> Run -> Retry cycles, without moving Retry's own focus target", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    for (const p of [30, 70]) {
      const input = required<HTMLInputElement>(jsdom.window.document, '[data-testid="percentage-input"]');
      setPercentage(jsdom, input, p);
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="hint-button"]').click();
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="reveal-button"]').click();
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="retry-button"]').click();

      expect(jsdom.window.document.querySelector('[data-testid="hint-conceptual"]')).toBeNull();
      expect(jsdom.window.document.querySelector('[data-testid="reveal-button"]')).toBeNull();
      expect(jsdom.window.document.querySelector('[data-testid="hint-revealed"]')).toBeNull();
      expect(jsdom.window.document.querySelector('[data-testid="fastest-valid-marker"]')).toBeNull();
      expect(jsdom.window.document.querySelector('[data-testid="hint-button"]')).not.toBeNull();

      expect(jsdom.window.document.activeElement).toBe(
        jsdom.window.document.querySelector('[data-testid="percentage-input"]'),
      );
    }
  });
});

describe("hint — no duplicate controls across repeated bare Retry cycles", () => {
  it("keeps exactly one hint-button after each of three consecutive Run -> Retry cycles with no hint interaction", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    for (let cycle = 0; cycle < 3; cycle++) {
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="retry-button"]').click();

      expect(
        jsdom.window.document.querySelectorAll('[data-testid="hint-button"]'),
        `expected exactly one hint-button after bare cycle ${cycle + 1}`,
      ).toHaveLength(1);
    }
  });
});

describe("hint — one click produces exactly one state transition", () => {
  it("clicking hint-button once does not throw and leaves exactly one conceptual surface and one reveal-button", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const errors: unknown[] = [];
    jsdom.window.addEventListener("error", (event) => errors.push(event.error ?? event.message));

    expect(() =>
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="hint-button"]').click(),
    ).not.toThrow();

    expect(errors).toHaveLength(0);
    expect(jsdom.window.document.querySelectorAll('[data-testid="hint-button"]')).toHaveLength(0);
    expect(jsdom.window.document.querySelectorAll('[data-testid="hint-conceptual"]')).toHaveLength(1);
    expect(jsdom.window.document.querySelectorAll('[data-testid="reveal-button"]')).toHaveLength(1);

    expect(() =>
      required<HTMLButtonElement>(jsdom.window.document, '[data-testid="reveal-button"]').click(),
    ).not.toThrow();

    expect(errors).toHaveLength(0);
    expect(jsdom.window.document.querySelectorAll('[data-testid="hint-revealed"]')).toHaveLength(1);
    expect(jsdom.window.document.querySelectorAll('[data-testid="fastest-valid-marker"]')).toHaveLength(1);
  });
});

describe("hint — forbidden vocabulary", () => {
  it("keeps every hint element free of forbidden terms, through conceptual and revealed states", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="hint-button"]').click();
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="reveal-button"]').click();

    const hint = required<HTMLElement>(jsdom.window.document, '[data-testid="hint"]');
    const text = hint.textContent?.toLowerCase() ?? "";
    for (const term of FORBIDDEN_TERMS) {
      expect(text).not.toContain(term);
    }
  });
});
