export const BUYOUT = 1_000_000;

export function bountyOf(score: number) {
  return score * 10;
}

export function money(n: number) {
  return "$" + n.toLocaleString("en-US");
}

export type ShipId = "azure" | "crimson" | "iron";
export type DiffId = "easy" | "normal" | "hard";
export type CrewMode = "solo" | "duo" | "wingman";

export const DIFFS: Record<DiffId, { label: string; hp: number; dens: number; fire: number; spd: number; lives: number; line: string }> = {
  easy: { label: "EASY", hp: 0.7, dens: 0.72, fire: 0.75, spd: 0.82, lives: 1, line: "Training sorties. Extra life." },
  normal: { label: "NORMAL", hp: 1, dens: 1, fire: 1, spd: 1, lives: 0, line: "Contract standard." },
  hard: { label: "HARD", hp: 1.45, dens: 1.38, fire: 1.35, spd: 1.22, lives: -1, line: "Hollow Crown does not miss." },
};

export const CREW_MODES: Record<CrewMode, { label: string; line: string }> = {
  solo: { label: "1P", line: "Single Fang. WASD + arrows." },
  duo: { label: "2P", line: "P1 WASD · P2 arrows. Shared lives." },
  wingman: { label: "1P+CPU", line: "A CPU Fang flies your wing." },
};

export const PILOTS: Record<
  ShipId,
  {
    call: string;
    name: string;
    country: string;
    height: string;
    weight: string;
    plane: string;
    gun: string;
    line: string;
    bio: string;
    trait: string;
  }
> = {
  azure: {
    call: "AZURE FANG",
    name: "Rin Kaze",
    country: "Valen",
    height: "164 cm",
    weight: "48 kg",
    plane: "VESPER",
    gun: "20mm Fang Cannon",
    line: "Highest shot rate in the wing.",
    bio: "Vesper is excellent for aerial and ground attacks. Speed and bite. It can cut almost anything.",
    trait: "Fastest fire. Cannon ranks cheap.",
  },
  crimson: {
    call: "CRIMSON FANG",
    name: "Mack Hale",
    country: "U.S.A.",
    height: "183 cm",
    weight: "79 kg",
    plane: "TALON",
    gun: "20mm Fang Cannon",
    line: "Former navy. Unmatched in a dogfight.",
    bio: "Talon excels in aerial combat and has a wide range of attack. Special racks fire a thicker volley.",
    trait: "Wide shot. Extra special stock.",
  },
  iron: {
    call: "IRON FANG",
    name: "Greta Voss",
    country: "Nordmark",
    height: "176 cm",
    weight: "72 kg",
    plane: "ANVIL",
    gun: "Gatling Cannon",
    line: "Used to pull hostages out of Europe.",
    bio: "Anvil's forte is ground combat. A second 45° stream chews armor. Plate and shields weld cheaper.",
    trait: "45° ground stream. Slow. Hardest hit.",
  },
};

export const PORTRAITS: Record<ShipId, string> = {
  azure: "/sprites/portraits/rin-poster.png?v=3",
  crimson: "/sprites/portraits/mack-poster.png?v=3",
  iron: "/sprites/portraits/greta-poster.png?v=3",
};

export const CREW_PORTRAITS = {
  vale: "/sprites/portraits/vale.png",
  nash: "/sprites/portraits/nash.png",
};

export const CREW = {
  vale: {
    name: "Lt. Col. Soren Vale",
    role: "NEXO Legion",
    bio: "Commander of the wing. Briefings name the primary, the payout, and how the boss actually kills you.",
  },
  nash: {
    name: "Nash Kade",
    role: "Arms dealer",
    bio: "Two specials, a shield, a cell. Unused racks convert back to cash. Kits stay on the jet.",
  },
};

export const LORE = {
  tag: "Three years. One million. Or never go home.",
  dossier: [
    "Rin Kaze graduates Valen Flight Academy tomorrow. Engaged to Leo Mori. Passenger routes — not war. Wingmate Ren Sato gets her drunk in Port Valen. She wakes with a three-year NEXO contract she never signed. Ren takes her slot, and Leo's table.",
    "Mack Hale signed because he already knew the work. Greta Voss flies the iron ship — she used to pull hostages out of Europe. Lt. Col. Soren Vale posts the bounties. Nash Kade sells two specials and a shield. Unused racks convert back. What you spend on kits does not go to the buyout.",
  ],
};

export const MISSION_INTRO = {
  title: "MISSION ORDERS",
  body: "Ten sorties. Hollow Crown holds Thunderkeep. NEXO pays in bounty. One million buys the paper. Three years if you cannot.",
  luck: "Good luck. Come home.",
};

export const PILOT_INTRO: Record<ShipId, { welcome: string; luck: string }> = {
  azure: {
    welcome: "You never signed, Kaze. Ren is already in Crown paint. Fly the Vesper anyway.",
    luck: "Cut a hole in the sky and walk through it.",
  },
  crimson: {
    welcome: "Navy's gone, Hale. The work isn't. Keep Talon's nose on the money.",
    luck: "Don't miss. You never did.",
  },
  iron: {
    welcome: "You pulled people out of Europe, Voss. Pull this wing through Thunderkeep.",
    luck: "Bring the iron home. Weld later.",
  },
};

export const PILOT_ENDINGS: Record<
  ShipId,
  {
    thanks: string;
    served: { title: string; lines: string[] };
    bought: { title: string; lines: string[] };
    both: { title: string; lines: string[] };
  }
> = {
  azure: {
    thanks: "Thank you, valiant pilot. The Vesper still knows your hands.",
    served: {
      title: "PORT VALEN, THREE YEARS",
      lines: [
        "The paper burns on the tarmac. Thunderkeep is a rumor of smoke on the far horizon.",
        "Leo's table is empty. Mori Air will not take a merc. Rin files a passenger route under her own name.",
        "Ren does not write. She does not wait at the gate.",
      ],
    },
    bought: {
      title: "THE STAMP READS VOID",
      lines: [
        "A clerk in Port Valen inks VOID across the NEXO sheet. The million is real. Home is not.",
        "Mori Air still will not take a merc. Rin buys a used Vesper seat and a ticket that does not say Kaze.",
        "She flies passengers who never ask where the million came from.",
      ],
    },
    both: {
      title: "SHE HAD THE MILLION",
      lines: [
        "She could have walked. She flew Thunderkeep anyway.",
        "Ren goes down with the Crown. The Vesper comes home with a hole in the left wing.",
        "Home is a choice she already made. Leo can keep the table.",
      ],
    },
  },
  crimson: {
    thanks: "Thank you, valiant pilot. The Talon does not know how to land for good.",
    served: {
      title: "A DOCK BAR, NO LETTER",
      lines: [
        "Ten sorties. Mack drinks the last bounty in a port that does not put his name on the board.",
        "He does not write the letter. The Talon sleeps with the canopy cracked.",
        "Navy's gone. The work, somehow, is not.",
      ],
    },
    bought: {
      title: "A CANVAS BAG",
      lines: [
        "A million in a bag that still smells like cordite. The clerk stamps VOID.",
        "Mack still flies for anyone who pays. The Talon does not know how to land for good.",
        "He laughs once, then files the next contract under a different name.",
      ],
    },
    both: {
      title: "HE COULD HAVE WALKED",
      lines: [
        "He had the million. He flew Thunderkeep anyway.",
        "Crown wreckage on the canopy. He laughs once.",
        "The Talon gets a new paint job. Nobody asks why.",
      ],
    },
  },
  iron: {
    thanks: "Thank you, valiant pilot. Nordmark winter will wait.",
    served: {
      title: "THE TRANSPONDER COMES OFF",
      lines: [
        "Greta welds the transponder off the Anvil in a yard that does not take NEXO script.",
        "She walks into Nordmark winter. Hostages she saved send a bottle. She does not open it.",
        "The iron ship rusts honest.",
      ],
    },
    bought: {
      title: "A RAIL OUT",
      lines: [
        "She buys the contract. Sells the extra plate. Funds a rail out of a border town.",
        "The Anvil stays in a hangar with no name on the door.",
        "She does not look up when the trains pass Thunderkeep's wreck.",
      ],
    },
    both: {
      title: "MILLION IN THE HOLD",
      lines: [
        "Million in the hold. Cathedral on fire.",
        "She files the buyout and the after-action in the same hour.",
        "Nordmark gets her back with both hands clean. The Anvil keeps the holes.",
      ],
    },
  },
};

export type ShopId =
  | "cannon"
  | "drone"
  | "plate"
  | "cell"
  | "shield"
  | "wisp"
  | "raven"
  | "fork"
  | "sunfire"
  | "trident"
  | "spike"
  | "starburst"
  | "sidegun"
  | "ring"
  | "heavy";

export type ShopCat = "kit" | "special" | "support";
export type ShopRole = "air" | "ground" | "normal" | "secret" | "support" | "kit";

export type ShopItem = {
  id: ShopId;
  name: string;
  desc: string;
  price: number;
  max: number;
  cat: ShopCat;
  role: ShopRole;
  ammo: number;
  ships?: ShipId[];
};

export const SHOP: ShopItem[] = [
  { id: "wisp", name: "WISP LOCK", desc: "Anti-air. Locks and chases.", price: 15000, max: 1, cat: "special", role: "air", ammo: 24 },
  { id: "raven", name: "RAVEN", desc: "Anti-air. Fat seekers.", price: 20000, max: 1, cat: "special", role: "air", ammo: 16 },
  { id: "fork", name: "FORK BEAM", desc: "Secret. Three-way laser.", price: 28000, max: 1, cat: "special", role: "secret", ammo: 20 },
  { id: "sunfire", name: "SUNFIRE", desc: "Anti-ground. Razing blast.", price: 18000, max: 1, cat: "special", role: "ground", ammo: 12 },
  { id: "trident", name: "TRIDENT", desc: "Normal. Three wide missiles.", price: 12000, max: 1, cat: "special", role: "normal", ammo: 22 },
  { id: "spike", name: "SPIKE", desc: "Normal. Armor-piercing bolt.", price: 16000, max: 1, cat: "special", role: "normal", ammo: 18 },
  { id: "starburst", name: "STAR BURST", desc: "Normal. 16-way dump. Talon only.", price: 22000, max: 1, cat: "special", role: "normal", ammo: 10, ships: ["crimson"] },
  { id: "sidegun", name: "SIDE GUN", desc: "Anti-ground pod. Talon only.", price: 16000, max: 1, cat: "special", role: "ground", ammo: 28, ships: ["crimson"] },
  { id: "ring", name: "RING LANCE", desc: "Normal. Circular laser. Talon & Anvil.", price: 24000, max: 1, cat: "special", role: "normal", ammo: 8, ships: ["crimson", "iron"] },
  { id: "heavy", name: "HEAVY BOY", desc: "Anti-ground. Clears the screen. Anvil only.", price: 25000, max: 1, cat: "special", role: "ground", ammo: 4, ships: ["iron"] },
  { id: "cell", name: "CELL TANK", desc: "Support. Extra bomb cell this sortie.", price: 10000, max: 1, cat: "support", role: "support", ammo: 0 },
  { id: "shield", name: "SHIELD", desc: "Support. 3 hits. Mk.II is 5.", price: 15000, max: 2, cat: "support", role: "support", ammo: 0 },
  { id: "cannon", name: "FANG CANNON", desc: "Kit. Permanent shot rank +1.", price: 14000, max: 3, cat: "kit", role: "kit", ammo: 0 },
  { id: "drone", name: "DRONE BAY", desc: "Kit. One more Fang drone.", price: 16000, max: 2, cat: "kit", role: "kit", ammo: 0 },
  { id: "plate", name: "PLATE KIT", desc: "Kit. +1 life. Greta welds it cheaper.", price: 26000, max: 2, cat: "kit", role: "kit", ammo: 0 },
];

export function canEquip(item: ShopItem, ship: ShipId) {
  return !item.ships || item.ships.includes(ship);
}

export function specialCap(ship: ShipId) {
  return ship === "crimson" ? 3 : 2;
}

export function specialCount(loadout: Loadout) {
  return SHOP.filter((s) => s.cat === "special" && loadout[s.id] > 0).length;
}

export function shopPrice(item: ShopItem, ship: ShipId, owned: number) {
  let p = item.cat === "kit" || item.id === "shield" ? item.price * (owned + 1) : item.price;
  if (item.id === "cannon" && ship === "azure") p = Math.floor(p * 0.55);
  if (item.id === "plate" && ship === "iron") p = Math.floor(p * 0.6);
  if (item.id === "shield" && ship === "iron") p = Math.floor(p * 0.7);
  if (item.cat === "special" && ship === "crimson") p = Math.floor(p * 0.85);
  return p;
}

export function ammoMul(ship: ShipId) {
  return ship === "crimson" ? 1.6 : 1;
}

export type Loadout = Record<ShopId, number>;

export function emptyLoadout(): Loadout {
  return {
    cannon: 0,
    drone: 0,
    plate: 0,
    cell: 0,
    shield: 0,
    wisp: 0,
    raven: 0,
    fork: 0,
    sunfire: 0,
    trident: 0,
    spike: 0,
    starburst: 0,
    sidegun: 0,
    ring: 0,
    heavy: 0,
  };
}

export function emptyAmmo(): Loadout {
  return emptyLoadout();
}

export const BRIEFS: { title: string; target: string; weak: string; payout: string }[] = [
  {
    title: "Forward Base",
    target: "Catapult lock, T-minus 2.54, then burn the Siege Crawler chewing the perimeter.",
    weak: "The radar mast is the weak point. Dodge the volleys and burn the dish, not the hull.",
    payout: "Primary: SIEGE CRAWLER",
  },
  {
    title: "Storm Front",
    target: "The target is Phantom Wing, a stealthed escort in stolen Mori Air paint.",
    weak: "It only silhouettes when it fires. Hold fire until the afterburner blooms, then dump Wisp Lock.",
    payout: "Primary: PHANTOM WING",
  },
  {
    title: "Canopy",
    target: "The target is Root Citadel, a forest fortress under the canopy.",
    weak: "The generator vents on the roof. Stay above the AA and punch the vents.",
    payout: "Primary: ROOT CITADEL",
  },
  {
    title: "Dune Road",
    target: "The target is Dune Hauler, a ground carrier running the salt flats.",
    weak: "The tractor treads. Cut them and the deck guns lose their angle.",
    payout: "Primary: DUNE HAULER",
  },
  {
    title: "Rift",
    target: "The target is Sky Pike, a VTOL bomber using the canyon as a trench.",
    weak: "The belly bay. When it climbs to dump, the bay doors are open — that is your window.",
    payout: "Primary: SKY PIKE",
  },
  {
    title: "Karst",
    target: "The target is Silo Hydra, a buried launcher farm.",
    weak: "Each silo lid. Close them in order or the volley will stack.",
    payout: "Primary: SILO HYDRA",
  },
  {
    title: "Cloud Deck",
    target: "The target is Iron Albatross, a giant bomber riding the cloud deck.",
    weak: "The inboard engines. Two dead and it cannot hold altitude.",
    payout: "Primary: IRON ALBATROSS",
  },
  {
    title: "Black Tide",
    target: "Two targets. First the sub Kraken Keel. Then the battleship Battlekeel.",
    weak: "The sub's snorkel, then the battleship's magazine hatches amidships. Sink both.",
    payout: "Primary: KRAKEN KEEL, then BATTLEKEEL",
  },
  {
    title: "Thunderkeep Yard",
    target: "The target is Arsenal Gate, the yard door on Thunderkeep.",
    weak: "The hinge guns. Knock them and the gate cannot close on you.",
    payout: "Primary: ARSENAL GATE",
  },
  {
    title: "Thunderkeep",
    target: "The target is Sky Cathedral, Hollow Crown's airborne fortress.",
    weak: "The core behind the rotating shields. Break the ring, then the heart. No third door.",
    payout: "Primary: SKY CATHEDRAL",
  },
];

export const ENDINGS = {
  bought: {
    title: "CONTRACT BOUGHT",
    line: "The clerk stamps VOID. Mori Air still will not take a merc. The sky, at least, is yours.",
  },
  served: {
    title: "TERM SERVED",
    line: "Ten sorties. The paper burns. Thunderkeep is silent. Leo is waiting — or he isn't.",
  },
  both: {
    title: "YOU STAYED",
    line: "You had the million. You flew Thunderkeep anyway. Ren goes down with the Crown. Home is a choice you already made.",
  },
  mia: {
    title: "MIA",
    line: "The contract stays open. Greta kills the transponder. Mack does not write the letter.",
  },
  desert: {
    title: "NO HOME RUNWAY",
    line: "Valen radar paints you hostile. Desertion is treason. There is no Mori Air gate that will open.",
  },
} as const;

export type Ending = keyof typeof ENDINGS;
