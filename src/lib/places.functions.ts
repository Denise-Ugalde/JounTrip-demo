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
