/*
 * Projek UTS Grafika Komputer - Sparky
 */

function main() {
    var cv = document.getElementById('mycanvas') || document.getElementById('c');
    var gl = cv.getContext('webgl', { antialias: true });

    if (!gl) {
        alert("Browser tidak mendukung WebGL!");
        return;
    }

    /* ================= 1. Matematika Transformasi ================= */
    var M4 = {
        mul: function (a, b) {
            return LIBS.multiply(a, b);
        },
        T: function (x, y, z) {
            var m = LIBS.get_I4();
            LIBS.translateX(m, x);
            LIBS.translateY(m, y);
            LIBS.translateZ(m, z);
            return new Float32Array(m);
        },
        S: function (x, y, z) {
            var m = LIBS.get_I4();
            LIBS.scale(m, x, y, z);
            return new Float32Array(m);
        },
        Rx: function (a) {
            var m = LIBS.get_I4();
            LIBS.rotateX(m, a);
            return new Float32Array(m);
        },
        Ry: function (a) {
            var m = LIBS.get_I4();
            LIBS.rotateY(m, a);
            return new Float32Array(m);
        },
        Rz: function (a) {
            var m = LIBS.get_I4();
            LIBS.rotateZ(m, a);
            return new Float32Array(m);
        },
        // Rumus Rodrigues: Rotasi pada Sumbu Sembarang (Arbitrary Axis)
        rotAxis: function (u, angle) {
            var l = Math.hypot(u[0], u[1], u[2]) || 1.0;
            var ux = u[0] / l, uy = u[1] / l, uz = u[2] / l;
            var c = Math.cos(angle), s = Math.sin(angle), t = 1.0 - c;
            return new Float32Array([
                t * ux * ux + c,        t * ux * uy + s * uz,   t * ux * uz - s * uy,   0,
                t * ux * uy - s * uz,   t * uy * uy + c,        t * uy * uz + s * ux,   0,
                t * ux * uz + s * uy,   t * uy * uz - s * ux,   t * uz * uz + c,        0,
                0,                      0,                      0,                      1
            ]);
        },
        persp: function (f, a, n, fa) {
            var t = 1.0 / Math.tan(f / 2.0);
            var o = new Float32Array(16);
            o[0] = t / a;
            o[5] = t;
            o[10] = (fa + n) / (n - fa);
            o[11] = -1.0;
            o[14] = (2.0 * fa * n) / (n - fa);
            return o;
        },
        look: function (e, c, u) {
            var z = nz(sub(e, c)), x = nz(cr(u, z)), y = cr(z, x);
            return new Float32Array([
                x[0], y[0], z[0], 0,
                x[1], y[1], z[1], 0,
                x[2], y[2], z[2], 0,
                -dot(x, e), -dot(y, e), -dot(z, e), 1
            ]);
        }
    };

    var mm = function () {
        var res = arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            res = M4.mul(res, arguments[i]);
        }
        return res;
    };

    var T = M4.T, Sc = M4.S, Rx = M4.Rx, Ry = M4.Ry, Rz = M4.Rz, rotAxis = M4.rotAxis;

    function sub(a, b) { return a.map(function (x, i) { return x - b[i]; }); }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cr(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function nz(a) { var l = Math.hypot.apply(Math, a) || 1.0; return a.map(function (x) { return x / l; }); }
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

    // Matriks Normal 3x3 (Inverse-Transpose)
    function nm(M) {
        var a = function (r, c) { return M[c * 4 + r]; };
        var C = [
            [a(1, 1) * a(2, 2) - a(1, 2) * a(2, 1), -(a(1, 0) * a(2, 2) - a(1, 2) * a(2, 0)), a(1, 0) * a(2, 1) - a(1, 1) * a(2, 0)],
            [-(a(0, 1) * a(2, 2) - a(0, 2) * a(2, 1)), a(0, 0) * a(2, 2) - a(0, 2) * a(2, 0), -(a(0, 0) * a(2, 1) - a(0, 1) * a(2, 0))],
            [a(0, 1) * a(1, 2) - a(0, 2) * a(1, 1), -(a(0, 0) * a(1, 2) - a(0, 2) * a(1, 0)), a(0, 0) * a(1, 1) - a(0, 1) * a(1, 0)]
        ];
        var o = new Float32Array(9);
        for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
                o[c * 3 + r] = C[r][c];
            }
        }
        return o;
    }

    /* ================= 2. Shaders ================= */
    var VS = `attribute vec3 aP, aN;
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

    var FS = `precision mediump float;
varying vec3 vN, vW, vL;
uniform vec4 uC;
uniform vec3 uE, uEye, uSparkyPos;
uniform vec2 uS;
uniform float uMode;
void main() {
    vec3 c = uC.rgb;
    vec3 N = normalize(vN);
    vec3 V = normalize(uEye - vW);

    // Two-sided normal agar tidak ada bidang bolong
    if (dot(N, V) < 0.0) N = -N;

    // Mode 4: pendar energi (terang di tengah, memudar ke tepi)
    if (uMode >= 3.5) {
        float glow = pow(clamp(dot(N, V), 0.0, 1.0), uS.x);
        gl_FragColor = vec4(c, uC.a * glow);
        return;
    }

    if (uMode >= 3.0) {
        gl_FragColor = vec4(c + uE, uC.a);
        return;
    }
    // Mode 2: alas arena (ubin batu, cincin emas, bayangan di bawah Sparky)
    if (uMode >= 1.5 && uMode < 2.5) {
        vec2 p = vW.xz;
        vec2 tile = floor(p * 0.5);
        float check = mod(tile.x + tile.y, 2.0);
        vec2 g = abs(fract(p * 0.5) - 0.5);
        float border = step(0.46, max(g.x, g.y));
        vec3 tileCol = mix(vec3(0.53, 0.56, 0.59), vec3(0.46, 0.49, 0.52), check * 0.5);
        tileCol = mix(tileCol, vec3(0.29, 0.31, 0.33), border * 0.65);
        float dc = length(p);
        float rings = smoothstep(0.14, 0.0, abs(dc - 6.0)) * 0.75 + smoothstep(0.18, 0.0, abs(dc - 14.0)) * 0.55 + smoothstep(0.28, 0.0, abs(dc - 25.0)) * 0.85;
        tileCol = mix(tileCol, vec3(0.92, 0.78, 0.22), clamp(rings, 0.0, 1.0));
        float sh = smoothstep(0.2, 1.6, length((p - uSparkyPos.xz) * vec2(1.1, 0.85)));
        tileCol *= mix(0.42, 1.0, sh);
        vec3 fcol = tileCol * 0.9;
        float ff = clamp((length(uEye - vW) - 25.0) / 45.0, 0.0, 1.0);
        fcol = mix(fcol, vec3(0.75, 0.78, 0.82), ff);
        gl_FragColor = vec4(fcol, 1.0);
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

    float f = clamp((length(uEye - vW) - 25.0) / 45.0, 0.0, 1.0);
    col = mix(col, vec3(0.75, 0.78, 0.82), f);

    gl_FragColor = vec4(col, uC.a);
}`;

    function compileShader(type, src) {
        var o = gl.createShader(type);
        gl.shaderSource(o, src);
        gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(o));
        }
        return o;
    }

    var pr = gl.createProgram();
    gl.attachShader(pr, compileShader(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, compileShader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    gl.useProgram(pr);

    var aP = gl.getAttribLocation(pr, 'aP');
    var aN = gl.getAttribLocation(pr, 'aN');
    var u = {};
    ['uM', 'uVP', 'uNM', 'uC', 'uE', 'uEye', 'uS', 'uMode', 'uSparkyPos'].forEach(function (n) {
        u[n] = gl.getUniformLocation(pr, n);
    });
    gl.enableVertexAttribArray(aP);
    gl.enableVertexAttribArray(aN);

    /* ================= 3. Pembuat Geometri Asli (100% Padat Tanpa Celah) ================= */
    function mk(v, ix) {
        var vb = gl.createBuffer(), ib = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vb);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ix), gl.STATIC_DRAW);
        return { vb: vb, ib: ib, n: ix.length };
    }

    function grid(v, ix, nu, nv, base) {
        for (var i = 0; i < nu; i++) {
            for (var j = 0; j < nv; j++) {
                var k = base + i * (nv + 1) + j;
                ix.push(k, k + 1, k + nv + 1, k + 1, k + nv + 2, k + nv + 1);
            }
        }
    }

    // Box dengan sudut dihaluskan
    function rbox(r, N) {
        if (!N) N = 14;
        var v = [], ix = [];
        for (var a = 0; a < 3; a++) {
            for (var sgi = 0; sgi < 2; sgi++) {
                var sg = (sgi === 0) ? -1 : 1;
                var b = (a + 1) % 3, c = (a + 2) % 3, base = v.length / 6;
                for (var i = 0; i <= N; i++) {
                    for (var j = 0; j <= N; j++) {
                        var p = [0, 0, 0];
                        p[a] = sg;
                        p[b] = -1 + 2 * i / N;
                        p[c] = -1 + 2 * j / N;
                        var q = p.map(function (x) { return clamp(x, -(1 - r), 1 - r); });
                        var d = p.map(function (x, k) { return x - q[k]; });
                        var l = Math.hypot(d[0], d[1], d[2]) || 1;
                        var n = d.map(function (x) { return x / l; });
                        v.push(q[0] + n[0] * r, q[1] + n[1] * r, q[2] + n[2] * r, n[0], n[1], n[2]);
                    }
                }
                grid(v, ix, N, N, base);
            }
        }
        return mk(v, ix);
    }

    // Quadric 1: Ellipsoid / Sphere
    function sph(la, lo) {
        if (!la) la = 20;
        if (!lo) lo = 28;
        var v = [], ix = [];
        for (var i = 0; i <= la; i++) {
            for (var j = 0; j <= lo; j++) {
                var th = Math.PI * i / la, ph = 2 * Math.PI * j / lo;
                var n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
                v.push(n[0], n[1], n[2], n[0], n[1], n[2]);
            }
        }
        grid(v, ix, la, lo, 0);
        return mk(v, ix);
    }

    // Quadric 2 & 3: Silinder / Kerucut / Kerucut Terpotong
    function cyl(rt, rb, sg) {
        if (!sg) sg = 28;
        var v = [], ix = [], sl = (rb - rt) / 2.0, nl = Math.hypot(1.0, sl);
        for (var i = 0; i <= sg; i++) {
            var a = 2 * Math.PI * i / sg, c = Math.cos(a), s = Math.sin(a);
            var n = [c / nl, sl / nl, s / nl];
            v.push(c * rt, 1, s * rt, n[0], n[1], n[2]);
            v.push(c * rb, -1, s * rb, n[0], n[1], n[2]);
        }
        for (var i = 0; i < sg; i++) {
            var k = 2 * i;
            ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
        var caps = [[1, rt, 1], [-1, rb, -1]];
        for (var ci = 0; ci < caps.length; ci++) {
            var y = caps[ci][0], r = caps[ci][1], ny = caps[ci][2];
            if (!r) continue;
            var base = v.length / 6;
            v.push(0, y, 0, 0, ny, 0);
            for (var i = 0; i <= sg; i++) {
                var a = 2 * Math.PI * i / sg;
                v.push(Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0);
            }
            for (var i = 0; i < sg; i++) {
                ix.push(base, base + 1 + i, base + 2 + i);
            }
        }
        return mk(v, ix);
    }

    // Torus (Cincin Donat)
    function tor(ratio, nu, nv) {
        if (!ratio) ratio = 0.20;
        if (!nu) nu = 40;
        if (!nv) nv = 20;
        var v = [], ix = [];
        for (var i = 0; i <= nu; i++) {
            for (var j = 0; j <= nv; j++) {
                var uA = 2 * Math.PI * i / nu, wA = 2 * Math.PI * j / nv;
                var cu = Math.cos(uA), su = Math.sin(uA), cw = Math.cos(wA), sw = Math.sin(wA);
                v.push((1 + ratio * cw) * cu, (1 + ratio * cw) * su, ratio * sw, cw * cu, cw * su, sw);
            }
        }
        grid(v, ix, nu, nv, 0);
        return mk(v, ix);
    }

    // Pelat Oktagonal Chamfer
    function chamPlate(w, h, c, th) {
        var v = [], ix = [], ht = th / 2;
        var P = [[-w + c, h], [w - c, h], [w, h - c], [w, -h + c], [w - c, -h], [-w + c, -h], [-w, -h + c], [-w, h - c]];
        var bf = v.length / 6;
        v.push(0, 0, ht, 0, 0, 1);
        for (var i = 0; i < 8; i++) v.push(P[i][0], P[i][1], ht, 0, 0, 1);
        for (var i = 0; i < 8; i++) ix.push(bf, bf + 1 + i, bf + 1 + (i + 1) % 8);

        var bb = v.length / 6;
        v.push(0, 0, -ht, 0, 0, -1);
        for (var i = 0; i < 8; i++) v.push(P[i][0], P[i][1], -ht, 0, 0, -1);
        for (var i = 0; i < 8; i++) ix.push(bb, bb + 1 + (i + 1) % 8, bb + 1 + i);

        for (var i = 0; i < 8; i++) {
            var p1 = P[i], p2 = P[(i + 1) % 8];
            var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
            var l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;
            var s = v.length / 6;
            v.push(p1[0], p1[1], -ht, nx, ny, 0, p2[0], p2[1], -ht, nx, ny, 0, p2[0], p2[1], ht, nx, ny, 0, p1[0], p1[1], ht, nx, ny, 0);
            ix.push(s, s + 1, s + 2, s, s + 2, s + 3);
        }
        return mk(v, ix);
    }

    // Piramida Besi Duri 4 Sisi (Cone Tajam)
    function pyrFlat(w, h, len) {
        var v = [], ix = [], apex = [0, 0, len], C = [[w, h, 0], [-w, h, 0], [-w, -h, 0], [w, -h, 0]];
        for (var i = 0; i < 4; i++) {
            var p1 = C[i], p2 = C[(i + 1) % 4], d1 = sub(p1, apex), d2 = sub(p2, apex), n = nz(cr(d1, d2)), b = v.length / 6;
            v.push(apex[0], apex[1], apex[2], n[0], n[1], n[2], p1[0], p1[1], p1[2], n[0], n[1], n[2], p2[0], p2[1], p2[2], n[0], n[1], n[2]);
            ix.push(b, b + 1, b + 2);
        }
        var bBase = v.length / 6, nb = [0, 0, -1];
        v.push(C[0][0], C[0][1], C[0][2], nb[0], nb[1], nb[2],
            C[3][0], C[3][1], C[3][2], nb[0], nb[1], nb[2],
            C[2][0], C[2][1], C[2][2], nb[0], nb[1], nb[2],
            C[1][0], C[1][1], C[1][2], nb[0], nb[1], nb[2]);
        ix.push(bBase, bBase + 1, bBase + 2, bBase, bBase + 2, bBase + 3);
        return mk(v, ix);
    }

    // Sayap Samping Pelat Trapesium Depan
    function trapPlate(yTF, yTB, yB, zF, zB, th) {
        var v = [], ix = [], ht = th / 2, C = [[yTF, zF], [yTB, zB], [yB, zB], [yB, zF]];
        var b0 = v.length / 6; for (var i = 0; i < 4; i++) v.push(ht, C[i][0], C[i][1], 1, 0, 0); ix.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
        var b1 = v.length / 6; for (var i = 0; i < 4; i++) v.push(-ht, C[i][0], C[i][1], -1, 0, 0); ix.push(b1, b1 + 2, b1 + 1, b1, b1 + 3, b1 + 2);
        for (var i = 0; i < 4; i++) {
            var c1 = C[i], c2 = C[(i + 1) % 4], dy = c2[0] - c1[0], dz = c2[1] - c1[1], l = Math.hypot(dy, dz) || 1, ny = -dz / l, nz = dy / l, b = v.length / 6;
            v.push(ht, c1[0], c1[1], 0, ny, nz, -ht, c1[0], c1[1], 0, ny, nz, -ht, c2[0], c2[1], 0, ny, nz, ht, c2[0], c2[1], 0, ny, nz);
            ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        return mk(v, ix);
    }

    // Kurva 3D Bézier Bumper Depan
    var BP = [[-.62, 0], [-.18, .22], [.18, .22], [.62, 0]];
    function bz(t) {
        var uA = 1 - t, wA = [uA * uA * uA, 3 * uA * uA * t, 3 * uA * t * t, t * t * t], d = [3 * uA * uA, 6 * uA * t, 3 * t * t];
        var x = 0, z = 0, dx = 0, dz = 0;
        for (var i = 0; i < 4; i++) { x += BP[i][0] * wA[i]; z += BP[i][1] * wA[i]; }
        for (var i = 0; i < 3; i++) { dx += (BP[i + 1][0] - BP[i][0]) * d[i]; dz += (BP[i + 1][1] - BP[i][1]) * d[i]; }
        var l = Math.hypot(dx, dz) || 1;
        return { x: x, z: z, nx: -dz / l, nz: dx / l };
    }

    function bzBumper(hyTop, hyBotFlat, vDrop, h, S) {
        if (!S) S = 24;
        var v = [], ix = [];
        function getHy(t) { return { top: hyTop, bot: hyBotFlat - vDrop * (1 - 2 * Math.abs(t - .5)) }; }
        var F = [
            function (p, t) { var y = getHy(t); return [[p.x + p.nx * h, y.bot, p.z + p.nz * h], [p.x + p.nx * h, y.top, p.z + p.nz * h], [p.nx, 0, p.nz]]; },
            function (p, t) { var y = getHy(t); return [[p.x - p.nx * h, y.bot, p.z - p.nz * h], [p.x - p.nx * h, y.top, p.z - p.nz * h], [-p.nx, 0, -p.nz]]; },
            function (p, t) { var y = getHy(t); return [[p.x - p.nx * h, y.top, p.z - p.nz * h], [p.x + p.nx * h, y.top, p.z + p.nz * h], [0, 1, 0]]; },
            function (p, t) { var y = getHy(t); return [[p.x - p.nx * h, y.bot, p.z - p.nz * h], [p.x + p.nx * h, y.bot, p.z + p.nz * h], [0, -1, 0]]; }
        ];
        for (var fi = 0; fi < F.length; fi++) {
            var f = F[fi];
            var b = v.length / 6;
            for (var i = 0; i <= S; i++) {
                var t = i / S, res = f(bz(t), t), A = res[0], B = res[1], n = res[2];
                v.push(A[0], A[1], A[2], n[0], n[1], n[2], B[0], B[1], B[2], n[0], n[1], n[2]);
            }
            for (var i = 0; i < S; i++) { var k = b + 2 * i; ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
        }
        for (var cpi = 0; cpi < 2; cpi++) {
            var t = (cpi === 0) ? 0 : 1, sign = (cpi === 0) ? -1 : 1;
            var p = bz(t), y = getHy(t), b = v.length / 6;
            v.push(p.x - p.nx * h, y.bot, p.z - p.nz * h, sign, 0, 0,
                p.x + p.nx * h, y.bot, p.z + p.nz * h, sign, 0, 0,
                p.x + p.nx * h, y.top, p.z + p.nz * h, sign, 0, 0,
                p.x - p.nx * h, y.top, p.z - p.nz * h, sign, 0, 0);
            ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        return mk(v, ix);
    }

    // Bumper Belakang Chevron Besar
    function mkRearBumper() {
        var v = [], ix = [], th = 0.04;
        function zb(x) { return -0.88 - 0.06 * (1 - Math.abs(x) / 0.62); }
        var P_L = [[-0.62, 1.06], [-0.32, 1.06], [-0.32, 0.90], [0.00, 0.90], [0.00, 0.22], [-0.32, 0.27], [-0.62, 0.32]];
        var P_R = [[0.62, 1.06], [0.32, 1.06], [0.32, 0.90], [0.00, 0.90], [0.00, 0.22], [0.32, 0.27], [0.62, 0.32]];
        var nl_b = nz([-0.0968, 0, -1]), nr_b = nz([0.0968, 0, -1]);
        var nl_f = nz([0.0968, 0, 1]), nr_f = nz([-0.0968, 0, 1]);

        function addQuad(p0, p1, p2, p3, n) {
            var b = v.length / 6, d1 = sub(p1, p0), d2 = sub(p2, p0);
            var gn = nz(cr(d1, d2));
            if (n && dot(gn, n) < 0) {
                v.push(p0[0], p0[1], p0[2], n[0], n[1], n[2],
                    p3[0], p3[1], p3[2], n[0], n[1], n[2],
                    p2[0], p2[1], p2[2], n[0], n[1], n[2],
                    p1[0], p1[1], p1[2], n[0], n[1], n[2]);
            } else {
                var fn = n || gn;
                v.push(p0[0], p0[1], p0[2], fn[0], fn[1], fn[2],
                    p1[0], p1[1], p1[2], fn[0], fn[1], fn[2],
                    p2[0], p2[1], p2[2], fn[0], fn[1], fn[2],
                    p3[0], p3[1], p3[2], fn[0], fn[1], fn[2]);
            }
            ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }

        var pL_b = P_L.map(function (pt) { return [pt[0], pt[1], zb(pt[0])]; });
        var bLb = v.length / 6;
        for (var i = 0; i < pL_b.length; i++) v.push(pL_b[i][0], pL_b[i][1], pL_b[i][2], nl_b[0], nl_b[1], nl_b[2]);
        ix.push(bLb + 0, bLb + 1, bLb + 2, bLb + 0, bLb + 2, bLb + 6, bLb + 6, bLb + 2, bLb + 5, bLb + 2, bLb + 3, bLb + 4, bLb + 2, bLb + 4, bLb + 5);

        var pR_b = P_R.map(function (pt) { return [pt[0], pt[1], zb(pt[0])]; });
        var bRb = v.length / 6;
        for (var i = 0; i < pR_b.length; i++) v.push(pR_b[i][0], pR_b[i][1], pR_b[i][2], nr_b[0], nr_b[1], nr_b[2]);
        ix.push(bRb + 1, bRb + 0, bRb + 2, bRb + 2, bRb + 0, bRb + 6, bRb + 2, bRb + 6, bRb + 5, bRb + 3, bRb + 2, bRb + 4, bRb + 2, bRb + 5, bRb + 4);

        var pL_f = P_L.map(function (pt) { return [pt[0], pt[1], zb(pt[0]) + th]; });
        var bLf = v.length / 6;
        for (var i = 0; i < pL_f.length; i++) v.push(pL_f[i][0], pL_f[i][1], pL_f[i][2], nl_f[0], nl_f[1], nl_f[2]);
        ix.push(bLf + 2, bLf + 1, bLf + 0, bLf + 6, bLf + 2, bLf + 0, bLf + 5, bLf + 2, bLf + 6, bLf + 4, bLf + 3, bLf + 2, bLf + 5, bLf + 4, bLf + 2);

        var pR_f = P_R.map(function (pt) { return [pt[0], pt[1], zb(pt[0]) + th]; });
        var bRf = v.length / 6;
        for (var i = 0; i < pR_f.length; i++) v.push(pR_f[i][0], pR_f[i][1], pR_f[i][2], nr_f[0], nr_f[1], nr_f[2]);
        ix.push(bRf + 2, bRf + 0, bRf + 1, bRf + 6, bRf + 0, bRf + 2, bRf + 5, bRf + 6, bRf + 2, bRf + 4, bRf + 2, bRf + 3, bRf + 4, bRf + 5, bRf + 2);

        addQuad(pL_b[0], pL_b[1], pL_f[1], pL_f[0], [0, 1, 0]);
        addQuad(pL_b[1], pL_b[2], pL_f[2], pL_f[1], [1, 0, 0]);
        addQuad(pL_b[2], pL_b[3], pL_f[3], pL_f[2], [0, 1, 0]);
        addQuad(pR_b[3], pR_b[2], pR_f[2], pR_f[3], [0, 1, 0]);
        addQuad(pR_b[2], pR_b[1], pR_f[1], pR_f[2], [-1, 0, 0]);
        addQuad(pR_b[1], pR_b[0], pR_f[0], pR_f[1], [0, 1, 0]);

        addQuad(pL_b[6], pL_b[5], pL_f[5], pL_f[6], [0, -1, 0]);
        addQuad(pL_b[5], pL_b[4], pL_f[4], pL_f[5], [0, -1, 0]);
        addQuad(pR_b[4], pR_b[5], pR_f[5], pR_f[4], [0, -1, 0]);
        addQuad(pR_b[5], pR_b[6], pR_f[6], pR_f[5], [0, -1, 0]);

        return mk(v, ix);
    }

    // Sayap Samping Bumper Belakang
    function mkRearSideWing() {
        var v = [], ix = [], th = 0.035, ht = th / 2;
        var C = [[1.06, -0.86], [1.06, -0.74], [0.78, -0.74], [0.78, -0.62], [0.32, -0.62], [0.32, -0.86]];
        var C_mid = [0.32, -0.74];

        var b0 = v.length / 6;
        var pts0 = [C[0], C[1], C_mid, C[5], C[2], C[3], C[4]];
        for (var i = 0; i < pts0.length; i++) v.push(ht, pts0[i][0], pts0[i][1], 1, 0, 0);
        ix.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3, b0 + 4, b0 + 5, b0 + 6, b0 + 4, b0 + 6, b0 + 2);

        var b1 = v.length / 6;
        for (var i = 0; i < pts0.length; i++) v.push(-ht, pts0[i][0], pts0[i][1], -1, 0, 0);
        ix.push(b1, b1 + 2, b1 + 1, b1, b1 + 3, b1 + 2, b1 + 4, b1 + 6, b1 + 5, b1 + 4, b1 + 2, b1 + 6);

        for (var i = 0; i < 6; i++) {
            var p1 = C[i], p2 = C[(i + 1) % 6], dy = p2[0] - p1[0], dz = p2[1] - p1[1], l = Math.hypot(dy, dz) || 1, ny = -dz / l, nz = dy / l, s = v.length / 6;
            v.push(ht, p1[0], p1[1], 0, ny, nz, -ht, p1[0], p1[1], 0, ny, nz, -ht, p2[0], p2[1], 0, ny, nz, ht, p2[0], p2[1], 0, ny, nz);
            ix.push(s, s + 1, s + 2, s, s + 2, s + 3);
        }
        return mk(v, ix);
    }

    // Alas / lantai arena
    function mkFloor(size, N) {
        var v = [], ix = [], st = (size * 2) / N;
        for (var i = 0; i <= N; i++) {
            for (var j = 0; j <= N; j++) {
                v.push(-size + j * st, 0, -size + i * st, 0, 1, 0);
            }
        }
        for (var i = 0; i < N; i++) {
            for (var j = 0; j < N; j++) {
                var k = i * (N + 1) + j;
                ix.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
            }
        }
        return mk(v, ix);
    }

    /* Kumpulan Geometri */
    var G = {
        floor: mkFloor(50, 40),
        arc: cyl(1, 1, 6),
        chas: rbox(.08),
        plate: chamPlate(.54, .48, .16, .09),
        coil: rbox(.25),
        rbox: rbox(.08),
        sph: sph(),
        wheel: cyl(1, 1, 12),
        cyl: cyl(1, 1),
        cone: cyl(0, 1, 16),
        pyr: pyrFlat(.075, .075, .24),
        trunc: cyl(.45, 1),
        ring: tor(.20),
        bf: bzBumper(.86, .32, .14, .045),
        wing: trapPlate(.86, .72, .32, .86, .60, .035),
        rearBumper: mkRearBumper(),
        rearWing: mkRearSideWing()
    };

    /* ================= 4. Fungsi Menggambar Objek ================= */
    function draw(m, M, c, mode, sp, e) {
        if (mode === undefined) mode = 0;
        if (!sp) sp = [40, 0.4];
        if (!e) e = [0, 0, 0];

        gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
        gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 24, 12);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);

        gl.uniformMatrix4fv(u.uM, false, M);
        gl.uniformMatrix3fv(u.uNM, false, nm(M));
        gl.uniform4fv(u.uC, c.length === 3 ? [c[0], c[1], c[2], 1.0] : c);
        gl.uniform1f(u.uMode, mode);
        gl.uniform2fv(u.uS, sp);
        gl.uniform3fv(u.uE, e);
        gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
    }

    /* Warna Palet Asli */
    var wood = [.64, .43, .28],
        wood2 = [.52, .34, .21],
        woodWheel = [.56, .38, .24],
        woodHub = [.30, .22, .16],
        dark = [.2, .2, .23],
        iron = [.38, .44, .58],
        iron2 = [.32, .37, .50],
        gold = [.96, .78, .16],
        silver = [.88, .92, .98],
        ironSpike = [.24, .25, .28],
        red = [.94, .08, .08];

    /* ================= 5. Gambar Model Sparky Utuh ================= */
    /* ================= 5. Gambar Model Sparky Utuh (Hierarki Scene Graph) ================= */
    /*
     * STRUKTUR HIERARKI PARENT-CHILD MATRIKS (SCENE GRAPH):
     * - Root: Sasis Utama Sparky (body)
     *   ├── Child 1-4: Ke-4 Roda (M_wheel) -> Hierarchical Translation & Local Pitch Rotation
     *   └── Child 5: Alas Putar / Turret Base (M_turretBase) -> Rotation Y
     *         └── Child 5.1: Rumah Mesin / Coil Housing (M_machine) -> Rotate Arbitrary Axis (Rumus Rodrigues)
     *               ├── Child 5.1.1: 6 Kumparan Merah / Red Coils -> Local Scaling Tiap Coil
     *               └── Child 5.1.2: Laras Moncong Meriam / Barrel (M_barrel)
     *                     └── Child 5.1.2.1: Bola Energi Kuning (M_energyBall) -> Hierarchical Scaling & Translation
     */
    function drawSparky(px, pz, ry, lAng, rAng, pitch, roll, bob, turretRotY, recoilMat, coilScales, energyBallMat, headScale) {
        px = px || 0; pz = pz || 0; ry = ry || 0; lAng = lAng || 0; rAng = rAng || 0;
        pitch = pitch || 0; roll = roll || 0; bob = bob || 0;
        turretRotY = turretRotY || 0;
        recoilMat = recoilMat || LIBS.get_I4();
        coilScales = coilScales || [1, 1, 1, 1, 1, 1];
        headScale = headScale || 1.0;

        // Root: Sasis Utama Sparky
        var base = mm(T(px, 0, pz), Ry(ry));
        var body = mm(base, T(0, bob, 0), Rx(pitch), Rz(roll));

        // A. BADAN KERETA (CHASSIS GELADAK KAYU TEBAL)
        draw(G.chas, mm(body, T(-.48, .50, 0), Sc(.12, .17, .86)), wood, 0, [15, .15]);
        draw(G.chas, mm(body, T(.48, .50, 0), Sc(.12, .17, .86)), wood, 0, [15, .15]);
        draw(G.chas, mm(body, T(0, .50, .66), Sc(.36, .17, .20)), wood, 0, [15, .15]);
        draw(G.chas, mm(body, T(0, .50, -.66), Sc(.36, .17, .20)), wood, 0, [15, .15]);
        draw(G.chas, mm(body, T(0, .36, 0), Sc(.36, .04, .46)), wood2, 0, [15, .15]);

        // Child 1-4: Ke-4 Roda (mengikuti translasi/rotasi sasis + rotasi poros lokal)
        var wheels = [[-1, 1], [-1, -1], [1, 1], [1, -1]];
        for (var wi = 0; wi < wheels.length; wi++) {
            var sx = wheels[wi][0], sz = wheels[wi][1];
            var wx = sx * .74, wz = sz * .44, wy = .34;
            var wAng = (sx < 0) ? lAng : rAng;
            var wm = mm(body, T(wx, wy, wz), Rx(wAng));
            draw(G.wheel, mm(wm, Rz(Math.PI / 2), Sc(.34, .11, .34)), woodWheel, 0, [15, .15]);
            draw(G.cyl, mm(wm, Rz(Math.PI / 2), Sc(.21, .12, .21)), woodHub, 0, [15, .15]);
            draw(G.cyl, mm(wm, Rz(Math.PI / 2), Sc(.06, .17, .06)), dark, 0, [60, .8]);
            draw(G.sph, mm(body, T(sx * .58, wy, wz), Sc(.07, .12, .12)), dark);
            draw(G.sph, mm(wm, T(sx * .12, 0, 0), Sc(.04, .04, .04)), silver, 0, [90, 1]);
        }

        // B. BUMPER DEPAN & 8 DURI PIRAMIDA BESI
        draw(G.bf, mm(body, T(0, 0, .86)), iron, 0, [50, .7]);
        for (var sxi = 0; sxi < 2; sxi++) {
            var sx = (sxi === 0) ? -1 : 1;
            draw(G.wing, mm(body, T(sx * .615, 0, 0)), iron, 0, [50, .7]);
        }
        var rows = [.44, .69], cols = [.16, .36, .64, .84];
        for (var ri = 0; ri < rows.length; ri++) {
            for (var ci = 0; ci < cols.length; ci++) {
                var p = bz(cols[ci]), ph = Math.atan2(p.nx, p.nz);
                var bx = p.x + p.nx * .045, bzPos = .86 + p.z + p.nz * .045;
                draw(G.cone, mm(body, T(bx, rows[ri], bzPos), Ry(ph), Rx(Math.PI / 2), Sc(.10, .13, .10), T(0, 1, 0)), ironSpike, 0, [75, 1.0]);
            }
        }

        // C. BUMPER BELAKANG CHEVRON BESAR
        draw(G.rearBumper, body, iron, 0, [50, .7]);
        for (var sxi = 0; sxi < 2; sxi++) {
            var sx = (sxi === 0) ? -1 : 1;
            draw(G.rearWing, mm(body, T(sx * .615, 0, 0)), iron, 0, [50, .7]);
            var boltY = [.52, .90];
            for (var bi = 0; bi < boltY.length; bi++) {
                draw(G.sph, mm(body, T(sx * .47, boltY[bi], -0.895), Sc(.065, .065, .065)), silver, 0, [90, 1.2]);
            }
        }

        // Child 5: Alas Putar (Turret Base) - Rotasi Sumbu Y
        var M_turretBase = mm(body, T(0, 0.43, 0), Ry(turretRotY));
        draw(G.sph, mm(M_turretBase, Sc(.32, .05, .32)), dark, 0, [40, .6]);
        draw(G.wheel, mm(M_turretBase, T(0, 0.04, 0), Sc(.28, .03, .28)), dark, 0, [40, .6]);
        draw(G.cyl, mm(M_turretBase, T(0, 0.23, 0), Sc(.11, .16, .11)), dark, 0, [50, .7]);

        // Child 5.1: Rumah Mesin / Badan Meriam (Coil Housing) - Terpasang di atas Turret Base + Recoil Rodrigues + Hierarchical Scale
        // Menggunakan pivot hinge bawah-belakang (Y=0.65, Z=-0.25) & Hierarchical Scale (headScale)
        var M_machine = mm(M_turretBase, T(0, 0.65, -0.25), recoilMat, T(0, 0.18, 0.25), Sc(headScale, headScale, headScale));

        // Pelat Depan Oktagonal & Cincin Kerah
        draw(G.plate, mm(M_machine, T(0, 0, .44)), iron, 0, [50, .7]);
        draw(G.ring, mm(M_machine, T(0, 0, .46), Sc(.22, .22, .14)), [.24, .27, .33], 0, [50, .7]);
        for (var sxi = 0; sxi < 2; sxi++) {
            for (var syi = 0; syi < 2; syi++) {
                var sx = (sxi === 0) ? -1 : 1, sy = (syi === 0) ? -1 : 1;
                draw(G.sph, mm(M_machine, T(sx * .40, sy * .34, .49), Sc(.032, .032, .032)), silver, 0, [95, 1.3]);
            }
        }

        // Pelat Belakang Oktagonal & 4 Baut
        draw(G.plate, mm(M_machine, T(0, 0, -.44)), iron2, 0, [50, .7]);
        for (var sxi = 0; sxi < 2; sxi++) {
            for (var syi = 0; syi < 2; syi++) {
                var sx = (sxi === 0) ? -1 : 1, sy = (syi === 0) ? -1 : 1;
                draw(G.sph, mm(M_machine, T(sx * .40, sy * .34, -.49), Sc(.032, .032, .032)), silver, 0, [95, 1.3]);
            }
        }

        // Balok Penghubung Atas & Bawah
        draw(G.rbox, mm(M_machine, T(0, .48, 0), Sc(.14, .045, .46)), iron, 0, [50, .7]);
        draw(G.rbox, mm(M_machine, T(0, -.48, 0), Sc(.15, .045, .46)), iron2, 0, [40, .6]);

        // Child 5.1.1: 6 Kumparan Merah / Red Coils (Scaling lokal masing-masing)
        for (var i = 0; i < 6; i++) {
            var z = -.3125 + i * .125;
            var sc = coilScales[i] || 1.0;
            var M_coil = mm(M_machine, T(0, 0, z), Sc(.49 * sc, .39 * sc, .063));
            draw(G.coil, M_coil, red, 0, [70, 1.0]);
        }

        // Child 5.1.2: Laras Moncong Meriam (Barrel)
        var M_barrel = mm(M_machine, T(0, 0, .73));
        draw(G.trunc, mm(M_barrel, Rx(Math.PI / 2), Sc(.21, .29, .21)), [.34, .39, .47], 0, [50, .7]);
        draw(G.cyl, mm(M_barrel, T(0, 0, 0.32), Rx(Math.PI / 2), Sc(.095, .035, .095)), [.23, .26, .32], 0, [60, .8]);
        draw(G.cyl, mm(M_barrel, T(0, 0, 0.355), Rx(Math.PI / 2), Sc(.080, .008, .080)), [.44, .55, .70], 0, [55, .8]);

        // 3 Cincin Energi Emas Tebal
        draw(G.ring, mm(M_barrel, T(0, 0, -0.15), Sc(.42, .42, .42)), gold, 0, [95, 1.4]);
        draw(G.ring, mm(M_barrel, T(0, 0, 0.06), Sc(.31, .31, .31)), gold, 0, [95, 1.4]);
        draw(G.ring, mm(M_barrel, T(0, 0, 0.27), Sc(.20, .20, .20)), gold, 0, [95, 1.4]);

        // Child 5.1.2.1: Bola Energi Kuning (mengikuti ujung laras saat Power Up / terpasang)
        if (energyBallMat) {
            draw(G.sph, mm(M_barrel, energyBallMat), [1.0, 0.88, 0.15], 3, [90, 1.2], [0.9, 0.75, 0.1]);
            draw(G.sph, mm(M_barrel, energyBallMat, Sc(0.68, 0.68, 0.68)), [1.0, 1.0, 0.88], 3);
        }
    }

    /* ================= 6. State Objek, Animasi Scene 1-7, & Kontrol ================= */
    var car = {
        x: 0, z: 0, rot: 0, speed: 0,
        maxSpeed: 2.8, accel: 3.2, brake: 6.0, drag: 2.5, turn: 1.15,
        lAng: 0, rAng: 0, pitch: 0, roll: 0, bob: 0, bobT: 0,
        turretRotY: 0,
        headScale: 1.0,
        recoilMat: LIBS.get_I4(),
        coilScales: [1, 1, 1, 1, 1, 1],
        attachedBallMat: null
    };

    var worldBall = {
        visible: false,
        p: [0, 1.26, 0],
        s: 0.22
    };

    var whiteFlash = 0.0;

    // Sudut pandang kamera: TIGA PEREMPAT DEPAN-SAMPING ATAS (3/4 front-side high angle)
    // cam.y = 2.50 rad (~143°), cam.p = 0.44 rad (~25° pitch dari atas), cam.d = 5.4
    var DEFAULT_CAM = { y: 2.50, p: 0.44, d: 5.4 };
    var cam = { y: DEFAULT_CAM.y, p: DEFAULT_CAM.p, d: DEFAULT_CAM.d };
    var drag = false;

    cv.onmousedown = function () { drag = true; };
    window.addEventListener('mouseup', function () { drag = false; });
    window.addEventListener('mousemove', function (e) {
        if (drag) {
            cam.y -= e.movementX * 0.006;
            cam.p = clamp(cam.p + e.movementY * 0.005, 0.08, 1.3);
        }
    });

    cv.addEventListener('wheel', function (e) {
        e.preventDefault();
        cam.d = clamp(cam.d * (1 + e.deltaY * 0.001), 2.5, 25);
    }, { passive: false });

    var keys = {};
    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space') e.preventDefault();
        keys[e.key.toLowerCase()] = true;
        if (e.key.toLowerCase() === 'r') resetSparky();
    });
    window.addEventListener('keyup', function (e) {
        keys[e.key.toLowerCase()] = false;
    });

    /* State Manager Scene */
    var anim = {
        currentScene: 0, // 0: Manual/WASD, 1-7: Scene 1-7
        timer: 0,
        playAll: false
    };

    var sceneDescriptions = {
        0: 'Mode Manual: Gunakan W A S D untuk mengemudi bebas, atau klik tombol Scene di atas.',
        1: 'Scene 1 [The Arena]: Kamera 3/4 pan shot, Sparky meluncur maju (Translasi Z), roda berputar, meriam menoleh mencari target.',
        2: 'Scene 2 [Idle / Standby]: Sparky bersiap di tengah arena, sudut pandang 3/4 depan-samping atas, getaran mesin halus.',
        3: 'Scene 3 [Power Up]: Seluruh kepala meriam berdenyut membesar (Hierarchical Scaling 1.0-1.12), bola energi proporsional (r=0.22) membesar di ujung moncong.',
        4: 'Scene 4 [Evasive Maneuver]: Sasis mundur & serong kiri menghindar, lalu kembali lurus ke depan (Rotasi Y -> 0), ke-4 roda tetap menapak.',
        5: 'Scene 5 [The Blast & Recoil]: Bola melesat lurus, sasis terdorong mundur kuat (Translasi -Z) + roda putar mundur, kepala meriam terpelanting miring 42° (Rumus Rodrigues).',
        6: 'Scene 6 [Impact Explosion]: Wide shot, bola membesar eksponensial (Scaling Ekstrem), camera push-in, White Flash & sasis terdorong gelombang kejut.',
        7: 'Scene 7 [Aftermath]: Layar pulih, camera slow pull-back, sasis kembali ke tengah dan meriam berputar tegak lurus kembali ke 0° dengan gagah.'
    };

    function startScene(id) {
        anim.currentScene = id;
        anim.timer = 0;
        anim.playAll = false;

        if (id === 1) {
            // Scene 1 pan shot
        } else if (id === 6) {
            cam.d = 8.8;
            cam.p = 0.44;
            cam.y = DEFAULT_CAM.y;
            car.x = 0; car.rot = 0; car.z = -2.6;
            car.pitch = 0; car.roll = 0; car.bob = 0;
        } else if (id === 5) {
            // Tepat di awal Scene 5 sebelum menembak: LURUS KE DEPAN (rot = 0, x = 0)
            car.x = 0;
            car.rot = 0;
            car.z = -0.8;
            car.pitch = 0; car.roll = 0; car.bob = 0;
            car.recoilMat = LIBS.get_I4();
            cam.y = DEFAULT_CAM.y;
            cam.p = DEFAULT_CAM.p;
            cam.d = DEFAULT_CAM.d;
        } else {
            cam.y = DEFAULT_CAM.y;
            cam.p = DEFAULT_CAM.p;
            cam.d = DEFAULT_CAM.d;
        }
        updateStatus();
    }

    function playAllScenes() {
        anim.currentScene = 1;
        anim.timer = 0;
        anim.playAll = true;
        updateStatus();
    }

    function resetSparky() {
        anim.currentScene = 0;
        anim.timer = 0;
        anim.playAll = false;
        car.x = 0; car.z = 0; car.rot = 0; car.speed = 0;
        car.lAng = 0; car.rAng = 0; car.pitch = 0; car.roll = 0; car.bob = 0; car.bobT = 0;
        car.turretRotY = 0;
        car.headScale = 1.0;
        car.recoilMat = LIBS.get_I4();
        car.coilScales = [1, 1, 1, 1, 1, 1];
        car.attachedBallMat = null;
        worldBall.visible = false;
        whiteFlash = 0.0;
        cam.y = DEFAULT_CAM.y; cam.p = DEFAULT_CAM.p; cam.d = DEFAULT_CAM.d;
        updateStatus();
    }

    function updateStatus() {
        var el = document.getElementById('scene-status-desc');
        if (el) {
            var prefix = anim.playAll ? '<span style="color:#f59e0b;font-weight:bold;">[PLAY ALL]</span> ' : '';
            el.innerHTML = prefix + (sceneDescriptions[anim.currentScene] || '');
        }
        var btns = document.querySelectorAll('.scene-btn');
        btns.forEach(function (b) {
            var sid = parseInt(b.getAttribute('data-scene'));
            if (sid === anim.currentScene) {
                b.style.borderColor = '#fbbf24';
                b.style.boxShadow = '0 0 12px rgba(251, 191, 36, 0.6)';
            } else {
                b.style.borderColor = 'rgba(255,255,255,0.2)';
                b.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
            }
        });
    }

    /* DOM UI Buttons Creation via Pure JS */
    function setupUI() {
        var panel = document.createElement('div');
        panel.id = 'scene-ui-panel';
        panel.style.position = 'fixed';
        panel.style.top = '12px';
        panel.style.left = '50%';
        panel.style.transform = 'translateX(-50%)';
        panel.style.background = 'rgba(15, 23, 42, 0.88)';
        panel.style.backdropFilter = 'blur(12px)';
        panel.style.padding = '10px 18px';
        panel.style.borderRadius = '14px';
        panel.style.border = '1px solid rgba(255, 255, 255, 0.18)';
        panel.style.boxShadow = '0 10px 35px rgba(0,0,0,0.55)';
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.alignItems = 'center';
        panel.style.gap = '8px';
        panel.style.zIndex = '999999';
        panel.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        panel.style.color = '#fff';
        panel.style.maxWidth = '94vw';
        panel.style.userSelect = 'none';

        var title = document.createElement('div');
        title.innerHTML = '⚡ <b>SPARKY ANIMASI 3D (WEBGL MURNI)</b> &mdash; <span style="color:#fbbf24; font-size:12px;">Hierarki & 5 Transformasi</span>';
        title.style.fontSize = '13px';
        title.style.letterSpacing = '0.5px';
        panel.appendChild(title);

        var btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.flexWrap = 'wrap';
        btnRow.style.gap = '6px';
        btnRow.style.justifyContent = 'center';

        var scenes = [
            { id: 1, label: 'Scene 1: The Arena' },
            { id: 2, label: 'Scene 2: Idle' },
            { id: 3, label: 'Scene 3: Power Up' },
            { id: 4, label: 'Scene 4: Evasive' },
            { id: 5, label: 'Scene 5: The Blast' },
            { id: 6, label: 'Scene 6: Impact' },
            { id: 7, label: 'Scene 7: Aftermath' },
            { id: 'all', label: '▶ Play All' },
            { id: 'reset', label: '↺ Reset' }
        ];

        scenes.forEach(function (sc) {
            var btn = document.createElement('button');
            btn.className = 'scene-btn';
            btn.textContent = sc.label;
            if (typeof sc.id === 'number') btn.setAttribute('data-scene', sc.id);

            btn.style.background = (sc.id === 'all') ? 'linear-gradient(135deg, #eab308, #ca8a04)' :
                                   (sc.id === 'reset') ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
                                   'linear-gradient(135deg, #1e293b, #334155)';
            btn.style.color = '#fff';
            btn.style.border = '1px solid rgba(255,255,255,0.2)';
            btn.style.padding = '6px 12px';
            btn.style.borderRadius = '8px';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '600';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'all 0.18s ease';
            btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

            btn.onmouseover = function () {
                btn.style.transform = 'translateY(-2px)';
            };
            btn.onmouseout = function () {
                btn.style.transform = 'translateY(0)';
            };

            btn.onclick = function () {
                if (sc.id === 'all') playAllScenes();
                else if (sc.id === 'reset') resetSparky();
                else startScene(sc.id);
            };

            btnRow.appendChild(btn);
        });

        panel.appendChild(btnRow);

        var statusDiv = document.createElement('div');
        statusDiv.id = 'scene-status-desc';
        statusDiv.style.fontSize = '12px';
        statusDiv.style.color = '#94a3b8';
        statusDiv.style.textAlign = 'center';
        statusDiv.style.lineHeight = '1.4';
        statusDiv.style.padding = '2px 8px';
        statusDiv.innerHTML = sceneDescriptions[0];
        panel.appendChild(statusDiv);

        document.body.appendChild(panel);
    }

    /* Logika Update Animasi Tiap Scene */
    function updateSceneAnimation(dt) {
        if (anim.currentScene === 0) return;

        anim.timer += dt;
        var t = anim.timer;

        // SCENE 1: THE ARENA (4.0s)
        if (anim.currentScene === 1) {
            var dur = 4.0;
            var p = Math.min(1.0, t / dur);
            var ease = p * p * (3 - 2 * p);

            // Wide pan shot: kamera bergerak memutar & mendekat menuju sudut 3/4 depan-samping atas
            cam.y = 1.0 + (DEFAULT_CAM.y - 1.0) * ease;
            cam.p = 0.65 + (DEFAULT_CAM.p - 0.65) * ease;
            cam.d = 9.8 + (DEFAULT_CAM.d - 9.8) * ease;

            // Translasi Z: Sparky meluncur dari belakang (-8.0) ke tengah (0.0)
            car.x = 0;
            car.z = -8.0 + 8.0 * ease;
            car.rot = 0;
            car.pitch = 0; car.roll = 0;
            car.bob = Math.sin(t * 14.0) * 0.012 * (1.0 - ease * 0.5);

            // Roda berputar sinkron dengan translasi maju
            var distMoved = 8.0 * ease;
            car.lAng = distMoved / 0.34;
            car.rAng = distMoved / 0.34;

            // Moncong meriam menoleh kiri & kanan mencari target di atas alas putar
            car.turretRotY = Math.sin(p * Math.PI * 2.5) * 0.32 * (1.0 - p * 0.3);
            car.headScale = 1.0;
            car.recoilMat = LIBS.get_I4();
            car.coilScales = [1, 1, 1, 1, 1, 1];
            car.attachedBallMat = null;
            worldBall.visible = false;
            whiteFlash = 0.0;

            if (p >= 1.0) {
                if (anim.playAll) startScene(2);
                else anim.currentScene = 2;
            }
        }

        // SCENE 2: IDLE / STANDBY (3.0s)
        else if (anim.currentScene === 2) {
            var dur = 3.0;
            var p = Math.min(1.0, t / dur);

            cam.y = DEFAULT_CAM.y; cam.p = DEFAULT_CAM.p; cam.d = DEFAULT_CAM.d;
            car.x = 0; car.z = 0; car.rot = 0;
            car.pitch = 0; car.roll = 0;
            // Efek getaran mesin halus
            car.bob = Math.sin(t * 16.0) * 0.005;
            // Rotasi sangat pelan pada meriam
            car.turretRotY = Math.sin(t * 2.0) * 0.06;
            car.headScale = 1.0;
            car.recoilMat = LIBS.get_I4();
            car.coilScales = [1, 1, 1, 1, 1, 1];
            car.attachedBallMat = null;
            worldBall.visible = false;
            whiteFlash = 0.0;

            if (p >= 1.0 && anim.playAll) startScene(3);
        }

        // SCENE 3: POWER UP (3.5s)
        else if (anim.currentScene === 3) {
            var dur = 3.5;
            var p = Math.min(1.0, t / dur);

            cam.y = DEFAULT_CAM.y; cam.p = DEFAULT_CAM.p; cam.d = DEFAULT_CAM.d;
            car.x = 0; car.z = 0; car.rot = 0;
            car.pitch = 0; car.roll = 0;
            // Bidikan meriam lurus ke depan
            car.turretRotY = 0.0;
            car.recoilMat = LIBS.get_I4();

            // Denyut halus bertahap semakin intens (pulsing / breathing effect)
            var pulseFreq = 6.0 + 12.0 * p;
            var pulse = Math.max(0, Math.sin(t * pulseFreq));
            // SELURUH BAGIAN ATAS / KEPALA MERIAM berdenyut membesar (skala 1.0 hingga 1.08 - 1.12)
            car.headScale = 1.0 + (0.04 * p + 0.07 * pulse * p);

            // Getaran bodi mesin Sparky
            car.bob = Math.sin(t * 28.0) * (0.004 + 0.008 * p);

            // Ke-6 kumparan merah berdenyut gelombang halus sinkron
            for (var i = 0; i < 6; i++) {
                var wave = Math.sin(t * (pulseFreq + 2.0) - i * 0.75);
                car.coilScales[i] = 1.0 + 0.12 * Math.max(0, wave) * p;
            }

            // Bola energi kuning di ujung moncong: UKURAN PROPORSIONAL (dari 0.04 hingga 0.22)
            // Berada tepat di depan ujung moncong cincin emas (Z=0.48), tidak menembus badan
            var ballRadius = 0.04 + 0.18 * p;
            car.attachedBallMat = mm(T(0, 0, 0.48), Sc(ballRadius, ballRadius, ballRadius));
            worldBall.visible = false;
            whiteFlash = 0.0;

            if (p >= 1.0 && anim.playAll) startScene(4);
        }

        // SCENE 4: EVASIVE MANEUVER (2.6s)
        else if (anim.currentScene === 4) {
            var dur = 2.6;
            var p = Math.min(1.0, t / dur);

            cam.y = DEFAULT_CAM.y; cam.p = DEFAULT_CAM.p; cam.d = DEFAULT_CAM.d;

            // Sasis bergerak MUNDUR SEDIKIT sambil berbelok/memutar serong ke KIRI SEDIKIT di atas tanah,
            // lalu pada akhir Scene 4 KEMBALI LURUS MENGHADAP KE DEPAN (rotasi Y -> 0, x -> 0)
            var dodgeZ = Math.sin(p * Math.PI * 0.5); // mundur bertahap ke -0.8
            car.z = -0.8 * dodgeZ;

            // X dan Rot serong kiri di tengah manuver, lalu KEMBALI LURUS TEPAT KE 0 di akhir Scene 4
            var dodgeSide = Math.sin(p * Math.PI); // 0 -> 1 di tengah -> 0 di akhir!
            car.x = -0.60 * dodgeSide;
            car.rot = -0.35 * dodgeSide; // KEMBALI TEPAT KE 0 DERAJAT!

            // Ke-4 roda HARUS TETAP MENAPAK DI TANAH
            car.pitch = 0.0;
            car.roll = 0.0;
            car.bob = 0.0;

            // Roda berputar mundur sinkron dengan jarak tempuh sasis
            car.lAng = car.z / 0.34;
            car.rAng = car.z / 0.34;

            // Kepala meriam tetap mempertahankan status energi penuh
            car.headScale = 1.08 + 0.03 * Math.max(0, Math.sin(t * 16.0));
            car.turretRotY = 0.0;
            car.recoilMat = LIBS.get_I4();

            // Bola energi proporsional (skala 0.22) tetap terpasang dan mengikuti moncong secara hierarkis
            car.attachedBallMat = mm(T(0, 0, 0.48), Sc(0.22, 0.22, 0.22));
            worldBall.visible = false;
            whiteFlash = 0.0;

            if (p >= 1.0 && anim.playAll) startScene(5);
        }

        // SCENE 5: THE BLAST & RECOIL (2.5s)
        else if (anim.currentScene === 5) {
            var dur = 2.5;
            var p = Math.min(1.0, t / dur);

            cam.y = DEFAULT_CAM.y; cam.p = DEFAULT_CAM.p; cam.d = DEFAULT_CAM.d;
            car.attachedBallMat = null; // bola energi lepas melesat
            car.headScale = 1.0;

            // Posisi hadap sasis Sparky PASTI LURUS KE DEPAN (rot = 0, x = 0)
            car.x = 0.0;
            car.rot = 0.0;
            car.pitch = 0.0; car.roll = 0.0; car.bob = 0.0;
            car.turretRotY = 0.0;

            // EFEK 1: SASIS TERDORONG MUNDUR MENYENTAK KUAT KE BELAKANG (Translate Z mundur cukup jauh)
            // Sasis mundur menyentak dari -0.8 ke -2.6 (mundur 1.8 unit, sangat jelas terlihat!)
            var pushBackShove = 1.0 - Math.exp(-t * 3.8);
            car.z = -0.8 - 1.8 * pushBackShove;

            // Ke-4 roda berputar mundur sinkron mengikuti sentakan sasis mundur
            car.lAng = car.z / 0.34;
            car.rAng = car.z / 0.34;

            // Bola energi melesat lurus cepat ke depan meninggalkan moncong
            worldBall.visible = true;
            worldBall.s = 0.22; // ukuran proporsional
            var blastSpeed = t * 28.0;
            worldBall.p = [0, 1.26, car.z + 1.25 + blastSpeed];

            // EFEK 2: BAGIAN ATAS TERPELANTING MIRING SECARA DIAGONAL KE BELAKANG-ATAS (Rumus Rodrigues)
            // Sumbu sembarang diagonal: normalize([-1.0, 0.3, 1.0]) -> [-0.6917, 0.2075, 0.6917]
            // Sudut hentakan recoil besar: sentakan awal mencapai 42° (0.73 rad), lalu stabil di pose recoil ~30° (0.52 rad)
            var kick = Math.sin(Math.min(1.0, t / 0.10) * Math.PI * 0.5);
            var recoilAngle = (0.73 * Math.exp(-t * 1.5) + 0.52 * (1.0 - Math.exp(-t * 2.0))) * kick;
            car.recoilMat = M4.rotAxis([-0.6917, 0.2075, 0.6917], recoilAngle);

            whiteFlash = 0.0;

            if (p >= 1.0 && anim.playAll) startScene(6);
        }

        // SCENE 6: IMPACT EXPLOSION & SHOCKWAVE (2.6s)
        else if (anim.currentScene === 6) {
            var dur = 2.6;
            var p = Math.min(1.0, t / dur);

            // KAMERA DIJAUHKAN (Wide/Medium-far shot, TIDAK nge-zoom menabrak Sparky)
            var push = Math.min(1.0, t * 1.4);
            cam.d = 8.8 - 1.8 * push; // dari 8.8 turun ke 7.0 (tetap berjarak luas dan lega)
            cam.y = DEFAULT_CAM.y;
            cam.p = 0.44;

            // a) Bola energi membesar secara eksponensial drastis menjadi bola ledakan raksasa
            worldBall.visible = true;
            worldBall.p = [0, 1.26, 13.0];
            worldBall.s = 0.22 + Math.pow(t * 3.4, 2.7);

            // b) Efek White Flash transition di puncak ledakan
            if (t < 0.28) whiteFlash = t / 0.28;
            else whiteFlash = Math.max(0, 1.0 - (t - 0.28) / 1.4);

            // c) Gelombang kejut (shockwave): tubuh Sparky kembali TERDORONG MUNDUR sedikit & berguncang
            var shockPush = 0.7 * Math.min(1.0, t * 2.6);
            car.z = -2.6 - shockPush; // terdorong mundur lagi hingga -3.3
            car.x = 0.0;
            car.rot = 0.0;
            car.lAng = car.z / 0.34;
            car.rAng = car.z / 0.34;

            // Guncangan tremor sasis & meriam
            var shake = Math.exp(-t * 2.2) * 0.09;
            car.pitch = Math.sin(t * 42.0) * shake * 0.7;
            car.roll = Math.cos(t * 36.0) * shake * 0.7;
            car.bob = Math.sin(t * 48.0) * shake * 0.04;

            // Meriam tetap mempertahankan pose miring diagonal akibat recoil + tremor gelombang kejut
            var recoilAngle6 = 0.52 + Math.sin(t * 38.0) * shake * 0.4;
            car.recoilMat = M4.rotAxis([-0.6917, 0.2075, 0.6917], recoilAngle6);
            car.headScale = 1.0;
            car.attachedBallMat = null;

            if (p >= 1.0 && anim.playAll) startScene(7);
        }

        // SCENE 7: AFTERMATH & VICTORY POSE (3.8s)
        else if (anim.currentScene === 7) {
            var dur = 3.8;
            var p = Math.min(1.0, t / dur);
            var ease = p * p * (3 - 2 * p);

            // Layar pulih dari kilatan putih
            whiteFlash = Math.max(0, 0.25 * (1.0 - p * 2.5));

            // Kamera slow pull-back menjauh perlahan pada jarak proporsional (seluruh badan Sparky terlihat utuh)
            cam.d = 7.0 + (DEFAULT_CAM.d - 7.0) * ease; // pull-back halus ke 5.4
            cam.p = DEFAULT_CAM.p;
            cam.y = DEFAULT_CAM.y;

            // Sparky bergerak maju kembali dari posisi terdorong mundur (-3.3) ke tengah arena (0.0)
            car.z = -3.3 * (1.0 - ease);
            car.x = 0.0;
            car.rot = 0.0;
            car.pitch = 0.0; car.roll = 0.0; car.bob = 0.0;

            // Roda berputar maju mengiringi langkah kembali ke tengah
            var travelZ = -3.3 + 3.3 * ease;
            car.lAng = travelZ / 0.34;
            car.rAng = travelZ / 0.34;

            // BAGIAN RUMAH MESIN DAN LARAS MERIAM BERPUTAR KEMBALI TEGAK LURUS KE POSISI SEMULA (recoil angle -> 0)
            var returnRecoilAngle = 0.52 * (1.0 - ease);
            car.recoilMat = M4.rotAxis([-0.6917, 0.2075, 0.6917], returnRecoilAngle);

            // Toledan kemenangan gagah di atas alas putar (Turret Base)
            car.turretRotY = Math.sin(t * 2.8) * Math.exp(-t * 0.7) * 0.28;
            car.headScale = 1.0;
            car.coilScales = [1, 1, 1, 1, 1, 1];
            car.attachedBallMat = null;
            worldBall.visible = false;

            if (p >= 1.0) {
                car.recoilMat = LIBS.get_I4();
                car.turretRotY = 0.0;
                anim.currentScene = 0;
                anim.playAll = false;
                updateStatus();
            }
        }
    }

    /* Manual WASD Driver */
    function updateManualCar(dt) {
        if (anim.currentScene !== 0) return;

        var throttle = 0, steer = 0;
        if (keys['w'] || keys['arrowup']) throttle += 1;
        if (keys['s'] || keys['arrowdown']) throttle -= 1;
        if (keys['a'] || keys['arrowleft']) steer += 1;   // belok kiri
        if (keys['d'] || keys['arrowright']) steer -= 1;  // belok kanan

        var prevSpeed = car.speed;

        // Akselerasi & Gesekan
        if (throttle > 0) {
            car.speed += (car.speed < 0 ? car.brake : car.accel) * dt;
            car.speed = Math.min(car.speed, car.maxSpeed);
        } else if (throttle < 0) {
            car.speed -= (car.speed > 0 ? car.brake : car.accel) * dt;
            car.speed = Math.max(car.speed, -car.maxSpeed * 0.5);
        } else {
            var d = car.drag * dt;
            car.speed = (Math.abs(car.speed) <= d) ? 0 : car.speed - Math.sign(car.speed) * d;
        }

        // Belok sasis
        var dRot = steer * car.turn * (0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 1.0)) * dt;
        car.rot += dRot;
        cam.y += dRot;

        var move = car.speed * dt;
        car.x += Math.sin(car.rot) * move;
        car.z += Math.cos(car.rot) * move;

        // Roda berputar tanpa yaw (lurus)
        var track = 0.74;
        car.lAng += (move + dRot * track) / 0.34;
        car.rAng += (move - dRot * track) / 0.34;

        // Gerak bodi dinamis
        var acc = dt > 0 ? (car.speed - prevSpeed) / dt : 0;
        var tPitch = clamp(-acc * 0.012, -0.045, 0.045);
        var tRoll = steer * (Math.abs(car.speed) / car.maxSpeed) * 0.045;
        var k = Math.min(1, dt * 5);
        car.pitch += (tPitch - car.pitch) * k;
        car.roll += (tRoll - car.roll) * k;
        var mv = Math.abs(car.speed) / car.maxSpeed;
        car.bobT += dt * (3 + 12 * mv);
        car.bob = Math.abs(Math.sin(car.bobT)) * 0.02 * mv;

        car.turretRotY = 0;
        car.headScale = 1.0;
        car.recoilMat = LIBS.get_I4();
        car.coilScales = [1, 1, 1, 1, 1, 1];
        car.attachedBallMat = null;
        worldBall.visible = false;
        whiteFlash = 0.0;
    }

    /* ================= 7. Render Loop ================= */
    var lastTime = performance.now();

    function render(now) {
        if (!now) now = performance.now();
        var dt = Math.min(0.05, (now - lastTime) * 0.001);
        lastTime = now;

        updateManualCar(dt);
        updateSceneAnimation(dt);

        var w = cv.clientWidth * window.devicePixelRatio | 0;
        var h = cv.clientHeight * window.devicePixelRatio | 0;
        if (cv.width !== w || cv.height !== h) {
            cv.width = w;
            cv.height = h;
        }

        gl.viewport(0, 0, w, h);

        // Background dengan efek White Flash transition untuk Scene 6 Impact
        var bgR = 0.75 + (1.0 - 0.75) * whiteFlash;
        var bgG = 0.78 + (1.0 - 0.78) * whiteFlash;
        var bgB = 0.82 + (1.0 - 0.82) * whiteFlash;
        gl.clearColor(bgR, bgG, bgB, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.disable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(true);

        // Kamera mengikuti Sparky
        var tg = [car.x, 0.88, car.z];
        var cp = Math.cos(cam.p);
        var EYE = [
            tg[0] - Math.sin(cam.y) * cp * cam.d,
            tg[1] + Math.sin(cam.p) * cam.d,
            tg[2] - Math.cos(cam.y) * cp * cam.d
        ];

        var VP = mm(M4.persp(0.9, w / h, 0.1, 200), M4.look(EYE, tg, [0, 1, 0]));
        gl.uniformMatrix4fv(u.uVP, false, VP);
        gl.uniform3fv(u.uEye, EYE);
        gl.uniform3f(u.uSparkyPos, car.x, 0.0, car.z);

        // 1. Gambar Alas Arena
        draw(G.floor, T(0, -0.005, 0), [0.5, 0.52, 0.55], 2.0);

        // 2. Gambar Sparky (Hierarki Scene Graph lengkap)
        drawSparky(car.x, car.z, car.rot, car.lAng, car.rAng, car.pitch, car.roll, car.bob,
                   car.turretRotY, car.recoilMat, car.coilScales, car.attachedBallMat, car.headScale);

        // 3. Gambar Bola Energi saat lepas di udara (Scene 5 & 6)
        if (worldBall.visible) {
            var M_wb = mm(T(worldBall.p[0], worldBall.p[1], worldBall.p[2]), Sc(worldBall.s, worldBall.s, worldBall.s));
            draw(G.sph, M_wb, [1.0, 0.88, 0.15], 3, [90, 1.2], [0.9, 0.75, 0.1]);
            draw(G.sph, mm(M_wb, Sc(0.68, 0.68, 0.68)), [1.0, 1.0, 0.88], 3);
        }

        requestAnimationFrame(render);
    }

    // Inisialisasi UI Tombol Dinamis & Mulai Render Loop
    setupUI();
    requestAnimationFrame(render);
}

window.onload = main;

