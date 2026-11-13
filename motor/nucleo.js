// Motor 3D común de Unity Tech (Ondi, Olumi y Estiba) · núcleo: dibujo, luz, cámara con los controles de Los Sims 4 y medición.
// La escena no vive acá: son piezas en datos (piezas.js) que cualquiera puede editar (editor.js).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
export { THREE };

// día: sol de tarde con sombras marcadas y cielo con bruma; noche: azul profundo con estrellas (el brillo lo ponen las piezas)
const TEMAS = {
  claro: { alto: 0x5f9ee0, cielo: 0xd9e6ef, niebla: 0xd6e2eb, sol: 0xffeccf, solI: 3.6, hemiA: 0xbcd6f0, hemiB: 0x6f675a, hemiI: 0.5, env: 0.7, exp: 0.84, noche: 0, cerca: 700, lejos: 4200 },
  oscuro: { alto: 0x02060c, cielo: 0x0a1824, niebla: 0x08131d, sol: 0x9fb8ff, solI: 0.55, hemiA: 0x4a6c96, hemiB: 0x0b0f15, hemiI: 0.7, env: 0.2, exp: 1.18, noche: 1, cerca: 500, lejos: 2600 }
};
// cielo: degradé del horizonte al cenit, resplandor del sol y estrellas de noche
const CIELO_VS = 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = (projectionMatrix * p).xyww; }';
const CIELO_FS = `uniform vec3 alto, hor, solC; uniform vec3 solD; uniform float noche; varying vec3 vD;
  float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.0); vec3 c = mix(hor, alto, pow(y, 0.5));
    if (d.y < 0.0) c = hor * 0.92;
    float s = max(dot(d, solD), 0.0); c += solC * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.18) * (1.0 - noche * 0.7);
    if (noche > 0.5) { vec3 q = floor(d * 520.0); float e = step(0.9986, h(q)) * smoothstep(0.02, 0.25, d.y); c += vec3(0.75, 0.85, 1.0) * e * (0.4 + 0.6 * h(q + 3.1)); }
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

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
  const cieloU = { alto: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, solC: { value: new THREE.Color() }, solD: { value: new THREE.Vector3(-1.1, 2.2, 1.4).normalize() }, noche: { value: 0 } };
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ uniforms: cieloU, vertexShader: CIELO_VS, fragmentShader: CIELO_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
  cielo.renderOrder = -10; cielo.frustumCulled = false; cielo.onBeforeRender = () => cielo.position.copy(cam.position); scene.add(cielo);

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

  motor.ponerTema = t => { motor.tema = t = t === 'oscuro' ? 'oscuro' : 'claro'; const T = TEMAS[t]; scene.background.set(T.cielo); scene.fog.color.set(T.niebla); scene.fog.near = T.cerca; scene.fog.far = T.lejos;
    cieloU.alto.value.set(T.alto); cieloU.hor.value.set(T.cielo); cieloU.solC.value.set(T.sol); cieloU.noche.value = T.noche;
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
  const vel = { yaw: 0, pitch: 0, tx: 0, tz: 0 }, rueda = { k: 0, x: 0, y: 0 }; let tMov = 0; const frena = () => { vel.yaw = vel.pitch = vel.tx = vel.tz = 0; };
  const zoomHacia = (k, x, y) => { const a = x != null && motor.enPiso(x, y); C.d = Math.min(C.max, Math.max(C.min, C.d * k)); if (a) { ubicarCam(); const b = motor.enPiso(x, y); if (b) { C.tx += a.x - b.x; C.tz += a.z - b.z; } } motor.dirty = true; };
  motor.zoomHacia = zoomHacia;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); viaje = null; frena(); rueda.k = 0;
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
    const ahora = performance.now(), dt = Math.max(8, ahora - tMov) / 1000, mz = (v, n) => v * 0.6 + n * 0.4; tMov = ahora;
    if (arr.girar) { const a = C.yaw, b = C.pitch; C.yaw -= dx * 0.006; C.pitch = Math.min(1.45, Math.max(0.12, C.pitch + dy * 0.004)); vel.yaw = mz(vel.yaw, (C.yaw - a) / dt); vel.pitch = mz(vel.pitch, (C.pitch - b) / dt); }
    else if (arr.p) { ubicarCam(); const q = motor.enPiso(e.clientX, e.clientY); if (q) { const ax = arr.p.x - q.x, az = arr.p.z - q.z; C.tx += ax; C.tz += az; vel.tx = mz(vel.tx, ax / dt); vel.tz = mz(vel.tz, az / dt); } }
    motor.dirty = true; });
  const fin = e => { const tenia = dedos.has(e.pointerId); dedos.delete(e.pointerId); if (dedos.size < 2) gesto = null; canvas.classList.remove('arrastra');
    if (!tenia || !arr) return; const a = arr; arr = null; if (performance.now() - tMov > 90 || a.editor) frena();
    if (a.editor) { motor.soltar && motor.soltar(e); return; }
    if (e.type === 'pointerup' && a.mov < 6 && !a.girar && performance.now() - a.t < 600) motor.alTocar && motor.alTocar(e); };
  canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
  canvas.addEventListener('wheel', e => { if (o.ruedaConCtrl && !motor.editando && !document.fullscreenElement && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); viaje = null; frena(); rueda.k += (e.deltaMode ? e.deltaY * 30 : e.deltaY) * 0.0011; rueda.x = e.clientX; rueda.y = e.clientY; motor.dirty = true; }, { passive: false });
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
    // la rueda acerca en varios cuadros y lo que se soltó en movimiento frena de a poco
    if (Math.abs(rueda.k) > 1e-4) { const p = rueda.k * (1 - Math.exp(-dt * 16)); rueda.k -= p; zoomHacia(Math.exp(p), rueda.x, rueda.y); } else rueda.k = 0;
    if (!arr && !gesto && (vel.yaw || vel.pitch || vel.tx || vel.tz)) { const f = Math.exp(-dt * 5.5); C.yaw += vel.yaw * dt; C.pitch = Math.min(1.45, Math.max(0.12, C.pitch + vel.pitch * dt)); C.tx += vel.tx * dt; C.tz += vel.tz * dt;
      for (const k in vel) { vel[k] *= f; if (Math.abs(vel[k]) < (k === 'tx' || k === 'tz' ? 0.05 : 0.002)) vel[k] = 0; } motor.dirty = true; }
    if (viaje) { viaje.t += dt / viaje.dur; const k = viaje.t >= 1 ? 1 : 1 - Math.pow(1 - viaje.t, 3); for (const q of ['tx', 'tz', 'yaw', 'pitch', 'd']) C[q] = viaje.de[q] + (viaje.a[q] - viaje.de[q]) * k; if (viaje.t >= 1) viaje = null; motor.dirty = true; }
    for (const f of motor.cada) if (f(dt, t)) motor.dirty = true;
    if (!motor.dirty) return; motor.dirty = false; ubicarCam(); const a = performance.now(); renderer.render(scene, cam); acc += performance.now() - a; n++; for (const f of motor.despues) f();
    if (t - t0 > 600) { Object.assign(motor.stats, { fps: Math.round(n * 1000 / (t - t0)), ms: +(acc / Math.max(1, n)).toFixed(1), dibujos: renderer.info.render.calls, triangulos: renderer.info.render.triangles }); n = 0; acc = 0; t0 = t; } }
  let guardado = null; try { guardado = localStorage.getItem('motor.tema'); } catch (e) {}
  motor.ponerTema(o.tema || guardado || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'));
  requestAnimationFrame(cuadro);
  return motor;
}
