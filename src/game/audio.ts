export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  music: GainNode | null = null;
  sfx: GainNode | null = null;
  muted = false;
  musicTimer = 0;
  stage = 0;
  osc: OscillatorNode | null = null;
  lfo: OscillatorNode | null = null;
  titleNodes: AudioNode[] = [];
  titleTimer: number | null = null;
  song: "off" | "title" | "sortie" | "dune" | "tide" | "crown" | "boss" | "bonus" = "off";
  gen = 0;
  noiseBuf: AudioBuffer | null = null;
  visBound = false;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.music.gain.value = 0.2;
      this.sfx.gain.value = 0.28;
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 0.12;
      this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (!this.visBound) {
      this.visBound = true;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.ctx?.state === "suspended") void this.ctx.resume();
      });
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  beep(freq: number, dur = 0.08, type: OscillatorType = "square", vol = 0.4, slide = 0) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  shot() {
    this.beep(880 + Math.random() * 80, 0.05, "square", 0.12, -400);
  }
  boom() {
    this.beep(120 + Math.random() * 40, 0.28, "square", 0.22, -80);
  }
  hit() {
    this.beep(320, 0.06, "triangle", 0.18, -200);
  }
  pickup() {
    this.beep(660, 0.08, "square", 0.22, 400);
  }
  bomb() {
    this.beep(80, 0.5, "triangle", 0.42, -40);
  }
  overdrive() {
    this.beep(220, 0.2, "square", 0.2, 600);
  }
  launch() {
    this.beep(110, 0.22, "square", 0.16, 80);
    this.beep(220, 0.35, "square", 0.12, 180);
    this.beep(55, 0.4, "triangle", 0.14, 30);
  }
  count(n: string) {
    const f = n === "3" ? 392 : n === "2" ? 494 : 660;
    this.beep(f, 0.28, "square", 0.26, 80);
  }
  die() {
    this.beep(180, 0.45, "square", 0.28, -150);
  }
  warn() {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = [740, 620, 520];
    for (let i = 0; i < notes.length; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "square";
      o.frequency.value = notes[i];
      const start = t + i * 0.22;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      o.connect(g);
      g.connect(this.sfx);
      o.start(start);
      o.stop(start + 0.22);
    }
  }
  boss() {
    this.beep(196, 0.18, "square", 0.28, 80);
    this.beep(247, 0.22, "square", 0.22, 120);
    this.beep(330, 0.28, "square", 0.2, 160);
  }
  phase() {
    this.beep(160, 0.32, "square", 0.28, 280);
  }
  tell() {
    this.beep(980, 0.09, "square", 0.16, 220);
  }

  midiHz(m: number) {
    return 440 * 2 ** ((m - 69) / 12);
  }

  tone(freq: number, when: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.music || !freq) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(this.music);
    o.start(when);
    o.stop(when + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  hat(when: number, vol = 0.045) {
    if (!this.ctx || !this.music || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    src.connect(f);
    f.connect(g);
    g.connect(this.music);
    src.start(when);
    src.stop(when + 0.08);
  }

  kick(when: number) {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(148, when);
    o.frequency.exponentialRampToValueAtTime(46, when + 0.1);
    g.gain.setValueAtTime(0.28, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
    o.connect(g);
    g.connect(this.music);
    o.start(when);
    o.stop(when + 0.16);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  snare(when: number) {
    if (!this.ctx || !this.music || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    src.connect(f);
    f.connect(g);
    g.connect(this.music);
    src.start(when);
    src.stop(when + 0.14);
    this.tone(220, when, 0.06, "triangle", 0.06);
  }

  scheduleTune(name: Sfx["song"], tune: ChipTune) {
    this.unlock();
    if (this.song === name) return;
    this.stopMusic();
    if (!this.ctx || !this.music) return;
    this.song = name;
    const token = this.gen;
    const steps = Math.max(tune.bass.length, tune.lead.length, 16);
    const step = 60 / tune.bpm / 4;
    const loop = () => {
      if (this.gen !== token || !this.ctx) return;
      if (!this.muted) {
        const t0 = this.ctx.currentTime + 0.04;
        for (let i = 0; i < steps; i++) {
          const t = t0 + i * step;
          const b = tune.bass[i % tune.bass.length];
          if (b) {
            this.tone(this.midiHz(b), t, step * 1.55, "triangle", 0.2);
            this.tone(this.midiHz(b) * 0.5, t, step * 1.55, "sine", 0.07);
          }
          const a = tune.arp[i % tune.arp.length];
          if (a) this.tone(this.midiHz(a), t, step * 0.4, "square", 0.042);
          const l = tune.lead[i % tune.lead.length];
          if (l) {
            this.tone(this.midiHz(l), t, step * 0.7, "square", 0.095);
            this.tone(this.midiHz(l) * 1.004, t, step * 0.7, "square", 0.04);
          }
          if (tune.kick[i % tune.kick.length] === "x") this.kick(t);
          if (tune.snare[i % tune.snare.length] === "x") this.snare(t);
          if (tune.hat[i % tune.hat.length] === "x") this.hat(t, i % 4 === 0 ? 0.05 : 0.026);
        }
      }
      this.titleTimer = window.setTimeout(loop, steps * step * 1000 - 28);
    };
    loop();
  }

  startTitleMusic() {
    this.scheduleTune("title", TUNES.title);
  }

  startMusic(stage: number) {
    this.stage = stage;
    const key = stage <= 2 ? "sortie" : stage <= 5 ? "dune" : stage <= 7 ? "tide" : "crown";
    this.scheduleTune(key, TUNES[key]);
  }

  startBossMusic() {
    this.scheduleTune("boss", TUNES.boss);
  }

  startBonusMusic() {
    this.scheduleTune("bonus", TUNES.bonus);
  }

  stopMusic() {
    this.song = "off";
    this.gen += 1;
    if (this.titleTimer != null) {
      clearTimeout(this.titleTimer);
      this.titleTimer = null;
    }
    try {
      this.osc?.stop();
      this.lfo?.stop();
    } catch {
      /* already stopped */
    }
    this.osc?.disconnect();
    this.lfo?.disconnect();
    this.osc = null;
    this.lfo = null;
  }
}

type ChipTune = {
  bpm: number;
  bass: number[];
  arp: number[];
  lead: number[];
  kick: string;
  snare: string;
  hat: string;
};

const TUNES: Record<"title" | "sortie" | "dune" | "tide" | "crown" | "boss" | "bonus", ChipTune> = {
  title: {
    bpm: 150,
    bass: [45, 0, 45, 0, 40, 0, 43, 0, 45, 0, 47, 0, 40, 0, 43, 0, 38, 0, 38, 0, 40, 0, 42, 0, 43, 0, 45, 0, 40, 0, 43, 0],
    arp: [69, 72, 76, 72, 69, 67, 64, 67, 69, 72, 76, 79, 76, 72, 69, 67, 64, 67, 69, 72, 76, 72, 69, 64, 62, 0, 64, 67, 69, 67, 64, 62],
    lead: [76, 0, 79, 76, 81, 79, 76, 72, 76, 0, 79, 83, 81, 79, 76, 74, 72, 74, 76, 0, 79, 76, 72, 69, 67, 0, 69, 72, 74, 72, 69, 67],
    kick: "x...x...x...x.x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x."
  },
  sortie: {
    bpm: 140,
    bass: [50, 50, 0, 50, 45, 45, 0, 48, 50, 50, 53, 55, 57, 0, 55, 53, 50, 50, 0, 50, 48, 48, 0, 43, 45, 45, 48, 50, 53, 0, 50, 48],
    arp: [0, 69, 0, 72, 0, 74, 0, 72, 0, 69, 0, 65, 0, 69, 0, 72, 0, 65, 0, 69, 0, 72, 0, 69, 0, 62, 0, 65, 0, 69, 0, 65],
    lead: [74, 0, 77, 81, 79, 77, 74, 0, 72, 74, 77, 0, 79, 77, 74, 72, 69, 0, 72, 74, 77, 0, 74, 72, 65, 69, 72, 74, 72, 69, 65, 62],
    kick: "x...x...x...x.x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.xx"
  },
  dune: {
    bpm: 132,
    bass: [42, 42, 0, 42, 49, 49, 0, 47, 42, 42, 45, 47, 49, 0, 47, 45, 54, 54, 0, 52, 49, 49, 0, 47, 42, 42, 40, 42, 45, 0, 42, 40],
    arp: [0, 66, 0, 69, 0, 73, 0, 69, 0, 66, 0, 61, 0, 66, 0, 69, 0, 61, 0, 66, 0, 69, 0, 66, 0, 54, 0, 61, 0, 66, 0, 61],
    lead: [66, 0, 69, 73, 71, 69, 66, 0, 61, 66, 69, 0, 73, 71, 69, 66, 64, 0, 66, 69, 73, 0, 69, 66, 61, 64, 66, 69, 66, 64, 61, 54],
    kick: "x...x...x...x...",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x."
  },
  tide: {
    bpm: 126,
    bass: [45, 0, 45, 52, 45, 0, 48, 52, 43, 0, 43, 50, 43, 0, 47, 50, 41, 0, 41, 48, 41, 0, 45, 48, 43, 0, 43, 50, 45, 0, 48, 52],
    arp: [0, 69, 0, 72, 0, 76, 0, 72, 0, 67, 0, 69, 0, 72, 0, 69, 0, 64, 0, 67, 0, 69, 0, 64, 0, 67, 0, 69, 0, 72, 0, 69],
    lead: [69, 72, 76, 0, 79, 76, 72, 69, 67, 64, 67, 69, 72, 69, 64, 60, 69, 0, 72, 76, 74, 72, 69, 0, 64, 67, 69, 72, 69, 64, 60, 57],
    kick: "x...x.x.x...x...",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x."
  },
  crown: {
    bpm: 118,
    bass: [43, 43, 43, 0, 50, 50, 0, 46, 43, 43, 46, 48, 50, 0, 48, 46, 39, 39, 39, 0, 46, 46, 0, 43, 41, 41, 43, 46, 48, 0, 46, 43],
    arp: [0, 58, 0, 62, 0, 67, 0, 62, 0, 58, 0, 55, 0, 58, 0, 62, 0, 55, 0, 58, 0, 62, 0, 58, 0, 51, 0, 55, 0, 58, 0, 55],
    lead: [70, 0, 67, 70, 74, 0, 70, 67, 65, 0, 67, 70, 74, 77, 74, 70, 67, 0, 70, 74, 72, 70, 67, 65, 62, 65, 67, 70, 67, 62, 58, 55],
    kick: "x.....x.x.......",
    snare: "........x.......",
    hat: "x...x...x...x.x."
  },
  boss: {
    bpm: 168,
    bass: [40, 40, 40, 40, 43, 43, 40, 38, 40, 40, 47, 43, 40, 38, 36, 38, 40, 40, 40, 43, 47, 47, 43, 40, 38, 38, 36, 38, 40, 43, 40, 38],
    arp: [67, 71, 76, 71, 67, 64, 67, 71, 76, 79, 76, 71, 67, 64, 59, 64, 67, 71, 76, 79, 83, 79, 76, 71, 67, 64, 59, 64, 67, 71, 67, 64],
    lead: [76, 79, 83, 79, 76, 0, 71, 76, 79, 83, 86, 83, 79, 76, 71, 67, 76, 0, 79, 83, 88, 86, 83, 79, 76, 71, 67, 71, 76, 79, 76, 71],
    kick: "x.x.x.x.x.x.x.x.",
    snare: "..x...x...x...x.",
    hat: "xxxxxxxxxxxxxxxx"
  },
  bonus: {
    bpm: 160,
    bass: [48, 48, 0, 48, 55, 55, 0, 52, 48, 48, 52, 55, 60, 0, 55, 52, 53, 53, 0, 53, 50, 50, 0, 47, 48, 48, 52, 55, 60, 0, 55, 52],
    arp: [0, 72, 0, 76, 0, 79, 0, 76, 0, 72, 0, 67, 0, 72, 0, 76, 0, 71, 0, 72, 0, 76, 0, 72, 0, 67, 0, 64, 0, 67, 0, 72],
    lead: [72, 76, 79, 84, 79, 76, 72, 0, 71, 72, 76, 79, 76, 72, 67, 64, 72, 0, 76, 79, 84, 83, 79, 76, 72, 67, 64, 67, 72, 76, 72, 67],
    kick: "x...x...x...x.x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.xx"
  }
};
