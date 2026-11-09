/* Shared flat illustrations for landing + overview pages (copied from app.js). */
window.PreArt = (function () {
  // Flat vector person built from joints: [head, neck, hip, lElbow, lHand, rElbow, rHand, lKnee, lFoot, rKnee, rFoot]
  // "r" limbs are drawn first in a deeper tone so the figure reads as 3-D.
  const PAL = [
    { shirt: "#e9785a", shorts: "#2c3a4a", skin: "#f0bf9a", hair: "#2a1f1b", bun: 1 },
    { shirt: "#3d84a8", shorts: "#26323b", skin: "#c98a62", hair: "#1d1612" },
    { shirt: "#7c6bd6", shorts: "#2c3a4a", skin: "#e9b08b", hair: "#3b2a20", bun: 1 },
    { shirt: "#2f9e6e", shorts: "#3a3f4a", skin: "#b97a54", hair: "#15110e" },
  ];
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.round(c * k).toString(16).padStart(2, "0"); return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); }
  // ---- flat 2D person: filled body shapes (torso, sleeves, shorts, tapered limbs, hands, shoes, face) built from joints ----
  const f1 = (v) => v.toFixed(1);
  const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const circ = (c, r) => `M${f1(c[0] - r)} ${f1(c[1])}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`;
  const ell = (c, rx, ry) => `M${f1(c[0] - rx)} ${f1(c[1])}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0`;
  function limb(a, b, wa, wb) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
    return `M${f1(a[0] + px * wa / 2)} ${f1(a[1] + py * wa / 2)}L${f1(b[0] + px * wb / 2)} ${f1(b[1] + py * wb / 2)}L${f1(b[0] - px * wb / 2)} ${f1(b[1] - py * wb / 2)}L${f1(a[0] - px * wa / 2)} ${f1(a[1] - py * wa / 2)}Z${circ(a, wa / 2)}${circ(b, wb / 2)}`;
  }
  // returns [{d, fill?, stroke?, sw?, op?}] in paint order; the count never changes so animation can reuse the elements
  // ---- skeleton with fixed, realistic bone lengths (≈ 7 heads tall; legs longer than torso; fingertips reach mid-thigh).
  // Every pose / motion frame is rebuilt from bone directions so proportions never drift; standing feet stay on the floor.
  const BONE = { torso: 30, head: 10.5, thigh: 20.5, shin: 20, ua: 15, fa: 13 };
  function normalizePose(J) {
    const [h, n, hp, le, lh, re, rh, lk, lf, rk, rf] = J;
    const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
    const add = (a, d, l) => [a[0] + d[0] * l, a[1] + d[1] * l];
    const frame = (nn, hh) => { const d = dir(nn, hh); return { px: -d[1], py: d[0], ux: d[0], uy: d[1] }; };
    const o = frame(n, hp), shO = (sd) => [n[0] + o.px * sd + o.ux * 2.5, n[1] + o.py * sd + o.uy * 2.5], hiO = (sd) => [hp[0] + o.px * sd + o.ux * 2.5, hp[1] + o.py * sd + o.uy * 2.5];
    const N = add(hp, dir(hp, n), BONE.torso), f2 = frame(N, hp);
    const shN = (sd) => [N[0] + f2.px * sd + f2.ux * 2.5, N[1] + f2.py * sd + f2.uy * 2.5], hiN = (sd) => [hp[0] + f2.px * sd + f2.ux * 2.5, hp[1] + f2.py * sd + f2.uy * 2.5];
    const H = add(N, dir(n, h), BONE.head);
    const LE = add(shN(10), dir(shO(10), le), BONE.ua), LH = add(LE, dir(le, lh), BONE.fa);
    const RE = add(shN(-10), dir(shO(-10), re), BONE.ua), RH = add(RE, dir(re, rh), BONE.fa);
    const LK = add(hiN(5.6), dir(hiO(5.6), lk), BONE.thigh), LF = add(LK, dir(lk, lf), BONE.shin);
    const RK = add(hiN(-5.6), dir(hiO(-5.6), rk), BONE.thigh), RF = add(RK, dir(rk, rf), BONE.shin);
    let out = [H, N, hp, LE, LH, RE, RH, LK, LF, RK, RF];
    const origFoot = Math.max(lf[1], rf[1]), newFoot = Math.max(LF[1], RF[1]);
    if (origFoot > 80) { const dy = origFoot - newFoot; out = out.map((q) => [q[0], q[1] + dy]); }
    return out;
  }
  // returns [{d, fill?, stroke?, sw?, op?}] in paint order; the count never changes so animation can reuse the elements
  function bodyParts(J0, c) {
    const J = normalizePose(J0);
    const [h, n, hp, le, lh, re, rh, lk, lf, rk, rf] = J;
    const ax = hp[0] - n[0], ay = hp[1] - n[1], L = Math.hypot(ax, ay) || 1, ux = ax / L, uy = ay / L, px = -uy, py = ux;
    const off = (p, sd, t = 0) => [p[0] + px * sd + ux * t, p[1] + py * sd + uy * t];
    const sk = c.skin, skB = shade(sk, 0.9), sh = c.shirt, shB = shade(sh, 0.85), pa = c.shorts, paB = shade(pa, 0.8), hair = c.hair;
    const shL = off(n, 10, 2.5), shR = off(n, -10, 2.5), hiL = off(hp, 5.6, 2.5), hiR = off(hp, -5.6, 2.5);
    const P = [], pt = (q) => `${f1(q[0])} ${f1(q[1])}`;
    const hand = (e, hd) => { const dx = hd[0] - e[0], dy = hd[1] - e[1], l = Math.hypot(dx, dy) || 1; return [hd[0] + dx / l * 1.6, hd[1] + dy / l * 1.6]; };
    const arm = (s, e, hd, front) => { const k = front ? sk : skB, sl = front ? sh : shB;
      P.push({ d: limb(e, hd, 4.4, 3.4), fill: k }, { d: limb(s, e, 5.6, 4.4), fill: k }, { d: limb(s, lerpP(s, e, 0.42), 7.2, 6.2), fill: sl }, { d: ell(hand(e, hd), 2.3, 2.8), fill: k }); };
    const leg = (hi, k, f, front) => { const kk = front ? sk : skB, p2 = front ? pa : paB, calf = lerpP(k, f, 0.38);
      P.push({ d: limb(k, calf, 6.4, 6.6) + limb(calf, f, 6.6, 4.2), fill: kk }, { d: limb(hi, k, 9.2, 6.6), fill: p2 }, { d: limb(k, lerpP(k, f, 0.62), 6.8, 5.6), fill: p2 },
        { d: `M${f1(f[0] - 4.3)} ${f1(f[1] + 3.3)}h8.6v1.4h-8.6z`, fill: "#f4f4f4" }, { d: ell([f[0], f[1] + 1.7], 4.3, 2.4), fill: front ? "#2a3240" : "#353d4c" }); };
    P.push({ d: ell([(lf[0] + rf[0]) / 2, Math.max(lf[1], rf[1]) + 4.8], 17, 2.2), fill: "#000", op: Math.max(lf[1], rf[1]) > 70 ? 0.1 : 0 });
    arm(shR, re, rh, false); leg(hiR, rk, rf, false);
    // pelvis (pants) + shirt: shoulders -> chest -> waist -> hem
    const hemL = off(hp, 9.2, 1.5), hemR = off(hp, -9.2, 1.5);
    P.push({ d: `M${pt(off(hp, 9.2, -1))}L${pt(off(hp, 10, 6))}Q${pt(off(hp, 0, 8.5))} ${pt(off(hp, -10, 6))}L${pt(off(hp, -9.2, -1))}Z`, fill: pa });
    const chL = off(n, 9.6, 8), chR = off(n, -9.6, 8), wL = off(n, 7.6, 19), wR = off(n, -7.6, 19);
    P.push({ d: `M${pt(shL)}Q${pt(off(n, 3.5, 0.4))} ${pt(off(n, 0, 1.2))}Q${pt(off(n, -3.5, 0.4))} ${pt(shR)}Q${pt(off(n, -11.4, 4))} ${pt(chR)}Q${pt(off(n, -8.6, 14))} ${pt(wR)}L${pt(hemR)}Q${pt(off(hp, 0, 2.6))} ${pt(hemL)}L${pt(wL)}Q${pt(off(n, 8.6, 14))} ${pt(chL)}Q${pt(off(n, 11.4, 4))} ${pt(shL)}Z`, fill: sh });
    P.push({ d: `M${pt(off(n, 3, 0.8))}Q${pt(off(n, 0, 3.6))} ${pt(off(n, -3, 0.8))}`, stroke: shade(sh, 0.72), sw: 1.1 });
    P.push({ d: `M${pt(off(n, 0, 9))}L${pt(off(n, 0, 24))}`, stroke: shade(sh, 0.9), sw: 0.6, op: 0.6 });
    leg(hiL, lk, lf, true);
    // neck + head (≈ 1/7 of height)
    P.push({ d: limb(lerpP(h, n, 0.62), off(n, 0, 1.2), 4, 4.6), fill: skB });
    P.push({ d: c.bun ? circ([h[0], h[1] - 6.6], 3.2) : "M0 0", fill: hair });
    P.push({ d: circ([h[0] - 5.6, h[1] + 0.8], 1.3) + circ([h[0] + 5.6, h[1] + 0.8], 1.3), fill: skB });
    P.push({ d: ell(h, 5.7, 6.7), fill: sk });
    P.push({ d: `M${f1(h[0] - 6)} ${f1(h[1] + 0.6)}C${f1(h[0] - 6.6)} ${f1(h[1] - 7.6)} ${f1(h[0] + 6.6)} ${f1(h[1] - 7.6)} ${f1(h[0] + 6)} ${f1(h[1] + 0.6)}C${f1(h[0] + 4.4)} ${f1(h[1] - 3.4)} ${f1(h[0] + 0.8)} ${f1(h[1] - 4.2)} ${f1(h[0] - 2)} ${f1(h[1] - 2.6)}C${f1(h[0] - 3.6)} ${f1(h[1] - 1.8)} ${f1(h[0] - 4.9)} ${f1(h[1] - 0.8)} ${f1(h[0] - 6)} ${f1(h[1] + 0.6)}Z`, fill: hair });
    P.push({ d: `M${f1(h[0] - 3.4)} ${f1(h[1] - 0.9)}l2 -0.4M${f1(h[0] + 3.4)} ${f1(h[1] - 0.9)}l-2 -0.4`, stroke: hair, sw: 0.7 });
    P.push({ d: ell([h[0] - 2.2, h[1] + 0.9], 0.72, 0.92) + ell([h[0] + 2.2, h[1] + 0.9], 0.72, 0.92), fill: "#2a1f1b" });
    P.push({ d: circ([h[0] - 3.5, h[1] + 3], 1.1) + circ([h[0] + 3.5, h[1] + 3], 1.1), fill: "#f08a7a", op: 0.35 });
    P.push({ d: `M${f1(h[0])} ${f1(h[1] + 1.6)}l-0.5 1.5h1`, stroke: shade(sk, 0.68), sw: 0.55 });
    P.push({ d: `M${f1(h[0] - 1.7)} ${f1(h[1] + 3.8)}q1.7 1.3 3.4 0`, stroke: "#8a3b2b", sw: 0.8 });
    arm(shL, le, lh, true);
    return P;
  }
  const partSVG = (q, i) => `<path${i != null ? ` data-p="${i}"` : ""} d="${q.d}" ${q.fill ? `fill="${q.fill}"` : `fill="none" stroke="${q.stroke}" stroke-width="${q.sw}" stroke-linecap="round" stroke-linejoin="round"`}${q.op != null ? ` opacity="${q.op}"` : ""}/>`;
  function fig(j, extra = "", v = 0, opts = {}) {
    const c = PAL[v % PAL.length];
    const blob = opts.noBlob ? "" : `<circle cx="52" cy="54" r="38" fill="#fff" opacity=".38"/>`;
    return `<svg viewBox="-4 -4 108 108" aria-hidden="true">${blob}<g fill="none">${extra}</g>${bodyParts(j, c).map((q) => partSVG(q)).join("")}${opts.front ? `<g fill="none">${opts.front}</g>` : ""}</svg>`;
  }
  const P = {
    walk: [[50, 14], [50, 24], [50, 54], [42, 38], [40, 50], [58, 38], [62, 48], [42, 72], [36, 92], [56, 72], [60, 92]],
    march: [[50, 14], [50, 24], [50, 54], [40, 34], [44, 24], [60, 38], [60, 52], [62, 58], [62, 78], [52, 74], [52, 94]],
    bike: [[42, 18], [46, 28], [36, 56], [56, 36], [66, 44], [56, 38], [66, 46], [58, 62], [52, 82], [50, 66], [62, 80]],
    squat: [[46, 22], [48, 32], [36, 58], [60, 38], [74, 40], [60, 38], [74, 40], [58, 66], [52, 92], [58, 66], [52, 92]],
    pushup: [[70, 22], [64, 30], [44, 52], [74, 42], [80, 58], [74, 42], [80, 58], [32, 70], [22, 90], [32, 70], [22, 90]],
    row: [[50, 14], [50, 24], [50, 54], [36, 34], [40, 44], [64, 34], [60, 44], [46, 74], [44, 94], [54, 74], [56, 94]],
    calf: [[50, 10], [50, 20], [50, 50], [42, 34], [40, 48], [58, 34], [60, 48], [47, 70], [47, 88], [53, 70], [53, 88]],
    bridge: [[16, 78], [24, 76], [52, 62], [30, 86], [40, 90], [30, 86], [40, 90], [70, 58], [76, 88], [70, 58], [76, 88]],
    curl: [[50, 14], [50, 24], [50, 54], [42, 40], [42, 26], [58, 40], [58, 26], [46, 74], [44, 94], [54, 74], [56, 94]],
    reach: [[50, 22], [50, 32], [50, 62], [42, 18], [38, 4], [58, 18], [62, 4], [46, 80], [44, 96], [54, 80], [56, 96]],
    hamstring: [[66, 40], [60, 46], [40, 60], [70, 60], [80, 74], [70, 60], [80, 74], [62, 80], [84, 82], [40, 80], [30, 92]],
    calfstretch: [[64, 14], [60, 24], [50, 52], [72, 30], [86, 26], [72, 32], [86, 28], [62, 70], [64, 92], [38, 72], [24, 92]],
    chest: [[50, 14], [50, 24], [50, 54], [36, 30], [24, 38], [64, 30], [76, 38], [46, 74], [44, 94], [54, 74], [56, 94]],
    side: [[42, 16], [46, 26], [50, 56], [40, 12], [34, 2], [58, 36], [56, 52], [46, 76], [44, 96], [54, 76], [56, 96]],
    oneleg: [[50, 12], [50, 22], [50, 52], [38, 34], [28, 40], [62, 34], [72, 40], [50, 74], [50, 94], [60, 66], [56, 80]],
    tandem: [[50, 10], [50, 20], [50, 50], [38, 32], [30, 40], [62, 32], [70, 40], [50, 72], [48, 92], [52, 72], [54, 84]],
    shift: [[44, 12], [46, 22], [48, 52], [34, 30], [28, 42], [58, 30], [66, 40], [42, 72], [36, 94], [56, 72], [62, 94]],
    sitstand: [[48, 16], [48, 26], [42, 54], [58, 34], [66, 30], [58, 34], [66, 30], [60, 62], [58, 90], [60, 62], [58, 90]],
    // Thai-style set (สสส. 12 ท่าบริหารร่างกายสไตล์ไทย)
    wai: [[50, 14], [50, 24], [50, 54], [40, 38], [49, 28], [60, 38], [51, 28], [46, 74], [44, 94], [54, 74], [56, 94]],
    shrug: [[50, 11], [50, 22], [50, 54], [40, 38], [39, 52], [60, 38], [61, 52], [46, 74], [44, 94], [54, 74], [56, 94]],
    lotus: [[50, 16], [50, 26], [50, 56], [37, 28], [26, 16], [63, 28], [74, 16], [46, 75], [44, 94], [54, 75], [56, 94]],
    krathop: [[50, 12], [50, 22], [50, 52], [36, 26], [22, 28], [64, 26], [78, 28], [58, 66], [56, 82], [48, 72], [46, 92]],
    bamboo: [[40, 17], [44, 26], [50, 55], [38, 14], [30, 4], [54, 12], [34, 2], [47, 75], [45, 94], [55, 75], [57, 94]],
    bird: [[50, 12], [50, 22], [50, 52], [36, 26], [22, 24], [64, 26], [78, 24], [62, 60], [60, 76], [50, 73], [50, 94]],
    ramthai: [[50, 13], [50, 23], [50, 53], [62, 20], [62, 8], [38, 34], [28, 30], [56, 70], [66, 84], [47, 73], [46, 94]],
    boxing: [[52, 14], [52, 24], [50, 54], [66, 28], [82, 26], [58, 36], [60, 26], [58, 74], [64, 94], [44, 74], [36, 94]],
    rowboat: [[54, 16], [53, 26], [50, 56], [62, 38], [70, 46], [60, 33], [70, 30], [64, 70], [70, 92], [42, 74], [32, 92]],
    castnet: [[54, 15], [52, 25], [50, 55], [62, 20], [74, 8], [60, 26], [74, 14], [58, 72], [64, 94], [42, 72], [36, 94]],
    rice: [[72, 34], [64, 37], [44, 52], [66, 52], [68, 70], [61, 52], [62, 72], [50, 73], [54, 94], [40, 74], [36, 94]],
    sky: [[50, 16], [50, 26], [50, 56], [47, 12], [50, 1], [53, 12], [50, 1], [47, 74], [46, 91], [53, 74], [54, 91]],
    // front-facing poses (figure faces the trainee) used by the motion engine
    standF: [[50, 14], [50, 24], [50, 54], [40, 39], [39, 53], [60, 39], [61, 53], [46, 74], [45, 94], [54, 74], [55, 94]],
    pkN: [[50, 14], [50, 24], [50, 54], [41, 41], [45, 54], [59, 41], [55, 54], [46, 74], [45, 94], [54, 74], [55, 94]],
    squatF: [[50, 27], [50, 37], [50, 64], [40, 47], [46, 41], [60, 47], [54, 41], [38, 76], [42, 94], [62, 76], [58, 94]],
    walkL: [[50, 14], [50, 24], [50, 54], [40, 40], [38, 52], [60, 39], [59, 48], [46, 71], [45, 90], [54, 74], [55, 94]],
    marchL: [[50, 14], [50, 24], [50, 54], [40, 40], [38, 52], [61, 38], [57, 30], [45, 60], [45, 77], [54, 74], [55, 94]],
    bike2: [[42, 18], [46, 28], [36, 56], [56, 36], [66, 44], [56, 38], [66, 46], [50, 66], [62, 80], [58, 62], [52, 82]],
    wallA: [[50, 15], [50, 25], [50, 55], [43, 31], [44, 29], [57, 31], [56, 29], [46, 75], [45, 94], [54, 75], [55, 94]],
    wallB: [[50, 17], [50, 27], [50, 56], [33, 35], [41, 28], [67, 35], [59, 28], [46, 75], [45, 94], [54, 75], [55, 94]],
    rowA: [[50, 14], [50, 24], [50, 54], [43, 33], [45, 32], [57, 33], [55, 32], [46, 74], [45, 94], [54, 74], [55, 94]],
    rowB: [[50, 14], [50, 24], [50, 54], [31, 40], [38, 36], [69, 40], [62, 36], [46, 74], [45, 94], [54, 74], [55, 94]],
    tiptoe: [[50, 9], [50, 19], [50, 49], [40, 34], [39, 48], [60, 34], [61, 48], [46, 70], [45, 91], [54, 70], [55, 91]],
    bridgeDown: [[16, 80], [24, 79], [50, 79], [30, 86], [40, 90], [30, 86], [40, 90], [66, 64], [76, 88], [66, 64], [76, 88]],
    hamUp: [[56, 30], [54, 40], [40, 60], [62, 54], [72, 60], [62, 54], [72, 60], [62, 80], [84, 82], [40, 80], [30, 92]],
    chestF: [[50, 13], [50, 24], [50, 54], [38, 40], [45, 56], [62, 40], [55, 56], [46, 74], [45, 94], [54, 74], [55, 94]],
    sitUp: [[50, 12], [50, 22], [50, 52], [56, 36], [62, 44], [56, 36], [62, 44], [52, 72], [56, 92], [52, 72], [56, 92]],
    shrugF: [[50, 13], [50, 20], [50, 54], [41, 35], [40, 50], [59, 35], [60, 50], [46, 74], [45, 94], [54, 74], [55, 94]],
    bud: [[50, 15], [50, 25], [50, 55], [43, 40], [49, 32], [57, 40], [51, 32], [46, 74], [45, 94], [54, 74], [55, 94]],
    castLow: [[46, 25], [48, 34], [50, 58], [42, 50], [34, 62], [45, 48], [37, 60], [42, 74], [36, 94], [58, 74], [64, 94]],
    rowboatB: [[52, 16], [52, 26], [50, 56], [54, 40], [58, 44], [52, 36], [58, 34], [64, 70], [70, 92], [42, 74], [32, 92]],
    // สไตล์อีสาน (ชุมชนบ้านกลาง ต.คำพี้ อ.นาแก จ.นครพนม)
    isWai: [[50, 14], [50, 24], [50, 54], [40, 38], [49, 28], [60, 38], [51, 28], [46, 74], [44, 94], [54, 74], [56, 94]],
    isUp: [[50, 16], [50, 26], [50, 56], [45, 13], [50, 1], [55, 13], [50, 1], [46, 74], [44, 94], [54, 74], [56, 94]],
    isOut: [[50, 14], [50, 24], [50, 54], [36, 30], [22, 38], [64, 30], [78, 38], [46, 74], [44, 94], [54, 74], [56, 94]],
    isSeat: [[48, 16], [48, 26], [42, 54], [50, 42], [62, 44], [52, 42], [64, 46], [60, 62], [58, 90], [60, 62], [58, 90]],
    isChop: [[48, 16], [48, 26], [42, 54], [48, 38], [54, 30], [52, 42], [64, 46], [60, 62], [58, 90], [60, 62], [58, 90]],
    isFwd: [[48, 15], [49, 25], [50, 54], [63, 31], [78, 31], [61, 34], [76, 35], [42, 72], [37, 94], [58, 72], [63, 94]],
    isElbow: [[48, 15], [49, 25], [50, 54], [60, 38], [50, 31], [61, 33], [60, 38], [42, 72], [37, 94], [58, 72], [63, 94]],
    isShoulder: [[52, 16], [51, 26], [49, 55], [40, 40], [46, 27], [60, 40], [54, 27], [42, 72], [37, 94], [58, 72], [63, 94]],
    isShL: [[47, 15], [49, 25], [51, 55], [62, 32], [77, 33], [42, 40], [46, 27], [42, 72], [37, 94], [58, 72], [63, 94]],
    isShR: [[53, 15], [51, 25], [49, 55], [58, 40], [54, 27], [62, 33], [77, 34], [42, 72], [37, 94], [58, 72], [63, 94]],
    isScoop: [[44, 36], [47, 43], [53, 62], [58, 56], [66, 72], [55, 56], [63, 74], [66, 77], [77, 94], [42, 79], [33, 94]],
    isLift: [[50, 14], [50, 24], [50, 54], [41, 21], [31, 10], [45, 25], [37, 15], [46, 74], [44, 94], [54, 74], [56, 94]],
    isPokeUp: [[50, 15], [50, 25], [50, 55], [61, 23], [69, 11], [40, 40], [44, 51], [42, 72], [37, 94], [58, 72], [63, 94]],
    isPokeLow: [[46, 18], [48, 27], [51, 55], [41, 44], [31, 58], [44, 42], [35, 54], [42, 72], [37, 94], [58, 72], [63, 94]],
    // ผ้าขาวม้าพาฟิต (สสส.) 22 poses
    pk01: [[50, 14], [50, 24], [50, 54], [38, 40], [46, 52], [62, 40], [54, 52], [44, 74], [40, 94], [56, 74], [60, 94]],
    pk02: [[50, 14], [50, 24], [50, 54], [42, 44], [45, 31], [58, 44], [55, 31], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk03: [[50, 14], [50, 24], [50, 54], [34, 27], [46, 26], [66, 27], [54, 26], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk04: [[50, 12], [50, 23], [50, 54], [41, 42], [44, 34], [59, 42], [56, 34], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk05: [[54, 14], [50, 24], [50, 54], [41, 42], [44, 34], [59, 42], [56, 34], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk06: [[45, 15], [50, 24], [50, 54], [41, 42], [44, 34], [59, 42], [56, 34], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk07: [[50, 14], [50, 24], [50, 54], [35, 27], [21, 27], [65, 27], [79, 27], [44, 74], [40, 94], [56, 74], [60, 94]],
    pk08: [[34, 46], [40, 38], [52, 54], [42, 58], [46, 80], [46, 24], [54, 8], [46, 74], [38, 94], [58, 74], [64, 94]],
    pk09: [[41, 18], [46, 26], [50, 55], [40, 40], [37, 55], [50, 10], [38, 4], [44, 74], [40, 94], [56, 74], [60, 94]],
    pk10: [[50, 16], [50, 26], [50, 56], [45, 13], [43, 2], [55, 13], [57, 2], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk11: [[50, 15], [50, 25], [50, 55], [35, 18], [45, 9], [65, 18], [55, 9], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk12: [[50, 13], [50, 24], [50, 54], [41, 42], [44, 33], [59, 42], [56, 33], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk13: [[50, 14], [50, 24], [50, 54], [40, 40], [43, 33], [60, 40], [57, 33], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk14: [[50, 14], [50, 24], [50, 54], [38, 38], [47, 41], [62, 38], [53, 41], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk15: [[50, 14], [50, 24], [50, 54], [40, 44], [46, 56], [60, 44], [54, 56], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk16: [[50, 14], [50, 24], [50, 54], [62, 36], [58, 48], [40, 48], [34, 64], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk17: [[54, 15], [52, 25], [45, 54], [55, 40], [62, 57], [57, 40], [64, 57], [58, 71], [54, 93], [56, 72], [50, 94]],
    pk18: [[55, 15], [52, 25], [45, 53], [56, 42], [62, 66], [58, 42], [64, 66], [58, 70], [55, 93], [56, 71], [50, 94]],
    pk19: [[50, 14], [50, 24], [50, 53], [42, 40], [53, 46], [60, 40], [60, 46], [58, 63], [60, 80], [50, 74], [50, 94]],
    pk20: [[50, 14], [50, 24], [50, 53], [43, 40], [54, 44], [60, 40], [60, 44], [58, 60], [58, 78], [50, 74], [50, 94]],
    pk21: [[52, 14], [52, 24], [50, 54], [40, 14], [46, 20], [60, 40], [58, 52], [52, 74], [51, 94], [52, 76], [36, 66]],
    pk22: [[46, 14], [48, 24], [50, 54], [66, 24], [80, 20], [40, 32], [52, 30], [44, 74], [40, 94], [56, 74], [60, 94]],
  };
  // ผ้าขาวม้า (checked waistcloth) drawn along a path, in front of the body
  const cloth = (d) => `<path d="${d}" stroke="#2f6fd0" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="#ffffff" stroke-width="6.5" stroke-dasharray="1.6 2.4" stroke-linecap="butt" stroke-linejoin="round" opacity=".6"/><path d="${d}" stroke="#7fb0ff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const arrow = (d) => `<path d="${d}" stroke="#2f6fd0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  // maroon/red Isan sash (ผ้าเบี่ยง / ผ้าขาวม้าแดง) and props
  const sashR = (d) => `<path d="${d}" stroke="#8e2a3a" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="#f2c14e" stroke-width="5.5" stroke-dasharray="1.2 3" opacity=".7"/>`;
  const sash = sashR("M57 25L44 52") + sashR("M41 53h18M52 54l2 10");
  const shrimpNet = (hx, hy, nx, ny) => `<path d="M${hx} ${hy}L${nx} ${ny}" stroke="#8a6a4f" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="${nx}" cy="${ny}" rx="8" ry="5" stroke="#5a6378" stroke-width="1.6"/><path d="M${nx - 7} ${ny + 2}Q${nx} ${ny + 14} ${nx + 7} ${ny + 2}" stroke="#5a6378" stroke-width="1.2" stroke-dasharray="1.5 1.5"/>`;
  const antNest = (hx, hy, nx, ny) => `<path d="M${hx} ${hy}L${nx} ${ny}" stroke="#8a6a4f" stroke-width="2.4" stroke-linecap="round"/><circle cx="${nx + 3}" cy="${ny - 3}" r="7" fill="#6ab565"/><path d="M${nx - 2} ${ny - 7}l4 3M${nx + 5} ${ny - 9}l-2 4M${nx + 7} ${ny - 1}l-4-1" stroke="#3f8a4a" stroke-width="1.4" stroke-linecap="round"/><circle cx="${nx + 1}" cy="${ny + 5}" r="1.6" fill="#f2c14e"/><circle cx="${nx + 5}" cy="${ny + 6}" r="1.4" fill="#f2c14e"/>`;
  const chair = `<path d="M16 26v32M14 58h30M18 58l-2 34M42 58l2 34" stroke="#8a6a4f" stroke-width="3.2" stroke-linecap="round"/><path d="M14 54h30" stroke="#b08a68" stroke-width="5" stroke-linecap="round"/>`;
  const FX = { sash, net1: shrimpNet(64, 73, 74, 90), net2: shrimpNet(34, 12, 18, 2), nest1: antNest(69, 11, 80, 0), nest2: antNest(33, 56, 20, 74) };

  /* ---------- motion engine: front-facing figures that move smoothly between key poses ---------- */
  // Each move is a list of key poses; the figure holds each pose, then eases (in-out) to the next and loops,
  // so patients can see the exact path of the movement. "~" mirrors a pose for the other side.
  const MIRROR_IDX = [0, 1, 2, 5, 6, 3, 4, 9, 10, 7, 8];
  const mirrorJ = (j) => MIRROR_IDX.map((k) => [100 - j[k][0], j[k][1]]);
  const MO = {
    walk: ["walkL", "N", "~walkL", "N"], march: ["N", "marchL", "N", "~marchL"], bike: ["=", "bike2"], squat: ["N", "squatF"],
    pushup: ["wallA", "wallB"], row: ["rowA", "rowB"], calf: ["N", "tiptoe"], bridge: ["bridgeDown", "="], curl: ["N", "="], reach: ["N", "="],
    hamstring: ["hamUp", "="], calfstretch: ["="], chest: ["N", "chestF"], side: ["~=", "N", "="], oneleg: ["N", "=", "N", "~="], tandem: ["="],
    shift: ["=", "~="], sitstand: ["=", "sitUp"],
    wai: ["N", "isUp", "="], shrug: ["N", "shrugF"], lotus: ["bud", "="], krathop: ["=", "~="], bamboo: ["=", "N", "~="], bird: ["N", "=", "N", "~="],
    ramthai: ["=", "~="], boxing: ["=", "~="], rowboat: ["rowboatB", "="], castnet: ["castLow", "="], rice: ["N", "="], sky: ["N", "="],
    pk05: ["=", "~="], pk06: ["=", "~="], pk08: ["=", "~="], pk09: ["=", "~="], pk16: ["=", "~="], pk22: ["=", "~="], pk19: ["N", "=", "N", "~="], pk20: ["N", "=", "N", "~="], pk21: ["N", "=", "N", "~="],
  };
  const clothN = () => cloth("M45 54h10M45 55v12M55 55v12");
  function motionFor(cat, idx) {
    const e = PROGRAMS[cat].list[idx], extraAll = e.x && e.p !== "squat" ? e.x : "";
    const wrapM = (svg) => (svg ? `<g transform="translate(100 0) scale(-1 1)">${svg}</g>` : "");
    if (e.frames) return e.frames.map((f) => ({ j: P[f.p], front: f.fx ? FX[f.fx] : "", extra: f.x === "chair" ? chair : "" }));
    const seq = MO[e.p] || ["N", "="];
    return seq.map((tok) => {
      const m = tok.startsWith("~"), key = m ? tok.slice(1) : tok;
      let j, front = "";
      if (key === "=") { j = P[e.p]; front = e.fx || ""; }
      else if (key === "N") { j = cat === "pakhaoma" ? P.pkN : P.standF; front = cat === "pakhaoma" ? clothN() : ""; }
      else j = P[key];
      return { j: m ? mirrorJ(j) : j, front: m ? wrapM(front) : front, extra: extraAll };
    });
  }
  const ANIMS = new Set();
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animIO = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((x) => { if (x.target._anim) x.target._anim.vis = x.isIntersecting; })) : null;
  class FigAnim {
    constructor(host, frames, v = 0, opts = {}) {
      this.host = host; this.frames = frames.filter((f) => f.j); this.t = 0; this.vis = true; this.c = PAL[v % PAL.length];
      this.hold = opts.hold ?? 0.7; this.move = opts.move ?? 1.1;
      const parts = bodyParts(this.frames[0].j, this.c);
      host.innerHTML = `<svg viewBox="-4 -4 108 108" aria-hidden="true">${opts.noBlob ? "" : `<circle cx="52" cy="54" r="38" fill="#fff" opacity=".38"/>`}
        ${this.frames.map((f, i) => `<g data-x="${i}" fill="none" opacity="${i ? 0 : 1}">${f.extra || ""}</g>`).join("")}
        ${parts.map((q, i) => partSVG(q, i)).join("")}
        ${this.frames.map((f, i) => `<g data-f="${i}" fill="none" opacity="${i ? 0 : 1}">${f.front || ""}</g>`).join("")}</svg>`;
      this.paths = [...host.querySelectorAll("[data-p]")];
      this.gx = [...host.querySelectorAll("[data-x]")]; this.gf = [...host.querySelectorAll("[data-f]")];
      host._anim = this; if (animIO) animIO.observe(host);
      const last = this.frames.length - 1;
      if (REDUCE || this.frames.length < 2) this.render(this.frames[last].j, this.frames.map((_, i) => (i === last ? 1 : 0)));
      else { this.step(0); ANIMS.add(this); }
    }
    step(dt) {
      const F = this.frames, n = F.length, per = this.hold + this.move; this.t += dt;
      const tt = this.t % (per * n), i = Math.floor(tt / per), r = tt - i * per, k = (i + 1) % n, w = F.map(() => 0);
      if (r < this.hold) { w[i] = 1; return this.render(F[i].j, w); }
      const u = (r - this.hold) / this.move, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      w[i] = 1 - e; w[k] = e;
      this.render(F[i].j.map((p, q) => [p[0] + (F[k].j[q][0] - p[0]) * e, p[1] + (F[k].j[q][1] - p[1]) * e]), w);
    }
    render(J, w) {
      bodyParts(J, this.c).forEach((q, i) => { const el = this.paths[i]; if (!el) return; el.setAttribute("d", q.d); if (q.op != null) el.setAttribute("opacity", q.op); });
      this.gx.forEach((g, i) => g.setAttribute("opacity", w[i].toFixed(2))); this.gf.forEach((g, i) => g.setAttribute("opacity", w[i].toFixed(2)));
    }
  }
  function mountAnims(root) {
    root.querySelectorAll("[data-mo]").forEach((el) => { const [cat, idx] = el.dataset.mo.split(":"); if (PROGRAMS[cat]?.list[+idx]) new FigAnim(el, motionFor(cat, +idx), +idx, { noBlob: el.dataset.noblob === "1" }); });
  }
  let animLast = performance.now();
  (function animLoop(now) {
    const dt = Math.min(0.1, (now - animLast) / 1000); animLast = now;
    ANIMS.forEach((a) => { if (!a.host.isConnected) { ANIMS.delete(a); animIO?.unobserve(a.host); return; } if (a.vis) a.step(dt); });
    requestAnimationFrame(animLoop);
  })(animLast);
  return { fig, P, chair, PAL, shade, cloth, sash, FX };
})();
