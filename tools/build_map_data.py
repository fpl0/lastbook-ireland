"""Builds the map overlay data from raw OpenStreetMap downloads.

raw/pois.json       (Overpass, raw/q.txt)          -> web/map/data/pois.geojson   emergency & resource points
raw/gazetteer.json  (Overpass, raw/gazetteer.q)    -> web/map/data/places.json    search index: towns, townlands, hills, lakes…
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "raw")
OUT = os.path.join(HERE, "..", "web", "map", "data")
os.makedirs(OUT, exist_ok=True)

# id, label, colour, glyph shown in the marker, matcher
CATS = [
    ("hospital", "Hospitals", "#dc2626", "H", lambda t: t.get("amenity") == "hospital"),
    ("aed", "Defibrillators (AED)", "#ea580c", "♥", lambda t: t.get("emergency") == "defibrillator"),
    ("pharmacy", "Pharmacies", "#059669", "+", lambda t: t.get("amenity") == "pharmacy" or t.get("shop") == "chemist"),
    ("doctor", "GPs & clinics", "#2563eb", "+", lambda t: t.get("amenity") in ("doctors", "clinic")),
    ("police", "Garda / PSNI", "#1e3a8a", "G", lambda t: t.get("amenity") == "police"),
    ("fire", "Fire stations", "#b91c1c", "F", lambda t: t.get("amenity") == "fire_station"),
    ("ambulance", "Ambulance bases", "#f59e0b", "A", lambda t: t.get("emergency") == "ambulance_station"),
    ("coast", "Coast Guard & lifeboats", "#0369a1", "⚓", lambda t: t.get("amenity") == "coast_guard" or t.get("emergency") == "lifeboat_station" or t.get("seamark:type") == "coastguard_station"),
    ("water", "Drinking water & springs", "#0891b2", "W", lambda t: t.get("amenity") in ("drinking_water", "water_point") or t.get("man_made") in ("water_tap", "water_well") or t.get("natural") == "spring"),
    ("shelter", "Shelters, halls & huts", "#7c3aed", "S", lambda t: (t.get("amenity") == "shelter" and t.get("shelter_type") not in ("public_transport", "parking", "bicycle_parking", "smoking_area")) or t.get("amenity") in ("community_centre", "townhall") or t.get("tourism") in ("wilderness_hut", "alpine_hut", "camp_site", "hostel") or t.get("emergency") == "assembly_point"),
    ("food", "Food shops", "#16a34a", "F", lambda t: t.get("shop") in ("supermarket", "convenience", "farm", "agrarian")),
    ("fuel", "Fuel", "#475569", "⛽", lambda t: t.get("amenity") == "fuel"),
    ("hardware", "Hardware & outdoor", "#a16207", "T", lambda t: t.get("shop") in ("hardware", "doityourself", "outdoor")),
    ("vet", "Vets", "#64748b", "V", lambda t: t.get("amenity") == "veterinary"),
    ("toilets", "Toilets", "#94a3b8", "T", lambda t: t.get("amenity") == "toilets"),
    ("school", "Schools (rest centres)", "#ca8a04", "S", lambda t: t.get("amenity") == "school"),
]


def coord(e):
    lat = e.get("lat") or (e.get("center") or {}).get("lat")
    lon = e.get("lon") or (e.get("center") or {}).get("lon")
    return (round(lat, 6), round(lon, 6)) if lat is not None else None


def details(t):
    out = {}
    for k, lab in (("phone", "Phone"), ("contact:phone", "Phone"), ("opening_hours", "Hours"),
                   ("defibrillator:location", "Location"), ("access", "Access"), ("drinking_water", "Drinkable"),
                   ("operator", "Operator"), ("description", "Note"), ("indoor", "Indoor"), ("ele", "Elevation")):
        if t.get(k) and lab not in out:
            out[lab] = t[k]
    addr = ", ".join(t[k] for k in ("addr:housenumber", "addr:street", "addr:city", "addr:postcode") if t.get(k))
    if addr:
        out["Address"] = addr
    if t.get("emergency") == "yes" and t.get("amenity") == "hospital":
        out["A&E"] = "Yes — has an emergency department"
    return out


def build_pois():
    d = json.load(open(os.path.join(RAW, "pois.json")))
    feats = []
    for e in d["elements"]:
        t = e.get("tags", {})
        c = coord(e)
        if not c or t.get("place"):
            continue
        for i, cat in enumerate(CATS):
            if cat[4](t):
                p = {"c": i, "n": t.get("name:en") or t.get("name") or ""}
                if t.get("name:ga") and t.get("name:ga") != p["n"]:
                    p["ga"] = t["name:ga"]
                if cat[0] == "hospital":
                    p["ae"] = 1 if t.get("emergency") == "yes" else 0
                info = details(t)
                if info:
                    p["i"] = info
                feats.append({"type": "Feature", "properties": p, "geometry": {"type": "Point", "coordinates": [c[1], c[0]]}})
                break
    json.dump({"type": "FeatureCollection", "features": feats,
               "cats": [{"id": c[0], "label": c[1], "color": c[2], "glyph": c[3]} for c in CATS],
               "stamp": d["osm3s"]["timestamp_osm_base"]},
              open(os.path.join(OUT, "pois.geojson"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("pois", len(feats))


KIND = {  # osm value -> (label, rank: lower = more important in search)
    "city": ("City", 0), "town": ("Town", 1), "village": ("Village", 2), "suburb": ("Suburb", 3), "quarter": ("Area", 3),
    "hamlet": ("Hamlet", 4), "neighbourhood": ("Neighbourhood", 4), "island": ("Island", 3), "islet": ("Islet", 6),
    "townland": ("Townland", 5), "locality": ("Locality", 6), "isolated_dwelling": ("Dwelling", 8), "farm": ("Farm", 8),
    "peak": ("Peak", 4), "hill": ("Hill", 5), "bay": ("Bay", 5), "beach": ("Beach", 5), "cape": ("Headland", 5),
    "valley": ("Valley", 6), "ridge": ("Ridge", 6), "saddle": ("Pass", 6), "cliff": ("Cliff", 6), "wood": ("Wood", 7),
    "lake": ("Lake", 4), "reservoir": ("Reservoir", 5), "lough": ("Lough", 4), "forest": ("Forest", 6),
    "park": ("Park", 7), "nature_reserve": ("Nature reserve", 6), "national_park": ("National park", 3),
}


def build_places():
    p = os.path.join(RAW, "gazetteer.json")
    if not os.path.exists(p):
        print("no gazetteer.json yet — skipping places"); return
    d = json.load(open(p))
    rows, seen = [], set()
    for e in d["elements"]:
        t = e.get("tags", {})
        c = coord(e)
        name = t.get("name:en") or t.get("name")
        if not c or not name:
            continue
        v = t.get("place") or t.get("natural") or t.get("water") or t.get("boundary") or t.get("leisure") or t.get("landuse")
        if v not in KIND:
            continue
        key = (name, v, round(c[0], 2), round(c[1], 2))
        if key in seen:
            continue
        seen.add(key)
        label, rank = KIND[v]
        ga = t.get("name:ga") if t.get("name:ga") not in (None, name) else ""
        extra = t.get("ele", "") if v in ("peak", "hill") else (t.get("population", "") if v in ("city", "town", "village") else "")
        rows.append([name, ga, c[0], c[1], label, rank, extra])
    rows.sort(key=lambda r: (r[5], r[0]))
    json.dump(rows, open(os.path.join(OUT, "places.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("places", len(rows))


if __name__ == "__main__":
    build_pois()
    build_places()
