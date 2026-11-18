"""Fonts (glyph PBFs) and icon sprites for the Protomaps basemap, from protomaps/basemaps-assets (GitHub Pages)."""
import os, urllib.request, urllib.parse, concurrent.futures as cf
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "map")
B = "https://protomaps.github.io/basemaps-assets"
jobs = [(f"{B}/fonts/{urllib.parse.quote(f)}/{i}-{i+255}.pbf", f"{OUT}/fonts/{f}/{i}-{i+255}.pbf")
        for f in ("Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic") for i in range(0, 65536, 256)]
jobs += [(f"{B}/sprites/v4/{n}{s}.{e}", f"{OUT}/sprites/{n}{s}.{e}") for n in ("light", "dark") for s in ("", "@2x") for e in ("json", "png")]
def get(j):
    url, p = j
    if os.path.exists(p): return 1
    os.makedirs(os.path.dirname(p), exist_ok=True)
    try: data = urllib.request.urlopen(url, timeout=60).read()
    except Exception: return 0
    open(p, "wb").write(data); return 1
with cf.ThreadPoolExecutor(16) as ex: print(sum(ex.map(get, jobs)), "of", len(jobs), "files")
