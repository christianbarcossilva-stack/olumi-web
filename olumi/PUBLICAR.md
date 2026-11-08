# Reglas para publicar Olumi

1. **Todo cambio nuevo va primero a pruebas**: `unitytech.uy/olumi/beta/` (carpeta `olumi/beta/`). Usa los datos reales, muestra la franja "Versión de prueba" y las funciones marcadas como en prueba (`enPrueba()`, por ejemplo En vivo) solo se ven ahí.
2. **Christian (o Giancarlo) lo prueba** en compu y celular. Si está bien, dice "aprobado".
3. **Recién ahí se pasa a la app de los clientes**: `unitytech.uy/olumi/app/` (carpeta `olumi/app/`), y a la Mac para iPhone/Android.
4. **Días de publicación**: martes y jueves, no a la noche ni el fin de semana. Arreglos urgentes de un error, cuando haga falta.
5. **Nada a medio terminar en la app de los clientes**: si una función no está pulida, queda detrás de `enPrueba()` o de un extra (`has('...')`).
6. Cada publicación a clientes lleva una línea en "Novedades" (LEEME) con lo que cambió para ellos.
7. Al pasar a clientes se actualiza `olumi/app/version.json` (versión y fecha): la página de descargas lo muestra. Después se arma la versión de iPhone y Android con el mismo número.

## Regla de calidad (Christian, 7/11)
- La meta es **la mejor app y el mejor software del rubro, y a la vez el más seguro**.
- Código lo más corto y eficiente posible: nada escrito de más, nada repetido, sin líneas que sobren; si algo se puede hacer igual de bien con menos, se acorta.
- Ninguna optimización puede bajar la calidad, la seguridad ni romper lo que ya anda: se prueba antes y después.
- Revisión completa del código: martes 10/11, antes de pasar la beta a clientes.

## Direcciones (a partir del martes 10/11, cuando se pase la beta a clientes)
- **unitytech.uy/olumi/** → la app de los clientes (hoy está en /olumi/app/).
- **unitytech.uy/olumi/beta/** → pruebas anticipadas; pasa a clientes solo cuando Christian lo decide.
- /olumi/app/ queda solo para redirigir (enlaces viejos, invitaciones, app de Windows y apps instaladas).

## Páginas web (unitytech.uy, /olumi/, /ondi/, /estiba/)
- Todas usan el estilo común `familia.css` + `familia.js` (raíz del sitio): letra del sistema, nav global "Unity Tech · Olumi · Ondi", nav de cada producto, botones píldora, modo claro/oscuro (sigue al equipo, con botón ◐ que se recuerda en `ut.theme`).
- Cada producto define solo sus colores en su página: `--acc` (botón), `--acc-2` (acento en oscuro), `--acc-ink` (texto sobre el botón), `--acc-t` (acento para texto).
- Si se cambia `familia.css`, subir el `?v=` en todas las páginas para que llegue enseguida.
- La Oficina viva vive en `olumi/oficina/` y se embebe con `?embed=1` (recibe el tema y avisa su alto).
- Estiba sigue en vista previa: `noindex`, sin enlaces desde las otras páginas, hasta que Christian apruebe el nombre.
- Regla del sitio: nada de nombres reales de clientes en lo público.
