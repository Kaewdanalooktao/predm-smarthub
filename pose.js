// MediaPipe Pose + Hand: AI exercise tracking + camera games. Runs fully in the browser.
import { PoseLandmarker, HandLandmarker, FilesetResolver } from "./vendor/mediapipe/vision_bundle.mjs";

const $ = (s) => document.querySelector(s);
const App = () => window.PreDM;
const VER = "0.10.14";
const MODEL = new URL("vendor/models/pose_landmarker_lite.task", location.href).href; // self-hosted: no request leaves our site
const WASM = new URL("vendor/mediapipe/wasm", location.href).href;
const MODEL_FULL = new URL("vendor/models/pose_landmarker_full.task", location.href).href;

let landmarker = null;
async function getLandmarker(msgEl) {
  if (landmarker) return landmarker;
  if (msgEl) msgEl.textContent = "กำลังโหลดโมเดล MediaPipe Pose…";
  const fs = await FilesetResolver.forVisionTasks(WASM);
  // the "lite" model starts and runs fast on phones; smoothing + lower thresholds keep tracking steady
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
  try { landmarker = await PoseLandmarker.createFromOptions(fs, opts("GPU")); } catch { landmarker = await PoseLandmarker.createFromOptions(fs, opts("CPU")); }
  return landmarker;
}
// MediaPipe Hand Landmarker (21 points per hand, up to 2 hands) — loaded only when a hand mode / overlay is used
const HAND_MODEL = new URL("vendor/models/hand_landmarker.task", location.href).href;
let handLm = null, handLoading = null;
async function getHandLandmarker(msgEl) {
  if (handLm) return handLm;
  if (!handLoading) handLoading = (async () => {
    if (msgEl) msgEl.textContent = "กำลังโหลดโมเดล MediaPipe Hand…";
    const fs = await FilesetResolver.forVisionTasks(WASM);
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
    try { handLm = await HandLandmarker.createFromOptions(fs, opts("GPU")); }
    catch { handLm = await HandLandmarker.createFromOptions(fs, opts("CPU")); }
    return handLm;
  })();
  return handLoading;
}

// Camera + detection loop shared by tracking and game.
class Runner {
  constructor(video, canvas, msg) { this.v = video; this.c = canvas; this.ctx = canvas.getContext("2d"); this.msg = msg; this.on = false; this.hands = false; }
  async setHands(on) { this.hands = !!on; if (on && this.on) { try { await getHandLandmarker(null); } catch { this.hands = false; } } }
  async start(onFrame) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("เบราว์เซอร์นี้ไม่รองรับกล้อง ต้องเปิดผ่าน https หรือ localhost");
    this.msg.textContent = "กำลังเปิดกล้องและโหลด AI…";
    // camera, pose model and hand model all start at the same time (not one after another)
    const [lm, stream] = await Promise.all([getLandmarker(null), navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false }),
      this.hands ? getHandLandmarker(null).catch(() => { this.hands = false; }) : null]);
    this.stream = stream;
    this.v.srcObject = this.stream; await this.v.play();
    this.c.width = this.v.videoWidth || 640; this.c.height = this.v.videoHeight || 480;
    this.msg.hidden = true; this.on = true; let lastT = -1;
    const loop = () => {
      if (!this.on) return;
      const now = performance.now();
      if (this.v.currentTime !== lastT) {
        lastT = this.v.currentTime;
        const res = lm.detectForVideo(this.v, now);
        const { width: w, height: h } = this.c, ctx = this.ctx;
        ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(this.v, 0, 0, w, h); ctx.restore();
        // mirror landmark x so the screen behaves like a mirror
        const raw = res.landmarks?.[0]?.map((p) => ({ x: 1 - p.x, y: p.y, v: p.visibility ?? 1 })) || null;
        // steadier tracking: light smoothing between frames, and keep the last pose ~0.45 s when a frame is missed
        let lms = null;
        if (raw) { this.seen = now; this.sm = this.sm ? raw.map((p, i) => { const q = this.sm[i], a = Math.hypot(p.x - q.x, p.y - q.y) > 0.08 ? 0.85 : 0.55; return { x: q.x + (p.x - q.x) * a, y: q.y + (p.y - q.y) * a, v: q.v + (p.v - q.v) * 0.5 }; }) : raw; lms = this.sm; }
        else if (this.sm && now - this.seen < 450) lms = this.sm; else this.sm = null;
        let hands = null;
        if (this.hands && handLm) {
          const hr = handLm.detectForVideo(this.v, now), hd = hr.handedness || hr.handednesses || [];
          // camera image is mirrored on screen, so MediaPipe's "Left" is the user's right hand as seen in the mirror view
          hands = (hr.landmarks || []).map((pts, i) => ({ pts: pts.map((q) => ({ x: 1 - q.x, y: q.y })), side: hd[i]?.[0]?.categoryName === "Left" ? "R" : "L", score: hd[i]?.[0]?.score ?? 1 }));
          if (hands.length) { this.lastHands = hands; this.handsAt = now; } else if (this.lastHands && now - this.handsAt < 300) hands = this.lastHands; // bridge short drop-outs
        }
        onFrame(lms, ctx, w, h, now, hands);
      }
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  stop() {
    this.on = false; cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null;
    this.msg.hidden = false;
  }
}

const EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
function drawSkeleton(ctx, lms, w, h, color = "#3fbf85") {
  ctx.lineWidth = 4; ctx.strokeStyle = color; ctx.lineCap = "round";
  EDGES.forEach(([a, b]) => { if (lms[a].v > 0.5 && lms[b].v > 0.5) { ctx.beginPath(); ctx.moveTo(lms[a].x * w, lms[a].y * h); ctx.lineTo(lms[b].x * w, lms[b].y * h); ctx.stroke(); } });
  ctx.fillStyle = color === "#3fbf85" ? "#f0b440" : color;
  [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach((i) => { if (lms[i].v > 0.5) { ctx.beginPath(); ctx.arc(lms[i].x * w, lms[i].y * h, 5, 0, 7); ctx.fill(); } });
}
const HAND_EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const FINGER_COL = ["#ffffff", "#ffb84d", "#ffe14d", "#6fe39a", "#5ec8ff", "#c79bff"];
const fingerOf = (i) => (i === 0 ? 0 : Math.ceil(i / 4));
function drawHands(ctx, hands, w, h, color) {
  if (!hands) return;
  hands.forEach((hd) => {
    const P = hd.pts; ctx.lineCap = "round";
    HAND_EDGES.forEach(([a, b]) => { ctx.lineWidth = 3.5; ctx.strokeStyle = color || FINGER_COL[fingerOf(b)]; ctx.beginPath(); ctx.moveTo(P[a].x * w, P[a].y * h); ctx.lineTo(P[b].x * w, P[b].y * h); ctx.stroke(); });
    P.forEach((q, i) => { ctx.beginPath(); ctx.arc(q.x * w, q.y * h, i % 4 === 0 ? 5 : 3.5, 0, 7); ctx.fillStyle = color || FINGER_COL[fingerOf(i)]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.stroke(); });
    const wr = P[0]; ctx.font = "bold 14px sans-serif"; ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(wr.x * w - 26, wr.y * h + 8, 52, 20);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(hd.side === "L" ? "มือซ้าย" : "มือขวา", wr.x * w, wr.y * h + 23); ctx.textAlign = "start";
  });
}
// openness of a hand: mean fingertip distance from wrist, normalised by palm length (wrist → middle-finger knuckle)
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function handOpen(hd) { const P = hd.pts, palm = dist2(P[0], P[9]) || 1e-3; return [8, 12, 16, 20].reduce((t, i) => t + dist2(P[0], P[i]), 0) / 4 / palm; }
function fingersUp(hd) { const P = hd.pts; return [8, 12, 16, 20].filter((t) => dist2(P[0], P[t]) > dist2(P[0], P[t - 2]) * 1.1).length + (dist2(P[4], P[17]) > dist2(P[2], P[17]) * 1.15 ? 1 : 0); }
function angle(a, b, c) {
  const ab = Math.atan2(a.y - b.y, a.x - b.x), cb = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs((ab - cb) * 180 / Math.PI); return d > 180 ? 360 - d : d;
}
const visible = (lms, ids) => ids.every((i) => lms[i].v > 0.35);
// knee angle from whichever leg the camera sees clearly (side-on, the far leg is hidden); null if neither leg is visible
function kneeAngle(lms) {
  const ok = (a, b, c) => lms[a].v > 0.35 && lms[b].v > 0.35 && lms[c].v > 0.3;
  const L = ok(23, 25, 27) ? angle(lms[23], lms[25], lms[27]) : null, R = ok(24, 26, 28) ? angle(lms[24], lms[26], lms[28]) : null;
  return L != null && R != null ? (L + R) / 2 : L ?? R;
}

/* ---------------- AI tracking engine (tracking page + session player) ----------------
   Skeleton colour: white = still detecting / not judged, red = wrong form, green = correct form. */
const COLORS = { idle: "#ffffff", ok: "#2ecc71", bad: "#ff4d4d" };
const NEED = { squat: null, arm: [11, 12, 13, 14, 15, 16, 23, 24], march: [23, 24, 25, 26], balance: [23, 24, 27, 28], any: [11, 12, 23, 24] };
const HAND_MODES = new Set(["fist"]);
function makeEval(mode) {
  const s = { stage: "up", side: null, lastMove: 0, bal: 0, count: 0, seenAt: 0, midSince: 0, partSince: 0, lastT: 0 };
  return (lms, now, hands) => {
    const dt = s.lastT ? Math.min(0.2, (now - s.lastT) / 1000) : 0; s.lastT = now;
    if (mode === "fist") { // กำ-แบมือ: full open (fingers spread) -> tight fist -> open = 1 rep
      if (!hands || !hands.length) { s.seenAt = 0; return { state: "idle", msg: "ยกมือขึ้นให้กล้องเห็นฝ่ามือชัด ๆ ห่างกล้องประมาณ 50 ซม.–1 เมตร", count: s.count }; }
      if (!s.seenAt) s.seenAt = now;
      if (now - s.seenAt < 600) return { state: "idle", msg: "กำลังจับมือ…", count: s.count };
      const o = Math.min(...hands.map(handOpen)), up = Math.max(...hands.map(fingersUp));
      const r = { state: "ok", msg: "", count: s.count, rep: false, label: `นิ้วที่เหยียด ${up}` };
      if (o < 1.15) { if (s.stage === "open") { s.stage = "fist"; } s.midSince = 0; r.msg = "กำแน่นดี แล้วแบมือให้สุด"; }
      else if (o > 1.75) { if (s.stage === "fist") { s.count++; r.rep = true; r.msg = `${s.count} ครั้ง`; } else r.msg = "แบมือดี กางนิ้วออก แล้วกำมือ"; s.stage = "open"; s.midSince = 0; }
      else { if (!s.midSince) s.midSince = now; if (now - s.midSince > 1500) { r.state = "bad"; r.msg = s.stage === "fist" ? "แบมือให้สุด เหยียดนิ้วทุกนิ้ว" : "กำมือให้แน่นกว่านี้"; } else r.msg = s.stage === "fist" ? "แบมือออก" : "กำมือ"; }
      r.count = s.count; return r;
    }
    if (!lms) { s.seenAt = 0; return { state: "idle", msg: "ไม่พบร่างกาย ถอยห่างจากกล้องให้เห็นทั้งตัว", count: s.count }; }
    if (mode === "squat" ? kneeAngle(lms) == null : !visible(lms, NEED[mode] || NEED.any)) { s.seenAt = 0; return { state: "idle", msg: "ให้กล้องเห็นช่วงตัวที่ใช้ในท่านี้ทั้งหมด", count: s.count }; }
    if (!s.seenAt) s.seenAt = now;
    if (now - s.seenAt < 1000) return { state: "idle", msg: "กำลังจับท่าทาง…", count: s.count };
    const r = { state: "ok", msg: "", count: s.count, rep: false, label: "" };
    if (mode === "squat") {
      const k = kneeAngle(lms);
      r.label = `เข่า ${Math.round(k)}°`;
      if (k < 100) { s.stage = "down"; s.midSince = 0; r.msg = "ดีมาก ดันตัวขึ้น"; }
      else if (k > 160) { if (s.stage === "down") { s.stage = "up"; s.count++; r.rep = true; r.msg = `${s.count} ครั้ง`; } else r.msg = "ยืนตรง พร้อมย่อลง"; s.midSince = 0; }
      else if (s.stage === "up") { if (!s.midSince) s.midSince = now; if (now - s.midSince > 1500) { r.state = "bad"; r.msg = "ย่อลงอีกนิด ให้เข่างอประมาณ 90 องศา"; } else r.msg = "ย่อต่อ"; }
      else r.msg = "ดันตัวขึ้นให้สุด";
    } else if (mode === "arm") {
      const al = angle(lms[23], lms[11], lms[15]), ar = angle(lms[24], lms[12], lms[16]), a = Math.min(al, ar);
      r.label = `แขน ${Math.round(a)}°`;
      if (Math.abs(al - ar) > 40 && Math.max(al, ar) > 60) { r.state = "bad"; r.msg = "ยกแขนสองข้างให้สูงเท่ากัน"; }
      else if (a > 150) { s.stage = "top"; s.midSince = 0; r.msg = "แขนตรงดี ลดลงช้า ๆ"; }
      else if (a < 40) { if (s.stage === "top") { s.stage = "up"; s.count++; r.rep = true; r.msg = `${s.count} ครั้ง`; } else r.msg = "ยกแขนขึ้นเหนือศีรษะ"; s.midSince = 0; }
      else if (s.stage === "up" && a > 90) { if (!s.midSince) s.midSince = now; if (now - s.midSince > 1500) { r.state = "bad"; r.msg = "ยกแขนให้สูงกว่านี้ จนแขนเหยียดตรง"; } else r.msg = "ยกต่ออีก"; }
      else r.msg = s.stage === "top" ? "ลดแขนลงข้างลำตัว" : "ยกแขนขึ้น";
    } else if (mode === "march") {
      const L = lms[23].y - lms[25].y, R = lms[24].y - lms[26].y, side = L > -0.06 ? "L" : R > -0.06 ? "R" : null;
      if (side) { if (side !== s.side) { s.count++; r.rep = true; s.side = side; } s.lastMove = now; s.partSince = 0; r.msg = "ยกเข่าได้ดี สลับขา"; }
      else {
        if (s.side && !s.side.endsWith("_")) s.side += "_";
        if (L > -0.14 || R > -0.14) { if (!s.partSince) s.partSince = now; s.lastMove = now; if (now - s.partSince > 700) { r.state = "bad"; r.msg = "ยกเข่าให้สูงขึ้น ใกล้ระดับสะโพก"; } else r.msg = "ยกเข่า"; }
        else { s.partSince = 0; if (now - (s.lastMove || now) > 2500) { r.state = "bad"; r.msg = "ย่ำเท้าต่อ ยกเข่าสลับซ้าย-ขวา"; } else r.msg = "ยกเข่าสลับ"; }
      }
    } else if (mode === "balance") {
      const dy = Math.abs(lms[27].y - lms[28].y);
      if (dy > 0.05) { s.bal += dt; r.msg = "ทรงตัวดี ค้างไว้"; } else { r.state = s.bal > 0 ? "bad" : "idle"; r.msg = "ยกเท้าข้างหนึ่งให้พ้นพื้น"; }
      s.count = Math.floor(s.bal); r.label = `${s.count} วินาที`;
    } else { r.state = "idle"; r.msg = "AI จับท่าทางได้ ทำตามภาพตัวอย่าง"; }
    r.count = s.count;
    return r;
  };
}
function makeTracker(video, canvas, msgEl) {
  const runner = new Runner(video, canvas, msgEl);
  let evalFn = makeEval(null), cb = null, showHands = false, curMode = null;
  return {
    get on() { return runner.on; },
    async start(mode, onUpdate) {
      evalFn = makeEval(mode); curMode = mode; cb = onUpdate; runner.hands = HAND_MODES.has(mode) || showHands;
      await runner.start((lms, ctx, w, h, now, hands) => {
        const r = evalFn(lms, now, hands), col = COLORS[r.state];
        if (lms) drawSkeleton(ctx, lms, w, h, col);
        if (hands) drawHands(ctx, hands, w, h, HAND_MODES.has(mode) ? col : null);
        ctx.save(); ctx.lineWidth = 12; ctx.strokeStyle = col; ctx.globalAlpha = r.state === "idle" ? 0.35 : 0.9; ctx.strokeRect(6, 6, w - 12, h - 12); ctx.restore();
        if (r.label) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(14, 14, 160, 36); ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif"; ctx.fillText(r.label, 24, 39); }
        cb && cb(r);
      });
    },
    setMode(mode) { evalFn = makeEval(mode); curMode = mode; runner.setHands(HAND_MODES.has(mode) || showHands); },
    setHands(on) { showHands = !!on; runner.setHands(HAND_MODES.has(curMode) || showHands); },
    stop() { runner.stop(); },
  };
}
window.PreDMTrack = { create: makeTracker };

/* ---------------- AI fitness tests (Senior Fitness Test style) ----------------
   Each evaluator: setup (pose check) -> 3 s countdown -> run -> done. Landmarks are mirrored (x flipped) and normalised. */
const FIT_TESTS = {
  chair30: { name: "ลุก-นั่งเก้าอี้ 30 วินาที", unit: "ครั้ง", dur: 30, setup: "sit" },
  step2: { name: "ยกเข่าขึ้นลง 2 นาที", unit: "ครั้ง", dur: 120, setup: "stand" },
  sls: { name: "ยืนขาเดียวลืมตา", unit: "วินาที", dur: 60, setup: "stand" },
  tug: { name: "ลุกเดินไป-กลับ 8 ฟุต (TUG)", unit: "วินาที", dur: 60, setup: "sit" },
  sitreach: { name: "นั่งเก้าอี้เอื้อมแตะปลายเท้า", unit: "ซม.", dur: 20, setup: "reach" },
};
const SIDE = { L: { sh: 11, hip: 23, knee: 25, ank: 27, foot: 31, idx: 19, wr: 15 }, R: { sh: 12, hip: 24, knee: 26, ank: 28, foot: 32, idx: 20, wr: 16 } };
const vis = (lms, ids) => ids.reduce((t, i) => t + (lms[i]?.v || 0), 0) / ids.length;
function bestSide(lms) { const s = (k) => vis(lms, [SIDE[k].sh, SIDE[k].hip, SIDE[k].knee, SIDE[k].ank]); return s("L") >= s("R") ? "L" : "R"; }
function legAngles(lms, k) { const S = SIDE[k]; return { knee: angle(lms[S.hip], lms[S.knee], lms[S.ank]), hip: angle(lms[S.sh], lms[S.hip], lms[S.knee]) }; }
const isSit = (a) => a.knee < 125 && a.hip < 135;
const isStand = (a) => a.knee > 158 && a.hip > 155;
function makeFitEval(test, opts = {}) {
  const T = FIT_TESTS[test], s = { phase: "setup", okSince: 0, t0: 0, count: 0, stage: null, best: null, hold: [], maxK: 0, cal: {}, events: [], warnAt: 0 };
  const W = opts.w || 640, H = opts.h || 480, heightCm = opts.height || 160;
  const out = (o) => ({ phase: s.phase, value: s.count, unit: T.unit, ...o });
  return (lms, now) => {
    // ---------- setup: hold the start position ----------
    if (s.phase === "setup") {
      if (!lms) { s.okSince = 0; return out({ state: "idle", msg: "ไม่พบร่างกาย ให้กล้องเห็นทั้งตัว" }); }
      const k = bestSide(lms), a = legAngles(lms, k), seen = vis(lms, [SIDE[k].hip, SIDE[k].knee, SIDE[k].ank]) > 0.5;
      let ok = false, msg = "";
      if (!seen) msg = "ให้กล้องเห็นสะโพก เข่า และข้อเท้า";
      else if (T.setup === "sit") { ok = isSit(a); msg = ok ? "ดีมาก นั่งนิ่ง ๆ" : "นั่งบนเก้าอี้ หลังตรง กอดอก"; }
      else if (T.setup === "stand") { ok = isStand(a) && Math.abs(lms[27].y - lms[28].y) < 0.04; msg = ok ? "ดีมาก ยืนนิ่ง ๆ" : "ยืนตรง เท้าทั้งสองวางบนพื้น"; }
      else if (T.setup === "reach") { const o = k === "L" ? "R" : "L", ext = legAngles(lms, k).knee, bent = legAngles(lms, o).knee; ok = a.hip < 140 && ext > 150; msg = ok ? "ดีมาก ขาเหยียดตรง" : "นั่งขอบเก้าอี้ หันข้างเข้ากล้อง เหยียดขาข้างที่ใกล้กล้อง ส้นเท้าแตะพื้น"; void bent; }
      if (!ok) { s.okSince = 0; return out({ state: "idle", msg }); }
      if (!s.okSince) s.okSince = now;
      if (now - s.okSince < 1200) return out({ state: "idle", msg });
      s.phase = "count"; s.t0 = now;
      // calibration
      const S = SIDE[k]; s.cal = { side: k, seatX: lms[S.hip].x, kneeY: lms[26].v > 0.5 ? lms[26].y : lms[25].y, hipY: lms[26].v > 0.5 ? lms[24].y : lms[23].y, legLen: Math.hypot(lms[S.hip].x - lms[S.ank].x, lms[S.hip].y - lms[S.ank].y) || 0.4, scale: Math.abs(lms[S.sh].y - lms[S.ank].y) || 0.6 };
      s.cal.target = (s.cal.kneeY + s.cal.hipY) / 2;
    }
    // ---------- countdown ----------
    if (s.phase === "count") {
      const left = 3 - Math.floor((now - s.t0) / 1000);
      if (left > 0) return out({ state: "idle", msg: "เตรียมตัว…", countdown: left });
      s.phase = "run"; s.t0 = now; s.stage = T.setup === "sit" ? "sit" : "down"; return out({ state: "ok", msg: "เริ่ม!", go: true });
    }
    if (s.phase === "done") return out({ state: "ok", msg: "เสร็จสิ้น", done: true, result: s.result });
    // ---------- run ----------
    const el = (now - s.t0) / 1000, left = Math.max(0, T.dur - el);
    const finish = (val, msg) => { s.phase = "done"; s.result = val; return out({ state: "ok", msg, done: true, result: val, elapsed: el }); };
    const r = out({ state: "ok", msg: "", elapsed: el, left });
    if (test === "chair30") {
      if (left <= 0) return finish(s.count, `ครบ 30 วินาที ได้ ${s.count} ครั้ง`);
      if (!lms) return { ...r, state: "idle", msg: "ไม่เห็นร่างกาย" };
      const a = legAngles(lms, bestSide(lms));
      if (s.stage === "sit") { s.maxK = Math.max(s.maxK, a.knee); if (isStand(a)) { s.count++; s.stage = "stand"; r.rep = true; r.msg = `${s.count} ครั้ง`; } else r.msg = "ลุกขึ้นยืนให้ตรงสุด"; }
      else { if (isSit(a)) { s.stage = "sit"; s.maxK = 0; r.msg = "ลุกขึ้นอีก"; } else r.msg = "นั่งลงให้สุด"; }
      if (s.stage === "sit" && isSit(a) && s.maxK > 135 && s.maxK < 158) { r.state = "bad"; r.msg = "ยืนให้ตรงสุดก่อนนั่งลง ครั้งนี้ไม่นับ"; s.maxK = 0; }
      const k = SIDE[bestSide(lms)]; if (lms[k.wr].v > 0.5 && lms[k.wr].y > lms[k.hip].y + 0.02 && s.stage === "sit") { r.state = "bad"; r.msg = "กอดอก ไม่ใช้มือดันเข่าหรือเก้าอี้"; }
      r.value = s.count; return r;
    }
    if (test === "step2") {
      if (left <= 0) return finish(s.count, `ครบ 2 นาที ได้ ${s.count} ครั้ง`);
      r.line = s.cal.target; if (!lms) return { ...r, state: "idle", msg: "ไม่เห็นร่างกาย" };
      const ky = lms[26].v > 0.5 ? lms[26].y : lms[25].y, tgt = s.cal.target, mid = tgt + (s.cal.kneeY - tgt) * 0.5;
      if (s.stage === "down") { if (ky <= tgt + 0.012) { s.count++; s.stage = "up"; r.rep = true; r.msg = `${s.count} ครั้ง`; s.maxK = 0; } else { s.maxK = Math.max(s.maxK, s.cal.kneeY - ky); r.msg = "ยกเข่าขวาให้ถึงเส้น"; } }
      else if (ky > mid) { s.stage = "down"; r.msg = "ยกอีก (นับเฉพาะเข่าขวา)"; }
      if (s.stage === "down" && s.maxK > (s.cal.kneeY - tgt) * 0.45 && ky > mid && now - s.warnAt > 2500 && s.maxK < (s.cal.kneeY - tgt) * 0.9) { r.state = "bad"; r.msg = "ยกเข่าให้สูงถึงเส้นเหลือง"; s.warnAt = now; s.maxK = 0; }
      r.value = s.count; return r;
    }
    if (test === "sls") {
      if (!lms) return { ...r, state: "idle", msg: "ไม่เห็นร่างกาย" };
      const diff = Math.abs(lms[27].y - lms[28].y), up = diff > Math.max(0.035, s.cal.legLen * 0.09);
      if (!s.liftAt) { r.value = 0; if (up) { s.liftAt = now; r.msg = "จับเวลาแล้ว ทรงตัวไว้"; } else { r.msg = "ยกเท้าข้างหนึ่งให้พ้นพื้น"; if (el > 15) return finish(0, "ไม่พบการยกเท้า"); } return r; }
      const held = (now - s.liftAt) / 1000; r.value = Math.round(held * 10) / 10; r.left = Math.max(0, T.dur - held);
      if (held >= T.dur) return finish(T.dur, "ครบ 60 วินาที ยอดเยี่ยม!");
      if (!up) { s.downSince = s.downSince || now; if (now - s.downSince > 250) return finish(Math.round(((s.downSince - s.liftAt) / 1000) * 10) / 10, "เท้าแตะพื้น หยุดเวลา"); } else s.downSince = 0;
      r.msg = "ทรงตัวไว้ ห้ามแตะพื้น"; return r;
    }
    if (test === "tug") {
      r.value = Math.round(el * 10) / 10;
      if (el > T.dur) return finish(Math.round(el * 10) / 10, "เกิน 60 วินาที");
      if (!lms) { if (s.stood) s.away = true; return { ...r, msg: "เดินอ้อมกรวยแล้วกลับมานั่ง" }; }
      const k = bestSide(lms), a = legAngles(lms, k), S = SIDE[k];
      if (isStand(a)) { s.stood = s.stood || now; }
      const dx = Math.abs(lms[S.hip].x - s.cal.seatX), sc = Math.abs(lms[S.sh].y - lms[S.ank].y);
      if (s.stood && (dx > 0.18 || sc < s.cal.scale * 0.75 || vis(lms, [S.hip, S.knee]) < 0.4)) s.away = true;
      if (s.away && isSit(a) && dx < 0.15 && now - s.stood > 2500) return finish(Math.round(el * 10) / 10, "นั่งลงแล้ว หยุดเวลา");
      r.msg = !s.stood ? "ลุกขึ้นแล้วเดินไปอ้อมกรวย" : !s.away ? "เดินเร็วที่สุดอย่างปลอดภัย" : "กลับมานั่งให้สุด"; return r;
    }
    if (test === "sitreach") {
      if (left <= 0) return finish(s.best == null ? 0 : s.best, s.best == null ? "วัดไม่ได้" : `ระยะที่ดีที่สุด ${s.best} ซม.`);
      if (!lms) return { ...r, state: "idle", msg: "ไม่เห็นร่างกาย" };
      const S = SIDE[s.cal.side], P = (i) => ({ x: lms[i].x * W, y: lms[i].y * H });
      const toe = P(S.foot), hip = P(S.hip), fing = lms[S.idx].v > 0.3 ? P(S.idx) : P(S.wr), knee = P(S.knee), ank = P(S.ank);
      const dx = toe.x - hip.x, dy = toe.y - hip.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const dpx = (fing.x - toe.x) * ux + (fing.y - toe.y) * uy, shin = Math.hypot(knee.x - ank.x, knee.y - ank.y) || 1;
      const cm = Math.round(((dpx / shin) * heightCm * 0.24) * 2) / 2, kneeA = angle(lms[S.hip], lms[S.knee], lms[S.ank]);
      r.reach = { toe: { x: toe.x / W, y: toe.y / H }, fing: { x: fing.x / W, y: fing.y / H }, cm };
      if (kneeA < 160) { r.state = "bad"; r.msg = "เหยียดเข่าให้ตรง แล้วค่อย ๆ เอื้อมมือ"; s.hold = []; r.value = s.best ?? "–"; return r; }
      s.hold.push([now, cm]); s.hold = s.hold.filter(([t]) => now - t <= 1500);
      if (s.hold.length > 5 && now - s.hold[0][0] >= 1400) { const vs = s.hold.map((x) => x[1]), lo = Math.min(...vs), hi = Math.max(...vs); if (hi - lo <= 2.5) { const v = Math.round(((lo + hi) / 2) * 2) / 2; if (s.best == null || v > s.best) { s.best = v; r.rep = true; } } }
      r.value = s.best ?? "–"; r.msg = `ตอนนี้ ${cm > 0 ? "+" : ""}${cm} ซม. · ค้าง 2 วินาทีเพื่อบันทึก`; return r;
    }
    return r;
  };
}
function makeFitRunner(video, canvas, msgEl) {
  const runner = new Runner(video, canvas, msgEl);
  let evalFn = null;
  return {
    get on() { return runner.on; },
    async start(test, opts, onUpdate) {
      evalFn = makeFitEval(test, { ...opts, w: canvas.width, h: canvas.height });
      await runner.start((lms, ctx, w, h, now) => {
        if (!evalFn.wh) { evalFn = makeFitEval(test, { ...opts, w, h }); evalFn.wh = true; }
        const r = evalFn(lms, now), col = COLORS[r.state] || COLORS.idle;
        if (lms) drawSkeleton(ctx, lms, w, h, col);
        if (r.line != null) { ctx.save(); ctx.setLineDash([12, 8]); ctx.lineWidth = 4; ctx.strokeStyle = "#ffd54a"; ctx.beginPath(); ctx.moveTo(0, r.line * h); ctx.lineTo(w, r.line * h); ctx.stroke(); ctx.restore(); ctx.fillStyle = "#ffd54a"; ctx.font = "bold 16px sans-serif"; ctx.fillText("ยกเข่าถึงเส้นนี้", 12, r.line * h - 8); }
        if (r.reach) { const { toe, fing, cm } = r.reach; ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = cm >= 0 ? "#2ecc71" : "#ffb020"; ctx.beginPath(); ctx.moveTo(toe.x * w, toe.y * h); ctx.lineTo(fing.x * w, fing.y * h); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif"; ctx.fillText(`${cm > 0 ? "+" : ""}${cm} ซม.`, fing.x * w + 10, fing.y * h - 10); ctx.restore(); }
        ctx.save(); ctx.lineWidth = 12; ctx.strokeStyle = col; ctx.globalAlpha = r.state === "idle" ? 0.35 : 0.9; ctx.strokeRect(6, 6, w - 12, h - 12); ctx.restore();
        onUpdate && onUpdate(r);
      });
    },
    stop() { runner.stop(); },
  };
}
window.PreDMFit = { tests: FIT_TESTS, create: makeFitRunner, makeEval: makeFitEval };

/* ---------------- AI tracking page ---------------- */
const MODES = {
  squat: { unit: "ครั้ง", type: "strength", name: "สควอท (AI)", hint: "หันหน้าหรือหันข้างเข้ากล้อง ย่อจนเข่างอประมาณ 90° แล้วยืดตรง" },
  arm: { unit: "ครั้ง", type: "strength", name: "ยกแขนเหนือศีรษะ (AI)", hint: "หันหน้าเข้ากล้อง ยกแขนทั้งสองข้างขึ้นเหนือศีรษะจนสุด แล้วลดลงข้างลำตัว" },
  march: { unit: "ก้าว", type: "aerobic", name: "ย่ำเท้ายกเข่า (AI)", hint: "หันหน้าเข้ากล้อง ยกเข่าสลับซ้าย-ขวาให้สูงใกล้ระดับสะโพก" },
  fist: { unit: "ครั้ง", type: "flex", name: "กำ-แบมือ (AI Hand)", hint: "นั่งหรือยืนก็ได้ ยกมือข้างเดียวหรือสองข้างขึ้นระดับอก หันฝ่ามือเข้ากล้อง แบมือกางนิ้วให้สุด แล้วกำให้แน่น นับ 1 ครั้งเมื่อกำแล้วแบกลับ ช่วยการไหลเวียนเลือดที่มือและนิ้ว ป้องกันมือชา" },
  balance: { unit: "วินาที", type: "balance", name: "ยืนขาเดียว (AI)", hint: "ยืนข้างเก้าอี้ ยกเท้าหนึ่งข้างให้พ้นพื้น นับเวลาเฉพาะตอนยืนขาเดียว" },
};
const T = { tracker: null, runner: null, start: 0, last: null };
function setTrackHint() { const m = MODES[$("#tExercise").value]; $("#tUnit").textContent = m.unit; $("#tHint").textContent = m.hint; }
function showFeedback(r) {
  const f = $("#tFeedback"); f.textContent = r.msg; f.dataset.state = r.state;
  $("#tCount").textContent = r.count; T.last = r;
  if ($("#tVoice")?.checked) App().speakTrack?.(r);
}
function initTracking() {
  T.tracker = makeTracker($("#tVideo"), $("#tCanvas"), $("#tMsg"));
  T.runner = { get on() { return T.tracker.on; } };
  setTrackHint();
  $("#tExercise").addEventListener("change", () => { setTrackHint(); T.tracker.setMode($("#tExercise").value); T.last = null; $("#tCount").textContent = 0; });
  const hs = $("#tHands"); if (hs) { hs.checked = !!App().store.get("showHands", false); T.tracker.setHands(hs.checked); hs.addEventListener("change", () => { App().store.set("showHands", hs.checked); T.tracker.setHands(hs.checked); }); }
  $("#tStart").addEventListener("click", async () => {
    $("#tStart").disabled = true; T.start = performance.now(); T.last = null; $("#tCount").textContent = 0;
    try {
      await T.tracker.start($("#tExercise").value, showFeedback);
      $("#tStop").disabled = false; $("#tExercise").disabled = true;
      if ($("#tVoice")?.checked) App().speak?.(`เริ่ม ${MODES[$("#tExercise").value].name.replace(" (AI)", "")}`, { force: true });
    } catch (e) { $("#tMsg").textContent = "เปิดกล้องไม่ได้: " + (e.message || e) + " · ตรวจสิทธิ์กล้องของเบราว์เซอร์"; $("#tStart").disabled = false; }
  });
  $("#tStop").addEventListener("click", () => {
    T.tracker.stop(); $("#tStart").disabled = false; $("#tStop").disabled = true; $("#tExercise").disabled = false;
    const m = MODES[$("#tExercise").value], mins = Math.max(1, Math.round((performance.now() - T.start) / 60000)), n = T.last?.count || 0;
    if (n > 0) { App().addLog({ type: m.type, name: m.name, minutes: mins, reps: n }); App().toast(`บันทึก ${m.name}: ${n} ${m.unit}`); }
    else App().toast("หยุดแล้ว ยังไม่มีการนับ จึงไม่ได้บันทึก");
  });
}

/* ---------------- game hub: 10 camera games for arms, legs, cardio and balance ---------------- */
const GAMES = {
  bubble: { name: "Bubble Pop", part: "แขน", type: "game", color: "#5aaae6", how: "ใช้มือแตะฟองให้แตก ฟองทอง +3 ฟองน้ำตาล −2 ห้ามแตะ", icon: '<circle cx="9" cy="10" r="5"/><circle cx="17" cy="15" r="3.5"/><circle cx="16" cy="6" r="2"/>' },
  bird: { name: "นกกระพือปีก", part: "แขน · ไหล่", type: "game", color: "#f6c55a", how: "ชูแขนขึ้นเหนือไหล่ แล้วกระพือลงข้างลำตัว นกจะบินสูงขึ้น เก็บดาว หลบก้อนน้ำตาล", icon: '<path d="M3 13c3-5 6-6 9-3 3-3 6-2 9 3-3-1-6 0-9 3-3-3-6-4-9-3z"/>' },
  kick: { name: "เตะดาว", part: "ขา", type: "game", color: "#7ee08a", how: "ยกเท้าหรือเข่าแตะดาวที่ลอยใกล้พื้นทั้งซ้ายและขวา ดาวทอง +2", icon: '<path d="M12 3l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 15.2 7 18l1.2-5.6L4 8.6l5.6-.6z"/>' },
  squat: { name: "สควอทเป่าลูกโป่ง", part: "ขา · สะโพก", type: "strength", color: "#f2a891", how: "ย่อเข่าแล้วยืนขึ้น 1 ครั้ง = สูบลม 1 ครั้ง ครบ 5 ครั้งลูกโป่งลอยขึ้นฟ้า", icon: '<ellipse cx="12" cy="9" rx="6" ry="7"/><path d="M12 16l-1.5 2h3zM12 18v4"/>' },
  balance: { name: "ยืนขาเดียวสู้ลม", part: "ทรงตัว", type: "balance", color: "#b18cff", how: "ยกเท้าข้างหนึ่งให้พ้นพื้น ยืนให้นานที่สุด สลับขาเมื่อได้ยินสัญญาณ ทุก 1 วินาที = 1 คะแนน", icon: '<circle cx="12" cy="4" r="2"/><path d="M12 6v8l-1 7M12 14l4 2M6 9h12"/>' },
  jack: { name: "ดาวกระจาย", part: "แขน · ขา · หัวใจ", type: "game", color: "#ff8fb1", how: "ชูแขนเหนือศีรษะพร้อมกางขา แล้วหุบกลับ 1 ครั้ง = พลุ 1 ลูก (ระดับง่าย: ชูแขนอย่างเดียว)", icon: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/><circle cx="12" cy="12" r="2.5"/>' },
  march: { name: "ย่ำเท้าเก็บผัก", part: "ขา · หัวใจ", type: "game", color: "#6fcf97", how: "ย่ำเท้ายกเข่าสลับซ้าย-ขวาอยู่กับที่ ทุก 3–4 ก้าว ผักจะเด้งจากเท้าลอยลงตะกร้า ยิ่งย่ำมาก ผักในตะกร้ายิ่งเต็ม", icon: '<path d="M4 15h13l2-6H7"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M10 9c0-3 2-5 4-5"/>' },
  punch: { name: "ชกขนมหวาน", part: "แขน · ไหล่", type: "game", color: "#f2994a", how: "เหยียดแขนชกขนมหวานที่ลอยมาให้กระเด็น! ระดับ 2–3 ระวังอย่าชกผัก", icon: '<path d="M6 10a4 4 0 0 1 4-4h5a3 3 0 0 1 3 3v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M9 6v4M12 6v4M15 7v3"/>' },
  reach: { name: "เอื้อมเก็บผลไม้", part: "แขน · ยืดตัว", type: "game", color: "#56ccf2", how: "ยืดตัวเอื้อมมือขึ้นสูงเก็บผลไม้บนต้น ซ้ายบ้าง ขวาบ้าง ระวังลูกอมน้ำตาล", icon: '<path d="M12 21V11"/><circle cx="12" cy="7" r="5"/><circle cx="9" cy="8" r="1.5"/><circle cx="15" cy="6" r="1.5"/>' },
  dodge: { name: "ตะกร้ารับผัก หลบน้ำตาล", part: "ขา · ทรงตัว", type: "game", color: "#bb6bd9", how: "ก้าวหรือเอนตัวซ้าย-ขวาให้ตะกร้ารับผักที่ตกลงมา หลบขนมหวาน", icon: '<path d="M4 11h16l-2 9H6z"/><path d="M8 11l3-6M16 11l-3-6"/>' },
};
const G = { id: "bubble", runner: null, running: false, score: 0, end: 0, last: 0, lastT: 0, objs: [], pops: [], bird: { y: 0.5, vy: 0 }, flapUp: false, stage: "up", pumps: 0, balloons: 0, hold: 0, nextSwitch: 15, milestone: 0 };
const bests = () => App().store.get("bestScores", {});
// touch points for the reaching games: wrists + pose finger points, plus thumb/index/middle fingertips from MediaPipe Hand
const touchPts = (lms) => { const p = lms ? [15, 16, 19, 20].filter((i) => lms[i] && lms[i].v > 0.4).map((i) => lms[i]) : []; (G.hands || []).forEach((hd) => [4, 8, 12].forEach((i) => p.push(hd.pts[i]))); return p; };
const say = (t, f) => { if ($("#gVoice")?.checked) App().speak?.(t, { force: f }); };
function selectGame(id) {
  if (G.running) return;
  G.id = id; const g = GAMES[id];
  document.querySelectorAll("#gamePick .gcard").forEach((c) => c.setAttribute("aria-checked", c.dataset.game === id));
  $("#gName").textContent = g.name; $("#gPart").textContent = g.part; $("#gPart").style.background = g.color; $("#gHow").textContent = g.how;
  $("#gBest").textContent = bests()[id] || (id === "bubble" ? App().store.get("bestScore", 0) : 0);
  $("#gMsg").textContent = `${g.name}: ${g.how}`;
}
function renderPick() {
  const b = bests();
  $("#gamePick").innerHTML = Object.entries(GAMES).map(([id, g]) => `<button type="button" class="gcard" role="radio" aria-checked="${id === G.id}" data-game="${id}" style="--gc:${g.color}">
    <span class="gicon"><svg viewBox="0 0 24 24" aria-hidden="true">${g.icon}</svg></span><b>${g.name}</b><small>${g.part}</small><em>สถิติ ${b[id] || (id === "bubble" ? App().store.get("bestScore", 0) : 0)}</em></button>`).join("");
}
const star = (ctx, x, y, r, col) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke(); };
const sugar = (ctx, x, y, s) => { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#e05246"; ctx.lineWidth = 3; ctx.fillRect(x - s, y - s, s * 2, s * 2); ctx.strokeRect(x - s, y - s, s * 2, s * 2); ctx.fillStyle = "#e05246"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("น้ำตาล", x, y + 5); ctx.textAlign = "start"; };
function popText(ctx, w, h, now) { G.pops = G.pops.filter((p) => now - p.t < 600); G.pops.forEach((p) => { ctx.fillStyle = p.v < 0 ? "#ff8a7a" : "#fff"; ctx.font = "bold 30px sans-serif"; ctx.fillText((p.v > 0 ? "+" : "") + p.v, p.x * w - 14, p.y * h - (now - p.t) / 10); }); }
function addScore(v, x, y, now) { G.score = Math.max(0, G.score + v); G.pops.push({ x, y, v, t: now }); if (G.score >= G.milestone + 10) { G.milestone += 10; say(`${G.milestone} คะแนน เยี่ยมมาก`); } }
// 3D pictures drawn on the game canvas (self-hosted); falls back to the emoji until the picture has loaded
const PICS = {};
function pic(path) { if (!PICS[path]) { const im = new Image(); im.src = path; PICS[path] = im; } return PICS[path]; }
function drawPic(ctx, path, ch, x, y, size) { const im = pic(path); if (im.complete && im.naturalWidth) ctx.drawImage(im, x - size / 2, y - size / 2, size, size); else emo(ctx, ch, x, y, size * 0.85); }
const VEG = [["🥬", "leafy_green"], ["🥦", "broccoli"], ["🥕", "carrot"], ["🍅", "tomato"], ["🌽", "ear_of_corn"], ["🍆", "eggplant"], ["🥒", "cucumber"], ["🍄", "brown_mushroom"]];
const emo = (ctx, ch, x, y, size) => { ctx.save(); ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ch, x, y); ctx.restore(); };
const label = (ctx, text, x, y, bg = "rgba(0,0,0,.55)") => { ctx.save(); ctx.font = "bold 20px sans-serif"; const tw = ctx.measureText(text).width; ctx.fillStyle = bg; ctx.fillRect(x - 10, y - 28, tw + 20, 40); ctx.fillStyle = "#fff"; ctx.fillText(text, x, y); ctx.restore(); };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const seen = (lms, ids, t = 0.4) => lms && ids.every((i) => lms[i] && lms[i].v > t);
const GAME_FRAME = {
  jack(lms, ctx, w, h, now, dt, lv) {
    if (G.running && seen(lms, [0, 11, 12, 15, 16, 27, 28])) {
      const sw = Math.abs(lms[11].x - lms[12].x), up = lms[15].y < lms[0].y && lms[16].y < lms[0].y;
      const wide = Math.abs(lms[27].x - lms[28].x) > sw * [0, 1.0, 1.3, 1.6][lv];
      if ((lv === 1 ? up : up && wide) && G.stage !== "out") G.stage = "out";
      else if (G.stage === "out" && lms[15].y > lms[11].y && lms[16].y > lms[12].y) {
        G.stage = "in"; G.score++; say(String(G.score), true);
        const cx = 0.2 + Math.random() * 0.6, cy = 0.15 + Math.random() * 0.25, col = pick(["#ff8fb1", "#ffd45c", "#7ee08a", "#5aaae6", "#b18cff"]);
        for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; G.objs.push({ x: cx, y: cy, vx: Math.cos(a) * 0.35, vy: Math.sin(a) * 0.35, born: now, col }); }
      }
    }
    G.objs = G.objs.filter((p) => now - p.born < 1100);
    G.objs.forEach((p) => { const t = (now - p.born) / 1000; ctx.globalAlpha = 1 - t / 1.1; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc((p.x + p.vx * t) * w, (p.y + p.vy * t + 0.15 * t * t) * h, 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
    label(ctx, G.stage === "out" ? "หุบแขนลง!" : lv === 1 ? "ชูแขนเหนือศีรษะ" : "ชูแขน + กางขา", w * 0.36, 44);
    label(ctx, `ดาวกระจาย ${G.score} ครั้ง`, 24, h - 26);
  },
  march(lms, ctx, w, h, now, dt, lv) {
    G.speed = Math.max(0, (G.speed || 0) - dt * 0.6);
    const gy = h * 0.8, bx = w * 0.8, by = gy - 20, bs = Math.min(w, h) * 0.3; // basket position and size
    G.basket = G.basket || []; G.flying = G.flying || [];
    const every = [0, 3, 4, 4][lv]; // steps per vegetable
    if (G.running && seen(lms, [23, 24, 25, 26], 0.35)) {
      const lift = [0, 0.13, 0.10, 0.07][lv];
      [["L", 23, 25, 27], ["R", 24, 26, 28]].forEach(([side, hip, knee, ank]) => {
        const rel = lms[knee].y - lms[hip].y, up = (G.legUp || (G.legUp = {}))[side];
        if (!up && rel < lift) {
          G.legUp[side] = true;
          if (G.lastSide !== side) {
            G.lastSide = side; G.score++; G.speed = Math.min(1.6, G.speed + 0.35);
            if (G.score % every === 0) { // a vegetable pops up from the stepping foot and flies into the basket
              const foot = lms[ank]?.v > 0.3 ? lms[ank] : lms[knee], v = VEG[Math.floor(Math.random() * VEG.length)];
              G.flying.push({ v, x0: Math.min(0.7, foot.x) * w, y0: Math.min(gy, foot.y * h), born: now, spin: (Math.random() - 0.5) * 6 });
            }
          }
        } else if (up && rel > lift + 0.06) G.legUp[side] = false;
      });
    }
    G.dist = (G.dist || 0) + G.speed * dt;
    ctx.fillStyle = "rgba(160,120,80,.35)"; ctx.fillRect(0, gy, w, h - gy);
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 6; ctx.setLineDash([40, 30]); ctx.lineDashOffset = -G.dist * 400; ctx.beginPath(); ctx.moveTo(0, gy + 30); ctx.lineTo(w, gy + 30); ctx.stroke(); ctx.setLineDash([]);
    // vegetables already in the basket: a pile that grows (drawn first so the basket front hides their lower half)
    const bounce = G.caught && now - G.caught < 250 ? Math.sin(((now - G.caught) / 250) * Math.PI) * 8 : 0, vs = bs * 0.34;
    G.basket.slice(-15).forEach((o, i) => { const row = Math.floor(i / 5), col = i % 5; drawPic(ctx, `vendor/food3d/${o.v[1]}.webp`, o.v[0], bx - bs * 0.32 + col * bs * 0.16 + (row % 2) * bs * 0.08, by - bs * 0.12 - row * vs * 0.45 + bounce, vs); });
    drawPic(ctx, "vendor/fit3d/basket.webp", "🧺", bx, by + bs * 0.05 + bounce, bs);
    // flying vegetables: arc from the foot into the basket, then land in the pile
    const FLY = 750;
    G.flying = G.flying.filter((o) => {
      const t = Math.min(1, (now - o.born) / FLY);
      if (t >= 1) { G.basket.push(o); G.caught = now; if (G.basket.length % 5 === 0) say(`ผัก ${G.basket.length} ชิ้นแล้ว`, false); return false; }
      const x = o.x0 + (bx - o.x0) * t, y = o.y0 + (by - bs * 0.2 - o.y0) * t - Math.sin(t * Math.PI) * h * 0.28;
      ctx.save(); ctx.translate(x, y); ctx.rotate(o.spin * t); drawPic(ctx, `vendor/food3d/${o.v[1]}.webp`, o.v[0], 0, 0, vs * (1.25 - t * 0.25)); ctx.restore();
      return true;
    });
    // count badge on the basket
    const n = G.basket.length; ctx.fillStyle = "#2f8a4a"; ctx.beginPath(); ctx.arc(bx + bs * 0.38, by - bs * 0.38, 24, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(n), bx + bs * 0.38, by - bs * 0.38); ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
    label(ctx, `ย่ำแล้ว ${G.score} ก้าว · ผักในตะกร้า ${n} ชิ้น`, 24, h - 26);
    label(ctx, G.speed > 0.5 ? "เร็วมาก! 🔥" : `ยกเข่าสลับซ้าย-ขวา ทุก ${every} ก้าวได้ผัก 1 ชิ้น`, w * 0.28, 44);
  },
  punch(lms, ctx, w, h, now, dt, lv) {
    if (G.running && now - G.last > 1150 - lv * 200) { G.last = now; const veg = lv > 1 && Math.random() < 0.2;
      G.objs.push({ x: 0.22 + Math.random() * 0.56, y: 0.2 + Math.random() * 0.32, e: veg ? pick(["🥦", "🥬", "🥕"]) : pick(["🍩", "🧋", "🍬", "🍰", "🥤", "🍫"]), veg, born: now, life: 3000 - lv * 450 }); }
    const ext = [0, 115, 135, 150][lv], fists = [];
    if (seen(lms, [11, 13, 15])) fists.push({ p: lms[15], ok: angle(lms[11], lms[13], lms[15]) > ext });
    if (seen(lms, [12, 14, 16])) fists.push({ p: lms[16], ok: angle(lms[12], lms[14], lms[16]) > ext });
    (G.hands || []).forEach((hd) => fists.push({ p: hd.pts[9], ok: handOpen(hd) < 1.45 })); // MediaPipe Hand: a clenched fist punches
    G.objs = G.objs.filter((o) => { if (o.hit) return now - o.hit < 400; if (now - o.born > o.life) return false;
      if (G.running && fists.some((f) => f.ok && Math.hypot((f.p.x - o.x) * w, (f.p.y - o.y) * h) < 0.07 * w)) { o.hit = now; addScore(o.veg ? -2 : 1, o.x, o.y, now); if (o.veg) say("อย่าชกผักนะ", true); } return true; });
    G.objs.forEach((o) => { if (o.hit) { const t = (now - o.hit) / 400; ctx.globalAlpha = 1 - t; emo(ctx, o.e, o.x * w + t * 120, o.y * h - t * 80, 54 + t * 20); emo(ctx, "💥", o.x * w, o.y * h, 60); ctx.globalAlpha = 1; } else emo(ctx, o.e, o.x * w, o.y * h + Math.sin((now - o.born) / 160) * 6, 56); });
    fists.forEach((f) => emo(ctx, "🥊", f.p.x * w, f.p.y * h, f.ok ? 46 : 32));
    label(ctx, "เหยียดแขนสุดแล้วชก!", w * 0.34, 44);
  },
  reach(lms, ctx, w, h, now, dt, lv) {
    ctx.fillStyle = "rgba(76,160,80,.35)"; ctx.fillRect(0, 0, w, h * 0.12);
    if (G.running && now - G.last > 1300 - lv * 220) { G.last = now; const bad = lv > 1 && Math.random() < 0.2, left = Math.random() < 0.5;
      G.objs.push({ x: left ? 0.06 + Math.random() * 0.3 : 0.64 + Math.random() * 0.3, y: 0.05 + Math.random() * (lv === 1 ? 0.22 : 0.16), e: bad ? "🍬" : pick(["🍐", "🍏", "🍊", "🥭", "🍈"]), bad, born: now, life: 3600 - lv * 500 }); }
    const hands = touchPts(lms);
    G.objs = G.objs.filter((o) => { if (now - o.born > o.life) return false;
      if (G.running && hands.some((p) => Math.hypot((p.x - o.x) * w, (p.y - o.y) * h) < 0.06 * w + 10)) { addScore(o.bad ? -2 : 1, o.x, o.y, now); return false; } return true; });
    G.objs.forEach((o) => { ctx.strokeStyle = "rgba(90,60,30,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x * w, 0); ctx.lineTo(o.x * w, o.y * h - 22); ctx.stroke(); emo(ctx, o.e, o.x * w, o.y * h + Math.sin(now / 200 + o.x * 9) * 4, 52); });
    label(ctx, "เอื้อมมือเก็บผลไม้บนต้น", w * 0.3, h - 26);
  },
  dodge(lms, ctx, w, h, now, dt, lv) {
    let px = G.px ?? 0.5;
    if (seen(lms, [11, 12], 0.4)) { const tx = seen(lms, [23, 24], 0.35) ? (lms[23].x + lms[24].x) / 2 : (lms[11].x + lms[12].x) / 2; px = G.px = px + (tx - px) * Math.min(1, dt * 10); }
    if (G.running && now - G.last > 900 - lv * 150) { G.last = now; const bad = Math.random() < 0.3 + lv * 0.05;
      G.objs.push({ x: 0.08 + Math.random() * 0.84, y: -0.05, e: bad ? pick(["🍬", "🧋", "🍩", "🥤"]) : pick(["🥦", "🥬", "🍐", "🥕", "🍅"]), bad }); }
    const sp = (0.22 + lv * 0.07) * dt;
    G.objs = G.objs.filter((o) => { if (G.running) o.y += sp; if (o.y > 1.05) return false;
      if (G.running && o.y > 0.78 && o.y < 0.92 && Math.abs(o.x - px) < 0.11) { addScore(o.bad ? -2 : 1, o.x, o.y, now); return false; } return true; });
    G.objs.forEach((o) => emo(ctx, o.e, o.x * w, o.y * h, 48));
    emo(ctx, "🧺", px * w, h * 0.86, 84);
    label(ctx, "เอนตัวซ้าย-ขวา รับผัก หลบขนม", w * 0.28, 44);
  },
  bubble(lms, ctx, w, h, now, dt, lv) {
    if (G.running && now - G.last > 900 - lv * 180) { G.last = now; const r = Math.random(), kind = r < 0.12 ? "gold" : r < 0.12 + 0.08 * lv ? "sugar" : "blue";
      G.objs.push({ x: 0.12 + Math.random() * 0.76, y: lv === 1 ? 0.15 + Math.random() * 0.35 : 0.1 + Math.random() * 0.55, r: kind === "gold" ? 0.045 : 0.06, kind, born: now, life: 4200 - lv * 700 }); }
    const hands = touchPts(lms);
    G.objs = G.objs.filter((b) => { if (now - b.born > b.life) return false;
      if (G.running && hands.some((p) => Math.hypot((p.x - b.x) * w, (p.y - b.y) * h) < b.r * w + 14)) { addScore(b.kind === "gold" ? 3 : b.kind === "sugar" ? -2 : 1, b.x, b.y, now); return false; } return true; });
    G.objs.forEach((b) => { const age = (now - b.born) / b.life, col = b.kind === "gold" ? "240,180,64" : b.kind === "sugar" ? "224,82,70" : "90,170,230";
      ctx.beginPath(); ctx.arc(b.x * w, b.y * h, b.r * w, 0, 7); ctx.fillStyle = `rgba(${col},${0.55 - age * 0.3})`; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = `rgb(${col})`; ctx.stroke();
      if (b.kind === "sugar") { ctx.fillStyle = "#fff"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("น้ำตาล", b.x * w, b.y * h + 6); ctx.textAlign = "start"; } });
  },
  bird(lms, ctx, w, h, now, dt, lv) {
    const B = G.bird;
    if (lms && lms[15].v > 0.4 && lms[16].v > 0.4) {
      const wy = (lms[15].y + lms[16].y) / 2, sy = (lms[11].y + lms[12].y) / 2;
      if (wy < sy - 0.03) G.flapUp = true;
      else if (G.flapUp && wy > sy + 0.12) { G.flapUp = false; B.vy = -0.5; G.flaps = (G.flaps || 0) + 1; }
    }
    if (G.running) { B.vy += 0.42 * dt; B.y = Math.max(0.08, Math.min(0.9, B.y + B.vy * dt)); }
    if (G.running && now - G.last > 1300 - lv * 200) { G.last = now; G.objs.push({ x: 1.05, y: 0.15 + Math.random() * 0.7, kind: Math.random() < 0.22 + lv * 0.05 ? "sugar" : "star" }); }
    const sp = (0.18 + lv * 0.05) * dt;
    G.objs = G.objs.filter((o) => { o.x -= G.running ? sp : 0; if (o.x < -0.1) return false;
      if (G.running && Math.hypot((o.x - 0.24) * w, (o.y - B.y) * h) < 0.06 * w) { addScore(o.kind === "star" ? 1 : -2, o.x, o.y, now); return false; } return true; });
    ctx.fillStyle = "rgba(110,195,236,.18)"; ctx.fillRect(0, 0, w, h);
    G.objs.forEach((o) => (o.kind === "star" ? star(ctx, o.x * w, o.y * h, 16, "#f6c55a") : sugar(ctx, o.x * w, o.y * h, 16)));
    const bx = 0.24 * w, by = B.y * h, flap = Math.sin(now / 90) * (B.vy < 0 ? 1 : 0.3);
    ctx.fillStyle = "#ffd45c"; ctx.beginPath(); ctx.ellipse(bx, by, 26, 20, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#f2994a"; ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx - 30, by - 18 - flap * 16); ctx.lineTo(bx - 14, by + 6); ctx.fill();
    ctx.fillStyle = "#e9785a"; ctx.beginPath(); ctx.moveTo(bx + 24, by - 2); ctx.lineTo(bx + 36, by + 3); ctx.lineTo(bx + 24, by + 7); ctx.fill();
    ctx.fillStyle = "#17191b"; ctx.beginPath(); ctx.arc(bx + 12, by - 6, 3.5, 0, 7); ctx.fill();
  },
  kick(lms, ctx, w, h, now, dt, lv) {
    if (G.running && now - G.last > 1400 - lv * 250) { G.last = now; const left = Math.random() < 0.5;
      G.objs.push({ x: left ? 0.15 + Math.random() * 0.22 : 0.63 + Math.random() * 0.22, y: 0.62 + Math.random() * (lv === 1 ? 0.12 : 0.24), gold: Math.random() < 0.18, born: now, life: 3400 - lv * 500 }); }
    const feet = lms ? [25, 26, 27, 28, 29, 30, 31, 32].filter((i) => lms[i] && lms[i].v > 0.35).map((i) => lms[i]) : [];
    G.objs = G.objs.filter((o) => { if (now - o.born > o.life) return false;
      if (G.running && feet.some((p) => Math.hypot((p.x - o.x) * w, (p.y - o.y) * h) < 0.055 * w + 12)) { addScore(o.gold ? 2 : 1, o.x, o.y, now); return false; } return true; });
    ctx.fillStyle = "rgba(126,224,138,.14)"; ctx.fillRect(0, h * 0.58, w, h * 0.42);
    G.objs.forEach((o) => { const age = (now - o.born) / o.life; ctx.globalAlpha = 1 - age * 0.5; star(ctx, o.x * w, o.y * h, 22 + Math.sin(now / 150) * 2, o.gold ? "#f6c55a" : "#7ee08a"); ctx.globalAlpha = 1; });
  },
  squat(lms, ctx, w, h, now, dt, lv) {
    const k = lms ? kneeAngle(lms) : null;
    if (k != null && G.running) {
      if (k < (lv === 1 ? 125 : 110)) G.stage = "down";
      else if (k > 160 && G.stage === "down") { G.stage = "up"; G.pumps++; G.score = G.pumps; say(String(G.pumps), true);
        if (G.pumps % 5 === 0) { G.balloons++; G.objs.push({ x: 0.78, y: 0.55, vy: -0.25, col: ["#e9785a", "#5aaae6", "#f6c55a", "#b18cff", "#7ee08a"][G.balloons % 5] }); say("ลูกโป่งลอยแล้ว", false); } }
    }
    G.objs = G.objs.filter((o) => { o.y += o.vy * dt; return o.y > -0.2; });
    G.objs.forEach((o) => { ctx.fillStyle = o.col; ctx.beginPath(); ctx.ellipse(o.x * w, o.y * h, 30, 38, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(o.x * w, o.y * h + 38); ctx.lineTo(o.x * w, o.y * h + 80); ctx.stroke(); });
    const r = 22 + (G.pumps % 5) * 9, cx = w * 0.8, cy = h * 0.62, col = ["#e9785a", "#5aaae6", "#f6c55a", "#b18cff", "#7ee08a"][(G.balloons + 1) % 5];
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy - r, r * 0.85, r, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 1.3, r * 0.18, r * 0.3, -0.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#5a6378"; ctx.fillRect(cx - 6, cy, 12, h * 0.25); ctx.fillRect(cx - 30, cy + h * 0.25 - 8, 60, 10);
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(14, h - 54, 230, 40); ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif";
    ctx.fillText(`สควอท ${G.pumps} · ลูกโป่ง ${G.balloons}`, 24, h - 27);
    ctx.fillText(G.stage === "down" ? "ดันตัวขึ้น!" : "ย่อเข่าลง", w * 0.38, 40);
  },
  balance(lms, ctx, w, h, now, dt, lv) {
    let up = false;
    if (lms && lms[27].v > 0.4 && lms[28].v > 0.4) up = Math.abs(lms[27].y - lms[28].y) > (lv === 1 ? 0.035 : 0.05);
    if (G.running && up) { G.hold += dt; G.score = Math.floor(G.hold); }
    const elapsed = (G.dur || 60) - Math.max(0, (G.end - now) / 1000);
    if (G.running && elapsed >= G.nextSwitch) { G.nextSwitch += 15; say("สลับขา", true); G.pops.push({ x: 0.4, y: 0.3, v: 0, t: now, text: "สลับขา!" }); }
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const y = h * (0.15 + i * 0.12), x = ((now / (6 - lv) + i * 140) % (w + 200)) - 100; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 40, y - 12, x + 90, y); ctx.stroke(); }
    ctx.fillStyle = up ? "rgba(46,204,113,.85)" : "rgba(255,77,77,.85)"; ctx.fillRect(14, 14, 230, 40);
    ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif"; ctx.fillText(up ? `ทรงตัวดี ${G.hold.toFixed(1)} วิ` : "ยกเท้าข้างหนึ่งขึ้น", 24, 41);
    G.pops.filter((p) => p.text && now - p.t < 1500).forEach((p) => { ctx.fillStyle = "#ffd45c"; ctx.font = "bold 40px sans-serif"; ctx.fillText(p.text, w * 0.35, h * 0.3); });
  },
};
function gameFrame(lms, ctx, w, h, now, hands) {
  const dt = G.lastT ? Math.min(0.05, (now - G.lastT) / 1000) : 0; G.lastT = now;
  const lv = +$("#gLevel").value;
  G.hands = hands || null;
  if (lms) drawSkeleton(ctx, lms, w, h, "rgba(63,191,133,.7)");
  if (hands) drawHands(ctx, hands, w, h);
  GAME_FRAME[G.id](lms, ctx, w, h, now, dt, lv);
  if (G.id !== "balance") popText(ctx, w, h, now);
  if (G.running) { const left = Math.max(0, Math.ceil((G.end - now) / 1000)); $("#gTime").textContent = left; $("#gScore").textContent = G.score; if (left <= 3 && left > 0 && left !== G.spoken) { G.spoken = left; say(String(left), true); } if (left === 0) finishGame(); }
}
function resetGame() { Object.assign(G, { basket: [], flying: [], caught: 0, objs: [], pops: [], score: 0, bird: { y: 0.5, vy: 0 }, flapUp: false, stage: G.id === "jack" ? "in" : "up", pumps: 0, balloons: 0, hold: 0, nextSwitch: 15, milestone: 0, lastT: 0, spoken: null, flaps: 0, legUp: {}, lastSide: null, speed: 0, dist: 0, px: 0.5 }); }
function finishGame() {
  G.running = false; G.runner.stop(); $("#gStart").disabled = false; $("#gStop").hidden = true;
  const b = bests(), prev = b[G.id] || 0, g = GAMES[G.id];
  if (G.score > prev) { b[G.id] = G.score; App().store.set("bestScores", b); }
  if (G.id === "bubble" && G.score > App().store.get("bestScore", 0)) App().store.set("bestScore", G.score);
  $("#gMsg").textContent = `จบเกมส์ ${g.name}! ได้ ${G.score} คะแนน${G.score > prev ? " · สถิติใหม่!" : ""} กดเริ่มเพื่อเล่นอีกครั้ง หรือเลือกเกมส์อื่น`;
  say(`จบเกมส์ ได้ ${G.score} คะแนน${G.score > prev ? " สถิติใหม่" : ""}`, true);
  if (G.score > 0) App().addLog({ type: g.type, name: g.name, minutes: 1, score: G.score }); // a game stopped with no points is not logged
  App().renderBadges(); renderPick(); selectGame(G.id);
}
function initGame() {
  G.runner = new Runner($("#gVideo"), $("#gCanvas"), $("#gMsg"));
  renderPick(); selectGame("bubble");
  $("#gamePick").addEventListener("click", (e) => { const c = e.target.closest(".gcard"); if (c) selectGame(c.dataset.game); });
  $("#gStop").addEventListener("click", () => { // end early: keeps the score so far
    clearInterval(G.cd);
    if (G.running) return finishGame();
    G.runner.stop(); $("#gStart").disabled = false; $("#gStop").hidden = true; $("#gMsg").hidden = false; $("#gMsg").textContent = "หยุดแล้ว กดเริ่มเพื่อเล่นใหม่";
  });
  $("#gStart").addEventListener("click", async () => {
    $("#gStart").disabled = true;
    G.runner.hands = true; // MediaPipe Hand is always on in every camera game: fingers are drawn and fingertips / fists count
    resetGame(); G.dur = 60;
    $("#gScore").textContent = 0;
    try {
      await G.runner.start(gameFrame);
      let n = 3; $("#gMsg").hidden = false; $("#gMsg").textContent = `${GAMES[G.id].name} · เตรียมตัว… ${n}`; say(`${GAMES[G.id].name} เตรียมตัว`, true);
      $("#gStop").hidden = false;
      const iv = G.cd = setInterval(() => { n--; if (n > 0) { $("#gMsg").textContent = `${GAMES[G.id].name} · เตรียมตัว… ${n}`; say(String(n), true); } else { clearInterval(iv); $("#gMsg").hidden = true; G.end = performance.now() + 60000; G.last = 0; G.running = true; say("เริ่ม", true); } }, 1000);
    } catch (e) { $("#gMsg").textContent = "เปิดกล้องไม่ได้: " + (e.message || e); $("#gStart").disabled = false; }
  });
}

// Stop the camera when the user leaves the page section.
window.addEventListener("predm:view", (e) => {
  if (e.detail !== "tracking" && T.runner?.on) $("#tStop").click();
  if (e.detail !== "game" && G.runner?.on) { clearInterval(G.cd); G.running = false; G.runner.stop(); $("#gStart").disabled = false; $("#gStop").hidden = true; }
});

initTracking(); initGame();
// shared with the AR exercise picker (arfit.js)
const HAND_GAMES = new Set(Object.keys(GAMES)); // MediaPipe Hand runs in every AR game
const arGame = {
  handy: (id) => HAND_GAMES.has(id),
  start(id, lv, secs) { G.id = id; resetGame(); G.arLv = lv; G.dur = secs; G.end = performance.now() + secs * 1000; G.last = 0; G.running = true; G.ar = true; },
  frame(lms, ctx, w, h, now, hands) {
    if (!G.ar) return null;
    const dt = G.lastT ? Math.min(0.05, (now - G.lastT) / 1000) : 0; G.lastT = now; G.hands = hands || null;
    if (lms) drawSkeleton(ctx, lms, w, h, "rgba(63,191,133,.7)");
    if (hands) drawHands(ctx, hands, w, h);
    GAME_FRAME[G.id](lms, ctx, w, h, now, dt, G.arLv);
    if (G.id !== "balance") popText(ctx, w, h, now);
    const left = Math.max(0, Math.ceil((G.end - now) / 1000)); if (left === 0) G.running = false;
    return { score: G.score, left, running: G.running };
  },
  stop() { // save best score + exercise log, like the games page
    const g = GAMES[G.id], score = G.score, b = bests(), prev = b[G.id] || 0, mins = Math.max(1, Math.round((G.dur - Math.max(0, (G.end - performance.now()) / 1000)) / 60));
    G.running = false; G.ar = false; G.objs = [];
    if (score > prev) { b[G.id] = score; App().store.set("bestScores", b); }
    if (score > 0) { App().addLog({ type: g.type, name: g.name + " (AR)", minutes: mins, score }); App().renderBadges(); }
    return { score, best: Math.max(prev, score), record: score > prev && prev > 0 };
  },
};
// warm-up: download + prepare the AI models in the background so the camera opens fast (models stay cached by the service worker)
let warming = null;
function warm() { if (!warming) warming = Promise.all([getLandmarker(null), getHandLandmarker(null)]).catch(() => { warming = null; }); return warming; }
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 1500));
window.addEventListener("predm:view", (e) => { if (["game", "tracking", "exercise"].includes(e.detail)) idle(warm); });
if (["#game", "#tracking", "#exercise"].includes(location.hash)) idle(warm);
document.addEventListener("pointerover", (e) => { if (e.target.closest?.("[data-arfit],[data-handgame],#gStart,#tStart,#plStart,.gcard")) warm(); }, { passive: true });
document.addEventListener("pointerdown", (e) => { if (e.target.closest?.("[data-arfit],[data-handgame],#gStart,#tStart,.gcard")) warm(); }, { passive: true });
Object.assign(window.PreDMTrack, { Runner, makeEval, drawSkeleton, drawHands, COLORS, modes: MODES, games: GAMES, arGame, warm, getHand: () => getHandLandmarker(null),
  startGame(id) { location.hash = "game"; setTimeout(() => { selectGame(id); $("#gStart").click(); }, 350); } });
window.dispatchEvent(new Event("predm:track-ready"));

/* ---------------- still-photo pose detection (AI Body Transformation) ---------------- */
let imageLandmarker = null;
async function getImageLandmarker() {
  if (imageLandmarker) return imageLandmarker;
  const fs = await FilesetResolver.forVisionTasks(WASM);
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL_FULL, delegate }, runningMode: "IMAGE", numPoses: 1 });
  try { imageLandmarker = await PoseLandmarker.createFromOptions(fs, opts("GPU")); }
  catch { imageLandmarker = await PoseLandmarker.createFromOptions(fs, opts("CPU")); }
  return imageLandmarker;
}
// Returns 33 landmarks in pixel coordinates of the given canvas/image, or null if no person is found.
window.PreDMPose = {
  async detect(source) {
    const lm = await getImageLandmarker();
    const res = lm.detect(source);
    const pts = res.landmarks?.[0];
    if (!pts) return null;
    const w = source.width, h = source.height;
    return pts.map((p) => ({ x: p.x * w, y: p.y * h, v: p.visibility ?? 1 }));
  },
};
