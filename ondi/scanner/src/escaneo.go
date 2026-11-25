package main

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type Equipo struct {
	IP       string   `json:"ip"`
	MS       *float64 `json:"ms"`
	Nombre   string   `json:"nombre"`
	MAC      string   `json:"mac"`
	Fab      string   `json:"fab"`
	Puertos  []int    `json:"puertos"`
	Que      []string `json:"que"`
	Web      string   `json:"web"`
	Servidor string   `json:"servidor"`
	Tipo     string   `json:"tipo"`
	Yo       bool     `json:"yo,omitempty"`
	T        string   `json:"t,omitempty"`
}

// los puertos que se prueban y para qué sirven
var PUERTOS = []int{80, 443, 554, 8000, 37777, 22, 23, 8080, 8291, 8443, 5000, 5001, 9000, 3389, 445, 139, 1883, 9100, 631, 21, 5900, 7547}
var QUE = map[int]string{80: "web", 443: "web segura", 554: "video RTSP", 8000: "Hikvision", 37777: "Dahua", 22: "SSH", 23: "Telnet", 8080: "web", 8291: "Winbox (MikroTik)", 8443: "web segura",
	5000: "web (NAS)", 5001: "web segura (NAS)", 9000: "web", 3389: "escritorio remoto", 445: "carpetas compartidas", 139: "NetBIOS", 1883: "MQTT", 9100: "impresión", 631: "impresión (IPP)", 21: "FTP", 5900: "VNC", 7547: "gestión del proveedor (TR-069)"}

type Red struct {
	IP     string `json:"ip"`
	Red    string `json:"red"`
	Placa  string `json:"placa"`
	Cuanto int    `json:"cuantos"`
}

// las redes de esta compu (sin las virtuales de VPN ni las de 169.254)
func misRedes() []Red {
	out := []Red{}
	ifs, _ := net.Interfaces()
	for _, i := range ifs {
		if i.Flags&net.FlagUp == 0 || i.Flags&net.FlagLoopback != 0 {
			continue
		}
		n := strings.ToLower(i.Name)
		if strings.Contains(n, "vmnet") || strings.Contains(n, "vbox") || strings.Contains(n, "docker") || strings.HasPrefix(n, "utun") || strings.HasPrefix(n, "awdl") || strings.HasPrefix(n, "llw") {
			continue
		}
		addrs, _ := i.Addrs()
		for _, a := range addrs {
			ipn, ok := a.(*net.IPNet)
			if !ok || ipn.IP.To4() == nil || ipn.IP.IsLinkLocalUnicast() {
				continue
			}
			uno, bits := ipn.Mask.Size()
			if bits != 32 {
				continue
			}
			if uno < 22 { // una red muy grande se recorre de a /24, la de esta compu
				uno = 24
			}
			red := &net.IPNet{IP: ipn.IP.Mask(net.CIDRMask(uno, 32)), Mask: net.CIDRMask(uno, 32)}
			out = append(out, Red{IP: ipn.IP.String(), Red: red.String(), Placa: i.Name, Cuanto: 1<<(32-uno) - 2})
		}
	}
	return out
}

// «192.168.1.0/24», «192.168.1.10-200», «10.0.0.1-10.0.0.50» o varias separadas por coma
func direcciones(txt string) ([]string, error) {
	var out []string
	seen := map[string]bool{}
	add := func(ip net.IP) {
		s := ip.String()
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	for _, parte := range regexp.MustCompile(`[,;\s]+`).Split(strings.TrimSpace(txt), -1) {
		if parte == "" {
			continue
		}
		if strings.Contains(parte, "/") {
			_, n, err := net.ParseCIDR(parte)
			if err != nil || n.IP.To4() == nil {
				return nil, fmt.Errorf("no entiendo «%s»", parte)
			}
			uno, _ := n.Mask.Size()
			if uno < 20 {
				return nil, fmt.Errorf("«%s» es muy grande: hasta 4096 direcciones", parte)
			}
			base := binary.BigEndian.Uint32(n.IP.To4())
			cant := uint32(1) << (32 - uno)
			for k := uint32(0); k < cant; k++ {
				if cant > 2 && (k == 0 || k == cant-1) {
					continue
				}
				b := make(net.IP, 4)
				binary.BigEndian.PutUint32(b, base+k)
				add(b)
			}
			continue
		}
		if strings.Contains(parte, "-") {
			ab := strings.SplitN(parte, "-", 2)
			a := net.ParseIP(ab[0]).To4()
			if a == nil {
				return nil, fmt.Errorf("no entiendo «%s»", parte)
			}
			var b net.IP
			if strings.Contains(ab[1], ".") {
				b = net.ParseIP(ab[1]).To4()
			} else {
				var n int
				fmt.Sscanf(ab[1], "%d", &n)
				b = net.IPv4(a[0], a[1], a[2], byte(n)).To4()
			}
			if b == nil {
				return nil, fmt.Errorf("no entiendo «%s»", parte)
			}
			x, y := binary.BigEndian.Uint32(a), binary.BigEndian.Uint32(b)
			if y < x || y-x > 4096 {
				return nil, fmt.Errorf("«%s»: hasta 4096 direcciones", parte)
			}
			for k := x; k <= y; k++ {
				c := make(net.IP, 4)
				binary.BigEndian.PutUint32(c, k)
				add(c)
			}
			continue
		}
		ip := net.ParseIP(parte).To4()
		if ip == nil {
			return nil, fmt.Errorf("no entiendo «%s»", parte)
		}
		add(ip)
	}
	if len(out) > 4096 {
		return nil, errors.New("hasta 4096 direcciones por vez")
	}
	if len(out) == 0 {
		return nil, errors.New("poné una red, por ejemplo 192.168.1.0/24")
	}
	return out, nil
}

// devuelve (abierto, el equipo existe): un rechazo también prueba que el equipo está
func tcp(ip string, p int, t time.Duration) (bool, bool) {
	c, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", ip, p), t)
	if err == nil {
		c.Close()
		return true, true
	}
	if errors.Is(err, syscall.ECONNREFUSED) || strings.Contains(strings.ToLower(err.Error()), "refused") {
		return false, true
	}
	return false, false
}

var reMS = regexp.MustCompile(`(?i)(?:time|tiempo)[=<]\s*([\d.,]+)\s*ms`)

func ping1(ip string) (bool, *float64) {
	var c = cmdOculto("ping", argsPing(ip)...)
	t0 := time.Now()
	out, err := salida(c, 3*time.Second)
	txt := strings.ToUpper(out)
	if err != nil || !strings.Contains(txt, "TTL=") {
		return false, nil
	}
	ms := float64(time.Since(t0).Milliseconds())
	if m := reMS.FindStringSubmatch(out); m != nil {
		fmt.Sscanf(strings.Replace(m[1], ",", ".", 1), "%g", &ms)
	}
	return true, &ms
}

func salida(c interface {
	Output() ([]byte, error)
}, t time.Duration) (string, error) {
	type r struct {
		b   []byte
		err error
	}
	ch := make(chan r, 1)
	go func() { b, err := c.Output(); ch <- r{b, err} }()
	select {
	case x := <-ch:
		return decodificar(x.b), x.err
	case <-time.After(t):
		return "", errors.New("tiempo")
	}
}

// NetBIOS: el nombre de las compus Windows (y de muchos NAS e impresoras)
func netbios(ip string) string {
	c, err := net.DialTimeout("udp", ip+":137", 600*time.Millisecond)
	if err != nil {
		return ""
	}
	defer c.Close()
	q := []byte{0x4f, 0x4e, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0x20, 'C', 'K'}
	for i := 0; i < 30; i++ {
		q = append(q, 'A')
	}
	q = append(q, 0, 0, 0x21, 0, 1)
	c.SetDeadline(time.Now().Add(700 * time.Millisecond))
	if _, err := c.Write(q); err != nil {
		return ""
	}
	b := make([]byte, 1024)
	n, err := c.Read(b)
	if err != nil || n < 57 {
		return ""
	}
	cant := int(b[56])
	for i := 0; i < cant; i++ {
		o := 57 + i*18
		if o+18 > n {
			break
		}
		nombre := strings.TrimSpace(string(b[o : o+15]))
		suf, flags := b[o+15], binary.BigEndian.Uint16(b[o+16:o+18])
		if suf == 0 && flags&0x8000 == 0 && nombre != "" { // único, no de grupo
			return nombre
		}
	}
	return ""
}

var reTit = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
var webCli = &http.Client{Timeout: 1800 * time.Millisecond, Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, DisableKeepAlives: true},
	CheckRedirect: func(r *http.Request, via []*http.Request) error {
		if len(via) > 2 {
			return http.ErrUseLastResponse
		}
		return nil
	}}

// el título de la página de administración: casi siempre dice qué equipo es
func tituloWeb(ip string, puertos []int) (string, string) {
	for _, p := range []int{80, 8080, 443, 8443, 5000, 9000} {
		if !tiene(puertos, p) {
			continue
		}
		esq := "http"
		if p == 443 || p == 8443 {
			esq = "https"
		}
		r, err := webCli.Get(fmt.Sprintf("%s://%s:%d/", esq, ip, p))
		if err != nil {
			continue
		}
		b, _ := io.ReadAll(io.LimitReader(r.Body, 12000))
		r.Body.Close()
		t := ""
		if m := reTit.FindSubmatch(b); m != nil {
			t = strings.Join(strings.Fields(string(m[1])), " ")
			if len(t) > 70 {
				t = t[:70]
			}
		}
		srv := r.Header.Get("Server")
		if len(srv) > 40 {
			srv = srv[:40]
		}
		return t, srv
	}
	return "", ""
}

func tiene(l []int, p int) bool {
	for _, x := range l {
		if x == p {
			return true
		}
	}
	return false
}

func tipoDe(e *Equipo) string {
	t := strings.ToLower(e.Fab + " " + e.Web + " " + e.Servidor + " " + e.Nombre)
	P := func(p int) bool { return tiene(e.Puertos, p) }
	switch {
	case e.Yo:
		return "pc"
	case P(8291) || strings.Contains(t, "mikrotik") || strings.Contains(t, "routeros"):
		return "router"
	case P(37777) || P(554) || P(8000) || strings.Contains(t, "hikvision") || strings.Contains(t, "dahua") || strings.Contains(t, "nvr") || strings.Contains(t, "dvr") || strings.Contains(t, "camera") || strings.Contains(t, "cámara") || strings.Contains(t, "app-webs"):
		return "camara"
	case P(9100) || P(631) || strings.Contains(t, "printer") || strings.Contains(t, "impresora") || strings.Contains(t, "epson") || strings.Contains(t, "brother") || strings.Contains(t, "hewlett") || strings.Contains(t, "laserjet") || strings.Contains(t, "kyocera") || strings.Contains(t, "ricoh"):
		return "impresora"
	case strings.Contains(t, "unifi") || strings.Contains(t, "ubiquiti") || strings.Contains(t, "omada") || strings.Contains(t, "access point") || strings.Contains(t, "ruckus") || strings.Contains(t, "aruba"):
		return "ap"
	case strings.Contains(t, "switch"):
		return "switch"
	case strings.Contains(t, "synology") || strings.Contains(t, "qnap") || strings.Contains(t, "diskstation") || (P(5000) && P(5001)):
		return "nas"
	case P(3389) || P(445) || P(139):
		return "pc"
	case strings.Contains(t, "espressif") || strings.Contains(t, "sonoff") || strings.Contains(t, "tuya") || P(1883):
		return "iot"
	case strings.Contains(t, "privada"):
		return "movil"
	case P(7547) || strings.Contains(t, "router") || strings.Contains(t, "gateway") || strings.Contains(t, "huawei") || strings.Contains(t, "zte") || strings.Contains(t, "sagemcom") || strings.Contains(t, "technicolor") || strings.Contains(t, "tp-link"):
		return "router"
	case strings.Contains(t, "apple"):
		return "pc"
	}
	return "otro"
}

func explorar(ip string, conPuertos bool) *Equipo {
	vivo, ms := ping1(ip)
	var mu sync.Mutex
	abiertos := []int{}
	var wg sync.WaitGroup
	for _, p := range []int{80, 443, 554, 445, 22} {
		wg.Add(1)
		go func(p int) {
			defer wg.Done()
			ab, esta := tcp(ip, p, 450*time.Millisecond)
			mu.Lock()
			vivo = vivo || esta
			if ab {
				abiertos = append(abiertos, p)
			}
			mu.Unlock()
		}(p)
	}
	wg.Wait()
	if !vivo {
		return nil
	}
	if conPuertos {
		for _, p := range PUERTOS {
			if tiene([]int{80, 443, 554, 445, 22}, p) {
				continue
			}
			wg.Add(1)
			go func(p int) {
				defer wg.Done()
				if ab, _ := tcp(ip, p, 600*time.Millisecond); ab {
					mu.Lock()
					abiertos = append(abiertos, p)
					mu.Unlock()
				}
			}(p)
		}
		wg.Wait()
	}
	sort.Ints(abiertos)
	e := &Equipo{IP: ip, MS: ms, Puertos: abiertos}
	ctx, cancel := context.WithTimeout(context.Background(), 1200*time.Millisecond)
	if n, err := net.DefaultResolver.LookupAddr(ctx, ip); err == nil && len(n) > 0 {
		e.Nombre = strings.TrimSuffix(n[0], ".")
	}
	cancel()
	if e.Nombre == "" {
		e.Nombre = netbios(ip)
	}
	e.Web, e.Servidor = tituloWeb(ip, abiertos)
	for _, p := range abiertos {
		e.Que = append(e.Que, QUE[p])
	}
	return e
}

var reIP = regexp.MustCompile(`(\d{1,3}(?:\.\d{1,3}){3})`)
var reMAC = regexp.MustCompile(`([0-9A-Fa-f]{1,2}(?:[:-][0-9A-Fa-f]{1,2}){5})`)

func tablaARP() map[string]string {
	out, _ := salida(cmdOculto("arp", "-a"), 8*time.Second)
	if out == "" {
		out, _ = salida(cmdOculto("ip", "neigh"), 5*time.Second)
	}
	t := map[string]string{}
	sc := bufio.NewScanner(strings.NewReader(out))
	for sc.Scan() {
		ln := sc.Text()
		ip, mac := reIP.FindString(ln), reMAC.FindString(ln)
		if ip == "" || mac == "" {
			continue
		}
		ps := regexp.MustCompile(`[:-]`).Split(mac, -1)
		for i := range ps {
			if len(ps[i]) == 1 {
				ps[i] = "0" + ps[i]
			}
		}
		m := strings.ToUpper(strings.Join(ps, ":"))
		if m != "FF:FF:FF:FF:FF:FF" && m != "00:00:00:00:00:00" && !strings.HasPrefix(m, "01:00:5E") {
			t[ip] = m
		}
	}
	return t
}

func misIPs() map[string]bool {
	r := map[string]bool{}
	for _, x := range misRedes() {
		r[x.IP] = true
	}
	return r
}

// escaneo con avance: una línea JSON por novedad (lo leen la pantalla propia y Ondi web)
func escanearHTTP(w http.ResponseWriter, r *http.Request, propia bool) {
	var d struct {
		Red     string `json:"red"`
		Puertos *bool  `json:"puertos"`
	}
	json.NewDecoder(r.Body).Decode(&d)
	ips, err := direcciones(d.Red)
	if err != nil {
		jsonW(w, map[string]string{"error": err.Error()}, 400)
		return
	}
	conP := d.Puertos == nil || *d.Puertos
	fl, _ := w.(http.Flusher)
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(200)
	var wmu sync.Mutex
	enviar := func(o any) bool {
		wmu.Lock()
		defer wmu.Unlock()
		b, _ := json.Marshal(o)
		if _, err := w.Write(append(b, '\n')); err != nil {
			return false
		}
		if fl != nil {
			fl.Flush()
		}
		return true
	}
	t0 := time.Now()
	enviar(map[string]any{"t": "inicio", "total": len(ips), "red": d.Red})
	ctx := r.Context()
	var hechos atomic.Int64
	res := make([]*Equipo, len(ips))
	sem := make(chan struct{}, 96)
	var wg sync.WaitGroup
	for i, ip := range ips {
		if ctx.Err() != nil {
			break
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(i int, ip string) {
			defer func() { <-sem; wg.Done() }()
			if ctx.Err() != nil {
				return
			}
			if e := explorar(ip, conP); e != nil {
				res[i] = e
				if propia { // la pantalla propia los va mostrando a medida que aparecen
					enviar(map[string]any{"t": "visto", "ip": e.IP})
				}
			}
			if n := hechos.Add(1); n%8 == 0 || int(n) == len(ips) {
				enviar(map[string]any{"t": "avance", "hechos": n})
			}
		}(i, ip)
	}
	wg.Wait()
	if ctx.Err() != nil {
		return
	}
	arp, yo := tablaARP(), misIPs()
	lista := []Equipo{}
	for _, e := range res {
		if e == nil {
			continue
		}
		if yo[e.IP] {
			e.Yo, e.Fab = true, "Esta compu"
			if e.Nombre == "" {
				e.Nombre = nombreEquipo()
			}
		} else {
			e.MAC = arp[e.IP]
			e.Fab = fabricante(e.MAC)
		}
		e.Tipo = tipoDe(e)
		e.T = "equipo"
		enviar(e)
		lista = append(lista, *e)
	}
	ultimo.Lock()
	ultimo.r, ultimo.red = lista, d.Red
	ultimo.Unlock()
	guardarUltimo(lista, d.Red)
	enviar(map[string]any{"t": "fin", "encontrados": len(lista), "seg": float64(time.Since(t0).Milliseconds()/100) / 10})
}

func guardarUltimo(l []Equipo, red string) {
	b, _ := json.Marshal(map[string]any{"red": red, "equipos": l, "fecha": time.Now().Format(time.RFC3339)})
	os.WriteFile(filepath.Join(dirConf(), "ultimo.json"), b, 0o600)
}

// encender una compu por la red (la placa tiene que tener Wake-on-LAN activado)
func despertar(mac string) error {
	hw, err := net.ParseMAC(mac)
	if err != nil || len(hw) != 6 {
		return errors.New("MAC inválida")
	}
	p := make([]byte, 0, 102)
	for i := 0; i < 6; i++ {
		p = append(p, 0xff)
	}
	for i := 0; i < 16; i++ {
		p = append(p, hw...)
	}
	destinos := []string{"255.255.255.255:9"}
	for _, r := range misRedes() {
		_, n, _ := net.ParseCIDR(r.Red)
		b := make(net.IP, 4)
		for i := 0; i < 4; i++ {
			b[i] = n.IP.To4()[i] | ^n.Mask[i]
		}
		destinos = append(destinos, b.String()+":9")
	}
	var ultimoErr error
	enviados := 0
	for _, d := range destinos {
		c, err := net.Dial("udp", d)
		if err != nil {
			ultimoErr = err
			continue
		}
		if _, err := c.Write(p); err == nil {
			enviados++
		}
		c.Close()
	}
	if enviados == 0 {
		return ultimoErr
	}
	return nil
}
