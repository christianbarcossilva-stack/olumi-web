package main

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

func leerWifi() *Lectura {
	out, _ := salida(cmdOculto("nmcli", "-t", "-f", "IN-USE,SSID,BSSID,SIGNAL,CHAN,FREQ", "dev", "wifi", "list", "--rescan", "auto"), 10*time.Second)
	l := &Lectura{Fuente: "Linux (nmcli)", Exacto: false, Redes: []RedWifi{}}
	sep := regexp.MustCompile(`(^|[^\\]):`)
	for _, ln := range strings.Split(out, "\n") {
		ln = sep.ReplaceAllString(ln, "$1\x00")
		p := strings.Split(strings.ReplaceAll(ln, `\:`, ":"), "\x00")
		if len(p) < 6 {
			continue
		}
		s, _ := strconv.Atoi(p[3])
		c, _ := strconv.Atoi(p[4])
		mhz, _ := strconv.Atoi(regexp.MustCompile(`\D`).ReplaceAllString(p[5], ""))
		r := RedWifi{SSID: p[1], BSSID: strings.ToUpper(p[2]), RSSI: s/2 - 100, Canal: c, Banda: bandaDe(mhz, c)}
		l.Redes = append(l.Redes, r)
		if p[0] == "*" {
			a := r
			l.Actual = &a
		}
	}
	return l
}
