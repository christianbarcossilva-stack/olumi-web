# Web de Ondi v7 · el camino de una alerta

Pedido de Christian del 26/11 (08:12): «hay que actualizar la web como la de olumi». El modelo es la v7 de Olumi (`servidor/web/olumi-v7/`).

Esta carpeta tiene las fuentes de la página, cómo se arma y cómo se prueba. `servidor/` no se publica.

## La historia
Corre sobre el motor común (`/motor/beta/`) con la escena `motor/escenas/ondi-web.json`: **Parque Logístico Norte**, un parque **inventado**. Por privacidad no puede ser ningún cliente real.

| Escena | Hora | Qué pasa |
|---|---|---|
| 0 | — | Portada, de noche. |
| 1 | — | El parque entero con tres chapitas: Galpón N1, Sala técnica y Portería. |
| 2 | 03:07 | Se cae el AP-13 (rojo en la maqueta) y llegan los avisos al teléfono. |
| 3 | 03:08 | La línea roja recorre el cable desde el AP hasta el switch del rack N1. Se pone rojo el rack, y lo que cuelga queda gris («sin acceso»): AP-14, C-07 y C-08. |
| 4 | 07:40 | Amanece. El furgón de la instaladora viene por la ruta, pasa la barrera y estaciona frente a la sala técnica, con la línea azul detrás. |
| 5 | 08:15 | El técnico aparece en el rack. Al lado, la cámara C-07. |
| 6 | 08:32 | Todo vuelve a verde, incluida la línea del cable. |

La chapita (`.tk3`) cuenta por dónde va la noche:

| Estado | Color |
|---|---|
| AP-13 sin señal | rojo |
| SW-N1, la causa | rojo |
| T-0143 Martín lo tomó | azul |
| En camino | azul |
| Entró al parque | azul |
| En la sala técnica | azul |
| Resuelto | verde |

Abajo va el riel de la noche (03:07 · 03:08 · 07:40 · 08:15 · 08:32). El resto de la página aterriza de a uno, y el cierre dibuja el logo hilo por hilo.

Con «reducir movimiento» nada se anima. Sin maqueta (teléfono con poca memoria, o si a los 14 s no cargó) queda una foto: `ondi/img/parque-{noche,dia}{,-m}.webp`, que se saca con `prueba/fotos.js`.

## Piezas
- `escena.py`: arma `motor/escenas/ondi-web.json`. Es una escena nueva y solo de esta página; no cambia nada del motor.
- `historia.html`: la historia (portada y 6 escenas) y el riel `nav.dia`. La portada conserva el rack 3D de la web anterior (`rack3d.js`, con el globo y el reloj).
- `cierre.html`: el cierre «Tus clientes, en Ondi. Desde hoy.».
- `v7.css`: todo lo nuevo de estilo. Va al final del `<style>` de la página y usa los colores de Ondi: `--et`, `--ti`, `--az`, `--ro`, `--ve`.
- `v7.js`: el guion de la historia. Al guion de siempre se le saca lo de la maqueta vieja (`/ondi/maqueta/`); el tema, las marcas, la traza y el rack que se toca siguen ahí.
- `base-v6.html`: copia de la página pública del 26/11, para cuando la v7 ya sea la pública.
- `construir.py SALIDA [previa]`: arma la página. Antes revisa `v7.js` con `node --check`.

## Armar
```
python3 servidor/web/ondi-v7/escena.py                                   # la escena del parque (si se cambia)
python3 servidor/web/ondi-v7/construir.py nuevo/ondi/index.html previa   # la vista previa
python3 servidor/web/ondi-v7/construir.py ondi/index.html                # la pública (solo con el OK de Christian)
```
Al pasarla a pública, `nuevo/ondi/index.html` vuelve a ser la redirección a `/ondi/`.

## El guion (`v7.js`)
- **`TOMA`**: una toma por escena, `[centro x, centro z, giro, inclinación, distancia, corrimiento]`.
  - La cámara queda en `centro + distancia·cos(incl)·(sin giro, cos giro)`; con giro 0 mira hacia −z.
  - `ANG` aleja las vistas enteras en pantalla angosta.
- **Las dos líneas**:
  - `CABLE` es la línea del aviso, del AP-13 al rack. `cableDe(S)` dice cuánto va dibujado.
  - `RUTA` es el viaje del furgón. `vanDe(S)` dice cuánto va dibujado.
  - Las arma `cinta()`. Igual que en Olumi, los números se arman con `T.Float32BufferAttribute` del motor y llevan `polygonOffset` −20/−18.
- **El furgón** (`van`) va a la punta de su línea (`ponVan`, cada cuadro). El técnico (`tec`) aparece en la sala técnica cuando el furgón llega.
- **`equipos()`** pone el estado de las piezas (`ok`, `crit`, `off`) y las rearma con `MQ.rehacerId`, solo cuando cambia el tramo de la historia.
- **La hora** sale de `data-hora`, o de `data-hora-dia` con la página en modo día. Si el visitante cambia día o noche, la maqueta cambia con él (con un `MutationObserver` sobre `data-tema`).
- **El scroll, el teléfono y la cámara** se resuelven igual que en la v7 de Olumi; ver su `LEEME.md`. El corte en el teléfono está en 900 px, el mismo de la web de Ondi.

## Probar
```
cd servidor/web/ondi-v7/prueba
OUT=/tmp/x W=1440 H=900 node web.js     # recorre la historia y saca una captura por escena (DEV='iPhone 13', TEMA=dia, QUIETO=1)
./tanda.sh                              # compu, compu chica, iPad, iPhone y Android; claro y oscuro; sin movimiento
node mirar.js /tmp/x "tx,tz,yaw,pitch,d;…" [hora]   # mira la escena sola desde varias tomas (para ajustar)
node fotos.js                           # las fotos para cuando no hay maqueta
```
