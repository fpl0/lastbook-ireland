#!/bin/zsh
# Builds "Lastbook Ireland.app" and installs it to /Applications.
# The app bundles the UI, the offline engine (Go) and kiwix-serve; the big data lives in
# ~/Library/Application Support/Lastbook Ireland (downloaded from inside the app: Set up offline data).
set -e
cd "$(dirname "$0")/.."
LIB="$HOME/Library/Application Support/Lastbook Ireland"
APP="build/Lastbook Ireland.app"
rm -rf "$APP" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/bin"
if [[ -n "$UNIVERSAL" ]]; then
  # release build: one app for Apple silicon and Intel Macs
  T=build/universal; mkdir -p $T
  (cd server && GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o "../$T/server-arm64" . && GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o "../$T/server-x86_64" .)
  lipo -create $T/server-arm64 $T/server-x86_64 -output "$APP/Contents/Resources/bin/lastbook-server"
  for a in arm64 x86_64; do
    swiftc -O -target $a-apple-macos13.0 -o $T/shell-$a mac/main.swift -framework AppKit -framework WebKit -framework CoreLocation
    swiftc -O -target $a-apple-macos13.0 -o $T/pdftext-$a tools/pdftext.swift
    if [[ ! -x $T/kiwix-$a ]]; then
      curl -sSL "https://download.kiwix.org/release/kiwix-tools/kiwix-tools_macos-$a-3.8.2.tar.gz" | tar xz -C $T --strip-components=1 "kiwix-tools_macos-$a-3.8.2/kiwix-serve"
      mv $T/kiwix-serve $T/kiwix-$a
    fi
  done
  lipo -create $T/shell-arm64 $T/shell-x86_64 -output "$APP/Contents/MacOS/LastbookIreland"
  lipo -create $T/pdftext-arm64 $T/pdftext-x86_64 -output "$APP/Contents/Resources/bin/pdftext"
  lipo -create $T/kiwix-arm64 $T/kiwix-x86_64 -output "$APP/Contents/Resources/bin/kiwix-serve"
else
  (cd server && go build -trimpath -ldflags="-s -w" -o "../$APP/Contents/Resources/bin/lastbook-server" .)
  swiftc -O -o "$APP/Contents/MacOS/LastbookIreland" mac/main.swift -framework AppKit -framework WebKit -framework CoreLocation
  swiftc -O -o "$APP/Contents/Resources/bin/pdftext" tools/pdftext.swift
  if [[ ! -x "$LIB/bin/kiwix-serve" ]]; then   # fresh machine: fetch the Kiwix reader once
    mkdir -p "$LIB/bin"
    curl -sSL "https://download.kiwix.org/release/kiwix-tools/kiwix-tools_macos-$(uname -m)-3.8.2.tar.gz" | tar xz -C "$LIB/bin" --strip-components=1
  fi
  cp "$LIB/bin/kiwix-serve" "$APP/Contents/Resources/bin/kiwix-serve"
fi
rsync -a --exclude map.html web/ "$APP/Contents/Resources/web/"
ICON=build/icon.iconset; rm -rf $ICON; mkdir -p $ICON
qlmanage -t -s 1024 -o build web/icon.svg >/dev/null 2>&1
for s in 16 32 128 256 512; do
  sips -z $s $s build/icon.svg.png --out $ICON/icon_${s}x${s}.png >/dev/null
  sips -z $((s*2)) $((s*2)) build/icon.svg.png --out $ICON/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns $ICON -o "$APP/Contents/Resources/AppIcon.icns"
cat > "$APP/Contents/Info.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Lastbook Ireland</string>
<key>CFBundleDisplayName</key><string>Lastbook Ireland</string>
<key>CFBundleIdentifier</key><string>local.lastbook.ireland</string>
<key>CFBundleExecutable</key><string>LastbookIreland</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>2.1.0</string>
<key>CFBundleVersion</key><string>3</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSApplicationCategoryType</key><string>public.app-category.reference</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
<key>NSLocationUsageDescription</key><string>Shows your grid reference and the nearest help on the offline map.</string>
<key>NSLocationWhenInUseUsageDescription</key><string>Shows your grid reference and the nearest help on the offline map.</string>
</dict></plist>
PL
codesign --force --deep -s - "$APP"
rm -rf "/Applications/Lastbook Ireland.app"
cp -R "$APP" /Applications/
echo "Installed /Applications/Lastbook Ireland.app"
