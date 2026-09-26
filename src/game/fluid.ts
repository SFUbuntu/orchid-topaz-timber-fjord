/** Linearized shallow-water field. Height plus foam advected by the surface slope. */

const COLS = 45;
const ROWS = 80;
const CELL = 8;
const N = COLS * ROWS;

export class Fluid {
  readonly cols = COLS;
  readonly rows = ROWS;
  readonly cell = CELL;
  h = new Float32Array(N);
  prev = new Float32Array(N);
  next = new Float32Array(N);
  foam = new Float32Array(N);
  foam2 = new Float32Array(N);
  wet = new Uint8Array(N);
  private shift = 0;

  clear() {
    this.h.fill(0);
    this.prev.fill(0);
    this.next.fill(0);
    this.foam.fill(0);
    this.foam2.fill(0);
    this.shift = 0;
  }

  impulse(x: number, y: number, mag: number) {
    const c = (x / CELL) | 0;
    const r = (y / CELL) | 0;
    if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) return;
    const i = r * COLS + c;
    const v = this.h[i] + mag;
    this.h[i] = v > 5 ? 5 : v < -5 ? -5 : v;
    this.foam[i] = Math.min(1, this.foam[i] + Math.abs(mag) * 0.4);
  }

  wake(x: number, y: number) {
    this.impulse(x, y, 0.16);
    this.impulse(x - 7, y + 8, 0.06);
    this.impulse(x + 7, y + 8, 0.06);
  }

  private shiftDown() {
    const row = COLS;
    const keep = (ROWS - 1) * COLS;
    this.h.copyWithin(row, 0, keep);
    this.h.fill(0, 0, COLS);
    this.prev.copyWithin(row, 0, keep);
    this.prev.fill(0, 0, COLS);
    this.foam.copyWithin(row, 0, keep);
    this.foam.fill(0, 0, COLS);
  }

  private shiftUp() {
    const row = COLS;
    const keep = (ROWS - 1) * COLS;
    this.h.copyWithin(0, row, keep + row);
    this.h.fill(0, keep, N);
    this.prev.copyWithin(0, row, keep + row);
    this.prev.fill(0, keep, N);
    this.foam.copyWithin(0, row, keep + row);
    this.foam.fill(0, keep, N);
  }

  scroll(dy: number) {
    this.shift += dy;
    let guard = 0;
    while (this.shift >= CELL && guard++ < ROWS) {
      this.shift -= CELL;
      this.shiftDown();
    }
    guard = 0;
    while (this.shift <= -CELL && guard++ < ROWS) {
      this.shift += CELL;
      this.shiftUp();
    }
  }

  step(dt: number, scrollDy: number, wetAt: (x: number, y: number) => boolean) {
    this.scroll(scrollDy);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CELL + CELL * 0.5;
        const y = r * CELL + CELL * 0.5;
        this.wet[r * COLS + c] = y > -8 && y < 648 && wetAt(x, y) ? 1 : 0;
      }
    }
    const sub = Math.max(1, Math.min(3, Math.round(dt * 60)));
    const damp = Math.pow(0.97, (60 / sub) * dt);
    for (let s = 0; s < sub; s++) this.propagate(damp);
    this.advectFoam();
  }

  private propagate(damp: number) {
    const { h, prev, next, wet } = this;
    for (let r = 1; r < ROWS - 1; r++) {
      const row = r * COLS;
      for (let c = 1; c < COLS - 1; c++) {
        const i = row + c;
        if (!wet[i]) {
          next[i] = 0;
          continue;
        }
        const l = wet[i - 1] ? h[i - 1] : 0;
        const right = wet[i + 1] ? h[i + 1] : 0;
        const up = wet[i - COLS] ? h[i - COLS] : 0;
        const down = wet[i + COLS] ? h[i + COLS] : 0;
        let v = (l + right + up + down) * 0.5 - prev[i];
        v *= damp;
        next[i] = v > 3 ? 3 : v < -3 ? -3 : v;
      }
    }
    prev.set(h);
    h.set(next);
  }

  private advectFoam() {
    const { h, foam, foam2, wet } = this;
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        const i = r * COLS + c;
        if (!wet[i]) {
          foam2[i] = 0;
          continue;
        }
        const gx = h[i - 1] - h[i + 1];
        const gy = h[i - COLS] - h[i + COLS];
        const sc = Math.max(1, Math.min(COLS - 2, (c - gx * 0.9) | 0));
        const sr = Math.max(1, Math.min(ROWS - 2, (r - gy * 0.9) | 0));
        let f = foam[sr * COLS + sc] * 0.9;
        if (h[i] > 0.32) f = Math.min(1, f + (h[i] - 0.32) * 0.22);
        foam2[i] = f;
      }
    }
    foam.set(foam2);
  }

  draw(c: CanvasRenderingContext2D) {
    c.save();
    c.imageSmoothingEnabled = false;
    for (let r = 1; r < ROWS - 1; r++) {
      for (let col = 1; col < COLS - 1; col++) {
        const i = r * COLS + col;
        if (!this.wet[i]) continue;
        const ht = this.h[i];
        const f = this.foam[i];
        if (ht < 0.45 && ht > -0.4 && f < 0.28) continue;
        const x = col * CELL;
        const y = r * CELL;
        if (ht > 0.45) {
          c.globalAlpha = Math.min(0.5, (ht - 0.3) * 0.28);
          c.fillStyle = "#f4fdff";
          c.fillRect(x, y + 1, CELL, 1);
        } else if (ht < -0.4) {
          c.globalAlpha = Math.min(0.32, (-ht - 0.3) * 0.2);
          c.fillStyle = "#06303c";
          c.fillRect(x, y + 3, CELL, 2);
        }
        if (f > 0.28) {
          c.globalAlpha = Math.min(0.75, f);
          c.fillStyle = "#f7fdff";
          c.fillRect(x + 1, y + 2, 2, 1);
          if (f > 0.5) c.fillRect(x + 5, y + 5, 2, 1);
        }
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }
}
