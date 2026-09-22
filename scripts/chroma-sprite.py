#!/usr/bin/env python3
"""Isolate a sprite from a magenta (or corner-sampled) background."""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def isolate(src: Path, dst: Path, size: int = 160) -> None:
    im = Image.open(src).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3].astype(np.float32)

    corners = np.vstack(
        [
            rgb[0:12, 0:12].reshape(-1, 3),
            rgb[0:12, -12:].reshape(-1, 3),
            rgb[-12:, 0:12].reshape(-1, 3),
            rgb[-12:, -12:].reshape(-1, 3),
        ]
    )
    bg = np.median(corners, axis=0)
    dist = np.linalg.norm(rgb - bg, axis=2)
    mag = np.array([255.0, 0.0, 255.0])
    magdist = np.linalg.norm(rgb - mag, axis=2)
    is_magenta = (arr[:, :, 0] > 150) & (arr[:, :, 2] > 150) & (arr[:, :, 1] < 170)
    mask_bg = (dist < 52) | (magdist < 90) | is_magenta

    trans = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def enq(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and not trans[y, x] and mask_bg[y, x]:
            trans[y, x] = True
            q.append((y, x))

    for x in range(w):
        enq(0, x)
        enq(h - 1, x)
    for y in range(h):
        enq(y, 0)
        enq(y, w - 1)
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            enq(y + dy, x + dx)

    alpha = np.where(trans, 0, 255).astype(np.uint8)
    arr[:, :, 3] = alpha
    ys, xs = np.where(alpha > 20)
    if len(xs) == 0:
        raise SystemExit(f"no opaque pixels in {src}")
    pad = 6
    x0, x1 = max(0, int(xs.min()) - pad), min(w, int(xs.max()) + pad + 1)
    y0, y1 = max(0, int(ys.min()) - pad), min(h, int(ys.max()) + pad + 1)
    cropped = Image.fromarray(arr[y0:y1, x0:x1], "RGBA")
    cropped.thumbnail((size, size), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(dst)
    opaque = int((np.array(cropped)[:, :, 3] > 20).mean() * 100)
    print(f"{src.name} -> {dst} {cropped.size} opaque={opaque}%")


if __name__ == "__main__":
    isolate(Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 160)
