import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// The favicon.ico 404 found in the Assignment 1 production-preview stress
// test (a browser's automatic same-origin request when no icon is declared)
// is base-path independent by construction only if every built page declares
// its own icon link — hence this runs against the BUILT site, like
// spec/invariants.test.ts, rather than against Layout.astro's source alone.
const DIST = resolve("dist");

function htmlFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const pages = htmlFiles().map((path) => ({
  name: relative(DIST, path),
  doc: new JSDOM(readFileSync(path, "utf8")).window.document,
}));

describe("invariants: every page declares a site icon", () => {
  it("built at least one page", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  for (const { name, doc } of pages) {
    it(`${name} has exactly one non-empty <link rel="icon">`, () => {
      const icons = [...doc.querySelectorAll('link[rel="icon"]')];
      expect(icons).toHaveLength(1);
      expect(icons[0].getAttribute("href")?.trim()).toBeTruthy();
    });

    it(`${name} icon is a self-contained data URL, not an external or root-relative request`, () => {
      const icon = doc.querySelector('link[rel="icon"]');
      const href = icon?.getAttribute("href") ?? "";
      expect(href.startsWith("data:image/svg+xml")).toBe(true);
      expect(icon?.getAttribute("type")).toBe("image/svg+xml");
    });
  }
});
