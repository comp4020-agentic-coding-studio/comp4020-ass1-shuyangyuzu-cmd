import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import PrinciplePage from "../src/pages/principle.astro";

// principle.astro is a route shell in this slice; its explanatory content is
// built in a later slice (see the saved migration plan). This suite only
// pins the structural contract that must hold from the moment the route
// exists.

let doc: Document;

beforeAll(async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(PrinciplePage, { partial: false });
  doc = new JSDOM(html).window.document;
});

describe("principle.astro — route shell", () => {
  it("keeps the nav landmark", () => {
    expect(doc.querySelector('nav[aria-label="Primary"]')).not.toBeNull();
  });

  it("marks WHY? as the current nav entry", () => {
    const links = [...doc.querySelectorAll('nav[aria-label="Primary"] a')];
    const current = links.filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent?.trim()).toBe("WHY?");
  });

  it("has exactly one h1", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
  });

  it("has no playable elevator mount root", () => {
    expect(doc.querySelector('[data-testid="elevator-app"]')).toBeNull();
  });
});
