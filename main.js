// ===================== MAIN.JS =====================
import { I4, mul, persp, lookAt, normalMat } from "./libs/math.js";
import { createBufferUploader } from "./libs/primitives.js";
import { createMegaKnight } from "./characters/megaknight.js";

const cv = document.getElementById("c");
const gl = cv.getContext("webgl", { antialias: true });

const vs = `
attribute vec3 aP, aN, aC;
uniform mat4 uM, uVP;
uniform mat3 uNM;
varying vec3 vN, vP, vC;
void main() {
  vec4 w = uM * vec4(aP, 1.0);
  vP = w.xyz;
  vN = uNM * aN;
  vC = aC;
  gl_Position = uVP * w;
}`;

const fs = `
precision mediump float;
varying vec3 vN, vP, vC;
uniform vec3 uEye;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vP);
  if (dot(N, V) < 0.0) N = -N;
  vec3 L1 = normalize(vec3(-0.35, 0.85, 0.65));
  vec3 L2 = normalize(vec3(0.55, -0.25, -0.65));
  vec3 H = normalize(L1 + V);
  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.12;
  float spec = pow(max(dot(N, H), 0.0), 24.0) * 0.16;
  vec3 col = vC * (0.58 + 0.46 * diff1 + 0.18 * diff2) + vec3(spec + rim);
  gl_FragColor = vec4(col, 1.0);
}`;

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s);
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog);
gl.useProgram(prog);

const loc = {
  aP: gl.getAttribLocation(prog, "aP"),
  aN: gl.getAttribLocation(prog, "aN"),
  aC: gl.getAttribLocation(prog, "aC"),
  uM: gl.getUniformLocation(prog, "uM"),
  uVP: gl.getUniformLocation(prog, "uVP"),
  uNM: gl.getUniformLocation(prog, "uNM"),
  uEye: gl.getUniformLocation(prog, "uEye"),
};

const uploader = createBufferUploader(gl);
const megaKnight = createMegaKnight(uploader);
// Nanti P.E.K.K.A (Valent), Sparky (Axel), dan Arena tinggal di-import di sini:
// const pekka = createPekka(uploader);
// const sparky = createSparky(uploader);
// const arena = createArena(uploader);

let yaw = 0.0,
  pitch = 0.12,
  dist = 10.2,
  drag = false,
  lx = 0,
  ly = 0;
let animMode = 0,
  tAnim = 0;

window.setCam = (y, p, d) => {
  yaw = y;
  pitch = p;
  dist = d;
};
window.setAnimMode = (mode) => {
  animMode = mode;
  tAnim = 0;
  for (let i = 0; i <= 7; i++) {
    const b = document.getElementById("btn_" + i);
    if (b) b.classList.toggle("active", i === mode);
  }
  if (mode === 0) {
    megaKnight.resetPose();
    document.getElementById("hudScene").textContent = "Pose Statis (Model Terkunci)";
    document.getElementById("hudRubric").textContent = "4 Quadrics + Box + 3D Bézier Curve";
  }
};

cv.onmousedown = (e) => {
  drag = true;
  lx = e.clientX;
  ly = e.clientY;
};
window.onmouseup = () => (drag = false);
window.onmousemove = (e) => {
  if (!drag) return;
  yaw -= (e.clientX - lx) * 0.008;
  pitch = Math.max(-1.52, Math.min(1.52, pitch + (e.clientY - ly) * 0.008));
  lx = e.clientX;
  ly = e.clientY;
};
cv.onwheel = (e) => {
  e.preventDefault();
  dist = Math.max(4.5, Math.min(26, dist * (1 + Math.sign(e.deltaY) * 0.08)));
};

function drawNode(n, parentM) {
  const M = mul(parentM, n.m);
  for (const pt of n.parts) {
    const W = mul(M, pt.m),
      g = pt.g();
    gl.uniformMatrix4fv(loc.uM, false, W);
    gl.uniformMatrix3fv(loc.uNM, false, normalMat(W));
    gl.bindBuffer(gl.ARRAY_BUFFER, g.p);
    gl.enableVertexAttribArray(loc.aP);
    gl.vertexAttribPointer(loc.aP, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.n);
    gl.enableVertexAttribArray(loc.aN);
    gl.vertexAttribPointer(loc.aN, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.c);
    gl.enableVertexAttribArray(loc.aC);
    gl.vertexAttribPointer(loc.aC, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.i);
    gl.drawElements(gl.TRIANGLES, g.cnt, gl.UNSIGNED_SHORT, 0);
  }
  for (const k of n.kids) drawNode(k, M);
}

let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (animMode !== 0) {
    tAnim += dt;
    const info = megaKnight.update(animMode, tAnim);
    if (info) {
      document.getElementById("hudScene").textContent = info.scene;
      document.getElementById("hudRubric").textContent = info.rubric;
    }
  }

  const dpr = window.devicePixelRatio || 1;
  const w = (cv.clientWidth * dpr) | 0,
    h = (cv.clientHeight * dpr) | 0;
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }

  gl.viewport(0, 0, w, h);
  gl.clearColor(0.078, 0.345, 0.612, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const target = [0, 2.25, 0];
  const eye = [
    target[0] + dist * Math.cos(pitch) * Math.sin(yaw),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * Math.cos(pitch) * Math.cos(yaw),
  ];
  const VP = mul(persp(0.55, w / h, 0.1, 100), lookAt(eye, target, [0, 1, 0]));

  gl.uniform3fv(loc.uEye, eye);
  gl.uniformMatrix4fv(loc.uVP, false, VP);

  drawNode(megaKnight.root, I4());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
