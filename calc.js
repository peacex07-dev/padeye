/* DNV-ST-E271 pad eye arithmetic.
   Copied from 02_Builder/DNV 2.7-1 Structural Analysis/04_4-4-1_PadEye/04_4-4-1_PadEye.py.
   This file is the calculation. The page does not read a spreadsheet and does not call pad_eye.py.
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PadEye = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ORIENTATIONS = [
    "Vertical (on top of corner post)",
    "Horizontal (inside face of corner post, toward centre)",
    "Laid over (on top of corner post, plate tilted in line with sling leg)",
  ];
  const LAID_OVER = ORIENTATIONS[2];
  const ALLOW_FACTOR = 0.85;
  const SLING_ANGLE_MIN_H = 45.0;
  const SLING_ANGLE_MAX_H = 90.0;
  const ALIGN_TOL_DEG = 2.5;
  const HOLE_CLEARANCE_MAX = 0.06;
  const PIN_TOL_MAX = 0.03;
  const JAW_FILL_MIN = 0.75;
  const N_PER_LB = 4.4482216;
  const MM_PER_IN = 25.4;
  const MPA_PER_KSI = 6.894757;
  const KG_PER_LB = 0.45359237;
  const LB_PER_T = 2204.6226218;
  const DESIGN_STEP_IN = 0.0625;
  const SHACKLE_AUTO = "Auto - smallest shackle whose pad eye works";

  const HOLE_TABLE = {
    '5/8"': ["13/16\"", 13 / 16, "Twist drill", "ANSI B94.11M series"],
    '3/4"': ["15/16\"", 15 / 16, "Twist drill", "ANSI B94.11M series"],
    '7/8"': ["1-1/16\"", 1 + 1 / 16, "Twist drill", "ANSI B94.11M series"],
    '1"': ["1-13/64\"", 1 + 13 / 64, "Twist drill", "ANSI B94.11M series"],
    '1-1/8"': ["1-5/16\"", 1 + 5 / 16, "Twist drill", "ANSI B94.11M series"],
    '1-1/4"': ["1-15/32\"", 1 + 15 / 32, "Twist drill", "ANSI B94.11M series"],
    '1-3/8"': ["1-19/32\"", 1 + 19 / 32, "Twist drill", "ANSI B94.11M series"],
    '1-1/2"': ["1-47/64\"", 1 + 47 / 64, "Twist drill", "ANSI B94.11M series"],
    '1-3/4"': ["2-1/8\"", 2 + 1 / 8, "Twist drill", "ANSI B94.11M series"],
    '2"': ["2-7/16\"", 2 + 7 / 16, "Twist drill", "ANSI B94.11M series"],
    '2-1/2"': ["2-15/16\"", 2 + 15 / 16, "Twist drill", "ANSI B94.11M series"],
    '3"': ["3-7/16\"", 3 + 7 / 16, "Annular cutter", "ICS catalog p.126 (call for price)"],
    '3-1/2"': ["3-15/16\"", 3 + 15 / 16, "Annular cutter", "ICS catalog p.126 (no price listed)"],
    '4"': [null, null, "Boring head", "no fixed-size tool found - bore to size"],
  };

  const US_ROPE_SIZES = [
    ['1/2"', 0.5], ['9/16"', 0.5625], ['5/8"', 0.625], ['3/4"', 0.75],
    ['7/8"', 0.875], ['1"', 1.0], ['1-1/8"', 1.125], ['1-1/4"', 1.25],
    ['1-3/8"', 1.375], ['1-1/2"', 1.5], ['1-5/8"', 1.625], ['1-3/4"', 1.75],
    ['1-7/8"', 1.875], ['2"', 2.0], ['2-1/4"', 2.25],
  ];
  const ROPE_IN = Object.fromEntries(US_ROPE_SIZES);

  const CROSBY_G2130OC = [
    ['5/8"', 3.25, 1.06, 0.77, 2.38, 0.62, "1262013"],
    ['3/4"', 4.75, 1.25, 0.90, 2.81, 0.75, "1262022"],
    ['7/8"', 6.5, 1.44, 1.02, 3.31, 0.88, "1262031"],
    ['1"', 8.5, 1.69, 1.15, 3.76, 1.00, "1262040"],
    ['1-1/8"', 9.5, 1.81, 1.25, 4.27, 1.16, "1262059"],
    ['1-1/4"', 12.0, 2.03, 1.41, 4.69, 1.29, "1262068"],
    ['1-3/8"', 13.5, 2.25, 1.53, 5.22, 1.42, "1262077"],
    ['1-1/2"', 17.0, 2.38, 1.66, 5.76, 1.53, "1262086"],
    ['1-3/4"', 25.0, 2.88, 2.03, 7.00, 1.84, "1262095"],
  ];
  const CROSBY_G2130_PC = [
    ['2"', 35.0, 3.25, 2.31, 7.75, 2.08, "1019677"],
    ['2-1/2"', 55.0, 4.12, 2.81, 10.51, 2.72, "1019695"],
    ['3"', 85.0, 5.00, 3.30, 13.00, 3.12, "1019711"],
    ['3-1/2"', 120.0, 5.25, 3.76, 14.63, 3.63, "1019739"],
    ['4"', 150.0, 5.50, 4.26, 14.50, 4.00, "1019757"],
  ];
  const CROSBY_TOL_C = {
    '5/8"': 0.13, '3/4"': 0.25, '7/8"': 0.25, '1"': 0.25, '1-1/8"': 0.25,
    '1-1/4"': 0.25, '1-3/8"': 0.25, '1-1/2"': 0.25, '1-3/4"': 0.25, '2"': 0.25,
    '2-1/2"': 0.25, '3"': 0.25, '3-1/2"': 0.25, '4"': 0.25,
  };
  const CROSBY_G414_H = [
    [6, 7, '1/4"', 0.23], [8, 8, '5/16"', 0.28], [9, 10, '3/8"', 0.34],
    [11, 12, '7/16"', 0.38], [13, 15, '1/2-9/16"', 0.41], [16, 16, '5/8"', 0.50],
    [18, 20, '3/4"', 0.66], [22, 22, '7/8"', 0.75], [24, 26, '1"', 0.88],
    [28, 32, '1-1/8-1-1/4"', 1.13], [32, 35, '1-1/4-1-3/8"', 1.13],
    [35, 38, '1-3/8-1-1/2"', 1.13], [40, 40, '1-5/8"', 1.38], [44, 44, '1-3/4"', 1.31],
    [48, 52, '1-7/8-2"', 1.50], [56, 56, '2-1/4"', 1.63],
  ];
  const ROPE_THIMBLE = {
    '1/2"': '1/2-9/16"', '9/16"': '1/2-9/16"', '5/8"': '5/8"', '3/4"': '3/4"',
    '7/8"': '7/8"', '1"': '1"', '1-1/8"': '1-1/8-1-1/4"', '1-1/4"': '1-1/8-1-1/4"',
    '1-3/8"': '1-3/8-1-1/2"', '1-1/2"': '1-3/8-1-1/2"', '1-5/8"': '1-5/8"',
    '1-3/4"': '1-3/4"', '1-7/8"': '1-7/8-2"', '2"': '1-7/8-2"', '2-1/4"': '2-1/4"',
  };
  const G414_DE = {
    '1/4"': [0.88, 0.44], '5/16"': [1.06, 0.55], '3/8"': [1.13, 0.66],
    '7/16"': [1.25, 0.74], '1/2-9/16"': [1.50, 0.92], '5/8"': [1.75, 1.03],
    '3/4"': [2.01, 1.30], '7/8"': [2.24, 1.47], '1"': [2.50, 1.75],
    '1-1/8-1-1/4"': [2.87, 1.88], '1-1/4-1-3/8"': [3.50, 2.25],
    '1-3/8-1-1/2"': [3.50, 2.62], '1-5/8"': [4.02, 3.00], '1-3/4"': [4.49, 3.06],
    '1-7/8-2"': [5.98, 3.38], '2-1/4"': [7.01, 3.88],
  };
  const G2130_E = {
    '5/8"': 1.69, '3/4"': 2.00, '7/8"': 2.28, '1"': 2.69, '1-1/8"': 2.91,
    '1-1/4"': 3.26, '1-3/8"': 3.62, '1-1/2"': 3.88, '1-3/4"': 5.00, '2"': 5.75,
    '2-1/2"': 7.25, '3"': 7.88, '3-1/2"': 9.00, '4"': 10.00,
  };
  const PLATE_THICKNESSES = [0.1875, 0.25, 0.3125, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0,
    1.125, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5,
    3.75, 4.0, 5.0, 6.0];
  const TABLE_8_1 = [
    [500, 7.00], [1000, 7.00], [1500, 7.00], [2000, 7.00],
    [2500, 7.20], [3000, 7.80], [3500, 8.41], [4000, 8.83],
    [4500, 9.30], [5000, 9.80], [5500, 10.30], [6000, 10.60],
    [6500, 11.26], [7000, 11.90], [7500, 12.50], [8000, 13.06],
    [8500, 13.60], [9000, 14.10], [9500, 14.57], [10000, 15.01],
    [10500, 15.53], [11000, 16.03], [11500, 16.50], [12000, 16.96],
    [12500, 17.39], [13000, 17.78], [13500, 18.17], [14000, 18.54],
    [14500, 18.88], [15000, 19.20], [15500, 19.64], [16000, 20.06],
    [16500, 20.46], [17000, 20.86], [17500, 21.25], [18000, 21.62],
    [18500, 21.98], [19000, 22.31], [19500, 22.64], [20000, 22.96],
    [20500, 23.43], [21000, 23.92], [21500, 24.40], [22000, 24.86],
    [22500, 25.34], [23000, 25.78], [23500, 26.25], [24000, 26.69],
    [24500, 27.15], [25000, 27.60],
  ];

  function rows(table, dnvTa) {
    const out = {};
    for (const r of table) {
      out[r[0]] = {
        size: r[0], wll: r[1], A: r[2], B: r[3], C: r[4], D: r[5],
        E: G2130_E[r[0]], stock: r[6], dnv_ta: dnvTa,
      };
    }
    return out;
  }

  const SHACKLES = {
    "G-2130-OC": rows(CROSBY_G2130OC, true),
    "G-2130-PC": rows(CROSBY_G2130_PC, false),
  };

  const ORIENT_KEY = {
    vertical: ORIENTATIONS[0],
    horizontal: ORIENTATIONS[1],
    laid: LAID_OVER,
  };

  function pythonFixed(value, digits) {
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
    const neg = value < 0 || Object.is(value, -0);
    const buf = new ArrayBuffer(8);
    const f64 = new Float64Array(buf);
    const u32 = new Uint32Array(buf);
    f64[0] = Math.abs(value);
    let bits = (BigInt(u32[1]) << 32n) | BigInt(u32[0]);
    const biased = (bits >> 52n) & 0x7ffn;
    const frac = bits & ((1n << 52n) - 1n);
    let mantissa;
    let exp;
    if (biased === 0n) {
      mantissa = frac;
      exp = -1022 - 52;
    } else {
      mantissa = frac | (1n << 52n);
      exp = Number(biased) - 1023 - 52;
    }
    const scale = 10n ** BigInt(digits);
    let num = mantissa * scale;
    if (exp >= 0) {
      num <<= BigInt(exp);
    } else if (mantissa !== 0n) {
      const denom = 1n << BigInt(-exp);
      const q = num / denom;
      const rem = num % denom;
      const half = denom >> 1n;
      num = (rem > half || (rem === half && (q & 1n) === 1n)) ? q + 1n : q;
    } else {
      num = 0n;
    }
    let text = num.toString().padStart(digits + 1, "0");
    if (digits > 0) text = text.slice(0, -digits) + "." + text.slice(-digits);
    return (neg ? "-" : "") + text;
  }

  function pyStr(value) {
    if (typeof value !== "number") return String(value);
    if (Object.is(value, -0)) return "-0.0";
    if (!Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return (value < 0 ? "-" : "") + String(Math.abs(value)) + ".0";
    return String(value);
  }

  function pyComma0(value) {
    const text = pythonFixed(value, 0);
    const neg = text.startsWith("-");
    const body = neg ? text.slice(1) : text;
    const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return neg ? "-" + grouped : grouped;
  }

  function tableHole(shackleSize, pinD) {
    const [label, dia, tool, src] = HOLE_TABLE[shackleSize];
    const lo = pinD * (1 + PIN_TOL_MAX);
    const hi = pinD * (1 + HOLE_CLEARANCE_MAX);
    return {
      label, dia, tool, src, lo, hi,
      clear_pct: dia ? (dia - pinD) / pinD * 100 : null,
    };
  }

  function thimbleFit(thSize, sh) {
    const [tD, tE] = G414_DE[thSize];
    const ok = sh.D <= tD && tE <= sh.E;
    const text = `bow dia D ${pythonFixed(sh.D, 2)} <= thimble D ${pythonFixed(tD, 2)}; thimble width E ${pythonFixed(tE, 2)} <= bow inside E ${pythonFixed(sh.E, 2)} in (${thSize} G-414)`;
    return [ok, text];
  }

  function thimbleH(ropeMm) {
    const dIn = ropeMm / MM_PER_IN;
    let best = US_ROPE_SIZES[0];
    let bestAbs = Math.abs(best[1] - dIn);
    for (const row of US_ROPE_SIZES) {
      const gap = Math.abs(row[1] - dIn);
      if (gap < bestAbs) {
        best = row;
        bestAbs = gap;
      }
    }
    const [label, dia] = best;
    if (Math.abs(dia - dIn) > 0.01 || !(label in ROPE_THIMBLE)) return [null, null];
    const size = ROPE_THIMBLE[label];
    const found = CROSBY_G414_H.find((item) => item[2] === size);
    return [size, found[3]];
  }

  function wllMinT(ratingKg) {
    if (ratingKg <= TABLE_8_1[0][0]) return TABLE_8_1[0][1];
    const last = TABLE_8_1[TABLE_8_1.length - 1];
    if (ratingKg > last[0]) {
      throw new Error(`Rating ${pythonFixed(ratingKg, 0)} kg exceeds Table 8-1 range (${last[0]} kg).`);
    }
    for (let i = 0; i < TABLE_8_1.length - 1; i++) {
      const [r0, w0] = TABLE_8_1[i];
      const [r1, w1] = TABLE_8_1[i + 1];
      if (r0 <= ratingKg && ratingKg <= r1) return w0 + (w1 - w0) * (ratingKg - r0) / (r1 - r0);
    }
    throw new Error("Table 8-1 has no row for that rating.");
  }

  function autoShackle(mgwLb, nPe, angleHDeg, kAsym) {
    const nDiv = { 4: 3, 2: 2, 1: null };
    if (!(nPe in nDiv)) {
      throw new Error("Design mode: number of pad eyes must be 1, 2 or 4 (DNV Table 8-3 lifting set configurations).");
    }
    const wmin = wllMinT(mgwLb * KG_PER_LB);
    const beta = (90.0 - angleHDeg) * Math.PI / 180;
    let req = nPe === 1 ? wmin : wmin / (nDiv[nPe] * Math.cos(beta));
    req *= kAsym;
    const cands = [];
    for (const typ of ["G-2130-OC", "G-2130-PC"]) {
      for (const size of Object.keys(SHACKLES[typ])) {
        if (SHACKLES[typ][size].wll >= req) cands.push([typ, size]);
      }
    }
    if (!cands.length) {
      throw new Error(`No listed shackle has WLL >= ${pyComma0(req * LB_PER_T)} lb.`);
    }
    return [cands, req, wmin];
  }

  function ceilStep(x, step) {
    return Math.ceil(x / step - 1e-9) * step;
  }

  function designLoad(mgwLb, nPe, angleHDeg, kAsym) {
    if (nPe === 1) return [5.0 * mgwLb, "Eq. 4.6 single pad eye: 5Rg"];
    if (!(SLING_ANGLE_MIN_H <= angleHDeg && angleHDeg < SLING_ANGLE_MAX_H)) {
      throw new Error(
        `Sling angle ${pyStr(angleHDeg)} deg from horizontal is outside at least ${pythonFixed(SLING_ANGLE_MIN_H, 0)} and below ${pythonFixed(SLING_ANGLE_MAX_H, 0)} deg.`
      );
    }
    const betaDeg = 90.0 - angleHDeg;
    if (!(2 <= nPe && nPe <= 4)) throw new Error("Number of pad eyes n must be 1 to 4.");
    const rsl = 3.0 * mgwLb / ((nPe - 1) * Math.cos(betaDeg * Math.PI / 180)) * kAsym;
    return [rsl, `Eq. 4.5: 3Rg / ((n-1) cos beta), n = ${pythonFixed(nPe, 0)}`];
  }

  function check(name, value, limit, unit, info) {
    return {
      name, value, limit, unit: unit || "ksi",
      util: limit ? value / limit : Infinity,
      ok: value <= limit + 1e-9,
      info: info || "",
      vm: false,
    };
  }

  function checkVm(name, sigma, tau, limit, info) {
    const row = check(name, Math.sqrt(sigma ** 2 + 3 * tau ** 2), limit, "ksi", info);
    row.vm = true;
    row.sigma = sigma;
    row.tau = tau;
    return row;
  }

  function run(mgwLb, nPe, angleHDeg, kAsym, shackleType, shackleSize, t, R, Dh, b, h, tc, Rc, w, ReKsi, ropeMm, tolIn, orientation, deltaDeg, tiltDeg, outOfPlaneDeg) {
    orientation = orientation || ORIENTATIONS[0];
    if (deltaDeg === undefined) deltaDeg = 0.0;
    if (tiltDeg === undefined) tiltDeg = null;
    if (outOfPlaneDeg === undefined) outOfPlaneDeg = 0.0;
    if (nPe === 1) {
      angleHDeg = 90.0;
      tiltDeg = null;
      deltaDeg = 0.0;
      outOfPlaneDeg = 0.0;
      if (orientation === LAID_OVER) orientation = ORIENTATIONS[0];
    }
    if (tiltDeg !== null && tiltDeg !== undefined) deltaDeg = (90.0 - angleHDeg) - tiltDeg;
    deltaDeg = orientation === LAID_OVER ? deltaDeg : 0.0;
    tiltDeg = (90.0 - angleHDeg) - deltaDeg;
    const sh = SHACKLES[shackleType][shackleSize];
    const d = sh.B;
    const A = sh.A;
    const C = sh.C;
    const loaded = designLoad(mgwLb, nPe, angleHDeg, kAsym);
    const rsl = loaded[0];
    const loadBasis = loaded[1];
    const betaDeg = 90.0 - angleHDeg;
    const allow = ALLOW_FACTOR * ReKsi;
    const tTot = t + 2 * tc;
    const P = rsl / 1000.0;
    const checks = [];
    checks.push(check(
      "Eq. 4.13 Tear-out (SCF 3)",
      3 * P / (2 * R * t - Dh * t),
      ReKsi,
      "ksi",
      `3 RSL / (2 r_pl t_pl - d_h t_pl), r_pl = ${pythonFixed(R, 2)}, t_pl = ${pythonFixed(t, 3)} in; cheek plates excluded`
    ));
    const F_N = rsl * N_PER_LB;
    const sigC = 23.7 * Math.sqrt(F_N / ((Dh * MM_PER_IN) * (tTot * MM_PER_IN))) / MPA_PER_KSI;
    checks.push(check(
      "Eq. 4.14 Contact stress",
      sigC,
      ReKsi,
      "ksi",
      `23.7 sqrt(RSL / (d_h (t_pl + 2 t_c))) (DNV SI formula, result in ksi), t_pl + 2t_c = ${pythonFixed(tTot, 3)} in`
    ));
    if (tc > 0) {
      const dc = 2 * Rc;
      checks.push(check(
        "Eq. 4.15 Cheek plate weld",
        P * tc / ((t + tc) * dc * w / Math.sqrt(2)),
        ReKsi,
        "ksi",
        `RSL t_c / ((t_pl + t_c) d_c z / sqrt2), d_c = ${pythonFixed(dc, 2)}, z = ${pythonFixed(w, 3)} in`
      ));
    }
    const br = betaDeg * Math.PI / 180;
    const phi = orientation === LAID_OVER ? 0.0 : (outOfPlaneDeg ? Number(outOfPlaneDeg) : 0.0);
    const inPlane = P * Math.cos(phi * Math.PI / 180);
    const Fv = inPlane * Math.cos(br);
    const Fh = inPlane * Math.sin(br);
    let N = orientation === ORIENTATIONS[0] ? Fv : Fh;
    let V = orientation === ORIENTATIONS[0] ? Fh : Fv;
    let angleOp = Math.abs(phi);
    if (orientation === LAID_OVER) {
      N = P * Math.cos(deltaDeg * Math.PI / 180);
      V = 0.0;
      angleOp = Math.abs(deltaDeg);
    }
    const Fop = P * Math.sin((angleOp + ALIGN_TOL_DEG) * Math.PI / 180);
    const area = b * t;
    const sig = N / area + V * h / (t * b ** 2 / 6) + Fop * h / (b * t ** 2 / 6);
    const tauB = Math.hypot(V, Fop) / area;
    checks.push(checkVm(
      "Base section",
      sig,
      tauB,
      allow,
      `tension N = ${pythonFixed(N, 2)} kip, shear V = ${pythonFixed(V, 2)} kip, M = V x ${pythonFixed(h, 2)} in; out-of-plane ${pythonFixed(Fop, 2)} kip (${pythonFixed(angleOp, 1)} + ${ALIGN_TOL_DEG} deg) x ${pythonFixed(h, 2)} in`
    ));

    const pinMax = d * (1 + PIN_TOL_MAX);
    const holeMax = d * (1 + HOLE_CLEARANCE_MAX);
    const ROut = Math.max(R, tc > 0 ? Rc : 0.0);
    const th = (ropeMm && ropeMm > 0) ? thimbleH(ropeMm) : [null, null];
    const thSize = th[0];
    const H = th[1];
    const tolC = CROSBY_TOL_C[sh.size] || 0.0;
    const tolEff = Math.max(tolC, tolIn || 0.0);
    const RMin = 3 * P / (2 * ReKsi * t) + Dh / 2;
    let gapMin;
    let RMax;
    let gapFit;
    if (H !== null) {
      const ropeIn = ropeMm / MM_PER_IN;
      gapMin = C + d / 2 - ROut - (Dh - d) / 2 - H - ropeIn;
      RMax = C + d / 2 - (Dh - d) / 2 - H - ropeIn - tolEff;
      gapFit = {
        name: "Bow gap (thimble + rope) [4.4.1]",
        ok: gapMin >= tolEff - 1e-9,
        text: `Gap_min ${pythonFixed(gapMin, 3)} >= tolerance ${pythonFixed(tolEff, 3)} in (Crosby Tol.C ${pythonFixed(tolC, 2)}, entered ${pythonFixed(tolIn || 0, 3)}); H ${pythonFixed(H, 2)} (${thSize} G-414) + rope ${pythonFixed(ropeIn, 3)} in`,
      };
    } else {
      gapMin = null;
      RMax = null;
      gapFit = {
        name: "Bow gap (thimble + rope) [4.4.1]",
        ok: false,
        text: (!ropeMm || ropeMm <= 0)
          ? "choose the rope size"
          : `no Crosby G-414 thimble listed for ${pythonFixed(ropeMm / MM_PER_IN, 3)} in rope`,
      };
    }
    let thFit;
    if (thSize) {
      const fitted = thimbleFit(thSize, sh);
      thFit = { name: "Thimble fits shackle bow", ok: fitted[0], text: fitted[1] };
    } else {
      thFit = { name: "Thimble fits shackle bow", ok: false, text: gapFit.text };
    }
    const fits = [
      { name: "Hole clears max pin (d x 1.03)", ok: Dh >= pinMax, text: `Dh ${pythonFixed(Dh, 3)} >= ${pythonFixed(pinMax, 3)} in` },
      {
        name: "Hole clearance <= 6 % of pin [4.4.1]",
        ok: Dh <= holeMax + 1e-9,
        text: `Dh ${pythonFixed(Dh, 3)} <= ${pythonFixed(holeMax, 3)} in (${pythonFixed((Dh - d) / d * 100, 1)} %)`,
      },
      { name: "Thickness fits shackle jaw", ok: tTot <= A, text: `t + 2tc = ${pythonFixed(tTot, 3)} <= A ${pythonFixed(A, 2)} in` },
      {
        name: "Thickness >= 75 % of jaw [4.4.1]",
        ok: tTot >= JAW_FILL_MIN * A - 1e-9,
        text: `t + 2tc = ${pythonFixed(tTot, 3)} >= 0.75 A = ${pythonFixed(JAW_FILL_MIN * A, 3)} in (${pythonFixed(tTot / A * 100, 0)} %)`,
      },
      thFit,
      gapFit,
      {
        name: "R within allowable range",
        ok: RMax !== null && RMin - 1e-9 <= R && R <= RMax + 1e-9,
        text: RMax !== null
          ? `R_min ${pythonFixed(RMin, 3)} (${pythonFixed(RMin / Dh * 100, 0)} % Dh) <= R ${pythonFixed(R, 3)} (${pythonFixed(R / Dh * 100, 0)} %) <= R_max ${pythonFixed(RMax, 3)} (${pythonFixed(RMax / Dh * 100, 0)} % Dh)`
          : "needs rope diameter / thimble",
      },
      {
        name: "Cheek radius <= main radius",
        ok: tc === 0 || Rc <= R,
        text: tc > 0 ? `Rc ${pythonFixed(Rc, 2)} <= R ${pythonFixed(R, 2)} in` : "no cheek plates",
      },
    ];
    if (orientation === LAID_OVER) {
      fits.push({
        name: "Sling in line with pad eye [4.4.1]",
        ok: Math.abs(deltaDeg) <= ALIGN_TOL_DEG + 1e-9,
        text: `sling ${pythonFixed(Math.abs(deltaDeg), 1)} deg out of plate plane <= ${ALIGN_TOL_DEG} deg`,
      });
    }
    return {
      Dh, mgw_lb: mgwLb, n_pe: nPe, angle_h: angleHDeg, k: kAsym,
      rsl, load_basis: loadBasis, Re: ReKsi, allow,
      shackle: Object.assign({}, sh, { type: shackleType }),
      t, tc, checks, fits, orientation, delta: deltaDeg,
      tilt: tiltDeg, out_of_plane: phi, N, V, Fop,
      R, R_min: RMin, R_max: RMax, gap_min: gapMin, tol_eff: tolEff,
    };
  }

  function designPadEye(mgwLb, nPe, angleHDeg, kAsym, ReKsi, ropeMm, tolIn, orientation, step, DhBore, shackle, tiltDeg, outOfPlaneDeg, tFixed, ignoreWll) {
    if (step === undefined || step === null) step = DESIGN_STEP_IN;
    if (tiltDeg === undefined) tiltDeg = null;
    if (outOfPlaneDeg === undefined) outOfPlaneDeg = 0.0;
    const packed = autoShackle(mgwLb, nPe, angleHDeg, kAsym);
    let cands = packed[0];
    const req = packed[1];
    const wmin = packed[2];
    if (shackle && shackle !== SHACKLE_AUTO) {
      const space = shackle.indexOf(" ");
      const typ = shackle.slice(0, space);
      const size = shackle.slice(space + 1);
      const wll = SHACKLES[typ][size].wll;
      if (wll < req && !ignoreWll) {
        throw new Error(
          `Chosen shackle ${shackle} WLL ${pyComma0(wll * LB_PER_T)} lb is below the required ${pyComma0(req * LB_PER_T)} lb (DNV [8.3.2]) - choose a larger size or Auto.`
        );
      }
      cands = [[typ, size]];
    }
    const loaded = designLoad(mgwLb, nPe, angleHDeg, kAsym);
    const P = loaded[0] / 1000.0;
    const th = (ropeMm && ropeMm > 0) ? thimbleH(ropeMm) : [null, null];
    if (th[1] === null) {
      throw new Error("Choose a rope size with a listed Crosby G-414 thimble - needed for the bow gap check.");
    }
    const tried = [];
    for (const [typ, size] of cands) {
      const sh = SHACKLES[typ][size];
      const d = sh.B;
      const A = sh.A;
      const C = sh.C;
      if (!thimbleFit(th[0], sh)[0]) {
        tried.push(`${size} (G-414 ${th[0]} thimble does not fit the bow)`);
        continue;
      }
      const hole = tableHole(size, d);
      const Dh = hole.dia ? hole.dia : DhBore;
      if (!Dh) {
        tried.push(`${size} (bored hole - enter bored diameter)`);
        continue;
      }
      const tList = (tFixed ? [tFixed] : PLATE_THICKNESSES).filter((p) => JAW_FILL_MIN * A - 1e-9 <= p && p <= A + 1e-9);
      for (const t of tList) {
        const R = ceilStep(3 * P / (2 * ReKsi * t) + Dh / 2, step);
        const tolEff = Math.max(CROSBY_TOL_C[size] || 0.0, tolIn || 0.0);
        const ropeIn = ropeMm / MM_PER_IN;
        const RMax = C + d / 2 - (Dh - d) / 2 - th[1] - ropeIn - tolEff;
        if (R <= RMax + 1e-9) {
          const h = R;
          let b = ceilStep(2 * R, step);
          while (b <= 200) {
            const result = run(
              mgwLb, nPe, angleHDeg, kAsym, typ, size,
              t, R, Dh, b, h, 0.0, 0.0, 0.0, ReKsi, ropeMm, tolIn,
              orientation, 0.0, tiltDeg, outOfPlaneDeg
            );
            if (!result.checks.filter((c) => !c.vm).every((c) => c.ok)) break;
            if (result.checks.every((c) => c.ok) && result.fits.every((f) => f.ok)) {
              return {
                shackle_type: typ, shackle_size: size, wll_req: req, wll_min: wmin,
                t, R, Dh, b, h, hole, stepped_up: tried.slice(), result,
              };
            }
            b += step;
          }
        }
      }
      tried.push(tList.length
        ? `${size} (no stock plate ${pythonFixed(JAW_FILL_MIN * A, 3)}-${pythonFixed(A, 2)} in passes)`
        : `${size} (no stock plate between ${pythonFixed(JAW_FILL_MIN * A, 3)} and ${pythonFixed(A, 2)} in)`);
    }
    throw new Error("No single-plate design found. Tried: " + tried.join("; ") + ". Consider a stronger material.");
  }

  function num(data, key) {
    const value = Number(String(data[key] ?? "").replace(/,/g, "").trim());
    return Number.isFinite(value) ? value : NaN;
  }

  function plain(value) {
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    return value;
  }

  function score(data) {
    const mgw = num(data, "mgw");
    const nRaw = num(data, "n");
    const n = Number.isFinite(nRaw) ? Math.trunc(nRaw) : 0;
    const theta = num(data, "theta");
    const k = num(data, "k");
    const re = num(data, "re");
    const t = num(data, "t");
    const radius = num(data, "R");
    const dh = num(data, "Dh");
    const base = num(data, "b");
    const height = num(data, "h");
    const tc = num(data, "tc");
    const rc = num(data, "Rc");
    const weld = num(data, "w");
    const tilt = num(data, "tilt");
    const outOfPlane = num(data, "oop");
    const tol = num(data, "tol");
    const orientKey = data.orient || "vertical";
    const orientation = ORIENT_KEY[orientKey] || ORIENT_KEY.vertical;
    const ropeLabel = data.rope || "";
    const split = String(data.shackle || "").split(" ");
    const typ = split.length >= 2 ? split[0] : "";
    const size = split.length >= 2 ? split.slice(1).join(" ") : "";
    let block = "";
    let result = null;
    const shackleOk = typ in SHACKLES && size in SHACKLES[typ];
    if (!shackleOk) block = "Choose a shackle from the list.";
    else if (!(ropeLabel in ROPE_IN)) block = "Choose a rope size from the list.";
    else {
      const ropeMm = ROPE_IN[ropeLabel] * MM_PER_IN;
      try {
        result = run(
          mgw, n, theta, k, typ, size, t, radius, dh, base, height, tc, rc, weld, re, ropeMm, tol,
          orientation, 0.0, Number.isFinite(tilt) ? tilt : null, Number.isFinite(outOfPlane) ? outOfPlane : 0.0
        );
      } catch (err) {
        if (err instanceof Error) block = err.message;
        else throw err;
      }
    }
    const sh = shackleOk ? SHACKLES[typ][size] : null;
    if (block && sh === null) return { block, pass: null, rows: [], fits: [] };
    let rope = null;
    if (ropeLabel in ROPE_THIMBLE) {
      const thSize = ROPE_THIMBLE[ropeLabel];
      const [tD, tE] = G414_DE[thSize];
      rope = {
        dia: ROPE_IN[ropeLabel],
        thimble: thSize,
        H: CROSBY_G414_H.find((item) => item[2] === thSize)[3],
        tD, tE,
      };
    }
    const hole = sh ? tableHole(size, sh.B) : null;
    const payload = {
      block,
      pass: null,
      shackle: sh === null ? null : {
        type: typ, size, A: sh.A, B: sh.B, C: sh.C, D: sh.D, E: sh.E,
        wll_lb: sh.wll * LB_PER_T, tolC: CROSBY_TOL_C[size] || 0, approved: sh.dnv_ta,
      },
      rope,
      hole: hole === null ? null : { label: hole.label, dia: hole.dia, tool: hole.tool },
      rows: [],
      fits: [],
    };
    if (result === null) return payload;
    const rowsOut = result.checks.map((item) => ({
      name: item.name,
      value: plain(item.value),
      limit: plain(item.limit),
      util: plain(item.util),
      ok: Boolean(item.ok),
      info: item.info,
    }));
    const fits = result.fits.map((item) => ({ name: item.name, ok: Boolean(item.ok), text: item.text }));
    const scored = rowsOut.filter((row) => typeof row.util === "number");
    const governing = scored.reduce((best, row) => (best === null || row.util > best.util ? row : best), null);
    const P = result.rsl / 1000.0;
    const beta = 90.0 - result.angle_h;
    const phi = result.out_of_plane;
    const inPlane = P * Math.cos(phi * Math.PI / 180);
    const Fv = inPlane * Math.cos(beta * Math.PI / 180);
    const Fh = inPlane * Math.sin(beta * Math.PI / 180);
    Object.assign(payload, {
      pass: rowsOut.every((row) => row.ok) && fits.every((item) => item.ok),
      rsl: result.rsl,
      basis: result.load_basis,
      beta, delta: result.delta, tilt: result.tilt, allow: result.allow, Re: result.Re,
      gap: result.gap_min, rMin: result.R_min, rMax: result.R_max, tolEff: result.tol_eff,
      P_kip: P, Fv_kip: Fv, Fh_kip: Fh, N_kip: result.N, V_kip: result.V, Fop_kip: result.Fop,
      orient: orientKey, theta: result.angle_h, rows: rowsOut, fits,
      governing: governing ? governing.name : null,
      governingU: governing ? governing.util : null,
    });
    return payload;
  }

  function catalog() {
    const shackles = [];
    for (const typ of Object.keys(SHACKLES)) {
      for (const size of Object.keys(SHACKLES[typ])) {
        shackles.push({ value: `${typ} ${size}`, approved: SHACKLES[typ][size].dnv_ta });
      }
    }
    return { shackles, ropes: US_ROPE_SIZES.map((row) => row[0]) };
  }

  function blankSheet() {
    return {
      mgw: "50000", n: "2", theta: "60", k: "1", re: "50",
      orient: "laid", tilt: "30", oop: "0", rope: '1-3/8"', tol: "0",
      shackle: 'G-2130-OC 1-3/4"', t: "1.75", R: "4.0625", Dh: "2.125",
      b: "8.125", h: "4.0625", tc: "0.5", Rc: "2.03125", w: "0.5",
    };
  }

  return {
    ORIENTATIONS, LAID_OVER, SHACKLE_AUTO, SHACKLES, ROPE_IN, MM_PER_IN,
    run, designLoad, designPadEye, score, catalog, blankSheet, pythonFixed, pyStr,
    wllMinT, autoShackle, thimbleH, pyComma0, LB_PER_T, KG_PER_LB, US_ROPE_SIZES, ROPE_THIMBLE,
    tableHole, ceilStep, DESIGN_STEP_IN, PLATE_THICKNESSES, JAW_FILL_MIN,
  };
});
