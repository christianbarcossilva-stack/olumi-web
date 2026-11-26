// Ondi Scanner: escáner de red gratuito de Ondi (Unity Tech).
// Se abre con doble clic, muestra su pantalla en el navegador (http://127.0.0.1:47800) y recorre la red:
// quién responde, nombre, fabricante, MAC y qué servicios tiene. También es el ayudante de Ondi web:
// le pasa el escaneo y la señal wifi para el mapa de calor, después de emparejar con un código de 6 números.
package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	VERSION = "1.1.0"
	PUERTO  = 47800
)

//go:embed ui
var uiFS embed.FS

var (
	codigo   string                                   // emparejado con Ondi web
	tokenUI  string                                   // solo la pantalla propia lo conoce
	origenes = regexp.MustCompile(`^(https://(www\.)?unitytech\.uy|http://(127\.0\.0\.1|localhost)(:\d+)?)$`)
	ultimaUI atomic.Int64                             // la pantalla avisa que sigue abierta
	ultimaOn atomic.Int64                             // Ondi web pidió algo
	ultimo   struct{ sync.Mutex; r []Equipo; red string } // el último escaneo, para la pantalla
)

func dirConf() string {
	d, err := os.UserConfigDir()
	if err != nil {
		d = os.TempDir()
	}
	d = filepath.Join(d, "OndiScanner")
	os.MkdirAll(d, 0o755)
	return d
}

func cargarCodigo() {
	f := filepath.Join(dirConf(), "codigo.txt")
	if b, err := os.ReadFile(f); err == nil && regexp.MustCompile(`^\d{6}$`).Match([]byte(strings.TrimSpace(string(b)))) {
		codigo = strings.TrimSpace(string(b))
		return
	}
	n, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	codigo = fmt.Sprintf("%06d", n.Int64())
	os.WriteFile(f, []byte(codigo), 0o600)
}

func main() {
	url := fmt.Sprintf("http://127.0.0.1:%d/", PUERTO)
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", PUERTO))
	if err != nil { // ya está abierto: se muestra la pantalla del que está corriendo
		if ventana {
			avisarApp("URL " + url)
			escucharApp()
		}
		abrirURL(url)
		return
	}
	cargarCodigo()
	b := make([]byte, 16)
	rand.Read(b)
	tokenUI = hex.EncodeToString(b)
	go cargarOUI()
	ultimaUI.Store(time.Now().Unix())
	mux := http.NewServeMux()
	rutas(mux)
	if ventana { // la app de Mac muestra la pantalla y decide cuándo cerrar
		go escucharApp()
		ln2 := ln
		go func() { time.Sleep(100 * time.Millisecond); avisarApp("URL " + url) }()
		http.Serve(ln2, mux)
		return
	}
	go func() {
		// se cierra solo si nadie lo usa: ni la pantalla (que avisa cada 5 s) ni Ondi web
		for range time.Tick(30 * time.Second) {
			n := time.Now().Unix()
			if n-ultimaUI.Load() > 15*60 && n-ultimaOn.Load() > 30*60 {
				os.Exit(0)
			}
		}
	}()
	go func() { time.Sleep(300 * time.Millisecond); abrirURL(url) }()
	fmt.Printf("Ondi Scanner %s · %s\nCódigo para Ondi web: %s\n", VERSION, url, codigo)
	http.Serve(ln, mux)
}

func jsonW(w http.ResponseWriter, v any, cod int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(cod)
	json.NewEncoder(w).Encode(v)
}

// lo que pide Ondi web (otro origen): CORS, red privada y código de emparejado
func cors(w http.ResponseWriter, r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o != "" && !origenes.MatchString(o) {
		jsonW(w, map[string]string{"error": "origen"}, 403)
		return false
	}
	if o != "" {
		w.Header().Set("Access-Control-Allow-Origin", o)
		w.Header().Set("Vary", "Origin")
	}
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Ondi-Codigo")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Private-Network", "true")
	if r.Method == http.MethodOptions {
		w.WriteHeader(204)
		return false
	}
	return true
}

func emparejado(r *http.Request) bool { return r.Header.Get("X-Ondi-Codigo") == codigo }

// lo que pide la pantalla propia: mismo origen y el token que solo ella tiene
func deLaUI(w http.ResponseWriter, r *http.Request) bool {
	o := r.Header.Get("Origin")
	if (o != "" && o != fmt.Sprintf("http://127.0.0.1:%d", PUERTO)) || r.Header.Get("X-Ondi-UI") != tokenUI {
		jsonW(w, map[string]string{"error": "no autorizado"}, 403)
		return false
	}
	ultimaUI.Store(time.Now().Unix())
	return true
}

func rutas(mux *http.ServeMux) {
	sub, _ := fs.Sub(uiFS, "ui")
	archivos := http.FileServer(http.FS(sub))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			b, _ := fs.ReadFile(sub, "index.html")
			html := strings.Replace(string(b), "{{TOKEN}}", tokenUI, 1)
			html = strings.Replace(html, "{{VERSION}}", VERSION, -1)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.Write([]byte(html))
			return
		}
		archivos.ServeHTTP(w, r)
	})

	// ----- para la pantalla propia -----
	mux.HandleFunc("/api/estado", func(w http.ResponseWriter, r *http.Request) {
		if !deLaUI(w, r) {
			return
		}
		jsonW(w, map[string]any{"version": VERSION, "codigo": codigo, "so": runtime.GOOS, "redes": misRedes(), "ondi": time.Now().Unix()-ultimaOn.Load() < 60, "equipo": nombreEquipo()}, 200)
	})
	mux.HandleFunc("/api/escanear", func(w http.ResponseWriter, r *http.Request) {
		if !deLaUI(w, r) {
			return
		}
		escanearHTTP(w, r, true)
	})
	mux.HandleFunc("/api/ultimo", func(w http.ResponseWriter, r *http.Request) {
		if !deLaUI(w, r) {
			return
		}
		ultimo.Lock()
		defer ultimo.Unlock()
		jsonW(w, map[string]any{"red": ultimo.red, "equipos": ultimo.r}, 200)
	})
	mux.HandleFunc("/api/abrir", func(w http.ResponseWriter, r *http.Request) {
		if !deLaUI(w, r) {
			return
		}
		var d struct{ Que, IP string; Puerto int }
		json.NewDecoder(r.Body).Decode(&d)
		if net.ParseIP(d.IP) == nil {
			jsonW(w, map[string]string{"error": "IP inválida"}, 400)
			return
		}
		switch d.Que {
		case "web":
			esq := "http"
			if d.Puerto == 443 || d.Puerto == 8443 {
				esq = "https"
			}
			u := esq + "://" + d.IP
			if d.Puerto != 0 && d.Puerto != 80 && d.Puerto != 443 {
				u += fmt.Sprintf(":%d", d.Puerto)
			}
			abrirURL(u + "/")
		case "rdp":
			abrirRDP(d.IP)
		case "ondi":
			abrirURL("https://unitytech.uy/ondi/?desde=scanner")
		}
		jsonW(w, map[string]bool{"ok": true}, 200)
	})
	mux.HandleFunc("/api/wol", func(w http.ResponseWriter, r *http.Request) {
		if !deLaUI(w, r) {
			return
		}
		var d struct{ MAC string }
		json.NewDecoder(r.Body).Decode(&d)
		if err := despertar(d.MAC); err != nil {
			jsonW(w, map[string]string{"error": err.Error()}, 400)
			return
		}
		jsonW(w, map[string]bool{"ok": true}, 200)
	})
	mux.HandleFunc("/api/salir", func(w http.ResponseWriter, r *http.Request) {
		if !deLaUI(w, r) {
			return
		}
		jsonW(w, map[string]bool{"ok": true}, 200)
		go func() { time.Sleep(200 * time.Millisecond); os.Exit(0) }()
	})

	// ----- para Ondi web (compatible con Ondi Técnico) -----
	mux.HandleFunc("/hola", func(w http.ResponseWriter, r *http.Request) {
		if !cors(w, r) {
			return
		}
		ultimaOn.Store(time.Now().Unix())
		jsonW(w, map[string]any{"ok": true, "version": "1.1", "programa": "Ondi Scanner " + VERSION, "so": soNombre(), "equipo": nombreEquipo(), "redes": misRedes(), "emparejado": emparejado(r)}, 200)
	})
	mux.HandleFunc("/wifi", func(w http.ResponseWriter, r *http.Request) {
		if !cors(w, r) {
			return
		}
		if !emparejado(r) {
			jsonW(w, map[string]string{"error": "codigo"}, 401)
			return
		}
		ultimaOn.Store(time.Now().Unix())
		jsonW(w, muestreo.leer(), 200)
	})
	mux.HandleFunc("/escanear", func(w http.ResponseWriter, r *http.Request) {
		if !cors(w, r) {
			return
		}
		if !emparejado(r) {
			jsonW(w, map[string]string{"error": "codigo"}, 401)
			return
		}
		ultimaOn.Store(time.Now().Unix())
		escanearHTTP(w, r, false)
	})
}

func nombreEquipo() string { h, _ := os.Hostname(); return h }

func soNombre() string {
	switch runtime.GOOS {
	case "windows":
		return "Windows"
	case "darwin":
		return "Mac"
	}
	return "Linux"
}
