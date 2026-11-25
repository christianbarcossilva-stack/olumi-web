// Arma el .syso con el ícono, el manifiesto y los datos de versión de Ondi Scanner para Windows.
// Uso: go run ./armar/rsrc ondi.ico 1.0.0 salida.syso
package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"strings"
	"unicode/utf16"
)

const manifiesto = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity type="win32" name="UnityTech.OndiScanner" version="%s.0" processorArchitecture="*"/>
  <description>Ondi Scanner</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1"><application><supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/></application></compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings><dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware><dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness></windowsSettings></application>
</assembly>`

type recurso struct {
	tipo, id uint32
	datos    []byte
}

func u16(s string) []byte {
	b := &bytes.Buffer{}
	for _, r := range utf16.Encode([]rune(s)) {
		binary.Write(b, binary.LittleEndian, r)
	}
	b.Write([]byte{0, 0})
	return b.Bytes()
}

func alinear(b *bytes.Buffer, n int) {
	for b.Len()%n != 0 {
		b.WriteByte(0)
	}
}

// un nodo de VS_VERSIONINFO: largo, largo del valor, tipo, clave, valor e hijos, todo alineado a 4
func nodo(clave string, valor []byte, texto bool, hijos ...[]byte) []byte {
	b := &bytes.Buffer{}
	binary.Write(b, binary.LittleEndian, uint16(0))
	vl := len(valor)
	if texto {
		vl = len(valor) / 2
	}
	binary.Write(b, binary.LittleEndian, uint16(vl))
	t := uint16(0)
	if texto {
		t = 1
	}
	binary.Write(b, binary.LittleEndian, t)
	b.Write(u16(clave))
	alinear(b, 4)
	b.Write(valor)
	for _, h := range hijos {
		alinear(b, 4)
		b.Write(h)
	}
	out := b.Bytes()
	binary.LittleEndian.PutUint16(out[0:], uint16(len(out)))
	return out
}

func version(v string) []byte {
	var n [4]uint16
	for i, p := range strings.Split(v, ".") {
		if i < 4 {
			fmt.Sscanf(p, "%d", &n[i])
		}
	}
	fixed := &bytes.Buffer{}
	for _, x := range []uint32{0xFEEF04BD, 0x00010000, uint32(n[0])<<16 | uint32(n[1]), uint32(n[2])<<16 | uint32(n[3]), uint32(n[0])<<16 | uint32(n[1]), uint32(n[2])<<16 | uint32(n[3]), 0x3F, 0, 0x40004, 1, 0, 0, 0} {
		binary.Write(fixed, binary.LittleEndian, x)
	}
	str := func(k, v string) []byte { return nodo(k, u16(v), true) }
	tabla := nodo("0C0A04B0", nil, true, // español, Unicode
		str("CompanyName", "Unity Tech"), str("FileDescription", "Ondi Scanner: escáner de red gratuito de Ondi"), str("FileVersion", v),
		str("InternalName", "OndiScanner"), str("LegalCopyright", "© Unity Tech"), str("OriginalFilename", "OndiScanner.exe"), str("ProductName", "Ondi Scanner"), str("ProductVersion", v))
	sfi := nodo("StringFileInfo", nil, true, tabla)
	tr := &bytes.Buffer{}
	binary.Write(tr, binary.LittleEndian, uint16(0x0C0A))
	binary.Write(tr, binary.LittleEndian, uint16(1200))
	vfi := nodo("VarFileInfo", nil, true, nodo("Translation", tr.Bytes(), false))
	return nodo("VS_VERSION_INFO", fixed.Bytes(), false, sfi, vfi)
}

func main() {
	if len(os.Args) < 4 {
		fmt.Println("uso: rsrc ondi.ico 1.0.0 salida.syso")
		os.Exit(2)
	}
	ico, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	cant := int(binary.LittleEndian.Uint16(ico[4:6]))
	var rs []recurso
	grupo := &bytes.Buffer{}
	binary.Write(grupo, binary.LittleEndian, []uint16{0, 1, uint16(cant)})
	for i := 0; i < cant; i++ {
		e := ico[6+16*i : 6+16*i+16]
		tam, off := binary.LittleEndian.Uint32(e[8:12]), binary.LittleEndian.Uint32(e[12:16])
		rs = append(rs, recurso{3, uint32(i + 1), ico[off : off+tam]})
		grupo.Write(e[0:12])
		binary.Write(grupo, binary.LittleEndian, uint16(i+1))
	}
	rs = append(rs, recurso{14, 1, grupo.Bytes()}, recurso{16, 1, version(os.Args[2])}, recurso{24, 1, []byte(fmt.Sprintf(manifiesto, os.Args[2]))})

	// el árbol de recursos: tipo → número → idioma → datos
	tipos := []uint32{}
	porTipo := map[uint32][]recurso{}
	for _, r := range rs {
		if _, ok := porTipo[r.tipo]; !ok {
			tipos = append(tipos, r.tipo)
		}
		porTipo[r.tipo] = append(porTipo[r.tipo], r)
	}
	dir := func(n int) int { return 16 + 8*n }
	tam := dir(len(tipos))
	offTipo := map[uint32]int{}
	for _, t := range tipos {
		offTipo[t] = tam
		tam += dir(len(porTipo[t]))
	}
	offLang := map[[2]uint32]int{}
	for _, t := range tipos {
		for _, r := range porTipo[t] {
			offLang[[2]uint32{t, r.id}] = tam
			tam += dir(1)
		}
	}
	offEntrada := map[[2]uint32]int{}
	for _, t := range tipos {
		for _, r := range porTipo[t] {
			offEntrada[[2]uint32{t, r.id}] = tam
			tam += 16
		}
	}
	offDatos := map[[2]uint32]int{}
	for _, t := range tipos {
		for _, r := range porTipo[t] {
			tam = (tam + 7) &^ 7
			offDatos[[2]uint32{t, r.id}] = tam
			tam += len(r.datos)
		}
	}
	sec := make([]byte, (tam+7)&^7)
	pdir := func(off, n int) {
		binary.LittleEndian.PutUint16(sec[off+14:], uint16(n))
	}
	pent := func(off int, id uint32, a int, sub bool) {
		binary.LittleEndian.PutUint32(sec[off:], id)
		v := uint32(a)
		if sub {
			v |= 0x80000000
		}
		binary.LittleEndian.PutUint32(sec[off+4:], v)
	}
	pdir(0, len(tipos))
	relocs := []int{}
	for i, t := range tipos {
		pent(16+8*i, t, offTipo[t], true)
		pdir(offTipo[t], len(porTipo[t]))
		for j, r := range porTipo[t] {
			k := [2]uint32{t, r.id}
			pent(offTipo[t]+16+8*j, r.id, offLang[k], true)
			pdir(offLang[k], 1)
			pent(offLang[k]+16, 0x0C0A, offEntrada[k], false)
			binary.LittleEndian.PutUint32(sec[offEntrada[k]:], uint32(offDatos[k])) // se corrige al enlazar
			binary.LittleEndian.PutUint32(sec[offEntrada[k]+4:], uint32(len(r.datos)))
			relocs = append(relocs, offEntrada[k])
			copy(sec[offDatos[k]:], r.datos)
		}
	}

	// el objeto COFF con una sola sección .rsrc
	o := &bytes.Buffer{}
	const cab, seccion = 20, 40
	pRaw := cab + seccion
	pRel := pRaw + len(sec)
	pSim := pRel + 10*len(relocs)
	binary.Write(o, binary.LittleEndian, struct {
		Maquina, Secciones   uint16
		Fecha, Simbolos, NSim uint32
		Opc, Car             uint16
	}{0x8664, 1, 0, uint32(pSim), 1, 0, 0})
	nombre := [8]byte{'.', 'r', 's', 'r', 'c'}
	binary.Write(o, binary.LittleEndian, struct {
		Nombre                                [8]byte
		VTam, VDir, Tam, PRaw, PRel, PLin     uint32
		NRel, NLin                            uint16
		Car                                   uint32
	}{nombre, 0, 0, uint32(len(sec)), uint32(pRaw), uint32(pRel), 0, uint16(len(relocs)), 0, 0x40000040})
	o.Write(sec)
	for _, r := range relocs {
		binary.Write(o, binary.LittleEndian, uint32(r))
		binary.Write(o, binary.LittleEndian, uint32(0))
		binary.Write(o, binary.LittleEndian, uint16(3)) // IMAGE_REL_AMD64_ADDR32NB
	}
	binary.Write(o, binary.LittleEndian, struct {
		Nombre [8]byte
		Valor  uint32
		Sec    int16
		Tipo   uint16
		Clase  uint8
		Aux    uint8
	}{nombre, 0, 1, 0, 3, 0})
	binary.Write(o, binary.LittleEndian, uint32(4))
	if err := os.WriteFile(os.Args[3], o.Bytes(), 0o644); err != nil {
		panic(err)
	}
	fmt.Printf("%s: %d recursos, %d bytes\n", os.Args[3], len(rs), o.Len())
}
