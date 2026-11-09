# Diseño de las webs de Unity Tech · v4 (en vivo desde el 9/11/2026)

Pedido de Christian: que el cliente quede enganchado con lo que ve, que se note la tecnología y que estamos por arriba de la competencia.
Referencias que mandó: páginas que cuentan una historia mientras bajás (cámara que entra a la casa, producto que gira, números gigantes, fondo oscuro).

- **Oscuras siempre** (como las páginas Pro de Apple). Titulares Instrument Sans 600 muy grandes y apretados (-0,045em).
- **La historia va sobre la maqueta 3D real**, no sobre fotos: `/olumi/oficina/3d.html?embed=1&cine=1` en un iframe fijo de fondo.
  La página manda `{cine:t}` (0 a 1) según el scroll y `{cineEv:'wa'|'van'|...}` al entrar a cada parte. Las tomas están en `scripts/oficina-3d/cine.js` (olumi-app).
  `&orbita=1` hace que la cámara gire sola alrededor del edificio (portada de Unity Tech).
- **Olumi:** portada → entrá → WhatsApp que se vuelve ticket → coordinación (avisos en el celular) → camioneta con su stock → foto, informe y firma → todo en vivo → cierre. Después funciones, planes, descargas y preguntas.
- **Los teléfonos están dibujados en HTML/CSS** (nítidos en cualquier pantalla y animados): WhatsApp, pantalla bloqueada con avisos, cámara y parte firmado.
- **Unity Tech:** portada con la oficina girando, las dos apps y "Una parte física, una parte inteligente": Phitel instala, Unity Tech hace el software.
- Datos de ejemplo inventados (Barraca Norte, Diego). Nunca clientes reales.

---

# Diseño de las webs de Unity Tech · v3 (8/11/2026)

Páginas: `index.html` (Unity Tech), `olumi/`, `ondi/`, `estiba/` (vista previa, noindex) y las legales `olumi/privacidad.html` y `olumi/terminos.html`.
Todas comparten `familia.css` y `familia.js`. Hasta que Christian lo apruebe, el rediseño vive en `/nuevo/` (mismas rutas adentro);
se pasa a definitivo con `bash servidor/web/pasar-nuevo.sh`.

## Idea
- **Lo primero que se ve es el producto vivo.** La oficina de Olumi con el equipo moviéndose (iframe real de `/olumi/oficina/?embed=1`),
  el gemelo digital de Ondi y el parque de Estiba (capturas de las maquetas 3D). El resto de la página se calla.
- **Letra:** Instrument Sans (Google Fonts, variable 400–700) solo para titulares; la del sistema para el texto (SF en Apple, Segoe en Windows).
- **Firma:** el rombo naranja de Unity Tech (`#ff6a13`) en la marca, las viñetas y el foco. Cada app usa un solo acento:
  Olumi `#ffc93c` (texto oscuro), Ondi `#3fc6ea` en oscuro / `#0a7fa3` en claro, Estiba `#3ddc97` en oscuro / `#0f7a55` en claro.
- **Escenarios oscuros (`.stage`)** en los dos temas: ahí viven las capturas en marcos de Mac (`.mac`) e iPhone (`.phone`).
  En celular, `.vis .cel` reemplaza la captura de computadora por el teléfono o por una foto recortada (`.pic`).
- **Un solo momento de movimiento:** la entrada del hero (`.in`, `.in.bloom`). Nada de aparecer-por-sección. Se respeta `prefers-reduced-motion`.
- **Tema:** sigue al equipo; el botón ◐ lo cambia y queda en `localStorage` (`ut.theme`). Las demos embebidas reciben `{tema}` por `postMessage`;
  un `data-tema="dark"` en el `.live` fuerza el tema del iframe (el hero de la home siempre oscuro).

## Componentes (familia.css)
`.gnav` barra Unity Tech · `.lnav` barra del producto (pegajosa, `.scrolled`) · `.btn` (`.pri`, `.ink`, `.sm`, `.lg`) · `.more` enlace con › ·
`.hero` · `.stage` · `.devices` (Mac + iPhone superpuestos) · `.story` / `.story.flip` (texto + imagen) · `.facts` (lista con filetes) ·
`.list` (viñetas rombo) · `.plans` / `.plan.hl` · `.dl` (plataformas) · `.faq` · `.ffoot` · `.prev` (franja de vista previa) ·
`.live` (demo embebida con foto de espera; `data-src`, `data-noalto`, `data-solo-compu`, `data-tema`).

## Imágenes (`/img/`)
Capturas reales de las apps con la empresa de ejemplo "Instalaciones Demo" (sin clientes reales), en WebP:
`img/olumi/phone-*.webp` (390×844 @2x), `img/olumi/mac-*.webp` (16:10), `img/olumi/oficina-poster-*.webp`,
`img/ondi/*.webp`, `img/estiba/maqueta.webp`. Se regeneran con los scripts del scratchpad (`fotos146.js`, `ipad.js`, `shot3d.js`).
Imágenes para compartir: `og.png`, `olumi/og.png`, `ondi/og.png` (1200×630).

## Reglas
- Sin nombres de clientes reales en nada público.
- Nada de enlaces a las betas (`/olumi/beta/`, `/ondi/beta/`) desde las páginas públicas.
- Enlaces a la app y a imágenes siempre absolutos (`/olumi/app/`, `/img/...`); entre páginas, relativos (`olumi/`, `../ondi/`).
- Antes de publicar: capturas en 1440 y 390, claro y oscuro, sin errores de consola, sin scroll horizontal, sin enlaces rotos
  (`shot-nuevo.js`, `inter.js`, `ancho.js` en el scratchpad de la sesión).
