# Desktop app (macOS)

Native standalone wrapper for the local GUI — a single WKWebView window,
no browser. Health-checks the server, kickstarts the launchd service if
it's down, opens `http://localhost:8000/gui/`. Blob downloads (EXPORT)
land in `~/Downloads`; non-localhost links open in the default browser.

Build into an app bundle:

```bash
APP=~/Desktop/TradingAgents.app
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O -swift-version 5 -o "$APP/Contents/MacOS/TradingAgentsGUI" main.swift \
  -framework Cocoa -framework WebKit
# add Contents/Info.plist (CFBundleExecutable=TradingAgentsGUI,
# CFBundleIconFile=applet, NSAllowsLocalNetworking=true), an .icns,
# then: codesign --force -s - "$APP"
```

Adjust `SERVICE` in main.swift if your launchd label differs.
