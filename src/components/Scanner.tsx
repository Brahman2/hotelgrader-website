import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLon } from '../lib/geo';

// The regional scanner: a real street map centred on the hotel, with a radar
// sweep over it while the scan runs. Nearby competitors drop in as numbered
// pins. Hotels that could not be located are left off rather than guessed.

export interface Blip { n: number; name: string; lat: number; lon: number }

// OpenStreetMap's own tiles, restyled per theme with CSS filters (global.css).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const pin = (html: string, size: number) => L.divIcon({ className: '', html, iconSize: [size, size] });
const label = (text: string) => { const s = document.createElement('span'); s.textContent = text; return s; };

export default function Scanner({ center, blips, scanning, hotel, approximate }: {
  center: LatLon | null; blips: Blip[]; scanning: boolean; hotel: string; approximate?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);

  // Create the map once the hotel is located.
  useEffect(() => {
    if (!el.current || !center) return;
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false })
      .setView([center.lat, center.lon], approximate ? 13 : 16);
    m.attributionControl.setPrefix(false);
    L.tileLayer(TILES, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m);
    pins.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; pins.current = null; };
  }, [center?.lat, center?.lon, approximate]);

  // Pins: the hotel in the middle, competitors around it. The view widens to
  // fit them all while keeping the hotel centred.
  useEffect(() => {
    const m = map.current;
    const g = pins.current;
    if (!m || !g || !center) return;
    g.clearLayers();
    if (!approximate) {
      L.marker([center.lat, center.lon], { icon: pin('<span class="map-home"></span>', 18), zIndexOffset: 1000 })
        .bindTooltip(label(hotel), { direction: 'top', offset: [0, -10] })
        .addTo(g);
    }
    blips.forEach((b) => {
      L.marker([b.lat, b.lon], { icon: pin(`<span class="map-pin">${b.n}</span>`, 22) })
        .bindTooltip(label(b.name), { direction: 'top', offset: [0, -12] })
        .addTo(g);
    });
    if (blips.length) {
      const dLat = Math.max(...blips.map((b) => Math.abs(b.lat - center.lat)));
      const dLon = Math.max(...blips.map((b) => Math.abs(b.lon - center.lon)));
      m.fitBounds(
        [[center.lat - dLat, center.lon - dLon], [center.lat + dLat, center.lon + dLon]],
        { padding: [36, 36], maxZoom: 17 },
      );
    }
  }, [center, blips, hotel, approximate]);

  const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;

  return (
    <figure className="scanner m-0">
      <div className="map" role="img"
        aria-label={blips.length ? `Map of ${hotel} and ${blips.length} nearby competing hotels` : `Map of the area around ${hotel}`}>
        <div ref={el} className="map-canvas" />
        {scanning && <div className="map-rings" aria-hidden="true" />}
        {scanning && <div className="map-sweep" aria-hidden="true" />}
        {!center && <div className="map-empty meta">{scanning ? 'locating the hotel' : 'couldn’t place this hotel on the map'}</div>}
      </div>
      {center && (
        <figcaption className="meta num mt-3">
          {approximate ? 'Showing the city. We couldn’t pin the exact address.' : `${fmt(center.lat, 'N', 'S')}  ${fmt(center.lon, 'E', 'W')}`}
        </figcaption>
      )}
    </figure>
  );
}
