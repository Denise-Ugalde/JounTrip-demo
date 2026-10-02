import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TripMap } from "@/components/TripMap";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTripPlaces, getLocalDishes, autocompleteCities, findNearbyDestinations, type RealPlace } from "@/lib/places.functions";
import { planDay, fmt } from "@/lib/schedule";
import { Star } from "lucide-react";
import {
  ArrowLeft, Car, Clock, Wallet, Sparkles, MapPin, Download, Share2, RefreshCw, X,
  MessageCircle, Send, Mail, Link2, Check, Utensils,
} from "lucide-react";
import {
  galleryImages, VIBES, BUDGETS, DURATIONS, ORIGIN_SUGGESTIONS, DEST_SUGGESTIONS,
  generateTrip, tripForReal, type Prefs, type Trip,
} from "@/lib/trips";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JounTrip — Find your vibe, plan your trip" },
      { name: "description", content: "Genera en segundos un itinerario de escapada de 1 a 5 días con comida local, mapa y actividades." },
      { property: "og:title", content: "JounTrip — Find your vibe, plan your trip" },
      { property: "og:description", content: "Itinerarios de fin de semana listos en segundos, a tu vibe y presupuesto." },
    ],
  }),
  component: App,
});

const DEFAULT: Prefs = { origin: "", knows: "no", destination: "", duration: "2-3", budget: "moderado", vibe: "cultura" };

function App() {
  const [view, setView] = useState<"hero" | "form" | "loading" | "trip">("hero");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  const go = (v: typeof view) => { setView(v); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const findNear = useServerFn(findNearbyDestinations);
  const run = async (exclude: string[]) => {
    go("loading");
    const started = Date.now();
    let t: Trip | null = null;
    const wantsNearby = (prefs.knows === "no" || exclude.length > 0) && prefs.origin.trim().length >= 2;
    if (wantsNearby) {
      try {
        const { list } = await findNear({ data: { origin: prefs.origin, vibe: prefs.vibe } });
        // Only rotate among destinations 2–3 h away; when all were seen, start over.
        const pick = list.find((d) => !exclude.includes(d.name)) ?? list.find((d) => d.name !== exclude[exclude.length - 1]) ?? list[0];
        if (pick) {
          t = tripForReal(prefs, pick);
          if (!list.some((d) => !exclude.includes(d.name))) exclude = [];
        }
      } catch (e) { console.error(e); }
    }
    if (!t) t = generateTrip(prefs, exclude);
    const final = t;
    setTimeout(() => {
      setTrip(final);
      setSeen([...exclude, final.dest.name]);
      go("trip");
    }, Math.max(0, 1600 - (Date.now() - started)));
  };

  if (view === "hero") return <Hero onStart={() => go("form")} />;
  if (view === "loading") return <Loading />;
  if (view === "trip" && trip)
    return <TripView trip={trip} prefs={prefs} onBack={() => go("form")} onRetry={() => run(seen)} />;
  return <Form prefs={prefs} setPrefs={setPrefs} onBack={() => go("hero")} onSubmit={() => run([])} />;
}

function Hero({ onStart }: { onStart: () => void }) {
  const row = [...galleryImages, ...galleryImages];
  const row2 = [...galleryImages.slice(3), ...galleryImages.slice(0, 3)];
  return (
    <main className="relative min-h-screen overflow-hidden bg-overlay">
      <div className="absolute inset-0 flex flex-col justify-center gap-4 opacity-90">
        {[row, [...row2, ...row2]].map((r, i) => (
          <div key={i} className={`flex w-max gap-4 ${i ? "animate-marquee-rev" : "animate-marquee"}`}>
            {r.map((src, j) => (
              <img key={j} src={src} alt="" width={1024} height={768}
                className="h-[42vh] w-[60vw] max-w-[520px] rounded-3xl object-cover sm:w-[34vw]" />
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-overlay/70 via-overlay/60 to-overlay/90" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-4 py-1.5 text-sm text-primary-foreground backdrop-blur">
          <Sparkles className="h-4 w-4" /> Escapadas de 1 a 5 días
        </span>
        <h1 className="font-display text-6xl font-extrabold tracking-tight text-primary-foreground sm:text-8xl">
          Joun<span className="text-primary-glow">Trip</span>
        </h1>
        <p className="mt-4 max-w-md text-lg text-primary-foreground/85 sm:text-2xl">Find your vibe, plan your trip.</p>
        <button onClick={onStart}
          className="mt-10 rounded-full bg-gradient-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-warm transition hover:-translate-y-1 hover:scale-[1.03]">
          Quiero generar mi viaje 🚘!
        </button>
      </div>
    </main>
  );
}

function Suggest({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ac = useServerFn(autocompleteCities);
  useEffect(() => {
    const t = setTimeout(() => setQ(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);
  const live = useQuery({
    queryKey: ["ac", q.toLowerCase()],
    queryFn: () => ac({ data: { input: q } }),
    enabled: open && q.length >= 2,
    staleTime: Infinity,
  });
  const local = value.length > 0 ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase()) && o !== value) : [];
  const matches = Array.from(new Set([...(live.data?.suggestions ?? []), ...local])).filter((o) => o !== value).slice(0, 5);
  return (
    <div>
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
        <input value={value} placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          className="w-full rounded-2xl border border-input bg-background py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {open && matches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {matches.map((m) => (
            <button key={m} type="button" onClick={() => { onChange(m); setOpen(false); }}
              className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-primary hover:text-primary-foreground">
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="mb-2 font-semibold">{children}</p>;
const chip = (on: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition ${on ? "border-primary bg-primary text-primary-foreground shadow-warm" : "border-border bg-background hover:border-primary"}`;

function Form({ prefs, setPrefs, onBack, onSubmit }: { prefs: Prefs; setPrefs: (p: Prefs) => void; onBack: () => void; onSubmit: () => void }) {
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs({ ...prefs, [k]: v });
  return (
    <main className="min-h-screen px-4 pb-16">
      <header className="mx-auto flex max-w-2xl items-center py-5">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-medium hover:bg-muted">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </button>
      </header>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="mx-auto max-w-2xl space-y-7 rounded-[2rem] bg-card p-6 shadow-card sm:p-10">
        <div>
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Cuéntanos tu vibe ✨</h2>
          <p className="mt-1 text-muted-foreground">5 preguntas y listo. Nosotros planeamos el resto.</p>
        </div>
        <div><Label>Ciudad de origen</Label>
          <Suggest value={prefs.origin} onChange={(v) => set("origin", v)} options={ORIGIN_SUGGESTIONS} placeholder="Ej. Ciudad de México" /></div>
        <div><Label>¿Ya sabes qué destino quieres?</Label>
          <select value={prefs.knows} onChange={(e) => set("knows", e.target.value as Prefs["knows"])}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3.5 outline-none focus:ring-2 focus:ring-ring">
            <option value="no">No. Busco sugerencias</option>
            <option value="si">Sí</option>
          </select>
          {prefs.knows === "si" && (
            <div className="mt-3"><Suggest value={prefs.destination} onChange={(v) => set("destination", v)} options={DEST_SUGGESTIONS} placeholder="Escribe tu destino soñado" /></div>
          )}
        </div>
        <div><Label>Tiempo máximo de viaje / Días</Label>
          <select value={prefs.duration} onChange={(e) => set("duration", e.target.value as Prefs["duration"])}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3.5 outline-none focus:ring-2 focus:ring-ring">
            {DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <div><Label>Presupuesto</Label>
          <div className="grid grid-cols-3 gap-2">
            {BUDGETS.map((b) => <button type="button" key={b.id} onClick={() => set("budget", b.id)} className={chip(prefs.budget === b.id)}>{b.label}</button>)}
          </div>
        </div>
        <div><Label>Ambiente / Vibe</Label>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => <button type="button" key={v.id} onClick={() => set("vibe", v.id)} className={chip(prefs.vibe === v.id)}>{v.label}</button>)}
          </div>
        </div>
        <button type="submit" className="w-full rounded-full bg-gradient-primary py-4 text-lg font-bold text-primary-foreground shadow-warm transition hover:-translate-y-0.5">
          ¡Crear mi aventura! 🚘
        </button>
      </form>
    </main>
  );
}

function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-primary shadow-warm">
          <Car className="h-10 w-10 animate-bounce text-primary-foreground" />
        </div>
      </div>
      <p className="font-display text-2xl font-bold">Buscando el destino perfecto para tu vibe... ✨</p>
    </main>
  );
}

function TripView({ trip, prefs, onBack, onRetry }: { trip: Trip; prefs: Prefs; onBack: () => void; onRetry: () => void }) {
  const { dest } = trip;
  const fetchPlaces = useServerFn(getTripPlaces);
  const { data: live, isLoading: liveLoading } = useQuery({
    queryKey: ["trip-places", dest.name, prefs.vibe],
    queryFn: () => fetchPlaces({ data: { destination: `${dest.name}, ${dest.region}`, vibe: prefs.vibe, lat: dest.lat, lng: dest.lng } }),
    staleTime: Infinity, retry: false,
  });
  const realSpots = live?.spots ?? [];
  const realFood = live?.food ?? [];
  const hasLive = realSpots.length + realFood.length > 0;
  const fetchDishes = useServerFn(getLocalDishes);
  const { data: dishData, isLoading: dishLoading } = useQuery({
    queryKey: ["dishes", dest.name, dest.region],
    queryFn: () => fetchDishes({ data: { destination: `${dest.name}, ${dest.region}`, lat: dest.lat, lng: dest.lng } }),
    staleTime: Infinity, retry: false,
  });
  const localDishes = dishData?.dishes ?? [];
  // Real itinerary 09:00–22:00 with visit lengths, travel time and opening hours.
  type Item = { time: string; title: string; type: string; summary: string; cost: number; img: string; place?: RealPlace; travel?: number; until?: string };
  const days: { day: number; items: Item[] }[] = hasLive
    ? (() => {
        const used = new Set<string>();
        const pools = { spots: realSpots, food: realFood, night: live?.night ?? [] };
        return trip.days.map((d, i) => {
          const wd = (new Date().getDay() + i) % 7;
          const stops = planDay(pools, used, wd, { lat: dest.lat, lng: dest.lng }, prefs.vibe);
          return {
            day: d.day,
            items: stops.map((s) => ({
              time: fmt(s.start), until: fmt(s.end), travel: s.travel, place: s.place,
              title: s.place.name,
              type: s.meal === "comida" ? "Comida" : s.meal === "cena" ? "Cena" : s.meal === "desayuno" ? "Desayuno" : s.meal === "cafe" ? "Café / postre" : s.night ? "Para cerrar la noche" : s.place.type ?? "Actividad",
              summary: s.place.address, cost: -1, img: s.place.photo ?? dest.cover,
            })),
          };
        }).filter((d) => d.items.length > 0);
      })()
    : dest.dishes.length === 0 ? [] : trip.days;
  const pins = hasLive
    ? [...realSpots, ...realFood].filter((p) => p.lat != null && p.lng != null).map((p) => ({ name: p.name, type: realFood.includes(p) ? "Restaurante" : "Lugar", lat: p.lat!, lng: p.lng! }))
    : dest.spots;
  const listItems = hasLive
    ? [...realSpots.map((p) => ({ n: p.name, t: p.address, food: false, url: p.mapsUrl, r: p.rating })), ...realFood.map((p) => ({ n: p.name, t: p.address, food: true, url: p.mapsUrl, r: p.rating }))]
    : [...dest.spots.map((s) => ({ n: s.name, t: s.type, food: false, url: "", r: null as number | null })), ...dest.dishes.map((d) => ({ n: d.place, t: d.name, food: true, url: "", r: null as number | null }))];
  const [day, setDay] = useState(0);
  const [share, setShare] = useState(false);
  useEffect(() => setDay(0), [dest.name]);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dest.name}, ${dest.region}`)}`;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${dest.lng - 0.08},${dest.lat - 0.06},${dest.lng + 0.08},${dest.lat + 0.06}&layer=mapnik&marker=${dest.lat},${dest.lng}`;
  const vibe = VIBES.find((v) => v.id === prefs.vibe)!.label;
  const budget = BUDGETS.find((b) => b.id === prefs.budget)!.label;

  return (
    <main className="min-h-screen pb-20">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={onBack} aria-label="Volver" className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-display text-xl font-extrabold">Joun<span className="text-primary">Trip</span></span>
          <div className="w-11" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-4 pt-6">
        <section className="relative overflow-hidden rounded-[2rem] shadow-card">
          <img src={live?.cover ?? dest.cover} alt={dest.name} width={1024} height={768} className="h-[52vh] min-h-[360px] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-overlay/90 via-overlay/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 text-primary-foreground">
            <p className="text-sm uppercase tracking-widest opacity-80">{dest.region} · desde {prefs.origin || "tu ciudad"}</p>
            <h1 className="font-display text-5xl font-extrabold sm:text-6xl">{dest.name}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {[[Clock, `${dest.hours} h de viaje`], [Wallet, budget], [Sparkles, vibe]].map(([I, t], i) => {
                const Icon = I as typeof Clock;
                return <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5 backdrop-blur"><Icon className="h-4 w-4" />{t as string}</span>;
              })}
            </div>
            <p className="mt-4 max-w-2xl text-primary-foreground/90">{dest.intro}</p>
          </div>
        </section>

        <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-4">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3 font-semibold shadow-card hover:bg-muted">Ver en Google Maps 📍</a>
          <button onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3 font-semibold shadow-card hover:bg-muted"><Download className="h-4 w-4" />Guardar mi viaje 📤</button>
          <button onClick={() => setShare(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground shadow-card"><Share2 className="h-4 w-4" />Compartir Itinerario 🚀</button>
          <button onClick={onRetry} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-warm"><RefreshCw className="h-4 w-4" />Probar otro destino 🔄</button>
        </div>

        <section>
          <h2 className="mb-1 font-display text-3xl font-extrabold">Tu mapa</h2>
          <p className="mb-4 text-sm text-muted-foreground">{liveLoading ? "Buscando lugares reales en Google…" : hasLive ? "Lugares reales de Google Maps, con calificaciones en vivo." : "No pudimos cargar lugares reales; mostramos sugerencias."}</p>
          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
            <TripMap center={{ lat: dest.lat, lng: dest.lng }} pins={pins} fallback={osmSrc} />
            <ul className="max-h-[480px] space-y-2 overflow-y-auto">
              {listItems.map((p, i) => (
                <li key={i}>
                  <a href={p.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.n}, ${dest.name}`)}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card hover:bg-muted">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${p.food ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
                      {p.food ? <Utensils className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0"><span className="block truncate font-semibold">{p.n}</span><span className="block truncate text-sm text-muted-foreground">{p.r != null && <span className="mr-1 font-semibold text-primary">★ {p.r.toFixed(1)}</span>}{p.t}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="mb-1 font-display text-3xl font-extrabold">Imperdible probar 😋</h2>
          <h3 className="mb-3 mt-4 font-display text-xl font-bold">Comida típica de {dest.name}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {localDishes.length > 0 ? localDishes.map((d) => (
              <article key={d.name} className="overflow-hidden rounded-3xl bg-card shadow-card">
                {d.img ? <img src={d.img} alt={d.name} loading="lazy" className="h-40 w-full object-cover" />
                  : <div className="flex h-40 w-full items-center justify-center bg-muted"><Utensils className="h-8 w-8 text-muted-foreground" /></div>}
                <div className="p-4">
                  <h4 className="font-display text-lg font-bold">{d.name}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{d.note}</p>
                  {d.place && <a href={d.place.mapsUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold text-primary hover:underline">Pruébalo en {d.place.name} →</a>}
                </div>
              </article>
            )) : <p className="text-sm text-muted-foreground">{dishLoading ? "Buscando platillos típicos…" : "No encontramos platillos típicos para este destino."}</p>}
          </div>
          <h3 className="mb-3 mt-8 font-display text-xl font-bold">Restaurantes imperdibles</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {realFood.length > 0 ? [...realFood].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6).map((f) => (
              <a key={f.id} href={f.mapsUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-3xl bg-card shadow-card hover:bg-muted">
                {f.photo ? <img src={f.photo} alt={f.name} loading="lazy" width={1024} height={768} className="h-40 w-full object-cover" />
                  : <div className="flex h-40 w-full items-center justify-center bg-muted"><Utensils className="h-8 w-8 text-muted-foreground" /></div>}
                <div className="p-4">
                  <h4 className="font-display text-lg font-bold">{f.name}</h4>
                  {f.rating != null && <p className="text-sm font-medium text-primary">★ {f.rating.toFixed(1)}{f.reviews != null ? ` · ${f.reviews.toLocaleString("es")} reseñas` : ""}</p>}
                  <p className="mt-1 text-sm text-muted-foreground">{f.address}</p>
                </div>
              </a>
            )) : <p className="text-sm text-muted-foreground">{liveLoading ? "Buscando restaurantes reales…" : "No encontramos restaurantes en Google para este destino."}</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-display text-3xl font-extrabold">Día a día</h2>
          {days.length === 0 && <p className="text-sm text-muted-foreground">{liveLoading ? "Armando tu día a día con lugares reales de Google…" : "No encontramos suficientes lugares abiertos en Google para armar el día a día."}</p>}
          {hasLive && days.length > 0 && days.length < trip.days.length && <p className="mb-4 text-sm text-muted-foreground">{dest.name} es un destino pequeño: sus lugares abiertos alcanzan para {days.length} {days.length === 1 ? "día" : "días"} bien aprovechados sin repetir.</p>}
          <div className="no-print mb-5 flex gap-2 overflow-x-auto">
            {days.map((d, i) => <button key={i} onClick={() => setDay(i)} className={chip(day === i)}>Día {d.day}</button>)}
          </div>
          {days.map((d, i) => (
            <ol key={i} className={`relative space-y-4 border-l-2 border-dashed border-primary/40 pl-6 ${i === day ? "" : "hidden print:block"}`}>
              <p className="hidden font-bold print:block">Día {d.day}</p>
              {d.items.map((it, j) => (
                <li key={j} className="relative flex gap-4 rounded-3xl bg-card p-3 shadow-card">
                  <span className="absolute -left-[33px] top-6 h-4 w-4 rounded-full border-4 border-background bg-primary" />
                  <img src={it.img} alt="" loading="lazy" width={1024} height={768} className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-28" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-primary">{it.time}{it.until ? ` – ${it.until}` : ""}</span>
                      {it.cost >= 0 ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${it.cost === 0 ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground"}`}>
                        {it.cost === 0 ? "¡Gratis!" : `~$${it.cost}`}
                      </span> : <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">{it.type}</span>}
                    </div>
                    {it.place ? (
                      <a href={it.place.mapsUrl} target="_blank" rel="noreferrer" className="font-display font-bold hover:text-primary">{it.title}</a>
                    ) : <h3 className="font-display font-bold">{it.title}</h3>}
                    {it.place?.rating != null && (
                      <span className="ml-0 flex items-center gap-1 text-sm font-medium text-primary"><Star className="h-3.5 w-3.5 fill-current" />{it.place.rating.toFixed(1)}{it.place.reviews != null && <span className="text-muted-foreground">({it.place.reviews.toLocaleString("es")})</span>}</span>
                    )}
                    <p className="text-sm text-muted-foreground">{it.summary}</p>
                    {!!it.travel && <p className="mt-1 text-xs font-medium text-muted-foreground">{it.travel <= 15 ? "🚶" : "🚗"} {it.travel} min de traslado desde la parada anterior</p>}
                  </div>
                </li>
              ))}
            </ol>
          ))}
        </section>
      </div>
      {share && <ShareModal name={dest.name} onClose={() => setShare(false)} />}
    </main>
  );
}

function ShareModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `¡Mira mi escapada a ${name} con JounTrip! 🚘`;
  const e = encodeURIComponent;
  const links = [
    { l: "WhatsApp", I: MessageCircle, h: `https://wa.me/?text=${e(`${text} ${url}`)}` },
    { l: "Telegram", I: Send, h: `https://t.me/share/url?url=${e(url)}&text=${e(text)}` },
    { l: "Email", I: Mail, h: `mailto:?subject=${e(`Viaje a ${name}`)}&body=${e(`${text} ${url}`)}` },
  ];
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-overlay/60 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[2rem] bg-card p-6 shadow-card" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">Compartir itinerario</h3>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {links.map(({ l, I, h }) => (
            <a key={l} href={h} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-muted p-3 font-semibold hover:bg-accent"><I className="h-5 w-5 text-primary" />{l}</a>
          ))}
          <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); }} className="flex items-center gap-2 rounded-2xl bg-muted p-3 font-semibold hover:bg-accent">
            {copied ? <Check className="h-5 w-5 text-primary" /> : <Link2 className="h-5 w-5 text-primary" />}{copied ? "¡Copiado!" : "Copiar link"}
          </button>
        </div>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button onClick={() => navigator.share({ title: `JounTrip · ${name}`, text, url }).catch(() => {})}
            className="mt-3 w-full rounded-full bg-gradient-primary py-3 font-bold text-primary-foreground">Más opciones…</button>
        )}
      </div>
    </div>
  );
}
