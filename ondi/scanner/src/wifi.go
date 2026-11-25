package main

import (
	"sync"
	"time"
)

type RedWifi struct {
	SSID  string `json:"ssid"`
	BSSID string `json:"bssid"`
	RSSI  int    `json:"rssi"`
	Canal int    `json:"canal"`
	Banda string `json:"banda"`
	Ruido int    `json:"ruido,omitempty"`
}
type Lectura struct {
	Fuente  string    `json:"fuente"`
	Exacto  bool      `json:"exacto"`
	Actual  *RedWifi  `json:"actual"`
	Redes   []RedWifi `json:"redes"`
	Seq     int64     `json:"seq"`
	T       float64   `json:"t"`
	V       string    `json:"v"`
	Permiso string    `json:"permiso,omitempty"`
}

func bandaDe(mhz, canal int) string {
	switch {
	case mhz > 0 && mhz < 3000:
		return "2.4"
	case mhz >= 5925:
		return "6"
	case mhz > 0:
		return "5"
	case canal > 0 && canal <= 14:
		return "2.4"
	case canal > 0:
		return "5"
	}
	return ""
}

// mientras Ondi web pide la señal (caminando el lugar) se lee el wifi sin parar y se guarda la última lectura
type Muestreo struct {
	mu     sync.Mutex
	ult    *Lectura
	seq    int64
	pedido time.Time
	activo bool
}

var muestreo = &Muestreo{}

func (m *Muestreo) leer() *Lectura {
	m.mu.Lock()
	m.pedido = time.Now()
	if !m.activo {
		m.activo = true
		go m.bucle()
	}
	m.mu.Unlock()
	for t0 := time.Now(); time.Since(t0) < 30*time.Second; time.Sleep(150 * time.Millisecond) {
		m.mu.Lock()
		u := m.ult
		m.mu.Unlock()
		if u != nil {
			return u
		}
	}
	return &Lectura{Redes: []RedWifi{}}
}

func (m *Muestreo) bucle() {
	for {
		m.mu.Lock()
		if time.Since(m.pedido) > 45*time.Second {
			m.activo = false
			m.mu.Unlock()
			return
		}
		m.mu.Unlock()
		t0 := time.Now()
		l := leerWifi()
		if l != nil {
			m.mu.Lock()
			m.seq++
			l.Seq, l.T, l.V = m.seq, float64(time.Now().UnixMilli())/1000, VERSION
			if l.Redes == nil {
				l.Redes = []RedWifi{}
			}
			m.ult = l
			m.mu.Unlock()
		}
		if d := time.Second - time.Since(t0); d > 0 {
			time.Sleep(d)
		}
	}
}
