package main

import (
	"os/exec"
	"syscall"
)

func cmdOculto(n string, a ...string) *exec.Cmd {
	c := exec.Command(n, a...)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return c
}
func argsPing(ip string) []string { return []string{"-n", "1", "-w", "700", ip} }
func decodificar(b []byte) string { return string(b) }
func abrirURL(u string)          { cmdOculto("rundll32", "url.dll,FileProtocolHandler", u).Start() }
func abrirRDP(ip string)          { cmdOculto("mstsc", "/v:"+ip).Start() }
