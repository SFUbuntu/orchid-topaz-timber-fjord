#!/usr/bin/env python3
"""Build a 16-bit SNES-style 16x16 terrain atlas from generated plates."""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SRC = Path("/tmp/tilesrc")
OUT = Path("/workspace/public/sprites/tiles.png")
SEAM = Path("/workspace/public/sprites/world")
N = 16
COLS = 16
ROWS = 4
BAYER = np.array(
    [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
    ],
    dtype=np.float32,
) / 16.0


def snes(rgb: np.ndarray) -> np.ndarray:
    return (rgb.astype(np.int32) // 8 * 8).clip(0, 248).astype(np.uint8)


def flatten(arr: np.ndarray, grid: int = 8) -> np.ndarray:
    """Kill large blotches so 16x16 crops don't show a repeating landmark."""
    im = Image.fromarray(arr, "RGB")
    blur = im.resize((grid, grid), Image.Resampling.BOX).resize(im.size, Image.Resampling.BILINEAR)
    low = np.array(blur, dtype=np.float32)
    mean = arr.reshape(-1, 3).mean(axis=0)
    high = arr.astype(np.float32) - low + mean
    return snes(np.clip(high, 0, 255))


def load_plate(name: str, size: int = 128) -> np.ndarray:
    im = Image.open(SRC / name).convert("RGB")
    im = im.resize((size, size), Image.Resampling.BOX)
    arr = np.array(im, dtype=np.uint8)
    return flatten(snes(arr))


def palette_of(arr: np.ndarray, k: int = 12) -> np.ndarray:
    im = Image.fromarray(arr, "RGB")
    q = im.quantize(colors=k, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: k * 3]
    cols = np.array(pal, dtype=np.uint8).reshape(-1, 3)
    return snes(cols)


def nearest(px: np.ndarray, pal: np.ndarray) -> np.ndarray:
    d = ((px.astype(np.int16) - pal.astype(np.int16)) ** 2).sum(axis=1)
    return pal[int(d.argmin())]


def dither_to_pal(tile: np.ndarray, pal: np.ndarray, strength: float = 10.0) -> np.ndarray:
    h, w, _ = tile.shape
    out = np.zeros_like(tile)
    for y in range(h):
        for x in range(w):
            b = (BAYER[y & 3, x & 3] - 0.5) * strength
            px = np.clip(tile[y, x].astype(np.float32) + b, 0, 255)
            out[y, x] = nearest(px, pal)
    return snes(out)


def crop(arr: np.ndarray, ox: int, oy: int) -> np.ndarray:
    h, w, _ = arr.shape
    y, x = np.ogrid[:N, :N]
    return arr[(oy + y) % h, (ox + x) % w]


def shade(tile: np.ndarray, factor: np.ndarray | float) -> np.ndarray:
    f = np.asarray(factor, dtype=np.float32)
    if f.ndim == 0:
        f = np.full(tile.shape[:2], float(f), dtype=np.float32)
    if f.ndim == 2:
        f = f[..., None]
    return snes(np.clip(tile.astype(np.float32) * f, 0, 255))


def lerp_rgb(a: np.ndarray, b: np.ndarray, t: np.ndarray | float) -> np.ndarray:
    t = np.asarray(t, dtype=np.float32)
    if t.ndim == 0:
        t = np.full(a.shape[:2], float(t), dtype=np.float32)
    if t.ndim == 2:
        t = t[..., None]
    return snes(a.astype(np.float32) * (1 - t) + b.astype(np.float32) * t)


def noise(seed: int, scale: float = 0.35) -> np.ndarray:
    rng = np.random.RandomState(seed)
    y, x = np.mgrid[0:N, 0:N]
    n = np.zeros((N, N), dtype=np.float32)
    for octv, amp in ((1.0, 0.55), (2.0, 0.28), (4.0, 0.17)):
        gx = (x * scale * octv).astype(int)
        gy = (y * scale * octv).astype(int)
        table = rng.rand(32, 32).astype(np.float32)
        n += table[gy % 32, gx % 32] * amp
    n -= n.min()
    n /= max(n.max(), 1e-6)
    return n


def speckle(tile: np.ndarray, pal: np.ndarray, seed: int, rate: float = 0.08) -> np.ndarray:
    rng = np.random.RandomState(seed)
    out = tile.copy()
    for y in range(N):
        for x in range(N):
            if rng.rand() < rate:
                out[y, x] = pal[rng.randint(0, len(pal))]
    return out


def grass_tile(seed: int) -> np.ndarray:
    """Even SNES overworld grass — tufts wrap so 2x2 does not checkerboard."""
    pal = snes(np.array([
        [24, 80, 28],
        [36, 108, 36],
        [48, 132, 44],
        [64, 152, 52],
        [88, 172, 64],
        [120, 148, 48],
        [28, 64, 24],
        [72, 124, 48],
    ]))
    rng = np.random.RandomState(seed)
    n = noise(seed, 0.62)
    base = lerp_rgb(
        np.broadcast_to(pal[1], (N, N, 3)),
        np.broadcast_to(pal[3], (N, N, 3)),
        n * 0.55,
    )
    # wrapping vertical blades
    for _ in range(22):
        x = rng.randint(0, N)
        y = rng.randint(0, N)
        h = rng.randint(2, 4)
        col = pal[int(rng.choice([0, 2, 4, 7]))]
        for i in range(h):
            base[(y + i) % N, x] = col
    # tiny seed specks, wrap
    for _ in range(7):
        base[rng.randint(0, N), rng.randint(0, N)] = pal[5]
    # dark soil dots
    for _ in range(4):
        base[rng.randint(0, N), rng.randint(0, N)] = pal[6]
    return dither_to_pal(base, pal, 5.0)


def water_frame(phase: int, deep: bool = False) -> np.ndarray:
    """Wrap-safe SNES water. Periods 8 and 16 divide the tile so 2x2 has no seam."""
    deep_c = snes(np.array([8, 36, 76] if deep else [12, 56, 100]))
    dark_c = snes(np.array([12, 52, 96] if deep else [20, 84, 132]))
    mid_c = snes(np.array([20, 76, 120] if deep else [36, 124, 164]))
    hi_c = snes(np.array([36, 108, 148] if deep else [68, 172, 196]))
    spark = snes(np.array([140, 208, 224] if deep else [212, 244, 248]))
    foam = snes(np.array([88, 168, 188] if deep else [152, 216, 224]))
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    # integer wavelengths only — 16px wrap
    swell = np.sin((y - phase) * (2 * math.pi / 8.0))
    cross = np.sin((x + phase * 0.5) * (2 * math.pi / 16.0)) * np.sin(
        (y + phase) * (2 * math.pi / 16.0)
    )
    v = swell * 0.78 + cross * 0.22
    tile = np.empty((N, N, 3), dtype=np.uint8)
    tile[:] = mid_c
    tile[v < -0.42] = deep_c
    tile[(v >= -0.42) & (v < 0.02)] = dark_c
    tile[(v >= 0.02) & (v < 0.52)] = mid_c
    tile[v >= 0.52] = hi_c
    for yy in range(N):
        for xx in range(N):
            if v[yy, xx] > 0.76 and ((xx * 3 + yy + phase) % 7 == 0):
                tile[yy, xx] = spark
            elif v[yy, xx] < -0.72 and ((xx + yy * 2 + phase) % 11 == 0):
                tile[yy, xx] = foam
    pal2 = np.vstack([deep_c, dark_c, mid_c, hi_c, spark, foam])
    return dither_to_pal(tile, pal2, 2.8)



def shore(fill: np.ndarray, water: np.ndarray, edge: str) -> np.ndarray:
    tile = fill.copy()
    if edge == "S":
        tile[11:14] = lerp_rgb(fill[11:14], water[11:14], 0.35)
        tile[14:] = water[14:]
        tile[13] = snes((fill[13].astype(np.int16) + water[13].astype(np.int16)) // 2)
        # foam line
        tile[12, 1::3] = snes(np.array([220, 236, 244]))
    elif edge == "N":
        tile[:2] = water[:2]
        tile[2:5] = lerp_rgb(water[2:5], fill[2:5], 0.45)
        tile[3, 2::3] = snes(np.array([220, 236, 244]))
    elif edge == "E":
        tile[:, 12:14] = lerp_rgb(fill[:, 12:14], water[:, 12:14], 0.35)
        tile[:, 14:] = water[:, 14:]
        tile[1::3, 13] = snes(np.array([220, 236, 244]))
    elif edge == "W":
        tile[:, :2] = water[:, :2]
        tile[:, 2:5] = lerp_rgb(water[:, 2:5], fill[:, 2:5], 0.45)
        tile[2::3, 3] = snes(np.array([220, 236, 244]))
    return tile


def road_tile(kind: str, dirt: np.ndarray) -> np.ndarray:
    asphalt = np.array([72, 76, 84], dtype=np.uint8)
    dark = np.array([48, 50, 56], dtype=np.uint8)
    line = np.array([212, 188, 72], dtype=np.uint8)
    tile = snes((dirt.astype(np.int16) * 0.35 + asphalt.astype(np.int16) * 0.65).clip(0, 255))
    tile[:2] = dark
    tile[-2:] = dark
    tile[:, :2] = np.minimum(tile[:, :2], dark)
    tile[:, -2:] = np.minimum(tile[:, -2:], dark)
    if kind in ("V", "X"):
        tile[:, 7:9] = line
        tile[2:5, 7:9] = dark
        tile[9:12, 7:9] = dark
    if kind in ("H", "X"):
        tile[7:9] = line
        tile[7:9, 2:5] = dark
        tile[7:9, 9:12] = dark
    if kind == "plain":
        grit = noise(90, 0.7)
        tile = shade(tile, 0.88 + grit * 0.18)
    return tile


def mountain_fill(rock: np.ndarray, pal: np.ndarray, seed: int) -> np.ndarray:
    n = noise(seed, 0.5)
    tile = shade(rock, 0.78 + n * 0.38)
    # hairline cracks
    rng = np.random.RandomState(seed)
    for _ in range(3):
        x0 = rng.randint(1, 14)
        y0 = rng.randint(1, 14)
        col = pal[np.argmin(pal.sum(1))]
        for i in range(6):
            yy = min(15, y0 + i)
            xx = min(15, max(0, x0 + rng.randint(-1, 2)))
            tile[yy, xx] = col
    return dither_to_pal(tile, pal, 8.0)


def mountain_slope(rock: np.ndarray, pal: np.ndarray, side: str) -> np.ndarray:
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    t = x / 15.0
    if side == "L":
        light = 0.42 + t * 0.85
        cliff = t < 0.22
    else:
        light = 1.22 - t * 0.85
        cliff = t > 0.78
    n = noise(40 if side == "L" else 41, 0.55)
    tile = shade(rock, light * (0.85 + n * 0.25))
    dark = pal[np.argmin(pal.sum(1))]
    tile[cliff] = dark
    # ridge highlight
    if side == "L":
        tile[:, 14] = snes(np.array([186, 178, 168]))
    else:
        tile[:, 1] = snes(np.array([186, 178, 168]))
    return dither_to_pal(tile, pal, 7.0)


def mountain_ridge(rock: np.ndarray, pal: np.ndarray) -> np.ndarray:
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    crest = np.exp(-((x - 7.5) ** 2) / 10.0)
    tile = shade(rock, 0.55 + crest * 0.7)
    snow = pal[np.argmax(pal.sum(1))]
    cap = (y < 5) & (np.abs(x - 7.5) < 3.5 - y * 0.15)
    tile[cap] = snow
    tile[6:8, 6:10] = snes(np.array([210, 206, 198]))
    return dither_to_pal(tile, pal, 6.0)


def mountain_peak(rock: np.ndarray, pal: np.ndarray) -> np.ndarray:
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    dist = np.abs(x - 7.5) + (y - 2) * 0.45
    snow = snes(np.array([236, 240, 244]))
    ice = snes(np.array([196, 214, 228]))
    rock_c = pal[len(pal) // 3]
    tile = np.broadcast_to(rock_c, (N, N, 3)).copy()
    tile = shade(rock, 0.7 + noise(7, 0.6) * 0.25)
    tile[dist < 6.2] = ice
    tile[dist < 4.0] = snow
    mask = y > 12
    tile[mask] = rock[mask]
    tile[:, :3] = shade(tile[:, :3], 0.62)
    return dither_to_pal(tile, pal, 6.0)


def mountain_cliff(rock: np.ndarray, pal: np.ndarray) -> np.ndarray:
    y, x = np.mgrid[0:N, 0:N]
    bands = ((x + (y // 3)) % 5)
    tile = shade(rock, 0.45 + (bands < 2).astype(np.float32) * 0.22)
    dark = pal[np.argmin(pal.sum(1))]
    tile[:, 0] = dark
    tile[:, -1] = dark
    tile[::4, 7] = snes(np.array([120, 108, 96]))
    return dither_to_pal(tile, pal, 7.0)


def dune(sand: np.ndarray, pal: np.ndarray, phase: int) -> np.ndarray:
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    band = np.sin((x + y * 1.4 + phase * 4) * 0.55)
    tile = shade(sand, 0.82 + (band + 1) * 0.16)
    lip = (band > 0.55) & (band < 0.85)
    tile[lip] = snes(np.array([232, 196, 128]))
    shadow = band < -0.4
    tile[shadow] = snes((tile[shadow].astype(np.int16) * 72 // 100).clip(0, 255))
    return dither_to_pal(tile, pal, 6.0)


def metal_tile(seed: int) -> np.ndarray:
    pal = snes(np.array([
        [36, 40, 48], [52, 58, 68], [70, 78, 90], [88, 96, 108],
        [40, 120, 132], [24, 28, 34], [120, 128, 140], [18, 20, 26],
    ]))
    n = noise(seed, 0.7)
    base = lerp_rgb(
        np.broadcast_to(pal[1], (N, N, 3)),
        np.broadcast_to(pal[3], (N, N, 3)),
        n,
    )
    base[0] = pal[7]
    base[-1] = pal[7]
    base[:, 0] = pal[7]
    base[:, -1] = pal[7]
    if seed % 2:
        base[7:9, 3:13] = pal[4]
    else:
        base[3:13, 7:9] = pal[4]
    return dither_to_pal(base, pal, 5.0)


def snow_tile(rock: np.ndarray, pal_rock: np.ndarray, seed: int) -> np.ndarray:
    pal = snes(np.array([
        [228, 236, 244], [208, 220, 232], [188, 204, 220],
        [244, 248, 252], [160, 176, 196], [120, 140, 164],
    ]))
    n = noise(seed, 0.45)
    ice = lerp_rgb(
        np.broadcast_to(pal[0], (N, N, 3)),
        np.broadcast_to(pal[2], (N, N, 3)),
        n,
    )
    speck = n > 0.78
    ice[speck] = pal[3]
    # peek of rock
    if seed % 2 == 0:
        ice[12:15, 4:8] = shade(rock[12:15, 4:8], 0.85)
    return dither_to_pal(ice, pal, 6.0)


def foam_tile(water: np.ndarray, pal: np.ndarray, phase: int = 0) -> np.ndarray:
    tile = water.copy()
    white = snes(np.array([232, 244, 248]))
    mist = snes(np.array([176, 216, 228]))
    y, x = np.mgrid[0:N, 0:N]
    crest = np.sin((y * 2 + x + phase) * (2 * math.pi / 16.0))
    tile[crest > 0.35] = mist
    tile[crest > 0.72] = white
    for yy in range(N):
        if (yy + phase) % 4 == 1:
            for xx in range((yy * 2 + phase) % 4, N, 5):
                tile[yy, xx] = white
    return dither_to_pal(tile, np.vstack([pal[:6] if len(pal) >= 6 else pal, white, mist]), 3.0)


def put(atlas: Image.Image, idx: int, tile: np.ndarray) -> None:
    x = (idx % COLS) * N
    y = (idx // COLS) * N
    atlas.paste(Image.fromarray(snes(tile), "RGB"), (x, y))


def seam_preview(tile: np.ndarray, path: Path) -> None:
    im = Image.fromarray(snes(tile), "RGB")
    big = Image.new("RGB", (N * 4, N * 4))
    for yy in range(4):
        for xx in range(4):
            big.paste(im, (xx * N, yy * N))
    big.resize((128, 128), Image.Resampling.NEAREST).save(path)


def main() -> None:
    grass_p = load_plate("grass.jpg")
    dirt_p = load_plate("dirt.jpg")
    sand_p = load_plate("sand.jpg")
    water_p = load_plate("water.jpg")
    rock_p = load_plate("rock.jpg")

    gpal = palette_of(grass_p, 10)
    dpal = palette_of(dirt_p, 10)
    spal = palette_of(sand_p, 12)
    wpal = palette_of(water_p, 10)
    rpal = palette_of(rock_p, 12)

    grass = grass_tile(1)
    grass2 = grass_tile(2)

    dirt = dither_to_pal(crop(dirt_p, 4, 20), dpal)
    dirt2 = dither_to_pal(crop(dirt_p, 36, 8), dpal)
    canyon = dither_to_pal(shade(crop(dirt_p, 16, 48), 0.78 + noise(11) * 0.3), dpal)
    canyon2 = dither_to_pal(shade(crop(dirt_p, 60, 16), 0.7 + noise(12) * 0.28), dpal)

    sand = dither_to_pal(crop(sand_p, 12, 6), spal)
    sand2 = dither_to_pal(crop(sand_p, 44, 32), spal)
    sand_dune = dune(sand, spal, 0)
    sand_dune2 = dune(sand2, spal, 2)

    w0 = water_frame(0)
    w1 = water_frame(2)
    w2 = water_frame(4)
    w3 = water_frame(6)
    water_deep = water_frame(1, deep=True)
    foam = foam_tile(w0, wpal, 0)

    snow = snow_tile(crop(rock_p, 0, 0), rpal, 21)
    snow2 = snow_tile(crop(rock_p, 20, 20), rpal, 22)

    mt = mountain_fill(crop(rock_p, 8, 8), rpal, 30)
    mt2 = mountain_fill(crop(rock_p, 40, 24), rpal, 31)
    peak = mountain_peak(crop(rock_p, 16, 16), rpal)
    mtl = mountain_slope(crop(rock_p, 4, 12), rpal, "L")
    mtr = mountain_slope(crop(rock_p, 20, 4), rpal, "R")
    ridge = mountain_ridge(crop(rock_p, 28, 8), rpal)
    cliff = mountain_cliff(crop(rock_p, 12, 36), rpal)
    mtsnow = mountain_peak(crop(rock_p, 48, 8), rpal)
    rock = speckle(dither_to_pal(crop(rock_p, 56, 40), rpal), rpal, 9, 0.1)

    metal = metal_tile(50)
    metal2 = metal_tile(51)

    rd = road_tile("plain", dirt)
    rdv = road_tile("V", dirt)
    rdh = road_tile("H", dirt)
    rdx = road_tile("X", dirt)

    atlas = Image.new("RGB", (COLS * N, ROWS * N), (20, 24, 32))
    tiles = {
        0: grass,
        1: grass2,
        2: dirt,
        3: dirt2,
        4: sand,
        5: sand2,
        6: w0,
        7: w1,
        8: snow,
        9: snow2,
        10: rd,
        11: rdv,
        12: rdh,
        13: rdx,
        14: shore(grass, w0, "S"),
        15: shore(dirt, w0, "S"),
        16: shore(sand, w0, "S"),
        17: shore(snow, w0, "S"),
        18: shore(grass, w0, "N"),
        19: shore(dirt, w0, "N"),
        20: shore(sand, w0, "N"),
        21: shore(snow, w0, "N"),
        22: metal,
        23: metal2,
        24: mt,
        25: mt2,
        26: peak,
        27: mtl,
        28: mtr,
        29: ridge,
        30: cliff,
        31: sand_dune,
        32: w2,
        33: w3,
        34: foam,
        35: rock,
        36: shore(sand, w0, "E"),
        37: shore(sand, w0, "W"),
        38: shore(grass, w0, "E"),
        39: shore(grass, w0, "W"),
        40: shore(dirt, w0, "E"),
        41: shore(dirt, w0, "W"),
        42: canyon,
        43: canyon2,
        44: shore(snow, w0, "E"),
        45: shore(snow, w0, "W"),
        46: mtsnow,
        47: water_deep,
        48: sand_dune2,
        49: shore(mt, w0, "S"),
        50: shore(mt, w0, "N"),
    }
    for i, t in tiles.items():
        put(atlas, i, t)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT)
    SEAM.mkdir(parents=True, exist_ok=True)
    seam_preview(sand, SEAM / "seam_sand.png")
    seam_preview(w0, SEAM / "seam_water.png")
    strip = Image.new("RGB", (N * 4, N))
    for i, frame in enumerate((w0, w1, w2, w3)):
        strip.paste(Image.fromarray(snes(frame), "RGB"), (i * N, 0))
    strip.resize((strip.width * 8, strip.height * 8), Image.Resampling.NEAREST).save(SEAM / "water_frames.png")
    seam_preview(mt, SEAM / "seam_dirt.png")
    seam_preview(grass, SEAM / "seam_grass.png")
    seam_preview(ridge, SEAM / "seam_ridge.png")
    atlas.resize((atlas.width * 4, atlas.height * 4), Image.Resampling.NEAREST).save(
        SEAM / "atlas_preview.png"
    )
    print("wrote", OUT, atlas.size, "tiles", len(tiles))


if __name__ == "__main__":
    main()
