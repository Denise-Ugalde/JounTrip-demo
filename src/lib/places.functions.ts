import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type RealPlace = {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string;
  lat: number | null;
  lng: number | null;
  photo: string | null;
  type?: string | null;
  kind?: string | null;
  hours?: { open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }[] | null;
};

const VIBE_ACTIVITY: Record<string, string> = {
  naturaleza: "parques naturales, senderos y miradores",
  cultura: "museos y lugares culturales",
  gastro: "mercados tradicionales y experiencias gastronómicas",
  playa: "playas y actividades de aventura",
  fiesta: "lugares de entretenimiento y espectáculos",
};

const VIBE_QUERY: Record<string, string> = {
  naturaleza: "parques y naturaleza",
  cultura: "museos y lugares culturales",
  gastro: "restaurantes y cafés",
  playa: "playas y actividades de aventura",
  fiesta: "bares y vida nocturna",
};

// Simple per-instance cache to avoid repeating paid lookups.
const cache = new Map<string, { at: number; data: RealPlace[] }>();
const TTL = 1000 * 60 * 60 * 6;

export const searchRealPlaces = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        destination: z.string().trim().min(2).max(80),
        vibe: z.enum(["naturaleza", "cultura", "gastro", "playa", "fiesta"]),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ places: RealPlace[]; error?: string }> => {
    const key = `${data.destination.toLowerCase()}|${data.vibe}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return { places: hit.data };

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const GOOGLE_MAPS_API_KEY = process.env["GOOGLE_MAPS_API_KEY"];
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) return { places: [], error: "Búsqueda no disponible" };

    const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.location",
      },
      body: JSON.stringify({
        textQuery: `${VIBE_QUERY[data.vibe]} en ${data.destination}`,
        languageCode: "es",
        pageSize: 6,
        locationBias: { circle: { center: { latitude: data.lat, longitude: data.lng }, radius: 30000 } },
      }),
    });
    if (!res.ok) {
      console.error(`Places failed [${res.status}]: ${await res.text()}`);
      return { places: [], error: "No pudimos cargar lugares reales ahora" };
    }
    const json = (await res.json()) as { places?: any[] };
    const places: RealPlace[] = (json.places ?? []).slice(0, 6).map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? "Lugar",
      address: p.formattedAddress ?? "",
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? null,
      mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text ?? "")}`,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      photo: null,
    }));
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: Date.now(), data: places });
    return { places };
  });

async function textSearch(textQuery: string, lat: number, lng: number, size: number): Promise<RealPlace[]> {
  const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
  const GOOGLE_MAPS_API_KEY = process.env["GOOGLE_MAPS_API_KEY"];
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) return [];
  const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.location,places.photos,places.primaryType,places.primaryTypeDisplayName,places.regularOpeningHours.periods",
    },
    body: JSON.stringify({
      textQuery, languageCode: "es", pageSize: size,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 20000 } },
    }),
  });
  if (!res.ok) { console.error(`Places failed [${res.status}]: ${await res.text()}`); return []; }
  const json = (await res.json()) as { places?: any[] };
  return (json.places ?? []).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? "Lugar",
    address: p.formattedAddress ?? "",
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text ?? "")}`,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    photo: p.photos?.[0]?.name ? `/api/public/photo?n=${encodeURIComponent(p.photos[0].name)}` : null,
    type: p.primaryTypeDisplayName?.text ?? null,
    kind: p.primaryType ?? null,
    hours: p.regularOpeningHours?.periods ?? null,
  }));
}

/** Real attractions + restaurants for a whole trip (map, food and itinerary). */
export const getTripPlaces = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      destination: z.string().trim().min(2).max(80),
      vibe: z.enum(["naturaleza", "cultura", "gastro", "playa", "fiesta"]),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const city = data.destination;
    const [cover, vibeSpots, top, food, more, acts, nightRaw] = await Promise.all([
      textSearch(city, data.lat, data.lng, 1),
      textSearch(`${VIBE_ACTIVITY[data.vibe]} en ${city}`, data.lat, data.lng, 20),
      textSearch(`atracciones turísticas en ${city}`, data.lat, data.lng, 20),
      textSearch(`mejores restaurantes en ${city}`, data.lat, data.lng, 20),
      textSearch(`museos, monumentos y sitios históricos en ${city}`, data.lat, data.lng, 20),
      textSearch(`parques, miradores y actividades al aire libre en ${city}`, data.lat, data.lng, 20),
      textSearch(`bares y terrazas en ${city}`, data.lat, data.lng, 15),
    ]);
    const FOOD = /restaurant|cafe|coffee|bakery|food|meal|ice_cream|diner|steak|pizza|sandwich|deli|brunch|dessert/;
    const NIGHT = /bar|pub|night_club|wine|brewery|cocktail|lounge/;
    const near = (p: RealPlace) => p.lat == null || p.lng == null || (Math.abs(p.lat - data.lat) < 0.3 && Math.abs(p.lng - data.lng) < 0.4);
    const byPhoto = (a: RealPlace, b: RealPlace) => Number(!!b.photo) - Number(!!a.photo);
    const seen = new Set<string>();
    const all = [...vibeSpots, ...top, ...more, ...acts, ...food, ...nightRaw].filter((p) => near(p) && !seen.has(p.id) && seen.add(p.id));
    const k = (p: RealPlace) => p.kind ?? "";
    const spots = all.filter((p) => !FOOD.test(k(p)) && !NIGHT.test(k(p))).sort(byPhoto);
    const foodU = all.filter((p) => FOOD.test(k(p))).sort(byPhoto);
    const night = all.filter((p) => NIGHT.test(k(p))).sort(byPhoto);
    return { spots, food: foodU, night, cover: cover[0]?.photo ?? spots.find((p) => p.photo)?.photo ?? null };
  });

const acCache = new Map<string, string[]>();

export const autocompleteCities = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ input: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ suggestions: string[] }> => {
    const k = data.input.toLowerCase();
    const hit = acCache.get(k);
    if (hit) return { suggestions: hit };
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const GOOGLE_MAPS_API_KEY = process.env["GOOGLE_MAPS_API_KEY"];
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) return { suggestions: [] };
    try {
      const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:autocomplete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: data.input, languageCode: "es", includedPrimaryTypes: ["(cities)"] }),
      });
      if (!res.ok) {
        console.error("autocomplete failed", res.status, await res.text());
        return { suggestions: [] };
      }
      const json = (await res.json()) as { suggestions?: { placePrediction?: { text?: { text?: string } } }[] };
      const list = (json.suggestions ?? [])
        .map((s) => s.placePrediction?.text?.text)
        .filter((t): t is string => !!t)
        .slice(0, 5);
      acCache.set(k, list);
      return { suggestions: list };
    } catch (e) {
      console.error(e);
      return { suggestions: [] };
    }
  });

export type NearbyDest = { name: string; region: string; lat: number; lng: number; minutes: number };

function gwHeaders(mask: string) {
  return {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "X-Connection-Api-Key": process.env["GOOGLE_MAPS_API_KEY"] ?? "",
    "Content-Type": "application/json",
    "X-Goog-FieldMask": mask,
  };
}
const GW = "https://connector-gateway.lovable.dev/google_maps";
const nearCache = new Map<string, NearbyDest[]>();

/** Real towns/cities 2–3 h by road from the origin (driving time via Routes API). */
export const findNearbyDestinations = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ origin: z.string().trim().min(2).max(120) }).parse(d))
  .handler(async ({ data }): Promise<{ origin: { lat: number; lng: number } | null; list: NearbyDest[] }> => {
    if (!process.env["LOVABLE_API_KEY"] || !process.env["GOOGLE_MAPS_API_KEY"]) return { origin: null, list: [] };
    try {
      const g = await fetch(`${GW}/places/v1/places:searchText`, {
        method: "POST", headers: gwHeaders("places.location"),
        body: JSON.stringify({ textQuery: data.origin, pageSize: 1, languageCode: "es" }),
      });
      if (!g.ok) { console.error("geocode", g.status, await g.text()); return { origin: null, list: [] }; }
      const loc = ((await g.json()) as any).places?.[0]?.location;
      if (!loc) return { origin: null, list: [] };
      const o = { lat: loc.latitude as number, lng: loc.longitude as number };
      const ck = data.origin.toLowerCase();
      if (nearCache.has(ck)) return { origin: o, list: nearCache.get(ck)! };

      const dLat = 2.6, dLng = 2.6 / Math.max(0.3, Math.cos((o.lat * Math.PI) / 180));
      const rect = {
        rectangle: {
          low: { latitude: Math.max(-89, o.lat - dLat), longitude: Math.max(-179.9, o.lng - dLng) },
          high: { latitude: Math.min(89, o.lat + dLat), longitude: Math.min(179.9, o.lng + dLng) },
        },
      };
      const queries = ["pueblos turísticos", "ciudades turísticas", "pueblos con encanto", "tourist towns", "historic towns", "ciudades pequeñas"];
      const results = await Promise.all(queries.map(async (q) => {
        const r = await fetch(`${GW}/places/v1/places:searchText`, {
          method: "POST", headers: gwHeaders("places.id,places.displayName,places.formattedAddress,places.location"),
          body: JSON.stringify({ textQuery: q, includedType: "locality", pageSize: 20, languageCode: "es", locationRestriction: rect }),
        });
        if (!r.ok) { console.error("near search", r.status, await r.text()); return []; }
        return (((await r.json()) as any).places ?? []) as any[];
      }));
      const km = (a: number, b: number) => {
        const R = 6371, toR = Math.PI / 180;
        const x = (a - o.lat) * toR, y = (b - o.lng) * toR;
        const h = Math.sin(x / 2) ** 2 + Math.cos(o.lat * toR) * Math.cos(a * toR) * Math.sin(y / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
      };
      const seen = new Set<string>();
      const seenName = new Set<string>();
      const cands = results.flat().filter((p) => {
        const nm = String(p.displayName?.text ?? "").toLowerCase();
        if (!p.location || seen.has(p.id) || seenName.has(nm)) return false;
        seen.add(p.id); seenName.add(nm);
        const d = km(p.location.latitude, p.location.longitude);
        return d > 80 && d < 300;
      }).slice(0, 50);
      if (!cands.length) return { origin: o, list: [] };

      const chunks = [cands.slice(0, 25), cands.slice(25, 50)].filter((c) => c.length);
      const all: NearbyDest[] = [];
      for (const [ci, chunk] of chunks.entries()) {
        const m = await fetch(`${GW}/routes/distanceMatrix/v2:computeRouteMatrix`, {
          method: "POST", headers: gwHeaders("destinationIndex,duration,condition"),
          body: JSON.stringify({
            origins: [{ waypoint: { location: { latLng: { latitude: o.lat, longitude: o.lng } } } }],
            destinations: chunk.map((p) => ({ waypoint: { location: { latLng: { latitude: p.location.latitude, longitude: p.location.longitude } } } })),
            travelMode: "DRIVE",
          }),
        });
        if (!m.ok) { console.error("matrix", m.status, await m.text()); continue; }
        const rows = (await m.json()) as { destinationIndex?: number; duration?: string; condition?: string }[];
        for (const r of rows) {
          if (r.condition !== "ROUTE_EXISTS" || !r.duration) continue;
          const p = cands[ci * 25 + (r.destinationIndex ?? 0)];
          if (!p) continue;
          const parts = String(p.formattedAddress ?? "").split(",").map((s: string) => s.trim());
          all.push({
            name: p.displayName?.text ?? parts[0] ?? "Destino",
            region: parts.slice(1).join(", ") || "",
            lat: p.location.latitude, lng: p.location.longitude,
            minutes: Math.round(parseInt(r.duration, 10) / 60),
          });
        }
      }
      // Strict: only destinations between 2 and 3 hours by road.
      const list = all.filter((d) => d.minutes >= 120 && d.minutes <= 180);
      list.sort(() => Math.random() - 0.5);
      nearCache.set(ck, list);
      return { origin: o, list };
    } catch (e) {
      console.error(e);
      return { origin: null, list: [] };
    }
  });

export type LocalDish = { name: string; note: string; img: string | null; place: RealPlace | null };

async function wikiImage(title: string): Promise<string | null> {
  for (const lang of ["es", "en"]) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=900&redirects=1&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(title)}`, { headers: { "User-Agent": "JounTrip/1.0" } });
      if (!r.ok) continue;
      const pages = ((await r.json()) as any).query?.pages ?? {};
      const src = (Object.values(pages)[0] as any)?.thumbnail?.source;
      if (src) return src;
    } catch { /* ignore */ }
  }
  return null;
}

const dishCache = new Map<string, LocalDish[]>();

/** Typical/traditional dishes of a destination, with real photos of each dish. */
export const getLocalDishes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ destination: z.string().trim().min(2).max(120), lat: z.number(), lng: z.number() }).parse(d))
  .handler(async ({ data }): Promise<{ dishes: LocalDish[] }> => {
    const ck = data.destination.toLowerCase();
    if (dishCache.has(ck)) return { dishes: dishCache.get(ck)! };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { dishes: [] };
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Eres experto en gastronomía regional. Responde solo JSON." },
            { role: "user", content: `Lista 4 platillos o bebidas típicas, locales o tradicionales de ${data.destination} (o de su región inmediata). Devuelve {"dishes":[{"name":"nombre del platillo","note":"descripción breve en español, máx 90 caracteres","wiki":"título del artículo de Wikipedia del platillo"}]}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) { console.error("dishes ai", r.status, await r.text()); return { dishes: [] }; }
      const txt = ((await r.json()) as any).choices?.[0]?.message?.content ?? "{}";
      const list = ((JSON.parse(txt.replace(/^```json|```$/g, "")).dishes ?? []) as { name: string; note: string; wiki?: string }[]).slice(0, 4);
      const dishes = await Promise.all(list.map(async (d) => {
        const [img, places] = await Promise.all([
          wikiImage(d.wiki || d.name),
          textSearch(`${d.name} en ${data.destination}`, data.lat, data.lng, 1),
        ]);
        return { name: d.name, note: d.note, img: img ?? places[0]?.photo ?? null, place: places[0] ?? null };
      }));
      dishCache.set(ck, dishes);
      return { dishes };
    } catch (e) {
      console.error(e);
      return { dishes: [] };
    }
  });
