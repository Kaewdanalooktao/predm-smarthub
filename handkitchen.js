/* Pre-DM Smart Hub — "ครัวแตะมือ" camera games (MediaPipe Hand, runs fully on this device).
   Open the camera, then point with the index finger at a floating card and hold still for a moment to choose it.
   1) จัดพาข้าวด้วยมือ — pick rice → protein → 2 vegetables → a drink, then the plate is scored with the same rules as เกมจัดสำรับ.
   2) ตำส้มตำด้วยมือ — pick 6 ingredients for the mortar, then pound by moving the hand up and down (light arm exercise).
   No camera? The mouse / finger on the screen works as the pointer. Video never leaves the device and is not recorded. */
import { HandLandmarker, FilesetResolver } from "./vendor/mediapipe/vision_bundle.mjs";

const WASM = new URL("vendor/mediapipe/wasm", location.href).href;
const MODEL = new URL("vendor/models/hand_landmarker.task", location.href).href;
const DWELL = 900; // ms of hovering to choose a card
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const img = (e, key) => (window.FI ? window.FI(e, key) : e);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const say = (t) => { const el = $("#hkSay"); if (el) el.textContent = t; };

let landmarker = null;
async function getLandmarker() {
  if (landmarker) return landmarker;
  const fs = await FilesetResolver.forVisionTasks(WASM);
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numHands: 1, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
  try { landmarker = await HandLandmarker.createFromOptions(fs, opts("GPU")); } catch { landmarker = await HandLandmarker.createFromOptions(fs, opts("CPU")); }
  return landmarker;
}

/* ------------------------------------------------------------------ game data */
const SOMTAM = [ // [emoji, name, points, why]
  ["🥗", "มะละกอเส้น", 2, "ผักหลักของส้มตำ ใยอาหารดี"], ["🍅", "มะเขือเทศ", 2, "เพิ่มผักและรสเปรี้ยวธรรมชาติ"], ["🫛", "ถั่วฝักยาว", 2, "ใยอาหารสูง"],
  ["🥒", "แตงกวา", 2, "ผักแนม เพิ่มความอิ่ม"], ["🍋", "มะนาว", 1, "รสเปรี้ยวแทนการเติมน้ำปลา"], ["🌶️", "พริก", 1, "เพิ่มรสจัดโดยไม่เพิ่มเกลือ"],
  ["🧄", "กระเทียม", 1, "หอม ช่วยลดผงปรุง"], ["🦐", "กุ้งแห้ง", 1, "โปรตีน (เค็มนิด ใส่น้อย)"], ["🫙", "ปลาร้า 1 ช้อน", 0, "พอได้รส ถ้าใส่น้อย"],
  ["🍯", "น้ำตาลปี๊บ 3 ช้อน", -3, "น้ำตาลเยอะ ทำให้น้ำตาลในเลือดพุ่ง"], ["🧂", "ผงชูรส/ผงปรุง", -2, "โซเดียมสูง"], ["🦀", "ปูดองดิบ", -3, "ดิบ เสี่ยงพยาธิ และเค็มมาก"],
];
const PLATE_STEPS = [
  { kind: "rice", n: 1, t: "เลือกข้าว/แป้ง 1 อย่าง" }, { kind: "pro", n: 1, t: "เลือกโปรตีน 1 อย่าง" },
  { kind: "veg", n: 2, t: "เลือกผัก 2 อย่าง" }, { kind: "drink", n: 1, t: "เลือกเครื่องดื่ม 1 อย่าง" },
];

/* ------------------------------------------------------------------ state */
const G = { mode: "plate", step: 0, picks: [], cards: [], hover: null, hoverT: 0, stream: null, raf: 0, cam: false, ptr: null, pound: null, sc: null, busy: false };

function shell() {
  if ($("#hkModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
  <div class="hk-modal" id="hkModal" role="dialog" aria-modal="true" aria-label="เกมครัวแตะมือ" hidden>
    <div class="hk-stage" id="hkStage">
      <video id="hkVideo" playsinline muted></video>
      <div class="hk-bg" id="hkBg" aria-hidden="true"></div>
      <canvas id="hkCanvas"></canvas>
      <div class="hk-cards" id="hkCards"></div>
      <div class="hk-cursor" id="hkCursor" hidden><i></i></div>
      <div class="hk-hud">
        <button type="button" class="hk-x" data-hk="close" aria-label="ปิดเกม">✕</button>
        <div class="hk-title"><b id="hkTitle">ครัวแตะมือ</b><span id="hkSay">ชี้นิ้วชี้ค้างไว้ที่การ์ดเพื่อเลือก</span></div>
        <div class="hk-modes" role="tablist"><button type="button" data-hkmode="plate">🍽️ จัดพาข้าว</button><button type="button" data-hkmode="somtam">🥗 ตำส้มตำ</button></div>
      </div>
      <div class="hk-tray" id="hkTray"></div>
      <div class="hk-start" id="hkStart">
        <div class="hk-start-box">
          <span class="hk-start-ico" aria-hidden="true">🖐️</span>
          <h2>ครัวแตะมือ</h2>
          <p>เปิดกล้อง แล้วยก<b>นิ้วชี้</b>ไปแตะการ์ดอาหารบนจอ ค้างไว้ครู่เดียวก็เลือกได้ เหมือนเล่น VR</p>
          <p class="hk-priv">🔒 ภาพจากกล้องประมวลผลในเครื่องนี้เท่านั้น ไม่บันทึกและไม่ส่งออกไปที่ใด</p>
          <div class="hk-start-btns"><button type="button" class="btn primary" data-hk="cam">📷 เปิดกล้องเล่น</button><button type="button" class="btn" data-hk="nocam">🖱️ เล่นด้วยเมาส์/นิ้วแตะจอ</button></div>
          <small id="hkMsg"></small>
        </div>
      </div>
    </div>
  </div>`);
  const m = $("#hkModal");
  m.addEventListener("click", onClick);
  const st = $("#hkStage");
  st.addEventListener("pointermove", (e) => { if (G.cam) return; const r = st.getBoundingClientRect(); G.ptr = { x: e.clientX - r.left, y: e.clientY - r.top, ny: (e.clientY - r.top) / r.height }; if (G.pound && !G.busy) poundStep(G.ptr.ny); });
  st.addEventListener("pointerleave", () => { if (!G.cam) G.ptr = null; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !m.hidden) close(); });
}

function open(mode) {
  shell(); G.mode = mode || G.mode;
  $("#hkModal").hidden = false; document.body.classList.add("care-open");
  $("#hkStart").hidden = false; $("#hkMsg").textContent = "";
  newRound();
}
function close() {
  cancelAnimationFrame(G.raf); G.raf = 0;
  G.stream?.getTracks().forEach((t) => t.stop()); G.stream = null; G.cam = false;
  const v = $("#hkVideo"); if (v) v.srcObject = null;
  $("#hkModal").hidden = true; document.body.classList.remove("care-open");
}

async function startCam() {
  const msg = $("#hkMsg");
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("เบราว์เซอร์นี้ไม่รองรับกล้อง (ต้องเปิดผ่าน https)");
    msg.textContent = "กำลังเปิดกล้องและโหลดระบบจับมือ…";
    const [stream] = await Promise.all([navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 540, facingMode: "user" }, audio: false }), getLandmarker()]);
    G.stream = stream; const v = $("#hkVideo"); v.srcObject = stream; await v.play();
    G.cam = true; $("#hkStage").classList.add("cam");
    $("#hkStart").hidden = true; loop();
  } catch (err) {
    msg.textContent = `เปิดกล้องไม่ได้ (${err.name === "NotAllowedError" ? "ไม่ได้อนุญาตกล้อง" : err.message || err}) ลองเล่นด้วยเมาส์/นิ้วแตะจอแทนได้ค่ะ`;
  }
}
function startNoCam() { G.cam = false; $("#hkStage").classList.remove("cam"); $("#hkStart").hidden = true; loop(); }

/* ------------------------------------------------------------------ rounds */
function newRound() {
  G.step = 0; G.picks = []; G.pound = null; G.busy = false;
  document.querySelectorAll("#hkModal [data-hkmode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hkmode === G.mode)));
  $("#hkBg").className = "hk-bg " + G.mode;
  if (G.mode === "plate") { const kg = window.PreDMKitchenGames; G.sc = kg?.scenes ? kg.scenes[Math.floor(Math.random() * kg.scenes.length)] : { t: "มื้อกลางวัน", meal: "l", cap: 650, ic: "☀️" }; }
  layout();
}
function dishesOfKind(kind) {
  const DB = window.PreDMFood?.DB || [], kindOf = window.PreDMKitchenGames?.kind;
  if (!kindOf) return [];
  let list = DB.filter((d) => kindOf(d) === kind && !(d.flags || []).includes("raw"));
  if (kind === "pro") list = list.concat(DB.filter((d) => (d.flags || []).includes("raw")).slice(0, 1)); // one raw trap
  if (kind === "drink") list = DB.filter((d) => d.cat === "เครื่องดื่ม");
  return shuffle(list).slice(0, 6);
}
function layout() {
  const box = $("#hkCards"); let items = [];
  if (G.mode === "plate") {
    if (G.step >= PLATE_STEPS.length) { items = [{ id: "serve", e: "🍽️", n: "เสิร์ฟพาข้าว!", big: true }, { id: "redo", e: "↺", n: "จัดใหม่" }]; $("#hkTitle").textContent = `${G.sc.ic} ${G.sc.t}`; say("แตะ “เสิร์ฟพาข้าว” เพื่อดูคะแนน"); }
    else {
      const st = PLATE_STEPS[G.step], have = G.picks.filter((p) => p.kind === st.kind).length;
      items = dishesOfKind(st.kind).filter((d) => !G.picks.some((p) => p.key === d.key)).map((d) => ({ id: d.key, e: d.e, key: d.key, n: d.n, sub: `${d.kcal} kcal` }));
      items.push({ id: "skip", e: "⏭️", n: "ข้าม" });
      $("#hkTitle").textContent = `${G.sc.ic} ${G.sc.t} · ขั้น ${G.step + 1}/${PLATE_STEPS.length}`;
      say(`${st.t}${st.n > 1 ? ` (เลือกแล้ว ${have}/${st.n})` : ""} — ชี้นิ้วค้างไว้ที่การ์ด`);
    }
  } else if (G.pound) { items = []; $("#hkTitle").textContent = "🥗 ตำส้มตำด้วยมือ"; }
  else {
    const left = 6 - G.picks.length;
    items = SOMTAM.map((x, i) => ({ id: "s" + i, e: x[0], n: x[1] })).filter((c) => !G.picks.some((p) => p.id === c.id));
    if (G.picks.length) items.push({ id: "pound", e: "🪵", n: "เริ่มตำ!", big: true });
    $("#hkTitle").textContent = "🥗 ตำส้มตำด้วยมือ";
    say(left > 0 ? `เลือกเครื่องใส่ครก อีก ${left} อย่าง (แตะ “เริ่มตำ!” เมื่อพร้อม)` : "ครบแล้ว แตะ “เริ่มตำ!”");
    if (left <= 0) items = items.filter((c) => c.id === "pound");
  }
  // arrange cards on an arc so the middle of the screen (the player's face) stays clear
  const n = items.length;
  box.innerHTML = items.map((c, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1), ang = Math.PI * (1.05 - 1.1 * t);
    const x = 50 + Math.cos(ang) * 40, y = 64 - Math.sin(ang) * 46;
    return `<div class="hk-card${c.big ? " big" : ""}" data-id="${esc(c.id)}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"><span class="hk-ring"></span><span class="hk-pic">${img(c.e, c.key)}</span><b>${esc(c.n)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</div>`;
  }).join("");
  G.cards = [...box.children]; G.hover = null;
  tray();
}
function tray() {
  const DB = window.PreDMFood?.DB || [];
  const chips = G.mode === "plate"
    ? G.picks.map((p) => { const d = DB.find((x) => x.key === p.key); return d ? `<span class="hk-chip">${img(d.e, d.key)}<small>${esc(d.n)}</small></span>` : ""; })
    : G.picks.map((p) => { const x = SOMTAM[+p.id.slice(1)]; return `<span class="hk-chip">${img(x[0])}<small>${esc(x[1])}</small></span>`; });
  $("#hkTray").innerHTML = `<span class="hk-tray-l">${G.mode === "plate" ? "🍽️ พาข้าวของฉัน" : "🥣 ในครก"}</span>${chips.join("") || `<small class="hk-empty">ยังว่างอยู่</small>`}${G.pound ? `<div class="hk-pound"><b>${G.pound.n}</b>/${G.pound.goal} ครั้ง<i><em style="width:${(100 * G.pound.n) / G.pound.goal}%"></em></i></div>` : ""}`;
}

function choose(id) {
  if (G.busy) return;
  if (G.mode === "plate") {
    if (id === "serve") { const picks = G.picks.map((p) => p.key), sc = G.sc; close(); window.PreDMKitchenGames?.plateResultFor(picks, sc); return; }
    if (id === "redo") return newRound();
    const st = PLATE_STEPS[G.step];
    if (id !== "skip") G.picks.push({ key: id, kind: st.kind });
    const have = G.picks.filter((p) => p.kind === st.kind).length;
    if (id === "skip" || have >= st.n) G.step++;
    pop(); layout(); return;
  }
  if (id === "pound") { G.pound = { n: 0, goal: 15, dir: 0, ext: null }; say("ตำ ๆ ๆ! ยกมือขึ้น–ลงแรง ๆ เหมือนจับสาก 15 ครั้ง"); layout(); return; }
  G.picks.push({ id }); pop(); layout();
}
function pop() { const t = $("#hkTray"); t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop"); }

function poundStep(ny) { // count one stroke each time the hand travels up then down by a clear distance
  const P = G.pound; if (!P || ny == null) return;
  if (P.ext == null) { P.ext = ny; return; }
  const TH = 0.1;
  if (P.dir >= 0 && ny < P.ext - TH) { P.dir = -1; P.ext = ny; }
  else if (P.dir <= 0 && ny > P.ext + TH) { if (P.dir === -1) { P.n++; tray(); $("#hkBg").classList.remove("hit"); void $("#hkBg").offsetWidth; $("#hkBg").classList.add("hit"); } P.dir = 1; P.ext = ny; }
  else if ((P.dir === -1 && ny < P.ext) || (P.dir === 1 && ny > P.ext)) P.ext = ny;
  if (P.n >= P.goal) { G.busy = true; setTimeout(somtamResult, 400); }
}
function somtamResult() {
  const items = G.picks.map((p) => SOMTAM[+p.id.slice(1)]);
  let pts = items.reduce((a, x) => a + x[2], 0); const tips = [], good = [];
  const veg = items.filter((x) => x[2] >= 2).length;
  if (veg >= 3) { pts += 3; good.push("ผักหลายอย่าง"); } else tips.push("ใส่ผักให้มากขึ้น เช่น ถั่วฝักยาว มะเขือเทศ แตงกวา");
  items.filter((x) => x[2] < 0).forEach((x) => tips.push(`${x[1]}: ${x[3]}`));
  if (!items.some((x) => x[2] < 0)) { pts += 2; good.push("ไม่มีน้ำตาล ผงปรุง หรือของดิบ"); }
  const st = pts >= 12 ? 3 : pts >= 8 ? 2 : pts >= 4 ? 1 : 0;
  const best = Math.max(pts, window.PreDM?.store.get("somtamBest", 0) || 0); window.PreDM?.store.set("somtamBest", best);
  $("#hkCards").innerHTML = `<div class="hk-result"><div class="fq-stars">${[0, 1, 2].map((k) => `<span class="${k < st ? "on" : ""}">★</span>`).join("")}</div>
    <h2>${["ลองตำใหม่นะคะ", "ใช้ได้ค่ะ", "ส้มตำสุขภาพ อร่อยด้วย!", "สุดยอดแม่ครัว! 🥗"][st]}</h2><p>${pts} คะแนน · ตำไป ${G.pound.goal} ครั้ง (ได้ขยับแขนด้วย 💪) · ดีที่สุด ${best}</p>
    ${good.length ? `<p class="ok">👍 ${good.map(esc).join(" · ")}</p>` : ""}${tips.length ? `<ul>${tips.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    <div class="hk-start-btns"><button type="button" class="btn primary" data-hk="again">ตำอีกครก ↺</button><button type="button" class="btn" data-hkmode="plate">ไปจัดพาข้าว</button></div></div>`;
  G.cards = []; say("แตะปุ่มด้วยเมาส์หรือนิ้วบนจอ");
}

/* ------------------------------------------------------------------ main loop */
function loop() {
  cancelAnimationFrame(G.raf);
  const v = $("#hkVideo"), cv = $("#hkCanvas"), st = $("#hkStage"), cur = $("#hkCursor");
  let lastT = -1;
  const frame = () => {
    G.raf = requestAnimationFrame(frame);
    const W = st.clientWidth, H = st.clientHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, W, H);
    let p = null, ny = null;
    if (G.cam && landmarker && v.readyState >= 2 && v.currentTime !== lastT) {
      lastT = v.currentTime;
      const res = landmarker.detectForVideo(v, performance.now()), lm = res.landmarks?.[0];
      if (lm) {
        const vw = v.videoWidth, vh = v.videoHeight, s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
        const map = (q) => ({ x: ox + (1 - q.x) * dw, y: oy + q.y * dh });
        ctx.fillStyle = "rgba(255,255,255,.75)";
        lm.forEach((q) => { const m = map(q); ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, 7); ctx.fill(); });
        p = map(lm[8]); ny = lm[9].y; G.ptr = p;
      } else G.ptr = null;
    } else if (G.cam) p = G.ptr;
    if (!G.cam && G.ptr) { p = G.ptr; ny = G.ptr.ny; }
    if (G.pound && G.cam && !G.busy) poundStep(ny);
    cur.hidden = !p; if (p) cur.style.transform = `translate(${p.x}px,${p.y}px)`;
    // hover + dwell
    let hit = null;
    if (p && !G.pound && !G.busy) { const sr = st.getBoundingClientRect(); G.lockHit = false; for (const c of G.cards) { const r = c.getBoundingClientRect(); if (p.x >= r.left - sr.left && p.x <= r.right - sr.left && p.y >= r.top - sr.top && p.y <= r.bottom - sr.top) { if (G.lock) G.lockHit = true; hit = c; break; } } }
    if (G.lock) { if (hit) hit = null; else if (!G.lockHit) G.lock = false; }
    if (hit !== G.hover) { G.hover?.classList.remove("hot"); G.hover?.style.setProperty("--p", 0); G.hover = hit; G.hoverT = performance.now(); hit?.classList.add("hot"); }
    if (hit) { const k = Math.min(1, (performance.now() - G.hoverT) / DWELL); hit.style.setProperty("--p", k); cur.style.setProperty("--p", k); if (k >= 1) { const id = hit.dataset.id; G.hover = null; G.lock = true; G.lockHit = true; choose(id); } }
    else cur.style.setProperty("--p", 0);
  };
  frame();
}

function onClick(e) {
  const t = (s) => e.target.closest(s);
  const m = t("[data-hkmode]"); if (m) { G.mode = m.dataset.hkmode; return newRound(); }
  const b = t("[data-hk]"); if (b) {
    const a = b.dataset.hk;
    if (a === "close") return close();
    if (a === "cam") return startCam();
    if (a === "nocam") return startNoCam();
    if (a === "again") return newRound();
  }
  const c = t(".hk-card"); if (c && !G.cam) choose(c.dataset.id); // tap also works without camera
}

document.addEventListener("click", (e) => { const g = e.target.closest("[data-handgame]"); if (!g) return; e.preventDefault(); open(g.dataset.handgame === "somtam" ? "somtam" : "plate"); });
window.PreDMHandKitchen = { open, close };
