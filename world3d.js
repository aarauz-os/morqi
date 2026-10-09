/* The same world in three dimensions: the painting laid out as ground with the five islands lifted off it, cloud
   layers the camera drops through, frost that glints, a warm rim where the ice gives way, and the Qi Stones rising
   when the win condition is read. It reads the page's own camera state, so it always agrees with the flat version,
   and hands the screen back to it if the device struggles. */
import * as THREE from './vendor/three.module.min.js';

export function start(film) {
  const { W, H, EXT, ISLES } = film;
  const U = 100;                                   // painting pixels per world unit
  const stage = document.querySelector('.stage');
  const phone = () => innerWidth / innerHeight < .8;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // the painting's own values in, the same values out
  renderer.toneMapping = THREE.NoToneMapping;
  const pr = () => Math.min(devicePixelRatio || 1, phone() ? 1.5 : 1.75);
  renderer.setPixelRatio(pr()); renderer.setSize(innerWidth, innerHeight);
  const cv = renderer.domElement; cv.className = 'view3d';
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .9s ease';
  stage.insertBefore(cv, stage.querySelector('.eyes'));

  const scene = new THREE.Scene();
  const NIGHT = new THREE.Color(13 / 255, 21 / 255, 70 / 255);
  scene.background = NIGHT;
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .05, 200);

  /* ---------- a soft tiling noise, baked once, shared by the frost edge and the clouds ---------- */
  function bakeNoise(n = 256) {
    const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, n, n);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    [[8, .5], [16, .26], [32, .14], [64, .08]].forEach(([g, a]) => {
      const s = document.createElement('canvas'); s.width = s.height = g; const y = s.getContext('2d'); const d = y.createImageData(g, g);
      for (let i = 0; i < d.data.length; i += 4) { const v = rnd() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      y.putImageData(d, 0, 0);
      x.globalAlpha = a; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) x.drawImage(s, ox * n, oy * n, n, n);   // wrap so it tiles
    });
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
  }
  const noise = bakeNoise();

  /* ---------- the ground: the painting, frozen until thawed ---------- */
  const circles = [];                 // [x, y, r, isle]
  ISLES.forEach((isle, i) => isle.c.forEach(([x, y, r]) => circles.push([x, y, r, i])));
  const PAD = 900;
  const geo = new THREE.PlaneGeometry((W + PAD * 2) / U, (H + EXT + PAD * 1.4) / U, 220, 200);
  geo.rotateX(-Math.PI / 2);
  // x from -PAD to W+PAD, z from -PAD*1.4 (beyond the painting's top) to H+EXT
  geo.translate(W / 2 / U, 0, (H + EXT - PAD * 1.4) / 2 / U);
  const tex = new THREE.Texture(); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const uniforms = {
    tMap: { value: tex }, tNoise: { value: noise }, uReady: { value: 0 },
    uSize: { value: new THREE.Vector2(W, H) },
    uC: { value: circles.map(c => new THREE.Vector3(c[0], c[1], c[2])) },
    uI: { value: circles.map(c => c[3]) },
    uThaw: { value: [0, 0, 0, 0, 0] },
    uTime: { value: 0 }, uNight: { value: NIGHT }, uFog: { value: .035 }, uCam: { value: new THREE.Vector3() },
    uLift: { value: .34 },
  };
  const NC = circles.length;
  const ground = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform vec3 uC[${NC}]; uniform float uI[${NC}]; uniform float uThaw[5]; uniform float uLift; uniform vec3 uCam;
      varying vec2 vPx; varying float vDist;
      float thawOf(float i){ return i < .5 ? uThaw[0] : i < 1.5 ? uThaw[1] : i < 2.5 ? uThaw[2] : i < 3.5 ? uThaw[3] : uThaw[4]; }
      void main(){
        vec3 p = position; vPx = p.xz * ${U}.0;
        float h = 0.0;
        for (int i = 0; i < ${NC}; i++){
          float d = distance(vPx, uC[i].xy);
          float t = thawOf(uI[i]);
          h = max(h, uLift * (.62 + .38 * t) * (1.0 - smoothstep(uC[i].z * .3, uC[i].z * .98, d)));
        }
        p.y += h;
        vec4 wp = modelMatrix * vec4(p, 1.0); vDist = distance(wp.xyz, uCam);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tMap; uniform sampler2D tNoise; uniform vec2 uSize; uniform float uReady;
      uniform vec3 uC[${NC}]; uniform float uI[${NC}]; uniform float uThaw[5];
      uniform float uTime; uniform vec3 uNight; uniform float uFog;
      varying vec2 vPx; varying float vDist;
      float thawOf(float i){ return i < .5 ? uThaw[0] : i < 1.5 ? uThaw[1] : i < 2.5 ? uThaw[2] : i < 3.5 ? uThaw[3] : uThaw[4]; }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        // past the painting's edges, mirror it (clouds continue) before the night takes over
        vec2 q = vPx; q = abs(q); q = uSize - abs(uSize - q);
        vec2 uv = clamp(q / uSize, vec2(.001), vec2(.999));
        vec3 col = texture2D(tMap, vec2(uv.x, 1.0 - uv.y)).rgb;
        // ice: deep navy through ice blue to frost white, a little of the colour left in
        float l = min(1.0, dot(col, vec3(.3, .59, .11)) * 1.08 + .02);
        vec3 ice = l < .5 ? mix(vec3(12., 20., 62.) / 255., vec3(70., 118., 196.) / 255., l * 2.0)
                          : mix(vec3(70., 118., 196.) / 255., vec3(226., 240., 255.) / 255., (l - .5) * 2.0);
        ice = mix(ice, col, .14);
        float n = texture2D(tNoise, vPx / 420.0).r;
        float m = 0.0, rim = 0.0;
        for (int i = 0; i < ${NC}; i++){
          float t = thawOf(uI[i]); if (t <= .001) continue;
          float e = 1.0 - (1.0 - t) * (1.0 - t);
          float edge = uC[i].z * e * (1.0 + .42 * (n - .5));
          float d = distance(vPx, uC[i].xy);
          m = max(m, 1.0 - smoothstep(edge - 38.0, edge, d));
          rim += (1.0 - smoothstep(0.0, 22.0, abs(d - edge + 10.0))) * sin(3.14159 * clamp(t, 0.0, 1.0));
        }
        vec3 c = mix(ice, col, m);
        c += vec3(1.0, .82, .42) * clamp(rim, 0.0, 1.0) * .5;               // the thaw line glows warm: growth
        // frost glints, sparse and slow, only on ice
        vec2 cell = floor(vPx / 7.0); float s = hash(cell);
        float soft = 1.0 - smoothstep(0.0, 2.6, length(fract(vPx / 7.0) * 7.0 - 3.5));   // a round glint, never a square
        float tw = step(.986, s) * soft * (.5 + .5 * sin(uTime * 1.1 + s * 90.0));
        c += vec3(.75, .88, 1.0) * tw * (1.0 - m) * .55;
        // off the painting the world falls away into night
        vec2 o = max(vec2(0.0), max(-vPx, vPx - uSize));
        float off = max(o.x, o.y * (vPx.y > uSize.y ? 2.6 : 1.25));
        c = mix(c, uNight, smoothstep(0.0, 150.0, off) * .985);
        c = mix(c, uNight, 1.0 - exp(-pow(vDist * uFog, 2.0)));
        gl_FragColor = vec4(mix(uNight, c, uReady), 1.0);
      }`,
  }));
  scene.add(ground);

  /* ---------- cloud layers to drop through ---------- */
  const clouds = [];
  [[11.5, .3, 1.0, 0], [8.4, .32, .8, 1], [6.2, .22, 1.15, 2]].forEach(([y, a, sc, k]) => {
    const g = new THREE.PlaneGeometry(34, 32); g.rotateX(-Math.PI / 2); g.translate(W / 2 / U, y, H / 2 / U);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { tNoise: { value: noise }, uTime: { value: 0 }, uA: { value: a }, uS: { value: sc }, uK: { value: k }, uFade: { value: 1 } },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `precision highp float; uniform sampler2D tNoise; uniform float uTime, uA, uS, uK, uFade; varying vec2 vUv; varying vec3 vW;
        void main(){
          vec2 p = vW.xz / (9.0 * uS) + vec2(uTime * .006 + uK * .37, uK * .19);
          float n = texture2D(tNoise, p).r * .65 + texture2D(tNoise, p * 2.3 + .5).r * .35;
          float a = smoothstep(.5, .74, n) * uA * uFade;
          float edge = smoothstep(0.0, .18, vUv.x) * smoothstep(1.0, .82, vUv.x) * smoothstep(0.0, .18, vUv.y) * smoothstep(1.0, .82, vUv.y);
          vec3 c = mix(vec3(.62, .68, .92), vec3(.95, .95, 1.0), smoothstep(.55, .85, n));
          gl_FragColor = vec4(c, a * edge);
        }`,
    });
    const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 2; scene.add(mesh); clouds.push(mesh);
  });

  /* ---------- the Qi Stones ---------- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  const ELC = ['#4E9BE0', '#6FBF4A', '#FF9A4A', '#FFD24A', '#C9D3DB'];
  const loader = new THREE.TextureLoader();
  const stones = ['water', 'wood', 'fire', 'earth', 'metal'].map((el, i) => {
    const t = loader.load(`img/stone-${el}.webp`); t.colorSpace = THREE.NoColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, fog: false }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ELC[i], transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
    s.renderOrder = 6; glow.renderOrder = 5; scene.add(glow); scene.add(s);
    const [x, y] = ISLES[i].c[0];
    return { s, glow, from: new THREE.Vector3(x / U, .5, y / U) };
  });

  /* ---------- the painting ---------- */
  // each size of the painting gets its own texture: a texture's storage is fixed once uploaded
  function useImage(src) {
    return new Promise(res => { const im = new Image(); im.decoding = 'async';
      im.onload = () => { const t = new THREE.Texture(im); t.colorSpace = THREE.NoColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
        const old = uniforms.tMap.value; uniforms.tMap.value = t; if (old !== t) old.dispose(); res(); };
      im.onerror = res; im.src = src; });
  }

  /* ---------- camera from the page's state ---------- */
  const tmp = new THREE.Vector3();
  let px = 0, py = 0;
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { px = e.clientX / innerWidth - .5; py = e.clientY / innerHeight - .5; } }, { passive: true });
  let time = 0, pxS = 0, pyS = 0;
  function place(st, dt) {
    const vw = innerWidth, vh = innerHeight;
    const f = film.frame(st, vw, vh);
    const cx = (f.sx + f.sw / 2) / U, cz = (f.sy + f.sh / 2) / U, span = f.sw / U;
    const tall = phone();
    camera.fov = tall ? 56 : 38; camera.aspect = vw / vh;
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
    const d = span / (2 * Math.tan(hfov / 2));
    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(54, 80, THREE.MathUtils.clamp(st.alt, 0, 1)));
    // a breath of pointer parallax while the map is wide open, gone before the first island
    const pw = THREE.MathUtils.clamp((st.alt - .7) / .3, 0, 1) * (st.eyes > .01 ? 1 : .4);
    pxS += (px - pxS) * Math.min(1, dt * 3); pyS += (py - pyS) * Math.min(1, dt * 3);
    const yaw = pxS * .06 * pw;
    camera.position.set(cx + Math.sin(yaw) * d * Math.cos(pitch), d * Math.sin(pitch) - pyS * .4 * pw, cz + Math.cos(yaw) * d * Math.cos(pitch));
    camera.lookAt(tmp.set(cx, 0, cz));
    camera.updateProjectionMatrix();
    uniforms.uCam.value.copy(camera.position);
    uniforms.uFog.value = .55 / Math.max(6, d * 1.9);
  }

  /* ---------- the renderer the page calls ---------- */
  let frames = 0, slow = 0, alive = true;
  const r3d = {
    name: '3d', always: true,
    draw(st, dt = 0) {
      if (!alive) return;
      time += dt;
      if ((st.dim > .9 || st.ra > .995) && frames > 3) return;   // the world is under the reading or a festival: let the device rest
      uniforms.uTime.value = time;
      st.thaw.forEach((v, i) => { uniforms.uThaw.value[i] = v; });
      clouds.forEach(c => { c.material.uniforms.uTime.value = time; });
      place(st, dt);
      // cloud layers sit at fixed heights; each fades as the camera passes down through it
      clouds.forEach((c, i) => {
        const layerY = [11.5, 8.4, 6.2][i], gap = camera.position.y - layerY;
        c.material.uniforms.uFade.value = THREE.MathUtils.clamp(gap / 1.6, 0, 1) * THREE.MathUtils.clamp(1 - st.dim * 1.2, 0, 1);
      });
      // each realm's stone lifts off its own island and hangs there, glowing, while the win condition is read
      const k = THREE.MathUtils.smootherstep(st.stones, 0, 1);
      stones.forEach((o, i) => {
        o.s.position.copy(o.from); o.s.position.y = .45 + k * (1.25 + Math.sin(time * 1.2 + i * 1.3) * .06);
        o.glow.position.copy(o.s.position);
        const sz = .5 + .18 * k; o.s.scale.set(sz, sz, 1); o.glow.scale.set(sz * 2.8, sz * 2.8, 1);
        o.s.material.opacity = Math.min(1, st.stones * 2.2); o.glow.material.opacity = st.stones * .75;
        o.s.visible = o.glow.visible = st.stones > .01;
      });
      renderer.render(scene, camera);
      frames++;
      if (frames > 20 && frames < 140 && dt > .045) slow++;   // count long frames early on
      if (slow > 24) handBack('slow');
    },
    resize() { renderer.setPixelRatio(pr()); renderer.setSize(innerWidth, innerHeight); },
  };
  function handBack(why) {
    if (!alive) return; alive = false;
    film.useRenderer(film.flat); cv.style.opacity = '0'; window.__renderer = 'flat (' + why + ')'; window.__3d = false;
    setTimeout(() => { renderer.dispose(); cv.remove(); }, 1000);
  }
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); handBack('context lost'); });

  // come in over the flat picture: draw both while the 3D fades up, then let the flat one rest
  useImage('img/world-s.webp').then(() => {
    uniforms.uReady.value = 1;
    const both = { name: 'both', always: true, draw(st, dt) { film.flat.draw(st); r3d.draw(st, dt); }, resize() { r3d.resize(); } };
    film.useRenderer(both); film.view.style.opacity = '1';
    requestAnimationFrame(() => { cv.style.opacity = '1'; });
    setTimeout(() => { if (alive) { film.useRenderer(r3d); window.__renderer = '3d'; window.__3d = true; } }, 950);
    useImage('img/world.webp');
  });
}
