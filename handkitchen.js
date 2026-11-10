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
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
  try { landmarker = await HandLandmarker.createFromOptions(fs, opts("GPU")); } catch { landmarker = await HandLandmarker.createFromOptions(fs, opts("CPU")); }
  return landmarker;
}

/* ------------------------------------------------------------------ game data */
/* ---------- ตำส้มตำ: 12 kinds, ~45 ingredients / seasonings / sides with rough nutrition for the knowledge score ----------
   item: [id, emoji, name, group, sodium mg, sugar g, kcal, health points, tip, raw?] */
const ST_GROUPS = ["🥬 ผัก วัตถุดิบ", "🧂 เครื่องปรุง", "🦐 ใส่เพิ่ม", "🍙 เครื่องเคียง"];
const ST_ITEMS = [
  ["tomato", "🍅", "มะเขือเทศ", 0, 5, 2, 8, 2, "ผักแคลอรีต่ำ ให้รสเปรี้ยวธรรมชาติ"], ["longbean", "🫛", "ถั่วฝักยาว", 0, 2, 1, 10, 2, "ใยอาหารสูง ช่วยให้น้ำตาลขึ้นช้า"],
  ["eggplant", "🍆", "มะเขือเปราะ", 0, 2, 1, 8, 2, "ผักใยอาหารดี"], ["carrot", "🥕", "แครอทขูด", 0, 20, 2, 12, 1, "เพิ่มสีสันและวิตามินเอ"],
  ["cabbage", "🥬", "กะหล่ำปลีซอย", 0, 5, 1, 8, 2, "เพิ่มปริมาณผัก อิ่มนาน"], ["cucumber", "🥒", "แตงกวา", 0, 1, 1, 5, 2, "ฉ่ำน้ำ แคลอรีต่ำ"],
  ["garlic", "🧄", "กระเทียม", 0, 1, 0, 5, 1, "หอม ช่วยลดการใช้ผงปรุง"], ["chili", "🌶️", "พริกสด 3 เม็ด", 0, 1, 0, 2, 1, "เผ็ดพอดี เพิ่มรสโดยไม่เพิ่มเกลือ"],
  ["chili10", "🌶️", "พริกสด 10 เม็ด", 0, 2, 0, 4, 0, "เผ็ดจัด อาจระคายกระเพาะ"], ["lime", "🍋", "มะนาว", 0, 1, 1, 4, 1, "เปรี้ยวแทนการเติมน้ำปลา"],
  ["tamarind", "🫘", "มะขามเปียก", 0, 10, 3, 15, 0, "เปรี้ยวอมหวาน มีน้ำตาลธรรมชาติ"],
  ["fs1", "🫙", "น้ำปลา 1 ช้อน", 1, 450, 0, 3, 0, "พอดี (1 ช้อนชา ≈ 450 มก. โซเดียม)"], ["fs3", "🫙", "น้ำปลา 3 ช้อน", 1, 1350, 0, 9, -3, "เค็มมาก เกินครึ่งของโซเดียมทั้งวัน"],
  ["fslow", "🫙", "น้ำปลาสูตรลดโซเดียม", 1, 250, 0, 3, 1, "โซเดียมน้อยกว่าน้ำปลาปกติราว 40%"], ["pr1", "🫙", "ปลาร้าต้มสุก 1 ช้อน", 1, 450, 0, 10, 0, "ต้มสุกแล้วปลอดภัย ใช้น้อย ๆ"],
  ["pr3", "🫙", "ปลาร้าต้มสุก 3 ช้อน", 1, 1350, 0, 30, -3, "โซเดียมสูงมาก"], ["prraw", "🫙", "ปลาร้าดิบ ไม่ต้ม", 1, 500, 0, 10, -3, "ดิบ เสี่ยงพยาธิใบไม้ตับ ควรต้มสุกก่อนใช้", 1],
  ["sug1", "🍯", "น้ำตาลปี๊บ 1 ช้อน", 1, 0, 4, 16, -1, "น้ำตาล 4 กรัม ยังพอรับได้"], ["sug3", "🍯", "น้ำตาลปี๊บ 3 ช้อน", 1, 0, 12, 48, -3, "น้ำตาล 12 กรัม ทำให้น้ำตาลในเลือดพุ่ง"],
  ["sugw", "🍬", "น้ำตาลทราย 2 ช้อน", 1, 0, 8, 32, -2, "น้ำตาล 8 กรัม"], ["stevia", "🌿", "หญ้าหวาน แทนน้ำตาล", 1, 0, 0, 0, 1, "ให้ความหวานโดยไม่เพิ่มน้ำตาล"],
  ["msg", "🧂", "ผงชูรส", 1, 160, 0, 0, -1, "เพิ่มโซเดียม ไม่จำเป็นต่อรสชาติ"], ["seas", "🧂", "ผงปรุงรส", 1, 450, 0, 5, -2, "โซเดียมสูง"],
  ["kapi", "🫙", "กะปิ", 1, 300, 0, 10, -1, "เค็ม ใช้น้อย"], ["oyster", "🫙", "ซอสหอยนางรม", 1, 500, 2, 10, -1, "เค็มและหวาน"], ["salt", "🧂", "เกลือ ½ ช้อน", 1, 1150, 0, 0, -2, "เค็มจัด"],
  ["shrimpd", "🦐", "กุ้งแห้ง", 2, 250, 0, 30, 1, "โปรตีน แต่เค็มนิด ใส่พอประมาณ"], ["peanut", "🥜", "ถั่วลิสงคั่ว", 2, 5, 1, 90, 1, "ไขมันดีและโปรตีน"],
  ["crabraw", "🦀", "ปูนาดอง ดิบ", 2, 700, 0, 30, -3, "ดิบ เสี่ยงพยาธิ และเค็มมาก", 1], ["crabck", "🦀", "ปูนาต้มสุก", 2, 200, 0, 35, 1, "สุกแล้วปลอดภัยกว่าปูดอง"],
  ["bluecrab", "🦀", "ปูม้าต้มสุก", 2, 250, 0, 60, 1, "โปรตีนดี"], ["saltegg", "🥚", "ไข่เค็ม", 2, 700, 0, 90, -1, "โซเดียมสูง"],
  ["mooyor", "🌭", "หมูยอ", 2, 450, 2, 80, -1, "อาหารแปรรูป เค็ม"], ["shrimpck", "🦐", "กุ้งลวกสุก", 2, 150, 0, 45, 2, "โปรตีนดี ไขมันต่ำ"],
  ["squidck", "🦑", "ปลาหมึกลวก", 2, 200, 0, 45, 1, "ไขมันต่ำ"], ["cockle", "🦪", "หอยแครงลวกสุก", 2, 200, 0, 40, 0, "ลวกให้สุกทั่วถึง"],
  ["clamraw", "🦪", "หอยดอง ดิบ", 2, 600, 0, 30, -3, "ดิบ เสี่ยงเชื้อโรค", 1], ["kjeen", "🍜", "ขนมจีน 1 จับ", 2, 20, 0, 120, 0, "เป็นแป้ง นับแทนข้าว"],
  ["sticky1", "🍙", "ข้าวเหนียว 1 ปั้น", 3, 2, 0, 160, 0, "พอดีสำหรับ 1 มื้อ"], ["sticky2", "🍙", "ข้าวเหนียว 2 ปั้น", 3, 4, 0, 320, -2, "แป้งมากเกินไป"],
  ["sideveg", "🥬", "ผักแนม", 3, 10, 2, 20, 2, "ช่วยลดเผ็ดและเพิ่มใยอาหาร"], ["gaiyang", "🍗", "ไก่ย่างไม่ติดหนัง", 3, 500, 1, 200, 1, "โปรตีนดี ลอกหนังลดไขมัน"],
  ["kormoo", "🥓", "คอหมูย่าง", 3, 600, 2, 330, -2, "ไขมันสูงมาก"], ["kabmoo", "🥓", "แคบหมู", 3, 450, 0, 170, -2, "ไขมันและเกลือสูง"],
  ["boilegg", "🥚", "ไข่ต้ม", 3, 70, 0, 75, 1, "โปรตีนราคาประหยัด"], ["platup", "🐟", "ปลาทูนึ่ง", 3, 400, 0, 140, 1, "โปรตีนดี มีไขมันดี"],
].map(([id, e, n, g, na, sug, kcal, hp, tip, raw]) => ({ id, e, n, g, na, sug, kcal, hp, tip, raw: !!raw }));
const STI = Object.fromEntries(ST_ITEMS.map((x) => [x.id, x]));
// kind: [id, name, base, sauce, cupboard key, base nutrition {na, sug, kcal}, classic recipe, description]
const ST_TYPES = [
  ["thai", "ส้มตำไทย", "papaya", "thai", "somtam-thai", [60, 3, 50], ["tomato", "longbean", "garlic", "chili", "lime", "fs1", "sug1", "shrimpd", "peanut"], "รสหวานเปรี้ยว ใส่ถั่ว กุ้งแห้ง"],
  ["lao", "ตำลาว ปลาร้า", "papaya", "lao", "somtam-pla", [60, 2, 45], ["tomato", "longbean", "eggplant", "garlic", "chili", "lime", "pr1"], "รสนัวแซ่บ ใส่ปลาร้าต้มสุก"],
  ["sua", "ตำซั่ว", "papaya", "lao", "tam-sua", [60, 2, 45], ["kjeen", "tomato", "longbean", "garlic", "chili", "lime", "pr1"], "ใส่ขนมจีนคลุกในจาน"],
  ["poo", "ตำปูนา", "papaya", "lao", "tam-poo", [60, 2, 45], ["crabck", "tomato", "longbean", "garlic", "chili", "lime", "pr1"], "ใส่ปูนา ต้องต้มสุก"],
  ["pa", "ตำป่า", "papaya", "lao", "tam-pon", [60, 2, 45], ["kjeen", "cabbage", "longbean", "cockle", "chili", "lime", "pr1"], "รวมมิตรผักและหอย"],
  ["tang", "ตำแตง", "cucumber", "thai", "tam-tang", [40, 2, 30], ["tomato", "longbean", "garlic", "chili", "lime", "fs1", "peanut"], "แตงกวากรอบ ฉ่ำน้ำ"],
  ["tua", "ตำถั่ว", "longbean", "thai", "tam-tang", [40, 2, 40], ["tomato", "garlic", "chili", "lime", "fs1", "shrimpd"], "ถั่วฝักยาวล้วน ใยอาหารสูง"],
  ["corn", "ตำข้าวโพด", "corn", "thai", "somtam-thai", [40, 6, 130], ["tomato", "longbean", "garlic", "chili", "lime", "fs1", "saltegg"], "ข้าวโพดหวานกรอบ (นับเป็นแป้ง)"],
  ["fruit", "ตำผลไม้", "fruit", "thai", "tam-ponlamai", [40, 18, 120], ["tomato", "garlic", "chili", "lime", "fs1", "peanut"], "ผลไม้รวม หวานธรรมชาติ"],
  ["kaikem", "ตำไข่เค็ม", "papaya", "thai", "somtam-thai", [60, 3, 50], ["saltegg", "tomato", "longbean", "garlic", "chili", "lime"], "ไข่เค็มมัน ๆ (เค็มนะ)"],
  ["talay", "ตำทะเลสุก", "papaya", "thai", "somtam-thai", [60, 3, 50], ["shrimpck", "squidck", "tomato", "longbean", "chili", "lime", "fs1"], "กุ้ง ปลาหมึก ลวกสุก"],
  ["mango", "ตำมะม่วง", "mango", "thai", "somtam-thai", [30, 8, 60], ["tomato", "garlic", "chili", "lime", "fs1", "shrimpd", "peanut"], "มะม่วงดิบเปรี้ยว (มีน้ำตาลนิดหน่อย)"],
].map(([id, n, base, sauce, key, nut, classic, desc]) => ({ id, n, base, sauce, key, nut: { na: nut[0], sug: nut[1], kcal: nut[2] }, classic, desc }));
const STT = Object.fromEntries(ST_TYPES.map((t) => [t.id, t]));
const ST_MAX = 10, ST_PER = 6, POUNDS = 10;
const ST_LOG = { sticky1: ["sticky", 1], sticky2: ["sticky", 2], gaiyang: ["gai-yang", 1], kormoo: ["kor-moo", 1], sideveg: ["pak", 1], boilegg: ["kai-tom", 1], kabmoo: ["kab-moo", 1] };
const PLATE_STEPS = [
  { kind: "rice", n: 1, t: "เลือกข้าว/แป้ง 1 อย่าง" }, { kind: "pro", n: 1, t: "เลือกโปรตีน 1 อย่าง" },
  { kind: "veg", n: 2, t: "เลือกผัก 2 อย่าง" }, { kind: "drink", n: 1, t: "เลือกเครื่องดื่ม 1 อย่าง" },
];


/* ---------- ตลาดแตะมือ: ingredients by stall  [id, emoji, name, price, health points] ---------- */
const STALLS = [
  { n: "🥬 ร้านผักสด", items: [["papaya","🍈","มะละกอดิบ",15,2],["tomato","🍅","มะเขือเทศ",10,2],["longbean","🫛","ถั่วฝักยาว",10,2],["cucumber","🥒","แตงกวา",10,2],["cabbage","🥬","กะหล่ำปลี",20,2],["chinesecab","🥬","ผักกาดขาว",15,2],["morningglory","🌿","ผักบุ้งจีน",10,2],["kale","🥬","คะน้า",15,2],["lettuce","🥬","ผักกาดหอม",15,2],["spinach","🥬","ผักโขม",15,2],["spring","🌱","ต้นหอม ผักชี",5,1],["strawmush","🍄","เห็ดฟาง",20,2],["oystermush","🍄","เห็ดนางฟ้า",15,2],["enoki","🍄","เห็ดเข็มทอง",15,2],["eggplant","🍆","มะเขือเปราะ",10,2],["longeggplant","🍆","มะเขือยาว",15,2],["babycorn","🌽","ข้าวโพดอ่อน",15,2],["carrot","🥕","แครอท",10,2],["broccoli","🥦","บรอกโคลี",25,2],["cauliflower","🥦","กะหล่ำดอก",25,2],["bellpep","🫑","พริกหวาน",20,2],["gourd","🥒","บวบ",15,2],["bittergourd","🥒","มะระจีน",15,2],["wintermelon","🍈","ฟักเขียว",20,2],["sprout","🌱","ถั่วงอก",10,1],["ivygourd","🍃","ตำลึง",10,2]] },
  { n: "🌿 ร้านผักพื้นบ้านอีสาน", items: [["yanang","🍃","ใบย่านาง",10,2],["localveg","🌱","ผักติ้ว",10,2],["khayaeng","🌿","ผักแขยง",10,2],["kadon","🍃","ผักกะโดน",10,2],["makok","🍃","ยอดมะกอก",10,2],["phakwan","🥬","ผักหวานป่า",30,2],["dokkhae","🌼","ดอกแค",15,2],["dill","🌿","ผักชีลาว",10,2],["chaplu","🍃","ใบชะพลู",10,2],["sadao","🌿","สะเดา",15,2],["fern","🌿","ผักกูด",15,2],["mek","🍃","ผักเม็ก",10,2],["bamboo","🎋","หน่อไม้",20,2],["termitemush","🍄","เห็ดโคน",60,2],["ragong","🍄","เห็ดระโงก",50,2],["mangoshoot","🍃","ยอดมะม่วง",10,2],["fieldmg","🌿","ผักบุ้งนา",10,2],["phaiveg","🌿","ผักไผ่ ผักแพว",10,2],["acacia","🌿","ชะอม",15,2]] },
  { n: "🧂 ร้านเครื่องปรุง สมุนไพร", items: [["chili","🌶️","พริกขี้หนู",5,1],["garlic","🧄","กระเทียม",10,1],["shallot","🧅","หอมแดง",10,1],["lemongrass","🌿","ตะไคร้",10,1],["galangal","🫚","ข่า",10,1],["ginger","🫚","ขิง",10,1],["kaffir","🍃","ใบมะกรูด",5,1],["lime","🍋","มะนาว",10,1],["roastrice","🌾","ข้าวคั่ว",10,1],["basilholy","🌿","ใบกะเพรา",10,1],["basil","🌿","ใบโหระพา แมงลัก",10,1],["mint","🌿","ใบสะระแหน่",10,1],["banana-leaf","🍃","ใบตอง",10,1],["tamarind","🫘","มะขามเปียก",15,1],["padaek","🫙","ปลาร้า",25,0],["fishsauce","🫙","น้ำปลา",20,0],["fslow","🫙","น้ำปลาลดโซเดียม",30,1],["soy","🫙","ซีอิ๊วขาว",20,0],["kapi","🫙","กะปิ",20,0],["salt","🧂","เกลือ",5,0],["curry","🌶️","พริกแกง",15,0],["chilipowder","🌶️","พริกป่น",10,0],["vinegar","🫙","น้ำส้มสายชู",15,1],["oil","🫒","น้ำมันพืช",35,0],["msg","🧂","ผงชูรส ผงปรุงรส",15,-2],["sugar","🍯","น้ำตาลทราย",15,-2],["coconutmilk","🥥","กะทิกล่อง",25,-1],["oyster","🫙","ซอสหอยนางรม",25,-1],["darksoy","🫙","ซีอิ๊วดำหวาน",20,-1]] },
  { n: "🥩 ร้านเนื้อสัตว์", items: [["breast","🍗","อกไก่",45,2],["thigh","🍗","สะโพกไก่",40,1],["bannchicken","🐓","ไก่บ้าน",80,1],["chickenfeet","🍗","ตีนไก่",30,0],["minced","🥩","หมูสับ",40,1],["tenderloin","🥩","หมูสันใน",50,1],["porkliver","🥩","ตับหมู",30,0],["ribs","🍖","ซี่โครงหมู",65,-1],["pork-belly","🥓","หมูสามชั้น",60,-2],["beef","🥩","เนื้อวัว",90,0],["duck","🦆","เป็ด",80,0],["frog","🐸","กบ",50,1],["anteggs","🐜","ไข่มดแดง",60,1],["sausage","🌭","ไส้กรอก หมูยอ",35,-2],["naem","🌭","แหนม",30,-1],["meatball","🍢","ลูกชิ้น",30,-1]] },
  { n: "🦐 ร้านอาหารทะเล ปลา", items: [["tilapia","🐟","ปลานิล",55,2],["snakehead","🐟","ปลาช่อน",70,2],["catfish","🐟","ปลาดุก",45,1],["mackerel","🐟","ปลาทู",40,2],["seabass","🐟","ปลากะพง",90,2],["salmon","🐟","ปลาแซลมอน",120,2],["shrimp","🦐","กุ้งสด",70,1],["squid","🦑","ปลาหมึก",60,1],["ricecrab","🦀","ปูนา",35,0],["bluecrab","🦀","ปูม้า",120,1],["cockle","🦪","หอยแครง",50,0],["mussel","🦪","หอยแมลงภู่",45,1],["lobster","🦞","กุ้งมังกร",250,1],["fishball","🍥","ลูกชิ้นปลา",30,0]] },
  { n: "🍚 ร้านข้าว แป้ง เส้น", items: [["sticky","🍙","ข้าวเหนียว",40,0],["blacksticky","🍙","ข้าวเหนียวดำ",50,2],["brownrice","🍚","ข้าวกล้อง",45,2],["jasmine","🍚","ข้าวหอมมะลิ",40,0],["riceberry","🍚","ข้าวไรซ์เบอร์รี่",60,2],["khanomjeen","🍜","ขนมจีน",25,0],["noodle","🍜","เส้นก๋วยเตี๋ยว",20,0],["glassnoodle","🍜","วุ้นเส้น",15,0],["instant","🍜","บะหมี่กึ่งสำเร็จรูป",7,-2],["wwbread","🍞","ขนมปังโฮลวีต",35,2],["whitebread","🍞","ขนมปังขาวหวาน",30,-1],["sweetpotato","🍠","มันเทศ",20,2],["corn","🌽","ข้าวโพด",20,1],["potato","🥔","มันฝรั่ง",25,0]] },
  { n: "🍐 ร้านผลไม้", items: [["guava","🍐","ฝรั่ง",25,2],["rose-apple","🍎","ชมพู่",30,2],["apple","🍏","แอปเปิลเขียว",35,2],["pomelo","🍊","ส้มโอ",40,1],["orange","🍊","ส้ม",30,1],["banana","🍌","กล้วยน้ำว้า",20,1],["papayaripe","🍈","มะละกอสุก",25,1],["mango","🥭","มะม่วงสุก",40,0],["watermelon","🍉","แตงโม",30,0],["pineapple","🍍","สับปะรด",25,0],["grape","🍇","องุ่น",60,-1],["coconut","🥥","มะพร้าวอ่อน",30,0],["strawberry","🍓","สตรอว์เบอร์รี",60,1]] },
  { n: "🧺 ร้านของเบ็ดเตล็ด โชห่วย", items: [["egg","🥚","ไข่ไก่",30,2],["tofu","🧈","เต้าหู้",15,2],["water","💧","น้ำเปล่า",10,2],["milk","🥛","นมจืด",15,1],["soymilk","🥛","นมถั่วเหลืองไม่หวาน",15,1],["tea","🍵","ชาไม่หวาน",15,1],["nuts","🥜","ถั่วอบไม่เค็ม",25,1],["soda","🥤","น้ำอัดลม",15,-3],["bubbletea","🧋","ชานมไข่มุก",35,-3],["juice","🧃","น้ำผลไม้กล่อง",15,-2],["coffee3","☕","กาแฟ 3 in 1",10,-2],["snack","🍬","ขนมขบเคี้ยว",20,-2],["cookie","🍪","ขนมปังกรอบ",20,-2],["beer","🍺","เบียร์",45,-2],["cupnoodle","🍜","บะหมี่ถ้วย",15,-2]] },
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
const MK_BUDGET = 400, MK_MAX = 25, PER_PAGE = 6;
const TIPS_BAD = { msg: "ผงชูรส/ผงปรุง โซเดียมสูง ใช้สมุนไพรแทน", sugar: "น้ำตาลเพิ่มน้ำตาลในเลือด ใช้มะนาว/มะเขือเทศให้รสแทน", "pork-belly": "หมูสามชั้นไขมันสูง เปลี่ยนเป็นหมูสันในหรืออกไก่", sausage: "อาหารแปรรูป เค็มและมัน", meatball: "ลูกชิ้นแปรรูป โซเดียมสูง", instant: "บะหมี่กึ่งฯ โซเดียมสูงมาก", soda: "น้ำอัดลม น้ำตาล ~9 ช้อนชา", ribs: "ซี่โครงหมูติดมัน ไขมันสูง", naem: "แหนมเป็นอาหารหมักที่ไม่ผ่านความร้อน ควรทำให้สุกก่อนกิน", coffee3: "กาแฟ 3 in 1 มีน้ำตาลและครีมเทียม", cookie: "แป้ง น้ำตาล และไขมัน", cupnoodle: "โซเดียมสูงมาก", darksoy: "ซีอิ๊วดำหวานมีน้ำตาลสูง", bubbletea: "ชานมไข่มุก น้ำตาลและแป้งสูง", juice: "น้ำผลไม้กล่อง น้ำตาลสูง ไม่มีใยอาหาร", snack: "ขนมถุง น้ำตาล/เกลือสูง", beer: "แอลกอฮอล์ทำให้น้ำตาลแกว่ง", whitebread: "แป้งขัดขาวและน้ำตาล", grape: "องุ่นหวานมาก", coconutmilk: "กะทิไขมันอิ่มตัวสูง", oyster: "ซอสหอยนางรมเค็มและหวาน" };

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
      <div class="hk-cursor alt" id="hkCursor2" hidden><i></i></div>
      <div class="hk-hud">
        <button type="button" class="hk-x" data-hk="close" aria-label="ปิดเกม">✕</button>
        <span class="hk-masc" id="hkMasc" aria-hidden="true"></span><div class="hk-title"><b id="hkTitle">ครัวแตะมือ</b><span id="hkSay">ชี้นิ้วชี้ค้างไว้ที่การ์ดเพื่อเลือก</span></div>
        <button type="button" class="hk-x hk-mu" data-voice aria-label="เปิด/ปิดเสียงพากย์">🗣️</button><button type="button" class="hk-x hk-mu" data-music aria-label="เปิด/ปิดเพลง">🎵</button><div class="hk-modes" role="tablist"><button type="button" data-hkmode="market">🧺 จ่ายตลาด</button><button type="button" data-hkmode="noodle">🍜 ร้านก๋วยเตี๋ยว</button><button type="button" data-hkmode="plate">🍽️ จัดพาข้าว</button><button type="button" data-hkmode="somtam">🥗 ตำส้มตำ</button></div>
      </div>
      <div class="hk-mortar" id="hkMortar" hidden aria-hidden="true">
        <svg class="hk-m-back" viewBox="0 0 240 150"><ellipse cx="120" cy="34" rx="104" ry="26" fill="#9c5b2e"/><ellipse cx="120" cy="36" rx="88" ry="19" fill="#3d2112"/></svg>
        <div class="hk-mix" id="hkMix"></div>
        <div class="hk-pestle" id="hkPestle" hidden><svg viewBox="0 0 60 220"><defs><linearGradient id="hkWood" x1="0" x2="1"><stop offset="0" stop-color="#8a5a2b"/><stop offset=".45" stop-color="#d9a066"/><stop offset="1" stop-color="#7a4a20"/></linearGradient></defs><rect x="20" y="6" width="20" height="120" rx="10" fill="url(#hkWood)"/><path d="M14 118h32l6 80a22 18 0 0 1-44 0z" fill="url(#hkWood)"/><ellipse cx="30" cy="198" rx="22" ry="9" fill="#6b3f1a"/><path d="M24 20v90" stroke="#f3cf9a" stroke-width="3" opacity=".5" stroke-linecap="round"/></svg></div>
        <svg class="hk-m-front" viewBox="0 0 240 150"><defs><linearGradient id="hkClay" x1="0" x2="1"><stop offset="0" stop-color="#7a3f1d"/><stop offset=".5" stop-color="#c46e37"/><stop offset="1" stop-color="#6e3818"/></linearGradient></defs><path d="M16 34a104 26 0 0 0 208 0c0 50-36 84-70 92v14H86v-14C52 118 16 84 16 34z" fill="url(#hkClay)"/><path d="M40 60c18 30 44 46 80 48" stroke="#e8a06a" stroke-width="5" fill="none" opacity=".45" stroke-linecap="round"/><rect x="72" y="134" width="96" height="12" rx="6" fill="#5a2c12"/></svg>
      </div>
      <div class="hk-serve" id="hkServe" hidden aria-hidden="true"></div>
      <div class="hk-bowl" id="hkBowl" hidden aria-hidden="true"></div>
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
  st.addEventListener("pointermove", (e) => { if (G.cam) return; const r = st.getBoundingClientRect(); G.ptr = { x: e.clientX - r.left, y: e.clientY - r.top, ny: (e.clientY - r.top) / r.height }; if (G.pound && !G.busy) { pestleTo(G.ptr.ny); poundStep(G.ptr.ny); } });
  st.addEventListener("pointerleave", () => { if (!G.cam) G.ptr = null; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !m.hidden) close(); });
}

function open(mode) {
  shell(); G.mode = mode || G.mode;
  $("#hkStartT").textContent = { market: "🧺 ตลาดแตะมือ", noodle: "🍜 ร้านก๋วยเตี๋ยวแตะมือ", somtam: "🥗 ร้านส้มตำแตะมือ" }[G.mode] || "ครัวแตะมือ";
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
  G.step = 0; G.picks = []; G.pound = null; G.busy = false; G.spoke = null; G.st = { type: null, tpage: 0, group: 0, page: 0 };
  document.querySelectorAll("#hkModal [data-hkmode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hkmode === G.mode)));
  $("#hkBg").className = "hk-bg " + G.mode;
  $("#hkMortar").hidden = G.mode !== "somtam"; $("#hkPestle").hidden = true; $("#hkServe").hidden = true; $("#hkMix").innerHTML = ""; $("#hkMortar").classList.remove("gone");
  G.mk = { phase: "menu", recipe: null, stall: 0, page: 0, menuPage: 0, cart: [], combo: 0, t0: 0 };
  G.score = 0; $("#hkList").hidden = true; if (G.mode === "noodle") ndNew(); ndBowl();
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
  } else if (G.mode === "noodle") items = noodleItems();
  else if (G.pound) { items = []; $("#hkTitle").textContent = `🥗 ${STT[G.st.type].n} · ตำเลย!`; }
  else items = somtamItems();
  // big screens: cards on an arc so the middle (the player's face) stays clear; phones: a tidy grid
  const n = items.length, narrow = ($("#hkStage").clientWidth || innerWidth) < 760;
  const lifted = (G.mode === "market" && G.mk?.phase === "shop") || G.mode === "somtam" || G.mode === "noodle"; // leave room for the list strip / mortar / bowl
  box.innerHTML = items.map((c, i) => {
    let x, y;
    if (narrow) { const cols = 3, rows = Math.ceil(n / cols), r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), col = i - r * cols; x = 50 + (col - (inRow - 1) / 2) * 32; y = rows === 1 ? 48 : 31 + (r * (lifted ? 34 : 44)) / (rows - 1); }
    else { const t = n === 1 ? 0.5 : i / (n - 1), ang = Math.PI * (lifted ? 1 - t : 1.05 - 1.1 * t); x = 50 + Math.cos(ang) * 41; y = (lifted ? 60 : 66) - Math.sin(ang) * (lifted ? 40 : 46); }
    return `<div class="hk-card${c.big ? " big" : ""}${c.cls ? " " + c.cls : ""}" data-id="${esc(c.id)}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"><span class="hk-ring"></span>${c.badge ? `<em class="hk-badge">${c.badge}</em>` : ""}<span class="hk-pic">${c.html || img(c.e, c.key)}</span><b>${esc(c.n)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</div>`;
  }).join("");
  G.cards = [...box.children]; Object.values(PTR).forEach((q) => { q.hover = null; q.acc = 0; });
  tray();
}
function tray() {
  if (G.mode === "market") return marketTray();
  if (G.mode === "noodle") { // what is in the bowl so far + tips earned
    const chips = ND_STEPS.flatMap((st) => ndPicked(st.k).map((id) => st.items.find((i) => i.id === id))).map((x) => `<span class="hk-chip">${img(x.e)}<small>${esc(x.n)}</small></span>`);
    $("#hkTray").innerHTML = `<span class="hk-tray-l">🍜 ในชาม</span>${chips.join("") || `<small class="hk-empty">ยังว่างอยู่</small>`}<span class="hk-money">💰 ${G.nd?.coins || 0} บาท</span>`;
    return;
  }
  const DB = window.PreDMFood?.DB || [];
  const chips = G.mode === "plate"
    ? G.picks.map((p) => { const d = DB.find((x) => x.key === p.key); return d ? `<span class="hk-chip">${img(d.e, d.key)}<small>${esc(d.n)}</small></span>` : ""; })
    : G.picks.map((p) => { const x = STI[p.id]; return x ? `<span class="hk-chip">${img(x.e)}<small>${esc(x.n)}</small></span>` : ""; });
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
  if (G.mode === "noodle") return noodleChoose(id, el);
  if (G.mode === "somtam" && somtamNav(id)) return;
  if (id === "pound") { window.PreDMMusic?.stop(); window.PreDMVoice?.say("st_pound"); G.pound = { n: 0, goal: POUNDS, dir: 0, ext: null }; G.pY = null; $("#hkPestle").hidden = false; $("#hkPestle").style.setProperty("--k", 0); say(`ตำ ๆ ๆ! ยกมือขึ้น–ลงแรง ๆ เหมือนจับสาก ${POUNDS} ครั้ง`); layout(); return; }
  const k = G.picks.findIndex((p) => p.id === id);
  if (k >= 0) { G.picks.splice(k, 1); renderMix(); return layout(); } // tap again = take it out
  if (G.picks.length >= ST_MAX) { say(`ใส่ได้สูงสุด ${ST_MAX} อย่าง แตะ “เริ่มตำ!” ได้เลย`); return; }
  G.picks.push({ id }); pop(); renderMix(true); layout();
}
/* ---------- som tam: choose the kind, then ingredients by group (pages), then pound ---------- */
function somtamItems() {
  const S2 = G.st;
  if (!S2.type) {
    $("#hkTitle").textContent = "🥗 ร้านส้มตำ · วันนี้ตำอะไรดี?"; if (G.spoke !== "st") { G.spoke = "st"; window.PreDMVoice?.say("st_pick"); }
    say("เลือกชนิดส้มตำก่อน แล้วค่อยเลือกเครื่องใส่ครก");
    const pages = Math.ceil(ST_TYPES.length / ST_PER), list = ST_TYPES.slice(S2.tpage * ST_PER, S2.tpage * ST_PER + ST_PER);
    return [...list.map((t) => ({ id: "t:" + t.id, html: plateSVG(t.id, t.classic.slice(0, 4), [], "card"), n: t.n, sub: t.desc })), { id: "tmore", e: "🔄", n: "ชนิดอื่น", sub: `หน้า ${S2.tpage + 1}/${pages}` }];
  }
  const T = STT[S2.type], grp = ST_ITEMS.filter((x) => x.g === S2.group), pages = Math.ceil(grp.length / ST_PER), view = grp.slice(S2.page * ST_PER, S2.page * ST_PER + ST_PER);
  $("#hkTitle").textContent = `🥗 ${T.n} · ${ST_GROUPS[S2.group]}${pages > 1 ? ` ${S2.page + 1}/${pages}` : ""}`;
  say(`เลือกได้ ${ST_MAX - G.picks.length} อย่าง · ป้าย 📋 = สูตรดั้งเดิมของ${T.n} · แตะซ้ำเพื่อเอาออก`);
  const items = view.map((x) => { const inn = G.picks.some((p) => p.id === x.id), cl = T.classic.includes(x.id); return { id: x.id, e: x.e, n: x.n, sub: inn ? "✓ ในครก" : x.tip.length > 26 ? x.tip.slice(0, 25) + "…" : x.tip, cls: inn ? "in" : cl ? "need" : "", badge: inn ? "✓" : cl ? "📋" : "" }; });
  const last = S2.group === ST_GROUPS.length - 1 && S2.page === pages - 1;
  items.unshift({ id: "sprev", e: "⬅️", n: S2.group === 0 && S2.page === 0 ? "เปลี่ยนชนิด" : "ย้อนกลับ" });
  if (!last) items.push({ id: "snext", e: "➡️", n: S2.page < pages - 1 ? "หน้าถัดไป" : ST_GROUPS[S2.group + 1], sub: "หมวดถัดไป" });
  if (G.picks.length) items.push({ id: "pound", e: "🪵", n: "เริ่มตำ!", big: true, sub: `${POUNDS} ครั้ง` });
  return items;
}
function somtamNav(id) {
  const S2 = G.st;
  if (id === "tmore") { S2.tpage = (S2.tpage + 1) % Math.ceil(ST_TYPES.length / ST_PER); layout(); return true; }
  if (id.startsWith("t:")) { S2.type = id.slice(2); S2.group = 0; S2.page = 0; renderMix(); window.PreDMMusic?.sfx("ok"); layout(); return true; }
  const pagesOf = (g) => Math.ceil(ST_ITEMS.filter((x) => x.g === g).length / ST_PER);
  if (id === "snext") { if (S2.page < pagesOf(S2.group) - 1) S2.page++; else { S2.group++; S2.page = 0; } layout(); return true; }
  if (id === "sprev") { if (S2.page > 0) S2.page--; else if (S2.group > 0) { S2.group--; S2.page = pagesOf(S2.group) - 1; } else { S2.type = null; G.picks = []; renderMix(); } layout(); return true; }
  return false;
}
function stTotals() {
  const T = STT[G.st.type], t = { na: T.nut.na, sug: T.nut.sug, add: 0, kcal: T.nut.kcal, raw: false };
  G.picks.forEach((p) => { const x = STI[p.id]; if (!x) return; t.na += x.na; t.sug += x.sug; t.kcal += x.kcal; if (x.g === 1 || x.id === "tamarind") t.add += x.sug; if (x.raw) t.raw = true; });
  return t;
}
// a deterministic pseudo-random generator so the same dish always looks the same
function rng(seed) { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
// an appetising plate of som tam drawn as SVG: blue-rim plate, banana leaves, domed shredded heap, glossy sauce, toppings, sides
function plateSVG(typeId, toppings, sides, cls) {
  const T = STT[typeId], r = rng(typeId + toppings.join() + sides.join()), P = (e) => picSrc(STI[e]?.e || e), uid = typeId + (cls || "") + Math.floor(r() * 1e6);
  const base = { papaya: ["#e2f3b0", "#cbe78f", "#b6d978"], cucumber: ["#d8efb6", "#a9d47f", "#7fbf5a"], longbean: ["#6cbc45", "#58a535", "#80cc5a"], corn: ["#f6d860", "#f9e590", "#eac340"], mango: ["#f4e08a", "#ecd267", "#f9edb0"], fruit: ["#f6c76b", "#ef8f6f", "#9fd27a"] }[T.base];
  const inHeap = (k = 1) => { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * k; return [150 + Math.cos(a) * d * 86, 146 + Math.sin(a) * d * 56]; };
  let g = "";
  if (T.base === "corn") for (let i = 0; i < 120; i++) { const [x, y] = inHeap(); g += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(4 + r() * 1.5).toFixed(1)}" ry="${(3.4 + r()).toFixed(1)}" fill="${base[i % 3]}" stroke="#d6a52a" stroke-width=".7"/>`; }
  else if (T.base === "longbean") for (let i = 0; i < 60; i++) { const [x, y] = inHeap(), ang = r() * Math.PI, l = 12 + r() * 14; g += `<line x1="${(x - Math.cos(ang) * l).toFixed(1)}" y1="${(y - Math.sin(ang) * l).toFixed(1)}" x2="${(x + Math.cos(ang) * l).toFixed(1)}" y2="${(y + Math.sin(ang) * l).toFixed(1)}" stroke="${base[i % 3]}" stroke-width="7" stroke-linecap="round"/>`; }
  else if (T.base !== "fruit") {
    for (let i = 0; i < 160; i++) { const [x, y] = inHeap(), ang = r() * Math.PI * 2, l = 14 + r() * 22, bend = (r() - 0.5) * 24; g += `<path d="M${(x - Math.cos(ang) * l).toFixed(1)} ${(y - Math.sin(ang) * l).toFixed(1)} q${bend.toFixed(1)} ${(-bend).toFixed(1)} ${(Math.cos(ang) * l * 2).toFixed(1)} ${(Math.sin(ang) * l * 2).toFixed(1)}" stroke="${base[i % 3]}" stroke-width="${(2.2 + r() * 1.8).toFixed(1)}" fill="none" stroke-linecap="round"/>`; }
    if (T.base === "papaya" || T.base === "mango") for (let i = 0; i < 22; i++) { const [x, y] = inHeap(0.9), ang = r() * Math.PI * 2, l = 12 + r() * 14; g += `<path d="M${(x - Math.cos(ang) * l).toFixed(1)} ${(y - Math.sin(ang) * l).toFixed(1)} q6 -6 ${(Math.cos(ang) * l * 2).toFixed(1)} ${(Math.sin(ang) * l * 2).toFixed(1)}" stroke="#f08a3c" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; } // carrot
  }
  const sauce = T.sauce === "lao" ? "#5e3a1c" : "#e5782f"; let gloss = "";
  for (let i = 0; i < 6; i++) { const [x, y] = inHeap(0.75), rx = 16 + r() * 22; gloss += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 0.55).toFixed(1)}" fill="${sauce}" opacity="${T.sauce === "lao" ? 0.45 : 0.32}"/><ellipse cx="${(x - rx * 0.3).toFixed(1)}" cy="${(y - rx * 0.18).toFixed(1)}" rx="${(rx * 0.3).toFixed(1)}" ry="${(rx * 0.1).toFixed(1)}" fill="#fff" opacity=".35"/>`; }
  for (let i = 0; i < 26; i++) { const [x, y] = inHeap(0.85); gloss += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.4 + r() * 1.8).toFixed(1)}" fill="${i % 4 ? "#d22f22" : "#fff0c0"}"/>`; } // chilli flakes & garlic bits
  let extra = "";
  if (toppings.includes("peanut")) for (let i = 0; i < 18; i++) { const [x, y] = inHeap(0.8); extra += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.6" ry="2.6" fill="#e9c98f" stroke="#b9894a" stroke-width=".8" transform="rotate(${Math.round(r() * 180)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }
  if (toppings.includes("shrimpd")) for (let i = 0; i < 10; i++) { const [x, y] = inHeap(0.8); extra += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} a5 5 0 1 1 8 4" stroke="#f07b54" stroke-width="3.2" fill="none" stroke-linecap="round"/>`; }
  const lime = toppings.includes("lime") ? `<g transform="translate(70 120) rotate(-20)"><path d="M0 0a26 26 0 0 0 52 0z" fill="#7fbf3f"/><path d="M5 2a21 21 0 0 0 42 0z" fill="#e7f5b8"/><path d="M26 2v19M26 2l-13 15M26 2l13 15" stroke="#a6d46a" stroke-width="2"/></g>` : "";
  const skip = new Set(["peanut", "shrimpd", "lime", "fs1", "fs3", "fslow", "pr1", "pr3", "prraw", "sug1", "sug3", "sugw", "stevia", "msg", "seas", "kapi", "oyster", "salt", "garlic"]);
  const fruits = T.base === "fruit" ? ["🍎", "🍇", "🍍", "🍐", "🥭", "🍉", "🍇", "🍎"] : [];
  let list = [...fruits, ...toppings.filter((x) => !skip.has(x))]; if (list.length && list.length < 6) list = [...list, ...list.slice(0, 6 - list.length)]; // a fuller-looking dish
  const tops = list.slice(0, 10).map((e, i, arr) => { const src = P(e); if (!src) return ""; const a = (i / arr.length) * Math.PI * 2 + r() * 0.5, d = 0.32 + r() * 0.5, sz = 38 + r() * 14; return `<image href="${src}" x="${(150 + Math.cos(a) * d * 80 - sz / 2).toFixed(1)}" y="${(142 + Math.sin(a) * d * 50 - sz / 2).toFixed(1)}" width="${sz.toFixed(0)}" height="${sz.toFixed(0)}" transform="rotate(${Math.round((r() - 0.5) * 40)} ${(150 + Math.cos(a) * d * 80).toFixed(1)} ${(142 + Math.sin(a) * d * 50).toFixed(1)})"/>`; }).join("");
  const sticky = sides.some((x) => x.startsWith("sticky")) ? `<g transform="translate(240 200) scale(1.2)"><path d="M-30 0h60l-8 46h-44z" fill="#c9954d"/><path d="M-30 0h60l-8 46h-44z" fill="none" stroke="#8d5f28" stroke-width="2"/><path d="M-26 12h52M-24 24h48M-22 36h44" stroke="#a87634" stroke-width="2"/><path d="M-31 3c2-24 60-24 62 0z" fill="#fbfbf3" stroke="#e6e2d0"/><circle cx="-8" cy="-6" r="3" fill="#fff"/></g>` : "";
  const others = sides.filter((x) => !x.startsWith("sticky")).slice(0, 2).map((e, i) => { const src = P(e); return src ? `<g transform="translate(${54 + i * 46} ${236 - i * 6})"><ellipse cx="0" cy="8" rx="28" ry="12" fill="#f4f6fa" stroke="#2f5fa8" stroke-width="2.5"/><image href="${src}" x="-22" y="-22" width="44" height="44"/></g>` : ""; }).join("");
  return `<svg class="st-plate ${cls || ""}" viewBox="0 0 300 300" role="img" aria-label="${esc(T.n)}"><defs>
      <radialGradient id="pl${uid}" cx=".5" cy=".42" r=".6"><stop offset=".74" stop-color="#ffffff"/><stop offset=".9" stop-color="#eef1f6"/><stop offset="1" stop-color="#d4dae4"/></radialGradient>
      <radialGradient id="hp${uid}" cx=".46" cy=".38" r=".62"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".6" stop-color="${base[0]}"/><stop offset="1" stop-color="${base[2]}"/></radialGradient></defs>
    <ellipse cx="150" cy="168" rx="142" ry="116" fill="rgba(0,0,0,.25)"/><ellipse cx="150" cy="152" rx="140" ry="114" fill="url(#pl${uid})"/>
    <ellipse cx="150" cy="152" rx="131" ry="106" fill="none" stroke="#2f5fa8" stroke-width="3"/><ellipse cx="150" cy="152" rx="125" ry="101" fill="none" stroke="#2f5fa8" stroke-width="1.2" opacity=".7"/>
    <path d="M44 150C66 84 150 68 220 82c40 8 54 46 40 80-22 50-108 70-168 46-34-14-54-38-48-58z" fill="#3f8f33"/><path d="M60 150C96 102 172 90 244 116" stroke="#7fc663" stroke-width="2.5" fill="none"/><path d="M90 130l-8-18M120 116l-6-20M154 108l-2-20M188 106l4-18M220 110l8-16" stroke="#7fc663" stroke-width="1.6"/>
    <ellipse cx="150" cy="146" rx="96" ry="64" fill="url(#hp${uid})"/>${g}${gloss}${extra}${tops}${lime}${others}${sticky}</svg>`;
}
function renderMix(drop) { // mortar contents: the chosen kind's base + every picked ingredient
  const mix = $("#hkMix"); if (!mix) return; mix.innerHTML = "";
  if (!G.st?.type) return;
  const T = STT[G.st.type], baseIcon = { papaya: "🥗", cucumber: "🥒", longbean: "🫛", corn: "🌽", mango: "🥭", fruit: "🍇" }[T.base];
  [baseIcon, ...G.picks.map((p) => STI[p.id]?.e)].filter(Boolean).forEach((e, n, arr) => {
    const src = picSrc(e), el = document.createElement("span"); el.className = "hk-ing" + (drop && n === arr.length - 1 ? " drop" : "");
    el.style.left = `${12 + ((n * 37) % 70)}%`; el.style.top = `${2 + (n % 3) * 6}%`; el.style.setProperty("--r", `${(n * 47) % 50 - 25}deg`);
    el.innerHTML = src ? `<img src="${src}" alt="">` : e; mix.appendChild(el);
  });
}
const picSrc = (e) => (window.FI?.src ? window.FI.src(e) : "");
function addToMortar(e) { // the chosen ingredient drops into the mortar
  const mix = $("#hkMix"), n = mix.children.length, src = picSrc(e);
  const el = document.createElement("span"); el.className = "hk-ing drop";
  el.style.left = `${18 + ((n * 37) % 64)}%`; el.style.top = `${4 + (n % 2) * 8}%`; el.style.setProperty("--r", `${(n * 47) % 50 - 25}deg`);
  el.innerHTML = src ? `<img src="${src}" alt="">` : e; mix.appendChild(el);
}
function pestleTo(ny) { // the pestle follows the hand: hand high = pestle up, hand low = pestle in the mortar
  const el = $("#hkPestle"); if (!el || el.hidden || ny == null) return;
  G.pY = G.pY == null ? ny : G.pY + (ny - G.pY) * 0.5;
  const k = Math.max(0, Math.min(1, (G.pY - 0.28) / 0.4)); el.style.setProperty("--k", k.toFixed(3));
}
function splash() { // bits of the ingredients fly up when the pestle strikes
  const m = $("#hkMortar"); m.classList.remove("hit"); void m.offsetWidth; m.classList.add("hit");
  const items = G.picks.map((p) => picSrc(STI[p.id]?.e)).filter(Boolean); if (!items.length) return;
  const wrap = document.createElement("div"); wrap.className = "hk-splash";
  wrap.innerHTML = Array.from({ length: 6 }, (_, i) => `<img src="${items[i % items.length]}" alt="" style="--dx:${Math.round((Math.random() - 0.5) * 220)}px;--dy:${-Math.round(60 + Math.random() * 90)}px;--r:${Math.round((Math.random() - 0.5) * 360)}deg">`).join("");
  m.appendChild(wrap); setTimeout(() => wrap.remove(), 700);
}
function pop() { const t = $("#hkTray"); t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop"); }

function poundStep(ny) { // count one stroke each time the hand travels up then down by a clear distance
  const P = G.pound; if (!P || ny == null) return;
  if (P.ext == null) { P.ext = ny; return; }
  const TH = 0.1;
  if (P.dir >= 0 && ny < P.ext - TH) { P.dir = -1; P.ext = ny; }
  else if (P.dir <= 0 && ny > P.ext + TH) { if (P.dir === -1) { P.n++; window.PreDMMusic?.sfx("pok"); if (P.n % 5 === 0 && P.n < P.goal) window.PreDMVoice?.say(String(P.n)); tray(); splash(); } P.dir = 1; P.ext = ny; }
  else if ((P.dir === -1 && ny < P.ext) || (P.dir === 1 && ny > P.ext)) P.ext = ny;
  if (P.n >= P.goal) { G.busy = true; window.PreDMMusic?.sfx("win"); setTimeout(serveSomtam, 350); }
}
function plateHTML(cls) { // the finished dish: drawn plate + its name
  const tops = G.picks.map((p) => STI[p.id]).filter((x) => x && x.g !== 1 && x.g !== 3).map((x) => x.id), sides = G.picks.map((p) => STI[p.id]).filter((x) => x && x.g === 3).map((x) => x.id);
  return `<div class="hk-plate2 ${cls || ""}">${plateSVG(G.st.type, tops, sides, cls)}</div>`;
}
function serveSomtam() { // pestle out, mortar slides away, the finished plate comes in
  $("#hkPestle").hidden = true; $("#hkMortar").classList.add("gone");
  const sv = $("#hkServe"); sv.hidden = false; sv.innerHTML = `${plateHTML("big")}<b class="hk-serve-t">🥗 ${esc(STT[G.st.type].n)} เสร็จแล้ว เสิร์ฟ!</b>`;
  confetti(); window.PreDMVoice?.say("st_done");
  setTimeout(() => { sv.hidden = true; $("#hkMortar").hidden = true; somtamResult(); }, 1900);
}
function somtamResult() { // knowledge score: salt, sugar, raw food, vegetables
  const T = STT[G.st.type], items = G.picks.map((p) => STI[p.id]).filter(Boolean), t = stTotals(), tips = [], good = [];
  let pts = 6;
  const veg = items.filter((x) => x.g === 0 && x.hp >= 2).length; pts += Math.min(3, veg); if (veg >= 2) good.push(`ผัก ${veg} อย่าง`); else tips.push("เพิ่มผัก เช่น มะเขือเทศ ถั่วฝักยาว กะหล่ำปลี");
  if (t.na > 1200) { pts -= 3; tips.push(`เค็มมาก โซเดียม ${t.na} มก. (ทั้งวันไม่ควรเกิน 2,000 มก.)`); } else if (t.na > 800) { pts -= 1; tips.push(`ค่อนข้างเค็ม โซเดียม ${t.na} มก. ลดน้ำปลา/ปลาร้าลงอีกนิด`); } else good.push(`เค็มพอดี (${t.na} มก.)`);
  // judge the sugar that was ADDED (natural sugar in vegetables is fine)
  if (t.add > 10) { pts -= 3; tips.push(`หวานมาก เติมน้ำตาล ${t.add} ก. (ประมาณ ${Math.round(t.add / 4)} ช้อนชา)`); } else if (t.add > 4) { pts -= 1; tips.push(`เติมน้ำตาล ${t.add} ก. ลองใช้หญ้าหวาน หรือให้ความเปรี้ยวจากมะนาว มะเขือเทศแทน`); } else good.push(t.add ? `เติมน้ำตาลน้อย (${t.add} ก.)` : "ไม่เติมน้ำตาล");
  if (T.nut.sug >= 6) tips.push(`${T.n} มีน้ำตาลจาก${T.base === "corn" ? "ข้าวโพด" : "ผลไม้"}อยู่แล้ว กินพอประมาณ`);
  if (items.some((x) => x.id === "sideveg")) { pts += 1; good.push("มีผักแนม"); }
  items.filter((x) => x.hp < 0 && !x.raw).forEach((x) => tips.push(`${x.n}: ${x.tip}`));
  if (t.raw) { pts = Math.min(pts, 2); tips.unshift("มีของดิบ (ปลาร้าดิบ/ปูดอง/หอยดอง) เสี่ยงพยาธิใบไม้ตับ เลือกแบบต้มสุกแทนนะคะ"); }
  pts = Math.max(0, Math.min(10, pts)); const st = pts >= 8 ? 3 : pts >= 6 ? 2 : pts >= 4 ? 1 : 0;
  if (st >= 2) confetti();
  const best = Math.max(pts, window.PreDM?.store.get("somtamBest", 0) || 0); window.PreDM?.store.set("somtamBest", best);
  const bar = (label, v, max, unit) => `<div class="pl-m ${v > max ? "over" : ""}"><span>${label}</span><b>${Math.round(v)}<small>/${max} ${unit}</small></b><i><em style="width:${Math.min(100, (v / max) * 100)}%"></em></i></div>`;
  $("#hkCards").innerHTML = `<div class="hk-result st-res">${plateHTML("small")}<div class="fq-stars">${[0, 1, 2].map((k) => `<span class="${k < st ? "on" : ""}">★</span>`).join("")}</div>
    <h2>${esc(T.n)} · ${["ลองปรุงใหม่นะคะ", "ใช้ได้ค่ะ", "อร่อยและดีต่อสุขภาพ!", "สุดยอดแม่ครัวส้มตำ! 🥗"][st]}</h2>
    <p>${pts}/10 คะแนน · ตำไป ${G.pound.goal} ครั้ง 💪 · ดีที่สุด ${best}</p>
    <div class="st-bars">${bar("โซเดียม", t.na, 800, "มก.")}${bar("น้ำตาลที่เติม", t.add, 4, "ก.")}${bar("พลังงาน", t.kcal, 400, "kcal")}</div>
    ${good.length ? `<p class="ok">👍 ${good.map(esc).join(" · ")}</p>` : ""}${tips.length ? `<ul>${tips.slice(0, 5).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="hk-start-btns"><button type="button" class="btn primary" data-hk="eat">🍽️ วางลงพาข้าววันนี้</button><button type="button" class="btn" data-hk="again">ตำครกใหม่ ↺</button></div></div>`;
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
  if (M.map) { // jump straight to any shop
    $("#hkTitle").textContent = "🗺️ แผนที่ตลาด · เลือกร้าน"; say("ชี้ค้างที่ร้านที่อยากไป");
    return STALLS.map((x, i) => { const [ic, ...nm] = x.n.split(" "); const need = M.recipe.need.filter((id) => ING[id].stall === i && !M.cart.includes(id)).length; return { id: "go:" + i, e: ic, n: nm.join(" "), sub: `${x.items.length} อย่าง${need ? ` · ขาด ${need}` : ""}`, cls: need ? "need" : "", badge: need ? "📋" : "" }; });
  }
  const back = M.page > 0 || M.stall > 0, last = M.stall === STALLS.length - 1 && M.page === pages - 1;
  if (back) items.unshift({ id: "prev", e: "⬅️", n: "ย้อนกลับ" });
  items.push({ id: "map", e: "🗺️", n: "แผนที่ตลาด", sub: "ไปร้านอื่น" });
  const laterNeed = M.page < pages - 1 && st.items.slice((M.page + 1) * PER_PAGE).some(([iid]) => need.has(iid) && !M.cart.includes(iid));
  items.push(last ? { id: "pay", e: "🧾", n: "ไปจ่ายเงิน", big: true } : { id: "next", e: "➡️", n: M.page < pages - 1 ? "หน้าถัดไป" : "ร้านถัดไป", sub: laterNeed ? "มีของในรายการ" : "", cls: laterNeed ? "need" : "", badge: laterNeed ? "📋" : "" });
  if (!last && M.recipe.need.every((id) => M.cart.includes(id))) items.push({ id: "pay", e: "🧾", n: "จ่ายเงิน", big: true });
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
  if (id === "map") { M.map = true; return layout(); }
  if (id.startsWith("go:")) { // land on the first page that still has something from the list
    M.map = false; M.stall = +id.slice(3); const its = STALLS[M.stall].items, k = its.findIndex(([iid]) => M.recipe.need.includes(iid) && !M.cart.includes(iid));
    M.page = k >= 0 ? Math.floor(k / PER_PAGE) : 0; return layout();
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
  const carbs = items.filter((g) => g.stall === 5);
  if (carbs.some((g) => g.hp >= 2)) { pts += 2; good.push("เลือกข้าว/แป้งไม่ขัดสี"); } else if (carbs.some((g) => g.hp >= 0)) { pts += 1; tips.push("ลองเปลี่ยนเป็นข้าวกล้อง ข้าวเหนียวดำ หรือมันเทศ"); } else tips.push("อย่าลืมซื้อข้าว 1 อย่าง เช่น ข้าวกล้อง ข้าวเหนียวดำ");
  const extraVeg = items.filter((g) => (g.stall === 0 || g.stall === 1) && !M.recipe.need.includes(g.id)).length;
  if (extraVeg) { pts += Math.min(2, extraVeg); good.push(`ซื้อผักเพิ่ม ${extraVeg} อย่าง`); }
  if (items.some((g) => g.stall === 6 && g.hp > 0)) { pts += 1; good.push("มีผลไม้น้ำตาลต่ำ"); } else tips.push("ซื้อผลไม้น้ำตาลต่ำ เช่น ฝรั่ง ชมพู่ ไว้เป็นของหวาน");
  if (items.some((g) => ["water", "milk", "tea", "soymilk"].includes(g.id))) { pts += 1; good.push("เครื่องดื่มไม่หวาน"); }
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


/* ------------------------------------------------------------------ ร้านก๋วยเตี๋ยวแตะมือ
   Customers with a health condition order a bowl; the player picks noodle → broth → meat → vegetables → seasons it.
   Item: [id, emoji, name, kcal, carb g, sugar g, sodium mg, fat g, health points, tip] */
const ND_STEPS = [
  { k: "noodle", t: "เลือกเส้น", n: 1, items: [["small","🍜","เส้นเล็ก",200,45,0,30,1,0,"แป้ง 1 ถ้วยเล็ก"],["big","🍜","เส้นใหญ่",240,50,0,40,5,-1,"ผัดน้ำมันมาก่อน ไขมันมากกว่า"],["mee","🍜","เส้นหมี่",190,43,0,20,1,0,"เส้นบาง แป้งพอ ๆ เส้นเล็ก"],["egg","🍝","บะหมี่เหลือง",250,45,1,200,5,-1,"มีไข่และน้ำมัน โซเดียมเพิ่ม"],["glass","🍜","วุ้นเส้น",160,38,0,10,0,0,"แคลอรีน้อยกว่าเล็กน้อย แต่ยังเป็นแป้ง"],["half","🍜","เส้นเล็ก ครึ่งเดียว",100,22,0,15,1,1,"ลดแป้งครึ่งหนึ่ง เหมาะกับกลุ่มเสี่ยงเบาหวาน"],["none","🥬","เกาเหลา ไม่ใส่เส้น",0,0,0,0,0,1,"ไม่มีแป้ง แต่ควรกินข้าวหรือแป้งอย่างอื่นพอดี"]] },
  { k: "broth", t: "เลือกน้ำซุป", n: 1, items: [["clear","🍲","น้ำใส",30,2,1,700,1,1,"โซเดียมน้อยที่สุดในบรรดาน้ำซุป"],["tomyum","🍲","ต้มยำน้ำข้น",110,8,7,950,5,-2,"ใส่นมข้น น้ำตาล ถั่ว หวานและมัน"],["tomyumclear","🍲","ต้มยำน้ำใส ไม่หวาน",40,3,1,800,1,1,"เปรี้ยวเผ็ดจากมะนาวพริก ไม่ใส่น้ำตาล"],["namtok","🥘","น้ำตก",70,4,3,1100,3,-1,"โซเดียมสูง ใส่เลือดหมู"],["yentafo","🍲","เย็นตาโฟ",90,10,8,1050,2,-2,"น้ำแดงหวานและเค็ม"],["dry","🍝","แห้ง (ไม่มีน้ำ)",80,3,2,500,7,0,"โซเดียมน้อยกว่าแบบน้ำ แต่มีน้ำมันกระเทียม"]] },
  { k: "meat", t: "เลือกเนื้อสัตว์ (สูงสุด 2)", n: 2, items: [["pork","🥩","หมูชิ้นไม่ติดมัน",80,0,0,60,3,1,"โปรตีนดี ไขมันน้อย"],["minced","🥩","หมูสับ",100,0,0,70,6,0,"ไขมันปานกลาง"],["chicken","🍗","ไก่ฉีก",80,0,0,60,2,1,"โปรตีนดี ไขมันต่ำ"],["fish","🐟","ปลาลวก",70,0,0,80,1,2,"โปรตีนดีมาก ไขมันต่ำ"],["meatball","🍢","ลูกชิ้นหมู",90,4,1,400,5,-1,"อาหารแปรรูป เค็ม"],["fishball","🍥","ลูกชิ้นปลา",70,4,1,350,2,0,"เค็มเล็กน้อย"],["beef","🥩","เนื้อตุ๋น",150,1,2,250,9,-1,"ไขมันสูงขึ้น"],["offal","🥩","เครื่องในหมู",110,0,0,150,6,-1,"คอเลสเตอรอลสูง"],["crackling","🥓","กากหมู",150,0,0,150,14,-2,"ไขมันสูงมาก"],["egg2","🥚","ไข่ต้ม",75,0,0,70,5,1,"โปรตีนราคาประหยัด"],["tofu","🧈","เต้าหู้",60,1,0,10,3,1,"โปรตีนจากพืช"]] },
  { k: "veg", t: "เลือกผัก (เลือกได้หลายอย่าง)", n: 4, items: [["sprout","🌱","ถั่วงอก",10,2,1,5,0,1,"ใยอาหาร กรอบอร่อย"],["mg","🌿","ผักบุ้ง",10,2,0,30,0,1,"ผักใบเขียว"],["kale","🥬","คะน้า ผักกาด",10,2,0,20,0,1,"ใยอาหารและแคลเซียม"],["spring","🌱","ต้นหอม ผักชี",3,0,0,2,0,0,"หอม แต่ปริมาณน้อย"],["ivy","🍃","ตำลึง",10,1,0,5,0,1,"ผักพื้นบ้าน วิตามินสูง"],["double","🥦","ผักเพิ่มสองเท่า",25,5,1,20,0,2,"ผักครึ่งชาม ช่วยให้น้ำตาลขึ้นช้า"]] },
  { k: "season", t: "ปรุงเอง! (เลือกได้หลายอย่าง)", n: 8, items: [["sug1","🍯","น้ำตาล 1 ช้อน",16,4,4,0,0,-1,"น้ำตาล 1 ช้อนชา = 4 กรัม"],["sug2","🍯","น้ำตาล 2 ช้อน",32,8,8,0,0,-2,"8 กรัม เกือบครึ่งของที่ควรได้ทั้งวัน"],["sug3","🍯","น้ำตาล 3 ช้อน",48,12,12,0,0,-3,"12 กรัม น้ำตาลในเลือดพุ่ง"],["fs1","🫙","น้ำปลา 1 ช้อน",3,0,0,450,0,-1,"1 ช้อนชา ≈ 450 มก. โซเดียม"],["fs2","🫙","น้ำปลา 2 ช้อน",6,0,0,900,0,-2,"รวมกับน้ำซุปแล้วเค็มเกิน"],["chilip","🌶️","พริกป่น",5,1,0,5,0,0,"เผ็ดได้ ไม่เพิ่มเค็ม"],["vinegar","🫙","น้ำส้มพริกดอง",3,0,0,50,0,1,"เปรี้ยวช่วยลดความอยากเค็ม"],["lime","🍋","มะนาว",4,1,1,1,0,1,"เปรี้ยวแทนเค็ม"],["msg","🧂","ผงชูรส",0,0,0,160,0,-1,"เพิ่มโซเดียม ไม่จำเป็น"],["peanut","🥜","ถั่วลิสงป่น",50,2,0,5,4,0,"ไขมันดี แต่แคลอรีเพิ่ม"],["garlicoil","🧄","กระเทียมเจียว",45,1,0,5,5,-1,"น้ำมันเพิ่มไขมัน"]] },
].map((st) => ({ ...st, items: st.items.map(([id, e, n, kcal, carb, sug, na, fat, hp, tip]) => ({ id, e, n, kcal, carb, sug, na, fat, hp, tip })) }));
const ND_CUST = [ // [name, avatar, condition, what they ask, limits]
  ["ป้าแดง", "👵", "เป็นเบาหวาน", "ไม่หวานนะ เส้นไม่ต้องเยอะ", { sug: 2, carb: 35 }], ["ลุงสม", "👴", "ความดันโลหิตสูง", "ช่วยลดเค็มให้ลุงหน่อย", { na: 1000 }],
  ["น้องเมย์", "👧", "กำลังลดน้ำหนัก", "ขออิ่มแต่ไม่อ้วนนะคะ", { kcal: 380 }], ["พี่ต้น", "🧑", "กลุ่มเสี่ยงเบาหวาน ชอบต้มยำ", "อยากกินต้มยำแต่ไม่อยากหวาน", { sug: 3, carb: 45 }],
  ["ยายบุญ", "👵", "ไตเสื่อม ต้องจำกัดเค็ม", "เค็มน้อย ๆ นะหลาน", { na: 900 }], ["ครูนิด", "👩", "ไขมันในเลือดสูง", "ไม่เอามัน ๆ นะคะ", { fat: 10 }],
  ["ตาเพิ่ม", "👴", "เบาหวาน + ความดัน", "ไม่หวาน ไม่เค็ม แต่อร่อยนะ", { sug: 2, na: 1100, carb: 35 }], ["พี่แบงค์", "🧔", "สุขภาพดี ออกกำลังกาย", "ขอโปรตีนเยอะ ๆ", { pro: 2 }],
].map(([n, av, cond, ask, lim]) => ({ n, av, cond, ask, lim }));
const ND_ROUND = 3;
function ndNew() { const order = shuffle(ND_CUST).slice(0, ND_ROUND); G.nd = { order, ci: 0, step: 0, picks: {}, coins: 0, results: [] }; }
const ndCur = () => G.nd.order[G.nd.ci];
function ndPicked(k) { return G.nd.picks[k] || []; }
function ndTotals() {
  const t = { kcal: 0, carb: 0, sug: 0, na: 0, fat: 0, pro: 0, veg: 0 };
  ND_STEPS.forEach((st) => ndPicked(st.k).forEach((id) => { const x = st.items.find((i) => i.id === id); ["kcal", "carb", "sug", "na", "fat"].forEach((f) => (t[f] += x[f])); if (st.k === "meat" && x.hp >= 0) t.pro++; if (st.k === "veg") t.veg += x.id === "double" ? 2 : 1; }));
  return t;
}
function noodleItems() {
  const N = G.nd, c = ndCur();
  if (N.done) return [];
  const st = ND_STEPS[N.step], have = ndPicked(st.k);
  $("#hkTitle").textContent = `🍜 ร้านก๋วยเตี๋ยว · ลูกค้า ${N.ci + 1}/${ND_ROUND} · ${st.t}`;
  say(`${c.av} ${c.n} (${c.cond}): “${c.ask}”`);
  if (G.spoke !== "nd" + N.ci + N.step) { G.spoke = "nd" + N.ci + N.step; if (N.step === 0) window.PreDMVoice?.say(N.ci === 0 ? "nd_open" : "nd_next"); }
  const items = st.items.map((x) => { const inn = have.includes(x.id); return { id: "n:" + x.id, e: x.e, n: x.n, sub: inn ? "✓ ใส่แล้ว (แตะเพื่อเอาออก)" : x.tip.length > 24 ? x.tip.slice(0, 23) + "…" : x.tip, cls: inn ? "in" : "", badge: inn ? "✓" : "" }; });
  if (st.n > 1 && N.step < ND_STEPS.length - 1) items.push({ id: "ndnext", e: "➡️", n: "ขั้นต่อไป", sub: have.length ? `เลือกแล้ว ${have.length}` : "ข้ามได้" });
  if (N.step === ND_STEPS.length - 1) items.push({ id: "ndserve", e: "🛎️", n: "เสิร์ฟ!", big: true });
  if (N.step > 0) items.unshift({ id: "ndback", e: "⬅️", n: "ย้อนกลับ" });
  return items;
}
function noodleChoose(id, el) {
  const N = G.nd;
  if (id === "ndback") { N.step--; ndBowl(); return layout(); }
  if (id === "ndnext") { N.step++; return layout(); }
  if (id === "ndserve") return ndServe();
  if (id === "ndagain") { ndNew(); ndBowl(); return layout(); }
  if (!id.startsWith("n:")) return;
  const st = ND_STEPS[N.step], x = id.slice(2), arr = (N.picks[st.k] = N.picks[st.k] || []), k = arr.indexOf(x);
  if (k >= 0) arr.splice(k, 1);
  else if (st.n === 1) { arr.length = 0; arr.push(x); }
  else if (arr.length < st.n) arr.push(x); else { say(`เลือกได้สูงสุด ${st.n} อย่าง`); return; }
  const item = st.items.find((i) => i.id === x);
  if (k < 0 && el) fx(el, item.hp < 0 ? "ระวัง!" : item.hp > 0 ? "ดีต่อสุขภาพ" : "✓", item.hp < 0 ? "bad" : "good");
  ndBowl(st.k === "season" && k < 0 ? item : null);
  if (st.n === 1 && k < 0) { N.step++; } // single-choice steps move on by themselves
  layout();
}
// the bowl at the bottom of the screen updates as the order is built
function ndBowl(seasoning) {
  const el = $("#hkBowl"); if (!el) return;
  if (G.mode !== "noodle") { el.hidden = true; return; } el.hidden = false;
  el.innerHTML = bowlSVG(ndPicked("noodle")[0], ndPicked("broth")[0], ndPicked("meat"), ndPicked("veg"), "live");
  if (seasoning) { const sp = document.createElement("div"); sp.className = "hk-sprinkle"; const src = picSrc(seasoning.e); sp.innerHTML = Array.from({ length: 5 }, (_, i) => `<img src="${src}" alt="" style="--dx:${(i - 2) * 26}px;--d:${i * 60}ms">`).join(""); el.appendChild(sp); setTimeout(() => sp.remove(), 900); }
}
function bowlSVG(noodle, broth, meats, vegs, cls) {
  const r = rng((noodle || "") + (broth || "") + meats.join() + vegs.join());
  const soup = { clear: ["#f3e2b0", .85], tomyum: ["#e9883f", .9], tomyumclear: ["#f2b25c", .8], namtok: ["#6e3b22", .92], yentafo: ["#e86a8a", .9], dry: ["#00000000", 0] }[broth] || ["#f6efe0", .5];
  const nd = { small: ["#fbf6e8", 2.4], big: ["#fffaf0", 7], mee: ["#ffffff", 1.4], egg: ["#f6d36b", 3], glass: ["#e9f3f6", 1.8], half: ["#fbf6e8", 2.4] }[noodle];
  let strands = "";
  if (nd) { const n = noodle === "half" ? 18 : 34; for (let i = 0; i < n; i++) { const x = 70 + r() * 160, y = 112 + r() * 44, w = 40 + r() * 50; strands += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q${(w / 2).toFixed(0)} ${(-14 + r() * 28).toFixed(0)} ${w.toFixed(0)} ${(-6 + r() * 12).toFixed(0)}" stroke="${nd[0]}" stroke-width="${nd[1]}" fill="none" stroke-linecap="round" opacity=".95"/>`; } }
  const PIC = (step, id) => picSrc(ND_STEPS.find((s) => s.k === step).items.find((i) => i.id === id)?.e);
  const tops = [...meats.map((m) => PIC("meat", m)), ...vegs.map((v) => PIC("veg", v))].filter(Boolean).slice(0, 8).map((src, i, a) => { const ang = (i / a.length) * Math.PI * 2 + r(), d = 0.3 + r() * 0.55, sz = 52 + r() * 12; return `<image href="${src}" x="${(150 + Math.cos(ang) * d * 88 - sz / 2).toFixed(0)}" y="${(124 + Math.sin(ang) * d * 26 - sz / 2).toFixed(0)}" width="${sz.toFixed(0)}" height="${sz.toFixed(0)}"/>`; }).join("");
  return `<svg class="nd-bowl ${cls || ""}" viewBox="0 0 300 230" role="img" aria-label="ชามก๋วยเตี๋ยว"><defs><linearGradient id="ndb${cls}" x1="0" x2="1"><stop offset="0" stop-color="#d7dde6"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#c8cfda"/></linearGradient></defs>
    <ellipse cx="150" cy="214" rx="96" ry="12" fill="rgba(0,0,0,.25)"/><path d="M20 120c0 60 58 96 130 96s130-36 130-96z" fill="url(#ndb${cls})" stroke="#b8c0cc" stroke-width="2"/>
    <path d="M40 150c30 34 70 46 110 46s80-12 110-46" stroke="#e05a4a" stroke-width="6" fill="none" opacity=".75"/><path d="M60 170h180" stroke="#e05a4a" stroke-width="3" stroke-dasharray="10 8" opacity=".6"/>
    <ellipse cx="150" cy="120" rx="130" ry="36" fill="#f7f9fc" stroke="#c9d0dc" stroke-width="3"/><ellipse cx="150" cy="122" rx="116" ry="29" fill="${soup[0]}" opacity="${soup[1]}"/>
    ${strands}${tops}<path d="M236 60l40-52" stroke="#c48a4a" stroke-width="7" stroke-linecap="round"/><path d="M226 56l36-50" stroke="#d9a066" stroke-width="7" stroke-linecap="round"/></svg>`;
}
function ndServe() { // judge the bowl against this customer's needs
  const N = G.nd, c = ndCur(), t = ndTotals(), good = [], tips = [];
  if (!ndPicked("noodle").length || !ndPicked("broth").length) { say("ยังไม่ได้เลือกเส้นหรือน้ำซุปค่ะ"); N.step = ndPicked("noodle").length ? 1 : 0; return layout(); }
  let pts = 5; const L = c.lim;
  if (L.sug != null) { if (t.sug <= L.sug) { pts += 2; good.push(`หวานน้อย (${t.sug} ก.)`); } else { pts -= 2; tips.push(`ลูกค้า${c.cond} แต่ชามนี้มีน้ำตาล ${t.sug} ก. (${Math.round(t.sug / 4)} ช้อนชา)`); } }
  if (L.carb != null) { if (t.carb <= L.carb) { pts += 1; good.push("แป้งพอดี"); } else { pts -= 1; tips.push(`แป้ง ${t.carb} ก. มากไปสำหรับ${c.cond} ลองสั่งเส้นครึ่งเดียวหรือเกาเหลา`); } }
  if (L.na != null) { if (t.na <= L.na) { pts += 2; good.push(`เค็มพอดี (${t.na} มก.)`); } else { pts -= 2; tips.push(`โซเดียม ${t.na} มก. เกินที่${c.n}ควรได้ (${L.na} มก.) เลือกน้ำใสและไม่เติมน้ำปลา`); } }
  if (L.kcal != null) { if (t.kcal <= L.kcal) { pts += 2; good.push(`${t.kcal} kcal ไม่อ้วน`); } else { pts -= 2; tips.push(`${t.kcal} kcal มากไปสำหรับคนลดน้ำหนัก`); } }
  if (L.fat != null) { if (t.fat <= L.fat) { pts += 2; good.push(`ไขมันต่ำ (${t.fat} ก.)`); } else { pts -= 2; tips.push(`ไขมัน ${t.fat} ก. มากไป หลีกเลี่ยงกากหมู กระเทียมเจียว เส้นใหญ่`); } }
  if (L.pro != null) { if (t.pro >= L.pro) { pts += 2; good.push("โปรตีนจัดเต็ม"); } else { pts -= 1; tips.push("ลูกค้าอยากได้โปรตีนมากขึ้น เพิ่มไก่ ปลา ไข่ หรือเต้าหู้"); } }
  if (t.veg >= 2) { pts += 1; good.push("ผักเยอะ"); } else tips.push("เพิ่มผักให้มากขึ้น เช่น ถั่วงอก ผักบุ้ง ผักเพิ่มสองเท่า");
  if (t.na > 1500) tips.push("น้ำซุปก๋วยเตี๋ยวเค็มมาก ไม่ควรซดน้ำจนหมดชาม");
  pts = Math.max(0, Math.min(10, pts)); const happy = pts >= 7, coins = happy ? 40 + pts * 2 : pts >= 5 ? 20 : 5;
  N.coins += coins; N.results.push({ c, pts, happy });
  window.PreDMMusic?.sfx(happy ? "win" : "bad"); window.PreDMVoice?.say(happy ? "nd_happy" : "nd_sad"); if (happy) confetti();
  const bowl = bowlSVG(ndPicked("noodle")[0], ndPicked("broth")[0], ndPicked("meat"), ndPicked("veg"), "res");
  $("#hkBowl").hidden = true; G.cards = [];
  const last = N.ci >= ND_ROUND - 1;
  $("#hkCards").innerHTML = `<div class="hk-result nd-res"><div class="nd-res-top"><span class="nd-av">${c.av}</span>${bowl}</div>
    <h2>${happy ? `${c.n} ชอบมาก! 😋` : pts >= 5 ? `${c.n} พอใจนิดหน่อย 🙂` : `${c.n} ไม่ค่อยพอใจ 😕`}</h2>
    <p>${pts}/10 คะแนน · ได้ทิป 💰 ${coins} บาท · รวม ${N.coins} บาท</p>
    <div class="st-bars"><div class="pl-m"><span>น้ำตาล</span><b>${t.sug}<small> ก.</small></b></div><div class="pl-m"><span>โซเดียม</span><b>${t.na}<small> มก.</small></b></div><div class="pl-m"><span>พลังงาน</span><b>${t.kcal}<small> kcal</small></b></div><div class="pl-m"><span>ไขมัน</span><b>${t.fat}<small> ก.</small></b></div></div>
    ${good.length ? `<p class="ok">👍 ${good.map(esc).join(" · ")}</p>` : ""}${tips.length ? `<ul>${tips.slice(0, 4).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="hk-start-btns">${last ? `<button type="button" class="btn primary" data-hk="ndsum">🏁 ปิดร้าน ดูสรุป</button>` : `<button type="button" class="btn primary" data-hk="ndnextc">ลูกค้าคนต่อไป ›</button>`}</div></div>`;
}
function ndSummary() {
  const N = G.nd, happy = N.results.filter((x) => x.happy).length, avg = Math.round(N.results.reduce((a, x) => a + x.pts, 0) / N.results.length);
  const best = Math.max(N.coins, window.PreDM?.store.get("noodleBest", 0) || 0); window.PreDM?.store.set("noodleBest", best);
  const st = happy === ND_ROUND ? 3 : happy >= 2 ? 2 : happy >= 1 ? 1 : 0; if (st >= 2) confetti();
  $("#hkCards").innerHTML = `<div class="hk-result"><span class="hk-rmasc">${window.PreDMMascot ? PreDMMascot.svg() : "💗"}</span><div class="fq-stars">${[0, 1, 2].map((k) => `<span class="${k < st ? "on" : ""}">★</span>`).join("")}</div>
    <h2>${["ลองเปิดร้านใหม่นะคะ", "พอไปได้ค่ะ", "ร้านดีมาก ลูกค้าชอบ!", "เจ้าของร้านก๋วยเตี๋ยวสุขภาพ! 🍜"][st]}</h2>
    <p>ลูกค้าพอใจ ${happy}/${ND_ROUND} คน · คะแนนเฉลี่ย ${avg}/10 · ทิปรวม 💰 ${N.coins} บาท · สถิติ ${best} บาท</p>
    <ul>${N.results.map((x) => `<li>${x.c.av} ${esc(x.c.n)} (${esc(x.c.cond)}) · ${x.pts}/10 ${x.happy ? "😋" : "😕"}</li>`).join("")}</ul>
    <p class="ok">💡 จำไว้: น้ำตาล 1 ช้อนชา = 4 กรัม · น้ำปลา 1 ช้อนชา ≈ 450 มก. โซเดียม · ทั้งวันไม่ควรเกิน 2,000 มก. · ไม่ซดน้ำซุปจนหมด</p>
    <div class="hk-start-btns"><button type="button" class="btn primary" data-hk="ndagain">เปิดร้านอีกรอบ ↺</button><button type="button" class="btn" data-hkmode="market">ไปจ่ายตลาด</button></div></div>`;
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
/* ---------- pointers: each hand (and the mouse) has its own cursor, smoothing and dwell timer; either hand can pick ---------- */
const PTR = {}; // key "L" | "R" | "m" -> { sm, hover, acc, slip, lock, seen }
const ptr = (k) => (PTR[k] = PTR[k] || { sm: null, hover: null, acc: 0, slip: 0, lock: false });
function lockAll() { Object.values(PTR).forEach((q) => { q.lock = true; q.hover?.classList.remove("hot"); q.hover = null; q.acc = 0; }); }
function stepPointer(q, p, dt, now, cur) {
  const st = $("#hkStage");
  cur.hidden = !p; if (p) cur.style.transform = `translate(${p.x}px,${p.y}px)`;
  let hit = null, paused = false;
  if (p && !G.pound && !G.busy) {
    const sr = st.getBoundingClientRect();
    const inside = (c, pad) => { const r = c.getBoundingClientRect(); return p.x >= r.left - sr.left - pad && p.x <= r.right - sr.left + pad && p.y >= r.top - sr.top - pad && p.y <= r.bottom - sr.top + pad; };
    if (q.hover && q.hover.isConnected && inside(q.hover, 44)) hit = q.hover;
    else { let best = null, bd = 1e9; for (const c of G.cards) if (inside(c, 16)) { const r = c.getBoundingClientRect(), d = Math.hypot(p.x - (r.left + r.width / 2 - sr.left), p.y - (r.top + r.height / 2 - sr.top)); if (d < bd) { bd = d; best = c; } } hit = best; }
  }
  if (q.lock) { if (hit) hit = null; else if (p) q.lock = false; }
  if (!hit && q.hover && q.hover.isConnected && !q.lock && !G.busy && !G.pound) { q.slip = q.slip || now; if (now - q.slip < 450) { hit = q.hover; paused = true; } } else q.slip = 0;
  if (hit !== q.hover) { q.hover?.classList.remove("hot"); q.hover?.style.setProperty("--p", 0); q.hover = hit; q.acc = 0; if (hit) { hit.classList.add("hot"); window.PreDMMusic?.sfx("hover"); } }
  if (hit) {
    if (!paused) q.acc += dt;
    const k = Math.min(1, q.acc / DWELL); hit.style.setProperty("--p", k); cur.style.setProperty("--p", k);
    if (k >= 1) { const id = hit.dataset.id; hit.classList.remove("hot"); lockAll(); window.PreDMMusic?.sfx("pick"); choose(id, hit); }
  } else cur.style.setProperty("--p", 0);
}
function loop() {
  cancelAnimationFrame(G.raf);
  const v = $("#hkVideo"), cv = $("#hkCanvas"), st = $("#hkStage"), curs = [$("#hkCursor"), $("#hkCursor2")];
  let lastT = -1;
  const frame = () => {
    G.raf = requestAnimationFrame(frame);
    const W = st.clientWidth, H = st.clientHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, W, H);
    const now = performance.now(), dt = Math.min(300, now - (G.lastF || now)); G.lastF = now;
    let ny = null; const raws = []; // [{key, p}]
    if (G.cam) {
      if (landmarker && v.readyState >= 2 && v.currentTime !== lastT) {
        lastT = v.currentTime;
        const res = landmarker.detectForVideo(v, now), all = res.landmarks || [], hd = res.handedness || res.handednesses || [];
        if (all.length) {
          const vw = v.videoWidth, vh = v.videoHeight, s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
          // the camera picture is mirrored on screen, so MediaPipe's "Left" is the player's right hand
          G.hands = all.map((lm, i) => ({ key: hd[i]?.[0]?.categoryName === "Left" ? "R" : "L", pts: lm.map((q) => ({ x: ox + (1 - q.x) * dw, y: oy + q.y * dh })), ny: lm[9].y }));
          if (G.hands.length === 2 && G.hands[0].key === G.hands[1].key) G.hands[1].key = G.hands[0].key === "L" ? "R" : "L";
          G.seenAt = now; ny = Math.min(...G.hands.map((h) => h.ny)); // pounding: the higher hand leads
        } else if (now - (G.seenAt || 0) > 400) G.hands = null; // keep the last hands for a moment when tracking flickers
      }
      (G.hands || []).forEach((h) => { drawHand(ctx, h.pts); raws.push({ key: h.key, p: h.pts[8] }); });
    } else if (G.ptr) { raws.push({ key: "m", p: G.ptr }); ny = G.ptr.ny; }
    if (G.pound && G.cam && !G.busy && ny != null) { pestleTo(ny); poundStep(ny); }
    // smooth each fingertip so small shakes do not move its pointer off a card
    const A = G.cam ? 0.3 : 1, live = new Set(raws.map((r) => r.key));
    Object.entries(PTR).forEach(([k, q]) => { if (!live.has(k)) { q.sm = null; } });
    let ci = 0;
    raws.slice(0, 2).forEach(({ key, p: raw }) => { const q = ptr(key); q.sm = q.sm ? { x: q.sm.x + (raw.x - q.sm.x) * A, y: q.sm.y + (raw.y - q.sm.y) * A } : { x: raw.x, y: raw.y }; stepPointer(q, q.sm, dt, now, curs[ci++]); });
    // pointers that vanished still get their grace period; hide unused cursors
    Object.entries(PTR).forEach(([k, q]) => { if (!live.has(k) && q.hover) stepPointer(q, null, dt, now, curs[Math.min(ci, 1)]); });
    for (; ci < 2; ci++) curs[ci].hidden = true;
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
    if (a === "ndnextc") { G.nd.ci++; G.nd.step = 0; G.nd.picks = {}; ndBowl(); return layout(); }
    if (a === "ndsum") return ndSummary();
    if (a === "ndagain") { ndNew(); ndBowl(); return layout(); }
    if (a === "eat") { // log the som tam on today's tray, in the meal that fits the time of day
      const hr = new Date().getHours(), meal = hr < 10 ? "b" : hr < 15 ? "l" : hr < 21 ? "d" : "s";
      if (window.PreDMFood?.add) {
        const T = STT[G.st?.type] || STT.thai; window.PreDMFood.add(T.key, 1, meal);
        G.picks.forEach((p) => { const m = ST_LOG[p.id]; if (m) window.PreDMFood.add(m[0], m[1], meal); }); // sides go on the tray too
        window.PreDM?.toast(`วาง${T.n}ลงพาข้าววันนี้แล้ว`);
      }
      close(); if (location.hash !== "#food") location.hash = "food"; return;
    }
    if (a === "cook") { const r = G.mk.recipe; if (r && window.PreDMFood?.add && window.PreDMFood.DB.some((d) => d.key === r.key)) { window.PreDMFood.add(r.key, 1, "d"); window.PreDM?.toast(`วาง “${r.n}” ลงพาข้าวมื้อเย็นวันนี้แล้ว`); } close(); if (location.hash !== "#food") location.hash = "food"; return; }
  }
  const c = t(".hk-card"); if (c && !G.cam) { window.PreDMMusic?.sfx("pick"); lockAll(); choose(c.dataset.id, c); } // tap also works without camera
}

document.addEventListener("click", (e) => { const g = e.target.closest("[data-handgame]"); if (!g) return; e.preventDefault(); open(["somtam", "market", "noodle"].includes(g.dataset.handgame) ? g.dataset.handgame : "plate"); });
window.PreDMHandKitchen = { open, close };
