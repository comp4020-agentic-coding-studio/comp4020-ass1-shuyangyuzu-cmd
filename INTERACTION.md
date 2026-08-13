# Interaction contract — minimum-time elevator

## Point of view

A target in a dynamic system is a state, not merely a place: reaching a
position without the required velocity is not arrival.

## Core interaction (one sentence)

The visitor commits to a switching position — expressed as a percentage of
target height H — before the elevator moves, then watches whether it stops
short, stops exactly at the target, or overshoots, revising across attempts
to find where acceleration must switch to braking so the elevator reaches
the target position with zero velocity.

## Audience and progressive disclosure

`[Approved design decision]`

The primary visitor has no control-theory background and does not need one:
the interface must be understandable without knowing optimisation,
differential equations, phase planes, Pontryagin's principle, or the term
"bang-bang control." Progressive disclosure sequence:

1. Begin with the plain task: get the elevator to the target as quickly as
   possible and stop there.
2. Ask the visitor to choose where braking begins.
3. Let the visible consequence teach early/exact/late.
4. Explain in plain language, by default, that arrival requires both the
   right position and zero velocity.
5. Reveal the formal model or terminology only after the interaction, if
   included at all — and only if the visitor opts in.

Unit symbols (`m`, `s`, `m/s`, per "Displayed quantities and units") are not
specialist vocabulary and are not restricted by this section — they help
distinguish position from velocity, which this explainer's point of view
depends on.

Plain language versus formal disclosure:

- A plain-language interpretation of the outcome — why this attempt stopped
  short, arrived correctly, or overshot — is visible by default at Result,
  and must be enough on its own for the visitor to revise the next attempt.
- Equations, theorem/algorithm names, and specialist control-theory
  terminology may appear only inside an optional formal-model disclosure,
  reachable only after at least one Result has been reached, collapsed/closed
  by default.
- The visitor must never need to open that disclosure to understand an
  early, exact, or late result.

Default-visible vocabulary boundary (case-insensitive):

- Forbidden in default-visible UI: "bang-bang", "Pontryagin", "optimal
  control", "phase plane", "double integrator", "state-space", "switching
  function", "u(t)".
- Allowed: "position", "speed", "velocity", "acceleration", "braking",
  "target", "too early", "too late", "stopped". "Velocity" is permitted
  because this explainer's point of view depends on distinguishing it from
  position (see "Point of view"), but default-visible copy must explain what
  it means in ordinary language rather than assume the visitor already knows.

## Verified model and formulas

Fixed model (symbolic; see "Model constants and units" below for the
resolved values):

```
ẋ = v
v̇ = u,  |u| ≤ a
x(0) = 0, v(0) = 0
x(T) = H, v(T) = 0
H > 0, a > 0
minimise T
```

The time-optimal control switches from `u=+a` to `u=−a` exactly once, and the
order must be `+a` then `−a` (forced by `H>0` together with the terminal
velocity condition `∫₀ᵀ u dt = v(T)−v(0) = 0`, which rules out a constant-sign
control). See "Authoritative sources" for the literature this is checked
against, and the derivation summary below for what is derived rather than
sourced.

The visitor's single control is an integer percentage `p ∈ {1, …, 100}`,
converted to a switching position only for calculation:

```
s(p) = (p/100)·H
x_stop(p) = 2·s(p) = (p/50)·H

p < 50   → elevator stops at x = (p/50)·H < H, v = 0                (short)
p = 50   → elevator stops at x = H exactly, v = 0 exactly            (correct)
p > 50   → elevator crosses x=H at v(H) = √(2a·H·(p−50)/50) > 0,
           then continues to stop at x = (p/50)·H > H, v = 0         (overshoot)
```

Classification is exact at the interaction level because `s(50)=H/2` exactly
— no tolerance/epsilon is needed for the visitor-facing verdict. Standard
floating-point closeness may still be used inside formula *tests* where the
underlying math is irrational (e.g. square roots); that is test precision,
not a change to the visitor's outcome.

Switch time, physical stopping time, and the H-crossing event, derived from
the same two-phase kinematics (`s = s(p)`, `v1 = v1(p)` is the speed at the
switch):

```
t1(p) = √(2s/a)                             switch time (= T(p)/2, for any p)
v1(p) = √(2a·s) = a·t1(p)                   speed at the switch
T(p)  = 2·t1(p) = 2√(2s/a)                  physical stopping time (v=0 at x_stop)
```

H-crossing is a distinct event only for `p>50`, where the elevator passes
through `x=H` with `v>0` before its final stop. At `p=50` the arrival at H
*is* the stop — no separate crossing event exists. For `p<50`, `x` never
reaches `H` at all (`x_stop(p)<H`), so no crossing time is defined either.

```
v(H,p)      = √(2a(2s−H))                       real-valued only for p≥50
t_Hcross(p) = t1(p) + (v1(p) − v(H,p)) / a       defined only for p>50
```

## Model constants and units

Resolved (supersedes the earlier "unresolved decision"):

- `H = 10 m`, `a = 1.5 m/s²`. Internal model values use SI units throughout.
- The UI displays explicit SI unit labels: `m`, `s`, and `m/s`.
- This remains an idealised point-mass model; the disclaimer in "Scope
  exclusions" stays visible in the UI, not only in this document.

Verified reference values (checked against the formulas above):

- optimal switching position: `s* = H/2 = 5 m`
- optimal switching speed: `v* = √(aH) = √15 ≈ 3.872983 m/s`
- minimum valid time: `T* = 2√(H/a) = 2√(20/3) ≈ 5.163978 s`
- `p=100` velocity at H: `v(H,100) = √(2aH) = √30 ≈ 5.477226 m/s`
- `p=100` final position: `x_stop(100) = 2H = 20 m`
- `p=100` physical stopping time: `T(100) = 2√(2H/a) = 2√(40/3) ≈ 7.302967 s`

## Model API input contract

`[Approved design decision]`

Every exported computational function — including `classify(p)` — validates
its inputs before computing anything, and throws `RangeError` on the first
invalid argument. No input is silently clamped, normalised, coerced, or
allowed to produce `NaN`; no function partially evaluates and returns a
result once an input is found invalid.

- `H`: must be finite and `> 0`.
- `a`: must be finite and `> 0`.
- `p`: must be finite, integer-valued, and within `1…100` inclusive.
- `NaN`, `+Infinity`, and `-Infinity` are invalid wherever they could appear
  — for `H`, for `a`, and for `p`.

## Trajectory API and completed-attempt result

`[Approved design decision]`

Two additional pure functions expose the analytic trajectory at an arbitrary
physical time, and one function assembles the full outcome of a completed
attempt, for later consumption by animation, reduced-motion, and Result UI —
without any of those callers re-deriving the physics.

### Trajectory time input contract

- `positionAt(model, p, t)` and `velocityAt(model, p, t)` accept a physical
  time `t` and return the analytic position (m) and velocity (m/s) at that
  instant.
- `t` must be finite and satisfy `0 ≤ t ≤ stopTime(model, p)`. Any other `t`
  (negative, past `stopTime`, `NaN`, `±Infinity`) throws `RangeError` — the
  analytic model never clamps time, matching this document's no-silent-
  clamping rule (see "Model API input contract").
- A future rendering caller (animation frame loop, reduced-motion path) may
  clamp its own sampled playback time before calling the model — for example
  to absorb `requestAnimationFrame` overshoot past the computed stop instant
  — but that clamping happens in the caller, never inside the model, and must
  not alter which classification or semantic state the attempt resolves to.

### Validation order

- `positionAt` and `velocityAt` validate, in order: `model`, then `p`, then
  `t`. `t`'s own validity depends on `p` (via `stopTime(model,p)`), so it is
  necessarily checked last.
- `buildAttemptResult` validates `model`, then `p`, before composing any part
  of the result — it does not rely on incidental validation inside whichever
  composed function happens to be called first.
- Every invalid argument throws `RangeError`, consistent with every other
  exported function.

### Exact boundary-event policy

`t=0`, `t=switchTime(model,p)`, and `t=stopTime(model,p)` are exact analytic
events, not points sampled from a general phase formula:

- `t=0` → position `0`, velocity `0`, exactly, for every `p`.
- `t=switchTime(model,p)` → position `switchDistance(model,p)`, velocity
  `switchSpeed(model,p)`, exactly.
- `t=stopTime(model,p)` → position `stopPosition(model,p)`, velocity exactly
  `0`, for every `p` (not only `p=50`) — matching "Displayed quantities and
  units"'s "final velocity is always exactly `0`, by construction, for every
  `p`".

`positionAt`/`velocityAt` return these known states directly at the three
boundary instants, rather than relying on the general acceleration- or
braking-phase formula to approximate them — no epsilon changes which event a
given `t` identifies, per this repo's `CLAUDE.md` rule against classifying
boundary events from floating-point/render-timing artefacts.

### Completed-attempt result shape

`buildAttemptResult(model, p)` returns a `readonly` discriminated union keyed
by `classification`, composed entirely from the already-defined functions
(`classify`, `switchDistance`, `switchSpeed`, `switchTime`, `stopPosition`,
`stopTime`, `speedAtTarget`, `crossingTime`) — it introduces no new physics.

```ts
export type SwitchState = {
  readonly position: number
  readonly velocity: number
  readonly time: number
}

export type FinalState = {
  readonly position: number
  readonly velocity: 0
  readonly time: number
}

export type AttemptResult =
  | {
      readonly classification: "short"
      readonly p: number
      readonly switchState: SwitchState
      readonly finalState: FinalState
      readonly shortfall: number
    }
  | {
      readonly classification: "correct"
      readonly p: 50
      readonly switchState: SwitchState
      readonly finalState: FinalState
      readonly minimumTime: number
    }
  | {
      readonly classification: "overshoot"
      readonly p: number
      readonly switchState: SwitchState
      readonly finalState: FinalState
      readonly velocityAtTarget: number
      readonly targetCrossingTime: number
    }
```

- Field name is `velocity` throughout `SwitchState`/`FinalState` — not
  `speed` — for consistency with "Point of view"'s distinction between
  position and velocity as the two state quantities that matter.
- Category-specific fields (`shortfall`; `minimumTime`; `velocityAtTarget`
  and `targetCrossingTime`) appear only on their own variant, never on the
  others — a `short` result has no `minimumTime`, an `overshoot` result has
  no `shortfall`, and so on.
- `correct`'s `p` is fixed to the literal `50`, reflecting `classify`'s own
  contract that only `p=50` ever classifies as `correct`.

## Scope exclusions

Point mass only. No modeling of mass, motor torque-speed curve, gravity,
cable dynamics, jerk/comfort limits, asymmetric drive/brake authority,
actuator lag, or sensor noise. The symmetric acceleration bound is a design
choice for this explainer, not a claim about how a real passenger elevator
is controlled. `H` and `a` are fixed for the whole experience — not
visitor-adjustable. No live/reflex braking — the visitor always predicts
before the run, never reacts during it.

## State machine and visible outcomes

```
Predicting → Running → Result → (Retry → Predicting) | (Reset → Predicting, history cleared)
```

- **Predicting**: visitor sets `p` (pointer, keyboard, or touch); no
  simulation active.
- **Running**: entered by locking the selected `p` and computing the full
  trajectory and event times up front; the animation renders that
  already-solved trajectory and does not determine or alter the physics.
- **Result**: entered only when the elevator has actually come to rest —
  for `p>50` this is *after* the intermediate H-crossing event, not at it.
- **Retry** / **Reset**: as above.

Visible outcomes (what changes on screen; see "Displayed quantities and
units" for the numbers shown):
- Early (`p<50`): elevator visibly settles below the target marker.
- Exact (`p=50`): elevator visibly settles exactly at the target marker.
- Late (`p>50`): elevator visibly continues past the target marker after
  the at-target instant, coming to rest higher up.

## Input, history, and responsive behaviour

- Pointer and touch snap to integer percentage steps; keyboard arrows move
  by exactly one step. `50` is exactly selectable by all three input modes
  and is never labelled as special before a successful run.
- History retains only the 3 most recent attempts — see "Displayed
  quantities and units" for exactly which fields per category. No score,
  streak, or ranking.
- Must work at both marking viewports — "desktop and phone" per the
  published brief. This repository's `CLAUDE.md` specifies these as
  1920×1080 and 390×844 respectively; that pixel-level detail comes from
  this repo's harness document, not from the assignment-1 brief page
  itself, which names the viewports without pixel values.
- A resize while Running preserves the locked `p` and current semantic
  state; it does not restart or reinterpret the run.
- Under `prefers-reduced-motion`, Running skips animated playback and
  reaches Result immediately with the same classification and history
  entry as the animated path — the outcome is computed analytically before
  any frame is drawn, so disabling animation changes presentation only.

## Displayed quantities and units

All displayed numeric values are physical model quantities with explicit SI
unit labels (`m`, `s`, `m/s`) — never playback/animation time, and never a
bare unlabelled number. The idealised point-mass disclaimer (see "Scope
exclusions") stays visible in the UI alongside these numbers.

- **Predicting**: the selected switching percentage only (no unit — it is
  not yet a physical quantity).
- **Running**: current analytic position (m) and velocity (m/s), sampled
  from the trajectory already computed for the locked `p` — never derived
  from or altered by the animation frame rate.
- **Result, every attempt**: selected percentage; classification; final
  position and final velocity shown together as the final state (m, m/s) —
  final velocity is always exactly `0`, by construction, for every `p`; and
  physical elapsed time (s), i.e. `T(p)`, never the scaled playback duration.
- **Early (`p<50`) additionally**: distance short of H, `H − x_stop(p)` (m)
  — paired with the always-zero final velocity, so the visitor reads
  "arrived at rest, but not at the target place."
- **Late (`p>50`) additionally**: the analytically captured velocity at H,
  `v(H,p)` (m/s) — contrasted with the final state's velocity of `0`, so the
  visitor reads "passed through the target place, but not at rest" — the
  mirror image of the early case.
- **Exact (`p=50`)**: identifies the result as the minimum valid time and
  reveals the switching position as `50%`. This is the one case where the
  target place and the target state coincide.
- **History (max 3 entries, no score)**: percentage, category, and exactly
  one category-relevant piece of state evidence — final position/shortfall
  for early, at-H velocity for late, target state and minimum valid time for
  exact.

## First UI slice — controller and markup contract (approved)

`[Approved design decision]`

Scope: Predicting and Result phases only. Running, animation, history, Reset,
and the formal-model disclosure are not part of this contract — see "Scope
exclusions" and the deferred-item lists elsewhere in this document; this
section does not supersede them.

### Controller state and transitions

Pure, immutable: every transition returns a new state object rather than
mutating its input.

```ts
export type PredictingState = {
  readonly phase: "predicting"
  readonly p: number
  readonly result: null
}

export type ResultState = {
  readonly phase: "result"
  readonly p: number
  readonly result: AttemptResult
}

export type UIState = PredictingState | ResultState

export const initialUIState: PredictingState = {
  phase: "predicting",
  p: 35,
  result: null,
}

export function setPercentage(state: UIState, p: number): PredictingState
export function run(state: UIState): ResultState
export function retry(state: UIState): PredictingState
```

The `PredictingState`/`ResultState` split makes an invalid `{phase, result}`
pairing (e.g. `phase: "predicting"` with a non-null `result`) unrepresentable
at the type level, not just rejected at runtime. Each public function's
*parameter* stays the full `UIState` union, not the narrower state it
requires — narrowing the parameter itself would make the required runtime
phase guard untestable, since a compiling test could never construct the
wrong-phase call the guard exists to reject. The union parameter plus a
runtime `state.phase` check is what makes both guarantees hold at once: the
return type is exact (`PredictingState`/`ResultState`, never the union), and
the wrong-phase call is still expressible and therefore testable.

- `setPercentage(state: UIState, p: number): PredictingState` — checks
  `state.phase` at runtime; valid only when it is `"predicting"`. Once
  confirmed, validates `p` against the existing percentage contract
  (`assertValidPercentage`, "Model API input contract"), which throws
  `RangeError` on an invalid `p`. Called with a `ResultState`, it throws an
  `Error` naming the rejected transition (e.g. `setPercentage is not valid
  in phase "result"`) — never `RangeError`, which stays reserved for
  invalid *values*, checked only after the phase itself is confirmed valid.
  A disabled DOM control is not treated as sufficient enforcement of this
  rule; the controller enforces it independently of whatever the UI happens
  to render.
- `run(state: UIState): ResultState` — checks `state.phase` at runtime;
  valid only when it is `"predicting"`. Snapshots the current `p`, computes
  `buildAttemptResult(DEFAULT_MODEL, p)`, and returns a `ResultState`.
  Called with a `ResultState`, it throws an `Error` naming the rejected
  transition.
- `retry(state: UIState): PredictingState` — checks `state.phase` at
  runtime; valid only when it is `"result"`. Returns a `PredictingState`
  with `p: state.p` — exactly what was last run, never reset to `35` or any
  other fixed default. Called with a `PredictingState`, it throws an
  `Error` naming the rejected transition.
- Phase-transition errors are always `Error`, never `RangeError`:
  `RangeError` is reserved for the percentage-value contract above, and a
  wrong-phase call is a caller programming error, not an out-of-range
  value. Every thrown message identifies which transition was rejected and
  from which phase. None of these invalid calls silently no-ops.

### State-dependent markup

- **Predicting** renders the range control (labelled, `min=1 max=100
  step=1`) and the Run button.
- **Result** renders the completed result (classification label, shared and
  category-specific fields, explanation sentence) and the Try again button.
- These two phases' markup is mutually exclusive — Retry is never rendered
  in Predicting, not even disabled; it does not exist in the DOM until the
  first Result. Likewise, the Run button does not exist once Result's
  markup replaces Predicting's.
- After **Run**, focus moves to the Result section — not left on the Run
  button, which has just been removed from the DOM along with the rest of
  Predicting's markup. No focus destination is ever an element that was
  just removed.
- After **Retry**, focus moves to the range input, which is back in the DOM
  once Predicting's markup replaces Result's.
- Component tests verify these two programmatic focus destinations
  directly (`document.activeElement` after each transition); real
  screen-reader announcement behaviour stays a browser-level/manual check
  (see "Browser-level and manual checks" in Acceptance criteria).

### Result region semantics

- A semantic `<section>` — not a generic `<div>` — carrying
  `tabindex="-1"`, `aria-live="polite"`, and `aria-atomic="true"`.
  `tabindex="-1"` makes the section a valid programmatic focus target (see
  "State-dependent markup" above) without adding it to the regular Tab
  order. `aria-atomic="true"` ensures assistive tech re-reads the whole
  region on a change, so the classification label, the explanation, and
  the fields are announced together as one Result, not as disconnected
  fragments.
- No `role="status"` on this section: it would override the section's own
  role and heading structure rather than add to it, and `aria-live`/
  `aria-atomic` alone are enough to drive the announcement.
- The slider's current-value text stays a plain `<span>` — the native range
  input already exposes its own value to assistive tech on every change, so
  a second live announcement there would be redundant. Only the Result
  section is a live region, and its content changes only on Run, never on a
  slider `input` event — so dragging the slider stays silent.

### Approved novice copy

- Heading: "Bring the elevator to a stop at the target"
- Task: "Choose where the elevator should start braking, then run it. The
  goal isn't just to reach the target — it must be completely stopped when
  it gets there."
- Slider label: "Start braking at this percentage of the distance to the
  target"
- Run button: "Run"
- Retry button: "Try again"
- Classification labels: `short` → "Too early"; `correct` → "Exactly
  right"; `overshoot` → "Too late"
- Explanations:
  - `short`: "Braking started too early. The elevator stopped at rest, but
    before the target. Move the braking point higher and try again."
  - `correct`: "The elevator reached the target exactly as its velocity
    reached zero. This is the fastest valid journey."
  - `overshoot`: "The elevator reached the target while it was still
    moving, so it stopped beyond it. Move the braking point lower and try
    again."
- Disclaimer: "This is a simplified model. It treats the elevator as a
  single point that speeds up and slows down at a fixed rate. It ignores
  motor behaviour, weight, cables, comfort, and other real-world limits."

None of this copy uses the forbidden vocabulary in "Audience and progressive
disclosure," and no view in this slice ever renders the raw internal
`classification` string (`"short"`/`"correct"`/`"overshoot"`) — only the
mapped labels above.

### Display mapping and formatting

- Shared, every Result: the locked percentage; the classification label
  above; final position and final velocity shown together; physical
  elapsed time.
- Category-specific: `short` → shortfall; `correct` → a minimum-valid-time
  message that names the elapsed-time figure as the minimum rather than
  printing a second number equal to it; `overshoot` → velocity at target.
  `targetCrossingTime` is computed by `buildAttemptResult` but is not
  displayed anywhere in this slice.
- All numbers carry explicit SI units (`m`, `s`, `m/s`).
- Numbers are formatted to at most two decimal places with trailing
  zeroes trimmed (`5` not `5.00`, `4.32` not `4.320`, `3.9` not `3.90`).

### Testing tiers for this slice

- Pure controller and pure view-mapping tests may be co-located under
  `src/scripts/`; DOM/interaction tests for this slice live under `spec/`.
- Controller tests cover every invalid transition listed above (not only
  the valid ones) — `setPercentage`/`run` called on a `ResultState`, `retry`
  called on a `PredictingState` — asserting each throws `Error` (not
  `RangeError`) with a message naming the rejected transition; the
  percentage-value contract's own `RangeError` cases are tested separately.
- DOM tests assert Predicting never renders a Retry button (absent, not
  disabled) and Result always does, and that `document.activeElement` is
  the Result section after Run and the range input after Retry.
- jsdom-based tests verify wiring only, including those two focus
  destinations — they are not evidence of real pointer, touch, Tab-order,
  screen-reader announcement, or novice-comprehension behaviour; those
  remain the browser-level/manual checks below.

### DOM wiring and lifecycle (approved)

`[Approved design decision]`

Extends "State-dependent markup" above with the exact DOM lifecycle for this
slice's implementation, resolving how Retry's markup is produced.

- The server-rendered page contains exactly one Predicting subtree,
  authored once in the page markup — there is no second, JS-side Predicting
  builder. `initElevatorUI(root)` finds and retains that single
  server-rendered element; it is never destroyed and rebuilt.
- On **Run**: the retained Predicting element is detached from the live DOM
  (not destroyed — kept in a closure reference) and replaced with a
  newly-created Result section, built via `document.createElement`/
  `textContent` from the committed controller's `ResultState` and
  `resultView()` output. While Result is active, neither the Predicting
  element nor the Run button exists anywhere in the live DOM (detached, not
  merely hidden).
- On **Retry**: the Result section is removed from the live DOM and
  discarded — Result markup is always freshly built on the next Run, never
  retained. The retained Predicting element's range input value (and its
  visible percentage text) is updated to the preserved `p`, and that same
  retained element is reattached to the mount root.
- "Recreated" in "State-dependent markup" above means restored as the
  active phase in the live DOM — not necessarily allocated as a new
  `HTMLElement`. Detach-and-reattach of the one retained node satisfies
  live-DOM mutual exclusivity identically to a rebuild, without a second
  Predicting-markup source to keep in sync.
- Event listeners are attached to the retained Predicting element and to
  each freshly-built Result section exactly once, at construction/retention
  time, and must remain correct across any number of repeated Run → Retry
  cycles — a second Run after a Retry must lock the newly-set `p`, not a
  stale value from the first cycle.
- The mount root (a single element, e.g. `[data-testid="elevator-app"]`)
  holds exactly one active phase subtree at any time: the retained
  Predicting element while Predicting, or a freshly-built Result section
  while Result — never both, never neither, once `initElevatorUI` has run.
- The page's header/navigation (already required by the starter invariants
  in `spec/invariants.test.ts`), the approved heading and task copy, and
  the disclaimer all live **outside** the phase mount root, so they are
  never affected by a Run/Retry transition and never need to be duplicated
  inside either phase's subtree.
- Result markup uses only DOM construction and `textContent` — never
  `innerHTML` built from a dynamic value.
- A single `COPY` object, exported from `elevator-view.ts` alongside the
  already-approved `DISCLAIMER` and `resultView`, is the one source for the
  Predicting-phase heading/task/slider-label/Run-button/Retry-button
  strings — the server-rendered markup and any test asserting against that
  copy import `COPY` rather than restating the strings.
- `spec/starter.test.ts`, which describes the now-superseded starter page,
  is deleted when this slice's real-page test replaces it; the starter's
  `data-testid="intro"` attribute is not retained merely to keep that
  obsolete test green.

### Real-page test infrastructure (approved)

`[Approved design decision]`

- DOM/interaction tests for this slice render the real `src/pages/index.astro`
  through Astro's installed Container API (`experimental_AstroContainer`,
  from `astro/container`) rather than a hand-written HTML fixture, then
  parse the rendered HTML with `JSDOM` for querying/assertions.
- This requires a `vitest.config.ts` built on Astro's installed
  `getViteConfig()` (from `astro/config`) so `.astro` imports transform
  correctly inside test files. No new package dependency is added — both
  `astro/container` and `astro/config` are exports of the already-installed
  `astro` package.
- Because this configuration change affects how every existing test file is
  transformed, it is added as its own step, isolated from any UI test or
  page change: propose the exact config, add it alone, run the full
  existing committed suite unchanged against it, and commit it separately —
  only if every existing test still passes with no test file edited.
- Tests call `initElevatorUI(root)` directly against the root element found
  in the rendered document, rather than relying on jsdom to execute the
  compiled/bundled `main.ts` module script.

## Animation pacing

`visualDuration = max(0.8 s, 0.45 × T(p))` — a floor only, no upper clamp.
With `H=10, a=1.5` and `p` bounded to `{1,…,100}`, `T(p)` itself already
bounds `visualDuration` to at most `0.45 × T(100) = 0.45 × 2√(40/3) ≈
3.286335 s`, so a separate ceiling is unnecessary.

Displayed time is always the physical model time `T(p)` (see "Displayed
quantities and units"), never this scaled playback duration — scaling
changes only how long the animation takes to draw, never what number is
shown.

## Acceptance criteria

Each item is tagged `[Published spec]` (with the supporting quote),
`[Approved design decision]`, or `[Derived model invariant]`. Divided by
what each tier of test can actually exercise — a unit test on the formulas
does not exercise real keyboard, pointer, or resize behaviour, and is not
claimed to.

### Model unit tests (pure functions; can be written before any UI exists)

- `p=1` classifies short; `x_stop(1) = H/50`.
  `[Derived model invariant]` — `x_stop(p)=(p/50)H`.
- `p=50` classifies correct; `x_stop(50) == H` and `v_at_H(50) == 0` exactly.
  `[Derived model invariant]` — `s(50)=H/2` boundary.
- `p=100` classifies overshoot; `v_at_H(100) = √(2aH)` (the "never brake
  before the target" extreme); `x_stop(100) = 2H`.
  `[Derived model invariant]` + `[Approved design decision]` (domain
  includes `p=100`).
- The classification function matches the formulas above across a full
  sweep of `p ∈ {1,…,100}`.
  `[Derived model invariant]`.
- With the resolved constants `H=10 m, a=1.5 m/s²`: `p=50` gives
  `s*=5 m`, `v*=√15≈3.872983 m/s`, `T*=2√(20/3)≈5.163978 s`; `p=100` gives
  `v(H,100)=√30≈5.477226 m/s`, `x_stop(100)=20 m`,
  `T(100)=2√(40/3)≈7.302967 s`.
  `[Derived model invariant]` — literal checks of the "Model constants and
  units" reference values, additional to (not replacing) the parameterised
  checks above.
- Invalid inputs throw `RangeError` and compute nothing further, checked
  against `classify` and at least one model-taking function (e.g.
  `stopPosition`) with a small representative table: `H ∈ {0, −10, NaN,
  Infinity}`; `a ∈ {0, −1.5, NaN, Infinity}`; `p ∈ {0, 101, −1, 1.5, NaN,
  Infinity}`.
  `[Approved design decision]` — see "Model API input contract".
- `positionAt`/`velocityAt` at `t=0` return `(0, 0)` exactly, across a full
  sweep of `p ∈ {1,…,100}`.
  `[Derived model invariant]`.
- For arbitrary `t` strictly inside the acceleration phase
  (`0<t<switchTime(p)`) and the braking phase (`switchTime(p)<t<stopTime(p)`),
  `positionAt`/`velocityAt` match the raw two-phase kinematic formulas
  (`x=½at², v=at` and `x=s+v1τ−½aτ², v=v1−aτ`) computed independently of
  `switchTime`/`stopTime` themselves. This is the independent formula check
  for the trajectory functions.
  `[Derived model invariant]`.
- At `t=switchTime(p)` and `t=stopTime(p)`, `positionAt`/`velocityAt` equal
  `switchDistance`/`switchSpeed` and `stopPosition`/`0` respectively, for a
  full sweep of `p`. These are consistency checks between the trajectory
  functions and the already-verified boundary functions, not independent
  proof — the independent check is the interior-phase item above.
  `[Derived model invariant]`.
- Velocity is non-negative and position is non-decreasing across sampled
  interior `t`, for both `DEFAULT_MODEL` and a second model.
  `[Derived model invariant]`.
- For `p>50`, `positionAt(crossingTime(p))≈H` and
  `velocityAt(crossingTime(p))≈speedAtTarget(p)`, linking the trajectory
  functions to the independently-defined H-crossing functions.
  `[Derived model invariant]`.
- `positionAt`/`velocityAt` reject `t<0`, `t>stopTime(p)`, `NaN`, and
  `±Infinity` with `RangeError`, without clamping.
  `[Approved design decision]` — see "Trajectory time input contract".
- `buildAttemptResult` produces the correct discriminated variant and
  category-specific fields for representative `p<50`, `p=50`, and `p>50`,
  with no cross-category fields present on the wrong variant, and rejects
  invalid `H`/`a`/`p` with `RangeError` according to the Model API input
  contract, validating `model` before `p` rather than relying on incidental
  validation in composed functions.
  `[Approved design decision]` — see "Completed-attempt result shape".

### Interaction/component tests (written once controls exist)

- Pointer, keyboard, and touch input for the same target value each lock
  an identical `p` (and derived `s`).
  `[Approved design decision]`.
- For `p>50`, component state remains `Running` (not `Result`) until
  simulated time reaches `x_stop(p)`, while `v(H)` is captured and frozen
  at the earlier H-crossing instant.
  `[Approved design decision]`.
- History caps at 3 entries with no score field rendered.
  `[Approved design decision]`.
- With a mocked reduced-motion preference, the component transitions
  directly to the same Result classification and history entry as the
  animated path, without waiting on any animation frame callback.
  `[Approved design decision]`, applying the harness rule in this repo's
  `CLAUDE.md` (continuous events must not be classified from render
  timing).
- Default-visible UI contains none of the forbidden specialist terms
  (case-insensitive): "bang-bang", "Pontryagin", "optimal control", "phase
  plane", "double integrator", "state-space", "switching function", "u(t)".
  `[Approved design decision]` — see "Audience and progressive disclosure".
- The formal-model disclosure (if implemented) is unavailable before the
  first Result and collapsed/closed by default afterward.
  `[Approved design decision]` — see "Audience and progressive disclosure".
- Every Result classification (`short`, `correct`, `overshoot`) renders a
  dedicated plain-language explanation element, identified semantically
  (e.g. a role or test id), not by asserting an exact sentence.
  `[Approved design decision]` — see "Audience and progressive disclosure".

None of these three checks is evidence that the copy is actually clear to a
novice — only that the structural gating and vocabulary boundary hold.

### First UI slice component tests (Predicting/Result only)

`[Approved design decision]` for every item below, extending "First UI slice
— controller and markup contract."

- Initial controller state is exactly
  `{ phase: "predicting", p: 35, result: null }`, typed as `PredictingState`.
- `setPercentage` validates `p` via the existing percentage contract
  (`RangeError` on an invalid value) and succeeds only on a
  `PredictingState`; invoked on a `ResultState`, it throws `Error` (never
  `RangeError`) naming the rejected transition.
- `run` succeeds only on a `PredictingState`, snapshots `p`, and returns a
  `ResultState` built from `buildAttemptResult`; invoked on a `ResultState`,
  it throws `Error` naming the rejected transition.
- `retry` succeeds only on a `ResultState` and returns a `PredictingState`
  with `p` unchanged from what was run; invoked on a `PredictingState`, it
  throws `Error` naming the rejected transition.
- `PredictingState`/`ResultState` are a discriminated union: no value of
  type `UIState` can have `phase: "predicting"` with a non-null `result`,
  or `phase: "result"` with a `null` result.
- Predicting renders the range control and Run button; Result renders the
  completed result and Try again button; Retry is never rendered before the
  first Run, and the Run button does not exist once Result renders.
- After Run, focus moves to the Result section (never left on the removed
  Run button); after Retry, focus moves to the range input. Both are
  verified as `document.activeElement` in component tests; real
  screen-reader announcement behaviour remains a browser-level/manual
  check.
- The Result section is a `<section>` with `tabindex="-1"`,
  `aria-live="polite"`, and `aria-atomic="true"`, without `role="status"`;
  its content — and therefore its announcement — changes only on Run,
  never on a slider input event.
- Every Result renders the approved plain-language label and explanation
  text, never the raw `classification` enum value.
- Displayed numbers carry explicit SI units and at most two decimal places
  with trailing zeroes trimmed.
- `overshoot` results never render `targetCrossingTime`.

### DOM/Astro red-test scope (this slice)

`[Approved design decision]` for every item below, extending "First UI
slice component tests" with the Astro Container rendering strategy and the
retained-node lifecycle in "DOM wiring and lifecycle" above.

1. The real `index.astro`, rendered through Astro Container and parsed with
   JSDOM, retains the starter invariants' navigation landmark and exactly
   one `<h1>`, and its Predicting subtree exists with no Result markup
   present anywhere in the document.
2. The range input carries `min="1" max="100" step="1"` and the initial
   value from `initialUIState.p`, with a real associated label using the
   approved slider-label text from `COPY`.
3. The disclaimer element's text equals the exported `DISCLAIMER` constant
   exactly, before any interaction.
4. After calling `initElevatorUI(root)` and clicking Run: the Predicting
   element is detached from the live DOM (not merely hidden), a Result
   section exists with `tabindex="-1"`, `aria-live="polite"`,
   `aria-atomic="true"`, no `role="status"`, and `document.activeElement`
   is that section.
5. The rendered Result heading, explanation, and fields for a given `p`
   match the committed `resultView(buildAttemptResult(DEFAULT_MODEL, p))`
   output used as the expected view mapping. This verifies that the DOM
   wiring consumes the approved pure view model without retyping or
   re-deriving its numbers and strings; it is a consistency check, not
   independent evidence that the view mapping itself is correct.
6. `overshoot` results render no element identified by
   `data-field="targetCrossingTime"`; elapsed time is identified by
   `data-field="elapsedTime"`, not by searching rendered text for a
   repeated numeric string.
7. Clicking Retry removes the Result section, reattaches the retained
   Predicting element with its range value updated to the preserved `p`
   (not reset to any default), and moves focus to that range input.
8. At least two consecutive Run → Retry cycles are exercised in one test,
   each locking and preserving its own distinct `p`, to prove the retained
   node's listeners remain correct after repeated detach/reattach — not
   only on the first cycle.
9. No formal-model disclosure element exists anywhere in the rendered
   document at any point in this slice, and the disclaimer text is
   unchanged and still present after both a Run and a Retry.

These checks verify wiring against the real rendered page (via Astro
Container, parsed with JSDOM), per "Testing tiers for this slice" and
"Real-page test infrastructure" above — they are not evidence of real
pointer, touch, Tab-order, screen-reader, or novice-comprehension
behaviour, which remain the browser-level and manual checks below.

### Browser-level and manual checks (not exercisable by unit/component tests)

- Real keyboard tab order reaches the control, and arrow keys operate it.
  `[Published spec]` — "the keyboard... tabs through it."
- Real pointer and touch operation on actual input devices.
  `[Approved design decision]` — pointer/touch parity with keyboard input is
  not itself named by the published brief.
- Resizing an open browser window mid-run.
  `[Published spec]` — "a resize mid-interaction" / "resizes mid-use."
- Both marking viewports render and operate correctly at 1920×1080 and
  390×844.
  `[Published spec]` for "both marking viewports (desktop and phone)";
  pixel values themselves are this repo's `CLAUDE.md`, not the brief.
- OS-level reduced-motion preference is actually honoured in a real
  browser.
  `[Approved design decision]` — not named in the published brief.
- Behaviour on a slow connection (no broken or stuck states).
  `[Published spec]` — "a slow connection."
- Someone unfamiliar with control theory can identify the task, choose a
  braking position, run an attempt, and explain why it stopped short,
  arrived correctly, or overshot, without opening the formal disclosure;
  across guided representative attempts they can articulate that success
  requires reaching the target position with zero velocity. Observed
  confusion is recorded and the interface revised if needed.
  `[Approved design decision]` — a green automated suite, including the
  component checks above, is explicitly not evidence that this judgment
  passes; only a person can make this call.

A unit test passing on the formulas above is not evidence that any of the
browser-level checks pass; each tier must be exercised on its own terms.

## Authoritative sources (mathematical claim)

- Tedrake, Russ. *Underactuated Robotics*, Chapter 7: "Dynamic
  Programming" (MIT course notes). http://underactuated.mit.edu/dp.html
- Burachik, Regina S.; Caldwell, Bethany I.; Kaya, C. Yalçın; Moursi,
  Walaa M. "Best Approximation Optimal Control for Infeasible Double
  Integrator and Douglas–Rachford Algorithm." arXiv:2602.07851 [math.OC],
  submitted 8 Feb 2026. https://arxiv.org/abs/2602.07851
- Romano, Marcello; Curti, Fabio. "Analytic Solution of the Time-Optimal
  Control of a Double Integrator from an Arbitrary State to the
  State-space Origin." arXiv:1909.03192 [math.OC] (cross-listed eess.SY,
  math.DS), submitted 7 Sep 2019. https://arxiv.org/abs/1909.03192

These sources establish bang-bang optimality and the at-most-one-switch
structural result for the double integrator. The specific closed-form
formulas above (in terms of `s`, `H`, `a`, and the percentage `p`) are this
repository's own derivation, cross-checked against the sourced structural
result, the coordinate transformation to regulation-to-origin, and direct
substitution into the continuous equations.

## Published Assignment 1 brief

https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/assignment-1/
