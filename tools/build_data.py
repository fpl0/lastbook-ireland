# raw/gaz.json + raw/pois.json (OpenStreetMap via Overpass)  ->  <LIB>/data/{places.json, pois.geojson}
import json, os, re
LIB = os.path.expanduser("~/Library/Application Support/Lastbook Ireland/data")
os.makedirs(LIB, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__)) + "/../raw/"

def ll(e):
    if "lat" in e: return e["lat"], e["lon"]
    c = e.get("center"); return (c["lat"], c["lon"]) if c else (None, None)

# ---------- gazetteer ----------
RANK = {"city":0,"town":1,"suburb":2,"village":3,"island":4,"peak":5,"quarter":6,"neighbourhood":6,"hamlet":7,"lake":7,"river":8,"bay":8,"beach":9,
        "cape":9,"townland":10,"locality":11,"islet":11,"valley":11,"ridge":11,"saddle":12,"cliff":12,"isolated_dwelling":13}
places, seen = [], set()
for e in json.load(open(HERE + "gaz.json"))["elements"]:
    t = e.get("tags", {}); name = t.get("name")
    lat, lon = ll(e)
    if not name or lat is None: continue
    kind = t.get("place") or t.get("natural") or t.get("waterway")
    if kind == "water": kind = "lake"
    if kind not in RANK: continue
    key = (name.lower(), kind, round(lat, 2), round(lon, 2))
    if key in seen: continue
    seen.add(key)
    ga = t.get("name:ga") if t.get("name:ga") != name else None
    extra = t.get("ele") if kind == "peak" else (t.get("population") if kind in ("city","town","village") else None)
    places.append([name, kind, round(lat, 5), round(lon, 5), ga or "", extra or ""])
places.sort(key=lambda p: (RANK[p[1]], p[0]))
json.dump(places, open(LIB + "/places.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("places", len(places))

# ---------- resource layers ----------
LAYERS = [  # (layer id, test)
 ("ae",        lambda t: t.get("amenity") == "hospital" and t.get("emergency") == "yes"),
 ("hospital",  lambda t: t.get("amenity") == "hospital"),
 ("aed",       lambda t: t.get("emergency") == "defibrillator"),
 ("pharmacy",  lambda t: t.get("amenity") == "pharmacy" or t.get("shop") == "chemist"),
 ("doctor",    lambda t: t.get("amenity") in ("doctors", "clinic")),
 ("police",    lambda t: t.get("amenity") == "police"),
 ("fire",      lambda t: t.get("amenity") == "fire_station"),
 ("ambulance", lambda t: t.get("emergency") == "ambulance_station"),
 ("coast",     lambda t: t.get("amenity") == "coast_guard" or t.get("seamark:type") == "coastguard_station" or t.get("emergency") == "lifeboat_station"),
 ("water",     lambda t: t.get("amenity") in ("drinking_water", "water_point") or t.get("man_made") in ("water_well", "water_tap") or t.get("natural") == "spring" or t.get("emergency") == "water_tank"),
 ("shelter",   lambda t: t.get("amenity") == "shelter" or t.get("tourism") in ("wilderness_hut", "alpine_hut", "camp_site", "hostel")),
 ("community", lambda t: t.get("amenity") in ("community_centre", "townhall", "school") or t.get("emergency") == "assembly_point"),
 ("food",      lambda t: t.get("shop") in ("supermarket", "convenience", "farm", "agrarian")),
 ("fuel",      lambda t: t.get("amenity") == "fuel"),
 ("hardware",  lambda t: t.get("shop") in ("hardware", "doityourself", "outdoor")),
 ("vet",       lambda t: t.get("amenity") == "veterinary"),
 ("toilets",   lambda t: t.get("amenity") == "toilets"),
 ("hydrant",   lambda t: t.get("emergency") == "fire_hydrant"),
 ("church",    lambda t: t.get("amenity") == "place_of_worship"),
]
feats = []
for e in json.load(open(HERE + "pois.json"))["elements"]:
    t = e.get("tags", {}); lat, lon = ll(e)
    if lat is None: continue
    lid = next((k for k, f in LAYERS if f(t)), None)
    if not lid: continue
    nm = t.get("name") or t.get("operator") or ""
    p = {"l": lid, "n": nm}
    for k, src in (("ph", "phone"), ("ph", "contact:phone"), ("oh", "opening_hours"), ("ad", "addr:street"), ("tw", "addr:city"),
                   ("in", "indoor"), ("ac", "access"), ("de", "description"), ("lv", "level"), ("dw", "drinking_water"), ("em", "emergency")):
        if t.get(src) and k not in p: p[k] = t[src][:160]
    if lid == "aed" and t.get("defibrillator:location"): p["de"] = t["defibrillator:location"][:200]
    feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]}, "properties": p})
json.dump({"type": "FeatureCollection", "features": feats}, open(LIB + "/pois.geojson", "w"), ensure_ascii=False, separators=(",", ":"))
from collections import Counter
print("pois", len(feats), Counter(f["properties"]["l"] for f in feats).most_common())
