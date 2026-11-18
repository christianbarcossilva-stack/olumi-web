// Motor común · presentación, vista desde una cámara y hora real (beta)
//  · Recorrido de presentación: la cámara va sola de la vista general a los edificios más grandes, girando despacio en cada uno. Cualquier toque lo corta.
//  · Ver desde una cámara: la vista se pone en el lugar de la cámara, mirando hacia donde apunta; de noche, con filtro de visión nocturna.
//  · Hora real: elige mañana, mediodía, hora azul o noche según el reloj de quien mira, y se va corriendo sola.
export function extras(M) { const { motor, objs, raiz } = M, C = motor.C, doc = document.documentElement, X = { tour: null, cam: null, auto: 0 };
  const el = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };

  // ---------- recorrido de presentación ----------
  function paradas() { const P = M.E.piezas.filter(p => ['galpon', 'edificio', 'modulo', 'fila', 'estacionamiento'].includes(p.t) && !p._p && p.x != null).map(p => { const d = { ...M.TIPOS[p.t].def, ...p }; return { p, tam: Math.max(d.ancho || (d.columnas || 0) * 2.6 || (d.largo || 20), d.fondo || 10) }; }).sort((a, b) => b.tam - a.tam).slice(0, 7);
    const out = [{ ...motor.casa(), t: 4, giro: 0.045, seg: 7 }];
    P.forEach(({ p, tam }, i) => out.push({ tx: p.x, tz: p.z, d: Math.min(240, Math.max(30, tam * 1.15)), yaw: (p.r || 0) + (i % 2 ? -0.6 : 0.6), pitch: 0.24 + (i % 3) * 0.07, t: 4.5, giro: i % 2 ? -0.06 : 0.06, seg: 6 }));
    return out; }
  function presentar(on) { if (!!X.tour === !!on) return; if (!on) { X.tour = null; doc.classList.remove('presenta'); X.cartel && (X.cartel.hidden = true); motor.dirty = true; return; }
    if (X.cam) verCamara(null); const L = paradas(); if (L.length < 2) { M.toast('Para el recorrido hace falta al menos un galpón o un edificio'); return; }
    X.tour = { L, i: 0, t: 0, fase: 'viaje' }; doc.classList.add('presenta'); if (!X.cartel) { X.cartel = el('<div id="mpres" class="vidrio" role="status">Recorrido de presentación · tocá o apretá una tecla para salir</div>'); raiz.appendChild(X.cartel); } X.cartel.hidden = false; motor.ir(L[0], L[0].t); }
  motor.cada.push(dt => { const T = X.tour; if (!T) return false; const p = T.L[T.i]; T.t += dt;
    if (T.fase === 'viaje') { if (T.t >= p.t) { T.fase = 'gira'; T.t = 0; } return true; }
    C.yaw += p.giro * dt; if (T.t >= p.seg) { T.i = (T.i + 1) % T.L.length; T.t = 0; T.fase = 'viaje'; const q = T.L[T.i]; motor.ir(q, q.t); } return true; });
  const corta = e => { if (X.tour && !(e.target.closest && e.target.closest('[data-pres]'))) presentar(false); };
  addEventListener('pointerdown', corta, true); addEventListener('wheel', corta, { capture: true, passive: true }); addEventListener('keydown', e => { if (X.tour) presentar(false); else if (X.cam && e.key === 'Escape') verCamara(null); }, true);

  // ---------- ver desde una cámara ----------
  function verCamara(p) { const lz = motor.canvas;
    if (X.cam) { const v = X.cam; X.cam = null; Object.assign(C, v.antes); C.ty = v.antes.ty || 0; motor.cam.fov = v.fov; motor.cam.updateProjectionMatrix(); const g = objs.get(v.p.id); if (g) M.aplicarCapas(g); lz.style.filter = ''; X.hud.hidden = true; clearInterval(v.reloj); doc.classList.remove('vecamara'); motor.dirty = true; }
    if (!p) return; if (X.tour) presentar(false); const g = objs.get(p.id), d = { ...M.TIPOS[p.t].def, ...p }, y = Math.max(1.2, d.y ?? 3), r = p.r || 0, baja = d.clase === 'ptz' || d.clase === 'domo' ? 0.5 : 0.36, D = 14;
    const dx = Math.sin(r) * Math.cos(baja), dz = Math.cos(r) * Math.cos(baja), dy = -Math.sin(baja);
    X.cam = { p, antes: { tx: C.tx, tz: C.tz, yaw: C.yaw, pitch: C.pitch, d: C.d, ty: C.ty || 0 }, fov: motor.cam.fov };
    Object.assign(C, { tx: p.x + dx * D, tz: p.z + dz * D, ty: y + dy * D, d: D, yaw: Math.atan2(-dx, -dz), pitch: baja }); motor.cam.fov = Math.max(34, Math.min(86, (d.apertura || 90) * 0.62)); motor.cam.updateProjectionMatrix(); if (g) g.visible = false;
    const noche = motor.tema === 'oscuro'; lz.style.filter = noche ? 'grayscale(1) sepia(1) hue-rotate(58deg) saturate(2.4) brightness(1.55) contrast(1.12)' : 'saturate(.72) contrast(1.1) brightness(1.03)';
    if (!X.hud) { X.hud = el('<div id="mcamv" data-pres="1"><i></i><div class="mcv-a"><b></b><span class="mcv-rec">REC</span></div><div class="mcv-b"><span></span><button class="mbtn" data-salir="1">Salir de la cámara</button></div></div>'); raiz.appendChild(X.hud); X.hud.querySelector('[data-salir]').addEventListener('click', () => verCamara(null)); }
    X.hud.hidden = false; X.hud.classList.toggle('noche', noche); X.hud.querySelector('b').textContent = (d.nombre || p.id || 'Cámara') + (noche ? ' · visión nocturna' : ''); const hora = () => { X.hud.querySelector('.mcv-b span').textContent = new Date().toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }; hora(); X.cam.reloj = setInterval(hora, 1000);
    doc.classList.add('vecamara'); motor.dirty = true; }

  // ---------- hora real ----------
  const segunReloj = () => { const n = new Date(), h = n.getHours() + n.getMinutes() / 60; return h >= 6 && h < 10 ? 'manana' : h >= 10 && h < 18.5 ? 'dia' : h >= 18.5 && h < 20.5 ? 'azul' : 'noche'; };
  function horaReal(on) { clearInterval(X.auto); X.auto = 0; X.real = !!on; if (!on) return; const pon = () => { const h = segunReloj(); if (h !== motor.hora) motor.ponerHora(h); }; pon(); X.auto = setInterval(pon, 5 * 60000); }
  // el botón de la hora recorre: mañana, mediodía, hora azul, noche y «hora real»
  function siguienteHora() { const L = motor.horas.map(q => q[0]); let txt;
    if (X.real) { horaReal(false); motor.ponerHora(L[0]); txt = motor.horas[0][1]; }
    else { const i = L.indexOf(motor.hora); if (i === L.length - 1) { horaReal(true); txt = 'Hora real · ahora ' + motor.horas.find(q => q[0] === motor.hora)[1].toLowerCase(); } else { motor.ponerHora(L[i + 1]); txt = motor.horas[i + 1][1]; } }
    try { localStorage.setItem('motor.tema', motor.tema); localStorage.setItem('motor.hora', X.real ? 'auto' : motor.hora); } catch (e) {} M.toast(txt); }
  try { if (localStorage.getItem('motor.hora') === 'auto' && !M.temaFijo) horaReal(true); } catch (e) {}
  return { presentar, verCamara, horaReal, siguienteHora, get tour() { return !!X.tour; }, get camara() { return X.cam ? X.cam.p : null; } }; }
