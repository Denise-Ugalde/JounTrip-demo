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
