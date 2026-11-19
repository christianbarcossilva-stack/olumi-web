# Archivo de Ondi

`maqueta.html` es la maqueta de siempre de Ondi (la anterior al motor común), archivada el 19/11/2026 por decisión de Christian.

- Ya no se muestra en la app ni en la beta: todas las maquetas abren en el motor común (`/motor/`).
- Sigue acá por una sola razón: trae el conversor (`window.__aMotor`) que pasa al motor lo que un cliente tenía cargado en el formato anterior. La app la abre tapada, una sola vez por cliente, y guarda el resultado; lo anterior queda dentro de la maqueta guardada, en `anterior`.
- No se le agregan funciones. Cuando no quede ningún cliente en el formato anterior, se puede sacar.
