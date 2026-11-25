//go:build !windows

package main

import (
	"os/exec"
	"runtime"
)

func cmdOculto(n string, a ...string) *exec.Cmd { return exec.Command(n, a...) }
func argsPing(ip string) []string {
	if runtime.GOOS == "darwin" {
		return []string{"-c", "1", "-W", "700", ip}
	}
	return []string{"-c", "1", "-W", "1", ip}
}
func decodificar(b []byte) string { return string(b) }
func abrirURL(u string) {
	if runtime.GOOS == "darwin" {
		exec.Command("open", u).Start()
	} else {
		exec.Command("xdg-open", u).Start()
	}
}
func abrirRDP(ip string) {
	if runtime.GOOS == "darwin" {
		exec.Command("open", "rdp://full%20address=s:"+ip).Start()
	}
}
