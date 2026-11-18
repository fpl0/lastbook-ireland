#!/bin/zsh
# Downloads the offline map data for the island of Ireland into ~/Library/Application Support/Lastbook Ireland/map:
#  ireland.pmtiles  Protomaps basemap (OpenStreetMap), z0-15: every road, path, building, POI, place  (~570 MB)
#  terrain/         Mapterhorn terrarium elevation, 512 px webp tiles z0-12 (~11 m/px)                  (~230 MB)
# Needs the pmtiles CLI (brew install pmtiles). Re-run any time to refresh to the latest OSM build.
set -e
M="$HOME/Library/Application Support/Lastbook Ireland/map"; mkdir -p "$M"; cd "$M"
BBOX=-12.0,50.8,-4.3,56.0   # island + Atlantic edge, North Channel, Isle of Man, Galloway, Kintyre
BUILD=$(curl -sL https://build-metadata.protomaps.dev/builds.json | python3 -c "import json,sys; print(json.load(sys.stdin)[-1]['key'])")
echo "Protomaps build $BUILD"
pmtiles extract "https://build.protomaps.com/$BUILD" ireland.new.pmtiles --bbox=$BBOX --maxzoom=15 --download-threads=8
mv ireland.new.pmtiles ireland.pmtiles
pmtiles extract https://download.mapterhorn.com/planet.pmtiles terrain.pmtiles --bbox=$BBOX --maxzoom=12 --download-threads=4
rm -rf terrain && python3 -I "${0:A:h}/unpack_pmtiles.py" terrain.pmtiles terrain && rm terrain.pmtiles
