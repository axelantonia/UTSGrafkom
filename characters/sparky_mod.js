// ===================== CHARACTERS/SPARKY_MOD.JS =====================
import { I4, mul, T, S, RX, RY, RZ, RA, crs, nrm, dot, sub } from '../libs/math.js';

export function createSparky(gl) {
  const mm = (...mats) => mats.reduce(mul);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function nm(M) {
    const a = (r, c) => M[c * 4 + r];
    const C = [
      [a(1, 1) * a(2, 2) - a(1, 2) * a(2, 1), -(a(1, 0) * a(2, 2) - a(1, 2) * a(2, 0)), a(1, 0) * a(2, 1) - a(1, 1) * a(2, 0)],
      [-(a(0, 1) * a(2, 2) - a(0, 2) * a(2, 1)), a(0, 0) * a(2, 2) - a(0, 2) * a(2, 0), -(a(0, 0) * a(2, 1) - a(0, 1) * a(2, 0))],
      [a(0, 1) * a(1, 2) - a(0, 2) * a(1, 1), -(a(0, 0) * a(1, 2) - a(0, 2) * a(1, 0)), a(0, 0) * a(1, 1) - a(0, 1) * a(1, 0)]
    ];
    const o = new Float32Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[c * 3 + r] = C[r][c];
    return o;
  }

  const VS = `attribute vec3 aP, aN;
uniform mat4 uM, uVP;
uniform mat3 uNM;
varying vec3 vN, vW, vL;
void main() {
  vL = aP;
  vec4 w = uM * vec4(aP, 1.0);
  vW = w.xyz;
  vN = uNM * aN;
  gl_Position = uVP * w;
}`;

  const FS = `precision mediump float;
varying vec3 vN, vW, vL;
uniform vec4 uC;
uniform vec3 uE, uEye;
uniform vec2 uS;
uniform float uMode;
void main() {
  vec3 c = uC.rgb;
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vW);
  if (dot(N, V) < 0.0) N = -N;
  if (uMode >= 3.0) {
    gl_FragColor = vec4(c + uE, uC.a);
    return;
  }
  vec3 L = normalize(vec3(0.5, 1.0, 0.6));
  vec3 H = normalize(L + V);
  float d = max(dot(N, L), 0.0);
  float s = pow(max(dot(N, H), 0.0), uS.x) * uS.y;
  vec3 R = reflect(-V, N);
  float metal = clamp((uS.x - 35.0) / 55.0, 0.0, 1.0) * clamp(uS.y * 0.7, 0.0, 1.0);
  vec3 env = mix(vec3(0.24, 0.23, 0.25), vec3(0.82, 0.88, 0.98), 0.5 + 0.5 * R.y);
  if (R.z < -0.15 && abs(R.x) < 0.85) env += vec3(0.45, 0.04, 0.03) * max(0.0, -R.z);
  vec3 specCol = mix(vec3(1.0), c, metal * 0.85);
  vec3 amb = mix(vec3(0.32, 0.30, 0.30), vec3(0.55, 0.60, 0.68), 0.5 + 0.5 * N.y);
  vec3 col = c * (amb + 0.85 * d) + env * c * metal * 0.42 + specCol * s + uE;
  gl_FragColor = vec4(col, uC.a);
}`;

  function compileShader(type, src) {
    const o = gl.createShader(type);
    gl.shaderSource(o, src);
    gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o));
    return o;
  }

  const pr = gl.createProgram();
  gl.attachShader(pr, compileShader(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, compileShader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);

  const aP = gl.getAttribLocation(pr, 'aP');
  const aN = gl.getAttribLocation(pr, 'aN');
  const u = {};
  ['uM', 'uVP', 'uNM', 'uC', 'uE', 'uEye', 'uS', 'uMode'].forEach(n => u[n] = gl.getUniformLocation(pr, n));

  function mk(v, ix) {
    const vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ix), gl.STATIC_DRAW);
    return { vb, ib, n: ix.length };
  }

  function grid(v, ix, nu, nv, base) {
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const k = base + i * (nv + 1) + j;
        ix.push(k, k + 1, k + nv + 1, k + 1, k + nv + 2, k + nv + 1);
      }
  }

  function rbox(r, N = 14) {
    const v = [], ix = [];
    for (let a = 0; a < 3; a++) {
      for (let sgi = 0; sgi < 2; sgi++) {
        const sg = sgi === 0 ? -1 : 1, b = (a + 1) % 3, c = (a + 2) % 3, base = v.length / 6;
        for (let i = 0; i <= N; i++) {
          for (let j = 0; j <= N; j++) {
            const p = [0, 0, 0];
            p[a] = sg; p[b] = -1 + 2 * i / N; p[c] = -1 + 2 * j / N;
            const q = p.map(x => clamp(x, -(1 - r), 1 - r));
            const d = p.map((x, k) => x - q[k]);
            const l = Math.hypot(d[0], d[1], d[2]) || 1;
            const n = d.map(x => x / l);
            v.push(q[0] + n[0] * r, q[1] + n[1] * r, q[2] + n[2] * r, n[0], n[1], n[2]);
          }
        }
        grid(v, ix, N, N, base);
      }
    }
    return mk(v, ix);
  }

  function sph(la = 20, lo = 28) {
    const v = [], ix = [];
    for (let i = 0; i <= la; i++)
      for (let j = 0; j <= lo; j++) {
        const th = Math.PI * i / la, ph = 2 * Math.PI * j / lo;
        const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        v.push(n[0], n[1], n[2], n[0], n[1], n[2]);
      }
    grid(v, ix, la, lo, 0);
    return mk(v, ix);
  }

  function cyl(rt, rb, sg = 28) {
    const v = [], ix = [], sl = (rb - rt) / 2.0, nl = Math.hypot(1.0, sl);
    for (let i = 0; i <= sg; i++) {
      const a = 2 * Math.PI * i / sg, c = Math.cos(a), s = Math.sin(a), n = [c / nl, sl / nl, s / nl];
      v.push(c * rt, 1, s * rt, n[0], n[1], n[2], c * rb, -1, s * rb, n[0], n[1], n[2]);
    }
    for (let i = 0; i < sg; i++) { const k = 2 * i; ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    for (const [y, r, ny] of [[1, rt, 1], [-1, rb, -1]]) {
      if (!r) continue;
      const base = v.length / 6;
      v.push(0, y, 0, 0, ny, 0);
      for (let i = 0; i <= sg; i++) { const a = 2 * Math.PI * i / sg; v.push(Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0); }
      for (let i = 0; i < sg; i++) ix.push(base, base + 1 + i, base + 2 + i);
    }
    return mk(v, ix);
  }

  function tor(ratio = 0.20, nu = 40, nv = 20) {
    const v = [], ix = [];
    for (let i = 0; i <= nu; i++)
      for (let j = 0; j <= nv; j++) {
        const uA = 2 * Math.PI * i / nu, wA = 2 * Math.PI * j / nv;
        const cu = Math.cos(uA), su = Math.sin(uA), cw = Math.cos(wA), sw = Math.sin(wA);
        v.push((1 + ratio * cw) * cu, (1 + ratio * cw) * su, ratio * sw, cw * cu, cw * su, sw);
      }
    grid(v, ix, nu, nv, 0);
    return mk(v, ix);
  }

  function chamPlate(w, h, c, th) {
    const v = [], ix = [], ht = th / 2;
    const P = [[-w + c, h], [w - c, h], [w, h - c], [w, -h + c], [w - c, -h], [-w + c, -h], [-w, -h + c], [-w, h - c]];
    const bf = v.length / 6; v.push(0, 0, ht, 0, 0, 1);
    for (let i = 0; i < 8; i++) v.push(P[i][0], P[i][1], ht, 0, 0, 1);
    for (let i = 0; i < 8; i++) ix.push(bf, bf + 1 + i, bf + 1 + (i + 1) % 8);
    const bb = v.length / 6; v.push(0, 0, -ht, 0, 0, -1);
    for (let i = 0; i < 8; i++) v.push(P[i][0], P[i][1], -ht, 0, 0, -1);
    for (let i = 0; i < 8; i++) ix.push(bb, bb + 1 + (i + 1) % 8, bb + 1 + i);
    for (let i = 0; i < 8; i++) {
      const p1 = P[i], p2 = P[(i + 1) % 8], dx = p2[0] - p1[0], dy = p2[1] - p1[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l, s = v.length / 6;
      v.push(p1[0], p1[1], -ht, nx, ny, 0, p2[0], p2[1], -ht, nx, ny, 0, p2[0], p2[1], ht, nx, ny, 0, p1[0], p1[1], ht, nx, ny, 0);
      ix.push(s, s + 1, s + 2, s, s + 2, s + 3);
    }
    return mk(v, ix);
  }

  function trapPlate(yTF, yTB, yB, zF, zB, th) {
    const v = [], ix = [], ht = th / 2, C = [[yTF, zF], [yTB, zB], [yB, zB], [yB, zF]];
    const b0 = v.length / 6; for (let i = 0; i < 4; i++) v.push(ht, C[i][0], C[i][1], 1, 0, 0); ix.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    const b1 = v.length / 6; for (let i = 0; i < 4; i++) v.push(-ht, C[i][0], C[i][1], -1, 0, 0); ix.push(b1, b1 + 2, b1 + 1, b1, b1 + 3, b1 + 2);
    for (let i = 0; i < 4; i++) {
      const c1 = C[i], c2 = C[(i + 1) % 4], dy = c2[0] - c1[0], dz = c2[1] - c1[1], l = Math.hypot(dy, dz) || 1, ny = -dz / l, nz = dy / l, b = v.length / 6;
      v.push(ht, c1[0], c1[1], 0, ny, nz, -ht, c1[0], c1[1], 0, ny, nz, -ht, c2[0], c2[1], 0, ny, nz, ht, c2[0], c2[1], 0, ny, nz);
      ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return mk(v, ix);
  }

  const BP = [[-.62, 0], [-.18, .22], [.18, .22], [.62, 0]];
  function bz(t) {
    const uA = 1 - t, wA = [uA * uA * uA, 3 * uA * uA * t, 3 * uA * t * t, t * t * t], d = [3 * uA * uA, 6 * uA * t, 3 * t * t];
    let x = 0, z = 0, dx = 0, dz = 0;
    for (let i = 0; i < 4; i++) { x += BP[i][0] * wA[i]; z += BP[i][1] * wA[i]; }
    for (let i = 0; i < 3; i++) { dx += (BP[i + 1][0] - BP[i][0]) * d[i]; dz += (BP[i + 1][1] - BP[i][1]) * d[i]; }
    const l = Math.hypot(dx, dz) || 1;
    return { x, z, nx: -dz / l, nz: dx / l };
  }

  function bzBumper(hyTop, hyBotFlat, vDrop, h, S = 24) {
    const v = [], ix = [];
    const getHy = t => ({ top: hyTop, bot: hyBotFlat - vDrop * (1 - 2 * Math.abs(t - .5)) });
    const F = [
      (p, t) => { const y = getHy(t); return [[p.x + p.nx * h, y.bot, p.z + p.nz * h], [p.x + p.nx * h, y.top, p.z + p.nz * h], [p.nx, 0, p.nz]]; },
      (p, t) => { const y = getHy(t); return [[p.x - p.nx * h, y.bot, p.z - p.nz * h], [p.x - p.nx * h, y.top, p.z - p.nz * h], [-p.nx, 0, -p.nz]]; },
      (p, t) => { const y = getHy(t); return [[p.x - p.nx * h, y.top, p.z - p.nz * h], [p.x + p.nx * h, y.top, p.z + p.nz * h], [0, 1, 0]]; },
      (p, t) => { const y = getHy(t); return [[p.x - p.nx * h, y.bot, p.z - p.nz * h], [p.x + p.nx * h, y.bot, p.z + p.nz * h], [0, -1, 0]]; }
    ];
    for (const f of F) {
      const b = v.length / 6;
      for (let i = 0; i <= S; i++) {
        const t = i / S, [A, B, n] = f(bz(t), t);
        v.push(A[0], A[1], A[2], n[0], n[1], n[2], B[0], B[1], B[2], n[0], n[1], n[2]);
      }
      for (let i = 0; i < S; i++) { const k = b + 2 * i; ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    for (let cpi = 0; cpi < 2; cpi++) {
      const t = cpi === 0 ? 0 : 1, sign = cpi === 0 ? -1 : 1, p = bz(t), y = getHy(t), b = v.length / 6;
      v.push(p.x - p.nx * h, y.bot, p.z - p.nz * h, sign, 0, 0, p.x + p.nx * h, y.bot, p.z + p.nz * h, sign, 0, 0,
             p.x + p.nx * h, y.top, p.z + p.nz * h, sign, 0, 0, p.x - p.nx * h, y.top, p.z - p.nz * h, sign, 0, 0);
      ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return mk(v, ix);
  }

  function mkRearBumper() {
    const v = [], ix = [], th = 0.04, zb = x => -0.88 - 0.06 * (1 - Math.abs(x) / 0.62);
    const P_L = [[-0.62, 1.06], [-0.32, 1.06], [-0.32, 0.90], [0.00, 0.90], [0.00, 0.22], [-0.32, 0.27], [-0.62, 0.32]];
    const P_R = [[0.62, 1.06], [0.32, 1.06], [0.32, 0.90], [0.00, 0.90], [0.00, 0.22], [0.32, 0.27], [0.62, 0.32]];
    const nl_b = nrm([-0.0968, 0, -1]), nr_b = nrm([0.0968, 0, -1]), nl_f = nrm([0.0968, 0, 1]), nr_f = nrm([-0.0968, 0, 1]);
    function addQuad(p0, p1, p2, p3, n) {
      const b = v.length / 6, gn = nrm(crs(sub(p1, p0), sub(p2, p0)));
      const pts = (n && dot(gn, n) < 0) ? [p0, p3, p2, p1] : [p0, p1, p2, p3], fn = n || gn;
      for (const pt of pts) v.push(pt[0], pt[1], pt[2], fn[0], fn[1], fn[2]);
      ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const pL_b = P_L.map(pt => [pt[0], pt[1], zb(pt[0])]), bLb = v.length / 6;
    for (const pt of pL_b) v.push(pt[0], pt[1], pt[2], nl_b[0], nl_b[1], nl_b[2]);
    ix.push(bLb, bLb+1, bLb+2, bLb, bLb+2, bLb+6, bLb+6, bLb+2, bLb+5, bLb+2, bLb+3, bLb+4, bLb+2, bLb+4, bLb+5);
    const pR_b = P_R.map(pt => [pt[0], pt[1], zb(pt[0])]), bRb = v.length / 6;
    for (const pt of pR_b) v.push(pt[0], pt[1], pt[2], nr_b[0], nr_b[1], nr_b[2]);
    ix.push(bRb+1, bRb, bRb+2, bRb+2, bRb, bRb+6, bRb+2, bRb+6, bRb+5, bRb+3, bRb+2, bRb+4, bRb+2, bRb+5, bRb+4);
    const pL_f = P_L.map(pt => [pt[0], pt[1], zb(pt[0]) + th]), bLf = v.length / 6;
    for (const pt of pL_f) v.push(pt[0], pt[1], pt[2], nl_f[0], nl_f[1], nl_f[2]);
    ix.push(bLf+2, bLf+1, bLf, bLf+6, bLf+2, bLf, bLf+5, bLf+2, bLf+6, bLf+4, bLf+3, bLf+2, bLf+5, bLf+4, bLf+2);
    const pR_f = P_R.map(pt => [pt[0], pt[1], zb(pt[0]) + th]), bRf = v.length / 6;
    for (const pt of pR_f) v.push(pt[0], pt[1], pt[2], nr_f[0], nr_f[1], nr_f[2]);
    ix.push(bRf+2, bRf, bRf+1, bRf+6, bRf, bRf+2, bRf+5, bRf+6, bRf+2, bRf+4, bRf+2, bRf+3, bRf+4, bRf+5, bRf+2);
    addQuad(pL_b[0], pL_b[1], pL_f[1], pL_f[0], [0, 1, 0]); addQuad(pL_b[1], pL_b[2], pL_f[2], pL_f[1], [1, 0, 0]);
    addQuad(pL_b[2], pL_b[3], pL_f[3], pL_f[2], [0, 1, 0]); addQuad(pR_b[3], pR_b[2], pR_f[2], pR_f[3], [0, 1, 0]);
    addQuad(pR_b[2], pR_b[1], pR_f[1], pR_f[2], [-1, 0, 0]); addQuad(pR_b[1], pR_b[0], pR_f[0], pR_f[1], [0, 1, 0]);
    addQuad(pL_b[6], pL_b[5], pL_f[5], pL_f[6], [0, -1, 0]); addQuad(pL_b[5], pL_b[4], pL_f[4], pL_f[5], [0, -1, 0]);
    addQuad(pR_b[4], pR_b[5], pR_f[5], pR_f[4], [0, -1, 0]); addQuad(pR_b[5], pR_b[6], pR_f[6], pR_f[5], [0, -1, 0]);
    return mk(v, ix);
  }

  function mkRearSideWing() {
    const v = [], ix = [], ht = 0.0175;
    const C = [[1.06, -0.86], [1.06, -0.74], [0.78, -0.74], [0.78, -0.62], [0.32, -0.62], [0.32, -0.86]], C_mid = [0.32, -0.74];
    const pts0 = [C[0], C[1], C_mid, C[5], C[2], C[3], C[4]];
    const b0 = v.length / 6; for (const pt of pts0) v.push(ht, pt[0], pt[1], 1, 0, 0);
    ix.push(b0, b0+1, b0+2, b0, b0+2, b0+3, b0+4, b0+5, b0+6, b0+4, b0+6, b0+2);
    const b1 = v.length / 6; for (const pt of pts0) v.push(-ht, pt[0], pt[1], -1, 0, 0);
    ix.push(b1, b1+2, b1+1, b1, b1+3, b1+2, b1+4, b1+6, b1+5, b1+4, b1+2, b1+6);
    for (let i = 0; i < 6; i++) {
      const p1 = C[i], p2 = C[(i + 1) % 6], dy = p2[0] - p1[0], dz = p2[1] - p1[1], l = Math.hypot(dy, dz) || 1, ny = -dz / l, nz = dy / l, s = v.length / 6;
      v.push(ht, p1[0], p1[1], 0, ny, nz, -ht, p1[0], p1[1], 0, ny, nz, -ht, p2[0], p2[1], 0, ny, nz, ht, p2[0], p2[1], 0, ny, nz);
      ix.push(s, s + 1, s + 2, s, s + 2, s + 3);
    }
    return mk(v, ix);
  }

  const G = {
    chas: rbox(.08), plate: chamPlate(.54, .48, .16, .09), coil: rbox(.25), rbox: rbox(.08),
    sph: sph(), wheel: cyl(1, 1, 12), cyl: cyl(1, 1), cone: cyl(0, 1, 16), trunc: cyl(.45, 1),
    ring: tor(.20), bf: bzBumper(.86, .32, .14, .045), wing: trapPlate(.86, .72, .32, .86, .60, .035),
    rearBumper: mkRearBumper(), rearWing: mkRearSideWing()
  };

  const wood = [.64, .43, .28], wood2 = [.52, .34, .21], woodWheel = [.56, .38, .24], woodHub = [.30, .22, .16],
        dark = [.2, .2, .23], iron = [.38, .44, .58], iron2 = [.32, .37, .50], gold = [.96, .78, .16],
        silver = [.88, .92, .98], ironSpike = [.24, .25, .28], red = [.94, .08, .08];

  let WORLD = I4();
  const car = {
    x: 0, z: 0, rot: 0, lAng: 0, rAng: 0, pitch: 0, roll: 0, bob: 0,
    turretRotY: 0, headScale: 1.0, recoilMat: I4(), coilScales: [1, 1, 1, 1, 1, 1], attachedBallMat: null
  };
  const worldBall = { visible: false, p: [0, 1.26, 0], s: 0.22 };
  let whiteFlash = 0.0;

  function draw(m, M, c, mode = 0, sp = [40, 0.4], e = [0, 0, 0]) {
    const W = mul(WORLD, M);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
    gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.uniformMatrix4fv(u.uM, false, W);
    gl.uniformMatrix3fv(u.uNM, false, nm(W));
    gl.uniform4fv(u.uC, c.length === 3 ? [c[0], c[1], c[2], 1.0] : c);
    gl.uniform1f(u.uMode, mode);
    gl.uniform2fv(u.uS, sp);
    gl.uniform3fv(u.uE, e);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  }

  function drawSparky() {
    const base = mm(T(car.x, 0, car.z), RY(car.rot));
    const body = mm(base, T(0, car.bob, 0), RX(car.pitch), RZ(car.roll));

    draw(G.chas, mm(body, T(-.48, .50, 0), S(.12, .17, .86)), wood, 0, [15, .15]);
    draw(G.chas, mm(body, T(.48, .50, 0), S(.12, .17, .86)), wood, 0, [15, .15]);
    draw(G.chas, mm(body, T(0, .50, .66), S(.36, .17, .20)), wood, 0, [15, .15]);
    draw(G.chas, mm(body, T(0, .50, -.66), S(.36, .17, .20)), wood, 0, [15, .15]);
    draw(G.chas, mm(body, T(0, .36, 0), S(.36, .04, .46)), wood2, 0, [15, .15]);

    for (const [sx, sz] of [[-1, 1], [-1, -1], [1, 1], [1, -1]]) {
      const wx = sx * .74, wz = sz * .44, wy = .34, wAng = sx < 0 ? car.lAng : car.rAng;
      const wm = mm(body, T(wx, wy, wz), RX(wAng));
      draw(G.wheel, mm(wm, RZ(Math.PI / 2), S(.34, .11, .34)), woodWheel, 0, [15, .15]);
      draw(G.cyl, mm(wm, RZ(Math.PI / 2), S(.21, .12, .21)), woodHub, 0, [15, .15]);
      draw(G.cyl, mm(wm, RZ(Math.PI / 2), S(.06, .17, .06)), dark, 0, [60, .8]);
      draw(G.sph, mm(body, T(sx * .58, wy, wz), S(.07, .12, .12)), dark);
      draw(G.sph, mm(wm, T(sx * .12, 0, 0), S(.04, .04, .04)), silver, 0, [90, 1]);
    }

    draw(G.bf, mm(body, T(0, 0, .86)), iron, 0, [50, .7]);
    for (const sx of [-1, 1]) draw(G.wing, mm(body, T(sx * .615, 0, 0)), iron, 0, [50, .7]);
    for (const rY of [.44, .69]) {
      for (const cU of [.16, .36, .64, .84]) {
        const p = bz(cU), ph = Math.atan2(p.nx, p.nz);
        draw(G.cone, mm(body, T(p.x + p.nx * .045, rY, .86 + p.z + p.nz * .045), RY(ph), RX(Math.PI / 2), S(.10, .13, .10), T(0, 1, 0)), ironSpike, 0, [75, 1.0]);
      }
    }

    draw(G.rearBumper, body, iron, 0, [50, .7]);
    for (const sx of [-1, 1]) {
      draw(G.rearWing, mm(body, T(sx * .615, 0, 0)), iron, 0, [50, .7]);
      for (const by of [.52, .90]) draw(G.sph, mm(body, T(sx * .47, by, -0.895), S(.065, .065, .065)), silver, 0, [90, 1.2]);
    }

    const M_turretBase = mm(body, T(0, 0.43, 0), RY(car.turretRotY));
    draw(G.sph, mm(M_turretBase, S(.32, .05, .32)), dark, 0, [40, .6]);
    draw(G.wheel, mm(M_turretBase, T(0, 0.04, 0), S(.28, .03, .28)), dark, 0, [40, .6]);
    draw(G.cyl, mm(M_turretBase, T(0, 0.23, 0), S(.11, .16, .11)), dark, 0, [50, .7]);

    const M_machine = mm(M_turretBase, T(0, 0.65, -0.25), car.recoilMat, T(0, 0.18, 0.25), S(car.headScale, car.headScale, car.headScale));
    draw(G.plate, mm(M_machine, T(0, 0, .44)), iron, 0, [50, .7]);
    draw(G.ring, mm(M_machine, T(0, 0, .46), S(.22, .22, .14)), [.24, .27, .33], 0, [50, .7]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      draw(G.sph, mm(M_machine, T(sx * .40, sy * .34, .49), S(.032, .032, .032)), silver, 0, [95, 1.3]);
      draw(G.sph, mm(M_machine, T(sx * .40, sy * .34, -.49), S(.032, .032, .032)), silver, 0, [95, 1.3]);
    }
    draw(G.plate, mm(M_machine, T(0, 0, -.44)), iron2, 0, [50, .7]);
    draw(G.rbox, mm(M_machine, T(0, .48, 0), S(.14, .045, .46)), iron, 0, [50, .7]);
    draw(G.rbox, mm(M_machine, T(0, -.48, 0), S(.15, .045, .46)), iron2, 0, [40, .6]);

    for (let i = 0; i < 6; i++) {
      const z = -.3125 + i * .125, sc = car.coilScales[i] || 1.0;
      draw(G.coil, mm(M_machine, T(0, 0, z), S(.49 * sc, .39 * sc, .063)), red, 0, [70, 1.0]);
    }

    const M_barrel = mm(M_machine, T(0, 0, .73));
    draw(G.trunc, mm(M_barrel, RX(Math.PI / 2), S(.21, .29, .21)), [.34, .39, .47], 0, [50, .7]);
    draw(G.cyl, mm(M_barrel, T(0, 0, 0.32), RX(Math.PI / 2), S(.095, .035, .095)), [.23, .26, .32], 0, [60, .8]);
    draw(G.cyl, mm(M_barrel, T(0, 0, 0.355), RX(Math.PI / 2), S(.080, .008, .080)), [.44, .55, .70], 0, [55, .8]);

    draw(G.ring, mm(M_barrel, T(0, 0, -0.15), S(.42, .42, .42)), gold, 0, [95, 1.4]);
    draw(G.ring, mm(M_barrel, T(0, 0, 0.06), S(.31, .31, .31)), gold, 0, [95, 1.4]);
    draw(G.ring, mm(M_barrel, T(0, 0, 0.27), S(.20, .20, .20)), gold, 0, [95, 1.4]);

    if (car.attachedBallMat) {
      draw(G.sph, mm(M_barrel, car.attachedBallMat), [1.0, 0.88, 0.15], 3, [90, 1.2], [0.9, 0.75, 0.1]);
      draw(G.sph, mm(M_barrel, car.attachedBallMat, S(0.68, 0.68, 0.68)), [1.0, 1.0, 0.88], 3);
    }

    if (worldBall.visible) {
      const M_wb = mm(T(worldBall.p[0], worldBall.p[1], worldBall.p[2]), S(worldBall.s, worldBall.s, worldBall.s));
      draw(G.sph, M_wb, [1.0, 0.88, 0.15], 3, [90, 1.2], [0.9, 0.75, 0.1]);
      draw(G.sph, mm(M_wb, S(0.68, 0.68, 0.68)), [1.0, 1.0, 0.88], 3);
    }
  }

  function updateTimeline(TL) {
    whiteFlash = 0.0;
    worldBall.visible = false;
    car.attachedBallMat = null;
    car.recoilMat = I4();
    car.headScale = 1.0;
    car.coilScales = [1, 1, 1, 1, 1, 1];
    car.pitch = 0; car.roll = 0; car.bob = 0; car.x = 0; car.z = 0; car.rot = 0; car.turretRotY = 0;

    if (TL === null) return 0;

    if (TL < 12) {
      // Scene 1: Meluncur di atas rumput (dari car.z = -1.6 ke 0.0 -> World Z = 2.1 ke 4.3, TIDAK menyentuh sungai!)
      const p = Math.min(1.0, TL / 12.0), ease = p * p * (3 - 2 * p);
      car.z = -1.6 + 1.6 * ease;
      const distMoved = 1.6 * ease;
      car.lAng = distMoved / 0.34; car.rAng = distMoved / 0.34;
      car.bob = Math.sin(TL * 14.0) * 0.012 * (1.0 - ease * 0.5);
      car.turretRotY = Math.sin(p * Math.PI * 2.5) * 0.32 * (1.0 - p * 0.3);
    } else if (TL < 25) {
      // Scene 2: Standby saat P.E.K.K.A & Mega Knight masuk
      const t = TL - 12;
      car.bob = Math.sin(t * 16.0) * 0.005;
      car.turretRotY = Math.sin(t * 2.0) * 0.08;
    } else if (TL < 40) {
      // Scene 3: Power Up (Kumparan merah & kepala meriam membesar + bola energi muncul di moncong)
      const t = TL - 25, p = Math.min(1.0, t / 15.0);
      const pulseFreq = 6.0 + 12.0 * p, pulse = Math.max(0, Math.sin(t * pulseFreq));
      car.headScale = 1.0 + (0.04 * p + 0.07 * pulse * p);
      car.bob = Math.sin(t * 28.0) * (0.004 + 0.008 * p);
      for (let i = 0; i < 6; i++) {
        const wave = Math.sin(t * (pulseFreq + 2.0) - i * 0.75);
        car.coilScales[i] = 1.0 + 0.14 * Math.max(0, wave) * p;
      }
      const ballRadius = 0.04 + 0.18 * p;
      car.attachedBallMat = mm(T(0, 0, 0.48), S(ballRadius, ballRadius, ballRadius));
    } else if (TL < 52) {
      // Scene 4: Menghindar mundur & serong saat dipukul Mega Knight & P.E.K.K.A
      const t = TL - 40, p = Math.min(1.0, t / 12.0);
      const dodgeZ = Math.sin(p * Math.PI * 0.5);
      car.z = -0.55 * dodgeZ;
      const dodgeSide = Math.sin(p * Math.PI);
      car.x = -0.45 * dodgeSide;
      car.rot = -0.30 * dodgeSide;
      car.lAng = car.z / 0.34; car.rAng = car.z / 0.34;
      car.headScale = 1.08 + 0.03 * Math.max(0, Math.sin(t * 16.0));
      car.attachedBallMat = mm(T(0, 0, 0.48), S(0.22, 0.22, 0.22));
    } else if (TL < 62) {
      // Scene 5: Menembakkan bola energi + Recoil Rodrigues 42 derajat
      const t = TL - 52, p = Math.min(1.0, t / 10.0);
      const pushBackShove = 1.0 - Math.exp(-t * 2.5);
      car.z = -0.55 - 0.85 * pushBackShove; // Tetap di atas rumput (World Z >= 2.4)
      car.lAng = car.z / 0.34; car.rAng = car.z / 0.34;
      worldBall.visible = true;
      worldBall.s = 0.22 + 0.06 * p;
      // Bola energi meluncur dari moncong menuju pedang P.E.K.K.A (car.z = 0.85)
      const fly = Math.min(1.0, t / 3.2);
      worldBall.p = [0, 1.15, -0.1 + fly * 1.05];
      const kick = Math.sin(Math.min(1.0, t / 0.35) * Math.PI * 0.5);
      const recoilAngle = (0.73 * Math.exp(-t * 0.8) + 0.52 * (1.0 - Math.exp(-t * 1.2))) * kick;
      car.recoilMat = RA([-0.6917, 0.2075, 0.6917], recoilAngle);
    } else if (TL < 72) {
      // Scene 6: Bola energi meledak membesar tepat saat ditebas P.E.K.K.A + Shockwave
      const t = TL - 62, p = Math.min(1.0, t / 10.0);
      worldBall.visible = t < 4.2;
      worldBall.p = [0, 1.20, 0.95];
      worldBall.s = 0.28 + Math.pow(Math.min(t, 4.2) * 1.35, 2.25);
      if (t < 1.2) whiteFlash = (t / 1.2) * 0.92;
      else if (t < 4.2) whiteFlash = Math.max(0, 0.92 * (1.0 - (t - 1.2) / 3.0));
      const shockPush = 0.35 * Math.min(1.0, p * 2.2);
      car.z = -1.40 - shockPush; // Tetap di atas rumput
      car.lAng = car.z / 0.34; car.rAng = car.z / 0.34;
      const shake = Math.exp(-t * 0.8) * 0.09;
      car.pitch = Math.sin(t * 42.0) * shake * 0.7;
      car.roll = Math.cos(t * 36.0) * shake * 0.7;
      car.bob = Math.sin(t * 48.0) * shake * 0.04;
      const recoilAngle6 = 0.52 + Math.sin(t * 38.0) * shake * 0.4;
      car.recoilMat = RA([-0.6917, 0.2075, 0.6917], recoilAngle6);
    } else {
      // Scene 7 & 8: Kembali ke posisi tegak semula
      const t = TL - 72, p = Math.min(1.0, t / 10.0), ease = p * p * (3 - 2 * p);
      car.z = -1.75 * (1.0 - ease);
      const travelZ = -1.75 + 1.75 * ease;
      car.lAng = travelZ / 0.34; car.rAng = travelZ / 0.34;
      const returnRecoilAngle = 0.52 * (1.0 - ease);
      car.recoilMat = RA([-0.6917, 0.2075, 0.6917], returnRecoilAngle);
      car.turretRotY = Math.sin(t * 2.8) * Math.exp(-t * 0.35) * 0.28;
    }
    return whiteFlash;
  }

  function render(VP, eye, worldMat) {
    WORLD = worldMat || I4();
    gl.bindVertexArray(null);
    gl.useProgram(pr);
    gl.enableVertexAttribArray(aP);
    gl.enableVertexAttribArray(aN);
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniform3fv(u.uEye, eye);
    drawSparky();
    gl.disableVertexAttribArray(aP);
    gl.disableVertexAttribArray(aN);
  }

  return { updateTimeline, render };
}