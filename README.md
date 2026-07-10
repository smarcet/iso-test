# ISO Time!!! — Math behind the isometric engine

Minimal Canvas 2D prototype of a *Diablo/Age of Empires*-style isometric
grid: it draws a `MAP_WIDTH × MAP_HEIGHT` diamond-shaped map and lets you
pick a tile with the mouse. This document explains the math behind the
engine's two core functions (`worldToScreen` / `screenToWorld`) and tile
picking, which is the conceptual foundation that was worked out in the
project's design conversation
([reference thread](https://chatgpt.com/share/6a515285-deb4-83e9-895e-adcbf011f196)).

The code is split by responsibility, mirroring the Game/Scene/Renderer
separation from that same conversation: `src/iso-grid.js` (`IsoGrid` — pure
grid geometry, the math this document covers), `src/tile.js` (`Tile` — pure
per-cell data), `src/renderer.js` (`Renderer` — drawing), and `src/main.js`
(app wiring: the tile grid, the render loop, and the click listener).

## 1. The most important idea: the world is never isometric

There's one idea that separates well-designed isometric engines from messy
ones:

> **The world is never isometric. The world is always a plain square grid.
> Isometry is just a way of *drawing* that grid.**

Internally, the map is a completely ordinary square grid, indexed by integer
`(x, y)`:

```
+---+---+---+
|0,0|1,0|2,0|
+---+---+---+
|0,1|1,1|2,1|
+---+---+---+
|0,2|1,2|2,2|
+---+---+---+
```

The engine always thinks in these terms. There are no diamonds. There is no
isometry. There is only `(x, y)`.

`isTileInsideMap`, the nested `for` loop in `render()`, and any future game
logic (collisions, pathfinding/A*, AI, physics, "which tile is adjacent to
which") all operate on this plain square grid — exactly like a classic
top-down game. Isometry is **not a data model, it's only a rendering
concern**: a visual projection applied at the very end, only when grid
coordinates need to become screen pixels (`worldToScreen`) or a mouse click
needs to be interpreted back in grid terms (`screenToWorld`).

This separation is what keeps the rest of the engine simple: only the
renderer and the mouse-picking code know the projection formulas below.
Nothing else in the game needs to know the world is drawn as a rhombus.

## 2. Two coordinate systems

The engine always works with two distinct spaces:

- **World coordinates (`x, y`)**: the integer grid indices (row/column of a
  tile), independent of how they end up looking on screen.
- **Screen coordinates (`screenX, screenY`)**: pixels on the `canvas`.

The whole engine boils down to converting between the two:

```
world  --worldToScreen-->  screen
world  <--screenToWorld--  screen
```

## 3. Isometric projection (`worldToScreen`)

```js
const TILE_W = 64;   // diamond width in px
const TILE_H = 32;   // diamond height in px  → 2:1 ratio ("video game" isometry)

function worldToScreen(x, y, z = 0) {
    return {
        x: OFFSET_X + (x - y) * (TILE_W / 2),
        y: OFFSET_Y + (x + y) * (TILE_H / 2) - z
    };
}
```

The isometric projection is simply a **linear transformation** (a 45°
rotation combined with a 2:1 scale) applied to world coordinates, followed by
a translation by the screen offset. With `a = TILE_W / 2` and
`b = TILE_H / 2`, in matrix form:

```
[ screenX ]   [ OFFSET_X ]   [  a  -a ] [ x ]
[ screenY ] = [ OFFSET_Y ] + [  b   b ] [ y ]
```

Each world axis projects onto a screen diagonal:

- Moving `+1` along `x` shifts `(+a, +b)` on screen (down and to the right).
- Moving `+1` along `y` shifts `(-a, +b)` on screen (down and to the left).

That's the geometric reason for `(x - y)` in the horizontal coordinate (the
effects of `x` and `y` cancel out when both grow together, which is why
moving "diagonally" through the world moves the tile straight down on
screen) and for `(x + y)` in the vertical one (both axes push downward on
screen, never upward).

### The `z` parameter (height)

`z` is subtracted directly from `screenY` because "raising" an object in the
world (a ramp, a jump, an upper floor) should only move the sprite upward on
screen — it doesn't affect `x` or `y`, so it isn't part of the projection
matrix; it's a separate offset applied afterwards.

## 4. Inverse projection (`screenToWorld`)

```js
function screenToWorld(screenX, screenY) {
    const localX = screenX - OFFSET_X;
    const localY = screenY - OFFSET_Y;

    return {
        x: (localY / TILE_H) + (localX / TILE_W),
        y: (localY / TILE_H) - (localX / TILE_W)
    };
}
```

Going from screen back to world means inverting the matrix
`M = [[a,-a],[b,b]]` from above. Its determinant is `det(M) = 2ab`, so:

```
M⁻¹ = 1/(2ab) · [  b   a ]
                 [ -b   a ]
```

Applying `M⁻¹` to `(localX, localY) = (screenX - OFFSET_X, screenY - OFFSET_Y)`:

```
x = localX / (2a) + localY / (2b) = localX / TILE_W + localY / TILE_H
y = localY / (2b) - localX / (2a) = localY / TILE_H - localX / TILE_W
```

which is exactly the code: dividing by the *full* `TILE_W`/`TILE_H` is the
same as dividing by `2a`/`2b`, so there's no need to compute `M⁻¹` explicitly
at runtime — the divisions already bake it in. `worldToScreen` and
`screenToWorld` are, mathematically, exact inverses of each other (ignoring
`z`, which isn't part of the matrix).

## 5. Picking a tile with the mouse

Finding the tile under the cursor isn't as simple as `Math.floor()`-ing the
result of `screenToWorld`, for two reasons the engine handles in two steps.

### 5.1 The "inside the diamond" test (L1 norm)

```js
function isPointInsideTile(mouseX, mouseY, tileX, tileY) {
    const p = worldToScreen(tileX, tileY);
    const centerX = p.x;
    const centerY = p.y + TILE_H / 2;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;

    return (Math.abs(dx) / (TILE_W / 2) + Math.abs(dy) / (TILE_H / 2)) <= 1;
}
```

`p` is the diamond's top vertex (see `Renderer.drawTile` in `src/renderer.js`); the diamond's center sits
`TILE_H / 2` below it. Normalizing `dx` by the half-width and `dy` by the
half-height, the boundary of a diamond is exactly `|X| + |Y| = 1` (the unit
ball of the L1/Manhattan norm is a diamond). That's why
`|dx|/(TILE_W/2) + |dy|/(TILE_H/2) <= 1` is the correct "point inside the
diamond" test, instead of a plain rectangular bounding-box check.

### 5.2 Why neighboring tiles are also checked

```js
function getTileAtScreenPosition(mouseX, mouseY) {
    const worldPosition = screenToWorld(mouseX, mouseY);
    const approximateX = Math.floor(worldPosition.x);
    const approximateY = Math.floor(worldPosition.y);

    const candidates = [
        { x: approximateX,     y: approximateY },
        { x: approximateX - 1, y: approximateY },
        { x: approximateX + 1, y: approximateY },
        { x: approximateX,     y: approximateY - 1 },
        { x: approximateX,     y: approximateY + 1 }
    ];
    // ...
}
```

`screenToWorld` + `floor` gives an approximation in "world" (square) space,
but the cells of that space don't line up pixel-for-pixel with the diamonds
drawn on screen: near an edge, `floor` can round to the wrong side while the
mouse is still visually over the neighboring diamond. So the engine doesn't
blindly trust the `floor` result: it tests the approximate tile and its 4
orthogonal neighbors with the exact diamond test from 5.1, and returns the
first one that actually contains the point. This is a classic isometric
*picking* technique: cheap approximation + exact verification bounded to a
small neighborhood.

## 6. Grid constants

| Constant | Value | Role |
|---|---|---|
| `TILE_W` | 64 px | diamond width (`a = TILE_W/2 = 32`) |
| `TILE_H` | 32 px | diamond height (`b = TILE_H/2 = 16`) — 2:1 ratio, the standard video-game isometry (not "true" CAD isometry, which would be ≈ 1.73:1) |
| `OFFSET_X` | `canvas.width / 2` | centers the map diamond horizontally |
| `OFFSET_Y` | 80 px | top margin before drawing starts |

## 7. Discussed extensions (not implemented yet)

The design conversation goes further than what lives in `main.js` today,
with an eye on larger maps. They're documented here as next steps, keeping
the same projection logic and the same "square grid + projection-only
renderer" separation from section 1:

- **Camera**: a `camera = {x, y}` offset subtracted in `worldToScreen` and
  added back in `screenToWorld` before projecting — world→screen subtracts
  the camera, screen→world adds it back.
- **Per-tile culling**: before drawing, check whether the projected diamond
  falls inside the `canvas` (`isTileVisible`), to skip tiles that are off
  screen.
- **Visible range**: for large maps, instead of iterating the whole map,
  un-project the 4 screen corners with `screenToWorld` and take the
  `min`/`max` of those world coordinates (with a ~2-tile margin) as the range
  to iterate.
- **Camera bounds**: clamp `camera.x`/`camera.y` to the map's projected
  extents so the camera can't drift away from the diamond.
