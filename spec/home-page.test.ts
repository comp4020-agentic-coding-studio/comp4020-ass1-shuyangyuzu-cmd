import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import IndexPage from "../src/pages/index.astro";

// index.astro is Home in the three-route architecture: an introduction with
// a call to action into Play, and no playable elevator of its own (that
// lives on play.astro — see spec/elevator-page.test.ts).

let doc: Document;

beforeAll(async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(IndexPage, { partial: false });
  doc = new JSDOM(html).window.document;
});

describe("index.astro — Home", () => {
  it("keeps the nav landmark", () => {
    expect(doc.querySelector('nav[aria-label="Primary"]')).not.toBeNull();
  });

  it("marks Home as the current nav entry", () => {
    const links = [...doc.querySelectorAll('nav[aria-label="Primary"] a')];
    const current = links.filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent?.trim()).toBe("HOME");
  });

  it("has exactly one h1", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
  });

  it("has no playable elevator mount root", () => {
    expect(doc.querySelector('[data-testid="elevator-app"]')).toBeNull();
  });

  it("links its call to action to the Play route", () => {
    const cta = doc.querySelector(".hero-cta");
    expect(cta, "expected a .hero-cta link").not.toBeNull();
    expect(cta?.getAttribute("href")).toBe("play.html");
  });
});
