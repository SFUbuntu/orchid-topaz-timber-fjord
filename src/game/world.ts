const GW = 360;
const GH = 640;

export const TILE = 16;
export const MAP_COLS = Math.ceil(GW / TILE);
export const MAP_ROWS = 96;
export const WORLD_H = MAP_ROWS * TILE;

/** atlas indices — 16×16 SNES tileset */
export const T = {
  grass: 0,
  grass2: 1,
  dirt: 2,
  dirt2: 3,
  sand: 4,
  sand2: 5,
  water: 6,
  water2: 7,
  snow: 8,
  snow2: 9,
  road: 10,
  roadV: 11,
  roadH: 12,
  roadX: 13,
  grassS: 14,
  dirtS: 15,
  sandS: 16,
  snowS: 17,
  grassN: 18,
  dirtN: 19,
  sandN: 20,
  snowN: 21,
  metal: 22,
  metal2: 23,
  mountain: 24,
  mountain2: 25,
  mtPeak: 26,
  mtL: 27,
  mtR: 28,
  mtRidge: 29,
  mtCliff: 30,
  sandDune: 31,
  water3: 32,
  water4: 33,
  foam: 34,
  rock: 35,
  sandE: 36,
  sandW: 37,
  grassE: 38,
  grassW: 39,
  dirtE: 40,
  dirtW: 41,
  canyon: 42,
  canyon2: 43,
  snowE: 44,
  snowW: 45,
  mtSnow: 46,
  waterDeep: 47,
  sandDune2: 48,
  mtS: 49,
  mtN: 50,
} as const;

const WATER_FRAMES = [T.water, T.water2, T.water3, T.water4];

export type Biome = "grass" | "dirt" | "sand" | "snow" | "water" | "metal" | "mountain";

const BASE: Record<Biome, number> = {
  grass: T.grass,
  dirt: T.dirt,
  sand: T.sand,
  snow: T.snow,
  water: T.water,
  metal: T.metal,
  mountain: T.mountain,
};

const VAR: Record<Biome, number> = {
  grass: T.grass2,
  dirt: T.dirt2,
  sand: T.sand2,
  snow: T.snow2,
  water: T.water2,
  metal: T.metal2,
  mountain: T.mountain2,
};

export const STAGE_BIOME: Biome[] = [
  "grass",
  "water",
  "grass",
  "sand",
  "mountain",
  "mountain",
  "metal",
  "water",
  "mountain",
  "snow",
];

export function tileHash(x: number, y: number, s: number) {
  let n = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function hash(x: number, y: number, s: number) {
  return tileHash(x, y, s);
}

function fill(map: Uint8Array, biome: Biome, seed: number) {
  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const h = hash(x, y, seed);
      map[y * MAP_COLS + x] = h > 0.55 ? VAR[biome] : BASE[biome];
    }
  }
}

function set(map: Uint8Array, x: number, y: number, id: number) {
  if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return;
  map[y * MAP_COLS + x] = id;
}

function get(map: Uint8Array, x: number, y: number) {
  if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return T.water;
  return map[y * MAP_COLS + x];
}

function isWater(id: number) {
  return (
    id === T.water ||
    id === T.water2 ||
    id === T.water3 ||
    id === T.water4 ||
    id === T.foam ||
    id === T.waterDeep
  );
}

function isRoad(id: number) {
  return id >= T.road && id <= T.roadX;
}

function isSand(id: number) {
  return id === T.sand || id === T.sand2 || id === T.sandDune || id === T.sandDune2;
}

function stampIsland(map: Uint8Array, cx: number, cy: number, rx: number, ry: number, biome: Biome, seed: number) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny < 0.92 + hash(x, y, seed) * 0.18) {
        set(map, x, y, hash(x, y, seed + 3) > 0.5 ? VAR[biome] : BASE[biome]);
      }
    }
  }
}

function stampLake(map: Uint8Array, cx: number, cy: number, rx: number, ry: number, seed: number) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny < 0.9 + hash(x, y, seed) * 0.15) {
        const deep = nx * nx + ny * ny < 0.35;
        set(map, x, y, deep ? T.waterDeep : hash(x, y, seed) > 0.5 ? T.water2 : T.water);
      }
    }
  }
}

function paintRoad(map: Uint8Array, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    const vert = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
    set(map, x, y, vert ? T.roadV : T.roadH);
    set(map, x + (vert ? 1 : 0), y + (vert ? 0 : 1), T.road);
  }
}

function windingRoad(map: Uint8Array, seed: number, col = Math.floor(MAP_COLS / 2), y0 = 0) {
  let x = col;
  for (let y = y0; y < MAP_ROWS; y++) {
    x += Math.round((hash(0, y, seed) - 0.5) * 1.4);
    x = Math.max(3, Math.min(MAP_COLS - 5, x));
    set(map, x, y, T.roadV);
    set(map, x + 1, y, T.roadV);
    if (y % 18 === 8) {
      const dir = hash(y, 9, seed) > 0.5 ? 1 : -1;
      const len = 5 + ((hash(y, 2, seed) * 5) | 0);
      for (let i = 0; i < len; i++) set(map, x + dir * i, y, T.roadH);
      set(map, x, y, T.roadX);
    }
  }
}

function stampCarrier(map: Uint8Array, seed: number) {
  for (let y = 2; y <= 40; y++) {
    for (let x = 3; x <= 19; x++) {
      const hatch = hash(x, y, seed + 11) > 0.58;
      set(map, x, y, hatch ? T.metal2 : T.metal);
    }
    for (let x = 0; x <= 2; x++) set(map, x, y, hash(x, y, seed) > 0.5 ? T.grass2 : T.grass);
    for (let x = 20; x < MAP_COLS; x++) set(map, x, y, hash(x, y, seed + 2) > 0.5 ? T.grass2 : T.grass);
  }
  for (let y = 6; y <= 40; y++) {
    set(map, 9, y, T.roadV);
    set(map, 10, y, T.roadV);
    set(map, 11, y, T.roadV);
    set(map, 12, y, T.roadV);
  }
  for (let y = 4; y <= 18; y++) {
    for (let x = 15; x <= 20; x++) set(map, x, y, T.metal2);
  }
  for (let x = 3; x <= 19; x++) {
    set(map, x, 2, T.metal);
    set(map, x, 40, T.metal2);
  }
}

function stampDunes(map: Uint8Array, seed: number) {
  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const id = get(map, x, y);
      if (!isSand(id) && id !== T.dirt && id !== T.dirt2) continue;
      if (isWater(id) || isRoad(id)) continue;
      const band = (x + y * 2 + ((hash(x, y, seed) * 3) | 0)) % 8;
      if (band < 2) set(map, x, y, T.sandDune);
      else if (band === 5) set(map, x, y, T.sandDune2);
    }
  }
}

function stampRidge(map: Uint8Array, col: number, seed: number, snowy = false) {
  let x = col;
  for (let y = 0; y < MAP_ROWS; y++) {
    x += Math.round((hash(col, y, seed) - 0.5) * 1.15);
    x = Math.max(2, Math.min(MAP_COLS - 3, x));
    const h = hash(x, y, seed + 5);
    set(map, x - 2, y, h > 0.5 ? T.mountain2 : T.mountain);
    set(map, x - 1, y, T.mtL);
    if (h > 0.84) set(map, x, y, snowy ? T.mtSnow : T.mtPeak);
    else if (h > 0.62) set(map, x, y, T.mtRidge);
    else set(map, x, y, T.mtCliff);
    set(map, x + 1, y, T.mtR);
    set(map, x + 2, y, h > 0.45 ? T.rock : T.mountain);
  }
}

function stampCanyon(map: Uint8Array, seed: number) {
  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const id = get(map, x, y);
      if (isWater(id) || isRoad(id)) continue;
      if (id === T.mountain || id === T.mountain2 || id === T.dirt || id === T.dirt2) {
        const n = hash(x, y, seed);
        if (n > 0.72) set(map, x, y, n > 0.86 ? T.canyon2 : T.canyon);
      }
    }
  }
}

function stampDeepWater(map: Uint8Array) {
  for (let y = 1; y < MAP_ROWS - 1; y++) {
    for (let x = 1; x < MAP_COLS - 1; x++) {
      if (!isWater(get(map, x, y))) continue;
      let land = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (!isWater(get(map, x + dx, y + dy))) land += 1;
      if (land === 0) set(map, x, y, T.waterDeep);
      else if (land <= 2 && hash(x, y, 3) > 0.5) set(map, x, y, T.foam);
    }
  }
}

function shores(map: Uint8Array, biome: Biome) {
  const south =
    biome === "dirt"
      ? T.dirtS
      : biome === "sand"
        ? T.sandS
        : biome === "snow"
          ? T.snowS
          : biome === "mountain"
            ? T.mtS
            : T.grassS;
  const north =
    biome === "dirt"
      ? T.dirtN
      : biome === "sand"
        ? T.sandN
        : biome === "snow"
          ? T.snowN
          : biome === "mountain"
            ? T.mtN
            : T.grassN;
  const east =
    biome === "dirt"
      ? T.dirtE
      : biome === "sand"
        ? T.sandE
        : biome === "snow"
          ? T.snowE
          : T.grassE;
  const west =
    biome === "dirt"
      ? T.dirtW
      : biome === "sand"
        ? T.sandW
        : biome === "snow"
          ? T.snowW
          : T.grassW;
  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const id = get(map, x, y);
      if (isWater(id) || isRoad(id)) continue;
      if (id === T.metal || id === T.metal2) continue;
      if (id === T.mtL || id === T.mtR || id === T.mtPeak || id === T.mtRidge || id === T.mtCliff || id === T.mtSnow)
        continue;
      if (isWater(get(map, x, y + 1))) set(map, x, y, south);
      else if (isWater(get(map, x, y - 1))) set(map, x, y, north);
      else if (isWater(get(map, x + 1, y))) set(map, x, y, east);
      else if (isWater(get(map, x - 1, y))) set(map, x, y, west);
    }
  }
}

export function generateStageMap(stage: number): Uint8Array {
  const map = new Uint8Array(MAP_COLS * MAP_ROWS);
  const seed = stage * 97 + 13;
  const biome = STAGE_BIOME[stage] ?? "grass";

  if (stage === 0) {
    fill(map, "water", seed);
    stampCarrier(map, seed);
    stampIsland(map, 11, 58, 11, 14, "grass", seed);
    stampIsland(map, 8, 80, 10, 12, "grass", seed + 5);
    stampLake(map, 12, 64, 6, 7, seed);
    windingRoad(map, seed, 11, 40);
    stampDeepWater(map);
  } else if (stage === 1) {
    fill(map, "water", seed);
    stampIsland(map, 4, 16, 5, 8, "grass", seed);
    stampIsland(map, 18, 40, 5, 9, "sand", seed);
    stampIsland(map, 6, 70, 6, 10, "grass", seed);
    stampIsland(map, 16, 78, 4, 6, "sand", seed);
    stampDeepWater(map);
  } else if (stage === 2) {
    fill(map, "grass", seed);
    stampLake(map, 7, 16, 5, 4, seed);
    stampLake(map, 16, 48, 4, 5, seed + 4);
    stampLake(map, 6, 80, 5, 4, seed + 8);
    windingRoad(map, seed, 11);
  } else if (stage === 3) {
    fill(map, "sand", seed);
    stampDunes(map, seed);
    stampLake(map, 17, 20, 4, 4, seed);
    stampLake(map, 5, 58, 4, 4, seed + 2);
    stampLake(map, 14, 84, 3, 3, seed + 6);
    windingRoad(map, seed, 10);
  } else if (stage === 4) {
    fill(map, "dirt", seed);
    stampCanyon(map, seed);
    stampRidge(map, 4, seed, false);
    stampRidge(map, 18, seed + 9, false);
    windingRoad(map, seed, 11);
    stampLake(map, 11, 40, 3, 8, seed);
  } else if (stage === 5) {
    fill(map, "mountain", seed);
    stampCanyon(map, seed);
    stampRidge(map, 5, seed, true);
    stampRidge(map, 17, seed + 3, false);
    windingRoad(map, seed, 11);
    for (let y = 6; y < MAP_ROWS; y += 12) paintRoad(map, 2, y, 8, y);
  } else if (stage === 6) {
    fill(map, "metal", seed);
    stampIsland(map, 11, 20, 10, 8, "metal", seed);
    stampLake(map, 4, 48, 4, 20, seed);
    stampLake(map, 19, 48, 4, 20, seed);
    windingRoad(map, seed, 11);
    stampDeepWater(map);
  } else if (stage === 7) {
    fill(map, "water", seed);
    stampIsland(map, 3, 12, 5, 8, "grass", seed);
    stampIsland(map, 20, 12, 4, 7, "sand", seed);
    stampIsland(map, 4, 80, 5, 8, "grass", seed);
    stampIsland(map, 19, 78, 4, 7, "sand", seed);
    stampIsland(map, 11, 46, 4, 5, "dirt", seed);
    stampDeepWater(map);
  } else if (stage === 8) {
    fill(map, "mountain", seed);
    stampCanyon(map, seed + 2);
    stampRidge(map, 3, seed, false);
    stampRidge(map, 19, seed + 7, true);
    stampLake(map, 11, 82, 6, 5, seed);
    windingRoad(map, seed, 11);
    paintRoad(map, 2, 20, 20, 20);
    paintRoad(map, 2, 44, 20, 44);
  } else {
    fill(map, "snow", seed);
    stampRidge(map, 5, seed + 1, true);
    stampRidge(map, 17, seed + 4, true);
    stampLake(map, 11, 8, 10, 5, seed);
    stampIsland(map, 11, 50, 4, 7, "snow", seed);
    windingRoad(map, seed, 11);
  }

  shores(map, biome === "water" ? "grass" : biome);
  return map;
}

/** Tiles and ground objects both move DOWN as scroll increases (new terrain from the top). */
export function mapToScreenY(worldY: number, scroll: number) {
  const off = ((scroll % WORLD_H) + WORLD_H) % WORLD_H;
  let y = worldY + off;
  y = ((y % WORLD_H) + WORLD_H) % WORLD_H;
  if (y > GH + 64) y -= WORLD_H;
  return y;
}

export function screenToMapY(screenY: number, scroll: number) {
  const off = ((scroll % WORLD_H) + WORLD_H) % WORLD_H;
  return (((screenY - off) % WORLD_H) + WORLD_H) % WORLD_H;
}

function wrappedLand(map: Uint8Array, col: number, row: number, dc: number, dr: number) {
  const c2 = col + dc;
  if (c2 < 0 || c2 >= MAP_COLS) return false;
  const r2 = (((row + dr) % MAP_ROWS) + MAP_ROWS) % MAP_ROWS;
  return !isWater(map[r2 * MAP_COLS + c2] ?? T.water);
}

function drawWaterShader(
  c: CanvasRenderingContext2D,
  map: Uint8Array,
  scroll: number,
  time: number,
) {
  const off = ((scroll % WORLD_H) + WORLD_H) % WORLD_H;
  const q = Math.floor(off / TILE);
  const r = off % TILE;
  c.save();
  c.imageSmoothingEnabled = false;
  for (let sy = -1; sy < GH / TILE + 2; sy++) {
    const row = (((sy - q) % MAP_ROWS) + MAP_ROWS) % MAP_ROWS;
    const y = sy * TILE + r;
    for (let col = 0; col < MAP_COLS; col++) {
      const id = map[row * MAP_COLS + col] ?? T.grass;
      const x = col * TILE;
      if (isWater(id)) {
        const deep = id === T.waterDeep;
        // Slow traveling sheen — low contrast so it does not strobe.
        const sheen = ((y + time * 14 + col * 1.6) % 12 + 12) % 12;
        if (sheen < 1.2) {
          c.globalAlpha = deep ? 0.07 : 0.11;
          c.fillStyle = deep ? "#8ecce0" : "#c8eef8";
          c.fillRect(x, y + sheen, TILE, 1);
        }
        const sheen2 = ((y * 0.85 + time * 8 + 6 + col * 0.7) % 16 + 16) % 16;
        if (sheen2 < 0.9) {
          c.globalAlpha = deep ? 0.04 : 0.06;
          c.fillStyle = "#a8e0f0";
          c.fillRect(x, y + sheen2, TILE, 1);
        }
        // Stable sparkle slots; fade in place instead of hopping cells.
        const slot = tileHash(col, row, 17);
        if (slot > 0.82) {
          const gx = x + 2 + (((slot * 11) | 0) % 12);
          const gy = y + 2 + (((slot * 23) | 0) % 12);
          const tw = 0.5 + 0.5 * Math.sin(time * 2.4 + slot * 18);
          c.globalAlpha = 0.08 + tw * 0.22;
          c.fillStyle = "#e8f8fc";
          c.fillRect(gx, gy, 2, 1);
        }
        const pulse = 0.10 + 0.05 * Math.sin(time * 2.1 + col * 0.45 + row * 0.12);
        c.fillStyle = "#dceef4";
        if (wrappedLand(map, col, row, 0, -1)) {
          c.globalAlpha = pulse;
          c.fillRect(x, y, TILE, 2);
        }
        if (wrappedLand(map, col, row, 0, 1)) {
          c.globalAlpha = pulse;
          c.fillRect(x, y + TILE - 2, TILE, 2);
        }
        if (wrappedLand(map, col, row, -1, 0)) {
          c.globalAlpha = pulse * 0.85;
          c.fillRect(x, y, 2, TILE);
        }
        if (wrappedLand(map, col, row, 1, 0)) {
          c.globalAlpha = pulse * 0.85;
          c.fillRect(x + TILE - 2, y, 2, TILE);
        }
      } else if (isShoreId(id) && id !== T.foam) {
        const pulse = 0.09 + 0.05 * Math.sin(time * 2.1 + col * 0.5);
        c.globalAlpha = pulse;
        c.fillStyle = "#e4f2f8";
        if (id === T.grassS || id === T.dirtS || id === T.sandS || id === T.snowS || id === T.mtS) {
          c.fillRect(x, y + TILE - 2, TILE, 1);
        } else if (id === T.grassN || id === T.dirtN || id === T.sandN || id === T.snowN || id === T.mtN) {
          c.fillRect(x, y, TILE, 1);
        } else if (id === T.grassE || id === T.dirtE || id === T.sandE || id === T.snowE) {
          c.fillRect(x + TILE - 2, y, 1, TILE);
        } else if (id === T.grassW || id === T.dirtW || id === T.sandW || id === T.snowW) {
          c.fillRect(x, y, 1, TILE);
        }
      }
    }
  }
  c.restore();
}

export function drawTileMap(
  c: CanvasRenderingContext2D,
  atlas: HTMLImageElement | undefined,
  map: Uint8Array,
  scroll: number,
  time: number,
) {
  const off = ((scroll % WORLD_H) + WORLD_H) % WORLD_H;
  const q = Math.floor(off / TILE);
  const r = off % TILE;
  const wave = Math.floor(time * 2) % 4;

  if (!atlas || !atlas.complete || !atlas.naturalWidth) {
    for (let sy = -1; sy < GH / TILE + 2; sy++) {
      const row = (((sy - q) % MAP_ROWS) + MAP_ROWS) % MAP_ROWS;
      const y = sy * TILE + r;
      for (let col = 0; col < MAP_COLS; col++) {
        const id = map[row * MAP_COLS + col] ?? T.grass;
        c.fillStyle = isWater(id) ? "#3a7a94" : id >= T.road && id <= T.roadX ? "#686870" : "#4a9a3a";
        c.fillRect(col * TILE, y, TILE, TILE);
      }
    }
    return;
  }

  const prevSmooth = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  for (let sy = -1; sy < GH / TILE + 2; sy++) {
    const row = (((sy - q) % MAP_ROWS) + MAP_ROWS) % MAP_ROWS;
    const y = sy * TILE + r;
    for (let col = 0; col < MAP_COLS; col++) {
      let id = map[row * MAP_COLS + col] ?? T.grass;
      if (id === T.water || id === T.water2 || id === T.water3 || id === T.water4) {
        id = WATER_FRAMES[(wave + (col >> 1) + (row >> 1)) & 3];
      }
      // Deep and foam stay on their own tiles — swapping to shallow water strobes.
      const sx = (id % 16) * TILE;
      const syAtlas = Math.floor(id / 16) * TILE;
      c.drawImage(atlas, sx, syAtlas, TILE, TILE, col * TILE, y, TILE, TILE);
    }
  }
  drawWaterShader(c, map, scroll, time);
  c.imageSmoothingEnabled = prevSmooth;
}

export function drawSprite(
  c: CanvasRenderingContext2D,
  im: HTMLImageElement | undefined,
  x: number,
  y: number,
  h: number,
  anchor: "center" | "feet" = "center",
) {
  if (!im || !im.complete || im.naturalWidth === 0) return false;
  const w = (im.naturalWidth / im.naturalHeight) * h;
  const top = anchor === "feet" ? y - h : y - h / 2;
  c.drawImage(im, x - w / 2, top, w, h);
  return true;
}

export function isWaterTile(id: number) {
  return isWater(id);
}

export function isMetalTile(id: number) {
  return id === T.metal || id === T.metal2;
}

export function isRoadTile(id: number) {
  return isRoad(id);
}

export function isWaterCell(map: Uint8Array, col: number, row: number) {
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true;
  return isWater(map[row * MAP_COLS + col] ?? T.water);
}

export function tileIdAt(map: Uint8Array, x: number, y: number, scroll: number) {
  const off = ((scroll % WORLD_H) + WORLD_H) % WORLD_H;
  const col = Math.floor(x / TILE);
  const row = (((Math.floor((y - off) / TILE) % MAP_ROWS) + MAP_ROWS) % MAP_ROWS);
  if (col < 0 || col >= MAP_COLS) return T.water;
  return map[row * MAP_COLS + col] ?? T.water;
}

export function isWaterAt(map: Uint8Array, x: number, y: number, scroll: number) {
  return isWaterTile(tileIdAt(map, x, y, scroll));
}

export function sampleTerrainX(map: Uint8Array, y: number, scroll: number, wantWater: boolean, tries = 20) {
  const hits: number[] = [];
  for (let col = 1; col < MAP_COLS - 1; col++) {
    const x = col * TILE + TILE / 2;
    if (isWaterAt(map, x, y, scroll) === wantWater) hits.push(x);
  }
  if (hits.length) return hits[(Math.random() * hits.length) | 0];
  for (let i = 0; i < tries; i++) {
    const x = 28 + Math.random() * (GW - 56);
    if (isWaterAt(map, x, y, scroll) === wantWater) return x;
  }
  return null;
}

export function nearestTerrainX(map: Uint8Array, x: number, y: number, scroll: number, wantWater: boolean) {
  let best: number | null = null;
  let bestD = 1e9;
  for (let col = 1; col < MAP_COLS - 1; col++) {
    const cx = col * TILE + TILE / 2;
    if (isWaterAt(map, cx, y, scroll) === wantWater) {
      const d = Math.abs(cx - x);
      if (d < bestD) {
        bestD = d;
        best = cx;
      }
    }
  }
  return best;
}

export function isShoreId(id: number) {
  return (
    id === T.grassS ||
    id === T.grassN ||
    id === T.grassE ||
    id === T.grassW ||
    id === T.dirtS ||
    id === T.dirtN ||
    id === T.dirtE ||
    id === T.dirtW ||
    id === T.sandS ||
    id === T.sandN ||
    id === T.sandE ||
    id === T.sandW ||
    id === T.snowS ||
    id === T.snowN ||
    id === T.snowE ||
    id === T.snowW ||
    id === T.mtS ||
    id === T.mtN ||
    id === T.foam
  );
}

/** Open ground a tank can sit on — grass, sand, dirt, road, snow, metal. Not water, shores, or cliffs. */
export function isDriveLandId(id: number) {
  if (isWater(id) || isShoreId(id)) return false;
  if (id === T.mtL || id === T.mtR || id === T.mtPeak || id === T.mtRidge || id === T.mtCliff || id === T.mtSnow) return false;
  return true;
}

function isPreferredTankId(id: number) {
  return (
    id === T.grass ||
    id === T.grass2 ||
    id === T.sand ||
    id === T.sand2 ||
    id === T.sandDune ||
    id === T.sandDune2 ||
    id === T.dirt ||
    id === T.dirt2 ||
    id === T.snow ||
    id === T.snow2 ||
    isRoad(id)
  );
}

/** Full tank footprint: body sits above the feet, so the pad must be solid land, not a 1-tile shore. */
export function landPadAt(
  map: Uint8Array,
  x: number,
  y: number,
  scroll: number,
  halfW = 20,
  up = 26,
  down = 8,
) {
  for (const ox of [-halfW, -halfW / 2, 0, halfW / 2, halfW]) {
    for (const oy of [-up, -up / 2, 0, down]) {
      if (!isDriveLandId(tileIdAt(map, x + ox, y + oy, scroll))) return false;
    }
  }
  return true;
}

export function sampleLandX(
  map: Uint8Array,
  y: number,
  scroll: number,
  halfW = 20,
  up = 26,
  down = 8,
) {
  const prefer: number[] = [];
  const ok: number[] = [];
  for (let col = 2; col < MAP_COLS - 2; col++) {
    const x = col * TILE + TILE / 2;
    if (!landPadAt(map, x, y, scroll, halfW, up, down)) continue;
    const id = tileIdAt(map, x, y, scroll);
    if (isPreferredTankId(id)) prefer.push(x);
    else ok.push(x);
  }
  const pool = prefer.length ? prefer : ok;
  if (!pool.length) return null;
  return pool[(Math.random() * pool.length) | 0];
}

export function nearestLandX(
  map: Uint8Array,
  x: number,
  y: number,
  scroll: number,
  halfW = 20,
  up = 26,
  down = 8,
) {
  let best: number | null = null;
  let bestD = 1e9;
  for (let col = 2; col < MAP_COLS - 2; col++) {
    const cx = col * TILE + TILE / 2;
    if (!landPadAt(map, cx, y, scroll, halfW, up, down)) continue;
    const d = Math.abs(cx - x);
    if (d < bestD) {
      bestD = d;
      best = cx;
    }
  }
  return best;
}
