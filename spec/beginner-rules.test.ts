import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL } from "../src/model/elevator";
import { initElevatorUI } from "../src/scripts/elevator-dom";
import PlayPage from "../src/pages/play.astro";

// Test-first slice: play.astro does not yet render a visible statement of
// the Beginner problem's fixed conditions (target height, starting
// condition, shared speed-change rate) before the visitor picks a braking
// point. See INTERACTION.md "Beginner rules block (approved)".

const FORBIDDEN_TERMS = [
  "bang-bang",
  "pontryagin",
  "optimal control",
  "phase plane",
  "double integrator",
  "state-space",
  "switching function",
  "u(t)",
  "acceleration",
  "velocity",
  "deceleration",
  "kinematics",
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

describe("Beginner rules block — present on fresh Predicting", () => {
  it("renders THE RULES heading inside the Predicting subtree, above the slider", async () => {
    const jsdom = await renderPlayPage();
    const doc = jsdom.window.document;
    const predicting = required<HTMLElement>(doc, '[data-testid="predicting"]');
    const rules = required<HTMLElement>(predicting, '[data-testid="beginner-rules"]');
    expect(predicting.contains(rules)).toBe(true);

    const heading = required<HTMLElement>(rules, "h2");
    expect(heading.textContent?.trim()).toBe("THE RULES");

    const input = required<HTMLInputElement>(predicting, 'input[type="range"]');
    const position = rules.compareDocumentPosition(input);
    expect(position & jsdom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("states the target height using DEFAULT_MODEL.H", async () => {
    const jsdom = await renderPlayPage();
    const rules = required<HTMLElement>(jsdom.window.document, '[data-testid="beginner-rules"]');
    expect(rules.textContent).toContain(`${DEFAULT_MODEL.H} m`);
  });

  it("states the elevator starts at rest", async () => {
    const jsdom = await renderPlayPage();
    const rules = required<HTMLElement>(jsdom.window.document, '[data-testid="beginner-rules"]');
    expect(rules.textContent?.toLowerCase()).toContain("at rest");
  });

  it("states the shared speeding-up/slowing-down rate using DEFAULT_MODEL.a", async () => {
    const jsdom = await renderPlayPage();
    const rules = required<HTMLElement>(jsdom.window.document, '[data-testid="beginner-rules"]');
    expect(rules.textContent).toContain(`${DEFAULT_MODEL.a} m/s²`);
    expect(rules.textContent?.toLowerCase()).toContain("speeds up");
    expect(rules.textContent?.toLowerCase()).toContain("slows down");
  });

  it("states the one switch from speeding up to braking", async () => {
    const jsdom = await renderPlayPage();
    const rules = required<HTMLElement>(jsdom.window.document, '[data-testid="beginner-rules"]');
    const text = rules.textContent?.toLowerCase() ?? "";
    expect(text).toContain("speeding up to braking");
  });

  it("states the final speed as exactly 0 m/s", async () => {
    const jsdom = await renderPlayPage();
    const rules = required<HTMLElement>(jsdom.window.document, '[data-testid="beginner-rules"]');
    expect(rules.textContent).toContain("0 m/s");
  });

  it("never reveals the numeric answer (50% or halfway)", async () => {
    const jsdom = await renderPlayPage();
    const rules = required<HTMLElement>(jsdom.window.document, '[data-testid="beginner-rules"]');
    const text = rules.textContent?.toLowerCase() ?? "";
    expect(text).not.toContain("50%");
    expect(text).not.toContain("halfway");
  });

  it("introduces no forbidden specialist vocabulary", async () => {
    const jsdom = await renderPlayPage();
    const rules = required<HTMLElement>(jsdom.window.document, '[data-testid="beginner-rules"]');
    const text = rules.textContent?.toLowerCase() ?? "";
    for (const term of FORBIDDEN_TERMS) {
      expect(text).not.toContain(term);
    }
  });
});

describe("Beginner rules block — persists after Retry", () => {
  it("remains present, unchanged, after a Run -> Retry cycle", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    const before = required<HTMLElement>(root, '[data-testid="beginner-rules"]').textContent;

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
    expect(root.querySelector('[data-testid="beginner-rules"]')).toBeNull();

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="retry-button"]').click();

    const after = required<HTMLElement>(root, '[data-testid="beginner-rules"]').textContent;
    expect(after).toBe(before);
  });
});

describe("Beginner rules block — absent from Advanced Predicting", () => {
  it("is not duplicated inside advanced-predicting after CHANGE THE RULES", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    initElevatorUI(root);
    preferReducedMotion(jsdom);

    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
    required<HTMLButtonElement>(jsdom.window.document, '[data-testid="change-rules-button"]').click();

    const advancedPredicting = required<HTMLElement>(root, '[data-testid="advanced-predicting"]');
    expect(advancedPredicting.querySelector('[data-testid="beginner-rules"]')).toBeNull();
    expect(root.querySelector('[data-testid="beginner-rules"]')).toBeNull();
  });
});
