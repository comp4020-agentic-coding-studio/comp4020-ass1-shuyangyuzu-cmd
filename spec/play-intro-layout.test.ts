import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import PlayPage from "../src/pages/play.astro";

// Structural regression test for the Play intro layout-stability fix: the
// <h1> must be its own full-width row in `.play-intro`, never a flex sibling
// of the CTA host, so revealing `see-why-link-host` cannot change the h1's
// available width. See INTERACTION.md "Play intro layout stability (approved)".
// This test asserts DOM structure only — no pixel/CSS measurement (Vitest has
// no layout engine); geometry is verified separately in a real browser.

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

describe("Play intro layout stability — h1 isolated from CTA row", () => {
  it("renders the h1 as a direct child of .play-intro, not of .play-intro-row", async () => {
    const jsdom = await renderPlayPage();
    const doc = jsdom.window.document;
    const intro = required<HTMLElement>(doc, ".play-intro");
    const heading = required<HTMLElement>(doc, "#beginner-heading");

    expect(heading.parentElement).toBe(intro);

    const row = doc.querySelector(".play-intro-row");
    expect(row?.contains(heading)).toBe(false);
  });

  it("keeps the task paragraph and the see-why-link host as siblings inside .play-intro-row", async () => {
    const jsdom = await renderPlayPage();
    const doc = jsdom.window.document;
    const row = required<HTMLElement>(doc, ".play-intro-row");
    const task = required<HTMLElement>(doc, '[data-testid="task"]');
    const ctaHost = required<HTMLElement>(doc, '[data-testid="see-why-link-host"]');

    expect(task.parentElement).toBe(row);
    expect(ctaHost.parentElement).toBe(row);
  });

  it("orders the h1 before .play-intro-row in document order", async () => {
    const jsdom = await renderPlayPage();
    const doc = jsdom.window.document;
    const heading = required<HTMLElement>(doc, "#beginner-heading");
    const row = required<HTMLElement>(doc, ".play-intro-row");

    const position = heading.compareDocumentPosition(row);
    expect(position & jsdom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the see-why-link host hidden by default, independent of h1 placement", async () => {
    const jsdom = await renderPlayPage();
    const doc = jsdom.window.document;
    const ctaHost = required<HTMLElement>(doc, '[data-testid="see-why-link-host"]');
    expect(ctaHost.hasAttribute("hidden")).toBe(true);
  });
});
