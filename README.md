# olumi-web

Web pública de **Olumi by Unity Tech**: portada de unitytech.uy, página de Olumi, privacidad, términos y la app web (`/olumi/app/`).

Solo contiene archivos públicos (lo mismo que ve cualquiera que abre la página). La clave de Supabase que está en `olumi/app/config.js` es la *publishable*, pensada para ir dentro de la app.

## Servidor
- `servidor/diagnostico.sh`: muestra cómo está armado el VPS, sin cambiar nada.
- `servidor/instalar.sh`: instala la web en el VPS (nginx detrás del Traefik de n8n, con https automático).
- `servidor/actualizar.sh`: queda en el VPS como `olumi-actualizar`; baja la última versión de este repositorio y la publica.



## Ondi
- `ondi/`: página de Ondi (monitoreo de redes UniFi y multimarca) y su app web instalable en `ondi/app/`. `monitor/` redirige a `ondi/` (era el nombre anterior).
- Los instaladores de Windows y Mac están en la release `ondi-escritorio`, armados por GitHub Actions (`.github/workflows/ondi-escritorio.yml`) desde `servidor/escritorio-ondi/` cada vez que cambia la app. Ahí también queda `ondi-app.zip`, el proyecto de iPhone/Android (`servidor/ondi-app/`).
- La app tiene enlaces directos: `#panel`, `#clientes`, `#cliente-c1`, `#pantallas`, `#pantalla-p1` (abre el modo pantalla, para televisores), `#alertas`, `#ajustes`.
- La versión pública (`ondi/app/`) se genera desde la demo privada sin nombres reales de clientes; no editarla a mano.
