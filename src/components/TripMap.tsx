import { useEffect, useRef, useState } from "react";

type Pin = { name: string; type: string; lat: number; lng: number };

declare global {
  interface Window {
    __jtMapsReady?: () => void;
    google?: any;
  }
}

let loader: Promise<void> | null = null;
function loadMaps(key: string, channel?: string) {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    window.__jtMapsReady = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__jtMapsReady${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.onerror = () => reject(new Error("maps"));
    document.head.appendChild(s);
  });
  return loader;
}

export function TripMap({ center, pins, fallback }: { center: { lat: number; lng: number }; pins: Pin[]; fallback: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as string | undefined;

  useEffect(() => {
    if (!key || !ref.current) return;
    let cancelled = false;
    loadMaps(key, channel)
      .then(() => {
        if (cancelled || !ref.current) return;
        const g = window.google.maps;
        const map = new g.Map(ref.current, { center, zoom: 12, clickableIcons: false, mapTypeControl: false, streetViewControl: false });
        const bounds = new g.LatLngBounds();
        const info = new g.InfoWindow();
        pins.forEach((p, i) => {
          const m = new g.Marker({ position: { lat: p.lat, lng: p.lng }, map, label: { text: String(i + 1), color: "#fff", fontWeight: "700" }, title: p.name });
          m.addListener("click", () => {
            info.setContent(`<strong>${p.name}</strong><br/>${p.type}`);
            info.open({ map, anchor: m });
          });
          bounds.extend(m.getPosition());
        });
        if (pins.length > 1) map.fitBounds(bounds, 40);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [key, channel, center.lat, center.lng, pins]);

  if (!key || failed) {
    return <iframe title="Mapa" src={fallback} className="h-80 w-full rounded-3xl border-0 shadow-card" loading="lazy" />;
  }
  return <div ref={ref} role="region" aria-label="Mapa interactivo" className="h-80 w-full overflow-hidden rounded-3xl bg-muted shadow-card" />;
}
