import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, MapPin } from "lucide-react";
import { searchRealPlaces } from "@/lib/places.functions";
import type { Vibe } from "@/lib/trips";

export function RealPlaces({ destination, vibe, lat, lng }: { destination: string; vibe: Vibe; lat: number; lng: number }) {
  const search = useServerFn(searchRealPlaces);
  const { data, isLoading } = useQuery({
    queryKey: ["real-places", destination, vibe],
    queryFn: () => search({ data: { destination, vibe, lat, lng } }),
    staleTime: Infinity,
    retry: false,
  });

  return (
    <section>
      <h2 className="mb-1 font-display text-3xl font-extrabold">Lugares reales en Google</h2>
      <p className="mb-4 text-sm text-muted-foreground">Recomendaciones en vivo según tu vibe, con calificaciones reales.</p>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : !data?.places.length ? (
        <p className="rounded-2xl bg-card p-4 text-muted-foreground shadow-card">{data?.error ?? "No encontramos lugares para este destino."}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.places.map((p) => (
            <li key={p.id}>
              <a href={p.mapsUrl} target="_blank" rel="noreferrer" className="block h-full rounded-2xl bg-card p-4 shadow-card hover:bg-muted">
                <span className="block font-semibold">{p.name}</span>
                {p.rating != null && (
                  <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    <Star className="h-4 w-4 fill-current" />{p.rating.toFixed(1)}
                    {p.reviews != null && <span className="text-muted-foreground">({p.reviews.toLocaleString("es")})</span>}
                  </span>
                )}
                <span className="mt-2 flex items-start gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{p.address}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
