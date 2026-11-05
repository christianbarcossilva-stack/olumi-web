# olumi-web

Web pública de **Olumi by Unity Tech**: portada de unitytech.uy, página de Olumi, privacidad, términos y la app web (`/olumi/app/`).

Solo contiene archivos públicos (lo mismo que ve cualquiera que abre la página). La clave de Supabase que está en `olumi/app/config.js` es la *publishable*, pensada para ir dentro de la app.

## Servidor
- `servidor/diagnostico.sh`: muestra cómo está armado el VPS, sin cambiar nada.
- `servidor/instalar.sh`: instala la web en el VPS (nginx detrás del Traefik de n8n, con https automático).
- `servidor/actualizar.sh`: queda en el VPS como `olumi-actualizar`; baja la última versión de este repositorio y la publica.


