// Ondi Integrador (Unity Tech): corre en una máquina virtual del cliente, revisa los equipos que la instaladora
// cargó en Ondi (ping o puerto) y reporta su estado. Solo sale por HTTPS (443) hacia Ondi: no abre puertos,
// no recibe órdenes y no guarda contraseñas. La configuración vive en Ondi; acá queda solo el token de enlace.
//
//	ondi-integrador                 primera vez: pide el código, se enlaza, se instala y arranca
//	ondi-integrador enlazar CODIGO  se enlaza con el código que da Ondi (Cliente → Integraciones)
//	ondi-integrador instalar        queda corriendo siempre (Windows: tarea del sistema · Linux: systemd)
//	ondi-integrador desinstalar     lo saca del arranque (el enlace queda, se da de baja desde Ondi)
//	ondi-integrador estado          enlace, último reporte y reportes guardados sin internet
//	ondi-integrador correr          lo que corre el servicio
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

const VERSION = "1.0.0"

func main() {
	arg := func(i int) string {
		if len(os.Args) > i {
			return os.Args[i]
		}
		return ""
	}
	var err error
	switch strings.TrimLeft(arg(1), "-") {
	case "correr":
		correr()
	case "enlazar":
		err = enlazar(arg(2))
	case "instalar":
		err = instalar()
	case "desinstalar":
		err = desinstalar()
	case "estado":
		estado()
	case "version":
		fmt.Println("Ondi Integrador", VERSION)
	case "":
		err = guiado()
	default:
		fmt.Println("Comandos: enlazar CODIGO · instalar · desinstalar · estado · version")
		os.Exit(2)
	}
	if err != nil {
		fmt.Println("No se pudo:", err)
		if arg(1) == "" {
			esperarEnter()
		}
		os.Exit(1)
	}
}

// doble clic: pide el código, se enlaza, se instala y arranca
func guiado() error {
	fmt.Printf("Ondi Integrador %s · Unity Tech\n\n", VERSION)
	if c := leerConf(); c.Token != "" {
		fmt.Printf("Ya está enlazado con %s.\n\n", c.Cliente)
		estado()
		esperarEnter()
		return nil
	}
	if !esAdmin() {
		return fmt.Errorf("hay que abrirlo como administrador (Windows: clic derecho → Ejecutar como administrador · Linux: sudo)")
	}
	fmt.Print("Código de Ondi (Cliente → Integraciones → Conectar el integrador): ")
	cod, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	if err := enlazar(cod); err != nil {
		return err
	}
	if err := instalar(); err != nil {
		return err
	}
	fmt.Println("\nListo: queda revisando los equipos y reporta a Ondi cada minuto. Se puede cerrar esta ventana.")
	esperarEnter()
	return nil
}

func esperarEnter() {
	fmt.Print("\nTocá Enter para cerrar.")
	bufio.NewReader(os.Stdin).ReadString('\n')
}
