/* Pre-DM Smart Hub — "AI จัดตารางฝึกให้": an on-device recommender (no data leaves the device).
   It reads (1) a short interest quiz and (2) how the person actually uses the app (exercise log of the last 4 weeks,
   favourite moves, game / AR scores, the latest risk level), then builds a 7-day plan that meets the ADA / ACSM targets
   (aerobic ~150 min/week, strength 2 days, balance + flexibility 2–3 days) with the moves the person is most likely to enjoy.
   Every pick shows WHY it was chosen. The plan re-ranks itself as new sessions are logged. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const A = () => window.PreDM;
  const KEY = "aiPlanPrefs";
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

  /* ---------------- the interest quiz ---------------- */
  const Q = [
    { k: "likes", t: "ชอบออกกำลังกายแบบไหน (เลือกได้หลายข้อ)", multi: true, opts: [["music", "🎵 มีเพลง เต้น ๆ"], ["game", "🎮 เล่นเกมกล้อง AI"], ["local", "🌾 สไตล์อีสาน / ไทย"], ["strength", "💪 สร้างกล้ามเนื้อ"], ["relax", "🧘 ยืดเหยียด ผ่อนคลาย"], ["walk", "🚶 เดิน / ปั่นจักรยาน"], ["seated", "🪑 ท่านั่งทำได้"]] },
    { k: "time", t: "มีเวลาว่างวันละกี่นาที", opts: [[10, "10 นาที"], [20, "20 นาที"], [30, "30 นาที"], [45, "45 นาที"]] },
    { k: "goal", t: "เป้าหมายหลักของคุณ", opts: [["sugar", "🩸 คุมน้ำตาล / ลดน้ำหนัก"], ["strong", "💪 แข็งแรงขึ้น"], ["fall", "🦩 ทรงตัวดี กันหกล้ม"], ["calm", "😌 ผ่อนคลาย ลดเครียด"]] },
    { k: "limits", t: "มีข้อจำกัดไหม (เลือกได้หลายข้อ)", multi: true, opts: [["knee", "🦵 ปวดเข่า"], ["back", "🔙 ปวดหลัง"], ["balance", "⚠️ ทรงตัวไม่ค่อยดี"], ["none", "✅ ไม่มี"]] },
    { k: "days", t: "อยากฝึกกี่วันต่อสัปดาห์", opts: [[3, "3 วัน"], [5, "5 วัน"], [6, "6 วัน"], [7, "ทุกวัน"]] },
  ];
  const prefs = () => A()?.store.get(KEY, null);

  /* ---------------- everything the system can offer, with tags ---------------- */
  const KNEE = /สควอท|นั่งแล้วลุก|บันได|ฟักลาบ|ซ้อนกุ้ง|ดำนา|งอเข่าแล้วเหยียด|ย่ำเท้า/;
  const BACK = /ก้ม|บิดตัว|ยกสะโพก|ดำนา|เหวี่ยงแห|แหย่/;
  const BAL_RISK = /ยืนขาเดียว|เดินต่อเท้าถอยหลัง|เดินถอยหลัง|เลขแปด/;
  function catalog() {
    const P = A()?.PROGRAMS || {}, out = [];
    Object.entries(P).forEach(([cat, prog]) => (prog.list || []).forEach((e, idx) => {
      const type = e.type || (["aerobic", "strength", "flex", "balance"].includes(cat) ? cat : "flex"), txt = e.n + " " + (e.d || "");
      const tags = new Set([type]);
      if (cat === "isan" || cat === "thai" || cat === "pakhaoma") tags.add("local");
      if (cat === "isan") tags.add("music");
      if (cat === "aerobic" && /เดิน|ปั่น/.test(e.n)) tags.add("walk");
      if (type === "flex") tags.add("relax");
      if (type === "strength") tags.add("strength");
      if (/นั่ง|เก้าอี้/.test(txt) && !/ลุกขึ้น/.test(e.n)) tags.add("seated");
      if (e.track) tags.add("camera");
      out.push({ id: `p:${cat}:${idx}`, kind: "move", cat, idx, n: e.n, type, tags, knee: KNEE.test(e.n), back: BACK.test(e.n), balRisk: BAL_RISK.test(e.n) });
    }));
    const G = window.PreDMTrack?.games || {};
    Object.entries(G).forEach(([id, g]) => {
      const type = g.type === "game" ? (/ขา|หัวใจ/.test(g.part) ? "aerobic" : "flex") : g.type;
      out.push({ id: `g:${id}`, kind: "game", game: id, n: g.name, type, tags: new Set(["game", "camera", type, ...(/ทรงตัว/.test(g.part) ? ["balance"] : [])]), knee: /squat|kick|jack|march/.test(id), back: false, balRisk: id === "balance" || id === "kick", min: 1 });
    });
    [["squat", "สควอท (AR นับท่าให้)", "strength"], ["arm", "ยกแขนเหนือศีรษะ (AR)", "strength"], ["march", "ย่ำเท้ายกเข่า (AR)", "aerobic"], ["balance", "ยืนขาเดียว (AR)", "balance"], ["fist", "กำ-แบมือ (AR)", "flex"]]
      .forEach(([id, n, type]) => out.push({ id: `a:${id}`, kind: "ar", ex: id, n, type, tags: new Set(["game", "camera", type, ...(id === "fist" ? ["seated"] : [])]), knee: id === "squat" || id === "march", back: false, balRisk: id === "balance", min: 3 }));
    if (P.isan?.video) out.push({ id: "v:isan", kind: "video", n: "เต้นตามเพลงหมอลำ (Studio Lam Plearn)", type: "aerobic", tags: new Set(["music", "local", "aerobic"]), knee: false, back: false, balRisk: false, min: P.isan.video.min || 15 });
    return out;
  }

  /* ---------------- what the person actually does ---------------- */
  function usage() {
    const logs = A()?.store.get("logs", []) || [], since = iso(new Date(Date.now() - 28 * 864e5)), wk = iso(new Date(Date.now() - 6 * 864e5));
    const recent = logs.filter((l) => l.date >= since), week = logs.filter((l) => l.date >= wk);
    const byType = {}, weekType = {}, count = {}, days = new Set();
    recent.forEach((l) => { byType[l.type] = (byType[l.type] || 0) + (l.minutes || 0); const key = String(l.name || "").replace(/ \(AR\)| · (Auto|Manual)$/g, ""); count[key] = (count[key] || 0) + 1; });
    week.forEach((l) => { weekType[l.type] = (weekType[l.type] || 0) + (l.minutes || 0); days.add(l.date + l.type); });
    const strengthDays = new Set(week.filter((l) => l.type === "strength").map((l) => l.date)).size;
    const gameScores = A()?.store.get("bestScores", {}) || {}, arBest = A()?.store.get("arBest", {}) || {};
    const risk = (A()?.store.get("riskHistory", []) || [])[0];
    return { recent, week, byType, weekType, count, strengthDays, gameScores, arBest, risk, total28: recent.reduce((t, l) => t + (l.minutes || 0), 0) };
  }

  /* ---------------- scoring: interest × need × history × safety ---------------- */
  function rank(cands, P, U, rnd) {
    const likes = new Set(P.likes || []), lim = new Set(P.limits || []);
    const need = { aerobic: Math.max(0, 150 - (U.weekType.aerobic || 0)) / 150, strength: U.strengthDays >= 2 ? 0 : 1, balance: (U.weekType.balance || 0) >= 20 ? 0.2 : 1, flex: (U.weekType.flex || 0) >= 20 ? 0.2 : 0.8, game: 0 };
    const goalBoost = { sugar: { aerobic: 1.2, strength: 0.8 }, strong: { strength: 1.3 }, fall: { balance: 1.4, strength: 0.6 }, calm: { flex: 1.3 } }[P.goal] || {};
    return cands.map((c) => {
      let s = 1 + rnd() * 0.6; const why = [];
      const hits = [...likes].filter((t) => c.tags.has(t));
      if (hits.length) { s += 2 * hits.length; why.push({ music: "คุณชอบออกกำลังกายกับเพลง", game: "คุณชอบเล่นเกมกล้อง AI", local: "คุณชอบสไตล์อีสาน/ไทย", strength: "ตรงกับที่อยากสร้างกล้ามเนื้อ", relax: "คุณชอบยืดเหยียดผ่อนคลาย", walk: "คุณชอบเดิน/ปั่น", seated: "ทำแบบนั่งได้" }[hits[0]]); }
      if ((need[c.type] || 0) > 0.5) { s += 2 * need[c.type]; why.push({ aerobic: "สัปดาห์นี้แอโรบิกยังไม่ถึง 150 นาที", strength: "สัปดาห์นี้ยังฝึกเสริมแรงไม่ครบ 2 วัน", balance: "ช่วยการทรงตัว (ยังฝึกน้อย)", flex: "ยืดเหยียดช่วยลดตึงกล้ามเนื้อ" }[c.type]); }
      if (goalBoost[c.type]) { s += goalBoost[c.type]; if (!why.length) why.push({ sugar: "ช่วยคุมน้ำตาล", strong: "ช่วยให้แข็งแรงขึ้น", fall: "ช่วยกันหกล้ม", calm: "ช่วยผ่อนคลาย" }[P.goal]); }
      const played = U.count[c.n.replace(/ \(AR.*\)$/, "")] || (c.kind === "game" && U.gameScores[c.game] ? 2 : 0) || (c.kind === "ar" && U.arBest[c.ex] ? 2 : 0);
      if (played >= 2) { s += 1.5; why.push(c.kind === "game" ? `คุณเล่นแล้วทำคะแนนได้ดี${U.gameScores[c.game] ? ` (สูงสุด ${U.gameScores[c.game]})` : ""}` : "คุณทำท่านี้บ่อย"); }
      else if (!played && hits.length) { s += 0.6; why.push("ลองท่าใหม่ที่น่าจะชอบ"); }
      // safety first
      if (lim.has("knee") && c.knee) s -= 6;
      if (lim.has("back") && c.back) s -= 6;
      if (lim.has("balance") && c.balRisk) s -= 4;
      if (lim.has("knee") && c.tags.has("seated")) { s += 1; why.push("เหมาะกับคนปวดเข่า"); }
      if ((U.risk?.cls === "high" || U.risk?.level?.includes?.("สูง")) && c.kind === "game" && c.type === "aerobic") s -= 0.5;
      return { ...c, s, why: why.slice(0, 2) };
    }).sort((a, b) => b.s - a.s);
  }

  /* ---------------- the week ---------------- */
  // which kinds of training each day gets, depending on how many days a week the person wants to train
  const LAYOUT = {
    3: ["aerobic strength flex", "", "aerobic balance flex", "", "aerobic strength balance", "", ""],
    5: ["aerobic strength flex", "aerobic balance", "aerobic flex", "aerobic strength balance", "aerobic flex", "", ""],
    6: ["aerobic strength flex", "aerobic balance", "aerobic flex", "aerobic strength balance", "aerobic flex", "aerobic balance flex", ""],
    7: ["aerobic strength flex", "aerobic balance", "aerobic flex", "aerobic strength balance", "aerobic flex", "aerobic balance flex", "flex balance"],
  };
  function build(seed) {
    const P = prefs(); if (!P) return null;
    let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
    const U = usage(), ranked = rank(catalog(), P, U, rnd), used = {};
    const today = new Date(), start = new Date(today); // plan starts today
    const lay = LAYOUT[P.days] || LAYOUT[5];
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + d * 864e5), slots = lay[d] ? lay[d].split(" ") : [];
      if (!slots.length) { days.push({ date: iso(date), dow: date.getDay(), rest: true, items: [] }); continue; }
      const items = [];
      slots.forEach((type) => {
        const want = type === "aerobic" ? 1 : type === "flex" ? 2 : 2;
        const pool = ranked.filter((c) => c.type === type && c.s > 0 && !items.some((x) => x.id === c.id));
        pool.sort((a, b) => (b.s - (used[b.id] || 0) * 1.2) - (a.s - (used[a.id] || 0) * 1.2)); // spread picks across the week
        pool.slice(0, want).forEach((c) => { items.push(c); used[c.id] = (used[c.id] || 0) + 1; });
      });
      days.push({ date: iso(date), dow: date.getDay(), rest: false, items, min: P.time });
    }
    return { P, U, days, made: new Date().toISOString() };
  }

  /* ---------------- UI ---------------- */
  let plan = null, seed = 1, editing = false, answers = {};
  function modal() {
    if (!$("#apModal")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="fq-modal" id="apModal" role="dialog" aria-modal="true" aria-labelledby="apTitle" hidden><div class="fq-box ap-box" id="apBox"></div></div>`);
      $("#apModal").addEventListener("click", onClick);
    }
    $("#apModal").hidden = false; document.body.classList.add("care-open");
  }
  function close() { $("#apModal").hidden = true; document.body.classList.remove("care-open"); }
  const head = (sub) => `<div class="fq-head"><span class="fq-av">🤖</span><div><h2 id="apTitle">AI จัดตารางฝึกให้</h2><small>${sub}</small></div><button type="button" class="care-x" data-ap="close" aria-label="ปิด">✕</button></div>`;
  function open() { modal(); seed = 1; if (!prefs() || editing) quiz(); else show(); }
  function quiz() {
    const P = prefs() || {}; answers = { likes: P.likes || [], time: P.time || 20, goal: P.goal || "sugar", limits: P.limits || [], days: P.days || 5 };
    drawQuiz();
  }
  function drawQuiz() {
    $("#apBox").innerHTML = head("ตอบ 5 ข้อสั้น ๆ แล้ว AI จะจัดท่าให้ตรงใจ · ประมวลผลในเครื่อง ไม่ส่งข้อมูลออก") + `<div class="ap-quiz">${Q.map((q) => `<fieldset class="ap-q"><legend>${q.t}</legend><div class="ap-opts">${q.opts.map(([v, l]) => {
      const on = q.multi ? (answers[q.k] || []).includes(v) : answers[q.k] === v;
      return `<button type="button" class="ap-opt" aria-pressed="${on}" data-q="${q.k}" data-v="${v}" data-multi="${q.multi ? 1 : 0}">${l}</button>`; }).join("")}</div></fieldset>`).join("")}</div>
      <div class="care-foot"><button type="button" class="btn" data-ap="close">ไว้ก่อน</button><button type="button" class="btn primary" data-ap="make">🤖 ให้ AI จัดตารางเลย</button></div>`;
  }
  const typeName = (t) => ({ aerobic: "แอโรบิก", strength: "เสริมแรง", flex: "ยืดเหยียด", balance: "ทรงตัว" }[t] || t);
  const kindIcon = (c) => ({ game: "🎮", ar: "🕶️", video: "🎵", move: { aerobic: "❤️", strength: "💪", flex: "🧘", balance: "🦩" }[c.type] }[c.kind]);
  function show() {
    plan = build(new Date().toISOString().slice(0, 10) + ":" + seed);
    const P = plan.P, U = plan.U, today = plan.days[0];
    const wkAero = Math.round(U.weekType.aerobic || 0), likes = (P.likes || []).map((k) => Q[0].opts.find((o) => o[0] === k)?.[1]).filter(Boolean);
    const favs = Object.entries(U.count).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c} ครั้ง)`);
    const tried = Object.keys(U.count).length;
    const card = (d, i) => `<div class="ap-day${i === 0 ? " today" : ""}${d.rest ? " rest" : ""}"><div class="ap-day-h"><b>${i === 0 ? "วันนี้" : "วัน" + DAYS[d.dow]}</b><small>${new Date(d.date + "T00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</small></div>
      ${d.rest ? `<p class="ap-rest">😴 วันพัก · เดินเล่นสบาย ๆ หลังอาหาร 10 นาทีได้</p>` : `<ul>${d.items.map((c) => `<li><span class="ap-ic">${kindIcon(c)}</span><span><b>${esc(c.n)}</b><small>${typeName(c.type)}${c.why[0] ? " · " + esc(c.why[0]) : ""}</small></span>${i === 0 && c.kind !== "move" ? `<button type="button" class="btn sm" data-go="${c.id}">เล่น</button>` : ""}</li>`).join("")}</ul>`}</div>`;
    const moves = today.items.filter((c) => c.kind === "move");
    $("#apBox").innerHTML = head(`ตามความสนใจ (${likes.join(" ") || "ทั่วไป"}) และการใช้งานจริง 4 สัปดาห์ · ${P.time} นาที/วัน · ${P.days} วัน/สัปดาห์`) + `
      <div class="ap-insight">
        <div><b>${Math.round(U.total28)}</b><small>นาที ใน 4 สัปดาห์</small></div><div><b>${wkAero}/150</b><small>นาทีแอโรบิก สัปดาห์นี้</small></div><div><b>${U.strengthDays}/2</b><small>วันเสริมแรง สัปดาห์นี้</small></div>
        <p>🧠 AI เห็นว่า${favs.length ? ` คุณทำบ่อย: ${esc(favs.join(", "))}` : tried ? ` 4 สัปดาห์นี้คุณลองไปแล้ว ${tried} อย่าง ยังไม่มีท่าประจำ จึงจัดตามความสนใจเป็นหลัก` : " คุณเพิ่งเริ่มใช้งาน จึงจัดตามความสนใจเป็นหลัก"}${(P.limits || []).filter((x) => x !== "none").length ? " · หลีกเลี่ยงท่าที่ไม่เหมาะกับ" + (P.limits || []).filter((x) => x !== "none").map((x) => ({ knee: "เข่า", back: "หลัง", balance: "การทรงตัว" }[x])).join(" ") : ""}</p>
      </div>
      ${today.rest ? "" : `<div class="ap-today"><div><b>▶ ฝึกวันนี้ ${P.time} นาที</b><small>${today.items.length} ท่า · ${[...new Set(today.items.map((c) => typeName(c.type)))].join(" + ")}</small></div>
        ${moves.length ? `<button type="button" class="btn primary" data-ap="start">▶ เริ่มฝึกวันนี้</button><button type="button" class="btn sm" data-ap="save">💾 เก็บเป็นโปรแกรมของฉัน</button>` : ""}</div>`}
      <div class="ap-week">${plan.days.map(card).join("")}</div>
      <p class="ap-note">ตารางปรับตัวเองทุกครั้งที่คุณบันทึกการฝึกหรือเล่นเกม · อ้างอิงเป้าหมาย ADA/ACSM สำหรับกลุ่มเสี่ยงเบาหวาน · ถ้าเจ็บหรือเหนื่อยผิดปกติให้หยุดทันที</p>
      <div class="care-foot"><button type="button" class="btn" data-ap="edit">✏️ ปรับความสนใจ</button><button type="button" class="btn" data-ap="shuffle">🔄 จัดใหม่</button></div>`;
  }
  // turn today's moves into a player session sized to the person's time
  function todayItems() {
    const P = plan.P, moves = plan.days[0].items.filter((c) => c.kind === "move");
    const items = moves.map((c) => A().normItem(c.cat, c.idx));
    const secs = A().estSecs(items, 15), want = P.time * 60;
    if (secs > 0 && secs < want * 0.6) items.forEach((it) => { it.sets = Math.min(3, Math.max(it.sets, Math.round((want / secs) * it.sets))); }); // fill the time with extra sets
    return items;
  }
  function onClick(e) {
    if (e.target.id === "apModal") return close();
    const opt = e.target.closest(".ap-opt");
    if (opt) {
      const k = opt.dataset.q, raw = opt.dataset.v, v = isNaN(+raw) ? raw : +raw;
      if (opt.dataset.multi === "1") { let arr = answers[k] || []; if (v === "none") arr = ["none"]; else { arr = arr.filter((x) => x !== "none"); arr = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; } answers[k] = arr; }
      else answers[k] = v;
      return drawQuiz();
    }
    const go = e.target.closest("[data-go]");
    if (go) {
      const c = plan.days[0].items.find((x) => x.id === go.dataset.go); close();
      if (c.kind === "game") { if (window.PreDMTrack?.startGame) window.PreDMTrack.startGame(c.game); }
      else if (c.kind === "ar") window.PreDMAR?.open();
      else if (c.kind === "video") location.hash = "ex-isan";
      return;
    }
    const b = e.target.closest("[data-ap]"); if (!b) return;
    const a = b.dataset.ap;
    if (a === "close") return close();
    if (a === "make") { if (!(answers.likes || []).length) answers.likes = ["walk"]; A().store.set(KEY, answers); editing = false; A().toast?.("AI จัดตารางฝึกให้แล้ว"); return show(); }
    if (a === "edit") { editing = true; return quiz(); }
    if (a === "shuffle") { seed++; return show(); }
    if (a === "start") { const items = todayItems(); close(); A().openPlayer("แผน AI วันนี้", items, 15); return; }
    if (a === "save") {
      const items = todayItems(), progs = A().store.get("myPrograms", null) || [];
      progs.unshift({ id: "ai" + Date.now().toString(36), name: `แผน AI ${new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`, rest: 15, items: items.map((it) => ({ cat: it.cat, idx: it.idx, kind: it.kind, val: it.val, sets: it.sets })) });
      A().store.set("myPrograms", progs.filter((x) => !x.sample)); A().toast?.("เก็บไว้ใน ★ โปรแกรมของฉัน แล้ว"); return;
    }
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-aiplan]")) { e.preventDefault(); editing = false; open(); } });
  window.PreDMAIPlan = { open, build, rank, catalog, usage };
})();
