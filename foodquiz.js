/* Pre-DM Smart Hub — "เกมตู้กับข้าวทายใจ": a nutrition-knowledge quiz for people at risk of diabetes.
   8 questions per round: 5 from a fixed bank + 3 "which dish has less sugar / salt / carbs?" built from the food database.
   น้องอ่อนหวาน explains every answer. Best score is kept in the store ("foodQuizBest").
   Also sets the cozy-kitchen mood class on <body> while the food page is open. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const A = () => window.PreDM;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mascot = () => (window.PreDMMascot ? PreDMMascot.svg() : "💗");

  // fixed bank: [question, [choices], index of correct, explanation, picture (emoji scene)]
  const BANK = [
    ["ข้าวเหนียว 1 ปั้น (ขนาดกำปั้น) มีแป้งพอ ๆ กับข้าวสวยกี่ทัพพี?", ["ครึ่งทัพพี", "ประมาณ 2 ทัพพี", "5 ทัพพี"], 1, "ข้าวเหนียว 1 ปั้นมีคาร์บราว 34 กรัม ข้าวสวย 1 ทัพพีราว 18 กรัม จึงเท่ากับข้าวสวยประมาณ 2 ทัพพี", "🍙 = 🍚 🍚"],
    ["“จานสุขภาพ 2:1:1” แบ่งจานอย่างไร?", ["ข้าว 2 ส่วน ผัก 1 ส่วน เนื้อ 1 ส่วน", "ผัก 2 ส่วน ข้าว/แป้ง 1 ส่วน โปรตีน 1 ส่วน", "เนื้อ 2 ส่วน ข้าว 1 ส่วน ผลไม้ 1 ส่วน"], 1, "ผักครึ่งจาน ข้าวหรือแป้งหนึ่งในสี่ และโปรตีนหนึ่งในสี่ ช่วยคุมน้ำตาลและอิ่มนาน", "🥬🥦 🍚 🍗"],
    ["ทำไมไม่ควรกินก้อยปลาดิบหรือปลาส้มดิบ?", ["ทำให้อ้วน", "เสี่ยงพยาธิใบไม้ตับ ซึ่งเป็นสาเหตุของมะเร็งท่อน้ำดี", "ทำให้ความดันต่ำ"], 1, "ปลาน้ำจืดเกล็ดขาวดิบหรือสุก ๆ ดิบ ๆ อาจมีพยาธิใบไม้ตับ ควรกินแบบปรุงสุกเสมอ", "🐟 🚫 · 🔥🐟 ✅"],
    ["ชาเย็น 1 แก้วมีน้ำตาลประมาณกี่ช้อนชา?", ["1–2 ช้อนชา", "ประมาณ 9 ช้อนชา", "ไม่มีน้ำตาล"], 1, "ชาเย็นมีน้ำตาลราว 36 กรัม หรือประมาณ 9 ช้อนชา เกินที่แนะนำทั้งวัน สั่งหวาน 0–25% ดีกว่า", "🧋 = 🥄 × 9"],
    ["น้ำตาลที่แนะนำไม่ควรเกินวันละเท่าไร?", ["6 ช้อนชา", "15 ช้อนชา", "กินได้ไม่จำกัด"], 0, "แนะนำไม่เกิน 6 ช้อนชา (24 กรัม) ต่อวัน รวมน้ำตาลในเครื่องดื่มและขนมด้วย", "🥄🥄🥄🥄🥄🥄"],
    ["โซเดียมไม่ควรเกินวันละเท่าไร?", ["500 มิลลิกรัม", "2,000 มิลลิกรัม (ประมาณเกลือ 1 ช้อนชา)", "10,000 มิลลิกรัม"], 1, "โซเดียมไม่เกิน 2,000 มก./วัน ช่วยลดความเสี่ยงความดันสูงซึ่งมักมาคู่กับเบาหวาน", "🧂 ⚖️"],
    ["ปลาร้าต้องระวังเรื่องอะไรมากที่สุด?", ["น้ำตาลสูง", "โซเดียมสูงมาก", "ไม่มีโปรตีน"], 1, "ปลาร้าเค็มจัด ขอใส่น้อย ๆ ไม่ซดน้ำแกงหรือน้ำตำ และกินคู่กับผักเยอะ ๆ", "🫙🐟 🧂🧂"],
    ["ผลไม้ข้อไหนน้ำตาลต่ำ เหมาะกับกลุ่มเสี่ยงเบาหวาน?", ["มะม่วงสุก", "ฝรั่ง", "ทุเรียน"], 1, "ฝรั่งน้ำตาลต่ำและใยอาหารสูง ส่วนผลไม้หวานจัดควรกินครั้งละน้อย", "🥭 🍐 🍈"],
    ["เดินเบา ๆ 10–15 นาทีหลังกินข้าว ช่วยอะไร?", ["ทำให้อาหารไม่ย่อย", "ช่วยลดน้ำตาลในเลือดหลังอาหาร", "ไม่มีผลอะไร"], 1, "กล้ามเนื้อที่ขยับจะดึงน้ำตาลไปใช้ ช่วยให้น้ำตาลหลังอาหารไม่พุ่งสูง", "🍽️ ➜ 🚶"],
    ["ข้าวแบบไหนดีกว่าสำหรับกลุ่มเสี่ยงเบาหวาน?", ["ข้าวเหนียวขาว", "ข้าวกล้องหรือข้าวเหนียวดำ", "ข้าวผัดใส่น้ำมันเยอะ"], 1, "ข้าวกล้องและข้าวเหนียวดำมีใยอาหารมากกว่า น้ำตาลขึ้นช้ากว่า แต่ยังต้องคุมปริมาณ", "🍚 🍙 🌾"],
    ["กินอะไรก่อนในมื้อ ช่วยให้น้ำตาลขึ้นช้า?", ["ข้าวก่อน", "ผักและกับข้าวก่อน แล้วค่อยกินข้าว", "ของหวานก่อน"], 1, "กินผักและโปรตีนก่อนข้าว ช่วยชะลอการดูดซึมน้ำตาล", "🥬 ➜ 🍗 ➜ 🍚"],
    ["สั่งตำซั่ว (มีขนมจีนแล้ว) ควรทำอย่างไร?", ["กินข้าวเหนียวเพิ่มอีก 2 ปั้น", "ไม่ต้องกินข้าวเหนียวเพิ่ม", "สั่งน้ำหวานด้วย"], 1, "ขนมจีนนับเป็นข้าวแป้งแล้ว กินข้าวเหนียวเพิ่มจะได้แป้งเกิน", "🥗🍜 + 🍙 ?"],
    ["น้ำอัดลม 1 กระป๋อง มีน้ำตาลประมาณกี่ช้อนชา?", ["ประมาณ 9 ช้อนชา", "1 ช้อนชา", "ไม่มีน้ำตาล"], 0, "ราว 35 กรัม หรือ 9 ช้อนชา เปลี่ยนเป็นน้ำเปล่าหรือโซดาจะดีกว่ามาก", "🥤 = 🥄 × 9"],
    ["ถ้ากินยาลดน้ำตาล แล้วดื่มเหล้าตอนท้องว่าง เสี่ยงอะไร?", ["น้ำตาลในเลือดต่ำ", "น้ำหนักขึ้นทันที", "ไม่มีความเสี่ยง"], 0, "แอลกอฮอล์ร่วมกับยาลดน้ำตาลทำให้น้ำตาลต่ำได้ ควรงดหรือดื่มน้อยและไม่ดื่มตอนท้องว่าง", "💊 + 🥃 ⚠️"],
    ["สั่งส้มตำแบบไหนดีที่สุด?", ["หวานจัด ปลาร้าเยอะ", "ไม่ใส่น้ำตาล ปลาร้าน้อย กินกับผักเยอะ ๆ", "ใส่ผงชูรสเพิ่ม"], 1, "ลดน้ำตาลและความเค็ม และเพิ่มผักแนม จะได้ส้มตำที่อร่อยและดีต่อสุขภาพ", "🥗 🌶️ 🥒"],
    ["จริงหรือไม่: “ข้าวเหนียวดำไม่มีแป้ง กินได้ไม่จำกัด”", ["จริง", "ไม่จริง"], 1, "ข้าวเหนียวดำยังเป็นแป้ง มีพลังงานพอ ๆ กับข้าวเหนียวขาว แค่ใยอาหารมากกว่า", "🍙 ⚫ ♾️ ?"],
    ["จริงหรือไม่: “ผลไม้เป็นของธรรมชาติ กินเท่าไรก็ได้”", ["จริง", "ไม่จริง"], 1, "ผลไม้มีน้ำตาล ควรกินครั้งละประมาณ 1 กำมือ และเลือกชนิดที่หวานน้อย", "🍉🍇🍍 ♾️ ?"],
    ["น้ำแกงหรือต้มแซ่บ ควรกินอย่างไร?", ["ซดให้หมดถ้วย", "กินเนื้อและผัก ไม่ซดน้ำแกงจนหมด", "เติมน้ำปลาเพิ่ม"], 1, "เกลือและน้ำปลาส่วนใหญ่อยู่ในน้ำแกง การไม่ซดจนหมดช่วยลดโซเดียมได้มาก", "🍲 🥣"],
    ["ข้อใดเป็นของว่างที่ดีกว่า?", ["ข้าวหลาม 1 กระบอก", "ฝรั่งครึ่งผล", "ชานมไข่มุก"], 1, "ฝรั่งให้พลังงานต่ำ ใยอาหารสูง ส่วนข้าวหลามและชานมมีทั้งน้ำตาลและแป้งสูง", "🎋 🍐 🧋"],
    ["ควรดื่มน้ำเปล่าวันละประมาณกี่แก้ว?", ["1 แก้ว", "6–8 แก้ว", "20 แก้ว"], 1, "ดื่มน้ำเปล่าวันละ 6–8 แก้ว แทนเครื่องดื่มหวาน", "💧 × 8"],
  ];
  const NUT = { sugar: ["น้ำตาล", "ก.", "🍬 น้อยกว่า?"], na: ["โซเดียม (ความเค็ม)", "มก.", "🧂 น้อยกว่า?"], carb: ["ข้าวแป้ง (คาร์บ)", "ก.", "🍚 น้อยกว่า?"] };
  function generated(n) {
    const DB = window.PreDMFood?.DB || [], out = [], tries = shuffle(DB);
    for (let i = 0; i < tries.length && out.length < n; i++) {
      const a = tries[i], k = ["sugar", "na", "carb"][out.length % 3], gap = k === "na" ? 400 : k === "sugar" ? 6 : 15;
      const b = shuffle(DB).find((x) => x.key !== a.key && x.cat === a.cat && Math.abs(x[k] - a[k]) >= gap) || shuffle(DB).find((x) => x.key !== a.key && Math.abs(x[k] - a[k]) >= gap * 1.5);
      if (!b || out.some((q) => q.keys.includes(a.key) || q.keys.includes(b.key))) continue;
      const pair = shuffle([a, b]), low = pair[0][k] < pair[1][k] ? 0 : 1;
      out.push({ keys: [a.key, b.key], q: `เมนูไหนมี${NUT[k][0]} น้อยกว่ากัน?`, dish: true, choices: pair.map((d) => d.n), emo: pair.map((d) => d.e), pic: NUT[k][2], ok: low,
        why: `${pair[low].n} ${NUT[k][0]} ~${Math.round(pair[low][k])} ${NUT[k][1]} ส่วน ${pair[1 - low].n} ~${Math.round(pair[1 - low][k])} ${NUT[k][1]} (ต่อ 1 ที่) ${pair[low].tip ? "· " + pair[low].tip : ""}` });
    }
    return out;
  }
  const Q = { list: [], i: 0, score: 0, picked: null };
  function start() {
    const fixed = shuffle(BANK).slice(0, 5).map(([q, choices, ok, why, pic]) => ({ q, choices, ok, why, pic }));
    Q.list = shuffle([...fixed, ...generated(3)]); Q.i = 0; Q.score = 0; Q.picked = null;
    open(); draw();
  }
  function open() {
    if (!$("#fqModal")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="fq-modal" id="fqModal" role="dialog" aria-modal="true" aria-labelledby="fqTitle" hidden><div class="fq-box" id="fqBox"></div></div>`);
      $("#fqModal").addEventListener("click", (e) => { if (e.target.id === "fqModal") close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#fqModal").hidden) close(); });
      $("#fqModal").addEventListener("click", onClick);
    }
    $("#fqModal").hidden = false; document.body.classList.add("care-open");
  }
  function close() { $("#fqModal").hidden = true; document.body.classList.remove("care-open"); }
  function draw() {
    const box = $("#fqBox");
    if (Q.i >= Q.list.length) return result();
    const it = Q.list[Q.i], answered = Q.picked != null, right = answered && Q.picked === it.ok;
    box.innerHTML = `<div class="fq-head"><span class="fq-av">${mascot()}</span><div><h2 id="fqTitle">เกมตู้กับข้าวทายใจ</h2><small>ข้อ ${Q.i + 1} / ${Q.list.length} · ถูก ${Q.score} ข้อ</small></div><button type="button" class="care-x" data-fq="close" aria-label="ปิดเกม">✕</button></div>
      <div class="fq-prog" aria-hidden="true"><i style="width:${(Q.i / Q.list.length) * 100}%"></i></div>
      ${it.dish ? "" : `<div class="fq-pic" role="img" aria-label="ภาพประกอบคำถาม"><span>${esc(it.pic || "🍽️")}</span></div>`}
      <p class="fq-q">${esc(it.q)}</p>
      <div class="fq-choices${it.dish ? " dish" : ""}" role="group" aria-label="ตัวเลือก">${it.choices.map((c, k) => `<button type="button" class="fq-c${answered ? (k === it.ok ? " ok" : k === Q.picked ? " no" : "") : ""}" data-fqc="${k}" ${answered ? "disabled" : ""}>${it.dish ? `<span class="fq-plate" aria-hidden="true">${it.emo[k]}</span>` : ""}<span>${esc(c)}</span></button>`).join("")}</div>
      ${answered ? `<div class="fq-why ${right ? "ok" : "no"}" role="status"><b>${right ? "ถูกต้องค่ะ! 🎉" : "ยังไม่ใช่นะคะ 😊"}</b> ${esc(it.why)}</div>
        <div class="care-foot"><button type="button" class="btn primary" data-fq="next" autofocus>${Q.i === Q.list.length - 1 ? "ดูผลคะแนน" : "ข้อต่อไป ›"}</button></div>` : ""}`;
    (box.querySelector('[data-fq="next"]') || box.querySelector(".fq-c"))?.focus();
  }
  function result() {
    const n = Q.list.length, stars = Q.score >= n ? 3 : Q.score >= n - 2 ? 2 : Q.score >= n / 2 ? 1 : 0;
    const best = Math.max(Q.score, A()?.store.get("foodQuizBest", 0) || 0); A()?.store.set("foodQuizBest", best);
    const msg = ["มาเรียนรู้ไปด้วยกันนะคะ ลองเล่นอีกรอบ คำถามจะเปลี่ยนใหม่ค่ะ", "เริ่มต้นดีแล้วค่ะ อีกนิดเดียว!", "เก่งมากค่ะ รู้เรื่องการกินดีเลย", "สุดยอด! เป็นเชฟสุขภาพตัวจริงค่ะ 👩‍🍳"][stars];
    $("#fqBox").innerHTML = `<div class="fq-head"><span class="fq-av">${mascot()}</span><div><h2 id="fqTitle">ผลคะแนน</h2><small>เกมตู้กับข้าวทายใจ</small></div><button type="button" class="care-x" data-fq="close" aria-label="ปิดเกม">✕</button></div>
      <div class="fq-result"><div class="fq-stars" aria-label="ได้ ${stars} ดาว">${[0, 1, 2].map((k) => `<span class="${k < stars ? "on" : ""}">★</span>`).join("")}</div>
        <b class="fq-score">${Q.score} / ${n}</b><p>${msg}</p><small>คะแนนดีที่สุดของคุณ ${best} / ${n}</small></div>
      <div class="care-foot"><button type="button" class="btn" data-fq="close">กลับครัว</button><button type="button" class="btn primary" data-fq="again" autofocus>เล่นอีกรอบ ↺</button></div>`;
    $("#fqBox [autofocus]")?.focus();
    if (stars === 3) A()?.toast("ได้ 3 ดาว! เชฟสุขภาพตัวจริง 🌟");
  }
  function onClick(e) {
    const c = e.target.closest("[data-fqc]"); if (c && Q.picked == null) { Q.picked = +c.dataset.fqc; if (Q.picked === Q.list[Q.i].ok) Q.score++; return draw(); }
    const b = e.target.closest("[data-fq]"); if (!b) return;
    if (b.dataset.fq === "close") return close();
    if (b.dataset.fq === "next") { Q.i++; Q.picked = null; return draw(); }
    if (b.dataset.fq === "again") return start();
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-foodquiz]")) { e.preventDefault(); if (location.hash !== "#food" && e.target.closest("[data-foodquiz]").dataset.foodquiz === "go") location.hash = "food"; start(); } });
  function paintBest() { const el = $("#fqBest"); if (el) { const b = A()?.store.get("foodQuizBest", 0) || 0; el.textContent = b ? `คะแนนดีที่สุด ${b}/8` : "8 ข้อ · มีเฉลยทุกข้อ"; } }
  function mood(v) { document.body.classList.toggle("in-kitchen", v === "food"); if (v === "food") { const m = $("#khMascot"); if (m && !m.innerHTML) m.innerHTML = window.PreDMMascot ? PreDMMascot.svg({ wave: true }) : ""; paintBest(); } }
  window.addEventListener("predm:view", (e) => mood(e.detail));
  if ($("#view-food") && !$("#view-food").hidden) mood("food"); // the first route ran before this script loaded
  window.PreDMFoodQuiz = { start };
})();
