// @ts-nocheck — recovered bundle + collision rewrite
import { Sfx } from "./audio";
import { Particles } from "./particles";
import { Fluid } from "./fluid";
import { loadControls, saveControls } from "./controls";
import {
  BUYOUT,
  bountyOf,
  emptyLoadout,
  emptyAmmo,
  shopPrice,
  SHOP,
  ammoMul,
  canEquip,
  specialCap,
  specialCount,
  DIFFS,
  type CrewMode,
  type DiffId,
  type Ending,
  type Loadout,
  type ShipId,
  type ShopId,
} from "./story";
import {
  ALPHA,
  continueCost,
  insertScore,
  loadTable,
  qualifies,
  type HiEntry,
} from "./hiscore";
import {
  STAGE_THEME,
  drawDecor,
  drawGround,
  targetSpec,
  isSoftTarget,
  isBlastTarget,
  isBuilding,
  type Decor,
  type Ground,
  type TargetKind,
} from "./terrain";
import {
  generateStageMap,
  drawTileMap,
  drawSprite,
  isWaterAt,
  sampleTerrainX,
  nearestTerrainX,
  mapToScreenY,
  screenToMapY,
  isWaterCell,
  isRoadTile,
  tileHash,
  TILE,
  MAP_COLS,
  MAP_ROWS,
  landPadAt,
  sampleLandX,
  nearestLandX,
  tileIdAt,
  isDriveLandId,
  isMetalTile,
} from "./world";
import { d2, overlap, sweep } from "./collide";

export const GW = 360;
export const GH = 640;

export type Screen =
  | "title"
  | "how"
  | "story"
  | "roster"
  | "select"
  | "intro"
  | "brief"
  | "shop"
  | "play"
  | "pause"
  | "over"
  | "win"
  | "clear"
  | "continue"
  | "name"
  | "ending"
  | "thanks"
  | "vsresult"
  | "controls";

export type ClearReport = {
  stage: number;
  last: boolean;
  score: number;
  hi: number;
  bounty: number;
  refund: number;
  lives: number;
  power: number;
  bombs: number;
  armor: number;
  medals: number;
  medalMul: number;
  bombMul: number;
  stageBonus: number;
  specials: { name: string; ammo: number; refund: number }[];
  kits: { name: string; owned: number }[];
};

export function stageBonusOf(medals: number, bombs: number) {
	const medalMul = Math.max(1, medals | 0);
	const bombMul = Math.max(1, bombs | 0);
	return medalMul * bombMul * 1000;
}

export const MEDAL_PTS = 500;
export const NIX_PTS = 3000;
export const SURPLUS_POW = 5000;
export const SURPLUS_P = 10000;
export const POWER_MAX = 4;
export const DRONE_MAX = 4;
export const BOMB_MAX = 7;
export const LAUNCH = {
	lock: 0.55,
	beat: 0.48,
	ignite: 0.55,
	shot: 2.05,
	lift: 0.8
};
const L_T3 = LAUNCH.lock;
const L_T2 = L_T3 + LAUNCH.beat;
const L_T1 = L_T2 + LAUNCH.beat;
const L_IGNITE = L_T1 + LAUNCH.beat;
const L_FIRE = L_IGNITE + LAUNCH.ignite;
const L_AIR = L_FIRE + LAUNCH.shot;
export const LAUNCH_DUR = L_AIR + LAUNCH.lift;
const LAUNCH_STARTS = {
	lock: 0,
	"3": L_T3,
	"2": L_T2,
	"1": L_T1,
	ignite: L_IGNITE,
	shot: L_FIRE,
	lift: L_AIR,
	air: LAUNCH_DUR
};
const LAUNCH_ENDS = {
	lock: L_T3,
	"3": L_T2,
	"2": L_T1,
	"1": L_IGNITE,
	ignite: L_FIRE,
	shot: L_AIR,
	lift: LAUNCH_DUR,
	air: LAUNCH_DUR
};

export function launchPhaseOf(elapsed: number) {
	if (elapsed < L_T3) return "lock";
	if (elapsed < L_T2) return "3";
	if (elapsed < L_T1) return "2";
	if (elapsed < L_IGNITE) return "1";
	if (elapsed < L_FIRE) return "ignite";
	if (elapsed < L_AIR) return "shot";
	return "lift";
}

export function fmtLaunchClock(sec: number) {
	const cs = Math.max(0, Math.round(Number(sec) * 100));
	const whole = Math.floor(cs / 100);
	const frac = cs % 100;
	return `${String(whole).padStart(2, "0")}.${String(frac).padStart(2, "0")}`;
}

export function launchPhaseRemain(elapsed: number) {
	const t = Math.max(0, elapsed);
	const phase = t >= LAUNCH_DUR ? "air" : launchPhaseOf(t);
	return Math.max(0, LAUNCH_ENDS[phase] - t);
}

export function launchPhaseAge(elapsed: number) {
	const t = Math.max(0, elapsed);
	const phase = t >= LAUNCH_DUR ? "air" : launchPhaseOf(t);
	return Math.max(0, t - LAUNCH_STARTS[phase]);
}



const HS_KEY = "vectorfang-hs-v1";
export const STAGES = [
	"FORWARD BASE",
	"STORM FRONT",
	"GREEN MAW",
	"GLASS DUNES",
	"RAZOR CANYON",
	"HOLLOW VEIN",
	"CLOUD DECK",
	"BLACK TIDE",
	"STEEL YARD",
	"THUNDERKEEP"
];
export const BONUS_STAGES = [
	"STAR HARVEST",
	"GILDED RUSH",
	"CROWN FALL"
];
const BOSS_META = [
	{
		kind: "siegecrawler",
		name: "SIEGE CRAWLER",
		hp: 125,
		r: 34,
		score: 3500,
		restY: 102,
		weak: "Radar mast — hit the dish from above."
	},
	{
		kind: "phantomwing",
		name: "PHANTOM WING",
		hp: 145,
		r: 36,
		score: 4200,
		restY: 84,
		weak: "It only silhouettes when it fires."
	},
	{
		kind: "rootcitadel",
		name: "ROOT CITADEL",
		hp: 160,
		r: 40,
		score: 5e3,
		restY: 90,
		weak: "Generator vents on the roof."
	},
	{
		kind: "dunehauler",
		name: "DUNE HAULER",
		hp: 175,
		r: 40,
		score: 5500,
		restY: 98,
		weak: "Cut the treads. Deck guns lose their angle."
	},
	{
		kind: "skypike",
		name: "SKY PIKE",
		hp: 190,
		r: 36,
		score: 6200,
		restY: 86,
		weak: "Belly bay opens on the dive."
	},
	{
		kind: "silohydra",
		name: "SILO HYDRA",
		hp: 210,
		r: 38,
		score: 7e3,
		restY: 96,
		weak: "Close the lids in order."
	},
	{
		kind: "ironalbatross",
		name: "IRON ALBATROSS",
		hp: 230,
		r: 44,
		score: 8e3,
		restY: 88,
		weak: "Inboard engines. Two dead and it drops."
	},
	{
		kind: "battlekeel",
		name: "BATTLEKEEL",
		hp: 255,
		r: 44,
		score: 9e3,
		restY: 102,
		weak: "Magazine hatches amidships."
	},
	{
		kind: "arsenalgate",
		name: "ARSENAL GATE",
		hp: 280,
		r: 38,
		score: 1e4,
		restY: 88,
		weak: "Hinge guns. Knock them or the gate closes."
	},
	{
		kind: "skycathedral",
		name: "SKY CATHEDRAL",
		hp: 360,
		r: 48,
		score: 16e3,
		restY: 108,
		weak: "Gap in the rotating shield, then the core."
	}
];
var SUB_BOSS = {
	kind: "krakenkeel",
	name: "KRAKEN KEEL",
	hp: 115,
	r: 32,
	score: 4e3,
	restY: 112,
	weak: "The snorkel. Then the magazine."
};
var BOSS_KINDS = new Set([...BOSS_META.map((b) => b.kind), SUB_BOSS.kind]);
export function isBossKind(k) {
	return BOSS_KINDS.has(k);
}
var SPRITE_SRC = {
	azure: "/sprites/azure.png",
	crimson: "/sprites/crimson.png",
	iron: "/sprites/iron.png",
	wasp: "/sprites/jet-red.png?v=top",
	hornet: "/sprites/jet-red2.png?v=top",
	gunbarge: "/sprites/tank-yellow.png?v=top",
	gilded: "/sprites/gilded.png",
	eyepod: "/sprites/eyepod.png",
	redtide: "/sprites/redtide.png",
	gyre: "/sprites/gyre.png",
	redmaw: "/sprites/redmaw.png",
	solarmoth: "/sprites/solarmoth.png",
	harborking: "/sprites/harborking.png",
	crowncore: "/sprites/crowncore.png",
	siegcrawler: "/sprites/siegecrawler.png",
	phantomwing: "/sprites/phantomwing.png",
	rootcitadel: "/sprites/rootcitadel.png",
	dunehauler: "/sprites/redmaw.png",
	skypike: "/sprites/skypike.png",
	silohydra: "/sprites/silohydra.png",
	ironalbatross: "/sprites/ironalbatross.png",
	krakenkeel: "/sprites/krakenkeel.png",
	battlekeel: "/sprites/harborking.png",
	arsenalgate: "/sprites/gyre.png",
	skycathedral: "/sprites/crowncore.png",
	tank: "/sprites/tank.png?v=top",
	heli: "/sprites/heli.png?v=top",
	gunboat: "/sprites/destroyer.png",
	destroyer: "/sprites/destroyer.png",
	sub: "/sprites/sub.png",
	keel: "/sprites/sub.png",
	strider: "/sprites/tank.png?v=top",
	tiles: "/sprites/tiles.png?v=reef3",
	"turret-blue": "/sprites/turret-blue.png?v=top",
	"turret-red": "/sprites/turret-red.png?v=top",
	"turret-orange": "/sprites/turret-orange.png?v=top",
	silo: "/sprites/silo.png",
	hangar: "/sprites/hangar.png?v=top",
	radar: "/sprites/radar.png",
	crate: "/sprites/crate.png",
	barrel: "/sprites/barrel.png",
	fuel: "/sprites/fuel.png",
	hut: "/sprites/hut.png?v=top",
	bush: "/sprites/bush.png",
	tree: "/sprites/tree.png?v=top",
	palm: "/sprites/palm.png",
	boat: "/sprites/boat.png"
};
export class VectorFangGame {
	canvas;
	ctx;
	sfx = new Sfx();
	sprites = {};
	keys = new Set();
	inject = new Set();
	screen: Screen = "title";
	ship: ShipId = "azure";
	score = 0;
	hi = 0;
	lives = 3;
	bombs = 3;
	power = 0;
	dronesN = 1;
	mode = "lance";
	overdrive = 0;
	invuln = 0;
	shake = 0;
	px = 180;
	py = 560;
	hitR = 4;
	speed = 200;
	fireCd = 0;
	bombCd = 0;
	stage = 0;
	stageT = 0;
	stageMedals = 0;
	launchT = 0;
	launchBark = "";
	spawnI = 0;
	chain = 1;
	chainT = 0;
	acc = 0;
	last = 0;
	running = false;
	raf = 0;
	enemies = [];
	pBullets = [];
	eBullets = [];
	items = [];
	fx = new Particles();
	fluid = new Fluid();
	fluidBg = 0;
	pops = [];
	luma = 0;
	drones = [{
		x: 0,
		y: 0,
		ang: 0
	}];
	bg = 0;
	muted = false;
	touch = {
		mx: 0,
		my: 0,
		moving: false,
		fire: false,
		bomb: false,
		mode: false,
		special: false
	};
	pad = {
		connected: false,
		name: "",
		x: 0,
		y: 0,
		fire: false,
		bomb: false,
		special: false,
		mode: false
	};
	padLatch = {
		up: false,
		down: false,
		left: false,
		right: false,
		confirm: false,
		cancel: false,
		start: false
	};
	padInject = null;
	padInject2 = null;
	controls = loadControls();
	controlsBack = "title";
	pads = [
		{ connected: false, name: "", x: 0, y: 0, buttons: Array(16).fill(false) },
		{ connected: false, name: "", x: 0, y: 0, buttons: Array(16).fill(false) }
	];
	_padPrev = [Array(16).fill(false), Array(16).fill(false)];
	_navHold = {
		x: 0,
		y: 0,
		next: 0
	};
	onChange = () => {};
	stageClearT = 0;
	bossAlive = false;
	bossWarn = false;
	midCleared = false;
	midSpawnT = 0;
	qaSpeed = 0;
	qaYaw = 0;
	modeHeld = false;
	ending: Ending | "none" = "none";
	loadout = emptyLoadout();
	ammo = emptyAmmo();
	railN = 0;
	armor = 0;
	specialCd = 0;
	clearReport = null;
	continues = 0;
	continueT = 0;
	hiTable = [];
	nameChars = [
		"A",
		"A",
		"A"
	];
	nameSlot = 0;
	pendingEnd: Screen = "over";
	diff: DiffId = "normal";
	vs = false;
	demo = false;
	idleT = 0;
	demoT = 0;
	demoPilotI = 0;
	cpuShip: ShipId = "crimson";
	cpuScore = 0;
	cx = 228;
	cy = 550;
	cpuFireCd = 0;
	crew: CrewMode = "solo";
	p2Ship: ShipId = "crimson";
	hack = false;
	hackBuf = "";
	arcadeTaps = 0;
	arcadeTapAt = 0;
	p2invuln = 0;
	startLives = 3;
	decor = [];
	grounds = [];
	map = generateStageMap(0);
	phaseBanner = 0;
	bossAtk = "";
	bonus = false;
	pendingBonus = false;
	bonusHit = 0;
	bonusMiss = 0;
	bonusNeed = 0;
	bonusStarGot = 0;
	bonusPay = 0;
	bonusBanner = 0;
	bonusSting = 0;
	bonusPerfect = false;
	constructor(canvas) {
		this.canvas = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("No 2D context");
		this.ctx = ctx;
		this.hi = Number(localStorage.getItem(HS_KEY) || 0);
		this.hiTable = loadTable();
		if (this.hiTable[0]) this.hi = Math.max(this.hi, this.hiTable[0].score);
		this.loadSprites();
		this.bind();
	}
	loadSprites() {
		for (const [k, src] of Object.entries(SPRITE_SRC)) {
			const im = new Image();
			im.crossOrigin = "anonymous";
			im.src = src;
			this.sprites[k] = im;
		}
	}
	bind() {
		const onDown = (e) => {
			this.keys.add(e.code);
			const wasDemo = this.demo;
			if (this.demo) this.abortDemo();
			this.noteHackKey(e, wasDemo);
			if ([
				"Space",
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight",
				"Enter"
			].includes(e.code)) e.preventDefault();
			if (e.code === "Escape" && (this.screen === "play" || this.screen === "pause")) this.pause();
			if (this.screen === "play" && this.pauseKey(e.code)) this.pause();
			if (e.code === "KeyM") this.toggleMute();
			if (this.screen === "continue" && (e.code === "Space" || e.code === "Enter" || e.code === "KeyZ")) this.doContinue();
			if (this.screen === "name") this.handleNameKey(e.code);
			if (this.screen === "intro" && (e.code === "Space" || e.code === "Enter")) this.dismissIntro();
			if (this.screen === "thanks" && (e.code === "Space" || e.code === "Enter")) this.dismissThanks();
		};
		const onUp = (e) => this.keys.delete(e.code);
		window.addEventListener("keydown", onDown);
		window.addEventListener("keyup", onUp);
		const onPad = () => this.sfx.unlock();
		window.addEventListener("gamepadconnected", onPad);
		window.addEventListener("blur", () => this.keys.clear());
		const onPointer = () => {
			if (this.demo) this.abortDemo();
		};
		this.canvas.addEventListener("pointerdown", onPointer);
		document.addEventListener("visibilitychange", () => {
			this.keys.clear();
			if (document.visibilityState === "visible") this.sfx.unlock();
		});
		this._unbind = () => {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
			window.removeEventListener("gamepadconnected", onPad);
			this.canvas.removeEventListener("pointerdown", onPointer);
		};
		if (typeof window !== "undefined") {
			window.__controlsTest = {
				getYaw: () => this.qaYaw,
				getSpeed: () => this.qaSpeed,
				setKeys: (codes) => {
					this.inject = new Set(codes);
				}
			};
			window.__vfDebug = {
				skipToBoss: (stage) => this.skipToBoss(stage),
				killBoss: () => {
					for (const e of this.enemies) if (e.alive && isBossKind(e.kind)) this.hurt(e, 9999, false);
				},
				burst: (x, y) => {
					this.boomFx(x ?? 180, y ?? 300, "#ffb347", 1.6);
					this.fx.splash((x ?? 180) + 40, (y ?? 300) + 20);
				},
				hurtBoss: (n) => {
					for (const e of this.enemies) if (e.alive && isBossKind(e.kind)) this.hurt(e, n ?? e.maxHp * .38, false);
				},
				grantBounty: () => {
					this.score = Math.max(this.score, Math.ceil(BUYOUT / 10));
					this.onChange();
				},
				forceOver: () => {
					this.ending = "mia";
					this.screen = "over";
					this.onChange();
				},
				forceContinue: () => this.offerContinue(),
				startDemo: () => this.startDemo(),
				abortDemo: () => this.abortDemo(),
				startHack: () => this.startHack(),
				clearPad: () => {
					this.padInject = null;
					this.padInject2 = null;
					for (const row of this._padPrev) row.fill(false);
				},
				setPad: (s = {}) => {
					const buttons = Array(16).fill(false);
					const map = {
						cross: 0,
						circle: 1,
						square: 2,
						triangle: 3,
						l1: 4,
						r1: 5,
						l2: 6,
						r2: 7,
						share: 8,
						options: 9,
						up: 12,
						down: 13,
						left: 14,
						right: 15
					};
					for (const [k, i] of Object.entries(map)) if (s[k]) buttons[i] = true;
					this.padInject = {
						connected: s.connected !== false,
						name: "Wireless Controller",
						buttons,
						axes: [s.x || 0, s.y || 0, 0, 0]
					};
				},
				setDevice: (player, device) => this.setDevice(player, device),
				openName: () => {
					this.nameChars = ["A", "A", "A"];
					this.nameSlot = 0;
					this.pendingEnd = "over";
					this.screen = "name";
					this.onChange();
				},
				setPad2: (s = {}) => {
					const buttons = Array(16).fill(false);
					const map = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, up: 12, down: 13, left: 14, right: 15 };
					for (const [k, i] of Object.entries(map)) if (s[k]) buttons[i] = true;
					this.padInject2 = { connected: s.connected !== false, name: "Wireless Controller 2", buttons, axes: [s.x || 0, s.y || 0, 0, 0] };
					if (!this.padInject) this.padInject = { connected: false, name: "", buttons: Array(16).fill(false), axes: [0, 0, 0, 0] };
				},
				playStage: (n) => {
					this.hack = false;
					this.demo = false;
					this.vs = false;
					this.startRun();
					this.stage = Math.max(0, Math.min(9, n ?? 0));
					this.beginStage();
					this.invuln = 8;
					this.screen = "play";
					this.sfx.startMusic(this.stage);
					this.onChange();
				},
				grantMedals: (n = 1) => {
					this.stageMedals = Math.max(0, (this.stageMedals | 0) + (n | 0));
					this.onChange();
					return {
						medals: this.stageMedals,
						bombs: this.bombs,
						bonus: stageBonusOf(this.stageMedals, this.bombs)
					};
				},
				setBombs: (n) => {
					this.bombs = Math.max(0, Math.min(7, n | 0));
					this.onChange();
					return this.bombs;
				},
				setPower: (n) => {
					this.power = Math.max(0, Math.min(POWER_MAX, n | 0));
					this.onChange();
					return this.power;
				},
				setDrones: (n) => {
					this.dronesN = Math.max(1, Math.min(DRONE_MAX, n | 0));
					this.onChange();
					return this.dronesN;
				},
				forceHit: () => {
					this.armor = 0;
					this.playerHit("p1");
					return {
						lives: this.lives,
						luma: this.luma,
						items: this.items.filter((i) => i.alive).map((i) => i.type)
					};
				},
				forceClear: () => {
					this.openClear();
					return this.clearReport;
				},
				dropMedal: (x, y) => {
					this.forceDrop(x ?? this.px, y ?? this.py - 90, "M");
				},
				dropNix: (x, y) => this.forceDrop(x ?? this.px, y ?? this.py - 90, "N"),
				dropFairy: (x, y) => this.forceDrop(x ?? this.px, y ?? this.py - 90, "F"),
				dropPod: (type, x, y, extra) => this.forceDrop(x ?? this.px, y ?? this.py - 90, type, extra || {}),
				grantLuma: (n = 1) => {
					this.luma = n ? 1 : 0;
					this.onChange();
					return this.luma;
				},
				dumpItems: () => this.items.filter((i) => i.alive).map((i) => ({
					type: i.type,
					x: Math.round(i.x),
					y: Math.round(i.y),
					planted: !!i.planted,
					hide: !!i.hide,
					wy: i.wy != null ? Math.round(i.wy) : null
				})),
				dumpHud: () => {
					const elapsed = this.launchElapsed();
					const fired = elapsed >= L_FIRE;
					return {
					score: this.score,
					power: this.power,
					bombs: this.bombs,
					drones: this.dronesN,
					medals: this.stageMedals,
					luma: this.luma,
					lives: this.lives,
					armor: this.armor,
					launchT: Math.round(this.launchT * 100) / 100,
					launchU: Math.round(this.launchU() * 100) / 100,
					elapsed: Math.round(elapsed * 100) / 100,
					phase: this.launchPhase(),
					tMinus: Math.round(Math.max(0, L_FIRE - elapsed) * 100) / 100,
					tPlus: Math.round(Math.max(0, elapsed - L_FIRE) * 100) / 100,
					remain: Math.round(launchPhaseRemain(elapsed) * 100) / 100,
					clock: fired
						? `T-PLUS ${fmtLaunchClock(elapsed - L_FIRE)}`
						: `T-MINUS ${fmtLaunchClock(L_FIRE - elapsed)}`,
					px: Math.round(this.px),
					py: Math.round(this.py),
					bg: Math.round(this.bg),
					bonus: stageBonusOf(this.stageMedals, this.bombs)
					};
				},
				skipLaunch: () => {
					this.launchT = 0;
					this.py = 520;
				},
				setLaunchElapsed: (t) => {
					const n = Math.max(0, Number(t) || 0);
					this.launchT = Math.max(0, LAUNCH_DUR - n);
					this.launchBark = this.launchPhase();
					this.tickLaunch(0);
				},
				freezePlay: (on = true) => {
					if (on) {
						if (this.screen === "play") this.screen = "pause";
					} else if (this.screen === "pause") this.screen = "play";
					this.onChange();
					return this.screen;
				},
				setBg: (n) => {
					this.bg = Math.max(0, n | 0);
				},
				clearItems: () => {
					this.items.forEach((i) => { i.alive = false; });
				},
				dumpUnits: () => this.enemies.filter((e) => e.alive).map((e) => ({
					kind: e.kind,
					x: Math.round(e.x),
					y: Math.round(e.y),
					ground: e.ground,
					wet: this.wet(e.x, e.y),
					wetBox: this.wetSpan(e.x, e.y, e.r * .6),
					land: this.onDriveLand(e.x, e.y, e.r),
					tile: tileIdAt(this.map, e.x, e.y, this.bg),
					phase: e.phase,
					tag: Math.round(e.tag * 100) / 100,
					atk: e.atk
				})),
				plantTanks: (n = 4) => {
					const ys = [90, 210, 330, 460];
					const out = [];
					for (const y of ys.slice(0, n)) {
						const x = sampleLandX(this.map, y, this.bg);
						if (x == null) continue;
						this.spawnE({
							kind: "tank",
							x,
							y,
							vx: Math.random() < .5 ? 30 : -30,
							vy: this.terrainVy(),
							hp: 12,
							r: 16,
							score: 420,
							ground: true,
							phase: 0,
							tag: 0.15,
							tell: 1,
							atk: 0
						});
						out.push({
							x: Math.round(x),
							y,
							land: this.onDriveLand(x, y, 16),
							wet: this.wet(x, y)
						});
					}
					return out;
				},
				probeLand: (x, y) => ({
					land: this.onDriveLand(x, y, 16),
					wet: this.wet(x, y),
					wetUp: this.wet(x, y - 18),
					wetDown: this.wet(x, y + 14),
					span: this.wetSpan(x, y, 8),
					tile: tileIdAt(this.map, x, y, this.bg),
					bg: Math.round(this.bg)
				}),
				song: () => this.sfx.song,
				unlockAudio: () => this.unlock(),
				tapArcade: () => this.tapArcade(),
				startBonus: () => this.startBonus(),
				endBonus: (perfect = true) => {
					if (!this.bonus) this.startBonus();
					if (perfect) {
						this.bonusNeed = Math.max(1, this.bonusNeed, this.bonusHit);
						this.bonusHit = this.bonusNeed;
						this.bonusMiss = 0;
					}
					this.finishBonus();
				},
				stopHack: () => {
					this.hack = false;
				}
			};
		}
	}
	skipToBoss(stage) {
		if (typeof stage === "number") this.stage = Math.max(0, Math.min(9, stage | 0));
		this.unlock();
		if (this.screen !== "play" && this.screen !== "pause") {
			this.lives = 3;
			this.bombs = 3;
			this.power = 2;
			this.dronesN = 2;
		}
		this.screen = "play";
		this.bonus = false;
		this.bonusBanner = 0;
		this.beginStage();
		this.bossWarn = true;
		this.stageT = 44;
		this.sfx.startMusic(this.stage);
		this.spawnBoss();
		this.onChange();
	}
	destroy() {
		this.running = false;
		cancelAnimationFrame(this.raf);
		this.sfx.stopMusic();
		this._unbind?.();
	}
	unlock() {
		this.sfx.unlock();
		if (this.screen === "title" || this.screen === "how" || this.screen === "story" || this.screen === "roster") this.sfx.startTitleMusic();
	}
	toggleMute() {
		this.muted = !this.muted;
		this.sfx.setMuted(this.muted);
		this.onChange();
	}
	choose(ship) {
		this.ship = ship;
		this.onChange();
	}
	setDiff(d) {
		this.diff = d;
		this.onChange();
	}
	setVs(on) {
		this.vs = on;
		if (on) this.crew = "solo";
		this.onChange();
	}
	setCrew(mode) {
		this.crew = mode;
		if (mode !== "solo") this.vs = false;
		if (this.p2Ship === this.ship) this.p2Ship = this.ship === "azure" ? "crimson" : this.ship === "crimson" ? "iron" : "azure";
		this.onChange();
	}
	chooseP2(ship) {
		this.p2Ship = ship;
		this.onChange();
	}
	hasWing() {
		return !this.vs && (this.crew === "duo" || this.crew === "wingman");
	}
	diffOf() {
		return DIFFS[this.diff];
	}
	startRun() {
		this.idleT = 0;
		this.unlock();
		this.demo = false;
		this.score = 0;
		this.cpuScore = 0;
		this.bonus = false;
		this.pendingBonus = false;
		this.bonusBanner = 0;
		this.loadout = emptyLoadout();
		this.ammo = emptyAmmo();
		this.startLives = Math.max(1, (this.ship === "iron" ? 4 : 3) + this.diffOf().lives);
		this.lives = this.startLives;
		this.bombs = 3;
		this.power = 0;
		this.dronesN = 1;
		this.luma = 0;
		this.mode = "lance";
		this.overdrive = 0;
		this.stage = 0;
		this.ending = "none";
		this.continues = 0;
		this.continueT = 0;
		this.railN = 0;
		this.p2invuln = 0;
		if (this.vs) {
			this.cpuShip = this.ship === "azure" ? "crimson" : this.ship === "crimson" ? "iron" : "azure";
			this.stage = Math.floor(Math.random() * 5);
			this.cx = 220;
			this.cy = 550;
			this.cpuFireCd = 0;
		} else if (this.hasWing()) {
			this.cpuShip = this.p2Ship;
			this.cx = 220;
			this.cy = 550;
			this.cpuFireCd = 0;
		}
		this.applyLoadout();
		this.beginStage();
		if (this.vs) {
			this.px = 140;
			this.cx = 220;
			this.cy = 550;
			this.power = Math.max(this.power, 2);
			this.dronesN = Math.max(this.dronesN, 2);
			this.screen = "play";
			this.sfx.startMusic(this.stage);
		} else if (this.hack) {
			this.power = Math.max(this.power, 2);
			this.dronesN = Math.max(this.dronesN, 2);
			this.screen = "play";
			this.sfx.startMusic(0);
		} else {
			this.screen = "intro";
			this.sfx.startBriefMusic();
		}
		this.onChange();
	}
	noteHackKey(e, fromDemo = false) {
		if (this.hack) return;
		if (this.screen !== "title" && !fromDemo) return;
		if (e.repeat) return;
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.code === "Backspace") {
			e.preventDefault();
			this.typeHack(this.hackBuf.slice(0, -1));
			return;
		}
		if ((new Set([
			"ShiftLeft",
			"ShiftRight",
			"ControlLeft",
			"ControlRight",
			"AltLeft",
			"AltRight",
			"MetaLeft",
			"MetaRight",
			"CapsLock",
			"Tab",
			"Space"
		])).has(e.code)) return;
		const fromCode = e.code.startsWith("Key") ? e.code.slice(3) : "";
		const ch = /^[A-Z]$/.test(fromCode) ? fromCode : e.key.length === 1 ? e.key.toUpperCase() : "";
		if (!/^[A-Z]$/.test(ch)) return;
		this.typeHack(this.hackBuf + ch);
	}
	typeHack(raw) {
		if (this.hack || this.screen !== "title") return;
		const next = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
		if (next === this.hackBuf) return;
		this.hackBuf = next;
		this.idleT = 0;
		this.onChange();
		if (next === "HACKMODE") window.setTimeout(() => {
			if (this.screen === "title" && this.hackBuf === "HACKMODE" && !this.hack) this.startHack();
		}, 420);
	}
	tapArcade() {
		if (this.screen !== "title" || this.hack) return;
		const now = performance.now();
		if (now - this.arcadeTapAt > 1400) this.arcadeTaps = 0;
		this.arcadeTapAt = now;
		this.arcadeTaps += 1;
		this.idleT = 0;
		this.onChange();
		if (this.arcadeTaps >= 8) {
			this.arcadeTaps = 0;
			this.startHack();
		}
	}
	startHack() {
		this.unlock();
		this.hack = true;
		this.vs = false;
		this.crew = "solo";
		this.demo = false;
		this.diff = "normal";
		this.ship = [
			"azure",
			"crimson",
			"iron"
		][Math.random() * 3 | 0];
		this.startRun();
	}
	dismissIntro() {
		if (this.screen !== "intro") return;
		this.screen = "brief";
		this.onChange();
	}
	dismissThanks() {
		if (this.screen !== "thanks") return;
		this.screen = "ending";
		this.onChange();
	}
	startDemo() {
		this.unlock();
		this.demo = true;
		this.vs = false;
		this.hack = false;
		this.ship = [
			"azure",
			"crimson",
			"iron"
		][this.demoPilotI % 3];
		this.demoPilotI += 1;
		this.stage = Math.floor(Math.random() * 7);
		this.score = 0;
		this.loadout = emptyLoadout();
		this.ammo = emptyAmmo();
		this.lives = 99;
		this.bombs = 3;
		this.power = 2;
		this.dronesN = 2;
		this.mode = "lance";
		this.overdrive = 0;
		this.demoT = 12;
		this.applyLoadout();
		this.beginStage();
		this.invuln = 0;
		this.power = Math.max(this.power, 2);
		this.dronesN = Math.max(this.dronesN, 2);
		this.screen = "play";
		this.sfx.startMusic(this.stage);
		this.onChange();
	}
	abortDemo() {
		if (!this.demo) return;
		this.demo = false;
		this.demoT = 0;
		this.idleT = 0;
		this.invuln = 0;
		this.sfx.stopMusic();
		this.screen = "title";
		this.onChange();
		this.sfx.startTitleMusic();
	}
	goTitle() {
		this.demo = false;
		this.vs = false;
		this.hack = false;
		this.hackBuf = "";
		this.arcadeTaps = 0;
		this.bonus = false;
		this.pendingBonus = false;
		this.bonusBanner = 0;
		this.demoT = 0;
		this.idleT = 0;
		this.invuln = 0;
		this.sfx.stopMusic();
		this.screen = "title";
		this.onChange();
		this.sfx.startTitleMusic();
	}
	openSelect(vs = false) {
		this.unlock();
		this.demo = false;
		this.vs = vs;
		this.idleT = 0;
		this.screen = "select";
		this.sfx.startHangarMusic();
		this.onChange();
	}
	launchCampaign() {
		this.vs = false;
		this.hack = false;
		this.startRun();
	}
	launchVs() {
		this.vs = true;
		this.hack = false;
		this.crew = "solo";
		this.startRun();
	}
	launchSortie() {
		this.unlock();
		this.applyLoadout();
		this.screen = "play";
		this.sfx.startMusic(this.stage);
		this.onChange();
	}
	openHangar() {
		this.screen = "shop";
		this.sfx.startHangarMusic();
		this.onChange();
	}
	priceOf(id) {
		const item = SHOP.find((s) => s.id === id);
		if (!item) return 0;
		return shopPrice(item, this.ship, this.loadout[id]);
	}
	buy(id) {
		const item = SHOP.find((s) => s.id === id);
		if (!item) return;
		if (!canEquip(item, this.ship)) return;
		if (this.loadout[id] >= item.max) return;
		if (item.cat === "special" && this.loadout[id] === 0 && specialCount(this.loadout) >= specialCap(this.ship)) return;
		const price = shopPrice(item, this.ship, this.loadout[id]);
		if (bountyOf(this.score) < price) return;
		this.score = Math.max(0, this.score - Math.ceil(price / 10));
		this.loadout[id] += 1;
		if (id === "plate") this.lives += 1;
		if (item.cat === "special") this.ammo[id] = Math.floor(item.ammo * ammoMul(this.ship));
		this.applyLoadout();
		this.sfx.pickup();
		this.onChange();
	}
	applyLoadout() {
		this.power = Math.max(this.power, this.loadout.cannon);
		this.dronesN = Math.min(4, Math.max(this.dronesN, 1 + this.loadout.drone));
		this.bombs = Math.min(7, Math.max(this.bombs, 3 + this.loadout.cell));
		this.armor = this.loadout.shield >= 2 ? 5 : this.loadout.shield >= 1 ? 3 : 0;
	}
	refundSpecials() {
		let back = 0;
		for (const item of SHOP) {
			if (item.cat !== "special" || this.loadout[item.id] <= 0) continue;
			const maxA = Math.max(1, Math.floor(item.ammo * ammoMul(this.ship)));
			const left = Math.max(0, this.ammo[item.id]);
			back += Math.floor(item.price * (left / maxA));
			this.loadout[item.id] = 0;
			this.ammo[item.id] = 0;
		}
		this.loadout.cell = 0;
		this.loadout.shield = 0;
		this.armor = 0;
		if (back > 0) this.score += Math.ceil(back / 10);
		return back;
	}
	snapshotClear() {
		const specials = [];
		let refund = 0;
		for (const item of SHOP) {
			if (item.cat !== "special" || this.loadout[item.id] <= 0) continue;
			const maxA = Math.max(1, Math.floor(item.ammo * ammoMul(this.ship)));
			const left = Math.max(0, this.ammo[item.id]);
			const cash = Math.floor(item.price * (left / maxA));
			refund += cash;
			specials.push({
				name: item.name,
				ammo: left,
				refund: cash
			});
		}
		const kits = SHOP.filter((s) => s.cat === "kit" && this.loadout[s.id] > 0).map((s) => ({
			name: s.name,
			owned: this.loadout[s.id]
		}));
		return {
			stage: this.stage,
			last: this.stage >= 9,
			score: this.score,
			hi: Math.max(this.hi, this.score),
			bounty: bountyOf(this.score) + refund,
			refund,
			lives: this.lives,
			power: this.power,
			bombs: this.bombs,
			armor: this.armor,
			medals: this.stageMedals | 0,
			medalMul: Math.max(1, this.stageMedals | 0),
			bombMul: Math.max(1, this.bombs | 0),
			stageBonus: stageBonusOf(this.stageMedals, this.bombs),
			specials,
			kits
		};
	}
	openClear() {
		this.score += stageBonusOf(this.stageMedals, this.bombs);
		this.clearReport = this.snapshotClear();
		this.refundSpecials();
		this.saveHi();
		this.clearReport.score = this.score;
		this.clearReport.bounty = this.bounty;
		this.clearReport.hi = this.hi;
		this.stageClearT = 0;
		if (this.vs) {
			this.openVsResult();
			return;
		}
		if (this.hack) {
			if (this.stage >= 9) {
				this.ending = bountyOf(this.score) >= 1e6 ? "both" : "served";
				this.finishRun("thanks");
			} else if (this.stage === 1 || this.stage === 4 || this.stage === 7) this.startBonus();
			else {
				this.stage += 1;
				this.sfx.startMusic(this.stage);
				this.beginStage();
				this.screen = "play";
				this.onChange();
			}
			return;
		}
		this.pendingBonus = this.stage === 1 || this.stage === 4 || this.stage === 7;
		this.screen = "clear";
		this.sfx.startClearMusic();
		this.onChange();
	}
	openVsResult() {
		this.saveHi();
		this.sfx.startTitleMusic();
		this.pendingEnd = "vsresult";
		if (qualifies(this.score, this.hiTable)) {
			this.nameChars = [
				"A",
				"A",
				"A"
			];
			this.nameSlot = 0;
			this.screen = "name";
		} else this.screen = "vsresult";
		this.onChange();
	}
	continueFromClear() {
		if (!this.clearReport) return;
		if (this.clearReport.last) {
			this.ending = bountyOf(this.score) >= 1e6 ? "both" : "served";
			this.finishRun("thanks");
			return;
		}
		if (this.pendingBonus) {
			this.pendingBonus = false;
			this.startBonus();
			return;
		}
		this.stage += 1;
		this.sfx.startBriefMusic();
		this.beginStage();
		this.screen = "brief";
		this.onChange();
	}
	cashOut() {
		if (bountyOf(this.score) < 1e6) return;
		this.ending = "bought";
		this.finishRun("thanks");
	}
	desert() {
		this.ending = "desert";
		this.finishRun("over");
	}
	continuePrice() {
		return continueCost(this.continues);
	}
	canContinue() {
		return this.ending !== "desert" && bountyOf(this.score) >= this.continuePrice();
	}
	offerContinue() {
		this.ending = "mia";
		this.saveHi();
		if (this.hack) {
			this.finishRun("over");
			return;
		}
		this.continueT = 8.99;
		this.screen = "continue";
		this.sfx.warn();
		this.onChange();
	}
	doContinue() {
		if (this.screen !== "continue") return;
		const price = this.continuePrice();
		if (bountyOf(this.score) < price) return;
		this.score = Math.max(0, this.score - Math.ceil(price / 10));
		this.continues += 1;
		this.lives = Math.max(1, (this.ship === "iron" ? 4 : 3) + this.diffOf().lives);
		this.bombs = Math.max(this.bombs, 3);
		this.invuln = 2.4;
		this.continueT = 0;
		this.eBullets.forEach((b) => b.alive = false);
		this.px = 180;
		this.py = 550;
		this.screen = "play";
		this.sfx.pickup();
		this.onChange();
	}
	skipContinue() {
		if (this.screen !== "continue") return;
		this.finishRun("over");
	}
	finishRun(next) {
		this.saveHi();
		this.pendingEnd = next;
		if (next === "thanks") this.sfx.startEndingMusic();
		else if (next === "over") this.sfx.startTitleMusic();
		if (qualifies(this.score, this.hiTable)) {
			this.nameChars = [
				"A",
				"A",
				"A"
			];
			this.nameSlot = 0;
			this.screen = "name";
		} else this.screen = next;
		this.onChange();
	}
	handleNameKey(code) {
		if (code === "ArrowLeft" || code === "KeyA") this.nameSlot = (this.nameSlot + 2) % 3;
		if (code === "ArrowRight" || code === "KeyD") this.nameSlot = (this.nameSlot + 1) % 3;
		if (code === "ArrowUp" || code === "KeyW") this.nudgeName(1);
		if (code === "ArrowDown" || code === "KeyS") this.nudgeName(-1);
		if (code === "Enter" || code === "Space") this.submitName();
		this.onChange();
	}
	nudgeName(dir) {
		const n = (ALPHA.indexOf(this.nameChars[this.nameSlot]) + dir + ALPHA.length) % ALPHA.length;
		this.nameChars[this.nameSlot] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[n] ?? "A";
		this.onChange();
	}
	setNameSlot(i) {
		this.nameSlot = (i % 3 + 3) % 3;
		this.onChange();
	}
	submitName() {
		this.hiTable = insertScore({
			name: this.nameChars.join(""),
			score: this.score,
			ship: this.ship,
			stage: this.stage
		});
		this.hi = this.hiTable[0]?.score ?? this.hi;
		this.screen = this.pendingEnd;
		this.onChange();
	}
	get bounty() {
		return bountyOf(this.score);
	}
	canBuy() {
		return bountyOf(this.score) >= BUYOUT;
	}
	beginStage() {
		this.fx.clear();
		this.fluid.clear();
		this.stageT = 0;
		this.spawnI = -1;
		this.bossAlive = false;
		this.bossWarn = false;
		this.midCleared = false;
		this.midSpawnT = 0;
		this.stageClearT = 0;
		this.stageMedals = 0;
		this.px = 180;
		this.py = 550;
		this.invuln = 1.4;
		if (this.ship === "azure") {
			this.speed = 228;
			this.hitR = 3.2;
		} else if (this.ship === "crimson") {
			this.speed = 188;
			this.hitR = 4.2;
		} else {
			this.speed = 150;
			this.hitR = 5;
		}
		this.applyLoadout();
		this.bg = 0;
		this.fluidBg = 0;
		this.launchT = this.stage === 0 && !this.vs && !this.hack && !this.demo ? LAUNCH_DUR : 0;
		this.launchBark = "";
		if (this.launchT > 0) {
			this.px = 180;
			this.py = 552;
			this.invuln = Math.max(this.invuln, LAUNCH_DUR + 0.4);
		}
		this.enemies.forEach((e) => e.alive = false);
		this.eBullets.forEach((b) => b.alive = false);
		this.pBullets.forEach((b) => b.alive = false);
		this.items.forEach((i) => i.alive = false);
		this.seedTerrain();
		if (this.vs || this.hasWing()) {
			this.px = this.launchT > 0 ? 164 : 140;
			this.py = this.launchT > 0 ? 552 : 550;
			this.cx = this.launchT > 0 ? 196 : 220;
			this.cy = this.py;
			this.p2invuln = 1.4;
		}
	}
	launchU() {
		if (this.launchT <= 0) return 1;
		return Math.max(0, Math.min(1, 1 - this.launchT / LAUNCH_DUR));
	}
	launchElapsed() {
		if (this.launchT <= 0) return LAUNCH_DUR;
		return Math.max(0, LAUNCH_DUR - this.launchT);
	}
	launchPhase() {
		if (this.launchT <= 0) return "air";
		return launchPhaseOf(this.launchElapsed());
	}
	tickLaunch(dt) {
		this.launchT = Math.max(0, this.launchT - dt);
		const t = this.launchElapsed();
		const phase = launchPhaseOf(t);
		const hold = phase === "lock" || phase === "3" || phase === "2" || phase === "1";
		const rumble = Math.sin(this.stageT * 64) * (hold ? 1.1 + (phase === "1" ? 0.5 : phase === "2" ? 0.3 : 0) : 0.28);
		this.px = 180;
		if (hold) {
			this.py = 552 + rumble;
			this.shake = Math.max(this.shake, phase === "lock" ? 1.2 : 2.2);
		} else if (phase === "ignite") {
			this.py = 548 + rumble * 0.4;
			this.shake = Math.max(this.shake, 9);
		} else if (phase === "shot") {
			const p = Math.max(0, Math.min(1, (t - L_FIRE) / LAUNCH.shot));
			const ease = p * p * (3 - 2 * p);
			this.py = 548 - ease * 248;
			this.shake = Math.max(this.shake, 2.6);
			if ((this.stageT * 36 | 0) !== ((this.stageT - dt) * 36 | 0)) {
				const col = this.ship === "crimson" ? "#9dff4a" : this.ship === "azure" ? "#5ce8ff" : "#ffe08a";
				this.spark(this.px + (Math.random() - 0.5) * 10, this.py + 20, 2, col);
			}
		} else {
			const p = Math.max(0, Math.min(1, (t - L_AIR) / LAUNCH.lift));
			this.py = 300 + p * 60;
		}
		if (this.vs || this.hasWing()) {
			this.px = 164;
			this.cx = 196;
			this.cy = this.py;
		}
		this.invuln = Math.max(this.invuln, this.launchT + 0.4);
		if (phase !== this.launchBark) {
			if (phase === "lock") this.sfx.beep(180, 0.12, "square", 0.16, 40);
			else if (phase === "3" || phase === "2" || phase === "1") this.sfx.count(phase);
			else if (phase === "ignite") this.sfx.launch();
			else if (phase === "shot") this.sfx.overdrive();
			else if (phase === "lift") this.sfx.beep(880, 0.18, "square", 0.16, 200);
			this.launchBark = phase;
		}
	}
	bonusName() {
		if (this.stage <= 1) return BONUS_STAGES[0];
		if (this.stage <= 4) return BONUS_STAGES[1];
		return BONUS_STAGES[2];
	}
	startBonus() {
		this.unlock();
		this.bonus = true;
		this.pendingBonus = false;
		this.bonusHit = 0;
		this.bonusMiss = 0;
		this.bonusNeed = 0;
		this.bonusStarGot = 0;
		this.bonusPay = 0;
		this.bonusPerfect = false;
		this.bonusBanner = 0;
		this.bonusSting = 2.1;
		this.bossAlive = false;
		this.bossWarn = false;
		this.midSpawnT = 0;
		this.stageClearT = 0;
		this.stageT = 0;
		this.spawnI = -1;
		this.stageMedals = 0;
		this.px = 180;
		this.py = 550;
		this.invuln = 1.8;
		this.enemies.forEach((e) => e.alive = false);
		this.eBullets.forEach((b) => b.alive = false);
		this.pBullets.forEach((b) => b.alive = false);
		this.items.forEach((i) => i.alive = false);
		this.grounds.forEach((g) => g.alive = false);
		this.seedTerrain();
		this.grounds.forEach((g) => {
			g.alive = false;
		});
		this.screen = "play";
		this.sfx.startBonusMusic();
		this.sfx.warn();
		this.onChange();
	}
	spawnBonusMark(kind, x, y, extra = {}) {
		const e = this.spawnE({
			kind,
			x,
			y,
			vy: extra.vy ?? 58,
			vx: extra.vx ?? 0,
			hp: extra.hp ?? 4,
			r: extra.r ?? 14,
			score: extra.score ?? 500,
			ground: extra.ground ?? false,
			mark: true
		});
		this.bonusNeed += 1;
		return e;
	}
	spawnBonusGround(kind, x, y) {
		const g = this.spawnGround(kind, x, y);
		g.mark = true;
		g.hp = Math.max(2, Math.ceil(g.maxHp * .45));
		g.maxHp = g.hp;
		this.bonusNeed += 1;
		return g;
	}
	spawnStar(x, y, vy = 48) {
		this.forceDrop(x, y, "T");
		const it = this.items.find((i) => i.alive && i.type === "T" && i.x === x && i.y === y);
		if (it) it.vy = vy;
	}
	creditBonusTarget(x, y) {
		this.bonusHit += 1;
		this.bonusPay += 500;
		this.score += 500;
		this.spawnStar(x, y, 42);
		this.boomFx(x, y, "#f0c14a", 0.8);
		this.onChange();
	}
	missBonusTarget() {
		this.bonusMiss += 1;
		this.onChange();
	}
	finishBonus() {
		if (this.bonusBanner > 0 || !this.bonus) return;
		const perfect = this.bonusMiss === 0 && this.bonusNeed > 0 && this.bonusHit >= this.bonusNeed;
		this.bonusPerfect = perfect;
		const extra = perfect ? 1e4 + this.bonusHit * 500 : this.bonusHit * 200;
		this.bonusPay += extra;
		this.score += extra;
		this.bonusBanner = 3.4;
		this.shake = perfect ? 10 : 5;
		if (perfect) this.sfx.overdrive();
		else this.sfx.pickup();
		this.onChange();
	}
	leaveBonus() {
		this.bonus = false;
		this.bonusBanner = 0;
		this.bonusSting = 0;
		this.stage += 1;
		this.beginStage();
		if (this.hack || this.demo) {
			this.screen = "play";
			this.sfx.startMusic(this.stage);
		} else {
			this.screen = "brief";
			this.sfx.startBriefMusic();
		}
		this.onChange();
	}
	pause() {
		if (this.demo) return;
		if (this.screen === "play") this.screen = "pause";
		else if (this.screen === "pause") this.screen = "play";
		this.onChange();
	}
	held(code) {
		return this.keys.has(code) || this.inject.has(code);
	}
	pauseKey(code) {
		if (this.controls.p1.device !== "pad" && code === this.controls.p1.keys.pause) return true;
		if (this.controls.p2.device !== "pad" && code === this.controls.p2.keys.pause) return true;
		return false;
	}
	openControls() {
		this.controlsBack = this.screen === "controls" ? "title" : this.screen === "play" ? "pause" : this.screen;
		this.screen = "controls";
		this.onChange();
	}
	closeControls() {
		const back = this.controlsBack;
		this.screen = back === "controls" || back === "play" ? "title" : back || "title";
		this.onChange();
	}
	setDevice(player, device) {
		const side = player === 2 ? this.controls.p2 : this.controls.p1;
		side.device = device;
		saveControls(this.controls);
		this.onChange();
	}
	bindAct(player, kind, act, value) {
		const side = player === 2 ? this.controls.p2 : this.controls.p1;
		if (kind === "pad") side.pad[act] = value;
		else side.keys[act] = value;
		saveControls(this.controls);
		this.onChange();
	}
	slotFor(player) {
		const p1pad = this.controls.p1.device !== "keys";
		const p2pad = this.controls.p2.device !== "keys";
		if (player === 1) return p1pad ? 0 : -1;
		if (!p2pad) return -1;
		return p1pad ? 1 : 0;
	}
	blankPad() {
		return { connected: false, name: "", x: 0, y: 0, buttons: Array(16).fill(false), axes: [0, 0, 0, 0] };
	}
	packPad(gp) {
		if (!gp) return this.blankPad();
		if (gp.buttons && gp.axes && gp.name !== undefined && !gp.id && !gp.mapping) {
			const dead = .18;
			let x = gp.axes[0] || 0;
			let y = gp.axes[1] || 0;
			if (Math.abs(x) < dead) x = 0;
			if (Math.abs(y) < dead) y = 0;
			return {
				connected: !!gp.connected,
				name: gp.name || "",
				x: Math.max(-1, Math.min(1, x)),
				y: Math.max(-1, Math.min(1, y)),
				buttons: gp.buttons.slice(0, 16),
				axes: gp.axes.slice(0, 4)
			};
		}
		const buttons = Array(16).fill(false);
		const axes = [0, 0, 0, 0];
		for (let i = 0; i < 16; i++) {
			const b = gp.buttons[i];
			buttons[i] = !!(b && (b.pressed || b.value > .45));
		}
		for (let i = 0; i < 4; i++) axes[i] = gp.axes[i] || 0;
		const dead = .18;
		let x = axes[0];
		let y = axes[1];
		if (Math.abs(x) < dead) x = 0;
		if (Math.abs(y) < dead) y = 0;
		return {
			connected: true,
			name: gp.id || "Gamepad",
			x: Math.max(-1, Math.min(1, x)),
			y: Math.max(-1, Math.min(1, y)),
			buttons,
			axes
		};
	}
	readPads() {
		if (this.padInject || this.padInject2) return [this.packPad(this.padInject), this.packPad(this.padInject2)];
		const list = typeof navigator !== "undefined" && navigator.getGamepads ? [...navigator.getGamepads()].filter((g) => g && g.connected) : [];
		return [this.packPad(list[0]), this.packPad(list[1])];
	}
	actionDown(player, act) {
		const side = player === 2 ? this.controls.p2 : this.controls.p1;
		if (side.device !== "pad" && this.held(side.keys[act])) return true;
		if (side.device === "keys") return false;
		const slot = this.slotFor(player);
		const pad = slot >= 0 ? this.pads[slot] : null;
		if (!pad || !pad.connected) return false;
		const bound = side.pad[act];
		const pairs = { fire: [0, 7], bomb: [1, 5], special: [2, 4] };
		const group = pairs[act];
		if (group && group.includes(bound)) return group.some((i) => pad.buttons[i]);
		return !!pad.buttons[bound];
	}
	moveVec(player) {
		const side = player === 2 ? this.controls.p2 : this.controls.p1;
		let x = 0, y = 0;
		if (side.device !== "pad") {
			if (this.held(side.keys.left)) x -= 1;
			if (this.held(side.keys.right)) x += 1;
			if (this.held(side.keys.up)) y -= 1;
			if (this.held(side.keys.down)) y += 1;
		}
		if (side.device !== "keys") {
			const slot = this.slotFor(player);
			const pad = slot >= 0 ? this.pads[slot] : null;
			if (pad && pad.connected) {
				x += pad.x;
				y += pad.y;
				if (pad.buttons[side.pad.left]) x = -1;
				if (pad.buttons[side.pad.right]) x = 1;
				if (pad.buttons[side.pad.up]) y = -1;
				if (pad.buttons[side.pad.down]) y = 1;
			}
		}
		return { x, y };
	}
	pollPad() {
		const pads = this.readPads();
		this.pads = pads;
		const gp = pads[0];
		const prev = this._padPrev[0];
		const down = (i) => !!gp.buttons[i];
		const edge = (i) => down(i) && !prev[i];
		this.pad.connected = gp.connected;
		this.pad.name = gp.name;
		this.pad.x = gp.x;
		this.pad.y = gp.y;
		this.pad.fire = this.actionDown(1, "fire");
		this.pad.bomb = this.actionDown(1, "bomb");
		this.pad.special = this.actionDown(1, "special");
		this.pad.mode = this.actionDown(1, "mode");
		let nx = down(14) ? -1 : down(15) ? 1 : Math.abs(gp.axes?.[0] || 0) > .55 ? Math.sign(gp.axes[0]) : 0;
		let ny = down(12) ? -1 : down(13) ? 1 : Math.abs(gp.axes?.[1] || 0) > .55 ? Math.sign(gp.axes[1]) : 0;
		if (nx && ny && !down(12) && !down(13) && !down(14) && !down(15)) {
			if (Math.abs(gp.axes[1]) >= Math.abs(gp.axes[0])) nx = 0;
			else ny = 0;
		}
		const now = performance.now();
		const hold = this._navHold;
		if (nx !== hold.x || ny !== hold.y) {
			hold.x = nx;
			hold.y = ny;
			hold.next = now + 280;
			if (nx < 0) this.padLatch.left = true;
			if (nx > 0) this.padLatch.right = true;
			if (ny < 0) this.padLatch.up = true;
			if (ny > 0) this.padLatch.down = true;
		} else if ((nx || ny) && now >= hold.next) {
			hold.next = now + 140;
			if (nx < 0) this.padLatch.left = true;
			if (nx > 0) this.padLatch.right = true;
			if (ny < 0) this.padLatch.up = true;
			if (ny > 0) this.padLatch.down = true;
		}
		if (edge(0)) this.padLatch.confirm = true;
		if (edge(1)) this.padLatch.cancel = true;
		if (edge(8) && (this.screen === "play" || this.screen === "pause")) this.toggleMute();
		const pauseEdge = (this.screen === "play" || this.screen === "pause") && [0, 1].some((slot) => {
			const pad = pads[slot];
			if (!pad?.connected) return false;
			const player = this.slotFor(1) === slot ? 1 : this.slotFor(2) === slot ? 2 : 0;
			if (!player) return false;
			const side = player === 2 ? this.controls.p2 : this.controls.p1;
			if (side.device === "keys") return false;
			const btn = side.pad.pause;
			return !!pad.buttons[btn] && !this._padPrev[slot][btn];
		});
		if (edge(9)) {
			if (this.screen === "play" || this.screen === "pause") this.pause();
			else this.padLatch.start = true;
		} else if (pauseEdge) this.pause();
		const busy = down(0) || down(1) || down(2) || down(3) || down(9) || down(12) || down(13) || down(14) || down(15) || Math.abs(gp.x) + Math.abs(gp.y) > .2;
		for (let slot = 0; slot < 2; slot++) {
			for (let i = 0; i < 16; i++) this._padPrev[slot][i] = !!pads[slot].buttons[i];
		}
		if (busy && this.demo) this.abortDemo();
		if (busy && this.screen === "title") this.idleT = 0;
	}
	takePadMenu() {
		const ev = { ...this.padLatch };
		this.padLatch.up = false;
		this.padLatch.down = false;
		this.padLatch.left = false;
		this.padLatch.right = false;
		this.padLatch.confirm = false;
		this.padLatch.cancel = false;
		this.padLatch.start = false;
		return ev;
	}
	loop = (t) => {
		this.raf = requestAnimationFrame(this.loop);
		if (!this.last) this.last = t;
		let dt = (t - this.last) / 1e3;
		this.last = t;
		if (dt > .1) dt = .1;
		this.pollPad();
		this.acc += dt;
		const step = 1 / 60;
		while (this.acc >= step) {
			if (this.screen === "play") this.update(step);
			if (this.screen === "title" && !this.demo) {
				if (this.hackBuf.length === 0 && this.arcadeTaps === 0) {
					this.idleT += step;
					if (this.idleT > 8) this.startDemo();
				}
			}
			if (this.screen === "continue") {
				this.continueT -= step;
				if (this.continueT <= 0) this.finishRun("over");
			}
			this.acc -= step;
		}
		this.draw();
	};
	startLoop() {
		if (this.running) return;
		this.running = true;
		this.last = 0;
		this.raf = requestAnimationFrame(this.loop);
	}
	spawnE(partial) {
		let e = this.enemies.find((x) => !x.alive);
		if (!e) {
			e = {
				alive: false,
				x: 0,
				y: 0,
				vx: 0,
				vy: 0,
				r: 12,
				hp: 1,
				maxHp: 1,
				kind: "wasp",
				t: 0,
				score: 100,
				ground: false,
				phase: 0,
				flash: 0,
				tag: 0,
				tell: 0,
				atk: 0,
				mark: false
			};
			this.enemies.push(e);
		}
		Object.assign(e, {
			vx: 0,
			vy: 40,
			r: 12,
			hp: 3,
			maxHp: 3,
			t: 0,
			score: 100,
			ground: false,
			phase: 0,
			flash: 0,
			tag: 0,
			tell: 0,
			atk: 0,
			mark: false,
			wy: undefined
		}, partial, { alive: true });
		e.hp = Math.max(1, Math.ceil(e.hp * this.diffOf().hp));
		e.maxHp = e.hp;
		return e;
	}
	seedTerrain() {
		this.decor.forEach((d) => d.alive = false);
		this.grounds.forEach((g) => g.alive = false);
		this.map = generateStageMap(this.stage);
		const theme = STAGE_THEME[this.stage] ?? STAGE_THEME[0];
		const seed = this.stage * 97 + 13;
		for (let row = 0; row < MAP_ROWS; row++) {
			for (let col = 1; col < MAP_COLS - 1; col++) {
				if (isWaterCell(this.map, col, row)) continue;
				const id = this.map[row * MAP_COLS + col] ?? 0;
				if (isRoadTile(id) || isMetalTile(id)) continue;
				const h = tileHash(col, row, seed);
				const x = col * TILE + TILE / 2;
				const wy = row * TILE + TILE / 2;
				const onCarrier = this.stage === 0 && row <= 40 && col >= 3 && col <= 19;
				if (onCarrier) continue;
				if (theme.woods && h > .34) {
					const jitter = (tileHash(col, row, seed + 4) - .5) * 10;
					this.plantDecor("tree", x + jitter, wy, .82 + h * .55);
				}
				if (theme.woods && h > .86 && h < .93) this.plantGround("tree", x, wy);
				else if (h > .91 && h < .965) this.plantDecor("bush", x, wy, .7 + h * .4);
				else if (!theme.woods && h > .84 && h < .9) this.plantGround("rock", x, wy);
				else if (h > .978) {
					const pack = h > .99 ? theme.targets : theme.props;
					const kind = pack[tileHash(col, row, seed + 9) * pack.length | 0];
					if (kind === "dock" && theme.water !== "sea") continue;
					this.plantGround(kind, x, wy);
				}
			}
		}
		for (let i = 0; i < 7; i++) this.spawnDecor("cloud", 20 + Math.random() * 320, Math.random() * 640);
		this.plantSecrets();
	}
	plantDecor(kind, x, wy, s = 1) {
		const d = this.spawnDecor(kind, x, mapToScreenY(wy, this.bg));
		d.wy = wy;
		d.s = s;
		return d;
	}
	plantSecrets() {
		this.plantSecret("F", 28 + this.stage * 3);
		this.plantSecret("N", 12 + this.stage * 2);
		this.plantSecret("N", 58 + this.stage);
	}
	plantSecret(type, preferRow) {
		const seed = this.stage * 97 + 13 + (preferRow | 0);
		for (let k = 0; k < MAP_COLS * 3; k++) {
			const col = 2 + ((seed * 7 + k * 5) % (MAP_COLS - 4));
			const row = (((preferRow | 0) + (k >> 2)) % MAP_ROWS + MAP_ROWS) % MAP_ROWS;
			const id = this.map[row * MAP_COLS + col] ?? 0;
			if (!isDriveLandId(id) || isWaterCell(this.map, col, row)) continue;
			const x = col * TILE + TILE / 2;
			const wy = row * TILE + TILE / 2;
			this.forceDrop(x, mapToScreenY(wy, this.bg), type, {
				planted: true,
				wy,
				hide: type === "F"
			});
			return true;
		}
		return false;
	}
	plantGround(kind, x, wy) {
		const g = this.spawnGround(kind, x, mapToScreenY(wy, this.bg));
		g.wy = wy;
		return g;
	}
	placeX(y, wantWater) {
		if (wantWater) return sampleTerrainX(this.map, y, this.bg, true) ?? 28 + Math.random() * 304;
		return sampleLandX(this.map, y, this.bg) ?? sampleTerrainX(this.map, y, this.bg, false) ?? 28 + Math.random() * 304;
	}
	wet(x, y) {
		return isWaterAt(this.map, x, y, this.bg);
	}
	wetSpan(x, y, r = 12) {
		return this.wet(x, y) || this.wet(x - r, y) || this.wet(x + r, y) || this.wet(x, y + 10) || this.wet(x, y - 4);
	}
	onDriveLand(x, y, r = 16) {
		return landPadAt(this.map, x, y, this.bg, Math.max(20, r * .9), 28, 8);
	}
	onFeetLand(x, y, r = 16) {
		const w = Math.max(10, r * .55);
		if (!isDriveLandId(tileIdAt(this.map, x, y, this.bg))) return false;
		if (this.wet(x, y) || this.wet(x - w, y) || this.wet(x + w, y) || this.wet(x, y + 8) || this.wet(x, y - 10)) return false;
		return true;
	}
	spawnLandUnit(r = 16) {
		const halfW = Math.max(22, r);
		for (const y of [-8, 8, 24, 40, 56, 72, 88]) {
			const x = sampleLandX(this.map, y, this.bg, halfW, 28, 8);
			if (x != null && this.onDriveLand(x, y, r) && this.onFeetLand(x, y, r)) return { x, y };
		}
		return null;
	}
	spawnOnTerrain(wantWater, r) {
		if (!wantWater) return this.spawnLandUnit(r);
		for (const dy of [0, 12, 24, 36, 48, -12]) {
			const y = -28 + dy;
			const x = sampleTerrainX(this.map, y, this.bg, true);
			if (x == null) continue;
			if (this.wet(x, y) && this.wet(x, y + 8) && this.wet(x - 12, y) && this.wet(x + 12, y) && this.wet(x, y - 8)) return {
				x,
				y
			};
		}
		return null;
	}
	terrainVy() {
		return 40 + this.stage * 8;
	}
	spawnDecor(kind, x, y) {
		let d = this.decor.find((p) => !p.alive);
		if (!d) {
			d = {
				alive: true,
				x,
				y,
				kind,
				s: 1,
				flip: 1,
				phase: 0
			};
			this.decor.push(d);
		}
		Object.assign(d, {
			alive: true,
			x,
			y,
			wy: undefined,
			kind,
			s: .7 + Math.random() * .7,
			flip: Math.random() < .5 ? -1 : 1,
			phase: Math.random() * 6
		});
		return d;
	}
	spawnGround(kind, x, y) {
		const spec = targetSpec(kind);
		let g = this.grounds.find((p) => !p.alive);
		if (!g) {
			g = {
				alive: true,
				x,
				y,
				kind,
				hp: spec.hp,
				maxHp: spec.hp,
				r: spec.r,
				score: spec.score,
				flash: 0,
				t: 0,
				mark: false
			};
			this.grounds.push(g);
		}
		const hp = Math.max(1, Math.ceil(spec.hp * (this.bonus ? .55 : this.diffOf().hp)));
		Object.assign(g, {
			alive: true,
			x,
			y,
			wy: undefined,
			kind,
			hp,
			maxHp: hp,
			r: spec.r,
			score: spec.score,
			flash: 0,
			t: 0,
			mark: false
		});
		return g;
	}
	updateTerrain(dt) {
		const vy = this.terrainVy();
		const theme = STAGE_THEME[this.stage] ?? STAGE_THEME[0];
		for (const d of this.decor) {
			if (!d.alive) continue;
			if (d.kind === "cloud") {
				d.y += vy * .38 * dt;
				if (d.y > 690) {
					d.y = -50 - Math.random() * 80;
					d.x = 18 + Math.random() * 324;
				}
			} else if (d.wy != null) d.y = mapToScreenY(d.wy, this.bg);
		}
		for (const g of this.grounds) {
			if (!g.alive) continue;
			g.t += dt;
			g.flash = Math.max(0, g.flash - dt);
			if (g.wy != null) g.y = mapToScreenY(g.wy, this.bg);
			else {
				g.y += (this.bonus ? 52 : vy) * dt;
				if (g.y > 680) {
					if (g.mark) {
						this.missBonusTarget();
						g.alive = false;
					} else if (!this.bonus) {
						const pack = Math.random() < .45 ? theme.props : theme.targets;
						const kind = pack[Math.random() * pack.length | 0];
						const spec = targetSpec(kind);
						const hp = Math.max(1, Math.ceil(spec.hp * this.diffOf().hp));
						const y = -28 - Math.random() * 40;
						const x = this.placeX(y, kind === "dock");
						Object.assign(g, {
							y,
							x,
							wy: screenToMapY(y, this.bg),
							kind,
							hp,
							maxHp: hp,
							r: spec.r,
							score: spec.score,
							flash: 0,
							t: 0,
							mark: false,
							alive: true
						});
					} else g.alive = false;
				}
			}
			if (!this.bonus && g.y > -10 && g.y < 640 && (g.kind === "bunker" || g.kind === "tower" || g.kind === "radar") && Math.floor(g.t) !== Math.floor(g.t - dt)) this.aimFrom(g.x, g.y, 80, "#ffb347");
		}
	}
	hurtGround(g, dmg, cpu) {
		g.hp -= dmg;
		g.flash = .12;
		this.spark(g.x, g.y, 4, "#fff4c2");
		this.sfx.hit();
		if (g.hp > 0) return;
		g.alive = false;
		const pts = g.score;
		if (cpu) this.cpuScore += pts;
		else this.score += pts;
		this.boomFx(g.x, g.y, "#f0c14a", isBuilding(g.kind) ? 1.3 : 0.9);
		this.sfx.boom();
		this.shake = Math.max(this.shake, 5);
		if (g.mark) this.creditBonusTarget(g.x, g.y);
		else if (!cpu) this.dropGroundLoot(g.x, g.y, g.kind);
		if (isBlastTarget(g.kind)) this.envBlast(g.x, g.y, g.kind === "fuel" ? 64 : 40, g.kind === "fuel" ? 14 : 8);
	}
	envBlast(x, y, radius, dmg) {
		this.boomFx(x, y, "#ff7a2a", radius > 50 ? 1.6 : 1.1);
		this.shake = Math.max(this.shake, 7);
		for (const g of this.grounds) {
			if (!g.alive) continue;
			if (Math.hypot(g.x - x, g.y - y) < radius + g.r) this.hurtGround(g, dmg, false);
		}
		for (const e of this.enemies) {
			if (!e.alive) continue;
			if (Math.hypot(e.x - x, e.y - y) < radius + e.r) this.hurt(e, e.ground ? dmg * 1.4 : dmg * .6, true);
		}
	}
	dropGroundLoot(x, y, kind) {
		if (isSoftTarget(kind)) {
			const roll = Math.random();
			if (kind === "barrel") {
				if (roll < .28) this.forceDrop(x, y, "B");
				else if (roll < .42) this.forceDrop(x, y, "G");
				else if (roll < .5) this.forceDrop(x, y, "R");
			} else if (roll < .08) this.forceDrop(x, y, "N");
			else if (roll < .12) this.forceDrop(x, y, "G");
			return;
		}
		this.forceDrop(x, y, "G");
		const roll = Math.random();
		if (kind === "fuel") {
			if (roll < .28) this.forceDrop(x + 8, y, "R");
			else if (roll < .48) this.forceDrop(x + 8, y, "B");
			else if (roll < .58) this.forceDrop(x + 8, y, "H");
			return;
		}
		if (kind === "hut") {
			if (roll < .1) this.forceDrop(x + 6, y, "N");
			else if (roll < .14) this.forceDrop(x + 6, y, "F");
			else if (roll < .32) this.forceDrop(x + 6, y, "B");
			else if (roll < .44) this.forceDrop(x + 6, y, "H");
			else if (roll < .54) this.forceDrop(x + 6, y, "1");
			return;
		}
		if (kind === "crate") {
			if (roll < .35) this.forceDrop(x + 8, y, "B");
			else if (roll < .48) this.forceDrop(x + 8, y, "1");
			else if (roll < .62) this.forceDrop(x + 8, y, "H");
			else if (roll < .8) this.forceDrop(x + 8, y, "M");
		} else if (kind === "tower" || kind === "hangar") {
			if (roll < .22) this.forceDrop(x + 6, y, "1");
			else if (roll < .4) this.forceDrop(x + 6, y, "H");
			else if (roll < .55) this.forceDrop(x + 6, y, "B");
			else if (roll < .74) this.forceDrop(x + 6, y, "M");
		} else if (roll < .16) this.forceDrop(x + 6, y, "H");
		else if (roll < .28) this.forceDrop(x + 6, y, "B");
		else if (roll < .34) this.forceDrop(x + 6, y, "1");
		else if (roll < .42) this.forceDrop(x + 6, y, "R");
		else if (roll < .58) this.forceDrop(x + 6, y, "M");
	}
	bullet(list, b) {
		const packed = {
			...b,
			ox: b.x,
			oy: b.y,
			pierce: b.pierce ?? false,
			vsGround: b.vsGround ?? false,
			cpu: b.cpu ?? false,
			ay: b.ay ?? 0,
			spin: b.spin ?? 0,
			wait: b.wait ?? 0,
			split: b.split ?? 0,
			hit: [],
			alive: true
		};
		if (!packed.friendly) {
			const mul = this.diffOf().spd;
			packed.vx *= mul;
			packed.vy *= mul;
			packed.ay *= mul;
			packed.spin *= mul;
		}
		let x = list.find((i) => !i.alive);
		if (!x) {
			list.push(packed);
			return packed;
		}
		Object.assign(x, packed);
		return x;
	}
	spark(x, y, n, color) {
		this.fx.spark(x, y, n, color);
	}
	boomFx(x, y, color, power) {
		this.fx.boom(x, y, color, power);
		const mag = 0.85 + power * 0.75;
		if (this.wet(x, y)) this.fluid.impulse(x, y, mag);
		else {
			const near = [[0, 18], [0, -18], [18, 0], [-18, 0]];
			for (const [dx, dy] of near) {
				if (this.wet(x + dx, y + dy)) {
					this.fluid.impulse(x + dx, y + dy, mag * 0.7);
					break;
				}
			}
		}
	}
	stirFluid() {
		if (this.wet(this.px, this.py + 16)) this.fluid.wake(this.px, this.py + 14);
		if (this.vs || this.hasWing()) {
			if (this.wet(this.cx, this.cy + 16)) this.fluid.wake(this.cx, this.cy + 14);
		}
		for (const e of this.enemies) {
			if (!e.alive) continue;
			if (e.kind === "sub" || e.kind === "keel" || e.kind === "gunboat" || e.kind === "destroyer" || e.kind === "krakenkeel") this.fluid.wake(e.x, e.y);
		}
		const drip = (b) => {
			if (!b.alive) return;
			if (((b.y | 0) & 15) > 3) return;
			if (this.wet(b.x, b.y)) this.fluid.impulse(b.x, b.y, 0.05);
		};
		for (const b of this.pBullets) drip(b);
		for (const b of this.eBullets) drip(b);
	}
	dropItem(x, y) {
		this.forceDrop(x + (Math.random() * 16 - 8), y, "G");
		const roll = Math.random();
		let type = null;
		if (roll < .12) type = "R";
		else if (roll < .16) type = "Q";
		else if (roll < .22) type = this.mode === "lance" ? "S" : "L";
		else if (roll < .28) type = "B";
		else if (roll < .32) type = "W";
		else if (roll < .48) type = "M";
		else if (roll < .52) type = "P";
		else if (roll < .56) type = "N";
		if (!type) return;
		this.forceDrop(x, y, type);
	}
	forceDrop(x, y, type, extra = {}) {
		let it = this.items.find((i) => !i.alive);
		const planted = !!extra.planted;
		const next = {
			alive: true,
			x,
			y,
			vy: planted ? 0 : type === "T" ? 44 : 50,
			type,
			planted,
			wy: extra.wy,
			hide: !!extra.hide,
			seen: false,
			tint: extra.tint ?? (type === "R" ? "red" : type === "Q" ? "blue" : "")
		};
		if (!it) this.items.push(next);
		else Object.assign(it, next);
	}
	update(dt) {
		if (this.demo) {
			this.demoT -= dt;
			if (this.demoT <= 0) {
				this.abortDemo();
				return;
			}
			this.steerAuto(dt, true);
		} else if (this.hack) this.steerAuto(dt, true);
		else {
			const duo = this.crew === "duo" && !this.vs;
			let mx = 0, my = 0;
			const m1 = this.moveVec(1);
			mx = m1.x;
			my = m1.y;
			if (this.touch.moving) {
				mx += this.touch.mx;
				my += this.touch.my;
			}
			const mag = Math.hypot(mx, my) || 1;
			if (mag > 1) {
				mx /= mag;
				my /= mag;
			}
			this.px += mx * this.speed * dt;
			this.py += my * this.speed * dt;
			this.px = Math.max(12, Math.min(348, this.px));
			this.py = Math.max(24, Math.min(616, this.py));
			this.qaSpeed = Math.hypot(mx, my) * this.speed;
			if (mx < -.01) this.qaYaw += dt * 3;
			if (mx > .01) this.qaYaw -= dt * 3;
			if (duo) {
				let ox = 0, oy = 0;
				const m2 = this.moveVec(2);
				ox = m2.x;
				oy = m2.y;
				const om = Math.hypot(ox, oy) || 1;
				if (om > 1) {
					ox /= om;
					oy /= om;
				}
				const spd = this.p2Ship === "azure" ? 228 : this.p2Ship === "crimson" ? 188 : 150;
				this.cx += ox * spd * dt;
				this.cy += oy * spd * dt;
				this.cx = Math.max(12, Math.min(348, this.cx));
				this.cy = Math.max(24, Math.min(616, this.cy));
			}
		}
		if (this.launchT > 0) this.tickLaunch(dt);
		this.fireCd -= dt;
		this.bombCd -= dt;
		this.specialCd -= dt;
		this.cpuFireCd -= dt;
		this.invuln = Math.max(0, this.invuln - dt);
		this.p2invuln = Math.max(0, this.p2invuln - dt);
		this.overdrive += dt;
		this.chainT -= dt;
		if (this.chainT <= 0) this.chain = 1;
		this.shake = Math.max(0, this.shake - dt * 8);
		this.phaseBanner = Math.max(0, this.phaseBanner - dt);
		if (this.launchT > 0) {
			const phase = this.launchPhase();
			if (phase === "shot" || phase === "lift") this.bg += dt * (phase === "lift" ? 90 : 8);
			else this.bg += dt * 2;
		} else this.bg += dt * (40 + this.stage * 8);
		this.stageT += dt;
		if (this.bonus) {
			this.bonusSting = Math.max(0, this.bonusSting - dt);
			if (this.bonusBanner > 0) {
				this.bonusBanner -= dt;
				this.invuln = Math.max(this.invuln, 1.2);
				if (this.bonusBanner <= 0) this.leaveBonus();
			}
		}
		const canShoot = this.launchT <= 0 || this.launchPhase() === "shot" || this.launchPhase() === "lift";
		if (canShoot && (this.demo || this.hack || this.actionDown(1, "fire") || this.touch.fire) && this.fireCd <= 0) this.fire();
		if (!this.demo && !this.hack && (this.actionDown(1, "special") || this.touch.special) && this.specialCd <= 0) this.fireSpecial();
		if (!this.demo && !this.hack && (this.actionDown(1, "bomb") || this.touch.bomb) && this.bombCd <= 0) this.doBomb();
		const modeNow = this.actionDown(1, "mode") || this.touch.mode || (this.crew === "duo" && !this.vs && this.actionDown(2, "mode"));
		if (!this.demo && !this.hack && modeNow && !this.modeHeld) this.toggleMode();
		this.modeHeld = modeNow;
		if (this.crew === "duo" && !this.vs && !this.hack && !this.demo) {
			if (this.actionDown(2, "fire") && this.cpuFireCd <= 0) this.fireFrom(this.cx, this.cy, this.p2Ship, false);
			if (this.actionDown(2, "bomb") && this.bombCd <= 0) this.doBomb();
			if (this.actionDown(2, "special") && this.specialCd <= 0) this.fireSpecial();
		}
		if (this.vs || this.crew === "wingman") this.updateCpu(dt);
		if (this.hack && this.bombCd <= 0) {
			let near = 0;
			for (const b of this.eBullets) if (b.alive && Math.hypot(b.x - this.px, b.y - this.py) < 42) near += 1;
			if (near >= 6) this.doBomb();
		}
		this.updateDrones(dt);
		this.updateTerrain(dt);
		this.spawnWaves();
		this.updateEnemies(dt);
		this.updateBullets(dt);
		this.updateItems(dt);
		this.updateSparks(dt);
		this.collisions();
		this.stirFluid();
		this.fluid.step(dt, this.bg - this.fluidBg, (x, y) => this.wet(x, y));
		this.fluidBg = this.bg;
		if (this.midSpawnT > 0 && this.stageClearT <= 0 && !this.bossAlive) {
			this.midSpawnT -= dt;
			if (this.midSpawnT <= 0) this.spawnBoss();
		}
		if (this.stageClearT > 0) {
			this.stageClearT -= dt;
			if (this.stageClearT <= 0) {
				if (this.demo) this.abortDemo();
				else this.openClear();
			}
		}
	}
	fire() {
		this.fireFrom(this.px, this.py, this.ship, false);
		for (const d of this.drones) if (this.mode === "lance") this.bullet(this.pBullets, {
			x: d.x,
			y: d.y,
			vx: 0,
			vy: -640,
			r: 2.2,
			dmg: 1.6,
			homing: false,
			friendly: true,
			color: "#5cff9a"
		});
		else {
			const tgt = this.nearestEnemy(d.x, d.y);
			let vx = 0, vy = -380;
			if (tgt) {
				const a = Math.atan2(tgt.y - d.y, tgt.x - d.x);
				vx = Math.cos(a) * 380;
				vy = Math.sin(a) * 380;
			}
			this.bullet(this.pBullets, {
				x: d.x,
				y: d.y,
				vx,
				vy,
				r: 2,
				dmg: .9,
				homing: true,
				friendly: true,
				color: "#ffd36a"
			});
		}
		if (this.overdrive >= 6) {
			this.overdrive = 0;
			this.sfx.overdrive();
			this.shake = 6;
			if (this.mode === "lance") for (let i = -3; i <= 3; i++) this.bullet(this.pBullets, {
				x: this.px + i * 10,
				y: this.py,
				vx: i * 12,
				vy: -700,
				r: 3.5,
				dmg: 4,
				homing: false,
				friendly: true,
				color: "#b8fff0"
			});
			else for (let i = 0; i < 10; i++) {
				const a = -Math.PI / 2 + (i - 4.5) * .18;
				this.bullet(this.pBullets, {
					x: this.px,
					y: this.py,
					vx: Math.cos(a) * 420,
					vy: Math.sin(a) * 420,
					r: 2.4,
					dmg: 2,
					homing: true,
					friendly: true,
					color: "#ffb347"
				});
			}
		}
	}
	fireFrom(x, y, ship, cpu, slot = cpu ? "p2" : "p1") {
		const delay = ship === "azure" ? .08 : ship === "crimson" ? .1 : .13;
		if (slot === "p2") this.cpuFireCd = delay;
		else this.fireCd = delay;
		if (slot === "p1") this.sfx.shot();
		const dmgMul = ship === "azure" ? .9 : ship === "crimson" ? 1.15 : 1.5;
		const rank = cpu || slot === "p2" ? 2 : this.power;
		const dmg = (1 + rank * .35) * dmgMul;
		const shots = 1 + Math.min(2, Math.floor(rank / 2));
		const col = cpu ? "#ffd36a" : ship === "azure" ? "#7fe8ff" : ship === "crimson" ? "#ff8a6a" : "#c4d46a";
		for (let i = 0; i < shots; i++) {
			const ox = (i - (shots - 1) / 2) * 8;
			this.bullet(this.pBullets, {
				x: x + ox,
				y: y - 18,
				vx: ox * 4,
				vy: -520,
				r: 2.4,
				dmg,
				homing: false,
				friendly: true,
				color: col,
				cpu
			});
		}
		if (ship === "crimson") {
			this.bullet(this.pBullets, {
				x: x - 12,
				y: y - 8,
				vx: -140,
				vy: -500,
				r: 2.2,
				dmg: dmg * .85,
				homing: false,
				friendly: true,
				color: col,
				cpu
			});
			this.bullet(this.pBullets, {
				x: x + 12,
				y: y - 8,
				vx: 140,
				vy: -500,
				r: 2.2,
				dmg: dmg * .85,
				homing: false,
				friendly: true,
				color: col,
				cpu
			});
		}
		if (ship === "iron") {
			const s = 400;
			this.bullet(this.pBullets, {
				x: x - 6,
				y: y - 8,
				vx: -280,
				vy: -280,
				r: 2.8,
				dmg: dmg * 1.35,
				homing: false,
				friendly: true,
				color: "#c4d46a",
				vsGround: true,
				cpu
			});
			this.bullet(this.pBullets, {
				x: x + 6,
				y: y - 8,
				vx: s * .7,
				vy: -280,
				r: 2.8,
				dmg: dmg * 1.35,
				homing: false,
				friendly: true,
				color: "#c4d46a",
				vsGround: true,
				cpu
			});
		}
	}
	steerAuto(dt, isPlayer) {
		let x = isPlayer ? this.px : this.cx;
		let y = isPlayer ? this.py : this.cy;
		const speed = isPlayer ? this.speed : 176;
		let dx = 0;
		let dy = 0;
		let threat = 1e9;
		for (const b of this.eBullets) {
			if (!b.alive) continue;
			const d = Math.hypot(b.x - x, b.y - y);
			if (d < 88 && d < threat) {
				threat = d;
				dx = x - b.x;
				dy = y - b.y;
			}
		}
		if (threat < 88) {
			const mag = Math.hypot(dx, dy) || 1;
			x += dx / mag * speed * dt;
			y += dy / mag * speed * .55 * dt;
		} else {
			const tgt = this.nearestEnemy(x, y);
			const weave = Math.sin(this.stageT * 1.35 + (isPlayer ? 0 : 1.8)) * 86;
			const tx = tgt ? tgt.x + weave * .25 : 180 + weave;
			const ty = 544 + Math.sin(this.stageT * .9 + (isPlayer ? 0 : 2)) * 18;
			const ax = tx - x;
			const ay = ty - y;
			const mag = Math.hypot(ax, ay) || 1;
			x += ax / mag * speed * .72 * dt;
			y += ay / mag * speed * .42 * dt;
		}
		x = Math.max(16, Math.min(344, x));
		y = Math.max(40, Math.min(612, y));
		if (isPlayer) {
			const mx = x - this.px;
			this.px = x;
			this.py = y;
			this.qaSpeed = Math.abs(mx) / Math.max(dt, .001);
			if (mx < -.2) this.qaYaw += dt * 3;
			if (mx > .2) this.qaYaw -= dt * 3;
		} else {
			this.cx = x;
			this.cy = y;
		}
	}
	updateCpu(dt) {
		this.steerAuto(dt, false);
		if (this.cpuFireCd <= 0) this.fireFrom(this.cx, this.cy, this.cpuShip, this.vs, "p2");
	}
	fireSpecial() {
		const ids = SHOP.filter((s) => s.cat === "special" && this.loadout[s.id] > 0 && this.ammo[s.id] > 0).map((s) => s.id);
		if (!ids.length) return;
		this.specialCd = this.ship === "crimson" ? .16 : .26;
		this.sfx.shot();
		for (const id of ids) {
			this.ammo[id] -= 1;
			this.castSpecial(id);
		}
		this.onChange();
	}
	castSpecial(id) {
		const tgt = this.nearestEnemy(this.px, this.py);
		const homingAt = (spd, dmg, r, color) => {
			let vx = 0, vy = -spd;
			if (tgt) {
				const a = Math.atan2(tgt.y - this.py, tgt.x - this.px);
				vx = Math.cos(a) * spd;
				vy = Math.sin(a) * spd;
			}
			this.bullet(this.pBullets, {
				x: this.px,
				y: this.py - 12,
				vx,
				vy,
				r,
				dmg,
				homing: true,
				friendly: true,
				color
			});
		};
		if (id === "wisp") homingAt(380, 1.6, 2.2, "#7fe8ff");
		if (id === "raven") homingAt(300, 3.2, 4.2, "#ff8a6a");
		if (id === "fork") for (const ang of [
			-.42,
			0,
			.42
		]) this.bullet(this.pBullets, {
			x: this.px,
			y: this.py - 16,
			vx: Math.sin(ang) * 640,
			vy: -Math.cos(ang) * 640,
			r: 2.4,
			dmg: 2.8,
			homing: false,
			friendly: true,
			color: "#b8fff0",
			pierce: true
		});
		if (id === "sunfire") for (let i = -1; i <= 1; i++) this.bullet(this.pBullets, {
			x: this.px + i * 10,
			y: this.py - 8,
			vx: i * 40,
			vy: -280,
			r: 3.4,
			dmg: 3.5,
			homing: false,
			friendly: true,
			color: "#ff7a2a",
			vsGround: true
		});
		if (id === "trident") for (const vx of [
			-90,
			0,
			90
		]) this.bullet(this.pBullets, {
			x: this.px,
			y: this.py - 12,
			vx,
			vy: -480,
			r: 2.4,
			dmg: 1.8,
			homing: false,
			friendly: true,
			color: "#e8c84a"
		});
		if (id === "spike") this.bullet(this.pBullets, {
			x: this.px,
			y: this.py - 16,
			vx: 0,
			vy: -700,
			r: 3.8,
			dmg: 5.5,
			homing: false,
			friendly: true,
			color: "#d8fff8",
			pierce: true
		});
		if (id === "starburst") for (let i = 0; i < 16; i++) {
			const a = i / 16 * Math.PI * 2 - Math.PI / 2;
			this.bullet(this.pBullets, {
				x: this.px,
				y: this.py,
				vx: Math.cos(a) * 360,
				vy: Math.sin(a) * 360,
				r: 2,
				dmg: 1.4,
				homing: false,
				friendly: true,
				color: "#ffd36a"
			});
		}
		if (id === "sidegun") {
			this.bullet(this.pBullets, {
				x: this.px - 16,
				y: this.py,
				vx: -30,
				vy: -520,
				r: 2.2,
				dmg: 1.6,
				homing: false,
				friendly: true,
				color: "#ff8a6a",
				vsGround: true
			});
			this.bullet(this.pBullets, {
				x: this.px + 16,
				y: this.py,
				vx: 30,
				vy: -520,
				r: 2.2,
				dmg: 1.6,
				homing: false,
				friendly: true,
				color: "#ff8a6a",
				vsGround: true
			});
		}
		if (id === "ring") for (let i = 0; i < 12; i++) {
			const a = i / 12 * Math.PI * 2;
			this.bullet(this.pBullets, {
				x: this.px + Math.cos(a) * 10,
				y: this.py + Math.sin(a) * 10,
				vx: Math.cos(a) * 280,
				vy: Math.sin(a) * 280,
				r: 2.6,
				dmg: 2.2,
				homing: false,
				friendly: true,
				color: "#9af0ff",
				pierce: true
			});
		}
		if (id === "heavy") {
			this.shake = 12;
			this.invuln = Math.max(this.invuln, .5);
			for (const b of this.eBullets) if (b.alive) b.alive = false;
			for (const e of this.enemies) {
				if (!e.alive) continue;
				this.hurt(e, e.ground ? 28 : 14, true);
			}
			for (const g of this.grounds) {
				if (!g.alive) continue;
				this.hurtGround(g, 22, false);
			}
			this.boomFx(this.px, this.py, "#c4d46a", 1.8);
		}
	}
	doBomb() {
		if (this.bombs <= 0) return;
		this.bombs -= 1;
		this.bombCd = .45;
		this.sfx.bomb();
		this.shake = 14;
		this.invuln = Math.max(this.invuln, .8);
		for (const b of this.eBullets) if (b.alive) b.alive = false;
		for (const e of this.enemies) {
			if (!e.alive) continue;
			this.hurt(e, 18, true);
		}
		for (const g of this.grounds) {
			if (!g.alive) continue;
			this.hurtGround(g, 18, false);
		}
		this.boomFx(this.px, this.py, "#fff4c2", 2);
		this.onChange();
	}
	toggleMode() {
		this.mode = this.mode === "lance" ? "seek" : "lance";
		this.sfx.pickup();
		this.onChange();
	}
	nearestEnemy(x, y) {
		let best = null;
		let bd = 1e9;
		for (const e of this.enemies) {
			if (!e.alive) continue;
			const d = (e.x - x) ** 2 + (e.y - y) ** 2;
			if (d < bd) {
				bd = d;
				best = e;
			}
		}
		return best;
	}
	updateDrones(dt) {
		while (this.drones.length < this.dronesN) this.drones.push({
			x: this.px,
			y: this.py,
			ang: Math.random() * 6
		});
		this.drones.length = this.dronesN;
		for (let i = 0; i < this.drones.length; i++) {
			const d = this.drones[i];
			d.ang += dt * (this.mode === "seek" ? 2.4 : 1.4);
			const rad = 28 + i * 6;
			const a = d.ang + i * Math.PI * 2 / Math.max(1, this.drones.length);
			const tx = this.px + Math.cos(a) * rad;
			const ty = this.py + Math.sin(a) * rad * .7;
			d.x += (tx - d.x) * Math.min(1, dt * 12);
			d.y += (ty - d.y) * Math.min(1, dt * 12);
		}
	}
	spawnWaves() {
		if (this.bonus) {
			this.spawnBonusWaves();
			return;
		}
		if (this.launchT > 0) return;
		const st = this.stage;
		const t = this.stageT;
		const tick = Math.floor(t * 2 * this.diffOf().dens);
		if (tick === this.spawnI) return;
		this.spawnI = tick;
		const lane = () => 30 + Math.random() * 300;
		if (t < 41 && !this.bossAlive && !this.bossWarn) {
			const ground = st === 0 || st === 2 || st === 3 || st === 4 || st === 5 || st === 8;
			const air = st === 1 || st === 4 || st === 6 || st === 9;
			const sea = st === 0 || st === 1 || st === 7;
			const cave = st === 5;
			if (tick % 4 === 0) this.spawnE({
				kind: "wasp",
				x: lane(),
				y: -20,
				vy: 90 + st * 8,
				hp: 2,
				r: 11,
				score: 120
			});
			if (tick % 7 === 0) this.spawnE({
				kind: "hornet",
				x: lane(),
				y: -24,
				vy: 70,
				vx: Math.random() < .5 ? 40 : -40,
				hp: 5,
				r: 14,
				score: 220
			});
			if (ground && tick % 10 === 0) {
				const spot = this.spawnOnTerrain(false, 16);
				if (spot) this.spawnE({
					kind: "tank",
					x: spot.x,
					y: spot.y,
					vx: Math.random() < .5 ? 30 : -30,
					vy: this.terrainVy(),
					hp: 12,
					r: 16,
					score: 420,
					ground: true,
					phase: 0,
					tag: 0.2 + Math.random() * 0.6,
					tell: 1,
					atk: 0
				});
			}
			if (ground && tick % 16 === 0) {
				const spot = this.spawnOnTerrain(false, 18);
				if (spot) this.spawnE({
					kind: "gunbarge",
					x: spot.x,
					y: spot.y,
					vx: Math.random() < .5 ? 16 : -16,
					vy: this.terrainVy(),
					hp: 14,
					r: 18,
					score: 400,
					ground: true
				});
			}
			if (ground && tick % 13 === 0) {
				const spot = this.spawnOnTerrain(false, 16);
				if (spot) this.spawnE({
					kind: "strider",
					x: spot.x,
					y: spot.y,
					vx: Math.random() < .5 ? 18 : -18,
					vy: this.terrainVy(),
					hp: 10,
					r: 16,
					score: 350,
					ground: true
				});
			}
			if ((air || st >= 1) && tick % 8 === 0) this.spawnE({
				kind: "heli",
				x: lane(),
				y: -24,
				vy: 62,
				vx: Math.random() < .5 ? 36 : -36,
				hp: 8,
				r: 16,
				score: 280
			});
			if ((air || st >= 2) && tick % 9 === 0) this.spawnE({
				kind: "eyepod",
				x: lane(),
				y: -20,
				vy: 50,
				hp: 8,
				r: 14,
				score: 300
			});
			if (air && tick % 8 === 0) this.spawnE({
				kind: "lancejet",
				x: lane(),
				y: -20,
				vy: 120,
				hp: 4,
				r: 12,
				score: 200
			});
			if (sea && tick % 12 === 0) {
				const spot = this.spawnOnTerrain(true, 20);
				if (spot) this.spawnE({
					kind: "destroyer",
					x: spot.x,
					y: spot.y,
					vx: Math.random() < .5 ? 42 : -42,
					vy: this.terrainVy(),
					hp: 18,
					r: 20,
					score: 560,
					ground: true
				});
			}
			if (sea && tick % 18 === 0) {
				const spot = this.spawnOnTerrain(true, 16);
				if (spot) this.spawnE({
					kind: "sub",
					x: spot.x,
					y: spot.y,
					vx: Math.random() < .5 ? 28 : -28,
					vy: this.terrainVy(),
					hp: 14,
					r: 16,
					score: 640,
					ground: true
				});
			}
			if ((sea || cave) && tick % 8 === 0) this.spawnE({
				kind: "mine",
				x: lane(),
				y: -16,
				vy: 55,
				hp: 2,
				r: 8,
				score: 80
			});
			if (tick % 17 === 0) this.spawnE({
				kind: "gilded",
				x: lane(),
				y: -28,
				vy: 45,
				hp: 12,
				r: 18,
				score: 480
			});
			if (st >= 3 && tick % 19 === 0) this.spawnE({
				kind: "redtide",
				x: lane(),
				y: -36,
				vy: 30,
				hp: 22,
				r: 22,
				score: 700
			});
			if (tick % 11 === 0) {
				const theme = STAGE_THEME[st] ?? STAGE_THEME[0];
				const kind = theme.targets[tick % theme.targets.length];
				this.spawnGround(kind, this.placeX(-28, kind === "dock"), -28);
			}
			if (tick % 6 === 0) {
				const theme = STAGE_THEME[st] ?? STAGE_THEME[0];
				const kind = theme.props[tick % theme.props.length];
				this.spawnGround(kind, this.placeX(-22, false), -22);
			}
			if (tick % 14 === 0) {
				const x = this.placeX(-24, false);
				this.spawnGround("barrel", x, -24);
				this.spawnGround("barrel", x + 16, -18);
			}
		}
		if (t >= 41 && !this.bossAlive && this.stageClearT === 0 && !this.bossWarn) {
			this.bossWarn = true;
			for (const e of this.enemies) {
				if (!e.alive) continue;
				e.alive = false;
				this.spark(e.x, e.y, 8, "#ffe08a");
			}
			for (const b of this.eBullets) b.alive = false;
			this.sfx.warn();
			this.onChange();
		}
		if (t >= 44 && !this.bossAlive && this.stageClearT === 0 && this.midSpawnT <= 0) this.spawnBoss();
	}
	spawnBonusWaves() {
		if (this.bonusBanner > 0) return;
		const t = this.stageT;
		const tick = Math.floor(t * 2);
		if (tick === this.spawnI) return;
		this.spawnI = tick;
		const L = (n) => 40 + n * 280;
		if (tick === 2) {
			this.spawnBonusMark("gilded", L(.22), -24, {
				vy: 52,
				hp: 6,
				r: 16,
				score: 500
			});
			this.spawnBonusMark("gilded", L(.78), -24, {
				vy: 52,
				hp: 6,
				r: 16,
				score: 500
			});
		}
		if (tick === 6) this.spawnBonusGround("bunker", L(.5), -30);
		if (tick === 8) {
			this.spawnBonusMark("wasp", L(.2), -18, {
				vy: 70,
				hp: 2,
				r: 11
			});
			this.spawnBonusMark("wasp", L(.5), -28, {
				vy: 70,
				hp: 2,
				r: 11
			});
			this.spawnBonusMark("wasp", L(.8), -18, {
				vy: 70,
				hp: 2,
				r: 11
			});
		}
		if (tick === 12) {
			this.spawnBonusGround("radar", L(.28), -26);
			this.spawnBonusGround("crate", L(.72), -22);
		}
		if (tick === 14) this.spawnStar(L(.5), -16, 40);
		if (tick === 18) this.spawnBonusMark("eyepod", L(.5), -22, {
			vy: 48,
			hp: 7,
			r: 15
		});
		if (tick === 20) this.spawnBonusGround("hangar", L(.5), -32);
		if (tick === 24) {
			const a = this.spawnLandUnit(18) ?? { x: L(.25), y: -28 };
			const b = this.spawnLandUnit(18) ?? { x: L(.75), y: -28 };
			this.spawnBonusMark("gunbarge", a.x, a.y, {
				vy: this.terrainVy(),
				vx: 18,
				hp: 8,
				r: 18,
				score: 500,
				ground: true
			});
			this.spawnBonusMark("gunbarge", b.x, b.y, {
				vy: this.terrainVy(),
				vx: -18,
				hp: 8,
				r: 18,
				score: 500,
				ground: true
			});
		}
		if (tick === 26) this.spawnStar(L(.35), -14, 38);
		if (tick === 28) this.spawnBonusGround("tower", L(.5), -28);
		if (tick === 32) this.spawnBonusMark("gilded", L(.5), -26, {
			vy: 50,
			hp: 7,
			r: 16
		});
		if (tick === 34) this.spawnStar(180, -12, 36);
		if (t > 20) {
			let marked = 0;
			for (const e of this.enemies) if (e.alive && e.mark) marked += 1;
			for (const g of this.grounds) if (g.alive && g.mark) marked += 1;
			let stars = 0;
			for (const it of this.items) if (it.alive && it.type === "T") stars += 1;
			if (marked === 0 && stars === 0) this.finishBonus();
		}
		if (t > 24) {
			for (const e of this.enemies) if (e.alive && e.mark) {
				this.missBonusTarget();
				e.alive = false;
			}
			for (const g of this.grounds) if (g.alive && g.mark) {
				this.missBonusTarget();
				g.alive = false;
			}
			this.finishBonus();
		}
	}
	spawnBoss() {
		const meta = this.stage === 7 && !this.midCleared ? SUB_BOSS : BOSS_META[this.stage] ?? BOSS_META[9];
		this.bossAlive = true;
		this.bossWarn = true;
		const patrol = meta.kind === "dunehauler" || meta.kind === "siegecrawler" || meta.kind === "battlekeel" || meta.kind === "krakenkeel";
		this.spawnE({
			kind: meta.kind,
			x: 180,
			y: -50,
			vy: 0,
			vx: patrol ? 50 : 0,
			hp: meta.hp,
			r: meta.r,
			score: meta.score,
			ground: meta.kind === "siegecrawler" || meta.kind === "rootcitadel" || meta.kind === "dunehauler" || meta.kind === "silohydra"
		});
		this.sfx.boss();
		this.sfx.startBossMusic(this.stage);
		this.shake = 8;
		this.setAtk("");
		this.onChange();
	}
	pulse(e, dt, hz) {
		const h = hz * this.diffOf().fire;
		return Math.floor(e.t * h) !== Math.floor((e.t - dt) * h);
	}
	minionCount() {
		let n = 0;
		for (const e of this.enemies) if (e.alive && !isBossKind(e.kind)) n += 1;
		return n;
	}
	updateEnemies(dt) {
		for (const e of this.enemies) {
			if (!e.alive) continue;
			e.t += dt;
			e.flash = Math.max(0, e.flash - dt);
			if (isBossKind(e.kind)) {
				this.updateBoss(e, dt);
				const maxY = e.kind === "skypike" ? 380 : 228;
				e.x = Math.max(36, Math.min(324, e.x));
				e.y = Math.max(40, Math.min(maxY, e.y));
				continue;
			}
			if (e.kind === "wasp") {
				e.x += Math.sin(e.t * 3) * 40 * dt;
				e.y += e.vy * dt;
				if (e.t > .6 && Math.floor(e.t * 2) !== Math.floor((e.t - dt) * 2)) this.aimShot(e, 90, 1);
			} else if (e.kind === "hornet") {
				e.x += e.vx * dt;
				e.y += e.vy * dt;
				if (e.x < 20 || e.x > 340) e.vx *= -1;
				if (Math.floor(e.t * 1.5) !== Math.floor((e.t - dt) * 1.5)) this.spread(e, 3, 110, .35);
			} else if (e.kind === "tank") {
				this.rollTank(e, dt);
				if (!e.alive) continue;
			} else if (e.kind === "heli") {
				e.x += e.vx * dt;
				e.y += e.vy * dt;
				if (e.x < 24 || e.x > 336) e.vx *= -1;
				if (Math.floor(e.t * 1.4) !== Math.floor((e.t - dt) * 1.4)) this.spread(e, 3, 100, .28, "#ff7a2a");
			} else if (e.kind === "gunboat" || e.kind === "destroyer") {
				e.y += this.terrainVy() * dt;
				const nx = e.x + e.vx * dt;
				if (nx > 24 && nx < 336 && this.wet(nx, e.y) && this.wet(nx, e.y + 8) && this.wet(nx - 10, e.y) && this.wet(nx + 10, e.y)) e.x = nx;
				else e.vx *= -1;
				e.x = Math.max(24, Math.min(336, e.x));
				this.keepOnWater(e);
				if (!this.wet(e.x, e.y) || !this.wet(e.x, e.y + 8)) {
					e.alive = false;
					continue;
				}
				if (e.x < 16 || e.x > 344) e.vx *= -1;
				if (Math.floor(e.t * .9) !== Math.floor((e.t - dt) * .9)) this.fireMissile(e.x, e.y);
			} else if (e.kind === "gunbarge" || e.kind === "strider") {
				this.driveOnLand(e, dt);
				if (!e.alive) continue;
				if (Math.floor(e.t) !== Math.floor(e.t - dt)) this.spread(e, 5, 80, .5);
			} else if (e.kind === "eyepod") {
				e.y += e.vy * dt;
				e.x += Math.sin(e.t * 2) * 70 * dt;
				if (Math.floor(e.t * .8) !== Math.floor((e.t - dt) * .8)) this.ring(e, 10, 70);
			} else if (e.kind === "lancejet") {
				e.y += e.vy * dt;
				this.aimShot(e, 160, .9);
			} else if (e.kind === "keel" || e.kind === "sub") {
				e.y += this.terrainVy() * dt;
				const nx = e.x + e.vx * dt;
				if (nx > 24 && nx < 336 && this.wet(nx, e.y) && this.wet(nx, e.y + 8) && this.wet(nx - 10, e.y) && this.wet(nx + 10, e.y)) e.x = nx;
				else e.vx *= -1;
				e.x = Math.max(24, Math.min(336, e.x));
				this.keepOnWater(e);
				if (!this.wet(e.x, e.y) || !this.wet(e.x, e.y + 8) || !this.wet(e.x, e.y - 4)) {
					e.alive = false;
					continue;
				}
				if (Math.floor(e.t * .75) !== Math.floor((e.t - dt) * .75)) this.fireMissile(e.x, e.y - 6);
			} else if (e.kind === "gilded") {
				e.y += (e.vy + Math.sin(e.t) * 10) * dt;
				e.x += Math.sin(e.t * .8) * 30 * dt;
				if (Math.floor(e.t * 1.2) !== Math.floor((e.t - dt) * 1.2)) this.spread(e, 5, 95, .45, "#f0c14a");
			} else if (e.kind === "redtide") {
				e.y += e.vy * dt;
				e.x += Math.sin(e.t * .7) * 40 * dt;
				if (Math.floor(e.t * 1.4) !== Math.floor((e.t - dt) * 1.4)) this.spread(e, 4, 90, .4, "#ff3b4a");
			} else if (e.kind === "mine") {
				e.y += e.vy * dt;
				e.x += Math.sin(e.t * 4) * 20 * dt;
			} else if (e.kind === "aegis") {
				e.x = 180 + Math.sin(e.t * .7) * 80;
				e.y += (70 - e.y) * dt * .4;
				if (Math.floor(e.t * 1.1) !== Math.floor((e.t - dt) * 1.1)) this.ring(e, 12, 75);
			} else {
				e.y += e.vy * dt;
				e.x += e.vx * dt;
			}
			if (e.y > 690 || e.y < -80 || e.x < -80 || e.x > 440) {
				if (e.mark && e.y > 680) this.missBonusTarget();
				e.alive = false;
			}
		}
	}
	updateBoss(e, dt) {
		const restY = (e.kind === "krakenkeel" ? SUB_BOSS : BOSS_META[this.stage] ?? BOSS_META[0]).restY;
		const entering = e.t < 1.7;
		e.tell = Math.max(0, e.tell - dt);
		const ratio = e.hp / e.maxHp;
		const want = ratio < .33 ? 2 : ratio < .6 ? 1 : 0;
		if (want > e.phase) {
			e.phase = want;
			this.phaseBanner = 1.7;
			this.spark(e.x, e.y, 28, "#fff4c2");
			this.shake = 10;
			this.sfx.phase();
			this.ring(e, 16, 85, "#fff4c2");
			this.setAtk(this.bossPhaseName(e.kind, e.phase));
			this.onChange();
		}
		if (entering) {
			e.y += (restY - e.y) * Math.min(1, dt * 1.8);
			this.setAtk("");
		}
		const ready = !entering;
		const p = e.phase;
		if (e.kind === "siegecrawler") this.bossSiege(e, dt, p, ready, restY, entering);
		else if (e.kind === "phantomwing") this.bossPhantom(e, dt, p, ready, restY);
		else if (e.kind === "rootcitadel") this.bossRoot(e, dt, p, ready, restY, entering);
		else if (e.kind === "dunehauler" || e.kind === "redmaw") this.bossDune(e, dt, p, ready, restY, entering);
		else if (e.kind === "skypike") this.bossPike(e, dt, p, ready, restY, entering);
		else if (e.kind === "silohydra") this.bossSilo(e, dt, p, ready, restY, entering);
		else if (e.kind === "ironalbatross") this.bossAlbatross(e, dt, p, ready, restY);
		else if (e.kind === "krakenkeel") this.bossKraken(e, dt, p, ready, restY, entering);
		else if (e.kind === "battlekeel" || e.kind === "harborking") this.bossKeel(e, dt, p, ready, restY, entering);
		else if (e.kind === "arsenalgate" || e.kind === "gyre") this.bossGate(e, dt, p, ready, restY, entering);
		else if (e.kind === "skycathedral" || e.kind === "crowncore") this.bossCathedral(e, dt, p, ready, restY, entering);
		else if (e.kind === "solarmoth") {
			e.x = 180 + Math.sin(e.t * .72) * 100;
			e.y = restY + Math.sin(e.t * 1.35) * 18;
			if (ready && this.pulse(e, dt, 1)) this.spread(e, p === 0 ? 5 : 7, 96, .36, "#f0c14a");
		} else if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.5);
	}
	cycleU(e, period) {
		return Math.max(0, e.t - 1.7) % period;
	}
	windAtk(e, u, t0, t1, name, wind = .42) {
		if (u >= t0 - wind && u < t1) {
			this.setAtk(name);
			if (u < t0) {
				e.tell = Math.max(e.tell, t0 - u);
				if (u < t0 - wind + .05) this.sfx.tell();
			}
			return u >= t0;
		}
		return false;
	}
	setAtk(name) {
		if (this.bossAtk === name) return;
		this.bossAtk = name;
		this.onChange();
	}
	bossPhaseName(kind, phase) {
		return {
			siegecrawler: [
				"RADAR SWEEP",
				"SEARCH GRID",
				"SATURATION"
			],
			phantomwing: [
				"GHOST GUNS",
				"AFTERBURN",
				"DOUBLE IMAGE"
			],
			rootcitadel: [
				"CANOPY RAIN",
				"SEED BURST",
				"ROOT LASH"
			],
			dunehauler: [
				"TREAD WAKE",
				"CHARGE",
				"DUST STORM"
			],
			redmaw: [
				"TREAD WAKE",
				"CHARGE",
				"DUST STORM"
			],
			skypike: [
				"DIVE BOMB",
				"TRENCH RUN",
				"FREE FALL"
			],
			silohydra: [
				"SEQUENCE",
				"CROSSFIRE",
				"FULL SALVO"
			],
			ironalbatross: [
				"CARPET",
				"ENGINE WASH",
				"BAY DUMP"
			],
			krakenkeel: [
				"SNORKEL",
				"MINEFIELD",
				"MAGAZINE"
			],
			battlekeel: [
				"BROADSIDE",
				"CROSSING FIRE",
				"MAG DUMP"
			],
			harborking: [
				"BROADSIDE",
				"CROSSING FIRE",
				"MAG DUMP"
			],
			arsenalgate: [
				"HINGE SWEEP",
				"LOCKDOWN",
				"GATE SLAM"
			],
			gyre: [
				"HINGE SWEEP",
				"LOCKDOWN",
				"GATE SLAM"
			],
			skycathedral: [
				"SHIELD SPOKES",
				"DOUBLE HELIX",
				"CROWN FLOWER"
			],
			crowncore: [
				"SHIELD SPOKES",
				"DOUBLE HELIX",
				"CROWN FLOWER"
			]
		}[kind]?.[phase] ?? "";
	}
	bossSiege(e, dt, p, ready, restY, entering) {
		if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.6);
		e.x += e.vx * (p >= 2 ? 1.45 : 1) * dt;
		if (e.x < 52 || e.x > 308) e.vx *= -1;
		e.atk = 0;
		if (!ready) return;
		const period = p === 0 ? 5.6 : p === 1 ? 5 : 4.4;
		const u = this.cycleU(e, period);
		const mx = e.x;
		const my = e.y - 16;
		if (this.windAtk(e, u, .48, 1.9, "RADAR SWEEP")) {
			const ang = Math.PI * .16 + (u - .48) * (p >= 2 ? 2.4 : 2.05);
			e.atk = ang;
			if (this.pulse(e, dt, p >= 2 ? 5.2 : 4.4)) {
				this.radarRay(mx, my, ang, p >= 1 ? 5 : 4, 98, "#c4d46a");
				if (p >= 2) this.radarRay(mx, my, Math.PI - ang, 4, 94, "#9aaa3a");
			}
		}
		if (this.windAtk(e, u, 2.35, 3.65, "RANGE SHELLS")) {
			if (this.pulse(e, dt, 1.25)) this.shells(e.x, e.y + 10, p >= 2 ? 5 : 3, this.px, "#9aaa3a");
		}
		if (p === 0 && this.windAtk(e, u, 3.95, 5.1, "MAST PING")) {
			if (this.pulse(e, dt, 1.15)) this.aimFrom(mx, my, 114, "#c4d46a");
		}
		if (p >= 1 && this.windAtk(e, u, 3.85, period - .12, p >= 2 ? "SATURATION" : "SEARCH GRID")) {
			if (this.pulse(e, dt, .88)) this.downFan(mx, my, 5, 108, .22, "#c4d46a");
			if (p >= 2 && this.pulse(e, dt, .52)) this.wallShot(this.px, 44, 9, 92, e.y + 18, "#9aaa3a");
		}
	}
	bossPhantom(e, dt, p, ready, restY) {
		e.tag = Math.max(0, e.tag - dt);
		e.x = 180 + Math.sin(e.t * 1.18) * (102 + p * 10);
		e.y = restY + Math.sin(e.t * 2.05) * 16;
		if (!ready) return;
		const period = p === 0 ? 4.9 : p === 1 ? 4.3 : 3.9;
		const u = this.cycleU(e, period);
		const gx = e.x - 34;
		const hx = e.x + 34;
		const gy = e.y + 6;
		if (this.windAtk(e, u, .5, 1.45, "GHOST GUNS")) {
			if (this.pulse(e, dt, 1.05)) {
				e.tag = p >= 2 ? .95 : .7;
				this.spark(e.x, e.y + 10, 6, "#cfd8e6");
				this.aimFrom(e.x - 10, e.y + 8, 150, "#8aa0b8");
				this.aimFrom(e.x + 10, e.y + 8, 150, "#8aa0b8");
				this.aimFrom(gx, gy, 128, "#6a8098");
				this.aimFrom(hx, gy, 128, "#6a8098");
			}
		}
		if (p >= 1 && this.windAtk(e, u, 1.85, 2.75, "AFTERBURN")) {
			if (this.pulse(e, dt, 1.15)) {
				e.tag = .82;
				this.spread(e, 5, 128, .22, "#cfd8e6");
				this.bloom(e.x, e.y + 4, 6, 68, .4, "#8aa0b8", e.t);
			}
		} else if (p === 0 && this.windAtk(e, u, 2.15, 3.35, "GHOST GUNS")) {
			if (this.pulse(e, dt, .95)) {
				e.tag = .68;
				this.aimFrom(e.x - 10, e.y + 8, 150, "#8aa0b8");
				this.aimFrom(e.x + 10, e.y + 8, 150, "#8aa0b8");
			}
		}
		if (p >= 2 && this.windAtk(e, u, 2.95, 3.75, "DOUBLE IMAGE")) {
			if (this.pulse(e, dt, 1.8)) {
				e.tag = .95;
				this.ring(e, 10, 74, "#8aa0b8");
				this.bloom(gx, e.y, 7, 62, .36, "#6a8098");
			}
		}
		if (ready && p >= 2 && e.tag > 0 && this.pulse(e, dt, 2)) this.aimFrom(e.x, e.y + 6, 170, "#cfd8e6");
	}
	bossRoot(e, dt, p, ready, restY, entering) {
		if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.4);
		e.x = 180 + Math.sin(e.t * .25) * 18;
		if (!ready) return;
		const period = p === 0 ? 5.3 : p === 1 ? 4.8 : 4.4;
		const u = this.cycleU(e, period);
		if (this.pulse(e, dt, p === 0 ? .62 : .78)) {
			this.aimFrom(e.x - 18, e.y - 12, 102, "#7cb86a");
			this.aimFrom(e.x + 18, e.y - 12, 102, "#7cb86a");
			this.aimFrom(e.x - 18, e.y + 12, 92, "#7cb86a");
			this.aimFrom(e.x + 18, e.y + 12, 92, "#7cb86a");
		}
		if (this.windAtk(e, u, .45, 2.05, "CANOPY RAIN")) {
			if (this.pulse(e, dt, 1.15)) {
				const skip = this.px < e.x - 12 ? 0 : this.px > e.x + 12 ? 2 : 1;
				for (let i = 0; i < 3; i++) {
					if (i === skip) continue;
					this.shot(e.x + (i - 1) * 26, e.y - 16, Math.PI / 2, 108, "#5a8a3a");
				}
			}
		}
		if (p >= 1 && this.windAtk(e, u, 2.3, 3.45, "SEED BURST")) {
			if (this.pulse(e, dt, .72)) {
				this.shot(e.x - 10, e.y - 16, Math.PI / 2, 36, "#7cb86a", {
					wait: .55,
					split: 5,
					r: 3.4
				});
				this.shot(e.x + 10, e.y - 16, Math.PI / 2, 36, "#7cb86a", {
					wait: .55,
					split: 5,
					r: 3.4
				});
				this.downFan(e.x, e.y - 16, 5, 96, .2, "#5a8a3a");
			}
		}
		if (p >= 2 && this.windAtk(e, u, 3.55, period - .1, "ROOT LASH")) {
			if (this.pulse(e, dt, 1.35)) {
				this.arcBurst(e.x - 18, e.y + 8, 4, 90, .55, 1.45, "#5a8a3a", { spin: 1.35 });
				this.arcBurst(e.x + 18, e.y + 8, 4, 90, 1.7, 2.6, "#5a8a3a", { spin: -1.35 });
			}
			if (this.pulse(e, dt, .78)) this.streamShot(e.x, e.y - 14, 124, "#7cb86a");
		}
	}
	bossDune(e, dt, p, ready, restY, entering) {
		if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.5);
		const period = p === 0 ? 5.8 : p === 1 ? 5.2 : 4.4;
		const u = this.cycleU(e, period);
		const charging = ready && p >= 1 && this.windAtk(e, u, .38, 1.58, "CHARGE");
		if (charging) {
			e.tag = 1;
			e.vx = (Math.sign(this.px - e.x) || (e.vx >= 0 ? 1 : -1)) * (p >= 2 ? 155 : 124);
		} else {
			e.tag = 0;
			if (p >= 2 && Math.abs(e.vx) < 78) e.vx = (e.vx >= 0 ? 1 : -1) * 82;
		}
		e.x += e.vx * dt;
		if (e.x < 52 || e.x > 308) e.vx *= -1;
		if (!ready) return;
		if (charging && this.pulse(e, dt, 2.4)) {
			const dir = e.vx >= 0 ? 1 : -1;
			const a = Math.PI / 2 + dir * .38;
			this.arcBurst(e.x, e.y + 10, 5, 120, a - .3, a + .3, "#ff3b4a");
		}
		if (this.windAtk(e, u, p >= 1 ? 1.85 : .4, p >= 2 ? 3.25 : period - .15, "TREAD WAKE")) {
			if (this.pulse(e, dt, 2.6)) {
				this.shot(e.x - 22, e.y + 12, Math.PI / 2, 64, "#c47a3a", {
					wait: .2,
					r: 3.1
				});
				this.shot(e.x + 22, e.y + 12, Math.PI / 2, 64, "#c47a3a", {
					wait: .2,
					r: 3.1
				});
			}
			if (this.pulse(e, dt, p === 0 ? .78 : .92)) {
				this.spreadFrom(e.x - 22, e.y + 10, p >= 1 ? 5 : 3, 104, .3, "#ff3b4a");
				this.spreadFrom(e.x + 22, e.y + 10, p >= 1 ? 5 : 3, 104, .3, "#ff3b4a");
			}
		}
		if (p >= 2 && this.windAtk(e, u, 3.4, period - .08, "DUST STORM")) {
			if (this.pulse(e, dt, .7)) this.waveRow(e.y + 14, 7, 88, 42, "#ff7a90", e.t * 2);
			if (this.pulse(e, dt, .55)) this.shells(e.x, e.y + 8, 4, this.px, "#ff3b4a");
		}
		if (p >= 1 && this.pulse(e, dt, 1.5)) this.aimFrom(e.x, e.y + 8, 148, "#ff7a90");
		if (p >= 1 && this.pulse(e, dt, .36) && this.minionCount() < 4) this.spawnE({
			kind: "wasp",
			x: e.x + (Math.random() < .5 ? -28 : 28),
			y: e.y + 18,
			vy: 95,
			hp: 2,
			r: 11,
			score: 80
		});
	}
	bossPike(e, dt, p, ready, restY, entering) {
		const period = p === 0 ? 5.2 : p === 1 ? 4.2 : 3.35;
		const u = entering ? 0 : (e.t - 1.7) % period / period;
		const diving = u > .42 && u < .78;
		e.tag = diving ? 1 : 0;
		e.y += ((diving ? p === 0 ? 222 : p === 1 ? 308 : 368 : restY) - e.y) * Math.min(1, dt * 2.55);
		e.x = 180 + Math.sin(e.t * (diving ? .32 : .92)) * (diving ? 38 : 96);
		const atk = p >= 2 ? "FREE FALL" : p === 1 ? "TRENCH RUN" : "DIVE BOMB";
		if (u > .34 && u <= .42) {
			e.tell = (.42 - u) * period;
			this.setAtk(atk);
			if (u < .36) this.sfx.tell();
		}
		if (diving) this.setAtk(atk);
		if (!ready) return;
		if (!diving && this.pulse(e, dt, 1.05)) this.spread(e, p >= 2 ? 5 : 3, 112, .26, "#cfd8e6");
		if (diving && this.pulse(e, dt, p === 0 ? 1.7 : 2.25)) {
			this.downFan(e.x, e.y + 14, p >= 2 ? 7 : 5, 128, .18, "#ffae42");
			this.aimFrom(e.x, e.y + 12, 158, "#ffae42");
			if (p >= 1) {
				this.shot(e.x - 8, e.y + 14, Math.PI / 2, 128, "#ffae42", { spin: 2.15 });
				this.shot(e.x + 8, e.y + 14, Math.PI / 2, 128, "#ffae42", { spin: -2.15 });
			}
			if (p >= 2) this.shot(e.x, e.y + 16, Math.PI / 2, 42, "#ff7a22", {
				ay: 150,
				r: 3.5
			});
		}
		if (!diving && u > .78 && this.pulse(e, dt, 1.35)) {
			this.shot(e.x, e.y + 8, Math.PI / 2 + .52, 110, "#cfd8e6");
			this.shot(e.x, e.y + 8, Math.PI / 2 - .52, 110, "#cfd8e6");
		}
	}
	bossSilo(e, dt, p, ready, restY, entering) {
		if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.5);
		e.x = 180 + Math.sin(e.t * .3) * 24;
		if (!ready) return;
		const period = p === 0 ? 4.6 : p === 1 ? 4.2 : 3.8;
		const u = this.cycleU(e, period);
		const open = Math.floor(e.t * 1.05) % 3;
		const name = p >= 2 ? "FULL SALVO" : p === 1 ? "CROSSFIRE" : "SEQUENCE";
		if (this.windAtk(e, u, .4, period - .2, name, .32)) {
			if (this.pulse(e, dt, 1.15)) {
				const fire = p === 0 ? [open] : p === 1 ? [open, (open + 2) % 3] : [
					0,
					1,
					2
				];
				for (const slot of fire) {
					const ox = (slot - 1) * 16;
					this.streamAng(e.x + ox, e.y + 8, Math.PI / 2, p >= 2 ? 5 : 4, 126, "#e8c84a");
					if (p >= 2) this.shot(e.x + ox, e.y + 8, Math.PI / 2 + (slot - 1) * .18, 118, "#ffae42");
				}
			}
		}
		if (p >= 1 && this.pulse(e, dt, .62)) {
			const ox = (open - 1) * 16;
			this.spreadFrom(e.x + ox, e.y + 6, 3, 118, .28, "#ffae42");
		}
		if (p >= 2 && this.pulse(e, dt, .85)) for (const ox of [
			-16,
			0,
			16
		]) this.shot(e.x + ox, e.y + 6, Math.PI / 2, 108, "#e8c84a", { spin: ox * .08 });
	}
	bossAlbatross(e, dt, p, ready, restY) {
		const hold = restY + (p >= 2 ? 38 : 0);
		e.y += (hold - e.y) * Math.min(1, dt * 1.45);
		e.x = 180 + Math.sin(e.t * .4) * 70;
		if (!ready) return;
		const period = p >= 2 ? 4.4 : 5;
		const u = this.cycleU(e, period);
		if (this.windAtk(e, u, .4, 2.1, "CARPET")) {
			if (this.pulse(e, dt, p >= 2 ? 1.55 : 1.35)) {
				const n = p >= 2 ? 4 : 3;
				for (let i = -n; i <= n; i++) this.bullet(this.eBullets, {
					x: e.x + i * 14,
					y: e.y + 16,
					vx: i * 6,
					vy: 86,
					r: 2.8,
					dmg: 1,
					homing: false,
					friendly: false,
					color: "#8aa0b8",
					wait: .38
				});
			}
		}
		if (p >= 1 && this.windAtk(e, u, 2.25, 3.45, "ENGINE WASH")) {
			if (this.pulse(e, dt, .78)) {
				this.shot(e.x - 18, e.y + 8, Math.PI / 2, 112, "#cfd8e6", { spin: 1.15 });
				this.shot(e.x + 18, e.y + 8, Math.PI / 2, 112, "#cfd8e6", { spin: -1.15 });
				this.downFan(e.x - 18, e.y + 8, 3, 118, .16, "#cfd8e6");
				this.downFan(e.x + 18, e.y + 8, 3, 118, .16, "#cfd8e6");
			}
		}
		if (p >= 2 && this.windAtk(e, u, 3.55, period - .08, "BAY DUMP")) {
			if (this.pulse(e, dt, .7)) for (let i = -2; i <= 2; i++) this.shot(e.x + i * 16, e.y + 16, Math.PI / 2, 32, "#8aa0b8", {
				wait: .48,
				split: 4,
				r: 3.3
			});
			if (this.pulse(e, dt, .82)) this.aimFrom(e.x, e.y + 10, 138, "#cfd8e6");
		}
	}
	bossKraken(e, dt, p, ready, restY, entering) {
		if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.5);
		e.x += e.vx * dt;
		if (e.x < 48 || e.x > 312) e.vx *= -1;
		if (!ready) return;
		const period = p === 0 ? 4.8 : p === 1 ? 4.4 : 4;
		const u = this.cycleU(e, period);
		if (this.windAtk(e, u, .4, 1.9, "SNORKEL")) {
			if (this.pulse(e, dt, .92)) {
				const a = Math.atan2(this.py - (e.y - 14), this.px - e.x);
				this.streamAng(e.x, e.y - 14, a, 3, 148, "#3d9a9a");
			}
		}
		if (p >= 1 && this.windAtk(e, u, 2.1, 3.3, "MINEFIELD")) {
			if (this.pulse(e, dt, .44)) this.spawnE({
				kind: "mine",
				x: e.x,
				y: e.y + 18,
				vy: 50,
				hp: 2,
				r: 8,
				score: 80
			});
			if (this.pulse(e, dt, .95)) {
				this.arcBurst(e.x - 16, e.y + 8, 4, 96, .45, 1.5, "#3d9a9a", { spin: 1.2 });
				this.arcBurst(e.x + 16, e.y + 8, 4, 96, 1.64, 2.7, "#3d9a9a", { spin: -1.2 });
			}
		}
		if (p >= 2 && this.windAtk(e, u, 3.4, period - .08, "MAGAZINE")) {
			if (this.pulse(e, dt, .7)) this.downFan(e.x, e.y + 12, 5, 122, .2, "#3d9a9a");
			if (this.pulse(e, dt, .55)) this.shot(e.x, e.y + 12, Math.PI / 2, 28, "#5ec8c8", {
				wait: .5,
				split: 5,
				r: 3.6
			});
		} else if (p === 0 && this.windAtk(e, u, 2.2, 3.6, "SNORKEL")) {
			if (this.pulse(e, dt, .7)) this.aimFrom(e.x, e.y - 14, 152, "#3d9a9a");
		}
	}
	bossKeel(e, dt, p, ready, restY, entering) {
		if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.5);
		e.x = 180 + Math.sin(e.t * .38) * 48;
		if (!ready) return;
		const period = p === 0 ? 5.2 : p === 1 ? 4.7 : 4.2;
		const u = this.cycleU(e, period);
		if (this.windAtk(e, u, .4, 2, "BROADSIDE")) {
			if (this.pulse(e, dt, p === 0 ? .72 : .88)) {
				this.arcBurst(e.x - 22, e.y + 6, 4, 118, .7, 1.35, "#6aa4ff");
				this.arcBurst(e.x + 22, e.y + 6, 4, 118, 1.8, 2.44, "#6aa4ff");
				this.aimFrom(e.x - 22, e.y + 6, 124, "#6aa4ff");
				this.aimFrom(e.x + 22, e.y + 6, 124, "#6aa4ff");
			}
		}
		if (p >= 1 && this.windAtk(e, u, 2.2, 3.35, "CROSSING FIRE")) {
			if (this.pulse(e, dt, .9)) {
				this.xBurst(e.x, e.y + 4, 96, "#6aa4ff");
				this.ring(e, 10, 70, "#6aa4ff");
			}
		}
		if (p >= 2 && this.windAtk(e, u, 3.45, period - .08, "MAG DUMP")) {
			if (this.pulse(e, dt, .58)) this.downFan(e.x, e.y + 10, 7, 118, .16, "#6aa4ff");
			if (this.pulse(e, dt, .5)) this.waveRow(e.y + 12, 8, 92, 36, "#8ec0ff", e.t);
		}
		if (this.pulse(e, dt, .32) && this.minionCount() < 5) this.spawnE({
			kind: "wasp",
			x: e.x + (Math.random() * 40 - 20),
			y: e.y + 22,
			vy: 88,
			hp: 2,
			r: 11,
			score: 80
		});
		if (p >= 2 && this.pulse(e, dt, .28) && this.minionCount() < 6) this.spawnE({
			kind: "hornet",
			x: e.x,
			y: e.y + 16,
			vy: 70,
			vx: Math.random() < .5 ? 50 : -50,
			hp: 5,
			r: 14,
			score: 160
		});
	}
	bossGate(e, dt, p, ready, restY, entering) {
		e.x = 180 + Math.sin(e.t * .85) * 92;
		if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.5);
		if (!ready) return;
		const period = p === 0 ? 4.8 : p === 1 ? 4.4 : 4;
		const u = this.cycleU(e, period);
		const lx = e.x - 26;
		const rx = e.x + 26;
		if (this.windAtk(e, u, .4, 2.05, "HINGE SWEEP")) {
			const ang = e.t * (p >= 1 ? 2.1 : 1.65);
			e.atk = ang;
			if (this.pulse(e, dt, 4.6)) {
				this.radarRay(lx, e.y, ang, 4, 86, "#d8e4f0");
				this.radarRay(rx, e.y, Math.PI - ang, 4, 86, "#d8e4f0");
			}
		} else e.atk = 0;
		if (p >= 1 && this.windAtk(e, u, 2.2, 3.25, "LOCKDOWN")) {
			if (this.pulse(e, dt, .78)) {
				const skip = Math.round(this.px / 60) * 60;
				for (let x = 30; x < 360; x += 60) {
					if (Math.abs(x - skip) < 28) continue;
					this.shot(x, e.y + 6, Math.PI / 2, 104, "#9ad8ff");
				}
				this.aimFrom(lx, e.y, 132, "#9ad8ff");
				this.aimFrom(rx, e.y, 132, "#9ad8ff");
			}
		}
		if (p >= 2 && this.windAtk(e, u, 3.35, period - .08, "GATE SLAM")) {
			if (this.pulse(e, dt, .52)) this.wallShot(this.px, 40, 10, 100, e.y + 8, "#cfd8e6");
			if (this.pulse(e, dt, .85)) {
				this.arcBurst(lx, e.y, 5, 108, .35, 1.25, "#9ad8ff");
				this.arcBurst(rx, e.y, 5, 108, 1.9, 2.8, "#9ad8ff");
			}
		} else if (p === 0 && this.windAtk(e, u, 2.3, 3.7, "HINGE SWEEP")) {
			if (this.pulse(e, dt, .95)) this.ring(e, 8, 68, "#d8e4f0");
		}
	}
	bossCathedral(e, dt, p, ready, restY, entering) {
		e.x = 180 + Math.sin(e.t * .55) * (58 + p * 18);
		if (!entering) e.y += (restY - e.y) * Math.min(1, dt * 1.3);
		if (!ready) return;
		if (p === 0) {
			this.setAtk("SHIELD SPOKES");
			if (this.pulse(e, dt, .95)) {
				const spin = e.t * 1.05;
				const gap = .62;
				for (let i = 0; i < 10; i++) {
					const a = i / 10 * Math.PI * 2 + e.t * .15;
					let diff = a - spin;
					while (diff > Math.PI) diff -= Math.PI * 2;
					while (diff < -Math.PI) diff += Math.PI * 2;
					if (Math.abs(diff) < gap) continue;
					this.shot(e.x, e.y, a, 72, "#3ec8ff");
				}
			}
		} else if (p === 1) {
			this.setAtk("DOUBLE HELIX");
			if (this.pulse(e, dt, 7.2)) {
				const a = e.t * 3.6;
				this.shot(e.x, e.y, a, 86, "#7fe8ff");
				this.shot(e.x, e.y, a + Math.PI, 86, "#3ec8ff");
			}
			if (this.pulse(e, dt, .76)) this.spread(e, 5, 128, .24, "#3ec8ff");
		} else {
			this.setAtk("CROWN FLOWER");
			if (this.pulse(e, dt, 7.4)) {
				const a = e.t * 4.4;
				for (let i = 0; i < 3; i++) this.shot(e.x, e.y, a + i * Math.PI * 2 / 3, 94, "#7fe8ff");
			}
			if (this.pulse(e, dt, .48)) this.bloom(e.x, e.y, 8, 64, .32, "#3ec8ff", e.t);
			if (this.pulse(e, dt, .68)) this.spread(e, 3, 142, .2, "#fff");
			if (this.pulse(e, dt, .4)) this.ring(e, 8, 70, "#3ec8ff");
		}
	}
	aimShot(e, spd, chance, color = "#ff5a6a") {
		if (this.bonus) return;
		if (Math.random() > chance) return;
		this.aimFrom(e.x, e.y, spd, color);
	}
	keepOnLand(e) {
		if (this.onFeetLand(e.x, e.y, e.r)) return;
		const snap = nearestLandX(this.map, e.x, e.y, this.bg, Math.max(12, e.r * .55), 12, 8);
		if (snap != null && Math.abs(snap - e.x) < 56 && this.onFeetLand(snap, e.y, e.r)) e.x = snap;
		else e.alive = false;
	}
	driveOnLand(e, dt) {
		e.y += this.terrainVy() * dt;
		if (!e.vx) e.vx = Math.random() < .5 ? 20 : -20;
		const nx = e.x + e.vx * dt;
		if (nx > 28 && nx < 332 && this.onFeetLand(nx, e.y, e.r)) e.x = nx;
		else e.vx *= -1;
		this.keepOnLand(e);
	}
	rollTank(e, dt) {
		e.y += this.terrainVy() * dt;
		e.tag += dt;
		if (!e.vx) e.vx = Math.random() < .5 ? 30 : -30;
		if (e.phase === 0) {
			const nx = e.x + e.vx * dt;
			if (nx > 28 && nx < 332 && this.onFeetLand(nx, e.y, e.r)) e.x = nx;
			else e.vx *= -1;
			if (e.tag >= 1.05) {
				e.phase = 1;
				e.tag = 0;
				e.atk = 0;
			}
		} else {
			if (e.atk === 0) {
				this.fireMissile(e.x, e.y - 6);
				e.atk = 1;
			} else if (e.atk === 1 && e.tag >= 0.28) {
				this.fireMissile(e.x, e.y - 4);
				this.aimShot(e, 86, 1, "#ffb347");
				e.atk = 2;
			}
			if (e.tag >= 0.72) {
				e.phase = 0;
				e.tag = 0;
				e.atk = 0;
				if (Math.random() < .45) e.vx *= -1;
			}
		}
		this.keepOnLand(e);
	}
	keepOnWater(e) {
		if (!this.wet(e.x, e.y) || !this.wet(e.x, e.y + 8) || !this.wet(e.x - 8, e.y) || !this.wet(e.x + 8, e.y)) e.alive = false;
	}
		fireMissile(x, y) {
		if (this.bonus) return;
		const a = Math.atan2(this.py - y, this.px - x);
		this.bullet(this.eBullets, {
			x,
			y,
			vx: Math.cos(a) * 72,
			vy: Math.sin(a) * 72,
			r: 3.6,
			dmg: 1,
			homing: true,
			friendly: false,
			color: "#e8c84a"
		});
	}
	aimFrom(x, y, spd, color) {
		if (this.bonus) return;
		const a = Math.atan2(this.py - y, this.px - x);
		this.bullet(this.eBullets, {
			x,
			y,
			vx: Math.cos(a) * spd,
			vy: Math.sin(a) * spd,
			r: 2.6,
			dmg: 1,
			homing: false,
			friendly: false,
			color
		});
	}
	spread(e, n, spd, arc, color = "#ff7a90") {
		if (this.bonus) return;
		this.spreadFrom(e.x, e.y, n, spd, arc, color);
	}
	spreadFrom(x, y, n, spd, arc, color) {
		if (this.bonus) return;
		const base = Math.atan2(this.py - y, this.px - x);
		for (let i = 0; i < n; i++) {
			const a = base + (i - (n - 1) / 2) * arc;
			this.bullet(this.eBullets, {
				x,
				y,
				vx: Math.cos(a) * spd,
				vy: Math.sin(a) * spd,
				r: 2.4,
				dmg: 1,
				homing: false,
				friendly: false,
				color
			});
		}
	}
	ring(e, n, spd, color = "#c77dff") {
		if (this.bonus) return;
		for (let i = 0; i < n; i++) {
			const a = i / n * Math.PI * 2 + e.t;
			this.bullet(this.eBullets, {
				x: e.x,
				y: e.y,
				vx: Math.cos(a) * spd,
				vy: Math.sin(a) * spd,
				r: 2.3,
				dmg: 1,
				homing: false,
				friendly: false,
				color
			});
		}
	}
	downFan(x, y, n, spd, arc, color) {
		const base = Math.PI / 2;
		for (let i = 0; i < n; i++) {
			const a = base + (i - (n - 1) / 2) * arc;
			this.bullet(this.eBullets, {
				x,
				y,
				vx: Math.cos(a) * spd,
				vy: Math.sin(a) * spd,
				r: 2.5,
				dmg: 1,
				homing: false,
				friendly: false,
				color
			});
		}
	}
	mortar(x, y, n, color) {
		for (let i = 0; i < n; i++) {
			const vx = (i - (n - 1) / 2) * 30;
			const vy = 52 + i % 2 * 14;
			this.bullet(this.eBullets, {
				x,
				y,
				vx,
				vy,
				r: 3.4,
				dmg: 1,
				homing: false,
				friendly: false,
				color
			});
		}
	}
	wallShot(gapX, gapW, n, spd, y, color) {
		for (let i = 0; i < n; i++) {
			const x = 18 + i / Math.max(1, n - 1) * 324;
			if (Math.abs(x - gapX) < gapW) continue;
			this.bullet(this.eBullets, {
				x,
				y,
				vx: 0,
				vy: spd,
				r: 2.5,
				dmg: 1,
				homing: false,
				friendly: false,
				color
			});
		}
	}
	streamShot(x, y, spd, color) {
		const a = Math.atan2(this.py - y, this.px - x);
		for (let i = 0; i < 3; i++) this.bullet(this.eBullets, {
			x: x - Math.cos(a) * i * 10,
			y: y - Math.sin(a) * i * 10,
			vx: Math.cos(a) * spd,
			vy: Math.sin(a) * spd,
			r: 2.3,
			dmg: 1,
			homing: false,
			friendly: false,
			color
		});
	}
	shot(x, y, ang, spd, color, extra) {
		this.bullet(this.eBullets, {
			x,
			y,
			vx: Math.cos(ang) * spd,
			vy: Math.sin(ang) * spd,
			r: extra?.r ?? 2.5,
			dmg: 1,
			homing: false,
			friendly: false,
			color,
			ay: extra?.ay ?? 0,
			spin: extra?.spin ?? 0,
			wait: extra?.wait ?? 0,
			split: extra?.split ?? 0
		});
	}
	radarRay(x, y, ang, n, spd, color) {
		for (let i = 0; i < n; i++) this.shot(x, y, ang, spd + i * 14, color, { r: 2.3 });
	}
	shells(x, y, n, targetX, color) {
		for (let i = 0; i < n; i++) {
			const tx = targetX + (i - (n - 1) / 2) * 30;
			const t = 1.12 + i % 2 * .16;
			this.bullet(this.eBullets, {
				x,
				y,
				vx: (tx - x) / t,
				vy: 46 + i % 2 * 12,
				r: 3.5,
				dmg: 1,
				homing: false,
				friendly: false,
				color,
				ay: 145
			});
		}
	}
	bloom(x, y, n, spd, wait, color, rot = 0) {
		for (let i = 0; i < n; i++) this.shot(x, y, i / n * Math.PI * 2 + rot, spd, color, {
			wait,
			r: 2.8
		});
	}
	arcBurst(x, y, n, spd, a0, a1, color, extra) {
		for (let i = 0; i < n; i++) {
			const a = n === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * (i / (n - 1));
			this.shot(x, y, a, spd, color, extra);
		}
	}
	streamAng(x, y, ang, n, spd, color) {
		for (let i = 0; i < n; i++) this.shot(x - Math.cos(ang) * i * 9, y - Math.sin(ang) * i * 9, ang, spd, color, { r: 2.4 });
	}
	waveRow(y, n, spd, amp, color, phase = 0) {
		for (let i = 0; i < n; i++) {
			const x = 24 + i / Math.max(1, n - 1) * 312;
			this.bullet(this.eBullets, {
				x,
				y,
				vx: Math.sin(phase + i * .7) * amp,
				vy: spd,
				r: 2.5,
				dmg: 1,
				homing: false,
				friendly: false,
				color
			});
		}
	}
	xBurst(x, y, spd, color) {
		for (let i = 0; i < 4; i++) this.shot(x, y, Math.PI / 4 + i * Math.PI / 2, spd, color);
	}
	bossShieldBlocks(e, b) {
		if (e.kind !== "skycathedral" && e.kind !== "crowncore") return false;
		if (e.phase >= 2) return false;
		const d = Math.hypot(b.x - e.x, b.y - e.y);
		if (d > e.r * 1.38 + b.r || d < e.r * .5) return false;
		const ang = Math.atan2(b.y - e.y, b.x - e.x);
		const spin = e.t * (e.phase === 0 ? 1.05 : 1.45);
		const gap = e.phase === 0 ? .62 : .46;
		let diff = ang - spin;
		while (diff > Math.PI) diff -= Math.PI * 2;
		while (diff < -Math.PI) diff += Math.PI * 2;
		return Math.abs(diff) > gap;
	}
	bossHitMul(e, bx, by) {
		if (!isBossKind(e.kind)) return 1;
		switch (e.kind) {
			case "siegecrawler": return by < e.y - 8 ? 1.45 : .85;
			case "phantomwing": return e.tag > 0 || e.flash > 0 ? 1.2 : .35;
			case "rootcitadel": return by < e.y - 10 ? 1.5 : .8;
			case "dunehauler":
			case "redmaw": return Math.abs(bx - e.x) > e.r * .38 ? 1.4 : .85;
			case "skypike": return e.tag > .5 && by > e.y ? 1.65 : .8;
			case "silohydra": {
				const lid = bx < e.x - 8 ? 0 : bx > e.x + 8 ? 2 : 1;
				const want = Math.floor(e.tag) % 3;
				if (lid === want) {
					e.tag = want + 1;
					return 1.55;
				}
				return .72;
			}
			case "ironalbatross": return Math.abs(bx - e.x) > 10 && Math.abs(bx - e.x) < 28 ? 1.5 : .85;
			case "krakenkeel": return e.phase === 0 ? by < e.y - 4 ? 1.55 : .8 : Math.abs(bx - e.x) < 12 && by > e.y ? 1.45 : .85;
			case "battlekeel":
			case "harborking": return Math.abs(bx - e.x) < 12 && by > e.y - 4 ? 1.5 : .85;
			case "arsenalgate":
			case "gyre": return Math.abs(bx - e.x) > e.r * .42 ? 1.5 : .82;
			case "skycathedral":
			case "crowncore": return e.phase >= 2 ? 1.25 : 1.15;
			default: return 1;
		}
	}
	updateBullets(dt) {
		for (const b of this.pBullets) {
			if (!b.alive) continue;
			if (b.homing) {
				const t = this.nearestEnemy(b.x, b.y);
				if (t) {
					const a = Math.atan2(t.y - b.y, t.x - b.x);
					b.vx += Math.cos(a) * 420 * dt;
					b.vy += Math.sin(a) * 420 * dt;
					const s = Math.hypot(b.vx, b.vy) || 1;
					const cap = 460;
					b.vx = b.vx / s * cap;
					b.vy = b.vy / s * cap;
				}
			}
			b.ox = b.x;
			b.oy = b.y;
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			if (b.y < -20 || b.y > 660 || b.x < -20 || b.x > 380) b.alive = false;
		}
		for (const b of this.eBullets) {
			if (!b.alive) continue;
			if (b.wait > 0) {
				b.wait -= dt;
				if (b.wait > 0) continue;
				if (b.split > 0) {
					const n = b.split;
					const spd = 78;
					b.alive = false;
					for (let i = 0; i < n; i++) {
						const a = i / n * Math.PI * 2 + b.x * .01;
						this.bullet(this.eBullets, {
							x: b.x,
							y: b.y,
							vx: Math.cos(a) * spd,
							vy: Math.sin(a) * spd,
							r: 2.2,
							dmg: 1,
							homing: false,
							friendly: false,
							color: b.color
						});
					}
					continue;
				}
			}
			if (b.ay) b.vy += b.ay * dt;
			if (b.homing) {
				const a = Math.atan2(this.py - b.y, this.px - b.x);
				b.vx += Math.cos(a) * 95 * dt;
				b.vy += Math.sin(a) * 95 * dt;
				const s = Math.hypot(b.vx, b.vy) || 1;
				const cap = 128;
				b.vx = b.vx / s * cap;
				b.vy = b.vy / s * cap;
			}
			if (b.spin) {
				const a = Math.atan2(b.vy, b.vx) + b.spin * dt;
				const s = Math.hypot(b.vx, b.vy) || 1;
				b.vx = Math.cos(a) * s;
				b.vy = Math.sin(a) * s;
			}
			b.ox = b.x;
			b.oy = b.y;
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			if (b.y < -20 || b.y > 660 || b.x < -20 || b.x > 380) b.alive = false;
		}
	}
	updateItems(dt) {
		for (const it of this.items) {
			if (!it.alive) continue;
			if (it.planted) {
				it.y = mapToScreenY(it.wy, this.bg);
				if (it.y > -24 && it.y < 660) it.seen = true;
				if (it.seen && (it.y > 668 || it.y < -52)) {
					it.alive = false;
					continue;
				}
			} else {
				it.y += it.vy * dt;
				it.x += Math.sin(it.y * .04) * (it.type === "T" ? 28 : 20) * dt;
				if (it.y > 660) {
					it.alive = false;
					continue;
				}
			}
			const wing = this.vs || this.hasWing();
			const d1 = d2(it.x, it.y, this.px, this.py);
			const d2p = wing ? d2(it.x, it.y, this.cx, this.cy) : 0xe8d4a51000;
			const toP2 = wing && d2p < d1;
			const tx = toP2 ? this.cx : this.px;
			const ty = toP2 ? this.cy : this.py;
			const dist = toP2 ? d2p : d1;
			if (it.hide && dist < 58 * 58) it.hide = false;
			const grab = it.type === "T" || it.type === "N" || it.type === "F" || it.type === "M" ? 16 : 14;
			const pull = it.type === "T" || it.type === "F" ? 36 : 28;
			if (dist < pull * pull && dist > grab * grab && !it.hide) {
				const s = Math.sqrt(dist) || 1;
				it.x += (tx - it.x) / s * 140 * dt;
				it.y += (ty - it.y) / s * 140 * dt;
			}
			if (dist < grab * grab) {
				it.alive = false;
				this.sfx.pickup();
				this.collectItem(it);
				this.onChange();
			}
		}
	}
	collectItem(it) {
		const x = it.x, y = it.y;
		if (it.type === "R") this.collectPower(1, x, y);
		else if (it.type === "P") this.collectMaxPod(x, y);
		else if (it.type === "Q") this.collectPower(2, x, y);
		else if (it.type === "L") this.collectMissiles("lance", x, y);
		else if (it.type === "S") this.collectMissiles("seek", x, y);
		else if (it.type === "B") this.collectBomb(x, y);
		else if (it.type === "G") this.score += 120;
		else if (it.type === "T") {
			this.bonusStarGot += 1;
			this.bonusPay += 800;
			this.score += 800;
			this.spark(x, y, 12, "#f0c14a");
		} else if (it.type === "M") {
			this.stageMedals += 1;
			this.score += MEDAL_PTS;
			this.floatPts(x, y, MEDAL_PTS);
			this.spark(x, y, 10, "#f0c14a");
		} else if (it.type === "N") {
			this.score += NIX_PTS;
			this.floatPts(x, y, NIX_PTS, "#6ab4ff");
			this.spark(x, y, 14, "#6ab4ff");
		} else if (it.type === "F") {
			if (this.luma > 0) {
				this.score += NIX_PTS;
				this.floatPts(x, y, NIX_PTS, "#ffe08a");
			} else {
				this.luma = 1;
				this.floatPts(x, y, "LUMA", "#ffe08a");
			}
			this.spark(x, y, 16, "#ffe08a");
		} else if (it.type === "1") this.lives = Math.min(7, this.lives + 1);
		else if (it.type === "H") this.armor = Math.min(5, this.armor + 1);
		else if (it.type === "W") {
			for (const s of SHOP) if (s.cat === "special" && this.loadout[s.id] > 0) this.ammo[s.id] += 10;
			this.score += 200;
		} else this.score += 200;
	}
	collectPower(n, x, y) {
		if (this.power >= POWER_MAX) this.paySurplus(x, y, SURPLUS_POW);
		else this.power = Math.min(POWER_MAX, this.power + n);
	}
	collectMissiles(mode, x, y) {
		if (mode) this.mode = mode;
		if (this.dronesN >= DRONE_MAX) this.paySurplus(x, y, SURPLUS_POW);
		else this.dronesN = Math.min(DRONE_MAX, this.dronesN + 1);
	}
	collectBomb(x, y) {
		if (this.bombs >= BOMB_MAX) this.paySurplus(x, y, SURPLUS_POW);
		else this.bombs = Math.min(BOMB_MAX, this.bombs + 1);
	}
	collectMaxPod(x, y) {
		const maxed = this.power >= POWER_MAX && this.dronesN >= DRONE_MAX;
		this.power = POWER_MAX;
		this.dronesN = DRONE_MAX;
		if (maxed) this.paySurplus(x, y, SURPLUS_P);
		else this.floatPts(x, y, "MAX", "#7fe8ff");
	}
	paySurplus(x, y, pts) {
		this.score += pts;
		this.floatPts(x, y, pts);
	}
	floatPts(x, y, n, color = "#fff4c2") {
		const text = typeof n === "number" ? n.toLocaleString("en-US") : String(n);
		let p = this.pops.find((s) => !s.alive);
		const next = {
			alive: true,
			x,
			y,
			vy: -46,
			life: .9,
			text,
			color
		};
		if (!p) this.pops.push(next);
		else Object.assign(p, next);
	}
	releaseLuma(x, y) {
		const pack = ["R", "B", this.mode === "lance" ? "S" : "L", "Q", "M"];
		const spots = [
			[0, -18],
			[-22, -6],
			[22, -6],
			[-12, 16],
			[12, 16]
		];
		pack.forEach((type, i) => {
			const [dx, dy] = spots[i] ?? [0, -20];
			this.forceDrop(x + dx, y + dy, type);
		});
		this.spark(x, y, 22, "#ffe08a");
		this.floatPts(x, y, "LUMA", "#ffe08a");
	}
	updateSparks(dt) {
		this.fx.update(dt);
		for (const p of this.pops) {
			if (!p.alive) continue;
			p.y += p.vy * dt;
			p.life -= dt;
			if (p.life <= 0) p.alive = false;
		}
	}
	collisions() {
		for (const b of this.pBullets) {
			if (!b.alive) continue;
			let spent = false;
			for (const e of this.enemies) {
				if (!e.alive) continue;
				if (isBossKind(e.kind) && this.bossShieldBlocks(e, b)) {
					if (b.hit.includes(e)) continue;
					b.hit.push(e);
					this.spark(b.x, b.y, 4, "#7fe8ff");
					if (!b.pierce) {
						b.alive = false;
						spent = true;
						break;
					}
					continue;
				}
				if (!sweep(b.ox ?? b.x, b.oy ?? b.y, b.x, b.y, b.r, e.x, e.y, e.r)) continue;
				if (b.hit.includes(e)) continue;
				b.hit.push(e);
				const dmg = (b.vsGround && e.ground ? b.dmg * 1.8 : b.dmg) * this.bossHitMul(e, b.x, b.y);
				this.hurt(e, dmg, false, b.cpu);
				if (!b.pierce) {
					b.alive = false;
					spent = true;
					break;
				}
			}
			if (spent || !b.alive) continue;
			for (const g of this.grounds) {
				if (!g.alive) continue;
				if (!sweep(b.ox ?? b.x, b.oy ?? b.y, b.x, b.y, b.r, g.x, g.y, g.r)) continue;
				const dmg = b.vsGround ? b.dmg * 1.8 : b.dmg;
				this.hurtGround(g, dmg, b.cpu);
				if (!b.pierce) {
					b.alive = false;
					break;
				}
			}
		}
		if (!this.demo) {
			if (this.invuln <= 0 && this.craftStruck(this.px, this.py, this.hitR)) this.playerHit("p1");
			if (this.hasWing() && this.p2invuln <= 0) {
				const hr = this.p2Ship === "azure" ? 3.2 : this.p2Ship === "crimson" ? 4.2 : 5;
				if (this.craftStruck(this.cx, this.cy, hr)) this.playerHit("p2");
			}
		}
	}
	craftStruck(x, y, hr) {
		for (const b of this.eBullets) {
			if (!b.alive || b.wait > 0) continue;
			if (sweep(b.ox ?? b.x, b.oy ?? b.y, b.x, b.y, b.r, x, y, hr)) {
				b.alive = false;
				return true;
			}
		}
		if (this.bonus) return false;
		for (const e of this.enemies) {
			if (!e.alive || e.ground) continue;
			if (overlap(x, y, hr, e.x, e.y, e.r * .48)) return true;
		}
		return false;
	}
	playerHit(who = "p1") {
		if (this.demo) return;
		const x = who === "p2" ? this.cx : this.px;
		const y = who === "p2" ? this.cy : this.py;
		if (this.armor > 0) {
			this.armor -= 1;
			if (who === "p2") this.p2invuln = 1.2;
			else this.invuln = this.ship === "iron" ? 1.6 : 1.1;
			this.shake = 7;
			this.sfx.pickup();
			this.boomFx(x, y, "#f0c14a", 0.7);
			this.eBullets.forEach((b) => b.alive = false);
			this.onChange();
			return;
		}
		this.sfx.die();
		this.lives -= 1;
		if (who === "p2") this.p2invuln = 2;
		else this.invuln = this.ship === "iron" ? 2.8 : 2;
		this.shake = 12;
		this.power = Math.max(this.loadout.cannon, this.power - 1);
		this.dronesN = Math.max(1 + this.loadout.drone, this.dronesN - 1);
		this.boomFx(x, y, "#3ec8ff", 1.5);
		this.eBullets.forEach((b) => b.alive = false);
		if (this.luma > 0) {
			this.luma = 0;
			this.releaseLuma(x, y);
		}
		if (this.lives <= 0) {
			if (this.vs) this.openVsResult();
			else this.offerContinue();
		}
		this.onChange();
	}
	hurt(e, dmg, bomb, cpu = false) {
		e.hp -= dmg;
		e.flash = .1;
		this.spark(e.x, e.y, 3, "#fff");
		this.sfx.hit();
		if (e.hp <= 0) {
			e.alive = false;
			const airOnGround = !e.ground && this.enemies.some((g) => g.alive && g.ground && Math.hypot(g.x - e.x, g.y - e.y) < 40);
			if (!cpu && airOnGround) this.chain = Math.min(32, this.chain * 2);
			if (!cpu) this.chainT = 2.2;
			const pts = Math.floor(e.score * (cpu ? 1 : this.chain));
			if (cpu) this.cpuScore += pts;
			else this.score += pts;
			const boss = isBossKind(e.kind);
			const sea = e.kind === "sub" || e.kind === "keel" || e.kind === "gunboat" || e.kind === "destroyer";
			this.boomFx(e.x, e.y, boss ? "#3ec8ff" : "#ffb347", bomb || boss ? 1.7 : 1);
			if (sea) {
				this.fx.splash(e.x, e.y);
				this.fluid.impulse(e.x, e.y, 1.3);
			}
			this.sfx.boom();
			this.shake = Math.max(this.shake, bomb || boss ? 12 : 4);
			if (e.mark) this.creditBonusTarget(e.x, e.y);
			else if (!cpu) this.dropItem(e.x, e.y);
			if (boss) {
				this.bossAlive = false;
				this.eBullets.forEach((b) => b.alive = false);
				if (e.kind === "krakenkeel") {
					this.midCleared = true;
					this.midSpawnT = 2.1;
					this.bossWarn = true;
					if (cpu) this.cpuScore += 1500;
					else this.score += 1500;
					if (!cpu) this.forceDrop(e.x, e.y, "P");
					this.sfx.warn();
				} else {
					this.bossWarn = false;
					this.stageClearT = 2.6;
					if (cpu) this.cpuScore += 2500;
					else this.score += 2500;
					if (!cpu) {
						this.forceDrop(e.x - 12, e.y, "P");
						this.forceDrop(e.x + 12, e.y, "B");
						this.forceDrop(e.x, e.y - 14, "M");
						this.forceDrop(e.x, e.y + 10, "G");
						this.forceDrop(e.x - 18, e.y + 8, "G");
						this.forceDrop(e.x + 18, e.y + 8, "G");
					}
				}
				this.onChange();
			}
		}
	}
	saveHi() {
		if (this.score > this.hi) {
			this.hi = this.score;
			localStorage.setItem(HS_KEY, String(this.hi));
		}
	}
	incomingSpec() {
		return this.stage === 7 && !this.midCleared ? SUB_BOSS : BOSS_META[this.stage];
	}
	bossHud() {
		const e = this.enemies.find((x) => x.alive && isBossKind(x.kind));
		const spec = e ? e.kind === "krakenkeel" ? SUB_BOSS : BOSS_META[this.stage] : this.incomingSpec();
		return {
			warning: (this.bossWarn || this.midSpawnT > 0) && !e && this.stageClearT <= 0,
			name: spec?.name ?? "",
			hp: e ? e.hp : 0,
			max: e ? e.maxHp : 0,
			phase: e ? e.phase + 1 : 0,
			weak: spec?.weak ?? "",
			atk: e ? this.bossAtk : ""
		};
	}
	draw() {
		const c = this.ctx;
		const w = this.canvas.width;
		const h = this.canvas.height;
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.clearRect(0, 0, w, h);
		const sx = w / 360;
		const sy = h / 640;
		const shx = (Math.random() - .5) * this.shake;
		const shy = (Math.random() - .5) * this.shake;
		c.setTransform(sx, 0, 0, sy, shx * sx, shy * sy);
		c.imageSmoothingEnabled = false;
		this.drawBg(c);
		if (this.screen === "play" || this.screen === "pause" || this.screen === "over" || this.screen === "win") this.drawWorld(c);
	}
	drawBg(c) {
		drawTileMap(c, this.sprites.tiles, this.map, this.bg, this.stageT);
	}
	drawWorld(c) {
		this.fluid.draw(c);
		if (this.stage === 0) this.drawCarrier(c);
		for (const d of this.decor) {
			if (!d.alive) continue;
			const prop = d.kind === "tree" || d.kind === "grass" ? this.stage === 3 || this.stage === 4 ? this.sprites.palm : this.sprites.tree : d.kind === "bush" ? this.sprites.bush : d.kind === "reef" ? this.sprites.bush : null;
			if (prop && drawSprite(c, prop, d.x, d.y + 8, d.kind === "tree" ? 46 : 20, "feet")) continue;
			drawDecor(c, d, this.stageT);
		}
		for (const g of this.grounds) {
			if (!g.alive) continue;
			const key = g.kind === "bunker" ? g.x < 360 * .33 ? "turret-blue" : g.x < 360 * .66 ? "turret-red" : "turret-orange" : g.kind === "radar" ? "radar" : g.kind === "hangar" ? "hangar" : g.kind === "silo" ? "silo" : g.kind === "crate" ? "crate" : g.kind === "dock" || g.kind === "barrel" ? "barrel" : g.kind === "fuel" ? "fuel" : g.kind === "hut" ? "hut" : g.kind === "tree" ? this.stage === 3 || this.stage === 4 ? "palm" : "tree" : g.kind === "bush" ? "bush" : "";
			const h = g.kind === "hangar" ? 28 : g.kind === "bunker" ? 32 : g.kind === "fuel" ? 22 : g.kind === "barrel" ? 20 : g.kind === "hut" ? 24 : g.kind === "tree" ? 42 : 22;
			if (!(key ? drawSprite(c, this.sprites[key], g.x, g.y + 8, h, "feet") : false)) drawGround(c, g);
			else {
				if (g.flash > 0) {
					c.save();
					c.globalAlpha = Math.min(.8, g.flash * 8);
					c.fillStyle = "#fff";
					c.beginPath();
					c.arc(g.x, g.y, g.r * .85, 0, Math.PI * 2);
					c.fill();
					c.restore();
				}
				if (!isSoftTarget(g.kind)) {
					c.fillStyle = "#1a1a1a";
					c.fillRect(g.x - 14, g.y - g.r - 8, 28, 3);
					c.fillStyle = "#f0c14a";
					c.fillRect(g.x - 14, g.y - g.r - 8, 28 * (g.hp / g.maxHp), 3);
				}
				if (g.kind === "bunker" || g.kind === "tower" || g.kind === "radar") this.drawEmplacement(c, g);
			}
			if (g.mark) this.drawMark(c, g.x, g.y, g.r + 6);
		}
		for (const it of this.items) {
			if (!it.alive) continue;
			this.drawItem(c, it);
		}
		for (const e of this.enemies) {
			if (!e.alive) continue;
			this.drawEnemy(c, e);
			if (e.mark) this.drawMark(c, e.x, e.y, e.r + 8);
			if (e.maxHp >= 40 && !isBossKind(e.kind)) {
				c.fillStyle = "#1a1a1a";
				c.fillRect(e.x - 22, e.y - e.r - 10, 44, 4);
				c.fillStyle = "#ff3b4a";
				c.fillRect(e.x - 22, e.y - e.r - 10, 44 * (e.hp / e.maxHp), 4);
			}
		}
		for (const b of this.eBullets) {
			if (!b.alive) continue;
			if (b.homing) {
				c.save();
				c.translate(b.x, b.y);
				c.rotate(Math.atan2(b.vy, b.vx));
				c.fillStyle = "#e8c84a";
				c.fillRect(-7, -2.2, 12, 4.4);
				c.fillStyle = "#fff4c2";
				c.fillRect(3, -1.6, 5, 3.2);
				c.fillStyle = "#ff7a2a";
				c.fillRect(-9, -1.2, 3, 2.4);
				c.restore();
				continue;
			}
			const waiting = b.wait > 0;
			const rr = waiting ? b.r + 1.4 + Math.sin(b.wait * 14) * .9 : b.r + .55;
			c.fillStyle = b.color;
			c.fillRect(b.x - rr, b.y - rr, rr * 2, rr * 2);
			if (waiting) {
				c.strokeStyle = "#fff4c2";
				c.lineWidth = 1;
				c.globalAlpha = .7;
				c.strokeRect(b.x - rr - 2, b.y - rr - 2, (rr + 2) * 2, (rr + 2) * 2);
				c.globalAlpha = 1;
			}
		}
		for (const b of this.pBullets) {
			if (!b.alive) continue;
			c.fillStyle = b.color;
			c.fillRect(b.x - 1.4, b.y - 5, 2.8, 8);
		}
		for (const d of this.drones) {
			this.drawShadow(c, d.x, d.y, 6, 3);
			c.fillStyle = this.mode === "lance" ? "#5cff9a" : "#ffd36a";
			c.fillRect(d.x - 4, d.y - 4, 8, 8);
		}
		if (this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0) this.drawCraft(c, this.px, this.py, this.ship);
		if (this.vs || this.hasWing()) {
			if (this.p2invuln <= 0 || Math.floor(this.p2invuln * 12) % 2 === 0) this.drawCraft(c, this.cx, this.cy, this.vs ? this.cpuShip : this.p2Ship);
			c.fillStyle = this.vs ? "#f0c14a" : this.crew === "duo" ? "#3ec8ff" : "#f0c14a";
			c.font = "bold 8px monospace";
			c.textAlign = "center";
			c.fillText(this.vs ? "CPU" : this.crew === "duo" ? "P2" : "CPU", this.cx, this.cy - 22);
		}
		this.fx.draw(c);
		for (const p of this.pops) {
			if (!p.alive) continue;
			c.save();
			c.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
			c.fillStyle = p.color;
			c.font = "bold 10px monospace";
			c.textAlign = "center";
			c.textBaseline = "middle";
			c.fillText(p.text, Math.round(p.x), Math.round(p.y));
			c.restore();
		}
		if (this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0) this.drawCore(c, this.px, this.py, this.hitR, this.ship === "azure" ? "#7fe8ff" : this.ship === "crimson" ? "#ff8a6a" : "#c4d46a");
		if ((this.vs || this.hasWing()) && (this.p2invuln <= 0 || Math.floor(this.p2invuln * 12) % 2 === 0)) {
			const hr = this.p2Ship === "azure" ? 3.2 : this.p2Ship === "crimson" ? 4.2 : 5;
			const col = this.vs ? "#f0c14a" : this.crew === "duo" ? "#3ec8ff" : "#f0c14a";
			this.drawCore(c, this.cx, this.cy, this.vs ? 4.2 : hr, col);
		}
		if ((this.bossWarn || this.midSpawnT > 0) && !this.enemies.some((e) => e.alive && isBossKind(e.kind)) && this.stageClearT <= 0) {
			const flash = Math.floor(this.stageT * 7) % 2 === 0;
			c.textAlign = "center";
			c.fillStyle = flash ? "#ff3b4a" : "#f0c14a";
			c.font = "bold 26px sans-serif";
			c.fillText("WARNING", 180, 268.8);
			c.fillStyle = "#e8eef8";
			c.font = "bold 12px monospace";
			c.fillText(this.incomingSpec()?.name ?? "BOSS", 180, 290.8);
			c.fillStyle = "#f0c14a";
			c.font = "9px monospace";
			const weak = this.incomingSpec()?.weak ?? "";
			if (weak) c.fillText(weak, 180, 306.8);
		}
		if (this.stageClearT > 0) {
			c.textAlign = "center";
			c.fillStyle = "#3ec8ff";
			c.font = "bold 22px sans-serif";
			c.fillText("STAGE CLEAR", 180, 268.8);
		}
		if (this.bonus && this.bonusSting > 0 && this.bonusBanner <= 0) {
			const flash = Math.floor(this.stageT * 8) % 2 === 0;
			c.textAlign = "center";
			c.fillStyle = flash ? "#f0c14a" : "#fff4c2";
			c.font = "bold 22px sans-serif";
			c.fillText("BONUS STAGE", 180, 243.2);
			c.fillStyle = "#e8eef8";
			c.font = "bold 12px monospace";
			c.fillText(this.bonusName(), 180, 265.2);
			c.fillStyle = "#f0c14a";
			c.font = "9px monospace";
			c.fillText("DESTROY THE MARKED TARGETS · TAKE THE STARS", 180, 283.2);
		}
		if (this.bonusBanner > 0) {
			c.textAlign = "center";
			c.globalAlpha = Math.min(1, this.bonusBanner);
			if (this.bonusPerfect) {
				c.fillStyle = "#f0c14a";
				c.font = "bold 26px sans-serif";
				c.fillText("PERFECT BONUS", 180, 243.2);
			} else {
				c.fillStyle = "#3ec8ff";
				c.font = "bold 22px sans-serif";
				c.fillText("BONUS", 180, 243.2);
			}
			c.fillStyle = "#e8eef8";
			c.font = "bold 16px monospace";
			c.fillText(this.bonusPay.toLocaleString("en-US") + " PTS", 180, 271.2);
			c.fillStyle = "#f0c14a";
			c.font = "10px monospace";
			c.fillText(this.bonusPerfect ? `TARGETS ${this.bonusHit}/${this.bonusNeed}  STARS ${this.bonusStarGot}` : `HIT ${this.bonusHit}/${this.bonusNeed}  MISS ${this.bonusMiss}  STARS ${this.bonusStarGot}`, 180, 291.2);
			c.globalAlpha = 1;
		}
		const boss = this.enemies.find((e) => e.alive && isBossKind(e.kind));
		if (boss && boss.t < 2.8) {
			const spec = boss.kind === "krakenkeel" ? SUB_BOSS : BOSS_META[this.stage];
			c.textAlign = "center";
			c.fillStyle = "#f0c14a";
			c.font = "9px monospace";
			c.globalAlpha = Math.min(1, 2.8 - boss.t);
			c.fillText(spec?.weak ?? "", 180, 58);
			c.globalAlpha = 1;
		}
		if (this.phaseBanner > 0) {
			const a = Math.min(1, this.phaseBanner);
			c.textAlign = "center";
			c.globalAlpha = a;
			c.fillStyle = "#fff4c2";
			c.font = "bold 22px sans-serif";
			c.fillText("PHASE BREAK", 180, 640 * .36);
			c.fillStyle = "#3ec8ff";
			c.font = "bold 14px monospace";
			const ph = boss ? boss.phase + 1 : 2;
			c.fillText(`PHASE ${ph} / 3`, 180, 252.39999999999998);
			const sig = boss ? this.bossPhaseName(boss.kind, boss.phase) : "";
			if (sig) {
				c.fillStyle = "#f0c14a";
				c.font = "bold 11px monospace";
				c.fillText(sig, 180, 270.4);
			}
			c.globalAlpha = 1;
		}
		if (boss && this.bossAtk && this.phaseBanner <= 0) {
			c.textAlign = "center";
			c.fillStyle = boss.tell > 0 ? "#f0c14a" : "#e8eef8";
			c.font = "bold 10px monospace";
			c.globalAlpha = boss.tell > 0 ? .95 : .72;
			c.fillText(this.bossAtk, 180, 72);
			c.globalAlpha = 1;
		}
	}
	drawMark(c, x, y, r) {
		c.save();
		c.strokeStyle = "#f0c14a";
		c.lineWidth = 1.6;
		c.globalAlpha = .55 + Math.sin(this.stageT * 8) * .25;
		c.beginPath();
		c.arc(x, y, r, 0, Math.PI * 2);
		c.stroke();
		c.fillStyle = "#f0c14a";
		c.globalAlpha = .95;
		c.beginPath();
		c.moveTo(x, y - r - 6);
		c.lineTo(x + 4, y - r - 1);
		c.lineTo(x - 4, y - r - 1);
		c.closePath();
		c.fill();
		c.restore();
	}
	drawItem(c, it) {
		const x = it.x, y = it.y;
		if (it.type === "T") {
			this.drawGoldStar(c, x, y, 7 + Math.sin(y * .08) * 1.2);
			return;
		}
		if (it.type === "M") {
			this.drawMedal(c, x, y);
			return;
		}
		if (it.type === "R" || it.type === "Q") {
			this.drawPowerCube(c, x, y, it.tint === "blue" || it.type === "Q" ? "blue" : "red");
			return;
		}
		if (it.type === "L") {
			this.drawChip(c, x, y, "#f0c14a", "M");
			return;
		}
		if (it.type === "S") {
			this.drawChip(c, x, y, "#3ddb6a", "H");
			return;
		}
		if (it.type === "B") {
			this.drawBombPod(c, x, y);
			return;
		}
		if (it.type === "P") {
			this.drawPPod(c, x, y);
			return;
		}
		if (it.type === "N") {
			this.drawNix(c, x, y);
			return;
		}
		if (it.type === "F") {
			this.drawLuma(c, x, y, !!it.hide);
			return;
		}
		if (it.type === "1") {
			this.draw1Up(c, x, y);
			return;
		}
		if (it.type === "H") {
			this.drawShieldPod(c, x, y);
			return;
		}
		if (it.type === "G") {
			c.fillStyle = "#f0c14a";
			c.beginPath();
			c.arc(x, y, 6, 0, Math.PI * 2);
			c.fill();
			c.fillStyle = "#fff4c2";
			c.beginPath();
			c.arc(x - 1.5, y - 1.5, 2, 0, Math.PI * 2);
			c.fill();
			return;
		}
		this.drawChip(c, x, y, it.type === "W" ? "#6dff8a" : "#ffae42", it.type);
	}
	drawPowerCube(c, x, y, tone) {
		const ox = Math.round(x);
		const oy = Math.round(y);
		const top = tone === "blue" ? "#7ec8ff" : "#ff6a62";
		const left = tone === "blue" ? "#1a4e92" : "#8a1818";
		const right = tone === "blue" ? "#2a88d4" : "#d43a3a";
		c.save();
		c.translate(ox, oy);
		c.fillStyle = "#070b14";
		c.beginPath();
		c.moveTo(0, -8);
		c.lineTo(8, -3);
		c.lineTo(8, 5);
		c.lineTo(0, 10);
		c.lineTo(-8, 5);
		c.lineTo(-8, -3);
		c.closePath();
		c.fill();
		c.fillStyle = top;
		c.beginPath();
		c.moveTo(0, -7);
		c.lineTo(7, -3);
		c.lineTo(0, 1);
		c.lineTo(-7, -3);
		c.closePath();
		c.fill();
		c.fillStyle = left;
		c.beginPath();
		c.moveTo(-7, -3);
		c.lineTo(0, 1);
		c.lineTo(0, 8);
		c.lineTo(-7, 4);
		c.closePath();
		c.fill();
		c.fillStyle = right;
		c.beginPath();
		c.moveTo(7, -3);
		c.lineTo(0, 1);
		c.lineTo(0, 8);
		c.lineTo(7, 4);
		c.closePath();
		c.fill();
		c.fillStyle = "#fff";
		c.fillRect(-2, -5, 2, 2);
		c.restore();
	}
	drawChip(c, x, y, bg, letter) {
		const ox = Math.round(x) - 8;
		const oy = Math.round(y) - 8;
		c.fillStyle = "#070b14";
		c.fillRect(ox, oy, 16, 16);
		c.fillStyle = bg;
		c.fillRect(ox + 1, oy + 1, 14, 14);
		c.fillStyle = "#fff8de";
		c.fillRect(ox + 2, oy + 2, 3, 2);
		c.fillStyle = "#070b14";
		c.font = "bold 11px monospace";
		c.textAlign = "center";
		c.textBaseline = "middle";
		c.fillText(letter, Math.round(x), Math.round(y) + 1);
	}
	drawBombPod(c, x, y) {
		const ox = Math.round(x);
		const oy = Math.round(y);
		c.save();
		c.translate(ox, oy);
		c.fillStyle = "#070b14";
		c.beginPath();
		c.moveTo(-7, -6);
		c.lineTo(7, -6);
		c.lineTo(8, 2);
		c.lineTo(0, 9);
		c.lineTo(-8, 2);
		c.closePath();
		c.fill();
		c.fillStyle = "#4a4a52";
		c.beginPath();
		c.moveTo(-6, -5);
		c.lineTo(6, -5);
		c.lineTo(7, 1);
		c.lineTo(0, 7);
		c.lineTo(-7, 1);
		c.closePath();
		c.fill();
		c.fillStyle = "#ff3b4a";
		c.font = "bold 11px monospace";
		c.textAlign = "center";
		c.textBaseline = "middle";
		c.fillText("B", 0, 0);
		c.restore();
	}
	drawPPod(c, x, y) {
		const ox = Math.round(x);
		const oy = Math.round(y);
		c.save();
		c.translate(ox, oy);
		c.fillStyle = "#070b14";
		c.beginPath();
		c.roundRect(-8, -7, 16, 14, 5);
		c.fill();
		c.fillStyle = "#2a6adf";
		c.beginPath();
		c.roundRect(-7, -6, 14, 12, 4);
		c.fill();
		c.fillStyle = "#7ec8ff";
		c.fillRect(-5, -4, 4, 2);
		c.fillStyle = "#fff";
		c.font = "bold 11px monospace";
		c.textAlign = "center";
		c.textBaseline = "middle";
		c.fillText("P", 0, 1);
		c.restore();
	}
	draw1Up(c, x, y) {
		const ox = Math.round(x) - 10;
		const oy = Math.round(y) - 7;
		c.fillStyle = "#070b14";
		c.fillRect(ox, oy, 20, 14);
		c.fillStyle = "#1e9a3a";
		c.fillRect(ox + 1, oy + 1, 18, 12);
		c.fillStyle = "#fff";
		c.font = "bold 8px monospace";
		c.textAlign = "center";
		c.textBaseline = "middle";
		c.fillText("1UP", Math.round(x), Math.round(y) + 1);
	}
	drawShieldPod(c, x, y) {
		const ox = Math.round(x);
		const oy = Math.round(y);
		c.save();
		c.translate(ox, oy);
		c.fillStyle = "#070b14";
		c.beginPath();
		c.moveTo(0, -8);
		c.lineTo(7, -4);
		c.lineTo(7, 2);
		c.lineTo(0, 8);
		c.lineTo(-7, 2);
		c.lineTo(-7, -4);
		c.closePath();
		c.fill();
		c.fillStyle = "#f0c14a";
		c.beginPath();
		c.moveTo(0, -6);
		c.lineTo(5, -3);
		c.lineTo(5, 1);
		c.lineTo(0, 6);
		c.lineTo(-5, 1);
		c.lineTo(-5, -3);
		c.closePath();
		c.fill();
		c.fillStyle = "#fff4c2";
		c.fillRect(-2, -3, 2, 2);
		c.restore();
	}
	drawNix(c, x, y) {
		const bob = Math.sin(this.stageT * 6 + y * .05) * 1.1;
		c.save();
		c.translate(Math.round(x), Math.round(y + bob));
		c.fillStyle = "#102448";
		c.beginPath();
		c.ellipse(0, 1.5, 8.2, 6.8, 0, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#2f74d0";
		c.beginPath();
		c.ellipse(0, 0, 7.6, 6.4, 0, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#7ec8ff";
		c.beginPath();
		c.ellipse(-1.8, -2, 3.4, 2.6, 0, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#1a3a7a";
		c.beginPath();
		c.ellipse(-5.5, -5.2, 2.2, 2.6, 0, 0, Math.PI * 2);
		c.fill();
		c.beginPath();
		c.ellipse(5.5, -5.2, 2.2, 2.6, 0, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#fff";
		c.fillRect(-4, -2, 3, 4);
		c.fillRect(1, -2, 3, 4);
		c.fillStyle = "#070b14";
		c.fillRect(-3, -1, 2, 3);
		c.fillRect(2, -1, 2, 3);
		c.fillStyle = "#f0c14a";
		c.beginPath();
		c.moveTo(-2.2, 1.4);
		c.lineTo(2.2, 1.4);
		c.lineTo(0, 5.4);
		c.closePath();
		c.fill();
		c.fillRect(-5, 5.5, 4, 2);
		c.fillRect(1, 5.5, 4, 2);
		c.restore();
	}
	drawLuma(c, x, y, hidden) {
		const bob = Math.sin(this.stageT * 7) * 1.4;
		c.save();
		c.globalAlpha = hidden ? .22 + Math.sin(this.stageT * 9) * .08 : 1;
		c.translate(Math.round(x), Math.round(y + bob));
		c.fillStyle = "#fff8de";
		c.beginPath();
		c.moveTo(-2, -2);
		c.lineTo(-10, -8);
		c.lineTo(-8, -1);
		c.lineTo(-10, 4);
		c.lineTo(-2, 1);
		c.closePath();
		c.fill();
		c.beginPath();
		c.moveTo(2, -2);
		c.lineTo(10, -8);
		c.lineTo(8, -1);
		c.lineTo(10, 4);
		c.lineTo(2, 1);
		c.closePath();
		c.fill();
		c.fillStyle = "#f0c14a";
		c.beginPath();
		c.ellipse(0, 1.2, 3.4, 5.2, 0, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#ffe08a";
		c.beginPath();
		c.arc(0, -4.6, 3, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#fff";
		c.fillRect(-1, -5.6, 2, 2);
		c.fillStyle = "#c98a18";
		c.fillRect(-1.5, -3.4, 1, 1);
		c.fillRect(.5, -3.4, 1, 1);
		c.fillStyle = "#fff4c2";
		c.fillRect(-1, -9.5, 2, 2);
		c.fillRect(0, -11, 1, 2);
		c.restore();
	}
	drawGoldStar(c, x, y, r) {
		c.save();
		c.translate(x, y);
		c.rotate(this.stageT * 2.4);
		c.fillStyle = "#f0c14a";
		c.beginPath();
		for (let i = 0; i < 5; i++) {
			const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
			const b = a + Math.PI / 5;
			if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
			else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
			c.lineTo(Math.cos(b) * r * .42, Math.sin(b) * r * .42);
		}
		c.closePath();
		c.fill();
		c.fillStyle = "#fff4c2";
		c.beginPath();
		c.arc(0, 0, r * .28, 0, Math.PI * 2);
		c.fill();
		c.restore();
	}
	drawMedal(c, x, y) {
		const wobble = 1 + Math.sin(this.stageT * 5.2 + y * .05) * .08;
		c.save();
		c.translate(x, y);
		c.scale(wobble, wobble);
		c.fillStyle = "#ff3b4a";
		c.beginPath();
		c.moveTo(-3.6, 0);
		c.lineTo(-6.2, 8.4);
		c.lineTo(-1.4, 5.6);
		c.lineTo(0, 8.8);
		c.lineTo(1.4, 5.6);
		c.lineTo(6.2, 8.4);
		c.lineTo(3.6, 0);
		c.closePath();
		c.fill();
		c.fillStyle = "#c98a18";
		c.beginPath();
		c.arc(0, -1.2, 6.6, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#f0c14a";
		c.beginPath();
		c.arc(0, -1.2, 5.3, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#fff4c2";
		c.beginPath();
		c.arc(-1.6, -2.8, 1.7, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#c98a18";
		c.beginPath();
		const r = 2.5;
		for (let i = 0; i < 5; i++) {
			const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
			const b = a + Math.PI / 5;
			const ox = 0, oy = -1.2;
			if (i === 0) c.moveTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
			else c.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
			c.lineTo(ox + Math.cos(b) * r * .4, oy + Math.sin(b) * r * .4);
		}
		c.closePath();
		c.fill();
		c.restore();
	}
	drawCore(c, x, y, r, ring) {
		c.fillStyle = ring;
		c.globalAlpha = .28;
		c.beginPath();
		c.arc(x, y, r + 1.6, 0, 6.283185307179586);
		c.fill();
		c.globalAlpha = 1;
		c.strokeStyle = "#fff";
		c.lineWidth = 1.2;
		c.beginPath();
		c.arc(x, y, r, 0, 6.283185307179586);
		c.stroke();
		c.fillStyle = "#fff";
		c.beginPath();
		c.arc(x, y, Math.max(1.15, r * .38), 0, 6.283185307179586);
		c.fill();
	}
	drawShadow(c, x, y, rx = 16, ry = 5.5) {
		c.save();
		c.globalAlpha = .38;
		c.fillStyle = "#000";
		c.beginPath();
		c.ellipse(x + 11, y + 28, rx, ry, 0, 0, Math.PI * 2);
		c.fill();
		c.restore();
	}
	drawCraft(c, x, y, ship) {
		this.drawShadow(c, x, y, 17, 6);
		this.drawThrusters(c, x, y, ship);
		const im = this.sprites[ship];
		if (im && im.complete && im.naturalWidth > 0) {
			const h = 36;
			const w = im.naturalWidth / im.naturalHeight * h;
			c.drawImage(im, x - w / 2, y - h / 2, w, h);
			return;
		}
		c.save();
		c.translate(x, y);
		c.fillStyle = ship === "azure" ? "#3ec8ff" : ship === "crimson" ? "#ff3b4a" : "#c4d46a";
		c.beginPath();
		c.moveTo(0, -16);
		c.lineTo(10, 12);
		c.lineTo(0, 6);
		c.lineTo(-10, 12);
		c.closePath();
		c.fill();
		c.fillStyle = "#e8eef8";
		c.fillRect(-2, -6, 4, 8);
		c.restore();
	}
	drawThrusters(c, x, y, ship) {
		const launching = this.launchT > 0;
		const phase = launching ? this.launchPhase() : "air";
		let power = 1;
		if (launching) {
			if (phase === "lock") power = 0.42;
			else if (phase === "3") power = 0.55;
			else if (phase === "2") power = 0.72;
			else if (phase === "1") power = 0.95;
			else if (phase === "ignite") power = 1.55;
			else if (phase === "shot") power = 1.7;
			else power = 1.12;
		}
		const flick = 0.82 + Math.sin(this.stageT * 56) * 0.12 + Math.sin(this.stageT * 101 + x) * 0.07;
		const long = phase === "ignite" || phase === "shot";
		const len = (11 + power * 10) * flick + (long ? 26 * (power - 0.4) : 0);
		const core = ship === "azure" ? "#e8fbff" : ship === "crimson" ? "#f2ffc8" : "#fff8dc";
		const mid = ship === "azure" ? "#5ce8ff" : ship === "crimson" ? "#9dff4a" : "#ffe08a";
		const glow = ship === "azure" ? "#1a88c8" : ship === "crimson" ? "#2a9a28" : "#c48a18";
		const tail = y + 14;
		c.save();
		if (long) {
			c.globalAlpha = 0.18 * power;
			c.fillStyle = mid;
			c.beginPath();
			c.ellipse(x, tail + len * 0.45, 16, len * 0.55, 0, 0, Math.PI * 2);
			c.fill();
		}
		for (const ox of [-5.8, 5.8]) {
			c.globalAlpha = 0.36 * Math.min(1, power);
			c.fillStyle = glow;
			c.beginPath();
			c.moveTo(x + ox - 5.2, tail);
			c.lineTo(x + ox + 5.2, tail);
			c.lineTo(x + ox + ox * 0.08, tail + len * 1.18);
			c.closePath();
			c.fill();
			c.globalAlpha = 0.94 * Math.min(1, power);
			c.fillStyle = mid;
			c.beginPath();
			c.moveTo(x + ox - 2.7, tail);
			c.lineTo(x + ox + 2.7, tail);
			c.lineTo(x + ox, tail + len);
			c.closePath();
			c.fill();
			c.globalAlpha = 1;
			c.fillStyle = core;
			c.beginPath();
			c.moveTo(x + ox - 1.2, tail - 1);
			c.lineTo(x + ox + 1.2, tail - 1);
			c.lineTo(x + ox, tail + len * 0.7);
			c.closePath();
			c.fill();
			c.fillStyle = "#fff";
			c.fillRect(x + ox - 0.7, tail, 1.4, 5.2 * Math.min(1.2, power));
		}
		c.restore();
	}
	drawCarrier(c) {
		if (this.bg > 700) return;
		const off = this.bg;
		c.save();
		c.imageSmoothingEnabled = false;
		for (let row = 2; row <= 40; row++) {
			const y = row * TILE + off;
			if (y < -28 || y > 672) continue;
			c.fillStyle = "#161b24";
			c.fillRect(144, y, 72, TILE);
			c.fillStyle = "#0e1218";
			c.fillRect(168, y, 2, TILE);
			c.fillRect(190, y, 2, TILE);
			if (row % 2 === 0) {
				c.fillStyle = "#f0c14a";
				c.fillRect(176, y + 2, 8, 9);
			}
			c.fillStyle = "#12161c";
			c.fillRect(44, y, 12, TILE);
			c.fillRect(304, y, 14, TILE);
			c.fillStyle = "#5a6570";
			c.fillRect(54, y, 3, TILE);
			c.fillRect(304, y, 3, TILE);
			if (row % 5 === 1) {
				c.fillStyle = "#cfd8e6";
				c.fillRect(150, y + 4, 10, 2);
				c.fillRect(200, y + 4, 10, 2);
			}
		}
		const phase = this.launchPhase();
		if (this.launchT > 0 && (phase === "lock" || phase === "3" || phase === "2" || phase === "1")) {
			c.fillStyle = "#9aa4b0";
			c.fillRect(this.px - 11, this.py + 17, 22, 7);
			c.fillStyle = "#3ec8ff";
			c.fillRect(this.px - 5, this.py + 18, 10, 5);
			c.fillStyle = "#f0c14a";
			c.fillRect(this.px - 2, this.py + 19, 4, 3);
		}
		this.drawCarrierIsland(c, 276, 122 + off);
		c.restore();
		this.drawLaunchSting(c);
	}
	drawCarrierIsland(c, ix, iy) {
		c.fillStyle = "#000";
		c.globalAlpha = 0.3;
		c.fillRect(ix - 60, iy + 46, 108, 26);
		c.globalAlpha = 1;
		c.fillStyle = "#1c222a";
		c.fillRect(ix - 58, iy - 18, 116, 102);
		c.fillStyle = "#353e48";
		c.fillRect(ix - 52, iy - 10, 104, 24);
		c.fillStyle = "#7fe8ff";
		for (let i = 0; i < 7; i++) c.fillRect(ix - 44 + i * 14, iy - 4, 8, 6);
		c.fillStyle = "#4a5560";
		c.fillRect(ix - 34, iy - 82, 66, 72);
		c.fillStyle = "#6a7380";
		c.fillRect(ix - 30, iy - 76, 58, 12);
		c.fillStyle = "#9aa4b0";
		for (let i = 0; i < 4; i++) c.fillRect(ix - 24 + i * 13, iy - 56, 8, 9);
		c.fillStyle = "#8a96a2";
		c.fillRect(ix - 20, iy - 132, 44, 52);
		c.fillStyle = "#d0d6de";
		c.fillRect(ix - 16, iy - 126, 36, 14);
		c.fillStyle = "#3ec8ff";
		c.globalAlpha = 0.78 + Math.sin(this.stageT * 7) * 0.22;
		c.fillRect(ix - 12, iy - 122, 10, 7);
		c.fillRect(ix + 4, iy - 122, 10, 7);
		c.globalAlpha = 1;
		c.fillStyle = "#e8eef8";
		c.fillRect(ix + 4, iy - 176, 5, 48);
		c.fillRect(ix - 10, iy - 156, 32, 3);
		c.beginPath();
		c.arc(ix + 6, iy - 182, 10, 0, Math.PI * 2);
		c.fill();
		c.fillStyle = "#3ec8ff";
		c.fillRect(ix + 3, iy - 184, 7, 4);
		c.fillStyle = "#f0c14a";
		c.fillRect(ix - 50, iy + 16, 18, 5);
		c.fillRect(ix + 22, iy + 16, 18, 5);
		c.fillStyle = "#12161c";
		c.fillRect(ix - 16, iy + 12, 30, 58);
		c.fillStyle = "#6a7380";
		c.fillRect(ix - 12, iy + 18, 22, 12);
		c.fillStyle = "#2a88d4";
		c.fillRect(ix - 8, iy + 22, 14, 4);
		if (this.launchT > 0) {
			c.fillStyle = "#070b14";
			c.fillRect(ix - 20, iy + 34, 40, 14);
			c.fillStyle = "#3a424c";
			c.fillRect(ix - 18, iy + 36, 36, 10);
			const fired = this.launchElapsed() >= L_FIRE;
			const mark = fired ? this.launchElapsed() - L_FIRE : L_FIRE - this.launchElapsed();
			c.fillStyle = fired ? "#3ec8ff" : "#ff7a2a";
			c.font = "bold 9px monospace";
			c.textAlign = "center";
			c.fillText(fmtLaunchClock(mark), ix, iy + 44);
			c.textAlign = "left";
		}
	}
	drawLaunchSting(c) {
		if (this.launchT <= 0) return;
		const elapsed = this.launchElapsed();
		const phase = launchPhaseOf(elapsed);
		const remain = launchPhaseRemain(elapsed);
		const age = launchPhaseAge(elapsed);
		const fired = elapsed >= L_FIRE;
		const clock = fired
			? `T-PLUS  ${fmtLaunchClock(elapsed - L_FIRE)}`
			: `T-MINUS ${fmtLaunchClock(L_FIRE - elapsed)}`;
		let label = "CATAPULT LOCK";
		let tone = "#f0c14a";
		let tag = "HOLD";
		if (phase === "3" || phase === "2" || phase === "1") {
			label = "COUNT";
			tag = "BEAT";
		} else if (phase === "ignite") {
			label = "IGNITE";
			tone = "#ff7a2a";
			tag = "BURN";
		} else if (phase === "shot") {
			label = "LAUNCH";
			tone = "#3ec8ff";
			tag = "SHOT";
		} else if (phase === "lift") {
			label = "AIRBORNE";
			tone = "#7fe8ff";
			tag = "LIFT";
		}
		c.save();
		c.textAlign = "center";
		c.fillStyle = "#070b14";
		c.globalAlpha = 0.7;
		c.fillRect(48, 126, 264, 56);
		c.globalAlpha = 1;
		c.strokeStyle = tone;
		c.lineWidth = 1;
		c.strokeRect(48.5, 126.5, 263, 55);
		c.font = "bold 13px monospace";
		c.fillStyle = tone;
		c.fillText(label, 180, 144);
		c.font = "bold 16px monospace";
		c.fillStyle = "#e8eef8";
		c.fillText(clock, 180, 162);
		c.font = "bold 10px monospace";
		c.fillStyle = tone;
		c.fillText(`${tag} ${remain.toFixed(2)}`, 180, 176);
		if (phase === "3" || phase === "2" || phase === "1") {
			const pop = age < 0.14 ? 1.28 - age * 2 : 1;
			c.save();
			c.translate(180, 368);
			c.scale(pop, pop);
			c.font = "bold 86px monospace";
			c.fillStyle = "#070b14";
			c.fillText(phase, 2, 2);
			c.fillStyle = age < 0.08 ? "#e8eef8" : "#f0c14a";
			c.fillText(phase, 0, 0);
			c.restore();
		}
		c.restore();
	}
	drawPlayer(c) {
		this.drawCraft(c, this.px, this.py, this.ship);
	}
	drawEmplacement(c, g) {
		c.save();
		c.translate(g.x, g.y - 6);
		if (g.kind === "radar") {
			c.strokeStyle = "#8ec8e4";
			c.globalAlpha = .35;
			c.beginPath();
			c.arc(0, 0, 12, 0, Math.PI * 2);
			c.stroke();
			c.globalAlpha = .9;
			c.rotate(this.stageT * 2.2);
			c.lineWidth = 2;
			c.beginPath();
			c.moveTo(0, 0);
			c.lineTo(13, -3);
			c.stroke();
			c.restore();
			return;
		}
		const ang = Math.atan2(this.py - g.y, this.px - g.x);
		c.rotate(ang - Math.PI / 2);
		c.fillStyle = "#d8dcd4";
		c.fillRect(-1.5, 0, 3, 14);
		if (g.t % 1 < .12) {
			c.globalAlpha = .9;
			c.fillStyle = "#ffe27a";
			c.beginPath();
			c.arc(0, 16, 4, 0, Math.PI * 2);
			c.fill();
		}
		c.restore();
	}
	paintUnitAnim(c, e, h) {
		const t = e.t;
		const air = e.kind === "wasp" || e.kind === "hornet" || e.kind === "lancejet" || e.kind === "gilded" || e.kind === "redtide";
		if (air) {
			const flick = .45 + .55 * Math.abs(Math.sin(t * 36));
			const hue = e.kind === "gilded" ? "#f0c14a" : e.kind === "redtide" ? "#ff5a48" : "#8ef0ff";
			c.globalAlpha = .4 + flick * .55;
			c.fillStyle = hue;
			const len = 5 + flick * 9;
			c.fillRect(-4, -h * .5 - len, 2, len);
			c.fillRect(2, -h * .5 - len * .75, 2, len * .75);
			c.globalAlpha = .25;
			c.fillStyle = "#fff6c8";
			c.fillRect(-3, -h * .5 - 3, 2, 3);
		} else if (e.kind === "heli") {
			c.save();
			c.globalAlpha = .45;
			c.strokeStyle = "#e4ece4";
			c.lineWidth = 1;
			c.beginPath();
			c.ellipse(0, -2, h * .62, h * .2, 0, 0, Math.PI * 2);
			c.stroke();
			c.rotate(t * 22);
			c.beginPath();
			c.moveTo(-h * .62, 0);
			c.lineTo(h * .62, 0);
			c.moveTo(0, -h * .2);
			c.lineTo(0, h * .2);
			c.stroke();
			c.restore();
		} else if (e.kind === "tank" || e.kind === "gunbarge" || e.kind === "strider") {
			const scroll = t * 36 % 6;
			c.globalAlpha = .7;
			c.fillStyle = "#14160f";
			for (let i = 0; i < 6; i++) {
				const y = -h * .32 + i * 6 - scroll;
				if (y > -h * .4 && y < h * .28) {
					c.fillRect(-h * .46, y, 5, 2);
					c.fillRect(h * .32, y, 5, 2);
				}
			}
			const ang = Math.atan2(this.py - e.y, this.px - e.x);
			c.save();
			c.globalAlpha = 1;
			c.rotate(ang - Math.PI / 2);
			c.fillStyle = "#e4e8dc";
			c.fillRect(-1.5, -2, 3, h * .42);
			c.restore();
		} else if (e.kind === "gunboat" || e.kind === "destroyer" || e.kind === "keel") {
			const w = 5 + Math.sin(t * 7) * 2;
			c.globalAlpha = .4;
			c.fillStyle = "#f7fdff";
			c.fillRect(-w, -h * .55, w * 2, 2);
			c.globalAlpha = .22;
			c.fillRect(-w * .55, -h * .72, w, 1);
		} else if (e.kind === "sub") {
			c.globalAlpha = .5;
			c.strokeStyle = "#dff6fb";
			c.beginPath();
			c.ellipse(0, 4, h * .32, 3 + Math.sin(t * 3), 0, 0, Math.PI * 2);
			c.stroke();
			c.fillStyle = "#f4fdff";
			c.globalAlpha = .7;
			const by = t * 18 % 14;
			c.fillRect(-5, -by, 2, 2);
			c.fillRect(4, -(by * .6), 1, 1);
		} else if (e.kind === "mine") {
			c.fillStyle = Math.sin(t * 9) > 0 ? "#ff4048" : "#5a2024";
			c.beginPath();
			c.arc(0, -2, 2.5, 0, Math.PI * 2);
			c.fill();
		} else if (e.kind === "eyepod") {
			c.rotate(t * 3);
			c.globalAlpha = .75;
			c.strokeStyle = "#7ee7ff";
			c.strokeRect(-h * .28, -2, h * .56, 4);
		}
		c.globalAlpha = 1;
	}
	drawEnemy(c, e) {
		const stealth = e.kind === "phantomwing" && e.tag <= 0 && e.flash <= 0;
		const ghost = e.kind === "phantomwing" && !stealth;
		c.save();
		if (stealth) c.globalAlpha = .16;
		else if (ghost) c.globalAlpha = .96;
		const im = this.sprites[e.kind];
		const seaUnit = e.kind === "sub" || e.kind === "keel" || e.kind === "destroyer" || e.kind === "gunboat";
		if (!e.ground && e.kind !== "mine") this.drawShadow(c, e.x, e.y, Math.max(11, e.r * .95), 5);
		else if (e.ground && !seaUnit) {
			c.save();
			c.globalAlpha = .22;
			c.fillStyle = "#000";
			c.beginPath();
			c.ellipse(e.x, e.y + 6, Math.max(8, e.r * .7), 3.2, 0, 0, Math.PI * 2);
			c.fill();
			c.restore();
		}
		const dy = seaUnit ? 8 : e.ground ? 4 : 0;
		if (im && im.complete && im.naturalWidth > 0) {
			c.save();
			c.translate(e.x, e.y + dy);
			const air = e.kind === "wasp" || e.kind === "hornet" || e.kind === "lancejet" || e.kind === "gilded" || e.kind === "redtide";
			if (air) c.rotate(Math.sin(e.t * 3.2 + e.x * .02) * .1);
			if (e.kind === "heli") c.translate(0, Math.sin(e.t * 7) * 1.8);
			if (e.kind === "mine") c.rotate(e.t * 1.6);
			if (e.kind === "sub") c.translate(0, Math.sin(e.t * 2.2) * 1.4);
			if (e.kind === "gyre" || e.kind === "arsenalgate") c.rotate(e.t * .9);
			if (e.kind === "crowncore" || e.kind === "skycathedral") c.rotate(e.t * .35);
			const h = e.r * (isBossKind(e.kind) ? 2.35 : 2.2);
			const w = im.naturalWidth / im.naturalHeight * h;
			if (e.ground || seaUnit) c.drawImage(im, -w / 2, -h + 4, w, h);
			else c.drawImage(im, -w / 2, -h / 2, w, h);
			if (!isBossKind(e.kind)) this.paintUnitAnim(c, e, h);
			c.restore();
		} else {
			c.save();
			c.translate(e.x, e.y);
			c.fillStyle = {
				wasp: "#ff9a3c",
				hornet: "#ff7a2a",
				gunbarge: "#3d6cff",
				gilded: "#f0c14a",
				eyepod: "#3ec8ff",
				redtide: "#ff3b4a",
				lancejet: "#6aa4ff",
				keel: "#3d9a9a",
				destroyer: "#9aa4b0",
				sub: "#2e6a72",
				gunboat: "#9aa4b0",
				strider: "#b06cff",
				aegis: "#cfd8e6",
				core: "#f0c14a",
				mine: "#e8c84a",
				spinner: "#ff3b4a",
				gyre: "#cfd8e6",
				redmaw: "#ff3b4a",
				solarmoth: "#f0c14a",
				harborking: "#6aa4ff",
				crowncore: "#3ec8ff",
				siegcrawler: "#7cb86a",
				phantomwing: "#8aa0b8",
				rootcitadel: "#4a8a32",
				dunehauler: "#ff3b4a",
				skypike: "#cfd8e6",
				silohydra: "#e8c84a",
				ironalbatross: "#8aa0b8",
				krakenkeel: "#3d9a9a",
				battlekeel: "#6aa4ff",
				arsenalgate: "#cfd8e6",
				skycathedral: "#3ec8ff"
			}[e.kind] || "#fff";
			if (e.kind === "gyre" || e.kind === "crowncore" || e.kind === "aegis" || e.kind === "eyepod" || e.kind === "arsenalgate" || e.kind === "skycathedral" || e.kind === "rootcitadel") {
				c.rotate(e.kind === "gyre" || e.kind === "arsenalgate" ? e.t : 0);
				c.beginPath();
				c.arc(0, 0, e.r, 0, Math.PI * 2);
				c.fill();
				c.fillStyle = "#070b14";
				c.beginPath();
				c.arc(0, 0, e.r * .4, 0, Math.PI * 2);
				c.fill();
			} else if (e.kind === "harborking" || e.kind === "battlekeel" || e.kind === "krakenkeel") c.fillRect(-e.r * .35, -e.r, e.r * .7, e.r * 2);
			else if (e.kind === "strider" || e.kind === "siegecrawler") {
				c.fillRect(-e.r * .5, -e.r, e.r, e.r * 1.6);
				c.fillRect(-e.r, e.r * .2, e.r * .45, e.r * .8);
				c.fillRect(e.r * .55, e.r * .2, e.r * .45, e.r * .8);
			} else {
				c.beginPath();
				c.moveTo(0, e.r);
				c.lineTo(e.r * .8, -e.r * .7);
				c.lineTo(0, -e.r * .3);
				c.lineTo(-e.r * .8, -e.r * .7);
				c.closePath();
				c.fill();
			}
			c.restore();
		}
		c.restore();
		if (ghost) {
			c.save();
			c.strokeStyle = "#cfd8e6";
			c.lineWidth = 1.6;
			c.globalAlpha = .85;
			c.beginPath();
			c.arc(e.x, e.y, e.r * 1.05, 0, Math.PI * 2);
			c.stroke();
			c.restore();
		}
		if (e.flash > 0) {
			c.globalAlpha = Math.min(.85, e.flash * 8);
			c.fillStyle = "#fff";
			c.beginPath();
			c.arc(e.x, e.y, e.r * .85, 0, Math.PI * 2);
			c.fill();
			c.globalAlpha = 1;
		}
		if (isBossKind(e.kind)) this.drawBossTells(c, e);
	}
	drawBossTells(c, e) {
		c.save();
		c.lineWidth = 1.6;
		if (e.kind === "siegecrawler") {
			c.fillStyle = "#f0c14a";
			c.beginPath();
			c.arc(e.x, e.y - e.r * .72, 4.2, 0, Math.PI * 2);
			c.fill();
			if (e.atk > .05) {
				c.strokeStyle = "#f0c14a";
				c.globalAlpha = .45 + (e.tell > 0 ? .35 : 0);
				c.setLineDash([4, 5]);
				c.beginPath();
				c.moveTo(e.x, e.y - 16);
				c.lineTo(e.x + Math.cos(e.atk) * 220, e.y - 16 + Math.sin(e.atk) * 220);
				c.stroke();
				c.setLineDash([]);
			}
		} else if (e.kind === "phantomwing") {
			if (e.tell > 0 || this.bossAtk === "GHOST GUNS") {
				c.strokeStyle = "#cfd8e6";
				c.globalAlpha = .35 + e.tell * .8;
				c.beginPath();
				c.arc(e.x - 34, e.y + 6, 10, 0, Math.PI * 2);
				c.arc(e.x + 34, e.y + 6, 10, 0, Math.PI * 2);
				c.stroke();
			}
		} else if (e.kind === "rootcitadel") {
			c.fillStyle = "#f0c14a";
			c.fillRect(e.x - 10, e.y - e.r * .78, 6, 5);
			c.fillRect(e.x + 4, e.y - e.r * .78, 6, 5);
			if (e.tell > 0) {
				c.strokeStyle = "#f0c14a";
				c.globalAlpha = .4;
				c.setLineDash([3, 4]);
				for (const ox of [
					-26,
					0,
					26
				]) {
					c.beginPath();
					c.moveTo(e.x + ox, e.y - 16);
					c.lineTo(e.x + ox, 592);
					c.stroke();
				}
				c.setLineDash([]);
			}
		} else if (e.kind === "dunehauler" || e.kind === "redmaw") {
			c.fillStyle = "#f0c14a";
			c.fillRect(e.x - e.r - 2, e.y + 4, 8, 10);
			c.fillRect(e.x + e.r - 6, e.y + 4, 8, 10);
			if (e.tag > .5) {
				const dir = e.vx >= 0 ? 1 : -1;
				c.fillStyle = "#ff7a90";
				c.globalAlpha = .7;
				c.beginPath();
				c.moveTo(e.x + dir * (e.r + 6), e.y);
				c.lineTo(e.x + dir * (e.r + 18), e.y + 8);
				c.lineTo(e.x + dir * (e.r + 6), e.y + 16);
				c.closePath();
				c.fill();
			}
		} else if (e.kind === "skypike") {
			if (e.tag > .5) {
				c.fillStyle = "#ffae42";
				c.globalAlpha = .85;
				c.beginPath();
				c.ellipse(e.x, e.y + e.r * .55, 10, 5, 0, 0, Math.PI * 2);
				c.fill();
			}
			if (e.tell > 0) {
				c.strokeStyle = "#ffae42";
				c.globalAlpha = .3 + .5 * Math.sin(e.t * 18);
				c.lineWidth = 2;
				c.setLineDash([5, 6]);
				c.beginPath();
				c.moveTo(e.x, e.y + e.r * .5);
				c.lineTo(e.x, 604);
				c.stroke();
				c.setLineDash([]);
			}
		} else if (e.kind === "silohydra") {
			const ox = (Math.floor(e.tag) % 3 - 1) * 16;
			c.strokeStyle = "#f0c14a";
			c.beginPath();
			c.arc(e.x + ox, e.y + 6, 6, 0, Math.PI * 2);
			c.stroke();
		} else if (e.kind === "ironalbatross") {
			c.fillStyle = "#f0c14a";
			c.beginPath();
			c.arc(e.x - 18, e.y + 4, 3.4, 0, Math.PI * 2);
			c.arc(e.x + 18, e.y + 4, 3.4, 0, Math.PI * 2);
			c.fill();
			if (e.tell > 0) {
				c.fillStyle = "#cfd8e6";
				c.globalAlpha = .45;
				c.fillRect(e.x - 28, e.y + 10, 56, 6);
			}
		} else if (e.kind === "krakenkeel") {
			c.fillStyle = "#f0c14a";
			if (e.phase === 0) c.fillRect(e.x - 2, e.y - e.r - 6, 4, 10);
			else c.fillRect(e.x - 6, e.y + 6, 12, 5);
			if (e.tell > 0 && e.phase >= 1) {
				c.strokeStyle = "#5ec8c8";
				c.globalAlpha = .4;
				c.beginPath();
				c.arc(e.x - 20, e.y + 8, 18, .2, 1.4);
				c.stroke();
				c.beginPath();
				c.arc(e.x + 20, e.y + 8, 18, 1.7, 2.9);
				c.stroke();
			}
		} else if (e.kind === "battlekeel" || e.kind === "harborking") {
			c.fillStyle = "#f0c14a";
			c.fillRect(e.x - 7, e.y + 6, 14, 5);
			if (e.tell > 0) {
				c.strokeStyle = "#6aa4ff";
				c.globalAlpha = .4;
				c.beginPath();
				c.moveTo(e.x - 22, e.y + 6);
				c.lineTo(e.x - 70, e.y + 90);
				c.moveTo(e.x + 22, e.y + 6);
				c.lineTo(e.x + 70, e.y + 90);
				c.stroke();
			}
		} else if (e.kind === "arsenalgate" || e.kind === "gyre") {
			c.fillStyle = "#f0c14a";
			c.beginPath();
			c.arc(e.x - e.r * .7, e.y, 3.6, 0, Math.PI * 2);
			c.arc(e.x + e.r * .7, e.y, 3.6, 0, Math.PI * 2);
			c.fill();
			if (e.atk > .05) {
				c.strokeStyle = "#9ad8ff";
				c.globalAlpha = .4;
				c.setLineDash([4, 5]);
				c.beginPath();
				c.moveTo(e.x - 26, e.y);
				c.lineTo(e.x - 26 + Math.cos(e.atk) * 180, e.y + Math.sin(e.atk) * 180);
				c.moveTo(e.x + 26, e.y);
				const a2 = Math.PI - e.atk;
				c.lineTo(e.x + 26 + Math.cos(a2) * 180, e.y + Math.sin(a2) * 180);
				c.stroke();
				c.setLineDash([]);
			}
		} else if ((e.kind === "skycathedral" || e.kind === "crowncore") && e.phase < 2) {
			const spin = e.t * (e.phase === 0 ? 1.05 : 1.45);
			const gap = e.phase === 0 ? .62 : .46;
			const rad = e.r * 1.28;
			c.strokeStyle = "#3ec8ff";
			c.lineWidth = 3.2;
			c.globalAlpha = .82;
			c.beginPath();
			c.arc(e.x, e.y, rad, spin + gap, spin + Math.PI * 2 - gap);
			c.stroke();
			c.strokeStyle = "#f0c14a";
			c.lineWidth = 2.4;
			c.globalAlpha = .95;
			c.beginPath();
			c.arc(e.x, e.y, rad, spin - gap, spin + gap);
			c.stroke();
		}
		c.restore();
	}
};
