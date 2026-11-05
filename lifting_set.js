/* DNV-ST-E271 lifting set selection (wire rope sling legs, thimble, shackle, master link, forerunner).
   Ported from 02_Builder/DNV 2.7-1 Structural Analysis/02_8-3_LiftingSet/02_8-3_LiftingSet.py (Rev 13):
   select_sling, select_thimble, select_shackle, select_master_link, forerunner_length, rope_wll_lb,
   and the leg requirement WLL = WLLmin x (T/W) x leg factor, which for a symmetric set reduces to
   WLLmin / (3 cos beta) for 4 legs and WLLmin / (2 cos beta) for 2 legs.
   It does not read a spreadsheet and does not call Python. Container footprint items (leg lengths,
   reach, set weight S) need the footprint and stay in the Python calc.
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
    const reachLen = Math.max(0.0, zMaster - 1300 / MM_PER_IN);
    const need = Math.max(apiLen, reachLen);
    return { api_d: row[0], api_len: apiLen, reach_len: reachLen, need, length: Math.ceil(need / 12 - 1e-9) * 12 };
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
    const fr = forerunner ? selectSling(wllMinT) : null;
    if (fr) {
      Object.assign(fr, forerunnerLength(fr.d_in, 0.0));
      fr.thimble = selectThimble(fr.d_in);
    }
    return {
      mgw_lb: mgwLb, n_legs: nLegs, angle_h: nLegs === 1 ? 90.0 : angleHDeg, beta: betaDeg,
      wll_min_t: wllMinT, wll_req_t: reqT, leg_factor: LEG_FACTOR[nLegs],
      leg, thimble: leg ? selectThimble(leg.d_in, sh) : null,
      shackle: sh, smallest_shackle: smallest,
      forerunner: fr,
      master_link: nLegs === 1 ? null : selectMasterLink(wllMinT),
      rope_spec: ROPE_SPEC,
    };
  }

  return { design, selectSling, selectMasterLink, selectThimble, selectShackle, ropeWllLb, forerunnerLength, US_ROPE_SIZES, tToLb, ROPE_SPEC };
});
