import { createFileRoute } from "@tanstack/react-router";

// Resolves a Google Places photo reference to its public image URL and redirects to it.
const cache = new Map<string, string>();

export const Route = createFileRoute("/api/public/photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const n = new URL(request.url).searchParams.get("n") ?? "";
        if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(n)) return new Response("Bad request", { status: 400 });
        let uri = cache.get(n);
        if (!uri) {
          const key = process.env["LOVABLE_API_KEY"];
          const gk = process.env["GOOGLE_MAPS_API_KEY"];
          if (!key || !gk) return new Response("Unavailable", { status: 503 });
          const r = await fetch(`https://connector-gateway.lovable.dev/google_maps/places/v1/${n}/media?maxWidthPx=1200&skipHttpRedirect=true`, {
            headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": gk },
          });
          if (!r.ok) {
            console.error("photo", r.status, await r.text());
            return new Response("Not found", { status: 404 });
          }
          uri = ((await r.json()) as { photoUri?: string }).photoUri;
          if (!uri) return new Response("Not found", { status: 404 });
          if (cache.size > 2000) cache.clear();
          cache.set(n, uri);
        }
        return new Response(null, { status: 302, headers: { Location: uri, "Cache-Control": "public, max-age=86400" } });
      },
    },
  },
});
