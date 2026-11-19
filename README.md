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

## Darvi (en pausa desde el 18/11)
- Pedido de Christian: el proyecto queda en pausa, fuera de línea y sin vínculo con las otras apps. Se sacaron `darvi/`, `estiba/`, `nuevo/estiba/` e `img/estiba/`; están en la historia de git (commit `0bc2ad9`) y se recuperan con `git checkout 0bc2ad9 -- darvi estiba nuevo/estiba img/estiba`. Las tablas `estiba_*` siguen en Supabase con sus datos (`servidor/supabase/estiba-1.0.sql`).

## Kliva (vista previa)
- `kliva/`: la web de Kliva (control de acceso multimarca: ZKTeco, Hikvision, Dahua e Intelbras en un solo panel). Cuenta una semana de trabajo y usa la demostración real como escenario: cada capítulo le pide una escena por mensaje (`demo/?cine=1`).
- `kliva/beta/`: la beta de Kliva, con datos inventados (`kliva/demo/` lleva ahí) (no hay servidor detrás: todo corre en el navegador; lo que se edita en el plano queda en ese navegador). Su vista Plano abre el motor común de `motor/beta/` (ruta absoluta `/motor/beta/`), con el plano de ejemplo de cada sitio.
- Las dos páginas se generan con `npm run build:web` en el proyecto de Kliva (salen en `web/dist/sitio/`); no editarlas a mano. La web se escribe en `web/sitio/index.html` de ese proyecto.
- Llevan `noindex` y no tienen enlace desde la portada: Kliva todavía no tiene instalaciones con equipos reales. La app con servidor irá en `kliva/app/` y `kliva/beta/` cuando se instale. Se enlaza desde `index.html` recién cuando Christian lo apruebe.
- `portuno/` redirige a `kliva/` (fue el nombre de los primeros minutos).
