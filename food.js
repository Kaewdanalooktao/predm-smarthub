/* Pre-DM Smart Hub — Isan food log ("กินเป็น เห็นเสี่ยง").
   Local Isan menu database (approximate values per typical serving) + optional Gemini photo recognition.
   Values are estimates for a prototype; validate with the INMU Thai Food Composition Table / a dietitian before clinical use. */
(function () {
  "use strict";
  const A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const thDate = (s, o = { weekday: "short", day: "numeric", month: "short" }) => new Date(s + "T00:00:00").toLocaleDateString("th-TH", o);
  const r0 = (n) => Math.round(n);

  /* ---------- Isan menu database: [key, name, emoji, category, unit, kcal, carb, protein, fat, sugar, sodium(mg), fiber, flags, tip] ----------
     flags: raw = เมนูดิบ (เสี่ยงพยาธิใบไม้ตับ), salt = โซเดียมสูง, sweet = น้ำตาลสูง, fat = ไขมันสูง, veg = ผักเด่น, rice = ข้าว/แป้ง */
  const DB_ROWS = [
    ["sticky", "ข้าวเหนียวนึ่ง", "🍙", "ข้าว-แป้ง", "1 ปั้น (ขนาดกำปั้น ~70 ก.)", 160, 34, 3, 0.3, 0, 2, 0.6, "rice", "ลดเหลือครึ่งปั้นต่อมื้อ หรือสลับเป็นข้าวเหนียวดำ/ข้าวกล้อง ปั้นแล้วจิ้มกับข้าวมากกว่าน้ำจิ้ม"],
    ["sticky-b", "ข้าวเหนียวดำ / ข้าวก่ำ", "🍙", "ข้าว-แป้ง", "1 ปั้น (~70 ก.)", 155, 32, 3.5, 0.8, 0, 2, 2, "rice", "ใยอาหารมากกว่าข้าวเหนียวขาว แต่ยังนับเป็นข้าว ควบคุมไม่เกิน 1 ปั้นต่อมื้อ"],
    ["rice", "ข้าวสวย", "🍚", "ข้าว-แป้ง", "1 ทัพพี (~55 ก.)", 80, 18, 1.5, 0.2, 0, 1, 0.3, "rice", "มื้อละ 2–3 ทัพพี เปลี่ยนเป็นข้าวกล้องเพื่อเพิ่มใยอาหาร"],
    ["rice-br", "ข้าวกล้อง", "🍚", "ข้าว-แป้ง", "1 ทัพพี (~55 ก.)", 80, 17, 1.8, 0.6, 0, 1, 1.2, "rice", "ตัวเลือกดีสำหรับกลุ่มเสี่ยงเบาหวาน ย่อยช้า น้ำตาลขึ้นช้ากว่า"],
    ["khanomjeen", "ข้าวปุ้น (ขนมจีน)", "🍜", "ข้าว-แป้ง", "1 จับ (~100 ก.)", 120, 27, 2, 0.3, 0, 20, 0.5, "rice", "นับเป็นข้าวแป้ง กินคู่กับผักแนมเยอะ ๆ"],
    ["somtam-thai", "ส้มตำไทย", "🥗", "ตำ", "1 จาน", 120, 20, 3, 3, 12, 1000, 3, "sweet salt veg", "สั่ง “ไม่ใส่น้ำตาล/หวานน้อย” ลดน้ำปลา และกินกับผักสดเพิ่ม"],
    ["somtam-pla", "ตำลาว (ส้มตำปูปลาร้า)", "🥗", "ตำ", "1 จาน", 110, 15, 4, 2.5, 5, 1500, 3, "salt veg", "ปลาร้าโซเดียมสูงมาก ขอปลาร้าน้อย ไม่ซดน้ำตำ เพิ่มผักแนม"],
    ["tam-sua", "ตำซั่ว (ตำใส่ขนมจีน)", "🥗", "ตำ", "1 จาน", 260, 48, 5, 3, 8, 1500, 3, "salt rice", "มีขนมจีนอยู่แล้ว ไม่ต้องกินข้าวเหนียวเพิ่ม"],
    ["tam-tang", "ตำแตง / ตำถั่ว", "🥒", "ตำ", "1 จาน", 90, 14, 3, 2, 6, 1100, 3, "salt veg", "ผักเป็นหลัก ดีกว่าตำมะละกอ ขอหวานน้อย"],
    ["tam-pon", "ตำป่า / ตำซั่วรวมมิตร", "🥗", "ตำ", "1 จาน", 240, 28, 14, 7, 6, 1800, 3, "salt", "มีหอยดอง/ปูดอง โซเดียมสูง เลือกตำปกติแทนบ่อย ๆ"],
    ["larb-moo", "ลาบหมู (สุก)", "🥩", "ลาบ-ก้อย", "1 จาน (~150 ก.)", 180, 6, 20, 8, 1, 900, 1, "salt", "ขอข้าวคั่วน้อย น้ำปลาน้อย กินกับผักสดเยอะ ๆ"],
    ["larb-gai", "ลาบไก่ (สุก)", "🍗", "ลาบ-ก้อย", "1 จาน (~150 ก.)", 150, 6, 22, 4, 1, 850, 1, "salt", "โปรตีนดี ไขมันต่ำ ทางเลือกที่ดีของลาบ"],
    ["larb-pla", "ลาบปลาดุก/ลาบปลา (สุก)", "🐟", "ลาบ-ก้อย", "1 จาน", 170, 7, 20, 7, 1, 850, 1, "salt", "เลือกปลาย่าง/ต้มสุก แทนปลาดุกฟูทอด"],
    ["larb-duck", "ลาบเป็ด", "🦆", "ลาบ-ก้อย", "1 จาน", 220, 6, 19, 13, 1, 900, 1, "salt fat", "หนังเป็ดไขมันสูง เลือกเนื้อไม่ติดหนัง"],
    ["koi-pla", "ก้อยปลา (ปลาดิบ)", "🐟", "ลาบ-ก้อย", "1 จาน", 140, 5, 20, 4, 1, 850, 1, "raw salt", "⚠️ ปลาน้ำจืดดิบเสี่ยงพยาธิใบไม้ตับและมะเร็งท่อน้ำดี เปลี่ยนเป็นลาบปลาสุกแทน"],
    ["larb-dib", "ลาบดิบ / ซกเล็ก", "🥩", "ลาบ-ก้อย", "1 จาน", 200, 4, 20, 11, 0, 950, 0.5, "raw salt fat", "⚠️ เนื้อดิบเสี่ยงพยาธิและแบคทีเรีย กินลาบสุกแทน"],
    ["koi-goong", "ก้อยกุ้ง (กุ้งเต้น)", "🦐", "ลาบ-ก้อย", "1 จาน", 110, 5, 16, 2, 1, 900, 1, "raw salt", "⚠️ กุ้งดิบเสี่ยงพยาธิ ลวกให้สุกก่อนปรุง"],
    ["koi-kaimodaeng", "ก้อยไข่มดแดง", "🐜", "ลาบ-ก้อย", "1 จาน", 150, 4, 13, 9, 1, 800, 1, "salt", "โปรตีนดี ปรุงรสอ่อน"],
    ["namtok", "น้ำตกหมู", "🥩", "ลาบ-ก้อย", "1 จาน", 230, 6, 21, 13, 1, 950, 1, "salt fat", "เลือกเนื้อสันแทนคอหมู ลดไขมัน"],
    ["tubwan", "ตับหวาน", "🫀", "ลาบ-ก้อย", "1 จาน", 160, 6, 19, 6, 1, 850, 1, "salt", "ตับคอเลสเตอรอลสูง กินไม่บ่อย และต้องลวกสุก"],
    ["gai-yang", "ไก่ย่าง (ไม่ติดหนัง)", "🍗", "ปิ้ง-ย่าง", "1 น่อง/สะโพก (~100 ก.)", 200, 1, 26, 10, 1, 500, 0, "", "ลอกหนังออกลดไขมันได้มาก จิ้มแจ่วน้อย ๆ"],
    ["gai-yang-skin", "ไก่ย่าง (ติดหนัง)", "🍗", "ปิ้ง-ย่าง", "1 น่อง/สะโพก (~100 ก.)", 260, 1, 24, 18, 1, 550, 0, "fat", "หนังไก่ไขมันสูง ลองลอกหนังออก"],
    ["kor-moo", "คอหมูย่าง", "🥓", "ปิ้ง-ย่าง", "1 จาน (~100 ก.)", 330, 2, 17, 28, 2, 600, 0, "fat", "ไขมันสูงมาก เปลี่ยนเป็นหมูสันย่าง/ไก่ย่าง/ปลาเผา"],
    ["suea-rong", "เสือร้องไห้", "🥩", "ปิ้ง-ย่าง", "1 จาน (~100 ก.)", 290, 2, 20, 22, 2, 650, 0, "fat", "เลือกส่วนไม่ติดมัน กินกับผักเยอะ ๆ"],
    ["pla-pao", "ปลานิลเผาเกลือ", "🐟", "ปิ้ง-ย่าง", "1/4 ตัว (~120 ก.)", 170, 0, 31, 4, 0, 400, 0, "", "โปรตีนดี ไขมันต่ำ ไม่กินหนังที่มีเกลือ"],
    ["sai-krok", "ไส้กรอกอีสาน", "🌭", "ปิ้ง-ย่าง", "5 ลูก (~100 ก.)", 300, 10, 13, 23, 3, 900, 0, "fat salt", "ไขมันและโซเดียมสูง จำกัด 2–3 ลูก กินคู่กะหล่ำ/ขิง"],
    ["moo-ping", "หมูปิ้ง", "🍢", "ปิ้ง-ย่าง", "2 ไม้", 220, 10, 14, 14, 8, 550, 0, "sweet fat", "หมักหวาน เลือกส่วนไม่ติดมัน 1–2 ไม้"],
    ["jingreed", "จิ้งหรีด/แมลงทอด", "🦗", "ปิ้ง-ย่าง", "1 ถ้วยเล็ก (~30 ก.)", 150, 2, 15, 9, 0, 300, 2, "fat", "โปรตีนสูง แต่ทอด เลือกคั่วแทนทอด"],
    ["moo-kratha", "หมูกระทะ / จิ้มจุ่ม", "🍲", "ปิ้ง-ย่าง", "1 คน/มื้อ", 750, 40, 40, 45, 10, 2200, 3, "fat salt", "เลือกเนื้อไม่ติดมัน เพิ่มผัก ลดน้ำจิ้ม ไม่ซดน้ำซุป"],
    ["soop-normai", "ซุปหน่อไม้", "🎋", "แกง-ต้ม", "1 ถ้วย", 90, 10, 5, 3, 1, 900, 4, "salt veg", "ใยอาหารดี ลดน้ำปลาร้า"],
    ["gaeng-om", "แกงอ่อม", "🥘", "แกง-ต้ม", "1 ถ้วย", 150, 8, 14, 7, 1, 1000, 3, "salt veg", "ผักเยอะ ดี! ลดปลาร้า เลือกไก่/ปลาแทนเครื่องในวัว"],
    ["tom-saeb", "ต้มแซ่บกระดูกอ่อน", "🍲", "แกง-ต้ม", "1 ถ้วย", 210, 5, 18, 13, 1, 1200, 1, "salt fat", "กินเนื้อ ไม่ซดน้ำแกงจนหมด"],
    ["tom-gai-ban", "ต้มไก่บ้านใบมะขามอ่อน", "🍲", "แกง-ต้ม", "1 ถ้วย", 180, 4, 22, 8, 1, 900, 1, "salt", "เมนูโปรตีนดี ลดน้ำปลา"],
    ["gaeng-normai", "แกงหน่อไม้ใบย่านาง", "🎋", "แกง-ต้ม", "1 ถ้วย", 120, 12, 6, 5, 1, 950, 4, "salt veg", "ใยอาหารสูง เหมาะกับกลุ่มเสี่ยง"],
    ["gaeng-hed", "แกงเห็ด", "🍄", "แกง-ต้ม", "1 ถ้วย", 80, 8, 4, 3, 1, 850, 3, "salt veg", "แคลอรีต่ำ ผักเด่น"],
    ["mok", "หมกปลา / หมกหน่อไม้", "🍃", "แกง-ต้ม", "1 ห่อ", 120, 5, 15, 4, 1, 700, 2, "", "นึ่ง ไม่ใช้น้ำมัน ดีต่อสุขภาพ"],
    ["om-pla", "อ่อมปลา / อ่อมหอย", "🥘", "แกง-ต้ม", "1 ถ้วย", 130, 7, 15, 4, 1, 1000, 3, "salt veg", "ลดปลาร้าและผงชูรส"],
    ["kao-piak", "ข้าวเปียกเส้น", "🍜", "แกง-ต้ม", "1 ชาม", 310, 52, 13, 5, 2, 1500, 1, "rice salt", "นับเป็นมื้อข้าวแป้ง ไม่ซดน้ำจนหมด เติมผัก"],
    ["jaew", "แจ่ว (น้ำพริกแจ่ว)", "🌶️", "น้ำพริก-ผัก", "1 ช้อนโต๊ะ", 15, 2, 0.5, 0.2, 1, 450, 0.3, "salt", "จิ้มน้อย ๆ โซเดียมสะสมเร็ว"],
    ["jaew-bong", "แจ่วบอง", "🌶️", "น้ำพริก-ผัก", "1 ช้อนโต๊ะ", 30, 3, 2, 1, 1, 650, 0.3, "salt", "มีปลาร้าเข้มข้น โซเดียมสูงมาก ใช้น้อย ๆ"],
    ["pon-pla", "ป่นปลา", "🐟", "น้ำพริก-ผัก", "1 ถ้วยเล็ก", 80, 4, 9, 2, 1, 800, 1, "salt", "โปรตีนดี กินกับผักลวกเยอะ ๆ"],
    ["pak", "ผักสด / ผักลวก / ผักแนม", "🥬", "น้ำพริก-ผัก", "1 จาน (~1 ถ้วย)", 25, 5, 2, 0.2, 2, 20, 3, "veg", "เยี่ยม! ผักครึ่งจานทุกมื้อ ช่วยให้น้ำตาลขึ้นช้า"],
    ["kao-jee", "ข้าวจี่", "🍡", "ของว่าง", "1 ไม้", 210, 36, 4, 5, 1, 250, 0.5, "rice", "นับเป็นข้าวแป้ง ไม่กินเพิ่มจากมื้อหลัก"],
    ["kao-tom-mud", "ข้าวต้มมัด", "🍌", "ของว่าง", "1 มัด", 250, 45, 3, 6, 15, 120, 1.5, "sweet rice", "หวานและเป็นแป้ง แบ่งครึ่งกับคนในบ้าน"],
    ["kao-lam", "ข้าวหลาม", "🎋", "ของว่าง", "1 กระบอกเล็ก", 380, 62, 5, 12, 22, 150, 1.5, "sweet rice fat", "น้ำตาลและกะทิสูง กินเป็นครั้งคราว"],
    ["mango", "มะม่วงสุก", "🥭", "ผลไม้", "1 ผล", 160, 40, 1.5, 0.6, 32, 3, 3, "sweet", "แบ่งกินครึ่งลูก หรือเลือกฝรั่ง/มะละกอ/ชมพู่แทน"],
    ["guava", "ฝรั่ง", "🍐", "ผลไม้", "1/2 ผล", 60, 13, 2, 0.6, 7, 2, 5, "veg", "น้ำตาลต่ำ ใยอาหารสูง เหมาะมาก"],
    ["banana", "กล้วยน้ำว้า", "🍌", "ผลไม้", "1 ลูก", 60, 15, 0.8, 0.2, 9, 1, 1.5, "", "1 ลูกต่อมื้อว่าง กำลังดี"],
    ["papaya", "มะละกอสุก", "🧡", "ผลไม้", "6–8 ชิ้นคำ", 60, 15, 0.7, 0.3, 9, 5, 2.5, "", "ผลไม้ทางเลือกที่ดี"],
    ["cha-yen", "ชาเย็น / ชานมไทย", "🧋", "เครื่องดื่ม", "1 แก้ว", 260, 40, 3, 9, 36, 80, 0, "sweet", "น้ำตาล ~9 ช้อนชา! สั่งหวาน 0–25% หรือดื่มชาไม่หวาน"],
    ["kafae-yen", "กาแฟเย็น", "☕", "เครื่องดื่ม", "1 แก้ว", 210, 32, 3, 8, 28, 70, 0, "sweet", "สั่งหวานน้อย/ไม่ใส่นมข้น หรือกาแฟดำ"],
    ["soda", "น้ำอัดลม / น้ำหวาน", "🥤", "เครื่องดื่ม", "1 กระป๋อง", 140, 35, 0, 0, 35, 15, 0, "sweet", "เปลี่ยนเป็นน้ำเปล่า โซดา หรือน้ำสมุนไพรไม่หวาน"],
    ["beer", "เบียร์", "🍺", "เครื่องดื่ม", "1 ขวดเล็ก (330 มล.)", 150, 13, 1, 0, 0, 15, 0, "", "แอลกอฮอล์ทำให้น้ำตาลแกว่ง ไม่เกิน 1 ดื่มมาตรฐาน/วัน และไม่ดื่มตอนท้องว่าง"],
    ["lao-kao", "เหล้าขาว", "🥃", "เครื่องดื่ม", "1 เป๊ก (30 มล.)", 85, 0, 0, 0, 0, 0, 0, "", "ลดหรือเลิก อาจทำให้น้ำตาลต่ำหากใช้ยาเบาหวาน"],
    ["water", "น้ำเปล่า", "💧", "เครื่องดื่ม", "1 แก้ว", 0, 0, 0, 0, 0, 0, 0, "veg", "ดื่มวันละ 6–8 แก้ว"],
  ];
  const DB = DB_ROWS.map(([key, n, e, cat, unit, kcal, carb, pro, fat, sugar, na, fib, flags, tip]) => ({ key, n, e, cat, unit, kcal, carb, pro, fat, sugar, na, fib, flags: flags.split(" ").filter(Boolean), tip }));
  const byKey = Object.fromEntries(DB.map((d) => [d.key, d]));
  const CATS = ["ทั้งหมด", "ข้าว-แป้ง", "ตำ", "ลาบ-ก้อย", "ปิ้ง-ย่าง", "แกง-ต้ม", "น้ำพริก-ผัก", "ของว่าง", "ผลไม้", "เครื่องดื่ม"];
  const MEALS = [["b", "มื้อเช้า", "🌅"], ["l", "มื้อกลางวัน", "☀️"], ["d", "มื้อเย็น", "🌙"], ["s", "ของว่าง/เครื่องดื่ม", "🍵"]];
  const PORTIONS = [[0.5, "ครึ่ง"], [1, "1 ที่"], [1.5, "1.5"], [2, "2 ที่"]];
  const FLAG = { raw: ["ดิบ", "#c8382b"], salt: ["เค็ม", "#d4622a"], sweet: ["หวาน", "#c28a00"], fat: ["มัน", "#8a5a33"], veg: ["ผักดี", "#2f8a4a"] };

  /* ---------- targets for pre-diabetes ---------- */
  function targets() {
    const pr = A().profile(), body = A().store.get("body", []).slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
    const wt = body?.weight || (pr.sex === "f" ? 62 : 72), ht = body?.height || pr.height || 165, age = pr.age || 50;
    const bmr = 10 * wt + 6.25 * ht - 5 * age + (pr.sex === "f" ? -161 : 5), bmi = wt / (ht / 100) ** 2;
    const kcal = Math.max(1300, Math.min(2400, Math.round((bmr * 1.4 - (bmi >= 23 ? 300 : 0)) / 50) * 50));
    return { kcal, carb: Math.round((kcal * 0.5) / 4), sugar: 24, na: 2000, fib: 25, sticky: 2 };
  }
  const logs = () => A().store.get("food", []);
  const saveLogs = (l) => A().store.set("food", l);
  function dayTotals(date) {
    const t = { kcal: 0, carb: 0, pro: 0, fat: 0, sugar: 0, na: 0, fib: 0, sticky: 0, veg: 0, raw: [], items: [] };
    logs().filter((l) => l.date === date).forEach((l) => {
      const d = byKey[l.key] || l.custom; if (!d) return; const p = l.portion || 1;
      ["kcal", "carb", "pro", "fat", "sugar", "na", "fib"].forEach((k) => (t[k] += (d[k] || 0) * p));
      if (l.key === "sticky" || l.key === "sticky-b") t.sticky += p;
      if ((d.flags || []).includes("veg") && d.cat !== "เครื่องดื่ม") t.veg += p;
      if ((d.flags || []).includes("raw")) t.raw.push(d.n);
      t.items.push({ ...l, d });
    });
    return t;
  }
  function mealScore(items) {
    if (!items.length) return null;
    const s = items.reduce((a, { d, portion: p = 1 }) => ({ carb: a.carb + d.carb * p, na: a.na + d.na * p, sugar: a.sugar + d.sugar * p, veg: a.veg + ((d.flags || []).includes("veg") ? p : 0), raw: a.raw || (d.flags || []).includes("raw") }), { carb: 0, na: 0, sugar: 0, veg: 0, raw: false });
    let pts = 3; const why = [];
    if (s.carb > 75) { pts--; why.push("ข้าว/แป้งมาก"); } if (s.na > 1200) { pts--; why.push("เค็มมาก"); } if (s.sugar > 15) { pts--; why.push("หวานมาก"); }
    if (s.veg < 1) { pts -= 0.5; why.push("ผักน้อย"); } if (s.raw) { pts = Math.min(pts, 1); why.unshift("มีเมนูดิบ"); }
    return pts >= 3 ? ["ดีมาก", "good", why] : pts >= 2 ? ["พอใช้", "ok", why] : ["ควรปรับ", "bad", why];
  }

  /* ---------- state + render ---------- */
  const F = { date: todayISO(), add: null, cat: "ทั้งหมด", q: "", pick: null, portion: 1, ai: null, aiBusy: false, chart: null };
  function bar(label, val, max, unit, opts = {}) {
    const pct = Math.min(100, (val / max) * 100), over = opts.min ? false : val > max, low = opts.min && val < max;
    return `<div class="fd-bar ${over ? "over" : ""} ${low ? "low" : ""}"><div class="fd-bar-h"><span>${label}</span><b>${r0(val)}<small>/${max} ${unit}</small></b></div><span class="fd-track"><i style="width:${pct}%"></i></span>${opts.note ? `<small class="fd-note">${opts.note}</small>` : ""}</div>`;
  }
  function render() {
    const root = $("#foodRoot"); if (!root) return;
    const T = targets(), t = dayTotals(F.date), isToday = F.date === todayISO();
    const meals = MEALS.map(([k, label, ic]) => {
      const items = t.items.filter((x) => x.meal === k), sc = mealScore(items), kc = items.reduce((a, x) => a + x.d.kcal * (x.portion || 1), 0);
      return `<section class="fd-meal pa-wrap ${sc ? "s-" + sc[1] : "empty"}${k === "s" ? " snack" : ""}"><div class="fd-meal-h"><h3>${ic} ${k === "s" ? "ถาดของว่าง" : "พาข้าว" + label}</h3>${sc ? `<span class="fd-score ${sc[1]}" title="${esc(sc[2].join(" · "))}">${sc[0]}</span>` : ""}<small>${r0(kc)} kcal</small></div>
        <button type="button" class="pa" data-add="${k}" aria-label="หยิบกับข้าวจากตู้ใส่${k === "s" ? "ถาดของว่าง" : "พาข้าว" + label}">${trayDishes(items)}${items.length ? "" : `<span class="pa-empty">พายังว่าง<br><b>แตะเพื่อหยิบกับข้าว</b></span>`}</button>
        <button class="btn sm pa-add" type="button" data-add="${k}">🗄️ หยิบจากตู้กับข้าว</button>
        ${items.length ? ownLine(items, sc) : ""}
        ${items.length ? `<ul class="fd-items">${items.map((x) => `<li><span class="fd-e">${x.d.e || "🍽️"}</span><span class="fd-n"><b>${esc(x.d.n)}</b><small>${x.portion !== 1 ? `× ${x.portion} · ` : ""}${esc(x.d.unit || "")} · ${r0(x.d.kcal * x.portion)} kcal · คาร์บ ${r0(x.d.carb * x.portion)} ก.${x.ai ? " · 📷 AI" : ""}</small></span>${(x.d.flags || []).filter((f) => FLAG[f]).map((f) => `<i class="fd-flag" style="--fc:${FLAG[f][1]}">${FLAG[f][0]}</i>`).join("")}<button type="button" class="fd-del" data-del="${x.id}" aria-label="ลบ ${esc(x.d.n)}">✕</button></li>`).join("")}</ul>` : `<p class="fd-empty">ยังไม่ได้บันทึก</p>`}
      </section>`;
    }).join("");
    root.innerHTML = `
      <div class="fd-top card">
        <div class="fd-date"><button type="button" class="icon-btn" data-day="-1" aria-label="วันก่อนหน้า">‹</button><b>${isToday ? "วันนี้ · " : ""}${thDate(F.date)}</b><button type="button" class="icon-btn" data-day="1" aria-label="วันถัดไป" ${isToday ? "disabled" : ""}>›</button></div>
        <div class="fd-kcal"><div class="fd-ring" style="--p:${Math.min(100, (t.kcal / T.kcal) * 100)}"><b>${r0(t.kcal)}</b><small>/ ${T.kcal} kcal</small></div>
          <div class="fd-macros"><span>คาร์บ <b>${r0(t.carb)} ก.</b></span><span>โปรตีน <b>${r0(t.pro)} ก.</b></span><span>ไขมัน <b>${r0(t.fat)} ก.</b></span><span>🍙 ข้าวเหนียว <b>${+t.sticky.toFixed(1)} ปั้น</b></span></div></div>
        <div class="fd-bars">
          ${bar("คาร์โบไฮเดรต", t.carb, T.carb, "ก.", { note: "ประมาณ 50% ของพลังงาน" })}
          ${bar("น้ำตาล", t.sugar, T.sugar, "ก.", { note: "ไม่เกิน 6 ช้อนชา/วัน" })}
          ${bar("โซเดียม", t.na, T.na, "มก.", { note: "ไม่เกิน 2,000 มก. (เกลือ 1 ช้อนชา)" })}
          ${bar("ใยอาหาร", t.fib, T.fib, "ก.", { min: true, note: "ควรได้อย่างน้อย 25 ก." })}
        </div>
      </div>
      ${t.raw.length ? `<div class="fd-alert">⚠️ วันนี้มีเมนูดิบ: <b>${esc([...new Set(t.raw)].join(", "))}</b> — ปลาน้ำจืด/เนื้อดิบเสี่ยงพยาธิใบไม้ตับ (สาเหตุมะเร็งท่อน้ำดีที่พบมากในภาคอีสาน) ควรกินแบบสุก</div>` : ""}
      <div class="fd-grid">
        <div class="fd-meals">${meals}</div>
        <aside class="fd-side">
          <section class="card fd-coach"><h3>🤖 โค้ชโภชนาการ</h3>${coach(t, T)}</section>
          <section class="card"><h3>7 วันที่ผ่านมา</h3><div class="fd-chart"><canvas id="fdWeek"></canvas></div></section>
          <section class="card fd-plate"><h3>จานสุขภาพ 2:1:1</h3><div class="fd-plate-art" aria-hidden="true"><span class="p-veg">ผัก 2</span><span class="p-rice">ข้าว 1</span><span class="p-pro">โปรตีน 1</span></div><p class="hint">แบ่งจานเป็น 4 ส่วน: ผัก 2 ส่วน ข้าว/ข้าวเหนียว 1 ส่วน (ไม่เกิน 1 ปั้น) เนื้อสัตว์ไม่ติดมัน 1 ส่วน</p></section>
        </aside>
      </div>
      <p class="disclaimer">ค่าสารอาหารเป็นค่าประมาณต่อ 1 ที่เสิร์ฟทั่วไป ขึ้นกับสูตรและปริมาณจริง ใช้เพื่อติดตามพฤติกรรม ไม่ใช่ผลตรวจทางโภชนาการ</p>
      ${F.add ? addPanel() : ""}`;
    drawWeek();
  }
  // dishes laid out around the tray; sticky rice sits in a กระติบ
  function trayDishes(items) {
    const n = Math.min(items.length, 8);
    return items.slice(0, 8).map((x, i) => {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2, rad = n === 1 ? 0 : n <= 3 ? 24 : 30;
      const left = 50 + rad * Math.cos(ang), top = 50 + rad * Math.sin(ang), sticky = x.key === "sticky" || x.key === "sticky-b";
      return `<span class="pa-dish${sticky ? " katib" : ""}" style="left:${left.toFixed(1)}%;top:${top.toFixed(1)}%" title="${esc(x.d.n)}"><i>${x.d.e || "🍽️"}</i>${x.portion !== 1 ? `<em>×${x.portion}</em>` : ""}</span>`;
    }).join("") + (items.length > 8 ? `<span class="pa-more">+${items.length - 8}</span>` : "");
  }
  function ownLine(items, sc) {
    const sticky = items.filter((x) => x.key === "sticky" || x.key === "sticky-b").reduce((a, x) => a + (x.portion || 1), 0);
    const why = sc ? sc[2] : [], msg = [];
    if (why.includes("มีเมนูดิบ")) msg.push("มีเมนูดิบ ระวังพยาธิใบไม้ตับนะคะ ลองเลือกแบบสุกแทน");
    if (sticky >= 2) msg.push(`ข้าวเหนียว ${+sticky.toFixed(1)} ปั้นแล้วน้า มื้อหน้าลดเหลือ 1 ปั้นนะคะ`);
    else if (why.includes("ข้าว/แป้งมาก")) msg.push("ข้าวแป้งเยอะไปนิด ลองลดลงครึ่งหนึ่งนะคะ");
    if (why.includes("เค็มมาก")) msg.push("เค็มไปหน่อย ลดน้ำปลา ปลาร้า และไม่ซดน้ำแกงนะคะ");
    if (why.includes("หวานมาก")) msg.push("หวานไปหน่อย เครื่องดื่มเลือกหวานน้อยนะคะ");
    if (why.includes("ผักน้อย")) msg.push("เพิ่มผักสักจานนะคะ 🥬");
    if (!msg.length) msg.push(sc && sc[1] === "good" ? "พาข้าวนี้สมดุลดีมากค่ะ 👍" : "ดีแล้วค่ะ กินพอดี ๆ นะคะ");
    return `<p class="pa-own"><span class="pa-av" aria-hidden="true">${window.PreDMMascot ? PreDMMascot.svg() : "💗"}</span><span><b>น้องอ่อนหวาน:</b> ${esc(msg.slice(0, 2).join(" · "))}</span></p>`;
  }
  function coach(t, T) {
    if (!t.items.length) return `<p class="lede">บันทึกอาหารมื้อแรกของวัน แล้วโค้ชจะช่วยวิเคราะห์และแนะนำการปรับให้เหมาะกับกลุ่มเสี่ยงเบาหวาน</p>`;
    const out = [];
    if (t.sticky > T.sticky) out.push(["🍙", `ข้าวเหนียววันนี้ ${+t.sticky.toFixed(1)} ปั้น เกินเป้า ${T.sticky} ปั้น — ลองลดเหลือครึ่งปั้นต่อมื้อ หรือเพิ่มผักแทน`]);
    if (t.carb > T.carb) out.push(["🍚", `คาร์บ ${r0(t.carb)} ก. เกินเป้า ${T.carb} ก. มื้อถัดไปลดข้าว/แป้งลงครึ่งหนึ่ง`]);
    if (t.sugar > T.sugar) out.push(["🧋", `น้ำตาล ${r0(t.sugar)} ก. (~${r0(t.sugar / 4)} ช้อนชา) เกินแนะนำ — เปลี่ยนเครื่องดื่มหวานเป็นไม่หวาน/น้ำเปล่า`]);
    if (t.na > T.na) out.push(["🧂", `โซเดียม ${r0(t.na).toLocaleString()} มก. เกิน 2,000 มก. — ลดปลาร้า/น้ำปลา/แจ่ว และไม่ซดน้ำแกง`]);
    if (t.fib < 15 && t.items.length >= 2) out.push(["🥬", "ใยอาหารยังน้อย เพิ่มผักสด/ผักลวก/ผักแนมทุกมื้อ ช่วยให้น้ำตาลขึ้นช้า"]);
    if (!out.length) out.push(["🌟", "วันนี้สมดุลดีมาก! ข้าว น้ำตาล และโซเดียมอยู่ในเกณฑ์"]);
    const tips = [...new Map(t.items.filter((x) => x.d.tip && (x.d.flags || []).some((f) => ["raw", "salt", "sweet", "fat", "rice"].includes(f))).map((x) => [x.d.n, x.d])).values()].slice(0, 3);
    return `<ul class="fd-tips">${out.map(([i, s]) => `<li><span>${i}</span>${esc(s)}</li>`).join("")}</ul>${tips.length ? `<h4>ปรับเมนูที่กินวันนี้</h4><ul class="fd-swaps">${tips.map((d) => `<li><b>${d.e} ${esc(d.n)}</b>${esc(d.tip)}</li>`).join("")}</ul>` : ""}`;
  }
  function drawWeek() {
    if (F.chart) { F.chart.destroy(); F.chart = null; }
    const el = $("#fdWeek"); if (!el || !window.Chart) return;
    const days = Array.from({ length: 7 }, (_, i) => addDays(F.date, i - 6)), T = targets(), tot = days.map(dayTotals);
    const cs = getComputedStyle(document.documentElement), ink = cs.getPropertyValue("--muted").trim(), line = cs.getPropertyValue("--line").trim();
    F.chart = new window.Chart(el, { type: "bar", data: { labels: days.map((d) => thDate(d, { weekday: "narrow" })), datasets: [
      { label: "kcal", data: tot.map((x) => r0(x.kcal)), backgroundColor: tot.map((x) => (x.kcal > T.kcal ? "#f08a4b" : "#7ccf6a")), borderRadius: 6 },
      { type: "line", label: "เป้าหมาย", data: days.map(() => T.kcal), borderColor: "#e05246", borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (c) => c.datasetIndex ? "" : `น้ำตาล ${r0(tot[c.dataIndex].sugar)} ก. · โซเดียม ${r0(tot[c.dataIndex].na)} มก.` } } },
        scales: { x: { ticks: { color: ink }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: ink, maxTicksLimit: 4 }, grid: { color: line } } } } });
  }

  /* ---------- add panel: search Isan menu or snap a photo ---------- */
  function addPanel() {
    const meal = MEALS.find((m) => m[0] === F.add);
    const q = F.q.trim(), list = DB.filter((d) => (F.cat === "ทั้งหมด" || d.cat === F.cat) && (!q || d.n.includes(q)));
    const pick = F.pick && byKey[F.pick];
    return `<div class="fd-modal" role="dialog" aria-modal="true" aria-label="หยิบกับข้าวจากตู้ใส่${meal[1]}"><div class="fd-sheet card kitchen">
      <div class="fd-sheet-h"><h2>${meal[2]} หยิบกับข้าวใส่${meal[0] === "s" ? "ถาดของว่าง" : "พาข้าว" + meal[1]}</h2><button type="button" class="icon-btn" data-close aria-label="ปิด">✕</button></div>
      <div class="seg fd-mode" role="tablist"><button type="button" role="tab" aria-selected="${!F.ai}" data-mode="search">🗄️ หยิบจากตู้กับข้าว</button>${window.PREDM_CONFIG?.externalAI === false ? "" : `<button type="button" role="tab" aria-selected="${!!F.ai}" data-mode="photo">📷 ถ่ายรูปพาข้าว</button>`}</div>
      ${F.ai ? photoPane() : `
        <div class="cup">
          <div class="cup-top"><span class="cup-name">🗄️ ตู้กับข้าว</span><input class="fd-search" id="fdQ" placeholder="ค้นหา เช่น ตำ ลาบ ข้าวเหนียว แจ่ว" value="${esc(F.q)}" aria-label="ค้นหาเมนูในตู้กับข้าว"></div>
          <div class="fd-cats">${CATS.map((c) => `<button type="button" aria-pressed="${c === F.cat}" data-cat="${c}">${c === "ทั้งหมด" ? "ทุกชั้น" : c}</button>`).join("")}</div>
          <div class="cup-body">${CATS.slice(1).map((c) => { const row = list.filter((d) => d.cat === c); return row.length ? `<div class="shelf"><b class="shelf-l">${c}</b><div class="shelf-row">${row.map((d) => `<button type="button" class="fd-opt cup-dish" aria-pressed="${d.key === F.pick}" data-pick="${d.key}" aria-label="${esc(d.n)} ${d.kcal} กิโลแคลอรี"><span class="cup-plate">${d.e}</span><b>${d.n}</b><small>${d.kcal} kcal</small><span class="cup-flags">${d.flags.filter((f) => FLAG[f]).slice(0, 2).map((f) => `<i class="fd-flag" style="--fc:${FLAG[f][1]}">${FLAG[f][0]}</i>`).join("")}</span></button>`).join("")}</div></div>` : ""; }).join("") || `<p class="fd-empty">ไม่พบเมนูในตู้ ลองคำอื่น</p>`}</div>
        </div>
        ${pick ? `<div class="fd-pick"><div><b>${pick.e} ${pick.n}</b><small>${pick.unit}</small></div>
          <div class="fd-por">${PORTIONS.map(([v, l]) => `<button type="button" aria-pressed="${v === F.portion}" data-por="${v}">${l}</button>`).join("")}</div>
          <div class="fd-nut"><span>${r0(pick.kcal * F.portion)} <small>kcal</small></span><span>คาร์บ ${r0(pick.carb * F.portion)} ก.</span><span>น้ำตาล ${r0(pick.sugar * F.portion)} ก.</span><span>โซเดียม ${r0(pick.na * F.portion)} มก.</span></div>
          ${pick.tip ? `<p class="fd-tip">💡 ${esc(pick.tip)}</p>` : ""}
          <button class="btn primary" type="button" data-save>วางลง${meal[0] === "s" ? "ถาดของว่าง" : "พาข้าว" + meal[1]}</button></div>` : ""}`}
    </div></div>`;
  }
  function photoPane() {
    const a = F.ai, key = A().store.get("geminiKey", null);
    if (a.results) return `<div class="fd-ai"><img src="${a.preview}" alt="รูปอาหารที่ถ่าย" class="fd-ai-img">
      <h3>AI พบเมนูเหล่านี้ — ตรวจสอบและปรับปริมาณก่อนบันทึก</h3>
      ${a.results.length ? `<ul class="fd-ai-list">${a.results.map((r, i) => { const d = byKey[r.key]; return `<li><label class="fd-ai-chk"><input type="checkbox" data-aion="${i}" ${r.on ? "checked" : ""}><span class="fd-e">${d.e}</span><span><b>${d.n}</b><small>${d.unit} · ความมั่นใจ ${Math.round((r.conf || 0.5) * 100)}%</small></span></label>
        <span class="fd-por sm">${PORTIONS.map(([v, l]) => `<button type="button" aria-pressed="${v === r.portion}" data-aipor="${i}:${v}">${l}</button>`).join("")}</span></li>`; }).join("")}</ul>` : `<p class="fd-empty">AI ไม่พบเมนูที่ตรงกับฐานข้อมูล ลองเลือกเมนูเองจากแท็บ “เลือกเมนูอีสาน”</p>`}
      ${a.note ? `<p class="hint">AI: ${esc(a.note)}</p>` : ""}
      <div class="btns"><button class="btn primary" type="button" data-aisave ${a.results.some((r) => r.on) ? "" : "disabled"}>บันทึกเมนูที่เลือก</button><button class="btn" type="button" data-aireset>ถ่ายใหม่</button></div>
      <p class="hint">ภาพถ่ายบอกปริมาณและส่วนผสมได้ไม่แม่นยำเสมอ โดยเฉพาะน้ำตาลและโซเดียม ตัวเลขเป็นค่าประมาณ</p></div>`;
    return `<div class="fd-ai">
      <label class="fd-drop" for="fdPhoto"><input id="fdPhoto" type="file" accept="image/*" capture="environment">${a.preview ? `<img src="${a.preview}" alt="รูปอาหาร">` : `<span>📷 <b>ถ่ายรูป / เลือกรูปอาหาร</b><small>ถ่ายจากด้านบน เห็นทุกจานชัด ๆ</small></span>`}</label>
      ${key || window.PreDMAI?.cloud ? (window.PreDMAI?.cloud ? `<p class="hint">☁️ บัญชีจริงใช้ AI ของระบบได้เลย ไม่ต้องใส่ API key (วันละ 40 รูป)</p>` : "") : `<label>Gemini API key (ใช้ร่วมกับ AI Transformation)<input id="fdKey" type="password" autocomplete="off" placeholder="วาง API key จาก Google AI Studio"></label>`}
      <label class="tf-check"><input type="checkbox" id="fdConsent">ยินยอมส่งรูปอาหารนี้ไปยัง Google Gemini เพื่อวิเคราะห์เมนู</label>
      <p class="form-error" id="fdAiErr" role="alert" ${a.err ? "" : "hidden"}>${esc(a.err || "")}</p>
      <button class="btn primary" type="button" data-aigo ${a.preview && !F.aiBusy ? "" : "disabled"}>${F.aiBusy ? "AI กำลังวิเคราะห์…" : "✨ วิเคราะห์ด้วย AI"}</button>
      <p class="hint">AI จะจับคู่กับฐานข้อมูลอาหารอีสาน ${DB.length} เมนูของแอป แล้วให้คุณยืนยันก่อนบันทึก</p></div>`;
  }
  async function analyze() {
    const a = F.ai, err = (m) => { a.err = m; F.aiBusy = false; render(); };
    const key = A().store.get("geminiKey", null) || $("#fdKey")?.value.trim();
    const cloud = !!window.PreDMAI?.cloud;
    if (!key && !cloud) return err("กรุณาวาง Gemini API key");
    if (!$("#fdConsent").checked) return err("กรุณาติ๊กยินยอมก่อนส่งรูป");
    if (!cloud && $("#fdKey")?.value.trim()) A().store.set("geminiKey", key);
    F.aiBusy = true; a.err = null; render();
    const menu = DB.map((d) => `${d.key}: ${d.n} (${d.unit})`).join("\n");
    const prompt = `You are a Thai dietitian assistant. Identify the foods and drinks in this photo (typically Isan / northeastern Thai food). Match each item ONLY to a key from this menu list, and estimate the portion as a multiple of the listed serving (0.5, 1, 1.5 or 2):\n${menu}\nReply with JSON only: {"items":[{"key":"...","portion":1,"confidence":0.0}],"note":"short Thai note about anything unclear"}. Use an empty items array if nothing matches.`;
    try {
      const model = A().store.get("geminiTextModel", "gemini-2.5-flash");
      const res = await window.PreDMAI.call("food", model, { contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: a.b64 } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }, key), j = res.json || {};
      if (!res.ok && (res.cloud || res.code)) return err(window.PreDMAI.cloudError(res) || "เชื่อมต่อ AI ไม่ได้ ลองใหม่");
      if (!res.ok) return err(res.status === 400 && /API key/i.test(j.error?.message || "") ? "API key ไม่ถูกต้อง" : res.status === 429 ? "ใช้งานเกินโควตา ลองใหม่ภายหลัง" : `Gemini ตอบกลับข้อผิดพลาด (${res.status})`);
      const txt = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      const out = JSON.parse(txt.replace(/^```json|```$/g, "").trim());
      a.results = (out.items || []).filter((x) => byKey[x.key]).map((x) => ({ key: x.key, portion: [0.5, 1, 1.5, 2].includes(+x.portion) ? +x.portion : 1, conf: +x.confidence || 0.5, on: true }));
      a.note = out.note || ""; F.aiBusy = false; render();
    } catch { err("วิเคราะห์ไม่สำเร็จ ลองรูปที่ชัดขึ้น หรือเลือกเมนูเอง"); }
  }
  function loadPhoto(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const du = c.toDataURL("image/jpeg", 0.85); F.ai = { preview: du, b64: du.split(",")[1] }; URL.revokeObjectURL(url); render(); };
    img.src = url;
  }
  function addEntry(key, portion, meal, ai) {
    const l = logs(); l.push({ id: "f" + Date.now() + Math.random().toString(36).slice(2, 6), date: F.date, meal, key, portion, ai: !!ai, at: new Date().toISOString() }); saveLogs(l.slice(-3000));
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const root = $("#foodRoot"); if (!root || !root.contains(e.target)) return;
    const t = (s) => e.target.closest(s);
    if (t("[data-day]")) { const n = addDays(F.date, +t("[data-day]").dataset.day); if (n <= todayISO()) { F.date = n; render(); } return; }
    if (t("[data-add]")) { F.add = t("[data-add]").dataset.add; F.pick = null; F.portion = 1; F.q = ""; F.ai = null; render(); $("#fdQ")?.focus(); return; }
    if (t("[data-close]") || e.target.classList.contains("fd-modal")) { F.add = null; F.ai = null; return render(); }
    if (t("[data-del]")) { saveLogs(logs().filter((l) => l.id !== t("[data-del]").dataset.del)); return render(); }
    if (t("[data-mode]")) { F.ai = t("[data-mode]").dataset.mode === "photo" ? F.ai || {} : null; return render(); }
    if (t("[data-cat]")) { F.cat = t("[data-cat]").dataset.cat; return render(); }
    if (t("[data-pick]")) { F.pick = t("[data-pick]").dataset.pick; F.portion = 1; render(); $(".fd-pick")?.scrollIntoView({ block: "nearest" }); return; }
    if (t("[data-por]")) { F.portion = +t("[data-por]").dataset.por; return render(); }
    if (t("[data-save]")) { addEntry(F.pick, F.portion, F.add, false); A().toast(`บันทึก ${byKey[F.pick].n} แล้ว`); F.add = null; return render(); }
    if (t("[data-aigo]")) return analyze();
    if (t("[data-aireset]")) { F.ai = {}; return render(); }
    if (t("[data-aipor]")) { const [i, v] = t("[data-aipor]").dataset.aipor.split(":"); F.ai.results[+i].portion = +v; return render(); }
    if (t("[data-aisave]")) { const on = F.ai.results.filter((r) => r.on); on.forEach((r) => addEntry(r.key, r.portion, F.add, true)); A().toast(`บันทึก ${on.length} เมนูจากรูปแล้ว`); F.add = null; F.ai = null; return render(); }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "fdPhoto") loadPhoto(e.target.files[0]);
    if (e.target.dataset?.aion != null) { F.ai.results[+e.target.dataset.aion].on = e.target.checked; render(); }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "fdQ") { F.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $("#fdQ"); q.focus(); q.setSelectionRange(pos, pos); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && F.add) { F.add = null; F.ai = null; render(); } });
  window.addEventListener("predm:view", (e) => { if (e.detail === "food") render(); });
  if ($("#view-food") && !$("#view-food").hidden) render();
  window.PreDMFood = { DB, dayTotals, targets };
})();
