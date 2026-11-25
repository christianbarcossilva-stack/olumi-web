# junta los binarios de Mac de Intel y de Apple en uno solo (lo mismo que lipo, que no hay en Linux)
import struct, sys
salida, partes = sys.argv[1], sys.argv[2:]
CPU = {0x01000007: 3, 0x0100000c: 0}  # x86_64, arm64 → subtipo
datos = []
for p in partes:
    b = open(p, 'rb').read(); cpu = struct.unpack('<I', b[4:8])[0]; datos.append((cpu, CPU[cpu], b))
ALIN = 14  # 16 KB
cab = struct.pack('>II', 0xcafebabe, len(datos)); off = 4096; tabla = b''; cuerpo = []
for cpu, sub, b in datos:
    off = (off + (1 << ALIN) - 1) & ~((1 << ALIN) - 1)
    tabla += struct.pack('>IIIII', cpu, sub, off, len(b), ALIN); cuerpo.append((off, b)); off += len(b)
out = bytearray(off); out[0:len(cab + tabla)] = cab + tabla
for o, b in cuerpo: out[o:o + len(b)] = b
open(salida, 'wb').write(out); print(salida, len(out))
