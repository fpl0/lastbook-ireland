// Lastbook Ireland — native macOS shell.
// Starts the bundled offline engine (lastbook-server → kiwix-serve) on 127.0.0.1 and shows the app in a WKWebView.
// Data (libraries, map, terrain) lives in ~/Library/Application Support/Lastbook Ireland.
import AppKit
import CoreLocation
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, CLLocationManagerDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var server: Process?
    let location = CLLocationManager()
    let dataDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Lastbook Ireland")

    func applicationDidFinishLaunching(_ n: Notification) {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.preferences.isElementFullscreenEnabled = true
        cfg.userContentController.addUserScript(WKUserScript(source: "document.documentElement.classList.add('mac-app')", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        cfg.userContentController.addUserScript(WKUserScript(source: Self.geoPolyfill, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        cfg.userContentController.add(self, name: "lbGeo")
        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsMagnification = true
        web.allowsBackForwardNavigationGestures = false
        web.setValue(false, forKey: "drawsBackground")

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1360, height: 900),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        window.title = "Lastbook Ireland"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.minSize = NSSize(width: 760, height: 560)
        window.contentView = web
        window.setFrameAutosaveName("LastbookIrelandMain")
        if window.frame.origin == .zero { window.center() }
        web.loadHTMLString("<html><body style='margin:0;display:grid;place-items:center;height:100vh;font:15px -apple-system;color:#8c908c;background:#fff'>Opening the offline library…</body></html>", baseURL: nil)
        window.makeKeyAndOrderFront(nil)
        buildMenu()
        NSApp.activate(ignoringOtherApps: true)
        location.delegate = self
        // Hard offline guarantee: WebKit blocks every request that isn't to the local engine.
        let rules = """
        [{"trigger":{"url-filter":".*"},"action":{"type":"block"}},
         {"trigger":{"url-filter":"^https?://127[.]0[.]0[.]1[:/]"},"action":{"type":"ignore-previous-rules"}},
         {"trigger":{"url-filter":"^https?://localhost[:/]"},"action":{"type":"ignore-previous-rules"}},
         {"trigger":{"url-filter":"^blob:"},"action":{"type":"ignore-previous-rules"}},
         {"trigger":{"url-filter":"^data:"},"action":{"type":"ignore-previous-rules"}},
         {"trigger":{"url-filter":"^about:"},"action":{"type":"ignore-previous-rules"}}]
        """
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "lastbook-offline-only", encodedContentRuleList: rules) { list, err in
            if let list = list { self.web.configuration.userContentController.add(list) }
            else { NSLog("content rules: \(String(describing: err))") }
            self.startServer()
        }
    }

    func startServer() {
        let res = Bundle.main.resourceURL!
        let portFile = FileManager.default.temporaryDirectory.appendingPathComponent("lastbook-\(getpid()).port")
        try? FileManager.default.removeItem(at: portFile)
        let p = Process()
        p.executableURL = res.appendingPathComponent("bin/lastbook-server")
        p.arguments = ["-data", dataDir.path, "-web", res.appendingPathComponent("web").path,
                       "-kiwix", res.appendingPathComponent("bin/kiwix-serve").path, "-portfile", portFile.path]
        let log = dataDir.appendingPathComponent("server.log")
        FileManager.default.createFile(atPath: log.path, contents: nil)
        if let h = try? FileHandle(forWritingTo: log) { p.standardError = h; p.standardOutput = h }
        do { try p.run() } catch { fail("Couldn't start the offline engine: \(error.localizedDescription)"); return }
        server = p
        // wait for the port file (the server writes it once it is listening)
        DispatchQueue.global().async {
            for _ in 0..<300 {
                if let s = try? String(contentsOf: portFile, encoding: .utf8), let port = Int(s) {
                    DispatchQueue.main.async { self.web.load(URLRequest(url: URL(string: "http://127.0.0.1:\(port)/")!)) }
                    return
                }
                usleep(50_000)
            }
            DispatchQueue.main.async { self.fail("The offline engine didn't start. See \(log.path)") }
        }
    }

    func fail(_ msg: String) {
        let a = NSAlert(); a.messageText = "Lastbook Ireland"; a.informativeText = msg; a.runModal()
    }

    func applicationWillTerminate(_ n: Notification) { server?.terminate() }
    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }

    // Open anything that isn't the local engine in the default browser.
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = a.request.url, let host = u.host, host != "127.0.0.1", host != "localhost", (u.scheme == "http" || u.scheme == "https") {
            if a.navigationType == .linkActivated || a.targetFrame == nil { NSWorkspace.shared.open(u) }
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url, u.host != "127.0.0.1" { NSWorkspace.shared.open(u) }
        return nil
    }
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = m; a.runModal(); completionHandler()
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }
    // MARK: - Native location bridge
    // The page's navigator.geolocation is replaced (see geoPolyfill) by calls into CoreLocation, so location works
    // reliably in this self-built app: one-shot requests (getCurrentPosition) and watches (watchPosition).
    static let geoPolyfill = """
    (() => {
      const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.lbGeo; if (!h) return;
      let seq = 0; const cbs = {};
      window.__lbGeo = (id, ok, d) => { const c = cbs[id]; if (!c) return; if (!c.watch) delete cbs[id];
        if (ok) c.s({ coords: { latitude: d.lat, longitude: d.lon, accuracy: d.acc, altitude: d.alt, altitudeAccuracy: d.altAcc, heading: d.heading, speed: d.speed }, timestamp: d.t });
        else if (c.e) c.e({ code: d.code, message: d.message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); };
      const req = (watch, s, e, o) => { const id = ++seq; cbs[id] = { s, e, watch }; h.postMessage({ id, watch }); return id; };
      const geo = { getCurrentPosition: (s, e, o) => { req(false, s, e, o); }, watchPosition: (s, e, o) => req(true, s, e, o),
        clearWatch: id => { delete cbs[id]; h.postMessage({ clear: id }); } };
      try { Object.defineProperty(Navigator.prototype, "geolocation", { get: () => geo, configurable: true }); } catch (_) {}
      try { Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true }); } catch (_) {}
      if (navigator.permissions && navigator.permissions.query) { const q = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = d => d && d.name === "geolocation" ? Promise.resolve({ state: "granted", onchange: null, addEventListener() {}, removeEventListener() {} }) : q(d); }
    })();
    """
    var oneShot: [Int] = []
    var watches = Set<Int>()

    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "lbGeo", let body = message.body as? [String: Any] else { return }
        if let clear = body["clear"] as? Int { watches.remove(clear); stopIfIdle(); return }
        guard let id = body["id"] as? Int else { return }
        if (body["watch"] as? Bool) == true { watches.insert(id) } else { oneShot.append(id) }
        if !CLLocationManager.locationServicesEnabled() {
            fail(ids: [id], code: 2, "Location Services are turned off on this Mac. Turn them on in System Settings → Privacy & Security → Location Services, or tap your position on the Map.")
            watches.remove(id); oneShot.removeAll { $0 == id }; return
        }
        switch location.authorizationStatus {
        case .notDetermined: location.requestWhenInUseAuthorization(); location.requestAlwaysAuthorization()
        case .denied, .restricted:
            fail(ids: [id], code: 1, "Lastbook isn't allowed to use your location. Allow it in System Settings → Privacy & Security → Location Services, or tap your position on the Map.")
            watches.remove(id); oneShot.removeAll { $0 == id }; return
        default: break
        }
        location.desiredAccuracy = kCLLocationAccuracyBest
        location.startUpdatingLocation()
        // one-shot requests give up after 20 s
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            guard let self, self.oneShot.contains(id) else { return }
            self.oneShot.removeAll { $0 == id }
            self.fail(ids: [id], code: 3, "Couldn't get a fix — Macs locate using nearby Wi-Fi, which may not work offline. Tap your position on the Map instead.")
            self.stopIfIdle()
        }
    }
    func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        switch m.authorizationStatus {
        case .denied, .restricted:
            let ids = oneShot + Array(watches); oneShot = []; watches = []
            fail(ids: ids, code: 1, "Lastbook isn't allowed to use your location. Allow it in System Settings → Privacy & Security → Location Services, or tap your position on the Map.")
            m.stopUpdatingLocation()
        case .authorized, .authorizedAlways:
            if !oneShot.isEmpty || !watches.isEmpty { m.startUpdatingLocation() }
        default: break
        }
    }
    func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        guard let l = locs.last else { return }
        let d: [String: Any] = ["lat": l.coordinate.latitude, "lon": l.coordinate.longitude, "acc": l.horizontalAccuracy,
                                "alt": l.verticalAccuracy >= 0 ? l.altitude : NSNull(), "altAcc": l.verticalAccuracy >= 0 ? l.verticalAccuracy : NSNull(),
                                "heading": l.course >= 0 ? l.course : NSNull(), "speed": l.speed >= 0 ? l.speed : NSNull(), "t": l.timestamp.timeIntervalSince1970 * 1000]
        deliver(ids: oneShot + Array(watches), ok: true, d)
        oneShot = []
        stopIfIdle()
    }
    func locationManager(_ m: CLLocationManager, didFailWithError e: Error) {
        if (e as? CLError)?.code == .locationUnknown { return } // keeps trying; the 20 s timeout reports it
        let denied = (e as? CLError)?.code == .denied
        fail(ids: oneShot + Array(watches), code: denied ? 1 : 2, denied ? "Location permission was denied." : "Location unavailable: \(e.localizedDescription)")
        oneShot = []; if denied { watches = [] }
        stopIfIdle()
    }
    func stopIfIdle() { if oneShot.isEmpty && watches.isEmpty { location.stopUpdatingLocation() } }
    func fail(ids: [Int], code: Int, _ msg: String) { deliver(ids: ids, ok: false, ["code": code, "message": msg]) }
    func deliver(ids: [Int], ok: Bool, _ d: [String: Any]) {
        guard !ids.isEmpty, let json = try? JSONSerialization.data(withJSONObject: d), let js = String(data: json, encoding: .utf8) else { return }
        for id in ids { web.evaluateJavaScript("window.__lbGeo && window.__lbGeo(\(id), \(ok), \(js))") }
    }

    func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let app = NSMenu()
        app.addItem(withTitle: "About Lastbook Ireland", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Show Library Folder in Finder", action: #selector(showData), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Hide Lastbook Ireland", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        app.addItem(withTitle: "Quit Lastbook Ireland", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = app
        let editItem = NSMenuItem(); main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Find…", action: #selector(find), keyEquivalent: "f")
        editItem.submenu = edit
        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let view = NSMenu(title: "View")
        for (t, h, k) in [("Now", "now", "1"), ("Map", "map", "2"), ("Guides", "guides", "3"), ("Library", "library", "4"), ("Toolkit", "tools", "5")] {
            let it = NSMenuItem(title: t, action: #selector(go(_:)), keyEquivalent: k); it.representedObject = h; view.addItem(it)
        }
        view.addItem(.separator())
        view.addItem(withTitle: "Search Everything", action: #selector(search), keyEquivalent: "k")
        view.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r")
        view.addItem(.separator())
        view.addItem(withTitle: "Zoom In", action: #selector(zoomIn), keyEquivalent: "+")
        view.addItem(withTitle: "Zoom Out", action: #selector(zoomOut), keyEquivalent: "-")
        view.addItem(withTitle: "Actual Size", action: #selector(zoomReset), keyEquivalent: "0")
        view.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f").keyEquivalentModifierMask = [.command, .control]
        viewItem.submenu = view
        let winItem = NSMenuItem(); main.addItem(winItem)
        let win = NSMenu(title: "Window")
        win.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        winItem.submenu = win
        NSApp.mainMenu = main
    }
    @objc func go(_ s: NSMenuItem) { web.evaluateJavaScript("location.hash='#/\(s.representedObject as! String)'") }
    @objc func search() { web.evaluateJavaScript("document.getElementById('searchBtn').click()") }
    @objc func find() { web.evaluateJavaScript("document.getElementById('searchBtn').click()") }
    @objc func showData() { NSWorkspace.shared.activateFileViewerSelecting([dataDir]) }
    @objc func reload() { web.reload() }
    @objc func zoomIn() { web.pageZoom = min(web.pageZoom + 0.1, 3) }
    @objc func zoomOut() { web.pageZoom = max(web.pageZoom - 0.1, 0.5) }
    @objc func zoomReset() { web.pageZoom = 1 }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
