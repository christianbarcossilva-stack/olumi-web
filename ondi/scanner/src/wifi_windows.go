package main

import (
	"encoding/binary"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

// Windows: la API nativa de wifi (wlanapi.dll). Da cada access point con su señal en dBm reales.
// Desde Windows 11 24H2 hace falta tener activada la ubicación para que devuelva las redes.
var (
	wlan            = syscall.NewLazyDLL("wlanapi.dll")
	pOpen           = wlan.NewProc("WlanOpenHandle")
	pEnum           = wlan.NewProc("WlanEnumInterfaces")
	pScan           = wlan.NewProc("WlanScan")
	pBss            = wlan.NewProc("WlanGetNetworkBssList")
	pQuery          = wlan.NewProc("WlanQueryInterface")
	pFree           = wlan.NewProc("WlanFreeMemory")
	wlanH           uintptr
	wlanOnce        sync.Once
	ultimoEscaneo   time.Time
)

func mem(p uintptr, n int) []byte { return unsafe.Slice((*byte)(unsafe.Pointer(p)), n) }

func leerWifi() *Lectura {
	if l := wifiAPI(); l != nil {
		return l
	}
	return wifiNetsh()
}

func wifiAPI() (l *Lectura) {
	defer func() {
		if recover() != nil {
			l = nil
		}
	}()
	if pOpen.Find() != nil {
		return nil
	}
	wlanOnce.Do(func() {
		var ver uint32
		var h uintptr
		if r, _, _ := pOpen.Call(2, 0, uintptr(unsafe.Pointer(&ver)), uintptr(unsafe.Pointer(&h))); r == 0 {
			wlanH = h
		}
	})
	if wlanH == 0 {
		return nil
	}
	var lista uintptr
	if r, _, _ := pEnum.Call(wlanH, 0, uintptr(unsafe.Pointer(&lista))); r != 0 || lista == 0 {
		return nil
	}
	n := binary.LittleEndian.Uint32(mem(lista, 8)[0:4])
	if n == 0 {
		pFree.Call(lista)
		return nil
	}
	var guid [16]byte
	copy(guid[:], mem(lista+8, 16))
	pFree.Call(lista)
	g := uintptr(unsafe.Pointer(&guid[0]))
	if time.Since(ultimoEscaneo) > 3500*time.Millisecond { // Windows tarda unos 3 segundos en escanear: se pide cada 4
		pScan.Call(wlanH, g, 0, 0, 0)
		ultimoEscaneo = time.Now()
	}
	l = &Lectura{Fuente: "Windows", Exacto: true, Redes: []RedWifi{}}
	var bss uintptr
	r, _, _ := pBss.Call(wlanH, g, 0, 3, 0, 0, uintptr(unsafe.Pointer(&bss)))
	if r == 5 {
		l.Permiso = "ubicacion"
	}
	if r == 0 && bss != 0 {
		cant := int(binary.LittleEndian.Uint32(mem(bss, 8)[4:8]))
		const tam = 360 // WLAN_BSS_ENTRY
		for i := 0; i < cant && i < 512; i++ {
			e := mem(bss+8+uintptr(i*tam), tam)
			sl := int(binary.LittleEndian.Uint32(e[0:4]))
			if sl > 32 {
				sl = 32
			}
			mhz := int(binary.LittleEndian.Uint32(e[92:96])) / 1000
			canal := 0
			switch {
			case mhz > 0 && mhz < 3000:
				canal = (mhz - 2407) / 5
			case mhz >= 5955:
				canal = (mhz - 5950) / 5
			case mhz > 0:
				canal = (mhz - 5000) / 5
			}
			b := e[40:46]
			l.Redes = append(l.Redes, RedWifi{SSID: string(e[4 : 4+sl]), BSSID: strings.ToUpper(hexMAC(b)), RSSI: int(int32(binary.LittleEndian.Uint32(e[56:60]))), Canal: canal, Banda: bandaDe(mhz, canal)})
		}
		pFree.Call(bss)
	}
	// la conexión actual: red, access point y señal al momento
	var sz uint32
	var p uintptr
	if r, _, _ := pQuery.Call(wlanH, g, 7, 0, uintptr(unsafe.Pointer(&sz)), uintptr(unsafe.Pointer(&p)), 0); r == 0 && p != 0 && sz >= 580 {
		c := mem(p, int(sz))
		if binary.LittleEndian.Uint32(c[0:4]) == 1 { // conectado
			sl := int(binary.LittleEndian.Uint32(c[520:524]))
			if sl > 32 {
				sl = 32
			}
			a := &RedWifi{SSID: string(c[524 : 524+sl]), BSSID: strings.ToUpper(hexMAC(c[560:566]))}
			for _, x := range l.Redes {
				if x.BSSID == a.BSSID {
					a.Canal, a.Banda, a.RSSI = x.Canal, x.Banda, x.RSSI
				}
			}
			l.Actual = a
		}
		pFree.Call(p)
	}
	if l.Actual != nil {
		if r, _, _ := pQuery.Call(wlanH, g, 0x10000102, 0, uintptr(unsafe.Pointer(&sz)), uintptr(unsafe.Pointer(&p)), 0); r == 0 && p != 0 {
			l.Actual.RSSI = int(int32(binary.LittleEndian.Uint32(mem(p, 4))))
			pFree.Call(p)
		}
	}
	return l
}

func hexMAC(b []byte) string {
	const h = "0123456789ABCDEF"
	s := make([]byte, 0, 17)
	for i, x := range b {
		if i > 0 {
			s = append(s, ':')
		}
		s = append(s, h[x>>4], h[x&15])
	}
	return string(s)
}

// sin la API: lo que muestra netsh (la señal viene en %, se pasa a dBm como hace Windows)
func wifiNetsh() *Lectura {
	a, _ := salida(cmdOculto("netsh", "wlan", "show", "interfaces"), 5*time.Second)
	out, _ := salida(cmdOculto("netsh", "wlan", "show", "networks", "mode=bssid"), 6*time.Second)
	l := &Lectura{Fuente: "Windows (netsh)", Exacto: false, Redes: []RedWifi{}}
	if strings.Contains(strings.ToLower(out+a), "location") || strings.Contains(strings.ToLower(out+a), "ubicaci") {
		l.Permiso = "ubicacion"
	}
	ssid := ""
	reS, reB := regexp.MustCompile(`^SSID \d+\s*:\s*(.*)$`), regexp.MustCompile(`^BSSID \d+\s*:\s*(\S+)`)
	reSen, reCan := regexp.MustCompile(`(?i)(?:Signal|Se.al)\s*:\s*(\d+)%`), regexp.MustCompile(`(?i)(?:Channel|Canal)\s*:\s*(\d+)`)
	for _, ln := range strings.Split(out, "\n") {
		t := strings.TrimSpace(ln)
		if m := reS.FindStringSubmatch(t); m != nil {
			ssid = strings.TrimSpace(m[1])
			continue
		}
		if m := reB.FindStringSubmatch(t); m != nil {
			l.Redes = append(l.Redes, RedWifi{SSID: ssid, BSSID: strings.ToUpper(strings.ReplaceAll(m[1], "-", ":")), RSSI: -200})
			continue
		}
		if len(l.Redes) == 0 {
			continue
		}
		c := &l.Redes[len(l.Redes)-1]
		if m := reSen.FindStringSubmatch(t); m != nil {
			v, _ := strconv.Atoi(m[1])
			c.RSSI = v/2 - 100
		}
		if m := reCan.FindStringSubmatch(t); m != nil {
			c.Canal, _ = strconv.Atoi(m[1])
			c.Banda = bandaDe(0, c.Canal)
		}
	}
	ok := l.Redes[:0]
	for _, r := range l.Redes {
		if r.RSSI > -200 {
			ok = append(ok, r)
		}
	}
	l.Redes = ok
	act := &RedWifi{}
	if m := regexp.MustCompile(`(?m)^\s*SSID\s*:\s*(.+)$`).FindStringSubmatch(a); m != nil {
		act.SSID = strings.TrimSpace(m[1])
	}
	if m := regexp.MustCompile(`BSSID\s*:\s*(\S+)`).FindStringSubmatch(a); m != nil {
		act.BSSID = strings.ToUpper(strings.ReplaceAll(m[1], "-", ":"))
	}
	if m := reSen.FindStringSubmatch(a); m != nil {
		v, _ := strconv.Atoi(m[1])
		act.RSSI = v/2 - 100
	}
	if m := reCan.FindStringSubmatch(a); m != nil {
		act.Canal, _ = strconv.Atoi(m[1])
		act.Banda = bandaDe(0, act.Canal)
	}
	if act.SSID != "" {
		l.Actual = act
	}
	return l
}
