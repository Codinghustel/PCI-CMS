"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

export interface MapPinData {
  id: string;
  name: string;
  href: string;
  subtitle: string;
  latitude: number | null;
  longitude: number | null;
}

interface PlacedPin extends MapPinData {
  lat: number;
  lng: number;
  approximate: boolean;
}

/**
 * Projects without their own coordinates are placed evenly around the location
 * centre and labelled as approximate, so every project still gets a pin.
 */
function placePins(pins: MapPinData[], center: { lat: number; lng: number }): PlacedPin[] {
  const missing = pins.filter((p) => p.latitude == null || p.longitude == null);
  const radius = 0.0028; // ≈300 m
  let k = 0;
  return pins.map((p) => {
    if (p.latitude != null && p.longitude != null) return { ...p, lat: p.latitude, lng: p.longitude, approximate: false };
    const angle = (2 * Math.PI * k++) / Math.max(missing.length, 1) - Math.PI / 2;
    return {
      ...p,
      lat: center.lat + radius * Math.sin(angle),
      lng: center.lng + (radius * Math.cos(angle)) / Math.cos((center.lat * Math.PI) / 180),
      approximate: true,
    };
  });
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Project list + interactive OpenStreetMap map with one pin per project. */
export function LocationExplorer({
  center,
  pins,
  locationName,
}: {
  center: { lat: number; lng: number };
  pins: MapPinData[];
  locationName: string;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const [active, setActive] = useState<string | null>(null);
  const placed = placePins(pins, center);
  const hasApproximate = placed.some((p) => p.approximate);

  useEffect(() => {
    let cancelled = false;
    const markerMap = markers.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      // Let the page scroll normally until the visitor interacts with the map.
      map.on("focus click", () => map.scrollWheelZoom.enable());
      map.on("blur mouseout", () => map.scrollWheelZoom.disable());

      placed.forEach((p, i) => {
        const icon = L.divIcon({
          className: "",
          html: `<span class="pci-pin${p.approximate ? " pci-pin--approx" : ""}"><span>${i + 1}</span></span>`,
          iconSize: [34, 42],
          iconAnchor: [17, 40],
          popupAnchor: [0, -36],
        });
        const marker = L.marker([p.lat, p.lng], { icon, title: p.name, alt: p.name, keyboard: true })
          .addTo(map)
          .bindPopup(
            `<div class="pci-popup"><strong>${escape(p.name)}</strong><span>${escape(p.subtitle)}</span>${
              p.approximate ? '<em>Approximate position</em>' : ""
            }<a href="${escape(p.href)}">View project →</a></div>`
          );
        marker.on("click", () => setActive(p.id));
        markerMap.set(p.id, marker);
      });

      const points = placed.map((p) => [p.lat, p.lng] as [number, number]);
      if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.35), { maxZoom: 16 });
      else map.setView(points[0] ?? [center.lat, center.lng], 15);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerMap.clear();
    };
    // Pins are static for the page; re-running would rebuild the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusPin = (id: string) => {
    setActive(id);
    const marker = markers.current.get(id);
    if (marker && mapRef.current) {
      mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 16), { duration: 0.6 });
      marker.openPopup();
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <h3 className="mb-4 text-2xl">Projects in {locationName}</h3>
        {placed.length ? (
          <ol className="divide-y divide-border border-y border-border">
            {placed.map((p, i) => (
              <li key={p.id} className={cn("flex items-center gap-3 py-3", active === p.id && "bg-muted/60")}>
                <button
                  type="button"
                  onClick={() => focusPin(p.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Show ${p.name} on the map`}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.subtitle}{p.approximate ? " · approximate pin" : ""}</span>
                  </span>
                </button>
                <Link href={p.href} className="inline-flex size-9 shrink-0 items-center justify-center text-primary hover:bg-muted" aria-label={`View ${p.name}`}>
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No published projects in this location yet.</p>
        )}
        {hasApproximate ? (
          <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Outlined pins show an approximate position within {locationName}; contact our team for the exact address.
          </p>
        ) : null}
      </div>
      <div className="lg:col-span-7">
        <div
          ref={mapEl}
          role="region"
          aria-label={`Map of PCI projects in ${locationName}`}
          className="pci-map h-[360px] w-full overflow-hidden border border-border bg-muted sm:h-[440px] lg:sticky lg:top-28 lg:h-[520px]"
        />
      </div>
    </div>
  );
}
