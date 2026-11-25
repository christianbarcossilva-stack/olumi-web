# el .ico de Windows y el .icns de Mac a partir de los PNG
import io, struct, sys
from PIL import Image
d = sys.argv[1]
w = Image.open(d + '/win.png').convert('RGBA')
w.save(d + '/ondi.ico', sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256)])
m = Image.open(d + '/mac.png').convert('RGBA')
partes = b''
for tipo, tam in ((b'ic10', 1024), (b'ic09', 512), (b'ic08', 256), (b'ic07', 128), (b'ic14', 512), (b'ic13', 256), (b'ic12', 64), (b'ic11', 32)):
    b = io.BytesIO(); m.resize((tam, tam), Image.LANCZOS).save(b, 'PNG'); x = b.getvalue()
    partes += tipo + struct.pack('>I', 8 + len(x)) + x
open(d + '/ondi.icns', 'wb').write(b'icns' + struct.pack('>I', 8 + len(partes)) + partes)
print('ok')
