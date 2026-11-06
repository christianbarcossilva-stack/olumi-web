# Reglas para publicar Olumi

1. **Todo cambio nuevo va primero a pruebas**: `unitytech.uy/olumi/beta/` (carpeta `olumi/beta/`). Usa los datos reales, muestra la franja "Versión de prueba" y las funciones marcadas como en prueba (`enPrueba()`, por ejemplo En vivo) solo se ven ahí.
2. **Christian (o Giancarlo) lo prueba** en compu y celular. Si está bien, dice "aprobado".
3. **Recién ahí se pasa a la app de los clientes**: `unitytech.uy/olumi/app/` (carpeta `olumi/app/`), y a la Mac para iPhone/Android.
4. **Días de publicación**: martes y jueves, no a la noche ni el fin de semana. Arreglos urgentes de un error, cuando haga falta.
5. **Nada a medio terminar en la app de los clientes**: si una función no está pulida, queda detrás de `enPrueba()` o de un extra (`has('...')`).
6. Cada publicación a clientes lleva una línea en "Novedades" (LEEME) con lo que cambió para ellos.
