// Ondi Scanner para Mac: la ventana propia de la app.
// Arranca el motor (ondi-motor, el mismo programa de Windows, en modo «--ventana»), muestra su pantalla
// en una ventana nativa y le lee el wifi con CoreWLAN cuando el motor lo pide (mapa de calor caminando).

import Cocoa
import WebKit
import CoreWLAN
import CoreLocation

final class Delegado: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, CLLocationManagerDelegate {
    var ventana: NSWindow!
    var web: WKWebView!
    let motor = Process()
    let entrada = Pipe()
    let salida = Pipe()
    var resto = Data()
    var urlMotor: URL?
    var ubicacion: CLLocationManager?
    let colaWifi = DispatchQueue(label: "uy.unitytech.ondiscanner.wifi")

    func applicationDidFinishLaunching(_ aviso: Notification) {
        armarMenu()
        armarVentana()
        arrancarMotor()
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ aviso: Notification) {
        if motor.isRunning { motor.terminate() }
    }

    // ---------- menú ----------
    func armarMenu() {
        let barra = NSMenu()
        func menu(_ titulo: String, _ items: [NSMenuItem]) {
            let it = NSMenuItem()
            let m = NSMenu(title: titulo)
            items.forEach { m.addItem($0) }
            it.submenu = m
            barra.addItem(it)
        }
        func item(_ t: String, _ a: Selector?, _ k: String, _ destino: AnyObject? = nil) -> NSMenuItem {
            let i = NSMenuItem(title: t, action: a, keyEquivalent: k)
            if let d = destino { i.target = d }
            return i
        }
        menu("Ondi Scanner", [
            item("Acerca de Ondi Scanner", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), ""),
            .separator(),
            item("Ocultar Ondi Scanner", #selector(NSApplication.hide(_:)), "h"),
            .separator(),
            item("Salir de Ondi Scanner", #selector(NSApplication.terminate(_:)), "q"),
        ])
        menu("Edición", [
            item("Deshacer", Selector(("undo:")), "z"),
            .separator(),
            item("Cortar", #selector(NSText.cut(_:)), "x"),
            item("Copiar", #selector(NSText.copy(_:)), "c"),
            item("Pegar", #selector(NSText.paste(_:)), "v"),
            item("Seleccionar todo", #selector(NSText.selectAll(_:)), "a"),
        ])
        menu("Visualización", [
            item("Volver a cargar", #selector(recargar), "r", self),
        ])
        menu("Ventana", [
            item("Minimizar", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("Cerrar", #selector(NSWindow.performClose(_:)), "w"),
        ])
        NSApp.mainMenu = barra
    }

    @objc func recargar() {
        if let u = urlMotor { web.load(URLRequest(url: u)) }
    }

    // ---------- ventana ----------
    func armarVentana() {
        let conf = WKWebViewConfiguration()
        conf.userContentController.add(self, name: "ondi")
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1180, height: 760), configuration: conf)
        web.navigationDelegate = self
        web.uiDelegate = self
        ventana = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 760),
                           styleMask: [.titled, .closable, .miniaturizable, .resizable],
                           backing: .buffered, defer: false)
        ventana.title = "Ondi Scanner"
        ventana.minSize = NSSize(width: 720, height: 480)
        ventana.contentView = web
        ventana.delegate = self
        ventana.center()
        ventana.setFrameAutosaveName("OndiScanner")
        ventana.makeKeyAndOrderFront(nil)
        web.loadHTMLString(Delegado.espera, baseURL: nil)
    }

    static let espera = """
    <!doctype html><meta charset="utf-8"><style>
    :root{color-scheme:light dark;background:#eef1f4;color:#5a6573}
    @media (prefers-color-scheme:dark){:root{background:#101419;color:#93a0ae}}
    body{margin:0;height:100vh;display:grid;place-content:center;font:14px -apple-system,system-ui,sans-serif}
    </style><body>Arrancando Ondi Scanner…</body>
    """

    func mostrarError(_ texto: String) {
        let a = NSAlert()
        a.messageText = "Ondi Scanner no pudo arrancar"
        a.informativeText = texto
        a.runModal()
        NSApp.terminate(nil)
    }

    // ---------- el motor ----------
    func arrancarMotor() {
        guard let ruta = Bundle.main.url(forAuxiliaryExecutable: "ondi-motor") else {
            mostrarError("Falta una parte del programa. Bajalo de nuevo desde unitytech.uy/ondi/scanner.")
            return
        }
        motor.executableURL = ruta
        motor.arguments = ["--ventana"]
        motor.standardInput = entrada
        motor.standardOutput = salida
        motor.standardError = FileHandle.nullDevice
        motor.terminationHandler = { _ in
            DispatchQueue.main.async { NSApp.terminate(nil) }
        }
        salida.fileHandleForReading.readabilityHandler = { [weak self] h in
            let d = h.availableData
            if d.isEmpty {
                h.readabilityHandler = nil
                return
            }
            DispatchQueue.main.async { self?.recibir(d) }
        }
        do {
            try motor.run()
        } catch {
            mostrarError(error.localizedDescription)
        }
    }

    func recibir(_ d: Data) {
        resto.append(d)
        while let i = resto.firstIndex(of: 0x0A) {
            let linea = String(decoding: resto[resto.startIndex..<i], as: UTF8.self)
            resto.removeSubrange(resto.startIndex...i)
            if linea.hasPrefix("URL ") {
                let texto = String(linea.dropFirst(4)).trimmingCharacters(in: .whitespaces)
                if let u = URL(string: texto) {
                    urlMotor = u
                    web.load(URLRequest(url: u))
                }
            } else if linea == "WIFI" {
                pedirWifi()
            }
        }
    }

    nonisolated func escribirAlMotor(_ s: String) {
        guard let d = s.data(using: .utf8) else { return }
        do {
            try entrada.fileHandleForWriting.write(contentsOf: d)
        } catch {}
    }

    // ---------- wifi (CoreWLAN) ----------
    // La Mac solo muestra el nombre y la MAC de las redes a las apps con permiso de Localización.
    func pedirWifi() {
        if ubicacion == nil {
            let u = CLLocationManager()
            u.delegate = self
            ubicacion = u
            if u.authorizationStatus == .notDetermined {
                u.requestWhenInUseAuthorization()
            }
        }
        let estado = ubicacion?.authorizationStatus.rawValue ?? 0
        let permitido = estado == 3 || estado == 4 // autorizada siempre / al usarla
        colaWifi.async { [weak self] in
            guard let self = self else { return }
            let json = self.lecturaWifi(permitido: permitido)
            self.escribirAlMotor("WIFI " + json + "\n")
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {}

    nonisolated func banda(_ b: CWChannelBand?) -> String {
        guard let b = b else { return "" }
        switch b.rawValue {
        case 1: return "2.4"
        case 2: return "5"
        case 3: return "6"
        default: return ""
        }
    }

    nonisolated func lecturaWifi(permitido: Bool) -> String {
        var redes: [[String: Any]] = []
        var actual: [String: Any]? = nil
        if let i = CWWiFiClient.shared().interface() {
            if let ch = i.wlanChannel(), i.rssiValue() != 0 {
                var a: [String: Any] = [
                    "ssid": i.ssid() ?? "",
                    "bssid": (i.bssid() ?? "").lowercased(),
                    "rssi": i.rssiValue(),
                    "canal": ch.channelNumber,
                    "banda": banda(ch.channelBand),
                ]
                if i.noiseMeasurement() != 0 { a["ruido"] = i.noiseMeasurement() }
                actual = a
            }
            if let lista = try? i.scanForNetworks(withName: nil) {
                for n in lista {
                    var x: [String: Any] = [
                        "ssid": n.ssid ?? "",
                        "bssid": (n.bssid ?? "").lowercased(),
                        "rssi": n.rssiValue,
                        "canal": n.wlanChannel?.channelNumber ?? 0,
                        "banda": banda(n.wlanChannel?.channelBand),
                    ]
                    if n.noiseMeasurement != 0 { x["ruido"] = n.noiseMeasurement }
                    redes.append(x)
                }
            }
            // la red conectada también va en la lista, aunque el escaneo no la haya traído
            if let a = actual {
                let b = a["bssid"] as? String ?? ""
                let ya = redes.contains { ($0["bssid"] as? String ?? "") == b && !b.isEmpty }
                if !ya { redes.append(a) }
            }
        }
        var l: [String: Any] = ["fuente": "Mac", "exacto": true, "redes": redes]
        if let a = actual { l["actual"] = a }
        if !permitido { l["permiso"] = "ubicacion" }
        guard let d = try? JSONSerialization.data(withJSONObject: l),
              let s = String(data: d, encoding: .utf8) else { return "{\"redes\":[]}" }
        return s
    }

    // ---------- la página ----------
    // copiar y «Bajar lista» llegan desde la pantalla por window.webkit.messageHandlers.ondi
    func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let d = m.body as? [String: Any] else { return }
        if let t = d["copiar"] as? String {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(t, forType: .string)
        } else if let nombre = d["guardar"] as? String, let texto = d["texto"] as? String {
            let p = NSSavePanel()
            p.nameFieldStringValue = nombre
            p.beginSheetModal(for: ventana) { r in
                if r == .OK, let u = p.url {
                    try? texto.data(using: .utf8)?.write(to: u)
                }
            }
        }
    }

    // lo que no es la pantalla del motor (páginas de equipos, Ondi) se abre en el navegador
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler h: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = a.request.url, let host = u.host, host != "127.0.0.1", u.scheme == "http" || u.scheme == "https" {
            NSWorkspace.shared.open(u)
            h(.cancel)
            return
        }
        h(.allow)
    }

    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url { NSWorkspace.shared.open(u) }
        return nil
    }

    // si el motor todavía no atendía, se reintenta
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in self?.recargar() }
    }

    func webViewWebContentProcessDidTerminate(_ w: WKWebView) { recargar() }
}

signal(SIGPIPE, SIG_IGN) // si el motor se cerró, escribirle no tiene que tirar la app
let app = NSApplication.shared
let delegado = Delegado()
app.delegate = delegado
app.setActivationPolicy(.regular)
app.run()
