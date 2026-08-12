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
