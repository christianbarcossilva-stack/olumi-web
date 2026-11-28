package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unicode/utf16"
)

const tarea = "Ondi Integrador"

func cmdOculto(n string, a ...string) *exec.Cmd {
	c := exec.Command(n, a...)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return c
}
func argsPing(ip string) []string { return []string{"-n", "1", "-w", "1500", ip} }

func soNombre() string {
	out, _ := cmdOculto("cmd", "/c", "ver").Output()
	if s := strings.TrimSpace(string(out)); s != "" {
		return s
	}
	return "Windows"
}

func esAdmin() bool {
	f, err := os.Open(`\\.\PHYSICALDRIVE0`)
	if err == nil {
		f.Close()
	}
	return err == nil
}

func dirDatos() string {
	d := os.Getenv("ONDI_DATOS")
	if d == "" {
		d = filepath.Join(os.Getenv("ProgramData"), "Ondi Integrador")
	}
	os.MkdirAll(d, 0o750)
	return d
}

func instalado() bool { return cmdOculto("schtasks", "/Query", "/TN", tarea).Run() == nil }

// tarea del sistema (cuenta SYSTEM): arranca con Windows, se revisa cada 5 minutos que siga viva y no tiene tope de tiempo
func instalar() error {
	if !esAdmin() {
		return errors.New("hay que abrirlo como administrador")
	}
	yo, _ := os.Executable()
	dir := filepath.Join(os.Getenv("ProgramFiles"), "Ondi Integrador")
	dst := filepath.Join(dir, "ondi-integrador.exe")
	if !strings.EqualFold(yo, dst) {
		os.MkdirAll(dir, 0o755)
		cmdOculto("schtasks", "/End", "/TN", tarea).Run()
		b, err := os.ReadFile(yo)
		if err != nil {
			return err
		}
		if err := os.WriteFile(dst, b, 0o755); err != nil {
			return errors.New("no pude copiarlo a " + dir + ": " + err.Error())
		}
	}
	x := `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
<RegistrationInfo><Description>Ondi Integrador (Unity Tech): revisa los equipos y reporta a Ondi por HTTPS.</Description></RegistrationInfo>
<Triggers><BootTrigger><Enabled>true</Enabled></BootTrigger><TimeTrigger><StartBoundary>2026-01-01T00:00:00</StartBoundary><Enabled>true</Enabled><Repetition><Interval>PT5M</Interval></Repetition></TimeTrigger></Triggers>
<Principals><Principal id="A"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
<Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure><Enabled>true</Enabled></Settings>
<Actions Context="A"><Exec><Command>` + dst + `</Command><Arguments>correr</Arguments></Exec></Actions>
</Task>`
	u := utf16.Encode([]rune(x))
	b := []byte{0xFF, 0xFE}
	for _, c := range u {
		b = append(b, byte(c), byte(c>>8))
	}
	f := filepath.Join(dirDatos(), "tarea.xml")
	if err := os.WriteFile(f, b, 0o600); err != nil {
		return err
	}
	defer os.Remove(f)
	if out, err := cmdOculto("schtasks", "/Create", "/TN", tarea, "/XML", f, "/F").CombinedOutput(); err != nil {
		return errors.New(strings.TrimSpace(string(out)))
	}
	cmdOculto("schtasks", "/Run", "/TN", tarea).Run()
	return nil
}

func desinstalar() error {
	if !esAdmin() {
		return errors.New("hay que abrirlo como administrador")
	}
	cmdOculto("schtasks", "/End", "/TN", tarea).Run()
	if out, err := cmdOculto("schtasks", "/Delete", "/TN", tarea, "/F").CombinedOutput(); err != nil {
		return errors.New(strings.TrimSpace(string(out)))
	}
	return nil
}
