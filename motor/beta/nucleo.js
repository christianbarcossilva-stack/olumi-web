// Motor 3D común de Unity Tech (Ondi, Olumi y Darvi) · núcleo: dibujo, luz, cámara y controles (mouse, trackpad, dedos y teclado).
// La escena no vive acá: son piezas en datos (piezas.js) que se editan con maqueta.js y construir.js.
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
  const pmrem = new THREE.PMREMGenerator(renderer); const envSala = scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; let envCielo = null;
  const hemi = new THREE.HemisphereLight(), sol = new THREE.DirectionalLight(); scene.add(hemi, sol, sol.target);
  sol.castShadow = true; { const s = o.sombra || (tactil ? 2048 : 4096); sol.shadow.mapSize.set(s, s); } sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.05;
  scene.background = new THREE.Color(); scene.fog = new THREE.Fog(0, 900, 3200);
  const cieloU = { alto: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, solC: { value: new THREE.Color() }, solD: { value: new THREE.Vector3(-1.1, 2.2, 1.4).normalize() }, noche: { value: 0 } };
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ uniforms: cieloU, vertexShader: CIELO_VS, fragmentShader: CIELO_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
  cielo.renderOrder = -10; cielo.frustumCulled = false; cielo.onBeforeRender = () => cielo.position.copy(cam.position); scene.add(cielo);

  // cámara orbital: objetivo (tx, tz), giro, inclinación y distancia; viaja suave a donde se le pide
  const C = { tx: 0, tz: 0, yaw: 0.6, pitch: 0.62, d: 300, min: 4, max: 1800, pmin: 0.12, pmax: 1.45 }, HOME = { ...C };
  const incl = v => Math.min(C.pmax, Math.max(C.pmin, v));
  let viaje = null;
  const motor = { THREE, scene, cam, renderer, canvas, C, sol, hemi, tactil, cada: [], despues: [], alTema: [], tema: 'claro', dirty: true };
  motor.inicio = v => { Object.assign(HOME, v); Object.assign(C, v); };
  motor.ir = (v, t = 0.9) => { if (v.yaw !== undefined) { let d = v.yaw - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); v = { ...v, yaw: C.yaw + d }; } viaje = { de: { ...C }, a: { ...C, ...v }, t: 0, dur: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : t }; };
  motor.vista = () => motor.ir({ tx: HOME.tx, tz: HOME.tz, yaw: HOME.yaw, pitch: HOME.pitch, d: HOME.d });
  function ubicarCam() { const cp = Math.cos(C.pitch); const ty = C.ty || 0; const cerca = C.d < 6 ? 0.06 : 0.5; if (cam.near !== cerca) { cam.near = cerca; cam.updateProjectionMatrix(); }
    if (motor.borde) { const B = motor.borde; C.tx = Math.min(B.x1, Math.max(B.x0, C.tx)); C.tz = Math.min(B.z1, Math.max(B.z0, C.tz)); }
    if (motor.bruma) { scene.fog.near = Math.max(motor.bruma[0], C.d * 1.6); scene.fog.far = Math.max(motor.bruma[1], C.d * 5); }
    cam.position.set(C.tx + C.d * cp * Math.sin(C.yaw), ty + C.d * Math.sin(C.pitch), C.tz + C.d * cp * Math.cos(C.yaw)); cam.lookAt(C.tx, ty, C.tz);
    // la sombra sigue a lo que se mira y se ajusta al zoom (más nítida de cerca)
    const r = Math.min(700, Math.max(40, C.d * 0.85)); Object.assign(sol.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 6 }); sol.shadow.camera.updateProjectionMatrix();
    sol.position.set(C.tx - r * 1.1, r * 2.2, C.tz + r * 1.4); sol.target.position.set(C.tx, 0, C.tz); }

  motor.ponerTema = t => { motor.tema = t = t === 'oscuro' ? 'oscuro' : 'claro'; const T = TEMAS[t]; scene.background.set(T.cielo); scene.fog.color.set(T.niebla); scene.fog.near = T.cerca; scene.fog.far = T.lejos; motor.bruma = [T.cerca, T.lejos];
    cieloU.alto.value.set(T.alto); cieloU.hor.value.set(T.cielo); cieloU.solC.value.set(T.sol); cieloU.noche.value = T.noche;
    sol.color.set(T.sol); sol.intensity = T.solI; hemi.color.set(T.hemiA); hemi.groundColor.set(T.hemiB); hemi.intensity = T.hemiI; scene.environmentIntensity = T.env; renderer.toneMappingExposure = T.exp;
    // de día el reflejo de chapas y vidrios es el del cielo de la maqueta (no el de una sala de estudio); de noche queda el reflejo tenue de antes
    if (t === 'claro') { const uu = THREE.UniformsUtils.clone(cieloU); uu.alto.value.lerp(uu.hor.value, 0.72); /* cielo más pálido para alumbrar: si no, las sombras quedan azules */ const s = new THREE.Scene(), c2 = new THREE.Mesh(cielo.geometry, new THREE.ShaderMaterial({ uniforms: uu, vertexShader: CIELO_VS, fragmentShader: CIELO_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false })), ps = new THREE.Mesh(new THREE.CircleGeometry(90, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xa9a59b })); c2.scale.setScalar(60); c2.renderOrder = -10; ps.position.y = -2; s.add(c2, ps); if (envCielo) envCielo.dispose(); envCielo = pmrem.fromScene(s, 0.035, 0.1, 400).texture; scene.environment = envCielo; ps.geometry.dispose(); ps.material.dispose(); c2.material.dispose(); } else scene.environment = envSala;
    document.documentElement.dataset.tema = t; motor.dirty = true; motor.alTema.forEach(f => f(t)); };

  // rayos: punto del piso bajo el mouse y piezas tocadas
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), piso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  motor.rayo = (x, y) => { const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); return ray; };
  motor.enPiso = (x, y, h = 0) => { piso.constant = -h; const p = new THREE.Vector3(); return motor.rayo(x, y).ray.intersectPlane(piso, p) ? p : null; };
  motor.tocar = (x, y, objs) => motor.rayo(x, y).intersectObjects(objs, true);
  motor.aPantalla = v => { const p = v.clone().project(cam), r = canvas.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, z: p.z }; };

  // controles de Los Sims 4: rueda acerca hacia el mouse, clic derecho gira, arrastrar el piso desplaza; WASD/flechas desplazan, Z/X acercan, , . giran
  // el editor puede quedarse con un arrastre devolviendo true en motor.agarrar(e)
  const dedos = new Map(); let arr = null, gesto = null, teclas = {}, largo = 0; const vuelta = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const vel = { yaw: 0, pitch: 0, tx: 0, tz: 0 }, rueda = { k: 0, x: 0, y: 0 }; let tMov = 0; const frena = () => { vel.yaw = vel.pitch = vel.tx = vel.tz = 0; };
  const zoomHacia = (k, x, y) => { const a = x != null && motor.enPiso(x, y); C.d = Math.min(C.max, Math.max(C.min, C.d * k)); if (a) { ubicarCam(); const b = motor.enPiso(x, y); if (b) { C.tx += a.x - b.x; C.tz += a.z - b.z; } } motor.dirty = true; };
  motor.zoomHacia = zoomHacia;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); viaje = null; frena(); rueda.k = 0;
    if (dedos.size === 2) { arr = null; clearTimeout(largo); const [a, b] = [...dedos.values()]; gesto = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, modo: null, giro: false }; Object.assign(gesto, { d0: gesto.d, ang0: gesto.ang, mx0: gesto.mx, my0: gesto.my }); motor.soltar && motor.soltar(e, true); return; }
    if (e.button === 0 && !e.shiftKey && motor.agarrar && motor.agarrar(e)) { arr = { editor: true }; return; }
    // gira: clic derecho, ruedita, Ctrl o Alt + arrastrar (en la Mac, Ctrl + clic es el clic derecho); caminando, cualquier arrastre mira alrededor
    const girar = e.button === 2 || e.button === 1 || (e.button === 0 && (e.ctrlKey || (e.altKey && !motor.editando) || motor.caminando));
    arr = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, girar, btn: e.button, p: girar ? null : motor.enPiso(e.clientX, e.clientY), mov: 0, t: performance.now() }; canvas.classList.add('arrastra');
    // con el dedo, editando: mantener apretado sobre una pieza la agarra (un arrastre corto sobre algo sin elegir mueve la vista, no la pieza)
    clearTimeout(largo); if (e.pointerType === 'touch' && motor.editando && motor.agarrarLargo) { const a0 = arr; largo = setTimeout(() => { if (arr === a0 && a0.mov < 8 && dedos.size === 1 && motor.agarrarLargo(e)) { arr = { editor: true }; frena(); canvas.classList.remove('arrastra'); try { navigator.vibrate && navigator.vibrate(12); } catch (err) {} motor.dirty = true; } }, 380); } });
  canvas.addEventListener('pointermove', e => {
    if (dedos.has(e.pointerId)) dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // dos dedos: primero se mira qué gesto es y después se hace solo ese. Pellizco (los dedos se separan, se juntan o giran entre sí): acerca hacia
    // donde están los dedos y, si la torsión es clara (más de unos 11°), además gira. Los dos dedos juntos para el mismo lado: de costado gira la vista
    // y hacia arriba o abajo la inclina (igual que en el trackpad). Así un pellizco no inclina de rebote ni un giro acerca sin querer.
    // (cada dedo avisa por separado: se mira una vez por cuadro, con los dos ya en su lugar; si no, el primero que avisa parece un pellizco)
    if (dedos.size === 2 && gesto) { if (!gesto.pend) { gesto.pend = true; requestAnimationFrame(dosDedos); } return; }
    if (!arr) { motor.pasar && motor.pasar(e); return; }
    if (arr.editor) { motor.mover && motor.mover(e); return; }
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y; arr.x = e.clientX; arr.y = e.clientY; arr.mov += Math.abs(dx) + Math.abs(dy);
    const ahora = performance.now(), dt = Math.max(8, ahora - tMov) / 1000, mz = (v, n) => v * 0.6 + n * 0.4; tMov = ahora;
    if (arr.girar) { const a = C.yaw, b = C.pitch; C.yaw -= dx * 0.006; C.pitch = incl(C.pitch + dy * 0.004); vel.yaw = mz(vel.yaw, (C.yaw - a) / dt); vel.pitch = mz(vel.pitch, (C.pitch - b) / dt); }
    else if (arr.p) { ubicarCam(); const q = motor.enPiso(e.clientX, e.clientY); if (q) { const ax = arr.p.x - q.x, az = arr.p.z - q.z; C.tx += ax; C.tz += az; vel.tx = mz(vel.tx, ax / dt); vel.tz = mz(vel.tz, az / dt); } }
    motor.dirty = true; });
  function dosDedos() { if (!gesto) return; gesto.pend = false; if (dedos.size !== 2) return; { const [a, b] = [...dedos.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (!gesto.modo) { const esc = Math.abs(d / gesto.d0 - 1), tor = Math.abs(vuelta(ang - gesto.ang0)), ax = Math.abs(mx - gesto.mx0), ay = Math.abs(my - gesto.my0);
        if (esc > 0.08 || tor > 0.16) gesto.modo = 'pellizco'; else if (Math.hypot(ax, ay) > 14) { gesto.modo = 'orbita'; gesto.eje = ax > ay * 1.6 ? 'x' : ay > ax * 1.6 ? 'y' : 'xy'; }
        Object.assign(gesto, { d, ang, mx, my }); return; }
      if (gesto.modo === 'pellizco') { const p0 = motor.caminando ? null : motor.enPiso(gesto.mx, gesto.my); zoomHacia(gesto.d / d, motor.caminando ? null : mx, my); if (!gesto.giro && Math.abs(vuelta(ang - gesto.ang0)) > 0.2) gesto.giro = true;
        if (gesto.giro) C.yaw -= vuelta(ang - gesto.ang); ubicarCam(); const p1 = p0 && motor.enPiso(mx, my); if (p0 && p1) { C.tx += p0.x - p1.x; C.tz += p0.z - p1.z; } }
      else { if (gesto.eje !== 'y') C.yaw -= (mx - gesto.mx) * 0.006; if (gesto.eje !== 'x') C.pitch = incl(C.pitch + (my - gesto.my) * 0.004); }
      Object.assign(gesto, { d, ang, mx, my }); motor.dirty = true; } }
  const fin = e => { const tenia = dedos.has(e.pointerId); dedos.delete(e.pointerId); if (dedos.size < 2) gesto = null; canvas.classList.remove('arrastra'); clearTimeout(largo);
    if (!tenia || !arr) return; const a = arr; arr = null; if (performance.now() - tMov > 90 || a.editor) frena();
    if (a.editor) { motor.soltar && motor.soltar(e); return; }
    if (e.type !== 'pointerup' || a.mov >= 6 || performance.now() - a.t > 600) return;
    if (a.btn === 2) motor.alMenu && motor.alMenu(e); else if (a.btn === 0) motor.alTocar && motor.alTocar(e); };
  canvas.addEventListener('dblclick', e => { if (motor.alDoble) motor.alDoble(e); });
  canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
  // rueda y trackpad. Mouse: la rueda acerca hacia el puntero. Trackpad: dos dedos arriba/abajo acercan, dos dedos de costado giran, pellizco acerca
  // (el navegador lo manda como rueda con Ctrl), Shift + dos dedos inclina. Caminando, la rueda acerca o aleja la cámara del muñeco.
  const rg = { t: 0, eje: null, ax: 0, ay: 0 };
  canvas.addEventListener('wheel', e => { if (o.ruedaConCtrl && !motor.editando && !motor.caminando && !document.fullscreenElement && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); viaje = null; frena(); const k = e.deltaMode ? 30 : 1, dx = e.deltaX * k, dy = e.deltaY * k;
    if (motor.alRueda && motor.alRueda(e, dx, dy)) { motor.dirty = true; return; }
    // un mismo gesto de dos dedos en el trackpad (eventos seguidos) queda en lo que empezó: girar o acercar. Si no, un dedo que se desvía hace las dos cosas a la vez.
    const ya = performance.now(); if (ya - rg.t > 180) { rg.eje = null; rg.ax = rg.ay = 0; } rg.t = ya;
    if (!e.ctrlKey && !e.shiftKey && !rg.eje) { rg.ax += Math.abs(dx); rg.ay += Math.abs(dy); if (rg.ax + rg.ay >= 20 || Math.abs(dy) >= 40) rg.eje = rg.ax > rg.ay ? 'x' : 'y'; }
    if (e.shiftKey && !e.ctrlKey) C.pitch = incl(C.pitch + (dy || dx) * 0.003);
    else if (!e.ctrlKey && rg.eje === 'x') C.yaw -= dx * 0.004;
    else if (e.ctrlKey || rg.eje === 'y') { rueda.k += dy * (e.ctrlKey && Math.abs(dy) < 50 ? 0.009 : 0.0011); rueda.x = motor.caminando ? null : e.clientX; rueda.y = e.clientY; }
    motor.dirty = true; }, { passive: false });
  // Safari en la Mac: girar y pellizcar con dos dedos sobre el trackpad
  let gs = null; canvas.addEventListener('gesturestart', e => { e.preventDefault(); gs = { r: e.rotation, s: e.scale }; });
  canvas.addEventListener('gesturechange', e => { e.preventDefault(); if (!gs) return; C.yaw += (e.rotation - gs.r) * Math.PI / 180; zoomHacia(gs.s / e.scale, motor.caminando ? null : e.clientX, e.clientY); gs = { r: e.rotation, s: e.scale }; motor.dirty = true; });
  canvas.addEventListener('gestureend', e => { e.preventDefault(); gs = null; });
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
    if (!motor.editando && !motor.caminando) { const g = (K.q ? 1 : 0) - (K.e ? 1 : 0); if (g) { C.yaw += g * dt * 1.5; viaje = null; motor.dirty = true; } }
    // la rueda acerca en varios cuadros y lo que se soltó en movimiento frena de a poco
    if (Math.abs(rueda.k) > 1e-4) { const p = rueda.k * (1 - Math.exp(-dt * 16)); rueda.k -= p; zoomHacia(Math.exp(p), rueda.x, rueda.y); } else rueda.k = 0;
    if (!arr && !gesto && (vel.yaw || vel.pitch || vel.tx || vel.tz)) { const f = Math.exp(-dt * 5.5); C.yaw += vel.yaw * dt; C.pitch = incl(C.pitch + vel.pitch * dt); C.tx += vel.tx * dt; C.tz += vel.tz * dt;
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
