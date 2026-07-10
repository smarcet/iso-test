class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
    }

    drawTile(tile, grid) {
        const p = grid.worldToScreen(tile.x, tile.y);

        this.ctx.beginPath();

        this.ctx.moveTo(
            p.x,
            p.y
        );

        this.ctx.lineTo(
            p.x + grid.tileW / 2,
            p.y + grid.tileH / 2
        );

        this.ctx.lineTo(
            p.x,
            p.y + grid.tileH
        );

        this.ctx.lineTo(
            p.x - grid.tileW / 2,
            p.y + grid.tileH / 2
        );

        this.ctx.closePath();

        this.ctx.fillStyle = tile.color;
        this.ctx.fill();

        this.ctx.lineWidth = tile.isSelected ? 4 : 1;
        this.ctx.strokeStyle = tile.isSelected ? "#ffff00" : "#333";
        this.ctx.stroke();
    }
}
