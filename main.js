// ===================== MAIN.JS (UNIFIED 3 CHARACTERS + ARENA + 8 SCENES) =====================
import { I4, mul, T, S, RY, persp, lookAt, normalMat, smooth } from './libs/math.js';
import { createBufferUploader } from './libs/primitives.js';
import { createMegaKnight } from './characters/megaknight.js';
import { createPekka } from './characters/pekka.js';
import { createSparky } from './characters/sparky_mod.js';
import { createArena } from './environment/arena.js';

const cv = document.getElementById('c');
const gl = cv.getContext('webgl2', { antialias: true, alpha: false });
if (!gl) alert('WebGL2 tidak tersedia di browser ini.');

// Shader untuk Mega Knight
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

const mkProg = gl.createProgram();
gl.attachShader(mkProg, compileShader(gl.VERTEX_SHADER, vs));
gl.attachShader(mkProg, compileShader(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(mkProg);

const loc = {
  aP: gl.getAttribLocation(mkProg, 'aP'),
  aN: gl.getAttribLocation(mkProg, 'aN'),
  aC: gl.getAttribLocation(mkProg, 'aC'),
  uM: gl.getUniformLocation(mkProg, 'uM'),
  uVP: gl.getUniformLocation(mkProg, 'uVP'),
  uNM: gl.getUniformLocation(mkProg, 'uNM'),
  uEye: gl.getUniformLocation(mkProg, 'uEye')
};

const uploader = createBufferUploader(gl);
const arena = createArena(gl);
const megaKnight = createMegaKnight(uploader);
const pekka = createPekka(gl);
const sparky = createSparky(gl);

// Penempatan Ketiga Karakter dengan Jarak Lega di Lapangan Tengah-Biru (Bebas dari Menara)
// Sparky di tengah-depan sungai (0, 0, 3.4) menghadap ke arah Mega Knight & P.E.K.K.A (+Z)
// P.E.K.K.A di sayap kiri (-2.25, 0, 7.5) menghadap serong ke Sparky
// Mega Knight di sayap kanan (+2.25, 0, 7.5) menghadap serong ke Sparky
const WORLD_SPARKY = mul(T(0.0, 0.0, 3.4), S(1.22, 1.22, 1.22));
const WORLD_PEKKA  = mul(T(-1.75, 0.0, 7.2), mul(RY(Math.PI - 0.15), S(0.66, 0.66, 0.66)));
let   WORLD_MK     = mul(T( 2.25, 0.0, 7.5), mul(RY(Math.PI + 0.26), S(0.74, 0.74, 0.74)));

function drawMKNode(n, parentM) {
  const M = mul(parentM, n.m);
  for (const pt of n.parts) {
    const W = mul(M, pt.m), g = pt.g();
    gl.uniformMatrix4fv(loc.uM, false, W);
    gl.uniformMatrix3fv(loc.uNM, false, normalMat(W));
    gl.bindBuffer(gl.ARRAY_BUFFER, g.p); gl.enableVertexAttribArray(loc.aP); gl.vertexAttribPointer(loc.aP, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.n); gl.enableVertexAttribArray(loc.aN); gl.vertexAttribPointer(loc.aN, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.c); gl.enableVertexAttribArray(loc.aC); gl.vertexAttribPointer(loc.aC, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.i);
    gl.drawElements(gl.TRIANGLES, g.cnt, gl.UNSIGNED_SHORT, 0);
  }
  for (const k of n.kids) drawMKNode(k, M);
}

// State Kamera & Timeline 90 Detik
let yaw = 2.65, pitch = 0.28, dist = 12.5, target = [0, 1.6, 5.4];
let drag = false, lx = 0, ly = 0;
let playing = false, cineCam = true, TL = 0, endAt = 90;

const lp = (a, b, k) => a + (b - a) * smooth(k);

const SCENE_INFO = [
  [0,  12, 'Scene 1 (00:00–00:12): Pengenalan Arena & Masuknya Sparky', 'Translate Z + Rotate Roda & Turret + Hierarchy'],
  [12, 25, 'Scene 2 (00:12–00:25): Masuknya Mega Knight & P.E.K.K.A', 'Translate Parabola + Rotate + Squash-Stretch Scaling + Hierarchy'],
  [25, 40, 'Scene 3 (00:25–00:40): Persiapan Tempur (Power Up)', 'Scaling (Coils, Bola Energi, Gauntlets, Tanduk) + Rotate + Hierarchy'],
  [40, 52, 'Scene 4 (00:40–00:52): Serangan Kombinasi Diagonal', 'Rotate Arbitrary Axis (Rumus Rodrigues) + Translate + Hierarchy'],
  [52, 62, 'Scene 5 (00:52–01:02): Tembakan Proyektil, Recoil & Tangkisan', 'Rotate Arbitrary Axis (Rodrigues Recoil, Slash, Cross-Guard) + Translate'],
  [62, 72, 'Scene 6 (01:02–01:12): Dampak Benturan & Gelombang Kejut', 'Scaling Eksponensial + White Flash + Shockwave Translate & Rotate'],
  [72, 82, 'Scene 7 (01:12–01:22): Resolusi Akhir & Victory Pose', 'Hierarchical Transformation + Rotate + Slow Pull-Back Camera'],
  [82, 90, 'Scene 8 (01:22–01:30): Penutup & Credits Kelompok', 'Fade to Black + Credits Overlay']
];

function updateMegaKnightTimeline(t) {
  let mkWorldX = 2.25, mkWorldY = 0.0, mkWorldZ = 7.5, mkYaw = Math.PI + 0.26;

  if (t === null) {
    megaKnight.resetPose();
    WORLD_MK = mul(T(mkWorldX, mkWorldY, mkWorldZ), mul(RY(mkYaw), S(0.74, 0.74, 0.74)));
    return;
  }

  if (t < 12) {
    // Scene 1: Di luar pandangan kamera sesuai laporan
    megaKnight.resetPose();
    mkWorldY = -100;
  } else if (t < 25) {
    // Scene 2: Melangkah & Melompat Parabola mendarat dengan ruang lega di kanan arena
    const u = (t - 12) / 13.0;
    megaKnight.update(2, u * 4.799);
    mkWorldX = 2.25;
    mkWorldZ = 7.4;
    mkYaw = Math.PI + 0.26;
  } else if (t < 40) {
    // Scene 3: Kuda-kuda Power Up (transisi posisi halus dari Scene 2)
    const u = (t - 25) / 15.0;
    megaKnight.update(3, u * 3.999);
    mkWorldX = lp(2.25, 2.05, u);
    mkWorldZ = lp(7.4, 7.0, u);
    mkYaw = lp(Math.PI + 0.26, Math.PI + 0.30, u);
  } else if (t < 52) {
    // Scene 4: Maju menerjang ke arah Sparky dengan kurva halus lalu kembali ke kuda-kuda
    const u = (t - 40) / 12.0;
    megaKnight.update(4, u * 5.599);
    const rush = Math.sin(u * Math.PI);
    mkWorldX = 2.05 - 0.85 * rush; // Maju serong ke X = 1.20
    mkWorldZ = 7.0 - 1.55 * rush;  // Maju ke Z = 5.45 (di depan kanan Sparky tanpa menabrak P.E.K.K.A)
    mkYaw = Math.PI + 0.30 + 0.12 * rush;
  } else if (t < 62) {
    // Scene 5: Menyilangkan bola besi menahan tembakan Sparky
    const u = (t - 52) / 10.0;
    megaKnight.update(5, u * 3.799);
    mkWorldX = lp(2.05, 1.75, u);
    mkWorldZ = lp(7.0, 6.5, u);
    mkYaw = Math.PI + 0.28;
  } else if (t < 72) {
    // Scene 6: Terdorong mundur oleh gelombang kejut ledakan
    const u = (t - 62) / 10.0;
    megaKnight.update(6, u * 3.999);
    mkWorldX = lp(1.75, 2.20, u);
    mkWorldZ = lp(6.5, 7.3, u);
    mkYaw = Math.PI + 0.26;
  } else {
    // Scene 7 & 8: Victory Pose dengan jarak lega
    const u = Math.min(1, (t - 72) / 10.0);
    megaKnight.update(7, u * 3.999);
    mkWorldX = 2.20;
    mkWorldZ = 7.3;
    mkYaw = Math.PI + 0.24;
  }

  WORLD_MK = mul(T(mkWorldX, mkWorldY, mkWorldZ), mul(RY(mkYaw), S(0.74, 0.74, 0.74)));
}

// Kamera Sinematik Multi-Angle (Dominan dari arah Sungai / Tower Merah & Samping, 100% Bebas Halangan Tower!)
function updateCinematicCamera(t) {
  if (!cineCam) return;

  if (t < 12) {
    // SCENE 1: Wide pan shot dari atas sisi Merah menyeberangi sungai lalu menyorot depan-samping Sparky
    const k = t / 12;
    yaw = lp(2.45, 0.58, k);
    pitch = lp(0.55, 0.22, k);
    dist = lp(28.0, 6.8, k); // Jarak dekat (6.8) sehingga berada di depan menara, tidak terhalang!
    target = [0, lp(1.5, 1.1, k), lp(1.5, 3.0, k)];
  } else if (t < 25) {
    // SCENE 2: Kamera dari arah Sungai / Belakang-Samping Sparky (Sisi Merah, yaw ~ 2.75 -> 3.45)
    // Menyorot WAJAH DEPAN Mega Knight (lompat parabola) & P.E.K.K.A (jalan masuk) secara utuh tanpa halangan!
    const k = (t - 12) / 13;
    yaw = lp(2.72, 3.48, k);
    pitch = lp(0.20, 0.24, k);
    dist = lp(10.5, 11.2, k);
    target = [0, 1.75, 6.0];
  } else if (t < 40) {
    // SCENE 3: Orbit dari depan moncong Sparky (melihat kumparan & bola energi membesar)
    // lalu berputar ke arah depan Mega Knight & P.E.K.K.A yang bersiap menahan serangan
    const k = (t - 25) / 15;
    if (k < 0.52) {
      const u = k / 0.52;
      yaw = lp(0.48, -0.52, u);
      pitch = lp(0.22, 0.20, u);
      dist = lp(6.6, 6.4, u); // Tetap di dalam lapangan terbuka di depan menara biru
      target = [0, 1.25, 3.2];
    } else {
      const u = (k - 0.52) / 0.48;
      yaw = lp(2.25, 2.85, u); // Pindah ke perspektif arah Sparky menyorot depan Mega Knight & P.E.K.K.A
      pitch = lp(0.20, 0.22, u);
      dist = lp(9.2, 9.8, u);
      target = [0.2, 1.75, 6.2];
    }
  } else if (t < 52) {
    // SCENE 4: Sudut Samping-Depan Terbuka (Dari arah Jembatan Kanan/Sungai, yaw ~ 2.35 -> 3.85)
    // Memperlihatkan jelas pukulan kombo diagonal Kanan-Kiri Mega Knight & tebasan P.E.K.K.A ke arah Sparky
    const k = (t - 40) / 12;
    yaw = lp(2.35, 3.85, k);
    pitch = lp(0.20, 0.25, k);
    dist = lp(9.2, 9.6, k);
    target = [0.15, 1.65, 5.2];
  } else if (t < 62) {
    // SCENE 5: Over-the-Shoulder dari Sisi Merah/Sparky (yaw ~ 2.50 -> 2.15)
    // Melihat langsung hentakan Recoil 42° Sparky dan bola energi melesat ditebas P.E.K.K.A & ditahan Mega Knight
    const k = (t - 52) / 10;
    yaw = lp(2.55, 2.12, k);
    pitch = lp(0.24, 0.22, k);
    dist = lp(9.8, 9.2, k);
    target = [0, 1.55, 4.8];
  } else if (t < 72) {
    // SCENE 6: Push-in ke Bola Energi yang Meledak lalu mundur saat Gelombang Kejut (Shockwave)
    const k = (t - 62) / 10;
    yaw = lp(2.12, 2.85, k);
    pitch = lp(0.22, 0.30, k);
    dist = lp(8.2, 12.8, k);
    target = [0, 1.65, 5.2];
  } else {
    // SCENE 7 & 8: Slow Pull-Back dari Arah Sungai / Sisi Merah (yaw ~ 2.85 -> 3.14)
    // Menyorot wajah depan ketiga karakter saat melakukan Victory Pose dengan latar megah Istana Biru di belakang
    const k = Math.min(1, (t - 72) / 12);
    yaw = lp(2.85, 3.14, k);
    pitch = lp(0.22, 0.36, k);
    dist = lp(10.5, 18.5, k);
    target = [0, 1.85, 5.5];
  }
}

window.playRange = (start, end, activeBtnId) => {
  TL = start;
  endAt = end;
  playing = true;
  document.querySelectorAll('.sbtn').forEach(b => b.classList.remove('active'));
  if (activeBtnId) document.getElementById(activeBtnId)?.classList.add('active');
};

window.togglePlay = () => {
  playing = !playing;
  if (playing && TL >= endAt) TL = 0;
};

window.scrubTimeline = (val) => {
  TL = parseFloat(val);
};

window.toggleCineCam = () => {
  cineCam = !cineCam;
  const btn = document.getElementById('btn_cine');
  if (btn) {
    btn.textContent = cineCam ? '🎥 Kamera Sinematik: ON' : '🕹️ Kamera Manual: ON';
    btn.classList.toggle('active', cineCam);
  }
};

// Tombol Fokus Karakter diatur menghadap WAJAH DEPAN masing-masing karakter tanpa terhalang menara
window.focusChar = (who) => {
  cineCam = false;
  const btn = document.getElementById('btn_cine');
  if (btn) { btn.textContent = '🕹️ Kamera Manual: ON'; btn.classList.remove('active'); }
  if (who === 'arena') { target = [0, 1.5, 2.0]; yaw = 2.55; pitch = 0.55; dist = 48.0; }
  if (who === 'mk')    { target = [ 2.15, 1.8, 7.2]; yaw = 2.85; pitch = 0.16; dist = 6.2; }
  if (who === 'pekka') { target = [-2.15, 1.8, 7.2]; yaw = 3.40; pitch = 0.16; dist = 6.2; }
  if (who === 'sparky'){ target = [ 0.0,  1.1, 3.2]; yaw = 0.45; pitch = 0.25; dist = 5.6; }
};

window.resetStatic = () => {
  playing = false;
  TL = 20;
  updateMegaKnightTimeline(null);
  pekka.updateTimeline(null);
  sparky.updateTimeline(null);
  document.getElementById('flashOverlay').style.opacity = 0;
  document.getElementById('creditsOverlay').style.opacity = 0;
  document.getElementById('hudScene').textContent = 'Pose Statis (Inspeksi Karakter & Arena)';
  document.getElementById('hudRubric').textContent = 'Klik tombol Fokus Karakter di atas untuk zoom ke depan masing-masing objek';
};

cv.onmousedown = e => { drag = true; lx = e.clientX; ly = e.clientY; };
window.onmouseup = () => drag = false;
window.onmousemove = e => {
  if (!drag) return;
  cineCam = false;
  const btn = document.getElementById('btn_cine');
  if (btn) { btn.textContent = '🕹️ Kamera Manual: ON'; btn.classList.remove('active'); }
  yaw -= (e.clientX - lx) * 0.007;
  pitch = Math.max(0.05, Math.min(1.48, pitch + (e.clientY - ly) * 0.007));
  lx = e.clientX; ly = e.clientY;
};
cv.onwheel = e => {
  e.preventDefault();
  dist = Math.max(3.0, Math.min(140, dist * (1 + Math.sign(e.deltaY) * 0.08)));
};

let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (playing) {
    TL += dt;
    if (TL >= endAt) {
      TL = endAt;
      playing = false;
    }
  }

  let flash = 0;
  if (playing || TL > 0) {
    updateMegaKnightTimeline(TL);
    pekka.updateTimeline(TL);
    flash = sparky.updateTimeline(TL);
    updateCinematicCamera(TL);

    const slider = document.getElementById('tlSlider');
    if (slider) slider.value = TL;
    const timeLabel = document.getElementById('tlTime');
    if (timeLabel) timeLabel.textContent = `${TL.toFixed(1)}s / 90.0s`;

    for (const [s0, s1, title, rub] of SCENE_INFO) {
      if (TL >= s0 && TL <= s1) {
        document.getElementById('hudScene').textContent = title;
        document.getElementById('hudRubric').textContent = rub;
        break;
      }
    }
  }

  document.getElementById('flashOverlay').style.opacity = flash;
  const creditsOpacity = TL >= 82 ? smooth((TL - 82) / 2.5) : 0;
  document.getElementById('creditsOverlay').style.opacity = creditsOpacity;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = (cv.clientWidth * dpr) | 0, h = (cv.clientHeight * dpr) | 0;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }

  const eye = [
    target[0] + dist * Math.cos(pitch) * Math.sin(yaw),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * Math.cos(pitch) * Math.cos(yaw)
  ];
  const VP = mul(persp(0.60, w / h, 0.2, 450), lookAt(eye, target, [0, 1, 0]));

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.1, 0.2, 0.4, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // 1. Render Environment Arena Clash Royale
  arena.render(VP, eye, now / 1000, w, h);

  // 2. Render P.E.K.K.A (Valent)
  pekka.render(VP, eye, now / 1000, WORLD_PEKKA);

  // 3. Render Sparky (Axel)
  sparky.render(VP, eye, WORLD_SPARKY);

  // 4. Render Mega Knight (Allan)
  gl.bindVertexArray(null);
  gl.useProgram(mkProg);
  gl.uniform3fv(loc.uEye, eye);
  gl.uniformMatrix4fv(loc.uVP, false, VP);
  drawMKNode(megaKnight.root, WORLD_MK);
  gl.disableVertexAttribArray(loc.aP);
  gl.disableVertexAttribArray(loc.aN);
  gl.disableVertexAttribArray(loc.aC);

  requestAnimationFrame(frame);
}

playRange(0, 90, 'btn_all');
requestAnimationFrame(frame);