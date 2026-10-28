// ===================== CHARACTERS/MEGAKNIGHT.JS =====================
import { TAU, I4, mul, T, S, RX, RY, RZ, RA, around, crs, nrm, smooth, hex } from "../libs/math.js";
import { ellipsoid, cylinder, shell, cone, paraboloid, box, plumeTube, part, node } from "../libs/primitives.js";

export const MK_COL = {
  armor: hex("#25262a"),
  armorLight: hex("#2d2f34"),
  armorDark: hex("#121316"),
  skin: hex("#8d7752"),
  faceSkin: hex("#b59066"),
  sleeve: hex("#7c7e82"),
  indigo: hex("#333978"),
  indigoDark: hex("#1d2147"),
  gold: hex("#8f772c"),
  white: hex("#e8ecf2"),
  eyeBlue: hex("#4c58cc"),
};

export function createMegaKnight(uploader) {
  const { upload, cache } = uploader;

  function G(type, cname, extra) {
    const key = "mk_" + type + "_" + cname + "_" + (extra || "");
    if (!cache[key]) {
      const col = MK_COL[cname];
      const gens = { ellipsoid, cylinder, cone, paraboloid, box, shell };
      cache[key] = upload(gens[type](col, extra));
    }
    return cache[key];
  }
  const plumeGeo = () => cache.mk_plume || (cache.mk_plume = upload(plumeTube(MK_COL.indigo, MK_COL.indigoDark)));
  const P = (type, c, m, extra) => part(() => G(type, c, extra), m);

  function spikeWorldMat(s, dir, scaleW = 0.48, scaleH = 0.56, rad = 0.86) {
    const d = nrm(dir),
      up = [0, 1, 0];
    const ax = crs(up, d),
      l = Math.hypot(...ax),
      ang = Math.acos(Math.max(-1, Math.min(1, d[1])));
    const R = l < 1e-5 ? (d[1] < 0 ? RX(Math.PI) : I4()) : RA(ax, ang);
    const worldM = mul(mul(T(d[0] * rad, d[1] * rad, d[2] * rad), R), S(scaleW, scaleH, scaleW));
    const invArm = mul(RX(0.28), RZ(-s * 0.56));
    return mul(invArm, worldM);
  }

  const armNodes = [],
    gauntletNodes = [],
    legNodes = [];

  function createGauntlet(s) {
    const spikes = [
      { d: [0.22 * s, 0.58, 0.78], w: 0.48, h: 0.56, r: 0.86 },
      { d: [0.9 * s, -0.15, 0.4], w: 0.48, h: 0.56, r: 0.86 },
      { d: [-0.66 * s, -0.38, 0.64], w: 0.48, h: 0.56, r: 0.86 },
      { d: [0.18 * s, -0.9, -0.38], w: 0.48, h: 0.56, r: 0.86 },
      { d: [0.48 * s, 0.64, -0.6], w: 0.48, h: 0.56, r: 0.86 },
    ];
    const spikeNodes = spikes.map((sp) => node(I4(), [P("cone", "armor", spikeWorldMat(s, sp.d, sp.w, sp.h, sp.r), 1)]));
    const gNode = node(
      T(0, -1.86, 0.1),
      [
        P("cylinder", "armorDark", mul(mul(T(0, 0.82, -0.06), RX(0.12)), S(0.42, 0.22, 0.42))),
        P("ellipsoid", "armor", mul(T(0, 0.8, -0.06), S(0.43, 0.12, 0.43))),
        P("ellipsoid", "armor", S(1.04, 1.02, 1.04)),
      ],
      spikeNodes
    );
    gauntletNodes.push(gNode);
    return gNode;
  }

  function createArm(s) {
    const gNode = createGauntlet(s);
    const baseM = mul(mul(T(s * 1.02, 2.86, 0.02), RZ(s * 0.56)), RX(-0.28));
    const aNode = node(
      baseM,
      [
        P("ellipsoid", "sleeve", S(0.36, 0.34, 0.36)),
        P("cylinder", "sleeve", mul(T(0, -0.08, 0), S(0.38, 0.18, 0.38))),
        P("cylinder", "sleeve", mul(T(0, -0.18, 0), S(0.4, 0.07, 0.4))),
        P("cylinder", "skin", mul(T(0, -0.66, 0.02), S(0.32, 0.96, 0.32))),
        P("ellipsoid", "skin", mul(T(0, -1.14, 0.04), S(0.31, 0.28, 0.31))),
      ],
      [gNode]
    );
    armNodes.push(aNode);
    return aNode;
  }

  function createLeg(s) {
    const baseM = mul(T(s * 0.5, 1.18, 0.0), RY(s * 0.08));
    const lNode = node(baseM, [
      P("cylinder", "skin", mul(T(0, -0.15, 0), S(0.25, 0.36, 0.25))),
      P("ellipsoid", "skin", mul(T(0, -0.34, 0), S(0.25, 0.22, 0.25))),
      P("cylinder", "skin", mul(T(0, -0.52, 0), S(0.24, 0.36, 0.24))),
      P("box", "armor", mul(T(0, -0.74, 0.02), S(0.6, 0.58, 0.62)), 0.1),
      P("box", "armorLight", mul(mul(T(0, -0.52, 0.26), RX(-0.15)), S(0.5, 0.34, 0.18)), 0.06),
      P("ellipsoid", "armorLight", mul(T(0.31, -0.78, 0.0), S(0.06, 0.14, 0.14))),
      P("ellipsoid", "armorLight", mul(T(-0.31, -0.78, 0.0), S(0.06, 0.14, 0.14))),
      P("box", "armor", mul(T(0, -1.02, 0.14), S(0.64, 0.32, 0.88)), 0.08),
      P("box", "armorDark", mul(T(0, -1.16, 0.14), S(0.6, 0.06, 0.84)), 0.04),
    ]);
    legNodes.push(lNode);
    return lNode;
  }

  function createVisorParts() {
    const parts = [];
    const panelYaw = 0.56;
    parts.push(P("box", "armorLight", mul(mul(T(0, 3.22, 0.55), RY(Math.PI / 4)), S(0.075, 0.54, 0.075)), 0.015));
    [-1, 1].forEach((s) => {
      parts.push(P("box", "armorDark", mul(mul(T(s * 0.23, 3.29, 0.37), RY(s * panelYaw)), S(0.54, 0.36, 0.08)), 0.02));
      parts.push(P("cone", "armorDark", mul(mul(T(0, 3.26, 0.26), RX(0.14)), S(0.46, -0.34, 0.36))));
      parts.push(P("box", "armorLight", mul(mul(T(s * 0.24, 3.48, 0.4), RY(s * panelYaw)), S(0.58, 0.07, 0.11)), 0.02));
      parts.push(P("box", "armorLight", mul(mul(mul(T(s * 0.24, 3.07, 0.4), RY(s * panelYaw)), RZ(-s * 0.35)), S(0.6, 0.085, 0.11)), 0.02));
      [0.32, 0.64, 0.96].forEach((t) => {
        const xPos = s * 0.46 * t,
          zPos = 0.54 - 0.29 * t;
        const yTop = 3.48,
          yBot = 2.98 + 0.19 * t;
        parts.push(P("box", "armorLight", mul(mul(T(xPos, (yTop + yBot) / 2, zPos), RY(s * panelYaw)), S(0.062, yTop - yBot, 0.07)), 0.012));
      });
      parts.push(P("box", "armorLight", mul(T(s * 0.54, 3.44, 0.02), S(0.11, 0.34, 0.22)), 0.02));
    });
    parts.push(P("cone", "armor", mul(mul(T(0, 3.24, 0.2), RX(0.16)), S(0.48, -0.32, 0.4))));
    return parts;
  }

  const plumeNode = node(T(0.19, 4.1, -0.02), [P("cone", "armor", mul(T(0, -0.02, 0), S(0.11, 0.13, 0.11))), part(plumeGeo, I4())]);

  const headNode = node(
    I4(),
    [
      P("ellipsoid", "faceSkin", mul(T(0, 3.58, 0.01), S(0.46, 0.34, 0.42))),
      P("ellipsoid", "armorDark", mul(T(0, 3.45, -0.02), S(0.48, 0.42, 0.46))),
      ...[-1, 1].flatMap((s) => [
        P("ellipsoid", "white", mul(T(s * 0.15, 3.6, 0.415), S(0.068, 0.062, 0.02))),
        P("ellipsoid", "eyeBlue", mul(T(s * 0.145, 3.6, 0.43), S(0.042, 0.046, 0.015))),
        P("ellipsoid", "armorDark", mul(T(s * 0.145, 3.6, 0.44), S(0.02, 0.022, 0.01))),
        P("box", "armorDark", mul(mul(T(s * 0.15, 3.66, 0.425), RZ(s * 0.25)), S(0.13, 0.035, 0.03)), 0.01),
      ]),
      P("shell", "armor", mul(T(0, 3.48, -0.02), S(0.52, 0.72, 0.52))),
      P("cylinder", "armor", mul(T(0, 3.92, -0.02), S(0.52, 0.36, 0.52))),
      P("cylinder", "armorLight", mul(T(0, 3.75, -0.02), S(0.545, 0.11, 0.545))),
      ...[-0.56, -0.19, 0.19, 0.56].map((a) => P("ellipsoid", "armor", mul(T(0.548 * Math.sin(a), 3.75, -0.02 + 0.548 * Math.cos(a)), S(0.045)))),
      ...createVisorParts(),
    ],
    [plumeNode]
  );

  const bodyNode = node(
    I4(),
    [
      P("paraboloid", "armor", mul(mul(T(0, 2.52, -0.03), RX(0.05)), S(0.98, 0.88, 0.76))),
      P("box", "armor", mul(mul(T(0, 2.82, -0.02), RX(0.06)), S(1.94, 0.78, 1.48)), 0.24),
      P("cylinder", "armor", mul(mul(T(0, 3.16, -0.04), RX(0.3)), S(0.72, 0.44, 0.72))),
      P("ellipsoid", "armorDark", mul(mul(T(0, 3.28, 0.02), RX(0.3)), S(0.62, 0.2, 0.62))),
      P("box", "armorLight", mul(mul(mul(T(-0.28, 3.04, 0.34), RY(-0.52)), RZ(-0.34)), S(0.66, 0.22, 0.24)), 0.08),
      P("box", "armorLight", mul(mul(mul(T(0.28, 3.04, 0.34), RY(0.52)), RZ(0.34)), S(0.66, 0.22, 0.24)), 0.08),
      P("box", "armor", mul(T(0, 2.56, -0.01), S(1.88, 0.88, 1.46)), 0.22),
      P("box", "armor", mul(mul(T(0, 2.62, 0.12), RX(-0.08)), S(1.76, 0.74, 1.32)), 0.22),
      P("box", "armorDark", mul(T(0, 2.16, 0.0), S(1.72, 0.36, 1.38)), 0.12),
      P("box", "indigo", mul(T(0, 1.82, 0.02), S(1.84, 0.46, 1.56)), 0.09),
      P("ellipsoid", "indigoDark", mul(T(-0.53, 1.82, 0.802), S(0.052, 0.058, 0.012))),
      P("ellipsoid", "indigoDark", mul(T(-0.71, 1.82, 0.802), S(0.052, 0.058, 0.012))),
      P("box", "gold", mul(T(0, 2.0, 0.8), S(0.78, 0.13, 0.16)), 0.02),
      P("box", "gold", mul(T(0, 1.64, 0.8), S(0.78, 0.13, 0.16)), 0.02),
      P("box", "gold", mul(T(-0.325, 1.82, 0.798), S(0.13, 0.36, 0.15)), 0.02),
      P("box", "gold", mul(T(0.325, 1.82, 0.798), S(0.13, 0.36, 0.15)), 0.02),
      P("box", "sleeve", mul(T(0, 1.38, 0.0), S(1.66, 0.52, 1.38)), 0.1),
      P("box", "armor", mul(T(0, 1.12, 0.0), S(1.72, 0.12, 1.44)), 0.04),
      P("box", "armorDark", mul(T(0, 1.09, 0.0), S(1.58, 0.06, 1.3)), 0.02),
    ],
    [headNode, createArm(-1), createArm(1), createLeg(-1), createLeg(1)]
  );

  function setHeadRot(yawAngle, pitchAngle = 0, rollAngle = 0) {
    headNode.m = around(0, 3.44, -0.02, mul(RY(yawAngle), mul(RX(pitchAngle), RZ(rollAngle))));
  }

  function setGauntletTransform(idx, rotMat, scaleVal = 1) {
    const g = gauntletNodes[idx];
    const M = mul(rotMat, S(scaleVal, scaleVal, scaleVal));
    g.m = mul(g.baseM, around(0, 0.78, -0.05, M));
  }

  function resetPose() {
    bodyNode.m = I4();
    headNode.m = I4();
    plumeNode.m = plumeNode.baseM;
    armNodes.forEach((a) => (a.m = a.baseM));
    gauntletNodes.forEach((g) => (g.m = g.baseM));
    legNodes.forEach((l) => (l.m = l.baseM));
  }

  function animScene2_HeavyJump(u) {
    let tx = 0,
      ty = 0,
      tz = 0,
      bodyRX = 0,
      bodyRY = 0;
    let sx = 1,
      sy = 1,
      sz = 1;
    let rArmM = I4(),
      lArmM = I4();
    let rLegRX = 0,
      lLegRX = 0;
    let headYaw = 0,
      headPitch = 0,
      plumeBend = 0,
      maceScale = 1;

    if (u < 0.28) {
      const p = u / 0.28;
      tz = -2.0 * (1 - smooth(p));
      ty = Math.abs(Math.sin(p * Math.PI * 2)) * 0.12;
      const walk = Math.sin(p * Math.PI * 2);
      rLegRX = 0.4 * walk;
      lLegRX = -0.4 * walk;
      rArmM = RX(-0.3 * walk);
      lArmM = RX(0.3 * walk);
      bodyRY = 0.1 * walk;
      headYaw = -0.08 * walk;
      plumeBend = -0.14 * Math.abs(walk);
    } else if (u < 0.44) {
      const p = smooth((u - 0.28) / 0.16);
      ty = -0.16 * p;
      sy = 1 - 0.08 * p;
      sx = 1 + 0.05 * p;
      sz = 1 + 0.05 * p;
      bodyRX = 0.14 * p;
      rArmM = RA([1, 0.35, -0.25], 0.5 * p);
      lArmM = RA([1, -0.35, -0.25], 0.5 * p);
      rLegRX = -0.22 * p;
      lLegRX = -0.22 * p;
      headPitch = -0.08 * p;
      plumeBend = 0.18 * p;
    } else if (u < 0.74) {
      const p = (u - 0.44) / 0.3,
        arc = Math.sin(p * Math.PI);
      ty = -0.16 * (1 - smooth(p * 3)) + 1.95 * arc;
      tz = 0.45 * smooth(p);
      sy = 1 + 0.06 * arc;
      sx = 1 - 0.03 * arc;
      sz = 1 - 0.03 * arc;
      const raise = Math.sin(p * Math.PI * 0.88);
      rArmM = RA([1, -0.3, 0.2], -1.35 * raise);
      lArmM = RA([1, 0.3, 0.2], -1.35 * raise);
      maceScale = 1 + 0.18 * raise;
      bodyRX = -0.1 * arc + 0.22 * smooth(Math.max(0, (p - 0.55) / 0.45));
      rLegRX = 0.38 * arc;
      lLegRX = -0.22 * arc;
      headPitch = 0.08 * arc;
      plumeBend = -0.38 * arc;
    } else {
      const p = (u - 0.74) / 0.26;
      const impact = Math.exp(-p * 6.0) * Math.sin(p * Math.PI * 3.0);
      const settle = 1 - smooth(p);
      tz = 0.45 * settle;
      ty = -0.18 * Math.max(0, impact);
      sy = 1 - 0.12 * impact;
      sx = 1 + 0.08 * impact;
      sz = 1 + 0.08 * impact;
      bodyRX = 0.18 * settle;
      rArmM = RA([1, 0.4, 0.25], -0.65 * settle);
      lArmM = RA([1, -0.4, 0.25], -0.65 * settle);
      maceScale = 1 + 0.2 * Math.max(0, impact);
      headPitch = 0.06 * impact;
      plumeBend = 0.35 * impact;
    }

    const waistRot = around(0, 1.65, 0, mul(RY(bodyRY), RX(bodyRX)));
    bodyNode.m = mul(T(tx, ty, tz), mul(waistRot, S(sx, sy, sz)));
    setHeadRot(headYaw, headPitch);
    plumeNode.m = mul(plumeNode.baseM, RX(plumeBend));
    armNodes[0].m = mul(armNodes[0].baseM, rArmM);
    armNodes[1].m = mul(armNodes[1].baseM, lArmM);
    setGauntletTransform(0, I4(), maceScale);
    setGauntletTransform(1, I4(), maceScale);
    legNodes[0].m = mul(legNodes[0].baseM, RX(rLegRX - bodyRX * 0.7));
    legNodes[1].m = mul(legNodes[1].baseM, RX(lLegRX - bodyRX * 0.7));
    return {
      scene: "Scene 2 (12-25s): Heavy Jump & Landing",
      rubric: "Translate + Rotate + Scaling (Squash-Stretch) + Hierarchy",
    };
  }

  function animScene3_PowerUp(u) {
    const w = u * TAU * 2,
      pulse = 0.5 - 0.5 * Math.cos(w * 2);
    const breathY = 1 + 0.03 * Math.sin(w),
      breathXZ = 1 + 0.02 * Math.cos(w);
    const bodyYaw = 0.18 * Math.sin(w * 0.5);
    const waistRot = around(0, 1.65, 0, RY(bodyYaw));
    bodyNode.m = mul(T(0.08 * Math.sin(w * 0.5), 0.04 * Math.sin(w), 0), mul(waistRot, S(breathXZ, breathY, breathXZ)));
    setHeadRot(-bodyYaw * 0.75, 0.04 * Math.sin(w));
    plumeNode.m = mul(plumeNode.baseM, RZ(0.12 * Math.cos(w)));
    armNodes[0].m = mul(armNodes[0].baseM, RA([1, -0.55, -0.35], -0.62 - 0.12 * Math.sin(w)));
    armNodes[1].m = mul(armNodes[1].baseM, RA([1, 0.55, -0.35], -0.62 + 0.12 * Math.sin(w)));
    const gScale = 1 + 0.24 * pulse;
    setGauntletTransform(0, RY(0.25 * Math.sin(w)), gScale);
    setGauntletTransform(1, RY(-0.25 * Math.sin(w)), gScale);
    legNodes[0].m = mul(legNodes[0].baseM, RX(0.12 * Math.sin(w * 0.5)));
    legNodes[1].m = mul(legNodes[1].baseM, RX(-0.12 * Math.sin(w * 0.5)));
    return {
      scene: "Scene 3 (25-40s): Combat Guard & Power Pulse",
      rubric: "Scaling (Gauntlet Charge Pulse) + Rotate + Hierarchy",
    };
  }

  function animScene4_ArbitraryAttack(u) {
    const diagAxisR = [1.0, -0.65, 0.55],
      diagAxisL = [1.0, 0.65, 0.55];
    const spinAxisR = [0.4, 1.0, 0.6],
      spinAxisL = [-0.4, 1.0, 0.6];
    let swingR = 0,
      swingL = 0,
      bodyYaw = 0,
      bodyPitch = 0,
      stepZ = 0;
    let maceSpinR = 0,
      maceSpinL = 0,
      maceScaleR = 1,
      maceScaleL = 1;
    let rLegRX = 0,
      lLegRX = 0;

    if (u < 0.5) {
      const k = u / 0.5;
      if (k < 0.35) {
        const p = smooth(k / 0.35);
        swingR = 0.85 * p;
        swingL = -0.3 * p;
        bodyYaw = -0.38 * p;
        bodyPitch = -0.08 * p;
        stepZ = -0.2 * p;
        maceSpinR = -1.2 * p;
        maceScaleR = 1 + 0.15 * p;
      } else if (k < 0.68) {
        const p = smooth((k - 0.35) / 0.33);
        swingR = 0.85 - 2.3 * p;
        swingL = -0.3 + 0.65 * p;
        bodyYaw = -0.38 + 0.82 * p;
        bodyPitch = -0.08 + 0.24 * p;
        stepZ = -0.2 + 0.75 * p;
        maceSpinR = -1.2 + 3.4 * p;
        maceScaleR = 1.15 + 0.14 * Math.sin(p * Math.PI);
      } else {
        const p = smooth((k - 0.68) / 0.32);
        swingR = -1.45 * (1 - p);
        swingL = 0.35 * (1 - p);
        bodyYaw = 0.44 * (1 - p);
        bodyPitch = 0.16 * (1 - p);
        stepZ = 0.55 * (1 - p);
        maceSpinR = 2.2 * (1 - p);
        maceScaleR = 1 + 0.15 * (1 - p);
      }
      const stride = Math.sin(k * Math.PI);
      rLegRX = -0.42 * stride;
      lLegRX = 0.42 * stride;
    } else {
      const k = (u - 0.5) / 0.5;
      if (k < 0.35) {
        const p = smooth(k / 0.35);
        swingL = 0.85 * p;
        swingR = -0.3 * p;
        bodyYaw = 0.38 * p;
        bodyPitch = -0.08 * p;
        stepZ = -0.2 * p;
        maceSpinL = 1.2 * p;
        maceScaleL = 1 + 0.15 * p;
      } else if (k < 0.68) {
        const p = smooth((k - 0.35) / 0.33);
        swingL = 0.85 - 2.3 * p;
        swingR = -0.3 + 0.65 * p;
        bodyYaw = 0.38 - 0.82 * p;
        bodyPitch = -0.08 + 0.24 * p;
        stepZ = -0.2 + 0.75 * p;
        maceSpinL = 1.2 - 3.4 * p;
        maceScaleL = 1.15 + 0.14 * Math.sin(p * Math.PI);
      } else {
        const p = smooth((k - 0.68) / 0.32);
        swingL = -1.45 * (1 - p);
        swingR = 0.35 * (1 - p);
        bodyYaw = -0.44 * (1 - p);
        bodyPitch = 0.16 * (1 - p);
        stepZ = 0.55 * (1 - p);
        maceSpinL = -2.2 * (1 - p);
        maceScaleL = 1 + 0.15 * (1 - p);
      }
      const stride = Math.sin(k * Math.PI);
      rLegRX = 0.42 * stride;
      lLegRX = -0.42 * stride;
    }

    const waistRot = around(0, 1.65, 0, mul(RY(bodyYaw), RX(bodyPitch)));
    bodyNode.m = mul(T(0, -0.06 * Math.abs(Math.sin(u * TAU)), stepZ), waistRot);
    setHeadRot(-bodyYaw * 0.6, -bodyPitch * 0.35);
    plumeNode.m = mul(plumeNode.baseM, RA([1, 0, 1], -0.35 * Math.sin(u * TAU)));
    armNodes[0].m = mul(armNodes[0].baseM, RA(diagAxisR, swingR));
    armNodes[1].m = mul(armNodes[1].baseM, RA(diagAxisL, swingL));
    setGauntletTransform(0, RA(spinAxisR, maceSpinR), maceScaleR);
    setGauntletTransform(1, RA(spinAxisL, maceSpinL), maceScaleL);
    legNodes[0].m = mul(legNodes[0].baseM, RX(rLegRX - bodyPitch * 0.5));
    legNodes[1].m = mul(legNodes[1].baseM, RX(lLegRX - bodyPitch * 0.5));
    return {
      scene: "Scene 4 (40-52s): Alternating Diagonal Combo (Kanan -> Kiri)",
      rubric: "Rotate Arbitrary Axis (Rodrigues Both Arms) + Hierarchy",
    };
  }

  function animScene5_TheBlast(u) {
    let guard = 0,
      slamPulse = 0;
    if (u < 0.32) guard = smooth(u / 0.32);
    else if (u < 0.8) {
      guard = 1.0;
      slamPulse = Math.sin(((u - 0.32) / 0.48) * Math.PI * 3) * 0.06;
    } else guard = 1.0 - 0.15 * smooth((u - 0.8) / 0.2);

    const waistRot = around(0, 1.65, 0, RX(0.1 * guard));
    bodyNode.m = mul(T(0, -0.08 * guard, -0.15 * guard), waistRot);
    setHeadRot(0.06 * Math.sin(u * TAU), 0.06 * guard);
    plumeNode.m = mul(plumeNode.baseM, RX(-0.24 * guard));
    armNodes[0].m = mul(armNodes[0].baseM, RA([1, -0.72, -0.52], -0.98 * guard - slamPulse));
    armNodes[1].m = mul(armNodes[1].baseM, RA([1, 0.72, -0.52], -0.98 * guard - slamPulse));
    const shieldScale = 1 + 0.16 * guard + Math.abs(slamPulse);
    setGauntletTransform(0, I4(), shieldScale);
    setGauntletTransform(1, I4(), shieldScale);
    legNodes[0].m = mul(legNodes[0].baseM, RX(-0.22 * guard));
    legNodes[1].m = mul(legNodes[1].baseM, RX(0.22 * guard));
    return {
      scene: "Scene 5 (52-62s): The Blast (Iron Cross-Guard)",
      rubric: "Rotate Arbitrary Axis (Cross-Shield) + Scaling + Hierarchy",
    };
  }

  function animScene6_ImpactExplosion(u) {
    let pushZ = 0,
      shakeX = 0,
      bodyPitch = 0,
      armSpread = 0,
      squashY = 1,
      squashXZ = 1;
    if (u < 0.55) {
      const p = u / 0.55;
      pushZ = -0.95 * smooth(p);
      shakeX = Math.sin(p * Math.PI * 14) * 0.045 * (1 - p * 0.4);
      bodyPitch = -0.14 * Math.sin(p * Math.PI);
      armSpread = -0.85 * (1 - 0.3 * p);
      squashY = 1 - 0.06 * Math.sin(p * Math.PI);
      squashXZ = 1 + 0.04 * Math.sin(p * Math.PI);
    } else {
      const p = smooth((u - 0.55) / 0.45);
      pushZ = -0.95 * (1 - p);
      bodyPitch = 0.12 * Math.sin(p * Math.PI);
      armSpread = -0.6 * (1 - p) + 0.35 * Math.sin(p * Math.PI);
    }
    const waistRot = around(0, 1.65, 0, RX(bodyPitch));
    bodyNode.m = mul(T(shakeX, -0.06 * Math.sin(u * Math.PI), pushZ), mul(waistRot, S(squashXZ, squashY, squashXZ)));
    setHeadRot(shakeX * 2.0, -bodyPitch * 0.5);
    plumeNode.m = mul(plumeNode.baseM, RX(-0.48 * Math.sin(u * Math.PI) + shakeX * 4));
    armNodes[0].m = mul(armNodes[0].baseM, RA([1, -0.65, -0.45], armSpread));
    armNodes[1].m = mul(armNodes[1].baseM, RA([1, 0.65, -0.45], armSpread));
    const mScale = 1 + 0.14 * Math.sin(u * Math.PI);
    setGauntletTransform(0, I4(), mScale);
    setGauntletTransform(1, I4(), mScale);
    legNodes[0].m = mul(legNodes[0].baseM, RX(-0.34 * Math.sin(u * Math.PI)));
    legNodes[1].m = mul(legNodes[1].baseM, RX(0.3 * Math.sin(u * Math.PI)));
    return {
      scene: "Scene 6 (62-72s): Impact Explosion Knockback",
      rubric: "Translate (Shockwave Slide) + Scaling + Hierarchy",
    };
  }

  function animScene7_Aftermath(u) {
    let clash = 0,
      salute = 0;
    if (u < 0.4) clash = Math.sin((u / 0.4) * Math.PI);
    else salute = Math.sin(((u - 0.4) / 0.6) * Math.PI);

    const bodyYaw = 0.24 * salute;
    const waistRot = around(0, 1.65, 0, mul(RY(bodyYaw), RX(0.06 * clash - 0.06 * salute)));
    bodyNode.m = mul(T(0, 0.05 * salute, 0), waistRot);
    setHeadRot(-0.22 * Math.sin(u * TAU), -0.05 * salute);
    plumeNode.m = mul(plumeNode.baseM, RX(-0.24 * salute - 0.18 * clash));
    armNodes[0].m = mul(armNodes[0].baseM, clash > 0 ? RA([1, -0.75, -0.45], -0.92 * clash) : RA([1, -0.35, 0.25], -1.45 * salute));
    armNodes[1].m = mul(armNodes[1].baseM, clash > 0 ? RA([1, 0.75, -0.45], -0.92 * clash) : RA([1, 0.35, -0.25], -0.35 * salute));
    const vScale = 1 + 0.16 * salute;
    setGauntletTransform(0, RY(0.6 * salute), vScale);
    setGauntletTransform(1, I4(), 1.0);
    legNodes[0].m = mul(legNodes[0].baseM, RX(-0.15 * salute));
    legNodes[1].m = mul(legNodes[1].baseM, RX(0.15 * salute));
    return {
      scene: "Scene 7 (72-82s): Aftermath Victory Pose",
      rubric: "Hierarchical Transformation + Rotate + Arbitrary Axis",
    };
  }

  function update(animMode, tAnim) {
    if (animMode === 0) return null;
    if (animMode === 1) {
      const t = tAnim % 26.0;
      if (t < 4.8) return animScene2_HeavyJump(t / 4.8);
      if (t < 8.8) return animScene3_PowerUp((t - 4.8) / 4.0);
      if (t < 14.4) return animScene4_ArbitraryAttack((t - 8.8) / 5.6);
      if (t < 18.2) return animScene5_TheBlast((t - 14.4) / 3.8);
      if (t < 22.2) return animScene6_ImpactExplosion((t - 18.2) / 4.0);
      return animScene7_Aftermath((t - 22.2) / 3.8);
    }
    if (animMode === 2) return animScene2_HeavyJump((tAnim % 4.8) / 4.8);
    if (animMode === 3) return animScene3_PowerUp((tAnim % 4.0) / 4.0);
    if (animMode === 4) return animScene4_ArbitraryAttack((tAnim % 5.6) / 5.6);
    if (animMode === 5) return animScene5_TheBlast((tAnim % 3.8) / 3.8);
    if (animMode === 6) return animScene6_ImpactExplosion((tAnim % 4.0) / 4.0);
    if (animMode === 7) return animScene7_Aftermath((tAnim % 4.0) / 4.0);
    return null;
  }

  return { root: bodyNode, resetPose, update };
}
