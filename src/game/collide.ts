/** Squared distance — keep this off the `hypot` hot path. */
export function d2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function overlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const r = ar + br;
  return d2(ax, ay, bx, by) <= r * r;
}

/**
 * Capsule vs circle: the bullet's path this tick (x0,y0) → (x1,y1)
 * with radius `r` against a circle at (cx,cy,cr).
 * Catches shots that would otherwise tunnel through a small core.
 */
export function sweep(x0: number, y0: number, x1: number, y1: number, r: number, cx: number, cy: number, cr: number) {
  const rad = r + cr;
  const rad2 = rad * rad;
  if (d2(x0, y0, cx, cy) <= rad2 || d2(x1, y1, cx, cy) <= rad2) return true;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return false;
  let t = ((cx - x0) * dx + (cy - y0) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return d2(x0 + dx * t, y0 + dy * t, cx, cy) <= rad2;
}
