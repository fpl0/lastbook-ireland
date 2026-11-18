# Lastbook Ireland 2

A self-contained emergency and self-reliance companion for the island of Ireland. It runs **100% offline**: the app's web view has a WebKit content rule that blocks every request that isn't to the local engine.

## What's inside

| | |
|---|---|
| **Now** | 112/999 card, "Where am I?" (Irish Grid, ITM, lat/lon, nearest townland), nearest A&E/AED/pharmacy/Garda/water/shelter, daylight |
| **Map** | Full OpenStreetMap vector map of the island (Protomaps, z0–15: every road, path, building), hillshade + 10 m contours (Mapzen terrain), 40k help points in 19 layers, 99k-name gazetteer (townlands, peaks, rivers, Irish names), grid refs + elevation for any point, measure tool |
| **Guides** | 29 field guides. Each one opens with what to do, then links live into the exact manual pages, WikiMed articles and official guidance |
| **Library** | 25 Kiwix libraries (1.9M articles) in four sections — medicine, survival, rebuilding (CD3WD, Energypedia, LibreTexts trades/engineering/science/social-science textbooks), general knowledge: Wikipedia top articles, WikiMed, NHS Medicines A–Z, Military Medicine, post-disaster / austere medicine / water / food / knots libraries, Appropedia, Gardenology, iFixit, Wikibooks, Wikivoyage. Plus 77 official documents (gov.ie *Be Emergency Ready*, nidirect, UK Be Ready, HSE, EPA nuclear plan, Sweden's *In case of crisis or war*). Page-level full-text search over 160 manuals |
| **Toolkit** | Kit checklist, household plan, coordinate converter, distance/bearing, bleach dosing, household food/water calculator, SOS/Morse flasher, emergency radio frequencies |

## Layout

- `web/`: the UI (vanilla JS, MapLibre GL, PMTiles, maplibre-contour)
- `server/`: the Go engine (static files, Range for PMTiles, Kiwix reverse proxy, manual search index)
- `mac/`: the native shell (WKWebView, starts the engine, enforces offline-only); `mac/build.sh` builds and installs it to /Applications
- `tools/`: data fetchers and builders

Data lives in `~/Library/Application Support/Lastbook Ireland` (~20 GB): `zim/`, `library.xml`, `map/` (ireland.pmtiles, terrain/), `data/` (places, pois, docs index), `guidance/`, `bin/kiwix-serve`.

## Refresh data (needs internet)

```
./tools/fetch_library.sh                          # Kiwix ZIMs (+ sha256 check), then rebuild library.xml with kiwix-manage
./tools/fetch_map.sh                              # vector map + Mapterhorn terrain (map module in web/map/)
python3 -I tools/fetch_guidance.py                # official guidance snapshots
python3 -I tools/build_data.py                    # gazetteer + help layers (from raw/*.json Overpass extracts)
python3 -I tools/build_docs.py http://127.0.0.1:<port>   # manual text index (needs the engine running)
python3 -I tools/build_cd3wd.py http://127.0.0.1:<port>  # CD3WD catalogue (real titles, subjects) for its native shelf
python3 -I tools/crawl_check.py http://127.0.0.1:<port> <book> 600 <site-host>   # follow a library's links, check every target is offline
python3 -I tools/audit_offline.py http://127.0.0.1:<port> 30   # offline audit: random pages + every asset, all manual PDFs
./mac/build.sh
```

Licences: OSM data © OpenStreetMap contributors (ODbL). Wikipedia/Wikibooks/Wikivoyage/Appropedia CC BY-SA. Terrain © Mapzen/Tilezen. Official documents © their publishers, saved for personal offline use.
