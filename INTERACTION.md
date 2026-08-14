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

Point mass only, for both Beginner and Advanced. No modeling of mass, motor
torque-speed curve, gravity, cable dynamics, jerk/comfort limits, actuator
lag, or sensor noise, in either mode. No live/reflex braking in either mode —
the visitor always predicts before the run, never reacts during it.

For Beginner specifically: the symmetric acceleration bound is a design
choice for this explainer, not a claim about how a real passenger elevator is
controlled, and `H` and `a` are fixed for the whole Beginner experience — not
visitor-adjustable there.

Advanced mode (see "Advanced mode model and contract" below) is the one
deliberate exception to Beginner's fixed, symmetric parameters: it exposes
`H`, the acceleration limit `a`, and a separate braking-magnitude limit `b`
as visitor-adjustable, asymmetric parameters. This is the only place
asymmetric drive/brake authority is modeled anywhere in this prototype, and
it remains an idealised point-mass abstraction — none of the other
exclusions above are lifted for Advanced.

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

## Second UI slice — Running phase, animation, and shaft visual (approved)

`[Approved design decision]`

Extends "State machine and visible outcomes," "Animation pacing," and "Input,
history, and responsive behaviour" above with the controller, animation, and
coordinate-system contract for this slice's implementation.

### Controller extension

```ts
export type RunningState = {
  readonly phase: "running"
  readonly p: number
  readonly result: AttemptResult
}

export type UIState = PredictingState | RunningState | ResultState

export function run(state: UIState): RunningState
export function completeRun(state: UIState): ResultState
```

- `run` now transitions `Predicting → Running` (superseding the narrower
  "First UI slice" contract's `Predicting → Result`, which explicitly scoped
  itself to "Predicting and Result phases only"). It locks `p` and computes
  `buildAttemptResult(DEFAULT_MODEL, p)` into `RunningState.result` up front,
  matching "Running: entered by locking the selected p and computing the
  full trajectory and event times up front."
- `completeRun(state: UIState): ResultState` transitions `Running → Result`,
  forwarding the already-computed `result` unchanged. Called on `Predicting`
  or `Result`, it throws `Error` naming the rejected transition, matching the
  existing wrong-phase-throws pattern.
- `retry` and `setPercentage`'s existing guards are unchanged; calling either
  on a `RunningState` throws `Error` naming the rejection.

### Animation architecture

- `visualDuration(stopTimeS: number): number` validates `stopTimeS` as finite
  and `> 0`, throwing `RangeError` otherwise, then returns `max(0.8, 0.45 ×
  stopTimeS)` — the exact signature and validation for "Animation pacing"'s
  already-approved `visualDuration = max(0.8 s, 0.45 × T(p))` formula above; a
  narrower clarification of that formula, not a new feature.
- Wall-clock elapsed time maps linearly onto physical time:
  `physicalTimeAt(wallElapsedMs, visualDurationMs, stopTimeS)` returns
  `min(1, wallElapsedMs/visualDurationMs) × stopTimeS`. This is the only
  clamp — an upper-bound endpoint policy absorbing `requestAnimationFrame`
  overshoot — and it is the rendering caller's own policy, never a change
  inside `positionAt`/`velocityAt` (see "Trajectory time input contract").
- `requestAnimationFrame` timestamps are document-timeline-relative (time
  since the page's own navigation start), not session-relative, so a Run's
  own elapsed time is never read directly off the raw timestamp. The first
  `requestAnimationFrame` callback fired for a Run establishes that session's
  wall-clock origin (`sessionStartTimestamp`, set exactly once from that
  callback's own timestamp argument) and renders the analytic sample at
  `t=0`. Every callback after that computes `wallElapsedMs = timestamp -
  sessionStartTimestamp`, and only this session-relative value is ever passed
  to `physicalTimeAt` — the raw, absolute `requestAnimationFrame` timestamp is
  never compared directly against `visualDurationMs` or any other duration.
- `requestAnimationFrame` is used only to sample this already-solved
  trajectory for display; it never determines whether, when, or how the
  attempt resolves. The resolved `AttemptResult` was already computed by
  `run()` before the first frame runs.
- `matchMedia` and `requestAnimationFrame`/`cancelAnimationFrame` are obtained
  from `root.ownerDocument.defaultView`, never an ambient global `window`.
- Each Run starts a session token. A `cancelAnimationFrame` call and the
  session's own cancelled flag together guarantee that once Result is
  reached, no further scheduled frame can mutate Running markup or call
  `completeRun` a second time — including a callback still queued at the
  moment cancellation happens.
- Under `prefers-reduced-motion: reduce` (read once via `matchMedia` at Run
  time), the Running phase's DOM subtree is never created at all — Predicting
  detaches directly into Result, calling `completeRun` synchronously with no
  frame ever scheduled.
- The animation stores only physical model state (locked `p`, sampled
  physical time) — never a pixel value. Car and marker screen positions are
  recomputed from that physical state as CSS percentages on every sampled
  frame, so a container resize is handled by ordinary CSS layout with no
  listener, no measurement, and no reprojection code. Verifying this in a
  real resized browser window is a manual/browser check, not an automated
  one (see "Real-page test infrastructure").

### Shaft visual and coordinate system

- The shaft's visual domain is fixed at `[0, 2H]` in both Predicting and
  Running — never rescaled to a locked `p`'s own extent. `2H` is already the
  model's own upper bound (`x_stop(100) = 2H`, "Model constants and units").
- The target `H` sits at the exact visual midpoint of this fixed domain in
  every phase and for every `p`.
- `[0, H]` is the target-journey region; `(H, 2H]` is the overshoot region,
  distinguished by the existing target-marker element at their boundary.
- The braking marker (Predicting and Running) projects `switchDistance(model,
  p)`; the car (Running only) projects the live `positionAt(model, p,
  clampedT)`. Both use `projectToShaftPercent(position, extent)` with
  `extent = shaftDomain(model) = 2 × model.H`, fixed for the whole slice. The
  returned percentage is applied as a CSS bottom percentage: 0 m is the
  shaft bottom, H is 50%, and 2H is the shaft top. The shaft element has a
  definite block size and establishes a positioning context
  (`src/styles/global.css`) — structural geometry only; typography, colour,
  and final responsive polish are deferred.
- Predicting's shaft, target marker, car, and braking marker share the same
  `data-testid`s with Running's — never both live at once, matching the
  existing mutual-exclusivity rule in "DOM wiring and lifecycle" above.
- While Running, the percentage input, Run button, and Retry button are all
  absent from `[data-testid="elevator-app"]` (Predicting is detached, and
  Result/Retry do not yet exist). Permanent navigation outside the phase
  root is unaffected and remains present throughout.

### Running-phase and animation tests (this slice)

`[Approved design decision]` for every item below, extending "Second UI slice
— Running phase, animation, and shaft visual" above.

1. `run` locks `p` and returns a `RunningState` whose `result` already
   equals `buildAttemptResult(DEFAULT_MODEL, p)`; `completeRun` on that
   state returns a `ResultState` carrying the identical `result`.
2. `run`/`completeRun`/`retry` each throw `Error` naming the rejected
   transition on every phase they do not accept, including `RunningState`.
3. `visualDuration`, `physicalTimeAt`, `projectToShaftPercent`, and
   `shaftDomain` reject non-finite or invalid-range arguments with
   `RangeError`, without clamping any of them; the one approved clamp
   (`wallElapsedMs` past `visualDurationMs`) is distinguished from these
   rejections.
4. `projectToShaftPercent` returns a value in `[0, 100]` independent of any
   pixel or viewport dimension.
5. The Predicting shaft, target marker, car, and braking marker render at
   CSS percentages consistent with `projectToShaftPercent` over the fixed
   `[0, 2H]` domain; the braking marker moves on the slider's `input` event
   without a Run.
6. Clicking Run (motion not reduced): Predicting is detached; inside
   `[data-testid="elevator-app"]` there is no percentage input, Run button,
   or Retry button while Running; the permanent navigation landmark outside
   the phase root still exists and is unaffected.
7. Driving the animation to completion reaches Result matching
   `resultView(buildAttemptResult(DEFAULT_MODEL, p))`, for one `p` per
   classification band.
8. The pure running readout changes from accelerating to braking exactly at
   `switchTime(model,p)`; the DOM wiring renders the accelerating state at an
   analytic time before the switch and the braking state at an analytic time
   after it.
9. For an overshoot `p`, at an analytic instant strictly between
   `crossingTime(model, p)` and `stopTime(model, p)`, Running is still
   active and the rendered position/velocity readouts show position `> H`
   and velocity `> 0`. Car projection during Running is checked at `t=0`,
   `switchTime`, and this interior instant only — not at `stopTime`, since
   the completion frame transitions immediately to Result and detaches
   Running; `stopTime` exactness stays with the pure trajectory/model tests
   above, and DOM completion is verified through the resulting Result view
   (item 7).
10. With `matchMedia` stubbed to `matches: true`, Run reaches Result
    synchronously with zero `requestAnimationFrame` calls and content
    identical to the animated path.
11. After Result, any stale queued animation callback does not mutate
    Result or create a second one.
12. No element introduced by this slice contains forbidden vocabulary from
    "Audience and progressive disclosure."

Real-browser mid-run resize (percentage-positioned car adapting without
restart, `p` change, or outcome change) is a manual/browser check at both
marking viewports, not an automated DOM test — see "Real-page test
infrastructure."

## Third UI slice — Hint and Reveal (approved)

`[Approved design decision]`

Extends "State-dependent markup," "Shaft visual and coordinate system," and
"DOM wiring and lifecycle" above with an optional, opt-in hint path available
only during Predicting on the Beginner mode of Play. This is separate from,
and unlocked independently of, the formal-model disclosure in "Audience and
progressive disclosure" — a visitor can request the hint without ever opening
the formal disclosure, and vice versa.

### Purpose and shape

Two sequential, visitor-triggered reveals, never automatic:

1. A **conceptual hint** — plain language, no number — reminding the visitor
   that arrival requires zero velocity, not just reaching the position.
2. A **fastest-valid-braking-point reveal** — the actual switching percentage
   (`50%` for Beginner) as a number and as a second shaft marker, requested
   only after the conceptual hint, never shown first or automatically.

Both stay inside Predicting's subtree: they are irrelevant once Running starts
and are covered by Result's own hint-comparison fields instead (see "Result
hint comparison" below), so they detach along with the rest of Predicting on
Run, exactly like the existing Run button and range input.

### Hint state module (`src/scripts/elevator-hint.ts`, new)

Pure, immutable, mirroring the existing controller's phase-guarded-transition
pattern in "First UI slice — controller and markup contract":

```ts
export type HintPhase = "hidden" | "conceptual" | "revealed"

export type HintState = {
  readonly phase: HintPhase
}

export const initialHintState: HintState = { phase: "hidden" }

export function showConceptualHint(state: HintState): HintState
export function revealFastestValid(state: HintState): HintState
export function resetHint(): HintState
```

- `showConceptualHint(state)` — valid only when `state.phase === "hidden"`;
  returns `{ phase: "conceptual" }`. Called on `"conceptual"` or `"revealed"`,
  throws `Error` naming the rejected transition — never `RangeError`, matching
  the existing phase-vs-value error convention.
- `revealFastestValid(state)` — valid only when `state.phase === "conceptual"`;
  returns `{ phase: "revealed" }`. Called on `"hidden"` or `"revealed"`, throws
  `Error` naming the rejected transition. This enforces that the fastest-valid
  reveal can never be reached without the conceptual hint having been shown
  first.
- `resetHint()` — takes no state argument and unconditionally returns
  `initialHintState`. Unlike the two transitions above, this is not a guarded
  transition on an existing state — every hint phase resets the same way, so
  there is nothing to validate. It exists to make the Retry-reset policy below
  a single named call rather than an inline object literal at each call site.

### Fastest-valid comparison (`buildHintComparison`, same module)

A second pure function, reusable by Advanced in a later slice with a
different `fastestValidP`:

```ts
export const BEGINNER_FASTEST_VALID_P = 50

export type HintComparison = {
  readonly yourBrake: number
  readonly fastestValid: number
  readonly differenceLabel: string
  readonly matches: boolean
}

export function buildHintComparison(p: number, fastestValidP: number): HintComparison
```

- Validates `p` with the existing `assertValidPercentage` (from
  `src/model/elevator.ts`) — finite integer, `1…100` — throwing `RangeError`
  on an invalid value, no silent clamping, matching every other exported
  function in this document.
- Validates `fastestValidP` as finite and within `0…100` inclusive, throwing
  `RangeError` otherwise. It is **not** constrained to an integer here: for
  Beginner it is always the integer `50` (`BEGINNER_FASTEST_VALID_P`), but the
  parameter itself stays a general `number` so this function needs no change
  when Advanced's own `p* = 100b/(a+b)` (generally non-integer) is plugged in
  during Slice 5 — Advanced's own rounding/tolerance/"snap" policy is a
  separate, later decision (see Slice 4 in the saved migration plan) and is
  not resolved by this function.
- `matches = p === fastestValidP` — exact equality, no epsilon. For Beginner
  both operands are always integers, so this is exact by construction, the
  same reasoning already used for `classify`'s own `p===50` exact boundary
  (see "Exact boundary-event policy"). This exactness claim is specific to
  Beginner's integer inputs; it is not assumed to extend unchanged to
  Advanced's non-integer optimum without that separate decision.
- `differenceLabel` is plain language, reusing `formatNumber` from
  `elevator-view.ts` for the numeric part (no reimplementation of the
  two-decimal-trim formatting rule):
  - `matches === true` → `"Matches exactly"`.
  - `p < fastestValidP` → `` `${formatNumber(fastestValidP - p)} percentage
    points too early` ``.
  - `p > fastestValidP` → `` `${formatNumber(p - fastestValidP)} percentage
    points too late` ``.
- None of this vocabulary — "too early," "too late," "matches exactly,"
  "percentage points" — is in the forbidden list in "Audience and progressive
  disclosure"; it reuses words already approved there.

### Predicting markup extension

- The server-rendered Predicting subtree in `play.astro` gains one new child,
  a `<div data-testid="hint">`, authored once alongside the existing range
  input and Run button — not built by JS from nothing. It initially contains
  exactly one element:
  - `<button type="button" data-testid="hint-button">STUCK? GET A HINT.</button>`
- On clicking `hint-button` (`showConceptualHint`): the button is removed and
  two elements are appended to the same `data-testid="hint"` container, built
  via `document.createElement`/`textContent` only (never `innerHTML`):
  - `<p data-testid="hint-conceptual" tabindex="-1">Reaching the target is
    only half the job. What should the elevator's velocity be when it gets
    there?</p>`
  - `<button type="button" data-testid="reveal-button">REVEAL THE FASTEST
    VALID BRAKING POINT</button>`
  - Focus moves to `hint-conceptual` (`tabindex="-1"` makes it a valid
    programmatic focus target, the same pattern already used for the Result
    section).
- On clicking `reveal-button` (`revealFastestValid`): the button is removed;
  `hint-conceptual` stays in place (it remains true and useful context); one
  new element is appended:
  - `<p data-testid="hint-revealed" tabindex="-1">The fastest valid braking
    point is 50% of the way to the target.</p>`
  - and one new marker is appended to the existing Predicting shaft
    (`data-testid="shaft"`, the same element the braking marker already lives
    in): `<div data-testid="fastest-valid-marker" class="marker
    marker-fastest-valid">`, positioned via the same
    `projectToShaftPercent(switchDistance(DEFAULT_MODEL, BEGINNER_FASTEST_VALID_P),
    SHAFT_EXTENT)` projection already used for the braking marker — no new
    coordinate logic. Because the visitor's own braking marker uses the same
    projection over the same fixed `p=50`, the two markers visually coincide
    exactly when the visitor's own slider is at `50%`; this is an emergent
    consequence of sharing one projection function, not special-cased code,
    and is not itself asserted by name in any test.
  - The reveal never moves the visitor's own slider value or braking marker —
    only the new elements above are added.
  - Focus moves to `hint-revealed`.
- No `aria-live` on any hint element: each change is the direct, synchronous
  result of the visitor's own click, so the focus move itself is the
  announcement mechanism, the same reasoning already given for why the
  slider's value span is not a live region (see "Result region semantics").

### Retry-reset policy (approved)

- On Retry, the hint container is restored to its initial state as part of
  the same operation that reattaches the retained Predicting element: any
  `hint-conceptual`/`hint-revealed` paragraphs, the `reveal-button`, and the
  `fastest-valid-marker` are removed, and the original `hint-button` is
  reattached as the container's only child. The DOM-level `HintState` is
  reset via `resetHint()`.
- Rationale: Retry represents a fresh attempt, and a visitor who used the
  hint on one attempt should have to ask again on the next rather than see it
  pre-revealed — this also keeps the reveal state simple to reason about,
  since it is never carried across attempts.
- This reset does not change Retry's already-approved focus destination:
  focus still moves to the range input (see "State-dependent markup"), never
  to the reset `hint-button`.
- Because Beginner's `fastestValidP` is the fixed constant `50`, changing the
  slider's `p` before or after a reveal never invalidates that reveal — no
  invalidation logic is needed in this slice. (Advanced's own parameter-change
  invalidation is a separate, later decision — see Slice 4/5 in the saved
  migration plan.)

### Result hint comparison

- `buildResultSection` accepts one additional piece of information: whether
  `HintState.phase === "revealed"` at the moment `run()` was called for this
  attempt — snapshotted once, at Run time, exactly like the rest of the
  attempt's state. A hint merely shown conceptually (`"conceptual"`, never
  advanced to `"revealed"`) does **not** trigger this section — only a full
  reveal does.
- When revealed, Result renders one additional block, `data-testid=
  "hint-comparison"`, built from `buildHintComparison(p, BEGINNER_FASTEST_VALID_P)`:
  - `data-field="yourBrake"` → `` `${p}%` ``
  - `data-field="fastestValid"` → `` `${BEGINNER_FASTEST_VALID_P}%` ``
  - `data-field="hintDifference"` → `comparison.differenceLabel`
- When not revealed, no element with `data-testid="hint-comparison"` exists
  anywhere in the Result section.
- Predicting's shaft (and therefore its two hint markers) is already detached
  before Result is ever mounted (see "DOM wiring and lifecycle"), so "marker
  overlap when exact" is necessarily expressed as the `"Matches exactly"` text
  above, not as a literal pair of overlapping marker elements inside Result —
  there is no second shaft in Result to place them on.

### Scope boundary

- Home and Principle render no hint control of any kind — the entire hint
  container lives inside Play's Predicting subtree, which does not exist on
  either of those pages.
- The formal-model disclosure (see "Audience and progressive disclosure")
  and the hint path are independent: neither being open, closed, used, or
  unused affects the other's availability.

### Hint and Reveal tests (this slice)

`[Approved design decision]` for every item below.

1. `showConceptualHint`/`revealFastestValid` succeed only from their required
   phase (`"hidden"`/`"conceptual"` respectively) and throw `Error` (never
   `RangeError`) naming the rejected transition from every other phase,
   including calling `revealFastestValid` directly from `"hidden"` (skipping
   the conceptual step).
2. `resetHint()` returns `initialHintState` unconditionally — called
   independent of any prior state, since it takes none.
3. `buildHintComparison` matches the differenceLabel rules above across a
   representative sweep of `p` on both sides of `fastestValidP`, and exactly
   at it; rejects invalid `p` (reusing the existing `assertValidPercentage`
   table) and invalid `fastestValidP` (`<0`, `>100`, `NaN`, `±Infinity`) with
   `RangeError`.
4. The server-rendered `play.astro` contains exactly one `hint-button` and no
   `hint-conceptual`/`reveal-button`/`hint-revealed`/`fastest-valid-marker`
   element before any interaction.
5. Clicking `hint-button` removes it, adds `hint-conceptual` and
   `reveal-button`, and moves focus to `hint-conceptual`; `fastest-valid-marker`
   still does not exist.
6. Clicking `reveal-button` removes it, adds `hint-revealed` and
   `fastest-valid-marker` (positioned per the shared projection function),
   moves focus to `hint-revealed`, and leaves the visitor's own
   `percentage-input` value and `braking-marker` position unchanged.
7. Running Run without ever revealing (hint hidden, or conceptual-only)
   yields a Result with no `[data-testid="hint-comparison"]` element.
8. Revealing, then Running, yields a Result whose `hint-comparison` fields
   match `buildHintComparison(p, BEGINNER_FASTEST_VALID_P)` exactly, for one
   `p` below, one above, and `p=50` itself (the exact-match case).
9. After Retry, the hint container is back to its single-`hint-button` initial
   state (no conceptual/revealed/marker elements survive), across at least
   two consecutive reveal → Run → Retry cycles, and focus after Retry is
   still the range input, not the reset hint button.
10. No element introduced by this slice contains forbidden vocabulary from
    "Audience and progressive disclosure."
11. Home and Principle render no element with `data-testid="hint"` (or any of
    its descendants' testids) anywhere in their built pages.

## Principle page — content and layout contract (approved)

`[Approved design decision]`

Scope: `src/pages/principle.astro` (route 3 of the 3-route site — see the
saved migration plan's revision note; there is no `play-advanced.astro`, and
Principle is a standalone read, not part of the Predicting/Running/Result
state machine above). This section supersedes the page's current placeholder
("Coming next").

### Purpose and relationship to Play

Principle explains, in prose, the same idealised model already specified in
"Verified model and formulas" and "Model constants and units" — it introduces
no new physics, no new formulas, and no new constants. Its one interactive-ish
element is a static, non-interactive reuse of the existing shaft visual
(`projectToShaftPercent`/`shaftDomain`/`switchDistance`, "Shaft visual and
coordinate system") to illustrate the switch point discussed in prose; it has
no range input, no Run/Retry, no Hint, and no `data-testid="elevator-app"` or
`data-testid="hint"` anywhere on the page (already asserted by
`spec/principle-page.test.ts`; this section does not change that boundary, it
documents the content now filling the rest of the page around it).

The vocabulary restriction in "Audience and progressive disclosure" is scoped
to *default-visible Play UI* — Principle is a separate, opted-into page, so
that restriction does not apply to it wholesale. But the same section's
underlying principle (a novice must never be required to already know a term
to follow the page) still applies here in a weaker form: every specialist term
this page introduces is either explained in plain language at first use, or
confined to the optional formal disclosure below, never dropped unexplained
into the always-visible prose.

### Content outline (progressive, in this order)

1. **An everyday puzzle** — plain-language framing: an elevator answering a
   call solves this same problem on every trip, without anyone noticing it as
   an optimisation problem.
2. **Reaching the floor isn't the same as arriving** — restates "Point of
   view" for a reader arriving fresh at this page (not assumed to have read
   Play first): position and velocity are two different quantities, and
   arrival requires both the right position and zero velocity together.
3. **Why full power one way, then full power the other, is fastest** — the
   plain-language intuition for the switched bang-bang structure, without
   naming it: wasted time not accelerating is never recovered, whatever speed
   is built up must be shed again before the target, and there is exactly one
   correct moment to switch from accelerating to braking.
4. **Why the answer is exactly halfway** — because the acceleration and
   braking limits are equal (both `a`), accelerating to a given speed and
   shedding that same speed take equal distance, so the switch falls exactly
   at the midpoint. States the already-verified reference values from "Model
   constants and units" (`s*=H/2=5 m`, `v*=√(aH)=√15≈3.87 m/s`,
   `T*=2√(H/a)=2√(20/3)≈5.16 s`) — no new derivation, direct reuse.
5. **An optional formal section**, `<details data-testid="formal-model">` /
   `<summary>`, collapsed/closed by default (no `open` attribute) — see
   "Optional formal disclosure" below.
6. **How this compares to a real elevator** — the same idealised-point-mass
   scope already stated in "Scope exclusions," restated for a reader of this
   page specifically (no mass, motor torque curve, cabling, comfort limits, or
   safety systems).
7. **References**, nested inside the same optional formal section rather than
   as a separate always-visible section — see "Optional formal disclosure"
   below for why.

Historical or biographical claims about the puzzle's origin are out of scope
for this section: no such claim is made anywhere in this content outline,
since none of the three verified sources establishes one, and this repo's
`CLAUDE.md` prohibits inventing one to fill the gap.

### Optional formal disclosure

The `<details>` element from item 5 above is the one place on this page where
the terms restricted elsewhere may appear, each introduced with a one-clause
plain-language gloss rather than assumed:

- The formal statement of the model (identical to the block already given in
  "Verified model and formulas" — not restated with different symbols).
- "Double integrator" — introduced as the name for a system where position is
  the double integral of a bounded control input.
- "Bang-bang control" — introduced as the name for a control that only ever
  takes its extreme values, which is what the switched full-acceleration/
  full-braking solution is an instance of.
- "Pontryagin's Minimum Principle" and "phase plane" — named as, respectively,
  the classical tool used to prove the single-switch result, and the `(x,v)`
  state view in which that single-switch structure is visible geometrically.
- **References** (the same three sources already verified and cited in
  "Authoritative sources (mathematical claim)" below, reused verbatim as a
  linked list; no new source is introduced, and "Liberzon" — which appears
  only in the externally-stored planning note, never verified or cited
  anywhere in this repository — is deliberately not added here), nested
  inside this `<details>` rather than as a separate always-visible section.
  This is a placement decision made after drafting, not assumed from the
  outset: two of the three sources' own titles ("Best Approximation Optimal
  Control for Infeasible Double Integrator...", "...Time-Optimal Control of a
  Double Integrator... State-space Origin") literally contain restricted
  terms as part of their real, unparaphrasable titles — a source's title is
  quoted, never reworded, so it cannot be confined to always-visible prose
  without breaking the vocabulary boundary this section exists to enforce.
  Nesting References here also fits their purpose: they back the formal
  claims made in this disclosure specifically (the bang-bang/single-switch
  result), not the plain-language sections above it, so a visitor who never
  opens this section has no need to see them.

None of these terms — including inside a citation's own title — appear
anywhere on this page outside this one `<details>` element.

### Static shaft visual

- Reuses the identical shaft markup pattern and CSS classes already
  established for Play's `data-testid="shaft"` (`.shaft`, `.marker`,
  `.marker-target`, `.marker-fastest-valid`) — no new visual language, no new
  coordinate math.
- Frontmatter computes `shaftDomain(DEFAULT_MODEL)`, the target's percentage
  via `projectToShaftPercent(DEFAULT_MODEL.H, extent)`, and the switch
  point's percentage via
  `projectToShaftPercent(switchDistance(DEFAULT_MODEL, 50), extent)` — the
  same `50` as `BEGINNER_FASTEST_VALID_P`, reused as a literal here since this
  page has no hint module dependency of its own.
- Rendered once, statically, in server-rendered markup — no script import, no
  `initElevatorUI`, no interactivity, no `data-testid="elevator-app"`.
- Wrapped in a non-interactive `<figure>` (or `<aside>`) carrying
  `data-testid="principle-visual"`, distinct from Play's `data-testid="shaft"`
  parent (`data-testid="predicting"`/`"running"`) so a structural test can
  assert the two pages' visuals independently.

### Responsive layout

- On viewports `width >= 40rem`, the explanation content and the static visual
  sit side by side, with the visual column sticky (`position: sticky`) so it
  stays in view while the explanation scrolls past it — mirroring the same
  `@media (width >= 40rem)` breakpoint already used for Predicting/Running/
  Result's two-column layout, not a new breakpoint value.
- Below that width, the two stack into a single column (no CSS `position:
  sticky` effect is meaningful in a single-column stacked reading order).
- This is a CSS layout change only; the DOM order of the visual relative to
  the content sections is fixed regardless of viewport (no JS-driven
  reordering) — the visual precedes the content sections in source order, so
  a phone reader sees the illustration before the prose that refers to it,
  and a wide-viewport reader sees them side by side via `grid-column`
  placement rather than DOM reordering.
- Real sticky-scroll behaviour in an actual browser (does the visual actually
  stay pinned as the page scrolls, at both marking viewports) is a
  browser-level/manual check, not something JSDOM's layout-free DOM can
  verify — see "Browser-level and manual checks."

### Principle page tests (this slice)

`[Approved design decision]` for every item below.

1. The rendered page has exactly one `<h1>` and no
   `data-testid="elevator-app"` or `data-testid="hint"` element anywhere
   (extends the existing `spec/principle-page.test.ts` assertions to the real
   content, not just the placeholder).
2. Exactly one `data-testid="principle-visual"` element exists, containing a
   target marker and a switch-point marker whose CSS `bottom` percentages
   equal `projectToShaftPercent(DEFAULT_MODEL.H, shaftDomain(DEFAULT_MODEL))`
   and `projectToShaftPercent(switchDistance(DEFAULT_MODEL, 50),
   shaftDomain(DEFAULT_MODEL))` respectively — the same projection function
   already used and tested for Play, applied to the same `DEFAULT_MODEL`.
3. `data-testid="formal-model"` is a `<details>` element without an `open`
   attribute (closed by default) containing a `<summary>`.
4. None of the restricted terms ("bang-bang", "Pontryagin", "optimal
   control", "phase plane", "double integrator", "state-space", "switching
   function", "u(t)", case-insensitive) appear in this page's rendered text
   outside the `data-testid="formal-model"` element's own subtree.
5. A references list, nested inside `data-testid="formal-model"`, exists
   whose links' `href`s match the three URLs already listed in "Authoritative
   sources (mathematical claim)" below, and no additional/unverified source
   is present.
6. The Home and Play pages are unaffected: `spec/home-page.test.ts` and the
   Play-page specs continue to pass unchanged, confirming this slice touched
   only the Principle route and shared, non-page-specific CSS.

Real sticky/stacked rendering at both marking viewports is a manual/browser
check (see "Browser-level and manual checks"), not asserted by any test above
— JSDOM has no layout engine and cannot verify `position: sticky` or actual
column placement.

## Advanced mode model and contract (approved)

`[Approved design decision]`. This section is model-only: it defines the pure
functions and types Advanced mode needs. No DOM, controller wiring, or
"CHANGE THE RULES" control exists yet — that is the next slice. Reusing this
document's own carve-out in "Scope exclusions" above, Advanced is the sole
place `H`, `a`, and a separate braking magnitude `b` become visitor-adjustable
and asymmetric; everything else excluded there (no mass/motor/jerk/lag/noise
modeling) still holds.

### Parameters and validation

- `H`: shaft height (m), same role as Beginner's `H`.
- `a`: acceleration limit (m/s²) — the maximum rate the elevator can speed up
  at, same role as Beginner's `a`.
- `b`: braking magnitude (m/s²) — the maximum rate the elevator can slow down
  at. Independent of `a`; Beginner is the special case `b = a`.
- All three: finite and `> 0`, validated by a new `assertValidAdvancedModel`
  in `src/model/elevator.ts`, mirroring `assertValidModel`'s existing
  discipline exactly (throws `RangeError` on the first invalid field, no
  clamping).
- `p`: the visitor's chosen switch point, expressed the same way as
  Beginner's — percent of `H` at which the switch from accelerating to
  braking happens (`s(p) = (p/100)·H`, identical formula to Beginner). Unlike
  Beginner, `p` is **not** integer-constrained: `assertValidAdvancedPercentage`
  requires only finite and `1 ≤ p ≤ 100`, real-valued. This is necessary
  because Advanced's optimal switch point is generally irrational (see
  below) and an integer grid could never reach it.
- `DEFAULT_ADVANCED_MODEL = { H: 10, a: 1.5, b: 1.5 }` — identical numbers to
  Beginner's `DEFAULT_MODEL`, so Advanced starts exactly where Beginner left
  off before the visitor changes anything.

### Verified asymmetric formulas

Derived from the same two-phase kinematics as Beginner's model, generalised
so the braking phase uses `b` instead of `a`, and independently cross-checked
by confirming each reduces to Beginner's exact formula when `b = a`:

```
s(p) = (p/100)·H                     switch distance (unchanged from Beginner)
t1(p) = √(2s/a)                      switch time (accel phase depends on a only)
v1(p) = √(2a·s) = a·t1(p)            speed at the switch

x_stop(p) = s + a·s/b = s·(1 + a/b)  final stop position (reduces to 2s when b=a)
t2(p) = v1(p)/b                      braking-phase duration
T(p)  = t1(p) + t2(p)                total physical stopping time
```

`x_stop(p)` generalises Beginner's `stopPosition(p) = 2s(p)`: braking at rate
`b` instead of `a` covers a different distance (`a·s/b`, from `v1² = 2a·s` and
`distance = v1²/(2b)`) to shed the same speed `v1`, so the two phases are no
longer symmetric around `s`.

The optimal switch point solves `x_stop(p) = H` exactly:

```
p* = 100·b/(a+b)          optimal switch percentage
s* = H·b/(a+b)             optimal switch distance
v* = √(2abH/(a+b))         optimal switch speed
T* = √(2H(a+b)/(ab))       minimum valid time
```

Each reduces to Beginner's verified value at `b = a`: `p* = 50`, `s* = H/2`,
`v* = √(aH)`, `T* = 2√(H/a)` — checked as an explicit test case, not assumed.

H-crossing (only possible when `x_stop(p) > H`, i.e. overshoot), braking at
rate `b` instead of `a`:

```
v(H,p)      = √(2a·s − 2b·(H−s))         real-valued only for x_stop(p) ≥ H
t_Hcross(p) = t1(p) + (v1(p) − v(H,p))/b  defined only for x_stop(p) > H
```

Both reduce to Beginner's `v(H,p) = √(2a(2s−H))` and
`t_Hcross(p) = t1(p) + (v1(p)−v(H,p))/a` at `b = a`.

### Classification and the non-integer-optimum problem

Beginner's classification needs no tolerance because `p=50` is exactly
representable and `stopPosition(model,50)` is bit-exact in IEEE-754 for this
model's numbers (see "Verified model and formulas" above). Advanced cannot
inherit that for free: `p*` is generally irrational, so even a value set
*exactly* to `p*` will not always round-trip through
`s(p) → x_stop(p)` back to a bit-exact `H` — floating-point arithmetic
accumulates rounding error across the division and two multiplications, even
though the algebra is exact.

Resolution (an explicit, tested policy — not a hidden epsilon):

- `classifyAdvanced(model, p)` compares `x_stop(p)` to `H` with a fixed
  tolerance of `1e-9` metres: `short` if `x_stop(p) < H − 1e-9`, `correct` if
  `|x_stop(p) − H| ≤ 1e-9`, `overshoot` if `x_stop(p) > H + 1e-9`.
- `1e-9` m is chosen because it sits comfortably between two bounds: it is
  many orders of magnitude larger than the floating-point rounding error this
  model's arithmetic actually produces (empirically ~1e-14–1e-13 m at
  `H` around 10 m), so it never misclassifies a genuinely short or
  overshooting attempt as correct; and it is many orders of magnitude
  smaller than the displayed precision (two decimal places, i.e. ≥0.01 m), so
  it is visually indistinguishable from exact on screen.
- This tolerance exists solely to make the snap-triggered exact case
  classify as `correct` reliably; `short` and `overshoot` remain ordinary
  `<`/`>` comparisons around it, unchanged in spirit from Beginner.
- Reaching `correct` through ordinary slider/keyboard/numeric input alone is
  expected to be rare to the point of practical impossibility for a generic
  irrational `p*` — that is disclosed, not hidden. The intended way most
  visitors will see `correct` in Advanced is a `[Slice 5]` "MATCH THE FASTEST
  VALID BRAKE POINT" action, offered only after Reveal, that sets the
  visitor's control to the analytic `p*` in one non-silent step, without
  moving it at any other time. This mirrors how Beginner's `p=50` is
  trivially reachable by design; Advanced makes the equivalent reachable by
  an explicit action rather than by chance.
- Because these are pure, stateless functions, there is nothing to
  "invalidate" at this layer — every call recomputes from the current `H`,
  `a`, `b`. Discarding a *previously displayed* hint value or marker when the
  visitor changes a parameter is a Slice 5 controller/DOM concern, out of
  scope for this model-only slice.

### Displayed rounding and input step (forward contract for Slice 5)

- Displayed numbers (`p`, `s`, `v`, `T`, `H`, `a`, `b`) reuse the existing
  `formatNumber` two-decimal trim convention from `src/scripts/elevator-view.ts`
  — no new formatting function.
- Slice 5's `p` control (range input, numeric input, and keyboard step) uses
  a step of `0.1` percentage points — finer than Beginner's integer step,
  because Advanced's optimum is generally non-integer, but still a tidy,
  displayable grid for manual exploration. Reaching the exact optimum by
  manual stepping is not expected or required; see "MATCH THE FASTEST VALID
  BRAKE POINT" above for the reliable path to `correct`.

### API surface (`src/model/elevator.ts`, extended)

New exports, matching Beginner's existing naming and validation pattern
one-for-one (each validates via `assertValidAdvancedModel` /
`assertValidAdvancedPercentage` first, throwing `RangeError`, no clamping):

```
AdvancedModel, DEFAULT_ADVANCED_MODEL, AdvancedClassification,
AdvancedAttemptResult
assertValidAdvancedModel(model)
assertValidAdvancedPercentage(p)
optimalSwitchPercentage(model)      → p*
optimalSwitchDistance(model)        → s*
optimalSwitchSpeed(model)           → v*
optimalTime(model)                  → T*
switchDistanceAdvanced(model, p)    → s(p)
stopPositionAdvanced(model, p)      → x_stop(p)
switchTimeAdvanced(model, p)        → t1(p)
switchSpeedAdvanced(model, p)       → v1(p)
stopTimeAdvanced(model, p)          → T(p)
classifyAdvanced(model, p)          → "short" | "correct" | "overshoot"
speedAtTargetAdvanced(model, p)     → v(H,p), only for overshoot, else undefined
crossingTimeAdvanced(model, p)      → t_Hcross(p), only for overshoot, else undefined
positionAtAdvanced(model, p, t)     → position at physical time t (accel/brake phases)
velocityAtAdvanced(model, p, t)     → velocity at physical time t
buildAdvancedAttemptResult(model, p) → AdvancedAttemptResult
```

`AdvancedAttemptResult` mirrors Beginner's `AttemptResult` union shape
exactly, except every branch's `p` is `number` (not a literal `50` on the
`correct` branch) — Advanced's optimum is not a fixed constant.

### Advanced model tests (this slice)

`[Approved design decision]` for every item below. All are pure-function
tests in `src/model/elevator.test.ts` (or a co-located extension) — no DOM,
no Astro Container, no controller state.

1. `assertValidAdvancedModel` and `assertValidAdvancedPercentage` throw
   `RangeError` on non-finite, non-positive (for `H`/`a`/`b`), or
   out-of-`[1,100]` (for `p`) inputs, and accept non-integer `p` (unlike
   Beginner's `assertValidPercentage`).
2. At `b = a` (any positive value, not just the default), every new formula
   equals its Beginner counterpart exactly: `optimalSwitchPercentage` = `50`,
   `optimalSwitchDistance` = `H/2`, `optimalSwitchSpeed` =
   `switchSpeed(model, 50)`, `optimalTime` = `stopTime(model, 50)`, and
   `classifyAdvanced(model, p)` agrees with `classify(p)` for representative
   short/correct/overshoot `p` values.
3. For an explicitly asymmetric case (`H=10, a=1.5, b=2`, computed
   independently with Node before being written into the test, not by hand):
   `optimalSwitchPercentage ≈ 57.142857`, `optimalSwitchDistance ≈ 5.714286`,
   `optimalSwitchSpeed ≈ 4.140393`, `optimalTime ≈ 4.830459` (standard
   floating-point closeness for these irrational values, per "Verified model
   and formulas" above — test precision, not a visitor-facing tolerance).
   The same computation confirms `x_stop(p*)` lands within `~2e-15` m of `H`
   for this case — four orders of magnitude inside the `1e-9` m tolerance
   above, with room to spare.
4. `classifyAdvanced` returns `short` for `p` strictly below `p*` by more
   than the `1e-9` m tolerance in stopping position, `overshoot` strictly
   above it, and `correct` at `p = optimalSwitchPercentage(model)` itself —
   for the same asymmetric case, proving the tolerance does its one job
   without a wider test (e.g. `p* + 5` percentage points away) also
   registering as `correct`.
5. `speedAtTargetAdvanced` and `crossingTimeAdvanced` are `undefined` for
   `short` and `correct` classifications and return a positive, finite value
   for `overshoot`, matching Beginner's existing `undefined`-shape contract.
6. `buildAdvancedAttemptResult` returns the correctly shaped branch (by
   `classification`) with all Beginner-equivalent fields present, for one
   `short`, one `correct` (via the snap-equivalent exact `p*`), and one
   `overshoot` case.
7. `positionAtAdvanced`/`velocityAtAdvanced` match `positionAt`/`velocityAt`
   exactly at `b = a`, and satisfy the same boundary identities as Beginner's
   (`t=0` → position `0`, velocity `0`; `t=t1(p)` → the switch state; `t=`
   total stop time → the final state) for the asymmetric case.

## Advanced mode in Play (approved)

`[Approved design decision]`. Extends "Advanced mode model and contract"
above with the DOM, controller, and lifecycle contract that section deferred.
Reuses the Beginner Play interface's own existing patterns — "First UI slice,"
"Second UI slice," and "Third UI slice — Hint and Reveal" — rather than
inventing new ones: same predict → run → result → retry loop, same retained-
node lifecycle discipline, same Hint/Reveal shape, same rAF session-relative
timestamp handling.

### CHANGE THE RULES: gating and transition

- The Beginner Result section gains a second button alongside the existing
  Retry: `<button type="button" data-testid="change-rules-button">CHANGE THE
  RULES</button>`, present in every Result render from the very first
  completed Beginner attempt onward (Result never exists before the first
  attempt, so "available only after the first completed attempt," the saved
  plan's own phrase, is simply every Result this button's markup is built
  alongside — there is no separate later unlock step to gate).
- Clicking it: the Result section is removed exactly as Retry would remove
  it, but the retained Beginner Predicting element is discarded outright
  (never reattached) instead of being restored, `resetHint()`/the Beginner
  hint DOM are irrelevant and simply discarded with it, and a freshly built
  Advanced Predicting subtree (see below) is constructed and mounted into the
  same `[data-testid="elevator-app"]` root.
- This is a one-way, in-place mode switch for the remainder of the page's
  lifetime — no control to switch back to Beginner exists in this slice,
  matching the saved plan's own wording ("switches the same Play interface in
  place to Advanced — no navigation, no new route"); a return path is out of
  scope, not an oversight.
- Focus moves to a new `<h2 data-testid="advanced-heading" tabindex="-1">` —
  every transition in this interface has an explicit, tested focus
  destination (Run → Result section, Retry → range input, and now CHANGE THE
  RULES → the new mode's own heading, announcing the switch itself).
- Advanced's Result section never renders a `change-rules-button` — there is
  no further mode to switch to.

### Why Advanced's Predicting subtree is JS-built, not server-rendered

"DOM wiring and lifecycle" requires Beginner's Predicting subtree to be
authored once in `play.astro` and only ever retained, never JS-built from
nothing. Advanced cannot follow that rule the same way: it does not exist in
the server-rendered page at all, and is only ever reachable after a visitor
action. Its Predicting subtree is therefore built once via
`document.createElement`/`textContent` (never `innerHTML`) at CHANGE THE
RULES time, and from that point on is retained and detach/reattached across
Run → Retry cycles exactly like Beginner's — the "retained node, never
rebuilt" discipline still holds from the moment Advanced exists; only its
very first construction differs, for the reason above.

### Advanced controller (`src/scripts/elevator-advanced-controller.ts`, new)

Mirrors `elevator-controller.ts` one-for-one, parameterised by
`AdvancedModel` instead of the fixed `DEFAULT_MODEL`, with one addition
(`setAdvancedModel`) Beginner has no equivalent of, since Beginner's `H`/`a`
are fixed:

```ts
export type AdvancedPredictingState = {
  readonly phase: "predicting"
  readonly model: AdvancedModel
  readonly p: number
  readonly result: null
}
export type AdvancedRunningState = {
  readonly phase: "running"
  readonly model: AdvancedModel
  readonly p: number
  readonly result: AdvancedAttemptResult
}
export type AdvancedResultState = {
  readonly phase: "result"
  readonly model: AdvancedModel
  readonly p: number
  readonly result: AdvancedAttemptResult
}
export type AdvancedUIState = AdvancedPredictingState | AdvancedRunningState | AdvancedResultState

export const initialAdvancedUIState: AdvancedPredictingState = {
  phase: "predicting",
  model: DEFAULT_ADVANCED_MODEL,
  p: 35,
  result: null,
}

export function setAdvancedPercentage(state: AdvancedUIState, p: number): AdvancedPredictingState
export function setAdvancedModel(state: AdvancedUIState, model: AdvancedModel): AdvancedPredictingState
export function runAdvanced(state: AdvancedUIState): AdvancedRunningState
export function completeAdvancedRun(state: AdvancedUIState): AdvancedResultState
export function retryAdvanced(state: AdvancedUIState): AdvancedPredictingState
```

- `setAdvancedPercentage` — valid only in `"predicting"`; validates `p` via
  `assertValidAdvancedPercentage` (`RangeError` on an invalid value); returns
  a `AdvancedPredictingState` with the same `model`, matching
  `setPercentage`'s existing shape one-for-one. Called on `Running`/`Result`,
  throws `Error` naming the rejected transition, never `RangeError`.
- `setAdvancedModel` — valid only in `"predicting"`; validates `model` via
  `assertValidAdvancedModel`; returns a `AdvancedPredictingState` with the new
  `model` and the same `p` unchanged. `p` never needs re-validating on a
  model change: it is always a percentage of `H` in `1..100`, valid for any
  positive `H`/`a`/`b`. Called on `Running`/`Result`, throws `Error` naming
  the rejected transition.
- `runAdvanced` — valid only in `"predicting"`; snapshots `model` and `p`,
  computes `buildAdvancedAttemptResult(model, p)` into the returned
  `AdvancedRunningState.result` up front, matching Beginner's `run`. Called
  on `Running`/`Result`, throws `Error` naming the rejected transition.
- `completeAdvancedRun` — valid only in `"running"`; forwards the
  already-computed `result`/`model`/`p` unchanged into an
  `AdvancedResultState`. Called on `Predicting`/`Result`, throws `Error`
  naming the rejected transition.
- `retryAdvanced` — valid only in `"result"`; returns an
  `AdvancedPredictingState` with both `model: state.model` and `p: state.p`
  preserved exactly — not just `p` as Beginner does, since Advanced's model
  is itself visitor-adjusted state that a fresh attempt should not silently
  discard. Called on `Predicting`, throws `Error` naming the rejected
  transition.
- Every phase-transition error is `Error`, never `RangeError`, identifying
  the rejected transition and phase — the same discipline as every other
  controller in this document.

### Hint/Reveal reuse and the two new pure helpers it needs

Advanced reuses `HintState`/`showConceptualHint`/`revealFastestValid`/
`resetHint` from `src/scripts/elevator-hint.ts` completely unchanged — that
module already validates nothing model-specific, so it needs no Advanced
variant. Two small additions are needed, both because Beginner's existing
equivalents are hard-coded to Beginner's integer-only percentage contract or
fixed copy:

```ts
// src/scripts/elevator-hint.ts
export function buildAdvancedHintComparison(p: number, fastestValidP: number): HintComparison
```

- Identical to `buildHintComparison` in every respect (including the exact
  `matches = p === fastestValidP` equality and the `differenceLabel` rules),
  except it validates `p` via `assertValidAdvancedPercentage` (real-valued,
  `1..100`) instead of `assertValidPercentage` (integer-only) — Advanced's
  `p` is generally not an integer, so reusing `buildHintComparison` directly
  would reject most valid Advanced attempts with a spurious `RangeError`.
  `fastestValidP` validation is unchanged (`assertValidFastestValidP`,
  already real-valued, needs no Advanced variant).
- `matches` is exact-equality for the same reason already given in "Third UI
  slice — Hint and Reveal": reachable in practice essentially only via the
  MATCH action below, which sets `p` to a bit-identical copy of
  `optimalSwitchPercentage(model)` — this is disclosed, not a defect.

```ts
// src/scripts/elevator-view.ts
export function advancedConceptualHint(model: AdvancedModel): string
```

- Beginner's conceptual hint is fixed copy (`COPY.hintConceptual`) because
  Beginner's `a`/`b` relationship never changes. Advanced's conceptual hint
  keeps the same core reminder and appends one relationship-specific
  sentence, satisfying the saved plan's "Advanced's conceptual hint responds
  to the `a`/`b` relationship: weaker braking → brake earlier; stronger
  braking → brake later; balanced limits → balanced/halfway guidance":
  - `model.a === model.b` → `"${COPY.hintConceptual} Braking is exactly as
    strong as accelerating here, so the switch should land exactly halfway."`
  - `model.a > model.b` (braking weaker than accelerating) → `"${COPY.hintConceptual}
    Braking is weaker than accelerating here, so the switch should happen
    earlier than halfway."`
  - `model.a < model.b` (braking stronger than accelerating) → `"${COPY.hintConceptual}
    Braking is stronger than accelerating here, so the switch can happen
    later than halfway."`
  - None of "weaker"/"stronger"/"earlier"/"later"/"halfway"/"accelerating"/
    "braking" is in the forbidden vocabulary list in "Audience and
    progressive disclosure."
  - This is a pure function of `model` alone, called fresh every time the
    conceptual hint is shown — it is never stale, because it is never cached
    across a parameter change; there is nothing to invalidate here (compare
    to the revealed marker/value below, which is cached in the DOM and does
    need explicit invalidation).

### `resultViewAdvanced` and `runningReadoutAdvanced` (`elevator-view.ts`)

Mirror `resultView`/`runningReadout` exactly, retyped against
`AdvancedAttemptResult`/`AdvancedModel` and using `positionAtAdvanced`/
`velocityAtAdvanced`/`switchTimeAdvanced` in place of their Beginner
counterparts. The only substantive difference: Beginner's shared fields
render `` `${result.p}%` `` directly because Beginner's `p` is always an
integer; Advanced's shared fields render `` `${formatNumber(result.p)}%` ``,
since Advanced's `p` is generally not. `HEADINGS`/`EXPLANATIONS` copy is
reused unchanged — the classification and its plain-language explanation
don't depend on which mode produced it.

### Advanced Predicting markup (built once, at CHANGE THE RULES time)

All new elements below use distinct, `advanced`-prefixed `data-testid`s —
never reusing Beginner's own testids for a different element — because
nothing about the mutual-exclusivity argument that lets Predicting/Running
share testids with each other (they are never both live) applies to Beginner
vs. Advanced: Beginner's subtree is discarded, not merely detached, so
reusing its testids would just be confusing, not incorrect, but distinct
names keep every test's intent unambiguous.

- `<h2 data-testid="advanced-heading" tabindex="-1">` — heading copy (new
  `COPY.advancedHeading`).
- `<p data-testid="advanced-task">` — task copy (new `COPY.advancedTask`),
  explaining that `H`, `a`, and `b` are now adjustable, in the same plain,
  non-technical register as Beginner's task copy, and consistent with "Scope
  exclusions": `a`/`b` are described as how fast the elevator can speed up
  and slow down, never as force, motor power, or mass.
- A shaft (`data-testid="advanced-shaft"`) with `advanced-target-marker`,
  `advanced-braking-marker`, and `advanced-car` (at position `0`), projected
  with `projectToShaftPercent`/`shaftDomain(model)` exactly like Beginner's,
  recomputed whenever `model` changes (Beginner's shaft never needs this
  because its `model` never changes).
- Three labelled `type="number"` inputs — `advanced-h-input`
  (`min=5 max=20 step=1`, initial `10`), `advanced-a-input`
  (`min=0.5 max=3 step=0.1`, initial `1.5`), `advanced-b-input`
  (`min=0.5 max=3 step=0.1`, initial `1.5`). These bounds/steps are a UI
  affordance only, not a model constraint — `assertValidAdvancedModel`
  itself accepts any finite positive value — chosen to keep the visible
  range small enough to explore meaningfully in a slider-free numeric input.
  No separate readout span is added for these three: unlike a range input, a
  number input already visibly displays its own value.
- The percentage control: `<input type="range" data-testid=
  "advanced-percentage-input" min="1" max="100" step="0.1">` paired with a
  synchronized editable `<input type="number" data-testid=
  "advanced-percentage-number-input" min="1" max="100" step="0.01">` — see
  "Advanced precise braking input (correction)" below, which supersedes the
  read-only `advanced-percentage-value` span this paragraph originally
  specified and the "not added in this slice" framing that went with it.
- `<button type="button" data-testid="advanced-run-button">Run</button>`
  (reuses `COPY.runButton` text).
- `<div data-testid="advanced-hint">` containing exactly
  `<button type="button" data-testid="advanced-hint-button">STUCK? GET A
  HINT.</button>` initially (reuses `COPY.hintButton` text) — same shape as
  Beginner's `hint` container, distinct testids.

### Advanced Hint/Reveal wiring

- Clicking `advanced-hint-button` (`showConceptualHint`): removes itself,
  appends `<p data-testid="advanced-hint-conceptual" tabindex="-1">` whose
  text is `advancedConceptualHint(model)` computed from the **current**
  model at click time, and
  `<button type="button" data-testid="advanced-reveal-button">REVEAL THE
  FASTEST VALID BRAKING POINT</button>` (reuses `COPY.revealButton` text).
  Focus moves to `advanced-hint-conceptual`, exactly like Beginner.
- Clicking `advanced-reveal-button` (`revealFastestValid`): removes itself;
  appends `<p data-testid="advanced-hint-revealed" tabindex="-1">` reading
  `` `The fastest valid braking point is ${formatNumber(optimalSwitchPercentage(model))}%
  of the way to the target.` `` (computed from the current model, unlike
  Beginner's fixed `50`), a
  `<div data-testid="advanced-fastest-valid-marker" class="marker
  marker-fastest-valid">` appended to `advanced-shaft` at
  `projectToShaftPercent(optimalSwitchDistance(model), shaftDomain(model))`,
  and a new
  `<button type="button" data-testid="advanced-match-button">MATCH THE
  FASTEST VALID BRAKE POINT</button>` — the action named and justified in
  "Classification and the non-integer-optimum problem" above. Focus moves to
  `advanced-hint-revealed`. The reveal never moves the visitor's own
  percentage input/braking marker — only the new elements above are added,
  matching Beginner's reveal exactly.
- Clicking `advanced-match-button`: calls `setAdvancedPercentage(state,
  optimalSwitchPercentage(model))` and re-renders the percentage input,
  `advanced-percentage-value`, and `advanced-braking-marker` exactly as an
  ordinary percentage change would — the same render path, just fed an
  analytically-derived `p` instead of one read from the slider. Unlike
  `advanced-hint-button`/`advanced-reveal-button`, `advanced-match-button` is
  **not** removed on click and carries no explicit focus management: it is a
  repeatable, idempotent action (clicking it again lands on the same `p*`
  again, since `model` has not changed), not a one-shot reveal, so there is
  no DOM node being removed out from under the browser's own default
  post-click focus retention.
- Because `optimalSwitchPercentage(model)` does not depend on `p`, changing
  the percentage input alone never invalidates a revealed hint — the exact
  same reasoning "Third UI slice — Hint and Reveal" already gives for
  Beginner's fixed `fastestValidP`, just now justified by "the optimum is a
  function of `model` only" rather than "the optimum is a fixed constant."
  `advanced-match-button` changing `p` for the same reason does not reset
  the hint either.
- Changing `advanced-h-input`/`advanced-a-input`/`advanced-b-input` (`input`
  event), after a first defensive check described below, calls
  `setAdvancedModel` **and** resets the hint UI to its single-
  `advanced-hint-button` initial state (removing `advanced-hint-conceptual`/
  `advanced-reveal-button`/`advanced-hint-revealed`/`advanced-match-button`/
  `advanced-fastest-valid-marker`, calling `resetHint()`) — this is the
  concrete realisation of the saved plan's "parameter changes reset any
  stale attempt result and revealed optimum safely": Predicting's own
  `result` is always `null` already, so the only thing that can go stale on
  a model change is a previously revealed `p*`/marker, computed for a model
  that no longer exists.
- Defensive input check (new to this slice; Beginner's range input can never
  produce this class of problem because a browser range input's value is
  always already clamped to a valid number): on `input` for the three
  `type="number"` fields, the DOM layer only calls `setAdvancedModel` when
  `Number.isFinite(value) && value > 0` for the changed field — an
  in-progress edit (e.g. a field the visitor has temporarily cleared while
  retyping it) leaves the last valid model in force rather than throwing a
  `RangeError` out of an event handler. `assertValidAdvancedModel` remains
  the authoritative guard against a directly-constructed invalid call —
  this check exists only so a transient, incomplete keystroke never crashes
  the page, the same "controller enforces it independently of whatever the
  UI happens to render" principle already stated in the First UI slice
  contract, applied to a new failure mode Beginner's UI could never hit.

### Advanced Retry-reset policy

Identical in shape to Beginner's: on Retry, the hint container resets to its
single-`advanced-hint-button` state via the same reset routine as a model
change above, the retained Advanced Predicting element's percentage input/
span/braking-marker update to the preserved `p` (`renderPercentage`-
equivalent), and — unlike a model change — `advanced-h-input`/
`advanced-a-input`/`advanced-b-input` are **not** touched, because
`retryAdvanced` preserves `model` unchanged; Retry is a fresh attempt at the
same rules, not a rules reset. Focus moves to `advanced-percentage-input`,
never to `advanced-h-input`/`advanced-a-input`/`advanced-b-input` or the
reset hint button, mirroring Beginner's "focus moves to the range input"
rule exactly.

### Advanced precise braking input (correction)

A manual review after the slice above found the MATCH action alone was not
enough: a visitor who wants to type the exact optimum rather than click MATCH
had no way to. This corrects that, in Advanced only — Beginner's percentage
control (range input, read-only percentage span, integer step `1`, integer
model contract) is untouched by everything below.

- `advanced-percentage-value` (the read-only `<span>`) is removed. In its
  place: `<input type="number" data-testid="advanced-percentage-number-input"
  min="1" max="100" step="0.01">`, wrapped in a `<label>` whose text names the
  control (e.g. "Exact braking percentage"), immediately followed by a
  sibling `<span aria-hidden="true">%</span>` inside the same label — visible
  to sighted visitors as the unit, not read twice by a screen reader since the
  label's own accessible name already says "percentage" and the `%` glyph is
  hidden from the accessibility tree.
- `step="0.01"` here, not the range's `0.1`: the two controls serve different
  purposes. The range's `0.1` step is a drag granularity affordance from
  "Displayed rounding and input step" above; the number input's step must
  instead match that same section's two-decimal display precision
  (`formatNumber`), so that typing exactly what `advanced-hint-revealed`
  displays (e.g. `33.33`) is always a valid, in-step value — not rejected or
  silently rounded by the browser's own step-mismatch validation. This does
  not change "Displayed rounding and input step" itself, only extends it to a
  second control with a legitimately different granularity need.
- Bidirectional sync, both routed through the model layer exactly like the
  existing range input (never a raw DOM-to-DOM copy): dragging the range
  calls `setAdvancedPercentage` and then updates the number input's `.value`
  to `formatNumber(p)`, the braking marker, and (unchanged) never resets the
  hint. Typing in the number input calls `setAdvancedPercentage` and then
  updates the range's `.value` and the braking marker, but never rewrites its
  own `.value` from inside its own `input` handler — overwriting a field
  while its own keystroke is still being processed would fight the visitor's
  cursor and could strip characters they are mid-way through typing (e.g. a
  trailing decimal point). Programmatic updates that do not originate from the
  number input itself (Retry, `advanced-match-button`, an `H`/`a`/`b` change)
  continue to write `formatNumber(p)` into it, exactly as they already do for
  the range input.
- Transient empty/invalid/out-of-range text policy, decided before any test
  or implementation: on the number input's `input` event, the DOM layer calls
  `setAdvancedPercentage` only when the current text is non-empty and
  `Number.isFinite(value) && value >= 1 && value <= 100`. An empty field (the
  visitor has just cleared it while retyping), non-numeric text, or a number
  outside `[1, 100]` is never forwarded to the model and never clamped by the
  UI either — the last valid `p` simply stays in force, the same "controller
  enforces validity independently of whatever the UI happens to render"
  principle the three `H`/`a`/`b` number inputs already rely on in "Defensive
  input check" above, applied to a fourth field with the same failure mode.
  `assertValidAdvancedPercentage` remains the authoritative guard against a
  directly-constructed invalid call; this check exists only so a transient,
  incomplete keystroke never reaches it.
- Changing the percentage via the number input alone does not invalidate a
  revealed optimum, for the identical reason the range input doesn't:
  `optimalSwitchPercentage(model)` depends on `model`, not `p`. Changing
  `H`/`a`/`b` continues to invalidate immediately and unconditionally, via the
  unchanged `handleAdvancedModelFieldChange` path.
- `advanced-percentage-number-input` is rendered (via the shared
  `renderAdvancedPercentage`) everywhere `advanced-percentage-input` already
  is — initial mount, `advanced-match-button`, Retry, an `H`/`a`/`b` change —
  so the two controls can never visibly disagree except while the number
  input is mid-edit by the visitor typing into it.

### Advanced Running and Result

- Running reuses the exact rAF architecture in "Animation architecture"
  above unchanged in every particular that matters for correctness,
  including the per-session `sessionStartTimestamp` established from the
  first callback's own timestamp argument (never the raw document-timeline
  value) — substituting `stopTimeAdvanced(model, p)` for `stopTime`,
  `positionAtAdvanced`/`velocityAtAdvanced` for `positionAt`/`velocityAt`,
  and `runningReadoutAdvanced` for `runningReadout`. The reduced-motion check
  (`matchMedia("(prefers-reduced-motion: reduce)")`, read once at Run time)
  is the identical check, reused verbatim.
- Running-phase testids: `advanced-running` (section), reusing
  `advanced-shaft`/`advanced-target-marker`/`advanced-braking-marker`/
  `advanced-car` (mutually exclusive with Predicting's use of the same
  testids, exactly as Beginner's Running/Predicting shaft sharing already
  works), `advanced-running-position`, `advanced-running-velocity`,
  `advanced-running-cue`.
- Result reuses `resultViewAdvanced`/`buildAdvancedHintComparison` the same
  way Beginner's Result reuses `resultView`/`buildHintComparison`: a
  `<section data-testid="advanced-result" tabindex="-1" aria-live="polite"
  aria-atomic="true">` (no `role="status"`, matching "Result region
  semantics" exactly), an `advanced-result-shaft` mirroring Beginner's
  `result-shaft` (target/braking markers, car, `data-outcome`), the mapped
  heading/explanation/fields (`data-field` values identical to Beginner's:
  `percentage`, `finalPosition`, `finalVelocity`, `elapsedTime`, plus
  `shortfall` or `velocityAtTarget` as appropriate — safe to reuse since
  Beginner's own `result` container no longer exists anywhere in the
  document by the time Advanced's exists), an `advanced-hint-comparison`
  block (fields `yourBrake`/`fastestValid`/`hintDifference`, values formatted
  with `formatNumber` since Advanced's numbers are generally non-integer,
  unlike Beginner's raw-literal template) when the hint was `"revealed"` at
  Run time, built from `buildAdvancedHintComparison(p,
  optimalSwitchPercentage(model))`, and an `advanced-retry-button` (reusing
  `COPY.retryButton` text) — **no** `change-rules-button`.
- On `advanced-retry-button`: identical shape to Beginner's Retry handler —
  remove the Result section, run the Advanced retry-reset policy above,
  reattach the retained Advanced Predicting element, focus
  `advanced-percentage-input`.

### Advanced Hint/Reveal and Result tests (this slice)

`[Approved design decision]` for every item below, extending "Hint and
Reveal tests" and "Running-phase and animation tests" above to Advanced.

1. `setAdvancedPercentage`/`setAdvancedModel`/`runAdvanced`/
   `completeAdvancedRun`/`retryAdvanced` each succeed only from their
   required phase and throw `Error` (never `RangeError`) naming the rejected
   transition from every other phase; `setAdvancedModel` additionally throws
   `RangeError` (via `assertValidAdvancedModel`) on an invalid model,
   independent of phase-guard behaviour.
2. `retryAdvanced` preserves both `model` and `p` unchanged from the
   `AdvancedResultState` it is called on — not just `p`.
3. `buildAdvancedHintComparison` accepts a representative non-integer `p`
   (e.g. `57.142857142857146`) that `buildHintComparison` would reject, and
   otherwise matches `buildHintComparison`'s `differenceLabel`/`matches`
   rules exactly at equivalent inputs.
4. `advancedConceptualHint` returns three distinguishable strings across
   `a===b`, `a>b`, `a<b`, none containing forbidden vocabulary.
5. The Beginner Result section renders both `retry-button` and
   `change-rules-button` from the first completed attempt onward.
6. Clicking `change-rules-button` leaves no Beginner-associated testid
   (`predicting`, `result`, `hint`, or any of their descendants) anywhere in
   `[data-testid="elevator-app"]`, mounts `advanced-predicting`'s full
   initial markup (single `advanced-hint-button`, no
   `advanced-fastest-valid-marker`), and moves focus to `advanced-heading`.
7. Advanced's initial shaft/marker positions match
   `projectToShaftPercent`/`shaftDomain(DEFAULT_ADVANCED_MODEL)`.
8. Changing `advanced-a-input` (or `-b-input`/`-h-input`) after a reveal
   removes `advanced-hint-conceptual`/`advanced-reveal-button`/
   `advanced-hint-revealed`/`advanced-match-button`/
   `advanced-fastest-valid-marker` and restores the single
   `advanced-hint-button`; an in-progress empty edit of that same field does
   not throw and leaves the prior valid model (and therefore the reveal, if
   any) intact.
9. Changing `advanced-percentage-input` alone after a reveal does **not**
   reset the hint.
10. After reveal, `advanced-hint-revealed`'s text and
    `advanced-fastest-valid-marker`'s position match
    `optimalSwitchPercentage`/`optimalSwitchDistance` for the current model
    exactly (formatted via `formatNumber`).
11. Clicking `advanced-match-button` sets `advanced-percentage-input`/
    `advanced-percentage-value`/`advanced-braking-marker` to the current
    `optimalSwitchPercentage(model)`, does not remove or alter
    `advanced-hint-revealed`/`advanced-fastest-valid-marker`/itself, and is
    idempotent across two consecutive clicks.
12. With reduced motion stubbed `true`, running Advanced to completion for
    one `short` `p`, one `overshoot` `p`, and one `correct` `p` (reached via
    `advanced-match-button` before Run) each yield an `advanced-result`
    matching `resultViewAdvanced(buildAdvancedAttemptResult(model, p))`;
    the `correct` case is verified independent of any fixed-timestep/render-
    timing assumption, consistent with this repo's rule against classifying
    boundary events from animation frames.
13. Running to completion after a reveal yields an `advanced-hint-comparison`
    matching `buildAdvancedHintComparison(p, optimalSwitchPercentage(model))`
    exactly; running without ever revealing yields no
    `advanced-hint-comparison` element.
14. Across at least two consecutive Run → Retry cycles in Advanced: `model`
    (visible via the three number inputs' preserved values) survives
    unchanged, `p` is preserved (not reset to `35`), the hint container
    resets each time, and focus after Retry is `advanced-percentage-input`.
15. No element introduced by this slice contains forbidden vocabulary from
    "Audience and progressive disclosure."
16. Home and Principle still render no element with any `advanced`-prefixed
    `data-testid` anywhere in their built pages (regression check — this
    slice adds many such testids for the first time).

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
- The percentage-positioned car and markers (see "Shaft visual and
  coordinate system") visibly adapt to a real mid-run resize at both
  marking viewports, without restarting, changing `p`, or changing the
  eventual Result.
  `[Approved design decision]` — the CSS-percentage projection itself is
  new to this slice; the resize behaviour it must satisfy is the
  `[Published spec]` item above.
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
