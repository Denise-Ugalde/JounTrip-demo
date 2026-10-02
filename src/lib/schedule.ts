import type { RealPlace } from "./places.functions";

export type Stop = { start: number; end: number; travel: number; place: RealPlace; meal: "comida" | "cena" | null };

const DAY_START = 9 * 60;
const DAY_END = 22 * 60;

/** Estimated visit length (minutes) by Google place type. */
export function visitMinutes(p: RealPlace, meal: boolean): number {
  if (meal) return 90;
  const k = p.kind ?? "";
  if (/museum|art_gallery|zoo|aquarium|amusement|water_park/.test(k)) return 120;
  if (/national_park|hiking|beach|park|garden/.test(k)) return 90;
  if (/bar|night_club|pub|wine|cocktail/.test(k)) return 90;
  if (/church|monument|plaza|historical|landmark|viewpoint|observation/.test(k)) return 45;
  return 75;
}

function km(a: RealPlace, b: { lat: number | null; lng: number | null }) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 2;
  const R = 6371, t = Math.PI / 180;
  const x = (b.lat - a.lat) * t, y = (b.lng - a.lng) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Travel minutes: walking under 1.2 km, otherwise ~25 km/h in town plus 10 min parking/waiting. */
export function travelMinutes(a: RealPlace | null, b: RealPlace | { lat: number; lng: number }) {
  if (!a) return 0;
  const d = km(a, b as RealPlace);
  const m = d < 1.2 ? (d / 4.5) * 60 : (d / 25) * 60 + 10;
  return Math.max(5, Math.ceil(m / 5) * 5);
}

/** True when the place is open for the whole [from, to] window on that weekday (0 = Sunday). Unknown hours count as open. */
export function isOpen(p: RealPlace, day: number, from: number, to: number) {
  if (!p.hours || p.hours.length === 0) return true;
  return p.hours.some((h) => {
    if (!h.close) return true; // 24 h
    if (h.open.day !== day) return false;
    const o = h.open.hour * 60 + h.open.minute;
    let c = h.close.hour * 60 + h.close.minute;
    if (h.close.day !== h.open.day) c += 24 * 60;
    return from >= o && to <= c;
  });
}

export const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Builds one day from 09:00 to ~22:00: sights, lunch (13:30–15:30), more sights,
 * dinner (19:30–21:00) and an evening spot, choosing the nearest place that is
 * open for the whole visit, accounting for travel time between stops.
 */
export function planDay(
  pools: { spots: RealPlace[]; food: RealPlace[]; night: RealPlace[] },
  used: Set<string>,
  weekday: number,
  center: { lat: number; lng: number },
): Stop[] {
  const stops: Stop[] = [];
  let t = DAY_START;
  let prev: RealPlace | null = null;
  let lunch = false, dinner = false;

  const pick = (pool: RealPlace[], meal: boolean) => {
    let best: { p: RealPlace; travel: number; start: number; end: number } | null = null;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const travel = prev ? travelMinutes(prev, p) : 0;
      const start = Math.ceil((t + travel) / 15) * 15;
      const end = start + visitMinutes(p, meal);
      if (end > DAY_END + 30) continue;
      if (!isOpen(p, weekday, start, end)) continue;
      const score = travel - (p.photo ? 10 : 0) - (p.rating ?? 0) * 2;
      const bScore = best ? best.travel - (best.p.photo ? 10 : 0) - (best.p.rating ?? 0) * 2 : Infinity;
      if (score < bScore) best = { p, travel, start, end };
    }
    return best;
  };

  for (let guard = 0; guard < 14 && t < DAY_END; guard++) {
    let meal: Stop["meal"] = null;
    let pool = pools.spots;
    if (!lunch && t >= 13 * 60 + 15) { meal = "comida"; pool = pools.food; }
    else if (!dinner && t >= 19 * 60 + 15) { meal = "cena"; pool = pools.food; }
    else if (t >= 20 * 60 + 30) pool = [...pools.night, ...pools.spots];

    const b = pick(pool, !!meal) ?? (meal ? pick(pools.spots, false) : t >= 18 * 60 ? pick(pools.night, false) : null);
    if (!b) {
      if (meal === "comida") lunch = true;
      else if (meal === "cena") dinner = true;
      else t += 30; // nothing open now: wait a bit
      continue;
    }
    // Don't start a sight that runs into lunch/dinner too late.
    used.add(b.p.id);
    stops.push({ start: b.start, end: b.end, travel: b.travel, place: b.p, meal: pool === pools.food ? meal : null });
    if (meal === "comida") lunch = true;
    if (meal === "cena") dinner = true;
    t = b.end;
    prev = b.p;
  }
  void center;
  return stops;
}
