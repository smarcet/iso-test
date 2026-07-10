# ADR 0001: Split the isometric engine into IsoGrid / Tile / Renderer

Status: Accepted
Date: 2026-07-10

## Context

The isometric prototype started as a single `src/main.js` file: module-level
constants (`TILE_W`, `TILE_H`, `OFFSET_X`, `OFFSET_Y`) plus free functions
(`worldToScreen`, `screenToWorld`, `isTileInsideMap`, `drawTile`,
`isPointInsideTile`, `getTileAtScreenPosition`) closing over a single
`ctx` and a module-level `selectedTile` variable.

The project's design conversation (see the
[reference ChatGPT thread](https://chatgpt.com/share/6a515285-deb4-83e9-895e-adcbf011f196),
summarized in `README.md`) had already worked out the projection math and,
separately, discussed the classic game-engine separation of concerns: **Game**
coordinates, **Scene** owns entities, **Renderer** only draws, and (later in
that conversation) **Entity** is pure data the renderer reads. When the user
asked to formalize the engine as a class, that separation became the design
target instead of a single do-everything class.

## Decision

Split `main.js` into four single-responsibility pieces, each a plain
`class`/script (no bundler, no ES modules — classic `<script>` tags in
document order in `index.html`):

- **`IsoGrid`** (`src/iso-grid.js`) — pure grid geometry. Public API:
  `worldToScreen(x, y, z = 0)`, `screenToWorld(screenX, screenY)`,
  `getTileAtScreenPosition(mouseX, mouseY)`. Private helpers
  `#isTileInsideMap`/`#isPointInsideTile`. **No `ctx`/canvas dependency** —
  configured entirely through constructor options (`tileW`, `tileH`,
  `mapWidth`, `mapHeight`, `offsetX`, `offsetY`).
- **`Tile`** (`src/tile.js`) — pure per-cell data: `x`, `y`, `color`,
  `isSelected`. No methods beyond the constructor.
- **`Renderer`** (`src/renderer.js`) — the only class that touches
  `CanvasRenderingContext2D`. `drawTile(tile, grid)` reads `tile`'s data and
  calls `grid.worldToScreen`/`grid.tileW`/`grid.tileH` for geometry.
- **`main.js`** — app wiring only: builds the `mapHeight × mapWidth` grid of
  `Tile` instances, owns the render loop and the click listener, and is the
  single source of truth for selection (see below).

This decision was reached in three steps during implementation, each an
explicit correction from the user rather than a single upfront design:

1. **Initial plan**: `IsoGrid` with 4 public methods including `drawTile`
   (matching the user's first class sketch).
2. **Correction 1** — *"drawTile no es responsabilidad de IsoGrid"*:
   `drawTile` moved out of `IsoGrid`. At this point `IsoGrid` also lost its
   `ctx` constructor parameter, since drawing was its only reason to need one.
3. **Correction 2** — *"necesitaríamos una clase Renderer que renderice la
   clase Tile"*: drawing was promoted from a plain function in `main.js` to a
   dedicated `Renderer` class operating on a new `Tile` data class, matching
   the chat's Entity/Renderer split.
4. **Correction 3** — *"esto está mal `let selectedTile = null`"*: `main.js`'s
   redundant selection pointer (duplicating "who is selected" alongside each
   `Tile.isSelected`) was removed. The click handler now sweeps `tiles` to
   clear `isSelected` and sets it on the picked cell — `tiles` is the single
   source of truth, not a separate variable.

Full task-by-task detail and verification evidence lives in
[`docs/plans/2026-07-10-isogrid-class-refactor.md`](../plans/2026-07-10-isogrid-class-refactor.md).

## Alternatives Considered

- **Single `IsoGrid` class owning geometry + drawing** (the initial plan).
  Rejected: mixes a rendering concern (canvas API calls, `ctx` lifecycle)
  into a class whose job is coordinate math, making `IsoGrid` untestable
  headlessly and harder to swap for a different renderer later (e.g. PixiJS,
  discussed in the reference chat) without touching geometry code.
- **Plain `drawTile(x, y, isSelected, color)` function in `main.js`**
  (intermediate state after correction 1). Rejected in favor of a `Renderer`
  class once tile state itself became a `Tile` object — a bare function
  taking 4 positional args doesn't scale as cleanly as `renderer.drawTile(tile, grid)`,
  and keeping `ctx` inside a class (vs. a closure variable) matches the rest
  of the codebase's style.
- **`Tile` with behavior** (e.g. `tile.select()`/`tile.deselect()`). Rejected
  per explicit user decision — `Tile` stays pure data; `main.js` mutates
  `tile.isSelected` directly. Keeps `Tile` trivially serializable and free of
  any dependency on how selection is orchestrated.

## Consequences

**Positive:**
- Each class has exactly one reason to change: geometry, data, drawing, or
  app wiring.
- `IsoGrid` is unit-testable with zero DOM/canvas — verified with a headless
  Node script comparing it against the original formulas (no test framework
  exists in this project yet; see `## Out of Scope` in the plan).
- Swapping `Renderer` for a WebGL/PixiJS-backed implementation later would
  not require touching `IsoGrid`, `Tile`, or the app-wiring logic in
  `main.js` — only `Renderer`'s internals and its constructor's `ctx` type.
- `tiles` (the `Tile` grid built in `main.js`) is the single source of truth
  for selection state; no risk of a stale pointer variable disagreeing with
  the actual per-tile flag.

**Negative / costs:**
- `main.js` owns more wiring than a single-class design would (constructing
  the `Tile` grid, passing `grid` into every `renderer.drawTile` call).
- Every draw call threads two objects (`tile`, `grid`) instead of one, since
  `Renderer` needs both the per-cell data and the shared geometry/config.
- Four files load as four `<script>` tags in a fixed order instead of one —
  fragile if that order is ever reshuffled (no bundler to catch it), though
  low-risk at the project's current size.

**Known, deliberately-not-fixed issues** (found during code review, judged
pre-existing/out-of-scope for this refactor — see the plan's `## Code Review
Findings`): clicking an already-selected tile doesn't toggle it off, the
selection highlight renders asymmetrically thick due to same-pass draw
order, and `index.html`'s `disable-anti-aliasing` CSS class has no matching
rule. All three predate this split and are unrelated to it.

## References

- [`README.md`](../../README.md) — the projection math this split organizes.
- [`docs/plans/2026-07-10-isogrid-class-refactor.md`](../plans/2026-07-10-isogrid-class-refactor.md) — implementation plan, task-by-task detail, E2E results, code review findings.
- [Reference design conversation](https://chatgpt.com/share/6a515285-deb4-83e9-895e-adcbf011f196) — origin of the Game/Scene/Renderer/Entity separation this ADR applies.
