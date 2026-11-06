# Ondi con cuentas: puesta en marcha

Ondi usa las mismas cuentas y empresas de Olumi (el mismo proyecto de Supabase). La versión de prueba está en
`https://unitytech.uy/ondi/beta/`. La app de demo de siempre sigue en `/ondi/app/` hasta que se apruebe.

## Una sola vez, en Supabase

1. **SQL Editor** → pegar `ondi-1.0.sql` → **Run**. Tiene que terminar con `listo`.
2. **Edge Functions** → **Deploy a new function** → **Via editor** → nombre `ondi-unifi` → pegar `ondi-unifi.ts` → **Deploy**.
   Dejar activado "Verify JWT".
3. **Authentication** → **URL Configuration** → **Redirect URLs** → agregar `https://unitytech.uy/ondi/beta/`
   (para que los emails de confirmar cuenta y de cambiar contraseña vuelvan a Ondi).

## Cómo se usa

- **Entrar**: con la cuenta de Olumi. Una cuenta nueva elige "Soy una empresa instaladora" (crea la empresa) o "Tengo un código".
- **Conexión UniFi** (menú de la izquierda): el dueño o un administrador pega la clave de API de unifi.ui.com.
  La clave queda en la tabla `ondi_secretos`: nadie la puede leer desde la app, solo la función `ondi-unifi`.
- **Clientes** → **Nuevo cliente**. Cada cliente tiene estas pestañas:
  - **Maqueta**: el 3D editable. Se guarda solo en `ondi_maquetas`. "Importar armado" carga un archivo .json (por ejemplo, los nombres reales de los galpones).
  - **Equipos**: los equipos de UniFi en vivo.
  - **Integración UniFi**: elegir la cuenta (la de la empresa o una propia del cliente) y el sitio.
  - **Accesos**: el código para el IT del cliente (solo lectura: maqueta y equipos de su empresa).
  - **Datos**: nombre, nombre en la maqueta, dirección, contacto, notas y borrar el cliente.

## Permisos (rol en la empresa, el mismo de Olumi)

| Rol | Puede |
|---|---|
| Dueño / Administrador | todo: clientes, clave de UniFi, accesos |
| Encargado / Técnico | editar maquetas y datos, enlazar sitios |
| Solo lectura | ver todo |
| IT del cliente (con código) | ver la maqueta y los equipos de su cliente, nada más |

## Maqueta pública

`ondi/beta/maqueta.html` es la maqueta estándar, **sin nombres reales**. Se arma aparte, fuera de este repositorio,
cambiando los nombres por unos de ejemplo.
Los nombres reales de cada cliente se cargan adentro de la app (se guardan en Supabase, detrás del login).
