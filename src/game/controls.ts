export type Act = "left" | "right" | "up" | "down" | "fire" | "bomb" | "special" | "mode" | "pause";
export type Device = "keys" | "pad" | "both";
export type Side = {
  device: Device;
  keys: Record<Act, string>;
  pad: Record<Act, number>;
};
export type ControlConfig = { p1: Side; p2: Side };

export const ACTS: Act[] = ["up", "down", "left", "right", "fire", "bomb", "special", "mode", "pause"];
export const ACT_LABEL: Record<Act, string> = {
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
  fire: "SHOT",
  bomb: "BOMB",
  special: "SPECIAL",
  mode: "DRONES",
  pause: "PAUSE",
};

const PAD_NAMES = ["Cross", "Circle", "Square", "Triangle", "L1", "R1", "L2", "R2", "Share", "Options", "L3", "R3", "D-Up", "D-Down", "D-Left", "D-Right"];

export function padButtonLabel(n: number) {
  return PAD_NAMES[n] ?? `B${n}`;
}

export function keyLabel(code: string) {
  if (code === "Space") return "SPACE";
  if (code === "Enter") return "ENTER";
  if (code === "ShiftRight") return "R-SHIFT";
  if (code === "ShiftLeft") return "SHIFT";
  if (code === "ControlRight") return "R-CTRL";
  if (code === "ControlLeft") return "CTRL";
  return code.replace(/^Key/, "").replace(/^Arrow/, "").replace(/^Digit/, "").replace(/^Numpad/, "N");
}

function side(device: Device, keys: Record<Act, string>, pad: Record<Act, number>): Side {
  return { device, keys, pad };
}

export function defaultControls(): ControlConfig {
  const pad = { left: 14, right: 15, up: 12, down: 13, fire: 0, bomb: 1, special: 2, mode: 3, pause: 9 };
  return {
    p1: side("both", {
      left: "KeyA",
      right: "KeyD",
      up: "KeyW",
      down: "KeyS",
      fire: "Space",
      bomb: "KeyX",
      special: "KeyZ",
      mode: "KeyC",
      pause: "KeyP",
    }, { ...pad }),
    p2: side("keys", {
      left: "ArrowLeft",
      right: "ArrowRight",
      up: "ArrowUp",
      down: "ArrowDown",
      fire: "Enter",
      bomb: "ShiftRight",
      special: "ControlRight",
      mode: "KeyM",
      pause: "KeyO",
    }, { ...pad }),
  };
}

const STORE = "vf-controls-v1";

export function loadControls(): ControlConfig {
  const base = defaultControls();
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    for (const id of ["p1", "p2"] as const) {
      const s = parsed?.[id];
      if (!s) continue;
      if (s.device === "keys" || s.device === "pad" || s.device === "both") base[id].device = s.device;
      for (const act of ACTS) {
        if (typeof s.keys?.[act] === "string") base[id].keys[act] = s.keys[act];
        if (typeof s.pad?.[act] === "number") base[id].pad[act] = s.pad[act];
      }
    }
  } catch {
    /* keep defaults */
  }
  return base;
}

export function saveControls(cfg: ControlConfig) {
  try {
    localStorage.setItem(STORE, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}
