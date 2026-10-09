/* The pitch over the game's world.
   One painted map. Scrolling flies one camera over it and thaws the five realms in the order the lesson teaches them.
   This file is the whole page on its own (a 2D camera on a canvas); world3d.js, when the device can take it, swaps in a
   real-time 3D renderer that reads the same camera state, so both always agree.
   Dev contract: ?jump=<y>, ?at=<stop>, ?flat, ?plain=1, window.__ready, window.__setP(p), window.__film. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement, Q = new URLSearchParams(location.search);
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  let still = RM.matches || Q.has('still');
  let plain = Q.get('plain') === '1';
  try { if (!Q.has('plain') && localStorage.getItem('morqi.bible.plain') === '1') plain = true; } catch (e) {}
  root.classList.toggle('plain', plain);

  /* ---------- the world, in pixels of the 2048 x 1360 painting ---------- */
  const W = 2048, H = 1360, EXT = 560;   // below the painting the clouds fall away into night, so islands near its edge can sit high on a tall screen
  // the five realms in level order on the walkable map: where each island sits and how far its thaw reaches
  // (each circle is [x, y, radius]; the first is the island's heart, where its stone rises and its dive lands)
  const ISLES = [
    { el: 'water', c: [[160, 1085, 170], [80, 975, 70]] },
    { el: 'wood',  c: [[405, 975, 160], [350, 880, 72]] },
    { el: 'fire',  c: [[612, 835, 160], [790, 880, 92]] },
    { el: 'earth', c: [[858, 705, 150], [810, 612, 62]] },
    { el: 'metal', c: [[1145, 585, 165], [1125, 478, 88]] },
  ];
  // the gold path from the Pearl Shore to the moon. Between dives the camera follows it, so the route itself carries the
  // ride. AT: the path point each island's dive leaves from.
  const PATH = [[184, 1086], [306, 1067], [475, 1011], [512, 936], [606, 852], [728, 805], [794, 786], [887, 702], [934, 692],
    [1028, 674], [1112, 598], [1309, 533], [1390, 400], [1640, 210], [1905, 90]];
  const AT = [0, 2, 4, 7, 10];
  // inside each realm: where the camera rests in its festival painting (fx, a fraction across it), where it is drawn while
  // the card is read (aim: x and y fractions) and how far it pushes in. The Ridge is the peak: it flies on into the volcano.
  const FEST = [
    { fx: .56, aim: [.66, .45], push: .07 },   // water: the moon over the bay
    { fx: .58, aim: [.66, .5],  push: .09 },   // wood: the waterfalls
    { fx: .48, aim: [.8, .56],  push: .62 },   // fire: past the sun, into the volcano
    { fx: .25, aim: [.33, .56], push: .1 },    // earth: the fair, its stallholders
    { fx: .5,  aim: [.58, .6],  push: .12 },   // metal: the city above the clouds
  ];
  // camera at each stop: centre (u,v), visible width on a wide screen (span) and on a tall one (spanM),
  // thaw per realm, the eyes in the cloud, how far the world dims behind the reading
  const T0 = [0, 0, 0, 0, 0], T1 = [1, 0, 0, 0, 0], TA = [1, 1, 1, 1, 1];
  // a realm's own stop sits right over its island; inside the lesson the ride (rideAt) flies the camera between them
  const over = (i, t) => ({ u: ISLES[i].c[0][0], v: ISLES[i].c[0][1], span: 460, spanM: 300, t, dim: 0, alt: 1 });
  const STOPS = {
    // the cover shows the five realms alive; the story's first card freezes them (FREEZE) as the eyes open over the map,
    // the second drops toward the islands under his half-shut gaze, the third lands on the first frozen shore
    cover:    { u: 1024, v: 600,  span: 2048, spanM: 560, uM: 600, vM: 960, t: TA, eyes: 0, dim: 0, alt: 1 },   // a phone sees the lit islands in its top half, above the sheet
    story1:   { u: 1000, v: 640,  span: 1800, spanM: 680, uM: 620, t: T0, eyes: 1, dim: .16, alt: .95 },
    story2:   { u: 700,  v: 860,  span: 1350, spanM: 640, uM: 520, t: T0, eyes: .5, dim: .06, alt: .8 },
    story3:   { u: 290,  v: 1050, span: 980,  spanM: 520, t: T0, eyes: 0, dim: 0, alt: .5 },
    game:     { u: 250,  v: 1060, span: 760,  spanM: 470, t: T1, dim: 0, alt: .35 },
    lesson:   { u: 330,  v: 1030, span: 900,  spanM: 420, uM: 300, vM: 690, t: T1, dim: 0, alt: .4 },
    shore:    over(0, T1),
    grove:    over(1, [1, 1, 0, 0, 0]),
    ridge:    over(2, [1, 1, 1, 0, 0]),
    harvest:  over(3, [1, 1, 1, 1, 0]),
    city:     over(4, TA),
    win:      { u: 680,  v: 850,  span: 1500, spanM: 560, uM: 660, vM: 500, t: TA, dim: 0, alt: .75, stones: 1 },
    daily:    { u: 820,  v: 760,  span: 1100, spanM: 560, t: TA, dim: .08, alt: .55 },
    cast:     { u: 1290, v: 500,  span: 1050, spanM: 560, t: TA, dim: .05, alt: .55 },
    room:     { u: 1450, v: 340,  span: 1250, spanM: 600, t: TA, dim: .8, alt: .7 },
    market:   { u: 1540, v: 280,  span: 1180, spanM: 580, t: TA, dim: .82, alt: .7 },
    why:      { u: 1610, v: 230,  span: 1120, spanM: 560, t: TA, dim: .82, alt: .7 },
    // the long game: the world surfaces once more, frozen to the north-east, and he is watching again
    long:     { u: 1700, v: 190,  span: 1500, spanM: 620, t: TA, dim: .3, alt: .8, eyes: 1 },
    business: { u: 1770, v: 155,  span: 1060, spanM: 540, t: TA, dim: .82, alt: .7 },
    plan:     { u: 1820, v: 135,  span: 1000, spanM: 520, t: TA, dim: .82, alt: .7 },
    team:     { u: 1860, v: 120,  span: 940,  spanM: 500, t: TA, dim: .84, alt: .7 },
    play:     { u: 1890, v: 100,  span: 820,  spanM: 460, t: TA, dim: .93, alt: .7 },
  };
  const SIDE_FX = { left: .66, right: .34, none: .5 };

  /* ---------- stops on the page ---------- */
  const stopEls = $$('[data-stop]');
  let anchors = [];               // [{ y, s }] sorted by y
  let maxY = 1;
  function measure() {
    const vh = innerHeight, sy = scrollY;
    maxY = Math.max(1, document.documentElement.scrollHeight - vh);
    anchors = stopEls.map(el => {
      const s = STOPS[el.dataset.stop]; if (!s) return null;
      const r = el.getBoundingClientRect(), top = r.top + sy;
      let y;
      if (el.dataset.stop === 'cover') y = 0;
      else if (el.closest('.ch.solid')) y = top - vh * .55;
      else if (el.dataset.stop === 'play') y = maxY;
      else y = top - vh * .62;      // the world arrives while the card is still low on the screen
      const side = el.dataset.side || 'none';
      return { y: Math.min(maxY, Math.max(0, y)), s, fx: SIDE_FX[side] ?? .5, name: el.dataset.stop };
    }).filter(Boolean).sort((a, b) => a.y - b.y);
    rideMarks();
  }

  /* ---------- state from scroll ---------- */
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = t => t * t * (3 - 2 * t);
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  function tall() { const a = innerWidth / innerHeight; return clamp((1.15 - a) / (1.15 - .62)); } // 0 wide .. 1 tall
  function targetAt(y) {
    const n = anchors.length; if (!n) return null;
    let i = 0; while (i < n - 1 && anchors[i + 1].y <= y) i++;
    const A = anchors[i], B = anchors[Math.min(n - 1, i + 1)];
    const raw = B === A ? 0 : clamp((y - A.y) / Math.max(1, B.y - A.y));
    const t = lerp(raw, smooth(raw), .65);   // a little hold at each stop, never a dead stop
    const P = anchors[Math.max(0, i - 1)], N = anchors[Math.min(n - 1, i + 2)];
    const k = tall();
    const U = a => lerp(a.s.u, a.s.uM ?? a.s.u, k), V = a => lerp(a.s.v, a.s.vM ?? a.s.v, k);
    const SP = a => lerp(a.s.span, a.s.spanM, k);
    const FX = a => lerp(a.fx, .5, k);
    const st = {
      u: cr(U(P), U(A), U(B), U(N), t), v: cr(V(P), V(A), V(B), V(N), t),
      span: Math.exp(lerp(Math.log(SP(A)), Math.log(SP(B)), t)),
      fx: lerp(FX(A), FX(B), t), fy: lerp(.5, .36, k),
      thaw: A.s.t.map((a, j) => lerp(a, B.s.t[j], smooth(raw))),
      eyes: lerp(A.s.eyes ?? 0, B.s.eyes ?? 0, raw),
      dim: lerp(A.s.dim ?? 0, B.s.dim ?? 0, smooth(raw)),
      alt: lerp(A.s.alt ?? .5, B.s.alt ?? .5, t),
      stones: lerp(A.s.stones ?? 0, B.s.stones ?? 0, smooth(raw)),
      p: y / maxY, stop: raw < .5 ? A.name : B.name,
      ra: 0, rc: 0, rf: 0, rx: y < (rideY ? rideY.L : 0) ? FEST[0].fx : 4 + FEST[4].fx, ry: .5, rz: 1, rx2: 0, rm: 0,
    };
    // the frost takes the realms one at a time, the farthest first, the Pearl Shore last
    if (A.name === 'cover' && B.name === 'story1') st.thaw = st.thaw.map((v, j) => 1 - smooth(seg(raw, .08 + (4 - j) * .11, .4 + (4 - j) * .11)));
    rideAt(y, st, k);
    return st;
  }

  /* ---------- the lesson's ride ---------- */
  // For each realm: glide along the gold path to its island (it thaws as you arrive), drop through the clouds into its
  // festival, read the card there, rise out through the clouds and glide on. The path only ever climbs up and to the right,
  // so the whole chapter is one journey forward. Scrolling back runs it backwards.
  let rideY = null, rideOK = false;
  function rideMarks() {
    const at = n => { const a = anchors.find(a => a.name === n); return a ? a.y : undefined; };
    const L = at('lesson'), R = ['shore', 'grove', 'ridge', 'harvest', 'city'].map(at), Wn = at('win');
    rideY = [L, ...R, Wn].every(v => v !== undefined) ? { L, R, W: Wn } : null;
  }
  const seg = (y, a, b) => clamp((y - a) / Math.max(1e-6, b - a));
  const ss = t => t * t * t * (t * (t * 6 - 15) + 10);
  const bump = (r, a, b, c, d) => smooth(seg(r, a, b)) * (1 - smooth(seg(r, c, d)));
  // a point on the path between island i and the next, q 0..1, from heart to heart
  function along(i, q) {
    const pts = [ISLES[i].c[0], ...PATH.slice(AT[i], AT[i + 1] + 1), ISLES[i + 1].c[0]];
    const len = [0];
    for (let n = 1; n < pts.length; n++) len.push(len[n - 1] + Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]));
    const d = q * len[len.length - 1]; let n = 1; while (n < pts.length - 1 && len[n] < d) n++;
    const f = clamp((d - len[n - 1]) / Math.max(1e-6, len[n] - len[n - 1]));
    const P = pts[Math.max(0, n - 2)], A = pts[n - 1], B = pts[n], N = pts[Math.min(pts.length - 1, n + 1)];
    return [cr(P[0], A[0], B[0], N[0], f), cr(P[1], A[1], B[1], N[1], f)];
  }
  // the camera inside realm i's festival: h runs 0 (landing) .. .5 (the card arrives) .. 1 (leaving)
  function inside(i, h, st) {
    const F = FEST[i], e = Math.pow(smooth(clamp(h)), 1.8);    // rest while the card lands, then the push
    st.rx = i + lerp(F.fx, F.aim[0], e); st.ry = lerp(.5, F.aim[1], e); st.rz = 1 + F.push * e;
  }
  function rideAt(y, st, k) {
    const R = rideY; if (!R || y <= R.L || y >= R.W) return;
    const ys = [R.L, ...R.R, R.W];
    let s = 0; while (s < 5 && y >= ys[s + 1]) s++;            // segment s runs from ys[s] to ys[s+1]; realm s arrives at its end
    const r = seg(y, ys[s], ys[s + 1]);
    const CLOSE = lerp(460, 300, k), GLIDE = lerp(980, 480, k);
    const isle = i => ISLES[i].c[0];
    const SP = a => lerp(a.span, a.spanM, k);
    // the map underneath
    let u, v, span, alt, fy = .5, ge = -1;
    if (s === 0) {                       // from the lesson's wide shot, down onto the Pearl Shore
      const a = STOPS.lesson, g = ss(seg(r, .3, .82));
      u = lerp(lerp(a.u, a.uM ?? a.u, k), isle(0)[0], g); v = lerp(lerp(a.v, a.vM ?? a.v, k), isle(0)[1], g);
      span = Math.exp(lerp(Math.log(SP(a)), Math.log(CLOSE), g)); alt = lerp(a.alt, 1, g); fy = lerp(lerp(.5, .36, k), .5, g); ge = g;
    } else if (s === 5) {                // up out of the Silver City to all five, the stones rising
      const a = STOPS.win, g = ss(seg(r, .26, 1));
      u = lerp(isle(4)[0], lerp(a.u, a.uM ?? a.u, k), g); v = lerp(isle(4)[1], lerp(a.v, a.vM ?? a.v, k), g);
      span = Math.exp(lerp(Math.log(CLOSE), Math.log(SP(a)), g)); alt = lerp(1, a.alt, g); fy = lerp(.5, lerp(.5, .36, k), g); ge = 1 - g;
    } else {                             // along the path from the last island to this one
      const q = ss(seg(r, .26, .78)), g = smooth(seg(r, .26, .42)) * (1 - smooth(seg(r, .6, .8)));
      [u, v] = along(s - 1, q);
      span = Math.exp(lerp(Math.log(CLOSE), Math.log(GLIDE), g)); alt = lerp(1, .1, g);
    }
    // keep the frame's bottom edge inside the painting: below it there is only mirrored cloud and night (a tall screen
    // sees far more of the map's height than a wide one)
    { const sc = Math.max(innerWidth / span, innerWidth / W, innerHeight / (H + EXT)); v = Math.min(v, H * .97 - (1 - fy) * innerHeight / sc * 1.04); }
    st.u = u; st.v = v; st.span = span; st.alt = alt; st.fx = ge < 0 ? lerp(.42, .5, k) : lerp(st.fx, lerp(.42, .5, k), ge); st.fy = fy;
    // each island thaws as the camera arrives over it
    st.thaw = st.thaw.map((t, i) => i === 0 || i < s ? 1 : i > s ? 0 : smooth(seg(r, .5, .78)));
    // the festivals: out of the last one, into this one
    const soft = still ? 2.5 : 1;
    let a = 0, c = 0;
    if (s > 0) {                         // leaving realm s-1: up into its sky, through the clouds
      inside(s - 1, .5 + .5 * seg(r, 0, .26), st);
      const lift = smooth(seg(r, .12, .26)); st.ry = lerp(st.ry, .08, lift); st.rz *= 1 + .5 * lift;
      a = 1 - smooth(seg(r, .23 - .05 * (soft - 1), .27 + .04 * (soft - 1)));
      c = bump(r, .15, .23, .27, .35); st.rf = seg(r, .13, .37);
    }
    if (s < 5 && r > .5) {               // arriving in realm s: down through the clouds onto its ground, then look up
      inside(s, .5 * seg(r, .84, 1), st);
      const land = 1 - smooth(seg(r, .84, .98)); st.rz *= 1 + .7 * land; st.ry = lerp(st.ry, .9, land);
      a = smooth(seg(r, .82 - .06 * (soft - 1), .86 + .02 * (soft - 1)));
      c = bump(r, .74, .82, .84, .92); st.rf = seg(r, .72, .94);
    }
    if (still) { const i = Math.min(4, Math.floor(st.rx)); st.rx = i + FEST[i].fx; st.ry = .5; st.rz = 1; }   // reduced motion: the festivals only fade
    st.ra = rideOK ? a : 0; st.rc = rideOK ? c : 0;
  }

  /* ---------- the flat renderer: two layers of one painting on one canvas ---------- */
  const stage = $('.stage'), view = document.createElement('canvas'); view.className = 'view';
  stage.insertBefore(view, stage.firstChild);
  const ctx = view.getContext('2d', { alpha: false });
  const eyes = $('.stage .eyes'), dimEl = $('.stage .dim');
  let world = null, frozen = null, thawed = null, thawKey = '';
  const DPR = () => Math.min(2, devicePixelRatio || 1);

  function load(src) { return new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = src; }); }

  // frozen: the same painting turned to ice (deep navy through ice blue to frost white), a little of the colour left in
  function freeze(img) {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      let l = (r * .3 + g * .59 + b * .11) / 255; l = Math.min(1, l * 1.08 + .02);
      let R, G, B;
      if (l < .5) { const t = l * 2; R = 12 + (70 - 12) * t; G = 20 + (118 - 20) * t; B = 62 + (196 - 62) * t; }
      else { const t = (l - .5) * 2; R = 70 + (226 - 70) * t; G = 118 + (240 - 118) * t; B = 196 + (255 - 196) * t; }
      p[i] = R * .86 + r * .14; p[i + 1] = G * .86 + g * .14; p[i + 2] = B * .86 + b * .14;
    }
    x.putImageData(d, 0, 0);
    const k = c.width / W, e = document.createElement('canvas'); e.width = c.width; e.height = Math.round((H + EXT) * k);
    const y = e.getContext('2d'); y.drawImage(c, 0, 0);
    y.save(); y.translate(0, 2 * c.height); y.scale(1, -1);     // the clouds continue, mirrored, then night
    y.drawImage(c, 0, c.height - 200 * k, c.width, 200 * k, 0, c.height - 200 * k, c.width, 200 * k); y.restore();
    const g = y.createLinearGradient(0, c.height - 90 * k, 0, e.height);
    g.addColorStop(0, 'rgba(13,21,70,0)'); g.addColorStop(.16, 'rgba(13,21,70,.35)'); g.addColorStop(.42, 'rgba(13,21,70,.97)'); g.addColorStop(1, 'rgba(13,21,70,1)');
    y.fillStyle = g; y.fillRect(0, c.height - 90 * k, c.width, e.height);
    return e;
  }
  // a fixed scatter of crystals around each thaw edge, so it melts outward in a ragged ring, never a clean circle
  const RING = Array.from({ length: 28 }, (_, i) => ({ a: i / 28 * Math.PI * 2 + Math.sin(i * 12.9898) * .12, r: .78 + ((Math.sin(i * 78.233) * 43758.5453) % 1 + 1) % 1 * .32, s: .18 + ((Math.sin(i * 39.425) * 1e4) % 1 + 1) % 1 * .16 }));
  function buildThaw(thaw) {
    const key = thaw.map(v => v.toFixed(3)).join(',');
    if (key === thawKey && thawed) return; thawKey = key;
    if (!world) return;
    const w = world.naturalWidth, h = world.naturalHeight, k = w / W;
    if (!thawed) { thawed = document.createElement('canvas'); }
    if (thawed.width !== w) { thawed.width = w; thawed.height = h; }
    const x = thawed.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, h);
    const blob = (cx, cy, rad) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, '#000'); g.addColorStop(.62, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill(); };
    ISLES.forEach((isle, j) => {
      const t = thaw[j]; if (t <= .001) return;
      const e = 1 - Math.pow(1 - t, 2);
      isle.c.forEach(([cx, cy, r]) => {
        const R = r * k * e; blob(cx * k, cy * k, R * .92);
        RING.forEach(q => blob(cx * k + Math.cos(q.a) * R * q.r * .8, cy * k + Math.sin(q.a) * R * q.r * .8, R * q.s * (.6 + .4 * e)));
      });
    });
    x.globalCompositeOperation = 'source-in'; x.drawImage(world, 0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
  }
  let cw = 0, ch = 0;
  function sizeView() {
    const d = DPR(); cw = Math.round(innerWidth * d); ch = Math.round(innerHeight * d);
    if (view.width !== cw || view.height !== ch) { view.width = cw; view.height = ch; }
  }
  // the camera as a rectangle of the painting, always covering the screen
  function frame(st, vw, vh) {
    let s = vw / st.span; s = Math.max(s, vw / W, vh / (H + EXT));
    let tx = st.fx * vw - st.u * s, ty = st.fy * vh - st.v * s;
    tx = clamp(tx, vw - W * s, 0); ty = clamp(ty, vh - (H + EXT) * s, 0);
    return { s, sx: -tx / s, sy: -ty / s, sw: vw / s, sh: vh / s };
  }
  const flat = {
    name: 'flat',
    draw(st) {
      if (!frozen) return;
      if (st.ra > .995 && this.covered) return;              // a festival fills the screen: nothing of the map shows
      this.covered = st.ra > .995;
      buildThaw(st.thaw);
      const f = frame(st, innerWidth, innerHeight);
      const kf = frozen.width / W, kt = thawed ? thawed.width / W : 1;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(frozen, f.sx * kf, f.sy * kf, f.sw * kf, f.sh * kf, 0, 0, cw, ch);
      if (thawed && st.thaw.some(v => v > .001)) ctx.drawImage(thawed, f.sx * kt, f.sy * kt, f.sw * kt, f.sh * kt, 0, 0, cw, ch);
    },
  };
  let renderer = flat, ride = null;

  /* ---------- the loop ---------- */
  let cur = null, last = performance.now(), dirty = true, raf = 0;
  const KEYS = ['u', 'v', 'span', 'fx', 'fy', 'eyes', 'dim', 'alt', 'stones', 'ra', 'rc', 'rf', 'rx', 'ry', 'rz', 'rx2', 'rm'];
  function settle() { cur = targetAt(scrollY); dirty = true; }
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(.1, (now - last) / 1000); last = now; jank.push(dt);
    if (plain) return;
    const tg = targetAt(scrollY); if (!tg) return;
    if (!cur) cur = tg;
    const k = still ? 1 : 1 - Math.exp(-dt * 4.2);
    let moving = false;
    KEYS.forEach(key => { const d = tg[key] - cur[key]; if (Math.abs(d) > (key === 'u' || key === 'v' || key === 'span' ? .05 : .0005)) moving = true; cur[key] += d * k; });
    cur.thaw = cur.thaw.map((v, j) => { const d = tg.thaw[j] - v; if (Math.abs(d) > .0005) moving = true; return v + d * (still ? 1 : 1 - Math.exp(-dt * 2.6)); });
    cur.p = tg.p; cur.stop = tg.stop;
    if (still) { // nothing travels: hold the whole map, let the thaw and the dimming follow the reading
      const k2 = tall(); cur.u = lerp(1024, 430, k2); cur.v = lerp(760, 840, k2); cur.span = lerp(2048, 640, k2); cur.fx = .5; cur.fy = lerp(.5, .3, k2); cur.alt = .9; cur.dim = Math.max(.35, tg.dim); cur.eyes = tg.eyes;
    }
    if (moving || dirty || renderer.always) { renderer.draw(cur, dt); dirty = false; }
    if (ride) ride.draw(cur, dt);
    // the eyes open like eyelids parting: a slit at the middle line that widens with the scroll; half open is a narrowed stare
    const eo = clamp(cur.eyes);
    eyes.style.opacity = (Math.min(1, eo * 2.2) * .94).toFixed(3);
    eyes.style.setProperty('--o', eo.toFixed(3));
    eyes.style.transform = `translate(-50%, ${((1 - eo) * -14).toFixed(1)}px) scale(${(.94 + eo * .08).toFixed(3)})`;
    dimEl.style.opacity = cur.dim.toFixed(3);
    window.__state = cur;
  }

  /* ---------- the bar ---------- */
  const bar = $('#bar'), rn = $('.readout .rn'), rt = $('.readout .rt');
  const chs = $$('main > .ch');
  function readout() {
    const mid = innerHeight * .45; let on = chs[0];
    chs.forEach(c => { if (c.getBoundingClientRect().top < mid) on = c; });
    if (rn.textContent !== on.dataset.ch) { rn.textContent = on.dataset.ch; rt.textContent = on.dataset.name; }
    root.classList.toggle('moved', scrollY > 24);
    { const cv = $('#cover .card'); if (cv) $('.cue').style.setProperty('--cue-b', (cv.offsetHeight + 16) + 'px'); }
    bar.classList.toggle('past', plain || scrollY > innerHeight * .6);
    bar.classList.toggle('solid', plain || scrollY > innerHeight * .6);
    // the TV's picture comes in as it reaches the screen: the snow only fades, it never flickers
    const pr = $('#play').getBoundingClientRect();
    $('.tv').style.setProperty('--snow', clamp((pr.top + pr.height * .1) / (innerHeight * .7)).toFixed(3));
  }
  addEventListener('scroll', readout, { passive: true });
  // the festival paintings come down while the first chapters are read, so the lesson's ride is ready when it arrives
  let rideAsked = false;
  function askRide() {
    if (rideAsked || !anchors.length) return;
    const need = anchors.find(a => a.name === 'story2');
    if (need && scrollY < need.y - innerHeight * .5) return;
    rideAsked = true;
    import('./ride.js').then(m => { ride = m.start(window.__film); }).catch(e => console.warn('ride off:', e && e.message));
  }
  addEventListener('scroll', askRide, { passive: true });

  const mode = $('.mode');
  function setPlain(v) {
    plain = v; root.classList.toggle('plain', v);
    mode.textContent = v ? mode.dataset.on : mode.dataset.off; mode.setAttribute('aria-pressed', String(v));
    mode.title = v ? mode.dataset.onTitle : mode.dataset.offTitle;
    try { localStorage.setItem('morqi.bible.plain', v ? '1' : '0'); } catch (e) {}
    requestAnimationFrame(() => { measure(); settle(); readout(); });
  }
  mode.addEventListener('click', () => setPlain(!plain));
  if (plain) setPlain(true);

  // one action, one button: the bar's Play steps back while a big one is on screen
  const quiet = new Set();
  const qio = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? quiet.add(e.target) : quiet.delete(e.target)); bar.classList.toggle('quiet', quiet.size > 0); }, { threshold: .4 });
  $$('#cover .cta, #play .cta, #play .tv').forEach(el => qio.observe(el));

  /* ---------- the heart: free her ---------- */
  const free = $('#free');
  function release(byTap) {
    if (free.classList.contains('done')) return;
    free.classList.add('done'); if (byTap) free.classList.add('tapped');
    const yes = $('[data-f="worry"]', free); yes.classList.add('yes'); yes.setAttribute('aria-pressed', 'true');
  }
  $$('.picks button', free).forEach(b => b.addEventListener('click', () => {
    if (free.classList.contains('done')) return;
    if (b.dataset.f === 'worry') release(true); else { b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); }
  }));
  // scrolling on frees her anyway: the tap is a gift, never a gate
  new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting && e.boundingClientRect.top < 0) release(false); }), { threshold: 0 }).observe(free);

  /* ---------- arrivals ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px', threshold: .08 });
  $$('.ch.solid .wrap').forEach(w => io.observe(w));

  /* ---------- feedback goes through the Stillmaker's gate ---------- */
  $$('[data-gate]').forEach(a => a.addEventListener('click', e => {
    if (typeof stillGate !== 'function' || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); stillGate(a.href, 'img/eyes.webp');
  }));

  /* ---------- resize ---------- */
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { sizeView(); measure(); dirty = true; renderer.resize && renderer.resize(); ride && ride.resize(); readout(); }); });
  RM.addEventListener && RM.addEventListener('change', () => { still = RM.matches; dirty = true; });

  /* ---------- jank meter ---------- */
  const jank = { d: [], push(x) { this.d.push(x * 1000); if (this.d.length > 600) this.d.shift(); },
    report() { const s = [...this.d].sort((a, b) => a - b); return { n: s.length, p95: s[Math.floor(s.length * .95)] || 0, max: s[s.length - 1] || 0 }; } };

  /* ---------- boot ---------- */
  window.__film = {
    STOPS, ISLES, PATH, FEST, W, H, EXT, frame, targetAt,
    rideReady() { rideOK = true; dirty = true; }, get state() { return cur; }, get still() { return still; }, get plain() { return plain; },
    useRenderer(r) { renderer = r; dirty = true; view.style.opacity = r === flat ? '1' : '0'; },
    flat, view, jank: () => jank.report(), redraw() { dirty = true; },
  };
  window.__setP = p => { scrollTo(0, clamp(p) * maxY); settle(); readout(); renderer.draw(cur, 0); };

  async function boot() {
    sizeView(); measure();
    try { await document.fonts.ready; } catch (e) {}
    world = await load('img/world-s.webp'); frozen = freeze(world); thawKey = '';
    const J = Q.get('jump'), AT = Q.get('at');
    if (J !== null || AT) {
      history.scrollRestoration = 'manual'; measure();
      let y = +J || 0;
      if (AT) { const a = anchors.find(a => a.name === AT); if (a) y = a.y; }
      scrollTo(0, y);
      if (AT === 'heart-done' || Q.has('freed')) release(false);
    }
    measure(); settle(); readout(); flat.draw(cur);
    raf = requestAnimationFrame(tick);
    askRide();
    window.__ready = true;
    // the full-size painting, then (if the device can take it) the world in three dimensions
    load('img/world.webp').then(im => { world = im; frozen = freeze(im); thawKey = ''; dirty = true; window.__sharp = true; }).catch(() => {});
    const can3d = !still && !Q.has('flat') && !(navigator.connection && navigator.connection.saveData) && (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();
    if (can3d) import('./world3d.js').then(m => m.start(window.__film)).catch(e => console.warn('3D off:', e && e.message));
  }
  boot();
})();
