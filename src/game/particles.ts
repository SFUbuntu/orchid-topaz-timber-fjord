export type ParticleKind = "spark" | "smoke" | "shard" | "ring" | "drop";

type Particle = {
  alive: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  s: number;
  grav: number;
  drag: number;
  rot: number;
  spin: number;
  grow: number;
};

const CAP = 480;

function blank(): Particle {
  return {
    alive: false,
    kind: "spark",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    color: "#fff",
    s: 2,
    grav: 0,
    drag: 0,
    rot: 0,
    spin: 0,
    grow: 0,
  };
}

export class Particles {
  list: Particle[] = [];

  private take() {
    for (const p of this.list) if (!p.alive) return p;
    if (this.list.length < CAP) {
      const p = blank();
      this.list.push(p);
      return p;
    }
    let worst = this.list[0];
    for (const p of this.list) if (p.life < worst.life) worst = p;
    return worst;
  }

  emit(src: Partial<Particle> & Pick<Particle, "x" | "y" | "kind">) {
    const p = this.take();
    const base = blank();
    Object.assign(p, base, src, { alive: true, max: src.max ?? src.life ?? 0.4 });
    return p;
  }

  spark(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 150;
      this.emit({
        kind: "spark",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.16 + Math.random() * 0.22,
        color,
        s: 1 + ((Math.random() * 2) | 0),
        drag: 2.8,
      });
    }
  }

  boom(x: number, y: number, color = "#ffb347", power = 1) {
    const punch = Math.max(0.4, power);
    this.spark(x, y, Math.round(6 + punch * 8), color);
    this.spark(x, y, Math.round(3 + punch * 3), "#fff6d0");
    const smokes = Math.round(3 + punch * 3);
    for (let i = 0; i < smokes; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 12 + Math.random() * 46;
      this.emit({
        kind: "smoke",
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 16,
        life: 0.4 + Math.random() * 0.35,
        color: i % 2 ? "#4a4038" : "#7a6a58",
        s: 3 + Math.random() * 4 * punch,
        grav: -24,
        drag: 1.8,
      });
    }
    const shards = Math.round(4 + punch * 4);
    for (let i = 0; i < shards; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this.emit({
        kind: "shard",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.32 + Math.random() * 0.28,
        color: i % 3 === 0 ? "#fff4c2" : color,
        s: 2 + Math.random() * 2,
        grav: 260,
        drag: 0.6,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 16,
      });
    }
    this.emit({
      kind: "ring",
      x,
      y,
      life: 0.26,
      color,
      s: 6 + punch * 4,
      grow: 90 + punch * 50,
    });
  }

  splash(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      this.emit({
        kind: "drop",
        x: x + (Math.random() - 0.5) * 10,
        y,
        vx: (Math.random() - 0.5) * 70,
        vy: -40 - Math.random() * 90,
        life: 0.28 + Math.random() * 0.2,
        color: i % 2 ? "#e8fbff" : "#7ee0e8",
        s: 2,
        grav: 280,
        drag: 0.4,
      });
    }
    this.emit({
      kind: "ring",
      x,
      y,
      life: 0.22,
      color: "#d8f6ff",
      s: 4,
      grow: 70,
    });
  }

  update(dt: number) {
    for (const p of this.list) {
      if (!p.alive) continue;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.s += p.grow * dt;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
  }

  draw(c: CanvasRenderingContext2D) {
    const smooth = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    for (const p of this.list) {
      if (!p.alive) continue;
      const k = Math.max(0, p.life / p.max);
      if (p.kind === "spark") {
        c.globalAlpha = Math.min(1, k * 1.5);
        c.strokeStyle = p.color;
        c.lineWidth = p.s;
        const mag = Math.hypot(p.vx, p.vy) || 1;
        const len = Math.min(8, mag * 0.035);
        c.beginPath();
        c.moveTo(p.x | 0, p.y | 0);
        c.lineTo((p.x - (p.vx / mag) * len) | 0, (p.y - (p.vy / mag) * len) | 0);
        c.stroke();
      } else if (p.kind === "smoke") {
        const r = Math.max(2, (p.s * (1.35 - k * 0.4)) | 0);
        c.globalAlpha = k * 0.42;
        c.fillStyle = p.color;
        c.fillRect((p.x - r) | 0, (p.y - r * 0.7) | 0, r * 2, (r * 1.3) | 0);
        c.globalAlpha = k * 0.25;
        c.fillRect((p.x - r * 0.4) | 0, (p.y - r) | 0, r, r);
      } else if (p.kind === "shard") {
        c.save();
        c.globalAlpha = Math.min(1, k * 1.6);
        c.translate(p.x | 0, p.y | 0);
        c.rotate(p.rot);
        c.fillStyle = p.color;
        c.fillRect(-p.s, -1, p.s * 2, 2);
        c.restore();
      } else if (p.kind === "ring") {
        c.globalAlpha = k * 0.75;
        c.strokeStyle = p.color;
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(p.x, p.y, Math.max(1, p.s), 0, Math.PI * 2);
        c.stroke();
      } else {
        c.globalAlpha = k;
        c.fillStyle = p.color;
        c.fillRect(p.x | 0, p.y | 0, p.s, p.s + 1);
      }
    }
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = smooth;
  }

  clear() {
    for (const p of this.list) p.alive = false;
  }
}
