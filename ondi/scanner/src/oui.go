package main

import (
	"bufio"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// fabricante por los primeros 3 bytes de la MAC: una lista chica adentro y la oficial de la IEEE, que se baja una vez
var (
	ouiMu sync.RWMutex
	OUI   = map[string]string{}
)

func init() {
	for n, l := range map[string]string{
		"Hikvision":    "4419B6 C056E3 BCAD28 4CBD8F 2857BE 540C4D 8CE748 A41437 E0BAAD 849A40 B4A382 18684A 24480F 5850ED",
		"Dahua":        "3CEF8C 9002A9 E0508B 4C11BF 14A78B BC325F 3CE36B 6C1C71 A0BD1D 38AF29",
		"Ubiquiti":     "24A43C 44D9E7 687251 788A20 802AA8 F09FC2 FCECDA 7483C2 E063DA 18E829 B4FBE4 602232 70A741 D8B370 9C05D6 0CEA14 245A4C 784558 AC8BA9 D021F9",
		"MikroTik":     "4C5E0C 64D154 6C3B6B B869F4 CC2DE0 D4CA6D E48D8C 488F5A 2CC81B 18FD74 DC2C6E 085531 744D28 C4AD34",
		"TP-Link":      "50C7BF 60E327 98DAC4 B04E26 C006C3 E848B8 30B5C2 54AF97 3C846A 5C628B A842A1 1027F5 F4F26D 14EBB6",
		"Raspberry Pi": "B827EB DCA632 E45F01 D83ADD 2CCF67",
		"Espressif":    "240AC4 30AEA4 84F3EB A4CF12 BCDDC2 2CF432 DC4F22 C82B96 600194 ECFABC 483FDA",
	} {
		for _, x := range strings.Fields(l) {
			OUI[x] = n
		}
	}
}

var reOUI = regexp.MustCompile(`^([0-9A-F]{6})\s+\(base 16\)\s+(.+)$`)

func cargarOUI() {
	f := filepath.Join(dirConf(), "oui.txt")
	st, err := os.Stat(f)
	if err != nil || st.Size() < 100000 || time.Since(st.ModTime()) > 120*24*time.Hour {
		cli := &http.Client{Timeout: 40 * time.Second}
		q, _ := http.NewRequest("GET", "https://standards-oui.ieee.org/oui/oui.txt", nil)
		q.Header.Set("User-Agent", "Mozilla/5.0 OndiScanner/"+VERSION)
		if r, err := cli.Do(q); err == nil {
			if r.StatusCode == 200 {
				if tmp, err := os.Create(f + ".tmp"); err == nil {
					_, e2 := tmp.ReadFrom(r.Body)
					tmp.Close()
					if e2 == nil {
						os.Rename(f+".tmp", f)
					}
				}
			}
			r.Body.Close()
		}
	}
	fh, err := os.Open(f)
	if err != nil {
		return
	}
	defer fh.Close()
	sc := bufio.NewScanner(fh)
	nuevos := map[string]string{}
	for sc.Scan() {
		if m := reOUI.FindStringSubmatch(strings.TrimSpace(sc.Text())); m != nil {
			nuevos[m[1]] = strings.TrimSpace(m[2])
		}
	}
	ouiMu.Lock()
	for k, v := range nuevos {
		if _, ya := OUI[k]; !ya {
			OUI[k] = v
		}
	}
	ouiMu.Unlock()
}

func fabricante(mac string) string {
	h := strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
	if len(h) < 6 {
		return ""
	}
	if strings.ContainsRune("26AE", rune(h[1])) {
		return "MAC privada (celular o compu)"
	}
	ouiMu.RLock()
	defer ouiMu.RUnlock()
	return OUI[h[:6]]
}
