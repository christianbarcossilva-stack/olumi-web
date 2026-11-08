#!/bin/bash
# Pasa el rediseño de la vista previa (/nuevo/) a las páginas definitivas.
# Uso (desde la raíz del repo): bash servidor/web/pasar-nuevo.sh && git add -A && git commit -m "Web: rediseño v3 en vivo" && git push
set -e
cd "$(dirname "$0")/../.."
[ -d nuevo ] || { echo "No hay carpeta nuevo/"; exit 1; }
cp nuevo/familia.css familia.css
cp nuevo/familia.js familia.js
cp nuevo/index.html index.html
cp nuevo/olumi/index.html olumi/index.html
cp nuevo/olumi/privacidad.html olumi/privacidad.html
cp nuevo/olumi/terminos.html olumi/terminos.html
cp nuevo/ondi/index.html ondi/index.html
cp nuevo/estiba/index.html estiba/index.html
# la vista previa llevaba noindex; en definitivo solo Estiba lo conserva (sigue siendo vista previa del producto)
for f in index.html olumi/index.html ondi/index.html olumi/privacidad.html olumi/terminos.html; do
  sed -i '/<meta name="robots" content="noindex"><!-- vista previa: sacar al pasar a definitivo -->/d' "$f"
done
sed -i 's|<meta name="robots" content="noindex"><!-- vista previa: sacar al pasar a definitivo -->||' estiba/index.html
rm -rf nuevo
echo "Listo: páginas definitivas actualizadas y /nuevo/ eliminada."
