// ===================== LIBS/PRIMITIVES.JS =====================
import { TAU, crs, nrm } from "./math.js";

export function grid(nu, nv, f, col) {
  const p = [],
    n = [],
    c = [],
    ix = [];
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const q = f(i / nu, j / nv);
      const cc = typeof col === "function" ? col(i / nu, j / nv) : col;
      p.push(q[0], q[1], q[2]);
      n.push(q[3], q[4], q[5]);
      c.push(...cc);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j,
        b = a + nv + 1;
      ix.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { p, n, c, ix };
}

export function merge(gs) {
  const o = { p: [], n: [], c: [], ix: [] };
  for (const g of gs) {
    const off = o.p.length / 3;
    o.p.push(...g.p);
    o.n.push(...g.n);
    o.c.push(...g.c);
    for (const i of g.ix) o.ix.push(i + off);
  }
  return o;
}

export const disc = (y, ny, col) => grid(1, 32, (u, v) => [u * Math.cos(v * TAU), y, u * Math.sin(v * TAU), 0, ny, 0], col);

// QUADRIC 1: ELLIPSOID
export const ellipsoid = (col) =>
  grid(
    22,
    32,
    (u, v) => {
      const th = u * Math.PI,
        ph = v * TAU;
      const x = Math.sin(th) * Math.cos(ph),
        y = Math.cos(th),
        z = Math.sin(th) * Math.sin(ph);
      return [x, y, z, x, y, z];
    },
    col
  );

// QUADRIC 2: CYLINDER
export const cylinder = (col) =>
  merge([
    grid(
      1,
      32,
      (u, v) => {
        const c = Math.cos(v * TAU),
          s = Math.sin(v * TAU);
        return [c, u - 0.5, s, c, 0, s];
      },
      col
    ),
    disc(0.5, 1, col),
    disc(-0.5, -1, col),
  ]);

// QUADRIC 2B: CYLINDER TERBUKA (Shell)
export const shell = (col) => {
  const a = 0.58,
    t0 = Math.PI / 2 + a,
    t1 = Math.PI / 2 + TAU - a,
    ri = 0.84,
    tt = (v) => t0 + (t1 - t0) * v;
  const out = grid(
    1,
    32,
    (u, v) => {
      const t = tt(v),
        c = Math.cos(t),
        s = Math.sin(t);
      return [c, u - 0.5, s, c, 0, s];
    },
    col
  );
  const inn = grid(
    1,
    32,
    (u, v) => {
      const t = tt(v),
        c = Math.cos(t),
        s = Math.sin(t);
      return [ri * c, u - 0.5, ri * s, -c, 0, -s];
    },
    col
  );
  const wall = (t) =>
    grid(
      1,
      1,
      (u, v) => {
        const c = Math.cos(t),
          s = Math.sin(t),
          r = 1 - (1 - ri) * v;
        return [r * c, u - 0.5, r * s, s, 0, -c];
      },
      col
    );
  const cap = (y) =>
    grid(
      1,
      32,
      (u, v) => {
        const t = tt(v),
          r = 1 - (1 - ri) * u;
        return [r * Math.cos(t), y, r * Math.sin(t), 0, y > 0 ? 1 : -1, 0];
      },
      col
    );
  return merge([out, inn, wall(t0), wall(t1), cap(0.5), cap(-0.5)]);
};

// QUADRIC 3: CONE
export const cone = (col, pyramid = 0) =>
  merge([
    grid(
      16,
      32,
      (u, v) => {
        const ang = v * TAU;
        const mod = pyramid ? 1 - 0.11 * Math.cos(4 * ang) : 1;
        const c = Math.cos(ang) * mod,
          s = Math.sin(ang) * mod;
        const r = Math.pow(1 - u, 0.86);
        return [r * c, u, r * s, c, 0.78, s];
      },
      col
    ),
    disc(0, -1, col),
  ]);

// QUADRIC 4: ELLIPTIC PARABOLOID
export const paraboloid = (col) =>
  grid(
    20,
    36,
    (u, v) => {
      const r = 1 - u,
        c = Math.cos(v * TAU),
        s = Math.sin(v * TAU);
      return [r * c, 1 - r * r, r * s, 2 * r * c, 1, 2 * r * s];
    },
    col
  );

// OBJEK LAIN: BOX MODIFIKASI
export function box(col, r = 0.08) {
  const F = [
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [1, 0, 0],
      [0, 1, 0],
    ],
  ];
  const pts = [-0.5, -0.47, -0.42, -0.2, 0.2, 0.42, 0.47, 0.5];
  const cl = (x) => Math.max(-0.5 + r, Math.min(0.5 - r, x));
  return merge(
    F.map(([N, A, B]) =>
      grid(
        7,
        7,
        (u, v) => {
          const a = pts[Math.round(u * 7)],
            b = pts[Math.round(v * 7)];
          const q = [0, 1, 2].map((i) => N[i] * 0.5 + A[i] * a + B[i] * b);
          const inn = q.map(cl),
            d = nrm(q.map((x, i) => x - inn[i]));
          return [inn[0] + d[0] * r, inn[1] + d[1] * r, inn[2] + d[2] * r, ...d];
        },
        col
      )
    )
  );
}

// KURVA 3D: TABUNG KURVA BEZIER KUBIK 3D
const BZ = [
  [0, 0, 0],
  [0, 0.34, 0.02],
  [0, 0.62, -0.08],
  [0, 0.72, -0.42],
];
export function bez(t, deriv = false, ctrlPts = BZ) {
  const u = 1 - t,
    P = ctrlPts;
  return [0, 1, 2].map((i) =>
    deriv
      ? 3 * u * u * (P[1][i] - P[0][i]) + 6 * u * t * (P[2][i] - P[1][i]) + 3 * t * t * (P[3][i] - P[2][i])
      : u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]
  );
}

export function plumeTube(indigoCol, darkIndigoCol) {
  return grid(
    44,
    36,
    (u, v) => {
      const P = bez(u),
        Tn = nrm(bez(u, true));
      const N = nrm([0, Tn[2], -Tn[1]]),
        B = crs(Tn, N);
      const ang = v * TAU;
      let baseR = 0.052,
        lobe = 0;
      if (u > 0.22) {
        const s = (u - 0.22) / 0.78;
        const env = s < 0.74 ? Math.sin((s / 0.74) * (Math.PI / 2)) : Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.74) / 0.26, 2)));
        baseR = 0.052 * (1 - env * 0.45) + 0.24 * env;
        lobe = 0.16 * env * Math.cos(3 * ang);
      }
      const r = baseR * (1 + lobe);
      const c = Math.cos(ang) * 0.92,
        s = Math.sin(ang) * 1.12;
      const d = [c * N[0] + s * B[0], c * N[1] + s * B[1], c * N[2] + s * B[2]];
      const nrmVec = nrm([d[0], d[1] + 0.15, d[2]]);
      return [P[0] + r * d[0], P[1] + r * d[1], P[2] + r * d[2], ...nrmVec];
    },
    (u, v) => (Math.cos(3 * v * TAU) < -0.3 && u > 0.32 ? darkIndigoCol : indigoCol)
  );
}

// Helper Scene Graph Node & Buffer Uploader
export const part = (g, m) => ({ g, m });
export const node = (m, parts = [], kids = []) => ({ m, baseM: m, parts, kids });

export function createBufferUploader(gl) {
  const cache = {};
  function upload(g) {
    const buf = (arr, target) => {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, arr, gl.STATIC_DRAW);
      return b;
    };
    return {
      p: buf(new Float32Array(g.p), gl.ARRAY_BUFFER),
      n: buf(new Float32Array(g.n), gl.ARRAY_BUFFER),
      c: buf(new Float32Array(g.c), gl.ARRAY_BUFFER),
      i: buf(new Uint16Array(g.ix), gl.ELEMENT_ARRAY_BUFFER),
      cnt: g.ix.length,
    };
  }
  return { upload, cache };
}
