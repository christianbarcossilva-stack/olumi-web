// Motor 3D común de Unity Tech (Ondi, Olumi y Kliva) · núcleo: dibujo, luz, cámara y controles (mouse, trackpad, dedos y teclado).
// La escena no vive acá: son piezas en datos (piezas.js) que se editan con maqueta.js y construir.js.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
export { THREE };

// día: sol de tarde con sombras marcadas y cielo con bruma; noche: azul profundo con estrellas (el brillo lo ponen las piezas)
const TEMAS = {
  claro: { ao: 0.9, sat: 1.1, bal: [1.035, 1.0, 0.955], alto: 0x5f9ee0, cielo: 0xd9e6ef, niebla: 0xd6e2eb, sol: 0xffe7c2, solI: 3.6, hemiA: 0xbcd6f0, hemiB: 0x84745f, hemiI: 0.5, env: 0.7, exp: 0.84, umbral: 1.5, brillo: 0.22, borde: 0.35, noche: 0, cerca: 700, lejos: 4200 },
  oscuro: { ao: 0.75, sat: 1.05, bal: [1, 1, 1], alto: 0x02060c, cielo: 0x0a1824, niebla: 0x08131d, sol: 0x9fb8ff, solI: 0.55, hemiA: 0x4a6c96, hemiB: 0x0b0f15, hemiI: 0.7, env: 0.2, exp: 1.18, umbral: 0.5, brillo: 0.85, borde: 0.75, noche: 1, cerca: 500, lejos: 2600 }
};
// horas del día: cuatro momentos. Mañana y mediodía usan las piezas de día; hora azul y noche, las de noche (luces prendidas).
// sold = desde dónde viene el sol o la luna (x, y, z): baja en la mañana y al atardecer, así las sombras se alargan.
const HORAS = {
  manana: { ...TEMAS.claro, bal: [1.06, 1.0, 0.92], base: 'claro', n: 'Mañana', sold: [1.5, 0.8, 0.9], alto: 0x6c9fd8, cielo: 0xf3dfc8, niebla: 0xe9dccb, sol: 0xffd3a0, solI: 3.1, hemiA: 0xc7d6ea, hemiB: 0x7a6f60, env: 0.66, exp: 0.86, borde: 0.4 },
  dia: { ...TEMAS.claro, base: 'claro', n: 'Mediodía', sold: [-1.1, 2.2, 1.4] },
  azul: { ...TEMAS.oscuro, base: 'oscuro', n: 'Hora azul', sold: [-1.7, 0.55, 0.7], alto: 0x16264f, cielo: 0x9a6f9c, niebla: 0x4a4468, sol: 0x9fb0ff, solI: 0.95, hemiA: 0x6e84c8, hemiB: 0x191c2a, hemiI: 1.05, env: 0.3, exp: 1.12, umbral: 0.55, brillo: 0.8, borde: 0.7, noche: 0.3, cerca: 600, lejos: 3200 },
  noche: { ...TEMAS.oscuro, base: 'oscuro', n: 'Noche', sold: [-1.1, 2.2, 1.4] } };
// clima: cambia el cielo, la fuerza del sol y la bruma encima de la hora que sea. gris = cuánto se tapa el cielo; espesa = bruma [cerca, lejos, × distancia, × distancia]
const CLIMAS = { despejado: { n: 'Despejado' }, nublado: { n: 'Nublado', gris: 0.8, sol: 0.3, hemi: 1.4 }, lluvia: { n: 'Lluvia', gris: 0.92, sol: 0.14, hemi: 1.25, exp: 0.94, osc: 0.8, espesa: [70, 760, 1.15, 4.4] }, niebla: { n: 'Niebla', gris: 0.96, sol: 0.2, hemi: 1.5, espesa: [8, 230, 0.22, 2.2] } };
function conClima(T, c) { const K = CLIMAS[c]; if (!K || !K.gris) return T; const col = h => new THREE.Color(h), g = col(T.cielo), L = (g.r * 0.3 + g.g * 0.55 + g.b * 0.15) * (K.osc || 1), gr = new THREE.Color(L * 0.95, L * 0.98, L * 1.04), m = (h, k, f = 1) => col(h).lerp(gr.clone().multiplyScalar(f), k).getHex();
  return { ...T, alto: m(T.alto, K.gris, 0.8), cielo: m(T.cielo, K.gris), niebla: m(T.niebla, K.gris), sol: m(T.sol, 0.6, 1.6), solI: T.solI * K.sol, hemiI: T.hemiI * K.hemi, exp: T.exp * (K.exp || 1), noche: Math.min(T.noche, 0.5), disco: 0, espesa: K.espesa || null }; }
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

// ---------- resplandor de las luces (propio, sin librerías): la escena se dibuja aparte, lo que brilla se desenfoca en dos tamaños y se suma;
// al final se oscurecen apenas los bordes. Es lo que hace que de noche un foco o una ventana encendida «tiren luz» y no sean un color plano.
const P_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const P_BRILLO = 'uniform sampler2D t; uniform float umbral; varying vec2 vUv; void main(){ vec3 c = min(texture2D(t, vUv).rgb, vec3(14.0)); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(umbral, umbral + 0.7, l), 1.0); }';
const P_BLUR = 'uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227027; c += (texture2D(t, vUv + d * 1.3846).rgb + texture2D(t, vUv - d * 1.3846).rgb) * 0.316216; c += (texture2D(t, vUv + d * 3.2308).rgb + texture2D(t, vUv - d * 3.2308).rgb) * 0.07027; gl_FragColor = vec4(c, 1.0); }';
// sombra de contacto (oclusión ambiental propia): mira la profundidad alrededor de cada punto y oscurece rincones, pies de muebles y encuentros de pared y piso.
// Es lo que saca el aspecto «de plástico»: las cosas quedan apoyadas y con volumen. El radio crece con la distancia, así se nota de cerca y de lejos.
const P_AO = `uniform sampler2D tD; uniform mat4 pInv; uniform float p11, asp; uniform vec2 px; varying vec2 vUv;
  vec3 pos(vec2 uv){ uv = (floor(uv / px) + 0.5) * px; /* al centro del punto de la imagen: si no, en superficies muy inclinadas aparecen franjas */ float d = texture2D(tD, uv).x; vec4 v = pInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
  void main(){ vec2 u0 = vUv - 0.5 * px; /* el centro de un punto de la imagen grande: justo en el borde entre dos, cada placa de video elige distinto y quedan franjas */ float d0 = texture2D(tD, (floor(u0 / px) + 0.5) * px).x; if (d0 >= 0.999999) { gl_FragColor = vec4(1.0, 9000.0, 0.0, 1.0); return; }
    vec3 p = pos(u0), pl = pos(u0 - vec2(px.x, 0.0)), pr = pos(u0 + vec2(px.x, 0.0)), pd = pos(u0 - vec2(0.0, px.y)), pu = pos(u0 + vec2(0.0, px.y));
    vec3 dx = abs(pl.z - p.z) < abs(pr.z - p.z) ? p - pl : pr - p, dy = abs(pd.z - p.z) < abs(pu.z - p.z) ? p - pd : pu - p, n = normalize(cross(dx, dy));
    float z = -p.z, radio = clamp(z * 0.035, 0.2, 7.0), ruv = radio * p11 / z * 0.5, ang = (mod(floor(gl_FragCoord.x), 4.0) * 5.0 + mod(floor(gl_FragCoord.y), 4.0) * 3.0 + mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) * 8.0) / 16.0 * 6.2832, s = 0.0;
    for (int i = 0; i < 12; i++) { float f = sqrt((float(i) + 0.5) / 12.0), a = ang + float(i) * 2.39996; vec3 v = pos(u0 + vec2(cos(a) / asp, sin(a)) * f * ruv) - p; float l = length(v) + 0.0001;
      s += max(0.0, dot(n, v) / l - 0.16) * smoothstep(radio * 1.7, radio * 0.35, l); }
    gl_FragColor = vec4(clamp(1.0 - s / 12.0 * 3.3, 0.0, 1.0), z, 0.0, 1.0); }`;
const P_AOB = `uniform sampler2D t; uniform vec2 d; varying vec2 vUv;
  void main(){ vec2 c = texture2D(t, vUv).rg; float s = 0.0, w = 0.0;
    for (int i = 0; i < 4; i++) { vec2 q = texture2D(t, vUv + d * (float(i) - 1.5)).rg; float k = step(abs(q.g - c.g), 0.05 * c.g + 0.06) + 0.0001; s += q.r * k; w += k; }
    gl_FragColor = vec4(s / w, c.g, 0.0, 1.0); }`;
const P_FINAL = `uniform sampler2D t, b1, b2, b3, ao; uniform float fuerza, borde, aoF, sat; uniform vec3 bal; varying vec2 vUv;
  void main(){ vec3 c = texture2D(t, vUv).rgb; float o = texture2D(ao, vUv).r; c *= mix(vec3(1.0), mix(vec3(0.2, 0.17, 0.17), vec3(1.0), o), aoF);
    c += (texture2D(b1, vUv).rgb * 0.55 + texture2D(b2, vUv).rgb * 0.8 + texture2D(b3, vUv).rgb * 1.0) * fuerza;
    // color: balance (más cálido de día) y un poco más de saturación; los bordes apenas más oscuros
    c *= bal; c = max(mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, sat), 0.0); vec2 q = vUv - 0.5; c *= 1.0 - borde * dot(q, q);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
function crearPost(renderer) { let ok = false; try { ok = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')); } catch (e) {} if (!ok) return null;
  const esc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; esc.add(quad);
  const M = (fs, u, tono) => new THREE.ShaderMaterial({ vertexShader: P_VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, toneMapped: !!tono });
  const mBr = M(P_BRILLO, { t: { value: null }, umbral: { value: 1 } }), mBl = M(P_BLUR, { t: { value: null }, d: { value: new THREE.Vector2() } }), mFi = M(P_FINAL, { t: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null }, ao: { value: null }, fuerza: { value: 0.5 }, borde: { value: 0.5 }, aoF: { value: 0 }, sat: { value: 1 }, bal: { value: new THREE.Vector3(1, 1, 1) } }, true),
    mAO = M(P_AO, { tD: { value: null }, pInv: { value: new THREE.Matrix4() }, p11: { value: 1 }, asp: { value: 1 }, px: { value: new THREE.Vector2() } }), mAB = M(P_AOB, { t: { value: null }, d: { value: new THREE.Vector2() } });
  const tam = new THREE.Vector2(); let W = 0, H = 0, rE = null, niv = [], aoA = null, aoB = null;
  const rt = (w, h, o) => new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), Object.assign({ type: THREE.HalfFloatType, depthBuffer: false }, o));
  const pasa = (m, dst) => { quad.material = m; renderer.setRenderTarget(dst); renderer.render(esc, cam); };
  return { umbral: 1, fuerza: 0.5, borde: 0.5, ao: 0.85, sat: 1.06, bal: [1, 1, 1],
    dibujar(scene, camara) { renderer.getDrawingBufferSize(tam); if (tam.x !== W || tam.y !== H) { W = tam.x; H = tam.y; if (rE) rE.dispose(); niv.forEach(n => { n[0].dispose(); n[1].dispose(); }); if (aoA) { aoA.dispose(); aoB.dispose(); } rE = rt(W, H, { depthBuffer: true, samples: 4, depthTexture: new THREE.DepthTexture(W, H) }); aoA = rt(W / 2 | 0, H / 2 | 0); aoB = rt(W / 2 | 0, H / 2 | 0); niv = [2, 4, 8].map(k => [rt(W / k | 0, H / k | 0), rt(W / k | 0, H / k | 0)]); }
      const antes = renderer.getRenderTarget(); renderer.setRenderTarget(rE); renderer.render(scene, camara);
      if (this.ao > 0.01) { const u = mAO.uniforms; u.tD.value = rE.depthTexture; u.pInv.value.copy(camara.projectionMatrixInverse); u.p11.value = camara.projectionMatrix.elements[5]; u.asp.value = W / H; u.px.value.set(1 / W, 1 / H); pasa(mAO, aoA);
        mAB.uniforms.t.value = aoA.texture; mAB.uniforms.d.value.set(1 / aoA.width, 0); pasa(mAB, aoB); mAB.uniforms.t.value = aoB.texture; mAB.uniforms.d.value.set(0, 1 / aoA.height); pasa(mAB, aoA); }
      mFi.uniforms.ao.value = aoA.texture; mFi.uniforms.aoF.value = this.ao > 0.01 ? this.ao : 0; mFi.uniforms.sat.value = this.sat; mFi.uniforms.bal.value.set(this.bal[0], this.bal[1], this.bal[2]);
      let src = rE.texture; mBr.uniforms.umbral.value = this.umbral;
      niv.forEach(([a, b], i) => { if (i === 0) { mBr.uniforms.t.value = src; pasa(mBr, a); } else { mBl.uniforms.t.value = src; mBl.uniforms.d.value.set(0, 0); pasa(mBl, a); }
        for (let v = 0; v < 2; v++) { mBl.uniforms.t.value = a.texture; mBl.uniforms.d.value.set(1 / a.width, 0); pasa(mBl, b); mBl.uniforms.t.value = b.texture; mBl.uniforms.d.value.set(0, 1 / a.height); pasa(mBl, a); } src = a.texture; });
      Object.assign(mFi.uniforms, {}); mFi.uniforms.t.value = rE.texture; mFi.uniforms.b1.value = niv[0][0].texture; mFi.uniforms.b2.value = niv[1][0].texture; mFi.uniforms.b3.value = niv[2][0].texture; mFi.uniforms.fuerza.value = this.fuerza; mFi.uniforms.borde.value = this.borde; pasa(mFi, antes); } }; }

export function crearMotor(canvas, o = {}) {
  const tactil = matchMedia('(pointer:coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.captura });
  renderer.setPixelRatio(Math.min(devicePixelRatio, tactil ? 2 : 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.5, 6000);
  // el resplandor va en la compu; en el celular queda apagado por ahora (pesa), y ?post=0 o ?post=1 lo fuerzan
  const qp = new URLSearchParams(location.search).get('post'), post = qp === '0' || o.captura ? null : (qp === '1' || !tactil) ? crearPost(renderer) : null;
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
  const motor = { THREE, scene, cam, renderer, canvas, C, sol, hemi, tactil, post, cada: [], despues: [], alTema: [], tema: 'claro', dirty: true };
  motor.inicio = v => { Object.assign(HOME, v); Object.assign(C, v); };
  motor.ir = (v, t = 0.9) => { if (v.yaw !== undefined) { let d = v.yaw - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); v = { ...v, yaw: C.yaw + d }; } viaje = { de: { ...C }, a: { ...C, ...v }, t: 0, dur: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : t }; };
  motor.casa = () => ({ tx: HOME.tx, tz: HOME.tz, yaw: HOME.yaw, pitch: HOME.pitch, d: HOME.d });
  motor.vista = () => motor.ir({ tx: HOME.tx, tz: HOME.tz, yaw: HOME.yaw, pitch: HOME.pitch, d: HOME.d });
  const SD = new THREE.Vector3(-1.1, 2.2, 1.4).normalize(); // de dónde viene el sol (cambia con la hora)
  // plano cercano: de él depende que dos pisos casi a la misma altura (pasto y hormigón, a 2 cm) no se mezclen a lo lejos. Con 6 cm, a 200 m la
  // placa confunde la profundidad de a 4 a 8 cm; con 80 cm, de a milímetros (medido el 21/11 en la maqueta más grande). Va lo más lejos que se
  // pueda sin cortar lo que la cámara tiene al lado: a pie sigue en 6 cm (pasa junto a la gente y los muebles; con 50 cm se veían cortados) y
  // crece con la altura sobre el piso que se pisa (motor.piso, que lo avisa recorrer.js) al volar; mirando de arriba, con la altura de la cámara.
  const planoCercano = alto => motor.caminando ? Math.max(0.06, Math.min(1, (alto - (motor.piso || 0) - 1.5) * 0.04)) : C.d < 6 ? 0.06 : Math.max(0.5, Math.min(4, (alto - (C.ty || 0)) * 0.04));
  const LX = new THREE.Vector3(), LY = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0);
  function ubicarCam() { const cp = Math.cos(C.pitch); const ty = C.ty || 0, camY = ty + C.d * Math.sin(C.pitch), cerca = planoCercano(camY); if (Math.abs(cam.near - cerca) > cam.near * 0.04) { cam.near = cerca; cam.updateProjectionMatrix(); }
    if (motor.borde) { const B = motor.borde; C.tx = Math.min(B.x1, Math.max(B.x0, C.tx)); C.tz = Math.min(B.z1, Math.max(B.z0, C.tz)); }
    if (motor.bruma) { const e = motor.espesa; scene.fog.near = e ? Math.max(e[0], C.d * e[2]) : Math.max(motor.bruma[0], C.d * 1.6); scene.fog.far = e ? Math.max(e[1], C.d * e[3]) : Math.max(motor.bruma[1], C.d * 5); }
    // recorriendo, la cámara puede bajar para mirar hacia arriba (una columna, un foco, un techo): si llega al piso se acerca al muñeco en vez de atravesarlo
    let dd = C.d, yy = camY; if (motor.caminando && C.pitch < 0) { const suelo = (motor.piso || 0) + 0.25; if (yy < suelo) { dd = Math.max(0.3, (ty - suelo) / -Math.sin(C.pitch)); yy = ty + dd * Math.sin(C.pitch); } }
    cam.position.set(C.tx + dd * cp * Math.sin(C.yaw), yy, C.tz + dd * cp * Math.cos(C.yaw)); cam.lookAt(C.tx, ty, C.tz);
    // la sombra sigue a lo que se mira y se ajusta al zoom (más nítida de cerca). Recorriendo (a pie o en vuelo) la cámara está encima de lo que
    // mira y ve lejos: la caja crece con la altura y se corre hacia adelante (antes era un cuadrado de 40 m alrededor del que vuela y, más allá,
    // nada tenía sombra). Crece de a escalones y se mueve de a puntos enteros del mapa de sombras, para que las sombras no tiemblen al avanzar.
    let r = Math.max(40, C.d * 0.85), sx = C.tx, sz = C.tz;
    if (motor.caminando) { r = Math.max(60, (camY - (motor.piso || 0)) * 5); r = 40 * Math.pow(1.25, Math.ceil(Math.log(r / 40) / Math.log(1.25) - 1e-6));
      const ade = r * 0.55 * Math.min(1, Math.max(0, 1 - (C.pitch - 0.3) / 0.9)); sx -= Math.sin(C.yaw) * ade; sz -= Math.cos(C.yaw) * ade; }
    r = Math.min(700, r); Object.assign(sol.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 6 }); sol.shadow.camera.updateProjectionMatrix();
    const paso = 2 * r / sol.shadow.mapSize.x; LX.crossVectors(ARRIBA, SD).normalize(); LY.crossVectors(SD, LX);
    const u = sx * LX.x + sz * LX.z, v = sx * LY.x + sz * LY.z, du = Math.round(u / paso) * paso - u, dv = Math.round(v / paso) * paso - v, px = sx + LX.x * du + LY.x * dv, py = LY.y * dv, pz = sz + LX.z * du + LY.z * dv;
    sol.position.set(px + SD.x * r * 2.8, py + SD.y * r * 2.8, pz + SD.z * r * 2.8); sol.target.position.set(px, py, pz); }

  motor.horas = Object.keys(HORAS).map(k => [k, HORAS[k].n]); motor.climas = Object.keys(CLIMAS).map(k => [k, CLIMAS[k].n]); motor.clima = 'despejado';
  // cambiar el clima: solo se mueve la luz y el cielo (las piezas no se rearman)
  motor.ponerClima = c => { if (!CLIMAS[c] || c === motor.clima) return; motor.clima = c; motor.ponerTema(motor.tema, true); };
  // cambiar de hora: si no cambia de día a noche (o al revés) solo se mueve la luz; si cambia, además se rearman las piezas (luces prendidas o apagadas)
  motor.ponerHora = h => { if (!HORAS[h]) return; motor.hora = h; motor.ponerTema(HORAS[h].base, HORAS[h].base === motor.tema); };
  motor.ponerTema = (t, soloLuz) => { motor.tema = t = t === 'oscuro' ? 'oscuro' : 'claro'; if (!HORAS[motor.hora] || HORAS[motor.hora].base !== t) motor.hora = t === 'oscuro' ? 'noche' : 'dia'; const T = conClima(HORAS[motor.hora], motor.clima); motor.espesa = T.espesa || null; SD.set(T.sold[0], T.sold[1], T.sold[2]).normalize(); cieloU.solD.value.copy(SD); scene.background.set(T.cielo); scene.fog.color.set(T.niebla); scene.fog.near = T.cerca; scene.fog.far = T.lejos; motor.bruma = [T.cerca, T.lejos];
    cieloU.alto.value.set(T.alto); cieloU.hor.value.set(T.cielo); cieloU.solC.value.set(T.sol).multiplyScalar(T.disco ?? 1); cieloU.noche.value = T.noche;
    sol.color.set(T.sol); sol.intensity = T.solI; hemi.color.set(T.hemiA); hemi.groundColor.set(T.hemiB); hemi.intensity = T.hemiI; scene.environmentIntensity = T.env; renderer.toneMappingExposure = T.exp; if (post) { post.umbral = T.umbral; post.fuerza = T.brillo; post.borde = T.borde; post.ao = T.ao ?? 0.85; post.sat = T.sat ?? 1.06; post.bal = T.bal || [1, 1, 1]; }
    // de día el reflejo de chapas y vidrios es el del cielo de la maqueta (no el de una sala de estudio); de noche queda el reflejo tenue de antes
    if (t === 'claro') { const uu = THREE.UniformsUtils.clone(cieloU); uu.alto.value.lerp(uu.hor.value, 0.72); /* cielo más pálido para alumbrar: si no, las sombras quedan azules */ const s = new THREE.Scene(), c2 = new THREE.Mesh(cielo.geometry, new THREE.ShaderMaterial({ uniforms: uu, vertexShader: CIELO_VS, fragmentShader: CIELO_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false })), ps = new THREE.Mesh(new THREE.CircleGeometry(90, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xa9a59b })); c2.scale.setScalar(60); c2.renderOrder = -10; ps.position.y = -2; s.add(c2, ps); if (envCielo) envCielo.dispose(); envCielo = pmrem.fromScene(s, 0.035, 0.1, 400).texture; scene.environment = envCielo; ps.geometry.dispose(); ps.material.dispose(); c2.material.dispose(); } else scene.environment = envSala;
    document.documentElement.dataset.tema = t; motor.dirty = true; if (!soloLuz) motor.alTema.forEach(f => f(t)); };

  // rayos: punto del piso bajo el mouse y piezas tocadas
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), piso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  motor.rayo = (x, y) => { const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); return ray; };
  motor.pisoY = 0; motor.enPiso = (x, y, h = motor.pisoY) => {   // editando en una planta alta, el puntero cae sobre el piso de esa planta
   piso.constant = -h; const p = new THREE.Vector3(); return motor.rayo(x, y).ray.intersectPlane(piso, p) ? p : null; };
  motor.tocar = (x, y, objs) => motor.rayo(x, y).intersectObjects(objs, true);
  motor.aPantalla = v => { const p = v.clone().project(cam), r = canvas.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, z: p.z }; };

  // controles de Los Sims 4: rueda acerca hacia el mouse, clic derecho gira, arrastrar el piso desplaza; WASD/flechas desplazan, Z/X acercan, , . giran
  // el editor puede quedarse con un arrastre devolviendo true en motor.agarrar(e)
  const dedos = new Map(); let arr = null, gesto = null, teclas = {}, largo = 0; const vuelta = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const vel = { yaw: 0, pitch: 0, tx: 0, tz: 0 }, rueda = { k: 0, x: 0, y: 0 }; let tMov = 0; const frena = () => { vel.yaw = vel.pitch = vel.tx = vel.tz = 0; };
  const zoomHacia = (k, x, y) => { const a = x != null && motor.enPiso(x, y); C.d = Math.min(C.max, Math.max(C.min, C.d * k)); if (a) { ubicarCam(); const b = motor.enPiso(x, y); if (b) { C.tx += a.x - b.x; C.tz += a.z - b.z; } } motor.dirty = true; };
  motor.zoomHacia = zoomHacia;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { try { canvas.setPointerCapture(e.pointerId); } catch (er) {} dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); viaje = null; frena(); rueda.k = 0;
    if (dedos.size === 2) { arr = null; clearTimeout(largo); const [a, b] = [...dedos.values()]; gesto = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, modo: null, giro: false }; Object.assign(gesto, { d0: gesto.d, ang0: gesto.ang, mx0: gesto.mx, my0: gesto.my }); motor.soltar && motor.soltar(e, true); return; }
    // con un material en la mano (piso, pincel de terreno) y el mouse, se pinta con Shift apretado; sin Shift el arrastre mueve la vista. En pantallas táctiles, el dedo pinta
    const conShift = e.pointerType === 'mouse' && motor.pintaConShift && motor.pintaConShift();
    if (e.button === 0 && (conShift ? e.shiftKey : !e.shiftKey) && motor.agarrar && motor.agarrar(e)) { arr = { editor: true }; return; }
    // gira: clic derecho, ruedita, Ctrl o Alt + arrastrar (en la Mac, Ctrl + clic es el clic derecho); caminando, cualquier arrastre mira alrededor
    const girar = e.button === 2 || e.button === 1 || (e.button === 0 && (e.ctrlKey || (e.altKey && !motor.editando) || motor.caminando || motor.mirando));
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
  // ---------- mira: el mouse tomado, como en un juego ----------
  // Mover el mouse mira (sin arrastrar) y la mira del centro de la pantalla hace de puntero: todo lo que el editor hace con el mouse (elegir, agarrar,
  // ubicar, dibujar) lo hace igual, apuntando con la mira. Por eso los toques del mouse se vuelven a mandar como si salieran del centro de la pantalla.
  // Esc suelta el mouse (lo hace el navegador). motor.mira(true) lo toma (tiene que venir de un clic o una tecla); motor.mirando dice si está tomado.
  // ---------- ajustes del jugador (se guardan en el equipo): sensibilidad del mouse, eje invertido y una tecla por acción ----------
  // Las teclas se leen por acción: quien las usa (recorrer, el editor) pasa cada tecla por motor.canon(), que devuelve la tecla de fábrica de la acción
  // que el jugador puso en esa tecla. Una tecla de fábrica que quedó sin acción no hace nada. Mañana el mando y la VR entran por el mismo lugar.
  const ACC = { adelante: 'w', atras: 's', izq: 'a', der: 'd', saltar: ' ', correr: 'shift', subir: 'e', bajar: 'q', vista: 'v', editar: 'f', inventario: 'tab', girar: 'r' };
  const AJ = { sens: 1, invY: false, encimar: false, personaje: '', teclas: {} }; try { const g = JSON.parse(localStorage.getItem('motor.ajustes')); if (g && typeof g === 'object') Object.assign(AJ, g, { teclas: { ...(g.teclas || {}) } }); } catch (er) {}
  let DE = {}; const teclaDe = a => AJ.teclas[a] || ACC[a];
  function mapear() { DE = {}; for (const a in ACC) DE[teclaDe(a)] = ACC[a]; for (const a in ACC) if (!(ACC[a] in DE)) DE[ACC[a]] = ''; AJ.sens = Math.max(0.2, Math.min(3, +AJ.sens || 1)); }
  mapear(); motor.aj = AJ; motor.ACC = ACC; motor.teclaDe = teclaDe; motor.canon = k => (k in DE ? DE[k] : k);
  motor.nomTecla = k => ({ ' ': 'Espacio', shift: 'Shift', tab: 'Tab', enter: 'Enter', control: 'Ctrl', alt: 'Alt', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', backspace: 'Retroceso', capslock: 'Bloq Mayús' }[k] || (k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1)));
  motor.guardarAj = () => { mapear(); try { localStorage.setItem('motor.ajustes', JSON.stringify(AJ)); } catch (er) {} motor.alAjustes && motor.alAjustes(); };
  const MI = { x: 0, y: 0, f: NaN, t: -1e9, btn: 0, ok: false, falla: 0, s: 0.0021, prog: -1e9 }, sint = new WeakSet(); motor.mirando = false; motor.sinMira = !canvas.requestPointerLock || navigator.webdriver === true;   // un navegador manejado por un programa (las pruebas) no toma el mouse: el de pruebas se cae al apretar una tecla con el mouse tomado
  const enCentro = () => { const r = canvas.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  function alCentro(tipo, e) { const [x, y] = enCentro(), ini = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: e ? e.button : -1, buttons: e ? e.buttons : MI.btn, shiftKey: e ? e.shiftKey : !!teclas.shift, altKey: e ? e.altKey : !!teclas.alt, ctrlKey: !!(e && e.ctrlKey), metaKey: !!(e && e.metaKey) };
    const s = tipo === 'dblclick' ? new MouseEvent(tipo, ini) : new PointerEvent(tipo, { ...ini, pointerId: (e && e.pointerId) || 1, pointerType: 'mouse', isPrimary: true }); sint.add(s); canvas.dispatchEvent(s); }
  function ponMira(on) { if (motor.mirando === on) return; motor.mirando = on; MI.x = MI.y = 0; MI.f = NaN; MI.btn = 0; if (on) { MI.ok = true; frena(); } else MI.t = performance.now();
    document.documentElement.classList.toggle('mirando', on); canvas.classList.remove('sobre', 'arrastra'); motor.alMira && motor.alMira(on); motor.dirty = true;
    // el mouse se soltó sin que el motor lo pidiera (Esc o se cambió de ventana): como en cualquier juego, eso es la pausa
    if (!on && performance.now() - MI.prog > 500) motor.alPausa && motor.alPausa(); if (on) motor.alRetomar && motor.alRetomar(); }
  motor.mira = (on, porEsc) => { if (on === motor.mirando) return; if (!on) { MI.prog = porEsc ? -1e9 : performance.now(); if (document.pointerLockElement === canvas) document.exitPointerLock(); else ponMira(false); return; }
    if (motor.sinMira || tactil) return; try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (er) {} };
  motor.reapuntar = () => { MI.f = NaN; motor.dirty = true; };   // vuelve a mirar qué hay en la mira (cambió la herramienta o lo que se tiene en la mano)
  motor._mira = ponMira;   // para las pruebas (el navegador de pruebas no siempre deja tomar el mouse)
  document.addEventListener('pointerlockchange', () => ponMira(document.pointerLockElement === canvas));
  // si el navegador no deja tomar el mouse nunca (dos intentos y ninguno anduvo), se sigue como antes: mirar arrastrando
  document.addEventListener('pointerlockerror', () => { if (!MI.ok && ++MI.falla >= 2) { motor.sinMira = true; motor.alMira && motor.alMira(false); } else motor.alMiraFalla && motor.alMiraFalla(); });   // el navegador no dejó tomar el mouse esta vez: se avisa cómo seguir
  const tope = v => Math.max(-120, Math.min(120, v || 0));
  for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'pointermove', 'dblclick']) addEventListener(t, e => { if (!motor.mirando || sint.has(e) || e.target !== canvas || (e.pointerType && e.pointerType !== 'mouse')) return;
    e.stopImmediatePropagation(); if (t === 'pointermove') { MI.x += tope(e.movementX); MI.y += tope(e.movementY); return; } MI.btn = e.buttons || 0; alCentro(t, e); }, true);
  addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (motor.mirando) { e.stopImmediatePropagation(); motor.mira(false, true); } else if (performance.now() - MI.t < 350) e.stopImmediatePropagation(); }, true);
  // cada cuadro: el giro del mouse entra suavizado (sin saltos) y, si la cámara se movió, lo que se apunta se actualiza una vez
  function miraGira(dt) { if (!MI.x && !MI.y) return; const k = 1 - Math.exp(-dt * 38), dx = MI.x * k, dy = MI.y * k; MI.x -= dx; MI.y -= dy; if (Math.abs(MI.x) < 0.02) MI.x = 0; if (Math.abs(MI.y) < 0.02) MI.y = 0;
    const s = MI.s * AJ.sens; C.yaw -= dx * s; C.pitch = incl(C.pitch + dy * s * (AJ.invY ? -1 : 1)); viaje = null; motor.dirty = true; }
  function miraApunta() { const f = C.tx * 3.1 + C.tz * 5.3 + (C.ty || 0) * 7.7 + C.yaw * 11.9 + C.pitch * 13.3 + C.d * 17.1; if (Math.abs(f - MI.f) < 1e-5) return; MI.f = f; alCentro('pointermove'); }
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
    if (!motor.caminando) { const g = (K.q ? 1 : 0) - (K.e ? 1 : 0); if (g) { C.yaw += g * dt * 1.5; viaje = null; motor.dirty = true; } }
    // la rueda acerca en varios cuadros y lo que se soltó en movimiento frena de a poco
    if (Math.abs(rueda.k) > 1e-4) { const p = rueda.k * (1 - Math.exp(-dt * 16)); rueda.k -= p; zoomHacia(Math.exp(p), rueda.x, rueda.y); } else rueda.k = 0;
    if (!arr && !gesto && (vel.yaw || vel.pitch || vel.tx || vel.tz)) { const f = Math.exp(-dt * 5.5); C.yaw += vel.yaw * dt; C.pitch = incl(C.pitch + vel.pitch * dt); C.tx += vel.tx * dt; C.tz += vel.tz * dt;
      for (const k in vel) { vel[k] *= f; if (Math.abs(vel[k]) < (k === 'tx' || k === 'tz' ? 0.05 : 0.002)) vel[k] = 0; } motor.dirty = true; }
    if (viaje) { viaje.t += dt / viaje.dur; const k = viaje.t >= 1 ? 1 : 1 - Math.pow(1 - viaje.t, 3); for (const q of ['tx', 'tz', 'yaw', 'pitch', 'd']) C[q] = viaje.de[q] + (viaje.a[q] - viaje.de[q]) * k; if (viaje.t >= 1) viaje = null; motor.dirty = true; }
    if (motor.mirando) miraGira(dt);
    for (const f of motor.cada) if (f(dt, t)) motor.dirty = true;
    if (!motor.dirty) return; motor.dirty = false; ubicarCam(); const a = performance.now(); if (post) post.dibujar(scene, cam); else renderer.render(scene, cam); acc += performance.now() - a; n++; for (const f of motor.despues) f(); if (motor.mirando) miraApunta();
    if (t - t0 > 600) { Object.assign(motor.stats, { fps: Math.round(n * 1000 / (t - t0)), ms: +(acc / Math.max(1, n)).toFixed(1), dibujos: renderer.info.render.calls, triangulos: renderer.info.render.triangles }); n = 0; acc = 0; t0 = t; } }
  let guardado = null; try { guardado = localStorage.getItem('motor.tema'); } catch (e) {}
  { const t0 = o.tema || guardado || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'); let h0 = null; try { h0 = localStorage.getItem('motor.hora'); } catch (e) {} if (!o.tema && HORAS[h0] && HORAS[h0].base === (t0 === 'oscuro' ? 'oscuro' : 'claro')) motor.hora = h0; motor.ponerTema(t0); }
  requestAnimationFrame(cuadro);
  return motor;
}
