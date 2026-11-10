"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AREA_ORDER,
  AREA_STYLE,
  INSIGHTS,
  directionsUrl,
  fmt,
  formatPastor,
  formatPhone,
  milesBetween,
  searchText,
  titleCase,
  type AreaKey,
  type AreaProps,
  type Church,
  type CountyProps,
  type GeoData,
  type InsightMode,
} from "@/lib/churchMap";
import styles from "./churchMap.module.css";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

type Data = { geo: GeoData; churches: Church[] };

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 820px)");
    const on = () => setNarrow(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return narrow;
}

export default function ChurchMapApp() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/church-map/geo.json").then((r) => r.json()),
      fetch("/church-map/churches.json").then((r) => r.json()),
    ])
      .then(([geo, churches]) => setData({ geo, churches }))
      .catch(() => setError(true));
  }, []);

  if (error) return <div className={styles.fatal}>The church map data could not be loaded. Please refresh the page.</div>;
  if (!data) return <div className={styles.fatal}>Loading the Ohio Ministry Network church map…</div>;
  return <Explorer geo={data.geo} churches={data.churches} />;
}

function Explorer({ geo, churches }: Data) {
  const narrow = useIsNarrow();
  const [region, setRegion] = useState<number | null>(null);
  const [area, setArea] = useState<AreaKey | null>(null);
  const [churchId, setChurchId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [insight, setInsight] = useState<InsightMode>("areas");
  const [hovered, setHovered] = useState<number | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(true);
  const q = useDeferredValue(query.trim().toLowerCase());

  const areaByKey = useMemo(
    () => Object.fromEntries(geo.areas.features.map((f) => [f.properties.key, f.properties])) as Record<AreaKey, AreaProps>,
    [geo],
  );
  const countyByName = useMemo(
    () => Object.fromEntries(geo.counties.features.map((f) => [f.properties.name, f.properties])) as Record<string, CountyProps>,
    [geo],
  );
  const execByRegion = useMemo(() => Object.fromEntries(geo.regions.map((r) => [r.id, r.executivePresbyter])), [geo]);
  const index = useMemo(() => churches.map((c) => [c, searchText(c)] as const), [churches]);
  const church = churchId != null ? (churches.find((c) => c.id === churchId) ?? null) : null;

  // ---- URL state (shareable links) ---------------------------------------------------
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get("area")?.toUpperCase() as AreaKey | undefined;
    const r = Number(p.get("region"));
    const c = Number(p.get("church"));
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the shared link */
    if (a && AREA_ORDER.includes(a)) {
      setArea(a);
      setRegion(areaByKey[a].region);
    } else if (r >= 1 && r <= 7) setRegion(r);
    if (c && churches.some((x) => x.id === c)) {
      setChurchId(c);
      if (window.matchMedia("(max-width: 820px)").matches) setSheetOpen(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [areaByKey, churches]);
  useEffect(() => {
    const p = new URLSearchParams();
    if (area) p.set("area", area.toLowerCase());
    else if (region) p.set("region", String(region));
    if (churchId) p.set("church", String(churchId));
    const s = p.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [area, region, churchId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (churchId != null) setChurchId(null);
      else if (area) setArea(null);
      else if (region) setRegion(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [churchId, area, region]);

  // ---- derived -------------------------------------------------------------------------
  const scoped = useMemo(
    () => churches.filter((c) => (area ? c.area === area : region ? areaByKey[c.area].region === region : true)),
    [churches, area, region, areaByKey],
  );
  const matches = useMemo(() => (q ? index.filter(([, t]) => t.includes(q)).map(([c]) => c) : null), [index, q]);
  const visibleIds = useMemo(() => new Set((matches ?? scoped).map((c) => c.id)), [matches, scoped]);
  const countsByArea = useMemo(() => {
    const m = {} as Record<AreaKey, number>;
    for (const c of churches) m[c.area] = (m[c.area] ?? 0) + 1;
    return m;
  }, [churches]);
  const totalAttendance = useMemo(() => churches.reduce((s, c) => s + (c.attendance ?? 0), 0), [churches]);

  const selectArea = useCallback(
    (k: AreaKey) => {
      setChurchId(null);
      setQuery("");
      setArea(k);
      setRegion(areaByKey[k].region);
      setSheetOpen(true);
    },
    [areaByKey],
  );
  const selectChurch = useCallback(
    (id: number) => {
      setChurchId(id);
      // On phones the card takes the top of the screen; tuck the sheet away so the pin stays visible.
      setSheetOpen(!narrow);
    },
    [narrow],
  );
  const goHome = () => {
    setChurchId(null);
    setArea(null);
    setRegion(null);
    setQuery("");
    setResetToken((t) => t + 1);
  };

  const padding = narrow
    ? {
        left: 24,
        right: 24,
        top: church ? Math.round(window.innerHeight * 0.56) : 70,
        bottom: sheetOpen ? Math.round(window.innerHeight * 0.46) : 90,
      }
    : { left: 452, right: church ? 420 : 40, top: 80, bottom: 40 };

  return (
    <div className={styles.shell}>
      <div className={styles.mapWrap}>
        <MapView
          geo={geo}
          churches={churches}
          visibleIds={visibleIds}
          selectedArea={area}
          selectedRegion={region}
          selectedChurch={church}
          hoveredChurchId={hovered}
          insight={insight}
          padding={padding}
          resetToken={resetToken}
          onSelectChurch={selectChurch}
          onSelectArea={selectArea}
        />
      </div>

      {/* ---------- top-right map controls ---------- */}
      <div className={styles.mapTools}>
        <div className={styles.segment} role="radiogroup" aria-label="Map colouring">
          {(
            [
              ["areas", "Areas"],
              ["perChurch", "People / AG church"],
              ["unclaimed", "Unclaimed %"],
            ] as [InsightMode, string][]
          ).map(([k, label]) => (
            <button key={k} role="radio" aria-checked={insight === k} className={insight === k ? styles.segOn : ""} onClick={() => setInsight(k)}>
              {label}
            </button>
          ))}
        </div>
        {insight !== "areas" && <Legend mode={insight} />}
      </div>

      {/* ---------- side panel ---------- */}
      <aside className={`${styles.panel} ${narrow && !sheetOpen ? styles.panelCollapsed : ""}`} aria-label="Church directory">
        {narrow && (
          <button className={styles.grabber} onClick={() => setSheetOpen((o) => !o)} aria-label={sheetOpen ? "Collapse panel" : "Expand panel"}>
            <span />
          </button>
        )}
        <header className={styles.brand}>
          <button className={styles.brandHome} onClick={goHome} aria-label="Show all of Ohio">
            <OhioMark />
            <div>
              <div className={styles.eyebrow}>Ohio Ministry Network</div>
              <h1 className={styles.title}>Church Map</h1>
            </div>
          </button>
          <div className={styles.kpis}>
            <Kpi n={fmt(churches.length)} l="churches" />
            <Kpi n="14" l="areas" />
            <Kpi n="7" l="regions" />
            <Kpi n={fmt(totalAttendance)} l="Sunday AM" />
          </div>
        </header>

        <div className={styles.searchRow}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search church, city, pastor, county or ZIP"
            aria-label="Search churches"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className={styles.clear}>
              ×
            </button>
          )}
        </div>

        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <button onClick={goHome} className={!region ? styles.crumbOn : ""}>
            All Ohio
          </button>
          {region && (
            <>
              <span>›</span>
              <button
                onClick={() => {
                  setArea(null);
                  setChurchId(null);
                }}
                className={!area ? styles.crumbOn : ""}
              >
                Region {region}
              </button>
            </>
          )}
          {area && (
            <>
              <span>›</span>
              <button className={styles.crumbOn} onClick={() => setChurchId(null)}>
                {areaByKey[area].name}
              </button>
            </>
          )}
        </nav>

        <div className={styles.scroll}>
          {matches ? (
            <SearchResults
              list={matches}
              areaByKey={areaByKey}
              onPick={selectChurch}
              onHover={setHovered}
              selectedId={churchId}
              query={query}
            />
          ) : area ? (
            <AreaView
              area={areaByKey[area]}
              exec={execByRegion[areaByKey[area].region]}
              list={scoped}
              countyByName={countyByName}
              onPick={selectChurch}
              onHover={setHovered}
              selectedId={churchId}
            />
          ) : (
            <RegionList
              geo={geo}
              areaByKey={areaByKey}
              execByRegion={execByRegion}
              counts={countsByArea}
              churches={churches}
              focusRegion={region}
              onRegion={(r) => {
                setChurchId(null);
                setArea(null);
                setRegion(r === region ? null : r);
              }}
              onArea={selectArea}
            />
          )}
        </div>
        <footer className={styles.foot}>
          Areas &amp; presbyters: ohioministry.net · Church statistics: 2024 AG ACMR via the CMN Insight Map · County outlines: U.S. Census
        </footer>
      </aside>

      {church && (
        <ChurchCard
          c={church}
          area={areaByKey[church.area]}
          exec={execByRegion[areaByKey[church.area].region]}
          county={church.county ? countyByName[church.county] : null}
          churches={churches}
          onClose={() => setChurchId(null)}
          onPick={selectChurch}
          onArea={selectArea}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------ */

function Kpi({ n, l }: { n: string; l: string }) {
  return (
    <div className={styles.kpi}>
      <b>{n}</b>
      <span>{l}</span>
    </div>
  );
}

function OhioMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="var(--blue-700)" />
      <path
        d="M10 9.5l8.3-.4 2.7 1.3 3.6-.6 5.3-3.3.4 13.6-1 2.6-1.8 3.4-1.4 3.2-1.8.6-1.6 2.5-2.1 1.2-2.6-1.2-3.4.6-2.2-1.5-1.1-1.5L10 30z"
        fill="#fff"
      />
      <circle cx="21.5" cy="20" r="2.4" fill="var(--ember-500)" />
    </svg>
  );
}

function Swatch({ k, size = 12 }: { k: AreaKey; size?: number }) {
  return <span className={styles.swatch} style={{ width: size, height: size, background: AREA_STYLE[k].color, borderColor: AREA_STYLE[k].ink }} />;
}

function RegionList({
  geo,
  areaByKey,
  execByRegion,
  counts,
  churches,
  focusRegion,
  onRegion,
  onArea,
}: {
  geo: GeoData;
  areaByKey: Record<AreaKey, AreaProps>;
  execByRegion: Record<number, string>;
  counts: Record<AreaKey, number>;
  churches: Church[];
  focusRegion: number | null;
  onRegion: (r: number) => void;
  onArea: (k: AreaKey) => void;
}) {
  const outside = churches.filter((c) => !c.inOhio);
  return (
    <div className={styles.regions}>
      <p className={styles.lede}>
        Choose a region or area to see its churches and presbyters, or tap any pin on the map.
      </p>
      {[...geo.regions].sort((a, b) => Number(b.id === focusRegion) - Number(a.id === focusRegion)).map((r) => {
        const keys = AREA_ORDER.filter((k) => areaByKey[k].region === r.id);
        const n = keys.reduce((s, k) => s + (counts[k] ?? 0), 0);
        const dim = focusRegion != null && focusRegion !== r.id;
        return (
          <section key={r.id} className={`${styles.region} ${dim ? styles.regionDim : ""} ${focusRegion === r.id ? styles.regionOn : ""}`}>
            <button className={styles.regionHead} onClick={() => onRegion(r.id)}>
              <span className={styles.regionNum}>{r.id}</span>
              <span className={styles.regionText}>
                <b>Region {r.id}</b>
                <small>{execByRegion[r.id]} · Executive Presbyter</small>
              </span>
              <span className={styles.count}>{n}</span>
            </button>
            {keys.map((k) => (
              <button key={k} className={styles.areaRow} onClick={() => onArea(k)} style={{ ["--c" as string]: AREA_STYLE[k].ink }}>
                <Swatch k={k} />
                <span className={styles.areaText}>
                  <b>{areaByKey[k].name}</b>
                  <small>{areaByKey[k].presbyter} · Area Presbyter</small>
                </span>
                <span className={styles.areaCount}>{counts[k] ?? 0}</span>
                <span className={styles.chev} aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </section>
        );
      })}
      {outside.length > 0 && (
        <p className={styles.outsideNote}>
          {outside.length} OMN churches are located outside Ohio ({outside.map((c) => `${c.city}, ${c.state}`).join("; ")}). They appear
          in their area lists and on the map when selected.
        </p>
      )}
    </div>
  );
}

function aggregate(list: Church[]) {
  const sum = (f: (c: Church) => number | null) => list.reduce((s, c) => s + (f(c) ?? 0), 0);
  return {
    attendance: sum((c) => c.attendance),
    conversions: sum((c) => c.conversions),
    water: sum((c) => c.waterBaptisms),
    spirit: sum((c) => c.spiritBaptisms),
  };
}

function AreaView({
  area,
  exec,
  list,
  countyByName,
  onPick,
  onHover,
  selectedId,
}: {
  area: AreaProps;
  exec: string;
  list: Church[];
  countyByName: Record<string, CountyProps>;
  onPick: (id: number) => void;
  onHover: (id: number | null) => void;
  selectedId: number | null;
}) {
  const [sort, setSort] = useState<"city" | "name" | "attendance">("city");
  const agg = aggregate(list);
  const shared = area.counties.filter((n) => countyByName[n].areas.length > 1);
  const whole = area.counties.filter((n) => countyByName[n].areas.length === 1);
  const pop = whole.reduce((s, n) => s + (countyByName[n].population ?? 0), 0);
  const empty = whole.filter((n) => !countyByName[n].agChurches);
  const sorted = [...list].sort((a, b) =>
    sort === "attendance"
      ? (b.attendance ?? 0) - (a.attendance ?? 0)
      : sort === "name"
        ? a.name.localeCompare(b.name)
        : a.cityArea.localeCompare(b.cityArea) || a.name.localeCompare(b.name),
  );
  const s = AREA_STYLE[area.key];

  return (
    <div className={styles.areaView}>
      <div className={styles.areaHero} style={{ ["--c" as string]: s.color, ["--ink" as string]: s.ink }}>
        <div className={styles.areaHeroTag}>Region {area.region}</div>
        <h2>{area.name}</h2>
        <div className={styles.people}>
          <Person name={area.presbyter} role="Area Presbyter" />
          <Person name={exec} role={`Region ${area.region} Executive Presbyter`} />
        </div>
      </div>

      <div className={styles.statGrid}>
        <Stat n={fmt(list.length)} l="Churches" />
        <Stat n={fmt(agg.attendance)} l="Sunday AM" />
        <Stat n={fmt(agg.conversions)} l="Conversions" />
        <Stat n={fmt(agg.water)} l="Water baptisms" />
      </div>

      <div className={styles.block}>
        <h3>Counties</h3>
        <div className={styles.chips}>
          {whole.map((n) => (
            <span key={n} className={`${styles.chip} ${!countyByName[n].agChurches ? styles.chipEmpty : ""}`} title={countyTitle(countyByName[n])}>
              {n}
            </span>
          ))}
          {shared.map((n) => (
            <span key={n} className={`${styles.chip} ${styles.chipShared}`} title={`${n} County is shared by Greater Columbus West and East`}>
              {n} <em>shared</em>
            </span>
          ))}
        </div>
        <p className={styles.fine}>
          {fmt(pop)} people live in the {whole.length} {whole.length === 1 ? "county" : "counties"} wholly in this area
          {shared.length ? `, plus part of ${shared.join(" and ")} (split with the other Columbus area)` : ""}.{" "}
          {empty.length > 0 && (
            <>
              <b>
                {empty.length} {empty.length === 1 ? "county has" : "counties have"} no AG church:
              </b>{" "}
              {empty.join(", ")}.
            </>
          )}
        </p>
      </div>

      <div className={styles.listHead}>
        <h3>Churches</h3>
        <label className={styles.sort}>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="city">By city</option>
            <option value="name">By name</option>
            <option value="attendance">By attendance</option>
          </select>
        </label>
      </div>
      <ChurchList list={sorted} onPick={onPick} onHover={onHover} selectedId={selectedId} groupByCity={sort === "city"} />
    </div>
  );
}

function countyTitle(c: CountyProps) {
  return `${c.name} County · pop. ${fmt(c.population)} · ${fmt(c.agChurches)} AG churches${
    c.peoplePerAgChurch ? ` · ${fmt(c.peoplePerAgChurch)} people per AG church` : ""
  } · ${c.unclaimedPct}% unclaimed`;
}

function Person({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <div className={styles.person}>
      <span className={styles.avatar}>{initials}</span>
      <span>
        <b>{name}</b>
        <small>{role}</small>
      </span>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className={styles.stat}>
      <b>{n}</b>
      <span>{l}</span>
    </div>
  );
}

function ChurchList({
  list,
  onPick,
  onHover,
  selectedId,
  groupByCity,
  showArea,
}: {
  list: Church[];
  onPick: (id: number) => void;
  onHover: (id: number | null) => void;
  selectedId: number | null;
  groupByCity?: boolean;
  showArea?: Record<AreaKey, AreaProps>;
}) {
  return (
    <ul className={styles.churches}>
      {list.map((c, i) => {
        const head = groupByCity && c.cityArea !== list[i - 1]?.cityArea ? c.cityArea : null;
        return (
          <li key={c.id}>
            {head && <div className={styles.cityHead}>{head}</div>}
            <button
              className={`${styles.churchRow} ${selectedId === c.id ? styles.churchRowOn : ""}`}
              onClick={() => onPick(c.id)}
              onMouseEnter={() => onHover(c.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(c.id)}
              onBlur={() => onHover(null)}
            >
              <span className={styles.dot} style={{ background: AREA_STYLE[c.area].ink, boxShadow: `0 0 0 2px ${AREA_STYLE[c.area].color}` }} />
              <span className={styles.churchText}>
                <b>{c.name}</b>
                <small>
                  {c.city}
                  {c.state !== "OH" ? `, ${c.state}` : ""}
                  {showArea ? ` · ${showArea[c.area].name}` : ""}
                  {c.pastor ? ` · ${formatPastor(c.pastor)}` : ""}
                </small>
              </span>
              {c.attendance ? (
                <span className={styles.att} title="Sunday morning attendance (2024)">
                  {fmt(c.attendance)}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SearchResults({
  list,
  areaByKey,
  onPick,
  onHover,
  selectedId,
  query,
}: {
  list: Church[];
  areaByKey: Record<AreaKey, AreaProps>;
  onPick: (id: number) => void;
  onHover: (id: number | null) => void;
  selectedId: number | null;
  query: string;
}) {
  return (
    <div>
      <p className={styles.resultsHead}>
        {list.length === 0 ? `No churches match “${query}”.` : `${list.length} ${list.length === 1 ? "church matches" : "churches match"} “${query}”`}
      </p>
      <ChurchList list={list} onPick={onPick} onHover={onHover} selectedId={selectedId} showArea={areaByKey} />
    </div>
  );
}

function ChurchCard({
  c,
  area,
  exec,
  county,
  churches,
  onClose,
  onPick,
  onArea,
}: {
  c: Church;
  area: AreaProps;
  exec: string;
  county: CountyProps | null;
  churches: Church[];
  onClose: () => void;
  onPick: (id: number) => void;
  onArea: (k: AreaKey) => void;
}) {
  const s = AREA_STYLE[c.area];
  const nearest = useMemo(
    () =>
      churches
        .filter((o) => o.id !== c.id)
        .map((o) => ({ o, d: milesBetween(c, o) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4),
    [c, churches],
  );
  const [copied, setCopied] = useState(false);
  const phone = formatPhone(c.phone);
  const pastor = formatPastor(c.pastor);
  const hasStats = c.attendance || c.conversions || c.waterBaptisms || c.spiritBaptisms || c.adherents;

  return (
    <article className={styles.card} style={{ ["--c" as string]: s.color, ["--ink" as string]: s.ink }} aria-label={c.name}>
      <div className={styles.cardBand}>
        <button className={styles.cardArea} onClick={() => onArea(c.area)}>
          <Swatch k={c.area} size={10} /> {area.name} · Region {area.region}
        </button>
        <button className={styles.close} onClick={onClose} aria-label="Close church details">
          ×
        </button>
      </div>
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>{c.name}</h2>
        <div className={styles.cardSub}>
          {titleCase(c.cityArea)}
          {c.county ? ` · ${c.county} County` : ""}
          {c.status ? ` · ${c.status}` : ""}
        </div>

        <div className={styles.actions}>
          <a className={styles.actPrimary} href={directionsUrl(c)} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 1.8l7.8 7.8-7.8 7.8-7.8-7.8z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M8 11.5V9.3h4M10.6 7.6l1.7 1.7-1.7 1.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Directions
          </a>
          {phone && (
            <a className={styles.act} href={`tel:${c.phone}`}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M6.2 2.8l2 3.6-1.5 1.6c.9 1.9 2.4 3.4 4.3 4.3l1.6-1.5 3.6 2-.8 3c-6.6.4-12-5-11.6-11.6z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              Call
            </a>
          )}
          <button
            className={styles.act}
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard?.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M8 12l4-4M7 9.5L5 11.5a2.5 2.5 0 003.5 3.5l2-2M13 10.5l2-2A2.5 2.5 0 0011.5 5l-2 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {copied ? "Copied!" : "Share link"}
          </button>
        </div>

        <dl className={styles.facts}>
          <dt>Address</dt>
          <dd>
            {c.street}
            <br />
            {c.city}, {c.state} {c.zip}
          </dd>
          {phone && (
            <>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${c.phone}`}>{phone}</a>
              </dd>
            </>
          )}
          <dt>Pastor</dt>
          <dd>{pastor ?? <span className={styles.muted}>Not listed</span>}</dd>
          <dt>Presbyters</dt>
          <dd>
            {area.presbyter} <span className={styles.muted}>(Area)</span>
            <br />
            {exec} <span className={styles.muted}>(Region {area.region})</span>
          </dd>
        </dl>

        {hasStats ? (
          <div className={styles.block}>
            <h3>2024 ministry report</h3>
            <div className={styles.statGrid}>
              <Stat n={fmt(c.attendance)} l="Sunday AM" />
              <Stat n={fmt(c.adherents)} l="Adherents" />
              <Stat n={fmt(c.conversions)} l="Conversions" />
              <Stat n={fmt(c.waterBaptisms)} l="Water baptisms" />
            </div>
          </div>
        ) : (
          <p className={styles.fine}>No 2024 ministry report numbers on file for this church.</p>
        )}

        {county && (
          <div className={styles.block}>
            <h3>{county.name} County context</h3>
            <div className={styles.ctx}>
              <div>
                <b>{fmt(county.population)}</b>
                <span>residents</span>
              </div>
              <div>
                <b>{county.peoplePerAgChurch ? fmt(county.peoplePerAgChurch) : "—"}</b>
                <span>people per AG church</span>
              </div>
              <div>
                <b>{county.unclaimedPct != null ? `${county.unclaimedPct}%` : "—"}</b>
                <span>unclaimed</span>
              </div>
            </div>
          </div>
        )}

        <div className={styles.block}>
          <h3>Nearest OMN churches</h3>
          <ul className={styles.near}>
            {nearest.map(({ o, d }) => (
              <li key={o.id}>
                <button onClick={() => onPick(o.id)}>
                  <span className={styles.dot} style={{ background: AREA_STYLE[o.area].ink, boxShadow: `0 0 0 2px ${AREA_STYLE[o.area].color}` }} />
                  <span className={styles.churchText}>
                    <b>{o.name}</b>
                    <small>{o.city}</small>
                  </span>
                  <span className={styles.dist}>{d < 0.1 ? "same site" : `${d < 10 ? d.toFixed(1) : Math.round(d)} mi`}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className={styles.fineSmall}>
          Pin placed from the {c.geocode === "esri" ? "CMN Insight Map (Esri) geocode" : "U.S. Census geocoder"} of the church’s physical
          address.
        </p>
      </div>
    </article>
  );
}

function Legend({ mode }: { mode: Exclude<InsightMode, "areas"> }) {
  const cfg = INSIGHTS[mode];
  const labels = [`< ${cfg.format(cfg.stops[0])}`, ...cfg.stops.slice(0, -1).map((s, i) => `${cfg.format(s)}–${cfg.format(cfg.stops[i + 1])}`), `${cfg.format(cfg.stops[cfg.stops.length - 1])}+`];
  return (
    <div className={styles.legend}>
      <div className={styles.legendTitle}>{cfg.label}</div>
      <div className={styles.legendRows}>
        {cfg.colors.map((col, i) => (
          <div key={col} className={styles.legendRow}>
            <span style={{ background: col }} />
            {labels[i]}
          </div>
        ))}
        {mode === "perChurch" && (
          <div className={styles.legendRow}>
            <span style={{ background: "#2e2a33" }} />
            No AG church
          </div>
        )}
      </div>
      <p>{cfg.note}</p>
    </div>
  );
}
