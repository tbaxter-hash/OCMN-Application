"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type ExpressionSpecification, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AREA_ORDER,
  AREA_STYLE,
  INSIGHTS,
  fmt,
  type AreaKey,
  type Church,
  type CountyProps,
  type GeoData,
  type InsightMode,
} from "@/lib/churchMap";
import styles from "./churchMap.module.css";

const BASEMAP = "https://tiles.openfreemap.org/styles/positron";
const OHIO_BOUNDS: [number, number, number, number] = [-84.82, 38.4, -80.52, 41.98];

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#efece4" } }],
};

type Props = {
  geo: GeoData;
  churches: Church[];
  visibleIds: Set<number>;
  selectedArea: AreaKey | null;
  selectedRegion: number | null;
  selectedChurch: Church | null;
  hoveredChurchId: number | null;
  insight: InsightMode;
  padding: { left: number; bottom: number; right: number; top: number };
  resetToken: number;
  onSelectChurch: (id: number) => void;
  onSelectArea: (key: AreaKey) => void;
};

const areaColorExpr = (prop: "color" | "ink"): ExpressionSpecification =>
  ["match", ["get", "area"], ...AREA_ORDER.flatMap((k) => [k, AREA_STYLE[k][prop]]), "#777"] as unknown as ExpressionSpecification;

function bboxOf(coords: number[][]): [number, number, number, number] {
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const [x, y] of coords) {
    w = Math.min(w, x);
    s = Math.min(s, y);
    e = Math.max(e, x);
    n = Math.max(n, y);
  }
  return [w, s, e, n];
}

function flatCoords(g: GeoJSON.Geometry): number[][] {
  if (g.type === "Polygon") return g.coordinates.flat();
  if (g.type === "MultiPolygon") return g.coordinates.flat(2);
  return [];
}

/** Keep padding inside the canvas so fitBounds/flyTo never fail on small screens. */
function fitPad(el: HTMLElement | null, p: Props["padding"]) {
  const w = el?.clientWidth ?? 1000;
  const h = el?.clientHeight ?? 800;
  const sx = Math.min(1, (w - 60) / Math.max(1, p.left + p.right));
  const sy = Math.min(1, (h - 60) / Math.max(1, p.top + p.bottom));
  return { left: p.left * sx, right: p.right * sx, top: p.top * sy, bottom: p.bottom * sy };
}

async function loadStyle(): Promise<StyleSpecification | string> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(BASEMAP, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as StyleSpecification;
  } catch {
    return FALLBACK_STYLE;
  }
}

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const propsRef = useRef(props);
  const selMarker = useRef<maplibregl.Marker | null>(null);
  const labelMarkers = useRef<{ key: AreaKey; marker: maplibregl.Marker }[]>([]);

  useEffect(() => {
    propsRef.current = props;
  });

  // ---- create map once -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | null = null;
    const { geo, churches } = propsRef.current;

    loadStyle().then((style) => {
      if (cancelled || !el.current) return;
      map = new maplibregl.Map({
        container: el.current,
        style,
        bounds: OHIO_BOUNDS,
        fitBoundsOptions: { padding: fitPad(el.current, propsRef.current.padding) },
        maxBounds: [-98, 30, -66, 49],
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");

      map.on("load", () => {
        const m = map!;
        const firstSymbol = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
        // Muted base map so Ohio + the pins carry the colour.
        for (const l of m.getStyle().layers) {
          if (l.type === "symbol" && /poi|housenum|shield|oneway/.test(l.id)) m.setLayoutProperty(l.id, "visibility", "none");
        }

        m.addSource("mask", { type: "geojson", data: geo.mask });
        m.addSource("state", { type: "geojson", data: geo.state });
        m.addSource("areas", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: geo.areas.features.map((f) => ({ ...f, properties: { ...f.properties, area: f.properties.key } })),
          },
        });
        m.addSource("regions", { type: "geojson", data: geo.regionShapes });
        m.addSource("counties", { type: "geojson", data: geo.counties, promoteId: "geoid" });
        m.addSource("churches", {
          type: "geojson",
          promoteId: "id",
          data: {
            type: "FeatureCollection",
            features: churches.map((c) => ({
              type: "Feature",
              properties: { id: c.id, area: c.area, name: c.name, city: c.city, att: c.attendance ?? 0 },
              geometry: { type: "Point", coordinates: [c.lon, c.lat] },
            })),
          },
        });

        m.addLayer({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": "#f4f1ea", "fill-opacity": 0.72 } }, firstSymbol);
        m.addLayer({ id: "area-fill", type: "fill", source: "areas", paint: { "fill-color": areaColorExpr("color"), "fill-opacity": 0.28 } }, firstSymbol);
        m.addLayer(
          {
            id: "insight-fill",
            type: "fill",
            source: "counties",
            layout: { visibility: "none" },
            paint: { "fill-color": "#ccc", "fill-opacity": 0.82 },
          },
          firstSymbol,
        );
        m.addLayer(
          {
            id: "county-hover",
            type: "line",
            source: "counties",
            paint: {
              "line-color": "#26241f",
              "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 0],
            },
          },
          firstSymbol,
        );
        m.addLayer(
          {
            id: "county-line",
            type: "line",
            source: "counties",
            paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 10, 1.4], "line-opacity": 0.9 },
          },
          firstSymbol,
        );
        m.addLayer(
          {
            id: "area-line",
            type: "line",
            source: "areas",
            paint: { "line-color": areaColorExpr("ink"), "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.2, 10, 2.4], "line-opacity": 0.75 },
          },
          firstSymbol,
        );
        m.addLayer(
          {
            id: "region-line",
            type: "line",
            source: "regions",
            layout: { "line-join": "round" },
            paint: { "line-color": "#26241f", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.6, 10, 3], "line-opacity": 0.55 },
          },
          firstSymbol,
        );
        m.addLayer({
          id: "area-selected",
          type: "line",
          source: "areas",
          filter: ["==", ["get", "key"], ""],
          layout: { "line-join": "round" },
          paint: { "line-color": areaColorExpr("ink"), "line-width": 3.5 },
        });
        m.addLayer({
          id: "state-glow",
          type: "line",
          source: "state",
          paint: { "line-color": "#26241f", "line-width": 9, "line-opacity": 0.08, "line-blur": 6 },
        });
        m.addLayer({ id: "state-line", type: "line", source: "state", layout: { "line-join": "round" }, paint: { "line-color": "#26241f", "line-width": 2 } });

        // Zoom must be the top-level interpolate input, so the hover bump goes inside each stop.
        const radius = (onHover: number, base: number): ExpressionSpecification => {
          const bump: ExpressionSpecification = ["case", ["boolean", ["feature-state", "hover"], false], onHover, base];
          return ["interpolate", ["linear"], ["zoom"], 5.5, ["+", 3.8, bump], 7, ["+", 4.6, bump], 9, ["+", 6, bump], 12, ["+", 8, bump], 15, ["+", 10, bump]];
        };
        m.addLayer({
          id: "church-halo",
          type: "circle",
          source: "churches",
          paint: {
            "circle-radius": radius(5, 1.8),
            "circle-color": "#ffffff",
            "circle-opacity": 1,
          },
        });
        m.addLayer({
          id: "church-pin",
          type: "circle",
          source: "churches",
          paint: {
            "circle-radius": radius(2.5, 0),
            "circle-color": areaColorExpr("ink"),
            "circle-stroke-color": areaColorExpr("color"),
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 12, 2],
          },
        });

        // Area name labels (HTML so they don't depend on the base map's fonts).
        labelMarkers.current = geo.areas.features.map((f) => {
          const b = document.createElement("button");
          b.className = styles.areaLabel;
          b.type = "button";
          b.style.setProperty("--c", AREA_STYLE[f.properties.key].ink);
          b.textContent = f.properties.name;
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            propsRef.current.onSelectArea(f.properties.key);
          });
          const marker = new maplibregl.Marker({ element: b }).setLngLat(f.properties.label).addTo(m);
          return { key: f.properties.key, marker };
        });

        // ---- interaction ---------------------------------------------------------------
        const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: styles.tip, maxWidth: "280px" });
        let hoverId: number | null = null;
        let hoverCounty: string | null = null;
        const setHover = (id: number | null) => {
          if (hoverId != null) m.setFeatureState({ source: "churches", id: hoverId }, { hover: false });
          hoverId = id;
          if (id != null) m.setFeatureState({ source: "churches", id }, { hover: true });
        };
        const setCountyHover = (id: string | null) => {
          if (hoverCounty != null) m.setFeatureState({ source: "counties", id: hoverCounty }, { hover: false });
          hoverCounty = id;
          if (id != null) m.setFeatureState({ source: "counties", id }, { hover: true });
        };

        m.on("mousemove", (e) => {
          const pins = m.queryRenderedFeatures(e.point, { layers: ["church-pin"] });
          const pin = pins.find((p) => propsRef.current.visibleIds.has(Number(p.properties.id)));
          if (pin) {
            setCountyHover(null);
            m.getCanvas().style.cursor = "pointer";
            setHover(Number(pin.properties.id));
            const near = pins.filter((p) => propsRef.current.visibleIds.has(Number(p.properties.id)));
            const extra = near.length > 1 ? `<div class="${styles.tipMore}">+${near.length - 1} more here — zoom in</div>` : "";
            tip
              .setLngLat((pin.geometry as GeoJSON.Point).coordinates as [number, number])
              .setHTML(`<strong>${escapeHtml(String(pin.properties.name))}</strong><span>${escapeHtml(String(pin.properties.city))}</span>${extra}`)
              .addTo(m);
            return;
          }
          setHover(null);
          if (propsRef.current.insight !== "areas") {
            const c = m.queryRenderedFeatures(e.point, { layers: ["insight-fill"] })[0];
            if (c) {
              const p = c.properties as unknown as CountyProps & { areas: string };
              setCountyHover(String(c.id));
              m.getCanvas().style.cursor = "";
              tip.setLngLat(e.lngLat).setHTML(countyTip(p, propsRef.current.insight)).addTo(m);
              return;
            }
          }
          setCountyHover(null);
          const a = m.queryRenderedFeatures(e.point, { layers: ["area-fill"] })[0];
          m.getCanvas().style.cursor = a ? "pointer" : "";
          tip.remove();
        });
        m.getCanvas().addEventListener("mouseleave", () => {
          setHover(null);
          setCountyHover(null);
          tip.remove();
        });
        m.on("click", (e) => {
          const pins = m
            .queryRenderedFeatures(e.point, { layers: ["church-pin"] })
            .filter((p) => propsRef.current.visibleIds.has(Number(p.properties.id)));
          if (pins.length) {
            tip.remove();
            propsRef.current.onSelectChurch(Number(pins[0].properties.id));
            return;
          }
          const a = m.queryRenderedFeatures(e.point, { layers: ["area-fill"] })[0];
          if (a) propsRef.current.onSelectArea(a.properties.key as AreaKey);
        });
        m.on("zoom", () => updateLabels(m));
        readyRef.current = true;
        setReady(true);
        applyAll(m);
        updateLabels(m);
      });
    });

    return () => {
      cancelled = true;
      readyRef.current = false;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLabels(m: maplibregl.Map) {
    const z = m.getZoom();
    const { selectedArea } = propsRef.current;
    for (const { key, marker } of labelMarkers.current) {
      const elx = marker.getElement();
      const show = z < 8.4 || (key === selectedArea && z < 9.5);
      elx.style.opacity = show ? (selectedArea && key !== selectedArea ? "0.45" : "1") : "0";
      elx.style.pointerEvents = show ? "auto" : "none";
    }
  }

  function applyAll(m: maplibregl.Map) {
    const { visibleIds, selectedArea, selectedRegion, insight } = propsRef.current;
    const ids = [...visibleIds];
    const vis: ExpressionSpecification = ["in", ["get", "id"], ["literal", ids]];
    m.setPaintProperty("church-pin", "circle-opacity", ["case", vis, 1, 0.12]);
    m.setPaintProperty("church-pin", "circle-stroke-opacity", ["case", vis, 1, 0.12]);
    m.setPaintProperty("church-halo", "circle-opacity", ["case", vis, 1, 0]);
    m.setLayoutProperty("church-halo", "circle-sort-key", ["case", vis, 1, 0]);
    m.setLayoutProperty("church-pin", "circle-sort-key", ["case", vis, 1, 0]);

    const focus: ExpressionSpecification | null = selectedArea
      ? ["==", ["get", "key"], selectedArea]
      : selectedRegion
        ? ["==", ["get", "region"], selectedRegion]
        : null;
    m.setPaintProperty("area-fill", "fill-opacity", focus ? ["case", focus, 0.36, 0.07] : 0.28);
    m.setFilter("area-selected", focus ?? ["==", ["get", "key"], ""]);

    const on = insight !== "areas";
    m.setLayoutProperty("insight-fill", "visibility", on ? "visible" : "none");
    m.setLayoutProperty("area-fill", "visibility", on ? "none" : "visible");
    if (on) {
      const cfg = INSIGHTS[insight];
      const field = insight === "perChurch" ? "peoplePerAgChurch" : "unclaimedPct";
      const steps: (string | number)[] = [cfg.colors[0]];
      cfg.stops.forEach((s, i) => steps.push(s, cfg.colors[i + 1]));
      const noChurch = insight === "perChurch";
      m.setPaintProperty("insight-fill", "fill-color", [
        "case",
        ["==", ["get", field], null],
        noChurch ? "#2e2a33" : "#ddd",
        ["step", ["get", field], ...steps],
      ] as unknown as ExpressionSpecification);
      m.setPaintProperty("insight-fill", "fill-opacity", ["case", ["==", ["get", field], null], noChurch ? 0.9 : 0.4, 0.85]);
    }
    updateLabels(m);
  }

  // ---- react to prop changes -----------------------------------------------------------
  useEffect(() => {
    const m = mapRef.current;
    if (m && readyRef.current) applyAll(m);
  });

  // Fly to the selected area / region.
  const { selectedArea, selectedRegion, selectedChurch, resetToken, geo } = props;
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready || selectedChurch) return;
    {
      const pad = fitPad(el.current, propsRef.current.padding);
      let coords: number[][] = [];
      if (selectedArea) coords = flatCoords(geo.areas.features.find((f) => f.properties.key === selectedArea)!.geometry);
      else if (selectedRegion) coords = flatCoords(geo.regionShapes.features.find((f) => f.properties.region === selectedRegion)!.geometry);
      const b = coords.length ? bboxOf(coords) : OHIO_BOUNDS;
      m.fitBounds(b, { padding: pad, duration: 900, maxZoom: 11 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArea, selectedRegion, resetToken, ready]);

  // Fly to + mark the selected church.
  useEffect(() => {
    const m = mapRef.current;
    selMarker.current?.remove();
    selMarker.current = null;
    if (!m || !ready || !selectedChurch) return;
    const c = selectedChurch;
    const node = document.createElement("div");
    node.className = styles.selPin;
    node.style.setProperty("--c", AREA_STYLE[c.area].ink);
    node.innerHTML = `<span class="${styles.selPulse}"></span><svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z" fill="var(--c)" stroke="#fff" stroke-width="2"/><path d="M16 8.5v14M11 13.2h10" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    selMarker.current = new maplibregl.Marker({ element: node, anchor: "bottom" }).setLngLat([c.lon, c.lat]).addTo(m);
    m.flyTo({
      center: [c.lon, c.lat],
      zoom: Math.max(m.getZoom(), c.inOhio ? 12.5 : 10),
      padding: fitPad(el.current, propsRef.current.padding),
      duration: 1100,
      essential: true,
    });
  }, [selectedChurch, ready]);

  // Highlight the pin that's hovered in the side list.
  const hovered = props.hoveredChurchId;
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready || hovered == null) return;
    m.setFeatureState({ source: "churches", id: hovered }, { hover: true });
    return () => {
      if (mapRef.current && readyRef.current) m.setFeatureState({ source: "churches", id: hovered }, { hover: false });
    };
  }, [hovered, ready]);

  return <div ref={el} className={styles.map} aria-label="Map of Ohio Ministry Network churches" role="region" />;
}

function countyTip(p: CountyProps & { areas: string }, mode: InsightMode) {
  const areas = (typeof p.areas === "string" ? JSON.parse(p.areas) : p.areas) as AreaKey[];
  const label = mode === "perChurch" ? "People per AG church" : "Unclaimed";
  const val =
    mode === "perChurch"
      ? p.peoplePerAgChurch
        ? fmt(p.peoplePerAgChurch)
        : "No AG church"
      : p.unclaimedPct != null
        ? `${p.unclaimedPct}%`
        : "—";
  return `<strong>${escapeHtml(p.name)} County</strong><span>${areas.map((a) => escapeHtml(titleArea(a))).join(" / ")}</span>
  <div class="${styles.tipStat}"><b>${val}</b> ${label}</div>
  <div class="${styles.tipGrid}"><span>Population</span><b>${fmt(p.population)}</b><span>AG churches</span><b>${fmt(p.agChurches)}</b></div>`;
}

function titleArea(a: string) {
  return a.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, x, y) => x + y.toUpperCase());
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
