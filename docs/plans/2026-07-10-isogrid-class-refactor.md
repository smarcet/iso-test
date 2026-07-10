# IsoGrid Class Refactor Implementation Plan

Created: 2026-07-10
Author: smarcet@gmail.com
Agent: Claude Code
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** After this lands, `src/main.js`'s procedural isometric code is split into three classes matching the Game/Scene/Renderer separation from the reference chat: `IsoGrid` (pure geometry — `worldToScreen`, `screenToWorld`, `getTileAtScreenPosition`) in `src/iso-grid.js`, `Tile` (pure per-cell data — `x`, `y`, `color`, `isSelected`) in `src/tile.js`, and `Renderer` (drawing — `drawTile(tile, grid)`) in `src/renderer.js`. `main.js` is reduced to app wiring: it builds the `Tile` grid, owns the click listener and the render loop, and delegates geometry to `grid` and drawing to `renderer` — same visual output and click-to-select behavior as today.

## Out of Scope

- Camera, viewport culling, or the other extensions listed in `README.md` § 7 — not part of this refactor.
- Adding a test framework/dependency (project has no `package.json` or test runner today).
- `Tile` behavior methods (e.g. `tile.select()`) — `Tile` is pure data per user decision; `main.js` mutates `tile.isSelected` directly.
- `Renderer` methods for anything beyond tiles (no `drawEntities()`/`drawUI()` placeholders) — there's nothing else to draw yet.
- Any visual or interaction behavior change — this is a pure structural refactor.

## Approach

**Chosen:** Three single-responsibility classes, each in its own script, loaded as plain globals in `index.html`:
- `IsoGrid` (`src/iso-grid.js`) — geometry only: `worldToScreen`, `screenToWorld`, `getTileAtScreenPosition`, plus private `#isTileInsideMap`/`#isPointInsideTile` helpers. No `ctx`/canvas dependency.
- `Tile` (`src/tile.js`) — a plain data holder: `x`, `y`, `color`, `isSelected`.
- `Renderer` (`src/renderer.js`) — owns `ctx`; `drawTile(tile, grid)` calls `grid.worldToScreen(tile.x, tile.y)` to find screen position and `grid.tileW`/`grid.tileH` for the diamond size, then draws it styled by `tile.color`/`tile.isSelected`.
- `main.js` — builds a `mapHeight × mapWidth` grid of `Tile` instances, owns the render loop and the click listener, and mutates `tile.isSelected` flags based on `grid.getTileAtScreenPosition(...)`.

**Why:** Matches the Game/Scene/Renderer/Entity separation discussed in the reference chat and the README's "world is a plain grid, only the renderer/picking code knows the projection" philosophy — each class has exactly one reason to change. Cost: `main.js` now owns slightly more wiring (constructing the `Tile` grid) than a single-class design would, and every tile draw call carries the `grid` parameter so `Renderer` can convert `tile.x`/`tile.y` to screen coordinates.

**Deviation history (documented, not re-asked — all raised directly by the user mid-implementation, all applied in place):**
1. `IsoGrid.drawTile` (from the original approved 2-task plan) was removed from the class — drawing is not `IsoGrid`'s responsibility.
2. Drawing was further split into a dedicated `Renderer` class operating on a new `Tile` data class, rather than staying a plain function in `main.js`.
3. `main.js`'s `let selectedTile = null` pointer (duplicating "which tile is selected" alongside each `Tile`'s own `isSelected` field) was removed — the click handler now clears `isSelected` on every tile in `tiles` and sets it on the picked one, so `tiles` is the single source of truth for selection state.

## Context for Implementer

The project has no bundler or `<script type="module">` — `index.html` loads plain global scripts in document order: `iso-grid.js`, `tile.js`, `renderer.js`, then `main.js`. All three new classes are plain `class` declarations (no `import`/`export`); classic `<script>` top-level `class`/`const`/`let` bindings are visible to later `<script>` tags on the same page, so `main.js` can reference `IsoGrid`, `Tile`, and `Renderer` directly.

The math itself (projection matrix, its inverse, and the diamond point-in-tile test) is already verified and explained in `README.md` — this refactor must not change any formula, only where it lives. `getTileAtScreenPosition`'s 5-candidate neighbor check (`README.md` § 5.2) must be preserved exactly: it's a deliberate fix for `floor()` rounding errors near diamond edges, not a redundant safety net to simplify away.

`IsoGrid` no longer takes `ctx` in its constructor (it has no drawing/canvas concern) — `offsetX`/`offsetY` become plain constructor options that `main.js` computes from `canvas.width` itself, same as `TILE_W`/`TILE_H`/`MAP_WIDTH`/`MAP_HEIGHT`/`OFFSET_Y` do today.

## E2E Test Scenarios

### TS-001: Tile selection still works after the refactor
**Priority:** Critical
**Preconditions:** `index.html` served over a local static server (e.g. `python3 -m http.server` from the project root)
**Mapped Tasks:** Task 1, Task 2, Task 3, Task 4

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to the served `index.html` | A 10×10 isometric diamond grid renders on the dark canvas |
| 2 | Click near the center of a visible tile diamond | That tile gets a yellow-bordered highlight |
| 3 | Click a point clearly outside the diamond map (e.g. a canvas corner) | The previous highlight clears (selection resets) |

## E2E Results

| Scenario | Priority | Result | Fix Attempts | Notes |
|----------|----------|--------|---------------|-------|
| TS-001   | Critical | PASS   | 0             | Verified twice via Claude Code Chrome against `http://127.0.0.1:8935` (`python3 -m http.server 8935`): (1) pre `selectedTile`-removal — click on tile (4,4) highlighted it yellow (console logged `Tile seleccionado: (4, 4)`), click outside cleared it; (2) post `selectedTile`-removal (sweep-clear refactor) — clicked two different tiles in sequence ((0,5) then (5,5)), confirmed only the second stayed highlighted (first correctly cleared), then click outside cleared it entirely. No console errors either run. |

## Code Review Findings (xhigh, workflow-backed)

5 findings surfaced across the 5 changed files, all evaluated and none actioned — each is either pre-existing behavior that predates this refactor (and fixing it would be a behavior change explicitly excluded by `## Out of Scope`), or a deliberate design decision already documented in `README.md`/`## Context for Implementer`:

| File:Line | Finding | Verdict | Disposition |
|---|---|---|---|
| `src/main.js:69` | Re-clicking an already-selected tile doesn't toggle it off | CONFIRMED | Not fixed — identical to the pre-refactor `main.js` (re-click always re-selects); fixing it is a behavior change, which `## Out of Scope` excludes |
| `src/renderer.js:36` | Selection-highlight stroke looks asymmetric because same-pass draw order lets later tiles clip an earlier tile's shared-edge stroke | CONFIRMED | Not fixed — identical row-major draw order and stroke logic to the pre-refactor `drawTile`; the DoD required byte-identical visual output, not a rendering fix |
| `index.html:25` | `disable-anti-aliasing` CSS class + `id="canvas"` have no matching rule/JS reference — dead markup | CONFIRMED | Not fixed — pre-existing (this refactor only added `<script>` tags to `index.html`, never touched the canvas element or `<style>` block); per "orphan cleanup" this is mentioned, not silently touched |
| `src/iso-grid.js:35` | `getTileAtScreenPosition`'s 5-candidate scan duplicates geometry `screenToWorld` + `floor` could give in O(1) | PLAUSIBLE | Rejected — this is the deliberate floating-point-rounding-at-diamond-edges fallback documented in `README.md` § 5.2 and this plan's `## Context for Implementer`; the verifier's own algebraic equivalence proof holds only in exact arithmetic, not floating point, which is exactly why the fallback exists |
| `src/iso-grid.js:18` | `worldToScreen`'s `z` parameter is unused (dead today) | PLAUSIBLE | Not fixed — pre-existing (the original `worldToScreen` had the same unused `z`), intentional forward-looking API documented in `README.md` § 3 |

## Progress Tracking

- [x] Task 1: Extract geometry-only `IsoGrid` class into `src/iso-grid.js`
- [x] Task 2: Create `Tile` data class in `src/tile.js`
- [x] Task 3: Create `Renderer` class in `src/renderer.js`
- [x] Task 4: Wire `IsoGrid` + `Tile` + `Renderer` into `main.js` and `index.html`

## Implementation Tasks

### Task 1: Extract geometry-only `IsoGrid` class into `src/iso-grid.js`

**Objective:** `src/iso-grid.js` exposes a `class IsoGrid` with `worldToScreen(x, y, z = 0)`, `screenToWorld(screenX, screenY)`, and `getTileAtScreenPosition(mouseX, mouseY)` as its only public methods, plus private `#isTileInsideMap`/`#isPointInsideTile` helpers. No `drawTile` method and no `ctx`/canvas dependency — this class is pure grid geometry. The math must remain byte-for-byte identical to the original formulas (verified in `README.md` and by the original `src/main.js` functions this replaced).

**Files:**

- Modify: `src/iso-grid.js` (drop `drawTile` and the `ctx` constructor param from the first implementation pass)

**Key Decisions / Notes:**

- Constructor: `constructor({ tileW = 64, tileH = 32, mapWidth = 10, mapHeight = 10, offsetX = 0, offsetY = 80 } = {})` — no `ctx` parameter; `main.js` passes `offsetX: canvas.width / 2` explicitly (see Task 4).
- `getTileAtScreenPosition` keeps the exact 5-candidate neighbor list (self + 4 orthogonal neighbors), using `this.#isTileInsideMap` and `this.#isPointInsideTile`.
- No test framework exists in this repo — verify math parity with a one-off Node comparison script (not committed) that compares `worldToScreen`/`screenToWorld`/`getTileAtScreenPosition` output against the original formulas on at least 5 sample coordinates (including a tile-edge case) — see DoD.

**Definition of Done:**

- [x] `IsoGrid` exposes exactly the 3 public methods (`worldToScreen`, `screenToWorld`, `getTileAtScreenPosition`); no `drawTile` method exists on the class; `isTileInsideMap`/`isPointInsideTile` are not reachable from outside the instance
- [x] The Node comparison script shows zero differences against the original formulas, using `offsetX: 600` to match the original `OFFSET_X`

### Task 2: Create `Tile` data class in `src/tile.js`

**Objective:** `src/tile.js` exposes a `class Tile` that is a pure data holder for one grid cell: `x`, `y`, `color` (default `"#5ca85c"`), `isSelected` (default `false`). No methods beyond the constructor — `main.js` mutates `tile.isSelected` directly per the "pure data" decision.

**Files:**

- Create: `src/tile.js`

**Key Decisions / Notes:**

- `constructor(x, y, color = "#5ca85c", isSelected = false) { this.x = x; this.y = y; this.color = color; this.isSelected = isSelected; }` — mirrors the default tile color from the original `drawTile(x, y, color = "#5ca85c")` signature.
- `Trivial:` this is a ~6-line data class with no branches, no I/O, no error paths — covered by the same Node script extended in Task 3's DoD (constructs a `Tile` and checks its defaults) and by the browser E2E in Task 4.

**Definition of Done:**

- [x] `new Tile(3, 4)` has `{x: 3, y: 4, color: "#5ca85c", isSelected: false}`
- [x] `new Tile(1, 2, "#ff0000", true)` has `{x: 1, y: 2, color: "#ff0000", isSelected: true}`

### Task 3: Create `Renderer` class in `src/renderer.js`

**Objective:** `src/renderer.js` exposes a `class Renderer` that owns a `CanvasRenderingContext2D` and knows how to draw a single `Tile`: `drawTile(tile, grid)` computes the diamond's screen position via `grid.worldToScreen(tile.x, tile.y)`, builds the same 4-point diamond path the original `drawTile` used (sized by `grid.tileW`/`grid.tileH`), fills it with `tile.color`, and strokes it — yellow/4px when `tile.isSelected`, `#333`/1px otherwise. The drawing math must be identical to the original `drawTile` function.

**Files:**

- Create: `src/renderer.js`

**Key Decisions / Notes:**

- `constructor(ctx) { this.ctx = ctx; }` — `Renderer` is the only class touching `ctx`/Canvas 2D APIs now.
- `drawTile(tile, grid)`: same `moveTo`/3×`lineTo`/`closePath`/`fill`/`stroke` sequence as the original `drawTile`, reading `tile.color` and `tile.isSelected` instead of the old `color` param and module-level `selectedTile` comparison.
- Extend the Task 1 Node comparison script with a stub `ctx` object that records every method call + args; run `renderer.drawTile(new Tile(x, y, color, isSelected), grid)` and assert the recorded call sequence matches the original inline `drawTile` logic for a selected and an unselected tile.

**Definition of Done:**

- [x] The extended Node script's recorded `ctx` calls for `renderer.drawTile(tile, grid)` match the original `drawTile` geometry exactly for both `isSelected: true` and `isSelected: false`, for at least one non-origin tile

### Task 4: Wire `IsoGrid` + `Tile` + `Renderer` into `main.js` and `index.html`

**Objective:** `index.html` loads `iso-grid.js`, `tile.js`, `renderer.js`, then `main.js`. `main.js` builds a `grid.mapHeight × grid.mapWidth` grid of `Tile` instances, instantiates `grid = new IsoGrid({ mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT, offsetX: canvas.width / 2 })` and `renderer = new Renderer(ctx)`, and the render loop / click listener operate on `tiles` + `grid` + `renderer` instead of the old inline functions — same visual output and click-to-select behavior as before the refactor.

**Files:**

- Modify: `index.html`
- Modify: `src/main.js`

**Key Decisions / Notes:**

- `index.html`: add `<script src="src/iso-grid.js">`, `<script src="src/tile.js">`, `<script src="src/renderer.js">` immediately before the existing `<script src="src/main.js">` tag — classic scripts execute in document order.
- `src/main.js`: remove all remaining module-level `TILE_W`/`TILE_H`/`OFFSET_X`/`OFFSET_Y` constants and the old inline `worldToScreen`/`screenToWorld`/`isTileInsideMap`/`drawTile`/`isPointInsideTile`/`getTileAtScreenPosition` functions/the plain-function `drawTile` from the first implementation pass. `MAP_WIDTH`/`MAP_HEIGHT` stay as `main.js` constants.
- Build the tile grid once: `const tiles = []; for (let y = 0; y < grid.mapHeight; y++) { const row = []; for (let x = 0; x < grid.mapWidth; x++) row.push(new Tile(x, y)); tiles.push(row); }`.
- `render()`: clear canvas, then for each `tiles[y][x]` call `renderer.drawTile(tiles[y][x], grid)`.
- Click listener: on `grid.getTileAtScreenPosition(mouseX, mouseY)`, sweep every `Tile` in `tiles` and set `isSelected = false`, then if a tile was picked set `isSelected = true` on `tiles[picked.y][picked.x]` — no separate `selectedTile` pointer variable; `tiles` is the single source of truth (deviation 3, see `## Approach`). The scale-correction math for CSS-scaled canvases is unrelated to this refactor and stays as-is.
- Delete the commented-out dead code block referencing the pre-refactor bare functions — it would be a stale, misleading landmine after this refactor.

**Definition of Done:**

- [x] Opening `index.html` in a browser renders the same 10×10 diamond grid as before the refactor
- [x] Clicking a tile highlights it with the yellow selection border exactly as before; clicking outside the diamond map clears the selection
- [x] No references to the old bare `worldToScreen`/`screenToWorld`/`drawTile`/`isPointInsideTile`/`isTileInsideMap` function names, and no plain-function `drawTile`, remain in `src/main.js`
- [x] Verify: TS-001 passes end-to-end via browser automation
