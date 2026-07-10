if (typeof window !== "undefined") {
    window.addEventListener("load", function () {
        const canvas = document.querySelector("canvas");

        canvas.width = 1200;
        canvas.height = 1200;

        const ctx = canvas.getContext("2d");

        const MAP_WIDTH = 10;
        const MAP_HEIGHT = 10;

        const grid = new IsoGrid({
            mapWidth: MAP_WIDTH,
            mapHeight: MAP_HEIGHT,
            offsetX: canvas.width / 2
        });

        const renderer = new Renderer(ctx);

        const tiles = [];
        for (let y = 0; y < grid.mapHeight; y++) {
            const row = [];
            for (let x = 0; x < grid.mapWidth; x++) {
                row.push(new Tile(x, y));
            }
            tiles.push(row);
        }

        function render() {
            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            for (let y = 0; y < grid.mapHeight; y++) {
                for (let x = 0; x < grid.mapWidth; x++) {
                    renderer.drawTile(tiles[y][x], grid);
                }
            }
        }

        canvas.addEventListener("click", function (event) {
            const rect = canvas.getBoundingClientRect();

            /*
             * Estas cuentas contemplan que el canvas pueda estar
             * escalado mediante CSS.
             */
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const mouseX =
                (event.clientX - rect.left) * scaleX;

            const mouseY =
                (event.clientY - rect.top) * scaleY;

            const picked = grid.getTileAtScreenPosition(mouseX, mouseY);

            for (const row of tiles) {
                for (const tile of row) {
                    tile.isSelected = false;
                }
            }

            if (picked) {
                tiles[picked.y][picked.x].isSelected = true;

                console.log(
                    `Tile seleccionado: (${picked.x}, ${picked.y})`
                );
            }

            render();
        });

        render();
    });
}
