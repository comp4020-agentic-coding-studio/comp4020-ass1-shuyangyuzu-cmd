import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import PlayPage from "../src/pages/play.astro";

// This suite originally targeted index.astro before the three-route
// migration moved the Beginner game to play.astro (Home is now a separate,
// non-playable route — see spec/home-page.test.ts). The assertions below are
// unchanged from that migration, only the rendered page and its describe
// labels were repointed.
//
// The approved-copy constants below are pinned directly from INTERACTION.md
// "Approved novice copy", not imported from COPY/DISCLAIMER. This is
// deliberate contract pinning, not an accidental duplicate source: COPY and
// DISCLAIMER stay the one production source of truth once play.astro imports
// them, and this test checks production against the approved contract text
// independently, so drift between the two would fail here rather than
// passing by construction.
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
  const html = await container.renderToString(PlayPage, { partial: false });
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

describe("play.astro — navigation and heading", () => {
  it("keeps the nav landmark", () => {
    expect(doc.querySelector('nav[aria-label="Primary"]')).not.toBeNull();
  });

  it("marks PLAY as the current nav entry", () => {
    const links = [...doc.querySelectorAll('nav[aria-label="Primary"] a')];
    const current = links.filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent?.trim()).toBe("PLAY");
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

describe("play.astro — phase mount root and Predicting subtree", () => {
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

describe("play.astro — Result, Retry, and formal disclosure are absent", () => {
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

describe("play.astro — range input", () => {
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

describe("play.astro — hint (initial, server-rendered)", () => {
  it("has exactly one hint-button and no conceptual/reveal/revealed/marker elements before any interaction", () => {
    expect(doc.querySelectorAll('[data-testid="hint-button"]')).toHaveLength(1);
    expect(required('[data-testid="hint-button"]').textContent?.trim()).toBe("STUCK? GET A HINT.");
    expect(doc.querySelector('[data-testid="hint-conceptual"]')).toBeNull();
    expect(doc.querySelector('[data-testid="reveal-button"]')).toBeNull();
    expect(doc.querySelector('[data-testid="hint-revealed"]')).toBeNull();
    expect(doc.querySelector('[data-testid="fastest-valid-marker"]')).toBeNull();
  });

  it("sits inside the Predicting subtree", () => {
    const predicting = required<HTMLElement>('[data-testid="predicting"]');
    const hintButton = required<HTMLElement>('[data-testid="hint-button"]');
    expect(predicting.contains(hintButton)).toBe(true);
  });
});

describe("play.astro — Run button", () => {
  it("has the approved Run button copy", () => {
    const run = buttonWithText(APPROVED_RUN_LABEL);
    expect(run, `expected a <button> with text "${APPROVED_RUN_LABEL}"`).not.toBeNull();
  });
});

describe("play.astro — permanent disclaimer", () => {
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
