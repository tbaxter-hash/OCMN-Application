#!/usr/bin/env python3
"""Build the data files behind the /map page (OMN Church Map).

Usage:
    pip install openpyxl pyshp shapely
    python3 tools/church-map/build_data.py "path/to/OMN Churches - area & address.xlsx"

Writes:
    public/church-map/geo.json       Ohio outline, the 14 OMN areas, 88 counties (+ county stats)
    public/church-map/churches.json  one record per church in the spreadsheet

Sources (all fetched live; needs network access to these hosts):
  * The spreadsheet: OMN area, city, church name, mailing address, physical address, pastor.
    Physical (location) address wins when present; otherwise the first address block.
  * U.S. Census Geocoder (geocoding.geo.census.gov) — batch geocode of every address.
  * CMN Insight Map layers used by the OMN StoryMap (services5.arcgis.com):
      - AGUSAChurches2024_Full: Esri-geocoded point and church type code for each church.
        Only the pin location and the designation (G/D/P) are used; everything shown on a
        church card otherwise comes from the spreadsheet.
      - USA_County_Summary_24_CT_Correct: county population / churches / unclaimed stats
  * Census cartographic boundary file, counties 1:500k (www2.census.gov) — the map outline.
  * OMN area map (ohioministry.net/presbyters): which counties make up each of the 14 areas
    and 7 regions — transcribed into AREAS below by sampling the image's colour per county.

Coordinate choice per church:
  1. If the ArcGIS (Esri) record has the same street address as the spreadsheet, use its point.
  2. Else use the Census match (only when the Census matched the street, not a street with the
     opposite N/S/E/W prefix).
  3. Anything left is reported for manual review.
"""
import csv
import io
import json
import math
import os
import sys
import urllib.parse
import urllib.request
import zipfile

import openpyxl
import shapefile
from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.ops import polylabel, split, unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "church-map")
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
ARCGIS = "https://services5.arcgis.com/V786FT3XLu62GlQE/arcgis/rest/services"

# ---------------------------------------------------------------------------
# OMN structure — from ohioministry.net/presbyters (area presbyters, region executive
# presbyters) and the area map image on that page.
# ---------------------------------------------------------------------------
REGIONS = {
    1: "Ken DeChant",
    2: "Kevin Crow",
    3: "Lance Porubsky",
    4: "Cornell Jordan",
    5: "Jason Vickery",
    6: "Adam Dinnell",
    7: "David Shores",
}

# key -> (display name, region, area presbyter, counties wholly in the area)
AREAS = {
    "NORTHWEST": ("Northwest", 1, "Keith Kurtz",
                  ["Williams", "Fulton", "Lucas", "Ottawa", "Defiance", "Henry", "Wood", "Sandusky", "Seneca"]),
    "WEST CENTRAL": ("West Central", 1, "Jason Goss",
                     ["Paulding", "Putnam", "Hancock", "Van Wert", "Allen", "Hardin", "Wyandot", "Mercer",
                      "Auglaize", "Logan", "Shelby"]),
    "NORTH CENTRAL": ("North Central", 2, "Derek Boivin",
                      ["Erie", "Huron", "Lorain", "Crawford", "Richland", "Ashland"]),
    "GREATER CLEVELAND": ("Greater Cleveland", 2, "Dan DeLembo", ["Cuyahoga"]),
    "GREATER AKRON": ("Greater Akron", 3, "Phil Anderson", ["Medina", "Summit", "Portage"]),
    "EAST CENTRAL": ("East Central", 3, "Tom Broyles", ["Wayne", "Stark", "Holmes", "Carroll"]),
    "NORTHEAST": ("Northeast", 4, "Aaron Taylor", ["Lake", "Geauga", "Ashtabula"]),
    "YOUNGSTOWN-WARREN": ("Youngstown-Warren", 4, "Gary Gray", ["Trumbull", "Mahoning", "Columbiana"]),
    "GREATER DAYTON": ("Greater Dayton", 5, "Chuck Sharp",
                       ["Darke", "Miami", "Champaign", "Clark", "Preble", "Montgomery", "Greene", "Clinton"]),
    "GREATER CINCINNATI": ("Greater Cincinnati", 5, "Jonathan Taylor",
                           ["Butler", "Warren", "Hamilton", "Clermont", "Brown", "Highland", "Adams"]),
    "GREATER COLUMBUS WEST": ("Greater Columbus West", 6, "Steven Steward", ["Marion", "Morrow", "Union", "Madison"]),
    "GREATER COLUMBUS EAST": ("Greater Columbus East", 6, "Aaron DeLong", ["Knox", "Licking", "Fairfield"]),
    "SOUTH CENTRAL": ("South Central", 7, "Darrell Ford",
                      ["Fayette", "Pickaway", "Ross", "Hocking", "Vinton", "Athens", "Pike", "Jackson", "Meigs",
                       "Scioto", "Gallia", "Lawrence", "Perry", "Morgan"]),
    "SOUTHEAST": ("Southeast", 7, "Jimmy Lewis",
                  ["Coshocton", "Tuscarawas", "Harrison", "Jefferson", "Muskingum", "Guernsey", "Belmont",
                   "Noble", "Monroe", "Washington"]),
}

# Delaware and Franklin counties are split between Greater Columbus West (west side) and
# Greater Columbus East (east side). The OMN map draws the split as a free-hand line; these
# points were traced from that image (≈1–2 km precision) and run north → south.
COLUMBUS_SPLIT = [
    (-82.898, 40.47), (-82.9275, 40.3174), (-82.982, 40.035), (-83.095, 39.894),
    (-83.155, 39.855), (-83.194, 39.829), (-83.27, 39.78),
]
SPLIT_COUNTIES = ["Delaware", "Franklin"]

# AG church status code (CMN Insight Map "Church type") -> OMN designation.
DESIGNATIONS = {"G": "General Council", "D": "Network Affiliated", "P": "Church Plant"}


def fetch(url, data=None, name=None):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name) if name else None
    if path and os.path.exists(path):
        return open(path, "rb").read()
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "omn-church-map-build"})
    body = urllib.request.urlopen(req, timeout=300).read()
    if path:
        open(path, "wb").write(body)
    return body


def arcgis_query(service, where, geometry=True, name=None):
    q = urllib.parse.urlencode({"where": where, "outFields": "*", "returnGeometry": str(geometry).lower(),
                                "outSR": 4326, "f": "json"})
    return json.loads(fetch(f"{ARCGIS}/{service}/query?{q}", name=name))["features"]


def norm(s):
    return "".join(c for c in (s or "").lower() if c.isalnum())


def clean(v):
    return "" if v is None else str(v).strip()


def read_sheet(path):
    rows = []
    for i, r in enumerate(openpyxl.load_workbook(path).active.iter_rows(values_only=True)):
        r = [clean(v) for v in r]
        if not r[2]:
            continue
        if r[9]:  # physical / location address block
            street = " ".join(x for x in (r[9], r[10]) if x)
            city, state, zip_ = r[11], r[12], r[13]
        else:
            street = r[3]
            if street.lower().startswith(("ste ", "rev ")):  # suite / attention line in column D
                street = r[4]
            city, state, zip_ = r[5], r[6], r[7]
        rows.append(dict(row=i, area=r[0], cityArea=r[1], name=r[2], street=street, city=city,
                         state=state, zip=zip_, pastor=r[14]))
    return rows


def census_geocode(rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    for x in rows:
        w.writerow([x["row"], x["street"], x["city"], x["state"], x["zip"]])
    boundary = "----omnmap"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"benchmark\"\r\n\r\nPublic_AR_Current\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"addressFile\"; filename=\"a.csv\"\r\n"
            f"Content-Type: text/csv\r\n\r\n{buf.getvalue()}\r\n--{boundary}--\r\n").encode()
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, "census.csv")
    if not os.path.exists(path):
        req = urllib.request.Request("https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
                                     data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        open(path, "wb").write(urllib.request.urlopen(req, timeout=600).read())
    out = {}
    for r in csv.reader(open(path)):
        if len(r) > 5 and r[2] == "Match":
            lon, lat = map(float, r[5].split(","))
            out[int(r[0])] = dict(lat=lat, lon=lon, exact=r[3] == "Exact", matched=r[4])
    return out


def direction_conflict(asked, matched):
    a = f" {asked.upper()} "
    m = f" {matched.split(',')[0]} "
    return any((f" {d} " in a) != (f" {d} " in m) for d in "NSEW")


def counties():
    z = zipfile.ZipFile(io.BytesIO(fetch("https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip",
                                         name="cb_2023_us_county_500k.zip")))
    rd = shapefile.Reader(shp=io.BytesIO(z.read("cb_2023_us_county_500k.shp")),
                          dbf=io.BytesIO(z.read("cb_2023_us_county_500k.dbf")))
    out = {}
    for sr in rd.iterShapeRecords():
        a = sr.record.as_dict()
        if a["STATEFP"] == "39":
            out[a["NAME"]] = (a["GEOID"], shape(sr.shape.__geo_interface__))
    return out


def rnd(geom, tol=0.0012):
    g = geom.simplify(tol, preserve_topology=True)
    m = mapping(g)

    def r(c):
        return [round(c[0], 4), round(c[1], 4)] if isinstance(c[0], float) else [r(x) for x in c]

    m["coordinates"] = r(m["coordinates"])
    return m


def main(xlsx):
    rows = read_sheet(xlsx)
    census = census_geocode(rows)
    ag = [f for f in arcgis_query("AGUSAChurches2024_Full/FeatureServer/0", "USER_District_name__file_='Ohio'",
                                  name="ag_churches.json")]
    stats = {f["attributes"]["NAME"].replace(" County", ""): f["attributes"]
             for f in arcgis_query("USA_County_Summary_24_CT_Correct/FeatureServer/0", "State='Ohio'",
                                   geometry=False, name="county_stats.json")}
    cty = counties()
    assert len(cty) == 88

    # --- areas -------------------------------------------------------------------------
    listed = [c for v in AREAS.values() for c in v[3]] + SPLIT_COUNTIES
    assert sorted(listed) == sorted(cty), set(cty) ^ set(listed)
    line = LineString(COLUMBUS_SPLIT)
    split_parts = {"GREATER COLUMBUS WEST": [], "GREATER COLUMBUS EAST": []}
    for c in SPLIT_COUNTIES:
        for part in split(cty[c][1], line).geoms:
            side = "GREATER COLUMBUS WEST" if part.centroid.x < line.interpolate(
                line.project(part.centroid)).x else "GREATER COLUMBUS EAST"
            split_parts[side].append(part)

    area_feats, county_area, area_geom = [], {}, {}
    for key, (label, region, presbyter, names) in AREAS.items():
        geoms = [cty[n][1] for n in names] + split_parts.get(key, [])
        merged = unary_union(geoms).buffer(0)
        area_geom[key] = (region, merged)
        main_part = max(getattr(merged, "geoms", [merged]), key=lambda g: g.area)
        anchor = polylabel(main_part, tolerance=0.005)
        for n in names:
            county_area[n] = [key]
        area_feats.append({"type": "Feature", "properties": {
            "key": key, "name": label, "region": region, "presbyter": presbyter,
            "counties": sorted(names + (SPLIT_COUNTIES if key in split_parts else [])),
            "label": [round(anchor.x, 4), round(anchor.y, 4)]},
            "geometry": rnd(merged)})
    for c in SPLIT_COUNTIES:
        county_area[c] = ["GREATER COLUMBUS WEST", "GREATER COLUMBUS EAST"]

    county_feats = []
    for n, (geoid, g) in sorted(cty.items()):
        s = stats.get(n, {})
        lp = polylabel(max(getattr(g, "geoms", [g]), key=lambda p: p.area), tolerance=0.005)
        county_feats.append({"type": "Feature", "properties": {
            "name": n, "label": [round(lp.x, 4), round(lp.y, 4)], "geoid": geoid, "areas": county_area[n],
            "population": s.get("B01001_001E"), "agChurches": s.get("AGCount"),
            "peoplePerAgChurch": s.get("PPChurch"), "unclaimedPct": s.get("Unclaimed_Percent"),
            "attendPct": s.get("Perc_Attend"), "congregations": s.get("Congregations"),
            "adherentsPct": round(s["Adherents_as___of_Population"], 1) if s.get("Adherents_as___of_Population") else None,
        }, "geometry": rnd(g)})

    state = unary_union([g for _, g in cty.values()]).buffer(0)
    region_feats = []
    for rid in REGIONS:
        rg = unary_union([g for r, g in area_geom.values() if r == rid]).buffer(0)
        region_feats.append({"type": "Feature", "properties": {"region": rid}, "geometry": rnd(rg, 0.0008)})
    mask = box(-179, -84, 179, 84).difference(state.simplify(0.0008))
    geo = {
        "regions": [{"id": k, "executivePresbyter": v} for k, v in REGIONS.items()],
        "state": {"type": "Feature", "properties": {}, "geometry": rnd(state, 0.0008)},
        "mask": {"type": "Feature", "properties": {}, "geometry": rnd(mask, 0.0008)},
        "areas": {"type": "FeatureCollection", "features": area_feats},
        "regionShapes": {"type": "FeatureCollection", "features": region_feats},
        "counties": {"type": "FeatureCollection", "features": county_feats},
        "columbusSplit": [[round(x, 4), round(y, 4)] for x, y in COLUMBUS_SPLIT],
    }

    # --- churches ----------------------------------------------------------------------
    used, churches, review = set(), [], []
    for x in rows:
        cands = [f for f in ag if f["attributes"]["OBJECTID"] not in used
                 and norm(f["attributes"]["USER_Church_Name"]) == norm(x["name"])
                 and f["attributes"]["USER_Section_name"] == x["area"]]
        if len(cands) > 1:
            same = [f for f in cands if norm(f["attributes"]["USER_Location_Address_Line_1"])[:8] == norm(x["street"])[:8]
                    or norm(f["attributes"]["USER_Mailing_Address_Line_1"])[:8] == norm(x["street"])[:8]]
            cands = same or cands
        a = cands[0]["attributes"] if cands else {}
        if cands:
            used.add(a["OBJECTID"])
        c = census.get(x["row"])
        if a and norm(a.get("USER_Location_Address_Line_1")) == norm(x["street"]):
            lat, lon, src = a["Y"], a["X"], "esri"
        elif c and not direction_conflict(x["street"], c["matched"]):
            lat, lon, src = c["lat"], c["lon"], "census"
        else:
            review.append(x["name"])
            continue
        county = next((n for n, (_, g) in cty.items() if g.contains(Point(lon, lat))), None)
        churches.append({
            "id": len(churches) + 1,
            "name": x["name"], "area": x["area"], "cityArea": x["cityArea"],
            "street": x["street"], "city": x["city"], "state": x["state"], "zip": x["zip"],
            "lat": round(lat, 6), "lon": round(lon, 6), "geocode": src,
            "county": county, "inOhio": county is not None,
            "pastor": x["pastor"] or None,
            # Only the designation is taken from ArcGIS (until the spreadsheet has its own column).
            "designation": DESIGNATIONS.get(a.get("USER_Church_type")),
        })

    os.makedirs(OUT, exist_ok=True)
    json.dump(geo, open(os.path.join(OUT, "geo.json"), "w"), separators=(",", ":"))
    json.dump(churches, open(os.path.join(OUT, "churches.json"), "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"{len(churches)} churches written ({sum(c['geocode'] == 'esri' for c in churches)} Esri, "
          f"{sum(c['geocode'] == 'census' for c in churches)} Census); "
          f"{sum(not c['inOhio'] for c in churches)} outside Ohio")
    if review:
        print("NEEDS MANUAL REVIEW (not placed):", review)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1])
