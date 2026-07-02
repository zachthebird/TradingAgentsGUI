// TradingAgentsGUI — native standalone wrapper for http://localhost:8000/gui/
// Replaces the browser: one WKWebView window, own dock identity.
// - Health-checks the local server; kickstarts the launchd service if down.
// - Blob downloads (the terminal's EXPORT) land in ~/Downloads.
// - Non-localhost links open in the default browser.
import Cocoa
import WebKit

let GUI_URL = "http://localhost:8000/gui/"
let HEALTH_URL = "http://localhost:8000/health"
let SERVICE = "ai.zachbird.tradingagents-app"
let ENV_FILE = NSString(string: "~/Desktop/TradingAgents/.env").expandingTildeInPath
let LOG_FILE = NSString(string: "~/Library/Logs/TradingAgentsGUI.log").expandingTildeInPath

func appLog(_ msg: String) {
    let line = "\(Date()) \(msg)\n"
    if let data = line.data(using: .utf8) {
        if FileManager.default.fileExists(atPath: LOG_FILE),
           let h = FileHandle(forWritingAtPath: LOG_FILE) {
            h.seekToEndOfFile(); h.write(data); h.closeFile()
        } else {
            try? data.write(to: URL(fileURLWithPath: LOG_FILE))
        }
    }
}

// The desktop app is the trusted local client: read the API token from
// the project .env and pre-seed the page's localStorage so the web
// token gate never appears here.
func apiTokenFromEnv() -> String? {
    guard let raw = try? String(contentsOfFile: ENV_FILE, encoding: .utf8) else { return nil }
    for line in raw.split(separator: "\n") {
        let t = line.trimmingCharacters(in: .whitespaces)
        if t.hasPrefix("TRADINGAGENTS_API_TOKEN=") {
            let v = String(t.dropFirst("TRADINGAGENTS_API_TOKEN=".count))
                .trimmingCharacters(in: CharacterSet(charactersIn: "\"' "))
            return v.isEmpty ? nil : v
        }
    }
    return nil
}

func serverUp() -> Bool {
    guard let url = URL(string: HEALTH_URL) else { return false }
    var ok = false
    let sem = DispatchSemaphore(value: 0)
    var req = URLRequest(url: url)
    req.timeoutInterval = 2
    URLSession.shared.dataTask(with: req) { _, resp, _ in
        ok = (resp as? HTTPURLResponse)?.statusCode == 200
        sem.signal()
    }.resume()
    sem.wait()
    return ok
}

func kickstartService() {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/bin/launchctl")
    p.arguments = ["kickstart", "gui/\(getuid())/\(SERVICE)"]
    try? p.run()
    p.waitUntilExit()
}

let SPLASH = """
<!doctype html><html><body style="margin:0;background:#05141d;color:#8ff5ef;
font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="text-align:center"><div style="font-size:22px;letter-spacing:3px">TRADING AGENTS</div>
<div style="margin-top:10px;font-size:13px;color:#43d9d9">BOOTING THE COUNCIL TERMINAL<span id="d"></span></div></div>
<script>let n=0;setInterval(()=>{document.getElementById('d').textContent='.'.repeat(n=(n+1)%4)},400)</script>
</body></html>
"""

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        if let token = apiTokenFromEnv(),
           let json = try? JSONSerialization.data(withJSONObject: [token]),
           let arr = String(data: json, encoding: .utf8) {
            // ["<token>"] → safe JS string literal via [0]
            let js = "try { localStorage.setItem('tradingagents_token', (\(arr))[0]); } catch (e) {}"
            config.userContentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
            appLog("token pre-seeded from .env")
        } else {
            appLog("no token found in .env — web gate will handle auth")
        }
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        if #available(macOS 13.3, *) { webView.isInspectable = true }

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "TradingAgents — Council Terminal"
        window.minSize = NSSize(width: 900, height: 600)
        window.contentView = webView
        window.setFrameAutosaveName("TradingAgentsGUIMain")
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        webView.loadHTMLString(SPLASH, baseURL: nil)

        DispatchQueue.global().async {
            var up = serverUp()
            if !up {
                kickstartService()
                for _ in 0..<30 {
                    Thread.sleep(forTimeInterval: 0.5)
                    if serverUp() { up = true; break }
                }
            }
            DispatchQueue.main.async {
                if up {
                    self.webView.load(URLRequest(url: URL(string: GUI_URL)!))
                } else {
                    let alert = NSAlert()
                    alert.alertStyle = .warning
                    alert.messageText = "TradingAgents server did not come up"
                    alert.informativeText = "Port 8000 never answered. Check:\nlaunchctl print gui/\(getuid())/\(SERVICE)"
                    alert.runModal()
                    NSApp.terminate(nil)
                }
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    @objc func reloadPage() {
        webView.load(URLRequest(url: URL(string: GUI_URL)!))
    }

    func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About TradingAgentsGUI",
                        action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit TradingAgentsGUI",
                        action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        // Edit menu: without it, Cmd+C/V/X don't reach the web form fields.
        let editItem = NSMenuItem(); main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(NSMenuItem.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit

        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let view = NSMenu(title: "View")
        let reload = NSMenuItem(title: "Reload", action: #selector(reloadPage), keyEquivalent: "r")
        reload.target = self
        view.addItem(reload)
        viewItem.submenu = view

        NSApp.mainMenu = main
    }

    // ── navigation policy ──────────────────────────────────────────
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
            return
        }
        if let url = navigationAction.request.url,
           let scheme = url.scheme, ["http", "https"].contains(scheme),
           let host = url.host, host != "localhost", host != "127.0.0.1" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView,
                 navigationAction: WKNavigationAction,
                 didBecome download: WKDownload) {
        download.delegate = self
    }

    // ── downloads (EXPORT blob → ~/Downloads) ──────────────────────
    func download(_ download: WKDownload,
                  decideDestinationUsing response: URLResponse,
                  suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let dir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
        var dest = dir.appendingPathComponent(suggestedFilename)
        var i = 1
        while FileManager.default.fileExists(atPath: dest.path) {
            dest = dir.appendingPathComponent("\(i)-\(suggestedFilename)")
            i += 1
        }
        completionHandler(dest)
    }

    func downloadDidFinish(_ download: WKDownload) {
        NSSound(named: "Glass")?.play()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript(
            "(localStorage.getItem('tradingagents_token') ? 'token:SET' : 'token:MISSING') + " +
            "(document.body.innerText.indexOf('Access TradingAgentsGUI') >= 0 ? ' gate:VISIBLE' : ' gate:HIDDEN')"
        ) { result, _ in
            if let s = result as? String { appLog("page loaded — \(s)") }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
