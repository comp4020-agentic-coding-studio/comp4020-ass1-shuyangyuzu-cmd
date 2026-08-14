import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  buildAttemptResult,
  crossingTime,
  DEFAULT_MODEL,
  positionAt,
  stopTime,
  switchDistance,
  switchTime,
} from "../src/model/elevator";
import { projectToShaftPercent, shaftDomain, visualDuration } from "../src/scripts/elevator-animation";
import { initElevatorUI } from "../src/scripts/elevator-dom";
import { resultView } from "../src/scripts/elevator-view";
import PlayPage from "../src/pages/play.astro";

// Test-first slice: src/scripts/elevator-animation.ts does not exist yet,
// and elevator-dom.ts does not yet build a shaft, target/braking markers, a
// Running subtree, or a car. This file is red at module resolution and/or
// assertion time. See INTERACTION.md "Second UI slice — Running phase,
// animation, and shaft visual (approved)" and its "Running-phase and
// animation tests (this slice)" list for the acceptance criteria exercised
// below.
//
// Per that same approved slice: the car's live position is checked only at
// t=0, switchTime, and an interior instant strictly between crossingTime and
// stopTime — never at stopTime itself, which is a boundary event and is
// exercised only through completeRun's analytic transition to Result, not
// by sampling a live Running car. No pixel measurement or synthetic resize
// event is used anywhere in this file; the shaft visual is projected and
// asserted purely as CSS percentages.

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

function allowMotion(jsdom: JSDOM): void {
  stubMatchMedia(jsdom, false);
}

function preferReducedMotion(jsdom: JSDOM): void {
  stubMatchMedia(jsdom, true);
}

type FakeRaf = {
  readonly pendingCount: number;
  readonly lastScheduledCallback: ((timestamp: number) => void) | null;
  advance(ms: number): void;
};

// A controllable fake requestAnimationFrame/cancelAnimationFrame clock,
// installed on jsdom.window so elevator-dom's animation loop (which must
// read window from root.ownerDocument.defaultView, never an ambient
// global) is driven deterministically instead of by real timers. Each
// advance(ms) call represents one animation frame: it advances the fake
// wall clock by ms, then runs exactly the callbacks that were pending
// before this call (not any newly (re)scheduled during it), passing the
// new cumulative clock value as the frame timestamp — mirroring standard
// requestAnimationFrame(timestamp) semantics.
//
// The fake clock deliberately starts at a non-zero document timestamp
// (initialNow, default 10_000ms): real requestAnimationFrame timestamps are
// document-timeline-relative, not session-relative, so a clock that begins
// at 0 would make "time since navigation start" and "time since this Run
// began" coincide by accident. Starting non-zero forces every animated test
// to actually exercise the production session-origin subtraction rather
// than being satisfied by a coincidence of the fake clock's own origin.
//
// lastScheduledCallback retains a reference to the most recently scheduled
// callback independently of the cancellable queue above: capturing it into
// a local const and invoking that const directly later proves the
// production session-token/cancelled-flag guard itself keeps a stale
// callback inert, rather than merely proving the fake queue no longer holds
// an entry for it.
function installFakeRaf(jsdom: JSDOM, initialNow = 10_000): FakeRaf {
  let nextId = 1;
  let queue: Array<{ id: number; callback: (timestamp: number) => void }> = [];
  let now = initialNow;
  let lastScheduledCallback: ((timestamp: number) => void) | null = null;

  jsdom.window.requestAnimationFrame = ((callback: (timestamp: number) => void) => {
    const id = nextId++;
    queue.push({ id, callback });
    lastScheduledCallback = callback;
    return id;
  }) as typeof jsdom.window.requestAnimationFrame;

  jsdom.window.cancelAnimationFrame = ((id: number) => {
    queue = queue.filter((entry) => entry.id !== id);
  }) as typeof jsdom.window.cancelAnimationFrame;

  return {
    get pendingCount() {
      return queue.length;
    },
    get lastScheduledCallback() {
      return lastScheduledCallback;
    },
    advance(ms: number) {
      now += ms;
      const due = queue;
      queue = [];
      for (const entry of due) entry.callback(now);
    },
  };
}

// Advances by 1ms per retry, not 0ms: completion is decided by comparing a
// session-relative wallElapsedMs (timestamp - sessionStartTimestamp) against
// visualDurationMs, and that subtraction's floating-point result can, at a
// large document-timeline origin, land a sub-nanosecond fraction under the
// threshold on the frame that was "supposed" to complete it. advance(0)
// would repeat that identical computation forever; advance(1) actually
// moves the clock forward each retry so the comparison converges, mirroring
// how a real next frame always carries a strictly later timestamp.
function drainUntilResult(root: HTMLElement, raf: FakeRaf, maxExtraFrames = 10): void {
  let guard = 0;
  while (root.querySelector('[data-testid="result"]') === null && guard < maxExtraFrames) {
    raf.advance(1);
    guard++;
  }
}

describe("Predicting shaft visual", () => {
  it("renders a shaft with the target marker fixed at 50% and the car visibly at 0 m, independent of p", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    initElevatorUI(root);

    const shaft = required<HTMLElement>(root, '[data-testid="shaft"]');
    const domain = shaftDomain(DEFAULT_MODEL);
    const targetMarker = required<HTMLElement>(shaft, '[data-testid="target-marker"]');
    expect(targetMarker.style.bottom).toBe(`${projectToShaftPercent(DEFAULT_MODEL.H, domain)}%`);

    const car = required<HTMLElement>(shaft, '[data-testid="car"]');
    expect(car.style.bottom).toBe(`${projectToShaftPercent(0, domain)}%`);
  });

  it("projects the braking marker to switchDistance(model, p) as a CSS bottom percentage at the initial p", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    initElevatorUI(root);

    const p = 35; // initialUIState.p
    const brakingMarker = required<HTMLElement>(root, '[data-testid="braking-marker"]');
    const expectedPercent = projectToShaftPercent(switchDistance(DEFAULT_MODEL, p), shaftDomain(DEFAULT_MODEL));
    expect(brakingMarker.style.bottom).toBe(`${expectedPercent}%`);
  });

  it("moves the braking marker on the slider's input event without a Run", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    initElevatorUI(root);

    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, 80);

    const brakingMarker = required<HTMLElement>(root, '[data-testid="braking-marker"]');
    const expectedPercent = projectToShaftPercent(switchDistance(DEFAULT_MODEL, 80), shaftDomain(DEFAULT_MODEL));
    expect(brakingMarker.style.bottom).toBe(`${expectedPercent}%`);

    expect(root.querySelector('[data-testid="running"]')).toBeNull();
  });
});

describe("Running — entering the phase", () => {
  it("detaches Predicting, removes the percentage input/Run/Retry controls, and keeps the permanent navigation", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    installFakeRaf(jsdom);
    initElevatorUI(root);

    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();

    expect(root.querySelector('[data-testid="predicting"]')).toBeNull();
    expect(root.querySelector('[data-testid="percentage-input"]')).toBeNull();
    expect(root.querySelector('[data-testid="run-button"]')).toBeNull();
    expect(root.querySelector('[data-testid="retry-button"]')).toBeNull();

    const running = required<HTMLElement>(root, '[data-testid="running"]');
    expect(root.contains(running)).toBe(true);

    const nav = required<HTMLElement>(jsdom.window.document, 'nav[aria-label="Primary"]');
    expect(jsdom.window.document.contains(nav)).toBe(true);
  });
});

describe("Running car projection at analytic sampled instants", () => {
  it("projects the car's CSS bottom percentage to match positionAt at t=0, switchTime, and an interior overshoot instant", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    const raf = installFakeRaf(jsdom);
    initElevatorUI(root);

    const p = 80; // overshoot
    const model = DEFAULT_MODEL;
    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();

    const domain = shaftDomain(model);
    const tStop = stopTime(model, p);
    const tSwitch = switchTime(model, p);
    const tCross = crossingTime(model, p) as number;
    const tInterior = (tCross + tStop) / 2;
    const visualDurationMs = visualDuration(tStop) * 1000;

    function carPercent(): string {
      return required<HTMLElement>(root, '[data-testid="car"]').style.bottom;
    }

    // A non-zero fake-clock origin makes wallElapsedMs a genuine subtraction
    // (timestamp - sessionStartTimestamp) rather than reading the raw delta
    // straight off, so the resulting percentage can differ from the expected
    // value by float noise on the order of 1e-13 — exactly the kind of
    // fixed-timestep/float artefact the boundary-testing rule in CLAUDE.md
    // warns against treating as a real discrepancy. Compare numerically with a
    // tight tolerance instead of exact string equality; a real browser would
    // show the same noise.
    function expectCarPercentCloseTo(expectedPercent: number): void {
      expect(Number.parseFloat(carPercent())).toBeCloseTo(expectedPercent, 9);
    }

    raf.advance(0);
    expectCarPercentCloseTo(projectToShaftPercent(0, domain));

    raf.advance((tSwitch / tStop) * visualDurationMs);
    expectCarPercentCloseTo(projectToShaftPercent(switchDistance(model, p), domain));

    raf.advance(((tInterior - tSwitch) / tStop) * visualDurationMs);
    expectCarPercentCloseTo(projectToShaftPercent(positionAt(model, p, tInterior), domain));

    expect(root.querySelector('[data-testid="running"]')).not.toBeNull();
  });
});

describe("Session-relative wall-clock origin on a document timeline already past visualDurationMs", () => {
  it("renders analytic t=0 on the first frame instead of jumping to Result, when the document clock starts well beyond visualDurationMs", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    // The document timeline is already at 60_000ms — far beyond any
    // visualDurationMs — before this Run's own first frame ever fires,
    // standing in for a page that has simply been open a while. Production
    // must treat this Run's own elapsed time as starting from that first
    // callback's own timestamp, not from the document's navigation start.
    const raf = installFakeRaf(jsdom, 60_000);
    initElevatorUI(root);

    const p = 80;
    const model = DEFAULT_MODEL;
    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();

    const domain = shaftDomain(model);
    const tStop = stopTime(model, p);
    const visualDurationMs = visualDuration(tStop) * 1000;

    raf.advance(0);

    expect(root.querySelector('[data-testid="running"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="result"]')).toBeNull();

    const car = required<HTMLElement>(root, '[data-testid="car"]');
    expect(car.style.bottom).toBe(`${projectToShaftPercent(0, domain)}%`);
    const positionText = required<HTMLElement>(root, '[data-testid="running-position"]').textContent ?? "";
    const velocityText = required<HTMLElement>(root, '[data-testid="running-velocity"]').textContent ?? "";
    expect(Number.parseFloat(positionText)).toBe(0);
    expect(Number.parseFloat(velocityText)).toBe(0);

    raf.advance(visualDurationMs);
    drainUntilResult(root, raf);

    expect(root.querySelector('[data-testid="running"]')).toBeNull();
    expect(root.querySelector('[data-testid="result"]')).not.toBeNull();
  });
});

describe("Running position/velocity readouts", () => {
  it("shows position beyond H and positive velocity for an overshoot p at an interior instant between crossingTime and stopTime", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    const raf = installFakeRaf(jsdom);
    initElevatorUI(root);

    const p = 80;
    const model = DEFAULT_MODEL;
    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();

    const tStop = stopTime(model, p);
    const tCross = crossingTime(model, p) as number;
    const tInterior = (tCross + tStop) / 2;
    const visualDurationMs = visualDuration(tStop) * 1000;

    raf.advance(0); // establishes the analytic t=0 render frame
    raf.advance((tInterior / tStop) * visualDurationMs);

    const positionText = required<HTMLElement>(root, '[data-testid="running-position"]').textContent ?? "";
    const velocityText = required<HTMLElement>(root, '[data-testid="running-velocity"]').textContent ?? "";
    expect(Number.parseFloat(positionText)).toBeGreaterThan(model.H);
    expect(Number.parseFloat(velocityText)).toBeGreaterThan(0);
  });
});

describe("Accelerating/braking cue", () => {
  // Exact equality of the cue at switchTime(model,p) itself is proved
  // against the pure runningReadout function in spec/elevator-view.test.ts,
  // not here: reaching an analytic instant through this fake clock requires
  // a wall-elapsed-time subtraction that carries floating-point noise, which
  // makes exact-boundary claims unreliable at this layer (see CLAUDE.md's
  // rule on fixed-timestep artefacts at boundaries). This test instead
  // verifies the DOM wiring — that the rendered element actually consumes
  // both view states — at two unambiguous analytic interior times, one
  // strictly before switchTime and one strictly after it.
  it("wires the accelerating cue before the switch and braking cue after it", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    const raf = installFakeRaf(jsdom);
    initElevatorUI(root);

    const p = 80;
    const model = DEFAULT_MODEL;
    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();

    const tStop = stopTime(model, p);
    const tSwitch = switchTime(model, p);
    const visualDurationMs = visualDuration(tStop) * 1000;

    function cue(): string | undefined {
      return required<HTMLElement>(root, '[data-testid="running-cue"]').dataset.cue;
    }

    const tAccelerating = tSwitch / 2;
    const tBraking = (tSwitch + tStop) / 2;

    raf.advance(0); // establishes the analytic t=0 render frame
    raf.advance((tAccelerating / tStop) * visualDurationMs);
    expect(cue()).toBe("accelerating");

    raf.advance(((tBraking - tAccelerating) / tStop) * visualDurationMs);
    expect(cue()).toBe("braking");
  });
});

describe("Completion reaches Result matching resultView", () => {
  it.each([
    ["short", 30],
    ["correct", 50],
    ["overshoot", 80],
  ] as const)("completes to Result for %s p=%i", async (_label, p) => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    const raf = installFakeRaf(jsdom);
    initElevatorUI(root);

    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();

    const tStop = stopTime(DEFAULT_MODEL, p);
    const visualDurationMs = visualDuration(tStop) * 1000;
    raf.advance(0); // establishes the analytic t=0 render frame
    raf.advance(visualDurationMs);
    drainUntilResult(root, raf);

    const result = required<HTMLElement>(root, '[data-testid="result"]');
    const expected = resultView(buildAttemptResult(DEFAULT_MODEL, p));
    expect(result.querySelector('[data-testid="result-heading"]')?.textContent?.trim()).toBe(expected.heading);
    expect(root.querySelector('[data-testid="running"]')).toBeNull();
  });
});

describe("Reduced motion", () => {
  it("reaches Result synchronously with zero requestAnimationFrame calls", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    preferReducedMotion(jsdom);
    const raf = installFakeRaf(jsdom);
    initElevatorUI(root);

    const p = 65;
    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();

    expect(root.querySelector('[data-testid="running"]')).toBeNull();
    expect(raf.pendingCount).toBe(0);

    const result = required<HTMLElement>(root, '[data-testid="result"]');
    const expected = resultView(buildAttemptResult(DEFAULT_MODEL, p));
    expect(result.querySelector('[data-testid="result-heading"]')?.textContent?.trim()).toBe(expected.heading);
  });

  it("produces a Result identical to the animated path for the same p", async () => {
    const p = 65;

    const animatedJsdom = await renderPlayPage();
    const animatedRoot = required<HTMLElement>(animatedJsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(animatedJsdom);
    const raf = installFakeRaf(animatedJsdom);
    initElevatorUI(animatedRoot);
    const animatedInput = required<HTMLInputElement>(animatedRoot, '[data-testid="percentage-input"]');
    setPercentage(animatedJsdom, animatedInput, p);
    required<HTMLButtonElement>(animatedRoot, '[data-testid="run-button"]').click();
    const tStop = stopTime(DEFAULT_MODEL, p);
    raf.advance(0); // establishes the analytic t=0 render frame
    raf.advance(visualDuration(tStop) * 1000);
    drainUntilResult(animatedRoot, raf);
    const animatedResult = required<HTMLElement>(animatedRoot, '[data-testid="result"]');

    const reducedJsdom = await renderPlayPage();
    const reducedRoot = required<HTMLElement>(reducedJsdom.window.document, '[data-testid="elevator-app"]');
    preferReducedMotion(reducedJsdom);
    installFakeRaf(reducedJsdom);
    initElevatorUI(reducedRoot);
    const reducedInput = required<HTMLInputElement>(reducedRoot, '[data-testid="percentage-input"]');
    setPercentage(reducedJsdom, reducedInput, p);
    required<HTMLButtonElement>(reducedRoot, '[data-testid="run-button"]').click();
    const reducedResult = required<HTMLElement>(reducedRoot, '[data-testid="result"]');

    expect(reducedResult.querySelector('[data-testid="result-heading"]')?.textContent?.trim()).toBe(
      animatedResult.querySelector('[data-testid="result-heading"]')?.textContent?.trim(),
    );
    expect(reducedResult.querySelector('[data-testid="result-explanation"]')?.textContent?.trim()).toBe(
      animatedResult.querySelector('[data-testid="result-explanation"]')?.textContent?.trim(),
    );

    const expected = resultView(buildAttemptResult(DEFAULT_MODEL, p));
    for (const field of expected.fields) {
      expect(reducedResult.querySelector(`[data-field="${field.key}"]`)?.textContent?.trim()).toBe(
        animatedResult.querySelector(`[data-field="${field.key}"]`)?.textContent?.trim(),
      );
    }
  });
});

describe("Result heading celebration class", () => {
  async function reachResult(p: number): Promise<HTMLElement> {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    preferReducedMotion(jsdom);
    installFakeRaf(jsdom);
    initElevatorUI(root);
    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();
    return root;
  }

  it.each([
    ["short", 35, false],
    ["correct", 50, true],
    ["overshoot", 65, false],
  ] as const)("applies the celebration class to the heading only for %s", async (_label, p, expectCelebrate) => {
    const root = await reachResult(p);
    const heading = required<HTMLElement>(root, '[data-testid="result-heading"]');
    expect(heading.classList.contains("result-heading-celebrate")).toBe(expectCelebrate);
    expect(heading.classList.contains("punchline")).toBe(true);
  });
});

describe("Stale queued animation callback after Result", () => {
  it("cannot mutate or duplicate Result when invoked directly after Result has already been reached", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    const raf = installFakeRaf(jsdom);
    initElevatorUI(root);

    const p = 50;
    const input = required<HTMLInputElement>(root, '[data-testid="percentage-input"]');
    setPercentage(jsdom, input, p);
    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();

    // Capture a callback that belongs to this Running session before
    // driving the legitimate animation onward. Later frames reassign
    // raf.lastScheduledCallback, but this const keeps the earlier closure
    // reachable — standing in for a frame requested during Running that
    // does not actually fire until after Result.
    const staleCallback = raf.lastScheduledCallback;
    expect(staleCallback).not.toBeNull();

    const tStop = stopTime(DEFAULT_MODEL, p);
    raf.advance(0); // establishes the analytic t=0 render frame
    raf.advance(visualDuration(tStop) * 1000);
    drainUntilResult(root, raf);

    const resultBefore = required<HTMLElement>(root, '[data-testid="result"]');
    const headingBefore = resultBefore.querySelector('[data-testid="result-heading"]')?.textContent;

    // Invoke the stale callback directly, bypassing the fake queue's
    // cancellation bookkeeping entirely. This is the actual claim under
    // test: the production session-token/cancelled-flag guard — not the
    // mere absence of a queued entry — is what keeps it inert.
    expect(() => staleCallback!(999_999)).not.toThrow();

    expect(root.querySelectorAll('[data-testid="result"]')).toHaveLength(1);
    const resultAfter = required<HTMLElement>(root, '[data-testid="result"]');
    expect(resultAfter).toBe(resultBefore);
    expect(resultAfter.querySelector('[data-testid="result-heading"]')?.textContent).toBe(headingBefore);
    expect(root.querySelector('[data-testid="running"]')).toBeNull();
  });
});

describe("Forbidden vocabulary", () => {
  it("is absent from the Running subtree introduced by this slice", async () => {
    const jsdom = await renderPlayPage();
    const root = required<HTMLElement>(jsdom.window.document, '[data-testid="elevator-app"]');
    allowMotion(jsdom);
    installFakeRaf(jsdom);
    initElevatorUI(root);

    required<HTMLButtonElement>(root, '[data-testid="run-button"]').click();
    const running = required<HTMLElement>(root, '[data-testid="running"]');
    const text = (running.textContent ?? "").toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      expect(text).not.toContain(term);
    }
  });
});
