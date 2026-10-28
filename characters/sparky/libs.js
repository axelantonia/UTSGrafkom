var LIBS = {
    // 1. Konversi Derajat ke Radian
    degToRad: function (angle) {
        return (angle * Math.PI / 180);
    },

    // 2. [TAMBAHAN BARU] Membaca file JSON (misal: dragon.json)
    get_json: function (url, callback) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("HTTP error " + response.status);
                }
                return response.json();
            })
            .then(data => callback(data))
            .catch(err => console.error("Gagal memuat file JSON:", err));
    },

    // 3. Matriks Prospektif / Proyeksi
    get_projection: function (angle, a, zMin, zMax) {
        var tan = Math.tan(LIBS.degToRad(0.5 * angle)),
            A = -(zMax + zMin) / (zMax - zMin),
            B = (-2 * zMax * zMin) / (zMax - zMin);

        return [
            0.5 / tan, 0, 0, 0,
            0, 0.5 * a / tan, 0, 0,
            0, 0, A, -1,
            0, 0, B, 0
        ];
    },

    // 4. Matriks Identitas 4x4
    get_I4: function () {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    },

    set_I4: function (m) {
        m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0;
        m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
        m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
        m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1;
    },

    // 5. Transformasi Rotasi
    rotateX: function (m, angle) {
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        var mv1 = m[1], mv5 = m[5], mv9 = m[9];
        m[1] = m[1] * c - m[2] * s;
        m[5] = m[5] * c - m[6] * s;
        m[9] = m[9] * c - m[10] * s;

        m[2] = m[2] * c + mv1 * s;
        m[6] = m[6] * c + mv5 * s;
        m[10] = m[10] * c + mv9 * s;
    },

    rotateY: function (m, angle) {
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        var mv0 = m[0], mv4 = m[4], mv8 = m[8];
        m[0] = c * m[0] + s * m[2];
        m[4] = c * m[4] + s * m[6];
        m[8] = c * m[8] + s * m[10];

        m[2] = c * m[2] - s * mv0;
        m[6] = c * m[6] - s * mv4;
        m[10] = c * m[10] - s * mv8;
    },

    rotateZ: function (m, angle) {
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        var mv0 = m[0], mv4 = m[4], mv8 = m[8];
        m[0] = c * m[0] - s * m[1];
        m[4] = c * m[4] - s * m[5];
        m[8] = c * m[8] - s * m[9];

        m[1] = c * m[1] + s * mv0;
        m[5] = c * m[5] + s * mv4;
        m[9] = c * m[9] + s * mv8;
    },

    // 6. Transformasi Translasi
    translateX: function (m, t) {
        m[12] += t;
    },

    translateY: function (m, t) {
        m[13] += t;
    },

    translateZ: function (m, t) {
        m[14] += t;
    },

    // 7. Transformasi Skala
    scale: function (m, sx, sy, sz) {
        m[0] *= sx; m[1] *= sx; m[2] *= sx;
        m[4] *= sy; m[5] *= sy; m[6] *= sy;
        m[8] *= sz; m[9] *= sz; m[10] *= sz;
    },

    // 8. Perkalian Matriks 4x4
    multiply: function (m1, m2) {
        var res = this.get_I4();
        for (var i = 0; i < 4; i++) {
            for (var j = 0; j < 4; j++) {
                var sum = 0;
                for (var k = 0; k < 4; k++) {
                    sum += m1[k * 4 + i] * m2[j * 4 + k];
                }
                res[j * 4 + i] = sum;
            }
        }
        return res;
    },

    // 9. Matriks Normal (3x3 inverse-transpose)
    get_normal_matrix: function (m) {
        var a00 = m[0], a01 = m[1], a02 = m[2],
            a10 = m[4], a11 = m[5], a12 = m[6],
            a20 = m[8], a21 = m[9], a22 = m[10];

        var b01 = a22 * a11 - a12 * a21,
            b11 = -a22 * a10 + a12 * a20,
            b21 = a21 * a10 - a11 * a20;

        var d = a00 * b01 + a01 * b11 + a02 * b21;
        if (!d) return null;
        var id = 1.0 / d;

        return [
            b01 * id,
            (-a22 * a01 + a02 * a21) * id,
            (a12 * a01 - a02 * a11) * id,
            b11 * id,
            (a22 * a00 - a02 * a20) * id,
            (-a12 * a00 + a02 * a10) * id,
            b21 * id,
            (-a21 * a00 + a01 * a20) * id,
            (a11 * a00 - a01 * a10) * id
        ];
    }
};
