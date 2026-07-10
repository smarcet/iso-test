class IsoGrid {
    constructor({
        tileW = 64,
        tileH = 32,
        mapWidth = 10,
        mapHeight = 10,
        offsetX = 0,
        offsetY = 80
    } = {}) {
        this.tileW = tileW;
        this.tileH = tileH;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
    }

    worldToScreen(x, y, z = 0) {
        return {
            x: this.offsetX + (x - y) * (this.tileW / 2),
            y: this.offsetY + (x + y) * (this.tileH / 2) - z
        };
    }

    screenToWorld(screenX, screenY) {
        const localX = screenX - this.offsetX;
        const localY = screenY - this.offsetY;

        return {
            x: (localY / this.tileH) + (localX / this.tileW),
            y: (localY / this.tileH) - (localX / this.tileW)
        };
    }

    getTileAtScreenPosition(mouseX, mouseY) {
        const worldPosition = this.screenToWorld(mouseX, mouseY);

        const approximateX = Math.floor(worldPosition.x);
        const approximateY = Math.floor(worldPosition.y);

        const candidates = [
            { x: approximateX,     y: approximateY },
            { x: approximateX - 1, y: approximateY },
            { x: approximateX + 1, y: approximateY },
            { x: approximateX,     y: approximateY - 1 },
            { x: approximateX,     y: approximateY + 1 }
        ];

        for (const candidate of candidates) {
            if (
                this.#isTileInsideMap(candidate.x, candidate.y) &&
                this.#isPointInsideTile(
                    mouseX,
                    mouseY,
                    candidate.x,
                    candidate.y
                )
            ) {
                return candidate;
            }
        }

        return null;
    }

    #isTileInsideMap(x, y) {
        return (
            x >= 0 &&
            y >= 0 &&
            x < this.mapWidth &&
            y < this.mapHeight
        );
    }

    #isPointInsideTile(mouseX, mouseY, tileX, tileY) {
        const p = this.worldToScreen(tileX, tileY);

        const centerX = p.x;
        const centerY = p.y + this.tileH / 2;

        const dx = mouseX - centerX;
        const dy = mouseY - centerY;

        return (
            Math.abs(dx) / (this.tileW / 2) +
            Math.abs(dy) / (this.tileH / 2)
        ) <= 1;
    }
}
