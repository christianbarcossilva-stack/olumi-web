# Web de Olumi v7 · el camino del pedido y las animaciones nuevas

Pedido del 26/11: «hay que mejorar la web, que el camino sea mejor y nuevas animaciones para que impacte más».

Esta carpeta (`servidor/web/olumi-v7/`) tiene las fuentes de la página, cómo se arma y cómo se prueba. `servidor/` no se publica (lo saca `actualizar.sh`).

## La idea (una sola)
El punto naranja del logo es **un pedido que recorre la empresa**. En la maqueta deja su línea pintada en el piso:
recepción → pasillo → el escritorio del técnico → depósito → portón → la camioneta → la entrada de vehículos → la calle → el cliente («Barraca Norte», el galpón del oeste).
La cámara viaja con él y descansa en cada escena; la hora del día funde de una a otra (la portada es de noche en el tema oscuro: el primer scroll es un amanecer);
abajo va el riel del día (7:42 · 7:43 · 9:58 · 10:42 · 19:30). El resto de la página aterriza con el movimiento de la identidad (una curva, de a uno, en orden de lectura).
Con «reducir movimiento» nada se anima.

## Piezas
- `historia.html` · la historia (portada + 7 escenas) y el riel `nav.dia`.
- `cierre.html` · el cierre «Tu empresa, en Olumi. Desde hoy.» (`#probar`).
- `v7.css` · todo lo nuevo de estilo (se mete antes de `.vprev{` de la v6).
- `v7.js` · el guion completo de la página (reemplaza al de la v6).
- `base-v6.html` · la página pública del 26/11 (v6), de donde salen los textos, planes y preguntas.
- `construir.py SALIDA [previa]` · arma la página: toma `olumi/index.html` del repositorio y, si esa ya es la v7, `base-v6.html`. Antes revisa `v7.js` con `node --check` y no arma una página rota.
  Con `previa` sale sin indexar y con la chapita «Vista previa» (para `nuevo/olumi/`).
- `prueba/` · `logica.js` (la historia con números), `web.js` (recorre y saca capturas), `tanda.sh` (todas las plataformas), `quieta.js` (quién sigue pidiendo cuadros), `srv.js`.

## Armar
```
python3 servidor/web/olumi-v7/construir.py nuevo/olumi/index.html previa     # la vista previa
python3 servidor/web/olumi-v7/construir.py olumi/index.html                  # la pública (solo con el OK de Christian)
```
Al pasarla a pública, `nuevo/olumi/index.html` vuelve a ser la redirección a `/olumi/`.

## El guion (`v7.js`), lo que hay que saber
- `TOMA` · una toma por escena: `[centro x, centro z, giro, inclinación, distancia, corrimiento]`. El sexto número corre la escena hacia la derecha en la compu
  (fracción del ancho) para que quede en el hueco entre el texto y el teléfono; lo aplica `correr()`. `ANG` cambia el centro de alguna toma en pantalla angosta.
- `PIE` y `VAN` · el camino en metros de la maqueta (a pie por la oficina; después la camioneta). `redondear()` hace las curvas; un tercer número en un punto es su radio.
- `RUTA` · cuánto del camino va dibujado al llegar a cada escena. `CAM.tec`, `CAM.dep` y `CAM.van` son las marcas (técnico, depósito, camioneta).
- La línea es una cinta propia en la escena del motor (`armarCamino`). **Dos cosas que costaron**: los arreglos de números los arma el motor en su ventana
  (`T.Float32BufferAttribute`; uno de esta ventana da «Unsupported buffer data format») y lleva `polygonOffset` −20/−18 porque los pisos y calles del motor ya traen el suyo.
- La chapita `T‑0152 · …` cuenta **por dónde va el pedido** (`estado()`: Ticket nuevo → Lo toma Diego → Retira los materiales → Cargado en la camioneta → En camino → Firmado → Resuelto), no la escena que se lee.
  Va arriba del punto (abajo si arriba la tapan la barra o el riel). En la compu esquiva el teléfono o la tarjeta **solo si están a su altura** (`devs`) y los renglones del texto de la escena
  (`renglones()`: renglón por renglón con `Range.getClientRects`, no la caja; con la letra de verdad los títulos miden distinto que en las pruebas). Si no hay lugar entre el texto y el teléfono, gana el teléfono.
- La Fiorino (`veh_v1qk61`) espera de culata; cuando el pedido llega, el punto se sube al techo y ella lo lleva (`ponVan`, cada cuadro: si el motor rearma las piezas al cambiar de claro a oscuro, se vuelve a ubicar sola).
  Diego está dos veces en la escena, como en la v6: sentado en su escritorio (`per_p9kwpc`) y parado junto a la camioneta (`w26`). Su silla queda vacía cuando el pedido sale del escritorio
  (el punto que va al depósito y a la camioneta es él, llevándolo); el que está parado se sube cuando la camioneta arranca y baja si se vuelve atrás.
- El motor arranca con su propio vuelo de presentación (`motor.ir(enc, 1.8)`): en `listo()` se corta con `M.ir(toma, .001)`. **Sin eso pelea con la cámara de la historia** (la cámara quedaba en el encuadre del motor).
- El tiempo de cada cuadro se toma del reloj (hasta 0,2 s): en un equipo lento la entrada no queda en cámara lenta.
- `ponHora` saca una foto del lienzo (`#fund`) y la desvanece sobre la hora nueva (1,1 s).
- **Fuera de la pantalla la maqueta no dibuja** (`M.cada` envuelto con `vis`): su gente se movía sola y gastaba placa y batería mientras se leía el resto de la página.
- La escena se revalida antes de abrir la maqueta (`fetch(…,{cache:'no-cache'})`): el motor la pide sin versión y el navegador podía quedarse horas con la anterior.
- Si no hay maqueta (teléfono con poca memoria o no cargó), `cine.sin3d` esconde el cartel «Armando la oficina», que antes quedaba para siempre.
- Sin guion (o si a los 5 s no corrió), `html` pierde la clase `js` y todo se muestra sin esperar animaciones.

## El scroll
`anclas()` da el scroll que deja cada escena en su lugar y `upd()` saca de ahí por dónde va la historia (`S`, de 0 a 7, con decimales entre escenas).
- Compu: el centro de cada escena al centro de la pantalla. Con menos de 1280 de ancho el texto no pasa del 46 % y la escena se corre un poco más (`correr()`).
- Teléfono y tablet de pie (hasta 860 px): **el título de la escena al 62 % del alto** (`ZONA`) y la escena activa es `round(S)`.
- La portada siempre es 0 con la página sin bajar. `yDe(i)` lo usan el riel y las pruebas (`__olumiHist.y(i)`).

## Teléfono y tablet de pie
Antes el texto de cada escena cruzaba por encima de la maqueta y no se leía. Ahora **la maqueta es una ventana arriba (44 % del alto) y la historia pasa por debajo**:
- `.cine .bg` mide 44svh + 36 px, va por encima de las escenas (`z-index:2`) y termina en una cortina que funde. La maqueta y la foto de fundido miden 44svh
  (lienzo casi cuadrado: se ve la oficina entera sin alejar la cámara y dibuja menos).
- Cada escena se enciende (`.on`) cuando su aparato entra a la pantalla, así sus animaciones se ven.
- En `correr()`: de cerca, la cámara se acerca un 16 % más y la escena baja (arriba la tapan la barra y el riel).

## La escena (`motor/escenas/olumi-web-v7.json`, solo de esta página)
Es la de la v6 (`olumi-web.json`, que siguen usando la página pública del 26/11 y la portada de unitytech.uy, **sin tocar**) más:
- **Entrada de vehículos** al final de la calle interna: la vereda se abre entre x −2,2 y 2,2 (`w2` termina en −2,2 y sigue `w2b` desde 2,2; `ver2` arranca en 2,2),
  con un paño de hormigón `acc1` (hormigón y no «calzada»: así los cordones de las dos calles se cortan ahí) y los cantos `w2c`, `w2d`, `ver2c`. La columna de luz `w7` se corrió a x −5,2.
- Los autos de la calle (`w23`, `w24`, `w25`) estaban atravesados (r = π/2): ahora van a lo largo, junto al cordón y por su mano. En el motor un vehículo mira a +x con r = 0.
- El nombre de la escena está en `ESC` (`v7.js`). Quedó aparte para que nada público cambiara antes del OK; cuando la v7 sea la pública, la portada de unitytech.uy puede pasar a esta misma escena.

## Probar (regla del 25/11: web al día, estética y todas las plataformas)
```
cd servidor/web/olumi-v7/prueba
node logica.js                                                        # la historia con números (tiene que terminar en «todo bien»)
OUT=/tmp/w7 W=1440 H=900 MID=4.45 SECC='#crm,#probar' node web.js     # una pasada con capturas (prueba nuevo/olumi/ del repositorio)
./tanda.sh                                                            # teléfono, tablet de pie y acostada, claro, 1280, oscuro y sin movimiento
```
- `SITIO=/carpeta` pone otra copia del sitio por delante (para probar una página armada fuera del repositorio).
- El 3D sin placa de video va con `--use-gl=angle --use-angle=gl-egl`. De lejos y a 1440 cada cuadro puede tardar más de un segundo: no es la página.
- La página tiene `scroll-behavior:smooth`: en las pruebas se baja con `scrollTo({top,behavior:'instant'})`, y antes de mirar se espera a que `__olumiHist.S` llegue
  (el aviso de scroll llega con el cuadro siguiente; con el 3D lento, la quietud de antes engaña).
- `SIN3D=1` corta la maqueta (para mirar el resto de la página sin esperar).
- Lo que anima el motor por dentro (el técnico subiendo) no se ve en `motor.dirty`: se espera mirando la pieza.
- Antes de mostrar: mirarla en un navegador de verdad (3D y animación). El 26/11 se miró en vivo en el navegador de la app de Claude en la Mac (1024 × 768 y tamaño teléfono): ahí salió lo de la chapita.
  Ese navegador, con el panel escondido, corre la página en segundo plano (un cuadro por segundo): sirve para ver cómo queda, no para medir fluidez.
