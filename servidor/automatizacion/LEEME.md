# Motor de automatización de Unity Tech (nombre pendiente)

Reemplazo propio de n8n. Plan completo: doc del proyecto `claude/automatizacion-propia-plan-2711.md`.

## Cómo está hecho
- **Sin dependencias** (Node 22): `motor.mjs` (servidor y cola), `piezas.mjs` (IA, audio, WhatsApp, Olumi), `almacen.mjs` (Supabase o memoria).
- **Recetas** en `recetas/`: cada flujo es un archivo con `webhook()` y `pasos`. Un paso devuelve el siguiente `{ paso, datos, esperar }` o `null`.
- **Cola durable** en Supabase (`auto_trabajos`): un reinicio en medio de una espera no pierde nada. Reintentos a los 30 s, 2 min y 10 min.
- **Multiempresa**: cada flujo es de una `org` (la misma de las apps), con sus ajustes, sus claves cifradas (`auto_claves`) y su tope de gasto de IA por mes (`auto_gasto`). Como mucho 3 trabajos a la vez por empresa.
- **Modo sombra** (el de arranque): hace todo menos mandar WhatsApp o registrar en Olumi, y anota en `auto_ejecuciones` qué habría hecho.
- Webhooks: `POST /h/<token>`. Evolution entra por adentro (`http://motor:8080/h/<token>`); las apps, por `https://unitytech.uy/h/<token>`.

## Dónde se ve
**https://unitytech.uy/admin/automatizacion/** (`admin/automatizacion/index.html`): con la cuenta de Olumi, solo administradores de Unity Tech. Muestra si el motor está en línea, los flujos de cada empresa (prender, apagar, pasar de prueba a funcionando), el gasto de IA del mes y cada paso, con lo que habría mandado en modo prueba. Lee todo con la función `auto_panel()`; cambia con `auto_cambiar()`.

## Recetas pasadas
| Receta | Viene de | Estado |
|---|---|---|
| `tickets` | `servidor/n8n/tickets.py` | Pasada y probada (17 pruebas). Falta el número de WhatsApp de tickets para usarla de verdad. |

## Probar
```
node --test 'servidor/automatizacion/prueba/*.test.mjs'
```

## Instalar en el VPS (con el OK de Christian)
1. Correr `esquema.sql` en Supabase (crea las tablas `auto_*`; no toca nada de lo que existe).
2. En el servidor, como root: `curl -fsSL https://raw.githubusercontent.com/christianbarcossilva-stack/olumi-web/main/servidor/automatizacion/instalar.sh | bash` (sirve también para actualizar). La primera vez pide una sola cosa, la clave secreta de Supabase, y carga solo las claves de Phitel que ya están en el servidor (Evolution, Olumi y Groq).
3. Dar de alta el flujo en `auto_flujos` (receta `tickets`, org de Phitel, modo `sombra`) y apuntar el webhook de la instancia de Evolution a `http://motor:8080/h/<token>`.
