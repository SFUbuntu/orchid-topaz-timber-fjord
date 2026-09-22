export type DecorKind = "bush" | "tree" | "rock" | "dune" | "cloud" | "grass" | "ruin";
export type TargetKind =
  | "bunker"
  | "radar"
  | "hangar"
  | "silo"
  | "dock"
  | "crate"
  | "tower"
  | "barrel"
  | "fuel"
  | "tree"
  | "bush"
  | "rock"
  | "hut";

export type Decor = {
  alive: boolean;
  x: number;
  y: number;
  wy?: number;
  kind: DecorKind;
  s: number;
  flip: number;
  phase: number;
};

export type Ground = {
  alive: boolean;
  x: number;
  y: number;
  wy?: number;
  kind: TargetKind;
  hp: number;
  maxHp: number;
  r: number;
  score: number;
  flash: number;
  t: number;
  mark: boolean;
};

export type StageTheme = {
  decor: DecorKind[];
  targets: TargetKind[];
  props: TargetKind[];
  water: "none" | "lake" | "sea";
  woods: boolean;
};

export const STAGE_THEME: StageTheme[] = [
  { decor: ["cloud"], targets: ["hangar", "bunker", "radar", "crate"], props: ["tree", "bush", "barrel", "fuel", "hut"], water: "sea", woods: true },
  { decor: ["cloud"], targets: ["tower", "radar", "crate"], props: ["barrel", "fuel", "rock", "hut"], water: "sea", woods: false },
  { decor: ["cloud"], targets: ["bunker", "crate", "radar"], props: ["tree", "bush", "barrel", "hut"], water: "lake", woods: true },
  { decor: ["cloud"], targets: ["bunker", "crate", "tower"], props: ["bush", "barrel", "fuel", "rock", "hut"], water: "lake", woods: false },
  { decor: ["cloud"], targets: ["tower", "bunker", "radar"], props: ["bush", "rock", "barrel", "fuel", "hut"], water: "lake", woods: false },
  { decor: ["cloud"], targets: ["silo", "bunker", "crate"], props: ["barrel", "fuel", "rock", "hut"], water: "none", woods: false },
  { decor: ["cloud"], targets: ["hangar", "radar", "tower"], props: ["barrel", "fuel", "crate", "hut"], water: "none", woods: false },
  { decor: ["cloud"], targets: ["dock", "crate", "bunker"], props: ["barrel", "fuel", "rock", "hut"], water: "sea", woods: false },
  { decor: ["cloud"], targets: ["hangar", "bunker", "tower", "crate"], props: ["barrel", "fuel", "rock", "hut"], water: "none", woods: false },
  { decor: ["cloud"], targets: ["tower", "hangar", "bunker", "radar"], props: ["barrel", "fuel", "rock", "hut", "tree"], water: "lake", woods: false },
];

export function isSoftTarget(kind: TargetKind) {
  return kind === "barrel" || kind === "tree" || kind === "bush" || kind === "rock";
}

export function isBlastTarget(kind: TargetKind) {
  return kind === "barrel" || kind === "fuel";
}

export function isBuilding(kind: TargetKind) {
  return (
    kind === "hangar" ||
    kind === "bunker" ||
    kind === "radar" ||
    kind === "silo" ||
    kind === "tower" ||
    kind === "hut" ||
    kind === "dock"
  );
}

export function targetSpec(kind: TargetKind): { hp: number; r: number; score: number } {
  if (kind === "bush") return { hp: 1, r: 12, score: 30 };
  if (kind === "tree") return { hp: 3, r: 16, score: 60 };
  if (kind === "barrel") return { hp: 2, r: 11, score: 80 };
  if (kind === "rock") return { hp: 6, r: 14, score: 90 };
  if (kind === "crate") return { hp: 4, r: 12, score: 250 };
  if (kind === "fuel") return { hp: 8, r: 16, score: 320 };
  if (kind === "hut") return { hp: 10, r: 16, score: 400 };
  if (kind === "radar") return { hp: 10, r: 16, score: 480 };
  if (kind === "bunker") return { hp: 16, r: 18, score: 620 };
  if (kind === "dock") return { hp: 14, r: 20, score: 540 };
  if (kind === "silo") return { hp: 18, r: 16, score: 700 };
  if (kind === "tower") return { hp: 20, r: 14, score: 800 };
  return { hp: 22, r: 22, score: 900 };
}

export function drawDecor(c: CanvasRenderingContext2D, d: Decor, t: number) {
  c.save();
  c.translate(d.x, d.y);
  if (d.flip < 0) c.scale(-1, 1);
  const s = d.s;
  if (d.kind === "bush") {
    c.fillStyle = "#2d6a28";
    c.beginPath();
    c.ellipse(0, -2, 14 * s, 8 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#4a9a3a";
    c.beginPath();
    c.ellipse(-6 * s, -6 * s, 8 * s, 7 * s, 0, 0, Math.PI * 2);
    c.ellipse(6 * s, -7 * s, 9 * s, 8 * s, 0, 0, Math.PI * 2);
    c.ellipse(0, -10 * s, 7 * s, 6 * s, 0, 0, Math.PI * 2);
    c.fill();
  } else if (d.kind === "tree") {
    c.fillStyle = "#3a2410";
    c.fillRect(-2.2 * s, -10 * s, 4.4 * s, 12 * s);
    c.fillStyle = "#163e18";
    c.beginPath();
    c.ellipse(-5 * s, -14 * s, 10 * s, 9 * s, 0, 0, Math.PI * 2);
    c.ellipse(6 * s, -15 * s, 11 * s, 10 * s, 0, 0, Math.PI * 2);
    c.ellipse(0, -22 * s, 9 * s, 8 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#2f7a32";
    c.beginPath();
    c.ellipse(-3 * s, -16 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2);
    c.ellipse(4 * s, -18 * s, 6.5 * s, 5.5 * s, 0, 0, Math.PI * 2);
    c.ellipse(0, -24 * s, 5 * s, 4.5 * s, 0, 0, Math.PI * 2);
    c.fill();
  } else if (d.kind === "rock") {
    c.fillStyle = "#5a5348";
    c.beginPath();
    c.moveTo(-12 * s, 0);
    c.lineTo(-6 * s, -16 * s);
    c.lineTo(4 * s, -20 * s);
    c.lineTo(14 * s, -6 * s);
    c.lineTo(8 * s, 0);
    c.closePath();
    c.fill();
    c.fillStyle = "#7a7368";
    c.beginPath();
    c.moveTo(-4 * s, -12 * s);
    c.lineTo(2 * s, -18 * s);
    c.lineTo(8 * s, -8 * s);
    c.closePath();
    c.fill();
  } else if (d.kind === "dune") {
    c.fillStyle = "#c4a060";
    c.beginPath();
    c.moveTo(-22 * s, 0);
    c.quadraticCurveTo(0, -16 * s, 22 * s, 0);
    c.closePath();
    c.fill();
  } else if (d.kind === "ruin") {
    c.fillStyle = "#6a6058";
    c.fillRect(-10 * s, -18 * s, 20 * s, 18 * s);
    c.fillStyle = "#8a8070";
    c.fillRect(-6 * s, -24 * s, 8 * s, 8 * s);
  } else if (d.kind === "grass") {
    c.strokeStyle = "#3d8a32";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-4, 0);
    c.quadraticCurveTo(-3, -8 * s, -1, -12 * s);
    c.moveTo(0, 0);
    c.quadraticCurveTo(1, -10 * s, 3, -14 * s);
    c.moveTo(4, 0);
    c.quadraticCurveTo(5, -7 * s, 6, -10 * s);
    c.stroke();
  } else if (d.kind === "cloud") {
    c.fillStyle = "#e8eef8";
    c.globalAlpha = 0.35 + Math.sin(t * 0.6 + d.phase) * 0.08;
    c.beginPath();
    c.ellipse(-10 * s, 0, 16 * s, 7 * s, 0, 0, Math.PI * 2);
    c.ellipse(8 * s, -2 * s, 14 * s, 6 * s, 0, 0, Math.PI * 2);
    c.ellipse(0, -6 * s, 10 * s, 6 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }
  c.restore();
}

export function drawGround(c: CanvasRenderingContext2D, g: Ground) {
  c.save();
  c.translate(g.x, g.y);
  c.fillStyle = "#3a342c";
  c.beginPath();
  c.ellipse(0, 4, g.r * 0.9, 5, 0, 0, Math.PI * 2);
  c.fill();
  if (g.kind === "tree") {
    c.fillStyle = "#3a2410";
    c.fillRect(-3, -14, 6, 18);
    c.fillStyle = "#163e18";
    c.beginPath();
    c.ellipse(-7, -18, 13, 11, 0, 0, Math.PI * 2);
    c.ellipse(8, -20, 14, 12, 0, 0, Math.PI * 2);
    c.ellipse(0, -28, 11, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#2f7a32";
    c.beginPath();
    c.ellipse(-4, -20, 7, 6, 0, 0, Math.PI * 2);
    c.ellipse(5, -23, 8, 6, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    c.fillStyle = g.flash > 0 ? "#fff4c2" : "#6a6860";
    c.fillRect(-g.r * 0.7, -g.r, g.r * 1.4, g.r * 1.15);
    c.fillStyle = "#3ec8ff";
    c.fillRect(-4, -g.r - 6, 8, 6);
  }
  c.restore();
}
