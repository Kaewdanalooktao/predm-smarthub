/* Pre-DM Smart Hub — two kitchen games (no camera), shown in the "ครัวอีสานของฉัน" page and the Games page.
   1) เกมจ่ายตลาด — shop for a family dinner with a budget and a basket; scored on how healthy the shopping is.
   2) เกมจัดสำรับ — build one meal from the food cupboard (2:1:1 plate); scored on carbs, salt, sugar, vegetables;
      the finished meal can be saved straight onto today's meal tray.
   Reuses the quiz modal styles (.fq-*). Best scores: store "marketBest", "plateBest". */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A = () => window.PreDM;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mascot = () => (window.PreDMMascot ? PreDMMascot.svg() : "💗");
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------- shared modal ---------- */
  function modal() {
    if (!$("#kgModal")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="fq-modal" id="kgModal" role="dialog" aria-modal="true" aria-labelledby="kgTitle" hidden><div class="fq-box kg-box" id="kgBox"></div></div>`);
      $("#kgModal").addEventListener("click", (e) => { if (e.target.id === "kgModal") close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#kgModal").hidden) close(); });
      $("#kgModal").addEventListener("click", onClick);
    }
    $("#kgModal").hidden = false; document.body.classList.add("care-open"); window.PreDMMusic?.start();
  }
  function close() { $("#kgModal").hidden = true; document.body.classList.remove("care-open"); window.PreDMMusic?.stop(); }
  const head = (title, sub) => `<div class="fq-head"><span class="fq-av">${mascot()}</span><div><h2 id="kgTitle">${title}</h2><small>${sub}</small></div><button type="button" class="care-x fq-mu" data-music aria-label="เปิด/ปิดเพลง">🎵</button><button type="button" class="care-x" data-kg="close" aria-label="ปิดเกม">✕</button></div>`;
  const stars = (n) => `<div class="fq-stars" aria-label="ได้ ${n} ดาว">${[0, 1, 2].map((k) => `<span class="${k < n ? "on" : ""}">★</span>`).join("")}</div>`;
  function best(key, v) { const b = Math.max(v, A()?.store.get(key, 0) || 0); A()?.store.set(key, b); return b; }

  /* =========================================================================================
     1) เกมจ่ายตลาด
     ========================================================================================= */
  // [emoji, name, price (baht), group, health points, why]
  const GOODS = [
    ["🥬", "ผักกาดขาว", 15, "veg", 3, "ผักใยอาหารสูง"], ["🌿", "ผักบุ้ง", 10, "veg", 3, "ผักราคาประหยัด ใยอาหารดี"], ["🥒", "แตงกวา", 10, "veg", 3, "ผักแนมส้มตำ ลาบ"],
    ["🫛", "ถั่วฝักยาว", 15, "veg", 3, "ผักใยอาหารสูง"], ["🍄", "เห็ดฟาง", 20, "veg", 3, "ทำต้ม/แกงอ่อมได้"], ["🍅", "มะเขือเทศ", 15, "veg", 2, "ผักผลไม้แคลอรีต่ำ"],
    ["🥦", "บรอกโคลี", 30, "veg", 3, "ใยอาหารและวิตามินสูง"], ["🥕", "แครอท", 15, "veg", 2, "ผักสีส้ม วิตามินเอ"], ["🍆", "มะเขือ", 10, "veg", 3, "ผักจิ้มน้ำพริก ใยอาหารดี"],
    ["🫑", "พริกหวาน", 25, "veg", 2, "ผักสีสวย วิตามินซี"], ["🥗", "ผักสลัดรวม", 25, "veg", 3, "ผักสด พร้อมกิน"], ["🌱", "ยอดผักติ้ว/ผักพื้นบ้าน", 10, "veg", 3, "ผักพื้นบ้านอีสาน ใยอาหารสูง"],
    ["🐟", "ปลานิล", 55, "pro", 3, "โปรตีนดี ไขมันต่ำ"], ["🍗", "อกไก่", 45, "pro", 3, "โปรตีนสูง ไขมันต่ำ"], ["🥚", "ไข่ไก่ 6 ฟอง", 30, "pro", 2, "โปรตีนราคาประหยัด"],
    ["🧈", "เต้าหู้", 15, "pro", 3, "โปรตีนจากพืช"], ["🦐", "กุ้งสด", 70, "pro", 2, "โปรตีนดี ต้องทำให้สุก"], ["🦑", "ปลาหมึก", 60, "pro", 1, "ไขมันต่ำ คอเลสเตอรอลสูง"],
    ["🐸", "กบ", 50, "pro", 2, "โปรตีนสูง ไขมันต่ำ"], ["🦀", "ปูนา", 35, "pro", 0, "ต้องทำให้สุก ดองแล้วเค็มมาก"], ["🥩", "หมูสันใน", 50, "pro", 2, "หมูส่วนไม่ติดมัน"],
    ["🥓", "หมูสามชั้น", 60, "pro", -2, "ไขมันอิ่มตัวสูง"], ["🌭", "ไส้กรอก/หมูยอ", 35, "pro", -2, "อาหารแปรรูป เค็มและมัน"], ["🍖", "ซี่โครงหมูติดมัน", 65, "pro", -1, "ไขมันสูง"],
    ["🍚", "ข้าวกล้อง 1 กก.", 45, "carb", 2, "ข้าวไม่ขัดสี ใยอาหารสูง"], ["🍙", "ข้าวเหนียวดำ 1 กก.", 50, "carb", 1, "ใยอาหารมากกว่าข้าวเหนียวขาว"], ["🌾", "ข้าวเหนียวขาว 1 กก.", 40, "carb", 0, "ข้าวขัดขาว กินพอดี"],
    ["🌽", "ข้าวโพด", 20, "carb", 1, "แป้งที่มีใยอาหาร"], ["🍠", "มันเทศ", 20, "carb", 1, "แป้งเชิงซ้อน ใยอาหารดี"], ["🥔", "มันฝรั่ง", 25, "carb", 0, "แป้ง ควรต้มหรือนึ่ง ไม่ทอด"],
    ["🍜", "บะหมี่กึ่งสำเร็จรูป", 7, "carb", -2, "โซเดียมสูงมาก"], ["🍞", "ขนมปังขาวหวาน", 30, "carb", -1, "แป้งขัดขาวและน้ำตาล"], ["🥐", "ครัวซองต์", 35, "carb", -2, "เนยและแป้งขัดขาว"],
    ["🌶️", "พริก", 10, "season", 1, "เพิ่มรสโดยไม่เพิ่มเกลือ"], ["🧄", "กระเทียม", 10, "season", 1, "เพิ่มกลิ่นรสแทนผงปรุง"], ["🧅", "หอมแดง", 10, "season", 1, "เครื่องเทศพื้นบ้าน"],
    ["🍋", "มะนาว", 10, "season", 1, "เพิ่มรสเปรี้ยวแทนน้ำปลา"], ["🌿", "ตะไคร้ ข่า ใบมะกรูด", 10, "season", 1, "สมุนไพรหอม ลดเค็มได้"], ["🫚", "ขิง", 10, "season", 1, "สมุนไพรช่วยย่อย"],
    ["🫙", "ปลาร้าขวดใหญ่", 25, "season", -1, "โซเดียมสูง ใช้น้อย ๆ"], ["🧂", "ผงปรุงรส", 15, "season", -1, "โซเดียมสูง"], ["🍯", "น้ำตาลปี๊บ", 20, "season", -2, "น้ำตาล ใส่ตำ/แกงทำให้หวาน"],
    ["🍐", "ฝรั่ง", 25, "fruit", 2, "ผลไม้น้ำตาลต่ำ"], ["🍎", "ชมพู่", 30, "fruit", 2, "ผลไม้น้ำตาลต่ำ"], ["🍊", "ส้มโอ", 40, "fruit", 1, "ผลไม้วิตามินซี กินพอดี"],
    ["🍌", "กล้วยน้ำว้า", 20, "fruit", 1, "ผลไม้กินได้ครั้งละ 1 ลูก"], ["🍉", "แตงโม", 30, "fruit", 0, "ดัชนีน้ำตาลสูง กินพอดี"], ["🍍", "สับปะรด", 25, "fruit", 0, "หวาน กินไม่เกิน 8 ชิ้นคำ"],
    ["🥭", "มะม่วงสุก", 40, "fruit", 0, "หวาน ควรกินครึ่งลูก"], ["🍇", "องุ่น", 60, "fruit", -1, "หวานมาก กินทีละน้อย"], ["🥥", "มะพร้าวอ่อน", 30, "fruit", 0, "น้ำตาลธรรมชาติ"],
    ["💧", "น้ำเปล่า", 10, "drink", 1, "เครื่องดื่มที่ดีที่สุด"], ["🥛", "นมจืด", 15, "drink", 1, "แคลเซียม ไม่เติมน้ำตาล"], ["🍵", "ชาไม่หวาน", 15, "drink", 1, "ไม่มีน้ำตาล"],
    ["🥤", "น้ำอัดลม", 15, "drink", -3, "น้ำตาล ~9 ช้อนชา"], ["🧋", "ชานมไข่มุก", 35, "drink", -3, "น้ำตาลและแป้งสูง"], ["🧃", "น้ำผลไม้กล่อง", 15, "drink", -2, "น้ำตาลสูง ไม่มีใยอาหาร"],
    ["🍺", "เบียร์", 45, "drink", -2, "แอลกอฮอล์ ทำให้น้ำตาลแกว่ง"], ["🥜", "ถั่วลิสง", 20, "snack", 1, "ของว่างโปรตีน ไม่เค็ม"], ["🍬", "ขนมหวานถุง", 20, "snack", -2, "น้ำตาลสูง"],
    ["🍩", "โดนัท", 25, "snack", -2, "น้ำตาลและไขมันสูง"], ["🍪", "คุกกี้", 30, "snack", -2, "แป้ง น้ำตาล เนย"], ["🍿", "ป๊อปคอร์นเนย", 30, "snack", -1, "เค็มและมันเนย"], ["🍫", "ช็อกโกแลต", 35, "snack", -2, "น้ำตาลสูง"],
  ].map(([e, n, price, g, hp, why], i) => ({ id: i, e, n, price, g, hp, why }));
  const MK = { budget: 250, max: 12, cart: [], stall: "veg" };
  const GOALS = ["ซื้อของทำกับข้าวมื้อเย็นให้ครอบครัว 4 คน", "ซื้อของเตรียมอาหาร 2 มื้อสำหรับคุณยาย", "ซื้อของไปทำกับข้าวงานบุญเล็ก ๆ ที่บ้าน"];
  function marketStart() { MK.cart = []; MK.stall = "veg"; MK.goal = pick(GOALS); modal(); marketDraw(); }
  function marketDraw() {
    const spent = MK.cart.reduce((a, id) => a + GOODS[id].price, 0), left = MK.budget - spent;
    const groups = [["veg", "🥬 ผัก"], ["pro", "🐟 เนื้อสัตว์"], ["carb", "🍚 ข้าว แป้ง"], ["fruit", "🍐 ผลไม้"], ["season", "🌶️ เครื่องปรุง"], ["drink", "💧 เครื่องดื่ม"], ["snack", "🍬 ขนม"]];
    $("#kgBox").innerHTML = head("🧺 เกมจ่ายตลาด", `ภารกิจ: ${MK.goal}`) + `
      <div class="mk-bar"><span>💰 เหลือ <b>${left}</b> / ${MK.budget} บาท</span><span>🧺 ${MK.cart.length} / ${MK.max} ชิ้น</span></div>
      <div class="mk-basket" aria-label="ของในตะกร้า">${MK.cart.length ? MK.cart.map((id, k) => `<button type="button" class="mk-in" data-kgout="${k}" title="เอาออก ${esc(GOODS[id].n)}">${FI(GOODS[id].e)}<i>✕</i></button>`).join("") : `<small>ตะกร้ายังว่าง แตะสินค้าในแผงเพื่อหยิบใส่ตะกร้า</small>`}</div>
      <div class="fd-cats mk-tabs" role="tablist">${groups.map(([g, label]) => `<button type="button" role="tab" aria-pressed="${g === MK.stall}" data-kgstall="${g}">${label}<small>${GOODS.filter((x) => x.g === g).length}</small></button>`).join("")}</div>
      <div class="mk-market"><section class="mk-stall"><div class="mk-row">${GOODS.filter((x) => x.g === MK.stall).map((x) => {
        const dis = x.price > left || MK.cart.length >= MK.max, n = MK.cart.filter((i) => i === x.id).length;
        return `<button type="button" class="mk-item" data-kgbuy="${x.id}" ${dis ? "disabled" : ""}>${n ? `<em class="mk-n">${n}</em>` : ""}<span class="mk-e">${FI(x.e)}</span><b>${esc(x.n)}</b><small>${x.price} บาท</small></button>`; }).join("")}</div></section></div>
      <div class="care-foot"><button type="button" class="btn" data-kg="close">ออกจากตลาด</button><button type="button" class="btn primary" data-kg="pay" ${MK.cart.length ? "" : "disabled"}>จ่ายเงิน ดูผล ›</button></div>`;
  }
  function marketResult() {
    const items = MK.cart.map((id) => GOODS[id]), has = (g, min = 1) => items.filter((x) => x.g === g && x.hp > 0).length >= min;
    let score = items.reduce((a, x) => a + x.hp, 0); const good = [], tips = [];
    if (has("veg", 2)) { score += 3; good.push("มีผักหลายอย่าง 🥬"); } else tips.push("เพิ่มผักอย่างน้อย 2 อย่าง ให้ผักเป็นครึ่งจาน");
    if (has("pro")) { score += 3; good.push("มีโปรตีนไขมันต่ำ (ปลา ไก่ ไข่ เต้าหู้)"); } else tips.push("เลือกปลา อกไก่ ไข่ หรือเต้าหู้ เป็นโปรตีนหลัก");
    if (items.some((x) => x.g === "carb" && x.hp > 0)) { score += 2; good.push("เลือกข้าวไม่ขัดสี"); } else tips.push("เปลี่ยนเป็นข้าวกล้อง/ข้าวเหนียวดำ แทนบะหมี่หรือขนมปังขาว");
    if (!items.some((x) => x.hp <= -3)) { score += 2; good.push("ไม่มีเครื่องดื่มหวานจัด"); }
    items.filter((x) => x.hp < 0).forEach((x) => tips.push(`${x.e} ${x.n}: ${x.why}${x.g === "drink" ? " → เปลี่ยนเป็นน้ำเปล่า/นมจืด" : x.g === "pro" ? " → เปลี่ยนเป็นปลาหรืออกไก่" : ""}`));
    const st = score >= 26 ? 3 : score >= 17 ? 2 : score >= 8 ? 1 : 0, spent = items.reduce((a, x) => a + x.price, 0), b = best("marketBest", Math.max(0, score));
    $("#kgBox").innerHTML = head("🧾 ผลการจ่ายตลาด", `จ่ายไป ${spent} บาท · ${items.length} ชิ้น`) + `
      <div class="fq-result">${stars(st)}<b class="fq-score">${Math.max(0, score)} คะแนนสุขภาพ</b><p>${["ลองใหม่นะคะ เลือกผักกับโปรตีนดี ๆ ให้มากขึ้น", "ใช้ได้ค่ะ ปรับอีกนิดจะดีมาก", "เก่งมากค่ะ ตะกร้านี้ดีต่อสุขภาพ", "สุดยอด! แม่ครัวสุขภาพตัวจริงค่ะ 🧺"][st]}</p><small>คะแนนดีที่สุด ${b}</small></div>
      <div class="mk-basket done">${items.map((x) => `<span class="mk-in ${x.hp > 0 ? "good" : x.hp < 0 ? "bad" : ""}" title="${esc(x.n)}">${FI(x.e)}</span>`).join("")}</div>
      ${good.length ? `<div class="fq-why ok"><b>👍 ดีแล้ว:</b> ${good.map(esc).join(" · ")}</div>` : ""}
      ${tips.length ? `<div class="fq-why no"><b>💡 น้องอ่อนหวานแนะนำ:</b><ul class="kg-tips">${tips.slice(0, 5).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      <div class="care-foot"><button type="button" class="btn" data-kg="close">กลับครัว</button><button type="button" class="btn primary" data-kg="market" autofocus>ไปตลาดอีกรอบ ↺</button></div>`;
  }

  /* =========================================================================================
     2) เกมจัดสำรับ — choose what to eat for one meal
     ========================================================================================= */
  const SCENES = [
    { t: "มื้อกลางวันวันทำงาน", meal: "l", cap: 650, ic: "☀️" }, { t: "มื้อเย็นกับครอบครัว", meal: "d", cap: 700, ic: "🌙" },
    { t: "มื้อเช้าก่อนไปทำนา", meal: "b", cap: 600, ic: "🌅" }, { t: "งานบุญที่วัด", meal: "l", cap: 700, ic: "🛕" },
  ];
  const PL = { sc: null, picks: [], cat: "ข้าว-แป้ง" };
  const DB = () => window.PreDMFood?.DB || [];
  const kind = (d) => ((d.flags || []).includes("rice") ? "rice" : (d.flags || []).includes("veg") && d.cat !== "เครื่องดื่ม" ? "veg" : d.pro >= 10 ? "pro" : d.cat === "เครื่องดื่ม" ? "drink" : "other");
  function plateStart() { PL.sc = pick(SCENES); PL.picks = []; PL.cat = "ข้าว-แป้ง"; modal(); plateDraw(); }
  function totals() { // nutrients summed + how many dishes of each kind (veg / rice / protein)
    return PL.picks.reduce((t, key) => { const d = DB().find((x) => x.key === key); if (!d) return t; ["kcal", "carb", "sugar", "na"].forEach((k) => (t[k] += d[k] || 0)); const k = kind(d); if (k === "veg") t.veg++; if (k === "rice") t.rice++; if ((d.flags || []).includes("raw")) t.raw = true; return t; },
      { kcal: 0, carb: 0, sugar: 0, na: 0, rice: 0, veg: 0, raw: false }); }
  function meter(label, v, max, unit) { const p = Math.min(100, (v / max) * 100); return `<div class="pl-m ${v > max ? "over" : ""}"><span>${label}</span><b>${Math.round(v)}<small>/${max} ${unit}</small></b><i><em style="width:${p}%"></em></i></div>`; }
  function plateDraw() {
    const t = totals(), cats = [...new Set(DB().map((d) => d.cat))], list = DB().filter((d) => d.cat === PL.cat);
    const proCount = PL.picks.filter((k) => kind(DB().find((x) => x.key === k) || {}) === "pro").length;
    const fill = (n, cap) => Math.min(1, n / cap);
    $("#kgBox").innerHTML = head("🍽️ เกมจัดสำรับ", `${PL.sc.ic} ${PL.sc.t} · ไม่เกิน ${PL.sc.cap} kcal`) + `
      <div class="pl-top">
        <div class="pl-plate" aria-label="จานสุขภาพ 2:1:1">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="#fff" stroke="#e6dccb" stroke-width="4"/>
            <path d="M60 60V8a52 52 0 0 0 0 104z" fill="#7cc79a" opacity="${0.2 + 0.8 * fill(t.veg, 2)}"/>
            <path d="M60 60V8a52 52 0 0 1 52 52z" fill="#f2c14e" opacity="${0.2 + 0.8 * fill(t.rice, 1)}"/>
            <path d="M60 60h52a52 52 0 0 1-52 52z" fill="#e8885a" opacity="${0.2 + 0.8 * fill(proCount, 1)}"/>
            <path d="M60 8v104M60 60h52" stroke="#fff" stroke-width="3"/>
            <text x="30" y="64" font-size="9" text-anchor="middle" fill="#1f5c3a">ผัก ${t.veg}/2</text><text x="86" y="40" font-size="9" text-anchor="middle" fill="#6b4a00">ข้าว ${t.rice}/1</text><text x="86" y="88" font-size="9" text-anchor="middle" fill="#6b2f12">โปรตีน ${proCount}/1</text></svg>
        </div>
        <div class="pl-meters">${meter("พลังงาน", t.kcal, PL.sc.cap, "kcal")}${meter("ข้าวแป้ง", t.carb, 75, "ก.")}${meter("ความเค็ม", t.na, 1200, "มก.")}${meter("น้ำตาล", t.sugar, 15, "ก.")}</div>
      </div>
      <div class="pl-picked">${PL.picks.length ? PL.picks.map((k, i) => { const d = DB().find((x) => x.key === k); return `<button type="button" class="pl-chip" data-kgdel="${i}" title="เอาออก">${FI(d.e, d.key, "fi-sm")} ${esc(d.n)} <i>✕</i></button>`; }).join("") : `<small>เลือกกับข้าวจากตู้ด้านล่าง ให้ได้ ผัก 2 ข้าว 1 โปรตีน 1</small>`}</div>
      <div class="fd-cats pl-cats">${cats.map((c) => `<button type="button" aria-pressed="${c === PL.cat}" data-kgcat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="pl-shelf">${list.map((d) => `<button type="button" class="cup-dish" data-kgadd="${d.key}" ${PL.picks.length >= 7 ? "disabled" : ""}><span class="cup-plate">${FI(d.e, d.key)}</span><b>${esc(d.n)}</b><small>${d.kcal} kcal</small></button>`).join("")}</div>
      <div class="care-foot"><button type="button" class="btn" data-kg="close">ออก</button><button type="button" class="btn primary" data-kg="serve" ${PL.picks.length ? "" : "disabled"}>เสิร์ฟสำรับ ดูผล ›</button></div>`;
  }
  function plateResult() {
    const t = totals(), proCount = PL.picks.filter((k) => kind(DB().find((x) => x.key === k) || {}) === "pro").length, good = [], tips = [];
    let pts = 0;
    if (t.veg >= 2) { pts += 2; good.push("ผักครึ่งจาน 🥬"); } else if (t.veg === 1) { pts += 1; tips.push("เพิ่มผักอีก 1 อย่าง เช่น ผักลวก ผักแนม"); } else tips.push("ยังไม่มีผักเลย เพิ่มผักสด/ผักลวกให้ได้ครึ่งจาน");
    if (t.rice === 1) { pts += 1; good.push("ข้าว 1 ส่วนพอดี"); } else if (t.rice === 0) tips.push("ใส่ข้าวหรือแป้ง 1 ส่วน เช่น ข้าวกล้อง ข้าวเหนียว 1 ปั้น"); else tips.push(`ข้าว/แป้ง ${t.rice} อย่าง มากไป เหลือ 1 อย่างพอ`);
    if (proCount >= 1) { pts += 1; good.push("มีโปรตีน"); } else tips.push("เพิ่มโปรตีน เช่น ลาบไก่ ปลาเผา ไข่ต้ม");
    if (t.carb <= 75) pts += 1; else tips.push(`ข้าวแป้ง ${Math.round(t.carb)} ก. เกิน 75 ก. ต่อมื้อ`);
    if (t.na <= 1200) pts += 1; else tips.push(`เค็มไป (${Math.round(t.na)} มก.) ลดปลาร้า/น้ำจิ้ม และไม่ซดน้ำแกง`);
    if (t.sugar <= 15) pts += 1; else tips.push(`น้ำตาล ${Math.round(t.sugar)} ก. มากไป เปลี่ยนเครื่องดื่มเป็นน้ำเปล่า`);
    if (t.kcal <= PL.sc.cap) pts += 1; else tips.push(`พลังงาน ${Math.round(t.kcal)} kcal เกินเป้า ${PL.sc.cap} kcal`);
    if (t.raw) { pts = Math.min(pts, 3); tips.unshift("มีเมนูดิบ เสี่ยงพยาธิใบไม้ตับ เลือกแบบสุกแทนนะคะ"); }
    const st = pts >= 8 ? 3 : pts >= 6 ? 2 : pts >= 4 ? 1 : 0, b = best("plateBest", pts), meals = { b: "มื้อเช้า", l: "มื้อกลางวัน", d: "มื้อเย็น" };
    $("#kgBox").innerHTML = head("🍽️ ผลการจัดสำรับ", `${PL.sc.ic} ${PL.sc.t}`) + `
      <div class="fq-result">${stars(st)}<b class="fq-score">${pts} / 9 คะแนน</b><p>${["ลองจัดใหม่นะคะ ผักครึ่งจาน ข้าว 1 ส่วน โปรตีน 1 ส่วน", "ใกล้แล้วค่ะ ปรับอีกนิด", "สำรับนี้ดีค่ะ 👍", "สำรับสุขภาพสมบูรณ์แบบ! 🌟"][st]}</p><small>${Math.round(t.kcal)} kcal · ข้าวแป้ง ${Math.round(t.carb)} ก. · เค็ม ${Math.round(t.na)} มก. · น้ำตาล ${Math.round(t.sugar)} ก. · คะแนนดีที่สุด ${b}/9</small></div>
      <div class="pl-picked done">${PL.picks.map((k) => { const d = DB().find((x) => x.key === k); return `<span class="pl-chip">${FI(d.e, d.key, "fi-sm")} ${esc(d.n)}</span>`; }).join("")}</div>
      ${good.length ? `<div class="fq-why ok"><b>👍 ดีแล้ว:</b> ${good.map(esc).join(" · ")}</div>` : ""}
      ${tips.length ? `<div class="fq-why no"><b>💡 น้องอ่อนหวานแนะนำ:</b><ul class="kg-tips">${tips.slice(0, 5).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      <div class="care-foot"><button type="button" class="btn" data-kg="plate">จัดใหม่ ↺</button>${window.PreDMFood?.add ? `<button type="button" class="btn primary" data-kg="save">วางลงพาข้าว${meals[PL.sc.meal]}วันนี้</button>` : ""}</div>`;
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const t = (s) => e.target.closest(s);
    if (t("[data-kgbuy]")) { const id = +t("[data-kgbuy]").dataset.kgbuy; const left = MK.budget - MK.cart.reduce((a, i) => a + GOODS[i].price, 0); if (GOODS[id].price <= left && MK.cart.length < MK.max) { MK.cart.push(id); window.PreDMMusic?.sfx("pick"); } return marketDraw(); }
    if (t("[data-kgstall]")) { MK.stall = t("[data-kgstall]").dataset.kgstall; return marketDraw(); }
    if (t("[data-kgout]")) { MK.cart.splice(+t("[data-kgout]").dataset.kgout, 1); return marketDraw(); }
    if (t("[data-kgadd]")) { PL.picks.push(t("[data-kgadd]").dataset.kgadd); window.PreDMMusic?.sfx("pick"); return plateDraw(); }
    if (t("[data-kgdel]")) { PL.picks.splice(+t("[data-kgdel]").dataset.kgdel, 1); return plateDraw(); }
    if (t("[data-kgcat]")) { PL.cat = t("[data-kgcat]").dataset.kgcat; return plateDraw(); }
    const b = t("[data-kg]"); if (!b) return;
    const a = b.dataset.kg;
    if (a === "close") return close();
    if (a === "pay") { window.PreDMMusic?.sfx("win"); return marketResult(); }
    if (a === "market") return marketStart();
    if (a === "serve") { window.PreDMMusic?.sfx("win"); return plateResult(); }
    if (a === "plate") return plateStart();
    if (a === "save") { PL.picks.forEach((k) => window.PreDMFood.add(k, 1, PL.sc.meal)); A()?.toast(`วางสำรับลงพาข้าวแล้ว ${PL.picks.length} จาน`); close(); if (location.hash !== "#food") location.hash = "food"; }
  }
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-kgame]"); if (!g) return;
    e.preventDefault(); g.dataset.kgame === "market" ? marketStart() : plateStart();
  });
  window.PreDMKitchenGames = { market: marketStart, plate: plateStart, kind, scenes: SCENES,
    plateResultFor(picks, sc) { PL.sc = sc || pick(SCENES); PL.picks = picks.slice(); modal(); plateResult(); } };
})();
