/* DNV-ST-E271 lifting set selection (wire rope sling legs, thimble, shackle, master link, forerunner).
   Ported from 02_Builder/DNV 2.7-1 Structural Analysis/02_8-3_LiftingSet/02_8-3_LiftingSet.py (Rev 13):
   select_sling, select_thimble, select_shackle, select_master_link, forerunner_length, rope_wll_lb,
   and the leg requirement WLL = WLLmin x (T/W) x leg factor, which for a symmetric set reduces to
   WLLmin / (3 cos beta) for 4 legs and WLLmin / (2 cos beta) for 2 legs.
   Leg lengths / forerunner reach use the same footprint geometry as Python
   (post_centres, hole_positions, lift_geometry, reach_check, forerunner_length).
   Needs calc.js (PadEye) loaded first. */
(function (root, factory) {
  const PadEye = (typeof module === "object" && module.exports) ? require("./calc.js") : root.PadEye;
  const api = factory(PadEye);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LiftingSet = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (PadEye) {
  "use strict";

  const MM_PER_IN = 25.4;
  const N_PER_LB = 4.4482216;
  const LB_PER_TONNE = 2204.6226218;
  const ROPE_K = 0.356, ROPE_RR = 1960.0, ROPE_KT = 0.9, ROPE_DF = 5.0;
  const DNV_MIN_DF = 5.0;
  const ML_MIN_INSIDE_IN = [270 / MM_PER_IN, 140 / MM_PER_IN];
  const ROPE_SPEC = "6x19 or 6x37 class EIPS IWRC GALV";
  const LEG_FACTOR = { 4: 4.0 / 3.0, 2: 1.0, 1: 1.0 };

  const REACH_MAX_IN = 1300 / MM_PER_IN;
  const ORIENTATIONS = [
    "Vertical (on top of corner post)",
    "Horizontal (inside face of corner post, toward centre)",
    "Laid over (on top of corner post, plate tilted in line with sling leg)",
  ];
  const LAID_OVER = ORIENTATIONS[2];
  const QUADRANTS = {
    "PE1 (+x,+y)": [+1, +1],
    "PE2 (-x,+y)": [-1, +1],
    "PE3 (-x,-y)": [-1, -1],
    "PE4 (+x,-y)": [+1, -1],
  };
  const SIDES_2LEG = {
    "PE1 (0,+y)": [0, +1],
    "PE2 (0,-y)": [0, -1],
  };
  const LAYOUTS = { "4-leg": QUADRANTS, "2-leg": SIDES_2LEG };
  const LIFT_SET_NAME = { 4: "4-leg", 2: "2-leg", 1: "1-leg" };


  const US_ROPE_SIZES = [
    ['1/2"', 0.5], ['9/16"', 0.5625], ['5/8"', 0.625], ['3/4"', 0.75], ['7/8"', 0.875],
    ['1"', 1.0], ['1-1/8"', 1.125], ['1-1/4"', 1.25], ['1-3/8"', 1.375], ['1-1/2"', 1.5],
    ['1-5/8"', 1.625], ['1-3/4"', 1.75], ['1-7/8"', 1.875], ['2"', 2.0], ['2-1/4"', 2.25],
    ['2-1/2"', 2.5],
  ];
  const API_TABLE_16 = [
    [0.5, 24], [0.5625, 26], [0.625, 28], [0.75, 33], [0.875, 39], [1.0, 42],
    [1.125, 48], [1.25, 54], [1.375, 60], [1.5, 66], [1.625, 72], [1.75, 78],
    [2.0, 96], [2.25, 105], [2.5, 120],
  ];
  // [stock, WLL lb, G100 chain, G80 chain, A, B, C]
  const CROSBY_A1346 = [
    ["1256865", 7000, "-", "6mm", 0.51, 2.36, 4.72],
    ["1256868", 9000, "6mm", "6mm", 0.67, 3.54, 6.30],
    ["1256874", 9200, "6mm", "9/32", 0.75, 3.54, 6.30],
    ["1256878", 15400, "5/16, 9/32", "5/16", 0.87, 3.94, 7.09],
    ["1256880", 15400, "5/16, 9/32", "5/16", 0.87, 5.71, 10.83],
    ["1256876", 18700, "5/16", "3/8", 0.87, 3.94, 7.09],
    ["1256882", 19600, "5/16", "3/8", 0.98, 4.53, 8.27],
    ["1256892", 19600, "5/16", "3/8", 0.98, 5.71, 10.83],
    ["1256917", 31900, "3/8", "1/2", 1.10, 5.71, 10.83],
    ["1256926", 37400, "3/8", "1/2", 1.26, 5.71, 10.83],
    ["1256929", 52000, "1/2", "5/8", 1.42, 6.10, 11.22],
    ["1256930", 61900, "5/8", "5/8", 1.57, 5.51, 10.63],
    ["1256953", 84400, "5/8", "3/4", 1.77, 7.09, 13.39],
    ["1256958", 99200, "3/4", "7/8", 2.01, 8.46, 15.35],
    ["1256973", 147600, "7/8", "1", 2.17, 7.99, 15.98],
  ];
  // [rope label, stock, D (inside width, bow passes), E (overall width)]
  const CROSBY_G414 = [
    ['1/4"', "1037639", 0.88, 0.44], ['5/16"', "1037657", 1.06, 0.55], ['3/8"', "1037675", 1.13, 0.66],
    ['7/16"', "1037693", 1.25, 0.74], ['1/2-9/16"', "1037719", 1.50, 0.92], ['5/8"', "1037755", 1.75, 1.03],
    ['3/4"', "1037773", 2.01, 1.30], ['7/8"', "1037791", 2.24, 1.47], ['1"', "1037817", 2.50, 1.75],
    ['1-1/8-1-1/4"', "1037835", 2.87, 1.88], ['1-1/4-1-3/8"', "1037853", 3.50, 2.25],
    ['1-3/8-1-1/2"', "1037871", 3.50, 2.62], ['1-5/8"', "1037899", 4.02, 3.00],
    ['1-3/4"', "1037915", 4.49, 3.06], ['1-7/8-2"', "1037933", 5.98, 3.38], ['2-1/4"', "1037951", 7.01, 3.88],
  ];
  const ROPE_THIMBLE = PadEye.ROPE_THIMBLE;

  function tToLb(t) { return t * LB_PER_TONNE; }
  function dnvWllT(wll, df) { return wll * Math.min(1.0, df / DNV_MIN_DF); }
  function ropeWllLb(dIn) {
    const blN = ROPE_K * ROPE_RR * (dIn * MM_PER_IN) ** 2;
    return blN * ROPE_KT / ROPE_DF / N_PER_LB;
  }
  function selectSling(wllReqT) {
    const reqLb = tToLb(wllReqT);
    for (const [label, dIn] of US_ROPE_SIZES) {
      const wllLb = ropeWllLb(dIn);
      if (wllLb >= reqLb) return { size: label, d_in: dIn, wll_lb: wllLb, util: reqLb / wllLb };
    }
    return null;
  }
  function ropeByLabel(label) {
    const row = US_ROPE_SIZES.find((r) => r[0] === label);
    return row ? { size: row[0], d_in: row[1], wll_lb: ropeWllLb(row[1]) } : null;
  }
  function selectMasterLink(wllReqT) {
    const reqLb = tToLb(wllReqT);
    for (const [stock, wllLb, g100, g80, A, B, C] of CROSBY_A1346) {
      if (wllLb >= reqLb) {
        return {
          stock, wll_lb: wllLb, g100, g80, A, B, C, util: reqLb / wllLb,
          inside_ok: C >= ML_MIN_INSIDE_IN[0] - 0.005 && B >= ML_MIN_INSIDE_IN[1] - 0.005,
        };
      }
    }
    return null;
  }
  function selectThimble(ropeIn, shackle) {
    const rope = US_ROPE_SIZES.find((r) => Math.abs(r[1] - ropeIn) < 1e-6);
    const want = rope ? ROPE_THIMBLE[rope[0]] : undefined;
    for (const [label, stock, D, E] of CROSBY_G414) {
      if (label === want) {
        const th = { rope_in: label, stock, D, E };
        if (shackle) {
          th.bow_fits = shackle.D <= D;
          th.width_fits = E <= shackle.E;
        }
        return th;
      }
    }
    return null;
  }
  function shackleEntry(type, row, wllReqT) {
    const wllDnv = dnvWllT(row.wll, 6.0);
    return Object.assign({}, row, {
      type, wll_dnv: wllDnv, utilisation: wllReqT / wllDnv,
      pin_max: row.B * 1.03, hole_max: row.B * 1.06,
    });
  }
  /** Smallest shackle (02's select_shackle). Thimble given: sizes it does not fit are skipped. */
  function selectShackle(wllReqT, thimble) {
    let first = null;
    const skipped = [];
    for (const type of Object.keys(PadEye.SHACKLES)) {
      for (const row of Object.values(PadEye.SHACKLES[type])) {
        if (dnvWllT(row.wll, 6.0) >= wllReqT) {
          const sh = shackleEntry(type, row, wllReqT);
          sh.stepped_up = skipped.slice();
          first = first || sh;
          if (!thimble || (row.D <= thimble.D && thimble.E <= row.E)) return sh;
          skipped.push(row.size);
        }
      }
    }
    return first;
  }
  function forerunnerLength(dIn, zMaster) {
    let row = API_TABLE_16.find((r) => r[0] >= dIn - 1e-9);
    if (!row) row = API_TABLE_16[API_TABLE_16.length - 1];
    const apiLen = row[1];
    const reachLen = Math.max(0.0, zMaster - REACH_MAX_IN);
    const need = Math.max(apiLen, reachLen);
    return {
      api_d: row[0], api_len: apiLen, reach_len: reachLen, need,
      length: Math.ceil(need / 12 - 1e-9) * 12,
      governs: apiLen >= reachLen ? "API 2CCU Table 16" : "51.2 in reach [8.3.1]",
    };
  }

  function postCentres(L, B, sxM, syM, sxP, syP, layout) {
    const sizes = { [-1]: [sxM, syM], [1]: [sxP, syP] };
    const out = {};
    const side = Object.values(layout).every(([sx]) => sx === 0);
    const beam = (syM + syP) / 2.0;
    for (const [name, [sx, sy]] of Object.entries(layout)) {
      if (side) {
        out[name] = [0.0, sy * (B / 2.0 - beam / 2.0), beam, beam];
        continue;
      }
      const [sizeX, sizeY] = sizes[sx];
      out[name] = [sx * (L / 2 - sizeX / 2), sy * (B / 2 - sizeY / 2), sizeX, sizeY];
    }
    return out;
  }

  function holePositions(posts, orientation) {
    const holes = {}, sFace = {};
    for (const [name, [px, py, sizeX, sizeY]] of Object.entries(posts)) {
      if (orientation === ORIENTATIONS[0] || orientation === LAID_OVER) {
        holes[name] = [px, py]; sFace[name] = 0.0;
        continue;
      }
      const d = Math.hypot(px, py);
      const ux = -px / d, uy = -py / d;
      const sx = ux ? (sizeX / 2) / Math.abs(ux) : Infinity;
      const sy = uy ? (sizeY / 2) / Math.abs(uy) : Infinity;
      const s = Math.min(sx, sy);
      holes[name] = [px + s * ux, py + s * uy];
      sFace[name] = s;
    }
    return [holes, sFace];
  }

  function verticalShares(W, holes, layout, xg, yg) {
    const entries = Object.entries(layout);
    if (entries.every(([, [sx]]) => sx === 0)) {
      const ySide = {};
      for (const [name, [, sy]] of entries) ySide[sy] = holes[name][1];
      const yM = ySide[-1], yP = ySide[1];
      if (!(yM < yg && yg < yP)) throw new Error("CoG lies outside the pad eyes along y.");
      const Wside = { 1: W * (yg - yM) / (yP - yM) };
      Wside[-1] = W - Wside[1];
      const V = {};
      for (const [name, [, sy]] of entries) V[name] = Wside[sy];
      return V;
    }
    const xEnd = {};
    for (const [name, [sx]] of entries) xEnd[sx] = holes[name][0];
    const xM = xEnd[-1], xP = xEnd[1];
    if (!(xM < xg && xg < xP)) throw new Error("CoG lies outside the pad eyes along x.");
    const Wend = { 1: W * (xg - xM) / (xP - xM) };
    Wend[-1] = W - Wend[1];
    const V = {};
    for (const [name, [sx, sy]] of entries) {
      if (sy === 0) { V[name] = Wend[sx]; continue; }
      const b = Math.abs(holes[name][1]);
      if (Math.abs(yg) >= b) throw new Error("CoG lies outside the pad eyes along y.");
      V[name] = Wend[sx] / 2 * (1 + sy * yg / b);
    }
    return V;
  }

  function hookHeightForMaxAngle(holes, xg, yg, betaMaxDeg) {
    let rMax = 0;
    for (const [hx, hy] of Object.values(holes)) rMax = Math.max(rMax, Math.hypot(hx - xg, hy - yg));
    return rMax / Math.tan(betaMaxDeg * Math.PI / 180);
  }

  function liftGeometry(mgwLb, holes, xg, yg, angleHDeg, liftSet) {
    const h = hookHeightForMaxAngle(holes, xg, yg, 90.0 - angleHDeg);
    const layout = LAYOUTS[liftSet];
    const V = verticalShares(mgwLb, holes, layout, xg, yg);
    const wllMin = PadEye.wllMinT(mgwLb * PadEye.KG_PER_LB);
    const names = Object.keys(layout);
    let cx = 0, cy = 0;
    for (const [hx, hy] of Object.values(holes)) { cx += hx; cy += hy; }
    cx /= names.length; cy /= names.length;
    const legs = [];
    for (const name of names) {
      const [hx, hy] = holes[name];
      const dx = xg - hx, dy = yg - hy;
      const r = Math.hypot(dx, dy);
      const beta = Math.atan2(r, h) * 180 / Math.PI;
      const T = V[name] / Math.cos(beta * Math.PI / 180);
      const lf = liftSet === "4-leg" ? LEG_FACTOR[4] : LEG_FACTOR[2];
      legs.push({
        name, x: hx, y: hy,
        L: Math.hypot(r, h), beta, angle_h: 90.0 - beta,
        bearing: Math.atan2(dy, dx) * 180 / Math.PI,
        V: V[name], T,
        wll_req_t: wllMin * (T / mgwLb) * lf,
        angle_ok: 90.0 - beta >= 45.0 - 1e-9,
      });
    }
    return {
      mgw_lb: mgwLb, xg, yg, ex: xg - cx, ey: yg - cy, h,
      angle_h: angleHDeg, lift_set: liftSet, n_legs: Object.keys(holes).length,
      wll_min_t: wllMin, legs,
      governing: legs.reduce((a, b) => (a.wll_req_t >= b.wll_req_t ? a : b)),
      equal_legs: Math.max(...legs.map((g) => g.L)) - Math.min(...legs.map((g) => g.L)) < 0.01,
      sum_V: legs.reduce((s, g) => s + g.V, 0),
    };
  }

  function reachCheck(zPe, legs, L, B) {
    const longSideY = L >= B;
    const out = [];
    for (const g of legs) {
      const d = longSideY ? B / 2 - Math.abs(g.y) : L / 2 - Math.abs(g.x);
      out.push([Math.max(0.0, zPe - (g.L - d)), d, g.name]);
    }
    out.sort((a, b) => b[0] - a[0]);
    const [zReach, dEdge, name] = out[0];
    return { z_reach: zReach, d_edge: dEdge, leg: name, side: longSideY ? "y = +/-B/2" : "x = +/-L/2" };
  }

  /** Build geo (and optional laid-over hole move) exactly as Python run(). */
  function computeGeo(opts) {
    const {
      mgwLb, nLegs, angleHDeg, L, B, sxM, syM, sxP, syP, xg, yg,
      orientation, hLo, tiltLo,
    } = opts;
    if (!(nLegs === 2 || nLegs === 4) || L == null || B == null) return null;
    const liftSet = LIFT_SET_NAME[nLegs];
    const orient = orientation || ORIENTATIONS[0];
    const posts = postCentres(L, B, sxM ?? 6, syM ?? 6, sxP ?? 6, syP ?? 6, LAYOUTS[liftSet]);
    let [holes, sFace] = holePositions(posts, orient);
    let geo = liftGeometry(mgwLb, holes, xg ?? 0, yg ?? 0, angleHDeg, liftSet);
    if (orient === LAID_OVER) {
      const hlo = hLo;
      if (hlo == null || hlo < 0) throw new Error("Laid-over pad eye: enter the hole centre to base along the plate.");
      for (let i = 0; i < 8; i++) {
        const neu = {};
        for (const g of geo.legs) {
          const [px, py] = posts[g.name];
          const dx = (xg ?? 0) - px, dy = (yg ?? 0) - py;
          const r = Math.hypot(dx, dy);
          const off = hlo * Math.sin((tiltLo == null ? g.beta : tiltLo) * Math.PI / 180);
          neu[g.name] = r ? [px + off * dx / r, py + off * dy / r] : [px, py];
        }
        holes = neu;
        geo = liftGeometry(mgwLb, holes, xg ?? 0, yg ?? 0, angleHDeg, liftSet);
      }
    }
    geo.orientation = orient;
    geo.L = L; geo.B = B; geo.s_face = sFace; geo.h_lo = hLo;
    geo.sizes = { "-x": [sxM ?? 6, syM ?? 6], "+x": [sxP ?? 6, syP ?? 6] };
    geo.seat = {};
    for (const name of Object.keys(posts)) geo.seat[name] = posts[name].slice(0, 2);
    return geo;
  }

  /** nLegs 4, 2 or 1 (single pad eye, single leg). angleHDeg from horizontal; k asymmetry factor.
      shackle: "G-2130-OC 1-3/4\"" (the shackle the pad eye design settled on) or null.
      ropeLabel: null = smallest rope that carries the leg load. */
  function design(opts) {
    const { mgwLb, nLegs, angleHDeg, k, forerunner, shackle, ropeLabel } = opts;
    if (!(nLegs in LEG_FACTOR)) throw new Error("Lifting set: 1, 2 or 4 legs.");
    const kk = k === undefined || k === null ? 1.0 : k;
    const wllMinT = PadEye.wllMinT(mgwLb * PadEye.KG_PER_LB);
    let reqT;
    let betaDeg = 0;
    if (nLegs === 1) {
      reqT = wllMinT * kk;
    } else {
      betaDeg = 90.0 - angleHDeg;
      const T_over_W = (1 / nLegs) / Math.cos(betaDeg * Math.PI / 180);
      reqT = wllMinT * T_over_W * LEG_FACTOR[nLegs] * kk;
    }
    let leg;
    if (ropeLabel) {
      leg = ropeByLabel(ropeLabel);
      if (!leg) throw new Error("Unknown rope size.");
      leg.util = tToLb(reqT) / leg.wll_lb;
      leg.too_small = leg.wll_lb < tToLb(reqT);
    } else {
      leg = selectSling(reqT);
    }
    const legThimble = leg ? selectThimble(leg.d_in) : null;
    let smallest = selectShackle(reqT, legThimble);
    let sh = null;
    if (shackle) {
      const sp = shackle.indexOf(" ");
      const type = shackle.slice(0, sp), size = shackle.slice(sp + 1);
      sh = shackleEntry(type, PadEye.SHACKLES[type][size], reqT);
    } else {
      sh = smallest;
    }
    let geo = null;
    let reach = null;
    try {
      if (opts.L != null && opts.B != null && (nLegs === 2 || nLegs === 4)) {
        geo = computeGeo(opts);
      }
    } catch (e) {
      geo = { error: String(e && e.message || e), legs: [] };
    }
    let fr = null;
    if (forerunner) {
      if (opts.foreLabel) {
        fr = ropeByLabel(opts.foreLabel);
        if (fr) { fr.util = tToLb(wllMinT) / fr.wll_lb; fr.too_small = fr.wll_lb < tToLb(wllMinT); fr.picked = true; }
      }
      if (!fr) fr = selectSling(wllMinT);
    }
    if (fr) {
      let zMaster = 0.0;
      if (geo && geo.legs && geo.legs.length && opts.zPe != null) {
        reach = reachCheck(opts.zPe, geo.legs, opts.L, opts.B);
        zMaster = reach.z_reach;
      }
      Object.assign(fr, forerunnerLength(fr.d_in, zMaster));
      fr.thimble = selectThimble(fr.d_in);
      fr.auto_length = fr.length;
      if (Number.isFinite(opts.foreLenIn) && opts.foreLenIn > 0) {
        fr.length = opts.foreLenIn; fr.len_set = true; fr.len_util = fr.need / opts.foreLenIn;
      }
      if (reach) fr.z_top = Math.max(0.0, reach.z_reach - fr.length);
    }
    let ml = nLegs === 1 ? null : selectMasterLink(wllMinT);
    const mlAuto = ml;
    if (nLegs !== 1 && opts.mlStock) {
      const row = CROSBY_A1346.find((r) => r[0] === opts.mlStock);
      if (row) {
        const [stock, wllLb, g100, g80, A, B, C] = row;
        ml = { stock, wll_lb: wllLb, g100, g80, A, B, C, util: tToLb(wllMinT) / wllLb, picked: true,
          inside_ok: C >= ML_MIN_INSIDE_IN[0] - 0.005 && B >= ML_MIN_INSIDE_IN[1] - 0.005 };
      }
    }
    let slingSet = null;
    if (Number.isFinite(opts.slingLenIn) && opts.slingLenIn > 0 && geo && geo.legs && geo.legs.length) {
      const need = Math.max(...geo.legs.map((g) => g.L));
      slingSet = { L: opts.slingLenIn, need, util: need / opts.slingLenIn };
    }
    return {
      mgw_lb: mgwLb, n_legs: nLegs, angle_h: nLegs === 1 ? 90.0 : angleHDeg, beta: betaDeg,
      wll_min_t: wllMinT, wll_req_t: reqT, leg_factor: LEG_FACTOR[nLegs],
      leg, thimble: leg ? selectThimble(leg.d_in, sh) : null,
      shackle: sh, smallest_shackle: smallest,
      forerunner: fr,
      master_link: ml, master_link_auto: mlAuto, sling_set: slingSet,
      rope_spec: ROPE_SPEC,
      geo, reach, z_pe: opts.zPe == null ? null : opts.zPe,
    };
  }


  const NUMBER_WORDS = { 1: "one", 2: "two", 4: "four" };

  function comma0(n) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
    return Math.round(Number(n)).toLocaleString("en-US");
  }
  function fracIn(x) {
    const eighths = Math.round(Number(x) * 8);
    let whole = Math.floor(eighths / 8), rem = eighths % 8;
    if (rem === 0) return `${whole}"`;
    let num = rem, den = 8;
    while (num % 2 === 0) { num /= 2; den /= 2; }
    return whole ? `${whole}-${num}/${den}"` : `${num}/${den}"`;
  }
  function ftIn(x) {
    // Python ft_in: inches -> 'F ft I in' after round-to-nearest-inch
    let inches = Math.round(Number(x));
    const ft = Math.floor(inches / 12), rem = inches - ft * 12;
    return `${ft} ft ${rem} in`;
  }
  function ftInShort(x) {
    // Python ft_in_short: 8' or 11'6"
    let inches = Math.round(Number(x));
    const ft = Math.floor(inches / 12), rem = inches - ft * 12;
    return rem === 0 ? `${ft}'` : `${ft}'${rem}"`;
  }
  function legLengthLabel(g) {
    return `${Number(g.L).toFixed(1)} in (${String(g.name).slice(0, 3)})`;
  }
  function slingLegLengthText(r) {
    if (!r || !r.geo || !r.geo.legs || !r.geo.legs.length) return "";
    const shorts = r.geo.legs.map((g) => ftInShort(g.L));
    if (new Set(shorts).size === 1) return shorts[0];
    return shorts.map((t, i) => `${t} (${String(r.geo.legs[i].name).slice(0, 3)})`).join(" / ");
  }

  /** One-sentence description (Python summary_sentence). */
  function summarySentence(r) {
    if (!r) return "";
    const n = r.n_legs, nWord = NUMBER_WORDS[n] || String(n);
    const leg = r.leg, fr = r.forerunner, ml = r.master_link, sh = r.shackle;
    const wllMinLb = tToLb(r.wll_min_t);
    const parts = [];
    const missing = [];
    let lengthPhrase = "lengths not sized on this page";
    if (r.geo && r.geo.legs && r.geo.legs.length) {
      const lengths = r.geo.legs.map(legLengthLabel);
      lengthPhrase = lengths.length === 1 ? `lengths ${lengths[0]}`
        : `lengths ${lengths.slice(0, -1).join(", ")} and ${lengths[lengths.length - 1]}`;
    } else if (r.geo && r.geo.error) {
      lengthPhrase = `lengths unavailable (${r.geo.error})`;
    }
    if (leg) {
      parts.push(`${nWord} ${leg.size} ${ROPE_SPEC} wire rope legs to EN 13414-1 [8.3.3.2], ${lengthPhrase}, with ferrule-secured eyes to EN 13411-3 and Crosby G-414 thimbles`);
    } else missing.push("wire rope legs");
    if (fr) {
      parts.push(`a ${fr.size} ${ROPE_SPEC} wire rope forerunner, length ${ftIn(fr.length)}, with ferrule-secured eyes and Crosby G-414 thimbles`);
    }
    if (ml) {
      const onePer = n === 2 ? ", one leg per sublink" : "";
      parts.push(`a Crosby A-1346 Grade 100 master link assembly to EN 1677-4, stock ${ml.stock} (WLL ${comma0(ml.wll_lb)} lb)${onePer}`);
    } else if (n !== 1) missing.push("master link");
    if (sh) {
      const shName = sh.dnv_ta ? sh.type : "G-2130";
      parts.push(`${nWord} Crosby ${shName} ${sh.size} bolt-type shackles with hex nut and split pin, stock ${sh.stock} (WLL ${comma0(tToLb(sh.wll))} lb)`);
    } else missing.push("shackles");
    let certs = ("all components DNV type approved [8.2] with 3.1 material certificates and "
      + "Charpy impact testing to 31 ft-lb average at -4 F [8.4], and the assembled "
      + "lifting set certified to [8.6] and marked to [8.7]");
    if (sh && !sh.dnv_ta) {
      certs += "; the shackles are NOT type approved and require a DNV product certificate [8.2]";
    }
    if (!parts.length) {
      return `Lifting set for R = ${comma0(r.mgw_lb)} lb: components not available (${missing.join(", ") || "see warnings"}).`;
    }
    const body = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
    let s = (`${nWord.charAt(0).toUpperCase() + nWord.slice(1)}-leg wire rope lifting set rated for `
      + `R = ${comma0(r.mgw_lb)} lb with a minimum working load limit of `
      + `${comma0(wllMinLb)} lb per DNV-ST-E271 Table 8-1, `
      + `consisting of ${body}; requires ${certs}.`);
    if (missing.length) s += ` Missing on this page: ${missing.join(", ")}.`;
    return s;
  }

  /** One-line order description (Python order_line). */
  function orderLine(r) {
    if (!r) return "";
    const leg = r.leg, fr = r.forerunner, ml = r.master_link, sh = r.shackle;
    if (!(leg && ml && sh)) {
      return "Not available — a component exceeds its catalogue range (see warnings).";
    }
    let lengthPart = "(leg lengths not sized on this page)";
    if (r.geo && r.geo.legs && r.geo.legs.length) {
      let lengths = r.geo.legs.map((g) => ftInShort(g.L));
      if (new Set(lengths).size > 1) {
        lengths = lengths.map((t, i) => `${t} (${String(r.geo.legs[i].name).slice(0, 3)})`);
      }
      // unique preserve order like dict.fromkeys
      const uniq = [];
      for (const t of lengths) if (!uniq.includes(t)) uniq.push(t);
      lengthPart = uniq.join(" / ");
    }
    let sling = `${leg.size} × ${lengthPart} DNVGL-ST-E271 Type Approved ${r.n_legs}-Leg Sling`;
    if (fr) {
      sling += ` with ${fr.size} × ${ftInShort(fr.length)} Forerunner`;
    }
    const shName = sh.dnv_ta ? "G2130-OC" : "G2130";
    const shCert = sh.dnv_ta ? "" : " (DNV product certificate)";
    return (`${sling} on ${fracIn(ml.A)} A1346 Crosby Sub Assembly `
      + `(stock ${ml.stock}), HDTS all ends, ${sh.size} ${shName} Crosby BTA `
      + `shackles${shCert} on bottoms, captivated`);
  }

  return {
    design, CROSBY_A1346, selectSling, selectMasterLink, selectThimble, selectShackle, ropeWllLb,
    forerunnerLength, computeGeo, liftGeometry, reachCheck, ftIn, ftInShort, slingLegLengthText,
    US_ROPE_SIZES, tToLb, ROPE_SPEC, summarySentence, orderLine, ORIENTATIONS, LAID_OVER,
  };
});

