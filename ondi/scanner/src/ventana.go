package main

// Modo ventana: lo usa la app de Mac (Ondi Scanner.app), que muestra la pantalla en su propia ventana
// y arranca este motor como proceso hijo. Se hablan por líneas de texto:
//   motor → app: «URL http://127.0.0.1:47800/» al arrancar, «WIFI» cuando necesita una lectura del wifi
//   app → motor: «WIFI {json}» con la lectura (CoreWLAN, más rápida y exacta que system_profiler)
// Si la app se cierra, se cierra la entrada estándar y el motor se va con ella.

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

var (
	ventana   = len(os.Args) > 1 && os.Args[1] == "--ventana"
	salidaMu  sync.Mutex
	wifiMu    sync.Mutex
	wifiResp  = make(chan *Lectura, 1)
	sinNativo bool // la app no contestó: se usa system_profiler
)

func avisarApp(s string) {
	salidaMu.Lock()
	fmt.Fprintln(os.Stdout, s)
	salidaMu.Unlock()
}

// lee lo que manda la app; cuando la app se cierra (fin de la entrada) el motor también se cierra
func escucharApp() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<22)
	for sc.Scan() {
		t := sc.Text()
		if strings.HasPrefix(t, "WIFI ") {
			var l Lectura
			if json.Unmarshal([]byte(t[5:]), &l) == nil {
				select {
				case wifiResp <- &l:
				default:
				}
			}
		}
	}
	os.Exit(0)
}

// le pide la lectura del wifi a la app; nil si no está en modo ventana o no contesta
func wifiNativo() *Lectura {
	if !ventana || sinNativo {
		return nil
	}
	wifiMu.Lock()
	defer wifiMu.Unlock()
	select { // descarta una respuesta vieja
	case <-wifiResp:
	default:
	}
	avisarApp("WIFI")
	select {
	case l := <-wifiResp:
		return l
	case <-time.After(12 * time.Second):
		sinNativo = true
		return nil
	}
}
