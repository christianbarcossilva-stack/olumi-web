package main

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Mac: system_profiler (da señal y ruido en dBm; desde macOS 14 no muestra la MAC de los otros equipos)
func leerWifi() *Lectura {
	if l := wifiNativo(); l != nil { // la app de Mac lo lee con CoreWLAN
		return l
	}
	out, _ := salida(cmdOculto("system_profiler", "SPAirPortDataType", "-json"), 25*time.Second)
	var d map[string][]struct {
		Ifs []struct {
			Act   map[string]any   `json:"spairport_current_network_information"`
			Otras []map[string]any `json:"spairport_airport_other_local_wireless_networks"`
		} `json:"spairport_airport_interfaces"`
	}
	if json.Unmarshal([]byte(out), &d) != nil {
		return nil
	}
	reN, reC := regexp.MustCompile(`-?\d+`), regexp.MustCompile(`^(\d+)`)
	uno := func(x map[string]any) RedWifi {
		r := RedWifi{RSSI: -200}
		r.SSID, _ = x["_name"].(string)
		r.BSSID, _ = x["spairport_network_bssid"].(string)
		sn, _ := x["spairport_signal_noise"].(string)
		if n := reN.FindAllString(sn, 2); len(n) > 0 {
			r.RSSI, _ = strconv.Atoi(n[0])
			if len(n) > 1 {
				r.Ruido, _ = strconv.Atoi(n[1])
			}
		}
		ch, _ := x["spairport_network_channel"].(string)
		if m := reC.FindStringSubmatch(ch); m != nil {
			r.Canal, _ = strconv.Atoi(m[1])
		}
		switch {
		case strings.Contains(ch, "6GHz"):
			r.Banda = "6"
		case strings.Contains(ch, "5GHz"):
			r.Banda = "5"
		case strings.Contains(ch, "2GHz"):
			r.Banda = "2.4"
		default:
			r.Banda = bandaDe(0, r.Canal)
		}
		return r
	}
	l := &Lectura{Fuente: "Mac", Exacto: true, Redes: []RedWifi{}}
	for _, it := range d["SPAirPortDataType"] {
		for _, i := range it.Ifs {
			if i.Act != nil {
				a := uno(i.Act)
				l.Actual = &a
				l.Redes = append(l.Redes, a)
			}
			for _, o := range i.Otras {
				if r := uno(o); r.RSSI > -200 {
					l.Redes = append(l.Redes, r)
				}
			}
		}
	}
	return l
}
