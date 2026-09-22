import { useEffect, useRef, useState } from "react";
import { Heart, Medal, Pause, Sparkle, Volume2, VolumeX } from "lucide-react";
import { VectorFangGame, STAGES, BONUS_STAGES, type ClearReport, type Screen } from "@/game/engine";
import { continueCost, type HiEntry } from "@/game/hiscore";
import { BRIEFS, BUYOUT, CREW, CREW_MODES, CREW_PORTRAITS, DIFFS, ENDINGS, LORE, MISSION_INTRO, PILOTS, PILOT_ENDINGS, PILOT_INTRO, PORTRAITS, SHOP, canEquip, emptyLoadout, money, shopPrice, specialCap, specialCount, type CrewMode, type DiffId, type Ending, type Loadout, type ShipId, type ShopId } from "@/game/story";

const SHIP_ART: Record<ShipId, string> = {
  azure: "/sprites/azure.png",
  crimson: "/sprites/crimson.png",
  iron: "/sprites/iron.png",
};

function PilotDossier({ id, compact }: { id: ShipId; compact?: boolean }) {
  const p = PILOTS[id];
  const tone = id === "azure" ? "text-vf-cyan" : id === "crimson" ? "text-vf-crimson" : "text-vf-gold";
  return (
    <div className="rounded-sm border border-vf-line bg-vf-bg/85 p-2 text-left">
      <div className="flex gap-2">
        <img
          src={PORTRAITS[id]}
          alt=""
          className={compact ? "h-14 w-14 shrink-0 rounded-sm object-cover object-top" : "h-16 w-16 shrink-0 rounded-sm object-cover object-top"}
        />
        <div className="min-w-0 flex-1 font-mono text-[10px] leading-tight text-vf-ice">
          <p className={`font-display text-xs tracking-wide ${tone}`}>{p.name}</p>
          <p className="text-vf-mute">{p.call}</p>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-vf-mute">HEIGHT</span>
            <span>{p.height}</span>
            <span className="text-vf-mute">WEIGHT</span>
            <span>{p.weight}</span>
            <span className="text-vf-mute">NATION</span>
            <span>{p.country}</span>
            <span className="text-vf-mute">AIRCRAFT</span>
            <span>{p.plane}</span>
          </div>
        </div>
      </div>
      {!compact && <p className="mt-2 font-mono text-[10px] leading-relaxed text-vf-mute">{p.bio}</p>}
    </div>
  );
}

function HangarCatalog({
  ship,
  loadout,
  ammo,
  bounty,
  onBuy,
}: {
  ship: ShipId;
  loadout: Loadout;
  ammo: Loadout;
  bounty: number;
  onBuy: (id: ShopId) => void;
}) {
  const tile = (item: (typeof SHOP)[number], tone: "navy" | "bay") => {
    const owned = loadout[item.id];
    const price = shopPrice(item, ship, owned);
    const sold = owned >= item.max;
    const slotsFull = item.cat === "special" && owned === 0 && specialCount(loadout) >= specialCap(ship);
    const poor = bounty < price;
    return (
      <button
        key={item.id}
        type="button"
        disabled={sold || poor || slotsFull}
        className={`flex w-[72px] flex-col items-center gap-0.5 rounded-sm border px-1 py-1 disabled:opacity-40 ${
          tone === "navy" ? "border-vf-cyan/40 bg-vf-bg/70" : "border-vf-gold/40 bg-vf-bg/70"
        }`}
        onClick={() => onBuy(item.id)}
      >
        <img
          src={`/sprites/shop/${item.id}.png`}
          alt=""
          className="h-10 w-10 object-contain"
          style={{ imageRendering: "pixelated" }}
        />
        <span className="font-mono text-[9px] leading-none text-vf-ice">{item.name}</span>
        <span className="font-mono text-[9px] text-vf-gold">{sold ? "OWNED" : money(price)}</span>
        {owned > 0 && item.cat === "special" ? (
          <span className="font-mono text-[8px] text-vf-mute">{ammo[item.id]} rds</span>
        ) : owned > 0 ? (
          <span className="font-mono text-[8px] text-vf-mute">×{owned}</span>
        ) : null}
      </button>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-sm bg-vf-bg/80 px-2 py-1 font-mono text-xs text-vf-gold">
        <span>MONEY</span>
        <span>{money(bounty)}</span>
      </div>
      <p className="font-mono text-[10px] tracking-[0.2em] text-vf-cyan">
        SPECIALS {specialCount(loadout)}/{specialCap(ship)}
      </p>
      <div className="rounded-sm bg-vf-navy/90 p-2">
        <div className="flex flex-wrap gap-1">
          {SHOP.filter((item) => item.cat === "special" && canEquip(item, ship)).map((item) => tile(item, "navy"))}
        </div>
      </div>
      <div className="rounded-sm bg-vf-bay/90 p-2">
        <div className="flex flex-wrap gap-1">
          {SHOP.filter((item) => item.cat !== "special" && canEquip(item, ship)).map((item) => tile(item, "bay"))}
        </div>
      </div>
    </>
  );
}

export function VectorFang() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const gameRef = useRef<VectorFangGame | null>(null);
  const [screen, setScreen] = useState<Screen>("title");
  const [ship, setShip] = useState<ShipId>("azure");
  const [diff, setDiff] = useState<DiffId>("normal");
  const [vs, setVs] = useState(false);
  const [crew, setCrew] = useState<CrewMode>("solo");
  const [p2Ship, setP2Ship] = useState<ShipId>("crimson");
  const [hud, setHud] = useState({
    score: 0,
    hi: 0,
    lives: 3,
    bombs: 3,
    power: 0,
    drones: 1,
    mode: "lance",
    stage: 0,
    chain: 1,
    medals: 0,
    luma: 0,
    muted: false,
    overdrive: 0,
    bossName: "",
    bossHp: 0,
    bossMax: 0,
    bossPhase: 0,
    bossWeak: "",
    bossAtk: "",
    warning: false,
    bounty: 0,
    ending: "none" as Ending | "none",
    loadout: emptyLoadout(),
    ammo: emptyLoadout(),
    armor: 0,
    clear: null as ClearReport | null,
    continues: 0,
    continueT: 0,
    hiTable: [] as HiEntry[],
    nameChars: ["A", "A", "A"] as string[],
    nameSlot: 0,
    demo: false,
    vs: false,
    cpuScore: 0,
    cpuShip: "crimson" as ShipId,
    crew: "solo" as CrewMode,
    p2Ship: "crimson" as ShipId,
    hack: false,
    startLives: 3,
    hackBuf: "",
    arcadeTaps: 0,
    bonus: false,
    pendingBonus: false,
    bonusHit: 0,
    bonusNeed: 0,
    bonusMiss: 0,
    bonusStarGot: 0,
    bonusPay: 0,
    bonusPerfect: false,
    bonusBanner: 0,
    bonusName: BONUS_STAGES[0] as string,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new VectorFangGame(canvas);
    gameRef.current = game;
    const sync = () => {
      setScreen(game.screen);
      setShip(game.ship);
      setDiff(game.diff);
      setVs(game.vs);
      setCrew(game.crew);
      setP2Ship(game.p2Ship);
      const boss = game.bossHud();
      setHud({
        score: game.score,
        hi: game.hi,
        lives: game.lives,
        bombs: game.bombs,
        power: game.power,
        drones: game.dronesN,
        mode: game.mode,
        stage: game.stage,
        chain: game.chain,
        medals: game.stageMedals,
        luma: game.luma,
        muted: game.muted,
        overdrive: game.overdrive,
        bossName: boss.name,
        bossHp: boss.hp,
        bossMax: boss.max,
        bossPhase: boss.phase,
        bossWeak: boss.weak,
        bossAtk: boss.atk,
        warning: boss.warning,
        bounty: game.bounty,
        ending: game.ending,
        loadout: { ...game.loadout },
        ammo: { ...game.ammo },
        armor: game.armor,
        clear: game.clearReport,
        continues: game.continues,
        continueT: game.continueT,
        hiTable: game.hiTable,
        nameChars: [...game.nameChars],
        nameSlot: game.nameSlot,
        demo: game.demo,
        vs: game.vs,
        cpuScore: game.cpuScore,
        cpuShip: game.cpuShip,
        crew: game.crew,
        p2Ship: game.p2Ship,
        hack: game.hack,
        startLives: game.startLives,
        hackBuf: game.hackBuf,
        arcadeTaps: game.arcadeTaps,
        bonus: game.bonus,
        pendingBonus: game.pendingBonus,
        bonusHit: game.bonusHit,
        bonusNeed: game.bonusNeed,
        bonusMiss: game.bonusMiss,
        bonusStarGot: game.bonusStarGot,
        bonusPay: game.bonusPay,
        bonusPerfect: game.bonusPerfect,
        bonusBanner: game.bonusBanner,
        bonusName: game.bonusName(),
      });
    };
    game.onChange = sync;
    const fit = () => {
      const box = wrapRef.current?.getBoundingClientRect();
      const maxW = box?.width ?? 360;
      const maxH = (box?.height ?? 640) - 8;
      const scale = Math.min(maxW / 360, maxH / 640);
      const w = Math.floor(360 * scale);
      const h = Math.floor(640 * scale);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    };
    fit();
    window.addEventListener("resize", fit);
    game.startLoop();
    wrapRef.current?.focus();
    sync();
    const tick = window.setInterval(sync, 200);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("resize", fit);
      game.destroy();
    };
  }, []);

  useEffect(() => {
    if (screen === "title") {
      wrapRef.current?.focus();
      codeRef.current?.focus();
    }
  }, [screen]);

  const g = () => gameRef.current;

  const start = () => {
    g()?.openSelect(false);
  };

  const startVs = () => {
    g()?.openSelect(true);
  };

  const play = () => {
    g()?.launchCampaign();
  };

  const playVs = () => {
    g()?.launchVs();
  };

  const onStick = (clientX: number, clientY: number, target: HTMLElement) => {
    const r = target.getBoundingClientRect();
    const x = (clientX - r.left) / r.width * 2 - 1;
    const y = (clientY - r.top) / r.height * 2 - 1;
    const game = g();
    if (!game) return;
    game.touch.moving = true;
    game.touch.mx = Math.max(-1, Math.min(1, x));
    game.touch.my = Math.max(-1, Math.min(1, y));
  };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-vf-bg text-vf-ice">
      <div
        ref={wrapRef}
        tabIndex={0}
        onPointerDown={() => {
          wrapRef.current?.focus();
          g()?.unlock();
        }}
        className="relative flex w-full max-w-[480px] flex-1 flex-col items-center justify-center px-2 py-2 outline-none"
      >
        <canvas
          ref={canvasRef}
          className="rounded-md border border-vf-line bg-vf-bg shadow-[0_0_40px_#3ec8ff22]"
          style={{ touchAction: "none", imageRendering: "pixelated" }}
        />

        {screen !== "play" && (
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-3">
            <div
              className={`my-auto w-full max-w-[340px] rounded-md border border-vf-line ${
                screen === "select"
                  ? "max-h-full overflow-y-auto bg-vf-bg p-0"
                  : screen === "brief" || screen === "shop" || screen === "over" || screen === "continue" || screen === "name" || screen === "vsresult" || screen === "intro" || screen === "thanks" || screen === "ending"
                    ? "overflow-hidden bg-vf-bg p-0"
                    : "overflow-hidden bg-vf-panel/92 p-5 backdrop-blur-sm"
              }`}
            >
              {screen === "title" && (
                <div className="flex flex-col gap-4 text-center">
                  <p
                    className="cursor-pointer font-mono text-xs tracking-[0.35em] text-vf-cyan"
                    onClick={() => g()?.tapArcade()}
                  >
                    NEXO ARCADE
                  </p>
                  <img
                    src="/sprites/flyer-fullbody.jpg?v=poster"
                    alt="VECTOR FANG — Greta Voss, Mack Hale, and Rin Kaze"
                    className="mx-auto w-full rounded-sm border border-vf-line"
                    width={1152}
                    height={768}
                  />
                  <h1 className="sr-only">VECTOR FANG</h1>
                  <p className="font-mono text-sm text-vf-mute">{LORE.tag}</p>
                  <div
                    className="relative cursor-text rounded-md border border-vf-line bg-vf-bg/80 px-3 py-3"
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      codeRef.current?.focus();
                    }}
                  >
                    <p className="mb-2 font-mono text-[10px] tracking-[0.32em] text-vf-mute">ENTER CODE</p>
                    <div className="flex justify-center gap-1">
                      {Array.from({ length: 8 }, (_, i) => {
                        const ch = hud.hackBuf[i] ?? "";
                        const filled = ch.length > 0;
                        const complete = hud.hackBuf === "HACKMODE";
                        return (
                          <span
                            key={i}
                            className={`flex h-9 w-7 items-center justify-center border-b-2 font-mono text-lg font-bold ${
                              complete ? "border-vf-gold text-vf-gold" : filled ? "border-vf-cyan text-vf-ice" : "border-vf-line text-vf-mute"
                            }`}
                          >
                            {ch || "·"}
                          </span>
                        );
                      })}
                    </div>
                    <input
                      ref={codeRef}
                      value={hud.hackBuf}
                      maxLength={8}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Secret code"
                      className="absolute inset-0 cursor-text opacity-0"
                      onChange={(e) => g()?.typeHack(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-md bg-vf-cyan px-4 py-3 font-display text-sm font-bold tracking-widest text-vf-bg"
                    onClick={start}
                  >
                    START
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-vf-gold bg-vf-bg px-4 py-3 font-display text-sm font-bold tracking-widest text-vf-gold"
                    onClick={startVs}
                  >
                    VS CPU
                  </button>
                  <div className="rounded-sm border border-vf-line bg-vf-bg/70 p-2 text-left">
                    <p className="mb-1 text-center font-display text-[11px] tracking-[0.28em] text-vf-gold">HI-SCORE</p>
                    {hud.hiTable.map((row, i) => (
                      <div key={`${row.name}-${row.score}-${i}`} className="flex justify-between font-mono text-[10px] leading-tight text-vf-ice">
                        <span className="text-vf-mute">{String(i + 1).padStart(2, "0")}</span>
                        <span className={i === 0 ? "text-vf-gold" : ""}>{row.name.padEnd(3, " ")}</span>
                        <span>{row.score.toString().padStart(8, "0")}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-vf-line px-4 py-2 font-mono text-xs text-vf-ice"
                    onClick={() => {
                      const game = g();
                      if (game) {
                        game.screen = "story";
                        game.onChange();
                      }
                    }}
                  >
                    THE CONTRACT
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-vf-line px-4 py-2 font-mono text-xs text-vf-ice"
                    onClick={() => {
                      const game = g();
                      if (game) {
                        game.screen = "roster";
                        game.onChange();
                      }
                    }}
                  >
                    PILOTS
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-vf-line px-4 py-2 font-mono text-xs text-vf-ice"
                    onClick={() => {
                      const game = g();
                      if (game) {
                        game.screen = "how";
                        game.onChange();
                      }
                    }}
                  >
                    HOW TO PLAY
                  </button>
                  <p className="font-mono text-[11px] text-vf-mute">HI {hud.hi.toString().padStart(8, "0")}</p>
                  <p className="font-mono text-[10px] text-vf-mute">DEMO PLAYS IF YOU WAIT</p>
                </div>
              )}

              {screen === "how" && (
                <div className="flex flex-col gap-3 font-mono text-sm text-vf-ice">
                  <h2 className="font-display text-lg text-vf-cyan">SORTIE BRIEF</h2>
                  <p>Move with WASD or arrows. Shot: Space / Z. Bomb: X. Swap drones: C.</p>
                  <p>Sortie 01 catapults off the NEXO carrier. Lock 0.55s, 3-2-1 on 0.48s beats (T-minus 2.54s to the shot), ignite 0.55s, then a 2.05s burn down the keel.</p>
                  <p>LANCE drones fire lasers. SEEK drones home. Overdrive dumps every 6s.</p>
                  <p>Tiny white core is your hitbox. Shells and air units clip it — tanks, ships, and buildings you fly over. Chain air kills onto ground units for multipliers.</p>
                  <p>Each stage ends with a named boss. Watch the warning sting, then break their armor phases.</p>
                  <p>Black Tide is a double: sink the sub, then the battleship.</p>
                  <p>Every kill drops gold and pays bounty. Nash sells two specials a sortie — Mack can hang three. Unused ammo converts back. Kits stay. Save {money(BUYOUT)} to buy the contract. Abort is desertion.</p>
                  <p>When you go down, CONTINUE buys you back in from bounty — $20,000 and doubling each time. Beat a cabinet score and enter three letters.</p>
                  <p>EASY / NORMAL / HARD change enemy armor, fire, and lives. VS CPU is a one-stage score duel against a rival Fang.</p>
                  <p>After sorties 02, 05, and 08 a bonus stage opens. Shoot the gold-marked targets and grab the stars. Miss none and PERFECT BONUS pays the full tally.</p>
                  <p>Clear a stage and Nash tallies medals × bombs in stock × 1,000. Empty medal or bomb counts still pay as one.</p>
                  <p>Field pods: red and blue cubes feed the gun — 5,000 surplus if you are already maxed. Yellow M and green H chips stock missiles the same way. Bomb pods add stock up to 7 and pay 5,000 when full. A P pod maxes gun and missiles — 10,000 if you are already maxed.</p>
                  <p>Gold medals pay 500 on pickup and feed the stage bonus. NIX critters hide on the field for 3,000. LUMA sprites hide in the grass — hold one, and when you go down it dumps power-ups.</p>
                  <p>Secret: tap ENTER CODE on the title, then type. Each letter lights a box. Finish the word and the CPU takes the stick.</p>
                  <p>1P, 2P, or 1P+CPU on the select screen. P1 is WASD. P2 is arrows and Enter. Shared hearts.</p>
                  <p>Ground bunkers, hangars, docks, and crates drop gold, bombs, shields, and extra lives. Barrels and fuel tanks chain-explode — dump a row and anything next to them goes with it. Trees, rocks, and huts also break. Tanks stay on land. Water is for destroyers and subs — they lock missiles on you.</p>
                  <p>Three hearts start a run. Empty them and it is game over — unless you continue from bounty.</p>
                  <p>Rin: highest fire rate. Mack: wide shot + extra special stock. Greta: 45° ground stream. SPACE gun · Z special · X bomb. Shields eat hits before lives.</p>
                  <button type="button" className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg" onClick={start}>
                    CONTINUE
                  </button>
                </div>
              )}

              {screen === "story" && (
                <div className="flex flex-col gap-3 font-mono text-sm text-vf-ice">
                  <h2 className="font-display text-lg text-vf-gold">NEXO CONTRACT</h2>
                  {LORE.dossier.map((p) => (
                    <p key={p.slice(0, 24)} className="text-vf-mute leading-relaxed">
                      {p}
                    </p>
                  ))}
                  <p className="text-vf-cyan">1. Serve three years. 2. Buy out for {money(BUYOUT)}. 3. Desert — treason.</p>
                  <button type="button" className="min-h-11 shrink-0 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg" onClick={start}>
                    CHOOSE PILOT
                  </button>
                </div>
              )}

              {screen === "roster" && (
                <div className="flex flex-col gap-3 font-mono text-sm text-vf-ice">
                  <h2 className="font-display text-lg text-vf-gold">NEXO LEGION</h2>
                  <p className="text-[11px] text-vf-mute">Meet the pilots and the two who keep them in the sky.</p>
                  {(["azure", "crimson", "iron"] as ShipId[]).map((id) => (
                    <div key={id} className="flex gap-3 rounded-md border border-vf-line p-2">
                      <img
                        src={PORTRAITS[id]}
                        alt={PILOTS[id].name}
                        className="h-16 w-16 shrink-0 rounded-sm border border-vf-line object-cover object-top"
                      />
                      <div>
                        <p className={`font-display text-xs ${id === "azure" ? "text-vf-cyan" : id === "crimson" ? "text-vf-crimson" : "text-vf-gold"}`}>
                          {PILOTS[id].plane} · {PILOTS[id].call}
                        </p>
                        <p className="text-[11px] text-vf-ice">
                          {PILOTS[id].name} · {PILOTS[id].country}
                        </p>
                        <p className="text-[10px] text-vf-mute">
                          {PILOTS[id].height} · {PILOTS[id].weight} · {PILOTS[id].plane}
                        </p>
                        <p className="mt-1 text-[11px] text-vf-mute">{PILOTS[id].bio}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 rounded-md border border-vf-line p-2">
                    <img src={CREW_PORTRAITS.vale} alt={CREW.vale.name} className="h-16 w-16 shrink-0 rounded-sm object-cover" style={{ imageRendering: "pixelated" }} />
                    <div>
                      <p className="font-display text-xs text-vf-gold">{CREW.vale.name}</p>
                      <p className="text-[11px] text-vf-mute">{CREW.vale.bio}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-md border border-vf-line p-2">
                    <img src={CREW_PORTRAITS.nash} alt={CREW.nash.name} className="h-16 w-16 shrink-0 rounded-sm object-cover" style={{ imageRendering: "pixelated" }} />
                    <div>
                      <p className="font-display text-xs text-vf-gold">{CREW.nash.name}</p>
                      <p className="text-[11px] text-vf-mute">{CREW.nash.bio}</p>
                    </div>
                  </div>
                  <button type="button" className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg" onClick={start}>
                    CHOOSE PILOT
                  </button>
                </div>
              )}

              {screen === "brief" && (
                <div
                  className="flex flex-col gap-3 bg-cover bg-center p-3"
                  style={{ backgroundImage: "url(/ui/brief-map.jpg)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg tracking-widest text-vf-ice drop-shadow">
                      SORTIE {String(hud.stage + 1).padStart(2, "0")}
                    </p>
                    <p className="font-mono text-[10px] text-vf-gold">{STAGES[hud.stage]}</p>
                  </div>
                  <img
                    src={CREW_PORTRAITS.vale}
                    alt=""
                    className="mx-auto h-36 w-36 rounded-sm border border-vf-line object-cover object-top"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <div className="rounded-sm border border-vf-line bg-vf-bg/92 p-3">
                    <p className="font-mono text-[10px] tracking-[0.25em] text-vf-gold">{CREW.vale.name}</p>
                    <p className="mt-2 font-mono text-sm leading-relaxed text-vf-ice">{BRIEFS[hud.stage]?.target}</p>
                    <p className="mt-2 font-mono text-sm leading-relaxed text-vf-mute">{BRIEFS[hud.stage]?.weak}</p>
                    <p className="mt-2 font-mono text-[11px] text-vf-gold">{BRIEFS[hud.stage]?.payout}</p>
                  </div>
                  <p className="font-mono text-xs text-vf-cyan">
                    BOUNTY {money(hud.bounty)} / {money(BUYOUT)}
                  </p>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-vf-gold bg-vf-bg/80 font-display text-sm font-bold text-vf-gold"
                    onClick={() => g()?.openHangar()}
                  >
                    HANGAR
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg"
                    onClick={() => g()?.launchSortie()}
                  >
                    TAKE OFF
                  </button>
                  {hud.bounty >= BUYOUT && (
                    <button
                      type="button"
                      className="min-h-11 rounded-md border border-vf-gold bg-vf-bg/80 font-display text-sm font-bold text-vf-gold"
                      onClick={() => g()?.cashOut()}
                    >
                      BUY CONTRACT
                    </button>
                  )}
                </div>
              )}

              {screen === "shop" && (
                <div
                  className="flex flex-col gap-2 bg-cover bg-center p-3"
                  style={{ backgroundImage: "url(/ui/shop-crates.jpg)" }}
                >
                  <div className="flex items-center gap-3 rounded-sm bg-vf-bg/80 p-2">
                    <img src={CREW_PORTRAITS.nash} alt="" className="h-16 w-16 rounded-sm border border-vf-line object-cover" style={{ imageRendering: "pixelated" }} />
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.25em] text-vf-gold">{CREW.nash.name}</p>
                      <p className="font-mono text-sm text-vf-ice">I have something.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg"
                    onClick={() => g()?.launchSortie()}
                  >
                    TAKE OFF
                  </button>
                  <HangarCatalog
                    ship={ship}
                    loadout={hud.loadout}
                    ammo={hud.ammo}
                    bounty={hud.bounty}
                    onBuy={(id) => g()?.buy(id)}
                  />
                  <button
                    type="button"
                    className="min-h-11 rounded-md bg-vf-gold font-display text-sm font-bold text-vf-bg"
                    onClick={() => {
                      const game = g();
                      if (game) {
                        game.screen = "brief";
                        game.onChange();
                      }
                    }}
                  >
                    EXIT
                  </button>
                </div>
              )}

              {screen === "select" && (
                <div
                  className="flex flex-col gap-3 bg-cover bg-bottom p-3"
                  style={{ backgroundImage: "url(/ui/select-runway.jpg)" }}
                >
                  <h2 className="text-center font-display text-sm tracking-[0.28em] text-vf-crimson drop-shadow">
                    PLEASE SELECT PILOT
                  </h2>
                  <div className="grid grid-cols-3 gap-1">
                    {(["azure", "crimson", "iron"] as ShipId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={`flex flex-col items-center gap-1 rounded-sm border p-1 ${
                          ship === id
                            ? id === "azure"
                              ? "border-vf-cyan bg-vf-bg/80"
                              : id === "crimson"
                                ? "border-vf-crimson bg-vf-bg/80"
                                : "border-vf-gold bg-vf-bg/80"
                            : "border-vf-line bg-vf-bg/55"
                        }`}
                        onClick={() => {
                          g()?.choose(id);
                          setShip(id);
                        }}
                      >
                        <img
                          src={PORTRAITS[id]}
                          alt={PILOTS[id].name}
                          width={256}
                          height={256}
                          className="aspect-square w-full rounded-sm border border-vf-line bg-black object-cover object-center"
                        />
                        <p className={`font-mono text-[9px] leading-tight ${id === "azure" ? "text-vf-cyan" : id === "crimson" ? "text-vf-crimson" : "text-vf-gold"}`}>
                          {PILOTS[id].name}
                        </p>
                        <p className="font-mono text-[8px] text-vf-mute">{PILOTS[id].plane}</p>
                        <img
                          src={SHIP_ART[id]}
                          alt=""
                          className="h-10 w-full object-contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-center font-mono text-[10px] text-vf-ice">{PILOTS[ship].line}</p>
                  <PilotDossier id={ship} compact />
                  <div>
                    <p className="mb-1 text-center font-mono text-[10px] tracking-[0.28em] text-vf-gold">DIFFICULTY</p>
                    <div className="grid grid-cols-3 gap-1">
                      {(["easy", "normal", "hard"] as DiffId[]).map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={`min-h-11 rounded-sm border font-display text-xs font-bold ${
                            diff === id
                              ? id === "hard"
                                ? "border-vf-crimson bg-vf-crimson text-vf-ice"
                                : id === "easy"
                                  ? "border-vf-cyan bg-vf-cyan text-vf-bg"
                                  : "border-vf-gold bg-vf-gold text-vf-bg"
                              : "border-vf-line bg-vf-bg/70 text-vf-ice"
                          }`}
                          onClick={() => {
                            g()?.setDiff(id);
                            setDiff(id);
                          }}
                        >
                          {DIFFS[id].label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-center font-mono text-[10px] text-vf-mute">{DIFFS[diff].line}</p>
                  </div>
                  {!vs && (
                    <div>
                      <p className="mb-1 text-center font-mono text-[10px] tracking-[0.28em] text-vf-gold">CREW</p>
                      <div className="grid grid-cols-3 gap-1">
                        {(["solo", "duo", "wingman"] as CrewMode[]).map((id) => (
                          <button
                            key={id}
                            type="button"
                            className={`min-h-11 rounded-sm border font-display text-xs font-bold ${
                              crew === id ? "border-vf-cyan bg-vf-cyan text-vf-bg" : "border-vf-line bg-vf-bg/70 text-vf-ice"
                            }`}
                            onClick={() => {
                              g()?.setCrew(id);
                              setCrew(id);
                            }}
                          >
                            {CREW_MODES[id].label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-center font-mono text-[10px] text-vf-mute">{CREW_MODES[crew].line}</p>
                    </div>
                  )}
                  {!vs && crew !== "solo" && (
                    <div>
                      <p className="mb-1 text-center font-mono text-[10px] tracking-[0.28em] text-vf-gold">
                        {crew === "duo" ? "PLAYER 2" : "WINGMAN"}
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {(["azure", "crimson", "iron"] as ShipId[]).map((id) => (
                          <button
                            key={`p2-${id}`}
                            type="button"
                            className={`min-h-11 rounded-sm border font-mono text-[10px] ${
                              p2Ship === id ? "border-vf-gold bg-vf-gold text-vf-bg" : "border-vf-line bg-vf-bg/70 text-vf-ice"
                            }`}
                            onClick={() => {
                              g()?.chooseP2(id);
                              setP2Ship(id);
                            }}
                          >
                            {PILOTS[id].plane}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {vs && (
                    <p className="text-center font-mono text-[10px] text-vf-gold">
                      DUEL · CPU FLIES {PILOTS[ship === "azure" ? "crimson" : ship === "crimson" ? "iron" : "azure"].plane}
                    </p>
                  )}
                  <button type="button" className="min-h-11 rounded-md bg-vf-gold font-display text-sm font-bold text-vf-bg" onClick={play}>
                    SIGN AND LAUNCH
                  </button>
                  <button type="button" className="min-h-11 rounded-md border border-vf-cyan font-display text-sm font-bold text-vf-cyan" onClick={playVs}>
                    VS CPU
                  </button>
                </div>
              )}

              {screen === "intro" && (
                <div
                  className="flex flex-col gap-3 bg-cover bg-center p-3"
                  style={{ backgroundImage: "url(/ui/brief-map.jpg)" }}
                >
                  <p className="text-center font-mono text-[10px] tracking-[0.28em] text-vf-gold">{MISSION_INTRO.title}</p>
                  <img
                    src={CREW_PORTRAITS.vale}
                    alt=""
                    className="mx-auto h-28 w-28 rounded-sm border border-vf-line object-cover object-top"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <p className="text-center font-display text-sm text-vf-cyan">{CREW.vale.name}</p>
                  <div className="rounded-sm border border-vf-line bg-vf-bg/92 p-3">
                    <p className="font-mono text-sm leading-relaxed text-vf-ice">Welcome to the wing, {PILOTS[ship].name}.</p>
                    <p className="mt-2 font-mono text-sm leading-relaxed text-vf-mute">{MISSION_INTRO.body}</p>
                    <p className="mt-2 font-mono text-sm leading-relaxed text-vf-ice">{PILOT_INTRO[ship].welcome}</p>
                    <p className="mt-2 font-mono text-sm text-vf-gold">{PILOT_INTRO[ship].luck}</p>
                    <p className="mt-2 font-mono text-[11px] text-vf-mute">{MISSION_INTRO.luck}</p>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg"
                    onClick={() => g()?.dismissIntro()}
                  >
                    BRIEFING
                  </button>
                </div>
              )}

              {screen === "clear" && hud.clear && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={PORTRAITS[ship]}
                      alt=""
                      className="h-14 w-14 rounded-sm border border-vf-line object-cover object-top"
                    />
                    <div className="font-mono text-[11px] text-vf-ice">
                      <p>SC {hud.clear.score.toString().padStart(8, "0")}</p>
                      <p className="text-vf-mute">HI {hud.clear.hi.toString().padStart(8, "0")}</p>
                      <p>
                        POW {hud.clear.power} · ♥ {hud.clear.lives} · S{hud.clear.armor} · B {hud.clear.bombs}
                      </p>
                    </div>
                  </div>
                  <h2 className="text-center font-display text-lg tracking-widest text-vf-cyan">
                    SORTIE {String(hud.clear.stage + 1).padStart(2, "0")} CLEAR
                  </h2>
                  <div className="font-mono text-xs text-vf-ice">
                    <div className="flex justify-between">
                      <span>MEDALS</span>
                      <span className="text-vf-gold">
                        {String(hud.clear.medals).padStart(2, "0")}
                        {hud.clear.medals === 0 ? " → 01" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>BOMBS</span>
                      <span className="text-vf-gold">
                        {String(hud.clear.bombs).padStart(2, "0")}
                        {hud.clear.bombs === 0 ? " → 01" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between text-vf-mute">
                      <span>× 1,000</span>
                      <span>
                        {hud.clear.medalMul} × {hud.clear.bombMul} × 1,000
                      </span>
                    </div>
                    <div className="flex justify-between text-vf-gold">
                      <span>STAGE BONUS</span>
                      <span>{hud.clear.stageBonus.toLocaleString("en-US")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PTS</span>
                      <span>{hud.clear.score.toLocaleString("en-US")}</span>
                    </div>
                    <div className="flex justify-between text-vf-gold">
                      <span>$ RACKS</span>
                      <span>{money(hud.clear.refund)}</span>
                    </div>
                    <div className="flex justify-between text-vf-cyan">
                      <span>BOUNTY</span>
                      <span>{money(hud.bounty)}</span>
                    </div>
                  </div>
                  {hud.clear.specials.length > 0 && (
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.2em] text-vf-gold">CONVERTED RACKS</p>
                      {hud.clear.specials.map((s) => (
                        <div key={s.name} className="flex justify-between font-mono text-[11px] text-vf-ice">
                          <span>
                            {s.name} · {s.ammo} rds
                          </span>
                          <span className="text-vf-gold">{money(s.refund)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!hud.clear.last && (
                    <>
                      <div className="flex items-center gap-3">
                        <img src={CREW_PORTRAITS.nash} alt="" className="h-12 w-12 rounded-sm border border-vf-line object-cover" style={{ imageRendering: "pixelated" }} />
                        <div>
                          <p className="font-mono text-[10px] tracking-[0.25em] text-vf-gold">{CREW.nash.name}</p>
                          <p className="font-display text-sm text-vf-ice">RE-ARM BEFORE SORTIE {String(hud.clear.stage + 2).padStart(2, "0")}</p>
                        </div>
                      </div>
                      <HangarCatalog
                        ship={ship}
                        loadout={hud.loadout}
                        ammo={hud.ammo}
                        bounty={hud.bounty}
                        onBuy={(id) => g()?.buy(id)}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg"
                    onClick={() => g()?.continueFromClear()}
                  >
                    {hud.clear.last ? "END CONTRACT" : hud.pendingBonus ? "BONUS STAGE" : "NEXT BRIEFING"}
                  </button>
                </div>
              )}

              {screen === "pause" && (
                <div className="flex flex-col gap-3 text-center">
                  <h2 className="font-display text-2xl text-vf-gold">PAUSED</h2>
                  <button type="button" className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg" onClick={() => g()?.pause()}>
                    RESUME
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-vf-crimson font-mono text-xs text-vf-crimson"
                    onClick={() => g()?.desert()}
                  >
                    DESERT
                  </button>
                </div>
              )}

              {screen === "continue" && (
                <div
                  className="flex min-h-[420px] flex-col justify-end gap-3 bg-cover bg-left p-4"
                  style={{ backgroundImage: "url(/ui/gameover.jpg)" }}
                >
                  <h2 className="text-center font-display text-3xl tracking-[0.2em] text-vf-gold drop-shadow">CONTINUE</h2>
                  <p className="text-center font-display text-6xl text-vf-cyan">{Math.max(0, Math.ceil(hud.continueT))}</p>
                  <p className="text-center font-mono text-sm text-vf-ice">
                    COST {money(continueCost(hud.continues))} · FUNDS {money(hud.bounty)}
                  </p>
                  <p className="text-center font-mono text-[11px] text-vf-mute">Used {hud.continues} · doubles each time</p>
                  <button
                    type="button"
                    disabled={hud.bounty < continueCost(hud.continues)}
                    className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg disabled:opacity-40"
                    onClick={() => g()?.doContinue()}
                  >
                    CONTINUE
                  </button>
                  <button
                    type="button"
                    className="min-h-11 border border-vf-line bg-vf-bg/70 font-mono text-xs"
                    onClick={() => g()?.skipContinue()}
                  >
                    GIVE UP
                  </button>
                </div>
              )}

              {screen === "name" && (
                <div className="flex flex-col gap-4 bg-vf-bg p-5 text-center">
                  <p className="font-mono text-xs tracking-[0.3em] text-vf-gold">NEW HI-SCORE</p>
                  <p className="font-display text-2xl text-vf-cyan">{hud.score.toString().padStart(8, "0")}</p>
                  <p className="font-mono text-[11px] text-vf-mute">Enter three letters</p>
                  <div className="flex justify-center gap-2">
                    {hud.nameChars.map((ch, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`h-14 w-12 font-display text-2xl ${i === hud.nameSlot ? "border-vf-cyan bg-vf-cyan/15 text-vf-cyan" : "border-vf-line text-vf-ice"} rounded-sm border`}
                        onClick={() => g()?.setNameSlot(i)}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center gap-2">
                    <button type="button" className="min-h-11 w-20 rounded-md border border-vf-line font-display text-lg" onClick={() => g()?.nudgeName(-1)}>
                      −
                    </button>
                    <button type="button" className="min-h-11 w-20 rounded-md border border-vf-line font-display text-lg" onClick={() => g()?.nudgeName(1)}>
                      +
                    </button>
                  </div>
                  <button type="button" className="min-h-11 rounded-md bg-vf-gold font-display text-sm font-bold text-vf-bg" onClick={() => g()?.submitName()}>
                    ENTER
                  </button>
                </div>
              )}

              {screen === "vsresult" && (
                <div className="flex flex-col gap-3 bg-vf-bg p-4 text-center">
                  <p className="font-mono text-xs tracking-[0.3em] text-vf-gold">VS CPU</p>
                  <h2 className="font-display text-2xl tracking-widest text-vf-ice">
                    {hud.score > hud.cpuScore ? "YOU WIN" : hud.score < hud.cpuScore ? "CPU WINS" : "DRAW"}
                  </h2>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <div className="rounded-sm border border-vf-cyan bg-vf-bg p-2">
                      <p className="text-vf-mute">YOU</p>
                      <p className="font-display text-lg text-vf-cyan">{hud.score.toString().padStart(8, "0")}</p>
                      <p className="text-vf-mute">{PILOTS[ship].plane}</p>
                    </div>
                    <div className="rounded-sm border border-vf-gold bg-vf-bg p-2">
                      <p className="text-vf-mute">CPU</p>
                      <p className="font-display text-lg text-vf-gold">{hud.cpuScore.toString().padStart(8, "0")}</p>
                      <p className="text-vf-mute">{PILOTS[hud.cpuShip].plane}</p>
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-vf-mute">Highest cabinet score still stands.</p>
                  <button type="button" className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg" onClick={playVs}>
                    REMATCH
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-vf-line font-mono text-xs text-vf-ice"
                    onClick={() => g()?.goTitle()}
                  >
                    TITLE
                  </button>
                </div>
              )}

              {screen === "over" && (
                <div
                  className="flex min-h-[420px] flex-col justify-end gap-3 bg-cover bg-left p-4"
                  style={{ backgroundImage: "url(/ui/gameover.jpg)" }}
                >
                  <h2 className="text-center font-display text-3xl tracking-[0.2em] text-vf-gold drop-shadow">
                    GAME OVER
                  </h2>
                  <p className="text-center font-display text-sm text-vf-crimson">
                    {hud.ending === "desert" ? ENDINGS.desert.title : ENDINGS.mia.title}
                  </p>
                  <p className="text-center font-mono text-sm leading-relaxed text-vf-ice">
                    {hud.ending === "desert" ? ENDINGS.desert.line : ENDINGS.mia.line}
                  </p>
                  <p className="text-center font-mono text-vf-gold">{money(hud.bounty)}</p>
                  <button type="button" className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg" onClick={() => (hud.hack ? g()?.startHack() : play())}>
                    {hud.hack ? "TRY AGAIN" : "RETRY"}
                  </button>
                  <button
                    type="button"
                    className="min-h-11 border border-vf-line bg-vf-bg/70 font-mono text-xs"
                    onClick={() => g()?.goTitle()}
                  >
                    TITLE
                  </button>
                </div>
              )}

              {screen === "thanks" && (
                <div className="flex flex-col gap-3 bg-vf-bg p-4 text-center">
                  <img
                    src={PORTRAITS[ship]}
                    alt=""
                    className="mx-auto h-28 w-28 rounded-sm border border-vf-line object-cover object-top"
                  />
                  <h2 className="font-display text-xl tracking-widest text-vf-gold">THANK YOU</h2>
                  <p className="font-display text-sm text-vf-cyan">VALIANT PILOT</p>
                  <p className="font-mono text-sm leading-relaxed text-vf-ice">{PILOT_ENDINGS[ship].thanks}</p>
                  <p className="font-mono text-[11px] text-vf-mute">{PILOTS[ship].name} · {PILOTS[ship].plane}</p>
                  <button
                    type="button"
                    className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg"
                    onClick={() => g()?.dismissThanks()}
                  >
                    ENDING
                  </button>
                </div>
              )}

              {screen === "ending" && (
                <div className="flex flex-col gap-3 bg-vf-bg p-4 text-center">
                  <img
                    src={PORTRAITS[ship]}
                    alt=""
                    className="mx-auto h-32 w-32 rounded-sm border border-vf-line object-cover object-top"
                  />
                  <p className="font-mono text-[10px] tracking-[0.28em] text-vf-gold">{PILOTS[ship].call}</p>
                  <h2 className="font-display text-lg tracking-wide text-vf-cyan">
                    {hud.ending === "bought"
                      ? PILOT_ENDINGS[ship].bought.title
                      : hud.ending === "both"
                        ? PILOT_ENDINGS[ship].both.title
                        : PILOT_ENDINGS[ship].served.title}
                  </h2>
                  {(hud.ending === "bought"
                    ? PILOT_ENDINGS[ship].bought.lines
                    : hud.ending === "both"
                      ? PILOT_ENDINGS[ship].both.lines
                      : PILOT_ENDINGS[ship].served.lines
                  ).map((line) => (
                    <p key={line.slice(0, 24)} className="font-mono text-sm leading-relaxed text-vf-mute">
                      {line}
                    </p>
                  ))}
                  <p className="font-display text-vf-gold">{money(hud.bounty)}</p>
                  <button type="button" className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg" onClick={play}>
                    NEW CONTRACT
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-vf-line font-mono text-xs text-vf-ice"
                    onClick={() => g()?.goTitle()}
                  >
                    TITLE
                  </button>
                </div>
              )}

              {screen === "win" && (
                <div className="flex flex-col gap-3 text-center">
                  <h2 className="font-display text-2xl text-vf-cyan">
                    {hud.ending === "bought"
                      ? ENDINGS.bought.title
                      : hud.ending === "both"
                        ? ENDINGS.both.title
                        : ENDINGS.served.title}
                  </h2>
                  <p className="font-mono text-sm leading-relaxed text-vf-mute">
                    {hud.ending === "bought"
                      ? ENDINGS.bought.line
                      : hud.ending === "both"
                        ? ENDINGS.both.line
                        : ENDINGS.served.line}
                  </p>
                  <p className="font-display text-vf-gold">{money(hud.bounty)}</p>
                  <button type="button" className="min-h-11 rounded-md bg-vf-cyan font-display text-sm font-bold text-vf-bg" onClick={play}>
                    NEW CONTRACT
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === "play" && (
          <>
            <div className="pointer-events-none absolute left-3 top-3 right-3 flex items-start justify-between font-mono text-[11px] text-vf-ice">
              <div className="flex items-start gap-2">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm border border-vf-line bg-vf-panel">
                  <img
                    src={PORTRAITS[ship]}
                    alt=""
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div>
                  <div className={`font-display text-[12px] leading-none tracking-wide ${ship === "azure" ? "text-vf-cyan" : ship === "crimson" ? "text-vf-crimson" : "text-vf-gold"}`}>
                    {PILOTS[ship].name}
                  </div>
                  <div className="mt-0.5 text-[9px] tracking-[0.2em] text-vf-mute">{PILOTS[ship].call}</div>
                  <div className="mt-1">SC {hud.score.toString().padStart(8, "0")}</div>
                  {hud.vs && <div className="text-vf-gold">CPU {hud.cpuScore.toString().padStart(8, "0")}</div>}
                  <div className="text-vf-gold">{money(hud.bounty)}</div>
                  <div className="text-vf-mute">HI {hud.hi.toString().padStart(8, "0")}</div>
                  <div className="text-vf-gold">×{hud.chain}</div>
                  <div className="flex items-center gap-1 text-vf-gold">
                    <Medal className="size-3" aria-hidden />
                    {String(hud.medals).padStart(2, "0")}
                    {hud.luma > 0 && <Sparkle className="size-3 fill-vf-gold text-vf-gold" aria-hidden />}
                  </div>
                  {hud.bonus && (
                    <div className="text-vf-gold">
                      TGT {hud.bonusHit}/{Math.max(hud.bonusNeed, hud.bonusHit)} ★{hud.bonusStarGot} M{hud.bonusMiss}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-vf-cyan">
                  {hud.demo ? "DEMO" : hud.hack && !hud.bonus ? "HACKMODE" : hud.bonus ? hud.bonusName : STAGES[hud.stage]}
                </div>
                {hud.demo ? (
                  <div>ATTRACT MODE</div>
                ) : (
                  <div className="flex items-center justify-end gap-0.5">
                    {Array.from({ length: Math.max(3, hud.startLives, hud.lives) }).map((_, i) => (
                      <Heart
                        key={i}
                        className={`size-4 ${i < hud.lives ? "fill-vf-crimson text-vf-crimson" : "text-vf-line"}`}
                        aria-hidden
                      />
                    ))}
                    <span className="ml-1">S{hud.armor} B{hud.bombs}</span>
                  </div>
                )}
                <div>
                  {hud.mode.toUpperCase()}  P{hud.power}  D{hud.drones}
                </div>
                <div className="text-vf-gold">
                  {SHOP.filter((s) => s.cat === "special" && hud.loadout[s.id] > 0)
                    .map((s) => `${s.name.split(" ")[0]} ${hud.ammo[s.id]}`)
                    .join(" ") || "GUN"}
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute left-3 right-3 top-[4.75rem] h-1 overflow-hidden rounded-full bg-vf-line">
              <div className="h-full bg-vf-cyan" style={{ width: `${Math.min(100, (hud.overdrive / 6) * 100)}%` }} />
            </div>
            {(hud.warning || hud.bossMax > 0) && (
              <div className="pointer-events-none absolute left-3 right-28 top-[5.25rem]">
                <div className="flex justify-between font-mono text-[10px] text-vf-gold">
                  <span>{hud.warning ? "WARNING" : hud.bossPhase > 0 ? `PHASE ${hud.bossPhase}/3` : "BOSS"}</span>
                  <span>{hud.bossName}</span>
                </div>
                {hud.bossMax > 0 && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-vf-line">
                    <div
                      className="h-full bg-vf-crimson"
                      style={{ width: `${Math.max(0, Math.min(100, (hud.bossHp / hud.bossMax) * 100))}%` }}
                    />
                  </div>
                )}
                {hud.bossWeak ? <p className="mt-1 truncate font-mono text-[9px] text-vf-mute">{hud.bossWeak}</p> : null}
                {hud.bossAtk ? <p className="truncate font-mono text-[9px] tracking-[0.18em] text-vf-gold">{hud.bossAtk}</p> : null}
              </div>
            )}
            {hud.demo && (
              <button
                type="button"
                className="absolute inset-0 z-10 flex flex-col justify-end bg-transparent p-3"
                onClick={() => g()?.abortDemo()}
              >
                <div className="pointer-events-none rounded-sm border border-vf-line bg-vf-bg/90 p-2">
                  <p className="mb-1 text-center font-display text-[11px] tracking-[0.28em] text-vf-gold">DEMO · PILOT DOSSIER</p>
                  <PilotDossier id={ship} compact />
                  <p className="mt-2 text-center font-display text-xs tracking-[0.3em] text-vf-cyan">PRESS START</p>
                </div>
              </button>
            )}
            {!hud.demo && (
              <>
            <div className="absolute right-3 top-20 flex gap-2 pointer-events-auto">
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-md border border-vf-line bg-vf-panel/80"
                onClick={() => g()?.pause()}
                aria-label="Pause"
              >
                <Pause className="size-4" />
              </button>
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-md border border-vf-line bg-vf-panel/80"
                onClick={() => g()?.toggleMute()}
                aria-label="Mute"
              >
                {hud.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex items-end justify-between px-4 md:hidden">
              <div
                className="size-28 rounded-full border border-vf-line bg-vf-panel/50"
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  onStick(e.clientX, e.clientY, e.currentTarget);
                }}
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  onStick(e.clientX, e.clientY, e.currentTarget);
                }}
                onPointerUp={() => {
                  const game = g();
                  if (game) {
                    game.touch.moving = false;
                    game.touch.mx = 0;
                    game.touch.my = 0;
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-md bg-vf-gold px-4 font-display text-xs font-bold text-vf-bg"
                  onPointerDown={() => {
                    const game = g();
                    if (game) game.touch.special = true;
                  }}
                  onPointerUp={() => {
                    const game = g();
                    if (game) game.touch.special = false;
                  }}
                >
                  SPEC
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-md bg-vf-gold px-4 font-display text-xs font-bold text-vf-bg"
                  onPointerDown={() => {
                    const game = g();
                    if (game) game.touch.mode = true;
                  }}
                  onPointerUp={() => {
                    const game = g();
                    if (game) game.touch.mode = false;
                  }}
                >
                  MODE
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-md bg-vf-crimson px-4 font-display text-xs font-bold text-vf-ice"
                  onPointerDown={() => {
                    const game = g();
                    if (game) game.touch.bomb = true;
                  }}
                  onPointerUp={() => {
                    const game = g();
                    if (game) game.touch.bomb = false;
                  }}
                >
                  BOMB
                </button>
                <button
                  type="button"
                  className="min-h-14 min-w-20 rounded-md bg-vf-cyan px-5 font-display text-sm font-bold text-vf-bg"
                  onPointerDown={() => {
                    const game = g();
                    if (game) game.touch.fire = true;
                  }}
                  onPointerUp={() => {
                    const game = g();
                    if (game) game.touch.fire = false;
                  }}
                >
                  FIRE
                </button>
              </div>
            </div>
              </>
            )}
          </>
        )}
      </div>
      <p className="hidden pb-2 font-mono text-[10px] text-vf-mute md:block">WASD move · SPACE gun · Z special · X bomb · C drone · P pause</p>
    </div>
  );
}


