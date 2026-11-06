# Reglas para publicar Olumi

1. **Todo cambio nuevo va primero a pruebas**: `unitytech.uy/olumi/beta/` (carpeta `olumi/beta/`). Usa los datos reales, muestra la franja "Versión de prueba" y las funciones marcadas como en prueba (`enPrueba()`, por ejemplo En vivo) solo se ven ahí.
2. **Christian (o Giancarlo) lo prueba** en compu y celular. Si está bien, dice "aprobado".
3. **Recién ahí se pasa a la app de los clientes**: `unitytech.uy/olumi/app/` (carpeta `olumi/app/`), y a la Mac para iPhone/Android.
4. **Días de publicación**: martes y jueves, no a la noche ni el fin de semana. Arreglos urgentes de un error, cuando haga falta.
5. **Nada a medio terminar en la app de los clientes**: si una función no está pulida, queda detrás de `enPrueba()` o de un extra (`has('...')`).
6. Cada publicación a clientes lleva una línea en "Novedades" (LEEME) con lo que cambió para ellos.
7. Al pasar a clientes se actualiza `olumi/app/version.json` (versión y fecha): la página de descargas lo muestra. Después se arma la versión de iPhone y Android con el mismo número.

## Páginas web (unitytech.uy, /olumi/, /ondi/, /estiba/)
- Todas usan el estilo común `familia.css` + `familia.js` (raíz del sitio): letra del sistema, nav global "Unity Tech · Olumi · Ondi", nav de cada producto, botones píldora, modo claro/oscuro (sigue al equipo, con botón ◐ que se recuerda en `ut.theme`).
- Cada producto define solo sus colores en su página: `--acc` (botón), `--acc-2` (acento en oscuro), `--acc-ink` (texto sobre el botón), `--acc-t` (acento para texto).
- Si se cambia `familia.css`, subir el `?v=` en todas las páginas para que llegue enseguida.
- La Oficina viva vive en `olumi/oficina/` y se embebe con `?embed=1` (recibe el tema y avisa su alto).
- Estiba sigue en vista previa: `noindex`, sin enlaces desde las otras páginas, hasta que Christian apruebe el nombre.
- Regla del sitio: nada de nombres reales de clientes en lo público.
