import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import IndexPage from "../src/pages/index.astro";

// Test-first slice: index.astro still has starter markup. Every assertion
// below is expected to fail except the ones noted in the review as
// inherited-invariant passes — see INTERACTION.md "DOM/Astro red-test scope"
// items 1-3 (static contract only; Run/Result/Retry behaviour is Slice B).
//
// The approved-copy constants below are pinned directly from INTERACTION.md
// "Approved novice copy", not imported from COPY/DISCLAIMER. This is
// deliberate contract pinning, not an accidental duplicate source: COPY and
// DISCLAIMER stay the one production source of truth once index.astro
// imports them in the green phase, and this test checks production against
// the approved contract text independently, so drift between the two would
// fail here rather than passing by construction.
const APPROVED_HEADING = "Bring the elevator to a stop at the target";
const APPROVED_TASK =
  "Choose where the elevator should start braking, then run it. The goal isn't just to reach the target — it must be completely stopped when it gets there.";
const APPROVED_SLIDER_LABEL = "Start braking at this percentage of the distance to the target";
const APPROVED_RUN_LABEL = "Run";
const APPROVED_RETRY_LABEL = "Try again";
const APPROVED_DISCLAIMER =
  "This is a simplified model. It treats the elevator as a single point that speeds up and slows down at a fixed rate. It ignores motor behaviour, weight, cables, comfort, and other real-world limits.";
const APPROVED_INITIAL_PERCENTAGE = 35;

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

let doc: Document;

beforeAll(async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(IndexPage, { partial: false });
  doc = new JSDOM(html).window.document;
});

function required<T extends Element>(selector: string): T {
  const element = doc.querySelector<T>(selector);
  expect(element, `expected to find ${selector} in the rendered page`).not.toBeNull();
  return element as T;
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return [...doc.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) ?? null;
}

describe("index.astro — navigation and heading", () => {
  it("keeps the nav landmark", () => {
    expect(doc.querySelector('nav[aria-label="Primary"]')).not.toBeNull();
  });

  it("has exactly one h1", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
  });

  it("h1 uses the approved heading copy", () => {
    const h1 = required("h1");
    expect(h1.textContent?.trim()).toBe(APPROVED_HEADING);
  });

  it("renders the approved task copy", () => {
    const task = required('[data-testid="task"]');
    expect(task.textContent?.trim()).toBe(APPROVED_TASK);
  });
});

describe("index.astro — phase mount root and Predicting subtree", () => {
  it("has exactly one elevator-app root", () => {
    expect(doc.querySelectorAll('[data-testid="elevator-app"]')).toHaveLength(1);
  });

  it("has exactly one initial Predicting subtree, inside the mount root", () => {
    const root = required<HTMLElement>('[data-testid="elevator-app"]');
    expect(doc.querySelectorAll('[data-testid="predicting"]')).toHaveLength(1);
    const predicting = required<HTMLElement>('[data-testid="predicting"]');
    expect(root.contains(predicting)).toBe(true);
  });
});

describe("index.astro — Result, Retry, and formal disclosure are absent", () => {
  it("renders no Result subtree", () => {
    expect(doc.querySelector('[data-testid="result"]')).toBeNull();
  });

  it("renders no Retry button", () => {
    expect(buttonWithText(APPROVED_RETRY_LABEL)).toBeNull();
  });

  it("renders no formal-model disclosure element", () => {
    expect(doc.querySelector('[data-testid="formal-model"]')).toBeNull();
  });

  it("uses no formal-model vocabulary anywhere on the page", () => {
    const text = doc.body.textContent?.toLowerCase() ?? "";
    for (const term of FORBIDDEN_TERMS) {
      expect(text).not.toContain(term);
    }
  });
});

describe("index.astro — range input", () => {
  it("has min=1, max=100, step=1, and the approved initial value", () => {
    const input = required<HTMLInputElement>('input[type="range"]');
    expect(input.min).toBe("1");
    expect(input.max).toBe("100");
    expect(input.step).toBe("1");
    expect(input.value).toBe(String(APPROVED_INITIAL_PERCENTAGE));
  });

  it("has a real associated label using the approved slider-label copy", () => {
    const input = required<HTMLInputElement>('input[type="range"]');
    expect(input.id, "range input needs an id for its label to reference").not.toBe("");
    const label = required<HTMLLabelElement>(`label[for="${input.id}"]`);
    expect(label.textContent?.trim()).toBe(APPROVED_SLIDER_LABEL);
  });

  it("shows the approved initial percentage as visible text", () => {
    const visible = required('[data-testid="percentage-value"]');
    expect(visible.textContent?.trim()).toBe(`${APPROVED_INITIAL_PERCENTAGE}%`);
  });
});

describe("index.astro — Run button", () => {
  it("has the approved Run button copy", () => {
    const run = buttonWithText(APPROVED_RUN_LABEL);
    expect(run, `expected a <button> with text "${APPROVED_RUN_LABEL}"`).not.toBeNull();
  });
});

describe("index.astro — permanent disclaimer", () => {
  it("matches the approved disclaimer copy exactly", () => {
    const disclaimer = required('[data-testid="disclaimer"]');
    expect(disclaimer.textContent?.trim()).toBe(APPROVED_DISCLAIMER);
  });

  it("sits outside the phase mount root", () => {
    const root = required<HTMLElement>('[data-testid="elevator-app"]');
    const disclaimer = required<HTMLElement>('[data-testid="disclaimer"]');
    expect(root.contains(disclaimer)).toBe(false);
  });
});
