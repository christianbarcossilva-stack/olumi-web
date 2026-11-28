package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// la función de Ondi que atiende a los integradores (ONDI_SERVIDOR la cambia para pruebas)
func servidor() string {
	if s := os.Getenv("ONDI_SERVIDOR"); s != "" {
		return s
	}
	return "https://pgriavmcmscchxdnfglv.supabase.co/functions/v1/ondi-integrador"
}

type Conf struct {
	Token, ID, Cliente, Enlazado string
}

type Equipo struct {
	ID     string `json:"id"`
	Nombre string `json:"nombre"`
	IP     string `json:"ip"`
	Puerto int    `json:"puerto"`
}

type Estado struct {
	ID    string   `json:"id"`
	OK    bool     `json:"ok"`
	MS    *float64 `json:"ms,omitempty"`
	Desde string   `json:"desde"` // desde cuándo está así (si estuvo sin internet, la hora real del cambio)
}

// un reporte que no pudo salir: se guarda solo lo que cambió, para contarlo al volver
type Pendiente struct {
	At     string   `json:"at"`
	Caidos []string `json:"caidos"`
}

var errBaja = errors.New("este integrador fue dado de baja o reemplazado en Ondi")

func archivo(n string) string { return filepath.Join(dirDatos(), n) }

func leerConf() (c Conf) {
	b, _ := os.ReadFile(archivo("enlace.json"))
	json.Unmarshal(b, &c)
	return
}

func guardar(n string, v any) error {
	b, _ := json.MarshalIndent(v, "", " ")
	t := archivo(n + ".tmp")
	if err := os.WriteFile(t, b, 0o600); err != nil {
		return err
	}
	return os.Rename(t, archivo(n))
}

var cliente = &http.Client{Timeout: 25 * time.Second}

func pedir(token string, cuerpo map[string]any, out any) error {
	cuerpo["version"], cuerpo["host"], cuerpo["so"], cuerpo["ip"] = VERSION, nombreHost(), soNombre(), ipLocal()
	b, _ := json.Marshal(cuerpo)
	req, _ := http.NewRequest("POST", servidor(), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "OndiIntegrador/"+VERSION)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	r, err := cliente.Do(req)
	if err != nil {
		return fmt.Errorf("sin conexión con Ondi (¿está habilitada la salida HTTPS a %s?): %w", hostDe(servidor()), err)
	}
	defer r.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(r.Body, 4<<20))
	var e struct{ Error string }
	json.Unmarshal(raw, &e)
	if r.StatusCode == 401 || r.StatusCode == 410 {
		return errBaja
	}
	if r.StatusCode != 200 {
		if e.Error == "" {
			e.Error = r.Status
		}
		return errors.New(e.Error)
	}
	return json.Unmarshal(raw, out)
}

func enlazar(cod string) error {
	cod = strings.ToUpper(regexp.MustCompile(`[^A-Za-z0-9]`).ReplaceAllString(cod, ""))
	if len(cod) != 8 {
		return errors.New("el código tiene 8 letras y números, como ABCD-EFGH")
	}
	var r struct{ Token, ID, Cliente string }
	if err := pedir("", map[string]any{"accion": "enlazar", "codigo": cod[:4] + "-" + cod[4:]}, &r); err != nil {
		return err
	}
	if err := guardar("enlace.json", Conf{r.Token, r.ID, r.Cliente, time.Now().Format(time.RFC3339)}); err != nil {
		return fmt.Errorf("no pude guardar el enlace en %s: %w", dirDatos(), err)
	}
	os.Remove(archivo("cola.json"))
	fmt.Printf("Enlazado con %s.\n", r.Cliente)
	return nil
}

func estado() {
	c := leerConf()
	if c.Token == "" {
		fmt.Println("Todavía no está enlazado: corré «ondi-integrador enlazar CODIGO».")
		return
	}
	var u struct {
		At                string
		Revisados, Caidos int
		Error             string
	}
	var cola []Pendiente
	b, _ := os.ReadFile(archivo("ultimo.json"))
	json.Unmarshal(b, &u)
	b, _ = os.ReadFile(archivo("cola.json"))
	json.Unmarshal(b, &cola)
	fmt.Printf("Cliente: %s\nEnlazado: %s\nServicio instalado: %v\n", c.Cliente, c.Enlazado, instalado())
	if u.At != "" {
		fmt.Printf("Último reporte: %s · %d equipos · %d caídos\n", u.At, u.Revisados, u.Caidos)
	}
	if u.Error != "" {
		fmt.Println("Último problema:", u.Error)
	}
	if len(cola) > 0 {
		fmt.Printf("Guardados sin internet: %d reportes (se mandan al volver)\n", len(cola))
	}
	fmt.Println("Datos y registro:", dirDatos())
}

func correr() {
	if l, err := net.Listen("tcp", "127.0.0.1:47801"); err == nil { // uno solo por máquina
		defer l.Close()
	} else {
		return
	}
	lf, _ := os.OpenFile(archivo("registro.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if st, err := lf.Stat(); err == nil && st.Size() > 1<<20 {
		lf.Truncate(0)
	}
	log.SetOutput(io.MultiWriter(os.Stdout, lf))
	log.Printf("Ondi Integrador %s arranca", VERSION)
	var (
		equipos   []Equipo
		intervalo = 60
		cfgVer    string
		previo    = map[string]Estado{}
		cola      []Pendiente
	)
	b, _ := os.ReadFile(archivo("cola.json"))
	json.Unmarshal(b, &cola)
	for {
		c := leerConf()
		if c.Token == "" {
			time.Sleep(time.Minute)
			continue
		}
		if cfgVer == "" {
			var r struct {
				Equipos   []Equipo
				Intervalo int
				Cfg       string
			}
			if err := pedir(c.Token, map[string]any{"accion": "config"}, &r); err != nil {
				log.Print(err)
				espera(err)
				continue
			}
			equipos, cfgVer = r.Equipos, r.Cfg
			if r.Intervalo >= 30 {
				intervalo = r.Intervalo
			}
			log.Printf("Configuración: %d equipos para revisar", len(equipos))
		}
		t0 := time.Now()
		est := revisarTodos(equipos, previo)
		caidos := []string{}
		for _, e := range est {
			previo[e.ID] = e
			if !e.OK {
				caidos = append(caidos, e.ID)
			}
		}
		var r struct{ Cfg string }
		err := pedir(c.Token, map[string]any{"accion": "reporte", "estados": est, "cola": cola}, &r)
		u := map[string]any{"at": t0.Format(time.RFC3339), "revisados": len(est), "caidos": len(caidos)}
		if err != nil {
			log.Print(err)
			u["error"] = err.Error()
			if err != errBaja {
				cola = append(cola, Pendiente{t0.Format(time.RFC3339), caidos})
				if len(cola) > 1440 { // un día de reportes por minuto
					cola = cola[len(cola)-1440:]
				}
			}
		} else {
			cola = nil
			if r.Cfg != cfgVer {
				cfgVer = "" // cambió la lista de equipos en Ondi
			}
		}
		guardar("cola.json", cola)
		guardar("ultimo.json", u)
		if err == errBaja {
			espera(err)
			continue
		}
		if d := time.Duration(intervalo)*time.Second - time.Since(t0); d > 0 {
			time.Sleep(d)
		}
	}
}

func espera(err error) {
	if err == errBaja {
		time.Sleep(10 * time.Minute)
	} else {
		time.Sleep(time.Minute)
	}
}

// revisa todos a la vez (de a 32): con puerto, que ese puerto atienda; sin puerto, ping y, si no responde, los puertos de siempre (web, RTSP)
func revisarTodos(eqs []Equipo, previo map[string]Estado) []Estado {
	out := make([]Estado, len(eqs))
	sem := make(chan struct{}, 32)
	var wg sync.WaitGroup
	ahora := time.Now().Format(time.RFC3339)
	for i, e := range eqs {
		wg.Add(1)
		go func(i int, e Equipo) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			ok, ms := revisar(e)
			d := ahora
			if p, hay := previo[e.ID]; hay && p.OK == ok {
				d = p.Desde
			}
			out[i] = Estado{e.ID, ok, ms, d}
		}(i, e)
	}
	wg.Wait()
	return out
}

func revisar(e Equipo) (bool, *float64) {
	ip := strings.TrimSpace(e.IP)
	if ip == "" {
		return false, nil
	}
	if e.Puerto > 0 {
		t0 := time.Now()
		if abierto := tcp(ip, e.Puerto, 3*time.Second); abierto {
			ms := float64(time.Since(t0).Milliseconds())
			return true, &ms
		}
		return false, nil
	}
	if ok, ms := ping1(ip); ok {
		return true, ms
	}
	res := make(chan bool, 4)
	for _, p := range []int{80, 443, 554, 8000} {
		go func(p int) { res <- tcp(ip, p, 2*time.Second) }(p)
	}
	for range 4 {
		if <-res {
			return true, nil
		}
	}
	return false, nil
}

// solo cuenta un puerto que atiende: un rechazo lo puede mandar un firewall del medio aunque el equipo esté apagado
func tcp(ip string, p int, t time.Duration) bool {
	c, err := net.DialTimeout("tcp", net.JoinHostPort(ip, fmt.Sprint(p)), t)
	if err == nil {
		c.Close()
	}
	return err == nil
}

var reMS = regexp.MustCompile(`(?i)(?:time|tiempo)[=<]\s*([\d.,]+)\s*ms`)

func ping1(ip string) (bool, *float64) {
	c := cmdOculto("ping", argsPing(ip)...)
	t0 := time.Now()
	ch := make(chan []byte, 1)
	go func() { b, _ := c.Output(); ch <- b }()
	var out []byte
	select {
	case out = <-ch:
	case <-time.After(4 * time.Second):
		if c.Process != nil {
			c.Process.Kill()
		}
		return false, nil
	}
	if !strings.Contains(strings.ToUpper(string(out)), "TTL=") {
		return false, nil
	}
	ms := float64(time.Since(t0).Milliseconds())
	if m := reMS.FindSubmatch(out); m != nil {
		fmt.Sscanf(strings.Replace(string(m[1]), ",", ".", 1), "%g", &ms)
	}
	return true, &ms
}

func nombreHost() string { h, _ := os.Hostname(); return h }

func ipLocal() string { // la IP con la que sale hacia afuera (no manda nada)
	c, err := net.Dial("udp", "1.1.1.1:53")
	if err != nil {
		return ""
	}
	defer c.Close()
	return c.LocalAddr().(*net.UDPAddr).IP.String()
}

func hostDe(u string) string {
	u = strings.TrimPrefix(strings.TrimPrefix(u, "https://"), "http://")
	if i := strings.IndexByte(u, '/'); i > 0 {
		return u[:i]
	}
	return u
}
