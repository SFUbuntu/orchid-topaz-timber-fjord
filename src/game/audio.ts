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
  song = "off";
  trackGen = 0;
  musicSrc: AudioBufferSourceNode | null = null;
  buffers = new Map<string, Promise<AudioBuffer>>();
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
      this.music.gain.value = 0.55;
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
    void this.loadTrack("title").catch(() => {});
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

  loadTrack(id: string) {
    const url = TRACKS[id];
    if (!url || !this.ctx) return Promise.reject(new Error("no track"));
    const hit = this.buffers.get(id);
    if (hit) return hit;
    const ctx = this.ctx;
    const job = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(url);
        return r.arrayBuffer();
      })
      .then((buf) => ctx.decodeAudioData(buf.slice(0)));
    this.buffers.set(id, job);
    job.catch(() => this.buffers.delete(id));
    return job;
  }

  playTrack(id: string) {
    this.unlock();
    if (!id || !TRACKS[id]) return;
    if (this.song === id) return;
    this.stopMusic();
    if (!this.ctx || !this.music) return;
    this.song = id;
    const token = this.trackGen;
    void this.loadTrack(id).then((buf) => {
      if (this.trackGen !== token || !this.ctx || !this.music) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.music);
      src.start();
      this.musicSrc = src;
      src.onended = () => {
        if (this.musicSrc === src) this.musicSrc = null;
      };
    }).catch(() => {
      if (this.trackGen === token) this.song = "off";
    });
  }

  startTitleMusic() {
    this.playTrack("title");
  }

  startHangarMusic() {
    this.playTrack("hangar");
  }

  startBriefMusic() {
    this.playTrack("brief");
  }

  startContractMusic() {
    this.playTrack("contract");
  }

  startClearMusic() {
    this.playTrack("clear");
  }

  startEndingMusic() {
    this.playTrack("ending");
  }

  startMusic(stage: number) {
    this.stage = stage;
    const n = Math.max(0, Math.min(9, stage | 0));
    this.playTrack("stage-" + String(n + 1).padStart(2, "0"));
  }

  startBossMusic(stage = 0) {
    this.playTrack(stage >= 9 ? "final" : "boss");
  }

  startBonusMusic() {
    this.playTrack("bonus");
  }

  stopMusic() {
    this.song = "off";
    this.trackGen += 1;
    if (this.titleTimer != null) {
      clearTimeout(this.titleTimer);
      this.titleTimer = null;
    }
    try {
      this.musicSrc?.stop();
    } catch {
      /* already stopped */
    }
    this.musicSrc?.disconnect();
    this.musicSrc = null;
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

const TRACKS: Record<string, string> = {
  title: "/music/title.mp3",
  hangar: "/music/hangar.mp3",
  brief: "/music/briefing.mp3",
  contract: "/music/contract.mp3",
  clear: "/music/stage-clear.mp3",
  bonus: "/music/bonus.mp3",
  boss: "/music/boss.mp3",
  final: "/music/final-boss.mp3",
  ending: "/music/ending.mp3",
  "stage-01": "/music/stage-01.mp3",
  "stage-02": "/music/stage-02.mp3",
  "stage-03": "/music/stage-03.mp3",
  "stage-04": "/music/stage-04.mp3",
  "stage-05": "/music/stage-05.mp3",
  "stage-06": "/music/stage-06.mp3",
  "stage-07": "/music/stage-07.mp3",
  "stage-08": "/music/stage-08.mp3",
  "stage-09": "/music/stage-09.mp3",
  "stage-10": "/music/stage-10.mp3"
};
