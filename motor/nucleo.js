// Motor 3D común de Unity Tech (Ondi, Olumi y Estiba) · núcleo: dibujo, luz, cámara con los controles de Los Sims 4 y medición.
// La escena no vive acá: son piezas en datos (piezas.js) que cualquiera puede editar (editor.js).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
export { THREE };

const TEMAS = {
  claro: { cielo: 0xdfe6ea, niebla: 0xdfe6ea, sol: 0xfff1dc, solI: 2.5, hemiA: 0xcfe3f5, hemiB: 0x8d8a80, hemiI: 0.95, env: 0.5, exp: 1.02 },
  oscuro: { cielo: 0x0f1519, niebla: 0x0f1519, sol: 0xc9d6ff, solI: 0.9, hemiA: 0x6d7f96, hemiB: 0x23262a, hemiI: 0.55, env: 0.22, exp: 1.12 }
};

export function crearMotor(canvas, o = {}) {
  const tactil = matchMedia('(pointer:coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.captura });
  renderer.setPixelRatio(Math.min(devicePixelRatio, tactil ? 2 : 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.5, 6000);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const hemi = new THREE.HemisphereLight(), sol = new THREE.DirectionalLight(); scene.add(hemi, sol, sol.target);
  sol.castShadow = true; { const s = o.sombra || (tactil ? 2048 : 4096); sol.shadow.mapSize.set(s, s); } sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.05;
  scene.background = new THREE.Color(); scene.fog = new THREE.Fog(0, 900, 3200);

  // cámara orbital: objetivo (tx, tz), giro, inclinación y distancia; viaja suave a donde se le pide
  const C = { tx: 0, tz: 0, yaw: 0.6, pitch: 0.62, d: 300, min: 4, max: 1800 }, HOME = { ...C };
  let viaje = null;
  const motor = { THREE, scene, cam, renderer, canvas, C, sol, hemi, tactil, cada: [], despues: [], alTema: [], tema: 'claro', dirty: true };
  motor.inicio = v => { Object.assign(HOME, v); Object.assign(C, v); };
  motor.ir = (v, t = 0.9) => { if (v.yaw !== undefined) { let d = v.yaw - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); v = { ...v, yaw: C.yaw + d }; } viaje = { de: { ...C }, a: { ...C, ...v }, t: 0, dur: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : t }; };
  motor.vista = () => motor.ir({ tx: HOME.tx, tz: HOME.tz, yaw: HOME.yaw, pitch: HOME.pitch, d: HOME.d });
  function ubicarCam() { const cp = Math.cos(C.pitch); cam.position.set(C.tx + C.d * cp * Math.sin(C.yaw), C.d * Math.sin(C.pitch), C.tz + C.d * cp * Math.cos(C.yaw)); cam.lookAt(C.tx, 0, C.tz);
    // la sombra sigue a lo que se mira y se ajusta al zoom (más nítida de cerca)
    const r = Math.min(700, Math.max(40, C.d * 0.85)); Object.assign(sol.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 6 }); sol.shadow.camera.updateProjectionMatrix();
    sol.position.set(C.tx - r * 1.1, r * 2.2, C.tz + r * 1.4); sol.target.position.set(C.tx, 0, C.tz); }

  motor.ponerTema = t => { motor.tema = t = t === 'oscuro' ? 'oscuro' : 'claro'; const T = TEMAS[t]; scene.background.set(T.cielo); scene.fog.color.set(T.niebla);
    sol.color.set(T.sol); sol.intensity = T.solI; hemi.color.set(T.hemiA); hemi.groundColor.set(T.hemiB); hemi.intensity = T.hemiI; scene.environmentIntensity = T.env; renderer.toneMappingExposure = T.exp;
    document.documentElement.dataset.tema = t; motor.dirty = true; motor.alTema.forEach(f => f(t)); };

  // rayos: punto del piso bajo el mouse y piezas tocadas
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), piso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  motor.rayo = (x, y) => { const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); return ray; };
  motor.enPiso = (x, y, h = 0) => { piso.constant = -h; const p = new THREE.Vector3(); return motor.rayo(x, y).ray.intersectPlane(piso, p) ? p : null; };
  motor.tocar = (x, y, objs) => motor.rayo(x, y).intersectObjects(objs, true);
  motor.aPantalla = v => { const p = v.clone().project(cam), r = canvas.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, z: p.z }; };

  // controles de Los Sims 4: rueda acerca hacia el mouse, clic derecho gira, arrastrar el piso desplaza; WASD/flechas desplazan, Z/X acercan, , . giran
  // el editor puede quedarse con un arrastre devolviendo true en motor.agarrar(e)
  const dedos = new Map(); let arr = null, gesto = null, teclas = {};
  const zoomHacia = (k, x, y) => { const a = x != null && motor.enPiso(x, y); C.d = Math.min(C.max, Math.max(C.min, C.d * k)); if (a) { ubicarCam(); const b = motor.enPiso(x, y); if (b) { C.tx += a.x - b.x; C.tz += a.z - b.z; } } motor.dirty = true; };
  motor.zoomHacia = zoomHacia;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); viaje = null;
    if (dedos.size === 2) { arr = null; const [a, b] = [...dedos.values()]; gesto = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; motor.soltar && motor.soltar(e, true); return; }
    if (e.button === 0 && !e.shiftKey && motor.agarrar && motor.agarrar(e)) { arr = { editor: true }; return; }
    const girar = e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey && !motor.editando);
    arr = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, girar, p: girar ? null : motor.enPiso(e.clientX, e.clientY), mov: 0, t: performance.now() }; canvas.classList.add('arrastra'); });
  canvas.addEventListener('pointermove', e => {
    if (dedos.has(e.pointerId)) dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 2 && gesto) { const [a, b] = [...dedos.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const p0 = motor.enPiso(gesto.mx, gesto.my); zoomHacia(gesto.d / d, mx, my); C.yaw -= ang - gesto.ang; ubicarCam(); const p1 = motor.enPiso(mx, my); if (p0 && p1) { C.tx += p0.x - p1.x; C.tz += p0.z - p1.z; }
      C.pitch = Math.min(1.45, Math.max(0.12, C.pitch + (my - gesto.my) * 0.004)); gesto = { d, ang, mx, my }; motor.dirty = true; return; }
    if (!arr) { motor.pasar && motor.pasar(e); return; }
    if (arr.editor) { motor.mover && motor.mover(e); return; }
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y; arr.x = e.clientX; arr.y = e.clientY; arr.mov += Math.abs(dx) + Math.abs(dy);
    if (arr.girar) { C.yaw -= dx * 0.006; C.pitch = Math.min(1.45, Math.max(0.12, C.pitch + dy * 0.004)); }
    else if (arr.p) { ubicarCam(); const q = motor.enPiso(e.clientX, e.clientY); if (q) { C.tx += arr.p.x - q.x; C.tz += arr.p.z - q.z; } }
    motor.dirty = true; });
  const fin = e => { const tenia = dedos.has(e.pointerId); dedos.delete(e.pointerId); if (dedos.size < 2) gesto = null; canvas.classList.remove('arrastra');
    if (!tenia || !arr) return; const a = arr; arr = null;
    if (a.editor) { motor.soltar && motor.soltar(e); return; }
    if (e.type === 'pointerup' && a.mov < 6 && !a.girar && performance.now() - a.t < 600) motor.alTocar && motor.alTocar(e); };
  canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
  canvas.addEventListener('wheel', e => { if (o.ruedaConCtrl && !motor.editando && !document.fullscreenElement && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); viaje = null; zoomHacia(Math.exp((e.deltaMode ? e.deltaY * 30 : e.deltaY) * 0.0011), e.clientX, e.clientY); }, { passive: false });
  const escribe = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  addEventListener('keydown', e => { if (escribe(e) || e.metaKey || e.ctrlKey) return; teclas[e.key.toLowerCase()] = 1;
    if (e.key === ',' && !motor.editando) motor.ir({ yaw: C.yaw - Math.PI / 4 }, 0.4); if (e.key === '.' && !motor.editando) motor.ir({ yaw: C.yaw + Math.PI / 4 }, 0.4); });
  addEventListener('keyup', e => { teclas[e.key.toLowerCase()] = 0; }); addEventListener('blur', () => { teclas = {}; });

  // lazo de dibujo: solo dibuja cuando algo cambió o hay animación (ahorra batería en el celular)
  let prev = performance.now(), n = 0, t0 = prev, acc = 0; motor.stats = { fps: 0, ms: 0, dibujos: 0, triangulos: 0 };
  function cuadro(t) { requestAnimationFrame(cuadro); const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
    if (canvas.clientWidth && (canvas.width !== Math.floor(canvas.clientWidth * renderer.getPixelRatio()) || canvas.height !== Math.floor(canvas.clientHeight * renderer.getPixelRatio()))) {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); cam.aspect = canvas.clientWidth / canvas.clientHeight; cam.updateProjectionMatrix(); motor.dirty = true; }
    const v = C.d * 0.8 * dt, fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw), K = teclas, mueve = (a, b) => { C.tx += a; C.tz += b; motor.dirty = true; viaje = null; };
    if (!motor.caminando) { if (K.w || K.arrowup) mueve(fx * v, fz * v); if (K.s || K.arrowdown) mueve(-fx * v, -fz * v); if (K.a || K.arrowleft) mueve(fz * v, -fx * v); if (K.d || K.arrowright) mueve(-fz * v, fx * v);
      if (K.z) zoomHacia(Math.exp(-dt * 1.6)); if (K.x) zoomHacia(Math.exp(dt * 1.6)); }
    if (viaje) { viaje.t += dt / viaje.dur; const k = viaje.t >= 1 ? 1 : 1 - Math.pow(1 - viaje.t, 3); for (const q of ['tx', 'tz', 'yaw', 'pitch', 'd']) C[q] = viaje.de[q] + (viaje.a[q] - viaje.de[q]) * k; if (viaje.t >= 1) viaje = null; motor.dirty = true; }
    for (const f of motor.cada) if (f(dt, t)) motor.dirty = true;
    if (!motor.dirty) return; motor.dirty = false; ubicarCam(); const a = performance.now(); renderer.render(scene, cam); acc += performance.now() - a; n++; for (const f of motor.despues) f();
    if (t - t0 > 600) { Object.assign(motor.stats, { fps: Math.round(n * 1000 / (t - t0)), ms: +(acc / Math.max(1, n)).toFixed(1), dibujos: renderer.info.render.calls, triangulos: renderer.info.render.triangles }); n = 0; acc = 0; t0 = t; } }
  motor.ponerTema(o.tema || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'));
  requestAnimationFrame(cuadro);
  return motor;
}
