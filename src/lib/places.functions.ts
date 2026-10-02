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
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.location",
    },
    body: JSON.stringify({
      textQuery, languageCode: "es", pageSize: size,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 25000 } },
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
    const [vibeSpots, top, food] = await Promise.all([
      textSearch(`${VIBE_QUERY[data.vibe]} en ${data.destination}`, data.lat, data.lng, 10),
      textSearch(`atracciones turísticas en ${data.destination}`, data.lat, data.lng, 10),
      textSearch(`restaurantes de comida típica en ${data.destination}`, data.lat, data.lng, 10),
    ]);
    const seen = new Set<string>();
    const spots = [...vibeSpots, ...top].filter((p) => !seen.has(p.id) && seen.add(p.id));
    const foodU = food.filter((p) => !seen.has(p.id));
    return { spots, food: foodU };
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
      const queries = ["pueblos turísticos", "ciudades turísticas", "pueblos con encanto"];
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
      const cands = results.flat().filter((p) => {
        if (!p.location || seen.has(p.id)) return false;
        seen.add(p.id);
        const d = km(p.location.latitude, p.location.longitude);
        return d > 60 && d < 330;
      }).slice(0, 25);
      if (!cands.length) return { origin: o, list: [] };

      const m = await fetch(`${GW}/routes/distanceMatrix/v2:computeRouteMatrix`, {
        method: "POST", headers: gwHeaders("destinationIndex,duration,condition"),
        body: JSON.stringify({
          origins: [{ waypoint: { location: { latLng: { latitude: o.lat, longitude: o.lng } } } }],
          destinations: cands.map((p) => ({ waypoint: { location: { latLng: { latitude: p.location.latitude, longitude: p.location.longitude } } } })),
          travelMode: "DRIVE",
        }),
      });
      if (!m.ok) { console.error("matrix", m.status, await m.text()); return { origin: o, list: [] }; }
      const rows = (await m.json()) as { destinationIndex?: number; duration?: string; condition?: string }[];
      const all: NearbyDest[] = rows
        .filter((r) => r.condition === "ROUTE_EXISTS" && r.duration)
        .map((r) => {
          const p = cands[r.destinationIndex ?? 0];
          const parts = String(p.formattedAddress ?? "").split(",").map((s: string) => s.trim());
          return {
            name: p.displayName?.text ?? parts[0] ?? "Destino",
            region: parts.slice(1).join(", ") || "",
            lat: p.location.latitude, lng: p.location.longitude,
            minutes: Math.round(parseInt(r.duration!, 10) / 60),
          };
        });
      let list = all.filter((d) => d.minutes >= 120 && d.minutes <= 180);
      if (!list.length) list = [...all].sort((a, b) => Math.abs(a.minutes - 150) - Math.abs(b.minutes - 150)).slice(0, 5);
      list.sort(() => Math.random() - 0.5);
      nearCache.set(ck, list);
      return { origin: o, list };
    } catch (e) {
      console.error(e);
      return { origin: null, list: [] };
    }
  });
