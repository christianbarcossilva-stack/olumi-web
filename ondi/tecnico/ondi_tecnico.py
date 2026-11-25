#!/usr/bin/env python3
"""Ondi Técnico: el ayudante que corre en la laptop del técnico.

Ondi (en el navegador) no puede tirar ping ni recorrer una red: el navegador no lo deja.
Este programa sí, y le pasa los resultados a Ondi. Solo escucha en esta misma compu (127.0.0.1),
solo acepta pedidos de Ondi y solo después de poner el código de emparejado que muestra al arrancar.
No instala nada, no guarda claves y no manda nada a internet (salvo bajar una vez la lista oficial
de fabricantes de placas de red de la IEEE, para reconocer las marcas en el escaneo).

Uso:  Windows: doble clic en este archivo (hace falta Python 3 de python.org).
      Mac / Linux: en la Terminal, python3 ondi_tecnico.py
"""
import concurrent.futures as cf
import ipaddress
import json
import os
import platform
import random
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = '1.1'
PUERTO = 47800
WIN, MAC = os.name == 'nt', sys.platform == 'darwin'
ENC = 'oem' if WIN else 'utf-8'
ORIGENES = re.compile(r'^(https://(www\.)?unitytech\.uy|http://(127\.0\.0\.1|localhost)(:\d+)?)$')
CASA = os.path.expanduser('~')
CONF = os.path.join(CASA, '.ondi_tecnico.json')
OUI_TXT = os.path.join(CASA, '.ondi_tecnico_oui.txt')
HOST_OK = re.compile(r'^[A-Za-z0-9][A-Za-z0-9.\-:]{0,252}$')
NOWIN = subprocess.CREATE_NO_WINDOW if WIN else 0

# ---------- código de emparejado: queda guardado para no tener que ponerlo cada vez ----------
def conf():
    try:
        with open(CONF, encoding='utf-8') as f: c = json.load(f)
    except Exception: c = {}
    if not re.fullmatch(r'\d{6}', str(c.get('codigo', ''))):
        c['codigo'] = '%06d' % random.SystemRandom().randrange(10 ** 6)
        try:
            with open(CONF, 'w', encoding='utf-8') as f: json.dump(c, f)
        except Exception: pass
    return c
CODIGO = conf()['codigo']

# ---------- fabricantes por los primeros 3 bytes de la MAC ----------
OUI = {}
for p, n in {
    'Hikvision': '4419B6 C056E3 BCAD28 4CBD8F 2857BE 540C4D 8CE748 A41437 E0BAAD 849A40 B4A382 18684A 24480F 5850ED',
    'Dahua': '3CEF8C 9002A9 E0508B 4C11BF 14A78B BC325F 3CE36B 6C1C71 A0BD1D 38AF29',
    'Ubiquiti': '24A43C 44D9E7 687251 788A20 802AA8 F09FC2 FCECDA 7483C2 E063DA 18E829 B4FBE4 602232 70A741 D8B370 9C05D6 0CEA14 245A4C 784558 AC8BA9 D021F9',
    'MikroTik': '4C5E0C 64D154 6C3B6B B869F4 CC2DE0 D4CA6D E48D8C 488F5A 2CC81B 18FD74 DC2C6E 085531 744D28 C4AD34',
    'TP-Link': '50C7BF 60E327 98DAC4 B04E26 C006C3 E848B8 30B5C2 54AF97 3C846A 5C628B A842A1 1027F5 F4F26D 14EBB6',
    'Raspberry Pi': 'B827EB DCA632 E45F01 D83ADD 2CCF67',
    'Espressif (Sonoff y otros IoT)': '240AC4 30AEA4 84F3EB A4CF12 BCDDC2 2CF432 DC4F22 C82B96 600194 ECFABC 483FDA',
}.items():
    for x in p.split(): OUI[x] = n

def cargar_oui():
    """La lista oficial de la IEEE (unos 5 MB). Se baja una sola vez y queda en la carpeta del usuario."""
    if not os.path.exists(OUI_TXT) or os.path.getsize(OUI_TXT) < 100000:
        try:
            q = urllib.request.Request('https://standards-oui.ieee.org/oui/oui.txt', headers={'User-Agent': 'Mozilla/5.0 OndiTecnico'})
            with urllib.request.urlopen(q, timeout=25) as r, open(OUI_TXT, 'wb') as f: f.write(r.read())
        except Exception: return
    try:
        with open(OUI_TXT, encoding='utf-8', errors='replace') as f:
            for ln in f:
                m = re.match(r'^([0-9A-F]{6})\s+\(base 16\)\s+(.+)$', ln.strip())
                if m and m.group(1) not in OUI: OUI[m.group(1)] = m.group(2).strip()
    except Exception: pass
threading.Thread(target=cargar_oui, daemon=True).start()

def fabricante(mac):
    if not mac: return ''
    h = mac.replace(':', '').upper()
    if len(h) >= 2 and h[1] in '26AE': return 'MAC privada (celular o compu)'
    return OUI.get(h[:6], '')

# ---------- la red de esta compu ----------
def mi_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1)); return s.getsockname()[0]
    except Exception: return '127.0.0.1'
    finally: s.close()

def redes():
    ip = mi_ip()
    return [{'ip': ip, 'red': str(ipaddress.ip_network(ip + '/24', strict=False))}] if ip != '127.0.0.1' else []

def correr(args, timeout=8):
    try:
        return subprocess.run(args, capture_output=True, timeout=timeout, creationflags=NOWIN).stdout.decode(ENC, 'replace')
    except Exception: return ''

def tabla_arp():
    out = correr(['arp', '-a']) or correr(['ip', 'neigh'])
    t = {}
    for ln in out.splitlines():
        ip = re.search(r'(\d{1,3}(?:\.\d{1,3}){3})', ln)
        mac = re.search(r'([0-9A-Fa-f]{1,2}(?:[:-][0-9A-Fa-f]{1,2}){5})', ln)
        if ip and mac:
            m = ':'.join(x.zfill(2) for x in re.split('[:-]', mac.group(1))).upper()
            if m not in ('FF:FF:FF:FF:FF:FF', '00:00:00:00:00:00'): t[ip.group(1)] = m
    return t

def banda_de(mhz=0, canal=0, txt=''):
    t = str(txt).lower()
    if mhz: return '2.4' if mhz < 3000 else '5' if mhz < 5925 else '6'
    if '6g' in t or '6 g' in t: return '6'
    if '5g' in t or '5 g' in t: return '5'
    if '2.4' in t or '2,4' in t: return '2.4'
    c = int(canal or 0)
    return '2.4' if 0 < c <= 14 else '5' if c else ''

def wifi_windows():
    """Windows: la API nativa (wlanapi). Da la señal de cada access point en dBm reales y pide un escaneo nuevo."""
    import ctypes, ctypes.wintypes as W
    wl = ctypes.windll.wlanapi
    class GUID(ctypes.Structure): _fields_ = [('a', W.DWORD), ('b', W.WORD), ('c', W.WORD), ('d', ctypes.c_ubyte * 8)]
    class IFI(ctypes.Structure): _fields_ = [('guid', GUID), ('desc', ctypes.c_wchar * 256), ('estado', ctypes.c_uint)]
    class IFL(ctypes.Structure): _fields_ = [('n', W.DWORD), ('i', W.DWORD), ('info', IFI * 64)]
    class SSID(ctypes.Structure): _fields_ = [('largo', ctypes.c_ulong), ('ssid', ctypes.c_ubyte * 32)]
    class TASAS(ctypes.Structure): _fields_ = [('n', ctypes.c_ulong), ('t', ctypes.c_ushort * 126)]
    class BSS(ctypes.Structure): _fields_ = [('ssid', SSID), ('phy', ctypes.c_ulong), ('bssid', ctypes.c_ubyte * 6), ('tipo', ctypes.c_uint), ('phytipo', ctypes.c_uint),
        ('rssi', ctypes.c_long), ('calidad', ctypes.c_ulong), ('reg', ctypes.c_ubyte), ('beacon', ctypes.c_ushort), ('ts', ctypes.c_ulonglong), ('hts', ctypes.c_ulonglong),
        ('cap', ctypes.c_ushort), ('khz', ctypes.c_ulong), ('tasas', TASAS), ('ieoff', ctypes.c_ulong), ('ielen', ctypes.c_ulong)]
    class BSSL(ctypes.Structure): _fields_ = [('total', W.DWORD), ('n', W.DWORD), ('e', BSS * 1)]
    if not hasattr(wifi_windows, 'h'):
        h, ver = W.HANDLE(), W.DWORD()
        if wl.WlanOpenHandle(2, None, ctypes.byref(ver), ctypes.byref(h)): raise OSError('wlan')
        wifi_windows.h, wifi_windows.ult = h, 0
    h = wifi_windows.h
    pl = ctypes.POINTER(IFL)()
    if wl.WlanEnumInterfaces(h, None, ctypes.byref(pl)): raise OSError('wlan')
    try:
        if not pl.contents.n: return None
        guid = GUID.from_buffer_copy(pl.contents.info[0].guid)
    finally: wl.WlanFreeMemory(pl)
    if time.time() - wifi_windows.ult > 3.5:  # Windows tarda unos 3 segundos en escanear: se pide cada 4
        wl.WlanScan(h, ctypes.byref(guid), None, None, None); wifi_windows.ult = time.time()
    redes = []
    pb = ctypes.c_void_p()
    if not wl.WlanGetNetworkBssList(h, ctypes.byref(guid), None, 3, False, None, ctypes.byref(pb)) and pb.value:
        try:
            n = ctypes.cast(pb, ctypes.POINTER(BSSL)).contents.n
            arr = ctypes.cast(pb.value + BSSL.e.offset, ctypes.POINTER(BSS * n)).contents if n else []
            for e in arr:
                mhz = e.khz // 1000
                canal = (mhz - 2407) // 5 if mhz < 3000 else (mhz - 5950) // 5 if mhz >= 5955 else (mhz - 5000) // 5
                redes.append({'ssid': bytes(e.ssid.ssid[:e.ssid.largo]).decode('utf-8', 'replace'), 'bssid': ':'.join('%02X' % x for x in e.bssid),
                              'rssi': int(e.rssi), 'canal': int(canal), 'banda': banda_de(mhz)})
        finally: wl.WlanFreeMemory(pb)
    act = {}
    out = correr(['netsh', 'wlan', 'show', 'interfaces'], 4)
    m = re.search(r'^\s*SSID\s*:\s*(.+)$', out, re.M); b = re.search(r'BSSID\s*:\s*(\S+)', out)
    if m: act['ssid'] = m.group(1).strip()
    if b: act['bssid'] = b.group(1).upper().replace('-', ':')
    pr, sz = ctypes.c_void_p(), W.DWORD()
    if not wl.WlanQueryInterface(h, ctypes.byref(guid), 0x10000102, None, ctypes.byref(sz), ctypes.byref(pr), None) and pr.value:  # la señal de la conexión, al momento
        try: act['rssi'] = ctypes.cast(pr, ctypes.POINTER(ctypes.c_long)).contents.value
        finally: wl.WlanFreeMemory(pr)
    yo = next((r for r in redes if act.get('bssid') and r['bssid'] == act['bssid']), None)
    if yo: act.update(canal=yo['canal'], banda=yo['banda']); act.setdefault('rssi', yo['rssi'])
    return {'fuente': 'Windows', 'exacto': True, 'actual': act, 'redes': redes}

def wifi_netsh():
    """Windows sin la API: lo que muestra netsh (la señal viene en %, se pasa a dBm como hace Windows)."""
    a = correr(['netsh', 'wlan', 'show', 'interfaces'], 4); out = correr(['netsh', 'wlan', 'show', 'networks', 'mode=bssid'], 6)
    redes, ssid = [], ''
    for ln in out.splitlines():
        m = re.match(r'^SSID \d+\s*:\s*(.*)$', ln.strip())
        if m: ssid = m.group(1).strip(); cur = None; continue
        m = re.match(r'^BSSID \d+\s*:\s*(\S+)', ln.strip())
        if m: cur = {'ssid': ssid, 'bssid': m.group(1).upper().replace('-', ':'), 'rssi': None, 'canal': 0, 'banda': ''}; redes.append(cur); continue
        if redes:
            cur = redes[-1]
            m = re.search(r'(?:Signal|Se.al)\s*:\s*(\d+)%', ln, re.I)
            if m: cur['rssi'] = round(int(m.group(1)) / 2 - 100)
            m = re.search(r'(?:Channel|Canal)\s*:\s*(\d+)', ln, re.I)
            if m: cur['canal'] = int(m.group(1)); cur['banda'] = cur['banda'] or banda_de(canal=cur['canal'])
            m = re.search(r'(?:Band|Banda)\s*:\s*(.+)$', ln, re.I)
            if m: cur['banda'] = banda_de(txt=m.group(1)) or cur['banda']
    act = {}
    for k, rx in (('ssid', r'^\s*SSID\s*:\s*(.+)$'), ('bssid', r'BSSID\s*:\s*(\S+)'), ('canal', r'(?:Channel|Canal)\s*:\s*(\d+)'), ('senal', r'(?:Signal|Se.al)\s*:\s*(\d+)%')):
        m = re.search(rx, a, re.M | re.I)
        if m: act[k] = m.group(1).strip()
    if 'senal' in act: act['rssi'] = round(int(act.pop('senal')) / 2 - 100)
    if 'bssid' in act: act['bssid'] = act['bssid'].upper().replace('-', ':')
    if 'canal' in act: act['canal'] = int(act['canal']); act['banda'] = banda_de(canal=act['canal'])
    return {'fuente': 'Windows (netsh)', 'exacto': False, 'actual': act, 'redes': [r for r in redes if r['rssi'] is not None]}

def wifi_mac():
    """Mac: system_profiler. Da señal y ruido en dBm; desde macOS 14 no muestra la MAC de los otros equipos."""
    try: d = json.loads(correr(['system_profiler', 'SPAirPortDataType', '-json'], 25) or '{}')
    except Exception: return None
    def uno(x):
        sn = re.findall(r'-?\d+', str(x.get('spairport_signal_noise', '')))
        ch = str(x.get('spairport_network_channel', '')); mc = re.match(r'(\d+)', ch)
        return {'ssid': x.get('_name', ''), 'bssid': x.get('spairport_network_bssid', ''), 'rssi': int(sn[0]) if sn else None, 'ruido': int(sn[1]) if len(sn) > 1 else None,
                'canal': int(mc.group(1)) if mc else 0, 'banda': banda_de(txt=ch) or banda_de(canal=mc.group(1) if mc else 0)}
    act, redes = {}, []
    for it in d.get('SPAirPortDataType', []):
        for i in it.get('spairport_airport_interfaces', []):
            if i.get('spairport_current_network_information'): act = uno(i['spairport_current_network_information'])
            redes += [uno(x) for x in i.get('spairport_airport_other_local_wireless_networks', [])]
    if act: redes.append(dict(act))
    return {'fuente': 'Mac', 'exacto': True, 'actual': act, 'redes': [r for r in redes if r['rssi'] is not None]}

def wifi_linux():
    out = correr(['nmcli', '-t', '-f', 'IN-USE,SSID,BSSID,SIGNAL,CHAN,FREQ', 'dev', 'wifi', 'list', '--rescan', 'auto'], 10)
    act, redes = {}, []
    for ln in out.splitlines():
        p = [x.replace('\\:', ':') for x in re.split(r'(?<!\\):', ln)]
        if len(p) < 6: continue
        mhz = int(re.sub(r'\D', '', p[5]) or 0)
        r = {'ssid': p[1], 'bssid': p[2].upper(), 'rssi': round(int(p[3] or 0) / 2 - 100), 'canal': int(p[4] or 0), 'banda': banda_de(mhz, p[4])}
        redes.append(r)
        if p[0] == '*': act = dict(r)
    return {'fuente': 'Linux (nmcli)', 'exacto': False, 'actual': act, 'redes': redes}

def wifi_leer():
    if WIN:
        try:
            d = wifi_windows()
            if d: return d
        except Exception: pass
        return wifi_netsh()
    if MAC: return wifi_mac() or {'actual': {}, 'redes': []}
    return wifi_linux()

class Muestreo:
    """Mientras Ondi pide la señal (caminando el lugar), lee el wifi sin parar y guarda la última lectura."""
    def __init__(self): self.ult, self.seq, self.pedido, self.hilo, self.lock = None, 0, 0, None, threading.Lock()
    def leer(self):
        self.pedido = time.time()
        with self.lock:
            if not self.hilo or not self.hilo.is_alive(): self.hilo = threading.Thread(target=self.bucle, daemon=True); self.hilo.start()
        t0 = time.time()
        while self.ult is None and time.time() - t0 < 30: time.sleep(0.2)
        return self.ult or {'actual': {}, 'redes': [], 'seq': 0}
    def bucle(self):
        while time.time() - self.pedido < 45:  # si Ondi deja de pedir, se frena solo
            t0 = time.time()
            try:
                d = wifi_leer(); self.seq += 1; d.update(seq=self.seq, t=round(time.time(), 2), v=VERSION); self.ult = d
            except Exception: pass
            time.sleep(max(0.2, 1.0 - (time.time() - t0)))
        self.hilo = None
MUESTREO = Muestreo()

def wifi():
    """Compatibilidad con Ondi 1.0: la red a la que está conectada esta compu."""
    d = MUESTREO.leer(); a = dict(d.get('actual') or {}); return a

# ---------- un equipo de la red ----------
PUERTOS = [80, 443, 554, 8000, 37777, 22, 23, 8080, 8291, 8443, 161, 5000, 9000, 3389, 445, 1883]
QUE = {80: 'web', 443: 'web segura', 554: 'video RTSP', 8000: 'Hikvision', 37777: 'Dahua', 22: 'SSH', 23: 'Telnet', 8080: 'web', 8291: 'Winbox',
       8443: 'web segura', 161: 'SNMP', 5000: 'web', 9000: 'web', 3389: 'escritorio remoto', 445: 'carpetas compartidas', 1883: 'MQTT'}

def tcp(ip, p, t=0.45):
    """Devuelve (abierto, el equipo existe). Un rechazo también prueba que el equipo está."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.settimeout(t)
    try:
        s.connect((ip, p)); return True, True
    except ConnectionRefusedError: return False, True
    except Exception: return False, False
    finally: s.close()

def ping1(ip):
    a = ['ping', '-n', '1', '-w', '600', ip] if WIN else ['ping', '-c', '1', '-W', '1' if not MAC else '600', ip]
    t0 = time.time()
    try:
        r = subprocess.run(a, capture_output=True, timeout=3, creationflags=NOWIN)
        txt = r.stdout.decode(ENC, 'replace')
        ok = r.returncode == 0 and ('TTL=' in txt.upper())
        m = re.search(r'(?:time|tiempo)[=<]\s*([\d.,]+)\s*ms', txt, re.I)
        return ok, (float(m.group(1).replace(',', '.')) if m else round((time.time() - t0) * 1000)) if ok else None
    except Exception: return False, None

def titulo_web(ip, puertos):
    for p in (80, 8080, 443, 8443):
        if p not in puertos: continue
        try:
            import ssl
            ctx = ssl._create_unverified_context()  # los equipos de red casi siempre tienen certificado propio
            u = ('https' if p in (443, 8443) else 'http') + '://%s:%d/' % (ip, p)
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'OndiTecnico'}), timeout=1.5, context=ctx) as r:
                srv, html = r.headers.get('Server', ''), r.read(6000).decode('utf-8', 'replace')
            m = re.search(r'<title[^>]*>(.*?)</title>', html, re.I | re.S)
            return (m.group(1).strip()[:60] if m else ''), srv[:40]
        except Exception: continue
    return '', ''

def tipo_de(fab, puertos, tit, srv):
    t = (fab + ' ' + tit + ' ' + srv).lower()
    if 8291 in puertos or 'mikrotik' in t or 'routeros' in t: return 'router'
    if 37777 in puertos or 554 in puertos or 8000 in puertos or 'hikvision' in t or 'dahua' in t or 'nvr' in t or 'dvr' in t: return 'camara'
    if 'unifi' in t or 'ubiquiti' in t: return 'ap'
    if 'espressif' in t or 1883 in puertos: return 'sensor_puerta'
    if 3389 in puertos or 445 in puertos or 'privada' in t: return 'otro'
    if 'router' in t or 'gateway' in t: return 'router'
    return 'otro'

def explorar(ip, con_puertos):
    vivo, ms = ping1(ip)
    abiertos = []
    primeros = [80, 443, 554]
    with cf.ThreadPoolExecutor(len(primeros)) as ex:
        for p, (ab, esta) in zip(primeros, ex.map(lambda p: tcp(ip, p), primeros)):
            vivo = vivo or esta
            if ab: abiertos.append(p)
    if not vivo: return None
    if con_puertos:
        resto = [p for p in PUERTOS if p not in primeros]
        with cf.ThreadPoolExecutor(8) as ex:
            for p, (ab, _) in zip(resto, ex.map(lambda p: tcp(ip, p, 0.6), resto)):
                if ab: abiertos.append(p)
    nombre = ''
    try:
        socket.setdefaulttimeout(1.0); nombre = socket.gethostbyaddr(ip)[0]
    except Exception: pass
    finally: socket.setdefaulttimeout(None)
    tit, srv = titulo_web(ip, abiertos)
    return {'ip': ip, 'ms': ms, 'nombre': nombre, 'puertos': sorted(abiertos), 'web': tit, 'servidor': srv}

# ---------- comandos de la consola ----------
def comando(c, a, n):
    a = (a or '').strip()
    if c in ('ping', 'traza', 'dns', 'puerto') and not HOST_OK.match(a.split(' ')[0] if c == 'puerto' else a): raise ValueError('Dirección inválida')
    n = max(1, min(int(n or 4), 100))
    if c == 'ping': return ['ping', '-n' if WIN else '-c', str(n), a]
    if c == 'traza': return ['tracert', '-d', '-h', '20', a] if WIN else ['traceroute', '-n', '-m', '20', a]
    if c == 'dns': return ['nslookup', a]
    if c == 'ip': return ['ipconfig', '/all'] if WIN else ['ifconfig'] if MAC else ['ip', 'addr']
    if c == 'arp': return ['arp', '-a']
    raise ValueError('Comando desconocido')

class Pedido(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass

    def cors(self):
        o = self.headers.get('Origin', '')
        if ORIGENES.match(o): self.send_header('Access-Control-Allow-Origin', o); self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Ondi-Codigo')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def origen_ok(self):
        o = self.headers.get('Origin', '')
        return not o or ORIGENES.match(o)

    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.send_header('Content-Length', '0'); self.end_headers()

    def json(self, d, cod=200):
        b = json.dumps(d).encode()
        self.send_response(cod); self.cors(); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def abrir_flujo(self, tipo):
        self.send_response(200); self.cors(); self.send_header('Content-Type', tipo); self.send_header('Cache-Control', 'no-store')
        self.send_header('Transfer-Encoding', 'chunked'); self.end_headers()

    def trozo(self, s):
        b = s.encode('utf-8')
        if b: self.wfile.write(b'%x\r\n%s\r\n' % (len(b), b)); self.wfile.flush()

    def cerrar_flujo(self):
        try: self.wfile.write(b'0\r\n\r\n'); self.wfile.flush()
        except Exception: pass

    def leer(self):
        n = int(self.headers.get('Content-Length') or 0)
        try: return json.loads(self.rfile.read(n) or b'{}') if n else {}
        except Exception: return {}

    def do_GET(self):
        if not self.origen_ok(): return self.json({'error': 'origen'}, 403)
        if self.path.startswith('/hola'):
            return self.json({'ok': True, 'version': VERSION, 'so': platform.system() + ' ' + platform.release(), 'equipo': socket.gethostname(),
                              'redes': redes(), 'emparejado': self.headers.get('X-Ondi-Codigo') == CODIGO})
        if self.headers.get('X-Ondi-Codigo') != CODIGO: return self.json({'error': 'codigo'}, 401)
        if self.path.startswith('/wifi'): return self.json(MUESTREO.leer())
        self.json({'error': 'no existe'}, 404)

    def do_POST(self):
        if not self.origen_ok(): return self.json({'error': 'origen'}, 403)
        if self.headers.get('X-Ondi-Codigo') != CODIGO: return self.json({'error': 'codigo'}, 401)
        d = self.leer()
        if self.path.startswith('/cmd'): return self.cmd(d)
        if self.path.startswith('/escanear'): return self.escanear(d)
        self.json({'error': 'no existe'}, 404)

    def cmd(self, d):
        c = d.get('c')
        if c == 'puerto':
            try: host, p = str(d.get('a', '')).split()[:2]; p = int(p)
            except Exception: return self.json({'error': 'Escribí: puerto <dirección> <número>'}, 400)
            if not HOST_OK.match(host) or not 0 < p < 65536: return self.json({'error': 'Dirección inválida'}, 400)
            self.abrir_flujo('text/plain; charset=utf-8')
            try:
                t0 = time.time(); ip = socket.gethostbyname(host); ab, esta = tcp(ip, p, 2.5); ms = round((time.time() - t0) * 1000)
                self.trozo('Puerto %d en %s (%s): %s (%d ms)\n' % (p, host, ip, 'abierto' if ab else 'cerrado, el equipo responde' if esta else 'sin respuesta', ms))
            except Exception as e: self.trozo('No se pudo: %s\n' % e)
            return self.cerrar_flujo()
        if c == 'wifi':
            self.abrir_flujo('text/plain; charset=utf-8')
            w = wifi()
            self.trozo(('\n'.join('%s: %s' % (k, v) for k, v in w.items()) or 'Esta compu no está conectada por wifi o no se pudo leer.') + '\n')
            return self.cerrar_flujo()
        try: args = comando(c, d.get('a'), d.get('n'))
        except ValueError as e: return self.json({'error': str(e)}, 400)
        self.abrir_flujo('text/plain; charset=utf-8')
        try: pr = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, creationflags=NOWIN)
        except FileNotFoundError:
            self.trozo('Esta compu no tiene el comando «%s».\n' % args[0]); return self.cerrar_flujo()
        try:
            for ln in iter(pr.stdout.readline, b''): self.trozo(ln.decode(ENC, 'replace').replace('\r\n', '\n'))
            pr.wait(); self.cerrar_flujo()
        except Exception: pr.kill()  # Ondi cortó (botón Parar o cerró la pestaña)

    def escanear(self, d):
        try:
            red = ipaddress.ip_network(str(d.get('red', '')), strict=False)
            if red.version != 4 or red.num_addresses > 1024: raise ValueError
        except Exception: return self.json({'error': 'Poné una red como 192.168.1.0/24 (hasta 1024 direcciones)'}, 400)
        ips = [str(x) for x in (red.hosts() if red.num_addresses > 2 else red)]
        self.abrir_flujo('application/x-ndjson')
        enviar = lambda o: self.trozo(json.dumps(o) + '\n')
        try:
            enviar({'t': 'inicio', 'total': len(ips), 'red': str(red)})
            hallados, hechos, t0 = [], 0, time.time()
            with cf.ThreadPoolExecutor(48) as ex:
                for r in ex.map(lambda ip: explorar(ip, d.get('puertos', True)), ips):
                    hechos += 1
                    if r: hallados.append(r)
                    if hechos % 16 == 0 or hechos == len(ips): enviar({'t': 'avance', 'hechos': hechos})
            arp = tabla_arp(); yo = mi_ip()
            for r in sorted(hallados, key=lambda r: tuple(int(x) for x in r['ip'].split('.'))):
                r['mac'] = arp.get(r['ip'], '') if r['ip'] != yo else ''
                r['fab'] = fabricante(r['mac']) if r['ip'] != yo else 'Esta compu'
                r['tipo'] = tipo_de(r['fab'], r['puertos'], r['web'], r['servidor'])
                r['que'] = [QUE.get(p, str(p)) for p in r['puertos']]
                enviar(dict(r, t='equipo'))
            enviar({'t': 'fin', 'encontrados': len(hallados), 'seg': round(time.time() - t0, 1)})
            self.cerrar_flujo()
        except Exception: pass

def main():
    try: srv = ThreadingHTTPServer(('127.0.0.1', PUERTO), Pedido)
    except OSError:
        print('Ondi Técnico ya está abierto en esta compu (o el puerto %d está ocupado).' % PUERTO); input('Enter para cerrar…'); return
    srv.daemon_threads = True
    print('=' * 52)
    print('  Ondi Técnico %s · listo' % VERSION)
    print('  Código de emparejado:  %s' % CODIGO)
    print('  En Ondi → Integraciones → Consola, poné ese código.')
    print('  Dejá esta ventana abierta mientras trabajás.')
    print('=' * 52)
    try: srv.serve_forever()
    except KeyboardInterrupt: pass

if __name__ == '__main__':
    main()
