# Kliva · web v7 (una semana en la planta)

Christian, 26/11 08:12: «hay que actualizar la web como la de olumi».

La web de Kliva con la misma idea que la nueva de Olumi, sobre el motor común. **El punto violeta del logo es una persona que entra a trabajar**: Lucía
llega a la planta, deja su línea pintada en el piso de la vereda a su puesto y las puertas le abren (portería, molinete, vestuario). La cámara viaja de
escena en escena con el scroll, la hora del día funde de una a otra y abajo va el riel de la semana. En la compu, al costado, **la app real** (la beta, en
un teléfono) muestra lo mismo que pasa en la planta: es la misma historia que ya contaba la web anterior, capítulo por capítulo, con los mismos textos.

**Es la página pública desde el 26/11** (`unitytech.uy/kliva/`): Christian la vio en la vista previa y dio el OK («ya podés pasar todo a la página oficial»).
`/nuevo/kliva/` quedó redirigiendo a la pública.

## Piezas

| Archivo | Qué es |
| --- | --- |
| `historia.html` | La historia: la maqueta, las chapitas de los equipos, la chapita de lo que pasa, el teléfono con la app, los siete capítulos y el riel |
| `v7.css` | Los estilos de la historia (reemplazan a los de la historia vieja) y lo que aterriza en el resto de la página |
| `v7.js` | El guion: cámara, camino de Lucía, puertas, camión, horas, chapitas, riel, teléfono |
| `escena.mjs` | Escribe la planta: `motor/escenas/kliva-web-v7.json` (edificio de 30 × 15 m con sus puertas con control de acceso) |
| `construir.mjs` | Arma la página a partir de la pública (v6) y de estas piezas |
| `base-v6.html` | Copia de la página pública del 26/11 (la v6). Se usa de base cuando la pública ya sea la v7 |
| `prueba/` | `web.mjs` (recorre y saca fotos), `tanda.sh` (todas las plataformas), `resto.mjs` (sin 3D, secciones, reducir movimiento), `toma.mjs` (probar tomas de cámara), `foto.mjs` (las fotos de respaldo) |

Todo lo que no es la historia (marcas, familia, datos, preguntas, cierre, pie) sale de `base-v6.html` tal cual: un cambio de texto de esas secciones se
hace ahí y se vuelve a armar. **`kliva/index.html` no se edita a mano**: es el resultado de armar.

## Armar

```
node escena.mjs                                      # solo si cambió la planta
node construir.mjs ../../../kliva/index.html                # la pública
node construir.mjs /tmp/k7-sitio/nuevo/kliva/index.html previa   # una vista previa para probar un cambio antes (con SITIO=/tmp/k7-sitio en las pruebas)
```

Después de armar la pública, copiar el resultado a `web/sitio/index.html` del repositorio de Kliva (su armado lo copia a `dist/sitio/`): las dos copias
tienen que ser iguales.

## Cómo está hecha

- **La maqueta** es el motor común en modo Kliva (`/motor/beta/index.html?app=kliva&escena=kliva-web-v7&nuevo=1&ver=1&embebida=1`), el mismo plano 3D que
  trae la app. La página le esconde la barra, le corta las paredes a media altura (`paredes('corte')`) y maneja la cámara (`motor.C`), las horas
  (`ponerHora`) y las puertas (`__maqueta.vivo({ puerta, estado, ev })`, lo mismo que usa la app para mostrar las pasadas en vivo).
- **Las puertas** de la escena: `acc_port` Portería peatonal, `acc_min` y `acc_mout` los molinetes, `acc_ves` Vestuarios, `acc_adm` Administración,
  `acc_dep` Depósito de repuestos, `acc_gate` Portón 2 (el del cerco) y `acc_carga` Portón 1 (la playa de carga). En el guion, `debe(p)` dice cómo tiene que
  estar cada una según la escena; `PASOS` son las que Lucía cruza.
- **El camino** (`ENT` de entrada y `SAL` de salida, en metros) es una cinta violeta que se dibuja con el scroll; `RUTA` dice cuánto va dibujado al llegar a
  cada capítulo. **El camión** del capítulo del portón (`CMN`) lo arma la página con el motor (en modo Kliva el motor no dibuja la capa de logística).
- **Las tomas**: `TOMA[i] = [x, z, giro, inclinación, distancia, corrimiento]`, una por capítulo; `ANG` son los cambios para pantalla angosta. Para probar
  una toma sin tocar el guion: `node prueba/toma.mjs 1440 900 "4:18.5,16.5,.52,.8,36,.06"`.
- **El teléfono** carga `/kliva/beta/?cine=1` y le pide cada escena con `postMessage({ kliva: 'cine', ev, tema })`: los capítulos se llaman igual que en
  la app (`inicio, alta, pasa, rechazo, abre, cae, baja`). Por eso lo que dice la chapita de la maqueta coincide con lo que muestra la app (Lucía Fernández,
  Vestuarios 7:52, tarjeta no registrada en el Molinete de entrada 9:15, Portón 2 a las 11:03, la Controladora de portones a las 14:20). Si cambia la
  historia de la app (`03-demo.js`, `STORY`), hay que cambiar acá los textos de `chipDe()`.
- **Pantallas**: desde 1100 px de ancho va el teléfono; entre 861 y 1099, la maqueta a pantalla completa sin teléfono; hasta 860 (teléfono y tablet de
  pie), la maqueta es una ventana arriba y la historia pasa por debajo.
- **Sin maqueta** (teléfono con poca memoria, navegador sin 3D o no cargó en 14 s) queda una foto de la planta: `kliva/img/planta-noche.webp`,
  `planta-dia.webp` y sus «-m». Se vuelven a sacar con `node prueba/foto.mjs ../../../kliva/img` si cambia la planta.
- **Con «reducir movimiento»** nada se anima: la cámara salta, el camión aparece estacionado y las chapitas no entran con retraso.

## Lo que se cuida

- Solo lo que ya corre: las chapitas del alta nombran marcas que hoy reciben personas (Control iD, Hikvision, Intelbras, Dahua y los relojes ZKTeco). Las
  controladoras ZKTeco todavía no reciben personas: en la planta no llevan tilde de alta.
- Los datos son inventados (Planta Ruta 5, Lucía Fernández y los nombres de la demostración). Nunca un cliente real.
- El cartel amarillo de arriba («Kliva está en beta: todavía no tiene instalaciones con equipos reales») se sacó el 26/11 por pedido de Christian
  («eso no vende»), de la pública y de la vista previa. No volver a ponerlo. El estado real sigue dicho en la letra chica de Marcas («Estado de hoy»).

## Probar

```
cd prueba && ./tanda.sh        # deja capturas en /tmp/k7-<plataforma>/ y el registro en /tmp/k7-tanda.log
```

Con `SITIO=/carpeta` se pone por delante una copia de trabajo (la página recién armada, la escena o una beta sin publicar). Después de la tanda hay que
mirar las capturas: la tanda no decide sola si se ve bien.
