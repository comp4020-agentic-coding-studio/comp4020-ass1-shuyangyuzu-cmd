import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_MODEL, optimalSwitchDistance, switchDistance } from "../src/model/elevator";
import type { AdvancedModel } from "../src/model/elevator";
import { projectToShaftPercent, shaftDomain } from "../src/scripts/elevator-animation";
import PrinciplePage from "../src/pages/principle.astro";

// principle.astro's real content is documented in INTERACTION.md under
// "Principle page — content and layout contract (approved)". This suite
// covers that contract's "Principle page tests (this slice)" list.

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

  it("renders no hint control", () => {
    expect(doc.querySelector('[data-testid="hint"]')).toBeNull();
  });
});

describe("principle.astro — static shaft visual", () => {
  it("renders exactly one principle-visual element", () => {
    expect(doc.querySelectorAll('[data-testid="principle-visual"]')).toHaveLength(1);
  });

  it("positions the target marker at the same projection Play uses", () => {
    const extent = shaftDomain(DEFAULT_MODEL);
    const expected = projectToShaftPercent(DEFAULT_MODEL.H, extent);
    const marker = doc.querySelector('[data-testid="principle-visual"] [data-testid="principle-target-marker"]');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute("style")).toContain(`bottom: ${expected}%`);
  });

  it("positions the switch-point marker at the symmetric halfway projection", () => {
    const extent = shaftDomain(DEFAULT_MODEL);
    const expected = projectToShaftPercent(switchDistance(DEFAULT_MODEL, 50), extent);
    const marker = doc.querySelector('[data-testid="principle-visual"] [data-testid="principle-switch-marker"]');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute("style")).toContain(`bottom: ${expected}%`);
  });
});

describe("principle.astro — asymmetric rules explained", () => {
  function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  function asymmetricSection(): HTMLElement {
    const heading = doc.getElementById("asymmetric-heading");
    expect(heading, "expected an asymmetric-heading element").not.toBeNull();
    const section = heading?.closest("section");
    expect(section, "expected asymmetric-heading to sit inside a section").not.toBeNull();
    return section as HTMLElement;
  }

  it("positions the new heading after halfway-heading and before formal-model", () => {
    const halfway = doc.getElementById("halfway-heading");
    const heading = doc.getElementById("asymmetric-heading");
    const formal = doc.querySelector('[data-testid="formal-model"]');
    expect(halfway).not.toBeNull();
    expect(heading).not.toBeNull();
    expect(formal).not.toBeNull();

    const DOCUMENT_POSITION_FOLLOWING = doc.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING;
    expect(Boolean(halfway!.compareDocumentPosition(heading!) & DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(heading!.compareDocumentPosition(formal!) & DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("has the approved heading text", () => {
    expect(doc.getElementById("asymmetric-heading")?.textContent?.trim()).toBe(
      "WHAT IF THE RULES AREN'T BALANCED?",
    );
  });

  it("defines both a and b in plain language", () => {
    const text = (asymmetricSection().textContent ?? "").toLowerCase();
    expect(text).toContain("how quickly the elevator can speed up");
    expect(text).toContain("how quickly it can slow down");
  });

  it("states all three consequences: weaker/earlier, balanced/halfway, stronger/later", () => {
    const text = (asymmetricSection().textContent ?? "").toLowerCase();
    expect(text).toContain("earlier");
    expect(text).toContain("halfway");
    expect(text).toContain("later");
  });

  it("contains both formulas in accessible text", () => {
    const text = normalizeWhitespace(asymmetricSection().textContent ?? "");
    expect(text).toContain("s* = Hb/(a+b)");
    expect(text).toContain("p* = 100b/(a+b)");
  });

  it("states that H does not change the optimal percentage", () => {
    const text = (asymmetricSection().textContent ?? "").toLowerCase();
    expect(text).toContain("does not change the optimal percentage");
  });

  it("explicitly connects this to Play's CHANGE THE RULES / Advanced recalculation", () => {
    expect(asymmetricSection().textContent ?? "").toContain(
      "recalculated when you change the rules in Play",
    );
  });

  it("renders exactly three mini-shafts, sharing one H, with switch markers matching their own sample model", () => {
    const shafts = [...asymmetricSection().querySelectorAll('[data-testid="mini-shaft"]')];
    expect(shafts).toHaveLength(3);

    const models = shafts.map((shaft) => {
      const modelJson = shaft.getAttribute("data-sample-model");
      expect(modelJson, "expected data-sample-model on each mini-shaft").not.toBeNull();
      return JSON.parse(modelJson!) as AdvancedModel;
    });

    expect(new Set(models.map((m) => m.H)).size).toBe(1);
    expect(models.some((m) => m.a < m.b)).toBe(true);
    expect(models.some((m) => m.a === m.b)).toBe(true);
    expect(models.some((m) => m.a > m.b)).toBe(true);

    shafts.forEach((shaft, index) => {
      const model = models[index];
      const expected = projectToShaftPercent(optimalSwitchDistance(model), shaftDomain(model));
      const marker = shaft.querySelector('[data-testid="mini-shaft-switch-marker"]');
      expect(marker?.getAttribute("style")).toContain(`bottom: ${expected}%`);
    });
  });
});

describe("principle.astro — optional formal disclosure", () => {
  it("renders a details element, closed by default, containing a summary", () => {
    const details = doc.querySelector('[data-testid="formal-model"]');
    expect(details).not.toBeNull();
    expect(details?.tagName).toBe("DETAILS");
    expect(details?.hasAttribute("open")).toBe(false);
    expect(details?.querySelector("summary")).not.toBeNull();
  });

  it("confines every restricted term to inside the formal disclosure", () => {
    const details = doc.querySelector('[data-testid="formal-model"]');
    expect(details).not.toBeNull();

    const bodyClone = doc.body.cloneNode(true) as HTMLElement;
    bodyClone.querySelector('[data-testid="formal-model"]')?.remove();
    const outsideText = (bodyClone.textContent ?? "").toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
      expect(outsideText, `expected "${term}" not to appear outside the formal disclosure`).not.toContain(term);
    }

    const insideText = (details?.textContent ?? "").toLowerCase();
    expect(insideText).toContain("bang-bang");
    expect(insideText).toContain("double integrator");
    expect(insideText).toContain("pontryagin");
    expect(insideText).toContain("phase plane");
  });
});

describe("principle.astro — references", () => {
  it("links only the already-verified sources", () => {
    const links = [...doc.querySelectorAll('[data-testid="principle-references"] a')].map((a) =>
      a.getAttribute("href"),
    );
    expect(links).toHaveLength(3);
    expect(links).toContain("http://underactuated.mit.edu/dp.html");
    expect(links).toContain("https://arxiv.org/abs/2602.07851");
    expect(links).toContain("https://arxiv.org/abs/1909.03192");
  });
});
