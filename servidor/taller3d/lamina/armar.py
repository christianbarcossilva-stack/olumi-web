# arma la lámina de comparación (antes / ahora) con las fotos de fotos.sh
from PIL import Image, ImageDraw, ImageFont
import os; L = os.environ.get('SALIDA', '/tmp/lamina') + '/'
F = lambda s, w='SemiBold': ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-%s.otf' % w, s)
W = 2240; fondo = (246, 246, 248); tinta = (29, 29, 31); gris = (110, 110, 115); naranja = (255, 122, 26)
im = lambda n: Image.open(L + n).convert('RGB')
bloques = []
def cabeza(t, sub=None, h=120):
    c = Image.new('RGB', (W, h), fondo); d = ImageDraw.Draw(c)
    d.text((40, 28), t, font=F(46), fill=tinta)
    if sub: d.text((40, 82), sub, font=F(26, 'Regular'), fill=gris)
    return c
def rotulo(img, t, color=tinta):
    d = ImageDraw.Draw(img); f = F(30); w = d.textlength(t, font=f)
    d.rounded_rectangle((20, 20, 20 + w + 36, 74), 27, fill=(255, 255, 255)); d.text((38, 30), t, font=f, fill=color); return img
def fila(*imgs):
    h = max(i.size[1] for i in imgs); c = Image.new('RGB', (W, h), fondo); x = 0
    for i in imgs: c.paste(i, (x, 0)); x += i.size[0]
    return c
bloques.append(cabeza('Personas 3D · 15/11', 'Izquierda: lo que está hoy en la beta · Derecha: lo nuevo'))
af, al, bf, bl = im('a-frente.png'), im('a-lado.png'), im('b-frente.png'), im('b-lado.png')
rotulo(af, 'Antes'); rotulo(bf, 'Ahora', naranja)
bloques.append(fila(af, al, bf, bl))
bloques.append(cabeza('Piernas rectas · brazos al costado · manos relajadas', None, 90))
am, bm = im('a-mano.png'), im('b-mano.png'); rotulo(am, 'Antes'); rotulo(bm, 'Ahora', naranja)
txt = Image.new('RGB', (1120, 560), fondo); d = ImageDraw.Draw(txt); y = 40
for t in ('Rodillas: de 13° flojas a 5°', 'Mano al costado del muslo (no adelante)', 'Dedos juntos, pulgar apoyado', 'Ropa con relieve y sombras en los pliegues', 'Sin manchas del zapato en el jean'):
    d.ellipse((40, y + 10, 56, y + 26), fill=naranja); d.text((76, y), t, font=F(34, 'Medium'), fill=tinta); y += 92
bloques.append(fila(am, bm, txt))
mu, te = im('mujeres.png'), im('tecnicos.png'); rotulo(mu, 'Mujeres: pollera y pantalón (nueva)', naranja); rotulo(te, 'Técnicos')
bloques.append(cabeza('Más variedad', None, 90)); bloques.append(fila(mu, te))
po = im('poses.png'); rotulo(po, 'Parada · caminando · sentada · al teclado')
bloques.append(fila(po))
H = sum(b.size[1] for b in bloques) + 40; out = Image.new('RGB', (W, H), fondo); y = 0
for b in bloques: out.paste(b, (0, y)); y += b.size[1]
out.save(L + 'lamina-v106.png'); out.resize((W // 2, H // 2), Image.LANCZOS).save(L + 'lamina-v106-chica.jpg', quality=90); print('LAMINA', out.size)
