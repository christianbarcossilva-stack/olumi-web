//go:build !windows

package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
)

var reNombreSO = regexp.MustCompile(`(?m)^PRETTY_NAME="?([^"\n]+)`)

const unidad = "/etc/systemd/system/ondi-integrador.service"

func cmdOculto(n string, a ...string) *exec.Cmd { return exec.Command(n, a...) }
func argsPing(ip string) []string {
	if runtime.GOOS == "darwin" {
		return []string{"-c", "1", "-W", "1500", ip}
	}
	return []string{"-c", "1", "-W", "2", ip}
}
func soNombre() string {
	if b, err := os.ReadFile("/etc/os-release"); err == nil {
		if m := reNombreSO.FindSubmatch(b); m != nil {
			return string(m[1])
		}
	}
	return runtime.GOOS
}
func esAdmin() bool { return os.Geteuid() == 0 }

func dirDatos() string {
	d := os.Getenv("ONDI_DATOS")
	if d == "" {
		if esAdmin() {
			d = "/var/lib/ondi-integrador"
		} else {
			c, _ := os.UserConfigDir()
			d = filepath.Join(c, "ondi-integrador")
		}
	}
	os.MkdirAll(d, 0o750)
	return d
}

func instalado() bool { _, err := os.Stat(unidad); return err == nil }

// systemd: usuario propio sin login, solo con permiso para hacer ping; se reinicia solo
func instalar() error {
	if !esAdmin() {
		return errors.New("hay que correrlo con sudo")
	}
	if _, err := exec.LookPath("systemctl"); err != nil {
		return errors.New("esta máquina no tiene systemd: dejá corriendo «ondi-integrador correr» con lo que use el sistema para servicios")
	}
	yo, _ := os.Executable()
	dst := "/usr/local/bin/ondi-integrador"
	if yo != dst {
		b, err := os.ReadFile(yo)
		if err != nil {
			return err
		}
		if err := os.WriteFile(dst+".nuevo", b, 0o755); err != nil {
			return err
		}
		if err := os.Rename(dst+".nuevo", dst); err != nil {
			return err
		}
	}
	usuario := "ondi-integrador"
	if exec.Command("id", usuario).Run() != nil && exec.Command("useradd", "--system", "--no-create-home", "--shell", "/usr/sbin/nologin", usuario).Run() != nil {
		usuario = "root"
	}
	datos := "/var/lib/ondi-integrador"
	os.MkdirAll(datos, 0o750)
	exec.Command("chown", "-R", usuario+":", datos).Run()
	u := `[Unit]
Description=Ondi Integrador (Unity Tech): revisa los equipos y reporta a Ondi
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=` + dst + ` correr
Environment=ONDI_DATOS=` + datos + `
User=` + usuario + `
AmbientCapabilities=CAP_NET_RAW
CapabilityBoundingSet=CAP_NET_RAW
ProtectSystem=strict
ReadWritePaths=` + datos + `
ProtectHome=yes
PrivateTmp=yes
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
`
	if err := os.WriteFile(unidad, []byte(u), 0o644); err != nil {
		return err
	}
	for _, a := range [][]string{{"daemon-reload"}, {"enable", "--now", "ondi-integrador"}, {"restart", "ondi-integrador"}} {
		if out, err := exec.Command("systemctl", a...).CombinedOutput(); err != nil {
			return errors.New(string(out))
		}
	}
	return nil
}

func desinstalar() error {
	if !esAdmin() {
		return errors.New("hay que correrlo con sudo")
	}
	exec.Command("systemctl", "disable", "--now", "ondi-integrador").Run()
	os.Remove(unidad)
	exec.Command("systemctl", "daemon-reload").Run()
	return nil
}
