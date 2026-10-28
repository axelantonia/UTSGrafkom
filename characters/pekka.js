// ===================== CHARACTERS/PEKKA.JS =====================
import { I4, mul, T, S, RX, RY, RZ, crs, nrm } from '../libs/math.js';

export function createPekka(gl) {
  const VS = `#version 300 es
in vec3 aP;
in vec3 aN;
uniform mat4 uVP, uM;
out vec3 vW, vN, vL;
void main() {
  vec4 w = uM * vec4(aP, 1.);
  vW = w.xyz;
  vL = aP;
  vN = mat3(transpose(inverse(uM))) * aN;
  gl_Position = uVP * w;
}`;

  const FS = `#version 300 es
precision highp float;
in vec3 vW, vN, vL;
uniform vec3 uCol, uCam, uHi;
uniform float uSp, uEm, uGl, uGr;
out vec4 o;

float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(
    mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

void main() {
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  if (dot(N, V) < 0.) N = -N;
  float n = vn(vW * 8.) * .6 + vn(vW * 28.) * .4;
  vec3 base = uCol;
  if (uGr > 0.) base = mix(uCol, vec3(.66, .36, .95), pow(clamp((vL.y + 1.) * .5, 0., 1.), 1.6));
  vec3 al = base * (.9 + .2 * n * (1. - .7 * uGl));
  vec3 L1 = normalize(vec3(.5, .8, .8)), L2 = normalize(vec3(-.7, .3, -.5));
  float d = max(dot(N, L1), 0.) + .35 * max(dot(N, L2), 0.);
  float am = .22 + .12 * N.y;
  vec3 R = reflect(-V, N);
  vec3 env = mix(vec3(.015, .015, .025), vec3(.6, .65, .78), smoothstep(.25, 1., R.y * .5 + .5));
  env += vec3(1.) * (pow(max(dot(R, L1), 0.), 50.) * 2.2 + pow(max(dot(R, L2), 0.), 30.) * .6);
  float fr = .14 + .86 * pow(1. - max(dot(N, V), 0.), 4.);
  vec3 hi = mix(vec3(1.), uHi, .7);
  float s = pow(max(dot(N, normalize(L1 + V)), 0.), 110.) * uGl * 1.6 + pow(max(dot(N, normalize(L1 + V)), 0.), 30.) * uSp * .25;
  vec3 c = al * (am + d) + hi * s + env * hi * fr * uGl * (.4 + .6 * uSp) + uCol * uEm;
  o = vec4(sqrt(max(c, 0.)), 1.);
}`;

  function sh(t, s) {
    const x = gl.createShader(t);
    gl.shaderSource(x, s);
    gl.compileShader(x);
    if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(x));
    return x;
  }

  const pg = gl.createProgram();
  gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(pg, 0, 'aP');
  gl.bindAttribLocation(pg, 1, 'aN');
  gl.linkProgram(pg);

  const U = n => gl.getUniformLocation(pg, n);
  const uVP = U('uVP'), uM = U('uM'), uCol = U('uCol'), uCam = U('uCam'),
        uSp = U('uSp'), uEm = U('uEm'), uGl = U('uGl'), uHi = U('uHi'), uGr = U('uGr');

  const X = (...m) => m.reduce(mul);

  function align(d) {
    const y = nrm(d), h = Math.abs(y[1]) < .99 ? [0, 1, 0] : [1, 0, 0], x = nrm(crs(h, y)), z = crs(x, y), m = I4();
    m.set([...x, 0, ...y, 0, ...z, 0], 0);
    return m;
  }

  function mk(parts) {
    const V = [], Ix = []; let b = 0;
    for (const [nu, nv, f] of parts) {
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv, p = f(u, v), e = 1e-3, vv = Math.min(Math.max(v, .004), .996);
        const a = f(u + e, vv), c = f(u - e, vv), d = f(u, vv + e), g = f(u, vv - e);
        const n = nrm(crs([a[0] - c[0], a[1] - c[1], a[2] - c[2]], [d[0] - g[0], d[1] - g[1], d[2] - g[2]]));
        V.push(...p, ...n);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const k = b + j * (nu + 1) + i;
        Ix.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1);
      }
      b += (nu + 1) * (nv + 1);
    }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(Ix), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    return { vao, n: Ix.length };
  }

  const TAU = Math.PI * 2, sg = (x, e) => Math.sign(x) * Math.abs(x) ** e;
  const ellP = (t0 = 0, t1 = 1) => [40, 26, (u, v) => { const p = u * TAU, t = (t0 + (t1 - t0) * v) * Math.PI; return [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)]; }];
  const boxP = e => [[72, 48, (u, v) => { const p = u * TAU, t = v * Math.PI; return [sg(Math.sin(t), e) * sg(Math.cos(p), e), sg(Math.cos(t), e), sg(Math.sin(t), e) * sg(Math.sin(p), e)]; }]];
  const cylP = () => [[36, 2, (u, v) => [Math.cos(u * TAU), 2 * v - 1, Math.sin(u * TAU)]], [36, 2, (u, v) => [v * Math.cos(u * TAU), 1, v * Math.sin(u * TAU)]], [36, 2, (u, v) => [v * Math.cos(u * TAU), -1, v * Math.sin(u * TAU)]]];
  const coneP = () => [[36, 6, (u, v) => [v * Math.cos(u * TAU), 1 - 2 * v, v * Math.sin(u * TAU)]], [36, 2, (u, v) => [v * Math.cos(u * TAU), -1, v * Math.sin(u * TAU)]]];
  const parP = () => [[48, 16, (u, v) => [v * Math.cos(u * TAU), 1 - v * v, v * Math.sin(u * TAU)]]];

  function tubeP(P, r0, n = 48, m = 18, pn0 = [0, 0, 1], rt = .8) {
    const bz = (t, k) => { const s = 1 - t; return s * s * s * P[0][k] + 3 * s * s * t * P[1][k] + 3 * s * t * t * P[2][k] + t * t * t * P[3][k]; };
    const db = (t, k) => { const s = 1 - t; return 3 * s * s * (P[1][k] - P[0][k]) + 6 * s * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k]); };
    const C = [], N = [], B = [], R = []; let pn = pn0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, tg = nrm([0, 1, 2].map(k => db(t, k)));
      const d = pn[0] * tg[0] + pn[1] * tg[1] + pn[2] * tg[2], nn = nrm(pn.map((x, k) => x - tg[k] * d));
      pn = nn; C.push([0, 1, 2].map(k => bz(t, k))); N.push(nn); B.push(crs(tg, nn)); R.push(r0 * Math.pow(1 - t, rt) + .012);
    }
    return [[m, n, (u, v) => {
      const s = Math.min(v, .9999) * n, i = Math.floor(s), w = s - i, L = (a, k) => a[i][k] * (1 - w) + a[i + 1][k] * w,
            r = R[i] * (1 - w) + R[i + 1] * w, c = Math.cos(u * TAU), s2 = Math.sin(u * TAU);
      return [0, 1, 2].map(k => L(C, k) + r * (c * L(N, k) + s2 * L(B, k)));
    }]];
  }

  const bladeP = () => {
    const sl = .22, ring = u => { const p = u * TAU; return [sg(Math.cos(p), .25) * .13, sg(Math.sin(p), .25) * .32]; }, ze = y => 1 - sl * (.5 - .5 * y / .32);
    return [[40, 12, (u, v) => { const [x, y] = ring(u); return [x, y, -1 + v * (ze(y) + 1)]; }], [40, 3, (u, v) => { const [x, y] = ring(u); return [x * v, y * v, ze(y * v)]; }], [40, 3, (u, v) => { const [x, y] = ring(u); return [x * v, y * v, -1]; }]];
  };

  const M = {
    tri: mk([[1, 1, (u, v) => [(2 * u - 1) * (1 - v), -v, 0]]]),
    toe: mk(tubeP([[0, 0, 0], [0, 0, .5], [0, .3, .85], [0, .55, .45]], .27, 48, 18, [1, 0, 0], .8)),
    blade: mk(bladeP()),
    box: mk(boxP(.22)),
    ell: mk([ellP()]),
    half: mk([ellP(0, .5)]),
    cyl: mk(cylP()),
    cone: mk(coneP()),
    par: mk(parP()),
    sh: mk(tubeP([[0, 0, 0], [.45, .05, 0], [.75, .3, 0], [.9, 1.05, -.05]], .2)),
    horn: mk(tubeP([[.5, 3.9, 0], [1.3, 3.6, 0], [1.5, 4.3, -.05], [2.0, 4.95, -.2]], .2))
  };

  const ST = [.13, .14, .16], DK = [.05, .05, .065], PK = [.3, .06, .42], MT = [.5, .52, .56];
  let LIFT = 0, ROOT = I4(), PM = I4(), WORLD = I4();

  const POSE = { on: false, armL: I4(), armR: I4(), elbL: 0, elbR: 0, wrist: 0, breath: 1, glow: 1, leg: [0, 0] };
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), sg2 = (t, a, b) => cl((t - a) / (b - a)), ez = x => x * x * (3 - 2 * x), lp = (a, b, k) => a + (b - a) * k;

  function rod(ax, ang) {
    const [x, y, z] = nrm(ax), c = Math.cos(ang), s = Math.sin(ang), k = 1 - c, m = I4();
    m[0] = c + x * x * k;     m[1] = y * x * k + z * s; m[2] = z * x * k - y * s;
    m[4] = x * y * k - z * s; m[5] = c + y * y * k;     m[6] = z * y * k + x * s;
    m[8] = x * z * k + y * s; m[9] = y * z * k - x * s; m[10] = c + z * z * k;
    return m;
  }

  const scAbout = (cx, cy, cz, k) => X(T(cx, cy, cz), S(k, k, k), T(-cx, -cy, -cz));
  const legM = s => { const p = [s * .62, 1.95, 0]; return X(T(...p), RX(POSE.leg[s < 0 ? 0 : 1]), T(-p[0], -p[1], -p[2])); };
  const AX1 = [Math.cos(.6), 0, Math.sin(.6)], AX2 = [Math.cos(.6), 0, -Math.sin(.6)];

  function d(m, mat, col, sp = .5, em = 0) {
    mat = mul(PM, mat);
    if (LIFT) mat = mul(T(0, LIFT, 0), mat);
    mat = mul( WORLD, mul(ROOT, mat) );
    gl.uniformMatrix4fv(uM, false, mat);
    gl.uniform3fv(uCol, col);
    gl.uniform1f(uSp, sp);
    gl.uniform1f(uEm, em);
    const pk = col === PK;
    gl.uniform1f(uGl, sp > 0 ? 1 : 0);
    gl.uniform3fv(uHi, pk ? [.85, .6, 1] : [.75, .8, .92]);
    gl.uniform1f(uGr, pk && m === M.cone ? 1 : 0);
    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0);
  }

  function spike(B, p, dir, r, l) {
    const n = nrm(dir), c = [p[0] + n[0] * l / 2, p[1] + n[1] * l / 2, p[2] + n[2] * l / 2];
    d(M.cone, X(B, T(...c), align(n), S(r, l / 2, r)), PK, .7, .18);
  }

  function hand(B, s, curl) {
    const y0 = -1.2, R = RZ(-s * curl * .5);
    d(M.box, X(B, T(-s * .02, y0 - .08, 0), S(.3, .26, .5)), ST, .6);
    for (let k = 0; k < 4; k++) {
      const z = (k - 1.5) * .25, L = (k == 1 || k == 2) ? 1 : .9, b = X(B, T(-s * .12, y0 - .34, z));
      d(M.box, X(b, T(0, -.14 * L, 0), S(.12, .14 * L, .115)), ST, .6);
      const c = X(b, T(0, -.28 * L, 0), R, T(0, -.14 * L, 0));
      d(M.box, X(c, S(.12, .14 * L, .115)), ST, .6);
      const e = X(c, T(0, -.14 * L, 0), R, T(0, -.13 * L, 0));
      d(M.box, X(e, S(.115, .13 * L, .11)), DK, .6);
    }
    d(M.cyl, X(B, T(-s * .12, y0 - .2, .38), RX(-.6), S(.1, .2, .1)), ST, .6);
  }

  function drawGeometry(tSec) {
    LIFT = 0;
    for (const s of [-1, 1]) {
      const PN = [.09, .09, .11]; PM = POSE.on ? legM(s) : I4();
      d(M.ell, X(T(s * .62, 1.5, 0), S(.55, .58, .55)), PN, .15);
      d(M.cone, X(T(s * .6, .55, 0), RZ(Math.PI), S(.55, .75, .55)), PN, .15);
      d(M.cyl, X(T(s * .6, .3, -.02), S(.26, .13, .26)), DK, .4);
      d(M.cyl, X(T(s * .6, .42, -.02), S(.28, .04, .28)), ST, .6);
      d(M.ell, X(T(s * .6, .3, -.17), S(.29, .25, .25)), DK, .4);
      d(M.ell, X(T(s * .6, .2, .22), S(.31, .2, .44)), DK, .4);
      d(M.toe, X(T(s * .6, .18, .42), S(.55, .55, .55)), DK, .4);
    }

    PM = I4(); LIFT = .5;
    d(M.box, X(T(0, 1.55, 0), S(1.25, .2, .8)), DK);
    for (let tr = 0; tr < 2; tr++) {
      for (let k = 0; k < 12; k++) {
        const th = (k + tr * .5) / 12 * TAU,
              p = [(1.2 + tr * .08) * Math.sin(th), 1.5 - tr * .3, (.82 + tr * .06) * Math.cos(th)];
        d(M.box, X(T(...p), RY(th), RX(-.18), S(.3, .26, .05)), tr ? ST : DK, .6);
      }
    }

    d(M.box, X(T(0, 1.3, .95), RX(-.12), S(.46, .4, .06)), ST, .7);
    d(M.ell, X(T(0, 1.4, 1.02), S(.12, .12, .04)), MT, .9);
    d(M.box, X(T(0, 2.05, 0), S(1.1, .4, .78)), ST);
    d(M.par, X(T(0, 1.95, .55), RX(Math.PI / 2), S(1.1, .45, .46)), ST, .7);
    d(M.box, X(T(0, 1.55, .66), RX(-.22), S(.98, .13, .3)), DK, .7);
    d(M.box, X(T(0, 2.0, .9), S(.99, .06, .12)), DK, .7);

    for (const s of [-1, 1]) {
      d(M.box, X(T(s * 1.02, 2.0, .45), S(.1, .45, .32)), DK, .7);
      d(M.ell, X(T(s * .95, 2.2, .78), S(.09, .09, .05)), MT, .9);
    }

    d(M.box, X(T(0, 2.82, 0), S(1.15, .46, .8)), ST);
    PM = POSE.on ? scAbout(0, 2.68, .4, POSE.breath) : I4();
    d(M.par, X(T(0, 2.68, .62), RX(Math.PI / 2), S(1.08, .55, .5)), ST, .7);
    for (const x of [-.55, .55]) d(M.ell, X(T(x, 2.8, .96), S(.09, .09, .05)), MT, .9);
    PM = I4();
    d(M.box, X(T(0, 2.8, -.8), S(1.05, .7, .14)), ST);

    d(M.box, X(T(0, 3.72, 0), S(.58, .45, .54)), ST);
    d(M.half, X(T(0, 3.9, 0), S(.66, .52, .63)), ST, .7);
    d(M.box, X(T(0, 3.5, .548), S(.08, .22, .008)), ST, .9);
    d(M.cone, X(T(0, 3.78, .548), S(.08, .1, .008)), ST, .9);
    d(M.box, X(T(0, 3.5, .552), S(.05, .2, .012)), [.02, .02, .04], 0);
    d(M.cone, X(T(0, 3.77, .552), S(.05, .07, .012)), [.02, .02, .04], 0);

    for (const s of [-1, 1]) {
      const E = X(T(s * .3, 3.8, 0), RZ(s * .35));
      d(M.tri, X(E, T(0, .03, .548), S(.25, .25, 1)), ST, .9);
      d(M.tri, X(E, T(0, 0, .553), S(.2, .2, 1)), [.02, .02, .04], 0);
      d(M.ell, X(E, T(0, -.065, .572), S(.11 * (1 + (POSE.glow - 1) * .6), .045 * (1 + (POSE.glow - 1) * .6), .02)), [1, .35, .85], 0, 1.6 * POSE.glow);
      d(M.box, X(E, T(0, .035, .57), S(.26, .025, .035)), ST, .9);
      d(M.ell, X(T(s * .62, 3.9, 0), S(.18, .27, .27)), DK);
    }

    d(M.box, X(T(0, 3.35, .2), S(.45, .14, .3)), DK);
    d(M.half, X(T(0, 3.2, -.45), S(.8, .5, .5)), ST, .7);
    d(M.box, X(T(0, 3.08, -.5), S(.86, .12, .42)), DK, .7);
    d(M.box, X(T(0, 3.45, -.78), S(.5, .04, .12)), DK, .7);

    PM = POSE.on ? scAbout(0, 3.9, 0, 1 + (POSE.glow - 1) * .3) : I4();
    d(M.horn, I4(), PK, .8, .15);
    d(M.horn, S(-1, 1, 1), PK, .8, .15);
    PM = I4();

    const a = !POSE.on ? Math.sin(tSec * 2) * .2 : 0;

    for (const s of [-1, 1]) {
      const sc = [s * 1.65, 3.1, 0];
      d(M.ell, X(T(s * 1.62, 2.9, 0), S(.45, .45, .45)), DK);
      d(M.half, X(T(...sc), S(.82, .58, .76)), ST, .7);
      d(M.cyl, X(T(...sc), S(.83, .05, .77)), DK, .6);
      d(M.half, X(T(...sc), S(.82, -.28, .76)), DK, .5);
      d(M.box, X(T(sc[0], sc[1] - .3, sc[2]), S(.74, .1, .68)), ST, .7);
      d(M.sh, X(T(sc[0] + s * .45, sc[1] + .1, sc[2]), S(s, 1, 1)), PK, .8, .15);
      spike(I4(), [sc[0] + s * .05, sc[1] + .56, sc[2]], [0, 1, 0], .1, .4);
      spike(I4(), [sc[0], sc[1] + .2, sc[2] - .7], [0, .2, -1], .1, .4);

      const A = X(T(s * 1.62, 2.9, 0), POSE.on ? (s < 0 ? POSE.armL : POSE.armR) : RX(s > 0 ? a : -a));
      d(M.ell, X(A, T(0, -.62, 0), S(.5, .5, .5)), DK);

      const B = X(A, T(0, -.62, 0), RX((s < 0 ? -.25 : -.5) - (POSE.on ? (s < 0 ? POSE.elbL : POSE.elbR) : 0)));
      d(M.box, X(B, T(0, -.62, 0), S(.46, .6, .46)), DK);
      d(M.box, X(B, T(0, -.3, 0), S(.52, .26, .52)), ST, .7);
      d(M.box, X(B, T(0, -.82, 0), S(.5, .22, .5)), ST, .7);
      for (const y of [-.55, -1.05]) d(M.box, X(B, T(0, y, 0), S(.54, .07, .54)), DK, .7);
      d(M.box, X(B, T(s * .5, -.6, 0), S(.07, .5, .42)), DK);
      for (const y of [-.35, -.85]) for (const z of [-.2, .2]) spike(B, [s * .55, y, z], [s, 0, 0], .09, .45);

      const Bh = s < 0 ? X(B, T(0, -1.2, 0), RY(POSE.on ? POSE.wrist : 0), RX(.6), T(0, 1.2, 0)) : B;
      hand(Bh, s, s < 0 ? 1.4 : .5);

      if (s < 0) {
        const F = X(Bh, T(-s * .36, -1.78, 0));
        d(M.cyl, X(F, RX(Math.PI / 2), S(.09, .55, .09)), DK);
        d(M.ell, X(F, T(0, 0, -.6), S(.13, .13, .13)), MT, .9);
        d(M.box, X(F, T(0, 0, .56), S(.42, .1, .1)), DK);
        d(M.blade, X(F, T(0, 0, .55 + 1.5), S(1, 1, 1.5)), MT, 1);
      }
    }
  }

  function updateTimeline(t) {
    if (t === null) {
      POSE.on = false; POSE.glow = 1; ROOT = I4(); PM = I4();
      return;
    }
    const w = (a, b) => ez(sg2(t, a, b));
    // x = 0 & yaw = 0 membuat P.E.K.K.A berjalan 100% lurus menghadap ke depan (tidak miring/menyamping)
    let x = 0.0, z = 0.0, yaw = 0.0, dy = 0, sk = 1, sq = 0, lean = 0, amp = 0, ph = 0, lunge = 0, aL = null, aR = null, eL = 0, wr = 0, glowVal = 1;

    if (t < 12) {
      // Scene 1: Di luar pandangan kamera sesuai laporan
      dy = -100;
    } else if (t < 25) {
      // Scene 2: Melangkah lurus ke depan di jalur rumput (bebas dari Princess Tower Kiri)
      const k = w(12, 24);
      x = 0.0;
      z = lp(-2.3, 0.0, k);
      yaw = 0.0;
      amp = .58 * w(12, 13.2) * (1 - w(22.5, 24.2));
      ph = (t - 12) * 5.2;
    } else if (t < 40) {
      // Scene 3: Maju setengah langkah lurus, putar pergelangan pedang, tanduk & mata membesar
      const k = w(25, 31);
      x = 0.0;
      z = lp(0.0, 0.65, k);
      yaw = 0.0;
      amp = .40 * (1 - w(29.5, 31));
      ph = (t - 25) * 4.5;
      const p = w(31, 36), q = sg2(t, 32, 39);
      aL = rod([1, 0, -.3], -.65 * p);
      eL = .9 * p;
      wr = Math.sin(q * Math.PI * 4) * .65 * Math.sin(q * Math.PI);
      glowVal = 1 + .55 * w(26, 40);
    } else if (t < 52) {
      // Scene 4: Maju lurus menebas diagonal kombo (Rodrigues)
      const charge = Math.sin(w(40, 51) * Math.PI);
      const up = w(40, 43), dn = w(43, 45.8), rc = w(46.2, 51.5);
      let a = lp(-.65, -2.85, up), e = lp(.9, .45, up);
      a = lp(a, -.15, dn); e = lp(e, .08, dn);
      a = lp(a, -.65, rc); e = lp(e, .9, rc);
      aL = rod(AX1, a); eL = e;
      lunge = Math.sin(dn * Math.PI);
      x = -0.25 * charge;
      z = 0.65 + 1.15 * charge + 0.35 * lunge;
      yaw = 0.18 * lunge;
      glowVal = 1.5;
    } else if (t < 62) {
      // Scene 5: Menebas bola energi Sparky secara diagonal dari bawah ke atas
      const wu = w(52, 54.5), sl = w(54.5, 57.5), hd = w(57.5, 62);
      const axv = [AX1[0], 0, lp(AX1[2], AX2[2], wu)];
      let a = lp(-.65, .75, wu), e = lp(.9, .2, wu);
      a = lp(a, -2.65, sl); e = lp(e, .6, sl);
      a = lp(a, -1.75, hd);
      aL = rod(axv, a); eL = e;
      lunge = Math.sin(sl * Math.PI);
      x = -0.35;
      z = 1.15 + 0.45 * lunge;
      yaw = 0.15;
      glowVal = 1.5;
    } else if (t < 72) {
      // Scene 6: Terdorong mundur lurus oleh gelombang kejut ledakan
      const k = w(62, 65.0), r = w(65.0, 71.5);
      x = lp(-0.35, 0.0, k);
      z = 1.15 - 2.1 * k + 0.75 * r;
      yaw = 0.0;
      lean = .30 * k * (1 - r) + .04;
      lunge = .8 * k * (1 - r);
      aL = rod(AX2, lp(lp(-1.75, -1.15, k), -.5, r));
      eL = lp(lp(.6, .7, k), .9, r);
      aR = rod([1, 0, 0], -.7 * k * (1 - r));
      glowVal = lp(1.5, 1, r);
    } else {
      // Scene 7 & 8: Victory Pose menegakkan pedang di samping bahu
      const v = w(72, 76);
      x = 0.0;
      z = lp(-0.2, 0.0, v);
      yaw = 0.0;
      lean = .04 * (1 - v);
      aL = X(rod([0, 0, 1], -.5 * v), rod(AX2, lp(-.5, -.3, v)));
      eL = lp(.9, 1.92, v);
    }

    const sn = Math.sin(ph), bob = amp > .01 ? Math.abs(sn) * .08 * (amp / .58) : 0;
    if (!aL) aL = RX(-amp * sn * .4);
    if (!aR) aR = RX(amp * sn * .6);
    POSE.on = true; POSE.armL = aL; POSE.armR = aR; POSE.elbL = eL; POSE.elbR = .15 * amp; POSE.wrist = wr;
    POSE.breath = 1 + .06 * Math.sin(t * 3.4) * w(22, 25) * (t < 40 ? 1 : .6);
    POSE.glow = glowVal * (1 + .03 * Math.sin(t * 7));
    POSE.leg = [amp * sn - .4 * lunge, -amp * sn + .3 * lunge];
    ROOT = X(T(x, bob + dy, z), RY(yaw), RX(-lean), S(1 + .08 * sq, 1 - .15 * sq, 1 + .08 * sq), scAbout(0, 2.5, 0, sk));
  }

  function render(VP, eye, timeSec, worldMat) {
    WORLD = worldMat || I4();
    gl.useProgram(pg);
    gl.uniformMatrix4fv(uVP, false, VP);
    gl.uniform3fv(uCam, eye);
    drawGeometry(timeSec);
    gl.bindVertexArray(null);
  }

  return { updateTimeline, render };
}