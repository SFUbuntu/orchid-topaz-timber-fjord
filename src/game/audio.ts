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
  song: "off" | "title" | "stage" = "off";
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
      this.music.gain.value = 0.16;
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
    this.beep(120 + Math.random() * 40, 0.28, "sawtooth", 0.35, -80);
  }
  hit() {
    this.beep(320, 0.06, "triangle", 0.18, -200);
  }
  pickup() {
    this.beep(660, 0.08, "square", 0.22, 400);
  }
  bomb() {
    this.beep(80, 0.5, "sawtooth", 0.5, -40);
  }
  overdrive() {
    this.beep(220, 0.2, "square", 0.2, 600);
  }
  launch() {
    this.beep(64, 0.85, "sawtooth", 0.34, 70);
    this.beep(110, 0.45, "square", 0.14, 240);
    this.beep(48, 0.6, "triangle", 0.18, 40);
  }
  count(n: string) {
    const f = n === "3" ? 392 : n === "2" ? 494 : 660;
    this.beep(f, 0.28, "square", 0.26, 80);
  }
  die() {
    this.beep(180, 0.45, "sawtooth", 0.4, -150);
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
    this.beep(55, 0.7, "sawtooth", 0.48, 30);
  }
  phase() {
    this.beep(160, 0.32, "sawtooth", 0.38, 280);
  }
  tell() {
    this.beep(980, 0.09, "square", 0.16, 220);
  }

  tone(freq: number, when: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.018);
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

  startTitleMusic() {
    this.unlock();
    if (this.song === "title") return;
    this.stopMusic();
    if (!this.ctx || !this.music) return;
    this.song = "title";
    const loop = () => {
      if (this.song !== "title" || !this.ctx) return;
      const t0 = this.ctx.currentTime + 0.02;
      const beat = 0.2;
      const bassA = [110, 110, 82.4, 98, 110, 123.5, 82.4, 98];
      const bassB = [73.4, 73.4, 82.4, 87.3, 98, 110, 82.4, 98];
      const arpA = [329.6, 392, 440, 392, 329.6, 293.7, 261.6, 293.7];
      const arpB = [246.9, 293.7, 329.6, 392, 329.6, 293.7, 261.6, 246.9];
      const lead = [
        659.3, 0, 783.9, 659.3, 880, 783.9, 659.3, 523.3,
        659.3, 0, 783.9, 987.8, 880, 783.9, 659.3, 587.3,
        523.3, 587.3, 659.3, 0, 783.9, 659.3, 523.3, 440,
        392, 0, 440, 523.3, 587.3, 523.3, 440, 392,
      ];
      for (let i = 0; i < 16; i++) {
        const t = t0 + i * beat;
        const bass = i < 8 ? bassA[i] : bassB[i - 8];
        const arp = i < 8 ? arpA[i % 8] : arpB[i % 8];
        this.tone(bass, t, beat * 0.92, "triangle", 0.24);
        this.tone(bass * 0.5, t, beat * 0.92, "sine", 0.1);
        this.tone(arp, t, beat * 0.42, "square", 0.07);
        this.tone(arp * 2, t + beat * 0.5, beat * 0.36, "square", 0.045);
        this.hat(t, i % 4 === 0 ? 0.055 : 0.03);
        this.hat(t + beat * 0.5, 0.022);
      }
      for (let i = 0; i < lead.length; i++) {
        if (!lead[i]) continue;
        this.tone(lead[i], t0 + i * (beat / 2), beat * 0.44, "square", 0.12);
      }
      this.titleTimer = window.setTimeout(loop, 16 * beat * 1000 - 40);
    };
    loop();
  }

  startMusic(stage: number) {
    this.stage = stage;
    this.unlock();
    this.stopMusic();
    if (!this.ctx || !this.music) return;
    this.song = "stage";
    const o = this.ctx.createOscillator();
    const l = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = "sawtooth";
    l.type = "sine";
    const base = [110, 98, 123, 92, 82, 73, 130, 87, 104, 69][stage % 10];
    o.frequency.value = base;
    l.frequency.value = 0.25 + stage * 0.05;
    const lg = this.ctx.createGain();
    lg.gain.value = 18;
    l.connect(lg);
    lg.connect(o.frequency);
    f.type = "lowpass";
    f.frequency.value = 420 + stage * 80;
    g.gain.value = 0.35;
    o.connect(f);
    f.connect(g);
    g.connect(this.music);
    o.start();
    l.start();
    this.osc = o;
    this.lfo = l;
  }

  stopMusic() {
    this.song = "off";
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
