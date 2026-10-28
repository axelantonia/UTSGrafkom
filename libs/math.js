// ===================== LIBS/MATH.JS =====================
export const TAU = Math.PI * 2;
export const I4 = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

export const T = (x, y, z) => {
  const m = I4();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
};
export const S = (x, y, z) => {
  const m = I4();
  m[0] = x;
  m[5] = y === undefined ? x : y;
  m[10] = z === undefined ? x : z;
  return m;
};
export const RX = (a) => {
  const m = I4(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
};
export const RY = (a) => {
  const m = I4(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
};
export const RZ = (a) => {
  const m = I4(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
};

// Rotasi Sumbu Sembarang (Rumus Rodrigues)
export function RA(axis, a) {
  let [x, y, z] = axis;
  const l = Math.hypot(x, y, z) || 1;
  x /= l;
  y /= l;
  z /= l;
  const c = Math.cos(a),
    s = Math.sin(a),
    t = 1 - c,
    m = I4();
  m[0] = t * x * x + c;
  m[1] = t * x * y + s * z;
  m[2] = t * x * z - s * y;
  m[4] = t * x * y - s * z;
  m[5] = t * y * y + c;
  m[6] = t * y * z + s * x;
  m[8] = t * x * z + s * y;
  m[9] = t * y * z - s * x;
  m[10] = t * z * z + c;
  return m;
}

// Transformasi terhadap Titik Poros Sendi (Pivot)
export const around = (px, py, pz, M) => mul(T(px, py, pz), mul(M, T(-px, -py, -pz)));

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const nrm = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function persp(fov, asp, n, f) {
  const m = new Float32Array(16),
    t = 1 / Math.tan(fov / 2);
  m[0] = t / asp;
  m[5] = t;
  m[10] = (f + n) / (n - f);
  m[11] = -1;
  m[14] = (2 * f * n) / (n - f);
  return m;
}

export function lookAt(e, t, u) {
  const z = nrm(sub(e, t)),
    x = nrm(crs(u, z)),
    y = crs(z, x),
    m = I4();
  m[0] = x[0];
  m[4] = x[1];
  m[8] = x[2];
  m[1] = y[0];
  m[5] = y[1];
  m[9] = y[2];
  m[2] = z[0];
  m[6] = z[1];
  m[10] = z[2];
  m[12] = -dot(x, e);
  m[13] = -dot(y, e);
  m[14] = -dot(z, e);
  return m;
}

export function normalMat(m) {
  const a0 = [m[0], m[1], m[2]],
    a1 = [m[4], m[5], m[6]],
    a2 = [m[8], m[9], m[10]];
  const c0 = crs(a1, a2),
    c1 = crs(a2, a0),
    c2 = crs(a0, a1),
    d = dot(a0, c0) || 1;
  return new Float32Array([...c0, ...c1, ...c2].map((v) => v / d));
}

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const hex = (s) => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
