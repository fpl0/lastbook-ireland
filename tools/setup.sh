#!/bin/zsh
# Lastbook Ireland — one-time setup (needs internet; ~32 GB download, 1–2 hours on a fast line).
# Downloads every library, the map and terrain, the official guidance, and builds the search indexes into
#   ~/Library/Application Support/Lastbook Ireland
# Safe to re-run: finished downloads are skipped, interrupted ones resume.
set -e
ROOT=${0:A:h}/..; cd "$ROOT"
LIB="$HOME/Library/Application Support/Lastbook Ireland"
mkdir -p "$LIB/bin" "$LIB/zim" "$LIB/data" build
UA="lastbook-offline-build/2.0"
step() { print -P "\n%B▸ $1%b"; }

step "Checking tools"
for t in curl python3 go swiftc pmtiles; do command -v $t >/dev/null || { echo "missing: $t (see README → Requirements)"; exit 1; }; done

step "Kiwix reader (kiwix-serve, kiwix-manage)"
if [[ ! -x "$LIB/bin/kiwix-serve" ]]; then
  ARCH=$(uname -m)   # arm64 or x86_64
  curl -sSL "https://download.kiwix.org/release/kiwix-tools/kiwix-tools_macos-$ARCH-3.8.2.tar.gz" | tar xz -C "$LIB/bin" --strip-components=1
fi

step "Libraries (Kiwix ZIM files, checksum-verified)"
./tools/fetch_library.sh
rm -f "$LIB/library.xml"
for f in "$LIB"/zim/*.zim; do [[ -f "$f.ok" ]] && "$LIB/bin/kiwix-manage" "$LIB/library.xml" add "$f"; done
echo "$(grep -c '<book ' "$LIB/library.xml") libraries registered"

step "Map and terrain"
./tools/fetch_map.sh

step "Places and help points (OpenStreetMap via Overpass)"
curl -sS -A "$UA" --data-urlencode data@raw/q.txt   https://overpass-api.de/api/interpreter -o raw/pois.json
curl -sS -A "$UA" --data-urlencode data@raw/gaz.txt https://overpass-api.de/api/interpreter -o raw/gaz.json
python3 -I tools/build_data.py

step "Official guidance (gov.ie, nidirect, HSE, …)"
python3 -I tools/fetch_guidance.py

step "Search indexes"
(cd server && go build -o ../build/lastbook-server .)
swiftc -O -o build/pdftext tools/pdftext.swift
./build/lastbook-server -web web -port 8799 & SERVER=$!
trap "kill $SERVER 2>/dev/null" EXIT
sleep 3
python3 -I tools/build_docs.py  http://127.0.0.1:8799
python3 -I tools/build_cd3wd.py http://127.0.0.1:8799

step "Done — now build the app:  ./mac/build.sh"
du -sh "$LIB"
