#!/bin/bash
# Respaldo de verdad de Unity Tech. Todas las noches saca una copia CIFRADA de los datos de Olumi y Ondi
# (y de n8n) y la guarda en este servidor, que es de otro proveedor que la base de datos.
# Cada noche, antes de cifrar, PRUEBA la copia: la restaura en una base de descarte y cuenta las filas.
# Guarda 30 días y 12 meses. Si falla, queda anotado (y avisa, si se le configura a dónde).
#
# Se instala UNA vez en el servidor:
#   curl -fsSL https://raw.githubusercontent.com/christianbarcossilva-stack/olumi-web/main/servidor/respaldo.sh | sudo bash
# Pide la contraseña de la base (se escribe en el servidor, nunca en un chat) y muestra UNA sola vez la llave
# para abrir los respaldos: esa llave va al gestor de contraseñas y NO queda en el servidor.
#
# Después:  unitytech-respaldo                    hace un respaldo ahora
#           unitytech-respaldo estado             cuándo fue el último y cómo salió
#           unitytech-respaldo abrir 2026-11-22   descifra el de ese día (pide la llave)
set -euo pipefail
REF=pgriavmcmscchxdnfglv
ETC=/etc/unitytech; DEST=/var/respaldos/unitytech; LIB=/usr/local/lib/unitytech; IMG=unitytech-respaldo

# ───────── lo que corre adentro del contenedor: sacar, probar y cifrar ─────────
escribir_trabajo() { cat > "$1" <<'TRABAJO'
#!/bin/bash
# Saca los datos de la base, prueba que se pueden restaurar y los deja cifrados en $SALIDA.
set -uo pipefail
: "${HOY:?}"; SALIDA="${SALIDA:-/respaldos/diario/$HOY}"; LLAVE="${LLAVE:-/llave.pub}"; T="${TRABAJO:-/tmp/respaldo}"
B="${PGBIN:+$PGBIN/}"; ESQUEMAS="'public','respaldo'"; AVISOS=()
export PGCONNECT_TIMEOUT=20 PGDATABASE="${PGDATABASE:-postgres}" PGSSLMODE="${PGSSLMODE:-require}"

como_pg() { if [ "$(id -un)" = postgres ]; then "$@"; elif command -v su-exec >/dev/null 2>&1; then su-exec postgres "$@"; else su postgres -s /bin/bash -c "$(printf '%q ' "$@")"; fi; }
limpiar() { [ -f "$T/pg/postmaster.pid" ] && como_pg "${B}pg_ctl" -D "$T/pg" -m immediate stop >/dev/null 2>&1; rm -rf "$T"; }
trap limpiar EXIT
falla() { echo "FALLO: $*"; exit 1; }
q() { "${B}psql" -X -At -v ON_ERROR_STOP=1 -c "$1"; }                                   # en la base de verdad
v() { PGSSLMODE=disable "${B}psql" -X -At -v ON_ERROR_STOP=1 -h "$T/s" -p 54999 -U postgres -d "${VDB:-verif}" -c "$1"; }   # en la de descarte
contar() { "$1" "select format('select %L, count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and n.nspname in ($ESQUEMAS) order by 1" | while IFS= read -r s; do "$1" "$s"; done; }

grep -q '^age1' "$LLAVE" 2>/dev/null || falla "falta la llave pública para cifrar ($LLAVE)"
rm -rf "$T"; mkdir -p "$T/claro" "$SALIDA"; chmod 755 "$T"; chmod 700 "$T/claro"; cd "$T/claro" || falla "sin carpeta de trabajo"
q "select 1" >/dev/null 2>"$T/e" || falla "no se pudo entrar a la base: $(tail -1 "$T/e")"

# 1) los datos de las apps (tablas, funciones y reglas)
ARGS=(); for e in $(q "select nspname from pg_namespace where nspname in ($ESQUEMAS) order by 1"); do ARGS+=(-n "$e"); done
contar q > "$T/conteo-antes.txt" 2>"$T/e" || falla "no se pudieron contar las filas: $(tail -1 "$T/e")"
"${B}pg_dump" -Fc -Z6 "${ARGS[@]}" -f datos.dump 2>"$T/e" || falla "pg_dump de los datos: $(tail -1 "$T/e")"
contar q > conteo.txt 2>"$T/e" || falla "no se pudieron contar las filas: $(tail -1 "$T/e")"

# 2) usuarios, índice de archivos y tareas programadas (si alguno falla se avisa, pero los datos se guardan igual)
"${B}pg_dump" -Fc --data-only -n auth -T 'auth.schema_migrations' -f usuarios.dump 2>"$T/e" || { rm -f usuarios.dump; AVISOS+=("usuarios: no se pudieron copiar ($(tail -1 "$T/e"))"); }
"${B}pg_dump" -Fc --data-only -t 'storage.buckets' -t 'storage.objects' -f archivos-indice.dump 2>"$T/e" || { rm -f archivos-indice.dump; AVISOS+=("índice de archivos: no se pudo copiar ($(tail -1 "$T/e"))"); }
q "copy (select jobname, schedule, command, active from cron.job order by 1) to stdout with csv header" > tareas-programadas.csv 2>/dev/null || rm -f tareas-programadas.csv

# 3) la prueba: se restaura en una base de descarte y se cuentan las filas
mkdir -p "$T/pg" "$T/s"; chown postgres "$T/pg" "$T/s" 2>/dev/null; chmod 700 "$T/pg"
como_pg "${B}initdb" -D "$T/pg" -U postgres -A trust -E UTF8 --no-locale >/dev/null 2>"$T/e" || falla "no arrancó la base de descarte: $(tail -1 "$T/e")"
como_pg "${B}pg_ctl" -D "$T/pg" -o "-p 54999 -c listen_addresses='' -c unix_socket_directories='$T/s' -c fsync=off" -l "$T/s/pg.log" -w start >/dev/null 2>"$T/e" || falla "no arrancó la base de descarte: $(tail -1 "$T/s/pg.log" 2>/dev/null || tail -1 "$T/e")"
VDB=postgres v "create database verif" || falla "base de descarte"
v "create role anon; create role authenticated; create role service_role; create role supabase_admin; create role authenticator; create role dashboard_user; create role supabase_auth_admin; create role supabase_storage_admin;
   create schema extensions; create extension if not exists pgcrypto schema extensions; create extension if not exists \"uuid-ossp\" schema extensions;
   create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid'; create function auth.role() returns text language sql as 'select null::text';
   create function auth.jwt() returns jsonb language sql as 'select null::jsonb'; create function auth.email() returns text language sql as 'select null::text';" >/dev/null || falla "base de descarte"
PGSSLMODE=disable "${B}pg_restore" --no-owner --no-privileges --section=pre-data --section=data -h "$T/s" -p 54999 -U postgres -d verif datos.dump 2>"$T/restaurar.err"
NERR=$(grep -c 'error:' "$T/restaurar.err" || true)
contar v > "$T/conteo-copia.txt" 2>"$T/e" || falla "no se pudo contar en la base de descarte: $(tail -1 "$T/e")"
# cada tabla tiene que estar y con las mismas filas. Se contó antes y después de copiar: si en ese rato la tabla
# no cambió, tiene que coincidir exacto; si cambió, la copia tiene que caer entre los dos números.
awk -F'|' 'FILENAME == ARGV[1] { a[$1] = $2 + 0; next } FILENAME == ARGV[2] { d[$1] = $2 + 0; next } { c[$1] = $2 + 0 }
  END { mal = 0; for (t in d) { lo = d[t]; hi = d[t]; if (t in a) { if (a[t] < lo) lo = a[t]; if (a[t] > hi) hi = a[t] }
        m = (lo == hi) ? 0 : hi * 0.01 + 1
        if (!(t in c) || c[t] < lo - m || c[t] > hi + m) { printf "%s: en la base %s, en la copia %s; ", t, d[t], (t in c) ? c[t] : "no está"; mal++ } }
        exit mal > 0 }' "$T/conteo-antes.txt" conteo.txt "$T/conteo-copia.txt" > "$T/dif" || falla "la copia no coincide con la base → $(cat "$T/dif")"
NT=$(wc -l < conteo.txt); NF=$(awk -F'|' '{ s += $2 } END { print s + 0 }' conteo.txt)
[ "$NT" -gt 0 ] && [ "$NF" -gt 0 ] || falla "la copia salió vacía"
como_pg "${B}pg_ctl" -D "$T/pg" -m immediate stop >/dev/null 2>&1; rm -rf "$T/pg" "$T/s"

# 4) los archivos subidos (fotos, PDF, planos). Hace falta la llave del servidor de Supabase.
if [ -n "${SB_SECRET_KEY:-}" ] && [ -n "${SB_URL:-}" ]; then
  BIEN=0; MAL=0; mkdir archivos
  # las llaves nuevas (sb_secret_…) van solo en «apikey»; las viejas (eyJ…) van también en «Authorization»
  CAB=(-H "apikey: $SB_SECRET_KEY"); case "$SB_SECRET_KEY" in sb_*) ;; *) CAB+=(-H "Authorization: Bearer $SB_SECRET_KEY") ;; esac
  q "select bucket_id || E'\t' || name from storage.objects where bucket_id is not null and name is not null and name not like '%.emptyFolderPlaceholder' order by 1" > "$T/lista" 2>/dev/null
  while IFS=$'\t' read -r b n; do
    case "/$b/$n/" in */../*|*/./*|*//*) MAL=$((MAL + 1)); continue ;; esac          # nunca se escribe fuera de la carpeta
    mkdir -p "archivos/$b/$(dirname "$n")"
    u="$SB_URL/storage/v1/object/$(printf '%s' "$b/$n" | jq -sRr 'split("/") | map(@uri) | join("/")')"
    if curl -fsS --retry 2 --max-time 600 "${CAB[@]}" -o "archivos/$b/$n" "$u" 2>/dev/null; then BIEN=$((BIEN + 1)); else MAL=$((MAL + 1)); rm -f "archivos/$b/$n"; fi
  done < "$T/lista"
  tar -cf archivos.tar archivos && rm -rf archivos
  [ "$MAL" -gt 0 ] && AVISOS+=("archivos: $MAL de $((BIEN + MAL)) no se pudieron bajar")
  ARCH="$BIEN archivos"
else
  AVISOS+=("archivos subidos: NO se copian (falta la llave del servidor de Supabase)"); ARCH="sin archivos"
fi

# 5) todo cifrado; lo que queda sin cifrar se borra al salir
for f in datos.dump usuarios.dump archivos-indice.dump tareas-programadas.csv conteo.txt archivos.tar; do
  [ -s "$f" ] || continue
  age -R "$LLAVE" -o "$SALIDA/$f.age" "$f" || falla "no se pudo cifrar $f"
done
jq -n --arg dia "$HOY" --arg cuando "$(date -u +%FT%TZ)" --argjson tablas "$NT" --argjson filas "$NF" --argjson errores "$NERR" --arg archivos "$ARCH" \
   --arg avisos "$(printf '%s\n' "${AVISOS[@]:-}")" --arg pesos "$(cd "$SALIDA" && for f in *.age; do printf '%s %s\n' "$f" "$(stat -c %s "$f")"; done)" \
   '{dia: $dia, cuando: $cuando, tablas: $tablas, filas: $filas, restauracion_probada: true, avisos_de_la_restauracion: $errores, archivos: $archivos,
     avisos: ($avisos | split("\n") | map(select(length > 0))), bytes: ($pesos | split("\n") | map(select(length > 0) | split(" ") | {(.[0]): (.[1] | tonumber)}) | add)}' > "$SALIDA/resumen.json"
echo "BIEN: $NT tablas, $NF filas, restauración probada, $ARCH${AVISOS[0]:+ · AVISO: ${AVISOS[*]}}"
TRABAJO
chmod 755 "$1"; }

# ───────── lo que corre en el servidor todas las noches ─────────
escribir_diario() { cat > "$1" <<'DIARIO'
#!/bin/bash
# Respaldo nocturno de Unity Tech (lo instala servidor/respaldo.sh).  unitytech-respaldo [estado | abrir AAAA-MM-DD]
set -uo pipefail
ETC="${UT_ETC:-/etc/unitytech}"; DEST="${UT_DEST:-/var/respaldos/unitytech}"; LIB="${UT_LIB:-/usr/local/lib/unitytech}"; IMG=unitytech-respaldo
conf() { grep -m1 "^$1=" "$ETC/respaldo.env" 2>/dev/null | cut -d= -f2-; }
cifrar() { docker run --rm -i -v "$ETC/respaldo.pub":/llave.pub:ro "$IMG" age -R /llave.pub; }

case "${1:-}" in
estado)
  cat "$DEST/estado.txt" 2>/dev/null || echo "Todavía no se hizo ningún respaldo."
  echo "Guardados: $(ls "$DEST/diario" 2>/dev/null | grep -cE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') días y $(ls "$DEST/mensual" 2>/dev/null | grep -cE '^[0-9]{4}-[0-9]{2}$') meses · ocupan $(du -sh "$DEST" 2>/dev/null | cut -f1)"
  exit 0 ;;
abrir)
  F="${2:-}"; O=""
  [[ "$F" =~ ^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$ ]] && for d in "$DEST/diario/$F" "$DEST/mensual/$F"; do [ -d "$d" ] && O="$d" && break; done
  [ -n "$O" ] || { echo "Uso: unitytech-respaldo abrir AAAA-MM-DD   · los últimos: $(ls "$DEST/diario" 2>/dev/null | grep '^[0-9]' | tail -5 | tr '\n' ' ')"; exit 1; }
  A="${UT_ABIERTO:-/root}/respaldo-abierto-$F"; mkdir -p "$A"; chmod 700 "$A"
  echo "Pegá la llave para abrir respaldos (empieza con AGE-SECRET-KEY-; no se ve al pegar) y apretá Enter:"
  read -rs K < "${UT_TTY:-/dev/tty}"; echo
  printf '%s\n' "$K" | docker run --rm -i -v "$O":/in:ro -v "$A":/out "$IMG" bash -c 'umask 077; cat > /dev/shm/k; n=0; for f in /in/*.age; do age -d -i /dev/shm/k -o "/out/$(basename "${f%.age}")" "$f" 2>/dev/null && n=$((n + 1)); done; rm -f /dev/shm/k; echo "$n archivos abiertos"'
  unset K; ls -lh "$A" | tail -n +2
  echo "Quedaron SIN cifrar en $A. Cuando termines:  rm -rf $A"
  exit 0 ;;
esac

exec 9> "${UT_LOCK:-/run/unitytech-respaldo.lock}"; flock -n 9 || { echo "Ya hay un respaldo corriendo."; exit 0; }
HOY="${UT_HOY:-$(date -u +%F)}"; DIR="$DEST/diario/$HOY"; NUEVO="$DEST/diario/.nuevo-$HOY"
mkdir -p "$DEST/diario" "$DEST/mensual"; chmod 700 "$DEST"
terminar() {   # BIEN|FALLO  texto
  printf '%s · %s %s UTC · %s\n' "$1" "$HOY" "$(date -u +%H:%M)" "$2" > "$DEST/estado.txt"; cat "$DEST/estado.txt"
  U=$(conf AVISO_URL); [ -n "$U" ] && curl -fsS -m 20 -o /dev/null --data-urlencode "estado=$1" --data-urlencode "detalle=$2" "$U" 2>/dev/null
  [ "$1" = BIEN ]; exit
}
LIBRE=$(df -Pm "$DEST" | awk 'NR==2 { print $4 }'); [ "${LIBRE:-0}" -ge 1500 ] || terminar FALLO "queda poco disco en el servidor (${LIBRE:-?} MB libres)"
rm -rf "$NUEVO"; mkdir -p "$NUEVO"

SAL=$(docker run --rm --network host --env-file "$ETC/respaldo.env" -e HOY="$HOY" -e SALIDA="/respaldos/diario/.nuevo-$HOY" -e LLAVE=/llave.pub \
        -v "$DEST":/respaldos -v "$LIB/respaldo-trabajo.sh":/trabajo.sh:ro -v "$ETC/respaldo.pub":/llave.pub:ro "$IMG" bash /trabajo.sh 2>&1); R=$?
printf '%s\n' "$SAL" | tail -30 > "$DEST/ultimo.log"
if [ $R -ne 0 ] || [ ! -s "$NUEVO/datos.dump.age" ]; then rm -rf "$NUEVO"; M=$(printf '%s\n' "$SAL" | grep -m1 '^FALLO: ' | cut -c8-); terminar FALLO "${M:-$(printf '%s\n' "$SAL" | tail -1)}"; fi
TXT=$(printf '%s\n' "$SAL" | grep -m1 '^BIEN' | cut -d' ' -f2-)

# n8n y lo que vive en su base (está en este mismo servidor): se cifra al vuelo, nunca queda sin cifrar en el disco
C=/opt/n8n-traefik/docker-compose.yml
if [ -f "$C" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx postgres; then
  U=$(grep -m1 DB_POSTGRESDB_USER= "$C" | sed 's/.*=//; s/[" ]//g')
  if docker exec postgres pg_dumpall -U "${U:-postgres}" 2>/dev/null | gzip | cifrar > "$NUEVO/n8n.sql.gz.age" && [ "$(stat -c %s "$NUEVO/n8n.sql.gz.age")" -gt 5000 ]; then TXT="$TXT, n8n incluido"
  else rm -f "$NUEVO/n8n.sql.gz.age"; TXT="$TXT · AVISO: n8n NO se pudo copiar"; fi
  # la instalación y la llave con la que n8n cifra sus credenciales: sin ellas, la copia de n8n no sirve
  cifrar < "$C" > "$NUEVO/n8n-compose.yml.age" || rm -f "$NUEVO/n8n-compose.yml.age"
  N=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /n8n/ { print $1; exit }')
  if [ -n "$N" ]; then docker exec "$N" cat /home/node/.n8n/config 2>/dev/null | cifrar > "$NUEVO/n8n-config.json.age" || rm -f "$NUEVO/n8n-config.json.age"; fi
fi

rm -rf "$DIR"; mv "$NUEVO" "$DIR"
# el primero de cada mes queda guardado un año
MES="$DEST/mensual/${HOY:0:7}"; [ -d "$MES" ] || cp -a "$DIR" "$MES"
# se guardan 30 días y 12 meses (solo se borra cuando el de hoy salió bien, y solo carpetas con nombre de fecha)
podar() { ls -1 "$1" 2>/dev/null | grep -E "$3" | sort | head -n -"$2" | while IFS= read -r x; do rm -rf -- "${1:?}/${x:?}"; done; }
podar "$DEST/diario" 30 '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; podar "$DEST/mensual" 12 '^[0-9]{4}-[0-9]{2}$'
# tercera copia, en otro lugar del mundo (cuando esté configurada)
RD=$(conf RCLONE_DESTINO)
if [ -n "$RD" ] && [ -s "$ETC/rclone.conf" ]; then
  if docker run --rm --network host -v "$ETC/rclone.conf":/rclone.conf:ro -v "$DEST":/respaldos:ro "$IMG" sh -c 'rclone --config /rclone.conf copy /respaldos/diario/"$1" "$2/diario/$1" && rclone --config /rclone.conf copy /respaldos/mensual "$2/mensual"' _ "$HOY" "$RD" >/dev/null 2>&1
  then TXT="$TXT, tercera copia subida"; else TXT="$TXT · AVISO: la tercera copia NO se pudo subir"; fi
fi
terminar BIEN "$TXT · $(du -sh "$DIR" | cut -f1)"
DIARIO
chmod 755 "$1"; }

# (para probar sin instalar)  bash respaldo.sh --solo-archivos /una/carpeta
if [ "${1:-}" = --solo-archivos ]; then mkdir -p "$2"; escribir_trabajo "$2/respaldo-trabajo.sh"; escribir_diario "$2/unitytech-respaldo"; exit 0; fi

# ───────── instalación ─────────
[ "$(id -u)" = 0 ] || { echo "Corré esto con sudo."; exit 1; }
command -v docker >/dev/null || { echo "Este servidor no tiene Docker. No se cambió nada."; exit 1; }
umask 077; mkdir -p "$ETC" "$DEST" "$LIB"; chmod 700 "$ETC" "$DEST"
pedir() { local x; read -rs x < /dev/tty; echo >&2; printf '%s' "$x"; }

echo "== 1. Herramientas (una imagen chica con pg_dump 17 y el cifrador)"
docker build -q -t "$IMG" - > /dev/null <<'D'
FROM postgres:17-alpine
RUN apk add --no-cache bash coreutils findutils age rclone curl jq
D
docker run --rm "$IMG" sh -c 'pg_dump --version && age --version' | tr '\n' ' '; echo

echo "== 2. Llave para cifrar"
if [ -s "$ETC/respaldo.pub" ]; then echo "Ya había una llave: se sigue usando la misma."
else
  G=$(docker run --rm "$IMG" age-keygen 2>/dev/null); PUB=$(printf '%s\n' "$G" | sed -n 's/^# public key: //p'); SEC=$(printf '%s\n' "$G" | grep '^AGE-SECRET-KEY-' || true)
  [ -n "$PUB" ] && [ -n "$SEC" ] || { echo "No se pudo crear la llave. No se cambió nada."; exit 1; }
  echo; echo "LLAVE PARA ABRIR LOS RESPALDOS · se muestra esta única vez y no queda en el servidor:"; echo; echo "    $SEC"; echo
  echo "Guardala AHORA en tu gestor de contraseñas como «Unity Tech · llave de respaldos», y una copia en papel en lugar seguro."
  echo "Sin esa llave los respaldos no los abre nadie. No la pegues en ningún chat ni la mandes por mensaje."
  while :; do printf "Para seguir, escribí las últimas 6 letras de la llave: "; read -r X < /dev/tty; [ "$X" = "${SEC: -6}" ] && break; echo "No coincide: mirá la llave de arriba."; done
  printf '%s\n' "$PUB" > "$ETC/respaldo.pub"; unset G SEC X; printf '\033[3J\033[H\033[2J'; echo "Llave guardada por vos. En el servidor quedó solo la mitad que cifra."
fi

echo "== 3. Entrada a la base de datos"
if [ -s "$ETC/respaldo.env" ]; then echo "Ya estaba configurada: se deja como está. (Para cambiarla: borrá $ETC/respaldo.env y corré esto de nuevo.)"
else
  echo "Pegá la contraseña de la base de Supabase y apretá Enter (no se ve al pegar)."
  echo "Si no la tenés: https://supabase.com/dashboard/project/$REF/database/settings → «Reset database password»."
  P=$(pedir); [ -n "$P" ] || { echo "No se pegó nada. No se configuró la base."; exit 1; }
  E=$(mktemp); H=""; for c in "db.$REF.supabase.co postgres" "aws-0-sa-east-1.pooler.supabase.com postgres.$REF" "aws-1-sa-east-1.pooler.supabase.com postgres.$REF"; do
    set -- $c
    if PGPASSWORD="$P" docker run --rm --network host -e PGPASSWORD -e PGSSLMODE=require -e PGCONNECT_TIMEOUT=8 "$IMG" psql -X -At -h "$1" -p 5432 -U "$2" -d postgres -c 'select 1' > /dev/null 2> "$E"; then H="$1"; USR="$2"; break; fi
  done
  [ -n "$H" ] || { echo "No se pudo entrar a la base. Último error: $(tail -1 "$E")"; echo "Si dice «password authentication failed», la contraseña no es. No se guardó nada."; rm -f "$E"; exit 1; }
  rm -f "$E"; echo "Entró por $H."
  echo "Ahora la llave secreta de Supabase, para copiar también las fotos y los PDF. Está en"
  echo "https://supabase.com/dashboard/project/$REF/settings/api-keys → «Secret keys» (empieza con sb_secret_)."
  echo "Pegala y Enter (o solo Enter para dejar los archivos para después):"
  K=$(pedir)
  if [ -n "$K" ]; then
    CAB=(-H "apikey: $K"); case "$K" in sb_*) ;; *) CAB+=(-H "Authorization: Bearer $K") ;; esac
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "${CAB[@]}" "https://$REF.supabase.co/storage/v1/bucket")" = 200 ]; then echo "Llave aceptada."; else echo "Supabase no aceptó esa llave: se sigue sin copiar archivos (se puede agregar después)."; K=""; fi
  fi
  printf 'PGHOST=%s\nPGPORT=5432\nPGUSER=%s\nPGPASSWORD=%s\nSB_URL=https://%s.supabase.co\nSB_SECRET_KEY=%s\nAVISO_URL=\nRCLONE_DESTINO=\n' "$H" "$USR" "$P" "$REF" "$K" > "$ETC/respaldo.env"
  chmod 600 "$ETC/respaldo.env"; unset P K
fi

echo "== 4. Programa de todas las noches (03:40 de Uruguay)"
escribir_trabajo "$LIB/respaldo-trabajo.sh"; escribir_diario /usr/local/bin/unitytech-respaldo
cat > /etc/systemd/system/unitytech-respaldo.service <<'U'
[Unit]
Description=Respaldo cifrado de Unity Tech
[Service]
Type=oneshot
ExecStart=/usr/local/bin/unitytech-respaldo
U
cat > /etc/systemd/system/unitytech-respaldo.timer <<'U'
[Unit]
Description=Respaldo cifrado de Unity Tech, todas las noches
[Timer]
OnCalendar=*-*-* 06:40:00 UTC
Persistent=true
[Install]
WantedBy=timers.target
U
systemctl daemon-reload && systemctl enable --now unitytech-respaldo.timer > /dev/null 2>&1
echo "Programado: $(systemctl is-active unitytech-respaldo.timer)"

echo "== 5. Primer respaldo, ahora (tarda un par de minutos)"
/usr/local/bin/unitytech-respaldo || true
echo
/usr/local/bin/unitytech-respaldo estado
echo "Si arriba dice BIEN, ya hay respaldo. Copiá esas líneas y pasáselas a Claude (no tienen nada secreto)."
