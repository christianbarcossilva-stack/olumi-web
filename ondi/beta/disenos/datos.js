/* Datos de ejemplo compartidos por las tres demos del rediseño de Ondi (sin clientes reales). */
const D = {
  inst: 'Instalaciones Demo', user: 'Christian',
  clientes: [
    { id: 'pln', n: 'Parque Logístico Norte', dir: 'Ruta 1 km 24 · 9 naves', base: 'polo', eq: { wifi: [31, 1], cam: [18, 0], sw: [7, 0], gw: [2, 0] }, up: [99.9, 99.8, 100, 100, 99.7, 100, 99.2] },
    { id: 'hca', n: 'Hotel Costa Azul', dir: 'Rambla 2140 · 6 pisos', eq: { wifi: [14, 0], cam: [12, 2], sw: [4, 0], gw: [1, 0] }, up: [100, 99.1, 98.4, 100, 99.9, 97.8, 96.5] },
    { id: 'fde', n: 'Frigorífico del Este', dir: 'Camino Carrasco 6300', eq: { wifi: [9, 0], cam: [11, 0], sw: [3, 0], gw: [1, 0] }, up: [100, 100, 100, 100, 100, 100, 100] },
    { id: 'cla', n: 'Colegio Las Acacias', dir: 'Av. Italia 4410', eq: { wifi: [11, 0], cam: [6, 0], sw: [2, 0, 1], gw: [1, 0] }, up: [100, 100, 99.6, 99.8, 100, 99.9, 99.4] },
    { id: 'bce', n: 'Barraca Central', dir: 'Cno. Maldonado 7700', eq: { wifi: [5, 0], cam: [4, 0], sw: [2, 0], gw: [1, 0] }, up: [100, 100, 100, 99.9, 100, 100, 100] },
    { id: 'tso', n: 'Torre Sur Oficinas', dir: 'Sin enlazar todavía', eq: null, up: null }
  ],
  alertas: [
    { id: 143, sev: 'crit', cli: 'pln', lugar: 'Nave 1 · Entrepiso Y', eqp: 'AP Entrepiso Y-04', mod: 'U6 Pro', que: 'Sin señal', desde: 6 * 60 + 12, tipo: 'wifi' },
    { id: 142, sev: 'crit', cli: 'hca', lugar: 'Planta baja · Lobby', eqp: 'Cámara Lobby 2', mod: 'Domo 4 MP', que: 'Sin video', desde: 14 * 60 + 40, tipo: 'cam' },
    { id: 141, sev: 'crit', cli: 'hca', lugar: 'Subsuelo · Estacionamiento', eqp: 'Cámara Estacionamiento', mod: 'Bala 4 MP', que: 'Desconectada', desde: 63 * 60, tipo: 'cam', ticket: 'T-0141', tec: 'Martín' },
    { id: 140, sev: 'warn', cli: 'cla', lugar: 'Sala de servidores', eqp: 'Switch Rack N2', mod: '24 PoE', que: '312 errores en el puerto 14', desde: 41 * 60, tipo: 'sw' }
  ],
  hechos: [
    ['13:28', 'crit', 'AP Entrepiso Y-04 dejó de responder', 'pln'],
    ['13:20', 'ok', 'Martín cerró el ticket T-0139 · cambio de fuente', 'fde'],
    ['13:05', 'warn', 'Switch Rack N2: 312 errores en el puerto 14', 'cla'],
    ['12:51', 'crit', 'Cámara Lobby 2 sin video', 'hca'],
    ['12:40', 'ok', 'Se sumaron 3 equipos nuevos', 'bce'],
    ['12:26', 'crit', 'Cámara Estacionamiento desconectada · T-0141', 'hca'],
    ['12:12', 'ok', 'Respaldo de configuración de UniFi', 'pln'],
    ['11:58', 'ok', 'AP Andén 12 volvió a estar en línea', 'pln']
  ],
  tipos: { wifi: 'Wi-Fi', cam: 'Cámaras', sw: 'Switches', gw: 'Gateways' }
};
D.cli = id => D.clientes.find(c => c.id === id);
D.tot = c => { if (!c.eq) return null; let t = 0, k = 0, w = 0; for (const v of Object.values(c.eq)) { t += v[0]; k += v[1]; w += v[2] || 0; } return { t, k, w, ok: t - k }; };
D.todo = () => D.clientes.reduce((a, c) => { const r = D.tot(c); if (r) { a.t += r.t; a.k += r.k; a.w += r.w; a.n++; } return a; }, { t: 0, k: 0, w: 0, n: 0 });
D.estado = c => { const r = D.tot(c); return !r ? 'off' : r.k ? 'crit' : r.w ? 'warn' : 'ok'; };
D.esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
D.dur = s => s < 3600 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min`;
D.t0 = Date.now(); D.desde = a => a.desde + (Date.now() - D.t0) / 1000;
D.hora = (seg = true) => new Date().toLocaleTimeString('es-UY', seg ? { hour12: false } : { hour: '2-digit', minute: '2-digit', hour12: false });
D.fecha = () => new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });
D.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Tema: claro/oscuro con el botón ◐, guardado por demo */
D.tema = (clave, porDefecto) => { const h = document.documentElement; let t = porDefecto; try { t = localStorage.getItem(clave) || porDefecto; } catch (e) {} h.dataset.theme = t;
  return () => { t = h.dataset.theme === 'dark' ? 'light' : 'dark'; h.dataset.theme = t; try { localStorage.setItem(clave, t); } catch (e) {} return t; }; };
/* Maqueta 3D real (la pública, sin nombres reales) dentro de un iframe */
D.maqueta = (cont, c, { limpio = true, orbita = false, cerca = 1 } = {}) => {
  window.__ondiMaqueta = { state: null, role: 'cli', park: c.n, installer: D.inst, base: c.base === 'polo' ? 'polo' : 'vacia', generica: c.base !== 'polo', canTicket: false, save() {}, savePlano() {}, juego() {} };
  cont.innerHTML = ''; const f = document.createElement('iframe'); f.src = '../maqueta.html?v=24'; f.title = 'Maqueta 3D de ' + c.n; f.setAttribute('allow', 'fullscreen'); f.style.cssText = 'border:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .9s';
  f.onload = () => { try { const d = f.contentDocument, s = d.createElement('style');
      if (limpio) s.textContent = '.topbar,.kpiwrap,.dock,.controls,.panel,.camview,.editbar,.vignette,.roview,.toast,#labels .poi,#labels .street,#labels .chip{display:none!important}';
      d.head.appendChild(s); } catch (e) {}
    setTimeout(() => { f.style.opacity = 1; try { if (cerca !== 1) f.contentWindow.__dbg.cam.zoom *= cerca; } catch (e) {} }, 600);
    if (orbita && !D.reduce) { let last = 0; const g = t => { try { const cam = f.contentWindow.__dbg && f.contentWindow.__dbg.cam; if (cam && last) cam.yaw += (t - last) * 0.000035; } catch (e) { return; } last = t; f._raf = requestAnimationFrame(g); }; f._raf = requestAnimationFrame(g); } };
  cont.appendChild(f); return f; };
