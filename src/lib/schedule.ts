import type { RealPlace } from "./places.functions";

export type Stop = { start: number; end: number; travel: number; place: RealPlace; meal: "comida" | "cena" | null; night?: boolean };

const FOOD_RE = /restaurant|cafe|coffee|bakery|food|meal|ice_cream|diner|steak|pizza|sandwich|deli|brunch|tea_house|confectioner|dessert/;
const NIGHT_RE = /bar|pub|night_club|wine|brewery|cocktail|lounge|karaoke|live_music/;
const OUTDOOR_RE = /park|garden|plaza|square|viewpoint|observation|monument|historical|landmark|beach|hiking|national_park|lake|bridge|fountain|castle|ruins|natural_feature|scenic/;
const BAD_RE = /lodging|hotel|hostel|store|shop|mall|locality|political|route|travel_agency|tour_agency|car_rental|bus_station|transit|parking|atm|bank|gas_station|real_estate|corporate|school|university|hospital|pharmacy|gym|spa/;

export const isFood = (p: RealPlace) => FOOD_RE.test(p.kind ?? "");
export const isNight = (p: RealPlace) => NIGHT_RE.test(p.kind ?? "");

/** A real, specific activity: not a restaurant/bar/hotel/shop and with enough Google reviews. */
const ACTIVITY_RE = /museum|gallery|park|garden|plaza|square|monument|historical|landmark|church|cathedral|place_of_worship|basilica|monastery|mosque|temple|synagogue|castle|palace|fortress|viewpoint|observation|scenic|beach|hiking|national_park|nature|zoo|aquarium|amusement|theater|tourist_attraction|cultural|market|bridge|fountain|lake|winery|archaeological|ruins|sculpture|botanical|wildlife|marina|planetarium|visitor_center|adventure|water_park|ski|cave|waterfall/;

export function isActivity(p: RealPlace) {
  const k = p.kind ?? "";
  if (FOOD_RE.test(k) || NIGHT_RE.test(k) || BAD_RE.test(k)) return false;
  if (/hostal|hotel|casa rural|apartamento|asociaci/i.test(p.name)) return false;
  if (!k) return (p.reviews ?? 0) >= 200;
  return ACTIVITY_RE.test(k) && (p.reviews ?? 0) >= 30;
}

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

export const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const up15 = (m: number) => Math.ceil(m / 15) * 15;

type Pools = { spots: RealPlace[]; food: RealPlace[]; night: RealPlace[] };

/**
 * One well-paced day (≈ 5–6 stops), 09:30 → ~22:00:
 *   morning: 2 activities · lunch 13:30–15:00 · afternoon: 2 activities
 *   dinner ~20:00 · optional evening bar/terrace until ~22:00
 * Each stop is the best nearby place that is open for the whole visit,
 * so the day stays geographically clustered and travel time is included.
 */
export function planDay(pools: Pools, used: Set<string>, weekday: number, center: { lat: number; lng: number }): Stop[] {
  const spots = pools.spots.filter(isActivity);
  const food = pools.food.filter((p) => isFood(p) || !p.kind);
  const night = [...pools.night, ...pools.food].filter((p) => isNight(p) && !/restaurant/.test(p.kind ?? "") && !/restaurante|hostal|hotel|pensionista/i.test(p.name));
  const stops: Stop[] = [];
  let t = 9 * 60 + 30;
  let prev: { lat: number | null; lng: number | null } | null = null;

  const choose = (pool: RealPlace[], opts: { meal: boolean; earliest?: number; latestStart?: number; latestEnd: number }) => {
    let best: { p: RealPlace; travel: number; start: number; end: number; score: number } | null = null;
    const anchor = prev ?? center;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const travel = prev ? travelMinutes(prev, p) : 0;
      if (travel > 45) continue;
      const start = up15(Math.max(t + travel, opts.earliest ?? 0));
      if (opts.latestStart != null && start > opts.latestStart) continue;
      const end = start + visitMinutes(p, opts.meal);
      if (end > opts.latestEnd) continue;
      if (!isOpen(p, weekday, start, end)) continue;
      const dist = km(anchor, p);
      const quality = (p.rating ?? 3.8) * 6 + Math.log10((p.reviews ?? 10) + 1) * 4 + (p.photo ? 3 : 0);
      const score = quality - dist * (prev ? 4 : 1) - (start - t) / 15;
      if (!best || score > best.score) best = { p, travel, start, end, score };
    }
    return best;
  };
  const add = (b: NonNullable<ReturnType<typeof choose>>, meal: Stop["meal"], isN = false) => {
    used.add(b.p.id);
    stops.push({ start: b.start, end: b.end, travel: b.travel, place: b.p, meal, night: isN });
    t = b.end;
    prev = b.p;
  };

  // Morning: 2–3 activities, must finish by 14:00.
  for (let i = 0; i < 3; i++) {
    const b = choose(spots, { meal: false, latestEnd: 14 * 60, latestStart: 12 * 60 + 45 });
    if (b) add(b, null);
  }
  // Lunch.
  const lunch = choose(food, { meal: true, earliest: 13 * 60 + 30, latestStart: 15 * 60, latestEnd: 16 * 60 + 30 });
  if (lunch) add(lunch, "comida");
  else t = Math.max(t, 15 * 60);
  // Afternoon: 2–3 activities, must finish by 20:00.
  for (let i = 0; i < 3; i++) {
    const b = choose(spots, { meal: false, latestEnd: 20 * 60, latestStart: 18 * 60 + 30 });
    if (b) add(b, null);
  }
  // Dinner.
  const dinner = choose(food, { meal: true, earliest: 19 * 60 + 30, latestStart: 21 * 60, latestEnd: 22 * 60 + 30 });
  if (dinner) add(dinner, "cena");
  // Evening drink only if something nearby is open until the visit ends.
  if (dinner && t <= 21 * 60 + 30) {
    const n = choose(night, { meal: false, earliest: 21 * 60, latestStart: 22 * 60, latestEnd: 23 * 60 + 30 });
    if (n) add(n, null, true);
  }
  // A day without real activities is just meals: drop it rather than pad it.
  if (!stops.some((s) => !s.meal && !s.night)) {
    stops.forEach((s) => used.delete(s.place.id));
    return [];
  }
  return stops;
}
