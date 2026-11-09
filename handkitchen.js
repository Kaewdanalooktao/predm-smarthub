/* Pre-DM Smart Hub — "ครัวแตะมือ" camera games (MediaPipe Hand, runs fully on this device).
   Open the camera, then point with the index finger at a floating card and hold still for a moment to choose it.
   1) จัดพาข้าวด้วยมือ — pick rice → protein → 2 vegetables → a drink, then the plate is scored with the same rules as เกมจัดสำรับ.
   2) ตำส้มตำด้วยมือ — pick 6 ingredients for the mortar, then pound by moving the hand up and down (light arm exercise).
   No camera? The mouse / finger on the screen works as the pointer. Video never leaves the device and is not recorded. */
import { HandLandmarker, FilesetResolver } from "./vendor/mediapipe/vision_bundle.mjs";

const WASM = new URL("vendor/mediapipe/wasm", location.href).href;
const MODEL = new URL("vendor/models/hand_landmarker.task", location.href).href;
const DWELL = 1000; // ms of hovering to choose a card
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const img = (e, key) => (window.FI ? window.FI(e, key) : e);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const say = (t) => { const el = $("#hkSay"); if (el) el.textContent = t; };

let landmarker = null;
// MediaPipe Hand skeleton: each finger its own colour, the pointing fingertip highlighted
const HAND_EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const FINGER_COL = ["#ffffff", "#ffb84d", "#ffe14d", "#6fe39a", "#5ec8ff", "#c79bff"], fingerOf = (i) => (i === 0 ? 0 : Math.ceil(i / 4));
function drawHand(ctx, P) {
  ctx.lineCap = "round"; ctx.lineWidth = 5;
  HAND_EDGES.forEach(([a, b]) => { ctx.strokeStyle = FINGER_COL[fingerOf(b)]; ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke(); });
  P.forEach((q, i) => { ctx.beginPath(); ctx.arc(q.x, q.y, i === 8 ? 9 : i % 4 === 0 ? 6 : 4, 0, 7); ctx.fillStyle = FINGER_COL[fingerOf(i)]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.stroke(); });
}
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


/* ---------- ตลาดแตะมือ: ingredients by stall  [id, emoji, name, price, health points] ---------- */
const STALLS = [
  { n: "🥬 แผงผักสด", items: [["papaya","🍈","มะละกอดิบ",15,2],["tomato","🍅","มะเขือเทศ",10,2],["longbean","🫛","ถั่วฝักยาว",10,2],["cucumber","🥒","แตงกวา",10,2],["cabbage","🥬","กะหล่ำปลี",20,2],["chinesecab","🥬","ผักกาดขาว",15,2],["morningglory","🌿","ผักบุ้ง",10,2],["kale","🥬","คะน้า",15,2],["spring","🌱","ต้นหอม ผักชี",5,1],["strawmush","🍄","เห็ดฟาง",20,2],["oystermush","🍄","เห็ดนางฟ้า",15,2],["bamboo","🎋","หน่อไม้",20,2],["eggplant","🍆","มะเขือ",10,2],["babycorn","🌽","ข้าวโพดอ่อน",15,2],["carrot","🥕","แครอท",10,2],["broccoli","🥦","บรอกโคลี",25,2],["bellpep","🫑","พริกหวาน",20,2],["yanang","🍃","ใบย่านาง",10,2],["localveg","🌱","ผักติ้ว ผักแขยง",10,2],["sprout","🌱","ถั่วงอก",10,1]] },
  { n: "🌿 แผงสมุนไพร เครื่องปรุง", items: [["chili","🌶️","พริกขี้หนู",5,1],["garlic","🧄","กระเทียม",10,1],["shallot","🧅","หอมแดง",10,1],["lemongrass","🌿","ตะไคร้",10,1],["galangal","🫚","ข่า",10,1],["kaffir","🍃","ใบมะกรูด",5,1],["lime","🍋","มะนาว",10,1],["roastrice","🌾","ข้าวคั่ว",10,1],["basilholy","🌿","ใบกะเพรา",10,1],["basil","🌿","ใบโหระพา แมงลัก",10,1],["mint","🌿","ใบสะระแหน่",10,1],["banana-leaf","🍃","ใบตอง",10,1],["padaek","🫙","ปลาร้า",25,0],["fishsauce","🫙","น้ำปลา",20,0],["soy","🫙","ซีอิ๊วขาว",20,0],["kapi","🫙","กะปิ",20,0],["salt","🧂","เกลือ",5,0],["curry","🌶️","พริกแกง",15,0],["oil","🫒","น้ำมันพืช",35,0],["msg","🧂","ผงชูรส ผงปรุงรส",15,-2],["sugar","🍯","น้ำตาลทราย",15,-2],["coconutmilk","🥥","กะทิกล่อง",25,-1],["oyster","🫙","ซอสหอยนางรม",25,-1]] },
  { n: "🐟 แผงเนื้อสัตว์ ไข่ เต้าหู้", items: [["breast","🍗","อกไก่",45,2],["thigh","🍗","สะโพกไก่",40,1],["bannchicken","🐓","ไก่บ้าน",80,1],["minced","🥩","หมูสับ",40,1],["tenderloin","🥩","หมูสันใน",50,1],["pork-belly","🥓","หมูสามชั้น",60,-2],["beef","🥩","เนื้อวัว",90,0],["tilapia","🐟","ปลานิล",55,2],["snakehead","🐟","ปลาช่อน",70,2],["catfish","🐟","ปลาดุก",45,1],["shrimp","🦐","กุ้งสด",70,1],["squid","🦑","ปลาหมึก",60,1],["ricecrab","🦀","ปูนา",35,0],["cockle","🦪","หอยแครง",50,0],["egg","🥚","ไข่ไก่",30,2],["tofu","🧈","เต้าหู้",15,2],["anteggs","🐜","ไข่มดแดง",60,1],["frog","🐸","กบ",50,1],["sausage","🌭","ไส้กรอก หมูยอ",35,-2],["meatball","🍢","ลูกชิ้น",30,-1]] },
  { n: "🍚 แผงข้าว แป้ง", items: [["sticky","🍙","ข้าวเหนียว",40,0],["blacksticky","🍙","ข้าวเหนียวดำ",50,2],["brownrice","🍚","ข้าวกล้อง",45,2],["jasmine","🍚","ข้าวหอมมะลิ",40,0],["khanomjeen","🍜","ขนมจีน",25,0],["noodle","🍜","เส้นก๋วยเตี๋ยว",20,0],["glassnoodle","🍜","วุ้นเส้น",15,0],["instant","🍜","บะหมี่กึ่งสำเร็จรูป",7,-2],["wwbread","🍞","ขนมปังโฮลวีต",35,2],["sweetpotato","🍠","มันเทศ",20,2],["corn","🌽","ข้าวโพด",20,1],["whitebread","🍞","ขนมปังขาวหวาน",30,-1]] },
  { n: "🍐 แผงผลไม้ เครื่องดื่ม", items: [["guava","🍐","ฝรั่ง",25,2],["rose-apple","🍎","ชมพู่",30,2],["pomelo","🍊","ส้มโอ",40,1],["banana","🍌","กล้วยน้ำว้า",20,1],["mango","🥭","มะม่วงสุก",40,0],["watermelon","🍉","แตงโม",30,0],["grape","🍇","องุ่น",60,-1],["water","💧","น้ำเปล่า",10,2],["milk","🥛","นมจืด",15,1],["tea","🍵","ชาไม่หวาน",15,1],["soda","🥤","น้ำอัดลม",15,-3],["bubbletea","🧋","ชานมไข่มุก",35,-3],["juice","🧃","น้ำผลไม้กล่อง",15,-2],["snack","🍬","ขนมขบเคี้ยว",20,-2],["beer","🍺","เบียร์",45,-2]] },
];
const ING = {}; STALLS.forEach((st, si) => st.items.forEach(([id, e, n, price, hp]) => (ING[id] = { id, e, n, price, hp, stall: si })));
const RECIPES = [ // [name, emoji, dish key in the food cupboard, needed ingredient ids]
  ["ส้มตำไทยหวานน้อย", "🥗", "somtam-thai", ["papaya","tomato","longbean","chili","garlic","lime","fishsauce"]],
  ["ลาบไก่", "🍗", "larb-gai", ["breast","roastrice","shallot","spring","mint","chili","lime","fishsauce","cucumber"]],
  ["แกงอ่อมไก่", "🥘", "gaeng-om", ["thigh","lemongrass","localveg","spring","oystermush","shallot","chili","padaek"]],
  ["ต้มยำปลาน้ำใส", "🍲", "tomyum", ["tilapia","lemongrass","galangal","kaffir","strawmush","chili","lime","fishsauce"]],
  ["ปลานิลเผาเกลือ ผักลวก", "🐟", "pla-pao", ["tilapia","salt","lemongrass","morningglory","longbean","cucumber","chili","lime"]],
  ["แกงหน่อไม้ใบย่านาง", "🎋", "gaeng-normai", ["bamboo","yanang","strawmush","lemongrass","basil","chili","padaek"]],
  ["ผัดกะเพราไก่ ใส่ถั่วฝักยาว", "🌿", "pad-kaprao-gai", ["breast","basilholy","chili","garlic","longbean","oil","soy"]],
  ["ไข่ป่าม ผักลวก", "🥚", "kai-pam", ["egg","spring","shallot","banana-leaf","fishsauce","kale","carrot"]],
  ["ผัดผักรวมเต้าหู้", "🥦", "pad-pak", ["kale","carrot","broccoli","babycorn","oystermush","tofu","garlic","soy"]],
  ["ต้มไก่บ้านใบมะขาม", "🍲", "tom-gai-ban", ["bannchicken","lemongrass","galangal","shallot","chili","kaffir","lime","fishsauce"]],
  ["หมกปลาใบตอง", "🍃", "mok", ["tilapia","banana-leaf","lemongrass","shallot","chili","egg","kaffir","spring"]],
  ["แกงจืดเต้าหู้หมูสับ", "🍲", "gaeng-jued", ["tofu","minced","chinesecab","carrot","garlic","spring","soy"]],
  ["ปลาช่อนนึ่งมะนาว", "🐟", "pla-nueng-manao", ["snakehead","lime","garlic","chili","fishsauce","kale","spring"]],
  ["ส้มตำแตง ไข่ต้ม", "🥒", "tam-tang", ["cucumber","tomato","longbean","chili","garlic","lime","egg","fishsauce"]],
].map(([n, e, key, need]) => ({ n, e, key, need }));
const MK_BUDGET = 300, MK_MAX = 20, PER_PAGE = 6;
const TIPS_BAD = { msg: "ผงชูรส/ผงปรุง โซเดียมสูง ใช้สมุนไพรแทน", sugar: "น้ำตาลเพิ่มน้ำตาลในเลือด ใช้มะนาว/มะเขือเทศให้รสแทน", "pork-belly": "หมูสามชั้นไขมันสูง เปลี่ยนเป็นหมูสันในหรืออกไก่", sausage: "อาหารแปรรูป เค็มและมัน", meatball: "ลูกชิ้นแปรรูป โซเดียมสูง", instant: "บะหมี่กึ่งฯ โซเดียมสูงมาก", soda: "น้ำอัดลม น้ำตาล ~9 ช้อนชา", bubbletea: "ชานมไข่มุก น้ำตาลและแป้งสูง", juice: "น้ำผลไม้กล่อง น้ำตาลสูง ไม่มีใยอาหาร", snack: "ขนมถุง น้ำตาล/เกลือสูง", beer: "แอลกอฮอล์ทำให้น้ำตาลแกว่ง", whitebread: "แป้งขัดขาวและน้ำตาล", grape: "องุ่นหวานมาก", coconutmilk: "กะทิไขมันอิ่มตัวสูง", oyster: "ซอสหอยนางรมเค็มและหวาน" };

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
        <span class="hk-masc" id="hkMasc" aria-hidden="true"></span><div class="hk-title"><b id="hkTitle">ครัวแตะมือ</b><span id="hkSay">ชี้นิ้วชี้ค้างไว้ที่การ์ดเพื่อเลือก</span></div>
        <button type="button" class="hk-x hk-mu" data-voice aria-label="เปิด/ปิดเสียงพากย์">🗣️</button><button type="button" class="hk-x hk-mu" data-music aria-label="เปิด/ปิดเพลง">🎵</button><div class="hk-modes" role="tablist"><button type="button" data-hkmode="market">🧺 จ่ายตลาด</button><button type="button" data-hkmode="plate">🍽️ จัดพาข้าว</button><button type="button" data-hkmode="somtam">🥗 ตำส้มตำ</button></div>
      </div>
      <div class="hk-list" id="hkList" hidden></div>
      <div class="hk-fxl" id="hkFx" aria-hidden="true"></div>
      <div class="hk-tray" id="hkTray"></div>
      <div class="hk-start" id="hkStart">
        <div class="hk-start-box">
          <span class="hk-start-ico" aria-hidden="true">🖐️</span>
          <h2 id="hkStartT">ครัวแตะมือ</h2>
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
  if (window.PreDMMascot) $("#hkMasc").innerHTML = PreDMMascot.svg();
  const st = $("#hkStage");
  st.addEventListener("pointermove", (e) => { if (G.cam) return; const r = st.getBoundingClientRect(); G.ptr = { x: e.clientX - r.left, y: e.clientY - r.top, ny: (e.clientY - r.top) / r.height }; if (G.pound && !G.busy) poundStep(G.ptr.ny); });
  st.addEventListener("pointerleave", () => { if (!G.cam) G.ptr = null; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !m.hidden) close(); });
}

function open(mode) {
  shell(); G.mode = mode || G.mode;
  $("#hkStartT").textContent = G.mode === "market" ? "🧺 ตลาดแตะมือ" : "ครัวแตะมือ";
  $("#hkModal").hidden = false; document.body.classList.add("care-open"); window.PreDMMusic?.start();
  $("#hkStart").hidden = false; $("#hkMsg").textContent = "";
  newRound();
}
function close() {
  cancelAnimationFrame(G.raf); G.raf = 0;
  G.stream?.getTracks().forEach((t) => t.stop()); G.stream = null; G.cam = false;
  const v = $("#hkVideo"); if (v) v.srcObject = null;
  $("#hkModal").hidden = true; document.body.classList.remove("care-open"); window.PreDMMusic?.stop();
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
  if (!$("#hkModal").hidden) window.PreDMMusic?.start();
  G.step = 0; G.picks = []; G.pound = null; G.busy = false; G.spoke = null;
  document.querySelectorAll("#hkModal [data-hkmode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hkmode === G.mode)));
  $("#hkBg").className = "hk-bg " + G.mode;
  G.mk = { phase: "menu", recipe: null, stall: 0, page: 0, menuPage: 0, cart: [], combo: 0, t0: 0 };
  G.score = 0; $("#hkList").hidden = true;
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
  if (G.mode === "market") items = marketItems();
  else if (G.mode === "plate") {
    if (G.step >= PLATE_STEPS.length) { items = [{ id: "serve", e: "🍽️", n: "เสิร์ฟพาข้าว!", big: true }, { id: "redo", e: "↺", n: "จัดใหม่" }]; $("#hkTitle").textContent = `${G.sc.ic} ${G.sc.t}`; say("แตะ “เสิร์ฟพาข้าว” เพื่อดูคะแนน");  if (G.spoke !== "serve") { G.spoke = "serve"; window.PreDMVoice?.say("pl_serve"); } }
    else {
      const st = PLATE_STEPS[G.step], have = G.picks.filter((p) => p.kind === st.kind).length;
      items = dishesOfKind(st.kind).filter((d) => !G.picks.some((p) => p.key === d.key)).map((d) => ({ id: d.key, e: d.e, key: d.key, n: d.n, sub: `${d.kcal} kcal` }));
      items.push({ id: "more", e: "🔄", n: "เมนูอื่น" }, { id: "skip", e: "⏭️", n: "ข้าม" });
      $("#hkTitle").textContent = `${G.sc.ic} ${G.sc.t} · ขั้น ${G.step + 1}/${PLATE_STEPS.length}`;
      say(`${st.t}${st.n > 1 ? ` (เลือกแล้ว ${have}/${st.n})` : ""} — ชี้นิ้วค้างไว้ที่การ์ด`);
      if (G.spoke !== "pl" + G.step) { G.spoke = "pl" + G.step; window.PreDMVoice?.say({ rice: "pl_rice", pro: "pl_pro", veg: "pl_veg", drink: "pl_drink" }[st.kind]); }
    }
  } else if (G.pound) { items = []; $("#hkTitle").textContent = "🥗 ตำส้มตำด้วยมือ"; }
  else {
    const left = 6 - G.picks.length;
    items = SOMTAM.map((x, i) => ({ id: "s" + i, e: x[0], n: x[1] })).filter((c) => !G.picks.some((p) => p.id === c.id));
    if (G.picks.length) items.push({ id: "pound", e: "🪵", n: "เริ่มตำ!", big: true });
    $("#hkTitle").textContent = "🥗 ตำส้มตำด้วยมือ"; if (!G.picks.length && G.spoke !== "st") { G.spoke = "st"; window.PreDMVoice?.say("st_pick"); }
    say(left > 0 ? `เลือกเครื่องใส่ครก อีก ${left} อย่าง (แตะ “เริ่มตำ!” เมื่อพร้อม)` : "ครบแล้ว แตะ “เริ่มตำ!”");
    if (left <= 0) items = items.filter((c) => c.id === "pound");
  }
  // big screens: cards on an arc so the middle (the player's face) stays clear; phones: a tidy grid
  const n = items.length, narrow = ($("#hkStage").clientWidth || innerWidth) < 760;
  const lifted = G.mode === "market" && G.mk?.phase === "shop"; // leave room for the shopping-list strip
  box.innerHTML = items.map((c, i) => {
    let x, y;
    if (narrow) { const cols = 3, rows = Math.ceil(n / cols), r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), col = i - r * cols; x = 50 + (col - (inRow - 1) / 2) * 32; y = rows === 1 ? 48 : 31 + (r * (lifted ? 34 : 44)) / (rows - 1); }
    else { const t = n === 1 ? 0.5 : i / (n - 1), ang = Math.PI * (lifted ? 1 - t : 1.05 - 1.1 * t); x = 50 + Math.cos(ang) * 41; y = (lifted ? 60 : 66) - Math.sin(ang) * (lifted ? 40 : 46); }
    return `<div class="hk-card${c.big ? " big" : ""}${c.cls ? " " + c.cls : ""}" data-id="${esc(c.id)}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"><span class="hk-ring"></span>${c.badge ? `<em class="hk-badge">${c.badge}</em>` : ""}<span class="hk-pic">${img(c.e, c.key)}</span><b>${esc(c.n)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</div>`;
  }).join("");
  G.cards = [...box.children]; G.hover = null;
  tray();
}
function tray() {
  if (G.mode === "market") return marketTray();
  const DB = window.PreDMFood?.DB || [];
  const chips = G.mode === "plate"
    ? G.picks.map((p) => { const d = DB.find((x) => x.key === p.key); return d ? `<span class="hk-chip">${img(d.e, d.key)}<small>${esc(d.n)}</small></span>` : ""; })
    : G.picks.map((p) => { const x = SOMTAM[+p.id.slice(1)]; return `<span class="hk-chip">${img(x[0])}<small>${esc(x[1])}</small></span>`; });
  $("#hkTray").innerHTML = `<span class="hk-tray-l">${G.mode === "plate" ? "🍽️ พาข้าวของฉัน" : "🥣 ในครก"}</span>${chips.join("") || `<small class="hk-empty">ยังว่างอยู่</small>`}${G.pound ? `<div class="hk-pound"><b>${G.pound.n}</b>/${G.pound.goal} ครั้ง<i><em style="width:${(100 * G.pound.n) / G.pound.goal}%"></em></i></div>` : ""}`;
}

function choose(id, el) {
  if (G.busy) return;
  if (G.mode === "market") return marketChoose(id, el);
  if (el && !["more", "skip", "redo", "serve", "pound"].includes(id)) fx(el, "✓", "good");
  if (G.mode === "plate") {
    if (id === "serve") { window.PreDMVoice?.say("cheer1"); const picks = G.picks.map((p) => p.key), sc = G.sc; close(); window.PreDMKitchenGames?.plateResultFor(picks, sc); return; }
    if (id === "redo") return newRound();
    if (id === "more") return layout();
    const st = PLATE_STEPS[G.step];
    if (id !== "skip") G.picks.push({ key: id, kind: st.kind });
    const have = G.picks.filter((p) => p.kind === st.kind).length;
    if (id === "skip" || have >= st.n) G.step++;
    pop(); layout(); return;
  }
  if (id === "pound") { window.PreDMMusic?.stop(); window.PreDMVoice?.say("st_pound"); G.pound = { n: 0, goal: 15, dir: 0, ext: null }; say("ตำ ๆ ๆ! ยกมือขึ้น–ลงแรง ๆ เหมือนจับสาก 15 ครั้ง"); layout(); return; }
  G.picks.push({ id }); pop(); layout();
}
function pop() { const t = $("#hkTray"); t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop"); }

function poundStep(ny) { // count one stroke each time the hand travels up then down by a clear distance
  const P = G.pound; if (!P || ny == null) return;
  if (P.ext == null) { P.ext = ny; return; }
  const TH = 0.1;
  if (P.dir >= 0 && ny < P.ext - TH) { P.dir = -1; P.ext = ny; }
  else if (P.dir <= 0 && ny > P.ext + TH) { if (P.dir === -1) { P.n++; window.PreDMMusic?.sfx("pok"); if (P.n % 5 === 0 && P.n < P.goal) window.PreDMVoice?.say(String(P.n)); tray(); $("#hkBg").classList.remove("hit"); void $("#hkBg").offsetWidth; $("#hkBg").classList.add("hit"); } P.dir = 1; P.ext = ny; }
  else if ((P.dir === -1 && ny < P.ext) || (P.dir === 1 && ny > P.ext)) P.ext = ny;
  if (P.n >= P.goal) { G.busy = true; window.PreDMMusic?.sfx("win"); window.PreDMVoice?.say("st_done"); setTimeout(somtamResult, 400); }
}
function somtamResult() {
  const items = G.picks.map((p) => SOMTAM[+p.id.slice(1)]);
  let pts = items.reduce((a, x) => a + x[2], 0); const tips = [], good = [];
  const veg = items.filter((x) => x[2] >= 2).length;
  if (veg >= 3) { pts += 3; good.push("ผักหลายอย่าง"); } else tips.push("ใส่ผักให้มากขึ้น เช่น ถั่วฝักยาว มะเขือเทศ แตงกวา");
  items.filter((x) => x[2] < 0).forEach((x) => tips.push(`${x[1]}: ${x[3]}`));
  if (!items.some((x) => x[2] < 0)) { pts += 2; good.push("ไม่มีน้ำตาล ผงปรุง หรือของดิบ"); }
  const st = pts >= 12 ? 3 : pts >= 8 ? 2 : pts >= 4 ? 1 : 0;
  if (st >= 2) confetti();
  const best = Math.max(pts, window.PreDM?.store.get("somtamBest", 0) || 0); window.PreDM?.store.set("somtamBest", best);
  $("#hkCards").innerHTML = `<div class="hk-result"><div class="fq-stars">${[0, 1, 2].map((k) => `<span class="${k < st ? "on" : ""}">★</span>`).join("")}</div>
    <h2>${["ลองตำใหม่นะคะ", "ใช้ได้ค่ะ", "ส้มตำสุขภาพ อร่อยด้วย!", "สุดยอดแม่ครัว! 🥗"][st]}</h2><p>${pts} คะแนน · ตำไป ${G.pound.goal} ครั้ง (ได้ขยับแขนด้วย 💪) · ดีที่สุด ${best}</p>
    ${good.length ? `<p class="ok">👍 ${good.map(esc).join(" · ")}</p>` : ""}${tips.length ? `<ul>${tips.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    <div class="hk-start-btns"><button type="button" class="btn primary" data-hk="again">ตำอีกครก ↺</button><button type="button" class="btn" data-hkmode="plate">ไปจัดพาข้าว</button></div></div>`;
  G.cards = []; say("แตะปุ่มด้วยเมาส์หรือนิ้วบนจอ");
}


/* ------------------------------------------------------------------ ตลาดแตะมือ */
const spent = () => G.mk.cart.reduce((a, id) => a + ING[id].price, 0);
function marketItems() {
  const M = G.mk;
  if (M.phase === "menu") {
    $("#hkTitle").textContent = "🧺 ตลาดแตะมือ · เย็นนี้จะทำอะไรดี?"; if (!M.spokeMenu) { M.spokeMenu = true; window.PreDMVoice?.say("mk_menu"); }
    say("เลือกเมนูที่จะทำมื้อเย็นนี้ก่อน แล้วไปจ่ายตลาดตามรายการกัน");
    const list = RECIPES.slice(M.menuPage * PER_PAGE, M.menuPage * PER_PAGE + PER_PAGE);
    return [...list.map((r) => ({ id: "r" + RECIPES.indexOf(r), e: r.e, key: r.key, n: r.n, sub: `วัตถุดิบ ${r.need.length} อย่าง` })), { id: "menus", e: "🔄", n: "เมนูอื่น", sub: `หน้า ${M.menuPage + 1}/${Math.ceil(RECIPES.length / PER_PAGE)}` }];
  }
  if (M.phase === "done") return [];
  const st = STALLS[M.stall], pages = Math.ceil(st.items.length / PER_PAGE), need = new Set(M.recipe.need);
  $("#hkTitle").textContent = `${st.n} · แผง ${M.stall + 1}/${STALLS.length}${pages > 1 ? ` · หน้า ${M.page + 1}/${pages}` : ""}`;
  const left = need.size - M.recipe.need.filter((id) => M.cart.includes(id)).length;
  say(left ? `ยังขาดของตามรายการอีก ${left} อย่าง · 💰 เหลือ ${MK_BUDGET - spent()} บาท` : `ของครบรายการแล้ว! ซื้อข้าว ผลไม้ น้ำดื่ม แล้วไปจ่ายเงิน · 💰 เหลือ ${MK_BUDGET - spent()} บาท`);
  const items = st.items.slice(M.page * PER_PAGE, M.page * PER_PAGE + PER_PAGE).map(([id]) => {
    const g = ING[id], inCart = M.cart.includes(id);
    return { id: "i:" + id, e: g.e, n: g.n, sub: inCart ? "✓ ในตะกร้า (แตะเพื่อเอาออก)" : `${g.price} บาท`, cls: inCart ? "in" : need.has(id) ? "need" : "", badge: inCart ? "✓" : need.has(id) ? "📋" : "" };
  });
  const back = M.page > 0 || M.stall > 0, last = M.stall === STALLS.length - 1 && M.page === pages - 1;
  if (back) items.unshift({ id: "prev", e: "⬅️", n: "ย้อนกลับ" });
  items.push(last ? { id: "pay", e: "🧾", n: "ไปจ่ายเงิน", big: true } : { id: "next", e: "➡️", n: M.page < pages - 1 ? "หน้าถัดไป" : "แผงถัดไป" });
  return items;
}
function marketList() {
  const M = G.mk, el = $("#hkList");
  if (!M.recipe || M.phase === "menu") { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<b>📋 ${esc(M.recipe.n)}</b><ul>${M.recipe.need.map((id) => `<li class="${M.cart.includes(id) ? "got" : ""}">${img(ING[id].e)}<span>${esc(ING[id].n)}</span></li>`).join("")}</ul><small>+ ข้าว 1 อย่าง · ผลไม้ · น้ำดื่ม</small>`;
}
function marketTray() {
  const M = G.mk;
  $("#hkTray").innerHTML = `<span class="hk-tray-l">🧺 ตะกร้า ${M.cart.length}/${MK_MAX}</span>${M.cart.map((id) => `<span class="hk-chip">${img(ING[id].e)}</span>`).join("") || `<small class="hk-empty">ยังว่างอยู่</small>`}<span class="hk-money">💰 ${MK_BUDGET - spent()} บาท</span>`;
  marketList();
}
function marketChoose(id, el) {
  const M = G.mk;
  if (id === "menus") { M.menuPage = (M.menuPage + 1) % Math.ceil(RECIPES.length / PER_PAGE); return layout(); }
  if (id[0] === "r" && M.phase === "menu") {
    M.recipe = RECIPES[+id.slice(1)]; M.phase = "shop"; M.stall = 0; M.page = 0; M.t0 = performance.now();
    if (el) fx(el, "ไปตลาดกัน!", "good"); window.PreDMMusic?.sfx("ok"); window.PreDMVoice?.say("mk_go"); return layout();
  }
  const st = STALLS[M.stall], pages = Math.ceil(st.items.length / PER_PAGE);
  if (id === "next") { if (M.page < pages - 1) M.page++; else { M.stall++; M.page = 0; } return layout(); }
  if (id === "prev") { if (M.page > 0) M.page--; else { M.stall--; M.page = Math.ceil(STALLS[M.stall].items.length / PER_PAGE) - 1; } return layout(); }
  if (id === "pay") { window.PreDMMusic?.sfx("win"); window.PreDMVoice?.say("mk_pay"); return marketResult(); }
  if (id.startsWith("i:")) {
    const g = ING[id.slice(2)], k = M.cart.indexOf(g.id);
    if (k >= 0) { M.cart.splice(k, 1); M.combo = 0; if (el) fx(el, "เอาออก", ""); return layout(); }
    if (M.cart.length >= MK_MAX) { say("ตะกร้าเต็มแล้ว ไปจ่ายเงินได้เลย"); window.PreDMMusic?.sfx("bad"); return shake(el); }
    if (g.price > MK_BUDGET - spent()) { say(`เงินไม่พอค่ะ ${g.n} ราคา ${g.price} บาท`); window.PreDMMusic?.sfx("bad"); window.PreDMVoice?.say("mk_money"); return shake(el); }
    M.cart.push(g.id);
    if (M.recipe.need.includes(g.id)) { M.combo++; G.score += 2; fx(el, M.combo >= 2 ? `คอมโบ ×${M.combo}! 🔥` : "+2 ตามรายการ", "good"); if (M.combo >= 2) window.PreDMMusic?.sfx("ok");
      if (M.recipe.need.every((id) => M.cart.includes(id))) window.PreDMVoice?.say("mk_done"); else if (M.combo === 3 || M.combo === 6) window.PreDMVoice?.say("combo"); }
    else if (g.hp < 0) { M.combo = 0; fx(el, "ระวัง!", "bad"); window.PreDMMusic?.sfx("bad"); window.PreDMVoice?.say("mk_bad"); setTimeout(() => say(`💡 ${TIPS_BAD[g.id] || "ของชิ้นนี้ไม่ค่อยดีต่อสุขภาพ"}`), 50); }
    else { fx(el, g.hp > 0 ? "+1 ดีต่อสุขภาพ" : "✓", "good"); }
    pop(); return layout();
  }
}
function shake(el) { if (!el) return; el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
function marketResult() {
  const M = G.mk; M.phase = "done"; G.busy = true;
  const got = M.recipe.need.filter((id) => M.cart.includes(id)), miss = M.recipe.need.filter((id) => !M.cart.includes(id));
  const items = M.cart.map((id) => ING[id]), good = [], tips = [];
  let pts = got.length * 2; const max = M.recipe.need.length * 2 + 8;
  if (!miss.length) good.push("ซื้อของครบตามรายการ"); else tips.push(`ลืมซื้อ: ${miss.map((id) => ING[id].n).join(", ")}`);
  const carbs = items.filter((g) => g.stall === 3);
  if (carbs.some((g) => g.hp >= 2)) { pts += 2; good.push("เลือกข้าว/แป้งไม่ขัดสี"); } else if (carbs.some((g) => g.hp >= 0)) { pts += 1; tips.push("ลองเปลี่ยนเป็นข้าวกล้อง ข้าวเหนียวดำ หรือมันเทศ"); } else tips.push("อย่าลืมซื้อข้าว 1 อย่าง เช่น ข้าวกล้อง ข้าวเหนียวดำ");
  const extraVeg = items.filter((g) => g.stall === 0 && !M.recipe.need.includes(g.id)).length;
  if (extraVeg) { pts += Math.min(2, extraVeg); good.push(`ซื้อผักเพิ่ม ${extraVeg} อย่าง`); }
  if (items.some((g) => g.stall === 4 && g.hp > 0 && !["water", "milk", "tea"].includes(g.id))) { pts += 1; good.push("มีผลไม้น้ำตาลต่ำ"); } else tips.push("ซื้อผลไม้น้ำตาลต่ำ เช่น ฝรั่ง ชมพู่ ไว้เป็นของหวาน");
  if (items.some((g) => ["water", "milk", "tea"].includes(g.id))) { pts += 1; good.push("เครื่องดื่มไม่หวาน"); }
  const bad = items.filter((g) => g.hp < 0); bad.forEach((g) => { pts += g.hp; tips.push(TIPS_BAD[g.id] || g.n); });
  const left = MK_BUDGET - spent(); if (left >= 50) { pts += 1; good.push(`ประหยัด เหลือเงิน ${left} บาท`); }
  pts = Math.max(0, pts); const ratio = pts / max, st = ratio >= 0.85 ? 3 : ratio >= 0.65 ? 2 : ratio >= 0.4 ? 1 : 0;
  const secs = Math.round((performance.now() - M.t0) / 1000), best = Math.max(pts, window.PreDM?.store.get("vrMarketBest", 0) || 0); window.PreDM?.store.set("vrMarketBest", best);
  if (st >= 2) confetti();
  window.PreDMVoice?.say(["retry", "cheer2", "cheer1", "cheer3"][st]);
  $("#hkList").hidden = true;
  $("#hkCards").innerHTML = `<div class="hk-result"><span class="hk-rmasc">${window.PreDMMascot ? PreDMMascot.svg() : "💗"}</span><div class="fq-stars">${[0, 1, 2].map((k) => `<span class="${k < st ? "on" : ""}">★</span>`).join("")}</div>
    <h2>${["ลองจ่ายตลาดใหม่นะคะ", "ใช้ได้ค่ะ ปรับอีกนิด", "เก่งมาก! ตะกร้าสุขภาพ", "สุดยอดแม่ครัวสุขภาพ! 🧺"][st]}</h2>
    <p>${esc(M.recipe.n)} · ${pts}/${max} คะแนน · ใช้เงิน ${spent()} บาท · ${secs} วินาที · ดีที่สุด ${best}</p>
    <div class="hk-rbasket">${items.map((g) => `<span class="hk-chip ${g.hp < 0 ? "bad" : M.recipe.need.includes(g.id) ? "need" : ""}">${img(g.e)}<small>${esc(g.n)}</small></span>`).join("")}</div>
    ${good.length ? `<p class="ok">👍 ${good.map(esc).join(" · ")}</p>` : ""}${tips.length ? `<ul>${tips.slice(0, 5).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    <div class="hk-start-btns"><button type="button" class="btn primary" data-hk="cook">🍳 ทำเมนูนี้ วางลงพาข้าวเย็นนี้</button><button type="button" class="btn" data-hk="again">ไปตลาดอีกรอบ ↺</button></div></div>`;
  G.cards = []; say("แตะปุ่มด้วยเมาส์หรือนิ้วบนจอ");
}

/* ------------------------------------------------------------------ fun effects */
function fx(el, text, cls) {
  const layer = $("#hkFx"), st = $("#hkStage"); if (!layer || !el) return;
  const r = el.getBoundingClientRect(), sr = st.getBoundingClientRect(), x = r.left + r.width / 2 - sr.left, y = r.top + r.height / 2 - sr.top;
  const colors = cls === "bad" ? ["#ff7a59", "#ffb199"] : ["#ffd23f", "#3fbf6a", "#7b5cff", "#ff6fa5", "#5bc0ff"];
  let html = `<span class="hk-float ${cls}" style="left:${x}px;top:${y}px">${esc(text)}</span>`;
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, d = 60 + Math.random() * 50; html += `<i class="hk-spark" style="left:${x}px;top:${y}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;background:${colors[i % colors.length]}"></i>`; }
  const wrap = document.createElement("div"); wrap.innerHTML = html; layer.appendChild(wrap); setTimeout(() => wrap.remove(), 1100);
  const m = $("#hkMasc"); if (m) { m.classList.remove("cheer", "oops"); void m.offsetWidth; m.classList.add(cls === "bad" ? "oops" : "cheer"); }
}
function confetti() {
  const layer = $("#hkFx"); if (!layer) return; const wrap = document.createElement("div"), cs = ["#ffd23f", "#3fbf6a", "#7b5cff", "#ff6fa5", "#5bc0ff", "#ff9f43"];
  wrap.innerHTML = Array.from({ length: 70 }, (_, i) => `<i class="hk-conf" style="left:${Math.random() * 100}%;background:${cs[i % cs.length]};animation-delay:${(Math.random() * 0.6).toFixed(2)}s;--rot:${Math.round(Math.random() * 720)}deg"></i>`).join("");
  layer.appendChild(wrap); setTimeout(() => wrap.remove(), 3200);
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
    const now = performance.now(), dt = Math.min(300, now - (G.lastF || now)); G.lastF = now;
    let raw = null, ny = null;
    if (G.cam) {
      if (landmarker && v.readyState >= 2 && v.currentTime !== lastT) {
        lastT = v.currentTime;
        const lm = landmarker.detectForVideo(v, now).landmarks?.[0];
        if (lm) {
          const vw = v.videoWidth, vh = v.videoHeight, s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
          G.lm = lm.map((q) => ({ x: ox + (1 - q.x) * dw, y: oy + q.y * dh })); ny = lm[9].y; G.seenAt = now;
        } else if (now - (G.seenAt || 0) > 400) G.lm = null; // keep the last hand for a moment when tracking flickers
      }
      if (G.lm) { drawHand(ctx, G.lm); raw = G.lm[8]; }
    } else if (G.ptr) { raw = G.ptr; ny = G.ptr.ny; }
    // smooth the fingertip so small shakes do not move the pointer off a card
    if (raw) { const A = G.cam ? 0.3 : 1; G.sm = G.sm ? { x: G.sm.x + (raw.x - G.sm.x) * A, y: G.sm.y + (raw.y - G.sm.y) * A } : { x: raw.x, y: raw.y }; } else G.sm = null;
    const p = G.sm;
    if (G.pound && G.cam && !G.busy && ny != null) poundStep(ny);
    cur.hidden = !p; if (p) cur.style.transform = `translate(${p.x}px,${p.y}px)`;
    // hover + dwell: bigger target, sticky once hovered, short grace when the hand slips, progress pauses instead of resetting
    let hit = null, paused = false;
    if (p && !G.pound && !G.busy) {
      const sr = st.getBoundingClientRect();
      const inside = (c, pad) => { const r = c.getBoundingClientRect(); return p.x >= r.left - sr.left - pad && p.x <= r.right - sr.left + pad && p.y >= r.top - sr.top - pad && p.y <= r.bottom - sr.top + pad; };
      if (G.hover && G.hover.isConnected && inside(G.hover, 44)) hit = G.hover;
      else { let best = null, bd = 1e9; for (const c of G.cards) if (inside(c, 16)) { const r = c.getBoundingClientRect(), d = Math.hypot(p.x - (r.left + r.width / 2 - sr.left), p.y - (r.top + r.height / 2 - sr.top)); if (d < bd) { bd = d; best = c; } } hit = best; }
    }
    if (G.lock) { if (hit) hit = null; else if (p) G.lock = false; }
    if (!hit && G.hover && G.hover.isConnected && !G.lock && !G.busy && !G.pound) { G.slip = G.slip || now; if (now - G.slip < 450) { hit = G.hover; paused = true; } } else G.slip = 0;
    if (hit !== G.hover) { G.hover?.classList.remove("hot"); G.hover?.style.setProperty("--p", 0); G.hover = hit; G.acc = 0; if (hit) { hit.classList.add("hot"); window.PreDMMusic?.sfx("hover"); } }
    if (hit) {
      if (!paused) G.acc += dt;
      const k = Math.min(1, G.acc / DWELL); hit.style.setProperty("--p", k); cur.style.setProperty("--p", k);
      if (k >= 1) { const id = hit.dataset.id; hit.classList.remove("hot"); G.hover = null; G.acc = 0; G.lock = true; window.PreDMMusic?.sfx("pick"); choose(id, hit); }
    }
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
    if (a === "cook") { const r = G.mk.recipe; if (r && window.PreDMFood?.add && window.PreDMFood.DB.some((d) => d.key === r.key)) { window.PreDMFood.add(r.key, 1, "d"); window.PreDM?.toast(`วาง “${r.n}” ลงพาข้าวมื้อเย็นวันนี้แล้ว`); } close(); if (location.hash !== "#food") location.hash = "food"; return; }
  }
  const c = t(".hk-card"); if (c && !G.cam) { window.PreDMMusic?.sfx("pick"); G.lock = true; choose(c.dataset.id, c); } // tap also works without camera
}

document.addEventListener("click", (e) => { const g = e.target.closest("[data-handgame]"); if (!g) return; e.preventDefault(); open(["somtam", "market"].includes(g.dataset.handgame) ? g.dataset.handgame : "plate"); });
window.PreDMHandKitchen = { open, close };
