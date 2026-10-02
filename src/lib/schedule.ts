import type { RealPlace } from "./places.functions";

export type Stop = { start: number; end: number; travel: number; place: RealPlace; meal: "comida" | "cena" | "desayuno" | "cafe" | null; night?: boolean };

const FOOD_RE = /restaurant|cafe|coffee|bakery|food|meal|ice_cream|diner|steak|pizza|sandwich|deli|brunch|tea_house|confectioner|dessert/;
const NIGHT_RE = /bar|pub|night_club|wine|brewery|cocktail|lounge|karaoke|live_music/;
const OUTDOOR_RE = /park|garden|plaza|square|viewpoint|observation|monument|historical|landmark|beach|hiking|national_park|lake|bridge|fountain|castle|ruins|natural_feature|scenic/;
const BAD_RE = /lodging|hotel|hostel|store|shop|mall|locality|political|route|travel_agency|tour_agency|car_rental|bus_station|transit|parking|atm|bank|gas_station|real_estate|corporate|school|university|hospital|pharmacy|gym|spa/;

export const isFood = (p: RealPlace) => FOOD_RE.test(p.kind ?? "");
export const isNight = (p: RealPlace) => NIGHT_RE.test(p.kind ?? "");

/** A real, specific activity: not a restaurant/bar/hotel/shop and with enough Google reviews. */
const ACTIVITY_RE = /museum|gallery|park|garden|plaza|square|monument|historical|landmark|church|cathedral|place_of_worship|basilica|monastery|mosque|temple|synagogue|castle|palace|fortress|viewpoint|observation|scenic|beach|hiking|national_park|nature|zoo|aquarium|amusement|theater|tourist_attraction|cultural|market|bridge|fountain|lake|winery|archaeological|ruins|sculpture|botanical|wildlife|marina|planetarium|visitor_center|adventure|water_park|ski|cave|waterfall|stadium|bowling|casino|go_kart|sports|campground|ecotour|climbing|zipline|surf|diving|event_venue|concert|night_club/;

export function isActivity(p: RealPlace) {
  const k = p.kind ?? "";
  if (FOOD_RE.test(k) || (NIGHT_RE.test(k) && !/night_club/.test(k)) || BAD_RE.test(k)) return false;
  if (/hostal|hotel|casa rural|apartamento|asociaci/i.test(p.name)) return false;
  if (!k) return (p.reviews ?? 0) >= 200;
  return ACTIVITY_RE.test(k) && (p.reviews ?? 0) >= 30;
}

export type VibeId = "naturaleza" | "cultura" | "gastro" | "playa" | "fiesta";
/** Place types that fit each vibe (used on top of the vibe searches). */
const VIBE_KIND: Record<VibeId, RegExp> = {
  naturaleza: /national_park|hiking|nature|waterfall|lake|viewpoint|botanical|garden|scenic|natural_feature|cave|wildlife|campground|ecotour|park|observation/,
  cultura: /museum|gallery|historical|monument|church|cathedral|place_of_worship|basilica|monastery|castle|palace|fortress|archaeological|ruins|cultural|theater|landmark|plaza|square|sculpture/,
  gastro: /market|winery|food|restaurant|cafe|bakery/,
  playa: /beach|water_park|adventure|amusement|marina|aquarium|hiking|national_park|ski|waterfall|surf|diving|zipline|climbing|ecotour|lake/,
  fiesta: /amusement|water_park|night_club|stadium|bowling|casino|go_kart|sports|theater|event_venue|concert|live_music|karaoke|zoo|aquarium/,
};
export const fitsVibe = (p: RealPlace, v: VibeId) => !!p.vibe || VIBE_KIND[v].test(p.kind ?? "");

/** Realistic visit length (minutes) by place type. */
export function visitMinutes(p: RealPlace, meal: boolean): number {
  if (meal) return 90;
  const k = p.kind ?? "";
  if (/amusement|water_park|zoo|national_park|hiking|ski/.test(k)) return 180;
  if (/beach/.test(k)) return 150;
  if (/museum|aquarium|castle|fortress|alcazar|archaeological|ruins|palace/.test(k)) return 120;
  if (/park|garden|botanical|lake|market/.test(k)) return 90;
  if (NIGHT_RE.test(k)) return 90;
  if (/art_gallery|cultural|theater|winery/.test(k)) return 90;
  if (/church|cathedral|place_of_worship|mosque|temple|synagogue/.test(k)) return 60;
  if (/plaza|square|monument|viewpoint|observation|fountain|bridge/.test(k)) return 60;
  return 75;
}

function km(a: { lat: number | null; lng: number | null }, b: { lat: number | null; lng: number | null }) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 3;
  const R = 6371, t = Math.PI / 180;
  const x = (b.lat - a.lat) * t, y = (b.lng - a.lng) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Walking under 1.2 km; otherwise ~25 km/h in town plus 10 min of parking/waiting. Rounded to 5 min. */
export function travelMinutes(a: { lat: number | null; lng: number | null } | null, b: { lat: number | null; lng: number | null }) {
  if (!a) return 0;
  const d = km(a, b) * 1.3; // road factor
  const m = d < 1.2 ? (d / 4.5) * 60 : (d / 25) * 60 + 10;
  return Math.max(5, Math.ceil(m / 5) * 5);
}

/**
 * Whole [from, to] window open on that weekday (0 = Sunday).
 * Unknown hours: outdoor places are treated as open 07–21, anything else 10–18.
 */
export function isOpen(p: RealPlace, day: number, from: number, to: number) {
  if (!p.hours || p.hours.length === 0) {
    const [o, c] = OUTDOOR_RE.test(p.kind ?? "") ? [7 * 60, 21 * 60] : [10 * 60, 18 * 60];
    return from >= o && to <= c;
  }
  return p.hours.some((h) => {
    if (!h.close) return true; // open 24 h
    if (h.open.day !== day) return false;
    const o = h.open.hour * 60 + h.open.minute;
    let c = h.close.hour * 60 + h.close.minute;
    if (h.close.day !== h.open.day || c <= o) c += 24 * 60;
    return from >= o && to <= c;
  });
}

export const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const up15 = (m: number) => Math.ceil(m / 15) * 15;

type Pools = { spots: RealPlace[]; food: RealPlace[]; night: RealPlace[] };

/**
 * One well-paced day built around the traveler's vibe. Activities that fit the vibe
 * always win; generic sights only fill gaps. Each stop is open for the whole visit,
 * close to the previous one, and travel time is included.
 *   naturaleza: early start, long outdoor visits, no bars at night
 *   cultura:    museums/monuments morning and afternoon, optional drink
 *   gastro:     breakfast, market, lunch, café/dessert, dinner, drink
 *   playa:      beach/adventure all day, dinner, optional drink
 *   fiesta:     fun activities from late morning, dinner, 2 nightlife stops until late
 */
export function planDay(pools: Pools, used: Set<string>, weekday: number, center: { lat: number; lng: number }, vibe: VibeId = "cultura"): Stop[] {
  const acts = pools.spots.filter(isActivity);
  const vAct = acts.filter((p) => fitsVibe(p, vibe));
  const gAct = vibe === "naturaleza" || vibe === "playa" || vibe === "fiesta" ? acts.filter((p) => !fitsVibe(p, vibe) && OUTDOOR_RE.test(p.kind ?? "")) : acts.filter((p) => !fitsVibe(p, vibe));
  const food = pools.food.filter((p) => isFood(p) || !p.kind);
  const cafes = food.filter((p) => /cafe|coffee|bakery|dessert|ice_cream|confectioner|tea_house/.test(p.kind ?? ""));
  const meals = food.filter((p) => !cafes.includes(p));
  const night = [...pools.night, ...pools.food, ...pools.spots].filter((p) => isNight(p) && !/restaurant/.test(p.kind ?? "") && !/restaurante|hostal|hotel|pensionista/i.test(p.name));
  const stops: Stop[] = [];
  let t = vibe === "naturaleza" || vibe === "playa" ? 9 * 60 : vibe === "fiesta" ? 10 * 60 + 30 : 9 * 60 + 30;
  let prev: { lat: number | null; lng: number | null } | null = null;

  type Opts = { meal: boolean; earliest?: number; latestStart?: number; latestEnd: number; mins?: number };
  const pick = (pool: RealPlace[], opts: Opts) => {
    let best: { p: RealPlace; travel: number; start: number; end: number; score: number } | null = null;
    const anchor = prev ?? center;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const travel = prev ? travelMinutes(prev, p) : 0;
      if (travel > 45) continue;
      const start = up15(Math.max(t + travel, opts.earliest ?? 0));
      if (opts.latestStart != null && start > opts.latestStart) continue;
      const end = start + (opts.mins ?? visitMinutes(p, opts.meal));
      if (end > opts.latestEnd) continue;
      if (!isOpen(p, weekday, start, end)) continue;
      const dist = km(anchor, p);
      const quality = (p.rating ?? 3.8) * 6 + Math.log10((p.reviews ?? 10) + 1) * 4 + (p.photo ? 3 : 0) + (fitsVibe(p, vibe) ? 6 : 0);
      const score = quality - dist * (prev ? 4 : 1) - (start - t) / 15;
      if (!best || score > best.score) best = { p, travel, start, end, score };
    }
    return best;
  };
  // Vibe pool first; generic pool only when nothing fitting is available.
  const choose = (pools2: RealPlace[][], opts: Opts) => {
    for (const pl of pools2) { const b = pick(pl, opts); if (b) return b; }
    return null;
  };
  const add = (b: NonNullable<ReturnType<typeof pick>>, meal: Stop["meal"], isN = false) => {
    used.add(b.p.id);
    stops.push({ start: b.start, end: b.end, travel: b.travel, place: b.p, meal, night: isN });
    t = b.end;
    prev = b.p;
  };
  const actPools = [vAct, gAct];
  const block = (n: number, latestStart: number, latestEnd: number) => {
    for (let i = 0; i < n; i++) { const b = choose(actPools, { meal: false, latestStart, latestEnd }); if (b) add(b, null); }
  };

  if (vibe === "gastro") {
    const bf = choose([cafes, meals], { meal: true, mins: 60, earliest: 9 * 60, latestStart: 10 * 60 + 30, latestEnd: 11 * 60 + 30 });
    if (bf) add(bf, "desayuno");
    block(vibe === "gastro" ? 2 : 3, 12 * 60 + 30, 14 * 60);
  } else {
    block(3, 12 * 60 + 45, 14 * 60 + (vibe === "naturaleza" || vibe === "playa" ? 30 : 0));
  }
  const lunch = choose([meals.filter((p) => fitsVibe(p, vibe)), meals], { meal: true, earliest: 13 * 60 + 30, latestStart: 15 * 60, latestEnd: 16 * 60 + 30 });
  if (lunch) add(lunch, "comida");
  else t = Math.max(t, 15 * 60);

  if (vibe === "gastro") {
    block(1, 17 * 60, 18 * 60 + 30);
    const cafe = choose([cafes], { meal: true, mins: 60, earliest: 17 * 60, latestStart: 19 * 60, latestEnd: 20 * 60 });
    if (cafe) add(cafe, "cafe");
    block(1, 18 * 60 + 30, 20 * 60);
  } else {
    block(3, 18 * 60 + 30, 20 * 60);
  }
  const dinner = choose([meals.filter((p) => fitsVibe(p, vibe)), meals], { meal: true, earliest: 19 * 60 + 30, latestStart: 21 * 60, latestEnd: 22 * 60 + 30 });
  if (dinner) add(dinner, "cena");

  if (dinner && vibe !== "naturaleza") {
    const late = vibe === "fiesta";
    const n1 = choose([night], { meal: false, earliest: 21 * 60, latestStart: 22 * 60 + 30, latestEnd: late ? 25 * 60 : 23 * 60 + 30, mins: late ? 120 : 90 });
    if (n1) add(n1, null, true);
    if (late && n1) {
      const clubs = night.filter((p) => /night_club/.test(p.kind ?? ""));
      const n2 = choose([clubs, night], { meal: false, earliest: t, latestStart: 25 * 60, latestEnd: 27 * 60, mins: 150 });
      if (n2) add(n2, null, true);
    }
  }
  if (!stops.some((s) => !s.meal && !s.night)) {
    stops.forEach((s) => used.delete(s.place.id));
    return [];
  }
  return stops;
}
