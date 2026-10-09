/* The ride through the five festivals.
   In the lesson the camera falls through the clouds into the first realm, and the five festival paintings become one
   journey in path order, joined by the clouds between the islands. Each festival waits frozen until its card arrives,
   then thaws from its heart outward, the same way the map does. A soft depth map per painting lets the near posts,
   trees and bells travel faster than the horizon, so a flat painting reads as a place you are moving through.
   It reads the page's own camera state (st.ra, rc, rx, ry, rz, rx2, rm and the thaw), so scrolling back runs it
   backwards. WebGL2 when the device has it; a plain 2D canvas when it doesn't or when it struggles. */
const EL = ['water', 'wood', 'fire', 'earth', 'metal'];
const AR = 2.5;                                   // every painting is 2.5 times as wide as it is tall
// what drifts in each festival's air: colour; rise per second (screen heights); sideways drift; how many; how big
const AIR = [
  { c: [1, .86, .56], up: .028, side: .006, n: .5, s: 1 },     // water: lantern light lifting off the bay
  { c: [.86, 1, .58], up: .01, side: .014, n: .42, s: .8 },    // wood: fireflies wandering
  { c: [1, .6, .24], up: .085, side: .016, n: .95, s: .85 },   // fire: embers, the most of any realm
  { c: [1, .88, .5], up: -.012, side: .03, n: .4, s: .9 },     // earth: chaff on the breeze
  { c: [.95, .97, 1], up: .006, side: .004, n: .55, s: .62 },  // metal: glints off the bells
];

export function start(film) {
  const stage = document.querySelector('.stage');
  let cv = document.createElement('canvas'); cv.className = 'ride';
  stage.insertBefore(cv, stage.querySelector('.sky'));
  const phone = () => innerWidth / innerHeight < .8;
  const DPR = () => Math.min(devicePixelRatio || 1, 1.5);
  let gl = null;
  try { gl = Q().has('ride2d') ? null : cv.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) {}
  function Q() { return new URLSearchParams(location.search); }

  const imgs = [], depths = [];
  let ready = false, time = 0, shown = false, w = 0, h = 0;
  const load = src => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im)); im.onerror = rej; im.src = src; });

  function size() {
    const d = DPR(), W = Math.round(innerWidth * d), H = Math.round(innerHeight * d);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    w = W; h = H;
  }

  /* ---------- the camera in painting units: the paintings stand side by side, each 2.5 wide and 1 tall ---------- */
  // keep the view inside its own painting, whatever the zoom and the screen's shape
  function cam(st, x = st.rx) {
    const z = Math.max(1, st.rz || 1), half = .5 / z;
    const i = Math.min(4, Math.max(0, Math.floor(x))), hw = Math.min(.5, .5 * (innerWidth / innerHeight) / (z * AR) + .03);
    return { x: Math.min(i + 1 - hw, Math.max(i + hw, x)), y: Math.min(1 - half, Math.max(half, st.ry ?? .5)), z, i };
  }

  /* ---------- WebGL2 ---------- */
  let prog, U = {}, noiseTex;
  const FX = new Float32Array(5);
  function glInit(noise) {
    const vs = `#version 300 es
      in vec2 aP; out vec2 vUv;
      void main(){ vUv = vec2(aP.x * .5 + .5, .5 - aP.y * .5); gl_Position = vec4(aP, 0., 1.); }`;
    const fs = `#version 300 es
      precision highp float; precision highp sampler2DArray;
      uniform sampler2DArray uArt, uDep; uniform sampler2D uNoise;
      uniform vec2 uAsp;            // aspect (w/h), unused y
      uniform vec3 uCam;            // x in paintings, y 0..1, zoom
      uniform vec2 uCam2;           // a second x and how much of it (the reduced-motion crossfade)
      uniform float uA, uC, uF, uT, uAirOn;
      uniform float uThaw[5], uFx[5];
      uniform vec3 uAirC[5]; uniform vec4 uAir[5];
      in vec2 vUv; out vec4 o;
      const float AR = ${AR.toFixed(1)};
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float idxOf(float x){ return clamp(floor(x / AR), 0., 4.); }
      float depthAt(vec2 p){ float i = idxOf(p.x); return texture(uDep, vec3(clamp(vec2(p.x / AR - i, p.y), .002, .998), i)).r; }
      // where on the paintings this pixel looks: near things grow faster under a push and slide further as the camera
      // leaves the spot the painting was made from
      vec2 look(vec2 s, float cx){
        vec2 c = vec2(cx * AR, uCam.y); float z = uCam.z;
        vec2 p = c + s / z;
        for (int k = 0; k < 2; k++){
          float d = depthAt(p) - .3; float i = idxOf(p.x);
          float f = (i + uFx[int(i)]) * AR;
          p = c + s / (z * (1. + .38 * (z - 1.) * d)) + vec2((c.x - f) * .055 * d, 0.);
        }
        p.y = clamp(p.y, .002, .998);
        return p;
      }
      vec3 paint(vec2 p){
        float i = idxOf(p.x); int ii = int(i);
        vec2 l = vec2(clamp(p.x / AR - i, .001, .999), p.y);
        vec3 col = texture(uArt, vec3(l, i)).rgb;
        float t = uThaw[ii];
        if (t < .999){
          // frozen as the map is: deep navy through ice blue to frost white, a little colour left in
          float lu = min(1., dot(col, vec3(.3, .59, .11)) * 1.08 + .02);
          vec3 ice = lu < .5 ? mix(vec3(12., 20., 62.) / 255., vec3(70., 118., 196.) / 255., lu * 2.)
                             : mix(vec3(70., 118., 196.) / 255., vec3(226., 240., 255.) / 255., (lu - .5) * 2.);
          ice = mix(ice, col, .14);
          float n = texture(uNoise, p * .9).r;
          float e = 1. - (1. - t) * (1. - t);
          float edge = 2.3 * e * (1. + .4 * (n - .5));
          float d = distance(vec2(l.x * AR, l.y), vec2(uFx[ii] * AR, .56));
          float m = t <= .001 ? 0. : 1. - smoothstep(edge - .1, edge, d);
          float rim = t <= .001 ? 0. : (1. - smoothstep(0., .07, abs(d - edge + .03))) * sin(3.14159 * t);
          col = mix(ice, col, m) + vec3(1., .82, .42) * rim * .55;      // the thaw line glows warm: growth
        }
        return col;
      }
      vec3 air(vec2 s, float cx, float i){
        int ii = int(i); vec4 A = uAir[ii]; vec3 acc = vec3(0.);
        for (int L = 0; L < 2; L++){
          float fl = float(L);
          float sc = mix(9., 4.6, fl) / A.w;                 // cells per screen height: far small, near larger
          float par = mix(.75, 1.5, fl);                     // near motes pass faster than far ones
          vec2 q = vec2(s.x + cx * AR * par + uT * A.y * (1. + fl), s.y + uT * A.x * (1. + .6 * fl)) * sc;
          vec2 cell = floor(q), f = fract(q) - .5;
          float hsh = hash(cell + fl * 17.3);
          if (hsh > A.z) continue;
          vec2 at = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - .5) * .6;
          at += .12 * vec2(sin(uT * .7 + hsh * 30.), cos(uT * .6 + hsh * 20.));
          float r = mix(.05, .12, hash(cell + 1.9)) * (1. + fl * .5);
          float g = smoothstep(r, 0., length(f - at));
          float tw = .65 + .35 * sin(uT * 1.1 + hsh * 40.);   // slow, never a flicker
          acc += uAirC[ii] * g * g * tw * mix(.55, .85, fl);
        }
        return acc;
      }
      float cloud(vec2 q){ float n = texture(uNoise, q).r * .55 + texture(uNoise, q * 2.17 + .37).r * .3 + texture(uNoise, q * 4.7 + .71).r * .15;
        return smoothstep(.22, .78, n); }
      void main(){
        vec2 s = (vUv - .5) * vec2(uAsp.x, 1.);
        vec2 p = look(s, uCam.x);
        vec3 col = paint(p);
        if (uCam2.y > .001) col = mix(col, paint(look(s, uCam2.x)), uCam2.y);
        float i = idxOf(p.x);
        col += air(s, uCam.x, i) * uAirOn;
        col *= 1. - .2 * smoothstep(.5, 1.25, length((vUv - .5) * vec2(1.25, 1.)) * 1.5);
        vec3 rgb = col * uA; float a = uA;
        // the clouds: they swallow the screen on the way in and out, and hide the painting's edge on a very wide screen
        float sx = fract(p.x / AR); float band = 1. - smoothstep(.0, .025, min(sx, 1. - sx));
        float amt = max(uC, band);
        if (amt > .001){
          vec2 cs = s / uCam.z / mix(1., 1.7, uF);             // the clouds open out as the camera passes through them
          for (int L = 0; L < 2; L++){
            float fl = float(L);
            float sp = mix(1., 1.8, fl);                       // the near bank passes the lens faster
            vec2 q = vec2(uCam.x * AR * sp + cs.x * mix(1., 1.4, fl), cs.y * mix(1., 1.4, fl)) * mix(.42, .3, fl)
                   + vec2(uT * mix(.008, .014, fl), fl * .5);
            float n = cloud(q);
            float k = amt * mix(1., .85, fl), kk = pow(k, 2.2);
            float t0 = .84 - kk * 1.08;                          // wisps first; the screen is only fully white for a moment
            float ca = smoothstep(t0, t0 + .15, n) * smoothstep(0., .1, k) * .85;   // the art always shows through
            // the map's own blue cloud: lit tops, deep undersides, a breath of the festival's light; never brighter than frost
            float lit = smoothstep(.3, .82, n) * (.7 + .24 * (.5 - s.y));
            vec3 cc = mix(vec3(.36, .41, .66), vec3(.80, .83, .93), clamp(lit, 0., 1.));
            cc = min(cc + uAirC[int(i)] * .05 * smoothstep(.55, .92, n), vec3(.84, .86, .94));
            rgb = rgb * (1. - ca) + cc * ca; a = a * (1. - ca) + ca;
          }
        }
        o = vec4(rgb, a);
      }`;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uArt', 'uDep', 'uNoise', 'uAsp', 'uCam', 'uCam2', 'uA', 'uC', 'uF', 'uT', 'uAirOn', 'uThaw', 'uFx', 'uAirC', 'uAir'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(U.uArt, 0); gl.uniform1i(U.uDep, 1); gl.uniform1i(U.uNoise, 2);
    gl.uniform3fv(U.uAirC, AIR.flatMap(a => a.c));
    gl.uniform4fv(U.uAir, AIR.flatMap(a => [a.up, a.side, a.n, a.s]));
    noiseTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noise);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.clearColor(0, 0, 0, 0);
  }
  function arrayTex(unit, list, layers = list.length) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    const [W, H] = dims(list[0]);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, W, H, layers);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D_ARRAY, p, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return { t, W, H };
  }
  // one painting per frame, so the upload never stalls a scroll
  function upload(slot, layer, im, y) {
    gl.activeTexture(gl.TEXTURE0 + slot.unit); gl.bindTexture(gl.TEXTURE_2D_ARRAY, slot.t);
    let [w, h] = dims(im), src = im;
    if (w !== slot.W || (y === 0 && h !== slot.H && h > slot.H / 2)) {   // a painting of another size: fit it to the stack
      const c = document.createElement('canvas'); c.width = slot.W; c.height = slot.H; c.getContext('2d').drawImage(im, 0, 0, slot.W, slot.H); src = c; w = slot.W; h = slot.H;
    }
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, y, layer, w, h, 1, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }
  // value noise that truly wraps at its edges (a scaled-up tile does not, and shows a seam across the clouds)
  function bakeNoise(n = 256) {
    const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
    const d = x.createImageData(n, n), acc = new Float32Array(n * n);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sm = t => t * t * (3 - 2 * t);
    [[6, .5], [12, .27], [24, .15], [48, .08]].forEach(([g, a]) => {
      const L = Float32Array.from({ length: g * g }, rnd);
      for (let j = 0; j < n; j++) {
        const fy = j / n * g, y0 = Math.floor(fy), ty = sm(fy - y0), y1 = (y0 + 1) % g;
        for (let i = 0; i < n; i++) {
          const fx = i / n * g, x0 = Math.floor(fx), tx = sm(fx - x0), x1 = (x0 + 1) % g;
          const top = L[y0 * g + x0] + (L[y0 * g + x1] - L[y0 * g + x0]) * tx;
          const bot = L[y1 * g + x0] + (L[y1 * g + x1] - L[y1 * g + x0]) * tx;
          acc[j * n + i] += (top + (bot - top) * ty) * a;
        }
      }
    });
    for (let k = 0; k < n * n; k++) { const v = Math.max(0, Math.min(255, (acc[k] - .5) * 1.6 * 255 + 128)); d.data[k * 4] = d.data[k * 4 + 1] = d.data[k * 4 + 2] = v; d.data[k * 4 + 3] = 255; }
    x.putImageData(d, 0, 0);
    return c;
  }

  /* ---------- the plain 2D version: the paintings and the clouds, nothing more ---------- */
  let ctx2 = null;
  function draw2d(st) {
    if (!ctx2) ctx2 = cv.getContext('2d');
    const c = cam(st), x = ctx2; x.clearRect(0, 0, w, h);
    const ph = h * c.z, pw = ph * AR;                                   // one painting on screen, in canvas pixels
    const one = (cx, alpha) => {
      const left = w / 2 - cx * pw, top = h / 2 - c.y * ph;
      x.globalAlpha = alpha;
      for (let i = 0; i < 5; i++) { const L = left + i * pw; if (L > w || L + pw < 0) continue; x.drawImage(imgs[i], L, top, pw + 1, ph); }
    };
    one(c.x, st.ra);
    if (st.rm > .001) one(cam(st, st.rx2).x, st.ra * st.rm);
    const fog = still() ? 0 : st.rc;
    if (fog > .001) { x.globalAlpha = Math.min(.82, fog); x.fillStyle = '#8F99C6'; x.fillRect(0, 0, w, h); }
    x.globalAlpha = 1;
  }
  const still = () => film.still;

  /* ---------- draw ---------- */
  let frames = 0, slow = 0, mode2d = !gl, flatReady = !gl;
  function draw(st, dt = 0) {
    const on = ready && st && (st.ra > .001 || st.rc > .001);
    if (on !== shown) { shown = on; cv.style.visibility = on ? 'visible' : 'hidden'; }
    if (!on) return;
    time += dt;
    if (mode2d) { if (flatReady) draw2d(st); return; }
    const c = cam(st);
    st.thaw.forEach((v, i) => { FX[i] = v; });
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uAsp, innerWidth / innerHeight, 0);
    gl.uniform3f(U.uCam, c.x, c.y, c.z);
    gl.uniform2f(U.uCam2, st.rm > .001 ? cam(st, st.rx2).x : 0, st.rm || 0);
    gl.uniform1f(U.uA, st.ra); gl.uniform1f(U.uC, still() ? 0 : st.rc); gl.uniform1f(U.uF, st.rf || 0);
    gl.uniform1f(U.uT, time); gl.uniform1f(U.uAirOn, still() ? 0 : 1);
    gl.uniform1fv(U.uThaw, FX);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frames++;
    if (frames > 20 && frames < 160 && dt > .045) slow++;
    if (slow > 24) toFlat('2d (slow)');
  }

  // decode off the main thread and hand the GPU one band of one painting per frame, so the arrival never stalls a scroll
  const frame = () => new Promise(r => requestAnimationFrame(r));
  let blobs = null;
  const bitmapOf = (b, ...crop) => createImageBitmap(b, ...crop);
  async function wholeImages() {
    if (imgs.length === 5) return;
    const l = await Promise.all(blobs ? blobs.map(b => bitmapOf(b)) : EL.map(e => load(`img/fest-${e}.webp`)));
    l.forEach((im, i) => { imgs[i] = im; });
  }
  const dims = im => [im.naturalWidth || im.width, im.naturalHeight || im.height];
  async function boot() {
    try {
      const canBitmap = typeof createImageBitmap === 'function';
      if (canBitmap) blobs = await Promise.all(EL.map(e => fetch(`img/fest-${e}.webp`).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })));
      if (!gl || !canBitmap) { await wholeImages(); }
      if (gl) {
        const dl = await Promise.all(EL.map(e => canBitmap ? fetch(`img/fest-${e}-d.webp`).then(r => r.blob()).then(b => bitmapOf(b)) : load(`img/fest-${e}-d.webp`)));
        dl.forEach((im, i) => { depths[i] = im; });
        const noise = bakeNoise(); await frame();
        glInit(noise); await frame();
        gl.uniform1fv(U.uFx, film.FEST.map(f => f.fx));
        const dep = Object.assign(arrayTex(1, depths), { unit: 1 });
        for (let i = 0; i < 5; i++) upload(dep, i, depths[i], 0);
        if (canBitmap) {
          const first = await bitmapOf(blobs[0]); const [W, H] = dims(first); first.close && first.close();
          const art = Object.assign(arrayTex(0, [{ width: W, height: H }], 5), { unit: 0 });
          const BANDS = 4, bh = Math.ceil(H / BANDS);
          for (let i = 0; i < 5; i++) {
            for (let k = 0; k < BANDS; k++) {
              const y = k * bh, hh = Math.min(bh, H - y);
              const band = await bitmapOf(blobs[i], 0, y, W, hh);
              await frame(); upload(art, i, band, y); band.close && band.close();
            }
          }
        } else {
          const art = Object.assign(arrayTex(0, imgs), { unit: 0 });
          for (let i = 0; i < 5; i++) { upload(art, i, imgs[i], 0); await frame(); }
        }
        cv.addEventListener('webglcontextlost', e => { e.preventDefault(); toFlat('2d (context lost)'); });
      }
      size(); ready = true; window.__ride = true; window.__rideMode = mode2d ? '2d' : 'webgl2';
      film.rideReady();
    } catch (e) {
      // without the paintings the lesson simply stays on the map
      console.warn('ride off:', e && e.message); cv.remove();
    }
  }
  function toFlat(why) {
    if (mode2d) return;
    mode2d = true; window.__rideMode = why; const n = cv.cloneNode(); cv.replaceWith(n); cv = n; ctx2 = null;
    wholeImages().then(() => { flatReady = true; }).catch(() => {});
  }
  size(); boot();
  return { draw, resize() { size(); } };
}
