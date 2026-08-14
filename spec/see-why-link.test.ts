import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { initElevatorUI } from "../src/scripts/elevator-dom";
import HomePage from "../src/pages/index.astro";
import PlayPage from "../src/pages/play.astro";
import PrinciplePage from "../src/pages/principle.astro";

// Test-first slice: play.astro does not yet render see-why-link-host, and
// elevator-dom.ts does not yet call revealSeeWhyLink. See INTERACTION.md
// "Contextual Principle disclosure in Play (approved)" and its "Tests (this
// slice)" list, which this file exercises item by item.

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

function preferReducedMotion(jsdom: JSDOM): void {
  stubMatchMedia(jsdom, true);
}

function seeWhyHost(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>('[data-testid="see-why-link-host"]');
}

async function reachBeginnerResult(p: number): Promise<JSDOM> {
  const jsdom = await renderPlayPage();
  const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
  preferReducedMotion(jsdom);
  initElevatorUI(root);
  const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
  setValue(jsdom, input, String(p));
  required<HTMLButtonElement>(jsdom.window.document, '[data-testid="run-button"]').click();
  return jsdom;
}

// Item 1
describe("Contextual Principle disclosure — fresh Play", () => {
  it("is hidden, inside the hidden host, before any attempt", async () => {
    const jsdom = await renderPlayPage();
    const doc = jsdom.window.document;

    const host = seeWhyHost(doc);
    expect(host, "expected a see-why-link-host").not.toBeNull();
    expect(host?.hidden).toBe(true);
    expect(host?.hasAttribute("hidden")).toBe(true);

    const link = required<HTMLAnchorElement>(doc, '[data-testid="see-why-link"]');
    expect(link.getAttribute("href")).toBe("principle.html");
    expect(link.closest("[hidden]")).toBe(host);
  });
});

// Item 2
describe("Contextual Principle disclosure — appears after the first Result", () => {
  it.each([
    ["short", 35],
    ["correct", 50],
    ["overshoot", 65],
  ] as const)("reveals exactly one see-why-link with the approved label after a %s result", async (_label, p) => {
    const jsdom = await reachBeginnerResult(p);
    const doc = jsdom.window.document;

    expect(seeWhyHost(doc)?.hidden).toBe(false);
    const links = doc.querySelectorAll('[data-testid="see-why-link"]');
    expect(links).toHaveLength(1);
    expect(links[0].textContent?.trim()).toBe("SEE WHY IT WORKS");
    expect(links[0].getAttribute("href")).toBe("principle.html");
  });
});

// Item 3
describe("Contextual Principle disclosure — survives Retry", () => {
  it("remains present exactly once after Retry", async () => {
    const jsdom = await reachBeginnerResult(35);
    const doc = jsdom.window.document;

    required<HTMLButtonElement>(doc, '[data-testid="retry-button"]').click();

    expect(seeWhyHost(doc)?.hidden).toBe(false);
    expect(doc.querySelectorAll('[data-testid="see-why-link"]')).toHaveLength(1);
  });
});

// Item 4
describe("Contextual Principle disclosure — survives repeated cycles", () => {
  it("stays exactly one across three Run/Retry cycles", async () => {
    const jsdom = await reachBeginnerResult(35);
    const doc = jsdom.window.document;

    for (let cycle = 0; cycle < 3; cycle++) {
      required<HTMLButtonElement>(doc, '[data-testid="retry-button"]').click();
      required<HTMLButtonElement>(doc, '[data-testid="run-button"]').click();
      expect(
        doc.querySelectorAll('[data-testid="see-why-link"]'),
        `expected exactly one see-why-link after cycle ${cycle + 1}`,
      ).toHaveLength(1);
    }
    expect(seeWhyHost(doc)?.hidden).toBe(false);
  });
});

// Item 5
describe("Contextual Principle disclosure — survives CHANGE THE RULES", () => {
  it("remains visible in Advanced after switching modes", async () => {
    const jsdom = await reachBeginnerResult(35);
    const doc = jsdom.window.document;

    required<HTMLButtonElement>(doc, '[data-testid="change-rules-button"]').click();

    expect(seeWhyHost(doc)?.hidden).toBe(false);
    expect(doc.querySelectorAll('[data-testid="see-why-link"]')).toHaveLength(1);
  });
});

// Item 6
describe("Contextual Principle disclosure — survives Advanced parameter changes and cycles", () => {
  it("stays exactly one through a parameter edit and two Advanced Run/Retry cycles", async () => {
    const jsdom = await reachBeginnerResult(35);
    const doc = jsdom.window.document;
    required<HTMLButtonElement>(doc, '[data-testid="change-rules-button"]').click();

    const aInput = required<HTMLInputElement>(doc, '[data-testid="advanced-a-input"]');
    setValue(jsdom, aInput, "2");
    expect(doc.querySelectorAll('[data-testid="see-why-link"]')).toHaveLength(1);

    for (let cycle = 0; cycle < 2; cycle++) {
      required<HTMLButtonElement>(doc, '[data-testid="advanced-run-button"]').click();
      required<HTMLButtonElement>(doc, '[data-testid="advanced-retry-button"]').click();
      expect(
        doc.querySelectorAll('[data-testid="see-why-link"]'),
        `expected exactly one see-why-link after Advanced cycle ${cycle + 1}`,
      ).toHaveLength(1);
    }
    expect(seeWhyHost(doc)?.hidden).toBe(false);
  });
});

// Item 7
describe("Contextual Principle disclosure — does not steal focus on reveal", () => {
  it("leaves document.activeElement on the Result section", async () => {
    const jsdom = await reachBeginnerResult(35);
    const doc = jsdom.window.document;

    expect(doc.activeElement).toBe(doc.querySelector('[data-testid="result"]'));
  });

  it("leaves document.activeElement on the Advanced Result section", async () => {
    const jsdom = await reachBeginnerResult(35);
    const doc = jsdom.window.document;
    required<HTMLButtonElement>(doc, '[data-testid="change-rules-button"]').click();

    required<HTMLButtonElement>(doc, '[data-testid="advanced-run-button"]').click();

    expect(doc.activeElement).toBe(doc.querySelector('[data-testid="advanced-result"]'));
  });
});

// Item 8
describe("Home — single hero CTA only", () => {
  it("renders only TAKE THE ELEVATOR, and no see-why-link surface", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HomePage, { partial: false });
    const doc = new JSDOM(html).window.document;

    const ctas = [...doc.querySelectorAll(".hero-cta")];
    expect(ctas).toHaveLength(1);
    expect(ctas[0].textContent?.trim()).toBe("TAKE THE ELEVATOR");
    expect(doc.querySelector('[data-testid="see-why-link"]')).toBeNull();
    expect(doc.querySelector('[data-testid="see-why-link-host"]')).toBeNull();
  });
});

// Item 9
describe("Shared WHY? navigation — present on every route", () => {
  it.each([
    ["Home", HomePage],
    ["Play", PlayPage],
    ["Principle", PrinciplePage],
  ] as const)("renders a WHY? nav link on %s", async (_label, Page) => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Page, { partial: false });
    const doc = new JSDOM(html).window.document;

    const links = [...doc.querySelectorAll('nav[aria-label="Primary"] a')];
    expect(links.some((a) => a.textContent?.trim() === "WHY?")).toBe(true);
  });
});

// Item 10
describe("Principle — no Play-only contextual CTA", () => {
  it("renders no see-why-link surface", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PrinciplePage, { partial: false });
    const doc = new JSDOM(html).window.document;

    expect(doc.querySelector('[data-testid="see-why-link"]')).toBeNull();
    expect(doc.querySelector('[data-testid="see-why-link-host"]')).toBeNull();
  });
});
